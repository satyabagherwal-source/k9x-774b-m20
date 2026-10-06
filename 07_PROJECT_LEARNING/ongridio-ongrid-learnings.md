# Forensic Learning Record (Deep Inspection): ongridio/ongrid

> **Canonical Artifact**: `07_PROJECT_LEARNING/ongridio-ongrid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ongridio/ongrid](https://github.com/ongridio/ongrid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:54:45.517Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ongridio/ongrid`
- **Description**: An ops AI Agent that understands your infrastructure, finds the root cause, and fixes it — right from Slack, Telegram, Lark or DingTalk.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 1112 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/ongrid-edge-supervisor/worker.go`
```
// worker.go 实现 supervisor.exe 对 worker.exe 的启动 + 监控 + 心跳 watchdog
// （仅做"崩溃重启 + 心跳超时 kill 重启"，bundle upgrade 流程由
// upgrademachine 状态机驱动）。
//
// 健康感知走 health.json 文件 IPC：
//   - worker 每 30s 写一次心跳
//   - supervisor 每 30s 读 + 判断超时（90s 阈值，3× 心跳间隔）
//   - 超时 → kill worker → superviseWorker 外层循环重启

//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"time"

	"github.com/ongridio/ongrid/internal/edgeagent/edgedirs"
	"github.com/ongridio/ongrid/internal/edgeagent/supervisorhealth"
	"github.com/ongridio/ongrid/internal/edgeagent/upgrademachine"
)

// 部署路径常量统一在 internal/edgeagent/edgedirs 包，与 cmd/ongrid-edge
// 共享。
//
// 重启间隔是 worker 异常退出后的固定等待时间。
//
//	不做指数退避（YAGNI）；后续如需要再加资源限制 / 指数退避。
const (
	restartDelay      = 5 * time.Second
	workerKillTimeout = 10 * time.Second
)

// workerExe 返回 worker.exe 的绝对路径（edgedirs.BinDir + 文件名）。
func workerExe() string {
	return edgedirs.BinDir + `\` + edgedirs.WorkerBinary
}

// runWorkerOnly 是交互模式（非 Service）入口，直接启动 worker。
// 用于开发调试（RDP 跑 supervisor.exe 看日志）。
func runWorkerOnly(log *slog.Logger) error {
	ctx, cancel := signalInterruptContext()
	defer cancel()
	m := upgrademachine.NewMachine(
		edgedirs.StageDir, edgedirs.BinDir,
		log, &windowsProcessController{},
	)
	return superviseWorker(ctx, log, m)
}

// signalInterruptContext 返回一个在 Ctrl+C 时 cancel 的 ctx。
// 仅用于交互模式（runWorkerOnly）；服务模式由 SCM Stop 回调 cancel。
func signalInterruptContext() (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithCancel(context.Background())
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt)
	go func() {
		<-ch
		cancel()
	}()
	return ctx, cancel
}

// superviseWorker 是 supervisor 主循环：启动 worker → 监控 → 异常退出则等待
// restartDelay 后重启。ctx 取消时优雅停止 worker 并返回 ctx.Err。
//
// upgrade 集成：
//
//   - errUpgradeApplied → 跳过 restartDelay 立即重启 + 下一轮进入 upgrade watch
//
//   - rollback.done sentinel 存在 → 跳过 upgrade watch（避免死循环）
//
//   - watchDeadline 到期 + worker 已退出（空窗）→ RollbackAndMark（在文件锁
//     释放后的空窗执行，rename 可成功）
//
//   - 超时回滚后若 supervisor 自升级待恢复（awaiting_health 哨兵），
//     保留哨兵 + return ErrSupervisorRestartSoon → SCM 重启 → BootCheck 恢复 .old
//
// 设计要点：rollback 决策放在本函数循环顶部，而非 HealthPoll goroutine 内
// 的 timer 触发。两个原因：
//   - HealthPoll 若持 workerCtx，worker 崩溃连锁取消 workerCtx 时
//     timer.C 分支永不触发 → RollbackAndMark 永不执行（crash loop 场景）。
//   - worker 仍运行时调 RollbackAndMark → os.Rename 撞
//     Windows image section 文件锁。
//
// 移到 superviseWorker 循环顶部（runWorkerOnce 返回 = worker.exe 已退出）后：
// watchDeadline 由 superviseWorker 持有（免疫 workerCtx 连锁取消），且 worker.exe
// 文件锁已释放（rename 可成功）。
//
// shouldRollbackAfterDeadline 是 superviseWorker 循环顶部 rollback 判定的纯函数
// 抽象，抽出主要为可测性 — superviseWorker 本身需要起 worker 子进程
// 无法在 unit test 跑，但 rollback 决策逻辑（4 条件 AND）可以独立验证。返回 true
// 当且仅当：watchUpgrade 已激活 + watchDeadline 已武装 + 当前时刻已过 deadline +
// 升级未确认健康（IsUpgradeHealthy=false）。superviseWorker 在 runWorkerOnce 返回
// （= worker.exe 已退出空窗）时调用此函数判定是否触发 RollbackAndMark。
func shouldRollbackAfterDeadline(stageDir string, watchUpgrade bool, watchDeadline, now time.Time) bool {
	if !watchUpgrade || watchDeadline.IsZero() {
		return false
	}
	if !now.After(watchDeadline) {
		return false
	}
	return !upgrademachine.IsUpgradeHealthy(stageDir)
}

// maxRollbackRetries 是回滚失败告警阈值。连续失败达到此
// 值时发恰好一次终态告警；重试本身不设上限（见 rollbackAlertDecision 注释）。
const maxRollbackRetries = 3

// rollbackAlertDecision 报告回滚失败后是否发终态告警，
// 对称 shouldRollbackAfterDeadline 的纯函数先例：恰好 failures ==
// maxRollbackRetries 时 true（恰好一次，防告警风暴），之前/之后均 false。
//
// 设计裁决：重试在 watch 保留期间**不设
// 上限**——每轮循环顶空窗重试一次 RollbackAndMark（rename 幂等且廉价，AV/EDR
// 持锁通常短暂，锁释放即自愈收敛）。曾评估的两个替代方案均劣：
//   - 达上限停止重试：锁释放后也不自愈（skip 阻止后续 rename 尝试），
//     纯 worker 升级场景（无 awaiting_health 哨兵）无任何机制重启 supervisor
//     → BootCheck 年龄兜底不可达 → 永久振荡静默态
//   - 达上限 exit(1) 换 SCM 重启上下文重试：锁永持时 4min 级 supervisor 重启
//     循环，且 SCM recovery 配置可能有失败上限（服务最终停止，伤害扩大）
//
// 告警上报通道偏差：supervisor 进程无 manager RPC 客户端
// （网络栈属 worker 进程），告警落地为调用点的 log.Error 结构化告警
// （supervisor.log + Windows 事件日志采集链路可达）；未来加通道时决策
// 语义不变，仅换上报动作。
func rollbackAlertDecision(failures int) bool {
	return failures == maxRollbackRetries
}

func superviseWorker(ctx context.Context, log *slog.Logger, m *upgrademachine.Machine) error {
	// BootCheck 检测到 supervisor_selfswap_awaiting_health
	// sentinel 时设 pendingHealthCheck=true → superviseWorker 启用 upgrade watch，
	// 启 worker 后跑 HealthPoll 180s grace 确认健康（健康判定发生在 worker
	// 实际启动后，避免在 worker 有机会写健康标记前误回滚）。
	watchUpgrade := m.PendingHealthCheck()
	// watchDeadline 是 upgrade watch 窗口的截止时刻。零值 = 未武装。
	// 首次进入 watch 模式时武装（now + upgradeWatchTimeout），runWorkerOnce 读取
	// 它在到期时 cancel worker，让本循环顶部在空窗判定 rollback。
	var watchDeadline time.Time
	if watchUpgrade {
		log.Info("upgrade: watch armed from pendingHealthCheck (supervisor self-swap awaiting health)")
	}
	// rollbackFailures 是 RollbackAndMark 连续失败计数。
	// 告警决策见 rollbackAlertDecision；回滚成功、watch 卸载、进入新升级周期
	// （ErrApplied）时复位 — 每个升级窗口的告警预算独立。
	var rollbackFailures int
	for attempt := 0; ; attempt++ {
		// rollback.done sentinel → 上次 rollback 过，本轮不 watch
		if upgrademachine.RollbackDoneExists(edgedirs.StageDir) {
			if watchUpgrade {
				log.Info("upgrade: rollback.done sentinel present; disarming watch")
				rollbackFailures = 0
			}
			watchUpgrade = false
			watchDeadline = time.Time{}
		}

		// 武装 watchDeadline（首次进 watch 模式 / ErrApplied 重启后）
		if watchUpgrade && watchDeadline.IsZero() {
			watchDeadline = time.Now().Add(upgradeWatchTimeout)
			log.Info("upgrade: watch deadline armed", "timeout", upgradeWatchTimeout, "deadline", watchDeadline)
		}

		err := runWorkerOnce(ctx, log, watchUpgrade, watchDeadline, m)

		if errors.Is(err, upgrademachine.ErrApplied) {
			// swap 完成 → 检查是否需要 supervisor 自升级
			//（bundle 含 supervisor.exe 时 applyOne 写 pending sentinel）
			if upgrademachine.IsSupervisorUpgradePending(edgedirs.StageDir) {
				log.Info("supervisor self-swap pending; triggering rename-aside")
				swapErr := m.SupervisorSelfSwap()
				if errors.Is(swapErr, upgrademachine.ErrSupervisorRestartSoon) {
					return swapErr // 让 service.go 触发 SCM restart 加载新 supervisor
				}
				if swapErr != nil {
					log.Error("supervisor self-swap failed (worker continues with current supervisor; HealthPoll will catch version mismatch)",
						"err", swapErr)
				}
			}
			// 立即重启新 worker + 进入 upgrade watch；watchDeadline 下轮重新武装。
			// 新升级周期 → 失败计数复位。
			log.Info("upgrade applied; restarting worker without delay")
			watchDeadline = time.Time{}
			watchUpgrade = true
			rollbackFailures = 0
			continue
		}

		// runWorkerOnce 返回 = worker.exe 已退出
		// 空窗。若 watch 窗口已到期 + 不健康 → 在此处 RollbackAndMark（worker.exe
		// 文件锁已释放，os.Rename 不再撞 image section）。
		//
		// TOCTOU 不变式：shouldRollbackAfterDeadline 内部
		// 读 IsUpgradeHealthy 与下面的 RollbackAndMark 写之间存在理论竞态窗口，
		// 但 worker 已退出（runWorkerOnce 返回的先验条件）= 唯一可能写 healthy_marker
		// 的进程已死 = 无并发 fs 写入 = TOCTOU 不可达。未来若加 manager RPC 远程写
		// healthy_marker 的能力，此不变式需重新评估。
		if shouldRollbackAfterDeadline(edgedirs.StageDir, watchUpgrade, watchDeadline, time.Now()) {
			// 编排顺序约束：终止进程 → 等 worker 退出 → 回滚。
			// 本块处于 runWorkerOnce 返回之后（worker.exe 已退出空窗，文件锁已释放），
			// RollbackAndMark 是纯文件操作（upgrademachine.Rollback 无进程探测）—
			// 「先杀后回滚」的顺序由本编排层保证；BootCheck 强制双恢复分支的
			// KillByImage → RollbackAndMark 顺序由 dualrestore 测试锚定。
			if rerr := m.RollbackAndMark(); rerr != nil {
				// 回滚失败保留 watch 武装与哨兵，循环顶持续重试
				// （不设上限，见 rollbackAlertDecision 注释的方案裁决）。达阈值告警
				// 恰好一次；此后失败日志降频 Debug（每轮空窗一次，Error 会刷屏）。
				rollbackFailures++
				if rollbackAlertDecision(rollbackFailures) {
					log.Error("ALERT: upgrade rollback keeps failing; manual intervention may be required",
						"failures", rollbackFailures, "threshold", maxRollbackRetries, "err", rerr)
				}
				if rollbackFailures <= maxRollbackRetries {
					log.Error("upgrade: rollback after deadline failed; will retry at loop top",
						"err", rerr, "attempt", rollbackFailures)
				} else {
					log.Debug("upgrade: rollback retry still failing (degraded log)",
						"err", rerr, "attempt", rollbackFailures)
				}
			} else if upgrademachine.IsSupervisorSelfSwapAwaitingHealth(edgedirs.StageDir) {
				// 双恢复：worker 已回滚（先），supervisor 侧恢复
				// 走 BootCheck 哨兵路径（后）— 保留 awaiting_health 哨兵不删，
				// 它与 rollback.done 的组合 = "worker 已回滚、supervisor 待恢复"
				// 中间态信号，BootCheck 步骤 1 检测后恢复 .old 并触发 SCM 重启。
				// 断电安全：中间点断电后下次 BootCheck 到达同一恢复路径（幂等）。
				log.Info("upgrade: worker rolled back; supervisor restore pending via BootCheck; exiting for SCM restart")
				return upgrademachine.ErrSupervisorRestartSoon
			} else {
				// 纯 worker 升级超时（bundle 不含 supervisor.exe，无自恢复源）：
				// 卸载 watch 即可。回滚已成功，失败计数复位。
				watchUpgrade = false
				watchDeadline = time.Time{}
				rollbackFailures = 0
			}
		} else if watchUpgrade && !watchDeadline.IsZero() && time.Now().After(watchDeadline) {
			// deadline 到了但 IsUpgradeHealthy=true → 升级成功，卸载 watch
			log.Info("upgrade: watch deadline reached; upgrade healthy, disarming watch")
			watchUpgrade = false
			watchDeadline = time.Time{}
			rollbackFailures = 0
		}

		if err != nil && ctx.Err() == nil {
			log.Error("worker exited unexpectedly", "attempt", attempt, "err", err)
		}

		if ctx.Err() != nil {
			log.Info("supervisor context cancelled; exiting worker loop")
			return ctx.Err()
		}

		log.Info("restarting worker", "after", restartDelay, "attempt", attempt+1)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(restartDelay):
		}
	}
}

// runWorkerOnce 启动一次 worker.exe，阻塞等待其退出。
// 退出原因有三：(1) worker 自己崩溃（Wait 返回 err）；(2) watchdog 发现心跳
// 超时，cancel workerCtx → kill worker；(3) 父 ctx 取消（服务停止）。
//
// watchUpgrade=true 时，worker 启动后额外启动 upgrade watch goroutine
// （HealthPoll polling healthy_marker，  去掉原 timer 分支）。
// watchDeadline 到期时本函数 cancel worker，让 superviseWorker 循环顶部在
// 空窗判定 rollback（worker.exe 文件锁已释放）。
//
// worker 退出后检测 pending upgrade（checkPendingUpgrade），有则 swap 并返回
// errUpgradeApplied sentinel 让 superviseWorker 跳过 restartDelay。
func runWorkerOnce(ctx context.Context, log *sl
```

### Core Architecture Module: `internal/edgeagent/plugins/autoapm/render.go`
```
package autoapm

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/ongridio/ongrid/internal/edgeagent/plugins"
	contract "github.com/ongridio/ongrid/internal/pkg/autoapm"
	"gopkg.in/yaml.v3"
)

func render(cfg plugins.PluginConfig) ([]byte, error) {
	s, err := contract.Parse(cfg.Spec)
	if err != nil {
		return nil, err
	}
	if !s.Selected() {
		return nil, fmt.Errorf("auto APM: refusing to start OBI without selected targets")
	}
	rules := make([]map[string]interface{}, 0, len(s.Targets))
	for _, t := range s.Targets {
		rules = append(rules, map[string]interface{}{"exe_path": "^" + regexp.QuoteMeta(t.Executable) + "$", "open_ports": strconv.Itoa(int(t.Port)), "name": t.ServiceName, "namespace": t.ServiceNamespace})
	}
	kubernetes := map[string]interface{}{"enable": "false"}
	ebpf := map[string]interface{}{"context_propagation": "headers"}
	if s.Kubernetes != nil {
		if s.ClusterID == 0 {
			// Old Managers do not project unified identity. Retain their legacy
			// registration ID until both sides support the new protocol.
			if id, err := strconv.ParseUint(os.Getenv("ONGRID_K8S_CLUSTER_ID"), 10, 64); err != nil || id == 0 {
				return nil, fmt.Errorf("auto APM: Kubernetes capture requires a cluster identity")
			}
		}
		ebpf["bpf_fs_path"] = "/sys/fs/bpf/ongrid"
		kubernetes["enable"] = "true"
		kubernetes["disable_informers"] = []string{"service"}
		// OBI v0.12.1 infers its node from os.Hostname, not spec.nodeName.
		// Only restrict metadata when that inference is safe. Otherwise local
		// process/container IDs still limit capture to this node's selected Pods.
		// ponytail: cache cluster metadata until OBI accepts an explicit node name.
		hostname, err := os.Hostname()
		kubernetes["meta_restrict_local_node"] = err == nil && hostname != "" && hostname == os.Getenv("ONGRID_K8S_NODE_NAME")
		for _, target := range s.Kubernetes.Rules {
			rule := map[string]interface{}{"k8s_namespace": "^" + regexp.QuoteMeta(target.Namespace) + "$"}
			if attr := contract.WorkloadAttribute(target.WorkloadKind); attr != "" {
				rule[strings.ReplaceAll(attr, ".", "_")] = "^" + regexp.QuoteMeta(target.WorkloadName) + "$"
			}
			rules = append(rules, rule)
		}
	}
	// Config v1 services uses regex; instrument uses glob. Literal paths are
	// explicitly anchored and escaped so a selection never broadens capture.
	return yaml.Marshal(map[string]interface{}{
		"enforce_sys_caps":    true,
		"log_level":           "WARN",
		"attributes":          map[string]interface{}{"kubernetes": kubernetes},
		"discovery":           map[string]interface{}{"services": rules, "exclude_otel_instrumented_services": true},
		"ebpf":                ebpf,
		"otel_traces_export":  map[string]interface{}{"endpoint": "http://127.0.0.1:14318/v1/traces", "protocol": "http/protobuf", "instrumentations": []string{"http", "grpc"}, "sampler": map[string]string{"name": "parentbased_traceidratio", "arg": strconv.FormatFloat(s.Ratio(), 'f', -1, 64)}},
		"otel_metrics_export": map[string]interface{}{"endpoint": "http://127.0.0.1:14318/v1/metrics", "protocol": "http/protobuf", "interval": "15s", "histogram_aggregation": "explicit_bucket_histogram", "instrumentations": []string{"http", "grpc"}},
		"metrics":             map[string]interface{}{"features": []string{"application", "application_runtime"}},
	})
}

func collectorConfig(cfg plugins.PluginConfig, s contract.Spec) plugins.PluginConfig {
	attrs := map[string]interface{}{"ongrid.instrumentation.source": "obi"}
	if s.ClusterID != 0 {
		attrs["cluster_id"] = strconv.FormatUint(s.ClusterID, 10)
		attrs["k8s_cluster_id"] = strconv.FormatUint(s.K8sClusterID, 10)
	} else if s.Kubernetes != nil {
		// Legacy wire format: do not mark an internal ID as a unified ID.
		attrs["cluster_id"] = os.Getenv("ONGRID_K8S_CLUSTER_ID")
	}
	if s.Environment != "" {
		attrs["deployment.environment.name"] = s.Environment
	}
	environments := make([]map[string]string, 0)
	for _, target := range s.Targets {
		if target.Environment != "" {
			environments = append(environments, map[string]string{"service_name": target.ServiceName, "service_namespace": target.ServiceNamespace, "environment": target.Environment})
		}
	}
	cfg.Spec = map[string]interface{}{
		"grpc_endpoint": "127.0.0.1:14317", "http_endpoint": "127.0.0.1:14318",
		"enable_metrics": true, "metrics_export_endpoint": "127.0.0.1:9465",
		// Share the Edge resource budget; keep batches and queues bounded.
		"bounded_pipelines":            true,
		"tls_insecure_skip_verify":     s.TLSInsecureSkipVerify,
		"collector_metrics_endpoint":   "127.0.0.1:18888",
		"health_endpoint":              "127.0.0.1:14333",
		"extra_attrs":                  attrs,
		"service_environments":         environments,
		"kubernetes_service_namespace": s.Kubernetes != nil,
	}
	return cfg
}

```

### Core Architecture Module: `internal/edgeagent/plugins/logs/render.go`
```
package logs

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/ongridio/ongrid/internal/edgeagent/plugins"
	"github.com/ongridio/ongrid/internal/pkg/autoapm"
	"gopkg.in/yaml.v3"
)

const (
	backendBuiltinLoki           = "builtin_loki"
	backendExternalES            = "external_elasticsearch"
	logsStorageExtension         = "file_storage/logs"
	maxLogSources                = 64
	maxSourcePatterns            = 32
	sensitiveBodyPattern         = `(?i)['"]?(password|passwd|secret|api[_-]?key|authorization)['"]?\s*[=：:]\s*("[^"]*"|'[^']*'|[^\s,;}]+)`
	sensitiveAttributeKeyPattern = `(?i)(^|[._-])(password|passwd|secret|api[_-]?key|authorization)($|[._-])`
)

var (
	selectedPodLogPattern = regexp.MustCompile(`^/var/log/pods/[a-z0-9][a-z0-9-]*_(\*|[a-zA-Z0-9][a-zA-Z0-9.-]*)_(\*|[a-zA-Z0-9][a-zA-Z0-9.-]*)/(\*|[a-z0-9][a-z0-9-]*)/\*\.log$`)
	sourceIDPattern       = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`)
	resourceKeyRegex      = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9._-]{0,127}$`)
	datasetPattern        = regexp.MustCompile(`^ongrid\.[a-z0-9][a-z0-9._-]{0,91}$`)
	namespacePattern      = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,99}$`)
	logsProbeIDPattern    = regexp.MustCompile(`^ongrid-log-probe-[A-Za-z0-9_-]{20,64}$`)
)

type fileSource struct {
	ID               string
	ServiceName      string
	ServiceNamespace string
	Environment      string
	Dataset          string
	Include          []string
	Exclude          []string
	Parser           string
	Regex            string
	MultilineStart   string
	MultilineEnd     string
	StartAt          string
	ExcludeOlderThan string
}

// render builds a standalone otelcol-contrib logs process. The collector is
// still the data-plane client: it reads local journal/files and writes either
// Manager's native Loki OTLP endpoint or external Elasticsearch directly.
func render(cfg plugins.PluginConfig) ([]byte, error) {
	if cfg.EdgeID == 0 {
		return nil, errors.New("logs plugin: device_id required")
	}
	spec := cfg.Spec
	if spec == nil {
		spec = map[string]interface{}{}
	}
	backend := strings.ToLower(strings.TrimSpace(stringSpec(spec, "backend")))
	if backend == "" {
		backend = backendBuiltinLoki
	}
	if backend != backendBuiltinLoki && backend != backendExternalES {
		return nil, fmt.Errorf("logs plugin: unsupported backend %q", backend)
	}

	mode := strings.ToLower(strings.TrimSpace(stringSpec(spec, "mode")))
	if mode == "" {
		mode = "host"
	}
	if mode != "host" && mode != "kubernetes" {
		return nil, errors.New("logs plugin: mode must be host or kubernetes")
	}
	clusterID := strings.TrimSpace(stringSpec(spec, "cluster_id"))
	if mode == "kubernetes" && clusterID == "" {
		return nil, errors.New("logs plugin: cluster_id required when mode=kubernetes")
	}
	clusterName := strings.TrimSpace(stringSpec(spec, "cluster_name"))
	nodeName := strings.TrimSpace(stringSpec(spec, "node_name"))
	startAt, err := startAtSpec(spec, "start_at", "end")
	if err != nil {
		return nil, err
	}

	receivers := make(map[string]interface{})
	receiverIDs := make([]string, 0, 4)
	enableJournald := boolSpecDefault(spec, "enable_journald", true)
	if enableJournald {
		receiverID := "journald/system"
		receivers[receiverID] = journaldReceiver(spec, cfg.EdgeID, startAt)
		receiverIDs = append(receiverIDs, receiverID)
	}
	if mode == "kubernetes" {
		podPaths := stringSlice(spec, "pod_log_paths")
		for _, podPath := range podPaths {
			if !selectedPodLogPattern.MatchString(podPath) {
				return nil, errors.New("logs plugin: invalid selected Kubernetes log path")
			}
		}
		if len(podPaths) > 0 {
			receiverID := "filelog/kubernetes"
			receivers[receiverID] = kubernetesReceiver(spec, cfg.EdgeID, clusterID, nodeName, podPaths, startAt)
			receiverIDs = append(receiverIDs, receiverID)
		}
	} else {
		sources, err := parseFileSources(spec, startAt)
		if err != nil {
			return nil, err
		}
		if len(sources) == 0 && !enableJournald {
			sources = []fileSource{{
				ID: "system", ServiceName: "system", Include: []string{"/var/log/syslog", "/var/log/messages"}, Parser: "plain", StartAt: startAt,
			}}
		}
		if raw, ok := spec["service_capture"]; ok {
			fields, ok := raw.(map[string]interface{})
			if !ok {
				return nil, errors.New("logs plugin: service_capture must be an object")
			}
			capture, err := autoapm.Parse(fields)
			if err != nil {
				return nil, err
			}
			seen := map[string]bool{}
			var selected []fileSource
			var paths []string
			for _, target := range capture.Targets {
				if target.LogPath == "" || seen[target.LogPath] {
					continue
				}
				seen[target.LogPath] = true
				environment := target.Environment
				if environment == "" {
					environment = capture.Environment
				}
				sum := sha256.Sum256([]byte(target.LogPath))
				selected = append(selected, fileSource{
					ID: fmt.Sprintf("service-%x", sum[:8]), ServiceName: target.ServiceName,
					ServiceNamespace: target.ServiceNamespace, Environment: environment,
					Include: []string{target.LogPath}, Exclude: append([]string(nil), paths...),
					Parser: "plain", StartAt: startAt,
				})
				paths = append(paths, target.LogPath)
			}
			// Service selection owns these files, even if an existing device glob overlaps.
			for i := range sources {
				sources[i].Exclude = append(sources[i].Exclude, paths...)
			}
			sources = append(sources, selected...)
		}
		for _, source := range sources {
			receiverID := "filelog/" + source.ID
			receivers[receiverID] = fileReceiver(cfg.EdgeID, source)
			receiverIDs = append(receiverIDs, receiverID)
		}
	}
	if len(receiverIDs) == 0 {
		return nil, errors.New("logs plugin: at least one log source is required")
	}
	probeID := strings.TrimSpace(stringSpec(spec, "log_probe_id"))
	probeFile := strings.TrimSpace(stringSpec(spec, "log_probe_file"))
	if (probeID == "") != (probeFile == "") {
		return nil, errors.New("logs plugin: probe id and managed file must be provided together")
	}
	if probeFile != "" {
		if !logsProbeIDPattern.MatchString(probeID) {
			return nil, errors.New("logs plugin: invalid probe id")
		}
		if err := validateLogPattern(probeFile); err != nil {
			return nil, fmt.Errorf("logs plugin: probe file: %w", err)
		}
		const receiverID = "filelog/ongrid-probe"
		receivers[receiverID] = fileReceiver(cfg.EdgeID, fileSource{
			ID: "ongrid-probe", ServiceName: "ongrid-edge", Include: []string{probeFile}, Parser: "plain", StartAt: "beginning",
		})
		receiverIDs = append(receiverIDs, receiverID)
	}
	sort.Strings(receiverIDs)

	resourceActions, err := commonResourceActions(cfg, spec, clusterID, clusterName, nodeName)
	if err != nil {
		return nil, err
	}
	// Promote only the canonical structured correlation fields. File/CRI bodies
	// may be JSON; unrelated fields and platform-owned device/cluster IDs are
	// never copied from application payloads into resource identity.
	correlationStatements := []string{
		`merge_maps(log.cache, ParseJSON(log.body), "upsert") where IsString(log.body) and IsMatch(log.body, "^\\s*\\{")`,
		`set(log.trace_id, TraceID(log.attributes["trace_id"])) where IsString(log.attributes["trace_id"]) and IsMatch(log.attributes["trace_id"], "^[a-fA-F0-9]{32}$") and IsEmpty(log.trace_id)`,
		`set(log.span_id, SpanID(log.attributes["span_id"])) where IsString(log.attributes["span_id"]) and IsMatch(log.attributes["span_id"], "^[a-fA-F0-9]{16}$") and IsEmpty(log.span_id)`,
		`set(log.trace_id, TraceID(log.cache["trace_id"])) where IsString(log.cache["trace_id"]) and IsMatch(log.cache["trace_id"], "^[a-fA-F0-9]{32}$") and IsEmpty(log.trace_id)`,
		`set(log.span_id, SpanID(log.cache["span_id"])) where IsString(log.cache["span_id"]) and IsMatch(log.cache["span_id"], "^[a-fA-F0-9]{16}$") and IsEmpty(log.span_id)`,
	}
	for _, attribute := range []string{"service.name", "service.namespace", "service.version", "service.instance.id", "deployment.environment.name", "deployment.environment"} {
		correlationStatements = append(correlationStatements,
			fmt.Sprintf(`set(resource.attributes[%q], log.attributes[%q]) where resource.attributes[%q] == nil and IsString(log.attributes[%q]) and Len(log.attributes[%q]) <= 256`, attribute, attribute, attribute, attribute, attribute),
			fmt.Sprintf(`set(resource.attributes[%q], log.cache[%q]) where resource.attributes[%q] == nil and IsString(log.cache[%q]) and Len(log.cache[%q]) <= 256`, attribute, attribute, attribute, attribute, attribute))
	}
	guardStatements := append(correlationStatements, levelDetectionStatements()...)
	guardStatements = append(guardStatements,
		fmt.Sprintf(`replace_pattern(log.body, %s, "$1=<redacted>") where IsString(log.body)`, strconv.Quote(sensitiveBodyPattern)),
		fmt.Sprintf(`delete_matching_keys(log.attributes, %s)`, strconv.Quote(sensitiveAttributeKeyPattern)),
		fmt.Sprintf(`delete_matching_keys(resource.attributes, %s)`, strconv.Quote(sensitiveAttributeKeyPattern)),
		`limit(log.attributes, 64, ["log.file.path", "systemd.unit", "ongrid.probe_id"])`,
		`truncate_all(log.attributes, 4096)`,
		`set(log.attributes["systemd.unit"], log.attributes["_SYSTEMD_UNIT"]) where log.attributes["_SYSTEMD_UNIT"] != nil`,
	)
	// Preserve stable product dimensions for both supported backends.
	guardStatements = append(guardStatements,
		`set(resource.attributes["deployment.environment.name"], resource.attributes["deployment.environment"]) where resource.attributes["deployment.environment.name"] == nil and resource.attributes["deployment.environment"] != nil`,
		`set(log.attributes["level"], log.severity_text)`,
		`set(resource.attributes["filename"], log.attributes["log.file.path"]) where log.attributes["log.file.path"] != nil`,
		`set(resource.attributes["unit"], log.attributes["systemd.unit"]) where log.attributes["systemd.unit"] != nil`,
		`set(resource.attributes["namespace"], resource.attributes["k8s.namespace.name"]) where resource.attributes["k8s.namespace.name"] != nil`,
		`set(resource.attributes["po
```

### Core Architecture Module: `internal/edgeagent/plugins/profiles/render.go`
```
package profiles

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/ongridio/ongrid/internal/edgeagent/plugins"
	"gopkg.in/yaml.v3"
)

var runtimeProfileTypes = map[string]bool{
	"cpu": true, "heap": true, "allocs": true, "goroutine": true, "mutex": true, "block": true,
}

func renderRuntime(cfg plugins.PluginConfig) ([]byte, error) {
	if err := validateBase(cfg); err != nil {
		return nil, err
	}
	target, ok := mapValue(cfg.Spec["runtime_target"])
	if !ok {
		return nil, fmt.Errorf("profiles plugin: runtime_target required for pprof mode")
	}
	endpoint := mapString(target, "url")
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.User != nil {
		return nil, fmt.Errorf("profiles plugin: runtime_target.url must be an http(s) URL without credentials")
	}
	profileType := strings.ToLower(mapString(target, "profile_type"))
	if !runtimeProfileTypes[profileType] {
		return nil, fmt.Errorf("profiles plugin: unsupported runtime profile type %q", profileType)
	}
	interval := mapInt(target, "collection_interval_seconds", 60)
	if interval < 10 || interval > 3600 {
		return nil, fmt.Errorf("profiles plugin: collection_interval_seconds must be between 10 and 3600")
	}
	remote := map[string]any{
		"endpoint":            endpoint,
		"collection_interval": fmt.Sprintf("%ds", interval),
		"initial_delay":       "1s",
	}
	if parsed.Scheme == "https" && mapBool(target, "tls_insecure_skip_verify", false) {
		remote["tls"] = map[string]any{"insecure_skip_verify": true}
	}
	serviceName := strings.TrimSpace(mapString(target, "service_name"))
	if serviceName == "" {
		serviceName = parsed.Hostname()
	}
	attributes := resourceAttributes(cfg.EdgeID, profileType, serviceName)
	for _, field := range []struct{ param, attr string }{{"environment", "deployment.environment.name"}, {"service_namespace", "service.namespace"}, {"instance_id", "service.instance.id"}, {"service_version", "service.version"}} {
		if value := mapString(target, field.param); value != "" {
			if len(value) > 256 || strings.ContainsAny(value, "\n\r\x00") {
				return nil, fmt.Errorf("profiles plugin: invalid %s", field.param)
			}
			attributes = append(attributes, map[string]any{"key": field.attr, "value": value, "action": "upsert"})
		}
	}
	if pid := mapInt(target, "process_pid", 0); pid > 0 {
		attributes = append(attributes, map[string]any{"key": "process.pid", "value": pid, "action": "upsert"})
	}
	return marshalCollectorConfig(
		map[string]any{"pprof/runtime": map[string]any{"remote": remote}},
		[]string{"pprof/runtime"},
		attributes,
		cfg,
	)
}

func marshalCollectorConfig(receivers map[string]any, receiverNames []string, attributes []map[string]any, cfg plugins.PluginConfig) ([]byte, error) {
	exporter := map[string]any{
		"profiles_endpoint": strings.TrimRight(cfg.Endpoint, "/"),
		"compression":       "gzip",
		"timeout":           "30s",
		"tls": map[string]any{
			"insecure_skip_verify": specBool(cfg.Spec, "tls_insecure_skip_verify", true),
			"curve_preferences":    []string{"X25519"},
		},
		"sending_queue":    map[string]any{"enabled": true, "num_consumers": 2, "queue_size": 256},
		"retry_on_failure": map[string]any{"enabled": true, "initial_interval": "1s", "max_interval": "30s", "max_elapsed_time": "5m"},
	}
	if auth := authHeader(cfg.AuthUser, cfg.AuthPass); auth != "" {
		exporter["headers"] = map[string]any{"Authorization": auth}
	}
	body := map[string]any{
		"receivers": receivers,
		"processors": map[string]any{
			"resource/ongrid": map[string]any{"attributes": attributes},
		},
		"exporters": map[string]any{"otlphttp/manager": exporter},
		"service": map[string]any{
			"telemetry": map[string]any{
				"logs":    map[string]any{"level": "info"},
				"metrics": map[string]any{"level": "none"},
			},
			"pipelines": map[string]any{
				"profiles": map[string]any{
					"receivers":  receiverNames,
					"processors": []string{"resource/ongrid"},
					"exporters":  []string{"otlphttp/manager"},
				},
			},
		},
	}
	return yaml.Marshal(body)
}

func validateBase(cfg plugins.PluginConfig) error {
	if cfg.EdgeID == 0 {
		return fmt.Errorf("profiles plugin: device_id required")
	}
	u, err := url.Parse(cfg.Endpoint)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return fmt.Errorf("profiles plugin: endpoint must be an http(s) URL")
	}
	return nil
}

