# Forensic Learning Record (Deep Inspection): httprunner/httprunner

> **Canonical Artifact**: `07_PROJECT_LEARNING/httprunner-httprunner-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/httprunner/httprunner](https://github.com/httprunner/httprunner))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:53:22.928Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `httprunner/httprunner`
- **Description**: HttpRunner 是一款开源的 API/UI 测试框架，简单易用，功能强大，具有丰富的插件化机制和高度的可扩展能力。
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 4296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/adb/devices.go`
```
package adb

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/sdk"
	"github.com/httprunner/httprunner/v5/pkg/gadb"
)

var listAndroidDevicesCmd = &cobra.Command{
	Use:   "devices",
	Short: "List all Android devices",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_adb_devices", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()

		deviceList, err := getAndroidDevices()
		if err != nil {
			fmt.Println(err)
			os.Exit(1)
		}

		for _, d := range deviceList {
			fmt.Println(format(d.DeviceInfo()))
		}
		return nil
	},
}

func format(data map[string]string) string {
	result, _ := json.MarshalIndent(data, "", "\t")
	return string(result)
}

func getAndroidDevices() (devices []*gadb.Device, err error) {
	var adbClient gadb.Client
	if adbClient, err = gadb.NewClient(); err != nil {
		return nil, err
	}

	if devices, err = adbClient.DeviceList(); err != nil {
		return nil, err
	}
	return devices, nil
}

func init() {
	CmdAndroidRoot.AddCommand(listAndroidDevicesCmd)
}

```

### Core Architecture Module: `cmd/adb/init.go`
```
package adb

import (
	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/uixt"
	"github.com/httprunner/httprunner/v5/uixt/option"
)

var serial string

var CmdAndroidRoot = &cobra.Command{
	Use:              "adb",
	Short:            "simple utils for android device management",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {},
}

func getDevice(serial string) (*uixt.AndroidDevice, error) {
	device, err := uixt.NewAndroidDevice(option.WithSerialNumber(serial))
	if err != nil {
		return nil, err
	}
	return device, nil
}

```

### Core Architecture Module: `cmd/adb/install.go`
```
package adb

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/sdk"
	"github.com/httprunner/httprunner/v5/uixt"
	"github.com/httprunner/httprunner/v5/uixt/option"
)

var (
	replace   bool
	downgrade bool
	grant     bool
)

var installCmd = &cobra.Command{
	Use:   "install [flags] PACKAGE",
	Short: "push package to the device and install them automatically",
	Args:  cobra.MinimumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_adb_devices", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()
		_, err = getDevice(serial)
		if err != nil {
			return err
		}

		device, err := uixt.NewAndroidDevice(option.WithSerialNumber(serial))
		if err != nil {
			fmt.Println(err)
			return err
		}
		driver, err := device.NewDriver()
		if err != nil {
			fmt.Println(err)
			return err
		}

		err = driver.GetDevice().Install(args[0],
			option.WithReinstall(replace),
			option.WithDowngrade(downgrade),
			option.WithGrantPermission(grant),
		)
		if err != nil {
			fmt.Println(err)
			return err
		}
		fmt.Println("success")
		return nil
	},
}

func init() {
	installCmd.Flags().StringVarP(&serial, "serial", "s", "", "filter by device's serial")
	installCmd.Flags().BoolVarP(&replace, "replace", "r", false, "replace existing application")
	installCmd.Flags().BoolVarP(&downgrade, "downgrade", "d", false, "allow version code downgrade (debuggable packages only)")
	installCmd.Flags().BoolVarP(&grant, "grant", "g", false, "grant all runtime permissions")
	CmdAndroidRoot.AddCommand(installCmd)
}

```

### Core Architecture Module: `cmd/adb/screencap.go`
```
package adb

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/builtin"
	"github.com/httprunner/httprunner/v5/internal/sdk"
)

var screencapAndroidDevicesCmd = &cobra.Command{
	Use:   "screencap",
	Short: "Start android screen capture",
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_adb_screencap", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()

		device, err := getDevice(serial)
		if err != nil {
			return err
		}

		res, err := device.ScreenCap()
		if err != nil {
			return err
		}

		filepath := fmt.Sprintf("%s.png", builtin.GenNameWithTimestamp("screencap_%d"))
		if err = os.WriteFile(filepath, res, 0o644); err != nil {
			return err
		}
		fmt.Println("screencap saved to", filepath)
		return nil
	},
}

func init() {
	screencapAndroidDevicesCmd.Flags().StringVarP(&serial, "serial", "s", "", "filter by device's serial")
	CmdAndroidRoot.AddCommand(screencapAndroidDevicesCmd)
}

```

### Core Architecture Module: `cmd/cli/main.go`
```
package main

import (
	"os"
	"time"

	"github.com/getsentry/sentry-go"

	"github.com/httprunner/httprunner/v5/cmd"
	"github.com/httprunner/httprunner/v5/cmd/adb"
	"github.com/httprunner/httprunner/v5/cmd/ios"
	"github.com/httprunner/httprunner/v5/code"
)

func addAllCommands() {
	// adds all child commands to the root command and sets flags appropriately.
	cmd.RootCmd.AddCommand(cmd.CmdBuild)
	cmd.RootCmd.AddCommand(cmd.CmdConvert)
	cmd.RootCmd.AddCommand(cmd.CmdPytest)
	cmd.RootCmd.AddCommand(cmd.CmdReport)
	cmd.RootCmd.AddCommand(cmd.CmdRun)
	cmd.RootCmd.AddCommand(cmd.CmdScaffold)
	cmd.RootCmd.AddCommand(cmd.CmdServer)
	cmd.RootCmd.AddCommand(cmd.CmdWiki)
	cmd.RootCmd.AddCommand(cmd.CmdMCPHost)
	cmd.RootCmd.AddCommand(cmd.CmdMCPServer)

	cmd.RootCmd.AddCommand(ios.CmdIOSRoot)
	cmd.RootCmd.AddCommand(adb.CmdAndroidRoot)
}

func main() {
	defer func() {
		if err := recover(); err != nil {
			// report panic to sentry
			sentry.CurrentHub().Recover(err)
			sentry.Flush(time.Second * 5)

			// print panic trace
			panic(err)
		}
	}()

	addAllCommands()

	err := cmd.RootCmd.Execute()
	exitCode := code.GetErrorCode(err)
	os.Exit(exitCode)
}

```

### Core Architecture Module: `cmd/convert.go`
```
package cmd

import (
	"os"
	"path/filepath"

	"github.com/pkg/errors"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"

	"github.com/httprunner/funplugin/myexec"
	"github.com/httprunner/httprunner/v5/code"
	"github.com/httprunner/httprunner/v5/convert"
	"github.com/httprunner/httprunner/v5/internal/builtin"
)

var CmdConvert = &cobra.Command{
	Use:          "convert $path...",
	Short:        "Convert multiple source format to HttpRunner JSON/YAML/gotest/pytest cases",
	Args:         cobra.MinimumNArgs(1),
	SilenceUsage: false,
	RunE: func(cmd *cobra.Command, args []string) error {
		caseConverter := convert.NewConverter(outputDir, profilePath)

		var fromType convert.FromType
		if fromYAMLFlag {
			fromType = convert.FromTypeYAML
		} else if fromPostmanFlag {
			fromType = convert.FromTypePostman
		} else if fromHARFlag {
			fromType = convert.FromTypeHAR
		} else if fromCurlFlag {
			fromType = convert.FromTypeCurl
		} else {
			fromType = convert.FromTypeJSON
			log.Info().Str("fromType", fromType.String()).Msg("set default")
		}

		var outputType convert.OutputType
		if toYAMLFlag {
			outputType = convert.OutputTypeYAML
		} else if toPyTestFlag {
			packages := []string{"httprunner"}
			_, err := myexec.EnsurePython3Venv(venv, packages...)
			if err != nil {
				log.Error().Err(err).Msg("python3 venv is not ready")
				return errors.Wrap(code.InvalidPython3Venv, err.Error())
			}

			outputType = convert.OutputTypePyTest
		} else {
			outputType = convert.OutputTypeJSON
			log.Info().Str("outputType", outputType.String()).Msg("set default")
		}

		var files []string
		for _, arg := range args {
			if builtin.IsFolderPathExists(arg) {
				fs, err := os.ReadDir(arg)
				if err != nil {
					log.Error().Err(err).Str("path", arg).Msg("read dir failed")
					continue
				}
				for _, f := range fs {
					files = append(files, filepath.Join(arg, f.Name()))
				}
			} else {
				files = append(files, arg)
			}
		}

		for _, file := range files {
			extName := filepath.Ext(file)
			if !builtin.Contains(fromType.Extensions(), extName) {
				log.Warn().Str("path", file).
					Strs("expectExtensions", fromType.Extensions()).
					Msg("skip file")
				continue
			}

			if err := caseConverter.Convert(file, fromType, outputType); err != nil {
				log.Error().Err(err).Str("path", file).
					Str("outputType", outputType.String()).
					Msg("convert case failed")
			}
		}

		return nil
	},
}

var (
	outputDir   string
	profilePath string

	fromJSONFlag    bool
	fromYAMLFlag    bool
	fromPostmanFlag bool
	fromHARFlag     bool
	fromCurlFlag    bool

	toJSONFlag   bool
	toYAMLFlag   bool
	toPyTestFlag bool
)

func init() {
	CmdConvert.Flags().BoolVar(&fromJSONFlag, "from-json", true, "load from json case format")
	CmdConvert.Flags().BoolVar(&fromYAMLFlag, "from-yaml", false, "load from yaml case format")
	CmdConvert.Flags().BoolVar(&fromHARFlag, "from-har", false, "load from HAR format")
	CmdConvert.Flags().BoolVar(&fromPostmanFlag, "from-postman", false, "load from postman format")
	CmdConvert.Flags().BoolVar(&fromCurlFlag, "from-curl", false, "load from curl format")

	CmdConvert.Flags().BoolVar(&toJSONFlag, "to-json", true, "convert to JSON case scripts")
	CmdConvert.Flags().BoolVar(&toYAMLFlag, "to-yaml", false, "convert to YAML case scripts")
	CmdConvert.Flags().BoolVar(&toPyTestFlag, "to-pytest", false, "convert to pytest scripts")

	CmdConvert.Flags().StringVarP(&outputDir, "output-dir", "d", "", "specify output directory")
	CmdConvert.Flags().StringVarP(&profilePath, "profile", "p", "", "specify profile path to override headers and cookies")
}

```

