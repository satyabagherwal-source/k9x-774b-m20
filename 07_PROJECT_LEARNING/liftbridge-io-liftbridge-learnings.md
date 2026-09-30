# Forensic Learning Record (Deep Inspection): liftbridge-io/liftbridge

> **Canonical Artifact**: `07_PROJECT_LEARNING/liftbridge-io-liftbridge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/liftbridge-io/liftbridge](https://github.com/liftbridge-io/liftbridge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:45:55.971Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `liftbridge-io/liftbridge`
- **Description**: Kafka-style message streaming in Go. Built on NATS. Single binary,  no JVM, no ZooKeeper.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2802 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/common/message.go`
```
package common

import (
	"crypto/rand"
	"fmt"
)

// PreparedMessage holds a pre-generated message ready for publishing.
type PreparedMessage struct {
	Key   []byte
	Value []byte
}

// PreGenerateMessages creates all message batches upfront.
// This allows benchmarks to measure pure ingestion performance
// without including data generation time.
func PreGenerateMessages(numMessages, messageSize, batchSize int) [][]PreparedMessage {
	if batchSize <= 0 {
		batchSize = numMessages
	}

	numBatches := numMessages / batchSize
	remainder := numMessages % batchSize

	// Allocate batches
	totalBatches := numBatches
	if remainder > 0 {
		totalBatches++
	}

	batches := make([][]PreparedMessage, totalBatches)

	// Pre-generate the payload template once
	payload := make([]byte, messageSize)
	rand.Read(payload)

	msgIndex := 0
	for i := 0; i < numBatches; i++ {
		batches[i] = make([]PreparedMessage, batchSize)
		for j := 0; j < batchSize; j++ {
			batches[i][j] = PreparedMessage{
				Key:   []byte(fmt.Sprintf("key-%d", msgIndex)),
				Value: generatePayload(messageSize, payload),
			}
			msgIndex++
		}
	}

	// Handle remainder
	if remainder > 0 {
		batches[numBatches] = make([]PreparedMessage, remainder)
		for j := 0; j < remainder; j++ {
			batches[numBatches][j] = PreparedMessage{
				Key:   []byte(fmt.Sprintf("key-%d", msgIndex)),
				Value: generatePayload(messageSize, payload),
			}
			msgIndex++
		}
	}

	return batches
}

// PreGenerateMessagesFlat creates all messages as a flat slice.
// Useful when batch structure isn't needed.
func PreGenerateMessagesFlat(numMessages, messageSize int) []PreparedMessage {
	messages := make([]PreparedMessage, numMessages)

	// Pre-generate the payload template once
	payload := make([]byte, messageSize)
	rand.Read(payload)

	for i := 0; i < numMessages; i++ {
		messages[i] = PreparedMessage{
			Key:   []byte(fmt.Sprintf("key-%d", i)),
			Value: generatePayload(messageSize, payload),
		}
	}

	return messages
}

// generatePayload creates a new payload by copying and slightly modifying the template.
// This is more efficient than calling crypto/rand for every message.
func generatePayload(size int, template []byte) []byte {
	payload := make([]byte, size)
	copy(payload, template)
	// Add some variation by modifying a few bytes
	if size > 8 {
		rand.Read(payload[:8])
	}
	return payload
}

// TotalMessageCount returns the total number of messages across all batches.
func TotalMessageCount(batches [][]PreparedMessage) int {
	total := 0
	for _, batch := range batches {
		total += len(batch)
	}
	return total
}

// TotalByteSize returns the total bytes across all messages.
func TotalByteSize(batches [][]PreparedMessage) int64 {
	var total int64
	for _, batch := range batches {
		for _, msg := range batch {
			total += int64(len(msg.Value))
		}
	}
	return total
}

```

### Core Architecture Module: `bench/common/output.go`
```
package common

import (
	"encoding/json"
	"fmt"
	"os"
	"text/tabwriter"

	"github.com/dustin/go-humanize"
)

// BenchmarkResult holds the formatted benchmark results.
type BenchmarkResult struct {
	Duration          string  `json:"duration"`
	TotalMessages     int64   `json:"total_messages"`
	TotalBytes        int64   `json:"total_bytes"`
	MessagesPerSecond float64 `json:"messages_per_second"`
	BytesPerSecond    float64 `json:"bytes_per_second"`
	MBPerSecond       float64 `json:"mb_per_second"`
	LatencyMin        string  `json:"latency_min,omitempty"`
	LatencyMean       string  `json:"latency_mean,omitempty"`
	LatencyP50        string  `json:"latency_p50,omitempty"`
	LatencyP95        string  `json:"latency_p95,omitempty"`
	LatencyP99        string  `json:"latency_p99,omitempty"`
	LatencyP999       string  `json:"latency_p999,omitempty"`
	LatencyMax        string  `json:"latency_max,omitempty"`
	Errors            int64   `json:"errors"`
}

// PrintProducerResults outputs the producer benchmark results.
func PrintProducerResults(stats *Stats, format string) {
	result := BenchmarkResult{
		Duration:          stats.Duration().String(),
		TotalMessages:     stats.MessagesSent(),
		TotalBytes:        stats.BytesSent(),
		MessagesPerSecond: stats.MessagesPerSecond(),
		BytesPerSecond:    stats.BytesPerSecond(),
		MBPerSecond:       stats.MBPerSecond(),
		Errors:            stats.Errors(),
	}

	// Include latency stats if we have samples
	if stats.LatencyCount() > 0 {
		result.LatencyMin = stats.LatencyMin().String()
		result.LatencyMean = stats.LatencyMean().String()
		result.LatencyP50 = stats.LatencyPercentile(50).String()
		result.LatencyP95 = stats.LatencyPercentile(95).String()
		result.LatencyP99 = stats.LatencyPercentile(99).String()
		result.LatencyP999 = stats.LatencyPercentile(99.9).String()
		result.LatencyMax = stats.LatencyMax().String()
	}

	switch format {
	case "json":
		printJSON(result)
	default:
		printTextProducer(result)
	}
}

// PrintConsumerResults outputs the consumer benchmark results.
func PrintConsumerResults(stats *Stats, format string) {
	result := BenchmarkResult{
		Duration:          stats.Duration().String(),
		TotalMessages:     stats.MessagesReceived(),
		TotalBytes:        stats.BytesReceived(),
		MessagesPerSecond: stats.MessagesPerSecond(),
		BytesPerSecond:    stats.BytesPerSecond(),
		MBPerSecond:       stats.MBPerSecond(),
		Errors:            stats.Errors(),
	}

	switch format {
	case "json":
		printJSON(result)
	default:
		printTextConsumer(result)
	}
}

func printJSON(result BenchmarkResult) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.Encode(result)
}

func printTextProducer(r BenchmarkResult) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "=== Producer Benchmark Results ===")
	fmt.Fprintln(w, "")
	fmt.Fprintf(w, "Duration:\t%s\n", r.Duration)
	fmt.Fprintf(w, "Messages Sent:\t%s\n", humanize.Comma(r.TotalMessages))
	fmt.Fprintf(w, "Bytes Sent:\t%s\n", humanize.Bytes(uint64(r.TotalBytes)))
	fmt.Fprintf(w, "Throughput:\t%s msgs/sec\n", humanize.CommafWithDigits(r.MessagesPerSecond, 2))
	fmt.Fprintf(w, "Bandwidth:\t%.2f MB/sec\n", r.MBPerSecond)
	fmt.Fprintln(w, "")

	if r.LatencyP50 != "" {
		fmt.Fprintln(w, "--- Ack Latency ---")
		fmt.Fprintf(w, "Min:\t%s\n", r.LatencyMin)
		fmt.Fprintf(w, "Mean:\t%s\n", r.LatencyMean)
		fmt.Fprintf(w, "P50:\t%s\n", r.LatencyP50)
		fmt.Fprintf(w, "P95:\t%s\n", r.LatencyP95)
		fmt.Fprintf(w, "P99:\t%s\n", r.LatencyP99)
		fmt.Fprintf(w, "P99.9:\t%s\n", r.LatencyP999)
		fmt.Fprintf(w, "Max:\t%s\n", r.LatencyMax)
		fmt.Fprintln(w, "")
	}

	fmt.Fprintf(w, "Errors:\t%d\n", r.Errors)
	fmt.Fprintln(w, "")
	w.Flush()
}

func printTextConsumer(r BenchmarkResult) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "=== Consumer Benchmark Results ===")
	fmt.Fprintln(w, "")
	fmt.Fprintf(w, "Duration:\t%s\n", r.Duration)
	fmt.Fprintf(w, "Messages Received:\t%s\n", humanize.Comma(r.TotalMessages))
	fmt.Fprintf(w, "Bytes Received:\t%s\n", humanize.Bytes(uint64(r.TotalBytes)))
	fmt.Fprintf(w, "Throughput:\t%s msgs/sec\n", humanize.CommafWithDigits(r.MessagesPerSecond, 2))
	fmt.Fprintf(w, "Bandwidth:\t%.2f MB/sec\n", r.MBPerSecond)
	fmt.Fprintln(w, "")
	fmt.Fprintf(w, "Errors:\t%d\n", r.Errors)
	fmt.Fprintln(w, "")
	w.Flush()
}

```

