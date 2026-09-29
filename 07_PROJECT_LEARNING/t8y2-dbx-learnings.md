# Forensic Learning Record (Deep Inspection): t8y2/dbx

> **Canonical Artifact**: `07_PROJECT_LEARNING/t8y2-dbx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/t8y2/dbx](https://github.com/t8y2/dbx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-29T21:27:30.073Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `t8y2/dbx`
- **Description**: 25 MB lightweight cross-platform database client for 100+ databases, including MySQL, PostgreSQL, SQLite, Redis, MongoDB, DuckDB, SQL Server, and Dameng. Built-in AI, MCP Server, CLI, desktop and Docker. | 轻量级跨平台数据库管理工具，支持 MySQL、PostgreSQL、SQLite、Redis、MongoDB、达梦等 100+ 数据库，提供桌面端、Docker、CLI、内置 AI 助手和 MCP。
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 21897 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/drivers/argo-go/bench/agent_compare.py`
```
#!/usr/bin/env python3
import json
import os
import queue
import shlex
import statistics
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Candidate:
    name: str
    command: list[str]
    artifact: Path
    rss_command: str = ""


class AgentProcess:
    def __init__(self, candidate: Candidate):
        self.candidate = candidate
        self.process = subprocess.Popen(
            candidate.command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.request_id = 0
        self.request_lock = threading.Lock()
        self.write_lock = threading.Lock()
        self.pending: dict[int, queue.Queue] = {}
        self.ready = threading.Event()
        self.saw_ready = False
        self.exited = threading.Event()
        self.stderr_lines: list[str] = []
        threading.Thread(target=self._read_stdout, daemon=True).start()
        threading.Thread(target=self._drain_stderr, daemon=True).start()
        if not self.ready.wait(env_float("BENCH_READY_TIMEOUT", 30.0)) or not self.saw_ready:
            raise TimeoutError(self._failure("timed out waiting for agent readiness"))

    def _read_stdout(self) -> None:
        assert self.process.stdout is not None
        for line in self.process.stdout:
            try:
                response = json.loads(line)
            except json.JSONDecodeError:
                continue
            if response.get("ready") is True:
                self.saw_ready = True
                self.ready.set()
                continue
            response_id = response.get("id")
            if not isinstance(response_id, int):
                continue
            with self.request_lock:
                response_queue = self.pending.get(response_id)
            if response_queue is not None:
                response_queue.put(response)
        self.exited.set()
        self.ready.set()
        with self.request_lock:
            pending = list(self.pending.values())
        for response_queue in pending:
            response_queue.put(RuntimeError(self._failure("agent process exited")))

    def _drain_stderr(self) -> None:
        assert self.process.stderr is not None
        for line in self.process.stderr:
            self.stderr_lines.append(line.rstrip())

  
```

### Core Architecture Module: `agents/drivers/argo-go/bench/functional_probe.py`
```
#!/usr/bin/env python3
import hashlib
import json
import os
import sys
from pathlib import Path

from agent_compare import AgentProcess, configured_candidates, connection_params, env_default, env_int


def main() -> None:
    os.environ.setdefault("BENCH_CANDIDATES", "go")
    connection = connection_params()
    candidates = configured_candidates()
    results = {candidate.name: probe_candidate(candidate, connection) for candidate in candidates}
    output = {
        "server": env_default("HIVE_SERVER", f"{connection['host']}:{connection['port']}"),
        "connection": sanitized_connection(connection),
        "artifacts": {
            candidate.name: {
                "path": str(candidate.artifact),
                "sha256": sha256(candidate.artifact),
                "size_bytes": candidate.artifact.stat().st_size,
            }
            for candidate in candidates
        },
        "results": results,
        "parity": compare_results(results),
    }
    json.dump(output, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    if any(not result.get("ok") for result in results.values()) or not output["parity"]["ok"]:
        raise SystemExit(1)


def probe_candidate(candidate, connection: dict) -> dict:
    process = None
    session_id = f"functional-probe-{candidate.name}"
    result = {"ok": False}
    try:
        process = AgentProcess(candidate)
        result["test_connection"] = process.call("test_connection", connection)
        process.call("open_session", {"agentSessionId": session_id, **connection})
        result["validate_session"] = process.call("validate_session", {"agentSessionId": session_id})
        result["select_one"] = normalized_query(
            process.call(
                "execute_query",
                {
                    "agentSessionId": session_id,
                    "sql": env_default("PROBE_SELECT_SQL", "SELECT 1 AS value"),
                    "maxRows": env_int("PROBE_SELECT_MAX_ROWS", 10),
                    "fetchSize": env_int("PROBE_FETCH_SIZE", 10),
                },
            )
        )
        result["databases"] = sorted(
            item.get("name", "")
            for item in process.call("list_databases", {"agentSessionId": session_id})
        )
        schema = env_default("PROBE_SCHEMA", connection["database"])
        result["tables"] = sorted(
            item.get("name", "")
            for item in process.call(
                "list_tables",
                {"agent
```

