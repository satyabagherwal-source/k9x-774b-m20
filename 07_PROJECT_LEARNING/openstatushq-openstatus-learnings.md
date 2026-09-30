# Forensic Learning Record (Deep Inspection): openstatusHQ/openstatus

> **Canonical Artifact**: `07_PROJECT_LEARNING/openstatushq-openstatus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openstatusHQ/openstatus](https://github.com/openstatusHQ/openstatus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:38:36.273Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openstatusHQ/openstatus`
- **Description**: 🫖 Status page with uptime monitoring & API monitoring as code   🫖
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9156 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/checker/checker/dns.go`
```
package checker

import (
	"context"
	"fmt"
	"net"
	"strings"

	"github.com/rs/zerolog/log"
)

type DnsResponse struct {
	A     []string `json:"a,omitempty"`
	AAAA  []string `json:"aaaa,omitempty"`
	CNAME string   `json:"cname,omitempty"`
	MX    []string `json:"mx,omitempty"`
	NS    []string `json:"ns,omitempty"`
	TXT   []string `json:"txt,omitempty"`
}

// resolver is net.DefaultResolver reached through its context-aware methods:
// the package-level net.Lookup* helpers take no context, so a stalled resolver
// would block a probe past its timeout and hold up the monitor's next run.
var resolver = net.DefaultResolver

func Dns(ctx context.Context, host string) (*DnsResponse, error) {
	logger := log.Ctx(ctx).With().Str("monitor", host).Logger()

	ips, err := resolver.LookupIP(ctx, "ip", host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS IP lookup failed")
		return nil, fmt.Errorf("failed to lookup IPs: %w", err)
	}

	A := []string{}
	AAAA := []string{}

	for _, ip := range ips {
		if ip.To4() != nil {
			A = append(A, ip.String())
		} else {
			AAAA = append(AAAA, ip.String())
		}
	}
	CNAME, err := lookupCNAME(ctx, host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS CNAME record lookup failed")
		return nil, fmt.Errorf("failed to lookup CNAME record: %w", err)
	}
	MXRecords := lookupMX(ctx, host)

	NS, err := lookupNS(ctx, host)
	if err != nil {
		logger.Error().Err(err).Msg("DNS NS record lookup failed")
		return nil, fmt.Errorf("failed to lookup NS record: %w", err)
	}
	TXT := lookupTXT(ctx, host)

	// MX and TXT tolerate lookup errors, but an expired deadline means those
	// records are unknown rather than absent — don't report that as a success.
	if err := ctx.Err(); err != nil {
		logger.Error().Err(err).Msg("DNS lookup did not complete before the deadline")
		return nil, fmt.Errorf("DNS lookup for %s did not complete: %w", host, err)
	}

	response := &DnsResponse{
		A:     A,
		AAAA:  AAAA,
		CNAME: CNAME,
		MX:    MXRecords,
		NS:    NS,
		TXT:   TXT,
	}

	return response, nil
}

// FormatDNSRecords flattens a lookup into the per-record-type map shape that
// both the public handler and the private-location probe report.
func FormatDNSRecords(result *DnsResponse) map[string][]string {
	return map[string][]string{
		"A":     append([]string{}, result.A...),
		"AAAA":  append([]string{}, result.AAAA...),
		"CNAME": {result.CNAME},
		"MX":    append([]string{}, result.MX...),
		"NS":    append([]string{}, result.NS...),
		"TXT":   append([]string{}, result.TXT...),
	}
}

func lookupCNAME(ctx context.Context, domain string) (string, error) {
	cname, err := resolver.LookupCNAME(ctx, domain)
	if err != nil {
		return "", err
	}

	return cname, nil
}

func lookupMX(ctx context.Context, domain string) []string {
	mx := []string{}
	mxRecords, _ := resolver.LookupMX(ctx, domain)

	for _, r := range mxRecords {
		mx = append(mx, fmt.Sprintf("%s:%d", r.Host, r.Pref))
	}
	return mx
}

func lookupNS(ctx context.Context, domain string) ([]string, error) {

	hosts := []string{}
	isSubdomain := isSubdomain(domain)
	if isSubdomain {
		return hosts, nil
	}
	nsRecords, err := resolver.LookupNS(ctx, domain)
	if err != nil {
		return nil, err
	}

	for _, ns := range nsRecords {
		hosts = append(hosts, ns.Host)
	}
	return hosts, nil
}

func lookupTXT(ctx context.Context, domain string) []string {
	records := []string{}
	txtRecords, err := resolver.LookupTXT(ctx, domain)
	if err != nil {
		return nil
	}

	for _, txt := range txtRecords {
		records = append(records, txt)
	}
	return records
}

func isSubdomain(domain string) bool {
	parent := strings.Split(domain, ".")
	if len(parent) < 3 {
		return false
	}
	return true
}

```

### Core Architecture Module: `apps/checker/checker/grpc.go`
```
package checker

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/stats"
	"google.golang.org/grpc/status"
)

type GRPCTLSMode string

const (
	GRPCTLSModeTLS         GRPCTLSMode = "tls"
	GRPCTLSModePlaintext   GRPCTLSMode = "plaintext"
	GRPCTLSModeTLSInsecure GRPCTLSMode = "tls_insecure"
)

const (
	// Applied when a caller omits the timeout, matching the monitor column default.
	grpcDefaultTimeout = 45_000

	ServingStatusServing        = "SERVING"
	ServingStatusNotServing     = "NOT_SERVING"
	ServingStatusServiceUnknown = "SERVICE_UNKNOWN"
	ServingStatusUnknown        = "UNKNOWN"
	// Not a grpc.health.v1 enum value: the server answered, it just has no
	// health service. It still needs a status, because a NULL servingStatus is
	// what the metrics pipes use to mean "never reached the server", and this
	// check did — with a real latency worth counting.
	ServingStatusUnimplemented = "UNIMPLEMENTED"
)

// GRPCResponseTiming is HTTP's phase shape verbatim: gRPC is HTTP/2, and reusing
// it lets calculateTiming and the dashboard waterfall work with no new code.
type GRPCResponseTiming = Timing

func ParseGRPCTLSMode(value string) GRPCTLSMode {
	switch value {
	case string(GRPCTLSModePlaintext):
		return GRPCTLSModePlaintext
	case string(GRPCTLSModeTLSInsecure):
		return GRPCTLSModeTLSInsecure
	default:
		return GRPCTLSModeTLS
	}
}

type GRPCResult struct {
	Timing        GRPCResponseTiming
	ServingStatus string
	Message       string
	Latency       int64
	GRPCCode      int64
	// Completed reports that the server answered. It cannot be derived from the
	// error flag: NOT_SERVING is a failed check that completed perfectly well.
	Completed bool
	Healthy   bool
}

type GRPCResponse struct {
	Region        string             `json:"region"`
	ErrorMessage  string             `json:"errorMessage"`
	JobType       string             `json:"jobType"`
	ServingStatus string             `json:"servingStatus"`
	Service       string             `json:"service"`
	RequestId     int64              `json:"requestId,omitempty"`
	WorkspaceID   int64              `json:"workspaceId"`
	MonitorID     int64              `json:"monitorId"`
	Timestamp     int64              `json:"timestamp"`
	Latency       int64              `json:"latency"`
	GRPCCode      int64              `json:"grpcCode"`
	Timing        GRPCResponseTiming `json:"timing"`
	Completed     bool               `json:"completed"`
	Error         uint8              `json:"error,omitempty"`
}

func grpcNow() int64 {
	return time.Now().UTC().UnixMilli()
}

// grpcTimer guards the phase struct: grpc-go dials and reads on its own
// goroutines, so the probe goroutine cannot write it unsynchronised.
type grpcTimer struct {
	mu     sync.Mutex
	timing GRPCResponseTiming
}

func (g *grpcTimer) set(apply func(t *GRPCResponseTiming)) {
	g.mu.Lock()
	defer g.mu.Unlock()
	apply(&g.timing)
}

func (g *grpcTimer) snapshot() GRPCResponseTiming {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.timing
}

// CheckGRPC calls grpc.health.v1.Health/Check on target. A non-nil error means
// the RPC never completed; a completed call with a bad answer is reported
// through the result instead.
func CheckGRPC(timeoutMs int64, target, service string, mode GRPCTLSMode, md map[string]string) (GRPCResult, error) {
	if timeoutMs <= 0 {
		timeoutMs = grpcDefaultTimeout
	}

	// Every failure path must set GRPCCode: its zero value is codes.OK, and
	// callers persist it verbatim, so leaving it unset records a check that
	// never reached the server under the code for success. Unavailable is what
	// grpc-go itself answers for a malformed-but-parseable target, so the whole
	// "never got on the wire" class stays one code; the error message is what
	// separates a bad target from a refused connection.
	host, _, err := net.SplitHostPort(target)
	if err != nil {
		return GRPCResult{GRPCCode: int64(codes.Unavailable)},
			fmt.Errorf("invalid target %q: expected host:port", target)
	}

	// One deadline for resolve, dial, handshake and call. Splitting them would
	// let a stalled DNS lookup run past the timeout the user configured.
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	timer := &grpcTimer{}

	conn, err := grpc.NewClient(target,
		grpc.WithTransportCredentials(grpcCredentials(mode, host, timer)),
		grpc.WithContextDialer(grpcDialer(timer)),
		grpc.WithStatsHandler(&grpcStatsHandler{timer: timer}),
	)
	if err != nil {
		return GRPCResult{
			Timing:   timer.snapshot(),
			GRPCCode: int64(codes.Unavailable),
		}, fmt.Errorf("dial error: %w", err)
	}
	defer conn.Close()

	callCtx := ctx
	if len(md) > 0 {
		callCtx = metadata.NewOutgoingContext(ctx, metadata.New(md))
	}

	start := time.Now()
	res, err := grpc_health_v1.NewHealthClient(conn).Check(
		callCtx,
		&grpc_health_v1.HealthCheckRequest{Service: service},
		grpc.WaitForReady(false),
	)
	latency := time.Since(start).Milliseconds()
	timing := timer.snapshot()

	if err != nil {
		code := status.Code(err)
		result := GRPCResult{
			Timing:   timing,
			Latency:  latency,
			GRPCCode: int64(code),
		}

		switch code {
		case codes.Unimplemented:
			// The server is up and talking gRPC; it just has no health service.
			// Reporting this as "down" sends people hunting the wrong problem.
			result.Completed = true
			result.ServingStatus = ServingStatusUnimplemented
			result.Message = "server does not implement grpc.health.v1.Health"
			return result, nil
		case codes.NotFound:
			// grpc-go's reference health server answers an unregistered service
			// with NOT_FOUND rather than the SERVICE_UNKNOWN enum value.
			result.Completed = true
			result.ServingStatus = ServingStatusServiceUnknown
			result.Message = grpcUnknownServiceMessage(service)
			return result, nil
		}

		result.Latency = 0
		return result, fmt.Errorf("%s", grpcTransportMessage(code, err, timeoutMs))
	}

	servingStatus := grpcServingStatusName(res.GetStatus())
	result := GRPCResult{
		Timing:        timing,
		Latency:       latency,
		ServingStatus: servingStatus,
		GRPCCode:      int64(codes.OK),
		Completed:     true,
		Healthy:       servingStatus == ServingStatusServing,
	}

	switch servingStatus {
	case ServingStatusServing:
		result.Message = fmt.Sprintf("Health check passed for %s", target)
	case ServingStatusNotServing:
		result.Message = "service reports NOT_SERVING"
	case ServingStatusServiceUnknown:
		result.Message = grpcUnknownServiceMessage(service)
	default:
		result.Message = "service reports UNKNOWN"
	}

	return result, nil
}

func grpcUnknownServiceMessage(service string) string {
	if service == "" {
		return "server does not know the requested service"
	}
	return fmt.Sprintf("server does not know service %q", service)
}

func grpcServingStatusName(s grpc_health_v1.HealthCheckResponse_ServingStatus) string {
	switch s {
	case grpc_health_v1.HealthCheckResponse_SERVING:
		return ServingStatusServing
	case grpc_health_v1.HealthCheckResponse_NOT_SERVING:
		return ServingStatusNotServing
	case grpc_health_v1.HealthCheckResponse_SERVICE_UNKNOWN:
		return ServingStatusServiceUnknown
	default:
		return ServingStatusUnknown
	}
}