### Core Architecture Module: `bench/common/stats.go`
```
package common

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/HdrHistogram/hdrhistogram-go"
)

// Stats tracks benchmark statistics including throughput and latency.
type Stats struct {
	mu        sync.Mutex
	startTime time.Time
	endTime   time.Time

	messagesSent int64
	messagesRecv int64
	bytesSent    int64
	bytesRecv    int64
	errors       int64

	// HDR histogram for latency tracking (in microseconds)
	// Range: 1 microsecond to 60 seconds, 3 significant figures
	latencyHist *hdrhistogram.Histogram
}

// NewStats creates a new Stats instance with HDR histogram initialized.
func NewStats() *Stats {
	return &Stats{
		latencyHist: hdrhistogram.New(1, 60000000, 3),
	}
}

// Start begins the timing period.
func (s *Stats) Start() {
	s.startTime = time.Now()
}

// Stop ends the timing period.
func (s *Stats) Stop() {
	s.endTime = time.Now()
}

// RecordSent records a sent message with its byte size.
func (s *Stats) RecordSent(bytes int) {
	atomic.AddInt64(&s.messagesSent, 1)
	atomic.AddInt64(&s.bytesSent, int64(bytes))
}

// RecordReceived records a received message with its byte size.
func (s *Stats) RecordReceived(bytes int) {
	atomic.AddInt64(&s.messagesRecv, 1)
	atomic.AddInt64(&s.bytesRecv, int64(bytes))
}

// RecordLatency records a latency measurement.
func (s *Stats) RecordLatency(d time.Duration) {
	s.mu.Lock()
	s.latencyHist.RecordValue(d.Microseconds())
	s.mu.Unlock()
}

// RecordError increments the error counter.
func (s *Stats) RecordError() {
	atomic.AddInt64(&s.errors, 1)
}

// Duration returns the total benchmark duration.
func (s *Stats) Duration() time.Duration {
	return s.endTime.Sub(s.startTime)
}

// MessagesSent returns the total messages sent.
func (s *Stats) MessagesSent() int64 {
	return atomic.LoadInt64(&s.messagesSent)
}

// MessagesReceived returns the total messages received.
func (s *Stats) MessagesReceived() int64 {
	return atomic.LoadInt64(&s.messagesRecv)
}

// TotalMessages returns sent + received messages.
func (s *Stats) TotalMessages() int64 {
	return s.MessagesSent() + s.MessagesReceived()
}

// BytesSent returns the total bytes sent.
func (s *Stats) BytesSent() int64 {
	return atomic.LoadInt64(&s.bytesSent)
}

// BytesReceived returns the total bytes received.
func (s *Stats) BytesReceived() int64 {
	return atomic.LoadInt64(&s.bytesRecv)
}

// TotalBytes returns sent + received bytes.
func (s *Stats) TotalBytes() int64 {
	return s.BytesSent() + s.BytesReceived()
}

// Errors returns the total error count.
func (s *Stats) Errors() int64 {
	return atomic.LoadInt64(&s.errors)
}

// MessagesPerSecond calculates the message throughput.
func (s *Stats) MessagesPerSecond() float64 {
	duration := s.Duration().Seconds()
	if duration == 0 {
		return 0
	}
	return float64(s.TotalMessages()) / duration
}

// BytesPerSecond calculates the byte throughput.
func (s *Stats) BytesPerSecond() float64 {
	duration := s.Duration().Seconds()
	if duration == 0 {
		return 0
	}
	return float64(s.TotalBytes()) / duration
}

// MBPerSecond calculates the MB/s throughput.
func (s *Stats) MBPerSecond() float64 {
	return s.BytesPerSecond() / 1024 / 1024
}

// LatencyPercentile returns the latency at a given percentile.
func (s *Stats) LatencyPercentile(p float64) time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Duration(s.latencyHist.ValueAtQuantile(p)) * time.Microsecond
}

// LatencyMean returns the mean latency.
func (s *Stats) LatencyMean() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Duration(s.latencyHist.Mean()) * time.Microsecond
}

// LatencyMin returns the minimum latency recorded.
func (s *Stats) LatencyMin() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Duration(s.latencyHist.Min()) * time.Microsecond
}

// LatencyMax returns the maximum latency recorded.
func (s *Stats) LatencyMax() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Duration(s.latencyHist.Max()) * time.Microsecond
}

// LatencyCount returns the number of latency samples recorded.
func (s *Stats) LatencyCount() int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.latencyHist.TotalCount()
}

```

### Core Architecture Module: `bench/consumer/main.go`
```
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	lift "github.com/liftbridge-io/go-liftbridge/v2"
	"github.com/urfave/cli"

	"github.com/liftbridge-io/liftbridge/bench/common"
)

func main() {
	app := cli.NewApp()
	app.Name = "liftbridge-bench-consumer"
	app.Usage = "Benchmark tool for Liftbridge message consumption"
	app.Version = "1.0.0"
	app.Flags = getFlags()
	app.Action = run
	if err := app.Run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func getFlags() []cli.Flag {
	return []cli.Flag{
		cli.StringSliceFlag{
			Name:   "servers, s",
			Usage:  "Liftbridge server addresses",
			EnvVar: "LIFTBRIDGE_SERVERS",
		},
		cli.StringFlag{
			Name:  "stream",
			Usage: "Stream name to consume from",
			Value: "bench-stream",
		},
		cli.IntFlag{
			Name:  "partition",
			Usage: "Partition to consume from",
			Value: 0,
		},
		cli.IntFlag{
			Name:  "expected, n",
			Usage: "Expected number of messages to consume (0 = unlimited)",
			Value: 0,
		},
		cli.DurationFlag{
			Name:  "duration, d",
			Usage: "Maximum duration to run the consumer benchmark",
			Value: 30 * time.Second,
		},
		cli.StringFlag{
			Name:  "start",
			Usage: "Start position: earliest, latest, offset:<n>",
			Value: "earliest",
		},
		cli.StringFlag{
			Name:  "output, o",
			Usage: "Output format: text, json",
			Value: "text",
		},
	}
}

func run(c *cli.Context) error {
	// Parse servers
	servers := c.StringSlice("servers")
	if len(servers) == 0 {
		servers = []string{"localhost:9292"}
	}
	servers = normalizeServers(servers)

	streamName := c.String("stream")
	partition := c.Int("partition")
	expected := c.Int("expected")
	duration := c.Duration("duration")
	startPos := c.String("start")
	outputFormat := c.String("output")

	// Connect to Liftbridge
	fmt.Printf("Connecting to Liftbridge: %v\n", servers)
	client, err := lift.Connect(servers)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	// Parse start option
	startOpt, err := parseStartOption(startPos)
	if err != nil {
		return err
	}

	// Setup stats
	stats := common.NewStats()

	// Setup cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Message counter
	var messageCount int64
	var closeOnce sync.Once
	done := make(chan struct{})

	fmt.Printf("Subscribing to stream '%s' partition %d...\n", streamName, partition)
	if expected > 0 {
		fmt.Printf("Will consume until %d messages received or %s timeout\n", expected, duration)
	} else {
		fmt.Printf("Will consume for %s\n", duration)
	}
	fmt.Println("---")

	// Start benchmark
	stats.Start()

	// Subscribe
	err = client.Subscribe(ctx, streamName, func(msg *lift.Message, err error) {
		if err != nil {
			stats.RecordError()
			return
		}

		stats.RecordReceived(len(msg.Value()))
		count := atomic.AddInt64(&messageCount, 1)

		if expected > 0 && count >= int64(expected) {
			closeOnce.Do(func() { close(done) })
		}
	}, startOpt, lift.Partition(int32(partition)))

	if err != nil {
		return fmt.Errorf("failed to subscribe: %w", err)
	}

	// Wait for completion
	select {
	case <-done:
		fmt.Println("Received expected number of messages")
	case <-time.After(duration):
		fmt.Println("Duration timeout reached")
	}

	stats.Stop()
	cancel()

	// Print results
	common.PrintConsumerResults(stats, outputFormat)

	return nil
}

func parseStartOption(pos string) (lift.SubscriptionOption, error) {
	pos = strings.ToLower(strings.TrimSpace(pos))

	switch {
	case pos == "earliest":
		return lift.StartAtEarliestReceived(), nil
	case pos == "latest":
		return lift.StartAtLatestReceived(), nil
	case strings.HasPrefix(pos, "offset:"):
		offsetStr := strings.TrimPrefix(pos, "offset:")
		offset, err := strconv.ParseInt(offsetStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid offset: %s", offsetStr)
		}
		return lift.StartAtOffset(offset), nil
	default:
		return nil, fmt.Errorf("invalid start position: %s (use earliest, latest, or offset:<n>)", pos)
	}
}

func normalizeServers(servers []string) []string {
	var result []string
	for _, s := range servers {
		parts := strings.Split(s, ",")
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				result = append(result, trimmed)
			}
		}
	}
	return result
}

```