### Core Architecture Module: `agents/drivers/argo-go/bench/kdc_fixture/main.go`
```
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/jcmturner/krb5test"
)

type fixtureInfo struct {
	Realm              string `json:"realm"`
	Address            string `json:"address"`
	ConfigPath         string `json:"config_path"`
	KeytabPath         string `json:"keytab_path"`
	ClientPrincipal    string `json:"client_principal"`
	ServicePrincipal   string `json:"service_principal"`
	ZooKeeperPrincipal string `json:"zookeeper_principal"`
}

func main() {
	directory := flag.String("dir", "", "directory for generated Kerberos fixture files")
	flag.Parse()
	if *directory == "" {
		log.Fatal("-dir is required")
	}
	if err := os.MkdirAll(*directory, 0o700); err != nil {
		log.Fatal(err)
	}

	logger := log.New(os.Stderr, "kdc: ", log.LstdFlags)
	kdc, err := krb5test.NewKDC(map[string][]string{
		"alice":               nil,
		"hive/localhost":      nil,
		"zookeeper/localhost": nil,
	}, logger)
	if err != nil {
		log.Fatal(err)
	}
	kdc.KRB5Conf.LibDefaults.UDPPreferenceLimit = 1
	kdc.Start()
	defer kdc.Close()

	configPath := filepath.Join(*directory, "krb5.conf")
	keytabPath := filepath.Join(*directory, "fixture.keytab")
	config := fmt.Sprintf(`[libdefaults]
 default_realm = %s
 dns_lookup_realm = false
 dns_lookup_kdc = false
 rdns = false
 udp_preference_limit = 1
 default_tgs_enctypes = aes256-cts-hmac-sha1-96
 default_tkt_enctypes = aes256-cts-hmac-sha1-96
 permitted_enctypes = aes256-cts-hmac-sha1-96

[realms]
 %s = {
  kdc = %s
 }

[domain_realm]
 .localhost = %s
 localhost = %s
