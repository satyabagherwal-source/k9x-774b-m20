> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/liftbridge-io-liftbridge-learnings.md`  
> **Source**: github ([https://github.com/liftbridge-io/liftbridge](https://github.com/liftbridge-io/liftbridge))  
> **Source Version**: `af2a6626`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T23:58:00.853Z  
> **Learning ID**: `learn-github-liftbridge-io-liftbridge`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): liftbridge-io/liftbridge

> **Canonical Artifact**: `07_PROJECT_LEARNING/liftbridge-io-liftbridge-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/liftbridge-io/liftbridge](https://github.com/liftbridge-io/liftbridge))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T23:58:00.846Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `liftbridge-io/liftbridge`
- **Description**: Kafka-style message streaming in Go. Built on NATS. Single binary,  no JVM, no ZooKeeper.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2804 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `server/commitlog/util.go`
```
package commitlog

import (
	"os"
	"sort"
)

// findSegment returns the first segment whose next assignable offset is
// greater than the given offset. Returns nil and the index where the segment
// would be if there is no such segment.
func findSegment(segments []*segment, offset int64) (*segment, int) {
	n := len(segments)
	idx := sort.Search(n, func(i int) bool {
		return segments[i].NextOffset() > offset
	})
	if idx == n {
		return nil, idx
	}
	return segments[idx], idx
}

// findSegmentContains returns the first segment whose next assignable offset
// is greater than the given offset and a bool indicating if the returned
// segment contains the offset, meaning the offset is between the segment's
// base offset and next assignable offset. Note that because the segment could
// be compacted, "contains" does not guarantee the offset is actually present,
// only that it's within the bounds.
func findSegmentContains(segments []*segment, offset int64) (*segment, bool) {
	seg, _ := findSegment(segments, offset)
	if seg == nil {
		return nil, false
	}
	return seg, seg.BaseOffset <= offset
}

// findSegmentIndexByTimestamp returns the index of the first segment whose
// base timestamp is greater than the given timestamp. Returns the index where
// the segment would be if there is no segment whose base timestamp is greater,
// i.e. the length of the slice.
func findSegmentIndexByTimestamp(segments []*segment, timestamp int64) (int, error) {
	var (
		n   = len(segments)
		err error
	)
	idx := sort.Search(n, func(i int) bool {
		// Read the first entry in the segment to determine the base timestamp.
		var entry entry
		if e := segments[i].Index.ReadEntryAtLogOffset(&entry, 0); e != nil {
			err = e
			return true
		}
		return entry.Timestamp > timestamp
	})
	return idx, err
}

// findSegmentByBaseOffset returns the first segment whose base offset is
// greater than or equal to the given offset. Returns nil if there is no such
// segment.
func findSegmentByBaseOffset(segments []*segment, offset int64) *segment {
	n := len(segments)
	idx := sort.Search(n, func(i int) bool {
		return segments[i].BaseOffset >= offset
	})
	if idx == n {
		return nil
	}
	return segments[idx]
}

func roundDown(total, factor int64) int64 {
	return factor * (total / factor)
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

```

### Core Architecture Module: `website/core/Footer.js`
```
const React = require('react');

class Footer extends React.Component {
  docUrl(doc, language) {
    const baseUrl = this.props.config.baseUrl;
    const docsUrl = this.props.config.docsUrl;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    return `${baseUrl}${docsPart}${doc}`;
  }

  pageUrl(doc, language) {
    const baseUrl = this.props.config.baseUrl;
    return baseUrl + (language ? `${language}/` : '') + doc;
  }

  render() {
    return (
      <footer className="nav-footer" id="footer">
        <section className="sitemap">
          <a href={this.props.config.baseUrl} className="nav-home">
            {this.props.config.footerIcon && (
              <img
                src={this.props.config.baseUrl + this.props.config.footerIcon}
                alt={this.props.config.title}
                width="66"
                height="58"
              />
            )}
          </a>
          <div>
            <h5>Docs</h5>
            <a href={this.docUrl('overview.html', this.props.language)}>
              Overview
            </a>
            <a href={this.docUrl('faq.html', this.props.language)}>
              FAQ
            </a>
            <a href={this.docUrl('quick-start.html', this.props.language)}>
              Getting Started
            </a>
          </div>
          <div>
            <h5>Community</h5>
            <a
              className="github-button"
              href={this.props.config.repoUrl}
              data-icon="octicon-star"
              data-count-href="/liftbridge-io/liftbridge/stargazers"
              data-show-count="true"
              data-count-aria-label="# stargazers on GitHub"
              aria-label="Star this project on GitHub">
              Star
            </a>
            {this.props.config.twitterUsername && (
              <div className="social">
                <a
                  href={`https://twitter.com/${
                    this.props.config.twitterUsername
                  }`}
                  className="twitter-follow-button">
                  Follow @{this.props.config.twitterUsername}
                </a>
              </div>
            )}
          </div>
          <div>
            <h5>More</h5>
            <a href={this.pageUrl('help.html', this.props.language)}>Help</a>
            <a href={this.pageUrl('acknowledgements.html', this.props.language)}>Acknowledgements</a>
            <a href={this.pageUrl('versions.html', this.props.language)}>Versions</a>
          </div>
        </section>
        <section className="copyright">{this.props.config.copyright}</section>
      </footer>
    );
  }
}

module.exports = Footer;

```

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
		Stream:    activityStream,
		AckPolicy: a.config.ActivityStream.PublishAckPolicy,
	})
	if err != nil {
		return errors.Wrap(err, "failed to publish event to stream")
	}

	a.logger.Debugf("Published %s event to activity stream", event.Op)

	// Update last published index in Raft.
	op := &proto.RaftLog{
		Op: proto.Op_PUBLISH_ACTIVITY,
		PublishActivityOp: &proto.PublishActivityOp{
			RaftIndex: event.Id,
		},
	}
	future, err := a.getRaft().applyOperation(ctx, op, nil)
	if err == nil {
		err = future.Error()
	}
	return errors.Wrap(err, "failed to update Raft")
}