func profileMode(spec map[string]any) (string, error) {
	mode := strings.ToLower(strings.TrimSpace(specString(spec, "mode", "pprof")))
	if mode != "pprof" {
		return "", fmt.Errorf("profiles plugin: mode must be pprof")
	}
	return mode, nil
}

func resourceAttributes(edgeID uint64, profileType, serviceName string) []map[string]any {
	attrs := []map[string]any{
		{"key": "device_id", "value": strconv.FormatUint(edgeID, 10), "action": "upsert"},
		{"key": "ongrid_source", "value": "otel_profiles", "action": "upsert"},
		{"key": "profile.type", "value": profileType, "action": "upsert"},
	}
	if serviceName != "" {
		attrs = append(attrs, map[string]any{"key": "service.name", "value": serviceName, "action": "upsert"})
	}
	return attrs
}

func authHeader(user, pass string) string {
	if user != "" {
		return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
	}
	if pass != "" {
		return "Bearer " + pass
	}
	return ""
}

func specString(spec map[string]any, key, fallback string) string {
	if value, ok := spec[key].(string); ok && strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

func specInt(spec map[string]any, key string, fallback int) int { return mapInt(spec, key, fallback) }

func specBool(spec map[string]any, key string, fallback bool) bool {
	return mapBool(spec, key, fallback)
}

func mapValue(value any) (map[string]any, bool) {
	out, ok := value.(map[string]any)
	return out, ok
}

func mapString(values map[string]any, key string) string {
	value, _ := values[key].(string)
	return strings.TrimSpace(value)
}

func mapInt(values map[string]any, key string, fallback int) int {
	switch value := values[key].(type) {
	case int:
		return value
	case float64:
		return int(value)
	case string:
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return fallback
}

func mapBool(values map[string]any, key string, fallback bool) bool {
	value, ok := values[key].(bool)
	if ok {
		return value
	}
	return fallback
}

```

### Core Architecture Module: `internal/edgeagent/plugins/traces/render.go`
```
package traces

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
	"text/template"

	"github.com/ongridio/ongrid/internal/edgeagent/plugins"
)

// otelcolTemplate is the OTel Collector config we render per edge.
//
// Receivers: OTLP gRPC + HTTP, bound to docker bridge / localhost addresses
// the application can reach. We intentionally do NOT bind 0.0.0.0 — the edge
// is meant to ingest from local apps (host or sibling containers on the
// docker bridge), not from the public internet.
//
// Exporters: a single OTLP HTTP exporter pointing at the manager /v1/traces
// endpoint. Use traces_endpoint, not endpoint: otlphttp.endpoint is a base URL
// and the collector appends /v1/traces for trace batches.
// Kubernetes telemetry gateway mode can also enable Loki and Prometheus
// exporters so the same collector accepts OTLP logs/metrics while the edge
// controller keeps using manager-owned ingest paths.
//
// Pipeline: receivers -> resourcedetection (light) -> resource (inject
// device_id) -> batch -> exporter. We deliberately keep tail_sampling out of
// the edge — it stays a manager-side concern so
// edges remain stateless about cross-span decisions.
const otelcolTemplate = `# Rendered by ongrid-edge traces plugin.
# DO NOT EDIT — regenerated from manager-pushed PluginConfig on every reconcile.

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: {{ .GRPCEndpoint }}
      http:
        endpoint: {{ .HTTPEndpoint }}

processors:
{{- if .K8sAttributesEnabled }}
  # Enrich gateway spans with Kubernetes resource attributes using the
  # controller ServiceAccount. Keep metadata bounded to stable ownership
  # fields; applications may still set additional resource attributes.
  k8sattributes:
    auth_type: serviceAccount
    extract:
      metadata:
        - k8s.namespace.name
        - k8s.pod.name
        - k8s.node.name
        - k8s.deployment.name
        - k8s.statefulset.name
        - k8s.daemonset.name
        - k8s.job.name
        - k8s.cronjob.name
    pod_association:
      - sources:
          - from: resource_attribute
            name: k8s.pod.ip
      - sources:
          - from: resource_attribute
            name: k8s.pod.name
          - from: resource_attribute
            name: k8s.namespace.name
      - sources:
          - from: connection

{{- end }}
  # Inject manager-owned resource attributes on every span so downstream
  # queries can filter by edge or cluster without relying on the application
  # to set them.
  resource/device:
    attributes:
      - key: deployment.environment.name
        from_attribute: deployment.environment
        action: insert
{{- if .EmitDeviceID }}
      - key: device_id
        value: "{{ .EdgeID }}"
        action: upsert
{{- end }}
      - key: ongrid_source
        value: "otlp"
        action: upsert
{{- range $k, $v := .ExtraAttrs }}
      - key: {{ $k }}
        value: {{ printf "%q" $v }}
        action: upsert
{{- end }}
{{- if .ServiceEnvironments }}
  transform/service_environment:
    error_mode: propagate
    trace_statements:
      - context: resource
        statements:
{{- range .ServiceEnvironments }}
          - {{ printf "%q" . }}
{{- end }}
    metric_statements:
      - context: resource
        statements:
{{- range .ServiceEnvironments }}
          - {{ printf "%q" . }}
{{- end }}
{{- end }}
{{- if .MetricsEnabled }}

  # gRPC's official Python plugin uses grpc.* names for the same server RED
  # histogram. Normalize only that metric; preserve its seconds and buckets.
  transform/grpc_metrics:
    error_mode: ignore
    metric_statements:
      - context: datapoint
        conditions:
          - metric.name == "grpc.server.call.duration"
        statements:
          - set(attributes["rpc.system.name"], "grpc")
          - set(attributes["rpc.method"], attributes["grpc.method"])
          - replace_pattern(attributes["rpc.method"], "^/", "")
          - set(attributes["rpc.response.status_code"], attributes["grpc.status"])
      - context: metric
        statements:
          - set(name, "rpc.server.call.duration") where name == "grpc.server.call.duration"
{{- end }}
{{- if .LogsEnabled }}

  resource/loki_labels:
    attributes:
      - key: namespace
        from_attribute: k8s.namespace.name
        action: upsert
      - key: pod
        from_attribute: k8s.pod.name
        action: upsert
      - key: node
        from_attribute: k8s.node.name
        action: upsert
      - key: loki.resource.labels
        value: "cluster_id,namespace,pod,node,ongrid_source,telemetry_gateway,gateway_namespace,service.name,service.namespace,deployment.environment.name,k8s.deployment.name,k8s.statefulset.name,k8s.daemonset.name,k8s.job.name,k8s.cronjob.name"
        action: upsert
{{- end }}

{{- if .BoundedPipelines }}
  batch/traces:
    send_batch_size: {{ .BatchSendSize }}
    timeout: 1s
    send_batch_max_size: {{ .BatchMaxSize }}
  batch/logs:
    send_batch_size: {{ .BatchSendSize }}
    timeout: 1s
    send_batch_max_size: {{ .BatchMaxSize }}
  batch/metrics:
    send_batch_size: {{ .BatchSendSize }}
    timeout: 1s
    send_batch_max_size: {{ .BatchMaxSize }}
{{- else }}
  batch:
    send_batch_size: 8192
    timeout: 5s
    send_batch_max_size: 16384
{{- end }}

exporters:
  otlphttp/manager:
    traces_endpoint: {{ .Endpoint }}
    {{- if .AuthHeader }}
    headers:
      Authorization: "{{ .AuthHeader }}"
    {{- end }}
    tls:
      # The standard install ships a self-signed manager cert
      # (deploy/install/upgrade.sh), so otelcol's default cert verification
      # fails the OTLP/HTTPS push. Skip verification by default; operators
      # who plug in a real cert can set spec.tls_insecure_skip_verify=false.
      insecure_skip_verify: {{ .TLSInsecureSkipVerify }}
      # Collector 0.157 advertises X25519MLKEM768 by default. Some deployed
      # TLS terminators black-hole that ClientHello instead of negotiating a
      # supported curve, so keep the manager trace path on interoperable X25519.
      curve_preferences: [X25519]
    compression: gzip
    timeout: 30s
    sending_queue:
      enabled: true
      num_consumers: 4
      queue_size: {{ .QueueSize }}
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 5m
{{- if .LogsEnabled }}
  otlphttp/loki_manager:
    logs_endpoint: {{ .LogsEndpoint }}
    {{- if .LogsTLSInsecureSkipVerify }}
    tls:
      insecure_skip_verify: true
    {{- end }}
    {{- if .LogsAuthHeader }}
    headers:
      Authorization: "{{ .LogsAuthHeader }}"
    {{- end }}
    {{- if .BoundedPipelines }}
    sending_queue:
      enabled: true
      num_consumers: 4
      queue_size: {{ .QueueSize }}
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 5m
    {{- end }}
{{- end }}
{{- if .MetricsEnabled }}
{{- if .MetricsRemoteWriteEnabled }}
  prometheusremotewrite/manager:
    endpoint: {{ .MetricsRemoteWriteEndpoint }}
    {{- if .MetricsAuthHeader }}
    headers:
      Authorization: "{{ .MetricsAuthHeader }}"
    {{- end }}
    {{- if or .MetricsTLSInsecure .MetricsCAFile }}
    tls:
      {{- if .MetricsTLSInsecure }}
      insecure_skip_verify: true
      {{- end }}
      {{- if .MetricsCAFile }}
      ca_file: {{ .MetricsCAFile }}
      {{- end }}
    {{- end }}
    resource_to_telemetry_conversion:
      enabled: true
    # prometheusremotewrite has its own queue implementation and rejects
    # exporterhelper's generic sending_queue key.
    remote_write_queue:
      enabled: true
      # Keep one consumer so samples for a series remain ordered.
      num_consumers: 1
      queue_size: {{ .QueueSize }}
    retry_on_failure:
      enabled: true
      initial_interval: 1s
      max_interval: 30s
      max_elapsed_time: 5m
{{- else }}
  prometheus/gateway:
    endpoint: {{ .MetricsExportEndpoint }}
    resource_to_telemetry_conversion:
      enabled: true
{{- end }}
{{- end }}

extensions:
  health_check:
    endpoint: {{ .HealthEndpoint }}

service:
  extensions: [health_check]
  telemetry:
    logs:
      level: info
    metrics:
      level: normal
      readers:
        - pull:
            exporter:
              prometheus:
                host: {{ .CollectorMetricsHost }}
                port: {{ .CollectorMetricsPort }}
                without_type_suffix: true
                without_units: true
  pipelines:
    traces:
      receivers: [otlp]
      processors: [{{ if .K8sAttributesEnabled }}k8sattributes, {{ end }}resource/device, {{ if .ServiceEnvironments }}transform/service_environment, {{ end }}{{ if .BoundedPipelines }}batch/traces{{ else }}batch{{ end }}]
      exporters: [otlphttp/manager]
{{- if .LogsEnabled }}
    logs:
      receivers: [otlp]
      processors: [{{ if .K8sAttributesEnabled }}k8sattributes, {{ end }}resource/device, resource/loki_labels, {{ if .BoundedPipelines }}batch/logs{{ else }}batch{{ end }}]
      exporters: [otlphttp/loki_manager]
{{- end }}
{{- if .MetricsEnabled }}
    metrics:
      receivers: [otlp]
      processors: [{{ if .K8sAttributesEnabled }}k8sattributes, {{ end }}resource/device, {{ if .ServiceEnvironments }}transform/service_environment, {{ end }}transform/grpc_metrics, {{ if .BoundedPipelines }}batch/metrics{{ else }}batch{{ end }}]
      exporters: [{{ if .MetricsRemoteWriteEnabled }}prometheusremotewrite/manager{{ else }}prometheus/gateway{{ end }}]
{{- end }}
`

// render builds otelcol.yaml bytes from a PluginConfig. Spec keys:
//
//	grpc_endpoint : string (default "127.0.0.1:4317")
//	http_endpoint : string (default "127.0.0.1:4318")
//	extra_attrs : map[string]string (extra resource attributes)
//	tls_insecure_skip_verify : bool (default TRUE — skip cert verification
//	                          on the OTLP/HTTPS push so the standard
//	                          self-signed manager cert works; set false
//	                          when a real cert 
```

### Core Architecture Module: `internal/edgeagent/upgrademachine/state.go`
```
// state.go 定义升级状态机的 State 类型 + 状态检测函数。
// 状态机使原先分散在 7 文件中的隐式状态（通过文件存在性 + sentinel error 推断）
// 变为显式的、可检测的、可文档化的类型。

package upgrademachine

import (
	"fmt"
	"os"
)

// State 表示升级状态机的当前状态。
type State int

const (
	// StateIdle 无升级进行中（incoming/ 不存在，无 last_upgrade_ver）。
	StateIdle State = iota

	// StatePending incoming/MANIFEST.txt 存在（bundle 已下载，等待 swap）。
	StatePending

	// StateSwapped 文件已替换（last_upgrade_ver 已写），等待健康确认。
	// 此状态通过 "last_upgrade_ver 存在但 healthy_marker 不匹配" 检测。
	StateSwapped

	// StateHealthy healthy_marker 内容匹配 last_upgrade_ver（升级成功）。
	StateHealthy

	// StateRolledBack rollback.done 存在（旧版本已恢复，等待下次升级）。
	StateRolledBack
)

// String 返回状态的人类可读名称。
func (s State) String() string {
	switch s {
	case StateIdle:
		return "idle"
	case StatePending:
		return "pending"
	case StateSwapped:
		return "swapped"
	case StateHealthy:
		return "healthy"
	case StateRolledBack:
		return "rolled_back"
	default:
		return fmt.Sprintf("unknown(%d)", int(s))
	}
}

// DetectState 根据 StageDir 下的文件状态推断当前升级状态。
// 这是一个公共观测函数，供调试、日志、测试断言使用。
// Machine 内部编排逻辑使用更细粒度的检测函数（IsPending、IsUpgradeHealthy 等）
// 而非 DetectState，因为编排需要区分具体条件（如 rollback.done vs pending 的优先级）。
// 检测优先级（互斥）：
//  1. rollback.done 存在 → StateRolledBack
//  2. incoming/MANIFEST.txt 存在 → StatePending
//  3. last_upgrade_ver 不存在 → StateIdle
//  4. healthy_marker 匹配 last_upgrade_ver → StateHealthy
//  5. last_upgrade_ver 存在但 healthy_marker 不匹配 → StateSwapped
func DetectState(stageDir string) State {
	// 1. rollback.done → 已回滚
	if _, err := os.Stat(RollbackDonePath(stageDir)); err == nil {
		return StateRolledBack
	}

	// 2. incoming/MANIFEST.txt → 有 pending
	if _, err := os.Stat(ManifestPath(stageDir)); err == nil {
		return StatePending
	}

	// 3. 无 last_upgrade_ver → 从未升级
	lastVer := readTrimmed(LastUpgradeVerPath(stageDir))
	if lastVer == "" {
		return StateIdle
	}

	// 4. healthy_marker 匹配 → 健康
	healthyVer := readTrimmed(HealthyMarkerPath(stageDir))
	if lastVer == healthyVer {
		return StateHealthy
	}

	// 5. last_upgrade_ver 存在但不匹配 → swapped（等待确认）
	return StateSwapped
}

```

### Core Architecture Module: `internal/manager/biz/aiops/chatruntime/worker.go`
```
// worker.go implements — the coordinator/worker multi-agent
// path. The Runtime owns a small in-memory map of spawned workers; each
// worker is an independent graph.Invoke against a tool-bag filtered by
// the worker agent's persona (whitelist + disallowed_tools — black wins).
//
// Each worker owns an internal work session. The root session remains owned
// by the default assistant; parent_session_id records only the immediate
// collaboration edge, while root_session_id preserves the user task chain.
// Worker-to-worker delegation is introduced only through an explicit budgeted
// policy at Resolve time, never by giving every worker an unrestricted spawn
// tool.
//
// State machine (figure):
//
//	pending — set transiently between SpawnRequest accept and goroutine
//	           start (effectively never observable for sync spawns)
//	  ↓
//	running — goroutine has begun graph.Invoke; status flips here
//	           BEFORE the child graph emits its first event
//	  ↓
//	completed — graph.Invoke returned a non-nil AssistantMessage with
//	           no error; Result holds the final assistant content
//	failed — graph.Invoke returned err != nil OR the agent name was
//	            unknown / agent registry was nil
//	killed — StopWorker called while status was running; cancel()
//	            fires and the goroutine observes ctx.Done() then sets
//	            EndedAt + status=killed (without overwriting err)
//
// Background semantics — when SpawnRequest.Background is true SpawnWorker
// returns immediately with status=running and the graph.Invoke runs in a
// detached goroutine; the goroutine emits a "task_notification" SSE
// envelope back through req.ParentEmit upon terminal status. Callers
// (AgentTool) get the worker_id from the synchronous return and can
// answer the LLM with `{task_id, status: "pending"}` while the SPA
// renders a live tile that gets updated when the notification fires.
package chatruntime

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	einocallbacks "github.com/cloudwego/eino/callbacks"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/compose"

	"github.com/ongridio/ongrid/internal/manager/biz/aiops/graph"
	"github.com/ongridio/ongrid/internal/manager/biz/aiops/graph/callbacks"
	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
	aiopsmodel "github.com/ongridio/ongrid/internal/manager/model/aiops"
	"github.com/ongridio/ongrid/internal/pkg/llm"
)

// WorkerStatus enumerates the worker state machine. See package header
// for the transition diagram.
type WorkerStatus string

const (
	// WorkerStatusPending — accepted but not yet started. Observable
	// only in tests that intercept between SpawnWorker accept and goroutine
	// scheduling; in production this state is essentially transient.
	WorkerStatusPending WorkerStatus = "pending"
	// WorkerStatusRunning — graph.Invoke is in flight.
	WorkerStatusRunning WorkerStatus = "running"
	// WorkerStatusCompleted — graph.Invoke returned a final assistant
	// message with no error.
	WorkerStatusCompleted WorkerStatus = "completed"
	// WorkerStatusFailed — graph.Invoke returned an error, or the agent
	// name was unknown.
	WorkerStatusFailed WorkerStatus = "failed"
	// WorkerStatusKilled — explicitly stopped via StopWorker.
	WorkerStatusKilled WorkerStatus = "killed"
)

// Worker tracks a spawned sub-agent. Unique by ID within a Runtime
// instance.
type Worker struct {
	// ID is "agent-<8 hex>" — unique per Runtime, stable for the
	// worker's lifetime.
	ID string
	// AgentName is the persona name (frontmatter `name` field).
	AgentName string
	// SessionID is the worker's own session id (distinct from the
	// coordinator's session). For PR-1 of this is a synthetic
	// in-memory id; the chat_sessions row + parent_session_id column
	// migration is follow-up.
	SessionID string
	// ParentSessionID is the coordinator session that requested the
	// spawn. Tracked here so a future audit query can rebuild the parent
	// → worker tree without a schema change.
	ParentSessionID string
	// Prompt is the initial user message handed to the worker.
	Prompt string
	// Status is the lifecycle state. Read-only outside the runtime;
	// callers should always pull through GetWorker for a snapshot.
	Status WorkerStatus
	// Background indicates whether this is a fire-and-forget spawn.
	Background bool
	// StartedAt is the wall time the worker entered "running".
	StartedAt time.Time
	// EndedAt is the wall time of any terminal transition. nil while
	// running.
	EndedAt *time.Time
	// Result is the worker's final assistant content (when terminal =
	// completed). Empty for failed / killed.
	Result string
	// Err is the failure reason (when terminal = failed / killed).
	Err string

	// Internal fields — not surfaced to callers via copies.
	cancel context.CancelFunc
	mu     sync.Mutex
}

// SpawnRequest describes a worker to spawn. See AgentTool.InvokableRun
// for the LLM-facing argument shape that produces this struct.
type SpawnRequest struct {
	// AgentName is the persona name (frontmatter `name`). Must be
	// resolvable through the Runtime's AgentRegistry.
	AgentName string
	// Prompt is the initial user message for the worker.
	Prompt string
	// Background = true: fire-and-forget; SpawnWorker returns immediately
	// with status=running. Background = false: SpawnWorker blocks until
	// the worker reaches a terminal state.
	Background bool
	// ParentSession is the coordinator's chat session id.
	ParentSession string
	// ParentEmit is the SSE emitter the coordinator runtime threads
	// through. Used to deliver the task_notification frame when the
	// worker (background=true) finishes. nil = no notification (sync
	// callers don't need it).
	ParentEmit Emit
	// SessionKind overrides the persisted chat_sessions.kind for the
	// worker session. Empty = "work". The investigator usecase
	// sets "investigation" so auto-spawned RCA transcripts stay out of
	// the /chat list.
	SessionKind string
	// OwnerUserID overrides the persisted chat_sessions.user_id when
	// the worker has no ParentSession to inherit from. The investigator
	// usecase passes 0 to mark these rows as "system-owned" — they
	// don't belong to any operator and the internal audience prevents
	// them from appearing in the primary chat list.
	OwnerUserID uint64
	// Locale is the UI language ("en", "zh-CN", ...) the worker's reply
	// should use. Threaded from the parent coordinator's request so a
	// sub-agent answers in the same language the user is typing in
	// (otherwise GLM defaults to zh on English questions). Empty = no
	// directive, back-compat with investigator/auto-spawned workers.
	Locale string
	// Provider + Model are the coordinator's resolved LLM choice. Threaded
	// into runWorker's g.Invoke as chatModelOpts so the sub-agent runs
	// against the same LLM the user picked for the coordinator — without
	// this, runWorker falls through to the RoutingChatModel default and
	// installs without an OpenAI key see specialists fail with
	// `provider "openai" not configured`. Empty = no override; the worker
	// uses whatever the routing default is.
	Provider string
	Model    string
}

// TaskNotification is the payload of a task_notification streaming
// frame. Mirrors the schema laid out in — coordinator's
// SSE listener fans this back through the legacy SSE envelope so the
// SPA only needs to learn one new event type.
type TaskNotification struct {
	TaskID  string         `json:"task_id"`
	Status  WorkerStatus   `json:"status"`
	Summary string         `json:"summary"`
	Result  string         `json:"result,omitempty"`
	Err     string         `json:"error,omitempty"`
	Usage   map[string]any `json:"usage,omitempty"`
}

// EventTaskNotification is the new streaming event type the runtime
// emits when a background worker reaches a terminal state. The SPA
// listens for this in addition to the existing assistant / tool /
// done frames.
const EventTaskNotification EventType = "task_notification"

// EventApprovalPending fires when a synchronous-blocking tool (HLD-021,
// e.g. cloud_bash) has queued a human-approval proposal and is about to
// block waiting for the decision. The frame surfaces the inline approve/
// reject card LIVE — the tool no longer returns a pending_approval result
// blob (it blocks, then returns the real executor result), so the card
// must be driven by this frame instead. ToolCallID ties the card to the
// tool call's existing streaming card so the UI shows a single card.
const EventApprovalPending EventType = "approval_pending"

// ApprovalPending is the EventApprovalPending payload. Emitted by the
// proposer shim (cmd/main.go) via EmitFromContext while a blocking tool
// awaits the human decision.
type ApprovalPending struct {
	ApprovalID  string
	ToolCallID  string
	Kind        string
	ToolName    string
	Command     string
	Credentials []string
}

// emitCtxKey is the unexported context key that threads the active
// per-request Emit through the graph layer down into AgentTool's
// InvokableRun via the WorkerSpawner shim. The shim reads it through
// EmitFromContext to populate SpawnRequest.ParentEmit so a background
// worker can fire its task_notification through the SSE channel that
// owns the user's chat session.
type emitCtxKeyT struct{}

var emitCtxKey = emitCtxKeyT{}

// withEmit returns ctx augmented with emit. Internal — Handle threads
// the request emitter in before invoking the graph.
func withEmit(ctx context.Context, emit Emit) context.Context {
	if emit == nil {
		return ctx
	}
	return context.WithValue(ctx, emitCtxKey, emit)
}

// EmitFromContext retrieves the active streaming Emit from ctx, if any.
// Returns nil when no emitter was attached (e.g. blocking call without
// SSE). The wiring shim at the cmd/main.go boundary uses this to thread
// task_notification frames through the same SSE channel that owns the
// coordinator's chat sessio
```

### Core Architecture Module: `internal/manager/biz/flow/engine.go`
```
// engine.go — the DAG executor. Deterministic skeleton, probabilistic
// node interiors (HLD-016): the engine itself never asks an LLM
// anything; only agent-node interiors are non-deterministic.
//
// Scheduling semantics (MVP):
//   - execution starts at every trigger node;
//   - when a node finishes it fires ONE control port; every edge on
//     that port activates its target (fan-out runs branches
//     concurrently, capped);
//   - OR-join + execute-once: a node runs the first time any incoming
//     edge fires, later activations are no-ops. No parallel-join /
//     merge node yet (P2).
//   - a node error fires its "error" port if connected, otherwise the
//     run fails (other in-flight branches finish, then the run is
//     marked failed).
package flow

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	model "github.com/ongridio/ongrid/internal/manager/model/flow"
	"github.com/ongridio/ongrid/internal/pkg/tracing"
)

// maxConcurrentNodes caps fan-out so a wide graph can't spawn an
// unbounded number of agent workers at once.
const maxConcurrentNodes = 4

var flowTracer = otel.Tracer("github.com/ongridio/ongrid/internal/manager/biz/flow")

