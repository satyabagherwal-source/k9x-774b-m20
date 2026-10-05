# Forensic Learning Record (Deep Inspection): authzed/spicedb

> **Canonical Artifact**: `07_PROJECT_LEARNING/authzed-spicedb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/authzed/spicedb](https://github.com/authzed/spicedb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:24:02.362Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `authzed/spicedb`
- **Description**: Open Source, Google Zanzibar-inspired database for scalably storing and querying fine-grained authorization data
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 7109 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/spicedb/main.go`
```
package main

import (
	"errors"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/sercand/kuberesolver/v5"
	"google.golang.org/grpc/balancer"
	_ "google.golang.org/grpc/xds"

	"github.com/authzed/spicedb/cmd/spicedb/memoryprotection"
	log "github.com/authzed/spicedb/internal/logging"
	"github.com/authzed/spicedb/pkg/cmd"
	cmdutil "github.com/authzed/spicedb/pkg/cmd/server"
	_ "github.com/authzed/spicedb/pkg/runtime"
	"github.com/authzed/spicedb/pkg/spiceerrors"
)

func main() {
	memoryprotection.InitDefaultMemoryUsageProvider()

	// Set up root logger
	// This will typically be overwritten by the logging setup for a given command.
	zerolog.TimeFieldFormat = time.RFC3339Nano
	log.SetGlobalLogger(zerolog.New(os.Stderr).Level(zerolog.InfoLevel))

	// Enable Kubernetes gRPC resolver
	kuberesolver.RegisterInCluster()

	// Enable consistent hashring gRPC load balancer
	balancer.Register(cmdutil.ConsistentHashringBuilder)

	// Build the complete command structure
	rootCmd, err := cmd.BuildRootCommand()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to build root command")
	}

	if err := rootCmd.Execute(); err != nil {
		if !errors.Is(err, cmd.ErrParsing) {
			log.Err(err).Msg("terminated with errors")
		}
		var termErr spiceerrors.TerminationError
		if errors.As(err, &termErr) {
			os.Exit(termErr.ExitCode())
		}
		os.Exit(1)
	}
}

```

### Core Architecture Module: `cmd/spicedb/memoryprotection/memory_protection_noop.go`
```
//go:build !memoryprotection

package memoryprotection

// InitDefaultMemoryUsageProvider initializes the default memory usage provider.
// When no "memoryprotection" tag is set at build time, this falls back to the no-op provider.
func InitDefaultMemoryUsageProvider() {}

```

### Core Architecture Module: `cmd/spicedb/memoryprotection/memory_protection_rtml.go`
```
//go:build memoryprotection

package memoryprotection

import (
	"github.com/authzed/spicedb/internal/middleware/memoryprotection/rtml"
	cmdutil "github.com/authzed/spicedb/pkg/cmd/server"
)

// InitDefaultMemoryUsageProvider initializes the default memory usage provider.
// When "memoryprotection" tag is set at build time, this sets the go-rtml provider.
// If you see the following error, add "-ldflags=-checklinkname=0" at build time:
//
//	link: github.com/odigos-io/go-rtml: invalid reference to runtime.gcController
func InitDefaultMemoryUsageProvider() {
	cmdutil.DefaultMemoryUsageProvider = rtml.NewRealTimeMemoryUsageProvider()
}

```

### Core Architecture Module: `e2e/client.go`
```
package e2e

import (
	"google.golang.org/grpc"

	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
)

// Client holds versioned clients to spicedb that all share the same connection
type Client interface {
	V1() v1Client
}

type v1Client interface {
	Permissions() v1.PermissionsServiceClient
	Schema() v1.SchemaServiceClient
}

type spiceDBClient struct {
	v1Client v1Client
}

func (c *spiceDBClient) V1() v1Client {
	return c.v1Client
}

type spiceDBv1Client struct {
	v1.PermissionsServiceClient
	v1.SchemaServiceClient
}

func (s *spiceDBv1Client) Permissions() v1.PermissionsServiceClient {
	return s
}

func (s *spiceDBv1Client) Schema() v1.SchemaServiceClient {
	return s
}

// NewClient returns a spicedb Client for the given grpc connection
func NewClient(conn *grpc.ClientConn) Client {
	return &spiceDBClient{
		v1Client: &spiceDBv1Client{
			PermissionsServiceClient: v1.NewPermissionsServiceClient(conn),
			SchemaServiceClient:      v1.NewSchemaServiceClient(conn),
		},
	}
}

```

### Core Architecture Module: `e2e/cockroach/cockroach.go`
```
package cockroach

import (
	"context"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/authzed/spicedb/e2e"
)

//go:generate go run github.com/ecordell/optgen -output cockroach_options.go . Cockroach

// Node represents a single cockroachdb instance
type Node struct {
	Peers     []string
	Addr      string
	Httpaddr  string
	ID        string
	MaxOffset time.Duration
	Cancel    context.CancelFunc
	// only available after Start()
	pid  int
	conn *pgx.Conn
}

// Start starts the cockroach instance with exec
func (c *Node) Start(ctx context.Context) error {
	logfile, err := e2e.File(ctx, fmt.Sprintf("crdb-%s.log", c.ID))
	if err != nil {
		return err
	}
	cmd := []string{
		"./cockroach",
		"start",
		"--store=type=mem,size=640MiB",
		"--logtostderr",
		"--insecure",
		"--listen-addr=" + c.Addr,
		"--http-addr=" + c.Httpaddr,
		"--join=" + strings.Join(c.Peers, ","),
		"--max-offset=" + c.MaxOffset.String(),
	}

	ctx, cancel := context.WithCancel(ctx)
	c.Cancel = cancel
	c.pid, err = e2e.GoRun(ctx, logfile, logfile, cmd...)
	return err
}

func (c *Node) Stop() error {
	if c.pid < 1 {
		return fmt.Errorf("can't stop an unstarted crdb")
	}
	c.Cancel()
	return nil
}

// ConnectionString returns the postgres db URI for this cluster
func (c *Node) ConnectionString(dbName string) string {
	return fmt.Sprintf("postgresql://root@%s/%s?sslmode=disable", c.Addr, dbName)
}

// Connect connects directly to the cockroach instance and caches the connection
func (c *Node) Connect(ctx context.Context, _ io.Writer, dbName string) error {
	if c.pid < 1 {
		return fmt.Errorf("can't connect to unstarted cockroach")
	}

	conn, err := pgx.Connect(ctx, c.ConnectionString(dbName))
	if err != nil {
		return err
	}

	c.conn = conn
	return nil
}

// Conn returns the current connection. Must only be called after Connect().
func (c *Node) Conn() *pgx.Conn {
	return c.conn
}

// NodeID returns the cockroach-internal node id for this connection. This is
// the value that is referenced by other crdb metadata to identify range leader,
// follower nodes, etc.
func (c *Node) NodeID(ctx context.Context) (int, error) {
	var nodeID string
	if err := c.conn.QueryRow(ctx, "SHOW node_id").Scan(&nodeID); err != nil {
		return -1, err
	}

	i, err := strconv.Atoi(nodeID)
	if err != nil {
		return -1, err
	}
	return i, nil
}

// Cluster represents a set of Node nodes configured to talk to
// each other.
type Cluster []*Node

// NewCluster returns a pre-configured cluster of the given size.
func NewCluster(n int) Cluster {
	cs := make([]*Node, 0, n)
	peers := make([]string, 0, n)

	port := 26257
	http := 8080
	for i := 0; i < n; i++ {
		addr := net.JoinHostPort("localhost", strconv.Itoa(port+i))
		peers = append(peers, addr)
		cs = append(cs, &Node{
			ID:        strconv.Itoa(i + 1),
			Addr:      addr,
			Httpaddr:  net.JoinHostPort("localhost", strconv.Itoa(http+i)),
			MaxOffset: 5 * time.Second,
		})
	}
	for i := range cs {
		cs[i].Peers = peers
	}
	return cs
}

// Started returns true if all instances have been started
func (cs Cluster) Started() bool {
	for _, c := range cs {
		if c.pid <= 0 {
			return false
		}
	}
	return true
}

// Stop stops the entire cluster of spicedb instances
func (cs Cluster) Stop(out io.Writer) error {
	for i, c := range cs {
		fmt.Fprintln(out, "stopping crdb node", i)
		if err := c.Stop(); err != nil {
			return err
		}
	}
	return nil
}

// Init runs the cockroach init command against the cluster
func (cs Cluster) Init(ctx context.Context, out, errOut io.Writer) {
	// this retries until it succeeds, it won't return unless it does
	if err := e2e.Run(ctx, out, errOut, "./cockroach",
		"init",
		"--insecure",
		"--host="+cs[0].Addr,
	); err != nil {
		panic(err)
	}
}

// SQL runs the set of SQL commands against the cluster
func (cs Cluster) SQL(ctx context.Context, out, errOut io.Writer, sql ...string) error {
	for _, s := range sql {
		if err := e2e.Run(ctx, out, errOut,
			"./cockroach", "sql", "--insecure", "--host="+cs[0].Addr,
			"-e", s,
		); err != nil {
			return err
		}
	}
	return nil
}

// NetworkDelay simulates network delay against the selected node
func (cs Cluster) NetworkDelay(ctx context.Context, out io.Writer, node int, duration time.Duration) error {
	_, port, err := net.SplitHostPort(cs[node].Addr)
	if err != nil {
		return err
	}
	return e2e.Run(ctx, out, out,
		"sudo",
		"./chaosd",
		"attack",
		"network",
		"delay",
		"-l="+duration.String(),
		"-e="+port,
		"-d=lo",
		"-p=tcp",
	)
}

// TimeDelay adds a skew to the clock of the given node
func (cs Cluster) TimeDelay(ctx context.Context, out io.Writer, node int, duration time.Duration) error {
	return e2e.Run(ctx, out, out,
		"sudo",
		"./chaosd",
		"attack",
		"clock",
		fmt.Sprintf("--pid=%d", cs[node].pid),
		fmt.Sprintf("--time-offset=%s", duration),
		"--clock-ids-slice=CLOCK_REALTIME,CLOCK_MONOTONIC",
	)
}

```

### Core Architecture Module: `e2e/cockroach/cockroach_options.go`
```
// Code generated by github.com/ecordell/optgen. DO NOT EDIT.
package cockroach

type CockroachOption func(c *Node)

// NewCockroachWithOptions creates a new Node with the passed in options set
func NewCockroachWithOptions(opts ...CockroachOption) *Node {
	c := &Node{}
	for _, o := range opts {
		o(c)
	}
	return c
}

// CockroachWithOptions configures an existing Node with the passed in options set
func CockroachWithOptions(c *Node, opts ...CockroachOption) *Node {
	for _, o := range opts {
		o(c)
	}
	return c
}

// WithPeers returns an option that can append Peerss to Node.Peers
func WithPeers(peers string) CockroachOption {
	return func(c *Node) {
		c.Peers = append(c.Peers, peers)
	}
}

// SetPeers returns an option that can set Peers on a Node
func SetPeers(peers []string) CockroachOption {
	return func(c *Node) {
		c.Peers = peers
	}
}

// WithAddr returns an option that can set Addr on a Node
func WithAddr(addr string) CockroachOption {
	return func(c *Node) {
		c.Addr = addr
	}
}

// WithHttpaddr returns an option that can set Httpaddr on a Node
func WithHttpaddr(httpaddr string) CockroachOption {
	return func(c *Node) {
		c.Httpaddr = httpaddr
	}
}

// WithId returns an option that can set ID on a Node
func WithId(id string) CockroachOption {
	return func(c *Node) {
		c.ID = id
	}
}

```

### Core Architecture Module: `e2e/doc.go`
```
// Package e2e contains a series of tests, including tests that verify SpiceDB addresses the New Enemy problem.
package e2e

```

