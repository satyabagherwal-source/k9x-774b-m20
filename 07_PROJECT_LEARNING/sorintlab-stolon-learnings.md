# Forensic Learning Record (Deep Inspection): sorintlab/stolon

> **Canonical Artifact**: `07_PROJECT_LEARNING/sorintlab-stolon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sorintlab/stolon](https://github.com/sorintlab/stolon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:48:53.094Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sorintlab/stolon`
- **Description**: PostgreSQL cloud native High Availability and more.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4829 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/flagutil/env.go`
```
// Copyright 2015 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package flagutil

import (
	"fmt"
	"os"
	"strings"

	flag "github.com/spf13/pflag"
)

// SetFlagsFromEnv parses all registered flags in the given flagset,
// and if they are not already set it attempts to set their values from
// environment variables. Environment variables take the name of the flag but
// are UPPERCASE, and any dashes are replaced by underscores. Environment
// variables additionally are prefixed by the given string followed by
// and underscore. For example, if prefix=PREFIX: some-flag => PREFIX_SOME_FLAG
func SetFlagsFromEnv(fs *flag.FlagSet, prefix string) (err error) {
	alreadySet := make(map[string]bool)
	fs.Visit(func(f *flag.Flag) {
		alreadySet[f.Name] = true
	})
	fs.VisitAll(func(f *flag.Flag) {
		if !alreadySet[f.Name] {
			key := prefix + "_" + strings.ToUpper(strings.Replace(f.Name, "-", "_", -1))
			val := os.Getenv(key)
			if val != "" {
				if serr := fs.Set(f.Name, val); serr != nil {
					err = fmt.Errorf("invalid value %q for %s: %v", val, key, serr)
				}
			}
		}
	})
	return err
}

```

### Core Architecture Module: `internal/postgresql/utils.go`
```
// Copyright 2015 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package postgresql

import (
	"bufio"
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/sorintlab/stolon/internal/common"

	"os"

	"github.com/lib/pq"
)

const (
	// TODO(sgotti) for now we assume wal size is the default 16MiB size
	WalSegSize = (16 * 1024 * 1024) // 16MiB
)

var (
	ValidReplSlotName = regexp.MustCompile("^[a-z0-9_]+$")
)

func dbExec(ctx context.Context, db *sql.DB, query string, args ...interface{}) (sql.Result, error) {
	return db.ExecContext(ctx, query, args...)
}

func query(ctx context.Context, db *sql.DB, query string, args ...interface{}) (*sql.Rows, error) {
	return db.QueryContext(ctx, query, args...)
}

func ping(ctx context.Context, connParams ConnParams) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = dbExec(ctx, db, "select 1")
	if err != nil {
		return err
	}
	return nil
}