// Engine executes a parsed graph against a run row.
type Engine struct {
	exec Executors
	runs RunRepo
	log  *slog.Logger
}

// NewEngine wires the executor seams + run persistence.
func NewEngine(exec Executors, runs RunRepo, log *slog.Logger) *Engine {
	if log == nil {
		log = slog.Default()
	}
	return &Engine{exec: exec, runs: runs, log: log}
}

type runState struct {
	mu       sync.Mutex
	rc       *RunContext
	executed map[string]bool
	failed   bool
	firstErr error
	wg       sync.WaitGroup
	sem      chan struct{}
}

// Execute runs the graph to completion and returns the terminal run
// status. It is synchronous — the usecase calls it from a goroutine.
//
// entryType scopes which trigger nodes start the run: "" starts every
// trigger (legacy manual behaviour), a specific type (e.g.
// trigger.alert_fired) starts only matching triggers so a flow with both
// a manual and an alert trigger doesn't double-fire the manual branch on
// an alert.
func (e *Engine) Execute(ctx context.Context, run *model.FlowRun, g *Graph, entryType string) (status string, runErr error) {
	ctx, span := flowTracer.Start(ctx, "flow.Engine.Execute",
		trace.WithAttributes(attribute.String("flow.entry_type", entryTypeLabel(entryType))),
	)
	defer func() {
		span.SetAttributes(attribute.String("flow.status", status))
		tracing.EndSpan(span, runErr)
	}()
	defer func() {
		if r := recover(); r != nil {
			status = model.RunStatusFailed
			runErr = fmt.Errorf("engine panic: %v", r)
			e.log.Error("flow engine panic", slog.String("run_id", run.ID), slog.Any("panic", r), slog.String("stack", string(debug.Stack())))
		}
	}()

	all := g.Triggers()
	triggers := all[:0:0]
	for _, t := range all {
		if entryType == "" || t.Type == entryType {
			triggers = append(triggers, t)
		}
	}
	if len(triggers) == 0 {
		return model.RunStatusFailed, fmt.Errorf("graph has no %s trigger node", entryTypeLabel(entryType))
	}

	var trigger map[string]any
	if run.TriggerJSON != "" {
		_ = json.Unmarshal([]byte(run.TriggerJSON), &trigger)
	}
	st := &runState{
		rc:       &RunContext{Trigger: trigger, Nodes: map[string]any{}, Vars: map[string]any{}},
		executed: map[string]bool{},
		sem:      make(chan struct{}, maxConcurrentNodes),
	}

	byID := make(map[string]GraphNode, len(g.Nodes))
	for _, n := range g.Nodes {
		byID[n.ID] = n
	}

	for _, t := range triggers {
		e.activate(ctx, run, g, byID, st, t.ID)
	}
	st.wg.Wait()

	st.mu.Lock()
	defer st.mu.Unlock()
	if st.failed {
		return model.RunStatusFailed, st.firstErr
	}
	return model.RunStatusSucceeded, nil
}

// activate schedules node id if it hasn't executed yet.
func (e *Engine) activate(ctx context.Context, run *model.FlowRun, g *Graph, byID map[string]GraphNode, st *runState, id string) {
	st.mu.Lock()
	// Execute-once OR-join; after a run-level failure no NEW nodes
	// start (handled error-port branches never set failed, so their
	// handlers activate normally).
	if st.executed[id] || st.failed {
		st.mu.Unlock()
		return
	}
	st.executed[id] = true
	st.mu.Unlock()

	node, ok := byID[id]
	if !ok {
		return
	}
	st.wg.Add(1)
	go func() {
		defer st.wg.Done()
		// Per-goroutine recover: the Execute-level recover only guards the
		// main goroutine (trigger activation + wg.Wait); a panic in THIS
		// fan-out goroutine would otherwise crash the whole manager
		// process. Mark the run failed and let in-flight branches drain.
		defer func() {
			if r := recover(); r != nil {
				e.log.Error("flow node panic",
					slog.String("run_id", run.ID),
					slog.String("node_id", node.ID),
					slog.String("node_type", node.Type),
					slog.Any("panic", r),
					slog.String("stack", string(debug.Stack())))
				st.mu.Lock()
				if !st.failed {
					st.failed = true
					st.firstErr = fmt.Errorf("node %s (%s) panic: %v", node.ID, node.Type, r)
				}
				st.mu.Unlock()
			}
		}()
		st.sem <- struct{}{}
		defer func() { <-st.sem }()
		e.runNode(ctx, run, g, byID, st, node)
	}()
}

