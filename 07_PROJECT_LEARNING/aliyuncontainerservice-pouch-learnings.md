# Forensic Learning Record (Deep Inspection): AliyunContainerService/pouch

> **Canonical Artifact**: `07_PROJECT_LEARNING/aliyuncontainerservice-pouch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AliyunContainerService/pouch](https://github.com/AliyunContainerService/pouch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:37:32.862Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AliyunContainerService/pouch`
- **Description**: An Efficient Enterprise-class Container Engine
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 4642 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apis/filters/parse.go`
```
package filters

import (
	"encoding/json"
	"errors"
	"path"
	"strings"
)

// Args stores filter arguments as map key:{map key: bool}.
// It contains an aggregation of the map of arguments (which are in the form
// of -f 'key=value') based on the key, and stores values for the same key
// in a map with string keys and boolean values.
// e.g given -f 'label=label1=1' -f 'label=label2=2' -f 'image.name=ubuntu'
// the args will be {"image.name":{"ubuntu":true},"label":{"label1=1":true,"label2=2":true}}
type Args struct {
	fields map[string]map[string]bool
}

// KeyValuePair is used to initialize a new Args
type KeyValuePair struct {
	Key   string
	Value string
}

// Arg creates a new KeyValuePair for initializing Args
func Arg(key, value string) KeyValuePair {
	return KeyValuePair{Key: key, Value: value}
}

// NewArgs returns a new Args populated with the initial args
func NewArgs(initialArgs ...KeyValuePair) Args {
	args := Args{fields: map[string]map[string]bool{}}
	for _, arg := range initialArgs {
		args.Add(arg.Key, arg.Value)
	}
	return args
}

// Contains returns true if the key exists in the mapping
func (args Args) Contains(field string) bool {
	_, ok := args.fields[field]
	return ok
}

// Get returns the list of values associated with the key
func (args Args) Get(key string) []string {
	values := args.fields[key]
	if values == nil {
		return make([]string, 0)
	}
	slice := make([]string, 0, len(values))
	for key := range values {
		slice = append(slice, key)
	}
	return slice
}

// Add a new value to the set of values
func (args Args) Add(key, value string) {
	if _, ok := args.fields[key]; ok {
		args.fields[key][value] = true
	} else {
		args.fields[key] = map[string]bool{value: true}
	}
}

// Del removes a value from the set
func (args Args) Del(key, value string) {
	if _, ok := args.fields[key]; ok {
		delete(args.fields[key], value)
		if len(args.fields[key]) == 0 {
			delete(args.fields, key)
		}
	}
}

// Len returns the number of fields in the arguments.
func (args Args) Len() int {
	return len(args.fields)
}

// ExactMatch returns true if the source matches exactly one of the filters.
func (args Args) ExactMatch(field, source string) bool {
	fieldValues, ok := args.fields[field]
	//do not filter if there is no filter set or cannot determine filter
	if !ok || len(fieldValues) == 0 {
		return true
	}

	// try to match full name value to avoid O(N) regular expression matching
	return fieldValues[source]
}

// MarshalJSON returns a JSON byte representation of the Args
func (args Args) MarshalJSON() ([]byte, error) {
	if len(args.fields) == 0 {
		return []byte{}, nil
	}
	return json.Marshal(args.fields)
}

// UnmarshalJSON populates the Args from JSON encode bytes
func (args Args) UnmarshalJSON(raw []byte) error {
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, &args.fields)
}

// ErrBadFormat is an error returned when a filter is not in the form key=value
var ErrBadFormat = errors.New("bad format of filter (expected name=value)")

// ParseFlag parses a key=value string and adds it to an Args.
func ParseFlag(arg string, prev Args) (Args, error) {
	filters := prev
	if len(arg) == 0 {
		return filters, nil
	}

	if !strings.Contains(arg, "=") {
		return filters, ErrBadFormat
	}

	f := strings.SplitN(arg, "=", 2)

	name := strings.ToLower(strings.TrimSpace(f[0]))
	value := strings.TrimSpace(f[1])

	filters.Add(name, value)

	return filters, nil
}

// ToParam packs the Args into a string for easy transport from client to server.
func ToParam(a Args) (string, error) {
	if a.Len() == 0 {
		return "", nil
	}

	buf, err := json.Marshal(a)
	return string(buf), err
}

// FromParam decodes a JSON encoded string into Args
func FromParam(p string) (Args, error) {
	args := NewArgs()

	if p == "" {
		return args, nil
	}

	raw := []byte(p)
	err := json.Unmarshal(raw, &args)
	return args, err
}

// FromFilterOpts parse key=value to Args string from cli opts
func FromFilterOpts(filter []string) (Args, error) {
	filterArgs := NewArgs()

	for _, f := range filter {
		var err error
		filterArgs, err = ParseFlag(f, filterArgs)
		if err != nil {
			return filterArgs, err
		}
	}
	return filterArgs, nil
}

// Validate compared the set of accepted keys against the keys in the mapping.
// An error is returned if any mapping keys are not in the accepted set.
func (args Args) Validate(accepted map[string]bool) error {
	for name := range args.fields {
		if !accepted[name] {
			return errors.New("invalid filter " + name)
		}
	}
	return nil
}

// FamiliarMatch decide the ref match the pattern or not
func FamiliarMatch(pattern string, ref string) (bool, error) {
	return path.Match(pattern, ref)
}

// MatchKVList returns true if all the pairs in sources exist as key=value
// pairs in the mapping at key, or if there are no values at key.
func (args Args) MatchKVList(key string, sources map[string]string) bool {
	fieldValues := args.fields[key]

	// do not filter if there is no filter set or cannot determine filter
	if len(fieldValues) == 0 {
		return true
	}

	if len(sources) == 0 {
		return false
	}

	for value := range fieldValues {
		attrKV := strings.SplitN(value, "=", 2)

		v, ok := sources[attrKV[0]]
		if !ok {
			return false
		}
		if len(attrKV) == 2 && attrKV[1] != v {
			return false
		}
	}

	return true
}

```

### Core Architecture Module: `apis/metrics/metrics.go`
```
package metrics

import (
	"sync"

	"github.com/alibaba/pouch/pkg/utils/metrics"
)

func init() {
	// Register prometheus metrics.
	Register()
}