### Core Architecture Module: `bench/producer/main.go`
```
package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	lift "github.com/liftbridge-io/go-liftbridge/v2"
	"github.com/urfave/cli"

	"github.com/liftbridge-io/liftbridge/bench/common"
)

func main() {
	app := cli.NewApp()
	app.Name = "liftbridge-bench-producer"
	app.Usage = "Benchmark tool for Liftbridge message ingestion"
	app.Version = "1.0.0"
	app.Flags = getFlags()
	app.Action = run
	if err := app.Run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func getFlags() []cli.Flag {
	return []cli.Flag{
		cli.StringSliceFlag{
			Name:   "servers, s",
			Usage:  "Liftbridge server addresses",
			EnvVar: "LIFTBRIDGE_SERVERS",
		},
		cli.StringFlag{
			Name:  "stream",
			Usage: "Stream name to publish to",
			Value: "bench-stream",
		},
		cli.StringFlag{
			Name:  "subject",
			Usage: "NATS subject for the stream",
			Value: "bench-subject",
		},
		cli.IntFlag{
			Name:  "messages, n",
			Usage: "Total number of messages to publish",
			Value: 100000,
		},
		cli.IntFlag{
			Name:  "message-size, ms",
			Usage: "Size of each message payload in bytes",
			Value: 256,
		},
		cli.IntFlag{
			Name:  "pub-batch, pb",
			Usage: "Number of async publishes before waiting for acks (like JetStream pubbatch)",
			Value: 1,
		},
		cli.IntFlag{
			Name:  "partitions, p",
			Usage: "Number of partitions for the stream",
			Value: 1,
		},
		cli.StringFlag{
			Name:  "ack-policy",
			Usage: "Ack policy: none, leader, all",
			Value: "leader",
		},
		cli.IntFlag{
			Name:  "concurrent, c",
			Usage: "Number of concurrent publisher goroutines",
			Value: 1,
		},
		cli.BoolFlag{
			Name:  "create-stream",
			Usage: "Create the stream before benchmarking",
		},
		cli.BoolFlag{
			Name:  "delete-stream",
			Usage: "Delete the stream after benchmarking",
		},
		cli.StringFlag{
			Name:  "output, o",
			Usage: "Output format: text, json",
			Value: "text",
		},
	}
}

func run(c *cli.Context) error {
	// Parse servers
	servers := c.StringSlice("servers")
	if len(servers) == 0 {
		servers = []string{"localhost:9292"}
	}
	servers = normalizeServers(servers)

	streamName := c.String("stream")
	subject := c.String("subject")
	numMessages := c.Int("messages")
	messageSize := c.Int("message-size")
	pubBatch := c.Int("pub-batch")
	partitions := c.Int("partitions")
	ackPolicy := strings.ToLower(c.String("ack-policy"))
	concurrent := c.Int("concurrent")
	createStream := c.Bool("create-stream")
	deleteStream := c.Bool("delete-stream")
	outputFormat := c.String("output")

	// Validate
	if numMessages <= 0 {
		return fmt.Errorf("messages must be > 0")
	}
	if messageSize <= 0 {
		return fmt.Errorf("message-size must be > 0")
	}
	if concurrent <= 0 {
		concurrent = 1
	}

	// Connect to Liftbridge
	fmt.Printf("Connecting to Liftbridge: %v\n", servers)
	client, err := lift.Connect(servers)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer client.Close()

	ctx := context.Background()

	// Create stream if requested
	if createStream {
		fmt.Printf("Creating stream '%s' with %d partition(s)...\n", streamName, partitions)
		err = client.CreateStream(ctx, subject, streamName, lift.Partitions(int32(partitions)))
		if err != nil && err != lift.ErrStreamExists {
			return fmt.Errorf("failed to create stream: %w", err)
		}
		if err == lift.ErrStreamExists {
			fmt.Println("Stream already exists, continuing...")
		}
	}

	// Pre-generate messages (NOT timed)
	fmt.Printf("Pre-generating %d messages of %d bytes each...\n", numMessages, messageSize)
	messages := common.PreGenerateMessagesFlat(numMessages, messageSize)
	fmt.Printf("Generated %d messages (%.2f MB total)\n",
		len(messages), float64(len(messages)*messageSize)/1024/1024)

	// Setup stats
	stats := common.NewStats()

	// Warn about pub-batch with concurrency
	if pubBatch > 1 && concurrent > 1 {
		fmt.Println("WARNING: pub-batch > 1 with concurrent > 1 may hang due to go-liftbridge client limitations.")
		fmt.Println("         Consider using either pub-batch=1 with high concurrency, or pub-batch>1 with concurrent=1.")
	}

	// Run benchmark
	fmt.Printf("Starting benchmark with %d concurrent publisher(s), pub-batch=%d, ack-policy=%s...\n", concurrent, pubBatch, ackPolicy)
	fmt.Println("---")

	stats.Start()
	err = runBenchmark(ctx, client, streamName, messages, concurrent, pubBatch, ackPolicy, stats)
	stats.Stop()

	if err != nil {
		return fmt.Errorf("benchmark failed: %w", err)
	}

	// Print results
	common.PrintProducerResults(stats, outputFormat)

	// Delete stream if requested
	if deleteStream {
		fmt.Printf("Deleting stream '%s'...\n", streamName)
		if err := client.DeleteStream(ctx, streamName); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to delete stream: %v\n", err)
		}
	}

	return nil
}

func runBenchmark(
	ctx context.Context,
	client lift.Client,
	stream string,
	messages []common.PreparedMessage,
	concurrent int,
	pubBatch int,
	ackPolicy string,
	stats *common.Stats,
) error {
	var wg sync.WaitGroup

	totalMessages := len(messages)
	messagesPerWorker := totalMessages / concurrent
	remainder := totalMessages % concurrent

	// Get ack policy option
	ackOpt := getAckPolicyOption(ackPolicy)

	// Progress counter
	var published int64
	progressTicker := time.NewTicker(2 * time.Second)
	defer progressTicker.Stop()

	// Progress reporter
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-progressTicker.C:
				count := atomic.LoadInt64(&published)
				pct := float64(count) / float64(totalMessages) * 100
				fmt.Printf("Progress: %d/%d (%.1f%%)\n", count, totalMessages, pct)
			case <-done:
				return
			}
		}
	}()

	for i := 0; i < concurrent; i++ {
		start := i * messagesPerWorker
		end := start + messagesPerWorker
		if i == concurrent-1 {
			end += remainder
		}

		workerMessages := messages[start:end]
		wg.Add(1)

		go func(msgs []common.PreparedMessage) {
			defer wg.Done()

			if pubBatch <= 1 {
				// Synchronous mode: one message at a time
				for _, msg := range msgs {
					sendTime := time.Now()
					_, err := client.Publish(ctx, stream, msg.Value,
						lift.Key(msg.Key),
						ackOpt,
					)
					latency := time.Since(sendTime)

					if err != nil {
						stats.RecordError()
						continue
					}

					stats.RecordLatency(latency)
					stats.RecordSent(len(msg.Value))
					atomic.AddInt64(&published, 1)
				}
			} else {
				// Async batch mode: send pubBatch messages, then wait for all acks
				for i := 0; i < len(msgs); i += pubBatch {
					batchEnd := i + pubBatch
					if batchEnd > len(msgs) {
						batchEnd = len(msgs)
					}
					batch := msgs[i:batchEnd]

					var batchWg sync.WaitGroup
					batchWg.Add(len(batch))

					for _, msg := range batch {
						msgVal := msg.Value
						msgKey := msg.Key
						sendTime := time.Now()

						client.PublishAsync(ctx, stream, msgVal,
							func(ack *lift.Ack, err error) {
								defer batchWg.Done()
								latency := time.Since(sendTime)

								if err != nil {
									stats.RecordError()
									return
								}

								stats.RecordLatency(latency)
								stats.RecordSent(len(msgVal))
								atomic.AddInt64(&published, 1)
							},
							lift.Key(msgKey),
							ackOpt,
						)
					}

					// Wait for all acks in this batch before sending next batch
					batchWg.Wait()
				}
			}
		}(workerMessages)
	}

	wg.Wait()
	close(done)

	return nil
}

func getAckPolicyOption(policy string) lift.MessageOption {
	switch policy {
	case "none":
		return lift.AckPolicyNone()
	case "all":
		return lift.AckPolicyAll()
	default:
		return lift.AckPolicyLeader()
	}
}

func normalizeServers(servers []string) []string {
	var result []string
	for _, s := range servers {
		parts := strings.Split(s, ",")
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				result = append(result, trimmed)
			}
		}
	}
	return result
}

```

### Core Architecture Module: `main.go`
```
//go:generate protoc -I=. -I=$GOPATH/src --gofast_out=. ./server/protocol/internal.proto

package main

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/nats-io/nats.go"
	"github.com/urfave/cli"

	"github.com/liftbridge-io/liftbridge/server"
)

func main() {
	app := cli.NewApp()
	app.Name = "liftbridge"
	app.Usage = "Lightweight, fault-tolerant message streams"
	app.Version = server.Version
	app.Flags = getFlags()
	app.Action = start
	if err := app.Run(os.Args); err != nil {
		panic(err)
	}
}

func start(c *cli.Context) error {
	// Read config from file if present.
	config, err := server.NewConfig(c.String("config"))
	if err != nil {
		return err
	}
	if err := overrideFromFlags(c, config); err != nil {
		return err
	}
	server := server.New(config)
	if err := server.Start(); err != nil {
		return err
	}
	runtime.Goexit()
	return nil
}

func overrideFromFlags(c *cli.Context, config *server.Config) error {
	// Override with flags.
	if c.IsSet("id") {
		config.Clustering.ServerID = c.String("id")
	}
	if c.IsSet("namespace") {
		config.Clustering.Namespace = c.String("namespace")
	}
	if c.IsSet("port") {
		config.Port = c.Int("port")
	}
	if c.IsSet("level") {
		level, err := server.GetLogLevel(c.String("level"))
		if err != nil {
			return err
		}
		config.LogLevel = level
	}
	if c.IsSet("raft-bootstrap-seed") {
		config.Clustering.RaftBootstrapSeed = c.Bool("raft-bootstrap-seed")
	}
	if c.IsSet("raft-bootstrap-peers") {
		config.Clustering.RaftBootstrapPeers = c.StringSlice("raft-bootstrap-peers")
	}
	if c.IsSet("data-dir") {
		config.DataDir = c.String("data-dir")
	}
	if c.IsSet("tls-cert") {
		config.TLSCert = c.String("tls-cert")
	}
	if c.IsSet("tls-key") {
		config.TLSKey = c.String("tls-key")
	}
	if c.IsSet("nats-servers") {
		natsServers, err := normalizeNatsServers(c.StringSlice("nats-servers"))
		if err != nil {
			return err
		}
		config.NATS.Servers = natsServers
	}
	if c.IsSet("embedded-nats") {
		config.EmbeddedNATS = true
	}
	if c.IsSet("embedded-nats-config") {
		config.EmbeddedNATS = true
		config.EmbeddedNATSConfig = c.String("embedded-nats-config")
	}
	return nil
}

func getFlags() []cli.Flag {
	return []cli.Flag{
		cli.StringFlag{
			Name:  "config, c",
			Usage: "load configuration from `FILE`",
		},
		cli.StringFlag{
			Name:  "server-id, id",
			Usage: "ID of the server in the cluster if there is no stored ID (default: random ID)",
		},
		cli.StringFlag{
			Name:  "namespace, ns",
			Usage: "cluster namespace",
			Value: server.DefaultNamespace,
		},
		cli.StringSliceFlag{
			Name:  "nats-servers, n",
			Usage: fmt.Sprintf("connect to NATS cluster at `ADDR[,ADDR]` (default: %q)", nats.DefaultURL),
			// NOTE: cannot use Value here as urfave/cli has another bug
			// where it does not replace this value with the specified values but appends them:-(
			// Value: &cli.StringSlice{nats.DefaultURL},
		},
		cli.BoolFlag{
			Name:  "embedded-nats, e",
			Usage: "run a NATS server embedded in this process",
		},
		cli.StringFlag{
			Name:  "embedded-nats-config, nc",
			Usage: "load configuration for embedded NATS server from `FILE`",
		},
		cli.StringFlag{
			Name:  "data-dir, d",
			Usage: "store data in `DIR` (default: \"/tmp/liftbridge/<namespace>\")",
		},
		cli.IntFlag{
			Name:  "port, p",
			Usage: "port to bind to",
			Value: server.DefaultPort,
		},
		cli.StringFlag{
			Name:  "tls-cert",
			Usage: "server certificate file",
		},
		cli.StringFlag{
			Name:  "tls-key",
			Usage: "private key for server certificate",
		},
		cli.StringFlag{
			Name:  "level, l",
			Usage: "logging level [debug|info|warn|error]",
			Value: "info",
		},
		cli.BoolFlag{
			Name:  "raft-bootstrap-seed",
			Usage: "bootstrap the Raft cluster by electing self as leader if there is no existing state",
		},
		cli.StringSliceFlag{
			Name:  "raft-bootstrap-peers",
			Usage: "bootstrap the Raft cluster with the provided list of peer IDs if there is no existing state",
		},
	}
}

func normalizeNatsServers(natsServers []string) ([]string, error) {
	if natsServers != nil {
		// urlfave.cli has issues with *Slice flags - it doesn't yet parse
		// command-line entries the same way as env vars, see
		// https://github.com/urfave/cli/pull/605
		// It has been around since Mar 2017 so don't hold your breath for a fix!
		// ... so we are manually splitting here for now.
		// We also need to handle possible multiple --nats-servers on the cli as this is supported.
		allNatsServers := make([]string, 0)
		for _, natsServersString := range natsServers {
			currNatsServers := strings.Split(natsServersString, ",")
			for i := range currNatsServers {
				if trimmedNatsServer := strings.TrimSpace(currNatsServers[i]); trimmedNatsServer != "" {
					// TODO: validate the server URL and return error?
					allNatsServers = append(allNatsServers, trimmedNatsServer)
				}
			}
		}
		return allNatsServers, nil
	}
	return nil, nil
}

```