func setPassword(ctx context.Context, connParams ConnParams, username, password string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	query := fmt.Sprintf("set local log_statement = %s", pq.QuoteLiteral("none"))
	if _, err = tx.ExecContext(ctx, query); err != nil {
		_ = tx.Rollback()
		return err
	}

	query = fmt.Sprintf("alter role %s with encrypted password %s", pq.QuoteIdentifier(username), pq.QuoteLiteral(password))
	if _, err = tx.ExecContext(ctx, query); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func createRole(ctx context.Context, connParams ConnParams, roles []string, username, password string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	query := fmt.Sprintf("set local log_statement = %s", pq.QuoteLiteral("none"))
	if _, err = tx.ExecContext(ctx, query); err != nil {
		_ = tx.Rollback()
		return err
	}

	query = fmt.Sprintf("create role %s with login replication encrypted password %s", pq.QuoteIdentifier(username), pq.QuoteLiteral(password))
	if _, err = tx.ExecContext(ctx, query); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func createPasswordlessRole(ctx context.Context, connParams ConnParams, roles []string, username string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = dbExec(ctx, db, fmt.Sprintf(`create role "%s" with login replication;`, username))
	return err
}

func alterRole(ctx context.Context, connParams ConnParams, roles []string, username, password string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	query := fmt.Sprintf("set local log_statement = %s", pq.QuoteLiteral("none"))
	if _, err = tx.ExecContext(ctx, query); err != nil {
		_ = tx.Rollback()
		return err
	}

	query = fmt.Sprintf("alter role %s with login replication encrypted password %s", pq.QuoteIdentifier(username), pq.QuoteLiteral(password))
	if _, err = tx.ExecContext(ctx, query); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func alterPasswordlessRole(ctx context.Context, connParams ConnParams, roles []string, username string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = dbExec(ctx, db, fmt.Sprintf(`alter role "%s" with login replication;`, username))
	return err
}

// getReplicatinSlots return existing replication slots. On PostgreSQL > 10 we
// skip temporary slots.
func getReplicationSlots(ctx context.Context, connParams ConnParams, maj int) ([]string, error) {
	var q string
	if maj < 10 {
		q = "select slot_name from pg_replication_slots"
	} else {
		q = "select slot_name from pg_replication_slots where temporary is false"
	}

	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return nil, err
	}
	defer db.Close()

	replSlots := []string{}

	rows, err := query(ctx, db, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var slotName string
		if err := rows.Scan(&slotName); err != nil {
			return nil, err
		}
		replSlots = append(replSlots, slotName)
	}

	return replSlots, nil
}

func createReplicationSlot(ctx context.Context, connParams ConnParams, name string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = dbExec(ctx, db, fmt.Sprintf("select pg_create_physical_replication_slot('%s')", name))
	return err
}

func dropReplicationSlot(ctx context.Context, connParams ConnParams, name string) error {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return err
	}
	defer db.Close()

	_, err = dbExec(ctx, db, fmt.Sprintf("select pg_drop_replication_slot('%s')", name))
	return err
}

func getSyncStandbys(ctx context.Context, connParams ConnParams) ([]string, error) {
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := query(ctx, db, "select application_name, sync_state from pg_stat_replication")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	syncStandbys := []string{}
	for rows.Next() {
		var applicationName, syncState string
		if err := rows.Scan(&applicationName, &syncState); err != nil {
			return nil, err
		}

		if syncState == "sync" {
			syncStandbys = append(syncStandbys, applicationName)
		}
	}

	return syncStandbys, nil
}

func PGLsnToInt(lsn string) (uint64, error) {
	parts := strings.Split(lsn, "/")
	if len(parts) != 2 {
		return 0, fmt.Errorf("bad pg_lsn: %s", lsn)
	}
	a, err := strconv.ParseUint(parts[0], 16, 32)
	if err != nil {
		return 0, err
	}
	b, err := strconv.ParseUint(parts[1], 16, 32)
	if err != nil {
		return 0, err
	}
	v := uint64(a)<<32 | b
	return v, nil
}

func GetSystemData(ctx context.Context, replConnParams ConnParams) (*SystemData, error) {
	// Add "replication=1" connection option
	replConnParams["replication"] = "1"
	db, err := sql.Open("postgres", replConnParams.ConnString())
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := query(ctx, db, "IDENTIFY_SYSTEM")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if rows.Next() {
		var sd SystemData
		var xLogPosLsn string
		var unused *string
		if err = rows.Scan(&sd.SystemID, &sd.TimelineID, &xLogPosLsn, &unused); err != nil {
			return nil, err
		}
		sd.XLogPos, err = PGLsnToInt(xLogPosLsn)
		if err != nil {
			return nil, err
		}
		return &sd, nil
	}
	return nil, fmt.Errorf("query returned 0 rows")
}

func parseTimelinesHistory(contents string) ([]*TimelineHistory, error) {
	tlsh := []*TimelineHistory{}
	regex, err := regexp.Compile(`(\S+)\s+(\S+)\s+(.*)$`)
	if err != nil {
		return nil, err
	}

	scanner := bufio.NewScanner(strings.NewReader(contents))
	scanner.Split(bufio.ScanLines)

	for scanner.Scan() {
		m := regex.FindStringSubmatch(scanner.Text())
		if len(m) == 4 {
			var tlh TimelineHistory
			if tlh.TimelineID, err = strconv.ParseUint(m[1], 10, 64); err != nil {
				return nil, fmt.Errorf("cannot parse timelineID in timeline history line %q: %v", scanner.Text(), err)
			}
			if tlh.SwitchPoint, err = PGLsnToInt(m[2]); err != nil {
				return nil, fmt.Errorf("cannot parse start lsn in timeline history line %q: %v", scanner.Text(), err)
			}
			tlh.Reason = m[3]
			tlsh = append(tlsh, &tlh)
		}
	}
	return tlsh, err
}

func getTimelinesHistory(ctx context.Context, timeline uint64, replConnParams ConnParams) ([]*TimelineHistory, error) {
	// Add "replication=1" connection option
	replConnParams["replication"] = "1"
	db, err := sql.Open("postgres", replConnParams.ConnString())
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := query(ctx, db, fmt.Sprintf("TIMELINE_HISTORY %d", timeline))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if rows.Next() {
		var timelineFile string
		var contents string
		if err := rows.Scan(&timelineFile, &contents); err != nil {
			return nil, err
		}
		tlsh, err := parseTimelinesHistory(contents)
		if err != nil {
			return nil, err
		}
		return tlsh, nil
	}
	return nil, fmt.Errorf("query returned 0 rows")
}

func IsValidReplSlotName(name string) bool {
	return ValidReplSlotName.MatchString(name)
}

func fileExists(path string) (bool, error) {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func expand(s, dataDir string) string {
	buf := make([]byte, 0, 2*len(s))
	// %d %% are all ASCII, so bytes are fine for this operation.
	i := 0
	for j := 0; j < len(s); j++ {
		if s[j] == '%' && j+1 < len(s) {
			switch s[j+1] {
			case 'd':
				buf = append(buf, s[i:j]...)
				buf = append(buf, []byte(dataDir)...)
				j += 1
				i = j + 1
			case '%':
				j += 1
				buf = append(buf, s[i:j]...)
				i = j + 1
			default:
			}
		}
	}
	return string(buf) + s[i:]
}

func getConfigFilePGParameters(ctx context.Context, connParams ConnParams) (common.Parameters, error) {
	var pgParameters = common.Parameters{}
	db, err := sql.Open("postgres", connParams.ConnString())
	if err != nil {
		return nil, err
	}
	defer db.Close(
```

### Core Architecture Module: `internal/util/k8s.go`
```
// Copyright 2018 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package util

import (
	"fmt"
	"os"

	"k8s.io/client-go/tools/clientcmd"
)

const (
	KubePodName = "POD_NAME"

	KubeResourcePrefix = "stolon-cluster"

	KubeClusterLabel = "stolon-cluster"

	KubeClusterDataAnnotation = "stolon-clusterdata"
	KubeStatusAnnnotation     = "stolon-status"
)

func PodName() (string, error) {
	podName := os.Getenv(KubePodName)
	if len(podName) == 0 {
		return "", fmt.Errorf("missing required env variable %q", KubePodName)
	}
	return podName, nil
}

// NewKubeClientConfig return a kube client config that will by default use an
// in cluster client config or, if not available or overridden, an external client
// config using the default client behavior used also by kubectl.
func NewKubeClientConfig(kubeconfigPath, context, namespace string) clientcmd.ClientConfig {
	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	rules.DefaultClientConfig = &clientcmd.DefaultClientConfig

	if kubeconfigPath != "" {
		rules.ExplicitPath = kubeconfigPath
	}

	overrides := &clientcmd.ConfigOverrides{ClusterDefaults: clientcmd.ClusterDefaults}

	if context != "" {
		overrides.CurrentContext = context
	}

	if namespace != "" {
		overrides.Context.Namespace = namespace
	}

	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(rules, overrides)
}

```

### Core Architecture Module: `internal/util/slice.go`
```
// Copyright 2018 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package util

import "sort"

func StringInSlice(s []string, e string) bool {
	for _, v := range s {
		if v == e {
			return true
		}
	}
	return false
}

// CompareStringSlice compares two slices of strings, a nil slice is considered an empty one
func CompareStringSlice(a []string, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}

// CompareStringSliceNoOrder compares two slices of strings regardless of their order, a nil slice is considered an empty one
func CompareStringSliceNoOrder(a []string, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	// This isn't the faster way but it's cleaner and enough for us

	// Take a copy of the original slice
	a = append([]string(nil), a...)
	b = append([]string(nil), b...)

	sort.Strings(a)
	sort.Strings(b)

	for i, v := range a {
		if v != b[i] {
			return false
		}
	}
	return true
}

// CommonElements return the common elements in two slices of strings
func CommonElements(a []string, b []string) []string {
	common := []string{}
	for _, v := range a {
		if StringInSlice(b, v) {
			common = append(common, v)
		}
	}
	return common
}

// Difference returns elements in a - b
func Difference(a []string, b []string) []string {
	diff := []string{}
	for _, v := range a {
		if !StringInSlice(b, v) {
			diff = append(diff, v)
		}
	}
	return diff
}

```

### Core Architecture Module: `internal/util/user.go`
```
// Copyright 2016 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package util

import (
	"fmt"
	"os"
	"os/user"
)

func GetUser() (string, error) {
	u, err := user.Current()
	if err == nil {
		return u.Username, nil
	}

	name := os.Getenv("USER")
	if name != "" {
		return name, nil
	}

	return "", fmt.Errorf("cannot detect current user")
}

```

### Core Architecture Module: `cmd/common.go`
```
// Copyright 2017 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sorintlab/stolon/internal/cluster"
	"github.com/sorintlab/stolon/internal/common"
	"github.com/sorintlab/stolon/internal/store"
	"github.com/sorintlab/stolon/internal/util"

	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
	"k8s.io/client-go/kubernetes"
	_ "k8s.io/client-go/plugin/pkg/client/auth"
)

type CommonConfig struct {
	IsStolonCtl bool

	StoreBackend         string
	StoreEndpoints       string
	StorePrefix          string
	StoreCertFile        string
	StoreKeyFile         string
	StoreCAFile          string
	StoreSkipTlsVerify   bool
	ClusterName          string
	MetricsListenAddress string
	LogColor             bool
	LogLevel             string
	Debug                bool
	KubeResourceKind     string
	KubeConfig           string
	KubeContext          string
	KubeNamespace        string
	StoreTimeout         time.Duration
}

func AddCommonFlags(cmd *cobra.Command, cfg *CommonConfig) {
	cmd.PersistentFlags().StringVar(&cfg.ClusterName, "cluster-name", "", "cluster name")
	cmd.PersistentFlags().StringVar(&cfg.StoreBackend, "store-backend", "", "store backend type (etcdv2/etcd, etcdv3, consul or kubernetes)")
	cmd.PersistentFlags().StringVar(&cfg.StoreEndpoints, "store-endpoints", "", "a comma-delimited list of store endpoints (use https scheme for tls communication) (defaults: http://127.0.0.1:2379 for etcd, http://127.0.0.1:8500 for consul)")
	cmd.PersistentFlags().DurationVar(&cfg.StoreTimeout, "store-timeout", cluster.DefaultStoreTimeout, "store request timeout")
	cmd.PersistentFlags().StringVar(&cfg.StorePrefix, "store-prefix", common.StorePrefix, "the store base prefix")
	cmd.PersistentFlags().StringVar(&cfg.StoreCertFile, "store-cert-file", "", "certificate file for client identification to the store")
	cmd.PersistentFlags().StringVar(&cfg.StoreKeyFile, "store-key", "", "private key file for client identification to the store")
	cmd.PersistentFlags().BoolVar(&cfg.StoreSkipTlsVerify, "store-skip-tls-verify", false, "skip store certificate verification (insecure!!!)")
	cmd.PersistentFlags().StringVar(&cfg.StoreCAFile, "store-ca-file", "", "verify certificates of HTTPS-enabled store servers using this CA bundle")
	cmd.PersistentFlags().StringVar(&cfg.MetricsListenAddress, "metrics-listen-address", "", "metrics listen address i.e \"0.0.0.0:8080\" (disabled by default)")
	cmd.PersistentFlags().StringVar(&cfg.KubeResourceKind, "kube-resource-kind", "", `the k8s resource kind to be used to store stolon clusterdata and do sentinel leader election (only "configmap" is currently supported)`)

	if !cfg.IsStolonCtl {
		cmd.PersistentFlags().BoolVar(&cfg.LogColor, "log-color", false, "enable color in log output (default if attached to a terminal)")
		cmd.PersistentFlags().StringVar(&cfg.LogLevel, "log-level", "info", "debug, info (default), warn or error")
	}

	if cfg.IsStolonCtl {
		cmd.PersistentFlags().StringVar(&cfg.LogLevel, "log-level", "info", "debug, info (default), warn or error")
		cmd.PersistentFlags().StringVar(&cfg.KubeConfig, "kubeconfig", "", "path to kubeconfig file. Overrides $KUBECONFIG")
		cmd.PersistentFlags().StringVar(&cfg.KubeContext, "kube-context", "", "name of the kubeconfig context to use")
		cmd.PersistentFlags().StringVar(&cfg.KubeNamespace, "kube-namespace", "", "name of the kubernetes namespace to use")
	}
}

var (
	// clusterIdentifier provides a Prometheus metric that should uniquely identify the
	// cluster that any stolon component is associated with. Users can then join between
	// various metric series for the same cluster without making assumptions about service
	// discovery labels.
	clusterIdentifier = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "stolon_cluster_identifier",
			Help: "Set to 1, is labelled with the cluster_name and component",
		},
		[]string{"cluster_name", "component"},
	)
)

func init() {
	prometheus.MustRegister(clusterIdentifier)
}

func CheckCommonConfig(cfg *CommonConfig) error {
	if cfg.ClusterName == "" {
		return fmt.Errorf("cluster name required")
	}
	if cfg.StoreBackend == "" {
		return fmt.Errorf("store backend type required")
	}

	switch cfg.StoreBackend {
	case "consul":
	case "etcd":
		// etcd is old alias for etcdv2
		cfg.StoreBackend = "etcdv2"
	case "etcdv2":
	case "etcdv3":
	case "kubernetes":
		if cfg.KubeResourceKind == "" {
			return fmt.Errorf("unspecified kubernetes resource kind")
		}
		if cfg.KubeResourceKind != "configmap" {
			return fmt.Errorf("wrong kubernetes resource kind: %q", cfg.KubeResourceKind)
		}
	default:
		return fmt.Errorf("Unknown store backend: %q", cfg.StoreBackend)
	}

	return nil
}

// SetMetrics should be called by any stolon component that outputs application metrics.
// It sets the clusterIdentifier metric, which is key to joining across all the other
// metric series.
func SetMetrics(cfg *CommonConfig, component string) {
	clusterIdentifier.WithLabelValues(cfg.ClusterName, component).Set(1)
}

func IsColorLoggerEnable(cmd *cobra.Command, cfg *CommonConfig) bool {
	if cmd.PersistentFlags().Changed("log-color") {
		return cfg.LogColor
	} else {
		return isatty.IsTerminal(os.Stderr.Fd()) || isatty.IsCygwinTerminal(os.Stderr.Fd())
	}
}

func NewKVStore(cfg *CommonConfig) (store.KVStore, error) {
	return store.NewKVStore(store.Config{
		Backend:       store.Backend(cfg.StoreBackend),
		Endpoints:     cfg.StoreEndpoints,
		Timeout:       cfg.StoreTimeout,
		CertFile:      cfg.StoreCertFile,
		KeyFile:       cfg.StoreKeyFile,
		CAFile:        cfg.StoreCAFile,
		SkipTLSVerify: cfg.StoreSkipTlsVerify,
	})
}

func NewStore(cfg *CommonConfig) (store.Store, error) {
	var s store.Store

	switch cfg.StoreBackend {
	case "consul":
		fallthrough
	case "etcdv2":
		fallthrough
	case "etcdv3":
		storePath := filepath.Join(cfg.StorePrefix, cfg.ClusterName)

		kvstore, err := NewKVStore(cfg)
		if err != nil {
			return nil, fmt.Errorf("cannot create kv store: %v", err)
		}
		s = store.NewKVBackedStore(kvstore, storePath)
	case "kubernetes":
		kubecli, podName, namespace, err := getKubeValues(cfg)
		if err != nil {
			return nil, err
		}
		s, err = store.NewKubeStore(kubecli, podName, namespace, cfg.ClusterName)
		if err != nil {
			return nil, fmt.Errorf("cannot create store: %v", err)
		}
	}

	return s, nil
}

func NewElection(cfg *CommonConfig, uid string) (store.Election, error) {
	var election store.Election

	switch cfg.StoreBackend {
	case "consul":
		fallthrough
	case "etcdv2":
		fallthrough
	case "etcdv3":
		storePath := filepath.Join(cfg.StorePrefix, cfg.ClusterName)

		kvstore, err := NewKVStore(cfg)
		if err != nil {
			return nil, fmt.Errorf("cannot create kv store: %v", err)
		}
		election = store.NewKVBackedElection(kvstore, filepath.Join(storePath, common.SentinelLeaderKey), uid, cfg.StoreTimeout)
	case "kubernetes":
		kubecli, podName, namespace, err := getKubeValues(cfg)
		if err != nil {
			return nil, err
		}
		election, err = store.NewKubeElection(kubecli, podName, namespace, cfg.ClusterName, uid)
		if err != nil {
			return nil, err
		}
	}

	return election, nil
}

func getKubeValues(cfg *CommonConfig) (*kubernetes.Clientset, string, string, error) {
	kubeClientConfig := util.NewKubeClientConfig(cfg.KubeConfig, cfg.KubeContext, cfg.KubeNamespace)
	kubecfg, err := kubeClientConfig.ClientConfig()
	if err != nil {
		return nil, "", "", err
	}
	kubecfg.Timeout = cfg.StoreTimeout
	kubecli, err := kubernetes.NewForConfig(kubecfg)
	if err != nil {
		return nil, "", "", fmt.Errorf("cannot create kubernetes client: %v", err)
	}
	var podName string
	if !cfg.IsStolonCtl {
		podName, err = util.PodName()
		if err != nil {
			return nil, "", "", err
		}
	}
	namespace, _, err := kubeClientConfig.Namespace()
	if err != nil {
		return nil, "", "", err
	}
	return kubecli, podName, namespace, nil
}

```

### Core Architecture Module: `cmd/keeper/cmd/keeper.go`
```
// Copyright 2015 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/mitchellh/copystructure"
	"github.com/sorintlab/stolon/cmd"
	"github.com/sorintlab/stolon/internal/cluster"
	"github.com/sorintlab/stolon/internal/common"
	"github.com/sorintlab/stolon/internal/flagutil"
	slog "github.com/sorintlab/stolon/internal/log"
	pg "github.com/sorintlab/stolon/internal/postgresql"
	"github.com/sorintlab/stolon/internal/store"
	"github.com/sorintlab/stolon/internal/util"

	"github.com/davecgh/go-spew/spew"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

var log = slog.S()

var CmdKeeper = &cobra.Command{
	Use:     "stolon-keeper",
	Run:     keeper,
	Version: cmd.Version,
}

const (
	maxPostgresTimelinesHistory = 2
	minWalKeepSegments          = 8
)

type KeeperLocalState struct {
	UID        string
	ClusterUID string
}

type DBLocalState struct {
	UID        string
	Generation int64
	// Initializing registers when the db is initializing. Needed to detect
	// when the initialization has failed.
	Initializing bool
	// InitPGParameters contains the postgres parameter after the
	// initialization
	InitPGParameters common.Parameters
}

func (s *DBLocalState) DeepCopy() *DBLocalState {
	if s == nil {
		return nil
	}
	ns, err := copystructure.Copy(s)
	if err != nil {
		panic(err)
	}
	// paranoid test
	if !reflect.DeepEqual(s, ns) {
		panic("not equal")
	}
	return ns.(*DBLocalState)
}

type config struct {
	cmd.CommonConfig

	uid                string
	dataDir            string
	debug              bool
	pgListenAddress    string
	pgAdvertiseAddress string
	pgPort             string
	pgAdvertisePort    string
	pgBinPath          string
	pgReplAuthMethod   string
	pgReplUsername     string
	pgReplPassword     string
	pgReplPasswordFile string
	pgSUAuthMethod     string
	pgSUUsername       string
	pgSUPassword       string
	pgSUPasswordFile   string

	canBeMaster             bool
	canBeSynchronousReplica bool
	disableDataDirLocking   bool
}

var cfg config

func init() {
	cmd.AddCommonFlags(CmdKeeper, &cfg.CommonConfig)

	CmdKeeper.PersistentFlags().StringVar(&cfg.uid, "id", "", "keeper uid (must be unique in the cluster and can contain only lower-case letters, numbers and the underscore character). If not provided a random uid will be generated.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.uid, "uid", "", "keeper uid (must be unique in the cluster and can contain only lower-case letters, numbers and the underscore character). If not provided a random uid will be generated.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.dataDir, "data-dir", "", "data directory")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgListenAddress, "pg-listen-address", "", "postgresql instance listening address, local address used for the postgres instance. For all network interface, you can set the value to '*'.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgAdvertiseAddress, "pg-advertise-address", "", "postgresql instance address from outside. Use it to expose ip different than local ip with a NAT networking config")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgPort, "pg-port", "5432", "postgresql instance listening port")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgAdvertisePort, "pg-advertise-port", "", "postgresql instance port from outside. Use it to expose port different than local port with a PAT networking config")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgBinPath, "pg-bin-path", "", "absolute path to postgresql binaries. If empty they will be searched in the current PATH")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgReplAuthMethod, "pg-repl-auth-method", "md5", "postgres replication user auth method. Default is md5.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgReplUsername, "pg-repl-username", "", "postgres replication user name. Required. It'll be created on db initialization. Must be the same for all keepers.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgReplPassword, "pg-repl-password", "", "postgres replication user password. Only one of --pg-repl-password or --pg-repl-passwordfile must be provided. Must be the same for all keepers.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgReplPasswordFile, "pg-repl-passwordfile", "", "postgres replication user password file. Only one of --pg-repl-password or --pg-repl-passwordfile must be provided. Must be the same for all keepers.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgSUAuthMethod, "pg-su-auth-method", "md5", "postgres superuser auth method. Default is md5.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgSUUsername, "pg-su-username", "", "postgres superuser user name. Used for keeper managed instance access and pg_rewind based synchronization. It'll be created on db initialization. Defaults to the name of the effective user running stolon-keeper. Must be the same for all keepers.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgSUPassword, "pg-su-password", "", "postgres superuser password. Only one of --pg-su-password or --pg-su-passwordfile must be provided. Must be the same for all keepers.")
	CmdKeeper.PersistentFlags().StringVar(&cfg.pgSUPasswordFile, "pg-su-passwordfile", "", "postgres superuser password file. Only one of --pg-su-password or --pg-su-passwordfile must be provided. Must be the same for all keepers)")
	CmdKeeper.PersistentFlags().BoolVar(&cfg.debug, "debug", false, "enable debug logging")

	CmdKeeper.PersistentFlags().BoolVar(&cfg.canBeMaster, "can-be-master", true, "prevent keeper from being elected as master")
	CmdKeeper.PersistentFlags().BoolVar(&cfg.canBeSynchronousReplica, "can-be-synchronous-replica", true, "prevent keeper from being chosen as synchronous replica")
	CmdKeeper.PersistentFlags().BoolVar(&cfg.disableDataDirLocking, "disable-data-dir-locking", false, "disable locking on data dir. Warning! It'll cause data corruptions if two keepers are concurrently running with the same data dir.")

	if err := CmdKeeper.PersistentFlags().MarkDeprecated("id", "please use --uid"); err != nil {
		log.Fatal(err)
	}
	if err := CmdKeeper.PersistentFlags().MarkDeprecated("debug", "use --log-level=debug instead"); err != nil {
		log.Fatal(err)
	}
}

var managedPGParameters = []string{
	"unix_socket_directories",
	"wal_keep_segments",
	"wal_keep_size",
	"hot_standby",
	"listen_addresses",
	"port",
	"max_replication_slots",
	"max_wal_senders",
	"wal_log_hints",
	"synchronous_standby_names",

	// parameters moved from recovery.conf to postgresql.conf in PostgresSQL 12
	"primary_conninfo",
	"primary_slot_name",
	"recovery_min_apply_delay",
	"restore_command",
	"recovery_target_timeline",
	"recovery_target",
	"recovery_target_lsn",
	"recovery_target_name",
	"recovery_target_time",
	"recovery_target_xid",
	"recovery_target_timeline",
	"recovery_target_action",
}

func readPasswordFromFile(filepath string) (string, error) {
	fi, err := os.Lstat(filepath)
	if err != nil {
		return "", fmt.Errorf("unable to read password from file %s: %v", filepath, err)
	}

	if fi.Mode() > 0600 {
		//TODO: enforce this by exiting with an error. Kubernetes makes this file too open today.
		log.Warnw("password file permissions are too open. This file should only be readable to the user executing stolon! Continuing...", "file", filepath, "mode", fmt.Sprintf("%#o", fi.Mode()))
	}

	pwBytes, err := ioutil.ReadFile(filepath)
	if err != nil {
		return "", fmt.Errorf("unable to read password from file %s: %v", filepath, err)
	}
	return string(pwBytes), nil
}

// walLevel returns the wal_level value to use.
// if there's an user provided wal_level pg parameters and if its value is
// "logical" then returns it, otherwise returns the default ("hot_standby" for
// pg < 9.6 or "replica" for pg >= 9.6).
func (p *PostgresKeeper) walLevel(db *cluster.DB) string {
	var additionalValidWalLevels = []string{
		"logical", // pg >= 10
	}

	maj, min, err := p.pgm.BinaryVersion()
	if err != nil {
		// in case we fail to parse the binary version then log it and just use "hot_standby" that works for all versions
		log.Warnf("failed to get postgres binary version: %v", err)
		return "hot_standby"
	}

	// set default wal_level
	walLevel := "hot_standby"
	if maj == 9 {
		if min >= 6 {
			walLevel = "replica"
		}
	} else if maj >= 10 {
		walLevel = "replica"
	}

	if db.Spec.PGParameters != nil {
		if l, ok := db.Spec.PGParameters["wal_level"]; ok {
			if util.StringInSlice(additionalValidWalLevels, l) {
				walLevel = l
			}
		}
	}

	return walLevel
}

func (p *PostgresKeeper) walKeepSegments(db *cluster.DB) int {
	walKeepSegments := minWalKeepSegments
	if db.Spec.PGParameters != nil {
		if v, ok := db.Spec.PGParameters["wal_keep_segments"]; ok {
			// ignore wrong wal_keep_segments values
			if configuredWalKeepSegments, err := strconv.Atoi(v); err == nil {
				if configuredWalKeepSegments > walKeepSegments {
					walKeepSegments = configuredWalKeepSegments
				}
			}
		}
	}

	return walKeepSegments
}

func (p *PostgresKeeper) walKeepSize(db *cluster.DB) string {
	// assume default 16Mib wal segment size
	walKeepSize := strconv.Itoa(minWalKeepSegments * 16)

	// TODO(sgotti) currently we ignore if wal_keep_size value is less than our
	// min value or wrong and just return it as is
	if db.Spec.PGParameters != nil {
		if v, ok := db.Spec.PGP
```

### Core Architecture Module: `cmd/keeper/cmd/metrics.go`
```
// Copyright 2019 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sorintlab/stolon/internal/common"
)

var (
	clusterdataLastValidUpdateSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_clusterdata_last_valid_update_seconds",
			Help: "Last time we received a valid clusterdata from our store as seconds since unix epoch",
		},
	)
	targetRoleGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_target_role",
			Help: "Keeper last requested target role",
		},
		[]string{"role"},
	)
	localRoleGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_local_role",
			Help: "Keeper current local role",
		},
		[]string{"role"},
	)
	needsReloadGauge = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_needs_reload",
			Help: "Set to 1 if Postgres requires reload",
		},
	)
	needsRestartGauge = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_needs_restart",
			Help: "Set to 1 if Postgres requires restart",
		},
	)
	lastSyncSuccessSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_last_sync_success_seconds",
			Help: "Last time we successfully synced our keeper",
		},
	)
	sleepInterval = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_sleep_interval",
			Help: "Seconds to sleep between sync loops",
		},
	)
	shutdownSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_keeper_shutdown_seconds",
			Help: "Shutdown time (received termination signal) since unix epoch in seconds",
		},
	)
)

