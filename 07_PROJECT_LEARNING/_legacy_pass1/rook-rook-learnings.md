# Forensic Learning Record (Deep Inspection): rook/rook

> **Canonical Artifact**: `07_PROJECT_LEARNING/rook-rook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rook/rook](https://github.com/rook/rook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:16:28.187Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rook/rook`
- **Description**: Storage Orchestration for Kubernetes
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 13670 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/rook/ceph/ceph.go`
```
/*
Copyright 2018 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package ceph

import (
	"os"

	"github.com/coreos/pkg/capnslog"
	"github.com/spf13/cobra"

	"github.com/rook/rook/cmd/rook/rook"
	"github.com/rook/rook/pkg/clusterd"
	cephclient "github.com/rook/rook/pkg/daemon/ceph/client"
	osdconfig "github.com/rook/rook/pkg/operator/ceph/cluster/osd/config"
	"github.com/rook/rook/pkg/operator/k8sutil"
)

// Cmd is the main command for operator and daemons.
var Cmd = &cobra.Command{
	Use:    "ceph",
	Short:  "Main command for Ceph operator and daemons.",
	Hidden: true, // do not advertise to end users
}

var (
	cfg         = &config{}
	clusterInfo cephclient.ClusterInfo
	logger      = capnslog.NewPackageLogger("github.com/rook/rook", "cephcmd")
)

type config struct {
	devices            string
	metadataDevice     string
	dataDir            string
	forceFormat        bool
	location           string
	cephConfigOverride string
	storeConfig        osdconfig.StoreConfig
	monEndpoints       string
	nodeName           string
	pvcBacked          bool
}

func init() {
	Cmd.AddCommand(cleanUpCmd,
		operatorCmd,
		osdCmd,
		mgrCmd,
		configCmd)
}

func createContext() *clusterd.Context {
	context := rook.NewContext()
	context.ConfigDir = cfg.dataDir
	context.ConfigFileOverride = cfg.cephConfigOverride
	return context
}

func addCephFlags(command *cobra.Command) {
	command.Flags().StringVar(&clusterInfo.FSID, "fsid", "", "the cluster uuid")
	command.Flags().StringVar(&clusterInfo.MonitorSecret, "mon-secret", "", "the cephx keyring for monitors")
	command.Flags().StringVar(&clusterInfo.CephCred.Username, "ceph-username", "", "ceph username")
	command.Flags().StringVar(&cfg.monEndpoints, "mon-endpoints", "", "ceph mon endpoints")
	command.Flags().StringVar(&cfg.dataDir, "config-dir", "/var/lib/rook", "directory for storing configuration")
	command.Flags().StringVar(&cfg.cephConfigOverride, "ceph-config-override", "", "optional path to a ceph config file that will be appended to the config files that rook generates")

	clusterInfo.Namespace = os.Getenv(k8sutil.PodNamespaceEnvVar)
}

```

### Core Architecture Module: `cmd/rook/ceph/cleanup.go`
```
/*
Copyright 2020 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package ceph

import (
	"fmt"
	"os"

	"github.com/rook/rook/cmd/rook/rook"
	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
	cleanup "github.com/rook/rook/pkg/daemon/ceph/cleanup"
	"github.com/rook/rook/pkg/daemon/ceph/client"
	opcontroller "github.com/rook/rook/pkg/operator/ceph/controller"
	"github.com/rook/rook/pkg/operator/k8sutil"
	"github.com/rook/rook/pkg/util/flags"
	"github.com/spf13/cobra"
)

var (
	dataDirHostPath    string
	namespaceDir       string
	monSecret          string
	clusterFSID        string
	sanitizeMethod     string
	sanitizeDataSource string
	sanitizeIteration  int32
)

var cleanUpCmd = &cobra.Command{
	Use:   "clean",
	Short: "Starts the cleanup process",
}

var cleanUpHostCmd = &cobra.Command{
	Use:   "host",
	Short: "Starts the cleanup process on a host after the ceph cluster is deleted",
}

var cleanUpSubVolumeGroupCmd = &cobra.Command{
	// the subcommand matches the CRD kind of the custom resource to be cleaned up
	Use:   "CephFilesystemSubVolumeGroup",
	Short: "Starts the cleanup process of a CephFilesystemSubVolumeGroup",
}

var cleanUpRadosNamespaceCmd = &cobra.Command{
	// the subcommand matches the CRD kind of the custom resource to be cleaned up
	Use:   "CephBlockPoolRadosNamespace",
	Short: "Starts the cleanup process for a CephBlockPoolRadosNamespace",
}

var cleanUpBlockPoolCmd = &cobra.Command{
	// the subcommand matches the CRD kind of the custom resource to be cleaned up
	Use:   "CephBlockPool",
	Short: "Starts the cleanup process for a CephBlockPool",
}

func init() {
	cleanUpHostCmd.Flags().StringVar(&dataDirHostPath, "data-dir-host-path", "", "dataDirHostPath on the node")
	cleanUpHostCmd.Flags().StringVar(&namespaceDir, "namespace-dir", "", "dataDirHostPath on the node")
	cleanUpHostCmd.Flags().StringVar(&monSecret, "mon-secret", "", "monitor secret from the keyring")
	cleanUpHostCmd.Flags().StringVar(&clusterFSID, "cluster-fsid", "", "ceph cluster fsid")
	cleanUpHostCmd.Flags().StringVar(&sanitizeMethod, "sanitize-method", string(cephv1.SanitizeMethodQuick), "sanitize method to use (metadata or data)")
	cleanUpHostCmd.Flags().StringVar(&sanitizeDataSource, "sanitize-data-source", string(cephv1.SanitizeDataSourceZero), "data source to sanitize the disk (zero or random)")
	cleanUpHostCmd.Flags().Int32Var(&sanitizeIteration, "sanitize-iteration", 1, "overwrite N times the disk")

	flags.SetFlagsFromEnv(cleanUpHostCmd.Flags(), rook.RookEnvVarPrefix)
	flags.SetFlagsFromEnv(cleanUpSubVolumeGroupCmd.Flags(), rook.RookEnvVarPrefix)

	cleanUpCmd.AddCommand(cleanUpHostCmd, cleanUpSubVolumeGroupCmd, cleanUpRadosNamespaceCmd, cleanUpBlockPoolCmd)

	cleanUpHostCmd.RunE = startHostCleanUp
	cleanUpSubVolumeGroupCmd.RunE = startSubVolumeGroupCleanUp
	cleanUpRadosNamespaceCmd.RunE = startRadosNamespaceCleanup
	cleanUpBlockPoolCmd.RunE = startBlockPoolCleanup
}

func startHostCleanUp(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()
	rook.LogStartupInfo(cleanUpHostCmd.Flags())

	ctx := cmd.Context()

	logger.Info("starting cluster clean up")
	// Delete dataDirHostPath
	if dataDirHostPath != "" {
		// Remove both dataDirHostPath and monitor store
		cleanup.StartHostPathCleanup(namespaceDir, dataDirHostPath, monSecret)
	}

	namespace := os.Getenv(k8sutil.PodNamespaceEnvVar)
	clusterInfo := client.AdminClusterInfo(ctx, namespace, "")
	clusterInfo.FSID = clusterFSID

	// Build Sanitizer
	s := cleanup.NewDiskSanitizer(createContext(),
		clusterInfo,
		&cephv1.SanitizeDisksSpec{
			Method:     cephv1.SanitizeMethodProperty(sanitizeMethod),
			DataSource: cephv1.SanitizeDataSourceProperty(sanitizeDataSource),
			Iteration:  sanitizeIteration,
		},
	)

	// Start OSD wipe process
	s.StartSanitizeDisks()

	return nil
}

func startSubVolumeGroupCleanUp(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()
	rook.LogStartupInfo(cleanUpSubVolumeGroupCmd.Flags())

	ctx := cmd.Context()
	context := createContext()
	namespace := os.Getenv(k8sutil.PodNamespaceEnvVar)
	clusterInfo := client.AdminClusterInfo(ctx, namespace, "")

	fsName := os.Getenv(opcontroller.CephFSNameEnv)
	if fsName == "" {
		rook.TerminateFatal(fmt.Errorf("ceph filesystem name is not available in the pod environment variables"))
	}
	subVolumeGroupName := os.Getenv(opcontroller.CephFSSubVolumeGroupNameEnv)
	if subVolumeGroupName == "" {
		rook.TerminateFatal(fmt.Errorf("cephFS SubVolumeGroup name is not available in the pod environment variables"))
	}
	csiNamespace := os.Getenv(opcontroller.CSICephFSRadosNamesaceEnv)
	if csiNamespace == "" {
		rook.TerminateFatal(fmt.Errorf("CSI rados namespace name is not available in the pod environment variables"))
	}
	poolName := os.Getenv(opcontroller.CephFSMetaDataPoolNameEnv)
	if poolName == "" {
		rook.TerminateFatal(fmt.Errorf("cephFS metadata pool name is not available in the pod environment variables"))
	}

	err := cleanup.SubVolumeGroupCleanup(context, clusterInfo, fsName, subVolumeGroupName, poolName, csiNamespace)
	if err != nil {
		rook.TerminateFatal(fmt.Errorf("failed to cleanup cephFS %q SubVolumeGroup %q in the namespace %q. %v", fsName, subVolumeGroupName, namespace, err))
	}

	return nil
}

func startRadosNamespaceCleanup(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()
	rook.LogStartupInfo(cleanUpRadosNamespaceCmd.Flags())

	ctx := cmd.Context()
	context := createContext()
	namespace := os.Getenv(k8sutil.PodNamespaceEnvVar)
	clusterInfo := client.AdminClusterInfo(ctx, namespace, "")

	poolName := os.Getenv(opcontroller.CephBlockPoolNameEnv)
	if poolName == "" {
		rook.TerminateFatal(fmt.Errorf("cephblockpool name is not available in the pod environment variables"))
	}

	radosNamespace := os.Getenv(opcontroller.CephBlockPoolRadosNamespaceEnv)
	if radosNamespace == "" {
		rook.TerminateFatal(fmt.Errorf("cephblockpool radosNamespace is not available in the pod environment variables"))
	}

	err := cleanup.RadosNamespaceCleanup(context, clusterInfo, poolName, radosNamespace)
	if err != nil {
		rook.TerminateFatal(fmt.Errorf("failed to cleanup cephBlockPoolRadosNamespace %q resources in the pool %q. %v", radosNamespace, poolName, err))
	}

	return nil
}

func startBlockPoolCleanup(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()
	rook.LogStartupInfo(cleanUpRadosNamespaceCmd.Flags())

	ctx := cmd.Context()
	context := createContext()
	namespace := os.Getenv(k8sutil.PodNamespaceEnvVar)
	clusterInfo := client.AdminClusterInfo(ctx, namespace, "")

	poolName := os.Getenv(opcontroller.CephBlockPoolNameEnv)
	if poolName == "" {
		rook.TerminateFatal(fmt.Errorf("cephblockpool name is not available in the pod environment variables"))
	}

	err := cleanup.BlockPoolCleanup(context, clusterInfo, poolName)
	if err != nil {
		rook.TerminateFatal(fmt.Errorf("failed to cleanup cephBlockPool %q resource %v", poolName, err))
	}

	return nil
}

```

### Core Architecture Module: `cmd/rook/ceph/config.go`
```
/*
Copyright 2018 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package ceph

import (
	"os"

	"github.com/pkg/errors"
	"github.com/rook/rook/cmd/rook/rook"
	cephclient "github.com/rook/rook/pkg/daemon/ceph/client"
	"github.com/rook/rook/pkg/util"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config-init",
	Short: "Generates basic Ceph config",
	Long: `Generate the most basic Ceph config for connecting non-Ceph daemons to a Ceph
cluster (e.g., nfs-ganesha). Effectively what this means is that it generates
'/etc/ceph/ceph.conf' with 'mon_host' populated and a keyring path (given via
commandline flag) associated with the user given via commandline flag.
'mon_host' is determined by the 'ROOK_CEPH_MON_HOST' env var present in other
Ceph daemon pods, and the keyring is expected to be mounted into the container
with a Kubernetes pod volume+mount.`,
}

var (
	keyring  string
	username string
)

func init() {
	configCmd.Flags().StringVar(&keyring, "keyring", "", "path to the keyring file")
	if err := configCmd.MarkFlagRequired("keyring"); err != nil {
		panic(err)
	}

	configCmd.Flags().StringVar(&username, "username", "", "the daemon username")
	if err := configCmd.MarkFlagRequired("username"); err != nil {
		panic(err)
	}

	configCmd.RunE = initConfig
}

func initConfig(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()

	rook.LogStartupInfo(configCmd.Flags())

	if keyring == "" {
		rook.TerminateFatal(errors.New("keyring is empty string"))
	}
	if username == "" {
		rook.TerminateFatal(errors.New("username is empty string"))
	}

	monHost := os.Getenv("ROOK_CEPH_MON_HOST")
	if monHost == "" {
		rook.TerminateFatal(errors.New("ROOK_CEPH_MON_HOST is not set or is empty string"))
	}

	cfg := `
[global]
mon_host = ` + monHost + `

[` + username + `]
keyring = ` + keyring + `
`

	var fileMode os.FileMode = 0o444 // read-only
	// #nosec G703 -- path is a constant returned by DefaultConfigFilePath, not user input
	err := os.WriteFile(cephclient.DefaultConfigFilePath(), []byte(cfg), fileMode)
	if err != nil {
		rook.TerminateFatal(errors.Wrapf(err, "failed to write config file"))
	}

	util.WriteFileToLog(logger, cephclient.DefaultConfigFilePath())

	return nil
}

```

### Core Architecture Module: `cmd/rook/ceph/mgr.go`
```
/*
Copyright 2021 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package ceph

import (
	"fmt"
	"path"
	"time"

	"github.com/rook/rook/cmd/rook/rook"
	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
	"github.com/rook/rook/pkg/clusterd"
	"github.com/rook/rook/pkg/daemon/ceph/client"
	"github.com/rook/rook/pkg/operator/ceph/cluster/mgr"
	"github.com/rook/rook/pkg/operator/ceph/cluster/mon"
	opcontroller "github.com/rook/rook/pkg/operator/ceph/controller"
	cephver "github.com/rook/rook/pkg/operator/ceph/version"
	"github.com/rook/rook/pkg/operator/k8sutil"
	"github.com/rook/rook/pkg/util/flags"
	"github.com/spf13/cobra"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var mgrCmd = &cobra.Command{
	Use: "mgr",
}

var mgrSidecarCmd = &cobra.Command{
	Use: "watch-active",
}

var (
	updateMgrServicesInterval string
	daemonName                string
	clusterSpec               cephv1.ClusterSpec
	rawCephVersion            string
)

func init() {
	addCephFlags(mgrCmd)

	// add the subcommands to the parent mgr command
	mgrCmd.AddCommand(mgrSidecarCmd)

	mgrSidecarCmd.Flags().BoolVar(&clusterSpec.Dashboard.Enabled, "dashboard-enabled", false, "whether the dashboard is enabled")
	mgrSidecarCmd.Flags().BoolVar(&clusterSpec.Monitoring.Enabled, "monitoring-enabled", false, "whether the monitoring is enabled")
	mgrSidecarCmd.Flags().StringVar(&updateMgrServicesInterval, "update-interval", "", "the interval at which to update the mgr services")
	mgrSidecarCmd.Flags().StringVar(&ownerRefID, "cluster-id", "", "the UID of the cluster CR that owns this cluster")
	mgrSidecarCmd.Flags().StringVar(&clusterName, "cluster-name", "", "the name of the cluster CR that owns this cluster")
	mgrSidecarCmd.Flags().StringVar(&daemonName, "daemon-name", "", "the name of the local mgr daemon")
	mgrSidecarCmd.Flags().StringVar(&rawCephVersion, "ceph-version", "", "the version of ceph")

	flags.SetFlagsFromEnv(mgrCmd.Flags(), rook.RookEnvVarPrefix)
	flags.SetFlagsFromEnv(mgrSidecarCmd.Flags(), rook.RookEnvVarPrefix)
	mgrSidecarCmd.RunE = runMgrSidecar
}

// Start the mgr daemon sidecar
func runMgrSidecar(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()
	clusterInfo.Context = cmd.Context()

	if err := readCephSecret(path.Join(mon.CephSecretMountPath, mon.CephSecretFilename)); err != nil {
		rook.TerminateFatal(err)
	}

	context := createContext()
	clusterInfo.InternalMonitors = opcontroller.ParseMonEndpoints(cfg.monEndpoints)
	rook.LogStartupInfo(mgrSidecarCmd.Flags())

	ownerRef := opcontroller.ClusterOwnerRef(clusterName, ownerRefID)
	clusterInfo.OwnerInfo = k8sutil.NewOwnerInfoWithOwnerRef(&ownerRef, clusterInfo.Namespace)

	if err := client.WriteCephConfig(context, &clusterInfo); err != nil {
		rook.TerminateFatal(err)
	}

	interval, err := time.ParseDuration(updateMgrServicesInterval)
	if err != nil {
		rook.TerminateFatal(err)
	}

	version, err := cephver.ExtractCephVersion(rawCephVersion)
	if err != nil {
		rook.TerminateFatal(err)
	}
	clusterInfo.CephVersion = *version

	activeMgr := "unknown"
	for {
		activeMgr, err = reconcileMgr(context, activeMgr)
		if err != nil {
			logger.Errorf("failed to reconcile services. %v", err)
		} else {
			logger.Infof("successfully checked mgr_role label. checking again in %ds", (int)(interval.Seconds()))
		}
		time.Sleep(interval)
	}
}

// reconcileMgr polls active manager name from Ceph cluster and updates mgr Pod 'mgr_role' label accordingly.
func reconcileMgr(context *clusterd.Context, prevActiveMgr string) (string, error) {
	logger.Infof("Checking mgr_role label value of daemon %s (prev active mgr was %s)", daemonName, prevActiveMgr)

	m := mgr.New(context, &clusterInfo, clusterSpec, "")
	currActiveMgr, err := m.GetActiveMgr()
	if err != nil {
		return "", fmt.Errorf("unable to get active mgr: %w", err)
	}

	if currActiveMgr == prevActiveMgr {
		logger.Infof("active mgr is still the same (%s). No need to update mgr_role label on daemon %s.", currActiveMgr, daemonName)
		return currActiveMgr, nil
	}

	// Active manager has changed
	// Actualise ceph cluster spec to correctly preserve monitoring labels
	cephCluster, err := context.RookClientset.CephV1().CephClusters(clusterInfo.Namespace).Get(clusterInfo.Context, clusterName, v1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("unable to get ceph cluster spec: %w", err)
	}
	m = mgr.New(context, &clusterInfo, cephCluster.Spec, "")

	isActive := daemonName == currActiveMgr
	// update labels:
	err = m.SetMgrRoleLabel(daemonName, isActive)
	if err != nil {
		return "", fmt.Errorf("failed to set active mgr labels: %w", err)
	}
	return currActiveMgr, nil
}

```

### Core Architecture Module: `cmd/rook/ceph/operator.go`
```
/*
Copyright 2016 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package ceph

import (
	"flag"
	"os"

	"github.com/pkg/errors"
	"github.com/rook/rook/cmd/rook/rook"
	operator "github.com/rook/rook/pkg/operator/ceph"
	opcontroller "github.com/rook/rook/pkg/operator/ceph/controller"
	"github.com/rook/rook/pkg/operator/k8sutil"
	"github.com/rook/rook/pkg/util/flags"
	"github.com/spf13/cobra"
)

const (
	containerName = "rook-ceph-operator"
)

var operatorCmd = &cobra.Command{
	Use:   "operator",
	Short: "Runs the Ceph operator for orchestrating and managing Ceph storage in a Kubernetes cluster",
	Long: `Runs the Ceph operator for orchestrating and managing Ceph storage in a Kubernetes cluster
https://github.com/rook/rook`,
}

func init() {
	operatorCmd.Flags().BoolVar(&operator.EnableMachineDisruptionBudget, "enable-machine-disruption-budget", false, "enable fencing controllers")

	flags.SetFlagsFromEnv(operatorCmd.Flags(), rook.RookEnvVarPrefix)
	operatorCmd.Flags().AddGoFlagSet(flag.CommandLine)
	if err := operatorCmd.Flags().Parse(nil); err != nil {
		panic(err)
	}
	operatorCmd.RunE = startOperator
}

func startOperator(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()
	rook.LogStartupInfo(operatorCmd.Flags())

	logger.Info("starting Rook-Ceph operator")
	context := createContext()
	context.ConfigDir = k8sutil.DataDir

	// Fail if operator namespace is not provided
	if os.Getenv(k8sutil.PodNamespaceEnvVar) == "" {
		rook.TerminateFatal(errors.Errorf("rook operator namespace is not provided. expose it via downward API in the rook operator manifest file using environment variable %q", k8sutil.PodNamespaceEnvVar))
	}

	rook.CheckOperatorResources(cmd.Context(), context.Clientset, containerName)
	rookImage := rook.GetOperatorImage(cmd.Context(), context.Clientset, containerName)
	rookBaseImageCephVersion, err := rook.GetOperatorBaseImageCephVersion(context)
	if err != nil {
		logger.Errorf("failed to get operator base image ceph version. %v", err)
	}
	opcontroller.OperatorCephBaseImageVersion = rookBaseImageCephVersion
	logger.Infof("base ceph version inside the rook operator image is %q", opcontroller.OperatorCephBaseImageVersion)

	serviceAccountName := rook.GetOperatorServiceAccount(cmd.Context(), context.Clientset)
	op := operator.New(context, rookImage, serviceAccountName)
	err = op.Run()
	if err != nil {
		rook.TerminateFatal(errors.Wrap(err, "failed to run operator"))
	}

	return nil
}

```

### Core Architecture Module: `cmd/rook/ceph/osd.go`
```
/*
Copyright 2016 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package ceph

import (
	"context"
	"encoding/json"
	"os"
	"path"
	"strconv"
	"strings"

	"k8s.io/client-go/kubernetes"

	"github.com/pkg/errors"
	"github.com/rook/rook/cmd/rook/rook"
	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
	"github.com/rook/rook/pkg/daemon/ceph/client"
	osddaemon "github.com/rook/rook/pkg/daemon/ceph/osd"
	"github.com/rook/rook/pkg/operator/ceph/cluster/mon"
	oposd "github.com/rook/rook/pkg/operator/ceph/cluster/osd"
	osdcfg "github.com/rook/rook/pkg/operator/ceph/cluster/osd/config"
	opcontroller "github.com/rook/rook/pkg/operator/ceph/controller"
	"github.com/rook/rook/pkg/operator/k8sutil"
	"github.com/rook/rook/pkg/util/flags"
	"github.com/spf13/cobra"
)

var osdCmd = &cobra.Command{
	Use:   "osd",
	Short: "Provisions and runs the osd daemon",
}

var osdConfigCmd = &cobra.Command{
	Use:   "init",
	Short: "Updates ceph.conf for the osd",
}

var provisionCmd = &cobra.Command{
	Use:   "provision",
	Short: "Generates osd config and prepares an osd for runtime",
}

var osdStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Starts the osd daemon", // OSDs that were provisioned by ceph-volume
}

var osdRemoveCmd = &cobra.Command{
	Use:   "remove",
	Short: "Removes a set of OSDs from the cluster",
}

var osdCloseEncryptedDevicesCmd = &cobra.Command{
	Use:   "close-encrypted-devices",
	Short: "Closes the host dm-crypt mappings for an encrypted OSD being replaced",
}

var (
	osdDataDeviceFilter          string
	osdDataDevicePathFilter      string
	ownerRefID                   string
	clusterName                  string
	osdID                        int
	migrateOSDID                 int
	osdStoreType                 string
	osdStringID                  string
	osdUUID                      string
	osdIsDevice                  bool
	pvcBackedOSD                 bool
	blockPath                    string
	lvBackedPV                   bool
	osdIDsToRemove               string
	preservePVC                  string
	forceOSDRemoval              string
	wipeDevicesFromOtherClusters bool
)

const (
	//#nosec G101 -- This is only an env var name
	fallbackCephSecretEnvVar = "ROOK_CEPH_SECRET"
)

func addOSDFlags(command *cobra.Command) {
	addOSDConfigFlags(osdConfigCmd)
	addOSDConfigFlags(provisionCmd)

	// flags specific to provisioning
	provisionCmd.Flags().IntVar(&migrateOSDID, "migrate-osd", -1, "osd to migrate in place")
	provisionCmd.Flags().StringVar(&cfg.devices, "data-devices", "", "comma separated list of devices to use for storage")
	provisionCmd.Flags().StringVar(&osdDataDeviceFilter, "data-device-filter", "", "a regex filter for the device names to use, or \"all\"")
	provisionCmd.Flags().StringVar(&osdDataDevicePathFilter, "data-device-path-filter", "", "a regex filter for the device path names to use")
	provisionCmd.Flags().StringVar(&cfg.metadataDevice, "metadata-device", "", "device to use for metadata (e.g. a high performance SSD/NVMe device)")
	provisionCmd.Flags().BoolVar(&cfg.forceFormat, "force-format", false,
		"true to force the format of any specified devices, even if they already have a filesystem.  BE CAREFUL!")
	provisionCmd.Flags().BoolVar(&cfg.pvcBacked, "pvc-backed-osd", false, "true to specify a block mode pvc is backing the OSD")
	provisionCmd.Flags().BoolVar(&wipeDevicesFromOtherClusters, "wipe-devices-from-other-clusters", false, "wipe the OSD devices that are configured for a different ceph cluster")
	// flags for generating the osd config
	osdConfigCmd.Flags().IntVar(&osdID, "osd-id", -1, "osd id for which to generate config")
	osdConfigCmd.Flags().BoolVar(&osdIsDevice, "is-device", false, "whether the osd is a device")

	// flags for running osds that were provisioned by ceph-volume
	osdStartCmd.Flags().StringVar(&osdStringID, "osd-id", "", "the osd ID")
	osdStartCmd.Flags().StringVar(&osdUUID, "osd-uuid", "", "the osd UUID")
	osdStartCmd.Flags().StringVar(&osdStoreType, "osd-store-type", "", "the osd store type such as bluestore")
	osdStartCmd.Flags().BoolVar(&pvcBackedOSD, "pvc-backed-osd", false, "Whether the OSD backing store in PVC or not")
	osdStartCmd.Flags().StringVar(&blockPath, "block-path", "", "Block path for the OSD created by ceph-volume")
	osdStartCmd.Flags().BoolVar(&lvBackedPV, "lv-backed-pv", false, "Whether the PV located on LV")

	// flags for removing OSDs that are unhealthy or otherwise should be purged from the cluster
	osdRemoveCmd.Flags().StringVar(&osdIDsToRemove, "osd-ids", "", "OSD IDs to remove from the cluster")
	osdRemoveCmd.Flags().StringVar(&preservePVC, "preserve-pvc", "false", "Whether PVCs for OSDs will be deleted")
	osdRemoveCmd.Flags().StringVar(&forceOSDRemoval, "force-osd-removal", "false", "Whether to force remove the OSD")

	// flags for closing the dm-crypt mappings of an encrypted OSD being replaced
	osdCloseEncryptedDevicesCmd.Flags().IntVar(&osdID, "osd-id", -1, "the id of the encrypted OSD whose dm-crypt mappings should be closed")

	// add the subcommands to the parent osd command
	osdCmd.AddCommand(osdConfigCmd,
		provisionCmd,
		osdStartCmd,
		osdRemoveCmd,
		osdCloseEncryptedDevicesCmd)
}

func addOSDConfigFlags(command *cobra.Command) {
	command.Flags().StringVar(&ownerRefID, "cluster-id", "", "the UID of the cluster CR that owns this cluster")
	command.Flags().StringVar(&clusterName, "cluster-name", "", "the name of the cluster CR that owns this cluster")
	command.Flags().StringVar(&cfg.location, "location", "", "location of this node for CRUSH placement")
	command.Flags().StringVar(&cfg.nodeName, "node-name", os.Getenv("HOSTNAME"), "the host name of the node")

	// OSD store config flags
	command.Flags().IntVar(&cfg.storeConfig.WalSizeMB, "osd-wal-size", osdcfg.WalDefaultSizeMB, "default size (MB) for OSD write ahead log (WAL) (bluestore)")
	command.Flags().IntVar(&cfg.storeConfig.DatabaseSizeMB, "osd-database-size", 0, "default size (MB) for OSD database (bluestore)")
	command.Flags().IntVar(&cfg.storeConfig.OSDsPerDevice, "osds-per-device", 1, "the number of OSDs per device")
	command.Flags().BoolVar(&cfg.storeConfig.EncryptedDevice, "encrypted-device", false, "whether to encrypt the OSD with dmcrypt")
	command.Flags().StringVar(&cfg.storeConfig.DeviceClass, "osd-crush-device-class", "", "The device class for all OSDs configured on this node")
	command.Flags().StringVar(&cfg.storeConfig.InitialWeight, "osd-crush-initial-weight", "", "The initial weight of OSD in TiB units")
	command.Flags().StringVar(&cfg.storeConfig.StoreType, "osd-store-type", string(cephv1.StoreTypeBlueStore), "the osd store type such as bluestore")
}

func init() {
	addOSDFlags(osdCmd)
	addCephFlags(osdCmd)
	flags.SetFlagsFromEnv(osdCmd.Flags(), rook.RookEnvVarPrefix)
	flags.SetFlagsFromEnv(osdConfigCmd.Flags(), rook.RookEnvVarPrefix)
	flags.SetFlagsFromEnv(provisionCmd.Flags(), rook.RookEnvVarPrefix)
	flags.SetFlagsFromEnv(osdStartCmd.Flags(), rook.RookEnvVarPrefix)
	flags.SetFlagsFromEnv(osdRemoveCmd.Flags(), rook.RookEnvVarPrefix)

	osdConfigCmd.RunE = writeOSDConfig
	provisionCmd.RunE = prepareOSD
	osdStartCmd.RunE = startOSD
	osdRemoveCmd.RunE = removeOSDs
	osdCloseEncryptedDevicesCmd.RunE = closeEncryptedDevices
}

// closeEncryptedDevices closes the host dm-crypt mappings of an encrypted OSD being replaced. It runs
// in a privileged Job on the OSD's node and needs no Ceph auth or KMS key material, so it loads
// neither the Ceph secret nor mon endpoints.
func closeEncryptedDevices(cmd *cobra.
```

### Core Architecture Module: `cmd/rook/discover.go`
```
/*
Copyright 2018 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package main

import (
	"time"

	rook "github.com/rook/rook/cmd/rook/rook"
	"github.com/rook/rook/pkg/daemon/discover"
	"github.com/rook/rook/pkg/util/flags"
	"github.com/spf13/cobra"
)

var (
	discoverCmd = &cobra.Command{
		Use:    "discover",
		Short:  "Discover devices",
		Hidden: true, // do not advertise to end users
	}

	// interval between discovering devices
	discoverDevicesInterval time.Duration

	// Uses ceph-volume inventory to extend device information
	usesCVInventory bool
)

func init() {
	discoverCmd.Flags().DurationVar(&discoverDevicesInterval, "discover-interval", 60*time.Minute, "interval between discovering devices (default 60m)")
	discoverCmd.Flags().BoolVar(&usesCVInventory, "use-ceph-volume", false, "Use ceph-volume inventory to extend storage devices information (default false)")

	flags.SetFlagsFromEnv(discoverCmd.Flags(), rook.RookEnvVarPrefix)
	discoverCmd.RunE = startDiscover
}

func startDiscover(cmd *cobra.Command, args []string) error {
	rook.SetLogLevel()

	rook.LogStartupInfo(discoverCmd.Flags())

	context := rook.NewContext()
	ctx := cmd.Context()

	err := discover.Run(ctx, context, discoverDevicesInterval, usesCVInventory)
	if err != nil {
		rook.TerminateFatal(err)
	}

	return nil
}

```

### Core Architecture Module: `cmd/rook/main.go`
```
/*
Copyright 2016 The Rook Authors. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package main

import (
	"fmt"

	"github.com/rook/rook/cmd/rook/ceph"
	rook "github.com/rook/rook/cmd/rook/rook"
	"github.com/rook/rook/cmd/rook/userfacing"
	"github.com/rook/rook/cmd/rook/util"
	"github.com/rook/rook/cmd/rook/version"
)

func main() {
	addCommands()
	if err := rook.RootCmd.Execute(); err != nil {
		fmt.Printf("rook error: %+v\n", err)
	}
}

func addCommands() {
	rook.RootCmd.AddCommand(
		version.VersionCmd,
		discoverCmd,
		KeyManagementCmd,
		// backend commands
		ceph.Cmd,

		// util commands
		util.CmdReporterCmd,
	)
	// do double diligence to ensure non-user-facing commands are hidden from end users
	for _, cmd := range rook.RootCmd.Commands() {
		cmd.Hidden = true
	}

	// all user-facing commands
	rook.RootCmd.AddCommand(userfacing.Commands...)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18427** (2026-09-21): **`util.retry` is stuck for 600 seconds if the cephCluster is updated while retry is running.**
  *Symptoms*: <!-- **Are you in the right place?** 1. For issues or feature requests, please create an issue in this repository. 2. For general technical and non-technical questions, we are happy to help you on our [Rook.io Slack](https://slack.rook.io/). 3. Did you already search the existing open issues for anything similar? -->  **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:** - util.retry retries with cancelled context.  **Expected behavior:** - util.retry should stop retrying with cancelled context.  **How to reproduce it (minimal and precise):** <!-- Please let us know any circumstances for reproduction of your bug. --> - Update the cephcluster such that operator will check `ok-to-stop` on mons. For example, upgrade cluster.  - Ensure that `ok-to-stop` logic is retried.  - Now update the cephCluster so that operator manager is reloaded.    **File(s) to submit**:  * Cluster CR (custom resource), typically called `cluster.yaml`, if necessary  **Logs to submit**:  ``` 618:  2026-09-07T01:53:51.754194172Z  util: retrying after 1m0s, last error: deployment rook-ceph-mon-a cannot be stopped. . Error EBUSY: not enough monitors would be available (b) after stopping mons a: exit status 16   1434: 2026-09-07T01:54:51.754426823Z  util: retrying after 1m0s, last error: deployment rook-ceph-mon-a cannot be stopped. : context canceled   1500: 2026-09-07T01:55:51.755376250Z  util: retrying after 1m0s, last error: deployment rook-ceph-mon-a cannot be s

- **Issue #18398** (2026-09-16): **Changing the default pool placement makes objects in existing buckets unreadable**
  *Symptoms*: ### Affected versions  all(1.18+)  ### Steps to reproduce  Store with two placements, `p1` default:  ```yaml spec:   sharedPools:     poolPlacements:       - {name: p1, default: true, metadataPoolName: p1-meta, dataPoolName: p1-data}       - {name: p2,                metadataPoolName: p2-meta, dataPoolName: p2-data} ```  ``` PUT /b1   LocationConstraint: <zonegroup>:default-placement PUT /b1/obj   body: DATA GET /b1/obj   -> 200 DATA ```  Move `default: true` from `p1` to `p2`, wait for reconcile, restart the RGW pod:  ``` GET /                  -> 200, b1 still listed GET /b1?list-type=2    -> 200, zero keys GET /b1/obj            -> 404 NoSuchKey ```  Nothing is deleted — the object is still in `p1-data`. Moving `default: true` back to `p1` restores access.  #### Which buckets are affected  Only buckets whose `placement_rule` is `default-placement`. Buckets on a named placement (`p1`, `p2`, …) are never affected — Rook does not re-point those entries.  ### Cause  In RGW, placement is split across the two JSONs:  - **zonegroup** — which placement names exist, and which one is the default:    ```json   {     "default_placement": "p1",     "placement_targets": [       {"name": "default-placement"}, {"name": "p1"}, {"name": "p2"}     ]   }   ```  - **zone** — what pools each of those names actually maps to:    ```json   {     "placement_pools": [       {"key": "default-placement", "val": {"index_pool": "p1-meta:...", "storage_classes": {"STANDARD": {"data_pool": "p1-data:..."}}

- **Issue #18379** (2026-09-14): **osd: callCephVolume logs ceph.cephx_lockbox_secret at DEBUG, the level OSD jobs are pinned to**
  *Symptoms*: > This is @jhoblitt's AI agent.  **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:**  `callCephVolume` logs the full `ceph-volume` response at DEBUG on every successful call:  https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/daemon/ceph/osd/volume.go#L1590  and at ERROR when the call fails:  https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/daemon/ceph/osd/volume.go#L1583  For `ceph-volume lvm list` and `ceph-volume raw list`, that response carries the `ceph.cephx_lockbox_secret` tag for every encrypted OSD, so the lockbox secret lands in the OSD prepare pod log on every reconcile. It is not opt-in: every OSD-side job pins its own log level to DEBUG regardless of what the operator runs at —  - provision: https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/operator/ceph/cluster/osd/provision_spec.go#L206 - key rotation: https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/operator/ceph/cluster/osd/key_rotation.go#L72 - replace: https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930e5/pkg/operator/ceph/cluster/osd/replace_job.go#L135  This sits outside the model `pkg/util/logging.go` establishes, where DEBUG is meant to be credential-free and only the undocumented `ROOK_LOG_LEVEL=TRACE_INSECURE` unlocks output that may carry secrets:  https://github.com/rook/rook/blob/ed913a842168d8620d972a9563390a294c1930
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this.
  > On second look I won't be able to pick this one up right now — leaving it available for someone else.
  > I will take this. Plan: redact the lockbox secret from the ceph-volume response before `callCephVolume` logs it at DEBUG, with a unit test that feeds a response containing `ceph.cephx_lockbox_secret` and asserts the logged text does not.

- **Issue #18370** (2026-09-21): **Ceph mons wedge / never hold quorum on Ubuntu 26.04 HA (kernel 7.0.0-31-generic); identical stack healthy on 22.04**
  *Symptoms*: Is this a bug report or feature request? - Bug Report  Deviation from expected behavior:  On a fresh HA cluster with nodes running Ubuntu 26.04 (kernel 7.0.0-31-generic), the Ceph MONs cannot hold a stable quorum. The cluster briefly reaches HEALTH_OK (~6 minutes) and then flaps to HEALTH_ERR with failed to get status ... timed out. MONs settle into probing/electing and never re-form quorum. At least one MON process wedges: its local admin socket becomes unresponsive (ceph --admin-daemon /run/ceph/ceph-mon.<id>.asok mon_status hangs / times out), while the process sits in State: S on futex_do_wait at ~0% CPU (only a few seconds of CPU over 20+ minutes). MON logs repeatedly show:  cephx server client.admin: handle_request failed to decode CephXAuthenticate: End of buffer [buffer:2]  Because quorum never stabilizes, the operator keeps skipping reconcile since ceph health is HEALTH_ERR, and CephBlockPool/rbdpool never leaves Progressing, so the install blocks waiting for it to become Ready.  Key point: the identical Rook + Ceph + Kubernetes stack is healthy on Ubuntu 22.04 HA, and the same 26.04 image works fine in single-node mode (which does not deploy Ceph). The failure appears only on Ubuntu 26.04 in the HA (multi-MON) configuration.  Expected behavior:  MONs form a stable quorum, the MON admin socket stays responsive, ceph status returns HEALTH_OK with mon: 3 daemons, quorum a,b,c, and CephBlockPool/rbdpool reaches Ready — exactly as it does with the same stack on Ubuntu 22
  **Post-Mortem & Fix Analysis**:
  > If the mons are not maintaining quorum, the kernel or nftables sound like they could be related since those are the main differences in the env. There are no other networking differences? You might open a [Ceph tracker](https://tracker.ceph.com/) to see if the core ceph team knows of any issues with that config. 
  > > If the mons are not maintaining quorum, the kernel or nftables sound like they could be related since those are the main differences in the env. There are no other networking differences? You might open a [Ceph tracker](https://tracker.ceph.com/) to see if the core ceph team knows of any issues with that config.  Thanks — we chased the networking angle you pointed at. Findings:  kube-proxy runs in IPVS mode, and Rook advertises the mons on Service ClusterIPs, so all mon↔mon msgr traffic is IPVS-load-balanced. On Ubuntu 26.04 (Linux 7.0.0-31-generic), kube-proxy's IPVS conntrack workarounds are gated on kernel version and don't recognize 7.0, so it left:    - net.netfilter.nf_conntrack_tcp_be_liberal = 0 (should be 1 for IPVS)    - net.ipv4.vs.conn_reuse_mode = 1 (the classic kubernetes#81775 issue)   We set both correctly on every node (be_liberal=1, conn_reuse_mode=0). It helps but doesn't fully fix it — on a fresh HA install the mon quorum still flaps (quorum_age resets to seconds;
  > Ceph-tracker is here btw. https://tracker.ceph.com/issues/80470  No assigners or replies as of now.

- **Issue #18291** (2026-08-26): **security.cephx.*.keyGeneration CRD schema invalid: uint32 Maximum exceeds int32 format bound**
  *Symptoms*: ## Bug Report  **Is this a bug report or feature request?** * Bug Report  ### Deviation from expected behavior  Setting `spec.security.cephx.daemon.keyRotationPolicy: KeyGeneration` plus any `spec.security.cephx.daemon.keyGeneration` value on a `CephCluster` fails Kubernetes API server validation, regardless of the value supplied:  ``` CephCluster.ceph.rook.io "storage" is invalid: <nil>: Invalid value: "": Maximum boundary value must be of type integer with format int32 in spec.security.cephx.daemon.keyGeneration ```  This makes it impossible to use the new CephX key rotation feature (introduced to remediate CVE-2025-30156) for daemon keys on any cluster running this CRD version. The same struct (`CephxConfig`) is reused for `security.cephx.csi` and `security.cephx.rbdMirrorPeer`, so those are presumably affected identically, though I have only reproduced it against `daemon`.  ### Expected behavior  Setting a valid, increasing `keyGeneration` value (e.g. `2`) with `keyRotationPolicy: KeyGeneration` should be accepted by the API server and trigger key rotation as documented in [CephX Keys and Rotation](https://rook.io/docs/rook/latest-release/Storage-Configuration/Advanced/cephx-key-rotation/).  ### How to reproduce it  1. Run Rook v1.20.6 (bug also present on `master` as of 2026-08-26 — see root cause below). 2. Apply a `CephCluster` (via Helm `rook-ceph-cluster` chart or directly) with:    ```yaml    spec:      security:        cephx:          daemon:            keyRotation
  **Post-Mortem & Fix Analysis**:
  > It appears you are using an old CRD version. The latest has a new kubebuilder directive on the type that resolves the issue: `// +kubebuilder:validation:Format=int64`  https://github.com/rook/rook/blob/ba8a5e4cad2b8267832a3158f379b25888572b19/pkg/apis/ceph.rook.io/v1/types.go#L398-L409 
  > Thanks for confirming and for the quick turnaround!  I can see the +kubebuilder:validation:Format=int64 annotation is already merged on release-1.20/master. 

- **Issue #18287** (2026-08-27): **configureStretchCluster unconditionally sets election strategy, breaking all reconciles on stretch clusters running Ceph Squid**
  *Symptoms*: **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:**  On a stretch cluster that is already in stretch mode, every `CephCluster` reconcile fails after upgrading Ceph from Reef to Squid:  ``` failed to reconcile CephCluster "rook-ceph/rook-ceph": failed to reconcile cluster "rook-ceph": failed to configure local ceph cluster: failed to create cluster: failed to start ceph monitors: failed to configure stretch mons: failed to enable stretch cluster: failed to enable stretch cluster election strategy: exit status 22 ```  The `CephCluster` CR never leaves `Progressing` / `"Configuring Ceph Mons"`. Other controllers (`op-mon`, `ceph-csi`, `cephclient`, `op-config`) keep working and the Ceph cluster stays `HEALTH_OK` and fully serving, but no `CephCluster` spec change is ever applied and Rook will not create or replace mon/OSD daemons.  The underlying Ceph call fails because **Squid added a guard that Reef did not have**:  ``` $ ceph mon set election_strategy connectivity Error EINVAL: Stretch mode is enabled, so you cannot change the election strategy; please disable stretch mode first! ```  Under Reef this call was a harmless no-op when the strategy was already `connectivity`, so the unconditional call went unnoticed.  **Cause:** `pkg/operator/ceph/cluster/mon/mon.go` — `configureStretchCluster()` calls `EnableStretchElectionStrategy()` unconditionally, and `startMons` invokes it on every reconcile whenever `c.spec.IsStretchCluster()`:  
  **Post-Mortem & Fix Analysis**:
  > I see the change in https://github.com/ceph/ceph/pull/59515, which based on the backports recently, expect it's included in: - Squd 19.2.5 - Tentacle 20.2.3  @kamoltat Is it expected that an idempotent request to set the election strategy be rejected? Rook's general pattern is to make idempotent calls, so it seems we need to change this to first check before calling. 
  > Hi @travisn, honestly I should have made it in such a way that idempotent requests are safe. Given the currently situation, it might be faster to fix this on the rook side. However, I can also make the changes on Ceph's side, plus going forward I will make sure Ceph is designed to handle idempotent requests safely.
  > @kamoltat Thanks for the confirmation, we will go ahead with the fix on the Rook side for now. 

- **Issue #18256** (2026-08-27): **muteHealthWarning is applied infinitely in a loop**
  *Symptoms*: <!-- **Are you in the right place?** 1. For issues or feature requests, please create an issue in this repository. 2. For general technical and non-technical questions, we are happy to help you on our [Rook.io Slack](https://slack.rook.io/). 3. Did you already search the existing open issues for anything similar? -->  **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:** As I'm running a cluster on some nodes with kernel <7 - I still need to continue using the older `aes` key format, hence I muted the warnings in the config:  ```yaml     muteHealthWarning:       AUTH_INSECURE_SERVICE_KEY_TYPE:         policy: mute       AUTH_INSECURE_SERVICE_TICKETS:         policy: mute ``` yet, the `INFO` level message is emitted on every loop infinitely now ``` 2026-08-24 01:25:13.189720 I | cephclient: [rook-ceph] successfully configured health warning mute "AUTH_INSECURE_SERVICE_KEY_TYPE"="mute"  2026-08-24 01:25:14.234219 I | cephclient: [rook-ceph] successfully configured health warning mute "AUTH_INSECURE_SERVICE_TICKETS"="mute" ``` The cluster health detail looks as expected - muted as sticky:  ``` (MUTED, STICKY) [ERR] AUTH_INSECURE_SERVICE_KEY_TYPE: 6 auth service entities with insecure key types     entity mon. using insecure key type: aes     entity osd.0 using insecure key type: aes     entity osd.1 using insecure key type: aes     entity osd.2 using insecure key type: aes     entity osd.3 using insecure key type: aes     entity mgr.a u
  **Post-Mortem & Fix Analysis**:
  > @zerkms To be clear, how often are you seeing the log messages? Once every reconcile? Or they are continuously printing and filling up your log?   edit: Nevermind, I see now it's printing every 60s in the log.
  > As a workaround, you could just remove the muteHealthWarning settings from the cephcluster CR and the warnings would remain muted.
  > > remove the muteHealthWarning settings from the cephcluster CR and the warnings would remain muted.  Oh, would that also be an expected behaviour? It almost feels that if you remove a mute - it should remove it from the ceph runtime state.

- **Issue #18254** (2026-08-24): **volume attachment is being deleted after node drain (migrating keys)**
  *Symptoms*: **Is this a bug report or feature request?** * Bug Report  **Deviation from expected behavior:**  After `kubectl drain` and `kubectl uncordon` pods mounting pvcs won't come up.  **Expected behavior:**  pods come up as normal.  **How to reproduce it (minimal and precise):**  After upgrading to v1.20.6 I followed "CephX Keys and Rotation" from the documentation. This went fine until section "Migrating CSI keys to a new key type" number 5.  I did `kubectl drain --ignore-daemonsets --delete-emptydir-data node1` and waited for the node to successfully draining. Then I did `kubectl uncordon node1`. I waited for `ceph status` to show that everything is back to normal (and degradation is treated).  But some pods remained in state 'ContainerCreating'. Looking at describe pod shows something like this: ```   Warning  FailedAttachVolume  4m20s (x739 over 19m)  attachdetach-controller  AttachVolume.Attach failed for volume "pvc-b9dda9de-bbaf-42ae-b68f-accc35d4a12d" : rpc error: code = Internal desc = failed to find volume "0001-0009-rook-ceph-0000000000000002-1ff3d126-80fd-42d8-8ec7-a684a20140e6" for service account check: failed to establish the connection: failed to get connection: connecting failed: rados: ret=-22, Invalid argument ```  After `kubectl delete pod` to force a restart I see:  ```   Warning  FailedAttachVolume  3m15s (x500 over 13m)  attachdetach-controller  AttachVolume.Attach failed for volume "pvc-75b7d4d8-d1ab-484b-bbad-07e71cdab7ce" : volume attachment is being delet
  **Post-Mortem & Fix Analysis**:
  > Since I have trouble uploading the file, here is the cluster.yaml. I'm using helm for deployment.  ```yaml # try solving slow operations in BlueStore warning # see: https://github.com/rook/rook/discussions/15403 # -- Cluster ceph.conf override # configOverride: configOverride: |   [global]   bdev_enable_discard = false   bluestore_slow_ops_warn_lifetime = 60   bluestore_slow_ops_warn_threshold = 10    osd_scrub_begin_hour = 22   osd_scrub_end_hour = 10   osd_scrub_max_interval = 1209600  # 14 days (in seconds)   osd_scrub_min_interval = 259200   # 3 days   osd_deep_scrub_interval = 1209600 # 14 days  # Installs a debugging toolbox deployment toolbox:   # -- Enable Ceph debugging pod deployment. See [toolbox](../Troubleshooting/ceph-toolbox.md)   enabled: true  monitoring:   # -- Enable Prometheus integration, will also create necessary RBAC rules to allow Operator to create ServiceMonitors.   # Monitoring requires Prometheus to be pre-installed   enabled: true   # -- Whether to create 
  > Looking in the logs of the ctrlplugin pods for both cephfs and rbd I see a lot of messages like  ``` E0822 18:24:33.622843       1 utils.go:366] ID: 557 Req-ID: 0001-0009-rook-ceph-0000000000000001-7d0979f7-b39b-42cd-a18c-5730513f91c6 GRPC error: rpc error: code = Internal desc = failed to generate volume from volume ID 0001-0009-rook-ceph-0000000000000001-7d0979f7-b39b-42cd-a18c-5730513f91c6: failed to get connection: connecting failed: rados: ret=-22, Invalid argument E0822 18:24:54.782780       1 utils.go:366] ID: 559 Req-ID: snapshot-7aa56d6b-b913-433e-90e3-9bdae34a0f15 GRPC error: rpc error: code = Internal desc = failed to get connection: connecting failed: rados: ret=-22, Invalid argument ```  Restarting both pods didn't change anything.
  > @pfaelzerchen I think this issue was identified and fixed in Ceph-CSI, with a new release this morning. https://github.com/ceph/ceph-csi/releases/tag/v3.17.1  Can you upgrade CSI to 3.17.1 and see if the issue is resolved?

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

### Incident Patch 1: `63ab8854` (2026-09-29)
**Commit Message**: Merge pull request #18453 from banlor/fix/pool-growth-threshold

monitoring: fix pool growth alert threshold

**File**: `deploy/charts/rook-ceph-cluster/prometheus/localrules.yaml` (modified, +1/-1)
```diff
@@ -566,7 +566,7 @@ groups:
         annotations:
           description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
           summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
         for: "1h"
         labels:
           oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

**File**: `deploy/charts/rook-ceph-cluster/tests/localrules.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Run from this directory with: promtool test rules localrules.yaml
+# Do not use the *_test.yaml suffix, which is reserved for helm-unittest suites.
+# Percent-used values from Ceph are fractions. A fast-growing pool must alert,
+# while a flat pool and a slow-growing pool must not.
+rule_files:
+  - ../prometheus/localrules.yaml
+evaluation_interval: 1h
+tests:
+  - interval: 1h
+    input_series:
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="1",instance="mgr-a"}'
+        values: '0.30+0.01x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="2",instance="mgr-a"}'
+        values: '0.20+0x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="3",instance="mgr-a"}'
+        values: '0.20+0.0002x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="1",name="growing",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="2",name="flat",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="3",name="slow",instance="mgr-a"}'
+        values: '1+0x48'
+    alert_rule_test:
+      - eval_time: 1h
+        alertname: CephPoolGrowthWarning
+        exp_alerts: [] # the 1h pending period has not elapsed
+      - eval_time: 2h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
+      - eval_time: 48h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
```

**File**: `deploy/examples/monitoring/localrules.yaml` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ spec:
           annotations:
             description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
             summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
           for: "1h"
           labels:
             oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

---

### Incident Patch 2: `41c99840` (2026-09-24)
**Commit Message**: monitoring: fix pool growth alert threshold

ceph_pool_percent_used reports a fraction, but the alert threshold
assumes a percentage. Change the threshold from 95 to 0.95 in the
Helm chart rules and example configuration. Keep for: 1h unchanged.

Add tests for fast-growing, slow-growing, and constant pool usage.
Exclude the test file from the packaged Helm chart.

Signed-off-by: Mikhail Basov <michael.s.basov@gmail.com>

**File**: `deploy/charts/rook-ceph-cluster/prometheus/localrules.yaml` (modified, +1/-1)
```diff
@@ -566,7 +566,7 @@ groups:
         annotations:
           description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
           summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+        expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
         for: "1h"
         labels:
           oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

**File**: `deploy/charts/rook-ceph-cluster/tests/localrules.yaml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Run from this directory with: promtool test rules localrules.yaml
+# Do not use the *_test.yaml suffix, which is reserved for helm-unittest suites.
+# Percent-used values from Ceph are fractions. A fast-growing pool must alert,
+# while a flat pool and a slow-growing pool must not.
+rule_files:
+  - ../prometheus/localrules.yaml
+evaluation_interval: 1h
+tests:
+  - interval: 1h
+    input_series:
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="1",instance="mgr-a"}'
+        values: '0.30+0.01x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="2",instance="mgr-a"}'
+        values: '0.20+0x48'
+      - series: 'ceph_pool_percent_used{cluster="mycluster",pool_id="3",instance="mgr-a"}'
+        values: '0.20+0.0002x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="1",name="growing",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="2",name="flat",instance="mgr-a"}'
+        values: '1+0x48'
+      - series: 'ceph_pool_metadata{cluster="mycluster",pool_id="3",name="slow",instance="mgr-a"}'
+        values: '1+0x48'
+    alert_rule_test:
+      - eval_time: 1h
+        alertname: CephPoolGrowthWarning
+        exp_alerts: [] # the 1h pending period has not elapsed
+      - eval_time: 2h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
+      - eval_time: 48h
+        alertname: CephPoolGrowthWarning
+        exp_alerts:
+          - exp_labels:
+              cluster: mycluster
+              pool_id: "1"
+              name: growing
+              severity: warning
+              type: ceph_default
+              oid: 1.3.6.1.4.1.50495.1.2.1.9.2
+            exp_annotations:
+              summary: Pool growth rate may soon exceed capacity on cluster mycluster
+              description: Pool 'growing' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours.
```

**File**: `deploy/examples/monitoring/localrules.yaml` (modified, +1/-1)
```diff
@@ -571,7 +571,7 @@ spec:
           annotations:
             description: "Pool '{{ $labels.name }}' will be full in less than 5 days assuming the average fill-up rate of the past 48 hours."
             summary: "Pool growth rate may soon exceed capacity on cluster {{ $labels.cluster }}"
-          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 95"
+          expr: "(predict_linear(avg by (cluster,pool_id) (ceph_pool_percent_used)[2d:], 3600 * 24 * 5) * on(cluster,pool_id) group_right() avg by (cluster,pool_id, name) (ceph_pool_metadata)) >= 0.95"
           for: "1h"
           labels:
             oid: "1.3.6.1.4.1.50495.1.2.1.9.2"
```

---

### Incident Patch 3: `328387d8` (2026-09-04)
**Commit Message**: security: drop command output from unmarshal error text

Three unmarshal failures wrapped their raw input into the returned error, and
that input is a credential-bearing command response in every case: a
radosgw-admin user document, which carries the user's S3 access and secret
keys, and ceph-volume list output, which carries ceph.cephx_lockbox_secret
for encrypted OSDs.

These errors do not stop at the operator log. The object store user error is
reported through ReportReconcileResult, which writes it to a Kubernetes event
and the CephObjectStore status, and the ceph-volume list error becomes
OrchestrationStatus.Message, which the OSD provisioning job writes to a
ConfigMap. Each is readable without the access needed to read the Secret the
value belongs in. The third site is the OSD replacement path, which carries
the same payload from the same command.

Report the response size in place of the response. A type error already names
the offending field, but json.SyntaxError reports only its own message and
never its offset, and a malformed response is the likelier failure for
ceph-volume list calls: callCephVolume avoids combined output precisely
because stderr contamination breaks t

**File**: `pkg/daemon/ceph/osd/replace.go` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ func cephVolumeLVMList(context *clusterd.Context, osdID int) ([]cvLVMListEntry,
 	}
 	var listResult map[string][]cvLVMListEntry
 	if err := json.Unmarshal([]byte(result), &listResult); err != nil {
-		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume lvm list result for osd.%d. %s", osdID, result)
+		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume lvm list result for osd.%d (%d bytes)", osdID, len(result))
 	}
 	return listResult[strconv.Itoa(osdID)], nil
 }
```

**File**: `pkg/daemon/ceph/osd/replace_test.go` (modified, +21/-0)
```diff
@@ -691,3 +691,24 @@ func TestIsCryptsetupNotActive(t *testing.T) {
 	assert.False(t, isCryptsetupNotActive(errors.New("exit status 1")))
 	assert.False(t, isCryptsetupNotActive(nil))
 }
+
+func TestCephVolumeLVMListParseFailureDoesNotLeakLockboxSecret(t *testing.T) {
+	// the raw ceph-volume response carries ceph.cephx_lockbox_secret even though
+	// osdTags does not map it, so the payload must not ride along with the error
+	const lockboxSecret = "EXAMPLELOCKBOXSECRET00000000000000000001"
+	badResult := `{"3": [{"type": "block", "path": 12345, "tags": {"ceph.encrypted": "1", "ceph.cephx_lockbox_secret": "` + lockboxSecret + `"}}]}`
+
+	executor := &exectest.MockExecutor{}
+	executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
+		if command == "stdbuf" && args[4] == "lvm" && args[5] == "list" {
+			return badResult, nil
+		}
+		return "", errors.Errorf("unknown command %s %s", command, args)
+	}
+
+	_, err := cephVolumeLVMList(&clusterd.Context{Executor: executor}, 3)
+
+	require.Error(t, err)
+	assert.NotContains(t, err.Error(), lockboxSecret)
+	assert.Contains(t, err.Error(), "cvLVMListEntry.path of type string")
+}
```

**File**: `pkg/daemon/ceph/osd/volume.go` (modified, +4/-1)
```diff
@@ -1220,7 +1220,10 @@ func GetCephVolumeLVMOSDs(context *clusterd.Context, clusterInfo *client.Cluster
 	var cephVolumeResult map[string][]osdInfo
 	err = json.Unmarshal([]byte(result), &cephVolumeResult)
 	if err != nil {
-		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume %s list results. %s", cvMode, result)
+		// the payload carries ceph.cephx_lockbox_secret for encrypted OSDs, and this
+		// error reaches the OSD status ConfigMap. A syntax error reports only its
+		// message, so report the response size in place of the response.
+		return nil, errors.Wrapf(err, "failed to unmarshal ceph-volume %s list results (%d bytes)", cvMode, len(result))
 	}
 
 	for name, osdInfo := range cephVolumeResult {
```

**File**: `pkg/daemon/ceph/osd/volume_test.go` (modified, +53/-0)
```diff
@@ -1870,6 +1870,59 @@ func TestCephVolumeResponseIsNotLoggedWithLockboxSecret(t *testing.T) {
 	assert.Contains(t, logOutput, "dbe407e0-c1cb-495e-b30a-02e01de6c8ae")
 }
 
+func TestCephVolumeLVMResultParseFailureDoesNotLeakLockboxSecret(t *testing.T) {
+	// ceph-volume list output carries ceph.cephx_lockbox_secret for encrypted OSDs.
+	// This error becomes OrchestrationStatus.Message, which the OSD provisioning job
+	// writes to a ConfigMap, so the payload must not ride along with it.
+	const lockboxSecret = "EXAMPLELOCKBOXSECRET00000000000000000001"
+	tags := `"tags": {"ceph.osd_fsid": "9ee6a1e7-1c3f-4c1e-9a5b-0c4b1f2d3e4f", "ceph.encrypted": "1", "ceph.cephx_lockbox_secret": "` + lockboxSecret + `"}`
+
+	tests := []struct {
+		name   string
+		result string
+		// the field a type error names; empty when the error is a syntax error,
+		// which reports only its own message
+		namesField string
+	}{
+		{
+			// path is a string in osdInfo, so a number is the shape a ceph-volume
+			// schema change would take
+			name:       "type error",
+			result:     `{"0": [{"name": "osd-block-9ee6a1e7", "path": 12345, ` + tags + `, "type": "block"}]}`,
+			namesField: "osdInfo.path of type string",
+		},
+		{
+			// callCephVolume warns that stderr contamination breaks the unmarshal, so
+			// a malformed response is the likelier failure here
+			name:   "truncated response",
+			result: `{"0": [{"name": "osd-block-9ee6a1e7", ` + tags,
+		},
+	}
+
+	for _, tc := range tests {
+		t.Run(tc.name, func(t *testing.T) {
+			executor := &exectest.MockExecutor{}
+			executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
+				if command == "stdbuf" && args[4] == "lvm" && args[5] == "list" {
+					return tc.result, nil
+				}
+				return "", errors.Errorf("unknown command %s %s", command, args)
+			}
+
+			context := &clusterd.Context{Executor: executor}
+			_, err := GetCephVolumeLVMOSDs(context, &cephclient.ClusterInfo{Namespace: "name"}, "4bfe8b72-5e69-4330-b6c0-4d914db8ab89", "", false, false)
+
+			require.Error(t, err)
+			assert.NotContains(t, err.Error(), lockboxSecret)
+			// the response size is the only context a syntax error leaves
+			assert.Contains(t, err.Error(), fmt.Sprintf("(%d bytes)", len(tc.result)))
+			if tc.namesField != "" {
+				assert.Contains(t, err.Error(), tc.namesField)
+			}
+		})
+	}
+}
+
 func TestParseCephVolumeRawResult(t *testing.T) {
 	executor := &exectest.MockExecutor{}
 	executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
```

**File**: `pkg/operator/ceph/object/user.go` (modified, +5/-1)
```diff
@@ -56,7 +56,11 @@ func decodeUser(data string) (*ObjectUser, int, error) {
 	var user admin.User
 	err := json.Unmarshal([]byte(data), &user)
 	if err != nil {
-		return nil, RGWErrorParse, errors.Wrapf(err, "failed to unmarshal json. %s", data)
+		// the payload is a radosgw-admin user document, which carries the user's S3
+		// keys. A type error names the offending field, but a syntax error reports
+		// only its message, so report the response size in its place.
+		logger.Tracef("failed to unmarshal user json: %s", data) // only trace(insecure) logged because the response carries the user's S3 keys
+		return nil, RGWErrorParse, errors.Wrapf(err, "failed to unmarshal user json (%d bytes)", len(data))
 	}
 
 	rookUser := ObjectUser{UserID: user.ID, DisplayName: &user.DisplayName, Email: &user.Email}
```

---

### Incident Patch 4: `ff6e5c69` (2026-09-21)
**Commit Message**: Merge pull request #18440 from travisn/fix-mergify-partition-device-v19

ci: fix mergify automerge for release-1.21 backports

**File**: `.mergify.yml` (modified, +1/-1)
```diff
@@ -304,7 +304,7 @@ pull_request_rules:
       - "check-success=canary-tests / multi-cluster-mirroring (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / multus-public-and-cluster (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / osd-with-metadata-device (quay.io/ceph/ceph:v20, v1.37.0)"
-      - "check-success=canary-tests / osd-with-metadata-partition-device (quay.io/ceph/ceph:v20, v1.37.0)"
+      - "check-success=canary-tests / osd-with-metadata-partition-device (quay.io/ceph/ceph:v19, v1.37.0)"
       - "check-success=canary-tests / pvc (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / pvc-db (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / pvc-db-wal (quay.io/ceph/ceph:v20, v1.37.0)"
```

---

### Incident Patch 5: `64446235` (2026-09-21)
**Commit Message**: ci: fix mergify automerge for release-1.21 backports

The release-1.21 automerge rule required a check-success for
osd-with-metadata-partition-device on ceph v20, but that canary test is
pinned to ceph v19 (it fails consistently on v20). The v20 check never
reports, so the automerge conditions could never all be satisfied and
mergify never merged the backport PRs.

Point the condition at the v19 check that actually runs.

Signed-off-by: Travis Nielsen <tnielsen@redhat.com>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `.mergify.yml` (modified, +1/-1)
```diff
@@ -304,7 +304,7 @@ pull_request_rules:
       - "check-success=canary-tests / multi-cluster-mirroring (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / multus-public-and-cluster (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / osd-with-metadata-device (quay.io/ceph/ceph:v20, v1.37.0)"
-      - "check-success=canary-tests / osd-with-metadata-partition-device (quay.io/ceph/ceph:v20, v1.37.0)"
+      - "check-success=canary-tests / osd-with-metadata-partition-device (quay.io/ceph/ceph:v19, v1.37.0)"
       - "check-success=canary-tests / pvc (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / pvc-db (quay.io/ceph/ceph:v20, v1.37.0)"
       - "check-success=canary-tests / pvc-db-wal (quay.io/ceph/ceph:v20, v1.37.0)"
```

---

### Incident Patch 6: `9c375fdb` (2026-09-11)
**Commit Message**: ci: pin the upterm version used by upterm_debug

This pins the upterm version used for debugging to 0.26.0
which is currently the latest version.

Signed-off-by: Michael Adam <obnox@samba.org>

**File**: `.github/workflows/upterm_debug/action.yml` (modified, +2/-0)
```diff
@@ -20,6 +20,8 @@ runs:
       if: ${{ env.ENABLE_UPTERM }}
       uses: owenthereal/action-upterm@f26ebc11e22a09b8365f39d2cdafd06f63b42053 # v1.14.0
       with:
+        ## Pin the version of upterm used by the action:
+        upterm-version: v0.26.0
         ## whether to limit ssh access and adds the ssh public key for the user which triggered the workflow:
         limit-access-to-actor: false
         ## If no one connects within five minutes, shut down the server:
```

---

### Incident Patch 7: `bc3d22f4` (2026-09-10)
**Commit Message**: ci: remove tmate (pre-job) debugging and use upterm for pre-job debug

So far, tmate was used in pre-job debugging
while upterm was used in post-job debugging.

Recently, tmate had problems beyond the fact that
the tmate service is being discontinued.
more specifically, action-tmate did not establish tmate sessions
and never completed.

With rook's sandwich of
pre-job debug/job/post-job debug, this resulted in the situation that
jobs did noyt even run and upterem post-job debugging was never reached
or triggered.

This change lets pre-job debug use upterm_debug in pre-job debug steps everywhere and
removes tmate_debug. It also removes the old upterm-based post-job debug
syteps, making sure that upterm is only used in pre-job debug explicitly.

In particular, there is now no separate post-job debug step anymore.

Assisted-by: IBM Bob
Assisted-by: GitHub copilot
Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>
Signed-off-by: Michael Adam <obnox@samba.org>

sq move pre-job debug

Signed-off-by: Michael Adam <obnox@samba.org>

**File**: `.github/workflows/canary-integration-test.yml` (modified, +0/-31)
```diff
@@ -44,7 +44,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   raw-disk-with-object:
@@ -66,7 +65,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   two-osds-in-device:
@@ -88,7 +86,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   osd-with-metadata-partition-device:
@@ -111,7 +108,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   osd-with-metadata-device:
@@ -133,7 +129,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   encryption:
@@ -155,7 +150,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   lvm:
@@ -177,7 +171,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   pvc:
@@ -199,7 +192,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   pvc-db:
@@ -221,7 +213,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   pvc-db-wal:
@@ -243,7 +234,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           artifact-name: ${{ github.job }}-${{ matrix.ceph-image }}-${{ matrix.kubernetes-version }}
 
   encryption-pvc:
@@ -265,7 +255,6 @@ jobs:
           ceph-image: ${{ matrix.ceph-image }}
           kubernetes-version: ${{ matrix.kubernetes-version }}
           rook-image-artifact: ${{ inputs.rook_image_artifact }}
-          use-tmate: ${{ secrets.USE_TMATE }}
           ar
```

**File**: `.github/workflows/canary-tests/canary/action.yaml` (modified, +0/-14)
```diff
@@ -11,23 +11,13 @@ inputs:
     description: name of a prebuilt rook image artifact to import; empty builds rook in-job
     required: false
     default: ""
-  use-tmate:
-    description: the USE_TMATE secret, for pre-job debugging
-    required: false
-    default: ""
   artifact-name:
     description: name to publish collected logs under
     required: true
 
 runs:
   using: "composite"
   steps:
-    - name: consider (pre-job) debugging
-      uses: ./.github/workflows/tmate_debug
-      with:
-        use-tmate: ${{ inputs.use-tmate }}
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
-
     - name: setup cluster resources
       uses: ./.github/workflows/integration-test-setup-cluster-resources
       with:
@@ -480,7 +470,3 @@ runs:
       uses: ./.github/workflows/collect-logs
       with:
         name: ${{ inputs.artifact-name }}
-    - name: consider (post-job) debugging
-      uses: ./.github/workflows/upterm_debug
-      with:
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
```

**File**: `.github/workflows/canary-tests/encryption-pvc-db-wal/action.yaml` (modified, +0/-14)
```diff
@@ -11,23 +11,13 @@ inputs:
     description: name of a prebuilt rook image artifact to import; empty builds rook in-job
     required: false
     default: ""
-  use-tmate:
-    description: the USE_TMATE secret, for pre-job debugging
-    required: false
-    default: ""
   artifact-name:
     description: name to publish collected logs under
     required: true
 
 runs:
   using: "composite"
   steps:
-    - name: consider (pre-job) debugging
-      uses: ./.github/workflows/tmate_debug
-      with:
-        use-tmate: ${{ inputs.use-tmate }}
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
-
     - name: setup cluster resources
       uses: ./.github/workflows/integration-test-setup-cluster-resources
       with:
@@ -86,7 +76,3 @@ runs:
       uses: ./.github/workflows/collect-logs
       with:
         name: ${{ inputs.artifact-name }}
-    - name: consider (post-job) debugging
-      uses: ./.github/workflows/upterm_debug
-      with:
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
```

**File**: `.github/workflows/canary-tests/encryption-pvc-db/action.yaml` (modified, +0/-14)
```diff
@@ -11,23 +11,13 @@ inputs:
     description: name of a prebuilt rook image artifact to import; empty builds rook in-job
     required: false
     default: ""
-  use-tmate:
-    description: the USE_TMATE secret, for pre-job debugging
-    required: false
-    default: ""
   artifact-name:
     description: name to publish collected logs under
     required: true
 
 runs:
   using: "composite"
   steps:
-    - name: consider (pre-job) debugging
-      uses: ./.github/workflows/tmate_debug
-      with:
-        use-tmate: ${{ inputs.use-tmate }}
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
-
     - name: setup cluster resources
       uses: ./.github/workflows/integration-test-setup-cluster-resources
       with:
@@ -80,7 +70,3 @@ runs:
       uses: ./.github/workflows/collect-logs
       with:
         name: ${{ inputs.artifact-name }}
-    - name: consider (post-job) debugging
-      uses: ./.github/workflows/upterm_debug
-      with:
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
```

**File**: `.github/workflows/canary-tests/encryption-pvc-kms-vault-k8s-auth/action.yaml` (modified, +0/-14)
```diff
@@ -11,23 +11,13 @@ inputs:
     description: name of a prebuilt rook image artifact to import; empty builds rook in-job
     required: false
     default: ""
-  use-tmate:
-    description: the USE_TMATE secret, for pre-job debugging
-    required: false
-    default: ""
   artifact-name:
     description: name to publish collected logs under
     required: true
 
 runs:
   using: "composite"
   steps:
-    - name: consider (pre-job) debugging
-      uses: ./.github/workflows/tmate_debug
-      with:
-        use-tmate: ${{ inputs.use-tmate }}
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
-
     - name: setup cluster resources
       uses: ./.github/workflows/integration-test-setup-cluster-resources
       with:
@@ -92,7 +82,3 @@ runs:
       uses: ./.github/workflows/collect-logs
       with:
         name: ${{ inputs.artifact-name }}
-    - name: consider (post-job) debugging
-      uses: ./.github/workflows/upterm_debug
-      with:
-        debug-ci: ${{ contains(github.event.pull_request.labels.*.name, 'debug-ci') }}
```

---

### Incident Patch 8: `09bbdd1c` (2026-09-16)
**Commit Message**: Merge pull request #18399 from cobaltcore-dev/fix-target-placements

rgw: make pool references in the zone immutable

**File**: `pkg/daemon/ceph/client/rados.go` (modified, +0/-16)
```diff
@@ -174,22 +174,6 @@ func findLockerWithCookie(lockers []radosLockerInfo, cookie string) *radosLocker
 	return nil
 }
 
-func RadosNamespaceHasObjects(context *clusterd.Context, clusterInfo *ClusterInfo, pool, namespace string) (bool, error) {
-	radosArgs := []string{
-		"--pool", pool,
-		"--namespace", namespace,
-		"ls",
-	}
-	command, args := FinalizeCephCommandArgs(RadosTool, clusterInfo, radosArgs, context.ConfigDir)
-	// Pipe through "head -c 1" so only 1 byte is buffered regardless of object count.
-	shellCmd := exec.FormatCommand(command, args...) + " 2>/dev/null | head -c 1"
-	output, err := context.Executor.ExecuteCommandWithTimeout(exec.CephCommandsTimeout, "sh", "-c", shellCmd)
-	if err != nil {
-		return false, errors.Wrapf(err, "failed to check for objects in rados://%s/%s", pool, namespace)
-	}
-	return len(output) > 0, nil
-}
-
 // RadosRemoveObject idempotently removes a rados object from the given pool and namespace.
 func RadosRemoveObject(
 	context *clusterd.Context, clusterInfo *ClusterInfo,
```

**File**: `pkg/daemon/ceph/client/rados_test.go` (modified, +0/-38)
```diff
@@ -27,46 +27,8 @@ import (
 	"github.com/rook/rook/pkg/util/exec"
 	"github.com/rook/rook/pkg/util/exec/test"
 	"github.com/stretchr/testify/assert"
-	"github.com/stretchr/testify/require"
 )
 
-func TestRadosNamespaceHasObjects(t *testing.T) {
-	RunAllCephCommandsInToolboxPod = ""
-
-	capturedShellCmd := func(t *testing.T, pool, namespace string) string {
-		var shellCmd string
-		me := &test.MockExecutor{
-			MockExecuteCommandWithTimeout: func(timeout time.Duration, command string, arg ...string) (string, error) {
-				require.Equal(t, "sh", command)
-				require.Len(t, arg, 2)
-				require.Equal(t, "-c", arg[0])
-				shellCmd = arg[1]
-				return "", nil
-			},
-		}
-		ctx := &clusterd.Context{Executor: me, ConfigDir: "/var/lib/rook"}
-		_, err := RadosNamespaceHasObjects(ctx, AdminTestClusterInfo("rook-ceph"), pool, namespace)
-		require.NoError(t, err)
-		return shellCmd
-	}
-
-	t.Run("ordinary names stay unquoted", func(t *testing.T) {
-		assert.Equal(t,
-			"rados --pool mypool --namespace myns ls "+
-				"--cluster=rook-ceph "+
-				"--conf=/var/lib/rook/rook-ceph/rook-ceph.config "+
-				"--name=client.admin "+
-				"--keyring=/var/lib/rook/rook-ceph/client.admin.keyring "+
-				"2>/dev/null | head -c 1",
-			capturedShellCmd(t, "mypool", "myns"))
-	})
-
-	t.Run("shell metacharacters cannot break out of an argument", func(t *testing.T) {
-		assert.Contains(t, capturedShellCmd(t, "mypool", "myns; rm -rf /"),
-			"--namespace 'myns; rm -rf /' ls")
-	})
-}
-
 func TestRadosRemoveObject(t *testing.T) {
 	newTest := func(mockExec *test.MockExecutor) (*clusterd.Context, *ClusterInfo) {
 		ctx := &clusterd.Context{
```

**File**: `pkg/operator/ceph/object/objectstore.go` (modified, +46/-68)
```diff
@@ -829,19 +829,23 @@ func ConfigureSharedPoolsForZone(objContext *Context, sharedPools cephv1.ObjectS
 	}
 
 	log.NamedInfo(objContext.NsName(), logger, "configuring shared pools for object store")
-	if err := sharedPoolsExist(objContext, sharedPools); err != nil {
+	existingPools, err := listPoolNames(objContext)
+	if err != nil {
+		return err
+	}
+	if err := sharedPoolsExist(existingPools, sharedPools); err != nil {
 		return errors.Wrapf(err, "object store cannot be configured until shared pools exist")
 	}
 
 	zoneConfig, err := getZoneJSON(objContext)
 	if err != nil {
 		return err
 	}
-	zoneUpdated, err := adjustZoneDefaultPools(objContext, zoneConfig, sharedPools)
+	zoneUpdated, err := adjustZoneDefaultPools(objContext.NsName(), zoneConfig, sharedPools, existingPools)
 	if err != nil {
 		return err
 	}
-	zoneUpdated, err = adjustZonePlacementPools(zoneUpdated, sharedPools)
+	zoneUpdated, err = adjustZonePlacementPools(objContext.NsName(), zoneUpdated, sharedPools, existingPools)
 	if err != nil {
 		return err
 	}
@@ -877,38 +881,43 @@ func ConfigureSharedPoolsForZone(objContext *Context, sharedPools cephv1.ObjectS
 	return nil
 }
 
-func sharedPoolsExist(objContext *Context, sharedPools cephv1.ObjectSharedPoolsSpec) error {
-	existingPools, err := cephclient.ListPoolSummaries(objContext.Context, objContext.clusterInfo)
+// listPoolNames returns the names of all pools in the cluster.
+func listPoolNames(objContext *Context) (sets.Set[string], error) {
+	summaries, err := cephclient.ListPoolSummaries(objContext.Context, objContext.clusterInfo)
 	if err != nil {
-		return errors.Wrapf(err, "failed to list pools")
+		return nil, errors.Wrapf(err, "failed to list pools")
 	}
-	existing := make(map[string]struct{}, len(existingPools))
-	for _, pool := range existingPools {
-		existing[pool.Name] = struct{}{}
+	pools := sets.New[string]()
+	for _, pool := range summaries {
+		pools.Insert(pool.Name)
 	}
+	return pools, nil
+}
+
+func sharedPoolsExist(existingPools sets.Set[string], sharedPools cephv1.ObjectSharedPoolsSpec) error {
 	// sharedPools.MetadataPoolName, DataPoolName, and sharedPools.PoolPlacements.DataNonECPoolName are optional.
 	// ignore optional pools with empty name:
-	existing[""] = struct{}{}
+	missing := func(pool string) bool { return pool != "" && !existingPools.Has(pool) }
 
-	if _, ok := existing[sharedPools.MetadataPoolName]; !ok {
+	if missing(sharedPools.MetadataPoolName) {
 		return fmt.Errorf("sharedPool do not exist: %s", sharedPools.MetadataPoolName)
 	}
-	if _, ok := existing[sharedPools.DataPoolName]; !ok {
+	if missing(sharedPools.DataPoolName) {
 		return fmt.Errorf("sharedPool do not exist: %s", sharedPools.DataPoolName)
 	}
 
 	for _, pp := range sharedPools.PoolPlacements {
-		if _, ok := existing[pp.MetadataPoolName]; !ok {
+		if missing(pp.MetadataPoolName) {
 			return fmt.Errorf("sharedPool does not exist: pool %s for placement %s", pp.MetadataPoolName, pp.Name)
 		}
-		if _, ok := existing[pp.DataPoolName]; !ok {
+		if missing(pp.DataPoolName) {
 			return fmt.Errorf("sharedPool do not exist: pool %s for placement %s", pp.DataPoolName, pp.Name)
 		}
-		if _, ok := existing[pp.DataNonECPoolName]; !ok {
+		if missing(pp.DataNonECPoolName) {
 			return fmt.Errorf("sharedPool do not exist: pool %s for placement %s", pp.DataNonECPoolName, pp.Name)
 		}
 		for _, sc := range pp.StorageClasses {
-			if _, ok := existing[sc.DataPoolName]; !ok {
+			if missing(sc.DataPoolName) {
 				return fmt.Errorf("sharedPool do not exist: pool %s for StorageClass %s", sc.DataPoolName, sc.Name)
 			}
 		}
@@ -917,7 +926,15 @@ func sharedPoolsExist(objContext *Context, sharedPools cephv1.ObjectSharedPoolsS
 	return nil
 }
 
-func adjustZoneDefaultPools(objContext *Context, zone map[string]any, spec cephv1.ObjectSharedPoolsSpec) (map[string]any, error) {
+// adjustZoneDefaultPools points the zone's system pool fields (user index, metadata root, logs, ...)
+// at the spec's default metadata pool, namespa
```

**File**: `pkg/operator/ceph/object/objectstore_test.go` (modified, +2/-18)
```diff
@@ -36,6 +36,7 @@ import (
 	v1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/apimachinery/pkg/util/sets"
 	k8sfake "k8s.io/client-go/kubernetes/fake"
 	kexec "k8s.io/utils/exec"
 )
@@ -2012,24 +2013,7 @@ func Test_sharedPoolsExist(t *testing.T) {
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			executor := &exectest.MockExecutor{}
-			mockExecutorFuncOutput := func(command string, args ...string) (string, error) {
-				if args[0] == "osd" && args[1] == "lspools" {
-					pools := make([]string, len(tt.args.existsInCluster))
-					for i, p := range tt.args.existsInCluster {
-						pools[i] = fmt.Sprintf(`{"poolnum":%d,"poolname":%q}`, i+1, p)
-					}
-					poolJson := fmt.Sprintf(`[%s]`, strings.Join(pools, ","))
-					return poolJson, nil
-				}
-				return "", errors.Errorf("unexpected ceph command %q", args)
-			}
-			executor.MockExecuteCommandWithOutput = func(command string, args ...string) (string, error) {
-				return mockExecutorFuncOutput(command, args...)
-			}
-			context := &Context{Context: &clusterd.Context{Executor: executor}, Name: "myobj", clusterInfo: client.AdminTestClusterInfo("mycluster")}
-
-			if err := sharedPoolsExist(context, tt.args.sharedPools); (err != nil) != tt.wantErr {
+			if err := sharedPoolsExist(sets.New(tt.args.existsInCluster...), tt.args.sharedPools); (err != nil) != tt.wantErr {
 				t.Errorf("sharedPoolsExist() error = %v, wantErr %v", err, tt.wantErr)
 			}
 		})
```

**File**: `pkg/operator/ceph/object/shared_pools.go` (modified, +143/-33)
```diff
@@ -6,11 +6,14 @@ import (
 	"os"
 	"path"
 	"sort"
+	"strings"
 
 	"github.com/pkg/errors"
 	cephv1 "github.com/rook/rook/pkg/apis/ceph.rook.io/v1"
 	"github.com/rook/rook/pkg/util/log"
 	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/apimachinery/pkg/util/sets"
 )
 
 const (
@@ -71,7 +74,16 @@ func validatePoolPlacementStorageClasses(scList []cephv1.PlacementStorageClassSp
 	return nil
 }
 
-func adjustZonePlacementPools(zone map[string]any, spec cephv1.ObjectSharedPoolsSpec) (map[string]any, error) {
+// adjustZonePlacementPools adds and removes zone placement_pools entries and storage classes to match
+// the spec. Pool references of an existing placement are immutable once any of its pools exists in
+// the cluster (existingPools): buckets are addressed by placement name, so re-pointing would make
+// their data unreachable. A spec that changes such pools is rejected with an error.
+//
+// 'default-placement' cannot be removed (https://tracker.ceph.com/issues/68775). When it is not in
+// the spec it is set once, on a fresh zone, to the pools of the placement marked default, and kept
+// as is afterwards. Which placement is default is tracked only by the zonegroup's default_placement,
+// see adjustZoneGroupPlacementTargets.
+func adjustZonePlacementPools(nsName types.NamespacedName, zone map[string]any, spec cephv1.ObjectSharedPoolsSpec, existingPools sets.Set[string]) (map[string]any, error) {
 	name, err := getObjProperty[string](zone, "name")
 	if err != nil {
 		return nil, fmt.Errorf("unable to get zone name: %w", err)
@@ -101,42 +113,45 @@ func adjustZonePlacementPools(zone map[string]any, spec cephv1.ObjectSharedPools
 		if err != nil {
 			return nil, fmt.Errorf("unable to get pool placement name for zone %s: %w", name, err)
 		}
-		// check if placement should be removed
-		if _, inSpec := fromSpec[placementID]; !inSpec {
-			if placementID == defaultPlacementCephConfigName {
-				// 'default-placement' should always be kept as a workaround for https://tracker.ceph.com/issues/68775.
-				// if user specified other placement as default, then copy pool names to 'default-placement' from it:
-				if userDefault, inSpec := fromSpec[getDefaultPlacementName(spec)]; inSpec {
-					// duplicate user defined default placement under 'default-placement' name in spec to update pools on the next step
-					fromSpec[defaultPlacementCephConfigName] = userDefault
-				}
-			} else {
-				// remove placement if it is not in spec
-				idxToRemove[i] = struct{}{}
-				continue
-			}
+		if _, inSpec := fromSpec[placementID]; !inSpec && placementID != defaultPlacementCephConfigName {
+			// remove placement if it is not in spec
+			idxToRemove[i] = struct{}{}
+			continue
 		}
-		// update placement with values from spec:
-		if pSpec, inSpec := fromSpec[placementID]; inSpec {
-			_, err = updateObjProperty(pObj, pSpec.Val.IndexPool, "val", "index_pool")
-			if err != nil {
-				return nil, fmt.Errorf("unable to set index pool to pool placement %q for zone %q: %w", placementID, name, err)
-			}
-			_, err = updateObjProperty(pObj, pSpec.Val.DataExtraPool, "val", "data_extra_pool")
-			if err != nil {
-				return nil, fmt.Errorf("unable to set data extra pool to pool placement %q for zone %q: %w", placementID, name, err)
-			}
-			scObj, err := toObj(pSpec.Val.StorageClasses)
-			if err != nil {
-				return nil, fmt.Errorf("unable convert to pool placement %q storage class for zone %q: %w", placementID, name, err)
-			}
 
-			_, err = updateObjProperty(pObj, scObj, "val", "storage_classes")
-			if err != nil {
-				return nil, fmt.Errorf("unable to set storage classes to pool placement %q for zone %q: %w", placementID, name, err)
-			}
+		fromZone, err := parseZonePlacementPoolVal(pObj)
+		if err != nil {
+			return nil, fmt.Errorf("unable to parse pool placement %q for zone %q: %w", placementID, name, err)
+		}
+		update, updateNeeded, err := getPlacementUpdate(placementID, fromZone, fromZone.
```

---

### Incident Patch 9: `de651b97` (2026-09-16)
**Commit Message**: Merge pull request #18169 from rook/copilot/fix-commitlint-failure

CI: stop hard-failing commitlint on missing blank line before footer

**File**: `.commitlintrc.json` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@
       "always"
     ],
     "footer-leading-blank": [
-      2,
+      1,
       "always"
     ],
     "body-max-line-length": [
```

---

### Incident Patch 10: `6b8e409a` (2026-09-16)
**Commit Message**: Merge pull request #18378 from olamilekan000/fix/bucket-notification-lifecycle-events

object: allow missing lifecycle notification events

**File**: `deploy/charts/rook-ceph/templates/resources.yaml` (modified, +0/-31)
```diff
@@ -977,37 +977,6 @@ spec:
                     description: |-
                       BucketNotificationEvent represents the event type of the bucket notification
                       See: https://docs.ceph.com/en/latest/radosgw/s3-notification-compatibility/#event-types
-                    enum:
-                      - s3:ObjectCreated:*
-                      - s3:ObjectCreated:Put
-                      - s3:ObjectCreated:Post
-                      - s3:ObjectCreated:Copy
-                      - s3:ObjectCreated:CompleteMultipartUpload
-                      - s3:ObjectRemoved:*
-                      - s3:ObjectRemoved:Delete
-                      - s3:ObjectRemoved:DeleteMarkerCreated
-                      - s3:ObjectLifecycle:Expiration:Current
-                      - s3:ObjectLifecycle:Expiration:NonCurrent
-                      - s3:ObjectLifecycle:Expiration:DeleteMarker
-                      - s3:ObjectLifecycle:Expiration:AbortMultipartUpload
-                      - s3:ObjectLifecycle:Transition:Current
-                      - s3:ObjectLifecycle:Transition:NonCurrent
-                      - s3:LifecycleExpiration:*
-                      - s3:LifecycleExpiration:Delete
-                      - s3:LifecycleExpiration:DeleteMarkerCreated
-                      - s3:LifecycleTransition
-                      - s3:ObjectSynced:*
-                      - s3:ObjectSynced:Create
-                      - s3:ObjectSynced:Delete
-                      - s3:ObjectSynced:DeletionMarkerCreated
-                      - s3:Replication:*
-                      - s3:Replication:Create
-                      - s3:Replication:Delete
-                      - s3:Replication:DeletionMarkerCreated
-                      - s3:ObjectRestore:*
-                      - s3:ObjectRestore:Post
-                      - s3:ObjectRestore:Completed
-                      - s3:ObjectRestore:Delete
                     type: string
                   type: array
                 filter:
```

**File**: `deploy/examples/crds.yaml` (modified, +0/-31)
```diff
@@ -978,37 +978,6 @@ spec:
                     description: |-
                       BucketNotificationEvent represents the event type of the bucket notification
                       See: https://docs.ceph.com/en/latest/radosgw/s3-notification-compatibility/#event-types
-                    enum:
-                      - s3:ObjectCreated:*
-                      - s3:ObjectCreated:Put
-                      - s3:ObjectCreated:Post
-                      - s3:ObjectCreated:Copy
-                      - s3:ObjectCreated:CompleteMultipartUpload
-                      - s3:ObjectRemoved:*
-                      - s3:ObjectRemoved:Delete
-                      - s3:ObjectRemoved:DeleteMarkerCreated
-                      - s3:ObjectLifecycle:Expiration:Current
-                      - s3:ObjectLifecycle:Expiration:NonCurrent
-                      - s3:ObjectLifecycle:Expiration:DeleteMarker
-                      - s3:ObjectLifecycle:Expiration:AbortMultipartUpload
-                      - s3:ObjectLifecycle:Transition:Current
-                      - s3:ObjectLifecycle:Transition:NonCurrent
-                      - s3:LifecycleExpiration:*
-                      - s3:LifecycleExpiration:Delete
-                      - s3:LifecycleExpiration:DeleteMarkerCreated
-                      - s3:LifecycleTransition
-                      - s3:ObjectSynced:*
-                      - s3:ObjectSynced:Create
-                      - s3:ObjectSynced:Delete
-                      - s3:ObjectSynced:DeletionMarkerCreated
-                      - s3:Replication:*
-                      - s3:Replication:Create
-                      - s3:Replication:Delete
-                      - s3:Replication:DeletionMarkerCreated
-                      - s3:ObjectRestore:*
-                      - s3:ObjectRestore:Post
-                      - s3:ObjectRestore:Completed
-                      - s3:ObjectRestore:Delete
                     type: string
                   type: array
                 filter:
```

**File**: `pkg/apis/ceph.rook.io/v1/types.go` (modified, +0/-1)
```diff
@@ -2890,7 +2890,6 @@ type CephBucketNotificationList struct {
 
 // BucketNotificationEvent represents the event type of the bucket notification
 // See: https://docs.ceph.com/en/latest/radosgw/s3-notification-compatibility/#event-types
-// +kubebuilder:validation:Enum="s3:ObjectCreated:*";"s3:ObjectCreated:Put";"s3:ObjectCreated:Post";"s3:ObjectCreated:Copy";"s3:ObjectCreated:CompleteMultipartUpload";"s3:ObjectRemoved:*";"s3:ObjectRemoved:Delete";"s3:ObjectRemoved:DeleteMarkerCreated";"s3:ObjectLifecycle:Expiration:Current";"s3:ObjectLifecycle:Expiration:NonCurrent";"s3:ObjectLifecycle:Expiration:DeleteMarker";"s3:ObjectLifecycle:Expiration:AbortMultipartUpload";"s3:ObjectLifecycle:Transition:Current";"s3:ObjectLifecycle:Transition:NonCurrent";"s3:LifecycleExpiration:*";"s3:LifecycleExpiration:Delete";"s3:LifecycleExpiration:DeleteMarkerCreated";"s3:LifecycleTransition";"s3:ObjectSynced:*";"s3:ObjectSynced:Create";"s3:ObjectSynced:Delete";"s3:ObjectSynced:DeletionMarkerCreated";"s3:Replication:*";"s3:Replication:Create";"s3:Replication:Delete";"s3:Replication:DeletionMarkerCreated";"s3:ObjectRestore:*";"s3:ObjectRestore:Post";"s3:ObjectRestore:Completed";"s3:ObjectRestore:Delete"
 type BucketNotificationEvent string
 
 // BucketNotificationSpec represents the spec of a Bucket Notification
```

#### Recent Merged Pull Requests:
- **PR #18482** (2026-09-30): core: set priority class for the detect version job (backport #18477) (@mergify[bot])
- **PR #18480** (2026-09-30): tests: use Context() in the tests (backport #18092) (@mergify[bot])
- **PR #18477** (2026-09-30): core: set priority class for the detect version job (@bo0tzz)
- **PR #18475** (2026-09-29): monitoring: fix pool growth alert threshold (backport #18453) (@mergify[bot])
- **PR #18474** (2026-09-29): monitoring: fix pool growth alert threshold (backport #18453) (@mergify[bot])
- **PR #18473** (2026-09-29): build: set release version to v1.20.8 (@obnoxxx)
- **PR #18468** (2026-09-29): core: add support for ceph umbrella v21 (backport #18365) (@mergify[bot])
- **PR #18467** (2026-09-28): osd: run prepare pods on the host network with provider host (backport #18454) (@mergify[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