### Core Architecture Module: `e2e/file.go`
```
package e2e

import (
	"context"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

// File returns a writer to a new file that will be closed when the context is
// cancelled.
func File(ctx context.Context, name string) (*os.File, error) {
	f, err := os.Create(name)
	if err != nil {
		return nil, err
	}

	// close file on context done
	go func() {
		<-ctx.Done()
		if err := f.Close(); err != nil {
			fmt.Println(err)
		}
	}()
	return f, nil
}

// MustFile fails the test if it can't create a file called name.
func MustFile(ctx context.Context, t *testing.T, name string) *os.File {
	f, err := File(ctx, name)
	require.NoError(t, err)
	return f
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3385** (2026-09-29): **test: verify classic and planned permission checks**
  *Symptoms*: ## Summary  - Add a property-based integration test that compares the classic checker with plain and optimized query planner checks on the same generated schema, relationships, and datastore revision. - Use a small object ID pool so generated graphs exercise arrows and set operations, including both permission and no-permission results. - Keep generated subject and resource definitions distinct, restrict arrows to valid targets, and sort map-derived choices for reproducible rapid seeds.  ## Tests  - `GOCACHE=/tmp/spicedb-go-cache go test ./pkg/schema/v2/testing -count=1` - `GOCACHE=/tmp/spicedb-go-cache go test -tags=integration ./internal/services/integrationtesting/queryconsistency -run '^TestQueryPlanCheckProperty$' -count=1 -rapid.checks=1000` 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3385?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #3382** (2026-09-29): **chore(deps): bump the docker group with 2 updates**
  *Symptoms*: > [!WARNING] > Cooldown could not be applied because no publication date was available from the registry. >  Bumps the docker group with 2 updates: golang and chainguard/static.  Updates `golang` from 1.27.0-alpine to 1.27.1-alpine  Updates `chainguard/static` from `bf639cb` to `41e17ed`   Dependabot will resolve any conflicts with this PR as long as you don't alter it yourself. You can also trigger a rebase manually by commenting `@dependabot rebase`.  [//]: # (dependabot-automerge-start) [//]: # (dependabot-automerge-end)  ---  <details> <summary>Dependabot commands and options</summary> <br />  You can trigger Dependabot actions by commenting on this PR: - `@dependabot rebase` will rebase this PR - `@dependabot recreate` will recreate this PR, overwriting any edits that have been made to it - `@dependabot show <dependency name> ignore conditions` will show all of the ignore conditions of the specified dependency - `@dependabot ignore <dependency name> major version` will close this group update PR and stop Dependabot creating any more for the specific dependency's major version (unless you unignore this specific dependency's major version or upgrade to it yourself) - `@dependabot ignore <dependency name> minor version` will close this group update PR and stop Dependabot creating any more for the specific dependency's minor version (unless you unignore this specific dependency's minor version or upgrade to it yourself) - `@dependabot ignore <dependency name>` will close thi

- **Issue #3375** (2026-09-23): **test(consistency): let callers run the consistency fixtures serially**
  *Symptoms*: The consistency suite runs each validation file in parallel. That suits a datastore that is cheap to stand up, but it isn't the only reasonable choice: a caller whose datastore is expensive to create may prefer to keep only one fixture's resources live at a time.  This adds a variadic option to the exported entry points so callers can choose:  ```go consistencytest.AllConsistency(t, tester, consistencytest.RunFixturesSerially()) consistencytest.ConsistencyForEngine(t, engineID, tester, consistencytest.RunFixturesSerially()) ```  - Default is unchanged: fixtures run in parallel, and every existing call site compiles untouched. - The chunk-size and dispatcher subtests within a fixture stay parallel in both modes, so work inside a fixture still overlaps.  `SuiteOption` / `RunFixturesSerially` mirrors the option style already used by `pkg/datastore/test` (`SuiteOption` / `RunSubtestsSerially`).
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3375?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :x: Patch coverage is `61.11111%` with `7 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/authzed/spicedb/pull/3375?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) | Patch % | Lines | |---|---|---| | [pkg/consistency/test/consistency.go](https://app.codecov.io/gh/authzed/spicedb/pull/3375?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed#diff-cGtnL2NvbnNpc3RlbmN5L3Rlc3QvY29uc2lzdGVuY3kuZ28=) | 61.12% | [6 Missing and 1 partial :warning: ](https://app.codecov.io/gh/authzed/spicedb/pull/3375?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=p

- **Issue #3374** (2026-09-22): **fix: stop serving a revision that has no validity**
  *Symptoms*: ## What  Two bugs that only bite together: MemDB hands out a revision with the wrong validity, and the optimized revision cache keeps a revision that says it has none.  ### 1. MemDB reports the discarded revision's validity  `memdb.OptimizedRevision` falls back to head when rounding down to a quantization boundary would land before the first write (#3366). The validity it returns alongside head still describes the quantized revision it just discarded:  ```go quantized, validFor := revisions.Quantize(nowRevision(), 0, mdb.quantizationPeriod) optimized := quantized.(revisions.TimestampRevision)  if optimized.LessThan(firstServable) {     optimized = mdb.headRevisionNoLock()   // revision replaced } return ...{Revision: optimized, ValidFor: validFor, ...}   // validity is the old one ```  Since #3196, optimized revisions are cached for as long as they say they are valid (`proxy.NewOptimizedRevisionProxy` computes `validThrough = now + ValidFor`). So the fallback hands out head with up to a full quantization interval of validity, and every default-consistency read for the rest of that interval is served from that pinned head — missing any write made in the meantime. That is the same staleness the fallback exists to prevent, reintroduced one layer up.  ### 2. The cache keeps a revision that has no validity  Reporting `ValidFor: 0` is not enough on its own. Before testing its entries, the cache subtracts a random slice of the configured maximum staleness from "now", so that request
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3374?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #3372** (2026-09-22): **ci: run the tests when the build system changes**
  *Symptoms*: ## What  Adds `magefiles/**` and `.dockerignore` to the `codechange` paths filter in `build-test.yaml`.  ## Why  Every test job in this workflow runs through mage — `go run mage.go test:image`, `testds:<engine>`, and so on. But `magefiles/**` was not in the filter, so a pull request that changed only the build system skipped every job it affected.  Seen on #3369, which changes how the test targets set up Docker: **34 checks passed, 9 skipped** — and the skipped ones include Build Binary & Image, the exact job that PR alters. A change that broke all of CI would have merged green.  `.dockerignore` is the same shape of problem: it decides what the image build sees, and #3364 has just made the build depend on it.  ## How  Two entries in the filter. No job definitions change.  ## References  Found while reviewing #3369, which is blocked from testing itself for this reason.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3372?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #3371** (2026-09-22): **ci: approve the docs PR with the gh CLI**
  *Symptoms*: ## Problem  The docs sync job has failed on every push to `main` since this morning:  ``` Error: Cannot find module 'undici' ```  [Failing run](https://github.com/authzed/spicedb/actions/runs/35733545726/job/106764877648)  ## Cause  `juliangruber/approve-pull-request-action` v2.1.1 ships a bundle that ends with:  ```js module.exports = eval("require")("undici") ```  The bundler left `undici` out of the bundle and turned it into a plain require. The action ships no `node_modules`, so the require fails and the step exits before doing anything.  Running the v2.1.1 bundle locally reproduces the same error with any input; v2.1.0 does not. Dependabot moved us from v2.1.0 to v2.1.1 in #3357, and v2.1.1 is still the latest release, so there is nothing to upgrade to.  The failure was hidden until now because the step only runs when the docs actually changed. Before that it was skipped and the job passed.  ## Fix  The step now calls `gh pr review --approve`, which is the same API call the action made, with the same token. The next step already does automerge this way, so the two now match, and one less third-party action runs with our tokens.  ## Checks  - `yamllint` passes. - `actionlint` reports the same three pre-existing findings as before the change, all in an unrelated step.

- **Issue #3369** (2026-09-29): **ci: pull the testcontainers reaper image before tests start**
  *Symptoms*: ## What  Pull the Testcontainers reaper image before any test binary starts, in the mage targets that run tests against containers.  ## Why  The image job failed on an unrelated PR with:  ``` reaper: new reaper: run container: container create: Error response from daemon: Conflict. The container name "/reaper_a40838f3..." is already in use by container "4e45635b..." ```  This is infrastructure, not product code, and it can hit any suite that runs more than one package against containers.  `go test` runs packages concurrently, and every package in one invocation shares a Testcontainers session id, which is a hash of the parent process id. The reaper container is named after that session id, so all packages want the same container: one creates it and the rest reuse it. A package that loses that race gets a name conflict back from the daemon. Testcontainers does retry on that, but on a budget of 20 seconds that it does not let us configure.  Pulling the reaper image happens inside that budget. On a cold runner the losing package can spend the whole 20 seconds pulling, and then give up instead of reusing the reaper that by then exists. The failing run matches that shape: 20.97 seconds, and a single container-create attempt in the log.  Upstream has this open and unfixed (testcontainers-go #3242, #3169); v0.44.0, which we are on, is still the latest release. Pre-pulling is one of the remedies suggested in that thread.  ## How  `dockerForTests` replaces `checkDocker` in the targets

- **Issue #3367** (2026-09-22): **chore(deps): bump the go-mod group across 2 directories with 4 updates**
  *Symptoms*: Bumps the go-mod group with 3 updates in the / directory: [github.com/prometheus/common](https://github.com/prometheus/common), [go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc](https://github.com/open-telemetry/opentelemetry-go-contrib) and [go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp](https://github.com/open-telemetry/opentelemetry-go-contrib). Bumps the go-mod group with 1 update in the /tools/analyzers directory: [golang.org/x/tools](https://github.com/golang/tools).  Updates `github.com/prometheus/common` from 0.70.1 to 0.71.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/prometheus/common/releases">github.com/prometheus/common's releases</a>.</em></p> <blockquote> <h2>v0.71.0</h2> <h2>What's Changed</h2> <ul> <li>Synchronize common files from prometheus/prometheus by <a href="https://github.com/prombot"><code>@​prombot</code></a> in <a href="https://redirect.github.com/prometheus/common/pull/957">prometheus/common#957</a></li> <li>build(deps): bump the codeql group across 1 directory with 4 updates by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/prometheus/common/pull/955">prometheus/common#955</a></li> <li>Synchronize common files from prometheus/prometheus by <a href="https://github.com/prombot"><code>@​prombot</code></a> in <a href="https://redirect.github.com/prometheus/common/pull/958">prometheus/common#958
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/authzed/spicedb/pull/3367?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=authzed) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

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

### Incident Patch 1: `e4b276d7` (2026-09-29)
**Commit Message**: fix(ci): set up snapd in the release job instead of assuming it (#3360)

The release job installs snapcraft with

  sudo snap install snapcraft --channel=8.x/stable --classic

which fails on runner images where snapd is not running:

  error: cannot communicate with server: Post "http://localhost/v2/snaps/snapcraft":
         dial unix /run/snapd.socket: connect: no such file or directory

The identical step in nightly.yaml fails this way on pushes to main today, and
#3321 hit it in the Trivy job. Those two jobs never needed snapcraft and the
step was simply removed. This job does need it: goreleaser builds the snap
declared in .goreleaser.yml here, and this is the job that publishes it to the
Snap Store. Left alone it will fail the same way on the next tag.

So the step now provisions snapd rather than assuming it. It probes for
/run/snapd.socket, installs and starts snapd when the socket is missing,
waits for seeding to finish, and only then installs snapcraft. apt and
systemctl are allowed to fail quietly because the socket check that follows
decides, and gives a clearer message than either would.

If snapd still cannot be had, the step exits 1 with an explicit message rather
th

**File**: `.github/workflows/release.yaml` (modified, +30/-2)
```diff
@@ -27,11 +27,39 @@ jobs:
         if: "${{ !startsWith(github.ref_name, 'v') || steps.version.outputs.is_valid != 'true' }}"
         run: 'echo "SpiceDB version must start with `v` and be a semver" && exit 1'
         shell: "bash"
+      # goreleaser builds and publishes the snap declared in .goreleaser.yml,
+      # which needs the snapcraft CLI, which is itself distributed as a snap.
+      # Runner images vary in whether snapd is installed and running, and
+      # without it `snap install` fails with "cannot communicate with server
+      # ... /run/snapd.socket: no such file or directory". So provision snapd
+      # rather than assume it. If it cannot be provisioned this step fails on
+      # purpose: a release that quietly stops publishing the snap is worse than
+      # one that stops loudly.
       - name: "Install snapcraft"
         run: |
+          set -euo pipefail
+          if [ ! -S /run/snapd.socket ]; then
+            echo "snapd is not running on this runner; installing and starting it"
+            # Let these fail quietly: the socket check below is what decides,
+            # and it gives a better message than apt or systemctl would.
+            sudo apt-get update && sudo apt-get install --yes snapd || true
+            sudo systemctl enable --now snapd.socket || true
+          fi
+          if [ ! -S /run/snapd.socket ]; then
+            echo "::error::snapd is unavailable on this runner, so snapcraft cannot be installed and the snap cannot be published."
+            exit 1
+          fi
+          # snapd accepts connections before it has finished seeding, and
+          # `snap install` fails until it has. Bound the wait: snapd on these
+          # images has been seen to hang rather than fail (see #3321), and a
+          # release job that hangs for six hours is worse than one that stops.
+          if ! sudo timeout 300 snap wait system seed.loaded; then
+            echo "::error::snapd did not finish seeding within 5 minutes, so snapcraft cannot be installed and the snap cannot be published."
+            exit 1
+          fi
           sudo snap install snapcraft --channel=8.x/stable --classic
-          mkdir -p $HOME/.cache/snapcraft/download
-          mkdir -p $HOME/.cache/snapcraft/stage-packages
+          mkdir -p "${HOME}/.cache/snapcraft/download"
+          mkdir -p "${HOME}/.cache/snapcraft/stage-packages"
       - uses: "authzed/actions/docker-login@11667c9b2e8b3649ad2af4d788e57d18f8e8eaf1" # main
         with:
           quayio_token: "${{ secrets.QUAYIO_PASSWORD }}"
```

---

### Incident Patch 2: `ee41e694` (2026-07-08)
**Commit Message**: fix(query): sound caveat resolution and depth errors for recursive relations

Recursive relations tracked reachable objects with a global visited set
and kept the caveat of the first path by which each object was reached. An
object first reached via a caveated edge kept that caveat on every
descendant even when later reached unconditionally, reporting conditional
access where access was in fact unconditional (a caveated diamond is
enough to trigger it; no cycle required).

Replace the visited set with a semi-naive fixpoint over a canonical caveat
condition (a DNF with idempotent AND and an absorbing unconditional case),
re-expanding an object only when a new path weakens its condition and
buffering results until the traversal converges so a caveat is never
emitted before it is final. When no recursive edge is caveated this
reduces to the previous BFS. Also surface MaxRecursionDepthError on depth
exhaustion instead of silently returning a truncated result.

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Caveats: compiled caveats (and their CEL environments) are now cached per schema version — hung off the stored schema (`ReadOnlyStoredSchema`) and rebuilt only when the schema changes — rather than rebuilt on every check, reducing check cost for schemas with many caveats (https://github.com/authzed/spicedb/pull/3166)
 
 ### Fixed
+- Query Planner: recursive relations (e.g. `member: user | group#member`) no longer report a subject as only conditionally reachable when an uncaveated path makes it unconditional, and a traversal that exceeds the maximum recursion depth now returns an error instead of a silently truncated result (experimental `--experimental-query-plan`) (https://github.com/authzed/spicedb/pull/3220)
 - Fixed a nil pointer dereference panic in `CheckBulkPermissions` that could occur under concurrent load when a tracing-enabled check shared a singleflight dispatch with a non-tracing bulk check. Debug-enabled checks are no longer singleflighted together with non-debug checks. (https://github.com/authzed/spicedb/pull/3174)
 - Fixed a nil pointer dereference panic in the Postgres FDW (https://github.com/authzed/spicedb/pull/3235)
 - CockroachDB: deletes performed by CockroachDB's row-level TTL job for expired relationships are no longer emitted as `DELETE` events by the Watch API. On CockroachDB ≥ 24.1, SpiceDB sets the `ttl_disable_changefeed_replication` storage parameter on the relationship tables at startup (if it lacks `ALTER TABLE` privileges, it logs a warning with the statement to run manually); on older versions a startup warning is logged and TTL deletes continue to be emitted. Note that the parameter affects any changefeed over these tables — external changefeeds that want TTL deletes can opt back in with `ignore_disable_changefeed_replication`. Delete-only transactions also no longer write an internal transaction-metadata marker row, reducing write amplification. (https://github.com/authzed/spicedb/pull/3210)
```

**File**: `internal/caveats/canonical.go` (added, +309/-0)
```diff
@@ -0,0 +1,309 @@
+package caveats
+
+import (
+	"sort"
+	"strings"
+
+	"google.golang.org/protobuf/proto"
+
+	pkgcaveats "github.com/authzed/spicedb/pkg/caveats"
+	core "github.com/authzed/spicedb/pkg/proto/core/v1"
+)
+
+// Condition is a canonical, order-independent representation of a caveat
+// expression as a disjunctive normal form (DNF): an OR of conjuncts, where each
+// conjunct is an AND of atoms. It exists so that recursive traversals can decide
+// whether a newly-discovered path *weakens* the condition under which an object
+// is reachable — the termination guarantee of the semi-naive fixpoint.
+//
+// Two properties make that guarantee hold:
+//   - AND is idempotent and commutative: c1 ∧ c2 ∧ c1 collapses to {c1, c2}, so
+//     the set of distinct conjuncts is finite.
+//   - ⊤ (unconditional) is absorbing under OR: once an object is reachable
+//     unconditionally, no further path can weaken it.
+//
+// The zero value is the "false" condition (no disjuncts); use Top() for the
+// unconditional condition and FromExpression to derive one from a caveat.
+type Condition struct {
+	top       bool
+	disjuncts [][]atom // OR of conjuncts; each conjunct sorted+deduped by atom key, non-empty
+}
+
+// atom is a single indivisible leaf of a condition: a contextualized caveat, or
+// an opaque (e.g. negated) subexpression. key is the canonical identity used for
+// dedup, sorting and comparison; expr is retained so the original expression can
+// be rebuilt, since the key alone cannot recover a caveat's context.
+type atom struct {
+	key  string
+	expr *core.CaveatExpression
+}
+
+// Top returns the unconditional (always-true) condition.
+func Top() Condition {
+	return Condition{top: true}
+}
+
+// FromExpression converts a caveat expression into its canonical DNF. A nil
+// expression is unconditional and yields Top().
+func FromExpression(expr *core.CaveatExpression) Condition {
+	if expr == nil {
+		return Top()
+	}
+	return fromExpr(expr)
+}
+
+func fromExpr(expr *core.CaveatExpression) Condition {
+	if leaf := expr.GetCaveat(); leaf != nil {
+		return singleAtom(atom{key: caveatAtomKey(leaf), expr: expr})
+	}
+
+	op := expr.GetOperation()
+	if op == nil {
+		return singleAtom(atom{key: opaqueAtomKey(expr), expr: expr})
+	}
+
+	switch op.GetOp() {
+	case core.CaveatOperation_AND:
+		result := Top()
+		for _, child := range op.GetChildren() {
+			result = result.And(fromExpr(child))
+		}
+		return result
+
+	case core.CaveatOperation_OR:
+		var result Condition // the zero value is the "false" condition
+		for _, child := range op.GetChildren() {
+			result, _ = result.Or(fromExpr(child))
+		}
+		return result
+
+	default:
+		// NOT (and anything unrecognized) is treated as an opaque atom: we do not
+		// distribute negation, which keeps the atom set finite and the result sound
+		// (conservative — it may report "changed" when logically unchanged).
+		return singleAtom(atom{key: opaqueAtomKey(expr), expr: expr})
+	}
+}
+
+// IsTop reports whether the condition is unconditional.
+func (c Condition) IsTop() bool {
+	return c.top
+}
+
+// Disjuncts returns the number of DNF disjuncts (0 for Top or false).
+func (c Condition) Disjuncts() int {
+	return len(c.disjuncts)
+}
+
+// And returns the canonical conjunction of the two conditions.
+func (c Condition) And(other Condition) Condition {
+	if c.top {
+		return other
+	}
+	if other.top {
+		return c
+	}
+	// false AND x == false
+	if len(c.disjuncts) == 0 || len(other.disjuncts) == 0 {
+		return Condition{}
+	}
+
+	// Distribute: (A1 ∨ A2) ∧ (B1 ∨ B2) == (A1∧B1) ∨ (A1∧B2) ∨ (A2∧B1) ∨ (A2∧B2).
+	product := make([][]atom, 0, len(c.disjuncts)*len(other.disjuncts))
+	for _, a := range c.disjuncts {
+		for _, b := range other.disjuncts {
+			combined := make([]atom, 0, len(a)+len(b))
+			combined = append(combined, a...)
+			combined = append(combined, b...)
+			product = append(product, combined)
+		}
+	}
+	return normalizeCondition(product)
+}
+
+// Or returns the cano
```

**File**: `internal/caveats/canonical_test.go` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+package caveats
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestConditionTop(t *testing.T) {
+	require.True(t, Top().IsTop())
+	require.Equal(t, "true", Top().String())
+
+	// A nil expression is unconditional.
+	require.True(t, FromExpression(nil).IsTop())
+
+	// A single caveat is conditional.
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	require.False(t, c1.IsTop())
+	require.Equal(t, "cav1", c1.String())
+	require.Equal(t, 1, c1.Disjuncts())
+}
+
+func TestConditionAndIsIdempotent(t *testing.T) {
+	// c1 ∧ c2 ∧ c1 must collapse to the two-atom conjunct {c1, c2}.
+	expr := And(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")), CaveatExprForTesting("cav1"))
+	c := FromExpression(expr)
+	require.Equal(t, "cav1 & cav2", c.String())
+	require.Equal(t, 1, c.Disjuncts())
+}
+
+func TestConditionAndIsCommutative(t *testing.T) {
+	a := FromExpression(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")))
+	b := FromExpression(And(CaveatExprForTesting("cav2"), CaveatExprForTesting("cav1")))
+	require.Equal(t, a.String(), b.String())
+}
+
+func TestConditionAndWithTopIsIdentity(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	require.Equal(t, "cav1", Top().And(c1).String())
+	require.Equal(t, "cav1", c1.And(Top()).String())
+}
+
+func TestConditionAndDistributesOverOr(t *testing.T) {
+	// (cav1 | cav2) & cav3 == (cav1 & cav3) | (cav2 & cav3)
+	expr := And(Or(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")), CaveatExprForTesting("cav3"))
+	require.Equal(t, "cav1 & cav3 | cav2 & cav3", FromExpression(expr).String())
+}
+
+func TestConditionOrUnions(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	c2 := FromExpression(CaveatExprForTesting("cav2"))
+	res, changed := c1.Or(c2)
+	require.True(t, changed)
+	require.Equal(t, "cav1 | cav2", res.String())
+}
+
+func TestConditionOrIdempotentReportsUnchanged(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	res, changed := c1.Or(FromExpression(CaveatExprForTesting("cav1")))
+	require.False(t, changed, "OR-ing an identical condition must not report a change")
+	require.Equal(t, "cav1", res.String())
+}
+
+func TestConditionOrAbsorbsTop(t *testing.T) {
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+
+	// A conditional weakened by Top becomes unconditional (a change).
+	res, changed := c1.Or(Top())
+	require.True(t, res.IsTop())
+	require.True(t, changed)
+
+	// Top OR anything stays Top (no change).
+	res2, changed2 := Top().Or(c1)
+	require.True(t, res2.IsTop())
+	require.False(t, changed2)
+}
+
+func TestConditionOrSubsumesSuperset(t *testing.T) {
+	// cav1 ∨ (cav1 ∧ cav2): the two-atom conjunct is redundant (implies cav1), so
+	// the result is just cav1.
+	c1 := FromExpression(CaveatExprForTesting("cav1"))
+	c1and2 := FromExpression(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")))
+
+	res, changed := c1.Or(c1and2)
+	require.Equal(t, "cav1", res.String())
+	require.False(t, changed, "adding a subsumed conjunct does not weaken the condition")
+
+	// The other direction: starting from the superset and adding cav1 weakens it.
+	res2, changed2 := c1and2.Or(c1)
+	require.Equal(t, "cav1", res2.String())
+	require.True(t, changed2)
+}
+
+func TestConditionContextDistinguishesAtoms(t *testing.T) {
+	// Same caveat name, different context => distinct atoms.
+	a := FromExpression(MustCaveatExprForTestingWithContext("cav1", map[string]any{"x": 1}))
+	b := FromExpression(MustCaveatExprForTestingWithContext("cav1", map[string]any{"x": 2}))
+	res, changed := a.Or(b)
+	require.True(t, changed)
+	require.Equal(t, 2, res.Disjuncts(), "different context must not be deduped")
+}
+
+func TestConditionExpressionRoundTrip(t *testing.T) {
+	require.Nil(t, Top().Expression())
+
+	orig := FromExpression(And(CaveatExprForTesting("cav1"), CaveatExprForTesting("cav2")))
+	rebuilt := FromExpression(orig.Expression())
+	require.Equal(t, orig.
```

**File**: `pkg/query/errors.go` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+package query
+
+import "fmt"
+
+// MaxRecursionDepthError indicates that a recursive traversal did not resolve
+// within the configured maximum recursion depth. It mirrors the legacy
+// dispatcher's MaxDepthExceeded semantics: the answer is unknown, not negative.
+// Callers must surface this as an error rather than treating it as NOT_MEMBER or
+// an empty result set.
+type MaxRecursionDepthError struct {
+	Depth int
+}
+
+func (e MaxRecursionDepthError) Error() string {
+	return fmt.Sprintf("max recursion depth (%d) exceeded during recursive traversal: this usually indicates a recursive or too deep data dependency", e.Depth)
+}
```

**File**: `pkg/query/recursion_correctness_test.go` (added, +200/-0)
```diff
@@ -0,0 +1,200 @@
+package query
+
+import (
+	"fmt"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/internal/caveats"
+	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/internal/datastore/memdb"
+	"github.com/authzed/spicedb/internal/testfixtures"
+	caveattypes "github.com/authzed/spicedb/pkg/caveats/types"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	"github.com/authzed/spicedb/pkg/tuple"
+)
+
+// compileRecursive writes the schema and relationships to a fresh datastore and
+// returns a query context (with a caveat runner) plus the compiled iterator for
+// the given definition and relation.
+func compileRecursive(t *testing.T, schemaText, def, relation string, rels []tuple.Relationship) (*Context, Iterator) {
+	t.Helper()
+
+	rawDS, err := dsfortesting.NewMemDBDatastoreForTesting(t, 0, 0, memdb.DisableGC)
+	require.NoError(t, err)
+
+	ds, revision := testfixtures.DatastoreFromSchemaAndTestRelationships(t, rawDS, schemaText, rels)
+
+	dsSchema, err := ReadSchema(t.Context(), ds, revision)
+	require.NoError(t, err)
+
+	outline, err := BuildOutlineFromSchema(dsSchema, def, relation)
+	require.NoError(t, err)
+	it, err := outline.Compile()
+	require.NoError(t, err)
+
+	reader := NewQueryDatastoreReader(datalayer.NewDataLayer(ds).SnapshotReader(revision, datalayer.NoSchemaHashForTesting))
+	ctx := NewLocalContext(t.Context(),
+		WithReader(reader),
+		WithCaveatRunner(caveats.NewCaveatRunner(caveattypes.Default.TypeSet)),
+		WithMaxRecursionDepth(defaultMaxRecursionDepth),
+	)
+	return ctx, it
+}
+
+// groupMemberSchema is the canonical directly-cyclic userset relation: a group's
+// members are users plus the members of nested groups.
+const groupMemberSchema = `
+definition user {}
+definition group {
+	relation member: user | group#member
+}
+`
+
+// buildGroupChain constructs `depth` nested groups g0..g(depth-1) where
+// g0#member@user:tom and g(i)#member@g(i-1)#member. Thus user:tom is transitively
+// a member of every group, reached only by walking the full chain.
+func buildGroupChain(t *testing.T, depth int) (*Context, Iterator) {
+	t.Helper()
+
+	rels := make([]tuple.Relationship, 0, depth)
+	rels = append(rels, tuple.MustParse("group:g0#member@user:tom"))
+	for i := 1; i < depth; i++ {
+		rels = append(rels, tuple.MustParse(fmt.Sprintf("group:g%d#member@group:g%d#member", i, i-1)))
+	}
+	return compileRecursive(t, groupMemberSchema, "group", "member", rels)
+}
+
+// TestDeepChainCheckErrorsRatherThanSilentlyDenying verifies that a Check whose
+// answer lies beyond MaxRecursionDepth returns an error, matching the legacy
+// engine's MaxDepthExceeded, rather than silently returning NOT_MEMBER.
+func TestDeepChainCheckErrorsRatherThanSilentlyDenying(t *testing.T) {
+	// The chain is longer than defaultMaxRecursionDepth (50), so the membership of
+	// user:tom in group:g59 cannot be determined within the depth budget.
+	ctx, it := buildGroupChain(t, 60)
+
+	_, err := ctx.Check(it, NewObject("group", "g59"), NewObject("user", "tom").WithEllipses())
+	require.Error(t, err, "a check beyond max recursion depth must error, not silently deny")
+	require.ErrorAs(t, err, &MaxRecursionDepthError{})
+}
+
+// TestShallowChainCheckSucceeds is the control: a chain within the depth budget
+// resolves normally, so the depth error is not spuriously raised.
+func TestShallowChainCheckSucceeds(t *testing.T) {
+	ctx, it := buildGroupChain(t, 10)
+
+	path, err := ctx.Check(it, NewObject("group", "g9"), NewObject("user", "tom").WithEllipses())
+	require.NoError(t, err)
+	require.NotNil(t, path, "user:tom is a member of group:g9 via the chain")
+}
+
+// TestDeepChainLookupResourcesErrorsRatherThanTruncating verifies that a
+// LookupResources whose full result set lies beyond MaxRecursionDepth errors
+// rather than silently returning a truncated set.
+func TestDeepChainLookupResourcesErrorsRatherThanTruncating(t *testing.T) {
+	ctx, it := buildGroupChain(t, 
```

---

### Incident Patch 3: `7ff2f4cb` (2026-07-08)
**Commit Message**: fix(query): specify query shapes for planner datastore reads

The recursive self-edge existence probe (SubjectExistsAsRelationship) and
the forward MatchingResourcesForSubject lookup did not specify a query
shape. The former panics under the validating datastore; the latter fails
index checking on SQL datastores because the forward query-shape validator
had no case for it. Specify queryshape.Varying on the existence probe and
add the missing forward validator case.

**File**: `internal/datastore/proxy/indexcheck/queryshapevalidators.go` (modified, +32/-0)
```diff
@@ -287,6 +287,38 @@ func validateQueryShape(queryShape queryshape.Shape, filter datastore.Relationsh
 		}
 		return nil
 
+	case queryshape.MatchingResourcesForSubject:
+		// The forward form of this shape, as issued by pkg/query/reader.go's
+		// QueryResources: the resource type and relation are pinned, the resource
+		// ID is never specified, and exactly one subject selector fully specifies
+		// the subject type and ID. The subject relation is possibly-specified, so
+		// it is intentionally not validated (mirroring the reverse validator).
+		if err := validateCaveatFilter(filter, queryShape); err != nil {
+			return err
+		}
+		if err := validateResourceType(filter.OptionalResourceType, queryShape, true); err != nil {
+			return err
+		}
+		if err := validateResourceIDs(filter.OptionalResourceIds, queryShape, false); err != nil {
+			return err
+		}
+		if err := validateResourceRelation(filter.OptionalResourceRelation, queryShape, true); err != nil {
+			return err
+		}
+		if err := validateSubjectsSelectors(filter.OptionalSubjectsSelectors, queryShape, true); err != nil {
+			return err
+		}
+		if len(filter.OptionalSubjectsSelectors) != 1 {
+			return fmt.Errorf("exactly one subjects selector required for %s", queryShape)
+		}
+		if err := validateSubjectType(filter.OptionalSubjectsSelectors[0].OptionalSubjectType, queryShape); err != nil {
+			return err
+		}
+		if err := validateSubjectIDs(filter.OptionalSubjectsSelectors[0].OptionalSubjectIds, queryShape, true); err != nil {
+			return err
+		}
+		return nil
+
 	case queryshape.Varying:
 		// Nothing to validate.
 		return nil
```

**File**: `internal/datastore/proxy/indexcheck/queryshapevalidators_test.go` (modified, +82/-0)
```diff
@@ -738,6 +738,88 @@ func TestValidateQueryShape(t *testing.T) {
 			expectError: true,
 			errorMsg:    "subject relation required",
 		},
+		{
+			// The exact filter pkg/query/reader.go QueryResources builds for a
+			// forward MatchingResourcesForSubject query, with an ellipsis subject.
+			name:  "MatchingResourcesForSubject - valid, ellipsis subject",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+						OptionalSubjectIds:  []string{"user1"},
+					},
+				},
+			},
+			expectError: false,
+		},
+		{
+			// subject_relation is possibly-specified (🅿️) for this shape, so a
+			// non-ellipsis subject relation must also be accepted.
+			name:  "MatchingResourcesForSubject - valid, non-ellipsis subject relation",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "group",
+						OptionalSubjectIds:  []string{"admins"},
+						RelationFilter:      datastore.SubjectRelationFilter{}.WithNonEllipsisRelation("member"),
+					},
+				},
+			},
+			expectError: false,
+		},
+		{
+			name:  "MatchingResourcesForSubject - missing resource type",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+						OptionalSubjectIds:  []string{"user1"},
+					},
+				},
+			},
+			expectError: true,
+			errorMsg:    "resource type required",
+		},
+		{
+			name:  "MatchingResourcesForSubject - has resource ids",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceIds:      []string{"doc1"},
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+						OptionalSubjectIds:  []string{"user1"},
+					},
+				},
+			},
+			expectError: true,
+			errorMsg:    "no optional resource ids allowed",
+		},
+		{
+			name:  "MatchingResourcesForSubject - missing subject ids",
+			shape: queryshape.MatchingResourcesForSubject,
+			filter: datastore.RelationshipsFilter{
+				OptionalResourceType:     "document",
+				OptionalResourceRelation: "viewer",
+				OptionalSubjectsSelectors: []datastore.SubjectsSelector{
+					{
+						OptionalSubjectType: "user",
+					},
+				},
+			},
+			expectError: true,
+			errorMsg:    "subject ids required",
+		},
 		{
 			name:        "Unknown shape - error",
 			shape:       "unknown-shape",
```

**File**: `pkg/query/reader.go` (modified, +5/-0)
```diff
@@ -268,6 +268,11 @@ func (r *datalayerQueryDatastoreReader) SubjectExistsAsRelationship(
 	relIter, err := r.inner.QueryRelationships(ctx, filter,
 		options.WithLimit(&limitOne),
 		options.WithSkipExpiration(true),
+		// The filter pins the subject but leaves the resource columns open, which
+		// gaps the PK and makes CockroachDB reject a forced index hint. Varying lets
+		// the datastore pick an index from the actual filter columns (the subject
+		// index). This mirrors the reasoning in QuerySubjects above.
+		options.WithQueryShape(queryshape.Varying),
 	)
 	if err != nil {
 		return false, err
```

**File**: `pkg/query/reader_test.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package query
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/internal/datastore/dsfortesting"
+	"github.com/authzed/spicedb/internal/datastore/memdb"
+	"github.com/authzed/spicedb/internal/testfixtures"
+	"github.com/authzed/spicedb/pkg/datalayer"
+	"github.com/authzed/spicedb/pkg/tuple"
+)
+
+// recursiveUsersetSchema is the canonical "directly cyclic" userset relation.
+// The self-edge probe (SubjectExistsAsRelationship) only fires for schemas of
+// this shape, which is why the missing query shape went unnoticed.
+const recursiveUsersetSchema = `
+definition user {}
+definition group {
+	relation member: user | group#member
+}
+`
+
+// TestSubjectExistsAsRelationship_QueryShape verifies that the existence probe
+// specifies a query shape. Without it, the probe panics with "query shape is
+// unspecified" under the validating datastore that all testfixtures helpers wrap.
+func TestSubjectExistsAsRelationship_QueryShape(t *testing.T) {
+	require := require.New(t)
+
+	rawDS, err := dsfortesting.NewMemDBDatastoreForTesting(t, 0, 0, memdb.DisableGC)
+	require.NoError(err)
+
+	ds, revision := testfixtures.DatastoreFromSchemaAndTestRelationships(
+		t, rawDS, recursiveUsersetSchema,
+		[]tuple.Relationship{
+			tuple.MustParse("group:a#member@user:tom"),
+			tuple.MustParse("group:b#member@group:a#member"),
+		},
+	)
+
+	reader := NewQueryDatastoreReader(
+		datalayer.NewDataLayer(ds).SnapshotReader(revision, datalayer.NoSchemaHashForTesting),
+	)
+
+	// group:a appears as a subject of group:b#member, so the probe must find it.
+	exists, err := reader.SubjectExistsAsRelationship(t.Context(), NewObject("group", "a"), "member")
+	require.NoError(err)
+	require.True(exists)
+
+	// group:c never appears as a subject, so the probe must not find it.
+	exists, err = reader.SubjectExistsAsRelationship(t.Context(), NewObject("group", "c"), "member")
+	require.NoError(err)
+	require.False(exists)
+}
```

---

### Incident Patch 4: `58eda58f` (2026-09-16)
**Commit Message**: fix: skip the transaction-overlap touch during bulk delete

Every CockroachDB write transaction touches one transactions-table row
per overlap key so that otherwise non-overlapping transactions receive
causally-ordered commit timestamps -- the new-enemy protection. Under
the default static strategy that is the single shared row every write
in the cluster touches, so each bulk delete batch contended with all
concurrent production writes and, having spent seconds in the KV layer
before the touch, risked a failed refresh and a full-batch retry.

Nothing reads the transactions table; the touch exists only to force
ordering for writes with causal dependents. A pure-delete batch has
none: its outcome is observable only after the command completes, far
outside the clock-uncertainty window in which commit timestamps could
invert. The command now defaults its datastore to the insecure overlap
strategy, alongside the other serving-path overrides in
prepareBulkDeleteConfig; passing --datastore-tx-overlap-strategy
explicitly restores any other behavior. The datastore layer is
unchanged, so a future v1 API adoption of cursored deletes keeps full
overlap semantics.

**File**: `docs/spicedb.md` (modified, +5/-0)
```diff
@@ -84,6 +84,11 @@ Unlike the serving path, batches wait indefinitely for a CockroachDB write
 connection rather than failing fast after the 30ms admission-control default;
 pass --write-conn-acquisition-timeout explicitly to bound the wait.
 
+Batches also skip the CockroachDB transaction-overlap touch that orders the
+commit timestamps of causally-dependent writes: a pure-delete batch has no
+causal dependents, and the touch would contend with every concurrent write to
+the cluster. Pass --datastore-tx-overlap-strategy explicitly to restore it.
+
 Example:
 
   spicedb datastore delete-relationships \
```

**File**: `pkg/cmd/deleterelationships.go` (modified, +21/-4)
```diff
@@ -211,6 +211,11 @@ Unlike the serving path, batches wait indefinitely for a CockroachDB write
 connection rather than failing fast after the 30ms admission-control default;
 pass --write-conn-acquisition-timeout explicitly to bound the wait.
 
+Batches also skip the CockroachDB transaction-overlap touch that orders the
+commit timestamps of causally-dependent writes: a pure-delete batch has no
+causal dependents, and the touch would contend with every concurrent write to
+the cluster. Pass --datastore-tx-overlap-strategy explicitly to restore it.
+
 Example:
 
   ` + programName + ` datastore delete-relationships \
@@ -264,18 +269,30 @@ func RegisterDeleteRelationshipsFlags(cmd *cobra.Command, flags *deleteRelations
 // connection on CockroachDB before failing with ResourceExhausted.
 const writeAcquisitionTimeoutFlag = "write-conn-acquisition-timeout"
 
+// overlapStrategyFlag selects how CockroachDB writes force transaction
+// overlap for commit-timestamp ordering (the new-enemy protection).
+const overlapStrategyFlag = "datastore-tx-overlap-strategy"
+
 // prepareBulkDeleteConfig adjusts datastore defaults that are tuned for the
-// serving path but wrong for a one-shot bulk deletion: background GC has no
-// server to run under, and the write-connection acquisition timeout is a
+// serving path but wrong for a one-shot bulk deletion. Background GC has no
+// server to run under. The write-connection acquisition timeout is a
 // fail-fast admission control (30ms by default) that a cold pool cannot even
-// dial a CockroachDB connection within. A bulk delete batch should wait for a
-// write connection indefinitely unless the operator explicitly bounded it.
+// dial a CockroachDB connection within; a batch should instead wait
+// indefinitely. And the static transaction-overlap strategy would have every
+// batch touch the shared transactions row that all cluster writes contend
+// on -- ordering protection for causal dependents that a pure-delete batch,
+// observable only after the command completes, does not have. Each override
+// yields to an explicitly passed flag.
 func prepareBulkDeleteConfig(fs *pflag.FlagSet, cfg *dscmd.Config) {
 	cfg.GCInterval = -1 * time.Hour
 
 	if !fs.Changed(writeAcquisitionTimeoutFlag) {
 		cfg.WriteAcquisitionTimeout = 0
 	}
+
+	if !fs.Changed(overlapStrategyFlag) {
+		cfg.OverlapStrategy = "insecure"
+	}
 }
 
 func parseResumeCursor(raw string) (options.Cursor, error) {
```

**File**: `pkg/cmd/deleterelationships_test.go` (modified, +20/-0)
```diff
@@ -294,6 +294,26 @@ func TestPrepareBulkDeleteConfigDisablesBackgroundGC(t *testing.T) {
 	require.Negative(t, cfg.GCInterval)
 }
 
+func TestPrepareBulkDeleteConfigSkipsTransactionOverlap(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg)
+
+	// The serving-path default forces every CockroachDB write to touch a
+	// shared transactions row for commit-timestamp ordering; a bulk delete
+	// batch has no causal dependents and must not contend on that row.
+	require.Equal(t, "static", cfg.OverlapStrategy)
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Equal(t, "insecure", cfg.OverlapStrategy)
+}
+
+func TestPrepareBulkDeleteConfigRespectsExplicitOverlapStrategy(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg, "--datastore-tx-overlap-strategy=prefix")
+
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Equal(t, "prefix", cfg.OverlapStrategy)
+}
+
 func TestConfirmationRequiredWithoutTTY(t *testing.T) {
 	// Without a terminal and without --yes, the command must error rather than
 	// block on a prompt nobody can answer.
```

---

### Incident Patch 5: `b527e077` (2026-09-16)
**Commit Message**: fix: wait indefinitely for write connections during bulk delete

The write-connection acquisition timeout defaults to 30ms, a fail-fast
admission control sized for the serving path, where shedding a write
beats queueing under pressure. The delete-relationships command opens a
cold pool, and dialing a CockroachDB connection does not reliably finish
inside 30ms, so the first batch -- and any batch after idle connections
are reaped mid-run -- fails with ResourceExhausted ("failed to acquire
in time") before a single row is deleted.

A bulk deletion is the only workload on its pool and has nothing to
shed, so the command now waits indefinitely for a write connection
unless --write-conn-acquisition-timeout is passed explicitly. The
existing background-GC override moves into the same helper so every
serving-default adjustment for this command lives in one tested place.

**File**: `docs/spicedb.md` (modified, +4/-0)
```diff
@@ -80,6 +80,10 @@ a complete deletion.
 Each batch logs its cursor, so an interrupted run can be resumed with
 --resume-cursor taken straight from the log.
 
+Unlike the serving path, batches wait indefinitely for a CockroachDB write
+connection rather than failing fast after the 30ms admission-control default;
+pass --write-conn-acquisition-timeout explicitly to bound the wait.
+
 Example:
 
   spicedb datastore delete-relationships \
```

**File**: `pkg/cmd/deleterelationships.go` (modified, +24/-2)
```diff
@@ -12,6 +12,7 @@ import (
 	"time"
 
 	"github.com/spf13/cobra"
+	"github.com/spf13/pflag"
 	"golang.org/x/term"
 
 	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
@@ -206,6 +207,10 @@ a complete deletion.
 Each batch logs its cursor, so an interrupted run can be resumed with
 --resume-cursor taken straight from the log.
 
+Unlike the serving path, batches wait indefinitely for a CockroachDB write
+connection rather than failing fast after the 30ms admission-control default;
+pass --write-conn-acquisition-timeout explicitly to bound the wait.
+
 Example:
 
   ` + programName + ` datastore delete-relationships \
@@ -255,6 +260,24 @@ func RegisterDeleteRelationshipsFlags(cmd *cobra.Command, flags *deleteRelations
 	return nil
 }
 
+// writeAcquisitionTimeoutFlag bounds how long a write waits for a pool
+// connection on CockroachDB before failing with ResourceExhausted.
+const writeAcquisitionTimeoutFlag = "write-conn-acquisition-timeout"
+
+// prepareBulkDeleteConfig adjusts datastore defaults that are tuned for the
+// serving path but wrong for a one-shot bulk deletion: background GC has no
+// server to run under, and the write-connection acquisition timeout is a
+// fail-fast admission control (30ms by default) that a cold pool cannot even
+// dial a CockroachDB connection within. A bulk delete batch should wait for a
+// write connection indefinitely unless the operator explicitly bounded it.
+func prepareBulkDeleteConfig(fs *pflag.FlagSet, cfg *dscmd.Config) {
+	cfg.GCInterval = -1 * time.Hour
+
+	if !fs.Changed(writeAcquisitionTimeoutFlag) {
+		cfg.WriteAcquisitionTimeout = 0
+	}
+}
+
 func parseResumeCursor(raw string) (options.Cursor, error) {
 	if raw == "" {
 		return nil, nil
@@ -349,8 +372,7 @@ func executeDeleteRelationships(cmd *cobra.Command, cfg *dscmd.Config, flags *de
 		return err
 	}
 
-	// Disable background GC; this is a one-shot operation.
-	cfg.GCInterval = -1 * time.Hour
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
 
 	ds, err := dscmd.NewDatastore(ctx, cfg.ToOption())
 	if err != nil {
```

**File**: `pkg/cmd/deleterelationships_test.go` (modified, +40/-0)
```diff
@@ -6,14 +6,17 @@ import (
 	"io"
 	"strings"
 	"testing"
+	"time"
 
 	"github.com/google/go-cmp/cmp"
 	"github.com/rs/zerolog"
+	"github.com/spf13/cobra"
 	"github.com/stretchr/testify/require"
 	"google.golang.org/protobuf/testing/protocmp"
 
 	v1 "github.com/authzed/authzed-go/proto/authzed/api/v1"
 
+	dscmd "github.com/authzed/spicedb/pkg/cmd/datastore"
 	"github.com/authzed/spicedb/pkg/datastore"
 	"github.com/authzed/spicedb/pkg/datastore/options"
 	"github.com/authzed/spicedb/pkg/tuple"
@@ -254,6 +257,43 @@ func TestParseResumeCursor(t *testing.T) {
 	require.ErrorContains(t, err, "--resume-cursor")
 }
 
+// newBulkDeleteFlagSet builds a flag set carrying the datastore flags exactly
+// as the delete-relationships command registers them, parsed with args.
+func newBulkDeleteFlagSet(t *testing.T, cfg *dscmd.Config, args ...string) *cobra.Command {
+	t.Helper()
+	cmd := &cobra.Command{}
+	require.NoError(t, dscmd.RegisterDatastoreFlagsWithPrefix(cmd.Flags(), "", cfg))
+	require.NoError(t, cmd.Flags().Parse(args))
+	return cmd
+}
+
+func TestPrepareBulkDeleteConfigWaitsIndefinitelyForWriteConns(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg)
+
+	// The serving-path default is a 30ms fail-fast admission timeout; a batch
+	// of a bulk delete must instead wait for a write connection (0 = forever).
+	require.Equal(t, 30*time.Millisecond, cfg.WriteAcquisitionTimeout)
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Zero(t, cfg.WriteAcquisitionTimeout)
+}
+
+func TestPrepareBulkDeleteConfigRespectsExplicitAcquisitionTimeout(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg, "--write-conn-acquisition-timeout=45ms")
+
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Equal(t, 45*time.Millisecond, cfg.WriteAcquisitionTimeout)
+}
+
+func TestPrepareBulkDeleteConfigDisablesBackgroundGC(t *testing.T) {
+	cfg := &dscmd.Config{}
+	cmd := newBulkDeleteFlagSet(t, cfg)
+
+	prepareBulkDeleteConfig(cmd.Flags(), cfg)
+	require.Negative(t, cfg.GCInterval)
+}
+
 func TestConfirmationRequiredWithoutTTY(t *testing.T) {
 	// Without a terminal and without --yes, the command must error rather than
 	// block on a prompt nobody can answer.
```

---

### Incident Patch 6: `81fbf153` (2026-09-23)
**Commit Message**: test(consistency): let callers run the fixtures serially (#3375)

The consistency suite runs each validation file in parallel, which suits a
datastore that is cheap to stand up but is not the only reasonable choice. A
caller that would rather keep one fixture's resources live at a time can now
pass RunFixturesSerially.

The default is unchanged, and the chunk-size and dispatcher subtests within a
fixture stay parallel either way.

**File**: `pkg/consistency/test/consistency.go` (modified, +35/-5)
```diff
@@ -37,11 +37,34 @@ import (
 	"github.com/authzed/spicedb/pkg/validationfile"
 )
 
+type suiteOptions struct {
+	serialFixtures bool
+}
+
+// SuiteOption configures how a caller runs the consistency suite.
+type SuiteOption func(*suiteOptions)
+
+// RunFixturesSerially makes the suite run one validation file at a time.
+// It is for a caller whose datastore is expensive to stand up and who would
+// rather keep only one fixture's resources live at a time; the subtests within
+// a fixture still run concurrently either way.
+func RunFixturesSerially() SuiteOption {
+	return func(o *suiteOptions) { o.serialFixtures = true }
+}
+
+func newSuiteOptions(opts []SuiteOption) suiteOptions {
+	var o suiteOptions
+	for _, opt := range opts {
+		opt(&o)
+	}
+	return o
+}
+
 // AllConsistency runs the full system-wide consistency suite against the datastore
 // produced by the given tester. It is the consistency analog of test.All and lets any
 // DatastoreTester be exercised by the consistency suite.
-func AllConsistency(t *testing.T, tester dstest.DatastoreTester) {
-	ConsistencyForEngine(t, "", tester)
+func AllConsistency(t *testing.T, tester dstest.DatastoreTester, opts ...SuiteOption) {
+	ConsistencyForEngine(t, "", tester, opts...)
 }
 
 // ConsistencyForEngine runs the system-wide consistency suite, reading in the various
@@ -58,7 +81,11 @@ func AllConsistency(t *testing.T, tester dstest.DatastoreTester) {
 //
 // This acts as essentially a full integration test for the API, dispatching, caching,
 // computation and datastore layers.
-func ConsistencyForEngine(t *testing.T, engineID string, tester dstest.DatastoreTester) {
+//
+// Fixtures run in parallel unless the caller passes RunFixturesSerially.
+func ConsistencyForEngine(t *testing.T, engineID string, tester dstest.DatastoreTester, opts ...SuiteOption) {
+	suiteOpts := newSuiteOptions(opts)
+
 	consistencyTestFiles, err := testconfigs.List()
 	require.NoError(t, err)
 
@@ -90,8 +117,11 @@ func ConsistencyForEngine(t *testing.T, engineID string, tester dstest.Datastore
 			// the only concurrency was among the chunk-size and dispatcher subtests
 			// below, while the per-fixture prologue - which creates a database,
 			// migrates it and then walks the whole accessibility set - ran with
-			// everything else idle.
-			t.Parallel()
+			// everything else idle. A caller for whom a datastore is expensive
+			// enough that it wants one fixture live at a time opts out.
+			if !suiteOpts.serialFixtures {
+				t.Parallel()
+			}
 
 			baseds := newDatastore(t)
 			ds := indexcheck.WrapWithIndexCheckingDatastoreProxyIfApplicable(baseds)
```

---

### Incident Patch 7: `8d44af92` (2026-09-22)
**Commit Message**: fix: stop serving a revision that has no validity (#3374)

* fix(memdb): report no validity when head replaces the quantized revision

OptimizedRevision rounds the current time down to a quantization boundary, and
falls back to head when rounding would land before the first write — otherwise
reads are served from the empty snapshot taken when the datastore was created.

The validity returned alongside it still described the quantized revision that
was just discarded. Optimized revisions are cached for as long as they are
valid, so a caller could hold head for the remainder of the interval and miss
every write made during it. That is the same staleness the fallback exists to
prevent, reintroduced one layer up.

Head is only accurate at the moment it is read, so report no validity in that
case and let each request derive it afresh. The quantized path is unchanged and
still carries its own validity.

* fix(datastore): do not cache a revision that has no validity

The optimized revision cache subtracts a random slice of the configured maximum
staleness from "now" before testing its entries, so that requests do not all
miss at the same quantization boundary. That check does not distingu

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Datastore: `datastore.SortKeyRevision`, an optional extension to `datastore.Revision` for revision types that are totally ordered. Its `AppendSortKey` returns an order-preserving, prefix-free byte encoding of the revision, suitable as a key — or as one field of a composite key — in an ordered key/value store; `String()` offers neither property, being a variable-width decimal. Implemented for the hybrid logical clock, timestamp and transaction ID revision types. Postgres revisions are backed by transaction snapshots and are only partially ordered, so they deliberately do not implement it, and a type assertion is how a consumer discovers that. Supersedes `ByteSortable()`, which reports the same capability but cannot supply the encoding that satisfies it. (https://github.com/authzed/spicedb/pull/3319)
 
 ### Fixed
+- MemDB/Datastore: a revision reported with no validity is no longer kept by the optimized revision cache, and we fixed an issue where MemDB's reported validity caused a stale value to be cached. (https://github.com/authzed/spicedb/pull/3374)
 - MemDB: requests made shortly after startup could fail with `object definition not found`, or return no results, even though the schema and relationships had already been written. MemDB now advertises its head revision in that case, so committed data is never hidden behind the datastore's own creation. (https://github.com/authzed/spicedb/pull/3366)
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
 - Postgres: fixed connections being handed to queries already broken, which surfaced as `timeout: read tcp ...: i/o timeout` against a perfectly healthy database, most often under load and shortly after startup. Creating a datastore gave the connection pool the same context it used to bound its own startup checks, and then cancelled it on return - but filling the pool happens on a background goroutine that keeps using that context, so the cancellation landed part-way through opening connections. pgx responds to a cancelled context by setting an immediate deadline on the connection it is working on, and those connections still entered the pool. Pool warm-up now runs on a context of its own, so finishing startup no longer cancels it. The startup checks keep their own 30-second bound. (https://github.com/authzed/spicedb/pull/3333)
```

**File**: `internal/datastore/memdb/revisions.go` (modified, +7/-0)
```diff
@@ -88,6 +88,13 @@ func (mdb *memdbDatastore) OptimizedRevision(_ context.Context) (datastore.Revis
 	}
 	if optimized.LessThan(firstServable) {
 		optimized = mdb.headRevisionNoLock()
+
+		// validFor describes the quantized revision that was just discarded, not head.
+		// Reusing it would let a caller hold head for the rest of the quantization
+		// interval, hiding every write made during it — the same staleness this
+		// fallback exists to prevent. Head is only accurate at the moment it is read,
+		// so report no validity and let each call derive it afresh.
+		validFor = 0
 	}
 
 	// Find the schema hash visible at the optimized revision: walk the
```

**File**: `internal/datastore/memdb/revisions_test.go` (modified, +45/-0)
```diff
@@ -73,6 +73,51 @@ func TestOptimizedRevisionSeesFirstWrite(t *testing.T) {
 	})
 }
 
+// TestOptimizedRevisionFallbackReportsNoValidity covers the validity reported
+// alongside the fallback above. When rounding down would hide the first write,
+// OptimizedRevision answers with head instead — but the validity it computed
+// belongs to the quantized revision it discarded. Handing that validity out
+// lets a caller cache head for the rest of the interval and miss every write
+// made during it, which is the staleness the fallback exists to avoid.
+func TestOptimizedRevisionFallbackReportsNoValidity(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		const quantization = 50 * time.Millisecond
+
+		boundary := nextQuantizationBoundary(quantization)
+		time.Sleep(time.Until(boundary.Add(-5 * time.Millisecond)))
+
+		ds, err := NewMemdbDatastore(0, quantization, time.Hour)
+		require.NoError(t, err)
+		t.Cleanup(func() {
+			_ = ds.Close()
+		})
+
+		time.Sleep(time.Until(boundary.Add(time.Millisecond)))
+
+		_, err = ds.ReadWriteTx(t.Context(), func(ctx context.Context, rwt datastore.ReadWriteTransaction) error {
+			return rwt.WriteRelationships(ctx, []tuple.RelationshipUpdate{
+				tuple.Touch(tuple.MustParse("document:doc#viewer@user:tom")),
+			})
+		})
+		require.NoError(t, err)
+
+		// The fallback is active: rounding down lands before the write.
+		fallback, err := ds.OptimizedRevision(t.Context())
+		require.NoError(t, err)
+		require.Zero(t, fallback.ValidFor,
+			"head was substituted for the quantized revision, so the quantized revision's validity must not be reported")
+
+		// Past the next boundary the quantized revision is itself servable, the
+		// fallback no longer applies, and a real validity is expected again.
+		time.Sleep(time.Until(nextQuantizationBoundary(quantization).Add(time.Millisecond)))
+
+		quantized, err := ds.OptimizedRevision(t.Context())
+		require.NoError(t, err)
+		require.Positive(t, quantized.ValidFor,
+			"the quantized revision is servable here, so it should carry its own validity")
+	})
+}
+
 // nextQuantizationBoundary returns the next instant that OptimizedRevision
 // would round down to for the given quantization period.
 func nextQuantizationBoundary(quantization time.Duration) time.Time {
```

**File**: `internal/datastore/proxy/optimized_revision.go` (modified, +9/-1)
```diff
@@ -167,7 +167,15 @@ func (p *optimizedRevisionProxy) compute(ctx context.Context, localNow time.Time
 
 	p.candidates = p.candidates[numToDrop:]
 	computed := validRevision{revision: fresh.Revision, validThrough: rvt, schemaHash: fresh.SchemaHash}
-	p.candidates = append(p.candidates, computed)
+
+	// A revision that reports no validity is only accurate at the instant it was read,
+	// so it must not become a cache candidate: the staleness jitter subtracts up to
+	// maxStaleness from "now" when testing candidates, which would keep serving this
+	// already-expired entry for that long and hide every write made in the meantime.
+	// Returning it to this caller is fine; remembering it is not.
+	if fresh.ValidFor > 0 {
+		p.candidates = append(p.candidates, computed)
+	}
 	p.mu.Unlock()
 
 	span.AddEvent(otelconv.EventDatastoreRevisionsComputed)
```

**File**: `internal/datastore/proxy/optimized_revision_test.go` (modified, +14/-1)
```diff
@@ -86,14 +86,27 @@ func TestOptimizedRevisionCache(t *testing.T) {
 			[][]datastore.Revision{cand(one), cand(one), cand(two)},
 		},
 		{
+			// staleness lets a barely-expired candidate keep being served for a while
 			"cached by staleness",
 			7 * time.Millisecond,
 			[]revisionResponse{
-				{one, 0},
+				{one, 1 * time.Millisecond},
 				{two, 100 * time.Millisecond},
 			},
 			[][]datastore.Revision{cand(one), cand(one, two), cand(two), cand(two)},
 		},
+		{
+			// a revision with no validity is accurate only when it is read, so staleness
+			// must not keep it around: every call has to go back to the datastore
+			"no validity is never cached, even with staleness",
+			7 * time.Millisecond,
+			[]revisionResponse{
+				{one, 0},
+				{two, 0},
+				{three, 0},
+			},
+			[][]datastore.Revision{cand(one), cand(two), cand(three)},
+		},
 		{
 			"cached by staleness and validity",
 			2 * time.Millisecond,
```

---

### Incident Patch 8: `5ef6918e` (2026-09-22)
**Commit Message**: fix(memdb): never hide the first write behind the creation snapshot (#3366)

* fix(memdb): never hide the first write behind the creation snapshot

OptimizedRevision rounds the current time down to the nearest quantization
boundary. MemDB keeps a snapshot of the still-empty database taken when the
datastore was created, and a read at a revision between that creation snapshot
and the first write is served from it, so already-committed data appears
missing.

An existing guard only caught boundaries that landed before the creation
snapshot, which is the common case and why this almost always worked. When the
boundary instead landed between creation and the first write, the empty
snapshot was advertised: with --datastore-engine=memory and
--datastore-bootstrap-files this surfaced as "object definition not found" for
up to one quantization interval (5 seconds by default) after startup, and as
the TestMiddlewareOrdering flake in CI.

MemDB now advertises its head revision whenever the quantized revision falls
before the first write. The new test forces the boundary into that window and
fails deterministically without the fix.

TestMiddlewareOrdering also now reads its bootstrapped setup 

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Datastore: `datastore.SortKeyRevision`, an optional extension to `datastore.Revision` for revision types that are totally ordered. Its `AppendSortKey` returns an order-preserving, prefix-free byte encoding of the revision, suitable as a key — or as one field of a composite key — in an ordered key/value store; `String()` offers neither property, being a variable-width decimal. Implemented for the hybrid logical clock, timestamp and transaction ID revision types. Postgres revisions are backed by transaction snapshots and are only partially ordered, so they deliberately do not implement it, and a type assertion is how a consumer discovers that. Supersedes `ByteSortable()`, which reports the same capability but cannot supply the encoding that satisfies it. (https://github.com/authzed/spicedb/pull/3319)
 
 ### Fixed
+- MemDB: requests made shortly after startup could fail with `object definition not found`, or return no results, even though the schema and relationships had already been written. MemDB now advertises its head revision in that case, so committed data is never hidden behind the datastore's own creation. (https://github.com/authzed/spicedb/pull/3366)
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
 - Postgres: fixed connections being handed to queries already broken, which surfaced as `timeout: read tcp ...: i/o timeout` against a perfectly healthy database, most often under load and shortly after startup. Creating a datastore gave the connection pool the same context it used to bound its own startup checks, and then cancelled it on return - but filling the pool happens on a background goroutine that keeps using that context, so the cancellation landed part-way through opening connections. pgx responds to a cancelled context by setting an immediate deadline on the connection it is working on, and those connections still entered the pool. Pool warm-up now runs on a context of its own, so finishing startup no longer cancels it. The startup checks keep their own 30-second bound. (https://github.com/authzed/spicedb/pull/3333)
 - Datastore: the wait between transaction retries is now capped at 10 seconds. It previously doubled without limit (25ms, 50ms, 100ms, …), which made `--datastore-max-tx-retries` an exponential wall-clock budget rather than a count of attempts: at the default of 10 the waits total about 25 seconds, but at 15 they total 14 minutes and at 20 over seven hours. (https://github.com/authzed/spicedb/pull/3353)
```

**File**: `internal/datastore/memdb/revisions.go` (modified, +10/-3)
```diff
@@ -77,9 +77,16 @@ func (mdb *memdbDatastore) OptimizedRevision(_ context.Context) (datastore.Revis
 	quantized, validFor := revisions.Quantize(nowRevision(), 0, mdb.quantizationPeriod)
 	optimized := quantized.(revisions.TimestampRevision)
 
-	// Rounding down can land before the oldest snapshot, which no read can be
-	// served at. Advertise head instead, as Postgres does for an empty bucket.
-	if optimized.LessThan(mdb.revisions[0].revision) {
+	// Entry 0 is the snapshot taken when the datastore was created: the database
+	// as it was before anything was written to it. Rounding down to any point
+	// before the first write therefore serves an empty datastore, hiding data
+	// that was already committed when the revision was requested. Advertise head
+	// instead, as Postgres does for an empty bucket.
+	firstServable := mdb.revisions[0].revision
+	if len(mdb.revisions) > 1 {
+		firstServable = mdb.revisions[1].revision
+	}
+	if optimized.LessThan(firstServable) {
 		optimized = mdb.headRevisionNoLock()
 	}
 
```

**File**: `internal/datastore/memdb/revisions_test.go` (modified, +55/-0)
```diff
@@ -1,10 +1,15 @@
 package memdb
 
 import (
+	"context"
 	"testing"
+	"testing/synctest"
 	"time"
 
 	"github.com/stretchr/testify/require"
+
+	"github.com/authzed/spicedb/pkg/datastore"
+	"github.com/authzed/spicedb/pkg/tuple"
 )
 
 func TestHeadRevision(t *testing.T) {
@@ -24,3 +29,53 @@ func TestHeadRevision(t *testing.T) {
 	err = ds.CheckRevision(t.Context(), newerResult.Revision)
 	require.NoError(t, err)
 }
+
+// TestOptimizedRevisionSeesFirstWrite asserts that the first write to a freshly
+// created datastore is visible at the optimized revision, even when a
+// quantization boundary happens to fall between the datastore's creation and
+// that write. Rounding down to such a boundary would otherwise serve the
+// still-empty snapshot taken at creation. The synctest bubble's clock is fake,
+// so the boundary lands between the two exactly rather than by timing luck.
+func TestOptimizedRevisionSeesFirstWrite(t *testing.T) {
+	synctest.Test(t, func(t *testing.T) {
+		const quantization = 50 * time.Millisecond
+
+		boundary := nextQuantizationBoundary(quantization)
+		time.Sleep(time.Until(boundary.Add(-5 * time.Millisecond)))
+
+		ds, err := NewMemdbDatastore(0, quantization, time.Hour)
+		require.NoError(t, err)
+		t.Cleanup(func() {
+			_ = ds.Close()
+		})
+		require.True(t, time.Now().Before(boundary))
+
+		time.Sleep(time.Until(boundary.Add(time.Millisecond)))
+
+		_, err = ds.ReadWriteTx(t.Context(), func(ctx context.Context, rwt datastore.ReadWriteTransaction) error {
+			return rwt.WriteRelationships(ctx, []tuple.RelationshipUpdate{
+				tuple.Touch(tuple.MustParse("document:doc#viewer@user:tom")),
+			})
+		})
+		require.NoError(t, err)
+
+		optimized, err := ds.OptimizedRevision(t.Context())
+		require.NoError(t, err)
+
+		iter, err := ds.SnapshotReader(optimized.Revision).QueryRelationships(t.Context(), datastore.RelationshipsFilter{
+			OptionalResourceType: "document",
+		})
+		require.NoError(t, err)
+
+		rels, err := datastore.IteratorToSlice(iter)
+		require.NoError(t, err)
+		require.Len(t, rels, 1, "the optimized revision did not see the first write")
+	})
+}
+
+// nextQuantizationBoundary returns the next instant that OptimizedRevision
+// would round down to for the given quantization period.
+func nextQuantizationBoundary(quantization time.Duration) time.Time {
+	q := quantization.Nanoseconds()
+	return time.Unix(0, (time.Now().UTC().UnixNano()/q+1)*q)
+}
```

**File**: `pkg/cmd/server/middleware_test.go` (modified, +8/-0)
```diff
@@ -393,7 +393,14 @@ func TestMiddlewareOrdering(t *testing.T) {
 		errChan <- rs.Run(ctx)
 	}()
 
+	// The bootstrapped schema and relationships are setup, not the subject of this
+	// test, so read them at full consistency rather than at a quantized revision.
+	fullyConsistent := &v1.Consistency{
+		Requirement: &v1.Consistency_FullyConsistent{FullyConsistent: true},
+	}
+
 	req := &v1.CheckPermissionRequest{
+		Consistency: fullyConsistent,
 		Resource: &v1.ObjectReference{
 			ObjectType: "resource",
 			ObjectId:   "resource1",
@@ -413,6 +420,7 @@ func TestMiddlewareOrdering(t *testing.T) {
 	require.NoError(t, err)
 
 	lrreq := &v1.LookupResourcesRequest{
+		Consistency:        fullyConsistent,
 		ResourceObjectType: "resource",
 		Subject: &v1.SubjectReference{
 			Object: &v1.ObjectReference{
```

---

### Incident Patch 9: `44706fed` (2026-09-22)
**Commit Message**: fix(runtime): correct the memory fallback from 256KiB to 256MiB (#3329)

* fix(runtime): make the memory fallback 256MiB, as its comment always said

fallbackMemoryLimit was 256 * 1024 - 256 KiB - while the comment above it read
"256mb is tiny, but it should comfortably fit in most runtimes". It has been that
way since it was introduced in #3201; the intent in the comment is unambiguous and
the value is short by a factor of 1024.

This is the figure used when available memory cannot be determined at all, which
the surrounding code calls out as a real scenario: an AWS ECS task whose container
memory limit is never written to the cgroup. Percent-based budgets are then taken
against it, so a cache configured for 70% of available memory got roughly 183KiB
instead of roughly 180MiB.

Nothing downstream would report this. There is no error path - the budget is simply
small and the process runs on with almost no cache, which looks like a performance
problem rather than a misconfiguration.

The existing tests did not catch it because all five only assert the fallback is
greater than zero, which 256 KiB satisfies. The new test pins the value, and adds a
unit-independent guard that 1% of the

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - MySQL: fixed a crash in the watch API. When reading transaction metadata hit an error part-way through iterating the result rows, that error was dropped and the watch was handed an empty result with no error, which then dereferenced a nil value and took the whole process down with it. The error is now returned to the caller. (https://github.com/authzed/spicedb/pull/3358)
 - Postgres: fixed connections being handed to queries already broken, which surfaced as `timeout: read tcp ...: i/o timeout` against a perfectly healthy database, most often under load and shortly after startup. Creating a datastore gave the connection pool the same context it used to bound its own startup checks, and then cancelled it on return - but filling the pool happens on a background goroutine that keeps using that context, so the cancellation landed part-way through opening connections. pgx responds to a cancelled context by setting an immediate deadline on the connection it is working on, and those connections still entered the pool. Pool warm-up now runs on a context of its own, so finishing startup no longer cancels it. The startup checks keep their own 30-second bound. (https://github.com/authzed/spicedb/pull/3333)
 - Datastore: the wait between transaction retries is now capped at 10 seconds. It previously doubled without limit (25ms, 50ms, 100ms, …), which made `--datastore-max-tx-retries` an exponential wall-clock budget rather than a count of attempts: at the default of 10 the waits total about 25 seconds, but at 15 they total 14 minutes and at 20 over seven hours. (https://github.com/authzed/spicedb/pull/3353)
+- Caches: when the amount of available memory could not be determined - for example an AWS ECS task whose memory limit never reaches the cgroup - the fallback used for percent-based budgets was 256KiB rather than the intended 256MiB. A cache configured for 70% of available memory was sized at roughly 183KiB instead of roughly 180MiB. (https://github.com/authzed/spicedb/pull/3329)
 - Shutdown: on SIGINT or SIGTERM, SpiceDB now reports `NOT_SERVING` on its gRPC health service and keeps its listeners open for `--grpc-shutdown-drain-delay` before draining. This gives load balancers and Kubernetes readiness probes time to stop routing to the instance, so new requests do not fail with `Unavailable` (connection refused) in the window between the signal and the endpoint update. (https://github.com/authzed/spicedb/pull/3295, https://github.com/authzed/spicedb/pull/3314)
 
 ## [1.56.2] - 2026-09-11
```

**File**: `pkg/runtime/memory.go` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@ const (
 
 // fallbackMemoryLimit is the amount of memory allocated for caches etc.
 // when the amount of available memory can't be determined through the usual methods.
-// 256mb is tiny, but it should comfortably fit in most runtimes.
-const fallbackMemoryLimit = 256 * 1024
+// 256MiB is tiny, but it should comfortably fit in most runtimes.
+const fallbackMemoryLimit = 256 * 1024 * 1024
 
 var logAvailableMemoryOnce sync.Once
 
```

**File**: `pkg/runtime/memory_test.go` (modified, +18/-0)
```diff
@@ -69,3 +69,21 @@ func TestAvailableMemory_Applies75PercentRatio(t *testing.T) {
 	expected := uint64(limit) * 75 / 100
 	require.Equal(t, expected, mem, "should apply 75%% ratio to available memory")
 }
+
+// TestFallbackMemoryLimitIsSaneMagnitude pins the fallback's value, not merely
+// that it is positive. The fallback is only reached when available memory cannot
+// be determined at all, so nothing downstream will flag a wrong figure - a
+// percent-based budget simply comes out small and the process runs on with
+// almost no cache. That is precisely how this constant sat at 256 * 1024 (256
+// KiB) while its comment said 256mb: a 1024x shortfall, invisible to every test
+// here because they all only assert the fallback is greater than zero.
+func TestFallbackMemoryLimitIsSaneMagnitude(t *testing.T) {
+	require.Equal(t, uint64(256*1024*1024), uint64(fallbackMemoryLimit),
+		"fallback should be 256 MiB, as its comment states")
+
+	// A second, unit-independent guard: whatever the figure is, it has to be big
+	// enough that a small percentage of it is still a usable cache budget. At 256
+	// KiB, a 1% budget is 2621 bytes.
+	require.Greater(t, uint64(fallbackMemoryLimit)/100, uint64(1024*1024),
+		"1%% of the fallback should still exceed a mebibyte, or percent-based budgets are meaningless")
+}
```

---

### Incident Patch 10: `d9be5237` (2026-09-22)
**Commit Message**: fix(testing): stop the FDW e2e test losing its port before it binds (#3338)

* fix(testing): stop the FDW e2e test losing its port before it binds

The FDW end-to-end test picked a port by opening a throwaway listener,
reading the port back and closing it again, then started the server on
that port from a goroutine. On a busy machine anything can take the port
in between - CI runs six integration packages and a docker daemon side by
side, and an ordinary outgoing connection is enough, because Linux will
hand a just-released ephemeral port to connect(). The server's bind then
fails, the error is discarded, and the test spends ten seconds dialling a
port nothing is listening on before reporting "connection refused".

Bind the socket in the test instead and hand the live listener to the
server, so the port is held from the moment it is chosen and is already
accepting connections when the helper returns. PgBackend gets a Serve
method for that; Run keeps its existing signature and now binds and calls
Serve. Both server goroutines also report what they returned rather than
dropping it, so a startup failure says what went wrong.

Claude-Session: https://claude.ai/code/session_017DF2mdm5e2

**File**: `internal/fdw/pgserver.go` (modified, +21/-1)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"net"
 	"sync"
 
 	wire "github.com/jeroenrinzema/psql-wire"
@@ -37,8 +38,26 @@ func NewPgBackend(client *authzed.Client, username, password string) *PgBackend
 // Run starts the Postgres wire protocol server on the specified endpoint.
 // It blocks until the context is cancelled, an error occurs, or Close is called.
 func (p *PgBackend) Run(ctx context.Context, endpoint string) error {
+	listener, err := net.Listen("tcp", endpoint)
+	if err != nil {
+		return err
+	}
+
+	return p.Serve(ctx, listener)
+}
+
+// Serve starts the Postgres wire protocol server on a listener that the caller
+// has already bound. It takes ownership of the listener and closes it before
+// returning.
+//
+// Binding separately from serving lets a caller hold the port from the moment
+// it picks it. Picking a free port, releasing it and binding it again later
+// leaves a window in which any other process on the machine can take the port,
+// and the bind then fails.
+func (p *PgBackend) Serve(ctx context.Context, listener net.Listener) error {
 	server, err := wire.NewServer(p.handler, wire.SessionMiddleware(sessionMiddleware))
 	if err != nil {
+		_ = listener.Close()
 		return err
 	}
 	server.Auth = wire.ClearTextPassword(p.validateAuth)
@@ -49,6 +68,7 @@ func (p *PgBackend) Run(ctx context.Context, endpoint string) error {
 	p.mu.Lock()
 	if p.closed {
 		p.mu.Unlock()
+		_ = listener.Close()
 		return errors.New("PgBackend already closed")
 	}
 	p.server = server
@@ -59,7 +79,7 @@ func (p *PgBackend) Run(ctx context.Context, endpoint string) error {
 		_ = p.Close()
 	}()
 
-	return server.ListenAndServe(endpoint)
+	return server.Serve(listener)
 }
 
 func (p *PgBackend) validateAuth(ctx context.Context, database, username, password string) (context.Context, bool, error) {
```

**File**: `internal/fdw/pgserver_e2e_test.go` (modified, +49/-17)
```diff
@@ -926,36 +926,58 @@ func runEndToEndTest(t *testing.T, tc e2eTestCase) {
 func runPGServer(t *testing.T, client *authzed.Client) int {
 	pgserver := fdw.NewPgBackend(client, postgresTestUser, fdwPassword)
 
-	port, err := GetFreePort()
+	// Bind the socket here rather than letting the server goroutine pick the
+	// port up later. GetFreePort's ask-the-kernel-then-close dance hands back a
+	// port that nothing is holding any more, and on a busy machine (CI runs six
+	// integration packages and a docker daemon in parallel) anything can take it
+	// in the meantime: a published container port, or simply an outgoing
+	// connection that the kernel gives that local port to. The server's bind
+	// then fails and nothing ever listens.
+	//
+	// Bind on all interfaces so the Postgres container can reach us via
+	// testcontainers' forwarded host (host.testcontainers.internal).
+	// "localhost" binds to 127.0.0.1 only, which the container cannot reach
+	// (its packets arrive from the docker bridge IP).
+	// nolint:gosec // G102: binding all interfaces is required here, see above.
+	listener, err := net.Listen("tcp", "0.0.0.0:0")
 	require.NoError(t, err)
+	port := listener.Addr().(*net.TCPAddr).Port
 
-	ctx := t.Context()
+	serveErr := make(chan error, 1)
+
+	// Registered first, so it runs last: by then Close below has stopped the
+	// server and Serve has returned. Report whatever it returned instead of
+	// letting a server failure surface as an unexplained connection error.
+	t.Cleanup(func() {
+		select {
+		case err := <-serveErr:
+			require.NoError(t, err, "PGServer stopped with an error")
+		case <-time.After(10 * time.Second):
+			require.Fail(t, "PGServer did not stop")
+		}
+	})
 	t.Cleanup(func() {
 		require.NoError(t, pgserver.Close())
 	})
 
+	ctx := t.Context()
 	go func() {
-		// Bind to all interfaces so the Postgres container can reach us via
-		// testcontainers' forwarded host (host.testcontainers.internal).
-		// "localhost" binds to 127.0.0.1 only, which the container cannot reach
-		// (its packets arrive from the docker bridge IP).
-		_ = pgserver.Run(ctx, fmt.Sprintf("0.0.0.0:%d", port))
+		serveErr <- pgserver.Serve(ctx, listener)
 	}()
 
-	// Wait until the server is actually accepting connections.
-	require.EventuallyWithT(t, func(collect *assert.CollectT) {
-		conn, err := net.DialTimeout("tcp", fmt.Sprintf("localhost:%d", port), 100*time.Millisecond)
-		if !assert.NoError(collect, err) {
-			return
-		}
-		_ = conn.Close()
-	}, 10*time.Second, 20*time.Millisecond, "PGServer did not start accepting connections")
-
+	// No readiness wait is needed: net.Listen above already put the socket into
+	// the listening state, so the port accepts connections from this point on,
+	// whenever the goroutine happens to be scheduled.
 	return port
 }
 
 // GetFreePort asks the kernel for a free open port that is ready to use.
 // From: https://gist.github.com/sevkin/96bdae9274465b2d09191384f86ef39d
+//
+// The port is released again before it is returned, so whoever binds it later
+// can lose it to another process. Only use this where the thing being started
+// takes an address rather than a listener; prefer binding a net.Listener up
+// front and handing that over.
 func GetFreePort() (port int, err error) {
 	var a *net.TCPAddr
 	if a, err = net.ResolveTCPAddr("tcp", "localhost:0"); err == nil {
@@ -994,9 +1016,10 @@ func runSpiceDB(t *testing.T) *authzed.Client {
 	require.NoError(t, err)
 
 	serverReady := make(chan bool)
+	runErr := make(chan error, 1)
 	go func() {
 		serverReady <- true
-		_ = runnableServer.Run(ctx)
+		runErr <- runnableServer.Run(ctx)
 	}()
 
 	// Wait for server goroutine to start
@@ -1005,6 +1028,15 @@ func runSpiceDB(t *testing.T) *authzed.Client {
 	// Verify server is ready
 	var client *authzed.Client
 	require.EventuallyWithT(t, func(collect *assert.CollectT) {
+		// Report the server's own error if it gave up, rather than the far less
+		// useful "did not become ready" five sec
```

#### Recent Merged Pull Requests:
- **PR #3385** (2026-09-29): test: verify classic and planned permission checks (@josephschorr)
- **PR #3382** (2026-09-29): chore(deps): bump the docker group with 2 updates (@dependabot[bot])
- **PR #3375** (2026-09-23): test(consistency): let callers run the consistency fixtures serially (@vroldanbet)
- **PR #3374** (2026-09-22): fix: stop serving a revision that has no validity (@vroldanbet)
- **PR #3372** (2026-09-22): ci: run the tests when the build system changes (@vroldanbet)
- **PR #3371** (2026-09-22): ci: approve the docs PR with the gh CLI (@vroldanbet)
- **PR #3369** (closed): ci: pull the testcontainers reaper image before tests start (@vroldanbet)
- **PR #3367** (2026-09-22): chore(deps): bump the go-mod group across 2 directories with 4 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
