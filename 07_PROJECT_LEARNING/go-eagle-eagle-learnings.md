# Forensic Learning Record (Deep Inspection): go-eagle/eagle

> **Canonical Artifact**: `07_PROJECT_LEARNING/go-eagle-eagle-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/go-eagle/eagle](https://github.com/go-eagle/eagle))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:11.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `go-eagle/eagle`
- **Description**: 🦅 A Go framework for the API or Microservice
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2427 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/eagle/internal/utils/utils.go`
```
package utils

import (
	"bytes"
	"log"
	"os"
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/mod/modfile"
)

func ModName() string {
	modBytes, err := os.ReadFile("go.mod")
	if err != nil {
		if modBytes, err = os.ReadFile("../go.mod"); err != nil {
			return ""
		}
	}
	return modfile.ModulePath(modBytes)
}

// 驼峰式写法转为下划线写法
func Camel2Case(name string) string {
	buffer := NewBuffer()
	for i, r := range name {
		if unicode.IsUpper(r) {
			if i != 0 {
				buffer.Append('_')
			}
			buffer.Append(unicode.ToLower(r))
		} else {
			buffer.Append(r)
		}
	}
	return buffer.String()
}

// 下划线写法转为驼峰写法
func Case2Camel(name string) string {
	name = strings.Replace(name, "_", " ", -1)
	name = strings.Title(name)
	return strings.Replace(name, " ", "", -1)
}

// 首字母大写
func Ucfirst(str string) string {
	for i, v := range str {
		return string(unicode.ToUpper(v)) + str[i+1:]
	}
	return ""
}

// 首字母小写
func Lcfirst(str string) string {
	for i, v := range str {
		return string(unicode.ToLower(v)) + str[i+1:]
	}
	return ""
}

// 内嵌bytes.Buffer，支持连写
type Buffer struct {
	*bytes.Buffer
}

func NewBuffer() *Buffer {
	return &Buffer{Buffer: new(bytes.Buffer)}
}

func (b *Buffer) Append(i interface{}) *Buffer {
	switch val := i.(type) {
	case int:
		b.append(strconv.Itoa(val))
	case int64:
		b.append(strconv.FormatInt(val, 10))
	case uint:
		b.append(strconv.FormatUint(uint64(val), 10))
	case uint64:
		b.append(strconv.FormatUint(val, 10))
	case string:
		b.append(val)
	case []byte:
		b.Write(val)
	case rune:
		b.WriteRune(val)
	}
	return b
}

func (b *Buffer) append(s string) *Buffer {
	defer func() {
		if err := recover(); err != nil {
			log.Printf("recover err: %v", err)
		}
	}()
	b.WriteString(s)
	return b
}

```

### Core Architecture Module: `examples/queue/kafka/main.go`
```
package main

import (
	"context"
	"log"

	"github.com/go-eagle/eagle/pkg/queue/kafka"
)

func main() {
	// 1. 初始化配置
	kafka.Load()
	defer kafka.Close()

	// 2. 获取配置信息（可选）
	configs := kafka.GetConfig()
	if len(configs) == 0 {
		log.Fatal("No kafka config found")
	}

	// 3. 使用配置进行消息发布
	ctx := context.Background()
	err := kafka.Publish(ctx, "default", "test-topic", "hello world")
	if err != nil {
		log.Printf("Failed to publish message: %v", err)
	}

	// 4. 使用配置进行消息消费
	handler := func(data []byte) error {
		log.Printf("Received message: %s", string(data))
		return nil
	}

	// 从默认实例消费
	go func() {
		err := kafka.ConsumePartition(ctx, "default", "test-topic", handler)
		if err != nil {
			log.Printf("Failed to consume message: %v", err)
		}
	}()

	// 从order实例消费
	go func() {
		err := kafka.ConsumePartition(ctx, "order", "order-topic", handler)
		if err != nil {
			log.Printf("Failed to consume message: %v", err)
		}
	}()

	select {}
}

```