const (
	subsystemPouch = "daemon"
)

var (
	// ImagePullSummary records the summary of pulling image latency.
	ImagePullSummary = metrics.NewLabelSummary(subsystemPouch, "image_pull_latency_microseconds", "Latency in microseconds to pull a image.", "image")

	// ContainerActionsCounter records the number of container operations.
	ContainerActionsCounter = metrics.NewLabelCounter(subsystemPouch, "container_actions_counter", "The number of container operations", "action")

	// ContainerSuccessActionsCounter records the number of container success operations.
	ContainerSuccessActionsCounter = metrics.NewLabelCounter(subsystemPouch, "container_success_actions_counter", "The number of container success operations", "action")

	// ImageActionsCounter records the number of image operations.
	ImageActionsCounter = metrics.NewLabelCounter(subsystemPouch, "image_actions_counter", "The number of image operations", "action")

	// ImageSuccessActionsCounter the number of image success operations.
	ImageSuccessActionsCounter = metrics.NewLabelCounter(subsystemPouch, "image_success_actions_counter", "The number of image success operations", "action")

	// ContainerActionsTimer records the time cost of each container action.
	ContainerActionsTimer = metrics.NewLabelTimer(subsystemPouch, "container_actions", "The number of seconds it takes to process each container action", "action")

	// ImageActionsTimer records the time cost of each image action.
	ImageActionsTimer = metrics.NewLabelTimer(subsystemPouch, "image_actions", "The number of seconds it takes to process each image action", "action")

	// EngineVersion records the version and commit information of the engine process.
	EngineVersion = metrics.NewLabelGauge(subsystemPouch, "engine", "The version and commit information of the engine process", "commit", "version", "kernel")
)

var registerMetrics sync.Once

// Register all metrics.
func Register() {
	// Get a prometheus registry.
	registry := metrics.GetPrometheusRegistry()
	registerMetrics.Do(func() {
		// Register the custom metrics.
		registry.MustRegister(ImagePullSummary)
		registry.MustRegister(EngineVersion)
		registry.MustRegister(ContainerActionsCounter)
		registry.MustRegister(ContainerSuccessActionsCounter)
		registry.MustRegister(ImageActionsCounter)
		registry.MustRegister(ImageSuccessActionsCounter)
		registry.MustRegister(ContainerActionsTimer)
		registry.MustRegister(ImageActionsTimer)
	})
}

```

### Core Architecture Module: `apis/opts/config/blkio.go`
```
package config

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/alibaba/pouch/apis/types"

	units "github.com/docker/go-units"
)

const blkioOptsType = "strings"

// WeightDevice defines weight device
type WeightDevice struct {
	values []*types.WeightDevice
}

func getValidateWeightDevice(val string) (*types.WeightDevice, error) {
	pairs := strings.Split(val, ":")
	if len(pairs) != 2 {
		return nil, fmt.Errorf("invalid weight device %s: format must be <device-id>:<weight> with weight in range [10, 1000]", val)
	}

	weight, err := strconv.ParseUint(pairs[1], 10, 0)
	if err != nil {
		return nil, fmt.Errorf("invalid weight device %s: weight cannot be less than 0", val)
	}
	if weight > 0 && (weight < 10 || weight > 1000) {
		return nil, fmt.Errorf("invalid weight device %s: weight must be in range [10, 1000]", val)
	}

	return &types.WeightDevice{
		Path:   pairs[0],
		Weight: uint16(weight),
	}, nil
}

// Set implement WeightDevice as pflag.Value interface
func (w *WeightDevice) Set(val string) error {
	v, err := getValidateWeightDevice(val)
	if err != nil {
		return err
	}
	w.values = append(w.values, v)

	return nil
}

// String implement WeightDevice as pflag.Value interface
func (w *WeightDevice) String() string {
	var str []string
	for _, v := range w.values {
		str = append(str, fmt.Sprintf("%s:%d", v.Path, v.Weight))
	}

	return fmt.Sprintf("%v", str)
}

// Type implement WeightDevice as pflag.Value interface
func (w *WeightDevice) Type() string {
	return blkioOptsType
}

// Value returns all values as type WeightDevice
func (w *WeightDevice) Value() []*types.WeightDevice {
	var weightDevice []*types.WeightDevice
	weightDevice = append(weightDevice, w.values...)

	return weightDevice
}

// ThrottleBpsDevice defines throttle bps device
type ThrottleBpsDevice struct {
	values []*types.ThrottleDevice
}

func getValidThrottleDeviceBps(val string) (*types.ThrottleDevice, error) {
	pairs := strings.Split(val, ":")
	if len(pairs) != 2 {
		return nil, fmt.Errorf("invalid throttle device %s: format must be <device-id>:<rate> with optional rate unit", val)
	}

	rate, err := units.RAMInBytes(pairs[1])
	if err != nil || rate < 0 {
		return nil, fmt.Errorf("invalid rate %s for device %s: cannot be negative", pairs[1], pairs[0])
	}

	return &types.ThrottleDevice{
		Path: pairs[0],
		Rate: uint64(rate),
	}, nil
}

// Set implement ThrottleBpsDevice as pflag.Value interface
func (t *ThrottleBpsDevice) Set(val string) error {
	v, err := getValidThrottleDeviceBps(val)
	if err != nil {
		return err
	}
	t.values = append(t.values, v)

	return nil
}

// String implement ThrottleBpsDevice as pflag.Value interface
func (t *ThrottleBpsDevice) String() string {
	var str []string
	for _, v := range t.values {
		str = append(str, fmt.Sprintf("%s:%d", v.Path, v.Rate))
	}

	return fmt.Sprintf("%v", str)
}

// Type implement ThrottleBpsDevice as pflag.Value interface
func (t *ThrottleBpsDevice) Type() string {
	return blkioOptsType
}

// Value returns all values as type ThrottleDevice
func (t *ThrottleBpsDevice) Value() []*types.ThrottleDevice {
	var throttleDevice []*types.ThrottleDevice
	throttleDevice = append(throttleDevice, t.values...)

	return throttleDevice
}

// ThrottleIOpsDevice defines throttle iops device
type ThrottleIOpsDevice struct {
	values []*types.ThrottleDevice
}