// setRole is a helper that controls the targetRole metric by setting only one of the
// possible roles to 1 at any one time.
func setRole(rg *prometheus.GaugeVec, role *common.Role) {
	for _, role := range common.Roles {
		rg.WithLabelValues(string(role)).Set(0)
	}

	if role != nil {
		rg.WithLabelValues(string(*role)).Set(1)
	}
}

func init() {
	prometheus.MustRegister(clusterdataLastValidUpdateSeconds)
	prometheus.MustRegister(targetRoleGauge)
	setRole(targetRoleGauge, nil)
	prometheus.MustRegister(localRoleGauge)
	setRole(localRoleGauge, nil)
	prometheus.MustRegister(needsReloadGauge)
	prometheus.MustRegister(needsRestartGauge)
	prometheus.MustRegister(lastSyncSuccessSeconds)
	prometheus.MustRegister(sleepInterval)
	prometheus.MustRegister(shutdownSeconds)
}

```

### Core Architecture Module: `cmd/keeper/main.go`
```
// Copyright 2015 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"github.com/sorintlab/stolon/cmd/keeper/cmd"
)

func main() {
	cmd.Execute()
}

```

### Core Architecture Module: `cmd/proxy/cmd/proxy.go`
```
// Copyright 2015 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sorintlab/stolon/cmd"
	"github.com/sorintlab/stolon/internal/cluster"
	"github.com/sorintlab/stolon/internal/common"
	"github.com/sorintlab/stolon/internal/flagutil"
	slog "github.com/sorintlab/stolon/internal/log"
	"github.com/sorintlab/stolon/internal/store"
	"github.com/sorintlab/stolon/internal/util"

	"github.com/davecgh/go-spew/spew"
	"github.com/sorintlab/pollon"
	"github.com/spf13/cobra"
	"go.uber.org/zap"
)

var log = slog.S()

var CmdProxy = &cobra.Command{
	Use:     "stolon-proxy",
	Run:     proxy,
	Version: cmd.Version,
}

type config struct {
	cmd.CommonConfig

	listenAddress string
	port          string
	stopListening bool
	debug         bool

	keepAliveIdle     int
	keepAliveCount    int
	keepAliveInterval int
}

var cfg config

func init() {
	cmd.AddCommonFlags(CmdProxy, &cfg.CommonConfig)

	CmdProxy.PersistentFlags().StringVar(&cfg.listenAddress, "listen-address", "127.0.0.1", "proxy listening address")
	CmdProxy.PersistentFlags().StringVar(&cfg.port, "port", "5432", "proxy listening port")
	CmdProxy.PersistentFlags().BoolVar(&cfg.stopListening, "stop-listening", true, "stop listening on store error")
	CmdProxy.PersistentFlags().BoolVar(&cfg.debug, "debug", false, "enable debug logging")
	CmdProxy.PersistentFlags().IntVar(&cfg.keepAliveIdle, "tcp-keepalive-idle", 0, "set tcp keepalive idle (seconds)")
	CmdProxy.PersistentFlags().IntVar(&cfg.keepAliveCount, "tcp-keepalive-count", 0, "set tcp keepalive probe count number")
	CmdProxy.PersistentFlags().IntVar(&cfg.keepAliveInterval, "tcp-keepalive-interval", 0, "set tcp keepalive interval (seconds)")

	if err := CmdProxy.PersistentFlags().MarkDeprecated("debug", "use --log-level=debug instead"); err != nil {
		log.Fatal(err)
	}
}

type ClusterChecker struct {
	uid           string
	listenAddress string
	port          string

	stopListening bool

	listener         *net.TCPListener
	pp               *pollon.Proxy
	e                store.Store
	endPollonProxyCh chan error

	pollonMutex sync.Mutex

	proxyCheckInterval time.Duration
	proxyTimeout       time.Duration
	configMutex        sync.Mutex
}

func NewClusterChecker(uid string, cfg config) (*ClusterChecker, error) {
	e, err := cmd.NewStore(&cfg.CommonConfig)
	if err != nil {
		return nil, fmt.Errorf("cannot create store: %v", err)
	}

	return &ClusterChecker{
		uid:              uid,
		listenAddress:    cfg.listenAddress,
		port:             cfg.port,
		stopListening:    cfg.stopListening,
		e:                e,
		endPollonProxyCh: make(chan error),

		proxyCheckInterval: cluster.DefaultProxyCheckInterval,
		proxyTimeout:       cluster.DefaultProxyTimeout,
	}, nil
}

func (c *ClusterChecker) startPollonProxy() error {
	c.pollonMutex.Lock()
	defer c.pollonMutex.Unlock()
	if c.pp != nil {
		return nil
	}

	log.Infow("Starting proxying")
	addr, err := net.ResolveTCPAddr("tcp", net.JoinHostPort(cfg.listenAddress, cfg.port))
	if err != nil {
		return fmt.Errorf("error resolving tcp addr %q: %v", addr.String(), err)
	}

	listener, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return fmt.Errorf("error listening on tcp addr %q: %v", addr.String(), err)
	}

	pp, err := pollon.NewProxy(listener)
	if err != nil {
		return fmt.Errorf("error creating pollon proxy: %v", err)
	}
	pp.SetKeepAlive(true)
	pp.SetKeepAliveIdle(time.Duration(cfg.keepAliveIdle) * time.Second)
	pp.SetKeepAliveCount(cfg.keepAliveCount)
	pp.SetKeepAliveInterval(time.Duration(cfg.keepAliveInterval) * time.Second)

	c.pp = pp
	c.listener = listener

	go func() {
		c.endPollonProxyCh <- c.pp.Start()
	}()

	return nil
}

func (c *ClusterChecker) stopPollonProxy() {
	c.pollonMutex.Lock()
	defer c.pollonMutex.Unlock()
	if c.pp != nil {
		log.Infow("Stopping listening")
		c.pp.Stop()
		c.pp = nil
		c.listener.Close()
		c.listener = nil
	}
}

func (c *ClusterChecker) sendPollonConfData(confData pollon.ConfData) {
	c.pollonMutex.Lock()
	defer c.pollonMutex.Unlock()
	if c.pp != nil {
		c.pp.C <- confData
	}
}

func (c *ClusterChecker) SetProxyInfo(e store.Store, generation int64, proxyTimeout time.Duration) error {
	proxyInfo := &cluster.ProxyInfo{
		InfoUID:      common.UID(),
		UID:          c.uid,
		Generation:   generation,
		ProxyTimeout: proxyTimeout,
	}
	log.Debugf("proxyInfo dump: %s", spew.Sdump(proxyInfo))

	if err := c.e.SetProxyInfo(context.TODO(), proxyInfo, 2*proxyTimeout); err != nil {
		return err
	}
	return nil
}

// Check reads the cluster data and applies the right pollon configuration.
func (c *ClusterChecker) Check() error {
	cd, _, err := c.e.GetClusterData(context.TODO())
	if err != nil {
		return fmt.Errorf("cannot get cluster data: %v", err)
	}

	// Start pollon if not active
	if err = c.startPollonProxy(); err != nil {
		return fmt.Errorf("failed to start proxy: %v", err)
	}

	log.Debugf("cd dump: %s", spew.Sdump(cd))
	if cd == nil {
		log.Infow("no clusterdata available, closing connections to master")
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
		return nil
	}
	if cd.FormatVersion != cluster.CurrentCDFormatVersion {
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
		return fmt.Errorf("unsupported clusterdata format version: %d", cd.FormatVersion)
	}
	if err = cd.Cluster.Spec.Validate(); err != nil {
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
		return fmt.Errorf("clusterdata validation failed: %v", err)
	}

	cdProxyCheckInterval := cd.Cluster.DefSpec().ProxyCheckInterval.Duration
	cdProxyTimeout := cd.Cluster.DefSpec().ProxyTimeout.Duration

	// use the greater between the current proxy timeout and the one defined in the cluster spec if they're different.
	// in this way we're updating our proxyInfo using a timeout that is greater or equal the current active timeout timer.
	c.configMutex.Lock()
	proxyTimeout := c.proxyTimeout
	if cdProxyTimeout > proxyTimeout {
		proxyTimeout = cdProxyTimeout
	}
	c.configMutex.Unlock()

	proxy := cd.Proxy
	if proxy == nil {
		log.Infow("no proxy object available, closing connections to master")
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
		// ignore errors on setting proxy info
		if err = c.SetProxyInfo(c.e, cluster.NoGeneration, proxyTimeout); err != nil {
			log.Errorw("failed to update proxyInfo", zap.Error(err))
		} else {
			// update proxyCheckinterval and proxyTimeout only if we successfully updated our proxy info
			c.configMutex.Lock()
			c.proxyCheckInterval = cdProxyCheckInterval
			c.proxyTimeout = cdProxyTimeout
			c.configMutex.Unlock()
		}
		return nil
	}

	db, ok := cd.DBs[proxy.Spec.MasterDBUID]
	if !ok {
		log.Infow("no db object available, closing connections to master", "db", proxy.Spec.MasterDBUID)
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
		// ignore errors on setting proxy info
		if err = c.SetProxyInfo(c.e, proxy.Generation, proxyTimeout); err != nil {
			log.Errorw("failed to update proxyInfo", zap.Error(err))
		} else {
			// update proxyCheckinterval and proxyTimeout only if we successfully updated our proxy info
			c.configMutex.Lock()
			c.proxyCheckInterval = cdProxyCheckInterval
			c.proxyTimeout = cdProxyTimeout
			c.configMutex.Unlock()
		}
		return nil
	}

	addr, err := net.ResolveTCPAddr("tcp", net.JoinHostPort(db.Status.ListenAddress, db.Status.Port))
	if err != nil {
		log.Errorw("cannot resolve db address", zap.Error(err))
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
		return nil
	}
	log.Infow("master address", "address", addr)
	if err = c.SetProxyInfo(c.e, proxy.Generation, proxyTimeout); err != nil {
		// if we failed to update our proxy info when a master is defined we
		// cannot ignore this error since the sentinel won't know that we exist
		// and are sending connections to a master so, when electing a new
		// master, it'll not wait for us to close connections to the old one.
		return fmt.Errorf("failed to update proxyInfo: %v", err)
	} else {
		// update proxyCheckinterval and proxyTimeout only if we successfully updated our proxy info
		c.configMutex.Lock()
		c.proxyCheckInterval = cdProxyCheckInterval
		c.proxyTimeout = cdProxyTimeout
		c.configMutex.Unlock()
	}

	// start proxing only if we are inside enabledProxies, this ensures that the
	// sentinel has read our proxyinfo and knows we are alive
	if util.StringInSlice(proxy.Spec.EnabledProxies, c.uid) {
		log.Infow("proxying to master address", "address", addr)
		c.sendPollonConfData(pollon.ConfData{DestAddr: addr})
	} else {
		log.Infow("not proxying to master address since we aren't in the enabled proxies list", "address", addr)
		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
	}

	return nil
}

func (c *ClusterChecker) TimeoutChecker(checkOkCh chan struct{}) {
	c.configMutex.Lock()
	timeoutTimer := time.NewTimer(c.proxyTimeout)
	c.configMutex.Unlock()

	for {
		select {
		case <-timeoutTimer.C:
			log.Infow("check timeout timer fired")
			// if the check timeouts close all connections and stop listening
			// (for example to avoid load balancers forward connections to us
			// since we aren't ready or in a bad state)
			c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
			if c.stopListening {
				c.stopPollonProxy()
			}

		case <-checkOkCh:
			log.Debugw("check ok message received")

			// ignore if stop succeeded or not due to timer already expired
			timeoutTimer.Stop()

			c.configM
```

### Core Architecture Module: `cmd/proxy/main.go`
```
// Copyright 2015 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"github.com/sorintlab/stolon/cmd/proxy/cmd"
)

func main() {
	cmd.Execute()
}

```

### Core Architecture Module: `cmd/sentinel/cmd/metrics.go`
```
// Copyright 2019 Sorint.lab
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	lastCheckSuccessSeconds = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "stolon_sentinel_last_cluster_check_success_seconds",
			Help: "Last time we successfully performed a cluster check as seconds since unix epoch",
		},
	)
	// These metrics will be provided by the collector. They represent values
	// that shouldn't be updated as part of the sentinel code, but should be
	// gathered just prior to providing Prometheus with a measurement.
	isLeaderDesc = prometheus.NewDesc(
		"stolon_sentinel_is_leader",
		"Set to 1 if the sentinel is currently a leader",
		[]string{},
		nil,
	)
	leaderCountDesc = prometheus.NewDesc(
		"stolon_sentinel_leader_count",
		"Number of times this sentinel has been elected as leader",
		[]string{},
		nil,
	)
)

// Register the static methods on the default Prometheus registry automatically
func init() {
	prometheus.MustRegister(lastCheckSuccessSeconds)
}

func mustRegisterSentinelCollector(s *Sentinel) {
	prometheus.MustRegister(
		sentinelCollector{s},
	)
}

type sentinelCollector struct {
	*Sentinel
}

func (c sentinelCollector) Describe(ch chan<- *prometheus.Desc) {
	prometheus.DescribeByCollect(c, ch)
}