### Core Architecture Module: `server/activity.go`
```
package server

import (
	"context"
	"sync"
	"time"

	"github.com/hashicorp/raft"
	client "github.com/liftbridge-io/liftbridge-api/v2/go"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	pb "google.golang.org/protobuf/proto"

	proto "github.com/liftbridge-io/liftbridge/server/protocol"
)

const maxActivityPublishBackoff = 10 * time.Second

// activityManager ensures that activity events get published to the activity
// stream. This ensures that events are published at least once and in the
// order in which they occur with respect to the Raft log.
type activityManager struct {
	*Server
	lastPublishedRaftIndex uint64
	commitCh               chan struct{}
	leadershipLostCh       chan struct{}
	mu                     sync.RWMutex
}

func newActivityManager(s *Server) *activityManager {
	return &activityManager{
		Server:   s,
		commitCh: make(chan struct{}, 1),
	}
}

// SetLastPublishedRaftIndex sets the Raft index of the latest event published
// to the activity stream. This is used to determine where to begin publishing
// events from in the log in the case of failovers or restarts.
func (a *activityManager) SetLastPublishedRaftIndex(index uint64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lastPublishedRaftIndex = index
}

// LastPublishedRaftIndex returns the Raft index of the latest event published
// to the activity stream. This is used to determine where to begin publishing
// events from in the log in the case of failovers or restarts.
func (a *activityManager) LastPublishedRaftIndex() uint64 {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.lastPublishedRaftIndex
}

// SignalCommit indicates a new event was committed to the Raft log.
func (a *activityManager) SignalCommit() {
	select {
	case a.commitCh <- struct{}{}:
	default:
	}
}

// BecomeLeader should be called when this node has been elected as the
// metadata leader. This will set up the activity stream if it's enabled. It
// will then reconcile the last published event with the Raft log and begin
// publishing any un-published events. This should be called on the same
// goroutine as BecomeFollower.
func (a *activityManager) BecomeLeader() error {
	if !a.config.ActivityStream.Enabled {
		return nil
	}
	if err := a.createActivityStream(); err != nil {
		return err
	}
	a.leadershipLostCh = make(chan struct{})
	a.startGoroutine(a.dispatch)
	return nil
}

// BecomeFollower should be called when this node has lost metadata leadership.
// This should be called on the same goroutine as BecomeLeader.
func (a *activityManager) BecomeFollower() error {
	if !a.config.ActivityStream.Enabled {
		return nil
	}

	if a.leadershipLostCh != nil {
		close(a.leadershipLostCh)
	}
	return nil
}

// dispatch is a long-running goroutine that runs while the server is the
// metadata leader. It handles publishing events to the activity stream as they
// are committed to the Raft log. Events are always published in the order in
// which they were committed to the log.
func (a *activityManager) dispatch() {
	var (
		raftNode = a.getRaft()
		index    = a.LastPublishedRaftIndex() + 1
	)
	for {
		select {
		case <-a.leadershipLostCh:
			return
		default:
		}

		// TODO: Should we instead pass the commit index from FSM apply?
		if index > raftNode.getCommitIndex() {
			// We are caught up with the Raft log, so wait for new commits.
			select {
			case <-a.commitCh:
				continue
			case <-a.leadershipLostCh:
				return
			case <-a.shutdownCh:
				return
			}
		}
		log := new(raft.Log)
		if err := raftNode.store.GetLog(index, log); err != nil {
			panic(err)
		}
		if log.Type != raft.LogCommand {
			index++
			continue
		}

		var backoff time.Duration
	RETRY:
		if err := a.handleRaftLog(log); err != nil {
			a.logger.Errorf("Failed to publish activity event: %v", err)
			backoff = computeActivityPublishBackoff(backoff)
			select {
			case <-time.After(backoff):
				goto RETRY
			case <-a.leadershipLostCh:
				return
			case <-a.shutdownCh:
				return
			}
		}
		index++
	}
}

// handleRaftLog unmarshals the Raft log into an operation and, if applicable,
// publishes an event to the activity stream.
func (a *activityManager) handleRaftLog(l *raft.Log) error {
	log := new(proto.RaftLog)
	if err := log.Unmarshal(l.Data); err != nil {
		panic(err)
	}
	event := new(client.ActivityStreamEvent)
	switch log.Op {
	case proto.Op_CREATE_STREAM:
		partitions := make([]int32, len(log.CreateStreamOp.Stream.Partitions))
		for i, partition := range log.CreateStreamOp.Stream.Partitions {
			partitions[i] = partition.Id
		}
		event.Op = client.ActivityStreamOp_CREATE_STREAM
		event.CreateStreamOp = &client.CreateStreamOp{
			Stream:     log.CreateStreamOp.Stream.Name,
			Partitions: partitions,
		}
	case proto.Op_DELETE_STREAM:
		event.Op = client.ActivityStreamOp_DELETE_STREAM
		event.DeleteStreamOp = &client.DeleteStreamOp{
			Stream: log.DeleteStreamOp.Stream,
		}
	case proto.Op_PAUSE_STREAM:
		event.Op = client.ActivityStreamOp_PAUSE_STREAM
		event.PauseStreamOp = &client.PauseStreamOp{
			Stream:     log.PauseStreamOp.Stream,
			Partitions: log.PauseStreamOp.Partitions,
			ResumeAll:  log.PauseStreamOp.ResumeAll,
		}
	case proto.Op_RESUME_STREAM:
		event.Op = client.ActivityStreamOp_RESUME_STREAM
		event.ResumeStreamOp = &client.ResumeStreamOp{
			Stream:     log.ResumeStreamOp.Stream,
			Partitions: log.ResumeStreamOp.Partitions,
		}
	case proto.Op_SET_STREAM_READONLY:
		event.Op = client.ActivityStreamOp_SET_STREAM_READONLY
		event.SetStreamReadonlyOp = &client.SetStreamReadonlyOp{
			Stream:     log.SetStreamReadonlyOp.Stream,
			Partitions: log.SetStreamReadonlyOp.Partitions,
			Readonly:   log.SetStreamReadonlyOp.Readonly,
		}
	case proto.Op_CREATE_CONSUMER_GROUP:
		// Members on create should always contain a single consumer.
		members := log.CreateConsumerGroupOp.ConsumerGroup.Members
		if len(members) == 0 {
			return nil
		}
		// Treat this as a join since it bootstraps the group.
		event.Op = client.ActivityStreamOp_JOIN_CONSUMER_GROUP
		event.JoinConsumerGroupOp = &client.JoinConsumerGroupOp{
			GroupId:    log.CreateConsumerGroupOp.ConsumerGroup.Id,
			ConsumerId: members[0].Id,
			Streams:    members[0].Streams,
		}
	case proto.Op_JOIN_CONSUMER_GROUP:
		event.Op = client.ActivityStreamOp_JOIN_CONSUMER_GROUP
		event.JoinConsumerGroupOp = &client.JoinConsumerGroupOp{
			GroupId:    log.JoinConsumerGroupOp.GroupId,
			ConsumerId: log.JoinConsumerGroupOp.ConsumerId,
			Streams:    log.JoinConsumerGroupOp.Streams,
		}
	case proto.Op_LEAVE_CONSUMER_GROUP:
		event.Op = client.ActivityStreamOp_LEAVE_CONSUMER_GROUP
		event.LeaveConsumerGroupOp = &client.LeaveConsumerGroupOp{
			GroupId:    log.LeaveConsumerGroupOp.GroupId,
			ConsumerId: log.LeaveConsumerGroupOp.ConsumerId,
			Expired:    log.LeaveConsumerGroupOp.Expired,
		}
	default:
		return nil
	}
	event.Id = l.Index
	return a.publishActivityEvent(event)
}

// createActivityStream creates the activity stream and connects a local client
// that will be subscribed to it.
func (a *activityManager) createActivityStream() error {
	status := a.metadata.CreateStream(context.Background(), &proto.CreateStreamOp{
		Stream: &proto.Stream{
			Name:    activityStream,
			Subject: a.getActivityStreamSubject(),
			Partitions: []*proto.Partition{
				{
					Stream:            activityStream,
					Subject:           a.getActivityStreamSubject(),
					ReplicationFactor: -1,
					Id:                0,
				},
			},
		},
	})
	if status == nil {
		return nil
	}
	if status.Code() != codes.AlreadyExists {
		return errors.Wrap(status.Err(), "failed to create activity stream")
	}

	return nil
}

// publishActivityEvent publishes an event on the activity stream.
func (a *activityManager) publishActivityEvent(event *client.ActivityStreamEvent) error {
	data, err := pb.Marshal(event)
	if err != nil {
		panic(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), a.config.ActivityStream.PublishTimeout)
	defer cancel()

	_, err = a.api.Publish(ctx, &client.PublishRequest{
		Value:     data,

```