### Core Architecture Module: `cmd/ios/apps.go`
```
package ios

import (
	"fmt"
	"strings"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/internal/sdk"
	"github.com/httprunner/httprunner/v5/uixt"
)

type Application struct {
	CFBundleVersion     string `json:"version"`
	CFBundleDisplayName string `json:"name"`
	CFBundleIdentifier  string `json:"bundleId"`
}

var listAppsCmd = &cobra.Command{
	Use:              "apps",
	Short:            "List all iOS installed apps",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {},
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_ios_apps", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()

		device, err := getDevice(udid)
		if err != nil {
			return err
		}

		device.GetDeviceInfo()
		var applicationType uixt.ApplicationType
		switch appType {
		case "user":
			applicationType = uixt.ApplicationTypeUser
		case "system":
			applicationType = uixt.ApplicationTypeSystem
		case "internal":
			applicationType = uixt.ApplicationTypeInternal
		case "all":
			applicationType = uixt.ApplicationTypeAny
		}

		result, err := device.ListApps(applicationType)
		if err != nil {
			return fmt.Errorf("get app list failed %v", err)
		}

		for _, app := range result {
			a := Application{}
			mapstructure.Decode(app, &a)

			fmt.Printf("%-30.30s %-50.50s %-s\n",
				a.CFBundleDisplayName, a.CFBundleIdentifier, a.CFBundleVersion)
		}
		return nil
	},
}

var appType string

func init() {
	listAppsCmd.Flags().StringVarP(&udid, "udid", "u", "", "specify device by udid")
	listAppsCmd.Flags().StringVarP(&appType, "type", "t", "user", "filter application type [user|system|internal|all]")
	CmdIOSRoot.AddCommand(listAppsCmd)
}

```

### Core Architecture Module: `cmd/ios/devices.go`
```
package ios

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/danielpaulus/go-ios/ios"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/httprunner/httprunner/v5/code"
	"github.com/httprunner/httprunner/v5/internal/sdk"
	"github.com/httprunner/httprunner/v5/uixt"
)

type Device struct {
	d               ios.DeviceEntry
	UDID            string             `json:"UDID"`
	Status          string             `json:"status"`
	ConnectionType  string             `json:"connectionType"`
	ConnectionSpeed int                `json:"connectionSpeed"`
	DeviceDetail    *uixt.DeviceDetail `json:"deviceDetail,omitempty"`
}

func (device *Device) GetStatus() string {
	if device.ConnectionType != "" {
		return "online"
	} else {
		return "offline"
	}
}

func (device *Device) ToFormat() string {
	result, _ := json.MarshalIndent(device, "", "\t")
	return string(result)
}

var listDevicesCmd = &cobra.Command{
	Use:              "devices",
	Short:            "List all iOS devices",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {},
	RunE: func(cmd *cobra.Command, args []string) (err error) {
		startTime := time.Now()
		defer func() {
			sdk.SendGA4Event("hrp_ios_devices", map[string]interface{}{
				"args":                 strings.Join(args, "-"),
				"success":              err == nil,
				"engagement_time_msec": time.Since(startTime).Milliseconds(),
			})
		}()

		devices, err := ios.ListDevices()
		if err != nil {
			return errors.Wrap(code.DeviceConnectionError,
				fmt.Sprintf("list ios devices failed: %v", err))
		}

		for _, d := range devices.DeviceList {
			deviceProperties := d.Properties
			device := &Device{
				d:               d,
				UDID:            deviceProperties.SerialNumber,
				ConnectionType:  deviceProperties.ConnectionType,
				ConnectionSpeed: deviceProperties.ConnectionSpeed,
			}
			fmt.Println(device.UDID, device.ConnectionType, device.GetStatus())
		}
		return nil
	},
}

var udid string

func init() {
	CmdIOSRoot.AddCommand(listDevicesCmd)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1652** (2023-07-24): **一键安装命令报错了**
  *Symptoms*: 一键安装命令报错了
  **Post-Mortem & Fix Analysis**:
  >  手动按照发现没有最新的linux-amd版本，于是下载了4.3.3版本，安装后报错 <img width="742" alt="image" src="https://github.com/httprunner/httprunner/assets/4033717/7e37a84e-2987-424f-9578-72c75a948d63">   环境：ubuntu 22.04-server   mac也是类似错误，手动执行 pip install httprunner==v4.3.3可以正常安装 
  > 通过手动安装PYYAML-5.4.1解决，，，需要手动把包解压，修改里面是setup.cfg文件，然后才能安装上
  > 已在 v4.3.5 解决

- **Issue #1603** (2023-07-23): **hrp run转换URL错误**
  *Symptoms*: ## hrp run 命令转换URL的时候，漏掉了结尾的`/`   ## 版本信息   - 操作系统类型: [Linux]  - Python 版本: [3.10]  - hrp 版本 [4.3.3]  ## case  ![image](https://user-images.githubusercontent.com/43426348/233820716-d2664167-4c6a-47b6-a024-d453f7e94fb5.png)  ## hrp run  > 失败  hrp run cases/mycopy_case.yml -g -c  ![image](https://user-images.githubusercontent.com/43426348/233820757-f6ec47a5-4a26-438d-a388-779c9c143782.png)   ## hrp pytest  > 成功  hrp pytest cases/mycopy_case.yml --html=my.html --disable-warnings  ![image](https://user-images.githubusercontent.com/43426348/233820795-4463c1a4-c060-4111-8dce-c7e796e6a4a1.png)  ![image](https://user-images.githubusercontent.com/43426348/233820818-73f7c1e1-7e3e-4171-96c1-03f9eecb2f9f.png)   

- **Issue #1547** (2023-04-19): **hrp run 嵌套case，report生成失败**
  *Symptoms*: ## 问题描述 hrp 执行嵌套用例，生成报告失败   hrp 是下载的二进制文件，V4.3.0 通过脚手架生成项目，命令如下： hrp run -s -g testcases/ref_testcase.yml  <img width="1469" alt="image" src="https://user-images.githubusercontent.com/43426348/211262914-432d9abf-789a-4e4a-918d-e66cb334d0c1.png">   ## 版本信息    - 操作系统类型:  mac M1   - Python 版本: v3.10.9  - HttpRunner 版本 v4.3.0   
  **Post-Mortem & Fix Analysis**:
  > 同样问题啊。.
  > @jiwzh @jonzha9527  这是由于引用case的时候，在 `(*StepTestCaseWithOptionalArgs).Run` 中 的差异行为 ![image](https://user-images.githubusercontent.com/30226135/232689364-df1f7b4e-17f5-411b-af1c-f0473ead939f.png)  和 其他单个step 的操作记录不同 ![image](https://user-images.githubusercontent.com/30226135/232689516-d7d20ed5-0ec2-4bcb-9db3-dace1f6084a7.png) 

- **Issue #1468** (2023-04-18): **接口测试报告（Go template）部分内容显示变量或格式异常**
  *Symptoms*: ## 问题描述  > 接口测试报告（Go template）部分内容显示变量或格式异常 >   ## 版本信息  请提供如下版本信息：   - 操作系统类型: [Windows]  - Python 版本: [3.7]  - Go 版本: [1.18]  - HttpRunner 版本 [4.2.0]  ## 项目文件内容（非必须）  ![report](https://user-images.githubusercontent.com/37102283/188767422-890a0faf-adcb-402c-babc-5f4d194d9519.png)    提示：请注意在去除项目敏感信息（IP、账号密码、密钥等）后再进行上传。 
  **Post-Mortem & Fix Analysis**:
  > 这个确实有用，应该加上😁
  > 修复 url 变量显示改为 值显示。

- **Issue #1467** (2023-04-19): **参数化数据驱动parameters加载自定义函数没找到**
  *Symptoms*: ## 问题描述  > hrp run 运行json文件，json文件中使用parameters参数化数据驱动的其中一种方式，即返回list[dict]模式，报错函数未找到  ## 版本信息  请提供如下版本信息：   - 操作系统类型:  Windows  - Python 版本: 3.7  - Go 版本: 1.18  - HttpRunner 版本: 4.2.0  ## 项目文件内容（非必须） ![1](https://user-images.githubusercontent.com/37102283/188423383-5670913f-52a9-46f2-9725-c8d7920bd331.png)   报错信息 PS $$$ hrp run testcases\suittestcasetestcopy.json -g 5:58PM INF Set log to color console other than JSON format. 5:58PM ??? Set log level 5:58PM INF [init] SetFailfast failfast=true 5:58PM INF [init] SetSaveTests saveTests=false 5:58PM INF [init] SetgenHTMLReport genHTMLReport=true 5:58PM INF [init] SetRequestsLogOn 5:58PM INF load file path="testcases\\suittestcasetestcopy.json" 5:58PM INF load file path="C:\\Users\\95439\\hrp4demo\\.env" 5:58PM INF set env key=base_url 5:58PM INF set env key=USERNAME 5:58PM INF set env key=PASSWORD 5:58PM INF load testcases successfully count=1 5:58PM INF start to prepare python plugin output="C:\\Users\\95439\\hrp4demo\\.debugtalk_gen.py" path="C:\\Users\\95439\\hrp4demo\\debugtalk.py" 5:58PM INF exec command cmd="C:\\WINDOWS\\system32\\cmd.exe /c python -m py_compile C:\\Users\\95439\\hrp4demo\\debugtalk.py" 5:58PM INF find all function names functionNames=["get_user_agent","sleep","sum","sum_ints","sum_two_int","sum_two_string","sum_strings","concatenate","setup_hook_example","teardown_hook_example","getkey","getparameters"] 5:58PM INF generate debugtalk success output="C:\\Users\\95439\\hrp4dem
  **Post-Mortem & Fix Analysis**:
  > 同样遇到了，应该是bug还没修复吧
  > golang中也是一样，parameters中找不到自定义的插件
  > golang中也是一样，parameters中找不到自定义的插件

- **Issue #1377** (2022-07-05): **hrp 性能测试 Statistics Summary 统计结果不准**
  *Symptoms*: ## 问题描述  如果测试用例中存在引用其他用例的情况下，统计会将整个引用的testcase作为一个request，存在较大统计误差。  ## 版本信息  请提供如下版本信息：   - hrp全版本  ## 项目文件内容（非必须）  ``` Current time: 2022/06/21 10:48:23, Users: 1, State: quitting, Total RPS: 0.7, Total Average Response Time: 1252.5ms, Total Fail Ratio: 0.0% Accumulated Transactions: 1 Passed, 0 Failed +--------------+------------------------+------------+---------+--------+---------+------+------+--------------+------------+-------------+ |     TYPE     |          NAME          | # REQUESTS | # FAILS | MEDIAN | AVERAGE | MIN  | MAX  | CONTENT SIZE | # REQS/SEC | # FAILS/SEC | +--------------+------------------------+------------+---------+--------+---------+------+------+--------------+------------+-------------+ | request-POST | post form data         |          1 |       0 |    280 |  278.00 |  278 |  278 |          422 |       0.33 |        0.00 | | testcase     | request with functions |          1 |       0 |   2200 | 2227.00 | 2227 | 2227 |            0 |       0.33 |        0.00 | | transaction  | Action                 |          1 |       0 |   2800 | 2830.00 | 2830 | 2830 |            0 |       0.33 |        0.00 | +--------------+------------------------+------------+---------+--------+---------+------+------+--------------+------------+-------------+  =========================================== Statistics Summary ========================================== Current time: 2022/06/21 10:48:23, Users: 1, Duration: 2.83s, Accumulated Transacti