func getValidThrottleDeviceIOps(val string) (*types.ThrottleDevice, error) {
	pairs := strings.Split(val, ":")
	if len(pairs) != 2 {
		return nil, fmt.Errorf("invalid throttle device %s: format must be <device-id>:<rate> with optional rate unit", val)
	}

	rate, err := strconv.ParseUint(pairs[1], 10, 64)
	if err != nil || rate < 0 {
		return nil, fmt.Errorf("invalid rate %s for device %s: rate cannot be negative", pairs[1], pairs[0])
	}

	return &types.ThrottleDevice{
		Path: pairs[0],
		Rate: uint64(rate),
	}, nil
}

// Set implement ThrottleIOpsDevice as pflag.Value interface
func (t *ThrottleIOpsDevice) Set(val string) error {
	v, err := getValidThrottleDeviceIOps(val)
	if err != nil {
		return err
	}
	t.values = append(t.values, v)

	return nil
}

// String implement ThrottleIOpsDevice as pflag.Value interface
func (t *ThrottleIOpsDevice) String() string {
	var str []string
	for _, v := range t.values {
		str = append(str, fmt.Sprintf("%s:%d", v.Path, v.Rate))
	}

	return fmt.Sprintf("%v", str)
}

// Type implement ThrottleIOpsDevice as pflag.Value interface
func (t *ThrottleIOpsDevice) Type() string {
	return blkioOptsType
}

// Value returns all values
func (t *ThrottleIOpsDevice) Value() []*types.ThrottleDevice {
	var throttleDevice []*types.ThrottleDevice
	throttleDevice = append(throttleDevice, t.values...)

	return throttleDevice
}

```

### Core Architecture Module: `apis/opts/config/runtime.go`
```
package config

import (
	"fmt"
	"strings"

	"github.com/alibaba/pouch/apis/types"
)

// Runtime defines runtimes information
type Runtime struct {
	values *map[string]types.Runtime
}

// NewRuntime initials a Runtime struct
func NewRuntime(rts *map[string]types.Runtime) *Runtime {
	if rts == nil {
		rts = &map[string]types.Runtime{}
	}

	if *rts == nil {
		*rts = map[string]types.Runtime{}
	}

	rt := &Runtime{values: rts}
	return rt
}

// Set implement Runtime as pflag.Value interface
func (r *Runtime) Set(val string) error {
	splits := strings.Split(val, "=")
	if len(splits) != 2 || splits[0] == "" || splits[1] == "" {
		return fmt.Errorf("invalid runtime %s, correct format must be runtime=path", val)
	}

	name := splits[0]
	path := splits[1]
	if _, exist := (*r.values)[name]; exist {
		return fmt.Errorf("runtime %s already registers to daemon", name)
	}

	(*r.values)[name] = types.Runtime{Path: path}
	return nil
}

// String implement Runtime as pflag.Value interface
func (r *Runtime) String() string {
	var str []string
	for k := range *r.values {
		str = append(str, k)
	}

	return fmt.Sprintf("%v", str)
}

// Type implement Runtime as pflag.Value interface
func (r *Runtime) Type() string {
	return "runtime"
}

```

### Core Architecture Module: `apis/opts/config/ulimit.go`
```
package config

import (
	"fmt"

	"github.com/alibaba/pouch/apis/types"

	units "github.com/docker/go-units"
)

// Ulimit defines ulimit options.
type Ulimit struct {
	values map[string]*units.Ulimit
}

// Set implement Ulimit as pflag.Value interface.
func (u *Ulimit) Set(val string) error {
	ul, err := units.ParseUlimit(val)
	if err != nil {
		return err
	}

	if u.values == nil {
		u.values = make(map[string]*units.Ulimit)
	}

	u.values[ul.Name] = ul
	return nil
}

// String implement Ulimit as pflag.Value interface.
func (u *Ulimit) String() string {
	var str []string
	for _, ul := range u.values {
		str = append(str, ul.String())
	}

	return fmt.Sprintf("%v", str)
}

// Type implement Ulimit as pflag.Value interface.
func (u *Ulimit) Type() string {
	return "ulimit"
}

// Value return ulimit values as type Ulimit
func (u *Ulimit) Value() []*types.Ulimit {
	var ulimit []*types.Ulimit
	for _, ul := range u.values {
		ulimit = append(ulimit, &types.Ulimit{
			Name: ul.Name,
			Hard: ul.Hard,
			Soft: ul.Soft,
		})
	}

	return ulimit
}

```

### Core Architecture Module: `apis/opts/config/volumes.go`
```
package config

import (
	"fmt"
)

// Volumes holds a list of values.
type Volumes struct {
	values *[]string
}

// NewVolumes creates a new Volumes.
func NewVolumes(v *Volumes) *Volumes {
	var values []string
	if v == nil {
		v = &Volumes{}
	}
	if v.values == nil {
		v.values = &values
	}
	return v
}

// Set implement Volumes as pflag.Value interface.
func (v *Volumes) Set(val string) error {
	for _, s := range *v.values {
		if s == val {
			return nil
		}
	}
	(*v.values) = append((*v.values), val)
	return nil
}

// String implement Volumes as pflag.Value interface.
func (v *Volumes) String() string {
	return fmt.Sprintf("%v", *v.values)
}

// Type implement Volumes as pflag.Value interface.
func (v *Volumes) Type() string {
	return "volumes"
}

// Value return values as type Volumes
func (v *Volumes) Value() []string {
	return (*v.values)
}

```

### Core Architecture Module: `apis/opts/devicemappings.go`
```
package opts

import (
	"fmt"
	"strings"

	"github.com/alibaba/pouch/apis/types"
)

// ParseDeviceMappings parse devicemappings
func ParseDeviceMappings(devices []string) ([]*types.DeviceMapping, error) {
	results := []*types.DeviceMapping{}
	for _, device := range devices {
		deviceMapping, err := parseDevice(device)
		if err != nil {
			return nil, fmt.Errorf("failed to parse devices: %v", err)
		}

		if !ValidateDeviceMode(deviceMapping.CgroupPermissions) {
			return nil, fmt.Errorf("%s invalid device mode: %s", device, deviceMapping.CgroupPermissions)
		}

		results = append(results, deviceMapping)
	}
	return results, nil

}

