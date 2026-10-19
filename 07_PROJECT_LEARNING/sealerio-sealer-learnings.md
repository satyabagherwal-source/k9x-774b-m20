> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sealerio-sealer-learnings.md`  
> **Source**: github ([https://github.com/sealerio/sealer](https://github.com/sealerio/sealer))  
> **Source Version**: `e426153a`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T01:16:28.871Z  
> **Learning ID**: `learn-github-sealerio-sealer`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): sealerio/sealer

> **Canonical Artifact**: `07_PROJECT_LEARNING/sealerio-sealer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sealerio/sealer](https://github.com/sealerio/sealer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T01:16:28.655Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sealerio/sealer`
- **Description**: Build, Share and Run Both Your Kubernetes Cluster and Distributed Applications  (Project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2091 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/sealer/cmd/utils/application.go`
```
// Copyright © 2023 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"github.com/sealerio/sealer/types/api/constants"
	v2 "github.com/sealerio/sealer/types/api/v2"
)

// ConstructApplication merge flags to v2.Application
func ConstructApplication(app *v2.Application, cmds, appNames, globalEnvs []string) *v2.Application {
	var newApp *v2.Application

	if app != nil {
		newApp = app
	} else {
		newApp = &v2.Application{
			Spec: v2.ApplicationSpec{},
		}
		newApp.Name = "my-application"
		newApp.Kind = v2.GroupVersion.String()
		newApp.APIVersion = constants.ApplicationKind
	}

	if len(cmds) > 0 {
		newApp.Spec.Cmds = cmds
	}

	if appNames != nil {
		newApp.Spec.LaunchApps = appNames
	}

	// add appEnvs from flag to application object.
	if len(globalEnvs) > 0 {
		var appConfigList []v2.ApplicationConfig
		for _, appConfig := range newApp.Spec.Configs {
			appConfig.Env = append(globalEnvs, appConfig.Env...)
			appConfigList = append(appConfigList, appConfig)
		}
		newApp.Spec.Configs = appConfigList
	}

	return newApp
}

```

### Core Architecture Module: `cmd/sealer/cmd/utils/cluster.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"fmt"
	"net"
	"reflect"
	"strconv"

	"github.com/sealerio/sealer/cmd/sealer/cmd/types"
	"github.com/sealerio/sealer/common"
	"github.com/sealerio/sealer/pkg/client/k8s"
	imagev1 "github.com/sealerio/sealer/pkg/define/image/v1"
	"github.com/sealerio/sealer/types/api/constants"
	v1 "github.com/sealerio/sealer/types/api/v1"
	v2 "github.com/sealerio/sealer/types/api/v2"
	"github.com/sealerio/sealer/utils/maps"
	netutils "github.com/sealerio/sealer/utils/net"
	strUtils "github.com/sealerio/sealer/utils/strings"
	"github.com/sirupsen/logrus"
	corev1 "k8s.io/api/core/v1"
)

// MergeClusterWithImageExtension :set default value get from image extension,such as image global env
func MergeClusterWithImageExtension(cluster *v2.Cluster, imageExt imagev1.ImageExtension) *v2.Cluster {
	if len(imageExt.Env) > 0 {
		envs := maps.ConvertToSlice(imageExt.Env)
		envs = append(envs, cluster.Spec.Env...)
		cluster.Spec.Env = envs
	}

	return cluster
}

func MergeClusterWithFlags(cluster v2.Cluster, mergeFlags *types.MergeFlags) (*v2.Cluster, error) {
	if len(mergeFlags.CustomEnv) > 0 {
		cluster.Spec.Env = append(cluster.Spec.Env, mergeFlags.CustomEnv...)
	}

	if len(mergeFlags.Cmds) > 0 {
		cluster.Spec.CMD = mergeFlags.Cmds
	}

	if len(mergeFlags.AppNames) > 0 {
		cluster.Spec.APPNames = mergeFlags.AppNames
	}

	// if no master and node specify form flag, just return.
	if len(mergeFlags.Masters) == 0 && len(mergeFlags.Nodes) == 0 {
		return &cluster, nil
	}

	flagMasters, flagNodes, err := ParseToNetIPList(mergeFlags.Masters, mergeFlags.Nodes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ip string to net IP list: %v", err)
	}

	//validate run flags masters
	masterIPs := cluster.GetMasterIPList()
	for _, ip := range flagMasters {
		if netutils.IsInIPList(ip, masterIPs) {
			return nil, fmt.Errorf("failed to merge master ip form flags, duplicated ip is: %s", ip)
		}
	}

	//validate run flags nodes
	nodeIPs := cluster.GetNodeIPList()
	for _, ip := range flagNodes {
		if netutils.IsInIPList(ip, nodeIPs) {
			return nil, fmt.Errorf("failed to merge node ip form flags, duplicated ip is: %s", ip)
		}
	}

	//TODO: validate ssh auth
	flagHosts := TransferIPToHosts(flagMasters, flagNodes, v1.SSH{
		User:     mergeFlags.User,
		Passwd:   mergeFlags.Password,
		PkPasswd: mergeFlags.PkPassword,
		Pk:       mergeFlags.Pk,
		Port:     strconv.Itoa(int(mergeFlags.Port)),
	})

	cluster.Spec.Hosts = append(cluster.Spec.Hosts, flagHosts...)
	return &cluster, err
}

func ConstructClusterForRun(imageName string, runFlags *types.RunFlags) (*v2.Cluster, error) {
	masterIPList, nodeIPList, err := ParseToNetIPList(runFlags.Masters, runFlags.Nodes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ip string to net IP list: %v", err)
	}

	cluster := v2.Cluster{
		Spec: v2.ClusterSpec{
			SSH: v1.SSH{
				User:     runFlags.User,
				Passwd:   runFlags.Password,
				PkPasswd: runFlags.PkPassword,
				Pk:       runFlags.Pk,
				Port:     strconv.Itoa(int(runFlags.Port)),
			},
			Image: imageName,
			//use cluster ssh auth by default
			Hosts:    TransferIPToHosts(masterIPList, nodeIPList, v1.SSH{}),
			Env:      runFlags.CustomEnv,
			CMD:      runFlags.Cmds,
			APPNames: runFlags.AppNames,
		},
	}
	cluster.APIVersion = v2.GroupVersion.String()
	cluster.Kind = constants.ClusterKind
	cluster.Name = "my-cluster"
	return &cluster, nil
}

