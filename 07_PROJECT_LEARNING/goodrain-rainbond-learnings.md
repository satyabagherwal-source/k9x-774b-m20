# Forensic Learning Record (Deep Inspection): goodrain/rainbond

> **Canonical Artifact**: `07_PROJECT_LEARNING/goodrain-rainbond-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goodrain/rainbond](https://github.com/goodrain/rainbond))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:13:36.433Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goodrain/rainbond`
- **Description**: Rainbond is an open-source container platform that requires no Kubernetes expertise. Its core capabilities are 100% open source.  It abstracts away infrastructure complexity and provides a unified way to deploy and manage business applications, AI-generated projects, open-source AI software, and large language model services. AI helps teams deploy 
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 6271 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/eventlog/util/buffer.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package util

import (
	"bytes"
	"io"
	"sync"
)

type Buffer struct {
	b *bytes.Buffer
	m sync.Mutex
}

func NewBuffer(source []byte) *Buffer {
	return &Buffer{
		b: bytes.NewBuffer(source),
		m: sync.Mutex{},
	}
}
func (b *Buffer) Read(p []byte) (n int, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.Read(p)
}
func (b *Buffer) Write(p []byte) (n int, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.Write(p)
}
func (b *Buffer) String() string {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.String()
}
func (b *Buffer) Bytes() []byte {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.Bytes()
}
func (b *Buffer) Cap() int {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.Cap()
}
func (b *Buffer) Grow(n int) {
	b.m.Lock()
	defer b.m.Unlock()
	b.b.Grow(n)
}
func (b *Buffer) Len() int {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.Len()
}
func (b *Buffer) Next(n int) []byte {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.Next(n)
}
func (b *Buffer) ReadByte() (c byte, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.ReadByte()
}
func (b *Buffer) ReadBytes(delim byte) (line []byte, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.ReadBytes(delim)
}
func (b *Buffer) ReadFrom(r io.Reader) (n int64, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.ReadFrom(r)
}
func (b *Buffer) ReadRune() (r rune, size int, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.ReadRune()
}
func (b *Buffer) ReadString(delim byte) (line string, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.ReadString(delim)
}
func (b *Buffer) Reset() {
	b.m.Lock()
	defer b.m.Unlock()
	b.b.Reset()
}
func (b *Buffer) Truncate(n int) {
	b.m.Lock()
	defer b.m.Unlock()
	b.b.Truncate(n)
}
func (b *Buffer) UnreadByte() error {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.UnreadByte()
}
func (b *Buffer) UnreadRune() error {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.UnreadRune()
}
func (b *Buffer) WriteByte(c byte) error {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.WriteByte(c)
}
func (b *Buffer) WriteRune(r rune) (n int, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.WriteRune(r)
}
func (b *Buffer) WriteString(s string) (n int, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.WriteString(s)
}
func (b *Buffer) WriteTo(w io.Writer) (n int64, err error) {
	b.m.Lock()
	defer b.m.Unlock()
	return b.b.WriteTo(w)
}

```

### Core Architecture Module: `api/eventlog/util/common.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package util

import (
	"errors"
	"fmt"
	"net"
	"runtime"
	"strings"

	"os"

	"io/ioutil"

	"regexp"

	"github.com/sirupsen/logrus"
	"github.com/tidwall/gjson"
)

func Source(l *logrus.Entry) *logrus.Entry {
	_, file, line, ok := runtime.Caller(2)
	if !ok {
		file = "<???>"
		line = 1
	} else {
		slash := strings.LastIndex(file, "/")
		file = file[slash+1:]
	}
	return l.WithField("source", fmt.Sprintf("%s:%d", file, line))
}

//ExternalIP 获取本机ip
func ExternalIP() (net.IP, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 {
			continue // interface down
		}
		if iface.Flags&net.FlagLoopback != 0 {
			continue // loopback interface
		}
		addrs, err := iface.Addrs()
		if err != nil {
			return nil, err
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip = ip.To4()
			if ip == nil {
				continue // not an ipv4 address
			}
			return ip, nil
		}
	}
	return nil, errors.New("are you connected to the network?")
}

//GetHostID 获取机器ID
func GetHostID(nodeIDFile string) (string, error) {
	_, err := os.Stat(nodeIDFile)
	if err != nil {
		return "", err
	}
	body, err := ioutil.ReadFile(nodeIDFile)
	if err != nil {
		return "", err
	}
	info := strings.Split(strings.TrimSpace(string(body)), "=")
	if len(info) == 2 {
		return info[1], nil
	}
	return "", fmt.Errorf("Invalid host uuid from file")
}

var rex *regexp.Regexp

//Format 格式化处理监控数据
func Format(source map[string]gjson.Result) map[string]interface{} {
	defer func() {
		if r := recover(); r != nil {
			logrus.Warnf("error deal with source msg %v", source)
		}
	}()
	if rex == nil {
		var err error
		rex, err = regexp.Compile(`\d+\.\d{3,}`)
		if err != nil {
			logrus.Error("create regexp error.", err.Error())
			return nil
		}
	}

	var data = make(map[string]interface{})

	for k, v := range source {
		if rex.MatchString(v.String()) {
			d := strings.Split(v.String(), ".")
			data[k] = fmt.Sprintf("%s.%s", d[0], d[1][0:2])
		} else {
			data[k] = v.String()
		}
	}
	return data
}

```

### Core Architecture Module: `api/eventlog/util/conn.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package util

import (
	"errors"
	"io"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/net/context"

	"github.com/sirupsen/logrus"
)

// Error type
var (
	ErrConnClosing   = errors.New("use of closed network connection")
	ErrWriteBlocking = errors.New("write packet was blocking")
	ErrReadBlocking  = errors.New("read packet was blocking")
)

// Conn exposes a set of callbacks for the various events that occur on a connection
type Conn struct {
	srv               *Server
	conn              *net.TCPConn  // the raw connection
	extraData         interface{}   // to save extra data
	closeOnce         sync.Once     // close the conn, once, per instance
	closeFlag         int32         // close flag
	closeChan         chan struct{} // close chanel
	packetSendChan    chan Packet   // packet send chanel
	packetReceiveChan chan Packet   // packeet receive chanel
	buffer            *Buffer
	ctx               context.Context
	pro               Protocol
	timer             *time.Timer
}

// ConnCallback is an interface of methods that are used as callbacks on a connection
type ConnCallback interface {
	// OnConnect is called when the connection was accepted,
	// If the return value of false is closed
	OnConnect(*Conn) bool

	// OnMessage is called when the connection receives a packet,
	// If the return value of false is closed
	OnMessage(Packet) bool

	// OnClose is called when the connection closed
	OnClose(*Conn)
}

// newConn returns a wrapper of raw conn
func newConn(conn *net.TCPConn, srv *Server, ctx context.Context) *Conn {
	p := &MessageProtocol{}
	p.SetConn(conn)
	conn.SetLinger(3)
	conn.SetReadBuffer(1024 * 1024 * 24)
	return &Conn{
		ctx:               ctx,
		srv:               srv,
		conn:              conn,
		closeChan:         make(chan struct{}),
		packetSendChan:    make(chan Packet, srv.config.PacketSendChanLimit),
		packetReceiveChan: make(chan Packet, srv.config.PacketReceiveChanLimit),
		pro:               p,
	}
}

// GetExtraData gets the extra data from the Conn
func (c *Conn) GetExtraData() interface{} {
	return c.extraData
}

// PutExtraData puts the extra data with the Conn
func (c *Conn) PutExtraData(data interface{}) {
	c.extraData = data
}

// GetRawConn returns the raw net.TCPConn from the Conn
func (c *Conn) GetRawConn() *net.TCPConn {
	return c.conn
}

// Close closes the connection
func (c *Conn) Close() {
	c.closeOnce.Do(func() {
		atomic.StoreInt32(&c.closeFlag, 1)
		close(c.closeChan)
		close(c.packetSendChan)
		close(c.packetReceiveChan)
		c.conn.Close()
		c.srv.callback.OnClose(c)
	})
}

// IsClosed indicates whether or not the connection is closed
func (c *Conn) IsClosed() bool {
	return atomic.LoadInt32(&c.closeFlag) == 1
}

// AsyncWritePacket async writes a packet, this method will never block
func (c *Conn) AsyncWritePacket(p Packet, timeout time.Duration) (err error) {
	if c.IsClosed() {
		return ErrConnClosing
	}

	defer func() {
		if e := recover(); e != nil {
			err = ErrConnClosing
		}
	}()

	if timeout == 0 {
		select {
		case c.packetSendChan <- p:
			return nil

		default:
			return ErrWriteBlocking
		}

	} else {
		select {
		case c.packetSendChan <- p:
			return nil

		case <-c.closeChan:
			return ErrConnClosing

		case <-time.After(timeout):
			return ErrWriteBlocking
		}
	}
}

// Do it
func (c *Conn) Do() {
	if !c.srv.callback.OnConnect(c) {
		return
	}
	asyncDo(c.readLoop, c.srv.waitGroup)
}

var timeOut = time.Second * 15

func (c *Conn) readLoop() {
	defer func() {
		if err := recover(); err != nil {
			logrus.Error(err)
		}
		c.Close()
	}()
	//15秒未接受到消息或ping,则关闭连接
	c.timer = time.NewTimer(timeOut)
	defer c.timer.Stop()
	asyncDo(c.readPing, c.srv.waitGroup)
	for {
		select {
		case <-c.srv.exitChan:
			return
		case <-c.ctx.Done():
			return
		case <-c.closeChan:
			return
		default:
		}
		p, err := c.pro.ReadPacket()
		if err == io.EOF {
			return
		}
		if err == io.ErrUnexpectedEOF {
			return
		}
		if err == errClosed {
			return
		}
		if err == io.ErrNoProgress {
			return
		}
		if err != nil {
			if strings.HasSuffix(err.Error(), "use of closed network connection") {
				logrus.Error("use of closed network connection")
				return
			}
			logrus.Error("read package error:", err.Error())
			return
		}
		if p.IsNull() {
			return
		}
		if p.IsPing() {
			if ok := c.timer.Reset(timeOut); !ok {
				c.timer = time.NewTimer(timeOut)
			}
			continue
		}
		if ok := c.srv.callback.OnMessage(p); !ok {
			continue
		}
		if ok := c.timer.Reset(timeOut); !ok {
			c.timer = time.NewTimer(timeOut)
		}
	}
}

func (c *Conn) readPing() {
	for {
		select {
		case <-c.srv.exitChan:
			return
		case <-c.ctx.Done():
			return
		case <-c.closeChan:
			return
		case <-c.timer.C:
			logrus.Debug("can not receive message more than 15s.close the con")
			c.conn.Close()
			return

		}
	}
}

func asyncDo(fn func(), wg *sync.WaitGroup) {
	//wg.Add(1)
	go func() {
		fn()
		//wg.Done()
	}()
}

```

### Core Architecture Module: `api/eventlog/util/file.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package util

import "os"

//AppendToFile 文件名字(带全路径)
// content: 写入的内容
func AppendToFile(fileName string, content string) error {
	f, err := os.OpenFile(fileName, os.O_WRONLY|os.O_APPEND|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	_, err = f.WriteString(content)
	defer f.Close()
	return err
}

```

### Core Architecture Module: `api/eventlog/util/filepath.go`
```
package util

import (
	"crypto/sha256"
	"fmt"
	"path"
	"strconv"
)

// DockerLogFilePath returns the directory to save Docker log files
func DockerLogFilePath(homepath, key string) string {
	return path.Join(homepath, getServiceAliasID(key))
}

// DockerLogFileName returns the file name of Docker log file.
func DockerLogFileName(filePath string) string {
	return path.Join(filePath, "stdout.log")
}

//python:
//new_word = str(ord(string[10])) + string + str(ord(string[3])) + 'log' + str(ord(string[2]) / 7)
//new_id = hashlib.sha224(new_word).hexdigest()[0:16]
//
func getServiceAliasID(ServiceID string) string {
	if len(ServiceID) > 11 {
		newWord := strconv.Itoa(int(ServiceID[10])) + ServiceID + strconv.Itoa(int(ServiceID[3])) + "log" + strconv.Itoa(int(ServiceID[2])/7)
		ha := sha256.New224()
		ha.Write([]byte(newWord))
		return fmt.Sprintf("%x", ha.Sum(nil))[0:16]
	}
	return ServiceID
}

// EventLogFilePath returns the directory to save event log files
func EventLogFilePath(homePath string) string {
	return path.Join(homePath, "eventlog")
}

// EventLogFileName returns the file name of event log file.
func EventLogFileName(filePath, key string) string {
	return path.Join(filePath, key+".log")
}

```

### Core Architecture Module: `api/eventlog/util/protocol.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package util

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"time"
)

type Packet interface {
	Serialize() []byte
	IsNull() bool
	IsPing() bool
}

type MessagePacket struct {
	data   string
	isPing bool
}

var errClosed = errors.New("conn is closed")

func (m *MessagePacket) Serialize() []byte {
	return []byte(m.data)
}

func (m *MessagePacket) IsNull() bool {
	return len(m.data) == 0 && !m.isPing
}

func (m *MessagePacket) IsPing() bool {
	return m.isPing
}

type Protocol interface {
	SetConn(conn *net.TCPConn)
	ReadPacket() (Packet, error)
}

type MessageProtocol struct {
	conn      *net.TCPConn
	reader    *bufio.Reader
	cache     *bytes.Buffer
	cacheSize int64
}

func (m *MessageProtocol) SetConn(conn *net.TCPConn) {
	m.conn = conn
	m.reader = bufio.NewReader(conn)
	m.cache = bytes.NewBuffer(nil)
}

//ReadPacket 获取消息流
func (m *MessageProtocol) ReadPacket() (Packet, error) {
	if m.reader != nil {
		message, err := m.Decode()
		if err != nil {
			return nil, err
		}
		if m.isPing(message) {
			return &MessagePacket{isPing: true}, nil
		}
		return &MessagePacket{data: message}, nil
	}
	return nil, errClosed
}
func (m *MessageProtocol) isPing(s string) bool {
	return s == "0x00ping"
}

const maxConsecutiveEmptyReads = 100

//Decode 解码数据流
func (m *MessageProtocol) Decode() (string, error) {
	// 读取消息的长度
	lengthByte, err := m.reader.Peek(4)
	if err != nil {
		return "", err
	}
	lengthBuff := bytes.NewBuffer(lengthByte)
	var length int32
	err = binary.Read(lengthBuff, binary.LittleEndian, &length)
	if err != nil {
		return "", err
	}
	if length == 0 {
		return "", errClosed
	}
	if int32(m.reader.Buffered()) < length+4 {
		var retry = 0
		for m.cacheSize < int64(length+4) {
			//read size must <= length+4
			readSize := int64(length+4) - m.cacheSize
			if readSize > int64(m.reader.Buffered()) {
				readSize = int64(m.reader.Buffered())
			}
			buffer := make([]byte, readSize)
			size, err := m.reader.Read(buffer)
			if err != nil {
				return "", err
			}
			//Two consecutive reads 0 bytes, return io.ErrNoProgress
			//Read() will read up to len(p) into p, when possible.
			//After a Read() call, n may be less then len(p).
			//Upon error, Read() may still return n bytes in buffer p. For instance, reading from a TCP socket that is abruptly closed. Depending on your use, you may choose to keep the bytes in p or retry.
			//When a Read() exhausts available data, a reader may return a non-zero n and err=io.EOF. However, depending on implementation, a reader may choose to return a non-zero n and err = nil at the end of stream. In that case, any subsequent reads must return n=0, err=io.EOF.
			//Lastly, a call to Read() that returns n=0 and err=nil does not mean EOF as the next call to Read() may return more data.
			if size <= 0 {
				retry++
				if retry > maxConsecutiveEmptyReads {
					return "", io.ErrNoProgress
				}
				time.Sleep(time.Millisecond * 10)
			} else {
				m.cacheSize += int64(size)
				m.cache.Write(buffer)
			}
		}
		result := m.cache.Bytes()[4:]
		m.cache.Reset()
		m.cacheSize = 0
		return string(result), nil
	}

	// 读取消息真正的内容
	pack := make([]byte, int(4+length))
	size, err := m.reader.Read(pack)
	if err != nil {
		return "", err
	}
	if size == 0 {
		return "", io.ErrNoProgress
	}
	return string(pack[4:]), nil
}

```

### Core Architecture Module: `api/eventlog/util/streamserver.go`
```
// Copyright (C) 2014-2018 Goodrain Co., Ltd.
// RAINBOND, Application Management Platform

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version. For any non-GPL usage of Rainbond,
// one or multiple Commercial Licenses authorized by Goodrain Co., Ltd.
// must be obtained first.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package util

import (
	"net"
	"sync"
	"time"

	"golang.org/x/net/context"
)

type Config struct {
	PacketSendChanLimit    uint32 // the limit of packet send channel
	PacketReceiveChanLimit uint32 // the limit of packet receive channel
}

type Server struct {
	config    *Config         // server configuration
	callback  ConnCallback    // message callbacks in connection
	exitChan  chan struct{}   // notify all goroutines to shutdown
	waitGroup *sync.WaitGroup // wait for all goroutines
	ctx       context.Context
}

// NewServer creates a server
func NewServer(config *Config, callback ConnCallback, ctx context.Context) *Server {
	return &Server{
		config:    config,
		callback:  callback,
		exitChan:  make(chan struct{}),
		waitGroup: &sync.WaitGroup{},
		ctx:       ctx,
	}
}

// Start starts service
func (s *Server) Start(listener *net.TCPListener, acceptTimeout time.Duration) {
	s.waitGroup.Add(1)
	defer func() {
		listener.Close()
		s.waitGroup.Done()
	}()

	for {
		select {
		case <-s.exitChan:
			return
		default:
		}
		listener.SetDeadline(time.Now().Add(acceptTimeout))
		conn, err := listener.AcceptTCP()
		if err != nil {
			continue
		}
		s.waitGroup.Add(1)
		go func() {
			newConn(conn, s, s.ctx).Do()
			s.waitGroup.Done()
		}()
	}
}

// Stop stops service
func (s *Server) Stop() {
	close(s.exitChan)
	s.waitGroup.Wait()
}

```

### Core Architecture Module: `api/util/bcode/api_gateway.go`
```
package bcode

import "net/http"

// 定义错误码
const (
	// RouteNotFound 表示路由未找到错误码
	RouteNotFound = iota + 50001

	//RouteExists 标识路由已存在
	RouteExists
	// RouteUpdateError 表示路由更新错误码
	RouteUpdateError

	// RouteCreateError 表示路由创建错误码
	RouteCreateError

	// RouteCreateErrorPortExists 表示路由创建错误码
	RouteCreateErrorPortExists

	// RouteDeleteError 表示路由删除错误码
	RouteDeleteError

	// ServiceNotFound 表示服务未找到错误码
	ServiceNotFound

	// ServiceUpdateError 表示服务更新错误码
	ServiceUpdateError

	// ServiceCreateError 表示服务创建错误码
	ServiceCreateError

	// ServiceDeleteError 表示服务删除错误码
	ServiceDeleteError

	// CertNotFound 表示证书未找到错误码
	CertNotFound

	// K8sSecretCreateError 表示创建 Kubernetes 密钥错误码
	K8sSecretCreateError

	// K8sGetSecretError 表示获取 Kubernetes 密钥错误码
	K8sGetSecretError

	// K8sDeleteSecretError 表示删除 Kubernetes 密钥错误码
	K8sDeleteSecretError

	// APISixCreateCertError 表示创建 APISix 证书错误码
	APISixCreateCertError

	// APISixDeleteCertError 表示删除 APISix 证书错误码
	APISixDeleteCertError

	// APISixCertNotFound 表示 APISix 证书未找到错误码
	APISixCertNotFound

	// APISixCertUpdateError 表示更新 APISix 证书错误码
	APISixCertUpdateError

	// APISixCertDomainConflict 表示证书域名冲突错误码
	APISixCertDomainConflict
)

var (
	// ErrRouteNotFound 表示路由未找到错误
	ErrRouteNotFound = newByMessage(http.StatusNotFound, RouteNotFound, "route not found")

	// ErrRouteExist 标识路由已存在
	ErrRouteExist = newByMessage(http.StatusBadRequest, RouteExists, "route already exists")

	// ErrRouteUpdate 表示路由更新错误
	ErrRouteUpdate = newByMessage(http.StatusBadRequest, RouteUpdateError, "route update error, please check parameters")

	ErrPortExists = newByMessage(http.StatusBadRequest, RouteCreateErrorPortExists, "port is already in use, please use a different port")

	// ErrRouteCreate 表示路由创建错误
	ErrRouteCreate = newByMessage(http.StatusBadRequest, RouteCreateError, "route creation error, please check parameters")

	// ErrRouteDelete 表示路由删除错误
	ErrRouteDelete = newByMessage(http.StatusBadRequest, RouteDeleteError, "route delete error")

	// ErrServiceUpdate 表示服务更新错误
	ErrServiceUpdate = newByMessage(http.StatusBadRequest, ServiceUpdateError, "service update error")

	// ErrServiceCreate 表示服务创建错误
	ErrServiceCreate = newByMessage(http.StatusBadRequest, ServiceCreateError, "service create error")

	// ErrServiceDelete 表示服务删除错误
	ErrServiceDelete = newByMessage(http.StatusBadRequest, ServiceDeleteError, "service delete error")

	// ErrCertNotFound 表示证书未找到错误
	ErrCertNotFound = newByMessage(http.StatusNotFound, CertNotFound, "cert not found")

	// ErrorK8sSecretCreate 表示创建 Kubernetes 密钥错误
	ErrorK8sSecretCreate = newByMessage(http.StatusBadRequest, K8sSecretCreateError, "k8s secret create error")

	// ErrorK8sGetSecret 表示获取 Kubernetes 密钥错误
	ErrorK8sGetSecret = newByMessage(http.StatusBadRequest, K8sGetSecretError, "k8s get secret error")

	// ErrorK8sDeleteSecret 表示删除 Kubernetes 密钥错误
	ErrorK8sDeleteSecret = newByMessage(http.StatusBadRequest, K8sDeleteSecretError, "k8s delete secret error")

	// ErrorAPISixCreateCert 表示创建 APISix 证书错误
	ErrorAPISixCreateCert = newByMessage(http.StatusBadRequest, APISixCreateCertError, "apisix create cert error")

	// ErrorAPISixDeleteCert 表示删除 APISix 证书错误
	ErrorAPISixDeleteCert = newByMessage(http.StatusBadRequest, APISixDeleteCertError, "apisix delete cert error")

	// ErrorAPISixCertNotFound 表示 APISix 证书未找到错误
	ErrorAPISixCertNotFound = newByMessage(http.StatusNotFound, APISixCertNotFound, "apisix cert not found")

	// ErrorAPISixCertUpdateError 表示更新 APISix 证书错误
	ErrorAPISixCertUpdateError = newByMessage(http.StatusBadRequest, APISixCertUpdateError, "apisix cert update error")

	// ErrorAPISixCertDomainConflict 表示证书域名冲突错误
	ErrorAPISixCertDomainConflict = newByMessage(http.StatusBadRequest, APISixCertDomainConflict, "certificate domain already exists in another namespace")
)

```

### Core Architecture Module: `api/util/bcode/application.go`
```
package bcode

// tenant application 11000~11099
var (
	//ErrApplicationNotFound -
	ErrApplicationNotFound = newByMessage(404, 11001, "application not found")
	//ErrApplicationExist -
	ErrApplicationExist = newByMessage(400, 11002, "application already exist")
	//ErrCreateNeedCorrectAppID -
	ErrCreateNeedCorrectAppID = newByMessage(404, 11003, "create service need correct application ID")
	//ErrUpdateNeedCorrectAppID -
	ErrUpdateNeedCorrectAppID = newByMessage(404, 11004, "update service need correct application ID")
	//ErrDeleteDueToBindService -
	ErrDeleteDueToBindService = newByMessage(400, 11005, "the application cannot be deleted because there are bound services")
	// ErrK8sServiceNameExists -
	ErrK8sServiceNameExists = newByMessage(400, 11006, "kubernetes service name already exists")
	// ErrInvalidHelmAppValues -
	ErrInvalidHelmAppValues = newByMessage(400, 11007, "invalid helm app values")
	// ErrInvalidGovernanceMode -
	ErrInvalidGovernanceMode = newByMessage(400, 11008, "invalid governance mode")
	// ErrControlPlaneNotInstall -
	ErrControlPlaneNotInstall = newByMessage(400, 11009, "control plane not install")
	// ErrInvaildK8sApp -
	ErrInvaildK8sApp = newByMessage(400, 11010, "invalid k8s app name")
	// ErrK8sAppExists -
	ErrK8sAppExists = newByMessage(400, 11011, "k8s app name exists")
)

// app config group 11100~11199
var (
	//ErrApplicationConfigGroupExist -
	ErrApplicationConfigGroupExist = newByMessage(400, 11101, "application config group already exist")
	//ErrConfigGroupServiceExist -
	ErrConfigGroupServiceExist = newByMessage(400, 11102, "config group under this service already exists")
	//ErrConfigItemExist -
	ErrConfigItemExist = newByMessage(400, 11103, "config item under this config group already exist")
	//ErrServiceNotFound -
	ErrServiceNotFound = newByMessage(404, 11104, "this service ID cannot be found under this application")
)

```

### Core Architecture Module: `api/util/bcode/bcode.go`
```
package bcode

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/jinzhu/gorm"
	"github.com/pkg/errors"
)

var (
	// OK means everything si good.
	OK = new(200, 200)
	// StatusFound means the requested resource resides temporarily under a different URI.
	StatusFound = new(302, 302)
	// BadRequest means the request could not be understood by the server due to malformed syntax.
	// The client SHOULD NOT repeat the request without modifications.
	BadRequest = new(400, 400)
	// NotFound means the server has not found anything matching the request.
	NotFound = new(404, 404)
	// ServerErr means  the server encountered an unexpected condition which prevented it from fulfilling the request.
	ServerErr = new(500, 500)

	// TokenInvalid -
	TokenInvalid = new(400, 401)
)

// Coder has ability to get Code, msg or detail from error.
type Coder interface {
	// Status Code
	GetStatus() int
	// business Code
	GetCode() int
	Error() string
	Equal(err error) bool
}

var (
	codes = make(map[int]struct{})
)

func new(status, code int) Coder {
	if _, ok := codes[code]; ok {
		panic(fmt.Sprintf("bcode %d already exists", code))
	}
	codes[code] = struct{}{}
	return newCode(status, code, "")
}

func newByMessage(status, code int, message string) Coder {
	if _, ok := codes[code]; ok {
		panic(fmt.Sprintf("bcode %d already exists", code))
	}
	codes[code] = struct{}{}
	return newCode(status, code, message)
}

// Code business a bussiness Code
type Code struct {
	Status  int    `json:"status"`
	Code    int    `json:"code"`
	Message string `json:"msg"`
}

func newCode(status, code int, message string) Coder {
	return &Code{Status: status, Code: code, Message: message}
}

// GetStatus returns the Status Code
func (c *Code) GetStatus() int {
	return c.Status
}

// GetCode returns the business Code
func (c *Code) GetCode() int {
	return c.Code
}

func (c *Code) Error() string {
	if c.Message != "" {
		return c.Message
	}
	return strconv.FormatInt(int64(c.Code), 10)
}

// Equal -
func (c *Code) Equal(err error) bool {
	obj := Err2Coder(err)
	return c.Code == obj.GetCode()
}

// Err2Coder converts the given err to Coder.
func Err2Coder(err error) Coder {
	if err == nil {
		return OK
	}
	coder, ok := errors.Cause(err).(Coder)
	if ok {
		return coder
	}
	if err == gorm.ErrRecordNotFound {
		return NotFound
	}
	return Str2Coder(err.Error())
}

// Str2Coder converts the given str to Coder.
func Str2Coder(str string) Coder {
	str = strings.TrimSpace(str)
	if str == "" {
		return OK
	}
	i, err := strconv.Atoi(str)
	if err != nil {
		return ServerErr
	}
	return newCode(400, i, "")
}

// NewBadRequest -
func NewBadRequest(msg string) Coder {
	return newCode(400, 400, msg)
}

```

### Core Architecture Module: `api/util/bcode/ingress.go`
```
package bcode

// ingress: 11200~11299
var (
	ErrIngressHTTPRuleNotFound = newByMessage(404, 11200, "http rule not found")
	ErrIngressTCPRuleNotFound  = newByMessage(404, 11201, "tcp rule not found")
)

```

### Core Architecture Module: `api/util/bcode/service.go`
```
package bcode