// parseDevice parses a device mapping string to a container.DeviceMapping struct
func parseDevice(device string) (*types.DeviceMapping, error) {
	src := ""
	dst := ""
	permissions := "rwm"
	arr := strings.Split(device, ":")
	switch len(arr) {
	case 3:
		permissions = arr[2]
		fallthrough
	case 2:
		dst = arr[1]
		fallthrough
	case 1:
		src = arr[0]
	default:
		return nil, fmt.Errorf("invalid device specification: %s", device)
	}

	if dst == "" {
		dst = src
	}

	deviceMapping := &types.DeviceMapping{
		PathOnHost:        src,
		PathInContainer:   dst,
		CgroupPermissions: permissions,
	}
	return deviceMapping, nil
}

// ValidateDeviceMode checks if the mode for device is valid or not.
// valid mode is a composition of r (read), w (write), and m (mknod).
func ValidateDeviceMode(mode string) bool {
	var legalDeviceMode = map[rune]bool{
		'r': true,
		'w': true,
		'm': true,
	}
	if mode == "" {
		return false
	}
	for _, c := range mode {
		if !legalDeviceMode[c] {
			return false
		}
		legalDeviceMode[c] = false
	}
	return true
}

```

### Core Architecture Module: `apis/opts/diskquota.go`
```
package opts

import (
	"fmt"
	"strings"
)

// ParseDiskQuota parses diskquota configurations of container.
func ParseDiskQuota(quotas []string) (map[string]string, error) {
	var quotaMaps = make(map[string]string)

	for _, quota := range quotas {
		if quota == "" {
			return nil, fmt.Errorf("invalid format for disk quota: quota cannot be empty string")
		}

		parts := strings.Split(quota, "=")
		switch len(parts) {
		case 1:
			quotaMaps[".*"] = parts[0]
		case 2:
			quotaMaps[parts[0]] = parts[1]
		default:
			return nil, fmt.Errorf("invalid format for disk quota: %s", quota)
		}
	}

	return quotaMaps, nil
}

// ValidateDiskQuota verifies diskquota configurations of container.
func ValidateDiskQuota(quotaMaps map[string]string) error {
	// TODO
	return nil
}

// ParseQuotaID parses quota id configurations of container.
func ParseQuotaID(id string, quotas []string) (string, error) {
	switch len(quotas) {
	case 0:
		if isSetQuotaID(id) {
			return "", fmt.Errorf("invalid to set quota id(%s) without disk-quota", id)
		}
	case 1:
		if isSetQuotaID(id) {
			return id, nil
		}

		parts := strings.Split(quotas[0], "=")
		if len(parts) == 1 {
			return "-1", nil
		}
	default:
		if isSetQuotaID(id) {
			return "", fmt.Errorf("invalid to set quota id(%s) for multi disk-quota", id)
		}
	}

	return id, nil
}