- **Issue #1366** (2022-06-17): **脚手架工程运行hrp run yml用例，提示 build plugin failed error="python plugin syntax invalid: exit status 9009"**
  *Symptoms*: ## 问题描述  > 1.  hrp startproject hrpv4   > 2. 执行 hrp run testcases\requests.yml -g   ` (venv) E:\dev\httprunner-v4\hrpv4>hrp run testcases\requests.yml -g 3:08PM INF Set log to color console other than JSON format. 3:08PM ??? Set log level 3:08PM INF [init] SetFailfast failfast=true 3:08PM INF [init] SetSaveTests saveTests=false 3:08PM INF [init] SetgenHTMLReport genHTMLReport=true 3:08PM INF [init] SetRequestsLogOn 3:08PM INF load file path="testcases\\requests.yml" 3:08PM INF load file path="E:\\dev\\httprunner-v4\\hrpv4\\.env" 3:08PM INF set env key=base_url 3:08PM INF set env key=USERNAME 3:08PM INF set env key=PASSWORD 3:08PM INF load testcases successfully count=1 3:08PM INF exec command cmd="C:\\WINDOWS\\system32\\cmd.exe /c python3 -m py_compile E:\\dev\\httprunner-v4\\hrpv4\\debugtalk.py" 3:08PM ERR exec command failed error="exit status 9009" 3:08PM ERR build plugin failed error="python plugin syntax invalid: exit status 9009" path="E:\\dev\\httprunner-v4\\hrpv4\\debugtalk.py"  ` ## 版本信息  请提供如下版本信息：   - 操作系统类型: [e.g.  Windows]  - Python 版本: [e.g. 3.8]  - HttpRunner 版本 [e.g. 4.1.3]  ## 项目文件内容（非必须）  ![image](https://user-images.githubusercontent.com/8569167/174013395-38cf2c2d-1947-40b1-a77b-557f04a6318e.png)
  **Post-Mortem & Fix Analysis**:
  > @HJXDELL 该问题已修复，将在 v4.1.4 中发布。  https://github.com/httprunner/httprunner/pull/1360

- **Issue #1357** (2022-06-17): **引用测试用例时参数驱动失效**
  *Symptoms*: ## 问题描述  > 假设有个子用例A.yml，每次调用时返回传入的参数“TREATMENTNO”，比如传123返回123，传456返回456，内容如下： ``` config:     name: “子用例A”     base_url: ${ENV(DOMAIN)}     verify: False  teststeps: -     name: "处理单号”     request:         method: POST         url: /srs/submit         headers:             content-type: "application/json;charset=UTF-8"         json:             treatmentNo: $TREATMENTNO     validate:         - eq: ["status_code", 200] ```  >现在有个主用例B.yml,多次调用A,只是每次传递的参数不同 ``` config:     name: "主用例B”     base_url: ${ENV(DOMAIN)}     verify: False  teststeps: -     name: "处理单号1”     variables:         TREATMENTNO: “ABC123”     testcase: testcases/A.yml  -     name: "处理单号2”     variables:         TREATMENTNO: “abc456”     testcase: testcases/A.yml  ```  >当第二次调用A.yml的时候，应该返回abc456，实际还是返回ABC123。  ## 版本信息  请提供如下版本信息：   - 操作系统类型: [macOS]  - Python 版本: [3.7.7]  - Go 版本: [none]  - HttpRunner 版本 [3.1.4]  ## 项目文件内容（非必须）  如果可能，提供项目测试用例文件原始内容可加快 bug 定位和修复速度。  提示：请注意在去除项目敏感信息（IP、账号密码、密钥等）后再进行上传。 
  **Post-Mortem & Fix Analysis**:
  > @jeremy8250 已经在 v4.1.4 中修复；如果还有问题的话麻烦再 reopen 这个 issue 反馈下。

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

### Incident Patch 1: `47996ed2` (2025-08-18)
**Commit Message**: Merge 'fix-token' into 'master'

fix: remove token

See merge request: !162

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250815
+v5.0.0-250818
```

**File**: `uixt/driver_utils.go` (modified, +14/-5)
```diff
@@ -386,8 +386,18 @@ func DownloadFileByUrl(fileUrl string) (filePath string, err error) {
 	return filePath, nil
 }
 
+var (
+	VEDEM_UPLOAD_URL        = os.Getenv("VEDEM_UPLOAD_URL")
+	VEDEM_UPLOAD_ACCESS_KEY = os.Getenv("VEDEM_UPLOAD_ACCESS_KEY")
+	VEDEM_UPLOAD_TOKEN      = os.Getenv("VEDEM_UPLOAD_TOKEN")
+)
+
 // uploadScreenshot uploads a screenshot to the server and returns the URL
 func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, error) {
+	if VEDEM_UPLOAD_URL == "" || VEDEM_UPLOAD_ACCESS_KEY == "" || VEDEM_UPLOAD_TOKEN == "" {
+		return "", errors.Wrap(code.ConfigureError, "upload service env not configured")
+	}
+
 	// Create a new buffer for the multipart form
 	var requestBody bytes.Buffer
 	writer := multipart.NewWriter(&requestBody)
@@ -409,16 +419,15 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Create the HTTP request
-	uploadURL := "https://gtf-eapi-cn.bytedance.com/cn/upload/xxx"
-	req, err := http.NewRequest("POST", uploadURL, &requestBody)
+	req, err := http.NewRequest("POST", VEDEM_UPLOAD_URL, &requestBody)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
 	}
 
 	// Set headers
 	req.Header.Set("Content-Type", writer.FormDataContentType())