func computeActivityPublishBackoff(previousBackoff time.Duration) time.Duration {
	if previousBackoff == 0 {
		return time.Second
	}
	backoff := previousBackoff * 2
	if backoff > maxActivityPublishBackoff {
		backoff = maxActivityPublishBackoff
	}
	return backoff
}

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
// waits for new messages when it reaches the end of the partition. If the
// subscriber is part of a consumer group, this will ensure only one member of
// the group is subscribed to a given partition at a time. Use the request
// context to close the subscription. This is a non-gRPC API for internal use.
func (a *apiServer) SubscribeInternal(ctx context.Context, req *client.SubscribeRequest) (
	*subscription, error) {

	var (
		group    string
		consumer string
	)
	if req.Consumer != nil {
		group = req.Consumer.GroupId
		consumer = req.Consumer.ConsumerId
	}
	a.logger.Debugf("api: Subscribe "+
		"[stream=%s, partition=%d, start=%s, offset=%d, timestamp=%d, group=%s, consumer=%s, reverse=%v]",
		req.Stream, req.Partition, req.StartPosition, req.StartOffset, req.StartTimestamp, group, consumer, req.Reverse)

	if group != "" && consumer == "" {
		a.logger.Errorf("api: Failed to subscribe to partition: no consumer id provided")
		return nil, status.Error(codes.InvalidArgument,
			"Consumer id cannot be empty when group id is provided")
	}

	partition := a.metadata.GetPartition(req.Stream, req.Partition)
	if partition == nil {
		a.logger.Errorf("api: Failed to subscribe to partition "+
			"[stream=%s, partition=%d]: no such partition",
			req.Stream, req.Partition)
		return nil, status.Error(codes.NotFound, "No such partition")
	}

	leader, _ := partition.GetLeader()
	if leader != a.config.Clustering.ServerID {
		if req.ReadISRReplica {
			if group != "" {
				// Consumer groups are not compatible with ReadISRReplica.
				a.logger.Errorf("api: Failed to subscribe to partition %s: consumer groups "+
					"not compatible with ReadISRReplica", partition)
				return nil, status.Error(codes.InvalidArgument,
					"Consumer groups not compatible with ReadISRReplica")
			}
			a.logger.Info("api: Accepting subscription to partition %s: server not stream leader", partition)
		} else {
			a.logger.Errorf("api: Failed to subscribe to partition %s: server not stream leader", partition)
			return nil, status.Error(codes.FailedPr
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

### Incident Patch 1: `c492a0d7` (2026-01-21)
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

### Incident Patch 2: `3726304f` (2026-01-21)
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

### Incident Patch 3: `1f79db57` (2026-01-21)
**Commit Message**: Split artifact downloads to avoid timeout issues

Download artifacts in separate steps by platform to reduce the
likelihood of timeouts with large artifact sets.

**File**: `.github/workflows/release.yml` (modified, +36/-2)
```diff
@@ -633,18 +633,52 @@ jobs:
         with:
           fetch-depth: 0
 
-      - name: Download all artifacts
+      - name: Download binary artifacts
         uses: actions/download-artifact@v7
         with:
-          pattern: liftbridge-*
+          pattern: liftbridge-darwin-*
           path: ./artifacts
+        continue-on-error: true
+
+      - name: Download linux binary artifacts
+        uses: actions/download-artifact@v7
+        with:
+          pattern: liftbridge-linux-*
+          path: ./artifacts
+        continue-on-error: true
+
+      - name: Download windows binary artifacts
+        uses: actions/download-artifact@v7
+        with:
+          pattern: liftbridge-windows-*
+          path: ./artifacts
+        continue-on-error: true
+
+      - name: Download debian artifacts
+        uses: actions/download-artifact@v7
+        with:
+          pattern: liftbridge-debian-*
+          path: ./artifacts
+        continue-on-error: true
+
+      - name: Download rpm artifacts
+        uses: actions/download-artifact@v7
+        with:
+          pattern: liftbridge-rpm-*
+          path: ./artifacts
+        continue-on-error: true
 
       - name: Flatten artifacts
         run: |
           mkdir -p ./release-artifacts
           find ./artifacts -type f \( -name "*.tar.gz" -o -name "*.sha256" -o -name "*.deb" -o -name "*.rpm" \) -exec cp {} ./release-artifacts/ \;
           echo "Release artifacts:"
           ls -la ./release-artifacts/
+          # Verify we have artifacts
+          if [ -z "$(ls -A ./release-artifacts/)" ]; then
+            echo "Error: No artifacts found!"
+            exit 1
+          fi
 
       - name: Generate release notes
         run: |
```

#### Recent Merged Pull Requests:
- **PR #467** (closed): Bump google.golang.org/grpc from 1.79.3 to 1.82.1 (@dependabot[bot])
- **PR #465** (2026-07-15): Bump golang.org/x/crypto from 0.49.0 to 0.52.0 (@dependabot[bot])
- **PR #464** (closed): Bump golang.org/x/net from 0.51.0 to 0.55.0 (@dependabot[bot])
- **PR #463** (2026-06-29): fix: create /tmp/liftbridge with proper ownership for non-root user (@AruneshDwivedi)
- **PR #460** (2026-04-10): Bump lodash and globule in /website (@dependabot[bot])
- **PR #456** (2026-03-26): Bump picomatch from 2.3.0 to 2.3.2 in /website (@dependabot[bot])

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

## X. race condition in timeoutFuture.Error()

**RULE**:
When implementing operations in `server/raft.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in liftbridge-io/liftbridge. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c492a0d7`: race condition in timeoutFuture.Error(). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/raft.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	errC := make(chan error, 1)
		errC <- t.wrapped.Error()
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	errC := make(chan error)
		err := t.wrapped.Error()
		select {
		case errC <- err:
		default:
		}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c492a0d7` are properly handled with clean fallback behavior.