### Core Architecture Module: `server/api.go`
```
package server

import (
	"context"
	"fmt"
	"hash/crc32"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	client "github.com/liftbridge-io/liftbridge-api/v2/go"
	"github.com/liftbridge-io/liftbridge/server/encryption"
	proto "github.com/liftbridge-io/liftbridge/server/protocol"
)

const (
	waitForNewMessages int64 = -1
	asyncAckTimeout          = 5 * time.Second
)

var hasher = crc32.ChecksumIEEE

// apiServer implements the gRPC server interface clients interact with.
type apiServer struct {
	client.UnimplementedAPIServer
	*Server
}

// enforce authorization policy per action/subject/object
func (a *apiServer) enforcePolicy(subject, object, action string) (bool, error) {

	a.authzEnforcer.authzLock.RLock()

	defer a.authzEnforcer.authzLock.RUnlock()

	return a.authzEnforcer.enforcer.Enforce(subject, object, action)
}

// CreateStream creates a new stream attached to a NATS subject. It returns an
// AlreadyExists status code if a stream with the given subject and name
// already exists.
func (a *apiServer) CreateStream(ctx context.Context, req *client.CreateStreamRequest) (
	*client.CreateStreamResponse, error) {

	resp := &client.CreateStreamResponse{}
	if req.ReplicationFactor == 0 {
		req.ReplicationFactor = 1
	}
	if req.Partitions == 0 {
		req.Partitions = 1
	}
	a.logger.Debugf("api: CreateStream [name=%s, subject=%s, partitions=%d, replicationFactor=%d]",
		req.Name, req.Subject, req.Partitions, req.ReplicationFactor)

	if req.Name == "" {
		a.logger.Errorf("api: Failed to create stream: name cannot be empty")
		return nil, status.Error(codes.InvalidArgument, "Name cannot be empty")
	}
	if req.Subject == "" || !isValidSubject(req.Subject) {
		a.logger.Errorf("api: Failed to create stream: subject is invalid")
		return nil, status.Error(codes.InvalidArgument, "Subject is invalid")
	}
	if isReservedStream(req.Name) {
		a.logger.Errorf("api: Failed to create stream: stream is reserved")
		return nil, status.Error(codes.InvalidArgument, "Stream is reserved")
	}

	partitions := make([]*proto.Partition, req.Partitions)
	for i := int32(0); i < req.Partitions; i++ {
		partitions[i] = &proto.Partition{
			Subject:           req.Subject,
			Stream:            req.Name,
			Group:             req.Group,
			ReplicationFactor: req.ReplicationFactor,
			Id:                i,
		}
	}

	stream := &proto.Stream{
		Name:       req.Name,
		Subject:    req.Subject,
		Partitions: partitions,
		Config:     getStreamConfig(req),
	}

	e := a.ensureAuthorizationPermission(ctx, req.Name, "CreateStream")
	if e != nil {
		a.logger.Errorf("api: Failed to authorize call on resource: %v", e)
		return nil, e
	}

	err := a.ensureCreateStreamPrecondition(req)
	if err != nil {
		a.logger.Errorf("api: Failed to create stream %s: %v", req.Name, err)
		return nil, err.Err()
	}

	if e := a.metadata.CreateStream(ctx, &proto.CreateStreamOp{Stream: stream}); e != nil {
		if e.Code() != codes.AlreadyExists {
			a.logger.Errorf("api: Failed to create stream %s: %v", req.Name, e.Err())
		}
		return nil, e.Err()
	}

	return resp, nil
}

// DeleteStream deletes a stream attached to a NATS subject.
func (a *apiServer) DeleteStream(ctx context.Context, req *client.DeleteStreamRequest) (
	*client.DeleteStreamResponse, error) {

	resp := &client.DeleteStreamResponse{}
	a.logger.Debugf("api: DeleteStream [name=%s]",
		req.Name)

	err := a.ensureAuthorizationPermission(ctx, req.Name, "DeleteStream")
	if err != nil {
		a.logger.Errorf("api: Failed to authorize call on resource: %v", err)
		return nil, err
	}

	if isReservedStream(req.Name) {
		a.logger.Errorf("api: Failed to delete stream: stream is reserved")
		return nil, status.Error(codes.InvalidArgument, "Stream is reserved")
	}

	if e := a.metadata.DeleteStream(ctx, &proto.DeleteStreamOp{
		Stream: req.Name,
	}); e != nil {
		a.logger.Errorf("api: Failed to delete stream %v: %v", req.Name, e.Err())
		return nil, e.Err()
	}

	return resp, nil
}

// PauseStream pauses a stream's partitions. If no partitions are specified,
// all of the stream's partitions will be paused. Partitions are resumed when
// they are published to via the Liftbridge Publish API.
func (a *apiServer) PauseStream(ctx context.Context, req *client.PauseStreamRequest) (
	*client.PauseStreamResponse, error) {

	resp := &client.PauseStreamResponse{}
	a.logger.Debugf("api: PauseStream [name=%s, partitions=%v, resumeAll=%v]",
		req.Name, req.Partitions, req.ResumeAll)

	err := a.ensureAuthorizationPermission(ctx, req.Name, "PauseStream")
	if err != nil {
		a.logger.Errorf("api: Failed to authorize call on resource: %v", err)
		return nil, err
	}

	if len(req.Partitions) == 0 {
		stream := a.metadata.GetStream(req.Name)
		if stream == nil {
			return nil, status.Error(codes.NotFound, "stream not found")
		}
		for _, partition := range stream.GetPartitions() {
			req.Partitions = append(req.Partitions, partition.Id)
		}
	}

	if e := a.metadata.PauseStream(ctx, &proto.PauseStreamOp{
		Stream:     req.Name,
		Partitions: req.Partitions,
		ResumeAll:  req.ResumeAll,
	}); e != nil {
		a.logger.Errorf("api: Failed to pause stream %v: %v", req.Name, e.Err())
		return nil, e.Err()
	}

	return resp, nil
}

// SetStreamReadonly sets the readonly status on a stream's partitions. If no
// partitions are specified, all of the stream's partitions will have their
// readonly status set.
func (a *apiServer) SetStreamReadonly(ctx context.Context, req *client.SetStreamReadonlyRequest) (
	*client.SetStreamReadonlyResponse, error) {

	resp := &client.SetStreamReadonlyResponse{}
	a.logger.Debugf("api: SetStreamReadonly [name=%s, partitions=%v, readonly=%v]",
		req.Name, req.Partitions, req.Readonly)

	err := a.ensureAuthorizationPermission(ctx, req.Name, "SetStreamReadonly")
	if err != nil {
		a.logger.Errorf("api: Failed to authorize call on resource: %v", err)
		return nil, err
	}

	if len(req.Partitions) == 0 {
		stream := a.metadata.GetStream(req.Name)
		if stream == nil {
			return nil, status.Error(codes.NotFound, "stream not found")
		}
		for _, partition := range stream.GetPartitions() {
			req.Partitions = append(req.Partitions, partition.Id)
		}
	}

	if e := a.metadata.SetStreamReadonly(ctx, &proto.SetStreamReadonlyOp{
		Stream:     req.Name,
		Partitions: req.Partitions,
		Readonly:   req.Readonly,
	}); e != nil {
		a.logger.Errorf("api: Failed to set stream readonly flag %v: %v", req.Name, e.Err())
		return nil, e.Err()
	}

	return resp, nil
}

// Subscribe creates an ephemeral subscription for the given stream partition.
// It begins to receive messages starting at the given offset and waits for new
// messages when it reaches the end of the partition. If the subscriber is part
// of a consumer group, this will ensure only one member of the group is
// subscribed to a given partition at a time. Use the request context to close
// the subscription.
func (a *apiServer) Subscribe(req *client.SubscribeRequest, out client.API_SubscribeServer) error {
	sub, err := a.SubscribeInternal(out.Context(), req)
	if err != nil {
		return err
	}
	defer sub.Close()

	e := a.ensureAuthorizationPermission(out.Context(), req.Stream, "Subscribe")
	if e != nil {
		a.logger.Errorf("api: Failed to authorize call on resource: %v", e)
		return e
	}
	// Send an empty message which signals the subscription was successfully
	// created.
	if err := out.Send(&client.Message{}); err != nil {
		return err
	}

	var (
		msgC    = sub.Messages()
		errC    = sub.Errors()
		closedC = sub.Closed()
	)

	for {
		select {
		case <-out.Context().Done():
			return nil
		case <-closedC:
			return nil
		case m := <-msgC:
			if err := out.Send(m); err != nil {
				return err
			}
		case err := <-errC:
			return err.Err()
		}
	}
}

// SubscribeInternal creates an ephemeral subscription for the given stream
// partition. It begins to receive messages starting at the given offset and
// waits for new messages when it reaches the en
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #451** (2026-07-15): **Docker: Fix volume permissions to avoid running as root**
  *Symptoms*: ## Problem  When running Liftbridge with Docker and mounting a volume for data persistence, the container fails with a permission error:  ``` panic: failed to recover or persist metadata state: open /tmp/liftbridge/liftbridge-default/liftbridge: permission denied ```  This happens because the container runs as the `liftbridge` user (uid 1001), but Docker volumes are created with root ownership by default.  ## Current Workaround  Users must run the container as root:  ```yaml services:   liftbridge:     image: ghcr.io/liftbridge-io/liftbridge:26.01.1     user: root  # Required workaround     volumes:       - liftbridge-data:/tmp/liftbridge     command: ["--nats-servers", "nats://nats:4222", "--raft-bootstrap-seed"] ```  ## Proposed Fix  Update the Dockerfile to create the data directory with proper ownership before switching to the non-root user:  ```dockerfile RUN mkdir -p /tmp/liftbridge && chown liftbridge:liftbridge /tmp/liftbridge ```  This will allow the container to run as the `liftbridge` user (which is more secure) while still being able to write to mounted volumes.  ## Target  26.03.1

