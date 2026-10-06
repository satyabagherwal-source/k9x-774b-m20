# Forensic Learning Record (Deep Inspection): sealerio/sealer

> **Canonical Artifact**: `07_PROJECT_LEARNING/sealerio-sealer-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sealerio/sealer](https://github.com/sealerio/sealer))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:19:31.606Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sealerio/sealer`
- **Description**: Build, Share and Run Both Your Kubernetes Cluster and Distributed Applications  (Project under CNCF)
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2093 stars

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

### Core Architecture Module: `pkg/client/docker/utils.go`
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

package docker

import (
	"encoding/base64"
	"encoding/json"

	"github.com/docker/distribution/reference"
	"github.com/docker/docker/api/types"
	dockerregistry "github.com/docker/docker/registry"
	"github.com/sirupsen/logrus"

	"github.com/sealerio/sealer/pkg/client/docker/auth"
	normalreference "github.com/sealerio/sealer/pkg/image/reference"
)

func GetCanonicalImageName(rawImageName string) (reference.Named, error) {
	var named reference.Named
	named, err := reference.ParseNormalizedNamed(rawImageName)
	if err != nil {
		return nil, err
	}
	return named, nil
}

func GetCanonicalImagePullOptions(canonicalImageName string) types.ImagePullOptions {
	var (
		err         error
		authConfig  types.AuthConfig
		encodedJSON []byte
		authStr     string
		opts        types.ImagePullOptions
	)

	named, err := normalreference.ParseToNamed(canonicalImageName)
	if err != nil {
		logrus.Warnf("failed to parse canonical ImageName: %v", err)
		return opts
	}

	//convert default docker.io to its default index server endpoint
	registryAddr := named.Domain()
	if registryAddr == dockerregistry.IndexName {
		registryAddr = dockerregistry.IndexServer
	}
	svc, err := auth.NewDockerAuthService()
	if err != nil {
		return opts
	}

	authConfig, err = svc.GetAuthByDomain(registryAddr)
	if err == nil {
		encodedJSON, err = json.Marshal(authConfig)
		if err != nil {
			logrus.Warnf("failed to authConfig encodedJSON: %v", err)
		} else {
			authStr = base64.URLEncoding.EncodeToString(encodedJSON)
		}
	}
	return types.ImagePullOptions{RegistryAuth: authStr}
}

```

### Core Architecture Module: `pkg/cluster-runtime/hook.go`
```
// Copyright © 2022 Alibaba Group Holding Ltd.
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

package clusterruntime

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/sirupsen/logrus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8syaml "k8s.io/apimachinery/pkg/util/yaml"

	"github.com/sealerio/sealer/common"
	"github.com/sealerio/sealer/pkg/infradriver"
	v1 "github.com/sealerio/sealer/types/api/v1"
	netUtils "github.com/sealerio/sealer/utils/net"
	"github.com/sealerio/sealer/utils/yaml"
)

const (
	ShellHook HookType = "SHELL"
)

const (
	//PreInstallCluster on master0
	PreInstallCluster Phase = "pre-install"
	//PostInstallCluster on master0
	PostInstallCluster Phase = "post-install"
	//PreUnInstallCluster on master0
	PreUnInstallCluster Phase = "pre-uninstall"
	//PostUnInstallCluster on master0
	PostUnInstallCluster Phase = "post-uninstall"
	//PreScaleUpCluster on master0
	PreScaleUpCluster Phase = "pre-scaleup"
	//PostScaleUpCluster on master0
	PostScaleUpCluster Phase = "post-scaleup"
	//UpgradeCluster on master0
	UpgradeCluster Phase = "upgrade"
	//RollbackCluster on master0
	RollbackCluster Phase = "rollback"

	//PreInitHost on role
	PreInitHost Phase = "pre-init-host"
	//PostInitHost on role
	PostInitHost Phase = "post-init-host"
	//PreCleanHost on role
	PreCleanHost Phase = "pre-clean-host"
	//PostCleanHost on role
	PostCleanHost Phase = "post-clean-host"
	//UpgradeHost on role
	UpgradeHost Phase = "upgrade-host"
)

type HookType string

type Scope string

type Phase string

const (
	ExtraOptionSkipWhenWorkspaceNotExists = "SkipWhenWorkspaceNotExists"
)

type HookFunc func(data string, onHosts []net.IP, driver infradriver.InfraDriver, extraOpts map[string]bool) error

var hookFactories = make(map[HookType]HookFunc)

// HookConfig tell us how to configure hooks for cluster
type HookConfig struct {
	// Name defines hook names, will run hooks in alphabetical order.
	Name string `json:"name,omitempty"`
	//Type defines different hook type, currently only have "SHELL","HOSTNAME".
	Type HookType `json:"type,omitempty"`
	// Data real hooks data will be applied at install process.
	Data string `json:"data,omitempty"`
	// Phase defines when to run hooks.
	Phase Phase `json:"Phase,omitempty"`
	// Scope defines which roles of node will be applied with hook Data
	Scope Scope `json:"scope,omitempty"`
}

type HookConfigList []HookConfig

func (r HookConfigList) Len() int           { return len(r) }
func (r HookConfigList) Swap(i, j int)      { r[i], r[j] = r[j], r[i] }
func (r HookConfigList) Less(i, j int) bool { return r[i].Name < r[j].Name }

// runHostHook run host scope hook by Phase and only execute hook on the given host list.
func (i *Installer) runHostHook(phase Phase, hosts []net.IP) error {
	hookConfigList, ok := i.hooks[phase]
	if !ok {
		logrus.Debugf("no hooks found at phase: %s", phase)
		return nil
	}

	extraOpts := map[string]bool{}
	if phase == PostCleanHost || phase == PreCleanHost {
		extraOpts[ExtraOptionSkipWhenWorkspaceNotExists] = true
	}

	// sorted by hookConfig name in alphabetical order
	sort.Sort(hookConfigList)
	for _, hookConfig := range hookConfigList {
		var targetHosts []net.IP
		expectedHosts := i.getHostIPListByScope(hookConfig.Scope)
		// Make sure each host got from Scope is in the given host ip list.
		for _, expected := range expectedHosts {
			if netUtils.IsInIPList(expected, hosts) {
				targetHosts = append(targetHosts, expected)
			}
		}

		if len(targetHosts) == 0 {
			logrus.Debugf("no expected host found from hook %s", hookConfig.Name)
			continue
		}

		logrus.Infof("start to run hook(%s) on host(%s)", hookConfig.Name, targetHosts)
		if err := hookFactories[hookConfig.Type](hookConfig.Data, targetHosts, i.infraDriver, extraOpts); err != nil {
			return fmt.Errorf("failed to run hook: %s", hookConfig.Name)
		}
	}

	return nil
}

// runClusterHook run cluster scope hook by Phase that means will only execute hook on master0.
func (i *Installer) runClusterHook(master0 net.IP, phase Phase) error {
	hookConfigList, ok := i.hooks[phase]
	if !ok {
		logrus.Debugf("no hooks found at phase: %s", phase)
		return nil
	}
	// sorted by hookConfig name in alphabetical order
	sort.Sort(hookConfigList)

	extraOpts := map[string]bool{}
	if phase == PreUnInstallCluster || phase == PostUnInstallCluster {
		extraOpts[ExtraOptionSkipWhenWorkspaceNotExists] = true
	}

	for _, hookConfig := range hookConfigList {
		logrus.Infof("start to run hook(%s) on host(%s)", hookConfig.Name, master0)
		if err := hookFactories[hookConfig.Type](hookConfig.Data, []net.IP{master0}, i.infraDriver, extraOpts); err != nil {
			return fmt.Errorf("failed to run hook: %s", hookConfig.Name)
		}
	}

	return nil
}

// getHostIPListByScope get ip list for scope, support use '|' to specify multiple scopes, they are ORed
func (i *Installer) getHostIPListByScope(scope Scope) []net.IP {
	var ret []net.IP
	scopes := strings.Split(string(scope), "|")
	for _, s := range scopes {
		hosts := i.infraDriver.GetHostIPListByRole(strings.TrimSpace(s))

		// remove duplicates
		for _, h := range hosts {
			if !netUtils.IsInIPList(h, ret) {
				ret = append(ret, h)
			}
		}
	}

	return ret
}

func NewShellHook() HookFunc {
	return func(cmd string, hosts []net.IP, driver infradriver.InfraDriver, extraOpts map[string]bool) error {
		rootfs := driver.GetClusterRootfsPath()
		for _, ip := range hosts {
			logrus.Infof("start to run hook on host %s", ip.String())
			wrappedCmd := fmt.Sprintf(common.CdAndExecCmd, rootfs, cmd)
			if extraOpts[ExtraOptionSkipWhenWorkspaceNotExists] {
				wrappedCmd = fmt.Sprintf(common.CdIfExistAndExecCmd, rootfs, rootfs, cmd)
			}

			err := driver.CmdAsync(ip, driver.GetHostEnv(ip), wrappedCmd)
			if err != nil {
				return fmt.Errorf("failed to run shell hook(%s) on host(%s): %v", wrappedCmd, ip.String(), err)
			}
		}

		return nil
	}
}

