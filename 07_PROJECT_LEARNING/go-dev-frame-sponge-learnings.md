# Forensic Learning Record (Deep Inspection): go-dev-frame/sponge

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-dev-frame-sponge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-dev-frame/sponge](https://github.com/go-dev-frame/sponge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:06:24.274Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `go-dev-frame/sponge`
- **Description**: A powerful and easy-to-use Go development framework that enables you to effortlessly build stable, reliable, and high-performance backend services with a "low-code" approach.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2868 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `pkg/shield/cpu/psutil_cpu.go`
```
// Package cpu is a library that calculates cpu and memory usage.
package cpu

import (
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
)

type psutilCPU struct {
	interval time.Duration
}

func newPsutilCPU(interval time.Duration) (*psutilCPU, error) {
	psCPU := &psutilCPU{interval: interval}
	_, err := psCPU.Usage()
	if err != nil {
		return nil, err
	}
	return psCPU, nil
}

func (ps *psutilCPU) Usage() (uint64, error) {
	var u uint64
	percents, err := cpu.Percent(ps.interval, false)
	if err == nil {
		if len(percents) > 0 {
			u = uint64(percents[0] * 10) // convert to 10/1000 of a percent
		}
	}
	return u, err
}

func (ps *psutilCPU) Info() Info {
	stats, err := cpu.Info()
	if err != nil {
		return Info{}
	}
	cores, err := cpu.Counts(true)
	if err != nil {
		return Info{}
	}

	return Info{
		Frequency: uint64(stats[0].Mhz),
		Quota:     float64(cores),
	}
}

```

### Core Architecture Module: `pkg/shield/cpu/utils.go`
```
package cpu

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func readFile(path string) (string, error) {
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(contents)), nil
}

func parseUint(s string) (uint64, error) {
	v, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		intValue, intErr := strconv.ParseInt(s, 10, 64)
		// 1. Handle negative values greater than MinInt64 (and)
		// 2. Handle negative values lesser than MinInt64
		if intErr == nil && intValue < 0 {
			return 0, nil
		} else if intErr != nil &&
			intErr.(*strconv.NumError).Err == strconv.ErrRange &&
			intValue < 0 {
			return 0, nil
		}
		return 0, err
	}
	return v, nil
}

// ParseUintList parses and validates the specified string as the value
// found in some cgroup file (e.g. cpuset.cpus, cpuset.mems), which could be
// one of the formats below. Note that duplicates are actually allowed in the
// input string. It returns a map[int]bool with available elements from val
// set to true.
// Supported formats:
// 7
// 1-6
// 0,3-4,7,8-10
// 0-0,0,1-7
// 03,1-3 <- this is gonna get parsed as [1,2,3]
// 3,2,1
// 0-2,3,1
func ParseUintList(val string) (map[int]bool, error) {
	if val == "" {
		return map[int]bool{}, nil
	}

	availableInts := make(map[int]bool)
	split := strings.Split(val, ",")
	errInvalidFormat := fmt.Errorf("os/stat: invalid format: %s", val)
	for _, r := range split {
		if !strings.Contains(r, "-") {
			v, err := strconv.Atoi(r)
			if err != nil {
				return nil, errInvalidFormat
			}
			availableInts[v] = true
		} else {
			ss := strings.SplitN(r, "-", 2)
			minVal, err := strconv.Atoi(ss[0])
			if err != nil {
				return nil, errInvalidFormat
			}
			maxVal, err := strconv.Atoi(ss[1])
			if err != nil {
				return nil, errInvalidFormat
			}
			if maxVal < minVal {
				return nil, errInvalidFormat
			}
			for i := minVal; i <= maxVal; i++ {
				availableInts[i] = true
			}
		}
	}
	return availableInts, nil
}

// ReadLines reads contents from a file and splits them by new lines.
// A convenience wrapper to ReadLinesOffsetN(filename, 0, -1).
func readLines(filename string) ([]string, error) {
	return readLinesOffsetN(filename, 0, -1)
}

// ReadLinesOffsetN reads contents from file and splits them by new line.
// The offset tells at which line number to start.
// The count determines the number of lines to read (starting from offset):
//
//	n >= 0: at most n lines
//	n < 0: whole file
func readLinesOffsetN(filename string, offset uint, n int) ([]string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return []string{""}, err
	}
	defer f.Close() //nolint

	var ret []string

	r := bufio.NewReader(f)
	for i := 0; i < n+int(offset) || n < 0; i++ {
		line, err := r.ReadString('\n')
		if err != nil {
			break
		}
		if i < int(offset) {
			continue
		}
		ret = append(ret, strings.Trim(line, "\n"))
	}

	return ret, nil
}

```

### Core Architecture Module: `pkg/utils/browser.go`
```
package utils

import (
	"os/exec"
	"runtime"
)

// AutoOpenBrowser auto open browser
func AutoOpenBrowser(visitURL string) error {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "cmd"
		args = []string{"/c", "start"}
	case "darwin":
		cmd = "open"
	default: // "linux", "freebsd", "openbsd", "netbsd"
		cmd = "xdg-open"
	}

	args = append(args, visitURL)
	return exec.Command(cmd, args...).Start()
}

```

### Core Architecture Module: `pkg/utils/dsn.go`
```
package utils

import (
	"fmt"
	"net/url"
	"strings"
)

// AdaptiveMysqlDsn adaptation of various mysql format dsn address
func AdaptiveMysqlDsn(dsn string) string {
	return strings.ReplaceAll(dsn, "mysql://", "")
}

// AdaptivePostgresqlDsn convert postgres dsn to kv string
func AdaptivePostgresqlDsn(dsn string) string {
	if strings.Count(dsn, " ") > 3 {
		return dsn
	}

	if !strings.Contains(dsn, "postgres://") {
		dsn = "postgres://" + dsn
	}

	dsn = DeleteBrackets(dsn)

	u, err := url.Parse(dsn)
	if err != nil {
		panic(err)
	}

	password, _ := u.User.Password()

	if u.RawQuery == "" {
		u.RawQuery = "sslmode=disable"
	} else if u.Query().Get("sslmode") == "" {
		u.RawQuery = "sslmode=disable&" + u.RawQuery
	}
	ss := strings.Split(u.RawQuery, "&")

	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s %s",
		u.Hostname(), u.Port(), u.User.Username(), password, u.Path[1:], strings.Join(ss, " "))
}

// AdaptiveSqlite adaptive sqlite
func AdaptiveSqlite(dbFile string) string {
	// todo convert to absolute path
	return dbFile
}

// AdaptiveMongodbDsn adaptive mongodb dsn
func AdaptiveMongodbDsn(dsn string) string {
	if !strings.Contains(dsn, "mongodb://") &&
		!strings.Contains(dsn, "mongodb+srv://") {
		dsn = "mongodb://" + dsn // default scheme
	}

	return DeleteBrackets(dsn)
}

// DeleteBrackets delete brackets in dsn
func DeleteBrackets(str string) string {
	start := strings.Index(str, "@(")
	end := strings.LastIndex(str, ")/")

	if start == -1 || end == -1 {
		return str
	}

	addr := str[start+2 : end]
	return strings.Replace(str, "@("+addr+")/", "@"+addr+"/", 1)
}

```

### Core Architecture Module: `pkg/utils/host.go`
```
// Package utils is a library of commonly used utility functions.
package utils

import (
	"fmt"
	"net"
	"os"
)

// GetHostname get hostname
func GetHostname() string {
	name, err := os.Hostname()
	if err != nil {
		name = "unknown"
	}
	return name
}

// GetLocalHTTPAddrPairs get available http server and request address
func GetLocalHTTPAddrPairs() (serverAddr string, requestAddr string) {
	port, err := GetAvailablePort()
	if err != nil {
		fmt.Printf("GetAvailablePort error: %v\n", err)
		return "", ""
	}
	serverAddr = fmt.Sprintf(":%d", port)
	requestAddr = fmt.Sprintf("http://127.0.0.1:%d", port)
	return serverAddr, requestAddr
}

// GetAvailablePort get available port
func GetAvailablePort() (int, error) {
	address, err := net.ResolveTCPAddr("tcp", fmt.Sprintf("%s:0", "0.0.0.0"))
	if err != nil {
		return 0, err
	}

	listener, err := net.ListenTCP("tcp", address)
	if err != nil {
		return 0, err
	}

	port := listener.Addr().(*net.TCPAddr).Port
	err = listener.Close()

	return port, err
}

```

### Core Architecture Module: `pkg/utils/saferun.go`
```
package utils

import (
	"context"
	"fmt"
	"time"
)

// SafeRun safe run
func SafeRun(ctx context.Context, fn func(ctx context.Context)) {
	defer func() {
		if e := recover(); e != nil {
			fmt.Println(e)
		}
	}()

	fn(ctx)
}

// SafeRunWithTimeout safe run with limit timeouts
func SafeRunWithTimeout(d time.Duration, fn func(cancel context.CancelFunc)) {
	ctx, cancel := context.WithTimeout(context.Background(), d)

	go func() {
		defer func() {
			if e := recover(); e != nil {
				fmt.Println(e)
			}
		}()

		fn(cancel)
	}()

	for range ctx.Done() {
		return
	}
}

```

### Core Architecture Module: `pkg/utils/time.go`
```
package utils

import "time"

const (
	// DateTimeLayout is the layout string for datetime format.
	DateTimeLayout = "2006-01-02 15:04:05"

	// DateTimeLayoutWithMS is the layout string for datetime format with milliseconds.
	DateTimeLayoutWithMS = "2006-01-02 15:04:05.000"

	// RFC3339 is the layout string for RFC3339 format.
	RFC3339 = "2006-01-02T15:04:05Z07:00"

	// DateTimeLayoutWithMSAndTZ is the layout string for datetime format with milliseconds and timezone.
	DateTimeLayoutWithMSAndTZ = "2006-01-02T15:04:05.000Z"

	// TimeLayout is the layout string for time format.
	TimeLayout = "15:04:05"

	// DateLayout is the layout string for date format.
	DateLayout = "2006-01-02"
)

// FormatDateTimeLayout formats the given time to the layout string "2006-01-02 15:04:05".
func FormatDateTimeLayout(t time.Time) string {
	return t.Format(DateTimeLayout)
}

// ParseDateTimeLayout parses the given string to time with layout string "2006-01-02 15:04:05".
func ParseDateTimeLayout(s string) (time.Time, error) {
	return time.Parse(DateTimeLayout, s)
}

// FormatDateTimeLayoutWithMS formats the given time to the layout string "2006-01-02 15:04:05.000".
func FormatDateTimeLayoutWithMS(t time.Time) string {
	return t.Format(DateTimeLayoutWithMS)
}

// ParseDateTimeLayoutWithMS parses the given string to time with layout string "2006-01-02 15:04:05.000".
func ParseDateTimeLayoutWithMS(s string) (time.Time, error) {
	return time.Parse(DateTimeLayoutWithMS, s)
}

// FormatDateTimeRFC3339 formats the given time to the layout string "2006-01-02T15:04:05Z07:00".
func FormatDateTimeRFC3339(t time.Time) string {
	return t.Format(RFC3339)
}

// ParseDateTimeRFC3339 parses the given string to time with layout string "2006-01-02T15:04:05Z07:00".
func ParseDateTimeRFC3339(s string) (time.Time, error) {
	return time.Parse(RFC3339, s)
}

// FormatDateTimeLayoutWithMSAndTZ formats the given time to the layout string "2006-01-02T15:04:05.000Z".
func FormatDateTimeLayoutWithMSAndTZ(t time.Time) string {
	return t.Format(DateTimeLayoutWithMSAndTZ)
}

// ParseDateTimeLayoutWithMSAndTZ parses the given string to time with layout string "2006-01-02T15:04:05.000Z".
func ParseDateTimeLayoutWithMSAndTZ(s string) (time.Time, error) {
	return time.Parse(DateTimeLayoutWithMSAndTZ, s)
}

```

### Core Architecture Module: `pkg/utils/type_convert.go`
```
package utils

import (
	"strconv"
)

// MaxStringID is the maximum string ID
const MaxStringID = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"

// StrToInt string to int
func StrToInt(str string) int {
	v, _ := strconv.Atoi(str)
	return v
}

// StrToIntE string to int with error
func StrToIntE(str string) (int, error) {
	return strconv.Atoi(str)
}

// StrToInt64 string to int64
func StrToInt64(str string) int64 {
	v, _ := strconv.ParseInt(str, 10, 64)
	return v
}

// StrToInt64E string to int64 with error
func StrToInt64E(str string) (int64, error) {
	return strconv.ParseInt(str, 10, 64)
}

// StrToUint32 string to uint32
func StrToUint32(str string) uint32 {
	v, _ := strconv.ParseUint(str, 10, 64)
	return uint32(v)
}

// StrToUint32E string to uint32 with error
func StrToUint32E(str string) (uint32, error) {
	v, err := strconv.ParseUint(str, 10, 64)
	if err != nil {
		return 0, err
	}

	return uint32(v), nil
}

// StrToUint64 string to uint64
func StrToUint64(str string) uint64 {
	v, _ := strconv.ParseUint(str, 10, 64)
	return v
}

// StrToUint64E string to uint64 with error
func StrToUint64E(str string) (uint64, error) {
	return strconv.ParseUint(str, 10, 64)
}

// StrToUint string to uint
func StrToUint(str string) uint {
	return uint(StrToUint64(str))
}

// StrToUintE string to uint
func StrToUintE(str string) (uint, error) {
	v, err := StrToUint64E(str)
	return uint(v), err
}

// StrToFloat32 string to float32
func StrToFloat32(str string) float32 {
	v, _ := strconv.ParseFloat(str, 32)
	return float32(v)
}

// StrToFloat32E string to float32 with error
func StrToFloat32E(str string) (float32, error) {
	v, err := strconv.ParseFloat(str, 32)
	if err != nil {
		return 0, err
	}
	return float32(v), nil
}

// StrToFloat64 string to float64
func StrToFloat64(str string) float64 {
	v, _ := strconv.ParseFloat(str, 64)
	return v
}

// StrToFloat64E string to float64 with error
func StrToFloat64E(str string) (float64, error) {
	return strconv.ParseFloat(str, 64)
}

// IntToStr int to string
func IntToStr(v int) string {
	return strconv.Itoa(v)
}

// UintToStr uint to string
func UintToStr(v uint) string {
	return Uint64ToStr(uint64(v))
}

// Uint64ToStr uint64 to string
func Uint64ToStr(v uint64) string {
	return strconv.FormatUint(v, 10)
}

// Int64ToStr int64 to string
func Int64ToStr(v int64) string {
	return strconv.FormatInt(v, 10)
}

// ProtoInt32ToInt convert proto int32 to int
func ProtoInt32ToInt(v int32) int {
	return int(v)
}

// IntToProtoInt32 convert int to proto int32
func IntToProtoInt32(v int) int32 {
	return int32(v)
}

// ProtoInt64ToUint64 convert proto int64 to uint64
func ProtoInt64ToUint64(v int64) uint64 {
	return uint64(v)
}

// Uint64ToProtoInt64 convert uint64 to proto int64
func Uint64ToProtoInt64(v uint64) int64 {
	return int64(v)
}

```

### Core Architecture Module: `pkg/utils/wait_print.go`
```
package utils

import (
	"context"
	"fmt"
	"time"
)

// WaitPrinter is a waiting printer.
type WaitPrinter struct {
	ctx            context.Context
	cancel         context.CancelFunc
	printFrequency time.Duration
}

// NewWaitPrinter create a new WaitPrinter instance.
func NewWaitPrinter(interval time.Duration) *WaitPrinter {
	ctx, cancel := context.WithCancel(context.Background())
	if interval < time.Millisecond*100 || interval > time.Second*5 {
		interval = time.Millisecond * 500
	}
	return &WaitPrinter{
		ctx:            ctx,
		cancel:         cancel,
		printFrequency: interval,
	}
}

// LoopPrint start the waiting loop and print the running tip message.
func (p *WaitPrinter) LoopPrint(runningTip string) {
	if p == nil {
		return
	}
	go func() {
		symbols := []string{runningTip + ".", runningTip + "..", runningTip +
			"...", runningTip + "....", runningTip + ".....", runningTip + "......"}
		index := 0
		fmt.Printf("\r%s", symbols[index])

		ticker := time.NewTicker(p.printFrequency)
		defer ticker.Stop()

		for {
			select {
			case <-p.ctx.Done():
				return
			case <-ticker.C:
				index++
				if index >= len(symbols) {
					index = 0
				}
				p.clearCurrentLine()
				fmt.Printf("\r%s", symbols[index])
			}
		}
	}()
}

// StopPrint stop the waiting loop and print the tip message.
func (p *WaitPrinter) StopPrint(tip string) {
	if p == nil {
		return
	}

	defer func() {
		if e := recover(); e != nil {
			fmt.Println(e)
		}
	}()

	p.cancel()
	p.clearCurrentLine()
	fmt.Println(tip)
}

func (p *WaitPrinter) clearCurrentLine() {
	fmt.Print("\033[2K\r")
}

```

### Core Architecture Module: `api/serverNameExample/v1/userExample.pb.go`
```
// todo generate the protobuf code here
// delete the templates code start

// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.28.0
// 	protoc        v4.25.2
// source: api/serverNameExample/v1/userExample.proto

package v1

import (
	types "github.com/go-dev-frame/sponge/api/types"

	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type GenderType int32

const (
	GenderType_UNKNOWN GenderType = 0
	GenderType_MALE    GenderType = 1
	GenderType_FEMALE  GenderType = 2
)

// Enum value maps for GenderType.
var (
	GenderType_name = map[int32]string{
		0: "UNKNOWN",
		1: "MALE",
		2: "FEMALE",
	}
	GenderType_value = map[string]int32{
		"UNKNOWN": 0,
		"MALE":    1,
		"FEMALE":  2,
	}
)

func (x GenderType) Enum() *GenderType {
	p := new(GenderType)
	*p = x
	return p
}

func (x GenderType) String() string {
	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
}

func (GenderType) Descriptor() protoreflect.EnumDescriptor {
	return file_api_serverNameExample_v1_userExample_proto_enumTypes[0].Descriptor()
}

func (GenderType) Type() protoreflect.EnumType {
	return &file_api_serverNameExample_v1_userExample_proto_enumTypes[0]
}

func (x GenderType) Number() protoreflect.EnumNumber {
	return protoreflect.EnumNumber(x)
}

// Deprecated: Use GenderType.Descriptor instead.
func (GenderType) EnumDescriptor() ([]byte, []int) {
	return file_api_serverNameExample_v1_userExample_proto_rawDescGZIP(), []int{0}
}

type CreateUserExampleRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Name     string     `protobuf:"bytes,1,opt,name=name,proto3" json:"name"`                                               // name
	Email    string     `protobuf:"bytes,2,opt,name=email,proto3" json:"email"`                                             // email
	Password string     `protobuf:"bytes,3,opt,name=password,proto3" json:"password"`                                       // password
	Phone    string     `protobuf:"bytes,4,opt,name=phone,proto3" json:"phone"`                                             // phone number
	Avatar   string     `protobuf:"bytes,5,opt,name=avatar,proto3" json:"avatar"`                                           // avatar
	Age      int32      `protobuf:"varint,6,opt,name=age,proto3" json:"age"`                                                // age
	Gender   GenderType `protobuf:"varint,7,opt,name=gender,proto3,enum=api.serverNameExample.v1.GenderType" json:"gender"` // gender, 1:Male, 2:Female, other values:unknown
}

func (x *CreateUserExampleRequest) Reset() {
	*x = CreateUserExampleRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *CreateUserExampleRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*CreateUserExampleRequest) ProtoMessage() {}

func (x *CreateUserExampleRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use CreateUserExampleRequest.ProtoReflect.Descriptor instead.
func (*CreateUserExampleRequest) Descriptor() ([]byte, []int) {
	return file_api_serverNameExample_v1_userExample_proto_rawDescGZIP(), []int{0}
}

func (x *CreateUserExampleRequest) GetName() string {
	if x != nil {
		return x.Name
	}
	return ""
}

func (x *CreateUserExampleRequest) GetEmail() string {
	if x != nil {
		return x.Email
	}
	return ""
}

func (x *CreateUserExampleRequest) GetPassword() string {
	if x != nil {
		return x.Password
	}
	return ""
}

func (x *CreateUserExampleRequest) GetPhone() string {
	if x != nil {
		return x.Phone
	}
	return ""
}

func (x *CreateUserExampleRequest) GetAvatar() string {
	if x != nil {
		return x.Avatar
	}
	return ""
}

func (x *CreateUserExampleRequest) GetAge() int32 {
	if x != nil {
		return x.Age
	}
	return 0
}

func (x *CreateUserExampleRequest) GetGender() GenderType {
	if x != nil {
		return x.Gender
	}
	return GenderType_UNKNOWN
}

type CreateUserExampleReply struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Id uint64 `protobuf:"varint,1,opt,name=id,proto3" json:"id"`
}

func (x *CreateUserExampleReply) Reset() {
	*x = CreateUserExampleReply{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *CreateUserExampleReply) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*CreateUserExampleReply) ProtoMessage() {}

func (x *CreateUserExampleReply) ProtoReflect() protoreflect.Message {
	mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use CreateUserExampleReply.ProtoReflect.Descriptor instead.
func (*CreateUserExampleReply) Descriptor() ([]byte, []int) {
	return file_api_serverNameExample_v1_userExample_proto_rawDescGZIP(), []int{1}
}

func (x *CreateUserExampleReply) GetId() uint64 {
	if x != nil {
		return x.Id
	}
	return 0
}

type DeleteUserExampleByIDRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Id uint64 `protobuf:"varint,1,opt,name=id,proto3" json:"id" uri:"id"`
}

func (x *DeleteUserExampleByIDRequest) Reset() {
	*x = DeleteUserExampleByIDRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[2]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *DeleteUserExampleByIDRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*DeleteUserExampleByIDRequest) ProtoMessage() {}

func (x *DeleteUserExampleByIDRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[2]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use DeleteUserExampleByIDRequest.ProtoReflect.Descriptor instead.
func (*DeleteUserExampleByIDRequest) Descriptor() ([]byte, []int) {
	return file_api_serverNameExample_v1_userExample_proto_rawDescGZIP(), []int{2}
}

func (x *DeleteUserExampleByIDRequest) GetId() uint64 {
	if x != nil {
		return x.Id
	}
	return 0
}

type DeleteUserExampleByIDReply struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *DeleteUserExampleByIDReply) Reset() {
	*x = DeleteUserExampleByIDReply{}
	if protoimpl.UnsafeEnabled {
		mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[3]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *DeleteUserExampleByIDReply) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*DeleteUserExampleByIDReply) ProtoMessage() {}

func (x *DeleteUserExampleByIDReply) ProtoReflect() protoreflect.Message {
	mi := &file_api_serverNameExample_v1_userExample_proto_msgTypes[3]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use DeleteUserExampleByIDReply.ProtoReflect.Descriptor instead.
func (*DeleteUserExampleByIDReply) Descriptor() ([]byte, []int) {
	return file_api_serverNameExample_v1_userExample_proto_rawDescGZIP(), []int{3}
}

type UpdateUserExampleByIDRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Id       uint64     `protobuf:"varint,1,opt,name=id,proto3" json:"id" uri:"id"`
	Name     string     `protobuf:"bytes,2,opt,name=name,proto3" json:"name"`                                               // name
	Email    string     `protobuf:"bytes,3,opt,name=email,proto3" json:"email"`                                             // email
	Password string     `protobuf:"bytes,4,opt,name=password,proto3" json:"password"`                                       // password
	Phone    string     `protobuf:"bytes,5,opt,name=phone,proto3" json:"phone"`                                             // phone number
	Avatar   string     `protobuf:"bytes,6,opt,name=avatar,proto3" json:"avatar"`                                           // avatar
	Age      int32      `protobuf:"varint,7,opt,name=age,proto3" json:"age"`                                                // age
	Gender   GenderType `protobuf:"varint,8,opt,name=gender,proto3,enum=api.serverNameExample.v1.GenderType" json:"gender"` // gender, 1:Male, 2:Female, other values:unknown
	Status   int32      `protobuf:"varint,9,opt,name=status,proto3" json:"status"`                                          // account status
	LoginAt  int64      `protobuf:"varint,10,opt,name=loginAt,proto3" json:"loginAt"`                                       // login timestamp
}

func (x *UpdateUserExampleByIDRequest) Reset() {
	*x = UpdateUs
```

### Core Architecture Module: `api/serverNameExample/v1/userExample.pb.validate.go`
```
// Code generated by protoc-gen-validate. DO NOT EDIT.
// source: api/serverNameExample/v1/userExample.proto

package v1

import (
	"bytes"
	"errors"
	"fmt"
	"net"
	"net/mail"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"google.golang.org/protobuf/types/known/anypb"
)

// ensure the imports are used
var (
	_ = bytes.MinRead
	_ = errors.New("")
	_ = fmt.Print
	_ = utf8.UTFMax
	_ = (*regexp.Regexp)(nil)
	_ = (*strings.Reader)(nil)
	_ = net.IPv4len
	_ = time.Duration(0)
	_ = (*url.URL)(nil)
	_ = (*mail.Address)(nil)
	_ = anypb.Any{}
	_ = sort.Sort
)

// Validate checks the field values on CreateUserExampleRequest with the rules
// defined in the proto definition for this message. If any rules are
// violated, the first error encountered is returned, or nil if there are no violations.
func (m *CreateUserExampleRequest) Validate() error {
	return m.validate(false)
}

// ValidateAll checks the field values on CreateUserExampleRequest with the
// rules defined in the proto definition for this message. If any rules are
// violated, the result is a list of violation errors wrapped in
// CreateUserExampleRequestMultiError, or nil if none found.
func (m *CreateUserExampleRequest) ValidateAll() error {
	return m.validate(true)
}

func (m *CreateUserExampleRequest) validate(all bool) error {
	if m == nil {
		return nil
	}

	var errors []error

	if utf8.RuneCountInString(m.GetName()) < 2 {
		err := CreateUserExampleRequestValidationError{
			field:  "Name",
			reason: "value length must be at least 2 runes",
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if err := m._validateEmail(m.GetEmail()); err != nil {
		err = CreateUserExampleRequestValidationError{
			field:  "Email",
			reason: "value must be a valid email address",
			cause:  err,
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if utf8.RuneCountInString(m.GetPassword()) < 10 {
		err := CreateUserExampleRequestValidationError{
			field:  "Password",
			reason: "value length must be at least 10 runes",
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if !_CreateUserExampleRequest_Phone_Pattern.MatchString(m.GetPhone()) {
		err := CreateUserExampleRequestValidationError{
			field:  "Phone",
			reason: "value does not match regex pattern \"^1[3456789]\\\\d{9}$\"",
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if uri, err := url.Parse(m.GetAvatar()); err != nil {
		err = CreateUserExampleRequestValidationError{
			field:  "Avatar",
			reason: "value must be a valid URI",
			cause:  err,
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	} else if !uri.IsAbs() {
		err := CreateUserExampleRequestValidationError{
			field:  "Avatar",
			reason: "value must be absolute",
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if val := m.GetAge(); val < 0 || val > 120 {
		err := CreateUserExampleRequestValidationError{
			field:  "Age",
			reason: "value must be inside range [0, 120]",
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if _, ok := GenderType_name[int32(m.GetGender())]; !ok {
		err := CreateUserExampleRequestValidationError{
			field:  "Gender",
			reason: "value must be one of the defined enum values",
		}
		if !all {
			return err
		}
		errors = append(errors, err)
	}

	if len(errors) > 0 {
		return CreateUserExampleRequestMultiError(errors)
	}

	return nil
}

func (m *CreateUserExampleRequest) _validateHostname(host string) error {
	s := strings.ToLower(strings.TrimSuffix(host, "."))

	if len(host) > 253 {
		return errors.New("hostname cannot exceed 253 characters")
	}

	for _, part := range strings.Split(s, ".") {
		if l := len(part); l == 0 || l > 63 {
			return errors.New("hostname part must be non-empty and cannot exceed 63 characters")
		}

		if part[0] == '-' {
			return errors.New("hostname parts cannot begin with hyphens")
		}

		if part[len(part)-1] == '-' {
			return errors.New("hostname parts cannot end with hyphens")
		}

		for _, r := range part {
			if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
				return fmt.Errorf("hostname parts can only contain alphanumeric characters or hyphens, got %q", string(r))
			}
		}
	}

	return nil
}

func (m *CreateUserExampleRequest) _validateEmail(addr string) error {
	a, err := mail.ParseAddress(addr)
	if err != nil {
		return err
	}
	addr = a.Address

	if len(addr) > 254 {
		return errors.New("email addresses cannot exceed 254 characters")
	}

	parts := strings.SplitN(addr, "@", 2)

	if len(parts[0]) > 64 {
		return errors.New("email address local phrase cannot exceed 64 characters")
	}

	return m._validateHostname(parts[1])
}

// CreateUserExampleRequestMultiError is an error wrapping multiple validation
// errors returned by CreateUserExampleRequest.ValidateAll() if the designated
// constraints aren't met.
type CreateUserExampleRequestMultiError []error

// Error returns a concatenation of all the error messages it wraps.
func (m CreateUserExampleRequestMultiError) Error() string {
	var msgs []string
	for _, err := range m {
		msgs = append(msgs, err.Error())
	}
	return strings.Join(msgs, "; ")
}

// AllErrors returns a list of validation violation errors.
func (m CreateUserExampleRequestMultiError) AllErrors() []error { return m }

// CreateUserExampleRequestValidationError is the validation error returned by
// CreateUserExampleRequest.Validate if the designated constraints aren't met.
type CreateUserExampleRequestValidationError struct {
	field  string
	reason string
	cause  error
	key    bool
}

// Field function returns field value.
func (e CreateUserExampleRequestValidationError) Field() string { return e.field }

// Reason function returns reason value.
func (e CreateUserExampleRequestValidationError) Reason() string { return e.reason }

// Cause function returns cause value.
func (e CreateUserExampleRequestValidationError) Cause() error { return e.cause }

// Key function returns key value.
func (e CreateUserExampleRequestValidationError) Key() bool { return e.key }

// ErrorName returns error name.
func (e CreateUserExampleRequestValidationError) ErrorName() string {
	return "CreateUserExampleRequestValidationError"
}

// Error satisfies the builtin error interface
func (e CreateUserExampleRequestValidationError) Error() string {
	cause := ""
	if e.cause != nil {
		cause = fmt.Sprintf(" | caused by: %v", e.cause)
	}

	key := ""
	if e.key {
		key = "key for "
	}

	return fmt.Sprintf(
		"invalid %sCreateUserExampleRequest.%s: %s%s",
		key,
		e.field,
		e.reason,
		cause)
}

var _ error = CreateUserExampleRequestValidationError{}

var _ interface {
	Field() string
	Reason() string
	Key() bool
	Cause() error
	ErrorName() string
} = CreateUserExampleRequestValidationError{}

var _CreateUserExampleRequest_Phone_Pattern = regexp.MustCompile("^1[3456789]\\d{9}$")

// Validate checks the field values on CreateUserExampleReply with the rules
// defined in the proto definition for this message. If any rules are
// violated, the first error encountered is returned, or nil if there are no violations.
func (m *CreateUserExampleReply) Validate() error {
	return m.validate(false)
}

// ValidateAll checks the field values on CreateUserExampleReply with the rules
// defined in the proto definition for this message. If any rules are
// violated, the result is a list of violation errors wrapped in
// CreateUserExampleReplyMultiError, or nil if none found.
func (m *CreateUserExampleReply) ValidateAll() error {
	return m.validate(true)
}

func (m *CreateUserExampleReply) validate(all bool) error {
	if m == nil {
		return nil
	}

	var errors []error

	// no validation rules for Id

	if len(errors) > 0 {
		return CreateUserExampleReplyMultiError(errors)
	}

	return nil
}

// CreateUserExampleReplyMultiError is an error wrapping multiple validation
// errors returned by CreateUserExampleReply.ValidateAll() if the designated
// constraints aren't met.
type CreateUserExampleReplyMultiError []error

// Error returns a concatenation of all the error messages it wraps.
func (m CreateUserExampleReplyMultiError) Error() string {
	var msgs []string
	for _, err := range m {
		msgs = append(msgs, err.Error())
	}
	return strings.Join(msgs, "; ")
}

// AllErrors returns a list of validation violation errors.
func (m CreateUserExampleReplyMultiError) AllErrors() []error { return m }

// CreateUserExampleReplyValidationError is the validation error returned by
// CreateUserExampleReply.Validate if the designated constraints aren't met.
type CreateUserExampleReplyValidationError struct {
	field  string
	reason string
	cause  error
	key    bool
}

// Field function returns field value.
func (e CreateUserExampleReplyValidationError) Field() string { return e.field }

// Reason function returns reason value.
func (e CreateUserExampleReplyValidationError) Reason() string { return e.reason }

// Cause function returns cause value.
func (e CreateUserExampleReplyValidationError) Cause() error { return e.cause }

// Key function returns key value.
func (e CreateUserExampleReplyValidationError) Key() bool { return e.key }

// ErrorName returns error name.
func (e CreateUserExampleReplyValidationError) ErrorName() string {
	return "CreateUserExampleReplyValidationError"
}

// Error satisfies the builtin error interface
func (e CreateUserExampleReplyValidationError) Error() string {
	cause := ""
	if e.cause != nil {
		cause = fmt.Sprintf(" | caused by: %v", e.cause)
	}

	key := ""
	if e.key {
		key = "key for "
	}

	return fmt.Sprintf(
		"invalid %sCreateUserExampleReply.%s: %s%s",
		key,
		e.field,
		e.reason,
		cause)
}

var _ error = CreateUserExampleReplyValidationError{}

var _ interface {
	Field() string
	Reason() string
	Key() bool
	Cause() error
	ErrorName() string
} = CreateUserExampleReplyValidationError{}

// Validate checks the field values on DeleteUserExampleByIDRequest with the
// rules defined in the proto definition for this message. If any rules are
// 
```

### Core Architecture Module: `api/serverNameExample/v1/userExample_grpc.pb.go`
```
// todo generate the protobuf code here
// delete the templates code start

// Code generated by protoc-gen-go-grpc. DO NOT EDIT.
// versions:
// - protoc-gen-go-grpc v1.3.0
// - protoc             v4.25.2
// source: api/serverNameExample/v1/userExample.proto

package v1

import (
	context "context"
	grpc "google.golang.org/grpc"
	codes "google.golang.org/grpc/codes"
	status "google.golang.org/grpc/status"
)

// This is a compile-time assertion to ensure that this generated file
// is compatible with the grpc package it is being compiled against.
// Requires gRPC-Go v1.32.0 or later.
const _ = grpc.SupportPackageIsVersion7

const (
	UserExample_Create_FullMethodName     = "/api.serverNameExample.v1.userExample/Create"
	UserExample_DeleteByID_FullMethodName = "/api.serverNameExample.v1.userExample/DeleteByID"
	UserExample_UpdateByID_FullMethodName = "/api.serverNameExample.v1.userExample/UpdateByID"
	UserExample_GetByID_FullMethodName    = "/api.serverNameExample.v1.userExample/GetByID"
	UserExample_List_FullMethodName       = "/api.serverNameExample.v1.userExample/List"
)

// UserExampleClient is the client API for UserExample service.
//
// For semantics around ctx use and closing/ending streaming RPCs, please refer to https://pkg.go.dev/google.golang.org/grpc/?tab=doc#ClientConn.NewStream.
type UserExampleClient interface {
	// create userExample
	Create(ctx context.Context, in *CreateUserExampleRequest, opts ...grpc.CallOption) (*CreateUserExampleReply, error)
	// delete userExample by id
	DeleteByID(ctx context.Context, in *DeleteUserExampleByIDRequest, opts ...grpc.CallOption) (*DeleteUserExampleByIDReply, error)
	// update userExample by id
	UpdateByID(ctx context.Context, in *UpdateUserExampleByIDRequest, opts ...grpc.CallOption) (*UpdateUserExampleByIDReply, error)
	// get userExample by id
	GetByID(ctx context.Context, in *GetUserExampleByIDRequest, opts ...grpc.CallOption) (*GetUserExampleByIDReply, error)
	// list of userExample by query parameters
	List(ctx context.Context, in *ListUserExampleRequest, opts ...grpc.CallOption) (*ListUserExampleReply, error)
}

type userExampleClient struct {
	cc grpc.ClientConnInterface
}

func NewUserExampleClient(cc grpc.ClientConnInterface) UserExampleClient {
	return &userExampleClient{cc}
}

func (c *userExampleClient) Create(ctx context.Context, in *CreateUserExampleRequest, opts ...grpc.CallOption) (*CreateUserExampleReply, error) {
	out := new(CreateUserExampleReply)
	err := c.cc.Invoke(ctx, UserExample_Create_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userExampleClient) DeleteByID(ctx context.Context, in *DeleteUserExampleByIDRequest, opts ...grpc.CallOption) (*DeleteUserExampleByIDReply, error) {
	out := new(DeleteUserExampleByIDReply)
	err := c.cc.Invoke(ctx, UserExample_DeleteByID_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userExampleClient) UpdateByID(ctx context.Context, in *UpdateUserExampleByIDRequest, opts ...grpc.CallOption) (*UpdateUserExampleByIDReply, error) {
	out := new(UpdateUserExampleByIDReply)
	err := c.cc.Invoke(ctx, UserExample_UpdateByID_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userExampleClient) GetByID(ctx context.Context, in *GetUserExampleByIDRequest, opts ...grpc.CallOption) (*GetUserExampleByIDReply, error) {
	out := new(GetUserExampleByIDReply)
	err := c.cc.Invoke(ctx, UserExample_GetByID_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (c *userExampleClient) List(ctx context.Context, in *ListUserExampleRequest, opts ...grpc.CallOption) (*ListUserExampleReply, error) {
	out := new(ListUserExampleReply)
	err := c.cc.Invoke(ctx, UserExample_List_FullMethodName, in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

// UserExampleServer is the server API for UserExample service.
// All implementations must embed UnimplementedUserExampleServer
// for forward compatibility
type UserExampleServer interface {
	// create userExample
	Create(context.Context, *CreateUserExampleRequest) (*CreateUserExampleReply, error)
	// delete userExample by id
	DeleteByID(context.Context, *DeleteUserExampleByIDRequest) (*DeleteUserExampleByIDReply, error)
	// update userExample by id
	UpdateByID(context.Context, *UpdateUserExampleByIDRequest) (*UpdateUserExampleByIDReply, error)
	// get userExample by id
	GetByID(context.Context, *GetUserExampleByIDRequest) (*GetUserExampleByIDReply, error)
	// list of userExample by query parameters
	List(context.Context, *ListUserExampleRequest) (*ListUserExampleReply, error)
	mustEmbedUnimplementedUserExampleServer()
}

// UnimplementedUserExampleServer must be embedded to have forward compatible implementations.
type UnimplementedUserExampleServer struct {
}

func (UnimplementedUserExampleServer) Create(context.Context, *CreateUserExampleRequest) (*CreateUserExampleReply, error) {
	return nil, status.Errorf(codes.Unimplemented, "method Create not implemented")
}
func (UnimplementedUserExampleServer) DeleteByID(context.Context, *DeleteUserExampleByIDRequest) (*DeleteUserExampleByIDReply, error) {
	return nil, status.Errorf(codes.Unimplemented, "method DeleteByID not implemented")
}
func (UnimplementedUserExampleServer) UpdateByID(context.Context, *UpdateUserExampleByIDRequest) (*UpdateUserExampleByIDReply, error) {
	return nil, status.Errorf(codes.Unimplemented, "method UpdateByID not implemented")
}
func (UnimplementedUserExampleServer) GetByID(context.Context, *GetUserExampleByIDRequest) (*GetUserExampleByIDReply, error) {
	return nil, status.Errorf(codes.Unimplemented, "method GetByID not implemented")
}
func (UnimplementedUserExampleServer) List(context.Context, *ListUserExampleRequest) (*ListUserExampleReply, error) {
	return nil, status.Errorf(codes.Unimplemented, "method List not implemented")
}
func (UnimplementedUserExampleServer) mustEmbedUnimplementedUserExampleServer() {}

// UnsafeUserExampleServer may be embedded to opt out of forward compatibility for this service.
// Use of this interface is not recommended, as added methods to UserExampleServer will
// result in compilation errors.
type UnsafeUserExampleServer interface {
	mustEmbedUnimplementedUserExampleServer()
}

func RegisterUserExampleServer(s grpc.ServiceRegistrar, srv UserExampleServer) {
	s.RegisterService(&UserExample_ServiceDesc, srv)
}

func _UserExample_Create_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateUserExampleRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserExampleServer).Create(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: UserExample_Create_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserExampleServer).Create(ctx, req.(*CreateUserExampleRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserExample_DeleteByID_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(DeleteUserExampleByIDRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserExampleServer).DeleteByID(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: UserExample_DeleteByID_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserExampleServer).DeleteByID(ctx, req.(*DeleteUserExampleByIDRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserExample_UpdateByID_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(UpdateUserExampleByIDRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserExampleServer).UpdateByID(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: UserExample_UpdateByID_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserExampleServer).UpdateByID(ctx, req.(*UpdateUserExampleByIDRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserExample_GetByID_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetUserExampleByIDRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserExampleServer).GetByID(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: UserExample_GetByID_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserExampleServer).GetByID(ctx, req.(*GetUserExampleByIDRequest))
	}
	return interceptor(ctx, in, info, handler)
}

func _UserExample_List_Handler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListUserExampleRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(UserExampleServer).List(ctx, in)
	}
	info := &grpc.UnaryServerInfo{
		Server:     srv,
		FullMethod: UserExample_List_FullMethodName,
	}
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		return srv.(UserExampleServer).List(ctx, req.(*ListUserExampleRequest))
	}
	return interceptor(ctx, in, info, handler)
}

// UserExample_ServiceDesc is the grpc.ServiceDesc for UserExample service.
// It's only intended for direct use with grpc.RegisterService,
// and not to be introspected or modified (even as a copy)
var UserExample_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "api.serverNameExampl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #146** (2025-12-27): **页数为1时offset不正确**
  *Symptoms*: func (p *Params) ConvertToPage() (order string, limit int, offset int) { //nolint 	page := NewPage(p.Page, p.Limit, p.Sort) 	order = page.sort 	limit = page.limit 	offset = page.page * page.limit 	return //nolint } //改正为 offset = (page.page - 1) * page.limit 
  **Post-Mortem & Fix Analysis**:
  > 页码是从0开始，不是从1开始的，[文档有说明](https://go-sponge.com/zh/component/data/custom-page-query.html#_1-%E5%88%86%E9%A1%B5%E5%8F%82%E6%95%B0-%E5%BF%85%E5%A1%AB%E9%A1%B9)。
  > Sorry

- **Issue #140** (2025-10-14): **安装最新版本sponge失败 sonic包有问题**
  *Symptoms*: <img width="963" height="603" alt="Image" src="https://github.com/user-attachments/assets/57f06a54-8529-46a6-9e1a-d03e23b9c1f5" />
  **Post-Mortem & Fix Analysis**:
  > <img width="916" height="523" alt="Image" src="https://github.com/user-attachments/assets/68a750a6-58e0-47bb-be21-c3b13defb068" />
  > @zhufuyi help
  > 升级go版本 1.25.0解决

- **Issue #137** (2026-05-30): **Add TLS domain auto-reg similar to basecamp thruster**
  *Symptoms*: 

- **Issue #136** (2025-10-31): **为h.Close()增加客户端长连接主动关闭能力**
  *Symptoms*: 情景：当客户端未主动关闭连接的情况下，若主动停止服务端(Ctrl+C)，服务端HTTP Server会被长连接Block，无法正常退出。不便于开发调试。 解决办法： 1. 在Close()内先检查客户端连接情况，对保持的连接进行关闭，并重置客户端计数。 2. 同时，增加http server Stop()函数中，Shutdown上下文超时时间，默认3秒，来不及释放长连接，可改成5秒。 ``` h.clients.Range(func(uidKey, cliVal interface{}) bool { 		cli := cliVal.(*UserClient) 		if h.clients.Has(cli.UID) { 			h.clients.Delete(cli.UID) 			close(cli.Send) 			h.zapLogger.Info("[sse] server disconnected", zap.String("uid", cli.UID)) 		} 		fmt.Printf("closing clients now %v %v\n", h.OnlineClientsNum(), cli.UID)  		return true 	})  	h.cancel()  	h.asyncTaskPool.Wait() 	h.asyncTaskPool.Stop() ```
  **Post-Mortem & Fix Analysis**:
  > 在`Close()`函数中添加了关闭客户端代码。
  > > 在`Close()`函数中添加了关闭客户端代码。  看见新增代码了。奇怪的是 更新到1.15.2后(原来1.15.1)，虽然这段代码生效了，但长连接似乎并没有成功关闭，导致http server总是超时。不知道1.15.2是否还做了其他更改？
  > 后面会在函数`Close()`添加一个bool参数： - 服务端正常退出，使用默认`Close()`或`Close(true)`表示会推送close事件给客户端，告诉客户端关闭连接，不再重试连接服务。 - 服务端panic异常退出，使用`Close(false)`表示客户端会重试5次连接服务端，最多30秒，重试之后连接服务仍然失败的话则退出。

- **Issue #134** (2025-09-13): **基于sql创建的web服务，报错：Error: modelStructTmpl format.Source error: 2:92: illegal character U+FF0C 'ï¼' (and 3 more errors)**
  *Symptoms*: 基于sql创建的web服务，报错：Error: modelStructTmpl format.Source error: 2:92: illegal character U+FF0C 'ï¼' (and 3 more errors)。MySQL数据库，表数量 191个。生成项目时，报以上错误。sponge version v1.15.1,mysq 9 ,dsn: xx:xx@(127.0.0.1:3306)/goshop?charset=utf8mb4
  **Post-Mortem & Fix Analysis**:
  > 首先分批次几找出是哪个表造成的错误，看看是否有特殊字符，例如表的注释中不要有换行符。
  > 原因已经找到：现在的版本sponge v1.15.1中对SQL DDL中的comment中的换行符("\r\n")处理存在问题，需要要注意。预计在下个下版本会处理掉。

- **Issue #133** (2025-09-12): **查询参数类型转换问题**
  *Symptoms*: **Describe the bug** 查询参数类型转换问题  **To Reproduce**  1. 描述     ```go      https://github.com/go-dev-frame/sponge/blob/main/pkg/sgorm/query/query_condition.go#convertValue()      数据库编码值存在诸如 '001','002' 这样的字符串数值, 当通过查询参数传入'001' 时由于调用 convertValue 方法进行数值转换 '001' -> 1 导致查询匹配失败, 建议提供自定义转换器接口支持    ``` 
  **Post-Mortem & Fix Analysis**:
  > 填写参数时，可以用双引号把 `001`, `002` 包起来，表示字符串，示例如下：  ```json {     "page": 0,     "limit": 10,     "columns": [         {             "name": "你的列名",             "exp": "=",             "value": "\"001\""         },     ] }

- **Issue #132** (2025-09-06): **User provided wildcards 后缀"%管理员"，前缀"客户%"模糊查询无效**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Confirm it's relative with sgorm, so this PR no need

- **Issue #131** (2025-10-18): **Apply new function wg.Go in Go 1.25**
  *Symptoms*: ## Purpose  Re the article: Go 1.25 adds WaitGroup.Go to automatically manage Add/Done for goroutines, simplifying concurrency and avoiding common counter misuse.  ## Prompt for GPT-5-high  Can you read https://mfbmina.dev/en/posts/waitgroups/ and apply the new function wg.Go in sponge ?
  **Post-Mortem & Fix Analysis**:
  > Cloase as codex is not yet learning the Go 1.25, so review process will break.

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

### Incident Patch 1: `6014b61c` (2025-12-07)
**Commit Message**: build: customize image time zone

**File**: `Makefile` (modified, +12/-0)
```diff
@@ -134,18 +134,30 @@ image-build-local: build
 .PHONY: image-build
 # Build image for remote repositories, use binary files to build, e.g. make image-build REPO_HOST=addr TAG=latest
 image-build:
+	@if [ -z "$(REPO_HOST)" ]; then \
+		echo "ERROR: REPO_HOST is required. Usage: make image-build REPO_HOST=xxx"; \
+		exit 1; \
+	fi
 	@bash scripts/image-build.sh $(REPO_HOST) $(TAG)
 
 
 .PHONY: image-build2
 # Build image for remote repositories, phase II build, e.g. make image-build2 REPO_HOST=addr TAG=latest
 image-build2:
+	@if [ -z "$(REPO_HOST)" ]; then \
+		echo "ERROR: REPO_HOST is required. Usage: make image-build2 REPO_HOST=xxx"; \
+		exit 1; \
+	fi
 	@bash scripts/image-build2.sh $(REPO_HOST) $(TAG)
 
 
 .PHONY: image-push
 # Push docker image to remote repositories, e.g. make image-push REPO_HOST=addr TAG=latest
 image-push:
+	@if [ -z "$(REPO_HOST)" ]; then \
+		echo "ERROR: REPO_HOST is required. Usage: make image-push REPO_HOST=xxx TAG=latest"; \
+		exit 1; \
+	fi
 	@bash scripts/image-push.sh $(REPO_HOST) $(TAG)
 
 
```

**File**: `Makefile-for-http` (modified, +12/-0)
```diff
@@ -87,18 +87,30 @@ image-build-local: build
 .PHONY: image-build
 # Build image for remote repositories, use binary files to build, e.g. make image-build REPO_HOST=addr TAG=latest
 image-build:
+	@if [ -z "$(REPO_HOST)" ]; then \
+		echo "ERROR: REPO_HOST is required. Usage: make image-build REPO_HOST=xxx"; \
+		exit 1; \
+	fi
 	@bash scripts/image-build.sh $(REPO_HOST) $(TAG)
 
 
 .PHONY: image-build2
 # Build image for remote repositories, phase II build, e.g. make image-build2 REPO_HOST=addr TAG=latest
 image-build2:
+	@if [ -z "$(REPO_HOST)" ]; then \
+		echo "ERROR: REPO_HOST is required. Usage: make image-build2 REPO_HOST=xxx"; \
+		exit 1; \
+	fi
 	@bash scripts/image-build2.sh $(REPO_HOST) $(TAG)
 
 
 .PHONY: image-push
 # Push docker image to remote repositories, e.g. make image-push REPO_HOST=addr TAG=latest
 image-push:
+	@if [ -z "$(REPO_HOST)" ]; then \
+		echo "ERROR: REPO_HOST is required. Usage: make image-push REPO_HOST=xxx TAG=latest"; \
+		exit 1; \
+	fi
 	@bash scripts/image-push.sh $(REPO_HOST) $(TAG)
 
 
```

**File**: `cmd/perftest/Dockerfile` (modified, +0/-6)
```diff
@@ -1,12 +1,6 @@
 FROM alpine:latest
 LABEL maintainer="zhufuyi <g.zhufuyi@gmail.com>"
 
-# set the time zone to Shanghai
-#RUN apk add tzdata  \
-#    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
-#    && echo "Asia/Shanghai" > /etc/timezone \
-#    && apk del tzdata
-
 COPY perftest /app/perftest
 RUN chmod +x /app/perftest
 
```

**File**: `cmd/perftest/build-perftest-image.sh` (modified, +2/-2)
```diff
@@ -39,9 +39,9 @@ checkResult $?
 rmFile perftest
 
 # delete none image
-noneImages=$(docker images --filter "dangling=true" -q)
+noneImages=$(docker images --filter "dangling=true" -q | grep "${zhufuyi/perftest}")
 if [ -n "$noneImages" ]; then
-    docker rmi $noneImages > /dev/null
+    docker rmi $noneImages > /dev/null 2>&1 || true
 fi
 
 # push image to docker hub
```

**File**: `deployments/docker-compose/docker-compose.yml` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ services:
     command: ["./serverNameExample", "-c", "/app/configs/serverNameExample.yml"]
     volumes:
       - $PWD/configs:/app/configs
+      - /etc/localtime:/etc/localtime:ro  # mount the local time file
+    #environment:
+    #  - TZ=Asia/Shanghai
 # todo generate docker-compose.yml code for http or grpc here
 # delete the templates code start
     ports:
```

**File**: `deployments/kubernetes/serverNameExample-deployment.yml` (modified, +11/-1)
```diff
@@ -31,7 +31,13 @@ spec:
             - name: server-name-example-vl
               mountPath: /app/configs/
               readOnly: true
-# todo generate k8s-deployment.yml code for http or grpc here
+            - name: host-timezone
+              mountPath: /etc/localtime
+              readOnly: true
+          #env:
+          #  - name: TZ
+          #    value: "Asia/Shanghai"
+          # todo generate k8s-deployment.yml code for http or grpc here
 # delete the templates code start
           ports:
             - name: http-port
@@ -73,3 +79,7 @@ spec:
         - name: server-name-example-vl
           configMap:
             name: server-name-example-config
+        - name: host-timezone
+          hostPath:
+            path: /etc/localtime
+            type: File
```

**File**: `scripts/build/Dockerfile` (modified, +0/-6)
```diff
@@ -1,12 +1,6 @@
 FROM alpine:latest
 MAINTAINER zhufuyi "g.zhufuyi@gmail.com"
 
-# set the time zone to Shanghai
-RUN apk add tzdata  \
-    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
-    && echo "Asia/Shanghai" > /etc/timezone \
-    && apk del tzdata
-
 # todo generate dockerfile code for http or grpc here
 # delete the templates code start
 
```

**File**: `scripts/build/Dockerfile_build` (modified, +0/-6)
```diff
@@ -28,12 +28,6 @@ RUN cd $GOPATH/pkg/mod/github.com/grpc-ecosystem/grpc-health-probe@v0.4.12 \
 FROM alpine:latest
 MAINTAINER zhufuyi "g.zhufuyi@gmail.com"
 
-# set the time zone to Shanghai
-RUN apk add tzdata  \
-    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
-    && echo "Asia/Shanghai" > /etc/timezone \
-    && apk del tzdata
-
 # add curl, used in the http service check, if deployed in k8s, can be installed without
 RUN apk add curl
 # add grpc_health_probe for health check of grpc service
```

---

### Incident Patch 2: `209e6b83` (2025-11-23)
**Commit Message**: fix: ignore count query for gorm

**File**: `pkg/gin/staticfs/listdir.go` (modified, +21/-4)
```diff
@@ -21,6 +21,7 @@ type listDirOptions struct {
 	prefixPath     string
 	enableDownload bool // default: false
 	enableFilter   bool // default: true
+	middlewares    []gin.HandlerFunc
 }
 
 func (o *listDirOptions) apply(opts ...ListDirOption) {
@@ -70,6 +71,13 @@ func WithListDirDirsFilter(filters ...string) ListDirOption {
 	}
 }
 
+// WithListDirMiddlewares sets middlewares.
+func WithListDirMiddlewares(middlewares ...gin.HandlerFunc) ListDirOption {
+	return func(o *listDirOptions) {
+		o.middlewares = append(o.middlewares, middlewares...)
+	}
+}
+
 // -------------------------------------------------------------------------------------------
 
 // FileInfo is a struct that represents a file or directory in the file system.
@@ -317,11 +325,20 @@ func ListDir(r *gin.Engine, opts ...ListDirOption) {
 		prefixPath = ""
 	}
 
-	r.GET(prefixPath+"/dir/list", handleList(prefixPath, o))
-	if o.enableDownload {
-		r.GET(prefixPath+"/dir/file/download", handleDownload)
+	if len(o.middlewares) > 0 {
+		group := r.Group("", o.middlewares...)
+		group.GET(prefixPath+"/dir/list", handleList(prefixPath, o))
+		if o.enableDownload {
+			group.GET(prefixPath+"/dir/file/download", handleDownload)
+		}
+		group.GET(prefixPath+"/dir/list/api", handleAPIList(o.enableFilter))
+	} else {
+		r.GET(prefixPath+"/dir/list", handleList(prefixPath, o))
+		if o.enableDownload {
+			r.GET(prefixPath+"/dir/file/download", handleDownload)
+		}
+		r.GET(prefixPath+"/dir/list/api", handleAPIList(o.enableFilter))
 	}
-	r.GET(prefixPath+"/dir/list/api", handleAPIList(o.enableFilter))
 }
 
 // nolint
```

**File**: `pkg/gin/staticfs/listdir_test.go` (modified, +7/-1)
```diff
@@ -391,7 +391,13 @@ func TestListDirRouterSetup(t *testing.T) {
 	})
 
 	t.Run("WithDownloadEnabled", func(t *testing.T) {
-		r, tmpDir := setupTestServer(t, WithListDirDownload())
+		middleware := func(c *gin.Context) {
+			c.Header("X-Test-Header", "test-value")
+			c.Next()
+		}
+		r, tmpDir := setupTestServer(t,
+			WithListDirDownload(),
+			WithListDirMiddlewares(middleware))
 		filePath := filepath.Join(tmpDir, "file1.txt")
 		url := fmt.Sprintf("/dir/file/download?path=%s", filePath)
 		w := newRequest(t, r, "GET", url)
```

**File**: `pkg/sgorm/query/page.go` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ func NewPage(page int, limit int, columnNames string) *Page {
 //	columnNames="-name,-age" means sort by name descending before sorting by age descending.
 func getSort(columnNames string) string {
 	columnNames = strings.Replace(columnNames, " ", "", -1)
-	if columnNames == "" {
+	if columnNames == "" || columnNames == "ignorecount" {
 		return "id DESC"
 	}
 
```

---

### Incident Patch 3: `fd3c29bb` (2025-11-15)
**Commit Message**: fix: golangci lint code

**File**: `.github/RELEASE.md` (modified, +3/-0)
```diff
@@ -3,3 +3,6 @@
 
 1. Improved SSE service shutdown process — now automatically sends a close event to clients upon exit. [#136](https://github.com/go-dev-frame/sponge/issues/136)
 2. Added gRPC performance testing support to `perftest`, expanding its benchmarking capabilities.
+
+fix PostgreSQL's timestamptz type support [#141](https://github.com/go-dev-frame/sponge/issues/141)
+
```

**File**: `pkg/httpsrv/tls_self_signed.go` (modified, +1/-5)
```diff
@@ -194,11 +194,7 @@ func (c *TLSSelfSignedConfig) createCert() error {
 	if err != nil {
 		return err
 	}
-	if err = pem.Encode(keyOut, &pem.Block{Type: "EC PRIVATE KEY", Bytes: b}); err != nil {
-		return err
-	}
-
-	return nil
+	return pem.Encode(keyOut, &pem.Block{Type: "EC PRIVATE KEY", Bytes: b})
 }
 
 func (c *TLSSelfSignedConfig) Run(server *http.Server) error {
```

---

### Incident Patch 4: `613d4296` (2025-11-15)
**Commit Message**: test: fix error test

**File**: `pkg/gin/staticfs/listdir_test.go` (modified, +1/-1)
```diff
@@ -309,7 +309,7 @@ func TestHandleList(t *testing.T) {
 		assert.Equal(t, http.StatusOK, w.Code)
 		body, _ := io.ReadAll(w.Body)
 		// Expect a "Back to Parent" link that points to tmpDir
-		assert.Contains(t, string(body), "ctest-staticfs-")
+		assert.Contains(t, string(body), "<!DOCTYPE html>")
 	})
 }
 
```

---

### Incident Patch 5: `d0557f80` (2025-11-07)
**Commit Message**: fix: match postgresql type timestamptz

**File**: `pkg/sql2code/parser/postgresql.go` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ func (field *PGField) getMysqlType() string {
 		}
 	case "text":
 		return "text"
-	case "timestamp":
+	case "timestamp", "timestamptz":
 		return "timestamp"
 	case "date":
 		return "date"
```

---

### Incident Patch 6: `d1ede7dd` (2025-11-07)
**Commit Message**: fix: test failed

**File**: `pkg/process/kill_windows_test.go` (modified, +3/-2)
```diff
@@ -46,13 +46,14 @@ func TestWindows_TryGracefulExit(t *testing.T) {
 	t.Log("Started process with PID", pid)
 
 	// Wait a bit to ensure the process and its console are fully initialized
-	time.Sleep(250 * time.Millisecond)
+	time.Sleep(time.Second)
 
 	ok := tryGracefulExit(pid)
 	if !ok {
 		err = cmd.Process.Kill()
 		if err != nil {
-			t.Fatal("tryGracefulExit failed, but it should have succeeded")
+			t.Log("tryGracefulExit failed, but it should have succeeded")
+			return
 		}
 	}
 
```

**File**: `pkg/proxykit/proxy_test.go` (modified, +4/-4)
```diff
@@ -76,8 +76,8 @@ func TestProxy_ServeHTTP(t *testing.T) {
 		if rr.Code != http.StatusServiceUnavailable {
 			t.Errorf("expected status %d, got %d", http.StatusServiceUnavailable, rr.Code)
 		}
-		if !strings.Contains(rr.Body.String(), "Service not available") {
-			t.Errorf("expected body 'Service not available', got '%s'", rr.Body.String())
+		if !strings.Contains(rr.Body.String(), "service not available") {
+			t.Errorf("expected body 'service not available', got '%s'", rr.Body.String())
 		}
 	})
 
@@ -117,8 +117,8 @@ func TestProxy_ServeHTTP(t *testing.T) {
 		if rr.Code != http.StatusOK {
 			t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
 		}
-		if body := rr.Body.String(); body != "Hello from backend" {
-			t.Errorf("expected body 'Hello from backend', got '%s'", body)
+		if body := rr.Body.String(); body != "hello from backend" {
+			t.Errorf("expected body 'hello from backend', got '%s'", body)
 		}
 		if header := rr.Header().Get("X-Backend-Header"); header != "backend-value" {
 			t.Errorf("expected header 'X-Backend-Header' to be 'backend-value', got '%s'", header)
```

---

### Incident Patch 7: `3451b68a` (2025-10-30)
**Commit Message**: feat: add consume loop function

**File**: `pkg/kafka/README.md` (modified, +10/-8)
```diff
@@ -31,7 +31,7 @@ func main() {
 	defer p.Close()
 
 	// Case 1: send sarama.ProducerMessage type message
-	msg := testData[0].(*sarama.ProducerMessage) // testData is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/producer_test.go#L18
+	msg := testData[0].(*sarama.ProducerMessage) // testData is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/producer_test.go#L19
 	partition, offset, err := p.SendMessage(msg)
 	if err != nil {
 		fmt.Println(err)
@@ -73,7 +73,7 @@ func main() {
 		kafka.AsyncProducerWithVersion(sarama.V3_6_0_0),
 		kafka.AsyncProducerWithRequiredAcks(sarama.WaitForLocal),
 		kafka.AsyncProducerWithFlushMessages(50),
-		kafka.AsyncProducerWithFlushFrequency(time.milliseconds*500),
+		kafka.AsyncProducerWithFlushFrequency(time.Millisecond*500),
 	)
 	if err != nil {
 		fmt.Println(err)
@@ -82,7 +82,7 @@ func main() {
 	defer p.Close()
 
 	// Case 1: send sarama.ProducerMessage type message, supports multiple messages
-	msg := testData[0].(*sarama.ProducerMessage) // testData is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/producer_test.go#L18
+	msg := testData[0].(*sarama.ProducerMessage) // testData is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/producer_test.go#L19
 	err = p.SendMessage(msg, msg)
 	if err != nil {
 		fmt.Println(err)
@@ -112,6 +112,7 @@ package main
 import (
 	"fmt"
 	"time"
+	"context"
 	"github.com/IBM/sarama"
 	"github.com/go-dev-frame/sponge/pkg/kafka"
 )
@@ -130,11 +131,11 @@ func main() {
 	defer cg.Close()
 
 	// Case 1: consume default handle message
-	go cg.Consume(context.Background(), []string{testTopic}, handleMsgFn) // handleMsgFn is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/consumer_test.go#L19
+	go cg.ConsumeLoop(context.Background(), []string{testTopic}, handleMsgFn) // handleMsgFn is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/consumer_test.go#L19
 
 	// Case 2: consume custom handle message
-	go cg.ConsumeCustom(context.Background(), []string{testTopic}, &myConsumerGroupHandler{ // myConsumerGroupHandler is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/consumer_test.go#L26
-		autoCommitEnable: cg.autoCommitEnable,
+	go cg.ConsumeCustomLoop(context.Background(), []string{testTopic}, &myConsumerGroupHandler{ // myConsumerGroupHandler is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/consumer_test.go#L26
+		autoCommitEnable: true,
 	})
 
 	<-time.After(time.Minute) // wait exit
@@ -150,9 +151,10 @@ package main
 
 import (
 	"fmt"
+	"time"
+	"context"
 	"github.com/IBM/sarama"
 	"github.com/go-dev-frame/sponge/pkg/kafka"
-	"time"
 )
 
 func main() {
@@ -167,7 +169,7 @@ func main() {
 	defer c.Close()
 
 	// Case 1: consume one partition
-	go c.ConsumePartition(context.Background(), testTopic, 0, sarama.OffsetNewest, handleMsgFn) // // handleMsgFn is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/consumer_test.go#L19
+	go c.ConsumePartition(context.Background(), testTopic, 0, sarama.OffsetNewest, handleMsgFn) // handleMsgFn is https://github.com/go-dev-frame/sponge/blob/main/pkg/kafka/consumer_test.go#L19
 
 	// Case 2: consume all partition
 	c.ConsumeAllPartition(context.Background(), testTopic, sarama.OffsetNewest, handleMsgFn)
```

**File**: `pkg/kafka/consumer.go` (modified, +72/-3)
```diff
@@ -2,6 +2,7 @@ package kafka
 
 import (
 	"context"
+	"time"
 
 	"github.com/IBM/sarama"
 	"go.uber.org/zap"
@@ -51,6 +52,40 @@ func InitConsumerGroup(addrs []string, groupID string, opts ...ConsumerOption) (
 	}, nil
 }
 
+// ConsumeLoop consume messages in a loop, with rebalanced handling
+func (c *ConsumerGroup) ConsumeLoop(ctx context.Context, topics []string, handleMessageFn HandleMessageFn) {
+	backoff := time.Second
+	maxBackoff := 30 * time.Second
+
+	for {
+		err := c.Consume(ctx, topics, handleMessageFn)
+		if err != nil {
+			select {
+			case <-time.After(backoff):
+			case <-ctx.Done():
+				return
+			}
+
+			if backoff < maxBackoff {
+				backoff *= 2
+				if backoff > maxBackoff {
+					backoff = maxBackoff
+				}
+			}
+			continue
+		}
+
+		// Normal exit (mostly due to rebalanced), should reset the backoff and wait for the next time to join the consumption group
+		backoff = time.Second
+
+		if ctx.Err() != nil {
+			return
+		}
+
+		c.zapLogger.Info("rebalanced, starting new session", zap.String("group_id", c.groupID), zap.Strings("topics", topics))
+	}
+}
+
 // Consume consume messages
 func (c *ConsumerGroup) Consume(ctx context.Context, topics []string, handleMessageFn HandleMessageFn) error {
 	handler := &defaultConsumerHandler{
@@ -68,11 +103,45 @@ func (c *ConsumerGroup) Consume(ctx context.Context, topics []string, handleMess
 	return nil
 }
 
+// ConsumeCustomLoop consume messages for custom handler in a loop, with rebalanced handling
+func (c *ConsumerGroup) ConsumeCustomLoop(ctx context.Context, topics []string, handler sarama.ConsumerGroupHandler) {
+	backoff := time.Second
+	maxBackoff := 30 * time.Second
+
+	for {
+		err := c.ConsumeCustom(ctx, topics, handler)
+		if err != nil {
+			select {
+			case <-time.After(backoff):
+			case <-ctx.Done():
+				return
+			}
+
+			if backoff < maxBackoff {
+				backoff *= 2
+				if backoff > maxBackoff {
+					backoff = maxBackoff
+				}
+			}
+			continue
+		}
+
+		// Normal exit (mostly due to rebalanced), should reset the backoff and wait for the next time to join the consumption group
+		backoff = time.Second
+
+		if ctx.Err() != nil {
+			return
+		}
+
+		c.zapLogger.Info("rebalanced, starting new session", zap.String("group_id", c.groupID), zap.Strings("topics", topics))
+	}
+}
+
 // ConsumeCustom consume messages for custom handler, you need to implement the sarama.ConsumerGroupHandler interface
 func (c *ConsumerGroup) ConsumeCustom(ctx context.Context, topics []string, handler sarama.ConsumerGroupHandler) error {
 	err := c.Group.Consume(ctx, topics, handler)
 	if err != nil {
-		c.zapLogger.Error("failed to consume messages", zap.String("group_id", c.groupID), zap.Strings("topics", topics), zap.Error(err))
+		c.zapLogger.Error("failed to consume custom messages", zap.String("group_id", c.groupID), zap.Strings("topics", topics), zap.Error(err))
 		return err
 	}
 	return nil
@@ -192,11 +261,11 @@ func (c *Consumer) ConsumePartition(ctx context.Context, topic string, partition
 	for {
 		select {
 		case msg := <-pc.Messages():
-			err := handleFn(msg)
+			err = handleFn(msg)
 			if err != nil {
 				c.zapLogger.Warn("failed to handle message", zap.Error(err), zap.String("topic", topic), zap.Int32("partition", partition), zap.Int64("offset", msg.Offset))
 			}
-		case err := <-pc.Errors():
+		case err = <-pc.Errors():
 			c.zapLogger.Error("partition consumer error", zap.Error(err))
 		case <-ctx.Done():
 			return
```

---

### Incident Patch 8: `dda79b06` (2025-10-03)
**Commit Message**: fix: close long client connections

**File**: `pkg/sse/client.go` (modified, +2/-2)
```diff
@@ -2,13 +2,13 @@ package sse
 
 import (
 	"bufio"
-	"encoding/json"
 	"fmt"
 	"net/http"
 	"strings"
 	"sync"
 	"time"
 
+	json "github.com/bytedance/sonic"
 	"go.uber.org/zap"
 )
 
@@ -23,7 +23,7 @@ type clientOptions struct {
 func defaultClientOptions() *clientOptions {
 	logger, _ := zap.NewProduction()
 	return &clientOptions{
-		reconnectTimeInterval: 3 * time.Second,
+		reconnectTimeInterval: 5 * time.Second,
 		zapLogger:             logger,
 	}
 }
```

**File**: `pkg/sse/hub.go` (modified, +14/-2)
```diff
@@ -187,7 +187,7 @@ func (h *Hub) run() {
 				case cli.Send <- ue.Event:
 				//h.zapLogger.Info("[sse] pushed event to client", zap.String("uid", ue.UID), zap.String("event_id", ue.Event.ID))
 				default:
-					trySendWithTimeout(h, cli, ue, 3*time.Second)
+					trySendWithTimeout(h, cli, ue, 5*time.Second)
 				}
 			}
 
@@ -248,7 +248,7 @@ func pushOne(h *Hub, ue *UserEvent) {
 	default:
 		// use async task pool to submit push task with timeout retry
 		h.asyncTaskPool.Submit(func() {
-			tryPushWithTimeout(h, ue, 3*time.Second)
+			tryPushWithTimeout(h, ue, 5*time.Second)
 		})
 	}
 }
@@ -373,6 +373,18 @@ func (h *Hub) OnlineClientsNum() int {
 
 // Close event center and stop all worker
 func (h *Hub) Close() {
+	if h.OnlineClientsNum() > 0 {
+		h.zapLogger.Info("[sse] closing clients", zap.Int("client_num", h.OnlineClientsNum()))
+	}
+	h.clients.Range(func(uidKey, cliVal interface{}) bool {
+		cli := cliVal.(*UserClient)
+		if h.clients.Has(cli.UID) {
+			h.clients.Delete(cli.UID)
+			close(cli.Send)
+		}
+		return true
+	})
+
 	h.cancel()
 	h.asyncTaskPool.Wait()
 	h.asyncTaskPool.Stop()
```

**File**: `pkg/sse/server.go` (modified, +2/-2)
```diff
@@ -2,13 +2,13 @@ package sse
 
 import (
 	"bytes"
-	"encoding/json"
 	"fmt"
 	"io"
 	"net/http"
 	"sync"
 	"time"
 
+	json "github.com/bytedance/sonic"
 	"github.com/gin-gonic/gin"
 )
 
@@ -41,7 +41,7 @@ func WithServeExtraHeaders(headers map[string]string) ServeOption {
 // Serve serves a client connection
 func (h *Hub) Serve(c *gin.Context, uid string, opts ...ServeOption) {
 	if uid == "" {
-		responseCode400(c,"uid is empty, not allow connection")
+		responseCode400(c, "uid is empty, not allow connection")
 		return
 	}
 
```

---

### Incident Patch 9: `eccd2dd4` (2025-09-30)
**Commit Message**: style: add default setting IdleTimeout to web service

**File**: `internal/server/grpc.go` (modified, +3/-2)
```diff
@@ -66,8 +66,9 @@ func (s *grpcServer) Start() error {
 	if s.mux != nil {
 		addr := fmt.Sprintf(":%d", config.Get().Grpc.HTTPPort)
 		s.httpServer = &http.Server{
-			Addr:    addr,
-			Handler: s.mux,
+			Addr:        addr,
+			Handler:     s.mux,
+			IdleTimeout: time.Second * 60,
 		}
 		go func() {
 			fmt.Printf("http address of pprof and metrics %s\n", addr)
```

**File**: `internal/server/http.go` (modified, +2/-0)
```diff
@@ -76,6 +76,7 @@ func NewHTTPServer(addr string, opts ...HTTPOption) app.IServer {
 		Handler: router,
 		//ReadTimeout:    time.Second*30,
 		//WriteTimeout:   time.Second*60,
+		IdleTimeout:    time.Second * 60,
 		MaxHeaderBytes: 1 << 20,
 	}
 
@@ -106,6 +107,7 @@ func NewHTTPServer_pbExample(addr string, opts ...HTTPOption) app.IServer { //no
 		Handler: router,
 		//ReadTimeout:    time.Second*30,
 		//WriteTimeout:   time.Second*60,
+		IdleTimeout:    time.Second * 60,
 		MaxHeaderBytes: 1 << 20,
 	}
 
```

---

### Incident Patch 10: `e2b8824d` (2025-09-27)
**Commit Message**: fix: code generation failed due to sql comments having newlines

**File**: `pkg/sql2code/parser/parser.go` (modified, +18/-2)
```diff
@@ -405,6 +405,22 @@ func isIgnoreFields(colName string, falseColumn ...string) bool {
 	return ok
 }
 
+var newlineIdentifier = []struct{ old, new string }{
+	{"\r\n", "\n//"},
+	{"\n", "\n//"},
+	{"\r", "\n//"},
+	{"\n////", "\n//"},
+}
+
+func replaceCommentNewline(comment string) string {
+	for _, r := range newlineIdentifier {
+		if strings.Contains(comment, r.old) {
+			comment = strings.ReplaceAll(comment, r.old, r.new)
+		}
+	}
+	return comment
+}
+
 type codeText struct {
 	importPaths   []string
 	modelStruct   string
@@ -451,7 +467,7 @@ func makeCode(stmt *ast.CreateTableStmt, opt options) (*codeText, error) {
 	// find table comment
 	for _, o := range stmt.Options {
 		if o.Tp == ast.TableOptionComment {
-			data.Comment = o.StrValue
+			data.Comment = replaceCommentNewline(o.StrValue)
 			break
 		}
 	}
@@ -529,7 +545,7 @@ func makeCode(stmt *ast.CreateTableStmt, opt options) (*codeText, error) {
 			case ast.ColumnOptionOnUpdate: // For Timestamp and Datetime only.
 			case ast.ColumnOptionFulltext:
 			case ast.ColumnOptionComment:
-				field.Comment = o.Expr.GetDatum().GetString()
+				field.Comment = replaceCommentNewline(o.Expr.GetDatum().GetString())
 			default:
 				//return "", nil, errors.Errorf(" unsupport option %d\n", o.Tp)
 			}
```

---

### Incident Patch 11: `19037304` (2025-09-10)
**Commit Message**: fix: plugin name

**File**: `cmd/sponge/commands/perftest/README.md` (modified, +2/-2)
```diff
@@ -22,10 +22,10 @@ It can execute high-concurrency requests efficiently and push real-time statisti
 ### 📦 Installation
 
 ```bash
-go install github.com/go-dev-frame/sponge/cmd/perftest@latest
+go install github.com/go-dev-frame/sponge/cmd/sponge@latest
 ```
 
-After installation, run `perftest -h` to see usage.
+After installation, run `sponge perftest -h` to see usage.
 
 <br>
 
```

**File**: `cmd/sponge/commands/perftest/readme-cn.md` (modified, +2/-2)
```diff
@@ -22,10 +22,10 @@
 ### 📦 安装
 
 ```bash
-go install github.com/go-dev-frame/sponge/cmd/perftest@latest
+go install github.com/go-dev-frame/sponge/cmd/sponge@latest
 ```
 
-安装完成后，执行 `perftest -h` 查看帮助。
+安装完成后，执行 `sponge perftest -h` 查看帮助。
 
 <br>
 
```

**File**: `cmd/sponge/commands/plugins.go` (modified, +1/-3)
```diff
@@ -24,7 +24,6 @@ var pluginNames = []string{
 	"protoc-gen-go-gin",
 	"protoc-gen-go-rpc-tmpl",
 	"protoc-gen-json-field",
-	"perftest",
 	"protoc-gen-openapiv2",
 	"protoc-gen-doc",
 	"swag",
@@ -42,7 +41,6 @@ var installPluginCommands = map[string]string{
 	"protoc-gen-go-gin":      "github.com/go-dev-frame/sponge/cmd/protoc-gen-go-gin@latest",
 	"protoc-gen-go-rpc-tmpl": "github.com/go-dev-frame/sponge/cmd/protoc-gen-go-rpc-tmpl@latest",
 	"protoc-gen-json-field":  "github.com/go-dev-frame/sponge/cmd/protoc-gen-json-field@latest",
-	"perftest":               "github.com/go-dev-frame/sponge/cmd/perftest@latest",
 	"protoc-gen-openapiv2":   "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest",
 	"protoc-gen-doc":         "github.com/pseudomuto/protoc-gen-doc/cmd/protoc-gen-doc@latest",
 	"swag":                   "github.com/swaggo/swag/cmd/swag@v1.8.12",
@@ -181,7 +179,7 @@ func installPlugins(lackNames []string) {
 
 func adaptInternalCommand(name string, pkgAddr string) string {
 	if name == "protoc-gen-go-gin" || name == "protoc-gen-go-rpc-tmpl" ||
-		name == "protoc-gen-json-field" || name == "perftest" {
+		name == "protoc-gen-json-field" {
 		if version != "v0.0.0" {
 			return strings.ReplaceAll(pkgAddr, "@latest", "@"+version)
 		}
```

---

### Incident Patch 12: `4b8ed643` (2025-09-03)
**Commit Message**: ✨Fix cyclomatic complexity 25 of func `AdaptiveMysqlDsn` is high (> 20) (gocyclo)

**File**: `pkg/utils/dsn.go` (modified, +110/-98)
```diff
@@ -11,107 +11,119 @@ func AdaptiveMysqlDsn(dsn string) string {
 	// remove optional scheme prefix
 	dsn = strings.ReplaceAll(dsn, "mysql://", "")
 
-	// ensure a valid network/address section for go-sql-driver/mysql
-	// Expected forms:
-	//   user:pass@tcp(127.0.0.1:3306)/db
-	//   user:pass@unix(/path/mysql.sock)/db
-	// If it's like '@(127.0.0.1:3306)' → add 'tcp'
-	// If it's like '@127.0.0.1:3306' → wrap to '@tcp(127.0.0.1:3306)'
-	at := strings.Index(dsn, "@")
-	if at != -1 {
-		afterAt := dsn[at+1:]
-		slashIdx := strings.Index(afterAt, "/")
-		if slashIdx != -1 {
-			addrPart := afterAt[:slashIdx]
-			// If empty addrPart, nothing to fix
-			if addrPart != "" {
-				if strings.HasPrefix(addrPart, "(") {
-					// missing protocol
-					dsn = strings.Replace(dsn, "@(", "@tcp(", 1)
-				} else if !(strings.HasPrefix(addrPart, "tcp(") || strings.HasPrefix(addrPart, "unix(")) {
-					// no parentheses and no protocol → wrap with tcp()
-					dsn = strings.Replace(dsn, "@"+addrPart, "@tcp("+addrPart+")", 1)
-				}
-			}
-		}
-	}
-
-	// ensure the connection prefers utf8mb4 to avoid collation mismatch
-	// issues with MySQL 8 (e.g. mixing utf8mb3_general_ci and utf8mb4_0900_ai_ci).
-	qIdx := strings.Index(dsn, "?")
-	if qIdx == -1 {
-		// no query string → add charset parameter
-		return dsn + "?charset=utf8mb4"
-	}
+	dsn = ensureNetworkAddress(dsn)
+	return ensureCharsetAndCollation(dsn)
+}
 
-	prefix := dsn[:qIdx]
-	queryStr := dsn[qIdx+1:]
-	parts := strings.Split(queryStr, "&")
-
-	hasCharset := false
-	hasCollation := false
-	for i, p := range parts {
-		if strings.HasPrefix(p, "charset=") {
-			hasCharset = true
-			val := strings.TrimPrefix(p, "charset=")
-			// split by comma and de-duplicate while ensuring utf8mb4 comes first if present/added
-			charsets := []string{}
-			for _, cs := range strings.Split(val, ",") {
-				cs = strings.TrimSpace(cs)
-				if cs == "" {
-					continue
-				}
-				// skip duplicates
-				dup := false
-				for _, existing := range charsets {
-					if strings.EqualFold(existing, cs) {
-						dup = true
-						break
-					}
-				}
-				if !dup {
-					charsets = append(charsets, cs)
-				}
-			}
-
-			// ensure utf8mb4 is present and at the first position
-			containsUtf8mb4 := false
-			for _, cs := range charsets {
-				if strings.EqualFold(cs, "utf8mb4") {
-					containsUtf8mb4 = true
-					break
-				}
-			}
-			if !containsUtf8mb4 {
-				charsets = append([]string{"utf8mb4"}, charsets...)
-			} else if len(charsets) > 0 && !strings.EqualFold(charsets[0], "utf8mb4") {
-				// move utf8mb4 to front
-				newOrder := []string{"utf8mb4"}
-				for _, cs := range charsets {
-					if !strings.EqualFold(cs, "utf8mb4") {
-						newOrder = append(newOrder, cs)
-					}
-				}
-				charsets = newOrder
-			}
-
-			parts[i] = "charset=" + strings.Join(charsets, ",")
-			break
-		}
-		if strings.HasPrefix(p, "collation=") {
-			hasCollation = true
-		}
-	}
+// helper: ensure network/address section is valid for go-sql-driver/mysql
+func ensureNetworkAddress(dsn string) string {
+    at := strings.Index(dsn, "@")
+    if at == -1 {
+        return dsn
+    }
+
+    afterAt := dsn[at+1:]
+    slashIdx := strings.Index(afterAt, "/")
+    if slashIdx == -1 {
+        return dsn
+    }
+
+    addrPart := afterAt[:slashIdx]
+    if addrPart == "" {
+        return dsn
+    }
+
+    if strings.HasPrefix(addrPart, "(") {
+        // missing protocol, add tcp
+        return strings.Replace(dsn, "@(", "@tcp(", 1)
+    }
+
+    if strings.HasPrefix(addrPart, "tcp(") || strings.HasPrefix(addrPart, "unix(") {
+        return dsn
+    }
+
+    // no parentheses and no protocol → wrap with tcp()
+    return strings.Replace(dsn, "@"+addrPart, "@tcp("+addrPart+")", 1)
+}
 
-	if !hasCharset {
-		parts = append(parts, "charset=utf8mb4")
-	}
-	if !hasCollation {
-		// default to a broadly compatible utf8mb4 collation
-		parts = append(parts, "collation=utf8mb4_general_ci")
-	}
+// helper: ensure charset utf8mb4 and a reasonable collation are present
+func ensureCharsetAndCollation(dsn string) string {
+    qIdx := strings.Index(dsn, "?")
+    if qIdx == -1 {
+        return dsn + "?charset=utf8mb4"
+    }
+
+    prefix := dsn[:qIdx]
+    queryStr := dsn[qIdx+1:]
+    parts := strings.Split(queryStr, "&")
+
+    hasCharset := false
+    hasCollation := false
+    for i, p := range parts {
+        if strings.HasPrefix(p, "charset=") {
+            hasCharset = true
+            parts[i] = "charset=" + normalizeCharsets(strings.TrimPrefix(p, "charset="))
+            break
+        }
+        if strings.HasPrefix(p, "collation=") {
+            hasCollation = true
+        }
+    }
+
+    if !hasCharset {
+        parts = append(parts, "charset=utf8mb4")
+    }
+    if !hasCollation {
+        parts = append(parts, "collation=utf8mb4_general_ci")
+    }
+
+    return prefix + "?" + strings.Join(parts, "&")
+}
 
-	return prefix + "?" + strings.Join(parts, "&")
+// normalizeCharsets deduplicates a comma
```

---

### Incident Patch 13: `cc9cf382` (2025-09-03)
**Commit Message**: ✨Fix api/v1/users/condition end point can not handle filter with Chinese payload like:

{
  "columns": [
    {
      "name": "chinese_name",
      "exp": "like",
      "value": "过%"
    }
  ]
}

**File**: `cmd/sponge/commands/generate/template.go` (modified, +2/-2)
```diff
@@ -488,7 +488,7 @@ database:
   # mysql settings
   mysql:
     # dsn format,  <username>:<password>@(<hostname>:<port>)/<db>?[k=v& ......]
-    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8,utf8mb4"
+    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8mb4&collation=utf8mb4_general_ci"
     enableLog: true         # whether to turn on printing of all logs
     maxIdleConns: 10        # set the maximum number of connections in the idle connection pool
     maxOpenConns: 100       # set the maximum number of open database connections
@@ -535,7 +535,7 @@ database:
   # mysql settings
   mysql:
     # dsn format,  <username>:<password>@(<hostname>:<port>)/<db>?[k=v& ......]
-    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8,utf8mb4"
+    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8mb4&collation=utf8mb4_general_ci"
     enableLog: true         # whether to turn on printing of all logs
     maxIdleConns: 10        # set the maximum number of connections in the idle connection pool
     maxOpenConns: 100       # set the maximum number of open database connections
```

**File**: `configs/serverNameExample.yml` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ database:
   # mysql settings
   mysql:
     # dsn format,  <username>:<password>@(<hostname>:<port>)/<db>?[k=v& ......]
-    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8,utf8mb4"
+    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8mb4&collation=utf8mb4_general_ci"
     enableLog: true         # whether to turn on printing of all logs
     maxIdleConns: 10        # set the maximum number of connections in the idle connection pool
     maxOpenConns: 100       # set the maximum number of open database connections
```

**File**: `pkg/conf/test.yml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ database:
 # mysql settings
   mysql:
     # dsn format, <user>:<pass>@(127.0.0.1:3306)/<db>?[k=v& ......]
-    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8,utf8mb4"
+    dsn: "root:123456@(192.168.3.37:3306)/account?parseTime=true&loc=Local&charset=utf8mb4&collation=utf8mb4_general_ci"
 
 # redis settings
 redis:
```

**File**: `pkg/sgorm/README.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Support `mysql`, `postgresql`, `sqlite`.
 ```go
     import "github.com/go-dev-frame/sponge/pkg/sgorm/mysql"
 
-    var dsn = "root:123456@(127.0.0.1:3306)/test?charset=utf8mb4&parseTime=True&loc=Local"
+    var dsn = "root:123456@(127.0.0.1:3306)/test?charset=utf8mb4&collation=utf8mb4_general_ci&parseTime=True&loc=Local"
 
     // case 1: connect to the database using the default settings
     db, err := mysql.Init(dsn)
```

**File**: `pkg/sgorm/mysql/mysql.go` (modified, +4/-3)
```diff
@@ -16,6 +16,7 @@ import (
 
 	"github.com/go-dev-frame/sponge/pkg/sgorm/dbclose"
 	"github.com/go-dev-frame/sponge/pkg/sgorm/glog"
+	"github.com/go-dev-frame/sponge/pkg/utils"
 )
 
 // Init mysql
@@ -35,7 +36,7 @@ func Init(dsn string, opts ...Option) (*gorm.DB, error) {
 	if err != nil {
 		return nil, err
 	}
-	db.Set("gorm:table_options", "CHARSET=utf8mb4") // automatic appending of table suffixes when creating tables
+	db.Set("gorm:table_options", "CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci") // automatic appending of table suffixes when creating tables
 
 	// register trace plugin
 	if o.enableTrace {
@@ -108,14 +109,14 @@ func rwSeparationPlugin(o *options) gorm.Plugin {
 	slaves := []gorm.Dialector{}
 	for _, dsn := range o.slavesDsn {
 		slaves = append(slaves, mysqlDriver.New(mysqlDriver.Config{
-			DSN: dsn,
+			DSN: utils.AdaptiveMysqlDsn(dsn),
 		}))
 	}
 
 	masters := []gorm.Dialector{}
 	for _, dsn := range o.mastersDsn {
 		masters = append(masters, mysqlDriver.New(mysqlDriver.Config{
-			DSN: dsn,
+			DSN: utils.AdaptiveMysqlDsn(dsn),
 		}))
 	}
 
```

**File**: `pkg/sgorm/query/query_condition.go` (modified, +7/-6)
```diff
@@ -145,12 +145,13 @@ func (c *Column) checkExp() (string, error) {
 			if !ok1 {
 				return symbol, fmt.Errorf("invalid value type '%s'", c.Value)
 			}
-			l := len(val)
-			if l > 2 {
-				val2 := val[1 : l-1]
-				val2 = strings.ReplaceAll(val2, "%", "\\%")
-				val2 = strings.ReplaceAll(val2, "_", "\\_")
-				val = string(val[0]) + val2 + string(val[l-1])
+			// Use rune-safe slicing to preserve multi-byte characters
+			r := []rune(val)
+			if len(r) > 2 {
+				middle := string(r[1 : len(r)-1])
+				middle = strings.ReplaceAll(middle, "%", "\\%")
+				middle = strings.ReplaceAll(middle, "_", "\\_")
+				val = string(r[0]) + middle + string(r[len(r)-1])
 			}
 			if strings.HasPrefix(val, "%") ||
 				strings.HasPrefix(val, "_") ||
```

**File**: `pkg/utils/dsn.go` (modified, +104/-1)
```diff
@@ -8,7 +8,110 @@ import (
 
 // AdaptiveMysqlDsn adaptation of various mysql format dsn address
 func AdaptiveMysqlDsn(dsn string) string {
-	return strings.ReplaceAll(dsn, "mysql://", "")
+	// remove optional scheme prefix
+	dsn = strings.ReplaceAll(dsn, "mysql://", "")
+
+	// ensure a valid network/address section for go-sql-driver/mysql
+	// Expected forms:
+	//   user:pass@tcp(127.0.0.1:3306)/db
+	//   user:pass@unix(/path/mysql.sock)/db
+	// If it's like '@(127.0.0.1:3306)' → add 'tcp'
+	// If it's like '@127.0.0.1:3306' → wrap to '@tcp(127.0.0.1:3306)'
+	at := strings.Index(dsn, "@")
+	if at != -1 {
+		afterAt := dsn[at+1:]
+		slashIdx := strings.Index(afterAt, "/")
+		if slashIdx != -1 {
+			addrPart := afterAt[:slashIdx]
+			// If empty addrPart, nothing to fix
+			if addrPart != "" {
+				if strings.HasPrefix(addrPart, "(") {
+					// missing protocol
+					dsn = strings.Replace(dsn, "@(", "@tcp(", 1)
+				} else if !(strings.HasPrefix(addrPart, "tcp(") || strings.HasPrefix(addrPart, "unix(")) {
+					// no parentheses and no protocol → wrap with tcp()
+					dsn = strings.Replace(dsn, "@"+addrPart, "@tcp("+addrPart+")", 1)
+				}
+			}
+		}
+	}
+
+	// ensure the connection prefers utf8mb4 to avoid collation mismatch
+	// issues with MySQL 8 (e.g. mixing utf8mb3_general_ci and utf8mb4_0900_ai_ci).
+	qIdx := strings.Index(dsn, "?")
+	if qIdx == -1 {
+		// no query string → add charset parameter
+		return dsn + "?charset=utf8mb4"
+	}
+
+	prefix := dsn[:qIdx]
+	queryStr := dsn[qIdx+1:]
+	parts := strings.Split(queryStr, "&")
+
+	hasCharset := false
+	hasCollation := false
+	for i, p := range parts {
+		if strings.HasPrefix(p, "charset=") {
+			hasCharset = true
+			val := strings.TrimPrefix(p, "charset=")
+			// split by comma and de-duplicate while ensuring utf8mb4 comes first if present/added
+			charsets := []string{}
+			for _, cs := range strings.Split(val, ",") {
+				cs = strings.TrimSpace(cs)
+				if cs == "" {
+					continue
+				}
+				// skip duplicates
+				dup := false
+				for _, existing := range charsets {
+					if strings.EqualFold(existing, cs) {
+						dup = true
+						break
+					}
+				}
+				if !dup {
+					charsets = append(charsets, cs)
+				}
+			}
+
+			// ensure utf8mb4 is present and at the first position
+			containsUtf8mb4 := false
+			for _, cs := range charsets {
+				if strings.EqualFold(cs, "utf8mb4") {
+					containsUtf8mb4 = true
+					break
+				}
+			}
+			if !containsUtf8mb4 {
+				charsets = append([]string{"utf8mb4"}, charsets...)
+			} else if len(charsets) > 0 && !strings.EqualFold(charsets[0], "utf8mb4") {
+				// move utf8mb4 to front
+				newOrder := []string{"utf8mb4"}
+				for _, cs := range charsets {
+					if !strings.EqualFold(cs, "utf8mb4") {
+						newOrder = append(newOrder, cs)
+					}
+				}
+				charsets = newOrder
+			}
+
+			parts[i] = "charset=" + strings.Join(charsets, ",")
+			break
+		}
+		if strings.HasPrefix(p, "collation=") {
+			hasCollation = true
+		}
+	}
+
+	if !hasCharset {
+		parts = append(parts, "charset=utf8mb4")
+	}
+	if !hasCollation {
+		// default to a broadly compatible utf8mb4 collation
+		parts = append(parts, "collation=utf8mb4_general_ci")
+	}
+
+	return prefix + "?" + strings.Join(parts, "&")
 }
 
 // AdaptivePostgresqlDsn convert postgres dsn to kv string
```

---

### Incident Patch 14: `6707e646` (2025-08-24)
**Commit Message**: fix: update slice bug

**File**: `internal/dao/userExample.go.mgo` (modified, +4/-4)
```diff
@@ -61,10 +61,10 @@ func (d *userExampleDao) Create(ctx context.Context, record *model.UserExample)
 	if record.ID.IsZero() {
 		record.ID = primitive.NewObjectID()
 	}
-	if record.CreatedAt.IsZero() {
-		record.CreatedAt = time.Now()
-		record.UpdatedAt = time.Now()
-	}
+	now := time.Now()
+	record.CreatedAt = &now
+	record.UpdatedAt = &now
+
 	_, err := d.collection.InsertOne(ctx, record)
 
 	_ = d.deleteCache(ctx, record.ID.Hex())
```

**File**: `internal/dao/userExample.go.mgo.exp` (modified, +4/-4)
```diff
@@ -66,10 +66,10 @@ func (d *userExampleDao) Create(ctx context.Context, record *model.UserExample)
 	if record.ID.IsZero() {
 		record.ID = primitive.NewObjectID()
 	}
-	if record.CreatedAt.IsZero() {
-		record.CreatedAt = time.Now()
-		record.UpdatedAt = time.Now()
-	}
+	now := time.Now()
+	record.CreatedAt = &now
+	record.UpdatedAt = &now
+
 	_, err := d.collection.InsertOne(ctx, record)
 
 	_ = d.deleteCache(ctx, record.ID.Hex())
```

**File**: `pkg/mgo/model.go` (modified, +5/-7)
```diff
@@ -10,22 +10,20 @@ import (
 // Model embedded structs, add `bson: ",inline"` when defining table structs
 type Model struct {
 	ID        primitive.ObjectID `bson:"_id" json:"id"`
-	CreatedAt time.Time          `bson:"created_at" json:"createdAt"`
-	UpdatedAt time.Time          `bson:"updated_at" json:"updatedAt"`
+	CreatedAt *time.Time         `bson:"created_at" json:"createdAt"`
+	UpdatedAt *time.Time         `bson:"updated_at" json:"updatedAt"`
 	DeletedAt *time.Time         `bson:"deleted_at,omitempty" json:"deletedAt,omitempty"`
 }
 
 // SetModelValue set model fields
 func (p *Model) SetModelValue() {
-	now := time.Now()
 	if !p.ID.IsZero() {
 		p.ID = primitive.NewObjectID()
 	}
 
-	if p.CreatedAt.IsZero() {
-		p.CreatedAt = now
-		p.UpdatedAt = now
-	}
+	now := time.Now()
+	p.CreatedAt = &now
+	p.UpdatedAt = &now
 }
 
 // ExcludeDeleted exclude soft deleted records
```

**File**: `pkg/sql2code/parser/parser.go` (modified, +11/-16)
```diff
@@ -212,7 +212,7 @@ func (t tmplField) ConditionZero() string {
 		return ` != ""`
 	case "time.Time", "*time.Time", "sql.NullTime": //nolint
 		return ` != nil && table.` + t.Name + `.IsZero() == false`
-	case "[]byte", "[]string", "[]int", "interface{}": //nolint
+	case "interface{}": //nolint
 		return ` != nil` //nolint
 	case "bool": //nolint
 		return ` != false`
@@ -222,12 +222,13 @@ func (t tmplField) ConditionZero() string {
 		if t.GoType == goTypeOID {
 			return ` != primitive.NilObjectID`
 		}
-		if t.GoType == "*"+t.Name {
-			return ` != nil` //nolint
-		}
-		if strings.Contains(t.GoType, "[]") {
-			return ` != nil` //nolint
-		}
+	}
+
+	if t.GoType == "*"+t.Name {
+		return ` != nil` //nolint
+	}
+	if strings.Contains(t.GoType, "[]") {
+		return ` != nil && len(table.` + t.Name + `) > 0` //nolint
 	}
 
 	if t.GoType == "" {
@@ -686,9 +687,6 @@ func getModelStructCode(data tmplData, importPaths []string, isEmbed bool, jsonN
 				}
 				if field.rewriterField != nil {
 					switch field.rewriterField.goType {
-					//case jsonTypeName, decimalTypeName:
-					//	field.GoType = field.rewriterField.goType
-					//	importPaths = append(importPaths, field.rewriterField.path)
 					case jsonTypeName, decimalTypeName, boolTypeName, boolTypeTinyName:
 						field.GoType = "*" + field.rewriterField.goType
 						importPaths = append(importPaths, field.rewriterField.path)
@@ -716,6 +714,9 @@ func getModelStructCode(data tmplData, importPaths []string, isEmbed bool, jsonN
 		newImportPaths = append(newImportPaths, "github.com/go-dev-frame/sponge/pkg/sgorm")
 	} else {
 		for _, field := range data.Fields {
+			if strings.Contains(field.GoType, "time.Time") {
+				field.GoType = "*time.Time"
+			}
 			switch field.DBDriver {
 			case DBDriverMongodb:
 				if field.Name == "ID" {
@@ -724,9 +725,6 @@ func getModelStructCode(data tmplData, importPaths []string, isEmbed bool, jsonN
 				}
 
 			default:
-				if strings.Contains(field.GoType, "time.Time") {
-					field.GoType = "*time.Time"
-				}
 				// force conversion of ID field to uint64 type
 				if field.Name == "ID" {
 					field.GoType = "uint64"
@@ -737,9 +735,6 @@ func getModelStructCode(data tmplData, importPaths []string, isEmbed bool, jsonN
 				if field.DBDriver == DBDriverMysql || field.DBDriver == DBDriverPostgresql || field.DBDriver == DBDriverTidb {
 					if field.rewriterField != nil {
 						switch field.rewriterField.goType {
-						//case jsonTypeName, decimalTypeName:
-						//	field.GoType = field.rewriterField.goType
-						//	importPaths = append(importPaths, field.rewriterField.path)
 						case jsonTypeName, decimalTypeName, boolTypeName, boolTypeTinyName:
 							field.GoType = "*" + field.rewriterField.goType
 							importPaths = append(importPaths, field.rewriterField.path)
```

---

### Incident Patch 15: `74c2b066` (2025-08-18)
**Commit Message**: Fix CI error

**File**: `pkg/rails/cookie.go` (modified, +4/-4)
```diff
@@ -88,8 +88,8 @@ func DecodeSignedCookie(secretKeyBase string, decodedCookie string, cookieName s
 			Message string `json:"message"`
 		} `json:"_rails"`
 	}
-	if err := json.Unmarshal(plaintext, &envelope); err != nil {
-		return nil, fmt.Errorf("failed to unmarshal envelope: %w", err)
+	if unmarshalEnvelopeErr := json.Unmarshal(plaintext, &envelope); unmarshalEnvelopeErr != nil {
+		return nil, fmt.Errorf("failed to unmarshal envelope: %w", unmarshalEnvelopeErr)
 	}
 	if envelope.Rails.Pur == "" || envelope.Rails.Message == "" {
 		return nil, errors.New("invalid envelope data")
@@ -104,8 +104,8 @@ func DecodeSignedCookie(secretKeyBase string, decodedCookie string, cookieName s
 		return nil, fmt.Errorf("failed to base64 decode message: %w", err)
 	}
 	var session map[string]any
-	if err := json.Unmarshal(msgBytes, &session); err != nil {
-		return nil, fmt.Errorf("failed to unmarshal session: %w", err)
+	if unmarshalSessionErr := json.Unmarshal(msgBytes, &session); unmarshalSessionErr != nil {
+		return nil, fmt.Errorf("failed to unmarshal session: %w", unmarshalSessionErr)
 	}
 	return session, nil
 }
```

#### Recent Merged Pull Requests:
- **PR #137** (closed): Add TLS domain auto-reg similar to basecamp thruster (@Eric-Guo)
- **PR #132** (closed): User provided wildcards 后缀"%管理员"，前缀"客户%"模糊查询无效 (@Eric-Guo)
- **PR #131** (closed): Apply new function wg.Go in Go 1.25 (@Eric-Guo)
- **PR #130** (2025-09-04): ✨Fix api/v1/users/condition end point can not handle filter with Chinese (@Eric-Guo)
- **PR #128** (2025-08-18): Rails cookie auth (@Eric-Guo)
- **PR #126** (2025-08-09): Enhance condition handling for SQL drivers by adding nil checks for time.Time (@Eric-Guo)
- **PR #125** (2025-08-08): Document update (@Eric-Guo)
- **PR #122** (closed): newb (@soluty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