// runNode resolves config, executes, persists the FlowRunNode row, and
// fires the resulting control port.
func (e *Engine) runNode(ctx context.Context, run *model.FlowRun, g *Graph, byID map[string]GraphNode, st *runState, node GraphNode) {
	ctx, span := flowTracer.Start(ctx, "flow.Node."+node.Type,
		trace.WithAttributes(attribute.String("flow.node.type", node.Type)),
	)
	var execErr error
	defer func() { tracing.EndSpan(span, execErr) }()
	started := time.Now().UTC()
	row := &model.FlowRunNode{
		RunID:    run.ID,
		NodeID:   node.ID,
		NodeType: node.Type,
		NodeName: node.Name,
		Status:   model.NodeStatusRunning,
		// TEXT NOT NULL columns — always supply a value.
		InputJSON:  "{}",
		OutputJSON: "{}",
		StartedAt:  &started,
	}

	// Resolve config templates under the lock (context reads), execute
	// outside it (slow: agents/tools).
	var cfg map[string]any
	var resolveErr error
	st.mu.Lock()
	if len(node.Config) > 0 {
		var raw map[string]any
		if err := json.Unmarshal(node.Config, &raw); err != nil {
			resolveErr = fmt.Errorf("node %s: config: %w", node.ID, err)
		} else if resolved, err := st.rc.ResolveValue(raw); err != nil {
			resolveErr = fmt.Errorf("node %s: %w", node.ID, err)
		} else {
			cfg, _ = resolved.(map[string]any)
		}
	}
	rcSnapshot := st.rc
	st.mu.Unlock()
	if cfg == nil {
		cfg = map[string]any{}
	}
	if b, err := json.Marshal(cfg); err == nil {
		row.InputJSON = string(b)
	}
	if e.runs != nil {
		_ = e.runs.CreateNode(ctx, row)
	}

	var res NodeResult
	if resolveErr != nil {
		execErr = resolveErr
	} else {
		res, execErr = e.exec.execute(ctx, node, cfg, rcSnapshot)
	}

	finished := time.Now().UTC()
	row.FinishedAt = &finished
	if execErr != nil {
		row.Status = model.NodeStatusFailed
		row.Error = truncate(execErr.Error(), 2000)
		row.FiredPort = PortError
	} else {
		row.Status = model.NodeStatusSucceeded
		row.FiredPort = res.Port
		st.mu.Lock()
		st.rc.Nodes[node.ID] = res.Output
		// Var writes (set node) are applied here under the lock — executors
		// run outside it, so this is the ONLY place rc.Vars is mutated.
		for k, v := range res.Vars {
			st.rc.Vars[k] = v
		}
		st.mu.Unlock()
		if b, err := json.Marshal(res.Output); err == nil {
			row.OutputJSON = string(b)
		}
	}
	if e.runs != nil {
		_ = e.runs.UpdateNode(ctx, row)
	}

	if execErr != nil {
		targets := g.EdgesFrom(node.ID, PortError)
		if len(targets) == 0 {
			st.mu.Lock()
			if !st.failed {
				st.failed = true
				st.firstErr = fmt.Errorf("node %s (%s): %w", node.ID, node.Type, execErr)
			}
			st.mu.Unlock()
			return
		}
		// Handled error: expose it to the handler branch then continue.
		st.mu.Lock()
		st.rc.Nodes[node.ID] = map[string]any{"error": execErr.Error()}
		st.mu.Unlock()
		for _, t := range targets {
			e.activate(ctx, run, g, byID, st, t)
		}
		return
	}
	for _, t := range g.EdgesFrom(node.ID, res.Port) {
		e.activate(ctx, run, g, byID, st, t)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// entryTypeLabel renders entryType for error messages ("any" when empty).
func entryTypeLabel(t string) string {
	if t == "" {
		return "any"
	}
	return t
}

// RunSingle executes ONE node in isolation (the node-level "test run" the
// editor uses to surface a node's real output before it's wired into the
// flow). It resolves the node's config against rc, runs the executor, and
// returns the result — no persistence, no edge traversal.
func (e *Engine) RunSingle(ctx context.Context, node GraphNode, rc *RunContext) (result NodeResult, retErr error) {
	ctx, span := flowTracer.Start(ctx, "flow.Node."+node.Type,
		trace.WithAttributes(attribute.String("flow.node.type", node.Type)),
	)
	defer func() { tracing.EndSpan(span, retErr) }()
	var cfg map[string]any
	if len(node.Config) > 0 {
		var raw map[string]any
		if err := json.Unmarshal(node.Config, &raw); err != nil {
			return NodeResult{}, fmt.Errorf("config: %w", err)
		}
		resolved, err := rc.ResolveValue(raw)
		if err != nil {
			return NodeResult{}, err
		}
		cfg, _ = resolved.(map[string]any)
	}
	if cfg == nil {
		cfg = map[string]any{}
	}
	return e.exec.execute(ctx, node, cfg, rc)
}

```

### Core Architecture Module: `internal/pkg/notify/webhook.go`
```
package notify

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type webhookSender struct {
	name       string
	endpoint   string
	secret     string
	client     *http.Client
	buildBody  func(Message) (any, error)
	signTarget func(endpoint, secret string, body []byte) (string, map[string]string, error)
}

// NewGenericWebhookSender posts the normalized Message JSON. When secret is
// configured it adds an HMAC signature header over the request body.
func NewGenericWebhookSender(name, endpoint, secret string, client *http.Client) Sender {
	return newWebhookSender(name, endpoint, secret, client, func(msg Message) (any, error) {
		return msg, nil
	}, signGenericWebhook)
}

// NewSlackSender posts to a Slack incoming webhook in the attachments
// format so the alert renders with severity-tinted color bar + structured
// fields (Severity / Source / Rule / Incident / Device / Dedupe) instead
// of an unstyled paragraph. Slack incoming webhooks ignore any secret —
// the credential is the URL itself — so the secret field is silently
// dropped at the channel-builder layer.
func NewSlackSender(name, endpoint string, client *http.Client) Sender {
	return newWebhookSender(name, endpoint, "", client, func(msg Message) (any, error) {
		return formatSlack(msg), nil
	}, nil)
}

// formatSlack renders one Message as a Slack incoming-webhook payload using
// the attachments format. We pick attachments over Block Kit because:
//   - it carries the colored side-bar that operators read as "how bad",
//   - it's the universally-supported format (Block Kit needs newer apps),
//   - the schema is JSON-flat and easy to test.
//
// "text" at the top stays populated with a one-line summary so Slack's own
// notification preview (push, sidebar, email digest) shows something useful
// even when the recipient client strips attachments.
func formatSlack(msg Message) map[string]any {
	sevUpper := strings.ToUpper(string(msg.Severity))
	if sevUpper == "" {
		sevUpper = "ALERT"
	}
	summary := fmt.Sprintf("[%s] %s", sevUpper, msg.Subject)

	att := map[string]any{
		"color":    slackColor(msg.Severity),
		"fallback": summary,
		"title":    nonEmpty(msg.Subject, sevUpper),
	}
	if msg.Body != "" {
		att["text"] = msg.Body
		att["mrkdwn_in"] = []string{"text"}
	}

	fields := make([]map[string]any, 0, 6)
	addField := func(title, value string, short bool) {
		if value == "" {
			return
		}
		fields = append(fields, map[string]any{
			"title": title,
			"value": value,
			"short": short,
		})
	}
	addField("Severity", sevUpper, true)
	addField("Source", msg.Source, true)
	if msg.Labels != nil {
		// Surface the alert-pipeline labels operators care about as
		// short fields; the remaining labels stay out of the message
		// to keep the card readable. Rule/incident/device are the same
		// breakdown the incident detail page leads with.
		addField("Rule", msg.Labels["rule"], true)
		if id := msg.Labels["incident_id"]; id != "" {
			addField("Incident", "#"+id, true)
		}
		if did := msg.Labels["device_id"]; did != "" {
			addField("Device", "#"+did, true)
		}
	}
	// Dedupe key is the join key for ops chatter — keep full width so
	// long pipeline:rule:label-set strings stay readable.
	addField("Dedupe key", msg.DedupeKey, false)
	if len(fields) > 0 {
		att["fields"] = fields
	}

	att["footer"] = "ongrid"
	if !msg.OccurredAt.IsZero() {
		att["ts"] = msg.OccurredAt.Unix()
	}

	return map[string]any{
		"text":        summary,
		"attachments": []any{att},
	}
}

// slackColor maps a Severity onto the Slack attachment color rail. Critical
// uses the red the Slack sentinel "danger" resolves to but as a hex so we
// pin the shade across Slack client versions; same idea for warning.
// Unknown severities get a neutral slate so the rail still renders.
func slackColor(sev Severity) string {
	switch sev {
	case SeverityCritical:
		return "#d92f2f"
	case SeverityWarning:
		return "#f2c037"
	case SeverityInfo:
		return "#36a64f"
	default:
		return "#6f7a87"
	}
}

func nonEmpty(v, fallback string) string {
	if v != "" {
		return v
	}
	return fallback
}

// NewFeishuSender posts a text payload compatible with Feishu/Lark custom bots.
func NewFeishuSender(name, endpoint, secret string, client *http.Client) Sender {
	return newWebhookSender(name, endpoint, secret, client, func(msg Message) (any, error) {
		payload := map[string]any{
			"msg_type": "text",
			"content":  map[string]string{"text": formatText(msg)},
		}
		if secret != "" {
			ts := fmt.Sprintf("%d", time.Now().Unix())
			payload["timestamp"] = ts
			payload["sign"] = signFeishu(ts, secret)
		}
		return payload, nil
	}, nil)
}

// NewDingTalkSender posts a text payload compatible with DingTalk custom bots.
func NewDingTalkSender(name, endpoint, secret string, client *http.Client) Sender {
	return newWebhookSender(name, endpoint, secret, client, func(msg Message) (any, error) {
		return map[string]any{
			"msgtype": "text",
			"text":    map[string]string{"content": formatText(msg)},
		}, nil
	}, signDingTalkURL)
}

// NewWeComSender posts a text payload compatible with 企业微信 (WeCom) group
// bots. Endpoint URL carries the bot key as a query param; the v1 wiring
// has no extra signing — the secret query string IS the credential. Same
// JSON shape as DingTalk: {"msgtype":"text","text":{"content":"..."}}.
func NewWeComSender(name, endpoint string, client *http.Client) Sender {
	return newWebhookSender(name, endpoint, "", client, func(msg Message) (any, error) {
		return map[string]any{
			"msgtype": "text",
			"text":    map[string]string{"content": formatText(msg)},
		}, nil
	}, nil)
}

// NewTelegramSender posts to the Telegram Bot API sendMessage endpoint.
// endpoint is the full https://api.telegram.org/bot<TOKEN>/sendMessage URL
// (bot token in the path); chatID is the target chat, sent in the JSON
// body. Telegram's auth model differs from the webhook channels — token in
// the URL, chat_id in the body — so it doesn't use the secret/signing path.
func NewTelegramSender(name, endpoint, chatID string, client *http.Client) Sender {
	return newWebhookSender(name, endpoint, "", client, func(msg Message) (any, error) {
		return map[string]any{
			"chat_id": chatID,
			"text":    formatText(msg),
		}, nil
	}, nil)
}

func newWebhookSender(
	name string,
	endpoint string,
	secret string,
	client *http.Client,
	buildBody func(Message) (any, error),
	signTarget func(endpoint, secret string, body []byte) (string, map[string]string, error),
) Sender {
	if name == "" {
		name = "webhook"
	}
	if client == nil {
		client = http.DefaultClient
	}
	return &webhookSender{
		name:       name,
		endpoint:   endpoint,
		secret:     secret,
		client:     client,
		buildBody:  buildBody,
		signTarget: signTarget,
	}
}

func (s *webhookSender) Name() string { return s.name }

func (s *webhookSender) Send(ctx context.Context, msg Message) error {
	if s.endpoint == "" {
		return fmt.Errorf("endpoint required")
	}
	payload, err := s.buildBody(msg)
	if err != nil {
		return fmt.Errorf("build payload: %w", err)
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	endpoint := s.endpoint
	headers := map[string]string{}
	if s.signTarget != nil {
		endpoint, headers, err = s.signTarget(s.endpoint, s.secret, body)
		if err != nil {
			return fmt.Errorf("sign request: %w", err)
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "ongrid-notify/1.0")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}
	return nil
}

func formatText(msg Message) string {
	parts := []string{fmt.Sprintf("[%s] %s", strings.ToUpper(string(msg.Severity)), msg.Subject)}
	if msg.Body != "" {
		parts = append(parts, msg.Body)
	}
	if msg.Source != "" {
		parts = append(parts, "source: "+msg.Source)
	}
	if msg.DedupeKey != "" {
		parts = append(parts, "dedupe: "+msg.DedupeKey)
	}
	return strings.Join(parts, "\n")
}

func signGenericWebhook(endpoint string, secret string, body []byte) (string, map[string]string, error) {
	headers := map[string]string{}
	if secret == "" {
		return endpoint, headers, nil
	}
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write(body); err != nil {
		return "", nil, err
	}
	headers["X-Ongrid-Signature"] = "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return endpoint, headers, nil
}

func signFeishu(timestamp, secret string) string {
	stringToSign := timestamp + "\n" + secret
	mac := hmac.New(sha256.New, []byte(stringToSign))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func signDingTalkURL(endpoint, secret string, _ []byte) (string, map[string]string, error) {
	if secret == "" {
		return endpoint, nil, nil
	}
	ts := fmt.Sprintf("%d", time.Now().UnixMilli())
	stringToSign := ts + "\n" + secret
	mac := hmac.New(sha256.New, []byte(secret))
	if _, err := mac.Write([]byte(stringToSign)); err != nil {
		return "", nil, err
	}
	sign := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", nil, err
	}
	q := u.Query()
	q.Set("timestamp", ts)
	q.Set("sign", sign)
	u.RawQuery = q.Encode()
	return u.String(), nil, nil
}

```

### Core Architecture Module: `web/src/components/ui/EmptyState.tsx`
```
import type { ReactNode } from 'react';
import type { IconType } from '@/lib/icon';

// EmptyState — vertical centered icon + message + optional CTA. Used in
// every list page that can be empty (Knowledge / Agents / AlertRules /
// Logs / IncidentDetail).
type Props = {
  icon?: IconType;
  title: string;
  hint?: string;
  /** Renders below the title; pass a button or link styled consistently
   *  with the rest of the page (typically the accent button). */
  action?: ReactNode;
  /** Override the default min-height (h-60) for cramped contexts. */
  className?: string;
};

export function EmptyState({ icon: Icon, title, hint, action, className }: Props) {
  return (
    <div
      className={
        className ??
        'flex h-60 flex-col items-center justify-center gap-2 text-center'
      }
    >
      {Icon && <Icon size={28} className="text-zinc-600" />}
      <div className="text-sm text-zinc-500">{title}</div>
      {hint && <div className="text-xs text-zinc-600">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

```

### Core Architecture Module: `web/src/pages/kubernetes/KubernetesLifecycleModals.tsx`
```
import { useEffect, useState } from 'react';
import { Check, Clipboard, Trash2 } from 'lucide-react';

import type { KubernetesCluster } from '@/api/kubernetes';
import { Modal } from '@/components/Modal';
import { Button, Chip } from '@/components/ui';
import { useI18n } from '@/i18n/locale';
import { cn } from '@/lib/cn';
import {
  isKubernetesClusterRecentlyActive,
  kubernetesUninstallCommand,
  kubernetesUpgradeCommand,
} from './model';

function ClusterIdentity({ cluster }: { cluster: KubernetesCluster }) {
  const { tr } = useI18n();
  const statusTone = cluster.status === 'online'
    ? 'success'
    : cluster.status === 'degraded'
      ? 'warning'
      : cluster.status === 'offline'
        ? 'default'
        : 'info';
  return (
    <>
      <span className="text-zinc-500">{tr('集群', 'Cluster')}</span>
      <Chip tone="accent">{cluster.name}</Chip>
      <Chip tone="accent">{cluster.mode || 'full-node'}</Chip>
      <Chip tone={statusTone}>{cluster.status || 'unknown'}</Chip>
    </>
  );
}

function useCopyCommand(command: string) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
  }, [command]);
  async function copy() {
    await navigator.clipboard?.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return { copied, copy };
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  const { tr } = useI18n();
  const { copied, copy } = useCopyCommand(command);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-zinc-500">
        <span>{label}</span>
        <Button onClick={() => void copy()}>
          {copied ? <Check size={12} /> : <Clipboard size={12} />}
          {copied ? tr('已复制', 'Copied') : tr('复制', 'Copy')}
        </Button>
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-300">
        {command}
      </pre>
    </div>
  );
}

export function UninstallCommandModal({
  cluster,
  onClose,
}: {
  cluster: KubernetesCluster | null;
  onClose(): void;
}) {
  const { tr } = useI18n();
  if (!cluster) return null;
  return (
    <Modal open onClose={onClose} title={tr('Helm 卸载命令', 'Helm uninstall command')} size="lg">
      <div className="space-y-3 text-xs">
        <ClusterIdentity cluster={cluster} />
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-amber-200">
          {tr(
            '先在目标 Kubernetes 集群执行卸载命令，确认资源清理后再删除 Ongrid 侧集群记录。',
            'Run the uninstall command in the target Kubernetes cluster before deleting the Ongrid cluster record.',
          )}
        </div>
        <CommandBlock label={tr('卸载命令', 'Uninstall command')} command={kubernetesUninstallCommand(cluster)} />
      </div>
    </Modal>
  );
}

export function UpgradeCommandModal({
  cluster,
  onClose,
}: {
  cluster: KubernetesCluster | null;
  onClose(): void;
}) {
  const { tr } = useI18n();
  if (!cluster) return null;
  return (
    <Modal open onClose={onClose} title={tr('一键 Helm 升级', 'One-command Helm upgrade')} size="lg">
      <div className="space-y-3 text-xs">
        <ClusterIdentity cluster={cluster} />
        <div className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-1.5 text-sky-200">
          {tr(
            '在目标 Kubernetes 集群执行这一条命令即可（需要 Helm 3.14+）。Chart 会先采用新版默认值、再合并现有自定义 values，自动完成必要的数据面迁移和健康检查；失败时自动回滚。仅更新镜像的版本不会重复执行迁移。',
            'Run this single command in the target Kubernetes cluster (Helm 3.14+ required). The chart starts from the new defaults, reapplies existing custom values, performs any required data-plane migration and health checks, and rolls back automatically on failure. Image-only upgrades do not repeat completed migrations.',
          )}
        </div>
        <CommandBlock label={tr('升级命令', 'Upgrade command')} command={kubernetesUpgradeCommand(cluster)} />
      </div>
    </Modal>
  );
}

export function DeleteClusterModal({
  cluster,
  deleting,
  onClose,
  onDelete,
}: {
  cluster: KubernetesCluster | null;
  deleting: boolean;
  onClose(): void;
  onDelete(cluster: KubernetesCluster): void;
}) {
  const { tr } = useI18n();
  if (!cluster) return null;
  const active = isKubernetesClusterRecentlyActive(cluster);

  return (
    <Modal
      open
      onClose={onClose}
      title={tr(`删除 Kubernetes 集群 ${cluster.name}`, `Delete Kubernetes cluster ${cluster.name}`)}
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={deleting}>{tr('取消', 'Cancel')}</Button>
          <Button variant="danger" onClick={() => onDelete(cluster)} disabled={deleting}>
            <Trash2 size={12} />
            {deleting
              ? tr('删除中…', 'Deleting…')
              : active
                ? tr('确认已卸载，删除记录', 'Confirm uninstalled, delete record')
                : tr('确认删除', 'Delete')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <ClusterIdentity cluster={cluster} />
          <Chip tone={active ? 'warning' : 'default'}>
            {active ? tr('仍在上报', 'active') : tr('离线或陈旧', 'offline/stale')}
          </Chip>
        </div>
        <div className={cn(
          'rounded-md border px-3 py-2 leading-5',
          active
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
            : 'border-zinc-800 bg-zinc-950/40 text-zinc-400',
        )}>
          {active
            ? tr(
                '该集群仍在线或最近有上报。建议先在目标 Kubernetes 集群执行卸载命令，否则集群内 controller / node edge 会继续运行并反复重试上报。',
                'This cluster is online or recently reported. Run the uninstall command in the target Kubernetes cluster first, otherwise the controller / node edge will keep running and retrying reports.',
              )
            : tr(
                '该集群当前离线或同步时间已陈旧，可以删除 Ongrid 侧记录；如果目标集群仍存在，建议先执行卸载命令清理组件。',
                'This cluster is offline or stale, so deleting the Ongrid record is allowed. If the target cluster still exists, run the uninstall command first to clean up components.',
              )}
        </div>
        <CommandBlock label={tr('卸载命令', 'Uninstall command')} command={kubernetesUninstallCommand(cluster)} />
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 leading-5 text-red-200">
          {tr(
            '删除记录会移除 Ongrid 侧集群、快照、接入 token 和拓扑镜像；它不会自动进入目标 Kubernetes 集群卸载 Helm release。',
            'Deleting the record removes the Ongrid cluster, snapshots, enrollment token, and topology mirror. It does not uninstall the Helm release from the target Kubernetes cluster.',
          )}
        </div>
      </div>
    </Modal>
  );
}

```

### Core Architecture Module: `cmd/ongrid-edge-supervisor/env_windows.go`
```
// env_windows.go — read the service Environment registry field directly.
// Companion to mergedServiceEnv in worker.go: Windows SCM's promise of
// "service Environment field = process env" leaks under fork/exec of a
// different binary (supervisor.exe spawning worker.exe). Reading the
// field from the registry bypasses the SCM corner case and feeds the
// pairs into exec.Cmd.Env explicitly.

//go:build windows

package main

import (
	"golang.org/x/sys/windows/registry"
)

// serviceRegKeyPath is the HKLM path to the ongrid-edge service entry.
// Kept in sync with install_windows.go; duplicate literal avoids a
// shared const across the install / worker split.
const envRegKeyPath = `SYSTEM\CurrentControlSet\Services\` + serviceName

// readServiceEnvField reads the service Environment multi-string value
// from the registry. Returns the raw pairs (each "KEY=VALUE"), or an
// empty slice + error if the field is absent / unreadable. Callers
// should treat any error as "fall back to os.Environ" — this is a
// best-effort correctness path, not a hard requirement.
func readServiceEnvField() ([]string, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, envRegKeyPath, registry.QUERY_VALUE|registry.READ)
	if err != nil {
		return nil, err
	}
	defer k.Close()
	values, _, err := k.GetStringsValue("Environment")
	if err != nil {
		return nil, err
	}
	return values, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #410** (2026-09-23): **bug(flow): trigger.alert_fired never matches — dispatcher receives RuleName but flow authors write rule_key into trigger config**
  *Symptoms*: ## Summary  Flows with a `trigger.alert_fired` node **never execute** when the trigger's `rule` config contains the alert rule's `rule_key` — which is what the UI and every natural integration uses. The dispatcher matches the filter against `incident.RuleName` (the human-friendly display name) instead of the machine key, and the case-insensitive substring match never succeeds.  ## Reproduction (v0.11.0)  1. Create a metric alert rule with `rule_key: redis_down_john` and display name `Redis Down (John)` 2. Create a flow with `trigger.alert_fired` node config `{"rule": "redis_down_john", "min_severity": "critical"}` 3. Force the alert to fire  **Result:** incident is created and notified correctly, but the flow never runs (0 rows in `flow_runs`).  Controlled test (2026-09-10): rule that always fires + flow via API → **35 incidents → 0 runs**.  ## Root cause  `internal/manager/biz/alert/usecase.go` (~line 469) fans out with the display name:  ```go u.workflowDispatcher.OnAlertFired(incident.ID, incident.RuleName, incident.Severity, ...) ```  `internal/manager/biz/flow/dispatcher.go` (`alertMatches`, ~line 97):  ```go if want := strings.TrimSpace(cfg.Rule); want != "" {     if !strings.Contains(strings.ToLower(rule), strings.ToLower(want)) {         return false // RuleName="redis down (john)" never contains "redis_down_john"     } } ```  Detection and notification paths are unaffected — only the alert→workflow fan-out silently drops everything. A secondary confusion factor: `ale

- **Issue #400** (2026-09-10): **bug(llm): DeepSeek thinking-mode tool calls fail with 400 because reasoning_content is dropped**
  *Symptoms*: ## Summary  DeepSeek thinking-mode conversations can fail immediately after a successful tool execution because Ongrid drops the assistant's `reasoning_content` when converting messages. The field is also absent from persisted chat history, so preserving only the in-memory tool loop would not fix subsequent turns.  ## Environment and verification scope  - Observed in a downstream deployment based on Ongrid v0.15.2. - Model: `deepseek/deepseek-v4-flash` through a LiteLLM OpenAI-compatible endpoint, with thinking mode and tools enabled. - Independently inspected upstream tag `v0.15.2` and current main commit `f958b93918236a789a92b206a616258fad2c9ef8`: both contain the same field omissions described below. A clean upstream deployment was not separately run; the live reproduction and fix validation were performed downstream.  ## Reproduction  1. Configure the above model/provider with thinking mode enabled. 2. Start a chat with a harmless tool available (for example, a tool returning a constant value). Ask the assistant to use it and report the result. 3. The model returns an assistant message containing `reasoning_content` and `tool_calls`. 4. Allow the tool to finish successfully. 5. Ongrid sends the next completion request with the assistant tool-call message and matching tool response, but without the assistant's original `reasoning_content`. The provider rejects it with HTTP 400.  Sanitized provider error:  ```text DeepseekException: {"error":{"message":"The `reasoning_conte
  **Post-Mortem & Fix Analysis**:
  > 感谢发现并详细排查这个问题，也感谢提供完整的复现步骤和验证结果！看到你已经在下游完成了修复，欢迎整理并提交一个修复 PR，我们很乐意一起 review。感谢贡献！ 

- **Issue #377** (2026-09-04): **fix(web): 修复浅色模式下抓包统计区和执行日志深色残留**
  *Symptoms*: ## 问题  在浅色模式下存在两处明显的主题残留：  1. 抓包会话详情页顶部统计区仍显示为深色背景，文字对比度异常。 2. 工具页抓包任务的执行日志仍固定使用深色 xterm 主题，与页面浅色主题不一致。  ## 原因初判  - 抓包统计项使用 `bg-zinc-900/90`，全局 light-mode 映射未覆盖 `/90` 透明度变体。 - `XTerminal` 使用固定深色 `ITheme`，未读取当前主题。  ## 期望  - 抓包会话统计区在 light/dark 模式下均符合现有 Card 视觉规范。 - 只读执行日志跟随当前主题，同时保持 ANSI 状态色的可读性。 - 不影响 WebSSH 等交互式终端的现有行为。  ## 验证  - 相关单元测试通过。 - 对抓包会话详情和工具执行日志分别进行 light/dark 截图验证。

- **Issue #369** (2026-09-03): **切换聊天会话后串流状态泄漏 (Chat streaming state leaks between sessions)**
  *Symptoms*: ## Bug Description  会话 A 正在生成回复时切换到会话 B，B 仍会显示 A 的“正在分析”和 Esc 停止提示。A 后续返回的 SSE 消息或工具卡也可能显示在 B 中。  ## Steps to Reproduce  1. 在会话 A 中发送消息并等待串流回复 2. 回复完成前切换到历史会话 B 3. 观察会话 B 的状态  ## Expected Behavior  会话 B 只显示自己的状态和消息，不受会话 A 的串流事件影响。  ## Actual Behavior  会话 A 的分析状态和后续事件可能泄漏到会话 B。  ## Environment  - Ongrid: v0.14.1 - Deployment: Docker   我已经在本地完成修复，可以提交一个仅包含该问题修复的 PR

- **Issue #357** (2026-09-20): **Kubernetes topology registration fails when device names differ only by case**
  *Symptoms*: ## Environment  - Kubernetes deployment with both a host-level Edge and a Kubernetes Node Edge on the same host - Observed on a v0.13.4-derived Kubernetes deployment  ## Reproduction  1. Run a regular host Edge and a Kubernetes Node Edge on the same machine. 2. Let the host Edge report a hostname such as `VM-0-6-ubuntu`. 3. Let the Kubernetes API report the node name as `vm-0-6-ubuntu`. 4. Complete enrollment and establish the Node tunnel. 5. Let `register_edge` trigger Kubernetes topology reconciliation.  ## Expected behavior  The regular Edge device and the Kubernetes Node device have different stable fingerprints/device IDs, so they should receive separate topology nodes. Repeated registration should be idempotent.  ## Actual behavior  Enrollment succeeds and the Pods remain running, but `register_edge` and periodic topology reconciliation repeatedly fail with:  ```text UNIQUE constraint failed: devices.node_id, devices.delete_marker ```  The topology node is selected by case-insensitive device name, so `VM-0-6-ubuntu` and `vm-0-6-ubuntu` are treated as the same topology node even when they represent different device records. The second device then attempts to reuse a node already linked by the first device.  ## Impact  Kubernetes enrollment appears successful, but Node registration keeps retrying and the Kubernetes device membership is missing or incomplete in the topology graph.  ## Suspected root cause  `EnsureNodeForDevice` matches existing device topology nodes by cas

- **Issue #350** (2026-08-26): **fix(web): prevent blank screen after changing organization member role**
  *Symptoms*: **Environment**: Ongrid Web v0.12.0  **Reproduction**: 1. Open organization settings and select a member. 2. Change the member role in the role selector.  **Expected**: The role updates and the member row remains visible.  **Actual**: The page becomes blank after the update succeeds.  **Root cause**: `PATCH /v1/orgs/{org_id}/members/{user_id}` returns `204 No Content`, while the frontend treated the response as an `OrgMember` and replaced the row with `null`.

- **Issue #346** (2026-08-26): **自定义（OpenAI 兼容）接口不支持本地**
  *Symptoms*: 你好 自定义（OpenAI 兼容）接口不支持本地，本地cherry 是OK的。 <img width="1011" height="526" alt="Image" src="https://github.com/user-attachments/assets/e9be7335-0972-4127-8640-a9a6fae2eb8a" />
  **Post-Mortem & Fix Analysis**:
  > @Changego 看起来像是8045端口没有监听在本地，你进入容器telnet / nc连接试试看
  > 多谢。确实是这样。

- **Issue #339** (2026-09-03): **集成里对接自建vmauth victorialogs vitoriatrace的时候健康检查不通过**
  *Symptoms*: 这是对接vmauth  <img width="1358" height="654" alt="Image" src="https://github.com/user-attachments/assets/b45688bf-57f4-4cc0-b6f0-5fce18d2e8e5" /> 这是直接对接victorialogs   <img width="1388" height="711" alt="Image" src="https://github.com/user-attachments/assets/ea426781-a26f-4e84-aed4-5503f38a6992" /> 正常是health接口  <img width="952" height="197" alt="Image" src="https://github.com/user-attachments/assets/589fba8a-b0cb-4f7c-8fad-00522e00d8cf" /> 不支持ready  <img width="953" height="180" alt="Image" src="https://github.com/user-attachments/assets/ab6d4c13-b95e-41b3-b9ba-ee32d1f873b2" /> victorialogs版本v1.49.0 vitoriatrace一样的现象 vitoriatrace版本v0.8.0

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

### Incident Patch 1: `3affaf9a` (2026-10-03)
**Commit Message**: fix(aiops): stop model calls when token budget is exceeded

Honor token-budget rejection before Generate and Stream, including tool-budget synthesis. Add graph-level regression coverage for rejected, available, and unlimited budgets.

Related: #457

**File**: `internal/manager/biz/aiops/graph/budget_stop_model.go` (modified, +9/-0)
```diff
@@ -9,6 +9,8 @@ import (
 
 	einomodel "github.com/cloudwego/eino/components/model"
 	"github.com/cloudwego/eino/schema"
+
+	"github.com/ongridio/ongrid/internal/pkg/llm"
 )
 
 type budgetStopModel struct {
@@ -23,6 +25,10 @@ func wrapBudgetStopModel(inner einomodel.ToolCallingChatModel) einomodel.ToolCal
 }
 
 func (m *budgetStopModel) Generate(ctx context.Context, input []*schema.Message, opts ...einomodel.Option) (*schema.Message, error) {
+	// 回调只能标记预算拒绝；在普通推理和工具熔断总结之前终止模型调用。
+	if err := llm.BudgetRejectionFromContext(ctx); err != nil {
+		return nil, err
+	}
 	if env, ok := latestTerminalToolBudget(input); ok {
 		return m.synthesizeAfterToolBudget(ctx, input, env.Tool, opts...)
 	}
@@ -38,6 +44,9 @@ func (m *budgetStopModel) Generate(ctx context.Context, input []*schema.Message,
 }
 
 func (m *budgetStopModel) Stream(ctx context.Context, input []*schema.Message, opts ...einomodel.Option) (*schema.StreamReader[*schema.Message], error) {
+	if err := llm.BudgetRejectionFromContext(ctx); err != nil {
+		return nil, err
+	}
 	if env, ok := latestTerminalToolBudget(input); ok {
 		msg, err := m.synthesizeAfterToolBudget(ctx, input, env.Tool, opts...)
 		if err != nil {
```

**File**: `internal/manager/biz/aiops/graph/token_budget_test.go` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+package graph
+
+import (
+	"context"
+	"errors"
+	"io"
+	"testing"
+
+	"github.com/cloudwego/eino/compose"
+	"github.com/cloudwego/eino/schema"
+
+	"github.com/ongridio/ongrid/internal/pkg/llm"
+)
+
+func TestBuildReActGraph_TokenBudgetStopsModelCalls(t *testing.T) {
+	t.Parallel()
+	for _, mode := range []string{"invoke", "stream"} {
+		for _, tc := range []struct {
+			name       string
+			limit      int
+			toolBudget bool
+			wantReject bool
+		}{
+			{name: "exhausted", limit: 1, wantReject: true},
+			{name: "exhausted_before_synthesis", limit: 1, toolBudget: true, wantReject: true},
+			{name: "available", limit: 100000},
+			{name: "available_for_synthesis", limit: 100000, toolBudget: true},
+			{name: "unlimited", limit: 0},
+		} {
+			t.Run(mode+"/"+tc.name, func(t *testing.T) {
+				t.Parallel()
+				inner := newScriptedChatModel(makeAssistantNoTools("diagnosis complete"))
+				g, err := BuildReActGraph(inner, nil, Config{})
+				if err != nil {
+					t.Fatal(err)
+				}
+				handler := llm.NewBudgetCallbackHandler(llm.NewInMemoryBudget(tc.limit), 0)
+				input := &Input{UserText: "Check the service health and summarize the evidence."}
+				if tc.toolBudget {
+					input = &Input{History: []*schema.Message{
+						schema.UserMessage(input.UserText),
+						makeAssistantToolCall("", "call_1", "query_logql", `{}`),
+						schema.ToolMessage(`{"status":"call_budget_exceeded","tool":"query_logql","final_answer_required":true}`, "call_1", schema.WithToolName("query_logql")),
+					}}
+				}
+				err = runBudgetGraph(context.Background(), g, input, mode, compose.WithCallbacks(handler))
+				wantCalls := int32(1)
+				if tc.wantReject {
+					wantCalls = 0
+					if !errors.Is(err, llm.ErrBudgetExceeded) {
+						t.Errorf("error = %v, want ErrBudgetExceeded", err)
+					}
+					if handler.Stats().Rejects != 1 {
+						t.Errorf("budget stats = %+v, want one rejection", handler.Stats())
+					}
+				} else if err != nil {
+					t.Errorf("unexpected error: %v", err)
+				}
+				if calls := inner.generateCalls(); calls != wantCalls {
+					t.Errorf("underlying model calls = %d, want %d", calls, wantCalls)
+				}
+			})
+		}
+	}
+}
+
+func runBudgetGraph(ctx context.Context, g compose.Runnable[*Input, *Output], input *Input, mode string, opts ...compose.Option) error {
+	if mode == "invoke" {
+		_, err := g.Invoke(ctx, input, opts...)
+		return err
+	}
+	stream, err := g.Stream(ctx, input, opts...)
+	if err != nil {
+		return err
+	}
+	defer stream.Close()
+	for {
+		_, err := stream.Recv()
+		if errors.Is(err, io.EOF) {
+			return nil
+		}
+		if err != nil {
+			return err
+		}
+	}
+}
```

**File**: `internal/pkg/llm/budget_callback.go` (modified, +7/-8)
```diff
@@ -7,8 +7,8 @@
 // Design intent:
 //   - OnStart estimates prompt tokens (cheap rule-of-thumb: joined content
 //     length / 4) and asks BudgetChecker.Check. On rejection we mark the
-//     context so OnEnd / OnError can short-circuit reporting and PR-2 graph
-//     code can surface ErrBudgetExceeded.
+//     context so the graph's ChatModel wrapper can return ErrBudgetExceeded
+//     before invoking the underlying model.
 //   - OnEnd reads schema.ResponseMeta.Usage from the model's reply and
 //     records it via BudgetChecker.Record.
 //   - We do NOT touch the legacy budget gate inside openaiClient.Chat — it
@@ -19,9 +19,8 @@
 //
 // Why not return an error from OnStart? eino's callback contract gives
 // handlers no way to short-circuit a component. We attach the rejection
-// to ctx so the graph node (PR-2) can read it back out and fail-fast
-// before the network call. PR-1 ships the plumbing; PR-2 wires the check
-// into the node.
+// to ctx so the graph's ChatModel wrapper can read it back and fail before
+// either a normal model call or a tool-budget synthesis call.
 package llm
 
 import (
@@ -39,9 +38,9 @@ import (
 type budgetRejectKey struct{}
 
 // BudgetRejectionFromContext returns the budget-rejection error attached
-// to ctx by BudgetCallbackHandler.OnStart, or nil if none. Graph nodes
-// (PR-2) call this immediately after invoking the model to convert the
-// soft signal into a hard error.
+// to ctx by BudgetCallbackHandler.OnStart, or nil if none. The graph's
+// ChatModel wrapper checks it before invoking the model, including Stream,
+// to convert the callback signal into a hard error.
 func BudgetRejectionFromContext(ctx context.Context) error {
 	v := ctx.Value(budgetRejectKey{})
 	if v == nil {
```

---

### Incident Patch 2: `ce5c620a` (2026-10-01)
**Commit Message**: fix(webssh): frame terminal workspace and add fullscreen controls (#456)

**File**: `web/src/pages/DeviceShell.test.tsx` (modified, +7/-0)
```diff
@@ -81,6 +81,13 @@ describe('ConnectModal', () => {
     await act(async () => { await first.onmessage?.({ data: JSON.stringify({ type: 'ready' }) } as MessageEvent); });
     expect(first.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'resize', cols: 132, rows: 38 }));
 
+    const requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
+    Object.defineProperty(screen.getByRole('main'), 'requestFullscreen', { value: requestFullscreen, configurable: true });
+    fireEvent.click(screen.getByRole('button', { name: '全屏' }));
+    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
+    expect(await screen.findByRole('alert')).toHaveTextContent('无法切换全屏');
+    expect(first.close).not.toHaveBeenCalled();
+
     fireEvent.click(screen.getByRole('button', { name: '重新连接' }));
     fireEvent.change(await screen.findByLabelText('密码'), { target: { value: 'secret' } });
     fireEvent.click(screen.getByRole('button', { name: '连接' }));
```

**File**: `web/src/pages/DeviceShell.tsx` (modified, +43/-3)
```diff
@@ -24,6 +24,8 @@ import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { useNavigate, useParams } from 'react-router-dom';
 import {
   ChevronLeft,
+  Maximize,
+  Minimize,
   KeyRound,
   Plus,
   Power,
@@ -112,6 +114,34 @@ export function DeviceShell() {
   const [modalOpen, setModalOpen] = useState(true);
   const [conn, setConn] = useState<ConnState>({ kind: 'idle' });
   const [connectionError, setConnectionError] = useState<string | null>(null);
+  const [fullscreen, setFullscreen] = useState(false);
+  const [layoutError, setLayoutError] = useState<string | null>(null);
+  const workspaceRef = useRef<HTMLElement | null>(null);
+
+  useEffect(() => {
+    const syncFullscreen = () => setFullscreen(document.fullscreenElement === workspaceRef.current);
+    document.addEventListener('fullscreenchange', syncFullscreen);
+    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
+  }, []);
+
+  const toggleFullscreen = async () => {
+    setLayoutError(null);
+    try {
+      if (document.fullscreenElement === workspaceRef.current) await document.exitFullscreen();
+      else await workspaceRef.current?.requestFullscreen();
+    } catch {
+      setLayoutError(tr('无法切换全屏，请重试', 'Unable to toggle fullscreen. Please retry.'));
+    }
+  };
+
+  // Connection dialogs use a body portal, so leave native fullscreen first.
+  useEffect(() => {
+    if (modalOpen && document.fullscreenElement === workspaceRef.current) {
+      void document.exitFullscreen().catch(() => {
+        setLayoutError(tr('请先退出全屏再连接', 'Exit fullscreen before connecting.'));
+      });
+    }
+  }, [modalOpen, tr]);
 
   // The terminal API + ws live on refs — they're side-effectful and
   // outliving any single render is the whole point of this page.
@@ -463,8 +493,8 @@ export function DeviceShell() {
     extractHostname(edge?.host_info) || edge?.name || deviceId || tr('设备', 'device');
 
   return (
-    <>{dialog}<main className="anim-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950">
-      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/60 px-4 py-2">
+    <>{dialog}<main ref={workspaceRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden bg-bg p-3 sm:p-6">
+      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
         <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-300">
           <TerminalIcon size={14} className="text-zinc-500" />
           <span className="truncate font-medium text-zinc-100">{hostname}</span>
@@ -493,6 +523,15 @@ export function DeviceShell() {
             <RotateCw size={12} />
             {tr('重连', 'Reconnect')}
           </Button>
+          <Button
+            variant="ghost"
+            disabled={!fullscreen && conn.kind !== 'open'}
+            onClick={() => void toggleFullscreen()}
+            aria-label={fullscreen ? tr('退出全屏', 'Exit fullscreen') : tr('全屏', 'Fullscreen')}
+          >
+            {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
+            {fullscreen ? tr('退出全屏', 'Exit fullscreen') : tr('全屏', 'Fullscreen')}
+          </Button>
           <Button
             variant="ghost"
             onClick={closeTerminalPage}
@@ -504,7 +543,8 @@ export function DeviceShell() {
         </div>
       </header>
 
-      <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
+      {layoutError && <p role="alert" className="shrink-0 text-xs text-red-500">{layoutError}</p>}
+      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-zinc-950 px-3.5 py-3">
         <XTerminal
           onData={onTermData}
           onResize={onTermResize}
```

---

### Incident Patch 3: `760713a5` (2026-10-01)
**Commit Message**: fix(ui): synchronize WebSSH dimensions and normalize action columns (#454)

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@
 - **i18n**：所有用户文案使用 `tr('中文', 'English')`，包含占位符、空态、错误、Tooltip 和可访问名称；不在同一字符串中英并排，检查较长英文与长选项是否挤压布局。
 - **验收与维护**：按设计规范末尾清单检查布局、交互、窄屏、中英文及明暗主题；视觉改动提交前必须通过真实浏览器截图实看，light / dark 各一张，纯文档变更无需截图。运行相关交互测试、构建与 lint，如实记录未验证项和既有失败。公共规则变更在同一 PR 更新设计规范与相关测试，避免页面各自演变。
 
+- **表格操作列**：遵循设计规范「表格操作列」：按内容收紧，表头与按钮组左对齐；固定列复用 `.og-action-table` 不透明底色。验证横向滚动、深浅主题和不同权限下的按钮数量，不能仅检查满按钮状态。
+
 ### API
 - 所有 API 变更先更新 `.proto`，禁止改生成代码
 - Handler 必须有 Swagger 注释：`@Summary`、`@Router`、`@Success` 缺一不可
```

**File**: `docs/design/frontend-design-language.md` (modified, +6/-0)
```diff
@@ -19,6 +19,12 @@
 6. 资源清单可将筛选栏与表格放在同一 `Card`，表格复用 `.og-resource-table` 的表头、行距与悬停样式。列表与配置详情随内容区宽度伸展，页头与正文保持对齐，不以固定最大宽度造成宽屏两侧大面积留白；阅读宽度限制仅用于长文本或表单。已保存目标按列展示，新增操作保留在列表底部。发现结果选择使用 `Radio` 配合 `.og-choice-row`，整行 `label` 可点击，选中和禁用状态保持一致；已配置范围明确标注，不能只显示一个不可点击的单选框。
 7. 采集配置详情的表格使用 `.og-resource-table[data-variant="quiet"]`：表头与正文共用卡片底色，仅保留淡化的行间分隔；卡片标题和底部新增入口通过间距区分，不重复添加横线。
 
+### 表格操作列
+
+- 操作列表头与按钮组统一左对齐，按内容收紧；自动布局使用 `w-px` 配合 `whitespace-nowrap`，不为预估的按钮数量写死 320/340px 宽度。按钮过多时收进公共下拉菜单，不扩大操作列挤压信息列。
+- 带固定操作列的表格使用 `.og-action-table`，固定单元格保留 `sticky right-0` 与层级。普通行和固定列共用不透明底色，表头也保持一致；不能用透明固定列透出下面的文字，也不能独立选一个更亮的底色。
+- 验证深浅主题、默认与悬停状态、横向滚动、中英文、不同权限与按钮数量。新增选中态时必须同步整行与固定单元格底色。
+
 ## 配色、文字与图标
 
 | 用途 | 约定 |
```

**File**: `web/src/components/XTerminal.test.tsx` (modified, +45/-4)
```diff
@@ -1,26 +1,36 @@
 import { act, render } from '@testing-library/react';
 import { beforeEach, describe, expect, it, vi } from 'vitest';
 
-import { XTerminal } from './XTerminal';
+import { XTerminal, type XTerminalApi } from './XTerminal';
 import { setThemePreference } from '@/store/mode';
 
 const terminalMock = vi.hoisted(() => ({
   instances: [] as Array<{ options: { theme?: { background?: string; foreground?: string; white?: string } } }>,
+  dimensions: { cols: 132, rows: 42 },
 }));
 
 vi.mock('xterm', () => ({
   Terminal: class Terminal {
+    cols = 80;
+    rows = 24;
+    resizeListener?: () => void;
     options: { theme?: { background?: string; foreground?: string; white?: string } };
 
     constructor(options: { theme?: { background?: string; foreground?: string; white?: string } }) {
       this.options = options;
       terminalMock.instances.push(this);
     }
 
-    loadAddon() {}
+    loadAddon(addon: { activate?(terminal: Terminal): void }) { addon.activate?.(this); }
     open() {}
     onData() { return { dispose() {} }; }
-    onResize() { return { dispose() {} }; }
+    onResize(listener: () => void) { this.resizeListener = listener; return { dispose() {} }; }
+    resize(cols: number, rows: number) {
+      if (this.cols === cols && this.rows === rows) return;
+      this.cols = cols;
+      this.rows = rows;
+      this.resizeListener?.();
+    }
     attachCustomKeyEventHandler() {}
     write() {}
     writeln() {}
@@ -31,7 +41,11 @@ vi.mock('xterm', () => ({
 }));
 
 vi.mock('xterm-addon-fit', () => ({
-  FitAddon: class FitAddon { fit() {} },
+  FitAddon: class FitAddon {
+    terminal?: { resize(cols: number, rows: number): void };
+    activate(terminal: { resize(cols: number, rows: number): void }) { this.terminal = terminal; }
+    fit() { this.terminal?.resize(terminalMock.dimensions.cols, terminalMock.dimensions.rows); }
+  },
 }));
 
 vi.mock('xterm-addon-web-links', () => ({
@@ -46,9 +60,36 @@ vi.stubGlobal('ResizeObserver', class ResizeObserver {
 describe('XTerminal', () => {
   beforeEach(() => {
     terminalMock.instances.length = 0;
+    terminalMock.dimensions = { cols: 132, rows: 42 };
     localStorage.clear();
   });
 
+  it('reports initial fitted dimensions before any observer callback', () => {
+    const onResize = vi.fn();
+    render(<XTerminal attachRef={() => {}} onResize={onResize} />);
+    expect(onResize.mock.calls).toEqual([[132, 42]]);
+  });
+
+  it('reports the initial default grid even without an xterm resize event', () => {
+    terminalMock.dimensions = { cols: 80, rows: 24 };
+    const onResize = vi.fn();
+    render(<XTerminal attachRef={() => {}} onResize={onResize} />);
+    expect(onResize).toHaveBeenCalledWith(80, 24);
+  });
+
+  it('explicit fit re-publishes unchanged dimensions for reconnect', () => {
+    const onResize = vi.fn();
+    let api!: XTerminalApi;
+    render(<XTerminal attachRef={(value) => { api = value; }} onResize={onResize} />);
+    onResize.mockClear();
+    act(() => api.fit());
+    expect(onResize.mock.calls).toEqual([[132, 42]]);
+    terminalMock.dimensions = { cols: 100, rows: 30 };
+    onResize.mockClear();
+    act(() => api.fit());
+    expect(onResize.mock.calls).toEqual([[100, 30]]);
+  });
+
   it('只读日志启用应用主题后会响应 light 和 dark 切换', () => {
     setThemePreference('light');
     const { container } = render(<XTerminal attachRef={() => {}} readOnly followAppTheme />);
```

**File**: `web/src/components/XTerminal.tsx` (modified, +27/-27)
```diff
@@ -130,17 +130,26 @@ export function XTerminal({ onData, onResize, attachRef, readOnly = false, class
 
     term.open(el);
     terminalRef.current = term;
-    // Initial fit must happen after open() lays out the DOM.
-    try {
-      fitAddon.fit();
-    } catch {
-      /* container not laid out yet — ResizeObserver will catch up */
-    }
-
-    const dataDisposable = readOnly ? null : term.onData((d) => onData?.(d));
-    const resizeDisposable = term.onResize(({ cols, rows }) => {
+    let lastSize: { cols: number; rows: number } | undefined;
+    const publishSize = () => {
+      const { cols, rows } = term;
+      if (lastSize?.cols === cols && lastSize.rows === rows) return;
+      lastSize = { cols, rows };
       onResize?.(cols, rows);
-    });
+    };
+    const dataDisposable = readOnly ? null : term.onData((d) => onData?.(d));
+    const resizeDisposable = term.onResize(publishSize);
+    const fit = (forceReport = false) => {
+      if (forceReport) lastSize = undefined;
+      try {
+        fitAddon.fit();
+        publishSize();
+      } catch {
+        /* container not laid out yet — ResizeObserver will catch up */
+      }
+    };
+    // Subscribe before fitting, including grids that stay at xterm's default size.
+    fit();
 
     if (readOnly) {
       term.attachCustomKeyEventHandler((event) => {
@@ -150,17 +159,12 @@ export function XTerminal({ onData, onResize, attachRef, readOnly = false, class
       });
     }
 
-    // Re-fit on container size changes (sidebar collapse, window resize).
-    // We debounce nothing — fit() is cheap and the resize control frame
-    // is throttled by SSH itself.
-    const ro = new ResizeObserver(() => {
-      try {
-        fitAddon.fit();
-      } catch {
-        /* dom temporarily detached during route change */
-      }
-    });
+    const ro = new ResizeObserver(() => fit());
     ro.observe(el);
+    let disposed = false;
+    void document.fonts?.ready.then(() => {
+      if (!disposed) fit();
+    });
 
     // Hand the imperative API back to the parent. The decoder is created
     // once and reused so we don't churn allocations per inbound chunk.
@@ -179,13 +183,8 @@ export function XTerminal({ onData, onResize, attachRef, readOnly = false, class
       writeln: (line) => term.writeln(line),
       clear: () => term.clear(),
       focus: () => term.focus(),
-      fit: () => {
-        try {
-          fitAddon.fit();
-        } catch {
-          /* noop */
-        }
-      },
+      // A new SSH session must receive dimensions even when the grid is unchanged.
+      fit: () => fit(true),
       dispose: () => term.dispose(),
     };
     attachRef(api);
@@ -195,6 +194,7 @@ export function XTerminal({ onData, onResize, attachRef, readOnly = false, class
     if (!readOnly) term.focus();
 
     return () => {
+      disposed = true;
       terminalRef.current = null;
       ro.disconnect();
       dataDisposable?.dispose();
```

**File**: `web/src/pages/Clusters.test.tsx` (modified, +2/-0)
```diff
@@ -109,6 +109,8 @@ describe("device cluster pages", () => {
       name: "bare-metal-prod",
     });
     expect(clusterLink).toHaveAttribute("href", "/clusters/501");
+    expect(screen.getByRole('columnheader', { name: '操作' })).toHaveClass('w-px', 'text-left');
+    expect(clusterLink.closest('table')).toHaveClass('table-auto');
     expect(screen.getByRole("link", { name: "k8s-prod" })).toHaveAttribute("href", "/clusters/901");
     expect(screen.getByText("接入类型")).toBeInTheDocument();
     expect(screen.getByText("Host")).toBeInTheDocument();
```

**File**: `web/src/pages/Clusters.tsx` (modified, +3/-3)
```diff
@@ -277,7 +277,7 @@ export default function ClustersPage() {
               />
             ) : (
               <div className="overflow-x-auto">
-                <table className="w-full min-w-[1000px] table-fixed whitespace-nowrap text-left text-xs">
+                <table className="w-full min-w-[1000px] table-auto whitespace-nowrap text-left text-xs">
                   <thead className="border-b border-zinc-800/60 bg-zinc-950/30 text-[11px] uppercase tracking-wide text-zinc-500">
                     <tr>
                       <th className="w-[22%] px-4 py-2.5 font-medium">
@@ -299,7 +299,7 @@ export default function ClustersPage() {
                       <th className="px-4 py-2.5 font-medium">
                         {tr("更新时间", "Updated")}
                       </th>
-                      <th className="w-[320px] px-4 py-2.5 text-right font-medium">
+                      <th className="w-px px-4 py-2.5 text-left font-medium">
                         {tr("操作", "Actions")}
                       </th>
                     </tr>
@@ -438,7 +438,7 @@ function ClusterRow({
       <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
         {relativeTime(summary.cluster.updated_at)}
       </td>
-      <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
+      <td className="w-px px-4 py-3 text-left" onClick={(event) => event.stopPropagation()}>
         <div className="inline-flex items-center gap-1">
           <Link
             to={`/clusters/${summary.cluster.id}`}
```

**File**: `web/src/pages/DeviceShell.test.tsx` (modified, +39/-1)
```diff
@@ -5,10 +5,20 @@ import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 
 import { ConnectModal, DeviceShell } from './DeviceShell';
 import { server } from '@/test/msw-server';
+import { useEffect } from 'react';
 
 const openShellSocket = vi.hoisted(() => vi.fn());
 
-vi.mock('@/components/XTerminal', () => ({ XTerminal: () => null }));
+const terminalSize = vi.hoisted(() => ({ cols: 132, rows: 42 }));
+vi.mock('@/components/XTerminal', () => ({ XTerminal: ({ attachRef, onResize }: {
+  attachRef(api: Partial<import('@/components/XTerminal').XTerminalApi>): void;
+  onResize(cols: number, rows: number): void;
+}) => {
+  useEffect(() => {
+    attachRef({ fit: () => onResize(terminalSize.cols, terminalSize.rows), write: vi.fn() });
+  }, [attachRef, onResize]);
+  return null;
+} }));
 vi.mock('@/api/webshell', async () => ({
   ...await vi.importActual<typeof import('@/api/webshell')>('@/api/webshell'),
   openShellSocket,
@@ -39,6 +49,8 @@ describe('ConnectModal', () => {
   beforeEach(() => {
     localStorage.setItem('ongrid-locale', 'zh-CN');
     openShellSocket.mockReset();
+    terminalSize.cols = 132;
+    terminalSize.rows = 42;
     server.use(
       http.get('/api/v1/edges', () => HttpResponse.json({ items: [edge], total: 1 })),
       http.get('/api/v1/edges/70', () => HttpResponse.json(edge)),
@@ -54,6 +66,32 @@ describe('ConnectModal', () => {
     vi.restoreAllMocks();
   });
 
+  it('sends measured open size first and re-synchronizes unchanged size on ready and reconnect', async () => {
+    const first = { readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() } as unknown as WebSocket;
+    const second = { readyState: WebSocket.OPEN, send: vi.fn(), close: vi.fn() } as unknown as WebSocket;
+    openShellSocket.mockReturnValueOnce(first).mockReturnValueOnce(second);
+    renderShell();
+    fireEvent.change(await screen.findByLabelText('密码'), { target: { value: 'secret' } });
+    fireEvent.click(screen.getByRole('button', { name: '连接' }));
+    await waitFor(() => expect(openShellSocket).toHaveBeenCalledOnce());
+    act(() => { first.onopen?.(new Event('open')); });
+    expect(first.send).toHaveBeenCalledTimes(1);
+    expect(first.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'open', cols: 132, rows: 42, term: 'xterm-256color' }));
+    terminalSize.rows = 38;
+    await act(async () => { await first.onmessage?.({ data: JSON.stringify({ type: 'ready' }) } as MessageEvent); });
+    expect(first.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'resize', cols: 132, rows: 38 }));
+
+    fireEvent.click(screen.getByRole('button', { name: '重新连接' }));
+    fireEvent.change(await screen.findByLabelText('密码'), { target: { value: 'secret' } });
+    fireEvent.click(screen.getByRole('button', { name: '连接' }));
+    await waitFor(() => expect(openShellSocket).toHaveBeenCalledTimes(2));
+    act(() => { second.onopen?.(new Event('open')); });
+    expect(second.send).toHaveBeenCalledTimes(1);
+    expect(second.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'open', cols: 132, rows: 38, term: 'xterm-256color' }));
+    await act(async () => { await second.onmessage?.({ data: JSON.stringify({ type: 'ready' }) } as MessageEvent); });
+    expect(second.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'resize', cols: 132, rows: 38 }));
+  });
+
   it('先展示已保存账户，新增账户时直接连接并延后保存', async () => {
     server.use(
       http.get('/api/v1/devices/42/shell/credentials', () =>
```

**File**: `web/src/pages/DeviceShell.tsx` (modified, +10/-4)
```diff
@@ -117,6 +117,7 @@ export function DeviceShell() {
   // outliving any single render is the whole point of this page.
   const termRef = useRef<XTerminalApi | null>(null);
   const wsRef = useRef<WebSocket | null>(null);
+  const shellReadyRef = useRef(false);
   // Latest cols/rows reported by xterm. We need them when sending the
   // first `open` frame (called from a callback that doesn't have direct
   // access to the terminal's geometry).
@@ -196,6 +197,7 @@ export function DeviceShell() {
   // Tear down the socket. Caller decides whether to also dispose the
   // terminal — usually we keep it so the user can read final output.
   const teardown = useCallback(() => {
+    shellReadyRef.current = false;
     sendCloseOnce();
     const ws = wsRef.current;
     wsRef.current = null;
@@ -275,6 +277,7 @@ export function DeviceShell() {
 
       ws.onopen = () => {
         if (wsRef.current !== ws) return;
+        termRef.current?.fit();
         const { cols, rows } = sizeRef.current;
         sendControl(ws, {
           type: 'open',
@@ -302,6 +305,8 @@ export function DeviceShell() {
         switch (frame.type) {
           case 'ready': {
             inputs.password = '';
+            shellReadyRef.current = true;
+            termRef.current?.fit();
             setConn({ kind: 'open' });
             writeBanner(ansiDim(tr(`-- SSH 已连接 (${inputs.user}@${edge?.name ?? deviceId}) --`, `-- SSH connected (${inputs.user}@${edge?.name ?? deviceId}) --`)));
             break;
@@ -376,6 +381,7 @@ export function DeviceShell() {
 
       ws.onclose = (ev) => {
         if (wsRef.current !== ws) return;
+        shellReadyRef.current = false;
         inputs.password = '';
         if (!closedSentRef.current && ev.code === 1006) {
           const message = tr('连接异常断开', 'Connection dropped unexpectedly');
@@ -416,7 +422,7 @@ export function DeviceShell() {
   const onTermResize = useCallback((cols: number, rows: number) => {
     sizeRef.current = { cols, rows };
     const ws = wsRef.current;
-    if (ws && ws.readyState === WebSocket.OPEN) {
+    if (shellReadyRef.current && ws && ws.readyState === WebSocket.OPEN) {
       sendControl(ws, { type: 'resize', cols, rows });
     }
   }, []);
@@ -457,8 +463,8 @@ export function DeviceShell() {
     extractHostname(edge?.host_info) || edge?.name || deviceId || tr('设备', 'device');
 
   return (
-    <>{dialog}<main className="anim-fade flex flex-1 flex-col overflow-hidden bg-zinc-950">
-      <header className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/60 px-4 py-2">
+    <>{dialog}<main className="anim-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-zinc-950">
+      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/60 px-4 py-2">
         <div className="flex min-w-0 items-center gap-2 text-xs text-zinc-300">
           <TerminalIcon size={14} className="text-zinc-500" />
           <span className="truncate font-medium text-zinc-100">{hostname}</span>
@@ -498,7 +504,7 @@ export function DeviceShell() {
         </div>
       </header>
 
-      <div className="flex-1 overflow-hidden p-2">
+      <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
         <XTerminal
           onData={onTermData}
           onResize={onTermResize}
```

---

### Incident Patch 4: `4e9f2961` (2026-09-30)
**Commit Message**: fix(web): unify header dividers and compact device and tool layouts (#449)

**File**: `web/src/components/ui/PageHeader.test.tsx` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { render, screen, within } from '@testing-library/react';
+import { describe, expect, it } from 'vitest';
+import { PageHeader } from './PageHeader';
+import { Tabs, TabsList, TabsTrigger } from './Tabs';
+
+describe('PageHeader', () => {
+  it('keeps page navigation inside the shared header boundary', () => {
+    render(<Tabs defaultValue="services"><PageHeader title="Services" navigation={
+      <TabsList><TabsTrigger value="services">Service list</TabsTrigger></TabsList>
+    } /></Tabs>);
+    const header = screen.getByRole('banner');
+    expect(within(header).getByRole('tab', { name: 'Service list' })).toBeInTheDocument();
+    expect(within(header).getByRole('tablist').parentElement).toHaveClass('[&>.og-tabs-list]:border-b-0');
+  });
+
+  it('preserves the header and filter layout without navigation', () => {
+    render(<PageHeader title="Tools" extra={<input aria-label="Target" />} />);
+    expect(within(screen.getByRole('banner')).getByRole('textbox', { name: 'Target' })).toBeInTheDocument();
+    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
+  });
+});
```

**File**: `web/src/components/ui/PageHeader.tsx` (modified, +4/-1)
```diff
@@ -13,12 +13,14 @@ type Props = {
   actions?: ReactNode;
   /** Optional content rendered below the title row inside the same header. */
   extra?: ReactNode;
+  /** Page-level tabs share the header's bottom divider. */
+  navigation?: ReactNode;
   /** Optional content rendered above the title (breadcrumb / back link). */
   leading?: ReactNode;
   className?: string;
 };
 
-export function PageHeader({ title, subtitle, actions, extra, leading, className }: Props) {
+export function PageHeader({ title, subtitle, actions, extra, navigation, leading, className }: Props) {
   return (
     <header
       className={cn(
@@ -35,6 +37,7 @@ export function PageHeader({ title, subtitle, actions, extra, leading, className
         {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
       </div>
       {extra && <div className="mt-3">{extra}</div>}
+      {navigation && <div className="mt-3 -mb-4 [&>.og-tabs-list]:border-b-0">{navigation}</div>}
     </header>
   );
 }
```

**File**: `web/src/pages/Alerts.header.test.tsx` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+import { render, screen, within } from '@testing-library/react';
+import { MemoryRouter } from 'react-router-dom';
+import { expect, it } from 'vitest';
+import { http, HttpResponse } from 'msw';
+import { server } from '@/test/msw-server';
+import Alerts from './Alerts';
+
+it('keeps alert filters and actions inside the shared page header', async () => {
+  localStorage.setItem('ongrid-locale', 'zh-CN');
+  server.use(
+    http.get('/api/v1/alerts/incidents', () => HttpResponse.json({ items: [], total: 0 })),
+    http.get('/api/v1/edges', () => HttpResponse.json({ items: [], total: 0 })),
+  );
+  render(<MemoryRouter><Alerts /></MemoryRouter>);
+  const header = screen.getByRole('banner');
+  expect(within(header).getByRole('heading', { name: '告警' })).toBeInTheDocument();
+  expect(within(header).getByText('状态')).toBeInTheDocument();
+  expect(within(header).getByText('级别')).toBeInTheDocument();
+  expect(within(header).getByRole('link', { name: '规则配置' })).toHaveAttribute('href', '/alerts/rules');
+  expect(within(header).getByRole('button', { name: '刷新' })).toBeInTheDocument();
+});
```

**File**: `web/src/pages/Alerts.tsx` (modified, +10/-17)
```diff
@@ -1,4 +1,4 @@
-import { Button, Label, Textarea } from '@/components/ui';
+import { Button, Label, Textarea, PageHeader } from '@/components/ui';
 import { Hint } from '@/components/ui/Tooltip';
 import { useCallback, useEffect, useMemo, useState } from 'react';
 import { Link, useNavigate } from 'react-router-dom';
@@ -146,10 +146,8 @@ export default function AlertsPage() {
   return (
     <>
       <main className="anim-fade flex flex-1 flex-col overflow-hidden">
-        <header className="app-header border-b border-zinc-800 px-6 py-4">
-          <div className="flex items-center justify-between gap-4">
-            <div>
-              <h1 className="flex items-center gap-2 text-base font-semibold text-zinc-100">
+        <PageHeader
+          title={<span className="flex items-center gap-2">
                 {tr('告警', 'Alerts')}
                 {globalOpen > 0 && (
                   <Hint content={tr('全局未确认告警数 — 跟侧边栏红点同源', 'Global unacknowledged count — same source as the sidebar badge')}><span
@@ -159,15 +157,12 @@ export default function AlertsPage() {
                     {globalOpen} {tr('未确认', 'open')}
                   </span></Hint>
                 )}
-              </h1>
-              <p className="mt-0.5 text-xs text-zinc-500">
-                {tr(
+              </span>}
+          subtitle={tr(
                   `全局 ${globalOpen} 未确认 · 当前筛选 ${total} 条 · 本页 Critical ${counts.critical}`,
                   `${globalOpen} open globally · ${total} in current filter · ${counts.critical} critical on this page`,
                 )}
-              </p>
-            </div>
-            <div className="flex gap-2">
+          actions={<div className="flex gap-2">
               <Link
                 to="/alerts/rules"
                 className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
@@ -183,11 +178,8 @@ export default function AlertsPage() {
                 <RefreshCw size={12} className={cn(refreshing && 'animate-spin')} />
                 {tr('刷新', 'Refresh')}
               </Button>
-            </div>
-          </div>
-        </header>
-
-        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 px-6 py-3 text-xs text-zinc-400">
+            </div>}
+          extra={<div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
           <FilterGroup
             label={tr('状态', 'Status')}
             options={STATUS_FILTERS.map((o) => ({ key: o.key, label: tr(o.labelZh, o.labelEn) }))}
@@ -206,7 +198,8 @@ export default function AlertsPage() {
               setSeverityFilter(next);
             }}
           />
-        </div>
+        </div>}
+        />
 
         <div className="flex-1 overflow-y-auto">
           {err && (
```

**File**: `web/src/pages/Apm.tsx` (modified, +5/-6)
```diff
@@ -617,15 +617,13 @@ export default function ApmPage() {
                 'Explore service requests, traces, logs and instances',
               )
         }
-        className="!py-3 shrink-0 [&_h1]:break-all"
-      />
-      {!detail && <TabsList activateOnFocus={false} aria-label={tr('服务视图', 'Service views')} className="shrink-0 border-b border-zinc-800 px-6">
+        className="shrink-0 [&_h1]:break-all"
+        navigation={!detail ? <TabsList activateOnFocus={false} aria-label={tr('服务视图', 'Service views')} className="shrink-0">
         {[['services', tr('服务列表', 'Service list')], ['map', tr('服务地图', 'Service map')], ['discovery', tr('服务发现', 'Service discovery')], ['onboarding', tr('接入指南', 'Setup guide')]].map(([value, label]) => <TabsTrigger key={value} value={value} onClick={() => set('tab', value)}>{label}</TabsTrigger>)}
-      </TabsList>}
-      {detail && (
+      </TabsList> : (
         <TabsList activateOnFocus={false}
           aria-label={tr('服务视图', 'Service views')}
-          className="flex shrink-0 flex-wrap items-center gap-x-5 border-b border-zinc-800 px-6"
+          className="flex shrink-0 flex-wrap items-center gap-x-5"
         >
           {tabs.map(([key, label]) => (
             <TabsTrigger key={key} value={key} nativeButton={false} render={<Link state={location.state} to={viewLink(key)} />} >
@@ -644,6 +642,7 @@ export default function ApmPage() {
           </div>
         </TabsList>
       )}
+      />
       <TabsContent value={operation && ['overview', 'operations'].includes(tab) ? 'operations' : tab} className="contents"><main ref={main} className="flex-1 space-y-3 overflow-auto px-6 py-4">
         {(scopeFilters || timeControls) && (
           <div role="group" aria-label={tr('当前视图筛选', 'Current view filters')} className="flex flex-wrap items-center justify-between gap-3">
```

**File**: `web/src/pages/DailyTools.test.tsx` (modified, +4/-0)
```diff
@@ -147,6 +147,10 @@ describe('DailyToolsPage', () => {
     render(<MemoryRouter><DailyToolsPage /></MemoryRouter>);
     expect(await screen.findByText('保存的抓包')).toBeInTheDocument();
     expect(screen.queryByText('尚未执行工具')).not.toBeInTheDocument();
+    const runButton = screen.getByRole('button', { name: '执行' });
+    const clearButton = within(runButton.parentElement!).getByRole('button', { name: '清空运行' });
+    expect(runButton.nextElementSibling).toBe(clearButton);
+    expect(clearButton).toHaveAttribute('type', 'button');
     await act(async () => { await userEvent.click(screen.getByRole('button', { name: '清空运行' })); });
     expect(screen.getByText('尚未执行工具')).toBeInTheDocument();
     expect(screen.queryByText('保存的抓包')).not.toBeInTheDocument();
```

**File**: `web/src/pages/DailyTools.tsx` (modified, +11/-5)
```diff
@@ -21,6 +21,7 @@ import '@xyflow/react/dist/style.css';
 import dagre from '@dagrejs/dagre';
 import {
   Activity,
+  Trash2,
   Check,
   ChevronDown,
   Copy,
@@ -798,14 +799,20 @@ export default function DailyToolsPage() {
                 {active === 'http' && <HTTPFields value={http} onChange={setHTTP} />}
                 {active === 'capture' && <CaptureFields value={capture} selectedEdges={selectedEdges} onChange={setCapture} />}
               </div>
-              {active !== 'profile' ? <Button variant="primary" size="sm"
+              {active !== 'profile' ? <div className="ml-auto flex shrink-0 items-center gap-2 self-end"><Button variant="primary" size="sm"
                 type="submit"
                 disabled={!canRun}
-                className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 self-end px-3 font-medium text-accent-fg"
+                className="inline-flex h-9 shrink-0 items-center gap-1.5 px-3 font-medium text-accent-fg"
               >
                 <Play size={12} fill="currentColor" />
                 {active === 'capture' ? tr('开始', 'Start') : tr('执行', 'Run')}
-              </Button> : null}
+              </Button>
+                {runs.length > 0 || captureRuns.length > 0 ? (
+                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => { setRuns([]); setCaptureRuns([]); setSelectedResult(null); }}>
+                    <Trash2 size={13} />{tr('清空运行', 'Clear runs')}
+                  </Button>
+                ) : null}
+              </div> : null}
             </div>
             <div className="flex min-w-0 flex-wrap items-center gap-2">
               <span className="text-xs text-zinc-500">{tr(`${selectedEdges.length} 台 Edge · ${activeTool.zh}`, `${selectedEdges.length} Edge(s) · ${activeTool.en}`)}</span>
@@ -837,7 +844,6 @@ export default function DailyToolsPage() {
               onStop={() => void stopProfile()}
             />
           ) : <>
-            {(runs.length > 0 || captureRuns.length > 0) ? <div className="flex justify-end"><Button onClick={() => { setRuns([]); setCaptureRuns([]); setSelectedResult(null); }}>{tr('清空运行', 'Clear runs')}</Button></div> : null}
             {captureRuns.length > 0 ? <CaptureQuickPanel runs={captureRuns} nowMs={nowMs} onStop={(run) => void stopCapture(run)} onDiscard={(run) => void discardCapture(run)} /> : null}
           {runs.length > 0 || captureRuns.length === 0 ? <section className="min-h-[420px]">
             {runs.length === 0 ? (
@@ -1009,7 +1015,7 @@ function EdgePicker({
       ? edgeLabel(selectedEdges[0])
       : tr(`${selectedEdges.length} 台 Edge`, `${selectedEdges.length} Edges`);
   return (
-    <div className="w-80 min-w-[240px] max-w-full shrink-0 space-y-1">
+    <div className="w-72 min-w-0 max-w-full shrink-0 space-y-1">
       <span className="block text-[11px] leading-4 text-zinc-400">{tr('执行目标', 'Execution target')}</span>
       <Combobox.Root
         multiple={multiple}
```

**File**: `web/src/pages/Edges.tsx` (modified, +12/-18)
```diff
@@ -36,7 +36,7 @@ import {
 } from "lucide-react";
 import { StatusPill } from "@/components/StatusPill";
 import { Modal } from "@/components/Modal";
-import { Button } from "@/components/ui";
+import { Button, PageHeader } from "@/components/ui";
 import { cn } from "@/lib/cn";
 import { openMetricDrilldown } from "@/lib/drilldown";
 import { relativeTime } from "@/lib/format";
@@ -621,18 +621,12 @@ export default function EdgesPage() {
   return (
     <>{dialog}<Tabs value={discoveryView ? 'network-discovery' : 'devices'} onValueChange={(next) => navigate(next === 'devices' ? '/devices' : '/devices?view=network-discovery')} className="contents"><>
       <main className="anim-fade flex min-w-0 flex-1 flex-col overflow-hidden">
-        <header className="app-header flex items-center justify-between border-b border-zinc-800/60 px-6 py-4">
-          <div>
-            <h1 className="text-base font-semibold text-zinc-100">
-              {headerTitle}
-            </h1>
-            <p className="mt-0.5 text-xs text-zinc-500">
-              {discoveryView
+        <PageHeader
+          title={headerTitle}
+          subtitle={discoveryView
                 ? tr(`${pendingCandidateCount} 个候选等待 SNMP 校验`, `${pendingCandidateCount} candidates awaiting SNMP verification`)
                 : tr(`${devices.length} 台设备 · 每 10 秒自动刷新`, `${devices.length} device(s) · auto-refresh every 10s`)}
-            </p>
-          </div>
-          {!discoveryView && rolesFilter !== "network" && (
+          actions={!discoveryView && rolesFilter !== "network" && (
           <div className="flex items-center gap-2">
             <Hint content={tr(
                 "WebSSH 会话审计 / 活跃会话",
@@ -666,15 +660,15 @@ export default function EdgesPage() {
               </>
           </div>
           )}
-        </header>
-
-        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
-          {rolesFilter !== "network" && (
-            <TabsList className="mb-4 flex items-center gap-1 border-b border-zinc-800/60">
+          navigation={rolesFilter !== "network" && (
+            <TabsList className="flex items-center gap-1">
               <TabsTrigger  value={'devices'} >{tr("全部设备", "All devices")}</TabsTrigger>
               <TabsTrigger  value={'network-discovery'} >{tr("网络发现", "Network discovery")}</TabsTrigger>
             </TabsList>
           )}
+        />
+
+        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
           <TabsContent value={discoveryView ? 'network-discovery' : 'devices'} className="contents">{error && (
             <div
               role="alert"
@@ -760,7 +754,7 @@ export default function EdgesPage() {
                   <col className="w-10" />
                   <col className="w-[52px]" />
                   <col className="w-[220px]" />
-                  <col className="w-[230px]" />
+                  <col className="w-[140px]" />
                   <col className="w-[190px]" />
                   <col className="w-[130px]" />
                   <col className="w-[130px]" />
@@ -1402,7 +1396,7 @@ function EdgeAccessMeta({
   const { tr } = useI18n();
   const clusters = uniqueAttachmentClusters(attachments);
   return (
-    <div className="flex min-w-0 shrink-0 items-center gap-1">
+    <div className="flex w-[120px] min-w-0 flex-wrap items-center gap-1 [&>a]:max-w-full">
       <EdgeAccessPill kind={attachments.length > 0 ? "k8s" : "host"}>
         {attachments.length > 0 ? "K8s" : "Host"}
       </EdgeAccessPill>
```

---

### Incident Patch 5: `90d4d6c8` (2026-09-29)
**Commit Message**: fix(ui): align tool target selector and capture empty state (#447)

**File**: `web/src/pages/DailyTools.test.tsx` (modified, +20/-0)
```diff
@@ -80,6 +80,8 @@ describe('DailyToolsPage', () => {
     render(<MemoryRouter><DailyToolsPage /></MemoryRouter>);
 
     expect(await screen.findByRole('combobox', { name: '选择 Edge' })).toBeInTheDocument();
+    expect(screen.getByRole('combobox', { name: '选择 Edge' })).toHaveClass('w-full');
+    expect(screen.getByText('尚未执行工具')).toBeInTheDocument();
     expect(screen.getByLabelText('目标 Host / IP')).toHaveValue('');
     expect(screen.getByRole('button', { name: /^执行$/ })).toBeDisabled();
   });
@@ -132,6 +134,24 @@ describe('DailyToolsPage', () => {
     await act(async () => { await user.keyboard('{Escape}'); });
   });
 
+  it('只有抓包历史时不显示工具空状态，清空后恢复空状态', async () => {
+    localStorage.setItem('ongrid-daily-tools-runs-v1', JSON.stringify({
+      runs: [],
+      captureRuns: [{
+        id: 'capture-only', status: 'ready', title: '保存的抓包', target: 'tcp port 443',
+        edgeLabels: ['#1 edge-001'], startedAt: '2026-08-16T00:00:00Z',
+        captureIDs: [41], link: '/pages?tab=packets',
+        members: [{ id: 41, edgeLabel: '#1 edge-001', state: 'ready', capturedPackets: 8, capturedBytes: 512 }], logs: [],
+      }],
+    }));
+    render(<MemoryRouter><DailyToolsPage /></MemoryRouter>);
+    expect(await screen.findByText('保存的抓包')).toBeInTheDocument();
+    expect(screen.queryByText('尚未执行工具')).not.toBeInTheDocument();
+    await act(async () => { await userEvent.click(screen.getByRole('button', { name: '清空运行' })); });
+    expect(screen.getByText('尚未执行工具')).toBeInTheDocument();
+    expect(screen.queryByText('保存的抓包')).not.toBeInTheDocument();
+  });
+
   it('恢复未清空的运行历史', async () => {
     localStorage.setItem('ongrid-daily-tools-runs-v1', JSON.stringify({
       runs: [{
```

**File**: `web/src/pages/DailyTools.tsx` (modified, +3/-3)
```diff
@@ -839,15 +839,15 @@ export default function DailyToolsPage() {
           ) : <>
             {(runs.length > 0 || captureRuns.length > 0) ? <div className="flex justify-end"><Button onClick={() => { setRuns([]); setCaptureRuns([]); setSelectedResult(null); }}>{tr('清空运行', 'Clear runs')}</Button></div> : null}
             {captureRuns.length > 0 ? <CaptureQuickPanel runs={captureRuns} nowMs={nowMs} onStop={(run) => void stopCapture(run)} onDiscard={(run) => void discardCapture(run)} /> : null}
-          <section className="min-h-[420px]">
+          {runs.length > 0 || captureRuns.length === 0 ? <section className="min-h-[420px]">
             {runs.length === 0 ? (
               <div className="py-20"><EmptyState icon={Activity} title={tr('尚未执行工具', 'No tool runs yet')} hint={tr('选择 Edge 和工具后执行；多次执行会在这里分栏或分页。', 'Select Edges and a tool to run; repeated runs appear here for comparison.')} /></div>
             ) : (
               <div className={cn('grid grid-cols-1 gap-4', workspaceRuns.length > 1 && '2xl:grid-cols-2')}>
                 {workspaceRuns.map((run) => <RunPanel key={run.id} run={run} nowMs={nowMs} onInspect={setSelectedResult} onCancel={(item) => void cancelToolRun(item)} onClose={(id) => closeRun(id, setRuns, setSelectedResult)} />)}
               </div>
             )}
-          </section>
+          </section> : null}
           </>}
         </div>
       </div>
@@ -1025,7 +1025,7 @@ function EdgePicker({
         onInputValueChange={onQuery}
         autoHighlight
       >
-        <Combobox.Trigger className="og-select-trigger" aria-label={label}>
+        <Combobox.Trigger className="og-select-trigger w-full" aria-label={label}>
           <span className={cn('min-w-0 flex-1 truncate text-left', selectedEdges.length === 0 && 'text-text-faint')}>{label}</span>
           <ChevronDown size={14} className="shrink-0 text-text-faint" aria-hidden="true" />
         </Combobox.Trigger>
```

---

### Incident Patch 6: `5f0ffbad` (2026-09-29)
**Commit Message**: fix(mcp): complete inline approval and result continuation (#446)

**File**: `cmd/ongrid/main.go` (modified, +28/-4)
```diff
@@ -2453,7 +2453,11 @@ func main() {
 				for _, mt := range discovered {
 					raw := aiopstools.NewMCPTool(srv.Name, mt.Name, mt.Description, mt.InputSchema, srv.Trusted, mcpCaller, mcpProposer, log)
 					rawTools = append(rawTools, raw)
-					graphTools = append(graphTools, aiopstoolsdec.Wrap(raw, mcpDeps))
+					deps := mcpDeps
+					if !srv.Trusted {
+						deps.Timeout = approvalWaitTimeout + time.Minute
+					}
+					graphTools = append(graphTools, aiopstoolsdec.Wrap(raw, deps))
 				}
 			}
 			chatRT.ReplaceCatalogToolsByNamePrefix(prefix, rawTools)
@@ -4992,8 +4996,11 @@ func (s mcpCallerShim) CallMCPTool(ctx context.Context, server, tool string, arg
 // untrusted path) — same propose-confirm model as cloud_bash.
 type mcpProposerShim struct{ uc *managerbizapproval.Usecase }
 
-func (s mcpProposerShim) ProposeMCPCall(ctx context.Context, server, tool string, args map[string]any, sessionID string, userID uint64) (string, error) {
-	argsJSON, _ := json.Marshal(args)
+func (s mcpProposerShim) ProposeMCPCallAndAwait(ctx context.Context, server, tool string, args map[string]any, sessionID, toolCallID string, userID uint64) (string, error) {
+	argsJSON, err := json.Marshal(args)
+	if err != nil {
+		return "", fmt.Errorf("marshal MCP approval arguments: %w", err)
+	}
 	cmd := server + " / " + tool + " " + string(argsJSON)
 	if len(cmd) > 200 {
 		cmd = cmd[:200] + "…"
@@ -5009,7 +5016,24 @@ func (s mcpProposerShim) ProposeMCPCall(ctx context.Context, server, tool string
 	if err != nil {
 		return "", err
 	}
-	return a.ID, nil
+	if emit := aiopschatruntime.EmitFromContext(ctx); emit != nil {
+		emit(aiopschatruntime.Event{
+			Type: aiopschatruntime.EventApprovalPending,
+			Approval: &aiopschatruntime.ApprovalPending{
+				ApprovalID: a.ID, ToolCallID: toolCallID, Kind: "mcp_call",
+				ToolName: aiopstools.MCPToolName(server, tool), Command: cmd,
+			},
+		})
+	} else if emit := aiopsagent.EmitFromContext(ctx); emit != nil {
+		emit(aiopsagent.Event{
+			Type: aiopsagent.EventApprovalPending,
+			Approval: &aiopsagent.ApprovalPendingEvent{
+				ApprovalID: a.ID, ToolCallID: toolCallID, Kind: "mcp_call",
+				ToolName: aiopstools.MCPToolName(server, tool), Command: cmd,
+			},
+		})
+	}
+	return cloudBashProposerShim{uc: s.uc}.awaitDecision(ctx, a.ID)
 }
 
 type flowToolInvoker struct {
```

**File**: `cmd/ongrid/mcp_approval_runtime_test.go` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+package main
+
+import (
+	"context"
+	"path/filepath"
+	"sync"
+	"testing"
+	"time"
+
+	einomodel "github.com/cloudwego/eino/components/model"
+	"github.com/cloudwego/eino/schema"
+	"github.com/glebarez/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+
+	runtime "github.com/ongridio/ongrid/internal/manager/biz/aiops/chatruntime"
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/graph"
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools"
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
+	approval "github.com/ongridio/ongrid/internal/manager/biz/approval"
+	chatstore "github.com/ongridio/ongrid/internal/manager/data/aiops/store"
+	approvalstore "github.com/ongridio/ongrid/internal/manager/data/approval/store"
+	chatmodel "github.com/ongridio/ongrid/internal/manager/model/aiops"
+)
+
+type mcpReviewModel struct {
+	mu        sync.Mutex
+	turns     int
+	sawResult bool
+}
+
+func (m *mcpReviewModel) Generate(_ context.Context, input []*schema.Message, _ ...einomodel.Option) (*schema.Message, error) {
+	m.mu.Lock()
+	defer m.mu.Unlock()
+	m.turns++
+	if m.turns == 1 {
+		return &schema.Message{Role: schema.Assistant, ToolCalls: []schema.ToolCall{{ID: "call-445", Type: "function", Function: schema.FunctionCall{Name: tools.MCPToolName("test", "cluster.list"), Arguments: `{}`}}}}, nil
+	}
+	for _, msg := range input {
+		if msg.Role == schema.Tool && msg.Content == `{"clusters":["test"]}` {
+			m.sawResult = true
+		}
+	}
+	return &schema.Message{Role: schema.Assistant, Content: "Cluster result received"}, nil
+}
+func (m *mcpReviewModel) Stream(ctx context.Context, input []*schema.Message, opts ...einomodel.Option) (*schema.StreamReader[*schema.Message], error) {
+	msg, err := m.Generate(ctx, input, opts...)
+	if err != nil {
+		return nil, err
+	}
+	return schema.StreamReaderFromArray([]*schema.Message{msg}), nil
+}
+func (m *mcpReviewModel) WithTools([]*schema.ToolInfo) (einomodel.ToolCallingChatModel, error) {
+	return m, nil
+}
+
+func TestMCPApprovalRuntimeResumesWithResult(t *testing.T) {
+	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "runtime.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
+	if err != nil {
+		t.Fatal(err)
+	}
+	sqlDB, err := db.DB()
+	if err != nil {
+		t.Fatal(err)
+	}
+	sqlDB.SetMaxOpenConns(1)
+	t.Cleanup(func() {
+		if err := sqlDB.Close(); err != nil {
+			t.Error(err)
+		}
+	})
+	if err := approvalstore.Migrate(db); err != nil {
+		t.Fatal(err)
+	}
+	if err := chatstore.Migrate(db); err != nil {
+		t.Fatal(err)
+	}
+	uc := approval.NewUsecase(approvalstore.NewRepo(db), nil)
+	uc.RegisterExecutor("mcp_call", func(context.Context, string) (string, error) { return `{"clusters":["test"]}`, nil })
+	repo := chatstore.NewSessionRepoWithAttachmentRoot(db, t.TempDir())
+	sess := &chatmodel.Session{ID: "session-445", UserID: 7}
+	if err := repo.CreateSession(context.Background(), sess); err != nil {
+		t.Fatal(err)
+	}
+	model := &mcpReviewModel{}
+	rt, err := runtime.NewRuntime(runtime.Config{Sessions: repo, ChatModel: model, GraphCfg: graph.Config{MaxIterations: 5}, ToolBag: []basetool.BaseTool{tools.NewMCPTool("test", "cluster.list", "List clusters", nil, false, nil, mcpProposerShim{uc: uc}, nil)}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+	defer cancel()
+	events := make(chan *runtime.ApprovalPending, 2)
+	done := make(chan error, 1)
+	go func() {
+		_, err := rt.Handle(ctx, &runtime.Request{SessionID: sess.ID, UserID: 7, UserText: "List clusters", Emit: func(ev runtime.Event) {
+			if ev.Type == runtime.EventApprovalPending {
+				events <- ev.Approval
+			}
+		}})
+		done <- err
+	}()
+	select {
+	case event := <-events:
+		if event.ToolCallID != "call-445" || event.Kind != "mcp_call" || event.ToolName != tools.MCPToolName("test", "cluster.list") {
+			t.Fatalf("invalid live card: %+v", event)
+		}
+		row, err := uc.Get(ctx, event.ApprovalID)
+		if err != nil || row.SessionID != sess.ID {
+			t.Fatalf("approval cannot recover by session: %+v %v", row, err)
+		}
+		if _, err := uc.Approve(ctx, 7, event.ApprovalID); err != nil {
+			t.Fatal(err)
+		}
+	case err := <-done:
+		t.Fatalf("chat ended without card: %v", err)
+	case <-ctx.Done():
+		t.Fatal("no live approval event")
+	}
+	select {
+	case err := <-done:
+		if err != nil {
+			t.Fatal(err)
+		}
+	case <-ctx.Done():
+		t.Fatal("chat did not resume after approval")
+	}
+	model.mu.Lock()
+	defer model.mu.Unlock()
+	if !model.sawResult || model.turns != 2 {
+		t.Fatalf("model did not receive MCP result: turns=%d sawResult=%v", model.turns, model.sawResult)
+	}
+}
```

**File**: `cmd/ongrid/mcp_approval_test.go` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+package main
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"path/filepath"
+	"strings"
+	"sync/atomic"
+	"testing"
+	"time"
+
+	"github.com/glebarez/sqlite"
+	"gorm.io/gorm"
+	"gorm.io/gorm/logger"
+
+	approval "github.com/ongridio/ongrid/internal/manager/biz/approval"
+	store "github.com/ongridio/ongrid/internal/manager/data/approval/store"
+)
+
+func TestMCPApprovalLifecycle(t *testing.T) {
+	for _, decision := range []string{"approve", "reject", "failure", "cancel"} {
+		t.Run(decision, func(t *testing.T) {
+			db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "approvals.db")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
+			if err != nil {
+				t.Fatal(err)
+			}
+			sqlDB, err := db.DB()
+			if err != nil {
+				t.Fatal(err)
+			}
+			sqlDB.SetMaxOpenConns(1)
+			t.Cleanup(func() {
+				if err := sqlDB.Close(); err != nil {
+					t.Error(err)
+				}
+			})
+			if err := store.Migrate(db); err != nil {
+				t.Fatal(err)
+			}
+			uc := approval.NewUsecase(store.NewRepo(db), nil)
+			var executions atomic.Int32
+			uc.RegisterExecutor("mcp_call", func(_ context.Context, payload string) (string, error) {
+				executions.Add(1)
+				var p mcpCallPayload
+				if err := json.Unmarshal([]byte(payload), &p); err != nil {
+					return "", err
+				}
+				if p.Server != "test" || p.Tool != "cluster.list" || p.Arguments["limit"] != float64(20) {
+					return "", errors.New("incorrect frozen payload")
+				}
+				if decision == "failure" {
+					return "", errors.New("remote failed")
+				}
+				return `{"clusters":["test"]}`, nil
+			})
+			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+			defer cancel()
+			type outcome struct {
+				result string
+				err    error
+			}
+			done := make(chan outcome, 1)
+			go func() {
+				result, err := (mcpProposerShim{uc: uc}).ProposeMCPCallAndAwait(ctx, "test", "cluster.list", map[string]any{"limit": 20}, "session-445", "call-445", 7)
+				done <- outcome{result, err}
+			}()
+			var id string
+			for id == "" && ctx.Err() == nil {
+				rows, err := uc.List(ctx, "pending", 10)
+				if err != nil {
+					t.Fatal(err)
+				}
+				if len(rows) > 0 {
+					if rows[0].SessionID != "session-445" || rows[0].ProposedBy != 7 {
+						t.Fatalf("proposal lost session/user: %+v", rows[0])
+					}
+					id = rows[0].ID
+				} else {
+					time.Sleep(10 * time.Millisecond)
+				}
+			}
+			if id == "" {
+				t.Fatal("proposal not created")
+			}
+			select {
+			case got := <-done:
+				t.Fatalf("returned before human decision: %+v", got)
+			default:
+			}
+			if executions.Load() != 0 {
+				t.Fatal("executed before confirmation")
+			}
+			want := `{"clusters":["test"]}`
+			switch decision {
+			case "reject":
+				if err := uc.Reject(ctx, 7, id, "no"); err != nil {
+					t.Fatal(err)
+				}
+				want = `"status":"rejected"`
+			case "cancel":
+				cancel()
+				want = `"status":"cancelled"`
+			default:
+				if _, err := uc.Approve(ctx, 7, id); err != nil {
+					t.Fatal(err)
+				}
+				if _, err := uc.Approve(ctx, 7, id); err == nil {
+					t.Fatal("duplicate approval accepted")
+				}
+				if decision == "failure" {
+					want = "remote failed"
+				}
+			}
+			select {
+			case got := <-done:
+				if got.err != nil || !strings.Contains(got.result, want) {
+					t.Fatalf("unexpected outcome: %+v; want %s", got, want)
+				}
+			case <-time.After(5 * time.Second):
+				t.Fatal("approval did not complete")
+			}
+			wantCalls := int32(1)
+			if decision == "reject" || decision == "cancel" {
+				wantCalls = 0
+			}
+			if executions.Load() != wantCalls {
+				t.Fatalf("executions = %d, want %d", executions.Load(), wantCalls)
+			}
+		})
+	}
+}
```

**File**: `internal/manager/biz/aiops/tools/mcp_basetool.go` (modified, +10/-14)
```diff
@@ -13,6 +13,8 @@ import (
 	"log/slog"
 	"strings"
 
+	"github.com/cloudwego/eino/compose"
+
 	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
 )
 
@@ -21,10 +23,9 @@ type MCPCaller interface {
 	CallMCPTool(ctx context.Context, server, tool string, args map[string]any) (string, error)
 }
 
-// MCPProposer queues an MCP call for human approval (default path), returning
-// the approval id.
+// MCPProposer waits for human approval and returns the executed tool result.
 type MCPProposer interface {
-	ProposeMCPCall(ctx context.Context, server, tool string, args map[string]any, sessionID string, userID uint64) (id string, err error)
+	ProposeMCPCallAndAwait(ctx context.Context, server, tool string, args map[string]any, sessionID, toolCallID string, userID uint64) (string, error)
 }
 
 // MCPTool is the BaseTool wrapping one (server, tool) pair.
@@ -140,18 +141,13 @@ func (t *MCPTool) InvokableRun(ctx context.Context, argsJSON string, opts ...bas
 		return "", fmt.Errorf("mcp %s: approval not wired", t.wireName)
 	}
 	cfg := basetool.ResolveOptions(opts)
-	id, err := t.proposer.ProposeMCPCall(ctx, t.server, t.bareName, args, "", cfg.UserID)
+	toolCallID := compose.GetToolCallID(ctx)
+	if toolCallID == "" {
+		toolCallID = basetool.ToolCallIDFromContext(ctx)
+	}
+	result, err := t.proposer.ProposeMCPCallAndAwait(ctx, t.server, t.bareName, args, basetool.SessionIDFromContext(ctx), toolCallID, cfg.UserID)
 	if err != nil {
 		return "", fmt.Errorf("mcp %s: propose: %w", t.wireName, err)
 	}
-	out := map[string]any{
-		"status":      "pending_approval",
-		"approval_id": id,
-		// LLM-facing instruction (same contract as cloud_bash): the inline
-		// confirmation card is already rendered; don't point at a page or
-		// restate the call.
-		"message": "An interactive confirmation card is now shown inline in this conversation. Do NOT tell the user to open any page or menu, do NOT restate the call, approval id, or a status table. Reply with a single short sentence saying this external MCP action needs the user's confirmation in this conversation before it runs.",
-	}
-	b, _ := json.Marshal(out)
-	return string(b), nil
+	return result, nil
 }
```

**File**: `internal/manager/biz/aiops/tools/mcp_basetool_test.go` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+package tools
+
+import (
+	"context"
+	"errors"
+	"testing"
+
+	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
+)
+
+type mcpApprovalFunc func(context.Context, string, string, map[string]any, string, string, uint64) (string, error)
+
+func (f mcpApprovalFunc) ProposeMCPCallAndAwait(ctx context.Context, server, tool string, args map[string]any, session, call string, user uint64) (string, error) {
+	return f(ctx, server, tool, args, session, call, user)
+}
+
+type mcpCallerFunc func(context.Context, string, string, map[string]any) (string, error)
+
+func (f mcpCallerFunc) CallMCPTool(ctx context.Context, server, tool string, args map[string]any) (string, error) {
+	return f(ctx, server, tool, args)
+}
+
+func TestMCPToolApprovalReturnsResultAndIdentity(t *testing.T) {
+	ctx := basetool.WithToolCallID(basetool.WithSessionID(context.Background(), "session-445"), "call-445")
+	for _, result := range []string{`{"clusters":["test"]}`, `{"status":"rejected"}`, `{"error":"remote failed"}`} {
+		t.Run(result, func(t *testing.T) {
+			proposer := mcpApprovalFunc(func(_ context.Context, server, tool string, args map[string]any, session, call string, user uint64) (string, error) {
+				if server != "test" || tool != "cluster.list" || args["limit"] != float64(20) || session != "session-445" || call != "call-445" || user != 7 {
+					t.Fatalf("incorrect proposal identity: %s %s %v %s %s %d", server, tool, args, session, call, user)
+				}
+				return result, nil
+			})
+			tool := NewMCPTool("test", "cluster.list", "", nil, false, nil, proposer, nil)
+			got, err := tool.InvokableRun(ctx, `{"limit":20}`, basetool.WithUserID(7))
+			if err != nil || got != result {
+				t.Fatalf("got %q, %v; want executor result %q", got, err, result)
+			}
+		})
+	}
+}
+
+func TestMCPToolTrustedAndErrorPaths(t *testing.T) {
+	wantErr := errors.New("approval unavailable")
+	proposer := mcpApprovalFunc(func(context.Context, string, string, map[string]any, string, string, uint64) (string, error) {
+		return "", wantErr
+	})
+	tool := NewMCPTool("test", "cluster.list", "", nil, false, nil, proposer, nil)
+	if _, err := tool.InvokableRun(context.Background(), `{}`); !errors.Is(err, wantErr) {
+		t.Fatalf("proposal error not preserved: %v", err)
+	}
+	if _, err := tool.InvokableRun(context.Background(), `{`); err == nil {
+		t.Fatal("invalid arguments accepted")
+	}
+	caller := mcpCallerFunc(func(context.Context, string, string, map[string]any) (string, error) { return "trusted result", nil })
+	trusted := NewMCPTool("test", "cluster.list", "", nil, true, caller, proposer, nil)
+	if got, err := trusted.InvokableRun(context.Background(), `{}`); err != nil || got != "trusted result" {
+		t.Fatalf("trusted tool unexpectedly required approval: %q %v", got, err)
+	}
+}
```

---

### Incident Patch 7: `b385560b` (2026-09-29)
**Commit Message**: fix(edge): tune telemetry capacity budgets for v0.17.5 (#444)

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

**File**: `README_JA.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 中国本土ユーザー** — GitHub が遅い場合は、アーキテクチャに合う CDN ミラー URL を使用してください：
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## 製品ツアー
```

**File**: `README_KO.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 중국 본토 사용자** — GitHub이 느리면 아키텍처에 맞는 CDN 미러 URL을 사용하세요:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## 제품 둘러보기
```

**File**: `README_PT.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Escolha o comando para a arquitetura do seu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — se o GitHub estiver lento, use a URL do mirror CDN correspondente à sua arquitetura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Tour do produto
```

**File**: `README_RU.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.5-linux-amd64.tar.xz && cd ongrid-v0.17.5-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.5/ongrid-v0.17.5-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.5-linux-arm64.tar.xz && cd ongrid-v0.17.5-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Материковый Китай** — если GitHub медленный, используйте URL CDN-зеркала для вашей архитектуры:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.5-linux-arm64.tar.xz
 ```
 
 ## Обзор продукта
```

---

### Incident Patch 8: `b9b9f57a` (2026-09-28)
**Commit Message**: fix(k8s): preserve capabilities across JVM credential changes

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -52,6 +52,9 @@ jobs:
       - name: go test
         run: go test -race ./...
 
+      - name: Kubernetes JVM attach capabilities
+        run: make test-k8s-capabilities
+
   web-test:
     name: web test + build
     runs-on: ubuntu-24.04
```

**File**: `Makefile` (modified, +11/-0)
```diff
@@ -119,6 +119,17 @@ test: ## 单元测试
 test-race: ## 单元测试 + race
 	go test -race ./...
 
+.PHONY: test-k8s-capabilities
+test-k8s-capabilities: ## 隔离 Linux 环境验证节点 JVM attach 权限（需要 root/sudo）
+	@test "$$(uname -s)" = Linux || { echo 'Linux is required'; exit 1; }
+	@set -eu; tmp_dir=$$(mktemp -d); trap 'rm -rf "$$tmp_dir"' EXIT; \
+	go test -race -c -o "$$tmp_dir/edge.test" ./cmd/ongrid-edge; \
+	if [ "$$(id -u)" = 0 ]; then \
+		env ONGRID_TEST_K8S_CAPABILITIES=1 "$$tmp_dir/edge.test" -test.v -test.timeout=45s -test.run='^TestK8sHostCapabilitiesSurviveJVMAttach$$'; \
+	else \
+		sudo env ONGRID_TEST_K8S_CAPABILITIES=1 "$$tmp_dir/edge.test" -test.v -test.timeout=45s -test.run='^TestK8sHostCapabilitiesSurviveJVMAttach$$'; \
+	fi
+
 .PHONY: test-edge-metrics-env
 test-edge-metrics-env: ## Edge 诊断端口安装配置保留检查
 	bash -n deploy/install/edge/install.sh deploy/install/edge/install-edge.sh
```

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

**File**: `README_JA.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 中国本土ユーザー** — GitHub が遅い場合は、アーキテクチャに合う CDN ミラー URL を使用してください：
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## 製品ツアー
```

**File**: `README_KO.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.4-linux-amd64.tar.xz && cd ongrid-v0.17.4-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.4/ongrid-v0.17.4-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.4-linux-arm64.tar.xz && cd ongrid-v0.17.4-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 중국 본토 사용자** — GitHub이 느리면 아키텍처에 맞는 CDN 미러 URL을 사용하세요:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.4-linux-arm64.tar.xz
 ```
 
 ## 제품 둘러보기
```

---

### Incident Patch 9: `6c3827fd` (2026-09-28)
**Commit Message**: fix(k8s): handle auto APM node name mismatches (#434)

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

**File**: `README_JA.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 中国本土ユーザー** — GitHub が遅い場合は、アーキテクチャに合う CDN ミラー URL を使用してください：
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## 製品ツアー
```

**File**: `README_KO.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 중국 본토 사용자** — GitHub이 느리면 아키텍처에 맞는 CDN 미러 URL을 사용하세요:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## 제품 둘러보기
```

**File**: `README_PT.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Escolha o comando para a arquitetura do seu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — se o GitHub estiver lento, use a URL do mirror CDN correspondente à sua arquitetura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Tour do produto
```

**File**: `README_RU.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.2-linux-amd64.tar.xz && cd ongrid-v0.17.2-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.3-linux-amd64.tar.xz && cd ongrid-v0.17.3-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.2/ongrid-v0.17.2-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.2-linux-arm64.tar.xz && cd ongrid-v0.17.2-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.3/ongrid-v0.17.3-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.3-linux-arm64.tar.xz && cd ongrid-v0.17.3-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Материковый Китай** — если GitHub медленный, используйте URL CDN-зеркала для вашей архитектуры:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.2-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.3-linux-arm64.tar.xz
 ```
 
 ## Обзор продукта
```

---

### Incident Patch 10: `5e22ec49` (2026-09-24)
**Commit Message**: fix(k8s): remove the node auto APM capability switch (#432)

**File**: `cmd/ongrid-edge/k8s_host_runtime.go` (modified, +5/-8)
```diff
@@ -52,14 +52,17 @@ func runK8sHostCommand(ctx context.Context, args []string) (bool, error) {
 		if err != nil {
 			return true, fmt.Errorf("resolve edge executable: %w", err)
 		}
-		return true, installK8sHostRuntime(ctx, k8sHostInstallPaths{
+		if err := installK8sHostRuntime(ctx, k8sHostInstallPaths{
 			hostRoot:             args[1],
 			edgeSource:           executable,
 			pluginSourceDir:      containerPluginDir,
 			serviceAccountSource: containerServiceAccountDir,
 			uid:                  uid,
 			gid:                  gid,
-		})
+		}); err != nil {
+			return true, err
+		}
+		return true, prepareK8sOBIFilesystem(ctx, args[1], uid, gid)
 	case enterK8sHostCommand:
 		if len(args) != 4 {
 			return true, fmt.Errorf("usage: %s <host-root> <uid> <gid>", enterK8sHostCommand)
@@ -108,12 +111,6 @@ func installK8sHostRuntime(ctx context.Context, paths k8sHostInstallPaths) error
 	if !info.IsDir() {
 		return fmt.Errorf("host root %q is not a directory", paths.hostRoot)
 	}
-	if os.Getenv("ONGRID_AUTO_APM_ALLOW_BPF") == "true" {
-		if err := prepareK8sOBIFilesystem(ctx, paths.hostRoot, paths.uid, paths.gid); err != nil {
-			return err
-		}
-	}
-
 	runtimeDir := hostPath(paths.hostRoot, k8sHostRuntimeDir)
 	pluginDir := hostPath(paths.hostRoot, k8sHostPluginDir)
 	serviceAccountDir := hostPath(paths.hostRoot, k8sHostServiceAccountDir)
```

**File**: `cmd/ongrid-edge/k8s_host_runtime_linux.go` (modified, +25/-19)
```diff
@@ -6,6 +6,7 @@ import (
 	"context"
 	"errors"
 	"fmt"
+	"log/slog"
 	"os"
 	"path/filepath"
 	"runtime"
@@ -21,9 +22,22 @@ const (
 	procHostMountNamespace     = "/proc/1/ns/mnt"
 )
 
+// Keep the Chart's node capabilities across the non-root host identity transition.
+// OBI needs SYS_ADMIN for Go propagation, setns and restrictive perf policies;
+// JVM attach also needs SYS_CHROOT and SETUID/SETGID for target credentials.
 var k8sHostCapabilities = []int{
 	unix.CAP_DAC_READ_SEARCH,
 	unix.CAP_NET_ADMIN,
+	unix.CAP_BPF,
+	unix.CAP_PERFMON,
+	unix.CAP_SYS_PTRACE,
+	unix.CAP_CHECKPOINT_RESTORE,
+	unix.CAP_NET_RAW,
+	unix.CAP_SYS_ADMIN,
+	unix.CAP_SYS_RESOURCE,
+	unix.CAP_SYS_CHROOT,
+	unix.CAP_SETUID,
+	unix.CAP_SETGID,
 }
 
 // Give non-root OBI its own bpffs directory; never change ownership or mode of
@@ -34,11 +48,16 @@ func prepareK8sOBIFilesystem(ctx context.Context, root string, uid, gid int) err
 	}
 	base := hostPath(root, "/sys/fs/bpf")
 	var stat unix.Statfs_t
-	if err := unix.Statfs(base, &stat); err != nil {
-		return fmt.Errorf("OBI requires mounted host bpffs at /sys/fs/bpf: %w", err)
+	err := unix.Statfs(base, &stat)
+	if errors.Is(err, os.ErrNotExist) || (err == nil && stat.Type != unix.BPF_FS_MAGIC) {
+		// OBI can capture without pinned maps. Do not turn an optional APM
+		// facility into a startup requirement for metrics and logs, or create
+		// a pin directory on a filesystem that cannot hold BPF objects.
+		slog.WarnContext(ctx, "host bpffs is not mounted; skipping optional OBI map pinning directory")
+		return nil
 	}
-	if stat.Type != unix.BPF_FS_MAGIC {
-		return fmt.Errorf("OBI requires a bpf filesystem mounted at host /sys/fs/bpf")
+	if err != nil {
+		return fmt.Errorf("inspect host bpffs at /sys/fs/bpf: %w", err)
 	}
 	return ensureOwnedDirectory(filepath.Join(base, "ongrid"), uid, gid, 0750)
 }
@@ -112,7 +131,7 @@ func linuxLastCapability() int {
 }
 
 func dropToHostEdgeUser(uid, gid, lastCapability int) error {
-	capabilities := retainedK8sHostCapabilities()
+	capabilities := k8sHostCapabilities
 	for capability := 0; capability <= lastCapability; capability++ {
 		if isK8sHostCapability(capability) {
 			continue
@@ -155,23 +174,10 @@ func dropToHostEdgeUser(uid, gid, lastCapability int) error {
 }
 
 func isK8sHostCapability(capability int) bool {
-	for _, allowed := range retainedK8sHostCapabilities() {
+	for _, allowed := range k8sHostCapabilities {
 		if capability == allowed {
 			return true
 		}
 	}
 	return false
 }
-
-// Helm explicitly grants these capabilities only for opted-in nodes. SYS_ADMIN
-// is needed by official OBI for Go propagation, setns and restrictive perf policies.
-// JVM attach also needs SYS_CHROOT for mount namespaces and SETUID/SETGID
-// to match the target process credentials.
-// Preserve the granted capabilities across the non-root host identity transition.
-func retainedK8sHostCapabilities() []int {
-	out := append([]int(nil), k8sHostCapabilities...)
-	if os.Getenv("ONGRID_AUTO_APM_ALLOW_BPF") == "true" {
-		out = append(out, unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID)
-	}
-	return out
-}
```

**File**: `cmd/ongrid-edge/k8s_host_runtime_linux_test.go` (modified, +26/-31)
```diff
@@ -6,20 +6,28 @@ import (
 	"context"
 	"os"
 	"path/filepath"
-	"strings"
 	"testing"
 
 	"golang.org/x/sys/unix"
 )
 
-func TestOBIFilesystemRejectsUnMountedDirectory(t *testing.T) {
-	root := t.TempDir()
-	if err := os.MkdirAll(filepath.Join(root, "sys/fs/bpf"), 0755); err != nil {
-		t.Fatal(err)
-	}
-	err := prepareK8sOBIFilesystem(context.Background(), root, os.Getuid(), os.Getgid())
-	if err == nil || !strings.Contains(err.Error(), "bpf filesystem mounted") {
-		t.Fatalf("ordinary directory accepted as bpffs: %v", err)
+func TestOBIFilesystemWithoutBPFFSDoesNotBlockNodeStartup(t *testing.T) {
+	for _, name := range []string{"missing", "unmounted"} {
+		t.Run(name, func(t *testing.T) {
+			root := t.TempDir()
+			base := filepath.Join(root, "sys/fs/bpf")
+			if name == "unmounted" {
+				if err := os.MkdirAll(base, 0755); err != nil {
+					t.Fatal(err)
+				}
+			}
+			if err := prepareK8sOBIFilesystem(context.Background(), root, os.Getuid(), os.Getgid()); err != nil {
+				t.Fatalf("optional bpffs blocks node startup: %v", err)
+			}
+			if _, err := os.Stat(filepath.Join(base, "ongrid")); !os.IsNotExist(err) {
+				t.Fatalf("must not create a pin directory outside bpffs: %v", err)
+			}
+		})
 	}
 }
 
@@ -43,29 +51,16 @@ func TestRequiresHostMountNamespace(t *testing.T) {
 	}
 }
 
-func TestK8sHostCapabilities(t *testing.T) {
-	t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", "false")
-	for _, capability := range []int{unix.CAP_DAC_READ_SEARCH, unix.CAP_NET_ADMIN} {
-		if !isK8sHostCapability(capability) {
-			t.Fatalf("capability %d is not retained", capability)
-		}
-	}
-	if isK8sHostCapability(unix.CAP_SYS_ADMIN) {
-		t.Fatal("CAP_SYS_ADMIN must be dropped before starting the host edge")
-	}
-}
-
-func TestAutoAPMCapabilitiesRequireOptIn(t *testing.T) {
-	t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", "false")
-	for _, cap := range []int{unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID} {
-		if isK8sHostCapability(cap) {
-			t.Fatalf("default granted capture capability %d", cap)
+func TestK8sHostCapabilitiesDoNotDependOnLegacySwitch(t *testing.T) {
+	for _, value := range []string{"", "false", "true"} {
+		t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", value)
+		for _, capability := range []int{unix.CAP_DAC_READ_SEARCH, unix.CAP_NET_ADMIN, unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID} {
+			if !isK8sHostCapability(capability) {
+				t.Fatalf("legacy switch %q: capability %d is not retained", value, capability)
+			}
 		}
-	}
-	t.Setenv("ONGRID_AUTO_APM_ALLOW_BPF", "true")
-	for _, cap := range []int{unix.CAP_BPF, unix.CAP_PERFMON, unix.CAP_SYS_PTRACE, unix.CAP_CHECKPOINT_RESTORE, unix.CAP_NET_RAW, unix.CAP_SYS_ADMIN, unix.CAP_SYS_RESOURCE, unix.CAP_SYS_CHROOT, unix.CAP_SETUID, unix.CAP_SETGID} {
-		if !isK8sHostCapability(cap) {
-			t.Fatalf("missing capability %d", cap)
+		if isK8sHostCapability(unix.CAP_SYS_BOOT) {
+			t.Fatal("unrelated CAP_SYS_BOOT must be dropped")
 		}
 	}
 }
```

**File**: `deploy/kubernetes/ongrid-edge/templates/daemonset.yaml` (modified, +8/-6)
```diff
@@ -23,7 +23,7 @@ spec:
       annotations:
         checksum/config: {{ $nodeConfigChecksum }}
         checksum/node-bootstrap: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
-        {{- if and .Values.node.autoAPM.allowBPF (not (semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version)) }}
+        {{- if not (semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version) }}
         container.apparmor.security.beta.kubernetes.io/edge-node: unconfined
         {{- end }}
       labels:
@@ -54,8 +54,9 @@ spec:
             - {{ .Values.podSecurity.runAsUser | quote }}
             - {{ .Values.podSecurity.runAsGroup | quote }}
           env:
+            # Compatibility for older Edge images; current images ignore this gate.
             - name: ONGRID_AUTO_APM_ALLOW_BPF
-              value: {{ .Values.node.autoAPM.allowBPF | quote }}
+              value: "true"
           resources:
             requests:
               cpu: 5m
@@ -146,8 +147,9 @@ spec:
                   fieldPath: metadata.namespace
             - name: ONGRID_EDGE_COLLECTOR_MODE
               value: {{ .Values.node.collectorMode | quote }}
+            # Compatibility for older Edge images; current images ignore this gate.
             - name: ONGRID_AUTO_APM_ALLOW_BPF
-              value: {{ .Values.node.autoAPM.allowBPF | quote }}
+              value: "true"
             - name: HOST_PROC
               value: /proc
             - name: HOST_SYS
@@ -162,15 +164,15 @@ spec:
             runAsGroup: 0
             allowPrivilegeEscalation: false
             readOnlyRootFilesystem: true
-            {{- if and .Values.node.autoAPM.allowBPF (semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version) }}
+            {{- if semverCompare ">=1.30-0" .Capabilities.KubeVersion.Version }}
             # Host process inspection and bpffs writes cross the runtime's
-            # default AppArmor boundary. This applies only to the opted-in node.
+            # default AppArmor boundary. These permissions apply to the node Agent.
             appArmorProfile:
               type: Unconfined
             {{- end }}
             capabilities:
               drop: ["ALL"]
-              add: ["DAC_READ_SEARCH", "NET_ADMIN", "SETGID", "SETPCAP", "SETUID", "SYS_CHROOT"{{ if .Values.node.autoAPM.allowBPF }}, "BPF", "PERFMON", "SYS_PTRACE", "CHECKPOINT_RESTORE", "NET_RAW", "SYS_ADMIN", "SYS_RESOURCE"{{ end }}]
+              add: ["DAC_READ_SEARCH", "NET_ADMIN", "SETGID", "SETPCAP", "SETUID", "SYS_CHROOT", "BPF", "PERFMON", "SYS_PTRACE", "CHECKPOINT_RESTORE", "NET_RAW", "SYS_ADMIN", "SYS_RESOURCE"]
           volumeMounts:
             - name: host-root
               mountPath: /host/root
```

**File**: `deploy/kubernetes/ongrid-edge/templates/rbac.yaml` (modified, +1/-3)
```diff
@@ -172,10 +172,9 @@ subjects:
     name: {{ include "ongrid-edge.controllerServiceAccount" . }}
     namespace: {{ .Release.Namespace }}
 
-{{- if .Values.node.autoAPM.allowBPF }}
 ---
 # OBI resolves stable workload selectors from Kubernetes metadata. This role
-# exists only when the operator explicitly enables node auto-instrumentation.
+# is available to node Agents; OBI still requires configured capture targets.
 apiVersion: rbac.authorization.k8s.io/v1
 kind: ClusterRole
 metadata:
@@ -204,4 +203,3 @@ subjects:
   - kind: ServiceAccount
     name: {{ include "ongrid-edge.nodeServiceAccount" . }}
     namespace: {{ .Release.Namespace }}
-{{- end }}
```

**File**: `deploy/kubernetes/ongrid-edge/values.yaml` (modified, +1/-8)
```diff
@@ -19,14 +19,7 @@ image:
   pullPolicy: IfNotPresent
 
 node:
-  # Installation capability gate; capture still requires cluster-owned namespace/workload selection.
-  autoAPM:
-    # Grants official OBI capabilities, including SYS_ADMIN for Go propagation,
-    # network namespace access and restrictive perf policies, plus SYS_RESOURCE
-    # for older kernels. Retains SYS_CHROOT, SETUID and SETGID for JVM attach.
-    # Node AppArmor is unconfined to inspect host processes
-    # and write only its owned bpffs directory. Never privileged.
-    allowBPF: false
+  # Node capture capabilities are always prepared; OBI starts only for selected targets.
   serviceAccountName: ""
   # hostmetrics exposes node_exporter and the metrics plugin forwards it.
   # Keep the legacy embedded periodic push off to avoid duplicate node_* series.
```

**File**: `docs/adr/ADR-034-obi-selective-apm.md` (modified, +12/-4)
```diff
@@ -18,7 +18,7 @@ OBI 仅向 loopback 的 OTLP 14317/14318 导出。Collector 健康端口 14333
 
 ## 部署及边界
 
-Linux amd64/arm64，要求内核 BTF 和相应 eBPF 能力。原生服务通常以 root 运行；受限部署需要 CAP_DAC_READ_SEARCH、CAP_SYS_PTRACE、CAP_PERFMON、CAP_BPF、CAP_CHECKPOINT_RESTORE、CAP_NET_ADMIN、CAP_NET_RAW。Kubernetes 需先设置 Helm `node.autoAPM.allowBPF=true` 授予节点权限，再在设备插件中开启。默认 false 不扩展现有节点权限。更新策略禁止 surge，避免同节点两个探针。Kubernetes 元数据自动探测关闭，当前使用用户指定服务身份，不新增 API Server RBAC。
+Linux amd64/arm64，要求内核 BTF 和相应 eBPF 能力。原生服务通常以 root 运行；受限部署需要 CAP_DAC_READ_SEARCH、CAP_SYS_PTRACE、CAP_PERFMON、CAP_BPF、CAP_CHECKPOINT_RESTORE、CAP_NET_ADMIN、CAP_NET_RAW。Kubernetes 节点部署自动准备采集权限，用户保存目标后启动 OBI（节点部署开关已于 2026-09-24 取消，见下文）。更新策略禁止 surge，避免同节点两个探针。Kubernetes 元数据自动探测关闭，当前使用用户指定服务身份，不新增 API Server RBAC。
 
 按节点选择进程是本期范围；不提供独立 OBI DaemonSet、工作负载策略或跨节点规则同步。多容器同路径同端口会一起匹配；只采部分工作负载时应等待工作负载选择能力。HTTP/gRPC 支持范围受 OBI、语言、加密方式和内核限制，不承诺所有监听进程均可采集。应用内原有 Trace 上下文和第三方中间件的端到端传播需要环境验收。
 
@@ -91,16 +91,24 @@ Manager 复用 Kubernetes Cluster.NodeID 映射，在下发 OBI、SDK Collector
 
 ## 官方 OBI 权限与启动预检（2026-09-21）
 
-Kubernetes 开启 `node.autoAPM.allowBPF=true` 时，节点容器及切换到非 root 的宿主机 Edge 都保留官方能力集合：`BPF`、`NET_RAW`、`NET_ADMIN`、`PERFMON`、`DAC_READ_SEARCH`、`CHECKPOINT_RESTORE`、`SYS_PTRACE`、`SYS_RESOURCE`、`SYS_ADMIN`。`SYS_RESOURCE` 主要用于 5.11 以下内核的锁定内存限制；统一清单仍保留此项。`SYS_ADMIN` 用于 Go 库级上下文传播、网络命名空间访问及发行版 perf 限制。该变更覆盖上文旧权限清单，但不启用 privileged；默认未开启 BPF 的安装不增加这些权限。
+Kubernetes 节点容器及切换到非 root 的宿主机 Edge 都保留官方能力集合：`BPF`、`NET_RAW`、`NET_ADMIN`、`PERFMON`、`DAC_READ_SEARCH`、`CHECKPOINT_RESTORE`、`SYS_PTRACE`、`SYS_RESOURCE`、`SYS_ADMIN`。`SYS_RESOURCE` 主要用于 5.11 以下内核的锁定内存限制；统一清单仍保留此项。`SYS_ADMIN` 用于 Go 库级上下文传播、网络命名空间访问及发行版 perf 限制。该变更覆盖上文旧权限清单，但不启用 privileged；实际采集仍由用户保存的目标控制。
 
 非 root 的 JVM attach 还需要保留启动器已有的 `SYS_CHROOT`：Linux `setns(CLONE_NEWNS)` 同时要求 `SYS_ADMIN` 和 `SYS_CHROOT`，实测仅官方九项时返回 EPERM，补充后成功。同时保留启动器已有的 `SETUID`、`SETGID`，供官方 JVM attach 匹配目标进程的 UID/GID；本地 Java 使用 UID 65532、GID 0，与 Edge GID 不同，缺少 SETGID 时已实际报凭据切换失败。以上权限仅在开启 BPF 时继续保留，参见 [setns(2)](https://man7.org/linux/man-pages/man2/setns.2.html)。
 
-采集节点的 AppArmor 配置为 Unconfined，以允许宿主机进程检查及 bpffs 访问；这仅作用于显式启用 OBI 的节点容器，不关闭宿主机 AppArmor。Kubernetes 1.30 以前使用兼容 annotation，之后使用 securityContext.appArmorProfile。节点启动器仍切换到配置的非 root UID，保留只读容器根文件系统及 allowPrivilegeEscalation=false。宿主机须挂载 `/sys/fs/bpf`，安装器只创建、授权 `/sys/fs/bpf/ongrid`，不修改 bpffs 根目录或其他 Agent 的目录。OBI 通过官方 `ebpf.bpf_fs_path` 使用该目录；tracefs、cgroup 与 procfs 通过既有 host-root 挂载及 chroot 可见。Kubernetes RBAC 仍只读 Pods、Nodes、ReplicaSets。
+采集节点的 AppArmor 配置为 Unconfined，以允许宿主机进程检查及 bpffs 访问；这仅作用于节点容器，不关闭宿主机 AppArmor。Kubernetes 1.30 以前使用兼容 annotation，之后使用 securityContext.appArmorProfile。节点启动器仍切换到配置的非 root UID，保留只读容器根文件系统及 allowPrivilegeEscalation=false。宿主机已挂载 `/sys/fs/bpf` 时，安装器只创建、授权 `/sys/fs/bpf/ongrid`，不修改 bpffs 根目录或其他 Agent 的目录。未挂载时仅记录警告并跳过，不阻断节点启动；OBI 降级固定 map 相关功能，基础 APM 采集不依赖该挂载。OBI 通过官方 `ebpf.bpf_fs_path` 使用该目录；tracefs、cgroup 与 procfs 通过既有 host-root 挂载及 chroot 可见。Kubernetes RBAC 仍只读 Pods、Nodes、ReplicaSets。
 
 启动采集前，Edge 用自身实际身份执行一次 disabled uprobe 的 `perf_event_open` 并立即关闭，不加载或执行额外 BPF 程序。失败通过现有插件 health.last_error 上报操作、内核 perf 设置和修正方向，随后由既有 Supervisor 重试；未选目标的发现流程不执行此检查。此检查确认基础探针权限，不等于所有目标、TLS 或语言版本都已完成采集验收。
 
 本地 Lima Ubuntu 6.8 对照实验中，单独将 perf_event_paranoid 从 4 改为 2 未解决问题；相同非 root 用户加入 SYS_ADMIN 后 uprobe 打开成功。因此恢复原值 4，适配部署权限，禁止 Agent 自动修改宿主机 sysctl。官方 OBI 二进制及源码保持不变。
 
 Lima Kubernetes 实测通过：非 root OBI 进程保留以上权限，Go HTTP/gRPC、Go 运行时指标、Java 堆/非堆内存指标与三个应用的容器日志可查询；Go → Python → Java 的同一 Trace ID 及客户端/服务端父子关系正确。相关 Linux race 测试、Edge 双架构编译和 Helm 兼容模板测试通过。此结果仅覆盖该 Ubuntu 6.8 ARM64 测试集群，不代替其他内核、架构或语言版本验收。
 
-参考：https://opentelemetry.io/docs/zero-code/obi/security/ 。回滚须同时恢复 Edge 镜像与 Helm chart；若不再需要 OBI，先清空采集范围，再关闭 allowBPF。内核参数不随部署变更。
+参考：https://opentelemetry.io/docs/zero-code/obi/security/ 。回滚须同时恢复 Edge 镜像与 Helm chart；若不再需要 OBI，清空采集范围即可停止探针。内核参数不随部署变更。
+
+## 取消节点部署开关（2026-09-24）
+
+节点统一准备上述 OBI 能力、AppArmor 与只读 RBAC，移除 `node.autoAPM.allowBPF` 配置及 Edge、启动器对 `ONGRID_AUTO_APM_ALLOW_BPF` 的判断，取代上文需要额外开启的部署约定。Chart 为兼容旧 Edge 镜像仍固定传入旧环境变量 `true`，旧 values 中的 `allowBPF=false` 不再控制渲染结果。
+
+用户仍需保存采集目标才启动 OBI 或其 Collector；清空目标停止采集，平台、BTF 和实际 uprobe 权限校验保留。节点运行时安装在宿主机已挂载 bpffs 时准备专属目录，未挂载时警告并跳过，避免影响普通指标、日志和服务发现；Agent 不主动挂载 bpffs 或修改内核参数。OBI v0.12.1 的 `setupOtelBPFFSPath` 在目录不可用时关闭 map pinning 并继续采集，参见 [上游实现](https://github.com/open-telemetry/opentelemetry-ebpf-instrumentation/blob/v0.12.1/pkg/ebpf/tracer_linux.go#L159-L195)。仍不启用 privileged。
+
+安装和升级命令保持原有流程。合并后随新的 Chart 和 Edge 版本一同发布，已有集群执行针对新版本的升级命令；发布动作不会自动更新已安装集群。停止采集使用空目标配置；恢复旧部署权限需同时回滚 Chart 和 Edge 镜像。
```

**File**: `docs/requirements/PRD-008-obi-selective-apm.md` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
 - 规则保存在集群，节点执行 OBI 元数据选择器；Pod 重建、扩容、节点加入后无需重新勾选。控制器不运行 OBI。
 - Kubernetes 环境直接继承集群默认环境，服务命名空间取实际 Kubernetes Namespace，不允许额外覆盖；Namespace 全选保留各工作负载服务名称。
 - 节点状态显示真实心跳与错误，配置保存、运行状态不等同于已收到服务数据。清空规则停止 OBI；集群基础设施清单同步仍由既有控制器维护。
-- 部署仍需显式 `node.autoAPM.allowBPF=true`；仅在此开关开启时授予 OBI 读取 pods/nodes/replicasets 元数据的权限。默认安装权限不变。
+- Helm Chart 统一准备节点 OBI 能力及读取 pods/nodes/replicasets 元数据的权限，不再提供 `node.autoAPM.allowBPF` 开关。用户保存采集目标后启动探针，清空目标停止采集；普通安装和升级命令无需追加参数。
 - MySQL 生产发布先执行 `20260916160000_add_k8s_autoapm_config.up.sql`。回滚前清空集群规则，再回滚 Edge 和 Manager；新增列可保留，避免丢失配置。
 
 ### Kubernetes 容器日志按服务范围采集（2026-09-20）
```

---

### Incident Patch 11: `89646d3d` (2026-09-24)
**Commit Message**: fix(grafana): update datasources through the UID API (#430)

**File**: `internal/pkg/grafana/client.go` (modified, +3/-4)
```diff
@@ -132,8 +132,7 @@ func (c *Client) UpsertDatasource(ctx context.Context, ds Datasource) error {
 	body, err := c.do(ctx, http.MethodGet, "/api/datasources/uid/"+ds.UID, nil)
 	if err == nil && len(body) > 0 {
 		var existing struct {
-			ID       int64 `json:"id"`
-			ReadOnly bool  `json:"readOnly"`
+			ReadOnly bool `json:"readOnly"`
 		}
 		if jerr := json.Unmarshal(body, &existing); jerr != nil {
 			return fmt.Errorf("grafana: decode existing datasource: %w", jerr)
@@ -143,7 +142,7 @@ func (c *Client) UpsertDatasource(ctx context.Context, ds Datasource) error {
 			// dashboards reference by UID and that hasn't changed.
 			return nil
 		}
-		_, perr := c.do(ctx, http.MethodPut, fmt.Sprintf("/api/datasources/%d", existing.ID), ds)
+		_, perr := c.do(ctx, http.MethodPut, "/api/datasources/uid/"+ds.UID, ds)
 		// Forward-compat: even if a future Grafana drops readOnly from the
 		// GET response, a 403 with the read-only message is unambiguous.
 		if perr != nil && isReadOnlyError(perr) {
@@ -356,7 +355,7 @@ func (c *Client) do(ctx context.Context, method, path string, payload any) ([]by
 
 	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MiB cap
 	if resp.StatusCode == http.StatusNotFound {
-		return nil, notFoundErr
+		return nil, fmt.Errorf("%w: %s %s returned %d", notFoundErr, method, req.URL.EscapedPath(), resp.StatusCode)
 	}
 	if resp.StatusCode/100 != 2 {
 		return nil, fmt.Errorf("grafana: %s %s returned %d: %s",
```

**File**: `internal/pkg/grafana/client_test.go` (modified, +58/-23)
```diff
@@ -7,6 +7,7 @@ import (
 	"io"
 	"net/http"
 	"net/http/httptest"
+	"reflect"
 	"strings"
 	"testing"
 )
@@ -104,28 +105,58 @@ func TestUpsertDatasourceSkipsReadOnly(t *testing.T) {
 
 func TestUpsertDatasourceUpdatesWhenPresent(t *testing.T) {
 	t.Parallel()
-	updated := false
-	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
-		switch {
-		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/api/datasources/uid/"):
-			_, _ = io.WriteString(w, `{"id":42,"uid":"uid-1"}`)
-		case r.Method == http.MethodPut && r.URL.Path == "/api/datasources/42":
-			updated = true
-			_, _ = io.WriteString(w, `{}`)
-		default:
-			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
-		}
-	}))
-	defer srv.Close()
+	for _, tt := range []struct {
+		name     string
+		basePath string
+		existing string
+	}{
+		{"numeric ID present", "", `{"id":42,"uid":"uid-1"}`},
+		{"numeric ID absent and subpath", "/grafana", `{"uid":"uid-1"}`},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			updated := make(chan Datasource, 1)
+			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				if r.URL.Path != tt.basePath+"/api/datasources/uid/uid-1" {
+					// Grafana 13 disables the legacy numeric-ID routes by default.
+					http.NotFound(w, r)
+					return
+				}
+				switch r.Method {
+				case http.MethodGet:
+					_, _ = io.WriteString(w, tt.existing)
+				case http.MethodPut:
+					var got Datasource
+					if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
+						t.Errorf("decode datasource: %v", err)
+						http.Error(w, "invalid payload", http.StatusBadRequest)
+						return
+					}
+					updated <- got
+					_, _ = io.WriteString(w, `{}`)
+				default:
+					http.Error(w, "unexpected method", http.StatusMethodNotAllowed)
+				}
+			}))
+			defer srv.Close()
 
-	err := New(srv.URL, "t", srv.Client()).UpsertDatasource(context.Background(), Datasource{
-		UID: "uid-1", Name: "n", Type: "prometheus", URL: "http://prom",
-	})
-	if err != nil {
-		t.Fatalf("Upsert: %v", err)
-	}
-	if !updated {
-		t.Fatal("PUT /api/datasources/42 never called")
+			ds := Datasource{
+				UID: "uid-1", Name: "n", Type: "prometheus", URL: "http://prom",
+				JSONData:       map[string]any{"httpHeaderName1": "Authorization", "tlsSkipVerify": true},
+				SecureJSONData: map[string]string{"httpHeaderValue1": "Bearer prom-token"},
+			}
+			if err := New(srv.URL+tt.basePath+"/", "t", srv.Client()).UpsertDatasource(context.Background(), ds); err != nil {
+				t.Fatalf("Upsert: %v", err)
+			}
+			ds.Access = "proxy"
+			select {
+			case got := <-updated:
+				if !reflect.DeepEqual(got, ds) {
+					t.Fatalf("payload = %#v, want %#v", got, ds)
+				}
+			default:
+				t.Fatal("existing datasource was not updated")
+			}
+		})
 	}
 }
 
@@ -241,8 +272,12 @@ func TestNon2xxBubblesUp(t *testing.T) {
 		http.Error(w, "no", http.StatusNotFound)
 	}))
 	defer srv2.Close()
-	c := New(srv2.URL, "t", srv2.Client())
-	if _, err := c.do(context.Background(), http.MethodGet, "/x", nil); !errors.Is(err, notFoundErr) {
+	c := New(srv2.URL+"/grafana", "t", srv2.Client())
+	_, err = c.do(context.Background(), http.MethodGet, "/x", nil)
+	if !errors.Is(err, notFoundErr) {
 		t.Fatalf("expected notFoundErr, got %v", err)
 	}
+	if !strings.Contains(err.Error(), "GET /grafana/x returned 404") {
+		t.Fatalf("expected method, full path and status in error, got %v", err)
+	}
 }
```

**File**: `tests/e2e/grafana_loki_datasource_test.go` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ func TestGrafana_LokiDatasourceSync_O4(t *testing.T) {
 		case r.Method == http.MethodGet && r.URL.Path == "/api/datasources/uid/ongrid-loki":
 			w.Header().Set("Content-Type", "application/json")
 			_, _ = w.Write([]byte(`{"id":42,"uid":"ongrid-loki","readOnly":false,"url":"http://loki:3100"}`))
-		case r.Method == http.MethodPut && r.URL.Path == "/api/datasources/42":
+		case r.Method == http.MethodPut && r.URL.Path == "/api/datasources/uid/ongrid-loki":
 			var got datasourceReq
 			if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
 				http.Error(w, "invalid datasource payload", http.StatusBadRequest)
```

---

### Incident Patch 12: `6c67571e` (2026-09-24)
**Commit Message**: fix(deploy): ship complete Edge upgrade bundles for v0.17.1 (#429)

**File**: `Makefile` (modified, +2/-1)
```diff
@@ -655,7 +655,7 @@ fetch-mongodb-exporter: ## [release] 下载 mongodb_exporter 到 bin/<os>-<arch>
 build-edge-bundle: ## [release] 打 ADR-024 edge upgrade bundle 到 dist/out/edge-bundles/
 	@mkdir -p $(OUT)/edge-bundles
 	@for arch in $(EDGE_PLUGIN_ARCHES); do \
-		bash dist/build-edge-bundle.sh $(VERSION) $$arch $(OUT)/edge-bundles; \
+		bash dist/build-edge-bundle.sh $(VERSION) $$arch $(OUT)/edge-bundles || exit 1; \
 	done
 
 .PHONY: package-k8s-chart publish-k8s-chart test-k8s-chart test-publish-k8s-chart
@@ -790,6 +790,7 @@ publish-edge-attachments: publish-edge-deps-attachments publish-edge-version-att
 test-edge-attachments: ## [test] 校验附件构建、直链下载和 checksum 拒绝路径
 	bash scripts/test-edge-assets.sh
 	bash scripts/test-edge-assets-lib.sh
+	bash scripts/test-edge-bundle.sh
 	bash scripts/test-verify-cnb-release-attachments.sh
 	bash scripts/test-ensure-cnb-release.sh
 	bash scripts/test-publish-cnb-release-attachments.sh
```

**File**: `README.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choose the command for your server architecture:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Mainland China** — if GitHub is slow, use the matching CDN mirror URL instead:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Product Tour
```

**File**: `README_DE.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Wählen Sie den Befehl für Ihre Serverarchitektur:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Festlandchina** — Wenn GitHub langsam ist, verwenden Sie die passende CDN-Mirror-URL für Ihre Architektur:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Produkttour
```

**File**: `README_ES.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Elige el comando para la arquitectura de tu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — si GitHub va lento, usa la URL del mirror CDN que coincida con tu arquitectura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Recorrido del producto
```

**File**: `README_FR.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Choisissez la commande adaptée à l’architecture de votre serveur :
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 Chine continentale** — si GitHub est lent, utilisez l’URL du miroir CDN correspondant à votre architecture :
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Tour du produit
```

**File**: `README_JA.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 中国本土ユーザー** — GitHub が遅い場合は、アーキテクチャに合う CDN ミラー URL を使用してください：
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## 製品ツアー
```

**File**: `README_KO.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 중국 본토 사용자** — GitHub이 느리면 아키텍처에 맞는 CDN 미러 URL을 사용하세요:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## 제품 둘러보기
```

**File**: `README_PT.md` (modified, +6/-6)
```diff
@@ -63,26 +63,26 @@ Escolha o comando para a arquitetura do seu servidor:
 
 **AMD64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-amd64.tar.xz
-tar -xf ongrid-v0.17.0-linux-amd64.tar.xz && cd ongrid-v0.17.0-linux-amd64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-amd64.tar.xz
+tar -xf ongrid-v0.17.1-linux-amd64.tar.xz && cd ongrid-v0.17.1-linux-amd64
 sudo ./install.sh
 ```
 
 **ARM64**
 ```bash
-wget https://github.com/ongridio/ongrid/releases/download/v0.17.0/ongrid-v0.17.0-linux-arm64.tar.xz
-tar -xf ongrid-v0.17.0-linux-arm64.tar.xz && cd ongrid-v0.17.0-linux-arm64
+wget https://github.com/ongridio/ongrid/releases/download/v0.17.1/ongrid-v0.17.1-linux-arm64.tar.xz
+tar -xf ongrid-v0.17.1-linux-arm64.tar.xz && cd ongrid-v0.17.1-linux-arm64
 sudo ./install.sh
 ```
 
 **🇨🇳 China continental** — se o GitHub estiver lento, use a URL do mirror CDN correspondente à sua arquitetura:
 
 ```bash
 # AMD64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-amd64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-amd64.tar.xz
 
 # ARM64
-wget https://ongrid.cloud/dl/ongrid-v0.17.0-linux-arm64.tar.xz
+wget https://ongrid.cloud/dl/ongrid-v0.17.1-linux-arm64.tar.xz
 ```
 
 ## Tour do produto
```

---

### Incident Patch 13: `3ab94dfc` (2026-09-24)
**Commit Message**: fix(edgeagent): exclude CNI veths from hardware fingerprint (#371)

Co-authored-by: liudi <[REDACTED_EMAIL]>

**File**: `internal/edgeagent/collector/hwfingerprint.go` (modified, +37/-2)
```diff
@@ -26,6 +26,11 @@ import (
 // Returns "" when no physical NIC can be found (e.g. exotic netns setups);
 // the caller keeps HostID as the fallback fingerprint so such hosts still
 // register. All components are sorted so the value is stable across reboots.
+//
+// Note the NIC filter in isPhysicalNIC is load-bearing, not cosmetic: K8s
+// CNI host-side veths (Calico cali*, Cilium lxc*) all carry placeholder MACs
+// and sort before eth0 by name, so unfiltered they would occupy the
+// first-two slots and hash every node of a cluster to one fingerprint.
 func hardwareFingerprint() string {
 	macs := physicalMACs()
 	if len(macs) == 0 {
@@ -48,14 +53,28 @@ func physicalMACs() []string {
 	if err != nil {
 		return nil
 	}
+	return selectMACs(ifaces)
+}
+
+// selectMACs implements the physicalMACs policy over a given interface list
+// (split out for testability): keep physical NICs, drop duplicate MACs (a
+// bond/bridge and its slaves share one address — one card must not occupy
+// both slots), sort by interface name, cap at two.
+func selectMACs(ifaces []net.Interface) []string {
 	type ni struct{ name, mac string }
 	list := make([]ni, 0, len(ifaces))
+	seen := make(map[string]struct{}, len(ifaces))
 	for i := range ifaces {
 		iface := ifaces[i]
 		if !isPhysicalNIC(&iface) {
 			continue
 		}
-		list = append(list, ni{name: iface.Name, mac: iface.HardwareAddr.String()})
+		mac := iface.HardwareAddr.String()
+		if _, dup := seen[mac]; dup {
+			continue
+		}
+		seen[mac] = struct{}{}
+		list = append(list, ni{name: iface.Name, mac: mac})
 	}
 	if len(list) == 0 {
 		return nil
@@ -73,7 +92,9 @@ func physicalMACs() []string {
 
 // isPhysicalNIC reports whether iface looks like a real NIC worth keying the
 // fingerprint on — excludes loopback, point-to-point (VPN/tunnel), MAC-less,
-// and name-matched virtual interfaces (docker/veth/bridge/tun/tap/…).
+// name-matched virtual interfaces (docker/veth/bridge/tun/tap/…), CNI
+// host-side veths (Calico cali*, Cilium lxc*, Weave weave*), and placeholder
+// MACs that are identical across hosts.
 func isPhysicalNIC(iface *net.Interface) bool {
 	if iface.Flags&net.FlagLoopback != 0 {
 		return false
@@ -84,6 +105,19 @@ func isPhysicalNIC(iface *net.Interface) bool {
 	if len(iface.HardwareAddr) == 0 {
 		return false
 	}
+	// Placeholder addresses shared by many hosts must never key the
+	// fingerprint, or every such host hashes to the same value:
+	//   ee:ee:ee:ee:ee:ee — Calico hardcodes it on every host-side cali*
+	//     veth; since "cali" sorts before "eth0", unfiltered it occupies the
+	//     first-two slots and collapses all Calico nodes onto one
+	//     fingerprint. This MAC check also catches any future CNI whose
+	//     name prefix the list below misses.
+	//   00:00:00:00:00:00 — uninitialized NIC; its 6-byte length slips past
+	//     the empty check above.
+	switch iface.HardwareAddr.String() {
+	case "ee:ee:ee:ee:ee:ee", "00:00:00:00:00:00":
+		return false
+	}
 	name := strings.ToLower(iface.Name)
 	// Linux uses prefixes; other platforms ship the same virtual NICs under
 	// vendor names. One combined keyword list covers both well enough for a
@@ -92,6 +126,7 @@ func isPhysicalNIC(iface *net.Interface) bool {
 		"docker", "veth", "cni", "flannel", "virbr", "br-", "tun", "tap",
 		"vmnet", "vboxnet", "vmware", "hyper-v", "vbox", "wsl", "vpn",
 		"utun", "bridge", "awdl", "anpi", "isatap", "teredo", "kube",
+		"cali", "lxc", "weave",
 	}
 	for _, v := range virtual {
 		if strings.HasPrefix(name, v) || strings.Contains(name, v) {
```

**File**: `internal/edgeagent/collector/hwfingerprint_test.go` (modified, +70/-0)
```diff
@@ -21,6 +21,9 @@ func TestIsPhysicalNIC(t *testing.T) {
 		{"br- compose", net.Interface{Name: "br-abc123", HardwareAddr: mac}, false},
 		{"point-to-point vpn", net.Interface{Name: "tun0", Flags: net.FlagPointToPoint, HardwareAddr: mac}, false},
 		{"cni", net.Interface{Name: "cni0", HardwareAddr: mac}, false},
+		{"calico host veth", net.Interface{Name: "cali1cd2b48238d", HardwareAddr: mac}, false},
+		{"cilium host veth", net.Interface{Name: "lxc1a2b3c4d5", HardwareAddr: mac}, false},
+		{"weave", net.Interface{Name: "weave", HardwareAddr: mac}, false},
 	}
 	for _, c := range cases {
 		t.Run(c.name, func(t *testing.T) {
@@ -31,6 +34,73 @@ func TestIsPhysicalNIC(t *testing.T) {
 	}
 }
 
+// Placeholder MACs shared across hosts are rejected regardless of interface
+// name — the backstop for CNIs the name keyword list doesn't know yet.
+func TestIsPhysicalNICPlaceholderMAC(t *testing.T) {
+	for _, macStr := range []string{"ee:ee:ee:ee:ee:ee", "00:00:00:00:00:00"} {
+		mac, _ := net.ParseMAC(macStr)
+		iface := net.Interface{Name: "eth0", HardwareAddr: mac}
+		if isPhysicalNIC(&iface) {
+			t.Errorf("isPhysicalNIC(eth0, %s) = true, want false (non-unique placeholder MAC)", macStr)
+		}
+	}
+}
+
+func TestSelectMACs(t *testing.T) {
+	mustMAC := func(s string) net.HardwareAddr {
+		m, err := net.ParseMAC(s)
+		if err != nil {
+			t.Fatalf("bad test MAC %q: %v", s, err)
+		}
+		return m
+	}
+	real1, real2 := mustMAC("00:50:56:8d:fc:fc"), mustMAC("00:50:56:8d:32:37")
+	cali1 := net.Interface{Name: "cali1cd2b48238d", HardwareAddr: mustMAC("ee:ee:ee:ee:ee:ee")}
+	cali2 := net.Interface{Name: "calicc4fdafb95b", HardwareAddr: mustMAC("ee:ee:ee:ee:ee:ee")}
+
+	t.Run("calico veths excluded, real NIC kept", func(t *testing.T) {
+		// The reported collision: cali* sorts before eth0, so unfiltered the
+		// first-two slots were both ee:ee:ee:ee:ee:ee on every node.
+		got := selectMACs([]net.Interface{
+			cali1, cali2,
+			{Name: "eth0", HardwareAddr: real1},
+		})
+		if len(got) != 1 || got[0] != real1.String() {
+			t.Errorf("selectMACs = %v, want [%s]", got, real1)
+		}
+	})
+
+	t.Run("duplicate macs deduped", func(t *testing.T) {
+		// bond0 and its slave eth0 share one address; dedupe frees the
+		// second slot for a genuinely different NIC.
+		got := selectMACs([]net.Interface{
+			{Name: "bond0", HardwareAddr: real1},
+			{Name: "eth0", HardwareAddr: real1},
+			{Name: "eth1", HardwareAddr: real2},
+		})
+		if len(got) != 2 || got[0] != real1.String() || got[1] != real2.String() {
+			t.Errorf("selectMACs = %v, want [%s %s]", got, real1, real2)
+		}
+	})
+
+	t.Run("capped at two, sorted by name", func(t *testing.T) {
+		got := selectMACs([]net.Interface{
+			{Name: "eth2", HardwareAddr: mustMAC("00:00:00:00:00:03")},
+			{Name: "eth0", HardwareAddr: mustMAC("00:00:00:00:00:01")},
+			{Name: "eth1", HardwareAddr: mustMAC("00:00:00:00:00:02")},
+		})
+		if len(got) != 2 || got[0] != "00:00:00:00:00:01" || got[1] != "00:00:00:00:00:02" {
+			t.Errorf("selectMACs = %v, want [00:00:00:00:00:01 00:00:00:00:00:02]", got)
+		}
+	})
+
+	t.Run("all filtered returns nil", func(t *testing.T) {
+		if got := selectMACs([]net.Interface{cali1, cali2}); got != nil {
+			t.Errorf("selectMACs = %v, want nil", got)
+		}
+	})
+}
+
 func TestHardwareFingerprintDeterministic(t *testing.T) {
 	// On any host with at least one physical NIC the value is non-empty and
 	// stable across calls; on exotic hosts it's "" (the documented fallback
```

---

### Incident Patch 14: `0af13c7e` (2026-09-23)
**Commit Message**: fix(edge): fall back to an available diagnostics port (#426)

Prefer the default diagnostics port and use an OS-assigned port on address conflicts. Preserve explicit fixed addresses and installer settings, with regression coverage for listener lifecycle and concurrent fallback.

**File**: `Makefile` (modified, +5/-0)
```diff
@@ -117,6 +117,11 @@ test: ## 单元测试
 test-race: ## 单元测试 + race
 	go test -race ./...
 
+.PHONY: test-edge-metrics-env
+test-edge-metrics-env: ## Edge 诊断端口安装配置保留检查
+	bash -n deploy/install/edge/install.sh deploy/install/edge/install-edge.sh
+	python3 scripts/test-edge-metrics-env.py
+
 test-integration: ## 集成测试（build tag: integration）
 	go test -tags=integration ./...
 
```

**File**: `cmd/ongrid-edge/main.go` (modified, +8/-3)
```diff
@@ -297,9 +297,14 @@ func main() {
 	metricsMux.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
 		_, _ = w.Write([]byte("ok"))
 	})
-	metricsServer := httpserver.New(edgeMetricsAddr, metricsMux, log.With(slog.String("listener", "metrics")))
-
-	eg.Go(func() error { return metricsServer.Start(egCtx) })
+	eg.Go(func() error {
+		metricsLog := log.With(slog.String("listener", "metrics"))
+		if isK8sController(k8sInfo) {
+			// Legacy controllers retain their fixed diagnostics listener.
+			return httpserver.New(edgeMetricsAddr, metricsMux, metricsLog).Start(egCtx)
+		}
+		return runEdgeMetrics(egCtx, metricsMux, metricsLog)
+	})
 	pprofServer := httpserver.New(edgePprofAddr, http.DefaultServeMux, log.With(slog.String("listener", "pprof")))
 	eg.Go(func() error {
 		if err := pprofServer.Start(egCtx); err != nil {
```

**File**: `cmd/ongrid-edge/metrics_listener.go` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+package main
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"log/slog"
+	"net"
+	"net/http"
+	"os"
+	"runtime"
+	"strconv"
+	"strings"
+	"syscall"
+
+	"github.com/ongridio/ongrid/internal/pkg/httpserver"
+)
+
+func runEdgeMetrics(ctx context.Context, handler http.Handler, log *slog.Logger) error {
+	addr := strings.TrimSpace(os.Getenv("ONGRID_EDGE_METRICS_ADDR"))
+	automatic := addr == ""
+	if automatic {
+		addr = edgeMetricsAddr
+	}
+	ln, err := listenEdgeMetrics(ctx, addr, automatic, log)
+	if err != nil {
+		return err
+	}
+	return httpserver.New(addr, handler, log).StartListener(ctx, ln)
+}
+
+func listenEdgeMetrics(ctx context.Context, addr string, automatic bool, log *slog.Logger) (net.Listener, error) {
+	if err := ctx.Err(); err != nil {
+		return nil, err
+	}
+	host, port, err := net.SplitHostPort(addr)
+	if err != nil {
+		return nil, fmt.Errorf("edge metrics address %q: %w", addr, err)
+	}
+	n, err := strconv.Atoi(port)
+	if err != nil || n < 1 || n > 65535 {
+		return nil, fmt.Errorf("edge metrics address %q: port must be 1..65535", addr)
+	}
+	mode := "fixed"
+	if automatic {
+		mode = "auto"
+	}
+	var lc net.ListenConfig
+	ln, err := lc.Listen(ctx, "tcp", addr)
+	reason := ""
+	// Windows sockets report WSAEADDRINUSE, distinct from syscall.EADDRINUSE.
+	inUse := errors.Is(err, syscall.EADDRINUSE) || (runtime.GOOS == "windows" && errors.Is(err, syscall.Errno(10048)))
+	if automatic && inUse {
+		bindErr := err
+		ln, err = lc.Listen(ctx, "tcp", net.JoinHostPort(host, "0"))
+		if err != nil {
+			return nil, fmt.Errorf("edge metrics bind %q and automatic allocation failed: %w", addr, errors.Join(bindErr, err))
+		}
+		reason = "address_in_use"
+	}
+	if err != nil {
+		return nil, fmt.Errorf("edge metrics bind %q (%s): %w", addr, mode, err)
+	}
+	log.Info("edge diagnostics listener bound", "requested_addr", addr,
+		"actual_addr", ln.Addr().String(), "mode", mode, "fallback_reason", reason)
+	return ln, nil
+}
```

**File**: `cmd/ongrid-edge/metrics_listener_test.go` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+package main
+
+import (
+	"context"
+	"errors"
+	"io"
+	"log/slog"
+	"net"
+	"net/http"
+	"strings"
+	"sync"
+	"testing"
+	"time"
+
+	"github.com/ongridio/ongrid/internal/pkg/httpserver"
+	"github.com/prometheus/client_golang/prometheus"
+)
+
+func TestEdgeMetricsOccupiedPort(t *testing.T) {
+	log := slog.New(slog.NewTextHandler(io.Discard, nil))
+	for _, host := range []string{"127.0.0.1", "::1"} {
+		t.Run(host, func(t *testing.T) {
+			occupied, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
+			if err != nil {
+				if host == "::1" {
+					t.Skipf("IPv6 unavailable: %v", err)
+				}
+				t.Fatal(err)
+			}
+			t.Cleanup(func() { occupied.Close() })
+			addr := occupied.Addr().String()
+			ctx, cancel := context.WithCancel(t.Context())
+			defer cancel()
+			ln, err := listenEdgeMetrics(ctx, addr, true, log)
+			if err != nil {
+				t.Fatal(err)
+			}
+			actual := ln.Addr().String()
+			if actual == addr {
+				t.Fatal("fallback reused occupied address")
+			}
+			mux := http.NewServeMux()
+			mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
+			mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
+			done := make(chan error, 1)
+			go func() { done <- httpserver.New(addr, mux, log).StartListener(ctx, ln) }()
+			client := &http.Client{Timeout: 2 * time.Second}
+			defer client.CloseIdleConnections()
+			for _, path := range []string{"/healthz", "/metrics"} {
+				res, err := client.Get("http://" + actual + path)
+				if err != nil {
+					t.Fatal(err)
+				}
+				res.Body.Close()
+				if res.StatusCode != http.StatusOK {
+					t.Fatalf("%s status=%d", path, res.StatusCode)
+				}
+			}
+			// Fixed mode must not hide a conflict, including the untouched K8s data plane.
+			t.Setenv("ONGRID_EDGE_METRICS_ADDR", addr)
+			if err := runEdgeMetrics(ctx, mux, log); err == nil {
+				t.Fatal("fixed edge listener accepted occupied address")
+			}
+			if err := runDataPlaneDiagnostics(ctx, prometheus.NewRegistry(), nil, log); err == nil {
+				t.Fatal("K8s data plane silently changed its fixed port")
+			}
+			cancel()
+			select {
+			case err := <-done:
+				if err != nil {
+					t.Fatal(err)
+				}
+			case <-time.After(3 * time.Second):
+				t.Fatal("listener did not shut down")
+			}
+			// The fallback port is released; the original listener remains ours.
+			rebound, err := net.Listen("tcp", actual)
+			if err != nil {
+				t.Fatal(err)
+			}
+			rebound.Close()
+			if err := occupied.(*net.TCPListener).SetDeadline(time.Now()); err != nil {
+				t.Fatalf("original listener was closed: %v", err)
+			}
+		})
+	}
+}
+
+func TestEdgeMetricsValidationAndNonConflictErrors(t *testing.T) {
+	log := slog.New(slog.NewTextHandler(io.Discard, nil))
+	for _, addr := range []string{"bad", ":0", ":-1", ":65536", ":http", "::1:9101"} {
+		if ln, err := listenEdgeMetrics(t.Context(), addr, true, log); err == nil {
+			ln.Close()
+			t.Fatalf("accepted invalid address %q", addr)
+		}
+	}
+	// An invalid local IP fails before binding. Auto mode must preserve that error.
+	if ln, err := listenEdgeMetrics(t.Context(), "256.256.256.256:9101", true, log); err == nil {
+		ln.Close()
+		t.Fatal("invalid host accepted")
+	} else if strings.Contains(err.Error(), "automatic allocation failed") {
+		t.Fatalf("non-conflict error triggered fallback: %v", err)
+	}
+	ctx, cancel := context.WithCancel(t.Context())
+	cancel()
+	if ln, err := listenEdgeMetrics(ctx, "127.0.0.1:9101", true, log); err == nil {
+		ln.Close()
+		t.Fatal("cancelled listen succeeded")
+	} else if !errors.Is(err, context.Canceled) {
+		t.Fatalf("lost cancellation: %v", err)
+	}
+}
+
+func TestEdgeMetricsAvailablePort(t *testing.T) {
+	log := slog.New(slog.NewTextHandler(io.Discard, nil))
+	reserved, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+	addr := reserved.Addr().String()
+	if err := reserved.Close(); err != nil {
+		t.Fatal(err)
+	}
+	ln, err := listenEdgeMetrics(t.Context(), addr, true, log)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer ln.Close()
+	if ln.Addr().String() != addr {
+		t.Fatalf("available preferred port changed: %s", ln.Addr())
+	}
+}
+
+func TestEdgeMetricsConcurrentFallback(t *testing.T) {
+	occupied, err := net.Listen("tcp", "127.0.0.1:0")
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer occupied.Close()
+	log := slog.New(slog.NewTextHandler(io.Discard, nil))
+	listeners := make([]net.Listener, 8)
+	errors := make([]error, len(listeners))
+	var wg sync.WaitGroup
+	for i := range listeners {
+		wg.Add(1)
+		go func() {
+			defer wg.Done()
+			listeners[i], errors[i] = listenEdgeMetrics(t.Context(), occupied.Addr().String(), true, log)
+		}()
+	}
+	wg.Wait()
+	seen := map[string]bool{occupied.Addr().String(): true}
+	for i, ln := range listeners {
+		if errors[i] != nil {
+			t.Error(errors[i])
+			continue
+		}
+		defer ln.Close()
+		addr := ln.Addr().String()
+		if seen[addr]
```

**File**: `deploy/install/edge/install-edge.sh` (modified, +11/-0)
```diff
@@ -239,6 +239,14 @@ for exporter in mysqld_exporter postgres_exporter redis_exporter mongodb_exporte
 done
 
 # ---------- render env file ----------
+# Preserve only this setting; never source the credentials file as shell code.
+METRICS_ENV_LINE=""
+if [[ ${ONGRID_EDGE_METRICS_ADDR+x} ]]; then
+    [[ "$ONGRID_EDGE_METRICS_ADDR" != *$'\n'* && "$ONGRID_EDGE_METRICS_ADDR" != *$'\r'* ]] || { log_error "metrics address must be one line"; exit 1; }
+    METRICS_ENV_LINE="ONGRID_EDGE_METRICS_ADDR=$ONGRID_EDGE_METRICS_ADDR"
+elif [[ -f "$ENV_FILE" ]]; then
+    METRICS_ENV_LINE=$(sed -n '/^ONGRID_EDGE_METRICS_ADDR=/p' "$ENV_FILE")
+fi
 log_info "rendering $ENV_FILE"
 mkdir -p "$CONFIG_DIR"
 chmod 750 "$CONFIG_DIR"
@@ -257,6 +265,9 @@ sed \
     -e "s|__ACCESS_KEY__|$(esc "$EDGE_ACCESS_KEY")|g" \
     -e "s|__SECRET_KEY__|$(esc "$EDGE_SECRET_KEY")|g" \
     "$TEMPLATE" > "$ENV_FILE"
+if [[ -n "$METRICS_ENV_LINE" ]]; then
+    printf '\n%s\n' "$METRICS_ENV_LINE" >> "$ENV_FILE"
+fi
 chmod 640 "$ENV_FILE"
 chown root:"$SERVICE_GROUP" "$ENV_FILE" 2>/dev/null || true
 
```

**File**: `deploy/install/edge/install.sh` (modified, +11/-0)
```diff
@@ -301,6 +301,14 @@ mkdir -p "$ENV_DIR"
 chown "root:${SERVICE_GROUP}" "$ENV_DIR"
 chmod 750 "$ENV_DIR"
 
+# Preserve only this setting; never source the credentials file as shell code.
+METRICS_ENV_LINE=""
+if [[ ${ONGRID_EDGE_METRICS_ADDR+x} ]]; then
+    [[ "$ONGRID_EDGE_METRICS_ADDR" != *$'\n'* && "$ONGRID_EDGE_METRICS_ADDR" != *$'\r'* ]] || { log_error "metrics address must be one line"; exit 1; }
+    METRICS_ENV_LINE="ONGRID_EDGE_METRICS_ADDR=$ONGRID_EDGE_METRICS_ADDR"
+elif [[ -f "$ENV_FILE" ]]; then
+    METRICS_ENV_LINE=$(sed -n '/^ONGRID_EDGE_METRICS_ADDR=/p' "$ENV_FILE")
+fi
 if [[ -n "$PENDING_ENV_FILE" ]]; then
     install -m 0640 -o root -g "$SERVICE_GROUP" "$PENDING_ENV_FILE" "$ENV_FILE"
     rm -f "$PENDING_ENV_FILE"
@@ -312,6 +320,9 @@ ONGRID_EDGE_ACCESS_KEY=${ACCESS_KEY}
 ONGRID_EDGE_SECRET_KEY=${SECRET_KEY}
 EOF
 fi
+if [[ -n "$METRICS_ENV_LINE" ]]; then
+    printf '\n%s\n' "$METRICS_ENV_LINE" >> "$ENV_FILE"
+fi
 chmod 640 "$ENV_FILE"
 chown "root:${SERVICE_GROUP}" "$ENV_FILE"
 trap 'log_error "install failed at line $LINENO (exit $?)"' ERR
```

**File**: `deploy/install/edge/ongrid-edge.env.example` (modified, +4/-0)
```diff
@@ -11,6 +11,10 @@ ONGRID_EDGE_COLLECTOR_MODE=auto
 ONGRID_EDGE_SCRAPE_CONFIG_FILE=/etc/ongrid-edge/scrape.yaml
 ONGRID_EDGE_COLLECTOR_INTERVAL=10s
 
+# Optional fixed diagnostics address. Unset/blank: prefer :9101 and let the
+# OS allocate a free port if occupied. Explicit addresses never fall back.
+# ONGRID_EDGE_METRICS_ADDR=:19101
+
 # ---- Passive network discovery --------------------------------------
 # Enabled by default. Set false to stop reporting local gateway, ARP, and
 # LLDP neighbors as candidates for operator-controlled SNMP verification.
```

**File**: `docs/design/edge-port-conflicts.md` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+# Edge 9101 端口自动规避方案
+
+状态：已实现，完成本地 Linux 验证，尚未发布。日期：2026-09-23。
+分支：`fix/edge-port-conflicts`；基线：`origin/main` 的 `50ad3db9`。
+客户反馈疑似 9101 冲突，尚未取得现场报错。
+
+## 目标和范围
+
+普通主机 Edge 和 Kubernetes Node Edge 默认无需用户配置，9101 被占用时仍能启动、建立隧道和采集数据。
+仅处理 Edge 自身 metrics/health HTTP 监听，不修改 Exporter、pprof、Logs、OBI 或 OTLP 端口；不承诺解决多实例共享目录或 BPF 资源问题。
+
+## 已验证代码依据
+
+- 原实现 `cmd/ongrid-edge/main.go` 把 `:9101` 直接传给 HTTP server；监听错误向 errgroup 返回，导致 Edge 退出。
+- 普通 Edge 的该端口提供 `/metrics` 和 `/healthz`，不是 Manager/Frontier 隧道地址，也不是 host/proc Exporter 地址。
+- Node DaemonSet 为 hostNetwork，共享宿主端口，模板当前未声明 HTTP 健康探针。
+- 独立 Gateway/Scraper 已读取 `ONGRID_EDGE_METRICS_ADDR`，其 Pod 探针固定引用 diagnostics/9101。它们不纳入本次动态切换，保持现有行为。
+- 公共 HTTP server 当前只支持 ListenAndServe，且在实际 bind 前记录 listening；实现需支持已绑定 listener 并在成功后记录实际地址。
+
+## 选择规则
+
+| 情况 | 行为 |
+| --- | --- |
+| 未指定地址，9101 空闲 | 绑定并使用 `:9101` |
+| 未指定地址，9101 返回 address already in use | 用相同监听主机绑定 `:0`，由操作系统分配空闲端口 |
+| 9101 失败原因为权限、资源耗尽等 | 明确报错，不当作端口冲突处理 |
+| 自动分配也失败 | 明确报错并保留现有退出行为，不伪报健康 |
+| 显式设置 `ONGRID_EDGE_METRICS_ADDR` | 固定模式，严格使用指定地址，冲突时报错，不自动替换 |
+
+显式地址的端口限制为 1..65535；空白按未设置处理。固定模式用于外部 Prometheus 抓取或固定防火墙规则。默认监听范围保持现状，不另行扩大暴露范围。
+
+实现使用 `net.Listen`，按 `errors.Is(err, syscall.EADDRINUSE)` 等目标平台可验证的错误判定识别占用；直接把成功返回的 listener 交给 `http.Server.Serve`，不先扫描或释放后重绑，不解析错误字符串。
+
+## 生命周期和部署行为
+
+- 每次启动优先 9101；本次分配的端口在进程生命周期内不再变化。重启后允许变化，不持久化随机端口。
+- 绑定后再启动服务并记录监听成功；在后续初始化失败、取消或正常退出时关闭 listener，保留现有优雅退出逻辑。
+- 不需页面先配置，也不需等待 Manager 下发即可启动；内部健康请求使用实际端口。
+- Node DaemonSet 当前无固定 HTTP 探针，因此无需为本方案改成 exec 探针。Gateway/Scraper 的固定端口及 probes 保持不变。
+- Docker host 网络适用自动模式；Docker 显式发布端口和外部固定抓取使用固定模式。自动端口不保证外部防火墙自动放行。
+- 安装重装保留用户显式配置的该变量；不新增配置页面或全套安装端口表单。
+
+## 可观测性
+
+第一版通过启动日志提供 `component=diagnostics`、`requested_addr`、`actual_addr`、`mode=auto|fixed` 和 `fallback_reason=address_in_use`。成功规避只记录一次，不持续告警；最终失败提供两次绑定的错误上下文。
+
+日志示例：默认 9101 已占用，诊断服务已改用 43827，Edge 继续运行。
+
+页面只读展示实际端口可作为后续小改：需要通过隧道上报运行时状态并同步 Manager/API，不将此链路作为端口修复的前置条件。第一版不新增数据库字段或独立状态文件。
+
+## 改动位置
+
+1. `cmd/ongrid-edge/`：诊断监听的自动/固定选择、启动接入与测试；不改独立数据面模式。
+2. `internal/pkg/httpserver/`：复用已有生命周期，补充接收已绑定 listener 的入口，保留 Start 调用方行为。
+3. `deploy/install/edge/` 与 `docs/install/edge.md`：显式覆盖的保存/重装保留和操作说明。
+
+## 验收和回滚
+
+- 默认空闲时仍使用 9101。
+- 测试先持有默认端口，Edge 获得其他端口；实际请求 `/healthz`、`/metrics` 成功，默认端口的原服务不受影响。
+- 固定模式遇占用明确失败；非法地址和非占用错误不触发回退。
+- 并发启动监听测试、取消与关闭测试通过，Go 测试带 `-race`；公共 HTTP server 的原 Start 路径回归通过。
+- Linux/systemd 与真实 hostNetwork Node 验证 Edge 在线及主机指标持续上报；Gateway/Scraper Helm 渲染和探针保持原样。
+- 重装后固定地址不丢失；不配置时不引入新增部署要求。
+- 回滚到旧版前确保 9101 空闲；旧版普通 Edge 不支持本覆盖变量。回滚不涉及数据迁移。
+
+## 本次验证结果
+
+- Linux（隔离 golang:1.25-bookworm 容器）：`go test -race ./internal/pkg/httpserver ./cmd/ongrid-edge -count=1`、对应 `go vet` 和 `make build-ongrid-edge` 通过。
+- 安装检查：`make test-edge-metrics-env` 通过，覆盖两个入口的新装、保留、显式覆盖、清空、IPv6 及拒绝换行输入。
+- 真实二进制：默认 `[::]:9101`；预占 9101 后改为 `[::]:34423`，两种情况下 `/healthz`、`/metrics` 均返回 200，正常退出并释放端口；显式固定 9101 遇占用明确失败。测试使用隔离容器，没有连接客户或本地 Manager。
+- 额外检查 IPv4/IPv6、多个并发回退 listener、取消和端口释放；独立数据面固定端口冲突仍失败，不自动回退。
+- 未做真实 systemd 安装、Kubernetes 集群部署、Manager 联网采集或 Windows 运行验证。macOS 上 cmd/ongrid-edge 原有平台函数缺失，改在 Linux 验证，未扩展平台支持。
```

---

### Incident Patch 15: `b7f66efb` (2026-09-23)
**Commit Message**: fix(flow): match alert triggers by rule key or name (#416)

**File**: `internal/manager/biz/alert/usecase.go` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ type Investigator interface {
 // implicitly satisfies it. main.go injects.
 type WorkflowDispatcher interface {
 	// OnAlertFired MUST be non-blocking (same contract as Investigator).
-	OnAlertFired(incidentID uint64, rule, severity string, edgeID, deviceID uint64, labels map[string]string, firedAt time.Time)
+	OnAlertFired(incidentID uint64, ruleKey, ruleName, severity string, edgeID, deviceID uint64, labels map[string]string, firedAt time.Time)
 }
 
 // RuleCacheRefresher makes persisted rule migrations visible to the running
@@ -500,7 +500,7 @@ func (u *Usecase) RecordFiring(ctx context.Context, in FiringInput) (*FiringResu
 			_ = json.Unmarshal([]byte(incident.LabelsJSON), &labels)
 		}
 		// edge_id == device_id 1:1 post entity-split (see model comment).
-		u.workflowDispatcher.OnAlertFired(incident.ID, incident.RuleName, incident.Severity, devID, devID, labels, occurredAt)
+		u.workflowDispatcher.OnAlertFired(incident.ID, incident.Rule, incident.RuleName, incident.Severity, devID, devID, labels, occurredAt)
 	}
 
 	return &FiringResult{
```

**File**: `internal/manager/biz/flow/dispatcher.go` (modified, +9/-8)
```diff
@@ -35,14 +35,14 @@ func NewDispatcher(uc *Usecase, log *slog.Logger) *Dispatcher {
 // OnAlertFired is non-blocking — the firing path can't wait on flow
 // execution. Scans + triggers on a detached goroutine. Signature matches
 // biz/alert.WorkflowDispatcher.
-func (d *Dispatcher) OnAlertFired(incidentID uint64, rule, severity string, edgeID, deviceID uint64, labels map[string]string, firedAt time.Time) {
+func (d *Dispatcher) OnAlertFired(incidentID uint64, ruleKey, ruleName, severity string, edgeID, deviceID uint64, labels map[string]string, firedAt time.Time) {
 	if d == nil || d.uc == nil {
 		return
 	}
-	go d.dispatch(incidentID, rule, severity, edgeID, deviceID, labels, firedAt)
+	go d.dispatch(incidentID, ruleKey, ruleName, severity, edgeID, deviceID, labels, firedAt)
 }
 
-func (d *Dispatcher) dispatch(incidentID uint64, rule, severity string, edgeID, deviceID uint64, labels map[string]string, firedAt time.Time) {
+func (d *Dispatcher) dispatch(incidentID uint64, ruleKey, ruleName, severity string, edgeID, deviceID uint64, labels map[string]string, firedAt time.Time) {
 	ctx := context.Background()
 	flows, err := d.uc.ListEnabledFlows(ctx)
 	if err != nil {
@@ -51,7 +51,7 @@ func (d *Dispatcher) dispatch(incidentID uint64, rule, severity string, edgeID,
 	}
 	payload := map[string]any{
 		"incident_id": incidentID,
-		"rule":        rule,
+		"rule":        ruleName,
 		"severity":    severity,
 		"edge_id":     edgeID,
 		"device_id":   deviceID,
@@ -67,7 +67,7 @@ func (d *Dispatcher) dispatch(incidentID uint64, rule, severity string, edgeID,
 			if t.Type != NodeTriggerAlert {
 				continue
 			}
-			if !alertMatches(t.Config, rule, severity) {
+			if !alertMatches(t.Config, ruleKey, ruleName, severity) {
 				continue
 			}
 			if _, err := d.uc.TriggerEvent(ctx, f.ID, NodeTriggerAlert, payload); err != nil {
@@ -82,20 +82,21 @@ func (d *Dispatcher) dispatch(incidentID uint64, rule, severity string, edgeID,
 
 // alertTriggerConfig is the trigger.alert_fired node's config.
 type alertTriggerConfig struct {
-	Rule        string `json:"rule"`         // optional: case-insensitive substring on rule name
+	Rule        string `json:"rule"`         // optional: case-insensitive substring on rule key or display name
 	MinSeverity string `json:"min_severity"` // optional: warning / error / critical
 }
 
 // severityRank orders severities for the min_severity gate.
 var severityRank = map[string]int{"info": 0, "warning": 1, "error": 2, "critical": 3}
 
-func alertMatches(cfgRaw json.RawMessage, rule, severity string) bool {
+func alertMatches(cfgRaw json.RawMessage, ruleKey, ruleName, severity string) bool {
 	var cfg alertTriggerConfig
 	if len(cfgRaw) > 0 {
 		_ = json.Unmarshal(cfgRaw, &cfg)
 	}
 	if want := strings.TrimSpace(cfg.Rule); want != "" {
-		if !strings.Contains(strings.ToLower(rule), strings.ToLower(want)) {
+		want = strings.ToLower(want)
+		if !strings.Contains(strings.ToLower(ruleKey), want) && !strings.Contains(strings.ToLower(ruleName), want) {
 			return false
 		}
 	}
```

**File**: `internal/manager/biz/flow/dispatcher_test.go` (modified, +14/-12)
```diff
@@ -15,23 +15,25 @@ func TestAlertMatches(t *testing.T) {
 	cases := []struct {
 		name     string
 		cfg      json.RawMessage
-		rule     string
+		ruleKey  string
+		ruleName string
 		severity string
 		want     bool
 	}{
-		{"blank config matches anything", json.RawMessage(`{}`), "disk full", "warning", true},
-		{"nil config matches anything", nil, "cpu high", "info", true},
-		{"rule substring case-insensitive", cfg("DISK", ""), "node disk full", "warning", true},
-		{"rule substring miss", cfg("network", ""), "disk full", "critical", false},
-		{"min severity met", cfg("", "error"), "x", "critical", true},
-		{"min severity exact", cfg("", "error"), "x", "error", true},
-		{"min severity below", cfg("", "error"), "x", "warning", false},
-		{"unknown severity below gate", cfg("", "warning"), "x", "bogus", false},
-		{"both gates pass", cfg("disk", "error"), "disk full", "critical", true},
-		{"rule passes severity fails", cfg("disk", "critical"), "disk full", "error", false},
+		{"blank config matches anything", json.RawMessage(`{}`), "disk_full", "Disk Full", "warning", true},
+		{"nil config matches anything", nil, "cpu_high", "CPU High", "info", true},
+		{"rule key substring case-insensitive", cfg("DOWN_JOHN", ""), "redis_down_john", "Redis Down (John)", "warning", true},
+		{"rule name substring case-insensitive", cfg("REDIS DOWN", ""), "redis_down_john", "Redis Down (John)", "critical", true},
+		{"rule substring miss", cfg("network", ""), "disk_full", "Disk Full", "critical", false},
+		{"min severity met", cfg("", "error"), "x", "X", "critical", true},
+		{"min severity exact", cfg("", "error"), "x", "X", "error", true},
+		{"min severity below", cfg("", "error"), "x", "X", "warning", false},
+		{"unknown severity below gate", cfg("", "warning"), "x", "X", "bogus", false},
+		{"both gates pass", cfg("disk_full", "error"), "disk_full", "Disk Full", "critical", true},
+		{"rule passes severity fails", cfg("disk", "critical"), "disk_full", "Disk Full", "error", false},
 	}
 	for _, c := range cases {
-		if got := alertMatches(c.cfg, c.rule, c.severity); got != c.want {
+		if got := alertMatches(c.cfg, c.ruleKey, c.ruleName, c.severity); got != c.want {
 			t.Errorf("%s: alertMatches = %v, want %v", c.name, got, c.want)
 		}
 	}
```

#### Recent Merged Pull Requests:
- **PR #458** (2026-10-03): fix(aiops): stop model calls when token budget is exceeded (@shentry)
- **PR #456** (2026-10-01): fix(webssh): frame terminal workspace and add fullscreen controls (@singchia)
- **PR #454** (2026-10-01): fix(ui): synchronize WebSSH dimensions and normalize action columns (@singchia)
- **PR #451** (2026-09-30): perf(tunnel): reduce telemetry bandwidth for v0.17.6 (@youzi-1122)
- **PR #449** (2026-09-30): fix(web): unify header dividers and compact device and tool layouts (@singchia)
- **PR #447** (2026-09-29): fix(ui): align tool target selector and capture empty state (@singchia)
- **PR #446** (2026-09-29): fix(mcp): complete inline approval and result continuation (@singchia)
- **PR #444** (2026-09-29): fix(edge): tune telemetry capacity budgets for v0.17.5 (@youzi-1122)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