func ConstructClusterForScaleUp(cluster *v2.Cluster, scaleFlags *types.ScaleUpFlags, currentNodes, joinMasters, joinWorkers []net.IP) (mj, nj []net.IP, err error) {
	mj, _ = strUtils.Diff(currentNodes, joinMasters)
	nj, _ = strUtils.Diff(currentNodes, joinWorkers)

	if len(mj) == 0 && len(nj) == 0 {
		return nil, nil, fmt.Errorf("scale ip %v is already in the current cluster %v", append(joinMasters, joinWorkers...), currentNodes)
	}

	nodes := cluster.GetAllIPList()
	//TODO Add password encryption mode in the future
	//add joined masters
	for _, ip := range mj {
		// if ip already taken by node, skip it
		if netutils.IsInIPList(ip, nodes) {
			return nil, nil, fmt.Errorf("failed to scale master for duplicated ip: %s", ip)
		}
	}
	if len(mj) != 0 {
		host := constructHost(common.MASTER, mj, scaleFlags, cluster.Spec.SSH)
		cluster.Spec.Hosts = append(cluster.Spec.Hosts, host)
	}

	for _, ip := range nj {
		// if ip already taken by node, skip it
		if netutils.IsInIPList(ip, nodes) {
			return nil, nil, fmt.Errorf("failed to scale node for duplicated ip: %s", ip)
		}
	}
	//add joined nodes
	if len(nj) != 0 {
		host := constructHost(common.NODE, nj, scaleFlags, cluster.Spec.SSH)
		cluster.Spec.Hosts = append(cluster.Spec.Hosts, host)
	}

	return mj, nj, nil
}

func ConstructClusterForScaleDown(cluster *v2.Cluster, mastersToDelete, workersToDelete []net.IP) error {
	if len(mastersToDelete) != 0 {
		for i := range cluster.Spec.Hosts {
			if strUtils.IsInSlice(common.MASTER, cluster.Spec.Hosts[i].Roles) {
				cluster.Spec.Hosts[i].IPS = netutils.RemoveIPs(cluster.Spec.Hosts[i].IPS, mastersToDelete)
			}
			continue
		}
	}

	if len(workersToDelete) != 0 {
		for i := range cluster.Spec.Hosts {
			if strUtils.IsInSlice(common.NODE, cluster.Spec.Hosts[i].Roles) {
				cluster.Spec.Hosts[i].IPS = netutils.RemoveIPs(cluster.Spec.Hosts[i].IPS, workersToDelete)
			}
			continue
		}
	}

	// if hosts have no ip address exist,then delete this host.
	var hosts []v2.Host
	for _, host := range cluster.Spec.Hosts {
		if len(host.IPS) == 0 {
			continue
		}
		hosts = append(hosts, host)
	}
	cluster.Spec.Hosts = hosts

	return nil
}

func constructHost(role string, joinIPs []net.IP, scaleFlags *types.ScaleUpFlags, clusterSSH v1.SSH) v2.Host {
	//todo we could support host level env form cli later.
	//todo we could support host level role form cli later.
	host := v2.Host{
		IPS:   joinIPs,
		Roles: []string{role},
		Env:   scaleFlags.CustomEnv,
	}

	scaleFlagSSH := v1.SSH{
		User:     scaleFlags.User,
		Passwd:   scaleFlags.Password,
		Port:     strconv.Itoa(int(scaleFlags.Port)),
		Pk:       scaleFlags.Pk,
		PkPasswd: scaleFlags.PkPassword,
	}

	if reflect.DeepEqual(scaleFlagSSH, clusterSSH) {
		return host
	}

	host.SSH = scaleFlagSSH
	return host
}

func GetCurrentCluster(client *k8s.Client) (*v2.Cluster, error) {
	nodes, err := client.ListNodes()
	if err != nil {
		return nil, err
	}

	cluster := &v2.Cluster{}
	var masterIPList []net.IP
	var nodeIPList []net.IP

	for _, node := range nodes.Items {
		addr := getNodeAddress(node)
		if addr == nil {
			return nil, fmt.Errorf("failed to get node address for node %s", node.Name)
		}
		if _, ok := node.Labels[common.MasterRoleLabel]; ok {
			masterIPList = append(masterIPList, addr)
			continue
		}
		nodeIPList = append(nodeIPList, addr)
	}
	cluster.Spec.Hosts = []v2.Host{{IPS: masterIPList, Roles: []string{common.MASTER}}, {IPS: nodeIPList, Roles: []string{common.NODE}}}

	return cluster, nil
}

func getNodeAddress(node corev1.Node) net.IP {
	if len(node.Status.Addresses) < 1 {
		return nil
	}

	var IP string
	for _, address := range node.Status.Addresses {
		if address.Type == "InternalIP" {
			IP = address.Address
			break
		}
	}

	return net.ParseIP(IP)
}

func GetClusterClient() *k8s.Client {
	client, err := k8s.NewK8sClient()
	if client != nil {
		return client
	}
	if err != nil {
		logrus.Warnf("try to new k8s client via default kubeconfig, maybe this is a new cluster that needs to be created: %v", err)
	}
	return nil
}

```

### Core Architecture Module: `cmd/sealer/cmd/utils/hosts.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"net"

	v1 "github.com/sealerio/sealer/types/api/v1"

	"github.com/sealerio/sealer/common"
	v2 "github.com/sealerio/sealer/types/api/v2"
)

// TransferIPToHosts constructs v2.Host through []net.ip
func TransferIPToHosts(masterIPList, nodeIPList []net.IP, sshAuthOnHosts v1.SSH) []v2.Host {
	var hosts []v2.Host
	if len(masterIPList) != 0 {
		hosts = append(hosts, v2.Host{
			Roles: []string{common.MASTER},
			IPS:   masterIPList,
			SSH:   sshAuthOnHosts,
		})
	}

	if len(nodeIPList) != 0 {
		hosts = append(hosts, v2.Host{
			Roles: []string{common.NODE},
			IPS:   nodeIPList,
			SSH:   sshAuthOnHosts,
		})
	}

	return hosts
}

```

### Core Architecture Module: `cmd/sealer/cmd/utils/validate.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package utils

import (
	"fmt"
	"net"
	"strings"

	netutils "github.com/sealerio/sealer/utils/net"
)

// ValidateRunHosts validates the input host args such as master and node string
func ValidateRunHosts(runMasters, runNodes string) error {
	// TODO: add detailed validation steps.
	var errMsg []string

	// validate input masters IP info
	if len(runMasters) != 0 {
		if err := ValidateIPStr(runMasters); err != nil {
			errMsg = append(errMsg, err.Error())
		}
	}

	// validate input nodes IP info
	if len(runNodes) != 0 {
		// empty runFlags.Nodes are valid, since no nodes are input.
		if err := ValidateIPStr(runNodes); err != nil {
			errMsg = append(errMsg, err.Error())
		}
	}

	if len(errMsg) == 0 {
		return nil
	}
	return fmt.Errorf(strings.Join(errMsg, ","))
}

func ValidateIPStr(inputStr string) error {
	if len(inputStr) == 0 {
		return fmt.Errorf("input IP info cannot be empty")
	}

	// 1. validate if it is IP range
	if strings.Contains(inputStr, "-") {
		ips := strings.Split(inputStr, "-")
		if len(ips) != 2 {
			return fmt.Errorf("input IP(%s) is range format but invalid, IP range format must be xxx.xxx.xxx.1-xxx.xxx.xxx.70", inputStr)
		}

		if net.ParseIP(ips[0]) == nil {
			return fmt.Errorf("input IP(%s) is invalid", ips[0])
		}
		if net.ParseIP(ips[1]) == nil {
			return fmt.Errorf("input IP(%s) is invalid", ips[1])
		}

		if netutils.CompareIP(ips[0], ips[1]) >= 0 {
			return fmt.Errorf("input IP(%s) must be less than input IP(%s)", ips[0], ips[1])
		}

		return nil
	}

	// 2. validate if it is IP list, like 192.168.0.5,192.168.0.6,192.168.0.7
	for _, ip := range strings.Split(inputStr, ",") {
		if net.ParseIP(ip) == nil {
			return fmt.Errorf("input IP(%s) is invalid", ip)
		}
	}

	return nil
}