-	req.Header.Set("accessKey", "ies.vedem.video")
-	req.Header.Set("token", "***REMOVED***")
+	req.Header.Set("accessKey", VEDEM_UPLOAD_ACCESS_KEY)
+	req.Header.Set("token", VEDEM_UPLOAD_TOKEN)
 
 	// Create HTTP client with HTTP/1.1 support
 	client := &http.Client{
@@ -428,7 +437,7 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Send the request
-	log.Debug().Str("url", uploadURL).Str("imagePath", imagePath).Msg("uploading screenshot")
+	log.Debug().Str("url", VEDEM_UPLOAD_URL).Str("imagePath", imagePath).Msg("uploading screenshot")
 	resp, err := client.Do(req)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
```

---

### Incident Patch 2: `2c095d1f` (2025-08-18)
**Commit Message**: fix: remove token

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250815
+v5.0.0-250818
```

**File**: `uixt/driver_utils.go` (modified, +14/-5)
```diff
@@ -386,8 +386,18 @@ func DownloadFileByUrl(fileUrl string) (filePath string, err error) {
 	return filePath, nil
 }
 
+var (
+	VEDEM_UPLOAD_URL        = os.Getenv("VEDEM_UPLOAD_URL")
+	VEDEM_UPLOAD_ACCESS_KEY = os.Getenv("VEDEM_UPLOAD_ACCESS_KEY")
+	VEDEM_UPLOAD_TOKEN      = os.Getenv("VEDEM_UPLOAD_TOKEN")
+)
+
 // uploadScreenshot uploads a screenshot to the server and returns the URL
 func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, error) {
+	if VEDEM_UPLOAD_URL == "" || VEDEM_UPLOAD_ACCESS_KEY == "" || VEDEM_UPLOAD_TOKEN == "" {
+		return "", errors.Wrap(code.ConfigureError, "upload service env not configured")
+	}
+
 	// Create a new buffer for the multipart form
 	var requestBody bytes.Buffer
 	writer := multipart.NewWriter(&requestBody)
@@ -409,16 +419,15 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Create the HTTP request
-	uploadURL := "https://gtf-eapi-cn.bytedance.com/cn/upload/xxx"
-	req, err := http.NewRequest("POST", uploadURL, &requestBody)
+	req, err := http.NewRequest("POST", VEDEM_UPLOAD_URL, &requestBody)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
 	}
 
 	// Set headers
 	req.Header.Set("Content-Type", writer.FormDataContentType())
-	req.Header.Set("accessKey", "ies.vedem.video")
-	req.Header.Set("token", "***REMOVED***")
+	req.Header.Set("accessKey", VEDEM_UPLOAD_ACCESS_KEY)
+	req.Header.Set("token", VEDEM_UPLOAD_TOKEN)
 
 	// Create HTTP client with HTTP/1.1 support
 	client := &http.Client{
@@ -428,7 +437,7 @@ func uploadScreenshot(imagePath string, imageBuffer *bytes.Buffer) (string, erro
 	}
 
 	// Send the request
-	log.Debug().Str("url", uploadURL).Str("imagePath", imagePath).Msg("uploading screenshot")
+	log.Debug().Str("url", VEDEM_UPLOAD_URL).Str("imagePath", imagePath).Msg("uploading screenshot")
 	resp, err := client.Do(req)
 	if err != nil {
 		return "", errors.Wrap(code.UploadFailed, err.Error())
```

---

### Incident Patch 3: `5459199b` (2025-08-15)
**Commit Message**: Merge 'fix-init-llm-service' into 'master'

Fix init llm service

See merge request: !157

**File**: `CLAUDE.md` (modified, +4/-4)
```diff
@@ -116,6 +116,10 @@ The framework supports both Go and Python plugins:
 - Internal utilities in `internal/`
 - Examples in `examples/`
 
+### Code Standards
+- All code comments must be written in English
+- All documentation must be written in Chinese
+
 ### Dependencies
 - Go 1.23+ required
 - Uses Cobra for CLI
@@ -126,7 +130,3 @@ The framework supports both Go and Python plugins:
 - Static linking for deployment
 - Version info embedded via ldflags
 - Cross-platform builds supported
-
-### Code Standards
-- All code comments must be written in English
-- All documentation must be written in Chinese
```

**File**: `runner_uixt.go` (modified, +38/-19)
```diff
@@ -35,24 +35,31 @@ type UIXTRunner struct {
 }
 
 type UIXTConfig struct {
-	uixt.DriverCacheConfig
+	uixt.DriverCacheConfig // includes Platform, Serial, AIOptions
 
-	Ctx                context.Context
-	Cancel             context.CancelFunc
-	JSONCase           ITestCase
-	UIA2               bool    // UIAutomator2（Android）
-	LogOn              bool    // 开启打点日志
+	// Runtime context
+	Ctx    context.Context
+	Cancel context.CancelFunc `json:"-"`
+
+	// Test case configuration
+	JSONCase ITestCase
+
+	// Device specific options
+	UIA2         bool // UIAutomator2（Android）
+	LogOn        bool // 开启打点日志
+	WDAPort      int  // iOS WebDriverAgent port
+	WDAMjpegPort int  // iOS WebDriverAgent MJPEG port
+
+	// Agent behavior configuration
 	Timeout            int     // seconds
 	AbortErrors        []error // abort errors
 	MaxRestartAppCount int     // max app restart count
 	MaxRetryCount      int     // max retry count
 
-	WDAPort      int
-	WDAMjpegPort int
-
-	OSType     string // platform
-	Serial     string
-	LLMService option.LLMServiceType // LLM 服务类型
+	// Backward compatibility fields - legacy API support
+	OSType     string                // deprecated: use Platform from DriverCacheConfig
+	Serial     string                // deprecated: use Serial from DriverCacheConfig
+	LLMService option.LLMServiceType // deprecated: use AIOptions from DriverCacheConfig
 }
 
 const (
@@ -83,7 +90,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	config.SetAIOptions(configs.AIOptions...)
 
-	switch configs.OSType {
+	switch configs.Platform {
 	case "ios":
 		port, err := configs.getWDALocalPort(configs.Serial)
 		if err != nil {
@@ -123,7 +130,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 		)
 	default:
 		// default to android
-		configs.OSType = "android"
+		configs.Platform = "android"
 		config.SetAndroid(
 			option.WithSerialNumber(configs.Serial),
 			option.WithUIA2(configs.UIA2),
@@ -144,11 +151,10 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	sessionRunner := caseRunner.NewSession()
 
-	driverCacheConfig := uixt.DriverCacheConfig{
-		Platform:  configs.OSType,
-		Serial:    configs.Serial,
-		AIOptions: config.AIOptions.Options(),
-	}
+	// Use configs directly as it inherits DriverCacheConfig
+	driverCacheConfig := configs.DriverCacheConfig
+	driverCacheConfig.AIOptions = config.AIOptions.Options()
+
 	dExt, err := uixt.GetOrCreateXTDriver(driverCacheConfig)
 	if err != nil {
 		return nil, errors.Wrap(err, "get driver failed")
@@ -181,6 +187,19 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 }
 
 func (configs *UIXTConfig) addDefault() {
+	// Handle backward compatibility - sync legacy fields to embedded DriverCacheConfig
+	if configs.OSType != "" && configs.Platform == "" {
+		configs.Platform = configs.OSType
+	}
+	if configs.Serial != "" && configs.DriverCacheConfig.Serial == "" {
+		configs.DriverCacheConfig.Serial = configs.Serial
+	}
+	if configs.LLMService != "" && len(configs.AIOptions) == 0 {
+		configs.AIOptions = []option.AIServiceOption{
+			option.WithLLMService(configs.LLMService),
+		}
+	}
+
 	if configs.Ctx == nil {
 		configs.Ctx = context.Background()
 	}
```

**File**: `uixt/ai/wings_service.go` (modified, +4/-1)
```diff
@@ -472,7 +472,10 @@ func (w *WingsService) callWingsAPI(ctx context.Context, request WingsActionRequ
 	defer resp.Body.Close()
 
 	logID := resp.Header.Get("X-Tt-Logid")
-	log.Info().Str("step_text", request.StepText).Str("image_url", request.DeviceInfos[0].NowImageUrl).Str("log_id", logID).Str("biz_id", request.BizId).Str("url", w.apiURL).Msg("call wings api")
+	log.Info().Str("step_text", request.StepText).
+		Str("image_url", request.DeviceInfos[0].NowImageUrl).
+		Str("log_id", logID).Str("biz_id", request.BizId).
+		Str("url", w.apiURL).Msg("call wings api")
 
 	// Read response body
 	responseBody, err := io.ReadAll(resp.Body)
```

**File**: `uixt/mcp_server_test.go` (modified, +146/-0)
```diff
@@ -1851,3 +1851,149 @@ func TestNewMCPErrorResponse(t *testing.T) {
 	result := NewMCPErrorResponse("Test error message")
 	assert.NotNil(t, result)
 }
+
+// TestParseActionOptions tests core functionality of parseActionOptions function
+func TestParseActionOptions(t *testing.T) {
+	testCases := []struct {
+		name      string
+		arguments map[string]any
+		expectErr bool
+		validate  func(t *testing.T, opts *option.ActionOptions)
+	}{
+		{
+			name:      "empty_arguments",
+			arguments: map[string]any{},
+			expectErr: false,
+			validate: func(t *testing.T, opts *option.ActionOptions) {
+				assert.Equal(t, "", opts.Platform)
+				assert.Equal(t, "", opts.Serial)
+				assert.Equal(t, 0.0, opts.X)
+				assert.Equal(t, 0.0, opts.Y)
+			},
+		},
+		{
+			name: "basic_fields",
+			arguments: map[string]any{
+				"platform": "android",
+				"serial":   "device123",
+				"x":        100.5,
+				"y":        200.7,
+				"text":     "Hello World",
+			},
+			expectErr: false,
+			validate: func(t *testing.T, opts *option.ActionOptions) {
+				assert.Equal(t, "android", opts.Platform)
+				assert.Equal(t, "device123", opts.Serial)
+				assert.Equal(t, 100.5, opts.X)
+				assert.Equal(t, 200.7, opts.Y)
+				assert.Equal(t, "Hello World", opts.Text)
+			},
+		},
+		{
+			name: "complete_nested_fields",
+			arguments: map[string]any{
+				"platform":                        "ios",
+				"serial":                          "ios_device",
+				"screenshot_with_ocr":             true,
+				"screenshot_with_upload":          true,
+				"screenshot_with_live_type":       true,
+				"screenshot_with_live_popularity": true,
+				"screenshot_with_base64":          true,
+				"screenshot_with_ui_types":        []string{"button", "input", "text"},
+				"screenshot_with_close_popups":    true,
+				"screenshot_with_ocr_cluster":     "test_cluster",
+				"screenshot_file_name":            "test.png",
+				"screenrecord_duration":           30.5,
+				"screenrecord_with_audio":         true,
+				"screenrecord_with_scrcpy":        true,
+				"screenrecord_path":               "/tmp/record.mp4",
+				"scope":                           []float64{0.1, 0.2, 0.9, 0.8},
+				"abs_scope":                       []int{100, 200, 900, 800},
+				"regex":                           true,
+				"offset":                          []int{5, 10},
+				"tap_random_rect":                 true,
+				"swipe_offset":                    []int{1, 2, 3, 4},
+				"offset_random_range":             []int{-5, 5},
+				"index":                           2,
+				"match_one":                       true,
+				"ignore_NotFoundError":            true,
+				"pre_mark_operation":              true,
+				"post_mark_operation":             false,
+				"max_retry_times":                 5,
+				"timeout":                         30,
+				"custom": map[string]any{
+					"test_key":    "test_value",
+					"nested_data": map[string]any{"key": "value"},
+				},
+			},
+			expectErr: false,
+			validate: func(t *testing.T, opts *option.ActionOptions) {
+				assert.Equal(t, "ios", opts.Platform)
+				assert.Equal(t, "ios_device", opts.Serial)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithOCR)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithUpload)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithLiveType)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithLivePopularity)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithBase64)
+				assert.Equal(t, []string{"button", "input", "text"}, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithUITypes)
+				assert.True(t, opts.ScreenOptions.ScreenShotOptions.ScreenShotWithClosePopups)
+				assert.Equal(t, "test_cluster", opts.ScreenOptions.ScreenShotOptions.ScreenShotWithOCRCluster)
+				assert.Equal(t, "test.png", opts.ScreenOptions.ScreenShotOptions.ScreenShotFileName)
+				assert.Equal(t, 30.5, opts.ScreenOptions.ScreenRecordOptions.ScreenRecordD
```

**File**: `uixt/sdk.go` (modified, +10/-5)
```diff
@@ -24,6 +24,7 @@ func NewXTDriver(driver IDriver, opts ...option.AIServiceOption) (*XTDriver, err
 		services:         services,
 		loadedMCPClients: make(map[string]client.MCPClient),
 	}
+	log.Info().Interface("services", services).Msg("init XTDriver with AI services")
 
 	var err error
 
@@ -32,25 +33,29 @@ func NewXTDriver(driver IDriver, opts ...option.AIServiceOption) (*XTDriver, err
 		// Use advanced LLM service configuration if provided
 		driverExt.LLMService, err = ai.NewLLMServiceWithOptionConfig(services.LLMConfig)
 		if err != nil {
-			log.Warn().Err(err).Msg("init llm service with config failed")
+			log.Warn().Err(err).Interface("service", services.LLMConfig).
+				Msg("init llm service with advanced config failed")
 		} else {
-			log.Info().Msg("LLM service initialized with advanced config")
+			log.Info().Interface("service", services.LLMConfig).
+				Msg("LLM service initialized with advanced config")
 		}
 	} else if services.LLMService != "" {
 		// Use simple LLM service configuration if provided
 		driverExt.LLMService, err = ai.NewLLMService(services.LLMService)
 		if err != nil {
-			log.Warn().Err(err).Msg("init llm service failed")
+			log.Warn().Err(err).Str("service", string(services.LLMService)).
+				Msg("init llm service with simple config failed")
 		} else {
-			log.Info().Msg("LLM service initialized with simple config")
+			log.Info().Str("service", string(services.LLMService)).
+				Msg("LLM service initialized with simple config")
 		}
 	} else {
 		// Use Wings service as fallback
 		driverExt.LLMService, err = ai.NewWingsService()
 		if err != nil {
 			log.Warn().Err(err).Msg("init Wings service failed")
 		} else {
-			log.Info().Msg("Wings service initialized")
+			log.Info().Msg("Wings service initialized as fallback")
 		}
 	}
 
```

---

### Incident Patch 4: `6bf63cfc` (2025-08-15)
**Commit Message**: revert:

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250813
+v5.0.0-250815
```

**File**: `pkg/gadb/device.go` (modified, +12/-1)
```diff
@@ -664,14 +664,22 @@ func (d *Device) installViaABBExec(apk io.ReadSeeker, args ...string) (raw []byt
 		tp       transport
 		filesize int64
 	)
+	timeout := 8
+	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Minute)
+	defer cancel()
+
 	filesize, err = apk.Seek(0, io.SeekEnd)
 	if err != nil {
 		return nil, err
 	}