### Core Architecture Module: `examples/queue/nats/main.go`
```
package main

import (
	"encoding/base64"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/go-eagle/eagle/pkg/queue/nats"
)

func main() {
	var (
		addr  = "nats://localhost:4222"
		topic = "hello"
	)
	producer := nats.NewProducer(addr)
	consumer := nats.NewConsumer(addr)

	published := make(chan struct{})
	received := make(chan struct{})
	wg := sync.WaitGroup{}
	wg.Add(2)
	go func() {
		for {
			select {
			case <-published:
				time.Sleep(3 * time.Second)
				if err := producer.Publish(topic, []byte("hello nats")); err != nil {
					log.Fatal(err)
				}
				log.Println("producer handler publish msg: ", "hello nats")

			case <-received:
				wg.Done()
				break
			}
		}
	}()
	go func() {
		for {
			// nolint: gosimple
			select {
			default:
				handler := func(message []byte) error {
					decodeMessage, _ := base64.StdEncoding.DecodeString(strings.Trim(string(message), "\""))
					log.Println("consumer handler receive msg: ", string(decodeMessage))
					received <- struct{}{}
					wg.Done()
					return nil
				}
				if err := consumer.Consume(topic, handler); err != nil {
					log.Fatal(err)
				}
				time.Sleep(5 * time.Second)
			}
		}
	}()

	published <- struct{}{}
	wg.Wait()
}

```

### Core Architecture Module: `examples/queue/rabbitmq/consumer/main.go`
```
package main

import (
	"context"
	"encoding/json"
	"os"
	"os/signal"
	"syscall"

	"github.com/go-eagle/eagle/pkg/queue/rabbitmq/options"

	"github.com/rabbitmq/amqp091-go"

	eagle "github.com/go-eagle/eagle/pkg/app"
	"github.com/go-eagle/eagle/pkg/config"

	"github.com/spf13/pflag"

	logger "github.com/go-eagle/eagle/pkg/log"

	"github.com/go-eagle/eagle/pkg/queue/rabbitmq"
)

var (
	cfgDir = pflag.StringP("config dir", "c", "config", "config path.")
	env    = pflag.StringP("env name", "e", "", "env var name.")
)

// cd examples/queue/rabbitmq/consumer/
// go run main.go
func main() {
	pflag.Parse()

	// init config
	c := config.New(*cfgDir, config.WithEnv(*env))
	var cfg eagle.Config
	if err := c.Load("app", &cfg); err != nil {
		panic(err)
	}
	// set global
	eagle.Conf = &cfg

	logger.Init()

	rabbitmq.Load()
	defer rabbitmq.Close()

	stopSig := make(chan os.Signal, 1)
	signal.Notify(stopSig, syscall.SIGINT, syscall.SIGTERM)

	done := make(chan struct{})
	stop := make(chan struct{}, 1)

	// 自定义消息处理函数
	handler := func(ctx context.Context, body amqp091.Delivery) (action rabbitmq.Action) {
		msg := make(map[string]interface{})
		err := json.Unmarshal(body.Body, &msg)
		if err != nil {
			logger.Errorf("consumer handler unmarshal msg err: %s", err.Error())
			return rabbitmq.NackDiscard
		}
		logger.Infof("consumer handler receive msg: %s", msg)
		return rabbitmq.Ack
	}

	// rabbitmq consume message
	ctx := context.Background()

	opts := []options.ConsumerOption{
		options.WithConsumerOptionConcurrency(1),
	}

	go func() {
		err := rabbitmq.Consume(ctx, "test-demo", handler, opts...)
		if err != nil {
			logger.Errorf("rabbitmq consume err: %s", err.Error())
		}
	}()

	for {
		select {
		case <-stopSig:
			logger.Info("received stop signal")
			stop <- struct{}{}
		case <-stop:
			logger.Info("stopping service")
			close(done)
			return
		case <-done:
			logger.Info("stopped service gracefully")
			return
		}
	}
}

```