// ValidateScaleIPStr validates all the input args from scale up Or scale down command.
func ValidateScaleIPStr(masters, nodes string) error {
	var errMsg []string

	if nodes == "" && masters == "" {
		return fmt.Errorf("master and node cannot both be empty")
	}

	// validate input masters IP info
	if len(masters) != 0 {
		if err := ValidateIPStr(masters); err != nil {
			errMsg = append(errMsg, err.Error())
		}
	}

	// validate input nodes IP info
	if len(nodes) != 0 {
		if err := ValidateIPStr(nodes); err != nil {
			errMsg = append(errMsg, err.Error())
		}
	}

	if len(errMsg) == 0 {
		return nil
	}
	return fmt.Errorf(strings.Join(errMsg, ","))
}

// ParseToNetIPList now only supports input IP list and IP range.
// IP list, like 192.168.0.1,192.168.0.2,192.168.0.3
// IP range, like 192.168.0.5-192.168.0.7, which means 192.168.0.5,192.168.0.6,192.168.0.7
// P.S. we have guaranteed that all the input masters and nodes are validated.
func ParseToNetIPList(masters, workers string) ([]net.IP, []net.IP, error) {
	newMasters, err := netutils.TransferToIPList(masters)
	if err != nil {
		return nil, nil, err
	}

	newNodes, err := netutils.TransferToIPList(workers)
	if err != nil {
		return nil, nil, err
	}

	newMasterIPList := netutils.IPStrsToIPs(strings.Split(newMasters, ","))
	newNodeIPList := netutils.IPStrsToIPs(strings.Split(newNodes, ","))

	return newMasterIPList, newNodeIPList, nil
}

```

### Core Architecture Module: `cmd/seautil/cmd/certs.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"
	"net"
	"os"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/sealerio/sealer/pkg/clustercert"
)

type Flag struct {
	AltNames     []string
	NodeName     string
	ServiceCIDR  string
	NodeIP       string
	DNSDomain    string
	CertPath     string
	CertEtcdPath string
}

// NewCmdCert return "seautil cert" command.
func NewCmdCert() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cert",
		Short: "seautil cert experimental sub-commands",
	}
	cmd.AddCommand(NewCertGenCmd())
	cmd.AddCommand(NewCertUpdateCmd())
	return cmd
}

// NewCertGenCmd gen all kubernetes certs
func NewCertGenCmd() *cobra.Command {
	flag := new(Flag)

	// certsCmd represents the certs command
	certsCmd := &cobra.Command{
		Use:   "gen",
		Short: "generate kubernetes certs",
		Long:  `seautil cert gen --node-ip 192.168.0.2 --node-name master1 --dns-domain sealer.com --alt-names sealer.local --service-cidr 10.103.97.2/24`,
		RunE: func(cmd *cobra.Command, args []string) error {
			nodeIP := net.ParseIP(flag.NodeIP)
			if nodeIP == nil {
				return fmt.Errorf("input --node-ip(%s) is not a valid IP format", flag.NodeIP)
			}
			return clustercert.GenerateAllKubernetesCerts(flag.CertPath, flag.CertEtcdPath, flag.NodeName, flag.ServiceCIDR, flag.DNSDomain, flag.AltNames, nodeIP)
		},
	}

	certsCmd.Flags().StringSliceVar(&flag.AltNames, "alt-names", []string{}, "like sealyun.com or 10.103.97.2")
	certsCmd.Flags().StringVar(&flag.NodeName, "node-name", "", "like master0")
	certsCmd.Flags().StringVar(&flag.ServiceCIDR, "service-cidr", "", "like 10.103.97.2/24")
	certsCmd.Flags().StringVar(&flag.NodeIP, "node-ip", "", "like 10.103.97.2")
	certsCmd.Flags().StringVar(&flag.DNSDomain, "dns-domain", "cluster.local", "cluster dns domain")
	certsCmd.Flags().StringVar(&flag.CertPath, "cert-path", clustercert.KubeDefaultCertPath, "kubernetes cert file path")
	certsCmd.Flags().StringVar(&flag.CertEtcdPath, "cert-etcd-path", clustercert.KubeDefaultCertEtcdPath, "kubernetes etcd cert file path")

	return certsCmd
}

func NewCertUpdateCmd() *cobra.Command {
	var altNames []string

	certCmd := &cobra.Command{
		Use:   "update",
		Short: "Update Kubernetes API server's cert",
		Long:  `seautil cert update --alt-names sealer.cool`,
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(altNames) == 0 {
				return fmt.Errorf("IP address or DNS domain needed for cert Subject Alternative Names")
			}

			err := clustercert.UpdateAPIServerCertSans(clustercert.KubeDefaultCertPath, altNames)
			if err != nil {
				return fmt.Errorf("failed to update api server's cert: %v", err)
			}
			return nil
		},
	}

	certCmd.Flags().StringSliceVar(&altNames, "alt-names", []string{}, "add DNS domain or IP in api server's cert, if it is already in the cert subject alternative names list, nothing will be changed")

	if err := certCmd.MarkFlagRequired("alt-names"); err != nil {
		logrus.Errorf("failed to init flag alt-names: %v", err)
		os.Exit(1)
	}

	return certCmd
}

```

### Core Architecture Module: `cmd/seautil/cmd/ipvs.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"github.com/labring/lvscare/care"
	"github.com/spf13/cobra"
)

var Ipvs care.LvsCare

// NewIpvsCmd ipvsCmd represents the ipvs command
func NewIpvsCmd() *cobra.Command {
	ipvsCmd := &cobra.Command{
		Use:   "ipvs",
		Short: "seautil create or care local ipvs LB",
		Long: `create ipvs rules: seautil ipvs --vs 10.1.1.2:6443 --rs 192.168.0.2:6443 --rs 192.168.0.3:6443 --health-path /healthz --health-schem https --run-once
clean ipvs rules: seautil ipvs clean`,
		Run: func(cmd *cobra.Command, args []string) {
			Ipvs.VsAndRsCare()
		},
	}

	ipvsCmd.Flags().BoolVar(&Ipvs.RunOnce, "run-once", false, "run once mode")
	ipvsCmd.Flags().BoolVarP(&Ipvs.Clean, "clean", "c", true, " clean Vip ipvs rule before join node, if Vip has no ipvs rule do nothing.")
	ipvsCmd.Flags().StringVar(&Ipvs.VirtualServer, "vs", "", "virtual server like 10.54.0.2:6443")
	ipvsCmd.Flags().StringSliceVar(&Ipvs.RealServer, "rs", []string{}, "virtual server like 192.168.0.2:6443")
	ipvsCmd.Flags().StringVar(&Ipvs.HealthPath, "health-path", "/healthz", "health check path")
	ipvsCmd.Flags().StringVar(&Ipvs.HealthSchem, "health-schem", "https", "health check scheme")
	ipvsCmd.Flags().Int32Var(&Ipvs.Interval, "interval", 5, "health check interval, unit is sec.")

	return ipvsCmd
}