- **Issue #414** (2025-12-22): **Panic after upgrade from v1.8.0 to v1.9.0 on k8s**
  *Symptoms*: The cluster fails to run after the upgrade. These are the states of nodes: - node 0 - runs successfully - node 1 - panics - node 2 - panics  This is the log from one of the failing nodes: ``` time="2022-12-05 10:03:46" level=info msg="Liftbridge Version:        v1.9.0" time="2022-12-05 10:03:46" level=info msg="Server ID:                 cluster-liftbridge-2" time="2022-12-05 10:03:46" level=info msg="Namespace:                 liftbridge-default" time="2022-12-05 10:03:46" level=info msg="NATS Servers:              [nats://nats_client:xxx@nats-client:4222]" time="2022-12-05 10:03:46" level=info msg="Default Retention Policy:  [Age: 1 week, Compact: false]" time="2022-12-05 10:03:46" level=info msg="Default Partition Pausing: disabled" time="2022-12-05 10:03:46" level=info msg="Starting Liftbridge server on 0.0.0.0:9292..." time="2022-12-05 10:03:46" level=debug msg="fsm: Restoring Raft state from snapshot..." time="2022-12-05 10:03:46" level=debug msg="Server becoming leader for partition [subject=ems.ble.omm, stream=ems.ble.omm, partition=0], epoch: 81585" time="2022-12-05 10:03:46" level=warning msg="Received log leader epoch assignment for an epoch < latest epoch. This implies messages have arrived out of order. New: {epoch:81585, offset:6596311}, Previous: {epoch:83904, offset:6592917} for log [subject=ems.ble.omm, stream=ems.ble.omm, partition=0]" panic: runtime error: invalid memory address or nil pointer dereference [signal SIGSEGV: segmentation viol
  **Post-Mortem & Fix Analysis**:
  > Hi @abunjevac, We've identified and fixed the root cause of this panic. The issue was in the Restore() function in fsm.go.   Root Cause: When restoring from a Raft snapshot, streams were being created with recovered=false:  if err := s.applyCreateStream(stream, false, 0); err != nil { This caused partitions to immediately try to start leader/follower loops, which attempted to use s.api - but the API server hadn't been initialized yet (it starts after setupMetadataRaft() completes). Hence the nil pointer dereference at partition.go:1311. Fix: Changed recovered=false to recovered=true during snapshot restore. This defers partition startup until finishedRecovery() is called after log replay completes, when s.api is guaranteed to be initialized.  // Mark streams and groups as recovered so they don't start leader/follower // loops until finishedRecovery() is called after log replay completes. // This is critical because s.api is not yet initialized during Restore(). for _, stream := range s

- **Issue #411** (2025-12-22): **panic: failed to add stream to metadata store: failed to create commit log: corrupt index file**
  *Symptoms*: liftbridge 1.7.1 - single node setup "panic: failed to add stream to metadata store: failed to create commit log: corrupt index file" Cannot start it. Does this issue already resolved in the latest version? Since it is "fault-tolerant" I'm expecting it to work anyway could you probably add a configuration option to ignore corrupted index?
  **Post-Mortem & Fix Analysis**:
  > [liftbridge_broken_index.tar.bz2.zip](https://github.com/liftbridge-io/liftbridge/files/10130216/liftbridge_broken_index.tar.bz2.zip) Attached dump of broken database Most probably raft.db is broken
  > As I understood: If I had 3 instances in case this issue this instance process could not start, terminated and could not recover itself from others. So I have to monitor it and recover manually, right?
  > Hi @xor2003, Thanks for reporting this issue back in 2022 — and apologies it took so long to address.   The project has recently been revived under new maintainership ([Basekick Labs](https://github.com/basekick-labs)), and we're working through the backlog.   Good news: This is now fixed!  The fix will be included in v26.01.1 (releasing mid-January 2026). When an index file is corrupted, Liftbridge will now automatically rebuild it from the log file instead of panicking. The log file is the source of truth, so as long as it's intact, the server will recover gracefully.   What changed: - Index corruption is now detected during startup - The corrupt index is automatically deleted and rebuilt from the log file - Server continues startup normally with the rebuilt index  To answer your original questions: - No configuration option needed — recovery is automatic - In a 3-node cluster, if one node has a corrupt index, it will now self-recover on startup and rejoin the cluster without manual 

- **Issue #373** (2025-12-22): **Signal handling race when using embedded NATS**
  *Symptoms*: There is a race condition when using the embedded NATS server option in that the [NATS server's signal handler](https://github.com/nats-io/nats-server/blob/a27de5a681636cb25362ce0a726f365a099bd95e/server/signal.go) races with [Liftbridge's signal handler](https://github.com/liftbridge-io/liftbridge/blob/f9f12da8f0f109021f2da84f54f9bead4b05e22b/server/signal.go). Specifically, NATS calls `os.Exit` which can prevent a clean shutdown to occur in Liftbridge.
  **Post-Mortem & Fix Analysis**:
  > Fixed a race condition when using embedded NATS that could prevent graceful shutdown.  **Problem**: When Liftbridge runs with embedded NATS (`EmbeddedNATS: true`), both servers registered their own signal handlers for SIGINT/SIGTERM. Whichever handler ran first would win - if NATS won, it would call `os.Exit()` immediately, preventing Liftbridge from performing graceful shutdown (closing partitions, draining NATS connections, stopping Raft).  **Solution**: Set `opts.NoSigs = true` when creating the embedded NATS server, disabling NATS's signal handling and allowing Liftbridge to handle all signals for proper graceful shutdown.  I'm pushing a new branch with the fix that is going to be included in 26.01.1 in mid January. 

- **Issue #365** (2021-10-15): **Infinite loop when fetch cursor without messages on __cursor**
  *Symptoms*:  Hello.   When stream `__cursors`  has no message (removed by retention policy) - call `FetchCursor` wait infinitive time. Step for reproduce:  config  ```yaml cursors:     stream.auto.pause.time: 0     stream.partitions: 1 streams:     compact.enabled: false     retention.max:         age: 20m     segment.max:         age: 5m  ```  1. Set default retention policy by time to `stream` config: `retention.max` - 20m, `segment.max` - 5m 2. Start `Liftbridge` - it create `__cursor` stream 3.  Call some `SetCursor` 4. Wait until messages clean by retention 5. Reboot liftbridge (for clean Cursor Cache) 6. Fetch Cursor   **Workaround** - not set retention by `time`, only by size or message count. But this will consume file descriptors, because compact worked only **inactive** segments and large size `retention.byte` will result in more segment files.   
  **Post-Mortem & Fix Analysis**:
  > Thanks, this has been fixed in #366.
  > As asst  On Sat, Oct 16, 2021, 2:18 AM Tyler Treat ***@***.***> wrote:  > Thanks, this has been fixed in #366 > <https://github.com/liftbridge-io/liftbridge/pull/366>. > > — > You are receiving this because you are subscribed to this thread. > Reply to this email directly, view it on GitHub > <https://github.com/liftbridge-io/liftbridge/issues/365#issuecomment-944650519>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/ALJYKRR5CWMFGXCEZEZH3LTUHCHSTANCNFSM5GCRR2TA> > . > Triage notifications on the go with GitHub Mobile for iOS > <https://apps.apple.com/app/apple-store/id1477376905?ct=notification-email&mt=8&pt=524675> > or Android > <https://play.google.com/store/apps/details?id=com.github.android&referrer=utm_campaign%3Dnotification-email%26utm_medium%3Demail%26utm_source%3Dgithub>. > > 

- **Issue #354** (2025-12-22): **nil pointer dereference when setting partition leader**
  *Symptoms*: Found weird nil pointer dereference issue. Simple 3-node cluster in docker-compose. Pulled up to v1.6.0. Suddenly, 2nd node starts to crash on startup during the raft election.  ``` liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="Liftbridge Version:        v1.6.0" liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="Server ID:                 liftbridge2" liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="Namespace:                 liftbridge-default" liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="NATS Servers:              [nats://nats:4222/]" liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="Default Retention Policy:  [Age: 1 day, Compact: true]" liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="Default Partition Pausing: disabled" liftbridge2_1        | time="2021-06-23 08:03:10" level=info msg="Starting Liftbridge server on 0.0.0.0:9292..." liftbridge2_1        | panic: runtime error: invalid memory address or nil pointer dereference liftbridge2_1        | [signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0xdcf642] liftbridge2_1        |  liftbridge2_1        | goroutine 1 [running]: liftbridge2_1        | github.com/liftbridge-io/liftbridge/server.(*replica).updateLatestOffset(0x0, 0xffffffffffffffff, 0xc0002bad90) liftbridge2_1        | 	/go/src/github.com/liftbridge-io/liftbridge/server/partition.go:40 +0x22 liftbridge2_1        | github.com/lift
  **Post-Mortem & Fix Analysis**:
  > Are you able to reproduce the issue reliably?
  > Yes. This node fails every restart.
  > It seems like what's happening is that the node is becoming leader for a partition but the node is not part of the ISR, thus `p.isr[p.srv.config.Clustering.ServerID]` is returning `nil`. Does one of the other two nodes in the cluster not take over as leader when this node crashes?  Do you have the logs leading up to the crash? It would seem this node was removed from the ISR and then somehow became leader for the partition.

- **Issue #340** (2021-05-22): **liftbridge can crash when invalid non-string parameters are passed to either subject or name of create_stream**
  *Symptoms*: when invalid non-string parameters are passed to either subject or name of create_stream, liftbridge (docker image liftbridge/standalone-dev) crashes with error log:  ``` liftbridge-docker | time="2021-04-30 00:41:17" level=error msg="Server failed becoming leader for partition [subject=subject, stream=<function function_name at 0x7ff19cc2d3a0>, partition=0]: failed to subscribe to replication inbox: nats: invalid subject" liftbridge-docker | panic: failed to add stream to metadata store: failed to subscribe to replication inbox: nats: invalid subject liftbridge-docker |  liftbridge-docker | goroutine 13 [running]: liftbridge-docker | github.com/liftbridge-io/liftbridge/server.(*Server).Apply(0xc00034c000, 0xc0000ae2f0, 0x0, 0x0) liftbridge-docker |     /go/pkg/mod/github.com/liftbridge-io/liftbridge@v1.3.1-0.20201125164102-383469b58204/server/fsm.go:111 +0x3e3 liftbridge-docker | github.com/hashicorp/raft.(*Raft).runFSM.func1(0xc0003088f0) liftbridge-docker |     /go/pkg/mod/github.com/hashicorp/raft@v1.1.2/fsm.go:90 +0x2c1 liftbridge-docker | github.com/hashicorp/raft.(*Raft).runFSM.func2(0xc00025c200, 0x1, 0x40) liftbridge-docker |     /go/pkg/mod/github.com/hashicorp/raft@v1.1.2/fsm.go:113 +0x75 liftbridge-docker | github.com/hashicorp/raft.(*Raft).runFSM(0xc000448000) liftbridge-docker |     /go/pkg/mod/github.com/hashicorp/raft@v1.1.2/fsm.go:219 +0x42f liftbridge-docker | github.com/hashicorp/raft.(*raftState).goFunc.func1(0xc000448000, 0xc0000feb90) lif
  **Post-Mortem & Fix Analysis**:
  > Thanks, server should be performing validation to avoid panics.
  > Thank you very much Tyler. Much appreciated!

- **Issue #332** (2021-06-23): **Huge memory consumption on cursor leader node**
  *Symptoms*: After starting the process, the memory consumption stops at 1-1,5 Gb. But on the cursor leader node the consumption continues to grow and reaches 10 GB on `liftbridge` proccess. When the cursor leader changes, the growth stops, but resumes on the new leader node. In this case, the memory on the former leader is not released.  `User Memory graph`. Green line on right side - change cursor leader.  ![image](https://user-images.githubusercontent.com/18608678/111023577-b1ec1080-83fb-11eb-88d7-03950257f6f8.png)  Result profiling `mevent01`: (`go tool pprof -alloc_objects /bin/liftbridge http://127.0.0.1:8080/debug/pprof/heap`):  ```go (pprof) top Showing nodes accounting for 11244192778, 53.49% of 21020572605 total Dropped 447 nodes (cum <= 105102863) Showing top 10 nodes out of 165       flat  flat%   sum%        cum   cum% 3029887270 14.41% 14.41% 6072457649 28.89%  github.com/liftbridge-io/liftbridge/server/commitlog.(*index).ReadEntryAtFileOffset 1530281031  7.28% 21.69% 1530281031  7.28%  bytes.NewReader (inline) 1512289348  7.19% 28.89% 1512289348  7.19%  encoding/binary.Read 1150716201  5.47% 34.36% 1150716201  5.47%  google.golang.org/grpc/internal/transport.(*itemList).enqueue (inline) 1050860348  5.00% 39.36% 3253041140 15.48%  google.golang.org/grpc/internal/transport.(*http2Server).operateHeaders  810575917  3.86% 43.22%  810575917  3.86%  google.golang.org/grpc/internal/transport.(*decodeState).addMetadata (inline)  717531840  3.41% 46.63%  7175318
  **Post-Mortem & Fix Analysis**:
  > I haven't been able to reproduce this yet. I'm seeing the previous leader's memory drop back down.
  > Fixed on #351 .

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

### Incident Patch 1: `73d382a4` (2026-06-29)
**Commit Message**: Merge pull request #463 from AruneshDwivedi/fix/docker-volume-permissions

fix: create /tmp/liftbridge with proper ownership for non-root user

**File**: `Dockerfile` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ RUN go build -mod=readonly \
 
 FROM alpine:latest
 RUN addgroup -g 1001 -S liftbridge && adduser -u 1001 -S liftbridge -G liftbridge
+RUN mkdir -p /tmp/liftbridge && chown liftbridge:liftbridge /tmp/liftbridge
 COPY --chown=liftbridge:liftbridge --from=build-base /workspace/liftbridge /usr/local/bin/liftbridge
 EXPOSE 9292
 VOLUME "/tmp/liftbridge/liftbridge-default"