// service: 10000~10099
var (
	//ErrPortNotFound -
	ErrPortNotFound = newByMessage(404, 10001, "service port not found")
	//ErrServiceMonitorNotFound -
	ErrServiceMonitorNotFound = newByMessage(404, 10101, "service monitor not found")
	//ErrServiceMonitorNameExist -
	ErrServiceMonitorNameExist = newByMessage(400, 10102, "service monitor name is exist")
	// ErrSyncOperation -
	ErrSyncOperation = newByMessage(409, 10103, "The asynchronous operation is executing")
	// ErrHorizontalDueToNoChange
	ErrHorizontalDueToNoChange = newByMessage(400, 10104, "The number of components has not changed, no need to scale")
	ErrPodNotFound             = newByMessage(404, 10105, "pod not found")
	ErrK8sComponentNameExists  = newByMessage(400, 10106, "k8s component name exists")
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2685** (2026-08-28): **🐞 反馈问题：rbd-init-probe镜像是否有地方可以配置自定义镜像仓库**
  *Symptoms*: ### 请先确认以下事项：  - [x] 请务必查看[常见问题](https://www.rainbond.com/docs/faq)和[故障排除](https://www.rainbond.com/docs/troubleshooting) - [x] 在 [issues](https://github.com/goodrain/rainbond/issues) 页面搜索过问题（包括已关闭的 issue），但未能找到解决方法 - [x] Rainbond 已升级到 [最新版本](https://github.com/goodrain/rainbond/releases)  ### 问题描述  我于离线环境（k3s）使用helm方式安装rainbond，在对应value内定义了私有镜像仓库地址，使用helm install之后正常安装，服务正常启动。但是在执行ram应用包导入之后发现部分服务会去拉取registry.cn-hangzhou.aliyuncs.com/goodrain/rbd-init-probe:v6.9.7-release镜像，此镜像地址是否有办法修改为自定义镜像仓库地址  ### 该问题是否可以稳定重现？  可重现  ### 重现步骤  1、离线环境（k3s）使用helm方式安装rainbond，在对应value内定义了私有镜像仓库地址，使用helm install安装。2、执行ram应用包导入  ### 截图  无  ### 日志  无  ### 期望结果  可自定义修改pre镜像的地址  ### 解决方案（可选）  _No response_  ### 操作系统 && Rainbond 版本  ubuntu22.04，k8s1.26.7 rainbond 6.9.7  ### 是否愿意提交 PR 解决该问题？  - [ ] 我愿意提交 PR 来解决该问题
  **Post-Mortem & Fix Analysis**:
  > @qaqwx  ```bash kubectl edit rbdcomponent -n rbd-system rbd-worker  spec:   env:   - name: PROBE_MESH_IMAGE_NAME     value: xxx/rbd-init-probe:v6.9.8-release ```

- **Issue #2665** (2026-08-17): **Cross-enterprise tenant IDOR in the region API server: any valid region API token can read (and, by the same code path, modify) any other enterprise's tenant resources on a shared multi-tenant Rainbond region**
  *Symptoms*: ### 请先确认以下事项：  - [x] 请务必查看[常见问题](https://www.rainbond.com/docs/faq)和[故障排除](https://www.rainbond.com/docs/troubleshooting) - [x] 在 [issues](https://github.com/goodrain/rainbond/issues) 页面搜索过问题（包括已关闭的 issue），但未能找到解决方法 - [x] Rainbond 已升级到 [最新版本](https://github.com/goodrain/rainbond/releases)  ### 问题描述  version: v3.6.1 (HEAD 6998ca3d726b06bc6c5c5dd69cf4be2f9e413d42)  ## Summary  Rainbond's region API server (the Kubernetes-cluster-facing HTTP API built from `cmd/api`) is explicitly designed to be shared by multiple enterprises (tracked as `EID` in the schema) on a single region, each owning one or more "tenants" (internal workspaces, identified by a human-chosen `tenant_name`). Every issued API token is likewise recorded with the owning enterprise's `EID`. However, the token-validation function (`CheckToken`) only checks validity period and a broad "API class" (`ALLPOWER` / `SERVERSOURCE` / `NODEMANAGER`); it never reads or compares the token's `EID`. Separately, the tenant-resolution middleware (`InitTenant`) resolves whatever `tenant_name` appears in the URL path via a completely global, unscoped database lookup, with no cross-check against the calling token's owning enterprise at all.  The net effect: any valid region API token, regardless of which enterprise it was issued to, can be used against any other enterprise's `tenant_name` in the URL path, and the request will be treated as authorized for that tenant. On a region shared by multiple enterprises (the exact scenario thi
  **Post-Mortem & Fix Analysis**:
  > @geo-chen  Rainbond v3.6.1 ? Is your enterprise using Rainbond version 3.6.1?
  > hey @zzzhangqi im an independent researcher, so i do not have an enterprise using this. the version i checked is v3.6.1
  > @geo-chen Hi,  v3.6.1 is no longer maintained. Please use it according to the code of the main branch.

- **Issue #2655** (2026-07-27): **🐞 反馈问题：启用插件和自定义affinity后引起的不可调度问题**
  *Symptoms*: ### 请先确认以下事项：  - [x] 请务必查看[常见问题](https://www.rainbond.com/docs/faq)和[故障排除](https://www.rainbond.com/docs/troubleshooting) - [x] 在 [issues](https://github.com/goodrain/rainbond/issues) 页面搜索过问题（包括已关闭的 issue），但未能找到解决方法 - [x] Rainbond 已升级到 [最新版本](https://github.com/goodrain/rainbond/releases)  ### 问题描述  如题，我看了有两个符合亲和性可调度节点，其中一个内存充足，另外一个内存不是很足。  ### 该问题是否可以稳定重现？  可重现  ### 重现步骤  给集群节点添加标签：node-tag.kubernetes.io/gray = C  然后组件（多实例，可能单实例也有这个问题）启用插件（插件自己有内存和cpu配额限制），并且在组件的添加以下配置：  ```       - key: node-tag.kubernetes.io/gray         operator: In         values:         - C ```  完整配置如下： ``` nodeAffinity:   requiredDuringSchedulingIgnoredDuringExecution:     nodeSelectorTerms:     - matchExpressions:       - key: kubernetes.io/arch         operator: In         values:         - amd64       - key: node-tag.kubernetes.io/gray         operator: In         values:         - C ```  ### 截图  #### 运行 <img width="1582" height="462" alt="Image" src="https://github.com/user-attachments/assets/c05fe10c-0fe3-41fc-ae14-f9164fd1483e" />  #### 插件 <img width="1592" height="290" alt="Image" src="https://github.com/user-attachments/assets/1115f832-4c8a-4bca-bde5-70a1f48003e8" />  #### 组件配置 <img width="501" height="524" alt="Image" src="https://github.com/user-attachments/assets/a19a1fff-3881-4851-a770-332f849b2427" />  #### 节点配置 <img width="495" height="475" alt="Image" src="https://github.com/user-attachments/assets/cc5f2196-8b90-43e1-82df-8aafb36d56a9" />  ### 日志  Warning | FailedScheduling | <unknown> 
  **Post-Mortem & Fix Analysis**:
  >   > Bot detected the issue body's language is not English, translate it automatically. 👯👭🏻🧑‍🤝‍🧑👫🧑🏿‍🤝‍🧑🏻👩🏾‍🤝‍👨🏿👬🏿       ----   **Title:** 🐞 Feedback: Unschedulable issues caused by enabling plug-ins and custom affinity           
  > 未复现
  >   > Bot detected the issue body's language is not English, translate it automatically. 👯👭🏻🧑‍🤝‍🧑👫🧑🏿‍🤝‍🧑🏻👩🏾‍🤝‍👨🏿👬🏿          ----     Not reappeared         

- **Issue #2621** (2026-06-18): **[Sentry] UI throws TypeError when response_data is not a string**
  *Symptoms*: ## Summary Sentry captured a frontend exception where UI code calls `.split()` on `e.response_data`, but `response_data` is not always a string.  ## Sentry evidence - Covered group: `RAINBOND-UI-N` - Error: `TypeError: Unhandled promise rejection: e.response_data.split is not a function` - Culprit bundle: `p__Group__Overview...async.js` - First/last seen: `2026-06-15T06:55:40Z` - Times seen: `1`  ## Impact When the backend returns structured error data instead of a string, the group overview page can throw while handling the error.  ## Suggested next steps - Locate the Group Overview error handling path that calls `response_data.split`. - Normalize `response_data` before string operations. - Add a regression case for object-shaped backend error payloads.  _Source: Sentry unresolved Rainbond group import on 2026-06-17._
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 11m 26s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27670036710)  --- ### Fix: Guard `response_data.split` against non-string values  **Status:** ✅ Completed  #### Root Cause  `request.js` sets `response_data = response.data` (the raw HTTP body). When the backend returns structured JSON error data, `response_data` is an **object**, not a string. The code unconditionally calls `.split('\n')` on it, which throws `TypeError`.  #### Changes Made  **Repo:** [goodrain/rainbond-ui](https://github.com/goodrain/rainbond-ui/pull/1832)  | File | Line | Fix | |------|------|-----| | `src/pages/Component/log.js` | 338 | Normalize `response_data` before `.split('\n')`: handle string, object (extract `.data`), and missing values | | `src/pages/AddCluster/Install/index.js` | 172 | Same defensive pattern for `result.response_data.command.split(' & ')` |  #### Verification  - `yarn build` passes ✅ - Both fixes handle string, object, and m
  > Fixed in https://github.com/goodrain/rainbond-ui/pull/1832  **Root cause:** `request.js` sets `response_data = response.data` (the raw HTTP body). When the backend returns structured JSON error data, `response_data` is an object, not a string. The code at `Component/log.js:338` unconditionally called `.split('\n')` on it, which throws `TypeError`.  **Changes:** - `src/pages/Component/log.js` — Normalize `response_data` before string operations: handle string, object (extract `.data`), and missing values. - `src/pages/AddCluster/Install/index.js` — Same defensive pattern for `response_data.command.split()`.  **Verification:** `yarn build` passes on rainbond-ui.

- **Issue #2620** (2026-06-18): **UI records broad API 500/502/network failures from backend outages**
  *Symptoms*: ## Summary Sentry captured many `rainbond-ui` API failures across pages. Most appear to be secondary symptoms of console/region errors, but the UI currently records each failed endpoint as a separate issue and often reports generic `Network Error`.  ## Covered Sentry groups API/network groups currently covered here: `RAINBOND-UI-25`, `RAINBOND-UI-24`, `RAINBOND-UI-23`, `RAINBOND-UI-22`, `RAINBOND-UI-20`, `RAINBOND-UI-21`, `RAINBOND-UI-1Y`, `RAINBOND-UI-1X`, `RAINBOND-UI-1Z`, `RAINBOND-UI-1V`, `RAINBOND-UI-1W`, `RAINBOND-UI-1T`, `RAINBOND-UI-1S`, `RAINBOND-UI-1R`, `RAINBOND-UI-1Q`, `RAINBOND-UI-1P`, `RAINBOND-UI-1K`, `RAINBOND-UI-1N`, `RAINBOND-UI-1M`, `RAINBOND-UI-1J`, `RAINBOND-UI-1H`, `RAINBOND-UI-1G`, `RAINBOND-UI-1F`, `RAINBOND-UI-1E`, `RAINBOND-UI-1D`, `RAINBOND-UI-1C`, `RAINBOND-UI-1B`, `RAINBOND-UI-1A`, `RAINBOND-UI-19`, `RAINBOND-UI-18`, `RAINBOND-UI-17`, `RAINBOND-UI-16`, `RAINBOND-UI-15`, `RAINBOND-UI-14`, `RAINBOND-UI-13`, `RAINBOND-UI-12`, `RAINBOND-UI-11`, `RAINBOND-UI-10`, `RAINBOND-UI-Y`, `RAINBOND-UI-X`, `RAINBOND-UI-Z`, `RAINBOND-UI-W`, `RAINBOND-UI-V`, `RAINBOND-UI-S`, `RAINBOND-UI-R`, `RAINBOND-UI-Q`, `RAINBOND-UI-P`, `RAINBOND-UI-M`, `RAINBOND-UI-G`, `RAINBOND-UI-J`, `RAINBOND-UI-H`, `RAINBOND-UI-F`, `RAINBOND-UI-K`, `RAINBOND-UI-E`, `RAINBOND-UI-D`, `RAINBOND-UI-8`, `RAINBOND-UI-9`.  Filtered out as manual smoke/test noise: `RAINBOND-UI-1`, `RAINBOND-UI-2`, `RAINBOND-UI-3`, `RAINBOND-UI-4`, `RAINBOND-UI-5`, `RAINBOND-UI-6`, `RAINBOND-UI-7`, `RAINBOND-UI-A
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 5m 53s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27733753609) • [Create PR ➔](https://github.com/goodrain/rainbond-ui/compare/main...claude/issue-2620-sentry-api-error-grouping?quick_pull=1&title=fix%3A+improve+Sentry+API+error+grouping+and+add+backend+context+tags&body=Ref+goodrain%2Frainbond%232620%0A%0A-+Group+API+errors+by+error+class+and+business+code+instead+of+endpoint%0A-+Add+backend_error_class%2C+request_id%2C+business_code+Sentry+tags%0A-+Suppress+expected+transient+errors+%28502%2F503%2F504%29%0A-+Extract+x-request-id+for+backend+log+correlation%0A%0AGenerated+with+%5BClaude+Code%5D%28https%3A%2F%2Fclaude.ai%2Fcode%29)  --- ### Analysis  The issue is that `rainbond-ui` creates separate Sentry issues for each API endpoint when a backend outage occurs. For example, a region service going down causes 500/502 errors on every endpoint, creating dozens of Sentry issues instead of one grouped issue.  ### Root Caus

- **Issue #2619** (2026-06-18): **OpenAPI team/app endpoints fail on missing team initialization state**
  *Symptoms*: ## Summary Sentry captured OpenAPI errors when team or app state is missing or not initialized in the requested region.  ## Covered Sentry groups - `RAINBOND-CONSOLE-W`: `AttributeError: 'NoneType' object has no attribute 'tenant_id'`, route `/openapi/v1/teams/{team_id}/regions/{region_name}/apps/{app_id}/services` - `RAINBOND-CONSOLE-V`: team is not initialized in region, route `/openapi/v1/teams/{team_id}/regions/{region_name}/apps` - Related UI symptom: `RAINBOND-UI-9`, API 500 `GET /console/enterprise/:id/regions`  ## Impact OpenAPI callers receive server errors instead of clear team/region initialization errors.  ## Initial analysis Handlers need to explicitly handle missing team-region initialization and missing app objects before dereferencing tenant fields.  ## Suggested next steps - Return structured `404`/`409` style errors for uninitialized team-region state. - Add nil checks before accessing `tenant_id`. - Add OpenAPI tests for uninitialized team and missing app paths.  _Source: Sentry unresolved Rainbond group import on 2026-06-17._
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 6m 48s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27735466609) • [Create PR ➔](https://github.com/goodrain/rainbond-console/compare/main...claude/issue-2619-20260618-0350?quick_pull=1&title=fix%3A+add+nil+checks+for+team+initialization+in+OpenAPI+endpoints&body=%23%23+Summary%0AThis+PR+fixes+OpenAPI+team%2Fapp+endpoints+that+fail+when+team+or+app+state+is+missing+or+not+initialized+in+the+requested+region.%0A%0A%23%23+Changes%0A-+**openapi%2Fservices%2Fapp_service.py**%3A+Added+nil+check+for+team+in+%60get_app_services_and_status%28%29%60+to+prevent+%60AttributeError%60%0A-+**openapi%2Fviews%2Fbase.py**%3A+Added+team-region+initialization+validation+in+%60TeamAPIView.initial%28%29%60+to+return+409+error%0A-+**openapi%2Fviews%2Fexceptions.py**%3A+Added+%60ErrTeamNotInitializedInRegion%60+exception%0A%0ARef%3A+goodrain%2Frainbond%232619%0A%0AGenerated+with+%5BClaude+Code%5D%28https%3A%2F%2Fclaude.ai%2Fcode%29)  --- ### An
  > /claude 审阅本次提价的代码

- **Issue #2617** (2026-06-18): **plugin proxy and SSE paths leak transport/serialization failures**
  *Symptoms*: ## Summary Sentry captured transport and serialization failures in plugin proxy and SSE endpoints.  ## Covered Sentry groups - `RAINBOND-CONSOLE-F`: `TypeError: Object of type 'ConnectionResetError' is not JSON serializable` - `RAINBOND-CONSOLE-E`: `ProtocolError: Connection reset by peer` - `RAINBOND-CONSOLE-G`: plugin exists check failed with connection reset - `RAINBOND-CONSOLE-15`: SSE request timed out through region API - `RAINBOND-CONSOLE-Q`: `UnicodeDecodeError` while reading SSE stream - `RAINBOND-CONSOLE-8`: `IncompleteRead` on SSE stream  ## Impact Plugin pages and stream endpoints can turn transient backend transport failures into unhandled console exceptions.  ## Initial analysis The plugin proxy should serialize transport errors into strings/structured codes, not raw exception objects. SSE code needs defensive handling for partial reads and non-UTF8 chunks.  ## Suggested next steps - Convert transport exceptions to safe JSON error payloads. - Add SSE decoding with replacement/error handling and partial-read retry/close semantics. - Add tests for plugin proxy connection reset and SSE partial/non-UTF8 streams.  _Source: Sentry unresolved Rainbond group import on 2026-06-17._
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 23m 19s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27743193402) • [`claude/issue-2617-20260618-0715`](https://github.com/goodrain/rainbond/tree/claude/issue-2617-20260618-0715) • [Create PR ➔](https://github.com/goodrain/rainbond/compare/main...claude/issue-2617-20260618-0715?quick_pull=1&title=fix%3A%20handle%20transport%20errors%20in%20plugin%20proxy%20and%20SSE%20log%20streaming&body=Fixed%20transport%20and%20serialization%20failures%20in%20plugin%20proxy%20and%20SSE%20endpoints.%0A%0ARef%20%232617%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode))  --- ### Task: Fix plugin proxy and SSE paths leaking transport/serialization failures  **Current status:** ✅ Completed  #### Summary Fixed transport and serialization failures in plugin proxy and SSE endpoints that were causing Sentry errors.  #### Changes Made  **1. Plugin Proxy Error Handling** (`api/api_routers/version2/v2Routers.go`) - Added 
  > /claude 审阅本次提价的代码

- **Issue #2612** (2026-06-22): **component lifecycle operations fail on field/default mismatches**
  *Symptoms*: ## Summary Sentry captured console errors caused by model/field/default mismatches during component delete, batch delete, scaling, and repeated operation flows.  ## Covered Sentry groups - `RAINBOND-CONSOLE-18`: `TenantServiceInfoDelete() got unexpected keyword arguments: 'build_strategy'`, route `/console/teams/{tenantName}/batch_delete` - `RAINBOND-CONSOLE-9`: `TenantServiceInfoDelete() got an unexpected keyword argument 'build_strategy'`, route `/console/teams/{tenantName}/groups/{app_id}/handle` - `RAINBOND-CONSOLE-N`: `IntegrityError: Column 'inner_port' cannot be null`, route `/console/teams/{tenantName}/apps/{serviceAlias}/delete` - `RAINBOND-CONSOLE-S`: `IntegrityError: NOT NULL constraint failed: tenant_service_delete.inner_port`, route `/console/teams/{tenantName}/apps/{serviceAlias}/delete` - `RAINBOND-CONSOLE-5`: `IntegrityError: Column 'container_gpu' cannot be null`, route `/console/mcp/query` - `RAINBOND-CONSOLE-T`: `OperationalError: database is locked`, route `/console/teams/{tenantName}/apps/{serviceAlias}/delete` - `RAINBOND-CONSOLE-17`: frequent-operation `409` on vertical scaling - `RAINBOND-CONSOLE-P`: frequent-operation `409` on build trigger from MCP query  ## Impact Users and automation can fail to delete, scale, or trigger operations cleanly. Some failures may leave lifecycle operations partially applied.  ## Initial analysis The delete/archive model appears to be built from broader service objects without filtering fields accepted by `TenantServiceI
  **Post-Mortem & Fix Analysis**:
  > /claude fix issues
  > **Claude finished @RainBondsongyg's task in 23m 18s** —— [View job](https://github.com/goodrain/rainbond/actions/runs/27743250210)  --- ### Task List  - [x] Step 0: Determine context — Issue #2612, IMPLEMENT mode - [x] Step 1: Read full issue and triggering comment - [x] Step 2: Investigate code — all bugs are in `rainbond-console` (Python/Django) - [x] Step 3a: Fix `build_strategy` passed to `TenantServiceInfoDelete` (RAINBOND-CONSOLE-18, -9) - [x] Step 3b: Fix `inner_port` null IntegrityError (RAINBOND-CONSOLE-N, -S) - [x] Step 3c: Fix `database is locked` error handling (RAINBOND-CONSOLE-T) - [x] Step 4: Run quality gates and open PR - [x] Step 5: Comment on issue with summary  ---  ### Summary  All bugs were in `rainbond-console` (Python/Django). Three fixes applied:  | Sentry Group | Root Cause | Fix | |---|---|---| | RAINBOND-CONSOLE-18, -9 | `service.toJSON()` includes `build_strategy` but `TenantServiceInfoDelete` doesn't accept it → `TypeError` | Added `data.pop("build_strateg

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

### Incident Patch 1: `448e057c` (2026-09-29)
**Commit Message**: fix: prevent index file download redirects (#2706)

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `api/controller/file_download.go` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package controller
+
+import (
+	"net/http"
+	"os"
+)
+
+func serveDownloadedFile(w http.ResponseWriter, r *http.Request, fileName string) error {
+	file, err := os.Open(fileName)
+	if err != nil {
+		return err
+	}
+	defer file.Close()
+	info, err := file.Stat()
+	if err != nil {
+		return err
+	}
+
+	w.Header().Set("status", "success")
+	w.Header().Set("Content-Disposition", "attachment;filename="+info.Name())
+	// ServeFile redirects /index.html to ./, which does not match the download route.
+	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
+	return nil
+}
```

**File**: `api/controller/file_download_test.go` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+package controller
+
+import (
+	"net/http"
+	"net/http/httptest"
+	"net/url"
+	"os"
+	"path/filepath"
+	"strconv"
+	"testing"
+)
+
+func TestServeDownloadedFile(t *testing.T) {
+	tests := []struct {
+		name         string
+		fileName     string
+		content      string
+		rangeHeader  string
+		wantStatus   int
+		wantBody     string
+		contentRange string
+	}{
+		{
+			name: "index HTML does not redirect", fileName: "index.html",
+			content: "<html>download</html>", wantStatus: http.StatusOK, wantBody: "<html>download</html>",
+		},
+		{
+			name: "ordinary file", fileName: "example.txt",
+			content: "download", wantStatus: http.StatusOK, wantBody: "download",
+		},
+		{
+			name: "empty index HTML", fileName: "index.html",
+			wantStatus: http.StatusOK,
+		},
+		{
+			name: "index HTML byte range", fileName: "index.html",
+			content: "download", rangeHeader: "bytes=0-3",
+			wantStatus: http.StatusPartialContent, wantBody: "down", contentRange: "bytes 0-3/8",
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			fileName := filepath.Join(t.TempDir(), tt.fileName)
+			if err := os.WriteFile(fileName, []byte(tt.content), 0600); err != nil {
+				t.Fatal(err)
+			}
+			req := httptest.NewRequest(http.MethodGet, "/v2/file-operate/download/"+url.PathEscape(tt.fileName)+
+				"?path=/usr/share/nginx/html/e%2Fxz&fileName="+url.QueryEscape(tt.fileName), nil)
+			if tt.rangeHeader != "" {
+				req.Header.Set("Range", tt.rangeHeader)
+			}
+			w := httptest.NewRecorder()
+			w.Header().Set("Content-Type", "application/octet-stream")
+			w.Header().Set("status", "failed")
+			if err := serveDownloadedFile(w, req, fileName); err != nil {
+				t.Fatalf("serve downloaded file: %v", err)
+			}
+			if w.Code != tt.wantStatus {
+				t.Fatalf("status = %d, want %d; Location = %q", w.Code, tt.wantStatus, w.Header().Get("Location"))
+			}
+			if location := w.Header().Get("Location"); location != "" {
+				t.Errorf("unexpected redirect to %q", location)
+			}
+			if got := w.Body.String(); got != tt.wantBody {
+				t.Errorf("body = %q, want %q", got, tt.wantBody)
+			}
+			for name, want := range map[string]string{
+				"Content-Type":        "application/octet-stream",
+				"Content-Disposition": "attachment;filename=" + tt.fileName,
+				"Content-Length":      strconv.Itoa(len(tt.wantBody)),
+				"Content-Range":       tt.contentRange,
+				"status":              "success",
+			} {
+				if got := w.Header().Get(name); got != want {
+					t.Errorf("%s = %q, want %q", name, got, want)
+				}
+			}
+		})
+	}
+}
+
+func TestServeDownloadedFileMissingFile(t *testing.T) {
+	req := httptest.NewRequest(http.MethodGet, "/v2/file-operate/download/index.html", nil)
+	w := httptest.NewRecorder()
+	w.Header().Set("status", "failed")
+	err := serveDownloadedFile(w, req, filepath.Join(t.TempDir(), "index.html"))
+	if !os.IsNotExist(err) {
+		t.Fatalf("error = %v, want file-not-found error", err)
+	}
+	if w.Header().Get("status") != "failed" || w.Header().Get("Content-Disposition") != "" || w.Body.Len() != 0 {
+		t.Fatal("missing file must leave the response uncommitted for the caller's error handler")
+	}
+}
```

**File**: `api/controller/service_monitor.go` (modified, +8/-5)
```diff
@@ -170,6 +170,7 @@ func (f FileManage) UploadEvent(w http.ResponseWriter, r *http.Request) {
 	httputil.ReturnSuccess(r, w, nil)
 }
 
+// UploadFile uploads files to a container in the selected pod.
 func (f FileManage) UploadFile(w http.ResponseWriter, r *http.Request) {
 	// 设置 CORS 头
 	origin := r.Header.Get("Origin")
@@ -357,6 +358,7 @@ func resolveUploadRelativePath(fileHeader *multipart.FileHeader) (string, bool,
 	return cleaned, strings.Contains(cleaned, "/"), nil
 }
 
+// DownloadFile serves a file downloaded from a container in the selected pod.
 func (f FileManage) DownloadFile(w http.ResponseWriter, r *http.Request) {
 	logrus.Debugf("接收到文件下载请求: Method=%s, ContentType=%s", r.Method, r.Header.Get("Content-Type"))
 
@@ -400,14 +402,14 @@ func (f FileManage) DownloadFile(w http.ResponseWriter, r *http.Request) {
 		}
 	}()
 
-	// 设置成功状态和文件下载头
-	w.Header().Set("status", "success")
-	w.Header().Set("Content-Disposition", "attachment;filename="+fileName)
-
 	logrus.Debugf("开始传输文件: %s", fileName)
-	http.ServeFile(w, r, fileName)
+	if err := serveDownloadedFile(w, r, fileName); err != nil {
+		logrus.Errorf("读取下载文件失败: %v", err)
+		httputil.ReturnError(r, w, 500, fmt.Sprintf("下载文件失败: %v", err))
+	}
 }
 