-	if tp, err = d.createDeviceTransport(5 * time.Minute); err != nil {
+	if tp, err = d.createDeviceTransport(4 * time.Minute); err != nil {
 		return nil, err
 	}
 	defer func() { _ = tp.Close() }()
+	go func() {
+		<-ctx.Done()
+		_ = tp.Close()
+	}()
 	cmd := "abb_exec:package\x00install\x00-t"
 	for _, arg := range args {
 		cmd += "\x00" + arg
@@ -690,6 +698,9 @@ func (d *Device) installViaABBExec(apk io.ReadSeeker, args ...string) (raw []byt
 		return nil, err
 	}
 	raw, err = tp.ReadBytesAll()
+	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
+		return nil, fmt.Errorf("installation timed out after %d minutes", timeout)
+	}
 	return
 }
 
```

**File**: `uixt/ai/wings_service.go` (modified, +129/-54)
```diff
@@ -26,6 +26,7 @@ type WingsService struct {
 	bizId     string
 	accessKey string
 	secretKey string
+	history   []History // Conversation history for Wings API
 }
 
 // NewWingsService creates a new Wings service instance
@@ -49,6 +50,7 @@ func NewWingsService() (ILLMService, error) {
 		bizId:     bizID,
 		accessKey: accessKey,
 		secretKey: secretKey,
+		history:   []History{},
 	}, nil
 }
 
@@ -59,6 +61,11 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 		return nil, errors.Wrap(err, "validate planning parameters failed")
 	}
 