### Core Architecture Module: `examples/queue/rabbitmq/consumer/server.go`
```
package main

import (
	"context"
	"encoding/json"

	"github.com/go-eagle/eagle/pkg/config"
	"github.com/rabbitmq/amqp091-go"
	"github.com/spf13/pflag"

	eagle "github.com/go-eagle/eagle/pkg/app"
	logger "github.com/go-eagle/eagle/pkg/log"
	"github.com/go-eagle/eagle/pkg/queue/rabbitmq"
	"github.com/go-eagle/eagle/pkg/queue/rabbitmq/options"
	RabbitMQ "github.com/go-eagle/eagle/pkg/transport/consumer/rabbitmq"
)

// cd examples/queue/rabbitmq/consumer/
// go run server.go
func main() {
	pflag.Parse()

	// init config
	c := config.New("config")
	var cfg eagle.Config
	if err := c.Load("app", &cfg); err != nil {
		panic(err)
	}
	// set global
	eagle.Conf = &cfg

	logger.Init()

	rabbitmq.Load()
	defer rabbitmq.Close()

	// 自定义消息处理函数
	handler := func(ctx context.Context, body amqp091.Delivery) (action rabbitmq.Action) {
		msg := make(map[string]interface{})
		err := json.Unmarshal(body.Body, &msg)
		if err != nil {
			logger.Errorf("consumer handler unmarshal msg err: %s", err.Error())
			return rabbitmq.NackDiscard
		}
		logger.Infof("consumer handler receive msg: %s", msg)
		return rabbitmq.Ack
	}
	handler2 := func(ctx context.Context, body amqp091.Delivery) (action rabbitmq.Action) {
		msg := make(map[string]interface{})
		err := json.Unmarshal(body.Body, &msg)
		if err != nil {
			logger.Errorf("consumer handler unmarshal msg err: %s", err.Error())
			return rabbitmq.NackDiscard
		}
		logger.Infof("consumer handler receive msg: %s", msg)
		return rabbitmq.Ack
	}

	// rabbitmq consume message
	opts := []options.ConsumerOption{
		options.WithConsumerOptionConcurrency(1),
	}

	srv := RabbitMQ.NewServer(opts...)

	// register subscriber can place into init function in internal/task/task.go
	err := srv.RegisterHandler("test-demo", handler)
	if err != nil {
		panic(err)
	}
	err = srv.RegisterHandler("test-multi", handler2)
	if err != nil {
		panic(err)
	}

	// start app
	app := eagle.New(
		eagle.WithName(cfg.Name),
		eagle.WithVersion(cfg.Version),
		eagle.WithLogger(logger.GetLogger()),
		eagle.WithServer(
			srv,
		),
	)

	if err := app.Run(); err != nil {
		panic(err)
	}
}

```

### Core Architecture Module: `examples/queue/rabbitmq/producer/delay_publish.go`
```
package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	eagle "github.com/go-eagle/eagle/pkg/app"
	"github.com/go-eagle/eagle/pkg/config"
	logger "github.com/go-eagle/eagle/pkg/log"
	"github.com/go-eagle/eagle/pkg/queue/rabbitmq"
	"github.com/go-eagle/eagle/pkg/queue/rabbitmq/options"
)

// 启动 rabbitmq
// docker run -it  --name rabbitmq -p 5672:5672 -p 15672:15672 -v $PWD/plugins:/plugins rabbitmq:3.10-management
// 访问ui: http://127.0.0.1:15672/
// cd examples/queue/rabbitmq/producer
// go run delay_publish.go
func main() {
	c := config.New(*cfgDir, config.WithEnv(*env))
	var cfg eagle.Config
	if err := c.Load("app", &cfg); err != nil {
		panic(err)
	}
	// set global
	eagle.Conf = &cfg

	logger.Init()

	rabbitmq.Load()
	defer rabbitmq.Close()

	opts := []options.PublishOption{
		options.WithPublishOptionContentType("application/json"),
	}

	var message string
	for i := 0; i < 100000; i++ {
		message = "Hello World RabbitMQ!" + time.Now().String()
		msg := map[string]interface{}{
			"message": message,
		}
		data, _ := json.Marshal(msg)
		if err := rabbitmq.PublishWithDelay(context.Background(), "test-demo", data, 10, opts...); err != nil {
			log.Fatalf("failed publish message: %s", err.Error())
		}
	}
}

```

### Core Architecture Module: `examples/queue/rabbitmq/producer/main.go`
```
package main

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/go-eagle/eagle/pkg/queue/rabbitmq/options"

	eagle "github.com/go-eagle/eagle/pkg/app"
	"github.com/go-eagle/eagle/pkg/config"
	logger "github.com/go-eagle/eagle/pkg/log"
	"github.com/spf13/pflag"

	"github.com/go-eagle/eagle/pkg/queue/rabbitmq"
)

var (
	cfgDir = pflag.StringP("config dir", "c", "config", "config path.")
	env    = pflag.StringP("env name", "e", "", "env var name.")
)

// 启动 rabbitmq
// docker run -it  --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3.10-management
// 访问ui: http://127.0.0.1:15672/
// cd examples/queue/rabbitmq/producer
// go run main.go
func main() {
	c := config.New(*cfgDir, config.WithEnv(*env))
	var cfg eagle.Config
	if err := c.Load("app", &cfg); err != nil {
		panic(err)
	}
	// set global
	eagle.Conf = &cfg

	logger.Init()

	rabbitmq.Load()
	defer rabbitmq.Close()

	opts := []options.PublishOption{
		options.WithPublishOptionContentType("application/json"),
	}

	go func() {
		var message string
		for i := 0; i < 100000; i++ {
			message = "Hello World RabbitMQ!" + time.Now().String()
			msg := map[string]interface{}{
				"message": message,
			}
			data, _ := json.Marshal(msg)
			if err := rabbitmq.Publish(context.Background(), "test-demo", data, opts...); err != nil {
				log.Fatalf("failed publish message: %s", err.Error())
			}
		}
	}()

	var message string
	for i := 0; i < 100000; i++ {
		message = "Hello World multi RabbitMQ!" + time.Now().String()
		msg := map[string]interface{}{
			"message": message,
		}
		data, _ := json.Marshal(msg)
		if err := rabbitmq.Publish(context.Background(), "test-multi", data, opts...); err != nil {
			log.Fatalf("failed publish message: %s", err.Error())
		}
	}

}

```