// grpcTransportMessage maps a failed dial onto a fixed string. The raw error is
// never returned: a certificate failure quotes the peer's subject and chain,
// which would hand an internal service's identity back to the caller.
func grpcTransportMessage(code codes.Code, err error, timeoutMs int64) string {
	if code == codes.DeadlineExceeded {
		return fmt.Sprintf("timeout after %d ms", timeoutMs)
	}

	raw := err.Error()
	switch {
	case isTLSFailure(raw):
		return "certificate verification failed"
	case strings.Contains(raw, "connection refused"):
		retu
```

### Core Architecture Module: `apps/checker/checker/http.go`
```
package checker

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"net/url"
	"strings"
	"time"

	"github.com/openstatushq/openstatus/apps/checker/request"
	"github.com/rs/zerolog/log"
)

type Timing struct {
	DnsStart          int64 `json:"dnsStart"`
	DnsDone           int64 `json:"dnsDone"`
	ConnectStart      int64 `json:"connectStart"`
	ConnectDone       int64 `json:"connectDone"`
	TlsHandshakeStart int64 `json:"tlsHandshakeStart"`
	TlsHandshakeDone  int64 `json:"tlsHandshakeDone"`
	FirstByteStart    int64 `json:"firstByteStart"`
	FirstByteDone     int64 `json:"firstByteDone"`
	TransferStart     int64 `json:"transferStart"`
	TransferDone      int64 `json:"transferDone"`
}

type Response struct {
	Headers   map[string]string `json:"headers,omitempty"`
	Body      string            `json:"body,omitempty"`
	Error     string            `json:"error,omitempty"`
	Region    string            `json:"region"`
	JobType   string            `json:"jobType"`
	Latency   int64             `json:"latency"`
	Timestamp int64             `json:"timestamp"`
	Status    int               `json:"status,omitempty"`
	Timing    Timing            `json:"timing"`
}

// maxResponseBodyBytes caps the read of a probed response body so a large body
// cannot OOM the 512 MB checker machines (exit 137 waves).
const maxResponseBodyBytes = 10 << 20 // 10 MiB

// decodeBase64Body decodes a data URL base64 body if needed
func decodeBase64Body(body string) ([]byte, error) {
	data := strings.Split(body, ",")
	if len(data) == 2 {
		return base64.StdEncoding.DecodeString(data[1])
	}
	return nil, fmt.Errorf("invalid base64 data url format")
}

// FIXME: This should only return the TCP Timing Data;
func Http(ctx context.Context, client *http.Client, inputData request.HttpCheckerRequest) (Response, error) {
	logger := log.Ctx(ctx).With().Str("monitor", inputData.URL).Logger()

	var bodyBytes []byte
	if inputData.Method == http.MethodPost {
		contentType := ""
		for _, header := range inputData.Headers {
			if header.Key == "Content-Type" {
				contentType = header.Value
				break
			}
		}
		if contentType == "application/octet-stream" {
			decoded, err := decodeBase64Body(inputData.Body)
			if err != nil {
				return Response{}, fmt.Errorf("error while decoding base64: %w", err)
			}
			bodyBytes = decoded
		} else {
			bodyBytes = []byte(inputData.Body)
		}
	} else {
		bodyBytes = []byte(inputData.Body)
	}

	req, err := http.NewRequestWithContext(ctx, inputData.Method, inputData.URL, bytes.NewReader(bodyBytes))
	if err != nil {
		logger.Error().Err(err).Msg("error while creating req")
		return Response{}, fmt.Errorf("unable to create req: %w", err)
	}
	req.Header.Set("User-Agent", "OpenStatus/1.0")
	for _, header := range inputData.Headers {
		if header.Key != "" {
			req.Header.Set(header.Key, header.Value)
		}
	}

	// Maybe we should remove the default post to application JSON
	// Default POST Content-Type
	if inputData.Method == http.MethodPost && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	timing := Timing{}

	trace := &httptrace.ClientTrace{
		DNSStart:          func(_ httptrace.DNSStartInfo) { timing.DnsStart = time.Now().UTC().UnixMilli() },
		DNSDone:           func(_ httptrace.DNSDoneInfo) { timing.DnsDone = time.Now().UTC().UnixMilli() },
		ConnectStart:      func(_, _ string) { timing.ConnectStart = time.Now().UTC().UnixMilli() },
		ConnectDone:       func(_, _ string, _ error) { timing.ConnectDone = time.Now().UTC().UnixMilli() },
		TLSHandshakeStart: func() { timing.TlsHandshakeStart = time.Now().UTC().UnixMilli() },
		TLSHandshakeDone:  func(_ tls.ConnectionState, _ error) { timing.TlsHandshakeDone = time.Now().UTC().UnixMilli() },
		GotConn: func(_ httptrace.GotConnInfo) {
			timing.FirstByteStart = time.Now().UTC().UnixMilli()
		},
		GotFirstResponseByte: func() {
			timing.FirstByteDone = time.Now().UTC().UnixMilli()
			timing.TransferStart = time.Now().UTC().UnixMilli()
		},
	}

	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	start := time.Now()

	response, err := client.Do(req)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		errorMsg := err.Error()

		var urlErr *url.Error
		if errors.As(err, &urlErr) && urlErr.Timeout() {
			errorMsg = fmt.Sprintf("Timeout after %d ms", latency)
		}

		logger.Error().Err(err).Msg("error while pinging")

		// Return Response with error field instead of returning a Go error
		// This ensures all failures (timeouts, connection refused, DNS failures, etc.)
		// are properly ingested and displayed in the dashboard
		return Response{
			Latency:   latency,
			Timing:    timing,
			Timestamp: start.UTC().UnixMilli(),
			Error:     errorMsg,
			Status:    0,
		}, nil
	}

	defer response.Body.Close()

	// Cap the response body: an endpoint returning a large body would
	// otherwise OOM these 512 MB machines (fleet-wide exit 137 waves).
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBodyBytes))

	timing.TransferDone = time.Now().UTC().UnixMilli()

	if err != nil {
		return Response{
			Latency:   latency,
			Timing:    timing,
			Timestamp: start.UTC().UnixMilli(),
			Error:     fmt.Sprintf("Cannot read response body: %s", err.Error()),
		}, err
	}

	headers := make(map[string]string)
	for key := range response.Header {
		headers[key] = response.Header.Get(key)
	}

	return Response{
		Timestamp: start.UTC().UnixMilli(),
		Status:    response.StatusCode,
		Headers:   headers,
		Timing:    timing,
		Latency:   latency,
		Body:      string(body),
	}, nil

}

```

### Core Architecture Module: `apps/checker/checker/icmp.go`
```
package checker

import (
	"fmt"
	"net"
	"os"
	"sync/atomic"
	"time"

	"golang.org/x/net/icmp"
	"golang.org/x/net/ipv4"
	"golang.org/x/net/ipv6"
)

// icmpEchoCounter hands each probe its own echo identifier. A raw socket
// receives every ICMP packet delivered to the host, so probes are told apart by
// the echo id alone; a per-process value (the pid) makes two concurrent probes
// to the same target indistinguishable. Seeded from the pid so a restart does
// not immediately reuse the ids of packets still in flight.
var icmpEchoCounter = func() *atomic.Uint32 {
	var c atomic.Uint32
	c.Store(uint32(os.Getpid()))
	return &c
}()

func nextEchoID() int {
	return int(icmpEchoCounter.Add(1) & 0xffff)
}

const (
	icmpPacketCount    = 3
	icmpPacketInterval = 100 * time.Millisecond
	// Applied when a caller omits the timeout. Without it the deadline below
	// lands in the past, the send loop breaks before the first packet, and the
	// check reports "no reply" having probed nothing.
	icmpDefaultTimeout = 45_000
)

type ICMPResponseTiming struct {
	// RTTs holds one entry per sent packet in send order; -1 marks a lost packet.
	RTTs []int64 `json:"rtts"`
}

type ICMPResult struct {
	Timing          ICMPResponseTiming
	Latency         int64
	LatencyMin      int64
	LatencyMax      int64
	PacketsSent     uint8
	PacketsReceived uint8
}

type ICMPResponse struct {
	Region          string             `json:"region"`
	ErrorMessage    string             `json:"errorMessage"`
	JobType         string             `json:"jobType"`
	RequestId       int64              `json:"requestId,omitempty"`
	WorkspaceID     int64              `json:"workspaceId"`
	MonitorID       int64              `json:"monitorId"`
	Timestamp       int64              `json:"timestamp"`
	Latency         int64              `json:"latency"`
	LatencyMin      int64              `json:"latencyMin"`
	LatencyMax      int64              `json:"latencyMax"`
	PacketsSent     uint8              `json:"packetsSent"`
	PacketsReceived uint8              `json:"packetsReceived"`
	Timing          ICMPResponseTiming `json:"timing"`
	Error           uint8              `json:"error,omitempty"`
}

func PingICMP(timeoutMs int64, hostname string) (ICMPResult, error) {
	if timeoutMs <= 0 {
		timeoutMs = icmpDefaultTimeout
	}

	dst, err := net.ResolveIPAddr("ip", hostname)
	if err != nil {
		return ICMPResult{}, fmt.Errorf("resolve error: %w", err)
	}

	var (
		udpNetwork string
		rawNetwork string
		proto      int
		echoType   icmp.Type
	)
	if dst.IP.To4() != nil {
		udpNetwork, rawNetwork, proto, echoType = "udp4", "ip4:icmp", ipv4.ICMPTypeEcho.Protocol(), ipv4.ICMPTypeEcho
	} else {
		udpNetwork, rawNetwork, proto, echoType = "udp6", "ip6:ipv6-icmp", ipv6.ICMPTypeEchoRequest.Protocol(), ipv6.ICMPTypeEchoRequest
	}

	conn, isRaw, err := listenICMP(udpNetwork, rawNetwork)
	if err != nil {
		return ICMPResult{}, fmt.Errorf("icmp socket error: %w", err)
	}
	defer conn.Close()

	deadline := time.Now().Add(time.Duration(timeoutMs) * time.Millisecond)
	id := nextEchoID()

	timing := ICMPResponseTiming{RTTs: make([]int64, 0, icmpPacketCount)}
	received := make([]int64, 0, icmpPacketCount)
	var packetsSent uint8
	var lastErr error

	for seq := 0; seq < icmpPacketCount; seq++ {
		if seq > 0 {
			time.Sleep(icmpPacketInterval)
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			break
		}
		perPacket := remaining / time.Duration(icmpPacketCount-seq)
		packetsSent++

		rtt, err := sendEcho(conn, isRaw, proto, echoType, dst, id, seq, time.Now().Add(perPacket))
		if err != nil {
			lastErr = err
			timing.RTTs = append(timing.RTTs, -1)
			continue
		}
		timing.RTTs = append(timing.RTTs, rtt)
		received = append(received, rtt)
	}

	if len(received) == 0 {
		if lastErr != nil {
			return ICMPResult{}, lastErr
		}
		return ICMPResult{}, fmt.Errorf("no reply from %s", hostname)
	}

	var sum, min, max int64
	for i, rtt := range received {
		sum += rtt
		if i == 0 || rtt < min {
			min = rtt
		}
		if i == 0 || rtt > max {
			max = rtt
		}
	}

	return ICMPResult{
		Timing:          timing,
		Latency:         sum / int64(len(received)),
		LatencyMin:      min,
		LatencyMax:      max,
		PacketsSent:     packetsSent,
		PacketsReceived: uint8(len(received)),
	}, nil
}

// listenICMP prefers an unprivileged datagram socket and falls back to a raw
// socket when the runtime lacks ping_group_range but holds CAP_NET_RAW.
func listenICMP(udpNetwork, rawNetwork string) (*icmp.PacketConn, bool, error) {
	udpBind, rawBind := "0.0.0.0", "0.0.0.0"
	if udpNetwork == "udp6" {
		udpBind, rawBind = "::", "::"
	}

	conn, err := icmp.ListenPacket(udpNetwork, udpBind)
	if err == nil {
		return conn, false, nil
	}

	rawConn, rawErr := icmp.ListenPacket(rawNetwork, rawBind)
	if rawErr != nil {
		return nil, false, fmt.Errorf("udp: %v, raw: %w", err, rawErr)
	}
	return rawConn, true, nil
}

func sendEcho(conn *icmp.PacketConn, isRaw bool, proto int, echoType icmp.Type, dst *net.IPAddr, id, seq int, deadline time.Time) (int64, error) {
	var writeAddr net.Addr = &net.UDPAddr{IP: dst.IP, Zone: dst.Zone}
	if isRaw {
		writeAddr = &net.IPAddr{IP: dst.IP, Zone: dst.Zone}
	}

	msg := icmp.Message{
		Type: echoType,
		Code: 0,
		Body: &icmp.Echo{ID: id, Seq: seq, Data: []byte("openstatus")},
	}
	wb, err := msg.Marshal(nil)
	if err != nil {
		return 0, fmt.Errorf("marshal error: %w", err)
	}

	if err := conn.SetDeadline(deadline); err != nil {
		return 0, err
	}

	start := time.Now()
	if _, err := conn.WriteTo(wb, writeAddr); err != nil {
		return 0, fmt.Errorf("write error: %w", err)
	}

	rb := make([]byte, 1500)
	for {
		n, peer, err := conn.ReadFrom(rb)
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				return 0, fmt.Errorf("timeout")
			}
			return 0, fmt.Errorf("read error: %w", err)
		}

		rm, err := icmp.ParseMessage(proto, rb[:n])
		if err != nil {
			continue
		}

		switch body := rm.Body.(type) {
		case *icmp.Echo:
			// A reply to our probe can only come from the target. A raw socket
			// is not demultiplexed the way the datagram path is, so without
			// this it also sees replies belonging to other probes.
			if !addrIP(peer).Equal(dst.IP) {
				continue
			}
			// The kernel rewrites the Echo ID on datagram sockets, so only raw
			// sockets can trust it; datagram replies are matched on Seq alone.
			if body.Seq != seq || (isRaw && body.ID != id) {
				continue
			}
			return time.Since(start).Milliseconds(), nil
		case *icmp.DstUnreach:
			// Errors come from whichever hop rejected the packet, not from the
			// target, so the peer says nothing about ownership — the quoted
			// datagram does.
			if !provokedByProbe(body.Data, proto, id, seq, isRaw) {
				continue
			}
			return 0, fmt.Errorf("destination unreachable")
		case *icmp.TimeExceeded:
			if !provokedByProbe(body.Data, proto, id, seq, isRaw) {
				continue
			}
			return 0, fmt.Errorf("time exceeded")
		}
	}
}

// addrIP pulls the IP out of the address shape each socket type reports:
// *net.IPAddr for raw, *net.UDPAddr for the unprivileged datagram path.
func addrIP(addr net.Addr) net.IP {
	switch a := addr.(type) {
	case *net.IPAddr:
		return a.IP
	case *net.UDPAddr:
		return a.IP
	}
	return nil
}

// provokedByProbe reports whether an ICMP error quotes the packet we sent. The
// error carries the original datagram — IP header plus at least its first eight
// bytes, which is the whole echo header — so the quoted id and sequence
// identify the sender. Without this a raw socket would treat an unrelated
// flow's "destination unreachable" as its own probe failing.
func provokedByProbe(data []byte, proto, id, seq int, isRaw bool) bool {
	var quoted []byte
	switch proto {
	case ipv4.ICMPTypeEcho.Protocol():
		h, err := icmp.ParseIPv4Header(data)
		if err != nil || len(data) < h.Len {
			return false
		}
		quoted = data[h.Len:]
	default:
		if len(data) < ipv6.HeaderLen {
			return false
		}
		quoted = data[ipv6.HeaderLen:]
	}

	msg, err := icmp.ParseMessage(proto,
```

### Core Architecture Module: `apps/checker/checker/tcp.go`
```
package checker

import (
	"fmt"
	"net"
	"strings"
	"time"
)

type TCPData struct {
	WorkspaceID string `json:"workspaceId"`
	MonitorID   string `json:"monitorId"`
	Timestamp   int64  `json:"timestamp"`
}

type TCPResponseTiming struct {
	TCPStart int64 `json:"tcpStart"`
	TCPDone  int64 `json:"tcpDone"`
}

type TCPResponse struct {
	Region       string            `json:"region"`
	ErrorMessage string            `json:"errorMessage"`
	JobType      string            `json:"jobType"`
	RequestId    int64             `json:"requestId,omitempty"`
	WorkspaceID  int64             `json:"workspaceId"`
	MonitorID    int64             `json:"monitorId"`
	Timestamp    int64             `json:"timestamp"`
	Latency      int64             `json:"latency"`
	Timing       TCPResponseTiming `json:"timing"`
	Error        uint8             `json:"error,omitempty"`
}

func PingTCP(timeout int, url string) (TCPResponseTiming, error) {
	start := time.Now().UTC().UnixMilli()
	conn, err := net.DialTimeout("tcp", url, time.Duration(timeout)*time.Second)
	stop := time.Now().UTC().UnixMilli()

	if err != nil {
		if e := err.(*net.OpError).Timeout(); e {
			return TCPResponseTiming{}, fmt.Errorf("timeout after %d ms", timeout*1000)
		}
		if strings.Contains(err.Error(), "connection refused") {
			return TCPResponseTiming{}, fmt.Errorf("connection refused")
		}
		return TCPResponseTiming{}, fmt.Errorf("dial error: %w", err)
	}
	defer conn.Close()

	return TCPResponseTiming{TCPStart: start, TCPDone: stop}, nil
}

```

### Core Architecture Module: `apps/checker/checker/update.go`
```
package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/rs/zerolog/log"
	"google.golang.org/api/option"

	"cloud.google.com/go/auth"
	cloudtasks "cloud.google.com/go/cloudtasks/apiv2"
	taskspb "cloud.google.com/go/cloudtasks/apiv2/cloudtaskspb"
)

type UpdateData struct {
	MonitorId     string `json:"monitorId"`
	Status        string `json:"status"`
	Message       string `json:"message,omitempty"`
	Region        string `json:"region"`
	CronTimestamp int64  `json:"cronTimestamp"`
	StatusCode    int    `json:"statusCode,omitempty"`
	Latency       int64  `json:"latency,omitempty"`
}

func UpdateStatus(ctx context.Context, updateData UpdateData) error {

	url := "https://openstatus-workflows.fly.dev/updateStatus"
	basic := "Basic " + os.Getenv("CRON_SECRET")
	payloadBuf := new(bytes.Buffer)
	c := os.Getenv("GCP_PRIVATE_KEY")
	c = strings.ReplaceAll(c, "\\n", "\n")
	opts := &auth.Options2LO{
		Email:        os.Getenv("GCP_CLIENT_EMAIL"),
		PrivateKey:   []byte(c),
		PrivateKeyID: os.Getenv("GCP_PRIVATE_KEY_ID"),
		Scopes: []string{
			"https://www.googleapis.com/auth/cloud-platform",
		},
		TokenURL: "https://oauth2.googleapis.com/token",
	}

	tp, err := auth.New2LOTokenProvider(opts)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while creating token provider")
		return err
	}

	creds := auth.NewCredentials(&auth.CredentialsOptions{
		TokenProvider: tp,
	})

	client, err := cloudtasks.NewClient(ctx, option.WithAuthCredentials(creds))
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while creating cloud tasks client")

	}
	defer client.Close()

	if err := json.NewEncoder(payloadBuf).Encode(updateData); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while updating status")
		return err
	}
	projectID := os.Getenv("GCP_PROJECT_ID")
	queuePath := fmt.Sprintf("projects/%s/locations/europe-west1/queues/alerting", projectID)
	req := &taskspb.CreateTaskRequest{
		Parent: queuePath,
		Task: &taskspb.Task{
			// https://godoc.org/google.golang.org/genproto/googleapis/cloud/tasks/v2#HttpRequest
			MessageType: &taskspb.Task_HttpRequest{
				HttpRequest: &taskspb.HttpRequest{
					HttpMethod: taskspb.HttpMethod_POST,
					Url:        url,
					Headers:    map[string]string{"Authorization": basic, "Content-Type": "application/json"},
				},
			},
		},
	}

	// Add a payload message if one is present.
	req.Task.GetHttpRequest().Body = payloadBuf.Bytes()

	_, err = client.CreateTask(ctx, req)
	if err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("error while creating the cloud task")
		return fmt.Errorf("cloudtasks.CreateTask: %w", err)
	}

	return nil
}