`, kdc.Realm, kdc.Realm, kdc.TCPListener.Addr().String(), kdc.Realm, kdc.Realm)
	if err := os.WriteFile(configPath, []byte(config), 0o644); err != nil {
		log.Fatal(err)
	}
	keytab, err := kdc.Keytab.Marshal()
	if err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(keytabPath, keytab, 0o600); err != nil {
		log.Fatal(err)
	}
	info := fixtureInfo{
		Realm:              kdc.Realm,
		Address:            kdc.TCPListener.Addr().String(),
		ConfigPath:         configPath,
		KeytabPath:         keytabPath,
		ClientPrincipal:    "alice@" + kdc.Realm,
		ServicePrincipal:   "hive/localhost@" + kdc.Realm,
		ZooKeeperPrincipal: "zookeeper/localhost@" + kdc.Realm,
	}
	if err := json.NewEncoder(os.Stdout).Encode(info); err != nil {
		log.Fatal(err)
	}
	if err := os.Stdout.Sync(); err != nil {
		log.Fatal(err)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	<-signals
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10685** (2026-09-29): **fix(postgres): export enum types and preserve index ordering**
  *Symptoms*: ## 变更说明 / Change Description  PostgreSQL SQL 结构导出现在会在建表语句之前写出 schema 中的枚举类型定义，避免导入时因缺少枚举类型而失败。表 DDL 同时保留 B-tree 索引每个键的 `ASC`/`DESC` 与 `NULLS FIRST`/`NULLS LAST`，覆盖 Issue 补充评论中的索引排序差异；原生 PostgreSQL 与 PostgreSQL-like JDBC Agent 路径均处理该元数据。  ## 变更类型 / Change Type  - [ ] 新功能 / New feature - [x] Bug 修复 / Bug fix - [ ] 性能优化 / Performance improvement - [ ] 代码重构 / Code refactoring - [ ] 文档更新 / Documentation - [ ] CI / 构建 / CI or build  ## 涉及前端 / Frontend Changes  - [ ] 本 PR 涉及前端改动，已附截图/录屏（见下方） / This PR includes frontend changes and screenshots or a recording are attached below.  本 PR 未修改前端。  ## 验证 / V
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in 26ab78f2d3, will be released in the next version.

- **Issue #10678** (2026-09-29): **postgreSQL DDL错误**
  *Symptoms*: ### 数据库类型和版本 / Database type and version  PostgreSQL 17.6 (Debian 17.6-2.pgdg13+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit  ### 问题描述 / Description / Problem description  表属性中的DDL，bigserial 字段被翻译成了bigint  如： id 字段 CREATE TABLE "public"."i18n" (   "id" bigint NOT NULL DEFAULT nextval('i18n_id_seq'::regclass),   "create_user" bigint,   "create_time" timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP,   "update_user" bigint,   "update_time" timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP,   "is_deleted" bigint NOT NULL DEFAULT 0,   "version" bigint NOT NU
  **Post-Mortem & Fix Analysis**:
  > <!-- dbx-similar-issues --> 以下 Issue 可能与当前问题相关：  - #6037 - #10079 - #7142  这些结果由机器人自动检索，尚未确认重复。如属于同一问题，建议在已有 Issue 中补充信息。
  > 已在提交 `e00af0969` 完成修复，目标版本为 `v0.6.28`。  根因是 PostgreSQL-like Java Agent 只读取整数类型和 `nextval(...)` 默认值，没有校验序列是否由该列拥有，因此 legacy `bigserial` 在表属性 DDL 中被还原为 `bigint DEFAULT nextval(...)`。  修复在 PostgreSQL-like 元数据路径中根据 `pg_depend` 的列级 AUTO 依赖、默认表达式对同一序列的精确引用和序列关系类型识别 `smallserial`/`serial`/`bigserial`；表 DDL 仅对已确认的 marker 输出对应伪类型并移除重复默认值。普通 `bigint`、手工/共享 `nextval`、identity 列以及通用非 PostgreSQL DDL builder 的既

- **Issue #10677** (2026-09-29): **fix(grid): 加载全部后大值预览被截成几个字符，底部 SQL 未反映执行分段**
  *Symptoms*: ## 变更说明 / Change Description  修复 #10661：点「加载全部并转到末行」后，文本列多的表单元格被截成 `1999...`（服务器只返回 4 个字符），底部 SQL 却仍显示 `LIMIT 100`。  ### 复现  - 表 `ads.ads_platform_order_receiver`（PostgreSQL 16，506 行、11 列、主键 `id`） - DBX 0.6.27；web 版（与桌面版同一套前端 + 同一套 Rust 后端）本地运行 - 操作：打开表 → 点结果栏「总计行数」得到 506 → 点「加载全部并转到末行」 - 现象：单元格 `1999...` / `2609...` / `ABCD...` / `1728...`，底部 SQL 仍是 `SELECT * FROM "ads"."ads_platform_order_receiver" LIMIT 100;`，状态栏却显示「已全部加载」。与 issue 截图逐字一致。  ### 根因  1. **大值预览预算按「请求的 limit」而非「这一段真正返回的行数」分摊。**    `previewSizeForColumnCount()` 用 `24MB / pageSize / 预览列数 / 6` 算每格字符数，而「加载全部」把这次请求的上限（`99900`）当成 page
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution! Merged in 237064f9e3, will be released in the next version.

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

### Incident Patch 1: `d9399593` (2026-09-29)
**Commit Message**: fix(core): gate secret codec test helper to keyring builds

**File**: `crates/dbx-core/src/persistence/secret_codec.rs` (modified, +1/-0)
```diff
@@ -610,6 +610,7 @@ mod tests {
         LOCK.get_or_init(|| Mutex::new(()))
     }
 