// Register different hook type with its HookFunc to hookFactories
func Register(name HookType, factory HookFunc) {
	if factory == nil {
		panic("Must not provide nil hookFactory")
	}
	_, registered := hookFactories[name]
	if registered {
		panic(fmt.Sprintf("hookFactory named %s already registered", name))
	}

	hookFactories[name] = factory
}

func transferPluginsToHooks(plugins []v1.Plugin) (map[Phase]HookConfigList, error) {
	hooks := make(map[Phase]HookConfigList)

	for _, pluginConfig := range plugins {
		pluginConfig.Spec.Data = strings.TrimSuffix(pluginConfig.Spec.Data, "\n")
		hookType := HookType(pluginConfig.Spec.Type)

		_, ok := hookFactories[hookType]
		if !ok {
			return nil, fmt.Errorf("hook type: %s is not registered", hookType)
		}

		//split pluginConfig.Spec.Action with "|" to support combined actions
		phaseList := strings.Split(pluginConfig.Spec.Action, "|")
		for _, phase := range phaseList {
			if phase == "" {
				continue
			}
			hookConfig := HookConfig{
				Name:  pluginConfig.Name,
				Data:  pluginConfig.Spec.Data,
				Type:  hookType,
				Phase: Phase(phase),
				Scope: Scope(pluginConfig.Spec.Scope),
			}

			if _, ok = hooks[hookConfig.Phase]; !ok {
				// add new Phase
				hooks[hookConfig.Phase] = []HookConfig{hookConfig}
			} else {
				hooks[hookConfig.Phase] = append(hooks[hookConfig.Phase], hookConfig)
			}
		}
	}
	return hooks, nil
}

// LoadPluginsFromFile load plugin config files from $rootfs/plugins dir.
func LoadPluginsFromFile(pluginPath string) ([]v1.Plugin, error) {
	_, err := os.Stat(pluginPath)
	if os.IsNotExist(err) {
		return nil, nil
	}

	files, err := os.ReadDir(pluginPath)
	if err != nil {
		return nil, fmt.Errorf("failed to ReadDir plugin dir %s: %v", pluginPath, err)
	}

	var plugins []v1.Plugin
	for _, f := range files {
		if !yaml.Matcher(f.Name()) {
			continue
		}
		pluginFile := filepath.Join(pluginPath, f.Name())
		pluginList, err := decodePluginFile(pluginFile)
		if err != nil {
			return nil, fmt.Errorf("failed to decode plugin file %s: %v", pluginFile, err)
		}
		plugins = append(plugins, pluginList...)
	}

	return plugins, nil
}

func decodePluginFile(pluginFile string) ([]v1.Plugin, error) {
	var plugins []v1.Plugin
	data, err := os.ReadFile(filepath.Clean(pluginFile))
	if err != nil {
		return nil, err
	}

	decoder := k8syaml.NewYAMLToJSONDecoder(bufio.NewReaderSize(bytes.NewReader(data), 4096))
	for {
		ext := runtime.RawExtension{}
		if err := decoder.Decode(&ext); err != nil {
			if err == io.EOF {
				return plugins, nil
			}
			return nil, err
		}

		ext.Raw = bytes.TrimSpace(ext.Raw)
		if len(ext.Raw) == 0 || bytes.Equal(ext.Raw, []byte("null")) {
			continue
		}
		metaType := metav1.TypeMeta{}
		if err := k8syaml.Unmarshal(ext.Raw, &metaType); err != nil {
			return nil, fmt.Errorf("failed to decode TypeMeta: %v", err)
		}

		var plu v1.Plugin
		if err := k8syaml.Unmarshal(ext.Raw, &plu); err != nil {
			return nil, fmt.Errorf("failed to decode %s[%s]: %v", metaType.Kind, metaType.APIVersion, err)
		}

		plu.Spec.Data = strings.TrimSuffix(plu.Spec.Data, "\n")
		plugins = append(plugins, plu)
	}
}