```

### Core Architecture Module: `apps/checker/cmd/private/main.go`
```
package main

import (
	"context"
	"fmt"
	"net/http"

	"os"
	"os/signal"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/madflojo/tasks"
	"github.com/openstatushq/openstatus/apps/checker/pkg/job"
	"github.com/openstatushq/openstatus/apps/checker/pkg/scheduler"

	v1 "github.com/openstatushq/openstatus/apps/checker/proto/private_location/v1"
)

const (
	configRefreshInterval = 10 * time.Minute
	platformTimeout       = 30 * time.Second
)

func main() {
	apiKey := getEnv("OPENSTATUS_KEY", "")
	if apiKey == "" {
		fmt.Fprintln(os.Stderr, "OPENSTATUS_KEY is required: the probe cannot authenticate against openstatus")
		os.Exit(1)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown on interrupt
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		cancel()
	}()
	fmt.Println("Launching openstatus private location checker")
	s := tasks.New()
	defer s.Stop()

	monitorManager := scheduler.MonitorManager{
		Client:    getClient(apiKey),
		JobRunner: job.NewJobRunner(),
		Scheduler: s,
	}
	configTicker := time.NewTicker(configRefreshInterval)
	defer configTicker.Stop()

	monitorManager.UpdateMonitors(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-configTicker.C:
			fmt.Println("fetching monitors")
			monitorManager.UpdateMonitors(ctx)
		}
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getClient(apiKey string) v1.PrivateLocationServiceClient {
	ingestUrl := getEnv("OPENSTATUS_INGEST_URL", "https://openstatus-private-location.fly.dev")

	// Tasks run with RunSingleInstance, so an untimed request that hangs would
	// wedge that monitor: it never checks again until the probe restarts.
	httpClient := &http.Client{Timeout: platformTimeout}

	client := v1.NewPrivateLocationServiceClient(
		httpClient,
		ingestUrl,
		connect.WithHTTPGet(),
		connect.WithInterceptors(NewAuthInterceptor(apiKey)),
	)

	return client
}

func NewAuthInterceptor(token string) connect.UnaryInterceptorFunc {

	interceptor := func(next connect.UnaryFunc) connect.UnaryFunc {
		return connect.UnaryFunc(func(
			ctx context.Context,
			req connect.AnyRequest,
		) (connect.AnyResponse, error) {
			if req.Spec().IsClient {
				// Send a token with client requests.
				req.Header().Set("openstatus-token", token)
			}

			return next(ctx, req)
		})
	}
	return connect.UnaryInterceptorFunc(interceptor)

}

```

### Core Architecture Module: `apps/checker/cmd/server/main.go`
```
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openstatushq/openstatus/apps/checker/handlers"

	"github.com/openstatushq/openstatus/apps/checker/pkg/logger"
	"github.com/openstatushq/openstatus/apps/checker/pkg/tinybird"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/contrib/bridges/otelslog"
	// otelz "go.opentelemetry.io/contrib/bridges/otelzerolog"
	"go.opentelemetry.io/otel/attribute"
	otlploghttp "go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/log/global"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.39.0"
)

func shouldSample(event map[string]any) bool {
	statusCode, _ := event["status_code"].(int)
	durationMs, _ := event["duration_ms"].(int)

	// Always capture: server errors
	if statusCode >= 500 {
		return true
	}

	// Always capture: explicit errors
	if _, hasError := event["error"]; hasError {
		return true
	}

	// Always capture: slow requests (above p99 - 2s threshold)
	if durationMs > 2000 {
		return true
	}

	// Higher sampling for client errors (4xx) - 100%
	if statusCode >= 400 && statusCode < 500 {
		return true
	}

	// Random sample successful, fast requests at 20%
	return rand.Float64() < 0.2
}

// MapToAttrs converts a map[string]any to a slice of slog.Attr
func MapToAttrs(m map[string]any) []slog.Attr {
	attrs := make([]slog.Attr, 0, len(m))
	for k, v := range m {
		attrs = append(attrs, toAttr(k, v))
	}
	return attrs
}

func toAttr(key string, value any) slog.Attr {
	switch v := value.(type) {
	case string:
		return slog.String(key, v)
	case int:
		return slog.Int(key, v)
	case int64:
		return slog.Int64(key, v)
	case float64:
		return slog.Float64(key, v)
	case bool:
		return slog.Bool(key, v)
	case time.Time:
		return slog.Time(key, v)
	case time.Duration:
		return slog.Duration(key, v)
	case map[string]any:
		return slog.Group(key, mapToAny(v)...)
	default:
		return slog.Any(key, v)
	}
}

func mapToAny(m map[string]any) []any {
	args := make([]any, 0, len(m)*2)
	for k, v := range m {
		args = append(args, toAttr(k, v))
	}
	return args
}

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		startTime := time.Now()

		// Generate or get request ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		c.Set("requestId", requestID)

		// Build wide event context at request start
		event := map[string]any{
			"timestamp":    startTime.Format(time.RFC3339),
			"request_id":   requestID,
			"method":       c.Request.Method,
			"path":         c.Request.URL.Path,
			"url":          c.Request.Host + c.Request.URL.String(),
			"user_agent":   c.GetHeader("User-Agent"),
			"content_type": c.GetHeader("Content-Type"),
		}
		c.Set("event", event)

		// Process request
		c.Next()

		// After request - capture response details
		duration := time.Since(startTime).Milliseconds()
		status := c.Writer.Status()

		event["status_code"] = status
		event["duration_ms"] = int(duration)

		// var requestErr error
		if len(c.Errors) > 0 {
			event["outcome"] = "error"
			lastErr := c.Errors.Last()
			event["error"] = map[string]any{
				"type":    "GinError",
				"message": lastErr.Error(),
			}
		} else {
			event["outcome"] = "success"
		}

		if shouldSample(event) {
			attrs := MapToAttrs(event)
			slog.LogAttrs(c.Request.Context(), slog.LevelInfo, "request done", attrs...)
		}

		log.Debug().
			Int("status_code", status).
			Int64("duration_ms", duration).
			Str("request_id", requestID).
			Msg("Request completed")
	}
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Best-effort: allow unprivileged ICMP datagram sockets across all GIDs so
	// PingICMP can avoid the raw-socket fallback. Ignored if not writable.
	if err := os.WriteFile("/proc/sys/net/ipv4/ping_group_range", []byte("0 2147483647"), 0644); err != nil {
		log.Warn().Err(err).Msg("could not widen ping_group_range; icmp will use the raw-socket fallback")
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-done
		cancel()
	}()

	// environment variables.
	var region string
	cronSecret := env("CRON_SECRET", "")
	tinyBirdToken := env("TINYBIRD_TOKEN", "")
	logLevel := env("LOG_LEVEL", "info")
	cloudProvider := env("CLOUD_PROVIDER", "fly")
	axiomToken := env("AXIOM_TOKEN", "")
	axiomDataset := env("AXIOM_DATASET", "dev")
	switch cloudProvider {
	case "fly":
		region = env("FLY_REGION", env("REGION", "local"))

	case "koyeb":
		region = fmt.Sprintf("koyeb_%s", env("KOYEB_REGION", env("REGION", "local")))

	case "railway":
		region = fmt.Sprintf("railway_%s", env("RAILWAY_REPLICA_REGION", env("REGION", "local")))
	default:
		log.Fatal().Msgf("unsupported cloud provider: %s", cloudProvider)
	}
	logger.Configure(logLevel)

	// Define resource with service name, version, and environment
	res := resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceNameKey.String("openstatus-checker"),
		semconv.ServiceVersionKey.String("1.0.0"),
		attribute.String("environment", "production"),
		attribute.String("cloud.provider", cloudProvider),
		attribute.String("cloud.region", region),
	)

	// Set up OTLP log exporter for Axiom
	exporter, err := otlploghttp.New(ctx,
		otlploghttp.WithEndpointURL("https://eu-central-1.aws.edge.axiom.co/v1/logs"),
		otlploghttp.WithHeaders(map[string]string{
			"Authorization":   "Bearer " + axiomToken,
			"X-Axiom-Dataset": axiomDataset,
		}),
	)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create OTLP exporter")
	}

	// Create log provider with resource and batch processor
	logProvider := sdklog.NewLoggerProvider(
		sdklog.WithResource(res),
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
	)
	defer logProvider.Shutdown(ctx)

	global.SetLoggerProvider(logProvider)
	slog.SetDefault(otelslog.NewLogger("openstatus-checker"))
	httpClient := &http.Client{
		Timeout: 45 * time.Second,
	}

	defer httpClient.CloseIdleConnections()

	tinybirdClient := tinybird.NewClient(httpClient, tinyBirdToken)

	h := &handlers.Handler{
		Secret:        cronSecret,
		CloudProvider: cloudProvider,
		Region:        region,
		TbClient:      tinybirdClient,
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(Logger())
	router.POST("/checker", h.HTTPCheckerHandler)
	router.POST("/checker/http", h.HTTPCheckerHandler)
	router.POST("/checker/tcp", h.TCPHandler)
	router.POST("/checker/dns", h.DNSHandler)
	router.POST("/checker/icmp", h.ICMPHandler)
	router.POST("/checker/grpc", h.GRPCHandler)
	router.POST("/ping/:region", h.PingRegionHandler)
	router.POST("/tcp/:region", h.TCPHandlerRegion)
	router.POST("/dns/:region", h.DNSHandlerRegion)
	router.POST("/icmp/:region", h.ICMPHandlerRegion)
	router.POST("/grpc/:region", h.GRPCHandlerRegion)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong", "region": region, "provider": cloudProvider})
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf("0.0.0.0:%s", env("PORT", "8080")),
		Handler: router,
	}

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Ctx(ctx).Error().Err(err).Msg("failed to start http server")
			cancel()
		}
	}()

	<-ctx.Done()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Ctx(ctx).Error().Err(err).Msg("failed to shutdown http server")

		return
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	return fallback
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2821** (2026-09-30): **feat: dashboard incident details pages**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2821?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Q/ScU2T32Qwi06+3PXojigx/ciWc+4V3JOQm5KF0wPU=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy13ZWIvQXFkVWh5aFEyelFrY3Zha0I2MjRadkpjZ0VtTSIsInByZXZpZXdVcmwiOiIiLCJuZXh0Q29tbWl0U3RhdHVzIjoiU0tJUFBFRCJ9LHsibmFtZSI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkIiwicHJvamVjdElkIjoicHJqX1RzYXphSE83Y0ZxdEJLR0FrUkJON20xODFNSlgiLCJ2MCI6ZmFsc2UsInJvb3REaXJlY3RvcnkiOiJhcHBzL2Rhc2hib2FyZCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLWRhc2hib2FyZC1naXQtZmVhdC1kYXNoYm9hcmQtaW5jaS01NTU3NWYtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy1kYXNoYm9hcmQvQW5zQWZheUpQdjRXZUxiQkcyU2V1VjgzVTVMeCIsInBy
  > @claude review
  > **Claude finished @mxkaske's task in 29s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/36764099320)  --- ### Review of #2821: incident details pages  I read the code behind the cubic findings and checked each one. I did not run lint, typecheck or the app. The static review turned up no blocking bugs, and most findings are valid but minor.  **Worth fixing** - **`composer.tsx:46`: dead selector.** `[.border-b]:pb-1.5` compiles to a descendant selector (`& .border-b`), so it never matches. The same applies to `[.border-t]:pt-2` in the footer. Use `[&.border-b]:pb-1.5` and `[&.border-t]:pt-2`, or delete them, since the base padding already gives the same result. - **`incident-status-report.tsx:356`: orphaned form after close.** The footer (Link/Create/Cancel) is hidden when `closed`. The `mode === "link" | "create"` content at lines 306 and 322 still renders, so closing the incident while a form is open leaves a form with no buttons. Gate that content on `!closed`

- **Issue #2819** (2026-09-30): **Announcing vercel oss program**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2819?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #Cnn5SJG5YgQoyrfVWwWKHi1UGmB7VZmzoFdpzRDaSls=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViL0JWUDdpdTJydVhRWkpIdDVCM2FiZXJFYzlLUEoiLCJwcmV2aWV3VXJsIjoib3BlbnN0YXR1cy13ZWItZ2l0LXB1c2gteHVsenJ2cW16bXZwLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoib3BlbnN0YXR1cy13ZWItZ2l0LXB1c2gteHVsenJ2cW16bXZwLW9wZW4tc3RhdHVzLnZlcmNlbC5hcHAifSwidjAiOmZhbHNlfSx7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvZGFzaGJvYXJkIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtZGFzaGJvYXJkLzZTWjZ0V1VVNjhlZ3hwY0RWcFlFSnJCdU5HaTIiLCJwcmV2aWV3VXJsIjoiIiwibmV4dENv