+// AppFileDownload copies a file or directory from a container to local storage.
 func (f FileManage) AppFileDownload(containerName, podName, filePath, namespace string) error {
 	// Check if the file exists first
 	checkCmd := []string{"test", "-e", filePath}
@@ -568,6 +570,7 @@ func (f FileManage) downloadUsingTar(containerName, podName, filePath, namespace
 	return nil
 }
 
+// AppFileUpload copies a local file or directory into a container.
 func (f FileManage) AppFileUpload(containerName, podName, srcPath, destPath, namespace string) error {
 	logrus.Debugf("开始上传目录/文件: 源路径=%s, 目标路径=%s", srcPath, destPath)
 
```

---

### Incident Patch 2: `0384d977` (2026-09-20)
**Commit Message**: fix: tolerate dedicated node taints in source builds (#2704)

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `builder/build/code_build.go` (modified, +41/-41)
```diff
@@ -22,7 +22,6 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
-	"github.com/goodrain/rainbond/db"
 	"io"
 	"io/ioutil"
 	"os"
@@ -31,6 +30,8 @@ import (
 	"strings"
 	"time"
 
+	"github.com/goodrain/rainbond/db"
+
 	"github.com/eapache/channels"
 	"github.com/goodrain/rainbond/builder"
 	jobc "github.com/goodrain/rainbond/builder/job"
@@ -317,6 +318,44 @@ func (s *slugBuild) createVolumeAndMount(re *Request, sourceTarFileName string,
 	return volumes, volumeMounts
 }
 
+func newSlugBuildPodSpec(arch, hostIP, cacheMode string) corev1.PodSpec {
+	podSpec := corev1.PodSpec{
+		RestartPolicy: corev1.RestartPolicyOnFailure,
+		Affinity: &corev1.Affinity{
+			NodeAffinity: &corev1.NodeAffinity{
+				RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
+					NodeSelectorTerms: []corev1.NodeSelectorTerm{{
+						MatchExpressions: []corev1.NodeSelectorRequirement{
+							{
+								Key:      "kubernetes.io/arch",
+								Operator: corev1.NodeSelectorOpIn,
+								Values:   []string{arch},
+							},
+							{
+								Key:      "kubernetes.io/hostname",
+								Operator: corev1.NodeSelectorOpIn,
+								Values:   []string{hostIP},
+							},
+						},
+					},
+					},
+				},
+			},
+		},
+	}
+	if hostIP != "" {
+		// All cache modes use the current chaos node, including dedicated or cordoned nodes.
+		podSpec.Tolerations = []corev1.Toleration{{Operator: corev1.TolerationOpExists}}
+		if cacheMode == "hostpath" {
+			logrus.Debugf("builder cache mode using hostpath, schedule job into current node")
+			podSpec.NodeSelector = map[string]string{
+				"kubernetes.io/hostname": hostIP,
+			}
+		}
+	}
+	return podSpec
+}
+
 func (s *slugBuild) runBuildJob(re *Request) error {
 
 	//prepare build code dir
@@ -454,46 +493,7 @@ func (s *slugBuild) runBuildJob(re *Request) error {
 		}
 	}
 
-	podSpec := corev1.PodSpec{
-		RestartPolicy: corev1.RestartPolicyOnFailure,
-		Affinity: &corev1.Affinity{
-			NodeAffinity: &corev1.NodeAffinity{
-				RequiredDuringSchedulingIgnoredDuringExecution: &corev1.NodeSelector{
-					NodeSelectorTerms: []corev1.NodeSelectorTerm{{
-						MatchExpressions: []corev1.NodeSelectorRequirement{
-							{
-								Key:      "kubernetes.io/arch",
-								Operator: corev1.NodeSelectorOpIn,
-								Values:   []string{re.Arch},
-							},
-							{
-								Key:      "kubernetes.io/hostname",
-								Operator: corev1.NodeSelectorOpIn,
-								Values:   []string{os.Getenv("HOST_IP")},
-							},
-						},
-					},
-					},
-				},
-			},
-		},
-	}
-	// only support never and onfailure
-	// schedule builder
-	if re.CacheMode == "hostpath" {
-		logrus.Debugf("builder cache mode using hostpath, schedule job into current node")
-		hostIP := os.Getenv("HOST_IP")
-		if hostIP != "" {
-			podSpec.NodeSelector = map[string]string{
-				"kubernetes.io/hostname": hostIP,
-			}
-			podSpec.Tolerations = []corev1.Toleration{
-				{
-					Operator: "Exists",
-				},
-			}
-		}
-	}
+	podSpec := newSlugBuildPodSpec(re.Arch, os.Getenv("HOST_IP"), re.CacheMode)
 	logrus.Debugf("request is: %+v", re)
 
 	volumes, mounts := s.createVolumeAndMount(re, sourceTarFileName, buildNoCache)
```

**File**: `builder/build/code_build_scheduling_test.go` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+package build
+
+import (
+	"reflect"
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+)
+
+func TestNewSlugBuildPodSpecToleratesDedicatedNode(t *testing.T) {
+	for _, cacheMode := range []string{"", "sharefile", "hostpath"} {
+		for _, arch := range []string{"amd64", "arm64"} {
+			t.Run(cacheMode+"/"+arch, func(t *testing.T) {
+				spec := newSlugBuildPodSpec(arch, "chaos-node", cacheMode)
+				for _, taint := range []corev1.Taint{
+					{Key: corev1.TaintNodeUnschedulable, Effect: corev1.TaintEffectNoSchedule},
+					{Key: "dedicated", Value: "rbd-chaos", Effect: corev1.TaintEffectNoSchedule},
+					{Key: "dedicated", Value: "rbd-chaos", Effect: corev1.TaintEffectNoExecute},
+				} {
+					tolerated := false
+					for _, toleration := range spec.Tolerations {
+						if toleration.ToleratesTaint(&taint) {
+							tolerated = true
+							break
+						}
+					}
+					if !tolerated {
+						t.Errorf("build pod does not tolerate dedicated node taint %v", taint)
+					}
+				}
+
+				if spec.Affinity == nil || spec.Affinity.NodeAffinity == nil {
+					t.Fatal("build pod must remain restricted to the current chaos node and architecture")
+				}
+				want := &corev1.NodeSelector{
+					NodeSelectorTerms: []corev1.NodeSelectorTerm{{
+						MatchExpressions: []corev1.NodeSelectorRequirement{
+							{Key: "kubernetes.io/arch", Operator: corev1.NodeSelectorOpIn, Values: []string{arch}},
+							{Key: "kubernetes.io/hostname", Operator: corev1.NodeSelectorOpIn, Values: []string{"chaos-node"}},
+						},
+					}},
+				}
+				if got := spec.Affinity.NodeAffinity.RequiredDuringSchedulingIgnoredDuringExecution; !reflect.DeepEqual(got, want) {
+					t.Errorf("required node affinity = %#v, want %#v", got, want)
+				}
+				if cacheMode == "hostpath" && spec.NodeSelector["kubernetes.io/hostname"] != "chaos-node" {
+					t.Errorf("hostpath node selector = %v, want chaos-node", spec.NodeSelector)
+				}
+				if spec.RestartPolicy != corev1.RestartPolicyOnFailure {
+					t.Errorf("restart policy = %q, want OnFailure", spec.RestartPolicy)
+				}
+			})
+		}
+	}
+}
+
+func TestNewSlugBuildPodSpecWithoutHostDoesNotTolerateTaints(t *testing.T) {
+	for _, cacheMode := range []string{"", "sharefile", "hostpath"} {
+		t.Run(cacheMode, func(t *testing.T) {
+			spec := newSlugBuildPodSpec("amd64", "", cacheMode)
+			if len(spec.Tolerations) != 0 {
+				t.Errorf("expected no taint tolerations without a target host, got %v", spec.Tolerations)
+			}
+		})
+	}
+}
```

---

### Incident Patch 3: `738c839f` (2026-09-20)
**Commit Message**: fix: report Kubernetes errors when creating TCP routes (#2703)

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +5/-1)
```diff
@@ -707,7 +707,11 @@ func (g Struct) CreateTCPRoute(w http.ResponseWriter, r *http.Request) {
 				} else {
 					// 其他错误，返回失败
 					logrus.Errorf("create tcp rule func, create svc failure: %s", err.Error())
-					httputil.ReturnBcodeError(r, w, bcode.ErrServiceCreate)
+					httputil.ReturnBcodeError(r, w, &bcode.Code{
+						Status:  bcode.ErrServiceCreate.GetStatus(),
+						Code:    bcode.ErrServiceCreate.GetCode(),
+						Message: fmt.Sprintf("%s: %s", bcode.ErrServiceCreate.Error(), err.Error()),
+					})
 					return
 				}
 			}
```

**File**: `api/controller/apigateway/api_gateway_route_test.go` (modified, +78/-1)
```diff
@@ -12,6 +12,7 @@ import (
 
 	v2 "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/apis/config/v2"
 	"github.com/go-chi/chi"
+	"github.com/goodrain/rainbond/api/util/bcode"
 	ctxutil "github.com/goodrain/rainbond/api/util/ctx"
 	"github.com/goodrain/rainbond/db"
 	dbdao "github.com/goodrain/rainbond/db/dao"
@@ -25,6 +26,7 @@ import (
 	"k8s.io/apimachinery/pkg/runtime/schema"
 	"k8s.io/apimachinery/pkg/runtime/serializer"
 	"k8s.io/apimachinery/pkg/util/intstr"
+	"k8s.io/apimachinery/pkg/util/validation/field"
 	"k8s.io/client-go/kubernetes"
 	"k8s.io/client-go/rest"
 )
@@ -160,7 +162,7 @@ func (d *tcpRouteRuleDao) DeleteByRecordIDs(ids []uint) error {
 	return nil
 }
 
-func newTCPRouteTestClientset(t *testing.T, services map[string]*corev1.Service) (*kubernetes.Clientset, func()) {
+func newTCPRouteTestClientset(t *testing.T, services map[string]*corev1.Service, createErrors ...*errors.StatusError) (*kubernetes.Clientset, func()) {
 	t.Helper()
 	scheme := runtime.NewScheme()
 	if err := corev1.AddToScheme(scheme); err != nil {
@@ -204,6 +206,13 @@ func newTCPRouteTestClientset(t *testing.T, services map[string]*corev1.Service)
 			if err := json.NewDecoder(r.Body).Decode(&service); err != nil {
 				t.Fatalf("decode service: %v", err)
 			}
+			if len(createErrors) > 0 {
+				status := createErrors[0].ErrStatus
+				status.TypeMeta = v1.TypeMeta{Kind: "Status", APIVersion: "v1"}
+				w.WriteHeader(int(status.Code))
+				_ = json.NewEncoder(w).Encode(status)
+				return
+			}
 			for _, existing := range services {
 				for _, existingPort := range existing.Spec.Ports {
 					for _, requestedPort := range service.Spec.Ports {
@@ -637,6 +646,74 @@ func TestCreateTCPRouteRejectsExplicitPortOwnedByAnotherService(t *testing.T) {
 	}
 }
 
+// capability_id: rainbond.gateway.report-tcp-service-create-error-details
+func TestCreateTCPRouteReportsServiceCreateErrorDetails(t *testing.T) {
+	const (
+		tenantID    = "tenant-id"
+		serviceID   = "service-id"
+		serviceName = "op-tspnetty-server"
+	)
+	tests := []struct {
+		name       string
+		port       int32
+		validRange string
+	}{
+		{name: "below default range", port: 10007, validRange: "30000-32767"},
+		{name: "above default range", port: 32768, validRange: "30000-32767"},
+		{name: "custom cluster range", port: 30000, validRange: "10000-20000"},
+		{name: "other creation failure", port: 30000},
+	}
+	for _, tt := range tests {
+		for _, protocol := range []string{"tcp", "udp", "tcp+udp"} {
+			t.Run(tt.name+"/"+protocol, func(t *testing.T) {
+				createErr := errors.NewInternalError(fmt.Errorf("failed to allocate a service IP"))
+				if tt.validRange != "" {
+					createErr = errors.NewInvalid(schema.GroupKind{Kind: "Service"}, fmt.Sprintf("%s-%d", serviceName, tt.port), field.ErrorList{
+						field.Invalid(field.NewPath("spec", "ports").Index(0).Child("nodePort"), tt.port,
+							"provided port is not in the valid range. The range of valid ports is "+tt.validRange),
+					})
+				}
+				services := map[string]*corev1.Service{}
+				clientset, closeServer := newTCPRouteTestClientset(t, services, createErr)
+				t.Cleanup(closeServer)
+				k8s.New().Clientset = clientset
+				ruleDao := &tcpRouteRuleDao{}
+				db.SetTestManager(tcpRouteTestManager{
+					tenantServiceDao: &tcpRouteTenantServiceDao{servicesByID: map[string]*dbmodel.TenantServices{
+						serviceID: {ServiceID: serviceID, ServiceAlias: serviceName, TenantID: tenantID},
+					}},
+					tcpRuleDao: ruleDao,
+				})
+				t.Cleanup(func() { db.SetTestManager(nil) })
+
+				rr := createTCPRouteForTest(t, "default", tenantID, serviceID, serviceName, tt.port, protocol)
+				if rr.Code != http.StatusBadRequest {
+					t.Fatalf("expected status 400, got %d: %s", rr.Code, rr.Body.String())
+				}
+				var response struct {
+					Code int    `json:"code"`
+					Msg  string `json:"msg"`
+				}
+				if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
+					t.Fatalf("decode creation error response: %v", err)
+				}
+				if response.Code != bcode.ServiceCreateError {
+					t.Errorf("expected business code %d, got %d", bcode.ServiceCreateError, response.Code)
+				}
+				if !strings.Contains(response.Msg, createErr.Error()) {
+					t.Errorf("expected Kubernetes error details %q in response, got %q", createErr.Error(), response.Msg)
+				}
+				if len(services) != 0 || ruleDao.replaced != nil || ruleDao.added != nil {
+					t.Fatal("failed service creation must not persist a Service or TCP rule")
+				}
+				if bcode.ErrServiceCreate.Error() != "service create error" {
+					t.Fatal("request-specific details must not modify the shared business error")
+				}
+			})
+		}
+	}
+}
+
 // capability_id: rainbond.gateway.protect-tcp-route-service-ownership
 func TestCreateTCPRouteRejectsExistingServiceWithoutMatchingOwner(t *testing.T) {
 	const (
```

**File**: `test-manifest.json` (modified, +18/-0)
```diff
@@ -2951,6 +2951,24 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.gateway.report-tcp-service-create-error-details",
+      "title": "TCP route creation reports Kubernetes error details",
+      "title_zh": "TCP route creation reports Kubernetes error details",
+      "interface_type": "view_endpoint",
+      "interface": "POST /api-gateway/v1/{tenant_name}/routes/tcp",
+      "code_paths": [
+        "api/controller/apigateway/api_gateway_route.go"
+      ],
+      "tests": [
+        {
+          "path": "api/controller/apigateway/api_gateway_route_test.go",
+          "selector": "TestCreateTCPRouteReportsServiceCreateErrorDetails"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.gateway.validate-tcp-nodeport-route-name",
       "title": "Reject out-of-range TCP NodePorts parsed from route names",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -161,6 +161,7 @@
 | rainbond.gateway.reject-duplicate-tcp-nodeport | Reject duplicate TCP NodePort bindings | active | regression | TCP NodePort binding | db/mysql/dao/gateway_test.go::TestTCPRuleDaoAddModelRejectsPortOwnedByAnotherRule<br>api/controller/apigateway/api_gateway_route_test.go::TestCreateTCPRouteRejectsExplicitPortOwnedByAnotherService |
 | rainbond.gateway.release-absent-tcp-nodeport-owner | Release only the requested owner when a TCP route Service is absent | active | regression | api/controller/apigateway.Struct.DeleteTCPRoute | api/controller/apigateway/api_gateway_route_test.go::TestDeleteTCPRouteAlreadyAbsentReleasesOnlyRequestedOwner |
 | rainbond.gateway.release-captured-tcp-nodeport-rules | Release only TCP NodePort rules captured before Service deletion | active | regression | api/controller/apigateway.Struct.DeleteTCPRoute | api/controller/apigateway/api_gateway_route_test.go::TestDeleteTCPRouteReleasesOnlyCapturedRuleIDs |
+| rainbond.gateway.report-tcp-service-create-error-details | TCP route creation reports Kubernetes error details | active | regression | POST /api-gateway/v1/{tenant_name}/routes/tcp | api/controller/apigateway/api_gateway_route_test.go::TestCreateTCPRouteReportsServiceCreateErrorDetails |
 | rainbond.gateway.validate-tcp-nodeport-route-name | Reject out-of-range TCP NodePorts parsed from route names | active | regression | api/controller/apigateway.nodePortFromTCPRouteName | api/controller/apigateway/api_gateway_route_test.go::TestNodePortFromTCPRouteNameValidatesRange |
 | rainbond.helm-release.app-version-format | 为 Helm 历史输出格式化应用版本号 | active | regression | pkg/helm.formatAppVersion | pkg/helm/helm_release_test.go::TestGetReleaseHistory |
 | rainbond.helm-release.chart-name-format | 为历史和摘要输出格式化 Helm chart 名称 | active | regression | pkg/helm.formatChartName | pkg/helm/helm_release_test.go::TestGetReleaseHistory |
@@ -2069,6 +2070,16 @@
 - 代码路径: `api/controller/apigateway/api_gateway_route.go`
 - 测试路径: `api/controller/apigateway/api_gateway_route_test.go::TestDeleteTCPRouteReleasesOnlyCapturedRuleIDs`
 
+### TCP route creation reports Kubernetes error details
+
+- Capability ID: `rainbond.gateway.report-tcp-service-create-error-details`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `view_endpoint`
+- 业务入口: `POST /api-gateway/v1/{tenant_name}/routes/tcp`
+- 代码路径: `api/controller/apigateway/api_gateway_route.go`
+- 测试路径: `api/controller/apigateway/api_gateway_route_test.go::TestCreateTCPRouteReportsServiceCreateErrorDetails`
+
 ### Reject out-of-range TCP NodePorts parsed from route names
 
 - Capability ID: `rainbond.gateway.validate-tcp-nodeport-route-name`
```

---

### Incident Patch 4: `249ca2a7` (2026-09-17)
**Commit Message**: fix: preserve custom component configuration during upgrades (#2701)

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `api/controller/cluster.go` (modified, +4/-1)
```diff
@@ -43,6 +43,7 @@ import (
 	"github.com/jinzhu/gorm"
 	"github.com/sirupsen/logrus"
 	"k8s.io/apimachinery/pkg/types"
+	k8sclient "sigs.k8s.io/controller-runtime/pkg/client"
 
 	httputil "github.com/goodrain/rainbond/util/http"
 )
@@ -447,9 +448,11 @@ func (c *ClusterController) Upgrade(w http.ResponseWriter, r *http.Request) {
 			res = append(res, fmt.Sprintf(`%s获取异常%s`, k, err.Error()))
 			continue
 		}
+		original := cpt.DeepCopy()
 		cpt.Spec.Image = v
 		logrus.Infof("upgrade [%s] image to [%s]", k, v)
-		err = k8s.Default().K8sClient.Update(context.Background(), &cpt)
+		// Patch only the image so fields absent from the vendored CRD type are preserved.
+		err = k8s.Default().K8sClient.Patch(context.Background(), &cpt, k8sclient.MergeFrom(original))
 		if err != nil {
 			res = append(res, fmt.Sprintf(`%s更新异常%s`, k, err.Error()))
 			continue
```

**File**: `api/controller/cluster_upgrade_test.go` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+package controller
+
+import (
+	"encoding/json"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"reflect"
+	"strings"
+	"testing"
+
+	jsonpatch "github.com/evanphx/json-patch/v5"
+	"github.com/goodrain/rainbond-operator/api/v1alpha1"
+	"github.com/goodrain/rainbond/pkg/component/k8s"
+	httputil "github.com/goodrain/rainbond/util/http"
+	"k8s.io/apimachinery/pkg/api/meta"
+	"k8s.io/apimachinery/pkg/runtime"
+	"k8s.io/apimachinery/pkg/runtime/schema"
+	"k8s.io/client-go/rest"
+	k8sclient "sigs.k8s.io/controller-runtime/pkg/client"
+)
+
+// capability_id: rainbond.cluster.upgrade-preserves-component-config
+func TestUpgradePreservesComponentConfig(t *testing.T) {
+	for _, tc := range []struct {
+		name      string
+		namespace string
+		image     string
+	}{
+		{name: "new image", image: "example.invalid/rainbond:new"},
+		{name: "same image", image: "example.invalid/rainbond:old"},
+		{name: "custom namespace", namespace: "custom-system", image: "example.invalid/rainbond:new"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Setenv("RBD_NAMESPACE", tc.namespace)
+			namespace := tc.namespace
+			if namespace == "" {
+				namespace = "rbd-system"
+			}
+			// affinity and tolerations are valid CRD fields missing from the vendored Go type.
+			stored := []byte(`{
+				"apiVersion":"rainbond.io/v1alpha1","kind":"RbdComponent",
+				"metadata":{"name":"rbd-app-ui","namespace":"` + namespace + `","resourceVersion":"42",
+					"labels":{"custom":"keep"},"annotations":{"custom":"keep"}},
+				"spec":{"image":"example.invalid/rainbond:old","replicas":3,"priorityComponent":false,
+					"imagePullPolicy":"IfNotPresent","args":["--custom"],
+					"env":[{"name":"DB_TYPE","value":"mysql"}],
+					"resources":{"requests":{"cpu":"100m"}},
+					"volumes":[{"name":"custom","emptyDir":{}}],
+					"volumeMounts":[{"name":"custom","mountPath":"/custom"}],
+					"affinity":{"nodeAffinity":{"requiredDuringSchedulingIgnoredDuringExecution":{
+						"nodeSelectorTerms":[{"matchFields":[{"key":"metadata.name","operator":"In","values":["custom-node"]}]}]}}},
+					"tolerations":[{"key":"node.kubernetes.io/unschedulable","operator":"Exists","effect":"NoSchedule"}]},
+				"status":{"conditions":[{"type":"ClusterConfigCompeleted","status":"True","reason":"ConfigCompleted"}]}
+			}`)
+			var expected map[string]interface{}
+			if err := json.Unmarshal(stored, &expected); err != nil {
+				t.Fatal(err)
+			}
+			expected["spec"].(map[string]interface{})["image"] = tc.image
+			writes := 0
+			setUpgradeTestClient(t, func(w http.ResponseWriter, r *http.Request) {
+				w.Header().Set("Content-Type", "application/json")
+				if want := "/apis/rainbond.io/v1alpha1/namespaces/" + namespace + "/rbdcomponents/rbd-app-ui"; r.URL.Path != want {
+					t.Errorf("unexpected request path: %s", r.URL.Path)
+					http.NotFound(w, r)
+					return
+				}
+				switch r.Method {
+				case http.MethodGet:
+				case http.MethodPut, http.MethodPatch:
+					writes++
+					body, err := io.ReadAll(r.Body)
+					if err != nil {
+						t.Error(err)
+						w.WriteHeader(http.StatusInternalServerError)
+						return
+					}
+					if r.Method == http.MethodPatch {
+						if got := r.Header.Get("Content-Type"); got != "application/merge-patch+json" {
+							t.Errorf("unexpected patch type: %s", got)
+						}
+						stored, err = jsonpatch.MergePatch(stored, body)
+						if err != nil {
+							t.Error(err)
+							w.WriteHeader(http.StatusInternalServerError)
+							return
+						}
+					} else {
+						stored = body
+					}
+				default:
+					t.Errorf("unexpected method: %s", r.Method)
+					w.WriteHeader(http.StatusMethodNotAllowed)
+					return
+				}
+				_, _ = w.Write(stored)
+			})
+
+			response := runUpgradeRequest(t, `{"rbd-app-ui":"`+tc.image+`"}`)
+			if len(response.List.([]interface{})) != 0 {
+				t.Fatalf("unexpected component errors: %v", response.List)
+			}
+			if writes != 1 {
+				t.Fatalf("expected one component write, got %d", writes)
+			}
+			var actual map[string]interface{}
+			if err := json.Unmarshal(stored, &actual); err != nil {
+				t.Fatal(err)
+			}
+			if !reflect.DeepEqual(actual, expected) {
+				t.Fatalf("upgrade must change only spec.image; got %s", stored)
+			}
+		})
+	}
+}
+
+func TestUpgradeReportsComponentErrorsAndContinues(t *testing.T) {
+	for _, tc := range []struct {
+		name       string
+		failMethod string
+		message    string
+	}{
+		{name: "get failure", failMethod: http.MethodGet, message: "rbd-failed获取异常"},
+		{name: "patch failure", failMethod: http.MethodPatch, message: "rbd-failed更新异常"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Setenv("RBD_NAMESPACE", "rbd-system")
+			upgraded := false
+			setUpgradeTestClient(t, func(w http.ResponseWriter, r *http.Request) {
+				w.Header().Set("Content-Type", "application/json")
+				failed := strings.HasSuffix(r.URL.Path, "/rbd-failed")
+				if failed && r.Method == tc.failMethod {
+					w.WriteHeader(http.StatusForbidden)
+					_, _ = io.Writ
```

**File**: `test-manifest.json` (modified, +18/-0)
```diff
@@ -853,6 +853,24 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.cluster.upgrade-preserves-component-config",
+      "title": "Preserve custom component configuration during image upgrades",
+      "title_zh": "Preserve custom component configuration during image upgrades",
+      "interface_type": "view_endpoint",
+      "interface": "POST /v2/cluster/rbd-upgrade",
+      "code_paths": [
+        "api/controller/cluster.go"
+      ],
+      "tests": [
+        {
+          "path": "api/controller/cluster_upgrade_test.go",
+          "selector": "TestUpgradePreservesComponentConfig"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.cnb-version.extract-major",
       "title": "Extract major version from CNB spec",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -51,6 +51,7 @@
 | rainbond.cluster-resource.exclude-terminal-pods | 从集群资源分配统计中排除终态 Pod | active | regression | api/handler.(*TenantAction).initClusterResource | api/handler/resource_query_scope_test.go::TestInitClusterResourceExcludesTerminalPods |
 | rainbond.cluster-resource.handler-singleton | 复用集群资源处理器单例 | active | unit | api/handler.GetClusterResourceHandler | api/handler/cluster_resource_test.go::TestGetClusterResourceHandlerSingleton |
 | rainbond.cluster-resource.validate-gvr | 校验集群资源 GVR 参数 | active | regression | api/handler.validateGVRParams | api/handler/cluster_resource_test.go::TestValidateGVRParams |
+| rainbond.cluster.upgrade-preserves-component-config | Preserve custom component configuration during image upgrades | active | regression | POST /v2/cluster/rbd-upgrade | api/controller/cluster_upgrade_test.go::TestUpgradePreservesComponentConfig |
 | rainbond.cnb-version.extract-major | 从 CNB 版本表达式提取主版本 | active | regression | builder/parser/code.extractMajorFromSpec | builder/parser/code/cnb_versions_test.go::TestExtractMajorFromSpec |
 | rainbond.cnb-version.golang-order-and-default | 保持 Go CNB 版本顺序并将最新版本设为默认 | active | regression | builder/parser/code.GetCNBVersions | builder/parser/code/cnb_versions_test.go::TestGetCNBVersionsGoOrderingAndDefault |
 | rainbond.cnb-version.match-golang | 归一化并匹配 Go CNB 版本表达式 | active | regression | builder/parser/code.MatchCNBVersion | builder/parser/code/cnb_versions_test.go::TestMatchCNBVersion_Golang |
@@ -968,6 +969,16 @@
 - 代码路径: `api/handler/cluster_resource.go`
 - 测试路径: `api/handler/cluster_resource_test.go::TestValidateGVRParams`
 
+### Preserve custom component configuration during image upgrades
+
+- Capability ID: `rainbond.cluster.upgrade-preserves-component-config`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `view_endpoint`
+- 业务入口: `POST /v2/cluster/rbd-upgrade`
+- 代码路径: `api/controller/cluster.go`
+- 测试路径: `api/controller/cluster_upgrade_test.go::TestUpgradePreservesComponentConfig`
+
 ### 从 CNB 版本表达式提取主版本
 
 - Capability ID: `rainbond.cnb-version.extract-major`
```

---

### Incident Patch 5: `97ec53b0` (2026-09-16)
**Commit Message**: fix: README desc (#2700)

**File**: `README-zh.md` (modified, +37/-24)
```diff
@@ -1,43 +1,56 @@
-# Rainbond
-
-[English](./README.md)
-
-> **AI 生成，Rainbond 运行。始终由你掌控。**
-
-Rainbond 是 AI 应用运行平台。
-
-核心能力 100% 开源。它统一承载和管理 AI 生成的项目、大模型服务、开源 AI 软件及业务应用，通过 AI 完成部署、排错、升级与运维，让应用以容器方式稳定运行在用户自己的服务器或 Kubernetes 上。
-
-通过 [Rainskills](https://github.com/goodrain/rainskills)，Codex、Claude Code 等 AI Agent 可以直接将项目部署到 Rainbond，并完成排错和交付验证。
-
-[让 AI 帮我部署](https://github.com/goodrain/rainskills) ·
-[免费体验](https://run.rainbond.com) ·
-[安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
-[查看文档](https://www.rainbond.com/docs)
+<div align="center">
+  <img src="https://static.goodrain.com/logo/logo-long.png" width="60%" alt="Rainbond Logo" />
+
+  <p><a href="./README.md">English</a></p>
+
+  <p>
+    <a href="https://github.com/goodrain/rainbond/stargazers">
+      <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
+    </a>
+    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Rainbond version" />
+    <a href="https://discord.com/invite/czusNpcymS">
+      <img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&amp;logo=discord" alt="Discord" />
+    </a>
+  </p>
+</div>
+
+<div align="center">
+  <h2>不用懂 Kubernetes 的开源容器平台</h2>
+  <p>通过图形化界面，在 Kubernetes 上构建、部署、组装和管理应用，无需掌握 K8s 专业知识。</p>
+  <p>
+    <a href="https://www.rainbond.com?channel=github">项目官网</a> ·
+    <a href="https://www.rainbond.com/docs?channel=github">文档</a>
+  </p>
+</div>
+
+## Rainbond 是什么？
+  <p>
+    <a href="[https://www.bilibili.com/video/BV1Lzo5BGEuc](https://www.bilibili.com/video/BV1Lzo5BGEuc)">
+      <img src="./docs/rainbond-video.png" width="80%" alt="Rainbond 视频介绍" />
+    </a>
+  </p>
+
+Rainbond 是一款不用懂 Kubernetes 的开源容器平台，核心能力 100% 开源。
+
+它屏蔽底层技术复杂性，统一部署和管理业务应用、AI 生成的项目、开源 AI 软件及大模型服务，让 AI 帮助团队完成部署和运维，让应用稳定运行在自己的服务器或 Kubernetes 集群中。
 
 ## 从哪里开始
 
 | 你的目标 | 推荐入口 |
 | --- | --- |
-| 我正在使用 AI 编程，想把项目部署上线 | [安装 Rainskills](https://github.com/goodrain/rainskills) |
+| 我正在使用 AI 编程，想把项目部署上线 | [安装 RainSkills](https://github.com/goodrain/rainskills) |
 | 我想快速体验，不准备服务器 | [使用 Rainbond Cloud](https://run.rainbond.com) |
 | 我想运行在自己的服务器或 Kubernetes | [私有化安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) |
 | 我想部署 Dify、RAGFlow 等开源应用 | [访问 Rainbond 应用市场](https://hub.rainbond.com) |
 | 我正在选型开源容器平台 | [了解 Rainbond 的应用管理与交付能力](https://www.rainbond.com/compare) |
 
-## 不只是 AI 应用
-
-Rainbond 的新入口面向 AI 编程，但底层应用运行能力没有改变。
-
-源码、容器镜像、Docker Compose、Helm、传统业务系统和微服务应用，仍然可以通过 Rainbond 完成部署、管理、升级、回滚、离线交付和信创适配。
-
 ---
 
 ## Rainbond 解决什么问题
 
 ### 1. 不会 Kubernetes，也能把应用交付起来
 
-Rainbond 通过图形化界面和标准化流程，把源码、镜像、应用模板、依赖关系、访问入口、升级回滚等动作收进同一条应用链路里。
+Rainbond 支持从源码、容器镜像、Docker Compose、Helm 或应用模板部署应用，通过图形化界面和标准化流程，统一管理应用依赖、访问入口、升级与回滚。
 
 ### 2. 让复杂企业环境的交付更稳
 
```

**File**: `README.md` (modified, +27/-18)
```diff
@@ -1,43 +1,52 @@
-# Rainbond
+<div align="center">
+  <img src="https://static.goodrain.com/logo/logo-long.png" width="60%" alt="Rainbond Logo" />
 
-[中文](./README-zh.md)
+  <p><a href="./README-zh.md">中文</a></p>
 
-> **Built by AI. Run by Rainbond. Always under your control.**
+  <p>
+    <a href="https://github.com/goodrain/rainbond/stargazers">
+      <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
+    </a>
+    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Rainbond version" />
+    <a href="https://discord.com/invite/czusNpcymS">
+      <img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&amp;logo=discord" alt="Discord" />
+    </a>
+  </p>
+</div>
 
-Rainbond is an AI application runtime platform.
+<div align="center">
+  <h2>An open-source container platform. No Kubernetes expertise required.</h2>
+  <p>Build, deploy, assemble, and manage applications on Kubernetes through a graphical interface, without K8s expertise.</p>
+  <p>
+    <a href="https://www.rainbond.io?channel=github">Website</a> ·
+    <a href="https://www.rainbond.io/docs/?channel=github">Documentation</a>
+  </p>
+</div>
 
-Its core capabilities are 100% open source. Rainbond provides a unified platform for running and managing AI-generated projects, large language model services, open-source AI software, and business applications. With AI-powered deployment, troubleshooting, upgrades, and operations, it keeps applications running reliably in containers on your own servers or Kubernetes clusters.
+## What is Rainbond?
 
-Through [Rainskills](https://github.com/goodrain/rainskills), AI agents such as Codex and Claude Code can deploy projects directly to Rainbond, troubleshoot issues, and verify delivery.
+Rainbond is an open-source container platform that requires no Kubernetes expertise. Its core capabilities are 100% open source.
+
+It abstracts away infrastructure complexity and provides a unified way to deploy and manage business applications, AI-generated projects, open-source AI software, and large language model services. AI helps teams deploy and operate these workloads, keeping applications running reliably on their own servers or Kubernetes clusters.
 
-[Deploy with AI](https://github.com/goodrain/rainskills) ·
-[Try for free](https://run.rainbond.com) ·
-[Install Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
-[Documentation](https://www.rainbond.com/docs)
 
 ## Where to start
 
 | Your goal | Start here |
 | --- | --- |
-| I use AI coding and want to deploy my project | [Install Rainskills](https://github.com/goodrain/rainskills) |
+| I use AI coding and want to deploy my project | [Install RainSkills](https://github.com/goodrain/rainskills) |
 | I want to try Rainbond without preparing a server | [Use Rainbond Cloud](https://run.rainbond.com) |
 | I want to run applications on my own servers or Kubernetes | [Install Rainbond privately](https://www.rainbond.com/docs/quick-start/quick-install) |
 | I want to deploy open-source applications such as Dify or RAGFlow | [Visit the Rainbond Application Marketplace](https://hub.rainbond.com) |
 | I am evaluating open-source container platforms | [Explore Rainbond's application management and delivery capabilities](https://www.rainbond.com/compare) |
 
-## Not just AI applications
-
-Rainbond's new entry point is designed for AI coding, but its underlying application runtime capabilities remain unchanged.
-
-Source code, container images, Docker Compose, Helm, traditional business systems, and microservice applications can still be deployed, managed, upgraded, rolled back, delivered offline, and adapted for Xinchuang environments with Rainbond.
-
 ---
 
 ## What problems Rainbond solves
 
 ### 1. Deliver applications without deeply learning Kubernetes
 
-Rainbond brings source code, images, application templates, dependencies, access, upgrades, and rollbacks into one application delivery path through a graphical interface and standardized workflows.
+Rainbond supports deploying applications from source code, container images, Docker Compose, Helm, or application templates. Its graphical interface and standardized workflows bring application dependencies, access, upgrades, and rollbacks into one place.
 
 ### 2. Make delivery in complex enterprise environments more reliable
 
```

---

### Incident Patch 6: `b3055230` (2026-09-13)
**Commit Message**: fix: return empty arrays in resource deletion responses

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `api/handler/resource_deletion.go` (modified, +17/-10)
```diff
@@ -192,8 +192,9 @@ func (o *k8sResourceDeletionOrchestrator) Delete(ctx context.Context, req *model
 	}
 
 	result := &model.K8sResourceDeletionResult{
-		Status:       "completed",
-		CascadedCRDs: plan.impact.CRDs,
+		Status:           "completed",
+		DeletedClientIDs: make([]string, 0, len(req.K8sResources)),
+		CascadedCRDs:     plan.impact.CRDs,
 	}
 	for _, resource := range req.K8sResources {
 		result.DeletedClientIDs = append(result.DeletedClientIDs, resource.ClientID)
@@ -254,7 +255,10 @@ func isControllerWorkload(gvk schema.GroupVersionKind) bool {
 
 // Reconcile classifies only confirmed missing resources as safe metadata deletions.
 func (o *k8sResourceDeletionOrchestrator) Reconcile(ctx context.Context, req *model.K8sResourceReconcileRequest) *model.K8sResourceReconcileResult {
-	result := &model.K8sResourceReconcileResult{}
+	result := &model.K8sResourceReconcileResult{
+		MissingClientIDs: []string{},
+		Unknown:          []model.K8sResourceUnknown{},
+	}
 	for _, item := range req.K8sResources {
 		if item.State != model.CreateSuccess && item.State != model.UpdateSuccess {
 			continue
@@ -293,7 +297,9 @@ func (o *k8sResourceDeletionOrchestrator) buildPlan(ctx context.Context, req *mo
 	if req == nil || strings.TrimSpace(req.AppID) == "" {
 		return nil, fmt.Errorf("%w: app_id is required", ErrInvalidK8sResourceDeletionRequest)
 	}
-	plan := &k8sResourceDeletionPlan{}
+	plan := &k8sResourceDeletionPlan{
+		impact: model.K8sResourceDeletionImpact{CRDs: []model.CRDDeletionImpact{}},
+	}
 	plannedCRDs := make(map[string]struct{})
 	for _, item := range req.K8sResources {
 		if item.State != model.CreateSuccess && item.State != model.UpdateSuccess {
@@ -377,12 +383,13 @@ func (o *k8sResourceDeletionOrchestrator) buildCRDPlan(ctx context.Context, reso
 	}
 
 	impact := model.CRDDeletionImpact{
-		Name:    live.GetName(),
-		Group:   group,
-		Version: version,
-		Kind:    kind,
-		Plural:  plural,
-		Scope:   scope,
+		Name:                 live.GetName(),
+		Group:                group,
+		Version:              version,
+		Kind:                 kind,
+		Plural:               plural,
+		Scope:                scope,
+		AffectedRegionAppIDs: []string{},
 	}
 	otherApps := make(map[string]struct{})
 	for i := range list.Items {
```

**File**: `api/handler/resource_deletion_test.go` (modified, +129/-0)
```diff
@@ -2,6 +2,7 @@ package handler
 
 import (
 	"context"
+	"encoding/json"
 	"errors"
 	"fmt"
 	"testing"
@@ -31,6 +32,134 @@ var (
 	testDeploymentGVR = schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
 )
 
+// capability_id: rainbond.k8s-resource.response-array-contract
+func TestK8sResourceDeletionResponseArrays(t *testing.T) {
+	for _, test := range []struct {
+		name     string
+		kind     string
+		instance *unstructured.Unstructured
+	}{
+		{name: "empty selection"},
+		{name: "ordinary ConfigMap", kind: "ConfigMap"},
+		{name: "CRD without instances", kind: "CustomResourceDefinition"},
+		{name: "CRD with current application instance", kind: "CustomResourceDefinition", instance: newTestWidget("owned", "team-a", "app-a")},
+		{name: "CRD with another application instance", kind: "CustomResourceDefinition", instance: newTestWidget("shared", "team-b", "app-b")},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			var objects []*unstructured.Unstructured
+			if test.instance != nil {
+				objects = append(objects, test.instance)
+			}
+			orchestrator, client := newDeletionTestOrchestrator(t, objects...)
+			req := &model.K8sResourceDeletionRequest{AppID: "app-a"}
+			wantIDs := []string{}
+			wantCRDs := []model.CRDDeletionImpact{}
+			switch test.kind {
+			case "ConfigMap":
+				orchestrator.mapper.(*meta.DefaultRESTMapper).Add(schema.GroupVersionKind{Version: "v1", Kind: "ConfigMap"}, meta.RESTScopeNamespace)
+				configMap := &unstructured.Unstructured{Object: map[string]interface{}{
+					"apiVersion": "v1", "kind": "ConfigMap",
+					"metadata": map[string]interface{}{"name": "settings", "namespace": "team-a"},
+				}}
+				if err := client.Tracker().Add(configMap); err != nil {
+					t.Fatal(err)
+				}
+				req.K8sResources = []model.HandleResource{{
+					ClientID: "config-row", AppID: "app-a", Namespace: "team-a", Name: "settings", Kind: "ConfigMap",
+					ResourceYaml: "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: settings\n  namespace: team-a\n", State: model.CreateSuccess,
+				}}
+				wantIDs = []string{"config-row"}
+			case "CustomResourceDefinition":
+				req = newCRDDeletionRequest(true)
+				wantIDs = []string{"crd-row"}
+				wantCRDs = []model.CRDDeletionImpact{{
+					Name: "widgets.example.com", Group: "example.com", Version: "v1", Kind: "Widget", Plural: "widgets", Scope: "Namespaced",
+					AffectedRegionAppIDs: []string{},
+				}}
+				if test.instance != nil {
+					if test.instance.GetLabels()[appIDLabel] == req.AppID {
+						wantCRDs[0].CurrentAppCRCount = 1
+					} else {
+						wantCRDs[0].OtherAppCRCount = 1
+						wantCRDs[0].AffectedRegionAppIDs = []string{"app-b"}
+					}
+				}
+			}
+			impact, err := orchestrator.Preview(context.Background(), req)
+			if err != nil {
+				t.Fatalf("Preview() error = %v", err)
+			}
+			assertResourceResponseJSONField(t, impact, "crds", wantCRDs)
+			for _, action := range client.Actions() {
+				if action.GetVerb() == "delete" {
+					t.Fatalf("Preview() mutated Kubernetes: %#v", action)
+				}
+			}
+			result, err := orchestrator.Delete(context.Background(), req)
+			if err != nil {
+				t.Fatalf("Delete() error = %v", err)
+			}
+			assertResourceResponseJSONField(t, result, "status", "completed")
+			assertResourceResponseJSONField(t, result, "deleted_client_ids", wantIDs)
+			assertResourceResponseJSONField(t, result, "cascaded_crds", wantCRDs)
+		})
+	}
+}
+
+func TestK8sResourceReconcileResponseArrays(t *testing.T) {
+	lookupErr := apierrors.NewForbidden(testWidgetGVR.GroupResource(), "unknown", errors.New("denied"))
+	for _, test := range []struct {
+		name        string
+		names       []string
+		wantMissing []string
+		wantUnknown []model.K8sResourceUnknown
+	}{
+		{name: "empty selection", wantMissing: []string{}, wantUnknown: []model.K8sResourceUnknown{}},
+		{name: "all present", names: []string{"present"}, wantMissing: []string{}, wantUnknown: []model.K8sResourceUnknown{}},
+		{name: "missing", names: []string{"missing"}, wantMissing: []string{"missing"}, wantUnknown: []model.K8sResourceUnknown{}},
+		{name: "unknown", names: []string{"unknown"}, wantMissing: []string{}, wantUnknown: []model.K8sResourceUnknown{{ClientID: "unknown", Error: lookupErr.Error()}}},
+		{name: "mixed", names: []string{"present", "missing", "unknown"}, wantMissing: []string{"missing"}, wantUnknown: []model.K8sResourceUnknown{{ClientID: "unknown", Error: lookupErr.Error()}}},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			orchestrator, client := newDeletionTestOrchestrator(t, newTestWidget("present", "team-a", "app-a"))
+			client.PrependReactor("get", "widgets", func(action ktesting.Action) (bool, runtime.Object, error) {
+				if action.(ktesting.GetAction).GetName() == "unknown" {
+					return true, nil, lookupErr
+				}
+				return false, nil, nil
+			})
+			req := &model.K8sResourceReconcileRequest{AppID: "app-a"}
+			for _, name := range test.names {
+				req.K8sResources = append(req.K8sResource
```

**File**: `test-manifest.json` (modified, +22/-0)
```diff
@@ -3563,6 +3563,28 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.k8s-resource.response-array-contract",
+      "title": "Resource deletion and reconciliation responses encode empty lists as arrays",
+      "title_zh": "Resource deletion and reconciliation responses encode empty lists as arrays",
+      "interface_type": "workflow",
+      "interface": "k8sResourceDeletionOrchestrator",
+      "code_paths": [
+        "api/handler/resource_deletion.go"
+      ],
+      "tests": [
+        {
+          "path": "api/handler/resource_deletion_test.go",
+          "selector": "TestK8sResourceDeletionResponseArrays"
+        },
+        {
+          "path": "api/handler/resource_deletion_test.go",
+          "selector": "TestK8sResourceReconcileResponseArrays"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.k8s-resource.stop-recreating-controller",
       "title": "Stop in-application controllers before deleting generated custom resources",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -194,6 +194,7 @@
 | rainbond.k8s-resource.deletion-timeout-final-check | Kubernetes deletion timeout performs a final live check | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionFinalCheckAvoidsTimeoutRace |
 | rainbond.k8s-resource.failed-delete-metadata-only | Failed resources are metadata-only during deletion | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionSkipsFailedResourceKubernetesDeletion |
 | rainbond.k8s-resource.metadata-reconcile | Kubernetes resource metadata reconciliation | active | regression | api/handler.k8sResourceDeletionOrchestrator.Reconcile | api/handler/resource_deletion_test.go::TestK8sResourceReconcileDistinguishesMissingAndUnknown |
+| rainbond.k8s-resource.response-array-contract | Resource deletion and reconciliation responses encode empty lists as arrays | active | regression | k8sResourceDeletionOrchestrator | api/handler/resource_deletion_test.go::TestK8sResourceDeletionResponseArrays<br>api/handler/resource_deletion_test.go::TestK8sResourceReconcileResponseArrays |
 | rainbond.k8s-resource.stop-recreating-controller | Stop in-application controllers before deleting generated custom resources | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionStopsManagedControllerBeforeGeneratedResources<br>api/handler/resource_deletion_test.go::TestK8sResourceDeletionKeepsControllerUntilFinalizedResourcesAreGone |
 | rainbond.k8s.scheme-registers-kubevirt-vm | K8s scheme registers KubeVirt VirtualMachine | active | regression | pkg/component/k8s.init | pkg/component/k8s/k8sComponent_test.go::TestSchemeRegistersKubeVirtVirtualMachine |
 | rainbond.kubeblocks.component-selector | 为 KubeBlocks 组件生成标签选择器 | active | regression | util/kubeblocks.GenerateKubeBlocksSelector | util/kubeblocks/kubeblocks_test.go::TestGenerateKubeBlocksSelector |
@@ -2395,6 +2396,16 @@
 - 代码路径: `api/handler/resource_deletion.go`
 - 测试路径: `api/handler/resource_deletion_test.go::TestK8sResourceReconcileDistinguishesMissingAndUnknown`
 
+### Resource deletion and reconciliation responses encode empty lists as arrays
+
+- Capability ID: `rainbond.k8s-resource.response-array-contract`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `workflow`
+- 业务入口: `k8sResourceDeletionOrchestrator`
+- 代码路径: `api/handler/resource_deletion.go`
+- 测试路径: `api/handler/resource_deletion_test.go::TestK8sResourceDeletionResponseArrays`, `api/handler/resource_deletion_test.go::TestK8sResourceReconcileResponseArrays`
+
 ### Stop in-application controllers before deleting generated custom resources
 
 - Capability ID: `rainbond.k8s-resource.stop-recreating-controller`
```

---

### Incident Patch 7: `4a17bd04` (2026-09-13)
**Commit Message**: chore: merge main into resource management fixes

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `README-zh.md` (modified, +21/-50)
```diff
@@ -1,64 +1,35 @@
-<div align="center">
-  <img src="https://static.goodrain.com/logo/logo-long.png" width="56%" alt="Rainbond Logo" />
+# Rainbond
 
-  <p>
-    <a href="./README.md">English</a>
-  </p>
+[English](./README.md)
 
-  <p>
-    <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
-    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Version" />
-    <img src="https://img.shields.io/badge/open%20source-100%25-blue?style=flat-square" alt="Open Source" />
-  </p>
-</div>
-<div align="center">
+> **AI 生成，Rainbond 运行。始终由你掌控。**
 
-## 不用懂 Kubernetes 的开源容器平台
+Rainbond 是 AI 应用运行平台。
 
- <p>
-    <a href="https://www.bilibili.com/video/BV1Lzo5BGEuc">
-      <img src="./docs/rainbond-video.png" width="80%" alt="Rainbond 视频介绍" />
-    </a>
-  </p>
+核心能力 100% 开源。它统一承载和管理 AI 生成的项目、大模型服务、开源 AI 软件及业务应用，通过 AI 完成部署、排错、升级与运维，让应用以容器方式稳定运行在用户自己的服务器或 Kubernetes 上。
 
-Rainbond 帮助团队在不深入学习 Kubernetes 的前提下完成应用构建、部署、升级、运维与私有化交付。  
-更适合私有化部署、离线交付、信创适配、应用市场交付和 AI 应用私有化场景。
+通过 [Rainskills](https://github.com/goodrain/rainskills)，Codex、Claude Code 等 AI Agent 可以直接将项目部署到 Rainbond，并完成排错和交付验证。
 
-**Open-source container platform for teams that want to deploy and run applications without deeply operating Kubernetes.**
+[让 AI 帮我部署](https://github.com/goodrain/rainskills) ·
+[免费体验](https://run.rainbond.com) ·
+[安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
+[查看文档](https://www.rainbond.com/docs)
 
-[项目官网](https://www.rainbond.com?channel=github) ·
-[快速安装](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) ·
-[文档](https://www.rainbond.com/docs?channel=github) ·
-[选型中心](https://www.rainbond.com/compare?channel=github) ·
-[应用市场](https://hub.rainbond.com?channel=github)
+## 从哪里开始
 
-</div>
-
----
-
-## Rainbond 是什么
-
-Rainbond 是一款 `100% 开源`、`不用懂 Kubernetes` 的开源容器平台。  
-它更偏向解决“应用交付”问题，而不是只做 Kubernetes 资源管理界面。
-
-如果你的团队正在面对下面这些问题，Rainbond 更值得你看一眼：
-
-- 会 Kubernetes，但应用交付还是很费劲
-- 客户环境复杂，每次上线都像重来一遍
-- 需要私有化部署、离线交付、信创适配或内网部署
-- 想做统一的应用交付入口，但不想从零开始自研平台
+| 你的目标 | 推荐入口 |
+| --- | --- |
+| 我正在使用 AI 编程，想把项目部署上线 | [安装 Rainskills](https://github.com/goodrain/rainskills) |
+| 我想快速体验，不准备服务器 | [使用 Rainbond Cloud](https://run.rainbond.com) |
+| 我想运行在自己的服务器或 Kubernetes | [私有化安装 Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) |
+| 我想部署 Dify、RAGFlow 等开源应用 | [访问 Rainbond 应用市场](https://hub.rainbond.com) |
+| 我正在选型开源容器平台 | [了解 Rainbond 的应用管理与交付能力](https://www.rainbond.com/compare) |
 
----
+## 不只是 AI 应用
 
-## 你可能最关心的是哪一类问题
+Rainbond 的新入口面向 AI 编程，但底层应用运行能力没有改变。
 
-| 你的目标 | 建议先看这里 |
-| --- | --- |
-| 我想先判断 Rainbond 适不适合我 | [选型中心](https://www.rainbond.com/compare?channel=github) |
-| 我想马上装起来试试 | [快速安装](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) |
-| 我装完了，想跑第一个应用 | [部署你的第一个应用](https://www.rainbond.com/docs/quick-start/getting-started?channel=github) |
-| 我在做离线 / 内网 / 客户现场 / 信创 | [离线 / 信创专题](https://www.rainbond.com/offline-and-xinchuang?channel=github) |
-| 我想看能不能通过应用市场一键部署 | [Rainbond 应用市场](https://hub.rainbond.com?channel=github) |
+源码、容器镜像、Docker Compose、Helm、传统业务系统和微服务应用，仍然可以通过 Rainbond 完成部署、管理、升级、回滚、离线交付和信创适配。
 
 ---
 
```

**File**: `README.md` (modified, +21/-43)
```diff
@@ -1,57 +1,35 @@
-<div align="center">
-  <img src="https://static.goodrain.com/logo/logo-long.png" width="56%" alt="Rainbond Logo" />
+# Rainbond
 
-  <p>
-    <a href="./README-zh.md">中文</a>
-  </p>
+[中文](./README-zh.md)
 
-  <p>
-    <img src="https://img.shields.io/github/stars/goodrain/rainbond.svg?style=flat-square" alt="GitHub stars" />
-    <img src="https://img.shields.io/badge/version-v6.X-brightgreen.svg?style=flat-square" alt="Version" />
-    <img src="https://img.shields.io/badge/open%20source-100%25-blue?style=flat-square" alt="Open Source" />
-  </p>
-</div>
+> **Built by AI. Run by Rainbond. Always under your control.**
 
-<div align="center">
+Rainbond is an AI application runtime platform.
 
-## An open-source container platform that needs no Kubernetes learning
+Its core capabilities are 100% open source. Rainbond provides a unified platform for running and managing AI-generated projects, large language model services, open-source AI software, and business applications. With AI-powered deployment, troubleshooting, upgrades, and operations, it keeps applications running reliably in containers on your own servers or Kubernetes clusters.
 
-Rainbond helps teams build, deploy, upgrade, operate, and privately deliver applications without deeply learning Kubernetes.  
-It is better suited for private deployment, offline delivery, Xinchuang adaptation, application marketplace delivery, and AI application privatization scenarios.
+Through [Rainskills](https://github.com/goodrain/rainskills), AI agents such as Codex and Claude Code can deploy projects directly to Rainbond, troubleshoot issues, and verify delivery.
 
-[Website](https://www.rainbond.com?channel=github) ·
-[Quick Install](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) ·
-[Documentation](https://www.rainbond.com/docs?channel=github) ·
-[Comparison Center](https://www.rainbond.com/compare?channel=github) ·
-[Marketplace](https://hub.rainbond.com?channel=github)
+[Deploy with AI](https://github.com/goodrain/rainskills) ·
+[Try for free](https://run.rainbond.com) ·
+[Install Rainbond](https://www.rainbond.com/docs/quick-start/quick-install) ·
+[Documentation](https://www.rainbond.com/docs)
 
-</div>
+## Where to start
 
----
-
-## What is Rainbond
-
-Rainbond is a `100% open-source`, `Kubernetes-friendly` container platform.  
-It is more focused on **application delivery** than on being just a Kubernetes resource management interface.
-
-If your team is facing problems like these, Rainbond is worth evaluating:
-
-- You already use Kubernetes, but application delivery is still too heavy
-- Customer environments are complex, and every release feels like rebuilding everything
-- You need private deployment, offline delivery, Xinchuang compatibility, or internal-network deployment
-- You want a unified application delivery platform without building one from scratch
+| Your goal | Start here |
+| --- | --- |
+| I use AI coding and want to deploy my project | [Install Rainskills](https://github.com/goodrain/rainskills) |
+| I want to try Rainbond without preparing a server | [Use Rainbond Cloud](https://run.rainbond.com) |
+| I want to run applications on my own servers or Kubernetes | [Install Rainbond privately](https://www.rainbond.com/docs/quick-start/quick-install) |
+| I want to deploy open-source applications such as Dify or RAGFlow | [Visit the Rainbond Application Marketplace](https://hub.rainbond.com) |
+| I am evaluating open-source container platforms | [Explore Rainbond's application management and delivery capabilities](https://www.rainbond.com/compare) |
 
----
+## Not just AI applications
 
-## Start from the path that matches your goal
+Rainbond's new entry point is designed for AI coding, but its underlying application runtime capabilities remain unchanged.
 
-| Your goal | Start here |
-| --- | --- |
-| I want to know whether Rainbond fits my team | [Comparison Center](https://www.rainbond.com/compare?channel=github) |
-| I want to install and try it now | [Quick Install](https://www.rainbond.com/docs/quick-start/quick-install?channel=github) |
-| I have installed it and want to deploy the first app | [Deploy your first app](https://www.rainbond.com/docs/quick-start/getting-started?channel=github) |
-| I work in offline / internal / customer site / Xinchuang environments | [Offline / Xinchuang Topic](https://www.rainbond.com/offline-and-xinchuang?channel=github) |
-| I want to see whether apps can be deployed from the marketplace | [Rainbond Marketplace](https://hub.rainbond.com?channel=github) |
+Source code, container images, Docker Compose, Helm, traditional business systems, and microservice applications can still be deployed, managed, upgraded, rolled back, delivered offline, and adapted for Xinchuang environments with Rainbond.
 
 ---
 
```

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +155/-85)
```diff
@@ -30,6 +30,7 @@ import (
 	dbmodel "github.com/goodrain/rainbond/db/model"
 	"github.com/goodrain/rainbond/pkg/component/k8s"
 	httputil "github.com/goodrain/rainbond/util/http"
+	"github.com/goodrain/rainbond/util/portprotocol"
 	"github.com/google/uuid"
 	"github.com/sirupsen/logrus"
 	corev1 "k8s.io/api/core/v1"
@@ -51,11 +52,18 @@ func (g Struct) OpenOrCloseDomains(w http.ResponseWriter, r *http.Request) {
 	if idx := strings.Index(serviceAlias, ","); idx != -1 {
 		serviceAlias = serviceAlias[:idx]
 	}
-	list, _ := c.ApisixRoutes(tenant.Namespace).List(r.Context(), v1.ListOptions{
+	list, err := c.ApisixRoutes(tenant.Namespace).List(r.Context(), v1.ListOptions{
 		LabelSelector: serviceAlias + "=service_alias" + ",port=" + r.URL.Query().Get("port"),
 	})
+	if err != nil {
+		httputil.ReturnBcodeError(r, w, bcode.ErrRouteNotFound)
+		return
+	}
 	for _, itemL := range list.Items {
 		item := itemL
+		if len(item.Spec.HTTP) == 0 {
+			continue
+		}
 		var plugins = item.Spec.HTTP[0].Plugins
 		var newPlugins = make([]v2.ApisixRoutePlugin, 0)
 		for _, plugin := range plugins {
@@ -78,10 +86,6 @@ func (g Struct) OpenOrCloseDomains(w http.ResponseWriter, r *http.Request) {
 		item.Status = v2.ApisixStatus{}
 		_, err := c.ApisixRoutes(tenant.Namespace).Update(r.Context(), &item, v1.UpdateOptions{})
 		if err != nil {
-			if errors.IsConflict(err) {
-				logrus.Warnf("update route %v conflict", item.Name)
-				continue
-			}
 			logrus.Errorf("update route %v failure: %v", item.Name, err)
 			httputil.ReturnBcodeError(r, w, bcode.ErrRouteUpdate)
 			return
@@ -150,9 +154,21 @@ func (g Struct) GetTCPBindDomains(w http.ResponseWriter, r *http.Request) {
 		httputil.ReturnBcodeError(r, w, bcode.ErrRouteNotFound)
 		return
 	}
-	var resp []int32
-	for _, v := range list.Items {
-		resp = append(resp, v.Spec.Ports[0].NodePort)
+	if r.URL.Query().Get("details") == "true" {
+		resp := make([]apimodel.TCPRouteServicePort, 0, len(list.Items))
+		for _, service := range list.Items {
+			if len(service.Spec.Ports) > 0 {
+				resp = append(resp, streamRouteSummary(service))
+			}
+		}
+		httputil.ReturnSuccess(r, w, resp)
+		return
+	}
+	resp := make([]int32, 0, len(list.Items))
+	for _, service := range list.Items {
+		if len(service.Spec.Ports) > 0 {
+			resp = append(resp, service.Spec.Ports[0].NodePort)
+		}
 	}
 	httputil.ReturnSuccess(r, w, resp)
 }
@@ -232,6 +248,33 @@ func addResponseRewritePlugin(apisixRouteHTTP v2.ApisixRouteHTTP) v2.ApisixRoute
 	return apisixRouteHTTP
 }
 
+func httpAPIRouteLabels(tenant *dbmodel.Tenants, r *http.Request, serviceAlias string) map[string]string {
+	labels := map[string]string{
+		"creator":        "Rainbond",
+		"port":           r.URL.Query().Get("port"),
+		"component_sort": serviceAlias,
+	}
+	if tenant != nil {
+		if tenant.UUID != "" {
+			labels["tenant_id"] = tenant.UUID
+		}
+		if tenant.Name != "" {
+			labels["tenant_name"] = tenant.Name
+		}
+	}
+	if appID := r.URL.Query().Get("appID"); appID != "" {
+		labels["app_id"] = appID
+	}
+	if serviceID := r.URL.Query().Get("service_id"); serviceID != "" {
+		labels["service_id"] = serviceID
+	}
+	if serviceAlias != "" {
+		labels["service_alias"] = serviceAlias
+		labels[serviceAlias] = "service_alias"
+	}
+	return labels
+}
+
 // CreateHTTPAPIRoute -
 func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 
@@ -245,23 +288,9 @@ func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 	if idx := strings.Index(sa, ","); idx != -1 {
 		sa = sa[:idx]
 	}
-	sLabel := strings.Split(sa, ",")
-	// 如果没有绑定appId，那么不要加这个lable
-	labels := make(map[string]string)
-	labels["creator"] = "Rainbond"
-	labels["port"] = r.URL.Query().Get("port")
-	labels["component_sort"] = sa
-	if r.URL.Query().Get("appID") != "" {
-		labels["app_id"] = r.URL.Query().Get("appID")
-	}
+	labels := httpAPIRouteLabels(tenant, r, sa)
 	defaultDomain := r.URL.Query().Get("default") == "true"
 
-	for _, sl := range sLabel {
-		if sl != "" {
-			labels[sl] = "service_alias"
-		}
-	}
-
 	c := k8s.Default().ApiSixClient.ApisixV2()
 
 	routeName := strings.ToLower(strings.ReplaceAll(apisixRouteHTTP.Match.Hosts[0], "*", "wildcard") + apisixRouteHTTP.Match.Paths[0])
@@ -404,26 +433,11 @@ func (g Struct) GetTCPRoute(w http.ResponseWriter, r *http.Request) {
 		httputil.ReturnBcodeError(r, w, bcode.ErrRouteNotFound)
 		return
 	}
-	var resp []apimodel.TCPRouteServicePort
-	for _, v := range list.Items {
-		if len(v.Spec.Ports) == 0 {
-			continue
-		}
-		servicePort := v.Spec.Ports[0]
-		item := apimodel.TCPRouteServicePort{
-			ServicePort:   servicePort,
-			ServiceName:   v.Name,
-			ServiceAlias:  v.Labels["service_alias"],
-			ServiceID:     v.Labels["service_id"],
-			AppID:         v.Labels["app_id"],
-			ContainerPort: servicePort.Port,
+	resp := make([]apimodel.TCPRouteServicePort, 0, len(list.Items))
+	for _, service := range list.Items {
+		if len(service.Spec.Ports) > 0 {
+			resp = append(resp, streamRouteSummar
```

**File**: `api/controller/apigateway/api_gateway_route_test.go` (modified, +192/-1)
```diff
@@ -35,6 +35,37 @@ type tcpRouteTestManager struct {
 	tcpRuleDao       dbdao.TCPRuleDao
 }
 
+func TestCreateHTTPAPIRouteAddsCanonicalIdentityLabels(t *testing.T) {
+	req := httptest.NewRequest(
+		http.MethodPost,
+		"/?appID=region-app-id&service_id=service-id&service_alias=service-alias&port=8080",
+		nil,
+	)
+	tenant := &dbmodel.Tenants{
+		UUID:      "tenant-id",
+		Name:      "tenant-name",
+		Namespace: "tenant-namespace",
+	}
+
+	labels := httpAPIRouteLabels(tenant, req, "service-alias")
+	want := map[string]string{
+		"creator":        "Rainbond",
+		"tenant_id":      "tenant-id",
+		"tenant_name":    "tenant-name",
+		"app_id":         "region-app-id",
+		"service_id":     "service-id",
+		"service_alias":  "service-alias",
+		"port":           "8080",
+		"component_sort": "service-alias",
+		"service-alias":  "service_alias",
+	}
+	for key, expected := range want {
+		if got := labels[key]; got != expected {
+			t.Errorf("label %s = %q; want %q", key, got, expected)
+		}
+	}
+}
+
 func (m tcpRouteTestManager) TenantServiceDao() dbdao.TenantServiceDao {
 	return m.tenantServiceDao
 }
@@ -689,7 +720,7 @@ func TestCreateTCPRouteRejectsExistingServiceWithoutMatchingOwner(t *testing.T)
 	}
 }
 
-func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32) *httptest.ResponseRecorder {
+func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32, protocols ...string) *httptest.ResponseRecorder {
 	t.Helper()
 	streamRoute := v2.ApisixRouteStream{
 		Name:     "tcp",
@@ -702,6 +733,9 @@ func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, service
 			ServicePort: intstr.FromInt(9090),
 		},
 	}
+	if len(protocols) > 0 {
+		streamRoute.Protocol = protocols[0]
+	}
 	body, err := json.Marshal(streamRoute)
 	if err != nil {
 		t.Fatalf("marshal route: %v", err)
@@ -1262,3 +1296,160 @@ func TestNodePortFromTCPRouteNameValidatesRange(t *testing.T) {
 		})
 	}
 }
+
+func TestCreateMixedRouteAndEditPreservesNodePort(t *testing.T) {
+	const (
+		namespace    = "default"
+		tenantID     = "tenant-id"
+		appID        = "app-id"
+		serviceID    = "db66afd0892c326ff557df7880ac572d"
+		serviceAlias = "grac572d"
+		serviceName  = "demo-2048"
+		nodePort     = int32(30000)
+	)
+
+	services := map[string]*corev1.Service{
+		serviceName: {
+			ObjectMeta: v1.ObjectMeta{
+				Name:      serviceName,
+				Namespace: namespace,
+				Labels: map[string]string{
+					"app_id":        appID,
+					"service_id":    serviceID,
+					"service_alias": serviceAlias,
+					"rainbond_app":  serviceName,
+				},
+			},
+			Spec: corev1.ServiceSpec{
+				Ports: []corev1.ServicePort{{
+					Name:       "tcp-8080",
+					Protocol:   corev1.ProtocolTCP,
+					Port:       8080,
+					TargetPort: intstr.FromInt(8080),
+				}},
+				Selector: map[string]string{"name": serviceAlias},
+			},
+		},
+	}
+	services[serviceName].Spec.Ports = append(services[serviceName].Spec.Ports, corev1.ServicePort{Name: "udp-8080", Port: 8080, Protocol: corev1.ProtocolUDP, TargetPort: intstr.FromInt(8080)})
+	clientset, closeServer := newTCPRouteTestClientset(t, services)
+	defer closeServer()
+	k8s.New().Clientset = clientset
+
+	ruleDao := &tcpRouteRuleDao{}
+	db.SetTestManager(tcpRouteTestManager{
+		tenantServiceDao: &tcpRouteTenantServiceDao{servicesByID: map[string]*dbmodel.TenantServices{
+			serviceID: {
+				ServiceID:        serviceID,
+				ServiceAlias:     serviceAlias,
+				TenantID:         tenantID,
+				ExtendMethod:     "",
+				K8sComponentName: serviceAlias,
+			},
+		}},
+		tcpRuleDao: ruleDao,
+	})
+	defer db.SetTestManager(nil)
+
+	streamRoute := v2.ApisixRouteStream{
+		Name:     "tcp",
+		Protocol: "tcp+udp",
+		Match: v2.ApisixRouteStreamMatch{
+			IngressPort: nodePort,
+		},
+		Backend: v2.ApisixRouteStreamBackend{
+			ServiceName: serviceName,
+			ServicePort: intstr.FromInt(8080),
+		},
+	}
+	body, err := json.Marshal(streamRoute)
+	if err != nil {
+		t.Fatalf("marshal route: %v", err)
+	}
+	req := httptest.NewRequest(http.MethodPost, "/?appID="+appID, bytes.NewReader(body))
+	ctx := context.WithValue(req.Context(), ctxutil.ContextKey("tenant"), &dbmodel.Tenants{
+		UUID:      tenantID,
+		Namespace: namespace,
+	})
+	req = req.WithContext(ctx)
+
+	rr := httptest.NewRecorder()
+	Struct{}.CreateTCPRoute(rr, req)
+
+	created, err := k8s.Default().Clientset.CoreV1().Services(namespace).Get(context.Background(), serviceName+"-30000", v1.GetOptions{})
+	if err != nil {
+		if errors.IsNotFound(err) {
+			t.Fatalf("expected NodePort service to be created")
+		}
+		t.Fatalf("get created service: %v", err)
+	}
+	if got := created.Spec.Selector["service_alias"]; got != serviceAlias {
+		t.Fatalf("expected selector service_alias %q, got %q", serviceAlias, got)
+	}
+	if got := created.Labels["service_alias"]; got != serviceAlias {
+		t.Fatalf("expected label service_alias %q, got %q", serviceAlias, got)
+	}
+	if got := created.La
```

**File**: `api/controller/apigateway/stream_protocol.go` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+package apigateway
+
+import (
+	"fmt"
+	"strconv"
+	"strings"
+
+	apimodel "github.com/goodrain/rainbond/api/model"
+	"github.com/goodrain/rainbond/util/portprotocol"
+	corev1 "k8s.io/api/core/v1"
+	"k8s.io/apimachinery/pkg/util/intstr"
+)
+
+func streamPorts(protocol string, port int32, target intstr.IntOrString, nodePort int32) []corev1.ServicePort {
+	var ports []corev1.ServicePort
+	for _, transport := range portprotocol.Transports(protocol) {
+		ports = append(ports, corev1.ServicePort{Name: fmt.Sprintf("%s-%d", strings.ToLower(string(transport)), port), Protocol: transport, Port: port, TargetPort: target, NodePort: nodePort})
+	}
+	return ports
+}
+
+func streamRouteSummary(service corev1.Service) apimodel.TCPRouteServicePort {
+	item := apimodel.TCPRouteServicePort{ServiceName: service.Name, ServiceAlias: service.Labels["service_alias"], ServiceID: service.Labels["service_id"], AppID: service.Labels["app_id"], BackendServiceName: service.Annotations["rainbond.com/backend-service"]}
+	if len(service.Spec.Ports) == 0 {
+		return item
+	}
+	item.ServicePort = service.Spec.Ports[0]
+	item.Name = service.Name
+	item.ContainerPort = item.Port
+	if port, err := strconv.Atoi(service.Labels["port"]); err == nil {
+		item.ContainerPort = int32(port)
+	}
+	seen := map[corev1.Protocol]bool{}
+	for _, port := range service.Spec.Ports {
+		protocol := port.Protocol
+		if protocol == "" {
+			protocol = corev1.ProtocolTCP
+		}
+		if !seen[protocol] {
+			item.Protocols = append(item.Protocols, protocol)
+			seen[protocol] = true
+		}
+	}
+	item.Protocol = corev1.Protocol(strings.ToUpper(portprotocol.Canonical(item.Protocols)))
+	return item
+}
+
+func backendSupportsStream(service *corev1.Service, port int32, protocol string) bool {
+	available := []corev1.Protocol{}
+	for _, p := range service.Spec.Ports {
+		if p.Port == port {
+			available = append(available, p.Protocol)
+		}
+	}
+	return len(available) > 0 && portprotocol.Allows(portprotocol.Canonical(available), protocol)
+}
```

**File**: `api/controller/apigateway/stream_protocol_test.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package apigateway
+
+import (
+	"testing"
+
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/apimachinery/pkg/util/intstr"
+)
+
+func TestStreamPortsShareNodePortWithDistinctNames(t *testing.T) {
+	ports := streamPorts("tcp+udp", 53, intstr.FromInt(53), 30030)
+	if len(ports) != 2 {
+		t.Fatalf("want TCP and UDP, got %v", ports)
+	}
+	if ports[0].Name == ports[1].Name {
+		t.Fatal("mixed ports must have unique names")
+	}
+	for _, p := range ports {
+		if p.NodePort != 30030 || p.Port != 53 || p.TargetPort.IntVal != 53 {
+			t.Fatalf("incorrect mapping: %v", p)
+		}
+	}
+}
+func TestStreamRouteSummaryPreservesIdentityAndProtocols(t *testing.T) {
+	svc := corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: "dns-30030", Labels: map[string]string{"service_id": "component", "port": "53"}}, Spec: corev1.ServiceSpec{Ports: []corev1.ServicePort{
+		{Name: "tcp-53", Protocol: corev1.ProtocolTCP, Port: 53, NodePort: 30030},
+		{Name: "udp-53", Protocol: corev1.ProtocolUDP, Port: 53, NodePort: 30030},
+	}}}
+	got := streamRouteSummary(svc)
+	if got.Name != svc.Name || got.ServiceName != svc.Name || got.Protocol != "TCP+UDP" || len(got.Protocols) != 2 {
+		t.Fatalf("unexpected summary: %#v", got)
+	}
+	if got.NodePort != 30030 || got.ContainerPort != 53 {
+		t.Fatalf("incorrect ports: %#v", got)
+	}
+}
```

**File**: `api/handler/gateway_action.go` (modified, +1/-0)
```diff
@@ -1147,6 +1147,7 @@ func (g *GatewayAction) CreateTCPRule(tx *gorm.DB, req *apimodel.AddTCPRuleStruc
 	// add tcp rule
 	tcpRule := &model.TCPRule{
 		UUID:          req.TCPRuleID,
+		Protocol:      req.Protocol,
 		ServiceID:     req.ServiceID,
 		ContainerPort: req.ContainerPort,
 		IP:            req.IP,
```

**File**: `api/handler/service.go` (modified, +26/-0)
```diff
@@ -32,6 +32,8 @@ import (
 	"strings"
 	"time"
 
+	"github.com/goodrain/rainbond/util/portprotocol"
+
 	apisixversioned "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/client/clientset/versioned"
 	"github.com/goodrain/rainbond/builder/sources/registry"
 	"github.com/goodrain/rainbond/config/configs"
@@ -2047,6 +2049,30 @@ func (s *ServiceAction) PortVar(action, tenantID, serviceID string, vps *apimode
 				tx.Rollback()
 				return err
 			}
+			if vp.Protocol != vpD.Protocol {
+				rules, ruleErr := db.GetManager().TCPRuleDao().GetTCPRuleByServiceIDAndContainerPort(serviceID, oldPort)
+				if ruleErr != nil && ruleErr != gorm.ErrRecordNotFound {
+					tx.Rollback()
+					return ruleErr
+				}
+				for _, rule := range rules {
+					if !portprotocol.Allows(vp.Protocol, rule.Protocol) {
+						tx.Rollback()
+						return bcode.NewBadRequest("remove incompatible external mappings before changing the component protocol")
+					}
+				}
+				if vp.Protocol != "http" && vpD.IsOuterService != nil && *vpD.IsOuterService {
+					httpRules, ruleErr := db.GetManager().HTTPRuleDao().GetHTTPRuleByServiceIDAndContainerPort(serviceID, oldPort)
+					if ruleErr != nil && ruleErr != gorm.ErrRecordNotFound {
+						tx.Rollback()
+						return ruleErr
+					}
+					if len(httpRules) > 0 {
+						tx.Rollback()
+						return bcode.NewBadRequest("remove HTTP routes before changing the component protocol")
+					}
+				}
+			}
 			// make sure K8sServiceName is unique
 			if vp.K8sServiceName != "" {
 				port, err := db.GetManager().TenantServicesPortDao().GetByTenantAndName(tenantID, vp.K8sServiceName)
```

---

### Incident Patch 8: `9372f8f8` (2026-09-13)
**Commit Message**: fix: preserve volume edits and reconcile replica capacity

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `api/api_routers/version2/v2Routers.go` (modified, +3/-0)
```diff
@@ -182,6 +182,7 @@ func (v2 *V2) platformPluginsRouter() chi.Router {
 	return r
 }
 
+// PluginBackendProxy forwards requests to the named plugin's backend service.
 func PluginBackendProxy(w http.ResponseWriter, r *http.Request) {
 	plugin, err := getRBDPlugin(chi.URLParam(r, "plugin_name"))
 	if err != nil {
@@ -245,6 +246,7 @@ func getRBDPlugin(pluginName string) (*v1alpha1.RBDPlugin, error) {
 	return plugin, nil
 }
 
+// PluginStaticProxy serves the named plugin's frontend content.
 func PluginStaticProxy(w http.ResponseWriter, r *http.Request) {
 	servePluginStatic(w, r, getRBDPlugin)
 }
@@ -362,6 +364,7 @@ func resolveConfigMapContent(plugin *v1alpha1.RBDPlugin) (string, error) {
 	return resolveFrontedPathContent(plugin)
 }
 
+// ChangePluginStatus enables or disables the named plugin.
 func ChangePluginStatus(w http.ResponseWriter, r *http.Request) {
 	type Status struct {
 		Action string `json:"action"`
```

**File**: `api/controller/cluster.go` (modified, +10/-7)
```diff
@@ -22,6 +22,14 @@ import (
 	"context"
 	"encoding/json"
 	"fmt"
+	"io"
+	"net/http"
+	"os"
+	"path"
+	"path/filepath"
+	"strconv"
+	"strings"
+
 	"github.com/go-chi/chi"
 	"github.com/goodrain/rainbond-operator/api/v1alpha1"
 	"github.com/goodrain/rainbond-operator/util/constants"
@@ -34,14 +42,7 @@ import (
 	utils "github.com/goodrain/rainbond/util"
 	"github.com/jinzhu/gorm"
 	"github.com/sirupsen/logrus"
-	"io"
 	"k8s.io/apimachinery/pkg/types"
-	"net/http"
-	"os"
-	"path"
-	"path/filepath"
-	"strconv"
-	"strings"
 
 	httputil "github.com/goodrain/rainbond/util/http"
 )
@@ -751,6 +752,7 @@ func copyDirectory(srcDir, dstDir string) error {
 	return err
 }
 
+// GetRegionStatus returns the region status after validating the Helm request.
 func (c *ClusterController) GetRegionStatus(w http.ResponseWriter, r *http.Request) {
 	token := chi.URLParam(r, "token")
 	if token != os.Getenv("HELM_TOKEN") {
@@ -765,6 +767,7 @@ func (c *ClusterController) GetRegionStatus(w http.ResponseWriter, r *http.Reque
 	httputil.ReturnSuccess(r, w, regionInfo)
 }
 
+// SetOverScore updates the cluster resource overcommit rate.
 func (c *ClusterController) SetOverScore(w http.ResponseWriter, r *http.Request) {
 	var overScore model.OverScore
 	if ok := httputil.ValidatorRequestStructAndErrorResponse(r, w, &overScore, nil); !ok {
```

**File**: `api/handler/cluster.go` (modified, +1/-0)
```diff
@@ -1100,6 +1100,7 @@ func (c *clusterAction) HandlePlugins() (plugins []*model.RainbondPlugins, err e
 	return plugins, nil
 }
 
+// ComponentRainbondOperator and related constants identify workloads checked during platform upgrades.
 const (
 	ComponentRainbondOperator = "rainbond-operator" // deployment
 	ComponentRBDAPI           = "rbd-api"           // deployment
```

**File**: `api/handler/service.go` (modified, +7/-1)
```diff
@@ -517,6 +517,7 @@ func (s *ServiceAction) ensureVMStarted(sss *apimodel.StartStopStruct, deployVer
 	return lastErr
 }
 
+// StartOrCreateVM starts an existing virtual machine or queues its creation.
 func (s *ServiceAction) StartOrCreateVM(ctx context.Context, sss *apimodel.StartStopStruct, deployVersion string) error {
 	vm, err := s.getVirtualMachineByServiceID(sss.ServiceID)
 	if err != nil {
@@ -558,6 +559,7 @@ func isVMStartRequestedOrRunning(status v1.VirtualMachinePrintableStatus) bool {
 	}
 }
 
+// RestartVM restarts the component virtual machine, creating it when absent.
 func (s *ServiceAction) RestartVM(ctx context.Context, sss *apimodel.StartStopStruct, deployVersion string) error {
 	vm, err := s.getVirtualMachineByServiceID(sss.ServiceID)
 	if err != nil {
@@ -591,6 +593,7 @@ func (s *ServiceAction) RestartVM(ctx context.Context, sss *apimodel.StartStopSt
 	return markDirectVMOperationEvent(ctx, dbmodel.EventStatusSuccess)
 }
 
+// StopVM stops the component virtual machine and records the operation result.
 func (s *ServiceAction) StopVM(ctx context.Context, serviceID string) error {
 	vm, err := s.getVirtualMachineByServiceID(serviceID)
 	if err != nil {
@@ -2526,7 +2529,9 @@ func (s *ServiceAction) UpdVolume(sid string, req *apimodel.UpdVolumeReq) error
 			tx.Rollback()
 			return bcode.NewBadRequest("volume capacity can only be expanded, not reduced")
 		}
-		if s.kubeClient != nil {
+		// An unchanged capacity accompanies ordinary path edits. Only retry
+		// capacity reconciliation when the path is unchanged, or expand a new target.
+		if s.kubeClient != nil && (*req.VolumeCapacity > v.VolumeCapacity || req.VolumePath == v.VolumePath) {
 			service, serviceErr := dbm.TenantServiceDao().GetServiceByID(sid)
 			if serviceErr != nil {
 				tx.Rollback()
@@ -4199,6 +4204,7 @@ func TransStatus(eStatus string) string {
 	return ""
 }
 
+// FileManageInfo lists files at a path in the component's selected container.
 func (s *ServiceAction) FileManageInfo(serviceID, podName, tarPath, containerName, namespace string) ([]apimodel.FileInfo, error) {
 	var fileInfos []apimodel.FileInfo
 
```

**File**: `api/handler/service_volume_test.go` (modified, +88/-0)
```diff
@@ -15,6 +15,7 @@ import (
 	corev1 "k8s.io/api/core/v1"
 	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
 	"k8s.io/client-go/kubernetes/fake"
+	kubevirtv1 "kubevirt.io/api/core/v1"
 )
 
 type volumeUpdateTestManager struct {
@@ -195,6 +196,93 @@ func TestServiceActionUpdVolumeUpdatesVolumeCapacity(t *testing.T) {
 	}
 }
 
+// capability_id: rainbond.component.volume-path-update-without-expansion
+func TestServiceActionUpdVolumePathDoesNotRequireExpansion(t *testing.T) {
+	for _, test := range []struct {
+		name          string
+		volumeType    string
+		extendMethod  string
+		enableSubpath string
+	}{
+		{name: "non-expandable StorageClass", volumeType: "fixed"},
+		{name: "memory filesystem", volumeType: dbmodel.MemoryFSVolumeType.String()},
+		{name: "virtual machine", volumeType: "fixed", extendMethod: "vm"},
+		{name: "shared subpath", volumeType: dbmodel.ShareFileVolumeType.String(), enableSubpath: "true"},
+	} {
+		t.Run(test.name, func(t *testing.T) {
+			t.Setenv("ENABLE_SUBPATH", test.enableSubpath)
+			sqlDB, mock, err := sqlmock.New()
+			if err != nil {
+				t.Fatalf("create sqlmock: %v", err)
+			}
+			defer sqlDB.Close()
+			gdb, err := gorm.Open("mysql", sqlDB)
+			if err != nil {
+				t.Fatalf("open gorm db: %v", err)
+			}
+			defer gdb.Close()
+			mock.ExpectBegin()
+			tx := gdb.Begin()
+			if err := tx.Error; err != nil {
+				t.Fatalf("begin tx: %v", err)
+			}
+			mock.ExpectCommit()
+
+			capacity := int64(20)
+			volumeDao := &volumeUpdateTenantServiceVolumeDao{volume: &dbmodel.TenantServiceVolume{
+				Model:          dbmodel.Model{ID: 7},
+				ServiceID:      "service-1",
+				VolumeName:     "data",
+				VolumeType:     test.volumeType,
+				VolumePath:     "/data",
+				VolumeCapacity: capacity,
+			}}
+			client := fake.NewSimpleClientset(
+				expansionStorageClass("fixed", false),
+				expansionPVC("tenant-ns", "manual7", "service-1", "data", "fixed", "20Gi", "20Gi"),
+			)
+			queriedVMServiceID := ""
+			action := &ServiceAction{
+				dbmanager: volumeUpdateTestManager{
+					tx:        tx,
+					volumeDao: volumeDao,
+					serviceDao: &volumeUpdateTenantServiceDao{service: &dbmodel.TenantServices{
+						ServiceID:    "service-1",
+						Namespace:    "tenant-ns",
+						ExtendMethod: test.extendMethod,
+					}},
+				},
+				kubeClient: client,
+				getVirtualMachineByServiceIDHook: func(serviceID string) (*kubevirtv1.VirtualMachine, error) {
+					queriedVMServiceID = serviceID
+					return nil, nil
+				},
+			}
+			if err := action.UpdVolume("service-1", &apimodel.UpdVolumeReq{
+				VolumeName:     "data",
+				VolumeType:     test.volumeType,
+				VolumePath:     "/new-data",
+				VolumeCapacity: &capacity,
+			}); err != nil {
+				t.Fatalf("path update with unchanged capacity should succeed: %v", err)
+			}
+			if volumeDao.updatedVolume == nil || volumeDao.updatedVolume.VolumePath != "/new-data" ||
+				volumeDao.updatedVolume.VolumeCapacity != capacity {
+				t.Fatalf("expected new path and unchanged capacity, got %#v", volumeDao.updatedVolume)
+			}
+			if len(client.Actions()) != 0 {
+				t.Fatalf("path update should not inspect or expand PVCs, got %v", client.Actions())
+			}
+			if test.extendMethod == "vm" && queriedVMServiceID != "service-1" {
+				t.Fatalf("expected existing VM sync to query service-1, got %q", queriedVMServiceID)
+			}
+			if err := mock.ExpectationsWereMet(); err != nil {
+				t.Fatalf("unmet SQL expectations: %v", err)
+			}
+		})
+	}
+}
+
 // capability_id: rainbond.component.volume-expansion-reconciles-drift
 func TestServiceActionUpdVolumeReconcilesStoredCapacity(t *testing.T) {
 	sqlDB, mock, err := sqlmock.New()
```

**File**: `api/handler/tenant.go` (modified, +18/-12)
```diff
@@ -21,17 +21,18 @@ package handler
 import (
 	"context"
 	"fmt"
+	"sort"
+	"strconv"
+	"strings"
+	"sync"
+	"time"
+
 	"github.com/goodrain/rainbond/pkg/component/grpc"
 	"github.com/goodrain/rainbond/pkg/component/k8s"
 	"github.com/goodrain/rainbond/pkg/component/mq"
 	"github.com/goodrain/rainbond/pkg/component/prom"
 	"github.com/goodrain/rainbond/util/constants"
 	"k8s.io/apimachinery/pkg/api/resource"
-	"sort"
-	"strconv"
-	"strings"
-	"sync"
-	"time"
 
 	"github.com/goodrain/rainbond/api/client/prometheus"
 	"github.com/goodrain/rainbond/api/model"
@@ -894,24 +895,28 @@ func (t *TenantAction) TenantResourceQuota(ctx context.Context, namespace string
 	return nil
 }
 
+// ConvertMemory formats memory in Mi or whole Gi units.
 func ConvertMemory(memory int) string {
 	if memory >= 1024 {
 		return fmt.Sprintf("%vGi", memory/1024)
 	}
 	return fmt.Sprintf("%vMi", memory)
 }
 
+// ConvertCPU formats millicores as milliCPU or whole CPU units.
 func ConvertCPU(cpu int) string {
 	if cpu >= 1000 {
 		return fmt.Sprintf("%v", strconv.Itoa(cpu/1000))
 	}
 	return fmt.Sprintf("%vm", cpu)
 }
 
+// ConvertStorage formats storage capacity in Gi units.
 func ConvertStorage(storage int) string {
 	return fmt.Sprintf("%vGi", strconv.Itoa(storage))
 }
 
+// CheckTenantResourceQuotaAndLimitRange checks that default resource limits fit within remaining tenant quotas.
 func (t *TenantAction) CheckTenantResourceQuotaAndLimitRange(ctx context.Context, namespace string, noMemory, noCPU int) error {
 	quotas, err := t.kubeClient.CoreV1().ResourceQuotas(namespace).Get(ctx, fmt.Sprintf("%v-%v", namespace, "limits-quota"), metav1.GetOptions{})
 	if err != nil {
@@ -920,12 +925,12 @@ func (t *TenantAction) CheckTenantResourceQuotaAndLimitRange(ctx context.Context
 		}
 		return errors.Wrap(err, "get tenant limit range failure")
 	}
-	hardCpu := quotas.Status.Hard["limits.cpu"]
-	userCpu := quotas.Status.Used["limits.cpu"]
+	hardCPU := quotas.Status.Hard["limits.cpu"]
+	userCPU := quotas.Status.Used["limits.cpu"]
 	hardMemory := quotas.Status.Hard["limits.memory"]
 	userMemory := quotas.Status.Used["limits.memory"]
 
-	surplusCPU := ConvertCpuToInt(hardCpu.String()) - ConvertCpuToInt(userCpu.String())
+	surplusCPU := ConvertCPUToInt(hardCPU.String()) - ConvertCPUToInt(userCPU.String())
 	surplusMemory := hardMemory.Value() - userMemory.Value()
 	limitRanges, err := t.kubeClient.CoreV1().LimitRanges(namespace).Get(ctx, fmt.Sprintf("%v-%v", namespace, "limits-range"), metav1.GetOptions{})
 	if err != nil {
@@ -934,13 +939,13 @@ func (t *TenantAction) CheckTenantResourceQuotaAndLimitRange(ctx context.Context
 		}
 		return errors.Wrap(err, "get tenant limit range failure")
 	}
-	var defaultCpu, defaultMemory int64
+	var defaultCPU, defaultMemory int64
 	for _, limit := range limitRanges.Spec.Limits {
 		cpu := limit.Default["cpu"]
-		defaultCpu = ConvertCpuToInt(cpu.String())
+		defaultCPU = ConvertCPUToInt(cpu.String())
 		defaultMemory = limit.Default.Memory().Value()
 	}
-	if ConvertCpuToInt(hardCpu.String()) > 0 && int64(noCPU)*defaultCpu > surplusCPU {
+	if ConvertCPUToInt(hardCPU.String()) > 0 && int64(noCPU)*defaultCPU > surplusCPU {
 		return errors.New(constants.TenantQuotaCPULack)
 	}
 	if hardMemory.Value() > 0 && int64(noMemory)*defaultMemory > surplusMemory {
@@ -949,7 +954,8 @@ func (t *TenantAction) CheckTenantResourceQuotaAndLimitRange(ctx context.Context
 	return nil
 }
 
-func ConvertCpuToInt(cpu string) int64 {
+// ConvertCPUToInt converts an integer or milliCPU quantity to millicores.
+func ConvertCPUToInt(cpu string) int64 {
 	var res int64
 	if strings.Contains(cpu, "m") {
 		s := strings.TrimRight(cpu, "m")
```

**File**: `api/model/model.go` (modified, +10/-2)
```diff
@@ -19,10 +19,11 @@
 package model
 
 import (
-	corev1 "k8s.io/api/core/v1"
 	"net/url"
 	"time"
 
+	corev1 "k8s.io/api/core/v1"
+
 	"github.com/goodrain/rainbond/util"
 
 	dbmodel "github.com/goodrain/rainbond/db/model"
@@ -218,6 +219,7 @@ type CreateServiceStruct struct {
 	}
 }
 
+// ServiceSecurityContext contains security settings for a service.
 type ServiceSecurityContext struct {
 	ServiceID      string `json:"service_id"`
 	SeccompProfile struct {
@@ -2355,6 +2357,7 @@ type FileInfo struct {
 	IsLeaf bool   `json:"is_leaf"`
 }
 
+// GrayReleaseModeRet describes the current canary deployment state.
 type GrayReleaseModeRet struct {
 	ComponentID         string `json:"component_id"`
 	Hostname            string `json:"hostname"`
@@ -2369,31 +2372,35 @@ type GrayReleaseModeRet struct {
 	OldVersion          string `json:"old_version"`
 }
 
+// GrayReleaseModeReq contains the configuration for an application's canary release.
 type GrayReleaseModeReq struct {
 	AppID            string             `json:"app_id"`
 	Namespace        string             `json:"namespace"`
 	EntryComponentID string             `json:"entry_component_id"`
-	EntryHttpRoute   string             `json:"entry_http_route"`
+	EntryHTTPRoute   string             `json:"entry_http_route"`
 	FlowEntryRule    [][]*FlowEntryRule `json:"flow_entry_rule"`
 	GrayStrategyType string             `json:"gray_strategy_type"`
 	GrayStrategy     []int              `json:"gray_strategy"`
 	Status           bool               `json:"status"`
 	TraceType        string             `json:"trace_type"`
 }
 
+// FlowEntryRule describes a request header match for canary traffic.
 type FlowEntryRule struct {
 	HeaderKey   string `json:"header_key"`
 	HeaderType  string `json:"header_type"`
 	HeaderValue string `json:"header_value"`
 }
 
+// AppPeerAuthentications describes an application's peer authentication operation.
 type AppPeerAuthentications struct {
 	Name        string `json:"name"`
 	Namespace   string `json:"namespace"`
 	AppID       string `json:"app_id"`
 	OperateMode bool   `json:"operating_mode"`
 }
 
+// AppAuthorizationPolicy describes an application's component authorization policy operation.
 type AppAuthorizationPolicy struct {
 	Name           string          `json:"name"`
 	Namespace      string          `json:"namespace"`
@@ -2403,6 +2410,7 @@ type AppAuthorizationPolicy struct {
 	ComponentInfos []ComponentInfo `json:"component_infos"`
 }
 
+// ComponentInfo contains component service-account authorization settings.
 type ComponentInfo struct {
 	ComponentID               string   `json:"component_id"`
 	IsCreateSA                bool     `json:"is_create_sa"`
```

**File**: `db/dao/dao.go` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ type AppDao interface {
 	DeleteModelByEventId(eventID string) error
 }
 
-// AppDao tenant dao
+// KeyValueDao provides operations on persistent key-value records.
 type KeyValueDao interface {
 	Put(key, value string) error
 	Get(key string) (*model.KeyValue, error)
```

---

### Incident Patch 9: `70dc6615` (2026-09-11)
**Commit Message**: fix: preserve legacy console requests for UDP mappings

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +1/-1)
```diff
@@ -542,7 +542,7 @@ func (g Struct) CreateTCPRoute(w http.ResponseWriter, r *http.Request) {
 			if resolvedServiceID == "" {
 				resolvedServiceID = backendService.Labels["service_id"]
 			}
-		} else if protocol != "tcp" || r.URL.Query().Get("action") == "create" || routeName != "" {
+		} else if r.URL.Query().Get("action") == "create" || routeName != "" {
 			httputil.ReturnError(r, w, 400, "backend service is unavailable for protocol validation")
 			return
 		} else if !errors.IsNotFound(err) {
```

**File**: `api/controller/apigateway/api_gateway_route_test.go` (modified, +30/-1)
```diff
@@ -720,7 +720,7 @@ func TestCreateTCPRouteRejectsExistingServiceWithoutMatchingOwner(t *testing.T)
 	}
 }
 
-func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32) *httptest.ResponseRecorder {
+func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, serviceName string, nodePort int32, protocols ...string) *httptest.ResponseRecorder {
 	t.Helper()
 	streamRoute := v2.ApisixRouteStream{
 		Name:     "tcp",
@@ -733,6 +733,9 @@ func createTCPRouteForTest(t *testing.T, namespace, tenantID, serviceID, service
 			ServicePort: intstr.FromInt(9090),
 		},
 	}
+	if len(protocols) > 0 {
+		streamRoute.Protocol = protocols[0]
+	}
 	body, err := json.Marshal(streamRoute)
 	if err != nil {
 		t.Fatalf("marshal route: %v", err)
@@ -1424,3 +1427,29 @@ func TestCreateMixedRouteAndEditPreservesNodePort(t *testing.T) {
 	}
 
 }
+
+func TestCreateStreamRouteAcceptsLegacyConsoleAlias(t *testing.T) {
+	for _, protocol := range []string{"tcp", "udp", "tcp+udp"} {
+		t.Run(protocol, func(t *testing.T) {
+			services := map[string]*corev1.Service{}
+			clientset, closeServer := newTCPRouteTestClientset(t, services)
+			defer closeServer()
+			k8s.New().Clientset = clientset
+			db.SetTestManager(tcpRouteTestManager{
+				tenantServiceDao: &tcpRouteTenantServiceDao{servicesByID: map[string]*dbmodel.TenantServices{
+					"component": {ServiceID: "component", TenantID: "tenant", ServiceAlias: "grf9ce55"},
+				}},
+				tcpRuleDao: &tcpRouteRuleDao{},
+			})
+			defer db.SetTestManager(nil)
+			response := createTCPRouteForTest(t, "default", "tenant", "component", "grf9ce55", 30000, protocol)
+			if response.Code != http.StatusOK {
+				t.Fatalf("legacy %s request failed: %d %s", protocol, response.Code, response.Body.String())
+			}
+			service := services["grf9ce55-30000"]
+			if service == nil || service.Spec.Selector["service_alias"] != "grf9ce55" {
+				t.Fatalf("legacy request lost its component selector: %#v", service)
+			}
+		})
+	}
+}
```

---

### Incident Patch 10: `050acb72` (2026-09-11)
**Commit Message**: fix: use configured service names for worker NodePort mappings

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `worker/appm/conversion/gateway.go` (modified, +9/-2)
```diff
@@ -515,7 +515,7 @@ func (a *AppServiceBuild) generateOuterDomain(as *v1.AppService, port *model.Ten
 			if found {
 				continue
 			}
-			name := fmt.Sprintf("%s-%d", as.ServiceAlias, rule.Port)
+			name := nodePortServiceName(as.ServiceAlias, port.K8sServiceName, rule.Port)
 			if err := a.reassignTCPRuleNodePort(as.GetNamespace(), name, rule); err != nil {
 				logrus.Errorf("reassign node port: %v", err)
 				continue
@@ -611,9 +611,16 @@ func selectAvailableNodePort(usedPorts map[int]struct{}) int {
 	return 0
 }
 
+func nodePortServiceName(serviceAlias, k8sServiceName string, nodePort int) string {
+	if k8sServiceName == "" {
+		k8sServiceName = serviceAlias
+	}
+	return fmt.Sprintf("%s-%d", k8sServiceName, nodePort)
+}
+
 // nodePortService restores one mapping; multiple transports belong to the same Service.
 func (a *AppServiceBuild) nodePortService(as *v1.AppService, port *model.TenantServicesPort, rule *model.TCPRule) *corev1.Service {
-	name := fmt.Sprintf("%s-%d", as.ServiceAlias, rule.Port)
+	name := nodePortServiceName(as.ServiceAlias, port.K8sServiceName, rule.Port)
 	spec := corev1.ServiceSpec{
 		Type:                  corev1.ServiceTypeNodePort,
 		ExternalTrafficPolicy: outerServiceExternalTrafficPolicy(a.service),
```

**File**: `worker/appm/conversion/transport_test.go` (modified, +22/-3)
```diff
@@ -1,6 +1,7 @@
 package conversion
 
 import (
+	"fmt"
 	"testing"
 
 	"k8s.io/apimachinery/pkg/util/validation"
@@ -36,16 +37,22 @@ func TestMixedInternalAndHeadlessPorts(t *testing.T) {
 
 func TestRestoreThreeIndependentMappingProtocols(t *testing.T) {
 	as := &appv1.AppService{}
-	as.ServiceAlias = "dns"
+	as.ServiceAlias = "grf9ce55"
 	as.SetTenant(&corev1.Namespace{})
-	builder := &AppServiceBuild{service: &model.TenantServices{ServiceAlias: "dns"}, appService: as}
-	port := &model.TenantServicesPort{ContainerPort: 53, Protocol: "tcp+udp", K8sServiceName: "dns"}
+	builder := &AppServiceBuild{service: &model.TenantServices{ServiceAlias: as.ServiceAlias}, appService: as}
+	port := &model.TenantServicesPort{ContainerPort: 53, Protocol: "tcp+udp", K8sServiceName: "demo-2048"}
 	for _, tc := range []struct {
 		port     int
 		protocol string
 		count    int
 	}{{30010, "tcp", 1}, {30020, "udp", 1}, {30030, "tcp+udp", 2}} {
 		svc := builder.nodePortService(as, port, &model.TCPRule{ContainerPort: 53, Port: tc.port, Protocol: tc.protocol})
+		if want := fmt.Sprintf("demo-2048-%d", tc.port); svc.Name != want {
+			t.Fatalf("expected configured service name %q, got %q", want, svc.Name)
+		}
+		if svc.Spec.Selector["service_alias"] != "grf9ce55" {
+			t.Fatalf("naming must not change the pod selector: %#v", svc.Spec.Selector)
+		}
 		if len(svc.Spec.Ports) != tc.count {
 			t.Fatalf("wrong transport count: %#v", svc.Spec.Ports)
 		}
@@ -59,3 +66,15 @@ func TestRestoreThreeIndependentMappingProtocols(t *testing.T) {
 		}
 	}
 }
+
+func TestNodePortServiceNameFallsBackToLegacyAlias(t *testing.T) {
+	as := &appv1.AppService{}
+	as.ServiceAlias = "grf9ce55"
+	as.SetTenant(&corev1.Namespace{})
+	builder := &AppServiceBuild{service: &model.TenantServices{ServiceAlias: as.ServiceAlias}, appService: as}
+	service := builder.nodePortService(as, &model.TenantServicesPort{ContainerPort: 8081},
+		&model.TCPRule{ContainerPort: 8081, Port: 30001, Protocol: "udp"})
+	if service.Name != "grf9ce55-30001" {
+		t.Fatalf("legacy port without a configured service name lost its alias: %s", service.Name)
+	}
+}
```

---

### Incident Patch 11: `524353e3` (2026-09-11)
**Commit Message**: fix: quote TCP rule protocol default for MySQL migrations

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `db/model/gateway.go` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ func (HTTPRuleRewrite) TableName() string {
 
 // TCPRule contain stream rule
 type TCPRule struct {
-	Protocol string `gorm:"column:protocol;size:16;default:tcp"`
+	Protocol string `gorm:"column:protocol;size:16;default:'tcp'"`
 	Model
 	UUID          string `gorm:"column:uuid"`
 	ServiceID     string `gorm:"column:service_id"`
```

**File**: `db/mysql/mysql_tcp_rule_test.go` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+package mysql
+
+import (
+	"path/filepath"
+	"regexp"
+	"testing"
+
+	"github.com/DATA-DOG/go-sqlmock"
+	"github.com/goodrain/rainbond/db/model"
+	mysqldao "github.com/goodrain/rainbond/db/mysql/dao"
+	"github.com/jinzhu/gorm"
+)
+
+func TestTCPRuleMySQLMigrationQuotesProtocolDefault(t *testing.T) {
+	database, mock := newMySQLDialectPatchTestDBWithMock(t)
+	mock.MatchExpectationsInOrder(false)
+	mock.ExpectQuery(regexp.QuoteMeta("SELECT DATABASE()")).WillReturnRows(sqlmock.NewRows([]string{"database"}).AddRow("region"))
+	mock.ExpectQuery(regexp.QuoteMeta("SHOW TABLES FROM `region` WHERE `Tables_in_region` = ?")).
+		WithArgs("gateway_tcp_rule").WillReturnRows(sqlmock.NewRows([]string{"table"}).AddRow("gateway_tcp_rule"))
+	for _, field := range database.NewScope(&model.TCPRule{}).GetStructFields() {
+		mock.ExpectQuery(regexp.QuoteMeta("SELECT DATABASE()")).WillReturnRows(sqlmock.NewRows([]string{"database"}).AddRow("region"))
+		rows := sqlmock.NewRows([]string{"Field"})
+		if field.DBName != "protocol" {
+			rows.AddRow(field.DBName)
+		}
+		mock.ExpectQuery(regexp.QuoteMeta("SHOW COLUMNS FROM `gateway_tcp_rule` FROM `region` WHERE Field = ?")).
+			WithArgs(field.DBName).WillReturnRows(rows)
+	}
+	mock.ExpectExec(regexp.QuoteMeta("ALTER TABLE `gateway_tcp_rule` ADD `protocol` varchar(16) DEFAULT 'tcp';")).
+		WillReturnResult(sqlmock.NewResult(0, 0))
+
+	if err := database.AutoMigrate(&model.TCPRule{}).Error; err != nil {
+		t.Fatalf("migrate legacy MySQL rule table: %v", err)
+	}
+	if err := mock.ExpectationsWereMet(); err != nil {
+		t.Fatal(err)
+	}
+}
+
+func TestTCPRuleMigrationPreservesLegacyRulesAndAllowsUDP(t *testing.T) {
+	database, err := gorm.Open("sqlite3", filepath.Join(t.TempDir(), "legacy-rules.db"))
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer database.Close()
+	if err := database.Exec(`CREATE TABLE gateway_tcp_rule (
+        ID integer PRIMARY KEY, create_time datetime, uuid varchar(255), service_id varchar(255),
+        container_port integer, ip varchar(255), port integer
+    )`).Error; err != nil {
+		t.Fatal(err)
+	}
+	if err := database.Exec("INSERT INTO gateway_tcp_rule (uuid, service_id, container_port, ip, port) VALUES (?, ?, ?, ?, ?)",
+		"existing-rule", "component", 53, "0.0.0.0", 30010).Error; err != nil {
+		t.Fatal(err)
+	}
+	for i := 0; i < 2; i++ {
+		if err := database.AutoMigrate(&model.TCPRule{}).Error; err != nil {
+			t.Fatal(err)
+		}
+	}
+	dao := &mysqldao.TCPRuleDaoTmpl{DB: database}
+	old, err := dao.GetTCPRuleByPort(30010)
+	if err != nil || old == nil || old.UUID != "existing-rule" || old.Protocol != "tcp" {
+		t.Fatalf("legacy rule was not preserved with TCP default: %#v, %v", old, err)
+	}
+	for _, protocol := range []string{"udp", "tcp+udp"} {
+		if err := dao.ReplaceByIPAndPort(&model.TCPRule{
+			UUID: "new-rule", ServiceID: "component", ContainerPort: 53,
+			IP: "0.0.0.0", Port: 30020, Protocol: protocol,
+		}); err != nil {
+			t.Fatalf("persist %s rule after migration: %v", protocol, err)
+		}
+		saved, err := dao.GetTCPRuleByPort(30020)
+		if err != nil || saved == nil || saved.Protocol != protocol {
+			t.Fatalf("incorrect protocol after migration: %#v, %v", saved, err)
+		}
+	}
+}
```

---

### Incident Patch 12: `9a75f3f0` (2026-09-11)
**Commit Message**: fix: resolve PVC namespace for volume expansion

**File**: `api/handler/service.go` (modified, +1/-2)
```diff
@@ -2521,8 +2521,7 @@ func (s *ServiceAction) UpdVolume(sid string, req *apimodel.UpdVolumeReq) error
 		tx.Rollback()
 		return err
 	}
-	if req.VolumeCapacity != nil && req.VolumeType != dbmodel.ConfigFileVolumeType.String() &&
-		*req.VolumeCapacity != v.VolumeCapacity {
+	if req.VolumeCapacity != nil && req.VolumeType != dbmodel.ConfigFileVolumeType.String() {
 		if *req.VolumeCapacity < v.VolumeCapacity {
 			tx.Rollback()
 			return bcode.NewBadRequest("volume capacity can only be expanded, not reduced")
```

**File**: `api/handler/service_volume_expansion.go` (modified, +24/-8)
```diff
@@ -20,6 +20,7 @@ import (
 const (
 	volumeExpansionUnsupported             = "unsupported"
 	volumeExpansionUnbound                 = "unbound"
+	volumeExpansionPending                 = "pending"
 	volumeExpansionReady                   = "ready"
 	volumeExpansionResizing                = "resizing"
 	volumeExpansionFileSystemResizePending = "filesystem_resize_pending"
@@ -76,6 +77,12 @@ func capacityInGi(quantity resource.Quantity) int64 {
 	return (value + gibibyte - 1) / gibibyte
 }
 
+func unsupportedExpansionProvisioner(provisioner string) bool {
+	provisioner = strings.ToLower(strings.TrimSpace(provisioner))
+	return strings.Contains(provisioner, "nfs-subdir-external-provisioner") ||
+		strings.Contains(provisioner, "nfs-client-provisioner")
+}
+
 func expansionCondition(pvc *corev1.PersistentVolumeClaim) (status, message string) {
 	for _, condition := range pvc.Status.Conditions {
 		if condition.Status != corev1.ConditionTrue {
@@ -171,6 +178,13 @@ func (s *ServiceAction) inspectVolumeExpansion(ctx context.Context, service *dbm
 				}
 				return runtimeStatus, claims, fmt.Errorf("get StorageClass %s: %w", className, getErr)
 			}
+			if unsupportedExpansionProvisioner(storageClass.Provisioner) {
+				runtimeStatus.Message = fmt.Sprintf(
+					"StorageClass %s uses an NFS subdir provisioner that does not support volume expansion", className,
+				)
+				runtimeStatus.ActualCapacity = normalizedActualCapacity(runtimeStatus.ActualCapacity)
+				return runtimeStatus, claims, nil
+			}
 			allowed = storageClass.AllowVolumeExpansion != nil && *storageClass.AllowVolumeExpansion
 			classCache[className] = allowed
 		}
@@ -196,6 +210,9 @@ func (s *ServiceAction) inspectVolumeExpansion(ctx context.Context, service *dbm
 		runtimeStatus.Message = conditionMessage
 	} else if runtimeStatus.ActualCapacity < runtimeStatus.RequestedCapacity {
 		runtimeStatus.Status = volumeExpansionResizing
+	} else if volume.VolumeCapacity > runtimeStatus.RequestedCapacity {
+		runtimeStatus.Status = volumeExpansionPending
+		runtimeStatus.Message = "desired capacity has not been applied to the PersistentVolumeClaim"
 	}
 	return runtimeStatus, claims, nil
 }
@@ -211,15 +228,17 @@ func (s *ServiceAction) resolveVolumeExpansionNamespace(service *dbmodel.TenantS
 	if service == nil {
 		return "", nil
 	}
-	tenantNamespace := ""
-	if (service.Namespace == "" || service.Namespace == service.TenantID) && s.resolveTenantNamespaceHook != nil {
-		var err error
-		tenantNamespace, err = s.resolveTenantNamespaceHook(service.TenantID)
+	if service.TenantID != "" {
+		if s.resolveTenantNamespaceHook == nil {
+			return "", nil
+		}
+		tenantNamespace, err := s.resolveTenantNamespaceHook(service.TenantID)
 		if err != nil {
 			return "", fmt.Errorf("resolve tenant namespace: %w", err)
 		}
+		return tenantNamespace, nil
 	}
-	return resolvePodMetricsNamespace(service.Namespace, service.TenantID, tenantNamespace), nil
+	return service.Namespace, nil
 }
 
 func (s *ServiceAction) expandVolumeClaims(ctx context.Context, service *dbmodel.TenantServices,
@@ -231,9 +250,6 @@ func (s *ServiceAction) expandVolumeClaims(ctx context.Context, service *dbmodel
 	if targetGi < volume.VolumeCapacity {
 		return bcode.NewBadRequest("volume capacity can only be expanded, not reduced")
 	}
-	if targetGi == volume.VolumeCapacity {
-		return nil
-	}
 	if reason := unsupportedVolumeExpansionReason(service, volume); reason != "" {
 		return bcode.NewBadRequest(reason)
 	}
```

**File**: `api/handler/service_volume_expansion_test.go` (modified, +77/-45)
```diff
@@ -22,6 +22,12 @@ func expansionStorageClass(name string, allowed bool) *storagev1.StorageClass {
 	}
 }
 
+func expansionStorageClassWithProvisioner(name string, allowed bool, provisioner string) *storagev1.StorageClass {
+	storageClass := expansionStorageClass(name, allowed)
+	storageClass.Provisioner = provisioner
+	return storageClass
+}
+
 func expansionPVC(namespace, name, serviceID, volumeName, storageClass, requested, actual string,
 	conditions ...corev1.PersistentVolumeClaimConditionType,
 ) *corev1.PersistentVolumeClaim {
@@ -64,15 +70,16 @@ func TestInspectVolumeExpansion(t *testing.T) {
 	}
 
 	tests := []struct {
-		name          string
-		service       *dbmodel.TenantServices
-		volume        *dbmodel.TenantServiceVolume
-		objects       []runtime.Object
-		wantStatus    string
-		wantAllowed   bool
-		wantActual    int64
-		wantRequested int64
-		wantPVCCount  int
+		name                       string
+		service                    *dbmodel.TenantServices
+		volume                     *dbmodel.TenantServiceVolume
+		objects                    []runtime.Object
+		wantStatus                 string
+		wantAllowed                bool
+		wantActual                 int64
+		wantRequested              int64
+		wantPVCCount               int
+		resolveTenantNamespaceHook func(string) (string, error)
 	}{
 		{
 			name:    "stateful claims are aggregated",
@@ -103,6 +110,26 @@ func TestInspectVolumeExpansion(t *testing.T) {
 			wantRequested: 30,
 			wantPVCCount:  1,
 		},
+		{
+			name:    "stored target ahead of PVC request is pending",
+			service: service,
+			volume: &dbmodel.TenantServiceVolume{
+				Model:          dbmodel.Model{ID: 7},
+				ServiceID:      service.ServiceID,
+				VolumeName:     "data",
+				VolumeType:     "fast",
+				VolumeCapacity: 30,
+			},
+			objects: []runtime.Object{
+				expansionStorageClass("fast", true),
+				expansionPVC("tenant-ns", "manual7", "service-1", "data", "fast", "10Gi", "10Gi"),
+			},
+			wantStatus:    "pending",
+			wantAllowed:   true,
+			wantActual:    10,
+			wantRequested: 10,
+			wantPVCCount:  1,
+		},
 		{
 			name:    "filesystem condition takes precedence",
 			service: service,
@@ -134,6 +161,22 @@ func TestInspectVolumeExpansion(t *testing.T) {
 			wantRequested: 20,
 			wantPVCCount:  1,
 		},
+		{
+			name:    "nfs subdir provisioner cannot expand volumes",
+			service: service,
+			volume:  volume,
+			objects: []runtime.Object{
+				expansionStorageClassWithProvisioner(
+					"fast", true, "cluster.local/nfs-subdir-external-provisioner",
+				),
+				expansionPVC("tenant-ns", "manual7", "service-1", "data", "fast", "20Gi", "20Gi"),
+			},
+			wantStatus:    volumeExpansionUnsupported,
+			wantAllowed:   false,
+			wantActual:    20,
+			wantRequested: 20,
+			wantPVCCount:  1,
+		},
 		{
 			name:          "not yet deployed PVC can change desired capacity",
 			service:       service,
@@ -144,6 +187,27 @@ func TestInspectVolumeExpansion(t *testing.T) {
 			wantRequested: 0,
 			wantPVCCount:  0,
 		},
+		{
+			name: "image namespace does not shadow tenant namespace",
+			service: &dbmodel.TenantServices{
+				TenantID:  "tenant-uuid",
+				ServiceID: "service-1",
+				Namespace: "goodrain",
+			},
+			volume: volume,
+			objects: []runtime.Object{
+				expansionStorageClass("fast", true),
+				expansionPVC("default", "manual7", "service-1", "data", "fast", "20Gi", "20Gi"),
+			},
+			wantStatus:    volumeExpansionReady,
+			wantAllowed:   true,
+			wantActual:    20,
+			wantRequested: 20,
+			wantPVCCount:  1,
+			resolveTenantNamespaceHook: func(tenantID string) (string, error) {
+				return "default", nil
+			},
+		},
 		{
 			name: "virtual machine guest disks are not supported",
 			service: &dbmodel.TenantServices{
@@ -160,7 +224,10 @@ func TestInspectVolumeExpansion(t *testing.T) {
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			action := &ServiceAction{kubeClient: fake.NewSimpleClientset(tt.objects...)}
+			action := &ServiceAction{
+				kubeClient:                 fake.NewSimpleClientset(tt.objects...),
+				resolveTenantNamespaceHook: tt.resolveTenantNamespaceHook,
+			}
 			got, _, err := action.inspectVolumeExpansion(context.Background(), tt.service, tt.volume)
 			if err != nil {
 				t.Fatalf("inspect volume expansion: %v", err)
@@ -174,41 +241,6 @@ func TestInspectVolumeExpansion(t *testing.T) {
 	}
 }
 
-func TestInspectVolumeExpansionResolvesTenantNamespace(t *testing.T) {
-	service := &dbmodel.TenantServices{
-		TenantID:  "tenant-uuid",
-		ServiceID: "service-1",
-		Namespace: "tenant-uuid",
-	}
-	volume := &dbmodel.TenantServiceVolume{
-		Model:          dbmodel.Model{ID: 7},
-		ServiceID:      service.ServiceID,
-		VolumeName:     "data",
-		VolumeType:     "fast",
-		VolumeCapacity: 20,
-	}
-	action := &ServiceAction{
-		kubeClient: fake.NewSimpleClientset(
-			expansionStorageClass("fast", true),
-			expansionPVC("tenant-ns", "manual7", "service-1", "data", "fast", "20Gi", "20Gi"),
-
```

**File**: `api/handler/service_volume_test.go` (modified, +100/-3)
```diff
@@ -1,6 +1,7 @@
 package handler
 
 import (
+	"context"
 	"strings"
 	"testing"
 
@@ -11,12 +12,16 @@ import (
 	dbdao "github.com/goodrain/rainbond/db/dao"
 	dbmodel "github.com/goodrain/rainbond/db/model"
 	"github.com/jinzhu/gorm"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+	"k8s.io/client-go/kubernetes/fake"
 )
 
 type volumeUpdateTestManager struct {
 	db.Manager
-	tx        *gorm.DB
-	volumeDao dbdao.TenantServiceVolumeDao
+	tx         *gorm.DB
+	volumeDao  dbdao.TenantServiceVolumeDao
+	serviceDao dbdao.TenantServiceDao
 }
 
 func (m volumeUpdateTestManager) Begin() *gorm.DB {
@@ -27,6 +32,19 @@ func (m volumeUpdateTestManager) TenantServiceVolumeDaoTransactions(*gorm.DB) db
 	return m.volumeDao
 }
 
+func (m volumeUpdateTestManager) TenantServiceDao() dbdao.TenantServiceDao {
+	return m.serviceDao
+}
+
+type volumeUpdateTenantServiceDao struct {
+	dbdao.TenantServiceDao
+	service *dbmodel.TenantServices
+}
+
+func (d *volumeUpdateTenantServiceDao) GetServiceByID(string) (*dbmodel.TenantServices, error) {
+	return d.service, nil
+}
+
 type volumeUpdateTenantServiceVolumeDao struct {
 	dbdao.TenantServiceVolumeDao
 	volume        *dbmodel.TenantServiceVolume
@@ -139,7 +157,13 @@ func TestServiceActionUpdVolumeUpdatesVolumeCapacity(t *testing.T) {
 			VolumeCapacity: 10,
 		},
 	}
-	db.SetTestManager(volumeUpdateTestManager{tx: tx, volumeDao: volumeDao})
+	db.SetTestManager(volumeUpdateTestManager{
+		tx:        tx,
+		volumeDao: volumeDao,
+		serviceDao: &volumeUpdateTenantServiceDao{service: &dbmodel.TenantServices{
+			ServiceID: "service-1",
+		}},
+	})
 	defer db.SetTestManager(nil)
 
 	volumeCapacity := int64(20)
@@ -171,6 +195,79 @@ func TestServiceActionUpdVolumeUpdatesVolumeCapacity(t *testing.T) {
 	}
 }
 
+// capability_id: rainbond.component.volume-expansion-reconciles-drift
+func TestServiceActionUpdVolumeReconcilesStoredCapacity(t *testing.T) {
+	sqlDB, mock, err := sqlmock.New()
+	if err != nil {
+		t.Fatalf("create sqlmock: %v", err)
+	}
+	defer sqlDB.Close()
+
+	gdb, err := gorm.Open("mysql", sqlDB)
+	if err != nil {
+		t.Fatalf("open gorm db: %v", err)
+	}
+	defer gdb.Close()
+
+	mock.ExpectBegin()
+	tx := gdb.Begin()
+	if err := tx.Error; err != nil {
+		t.Fatalf("begin tx: %v", err)
+	}
+	mock.ExpectCommit()
+
+	service := &dbmodel.TenantServices{
+		TenantID:  "tenant-uuid",
+		ServiceID: "service-1",
+		Namespace: "goodrain",
+	}
+	volumeDao := &volumeUpdateTenantServiceVolumeDao{volume: &dbmodel.TenantServiceVolume{
+		Model:          dbmodel.Model{ID: 1},
+		ServiceID:      service.ServiceID,
+		VolumeName:     "data",
+		VolumeType:     "fast",
+		VolumePath:     "/data",
+		VolumeCapacity: 20,
+	}}
+	manager := volumeUpdateTestManager{
+		tx:         tx,
+		volumeDao:  volumeDao,
+		serviceDao: &volumeUpdateTenantServiceDao{service: service},
+	}
+	client := fake.NewSimpleClientset(
+		expansionStorageClass("fast", true),
+		expansionPVC("default", "manual1", "service-1", "data", "fast", "10Gi", "10Gi"),
+	)
+	action := &ServiceAction{
+		dbmanager:  manager,
+		kubeClient: client,
+		resolveTenantNamespaceHook: func(string) (string, error) {
+			return "default", nil
+		},
+	}
+	targetCapacity := int64(20)
+
+	if err := action.UpdVolume("service-1", &apimodel.UpdVolumeReq{
+		VolumeName:     "data",
+		VolumeType:     "fast",
+		VolumePath:     "/data",
+		VolumeCapacity: &targetCapacity,
+	}); err != nil {
+		t.Fatalf("update volume: %v", err)
+	}
+	pvc, err := client.CoreV1().PersistentVolumeClaims("default").Get(
+		context.Background(), "manual1", metav1.GetOptions{})
+	if err != nil {
+		t.Fatalf("get PVC: %v", err)
+	}
+	if got := pvc.Spec.Resources.Requests[corev1.ResourceStorage]; got.String() != "20Gi" {
+		t.Fatalf("PVC request = %s, want 20Gi", got.String())
+	}
+	if err := mock.ExpectationsWereMet(); err != nil {
+		t.Fatalf("unmet SQL expectations: %v", err)
+	}
+}
+
 // capability_id: rainbond.component.volume-expansion-only-grows
 func TestServiceActionUpdVolumeRejectsShrink(t *testing.T) {
 	sqlDB, mock, err := sqlmock.New()
```

**File**: `test-manifest.json` (modified, +19/-0)
```diff
@@ -1519,6 +1519,25 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.component.volume-expansion-reconciles-drift",
+      "title": "Reconcile PVC request with stored volume capacity",
+      "title_zh": "Reconcile PVC request with stored volume capacity",
+      "interface_type": "handler_method",
+      "interface": "api/handler.ServiceAction.UpdVolume",
+      "code_paths": [
+        "api/handler/service_volume_expansion.go",
+        "api/handler/service.go"
+      ],
+      "tests": [
+        {
+          "path": "api/handler/service_volume_test.go",
+          "selector": "TestServiceActionUpdVolumeReconcilesStoredCapacity"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.component.volume-expansion-status",
       "title": "Report PVC volume expansion capability and status",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -86,6 +86,7 @@
 | rainbond.cnb.waiting-complete | 等待 CNB 构建任务完成状态 | active | regression | builder/build/cnb.Builder.waitingComplete | builder/build/cnb/cnb_test.go::TestWaitingComplete |
 | rainbond.component.volume-delete-blocks-shared-mount | Block deleting shared mounted component volumes | active | regression | api/handler.ServiceAction.VolumnVar | api/handler/service_volume_test.go::TestServiceActionVolumnVarDeleteRejectsSharedMountedVolume |
 | rainbond.component.volume-expansion-only-grows | Reject PVC volume shrink requests | active | regression | api/handler.ServiceAction.UpdVolume | api/handler/service_volume_test.go::TestServiceActionUpdVolumeRejectsShrink |
+| rainbond.component.volume-expansion-reconciles-drift | Reconcile PVC request with stored volume capacity | active | regression | api/handler.ServiceAction.UpdVolume | api/handler/service_volume_test.go::TestServiceActionUpdVolumeReconcilesStoredCapacity |
 | rainbond.component.volume-expansion-status | Report PVC volume expansion capability and status | active | unit | api/handler.ServiceAction.GetVolumes | api/handler/service_volume_expansion_test.go::TestInspectVolumeExpansion |
 | rainbond.component.volume-expansion-updates-claims | Expand every PVC for a component volume | active | regression | api/handler.ServiceAction.UpdVolume | api/handler/service_volume_expansion_test.go::TestExpandVolumeClaims |
 | rainbond.component.volume-update-persists-capacity | 持久化组件存储容量更新 | active | regression | api/handler.ServiceAction.UpdVolume | api/handler/service_volume_test.go::TestServiceActionUpdVolumeUpdatesVolumeCapacity |
@@ -1312,6 +1313,16 @@
 - 代码路径: `api/handler/service_volume_expansion.go`, `api/handler/service.go`
 - 测试路径: `api/handler/service_volume_test.go::TestServiceActionUpdVolumeRejectsShrink`
 
+### Reconcile PVC request with stored volume capacity
+
+- Capability ID: `rainbond.component.volume-expansion-reconciles-drift`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `handler_method`
+- 业务入口: `api/handler.ServiceAction.UpdVolume`
+- 代码路径: `api/handler/service_volume_expansion.go`, `api/handler/service.go`
+- 测试路径: `api/handler/service_volume_test.go::TestServiceActionUpdVolumeReconcilesStoredCapacity`
+
 ### Report PVC volume expansion capability and status
 
 - Capability ID: `rainbond.component.volume-expansion-status`
```

---

### Incident Patch 13: `807afee5` (2026-09-10)
**Commit Message**: fix: preserve project nginx config in static CNB builds

Signed-off-by: Qi Zhang <[REDACTED_EMAIL]>

**File**: `builder/build/cnb/cnb_test.go` (modified, +51/-0)
```diff
@@ -548,6 +548,57 @@ func TestBuildPlatformAnnotations(t *testing.T) {
 			t.Errorf("got %q; want public", ann["cnb-bp-web-server-root"])
 		}
 	})
+
+	t.Run("static project nginx config takes precedence over generated defaults", func(t *testing.T) {
+		for _, lang := range []code.Lang{code.Static, code.Nodejs} {
+			t.Run(string(lang), func(t *testing.T) {
+				dir := t.TempDir()
+				configPath := filepath.Join(dir, "nginx.conf")
+				config := []byte("daemon off;\nevents {}\nhttp { server { listen 8080; root /workspace; } }\n")
+				if err := os.WriteFile(configPath, config, 0644); err != nil {
+					t.Fatal(err)
+				}
+				b := &Builder{}
+				re := &build.Request{Lang: lang, SourceDir: dir, BuildEnvs: map[string]string{"CNB_OUTPUT_DIR": "public"}}
+				ann := b.buildPlatformAnnotations(re)
+				for _, key := range []string{"cnb-bp-web-server", "cnb-bp-web-server-root", "cnb-bp-web-server-enable-push-state"} {
+					if value, exists := ann[key]; exists {
+						t.Errorf("project nginx.conf must suppress generated default %s=%q", key, value)
+					}
+				}
+				vol, _ := b.createPlatformVolume(ann, nil)
+				for _, source := range vol.Projected.Sources {
+					if source.DownwardAPI == nil {
+						continue
+					}
+					for _, item := range source.DownwardAPI.Items {
+						if item.Path == "env/BP_WEB_SERVER" {
+							t.Error("buildpack must not receive automatic config generation flag")
+						}
+					}
+				}
+				bps := getLanguageConfig(re).CustomOrder(re)
+				if len(bps) != 1 || bps[0].ID != "paketo-buildpacks/nginx" {
+					t.Fatalf("custom config still requires nginx buildpack, got %+v", bps)
+				}
+				got, err := os.ReadFile(configPath)
+				if err != nil || string(got) != string(config) {
+					t.Fatalf("project config changed: content=%q, err=%v", got, err)
+				}
+			})
+		}
+	})
+
+	t.Run("nginx config directory does not suppress generated defaults", func(t *testing.T) {
+		dir := t.TempDir()
+		if err := os.Mkdir(filepath.Join(dir, "nginx.conf"), 0755); err != nil {
+			t.Fatal(err)
+		}
+		ann := (&Builder{}).buildPlatformAnnotations(&build.Request{Lang: code.Static, SourceDir: dir})
+		if ann["cnb-bp-web-server"] != "nginx" || ann["cnb-bp-web-server-root"] != "." || ann["cnb-bp-web-server-enable-push-state"] != "true" {
+			t.Errorf("expected generated static defaults, got %v", ann)
+		}
+	})
 }
 
 // capability_id: rainbond.cnb.platform-volume
```

**File**: `builder/build/cnb/lang_static.go` (modified, +13/-4)
```diff
@@ -15,6 +15,17 @@ type staticConfig struct{}
 
 // BuildAnnotations configures nginx web server for static file serving.
 func (s *staticConfig) BuildAnnotations(re *build.Request, annotations map[string]string) {
+	applyDependencyMirrorAnnotation(annotations)
+
+	// BP_WEB_SERVER=nginx tells Paketo to overwrite nginx.conf with generated
+	// defaults. Without it, the nginx buildpack detects and uses the project file.
+	if re.SourceDir != "" {
+		if info, err := os.Stat(filepath.Join(re.SourceDir, "nginx.conf")); err == nil && info.Mode().IsRegular() {
+			logrus.Info("Pure static project: using project nginx.conf")
+			return
+		}
+	}
+
 	outputDir := re.BuildEnvs["CNB_OUTPUT_DIR"]
 	if outputDir == "" {
 		outputDir = "."
@@ -23,8 +34,6 @@ func (s *staticConfig) BuildAnnotations(re *build.Request, annotations map[strin
 	annotations["cnb-bp-web-server-root"] = outputDir
 	annotations["cnb-bp-web-server-enable-push-state"] = "true"
 
-	applyDependencyMirrorAnnotation(annotations)
-
 	logrus.Infof("Pure static project: nginx web server at '%s', mirror=%s", outputDir, annotations["cnb-bp-dependency-mirror"])
 }
 
@@ -47,7 +56,7 @@ func (s *staticConfig) CustomOrder(re *build.Request) []orderBuildpack {
 
 // isPureStaticProject checks if the source directory has no package.json.
 func isPureStaticProject(sourceDir string) bool {
-	packageJsonPath := filepath.Join(sourceDir, "package.json")
-	_, err := os.Stat(packageJsonPath)
+	packageJSONPath := filepath.Join(sourceDir, "package.json")
+	_, err := os.Stat(packageJSONPath)
 	return os.IsNotExist(err)
 }
```

---

### Incident Patch 14: `e01d7ccb` (2026-09-10)
**Commit Message**: fix: stop controllers that recreate custom resources

**File**: `api/handler/resource_deletion.go` (modified, +76/-3)
```diff
@@ -36,7 +36,10 @@ var (
 	crdGVR                               = schema.GroupVersionResource{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}
 )
 
-const appIDLabel = "app_id"
+const (
+	appIDLabel     = "app_id"
+	managedByLabel = "app.kubernetes.io/managed-by"
+)
 
 const finalDeletionCheckTimeout = 3 * time.Second
 
@@ -140,7 +143,8 @@ func (o *k8sResourceDeletionOrchestrator) Preview(ctx context.Context, req *mode
 	return &plan.impact, nil
 }
 
-// Delete removes dependent custom resources before ordinary resources and CRDs.
+// Delete stops in-application generators of non-finalized custom resources,
+// then removes dependent custom resources, ordinary resources, and CRDs.
 func (o *k8sResourceDeletionOrchestrator) Delete(ctx context.Context, req *model.K8sResourceDeletionRequest) (*model.K8sResourceDeletionResult, error) {
 	plan, err := o.buildPlan(ctx, req)
 	if err != nil {
@@ -150,12 +154,26 @@ func (o *k8sResourceDeletionOrchestrator) Delete(ctx context.Context, req *model
 		return nil, ErrCRDCascadeConfirmationRequired
 	}
 
+	deletedResources := make(map[int]struct{})
+	for _, index := range controllerResourcesToStopBeforeCustomResources(plan) {
+		propagation := metav1.DeletePropagationForeground
+		if err := o.deleteResourceAndWaitWithOptions(ctx, &plan.resources[index], metav1.DeleteOptions{
+			PropagationPolicy: &propagation,
+		}); err != nil {
+			return nil, err
+		}
+		deletedResources[index] = struct{}{}
+	}
+
 	for i := range plan.crds {
 		if err := o.deleteCustomResources(ctx, &plan.crds[i]); err != nil {
 			return nil, err
 		}
 	}
 	for i := range plan.resources {
+		if _, deleted := deletedResources[i]; deleted {
+			continue
+		}
 		resource := &plan.resources[i]
 		if resource.item.State != model.CreateSuccess && resource.item.State != model.UpdateSuccess {
 			continue
@@ -183,6 +201,57 @@ func (o *k8sResourceDeletionOrchestrator) Delete(ctx context.Context, req *model
 	return result, nil
 }
 
+func controllerResourcesToStopBeforeCustomResources(plan *k8sResourceDeletionPlan) []int {
+	candidateManagers := make(map[string]struct{})
+	finalizedManagers := make(map[string]struct{})
+	for i := range plan.crds {
+		for j := range plan.crds[i].instances {
+			instance := &plan.crds[i].instances[j]
+			manager := strings.ToLower(strings.TrimSpace(instance.GetLabels()[managedByLabel]))
+			if manager == "" {
+				continue
+			}
+			if len(instance.GetFinalizers()) > 0 {
+				finalizedManagers[manager] = struct{}{}
+				continue
+			}
+			candidateManagers[manager] = struct{}{}
+		}
+	}
+
+	var indexes []int
+	for i := range plan.resources {
+		resource := &plan.resources[i]
+		if resource.item.State != model.CreateSuccess && resource.item.State != model.UpdateSuccess ||
+			resource.apiRemoved || resource.object == nil || !isControllerWorkload(resource.object.GroupVersionKind()) {
+			continue
+		}
+		name := strings.ToLower(strings.TrimSpace(resource.object.GetName()))
+		if name == "" {
+			name = strings.ToLower(strings.TrimSpace(resource.item.Name))
+		}
+		if _, blocked := finalizedManagers[name]; blocked {
+			continue
+		}
+		if _, matched := candidateManagers[name]; matched {
+			indexes = append(indexes, i)
+		}
+	}
+	return indexes
+}
+
+func isControllerWorkload(gvk schema.GroupVersionKind) bool {
+	if gvk.Group != "apps" {
+		return false
+	}
+	switch gvk.Kind {
+	case "Deployment", "StatefulSet", "DaemonSet":
+		return true
+	default:
+		return false
+	}
+}
+
 // Reconcile classifies only confirmed missing resources as safe metadata deletions.
 func (o *k8sResourceDeletionOrchestrator) Reconcile(ctx context.Context, req *model.K8sResourceReconcileRequest) *model.K8sResourceReconcileResult {
 	result := &model.K8sResourceReconcileResult{}
@@ -381,12 +450,16 @@ func (o *k8sResourceDeletionOrchestrator) deleteCustomResources(ctx context.Cont
 }
 
 func (o *k8sResourceDeletionOrchestrator) deleteResourceAndWait(ctx context.Context, resource *plannedResource) error {
+	return o.deleteResourceAndWaitWithOptions(ctx, resource, metav1.DeleteOptions{})
+}
+
+func (o *k8sResourceDeletionOrchestrator) deleteResourceAndWaitWithOptions(ctx context.Context, resource *plannedResource, options metav1.DeleteOptions) error {
 	name := resource.item.Name
 	if name == "" {
 		name = resource.object.GetName()
 	}
 	client := o.resourceClient(resource.mapping, resource.item.Namespace, resource.object.GetNamespace())
-	if err := client.Delete(ctx, name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
+	if err := client.Delete(ctx, name, options); err != nil && !apierrors.IsNotFound(err) {
 		return fmt.Errorf("delete %s/%s: %w", resource.object.GetKind(), name, err)
 	}
 	var checkErr error
```

**File**: `api/handler/resource_deletion_test.go` (modified, +189/-3)
```diff
@@ -24,9 +24,11 @@ import (
 )
 
 var (
-	testCRDGVR    = schema.GroupVersionResource{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}
-	testWidgetGVR = schema.GroupVersionResource{Group: "example.com", Version: "v1", Resource: "widgets"}
-	testConfigGVR = schema.GroupVersionResource{Version: "v1", Resource: "configmaps"}
+	testCRDGVR        = schema.GroupVersionResource{Group: "apiextensions.k8s.io", Version: "v1", Resource: "customresourcedefinitions"}
+	testWidgetGVR     = schema.GroupVersionResource{Group: "example.com", Version: "v1", Resource: "widgets"}
+	testReportGVR     = schema.GroupVersionResource{Group: "aquasecurity.github.io", Version: "v1alpha1", Resource: "clusterconfigauditreports"}
+	testConfigGVR     = schema.GroupVersionResource{Version: "v1", Resource: "configmaps"}
+	testDeploymentGVR = schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}
 )
 
 func TestK8sResourceDeletionPreviewRequiresCascadeForOtherApplications(t *testing.T) {
@@ -235,6 +237,66 @@ func TestK8sResourceDeletionDeletesAndConfirmsOrdinaryResource(t *testing.T) {
 	}
 }
 
+// capability_id: rainbond.k8s-resource.stop-recreating-controller
+func TestK8sResourceDeletionStopsManagedControllerBeforeGeneratedResources(t *testing.T) {
+	orchestrator, client := newRecreatingControllerTestOrchestrator(t, false)
+	client.PrependReactor("delete", testReportGVR.Resource, func(action ktesting.Action) (bool, runtime.Object, error) {
+		deleteAction := action.(ktesting.DeleteAction)
+		if err := client.Tracker().Delete(testReportGVR, "", deleteAction.GetName()); err != nil {
+			return true, nil, err
+		}
+		if _, err := client.Tracker().Get(testDeploymentGVR, "rbd-plugins", "trivy-operator"); err == nil {
+			recreated := newTestGeneratedReport("recreated-report", false)
+			if err := client.Tracker().Add(recreated); err != nil {
+				return true, nil, err
+			}
+		}
+		return true, nil, nil
+	})
+
+	result, err := orchestrator.Delete(context.Background(), newGeneratedReportDeletionRequest())
+	if err != nil {
+		t.Fatalf("Delete() error = %v", err)
+	}
+	if result.Status != "completed" {
+		t.Fatalf("Delete() result = %#v, want completed", result)
+	}
+
+	var deletedResources []string
+	for _, action := range client.Actions() {
+		if action.GetVerb() == "delete" {
+			deletedResources = append(deletedResources, action.GetResource().Resource)
+		}
+	}
+	want := []string{"deployments", "clusterconfigauditreports", "customresourcedefinitions"}
+	if fmt.Sprint(deletedResources) != fmt.Sprint(want) {
+		t.Fatalf("delete order = %v, want %v", deletedResources, want)
+	}
+}
+
+func TestK8sResourceDeletionKeepsControllerUntilFinalizedResourcesAreGone(t *testing.T) {
+	orchestrator, client := newRecreatingControllerTestOrchestrator(t, true)
+
+	result, err := orchestrator.Delete(context.Background(), newGeneratedReportDeletionRequest())
+	if err != nil {
+		t.Fatalf("Delete() error = %v", err)
+	}
+	if result.Status != "completed" {
+		t.Fatalf("Delete() result = %#v, want completed", result)
+	}
+
+	var deletedResources []string
+	for _, action := range client.Actions() {
+		if action.GetVerb() == "delete" {
+			deletedResources = append(deletedResources, action.GetResource().Resource)
+		}
+	}
+	want := []string{"clusterconfigauditreports", "deployments", "customresourcedefinitions"}
+	if fmt.Sprint(deletedResources) != fmt.Sprint(want) {
+		t.Fatalf("delete order = %v, want %v", deletedResources, want)
+	}
+}
+
 // capability_id: rainbond.k8s-resource.metadata-reconcile
 func TestK8sResourceReconcileDistinguishesMissingAndUnknown(t *testing.T) {
 	orchestrator, client := newDeletionTestOrchestrator(t, newTestWidget("present", "team-a", "app-a"))
@@ -401,6 +463,130 @@ func newDeletionTestDynamicClient(t *testing.T, objects ...runtime.Object) *dyna
 	return client
 }
 
+func newRecreatingControllerTestOrchestrator(t *testing.T, finalized bool) (*k8sResourceDeletionOrchestrator, *dynamicfake.FakeDynamicClient) {
+	t.Helper()
+	client := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(
+		runtime.NewScheme(),
+		map[schema.GroupVersionResource]string{
+			testCRDGVR:        "CustomResourceDefinitionList",
+			testReportGVR:     "ClusterConfigAuditReportList",
+			testDeploymentGVR: "DeploymentList",
+		},
+		newTestGeneratedReportCRD(),
+		newTestGeneratedReport("persistentvolume-data", finalized),
+		newTestControllerDeployment(),
+	)
+	mapper := meta.NewDefaultRESTMapper([]schema.GroupVersion{
+		{Group: "apiextensions.k8s.io", Version: "v1"},
+		{Group: "aquasecurity.github.io", Version: "v1alpha1"},
+		{Group: "apps", Version: "v1"},
+	})
+	mapper.Add(schema.GroupVersionKind{Group: "apiextensions.k8s.io", Version: "v1", Kind: "CustomResourceDefinition"}, meta.RESTScopeRoot)
+	mapper.Add(schema.GroupVersionKind{Group: "aquasecurity.github.io", Version: "v1alpha1", Kind: "ClusterConfigAuditReport"}, meta.RESTScopeRoot)
+	mapper.Add(schema.GroupVersionKind{Group: "apps"
```

**File**: `test-manifest.json` (modified, +22/-0)
```diff
@@ -3469,6 +3469,28 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.k8s-resource.stop-recreating-controller",
+      "title": "Stop in-application controllers before deleting generated custom resources",
+      "title_zh": "Stop in-application controllers before deleting generated custom resources",
+      "interface_type": "handler_method",
+      "interface": "api/handler.k8sResourceDeletionOrchestrator.Delete",
+      "code_paths": [
+        "api/handler/resource_deletion.go"
+      ],
+      "tests": [
+        {
+          "path": "api/handler/resource_deletion_test.go",
+          "selector": "TestK8sResourceDeletionStopsManagedControllerBeforeGeneratedResources"
+        },
+        {
+          "path": "api/handler/resource_deletion_test.go",
+          "selector": "TestK8sResourceDeletionKeepsControllerUntilFinalizedResourcesAreGone"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.k8s.scheme-registers-kubevirt-vm",
       "title": "K8s scheme registers KubeVirt VirtualMachine",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -189,6 +189,7 @@
 | rainbond.k8s-resource.deletion-timeout-final-check | Kubernetes deletion timeout performs a final live check | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionFinalCheckAvoidsTimeoutRace |
 | rainbond.k8s-resource.failed-delete-metadata-only | Failed resources are metadata-only during deletion | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionSkipsFailedResourceKubernetesDeletion |
 | rainbond.k8s-resource.metadata-reconcile | Kubernetes resource metadata reconciliation | active | regression | api/handler.k8sResourceDeletionOrchestrator.Reconcile | api/handler/resource_deletion_test.go::TestK8sResourceReconcileDistinguishesMissingAndUnknown |
+| rainbond.k8s-resource.stop-recreating-controller | Stop in-application controllers before deleting generated custom resources | active | regression | api/handler.k8sResourceDeletionOrchestrator.Delete | api/handler/resource_deletion_test.go::TestK8sResourceDeletionStopsManagedControllerBeforeGeneratedResources<br>api/handler/resource_deletion_test.go::TestK8sResourceDeletionKeepsControllerUntilFinalizedResourcesAreGone |
 | rainbond.k8s.scheme-registers-kubevirt-vm | K8s scheme registers KubeVirt VirtualMachine | active | regression | pkg/component/k8s.init | pkg/component/k8s/k8sComponent_test.go::TestSchemeRegistersKubeVirtVirtualMachine |
 | rainbond.kubeblocks.component-selector | 为 KubeBlocks 组件生成标签选择器 | active | regression | util/kubeblocks.GenerateKubeBlocksSelector | util/kubeblocks/kubeblocks_test.go::TestGenerateKubeBlocksSelector |
 | rainbond.license.decode | 解码并解析许可证令牌内容 | active | regression | api/util/license.DecodeLicense | api/util/license/rsa_license_test.go::TestDecodeLicense |
@@ -2338,6 +2339,16 @@
 - 代码路径: `api/handler/resource_deletion.go`
 - 测试路径: `api/handler/resource_deletion_test.go::TestK8sResourceReconcileDistinguishesMissingAndUnknown`
 
+### Stop in-application controllers before deleting generated custom resources
+
+- Capability ID: `rainbond.k8s-resource.stop-recreating-controller`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `handler_method`
+- 业务入口: `api/handler.k8sResourceDeletionOrchestrator.Delete`
+- 代码路径: `api/handler/resource_deletion.go`
+- 测试路径: `api/handler/resource_deletion_test.go::TestK8sResourceDeletionStopsManagedControllerBeforeGeneratedResources`, `api/handler/resource_deletion_test.go::TestK8sResourceDeletionKeepsControllerUntilFinalizedResourcesAreGone`
+
 ### K8s scheme registers KubeVirt VirtualMachine
 
 - Capability ID: `rainbond.k8s.scheme-registers-kubevirt-vm`
```

---

### Incident Patch 15: `4f58eeb8` (2026-09-10)
**Commit Message**: Revert "feat: manage APISIX JWT consumers"

This reverts commit 4ffab94801ac6975eeda50add71bb23815e56179.

**File**: `api/api/api_interface.go` (modified, +0/-9)
```diff
@@ -324,20 +324,11 @@ type RegistryInterface interface {
 // GatewayInterface api gateway interface
 type GatewayInterface interface {
 	GatewayRouteInterface
-	GatewayConsumerInterface
 	GatewayServiceInterface
 	GatewayCertInterface
 	GatewayLoadBalancerInterface
 }
 
-// GatewayConsumerInterface defines managed APISIX Consumer operations.
-type GatewayConsumerInterface interface {
-	ListGatewayJWTConsumers(w http.ResponseWriter, r *http.Request)
-	CreateGatewayJWTConsumer(w http.ResponseWriter, r *http.Request)
-	RotateGatewayJWTConsumer(w http.ResponseWriter, r *http.Request)
-	DeleteGatewayJWTConsumer(w http.ResponseWriter, r *http.Request)
-}
-
 // GatewayRouteInterface api gateway route interface
 type GatewayRouteInterface interface {
 	GetHTTPBindDomains(w http.ResponseWriter, r *http.Request)
```

**File**: `api/api_routers/gateway/gateway.go` (modified, +0/-20)
```diff
@@ -1,20 +1,11 @@
 package gateway
 
 import (
-	"net/http"
-
 	"github.com/go-chi/chi"
 	"github.com/goodrain/rainbond/api/controller"
 	"github.com/goodrain/rainbond/api/middleware"
 )
 
-type gatewayConsumerController interface {
-	ListGatewayJWTConsumers(http.ResponseWriter, *http.Request)
-	CreateGatewayJWTConsumer(http.ResponseWriter, *http.Request)
-	RotateGatewayJWTConsumer(http.ResponseWriter, *http.Request)
-	DeleteGatewayJWTConsumer(http.ResponseWriter, *http.Request)
-}
-
 // Routes -
 func Routes() chi.Router {
 	r := chi.NewRouter()
@@ -51,10 +42,6 @@ func Routes() chi.Router {
 		r.Delete("/{name}", controller.GetManager().DeleteTCPRoute)
 	})
 
-	r.Route("/consumers", func(r chi.Router) {
-		registerGatewayConsumerRoutes(r, controller.GetManager())
-	})
-
 	// 关于目标服务的接口
 	r.Route("/service", func(r chi.Router) {
 		r.Get("/", controller.GetManager().GetAPIService)
@@ -70,10 +57,3 @@ func Routes() chi.Router {
 
 	return r
 }
-
-func registerGatewayConsumerRoutes(r chi.Router, consumerController gatewayConsumerController) {
-	r.Get("/", consumerController.ListGatewayJWTConsumers)
-	r.Post("/", consumerController.CreateGatewayJWTConsumer)
-	r.Post("/{name}/credentials", consumerController.RotateGatewayJWTConsumer)
-	r.Delete("/{name}", consumerController.DeleteGatewayJWTConsumer)
-}
```

**File**: `api/api_routers/gateway/gateway_test.go` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-package gateway
-
-import (
-	"net/http"
-	"net/http/httptest"
-	"testing"
-
-	"github.com/go-chi/chi"
-)
-
-type gatewayConsumerControllerStub struct {
-	called string
-}
-
-func (s *gatewayConsumerControllerStub) ListGatewayJWTConsumers(w http.ResponseWriter, _ *http.Request) {
-	s.called = "list"
-	w.WriteHeader(http.StatusNoContent)
-}
-
-func (s *gatewayConsumerControllerStub) CreateGatewayJWTConsumer(w http.ResponseWriter, _ *http.Request) {
-	s.called = "create"
-	w.WriteHeader(http.StatusNoContent)
-}
-
-func (s *gatewayConsumerControllerStub) RotateGatewayJWTConsumer(w http.ResponseWriter, _ *http.Request) {
-	s.called = "rotate"
-	w.WriteHeader(http.StatusNoContent)
-}
-
-func (s *gatewayConsumerControllerStub) DeleteGatewayJWTConsumer(w http.ResponseWriter, _ *http.Request) {
-	s.called = "delete"
-	w.WriteHeader(http.StatusNoContent)
-}
-
-func TestGatewayConsumerRoutes(t *testing.T) {
-	tests := []struct {
-		name       string
-		method     string
-		path       string
-		wantCalled string
-	}{
-		{name: "list", method: http.MethodGet, path: "/consumers/", wantCalled: "list"},
-		{name: "create", method: http.MethodPost, path: "/consumers/", wantCalled: "create"},
-		{name: "rotate", method: http.MethodPost, path: "/consumers/orders/credentials", wantCalled: "rotate"},
-		{name: "delete", method: http.MethodDelete, path: "/consumers/orders", wantCalled: "delete"},
-	}
-
-	for _, test := range tests {
-		t.Run(test.name, func(t *testing.T) {
-			stub := &gatewayConsumerControllerStub{}
-			router := chi.NewRouter()
-			router.Route("/consumers", func(r chi.Router) {
-				registerGatewayConsumerRoutes(r, stub)
-			})
-			recorder := httptest.NewRecorder()
-			router.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, nil))
-
-			if recorder.Code != http.StatusNoContent || stub.called != test.wantCalled {
-				t.Fatalf("%s %s: status=%d called=%q, want status=%d called=%q", test.method, test.path, recorder.Code, stub.called, http.StatusNoContent, test.wantCalled)
-			}
-		})
-	}
-}
```

**File**: `api/controller/apigateway/api_gateway_consumer.go` (removed, +0/-138)
```diff
@@ -1,138 +0,0 @@
-package apigateway
-
-import (
-	"errors"
-	"net/http"
-
-	"github.com/go-chi/chi"
-	"github.com/goodrain/rainbond/api/handler"
-	apimodel "github.com/goodrain/rainbond/api/model"
-	ctxutil "github.com/goodrain/rainbond/api/util/ctx"
-	dbmodel "github.com/goodrain/rainbond/db/model"
-	httputil "github.com/goodrain/rainbond/util/http"
-	"github.com/sirupsen/logrus"
-	k8serrors "k8s.io/apimachinery/pkg/api/errors"
-)
-
-var getAPIGatewayHandler = handler.GetAPIGatewayHandler
-
-// ListGatewayJWTConsumers lists JWT Consumers visible to the requested app.
-// Credential material is projected out by the handler before it reaches this
-// controller.
-func (g Struct) ListGatewayJWTConsumers(w http.ResponseWriter, r *http.Request) {
-	tenant := r.Context().Value(ctxutil.ContextKey("tenant")).(*dbmodel.Tenants)
-	consumers, err := getAPIGatewayHandler().ListGatewayJWTConsumers(r.Context(), tenant.Namespace, r.URL.Query().Get("appID"))
-	if err != nil {
-		returnGatewayJWTConsumerError(r, w, err)
-		return
-	}
-	httputil.ReturnSuccess(r, w, consumers)
-}
-
-// CreateGatewayJWTConsumer creates a Rainbond-managed Consumer and credential.
-func (g Struct) CreateGatewayJWTConsumer(w http.ResponseWriter, r *http.Request) {
-	tenant := r.Context().Value(ctxutil.ContextKey("tenant")).(*dbmodel.Tenants)
-	var req apimodel.GatewayJWTConsumerRequest
-	if !httputil.ValidatorRequestStructAndErrorResponse(r, w, &req, nil) {
-		return
-	}
-	consumer, err := getAPIGatewayHandler().CreateGatewayJWTConsumer(r.Context(), tenant.Namespace, r.URL.Query().Get("appID"), &req)
-	if err != nil {
-		returnGatewayJWTConsumerError(r, w, err)
-		return
-	}
-	httputil.ReturnSuccess(r, w, consumer)
-}
-
-// RotateGatewayJWTConsumer replaces a managed Consumer's credential.
-func (g Struct) RotateGatewayJWTConsumer(w http.ResponseWriter, r *http.Request) {
-	tenant := r.Context().Value(ctxutil.ContextKey("tenant")).(*dbmodel.Tenants)
-	var req apimodel.GatewayJWTConsumerCredential
-	if !httputil.ValidatorRequestStructAndErrorResponse(r, w, &req, nil) {
-		return
-	}
-	consumer, err := getAPIGatewayHandler().RotateGatewayJWTConsumer(r.Context(), tenant.Namespace, chi.URLParam(r, "name"), &req)
-	if err != nil {
-		returnGatewayJWTConsumerError(r, w, err)
-		return
-	}
-	httputil.ReturnSuccess(r, w, consumer)
-}
-
-// DeleteGatewayJWTConsumer deletes an unbound Rainbond-managed Consumer.
-func (g Struct) DeleteGatewayJWTConsumer(w http.ResponseWriter, r *http.Request) {
-	tenant := r.Context().Value(ctxutil.ContextKey("tenant")).(*dbmodel.Tenants)
-	if err := getAPIGatewayHandler().DeleteGatewayJWTConsumer(r.Context(), tenant.Namespace, chi.URLParam(r, "name")); err != nil {
-		returnGatewayJWTConsumerError(r, w, err)
-		return
-	}
-	httputil.ReturnSuccess(r, w, nil)
-}
-
-func returnGatewayJWTConsumerError(r *http.Request, w http.ResponseWriter, err error) {
-	status := gatewayJWTConsumerErrorStatus(err)
-	if status == http.StatusInternalServerError {
-		// Do not log the wrapped error here: upstream errors may include Secret
-		// field values. The public response and this log remain credential-safe.
-		logrus.Errorf("gateway JWT consumer operation failed, path: %s", r.URL.Path)
-	}
-	httputil.ReturnError(r, w, status, gatewayJWTConsumerPublicError(err))
-}
-
-func gatewayJWTConsumerErrorStatus(err error) int {
-	switch {
-	case errors.Is(err, handler.ErrGatewayJWTConsumerInvalidName),
-		errors.Is(err, handler.ErrGatewayJWTConsumerInvalidCredential),
-		errors.Is(err, handler.ErrGatewayJWTAuthInvalidConfig),
-		errors.Is(err, handler.ErrGatewayJWTConsumerRequired),
-		errors.Is(err, handler.ErrGatewayJWTConsumerNotJWT),
-		k8serrors.IsBadRequest(err),
-		k8serrors.IsInvalid(err):
-		return http.StatusBadRequest
-	case errors.Is(err, handler.ErrGatewayJWTConsumerNotManaged),
-		errors.Is(err, handler.ErrGatewayJWTConsumerAppMismatch),
-		k8serrors.IsForbidden(err):
-		return http.StatusForbidden
-	case k8serrors.IsNotFound(err):
-		return http.StatusNotFound
-	case errors.Is(err, handler.ErrGatewayJWTConsumerInUse),
-		k8serrors.IsAlreadyExists(err),
-		k8serrors.IsConflict(err):
-		return http.StatusConflict
-	default:
-		return http.StatusInternalServerError
-	}
-}
-
-func gatewayJWTConsumerPublicError(err error) string {
-	switch {
-	case errors.Is(err, handler.ErrGatewayJWTConsumerInvalidName):
-		return handler.ErrGatewayJWTConsumerInvalidName.Error()
-	case errors.Is(err, handler.ErrGatewayJWTConsumerInvalidCredential):
-		return handler.ErrGatewayJWTConsumerInvalidCredential.Error()
-	case errors.Is(err, handler.ErrGatewayJWTAuthInvalidConfig):
-		return handler.ErrGatewayJWTAuthInvalidConfig.Error()
-	case errors.Is(err, handler.ErrGatewayJWTConsumerRequired):
-		return handler.ErrGatewayJWTConsumerRequired.Error()
-	case errors.Is(err, handler.ErrGatewayJWTConsumerNotJWT):
-		return handler.ErrGatewayJWTConsumerNotJWT.Error()
-	case errors.Is(err, handler.ErrGatewayJWTConsumerNotManaged):
-		return handler.ErrGatewayJW
```

**File**: `api/controller/apigateway/api_gateway_consumer_test.go` (removed, +0/-522)
```diff
@@ -1,522 +0,0 @@
-package apigateway
-
-import (
-	"bytes"
-	"context"
-	"encoding/json"
-	"errors"
-	"fmt"
-	"net/http"
-	"net/http/httptest"
-	"reflect"
-	"strings"
-	"testing"
-
-	v2 "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/apis/config/v2"
-	apisixfake "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/client/clientset/versioned/fake"
-	"github.com/go-chi/chi"
-	"github.com/goodrain/rainbond/api/handler"
-	apimodel "github.com/goodrain/rainbond/api/model"
-	ctxutil "github.com/goodrain/rainbond/api/util/ctx"
-	dbmodel "github.com/goodrain/rainbond/db/model"
-	k8serrors "k8s.io/apimachinery/pkg/api/errors"
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	"k8s.io/apimachinery/pkg/runtime/schema"
-)
-
-type gatewayJWTConsumerHandlerStub struct {
-	handler.APIGatewayHandler
-
-	configureCalls int
-	namespace      string
-	appID          string
-	auth           *apimodel.ManagedJWTAuthentication
-	createCalls    int
-	createErr      error
-	listCalls      int
-	rotateCalls    int
-	deleteCalls    int
-	lastName       string
-	lastNamespace  string
-	lastAppID      string
-	listResult     []*apimodel.GatewayJWTConsumer
-	rotateResult   *apimodel.GatewayJWTConsumer
-}
-
-func (s *gatewayJWTConsumerHandlerStub) ConfigureManagedJWTAuth(_ context.Context, namespace, appID string, auth *apimodel.ManagedJWTAuthentication, plugins []v2.ApisixRoutePlugin) ([]v2.ApisixRoutePlugin, error) {
-	s.configureCalls++
-	s.namespace = namespace
-	s.appID = appID
-	s.auth = auth
-	return handler.BuildManagedJWTPlugins(namespace, auth.ConsumerNames, auth.Config, plugins), nil
-}
-
-func (s *gatewayJWTConsumerHandlerStub) CreateGatewayJWTConsumer(_ context.Context, _, _ string, _ *apimodel.GatewayJWTConsumerRequest) (*apimodel.GatewayJWTConsumer, error) {
-	s.createCalls++
-	return nil, s.createErr
-}
-
-func (s *gatewayJWTConsumerHandlerStub) ListGatewayJWTConsumers(_ context.Context, namespace, appID string) ([]*apimodel.GatewayJWTConsumer, error) {
-	s.listCalls++
-	s.lastNamespace = namespace
-	s.lastAppID = appID
-	return s.listResult, nil
-}
-
-func (s *gatewayJWTConsumerHandlerStub) RotateGatewayJWTConsumer(_ context.Context, namespace, name string, _ *apimodel.GatewayJWTConsumerCredential) (*apimodel.GatewayJWTConsumer, error) {
-	s.rotateCalls++
-	s.lastNamespace = namespace
-	s.lastName = name
-	return s.rotateResult, nil
-}
-
-func (s *gatewayJWTConsumerHandlerStub) DeleteGatewayJWTConsumer(_ context.Context, namespace, name string) error {
-	s.deleteCalls++
-	s.lastNamespace = namespace
-	s.lastName = name
-	return nil
-}
-
-// capability_id: rainbond.gateway.jwt-consumer-api
-func TestGatewayHTTPRouteRequestBackwardCompatibility(t *testing.T) {
-	legacyJSON := []byte(`{
-		"name":"legacy-route",
-		"priority":9,
-		"match":{"hosts":["legacy.example.com"],"paths":["/*"]},
-		"plugins":[{"name":"jwt-auth","enable":true,"config":{"header":"authorization"},"secretRef":""}],
-		"websocket":true
-	}`)
-
-	var request apimodel.GatewayHTTPRouteRequest
-	if err := json.Unmarshal(legacyJSON, &request); err != nil {
-		t.Fatalf("decode legacy HTTP route request: %v", err)
-	}
-	if request.ManagedJWTAuth != nil {
-		t.Fatalf("ManagedJWTAuth = %#v, want nil for legacy request", request.ManagedJWTAuth)
-	}
-	if request.Name != "legacy-route" || request.Priority != 9 || !request.Websocket {
-		t.Fatalf("decoded legacy route = %#v", request.ApisixRouteHTTP)
-	}
-	if len(request.Plugins) != 1 || request.Plugins[0].Name != "jwt-auth" {
-		t.Fatalf("legacy plugins = %#v, want unchanged jwt-auth plugin", request.Plugins)
-	}
-
-	stub := &gatewayJWTConsumerHandlerStub{}
-	labels := map[string]string{"creator": "Rainbond"}
-	wantPlugins := append([]v2.ApisixRoutePlugin(nil), request.Plugins...)
-	if err := configureManagedJWTHTTPRoute(context.Background(), stub, "team-a", "app-1", &request, labels); err != nil {
-		t.Fatalf("configure legacy request: %v", err)
-	}
-	if stub.configureCalls != 0 {
-		t.Fatalf("ConfigureManagedJWTAuth calls = %d, want 0", stub.configureCalls)
-	}
-	if !reflect.DeepEqual(request.Plugins, wantPlugins) {
-		t.Fatalf("legacy plugins = %#v, want %#v", request.Plugins, wantPlugins)
-	}
-	if _, ok := labels[gatewayJWTManagedRouteLabel]; ok {
-		t.Fatalf("legacy request added managed label: %#v", labels)
-	}
-
-	existingPlugins := handler.BuildManagedJWTPlugins(
-		"team-a",
-		[]string{"orders"},
-		v2.ApisixRoutePluginConfig{"header": "x-managed-jwt"},
-		nil,
-	)
-	existingRoute := &v2.ApisixRoute{
-		ObjectMeta: metav1.ObjectMeta{
-			Namespace: "team-a",
-			Labels: map[string]string{
-				gatewayJWTManagedRouteLabel: gatewayJWTManagedRouteValue,
-			},
-		},
-		Spec: v2.ApisixRouteSpec{HTTP: []v2.ApisixRouteHTTP{{Plugins: existingPlugins}}},
-	}
-	preserveLegacyManagedJWTHTTPRoute(&request, labels, existingRoute)
-	if labels[gatewayJWTManagedRouteLabel] != gatewayJWTManagedRouteValue {
-		t.Fatalf("legacy update did not preserve managed marker: %#v", labels)
-	}
-	if !reflect.Dee
```

**File**: `api/controller/apigateway/api_gateway_route.go` (modified, +34/-225)
```diff
@@ -42,18 +42,6 @@ import (
 	"sigs.k8s.io/yaml"
 )
 
-const (
-	gatewayJWTManagedRouteLabel = "gateway.rainbond.io/managed-jwt"
-	gatewayJWTManagedRouteValue = "true"
-)
-
-type gatewayHTTPRouteResponse struct {
-	*v2.ApisixRouteHTTP
-	Enabled        bool                               `json:"enabled"`
-	RegionAppID    string                             `json:"region_app_id"`
-	ManagedJWTAuth *apimodel.ManagedJWTAuthentication `json:"managedJwtAuth,omitempty"`
-}
-
 // OpenOrCloseDomains -
 func (g Struct) OpenOrCloseDomains(w http.ResponseWriter, r *http.Request) {
 	c := k8s.Default().ApiSixClient.ApisixV2()
@@ -173,6 +161,14 @@ func (g Struct) GetTCPBindDomains(w http.ResponseWriter, r *http.Request) {
 func (g Struct) GetHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 	tenant := r.Context().Value(ctxutil.ContextKey("tenant")).(*dbmodel.Tenants)
 
+	type routeResponse struct {
+		*v2.ApisixRouteHTTP
+		Enabled     bool   `json:"enabled"`
+		RegionAppID string `json:"region_app_id"`
+	}
+
+	var resp = make([]*routeResponse, 0)
+
 	c := k8s.Default().ApiSixClient.ApisixV2()
 	appID := r.URL.Query().Get("appID")
 	labelSelector := ""
@@ -188,46 +184,31 @@ func (g Struct) GetHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 
-	httputil.ReturnSuccess(r, w, gatewayHTTPRouteResponses(list.Items))
-}
-
-func gatewayHTTPRouteResponseFrom(route *v2.ApisixRoute) *gatewayHTTPRouteResponse {
-	if route == nil || len(route.Spec.HTTP) == 0 {
-		return nil
-	}
-	httpRoute := route.Spec.HTTP[0].DeepCopy()
-	serviceAliases := ""
-	regionAppID := ""
-	enabled := false
-	for labelKey, labelValue := range route.Labels {
-		if labelValue == "service_alias" {
-			serviceAliases += "-" + labelKey
-		}
-		if labelKey == "app_id" {
-			regionAppID = labelValue
-		}
-		if labelKey == "cert-manager-enabled" {
-			enabled = labelValue == "true"
-		}
-	}
-	httpRoute.Name = regionAppID + "|" + route.Name + "|" + serviceAliases
-	return &gatewayHTTPRouteResponse{
-		ApisixRouteHTTP: httpRoute,
-		Enabled:         enabled,
-		RegionAppID:     regionAppID,
-		ManagedJWTAuth:  handler.ManagedJWTAuthenticationFromRoute(route),
-	}
-}
-
-func gatewayHTTPRouteResponses(routes []v2.ApisixRoute) []*gatewayHTTPRouteResponse {
-	responses := make([]*gatewayHTTPRouteResponse, 0, len(routes))
-	for i := range routes {
-		response := gatewayHTTPRouteResponseFrom(&routes[i])
-		if response != nil {
-			responses = append(responses, response)
+	for _, v := range list.Items {
+		httpRoute := v.Spec.HTTP[0].DeepCopy()
+		labels := v.Labels
+		serviceAliases := ""
+		regionAppID := ""
+		enabled := false // Default to enabled if not specified
+		for labelK, labelV := range labels {
+			if labelV == "service_alias" {
+				serviceAliases = serviceAliases + "-" + labelK
+			}
+			if labelK == "app_id" {
+				regionAppID = labelV
+			}
+			if labelK == "cert-manager-enabled" {
+				enabled = labelV == "true"
+			}
 		}
+		httpRoute.Name = regionAppID + "|" + v.Name + "|" + serviceAliases
+		resp = append(resp, &routeResponse{
+			ApisixRouteHTTP: httpRoute,
+			Enabled:         enabled,
+			RegionAppID:     regionAppID,
+		})
 	}
-	return responses
+	httputil.ReturnSuccess(r, w, resp)
 }
 
 // UpdateHTTPAPIRoute -
@@ -255,12 +236,8 @@ func addResponseRewritePlugin(apisixRouteHTTP v2.ApisixRouteHTTP) v2.ApisixRoute
 func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 
 	tenant := r.Context().Value(ctxutil.ContextKey("tenant")).(*dbmodel.Tenants)
-	var routeRequest apimodel.GatewayHTTPRouteRequest
-	if !httputil.ValidatorRequestStructAndErrorResponse(r, w, &routeRequest, nil) {
-		return
-	}
-	if err := validateGatewayHTTPRouteRequest(&routeRequest); err != nil {
-		httputil.ReturnError(r, w, http.StatusBadRequest, err.Error())
+	var apisixRouteHTTP v2.ApisixRouteHTTP
+	if !httputil.ValidatorRequestStructAndErrorResponse(r, w, &apisixRouteHTTP, nil) {
 		return
 	}
 	sa := r.URL.Query().Get("service_alias")
@@ -277,10 +254,6 @@ func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 	if r.URL.Query().Get("appID") != "" {
 		labels["app_id"] = r.URL.Query().Get("appID")
 	}
-	if err := configureManagedJWTHTTPRoute(r.Context(), getAPIGatewayHandler(), tenant.Namespace, r.URL.Query().Get("appID"), &routeRequest, labels); err != nil {
-		returnGatewayJWTConsumerError(r, w, err)
-		return
-	}
 	defaultDomain := r.URL.Query().Get("default") == "true"
 
 	for _, sl := range sLabel {
@@ -290,18 +263,6 @@ func (g Struct) CreateHTTPAPIRoute(w http.ResponseWriter, r *http.Request) {
 	}
 
 	c := k8s.Default().ApiSixClient.ApisixV2()
-	if err := preserveManagedJWTHTTPRouteLabelBeforeCreate(
-		r.Context(),
-		c.ApisixRoutes(tenant.Namespace),
-		&routeRequest,
-		labels,
-		r.URL.Query().Get("name"),
-	); err != nil {
-		logrus.Errorf("get previous route before replacement: %v", err)
-		httputil.ReturnBcodeError(r, w, bcode.ErrRouteNotFound)
-		return
-	}
-	apisixRouteHTTP := routeRequest.ApisixR
```

**File**: `api/handler/gateway_handler.go` (modified, +0/-8)
```diff
@@ -19,9 +19,6 @@
 package handler
 
 import (
-	"context"
-
-	v2 "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/apis/config/v2"
 	apisixversioned "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/client/clientset/versioned"
 	apimodel "github.com/goodrain/rainbond/api/model"
 	dbmodel "github.com/goodrain/rainbond/db/model"
@@ -86,9 +83,4 @@ type APIGatewayHandler interface {
 	GetClient() apisixversioned.Interface
 	GetK8sClient() kubernetes.Interface
 	CreateCert(namespace, domain string) error
-	ListGatewayJWTConsumers(ctx context.Context, namespace, appID string) ([]*apimodel.GatewayJWTConsumer, error)
-	CreateGatewayJWTConsumer(ctx context.Context, namespace, appID string, req *apimodel.GatewayJWTConsumerRequest) (*apimodel.GatewayJWTConsumer, error)
-	RotateGatewayJWTConsumer(ctx context.Context, namespace, name string, req *apimodel.GatewayJWTConsumerCredential) (*apimodel.GatewayJWTConsumer, error)
-	DeleteGatewayJWTConsumer(ctx context.Context, namespace, name string) error
-	ConfigureManagedJWTAuth(ctx context.Context, namespace, appID string, auth *apimodel.ManagedJWTAuthentication, plugins []v2.ApisixRoutePlugin) ([]v2.ApisixRoutePlugin, error)
 }
```

**File**: `api/handler/gateway_jwt_consumer.go` (removed, +0/-819)
```diff
@@ -1,819 +0,0 @@
-package handler
-
-import (
-	"context"
-	"crypto/rand"
-	"encoding/base64"
-	"errors"
-	"fmt"
-	"sort"
-	"strconv"
-	"strings"
-
-	v2 "github.com/apache/apisix-ingress-controller/pkg/kube/apisix/apis/config/v2"
-	apimodel "github.com/goodrain/rainbond/api/model"
-	apiutil "github.com/goodrain/rainbond/api/util"
-	corev1 "k8s.io/api/core/v1"
-	k8serrors "k8s.io/apimachinery/pkg/api/errors"
-	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
-	k8slabels "k8s.io/apimachinery/pkg/labels"
-	"k8s.io/apimachinery/pkg/types"
-	"k8s.io/apimachinery/pkg/util/validation"
-)
-
-const (
-	gatewayJWTAlgorithmHS256     = "HS256"
-	gatewayJWTAlgorithmHS512     = "HS512"
-	gatewayJWTAlgorithmRS256     = "RS256"
-	gatewayJWTDefaultExpiration  = 86400
-	gatewayJWTMinimumSecretBytes = 32
-
-	gatewayJWTAuthPluginName             = "jwt-auth"
-	gatewayConsumerRestrictionPluginName = "consumer-restriction"
-
-	gatewayJWTManagedByLabel        = "gateway.rainbond.io/managed-by"
-	gatewayJWTAuthTypeLabel         = "gateway.rainbond.io/auth-type"
-	gatewayJWTManagedRouteLabel     = "gateway.rainbond.io/managed-jwt"
-	gatewayJWTManagedValue          = "rainbond"
-	gatewayJWTAuthTypeValue         = "jwt"
-	gatewayJWTManagedRouteValue     = "true"
-	gatewayJWTExternalSource        = "external"
-	gatewayJWTConsumerStatusPending = "pending"
-
-	gatewayJWTSecretDataKey                 = "key"
-	gatewayJWTSecretDataSecret              = "secret"
-	gatewayJWTSecretDataPublicKey           = "public_key"
-	gatewayJWTSecretDataPrivateKey          = "private_key"
-	gatewayJWTSecretDataAlgorithm           = "algorithm"
-	gatewayJWTSecretDataExp                 = "exp"
-	gatewayJWTSecretDataBase64Secret        = "base64_secret"
-	gatewayJWTSecretDataLifetimeGracePeriod = "lifetime_grace_period"
-
-	gatewayJWTGeneratedSecretBytes = 32
-	gatewayJWTSecretNamePrefix     = "rbd-jwt-"
-	gatewayJWTIngressClassName     = "apisix"
-	gatewayJWTApplicationLabel     = "app_id"
-)
-
-var (
-	// ErrGatewayJWTConsumerInvalidName indicates that a Consumer cannot be
-	// represented safely as Kubernetes resources.
-	ErrGatewayJWTConsumerInvalidName = errors.New("gateway JWT consumer name is invalid")
-	// ErrGatewayJWTConsumerInvalidCredential identifies credential input that
-	// cannot be persisted as a supported APISIX JWT credential.
-	ErrGatewayJWTConsumerInvalidCredential = errors.New("gateway JWT consumer credential is invalid")
-	// ErrGatewayJWTConsumerNotManaged protects externally owned credentials
-	// from mutation through Rainbond's managed Consumer endpoints.
-	ErrGatewayJWTConsumerNotManaged = errors.New("gateway JWT consumer is not managed by Rainbond")
-	// ErrGatewayJWTConsumerInUse protects a Consumer referenced by a route.
-	ErrGatewayJWTConsumerInUse = errors.New("gateway JWT consumer is bound to one or more routes")
-	// ErrGatewayJWTConsumerRequired indicates that managed JWT auth has no
-	// Consumer selection.
-	ErrGatewayJWTConsumerRequired = errors.New("at least one gateway JWT consumer is required")
-	// ErrGatewayJWTConsumerNotJWT indicates a selected Consumer that cannot
-	// satisfy jwt-auth.
-	ErrGatewayJWTConsumerNotJWT = errors.New("gateway consumer does not define JWT authentication")
-	// ErrGatewayJWTConsumerAppMismatch prevents an application from binding a
-	// managed Consumer owned by another application.
-	ErrGatewayJWTConsumerAppMismatch = errors.New("gateway JWT consumer belongs to another application")
-	// ErrGatewayJWTAuthInvalidConfig identifies unsafe or unsupported route
-	// plugin fields in managed JWT authentication.
-	ErrGatewayJWTAuthInvalidConfig = errors.New("managed gateway JWT authentication config is invalid")
-
-	errGatewayJWTConsumerCredentialRequired = fmt.Errorf("%w: credential is required", ErrGatewayJWTConsumerInvalidCredential)
-	errGatewayJWTConsumerKeyRequired        = fmt.Errorf("%w: key is required", ErrGatewayJWTConsumerInvalidCredential)
-)
-
-// ListGatewayJWTConsumers returns safe metadata for JWT-capable Consumers.
-// Secret and in-place credential material are never copied into the response.
-func (g *GatewayAction) ListGatewayJWTConsumers(ctx context.Context, namespace, appID string) ([]*apimodel.GatewayJWTConsumer, error) {
-	consumers, err := g.apisixClient.ApisixV2().ApisixConsumers(namespace).List(ctx, metav1.ListOptions{})
-	if err != nil {
-		return nil, fmt.Errorf("list APISIX consumers in namespace %q: %w", namespace, err)
-	}
-	routes, err := g.apisixClient.ApisixV2().ApisixRoutes(namespace).List(ctx, metav1.ListOptions{})
-	if err != nil {
-		return nil, fmt.Errorf("list APISIX routes in namespace %q: %w", namespace, err)
-	}
-	managedSecrets, err := g.listManagedGatewayJWTSecrets(ctx, namespace)
-	if err != nil {
-		return nil, err
-	}
-
-	result := make([]*apimodel.GatewayJWTConsumer, 0, len(consumers.Items))
-	for i := range consumers.Items {
-		consumer := &consumers.Items[i]
-		jwtAuth := consumer.Spec.AuthParameter.JwtAuth
-		if jwtAuth == nil {
-			cont
```

#### Recent Merged Pull Requests:
- **PR #2713** (2026-09-30): feat: inspect retired build versions (@RainBondsongyg)
- **PR #2712** (2026-09-30): feat: mount runtime for node inventory (@RainBondsongyg)
- **PR #2710** (2026-09-28): feat: measure upload packages separately from chunks (@RainBondsongyg)
- **PR #2709** (2026-09-27): fix: reject admission changes to cleanup executor authority (@RainBondsongyg)
- **PR #2708** (2026-09-27): fix: reject admission changes to cleanup executor authority (@RainBondsongyg)
- **PR #2707** (2026-09-27): Feat/cleanup version retirement (@RainBondsongyg)
- **PR #2706** (2026-09-29): fix: prevent index file download redirects (@zzzhangqi)
- **PR #2704** (2026-09-20): fix: tolerate dedicated node taints in source builds (@zzzhangqi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
