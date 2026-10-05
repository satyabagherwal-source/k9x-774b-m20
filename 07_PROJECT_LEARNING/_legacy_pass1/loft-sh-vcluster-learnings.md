# Forensic Learning Record (Deep Inspection): loft-sh/vcluster

> **Canonical Artifact**: `07_PROJECT_LEARNING/loft-sh-vcluster-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/loft-sh/vcluster](https://github.com/loft-sh/vcluster))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:55.001Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `loft-sh/vcluster`
- **Description**: vCluster creates tenant clusters: fully isolated environments delivered as managed Kubernetes, or as the foundation for Slurm, Ray, Run:ai and inference clusters. Each gets its own API server, CRDs and RBAC, and runs on an existing cluster or standalone on bare metal. CNCF Certified Kubernetes.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 11325 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/vcluster/cmd/certs/certs.go`
```
package certs

import (
	"github.com/spf13/cobra"
)

func NewCertsCmd() *cobra.Command {
	certsCmd := &cobra.Command{
		Use:   "certs",
		Short: "vCluster certs subcommands",
		Long: `#######################################################
################## vcluster certs #####################
#######################################################
	`,
		Args: cobra.NoArgs,
	}

	certsCmd.AddCommand(rotate())
	certsCmd.AddCommand(rotateCA())
	certsCmd.AddCommand(check())
	return certsCmd
}

```

### Core Architecture Module: `cmd/vcluster/cmd/certs/check.go`
```
package certs

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/loft-sh/log"
	"github.com/loft-sh/vcluster/pkg/certs"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/spf13/cobra"
	certutil "k8s.io/client-go/util/cert"
)

type checkCmd struct {
	pkiPath string
	log     log.Logger
}

func check() *cobra.Command {
	cmd := &checkCmd{
		log: log.GetInstance(),
	}

	checkCmd := &cobra.Command{
		Use:   "check",
		Short: "Checks the current certificates",
		Args:  cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return cmd.Run()
		}}

	checkCmd.Flags().StringVar(&cmd.pkiPath, "path", constants.PKIDir, "The path to the PKI directory")

	return checkCmd
}

// Run checks the current certificates in the PKI directory and returns base information about those.
func (cmd *checkCmd) Run() error {
	now := time.Now()
	var certificateInfos []certs.Info
	err := filepath.WalkDir(cmd.pkiPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		if filepath.Ext(path) != ".crt" {
			return nil
		}

		c, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("reading file %s", path)
		}

		crts, err := certutil.ParseCertsPEM(c)
		if err != nil {
			return err
		}

		for _, crt := range crts {
			certificateInfos = append(certificateInfos, certs.Info{
				Filename:   d.Name(),
				Subject:    crt.Subject.CommonName,
				Issuer:     crt.Issuer.CommonName,
				ExpiryTime: crt.NotAfter,
				Status:     certStatus(crt, now),
			})
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("finding certificate information: %w", err)
	}

	if err := json.NewEncoder(os.Stdout).Encode(certificateInfos); err != nil {
		return fmt.Errorf("encoding JSON: %w", err)
	}

	return nil
}

func certStatus(cert *x509.Certificate, now time.Time) string {
	if now.Before(cert.NotBefore) {
		return "NOT YET VALID"
	}
	if now.After(cert.NotAfter) {
		return "EXPIRED"
	}

	return "OK"
}

```

### Core Architecture Module: `cmd/vcluster/cmd/certs/rotate.go`
```
package certs

import (
	"context"
	"fmt"
	"os"

	"github.com/loft-sh/log"
	"github.com/loft-sh/vcluster/pkg/certs"
	"github.com/loft-sh/vcluster/pkg/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/spf13/cobra"
)

const standaloneConfig = `
privateNodes:
  enabled: true
controlPlane:
  standalone:
    enabled: true
`

type rotateCmd struct {
	log        log.Logger
	pkiPath    string
	standalone bool
}

func rotate() *cobra.Command {
	cmd := &rotateCmd{
		log: log.GetInstance(),
	}

	rotateCmd := &cobra.Command{
		Use:   "rotate",
		Short: "Rotates control-plane client and server certs",
		Args:  cobra.NoArgs,
		RunE: func(cobraCmd *cobra.Command, _ []string) error {
			return cmd.Run(cobraCmd.Context(), false)
		}}

	rotateCmd.Flags().StringVar(&cmd.pkiPath, "path", constants.PKIDir, "The path to the PKI directory")
	rotateCmd.Flags().BoolVar(&cmd.standalone, "standalone", false, "Signalizes if vCluster is running standalone")

	return rotateCmd
}

func rotateCA() *cobra.Command {
	cmd := &rotateCmd{
		log: log.GetInstance(),
	}

	rotateCACmd := &cobra.Command{
		Use:   "rotate-ca",
		Short: "Rotates the CA certificate",
		Args:  cobra.NoArgs,
		RunE: func(cobraCmd *cobra.Command, _ []string) error {
			return cmd.Run(cobraCmd.Context(), true)
		}}

	rotateCACmd.Flags().StringVar(&cmd.pkiPath, "path", constants.PKIDir, "The path to the PKI directory")
	rotateCACmd.Flags().BoolVar(&cmd.standalone, "standalone", false, "Signalizes if vCluster is running standalone")

	return rotateCACmd
}

func (cmd *rotateCmd) Run(ctx context.Context, withCA bool) error {
	var vConfig *config.VirtualClusterConfig

	if cmd.standalone {
		cfg, err := config.ParseConfigBytes([]byte(standaloneConfig), os.Getenv("VCLUSTER_NAME"), nil)
		if err != nil {
			return fmt.Errorf("parsing vCluster config: %w", err)
		}
		vConfig = cfg
		if os.Getenv("NAMESPACE") == "" {
			err := os.Setenv("NAMESPACE", "default")
			if err != nil {
				cmd.log.Debugf("setting namespace to default failed: %s", err.Error())
			}
		}
	} else {
		cfg, err := config.ParseConfig(constants.DefaultVClusterConfigLocation, os.Getenv("VCLUSTER_NAME"), nil)
		if err != nil {
			return fmt.Errorf("parsing vCluster config: %w", err)
		}
		vConfig = cfg
	}

	return certs.Rotate(ctx, vConfig, cmd.pkiPath, withCA, cmd.log)
}

```

### Core Architecture Module: `cmd/vcluster/cmd/debug/debug.go`
```
package debug

import (
	"github.com/loft-sh/vcluster/cmd/vcluster/cmd/debug/etcd"
	"github.com/loft-sh/vcluster/cmd/vcluster/cmd/debug/mappings"
	"github.com/spf13/cobra"
)

func NewDebugCmd() *cobra.Command {
	debugCmd := &cobra.Command{
		Use:   "debug",
		Short: "vCluster debug subcommand",
		Long: `#######################################################
################### vcluster debug ####################
#######################################################
		`,
		Args: cobra.NoArgs,
	}

	debugCmd.AddCommand(mappings.NewMappingsCmd())
	debugCmd.AddCommand(etcd.NewEtcdCmd())
	return debugCmd
}

```

### Core Architecture Module: `cmd/vcluster/cmd/debug/etcd/etcd.go`
```
package etcd

import (
	"github.com/spf13/cobra"
)

func NewEtcdCmd() *cobra.Command {
	debugCmd := &cobra.Command{
		Use:   "etcd",
		Short: "vCluster etcd subcommand",
		Long: `#######################################################
############### vcluster debug etcd ###############
#######################################################
		`,
		Args: cobra.NoArgs,
	}

	debugCmd.AddCommand(NewKeysCommand())
	return debugCmd
}

```

### Core Architecture Module: `cmd/vcluster/cmd/debug/etcd/keys.go`
```
package etcd

import (
	"context"
	"fmt"
	"os"

	"github.com/loft-sh/vcluster/pkg/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/etcd"
	"github.com/spf13/cobra"
)

type KeysOptions struct {
	Config string

	Prefix string
}

func NewKeysCommand() *cobra.Command {
	options := &KeysOptions{}
	cmd := &cobra.Command{
		Use:   "keys",
		Short: "Dump the vCluster etcd stored keys",
		Args:  cobra.NoArgs,
		RunE: func(cobraCommand *cobra.Command, _ []string) (err error) {
			return ExecuteKeys(cobraCommand.Context(), options)
		},
	}

	cmd.Flags().StringVar(&options.Config, "config", constants.DefaultVClusterConfigLocation, "The path where to find the vCluster config to load")
	cmd.Flags().StringVar(&options.Prefix, "prefix", "/", "The prefix to use for listing the keys")
	return cmd
}

func ExecuteKeys(ctx context.Context, options *KeysOptions) error {
	// parse vCluster config
	vConfig, err := config.ParseConfig(options.Config, os.Getenv("VCLUSTER_NAME"), nil)
	if err != nil {
		return err
	}

	// create new etcd client
	etcdClient, err := etcd.NewFromConfig(ctx, vConfig)
	if err != nil {
		return err
	}

	// create new etcd backend & list mappings
	keyValues, err := etcdClient.List(ctx, options.Prefix)
	if err != nil {
		return err
	}

	// print mappings
	for _, keyValue := range keyValues {
		fmt.Println(string(keyValue.Key))
	}

	return nil
}

```

### Core Architecture Module: `cmd/vcluster/cmd/debug/mappings/add.go`
```
package mappings

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/loft-sh/vcluster/pkg/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/etcd"
	"github.com/loft-sh/vcluster/pkg/mappings/store"
	"github.com/loft-sh/vcluster/pkg/syncer/synccontext"
	"github.com/spf13/cobra"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/klog/v2"
)

type AddOptions struct {
	Config string

	APIVersion string
	Kind       string

	Host    string
	Virtual string
}

func NewAddCommand() *cobra.Command {
	options := &AddOptions{}
	cmd := &cobra.Command{
		Use:   "add",
		Short: "Adds a custom mapping to the vCluster stored mappings",
		RunE: func(cobraCommand *cobra.Command, _ []string) (err error) {
			return ExecuteSave(cobraCommand.Context(), options)
		},
	}

	cmd.Flags().StringVar(&options.Config, "config", constants.DefaultVClusterConfigLocation, "The path where to find the vCluster config to load")
	cmd.Flags().StringVar(&options.Kind, "kind", "", "The Kind of the object")
	cmd.Flags().StringVar(&options.APIVersion, "api-version", "", "The APIVersion of the object")
	cmd.Flags().StringVar(&options.Host, "host", "", "The host object in the form of namespace/name")
	cmd.Flags().StringVar(&options.Virtual, "virtual", "", "The virtual object in the form of namespace/name")

	return cmd
}
func ExecuteSave(ctx context.Context, options *AddOptions) error {
	nameMapping, etcdBackend, err := parseMappingAndClient(ctx, options.Config, options.Kind, options.APIVersion, options.Virtual, options.Host)
	if err != nil {
		return err
	}

	err = etcdBackend.Save(ctx, &store.Mapping{
		NameMapping: nameMapping,
	})
	if err != nil {
		return fmt.Errorf("error saving %s: %w", nameMapping.String(), err)
	}

	klog.FromContext(ctx).Info("Successfully added name mapping to store", "mapping", nameMapping.String())
	return nil
}

func parseMappingAndClient(ctx context.Context, configPath, kind, apiVersion, virtual, host string) (synccontext.NameMapping, store.Backend, error) {
	if kind == "" || apiVersion == "" || virtual == "" || host == "" {
		return synccontext.NameMapping{}, nil, fmt.Errorf("make sure to specify --kind, --api-version, --host and --virtual")
	}

	// parse group version
	groupVersion, err := schema.ParseGroupVersion(apiVersion)
	if err != nil {
		return synccontext.NameMapping{}, nil, fmt.Errorf("parse group version: %w", err)
	}

	// parse host
	hostName := types.NamespacedName{Name: host}
	if strings.Contains(host, "/") {
		namespaceName := strings.SplitN(host, "/", 2)
		hostName.Namespace = namespaceName[0]
		hostName.Name = namespaceName[1]
	}

	// parse virtual
	virtualName := types.NamespacedName{Name: virtual}
	if strings.Contains(virtual, "/") {
		namespaceName := strings.SplitN(virtual, "/", 2)
		virtualName.Namespace = namespaceName[0]
		virtualName.Name = namespaceName[1]
	}

	// build name mapping
	nameMapping := synccontext.NameMapping{
		GroupVersionKind: schema.GroupVersionKind{
			Group:   groupVersion.Group,
			Version: groupVersion.Version,
			Kind:    kind,
		},
		VirtualName: virtualName,
		HostName:    hostName,
	}

	// parse vCluster config
	vConfig, err := config.ParseConfig(configPath, os.Getenv("VCLUSTER_NAME"), nil)
	if err != nil {
		return synccontext.NameMapping{}, nil, err
	}

	// create new etcd client
	etcdClient, err := etcd.NewFromConfig(ctx, vConfig)
	if err != nil {
		return synccontext.NameMapping{}, nil, err
	}

	// create new etcd backend & list mappings
	etcdBackend := store.NewEtcdBackend(etcdClient)
	return nameMapping, etcdBackend, nil
}

```