- **Issue #2817** (2026-09-29): **model: update model**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2817?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #6RlwwczuzMUXlKLTm1Jgn4ZQBu0+1Ba0x/0xPAfVu7g=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy1kYXNoYm9hcmQvRG8xV0p3RmZYS1BhRzRBMWdqNzZ0NUxNU3NaYyIsInByZXZpZXdVcmwiOiJvcGVuc3RhdHVzLWRhc2hib2FyZC1naXQtcHVzaC12eW1xenRscXR4enAtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLWRhc2hib2FyZC1naXQtcHVzaC12eW1xenRscXR4enAtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwibGl2ZUZlZWRiYWNrIjp7InJlc29sdmVkIjowLCJ1bnJlc29sdmVkIjowLCJ0b3RhbCI6MCwibGluayI6IiJ9LCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Bl
  > @claude review this 
  > **Claude finished @thibaultleouay's task in 15s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/36622274985)  --- ### Review of PR #2817 (model: update model)  - [x] Read the diff (4 files, +4/-4) - [x] Grep for other model references  ### Summary The PR makes three changes: - It moves the Slack agent default and the MCP evals from `anthropic/claude-opus-5` to `anthropic/claude-sonnet-5`. - It moves the paid-plan chat model in `packages/ai/src/resolve-model.ts` from `claude-sonnet-4.5` to `claude-sonnet-5`. - It updates the matching test assertion in `resolve-model.test.ts`.  The diff is small and consistent. The test change matches the constant, and I found no other stale references to the paid model id.  ### Points to check 1. **Gateway model id.** I couldn't verify that `anthropic/claude-sonnet-5` resolves on the Vercel AI Gateway. The current Sonnet id I know of is `claude-sonnet-5-5`, which the gateway would probably list as `anthropic/claude-sonnet-5.5`. T

- **Issue #2814** (2026-09-29): **chore: remove slack-agent feature flag**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2814?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > [vc]: #VuUVLe6//MNsXSNzy+G/VK2om4VOqeBKQ/gubRW0AJM=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy93ZWIiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy13ZWIvQW1ta2VtN3ZBSlV0Q3RkVHkzWHhhQTRyeDFURSIsInByZXZpZXdVcmwiOiJvcGVuc3RhdHVzLXdlYi1naXQtY2hvcmUtcmVtb3ZlLXNsYWNrLWFnZW50LWZlYXR1cmUtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLXdlYi1naXQtY2hvcmUtcmVtb3ZlLXNsYWNrLWFnZW50LWZlYXR1cmUtb3Blbi1zdGF0dXMudmVyY2VsLmFwcCJ9fSx7Im5hbWUiOiJvcGVuc3RhdHVzLWRhc2hib2FyZCIsInByb2plY3RJZCI6InByal9Uc2F6YUhPN2NGcXRCS0dBa1JCTjdtMTgxTUpYIiwidjAiOmZhbHNlLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy1kYXNoYm9hcmQvOGZIOWd3WGpSaU1i

- **Issue #2812** (2026-09-29): **Add Simplified Chinese (`zh`) status page translations.**
  *Symptoms*:   <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2812?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img alt="Review in cubic" src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a> <!-- End of auto-generated description by cubic. -->  
  **Post-Mortem & Fix Analysis**:
  > @nulijiazaizhong is attempting to deploy a commit to the **OpenStatus** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=OpenStatus&slug=open-status&teamId=team_x6zTid6R7bO0QpkdlnPhHlGS&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%225ec622e8fbd7c6ff6b54e06d8178aba4f35cb683%22%7D%2C%22id%22%3A%22QmXos3QcABPThhtgU2bN7etixLuSZaEA5z5mg3YQYies53%22%2C%22org%22%3A%22openstatusHQ%22%2C%22prId%22%3A2812%2C%22repo%22%3A%22openstatus%22%7D).  
  > @nulijiazaizhong  can you add it in the api :   https://github.com/openstatusHQ/openstatus/blob/c62b100654e217bf4e99a76f362d0c6577779e1b/packages/proto/api/openstatus/status_page/v1/status_page.proto#L27 
  > > @nulijiazaizhong can you add it in the api :能否将其添加到 API 中？ >  > https://github.com/openstatusHQ/openstatus/blob/c62b100654e217bf4e99a76f362d0c6577779e1b/packages/proto/api/openstatus/status_page/v1/status_page.proto#L27  Added