func (c sentinelCollector) Collect(ch chan<- prometheus.Metric) {
	var isLeaderValue float64
	isLeader, leaderCount := c.Sentinel.leaderInfo()
	if isLeader {
		isLeaderValue = 1
	}

	ch <- prometheus.MustNewConstMetric(isLeaderDesc, prometheus.GaugeValue, isLeaderValue)
	ch <- prometheus.MustNewConstMetric(leaderCountDesc, prometheus.GaugeValue, float64(leaderCount))
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #885** (2022-10-04): **Multiple vulnerabilities found in [Stolon:master-pg14] during JFrog scan.**
  *Symptoms*: <!-- **NOTE:** Please submit only bug reports. For other questions or if unsure ask on the [Stolon Forum](https://talk.stolon.io)  -->   **What happened**: Hi, we've faced several security issues when scanning the Stolon (master-pg14) with JFrog X-Ray. There were **27 critical** security issues, the rest were high, medium and low.  **What you expected to happen**: Expected was minimal security issues while the JFrog scan.  **How to reproduce it (as minimally and precisely as possible)**: Just scanning Stolon:master-pg14 with JFrog Xray.  **Anything else we need to know?**: We request you to fix the issues as we have to move our project to the production stage.  **Environment**: - Stolon version: master-pg14 - Stolon running environment (if useful to understand the bug): Kubernetes - Others:  - ScreenShot: ![image](https://user-images.githubusercontent.com/83944925/186094266-aff6c2bc-724d-4778-a212-b13e2b6ef282.png) - JFrog Report: [Stolon_master-pg14_Security_Export.csv](https://github.com/sorintlab/stolon/files/9400191/Stolon_master-pg14_Security_Export.csv)  
  **Post-Mortem & Fix Analysis**:
  > @HimanshuPanwarSF As stated in the documentation the image is just an example image built after a release since we don't have time to also maintain all possible images. Just build your preferred images.

- **Issue #839** (2021-07-29): **Issue trying to setup multinode cluster**
  *Symptoms*: <!--  Please use this template while reporting a bug and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!  **NOTE:** Please submit only bug reports. For other question or if unsure ask on the [Stolon Forum](https://talk.stolon.io)  -->   **What happened**: Getting eror pg_basebackup: could not connect to server: connection closed Is the server running on host "127.0.0.1" and accepting TCP/IP connections on 5432? keeper failed to resync from followed instance (node1)   **How to reproduce it (as minimally and precisely as possible)**: - 3 ubuntu vms: 1 etcd cluster, 3 nodes. stolon v16, postgres v11 - able to join 3 nodes to the same etcd cluster - able to successfully set up node 1 following simple cluster lab - for nodes 2 and 3, I was able to join sentinels and keepers successfully from both nodes. BUT keepers had error msgs even after joining to the same stolon cluster - 1. Getting eror pg_basebackup: could not connect to server: connection closed Is the server running on host "127.0.0.1" and accepting TCP/IP connections on 5432? keeper failed to resync from followed instance (node1) 2. output of stolonctl status: nodes 2 and 3 had HEALTHY = true, but PG HEALTHY = false  command to join keepers to stolon cluster for nodes 2 and 3; uid will be unique, pg-su-username same for all 3 keepers, po port unique per node: stolon-keeper --cluster-name stolon-cluster --store-backend=etcdv3 -

- **Issue #837** (2021-05-18): **Point-in-time recovery doesn't work with recoveryTargetTime**
  *Symptoms*: **What happened**:  ``` archive_command = wal-g wal-push %p archive_mode = on archive_timeout = 2min ```  I'm writing every 5 seconds to database, drop it and trying to restore using pitr. * It works great when I don't specify recoveryTargetTime, I can see the latest data in a restored table * It doesn't restore to point-in-time if I specify recoveryTargetTime, I can see the data from latest full backup only (without applied WALs)  **What you expected to happen**: Data is restored up to recoveryTargetTime  **How to reproduce it (as minimally and precisely as possible)**: command I run  ``` stolonctl init '{ "initMode": "pitr", "pgParameters" : { "log_min_messages": "LOG" }, "pitrConfig": { "recoveryTargetSettings": {"recoveryTargetTime": "2021-05-17 14:50:31+00"}, "dataRestoreCommand": "wal-g backup-fetch %d LATEST", "archiveRecoverySettings": { "restoreCommand": "wal-g wal-fetch \"%f\" \"%p\"" }}}' --cluster-name=test-cluster --store-backend=consul --store-endpoints=consul-server.consul:8500 --store-prefix=test/cluster ```   ``` 2021-05-17T15:16:41.701Z	INFO	cmd/keeper.go:1243	executing DataRestoreCommand INFO: 2021/05/17 15:16:42.120986 LATEST backup is: 'base_00000004000000000000001B' INFO: 2021/05/17 15:16:42.217424 Finished decompression of part_003.tar.lz4 INFO: 2021/05/17 15:16:42.217450 Finished extraction of part_003.tar.lz4 INFO: 2021/05/17 15:16:44.765843 Finished extraction of part_001.tar.lz4 INFO: 2021/05/17 15:16:44.765920 Finished 
  **Post-Mortem & Fix Analysis**:
  > Latest record I see from this was writter around 07:43  ``` 2021-05-17 15:16:58.208 UTC [3357] LOG:  last completed transaction was at log time 2021-05-17 07:43:56.401074+00 ```  so it looks like WALs were not applied at all in this case.  ``` root@stolon-keeper-1:/# cat /stolon-data/postgres/recovery.done restore_command = 'wal-g wal-fetch "%f" "%p"' recovery_target_time = '2021-05-17 15:11:27+00' recovery_target_action = 'promote' ```
  > sorry, reproduced an issue without stolon

- **Issue #826** (2021-03-15): **Stolon proxy is flapping ip address of master after docker upgrade**
  *Symptoms*: First of all sorry but https://talk.stolon.io last updated 20 may 2020 (General discussion - most probable place for my issue there).  **What happened**: after docker upgrade from 19.03.13 to 20.10.5 on docker swarm cluster (stolon and etcd are running there as two stacks) proxy becomes flapping between two ip addresses. First address is master keeper addres and the second ip address is a master keeper service address. Both lead to the same postgres instance but when proxy is flapping then it drops existing client connections. Here is a part docker proxy log:  2021-03-11T08:57:53.455Z INFO cmd/proxy.go:268 master address {“address”: “10.0.17.93:5432”} 2021-03-11T08:57:53.499Z INFO cmd/proxy.go:286 proxying to master address {“address”: “10.0.17.93:5432”} 2021-03-11T08:57:58.525Z INFO cmd/proxy.go:268 master address {“address”: “10.0.17.57:5432”} 2021-03-11T08:57:58.580Z INFO cmd/proxy.go:286 proxying to master address {“address”: “10.0.17.57:5432”} 2021-03-11T08:58:03.586Z INFO cmd/proxy.go:268 master address {“address”: “10.0.17.93:5432”} 2021-03-11T08:58:04.052Z INFO cmd/proxy.go:286 proxying to master address {“address”: “10.0.17.93:5432”} 2021-03-11T08:58:09.059Z INFO cmd/proxy.go:268 master address {“address”: “10.0.17.57:5432”} 2021-03-11T08:58:09.074Z INFO cmd/proxy.go:286 proxying to master address {“address”: “10.0.17.57:5432”}  **What you expected to happen**: Expected no flapping  **How to reproduce it (as minimally and precisely as possible)**: upgra
  **Post-Mortem & Fix Analysis**:
  > For Your Information:  Rollback to docker 19.03.15 resolved this issue. Now proxy wants to use keeper service ip address only (logs show ip address of corresponding docker swarm service and not the keeper's container ip address).  Something was changed in docker 20.10.5 about networking.
  > > First of all sorry but https://talk.stolon.io last updated 20 may 2020 (General discussion - most probable place for my issue there).  Open a discussion here so the last update time will change :smile:   Anyway I'm not sure this is something related to stolon.

- **Issue #824** (2021-02-28): **Bus error (core dumped) with hugepage in k8s.**
  *Symptoms*: <!--  Please use this template while reporting a bug and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!  **NOTE:** Please submit only bug reports. For other question or if unsure ask on the [Stolon Forum](https://talk.stolon.io)  -->   **What happened**:  **What you expected to happen**:  **How to reproduce it (as minimally and precisely as possible)**:  **Anything else we need to know?**:  **Environment**: - Stolon version: - Stolon running environment (if useful to understand the bug): - Others: 
  **Post-Mortem & Fix Analysis**:
  > @271560sj Please use the provided issue template. Though I can't understand how this could be a stolon issue.

- **Issue #816** (2021-03-15): **Stolon components fail with an error: unexpected signal during runtime execution**
  *Symptoms*: **What happened**: We have Stolon with Consul as storage backend. Stolon components run as systemd services. After upgrading from v.0.13.0 to v.0.16.0 the Stolon components periodically fail.  <details> <summary>Log example stolon-keeper:</summary>      stolon-keeper: panic: runtime error: invalid memory address or nil pointer dereference     stolon-keeper: [signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x46c9f5]     stolon-keeper: goroutine 339682 [running]:     stolon-keeper: sync.poolCleanup()     stolon-keeper: /usr/local/go/src/sync/pool.go:242 +0x45     stolon-keeper: github.com/davecgh/go-spew/spew.(*dumpState).dumpPtr(0xc00077b250, 0x154bce0, 0xc000461200, 0x196)     stolon-keeper: /home/sgotti/go/pkg/mod/github.com/davecgh/go-spew@v1.1.1/spew/dump.go:128 +0x45b     stolon-keeper: github.com/davecgh/go-spew/spew.(*dumpState).dump(0xc00077b250, 0x154bce0, 0xc000461200, 0x196)     stolon-keeper: /home/sgotti/go/pkg/mod/github.com/davecgh/go-spew@v1.1.1/spew/dump.go:262 +0x184e     stolon-keeper: github.com/davecgh/go-spew/spew.(*dumpState).dump(0xc00077b250, 0x17161a0, 0xc0004611d0, 0x199)     stolon-keeper: /home/sgotti/go/pkg/mod/github.com/davecgh/go-spew@v1.1.1/spew/dump.go:421 +0xdc1     stolon-keeper: github.com/davecgh/go-spew/spew.(*dumpState).dumpPtr(0xc00077b250, 0x154bc60, 0xc0004611d0, 0x16)     stolon-keeper: /home/sgotti/go/pkg/mod/github.com/davecgh/go-spew@v1.1.1/spew/dump.go:154 +0x719     stolon-keeper: github.com/dav
  **Post-Mortem & Fix Analysis**:
  > @woblerr   The first segfaul looks like it's related to go spew so I imagine you're running stolon with debug mode enabled.  The last two errors are  a golang runtime error so not related to stolon. Have you compiled stolon by yourself or are you using the provided binary or example image (in such case we should rebuild stolon with a new go version)?
  > @sgotti , thanks for reply.  We use the provided binaries from release builds.
  > @sgotti   We built stolon components with go 1.15.6 from current master branch (using  the command  `make` according to  documentation).  Problem is still reproducing and repeating on hosts with Intel Optane RAM. At the moment stolon components are running without debug mode.  The errors occur on different components at different times. The other components continue to work.  Some more logs with  errors. <details> <summary>Log stolon-keeper example 1:</summary>      stolon-keeper: runtime: gp: gp=0xc00090e780, goid=0, gp->atomicstatus=0     stolon-keeper: runtime:  g:  g=0xc00071a180, goid=0,  g->atomicstatus=0     stolon-keeper: fatal error: invalid g status     stolon-keeper: runtime stack:     stolon-keeper: runtime.throw(0x1813998, 0x10)     stolon-keeper: /usr/local/go/src/runtime/panic.go:1116 +0x72     stolon-keeper: runtime.suspendG(0xc00090e780, 0x0, 0x1)     stolon-keeper: /usr/local/go/src/runtime/preempt.go:140 +0x5d0     stolon-keeper: runtime.markroot.

- **Issue #803** (2020-11-03): **Stolon generates unsupported wal_keep_segments settings**
  *Symptoms*: **What happened**: When run with PostgreSQL 13, Stolon can't init cluster as it generates config with `wal_keep_segment`  parameters, but it was dropped, `wal_keep_size` should be used instead.  **What you expected to happen**: Stolon should detect necessary setting, for example, based on PostgreSQL version, or trying to invoke postgres with specified parameters.
  **Post-Mortem & Fix Analysis**:
  > Created Posgres13 support issue #807. Pull Requests are welcome!

- **Issue #802** (2020-10-14): **cannot set STKEEPER_PG_LISTEN_ADDRESS to ***
  *Symptoms*: <!--  Please use this template while reporting a bug and provide as much info as possible. Not doing so may result in your bug not being addressed in a timely manner. Thanks!  **NOTE:** Please submit only bug reports. For other question or if unsure ask on the [Stolon Forum](https://talk.stolon.io)  -->   **What happened**: I am deploying the stolon helm chart with istio proxy sidecar injection enabled. As per istio documentation [here](https://istio.io/latest/faq/applications/) we need to set the listen address to * so that clients can connect to the database. To do that I set the environment variable ```STKEEPER_PG_LISTEN_ADDRESS  *``` The keeper however still continues to listen to the $POD_IP.  ```     Ports:         8080/TCP, 5432/TCP     Host Ports:    0/TCP, 0/TCP     Command:       /bin/bash       -ec       # Generate our keeper uid using the pod index       IFS='-' read -ra ADDR <<< "$(hostname)"       export STKEEPER_UID="keeper${ADDR[-1]}"       export POD_IP=$(hostname -i)       export STKEEPER_PG_LISTEN_ADDRESS=$POD_IP       export STOLON_DATA=/stolon-data       chown stolon:stolon $STOLON_DATA       exec gosu stolon stolon-keeper --data-dir $STOLON_DATA      State:          Running       Started:      Wed, 14 Oct 2020 16:26:12 +0530     Ready:          True     Restart Count:  0     Environment:       POD_NAME:                         empirix-stolon-keeper-0 (v1:metadata.name)       STKEEPER_CLUSTER_NAME:            empirix-stolon
  **Post-Mortem & Fix Analysis**:
  > sorry wrong place to open defect. will open with the helm chart project.

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

### Incident Patch 1: `4bb41075` (2022-10-20)
**Commit Message**: Merge pull request #894 from ghiyastfarisi/fix/rbac-beta

Update rbac apiVersion for k8s deployment

**File**: `examples/kubernetes/role-binding.yaml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-apiVersion: rbac.authorization.k8s.io/v1beta1
+apiVersion: rbac.authorization.k8s.io/v1
 kind: RoleBinding
 metadata:
   name: stolon
```

**File**: `examples/kubernetes/role.yaml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 # sentinel/stolonctl: list components pods
 # sentinel/stolonctl: get components pods annotations
 
-apiVersion: rbac.authorization.k8s.io/v1beta1
+apiVersion: rbac.authorization.k8s.io/v1
 kind: Role
 metadata:
   name: stolon
```

---

### Incident Patch 2: `1551f114` (2022-10-18)
**Commit Message**: Merge pull request #876 from Klarrio/fix/GO-2020-0018

Switch uuid package to get around GO-2020-0018

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -7,14 +7,14 @@ require (
 	github.com/docker/leadership v0.1.0
 	github.com/docker/libkv v0.2.1
 	github.com/evanphx/json-patch v4.5.0+incompatible
+	github.com/gofrs/uuid v4.2.0+incompatible
 	github.com/golang/mock v1.4.0
 	github.com/google/go-cmp v0.4.0
 	github.com/hashicorp/consul/api v1.4.0
 	github.com/lib/pq v1.3.0
 	github.com/mattn/go-isatty v0.0.12
 	github.com/mitchellh/copystructure v1.0.0
 	github.com/prometheus/client_golang v1.4.1
-	github.com/satori/go.uuid v1.2.0
 	github.com/sgotti/gexpect v0.0.0-20210315095146-1ec64e69809b
 	github.com/sorintlab/pollon v0.0.0-20181009091703-248c68238c16
 	github.com/spf13/cobra v0.0.5
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -94,6 +94,8 @@ github.com/go-openapi/jsonreference v0.0.0-20160704190145-13c6e3589ad9/go.mod h1
 github.com/go-openapi/spec v0.0.0-20160808142527-6aced65f8501/go.mod h1:J8+jY1nAiCcj+friV/PDoE1/3eeccG9LYBs0tYvLOWc=
 github.com/go-openapi/swag v0.0.0-20160704191624-1d0bd113de87/go.mod h1:DXUve3Dpr1UfpPtxFw+EFuQ41HhCWZfha5jSVRG7C7I=
 github.com/go-stack/stack v1.8.0/go.mod h1:v0f6uXyyMGvRgIKkXu+yp6POWl0qKG85gN/melR3HDY=
+github.com/gofrs/uuid v4.2.0+incompatible h1:yyYWMnhkhrKwwr8gAOcOCYxOOscHgDS9yZgBrnJfGa0=
+github.com/gofrs/uuid v4.2.0+incompatible/go.mod h1:b2aQJv3Z4Fp6yNu3cdSllBxTCLRxnplIgP/c0N/04lM=
 github.com/gogo/protobuf v1.1.1/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7atdtwQ=
 github.com/gogo/protobuf v1.2.1/go.mod h1:hp+jE20tsWTFYpLwKvXlhS1hjn+gTNwPg2I6zVXpSg4=
 github.com/gogo/protobuf v1.2.2-0.20190723190241-65acae22fc9d h1:3PaI8p3seN09VjbTYC/QWlUZdZ1qS1zGjy7LH2Wt07I=
@@ -290,8 +292,6 @@ github.com/rogpeppe/go-internal v1.3.0/go.mod h1:M8bDsm7K2OlrFYOpmOWEs/qY81heoFR
 github.com/russross/blackfriday v1.5.2 h1:HyvC0ARfnZBqnXwABFeSZHpKvJHJJfPz81GNueLj0oo=
 github.com/russross/blackfriday v1.5.2/go.mod h1:JO/DiYxRf+HjHt06OyowR9PTA263kcR/rfWxYHBV53g=
 github.com/ryanuber/columnize v0.0.0-20160712163229-9b3edd62028f/go.mod h1:sm1tb6uqfes/u+d4ooFouqFdy9/2g9QGwK3SQygK0Ts=
-github.com/satori/go.uuid v1.2.0 h1:0uYX9dsZ2yD7q2RtLRtPSdGDWzjeM3TbMJP9utgA0ww=
-github.com/satori/go.uuid v1.2.0/go.mod h1:dA0hQrYB0VpLJoorglMZABFdXlWrHn1NEOzdhQKdks0=
 github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 h1:nn5Wsu0esKSJiIVhscUtVbo7ada43DJhG55ua/hjS5I=
 github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529/go.mod h1:DxrIzT+xaE7yg65j358z/aeFdxmN0P9QXhEzd20vsDc=
 github.com/sgotti/gexpect v0.0.0-20210315095146-1ec64e69809b h1:rGT0mqolw5UvjfByF0vWfFEhtL7Hn6P7dNKz7iHBMdA=
```

**File**: `internal/common/common.go` (modified, +3/-3)
```diff
@@ -23,7 +23,7 @@ import (
 	"reflect"
 	"strings"
 
-	"github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 )
 
 const (
@@ -50,12 +50,12 @@ var Roles = []Role{
 }
 
 func UID() string {
-	u := uuid.NewV4()
+	u := uuid.Must(uuid.NewV4())
 	return fmt.Sprintf("%x", u[:4])
 }
 
 func UUID() string {
-	return uuid.NewV4().String()
+	return uuid.Must(uuid.NewV4()).String()
 }
 
 const (
```

**File**: `tests/integration/config_test.go` (modified, +8/-8)
```diff
@@ -27,7 +27,7 @@ import (
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 )
 
 func TestServerParameters(t *testing.T) {
@@ -52,7 +52,7 @@ func TestServerParameters(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -149,7 +149,7 @@ func TestWalLevel(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -264,7 +264,7 @@ func TestWalKeepSegments(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -437,7 +437,7 @@ func TestAlterSystem(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -509,7 +509,7 @@ func TestAdditionalReplicationSlots(t *testing.T) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, false, false, nil)
 	defer shutdown(tks, tss, tp, tstore)
@@ -658,7 +658,7 @@ func TestAutomaticPgRestart(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -782,7 +782,7 @@ func TestAdvertise(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
```

**File**: `tests/integration/ha_test.go` (modified, +25/-25)
```diff
@@ -26,7 +26,7 @@ import (
 	"testing"
 	"time"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 	"github.com/sorintlab/stolon/internal/cluster"
 	"github.com/sorintlab/stolon/internal/common"
 	pg "github.com/sorintlab/stolon/internal/postgresql"
@@ -70,7 +70,7 @@ func TestInitWithMultipleKeepers(t *testing.T) {
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -333,7 +333,7 @@ func testMasterStandby(t *testing.T, syncRepl bool) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, false, nil)
 	defer shutdown(tks, tss, tp, tstore)
@@ -388,7 +388,7 @@ func testFailover(t *testing.T, syncRepl bool, standbyCluster bool) {
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -397,7 +397,7 @@ func testFailover(t *testing.T, syncRepl bool, standbyCluster bool) {
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, false, ptk)
 	defer shutdown(tks, tss, tp, tstore)
@@ -499,7 +499,7 @@ func testFailoverFailed(t *testing.T, syncRepl bool, standbyCluster bool) {
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -508,7 +508,7 @@ func testFailoverFailed(t *testing.T, syncRepl bool, standbyCluster bool) {
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, false, ptk)
 	defer shutdown(tks, tss, tp, tstore)
@@ -611,7 +611,7 @@ func testFailoverTooMuchLag(t *testing.T, standbyCluster bool) {
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -620,7 +620,7 @@ func testFailoverTooMuchLag(t *testing.T, standbyCluster bool) {
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, false, false, ptk)
 	defer shutdown(tks, tss, tp, tstore)
@@ -690,7 +690,7 @@ func testOldMasterRestart(t *testing.T, syncRepl, minSync0 bool, usePgrewind boo
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -699,7 +699,7 @@ func testOldMasterRestart(t *testing.T, syncRepl, minSync0 bool, usePgrewind boo
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	specOptions := []optionSetter{
 		withMinSync0(minSync0),
@@ -844,7 +844,7 @@ func testPartition1(t *testing.T, syncRepl, minSync0, usePgrewind bool, standbyC
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -853,7 +853,7 @@ func testPartition1(t *testing.T, syncRepl, minSync0, usePgrewind bool, standbyC
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	specOptions := []optionSetter{
 		withMinSync0(minSync0),
@@ -1010,7 +1010,7 @@ func testTimelineFork(t *testing.T, syncRepl, usePgrewind bool) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, usePgrewind, nil)
 	defer shutdown(tks, tss, tp, tstore)
@@ -1206,7 +1206,7 @@ func t
```

**File**: `tests/integration/init_test.go` (modified, +12/-12)
```diff
@@ -23,7 +23,7 @@ import (
 	"testing"
 	"time"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 	"github.com/sorintlab/stolon/internal/cluster"
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
@@ -43,7 +43,7 @@ func TestInit(t *testing.T) {
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	initialClusterSpec := &cluster.ClusterSpec{
 		InitMode:           cluster.ClusterInitModeP(cluster.ClusterInitModeNew),
@@ -92,7 +92,7 @@ func TestInitNewNoMerge(t *testing.T) {
 }
 
 func testInitNew(t *testing.T, merge bool) {
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	dir, err := ioutil.TempDir("", "")
 	if err != nil {
@@ -171,7 +171,7 @@ func TestInitExistingNoMerge(t *testing.T) {
 }
 
 func testInitExisting(t *testing.T, merge bool) {
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	dir, err := ioutil.TempDir("", "")
 	if err != nil {
@@ -317,7 +317,7 @@ func TestInitUsers(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
 	// Test pg-repl-username == pg-su-username but password different
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 	tk, err := NewTestKeeper(t, dir, clusterName, "user01", "password01", "user01", "password02", tstore.storeBackend, storeEndpoints)
 	if err != nil {
 		t.Fatalf("unexpected err: %v", err)
@@ -331,7 +331,7 @@ func TestInitUsers(t *testing.T) {
 	}
 
 	// Test pg-repl-username == pg-su-username
-	clusterName = uuid.NewV4().String()
+	clusterName = uuid.Must(uuid.NewV4()).String()
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
 	sm := store.NewKVBackedStore(tstore.store, storePath)
@@ -374,7 +374,7 @@ func TestInitUsers(t *testing.T) {
 	}
 
 	// Test pg-repl-username != pg-su-username and pg-su-password defined
-	clusterName = uuid.NewV4().String()
+	clusterName = uuid.Must(uuid.NewV4()).String()
 	storePath = filepath.Join(common.StorePrefix, clusterName)
 
 	sm = store.NewKVBackedStore(tstore.store, storePath)
@@ -420,7 +420,7 @@ func TestInitialClusterSpec(t *testing.T) {
 	tstore := setupStore(t, dir)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	storePath := filepath.Join(common.StorePrefix, clusterName)
@@ -484,9 +484,9 @@ func TestExclusiveLock(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
-	u := uuid.NewV4()
+	u := uuid.Must(uuid.NewV4())
 	id := fmt.Sprintf("%x", u[:4])
 
 	tk1, err := NewTestKeeperWithID(t, dir, id, clusterName, pgSUUsername, pgSUPassword, pgReplUsername, pgReplPassword, tstore.storeBackend, storeEndpoints)
@@ -540,9 +540,9 @@ func TestPasswordTrailingNewLine(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
-	u := uuid.NewV4()
+	u := uuid.Must(uuid.NewV4())
 	id := fmt.Sprintf("%x", u[:4])
 
 	pgSUPassword := "stolon_superuserpassword\n"
```

**File**: `tests/integration/pitr_test.go` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ import (
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 )
 
 func TestPITR(t *testing.T) {
@@ -64,7 +64,7 @@ func testPITR(t *testing.T, recoveryTarget bool) {
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
```

**File**: `tests/integration/proxy_test.go` (modified, +2/-3)
```diff
@@ -24,11 +24,10 @@ import (
 	"testing"
 	"time"
 
+	"github.com/gofrs/uuid"
 	"github.com/sorintlab/stolon/internal/cluster"
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
-
-	"github.com/satori/go.uuid"
 )
 
 func TestProxyListening(t *testing.T) {
@@ -40,7 +39,7 @@ func TestProxyListening(t *testing.T) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tstore, err := NewTestStore(t, dir)
 	if err != nil {
```

---

### Incident Patch 3: `250379d5` (2022-10-18)
**Commit Message**: Merge branch 'master' into fix/GO-2020-0018

**File**: `README.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 
 stolon is a cloud native PostgreSQL manager for PostgreSQL high availability. It's cloud native because it'll let you keep an high available PostgreSQL inside your containers (kubernetes integration) but also on every other kind of infrastructure (cloud IaaS, old style infrastructures etc...)
 
-For an introduction to stolon you can also take a look at [this post](https://sgotti.me/post/stolon-introduction/)
+For an introduction to stolon you can also take a look at [this post](https://sgotti.dev/post/stolon-introduction/)
 
 ## Features
 
```

---

### Incident Patch 4: `07d7df75` (2022-10-05)
**Commit Message**: fix: update rbac apiVersion

**File**: `examples/kubernetes/role-binding.yaml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-apiVersion: rbac.authorization.k8s.io/v1beta1
+apiVersion: rbac.authorization.k8s.io/v1
 kind: RoleBinding
 metadata:
   name: stolon
```

**File**: `examples/kubernetes/role.yaml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 # sentinel/stolonctl: list components pods
 # sentinel/stolonctl: get components pods annotations
 
-apiVersion: rbac.authorization.k8s.io/v1beta1
+apiVersion: rbac.authorization.k8s.io/v1
 kind: Role
 metadata:
   name: stolon
```

---

### Incident Patch 5: `a24c83d4` (2022-08-24)
**Commit Message**: fix: outdated domain sgotti.me replaced by sgotti.dev

**File**: `README.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 
 stolon is a cloud native PostgreSQL manager for PostgreSQL high availability. It's cloud native because it'll let you keep an high available PostgreSQL inside your containers (kubernetes integration) but also on every other kind of infrastructure (cloud IaaS, old style infrastructures etc...)
 
-For an introduction to stolon you can also take a look at [this post](https://sgotti.me/post/stolon-introduction/)
+For an introduction to stolon you can also take a look at [this post](https://sgotti.dev/post/stolon-introduction/)
 
 ## Features
 
```

---

### Incident Patch 6: `d7bdffc0` (2022-05-25)
**Commit Message**: Switch uuid package to get around GO-2020-0018

Replace the github.com/satori/go.uuid package with the github.com/gofrs/uuid
package to work around the GO-2020-0018 vulnerability.
The vulnerability is fixed in https://github.com/satori/go.uuid/pull/75,
but a release has never been tagged.

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -7,14 +7,14 @@ require (
 	github.com/docker/leadership v0.1.0
 	github.com/docker/libkv v0.2.1
 	github.com/evanphx/json-patch v4.5.0+incompatible
+	github.com/gofrs/uuid v4.2.0+incompatible
 	github.com/golang/mock v1.4.0
 	github.com/google/go-cmp v0.4.0
 	github.com/hashicorp/consul/api v1.4.0
 	github.com/lib/pq v1.3.0
 	github.com/mattn/go-isatty v0.0.12
 	github.com/mitchellh/copystructure v1.0.0
 	github.com/prometheus/client_golang v1.4.1
-	github.com/satori/go.uuid v1.2.0
 	github.com/sgotti/gexpect v0.0.0-20210315095146-1ec64e69809b
 	github.com/sorintlab/pollon v0.0.0-20181009091703-248c68238c16
 	github.com/spf13/cobra v0.0.5
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -94,6 +94,8 @@ github.com/go-openapi/jsonreference v0.0.0-20160704190145-13c6e3589ad9/go.mod h1
 github.com/go-openapi/spec v0.0.0-20160808142527-6aced65f8501/go.mod h1:J8+jY1nAiCcj+friV/PDoE1/3eeccG9LYBs0tYvLOWc=
 github.com/go-openapi/swag v0.0.0-20160704191624-1d0bd113de87/go.mod h1:DXUve3Dpr1UfpPtxFw+EFuQ41HhCWZfha5jSVRG7C7I=
 github.com/go-stack/stack v1.8.0/go.mod h1:v0f6uXyyMGvRgIKkXu+yp6POWl0qKG85gN/melR3HDY=
+github.com/gofrs/uuid v4.2.0+incompatible h1:yyYWMnhkhrKwwr8gAOcOCYxOOscHgDS9yZgBrnJfGa0=
+github.com/gofrs/uuid v4.2.0+incompatible/go.mod h1:b2aQJv3Z4Fp6yNu3cdSllBxTCLRxnplIgP/c0N/04lM=
 github.com/gogo/protobuf v1.1.1/go.mod h1:r8qH/GZQm5c6nD/R0oafs1akxWv10x8SbQlK7atdtwQ=
 github.com/gogo/protobuf v1.2.1/go.mod h1:hp+jE20tsWTFYpLwKvXlhS1hjn+gTNwPg2I6zVXpSg4=
 github.com/gogo/protobuf v1.2.2-0.20190723190241-65acae22fc9d h1:3PaI8p3seN09VjbTYC/QWlUZdZ1qS1zGjy7LH2Wt07I=
@@ -290,8 +292,6 @@ github.com/rogpeppe/go-internal v1.3.0/go.mod h1:M8bDsm7K2OlrFYOpmOWEs/qY81heoFR
 github.com/russross/blackfriday v1.5.2 h1:HyvC0ARfnZBqnXwABFeSZHpKvJHJJfPz81GNueLj0oo=
 github.com/russross/blackfriday v1.5.2/go.mod h1:JO/DiYxRf+HjHt06OyowR9PTA263kcR/rfWxYHBV53g=
 github.com/ryanuber/columnize v0.0.0-20160712163229-9b3edd62028f/go.mod h1:sm1tb6uqfes/u+d4ooFouqFdy9/2g9QGwK3SQygK0Ts=
-github.com/satori/go.uuid v1.2.0 h1:0uYX9dsZ2yD7q2RtLRtPSdGDWzjeM3TbMJP9utgA0ww=
-github.com/satori/go.uuid v1.2.0/go.mod h1:dA0hQrYB0VpLJoorglMZABFdXlWrHn1NEOzdhQKdks0=
 github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 h1:nn5Wsu0esKSJiIVhscUtVbo7ada43DJhG55ua/hjS5I=
 github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529/go.mod h1:DxrIzT+xaE7yg65j358z/aeFdxmN0P9QXhEzd20vsDc=
 github.com/sgotti/gexpect v0.0.0-20210315095146-1ec64e69809b h1:rGT0mqolw5UvjfByF0vWfFEhtL7Hn6P7dNKz7iHBMdA=
```

**File**: `internal/common/common.go` (modified, +3/-3)
```diff
@@ -23,7 +23,7 @@ import (
 	"reflect"
 	"strings"
 
-	"github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 )
 
 const (
@@ -50,12 +50,12 @@ var Roles = []Role{
 }
 
 func UID() string {
-	u := uuid.NewV4()
+	u := uuid.Must(uuid.NewV4())
 	return fmt.Sprintf("%x", u[:4])
 }
 
 func UUID() string {
-	return uuid.NewV4().String()
+	return uuid.Must(uuid.NewV4()).String()
 }
 
 const (
```

**File**: `tests/integration/config_test.go` (modified, +8/-8)
```diff
@@ -27,7 +27,7 @@ import (
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 )
 
 func TestServerParameters(t *testing.T) {
@@ -52,7 +52,7 @@ func TestServerParameters(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -149,7 +149,7 @@ func TestWalLevel(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -264,7 +264,7 @@ func TestWalKeepSegments(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -437,7 +437,7 @@ func TestAlterSystem(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -509,7 +509,7 @@ func TestAdditionalReplicationSlots(t *testing.T) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, false, false, nil)
 	defer shutdown(tks, tss, tp, tstore)
@@ -658,7 +658,7 @@ func TestAutomaticPgRestart(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -782,7 +782,7 @@ func TestAdvertise(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
```

**File**: `tests/integration/ha_test.go` (modified, +25/-25)
```diff
@@ -26,7 +26,7 @@ import (
 	"testing"
 	"time"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 	"github.com/sorintlab/stolon/internal/cluster"
 	"github.com/sorintlab/stolon/internal/common"
 	pg "github.com/sorintlab/stolon/internal/postgresql"
@@ -70,7 +70,7 @@ func TestInitWithMultipleKeepers(t *testing.T) {
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
@@ -333,7 +333,7 @@ func testMasterStandby(t *testing.T, syncRepl bool) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, false, nil)
 	defer shutdown(tks, tss, tp, tstore)
@@ -388,7 +388,7 @@ func testFailover(t *testing.T, syncRepl bool, standbyCluster bool) {
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -397,7 +397,7 @@ func testFailover(t *testing.T, syncRepl bool, standbyCluster bool) {
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, false, ptk)
 	defer shutdown(tks, tss, tp, tstore)
@@ -499,7 +499,7 @@ func testFailoverFailed(t *testing.T, syncRepl bool, standbyCluster bool) {
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -508,7 +508,7 @@ func testFailoverFailed(t *testing.T, syncRepl bool, standbyCluster bool) {
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, false, ptk)
 	defer shutdown(tks, tss, tp, tstore)
@@ -611,7 +611,7 @@ func testFailoverTooMuchLag(t *testing.T, standbyCluster bool) {
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -620,7 +620,7 @@ func testFailoverTooMuchLag(t *testing.T, standbyCluster bool) {
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, false, false, ptk)
 	defer shutdown(tks, tss, tp, tstore)
@@ -690,7 +690,7 @@ func testOldMasterRestart(t *testing.T, syncRepl, minSync0 bool, usePgrewind boo
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -699,7 +699,7 @@ func testOldMasterRestart(t *testing.T, syncRepl, minSync0 bool, usePgrewind boo
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	specOptions := []optionSetter{
 		withMinSync0(minSync0),
@@ -844,7 +844,7 @@ func testPartition1(t *testing.T, syncRepl, minSync0, usePgrewind bool, standbyC
 	var ptk *TestKeeper
 	var primary *TestKeeper
 	if standbyCluster {
-		primaryClusterName := uuid.NewV4().String()
+		primaryClusterName := uuid.Must(uuid.NewV4()).String()
 		ptks, ptss, ptp, ptstore := setupServers(t, primaryClusterName, dir, 1, 1, false, false, nil)
 		defer shutdown(ptks, ptss, ptp, ptstore)
 		for _, ptk = range ptks {
@@ -853,7 +853,7 @@ func testPartition1(t *testing.T, syncRepl, minSync0, usePgrewind bool, standbyC
 		primary = ptk
 	}
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	specOptions := []optionSetter{
 		withMinSync0(minSync0),
@@ -1010,7 +1010,7 @@ func testTimelineFork(t *testing.T, syncRepl, usePgrewind bool) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tks, tss, tp, tstore := setupServers(t, clusterName, dir, 2, 1, syncRepl, usePgrewind, nil)
 	defer shutdown(tks, tss, tp, tstore)
@@ -1206,7 +1206,7 @@ func t
```

**File**: `tests/integration/init_test.go` (modified, +12/-12)
```diff
@@ -23,7 +23,7 @@ import (
 	"testing"
 	"time"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 	"github.com/sorintlab/stolon/internal/cluster"
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
@@ -43,7 +43,7 @@ func TestInit(t *testing.T) {
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	initialClusterSpec := &cluster.ClusterSpec{
 		InitMode:           cluster.ClusterInitModeP(cluster.ClusterInitModeNew),
@@ -92,7 +92,7 @@ func TestInitNewNoMerge(t *testing.T) {
 }
 
 func testInitNew(t *testing.T, merge bool) {
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	dir, err := ioutil.TempDir("", "")
 	if err != nil {
@@ -171,7 +171,7 @@ func TestInitExistingNoMerge(t *testing.T) {
 }
 
 func testInitExisting(t *testing.T, merge bool) {
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	dir, err := ioutil.TempDir("", "")
 	if err != nil {
@@ -317,7 +317,7 @@ func TestInitUsers(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
 	// Test pg-repl-username == pg-su-username but password different
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 	tk, err := NewTestKeeper(t, dir, clusterName, "user01", "password01", "user01", "password02", tstore.storeBackend, storeEndpoints)
 	if err != nil {
 		t.Fatalf("unexpected err: %v", err)
@@ -331,7 +331,7 @@ func TestInitUsers(t *testing.T) {
 	}
 
 	// Test pg-repl-username == pg-su-username
-	clusterName = uuid.NewV4().String()
+	clusterName = uuid.Must(uuid.NewV4()).String()
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
 	sm := store.NewKVBackedStore(tstore.store, storePath)
@@ -374,7 +374,7 @@ func TestInitUsers(t *testing.T) {
 	}
 
 	// Test pg-repl-username != pg-su-username and pg-su-password defined
-	clusterName = uuid.NewV4().String()
+	clusterName = uuid.Must(uuid.NewV4()).String()
 	storePath = filepath.Join(common.StorePrefix, clusterName)
 
 	sm = store.NewKVBackedStore(tstore.store, storePath)
@@ -420,7 +420,7 @@ func TestInitialClusterSpec(t *testing.T) {
 	tstore := setupStore(t, dir)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	storePath := filepath.Join(common.StorePrefix, clusterName)
@@ -484,9 +484,9 @@ func TestExclusiveLock(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
-	u := uuid.NewV4()
+	u := uuid.Must(uuid.NewV4())
 	id := fmt.Sprintf("%x", u[:4])
 
 	tk1, err := NewTestKeeperWithID(t, dir, id, clusterName, pgSUUsername, pgSUPassword, pgReplUsername, pgReplPassword, tstore.storeBackend, storeEndpoints)
@@ -540,9 +540,9 @@ func TestPasswordTrailingNewLine(t *testing.T) {
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 	defer tstore.Stop()
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
-	u := uuid.NewV4()
+	u := uuid.Must(uuid.NewV4())
 	id := fmt.Sprintf("%x", u[:4])
 
 	pgSUPassword := "stolon_superuserpassword\n"
```

**File**: `tests/integration/pitr_test.go` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ import (
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
 
-	uuid "github.com/satori/go.uuid"
+	"github.com/gofrs/uuid"
 )
 
 func TestPITR(t *testing.T) {
@@ -64,7 +64,7 @@ func testPITR(t *testing.T, recoveryTarget bool) {
 
 	storeEndpoints := fmt.Sprintf("%s:%s", tstore.listenAddress, tstore.port)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	storePath := filepath.Join(common.StorePrefix, clusterName)
 
```

**File**: `tests/integration/proxy_test.go` (modified, +2/-3)
```diff
@@ -24,11 +24,10 @@ import (
 	"testing"
 	"time"
 
+	"github.com/gofrs/uuid"
 	"github.com/sorintlab/stolon/internal/cluster"
 	"github.com/sorintlab/stolon/internal/common"
 	"github.com/sorintlab/stolon/internal/store"
-
-	"github.com/satori/go.uuid"
 )
 
 func TestProxyListening(t *testing.T) {
@@ -40,7 +39,7 @@ func TestProxyListening(t *testing.T) {
 	}
 	defer os.RemoveAll(dir)
 
-	clusterName := uuid.NewV4().String()
+	clusterName := uuid.Must(uuid.NewV4()).String()
 
 	tstore, err := NewTestStore(t, dir)
 	if err != nil {
```

---

### Incident Patch 7: `818081d5` (2021-03-16)
**Commit Message**: Merge pull request #828 from sgotti/etcdv3_add_timeouts

store: add etcdv3 timeouts

**File**: `internal/store/kvbacked.go` (modified, +5/-2)
```diff
@@ -183,8 +183,11 @@ func NewKVStore(cfg Config) (KVStore, error) {
 		return &libKVStore{store: store}, nil
 	case ETCDV3:
 		config := etcdclientv3.Config{
-			Endpoints: addrs,
-			TLS:       tlsConfig,
+			Endpoints:            addrs,
+			TLS:                  tlsConfig,
+			DialTimeout:          20 * time.Second,
+			DialKeepAliveTime:    1 * time.Second,
+			DialKeepAliveTimeout: cfg.Timeout,
 		}
 
 		c, err := etcdclientv3.New(config)
```

---

### Incident Patch 8: `e1bde06f` (2021-03-15)
**Commit Message**: store: add etcdv3 timeouts

Add dial timeout and keep alive timeout to the etcdv3 client configuration or
under some network problems (not tcp reset from server) the client will never
try other etcd endpoints.

**File**: `internal/store/kvbacked.go` (modified, +5/-2)
```diff
@@ -183,8 +183,11 @@ func NewKVStore(cfg Config) (KVStore, error) {
 		return &libKVStore{store: store}, nil
 	case ETCDV3:
 		config := etcdclientv3.Config{
-			Endpoints: addrs,
-			TLS:       tlsConfig,
+			Endpoints:            addrs,
+			TLS:                  tlsConfig,
+			DialTimeout:          20 * time.Second,
+			DialKeepAliveTime:    1 * time.Second,
+			DialKeepAliveTimeout: cfg.Timeout,
 		}
 
 		c, err := etcdclientv3.New(config)
```

---

### Incident Patch 9: `3f5d897b` (2021-02-06)
**Commit Message**: fix: small errors

**File**: `README.md` (modified, +2/-2)
```diff
@@ -20,11 +20,11 @@ For an introduction to stolon you can also take a look at [this post](https://sg
 * Uses a cluster store like [etcd](https://etcd.io), [consul](https://www.consul.io) or kubernetes API server as an high available data store and for leader election
 * Asynchronous (default) and [synchronous](doc/syncrepl.md) replication.
 * Full cluster setup in minutes.
-* Easy [cluster admininistration](doc/stolonctl.md)
+* Easy [cluster administration](doc/stolonctl.md)
 * Can do point in time recovery integrating with your preferred backup/restore tool.
 * [Standby cluster](doc/standbycluster.md) (for multi site replication and near zero downtime migration).
 * Automatic service discovery and dynamic reconfiguration (handles postgres and stolon processes changing their addresses).
-* Can use [pg_rewind](doc/pg_rewind.md) for fast instance resyncronization with current master.
+* Can use [pg_rewind](doc/pg_rewind.md) for fast instance resynchronization with current master.
 
 ## Architecture
 
```

---

### Incident Patch 10: `ae203097` (2020-02-29)
**Commit Message**: *: Add configurable store timeout

Add a command line option to set the store timeout.

**File**: `cmd/common.go` (modified, +6/-2)
```diff
@@ -18,6 +18,7 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"time"
 
 	"github.com/prometheus/client_golang/prometheus"
 	"github.com/sorintlab/stolon/internal/cluster"
@@ -50,12 +51,14 @@ type CommonConfig struct {
 	KubeConfig           string
 	KubeContext          string
 	KubeNamespace        string
+	StoreTimeout         time.Duration
 }
 
 func AddCommonFlags(cmd *cobra.Command, cfg *CommonConfig) {
 	cmd.PersistentFlags().StringVar(&cfg.ClusterName, "cluster-name", "", "cluster name")
 	cmd.PersistentFlags().StringVar(&cfg.StoreBackend, "store-backend", "", "store backend type (etcdv2/etcd, etcdv3, consul or kubernetes)")
 	cmd.PersistentFlags().StringVar(&cfg.StoreEndpoints, "store-endpoints", "", "a comma-delimited list of store endpoints (use https scheme for tls communication) (defaults: http://127.0.0.1:2379 for etcd, http://127.0.0.1:8500 for consul)")
+	cmd.PersistentFlags().DurationVar(&cfg.StoreTimeout, "store-timeout", cluster.DefaultStoreTimeout, "store request timeout")
 	cmd.PersistentFlags().StringVar(&cfg.StorePrefix, "store-prefix", common.StorePrefix, "the store base prefix")
 	cmd.PersistentFlags().StringVar(&cfg.StoreCertFile, "store-cert-file", "", "certificate file for client identification to the store")
 	cmd.PersistentFlags().StringVar(&cfg.StoreKeyFile, "store-key", "", "private key file for client identification to the store")
@@ -143,6 +146,7 @@ func NewKVStore(cfg *CommonConfig) (store.KVStore, error) {
 	return store.NewKVStore(store.Config{
 		Backend:       store.Backend(cfg.StoreBackend),
 		Endpoints:     cfg.StoreEndpoints,
+		Timeout:       cfg.StoreTimeout,
 		CertFile:      cfg.StoreCertFile,
 		KeyFile:       cfg.StoreKeyFile,
 		CAFile:        cfg.StoreCAFile,
@@ -195,7 +199,7 @@ func NewElection(cfg *CommonConfig, uid string) (store.Election, error) {
 		if err != nil {
 			return nil, fmt.Errorf("cannot create kv store: %v", err)
 		}
-		election = store.NewKVBackedElection(kvstore, filepath.Join(storePath, common.SentinelLeaderKey), uid)
+		election = store.NewKVBackedElection(kvstore, filepath.Join(storePath, common.SentinelLeaderKey), uid, cfg.StoreTimeout)
 	case "kubernetes":
 		kubecli, podName, namespace, err := getKubeValues(cfg)
 		if err != nil {
@@ -216,7 +220,7 @@ func getKubeValues(cfg *CommonConfig) (*kubernetes.Clientset, string, string, er
 	if err != nil {
 		return nil, "", "", err
 	}
-	kubecfg.Timeout = cluster.DefaultStoreTimeout
+	kubecfg.Timeout = cfg.StoreTimeout
 	kubecli, err := kubernetes.NewForConfig(kubecfg)
 	if err != nil {
 		return nil, "", "", fmt.Errorf("cannot create kubernetes client: %v", err)
```

**File**: `doc/commands/stolon-keeper.md` (modified, +2/-1)
```diff
@@ -40,7 +40,8 @@ stolon-keeper [flags]
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
       --uid string                      keeper uid (must be unique in the cluster and can contain only lower-case letters, numbers and the underscore character). If not provided a random uid will be generated.
 ```
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

**File**: `doc/commands/stolon-proxy.md` (modified, +2/-1)
```diff
@@ -29,9 +29,10 @@ stolon-proxy [flags]
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
       --tcp-keepalive-count int         set tcp keepalive probe count number
       --tcp-keepalive-idle int          set tcp keepalive idle (seconds)
       --tcp-keepalive-interval int      set tcp keepalive interval (seconds)
 ```
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

**File**: `doc/commands/stolon-sentinel.md` (modified, +2/-1)
```diff
@@ -27,6 +27,7 @@ stolon-sentinel [flags]
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
 ```
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

**File**: `doc/commands/stolonctl.md` (modified, +2/-1)
```diff
@@ -28,6 +28,7 @@ stolonctl [flags]
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
 ```
 
 ### SEE ALSO
@@ -43,4 +44,4 @@ stolonctl [flags]
 * [stolonctl update](stolonctl_update.md)	 - Update a cluster specification
 * [stolonctl version](stolonctl_version.md)	 - Display the version
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

**File**: `doc/commands/stolonctl_clusterdata.md` (modified, +2/-1)
```diff
@@ -29,6 +29,7 @@ Manage current cluster data
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
 ```
 
 ### SEE ALSO
@@ -37,4 +38,4 @@ Manage current cluster data
 * [stolonctl clusterdata read](stolonctl_clusterdata_read.md)	 - Retrieve the current cluster data
 * [stolonctl clusterdata write](stolonctl_clusterdata_write.md)	 - Write cluster data
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

**File**: `doc/commands/stolonctl_clusterdata_read.md` (modified, +2/-1)
```diff
@@ -34,10 +34,11 @@ stolonctl clusterdata read [flags]
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
 ```
 
 ### SEE ALSO
 
 * [stolonctl clusterdata](stolonctl_clusterdata.md)	 - Manage current cluster data
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

**File**: `doc/commands/stolonctl_clusterdata_write.md` (modified, +2/-1)
```diff
@@ -35,10 +35,11 @@ stolonctl clusterdata write [flags]
       --store-key string                private key file for client identification to the store
       --store-prefix string             the store base prefix (default "stolon/cluster")
       --store-skip-tls-verify           skip store certificate verification (insecure!!!)
+      --store-timeout duration          store request timeout (default 5s)
 ```
 
 ### SEE ALSO
 
 * [stolonctl clusterdata](stolonctl_clusterdata.md)	 - Manage current cluster data
 
-###### Auto generated by spf13/cobra on 28-Jan-2020
+###### Auto generated by spf13/cobra on 6-Mar-2020
```

---

### Incident Patch 11: `350ddf61` (2020-02-24)
**Commit Message**: Merge pull request #763 from sgotti/tests_store_context_timeout

tests: use test store context timeout

**File**: `tests/integration/utils.go` (modified, +8/-4)
```diff
@@ -53,6 +53,8 @@ const (
 
 var (
 	defaultPGParameters = cluster.PGParameters{"log_destination": "stderr", "logging_collector": "false"}
+
+	defaultStoreTimeout = 1 * time.Second
 )
 
 var curPort = MinPort
@@ -806,7 +808,6 @@ func (tp *TestProxy) WaitListening(timeout time.Duration) error {
 		if err == nil {
 			return nil
 		}
-		tp.t.Logf("tp: %v, error: %v", tp.uid, err)
 		time.Sleep(sleepInterval)
 	}
 	return fmt.Errorf("timeout")
@@ -824,7 +825,6 @@ func (tp *TestProxy) WaitNotListening(timeout time.Duration) error {
 		if err != nil {
 			return nil
 		}
-		tp.t.Logf("tp: %v, error: %v", tp.uid, err)
 		time.Sleep(sleepInterval)
 	}
 	return fmt.Errorf("timeout")
@@ -1073,7 +1073,9 @@ func NewTestConsul(t *testing.T, dir string, a ...string) (*TestStore, error) {
 func (ts *TestStore) WaitUp(timeout time.Duration) error {
 	start := time.Now()
 	for time.Now().Add(-timeout).Before(start) {
-		_, err := ts.store.Get(context.TODO(), "anykey")
+		ctx, cancel := context.WithTimeout(context.Background(), defaultStoreTimeout)
+		_, err := ts.store.Get(ctx, "anykey")
+		cancel()
 		ts.t.Logf("err: %v", err)
 		if err != nil && err == store.ErrKeyNotFound {
 			return nil
@@ -1090,7 +1092,9 @@ func (ts *TestStore) WaitUp(timeout time.Duration) error {
 func (ts *TestStore) WaitDown(timeout time.Duration) error {
 	start := time.Now()
 	for time.Now().Add(-timeout).Before(start) {
-		_, err := ts.store.Get(context.TODO(), "anykey")
+		ctx, cancel := context.WithTimeout(context.Background(), defaultStoreTimeout)
+		_, err := ts.store.Get(ctx, "anykey")
+		cancel()
 		if err != nil && err != store.ErrKeyNotFound {
 			return nil
 		}
```

---

### Incident Patch 12: `79ea0fc6` (2020-02-24)
**Commit Message**: tests: use test store context timeout

since latest etcdv3 client will not fail on connection errors but will retry
until context timeout, shorten it to 1 second in WaitUp/WaitDown test store
functions.

**File**: `tests/integration/utils.go` (modified, +8/-4)
```diff
@@ -53,6 +53,8 @@ const (
 
 var (
 	defaultPGParameters = cluster.PGParameters{"log_destination": "stderr", "logging_collector": "false"}
+
+	defaultStoreTimeout = 1 * time.Second
 )
 
 var curPort = MinPort
@@ -806,7 +808,6 @@ func (tp *TestProxy) WaitListening(timeout time.Duration) error {
 		if err == nil {
 			return nil
 		}
-		tp.t.Logf("tp: %v, error: %v", tp.uid, err)
 		time.Sleep(sleepInterval)
 	}
 	return fmt.Errorf("timeout")
@@ -824,7 +825,6 @@ func (tp *TestProxy) WaitNotListening(timeout time.Duration) error {
 		if err != nil {
 			return nil
 		}
-		tp.t.Logf("tp: %v, error: %v", tp.uid, err)
 		time.Sleep(sleepInterval)
 	}
 	return fmt.Errorf("timeout")
@@ -1073,7 +1073,9 @@ func NewTestConsul(t *testing.T, dir string, a ...string) (*TestStore, error) {
 func (ts *TestStore) WaitUp(timeout time.Duration) error {
 	start := time.Now()
 	for time.Now().Add(-timeout).Before(start) {
-		_, err := ts.store.Get(context.TODO(), "anykey")
+		ctx, cancel := context.WithTimeout(context.Background(), defaultStoreTimeout)
+		_, err := ts.store.Get(ctx, "anykey")
+		cancel()
 		ts.t.Logf("err: %v", err)
 		if err != nil && err == store.ErrKeyNotFound {
 			return nil
@@ -1090,7 +1092,9 @@ func (ts *TestStore) WaitUp(timeout time.Duration) error {
 func (ts *TestStore) WaitDown(timeout time.Duration) error {
 	start := time.Now()
 	for time.Now().Add(-timeout).Before(start) {
-		_, err := ts.store.Get(context.TODO(), "anykey")
+		ctx, cancel := context.WithTimeout(context.Background(), defaultStoreTimeout)
+		_, err := ts.store.Get(ctx, "anykey")
+		cancel()
 		if err != nil && err != store.ErrKeyNotFound {
 			return nil
 		}
```

---

### Incident Patch 13: `9cc800de` (2020-02-17)
**Commit Message**: proxy: make proxyCheckInterval and proxyTimeout configurable

make proxyCheckInterval and proxyTimeout configurable in the cluster spec.

The proxy will publish its current proxyTimeout so the sentinel will know when
to consider it as active.

**File**: `cmd/proxy/cmd/proxy.go` (modified, +57/-11)
```diff
@@ -89,6 +89,10 @@ type ClusterChecker struct {
 	endPollonProxyCh chan error
 
 	pollonMutex sync.Mutex
+
+	proxyCheckInterval time.Duration
+	proxyTimeout       time.Duration
+	configMutex        sync.Mutex
 }
 
 func NewClusterChecker(uid string, cfg config) (*ClusterChecker, error) {
@@ -104,6 +108,9 @@ func NewClusterChecker(uid string, cfg config) (*ClusterChecker, error) {
 		stopListening:    cfg.stopListening,
 		e:                e,
 		endPollonProxyCh: make(chan error),
+
+		proxyCheckInterval: cluster.DefaultProxyCheckInterval,
+		proxyTimeout:       cluster.DefaultProxyTimeout,
 	}, nil
 }
 
@@ -164,15 +171,16 @@ func (c *ClusterChecker) sendPollonConfData(confData pollon.ConfData) {
 	}
 }
 
-func (c *ClusterChecker) SetProxyInfo(e store.Store, generation int64, ttl time.Duration) error {
+func (c *ClusterChecker) SetProxyInfo(e store.Store, generation int64, proxyTimeout time.Duration) error {
 	proxyInfo := &cluster.ProxyInfo{
-		InfoUID:    common.UID(),
-		UID:        c.uid,
-		Generation: generation,
+		InfoUID:      common.UID(),
+		UID:          c.uid,
+		Generation:   generation,
+		ProxyTimeout: proxyTimeout,
 	}
 	log.Debugf("proxyInfo dump: %s", spew.Sdump(proxyInfo))
 
-	if err := c.e.SetProxyInfo(context.TODO(), proxyInfo, ttl); err != nil {
+	if err := c.e.SetProxyInfo(context.TODO(), proxyInfo, 2*proxyTimeout); err != nil {
 		return err
 	}
 	return nil
@@ -205,13 +213,31 @@ func (c *ClusterChecker) Check() error {
 		return fmt.Errorf("clusterdata validation failed: %v", err)
 	}
 
+	cdProxyCheckInterval := cd.Cluster.DefSpec().ProxyCheckInterval.Duration
+	cdProxyTimeout := cd.Cluster.DefSpec().ProxyTimeout.Duration
+
+	// use the greater between the current proxy timeout and the one defined in the cluster spec if they're different.
+	// in this way we're updating our proxyInfo using a timeout that is greater or equal the current active timeout timer.
+	c.configMutex.Lock()
+	proxyTimeout := c.proxyTimeout
+	if cdProxyTimeout > proxyTimeout {
+		proxyTimeout = cdProxyTimeout
+	}
+	c.configMutex.Unlock()
+
 	proxy := cd.Proxy
 	if proxy == nil {
 		log.Infow("no proxy object available, closing connections to master")
 		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
 		// ignore errors on setting proxy info
-		if err = c.SetProxyInfo(c.e, cluster.NoGeneration, 2*cluster.DefaultProxyTimeoutInterval); err != nil {
+		if err = c.SetProxyInfo(c.e, cluster.NoGeneration, proxyTimeout); err != nil {
 			log.Errorw("failed to update proxyInfo", zap.Error(err))
+		} else {
+			// update proxyCheckinterval and proxyTimeout only if we successfully updated our proxy info
+			c.configMutex.Lock()
+			c.proxyCheckInterval = cdProxyCheckInterval
+			c.proxyTimeout = cdProxyTimeout
+			c.configMutex.Unlock()
 		}
 		return nil
 	}
@@ -221,8 +247,14 @@ func (c *ClusterChecker) Check() error {
 		log.Infow("no db object available, closing connections to master", "db", proxy.Spec.MasterDBUID)
 		c.sendPollonConfData(pollon.ConfData{DestAddr: nil})
 		// ignore errors on setting proxy info
-		if err = c.SetProxyInfo(c.e, proxy.Generation, 2*cluster.DefaultProxyTimeoutInterval); err != nil {
+		if err = c.SetProxyInfo(c.e, proxy.Generation, proxyTimeout); err != nil {
 			log.Errorw("failed to update proxyInfo", zap.Error(err))
+		} else {
+			// update proxyCheckinterval and proxyTimeout only if we successfully updated our proxy info
+			c.configMutex.Lock()
+			c.proxyCheckInterval = cdProxyCheckInterval
+			c.proxyTimeout = cdProxyTimeout
+			c.configMutex.Unlock()
 		}
 		return nil
 	}
@@ -234,12 +266,18 @@ func (c *ClusterChecker) Check() error {
 		return nil
 	}
 	log.Infow("master address", "address", addr)
-	if err = c.SetProxyInfo(c.e, proxy.Generation, 2*cluster.DefaultProxyTimeoutInterval); err != nil {
+	if err = c.SetProxyInfo(c.e, proxy.Generation, proxyTimeout); err != nil {
 		// if we failed to update our proxy info when a master is defined we
 		// cannot ignore this error since the sentinel won't know that we exist
 		// and are sending connections to a master so, when electing a new
 		// master, it'll not wait for us to close connections to the old one.
 		return fmt.Errorf("failed to update proxyInfo: %v", err)
+	} else {
+		// update proxyCheckinterval and proxyTimeout only if we successfully updated our proxy info
+		c.configMutex.Lock()
+		c.proxyCheckInterval = cdProxyCheckInterval
+		c.proxyTimeout = cdProxyTimeout
+		c.configMutex.Unlock()
 	}
 
 	// start proxing only if we are inside enabledProxies, this ensures that the
@@ -256,7 +294,9 @@ func (c *ClusterChecker) Check() error {
 }
 
 func (c *ClusterChecker) TimeoutChecker(checkOkCh chan struct{}) {
-	timeoutTimer := time.NewTimer(cluster.DefaultProxyTimeoutInterval)
+	c.configMutex.Lock()
+	timeoutTimer := time.NewTimer(c.proxyTimeout)
+	c.configMutex.Unlock()
 
 	for {
 		select {
@@ -275,7 +315,10 @@ func (c *ClusterChecker) TimeoutChecker(checkOkCh chan struct{}) {
 
 			// ignore if stop succeeded or n
```

**File**: `cmd/sentinel/cmd/sentinel.go` (modified, +1/-2)
```diff
@@ -342,7 +342,7 @@ func (s *Sentinel) activeProxiesInfos(proxiesInfo cluster.ProxiesInfo) cluster.P
 	for _, pi := range proxiesInfo {
 		if pih, ok := pihs[pi.UID]; ok {
 			if pih.ProxyInfo.InfoUID == pi.InfoUID {
-				if timer.Since(pih.Timer) > 2*cluster.DefaultProxyTimeoutInterval {
+				if timer.Since(pih.Timer) > 2*pi.ProxyTimeout {
 					delete(activeProxiesInfo, pi.UID)
 				}
 			} else {
@@ -1820,7 +1820,6 @@ func (s *Sentinel) clusterSentinelCheck(pctx context.Context) {
 			s.sleepInterval = cd.Cluster.DefSpec().SleepInterval.Duration
 			s.requestTimeout = cd.Cluster.DefSpec().RequestTimeout.Duration
 		}
-
 	}
 
 	log.Debugf("cd dump: %s", spew.Sdump(cd))
```

**File**: `cmd/sentinel/cmd/sentinel_test.go` (modified, +3/-3)
```diff
@@ -5000,8 +5000,8 @@ func TestUpdateCluster(t *testing.T) {
 }
 
 func TestActiveProxiesInfos(t *testing.T) {
-	proxyInfo1 := cluster.ProxyInfo{UID: "proxy1", InfoUID: "infoUID1"}
-	proxyInfo2 := cluster.ProxyInfo{UID: "proxy2", InfoUID: "infoUID2"}
+	proxyInfo1 := cluster.ProxyInfo{UID: "proxy1", InfoUID: "infoUID1", ProxyTimeout: cluster.DefaultProxyTimeout}
+	proxyInfo2 := cluster.ProxyInfo{UID: "proxy2", InfoUID: "infoUID2", ProxyTimeout: cluster.DefaultProxyTimeout}
 	proxyInfoWithDifferentInfoUID := cluster.ProxyInfo{UID: "proxy2", InfoUID: "differentInfoUID"}
 	var secToNanoSecondMultiplier int64 = 1000000000
 	tests := []struct {
@@ -5033,7 +5033,7 @@ func TestActiveProxiesInfos(t *testing.T) {
 			expectedProxyInfoHistories: ProxyInfoHistories{"proxy1": &ProxyInfoHistory{ProxyInfo: &proxyInfo1}, "proxy2": &ProxyInfoHistory{ProxyInfo: &proxyInfoWithDifferentInfoUID}},
 		},
 		{
-			name:                       "should remove from active proxies if is not updated for twice the DefaultProxyTimeoutInterval",
+			name:                       "should remove from active proxies if is not updated for twice the DefaultProxyTimeout",
 			proxyInfoHistories:         ProxyInfoHistories{"proxy1": &ProxyInfoHistory{ProxyInfo: &proxyInfo1, Timer: timer.Now() - (3 * 15 * secToNanoSecondMultiplier)}, "proxy2": &ProxyInfoHistory{ProxyInfo: &proxyInfo2, Timer: timer.Now() - (1 * 15 * secToNanoSecondMultiplier)}},
 			proxiesInfos:               cluster.ProxiesInfo{"proxy1": &proxyInfo1, "proxy2": &proxyInfo2},
 			expectedActiveProxies:      cluster.ProxiesInfo{"proxy2": &proxyInfo2},
```

**File**: `cmd/stolonctl/cmd/spec.go` (modified, +4/-0)
```diff
@@ -50,6 +50,8 @@ type ClusterSpecNoDefaults struct {
 	DBWaitReadyTimeout               *cluster.Duration         `json:"dbWaitReadyTimeout,omitempty"`
 	FailInterval                     *cluster.Duration         `json:"failInterval,omitempty"`
 	DeadKeeperRemovalInterval        *cluster.Duration         `json:"deadKeeperRemovalInterval,omitempty"`
+	ProxyCheckInterval               *cluster.Duration         `json:"proxyCheckInterval,omitempty"`
+	ProxyTimeout                     *cluster.Duration         `json:"proxyTimeout,omitempty"`
 	MaxStandbys                      *uint16                   `json:"maxStandbys,omitempty"`
 	MaxStandbysPerSender             *uint16                   `json:"maxStandbysPerSender,omitempty"`
 	MaxStandbyLag                    *uint32                   `json:"maxStandbyLag,omitempty"`
@@ -81,6 +83,8 @@ type ClusterSpecDefaults struct {
 	DBWaitReadyTimeout               *cluster.Duration         `json:"dbWaitReadyTimeout"`
 	FailInterval                     *cluster.Duration         `json:"failInterval"`
 	DeadKeeperRemovalInterval        *cluster.Duration         `json:"deadKeeperRemovalInterval"`
+	ProxyCheckInterval               *cluster.Duration         `json:"proxyCheckInterval"`
+	ProxyTimeout                     *cluster.Duration         `json:"proxyTimeout"`
 	MaxStandbys                      *uint16                   `json:"maxStandbys"`
 	MaxStandbysPerSender             *uint16                   `json:"maxStandbysPerSender"`
 	MaxStandbyLag                    *uint32                   `json:"maxStandbyLag"`
```

**File**: `doc/cluster_spec.md` (modified, +51/-49)
```diff
@@ -12,34 +12,36 @@ Some options in a running cluster specification can be changed to update the des
 
 ### Cluster Specification Format.
 
-| Name                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Required                  | Type              | Default                                                                                                                             |
-|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------|-------------------|-------------------------------------------------------------------------------------------------------------------------------------|
-| sleepInterval             | interval to wait before next check (for every component: keeper, sentinel, proxy).                                                                                                                                                                                                                                                                                                                                                                                                | no                        | string (duration) | 5s                                                                                                                                  |
-| requestTimeout            | time after which any request (keepers checks from sentinel etc...) will fail.                                                                                                                                                                                                                                                                                                                                                                                                     | no                        | string (duration) | 10s                                                                                                                                 |
-| failInterval              | interval after the first fail to declare a keeper as not healthy.                                                                                                                                                                                                                                                                                                                                                                                                                 | no                        | string (duration) | 20s                                                                                                                                 |
-| deadKeeperRemovalInterval | interval after which a dead keeper will be removed from the cluster data                                                                                                                                                                                                                                                                                                                                                                                                          | no                        | string (duration) | 48h                                                                                                                                 |
-| maxStandbys               | max number of standbys. This needs to be greater enough to cover both standby managed by stolon and additional standbys configured by the user. Its value affect different postgres parameters like max_replication_slots and max_wal_senders. Setting this to a number lower than the sum of stolon managed standbys and user managed standbys will have unpredicatable effects due to problems creating replication slots or replication problems due to exhausted wal senders. | no                        | uint16            | 20                                                                                                                                  |
-| maxStandbysPerSender      | max number of standbys for every sender. A sender can be a mas
```

**File**: `internal/cluster/cluster.go` (modified, +25/-7)
```diff
@@ -43,11 +43,7 @@ const (
 )
 
 const (
-	DefaultStoreTimeout         = 5 * time.Second
-	DefaultProxyCheckInterval   = 5 * time.Second
-	DefaultProxyTimeoutInterval = 15 * time.Second
-
-	DefaultDBWaitReadyTimeout = 60 * time.Second
+	DefaultStoreTimeout = 5 * time.Second
 
 	DefaultDBNotIncreasingXLogPosTimes = 10
 
@@ -56,8 +52,11 @@ const (
 	DefaultConvergenceTimeout                         = 30 * time.Second
 	DefaultInitTimeout                                = 5 * time.Minute
 	DefaultSyncTimeout                                = 0
+	DefaultDBWaitReadyTimeout                         = 60 * time.Second
 	DefaultFailInterval                               = 20 * time.Second
 	DefaultDeadKeeperRemovalInterval                  = 48 * time.Hour
+	DefaultProxyCheckInterval                         = 5 * time.Second
+	DefaultProxyTimeout                               = 15 * time.Second
 	DefaultMaxStandbys               uint16           = 20
 	DefaultMaxStandbysPerSender      uint16           = 3
 	DefaultMaxStandbyLag                              = 1024 * 1204
@@ -228,6 +227,10 @@ type ClusterSpec struct {
 	FailInterval *Duration `json:"failInterval,omitempty"`
 	// Interval after which a dead keeper will be removed from the cluster data
 	DeadKeeperRemovalInterval *Duration `json:"deadKeeperRemovalInterval,omitempty"`
+	// Interval to wait before next proxy check
+	ProxyCheckInterval *Duration `json:"proxyCheckInterval,omitempty"`
+	// Interval where the proxy must successfully complete a check
+	ProxyTimeout *Duration `json:"proxyTimeout,omitempty"`
 	// Max number of standbys. This needs to be greater enough to cover both
 	// standby managed by stolon and additional standbys configured by the
 	// user. Its value affect different postgres parameters like
@@ -364,6 +367,12 @@ func (os *ClusterSpec) WithDefaults() *ClusterSpec {
 	if s.DeadKeeperRemovalInterval == nil {
 		s.DeadKeeperRemovalInterval = &Duration{Duration: DefaultDeadKeeperRemovalInterval}
 	}
+	if s.ProxyCheckInterval == nil {
+		s.ProxyCheckInterval = &Duration{Duration: DefaultProxyCheckInterval}
+	}
+	if s.ProxyTimeout == nil {
+		s.ProxyTimeout = &Duration{Duration: DefaultProxyTimeout}
+	}
 	if s.MaxStandbys == nil {
 		s.MaxStandbys = Uint16P(DefaultMaxStandbys)
 	}
@@ -426,11 +435,20 @@ func (os *ClusterSpec) Validate() error {
 	if s.DBWaitReadyTimeout.Duration < 0 {
 		return fmt.Errorf("dbWaitReadyTimeout must be positive")
 	}
+	if s.FailInterval.Duration < 0 {
+		return fmt.Errorf("failInterval must be positive")
+	}
 	if s.DeadKeeperRemovalInterval.Duration < 0 {
 		return fmt.Errorf("deadKeeperRemovalInterval must be positive")
 	}
-	if s.FailInterval.Duration < 0 {
-		return fmt.Errorf("failInterval must be positive")
+	if s.ProxyCheckInterval.Duration < 0 {
+		return fmt.Errorf("proxyCheckInterval must be positive")
+	}
+	if s.ProxyTimeout.Duration < 0 {
+		return fmt.Errorf("proxyTimeout must be positive")
+	}
+	if s.ProxyCheckInterval.Duration >= s.ProxyTimeout.Duration {
+		return fmt.Errorf("proxyCheckInterval should be less than proxyTimeout")
 	}
 	if *s.MaxStandbys < 1 {
 		return fmt.Errorf("maxStandbys must be at least 1")
```

**File**: `internal/cluster/member.go` (modified, +7/-0)
```diff
@@ -16,6 +16,7 @@ package cluster
 
 import (
 	"reflect"
+	"time"
 
 	"github.com/sorintlab/stolon/internal/common"
 
@@ -133,6 +134,12 @@ type ProxyInfo struct {
 
 	UID        string
 	Generation int64
+
+	// ProxyTimeout is the current proxyTimeout used by the proxy
+	// at the time of publishing its state.
+	// It's used by the sentinel to know for how much time the
+	// proxy should be considered active.
+	ProxyTimeout time.Duration
 }
 
 type ProxiesInfo map[string]*ProxyInfo
```

**File**: `tests/integration/proxy_test.go` (modified, +4/-4)
```diff
@@ -151,7 +151,7 @@ func TestProxyListening(t *testing.T) {
 	}
 
 	// tp should not listen because it cannot talk with the store
-	if err := tp.WaitNotListening(cluster.DefaultProxyTimeoutInterval * 2); err != nil {
+	if err := tp.WaitNotListening(cluster.DefaultProxyTimeout * 2); err != nil {
 		t.Fatalf("expecting tp not listening due to failed store communication, but it's listening.")
 	}
 
@@ -174,8 +174,8 @@ func TestProxyListening(t *testing.T) {
 	if err := tstore.WaitDown(10 * time.Second); err != nil {
 		t.Fatalf("error waiting on store down: %v", err)
 	}
-	// wait less than DefaultProxyTimeoutInterval
-	time.Sleep(cluster.DefaultProxyTimeoutInterval / 3)
+	// wait less than DefaultProxyTimeout
+	time.Sleep(cluster.DefaultProxyTimeout / 3)
 	// Start store
 	if err := tstore.Start(); err != nil {
 		t.Fatalf("unexpected err: %v", err)
@@ -239,7 +239,7 @@ func TestProxyListening(t *testing.T) {
 	}
 
 	// tp should not listen because it cannot talk with the store
-	if err := tp.WaitNotListening(cluster.DefaultProxyTimeoutInterval * 2); err != nil {
+	if err := tp.WaitNotListening(cluster.DefaultProxyTimeout * 2); err != nil {
 		t.Fatalf("expecting tp not listening due to failed store communication, but it's listening.")
 	}
 
```

---

### Incident Patch 14: `13054464` (2020-02-19)
**Commit Message**: Merge pull request #749 from johannesboon/documentSyncTimeout

Document syncTimeout.

**File**: `doc/cluster_spec.md` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ Some options in a running cluster specification can be changed to update the des
 | pgHBA                     | a list containing additional pg_hba.conf entries. They will be added to the pg_hba.conf generated by stolon. **NOTE**: these lines aren't validated so if some of them are wrong postgres will refuse to start or, on reload, will log a warning and ignore the updated pg_hba.conf file                                                                                                                                                                                          | no                        | []string          | null. Will use the default behiavior of accepting connections from all hosts for all dbs and users with md5 password authentication                                                   |
 | automaticPgRestart        | restart postgres automatically after changing the pgParameters that requires restart. Refer `pending_restart` in [pg_settings](https://www.postgresql.org/docs/9.5/static/view-pg-settings.html)    | no | bool | false |
 | dbWaitReadyTimeout        | Time to wait for the database to become ready after starting.  Increase this value if your Postgres takes longer to boot, e.g. because it has to recover a lot of WAL. | no | string (duration) | 60s |
+| syncTimeout               | Time to wait for a database recovery (including the replay of WAL files in case of Point-In-Time-Recovery)                                                                                                                                                                                                                                                                                                                                                                        | no                        | string (duration) | 0 (no timeout, waits until recovery has finished)                                                                                   |
 
 #### ExistingConfig
 
```

---

### Incident Patch 15: `e0e7d970` (2020-02-18)
**Commit Message**: doc: document syncTimeout

**File**: `doc/cluster_spec.md` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ Some options in a running cluster specification can be changed to update the des
 | pgHBA                     | a list containing additional pg_hba.conf entries. They will be added to the pg_hba.conf generated by stolon. **NOTE**: these lines aren't validated so if some of them are wrong postgres will refuse to start or, on reload, will log a warning and ignore the updated pg_hba.conf file                                                                                                                                                                                          | no                        | []string          | null. Will use the default behiavior of accepting connections from all hosts for all dbs and users with md5 password authentication                                                   |
 | automaticPgRestart        | restart postgres automatically after changing the pgParameters that requires restart. Refer `pending_restart` in [pg_settings](https://www.postgresql.org/docs/9.5/static/view-pg-settings.html)    | no | bool | false |
 | dbWaitReadyTimeout        | Time to wait for the database to become ready after starting.  Increase this value if your Postgres takes longer to boot, e.g. because it has to recover a lot of WAL. | no | string (duration) | 60s |
+| syncTimeout               | Time to wait for a database recovery (including the replay of WAL files in case of Point-In-Time-Recovery)                                                                                                                                                                                                                                                                                                                                                                        | no                        | string (duration) | 0 (no timeout, waits until recovery has finished)                                                                                   |
 
 #### ExistingConfig
 
```

#### Recent Merged Pull Requests:
- **PR #933** (closed): Fix minor issues and update release (@SnehalKapure)
- **PR #931** (closed): Feature/unittests/cluster (@sebasmannem)
- **PR #929** (closed): Fix bug in PITR restore problem (@hadizamani021)
- **PR #923** (closed): add support PostgreSQL16 (@jason-webcomm)
- **PR #921** (closed): startup: wait for cluster data and start without sleep (@fantix)
- **PR #913** (2023-09-06): ci: update bsycorp/kind to latest version (@sgotti)
- **PR #905** (closed): feat(ci): Using github action to build images (@pavel-jancik)
- **PR #896** (2022-10-20): *: add support for PostgreSQL 15 (@chhetripradeep)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