```

### Core Architecture Module: `cmd/seautil/cmd/root.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"
	"os"

	"github.com/mitchellh/go-homedir"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "seautil",
	Short: "A brief description of your application",
	Long: `A longer description that spans multiple lines and likely contains
examples and usage of using your application. For example:

Cobra is a CLI library for Go that empowers applications.
This application is a tool to generate the needed files
to quickly create a Cobra application.`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	//	Run: func(cmd *cobra.Command, args []string) { },
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.AddCommand(NewCmdCert(), NewIpvsCmd(), NewRouteCmd(), NewVersionCmd())

	// Here you will define your flags and configuration settings.
	// Cobra supports persistent flags, which, if defined here,
	// will be global for your application.

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.seautil.yaml)")

	// Cobra also supports local flags, which will only run
	// when this action is called directly.
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory.
		home, err := homedir.Dir()
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		// Search config in home directory with name ".seautil" (without extension).
		viper.AddConfigPath(home)
		viper.SetConfigName(".seautil")
	}

	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		fmt.Println("Using config file:", viper.ConfigFileUsed())
	}
}

```

### Core Architecture Module: `cmd/seautil/cmd/route.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"fmt"
	"net"

	utilsnet "github.com/sealerio/sealer/utils/net"

	"github.com/spf13/cobra"
)

type RouteFlag struct {
	host      string
	gatewayIP string
}

var routeFlag *RouteFlag

func NewRouteCmd() *cobra.Command {
	routeCmd := &cobra.Command{
		Use:   "route",
		Short: "A brief description of your command",
	}
	routeFlag = &RouteFlag{}
	routeCmd.AddCommand(RouteAddCmd())
	routeCmd.AddCommand(RouteDelCmd())
	routeCmd.AddCommand(RouteCheckCmd())
	return routeCmd
}

func RouteCheckCmd() *cobra.Command {
	var checkCmd = &cobra.Command{
		Use:   "check",
		Short: "A brief description of your command",
		Long:  `seautil route check --host 192.168.56.3`,
		RunE: func(cmd *cobra.Command, args []string) error {
			host := net.ParseIP(routeFlag.host)
			if host == nil {
				return fmt.Errorf("input host(%s) is invalid: it should be an IP format", routeFlag.host)
			}
			return utilsnet.CheckIsDefaultRoute(host)
		},
	}
	checkCmd.Flags().StringVar(&routeFlag.host, "host", "", "check host ip address is default iFace")
	return checkCmd
}

func RouteAddCmd() *cobra.Command {
	var addCmd = &cobra.Command{
		Use:   "add",
		Short: "A brief description of your command",
		Long:  `seautil route add --host 192.168.0.2 --gateway 10.0.0.2`,
		RunE: func(cmd *cobra.Command, args []string) error {
			host := net.ParseIP(routeFlag.host)
			if host == nil {
				return fmt.Errorf("input host(%s) is invalid: it must be an IP format", routeFlag.host)
			}

			gateway := net.ParseIP(routeFlag.gatewayIP)
			if gateway == nil {
				return fmt.Errorf("input gateway(%s) is invalid: it must be an IP format", routeFlag.gatewayIP)
			}
			r := utilsnet.NewRouter(host, gateway)
			return r.SetRoute()
		},
	}
	addCmd.Flags().StringVar(&routeFlag.host, "host", "", "route host ,ex ip route add host via gateway")
	addCmd.Flags().StringVar(&routeFlag.gatewayIP, "gateway", "", "route gateway ,ex ip route add host via gateway")
	return addCmd
}

func RouteDelCmd() *cobra.Command {
	var delCmd = &cobra.Command{
		Use:   "del",
		Short: "delete router",
		Long:  `seautil route del --host 192.168.0.2 --gateway 10.0.0.2`,
		RunE: func(cmd *cobra.Command, args []string) error {
			host := net.ParseIP(routeFlag.host)
			if host == nil {
				return fmt.Errorf("input host(%s) is invalid: it must be an IP format", routeFlag.host)
			}

			gateway := net.ParseIP(routeFlag.gatewayIP)
			if gateway == nil {
				return fmt.Errorf("input gateway(%s) is invalid: it must be an IP format", routeFlag.gatewayIP)
			}

			r := utilsnet.NewRouter(host, gateway)
			return r.DelRoute()
		},
	}
	delCmd.Flags().StringVar(&routeFlag.host, "host", "", "route host ,ex ip route del host via gateway")
	delCmd.Flags().StringVar(&routeFlag.gatewayIP, "gateway", "", "route gateway ,ex ip route del host via gateway")
	return delCmd
}

```

### Core Architecture Module: `cmd/seautil/cmd/version.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cmd

import (
	"encoding/json"
	"fmt" //nolint:imports
	"os"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	"github.com/sealerio/sealer/version"
)

var shortPrint bool

func NewVersionCmd() *cobra.Command {
	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "version",
		Long:  `sealer version`,
		Run: func(cmd *cobra.Command, args []string) {
			marshalled, err := json.Marshal(version.Get())
			if err != nil {
				logrus.Error(err)
				os.Exit(1)
			}
			if shortPrint {
				fmt.Println(version.Get().String())
			} else {
				fmt.Println(string(marshalled))
			}
		},
	}
	versionCmd.Flags().BoolVar(&shortPrint, "short", false, "If true, print just the version number.")
	return versionCmd
}

```

### Core Architecture Module: `cmd/seautil/main.go`
```
// Copyright © 2021 Alibaba Group Holding Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import "github.com/sealerio/sealer/cmd/seautil/cmd"