### Core Architecture Module: `examples/queue/redis/client.go`
```
package main

import (
	"sync"
	"time"

	"github.com/go-eagle/eagle/pkg/config"
	"github.com/hibiken/asynq"
)

var (
	client *asynq.Client
	once   sync.Once
)

type Config struct {
	Queue struct {
		Addr         string
		Password     string
		DB           int
		MinIdleConn  int
		DialTimeout  time.Duration
		ReadTimeout  time.Duration
		WriteTimeout time.Duration
		PoolSize     int
		PoolTimeout  time.Duration
		Concurrency  int //并发数
	} `json:"redis"`
}

func GetClient() *asynq.Client {
	once.Do(func() {
		//c := config.New("config", config.WithEnv("local"))
		c := config.New(".")
		var cfg Config
		if err := c.Load("redis", &cfg); err != nil {
			panic(err)
		}
		client = asynq.NewClient(asynq.RedisClientOpt{
			Addr:         cfg.Queue.Addr,
			Password:     cfg.Queue.Password,
			DB:           cfg.Queue.DB,
			DialTimeout:  cfg.Queue.DialTimeout,
			ReadTimeout:  cfg.Queue.ReadTimeout,
			WriteTimeout: cfg.Queue.WriteTimeout,
			PoolSize:     cfg.Queue.PoolSize,
		})
	})
	return client
}

```

### Core Architecture Module: `examples/queue/redis/handler.go`
```
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/pkg/errors"

	"github.com/hibiken/asynq"
)

const (
	TypeEmailWelcome = "email:welcome"
)

type EmailWelcomePayload struct {
	UserID int64
}

//----------------------------------------------
// Write a function NewXXXTask to create a task.
// A task consists of a type and a payload.
//----------------------------------------------

func NewEmailWelcomeTask(data EmailWelcomePayload) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return errors.Wrapf(err, "json marshal error, name: %s", TypeEmailWelcome)
	}
	task := asynq.NewTask(TypeEmailWelcome, payload)
	_, err = GetClient().Enqueue(task)
	if err != nil {
		return errors.Wrapf(err, "Enqueue task error, name: %s", TypeEmailWelcome)
	}
	return nil
}

//---------------------------------------------------------------
// Write a function HandleXXXTask to handle the input task.
// Note that it satisfies the asynq.HandlerFunc interface.
//
// Handler doesn't need to be a function. You can define a type
// that satisfies asynq.Handler interface. See examples below.
//---------------------------------------------------------------

func HandleEmailWelcomeTask(ctx context.Context, t *asynq.Task) error {
	var p EmailWelcomePayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("json.Unmarshal failed: %v: %w", err, asynq.SkipRetry)
	}
	log.Printf("Sending Email to User: user_id=%d", p.UserID)
	// Email delivery code ...
	return nil
}

```

### Core Architecture Module: `examples/queue/redis/producer.go`
```
package main

import "time"

// cd examples/queue/redis/consumer/
// go run producer.go handler.go client.go
func main() {
	for i := 0; i < 10; i++ {
		err := NewEmailWelcomeTask(EmailWelcomePayload{
			UserID: time.Now().Unix(),
		})
		if err != nil {
			panic(err)
		}
		time.Sleep(time.Second)
	}
}

```