```

---

### Incident Patch 2: `9be361fe` (2026-06-29)
**Commit Message**: fix: create /tmp/liftbridge with proper ownership for non-root user

The liftbridge user (uid 1001) needs to write to /tmp/liftbridge
when a volume is mounted there. Without this fix, Docker creates
the mount point with root ownership, causing permission denied
errors when the container runs as the non-root liftbridge user.

Signed-off-by: Arunesh Dwivedi <arunesh.devops@gmail.com>

**File**: `Dockerfile` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ RUN go build -mod=readonly \
 
 FROM alpine:latest
 RUN addgroup -g 1001 -S liftbridge && adduser -u 1001 -S liftbridge -G liftbridge
+RUN mkdir -p /tmp/liftbridge && chown liftbridge:liftbridge /tmp/liftbridge
 COPY --chown=liftbridge:liftbridge --from=build-base /workspace/liftbridge /usr/local/bin/liftbridge
 EXPOSE 9292
 VOLUME "/tmp/liftbridge/liftbridge-default"
```

---

### Incident Patch 3: `c492a0d7` (2026-01-21)
**Commit Message**: Fix race condition in timeoutFuture.Error()

The unbuffered channel with select/default could cause the timeout
to win even when the wrapped future returns immediately, if the
goroutine didn't get scheduled before the timer fired.

Using a buffered channel of size 1 ensures the goroutine can always
send its result, and the main select will receive it if it arrives
before the timeout.

**File**: `server/raft.go` (modified, +2/-6)
```diff
@@ -63,13 +63,9 @@ func (t *timeoutFuture) Error() error {
 		return t.err
 	}
 
-	errC := make(chan error)
+	errC := make(chan error, 1)
 	go func() {
-		err := t.wrapped.Error()
-		select {
-		case errC <- err:
-		default:
-		}
+		errC <- t.wrapped.Error()
 	}()
 
 	var err error
```

---

### Incident Patch 4: `3726304f` (2026-01-21)
**Commit Message**: Fix race condition in logger.Silent() method

The Silent() method was directly assigning to l.Out without
synchronization, causing a data race when multiple servers
ran concurrently in tests (e.g., TestConsumerGroupCoordinatorFailover).

Fix: Use the existing mutex and logrus's thread-safe SetOutput()
method instead of direct field assignment.

**File**: `server/logger/logger.go` (modified, +4/-2)
```diff
@@ -90,15 +90,17 @@ func (l *logger) Fatal(v ...interface{}) {
 // Silent is used to enable and disable log silencing. Silent must be called
 // with true before it can be called with false.
 func (l *logger) Silent(enable bool) {
+	l.mu.Lock()
+	defer l.mu.Unlock()
 	if enable {
 		l.oldOut = l.Out
-		l.Out = io.Discard
+		l.SetOutput(io.Discard)
 	} else {
 		oldOut := l.oldOut
 		if oldOut == nil {
 			panic("Must enable logger.Silent before disabling")
 		}
-		l.Out = oldOut
+		l.SetOutput(oldOut)
 	}
 }
 
```

---

### Incident Patch 5: `dd0fa3db` (2026-01-21)
**Commit Message**: Fix artifact download in release workflow

Remove merge-multiple option and manually flatten artifacts to avoid
intermittent download failures with many artifacts.
>

**File**: `.github/workflows/release.yml` (modified, +4/-3)
```diff
@@ -637,11 +637,12 @@ jobs:
         uses: actions/download-artifact@v7
         with:
           pattern: liftbridge-*
-          merge-multiple: true
-          path: ./release-artifacts
+          path: ./artifacts
 
-      - name: List artifacts
+      - name: Flatten artifacts
         run: |
+          mkdir -p ./release-artifacts
+          find ./artifacts -type f \( -name "*.tar.gz" -o -name "*.sha256" -o -name "*.deb" -o -name "*.rpm" \) -exec cp {} ./release-artifacts/ \;
           echo "Release artifacts:"
           ls -la ./release-artifacts/
 
```

---

### Incident Patch 6: `9e8ef8e3` (2026-01-21)
**Commit Message**: Fix Docker test job authentication

Add GHCR login step to test-docker job to allow pulling
the image for verification.

**File**: `.github/workflows/release.yml` (modified, +7/-0)
```diff
@@ -264,6 +264,13 @@ jobs:
     runs-on: ubuntu-latest
     needs: [prepare, docker-merge]
     steps:
+      - name: Log in to GitHub Container Registry
+        uses: docker/login-action@v3
+        with:
+          registry: ${{ env.REGISTRY }}
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+
       - name: Test Docker image
         run: |
           VERSION=${{ needs.prepare.outputs.version }}
```

---

### Incident Patch 7: `1b198418` (2025-12-18)
**Commit Message**: Merge pull request #443 from liftbridge-io/fix/leader-not-in-isr-354