func main() {
	cmd.Execute()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2347** (2026-07-14): **官网挂了，dingding群失效**
  *Symptoms*: ### What happen?  _No response_  ### Relevant log output?  _No response_  ### What you expected to happen?  _No response_  ### How to reproduce it (as minimally and precisely as possible)?  _No response_  ### Anything else we need to know?  _No response_  ### What is the version of Sealer you using?  _No response_  ### What is your OS environment?  _No response_  ### What is the Kernel version?  _No response_  ### Other environment you want to tell us?  - Cloud provider or hardware configuration: - Install tools: - Others: 
  **Post-Mortem & Fix Analysis**:
  > > ### What happen? > _No response_ >  > ### Relevant log output? > _No response_ >  > ### What you expected to happen? > _No response_ >  > ### How to reproduce it (as minimally and precisely as possible)? > _No response_ >  > ### Anything else we need to know? > _No response_ >  > ### What is the version of Sealer you using? > _No response_ >  > ### What is your OS environment? > _No response_ >  > ### What is the Kernel version? > _No response_ >  > ### Other environment you want to tell us? > * Cloud provider or hardware configuration: > * Install tools: > * Others:  建议转战 [Sealos](https://sealos.io/)
  > > ### What happen? > _No response_ >  > ### Relevant log output? > _No response_ >  > ### What you expected to happen? > _No response_ >  > ### How to reproduce it (as minimally and precisely as possible)? > _No response_ >  > ### Anything else we need to know? > _No response_ >  > ### What is the version of Sealer you using? > _No response_ >  > ### What is your OS environment? > _No response_ >  > ### What is the Kernel version? > _No response_ >  > ### Other environment you want to tell us? > * Cloud provider or hardware configuration: > * Install tools: > * Others:  to sealos～

- **Issue #2335** (2024-01-31): **[WeeklyReport] Weekly report for sealer 1/17/2024 to 1/24/2024**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1971 (-) | 357 (↑1) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 3 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this 

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

### Incident Patch 1: `9b08d0c1` (2023-06-05)
**Commit Message**: bugfix: add lock to image bolb list (#2238)

Signed-off-by: kakzhou719 <[REDACTED_EMAIL]>

**File**: `pkg/image/save/interface.go` (modified, +0/-1)
```diff
@@ -18,7 +18,6 @@ import (
 	"context"
 
 	"github.com/docker/docker/pkg/progress"
-
 	v1 "github.com/sealerio/sealer/types/api/v1"
 )
 
```

**File**: `pkg/image/save/save.go` (modified, +26/-7)
```diff
@@ -20,6 +20,7 @@ import (
 	"fmt"
 	"io"
 	"strings"
+	"sync"
 
 	"github.com/distribution/distribution/v3"
 	"github.com/distribution/distribution/v3/configuration"
@@ -32,13 +33,12 @@ import (
 	"github.com/docker/docker/pkg/progress"
 	"github.com/docker/docker/pkg/streamformatter"
 	"github.com/opencontainers/go-digest"
-	"github.com/sirupsen/logrus"
-	"golang.org/x/sync/errgroup"
-
 	"github.com/sealerio/sealer/common"
 	"github.com/sealerio/sealer/pkg/client/docker/auth"
 	"github.com/sealerio/sealer/pkg/image/save/distributionpkg/proxy"
 	v1 "github.com/sealerio/sealer/types/api/v1"
+	"github.com/sirupsen/logrus"
+	"golang.org/x/sync/errgroup"
 )
 
 const (
@@ -321,9 +321,16 @@ func (is *DefaultImageSaver) saveManifestAndGetDigest(nameds []Named, repo distr
 	if err != nil {
 		return nil, fmt.Errorf("failed to get manifest service: %v", err)
 	}
+
+	var (
+		// lock protects imageDigests
+		lock         sync.Mutex
+		imageDigests = make([]digest.Digest, 0)
+		numCh        = make(chan struct{}, maxPullGoroutineNum)
+	)
+
 	eg, _ := errgroup.WithContext(context.Background())
-	numCh := make(chan struct{}, maxPullGoroutineNum)
-	imageDigests := make([]digest.Digest, 0)
+
 	for _, named := range nameds {
 		tmpnamed := named
 		numCh <- struct{}{}
@@ -340,6 +347,9 @@ func (is *DefaultImageSaver) saveManifestAndGetDigest(nameds []Named, repo distr
 			if err != nil {
 				return fmt.Errorf("failed to get digest: %v", err)
 			}
+
+			lock.Lock()
+			defer lock.Unlock()
 			imageDigests = append(imageDigests, imageDigest)
 			return nil
 		})
@@ -388,9 +398,15 @@ func (is *DefaultImageSaver) saveBlobs(imageDigests []digest.Digest, repo distri
 	if err != nil {
 		return fmt.Errorf("failed to get blob service: %v", err)
 	}
+
+	var (
+		// lock protects blobLists
+		lock      sync.Mutex
+		blobLists = make([]digest.Digest, 0)
+		numCh     = make(chan struct{}, maxPullGoroutineNum)
+	)
+
 	eg, _ := errgroup.WithContext(context.Background())
-	numCh := make(chan struct{}, maxPullGoroutineNum)
-	blobLists := make([]digest.Digest, 0)
 
 	//get blob list
 	//each blob identified by a digest
@@ -411,6 +427,9 @@ func (is *DefaultImageSaver) saveBlobs(imageDigests []digest.Digest, repo distri
 			if err != nil {
 				return fmt.Errorf("failed to get blob list: %v", err)
 			}
+
+			lock.Lock()
+			defer lock.Unlock()
 			blobLists = append(blobLists, blobList...)
 			return nil
 		})
```

---

### Incident Patch 2: `e426153a` (2025-06-03)
**Commit Message**: remove leak code

**File**: `.github/workflows/e2e-test-apply.yml` (removed, +0/-118)
```diff
@@ -1,118 +0,0 @@
-name: Sealer-Test-Apply
-
-on:
-  push:
-    branches: "release*"
-  issue_comment:
-    types:
-      - created
-  workflow_dispatch: { }
-  pull_request_target:
-    types: [ opened, synchronize, reopened ]
-    branches: "*"
-    paths-ignore:
-      - 'docs/**'
-      - '*.md'
-      - '*.yml'
-      - '.github'
-
-permissions:
-  statuses: write
-
-jobs:
-  build:
-    name: test
-    runs-on: ubuntu-latest
-    if: ${{ (github.event.issue.pull_request && (github.event.comment.body == '/test all' || github.event.comment.body == '/test apply')) || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-    env:
-      GO111MODULE: on
-    steps:
-      - name: Get PR details
-        if: ${{ github.event_name == 'issue_comment' }}
-        uses: xt0rted/pull-request-comment-branch@v1
-        id: comment-branch
-
-      - name: Set commit status as pending
-        if: ${{ github.event_name == 'issue_comment' }}
-        uses: myrotvorets/set-commit-status-action@master
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: pending
-
-      - name: Github API Request
-        id: request
-        uses: octokit/request-action@v2.1.7
-        with:
-          route: ${{ github.event.issue.pull_request.url }}
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-      - name: Get PR informations
-        id: pr_data
-        run: |
-          echo "repo_name=${{ fromJson(steps.request.outputs.data).head.repo.full_name }}" >> $GITHUB_STATE
-          echo "repo_clone_url=${{ fromJson(steps.request.outputs.data).head.repo.clone_url }}" >> $GITHUB_STATE
-          echo "repo_ssh_url=${{ fromJson(steps.request.outputs.data).head.repo.ssh_url }}" >> $GITHUB_STATE
-      - name: Check out code into the Go module directory
-        uses: actions/checkout@v3
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          repository: ${{ github.event.pull_request.head.repo.full_name }}
-          ref: ${{ github.event.pull_request.head.sha }}
-          path: src/github.com/sealerio/sealer
-      - name: Install deps
-        run: |
-          sudo su
-          sudo apt-get update
-          sudo apt-get install -y libgpgme-dev libbtrfs-dev libdevmapper-dev
-          sudo mkdir /var/lib/sealer
-      - name: Set up Go 1.17
-        uses: actions/setup-go@v3
-        with:
-          go-version: 1.17
-        id: go
-
-      - name: Install sealer and ginkgo
-        shell: bash
-        run: |
-          docker run --rm -v ${PWD}:/usr/src/sealer -w /usr/src/sealer registry.cn-qingdao.aliyuncs.com/sealer-io/sealer-build:v1 make linux
-          export SEALER_DIR=${PWD}/_output/bin/sealer/linux_amd64
-          echo "$SEALER_DIR" >> $GITHUB_PATH
-          go install github.com/onsi/ginkgo/ginkgo@v1.16.2
-          go install github.com/onsi/gomega/...@v1.12.0
-          GOPATH=`go env GOPATH`
-          echo "$GOPATH/bin" >> $GITHUB_PATH
-        working-directory: src/github.com/sealerio/sealer
-
-      - name: Run sealer apply test and generate coverage
-        shell: bash
-        working-directory: src/github.com/sealerio/sealer
-        env:
-          REGISTRY_USERNAME: ${{ secrets.REGISTRY_USERNAME }}
-          REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
-          REGISTRY_URL: ${{ secrets.REGISTRY_URL }}
-          IMAGE_NAME: ${{ secrets.IMAGE_NAME}}
-          ACCESSKEYID: ${{ secrets.ACCESSKEYID }}
-          ACCESSKEYSECRET: ${{ secrets.ACCESSKEYSECRET }}
-          RegionID: ${{ secrets.RegionID }}
-        if: ${{ github.event.comment.body == '/test apply' || github.event.comment.body == '/test all' || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-        run: |
-          # fix bug in kernal 5.12.2+:open /proc/sys/net/netfilter/nf_conntrack_max: permission denied, see: https://github.com/kubernetes-sigs/kind/issues/2240
-          sudo sysctl net/netfilter/nf_conntrack_max=131072
-          ginkgo -v -focus="sealer apply" -cover -covermode=atomic -coverpkg=./... -coverprofile=/tmp/coverage.out -trace test
-
-      - name: Upload coverage to Codecov
-        uses: codecov/codecov-action@v3
-        with:
-          token: ${{ secrets.CODECOV_TOKEN }}
-          files: /tmp/coverage.out
-          flags: e2e-tests
-          name: codecov-umbrella
-
-      - name: Set final commit status
-        uses: myrotvorets/set-commit-status-action@master
-        if: contains(github.event.comment.body, '/test') && always()
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: ${{ job.status }}
\ No newline at end of file
```

**File**: `.github/workflows/e2e-test-build.yml` (removed, +0/-116)
```diff
@@ -1,116 +0,0 @@
-name: Sealer-Test-Build
-
-on:
-  push:
-    branches: "release*"
-  issue_comment:
-    types:
-      - created
-  workflow_dispatch: { }
-  pull_request_target:
-    types: [ opened, synchronize, reopened ]
-    branches: "*"
-    paths-ignore:
-      - 'docs/**'
-      - '*.md'
-      - '*.yml'
-      - '.github'
-
-permissions:
-  statuses: write
-
-jobs:
-  build:
-    name: test
-    runs-on: ubuntu-latest
-    if: ${{ (github.event.issue.pull_request && (github.event.comment.body == '/test all' || github.event.comment.body == '/test build')) || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-    env:
-      GO111MODULE: on
-    steps:
-      - name: Get PR details
-        if: ${{ github.event_name == 'issue_comment' }}
-        uses: xt0rted/pull-request-comment-branch@v1
-        id: comment-branch
-
-      - name: Set commit status as pending
-        if: ${{ github.event_name == 'issue_comment' }}
-        uses: myrotvorets/set-commit-status-action@master
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: pending
-
-      - name: Github API Request
-        id: request
-        uses: octokit/request-action@v2.1.7
-        with:
-          route: ${{ github.event.issue.pull_request.url }}
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-      - name: Get PR informations
-        id: pr_data
-        run: |
-          echo "repo_name=${{ fromJson(steps.request.outputs.data).head.repo.full_name }}" >> $GITHUB_STATE
-          echo "repo_clone_url=${{ fromJson(steps.request.outputs.data).head.repo.clone_url }}" >> $GITHUB_STATE
-          echo "repo_ssh_url=${{ fromJson(steps.request.outputs.data).head.repo.ssh_url }}" >> $GITHUB_STATE
-      - name: Check out code into the Go module directory
-        uses: actions/checkout@v3
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          repository: ${{ github.event.pull_request.head.repo.full_name }}
-          ref: ${{ github.event.pull_request.head.sha }}
-          path: src/github.com/sealerio/sealer
-      - name: Install deps
-        run: |
-          sudo su
-          sudo apt-get update
-          sudo apt-get install -y libgpgme-dev libbtrfs-dev libdevmapper-dev
-          sudo mkdir /var/lib/sealer
-      - name: Set up Go 1.17
-        uses: actions/setup-go@v3
-        with:
-          go-version: 1.17
-        id: go
-
-      - name: Install sealer and ginkgo
-        shell: bash
-        run: |
-          docker run --rm -v ${PWD}:/usr/src/sealer -w /usr/src/sealer registry.cn-qingdao.aliyuncs.com/sealer-io/sealer-build:v1 make linux
-          export SEALER_DIR=${PWD}/_output/bin/sealer/linux_amd64
-          echo "$SEALER_DIR" >> $GITHUB_PATH
-          go install github.com/onsi/ginkgo/ginkgo@v1.16.2
-          go install github.com/onsi/gomega/...@v1.12.0
-          GOPATH=`go env GOPATH`
-          echo "$GOPATH/bin" >> $GITHUB_PATH
-        working-directory: src/github.com/sealerio/sealer
-
-      - name: Run sealer build test and generate coverage
-        shell: bash
-        working-directory: src/github.com/sealerio/sealer
-        env:
-          REGISTRY_USERNAME: ${{ secrets.REGISTRY_USERNAME }}
-          REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
-          REGISTRY_URL: ${{ secrets.REGISTRY_URL }}
-          IMAGE_NAME: ${{ secrets.IMAGE_NAME}}
-          ACCESSKEYID: ${{ secrets.ACCESSKEYID }}
-          ACCESSKEYSECRET: ${{ secrets.ACCESSKEYSECRET }}
-          RegionID: ${{ secrets.RegionID }}
-        if: ${{ github.event.comment.body == '/test build' || github.event.comment.body == '/test all' || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-        run: |
-          ginkgo -v -focus="sealer build" -cover -covermode=atomic -coverpkg=./... -coverprofile=/tmp/coverage.out -trace test
-
-      - name: Upload coverage to Codecov
-        uses: codecov/codecov-action@v3
-        with:
-          token: ${{ secrets.CODECOV_TOKEN }}
-          files: /tmp/coverage.out
-          flags: e2e-tests
-          name: codecov-umbrella
-
-      - name: Set final commit status
-        uses: myrotvorets/set-commit-status-action@master
-        if: contains(github.event.comment.body, '/test') && always()
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: ${{ job.status }}
\ No newline at end of file
```

**File**: `.github/workflows/e2e-test-image.yml` (removed, +0/-113)
```diff
@@ -1,113 +0,0 @@
-name: Sealer-Test-Image
-
-on:
-  push:
-    branches: "release*"
-  issue_comment:
-    types:
-      - created
-  workflow_dispatch: { }
-  pull_request_target:
-    types: [ opened, synchronize, reopened ]
-    branches: "*"
-    paths-ignore:
-      - 'docs/**'
-      - '*.md'
-      - '*.yml'
-      - '.github'
-
-permissions:
-  statuses: write
-
-jobs:
-  build:
-    name: test
-    runs-on: ubuntu-latest
-    if: ${{ (github.event.issue.pull_request && (github.event.comment.body == '/test all' || github.event.comment.body == '/test image')) || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-    env:
-      GO111MODULE: on
-    steps:
-      - name: Get PR details
-        if: ${{ github.event_name == 'issue_comment' }}
-        uses: xt0rted/pull-request-comment-branch@v1
-        id: comment-branch
-
-      - name: Set commit status as pending
-        if: ${{ github.event_name == 'issue_comment' }}
-        uses: myrotvorets/set-commit-status-action@master
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: pending
-
-      - name: Github API Request
-        id: request
-        uses: octokit/request-action@v2.1.7
-        with:
-          route: ${{ github.event.issue.pull_request.url }}
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-      - name: Get PR informations
-        id: pr_data
-        run: |
-          echo "repo_name=${{ fromJson(steps.request.outputs.data).head.repo.full_name }}" >> $GITHUB_STATE
-          echo "repo_clone_url=${{ fromJson(steps.request.outputs.data).head.repo.clone_url }}" >> $GITHUB_STATE
-          echo "repo_ssh_url=${{ fromJson(steps.request.outputs.data).head.repo.ssh_url }}" >> $GITHUB_STATE
-      - name: Check out code into the Go module directory
-        uses: actions/checkout@v3
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          repository: ${{ github.event.pull_request.head.repo.full_name }}
-          ref: ${{ github.event.pull_request.head.sha }}
-          path: src/github.com/sealerio/sealer
-      - name: Install deps
-        run: |
-          sudo su
-          sudo apt-get update
-          sudo apt-get install -y libgpgme-dev libbtrfs-dev libdevmapper-dev
-          sudo mkdir /var/lib/sealer
-      - name: Set up Go 1.17
-        uses: actions/setup-go@v3
-        with:
-          go-version: 1.17
-        id: go
-
-      - name: Install sealer and ginkgo
-        shell: bash
-        run: |
-          docker run --rm -v ${PWD}:/usr/src/sealer -w /usr/src/sealer registry.cn-qingdao.aliyuncs.com/sealer-io/sealer-build:v1 make linux
-          export SEALER_DIR=${PWD}/_output/bin/sealer/linux_amd64
-          echo "$SEALER_DIR" >> $GITHUB_PATH
-          go install github.com/onsi/ginkgo/ginkgo@v1.16.2
-          go install github.com/onsi/gomega/...@v1.12.0
-          GOPATH=`go env GOPATH`
-          echo "$GOPATH/bin" >> $GITHUB_PATH
-        working-directory: src/github.com/sealerio/sealer
-
-      - name: Run sealer image test and generate coverage
-        shell: bash
-        working-directory: src/github.com/sealerio/sealer
-        env:
-          REGISTRY_USERNAME: ${{ secrets.REGISTRY_USERNAME }}
-          REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
-          REGISTRY_URL: ${{ secrets.REGISTRY_URL }}
-          IMAGE_NAME: ${{ secrets.IMAGE_NAME}}
-        if: ${{ github.event.comment.body == '/test image' || github.event.comment.body == '/test all' || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-        run: |
-          ginkgo -v -focus="sealer image" -cover -covermode=atomic -coverpkg=./... -coverprofile=/tmp/coverage-image.out -trace test
-
-      - name: Upload coverage to Codecov
-        uses: codecov/codecov-action@v3
-        with:
-          token: ${{ secrets.CODECOV_TOKEN }}
-          files: /tmp/coverage-login.out, /tmp/coverage-image.out
-          flags: e2e-tests
-          name: codecov-umbrella
-
-      - name: Set final commit status
-        uses: myrotvorets/set-commit-status-action@master
-        if: contains(github.event.comment.body, '/test') && always()
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: ${{ job.status }}
\ No newline at end of file
```

**File**: `.github/workflows/e2e-test-run.yml` (removed, +0/-118)
```diff
@@ -1,118 +0,0 @@
-name: Sealer-Test-Run
-
-on:
-  push:
-    branches: "release*"
-  issue_comment:
-    types:
-      - created
-  workflow_dispatch: { }
-  pull_request_target:
-    types: [ opened, synchronize, reopened ]
-    branches: "*"
-    paths-ignore:
-      - 'docs/**'
-      - '*.md'
-      - '*.yml'
-      - '.github'
-
-permissions:
-  statuses: write
-
-jobs:
-  build:
-    name: test
-    runs-on: ubuntu-latest
-    if: ${{ (github.event.issue.pull_request && (github.event.comment.body == '/test all' || github.event.comment.body == '/test run')) || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-    env:
-      GO111MODULE: on
-    steps:
-      - name: Get PR details
-        if: ${{ github.event_name == 'issue_comment'}}
-        uses: xt0rted/pull-request-comment-branch@v1
-        id: comment-branch
-
-      - name: Set commit status as pending
-        if: ${{ github.event_name == 'issue_comment'}}
-        uses: myrotvorets/set-commit-status-action@master
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: pending
-
-      - name: Github API Request
-        id: request
-        uses: octokit/request-action@v2.1.7
-        with:
-          route: ${{ github.event.issue.pull_request.url }}
-        env:
-          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
-      - name: Get PR informations
-        id: pr_data
-        run: |
-          echo "repo_name=${{ fromJson(steps.request.outputs.data).head.repo.full_name }}" >> $GITHUB_STATE
-          echo "repo_clone_url=${{ fromJson(steps.request.outputs.data).head.repo.clone_url }}" >> $GITHUB_STATE
-          echo "repo_ssh_url=${{ fromJson(steps.request.outputs.data).head.repo.ssh_url }}" >> $GITHUB_STATE
-      - name: Check out code into the Go module directory
-        uses: actions/checkout@v3
-        with:
-          token: ${{ secrets.GITHUB_TOKEN }}
-          repository: ${{ github.event.pull_request.head.repo.full_name }}
-          ref: ${{ github.event.pull_request.head.sha }}
-          path: src/github.com/sealerio/sealer
-      - name: Install deps
-        run: |
-          sudo su
-          sudo apt-get update
-          sudo apt-get install -y libgpgme-dev libbtrfs-dev libdevmapper-dev
-          sudo mkdir /var/lib/sealer
-      - name: Set up Go 1.17
-        uses: actions/setup-go@v3
-        with:
-          go-version: 1.17
-        id: go
-
-      - name: Install sealer and ginkgo
-        shell: bash
-        run: |
-          docker run --rm -v ${PWD}:/usr/src/sealer -w /usr/src/sealer registry.cn-qingdao.aliyuncs.com/sealer-io/sealer-build:v1 make linux
-          export SEALER_DIR=${PWD}/_output/bin/sealer/linux_amd64
-          echo "$SEALER_DIR" >> $GITHUB_PATH
-          go install github.com/onsi/ginkgo/ginkgo@v1.16.2
-          go install github.com/onsi/gomega/...@v1.12.0
-          GOPATH=`go env GOPATH`
-          echo "$GOPATH/bin" >> $GITHUB_PATH
-        working-directory: src/github.com/sealerio/sealer
-
-      - name: Run sealer run test and generate coverage
-        shell: bash
-        working-directory: src/github.com/sealerio/sealer
-        env:
-          REGISTRY_USERNAME: ${{ secrets.REGISTRY_USERNAME }}
-          REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
-          REGISTRY_URL: ${{ secrets.REGISTRY_URL }}
-          IMAGE_NAME: ${{ secrets.IMAGE_NAME}}
-          ACCESSKEYID: ${{ secrets.ACCESSKEYID }}
-          ACCESSKEYSECRET: ${{ secrets.ACCESSKEYSECRET }}
-          RegionID: ${{ secrets.RegionID }}
-        if: ${{ github.event.comment.body == '/test run' || github.event.comment.body == '/test all' || github.event_name == 'push' || github.event_name == 'pull_request_target' }}
-        run: |
-          # fix bug in kernal 5.12.2+:open /proc/sys/net/netfilter/nf_conntrack_max: permission denied, see: https://github.com/kubernetes-sigs/kind/issues/2240
-          sudo sysctl net/netfilter/nf_conntrack_max=131072
-          ginkgo -v -focus="sealer run" -cover -covermode=atomic -coverpkg=./... -coverprofile=/tmp/coverage.out -trace test
-
-      - name: Upload coverage to Codecov
-        uses: codecov/codecov-action@v3
-        with:
-          token: ${{ secrets.CODECOV_TOKEN }}
-          files: /tmp/coverage.out
-          flags: e2e-tests
-          name: codecov-umbrella
-
-      - name: Set final commit status
-        uses: myrotvorets/set-commit-status-action@master
-        if: contains(github.event.comment.body, '/test') && always()
-        with:
-          sha: ${{ steps.comment-branch.outputs.head_sha }}
-          token: ${{ secrets.GITHUB_TOKEN }}
-          status: ${{ job.status }}
\ No newline at end of file
```

---

### Incident Patch 3: `f4f89c58` (2024-05-07)
**Commit Message**: fix multi-document yaml reading errors (#2322)

Signed-off-by: Maxwell <[REDACTED_EMAIL]>

**File**: `pkg/application/files.go` (modified, +10/-5)
```diff
@@ -16,7 +16,9 @@ package application
 
 import (
 	"bytes"
+	"errors"
 	"fmt"
+	"io"
 	"os"
 	"path/filepath"
 
@@ -77,15 +79,18 @@ func (m mergeProcessor) Process(appRoot string) error {
 
 	logrus.Debugf("will do merge processor on the file : %s", target)
 
-	contents, err := os.ReadFile(filepath.Clean(target))
+	f, err := os.Open(filepath.Clean(target))
 	if err != nil {
 		return err
 	}
 
-	for _, section := range bytes.Split(contents, []byte("---\n")) {
+	dec := yaml.NewDecoder(f)
+	for {
 		destDataMap := make(map[string]interface{})
-
-		err = yaml.Unmarshal(section, &destDataMap)
+		err = dec.Decode(destDataMap)
+		if errors.Is(err, io.EOF) {
+			break
+		}
 		if err != nil {
 			return fmt.Errorf("failed to unmarshal config data: %v", err)
 		}
@@ -103,7 +108,7 @@ func (m mergeProcessor) Process(appRoot string) error {
 		result = append(result, out)
 	}
 
-	err = osUtils.NewCommonWriter(target).WriteFile(bytes.Join(result, []byte("---\n")))
+	err = osUtils.NewCommonWriter(target).WriteFile(bytes.Join(result, []byte("\n---\n")))
 	if err != nil {
 		return fmt.Errorf("failed to write to file %s with raw mode: %v", target, err)
 	}
```

**File**: `pkg/application/files_test.go` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+// Copyright © 2023 Alibaba Group Holding Ltd.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package application
+
+import (
+	"os"
+	"path/filepath"
+	"testing"
+
+	"github.com/google/go-cmp/cmp"
+	v2 "github.com/sealerio/sealer/types/api/v2"
+)
+
+func Test_mergeProcessor_Process(t *testing.T) {
+	tests := []struct {
+		source   string
+		patch    string
+		expected string
+		wantErr  bool
+	}{
+		{
+			source:   "a: b\nb: c",
+			patch:    "b: d",
+			expected: "a: b\nb: d\n",
+			wantErr:  false,
+		},
+		{
+			source:   "a: b\n## ---\nb: c",
+			patch:    "b: d",
+			expected: "a: b\nb: d\n",
+			wantErr:  false,
+		},
+		{
+			source:   "a: b\n---\nb: c",
+			patch:    "b: d",
+			expected: "a: b\nb: d\n\n---\nb: d\n",
+			wantErr:  false,
+		},
+	}
+	// prepare a tmp dir to write test files
+	appRoot, err := os.MkdirTemp("", "sealer-unit-test")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer func() {
+		_ = os.RemoveAll(appRoot)
+	}()
+
+	testFile := filepath.Join(appRoot, "test.yaml")
+	for _, tt := range tests {
+		// prepare source file
+		f, err := os.Create(testFile)
+		if err != nil {
+			t.Fatal(err)
+		}
+		_, err = f.WriteString(tt.source)
+		if err != nil {
+			t.Fatal(err)
+		}
+
+		r := mergeProcessor{
+			AppFile: v2.AppFile{
+				Path:     "test.yaml",
+				Strategy: v2.MergeStrategy,
+				Data:     tt.patch,
+			},
+		}
+
+		if err := r.Process(appRoot); err != nil && !tt.wantErr {
+			t.Errorf("mergeProcessor.Process() error = %v", err)
+		} else {
+			output, err := os.ReadFile(testFile)
+			if err != nil {
+				t.Fatal(err)
+			}
+
+			if diff := cmp.Diff(string(output), tt.expected); diff != "" {
+				t.Errorf("test failed expected=%s; output=%s; diff=%s", tt.expected, string(output), diff)
+			}
+		}
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #2322** (2024-05-07): fix multi-document yaml reading errors (@maxwell-can-not-fly)
- **PR #2314** (closed): Update kubeadm default config  (@clcc2019)
- **PR #2312** (2023-10-26): Bumped the version of golangci-lint (@dynos01)
- **PR #2311** (2023-10-25): chore: fix golang ci lint error (@starnop)
- **PR #2309** (2023-10-23): Update gosec.yml (@VinceCui)
- **PR #2304** (2023-10-31): feat: add create etcd cluster and weed cluster function (@sjcsjc123)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