### Core Architecture Module: `examples/queue/redis/server.go`
```
package main

import (
	eagle "github.com/go-eagle/eagle/pkg/app"
	"github.com/go-eagle/eagle/pkg/config"
	logger "github.com/go-eagle/eagle/pkg/log"
	redisMQ "github.com/go-eagle/eagle/pkg/transport/consumer/redis"
	"github.com/hibiken/asynq"
	"github.com/spf13/pflag"
)

// redis queue consumer
// cd examples/queue/redis/consumer/
// go run server.go handler.go client.go
func main() {
	pflag.Parse()

	// init config
	c := config.New(".")
	var cfg eagle.Config
	if err := c.Load("app", &cfg); err != nil {
		panic(err)
	}
	// set global
	eagle.Conf = &cfg

	logger.Init()

	srv := redisMQ.NewServer(
		asynq.RedisClientOpt{Addr: "localhost:6379"},
		asynq.Config{
			// Specify how many concurrent workers to use
			Concurrency: 10,
			// Optionally specify multiple queues with different priority.
			Queues: map[string]int{
				redisMQ.QueueCritical: 6,
				redisMQ.QueueDefault:  3,
				redisMQ.QueueLow:      1,
			},
			// See the godoc for other configuration options
		},
	)

	// register handler
	srv.RegisterHandler(TypeEmailWelcome, HandleEmailWelcomeTask)
	// here register other handlers...

	// start app
	app := eagle.New(
		eagle.WithName(cfg.Name),
		eagle.WithVersion(cfg.Version),
		eagle.WithLogger(logger.GetLogger()),
		eagle.WithServer(
			srv,
		),
	)

	if err := app.Run(); err != nil {
		panic(err)
	}
}

```

### Core Architecture Module: `pkg/lock/utils.go`
```
package lock

import (
	"github.com/google/uuid"
)

// genToken 生成token
func genToken() string {
	u, _ := uuid.NewRandom()
	return u.String()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #80** (2023-03-10): **invalid argument "eagle:github.com/go-eagle/eagle/pkg/version" for "-t, --tag" flag: invalid reference format**
  *Symptoms*: **Describe the bug** invalid argument "eagle:github.com/go-eagle/eagle/pkg/version" for "-t, --tag" flag: invalid reference format  **To Reproduce** Steps to reproduce the behavior: ```shell ➜  eagle git:(master) ✗ make docker                                docker build -t eagle:"github.com/go-eagle/eagle/pkg/version" -f Dockeffile . invalid argument "eagle:github.com/go-eagle/eagle/pkg/version" for "-t, --tag" flag: invalid reference format See 'docker build --help'. make: *** [docker] Error 125 ➜  eagle git:(master) ✗  ```  **Expected behavior** build success  **Screenshots** If applicable, add screenshots to help explain your problem.  **Desktop (please complete the following information):**  - OS:  macOS m2  - Browser [e.g. chrome, safari]  - Version [e.g. 22]  **Smartphone (please complete the following information):**  - Device: [e.g. iPhone6]  - OS: [e.g. iOS8.1]  - Browser [e.g. stock browser, safari]  - Version [e.g. 22]  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > fixed, thank you.  @zishiguo 

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

### Incident Patch 1: `b1301b09` (2025-11-28)
**Commit Message**: fix: 更新时删除本地存储 (#207)

* fix:cache重复引用修复

* fix:repo更新需要删除localStorage

---------

**File**: `cmd/eagle/internal/repo/add/template.go` (modified, +1/-0)
```diff
@@ -102,6 +102,7 @@ func (r *{{.LcName}}Repo) Update{{.Name}}(ctx context.Context, id int64, data *m
 {{- if .WithCache }}
 	// delete cache
 	_ = r.cache.Del{{.Name}}Cache(ctx, id)
+	_ = r.localCache.Del(ctx, cast.ToString(id))
 {{- end }}
 	return nil
 }