func init() {
	Register(ShellHook, NewShellHook())
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

- **Issue #2332** (2024-01-24): **[WeeklyReport] Weekly report for sealer 1/10/2024 to 1/17/2024**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1971 (↑5) | 356 (-) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 2 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this 

- **Issue #2330** (2024-01-17): **[WeeklyReport] Weekly report for sealer 1/3/2024 to 1/10/2024**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1966 (↑2) | 356 (↑1) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 1 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this

- **Issue #2329** (2024-01-10): **[WeeklyReport] Weekly report for sealer 12/27/2023 to 1/3/2024**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1965 (↑1) | 355 (↑1) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 1 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this

- **Issue #2328** (2024-01-03): **[WeeklyReport] Weekly report for sealer 12/20/2023 to 12/27/2023**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1965 (↑4) | 354 (-) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 1 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this 

- **Issue #2327** (2023-12-27): **[WeeklyReport] Weekly report for sealer 12/13/2023 to 12/20/2023**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1960 (↑3) | 354 (-) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 2 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this 

- **Issue #2325** (2023-12-20): **[WeeklyReport] Weekly report for sealer 12/6/2023 to 12/13/2023**
  *Symptoms*: # Weekly Report of sealer This is a weekly report of sealer. ### For more details about developer contirubtions, please check our [contribution leaderboard](https://opensource.alibaba.com/contribution_leaderboard/details?projectValue=sealer). It summarizes what have changed in the project during the passed week, including pr merged, new contributors, and more things in the future.  ## Repo Overview  ### Basic data  Baisc data shows how the watch, star, fork and contributors count changed in the passed week.  | Watch | Star | Fork | Contributors | |:-----:|:----:|:----:|:------------:| | 35 | 1958 (↑5) | 354 (↑1) | 71 (-) |  ### Issues & PRs  Issues & PRs show the new/closed issues/pull requests count in the passed week.  | New Issues | Closed Issues | New PR | Merged PR | |:----------:|:-------------:|:------:|:---------:| | 2 | 1 | 0 | 0 |  ## PR Overview  Thanks to contributions from community, **0** pull requests was merged in the repository last week. They are:  | Contributor ID | Count | Pull Requests | |:--------------:|:-----:|:-------------|   ## Code Review Statistics  sealer encourages everyone to participant in code review, in order to improve software quality. This robot would automatically help to count pull request reviews of single github user as the following every week. So, try to help review code in this project.  | Contributor ID | Pull Request Reviews | |:--------------:|:--------------------:|   ## New Contributors  We have no new contributors in this

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

### Incident Patch 1: `e426153a` (2025-06-03)
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

### Incident Patch 2: `f4f89c58` (2024-05-07)
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

---

### Incident Patch 3: `ec4a2c7a` (2023-10-25)
**Commit Message**: chore: fix golang ci lint error (#2311)

Signed-off-by: yuxing.lyx <[REDACTED_EMAIL]>

**File**: `.golangci.yml` (modified, +7/-5)
```diff
@@ -25,7 +25,7 @@ linters:
   enable:
     - gofmt
     - goimports
-    - golint
+    - revive
     - stylecheck
     - goconst
     - gosimple
@@ -34,23 +34,25 @@ linters:
     - ineffassign
     - vet
     - typecheck
-    - deadcode
     - errcheck
     - govet
     - staticcheck
-    - structcheck
     - unused
-    - varcheck
     - nilerr
     - unparam
-    - ifshort
     - unconvert
 
 issues:
   exclude-rules:
     - linters:
         - golint
       text: "AccessKeyId"
+    - linters:
+        - typecheck
+      text: "has no field or method"
+    - linters:
+        - revive
+      text: "just return error instead"
 
 # golangci.com configuration
 # https://github.com/golangci/golangci/wiki/Configuration
```

**File**: `pkg/checker/node_checker.go` (modified, +2/-2)
```diff
@@ -58,9 +58,9 @@ func (n *NodeChecker) Check(cluster *v2.Cluster, phase string) error {
 		return err
 	}
 	var notReadyNodeList []string
-	var readyCount uint32 = 0
+	var readyCount uint32
 	var nodeCount uint32
-	var notReadyCount uint32 = 0
+	var notReadyCount uint32
 	for _, node := range nodes.Items {
 		nodeIP, nodePhase := getNodeStatus(node)
 		if nodePhase != ReadyNodeStatus {
```

**File**: `pkg/checker/pod_checker.go` (modified, +2/-2)
```diff
@@ -55,8 +55,8 @@ func (n *PodChecker) Check(cluster *v2.Cluster, phase string) error {
 		return err
 	}
 	for _, podNamespace := range namespacePodList {
-		var runningCount uint32 = 0
-		var notRunningCount uint32 = 0
+		var runningCount uint32
+		var notRunningCount uint32
 		var podCount uint32
 		var notRunningPodList []*corev1.Pod
 		for _, pod := range podNamespace.PodList.Items {
```

**File**: `pkg/infra/aliyun/ali_ecs.go` (modified, +1/-4)
```diff
@@ -52,10 +52,7 @@ func (a *AliProvider) RetryEcsRequest(request requests.AcsRequest, response resp
 
 func (a *AliProvider) RetryEcsAction(request requests.AcsRequest, response responses.AcsResponse, tryTimes int) error {
 	return utils.Retry(tryTimes, TrySleepTime, func() error {
-		if err := a.EcsClient.DoAction(request, response); err != nil {
-			return err
-		}
-		return nil
+		return a.EcsClient.DoAction(request, response)
 	})
 }
 
```

**File**: `pkg/infra/container/container.go` (modified, +1/-4)
```diff
@@ -146,10 +146,7 @@ func (a *ApplyProvider) ReconcileContainer() error {
 	if err := a.applyResult(masterApplyResult); err != nil {
 		return err
 	}
-	if err := a.applyResult(nodeApplyResult); err != nil {
-		return err
-	}
-	return nil
+	return a.applyResult(nodeApplyResult)
 }
 
 func (a *ApplyProvider) applyResult(result *ApplyResult) error {
```

**File**: `pkg/infradriver/ssh_infradriver.go` (modified, +4/-4)
```diff
@@ -94,12 +94,12 @@ func NewInfraDriver(cluster *v2.Cluster) (InfraDriver, error) {
 	}
 
 	// initialize sshConfigs field
-	for _, host := range cluster.Spec.Hosts {
-		if err = mergo.Merge(&host.SSH, &cluster.Spec.SSH); err != nil {
+	for i := range cluster.Spec.Hosts {
+		if err = mergo.Merge(&cluster.Spec.Hosts[i].SSH, &cluster.Spec.SSH); err != nil {
 			return nil, err
 		}
-		for _, ip := range host.IPS {
-			ret.sshConfigs[ip.String()] = ssh.NewSSHClient(&host.SSH, true)
+		for _, ip := range cluster.Spec.Hosts[i].IPS {
+			ret.sshConfigs[ip.String()] = ssh.NewSSHClient(&cluster.Spec.Hosts[i].SSH, true)
 		}
 	}
 
```

**File**: `test/testhelper/utils.go` (modified, +2/-8)
```diff
@@ -73,10 +73,7 @@ func WriteFile(fileName string, content []byte) error {
 		}
 	}
 
-	if err := os.WriteFile(fileName, content, settings.FileMode0644); err != nil {
-		return err
-	}
-	return nil
+	return os.WriteFile(fileName, content, settings.FileMode0644)
 }
 
 type SSHClient struct {
@@ -148,10 +145,7 @@ func MarshalYamlToFile(file string, obj interface{}) error {
 	if err != nil {
 		return err
 	}
-	if err = WriteFile(file, data); err != nil {
-		return err
-	}
-	return nil
+	return WriteFile(file, data)
 }
 
 // GetLocalFileData get file data from local
```

**File**: `utils/archive/compress.go` (modified, +1/-1)
```diff
@@ -327,7 +327,7 @@ func Decompress(src io.Reader, dst string, options Options) (int64, error) {
 	}
 
 	var (
-		size int64 = 0
+		size int64
 		dirs []*tar.Header
 		tr   = tar.NewReader(reader)
 	)
```

---

### Incident Patch 4: `f07e8043` (2023-07-17)
**Commit Message**: revert dependabot (#2279)

Signed-off-by: kakazhou <[REDACTED_EMAIL]>

**File**: `.github/dependabot.yml` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-# To get started with Dependabot version updates, you'll need to specify which
-# package ecosystems to update and where the package manifests are located.
-# Please see the documentation for all configuration options:
-# https://docs.github.com/github/administering-a-repository/configuration-options-for-dependency-updates
-
-version: 2
-updates:
-  - package-ecosystem: "gomod"
-    directory: "/"
-    schedule:
-      interval: "monthly"
-    open-pull-requests-limit: 10
-
-  - package-ecosystem: "github-actions"
-    directory: "/"
-    schedule:
-      interval: "monthly"
```

---

### Incident Patch 5: `968dcdba` (2023-07-12)
**Commit Message**: bugfix: add platform to container image list; skip download duplicate container image;add some debug logs (#2254)

Signed-off-by: kakzhou719 <[REDACTED_EMAIL]>

**File**: `cmd/sealer/cmd/image/build.go` (modified, +9/-1)
```diff
@@ -323,7 +323,15 @@ func applyRegistryToImage(engine imageengine.Interface, imageID string, platform
 	if err != nil {
 		return "", nil, errors.Wrap(err, "failed to parse container image list")
 	}
-	containerImageList = append(containerImageList, parsedContainerImageList...)
+	for _, image := range parsedContainerImageList {
+		logrus.Debugf("get container image(%s) with platform(%s) from build context",
+			image.Image, platform.ToString())
+		containerImageList = append(containerImageList, &v12.ContainerImage{
+			Image:    image.Image,
+			AppName:  image.AppName,
+			Platform: &platform,
+		})
+	}
 
 	// ignored image list
 	if buildFlags.IgnoredImageList != "" && osi.IsFileExist(buildFlags.IgnoredImageList) {
```

**File**: `pkg/image/save/save.go` (modified, +9/-1)
```diff
@@ -71,14 +71,22 @@ func (is *DefaultImageSaver) SaveImages(images []string, dir string, platform v1
 		}
 	}()
 
+	existFlag := make(map[string]struct{})
 	//handle image name
 	for _, image := range images {
 		named, err := ParseNormalizedNamed(image, "")
 		if err != nil {
 			return fmt.Errorf("failed to parse image name:: %v", err)
 		}
 
-		//check if image exist
+		//check if image is duplicate
+		if _, exist := existFlag[named.FullName()]; exist {
+			continue
+		} else {
+			existFlag[named.FullName()] = struct{}{}
+		}
+
+		//check if image exist in disk
 		if err := is.isImageExist(named, dir, platform); err == nil {
 			continue
 		}
```

**File**: `pkg/imagedistributor/scp_distributor.go` (modified, +2/-0)
```diff
@@ -67,6 +67,7 @@ func (s *scpDistributor) DistributeRegistry(deployHosts []net.IP, dataDir string
 					}
 
 					if existed {
+						logrus.Debugf("cache %s hits on: %s, skip to do distribution", info.ImageID, tmpDeployHost.String())
 						return nil
 					}
 				}
@@ -121,6 +122,7 @@ func (s *scpDistributor) Distribute(hosts []net.IP, dest string) error {
 					}
 
 					if existed {
+						logrus.Debugf("cache %s hits on: %s, skip to do distribution", info.ImageID, host.String())
 						return nil
 					}
 				}
```

---

### Incident Patch 6: `dabf8ce6` (2023-07-12)
**Commit Message**: bugfix: use instance name as saved name (#2260)

Signed-off-by: kakazhou <[REDACTED_EMAIL]>

**File**: `pkg/imageengine/buildah/save.go` (modified, +12/-2)
```diff
@@ -109,15 +109,25 @@ func (engine *Engine) Save(opts *options.SaveOptions) error {
 		if err != nil {
 			return err
 		}
+
 		if len(images) == 0 {
 			return fmt.Errorf("no image matched with digest %s", instanceDigest)
 		}
 
-		instanceTar := filepath.Join(tempDir, images[0].ID+".tar")
-		err = engine.saveOneImage(images[0].ID, opts.Format, instanceTar, opts.Compress)
+		instance := images[0]
+		instanceTar := filepath.Join(tempDir, instance.ID+".tar")
+
+		// if instance has "Names", use the first one as saved name
+		instanceName := instance.ID
+		if len(instance.Names) > 0 {
+			instanceName = instance.Names[0]
+		}
+
+		err = engine.saveOneImage(instanceName, opts.Format, instanceTar, opts.Compress)
 		if err != nil {
 			return err
 		}
+
 		pathsToCompress = append(pathsToCompress, instanceTar)
 	}
 
```

---

### Incident Patch 7: `f8ea3401` (2023-06-25)
**Commit Message**: feat: sealer build supports lite mode (#2251)

Signed-off-by: kakzhou719 <[REDACTED_EMAIL]>

**File**: `cmd/sealer/cmd/image/build.go` (modified, +35/-6)
```diff
@@ -117,12 +117,18 @@ func NewBuildCmd() *cobra.Command {
 	buildCmd.Flags().StringSliceVar(&buildFlags.Annotations, "annotation", []string{}, "add annotations for image. Format like --annotation key=[value]")
 	buildCmd.Flags().StringSliceVar(&buildFlags.Labels, "label", []string{getSealerLabel()}, "add labels for image. Format like --label key=[value]")
 	buildCmd.Flags().BoolVar(&buildFlags.NoCache, "no-cache", false, "do not use existing cached images for building. Build from the start with a new set of cached layers.")
+	buildCmd.Flags().StringVar(&buildFlags.BuildMode, "build-mode", options.WithAllMode, "whether to download container image during the build process. default is `all`.")
 
 	supportedImageType := map[string]struct{}{v12.KubeInstaller: {}, v12.AppInstaller: {}}
 	if _, ok := supportedImageType[buildFlags.ImageType]; !ok {
 		logrus.Fatalf("image type %s is not supported", buildFlags.ImageType)
 	}
 
+	supportedBuildModeType := map[string]struct{}{options.WithAllMode: {}, options.WithLiteMode: {}}
+	if _, ok := supportedBuildModeType[buildFlags.BuildMode]; !ok {
+		logrus.Fatalf("build mode type %s is not supported in %s", buildFlags.BuildMode, options.SupportedBuildModes)
+	}
+
 	return buildCmd
 }
 
@@ -172,6 +178,7 @@ func buildSingleSealerImage(engine imageengine.Interface, imageName string, mani
 	defer func() {
 		_ = os.Remove(dockerfilePath)
 	}()
+	buildFlags.DockerFilePath = dockerfilePath
 
 	// set the image extension to oci image annotation
 	imageExtension := buildImageExtensionOnResult(result, buildFlags.ImageType)
@@ -180,18 +187,40 @@ func buildSingleSealerImage(engine imageengine.Interface, imageName string, mani
 		return errors.Wrap(err, "failed to marshal image extension")
 	}
 
+	// add annotations to image. Store some sealer specific information
+	buildFlags.Annotations = append(buildFlags.Annotations, fmt.Sprintf("%s=%s", v12.SealerImageExtension, string(iejson)))
+	buildFlags.Platforms = []string{platformStr}
+
+	// if it is lite mode, just build it and return
+	if buildFlags.BuildMode == options.WithLiteMode {
+		// build single platform image
+		if manifest == "" {
+			_, err = engine.Build(&buildFlags)
+			if err != nil {
+				return fmt.Errorf("failed to build sealer image with lite mode: %+v", err)
+			}
+
+			return nil
+		}
+
+		// build multi-platform image
+		buildFlags.Tag = ""
+		buildFlags.NoCache = true
+		iid, err := engine.Build(&buildFlags)
+		if err != nil {
+			return fmt.Errorf("failed to build sealer image with all mode: %+v", err)
+		}
+
+		return engine.AddToManifest(manifest, []string{iid}, &options.ManifestAddOpts{})
+	}
+
 	var (
-		randomStr = getRandomString(8)
 		// use temp tag to do temp image build, because after build,
 		// we need to download some container data loaded from rootfs to it.
-		tempTag = imageName + randomStr
+		tempTag = imageName + getRandomString(8)
 	)
 
 	buildFlags.Tag = tempTag
-	// add annotations to image. Store some sealer specific information
-	buildFlags.DockerFilePath = dockerfilePath
-	buildFlags.Annotations = append(buildFlags.Annotations, fmt.Sprintf("%s=%s", v12.SealerImageExtension, string(iejson)))
-	buildFlags.Platforms = []string{platformStr}
 	iid, err := engine.Build(&buildFlags)
 	if err != nil {
 		return errors.Errorf("error in building image, %v", err)
```

**File**: `pkg/define/options/options.go` (modified, +14/-0)
```diff
@@ -14,6 +14,16 @@
 
 package options
 
+const (
+	WithLiteMode = "lite"
+	WithAllMode  = "all"
+)
+
+var SupportedBuildModes = []string{
+	WithLiteMode,
+	WithAllMode,
+}
+
 // BuildOptions should be out of buildah scope.
 type BuildOptions struct {
 	Kubefile       string
@@ -32,6 +42,10 @@ type BuildOptions struct {
 	ImageList         string
 	ImageListWithAuth string
 	IgnoredImageList  string
+
+	//BuildMode means whether to download container image during the build process
+	// default value is download all container images.
+	BuildMode string
 }
 
 type FromOptions struct {
```

---

### Incident Patch 8: `ad8336dd` (2023-06-16)
**Commit Message**: bugfix: return error if scale ip already in cluster (#2249)

Signed-off-by: kakzhou719 <[REDACTED_EMAIL]>

**File**: `cmd/sealer/cmd/cluster/delete.go` (modified, +14/-4)
```diff
@@ -120,7 +120,7 @@ func deleteCluster(workClusterfile string, forceDelete bool, deleteFlags *types.
 	cf.SetCluster(cluster)
 
 	if !forceDelete {
-		if err = confirmDeleteHosts(fmt.Sprintf("%s/%s", common.MASTER, common.NODE), cluster.GetAllIPList()); err != nil {
+		if err = confirmDeleteHosts(cluster.GetMasterIPList(), cluster.GetNodeIPList()); err != nil {
 			return err
 		}
 	}
@@ -213,7 +213,7 @@ func scaleDownCluster(workClusterfile, masters, workers string, forceDelete bool
 	}
 
 	if !forceDelete {
-		if err = confirmDeleteHosts(fmt.Sprintf("%s/%s", common.MASTER, common.NODE), append(deleteMasterIPList, deleteNodeIPList...)); err != nil {
+		if err = confirmDeleteHosts(deleteMasterIPList, deleteNodeIPList); err != nil {
 			return err
 		}
 	}
@@ -248,8 +248,18 @@ func scaleDownCluster(workClusterfile, masters, workers string, forceDelete bool
 	})
 }
 
-func confirmDeleteHosts(role string, hostsToDelete []net.IP) error {
-	if pass, err := utils.ConfirmOperation(fmt.Sprintf("Are you sure to delete these %s: %v? ", role, hostsToDelete)); err != nil {
+func confirmDeleteHosts(masterToDelete, nodeToDelete []net.IP) error {
+	prompt := "Are you sure to delete:"
+
+	if len(masterToDelete) != 0 {
+		prompt = fmt.Sprintf("%s %s %v", prompt, common.MASTER, masterToDelete)
+	}
+
+	if len(nodeToDelete) != 0 {
+		prompt = fmt.Sprintf("%s %s %v", prompt, common.NODE, nodeToDelete)
+	}
+
+	if pass, err := utils.ConfirmOperation(prompt); err != nil {
 		return err
 	} else if !pass {
 		return fmt.Errorf("exit the operation of delete these nodes")
```

**File**: `cmd/sealer/cmd/utils/cluster.go` (modified, +4/-0)
```diff
@@ -130,6 +130,10 @@ func ConstructClusterForScaleUp(cluster *v2.Cluster, scaleFlags *types.ScaleUpFl
 	mj, _ = strUtils.Diff(currentNodes, joinMasters)
 	nj, _ = strUtils.Diff(currentNodes, joinWorkers)
 
+	if len(mj) == 0 && len(nj) == 0 {
+		return nil, nil, fmt.Errorf("scale ip %v is already in the current cluster %v", append(joinMasters, joinWorkers...), currentNodes)
+	}
+
 	nodes := cluster.GetAllIPList()
 	//TODO Add password encryption mode in the future
 	//add joined masters
```

---

### Incident Patch 9: `9b08d0c1` (2023-06-05)
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

### Incident Patch 10: `150c4cba` (2023-05-06)
**Commit Message**: fix: should replace all LF string (#2211)

Signed-off-by: Cluas <[REDACTED_EMAIL]>

**File**: `utils/ssh/sshcmd.go` (modified, +1/-0)
```diff
@@ -162,6 +162,7 @@ func (s *SSH) CmdToString(host net.IP, env map[string]string, cmd, split string)
 		return str, err
 	}
 	if data != nil {
+		str = strings.ReplaceAll(str, "\r", split)
 		str = strings.ReplaceAll(str, "\r\n", split)
 		str = strings.ReplaceAll(str, "\n", split)
 		return str, nil
```

---

### Incident Patch 11: `3b56cc07` (2023-04-27)
**Commit Message**: bugfix: e2e test can not delete conatiner infra (#2206)

Signed-off-by: kakzhou719 <[REDACTED_EMAIL]>

**File**: `.github/workflows/e2e-test-apply.yml` (modified, +1/-1)
```diff
@@ -115,4 +115,4 @@ jobs:
         with:
           sha: ${{ steps.comment-branch.outputs.head_sha }}
           token: ${{ secrets.GITHUB_TOKEN }}
-          status: ${{ job.status }}
+          status: ${{ job.status }}
\ No newline at end of file
```

**File**: `pkg/infra/container/container.go` (modified, +4/-19)
```diff
@@ -21,15 +21,12 @@ import (
 	"strconv"
 	"time"
 
-	"github.com/docker/docker/api/types/mount"
-	"github.com/sirupsen/logrus"
-
-	"github.com/sealerio/sealer/common"
 	"github.com/sealerio/sealer/pkg/infra/container/client"
 	"github.com/sealerio/sealer/pkg/infra/container/client/docker"
 	v1 "github.com/sealerio/sealer/types/api/v1"
 	osi "github.com/sealerio/sealer/utils/os"
 	"github.com/sealerio/sealer/utils/ssh"
+	"github.com/sirupsen/logrus"
 )
 
 const (
@@ -212,16 +209,6 @@ func (a *ApplyProvider) applyToJoin(toJoinNumber int, role string) ([]net.IP, er
 		}
 		if len(a.Cluster.Spec.Masters.IPList) == 0 && i == 0 {
 			opts.ContainerLabel[RoleLabelMaster] = "true"
-			sealerMount := mount.Mount{
-				Type:     mount.TypeBind,
-				Source:   SealerImageRootPath,
-				Target:   SealerImageRootPath,
-				ReadOnly: false,
-				BindOptions: &mount.BindOptions{
-					Propagation: mount.PropagationRPrivate,
-				},
-			}
-			opts.Mount = append(opts.Mount, sealerMount)
 		}
 
 		containerID, err := a.Provider.RunContainer(opts)
@@ -286,9 +273,7 @@ func (a *ApplyProvider) applyToDelete(deleteIPList []net.IP) error {
 }
 
 func (a *ApplyProvider) CleanUp() error {
-	/*	a,clean up container,cleanup image,clean up network
-		b,rm -rf /var/lib/sealer/data/my-cluster
-	*/
+	//clean up container,cleanup image,clean up network
 	var iplist []net.IP
 	iplist = append(iplist, a.Cluster.Spec.Masters.IPList...)
 	iplist = append(iplist, a.Cluster.Spec.Nodes.IPList...)
@@ -302,11 +287,11 @@ func (a *ApplyProvider) CleanUp() error {
 		if err != nil {
 			// log it
 			logrus.Infof("failed to delete container:%s", id)
+			return err
 		}
-		continue
 	}
 
-	return os.RemoveAll(common.DefaultClusterBaseDir(a.Cluster.Name))
+	return nil
 }
 
 func NewClientWithCluster(cluster *v1.Cluster) (*ApplyProvider, error) {
```

---

### Incident Patch 12: `cb64183e` (2023-04-26)
**Commit Message**: Nominate Yuxing Liu as a maintainer. (#2199)

Signed-off-by: huaiyou <[REDACTED_EMAIL]>

**File**: `MAINTAINERS.md` (modified, +1/-0)
```diff
@@ -10,3 +10,4 @@
 |Jiangnan Bao|ZheJiang University|[justadogistaken](https://github.com/justadogistaken)|baojn1998@163.com|
 |Xun Wang|ZhengcaiCloud|[lllwan](https://github.com/lllwan)|lllwan@vip.qq.com|
 |Vince Cui|Alibaba Group|[vincecui](https://github.com/vincecui)|huaiyou.cyz@alibaba-inc.com|
+|Yuxing Liu|Alibaba Group|[Starnop](https://github.com/Starnop)|starnop@163.com|
```

---

### Incident Patch 13: `e96414dc` (2023-04-18)
**Commit Message**: feat: add app env render (#2140)

**File**: `pkg/application/files.go` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
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
+	"bytes"
+	"fmt"
+	"os"
+	"path/filepath"
+
+	"github.com/imdario/mergo"
+	"github.com/sealerio/sealer/pkg/env"
+	v2 "github.com/sealerio/sealer/types/api/v2"
+	osUtils "github.com/sealerio/sealer/utils/os"
+	"gopkg.in/yaml.v3"
+)
+
+func newFileProcessor(appFile v2.AppFile) (FileProcessor, error) {
+	switch appFile.Strategy {
+	case v2.OverWriteStrategy:
+		return overWriteProcessor{appFile}, nil
+	case v2.MergeStrategy:
+		return mergeProcessor{appFile}, nil
+	}
+
+	return nil, fmt.Errorf("failed to init fileProcessor,%s is not register", appFile.Strategy)
+}
+
+// overWriteProcessor :this will overwrite the FilePath with the Values.
+type overWriteProcessor struct {
+	v2.AppFile
+}
+
+func (r overWriteProcessor) Process(appRoot string) error {
+	target := filepath.Join(appRoot, r.Path)
+
+	err := osUtils.NewCommonWriter(target).WriteFile([]byte(r.Data))
+	if err != nil {
+		return fmt.Errorf("failed to write to file %s with raw mode: %v", target, err)
+	}
+	return nil
+}
+
+// mergeProcessor :this will merge the FilePath with the Values.
+//Only files in yaml format are supported.
+//if Strategy is "merge" will deeply merge each yaml file section.
+type mergeProcessor struct {
+	v2.AppFile
+}
+
+func (m mergeProcessor) Process(appRoot string) error {
+	var (
+		result     [][]byte
+		srcDataMap = make(map[string]interface{})
+	)
+
+	err := yaml.Unmarshal([]byte(m.Data), &srcDataMap)
+	if err != nil {
+		return fmt.Errorf("failed to load config data: %v", err)
+	}
+
+	target := filepath.Join(appRoot, m.Path)
+	contents, err := os.ReadFile(filepath.Clean(target))
+	if err != nil {
+		return err
+	}
+
+	for _, section := range bytes.Split(contents, []byte("---\n")) {
+		destDataMap := make(map[string]interface{})
+
+		err = yaml.Unmarshal(section, &destDataMap)
+		if err != nil {
+			return fmt.Errorf("failed to unmarshal config data: %v", err)
+		}
+
+		err = mergo.Merge(&destDataMap, &srcDataMap, mergo.WithOverride)
+		if err != nil {
+			return fmt.Errorf("failed to merge config: %v", err)
+		}
+
+		out, err := yaml.Marshal(destDataMap)
+		if err != nil {
+			return err
+		}
+
+		result = append(result, out)
+	}
+
+	err = osUtils.NewCommonWriter(target).WriteFile(bytes.Join(result, []byte("---\n")))
+	if err != nil {
+		return fmt.Errorf("failed to write to file %s with raw mode: %v", target, err)
+	}
+	return nil
+}
+
+//envRender :this will render the FilePath with the Values.
+type envRender struct {
+	envData map[string]string
+}
+
+func (e envRender) Process(appRoot string) error {
+	if len(e.envData) == 0 {
+		return nil
+	}
+
+	return env.RenderTemplate(appRoot, e.envData)
+}
```

**File**: `pkg/application/v2app.go` (modified, +12/-118)
```diff
@@ -15,25 +15,21 @@
 package application
 
 import (
-	"bytes"
 	"encoding/json"
 	"fmt"
 	"os"
 	"path/filepath"
 	"strings"
 	"syscall"
 
-	"github.com/imdario/mergo"
 	"github.com/sealerio/sealer/common"
 	v1 "github.com/sealerio/sealer/pkg/define/application/v1"
 	imagev1 "github.com/sealerio/sealer/pkg/define/image/v1"
 	"github.com/sealerio/sealer/pkg/infradriver"
 	"github.com/sealerio/sealer/pkg/rootfs"
 	v2 "github.com/sealerio/sealer/types/api/v2"
-	osUtils "github.com/sealerio/sealer/utils/os"
 	strUtils "github.com/sealerio/sealer/utils/strings"
 	"github.com/sirupsen/logrus"
-	"gopkg.in/yaml.v3"
 )
 
 type v2Application struct {
@@ -58,6 +54,9 @@ type v2Application struct {
 	// appRootMap contains the whole app root with app name as its key.
 	appRootMap map[string]string
 
+	// appEnvMap contains the whole app env with app name as its key.
+	appEnvMap map[string]map[string]string
+
 	// appFileProcessorMap contains the whole FileProcessors with app name as its key.
 	appFileProcessorMap map[string][]FileProcessor
 }
@@ -167,6 +166,7 @@ func NewV2Application(app *v2.Application, extension imagev1.ImageExtension) (In
 		globalCmds:          extension.Launch.Cmds,
 		appLaunchCmdsMap:    map[string][]string{},
 		appRootMap:          map[string]string{},
+		appEnvMap:           map[string]map[string]string{},
 		appFileProcessorMap: map[string][]FileProcessor{},
 	}
 
@@ -238,8 +238,15 @@ func NewV2Application(app *v2.Application, extension imagev1.ImageExtension) (In
 			v2App.appLaunchCmdsMap[name] = launchCmds
 		}
 
-		// initialize app files
+		// add app env
+		v2App.appEnvMap[name] = strUtils.ConvertStringSliceToMap(config.Env)
+
+		// initialize app FileProcessors
 		var fileProcessors []FileProcessor
+		if len(v2App.appEnvMap[name]) > 0 {
+			fileProcessors = append(fileProcessors, envRender{envData: v2App.appEnvMap[name]})
+		}
+
 		for _, appFile := range config.Files {
 			fp, err := newFileProcessor(appFile)
 			if err != nil {
@@ -273,116 +280,3 @@ func makeItDir(str string) string {
 	}
 	return str
 }
-
-func newFileProcessor(appFile v2.AppFile) (FileProcessor, error) {
-	switch appFile.Strategy {
-	case v2.OverWriteStrategy:
-		return overWriteProcessor{appFile}, nil
-	case v2.MergeStrategy:
-		return mergeProcessor{appFile}, nil
-	}
-
-	return nil, fmt.Errorf("failed to init fileProcessor,%s is not register", appFile.Strategy)
-}
-
-// overWriteProcessor :this will overwrite the FilePath with the Values.
-type overWriteProcessor struct {
-	v2.AppFile
-}
-
-func (r overWriteProcessor) Process(appRoot string) error {
-	target := filepath.Join(appRoot, r.Path)
-
-	err := osUtils.NewCommonWriter(target).WriteFile([]byte(r.Data))
-	if err != nil {
-		return fmt.Errorf("failed to write to file %s with raw mode: %v", target, err)
-	}
-	return nil
-}
-
-// mergeProcessor :this will merge the FilePath with the Values.
-//Only files in yaml format are supported.
-//if Strategy is "merge" will deeply merge each yaml file section.
-type mergeProcessor struct {
-	v2.AppFile
-}
-
-func (m mergeProcessor) Process(appRoot string) error {
-	var (
-		result     [][]byte
-		srcDataMap = make(map[string]interface{})
-	)
-
-	err := yaml.Unmarshal([]byte(m.Data), &srcDataMap)
-	if err != nil {
-		return fmt.Errorf("failed to load config data: %v", err)
-	}
-
-	target := filepath.Join(appRoot, m.Path)
-	contents, err := os.ReadFile(filepath.Clean(target))
-	if err != nil {
-		return err
-	}
-
-	for _, section := range bytes.Split(contents, []byte("---\n")) {
-		destDataMap := make(map[string]interface{})
-
-		err = yaml.Unmarshal(section, &destDataMap)
-		if err != nil {
-			return fmt.Errorf("failed to unmarshal config data: %v", err)
-		}
-
-		err = mergo.Merge(&destDataMap, &srcDataMap, mergo.WithOverride)
-		if err != nil {
-			return fmt.Errorf("failed to merge config: %v", err)
-		}
-
-		out, err := yaml.Marshal(destDataMap)
-		if err != nil {
-			return err
-		}
-
-		result = append(result, out)
-	}
-
-	err = osUtils.NewCommonWriter(target).WriteFile(bytes.Join(result, []byte("---\n")))
-	if err != nil {
-		return fmt.Errorf("failed to write to file %s with raw mode: %v", target, err)
-	}
-	return nil
-}
-
-// renderProcessor : this will render the FilePath with the Values.
-//type renderProcessor struct {
-//	v2.AppFile
-//}
-
-//const templateSuffix = ".tmpl"
-
-//func (a renderProcessor) Process(appRoot string) error {
-//	target := filepath.Join(appRoot, a.Path)
-//
-//	if !strings.HasSuffix(a.Path, templateSuffix) {
-//		return nil
-//	}
-//
-//	writer, err := os.OpenFile(filepath.Clean(strings.TrimSuffix(target, templateSuffix)), os.O_CREATE|os.O_RDWR, os.ModePerm)
-//	if err != nil {
-//		return fmt.Errorf("failed to open file [%s] when render args: %v", target, err)
-//	}
-//
-//	defer func() {
-//		_ = writer.Close()
-//	}()
-//
-//	t, err := template.New(a.Path).ParseFiles(target)
-//	if err != nil {
-//		return fmt.Errorf("failed to create template(%s): %v", target, err)
-//	}
-//
-
```

**File**: `pkg/infradriver/ssh_infradriver.go` (modified, +2/-26)
```diff
@@ -26,6 +26,7 @@ import (
 	"github.com/sealerio/sealer/common"
 	v1 "github.com/sealerio/sealer/types/api/v1"
 	v2 "github.com/sealerio/sealer/types/api/v2"
+	mapUtils "github.com/sealerio/sealer/utils/maps"
 	"github.com/sealerio/sealer/utils/shellcommand"
 	"github.com/sealerio/sealer/utils/ssh"
 	strUtil "github.com/sealerio/sealer/utils/strings"
@@ -46,19 +47,6 @@ type SSHInfraDriver struct {
 	cluster      v2.Cluster
 }
 
-func mergeList(hostEnv, globalEnv map[string]string) map[string]string {
-	if len(hostEnv) == 0 {
-		return copyEnv(globalEnv)
-	}
-	for globalEnvKey, globalEnvValue := range globalEnv {
-		if _, ok := hostEnv[globalEnvKey]; ok {
-			continue
-		}
-		hostEnv[globalEnvKey] = globalEnvValue
-	}
-	return hostEnv
-}
-
 func convertTaints(taints []string) ([]k8sv1.Taint, error) {
 	var k8staints []k8sv1.Taint
 	for _, taint := range taints {
@@ -71,18 +59,6 @@ func convertTaints(taints []string) ([]k8sv1.Taint, error) {
 	return k8staints, nil
 }
 
-func copyEnv(origin map[string]string) map[string]string {
-	if origin == nil {
-		return nil
-	}
-	ret := make(map[string]string, len(origin))
-	for k, v := range origin {
-		ret[k] = v
-	}
-
-	return ret
-}
-
 // NewInfraDriver will create a new Infra driver, and if extraEnv specified, it will set env not exist in Cluster
 func NewInfraDriver(cluster *v2.Cluster) (InfraDriver, error) {
 	var err error
@@ -148,7 +124,7 @@ func NewInfraDriver(cluster *v2.Cluster) (InfraDriver, error) {
 	// merge the host ENV and global env, the host env will overwrite cluster.Spec.Env
 	for _, host := range cluster.Spec.Hosts {
 		for _, ip := range host.IPS {
-			ret.hostEnvMap[ip.String()] = mergeList(strUtil.ConvertStringSliceToMap(host.Env), ret.clusterEnv)
+			ret.hostEnvMap[ip.String()] = mapUtils.Merge(strUtil.ConvertStringSliceToMap(host.Env), ret.clusterEnv)
 			ret.hostLabels[ip.String()] = host.Labels
 		}
 	}
```

**File**: `types/api/v2/application_types.go` (modified, +7/-2)
```diff
@@ -43,6 +43,13 @@ type ApplicationConfig struct {
 	// the AppName
 	Name string `json:"name,omitempty"`
 
+	// Env is a set of key value pair.
+	// it is app level, only this app will be aware of its existence,
+	// it is used to render app files, or as an environment variable for app startup and deletion commands
+	// it takes precedence over ApplicationSpec.Env.
+	Env []string `json:"env,omitempty"`
+
+	//Files indicates that how to modify the specific app files.
 	Files []AppFile `json:"files,omitempty"`
 
 	// app Launch customization
@@ -57,7 +64,6 @@ type Strategy string
 const (
 	OverWriteStrategy Strategy = "overwrite"
 	MergeStrategy     Strategy = "merge"
-	RenderStrategy    Strategy = "render"
 )
 
 type AppFile struct {
@@ -69,7 +75,6 @@ type AppFile struct {
 
 	// Enumeration value is "merge", "overwrite", "render". default value is "overwrite".
 	// OverWriteStrategy : this will overwrite the FilePath with the Data.
-	// RenderStrategy: this will render the FilePath with the Data.
 	// MergeStrategy: this will merge the FilePath with the Data, and only yaml files format are supported
 	Strategy Strategy `json:"strategy,omitempty"`
 
```

**File**: `utils/maps/maps.go` (modified, +26/-11)
```diff
@@ -14,17 +14,6 @@
 
 package maps
 
-// Merge :merge map type as overwrite model
-func Merge(ms ...map[string]string) map[string]string {
-	res := map[string]string{}
-	for _, m := range ms {
-		for k, v := range m {
-			res[k] = v
-		}
-	}
-	return res
-}
-
 // ConvertToSlice Use the equal sign to link key and value looks like key1=value1,key2=value2.
 func ConvertToSlice(m map[string]string) []string {
 	result := []string{}
@@ -33,3 +22,29 @@ func ConvertToSlice(m map[string]string) []string {
 	}
 	return result
 }
+
+// Merge :get all elements, only insert key which is not in dst form src.
+func Merge(dst, src map[string]string) map[string]string {
+	if len(dst) == 0 {
+		return Copy(src)
+	}
+	for srcEnvKey, srcEnvValue := range src {
+		if _, ok := dst[srcEnvKey]; ok {
+			continue
+		}
+		dst[srcEnvKey] = srcEnvValue
+	}
+	return dst
+}
+
+func Copy(origin map[string]string) map[string]string {
+	if origin == nil {
+		return nil
+	}
+	ret := make(map[string]string, len(origin))
+	for k, v := range origin {
+		ret[k] = v
+	}
+
+	return ret
+}
```

**File**: `utils/maps/maps_test.go` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
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
+package maps
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func Test_Merge(t *testing.T) {
+	src := map[string]string{
+		"key1":    "src1",
+		"key2":    "src2",
+		"key3":    "src3",
+		"src-key": "src-value",
+	}
+
+	dst := map[string]string{
+		"key1":    "v1",
+		"key2":    "v2",
+		"key3":    "v3",
+		"dst-key": "dst-value",
+	}
+
+	result := map[string]string{
+		"key1":    "v1",
+		"key2":    "v2",
+		"key3":    "v3",
+		"dst-key": "dst-value",
+		"src-key": "src-value",
+	}
+
+	nilDst := make(map[string]string)
+
+	type args struct {
+		src    map[string]string
+		dst    map[string]string
+		wanted map[string]string
+	}
+
+	var tests = []struct {
+		name string
+		args args
+	}{
+		{
+			name: "nil dst want get src as result",
+			args: args{
+				src:    src,
+				dst:    nilDst,
+				wanted: src,
+			},
+		},
+		{
+			name: "not nil dst want get overwriting dst with src as result",
+			args: args{
+				src:    src,
+				dst:    dst,
+				wanted: result,
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.args.wanted, Merge(tt.args.dst, tt.args.src))
+		})
+	}
+}
+
+func Test_Copy(t *testing.T) {
+	src := map[string]string{
+		"key1":    "v1",
+		"key2":    "v2",
+		"key3":    "v3",
+		"dst-key": "dst-value",
+		"src-key": "src-value",
+	}
+
+	result := map[string]string{
+		"key1":    "v1",
+		"key2":    "v2",
+		"key3":    "v3",
+		"dst-key": "dst-value",
+		"src-key": "src-value",
+	}
+
+	type args struct {
+		src    map[string]string
+		wanted map[string]string
+	}
+
+	var tests = []struct {
+		name string
+		args args
+	}{
+		{
+			name: "nil src want get nil result",
+			args: args{
+				src:    nil,
+				wanted: nil,
+			},
+		},
+		{
+			name: "not nil src want same src as result",
+			args: args{
+				src:    src,
+				wanted: result,
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.args.wanted, Copy(tt.args.src))
+		})
+	}
+}
```

---

### Incident Patch 14: `c268bc28` (2023-04-11)
**Commit Message**: fix env bug (#2177)

Signed-off-by: wb-lyk925458 <[REDACTED_EMAIL]>
Co-authored-by: wb-lyk925458 <[REDACTED_EMAIL]>

**File**: `pkg/clusterfile/decoder.go` (modified, +2/-2)
```diff
@@ -230,8 +230,8 @@ func checkAndFillCluster(cluster *v2.Cluster) error {
 	cluster.Spec.Env = newEnv
 
 	clusterEnvMap := strUtil.ConvertStringSliceToMap(cluster.Spec.Env)
-	if svcCIDR, ok := clusterEnvMap[common.EnvSvcCIDR]; ok && svcCIDR != nil {
-		cidrs := strings.Split(svcCIDR.(string), ",")
+	if svcCIDR, ok := clusterEnvMap[common.EnvSvcCIDR]; ok && svcCIDR != "" {
+		cidrs := strings.Split(svcCIDR, ",")
 		_, cidr, err := net.ParseCIDR(cidrs[0])
 		if err != nil {
 			return fmt.Errorf("failed to parse svc CIDR: %v", err)
```

**File**: `pkg/container-runtime/default.go` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ import (
 
 type DefaultInstaller struct {
 	Info
-	envs   map[string]interface{}
+	envs   map[string]string
 	rootfs string
 	driver infradriver.InfraDriver
 }
```

**File**: `pkg/container-runtime/installer.go` (modified, +4/-4)
```diff
@@ -72,8 +72,8 @@ func NewInstaller(conf v2.ContainerRuntimeConfig, driver infradriver.InfraDriver
 			},
 		}
 		ret.Info.CgroupDriver = DefaultCgroupDriver
-		if cd, ok := ret.envs[CgroupDriverArg]; ok && cd != nil {
-			ret.Info.CgroupDriver = cd.(string)
+		if cd, ok := ret.envs[CgroupDriverArg]; ok && cd != "" {
+			ret.Info.CgroupDriver = cd
 		}
 
 		return ret, nil
@@ -89,8 +89,8 @@ func NewInstaller(conf v2.ContainerRuntimeConfig, driver infradriver.InfraDriver
 			},
 		}
 		ret.Info.CgroupDriver = DefaultCgroupDriver
-		if cd, ok := ret.envs[CgroupDriverArg]; ok && cd != nil {
-			ret.Info.CgroupDriver = cd.(string)
+		if cd, ok := ret.envs[CgroupDriverArg]; ok && cd != "" {
+			ret.Info.CgroupDriver = cd
 		}
 
 		return ret, nil
```

**File**: `pkg/env/env.go` (modified, +4/-9)
```diff
@@ -40,7 +40,7 @@ func base64decode(v string) string {
 
 // RenderTemplate :using renderData got from clusterfile to render all the files in dir with ".tmpl" as suffix.
 // The scope of renderData comes from cluster.spec.env
-func RenderTemplate(dir string, renderData map[string]interface{}) error {
+func RenderTemplate(dir string, renderData map[string]string) error {
 	return filepath.Walk(dir, func(path string, info os.FileInfo, errIn error) error {
 		if errIn != nil {
 			return errIn
@@ -75,7 +75,7 @@ func RenderTemplate(dir string, renderData map[string]interface{}) error {
 // Output shell: DATADISK=/data cat /etc/hosts
 // it is convenient for user to get env in scripts
 // The scope of env comes from cluster.spec.env and host.env
-func WrapperShell(shell string, wrapperData map[string]interface{}) string {
+func WrapperShell(shell string, wrapperData map[string]string) string {
 	env := getEnvFromData(wrapperData)
 
 	if len(env) == 0 {
@@ -84,15 +84,10 @@ func WrapperShell(shell string, wrapperData map[string]interface{}) string {
 	return fmt.Sprintf("%s %s", strings.Join(env, " "), shell)
 }
 
-func getEnvFromData(wrapperData map[string]interface{}) []string {
+func getEnvFromData(wrapperData map[string]string) []string {
 	var env []string
 	for k, v := range wrapperData {
-		switch value := v.(type) {
-		case []string:
-			env = append(env, fmt.Sprintf("export %s=(%s);", k, strings.Join(value, " ")))
-		case string:
-			env = append(env, fmt.Sprintf("export %s=\"%s\";", k, value))
-		}
+		env = append(env, fmt.Sprintf("export %s=\"%s\";", k, v))
 	}
 	sort.Strings(env)
 	return env
```

**File**: `pkg/env/env_test.go` (modified, +4/-4)
```diff
@@ -20,7 +20,7 @@ import (
 
 func Test_processor_WrapperShell(t *testing.T) {
 	type args struct {
-		wrapperData map[string]interface{}
+		wrapperData map[string]string
 		shell       string
 	}
 	tests := []struct {
@@ -31,7 +31,7 @@ func Test_processor_WrapperShell(t *testing.T) {
 		{
 			"test WrapperShell ",
 			args{
-				wrapperData: map[string]interface{}{
+				wrapperData: map[string]string{
 					"foo": "bar",
 					"IP":  "127.0.0.1",
 				},
@@ -51,7 +51,7 @@ func Test_processor_WrapperShell(t *testing.T) {
 
 func Test_processor_RenderAll(t *testing.T) {
 	type args struct {
-		renderData map[string]interface{}
+		renderData map[string]string
 		dir        string
 	}
 	tests := []struct {
@@ -62,7 +62,7 @@ func Test_processor_RenderAll(t *testing.T) {
 		{
 			"test render dir",
 			args{
-				renderData: map[string]interface{}{
+				renderData: map[string]string{
 					"PodCIDR": "100.64.0.0/10",
 					"SvcCIDR": "10.96.0.0/16",
 				},
```

**File**: `pkg/infradriver/infradriver.go` (modified, +5/-5)
```diff
@@ -38,13 +38,13 @@ type InfraDriver interface {
 	GetHostsPlatform(hosts []net.IP) (map[v1.Platform][]net.IP, error)
 
 	//GetHostEnv return merged env with host env and cluster env.
-	GetHostEnv(host net.IP) map[string]interface{}
+	GetHostEnv(host net.IP) map[string]string
 
 	//GetHostLabels return host labels.
 	GetHostLabels(host net.IP) map[string]string
 
 	//GetClusterEnv return cluster.spec.env as map[string]interface{}
-	GetClusterEnv() map[string]interface{}
+	GetClusterEnv() map[string]string
 
 	AddClusterEnv(envs []string)
 
@@ -76,11 +76,11 @@ type InfraDriver interface {
 	// CopyR copy remote host files to localhost
 	CopyR(host net.IP, remoteFilePath, localFilePath string) error
 	// CmdAsync exec command on remote host, and asynchronous return logs
-	CmdAsync(host net.IP, env map[string]interface{}, cmd ...string) error
+	CmdAsync(host net.IP, env map[string]string, cmd ...string) error
 	// Cmd exec command on remote host, and return combined standard output and standard error
-	Cmd(host net.IP, env map[string]interface{}, cmd string) ([]byte, error)
+	Cmd(host net.IP, env map[string]string, cmd string) ([]byte, error)
 	// CmdToString exec command on remote host, and return spilt standard output and standard error
-	CmdToString(host net.IP, env map[string]interface{}, cmd, spilt string) (string, error)
+	CmdToString(host net.IP, env map[string]string, cmd, spilt string) (string, error)
 
 	// IsFileExist check remote file exist or not
 	IsFileExist(host net.IP, remoteFilePath string) (bool, error)
```

**File**: `pkg/infradriver/ssh_infradriver.go` (modified, +11/-11)
```diff
@@ -41,12 +41,12 @@ type SSHInfraDriver struct {
 	hostRolesMap map[string][]string
 	roleHostsMap map[string][]net.IP
 	hostLabels   map[string]map[string]string
-	hostEnvMap   map[string]map[string]interface{}
-	clusterEnv   map[string]interface{}
+	hostEnvMap   map[string]map[string]string
+	clusterEnv   map[string]string
 	cluster      v2.Cluster
 }
 
-func mergeList(hostEnv, globalEnv map[string]interface{}) map[string]interface{} {
+func mergeList(hostEnv, globalEnv map[string]string) map[string]string {
 	if len(hostEnv) == 0 {
 		return copyEnv(globalEnv)
 	}
@@ -71,11 +71,11 @@ func convertTaints(taints []string) ([]k8sv1.Taint, error) {
 	return k8staints, nil
 }
 
-func copyEnv(origin map[string]interface{}) map[string]interface{} {
+func copyEnv(origin map[string]string) map[string]string {
 	if origin == nil {
 		return nil
 	}
-	ret := make(map[string]interface{}, len(origin))
+	ret := make(map[string]string, len(origin))
 	for k, v := range origin {
 		ret[k] = v
 	}
@@ -92,7 +92,7 @@ func NewInfraDriver(cluster *v2.Cluster) (InfraDriver, error) {
 		roleHostsMap: map[string][]net.IP{},
 		hostRolesMap: map[string][]string{},
 		// todo need to separate env into app render data and sys render data
-		hostEnvMap: map[string]map[string]interface{}{},
+		hostEnvMap: map[string]map[string]string{},
 		hostLabels: map[string]map[string]string{},
 		hostTaint:  map[string][]k8sv1.Taint{},
 	}
@@ -177,7 +177,7 @@ func (d *SSHInfraDriver) GetRoleListByHostIP(ip string) []string {
 	return d.hostRolesMap[ip]
 }
 
-func (d *SSHInfraDriver) GetHostEnv(host net.IP) map[string]interface{} {
+func (d *SSHInfraDriver) GetHostEnv(host net.IP) map[string]string {
 	// Set env for each host
 	hostEnv := d.hostEnvMap[host.String()]
 	if _, ok := hostEnv[common.EnvHostIP]; !ok {
@@ -190,7 +190,7 @@ func (d *SSHInfraDriver) GetHostLabels(host net.IP) map[string]string {
 	return d.hostLabels[host.String()]
 }
 
-func (d *SSHInfraDriver) GetClusterEnv() map[string]interface{} {
+func (d *SSHInfraDriver) GetClusterEnv() map[string]string {
 	return d.clusterEnv
 }
 
@@ -225,23 +225,23 @@ func (d *SSHInfraDriver) CopyR(host net.IP, remoteFilePath, localFilePath string
 	return client.CopyR(host, localFilePath, remoteFilePath)
 }
 
-func (d *SSHInfraDriver) CmdAsync(host net.IP, env map[string]interface{}, cmd ...string) error {
+func (d *SSHInfraDriver) CmdAsync(host net.IP, env map[string]string, cmd ...string) error {
 	client := d.sshConfigs[host.String()]
 	if client == nil {
 		return fmt.Errorf("ip(%s) is not in cluster", host.String())
 	}
 	return client.CmdAsync(host, env, cmd...)
 }
 
-func (d *SSHInfraDriver) Cmd(host net.IP, env map[string]interface{}, cmd string) ([]byte, error) {
+func (d *SSHInfraDriver) Cmd(host net.IP, env map[string]string, cmd string) ([]byte, error) {
 	client := d.sshConfigs[host.String()]
 	if client == nil {
 		return nil, fmt.Errorf("ip(%s) is not in cluster", host.String())
 	}
 	return client.Cmd(host, env, cmd)
 }
 
-func (d *SSHInfraDriver) CmdToString(host net.IP, env map[string]interface{}, cmd, spilt string) (string, error) {
+func (d *SSHInfraDriver) CmdToString(host net.IP, env map[string]string, cmd, spilt string) (string, error) {
 	client := d.sshConfigs[host.String()]
 	if client == nil {
 		return "", fmt.Errorf("ip(%s) is not in cluster", host.String())
```

**File**: `pkg/infradriver/ssh_infradriver_test.go` (modified, +7/-7)
```diff
@@ -28,7 +28,7 @@ func getDefaultCluster() (InfraDriver, error) {
 	cluster := &v2.Cluster{
 		Spec: v2.ClusterSpec{
 			Image: "kubernetes:v1.19.8",
-			Env:   []string{"key1=value1", "key2=value2;value3"},
+			Env:   []string{"key1=value1", "key2=value2, value3"},
 			SSH: v1.SSH{
 				User:     "root",
 				Passwd:   "test123",
@@ -86,22 +86,22 @@ func TestSSHInfraDriver_GetClusterInfo(t *testing.T) {
 		net.IPv4(192, 168, 0, 3),
 	})
 
-	assert.Equal(t, driver.GetClusterEnv(), map[string]interface{}{
+	assert.Equal(t, driver.GetClusterEnv(), map[string]string{
 		"key1": "value1",
-		"key2": []string{"value2", "value3"},
+		"key2": "value2, value3",
 	})
 
-	assert.Equal(t, map[string]interface{}{
+	assert.Equal(t, map[string]string{
 		"HostIP":   "192.168.0.2",
 		"key1":     "value1",
-		"key2":     []string{"value2", "value3"},
+		"key2":     "value2, value3",
 		"etcd-dir": "/data/etcd",
 	}, driver.GetHostEnv(net.IPv4(192, 168, 0, 2)))
 
-	assert.Equal(t, driver.GetHostEnv(net.IPv4(192, 168, 0, 3)), map[string]interface{}{
+	assert.Equal(t, driver.GetHostEnv(net.IPv4(192, 168, 0, 3)), map[string]string{
 		"HostIP":            "192.168.0.3",
 		"key1":              "value1",
-		"key2":              []string{"value2", "value3"},
+		"key2":              "value2, value3",
 		"test_node_env_key": "test_node_env_value",
 	})
 }
```

---

### Incident Patch 15: `70bb9ffc` (2023-04-10)
**Commit Message**: bugfix: use os.Create to write files (#2175)

**File**: `pkg/env/env.go` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ func RenderTemplate(dir string, renderData map[string]interface{}) error {
 		if info.IsDir() || !strings.HasSuffix(info.Name(), templateSuffix) {
 			return nil
 		}
-		writer, err := os.OpenFile(strings.TrimSuffix(path, templateSuffix), os.O_CREATE|os.O_RDWR, os.ModePerm)
+		writer, err := os.Create(strings.TrimSuffix(path, templateSuffix))
 		if err != nil {
 			return fmt.Errorf("failed to open file [%s] when render env: %v", path, err)
 		}
```

#### Recent Merged Pull Requests:
- **PR #2322** (2024-05-07): fix multi-document yaml reading errors (@maxwell-can-not-fly)
- **PR #2314** (closed): Update kubeadm default config  (@clcc2019)
- **PR #2312** (2023-10-26): Bumped the version of golangci-lint (@dynos01)
- **PR #2311** (2023-10-25): chore: fix golang ci lint error (@starnop)
- **PR #2309** (2023-10-23): Update gosec.yml (@VinceCui)
- **PR #2304** (2023-10-31): feat: add create etcd cluster and weed cluster function (@sjcsjc123)
- **PR #2303** (2023-10-27): Added initial support for P2P-based image distribution (@dynos01)
- **PR #2279** (2023-07-17): revert dependabot (@kakaZhou719)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