+	// Reset history if requested
+	if opts.ResetHistory {
+		w.resetHistory()
+	}
+
 	// Extract screenshot from message
 	screenshot, err := w.extractScreenshotFromMessage(opts.Message)
 	if err != nil {
@@ -70,15 +77,11 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 
 	// Prepare Wings API request
 	apiRequest := WingsActionRequest{
-		Historys: []interface{}{}, // empty as specified
-		DeviceInfos: []WingsDeviceInfo{
-			deviceInfo,
-		},
-		StepText: opts.UserInstruction,
-		BizId:    w.bizId,
-		TextCase: "整体描述：\\n前置条件：\\n获取 1 台设备 A。\\n获取 1 个[万粉创作者]账号a。\\n获取 2 个[普通]账号 b、c。\\n账号 a 和账号 b 互相关注。\\n账号 a 和账号 c 互相关注。\\n账号 a 给账号 b 设置备注为 “11131b”。\\n账号 a 给账号 c 设置备注为 “11131c”。\\n账号 a 创建一个粉丝群 m。\\n 账号 a 修改粉丝群 m 名称为“11131群”。\\n 账号 a 邀请账号 b 加入粉丝群 m。\\n账号 a 邀请账号 c 加入粉丝群 m。\\n账号 a 给群聊 m 发送一条文字消息。\\n设备 A 打开抖音 app。\\n设备 A 登录账号 a。\\n设备 A 退出抖音 app。\\n操作步骤：\\n账号a打开抖音app。\\n点击“消息”。\\n点击“11131群”cell。\\n点击“聊天信息页入口”按钮。\\n点击“分享公开群”按钮。\\n点击文字“群口令”。\\n断言：屏幕中存在文字“口令复制成功”。\\n停止操作。\\n注意事项：\\n",
-		StepType: "automation",
-		DeviceID: deviceInfo.DeviceID,
+		Historys:   w.history,
+		DeviceInfo: deviceInfo,
+		StepText:   fmt.Sprintf("%s", opts.UserInstruction),
+		BizId:      w.bizId,
+		TextCase:   fmt.Sprintf("整体描述：\n前置条件：\n操作步骤：\n%s\n停止操作。\n注意事项：\n", opts.UserInstruction),
 		Base: WingsBase{
 			LogID: generateWingsUUID(),
 		},
@@ -98,7 +101,7 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 	}
 
 	// Check API response status
-	if response.BaseResp.StatusCode != 0 {
+	if response.BaseResp.StatusCode != 0 && response.BaseResp.StatusCode != 200 {
 		err = fmt.Errorf("API returned error: %s", response.BaseResp.StatusMessage)
 		return &PlanningResult{
 			Thought:   response.ThoughtChain.Thought,
@@ -107,26 +110,50 @@ func (w *WingsService) Plan(ctx context.Context, opts *PlanningOptions) (*Planni
 		}, err
 	}
 
-	// Convert Wings API response to tool calls
-	toolCalls, err := w.convertWingsResponseToToolCalls(response.ActionParams)
-	if err != nil {
-		return &PlanningResult{
-			Thought:   response.ThoughtChain.Thought,
-			Error:     err.Error(),
-			ModelName: "wings-api",
-		}, errors.Wrap(err, "convert Wings response to tool calls failed")
+	// Update history with response data
+	newHistoryEntry := History{
+		Observation:   response.ThoughtChain.Observation,
+		Thought:       response.ThoughtChain.Thought,
+		Summary:       response.ThoughtChain.Summary,
+		StepText:      response.StepText,
+		StepTextTrans: response.StepTextTrans,
+		OriStepIndex:  response.OriStepIndex,
+		DeviceID:      deviceInfo[0].DeviceID,
+		AgentType:     response.AgentType,
+		ActionResult:  "", // Always empty as requested
+		DeviceInfos:   &deviceInfo,
+		ActionParams:  response.ActionParams,
+	}
+	w.history = append(w.history, newHistoryEntry)
+	var toolCalls []schema.ToolCall
+	if response.StepType != "FINISH" {
+		// Convert Wings API response to tool calls
+		toolCalls, err = w.convertWingsResponseToToolCalls(response.ActionParams)
+		if err != nil {
+			return &PlanningResult{
+				Thought:   response.ThoughtChain.Thought,
+				Error:     err.Error(),
+				ModelName: "wings-api",
+			}, errors.Wrap(err, "convert Wings response to tool calls failed")
+		}
 	}
 
+	// No need to update ActionResult as per user request
+	// ActionResult should always be empty
+
 	log.Info().
 		Str("thought", response.ThoughtChain.Thought).
```

**File**: `uixt/android_device.go` (modified, +2/-2)
```diff
@@ -240,12 +240,12 @@ func (dev *AndroidDevice) installViaInstaller(apkPath string, args ...string) er
 		return err
 	}
 	// 等待安装完成或超时
-	timeout := 3 * time.Minute
+	timeout := 8 * time.Minute
 	select {
 	case err := <-done:
 		return err
 	case <-time.After(timeout):
-		return fmt.Errorf("installation timed out after %v", timeout)
+		return fmt.Errorf("install via installer timed out after %v", timeout)
 	}
 }
 
```

**File**: `uixt/android_test.go` (modified, +0/-5)
```diff
@@ -21,11 +21,6 @@ func setupADBDriverExt(t *testing.T) *XTDriver {
 		Serial:   "", // Let it auto-detect the device serial
 		AIOptions: []option.AIServiceOption{
 			option.WithCVService(option.CVServiceTypeVEDEM),
-			option.WithLLMConfig(
-				option.NewLLMServiceConfig(option.DOUBAO_1_5_UI_TARS_250328).
-					WithPlannerModel(option.WINGS_SERVICE).
-					WithAsserterModel(option.WINGS_SERVICE),
-			),
 		},
 	}
 
```

---

### Incident Patch 5: `158d6d9b` (2025-08-15)
**Commit Message**: fix: configure LLMService for UIXTRunner

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250814
+v5.0.0-250815
```

**File**: `runner_uixt.go` (modified, +38/-19)
```diff
@@ -35,24 +35,31 @@ type UIXTRunner struct {
 }
 
 type UIXTConfig struct {
-	uixt.DriverCacheConfig
+	uixt.DriverCacheConfig // includes Platform, Serial, AIOptions
 
-	Ctx                context.Context
-	Cancel             context.CancelFunc
-	JSONCase           ITestCase
-	UIA2               bool    // UIAutomator2（Android）
-	LogOn              bool    // 开启打点日志
+	// Runtime context
+	Ctx    context.Context
+	Cancel context.CancelFunc `json:"-"`
+
+	// Test case configuration
+	JSONCase ITestCase
+
+	// Device specific options
+	UIA2         bool // UIAutomator2（Android）
+	LogOn        bool // 开启打点日志
+	WDAPort      int  // iOS WebDriverAgent port
+	WDAMjpegPort int  // iOS WebDriverAgent MJPEG port
+
+	// Agent behavior configuration
 	Timeout            int     // seconds
 	AbortErrors        []error // abort errors
 	MaxRestartAppCount int     // max app restart count
 	MaxRetryCount      int     // max retry count
 
-	WDAPort      int
-	WDAMjpegPort int
-
-	OSType     string // platform
-	Serial     string
-	LLMService option.LLMServiceType // LLM 服务类型
+	// Backward compatibility fields - legacy API support
+	OSType     string                // deprecated: use Platform from DriverCacheConfig
+	Serial     string                // deprecated: use Serial from DriverCacheConfig
+	LLMService option.LLMServiceType // deprecated: use AIOptions from DriverCacheConfig
 }
 
 const (
@@ -83,7 +90,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	config.SetAIOptions(configs.AIOptions...)
 
-	switch configs.OSType {
+	switch configs.Platform {
 	case "ios":
 		port, err := configs.getWDALocalPort(configs.Serial)
 		if err != nil {
@@ -123,7 +130,7 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 		)
 	default:
 		// default to android
-		configs.OSType = "android"
+		configs.Platform = "android"
 		config.SetAndroid(
 			option.WithSerialNumber(configs.Serial),
 			option.WithUIA2(configs.UIA2),
@@ -144,11 +151,10 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 	}
 	sessionRunner := caseRunner.NewSession()
 
-	driverCacheConfig := uixt.DriverCacheConfig{
-		Platform:  configs.OSType,
-		Serial:    configs.Serial,
-		AIOptions: config.AIOptions.Options(),
-	}
+	// Use configs directly as it inherits DriverCacheConfig
+	driverCacheConfig := configs.DriverCacheConfig
+	driverCacheConfig.AIOptions = config.AIOptions.Options()
+
 	dExt, err := uixt.GetOrCreateXTDriver(driverCacheConfig)
 	if err != nil {
 		return nil, errors.Wrap(err, "get driver failed")
@@ -181,6 +187,19 @@ func NewUIXTRunner(configs *UIXTConfig) (runner *UIXTRunner, err error) {
 }
 
 func (configs *UIXTConfig) addDefault() {
+	// Handle backward compatibility - sync legacy fields to embedded DriverCacheConfig
+	if configs.OSType != "" && configs.Platform == "" {
+		configs.Platform = configs.OSType
+	}
+	if configs.Serial != "" && configs.DriverCacheConfig.Serial == "" {
+		configs.DriverCacheConfig.Serial = configs.Serial
+	}
+	if configs.LLMService != "" && len(configs.AIOptions) == 0 {
+		configs.AIOptions = []option.AIServiceOption{
+			option.WithLLMService(configs.LLMService),
+		}
+	}
+
 	if configs.Ctx == nil {
 		configs.Ctx = context.Background()
 	}
```

---

### Incident Patch 6: `0dd2f6c2` (2025-08-13)
**Commit Message**: Merge 'fix-tap-offset' into 'master'

fix: miss tap offset option

See merge request: !155

**File**: `CLAUDE.md` (modified, +5/-1)
```diff
@@ -125,4 +125,8 @@ The framework supports both Go and Python plugins:
 ### Build Configuration
 - Static linking for deployment
 - Version info embedded via ldflags
-- Cross-platform builds supported
\ No newline at end of file
+- Cross-platform builds supported
+
+### Code Standards
+- All code comments must be written in English
+- All documentation must be written in Chinese
```

**File**: `uixt/mcp_server.go` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@ func extractActionOptionsToArguments(actionOptions []option.ActionOption, argume
 
 	// Add tap/swipe offset options
 	if len(tempOptions.TapOffset) == 2 {
-		arguments["tap_offset"] = tempOptions.TapOffset
+		arguments["offset"] = tempOptions.TapOffset
 	}
 	if len(tempOptions.SwipeOffset) == 4 {
 		arguments["swipe_offset"] = tempOptions.SwipeOffset
```

**File**: `uixt/mcp_server_test.go` (modified, +86/-7)
```diff
@@ -169,27 +169,106 @@ func TestIgnoreNotFoundErrorOption(t *testing.T) {
 func TestExtractActionOptionsToArguments(t *testing.T) {
 	// Test the extractActionOptionsToArguments helper function
 	actionOptions := []option.ActionOption{
+		// Boolean options
 		option.WithIgnoreNotFoundError(true),
-		option.WithMaxRetryTimes(3),
-		option.WithIndex(2),
 		option.WithRegex(true),
 		option.WithTapRandomRect(false), // false should not be included
-		option.WithDuration(1.5),
+		option.WithAntiRisk(true),
+		option.WithPreMarkOperation(true),
+		option.WithResetHistory(true),
+		option.WithMatchOne(true),
+
+		// Numeric options
+		option.WithMaxRetryTimes(3),
+		option.WithIndex(2),
+		option.WithInterval(1.5),
+		option.WithSteps(10),
+		option.WithTimeout(30),
+		option.WithFrequency(5),
+		option.WithDuration(2.0),
+		option.WithPressDuration(1.5),
+
+		// Offset options (including the fixed offset field)
+		option.WithTapOffset(-300, 0),
+		option.WithSwipeOffset(1, 2, 3, 4),
+		option.WithOffsetRandomRange(-5, 5),
+
+		// Scope options
+		option.WithScope(0.1, 0.2, 0.9, 0.8),
+		option.WithAbsScope(100, 200, 900, 800),
+
+		// Screenshot options
+		option.WithScreenShotOCR(true),
+		option.WithScreenShotUpload(true),
+		option.WithScreenShotLiveType(true),
+		option.WithScreenShotLivePopularity(true),
+		option.WithScreenShotClosePopups(true),
+		option.WithScreenOCRCluster("test_cluster"),
+		option.WithScreenShotFileName("test.png"),
+		option.WithScreenShotUITypes("button", "input"),
+
+		// Direction option
+		option.WithDirection("up"),
+
+		// Identifier
+		option.WithIdentifier("test_id"),
 	}
 
 	arguments := make(map[string]any)
 	extractActionOptionsToArguments(actionOptions, arguments)
 
-	// Verify extracted options
+	// Verify boolean options (only true values should be included)
 	assert.Equal(t, true, arguments["ignore_NotFoundError"], "ignore_NotFoundError should be extracted")
-	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
-	assert.Equal(t, 2, arguments["index"], "index should be extracted")
 	assert.Equal(t, true, arguments["regex"], "regex should be extracted")
-	assert.Equal(t, 1.5, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, true, arguments["anti_risk"], "anti_risk should be extracted")
+	assert.Equal(t, true, arguments["pre_mark_operation"], "pre_mark_operation should be extracted")
+	assert.Equal(t, true, arguments["reset_history"], "reset_history should be extracted")
+	assert.Equal(t, true, arguments["match_one"], "match_one should be extracted")
 
 	// tap_random_rect should not be included since it's false
 	_, exists := arguments["tap_random_rect"]
 	assert.False(t, exists, "tap_random_rect should not be included when false")
+
+	// Verify numeric options
+	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
+	assert.Equal(t, 2, arguments["index"], "index should be extracted")
+	assert.Equal(t, 1.5, arguments["interval"], "interval should be extracted")
+	assert.Equal(t, 10, arguments["steps"], "steps should be extracted")
+	assert.Equal(t, 30, arguments["timeout"], "timeout should be extracted")
+	assert.Equal(t, 5, arguments["frequency"], "frequency should be extracted")
+	assert.Equal(t, 2.0, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, 1.5, arguments["press_duration"], "press_duration should be extracted")
+
+	// Verify offset options (including the critical 'offset' field that was fixed)
+	assert.Equal(t, []int{-300, 0}, arguments["offset"], "offset should be extracted (not tap_offset)")
+	assert.Equal(t, []int{1, 2, 3, 4}, arguments["swipe_offset"], "swipe_offset should be extracted")
+	assert.Equal(t, []int{-5, 5}, arguments["offset_random_range"], "offset_random_range should be extracted")
+
+	// Verify scope options (these are custom types, not raw slices)
+	assert.Equal(t, option.Scope([]float64{0.1, 0.2, 0.9, 0.8}), arguments["scope"], "scope should b
```

---

### Incident Patch 7: `18de536d` (2025-08-13)
**Commit Message**: fix: miss tap offset option

**File**: `CLAUDE.md` (modified, +5/-1)
```diff
@@ -125,4 +125,8 @@ The framework supports both Go and Python plugins:
 ### Build Configuration
 - Static linking for deployment
 - Version info embedded via ldflags
-- Cross-platform builds supported
\ No newline at end of file
+- Cross-platform builds supported
+
+### Code Standards
+- All code comments must be written in English
+- All documentation must be written in Chinese
```

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250812
+v5.0.0-250813
```

**File**: `uixt/mcp_server.go` (modified, +1/-1)
```diff
@@ -301,7 +301,7 @@ func extractActionOptionsToArguments(actionOptions []option.ActionOption, argume
 
 	// Add tap/swipe offset options
 	if len(tempOptions.TapOffset) == 2 {
-		arguments["tap_offset"] = tempOptions.TapOffset
+		arguments["offset"] = tempOptions.TapOffset
 	}
 	if len(tempOptions.SwipeOffset) == 4 {
 		arguments["swipe_offset"] = tempOptions.SwipeOffset
```

**File**: `uixt/mcp_server_test.go` (modified, +86/-7)
```diff
@@ -169,27 +169,106 @@ func TestIgnoreNotFoundErrorOption(t *testing.T) {
 func TestExtractActionOptionsToArguments(t *testing.T) {
 	// Test the extractActionOptionsToArguments helper function
 	actionOptions := []option.ActionOption{
+		// Boolean options
 		option.WithIgnoreNotFoundError(true),
-		option.WithMaxRetryTimes(3),
-		option.WithIndex(2),
 		option.WithRegex(true),
 		option.WithTapRandomRect(false), // false should not be included
-		option.WithDuration(1.5),
+		option.WithAntiRisk(true),
+		option.WithPreMarkOperation(true),
+		option.WithResetHistory(true),
+		option.WithMatchOne(true),
+
+		// Numeric options
+		option.WithMaxRetryTimes(3),
+		option.WithIndex(2),
+		option.WithInterval(1.5),
+		option.WithSteps(10),
+		option.WithTimeout(30),
+		option.WithFrequency(5),
+		option.WithDuration(2.0),
+		option.WithPressDuration(1.5),
+
+		// Offset options (including the fixed offset field)
+		option.WithTapOffset(-300, 0),
+		option.WithSwipeOffset(1, 2, 3, 4),
+		option.WithOffsetRandomRange(-5, 5),
+
+		// Scope options
+		option.WithScope(0.1, 0.2, 0.9, 0.8),
+		option.WithAbsScope(100, 200, 900, 800),
+
+		// Screenshot options
+		option.WithScreenShotOCR(true),
+		option.WithScreenShotUpload(true),
+		option.WithScreenShotLiveType(true),
+		option.WithScreenShotLivePopularity(true),
+		option.WithScreenShotClosePopups(true),
+		option.WithScreenOCRCluster("test_cluster"),
+		option.WithScreenShotFileName("test.png"),
+		option.WithScreenShotUITypes("button", "input"),
+
+		// Direction option
+		option.WithDirection("up"),
+
+		// Identifier
+		option.WithIdentifier("test_id"),
 	}
 
 	arguments := make(map[string]any)
 	extractActionOptionsToArguments(actionOptions, arguments)
 
-	// Verify extracted options
+	// Verify boolean options (only true values should be included)
 	assert.Equal(t, true, arguments["ignore_NotFoundError"], "ignore_NotFoundError should be extracted")
-	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
-	assert.Equal(t, 2, arguments["index"], "index should be extracted")
 	assert.Equal(t, true, arguments["regex"], "regex should be extracted")
-	assert.Equal(t, 1.5, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, true, arguments["anti_risk"], "anti_risk should be extracted")
+	assert.Equal(t, true, arguments["pre_mark_operation"], "pre_mark_operation should be extracted")
+	assert.Equal(t, true, arguments["reset_history"], "reset_history should be extracted")
+	assert.Equal(t, true, arguments["match_one"], "match_one should be extracted")
 
 	// tap_random_rect should not be included since it's false
 	_, exists := arguments["tap_random_rect"]
 	assert.False(t, exists, "tap_random_rect should not be included when false")
+
+	// Verify numeric options
+	assert.Equal(t, 3, arguments["max_retry_times"], "max_retry_times should be extracted")
+	assert.Equal(t, 2, arguments["index"], "index should be extracted")
+	assert.Equal(t, 1.5, arguments["interval"], "interval should be extracted")
+	assert.Equal(t, 10, arguments["steps"], "steps should be extracted")
+	assert.Equal(t, 30, arguments["timeout"], "timeout should be extracted")
+	assert.Equal(t, 5, arguments["frequency"], "frequency should be extracted")
+	assert.Equal(t, 2.0, arguments["duration"], "duration should be extracted")
+	assert.Equal(t, 1.5, arguments["press_duration"], "press_duration should be extracted")
+
+	// Verify offset options (including the critical 'offset' field that was fixed)
+	assert.Equal(t, []int{-300, 0}, arguments["offset"], "offset should be extracted (not tap_offset)")
+	assert.Equal(t, []int{1, 2, 3, 4}, arguments["swipe_offset"], "swipe_offset should be extracted")
+	assert.Equal(t, []int{-5, 5}, arguments["offset_random_range"], "offset_random_range should be extracted")
+
+	// Verify scope options (these are custom types, not raw slices)
+	assert.Equal(t, option.Scope([]float64{0.1, 0.2, 0.9, 0.8}), arguments["scope"], "scope should b
```

---

### Incident Patch 8: `9b695751` (2025-08-12)
**Commit Message**: Revert "feat: 安卓和iOS安装加锁"

This reverts commit 4c9dd3286c1749df74655d9a055cf9c9d75ab5cd.

**File**: `uixt/android_device.go` (modified, +2/-12)
```diff
@@ -13,7 +13,6 @@ import (
 	"regexp"
 	"strconv"
 	"strings"
-	"sync"
 	"time"
 
 	"github.com/httprunner/funplugin/myexec"
@@ -95,9 +94,8 @@ func NewAndroidDevice(opts ...option.AndroidDeviceOption) (device *AndroidDevice
 
 type AndroidDevice struct {
 	*gadb.Device
-	Options      *option.AndroidDeviceOptions
-	Logcat       *AdbLogcat
-	installMutex sync.Mutex // Mutex to lock installation/uninstallation operations
+	Options *option.AndroidDeviceOptions
+	Logcat  *AdbLogcat
 }
 
 func (dev *AndroidDevice) Setup() error {
@@ -156,10 +154,6 @@ func (dev *AndroidDevice) NewDriver() (driver IDriver, err error) {
 }
 
 func (dev *AndroidDevice) Install(apkPath string, opts ...option.InstallOption) error {
-	// Lock the device for installation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	installOpts := option.NewInstallOptions(opts...)
 	brand, err := dev.Device.Brand()
 	if err != nil {
@@ -267,10 +261,6 @@ func (dev *AndroidDevice) installCommon(apkPath string, args ...string) error {
 }
 
 func (dev *AndroidDevice) Uninstall(packageName string) error {
-	// Lock the device for uninstallation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	_, err := dev.Device.Uninstall(packageName)
 	return err
 }
```

**File**: `uixt/ios_device.go` (modified, +0/-10)
```diff
@@ -7,7 +7,6 @@ import (
 	"fmt"
 	"io"
 	"os"
-	"sync"
 	"time"
 
 	"github.com/Masterminds/semver"
@@ -129,7 +128,6 @@ type IOSDevice struct {
 		listener  *forward.ConnListener
 		localPort int
 	}
-	installMutex sync.Mutex // Mutex to lock installation/uninstallation operations
 }
 
 type DeviceDetail struct {
@@ -267,10 +265,6 @@ func (dev *IOSDevice) NewDriver() (driver IDriver, err error) {
 }
 
 func (dev *IOSDevice) Install(appPath string, opts ...option.InstallOption) (err error) {
-	// Lock the device for installation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	installOpts := option.NewInstallOptions(opts...)
 	for i := 0; i <= installOpts.RetryTimes; i++ {
 		var conn *zipconduit.Connection
@@ -290,10 +284,6 @@ func (dev *IOSDevice) Install(appPath string, opts ...option.InstallOption) (err
 }
 
 func (dev *IOSDevice) Uninstall(bundleId string) error {
-	// Lock the device for uninstallation
-	dev.installMutex.Lock()
-	defer dev.installMutex.Unlock()
-
 	svc, err := installationproxy.New(dev.DeviceEntry)
 	if err != nil {
 		return err
```

---

### Incident Patch 9: `07bfabd5` (2025-08-12)
**Commit Message**: Merge branch 'fix-sleep' into 'master'

refactor: unify float64 conversion logic in ToolSleep and ToolSleepMS, enhance error logging

See merge request iesqa/httprunner!152

**File**: `internal/builtin/utils.go` (modified, +7/-24)
```diff
@@ -217,6 +217,8 @@ func Interface2Float64(i interface{}) (float64, error) {
 	case string: // e.g. "1", "0.5"
 		floatVar, err := strconv.ParseFloat(v, 64)
 		if err != nil {
+			log.Error().Err(err).Str("value", v).
+				Msg("convert string to float64 failed")
 			return 0, err
 		}
 		return floatVar, nil
@@ -226,6 +228,10 @@ func Interface2Float64(i interface{}) (float64, error) {
 	if ok {
 		return value.Float64()
 	}
+
+	// Log error for unsupported types
+	log.Error().Interface("value", i).Type("type", i).
+		Msg("convert float64 failed")
 	return 0, errors.New("failed to convert interface to float64")
 }
 
@@ -334,29 +340,6 @@ func IsZeroFloat64(f float64) bool {
 	return math.Abs(f) < threshold
 }
 
-func ConvertToFloat64(val interface{}) (float64, error) {
-	switch v := val.(type) {
-	case float64:
-		return v, nil
-	case int:
-		return float64(v), nil
-	case int64:
-		return float64(v), nil
-	case string:
-		f, err := strconv.ParseFloat(v, 64)
-		if err != nil {
-			log.Error().Err(err).Str("value", v).
-				Msg("convert string to float64 failed")
-			return 0, err
-		}
-		return f, nil
-	default:
-		log.Error().Interface("value", val).Type("type", val).
-			Msg("convert float64 failed")
-		return 0, errors.New("convert float64 error")
-	}
-}
-
 func ConvertToFloat64Slice(val interface{}) ([]float64, error) {
 	if paramsSlice, ok := val.([]float64); ok {
 		return paramsSlice, nil
@@ -369,7 +352,7 @@ func ConvertToFloat64Slice(val interface{}) ([]float64, error) {
 	var err error
 	float64Slice := make([]float64, len(paramsSlice))
 	for i, v := range paramsSlice {
-		float64Slice[i], err = ConvertToFloat64(v)
+		float64Slice[i], err = Interface2Float64(v)
 		if err != nil {
 			return nil, err
 		}
```

**File**: `internal/version/VERSION` (modified, +1/-1)
```diff
@@ -1 +1 @@
-v5.0.0-250811
+v5.0.0-250812
```

**File**: `uixt/mcp_tools_utility.go` (modified, +27/-60)
```diff
@@ -2,9 +2,7 @@ package uixt
 
 import (
 	"context"
-	"encoding/json"
 	"fmt"
-	"strconv"
 	"time"
 
 	"github.com/mark3labs/mcp-go/mcp"
@@ -70,28 +68,12 @@ func (t *ToolSleep) Implement() server.ToolHandlerFunc {
 		// Sleep action logic
 		log.Info().Interface("seconds", seconds).Msg("sleeping")
 
-		var duration time.Duration
-		var actualSeconds float64
-		switch v := seconds.(type) {
-		case float64:
-			actualSeconds = v
-			duration = time.Duration(v*1000) * time.Millisecond
-		case int:
-			actualSeconds = float64(v)
-			duration = time.Duration(v) * time.Second
-		case int64:
-			actualSeconds = float64(v)
-			duration = time.Duration(v) * time.Second
-		case string:
-			s, err := builtin.ConvertToFloat64(v)
-			if err != nil {
-				return nil, fmt.Errorf("invalid sleep duration: %v", v)
-			}
-			actualSeconds = s
-			duration = time.Duration(s*1000) * time.Millisecond
-		default:
-			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
+		// Use Interface2Float64 for unified type conversion
+		actualSeconds, err := builtin.Interface2Float64(seconds)
+		if err != nil {
+			return nil, fmt.Errorf("invalid sleep duration: %v", seconds)
 		}
+		duration := time.Duration(actualSeconds) * time.Second
 
 		// Extract start_time_ms and use sleepStrict for unified sleep logic
 		startTime, err := extractStartTimeMs(request)
@@ -116,19 +98,19 @@ func (t *ToolSleep) ConvertActionToCallToolRequest(action option.MobileAction) (
 	arguments := map[string]any{}
 
 	var seconds float64
-	if param, ok := action.Params.(json.Number); ok {
-		seconds, _ = param.Float64()
-		arguments["seconds"] = seconds
-	} else if param, ok := action.Params.(int64); ok {
-		seconds = float64(param)
-		arguments["seconds"] = seconds
-	} else if sleepConfig, ok := action.Params.(SleepConfig); ok {
+	if sleepConfig, ok := action.Params.(SleepConfig); ok {
 		// When startTime is provided, pass both seconds and startTime
 		seconds = sleepConfig.Seconds
 		arguments["seconds"] = seconds
 		arguments["start_time_ms"] = sleepConfig.StartTime.UnixMilli()
 	} else {
-		return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
+		// Use builtin.Interface2Float64 for unified parameter handling
+		var err error
+		seconds, err = builtin.Interface2Float64(action.Params)
+		if err != nil {
+			return mcp.CallToolRequest{}, fmt.Errorf("invalid sleep params: %v", action.Params)
+		}
+		arguments["seconds"] = seconds
 	}
 
 	return BuildMCPCallToolRequest(t.Name(), arguments, action), nil
@@ -167,28 +149,13 @@ func (t *ToolSleepMS) Implement() server.ToolHandlerFunc {
 		// Sleep MS action logic
 		log.Info().Interface("milliseconds", milliseconds).Msg("sleeping in milliseconds")
 
-		var duration time.Duration
-		var actualMilliseconds int64
-		switch v := milliseconds.(type) {
-		case float64:
-			actualMilliseconds = int64(v)
-			duration = time.Duration(v) * time.Millisecond
-		case int:
-			actualMilliseconds = int64(v)
-			duration = time.Duration(v) * time.Millisecond
-		case int64:
-			actualMilliseconds = v
-			duration = time.Duration(v) * time.Millisecond
-		case string:
-			ms, err := strconv.ParseInt(v, 10, 64)
-			if err != nil {
-				return nil, fmt.Errorf("invalid sleep duration: %v", v)
-			}
-			actualMilliseconds = ms
-			duration = time.Duration(ms) * time.Millisecond
-		default:
-			return nil, fmt.Errorf("unsupported sleep duration type: %T", v)
+		// Use Interface2Float64 for unified type conversion, then convert to int64
+		floatVal, err := builtin.Interface2Float64(milliseconds)
+		if err != nil {
+			return nil, fmt.Errorf("invalid sleep duration: %v", milliseconds)
 		}
+		actualMilliseconds := int64(floatVal)
+		duration := time.Duration(actualMilliseconds) * time.Millisecond
 
 		// Extract start_time_ms and use sleepStrict for unified sleep logic
 		startTime, err := extractStartTimeMs(request)
@@ -212,19 +179,19 @@ func (t *ToolSleepMS) ConvertActionToCallToolRequest(action option.MobileAction)
 
```

**File**: `uixt/mcp_tools_utility_test.go` (modified, +45/-0)
```diff
@@ -30,6 +30,15 @@ func TestToolSleep_ConvertActionToCallToolRequest(t *testing.T) {
 			expectedArgs: map[string]any{"seconds": float64(3.5)},
 			shouldError:  false,
 		},
+		{
+			name: "float64 parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: float64(5.2),
+			},
+			expectedArgs: map[string]any{"seconds": float64(5.2)},
+			shouldError:  false,
+		},
 		{
 			name: "int64 parameter",
 			action: option.MobileAction{
@@ -63,6 +72,24 @@ func TestToolSleep_ConvertActionToCallToolRequest(t *testing.T) {
 			expectedArgs: nil,
 			shouldError:  true,
 		},
+		{
+			name: "json.Number with integer value",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: json.Number("10"),
+			},
+			expectedArgs: map[string]any{"seconds": float64(10)},
+			shouldError:  false,
+		},
+		{
+			name: "json.Number with decimal value",
+			action: option.MobileAction{
+				Method: option.ACTION_Sleep,
+				Params: json.Number("1.25"),
+			},
+			expectedArgs: map[string]any{"seconds": float64(1.25)},
+			shouldError:  false,
+		},
 	}
 
 	for _, tt := range tests {
@@ -109,6 +136,15 @@ func TestToolSleepMS_ConvertActionToCallToolRequest(t *testing.T) {
 			expectedArgs: map[string]any{"milliseconds": int64(2000)},
 			shouldError:  false,
 		},
+		{
+			name: "float64 parameter",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: float64(2500.7),
+			},
+			expectedArgs: map[string]any{"milliseconds": int64(2500)},
+			shouldError:  false,
+		},
 		{
 			name: "SleepConfig with startTime",
 			action: option.MobileAction{
@@ -124,6 +160,15 @@ func TestToolSleepMS_ConvertActionToCallToolRequest(t *testing.T) {
 			},
 			shouldError: false,
 		},
+		{
+			name: "json.Number with decimal value",
+			action: option.MobileAction{
+				Method: option.ACTION_SleepMS,
+				Params: json.Number("1234.56"),
+			},
+			expectedArgs: map[string]any{"milliseconds": int64(1234)},
+			shouldError:  false,
+		},
 		{
 			name: "invalid parameter type",
 			action: option.MobileAction{
```

---

### Incident Patch 10: `9cddad0d` (2025-08-12)
**Commit Message**: Merge branch 'fix/add_wings_log' into 'master'

feat: 新增日志

See merge request iesqa/httprunner!151

**File**: `uixt/ai/wings_service.go` (modified, +3/-0)
```diff
@@ -412,6 +412,9 @@ func (w *WingsService) callWingsAPI(ctx context.Context, request WingsActionRequ
 	}
 	defer resp.Body.Close()
 
+	logID := resp.Header.Get("X-Tt-Logid")
+	log.Info().Str("step_text", request.StepText).Str("log_id", logID).Str("biz_id", request.BizId).Str("url", w.apiURL).Msg("call wings api")
+
 	// Read response body
 	responseBody, err := io.ReadAll(resp.Body)
 	if err != nil {
```

#### Recent Merged Pull Requests:
- **PR #1790** (closed): build(deps): bump github.com/quic-go/quic-go from 0.40.1-0.20231203135336-87ef8ec48d55 to 0.49.1 (@dependabot[bot])
- **PR #1788** (closed): build(deps): bump github.com/quic-go/quic-go from 0.40.1-0.20231203135336-87ef8ec48d55 to 0.48.2 (@dependabot[bot])
- **PR #1783** (2025-08-03): fix: convert AI tests from skip statements to build tags (@debugtalk)
- **PR #1776** (closed): fix: 防止对config的环境做意外修改 (@xyzdev-cell)
- **PR #1770** (closed): add prometheus exporter api in master with new profile flag (@bugVanisher)
- **PR #1769** (closed): 支持 skipIf #1398 (@Danny5487401)
- **PR #1733** (2025-08-04): fix skip错误和增加mark功能和增加meta功能收集用例 (@august-jupiter)
- **PR #1727** (closed): 作者你好，python版增加自定义断言、json参数可整体用变量替换、csv中定义用例名，麻烦看下这样实现合理不 (@diaodeng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