```

---

### Incident Patch 2: `67338dcd` (2025-11-04)
**Commit Message**: fix:cache重复引用修复 (#203)

**File**: `cmd/eagle/internal/repo/add/template.go` (modified, +1/-2)
```diff
@@ -16,7 +16,6 @@ import (
 	"time"
 
 	localCache "github.com/go-eagle/eagle/pkg/cache"
-	cacheBase "github.com/go-eagle/eagle/pkg/cache"
 	"github.com/go-eagle/eagle/pkg/encoding"
 	"github.com/pkg/errors"
 	"github.com/spf13/cast"
@@ -125,7 +124,7 @@ func (r *{{.LcName}}Repo) Get{{.Name}}(ctx context.Context, id int64) (ret *mode
 
 	// read redis cache
 	ret, err = r.cache.Get{{.Name}}Cache(ctx, id)
-	if errors.Is(err, cacheBase.ErrPlaceholder) {
+	if errors.Is(err, localCache.ErrPlaceholder) {
 		return nil, gorm.ErrRecordNotFound
 	} else if errors.Is(err, redis.ErrRedisNotFound) {
 		// get data from db
```

---

### Incident Patch 3: `ea86892d` (2024-08-11)
**Commit Message**: docs: update quick start

**File**: `README.md` (modified, +3/-4)
```diff
@@ -70,6 +70,8 @@ Eagle utilizes a classic layered structure and employs the Wire dependency injec
 ## Installtion CLI
 
 ```bash
+GOPROXY="https://goproxy.cn,direct"
+
 # go >= 1.16
 go install github.com/go-eagle/eagle/cmd/eagle@latest
 
@@ -90,11 +92,8 @@ eagle new -b=all eagle-demo
 # or 
 eagle new github.com/foo/eagle-demo
 
-# build
-make build
-
 # run
-eagle run
+make run
 ```
 
 ## Documentation
```

---

### Incident Patch 4: `03d5f0eb` (2024-08-01)
**Commit Message**: docs: update cmd  param for Quick Start

**File**: `README.md` (modified, +1/-1)
```diff
@@ -86,7 +86,7 @@ eagle new eagle-demo
 eagle new github.com/foo/eagle-demo
 
 # gen a server with http and gRPC
-eagle new -b=all eagle-demo
+eagle new -b=main eagle-demo
 # or 
 eagle new github.com/foo/eagle-demo
 
```

---

### Incident Patch 5: `a408ad1b` (2024-08-01)
**Commit Message**: docs: update cmd for Quick Start

**File**: `README.md` (modified, +3/-3)
```diff
@@ -90,11 +90,11 @@ eagle new -b=all eagle-demo
 # or 
 eagle new github.com/foo/eagle-demo
 
-# build
-make build
+# install dependence
+go mod tidy
 
 # run
-eagle run
+make run
 ```
 
 ## Documentation
```

---

### Incident Patch 6: `dc82346e` (2024-07-10)
**Commit Message**: fix: fix environment fetch problem && fix eagle run (#141)

**File**: `cmd/eagle/internal/run/run.go` (modified, +3/-1)
```diff
@@ -45,7 +45,8 @@ func Run(cmd *cobra.Command, args []string) {
 			return
 		} else if len(cmdPath) == 1 {
 			for k, v := range cmdPath {
-				dir = path.Join(v, k)
+				selectedDir = k
+				dir = v
 			}
 		} else {
 			var cmdPaths []string
@@ -71,6 +72,7 @@ func Run(cmd *cobra.Command, args []string) {
 
 	// go run /path/cmd/server
 	fd := exec.Command("go", []string{"run", path.Join(dir, selectedDir)}...)
+	fd.Env = os.Environ()
 	fd.Stdout = os.Stdout
 	fd.Stderr = os.Stderr
 	fd.Dir = dir
```

---

### Incident Patch 7: `f6f8018d` (2024-06-22)
**Commit Message**: chore: add timeout for db and add default param for new command (#137)

**File**: `CHANGELOG.md` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
 ## v1.8.2
 - feat: support PostgreSQL
 - feat: support config multiple databases
-- chore(cli): generate project by adding branch name
+- chore(cli): generate project by adding branch name, default is http server
+- chore(db): add timeout for connect, read and write
 
 ## v1.8.1
 - fix: GitHub workflow badge URL
```

**File**: `README.md` (modified, +6/-0)
```diff
@@ -80,10 +80,16 @@ go get github.com/go-eagle/eagle/cmd/eagle
 ## Quick Start
 
 ```bash
+# only gen a server with http
 eagle new eagle-demo
 # or 
 eagle new github.com/foo/eagle-demo
 
+# gen a server with http and gRPC
+eagle new -b=all eagle-demo
+# or 
+eagle new github.com/foo/eagle-demo
+
 # build
 make build
 
```

**File**: `cmd/eagle/internal/project/project.go` (modified, +11/-7)
```diff
@@ -20,28 +20,32 @@ var CmdNew = &cobra.Command{
 }
 
 var (
-	repoURL        string
-	branch         string
-	defaultTimeout string
+	repoURL string
+	branch  string
+	timeout string
 )
 
 func init() {
 	if repoURL = os.Getenv("EAGLE_LAYOUT_REPO"); repoURL == "" {
 		repoURL = "https://github.com/go-eagle/eagle-layout.git"
 	}
 
-	defaultTimeout = "60s"
+	// default http, only include http server
+	branch = "http"
+	// default timeout
+	timeout = "60s"
+
 	CmdNew.Flags().StringVarP(&repoURL, "repo-url", "r", repoURL, "layout repo")
-	CmdNew.Flags().StringVarP(&branch, "branch", "b", branch, "repo branch name")
-	CmdNew.Flags().StringVarP(&defaultTimeout, "timeout", "t", defaultTimeout, "request timeout time")
+	CmdNew.Flags().StringVarP(&branch, "branch", "b", branch, "default is http server, empty is http and gRPC")
+	CmdNew.Flags().StringVarP(&timeout, "timeout", "t", timeout, "request timeout time")
 }
 
 func run(cmd *cobra.Command, args []string) {
 	wd, err := os.Getwd()
 	if err != nil {
 		panic(err)
 	}
-	t, err := time.ParseDuration(defaultTimeout)
+	t, err := time.ParseDuration(timeout)
 	if err != nil {
 		panic(err)
 	}
```

**File**: `cmd/eagle/main.go` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ import (
 
 var (
 	// Version is the version of the compiled software.
-	Version = "v0.17.0"
+	Version = "v0.18.0"
 
 	rootCmd = &cobra.Command{
 		Use:     "eagle",
```

---

### Incident Patch 8: `dc50d00a` (2024-06-13)
**Commit Message**: chore: add timeout for db (#134)

**File**: `config/docker/database.yaml` (modified, +4/-1)
```diff
@@ -7,5 +7,8 @@ default:
   ShowLog: true                   # 是否打印所有SQL日志
   MaxIdleConn: 10                 # 最大闲置的连接数，0意味着使用默认的大小2， 小于0表示不使用连接池
   MaxOpenConn: 60                 # 最大打开的连接数, 需要小于数据库配置中的max_connections数
+  Timeout: 3s                     # 数据库连接超时时间
+  ReadTimeout: 3s                 # 数据库去读超时时间, 0代表不限制
+  WriteTimeout: 3s                # 数据库写入超时时间, 0代表不限制
   ConnMaxLifeTime: 4h             # 单个连接最大存活时间，建议设置比数据库超时时长(wait_timeout)稍小一些
-  SlowThreshold: 500ms            # 慢查询阈值，设置后只打印慢查询日志，默认为200ms
\ No newline at end of file
+  SlowThreshold: 500ms            # 慢查询阈值，设置后只打印慢查询日志，默认为200ms
```

**File**: `config/local/database.yaml` (modified, +6/-0)
```diff
@@ -7,6 +7,9 @@ default:
   ShowLog: true                   # 是否打印所有SQL日志
   MaxIdleConn: 10                 # 最大闲置的连接数，0意味着使用默认的大小2， 小于0表示不使用连接池
   MaxOpenConn: 60                 # 最大打开的连接数, 需要小于数据库配置中的max_connections数
+  Timeout: 3s 					  # 数据库连接超时时间, 如果是 PostgreSQL 不需要加入单位
+  ReadTimeout: 3s 				  # 数据库去读超时时间, 0代表不限制，如果是PostgreSQL, 3000代表3s
+  WriteTimeout: 3s 				  # 数据库写入超时时间, 0代表不限制，如果是PostgreSQL, 不会使用该字段的值
   ConnMaxLifeTime: 4h             # 单个连接最大存活时间，建议设置比数据库超时时长(wait_timeout)稍小一些
   SlowThreshold: 500ms            # 慢查询阈值，设置后只打印慢查询日志，默认为200ms
 user:
@@ -18,5 +21,8 @@ user:
   ShowLog: true                   # 是否打印所有SQL日志
   MaxIdleConn: 10                 # 最大闲置的连接数，0意味着使用默认的大小2， 小于0表示不使用连接池
   MaxOpenConn: 60                 # 最大打开的连接数, 需要小于数据库配置中的max_connections数
+  Timeout: 3s 					  # 数据库连接超时时间
+  ReadTimeout: 3s 				  # 数据库去读超时时间, 0代表不限制
+  WriteTimeout: 3s 				  # 数据库写入超时时间, 0代表不限制
   ConnMaxLifeTime: 4h             # 单个连接最大存活时间，建议设置比数据库超时时长(wait_timeout)稍小一些
   SlowThreshold: 500ms            # 慢查询阈值，设置后只打印慢查询日志，默认为200ms
```

**File**: `pkg/storage/orm/orm.go` (modified, +12/-3)
```diff
@@ -46,6 +46,9 @@ type Config struct {
 	ShowLog         bool
 	MaxIdleConn     int
 	MaxOpenConn     int
+	Timeout         string // connect timeout
+	ReadTimeout     string
+	WriteTimeout    string
 	ConnMaxLifeTime time.Duration
 	SlowThreshold   time.Duration // 慢查询时长，默认500ms
 }
@@ -189,21 +192,27 @@ func LoadConf(name string) (ret *Config, err error) {
 // getDSN return dsn string
 func getDSN(c *Config) string {
 	// default mysql
-	dsn := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4&parseTime=%t&loc=%s",
+	dsn := fmt.Sprintf("%s:%s@tcp(%s)/%s?charset=utf8mb4&parseTime=%t&loc=%s&timeout=%s%readTimeout=%s%writeTimeout=%s",
 		c.UserName,
 		c.Password,
 		c.Addr,
 		c.Name,
 		true,
 		//"Asia/Shanghai"),
-		"Local")
+		"Local",
+		c.Timeout,
+		c.ReadTimeout,
+		c.WriteTimeout,
+	)
 
 	if c.Driver == DriverPostgres {
-		dsn = fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=disable",
+		dsn = fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=disable&connect_timeout=%s%statement_timeout=%s",
 			c.UserName,
 			c.Password,
 			c.Addr,
 			c.Name,
+			c.Timeout,
+			c.ReadTimeout,
 		)
 	}
 
```

---

### Incident Patch 9: `fa409a75` (2024-03-31)
**Commit Message**: docs: fix typo

**File**: `README.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ English | [中文文档](https://github.com/go-eagle/eagle/blob/master/README_ZH
 - Router [Gin](https://github.com/gin-gonic/gin) 
 - Middleware [Gin](https://github.com/gin-gonic/gin) 
 - Database [GORM](https://github.com/jinzhu/gorm)
-- Document [Swagger](https://swagger.io/) 生成
+- Document [Swagger](https://swagger.io/) 
 - Config [Viper](https://github.com/spf13/viper)
 - Auth [JWT](https://jwt.io/) 
 - Validator [validator](https://github.com/go-playground/validator)
```

---

### Incident Patch 10: `ef56beb2` (2023-10-21)
**Commit Message**: fix: GitHub workflow badge URL (#113)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # 🦅 eagle
 
- [![GitHub Workflow Status](https://img.shields.io/github/workflow/status/go-eagle/eagle/Go?style=flat-square)](https://github.com/go-eagle/eagle)
+ [![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/go-eagle/eagle/test.yml?branch=master&style=flat-square)](https://github.com/go-eagle/eagle)
  [![codecov](https://codecov.io/gh/go-eagle/eagle/branch/master/graph/badge.svg)](https://codecov.io/gh/go-eagle/eagle)
  [![GolangCI](https://golangci.com/badges/github.com/golangci/golangci-lint.svg)](https://golangci.com)
  [![godoc](https://godoc.org/github.com/go-eagle/eagle?status.svg)](https://godoc.org/github.com/go-eagle/eagle)
```

---

### Incident Patch 11: `98808b7c` (2023-08-08)
**Commit Message**: chore: modify tag prefix

**File**: `.github/workflows/deploy.yml` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ name: Deploy
 on:
   push:
     tags:
-    - 'v*.*.*'
+    - 'release*.*.*'
 
 jobs:
 
@@ -59,4 +59,4 @@ jobs:
     - name: Deploy image to Amazon EKS
       run: |
         kubectl apply -f deploy/k8s/go-deployment.yaml
-        kubectl apply -f deploy/k8s/go-service.yaml
\ No newline at end of file
+        kubectl apply -f deploy/k8s/go-service.yaml
```

#### Recent Merged Pull Requests:
- **PR #213** (closed): chore(deps): bump github.com/jackc/pgx/v5 from 5.5.4 to 5.9.0 (@dependabot[bot])
- **PR #209** (closed): chore(deps): bump go.opentelemetry.io/otel/sdk from 1.24.0 to 1.40.0 (@dependabot[bot])
- **PR #208** (closed): chore(deps): bump github.com/nats-io/nats-server/v2 from 2.9.0 to 2.11.12 (@dependabot[bot])
- **PR #207** (2025-11-28): 更新时删除本地存储 (@cjl2029)
- **PR #205** (2025-11-20): chore(deps): bump golang.org/x/crypto from 0.35.0 to 0.45.0 in /cmd/eagle (@dependabot[bot])
- **PR #203** (2025-11-04): fix:cache重复引用修复 (@cjl2029)
- **PR #201** (2025-10-28): chore: improve gorm logger writter (@qloog)
- **PR #198** (2025-10-14): feat: add pointer func (@qloog)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