func isSetQuotaID(id string) bool {
	return id != "" && id != "0"
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3059** (2024-08-22): **fix: close /proc/1/mountinfo**
  *Symptoms*: <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did   ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   

- **Issue #3057** (2023-09-11): **[Bugfix] fix issue of container escape when pouch cp**
  *Symptoms*: <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did  The PR fixed issue that resolvedPath can escape from container to host by using symlink when pouch cp.   ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   
  **Post-Mortem & Fix Analysis**:
  > LGTM

- **Issue #3054** (2023-05-04): **[Bugfix] fix nil pointer**
  *Symptoms*: <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did fix nil pointer  ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   

- **Issue #3053** (2023-04-24): **fix containerd CVE-2023-25153**
  *Symptoms*:  <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did fix containerd CVE-2023-25153 https://github.com/containerd/containerd/security/advisories/GHSA-259w-8hf6-59c2   ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   
  **Post-Mortem & Fix Analysis**:
  > lgtm

- **Issue #3049** (2022-11-09): **version: bump to v1.3.1**
  *Symptoms*: bump verison to v1.3.1  Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>  <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did   ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   

- **Issue #3048** (2022-11-07): **AdditionalGids must include effective group ID**
  *Symptoms*: cherry-pick moby commit: https://github.com/moby/moby/commit/e44d7f735ef6e59e0a724e1920f19f288b30a331  Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>  <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did   ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   
  **Post-Mortem & Fix Analysis**:
  > lgtm

- **Issue #3047** (2022-09-29): **fix CVE-2022-24769**
  *Symptoms*: Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>  <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did   ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   
  **Post-Mortem & Fix Analysis**:
  > lgtm

- **Issue #3046** (2022-09-20): **fix cve-2022-31030**
  *Symptoms*: refer to containerd fix: https://github.com/containerd/containerd/commit/2eb67213b8ec38f5d7233cf0098763d9364e2a17  Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>  <!--  Please make sure you have read and understood the contributing guidelines; https://github.com/alibaba/pouch/blob/master/CONTRIBUTING.md -->  ### Ⅰ. Describe what this PR did fixes cve-2022-31030  ### Ⅱ. Does this pull request fix one issue? <!--If that, add "fixes #xxxx" below in the next line, for example, fixes #15. Otherwise, add "NONE" -->   ### Ⅲ. Why don't you add test cases (unit test/integration test)? (你真的觉得不需要加测试吗？)    ### Ⅳ. Describe how to verify it   ### Ⅴ. Special notes for reviews   
  **Post-Mortem & Fix Analysis**:
  > lgtm

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

### Incident Patch 1: `ba854f2d` (2024-05-06)
**Commit Message**: fix: close /proc/1/mountinfo

**File**: `lxcfs/lxcfs.go` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ func CheckLxcfsMount() error {
 	if err != nil {
 		return fmt.Errorf("Check lxcfs mounts failed: %v", err)
 	}
+	defer f.Close()
 	fr := bufio.NewReader(f)
 	for {
 		line, err := fr.ReadBytes('\n')
```

---

### Incident Patch 2: `8680cc4c` (2023-09-11)
**Commit Message**: [Bugfix] fix issue of container escape when pouch cp

Signed-off-by: Jiren Mai <1151937289@qq.com>

**File**: `vendor/github.com/docker/docker/NOTICE` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Copyright 2012-2017 Docker, Inc.
 
 This product includes software developed at Docker, Inc. (https://www.docker.com).
 
-This product contains software (https://github.com/kr/pty) developed
+This product contains software (https://github.com/creack/pty) developed
 by Keith Rarick, licensed under the MIT License.
 
 The following is courtesy of our legal counsel:
```

**File**: `vendor/github.com/docker/docker/pkg/chrootarchive/archive.go` (modified, +37/-4)
```diff
@@ -4,13 +4,22 @@ import (
 	"fmt"
 	"io"
 	"io/ioutil"
+	"net"
 	"os"
+	"os/user"
 	"path/filepath"
 
 	"github.com/docker/docker/pkg/archive"
 	"github.com/docker/docker/pkg/idtools"
 )
 
+func init() {
+	// initialize nss libraries in Glibc so that the dynamic libraries are loaded in the host
+	// environment not in the chroot from untrusted files.
+	_, _ = user.Lookup("docker")
+	_, _ = net.LookupHost("localhost")
+}
+
 // NewArchiver returns a new Archiver which uses chrootarchive.Untar
 func NewArchiver(idMapping *idtools.IdentityMapping) *archive.Archiver {
 	if idMapping == nil {
@@ -27,18 +36,34 @@ func NewArchiver(idMapping *idtools.IdentityMapping) *archive.Archiver {
 // The archive may be compressed with one of the following algorithms:
 //  identity (uncompressed), gzip, bzip2, xz.
 func Untar(tarArchive io.Reader, dest string, options *archive.TarOptions) error {
-	return untarHandler(tarArchive, dest, options, true)
+	return untarHandler(tarArchive, dest, options, true, dest)
+}
+
+// UntarWithRoot is the same as `Untar`, but allows you to pass in a root directory
+// The root directory is the directory that will be chrooted to.
+// `dest` must be a path within `root`, if it is not an error will be returned.
+//
+// `root` should set to a directory which is not controlled by any potentially
+// malicious process.
+//
+// This should be used to prevent a potential attacker from manipulating `dest`
+// such that it would provide access to files outside of `dest` through things
+// like symlinks. Normally `ResolveSymlinksInScope` would handle this, however
+// sanitizing symlinks in this manner is inherrently racey:
+// ref: CVE-2018-15664
+func UntarWithRoot(tarArchive io.Reader, dest string, options *archive.TarOptions, root string) error {
+	return untarHandler(tarArchive, dest, options, true, root)
 }
 
 // UntarUncompressed reads a stream of bytes from `archive`, parses it as a tar archive,
 // and unpacks it into the directory at `dest`.
 // The archive must be an uncompressed stream.
 func UntarUncompressed(tarArchive io.Reader, dest string, options *archive.TarOptions) error {
-	return untarHandler(tarArchive, dest, options, false)
+	return untarHandler(tarArchive, dest, options, false, dest)
 }
 
 // Handler for teasing out the automatic decompression
-func untarHandler(tarArchive io.Reader, dest string, options *archive.TarOptions, decompress bool) error {
+func untarHandler(tarArchive io.Reader, dest string, options *archive.TarOptions, decompress bool, root string) error {
 	if tarArchive == nil {
 		return fmt.Errorf("Empty archive")
 	}
@@ -69,5 +94,13 @@ func untarHandler(tarArchive io.Reader, dest string, options *archive.TarOptions
 		r = decompressedArchive
 	}
 
-	return invokeUnpack(r, dest, options)
+	return invokeUnpack(r, dest, options, root)
+}
+
+// Tar tars the requested path while chrooted to the specified root.
+func Tar(srcPath string, options *archive.TarOptions, root string) (io.ReadCloser, error) {
+	if options == nil {
+		options = &archive.TarOptions{}
+	}
+	return invokePack(srcPath, options, root)
 }
```

**File**: `vendor/github.com/docker/docker/pkg/chrootarchive/archive_unix.go` (modified, +125/-5)
```diff
@@ -10,10 +10,13 @@ import (
 	"io"
 	"io/ioutil"
 	"os"
+	"path/filepath"
 	"runtime"
+	"strings"
 
 	"github.com/docker/docker/pkg/archive"
 	"github.com/docker/docker/pkg/reexec"
+	"github.com/pkg/errors"
 )
 
 // untar is the entry-point for docker-untar on re-exec. This is not used on
@@ -23,18 +26,28 @@ func untar() {
 	runtime.LockOSThread()
 	flag.Parse()
 
-	var options *archive.TarOptions
+	var options archive.TarOptions
 
 	//read the options from the pipe "ExtraFiles"
 	if err := json.NewDecoder(os.NewFile(3, "options")).Decode(&options); err != nil {
 		fatal(err)
 	}
 
-	if err := chroot(flag.Arg(0)); err != nil {
+	dst := flag.Arg(0)
+	var root string
+	if len(flag.Args()) > 1 {
+		root = flag.Arg(1)
+	}
+
+	if root == "" {
+		root = dst
+	}
+
+	if err := chroot(root); err != nil {
 		fatal(err)
 	}
 
-	if err := archive.Unpack(os.Stdin, "/", options); err != nil {
+	if err := archive.Unpack(os.Stdin, dst, &options); err != nil {
 		fatal(err)
 	}
 	// fully consume stdin in case it is zero padded
@@ -45,7 +58,10 @@ func untar() {
 	os.Exit(0)
 }
 
-func invokeUnpack(decompressedArchive io.Reader, dest string, options *archive.TarOptions) error {
+func invokeUnpack(decompressedArchive io.Reader, dest string, options *archive.TarOptions, root string) error {
+	if root == "" {
+		return errors.New("must specify a root to chroot to")
+	}
 
 	// We can't pass a potentially large exclude list directly via cmd line
 	// because we easily overrun the kernel's max argument/environment size
@@ -57,7 +73,21 @@ func invokeUnpack(decompressedArchive io.Reader, dest string, options *archive.T
 		return fmt.Errorf("Untar pipe failure: %v", err)
 	}
 
-	cmd := reexec.Command("docker-untar", dest)
+	if root != "" {
+		relDest, err := filepath.Rel(root, dest)
+		if err != nil {
+			return err
+		}
+		if relDest == "." {
+			relDest = "/"
+		}
+		if relDest[0] != '/' {
+			relDest = "/" + relDest
+		}
+		dest = relDest
+	}
+
+	cmd := reexec.Command("docker-untar", dest, root)
 	cmd.Stdin = decompressedArchive
 
 	cmd.ExtraFiles = append(cmd.ExtraFiles, r)
@@ -69,6 +99,7 @@ func invokeUnpack(decompressedArchive io.Reader, dest string, options *archive.T
 		w.Close()
 		return fmt.Errorf("Untar error on re-exec cmd: %v", err)
 	}
+
 	//write the options to the pipe for the untar exec to read
 	if err := json.NewEncoder(w).Encode(options); err != nil {
 		w.Close()
@@ -86,3 +117,92 @@ func invokeUnpack(decompressedArchive io.Reader, dest string, options *archive.T
 	}
 	return nil
 }
+
+func tar() {
+	runtime.LockOSThread()
+	flag.Parse()
+
+	src := flag.Arg(0)
+	var root string
+	if len(flag.Args()) > 1 {
+		root = flag.Arg(1)
+	}
+
+	if root == "" {
+		root = src
+	}
+
+	if err := realChroot(root); err != nil {
+		fatal(err)
+	}
+
+	var options archive.TarOptions
+	if err := json.NewDecoder(os.Stdin).Decode(&options); err != nil {
+		fatal(err)
+	}
+
+	rdr, err := archive.TarWithOptions(src, &options)
+	if err != nil {
+		fatal(err)
+	}
+	defer rdr.Close()
+
+	if _, err := io.Copy(os.Stdout, rdr); err != nil {
+		fatal(err)
+	}
+
+	os.Exit(0)
+}
+
+func invokePack(srcPath string, options *archive.TarOptions, root string) (io.ReadCloser, error) {
+	if root == "" {
+		return nil, errors.New("root path must not be empty")
+	}
+
+	relSrc, err := filepath.Rel(root, srcPath)
+	if err != nil {
+		return nil, err
+	}
+	if relSrc == "." {
+		relSrc = "/"
+	}
+	if relSrc[0] != '/' {
+		relSrc = "/" + relSrc
+	}
+
+	// make sure we didn't trim a trailing slash with the call to `Rel`
+	if strings.HasSuffix(srcPath, "/") && !strings.HasSuffix(relSrc, "/") {
+		relSrc += "/"
+	}
+
+	cmd := reexec.Command("docker-tar", relSrc, root)
+
+	errBuff := bytes.NewBuffer(nil)
+	cmd.Stderr = errBuff
+
+	tarR, tarW := io.Pipe()
+	cmd.Stdout = tarW
+
+	stdin, err := cmd.StdinPipe()
+	if err != nil {
+		return nil, errors.Wrap(err, "error getting options pipe for tar process")
+	}
+
+	if err := cmd.Start(); err != nil {
+		return nil, errors.Wrap(err, "tar 
```

**File**: `vendor/github.com/docker/docker/pkg/chrootarchive/archive_windows.go` (modified, +8/-1)
```diff
@@ -14,9 +14,16 @@ func chroot(path string) error {
 
 func invokeUnpack(decompressedArchive io.ReadCloser,
 	dest string,
-	options *archive.TarOptions) error {
+	options *archive.TarOptions, root string) error {
 	// Windows is different to Linux here because Windows does not support
 	// chroot. Hence there is no point sandboxing a chrooted process to
 	// do the unpack. We call inline instead within the daemon process.
 	return archive.Unpack(decompressedArchive, longpath.AddPrefix(dest), options)
 }
+
+func invokePack(srcPath string, options *archive.TarOptions, root string) (io.ReadCloser, error) {
+	// Windows is different to Linux here because Windows does not support
+	// chroot. Hence there is no point sandboxing a chrooted process to
+	// do the pack. We call inline instead within the daemon process.
+	return archive.TarWithOptions(srcPath, options)
+}
```

**File**: `vendor/github.com/docker/docker/pkg/chrootarchive/chroot_unix.go` (modified, +4/-0)
```diff
@@ -10,3 +10,7 @@ func chroot(path string) error {
 	}
 	return unix.Chdir("/")
 }
+
+func realChroot(path string) error {
+	return chroot(path)
+}
```

---

### Incident Patch 3: `53678c2b` (2023-05-04)
**Commit Message**: [Bugfix] fix nil pointer

fix nil pointer

Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>

**File**: `cli/stats_helpers.go` (modified, +1/-1)
```diff
@@ -156,7 +156,7 @@ func collect(ctx context.Context, s *StatsEntryWithLock, cli client.CommonAPICli
 	go func() {
 		for {
 			var (
-				v                      *types.ContainerStats
+				v                      types.ContainerStats
 				memPercent, cpuPercent float64
 				blkRead, blkWrite      uint64
 				mem, memLimit          float64
```

---

### Incident Patch 4: `049f9905` (2023-04-24)
**Commit Message**: fix containerd CVE-2023-25153

https://github.com/containerd/containerd/security/advisories/GHSA-259w-8hf6-59c2

Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>

**File**: `vendor/github.com/containerd/containerd/images/archive/importer.go` (modified, +7/-9)
```diff
@@ -23,7 +23,6 @@ import (
 	"context"
 	"encoding/json"
 	"io"
-	"io/ioutil"
 	"path"
 
 	"github.com/containerd/containerd/archive/compression"
@@ -192,15 +191,14 @@ func ImportIndex(ctx context.Context, store content.Store, reader io.Reader) (oc
 	return writeManifest(ctx, store, idx, ocispec.MediaTypeImageIndex)
 }
 
+const (
+	kib       = 1024
+	mib       = 1024 * kib
+	jsonLimit = 20 * mib
+)
+
 func onUntarJSON(r io.Reader, j interface{}) error {
-	b, err := ioutil.ReadAll(r)
-	if err != nil {
-		return err
-	}
-	if err := json.Unmarshal(b, j); err != nil {
-		return err
-	}
-	return nil
+	return json.NewDecoder(io.LimitReader(r, jsonLimit)).Decode(j)
 }
 
 func onUntarBlob(ctx context.Context, r io.Reader, store content.Ingester, size int64, ref string) (digest.Digest, error) {
```

---

### Incident Patch 5: `3cad3d65` (2022-09-29)
**Commit Message**: fix CVE-2022-24769

Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>

**File**: `daemon/mgr/container_exec.go` (modified, +3/-4)
```diff
@@ -121,10 +121,9 @@ func (mgr *ContainerManager) StartExec(ctx context.Context, execid string, cfg *
 	if execConfig.Privileged {
 		capList := caps.GetAllCapabilities()
 		process.Capabilities = &specs.LinuxCapabilities{
-			Effective:   capList,
-			Bounding:    capList,
-			Permitted:   capList,
-			Inheritable: capList,
+			Effective: capList,
+			Bounding:  capList,
+			Permitted: capList,
 		}
 	} else if spec, err := mgr.getContainerSpec(c); err == nil {
 		// NOTE: if container is created by docker and taken over by pouchd,
```

**File**: `daemon/mgr/spec_process.go` (modified, +0/-1)
```diff
@@ -101,7 +101,6 @@ func setupCapabilities(ctx context.Context, hostConfig *types.HostConfig, s *spe
 	capabilities.Effective = caplist
 	capabilities.Bounding = caplist
 	capabilities.Permitted = caplist
-	capabilities.Inheritable = caplist
 
 	s.Process.Capabilities = capabilities
 	return nil
```

**File**: `oci/spec_default.go` (modified, +3/-4)
```diff
@@ -77,10 +77,9 @@ func NewDefaultSpec() *specs.Spec {
 
 	s.Process = &specs.Process{
 		Capabilities: &specs.LinuxCapabilities{
-			Bounding:    defaultCaps(),
-			Permitted:   defaultCaps(),
-			Inheritable: defaultCaps(),
-			Effective:   defaultCaps(),
+			Bounding:  defaultCaps(),
+			Permitted: defaultCaps(),
+			Effective: defaultCaps(),
 		},
 	}
 
```

---

### Incident Patch 6: `10ec5652` (2022-09-20)
**Commit Message**: fix CVE-2022-23648

Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>

**File**: `daemon/mgr/container_storage.go` (modified, +6/-2)
```diff
@@ -24,6 +24,7 @@ import (
 	volumetypes "github.com/alibaba/pouch/storage/volume/types"
 
 	"github.com/containerd/containerd/mount"
+	"github.com/containerd/continuity/fs"
 	"github.com/pkg/errors"
 )
 
@@ -380,9 +381,12 @@ func (mgr *ContainerManager) populateVolumes(ctx context.Context, c *Container,
 		log.With(ctx).Debugf("copying image data from (%s:%s), to volume(%s) or path(%s)",
 			c.ID, mp.Destination, mp.Name, mp.Source)
 
-		imagePath := path.Join(c.MountFS, mp.Destination)
+		imagePath, err := fs.RootPath(c.MountFS, mp.Destination)
+		if err != nil {
+			return fmt.Errorf("rootpath on mountPath %s, volume %s: %w", c.MountFS, mp.Destination, err)
+		}
 
-		err := copyImageContent(ctx, imagePath, mp.Source, qms)
+		err = copyImageContent(ctx, imagePath, mp.Source, qms)
 		if err != nil {
 			log.With(ctx).Errorf("failed to copy image contents, volume[imagepath(%s), source(%s)], err(%v)", imagePath, mp.Source, err)
 			return errors.Wrapf(err, "failed to copy image content, image(%s), host(%s)", imagePath, mp.Source)
```

---

### Incident Patch 7: `fd8d6618` (2022-06-17)
**Commit Message**: fix cve-2022-31030

refer to containerd fix: https://github.com/containerd/containerd/commit/2eb67213b8ec38f5d7233cf0098763d9364e2a17

Signed-off-by: Rudy Zhang <rudyflyzhang@gmail.com>

**File**: `.circleci/config.yml` (modified, +0/-13)
```diff
@@ -16,19 +16,6 @@ jobs:
           name: use markdownlint v0.5.0 to lint markdown file (https://github.com/markdownlint/markdownlint)
           command: |
             find  ./ -name  "*.md" | grep -v vendor | grep -v commandline |  grep -v .github |  grep -v swagger |  grep -v api |  xargs mdl -r ~MD010,~MD013,~MD024,~MD029,~MD033,~MD036
-      - run:
-          name: use markdown-link-check(https://github.com/tcort/markdown-link-check) to check links in markdown files
-          command: |
-            set +e
-            for name in $(find . -name \*.md | grep -v vendor | grep -v CHANGELOG); do 
-              if [ -f $name ]; then 
-                markdown-link-check -q $name; 
-                if [ $? -ne 0 ]; then
-                  code=1
-                fi
-              fi 
-            done 
-            bash -c "exit $code";
       - run:
           name: use opensource tool client9/misspell to correct commonly misspelled English words 
           command: |
```

**File**: `cri/v1alpha2/cri.go` (modified, +5/-2)
```diff
@@ -71,6 +71,9 @@ const (
 
 	// networkNotReadyReason is the reason reported when network is not ready.
 	networkNotReadyReason = "NetworkPluginNotReady"
+
+	// maxMsgSize is the max size syncExec could output
+	maxMsgSize = 1024 * 1024 * 64
 )
 
 var (
@@ -1213,9 +1216,9 @@ func (c *CriManager) ExecSync(ctx context.Context, r *runtime.ExecSyncRequest) (
 	stdoutBuf, stderrBuf := bytes.NewBuffer(nil), bytes.NewBuffer(nil)
 	attachCfg := &pkgstreams.AttachConfig{
 		UseStdout: true,
-		Stdout:    stdoutBuf,
+		Stdout:    &cappedWriter{stdoutBuf, maxMsgSize},
 		UseStderr: true,
-		Stderr:    stderrBuf,
+		Stderr:    &cappedWriter{stderrBuf, maxMsgSize},
 	}
 
 	if err := c.ContainerMgr.StartExec(ctx, execid, attachCfg, int(r.GetTimeout())); err != nil {
```

**File**: `cri/v1alpha2/cri_utils.go` (modified, +29/-0)
```diff
@@ -2,6 +2,7 @@ package v1alpha2
 
 import (
 	"bytes"
+	"errors"
 	"fmt"
 	"io"
 	"io/ioutil"
@@ -1273,3 +1274,31 @@ func applyContainerConfigByAnnotation(annotations map[string]string, config *api
 
 	return nil
 }
+
+type cappedWriter struct {
+	w      io.Writer
+	remain int
+}
+
+var errNoRemain = errors.New("no more space to write")
+
+func (cw *cappedWriter) Write(p []byte) (int, error) {
+	if cw.remain <= 0 {
+		return 0, errNoRemain
+	}
+
+	end := cw.remain
+	if end > len(p) {
+		end = len(p)
+	}
+	written, err := cw.w.Write(p[0:end])
+	cw.remain -= written
+
+	if err != nil {
+		return written, err
+	}
+	if written < len(p) {
+		return written, errNoRemain
+	}
+	return written, nil
+}
```

**File**: `cri/v1alpha2/cri_utils_test.go` (modified, +18/-0)
```diff
@@ -1,6 +1,7 @@
 package v1alpha2
 
 import (
+	"bytes"
 	"fmt"
 	"reflect"
 	"strconv"
@@ -1974,3 +1975,20 @@ func Test_applyContainerConfigByAnnotation(t *testing.T) {
 		})
 	}
 }
+
+func TestCWWrite(t *testing.T) {
+	var buf bytes.Buffer
+	cw := &cappedWriter{w: &buf, remain: 10}
+
+	n, err := cw.Write([]byte("hello"))
+	assert.NoError(t, err)
+	assert.Equal(t, 5, n)
+
+	n, err = cw.Write([]byte("helloworld"))
+	assert.Equal(t, []byte("hellohello"), buf.Bytes(), "partial write")
+	assert.Equal(t, 5, n)
+	assert.Equal(t, err.Error(), errNoRemain.Error())
+
+	_, err = cw.Write([]byte("world"))
+	assert.Equal(t, err.Error(), errNoRemain.Error())
+}
```

---

### Incident Patch 8: `1f791a66` (2022-07-21)
**Commit Message**: fix if restart pod sanbox container, sanbox /etc/resolv.conf will be restore to host /etc/resolv.conf.

**File**: `cri/v1alpha2/cri.go` (modified, +7/-0)
```diff
@@ -427,6 +427,13 @@ func (c *CriManager) StartPodSandbox(ctx context.Context, r *runtime.StartPodSan
 		}
 	}
 
+	// Setup sandbox file /etc/resolv.conf again to ensure resolv.conf is right
+	sandboxRootDir := path.Join(c.SandboxBaseDir, sandbox.ID)
+	err = setupSandboxFiles(sandboxRootDir, sandboxMeta.Config)
+	if err != nil {
+		return nil, fmt.Errorf("failed to setup sandbox files: %v", err)
+	}
+
 	metrics.PodSuccessActionsCounter.WithLabelValues(label).Inc()
 
 	return &runtime.StartPodSandboxResponse{}, nil
```

---

### Incident Patch 9: `17f559f4` (2022-07-21)
**Commit Message**: fix #3032

**File**: `cri/v1alpha2/cri_utils.go` (modified, +1/-1)
```diff
@@ -676,7 +676,7 @@ func getSeccompSecurityOpts(sc *runtime.LinuxContainerSecurityContext) ([]string
 	}
 
 	// Return unconfined profile explicitly.
-	if profile == mgr.ProfileDockerDefault {
+	if profile == mgr.ProfileDockerDefault || profile == mgr.ProfileRuntimeDefault {
 		// return nil so pouch will load the default seccomp profile.
 		return nil, nil
 	}
```

---

### Incident Patch 10: `6eca67b8` (2019-03-28)
**Commit Message**: fix update annotation to support comma

Signed-off-by: allen.wang <allen.wq@alipay.com>

**File**: `cli/update.go` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ func (uc *UpdateCommand) addFlags() {
 	flagSet.StringSliceVarP(&uc.labels, "label", "l", nil, "Update labels for container")
 	flagSet.StringVar(&uc.restartPolicy, "restart", "", "Restart policy to apply when container exits")
 	flagSet.StringSliceVar(&uc.diskQuota, "disk-quota", nil, "Update disk quota for container(/=10g)")
-	flagSet.StringSliceVar(&uc.specAnnotation, "annotation", nil, "Update annotation for runtime spec")
+	flagSet.StringArrayVar(&uc.specAnnotation, "annotation", nil, "Update annotation for runtime spec")
 }
 
 // updateRun is the entry of update command.
```

**File**: `test/cli_update_test.go` (modified, +3/-3)
```diff
@@ -582,17 +582,17 @@ func (suite *PouchUpdateSuite) TestUpdateAnnotation(c *check.C) {
 	defer DelContainerForceMultyTime(c, cname)
 
 	annotation1Update := "key1=value1.new"
-	annotation2Update := "key2=value2.new"
+	annotation2Update := "key2=value2,value3"
 
 	command.PouchRun("update", "--annotation", annotation1Update, cname).Assert(c, icmd.Success)
 	checkContainerAnnotation(c, cname, "key1", "value1.new")
 	checkContainerAnnotation(c, cname, "key2", "value2")
 
 	command.PouchRun("update", "--annotation", annotation2Update, cname).Assert(c, icmd.Success)
 	checkContainerAnnotation(c, cname, "key1", "value1.new")
-	checkContainerAnnotation(c, cname, "key2", "value2.new")
+	checkContainerAnnotation(c, cname, "key2", "value2,value3")
 
 	command.PouchRun("restart", cname).Assert(c, icmd.Success)
 	checkContainerAnnotation(c, cname, "key1", "value1.new")
-	checkContainerAnnotation(c, cname, "key2", "value2.new")
+	checkContainerAnnotation(c, cname, "key2", "value2,value3")
 }
```

#### Recent Merged Pull Requests:
- **PR #3059** (2024-08-22): fix: close /proc/1/mountinfo (@testwill)
- **PR #3057** (2023-09-11): [Bugfix] fix issue of container escape when pouch cp (@Wheat2018)
- **PR #3054** (2023-05-04): [Bugfix] fix nil pointer (@rudyfly)
- **PR #3053** (2023-04-24): fix containerd CVE-2023-25153 (@rudyfly)
- **PR #3049** (2022-11-09): version: bump to v1.3.1 (@rudyfly)
- **PR #3048** (2022-11-07): AdditionalGids must include effective group ID (@rudyfly)
- **PR #3047** (2022-09-29): fix CVE-2022-24769 (@rudyfly)
- **PR #3046** (2022-09-20): fix cve-2022-31030 (@rudyfly)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