- **Issue #2808** (2026-09-30): **dashboard: Postmortem tab**
  *Symptoms*: Part 20 of 21 of the incident management stack. Base: `incident/20-draft-postmortem`; merge bottom-up.  Touches: apps/dashboard. User-visible change: flag-gated.  - Dashboard: Postmortem tab (markdown editor on the row, "Draft with       agent", Approve, Approve & close); replace the 10 "Close"       button with "Close (skip postmortem)".  <details><summary>Stack</summary>    `incident/01-db`   `incident/02-services-foundations`   `incident/03-slack-members-only`   `incident/04-slack-hardening`   `incident/05-incident-verbs`   `incident/06-services-hooks`   `incident/07-api-router`   `incident/08-agent-tools`   `incident/09-dashboard-list`   `incident/10-dashboard-detail`   `incident/11-dashboard-hooks`   `incident/12-commander-email`   `incident/14-slack-scopes`   `incident/15-slack-channel`   `incident/16-slack-commands`   `incident/17-slack-reactions`   `incident/18-reminders`   `incident/19-postmortem`   `incident/20-draft-postmortem` → `incident/21-postmortem-tab`   `incident/22-launch`  </details>  🤖 Generated with [Claude Code](https://claude.com/claude-code)  <!-- This is an auto-generated description by cubic. --> <a href="https://cubic.dev/pr/openstatusHQ/openstatus/pull/2808?utm_source=github" target="_blank" rel="noopener noreferrer" data-no-image-dialog="true"><picture><source media="(prefers-color-scheme: dark)" srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://www.cubic.dev/buttons/rev
  **Post-Mortem & Fix Analysis**:
  > [vc]: #EHkVfw9U21c3NGutY6NfeKiBnR9na9Ni4HxYwyNiOG4=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViLzNudmRtMjZtUnNhaWdEbkt3SHJVelFnMkI2bTEiLCJwcmV2aWV3VXJsIjoiIiwibmV4dENvbW1pdFN0YXR1cyI6IlNLSVBQRUQiLCJsaXZlRmVlZGJhY2siOnsicmVzb2x2ZWQiOjAsInVucmVzb2x2ZWQiOjAsInRvdGFsIjowLCJsaW5rIjoiIn19LHsibmFtZSI6Im9wZW5zdGF0dXMtZGFzaGJvYXJkIiwicHJvamVjdElkIjoicHJqX1RzYXphSE83Y0ZxdEJLR0FrUkJON20xODFNSlgiLCJyb290RGlyZWN0b3J5IjoiYXBwcy9kYXNoYm9hcmQiLCJpbnNwZWN0b3JVcmwiOiJodHRwczovL3ZlcmNlbC5jb20vb3Blbi1zdGF0dXMvb3BlbnN0YXR1cy1kYXNoYm9hcmQvN2hUM0VuU1p3WG10ekJvSFNSOTFtcmN4TnVldyIsInByZXZpZXdVcmwiOiJvcGVuc3RhdHVzLWRhc2hib2FyZC1naXQtaW5jaWRlbnQtMjEtcG9zdG1vcnRlbS10YWItb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5y
  > @claude review this 
  > **Claude finished @thibaultleouay's task in 19s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/36729445724)  --- ### Review of #2808: Postmortem tab  The change is small and reads well. It follows the existing hook and mutation patterns, and the tab is gated on the resolved state. I read the diff only. I didn't run typecheck or the app. Notes below, most important first.  **1. Refetch can overwrite unsaved edits (agree with cubic)** — `incident-postmortem.tsx:57-59` ```ts useEffect(() => { setContent(postmortem?.content ?? TEMPLATE); }, [postmortem?.content]); ``` The effect resets the editor whenever `postmortem.content` changes. That's fine after Save, Draft with agent, or a first load. It's a problem when a background refetch (window refocus, or a teammate/Slack agent editing) returns different content while the user is typing. In that case their unsaved text is silently discarded. Suggested fix: only sync when the editor is pristine, or track the last synce

- **Issue #2807** (2026-09-30): **agent + slack: draft_postmortem**
  *Symptoms*: Part 19 of 21 of the incident management stack. Base: `incident/19-postmortem`; merge bottom-up.  Touches: packages/services (`incident/postmortem-draft.ts`, agent tools), packages/api, apps/server/src/routes/slack. User-visible change: flag-gated.  - `generatePostmortemDraft` in services (injected `generate` and Slack       history client): incident fields, timeline, linked status-report       updates and the bound channel (`collectChannelTranscript`: oldest       first, bot messages out, threads inlined, cap 500, truncation noted);       over 60k chars the transcript is summarized in 40k windows first and       the draft says so. Stored via `draftPostmortem` (`draftedBy: agent`,       `source_transcript`). Gated by the `slack-agent` limit. - Registry tool `draft_postmortem` (the agent saves a draft it wrote       itself; approval card) on every surface; the agent can't redraft an       approved postmortem. - Slack: `/openstatus incident postmortem [#id]` → generate with the       Slack agent model → `approve_postmortem` card (approve and close) →       follow-up announces and archives the channel. - Dashboard path: tRPC `incident.draftPostmortemWithAgent` (model from       `@openstatus/ai`, transcript through `WebClient`). - Analytics `postmortem_drafted`, `postmortem_approved`,       `incident_closed` (tRPC and Slack). - Tests: transcript assembly, prompt and stored transcript, windowed       summary, no-channel note, plan gate.  <details><summary>Stack</summary>    `incid
  **Post-Mortem & Fix Analysis**:
  > [vc]: #lwoci+ZaPu2Jh7zhtxAgwWySqcXb0H2/TvVo573WLw0=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViL0RpVWlXekYyMThlRzRRYVZYTFlpdlBLQ1ZzZzkiLCJwcmV2aWV3VXJsIjoib3BlbnN0YXR1cy13ZWItZ2l0LWluY2lkZW50LTIwLWRyYWZ0LXBvc3Rtb3J0ZW0tb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLXdlYi1naXQtaW5jaWRlbnQtMjAtZHJhZnQtcG9zdG1vcnRlbS1vcGVuLXN0YXR1cy52ZXJjZWwuYXBwIn0sInYwIjpmYWxzZX0seyJuYW1lIjoib3BlbnN0YXR1cy1kYXNoYm9hcmQiLCJwcm9qZWN0SWQiOiJwcmpfVHNhemFITzdjRnF0QktHQWtSQk43bTE4MU1KWCIsInJvb3REaXJlY3RvcnkiOiJhcHBzL2Rhc2hib2FyZCIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVuLXN0YXR1cy9vcGVuc3RhdHVzLWRhc2hib2FyZC9DNnc3NHhVQVZMQkZVSFQ3UXVjV1I1dE1xdmZwIiwi
  > @claude review this 
  > **Claude finished @thibaultleouay's task in 24s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/36726289777)  --- ### Review of #2807 (agent + slack: draft_postmortem)  Overall the structure is good: injected `generate` and Slack client, a plan gate, and a shared registry tool. I read the diff and the existing cubic comments and checked them against the code. I did not run tests.  **Cubic findings that I agree with, in priority order**  1. **Bot-authored parents drop their threads** (`postmortem-draft.ts:90`). `if (message.bot_id || !message.text) continue;` runs before the `replies` fetch. The incident card is bot-posted, and people often reply in its thread, so those human replies are lost. Skip only the line, and still fetch and inline the replies. 2. **Thread replies are neither paginated nor capped** (`:98`). Only the first 200 replies are read. The reply loop also increments `count` without checking `MAX_MESSAGES`, so the cap isn't enforced and `truncated`

- **Issue #2806** (2026-09-30): **db + services: incident_postmortem**
  *Symptoms*: Part 18 of 21 of the incident management stack. Base: `incident/18-reminders`; merge bottom-up.  Touches: packages/db, packages/services, packages/api, apps/server/src/routes/mcp. User-visible change: none (flag-gated).  - `src/schema/incidents/incident_postmortem.ts` (autoincrement id,       unique `incident_id`, cascade); migration; factory; audit variants       `incident_postmortem.create/update`. - Verbs: `draft-postmortem.ts` (upsert; `postmortem_drafted`, or       `postmortem_updated` when approved; sets `created_by`/`updated_by`       from the actor; `drafted_by` agent|user), `approve-postmortem.ts`       (role-gated, `postmortem_approved`), `get-postmortem.ts`; `close` now       requires an approved postmortem or an explicit `skipPostmortem: true`. - tRPC procedures + MCP/registry tools for the postmortem reads/writes. - Tests: upsert semantics, approved-edit keeps the status, audit       invariant extended to postmortem verbs, close preconditions.  <details><summary>Stack</summary>    `incident/01-db`   `incident/02-services-foundations`   `incident/03-slack-members-only`   `incident/04-slack-hardening`   `incident/05-incident-verbs`   `incident/06-services-hooks`   `incident/07-api-router`   `incident/08-agent-tools`   `incident/09-dashboard-list`   `incident/10-dashboard-detail`   `incident/11-dashboard-hooks`   `incident/12-commander-email`   `incident/14-slack-scopes`   `incident/15-slack-channel`   `incident/16-slack-commands`   `incident/17-slack-reactions`   `
  **Post-Mortem & Fix Analysis**:
  > [vc]: #xalJs4uQwwxxyrAHMbp2nmuuwbiRwVfctP0Hbi5vPMQ=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJvcGVuc3RhdHVzLXdlYiIsInByb2plY3RJZCI6InByal94NFlBcWZvaWhzNGdaOW5lRWVrTVZ4OU5scHpaIiwicm9vdERpcmVjdG9yeSI6ImFwcHMvd2ViIiwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL29wZW4tc3RhdHVzL29wZW5zdGF0dXMtd2ViL0ZFbzE4M0h6dldKcHB5b3JBZkJtZkF0VmdzWnIiLCJwcmV2aWV3VXJsIjoib3BlbnN0YXR1cy13ZWItZ2l0LWluY2lkZW50LTE5LXBvc3Rtb3J0ZW0tb3Blbi1zdGF0dXMudmVyY2VsLmFwcCIsIm5leHRDb21taXRTdGF0dXMiOiJERVBMT1lFRCIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJvcGVuc3RhdHVzLXdlYi1naXQtaW5jaWRlbnQtMTktcG9zdG1vcnRlbS1vcGVuLXN0YXR1cy52ZXJjZWwuYXBwIn0sInYwIjpmYWxzZX0seyJuYW1lIjoib3BlbnN0YXR1cy1kYXNoYm9hcmQiLCJwcm9qZWN0SWQiOiJwcmpfVHNhemFITzdjRnF0QktHQWtSQk43bTE4MU1KWCIsInJvb3REaXJlY3RvcnkiOiJhcHBzL2Rhc2hib2FyZCIsImluc3BlY3RvclVybCI6Imh0dHBzOi8vdmVyY2VsLmNvbS9vcGVuLXN0YXR1cy9vcGVuc3RhdHVzLWRhc2hib2FyZC84UVk0NHBiN1pQdkdzMmpWcGZiU1ZxSkh5bU1hIiwicHJldmlld1VybCI6
  > @claude review this 
  > **Claude finished @thibaultleouay's task in 20s** —— [View job](https://github.com/openstatusHQ/openstatus/actions/runs/36722142231)  --- ### Review of #2806: incident_postmortem  I read the service verbs, the close changes, the tRPC procedures and the schema and migration. I did not run the tests or `pnpm verify`. The overall shape is sound: the schema and migration match, the audit and event emission is consistent, and `close` is correctly gated behind an approved postmortem. Three things need fixing, and I checked the three cubic comments against the code.  ### Issues  **1. `approvePostmortem` doesn't check incident status** (`packages/services/src/incident/postmortem.ts:151-193`) — the cubic finding is valid. - `draftPostmortem` requires `status === "resolved"`, but `approvePostmortem` never checks it. - If an incident is reopened after a draft exists, someone can approve the draft and leave an approved postmortem on an active incident. - With `close: true`, `closeIncidentInTx` thr

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

### Incident Patch 1: `b6d08d4b` (2026-09-28)
**Commit Message**: fix(api): don't crash on import when STRIPE_SECRET_KEY is unset (#2783)

Self-hosted status-page returns 500 on every route with "Neither apiKey nor
config.authenticator provided" because the Stripe client is built with an empty key at
module load. The env schema already makes the key optional for self-hosting.

Co-authored-by: David A. Symons <1227896+o6uoq@users.noreply.github.com>

**File**: `packages/api/src/router/stripe/shared.ts` (modified, +3/-1)
```diff
@@ -4,7 +4,9 @@ import Stripe from "stripe";
 import { env } from "../../env";
 import { buildLimitsFromSubscription } from "./utils";
 
-export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "", {
+// The constructor throws on an empty key, and this module is loaded at import
+// time. Self-hosted installs leave STRIPE_SECRET_KEY unset and never call Stripe.
+export const stripe = new Stripe(env.STRIPE_SECRET_KEY || "sk_unset", {
   apiVersion: "2026-08-26.dahlia",
   appInfo: {
     name: "OpenStatus",
```

---

### Incident Patch 2: `8b6d45ba` (2026-09-27)
**Commit Message**: fix: header logo image (#2781)

**File**: `apps/web/src/content/logo-with-context-menu.tsx` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ export function LogoWithContextMenu() {
             alt="openstatus logo"
             width={20}
             height={20}
-            className="border-border dark:border-foreground rounded-full border"
+            className="border-border dark:border-foreground rounded-[50%] border"
           />
           <span className="hidden sm:block">openstatus</span>
           <div className="absolute right-0.5 bottom-0 hidden group-hover:block">
```

---

### Incident Patch 3: `dd838b4f` (2026-09-27)
**Commit Message**: fix(dashboard): prevent self-deletion in workspace members table (#2777)

**File**: `apps/dashboard/src/components/data-table/settings/members/data-table.tsx` (modified, +45/-31)
```diff
@@ -1,3 +1,4 @@
+import { Badge } from "@openstatus/ui/components/ui/badge";
 import {
   Table,
   TableBody,
@@ -15,6 +16,7 @@ import { useTRPC } from "@/lib/trpc/client";
 export function DataTable() {
   const trpc = useTRPC();
   const { data: members, refetch } = useQuery(trpc.member.list.queryOptions());
+  const { data: user } = useQuery(trpc.user.get.queryOptions());
   const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
   const deleteMemberMutation = useMutation(
     trpc.member.delete.mutationOptions({
@@ -38,37 +40,49 @@ export function DataTable() {
         </TableRow>
       </TableHeader>
       <TableBody>
-        {members.map((item) => (
-          <TableRow key={item.user.id}>
-            <TableCell>
-              {item.user.name ?? (
-                <span className="text-muted-foreground">-</span>
-              )}
-            </TableCell>
-            <TableCell>{item.user.email}</TableCell>
-            <TableCell>{item.role}</TableCell>
-            <TableCell>
-              {formatDate(item.user.createdAt ?? item.createdAt)}
-            </TableCell>
-            <TableCell>
-              <div className="flex justify-end">
-                <QuickActions
-                  deleteAction={{
-                    confirmationValue: item.user.email ?? "user",
-                    description: workspace?.ssoEnabled
-                      ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
-                      : undefined,
-                    // FIXME: when deleting myself, throws an error, should have been caught by the toast.error
-                    submitAction: async () =>
-                      await deleteMemberMutation.mutateAsync({
-                        id: item.user.id,
-                      }),
-                  }}
-                />
-              </div>
-            </TableCell>
-          </TableRow>
-        ))}
+        {members.map((item) => {
+          const currentUserId = user?.id;
+          const isMe = Boolean(currentUserId && item.user.id === currentUserId);
+          const canDelete = Boolean(
+            currentUserId && item.user.id !== currentUserId,
+          );
+
+          return (
+            <TableRow key={item.user.id}>
+              <TableCell>
+                <div className="flex items-center gap-2">
+                  {item.user.name ?? (
+                    <span className="text-muted-foreground">-</span>
+                  )}
+                  {isMe ? <Badge variant="secondary">You</Badge> : null}
+                </div>
+              </TableCell>
+              <TableCell>{item.user.email}</TableCell>
+              <TableCell>{item.role}</TableCell>
+              <TableCell>
+                {formatDate(item.user.createdAt ?? item.createdAt)}
+              </TableCell>
+              <TableCell>
+                {canDelete ? (
+                  <div className="flex justify-end">
+                    <QuickActions
+                      deleteAction={{
+                        confirmationValue: item.user.email ?? "user",
+                        description: workspace?.ssoEnabled
+                          ? "This workspace uses SSO. They can sign in again and rejoin automatically unless you also remove them from your identity provider."
+                          : undefined,
+                        submitAction: async () =>
+                          await deleteMemberMutation.mutateAsync({
+                            id: item.user.id,
+                          }),
+                      }}
+                    />
+                  </div>
+                ) : null}
+              </TableCell>
+            </TableRow>
+          );
+        })}
       </TableBody>
     </Table>
   );
```

---

### Incident Patch 4: `b25a9967` (2026-09-25)
**Commit Message**: fix(auth): preserve redirectTo in magic link invitation flow (#822) (#2749)

* fix(auth): preserve redirectTo in magic link invitation flow (#822)

* feat(dashboard): redesign invite page with FormCard

* refactor: sanitize redirect to

---------

Co-authored-by: Maximilian Kaske <maximilian@kaske.org>

**File**: `apps/dashboard/src/app/(dashboard)/invite/client.tsx` (modified, +103/-36)
```diff
@@ -7,13 +7,29 @@ import { useQueryStates } from "nuqs";
 import { useTransition } from "react";
 import { toast } from "sonner";
 
+import { Link } from "@/components/common/link";
+import {
+  EmptyStateContainer,
+  EmptyStateDescription,
+  EmptyStateTitle,
+} from "@/components/content/empty-state";
 import {
   Section,
   SectionDescription,
   SectionGroup,
   SectionHeader,
   SectionTitle,
 } from "@/components/content/section";
+import {
+  FormCard,
+  FormCardContent,
+  FormCardDescription,
+  FormCardFooter,
+  FormCardFooterInfo,
+  FormCardHeader,
+  FormCardTitle,
+} from "@/components/forms/form-card";
+import { formatDate } from "@/lib/formatter";
 import { useTRPC } from "@/lib/trpc/client";
 import { switchWorkspace } from "@/lib/workspace-cookie";
 
@@ -42,11 +58,20 @@ export function Client() {
       <SectionGroup>
         <Section>
           <SectionHeader>
-            <SectionTitle className="text-destructive">Error</SectionTitle>
-            <SectionDescription className="font-mono">
-              {error.message}
+            <SectionTitle>Invitation</SectionTitle>
+            <SectionDescription>
+              This invitation can&apos;t be opened.
             </SectionDescription>
           </SectionHeader>
+          <EmptyStateContainer className="py-8">
+            <EmptyStateTitle>Invitation unavailable</EmptyStateTitle>
+            <EmptyStateDescription className="font-mono">
+              {error.message}
+            </EmptyStateDescription>
+            <Button size="sm" variant="outline" className="mt-2" asChild>
+              <Link href="/overview">Back to overview</Link>
+            </Button>
+          </EmptyStateContainer>
         </Section>
       </SectionGroup>
     );
@@ -55,48 +80,90 @@ export function Client() {
   if (!invitation) return null;
   if (invitation.acceptedAt) return null;
 
+  const { workspace } = invitation;
+
   return (
     <SectionGroup>
       <Section>
         <SectionHeader>
           <SectionTitle>Invitation</SectionTitle>
           <SectionDescription>
-            You&apos;ve been invited to join the workspace{" "}
-            {invitation.workspace.name ? (
-              <span className="font-semibold">{invitation.workspace.name}</span>
-            ) : (
-              <span className="font-mono">{invitation.workspace.slug}</span>
-            )}
-            .
+            Accepting switches you into the workspace. You can switch back
+            anytime from the sidebar.
           </SectionDescription>
         </SectionHeader>
-        <Button
-          size="sm"
-          onClick={() => {
-            startTransition(async () => {
-              try {
-                const promise = acceptInvitationMutation.mutateAsync({
-                  id: invitation.id,
-                });
-                toast.promise(promise, {
-                  loading: "Accepting invitation...",
-                  success: "Invitation accepted",
-                  error: (error) => {
-                    if (isTRPCClientError(error)) {
-                      return error.message;
-                    }
-                    return "Failed to accept invitation";
-                  },
+        <FormCard>
+          <FormCardHeader>
+            <FormCardTitle>Join workspace</FormCardTitle>
+            <FormCardDescription>
+              You were invited as{" "}
+              <span className="text-foreground font-mono">
+                {invitation.role}
+              </span>{" "}
+              via{" "}
+              <span className="text-foreground font-mono">
+                {invitation.email}
+              </span>
+              .
+            </FormCardDescription>
+          </FormCardHeader>
+          <FormCardContent>
+            <div className="flex items-center gap-3">
+              <div className="size-8 shrink-0 overflow-hidden rounded-lg">
+                <img
+                  src={`https://api.dicebear.com/9.x/glass/svg?s
```

**File**: `apps/dashboard/src/app/login/_components/actions.ts` (modified, +13/-5)
```diff
@@ -7,9 +7,20 @@ import { signIn } from "@/lib/auth";
 import { ssoLookupRateLimit } from "@/lib/rate-limit/sso-lookup";
 import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";
 
+// Same-origin paths only; the Auth.js `redirect` callback is the second line
+// of defense, not the first.
+function sanitizeRedirectTo(raw: FormDataEntryValue | null) {
+  const value = String(raw ?? "");
+  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
+}
+
 export async function signInWithResendAction(formData: FormData) {
   try {
-    await signIn("resend", formData);
+    // next-auth lifts `redirectTo` into the magic link's `callbackUrl` itself.
+    await signIn("resend", {
+      email: String(formData.get("email") ?? ""),
+      redirectTo: sanitizeRedirectTo(formData.get("redirectTo")),
+    });
   } catch (e) {
     console.error(e);
   }
@@ -28,11 +39,8 @@ export async function startSsoSignIn(
   formData: FormData,
 ): Promise<SsoFormState> {
   const email = String(formData.get("email") ?? "");
-  const redirectToRaw = String(formData.get("redirectTo") ?? "");
   const redirectTo =
-    redirectToRaw.startsWith("/") && !redirectToRaw.startsWith("//")
-      ? redirectToRaw
-      : "/overview";
+    sanitizeRedirectTo(formData.get("redirectTo")) ?? "/overview";
 
   if (!email.includes("@")) return { error: GENERIC_ERROR };
 
```

**File**: `apps/dashboard/src/app/login/_components/magic-link-form.tsx` (modified, +8/-1)
```diff
@@ -8,10 +8,14 @@ import { toast } from "sonner";
 import { signInWithResendAction } from "./actions";
 import { LoginButton } from "./login-button";
 
+interface MagicLinkFormProps {
+  redirectTo?: string;
+}
+
 /**
  * @deprecated - only to be used in development mode
  */
-export default function MagicLinkForm() {
+export function MagicLinkForm({ redirectTo }: MagicLinkFormProps) {
   const { pending } = useFormStatus();
 
   return (
@@ -27,6 +31,9 @@ export default function MagicLinkForm() {
       }}
       className="grid gap-2"
     >
+      {redirectTo ? (
+        <input type="hidden" name="redirectTo" value={redirectTo} />
+      ) : null}
       <div className="grid gap-1.5">
         <Label htmlFor="email">Email</Label>
         <Input id="email" name="email" type="email" required />
```

**File**: `apps/dashboard/src/app/login/page.tsx` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ import type { SearchParams } from "nuqs/server";
 import { signIn } from "@/lib/auth";
 
 import { LoginButton } from "./_components/login-button";
-import MagicLinkForm from "./_components/magic-link-form";
+import { MagicLinkForm } from "./_components/magic-link-form";
 import { SsoForm } from "./_components/sso-form";
 import { searchParamsCache } from "./search-params";
 
@@ -53,7 +53,7 @@ export default async function Page(props: {
         {process.env.NODE_ENV === "development" ||
         process.env.SELF_HOST === "true" ? (
           <div className="grid gap-4">
-            <MagicLinkForm />
+            <MagicLinkForm redirectTo={redirectTo ?? undefined} />
             <Separator />
           </div>
         ) : null}
```

**File**: `packages/api/src/router/email/index.ts` (modified, +5/-0)
```diff
@@ -134,11 +134,16 @@ export const emailRouter = createTRPCRouter({
 
         if (!_invitation) return;
 
+        const baseUrl = opts.ctx.req?.nextUrl?.origin
+          ? `${opts.ctx.req.nextUrl.origin}/invite`
+          : undefined;
+
         await emailClient.sendTeamInvitation({
           to: _invitation.email,
           token: _invitation.token,
           invitedBy: `${opts.ctx.user.email}`,
           workspaceName: opts.ctx.workspace.name || "openstatus",
+          baseUrl,
         });
       }
     }),
```

---

### Incident Patch 5: `47d76edd` (2026-09-24)
**Commit Message**: fix(status-page): keep global-error free of layout providers (#2768)

global-error renders in place of the root layout, so NuqsAdapter is not
mounted above it. The shared Link component calls useEmbed -> useQueryState,
which threw "[nuqs] nuqs requires an adapter" while rendering the fallback.
That crash unmounted the tree (blank page) and ran before the useEffect that
reports the original error to Sentry, so the real failure was never captured.

Use plain anchors in the fallback so it cannot depend on anything from the
layout it replaces.

Fixes OPENSTATUS-FRONTEND-VM
Fixes OPENSTATUS-FRONTEND-K3
Fixes OPENSTATUS-FRONTEND-GZ


Claude-Session: https://claude.ai/code/session_01E5kXCLpeMzYvrHCmNYSzQh

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `apps/status-page/src/app/global-error.tsx` (modified, +10/-5)
```diff
@@ -4,8 +4,8 @@ import { Button } from "@openstatus/ui/components/ui/button";
 import * as Sentry from "@sentry/nextjs";
 import { useEffect } from "react";
 
-import { Link } from "../components/common/link";
-
+// Rendered in place of the root layout, so nothing from it (NuqsAdapter, tRPC,
+// theme) exists here — plain anchors only, or this page throws too.
 export default function GlobalError({
   error,
   reset,
@@ -31,8 +31,13 @@ export default function GlobalError({
                   <p className="text-muted-foreground text-sm sm:text-base">
                     An unexpected error occurred. This has been reported and
                     we&apos;re working on it.{" "}
-                    <Link href="mailto:ping@openstatus.dev">Contact us</Link> if
-                    it persists.
+                    <a
+                      href="mailto:ping@openstatus.dev"
+                      className="text-foreground font-medium"
+                    >
+                      Contact us
+                    </a>{" "}
+                    if it persists.
                   </p>
                 </div>
                 <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
@@ -45,7 +50,7 @@ export default function GlobalError({
                     Try Again
                   </Button>
                   <Button size="lg" asChild>
-                    <Link href="/">Go Home</Link>
+                    <a href="/">Go Home</a>
                   </Button>
                 </div>
               </div>
```

---

### Incident Patch 6: `c351d75a` (2026-09-24)
**Commit Message**: fix: claude md polylane comment (#2765)

**File**: `CLAUDE.md` (modified, +1/-11)
```diff
@@ -1,14 +1,4 @@
 # CLAUDE.md
 
 Read `AGENTS.md` in this directory — it holds the conventions for this repo, and
-the nested `AGENTS.md` files it links carry the package-specific ones.
-
-<!-- polylane:start -->
-## Investigating production with Polylane
-
-[Polylane](https://polylane.com/?ref=github.onboarding-pr) is an AI production engineer: it watches deploys, telemetry, incidents, and the infrastructure this repository ships to, investigates problems as they happen, and proposes fixes as pull requests. It is connected to this repository and available to coding agents through the [Polylane MCP server](https://mcp.polylane.com/mcp).
-
-- When a question involves production behaviour (an error, a spike, a deploy, a missing signal), query Polylane through its MCP tools before reasoning from the code alone.
-- When debugging a failure, start from the incident or issue Polylane recorded: it carries the evidence an investigation already gathered.
-- Polylane reviews pull requests in this repository against the live infrastructure. Read its review comment before merging changes that touch production paths.
-<!-- polylane:end -->
+the nested `AGENTS.md` files it links carry the package-specific ones.
\ No newline at end of file
```

---

### Incident Patch 7: `fa5fa259` (2026-09-24)
**Commit Message**: fix(status-page): restore translations for non-english locales (#2762)

* fix(status-page): restore translations for non-english locales

next-intl 4.14 switched extracted message ids from base64 to base64url,
so every id containing "+" or "/" stopped resolving. The banner text,
"Get updates" button and 18 other strings rendered empty in all locales
except English. Rename the affected keys in the message catalogs.

* test(status-page): guard message catalogs against extractor id drift

Assert every source id equals next-intl's hash of its text and every
locale carries the same id set, so a change in the extractor's id format
fails CI instead of silently blanking translations.

* fix: build

**File**: `apps/status-page/messages/de.json` (modified, +22/-22)
```diff
@@ -11,18 +11,19 @@
   "DwevKz": "Bei der Anmeldung ist ein unerwarteter Fehler aufgetreten",
   "xOqgA3": "Zugriff eingeschränkt",
   "U2RCyj": "Diese Statusseite ist nur über bestimmte IPv4-Netzwerke erreichbar. Wenden Sie sich an Ihren Netzwerkadministrator, um Zugriff zu erhalten.",
+  "dcqxLR": "letzter Tag",
   "Ppx673": "Berichte",
   "JCMXwP": "Wartungen",
   "I7B7SH": "Keine Wartungen gefunden",
   "OSI607": "Keine Wartungen für diese Statusseite gefunden.",
-  "a9S/OH": "Wartung nicht gefunden",
+  "a9S_OH": "Wartung nicht gefunden",
   "HSv9BP": "Die gesuchte Wartung existiert nicht.",
-  "VL1Y/1": "Bericht nicht gefunden",
+  "VL1Y_1": "Bericht nicht gefunden",
   "Ew1f8q": "Der gesuchte Bericht existiert nicht.",
   "wkVkCX": "Erfolgreich abgemeldet",
   "9qFG9F": "Abmeldung fehlgeschlagen",
   "PV34S9": "Ungültiger Abonnement-Token",
-  "ar0fZ/": "Dieser Abonnement-Token ist nicht mehr gültig. Möglicherweise haben Sie sich bereits abgemeldet oder der Link ist abgelaufen.",
+  "ar0fZ_": "Dieser Abonnement-Token ist nicht mehr gültig. Möglicherweise haben Sie sich bereits abgemeldet oder der Link ist abgelaufen.",
   "orvpWh": "Zurück",
   "K8kTfz": "Verwalten Sie Ihr Abonnement, um Updates zur Statusseite zu erhalten.",
   "3JgeEq": "Abgemeldet am {date}",
@@ -35,17 +36,17 @@
   "BRGcS0": "Globale Latenz",
   "9vqdq3": "Regionale Latenz",
   "fFOayY": "Regionen",
-  "u81G9+": "Verfügbarkeit",
+  "u81G9-": "Verfügbarkeit",
   "i2FBWn": "Prüfungen",
   "G5Lt80": "Die aggregierte Latenz aller aktiven Regionen basierend auf verschiedenen Quantilen.",
   "YV7rXP": "Latenz nach Region",
   "6zzIEm": "Regionale Latenz pro p75-Quantil, sortiert nach langsamster Region. Vergleichen Sie bis zu 6 Regionen.",
   "6pCzRs": "Gesamtverfügbarkeit",
-  "zL23+z": "Hauptwerte der Verfügbarkeit, transparent dargestellt.",
+  "zL23-z": "Hauptwerte der Verfügbarkeit, transparent dargestellt.",
   "gjBiyj": "Wird geladen...",
-  "/72cxa": "Ungültiger oder abgelaufener Link",
+  "_72cxa": "Ungültiger oder abgelaufener Link",
   "R10mIw": "Dieser Abmelde-Link ist nicht mehr gültig. Möglicherweise haben Sie sich bereits abgemeldet.",
-  "yFi/8F": "Erfolgreich abgemeldet",
+  "yFi_8F": "Erfolgreich abgemeldet",
   "CmelO7": "Sie erhalten keine E-Mail-Benachrichtigungen mehr von {pageName}.",
   "JqiqNj": "Etwas ist schiefgelaufen",
   "TnvU0H": "Bitte versuchen Sie es erneut oder kontaktieren Sie den Support, wenn das Problem weiterhin besteht.",
@@ -64,32 +65,32 @@
   "mOFG3K": "Start",
   "3JVa6k": "Ende",
   "79eRW1": "Bestätigung läuft...",
-  "dX7+Rv": "Bestätigt",
+  "dX7-Rv": "Bestätigt",
   "m0fapd": "Bestätigung fehlgeschlagen",
-  "sy+pv5": "E-Mail",
+  "sy-pv5": "E-Mail",
   "9Utk00": "Abonnement wird aktualisiert...",
   "Eq5gCU": "Abonnement aktualisiert",
-  "qp+wDV": "Aktualisierung des Abonnements fehlgeschlagen",
-  "d/jCcy": "Bestimmte Komponenten abonnieren",
+  "qp-wDV": "Aktualisierung des Abonnements fehlgeschlagen",
+  "d_jCcy": "Bestimmte Komponenten abonnieren",
   "FlVuUh": "Keine Komponenten zum Abonnieren",
   "8aUjqQ": "Diese Statusseite hat keine Komponenten zum Abonnieren.",
   "5sg7KC": "Passwort",
   "IGY48m": "Wird abonniert...",
   "Pgb3Xj": "Abonniert",
   "WOH7Yj": "Abonnement fehlgeschlagen",
-  "L7z2/k": "Diese Seite hat keine Komponenten zum Abonnieren.",
-  "BQBZU+": "Alle Systeme betriebsbereit",
+  "L7z2_k": "Diese Seite hat keine Komponenten zum Abonnieren.",
+  "BQBZU-": "Alle Systeme betriebsbereit",
   "Dnob31": "Betriebsbereit",
   "b9fOA1": "Eingeschränkte Leistung",
   "VQDmmK": "Eingeschränkt",
   "80EXUh": "Ausfall",
   "JOZGPR": "Ausfall",
-  "dudqv/": "Wartung",
+  "dudqv_": "Wartung",
   "D3rOMr": "Keine Daten",
   "W6nSYE": "Gelöst",
   "1P6GMj": "Überwachung",
   "7cv4Uf": "Identifiziert",
-  "/GKH/w": "Wird untersucht",
+  "_GKH_w": "Wird untersucht",
   "myq2ZL": "Normal",
   "KN7zKn": "Fehler",
   "SsC4IV": "Eingeschränkte Leistung",
@@ -100,17 +101,17 @@
   "2syGZB": "Bericht gelö
```

**File**: `apps/status-page/messages/en.json` (modified, +22/-22)
```diff
@@ -11,18 +11,19 @@
   "DwevKz": "An unexpected error occurred during sign in",
   "xOqgA3": "Access Restricted",
   "U2RCyj": "This status page is only accessible from specific IPv4 networks. Reach out to your network administrator to get access.",
+  "dcqxLR": "last day",
   "Ppx673": "Reports",
   "JCMXwP": "Maintenances",
   "I7B7SH": "No maintenances found",
   "OSI607": "No maintenances found for this status page.",
-  "a9S/OH": "Maintenance not found",
+  "a9S_OH": "Maintenance not found",
   "HSv9BP": "The maintenance you are looking for does not exist.",
-  "VL1Y/1": "Report not found",
+  "VL1Y_1": "Report not found",
   "Ew1f8q": "The report you are looking for does not exist.",
   "wkVkCX": "Unsubscribed successfully",
   "9qFG9F": "Failed to unsubscribe",
   "PV34S9": "Invalid subscription token",
-  "ar0fZ/": "This subscription token is no longer valid. You may have already unsubscribed or the link has expired.",
+  "ar0fZ_": "This subscription token is no longer valid. You may have already unsubscribed or the link has expired.",
   "orvpWh": "Go back",
   "K8kTfz": "Manage your subscription to receive updates on the status page.",
   "3JgeEq": "Unsubscribed on {date}",
@@ -35,17 +36,17 @@
   "BRGcS0": "Global Latency",
   "9vqdq3": "Region Latency",
   "fFOayY": "regions",
-  "u81G9+": "Uptime",
+  "u81G9-": "Uptime",
   "i2FBWn": "checks",
   "G5Lt80": "The aggregated latency from all active regions based on different quantiles.",
   "YV7rXP": "Latency by Region",
   "6zzIEm": "Region latency per p75 quantile, sorted by slowest region. Compare up to 6 regions.",
   "6pCzRs": "Total Uptime",
-  "zL23+z": "Main values of uptime and availability, transparent.",
+  "zL23-z": "Main values of uptime and availability, transparent.",
   "gjBiyj": "Loading...",
-  "/72cxa": "Invalid or expired link",
+  "_72cxa": "Invalid or expired link",
   "R10mIw": "This unsubscribe link is no longer valid. You may have already unsubscribed.",
-  "yFi/8F": "Successfully unsubscribed",
+  "yFi_8F": "Successfully unsubscribed",
   "CmelO7": "You will no longer receive email notifications from {pageName}.",
   "JqiqNj": "Something went wrong",
   "TnvU0H": "Please try again or contact support if the issue persists.",
@@ -64,32 +65,32 @@
   "mOFG3K": "Start",
   "3JVa6k": "End",
   "79eRW1": "Confirming...",
-  "dX7+Rv": "Confirmed",
+  "dX7-Rv": "Confirmed",
   "m0fapd": "Failed to confirm",
-  "sy+pv5": "Email",
+  "sy-pv5": "Email",
   "9Utk00": "Updating subscription...",
   "Eq5gCU": "Subscription updated",
-  "qp+wDV": "Failed to update subscription",
-  "d/jCcy": "Subscribe to specific components",
+  "qp-wDV": "Failed to update subscription",
+  "d_jCcy": "Subscribe to specific components",
   "FlVuUh": "No components to subscribe to",
   "8aUjqQ": "This status page has no components to subscribe to.",
   "5sg7KC": "Password",
   "IGY48m": "Subscribing...",
   "Pgb3Xj": "Subscribed",
   "WOH7Yj": "Failed to subscribe",
-  "L7z2/k": "This page has no components to subscribe to.",
-  "BQBZU+": "All Systems Operational",
+  "L7z2_k": "This page has no components to subscribe to.",
+  "BQBZU-": "All Systems Operational",
   "Dnob31": "Operational",
   "b9fOA1": "Degraded Performance",
   "VQDmmK": "Degraded",
   "80EXUh": "Downtime Performance",
   "JOZGPR": "Downtime",
-  "dudqv/": "Maintenance",
+  "dudqv_": "Maintenance",
   "D3rOMr": "No Data",
   "W6nSYE": "Resolved",
   "1P6GMj": "Monitoring",
   "7cv4Uf": "Identified",
-  "/GKH/w": "Investigating",
+  "_GKH_w": "Investigating",
   "myq2ZL": "Normal",
   "KN7zKn": "Error",
   "SsC4IV": "Degraded performance",
@@ -100,17 +101,17 @@
   "2syGZB": "Report resolved",
   "FDReLp": "No recent notifications",
   "qDj0JR": "There have been no reports within the last 7 days.",
-  "u++vY3": "No reports found",
+  "u--vY3": "No reports found",
   "2HGztY": "No reports found for this status page.",
   "50SA6J": "No public monitors",
   "FHrzf5": "No public monitors have been added to this 
```

**File**: `apps/status-page/messages/fr.json` (modified, +22/-22)
```diff
@@ -11,18 +11,19 @@
   "DwevKz": "Une erreur inattendue s'est produite lors de la connexion",
   "xOqgA3": "Accès restreint",
   "U2RCyj": "Cette page de statut n'est accessible que depuis des réseaux IPv4 spécifiques. Contactez votre administrateur réseau pour obtenir l'accès.",
+  "dcqxLR": "dernier jour",
   "Ppx673": "Rapports",
   "JCMXwP": "Maintenances",
   "I7B7SH": "Aucune maintenance trouvée",
   "OSI607": "Aucune maintenance trouvée pour cette page de statut.",
-  "a9S/OH": "Maintenance introuvable",
+  "a9S_OH": "Maintenance introuvable",
   "HSv9BP": "La maintenance que vous recherchez n'existe pas.",
-  "VL1Y/1": "Rapport introuvable",
+  "VL1Y_1": "Rapport introuvable",
   "Ew1f8q": "Le rapport que vous recherchez n'existe pas.",
   "wkVkCX": "Désabonnement réussi",
   "9qFG9F": "Échec du désabonnement",
   "PV34S9": "Jeton d'abonnement invalide",
-  "ar0fZ/": "Ce jeton d'abonnement n'est plus valide. Vous vous êtes peut-être déjà désabonné ou le lien a expiré.",
+  "ar0fZ_": "Ce jeton d'abonnement n'est plus valide. Vous vous êtes peut-être déjà désabonné ou le lien a expiré.",
   "orvpWh": "Retour",
   "K8kTfz": "Gérez votre abonnement pour recevoir les mises à jour de la page de statut.",
   "3JgeEq": "Désabonné le {date}",
@@ -35,17 +36,17 @@
   "BRGcS0": "Latence globale",
   "9vqdq3": "Latence par région",
   "fFOayY": "régions",
-  "u81G9+": "Disponibilité",
+  "u81G9-": "Disponibilité",
   "i2FBWn": "vérifications",
   "G5Lt80": "La latence agrégée de toutes les régions actives basée sur différents quantiles.",
   "YV7rXP": "Latence par région",
   "6zzIEm": "Latence par région au quantile p75, triée par région la plus lente. Comparez jusqu'à 6 régions.",
   "6pCzRs": "Disponibilité totale",
-  "zL23+z": "Valeurs principales de disponibilité, en toute transparence.",
+  "zL23-z": "Valeurs principales de disponibilité, en toute transparence.",
   "gjBiyj": "Chargement...",
-  "/72cxa": "Lien invalide ou expiré",
+  "_72cxa": "Lien invalide ou expiré",
   "R10mIw": "Ce lien de désabonnement n'est plus valide. Vous vous êtes peut-être déjà désabonné.",
-  "yFi/8F": "Désabonnement réussi",
+  "yFi_8F": "Désabonnement réussi",
   "CmelO7": "Vous ne recevrez plus de notifications par email de {pageName}.",
   "JqiqNj": "Une erreur est survenue",
   "TnvU0H": "Veuillez réessayer ou contacter le support si le problème persiste.",
@@ -64,32 +65,32 @@
   "mOFG3K": "Début",
   "3JVa6k": "Fin",
   "79eRW1": "Confirmation en cours...",
-  "dX7+Rv": "Confirmé",
+  "dX7-Rv": "Confirmé",
   "m0fapd": "Échec de la confirmation",
-  "sy+pv5": "Email",
+  "sy-pv5": "Email",
   "9Utk00": "Mise à jour de l'abonnement...",
   "Eq5gCU": "Abonnement mis à jour",
-  "qp+wDV": "Échec de la mise à jour de l'abonnement",
-  "d/jCcy": "S'abonner à des composants spécifiques",
+  "qp-wDV": "Échec de la mise à jour de l'abonnement",
+  "d_jCcy": "S'abonner à des composants spécifiques",
   "FlVuUh": "Aucun composant auquel s'abonner",
   "8aUjqQ": "Cette page de statut n'a aucun composant auquel s'abonner.",
   "5sg7KC": "Mot de passe",
   "IGY48m": "Abonnement en cours...",
   "Pgb3Xj": "Abonné",
   "WOH7Yj": "Échec de l'abonnement",
-  "L7z2/k": "Cette page n'a aucun composant auquel s'abonner.",
-  "BQBZU+": "Tous les systèmes sont opérationnels",
+  "L7z2_k": "Cette page n'a aucun composant auquel s'abonner.",
+  "BQBZU-": "Tous les systèmes sont opérationnels",
   "Dnob31": "Opérationnel",
   "b9fOA1": "Performances dégradées",
   "VQDmmK": "Dégradé",
   "80EXUh": "Performances en panne",
   "JOZGPR": "En panne",
-  "dudqv/": "Maintenance",
+  "dudqv_": "Maintenance",
   "D3rOMr": "Aucune donnée",
   "W6nSYE": "Résolu",
   "1P6GMj": "Surveillance",
   "7cv4Uf": "Identifié",
-  "/GKH/w": "En cours d'investigation",
+  "_GKH_w": "En cours d'investigation",
   "myq2ZL": "Normal",
   "KN7zKn": "Erreur",
   "SsC4IV": "Performances dégradées",
@@ -100,17 +101,17 @@
   "2syGZB": "Rapport résolu",
   "FDReLp": "Aucune notification récent
```

**File**: `apps/status-page/messages/hi.json` (modified, +22/-22)
```diff
@@ -11,18 +11,19 @@
   "DwevKz": "साइन इन के दौरान अनपेक्षित त्रुटि हुई",
   "xOqgA3": "प्रवेश प्रतिबंधित",
   "U2RCyj": "यह स्थिति पृष्ठ केवल विशिष्ट IPv4 नेटवर्क से सुलभ है। प्रवेश प्राप्त करने के लिए अपने नेटवर्क प्रशासक से संपर्क करें।",
+  "dcqxLR": "पिछला दिन",
   "Ppx673": "रिपोर्ट",
   "JCMXwP": "रखरखाव",
   "I7B7SH": "कोई रखरखाव नहीं मिला",
   "OSI607": "इस स्थिति पृष्ठ के लिए कोई रखरखाव नहीं मिला।",
-  "a9S/OH": "रखरखाव नहीं मिला",
+  "a9S_OH": "रखरखाव नहीं मिला",
   "HSv9BP": "आप जिस रखरखाव की तलाश कर रहे हैं वह मौजूद नहीं है।",
-  "VL1Y/1": "रिपोर्ट नहीं मिली",
+  "VL1Y_1": "रिपोर्ट नहीं मिली",
   "Ew1f8q": "आप जिस रिपोर्ट की तलाश कर रहे हैं वह मौजूद नहीं है।",
   "wkVkCX": "सफलतापूर्वक अनसब्सक्राइब किया गया",
   "9qFG9F": "अनसब्सक्राइब करने में विफल",
   "PV34S9": "अमान्य सदस्यता टोकन",
-  "ar0fZ/": "यह सदस्यता टोकन अब वैध नहीं है। आप पहले से अनसब्सक्राइब हो सकते हैं या लिंक की समय सीमा समाप्त हो सकती है।",
+  "ar0fZ_": "यह सदस्यता टोकन अब वैध नहीं है। आप पहले से अनसब्सक्राइब हो सकते हैं या लिंक की समय सीमा समाप्त हो सकती है।",
   "orvpWh": "वापस जाएं",
   "K8kTfz": "स्थिति पृष्ठ पर अपडेट प्राप्त करने के लिए अपनी सदस्यता प्रबंधित करें।",
   "3JgeEq": "{date} को अनसब्सक्राइब किया गया",
@@ -35,17 +36,17 @@
   "BRGcS0": "वैश्विक विलंबता",
   "9vqdq3": "क्षेत्र विलंबता",
   "fFOayY": "क्षेत्र",
-  "u81G9+": "अपटाइम",
+  "u81G9-": "अपटाइम",
   "i2FBWn": "जांच",
   "G5Lt80": "विभिन्न क्वांटाइल के आधार पर सभी सक्रिय क्षेत्रों से एकत्रित विलंबता।",
   "YV7rXP": "क्षेत्र द्वारा विलंबता",
   "6zzIEm": "p75 क्वांटाइल के अनुसार क्षेत्र विलंबता, सबसे धीमे क्षेत्र द्वारा क्रमबद्ध। 6 क्षेत्रों तक की तुलना करें।",
   "6pCzRs": "कुल अपटाइम",
-  "zL23+z": "अपटाइम और उपलब्धता के मुख्य मूल्य, पारदर्शी।",
+  "zL23-z": "अपटाइम और उपलब्धता के मुख्य मूल्य, पारदर्शी।",
   "gjBiyj": "लोड हो रहा है...",
-  "/72cxa": "अमान्य या समाप्त लिंक",
+  "_72cxa": "अमान्य या समाप्त लिंक",
   "R10mIw": "यह अनसब्सक्राइब लिंक अब वैध नहीं है। आप पहले से अनसब्सक्राइब हो सकते हैं।",
-  "yFi/8F": "सफलतापूर्वक अनसब्सक्राइब किया गया",
+  "yFi_8F": "सफलतापूर्वक अनसब्सक्राइब किया गया",
   "CmelO7": "आप अब {pageName} से ईमेल सूचनाएं प्राप्त नहीं करेंगे।",
   "JqiqNj": "कुछ गलत हुआ",
   "TnvU0H": "कृपया पुनः प्रयास करें या यदि समस्या बनी रहे तो सहायता से संपर्क करें।",
@@ -64,32 +65,32 @@
   "mOFG3K": "शुरुआत",
   "3JVa6k": "अंत",
   "79eRW1": "पुष्टि की जा रही है...",
-  "dX7+Rv": "पुष्टि हुई",
+  "dX7-Rv": "पुष्टि हुई",
   "m0fapd": "पुष्टि करने में विफल",
-  "sy+pv5": "ईमेल",
+  "sy-pv5": "ईमेल",
   "9Utk00": "सदस्यता अपडेट की जा रही है...",
   "Eq5gCU": "सदस्यता अपडेट की गई",
-  "qp+wDV": "सदस्यता अपडेट करने में विफल",
-  "d/jCcy": "विशिष्ट घटकों की सदस्यता लें",
+  "qp-wDV": "सदस्यता अपडेट करने में विफल",
+  "d_jCcy": "विशिष्ट घटकों की सदस्यता लें",
   "FlVuUh": "कोई घटक सदस्यता के लिए नहीं",
   "8aUjqQ": "इस स्थिति पृष्ठ में कोई घटक सदस्यता के लिए नहीं है।",
   "5sg7KC": "पासवर्ड",
   "IGY48m": "सदस्यता की जा रही है...",
   "Pgb3Xj": "सदस्यता ली गई",
   "WOH7Yj": "सदस्यता लेने में विफल",
-  "L7z2/k": "इस पृष्ठ में कोई घटक सदस्यता के लिए नहीं है।",
-  "BQBZU+": "सभी सिस्टम कार्यरत",
+  "L7z2_k": "इस पृष्ठ में कोई घटक सदस्यता के लिए नहीं है।",
+  "BQBZU-": "सभी सिस्टम कार्यरत",
   "Dnob31": "कार्यरत",
   "b9fOA1": "खराब प्रदर्शन",
   "VQDmmK": "खराब",
   "80EXUh": "डाउनटाइम प्रदर्शन",
   "JOZGPR": "डाउनटाइम",
-  "dudqv/": "अनुरक्षण",
+  "dudqv_": "अनुरक्षण",
   "D3rOMr": "डेटा नहीं",
   "W6nSYE": "हल किया",
   "1P6GMj": "निगरानी",
   "7cv4Uf": "पहचाना गया",
-  "/GKH/w": "जांच",
+  "_GKH_w": "जांच",
   "myq2ZL": "सामान्य",
   "KN7zKn": "त्रुटि",
   "SsC4IV": "खराब प्रदर्शन",
@@ -100,17 +101,17 @@
   "2syGZB": "रिपोर्ट समाधान किया गया",
   "FDReLp": "कोई हाल की सूचनाएं नहीं",
   "qDj0JR": "पिछले 7 दिनों में कोई रिपोर्ट नहीं।",
-  "u++vY3": "कोई रिपोर्ट नहीं मिली",
+  "u--vY3": "कोई रिपोर्ट नहीं मिली",
   "2HGztY": "इस स्थिति पृष्ठ के लिए कोई रिपोर्ट नहीं मिली।",
   "50SA6J": "कोई सार्वजनिक मॉनिटर नहीं",
   "FHrzf5": "इस पृष्ठ पर कोई सार्वजनिक मॉनिटर जोड़े गए नही
```

**File**: `apps/status-page/messages/ja.json` (modified, +22/-22)
```diff
@@ -11,18 +11,19 @@
   "DwevKz": "サインイン中に予期しないエラーが発生しました",
   "xOqgA3": "アクセス制限",
   "U2RCyj": "このステータスページは特定の IPv4 ネットワークからのみアクセスできます。アクセス権については、ネットワーク管理者にお問い合わせください。",
+  "dcqxLR": "過去 1 日",
   "Ppx673": "レポート",
   "JCMXwP": "メンテナンス",
   "I7B7SH": "メンテナンスはありません",
   "OSI607": "このステータスページにはメンテナンスがありません。",
-  "a9S/OH": "メンテナンスが見つかりません",
+  "a9S_OH": "メンテナンスが見つかりません",
   "HSv9BP": "お探しのメンテナンスは存在しません。",
-  "VL1Y/1": "レポートが見つかりません",
+  "VL1Y_1": "レポートが見つかりません",
   "Ew1f8q": "お探しのレポートは存在しません。",
   "wkVkCX": "登録を解除しました",
   "9qFG9F": "登録解除に失敗しました",
   "PV34S9": "無効な登録トークンです",
-  "ar0fZ/": "この登録トークンは無効です。すでに登録解除済みか、リンクの有効期限が切れている可能性があります。",
+  "ar0fZ_": "この登録トークンは無効です。すでに登録解除済みか、リンクの有効期限が切れている可能性があります。",
   "orvpWh": "戻る",
   "K8kTfz": "ステータスページの更新情報を受け取るための登録を管理します。",
   "3JgeEq": "{date}に登録解除しました",
@@ -35,17 +36,17 @@
   "BRGcS0": "グローバルレイテンシ",
   "9vqdq3": "リージョンレイテンシ",
   "fFOayY": "リージョン",
-  "u81G9+": "稼働率",
+  "u81G9-": "稼働率",
   "i2FBWn": "チェック",
   "G5Lt80": "すべてのアクティブなリージョンを集計した、パーセンタイル別のレイテンシです。",
   "YV7rXP": "リージョン別レイテンシ",
   "6zzIEm": "リージョンごとの p75 レイテンシを、遅いリージョンから順に表示します。最大 6 リージョンまで比較できます。",
   "6pCzRs": "合計稼働率",
-  "zL23+z": "稼働率と可用性の主要な値を、透明性をもって公開しています。",
+  "zL23-z": "稼働率と可用性の主要な値を、透明性をもって公開しています。",
   "gjBiyj": "読み込み中...",
-  "/72cxa": "無効または期限切れのリンクです",
+  "_72cxa": "無効または期限切れのリンクです",
   "R10mIw": "この登録解除リンクは無効です。すでに登録解除済みの可能性があります。",
-  "yFi/8F": "登録を解除しました",
+  "yFi_8F": "登録を解除しました",
   "CmelO7": "今後、{pageName}からのメール通知は届きません。",
   "JqiqNj": "問題が発生しました",
   "TnvU0H": "もう一度お試しください。問題が解決しない場合はサポートにお問い合わせください。",
@@ -64,32 +65,32 @@
   "mOFG3K": "開始",
   "3JVa6k": "終了",
   "79eRW1": "確認中...",
-  "dX7+Rv": "確認済み",
+  "dX7-Rv": "確認済み",
   "m0fapd": "確認に失敗しました",
-  "sy+pv5": "メールアドレス",
+  "sy-pv5": "メールアドレス",
   "9Utk00": "登録を更新中...",
   "Eq5gCU": "登録を更新しました",
-  "qp+wDV": "登録の更新に失敗しました",
-  "d/jCcy": "特定のコンポーネントを登録",
+  "qp-wDV": "登録の更新に失敗しました",
+  "d_jCcy": "特定のコンポーネントを登録",
   "FlVuUh": "登録できるコンポーネントがありません",
   "8aUjqQ": "このステータスページには登録できるコンポーネントがありません。",
   "5sg7KC": "パスワード",
   "IGY48m": "登録中...",
   "Pgb3Xj": "登録済み",
   "WOH7Yj": "登録に失敗しました",
-  "L7z2/k": "このページには登録できるコンポーネントがありません。",
-  "BQBZU+": "全システム正常稼働",
+  "L7z2_k": "このページには登録できるコンポーネントがありません。",
+  "BQBZU-": "全システム正常稼働",
   "Dnob31": "正常稼働",
   "b9fOA1": "性能低下",
   "VQDmmK": "性能低下",
   "80EXUh": "ダウンタイム",
   "JOZGPR": "ダウンタイム",
-  "dudqv/": "メンテナンス",
+  "dudqv_": "メンテナンス",
   "D3rOMr": "データなし",
   "W6nSYE": "解決済み",
   "1P6GMj": "経過観察",
   "7cv4Uf": "原因特定",
-  "/GKH/w": "調査中",
+  "_GKH_w": "調査中",
   "myq2ZL": "正常",
   "KN7zKn": "エラー",
   "SsC4IV": "性能低下",
@@ -100,17 +101,17 @@
   "2syGZB": "解決済みのレポート",
   "FDReLp": "最近の更新はありません",
   "qDj0JR": "過去 7 日間にレポートはありません。",
-  "u++vY3": "レポートはありません",
+  "u--vY3": "レポートはありません",
   "2HGztY": "このステータスページにはレポートがありません。",
   "50SA6J": "公開されたモニターはありません",
   "FHrzf5": "このページには公開されたモニターが追加されていません。",
   "3cc4Ct": "ライト",
   "tOdNiY": "ダーク",
-  "+CwN9C": "システム",
+  "-CwN9C": "システム",
   "EQpyb8": "テーマを切り替え",
-  "uPb/gh": "更新を受け取る",
+  "uPb_gh": "更新を受け取る",
   "8OoV56": "RSS フィードを取得",
-  "Auj/Ki": "Atom フィードを取得",
+  "Auj_Ki": "Atom フィードを取得",
   "SyYroX": "JSON で更新情報を取得",
   "rptmhC": "Slack でステータス更新を受け取るには、以下のテキストを任意のチャンネルに貼り付けてください。",
   "PSqtlY": "SSH でステータスを取得",
@@ -135,8 +136,7 @@
   "q0qMyV": "RSS",
   "9y9QQh": "JSON",
   "waUHa4": "SSH",
-  "cVqFq/": "レポートが作成または解決されたときにメール通知を受け取る",
+  "cVqFq_": "レポートが作成または解決されたときにメール通知を受け取る",
   "gczcC5": "登録",
-  "45YlLU": "メールアドレスを確認すれば、更新情報を受け取る準備は完了です。",
-  "dcqxLR": "過去 1 日"
+  "45YlLU": "メールアドレスを確認すれば、更新情報を受け取る準備は完了です。"
 }
```

---

### Incident Patch 8: `aa7ac8d7` (2026-09-23)
**Commit Message**: fix build (#2755)

**File**: `packages/api/package.json` (modified, +0/-1)
```diff
@@ -67,7 +67,6 @@
     "@std/testing": "jsr:^1.0.19",
     "@types/react": "catalog:",
     "@types/react-dom": "catalog:",
-    "bun-types": "catalog:",
     "typescript": "catalog:"
   }
 }
```

**File**: `packages/header-analysis/tsconfig.json` (modified, +1/-2)
```diff
@@ -2,7 +2,6 @@
   "extends": "@openstatus/tsconfig/base.json",
   "include": ["src", "*.ts"],
   "compilerOptions": {
-    "resolveJsonModule": true,
-    "types": ["bun"]
+    "resolveJsonModule": true
   }
 }
```

**File**: `packages/status-fetcher/__tests__/fetch.test.ts` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;
 
 const installMockFetch = (impl: FetchImpl) => {
   const fn = spy(impl);
-  global.fetch = fn as unknown as typeof fetch;
+  globalThis.fetch = fn as unknown as typeof fetch;
   return fn;
 };
 
```

**File**: `packages/status-fetcher/__tests__/fetchers/uptimerobot.test.ts` (modified, +2/-2)
```diff
@@ -70,15 +70,15 @@ function monitor(
 
 describe("UptimeRobotFetcher", () => {
   let fetcher: UptimeRobotFetcher;
-  const originalFetch = global.fetch;
+  const originalFetch = globalThis.fetch;
 
   beforeEach(() => {
     fetcher = new UptimeRobotFetcher();
     monitorIdCounter = 0;
   });
 
   afterEach(() => {
-    global.fetch = originalFetch;
+    globalThis.fetch = originalFetch;
   });
 
   describe("canHandle", () => {
```

**File**: `packages/status-fetcher/__tests__/helpers.ts` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;
 
 export const installMockFetch = (impl: FetchImpl) => {
   const fn = spy(impl);
-  global.fetch = fn as unknown as typeof fetch;
+  globalThis.fetch = fn as unknown as typeof fetch;
   return fn;
 };
 
```

---

### Incident Patch 9: `574998ae` (2026-09-23)
**Commit Message**: server: fix env (#2750)

**File**: `apps/server/fly.toml` (modified, +6/-0)
```diff
@@ -23,6 +23,9 @@ primary_region = "ams"
   min_machines_running = 1
   processes = ["app"]
 
+# Keep `soft_limit` < `API_MAX_IN_FLIGHT` (see `[env]`) <= `hard_limit`. If the
+# app's cap sits below `soft_limit` the two guards fight: the app sheds 503s
+# while Fly still reads the machine as having room and never starts a peer.
 [http_service.concurrency]
     type = "requests"
     hard_limit = 1000
@@ -41,6 +44,9 @@ primary_region = "ams"
 [env]
   NODE_ENV = "production"
   PORT = "3000"
+  # Backstop only. Fly stops routing here at `hard_limit`, so the in-flight
+  # guard should fire only once that has already failed to protect the machine.
+  API_MAX_IN_FLIGHT = "1000"
 
 
 # [checks]
```

**File**: `apps/server/src/libs/middlewares/limits.ts` (modified, +6/-0)
```diff
@@ -2,6 +2,12 @@ import { env } from "@/env";
 
 /** `skipValidation` hands back raw strings, so coerce; missing, non-numeric or zero values fall back. */
 export const limits = {
+  /**
+   * Conservative default for self-hosted single-container deploys. Fly
+   * production overrides it from `apps/server/fly.toml`, where it must stay
+   * above `soft_limit` and at most `hard_limit` so Fly scales out before the
+   * app starts shedding.
+   */
   maxInFlight: Number(env.API_MAX_IN_FLIGHT) || 128,
   perMinute: Number(env.API_RATE_LIMIT_PER_MINUTE) || 600,
   burstPer10s: Number(env.API_RATE_LIMIT_BURST_PER_10S) || 100,
```

**File**: `deno.lock` (modified, +1/-2)
```diff
@@ -112,8 +112,7 @@
         "packageJson": {
           "dependencies": [
             "npm:@jsr/std__expect@^1.0.19",
-            "npm:@jsr/std__testing@^1.0.19",
-            "npm:marked@15.0.12"
+            "npm:@jsr/std__testing@^1.0.19"
           ]
         }
       },
```

---

### Incident Patch 10: `3944b5cb` (2026-09-22)
**Commit Message**: fix: page viewer access and more (#2743)

* fix: page viewer access and more

* fix: address review feedback

- check page access before the pending-subscription lookup
- report failed grafana-oncall and ntfy test sends
- webhook delivery never follows redirects
- align query password handling across procedures
- isolate and tighten tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

* fix: address second round of review feedback

- follow same-host 307/308 redirects for outbound webhooks
- share the page access cookie key from a single source
- make the domain router tests cover the path encoding

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

* fix: only follow webhook redirects to the same service

Same host and port, and never from https to http.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

---------

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `apps/dashboard/src/app/(dashboard)/settings/general/page.tsx` (modified, +1/-3)
```diff
@@ -16,8 +16,6 @@ import { FormSlug } from "@/components/forms/settings/form-slug";
 import { FormWorkspace } from "@/components/forms/settings/form-workspace";
 import { useTRPC } from "@/lib/trpc/client";
 
-const BASE_URL = "https://app.openstatus.dev/invite";
-
 export default function Page() {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
@@ -40,7 +38,7 @@ export default function Page() {
   const createInvitationMutation = useMutation(
     trpc.invitation.create.mutationOptions({
       onSuccess: (data) => {
-        sendInvitationMutation.mutate({ id: data.id, baseUrl: BASE_URL });
+        sendInvitationMutation.mutate({ id: data.id });
         queryClient.invalidateQueries({
           queryKey: trpc.invitation.list.queryKey(),
         });
```

**File**: `apps/server/src/libs/cache-keys.ts` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+// The Redis keyspace is flat and shared across apps — never key on bare
+// user input, or one route can read or overwrite another's entries.
+export const cacheKeys = {
+  pageStatus: (slug: string) => `status:page:${slug}`,
+  monitorDailyStats: (id: string | number) => `stats:monitor:${id}:daily`,
+};
```

**File**: `apps/server/src/routes/public/status.test.ts` (modified, +63/-0)
```diff
@@ -514,3 +514,66 @@ describe("Status Route: Cache functionality", () => {
     await db.delete(page).where(eq(page.id, cachePage.id));
   });
 });
+
+describe("Status Route: cache key isolation", () => {
+  test("never serves a foreign redis key as a status", async () => {
+    for (const key of ["1-daily-stats", "telegram:workspace_token:1"]) {
+      testRedisStore?.set(key, JSON.stringify("leaked"));
+      const res = await app.request(
+        `/public/status/${encodeURIComponent(key)}`,
+      );
+      expect(await res.json()).toEqual({ status: "unknown" });
+    }
+  });
+
+  test("a page slug shaped like a stats key leaves that key untouched", async () => {
+    const slug = "987654-daily-stats";
+    await db.delete(page).where(eq(page.slug, slug));
+    const collidingPage = await db
+      .insert(page)
+      .values({
+        workspaceId: 1,
+        title: "Collision Test Page",
+        description: "",
+        slug,
+        customDomain: "",
+        accessType: "public",
+      })
+      .returning()
+      .get();
+
+    const statsKey = "stats:monitor:987654:daily";
+    testRedisStore?.set(statsKey, "cached-stats");
+
+    const res = await app.request(`/public/status/${slug}`);
+    expect((await res.json()).status).toBe("operational");
+    expect(testRedisStore?.has(slug)).toBe(false);
+    expect(testRedisStore?.get(statsKey)).toBe("cached-stats");
+
+    await db.delete(page).where(eq(page.id, collidingPage.id));
+  });
+
+  test("a protected page is never written to the cache", async () => {
+    const slug = `${TEST_PREFIX}-uncached-private`;
+    await db.delete(page).where(eq(page.slug, slug));
+    const privatePage = await db
+      .insert(page)
+      .values({
+        workspaceId: 1,
+        title: "Uncached Private Page",
+        description: "",
+        slug,
+        customDomain: "",
+        accessType: "password",
+        password: "secret",
+      })
+      .returning()
+      .get();
+
+    const res = await app.request(`/public/status/${slug}`);
+    expect(await res.json()).toEqual({ status: "unknown" });
+    expect(testRedisStore?.has(`status:page:${slug}`)).toBe(false);
+
+    await db.delete(page).where(eq(page.id, privatePage.id));
+  });
+});
```

**File**: `apps/server/src/routes/public/status.ts` (modified, +5/-2)
```diff
@@ -7,6 +7,7 @@ import { endTime, setMetric, startTime } from "hono/timing";
 const logger = getLogger("api-server");
 import { Status, Tracker } from "@openstatus/tracker";
 
+import { cacheKeys } from "../../libs/cache-keys";
 import { redis } from "../../libs/clients";
 
 // TODO: include ratelimiting
@@ -17,7 +18,9 @@ status.get("/:slug", async (c) => {
   try {
     const { slug } = c.req.param();
 
-    const cache = await redis.get(slug);
+    // Only public pages are ever written under this prefix, so a hit needs no
+    // access check; a page made private can stay cached for up to the 60s TTL.
+    const cache = await redis.get(cacheKeys.pageStatus(slug));
 
     if (cache) {
       setMetric(c, "OpenStatus-Cache", "HIT");
@@ -87,7 +90,7 @@ status.get("/:slug", async (c) => {
     });
 
     const status = tracker.currentStatus;
-    await redis.set(slug, status, { ex: 60 }); // 1m cache
+    await redis.set(cacheKeys.pageStatus(slug), status, { ex: 60 }); // 1m cache
 
     return c.json({ status });
   } catch (e) {
```

**File**: `apps/server/src/routes/rpc/handlers/notification/__tests__/notification.test.ts` (modified, +15/-0)
```diff
@@ -848,6 +848,21 @@ describe("NotificationService.SendTestNotification", () => {
     expect(data.message).toContain("not supported");
   });
 
+  test("rejects a plan-gated provider on the free plan before sending", async () => {
+    const res = await connectRequest(
+      "SendTestNotification",
+      {
+        provider: "NOTIFICATION_PROVIDER_PAGERDUTY",
+        data: { pagerduty: { integrationKey: "free-plan-key" } },
+      },
+      { "x-openstatus-key": String(OTHER_WORKSPACE_ID) },
+    );
+
+    expect(res.status).toBe(429);
+    const data = await res.json();
+    expect(data.message).toContain("pagerduty");
+  });
+
   test("returns error for unsupported SMS provider", async () => {
     const res = await connectRequest(
       "SendTestNotification",
```

#### Recent Merged Pull Requests:
- **PR #2821** (2026-09-30): feat: dashboard incident details pages (@mxkaske)
- **PR #2819** (2026-09-30): Announcing vercel oss program (@thibaultleouay)
- **PR #2817** (2026-09-29): model: update model (@thibaultleouay)
- **PR #2814** (2026-09-29): chore: remove slack-agent feature flag (@mxkaske)
- **PR #2812** (2026-09-29): Add Simplified Chinese (`zh`) status page translations. (@nulijiazaizhong)
- **PR #2808** (2026-09-30): dashboard: Postmortem tab (@thibaultleouay)
- **PR #2807** (2026-09-30): agent + slack: draft_postmortem (@thibaultleouay)
- **PR #2806** (2026-09-30): db + services: incident_postmortem (@thibaultleouay)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
