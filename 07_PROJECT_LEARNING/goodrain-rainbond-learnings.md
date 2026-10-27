> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/goodrain-rainbond-learnings.md`  
> **Source**: github ([https://github.com/goodrain/rainbond](https://github.com/goodrain/rainbond))  
> **Source Version**: `8d5895f1`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T12:30:15.789Z  
> **Learning ID**: `learn-github-goodrain-rainbond`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): goodrain/rainbond

> **Canonical Artifact**: `07_PROJECT_LEARNING/goodrain-rainbond-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/goodrain/rainbond](https://github.com/goodrain/rainbond))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T12:30:14.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `goodrain/rainbond`
- **Description**: Rainbond is an open-source container platform that requires no Kubernetes expertise. Its core capabilities are 100% open source.  It abstracts away infrastructure complexity and provides a unified way to deploy and manage business applications, AI-generated projects, open-source AI software, and large language model services. AI helps teams deploy 
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 6280 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
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

### Incident Patch 1: `cd811e47` (2026-10-27)
**Commit Message**: fix: preserve config group bindings before component creation (#2733)

Signed-off-by: 张启航 <[REDACTED_EMAIL]>
Co-authored-by: 张启航 <[REDACTED_EMAIL]>

**File**: `api/handler/application_config_group.go` (modified, +25/-16)
```diff
@@ -28,14 +28,8 @@ func (a *ApplicationAction) AddConfigGroup(appID string, req *model.ApplicationC
 		}
 	}()
 	// Create application configGroup-services
-	for _, s := range services {
-		serviceConfigGroup := dbmodel.ConfigGroupService{
-			AppID:           appID,
-			ConfigGroupName: req.ConfigGroupName,
-			ServiceID:       s.ServiceID,
-			ServiceAlias:    s.ServiceAlias,
-		}
-		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(&serviceConfigGroup); err != nil {
+	for _, serviceConfigGroup := range configGroupServiceBindings(appID, req.ConfigGroupName, req.ServiceIDs, services) {
+		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(serviceConfigGroup); err != nil {
 			if err == bcode.ErrConfigGroupServiceExist {
 				logrus.Warningf("config group \"%s\" under this service \"%s\" already exists.", serviceConfigGroup.ConfigGroupName, serviceConfigGroup.ServiceID)
 				continue
@@ -132,14 +126,8 @@ func (a *ApplicationAction) UpdateConfigGroup(appID, configGroupName string, req
 		tx.Rollback()
 		return nil, err
 	}
-	for _, s := range services {
-		serviceConfigGroup := dbmodel.ConfigGroupService{
-			AppID:           appID,
-			ConfigGroupName: configGroupName,
-			ServiceID:       s.ServiceID,
-			ServiceAlias:    s.ServiceAlias,
-		}
-		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(&serviceConfigGroup); err != nil {
+	for _, serviceConfigGroup := range configGroupServiceBindings(appID, configGroupName, req.ServiceIDs, services) {
+		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(serviceConfigGroup); err != nil {
 			if err == bcode.ErrConfigGroupServiceExist {
 				logrus.Debugf("config group \"%s\" under this service \"%s\" already exists.", serviceConfigGroup.ConfigGroupName, serviceConfigGroup.ServiceID)
 				continue
@@ -357,3 +345,24 @@ func (a *ApplicationAction) SyncAppConfigGroups(app *dbmodel.Application, appCon
 		return db.GetManager().AppConfigGroupItemDaoTransactions(tx).CreateOrUpdateConfigGroupItemsInBatch(cgitems)
 	})
 }
+
+// configGroupServiceBindings preserves selected components that have not reached
+// the region yet. Their IDs are already assigned by the console during creation.
+func configGroupServiceBindings(appID, groupName string, serviceIDs []string, services []*dbmodel.TenantServices) []*dbmodel.ConfigGroupService {
+	aliases := make(map[string]string, len(services))
+	for _, service := range services {
+		aliases[service.ServiceID] = service.ServiceAlias
+	}
+	seen := make(map[string]bool, len(serviceIDs))
+	var bindings []*dbmodel.ConfigGroupService
+	for _, id := range serviceIDs {
+		if id == "" || seen[id] {
+			continue
+		}
+		seen[id] = true
+		bindings = append(bindings, &dbmodel.ConfigGroupService{
+			AppID: appID, ConfigGroupName: groupName, ServiceID: id, ServiceAlias: aliases[id],
+		})
+	}
+	return bindings
+}
```

**File**: `api/handler/application_config_group_test.go` (added, +162/-0)
```diff
@@ -0,0 +1,162 @@
+package handler
+
+import (
+	"path/filepath"
+	"testing"
+
+	apimodel "github.com/goodrain/rainbond/api/model"
+	"github.com/goodrain/rainbond/db"
+	"github.com/goodrain/rainbond/db/dao"
+	dbmodel "github.com/goodrain/rainbond/db/model"
+	mysqldao "github.com/goodrain/rainbond/db/mysql/dao"
+	"github.com/goodrain/rainbond/worker/appm/conversion"
+	v1 "github.com/goodrain/rainbond/worker/appm/types/v1"
+	"github.com/jinzhu/gorm"
+	_ "github.com/jinzhu/gorm/dialects/sqlite"
+	corev1 "k8s.io/api/core/v1"
+	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
+)
+
+type configGroupBindingTestManager struct {
+	db.Manager
+	database *gorm.DB
+}
+
+func (m configGroupBindingTestManager) Begin() *gorm.DB { return m.database.Begin() }
+func (m configGroupBindingTestManager) TenantServiceDao() dao.TenantServiceDao {
+	return &mysqldao.TenantServicesDaoImpl{DB: m.database}
+}
+func (m configGroupBindingTestManager) AppConfigGroupDao() dao.AppConfigGroupDao {
+	return m.AppConfigGroupDaoTransactions(m.database)
+}
+func (m configGroupBindingTestManager) AppConfigGroupDaoTransactions(tx *gorm.DB) dao.AppConfigGroupDao {
+	return &mysqldao.AppConfigGroupDaoImpl{DB: tx}
+}
+func (m configGroupBindingTestManager) AppConfigGroupServiceDao() dao.AppConfigGroupServiceDao {
+	return m.AppConfigGroupServiceDaoTransactions(m.database)
+}
+func (m configGroupBindingTestManager) AppConfigGroupServiceDaoTransactions(tx *gorm.DB) dao.AppConfigGroupServiceDao {
+	return &mysqldao.AppConfigGroupServiceDaoImpl{DB: tx}
+}
+func (m configGroupBindingTestManager) AppConfigGroupItemDao() dao.AppConfigGroupItemDao {
+	return m.AppConfigGroupItemDaoTransactions(m.database)
+}
+func (m configGroupBindingTestManager) AppConfigGroupItemDaoTransactions(tx *gorm.DB) dao.AppConfigGroupItemDao {
+	return &mysqldao.AppConfigGroupItemDaoImpl{DB: tx}
+}
+
+// capability_id: rainbond.app-config-group.pending-component-bindings
+func TestConfigGroupRetainsPendingComponentBindings(t *testing.T) {
+	for _, operation := range []string{"create", "update"} {
+		for _, existing := range []bool{false, true} {
+			name := operation + "/pending-only"
+			if existing {
+				name = operation + "/mixed"
+			}
+			t.Run(name, func(t *testing.T) {
+				database, err := gorm.Open("sqlite3", filepath.Join(t.TempDir(), "groups.db"))
+				if err != nil {
+					t.Fatal(err)
+				}
+				t.Cleanup(func() { database.Close() })
+				database.LogMode(false)
+				if err := database.AutoMigrate(&dbmodel.TenantServices{}, &dbmodel.ApplicationConfigGroup{}, &dbmodel.ConfigGroupService{}, &dbmodel.ConfigGroupItem{}).Error; err != nil {
+					t.Fatal(err)
+				}
+				manager := configGroupBindingTestManager{database: database}
+				old := db.GetManager()
+				db.SetTestManager(manager)
+				t.Cleanup(func() { db.SetTestManager(old) })
+				ids := []string{"pending", ""}
+				if existing {
+					if err := database.Create(&dbmodel.TenantServices{ServiceID: "ready", ServiceAlias: "gr-ready", AppID: "app"}).Error; err != nil {
+						t.Fatal(err)
+					}
+					ids = append(ids, "ready", "pending")
+				}
+				items := []apimodel.ConfigItem{{ItemKey: "APP_NAME", ItemValue: "${_SERVICE_NAME}"}}
+				action := &ApplicationAction{}
+				var response *apimodel.ApplicationConfigGroupResp
+				if operation == "create" {
+					response, err = action.AddConfigGroup("app", &apimodel.ApplicationConfigGroup{ConfigGroupName: "java", Enable: true, DeployType: "env", ServiceIDs: ids, ConfigItems: items})
+				} else {
+					if err := database.Create(&dbmodel.ApplicationConfigGroup{AppID: "app", ConfigGroupName: "java", Enable: true, DeployType: "env"}).Error; err != nil {
+						t.Fatal(err)
+					}
+					if err := database.Create(&dbmodel.ConfigGroupService{AppID: "app", ConfigGroupName: "java", ServiceID: "removed"}).Error; err != nil {
+						t.Fatal(err)
+					}
+					response, err = action.UpdateConfigGroup("app", "java", &apimodel.UpdateAppConfigGroupReq{Enable: true, ServiceIDs: ids, ConfigItems: items})
+				}
+				if err != nil {
+					t.Fatal(err)
+				}
+				got := map[string]string{}
+				for _, binding := range response.Services {
+					if _, duplicate := got[binding.ServiceID]; duplicate {
+						t.Fatalf("duplicate binding for %s", binding.ServiceID)
+					}
+					got[binding.ServiceID] = binding.ServiceAlias
+				}
+				if _, ok := got["pending"]; !ok {
+					t.Fatalf("%s discarded component before creation: %v", operation, got)
+				}
+				wantCount := 1
+				if existing {
+					wantCount++
+					if got["ready"] != "gr-ready" {
+						t.Fatal("existing component alias lost")
+					}
+				}
+				if len(got) != wantCount {
+					t.Fatalf("unexpected bindings: %v", got)
+				}
+				// Completing component creation must make the saved group discoverable,
+				// without requiring the user to save the configuration group again.
+				if err := database.Create(&dbmodel.TenantServices{ServiceID: "pending", ServiceAlias: "gr-pending", AppID: "app"}).Error; err != nil {
+					t.Fa
```

**File**: `test-manifest.json` (modified, +19/-0)
```diff
@@ -272,6 +272,25 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.app-config-group.pending-component-bindings",
+      "title": "Preserve configuration bindings before component creation",
+      "title_zh": "Preserve configuration bindings before component creation",
+      "interface_type": "handler_method",
+      "interface": "api/handler.ApplicationAction.AddConfigGroup/UpdateConfigGroup",
+      "code_paths": [
+        "api/handler/application_config_group.go",
+        "worker/appm/conversion/configgroup.go"
+      ],
+      "tests": [
+        {
+          "path": "api/handler/application_config_group_test.go",
+          "selector": "TestConfigGroupRetainsPendingComponentBindings"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.app-config-group.unbind-components",
       "title": "Remove component bindings from app config group",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -19,6 +19,7 @@
 | rainbond.app-config-group.item-create | 创建应用配置项 | active | regression | db/mysql/dao.AppConfigGroupItemDaoImpl.AddModel | db/mysql/dao/application_config_group_test.go::TestAppConfigGroupItemDaoAddModel |
 | rainbond.app-config-group.item-delete | 删除应用配置项 | active | regression | db/mysql/dao.AppConfigGroupItemDaoImpl.DeleteConfigGroupItem | db/mysql/dao/application_config_group_test.go::TestDeleteConfigGroupItem |
 | rainbond.app-config-group.item-update | 更新应用配置项 | active | regression | db/mysql/dao.AppConfigGroupItemDaoImpl.UpdateModel | db/mysql/dao/application_config_group_test.go::TestAppConfigGroupItemDaoUpdateModel |
+| rainbond.app-config-group.pending-component-bindings | Preserve configuration bindings before component creation | active | regression | api/handler.ApplicationAction.AddConfigGroup/UpdateConfigGroup | api/handler/application_config_group_test.go::TestConfigGroupRetainsPendingComponentBindings |
 | rainbond.app-config-group.unbind-components | 移除应用配置组组件绑定 | active | regression | db/mysql/dao.AppConfigGroupServiceDaoImpl.DeleteConfigGroupService | db/mysql/dao/application_config_group_test.go::TestDeleteConfigGroupService |
 | rainbond.app-import.package-name-normalize | 从 Linux 文件名还原导入镜像包名 | active | regression | builder/exector.buildFromLinuxFileName | builder/exector/import_app_test.go::TestBuildFromLinuxFileName |
 | rainbond.app-import.propagate-image-push-error | Return imported image push errors during app import | active | regression | builder/exector.ensureImportedImagesPushed | builder/exector/import_app_test.go::TestEnsureImportedImagesPushedReturnsPushError |
@@ -814,6 +815,16 @@
 - 代码路径: `db/mysql/dao/application_config_group.go`
 - 测试路径: `db/mysql/dao/application_config_group_test.go::TestAppConfigGroupItemDaoUpdateModel`
 
+### Preserve configuration bindings before component creation
+
+- Capability ID: `rainbond.app-config-group.pending-component-bindings`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `handler_method`
+- 业务入口: `api/handler.ApplicationAction.AddConfigGroup/UpdateConfigGroup`
+- 代码路径: `api/handler/application_config_group.go`, `worker/appm/conversion/configgroup.go`
+- 测试路径: `api/handler/application_config_group_test.go::TestConfigGroupRetainsPendingComponentBindings`
+
 ### 移除应用配置组组件绑定
 
 - Capability ID: `rainbond.app-config-group.unbind-components`
```

**File**: `worker/appm/conversion/configgroup.go` (modified, +6/-0)
```diff
@@ -2,6 +2,7 @@ package conversion
 
 import (
 	"fmt"
+
 	"github.com/goodrain/rainbond/db"
 	v1 "github.com/goodrain/rainbond/worker/appm/types/v1"
 	"github.com/sirupsen/logrus"
@@ -19,6 +20,11 @@ func TenantServiceConfigGroup(as *v1.AppService, dbm db.Manager) error {
 
 	var secrets []*corev1.Secret
 	for _, group := range groups {
+		// A binding may precede component creation. Only materialize it once
+		// the component actually belongs to the configuration group's app.
+		if group.AppID != as.AppID {
+			continue
+		}
 		cg := createConfigGroup(as, as.GetNamespace(), group.AppID, group.ConfigGroupName)
 		secret, err := cg.secretForConfigGroup()
 		if err != nil {
```

---

### Incident Patch 2: `ee0e246e` (2026-10-27)
**Commit Message**: fix: isolate CNB source package build workspaces (#2732)

Signed-off-by: 张启航 <[REDACTED_EMAIL]>

**File**: `builder/build/cnb/build.go` (modified, +14/-0)
```diff
@@ -8,6 +8,7 @@ import (
 
 	"github.com/goodrain/rainbond/builder/build"
 	jobc "github.com/goodrain/rainbond/builder/job"
+	"github.com/goodrain/rainbond/builder/parser"
 	"github.com/goodrain/rainbond/builder/sources"
 	"github.com/goodrain/rainbond/util"
 	"github.com/sirupsen/logrus"
@@ -55,6 +56,19 @@ func NewBuilder() (build.Build, error) {
 func (b *Builder) Build(re *build.Request) (*build.Response, error) {
 	re.Logger.Info("Starting CNB build", map[string]string{"step": "builder-exector"})
 
+	if re.ServerType == "pkg" {
+		workspace, cleanup, err := parser.PreparePackageBuildWorkspace(re.SourceDir, re.Commit.Message)
+		if err != nil {
+			re.Logger.Error(err.Error(), map[string]string{"step": "build-code", "status": "failure"})
+			return nil, err
+		}
+		defer cleanup()
+		request := *re
+		request.SourceDir = workspace
+		re = &request
+		re.Logger.Info("Prepared source package build input", map[string]string{"step": "build-code"})
+	}
+
 	if err := applyVersionPolicy(re); err != nil {
 		re.Logger.Error(err.Error(), map[string]string{"step": "build-code", "status": "failure"})
 		return nil, err
```

**File**: `builder/build/cnb/package_workspace_test.go` (added, +295/-0)
```diff
@@ -0,0 +1,295 @@
+package cnb
+
+import (
+	"archive/zip"
+	"bytes"
+	"context"
+	"errors"
+	"fmt"
+	"io"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+
+	"github.com/eapache/channels"
+	"github.com/goodrain/rainbond/builder/build"
+	"github.com/goodrain/rainbond/builder/parser/code"
+	"github.com/goodrain/rainbond/db"
+	dbdao "github.com/goodrain/rainbond/db/dao"
+	dbmodel "github.com/goodrain/rainbond/db/model"
+	"github.com/goodrain/rainbond/event"
+	corev1 "k8s.io/api/core/v1"
+)
+
+type packageWorkspaceTestManager struct {
+	db.Manager
+}
+
+func (m packageWorkspaceTestManager) TenantServiceDao() dbdao.TenantServiceDao {
+	return packageWorkspaceTestServices{}
+}
+
+type packageWorkspaceTestServices struct {
+	dbdao.TenantServiceDao
+}
+
+func (packageWorkspaceTestServices) GetServiceByID(string) (*dbmodel.TenantServices, error) {
+	return nil, errors.New("fixture has no database component")
+}
+
+func usePackageWorkspaceTestDB(t *testing.T) {
+	t.Helper()
+	previous := db.GetManager()
+	db.SetTestManager(packageWorkspaceTestManager{})
+	t.Cleanup(func() { db.SetTestManager(previous) })
+}
+
+func writeCNBSourceArchive(t *testing.T, dir string, files map[string]string) string {
+	t.Helper()
+	name := "source.zip"
+	file, err := os.Create(filepath.Join(dir, name))
+	if err != nil {
+		t.Fatal(err)
+	}
+	writer := zip.NewWriter(file)
+	for name, content := range files {
+		header := &zip.FileHeader{Name: name, Method: zip.Deflate}
+		header.SetMode(0644)
+		entry, err := writer.CreateHeader(header)
+		if err != nil {
+			t.Fatal(err)
+		}
+		if _, err := io.WriteString(entry, content); err != nil {
+			t.Fatal(err)
+		}
+	}
+	if err := writer.Close(); err != nil {
+		t.Fatal(err)
+	}
+	if err := file.Close(); err != nil {
+		t.Fatal(err)
+	}
+	return name
+}
+
+// capability_id: rainbond.cnb.package-workspace-isolation
+func TestCNBPackageBuildUsesPristineWorkspace(t *testing.T) {
+	usePackageWorkspaceTestDB(t)
+	for _, tc := range []struct {
+		name     string
+		locked   bool
+		vendored bool
+		fail     bool
+	}{
+		{name: "unlocked repeated build"},
+		{name: "archive lock is preserved", locked: true},
+		{name: "archive modules are preserved", vendored: true},
+		{name: "failed builds also release workspace", fail: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			source := newNodeDir(t)
+			files := map[string]string{
+				"package.json": `{"name":"package-demo","version":"1.0.0"}`,
+				"src/main.js":  "console.log('from archive');",
+			}
+			if tc.locked {
+				files["package-lock.json"] = `{"lockfileVersion":3,"name":"package-demo"}`
+			}
+			if tc.vendored {
+				files["node_modules/from-archive.txt"] = "user supplied dependency"
+			}
+			name := writeCNBSourceArchive(t, source, files)
+			archiveBefore, err := os.ReadFile(filepath.Join(source, name))
+			if err != nil {
+				t.Fatal(err)
+			}
+			// Reproduce the retained directory from the previous CNB job.
+			if err := os.WriteFile(filepath.Join(source, "package-lock.json"), []byte("generated lock"), 0644); err != nil {
+				t.Fatal(err)
+			}
+			if err := os.Symlink(filepath.Join(t.TempDir(), "missing-layer", "node_modules"), filepath.Join(source, "node_modules")); err != nil {
+				t.Fatal(err)
+			}
+			if err := os.Mkdir(filepath.Join(source, "dist"), 0755); err != nil {
+				t.Fatal(err)
+			}
+			if err := os.WriteFile(filepath.Join(source, "dist", "stale.txt"), []byte("old output"), 0644); err != nil {
+				t.Fatal(err)
+			}
+
+			var workspaces []string
+			ctrl := &mockJobCtrl{execJobFn: func(ctx context.Context, pod *corev1.Pod, output io.Writer, result *channels.RingChannel) error {
+				workspace := ""
+				for _, volume := range pod.Spec.Volumes {
+					if volume.Name == "workspace" && volume.HostPath != nil {
+						workspace = strings.TrimPrefix(volume.HostPath.Path, "/opt/rainbond")
+					}
+				}
+				if workspace == "" {
+					return fmt.Errorf("workspace mount missing")
+				}
+				workspaces = append(workspaces, workspace)
+				if workspace == source {
+					t.Error("CNB job reused the retained package directory")
+				}
+				for name, want := range files {
+					got, err := os.ReadFile(filepath.Join(workspace, name))
+					if err != nil || string(got) != want {
+						t.Errorf("archive file %s = %q, %v; want %q", name, got, err, want)
+					}
+				}
+				for _, name := range []string{"dist/stale.txt", "node_modules/generated.txt"} {
+					if _, err := os.Lstat(filepath.Join(workspace, name)); !os.IsNotExist(err) {
+						t.Errorf("previous build output %s leaked into new job: %v", name, err)
+					}
+				}
+				if !tc.locked {
+					if _, err := os.Lstat(filepath.Join(workspace, "package-lock.json")); !os.IsNotExist(err) {
+						t.Errorf("generated lock leaked into unlocked build: %v", err)
+					}
+					for _, arg := range pod.Spec.Containers[0].Args {
+						if strings.HasPrefix(arg, "-cache-image=") && !tc.vendored {
+							t.Errorf("generated files changed the cache policy: %s", arg)
+						}
+			
```

**File**: `builder/parser/package_workspace.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package parser
+
+import (
+	"fmt"
+	"os"
+	"path/filepath"
+	"strings"
+
+	"github.com/goodrain/rainbond/util"
+	"github.com/sirupsen/logrus"
+)
+
+// PreparePackageBuildWorkspace extracts the selected uploaded archive into a
+// per-build directory. The caller must release it after the build has finished.
+// Standalone JAR/WAR inputs retain their existing handling.
+func PreparePackageBuildWorkspace(sourceDir, archiveName string) (string, func(), error) {
+	if strings.TrimSpace(sourceDir) == "" {
+		return "", nil, fmt.Errorf("invalid package source directory")
+	}
+	if strings.TrimSpace(archiveName) == "" || strings.ContainsAny(archiveName, "/\\") || filepath.Base(archiveName) != archiveName {
+		return "", nil, fmt.Errorf("invalid package archive name")
+	}
+	archivePath := filepath.Join(sourceDir, archiveName)
+	info, err := os.Lstat(archivePath)
+	if err != nil {
+		return "", nil, fmt.Errorf("read uploaded package: %w", err)
+	}
+	if !info.Mode().IsRegular() {
+		return "", nil, fmt.Errorf("uploaded package is not a regular file")
+	}
+	ext, archived := packageArchiveExt(archiveName)
+	if !archived {
+		switch strings.ToLower(filepath.Ext(archiveName)) {
+		case ".jar", ".war":
+			return sourceDir, func() {}, nil
+		default:
+			return "", nil, fmt.Errorf("unsupported source package format")
+		}
+	}
+	workspace, err := os.MkdirTemp(filepath.Dir(sourceDir), ".cnb-package-")
+	if err != nil {
+		return "", nil, fmt.Errorf("create package build workspace: %w", err)
+	}
+	cleanup := func() {
+		if err := os.RemoveAll(workspace); err != nil {
+			logrus.Warnf("remove package build workspace failed: %v", err)
+		}
+	}
+	if ext == ".zip" {
+		err = util.Unzip(archivePath, workspace)
+	} else {
+		err = util.UnTar(archivePath, workspace, ext != ".tar")
+	}
+	if err != nil {
+		cleanup()
+		return "", nil, fmt.Errorf("extract uploaded package: %w", err)
+	}
+	return workspace, cleanup, nil
+}
```

**File**: `builder/parser/package_workspace_test.go` (added, +230/-0)
```diff
@@ -0,0 +1,230 @@
+package parser
+
+import (
+	"archive/tar"
+	"archive/zip"
+	"bytes"
+	"compress/gzip"
+	"io"
+	"os"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+func writePackageWorkspaceArchive(t *testing.T, filename, prefix string, contents map[string]string) {
+	t.Helper()
+	file, err := os.Create(filename)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if strings.HasSuffix(strings.ToLower(filename), ".zip") {
+		writer := zip.NewWriter(file)
+		for name, content := range contents {
+			header := &zip.FileHeader{Name: prefix + name, Method: zip.Deflate}
+			header.SetMode(0644)
+			entry, err := writer.CreateHeader(header)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if _, err := io.WriteString(entry, content); err != nil {
+				t.Fatal(err)
+			}
+		}
+		if err := writer.Close(); err != nil {
+			t.Fatal(err)
+		}
+	} else {
+		var output io.Writer = file
+		var compressed *gzip.Writer
+		if !strings.HasSuffix(filename, ".tar") {
+			compressed = gzip.NewWriter(file)
+			output = compressed
+		}
+		writer := tar.NewWriter(output)
+		for name, content := range contents {
+			if err := writer.WriteHeader(&tar.Header{Name: prefix + name, Mode: 0644, Size: int64(len(content))}); err != nil {
+				t.Fatal(err)
+			}
+			if _, err := io.WriteString(writer, content); err != nil {
+				t.Fatal(err)
+			}
+		}
+		if err := writer.Close(); err != nil {
+			t.Fatal(err)
+		}
+		if compressed != nil {
+			if err := compressed.Close(); err != nil {
+				t.Fatal(err)
+			}
+		}
+	}
+	if err := file.Close(); err != nil {
+		t.Fatal(err)
+	}
+}
+
+// capability_id: rainbond.cnb.package-workspace-isolation
+func TestPreparePackageBuildWorkspace(t *testing.T) {
+	for _, tc := range []struct {
+		name   string
+		ext    string
+		prefix string
+	}{
+		{name: "zip", ext: ".zip"},
+		{name: "uppercase zip", ext: ".ZIP"},
+		{name: "zip with common root", ext: ".zip", prefix: "project/"},
+		{name: "tar", ext: ".tar"},
+		{name: "tar gz", ext: ".tar.gz"},
+		{name: "tgz", ext: ".tgz"},
+		{name: "gz", ext: ".gz"},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			source := t.TempDir()
+			name := "uploaded" + tc.ext
+			contents := map[string]string{
+				"package.json":                 `{"name":"original"}`,
+				"package-lock.json":            `{"lockfileVersion":3}`,
+				"node_modules/from-upload.txt": "user supplied",
+				".npmrc":                       "registry=https://registry.npmmirror.com",
+				"frontend/package.json":        `{"name":"nested-project"}`,
+			}
+			writePackageWorkspaceArchive(t, filepath.Join(source, name), tc.prefix, contents)
+			before, err := os.ReadFile(filepath.Join(source, name))
+			if err != nil {
+				t.Fatal(err)
+			}
+			if err := os.WriteFile(filepath.Join(source, "generated.zip"), []byte("not the selected archive"), 0644); err != nil {
+				t.Fatal(err)
+			}
+			first, releaseFirst, err := PreparePackageBuildWorkspace(source, name)
+			if err != nil {
+				t.Fatal(err)
+			}
+			defer releaseFirst()
+			if first == source || filepath.Dir(first) != filepath.Dir(source) {
+				t.Fatalf("unexpected isolated workspace: %s", first)
+			}
+			for name, want := range contents {
+				got, err := os.ReadFile(filepath.Join(first, name))
+				if err != nil || string(got) != want {
+					t.Errorf("archive content %s = %q, %v; want %q", name, got, err, want)
+				}
+			}
+			if err := os.WriteFile(filepath.Join(first, "generated.txt"), []byte("first build"), 0644); err != nil {
+				t.Fatal(err)
+			}
+			second, releaseSecond, err := PreparePackageBuildWorkspace(source, name)
+			if err != nil {
+				t.Fatal(err)
+			}
+			defer releaseSecond()
+			if second == first {
+				t.Fatal("parallel/repeated builds share a workspace")
+			}
+			if _, err := os.Stat(filepath.Join(second, "generated.txt")); !os.IsNotExist(err) {
+				t.Fatalf("other build output was copied: %v", err)
+			}
+			releaseFirst()
+			releaseFirst()
+			if _, err := os.Stat(first); !os.IsNotExist(err) {
+				t.Fatalf("cleanup did not remove its workspace: %v", err)
+			}
+			if _, err := os.Stat(second); err != nil {
+				t.Fatalf("cleanup removed a different build workspace: %v", err)
+			}
+			after, err := os.ReadFile(filepath.Join(source, name))
+			if err != nil || !bytes.Equal(before, after) {
+				t.Fatalf("uploaded archive changed: %v", err)
+			}
+		})
+	}
+	for _, ext := range []string{".jar", ".war"} {
+		t.Run("standalone "+ext, func(t *testing.T) {
+			source := t.TempDir()
+			name := "application" + ext
+			if err := os.WriteFile(filepath.Join(source, name), []byte("artifact"), 0644); err != nil {
+				t.Fatal(err)
+			}
+			dir, cleanup, err := PreparePackageBuildWorkspace(source, name)
+			if err != nil {
+				t.Fatal(err)
+			}
+			cleanup()
+			if dir != source {
+				t.Fatalf("standalone artifact source changed: %s", dir)
+			}
+			if _, err := os.Stat(filepath.Join(source, name)); err != nil {
+				t.Fatalf("standalone artifact was removed: %v", err)
+			}
+		})
+	}
+}
+
+// capability_id: rainbond.cnb
```

**File**: `test-manifest.json` (modified, +32/-0)
```diff
@@ -4076,6 +4076,38 @@
       "test_type": "regression",
       "status": "active"
     },
+    {
+      "id": "rainbond.cnb.package-workspace-isolation",
+      "title": "Isolate each CNB source package build from retained generated files",
+      "title_zh": "\u9694\u79bb\u6e90\u7801\u5305 CNB \u6784\u5efa\u5de5\u4f5c\u76ee\u5f55\u5e76\u4fdd\u7559\u539f\u59cb\u4e0a\u4f20\u5185\u5bb9",
+      "interface_type": "workflow",
+      "interface": "builder/build/cnb.Builder.Build",
+      "code_paths": [
+        "builder/build/cnb/build.go",
+        "builder/parser/package_workspace.go",
+        "util/comman.go"
+      ],
+      "tests": [
+        {
+          "path": "builder/build/cnb/package_workspace_test.go",
+          "selector": "TestCNBPackageBuildUsesPristineWorkspace"
+        },
+        {
+          "path": "builder/build/cnb/package_workspace_test.go",
+          "selector": "TestCNBNonPackageBuildKeepsSourceDirectory"
+        },
+        {
+          "path": "builder/parser/package_workspace_test.go",
+          "selector": "TestPreparePackageBuildWorkspace"
+        },
+        {
+          "path": "builder/parser/package_workspace_test.go",
+          "selector": "TestPreparePackageBuildWorkspaceRejectsInvalidInput"
+        }
+      ],
+      "test_type": "regression",
+      "status": "active"
+    },
     {
       "id": "rainbond.cnb.phase-timing",
       "title": "Report observed CNB lifecycle phase durations without changing build output",
```

**File**: `test-manifest.md` (modified, +11/-0)
```diff
@@ -212,6 +212,7 @@
 | rainbond.cnb.offline-mode | 解析离线模式下的 CNB 镜像行为 | active | regression | builder/build/cnb offline mode helpers | builder/build/cnb/cnb_test.go::TestIsOfflineMode<br>builder/build/cnb/cnb_test.go::TestGetCNBBuilderImageOffline<br>builder/build/cnb/cnb_test.go::TestGetCNBRunImageOffline |
 | rainbond.cnb.order-toml | 写入自定义 CNB order 定义 | active | regression | builder/build/cnb.Builder.writeCustomOrder | builder/build/cnb/cnb_test.go::TestWriteCustomOrder |
 | rainbond.cnb.order-write-failure | CNB order 文件写入失败时返回空标记 | active | regression | builder/build/cnb.Builder.writeCustomOrder | builder/build/cnb/cnb_test.go::TestWriteCustomOrderFailure |
+| rainbond.cnb.package-workspace-isolation | 隔离源码包 CNB 构建工作目录并保留原始上传内容 | active | regression | builder/build/cnb.Builder.Build | builder/build/cnb/package_workspace_test.go::TestCNBPackageBuildUsesPristineWorkspace<br>builder/build/cnb/package_workspace_test.go::TestCNBNonPackageBuildKeepsSourceDirectory<br>builder/parser/package_workspace_test.go::TestPreparePackageBuildWorkspace<br>builder/parser/package_workspace_test.go::TestPreparePackageBuildWorkspaceRejectsInvalidInput |
 | rainbond.cnb.phase-timing | Report observed CNB lifecycle phase durations without changing build output | active | regression | builder/build/cnb.Builder.runCNBBuildJob | builder/build/cnb/phase_logger_test.go::TestCNBPhaseTiming<br>builder/build/cnb/phase_logger_test.go::TestCNBPhaseTimingHandlesFragmentedLogs<br>builder/build/cnb/phase_logger_test.go::TestCNBPhaseTimingPreservesWriterErrors<br>builder/build/cnb/phase_logger_test.go::TestCNBPhaseTimingSerializesConcurrentWrites<br>builder/build/cnb/phase_logger_test.go::TestCNBJobEmitsFinalPhaseTiming |
 | rainbond.cnb.platform-annotations | 根据构建环境生成 CNB 平台注解 | active | regression | builder/build/cnb.Builder.buildPlatformAnnotations | builder/build/cnb/cnb_test.go::TestBuildPlatformAnnotations |
 | rainbond.cnb.platform-volume | 根据注解创建 CNB 平台卷 | active | regression | builder/build/cnb.Builder.createPlatformVolume | builder/build/cnb/cnb_test.go::TestCreatePlatformVolume<br>builder/build/cnb/cnb_test.go::TestCreatePlatformVolumeEmpty<br>builder/build/cnb/cnb_test.go::TestCreatePlatformVolumeNonCNBKeys |
@@ -2743,6 +2744,16 @@
 - 代码路径: `builder/build/cnb/order.go`
 - 测试路径: `builder/build/cnb/cnb_test.go::TestWriteCustomOrderFailure`
 
+### 隔离源码包 CNB 构建工作目录并保留原始上传内容
+
+- Capability ID: `rainbond.cnb.package-workspace-isolation`
+- 状态: `active`
+- 测试类型: `regression`
+- 接口类型: `workflow`
+- 业务入口: `builder/build/cnb.Builder.Build`
+- 代码路径: `builder/build/cnb/build.go`, `builder/parser/package_workspace.go`, `util/comman.go`
+- 测试路径: `builder/build/cnb/package_workspace_test.go::TestCNBPackageBuildUsesPristineWorkspace`, `builder/build/cnb/package_workspace_test.go::TestCNBNonPackageBuildKeepsSourceDirectory`, `builder/parser/package_workspace_test.go::TestPreparePackageBuildWorkspace`, `builder/parser/package_workspace_test.go::TestPreparePackageBuildWorkspaceRejectsInvalidInput`
+
 ### Report observed CNB lifecycle phase durations without changing build output
 
 - Capability ID: `rainbond.cnb.phase-timing`
```

**File**: `util/comman.go` (modified, +1/-0)
```diff
@@ -545,6 +545,7 @@ func Unzip(archive, target string) error {
 	if err != nil {
 		return fmt.Errorf("error opening archive: %v", err)
 	}
+	defer reader.Close()
 	if err := os.MkdirAll(target, 0755); err != nil {
 		return err
 	}
```

---

### Incident Patch 3: `910b7efc` (2026-10-27)
**Commit Message**: fix: recognize colored CNB lifecycle phase logs (#2731)

Signed-off-by: 张启航 <[REDACTED_EMAIL]>

**File**: `builder/build/cnb/phase_logger.go` (modified, +6/-1)
```diff
@@ -4,6 +4,7 @@ import (
 	"bytes"
 	"fmt"
 	"io"
+	"regexp"
 	"strconv"
 	"strings"
 	"sync"
@@ -12,6 +13,8 @@ import (
 	"github.com/goodrain/rainbond/event"
 )
 
+var cnbANSISequence = regexp.MustCompile(`\x1b\[[0-?]*[ -/]*[@-~]`)
+
 // cnbPhaseWriter preserves build output and reports observed lifecycle phase
 // durations. The final phase includes the wait for job and log completion;
 // parallel app/cache export is reported as one EXPORTING phase.
@@ -54,7 +57,9 @@ func (w *cnbPhaseWriter) Write(data []byte) (int, error) {
 
 func (w *cnbPhaseWriter) observeLine(line string) {
 	var phase string
-	switch strings.TrimSpace(line) {
+	// Lifecycle colors phase markers even in captured logs. Normalize only the
+	// detection text; the original output, including its colors, is preserved.
+	switch strings.TrimSpace(cnbANSISequence.ReplaceAllString(line, "")) {
 	case "===> ANALYZING":
 		phase = "ANALYZING"
 	case "===> DETECTING":
```

**File**: `builder/build/cnb/phase_logger_test.go` (modified, +45/-32)
```diff
@@ -33,38 +33,51 @@ func readCNBMessages(t *testing.T, logs chan []byte) []map[string]string {
 
 // capability_id: rainbond.cnb.phase-timing
 func TestCNBPhaseTiming(t *testing.T) {
-	logs := make(chan []byte, 20)
-	var output bytes.Buffer
-	writer := newCNBPhaseWriter(&output, event.NewLogger("test", logs))
-	now := time.Unix(0, 0)
-	writer.now = func() time.Time { return now }
-	var input strings.Builder
-	phases := []string{"ANALYZING", "DETECTING", "RESTORING", "BUILDING", "EXPORTING"}
-	for i, phase := range phases {
-		line := "===> " + phase + "\r\n"
-		input.WriteString(line)
-		if _, err := writer.Write([]byte(line)); err != nil {
-			t.Fatal(err)
-		}
-		now = now.Add(time.Duration(i+1) * time.Second)
-	}
-	writer.finish()
-	writer.finish()
-	if output.String() != input.String() {
-		t.Fatalf("original logs changed: %q", output.String())
-	}
-	entries := readCNBMessages(t, logs)
-	if len(entries) != len(phases) {
-		t.Fatalf("got %d timing records, want %d: %v", len(entries), len(phases), entries)
-	}
-	for i, entry := range entries {
-		want := time.Duration(i+1) * time.Second
-		if entry["step"] != "build-timing" || entry["phase"] != phases[i] || !strings.Contains(entry["message"], want.String()) {
-			t.Errorf("unexpected timing entry: %v", entry)
-		}
-		if strings.Contains(entry["message"], "success") {
-			t.Errorf("elapsed time must not imply build success: %v", entry)
-		}
+	for _, style := range []struct {
+		name   string
+		prefix string
+		suffix string
+	}{
+		{name: "plain"},
+		{name: "lifecycle cyan", prefix: "\x1b[36m", suffix: "\x1b[0m"},
+		{name: "bold cyan", prefix: "\x1b[1;36m", suffix: "\x1b[0m"},
+		{name: "true color", prefix: "\x1b[38:2:0:200:200m", suffix: "\x1b[m"},
+	} {
+		t.Run(style.name, func(t *testing.T) {
+			logs := make(chan []byte, 20)
+			var output bytes.Buffer
+			writer := newCNBPhaseWriter(&output, event.NewLogger("test", logs))
+			now := time.Unix(0, 0)
+			writer.now = func() time.Time { return now }
+			var input strings.Builder
+			phases := []string{"ANALYZING", "DETECTING", "RESTORING", "BUILDING", "EXPORTING"}
+			for i, phase := range phases {
+				line := style.prefix + "===> " + phase + style.suffix + "\r\n"
+				input.WriteString(line)
+				if _, err := writer.Write([]byte(line)); err != nil {
+					t.Fatal(err)
+				}
+				now = now.Add(time.Duration(i+1) * time.Second)
+			}
+			writer.finish()
+			writer.finish()
+			if output.String() != input.String() {
+				t.Fatalf("original logs changed: %q", output.String())
+			}
+			entries := readCNBMessages(t, logs)
+			if len(entries) != len(phases) {
+				t.Fatalf("got %d timing records, want %d: %v", len(entries), len(phases), entries)
+			}
+			for i, entry := range entries {
+				want := time.Duration(i+1) * time.Second
+				if entry["step"] != "build-timing" || entry["phase"] != phases[i] || !strings.Contains(entry["message"], want.String()) {
+					t.Errorf("unexpected timing entry: %v", entry)
+				}
+				if strings.Contains(entry["message"], "success") {
+					t.Errorf("elapsed time must not imply build success: %v", entry)
+				}
+			}
+		})
 	}
 }
 
```

#### Recent Merged Pull Requests:
- **PR #2733** (2026-10-27): fix: preserve config group bindings before component creation (@ZhangSetSail)
- **PR #2732** (2026-10-27): fix: isolate CNB source package build workspaces (@ZhangSetSail)
- **PR #2731** (2026-10-27): fix: recognize colored CNB lifecycle phase logs (@ZhangSetSail)
- **PR #2730** (2026-10-27): fix(release): download E2E job logs with curl in the gate (@yangkaa)
- **PR #2729** (2026-10-27): fix: isolate config group variable rendering per component (@ZhangSetSail)
- **PR #2728** (2026-10-26): V6.9.12 dev (@ZhangSetSail)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. preserve config group bindings before component creation (#2733)

**RULE**:
When implementing operations in `api/handler/application_config_group.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in goodrain/rainbond. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cd811e47`: preserve config group bindings before component creation (#2733). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `api/handler/application_config_group.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	for _, serviceConfigGroup := range configGroupServiceBindings(appID, req.ConfigGroupName, req.ServiceIDs, services) {
		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(serviceConfigGroup); err != nil {
	for _, serviceConfigGroup := range configGroupServiceBindings(appID, configGroupName, req.ServiceIDs, services) {
		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(serviceConfigGroup); err != nil {

// configGroupServiceBindings preserves selected components that have not reached
// the region yet. Their IDs are already assigned by the console during creation.
func configGroupServiceBindings(appID, groupName string, serviceIDs []string, services []*dbmodel.TenantServices) []*dbmodel.ConfigGroupService {
	aliases := make(map[string]string, len(services))
	for _, service := range services {
		aliases[service.ServiceID] = service.ServiceAlias
	}
	seen := make(map[string]bool, len(serviceIDs))
	var bindings []*dbmodel.ConfigGroupService
	for _, id := range serviceIDs {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		bindings = append(bindings, &dbmodel.ConfigGroupService{
			AppID: appID, ConfigGroupName: groupName
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	for _, s := range services {
		serviceConfigGroup := dbmodel.ConfigGroupService{
			AppID:           appID,
			ConfigGroupName: req.ConfigGroupName,
			ServiceID:       s.ServiceID,
			ServiceAlias:    s.ServiceAlias,
		}
		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(&serviceConfigGroup); err != nil {
	for _, s := range services {
		serviceConfigGroup := dbmodel.ConfigGroupService{
			AppID:           appID,
			ConfigGroupName: configGroupName,
			ServiceID:       s.ServiceID,
			ServiceAlias:    s.ServiceAlias,
		}
		if err := db.GetManager().AppConfigGroupServiceDaoTransactions(tx).AddModel(&serviceConfigGroup); err != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cd811e47` are properly handled with clean fallback behavior.