### Core Architecture Module: `cmd/vcluster/cmd/debug/mappings/clear.go`
```
package mappings

import (
	"context"
	"fmt"
	"os"

	"github.com/loft-sh/vcluster/pkg/config"
	"github.com/loft-sh/vcluster/pkg/constants"
	"github.com/loft-sh/vcluster/pkg/etcd"
	"github.com/loft-sh/vcluster/pkg/mappings/store"
	"github.com/spf13/cobra"
	"k8s.io/klog/v2"
)

type ClearOptions struct {
	Config string
}

func NewClearCommand() *cobra.Command {
	options := &ClearOptions{}
	cmd := &cobra.Command{
		Use:   "clear",
		Short: "Empty the vCluster stored mappings",
		Args:  cobra.NoArgs,
		RunE: func(cobraCommand *cobra.Command, _ []string) (err error) {
			return ExecuteClear(cobraCommand.Context(), options)
		},
	}

	cmd.Flags().StringVar(&options.Config, "config", constants.DefaultVClusterConfigLocation, "The path where to find the vCluster config to load")
	return cmd
}
func ExecuteClear(ctx context.Context, options *ClearOptions) error {
	// parse vCluster config
	vConfig, err := config.ParseConfig(options.Config, os.Getenv("VCLUSTER_NAME"), nil)
	if err != nil {
		return err
	}

	// create new etcd client
	etcdClient, err := etcd.NewFromConfig(ctx, vConfig)
	if err != nil {
		return err
	}

	// create new etcd backend & list mappings
	etcdBackend := store.NewEtcdBackend(etcdClient)
	mappings, err := etcdBackend.List(ctx)
	if err != nil {
		return fmt.Errorf("list mappings: %w", err)
	}

	// print mappings
	for _, mapping := range mappings {
		klog.FromContext(ctx).Info("Delete mapping", "mapping", mapping.String())
		err = etcdBackend.Delete(ctx, mapping)
		if err != nil {
			return fmt.Errorf("delete mapping %s: %w", mapping.String(), err)
		}
	}

	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1746** (2024-08-14): **Resource limits forbid running of the syncer**
  *Symptoms*: ### What happened?  - I downloaded my values.yaml from [GitHub](https://github.com/loft-sh/vcluster/blob/a0a6ff0ccbace90be212d4887f15eaf49bfe3fc5/chart/values.yaml) - I enabled quotas at  "policies: > resourceQuota: >  enabled: true" - I created the vCluster with helm as follows ` helm upgrade --install vcluster-r05 vcluster --version 0.20.0-beta.2 --values vcluster.yaml --repo https://charts.loft.sh --namespace vcluster-r05 --create-namespace --repository-config='' --wait --wait-for-jobs` - The syncer is not created. Stateful set has 0/1 pods ready. The events state that: `create Pod vcluster-r05-0 in StatefulSet vcluster-r05 failed error: pods "vcluster-r05-0" is forbidden: failed quota: vc-vcluster-r05: must specify limits.cpu for: syncer`   ### What did you expect to happen?  - The vCluster is created without a problem.  ### How can we reproduce it (as minimally and precisely as possible)?  See above.  ### Anything else we need to know?  It can be a [good idea](https://www.youtube.com/watch?v=rjSWVeAvb24) to set CPU requests and **not set** CPU limits. With vCluster, we do that in the syncer limits (controlPlane: > statefulSet: > resources: > limits:) definition. In the values.yaml there should also be a way to disable cpu limits.   What do you think about making the CPU unlimited by default?   ### Host cluster Kubernetes version  <details>  ```console $ kubectl version Client Version: v1.29.3 Kustomize Version: v5.0.4-0.20230601165947-6ce0b
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. I will discuss it within team.
  > This is a kubernetes limitation, not a vcluster one:    >  If quota is enabled in a namespace for compute resources like cpu and memory, users must specify requests or limits for those values; otherwise, the quota system may reject pod creation. Hint: Use the LimitRanger admission controller to force defaults for pods that make no compute resource requirements.  ( https://kubernetes.io/docs/concepts/policy/resource-quotas/ )
  > Ah's an issue that we don't have a default cpu limit, so enabling resource quotas without writing in an cpu.limit doesn't work

- **Issue #1745** (2025-02-24): **MountVolume.SetUp failed for volume "podlogs" of a deployment in vCluster**
  *Symptoms*: ### What happened?  I created a new vCluster and deployed a deployment but the pod goes in container creating state with the below error: `  Warning  FailedMount  22s (x11 over 6m34s)   kubelet            MountVolume.SetUp failed for volume "plogs" : hostPath type check failed: /tmp/vcluster/v-cluster-only-ic-sync/testt/log/pods is not a directory`  I tried changing the type of volume to DirectoryOrCreate, the pod came up in running state but in the fluentbit container no logs are visible, following are the error logs of fluentbit-container: `[2024/05/06 12:51:09] [error] [input:tail:tail.0] read error, check permissions: /var/log/pods/dgdr-6868bbb7-hrxlz_fb217ac7-d1ff-47f7-9af7-abb76a8c707f/*.log [2024/05/06 12:51:09] [ warn] [input:tail:tail.0] error scanning path: /var/log/pods/dgdr-6868bbb7-hrxlz_fb217ac7-d1ff-47f7-9af7-abb76a8c707f/*.log`  ### What did you expect to happen?  Ideally the deployment should create the pod and i should see the logs in the fluent bit container, Also i wanted to know how this path is getting created `"/tmp/vcluster/v-cluster-only-ic-sync/testt/log/pods"` in vCluster as in my deployment volume is as below  `volumes:     - name: podlogs      hostPath:       path: /var/log/pods       type: Directory`  ### How can we reproduce it (as minimally and precisely as possible)?  Deploy a K8s Deployment with fluentbit as a side car container which has volumeMounts  `     volumeMounts:           - name: podlogs             mountPath: /var/log/
  **Post-Mortem & Fix Analysis**:
  > hostpathmapper needs to be enabled to use fluent-bit logging in vcluster. ref: https://www.vcluster.com/docs/vcluster/configure/vcluster-yaml/control-plane/components/host-path-mapper create a vcluster using the below config. (vcluster version v0.20.1)  ``` controlPlane:   hostPathMapper:     enabled: true ```  2. install the vcluster hostpath mapper helm chart https://github.com/loft-sh/vcluster-hostpath-mapper 3. create the deployment with correct fluent-bit config and check the logs. 
  > @akusingh-tibco Please let us know if the guidance didn't work, but otherwise I'm going to close the issue. 
  > Hi @deniseschannon  I have the same problem and when installing hpm 0.2.0 from the helm charts against the vcluster 0.23.0 I get the following error in the hpm pods:  ``` 2025-03-15 23:09:16.422Z hostpath-mapper-init E0315 23:09:16.422073       1 hostpaths.go:269] unmarshal config.yaml: &errors.errorString{s:"while decoding JSON: json: unknown field \"reuseNamespace\""} 2025-03-15 23:09:16.422Z hostpath-mapper-init Error: find vcluster mode: error unmarshaling JSON: while decoding JSON: json: unknown field "reuseNamespace" 2025-03-15 23:09:16.422Z hostpath-mapper-init Usage: 2025-03-15 23:09:16.422Z hostpath-mapper-init   start [flags] 2025-03-15 23:09:16.422Z hostpath-mapper-init  2025-03-15 23:09:16.422Z hostpath-mapper-init Flags: 2025-03-15 23:09:16.422Z hostpath-mapper-init       --client-ca-cert string     The path to the client ca certificate (default "/data/server/tls/client-certificate") 2025-03-15 23:09:16.422Z hostpath-mapper-init   -h, --help                      help for s

- **Issue #1718** (2024-05-16): **CoreDNS PreemptionPolicy conflicts with host cluster global default Priority Class**
  *Symptoms*: ### What happened?  When trying to deploy a vcluster to my homelab cluster, I found out that the coredns pod fails to sync because it has a preemptionPolicy set that is different from the default PriorityClass on my cluster.  The syncer fails to sync the coredns pod with the following error  ``` syncer 2024-04-25 04:11:12    ERROR    controller/controller.go:329    controller pod: namespace kube-system name coredns-74987d4979-k272p: reconcileID "a0a6be23-8e5e-45bb-886c-414074d250d9": Reconciler error pods "coredns-74987d4979-k272p-x-kube-system-x-vcluster-rf-ebceb13e69" is forbidden: the string value of PreemptionPolicy (PreemptLowerPriority) must not be provided in pod spec; priority admission controller computed Never from the given PriorityClass name    {"component": "vcluster-pro"} ```  ### What did you expect to happen?  For it to successfully sync the pod. Ideally by omitting the preemptionPolicy here. Or mapping it properly to the host's system-cluster-critical PriorityClass.  ### How can we reproduce it (as minimally and precisely as possible)?  1. Have a PriorityClass with globalDefault set to true with a preemption policy set to Never 2. Deploy vcluster with default settings 3. Observe syncer failing to sync coredns pod  ### Anything else we need to know?  After temporarily removing the globalDefault PriorityClass on the host cluster, the pod successfully syncs, and I've observed that the resulting pod has an empty priorityClassName, which causes the host cluster to
  **Post-Mortem & Fix Analysis**:
  > Hello   Thank you for the information regarding the issue you are facing. From the error message provided it seems that there is a conflict, between the preemptionPolicy of the coredns pod and the default PriorityClass set in your host cluster.   This conflict arises because the default PriorityClass of your host cluster has a preemption policy of 'Never' which does not align with the 'PreemptLowerPriority' policy specified in the coredns pod.  At my investigation it may be either a miss-configuration or a real problem close to https://github.com/loft-sh/vcluster/blob/v0.20.0-beta.1/pkg/controllers/resources/priorityclasses/translate.go#L26.  I would recommend to provide any additional logs or configurations that might help our team replicate and address this issue. 
  > What kind of additional logs and/or configurations would be helpful here?  The default preemption policy on my host cluster is indeed intended to never preempt other pods.  As previously stated, I'm using a default configuration of vcluster as deployed via CLI, so I'm not entirely sure how this can be a misconfiguration if the default configuration is producing pod specs that is conflicting with a host cluster default priorityClass preemption policy.

- **Issue #1717** (2025-08-26): **Document what to do when there is noexec available**
  *Symptoms*: ### What happened?  In an environment where any emptyDir is mounted to a partition in host, with noexec, vcluster create will give: ``` 12:07:17 warn Pod my-vcluster-795748b48b-gzbvb: Error: failed to create containerd task: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: " /binaries/vcluster": permission denied: unknown (Failed) ``` After editing the pod for debug with strace: ``` / # /binaries/vcluster sh: /binaries/vcluster: Permission denied / # strace /binaries/vcluster execve("/binaries/vcluster", ["/binaries/vcluster"], [/* 27 vars */]) = -1 EACCES (Permission denied) writev(2, [{iov_base="strace: exec: Permission denied", iov_len=31}, {iov_base="\n", iov_len=1}], 2strace: exec: Permission denied ) = 32 writev(2, [{iov_base="", iov_len=0}, {iov_base=NULL, iov_len=0}], 2) = 0 getpid()                                = 18 exit_group(1)                           = ? +++ exited with 1 +++ ``` If copied to /tmp, vcluster works.  Mount command gives: ``` # for /tmp mount | grep "on / " overlay on / type overlay (rw,seclabel,relatime,lowerdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26481/fs:/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26480/fs,upperdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26558/fs,workdir=/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/26558/work)  # for /binaries
  **Post-Mortem & Fix Analysis**:
  > I could ask the kubernetes admin if they can change the behavior of emptyDir, so that the partition are not noexec. It might be difficult for them to lower the security. Moreover, the kubernetes issue https://github.com/kubernetes/kubernetes/issues/48912 might make this a future issue for vcluster anyway.  What if vcluster image directly contains the two binaries? I don't know about licence but that would prevent this trick and we could then have noexec in the image and in emptyDir.
  > @antoinetran Hi, thanks for opening this. to answer your question `What if vcluster image directly contains the two binaries?` the issue here is that we default to the current k8s version of the host (e.g. if you're on 1.27 in the host cluster the image will be pulled from k8s 1.27) and this is also configurable. So we would have to have at least 4 different images just for the k8s distro, plus the images would have to also include the scheduler and the controller even if not in use and BYOI would be harder too  The issue you linked may be a problem indeed for this approach, I will be taking a look 
  > Related docs PR: https://github.com/loft-sh/vcluster-docs/pull/1020

- **Issue #1708** (2024-05-22): **Allow setting enableServiceLinks to false in etcd and syncer**
  *Symptoms*: ### What happened?  We are experimenting using vcluster to shard a cluster with 10K+ services between multiple vclusters.  It has been working perfectly for 2 weeks but we hit the first issue today: the etcd statefulset and the syncer deployment died and failed to start up due to there being too many environment variables. This is a known issue in clusters with too many services, and the workaround we usually employ is to disable pod's service links, as each service ends up as another environment variable to a pod.  Currently, however, there is no way to disable service links in the k8s chart  https://github.com/loft-sh/vcluster/blob/v0.19/charts/k8s/templates/etcd-statefulset.yaml  Edit to add: we have disabled service links manually in the etcd statefulset and syncer deployment and everything seems to be working.  ### What did you expect to happen?  Either: - for enableServiceLinks to be set to false (if vcluster does not work without DNS service discovery in the host cluster, I don't think there is a reason to leave that to the default true value) - a chart value allowing service links to be disabled  ### How can we reproduce it (as minimally and precisely as possible)?  Create 10K+ services in a cluster.  ``` k get svc -A | wc -l 15405 ```  ### Anything else we need to know?  I could open a PR for this (or for the related #1622 which would also fix this issue for us). I just see the charts on the v0.19 branch, is that the branch a potential PR 
  **Post-Mortem & Fix Analysis**:
  > @cezar-guimaraes thanks for creating this issue! Yes I think we can add that option

- **Issue #1704** (2024-08-07): **setup/controller_context.go:225 couldn't find virtual cluster kube-config**
  *Symptoms*: ### What happened?  vCluster Pods are not running,  Deployed in the Anthos Bare Metal Cluster using Helm Chart.  ``` kubectl get pods -n vcluster-dev NAME             READY   STATUS    RESTARTS      AGE vcluster-dev-0   0/1     Running   1 (20m ago)   53m ```  Below are the logs of vcluster Pod.  ``` setup/initialize.go:88  failed to find IPv6 service CIDR, will use IPv4 service CIDR. Error details: couldn't find host cluster Service CIDR ("Service "test-service-m2p76" is invalid: spec.clusterIPs[0]: Invalid value: []string{"2001:DB8::1"}: IPv6 is not configured on this cluster")        {"component": "vcluster-pro"} 2024-04-18 07:54:18     INFO    setup/controller_context.go:225 couldn't find virtual cluster kube-config, will retry in 1 seconds      {"component": "vcluster-pro"} 2024-04-18 07:54:19     INFO    setup/controller_context.go:225 couldn't find virtual cluster kube-config, will retry in 1 seconds      {"component": "vcluster-pro"} ```  ### What did you expect to happen?  vcluster and core dns pods are expected to run.  ### How can we reproduce it (as minimally and precisely as possible)?  Used to deploy k8s VMs in the vCluster.  ### Anything else we need to know?  *No response*  ### Host cluster Kubernetes version  Client Version: v1.27.3 Kustomize Version: v5.0.1 Server Version: v1.28.5-gke.1200  ### Host cluster Kubernetes distribution  <details>  ``` # Anthos on Bare Metal Cluster ```  </details>  ### vlcuster version  <details>  ```console $ vcluster --version 
  **Post-Mortem & Fix Analysis**:
  > @Rockyjr-git thanks for creating this issue! Is this a IPv6 only cluster?
  > Yes, it is.
  > We don't have the problem with `k0sproject/k0s:v1.28.8-k0s.0` but when upgrading to `k0sproject/k0s:v1.29.4-k0s.0` the following logs show up in the syncer (0.18.1 or 0.19.5) container: ``` 2024-05-18 17:26:21	INFO	setup/initialize.go:86	k0s config secret detected, syncer will ensure that it contains service CIDR	{"component": "vcluster"} 2024-05-18 17:26:21	INFO	servicecidr/servicecidr.go:117	failed to find IPv6 service CIDR, will use IPv4 service CIDR. Error details: couldn't find host cluster Service CIDR ("Service "test-service-jmp96" is invalid: spec.clusterIPs[0]: Invalid value: []string{"2001:DB8::1"}: IPv6 is not configured on this cluster")	{"component": "vcluster"} 2024-05-18 17:26:21	INFO	k0s/k0s.go:68	Starting k0s	{"component": "vcluster", "args": "/k0s-binary/k0s controller --config=/etc/k0s/config.yaml --data-dir=/data/k0s --status-socket=/run/k0s/status.sock --disable-components=konnectivity-server,kube-scheduler,csr-approver,kube-proxy,coredns,network-provider,helm,

- **Issue #1682** (2024-04-15): **vcluster connect hangs in airgapped environment when firewall is silently dropping Internet traffic**
  *Symptoms*: ### What happened?  When connecting to a vcluster where the CLI is executed in an airgapped environment, the connect command will hang for approximately 30 seconds while attempting to check for newer versions.  I've turned of telemetry by using vcluster telemetry disable.  Every 1.0s: sudo netstat -anop | grep -i SYN_SENT tcp        0      1 10.bbb.ccc.ddd:56312     140.82.121.6:443        SYN_SENT    1104193/vcluster     on (3.36/3/0)  [username@workstation 0.19.5]$ time vcluster -n namespace connect vcluster 14:03:12 info Using vcluster vcluster load balancer endpoint: 10.ddd.eee.fff 14:03:12 done Switched active kube context to vcluster_vcluster_namespace_clustername - Use `vcluster disconnect` to return to your previous kube context - Use `kubectl get namespaces` to access the vcluster  real    0m30.229s user    0m0.139s sys     0m0.024s    ### What did you expect to happen?  That the command completes within a couple of seconds, which is what happens if I enable proxy using environment variables. But proxy or Internet connection isn't always allowed.  [username@workstation 0.19.5]$ . enable_proxy #shell script for setting environment variables [username@workstation 0.19.5]$ time vcluster -n namespace connect vcluster 14:19:26 info Using vcluster vcluster load balancer endpoint: 10.ddd.eee.fff 14:19:26 done Switched active kube context to vcluster_vcluster_namespace_clustername - Use `vcluster disconnect` to return to your previous kube contex
  **Post-Mortem & Fix Analysis**:
  > Hey @trondvindenes-hvikt, as you pointed out, the connect and create commands will check for newer CLI releases on GitHub.  You can omit this by setting the `VCLUSTER_SKIP_VERSION_CHECK=true` environment variable.

- **Issue #1678** (2024-04-18): **Hard-coded request.cpu 30m for statefulset prevents deployment in some cluster**
  *Symptoms*: ### What happened?  In an OpenShift cluster 4.15 with quota: minimal requests.cpu >= 50m, the deployment of statefulset fails.  ### What did you expect to happen?  Any statefulset deployment, that contains resource fields requests and limits, should not fail because of this error: ``` Error syncing to physical cluster: pods "my-nats-0-x-nats-x-my-vcluster" is forbidden: minimum cpu usage per Container is 50m, but request is 30m ```  ### How can we reproduce it (as minimally and precisely as possible)?  Deploy nats with helm chart, or really any statefulset, in an OpenShift cluster with with quota: minimal requests.cpu >= 50m  ### Anything else we need to know?  https://github.com/loft-sh/vcluster/blob/v0.20.0-alpha.4/pkg/controllers/resources/pods/translate/hosts.go#L50 specifies the hard-coded value of 30m. Linked to https://github.com/loft-sh/vcluster/issues/372 Recommended solution: Add a way in values.yaml of vcluster to specify the resource field for this special initContainer that vcluster runs for each statefulset deployment.  ### Host cluster Kubernetes version  <details>  ```console $ kubectl version Client Version: v1.28.5 Kustomize Version: v5.0.4-0.20230601165947-6ce0bf390ce3 Server Version: v1.28.2-3580+6216ea1e51a212-dirty ```  </details>   ### Host cluster Kubernetes distribution  <details>  ``` OpenShift 4.15, linked to Kubernetes version 1.28. ```  </details>   ### vlcuster version  <details>  ```console $ v
  **Post-Mortem & Fix Analysis**:
  > Anyone sees a workaround? I thought about applying a limitrange, but the fact that vcluster specifies the requests/limits override that limitrange. I don't see a way of editing the vcluster image, because it is written in GO, and it's a compiled language. I can't even patch the initContainer because when it is not schedulable, it does only appear on kubectl events, but not as a Kubernetes resource.
  > @antoinetran thanks for creating this issue! Yes we should add an option for this, I agree

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

### Incident Patch 1: `7d4225ae` (2026-09-29)
**Commit Message**: fix(ci): pass a boolean to oss branch cleanup (#2499)

The weekly cleanup in loft-sh/vcluster failed before any job started on Sep 13, 20 and 27. The staged OSS caller still passes the string expression github.event.inputs.dry_run || 'false' from a choice input to the shared workflow's boolean dry-run input. vcluster-pro#2490 fixed the pro caller (22cefa82a) but did not touch the staged OSS file, so the public mirror kept the broken caller.

Use a boolean dry_run input defaulting to true and pass the typed dispatch context, so manual runs stay dry by default and scheduled runs clean up live.

Monorepo-Commit: 74379aa7589f78340176fd34fc3286390c4b5b3f

**File**: `.github/workflows/cleanup-backport-branches.yaml` (modified, +3/-6)
```diff
@@ -8,11 +8,8 @@ on:
       dry_run:
         description: 'Dry run mode'
         required: false
-        default: 'true'
-        type: choice
-        options:
-          - 'true'
-          - 'false'
+        default: true
+        type: boolean
 
 permissions:
   contents: write
@@ -21,6 +18,6 @@ jobs:
   cleanup-backport-branches:
     uses: loft-sh/github-actions/.github/workflows/cleanup-backport-branches.yaml@cleanup-backport-branches/v1
     with:
-      dry-run: ${{ github.event.inputs.dry_run || 'false' }}
+      dry-run: ${{ github.event_name == 'workflow_dispatch' && inputs.dry_run }}
     secrets:
       gh-access-token: ${{ secrets.GH_ACCESS_TOKEN }}
```

---

### Incident Patch 2: `81b05906` (2026-09-28)
**Commit Message**: fix(deps): bump default kubernetes images to patched releases (#2489)

* fix(deps): bump default kubernetes images to patched releases

Bump the default ghcr.io/loft-sh/kubernetes images to the upstream
patch releases that fix CVE-2026-2270 in kube-controller-manager
(StatefulSet controller restoring more than spec from a
ControllerRevision):

- 1.36: v1.36.0 -> v1.36.5 (also the chart default)
- 1.35: v1.35.0 -> v1.35.9
- 1.34: v1.34.0 -> v1.34.12

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(cli): pin the kubernetes version the docker driver mounts

The docker driver pulls the kubernetes bundle for the CLI's default
version and bind-mounts it into the control plane container. A vCluster
started with an older --chart-version falls back to its own default,
sees the mounted kube-apiserver at a different version and re-downloads
the bundle into /tmp, which is a noexec tmpfs there, so the first exec
fails with "permission denied" and the node never joins.

Write the version the CLI mounted into the generated vcluster.yaml
unless the user already set controlPlane.distro.k8s.version or
controlPlane.distro.k8s.image.tag.

Co-Authored-By: Claude Opus 5.5 (1M

**File**: `chart/tests/statefulset_test.yaml` (modified, +3/-3)
```diff
@@ -520,7 +520,7 @@ tests:
     asserts:
       - equal:
           path: spec.template.spec.initContainers[0].image
-          value: ghcr.io/loft-sh/kubernetes:v1.36.0
+          value: ghcr.io/loft-sh/kubernetes:v1.36.5
 
   - it: k8s override image tag
     set:
@@ -589,7 +589,7 @@ tests:
     asserts:
     - equal:
         path: spec.template.spec.initContainers[0].image
-        value: ghcr.io/loft-sh/kubernetes:v1.36.0
+        value: ghcr.io/loft-sh/kubernetes:v1.36.5
 
   - it: k8s version not set, default tag images used for apiServer and controllerManager (virtual scheduler enabled, deprecated)
     chart:
@@ -605,7 +605,7 @@ tests:
     asserts:
       - equal:
           path: spec.template.spec.initContainers[0].image
-          value: ghcr.io/loft-sh/kubernetes:v1.36.0
+          value: ghcr.io/loft-sh/kubernetes:v1.36.5
 
   - it: k8s version sets image tag for apiServer and controllerManager (virtual scheduler enabled)
     set:
```

**File**: `chart/values.yaml` (modified, +1/-1)
```diff
@@ -322,7 +322,7 @@ controlPlane:
         # Repository is the repository of the container image, e.g. my-repo/my-image
         repository: "loft-sh/kubernetes"
         # Tag is the tag of the container image, and is the default version.
-        tag: "v1.36.0"
+        tag: "v1.36.5"
       # APIServer holds configuration specific to starting the api server.
       apiServer:
         enabled: true
```

**File**: `config/default_extra_values.go` (modified, +3/-3)
```diff
@@ -17,9 +17,9 @@ const (
 
 // K8SVersionMap holds the supported k8s api servers
 var K8SVersionMap = map[string]string{
-	"1.36": "ghcr.io/loft-sh/kubernetes:v1.36.0",
-	"1.35": "ghcr.io/loft-sh/kubernetes:v1.35.0",
-	"1.34": "ghcr.io/loft-sh/kubernetes:v1.34.0",
+	"1.36": "ghcr.io/loft-sh/kubernetes:v1.36.5",
+	"1.35": "ghcr.io/loft-sh/kubernetes:v1.35.9",
+	"1.34": "ghcr.io/loft-sh/kubernetes:v1.34.12",
 	"1.33": "ghcr.io/loft-sh/kubernetes:v1.33.4",
 	"1.32": "ghcr.io/loft-sh/kubernetes:v1.32.1",
 	"1.31": "ghcr.io/loft-sh/kubernetes:v1.31.1",
```

**File**: `config/values.yaml` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ controlPlane:
       image:
         registry: ghcr.io
         repository: "loft-sh/kubernetes"
-        tag: "v1.36.0"
+        tag: "v1.36.5"
       apiServer:
         enabled: true
         command: []
```

**File**: `devspace.yaml` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ deployments:
           distro:
             k8s:
               image:
-                tag: v1.36.0
+                tag: v1.36.5
           statefulSet:
             image:
               registry: ""
```

---

### Incident Patch 3: `5d9d4284` (2026-09-23)
**Commit Message**: fix(deps): update module google.golang.org/grpc to v1.83.2 [security] (#2428)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <caue.santos@loft.sh>
Monorepo-Commit: 28e9e3a95ce6246049131134bd31c58e7e3a4ce5

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ require (
 	go.uber.org/atomic v1.11.0
 	golang.org/x/mod v0.41.0
 	golang.org/x/sync v0.23.0
-	google.golang.org/grpc v1.83.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
 	gotest.tools v2.2.0+incompatible
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -737,8 +737,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7 h1:eM/YSd5bBFagF51o1E745Ta7RwzpW0h+z+QDNZOgmQ8=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
-google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
+google.golang.org/grpc v1.83.2 h1:EManeRomTObA0BU7I8vXgg/78uE5MJ9M8B39EX2WscU=
+google.golang.org/grpc v1.83.2/go.mod h1:YPI1hK3kDked6iHvgX3tR0y+nX/qpMFKhPgFsokw1S8=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
 google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `vendor/google.golang.org/grpc/internal/transport/http2_server.go` (modified, +6/-0)
```diff
@@ -522,6 +522,12 @@ func (t *http2Server) operateHeaders(ctx context.Context, frame *http2.MetaHeade
 		delete(mdata, "host")
 	}
 
+	// If :authority is still missing, i.e. no host or :authority header is
+	// present, reject the request as invalid.
+	if len(mdata[":authority"]) == 0 {
+		t.writeEarlyAbort(streamID, s.contentSubtype, status.New(codes.Internal, "no host or :authority header present"), http.StatusBadRequest, !frame.StreamEnded())
+		return nil
+	}
 	if frame.StreamEnded() {
 		// s is just created by the caller. No lock needed.
 		s.state = streamReadDone
```

**File**: `vendor/google.golang.org/grpc/version.go` (modified, +1/-1)
```diff
@@ -19,4 +19,4 @@
 package grpc
 
 // Version is the current grpc version.
-const Version = "1.83.1"
+const Version = "1.83.2"
```

**File**: `vendor/modules.txt` (modified, +1/-1)
```diff
@@ -1421,7 +1421,7 @@ google.golang.org/genproto/googleapis/api/httpbody
 ## explicit; go 1.25.0
 google.golang.org/genproto/googleapis/rpc/errdetails
 google.golang.org/genproto/googleapis/rpc/status
-# google.golang.org/grpc v1.83.1
+# google.golang.org/grpc v1.83.2
 ## explicit; go 1.25.0
 google.golang.org/grpc
 google.golang.org/grpc/attributes
```

---

### Incident Patch 4: `dcd93ab5` (2026-09-23)
**Commit Message**: fix(deps): update golang.org/x/exp digest to 85c1c22 (#2445)

* fix(deps): update golang.org/x/exp digest to 85c1c22

* fix(deps): sync root vendor for x/exp update

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <caue.santos@loft.sh>
Monorepo-Commit: 8373f3a8b15eff5de243cab3a0531e069e416b0a

**File**: `go.mod` (modified, +9/-9)
```diff
@@ -47,8 +47,8 @@ require (
 	go.etcd.io/etcd/pkg/v3 v3.6.8
 	go.etcd.io/etcd/server/v3 v3.6.8
 	go.uber.org/atomic v1.11.0
-	golang.org/x/mod v0.39.0
-	golang.org/x/sync v0.22.0
+	golang.org/x/mod v0.41.0
+	golang.org/x/sync v0.23.0
 	google.golang.org/grpc v1.83.1
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
@@ -283,15 +283,15 @@ require (
 	go.opentelemetry.io/proto/otlp v1.10.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	go.uber.org/zap v1.27.1
-	golang.org/x/crypto v0.55.0 // indirect
-	golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa
-	golang.org/x/net v0.58.0 // indirect
+	golang.org/x/crypto v0.57.0 // indirect
+	golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba
+	golang.org/x/net v0.59.0 // indirect
 	golang.org/x/oauth2 v0.36.0
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/term v0.45.0 // indirect
-	golang.org/x/text v0.41.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/term v0.46.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	golang.org/x/time v0.15.0 // indirect
-	golang.org/x/tools v0.49.0 // indirect
+	golang.org/x/tools v0.50.0 // indirect
 	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
```

**File**: `go.sum` (modified, +18/-18)
```diff
@@ -605,19 +605,19 @@ golang.org/x/crypto v0.13.0/go.mod h1:y6Z2r+Rw4iayiXXAIxJIDAJ1zMW4yaTpebo8fPOliY
 golang.org/x/crypto v0.19.0/go.mod h1:Iy9bg/ha4yyC70EfRS8jz+B6ybOBKMaSxLj6P6oBDfU=
 golang.org/x/crypto v0.23.0/go.mod h1:CKFgDieR+mRhux2Lsu27y0fO304Db0wZe70UKqHu0v8=
 golang.org/x/crypto v0.30.0/go.mod h1:kDsLvtWBEx7MV9tJOj9bnXsPbxwJQ6csT/x4KIN4Ssk=
-golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
-golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
-golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa h1:QSyA8ishJCyT21kER9KwNt0b7BM3iRK4x9QXhjN5Fdk=
-golang.org/x/exp v0.0.0-20260824195058-e88cd73687aa/go.mod h1:zeBbvyFKDaLwa7CH/zI8KXt7gTl14SF7sO08Pl5jBCM=
+golang.org/x/crypto v0.57.0 h1:3ZVCjf8Ggz7zneR/EHRVx68Ctf+2pmIMP2UFhh9cC6M=
+golang.org/x/crypto v0.57.0/go.mod h1:Fdz0i5U6CoizGwLda9DttjSk6qlZo25zYNtR+ycvuZA=
+golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba h1:Ck8QetSgk912qxWLMCKxd0in+aiyBQyDSMae6e/xmpU=
+golang.org/x/exp v0.0.0-20260908205506-85c1c2202aba/go.mod h1:50RgIsmK7OwqzTTeqcSXQW8SswW0o8fRcDxmqGluJ8E=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
 golang.org/x/mod v0.8.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.12.0/go.mod h1:iBbtSCu2XBx23ZKBPSOrRkjjQPZFPuis4dIYUhu/chs=
 golang.org/x/mod v0.15.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
 golang.org/x/mod v0.17.0/go.mod h1:hTbmBsO62+eylJbnUtE2MGJUyE7QWk4xUqPFrRgJ+7c=
-golang.org/x/mod v0.39.0 h1:UF5zwQdCRRUpHfyPwr7d4UrGiVeldIsogtzWVnczL74=
-golang.org/x/mod v0.39.0/go.mod h1:bvIbwjQ0HUFFf5AKukeeYQG4ZBUG9yxQbR9aEweIwYY=
+golang.org/x/mod v0.41.0 h1:qJmnOUb4YB+FsEuM3HcWucdZASCPGhsX6uljO6pog0c=
+golang.org/x/mod v0.41.0/go.mod h1:Ek9pY8RKWXwsWvd3rQiHYtMqkjSUV+s1Rj7j4H5Ur6o=
 golang.org/x/net v0.0.0-20180724234803-3673e40ba225/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20180906233101-161cd47e91fd/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190311183353-d8887717615a/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
@@ -634,8 +634,8 @@ golang.org/x/net v0.10.0/go.mod h1:0qNGK6F8kojg2nk9dLZ2mShWaEBan6FAoqfSigmmuDg=
 golang.org/x/net v0.15.0/go.mod h1:idbUs1IY1+zTqbi8yxTbhexhEEk5ur9LInksu6HrEpk=
 golang.org/x/net v0.21.0/go.mod h1:bIjVDfnllIU7BJ2DNgfnXvpSvtn8VRwhlsaeUTyUS44=
 golang.org/x/net v0.25.0/go.mod h1:JkAGAh7GEvH74S6FOH42FLoXpXbE/aqXSrIQjXgsiwM=
-golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
-golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
+golang.org/x/net v0.59.0 h1:5zfYln+w5XCxwrnMMJPufRgNoXEaGxl0wo5GqPXyues=
+golang.org/x/net v0.59.0/go.mod h1:2DA/G1UfVbCpQPeWTmMPGY7Cs2PkBkwu743bVX5PIVg=
 golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.0.0-20181106182150-f42d05182288/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
@@ -650,8 +650,8 @@ golang.org/x/sync v0.3.0/go.mod h1:FU7BRWz2tNW+3quACPkgCx/L+uEAv1htQ0V83Z9Rj+Y=
 golang.org/x/sync v0.6.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
 golang.org/x/sync v0.7.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
 golang.org/x/sync v0.10.0/go.mod h1:Czt+wKu1gCyEFDUtn0jG5QVvpJ6rzVqr5aXyt9drQfk=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
 golang.org/x/sys v0.0.0-20180909124046-d0be0721c37e/go.mod h1:S
```

**File**: `vendor/golang.org/x/net/html/escape.go` (modified, +1/-4)
```diff
@@ -154,10 +154,7 @@ func unescapeEntity(s []byte, attribute bool) (rune, rune, int) {
 	} else if x := entity2[entityName]; x[0] != 0 {
 		return x[0], x[1], i
 	} else if !attribute {
-		maxLen := len(entityName) - 1
-		if maxLen > longestEntityWithoutSemicolon {
-			maxLen = longestEntityWithoutSemicolon
-		}
+		maxLen := min(len(entityName)-1, longestEntityWithoutSemicolon)
 		for j := maxLen; j > 1; j-- {
 			if x := entity[entityName[:j]]; x != 0 {
 				return x, 0, j + 1
```

**File**: `vendor/golang.org/x/net/http2/ascii.go` (modified, +13/-1)
```diff
@@ -4,7 +4,9 @@
 
 package http2
 
-import "strings"
+import (
+	"strings"
+)
 
 // The HTTP protocols are defined in terms of ASCII, not Unicode. This file
 // contains helper functions which may use Unicode-aware functions which would
@@ -43,6 +45,16 @@ func isASCIIPrint(s string) bool {
 	return true
 }
 
+// isASCII returns whether s is ASCII.
+func isASCII(s string) bool {
+	for i := 0; i < len(s); i++ {
+		if s[i] > 0x7f {
+			return false
+		}
+	}
+	return true
+}
+
 // asciiToLower returns the lowercase version of s if s is ASCII and printable,
 // and whether or not it was.
 func asciiToLower(s string) (lower string, ok bool) {
```

**File**: `vendor/golang.org/x/net/http2/databuffer.go` (modified, +1/-4)
```diff
@@ -121,10 +121,7 @@ func (b *dataBuffer) Write(p []byte) (int, error) {
 		// If the last chunk is empty, allocate a new chunk. Try to allocate
 		// enough to fully copy p plus any additional bytes we expect to
 		// receive. However, this may allocate less than len(p).
-		want := int64(len(p))
-		if b.expected > want {
-			want = b.expected
-		}
+		want := max(int64(len(p)), b.expected)
 		chunk := b.lastChunkOrAlloc(want)
 		n := copy(chunk[b.w:], p)
 		p = p[n:]
```

---

### Incident Patch 5: `70085485` (2026-09-23)
**Commit Message**: fix(deps): update module github.com/kubernetes-csi/external-snapshotter/client/v8 to v8.6.0 (#2449)

* fix(deps): update module github.com/kubernetes-csi/external-snapshotter/client/v8 to v8.6.0

* chore(deps): sync root vendor metadata

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <caue.santos@loft.sh>
Monorepo-Commit: 7a4d28ac4b261300bc83011e1d19940a2bc9aacc

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ require (
 	github.com/hashicorp/go-plugin v1.8.0
 	github.com/hashicorp/golang-lru/v2 v2.0.7
 	github.com/invopop/jsonschema v0.14.0
-	github.com/kubernetes-csi/external-snapshotter/client/v8 v8.2.0
+	github.com/kubernetes-csi/external-snapshotter/client/v8 v8.6.0
 	github.com/loft-sh/admin-apis v0.0.0-20260721223200-58c89e54604e
 	github.com/loft-sh/agentapi/v4 v4.12.0-rc.3
 	github.com/loft-sh/analytics-client v0.0.0-20240219162240-2f4c64b2494e
```

**File**: `go.sum` (modified, +2/-2)
```diff
@@ -338,8 +338,8 @@ github.com/kr/pty v1.1.1/go.mod h1:pFQYn66WHrOpPYNljwOMqo10TkYh1fy3cYio2l3bCsQ=
 github.com/kr/text v0.1.0/go.mod h1:4Jbv+DJW3UT/LiOwJeYQe1efqtUx/iVham/4vfdArNI=
 github.com/kr/text v0.2.0 h1:5Nx0Ya0ZqY2ygV366QzturHI13Jq95ApcVaJBhpS+AY=
 github.com/kr/text v0.2.0/go.mod h1:eLer722TekiGuMkidMxC/pM04lWEeraHUUmBw8l2grE=
-github.com/kubernetes-csi/external-snapshotter/client/v8 v8.2.0 h1:Q3jQ1NkFqv5o+F8dMmHd8SfEmlcwNeo1immFApntEwE=
-github.com/kubernetes-csi/external-snapshotter/client/v8 v8.2.0/go.mod h1:E3vdYxHj2C2q6qo8/Da4g7P+IcwqRZyy3gJBzYybV9Y=
+github.com/kubernetes-csi/external-snapshotter/client/v8 v8.6.0 h1:FtGewu2k6HWw6evLGXY8JqUZ9eHpti1kd3e4amj+ilA=
+github.com/kubernetes-csi/external-snapshotter/client/v8 v8.6.0/go.mod h1:Vxl89NySJ45J+ah3NTMan/KJXW+NpcGHE2Tw0GSw53k=
 github.com/kylelemons/godebug v1.1.0 h1:RPNrshWIDI6G2gRW9EHilWtl7Z6Sb1BR0xunSBf0SNc=
 github.com/kylelemons/godebug v1.1.0/go.mod h1:9/0rRGxNHcop5bhtWyNeEfOS8JIWk580+fNqagV/RAw=
 github.com/liggitt/tabwriter v0.0.0-20181228230101-89fcab3d43de h1:9TO3cAIGXtEhnIaL+V+BEER86oLrvS+kWobKpbJuye0=
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/doc.go` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+/*
+Copyright 2026 The Kubernetes Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+// +k8s:deepcopy-gen=package
+// +groupName=groupsnapshot.storage.k8s.io
+
+package v1
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/register.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+/*
+Copyright 2026 The Kubernetes Authors.
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+    http://www.apache.org/licenses/LICENSE-2.0
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+
+package v1
+
+import (
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+)
+
+// GroupName is the group name use in this package.
+const GroupName = "groupsnapshot.storage.k8s.io"
+
+var (
+	// SchemeBuilder is the new scheme builder
+	SchemeBuilder = runtime.NewSchemeBuilder(addKnownTypes)
+	// AddToScheme adds to scheme
+	AddToScheme = SchemeBuilder.AddToScheme
+	// SchemeGroupVersion is the group version used to register these objects.
+	SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: "v1"}
+)
+
+func Resource(resource string) schema.GroupResource {
+	return SchemeGroupVersion.WithResource(resource).GroupResource()
+}
+
+func init() {
+	// We only register manually written functions here. The registration of the
+	// generated functions takes place in the generated files. The separation
+	// makes the code compile even when the generated files are missing.
+	SchemeBuilder.Register(addKnownTypes)
+}
+
+// addKnownTypes adds the set of types defined in this package to the supplied scheme.
+func addKnownTypes(scheme *runtime.Scheme) error {
+	scheme.AddKnownTypes(SchemeGroupVersion,
+		&VolumeGroupSnapshotClass{},
+		&VolumeGroupSnapshotClassList{},
+		&VolumeGroupSnapshot{},
+		&VolumeGroupSnapshotList{},
+		&VolumeGroupSnapshotContent{},
+		&VolumeGroupSnapshotContentList{},
+	)
+	metav1.AddToGroupVersion(scheme, SchemeGroupVersion)
+	return nil
+}
```

**File**: `vendor/github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumegroupsnapshot/v1/types.go` (added, +444/-0)
```diff
@@ -0,0 +1,444 @@
+/*
+Copyright 2026 The Kubernetes Authors.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+*/
+// +kubebuilder:object:generate=true
+package v1
+
+import (
+	core_v1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+
+	snapshotv1 "github.com/kubernetes-csi/external-snapshotter/client/v8/apis/volumesnapshot/v1"
+)
+
+// VolumeGroupSnapshotSpec defines the desired state of a volume group snapshot.
+type VolumeGroupSnapshotSpec struct {
+	// Source specifies where a group snapshot will be created from.
+	// This field is immutable after creation.
+	// Required.
+	Source VolumeGroupSnapshotSource `json:"source" protobuf:"bytes,1,opt,name=source"`
+
+	// VolumeGroupSnapshotClassName is the name of the VolumeGroupSnapshotClass
+	// requested by the VolumeGroupSnapshot.
+	// VolumeGroupSnapshotClassName may be left nil to indicate that the default
+	// class will be used.
+	// Empty string is not allowed for this field.
+	// +optional
+	// +kubebuilder:validation:XValidation:rule="size(self) > 0",message="volumeGroupSnapshotClassName must not be the empty string when set"
+	VolumeGroupSnapshotClassName *string `json:"volumeGroupSnapshotClassName,omitempty" protobuf:"bytes,2,opt,name=volumeGroupSnapshotClassName"`
+}
+
+// VolumeGroupSnapshotSource specifies whether the underlying group snapshot should be
+// dynamically taken upon creation or if a pre-existing VolumeGroupSnapshotContent
+// object should be used.
+// Exactly one of its members must be set.
+// Members in VolumeGroupSnapshotSource are immutable.
+// +kubebuilder:validation:XValidation:rule="!has(oldSelf.selector) || has(self.selector)", message="selector is required once set"
+// +kubebuilder:validation:XValidation:rule="!has(oldSelf.volumeGroupSnapshotContentName) || has(self.volumeGroupSnapshotContentName)", message="volumeGroupSnapshotContentName is required once set"
+// +kubebuilder:validation:XValidation:rule="(has(self.selector) && !has(self.volumeGroupSnapshotContentName)) || (!has(self.selector) && has(self.volumeGroupSnapshotContentName))", message="exactly one of selector and volumeGroupSnapshotContentName must be set"
+type VolumeGroupSnapshotSource struct {
+	// Selector is a label query over persistent volume claims that are to be
+	// grouped together for snapshotting.
+	// This labelSelector will be used to match the label added to a PVC.
+	// If the label is added or removed to a volume after a group snapshot
+	// is created, the existing group snapshots won't be modified.
+	// Once a VolumeGroupSnapshotContent is created and the sidecar starts to process
+	// it, the volume list will not change with retries.
+	// +optional
+	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="selector is immutable"
+	Selector *metav1.LabelSelector `json:"selector,omitempty" protobuf:"bytes,1,opt,name=selector"`
+
+	// VolumeGroupSnapshotContentName specifies the name of a pre-existing VolumeGroupSnapshotContent
+	// object representing an existing volume group snapshot.
+	// This field should be set if the volume group snapshot already exists and
+	// only needs a representation in Kubernetes.
+	// This field is immutable.
+	// +optional
+	// +kubebuilder:validation:XValidation:rule="self == oldSelf",message="volumeGroupSnapshotContentName is immutable"
+	VolumeGroupSnapshotContentName *string `json:"volumeGroupSnapshotContentName,omitempty" protobuf:"bytes,2,opt,name=volumeGroupSnapshotContentName"`
+}
+
+// VolumeGroupSnapshotS
```

---

### Incident Patch 6: `615844ee` (2026-09-21)
**Commit Message**: fix(etcd): make embedded etcd defragmentation timeout configurable (#2293)

* fix(etcd): make embedded etcd defragmentation timeout configurable

* fix(etcd): only blame the defrag timeout on a deadline

ctx.Err() is also set when the syncer shuts down or Stop() is called during a
snapshot restore. Telling the user to raise defragTimeout is wrong in that case,
so match context.DeadlineExceeded instead of any context error.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

* test(e2e): assert the default etcd defragTimeout path end to end

Nothing exercised defragTimeout on a running vCluster, so the config key could
stop reaching the syncer without any test noticing.

The default PR-gating embedded-etcd suite leaves the key unset and asserts the
syncer took an enabled branch, which pins the config-to-runtime path without a
new vCluster. The "0s" end needs the field in the OSS mirror the e2e CLI and
chart are built from, so it lands in a stacked follow-up PR.

The asserted log lines become exported constants in pkg/etcd so a rewording
breaks the build instead of leaving a test green against a string the product no
longer emits.

Co-Authored-By: Claude Opus 5 (1M c

**File**: `chart/values.schema.json` (modified, +5/-0)
```diff
@@ -1982,6 +1982,11 @@
           "type": "integer",
           "description": "SnapshotCount defines the number of snapshots to keep for the embedded etcd. Defaults to 10000 if less than 1."
         },
+        "defragTimeout": {
+          "type": "string",
+          "description": "DefragTimeout defines how long the etcd defragmentation on startup may take, e.g. \"5m\".\nvCluster fails to start if exceeded. Set to \"0s\" to skip defragmentation entirely.",
+          "pro": true
+        },
         "extraArgs": {
           "items": {
             "type": "string"
```

**File**: `chart/values.yaml` (modified, +3/-0)
```diff
@@ -401,6 +401,9 @@ controlPlane:
         enabled: false
         # MigrateFromDeployedEtcd signals that vCluster should migrate from the deployed external etcd to embedded etcd.
         migrateFromDeployedEtcd: false
+        # DefragTimeout defines how long the etcd defragmentation on startup may take, e.g. "5m".
+        # vCluster fails to start if exceeded. Set to "0s" to skip defragmentation entirely.
+        defragTimeout: 5m
         # ExtraArgs are additional arguments to pass to the embedded etcd.
         extraArgs: []
       # External defines to use a self-hosted external etcd that is not deployed by the helm chart
```

**File**: `config/config.go` (modified, +4/-0)
```diff
@@ -2375,6 +2375,10 @@ type EtcdEmbedded struct {
 	// SnapshotCount defines the number of snapshots to keep for the embedded etcd. Defaults to 10000 if less than 1.
 	SnapshotCount int `json:"snapshotCount,omitempty"`
 
+	// DefragTimeout defines how long the etcd defragmentation on startup may take, e.g. "5m".
+	// vCluster fails to start if exceeded. Set to "0s" to skip defragmentation entirely.
+	DefragTimeout Duration `json:"defragTimeout,omitempty" product:"pro"`
+
 	// ExtraArgs are additional arguments to pass to the embedded etcd.
 	ExtraArgs []string `json:"extraArgs,omitempty"`
 }
```

**File**: `config/values.yaml` (modified, +1/-0)
```diff
@@ -183,6 +183,7 @@ controlPlane:
       embedded:
         enabled: false
         migrateFromDeployedEtcd: false
+        defragTimeout: 5m
         extraArgs: []
       external:
         enabled: false
```

---

### Incident Patch 7: `105f5537` (2026-09-18)
**Commit Message**: fix(cli): drop kubeconfig url path when port-forwarding

portForwardServer rewrote only the host and re-serialized the parsed
url, so a path, query or user info on the kubeconfig server survived
into the port-forwarded address. Port-forwarding tunnels to the pod
API, which serves at the root, so those components point at an endpoint
that does not serve them and requests 404 until connect hits its
deadline.

Build the forwarded address from the scheme and the local host instead,
so only components that survive the rewrite are carried over.

Monorepo-Commit: 5067a595cbf31a11c0df7ed1fde572b7b76ca929

**File**: `pkg/cli/connect_helm.go` (modified, +8/-2)
```diff
@@ -469,8 +469,14 @@ func portForwardServer(server string, localPort int) (string, string, error) {
 		return "", "", err
 	}
 
-	parsed.Host = net.JoinHostPort("localhost", strconv.Itoa(localPort))
-	return parsed.String(), remotePort, nil
+	// Port-forwarding tunnels to the pod API, which serves at the root, so only
+	// the scheme carries over. Any path, query or user info from an ingress-facing
+	// server would be sent to an endpoint that does not serve it.
+	forwarded := &url.URL{
+		Scheme: parsed.Scheme,
+		Host:   net.JoinHostPort("localhost", strconv.Itoa(localPort)),
+	}
+	return forwarded.String(), remotePort, nil
 }
 
 func serverPort(parsed *url.URL) (string, error) {
```

**File**: `pkg/cli/connect_helm_test.go` (modified, +21/-0)
```diff
@@ -136,6 +136,27 @@ func TestPortForwardServer(t *testing.T) {
 			expectedServer: "https://localhost:10443",
 			expectedPort:   "9443",
 		},
+		{
+			name:           "server with path",
+			server:         "https://example.com:443/prefix",
+			localPort:      10443,
+			expectedServer: "https://localhost:10443",
+			expectedPort:   "443",
+		},
+		{
+			name:           "server with path and no explicit port",
+			server:         "https://example.com/prefix/deeper",
+			localPort:      10443,
+			expectedServer: "https://localhost:10443",
+			expectedPort:   "8443",
+		},
+		{
+			name:           "server with query and user info",
+			server:         "https://user:pw@example.com:443/prefix?foo=bar",
+			localPort:      10443,
+			expectedServer: "https://localhost:10443",
+			expectedPort:   "443",
+		},
 	}
 
 	for _, tt := range tests {
```

---

### Incident Patch 8: `05813082` (2026-09-14)
**Commit Message**: fix(syncer): skip the cache wait when apply returns no resourceVersion (#2440)

* fix(syncer): skip the cache wait when apply returns no resourceVersion

* test(e2e): cover a metrics-server control plane restart with workloads

* test(e2e): bind the metrics proxy polls to the spec context

* test(e2e): pin the metrics proxy restart workload image

* test(e2e): verify workload pod metrics after the metrics proxy restart

Monorepo-Commit: b55f89a0388948eec7daa6c6c65f03e872e3d2b7

**File**: `e2e/suite_metricsproxy_test.go` (modified, +2/-0)
```diff
@@ -38,6 +38,8 @@ func suiteMetricsProxyVCluster() {
 			})
 
 			metricsproxy.MetricsProxySpec()
+			// last, because it restarts the control plane and the suite connection does not survive that
+			metricsproxy.MetricsProxyRestartSpec()
 		},
 	)
 }
```

**File**: `e2e/test_integration/metricsproxy/test_metricsproxy.go` (modified, +47/-24)
```diff
@@ -9,6 +9,7 @@ import (
 	"github.com/loft-sh/vcluster/e2e/labels"
 	. "github.com/onsi/ginkgo/v2"
 	. "github.com/onsi/gomega"
+	gomegatypes "github.com/onsi/gomega/types"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/client-go/rest"
 	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
@@ -33,39 +34,61 @@ func MetricsProxySpec() {
 			})
 
 			It("should register and expose the metrics API service as Available", func(ctx context.Context) {
-				apiRegistrationClient := apiregistrationv1clientset.NewForConfigOrDie(vClusterConfig)
-
-				Eventually(func(g Gomega) {
-					apiService, err := apiRegistrationClient.APIServices().Get(ctx, "v1beta1.metrics.k8s.io", metav1.GetOptions{})
-					g.Expect(err).To(Succeed(), "failed to get APIService v1beta1.metrics.k8s.io")
-					g.Expect(apiService.Status.Conditions).To(ContainElement(SatisfyAll(
-						HaveField("Type", apiregistrationv1.Available),
-						HaveField("Status", apiregistrationv1.ConditionTrue),
-					)), "APIService v1beta1.metrics.k8s.io not yet Available=True, conditions: %v", apiService.Status.Conditions)
-				}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+				waitForMetricsAPIServiceAvailable(ctx, vClusterConfig)
 			})
 
 			It("should return non-empty node metrics and pod metrics from kube-system", func(ctx context.Context) {
-				metricsClient := metricsv1beta1client.NewForConfigOrDie(vClusterConfig)
-
 				By("waiting for node metrics to be available", func() {
-					Eventually(func(g Gomega) {
-						nodeMetricsList, err := metricsClient.NodeMetricses().List(ctx, metav1.ListOptions{})
-						g.Expect(err).To(Succeed(), "failed to list node metrics")
-						g.Expect(nodeMetricsList.Items).NotTo(BeEmpty(),
-							"expected at least one node metrics entry, got %d", len(nodeMetricsList.Items))
-					}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+					waitForNodeMetrics(ctx, vClusterConfig)
 				})
 
 				By("waiting for pod metrics in kube-system to be available", func() {
-					Eventually(func(g Gomega) {
-						podMetricsList, err := metricsClient.PodMetricses("kube-system").List(ctx, metav1.ListOptions{})
-						g.Expect(err).To(Succeed(), "failed to list pod metrics in kube-system")
-						g.Expect(podMetricsList.Items).NotTo(BeEmpty(),
-							"expected at least one pod metrics entry in kube-system, got %d", len(podMetricsList.Items))
-					}).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+					waitForPodMetrics(ctx, vClusterConfig, "kube-system", Not(BeEmpty()))
 				})
 			})
 		},
 	)
 }
+
+// waitForMetricsAPIServiceAvailable waits until the metrics APIService in the
+// tenant cluster reports Available=True.
+func waitForMetricsAPIServiceAvailable(ctx context.Context, vClusterConfig *rest.Config) {
+	GinkgoHelper()
+	apiRegistrationClient := apiregistrationv1clientset.NewForConfigOrDie(vClusterConfig)
+	Eventually(func(g Gomega) {
+		apiService, err := apiRegistrationClient.APIServices().Get(ctx, "v1beta1.metrics.k8s.io", metav1.GetOptions{})
+		g.Expect(err).To(Succeed(), "failed to get APIService v1beta1.metrics.k8s.io")
+		g.Expect(apiService.Status.Conditions).To(ContainElement(SatisfyAll(
+			HaveField("Type", apiregistrationv1.Available),
+			HaveField("Status", apiregistrationv1.ConditionTrue),
+		)), "APIService v1beta1.metrics.k8s.io not yet Available=True, conditions: %v", apiService.Status.Conditions)
+	}).WithContext(ctx).WithPolling(constants.PollingInterval).WithTimeout(constants.PollingTimeoutLong).Should(Succeed())
+}
+
+// waitForNodeMetrics waits until the metrics proxy serves at least one node
+// metrics entry.
+func waitForNodeMetrics(ctx context.Context, vClusterConfig *rest.Config) {
+	GinkgoHelper()
+	metricsClient := metricsv1beta1client.NewForConfigOrDie(vClusterConfig)
+	Eventually(func(g Gomega) {
+		nodeMetricsList, err := metricsCli
```

**File**: `e2e/test_integration/metricsproxy/test_metricsproxy_restart.go` (added, +256/-0)
```diff
@@ -0,0 +1,256 @@
+package metricsproxy
+
+import (
+	"context"
+	"fmt"
+	"os"
+	"strings"
+
+	"github.com/loft-sh/e2e-framework/pkg/setup/cluster"
+	loftlog "github.com/loft-sh/log"
+	connectcmd "github.com/loft-sh/vcluster/cmd/vclusterctl/cmd"
+	"github.com/loft-sh/vcluster/e2e/constants"
+	"github.com/loft-sh/vcluster/e2e/labels"
+	"github.com/loft-sh/vcluster/pkg/cli"
+	"github.com/loft-sh/vcluster/pkg/cli/config"
+	"github.com/loft-sh/vcluster/pkg/cli/flags"
+	"github.com/loft-sh/vcluster/pkg/util/random"
+	. "github.com/onsi/ginkgo/v2"
+	. "github.com/onsi/gomega"
+	"github.com/spf13/cobra"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/types"
+	"k8s.io/client-go/kubernetes"
+	"k8s.io/client-go/rest"
+	"k8s.io/client-go/tools/clientcmd"
+	clientpkg "sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+// MetricsProxyRestartSpec registers the control plane restart test for the
+// metrics proxy integration. On every start the syncer re-applies the
+// deletion protection policy for the metrics APIService. Once the policy
+// exists that apply changes nothing, and the control plane used to crash-loop
+// waiting for a cache update that never came (ENGCP-1458).
+//
+// The spec deletes the control plane pod, so the suite connection is dead
+// afterwards. Register it after the other metrics proxy specs.
+func MetricsProxyRestartSpec() {
+	Describe("Metrics proxy integration after a control plane restart",
+		labels.Integration,
+		func() {
+			var (
+				vClusterName      string
+				vClusterNamespace string
+				hostKubeconfig    string
+				hostClient        kubernetes.Interface
+				vClusterClient    kubernetes.Interface
+			)
+
+			BeforeEach(func(ctx context.Context) context.Context {
+				vClusterName = cluster.CurrentClusterNameFrom(ctx)
+				vClusterNamespace = "vcluster-" + vClusterName
+				hostKubeconfig = cluster.From(ctx, constants.GetHostClusterName()).GetKubeconfig()
+				hostClient = cluster.KubeClientFrom(ctx, constants.GetHostClusterName())
+				Expect(hostClient).NotTo(BeNil())
+				vClusterClient = cluster.CurrentKubeClientFrom(ctx)
+				Expect(vClusterClient).NotTo(BeNil())
+				return ctx
+			})
+
+			It("should come back with the metrics API available after the control plane pod is deleted", func(ctx context.Context) {
+				suffix := random.String(6)
+				workloadNamespace := "metrics-restart-" + suffix
+				workloadPodName := "metrics-restart-workload-" + suffix
+
+				By("Running a workload so the control plane restarts on a non-empty tenant cluster", func() {
+					_, err := vClusterClient.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
+						ObjectMeta: metav1.ObjectMeta{Name: workloadNamespace},
+					}, metav1.CreateOptions{})
+					Expect(err).To(Succeed(), "creating namespace %s", workloadNamespace)
+					DeferCleanup(func(ctx context.Context) {
+						// vClusterClient is replaced by a fresh connection after the restart
+						err := vClusterClient.CoreV1().Namespaces().Delete(ctx, workloadNamespace, metav1.DeleteOptions{})
+						Expect(clientpkg.IgnoreNotFound(err)).To(Succeed(), "deleting namespace %s", workloadNamespace)
+					})
+
+					_, err = vClusterClient.CoreV1().Pods(workloadNamespace).Create(ctx, &corev1.Pod{
+						ObjectMeta: metav1.ObjectMeta{Name: workloadPodName},
+						Spec: corev1.PodSpec{
+							Containers: []corev1.Container{{Name: "nginx", Image: "nginx:1.25.0"}},
+						},
+					}, metav1.CreateOptions{})
+					Expect(err).To(Succeed(), "creating pod %s/%s", workloadNamespace, workloadPodName)
+
+					Eventually(func(g Gomega) {
+						pod, err := vClusterClient.CoreV1().Pods(workloadNamespace).Get(ctx, workloadPodName, metav1.GetOptions{})
+						g.Expect(err).To(Succeed(), "getting pod %s/%s", workloadNamespace, workloadPodName)
+						g.Expect(pod.Status.Phase).To(Equal(corev1.PodRunning),
+							"pod %s/%s is %s, expected Running", workloadNamespace, workloadPodName, pod.Status.Phase)
+					}).WithConte
```

**File**: `pkg/util/blockingcacheclient/client.go` (modified, +8/-0)
```diff
@@ -190,6 +190,14 @@ func (c *CacheClient) blockApply(ctx context.Context, obj runtime.ApplyConfigura
 		return err
 	}
 
+	// controller-runtime before v0.24 never decodes the apply response into a
+	// typed ApplyConfiguration, see kubernetes-sigs/controller-runtime#3475, so
+	// the applied object carries no resource version. Then there is nothing to
+	// wait for, and polling would only ever run into the timeout.
+	if applied.GetResourceVersion() == "" {
+		return nil
+	}
+
 	return c.poll(ctx, applied, func(newObj client.Object, appliedAccessor metav1.Object) (bool, error) {
 		err := c.Client.Get(ctx, types.NamespacedName{Namespace: appliedAccessor.GetNamespace(), Name: appliedAccessor.GetName()}, newObj)
 		if err != nil {
```

**File**: `pkg/util/blockingcacheclient/client_test.go` (modified, +36/-0)
```diff
@@ -31,6 +31,9 @@ type applyServer struct {
 	response *unstructured.Unstructured
 	// getErr, when set, is what every Get returns instead of consulting cached.
 	getErr error
+	// responseNotWrittenBack makes Apply leave the ApplyConfiguration untouched,
+	// the way controller-runtime before v0.24 handled typed ApplyConfigurations.
+	responseNotWrittenBack bool
 }
 
 func (s *applyServer) Get(_ context.Context, key client.ObjectKey, obj client.Object, _ ...client.GetOption) error {
@@ -51,6 +54,10 @@ func (s *applyServer) Apply(_ context.Context, obj runtime.ApplyConfiguration, _
 	s.mu.Lock()
 	defer s.mu.Unlock()
 
+	if s.responseNotWrittenBack {
+		return nil
+	}
+
 	body, err := json.Marshal(s.response.Object)
 	if err != nil {
 		return err
@@ -135,6 +142,35 @@ func TestStatusApplyNoOpReturnsWithoutWaitingForACacheChange(t *testing.T) {
 	}
 }
 
+func TestApplySkipsTheCacheWaitWhenTheResponseIsNotWrittenBack(t *testing.T) {
+	// controller-runtime before v0.24 leaves a typed ApplyConfiguration
+	// untouched, so the applied object has no resource version to wait for.
+	// The cache is behind here, yet waiting could only run into the timeout.
+	server := &applyServer{cached: policyObject("uid-1", "10"), responseNotWrittenBack: true}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(start); elapsed > time.Second {
+		t.Fatalf("apply blocked for %s although the response was not written back", elapsed)
+	}
+}
+
+func TestStatusApplySkipsTheCacheWaitWhenTheResponseIsNotWrittenBack(t *testing.T) {
+	server := &applyServer{cached: policyObject("uid-1", "10"), responseNotWrittenBack: true}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Status().Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("status apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(start); elapsed > time.Second {
+		t.Fatalf("status apply blocked for %s although the response was not written back", elapsed)
+	}
+}
+
 func TestApplyWaitsUntilCacheReachesReturnedResourceVersion(t *testing.T) {
 	server := &applyServer{cached: policyObject("uid-1", "10"), response: policyObject("uid-1", "11")}
 	c := &CacheClient{Client: server}
```

---

### Incident Patch 9: `33a99045` (2026-09-09)
**Commit Message**: fix(syncer): make no-op apply return instead of timing out the cache wait (#2432)

* fix(syncer): make no-op apply return instead of timing out the cache wait

* test(syncer): drop the unused scheme from the blocking cache client tests

* test(syncer): cover the poll error branches of the blocking apply wait

* fix(syncer): let resource versions settle a delete and recreate in the apply wait

* fix(syncer): match opaque resource versions exactly in the apply wait

Monorepo-Commit: 4cdd829a6bb86362bacfea4c413369eb245a7d2a

**File**: `pkg/util/blockingcacheclient/client.go` (modified, +28/-78)
```diff
@@ -3,6 +3,7 @@ package blockingcacheclient
 import (
 	"context"
 	"fmt"
+	"strconv"
 	"time"
 
 	"github.com/loft-sh/vcluster/pkg/util"
@@ -175,94 +176,57 @@ func (c *CacheClient) Delete(ctx context.Context, obj client.Object, opts ...cli
 }
 
 func (c *CacheClient) Apply(ctx context.Context, obj runtime.ApplyConfiguration, opts ...client.ApplyOption) error {
-	clientObj, err := util.ExtractClientObjectFromApplyConfiguration(obj)
+	err := c.Client.Apply(ctx, obj, opts...)
 	if err != nil {
 		return err
 	}
 
-	var preApplyMeta metav1.Object
-	nn := types.NamespacedName{Namespace: clientObj.GetNamespace(), Name: clientObj.GetName()}
-	preApplyObj, err := c.newEmptyObjectFor(clientObj)
-	if err != nil {
-		return err
-	}
-	if getErr := c.Client.Get(ctx, nn, preApplyObj); getErr == nil {
-		preApplyMeta, _ = meta.Accessor(preApplyObj)
-	}
-
-	err = c.Client.Apply(ctx, obj, opts...)
-	if err != nil {
-		return err
-	}
-	return c.blockApply(ctx, obj, clientObj, preApplyMeta)
+	return c.blockApply(ctx, obj)
 }
 
-// newEmptyObjectFor returns an empty client.Object with the same GVK as from, for use with Get.
-func (c *CacheClient) newEmptyObjectFor(from client.Object) (client.Object, error) {
-	if u, ok := from.(*unstructured.Unstructured); ok {
-		out := &unstructured.Unstructured{}
-		out.GetObjectKind().SetGroupVersionKind(u.GetObjectKind().GroupVersionKind())
-		return out, nil
-	}
-	gvk, err := apiutil.GVKForObject(from, c.scheme)
-	if err != nil {
-		return nil, fmt.Errorf("get GVK for object: %w", err)
-	}
-	created, err := c.scheme.New(gvk)
-	if err != nil {
-		return nil, fmt.Errorf("create object for GVK %s: %w", gvk, err)
-	}
-	return created.(client.Object), nil
-}
-
-// blockApply waits until the applied object appears in the cache with the expected state.
-// clientObj must be non-nil (caller must have extracted it from the ApplyConfiguration).
-// preApplyMeta is the object's metadata from a GET before Apply; if nil (e.g. object did not exist),
-// we consider the cache updated once the object exists. Otherwise we compare until UID/Generation/ResourceVersion
-// differ so the cache has observed the Apply.
-func (c *CacheClient) blockApply(ctx context.Context, obj runtime.ApplyConfiguration, clientObj client.Object, preApplyMeta metav1.Object) error {
-	nn := types.NamespacedName{Namespace: clientObj.GetNamespace(), Name: clientObj.GetName()}
-	newObj, err := c.newEmptyObjectFor(clientObj)
+func (c *CacheClient) blockApply(ctx context.Context, obj runtime.ApplyConfiguration) error {
+	applied, err := util.ExtractClientObjectFromApplyConfiguration(obj)
 	if err != nil {
 		return err
 	}
 
-	return wait.PollUntilContextTimeout(ctx, time.Millisecond*10, time.Second*2, true, func(context.Context) (bool, error) {
-		err := c.Client.Get(ctx, nn, newObj)
+	return c.poll(ctx, applied, func(newObj client.Object, appliedAccessor metav1.Object) (bool, error) {
+		err := c.Client.Get(ctx, types.NamespacedName{Namespace: appliedAccessor.GetNamespace(), Name: appliedAccessor.GetName()}, newObj)
 		if err != nil {
 			if runtime.IsNotRegisteredError(err) {
-				// If the type is not registered in the scheme, we consider it a success
-				// to avoid blocking indefinitely.
 				return true, nil
 			} else if !kerrors.IsNotFound(err) {
-				// Return other errors (e.g. connection issues, permission errors) to stop polling.
 				return false, err
 			}
-			// If the object is not found, keep polling (return false, nil).
-			// For an Apply operation, we expect the object to exist eventually.
-			return false, nil
-		}
 
-		if preApplyMeta == nil {
-			// Object did not exist before Apply; it now exists in cache.
-			return true, nil
+			return false, nil
 		}
 
 		newAccessor, err := meta.Accessor(newObj)
 		if err != nil {
 			return false, err
 		}
-		// Cache has applied state when UID/Generation/ResourceVersion changed from pre-apply.
-		// Condition 1: UID changed - object was deleted and recreated
-		// Condition 2: Generation
```

**File**: `pkg/util/blockingcacheclient/client_test.go` (added, +297/-0)
```diff
@@ -0,0 +1,297 @@
+package blockingcacheclient
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"sync"
+	"testing"
+	"time"
+
+	admissionregistrationv1 "k8s.io/api/admissionregistration/v1"
+	kerrors "k8s.io/apimachinery/pkg/api/errors"
+	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	admissionregistrationv1ac "k8s.io/client-go/applyconfigurations/admissionregistration/v1"
+	"sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+const testPolicyName = "vcluster-protected-apiservices"
+
+// applyServer stands in for the manager client underneath CacheClient. Apply
+// answers with a fixed server response the way controller-runtime does, by
+// decoding it into the ApplyConfiguration, and Get serves whatever the test
+// says the informer cache currently holds.
+type applyServer struct {
+	client.Client
+
+	mu       sync.Mutex
+	cached   *unstructured.Unstructured
+	response *unstructured.Unstructured
+	// getErr, when set, is what every Get returns instead of consulting cached.
+	getErr error
+}
+
+func (s *applyServer) Get(_ context.Context, key client.ObjectKey, obj client.Object, _ ...client.GetOption) error {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	if s.getErr != nil {
+		return s.getErr
+	}
+	if s.cached == nil {
+		return kerrors.NewNotFound(schema.GroupResource{Group: "admissionregistration.k8s.io", Resource: "validatingadmissionpolicies"}, key.Name)
+	}
+	obj.(*unstructured.Unstructured).Object = s.cached.DeepCopy().Object
+	return nil
+}
+
+func (s *applyServer) Apply(_ context.Context, obj runtime.ApplyConfiguration, _ ...client.ApplyOption) error {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	body, err := json.Marshal(s.response.Object)
+	if err != nil {
+		return err
+	}
+	return json.Unmarshal(body, obj)
+}
+
+func (s *applyServer) Status() client.SubResourceWriter {
+	return &applyStatusWriter{server: s}
+}
+
+func (s *applyServer) setCached(obj *unstructured.Unstructured) {
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	s.cached = obj
+}
+
+type applyStatusWriter struct {
+	client.SubResourceWriter
+
+	server *applyServer
+}
+
+func (w *applyStatusWriter) Apply(ctx context.Context, obj runtime.ApplyConfiguration, _ ...client.SubResourceApplyOption) error {
+	return w.server.Apply(ctx, obj)
+}
+
+func policyObject(uid, resourceVersion string) *unstructured.Unstructured {
+	return &unstructured.Unstructured{Object: map[string]interface{}{
+		"apiVersion": "admissionregistration.k8s.io/v1",
+		"kind":       "ValidatingAdmissionPolicy",
+		"metadata": map[string]interface{}{
+			"name":            testPolicyName,
+			"uid":             uid,
+			"resourceVersion": resourceVersion,
+		},
+	}}
+}
+
+func policyApplyConfiguration() *admissionregistrationv1ac.ValidatingAdmissionPolicyApplyConfiguration {
+	return admissionregistrationv1ac.ValidatingAdmissionPolicy(testPolicyName).
+		WithSpec(admissionregistrationv1ac.ValidatingAdmissionPolicySpec().
+			WithFailurePolicy(admissionregistrationv1.Fail))
+}
+
+// catchUpAfter makes the fake cache serve obj once delay has passed, standing
+// in for the informer receiving the watch event for the write.
+func catchUpAfter(server *applyServer, delay time.Duration, obj *unstructured.Unstructured) {
+	go func() {
+		time.Sleep(delay)
+		server.setCached(obj)
+	}()
+}
+
+func TestApplyNoOpReturnsWithoutWaitingForACacheChange(t *testing.T) {
+	// an apply that changes nothing is skipped by the apiserver, which answers
+	// with the live object at its current resource version. The cache already
+	// holds that version, so there is nothing to wait for.
+	server := &applyServer{cached: policyObject("uid-1", "10"), response: policyObject("uid-1", "10")}
+	c := &CacheClient{Client: server}
+
+	start := time.Now()
+	if err := c.Apply(context.Background(), policyApplyConfiguration(), client.FieldOwner("test")); err != nil {
+		t.Fatalf("no-op apply returned %v, expected nil", err)
+	}
+	if elapsed := time.Since(st
```

---

### Incident Patch 10: `b673c35f` (2026-09-08)
**Commit Message**: fix(deps): update module google.golang.org/grpc to v1.83.1 [security] (#2404)

* fix(deps): update module google.golang.org/grpc to v1.83.1 [security]

* fix(deps): sync root vendor for grpc update

---------

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Caue Santos <caue.santos@loft.sh>
Monorepo-Commit: 8b0c71f37b0dc694aeb470866645a18d60a39fd4

**File**: `go.mod` (modified, +2/-2)
```diff
@@ -49,7 +49,7 @@ require (
 	go.uber.org/atomic v1.11.0
 	golang.org/x/mod v0.39.0
 	golang.org/x/sync v0.22.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.1
 	google.golang.org/protobuf v1.36.12
 	gopkg.in/yaml.v3 v3.0.1
 	gotest.tools v2.2.0+incompatible
@@ -78,7 +78,7 @@ require (
 )
 
 require (
-	cel.dev/expr v0.25.1 // indirect
+	cel.dev/expr v0.25.2 // indirect
 	github.com/AlecAivazis/survey/v2 v2.3.7 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.0 // indirect
 	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.14.0 // indirect
```

**File**: `go.sum` (modified, +4/-4)
```diff
@@ -1,5 +1,5 @@
-cel.dev/expr v0.25.1 h1:1KrZg61W6TWSxuNZ37Xy49ps13NUovb66QLprthtwi4=
-cel.dev/expr v0.25.1/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
+cel.dev/expr v0.25.2 h1:K6j46C81hXtZQfuX60cVWQFBJahKSE2gfRbNuvr5bFs=
+cel.dev/expr v0.25.2/go.mod h1:hrXvqGP6G6gyx8UAHSHJ5RGk//1Oj5nXQ2NI02Nrsg4=
 github.com/AlecAivazis/survey/v2 v2.3.7 h1:6I/u8FvytdGsgonrYsVn2t8t4QiRnh6QSTqkkhIiSjQ=
 github.com/AlecAivazis/survey/v2 v2.3.7/go.mod h1:xUTIdE4KCOIjsBAE1JYsUPoCqYdZ1reCfTwbto0Fduo=
 github.com/Azure/azure-sdk-for-go/sdk/azcore v1.23.0 h1:4gRPBpN1f6xt88yi4WR26m7XaD9OlWtVT6bWPdGUIok=
@@ -737,8 +737,8 @@ google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa h1:
 google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa/go.mod h1:q4lMZS6kskjT5HvCPrnnypcDPVJqT/f4nfxmkE7gryY=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7 h1:eM/YSd5bBFagF51o1E745Ta7RwzpW0h+z+QDNZOgmQ8=
 google.golang.org/genproto/googleapis/rpc v0.0.0-20260630182238-925bb5da69e7/go.mod h1:4Hqkh8ycfw05ld/3BWL7rJOSfebL2Q+DVDeRgYgxUU8=
-google.golang.org/grpc v1.82.1 h1:NnAxzGRA0677vCa4BUkOAnO5+FfQqVl9iUXeD0IqcGE=
-google.golang.org/grpc v1.82.1/go.mod h1:yzTZ1TB1Z3SG+LIYaI+WiE8D5+PZ3ArnrSp8zF3+/ZA=
+google.golang.org/grpc v1.83.1 h1:HIO0+BEtBP6soyqvqC8sNUjZ7bTs+0hFQuFF+RAy++Y=
+google.golang.org/grpc v1.83.1/go.mod h1:kDyl6SKsiHKt0uylY5gtn5cEjkrIOhQOGDgIc4JGwzQ=
 google.golang.org/protobuf v1.36.12 h1:pJOKDDOyeXErUroCihFAd5LQuwXBSpVnKGrj5o/fwxc=
 google.golang.org/protobuf v1.36.12/go.mod h1:HTf+CrKn2C3g5S8VImy6tdcUvCska2kB7j23XfzDpco=
 gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405/go.mod h1:Co6ibVJAznAaIkqp8huTwlJQCZ016jof/cbN4VW5Yz0=
```

**File**: `vendor/google.golang.org/grpc/clientconn.go` (modified, +4/-19)
```diff
@@ -24,12 +24,10 @@ import (
 	"fmt"
 	"math"
 	"net/url"
-	"os"
 	"slices"
 	"strings"
 	"sync"
 	"sync/atomic"
-	"syscall"
 	"time"
 
 	"google.golang.org/grpc/balancer"
@@ -1573,26 +1571,13 @@ func (ac *addrConn) createTransport(ctx context.Context, addr resolver.Address,
 // to the provided transport.GoAwayInfo, as specified by gRFC A94:
 // https://github.com/grpc/proposal/blob/master/A94-grpc-subchannel-disconnections-metrics.md
 func disconnectErrorString(info transport.GoAwayInfo) string {
-	err := info.Err
-	var sysErr syscall.Errno
-	switch {
-	case info.Reason != transport.GoAwayInvalid:
+	if info.Reason != transport.GoAwayInvalid {
 		return fmt.Sprintf("GOAWAY %s", info.GoAwayCode.String())
-	case err == nil:
-		return "unknown"
-	case errors.Is(err, context.Canceled):
-		return "subchannel shutdown"
-	case errors.Is(err, syscall.ECONNRESET):
-		return "connection reset"
-	case errors.Is(err, syscall.ETIMEDOUT), errors.Is(err, context.DeadlineExceeded), errors.Is(err, os.ErrDeadlineExceeded):
-		return "connection timed out"
-	case errors.Is(err, syscall.ECONNABORTED):
-		return "connection aborted"
-	case errors.As(err, &sysErr):
-		return "socket error"
-	default:
+	}
+	if info.Err == nil {
 		return "unknown"
 	}
+	return disconnectErrorLabel(info.Err)
 }
 
 // startHealthCheck starts the health checking stream (RPC) to watch the health
```

**File**: `vendor/google.golang.org/grpc/clientconn_disconnect_reason_noplan9.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+//go:build !plan9
+
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package grpc
+
+import (
+	"context"
+	"errors"
+	"os"
+	"syscall"
+)
+
+// disconnectErrorLabel returns the grpc.disconnect_error metric label for a
+// transport error, as specified by gRFC A94.
+func disconnectErrorLabel(err error) string {
+	var sysErr syscall.Errno
+	switch {
+	case errors.Is(err, context.Canceled):
+		return "subchannel shutdown"
+	case errors.Is(err, syscall.ECONNRESET):
+		return "connection reset"
+	case errors.Is(err, syscall.ETIMEDOUT), errors.Is(err, context.DeadlineExceeded), errors.Is(err, os.ErrDeadlineExceeded):
+		return "connection timed out"
+	case errors.Is(err, syscall.ECONNABORTED):
+		return "connection aborted"
+	case errors.As(err, &sysErr):
+		return "socket error"
+	default:
+		return "unknown"
+	}
+}
```

**File**: `vendor/google.golang.org/grpc/clientconn_disconnect_reason_plan9.go` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+/*
+ *
+ * Copyright 2026 gRPC authors.
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ *
+ */
+
+package grpc
+
+import (
+	"context"
+	"errors"
+	"os"
+)
+
+// disconnectErrorLabel returns the grpc.disconnect_error metric label for a
+// transport error, as specified by gRFC A94. syscall.Errno does not exist on
+// plan9, so only the portable classifications are available.
+func disconnectErrorLabel(err error) string {
+	switch {
+	case errors.Is(err, context.Canceled):
+		return "subchannel shutdown"
+	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, os.ErrDeadlineExceeded):
+		return "connection timed out"
+	default:
+		return "unknown"
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #4187** (2026-09-24): feat(chart): make ServiceMonitor scrape interval configurable (backport v0.36 oss) (@loft-bot)
- **PR #4185** (closed): fix(syncer): skip load balancer status for headless mappings (@avinashgola)
- **PR #4184** (closed): [v0.37] chore: bump minimum platform version to v4.12.1 (@deniseschannon)
- **PR #4183** (2026-09-22): chore: replay the pending v0.37 commits from vcluster-pro (@sydorovdmytro)
- **PR #4182** (2026-09-17): chore: refactor codeowners (backport v0.36 oss) (@loft-bot)
- **PR #4181** (2026-09-17): chore: refactor codeowners (backport v0.34 oss) (@loft-bot)
- **PR #4180** (2026-09-17): chore: refactor codeowners (backport v0.35 oss) (@loft-bot)
- **PR #4172** (2026-09-08): chore(platform): bump minimum vcluster platform version to v4.9.5 (@deniseschannon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