+    #[cfg(all(feature = "os-keyring", target_os = "linux"))]
     fn restore_env(name: &str, value: Option<std::ffi::OsString>) {
         if let Some(value) = value {
             std::env::set_var(name, value);
```

---

### Incident Patch 2: `13c3f820` (2026-09-29)
**Commit Message**: fix(settings): persist appearance preferences

Closes #10524

**File**: `apps/desktop/src/composables/useTheme.ts` (modified, +5/-0)
```diff
@@ -27,6 +27,7 @@ import {
 } from "@/lib/app/appTheme";
 import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/backend/safeStorage";
 import { isTauriRuntime } from "@/lib/backend/tauriRuntime";
+import { persistAppAppearancePatch } from "@/lib/app/appAppearance";
 
 function isLinuxTauriRuntime() {
   return isTauriRuntime() && typeof navigator !== "undefined" && /linux/i.test(navigator.userAgent);
@@ -169,13 +170,15 @@ function applyTheme() {
 function setThemeMode(mode: AppThemeMode) {
   themeMode.value = mode;
   safeLocalStorageSet(APP_THEME_STORAGE_KEY, mode);
+  persistAppAppearancePatch({ themeMode: mode });
   applyTheme();
 }
 
 function setThemePalette(palette: AppThemePalette) {
   savedThemePaletteValue.value = palette;
   previewedThemePalette.value = null;
   safeLocalStorageSet(APP_THEME_PALETTE_STORAGE_KEY, palette);
+  persistAppAppearancePatch({ themePalette: palette });
   applyTheme();
 }
 
@@ -225,6 +228,7 @@ function setCustomUiColors(colors: AppCustomUiColors) {
     customUiColors.value = next;
     safeLocalStorageSet(APP_CUSTOM_UI_STORAGE_KEY, JSON.stringify(next));
   }
+  persistAppAppearancePatch({ [isDark.value ? "customUiColorsDark" : "customUiColors"]: next });
   applyCustomUiColors();
 }
 
@@ -235,6 +239,7 @@ function resetCustomUiColors() {
 function setCornerStyle(style: AppCornerStyle) {
   cornerStyle.value = normalizeAppCornerStyle(style);
   safeLocalStorageSet(APP_CORNER_STYLE_STORAGE_KEY, cornerStyle.value);
+  persistApp
```

**File**: `apps/desktop/src/i18n/index.ts` (modified, +4/-15)
```diff
@@ -1,7 +1,7 @@
 import { createI18n } from "vue-i18n";
 import en from "./locales/en";
-import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/backend/safeStorage";
-import { isTauriRuntime } from "@/lib/backend/tauriRuntime";
+import { safeLocalStorageGet } from "@/lib/backend/safeStorage";
+import { persistAppLocale } from "@/lib/app/appAppearance";
 
 export type Locale = "az" | "en" | "es" | "it" | "ja" | "ko" | "pt-BR" | "ru" | "tr" | "zh-CN" | "zh-TW";
 type LocaleMessages = Record<string, unknown>;
@@ -98,19 +98,9 @@ export async function loadLocaleMessages(locale: Locale) {
   loadedLocales.add(locale);
 }
 
-async function syncLocaleToBackend(locale: Locale) {
-  if (!isTauriRuntime()) return;
-  try {
-    const { invoke } = await import("@tauri-apps/api/core");
-    await invoke("set_app_locale", { locale });
-  } catch (error) {
-    console.warn("[DBX][i18n] failed to sync locale to backend", error);
-  }
-}
-
 export async function loadSavedLocale() {
   await loadLocaleMessages(initialLocale);
-  void syncLocaleToBackend(initialLocale);
+  persistAppLocale(initialLocale);
 }
 
 async function applyTransientLocale(locale: Locale) {
@@ -138,8 +128,7 @@ export async function setLocale(locale: Locale) {
   ++localeRequestId;
   // An explicit selection is durable immediately; only the visible locale
   // waits for its lazy message bundle. Preview paths never reach this branch.
-  safeLocalStorageSet("dbx-locale", locale);
-  void syncLocaleToBackend(loca
```

**File**: `apps/desktop/src/lib/app/__tests__/appAppearance.spec.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+// @vitest-environment happy-dom
+
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+const invoke = vi.hoisted(() => vi.fn());
+
+vi.mock("@/lib/backend/tauriRuntime", () => ({ isTauriRuntime: () => true }));
+vi.mock("@tauri-apps/api/core", () => ({ invoke }));
+
+async function loadAppearance() {
+  vi.resetModules();
+  return import("@/lib/app/appAppearance");
+}
+
+beforeEach(() => {
+  invoke.mockReset();
+  window.localStorage.clear();
+});
+
+describe("Tauri appearance persistence", () => {
+  it("gives durable backend values precedence over stale WebView storage", async () => {
+    window.localStorage.setItem("dbx-locale", "en");
+    window.localStorage.setItem("dbx-theme", "light");
+    window.localStorage.setItem("dbx-theme-palette", "pearl");
+    invoke.mockResolvedValueOnce({ locale: "zh-CN", themeMode: "dark", themePalette: "cobalt", cornerStyle: "small" });
+
+    const { hydrateAppAppearance } = await loadAppearance();
+    await hydrateAppAppearance();
+
+    expect(window.localStorage.getItem("dbx-locale")).toBe("zh-CN");
+    expect(window.localStorage.getItem("dbx-theme")).toBe("dark");
+    expect(window.localStorage.getItem("dbx-theme-palette")).toBe("cobalt");
+    expect(window.localStorage.getItem("dbx-corner-style")).toBe("small");
+    expect(invoke).toHaveBeenCalledWith("load_app_appearance_settings", undefined);
+    expect(invoke).toHaveBeenCalledTimes(1);
+  });
+
+  it("migrates legacy WebView values when 
```

---

### Incident Patch 3: `d9b6d44d` (2026-09-29)
**Commit Message**: fix(core): gate collection path helper to keyring builds

**File**: `crates/dbx-core/src/persistence/secret_codec.rs` (modified, +1/-0)
```diff
@@ -442,6 +442,7 @@ fn secret_service_provider_is_missing(error: &str) -> bool {
         || error.contains("no secret service provider or dbus session found")
 }
 
+#[cfg(any(test, all(feature = "os-keyring", target_os = "linux")))]
 fn collection_path_is_registered<'a>(path: &str, collection_paths: impl IntoIterator<Item = &'a str>) -> bool {
     collection_paths.into_iter().any(|candidate| candidate == path)
 }
```

---

### Incident Patch 4: `530bb2bb` (2026-09-29)
**Commit Message**: fix(grid): commit temporal value editor on blur like CodeMirror sibling

**File**: `apps/desktop/src/components/grid/DataGrid.vue` (modified, +0/-1)
```diff
@@ -14191,7 +14191,6 @@ useUpdateBlocker(() => (hasPendingChanges.value || hasPendingDataEditorDraft.val
                     :kind="detailTemporalEditorConfig.kind"
                     :fraction-precision="detailTemporalEditorConfig.fractionPrecision"
                     variant="inline"
-                    :commit-on-close="false"
                     @cancel="cancelValueEditorEdit"
                     @commit="commitValueEditorEdit"
                     @save="onTemporalCellEditorSave"
```

**File**: `apps/desktop/src/components/grid/TemporalCellEditor.vue` (modified, +6/-0)
```diff
@@ -107,6 +107,10 @@ function setOpen(value: boolean) {
 
 function setModelValue(value: string, normalize = false) {
   const nextValue = normalize ? (props.normalizeValue?.(value) ?? value) : value;
+  // 用户重新输入即解除 closeHandled 闩锁：值编辑器面板里同一实例持续挂载，
+  // 失焦/关板提交（#10667）要求闩锁只覆盖「本次已提交」，否则首次提交后
+  // 后续编辑的 blur 永远不再提交。网格实例提交即卸载，复位对其无影响。
+  closeHandled = false;
   localValue.value = nextValue;
   emit("update:modelValue", nextValue);
 }
@@ -214,6 +218,8 @@ function finishCommit() {
   // 值编辑器面板用 commitValueEditorEdit 保持同一实例不卸载（以便连续编辑），
   // isCommitting 若一直闩锁，第二次 ctrl+s/Enter 会在上面的短路处被吞掉（#10515）。
   // 本 tick 内仍防重入；下一个微任务复位，让持续挂载的实例可再次提交。
+  // closeHandled 不按时间复位——它标记「本次编辑已收尾」，避免提交后的 blur
+  // 再触发一次；用户重新输入时在 setModelValue 里解除（#10667）。
   nextTick(() => {
     isCommitting = false;
   });
```

**File**: `apps/desktop/src/components/grid/__tests__/TemporalCellEditorCommitOnBlur.spec.ts` (added, +114/-0)
```diff
@@ -0,0 +1,114 @@
+// @vitest-environment happy-dom
+
+import { readFileSync } from "node:fs";
+import { resolve } from "node:path";
+import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
+import { createPinia, setActivePinia } from "pinia";
+import { afterEach, describe, expect, it, vi } from "vitest";
+
+import TemporalCellEditor from "../TemporalCellEditor.vue";
+
+const dataGridSource = readFileSync(resolve(import.meta.dirname, "../DataGrid.vue"), "utf8");
+const cellDetailPanelSource = readFileSync(resolve(import.meta.dirname, "../DataGridCellDetailPanel.vue"), "utf8");
+
+const mountedApps: Array<{ app: App; host: HTMLElement }> = [];
+
+function mountEditor() {
+  const pinia = createPinia();
+  setActivePinia(pinia);
+  const modelValue = ref("2026-01-02 03:04:05");
+  const onCommit = vi.fn();
+  const onCancel = vi.fn();
+  const onSave = vi.fn();
+  const host = document.createElement("div");
+  document.body.append(host);
+  // 与值编辑器面板相同的挂载形态：variant="inline"、commitOnClose 默认 true、
+  // 同一实例持续挂载不卸载（#10667）。
+  const Root = defineComponent({
+    setup() {
+      return () =>
+        h(TemporalCellEditor, {
+          kind: "datetime",
+          variant: "inline",
+          modelValue: modelValue.value,
+          "onUpdate:modelValue": (value: string) => {
+            modelValue.value = value;
+          },
+          onCommit,
+          onCancel,
+          onSave,
+        });
+    },
+  });
+  const app = createApp(Root);
+  app.us
```

---

### Incident Patch 5: `9d9eb0af` (2026-09-29)
**Commit Message**: fix(security): repair Linux Secret Service key lookup

Closes #10676

**File**: `crates/dbx-core/src/persistence/secret_codec.rs` (modified, +111/-16)
```diff
@@ -308,7 +308,10 @@ fn platform_keyring_codec(allow_create: bool) -> Result<Option<SecretCodec>, Str
     let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
         .map_err(|error| format!("keyring entry unavailable: {error}"))?;
     match entry.get_password() {
-        Ok(value) => return Ok(SecretCodec::from_key_material(value.trim()).ok()),
+        Ok(value) => {
+            let codec = SecretCodec::from_key_material(value.trim()).map_err(|_| "SECRET_KEY_INVALID".to_string())?;
+            return Ok(Some(codec));
+        }
         Err(keyring::Error::NoEntry) => {}
         // Distinguish a present-but-unreadable keychain item (ACL denial,
         // locked keychain) from a missing one: callers surface this class in
@@ -344,42 +347,76 @@ where
 
 #[cfg(all(feature = "os-keyring", target_os = "linux"))]
 fn secret_service_keyring_codec(allow_create: bool) -> Result<Option<SecretCodec>, String> {
-    use secret_service::{blocking::SecretService, EncryptionType};
+    use secret_service::{blocking::SecretService, EncryptionType, Error as SecretServiceError};
     use std::collections::HashMap;
 
     // A missing session bus (headless server/container) means the provider is
     // absent rather than broken; return None so callers fall back to the
     // managed .dbx/secret.key file exactly as before.
     let service = match SecretService::connect(EncryptionType::Dh) {
         Ok(service) => service,
-        Err(_) => return Ok(None),
-    };
-    
```

#### Recent Merged Pull Requests:
- **PR #10685** (2026-09-29): fix(postgres): export enum types and preserve index ordering (@eryajf)
- **PR #10683** (2026-09-29): feat(grid): add configurable shortcut to focus WHERE condition (@sinkey100)
- **PR #10677** (2026-09-29): fix(grid): 加载全部后大值预览被截成几个字符，底部 SQL 未反映执行分段 (@zipg)
- **PR #10673** (2026-09-29): fix(transfer): 传输中途池被丢弃/移除后自动重连，修复后续表报 Connection not found（Fixes #10589） (@zipg)
- **PR #10672** (2026-09-29): feat(ai): send editor selection to the AI as bound context (@Abeautifulsnow)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