Fix nil pointer dereference when leader not in ISR (#354)

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -110,6 +110,18 @@ Fixed a race condition when using embedded NATS that could prevent graceful shut
 **Changes**:
 - Modified `startEmbeddedNATS()` in server.go to set `opts.NoSigs = true`
 
+#### Leader Not In ISR Panic ([#354](https://github.com/liftbridge-io/liftbridge/issues/354))
+Fixed a nil pointer dereference when a partition leader is not in the ISR.
+
+**Problem**: When restoring from a Raft snapshot, if the snapshot contained inconsistent state where a partition's leader was not in its ISR (In-Sync Replicas), the server would panic with a nil pointer dereference at `partition.go:812`. This could happen if a node was removed from the ISR via ShrinkISR but a snapshot was taken before a new leader election occurred.
+
+**Solution**: Added a defensive nil check in `becomeLeader()`. If the leader is not found in the ISR, it logs a warning and adds itself to the ISR with the current offset, allowing the server to recover from the corrupt state.
+
+**Changes**:
+- Modified `becomeLeader()` in partition.go to check if the server is in the ISR before accessing it
+- Added auto-recovery logic to add self to ISR if missing
+- Added test case `TestPartitionBecomeLeaderNotInISR` to verify the fix
+
 ### Raft v1.7.3 Compatibility
 This release enables compatibility with hashicorp/raft v1.7.3, which includes:
 - Pre-vote protocol (enabled by default)
```

**File**: `documentation/roadmap.md` (modified, +8/-0)
```diff
@@ -117,6 +117,14 @@ starting leader/follower loops until after recovery completes.
 Fixed race condition when using embedded NATS that could prevent graceful shutdown.
 Set `opts.NoSigs = true` to disable NATS's signal handling.
 
+### Bug Fixes: Leader Not In ISR Panic ([#354](https://github.com/liftbridge-io/liftbridge/issues/354))
+
+**Status**: Done (v26.01.1)
+
+Fixed nil pointer dereference when partition leader is not in ISR during snapshot restore.
+Added defensive check in `becomeLeader()` to add self to ISR if missing, allowing recovery
+from corrupt snapshots.
+
 ---
 
 ## Phase 2: Enterprise Features (v26.03)
```

**File**: `server/partition.go` (modified, +11/-1)
```diff
@@ -809,7 +809,17 @@ func (p *partition) becomeLeader(epoch uint64) error {
 	}
 
 	// Update this replica's latest offset to ensure it's up to date.
-	rep := p.isr[p.srv.config.Clustering.ServerID]
+	rep, ok := p.isr[p.srv.config.Clustering.ServerID]
+	if !ok {
+		// This shouldn't happen - a leader should always be in the ISR.
+		// Handle gracefully for corrupt snapshots (see #354).
+		p.srv.logger.Warnf("Leader %s not found in ISR for partition %s, adding self to ISR",
+			p.srv.config.Clustering.ServerID, p)
+		rep = &replica{offset: -1}
+		p.isr[p.srv.config.Clustering.ServerID] = rep
+		// Also update the protobuf ISR list for persistence.
+		p.Isr = append(p.Isr, p.srv.config.Clustering.ServerID)
+	}
 	rep.updateLatestOffset(p.log.NewestOffset())
 
 	// Start message processing loop.
```

**File**: `server/partition_test.go` (modified, +34/-0)
```diff
@@ -711,3 +711,37 @@ func TestComputeTick(t *testing.T) {
 
 	require.Equal(t, maxSleep, computeTick(0, maxSleep))
 }
+
+// Ensure becomeLeader handles the case where the leader is not in the ISR
+// gracefully by adding self to ISR instead of panicking. This can happen
+// when restoring from a corrupt Raft snapshot. See issue #354.
+func TestPartitionBecomeLeaderNotInISR(t *testing.T) {
+	defer cleanupStorage(t)
+
+	// Start Liftbridge server.
+	server := createServer()
+	require.NoError(t, server.Start())
+	defer server.Stop()
+
+	// Create partition where leader "a" is NOT in the ISR (simulating corrupt state).
+	p, err := server.newPartition(&proto.Partition{
+		Subject:  "foo",
+		Stream:   "foo",
+		Replicas: []string{"a", "b"},
+		Leader:   "a",
+		Isr:      []string{"b"}, // Leader "a" intentionally excluded
+	}, false, nil)
+	require.NoError(t, err)
+	defer p.Close()
+
+	// Verify leader is not in ISR initially.
+	require.NotContains(t, p.GetISR(), "a")
+
+	// Call becomeLeader - this should NOT panic and should add self to ISR.
+	err = p.becomeLeader(1)
+	require.NoError(t, err)
+
+	// Verify leader was added to ISR.
+	require.Contains(t, p.GetISR(), "a")
+	require.Contains(t, p.GetISR(), "b")
+}
```

---

### Incident Patch 8: `a4ab66d0` (2025-12-18)
**Commit Message**: Fix nil pointer dereference when leader not in ISR (#354)

When restoring from a Raft snapshot, if the snapshot contained
inconsistent state where a partition's leader was not in its ISR,
the server would panic with a nil pointer dereference.

This could happen if a node was removed from the ISR via ShrinkISR
but a snapshot was taken before a new leader election occurred.

Changes:
- Add defensive nil check in becomeLeader() before accessing ISR map
- Add auto-recovery logic to add self to ISR if missing
- Add test case TestPartitionBecomeLeaderNotInISR
- Update CHANGELOG.md and roadmap.md

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -110,6 +110,18 @@ Fixed a race condition when using embedded NATS that could prevent graceful shut
 **Changes**:
 - Modified `startEmbeddedNATS()` in server.go to set `opts.NoSigs = true`
 
+#### Leader Not In ISR Panic ([#354](https://github.com/liftbridge-io/liftbridge/issues/354))
+Fixed a nil pointer dereference when a partition leader is not in the ISR.
+
+**Problem**: When restoring from a Raft snapshot, if the snapshot contained inconsistent state where a partition's leader was not in its ISR (In-Sync Replicas), the server would panic with a nil pointer dereference at `partition.go:812`. This could happen if a node was removed from the ISR via ShrinkISR but a snapshot was taken before a new leader election occurred.
+
+**Solution**: Added a defensive nil check in `becomeLeader()`. If the leader is not found in the ISR, it logs a warning and adds itself to the ISR with the current offset, allowing the server to recover from the corrupt state.
+
+**Changes**:
+- Modified `becomeLeader()` in partition.go to check if the server is in the ISR before accessing it
+- Added auto-recovery logic to add self to ISR if missing
+- Added test case `TestPartitionBecomeLeaderNotInISR` to verify the fix
+
 ### Raft v1.7.3 Compatibility
 This release enables compatibility with hashicorp/raft v1.7.3, which includes:
 - Pre-vote protocol (enabled by default)
```

**File**: `documentation/roadmap.md` (modified, +8/-0)
```diff
@@ -117,6 +117,14 @@ starting leader/follower loops until after recovery completes.
 Fixed race condition when using embedded NATS that could prevent graceful shutdown.
 Set `opts.NoSigs = true` to disable NATS's signal handling.
 
+### Bug Fixes: Leader Not In ISR Panic ([#354](https://github.com/liftbridge-io/liftbridge/issues/354))
+
+**Status**: Done (v26.01.1)
+
+Fixed nil pointer dereference when partition leader is not in ISR during snapshot restore.
+Added defensive check in `becomeLeader()` to add self to ISR if missing, allowing recovery
+from corrupt snapshots.
+
 ---
 
 ## Phase 2: Enterprise Features (v26.03)
```

**File**: `server/partition.go` (modified, +11/-1)
```diff
@@ -809,7 +809,17 @@ func (p *partition) becomeLeader(epoch uint64) error {
 	}
 
 	// Update this replica's latest offset to ensure it's up to date.
-	rep := p.isr[p.srv.config.Clustering.ServerID]
+	rep, ok := p.isr[p.srv.config.Clustering.ServerID]
+	if !ok {
+		// This shouldn't happen - a leader should always be in the ISR.
+		// Handle gracefully for corrupt snapshots (see #354).
+		p.srv.logger.Warnf("Leader %s not found in ISR for partition %s, adding self to ISR",
+			p.srv.config.Clustering.ServerID, p)
+		rep = &replica{offset: -1}
+		p.isr[p.srv.config.Clustering.ServerID] = rep
+		// Also update the protobuf ISR list for persistence.
+		p.Isr = append(p.Isr, p.srv.config.Clustering.ServerID)
+	}
 	rep.updateLatestOffset(p.log.NewestOffset())
 
 	// Start message processing loop.
```

**File**: `server/partition_test.go` (modified, +34/-0)
```diff
@@ -711,3 +711,37 @@ func TestComputeTick(t *testing.T) {
 
 	require.Equal(t, maxSleep, computeTick(0, maxSleep))
 }
+
+// Ensure becomeLeader handles the case where the leader is not in the ISR
+// gracefully by adding self to ISR instead of panicking. This can happen
+// when restoring from a corrupt Raft snapshot. See issue #354.
+func TestPartitionBecomeLeaderNotInISR(t *testing.T) {
+	defer cleanupStorage(t)
+
+	// Start Liftbridge server.
+	server := createServer()
+	require.NoError(t, server.Start())
+	defer server.Stop()
+
+	// Create partition where leader "a" is NOT in the ISR (simulating corrupt state).
+	p, err := server.newPartition(&proto.Partition{
+		Subject:  "foo",
+		Stream:   "foo",
+		Replicas: []string{"a", "b"},
+		Leader:   "a",
+		Isr:      []string{"b"}, // Leader "a" intentionally excluded
+	}, false, nil)
+	require.NoError(t, err)
+	defer p.Close()
+
+	// Verify leader is not in ISR initially.
+	require.NotContains(t, p.GetISR(), "a")
+
+	// Call becomeLeader - this should NOT panic and should add self to ISR.
+	err = p.becomeLeader(1)
+	require.NoError(t, err)
+
+	// Verify leader was added to ISR.
+	require.Contains(t, p.GetISR(), "a")
+	require.Contains(t, p.GetISR(), "b")
+}
```

---

### Incident Patch 9: `58315fc0` (2025-12-18)
**Commit Message**: Merge pull request #442 from liftbridge-io/fix/signal-handling-race-373

Fix signal handling race with embedded NATS (#373)

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -100,6 +100,16 @@ Fixed a startup panic when restoring from a Raft snapshot.
 **Changes**:
 - Modified `Restore()` in fsm.go to pass `recovered=true` to `applyCreateStream()` and `applyCreateConsumerGroup()`
 
+#### Signal Handling Race with Embedded NATS ([#373](https://github.com/liftbridge-io/liftbridge/issues/373))
+Fixed a race condition when using embedded NATS that could prevent graceful shutdown.
+
+**Problem**: When Liftbridge runs with embedded NATS (`EmbeddedNATS: true`), both servers registered their own signal handlers for SIGINT/SIGTERM. Whichever handler ran first would win - if NATS won, it would call `os.Exit()` immediately, preventing Liftbridge from performing graceful shutdown (closing partitions, draining NATS connections, stopping Raft).
+
+**Solution**: Set `opts.NoSigs = true` when creating the embedded NATS server, disabling NATS's signal handling and allowing Liftbridge to handle all signals for proper graceful shutdown.
+
+**Changes**:
+- Modified `startEmbeddedNATS()` in server.go to set `opts.NoSigs = true`
+
 ### Raft v1.7.3 Compatibility
 This release enables compatibility with hashicorp/raft v1.7.3, which includes:
 - Pre-vote protocol (enabled by default)
```

**File**: `documentation/roadmap.md` (modified, +7/-0)
```diff
@@ -110,6 +110,13 @@ rebuilds corrupt indexes from the log file.
 Fixed startup panic when restoring from a Raft snapshot. Partitions now defer
 starting leader/follower loops until after recovery completes.
 
+### Bug Fixes: Signal Handling Race ([#373](https://github.com/liftbridge-io/liftbridge/issues/373))
+
+**Status**: Done (v26.01.1)
+
+Fixed race condition when using embedded NATS that could prevent graceful shutdown.
+Set `opts.NoSigs = true` to disable NATS's signal handling.
+
 ---
 
 ## Phase 2: Enterprise Features (v26.03)
```

**File**: `server/server.go` (modified, +6/-0)
```diff
@@ -348,6 +348,12 @@ func (s *Server) startEmbeddedNATS() error {
 	if err != nil {
 		return err
 	}
+	// Disable NATS signal handling to prevent race with Liftbridge's signal
+	// handler. Without this, both servers register handlers for SIGINT/SIGTERM
+	// and whichever runs first wins - if NATS wins, it calls os.Exit()
+	// immediately, preventing Liftbridge from performing graceful shutdown.
+	// See: https://github.com/liftbridge-io/liftbridge/issues/373
+	opts.NoSigs = true
 	s.embeddedNATS, err = gnatsd.NewServer(opts)
 	if err != nil {
 		return err
```

---

### Incident Patch 10: `079bd4f3` (2025-12-18)
**Commit Message**: Fix signal handling race with embedded NATS (#373)

When using embedded NATS, both servers registered signal handlers for
SIGINT/SIGTERM, causing a race condition. Whichever handler ran first
would win - if NATS won, it called os.Exit() immediately, preventing
Liftbridge from performing graceful shutdown.

Fix: Set opts.NoSigs = true when creating embedded NATS server to
disable NATS's signal handling, allowing Liftbridge to handle all
signals for proper graceful shutdown.

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -100,6 +100,16 @@ Fixed a startup panic when restoring from a Raft snapshot.
 **Changes**:
 - Modified `Restore()` in fsm.go to pass `recovered=true` to `applyCreateStream()` and `applyCreateConsumerGroup()`
 
+#### Signal Handling Race with Embedded NATS ([#373](https://github.com/liftbridge-io/liftbridge/issues/373))
+Fixed a race condition when using embedded NATS that could prevent graceful shutdown.
+
+**Problem**: When Liftbridge runs with embedded NATS (`EmbeddedNATS: true`), both servers registered their own signal handlers for SIGINT/SIGTERM. Whichever handler ran first would win - if NATS won, it would call `os.Exit()` immediately, preventing Liftbridge from performing graceful shutdown (closing partitions, draining NATS connections, stopping Raft).
+
+**Solution**: Set `opts.NoSigs = true` when creating the embedded NATS server, disabling NATS's signal handling and allowing Liftbridge to handle all signals for proper graceful shutdown.
+
+**Changes**:
+- Modified `startEmbeddedNATS()` in server.go to set `opts.NoSigs = true`
+
 ### Raft v1.7.3 Compatibility
 This release enables compatibility with hashicorp/raft v1.7.3, which includes:
 - Pre-vote protocol (enabled by default)
```

**File**: `documentation/roadmap.md` (modified, +7/-0)
```diff
@@ -110,6 +110,13 @@ rebuilds corrupt indexes from the log file.
 Fixed startup panic when restoring from a Raft snapshot. Partitions now defer
 starting leader/follower loops until after recovery completes.
 
+### Bug Fixes: Signal Handling Race ([#373](https://github.com/liftbridge-io/liftbridge/issues/373))
+
+**Status**: Done (v26.01.1)
+
+Fixed race condition when using embedded NATS that could prevent graceful shutdown.
+Set `opts.NoSigs = true` to disable NATS's signal handling.
+
 ---
 
 ## Phase 2: Enterprise Features (v26.03)
```

**File**: `server/server.go` (modified, +6/-0)
```diff
@@ -348,6 +348,12 @@ func (s *Server) startEmbeddedNATS() error {
 	if err != nil {
 		return err
 	}
+	// Disable NATS signal handling to prevent race with Liftbridge's signal
+	// handler. Without this, both servers register handlers for SIGINT/SIGTERM
+	// and whichever runs first wins - if NATS wins, it calls os.Exit()
+	// immediately, preventing Liftbridge from performing graceful shutdown.
+	// See: https://github.com/liftbridge-io/liftbridge/issues/373
+	opts.NoSigs = true
 	s.embeddedNATS, err = gnatsd.NewServer(opts)
 	if err != nil {
 		return err
```

#### Recent Merged Pull Requests:
- **PR #467** (closed): Bump google.golang.org/grpc from 1.79.3 to 1.82.1 (@dependabot[bot])
- **PR #465** (2026-07-15): Bump golang.org/x/crypto from 0.49.0 to 0.52.0 (@dependabot[bot])
- **PR #464** (closed): Bump golang.org/x/net from 0.51.0 to 0.55.0 (@dependabot[bot])
- **PR #463** (2026-06-29): fix: create /tmp/liftbridge with proper ownership for non-root user (@AruneshDwivedi)
- **PR #460** (2026-04-10): Bump lodash and globule in /website (@dependabot[bot])
- **PR #456** (2026-03-26): Bump picomatch from 2.3.0 to 2.3.2 in /website (@dependabot[bot])
- **PR #455** (2026-03-26): Bump github.com/nats-io/nats-server/v2 from 2.12.3 to 2.12.6 (@dependabot[bot])
- **PR #454** (2026-03-26): Bump google.golang.org/grpc from 1.77.0 to 1.79.3 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
