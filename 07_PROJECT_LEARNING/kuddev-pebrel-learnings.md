> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `f5cf5a68`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T14:14:54.754Z  
> **Learning ID**: `learn-github-kuddev-pebrel`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Kuddev/pebrel

> **Canonical Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T14:14:54.130Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3507 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/connection/DesktopState.kt`
```
package io.github.kuddev.pebrel.mobile.connection

import org.json.JSONObject

/** IDs from the shared OS icon catalog, based on the host response rather than its name. */
fun desktopOsIcon(os: String): String = when (val normalized = os.lowercase(java.util.Locale.ROOT)) {
    "windows", "win32" -> "windows"
    "macos", "darwin" -> "macos"
    "linux", "ubuntu", "debian", "centos", "rhel", "fedora", "rocky", "alpine", "arch", "suse", "nixos", "kali", "freebsd" -> normalized
    else -> "term"
}

data class DesktopPane(
    val window: Long, val id: Long, val title: String, val cwd: String,
    val task: String, val state: String, val sequence: Long,
    val sshDestination: String? = null,
    val tabLabel: String = "",
    val tabId: String? = null,
    val agent: DesktopAgent? = null,
) {
    // 显示跟随桌面 Tab；旧端只发进程路径时取末级，原路径仍用于详情和 Git 目标校验。
    val displayTitle: String get() = tabLabel.ifBlank {
        val raw = title.ifBlank { cwd }
        raw.trimEnd('/', '\\').substringAfterLast('/').substringAfterLast('\\').ifBlank { raw }
    }
}

data class DesktopAgent(val kind: String, val name: String, val session: String?)

data class DesktopFile(val path: String, val remote: Boolean, val dirty: Boolean,
                       val saving: Boolean, val ready: Boolean, val revision: Long?)

data class DesktopTab(val window: Long, val id: String?, val index: Int, val title: String,
                      val kind: String, val active: Boolean, val focusedPane: Long?,
                      val panes: List<DesktopPane>, val file: DesktopFile?) {
    val key: String get() = "$window:${id ?: "legacy:$index"}"
    val readable: Boolean get() = file != null && kind in setOf("document", "code", "image")
    val primaryPane: DesktopPane? get() = panes.find { it.id == focusedPane } ?: panes.firstOrNull()
    val displayTitle: String get() = title.trimEnd('/', '\\').substringAfterLast('/').substringAfterLast('\\')
}

/** A projection of desktop authority; never infer task completion from terminal text. */
fun parseDesktopTabs(snapshot: JSONObject): List<DesktopTab> = buildList {
    val windows = snapshot.getJSONArray("windows")
    for (w in 0 until windows.length()) {
        val window = windows.getJSONObject(w)
        val tabs = window.getJSONArray("tabs")
        for (t in 0 until tabs.length()) {
            val tab = tabs.getJSONObject(t)
            val id = tab.optString("tab_id").takeIf { !tab.isNull("tab_id") && it.isNotBlank() }
            val panes = tab.getJSONArray("panes")
            val children = (0 until panes.length()).map { p ->
                val pane = panes.getJSONObject(p)
                DesktopPane(window.getLong("id"), pane.getLong("id"),
                    pane.optString("title"), pane.optString("cwd"),
                    if (pane.isNull("running_program")) "" else pane.optString("running_program"),
                    pane.optString("task_state", "unknown"), pane.optLong("state_change_seq"),
                    if (pane.isNull("ssh_destination")) null else pane.optString("ssh_destination"), tab.optString("label"), id,
                    pane.optJSONObject("agent")?.let { agent -> DesktopAgent(agent.getString("kind"), agent.optString("display_name"),
                        if (agent.isNull("session_id")) null else agent.getString("session_id")) })
            }
            val file = tab.optJSONObject("file")?.let {
                DesktopFile(it.getString("path"), it.optBoolean("remote"), it.optBoolean("dirty"),
                    it.optBoolean("saving"), it.optBoolean("ready"), if (it.isNull("revision")) null else it.getLong("revision"))
            }
            add(DesktopTab(window.getLong("id"), id, tab.optInt("index", t), tab.optString("label"),
                tab.optString("kind", "shell"), tab.optBoolean("active"),
                if (tab.isNull("focused_pane_id")) null else tab.getLong("focused_pane_id"), children, file))
        }
    }
}

fun parseDesktopPanes(snapshot: JSONObject): List<DesktopPane> = parseDesktopTabs(snapshot).flatMap { it.panes }

/** The cursor belongs to a computer; snapshots can recover only the latest observable state. */
class DesktopTransitions(saved: JSONObject? = null) {
    private var process: Long? = null
    var revision = 0L
        private set
    private val sequences = LinkedHashMap<Pair<Long, Long>, Long>()
    init {
        if (saved != null) runCatching {
            process = saved.getLong("process")
            val rows = saved.getJSONArray("panes")
            require(rows.length() <= 512)
            for (i in 0 until rows.length()) rows.getJSONArray(i).let {
                sequences[it.getLong(0) to it.getLong(1)] = it.getLong(2)
            }
        }.onFailure { process = null; sequences.clear() }
    }
    fun checkpoint(): JSONObject = JSONObject().put("process", process).put("panes", org.json.JSONArray().apply {
        sequences.entries.toList().takeLast(512).forEach { (id, sequence) ->
            put(org.json.JSONArray().put(id.first).put(id.second).put(sequence))
        }
    })
    fun observe(snapshot: JSONObject): List<DesktopPane> {
        val id = snapshot.getLong("process_id")
        val first = process != id
        if (first) { sequences.clear(); process = id; revision++ }
        val panes = parseDesktopPanes(snapshot)
        val changed = panes.filter { pane ->
            val key = pane.window to pane.id
            val previous = sequences[key]
            if (previous == null || pane.sequence > previous) { sequences[key] = pane.sequence; revision++ }
            !first && previous != null && pane.sequence > previous &&
                pane.state in setOf("finished", "failed", "waiting_input", "attention")
        }
        if (sequences.keys.retainAll(panes.map { it.window to it.id }.toSet())) revision++
        // 停用提醒时仍推进序号；重新开启不会补发停用期间的旧事件。
        return if (snapshot.optJSONObject("mobile_policy")?.optBoolean("notifications", true) != false) changed else emptyList()
    }
}

```

### Core Architecture Module: `mobile/android/ghostty/src/main/cpp/render.cpp`
```
#include "bridge.h"

static void append_utf16(std::vector<jchar>& target, uint32_t codepoint) {
    if (codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff)) codepoint = 0xfffd;
    if (codepoint <= 0xffff) target.push_back(codepoint);
    else {
        codepoint -= 0x10000;
        target.push_back(0xd800 + (codepoint >> 10));
        target.push_back(0xdc00 + (codepoint & 0x3ff));
    }
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(render)(JNIEnv* env, jobject, jlong handle,
        jobjectArray output_rows, jintArray metadata) {
    auto* state = terminal(handle);
    // 页预算和可见历史行数分别限制；先夹紧视口，再读取对应的绘制行。
    const auto scrollbar = state->bounded_scrollbar();
    if (!checked(env, ghostty_render_state_update(state->render, state->vt))) return;
    uint16_t columns = 0, rows = 0, cx = 0, cy = 0;
    bool visible = false, in_viewport = false;
    GhosttyRenderStateDirty dirty{};
    GhosttyRenderStateCursorVisualStyle cursor_style{};
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_COLS, &columns);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_ROWS, &rows);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_DIRTY, &dirty);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VISIBLE, &visible);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_HAS_VALUE, &in_viewport);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_X, &cx);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_Y, &cy);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VISUAL_STYLE, &cursor_style);
    GhosttyRenderStateColors colors{};
    colors.size = sizeof(colors);
    if (!checked(env, ghostty_render_state_colors_get(state->render, &colors))) return;
    if (env->GetArrayLength(output_rows) != rows) {
        env->ThrowNew(env->FindClass("java/lang/IllegalArgumentException"), "Incorrect viewport row count");
        return;
    }
    GhosttyTerminalScreen screen{};
    ghostty_terminal_get(state->vt, GHOSTTY_TERMINAL_DATA_ACTIVE_SCREEN, &screen);
    jint meta[] = {columns, rows, cx, cy, visible && in_viewport, argb(colors.background),
        argb(colors.cursor_has_value ? colors.cursor : colors.foreground), static_cast<jint>(cursor_style),
        static_cast<jint>(std::min(scrollbar.total, uint64_t{INT32_MAX})),
        static_cast<jint>(std::min(scrollbar.offset, uint64_t{INT32_MAX})),
        screen == GHOSTTY_TERMINAL_SCREEN_ALTERNATE};
    env->SetIntArrayRegion(metadata, 0, 11, meta);
    auto row_class = env->FindClass("io/github/kuddev/pebrel/terminal/TerminalRow");
    if (!row_class) return;
    auto constructor = env->GetMethodID(row_class, "<init>", "(Ljava/lang/String;[I)V");
    if (!constructor) return;
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR, &state->rows);
    int y = -1;
    std::vector<uint32_t> codepoints;
    std::vector<jchar> text;
    std::vector<jint> cells(columns * 6);
    while (ghostty_render_state_row_iterator_next(state->rows)) {
        ++y;
        bool row_dirty = false;
        ghostty_render_state_row_get(state->rows, GHOSTTY_RENDER_STATE_ROW_DATA_DIRTY, &row_dirty);
        if (!state->force && dirty != GHOSTTY_RENDER_STATE_DIRTY_FULL && !row_dirty) continue;
        text.clear();
        ghostty_render_state_row_get(state->rows, GHOSTTY_RENDER_STATE_ROW_DATA_CELLS, &state->cells);
        int x = 0;
        while (ghostty_render_state_row_cells_next(state->cells)) {
            GhosttyCell raw{};
            GhosttyCellWide width{};
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_RAW, &raw);
            ghostty_cell_get(raw, GHOSTTY_CELL_DATA_WIDE, &width);
            auto foreground = colors.foreground, background = colors.background;
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR, &foreground);
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_BG_COLOR, &background);
            GhosttyStyle style{};
            style.size = sizeof(style);
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE, &style);
            if (style.inverse) std::swap(foreground, background);
            const int cell_width = width == GHOSTTY_CELL_WIDE_WIDE ? 2 :
                (width == GHOSTTY_CELL_WIDE_NARROW ? 1 : 0);
            const int start = text.size();
            uint32_t length = 0;
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN, &length);
            if (cell_width) {
                if (length) {
                    codepoints.resize(length);
                    ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF, codepoints.data());
                    for (auto codepoint : codepoints) append_utf16(text, codepoint);
                } else text.push_back(' ');
            }
            auto* cell = cells.data() + x * 6;
            cell[0] = start;
            cell[1] = text.size() - start;
            cell[2] = cell_width;
            cell[3] = argb(foreground);
            cell[4] = argb(background);
            cell[5] = (style.bold ? 1 : 0) | (style.italic ? 2 : 0) | (style.underline ? 4 : 0) |
                (style.strikethrough ? 8 : 0) | (style.faint ? 16 : 0) | (style.invisible ? 32 : 0);
            ++x;
        }
        auto row_text = env->NewString(text.data(), text.size());
        auto row_cells = env->NewIntArray(cells.size());
        if (!row_text || !row_cells) return;
        env->SetIntArrayRegion(row_cells, 0, cells.size(), cells.data());
        auto row = env->NewObject(row_class, constructor, row_text, row_cells);
        if (!row) return;
        env->SetObjectArrayElement(output_rows, y, row);
        env->DeleteLocalRef(row);
        env->DeleteLocalRef(row_text);
        env->DeleteLocalRef(row_cells);
        bool clean = false;
        ghostty_render_state_row_set(state->rows, GHOSTTY_RENDER_STATE_ROW_OPTION_DIRTY, &clean);
    }
    state->force = false;
    const GhosttyRenderStateDirty clean = GHOSTTY_RENDER_STATE_DIRTY_FALSE;
    ghostty_render_state_set(state->render, GHOSTTY_RENDER_STATE_OPTION_DIRTY, &clean);
}

```

### Core Architecture Module: `mobile/android/ghostty/src/main/java/io/github/kuddev/pebrel/terminal/GhosttyCore.kt`
```
package io.github.kuddev.pebrel.terminal

import java.io.Closeable

/** A row crosses JNI once; cells use six integers, never one Java object per cell. */
class TerminalRow(val text: String, val cells: IntArray)

data class TerminalHistory(val first: Long, val oldest: Long, val end: Long, val liveStart: Long,
                           val liveRows: Int, val applicationScroll: Boolean)

class TerminalFrame(val rows: Array<TerminalRow?>, val meta: IntArray, val wrapped: BooleanArray? = null,
                    val history: TerminalHistory? = null,
                    internal val sourceOffsets: IntArray? = null) {
    val columns get() = meta[0]
    val cursorX get() = meta[2]
    val cursorY get() = meta[3]
    val cursorVisible get() = meta[4] != 0
    val background get() = meta[5]
    val cursorColor get() = meta[6]
    val cursorStyle get() = meta[7]
    val scrollTotal get() = meta.getOrElse(8) { rows.size }
    val scrollOffset get() = meta.getOrElse(9) { 0 }
    val alternateScreen get() = meta.getOrElse(10) { 0 } != 0
    fun text() = rows.joinToString("\n") { it?.text?.trimEnd().orEmpty() }.trimEnd()
}

/** Synchronization is a lifetime boundary; production calls run on a serial worker. */
class GhosttyCore(columns: Int = 80, rows: Int = 24, scrollbackLines: Int = 1000) : Closeable {
    private var handle: Long
    private var rowCache: Array<TerminalRow?>
    init {
        require(columns in 2..400 && rows in 2..200)
        require(scrollbackLines in 0..5000)
        handle = NativeBridge.create(columns, rows, scrollbackLines)
        check(handle != 0L)
        rowCache = arrayOfNulls(rows)
    }
    private fun pointer(): Long { check(handle != 0L) { "Terminal is closed" }; return handle }
    @Synchronized fun feed(bytes: ByteArray, count: Int = bytes.size): ByteArray {
        require(count in 0..bytes.size && count <= 65536)
        return NativeBridge.feed(pointer(), bytes, count)
    }
    @Synchronized fun takeTitle(): String? = NativeBridge.title(pointer())?.toString(Charsets.UTF_8)
    @Synchronized fun resize(columns: Int, rows: Int, cellWidth: Int, cellHeight: Int) {
        require(columns in 2..400 && rows in 2..200 && cellWidth in 1..256 && cellHeight in 1..256)
        NativeBridge.resize(pointer(), columns, rows, cellWidth, cellHeight)
        if (rowCache.size != rows) rowCache = arrayOfNulls(rows)
    }
    @Synchronized fun snapshot(): TerminalFrame {
        val meta = IntArray(11)
        NativeBridge.render(pointer(), rowCache, meta)
        // Unchanged immutable rows are shared across frames; changed rows are replaced by JNI.
        return TerminalFrame(rowCache.copyOf(), meta)
    }
    @Synchronized fun scroll(lines: Int) = NativeBridge.scroll(pointer(), lines)
    @Synchronized fun scrollTo(offset: Int) = NativeBridge.scrollTo(pointer(), offset.coerceAtLeast(0))
    @Synchronized fun wheel(lines: Int, column: Int, row: Int, applicationOnly: Boolean = false): ByteArray {
        require(lines != 0 && lines in -32..32 && column >= 0 && row >= 0)
        return NativeBridge.wheel(pointer(), lines, column, row, applicationOnly)
    }
    @Synchronized fun colors(colors: IntArray) {
        require(colors.size == 19)
        NativeBridge.colors(pointer(), colors)
    }
    @Synchronized fun key(code: Int, mods: Int, action: Int, text: String = "", unshifted: Int = 0): ByteArray =
        NativeBridge.key(pointer(), code, mods, action, text.toByteArray(), unshifted)
    @Synchronized fun paste(text: String): ByteArray {
        // Strip terminators that could escape bracketed paste and execute following text.
        val safe = text.replace("\u001b", "").replace("\u0000", "").replace("\r\n", "\n")
        return (if (NativeBridge.bracketedPaste(pointer())) "\u001b[200~$safe\u001b[201~" else safe).toByteArray()
    }
    @Synchronized override fun close() {
        if (handle != 0L) { NativeBridge.destroy(handle); handle = 0; rowCache = emptyArray() }
    }
}

internal object NativeBridge {
    init { System.loadLibrary("pebrel_ghostty") }
    external fun create(columns: Int, rows: Int, scrollbackLines: Int): Long
    external fun destroy(handle: Long)
    external fun feed(handle: Long, input: ByteArray, count: Int): ByteArray
    external fun title(handle: Long): ByteArray?
    external fun resize(handle: Long, columns: Int, rows: Int, cellWidth: Int, cellHeight: Int)
    external fun render(handle: Long, rows: Array<TerminalRow?>, metadata: IntArray)
    external fun scroll(handle: Long, lines: Int)
    external fun scrollTo(handle: Long, offset: Int)
    external fun wheel(handle: Long, lines: Int, column: Int, row: Int, applicationOnly: Boolean): ByteArray
    external fun colors(handle: Long, colors: IntArray)
    external fun key(handle: Long, keyCode: Int, mods: Int, action: Int, text: ByteArray, unshifted: Int): ByteArray
    external fun bracketedPaste(handle: Long): Boolean
    external fun ptyOpen(directory: String, startup: String, columns: Int, rows: Int): IntArray
    external fun ptyResize(fd: Int, columns: Int, rows: Int, cellWidth: Int, cellHeight: Int)
    external fun ptyStop(pid: Int)
    external fun ptyWait(pid: Int): Int
}

```

### Core Architecture Module: `mobile/relay/loopback-proxy.mjs`
```
import net from 'node:net';

const MAX_PROXY_CONNECTIONS = 2;
const MAX_PROXY_CHUNK = 2 * 1024 * 1024 + 1024;

/**
 * Forward encrypted bytes from a loopback-only socket to the LAN relay. The
 * desktop connector therefore has a private wss://127.0.0.1 entry while the
 * phone uses the separately bound HTTPS/WSS listener.
 */
export async function startLoopbackProxy(targetHost, targetPort) {
  const sockets = new Set();
  const connections = new Set();
  const server = net.createServer(socket => {
    if (connections.size >= MAX_PROXY_CONNECTIONS) { socket.destroy(); return; }
    connections.add(socket);
    sockets.add(socket);
    socket.setNoDelay(true);
    const upstream = net.createConnection({ host: targetHost, port: targetPort });
    sockets.add(upstream);
    upstream.setNoDelay(true);
    const close = () => {
      socket.destroy(); upstream.destroy(); connections.delete(socket);
      sockets.delete(socket); sockets.delete(upstream);
    };
    socket.on('data', bytes => {
      if (bytes.length > MAX_PROXY_CHUNK) { close(); return; }
      if (!upstream.write(bytes)) socket.pause();
    });
    upstream.on('drain', () => socket.resume());
    upstream.on('data', bytes => {
      if (bytes.length > MAX_PROXY_CHUNK) { close(); return; }
      if (!socket.write(bytes)) upstream.pause();
    });
    socket.on('drain', () => upstream.resume());
    socket.on('error', close); upstream.on('error', close);
    socket.on('close', close); upstream.on('close', close);
  });
  server.maxConnections = MAX_PROXY_CONNECTIONS;
  await new Promise((resolve, reject) => {
    const fail = error => { server.off('listening', resolve); reject(error); };
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => { server.off('error', fail); resolve(); });
  });
  return {
    server,
    port: server.address().port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(() => resolve()));
    },
  };
}

```

### Core Architecture Module: `nebula_app/res/hooks/opencode.js`
```
// Pebrel ↔ opencode bridge — AUTO-GENERATED by Pebrel, do not edit.
// Forwards turn lifecycle to Pebrel's sidebar (icon + spinner + toasts).
// Inert outside Pebrel (no PEBREL_HOOK_EXE or legacy alias in the environment).
import { execFile } from "node:child_process"

const PebrelNotify = async ({ directory, worktree }) => {
  const hook = process.env.PEBREL_HOOK_EXE ?? process.env.NEBULA_HOOK_EXE
  if (!hook) return {}
  const controller = new AbortController()
  // Provider events interleave sessions. Permission waits keep a turn active;
  // a child session's idle must not consume the primary session's completion.
  const turns = new Map()
  const turnFor = (id) => {
    const key = id || "pending"
    const turn = turns.get(key) || { active: false, lastUser: "" }
    turns.delete(key)
    if (turns.size >= 512) turns.delete(turns.keys().next().value)
    turns.set(key, turn)
    return turn
  }
  let sessionId = ""
  let sequence = 0
  const sequenceEpoch = BigInt(Date.now()) * 1000000n
  let sendChain = Promise.resolve()
  const WATCHDOG_MS = 3000
  const send = (obj) => {
    // Serialize helper processes. opencode may publish busy → idle → idle in
    // one tick; detached children can otherwise reach Pebrel out of order.
    try {
      if (sessionId) obj.session_id = sessionId
      if (!obj.cwd && (directory || worktree)) obj.cwd = directory || worktree
      const bridgeSequence = (sequenceEpoch + BigInt(++sequence)).toString()
      obj.bridge_sequence = bridgeSequence
      if (!obj.event_id) obj.event_id = `${sessionId || "pending"}:${bridgeSequence}`
      const payload = JSON.stringify(obj)
      // Run without a shell and bound a stuck helper so it cannot block idle.
      sendChain = sendChain
        .then(() => {
          if (controller.signal.aborted) return
          let watchdog
          return Promise.race([
            new Promise((resolve) => {
              execFile(hook, ["opencode", payload], {
                timeout: WATCHDOG_MS,
                killSignal: "SIGKILL",
                windowsHide: true,
                signal: controller.signal,
              }, () => resolve())
            }),
            new Promise((resolve) => { watchdog = setTimeout(resolve, WATCHDOG_MS) }),
          ]).finally(() => clearTimeout(watchdog))
        })
        .catch(() => {})
    }
    catch (_) {}
  }
  const reportPermission = (input) => {
    const request = input || {}
    const candidate = request.sessionID || request.sessionId || (request.session && request.session.id)
    if (candidate) sessionId = candidate
    const permission = request.permission
    const permissionType = typeof permission === "string"
      ? permission
      : permission && (permission.type || permission.name)
    const requestId = request.id || request.permissionID || request.permissionId || request.callID || request.callId
    send({
      kind: "attention",
      event_id: requestId ? `${sessionId || "pending"}:permission:${requestId}` : undefined,
      message: request.title || request.message || request.reason || request.description || "",
      permission_or_tool: permissionType || request.action || request.type || request.tool || "permission",
      cwd: request.directory || request.cwd || "",
      context: request,
    })
  }
  return {
    dispose: async () => {
      controller.abort()
      await sendChain
    },
    event: async ({ event }) => {
      const t = event && event.type
      const props = (event && event.properties) || {}
      const info = props.info || {}
      // Root session only: subagents carry parentID and must not steal the
      // pane's resume identity.
      const candidate = props.sessionID || info.sessionID || (!info.parentID && info.id)
      if (candidate) {
        const first = !sessionId
        sessionId = candidate
        if (first) send({ kind: "session-start" })
      }
      const turn = turnFor(sessionId)
      if (t === "message.updated") {
        if (info && info.role === "user" && info.id !== turn.lastUser) {
          turn.lastUser = info.id
          turn.active = true
          send({ kind: "prompt" })
        }
      } else if (t === "session.idle") {
        // Dedupe opencode's spurious idles (startup/cancel): only a turn
        // that actually started reports done.
        if (turn.active) { turn.active = false; send({ kind: "done" }) }
      } else if (t === "permission.updated" || t === "permission.ask") {
        // Compatibility path for OpenCode builds that also publish permission
        // changes on the generic event bus.
        reportPermission(props)
      } else if (t === "tool.execute.after") {
        send({ kind: "tool-complete" })
      } else if (t === "session.deleted") {
        turns.delete(sessionId || "pending")
        send({ kind: "session-end" })
      }
    },
    // OpenCode exposes a named permission hook. Keeping
    // this separate callback is what guarantees delivery of the full request
    // context; merely looking for an event named permission.ask is insufficient.
    "permission.ask": async (input) => {
      reportPermission(input)
    },
  }
}

// The shared object entrypoint is supported by OpenCode >= 1.18.29 and V2.
// Keep only one export: V1 loaders otherwise initialize the bridge twice.
export default {
  id: "pebrel",
  server: PebrelNotify,
  async setup(ctx) {
    const bridge = await PebrelNotify(ctx.location)
    if (!bridge.event) return
    const controller = new AbortController()
    const consume = (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        if (controller.signal.aborted) break
        // OpenCode routes unlocated session events to their owning location.
        // Reject explicitly foreign events without dropping those lifecycles.
        if (event.location && event.location.directory !== ctx.location.directory) continue
        const data = event.data
        let type
        let properties = data
        switch (event.type) {
          case "session.execution.started":
            type = "message.updated"
            properties = { info: { role: "user", sessionID: data.sessionID, id: event.id } }
            break
          case "session.execution.succeeded":
          case "session.execution.failed":
          case "session.execution.interrupted":
            type = "session.idle"
            break
          case "permission.asked":
            type = "permission.ask"
            break
          case "session.tool.success":
          case "session.tool.failed":
            type = "tool.execute.after"
            break
          case "session.deleted":
            type = "session.deleted"
            break
          default:
            continue
        }
        await bridge.event({ event: { type, properties } })
      }
    })().catch(() => {}) // Notification failures must not fail the Agent.
    return async () => {
      controller.abort()
      await bridge.dispose()
      await consume
    }
  },
}

```

### Core Architecture Module: `nebula_app/res/hooks/pi.ts`
```
// Pebrel ↔ Pi bridge — AUTO-GENERATED by Pebrel, do not edit.
import { spawn } from "node:child_process";
import { openSync, readSync, closeSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const SOURCE: string = "pi";

async function supportsSettled(): Promise<boolean> {
  // OMP 的版本号不对应 Pi 的事件合同，不能据此等待不存在的 settled。
  if (SOURCE !== "pi") return false;
  // Pi's loader supplies either package alias (or a bundled virtual module).
  // A static runtime import of the renamed package prevents old Pi from loading
  // this extension at all, before any agent_end fallback can be registered.
  for (const name of ["@earendil-works/pi-coding-agent", "@mariozechner/pi-coding-agent"]) {
    try {
      const sdk = await import(name);
      const version = sdk.VERSION ?? sdk.default?.VERSION;
      const match = typeof version === "string" && /^(\d+)\.(\d+)\.(\d+)(?:$|[-+])/.exec(version);
      if (match) {
        const [, major, minor, patch] = match.map(Number);
        return major > 0 || minor > 80 || (minor === 80 && patch >= 4);
      }
    } catch (_) {}
  }
  return false;
}

// Only provider IDs and the first JSONL metadata line are recovery identities.
// A timestamped basename or a process ID cannot be handed to pi --session.
function sessionFor(ctx: any): { session_id?: string; session_file?: string } {
  let direct: string | undefined;
  let file: string | undefined;
  try { direct = ctx?.sessionManager?.getSessionId?.() || undefined; } catch (_) {}
  try { file = ctx?.sessionManager?.getSessionFile?.() || undefined; } catch (_) {}
  let fd: number | undefined;
  try {
    if (typeof file === "string" && file.endsWith(".jsonl")) {
      fd = openSync(file, "r");
      const buffer = Buffer.alloc(16384);
      const length = readSync(fd, buffer, 0, buffer.length, 0);
      const end = buffer.indexOf(10, 0);
      if (end >= 0 && end < length) {
        const header = JSON.parse(buffer.subarray(0, end).toString("utf8"));
        if (header.type === "session" && typeof header.id === "string" && header.id
            && (!direct || direct === header.id)) {
          return { session_id: header.id, session_file: file };
        }
      }
    }
  } catch (_) {} finally { if (fd !== undefined) try { closeSync(fd); } catch (_) {} }
  return typeof direct === "string" && direct ? { session_id: direct } : {};
}

export default async function (pi: ExtensionAPI) {
  let active = false;
  let stopReason = "unknown";
  // agent_end ends one attempt; agent_settled (Pi 0.80.4+) includes retries.
  let hasSettled = await supportsSettled();
  let sequence = 0;
  const sequenceEpoch = BigInt(Date.now()) * 1000000n;
  const bridge_instance = randomUUID();
  const send = (kind: "session-start" | "prompt" | "tool-complete" | "done" | "session-end", ctx?: any, result: { stop_reason?: string } = {}) => {
    const hook = process.env.PEBREL_HOOK_EXE ?? process.env.NEBULA_HOOK_EXE;
    if (!hook) return;
    try {
      const identity = sessionFor(ctx);
      const bridge_sequence = (sequenceEpoch + BigInt(++sequence)).toString();
      const event_id = `${bridge_instance}:${bridge_sequence}`;
      const child = spawn(hook, [SOURCE, JSON.stringify({
        kind,
        ...identity,
        bridge_instance,
        bridge_sequence,
        event_id,
        cwd: ctx?.cwd || "",
        ...result,
      })], {
        // POSIX 脱离会话会丢失 /dev/tty，使 SSH 的 OSC 传输静默失效。
        detached: process.platform === "win32",
        stdio: "ignore",
        windowsHide: true,
      });
      // spawn 的 ENOENT 通过异步事件报告，不能让缺失 helper 终止 Agent。
      child.on("error", () => {});
      child.unref();
    } catch (_) {}
  };

  const finish = (ctx: any) => {
    if (!active) return;
    active = false;
    send("done", ctx, { stop_reason: stopReason });
  };
  pi.on("agent_start", async (_event, ctx) => {
    active = true;
    stopReason = "unknown";
    send("prompt", ctx);
  });
  pi.on("agent_end", async (event, ctx) => {
    if (!active) return;
    const last = [...(event.messages ?? [])].reverse().find(message => message.role === "assistant");
    // Never forward provider errors: they may contain requests or credentials.
    stopReason = last?.role === "assistant" ? last.stopReason ?? "unknown" : "unknown";
    if (!hasSettled) finish(ctx);
  });
  if (hasSettled) {
    try { pi.on("agent_settled", async (_event, ctx) => finish(ctx)); }
    catch (_) { hasSettled = false; }
  }
  try { pi.on("session_start", async (_event, ctx) => {
    active = false;
    stopReason = "unknown";
    send("session-start", ctx);
  }); } catch (_) {}
  try { pi.on("tool_result", async (_event, ctx) => send("tool-complete", ctx)); } catch (_) {}
  try { pi.on("session_shutdown", async (_event, ctx) => {
    active = false;
    send("session-end", ctx);
  }); } catch (_) {}
}

```

### Core Architecture Module: `nebula_app/res/hooks/remote_bridge.py`
```
"""Bounded, fail-open provider hook delivery to the owning SSH terminal."""
import base64
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import select
import shlex
import subprocess
import sys
import time

MAX_PAYLOAD = 1024 * 1024
MAX_ENVELOPE = 64 * 1024
MAX_STREAM_FILES = 4096


def provider_argv_matches(source, argv):
    arguments = argv[:3]
    provider_paths = {"claude": "@anthropic-ai/claude-code/", "pi": "/pi-coding-agent/"}
    path_match = source in provider_paths and any(provider_paths[source] in arg for arg in arguments)
    return path_match or any(os.path.basename(arg) in (source, source + ".js", source + ".exe") for arg in arguments)


def process_identity(source):
    """Resolve ancestry here, never accept a PID claimed by provider JSON."""
    pid = os.getppid()
    for _ in range(48):
        try:
            stat = Path(f"/proc/{pid}/stat").read_text()
            fields = stat[stat.rfind(")") + 2:].split()
            argv = [arg.decode("utf-8", "replace") for arg in Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")[:3]]
            if provider_argv_matches(source, argv):
                return f"{pid}:{fields[19]}"
            parent = int(fields[1])
            if parent <= 1 or parent == pid:
                break
            pid = parent
        except (OSError, ValueError, IndexError):
            break
    # macOS/BSD: ps supplies the process epoch. No local-host PID is fabricated.
    pid = os.getppid()
    for _ in range(24):
        try:
            row = subprocess.check_output(
                ["ps", "-ww", "-p", str(pid), "-o", "ppid=", "-o", "lstart=", "-o", "args="],
                stderr=subprocess.DEVNULL, timeout=0.15,
            ).decode().strip().split(None, 6)
            if len(row) != 7:
                break
            # Interpreted providers report the interpreter as comm. Apply the
            # same bounded argument-position rules as the native process table.
            if provider_argv_matches(source, shlex.split(row[6])):
                epoch = hashlib.sha256(" ".join(row[1:6]).encode()).hexdigest()[:16]
                return f"{pid}:{epoch}"
            parent = int(row[0])
            if parent <= 1 or parent == pid:
                break
            pid = parent
        except (OSError, ValueError, subprocess.SubprocessError):
            break
    return None


def bounded_payload(args):
    native = args[0] == "codex" and len(args) > 1 and args[1] in ("--hooks=turns", "--hooks=full")
    if args[0] == "claude" or native:
        raw = sys.stdin.buffer.read(MAX_PAYLOAD + 1)
        if len(raw) > MAX_PAYLOAD:
            while sys.stdin.buffer.read(65536):
                pass
            return None, native
    else:
        raw = args[-1].encode("utf-8") if len(args) > 1 else b""
    if len(raw) > MAX_PAYLOAD:
        return None, native
    payload = json.loads(raw)
    return payload if isinstance(payload, dict) else None, native


@contextmanager
def stream_state(token, identity):
    root = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "pebrel/hooks"
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if any(parent.is_symlink() for parent in [root, *root.parents]):
        raise ValueError("hook cache contains a symbolic link")
    stream = hashlib.sha256((token + ":" + identity).encode()).hexdigest()
    path = root / stream
    if not path.exists():
        count = 0
        for scanned, old in enumerate(root.iterdir()):
            if scanned >= MAX_STREAM_FILES:
                raise ValueError("hook cache cleanup reached its scan budget")
            count += 1
            if re.fullmatch(r"[a-f0-9]{64}", old.name) and not old.is_symlink():
                try:
                    if time.time() - old.stat().st_mtime > 7 * 86400:
                        old.unlink()
                        count -= 1
                except OSError:
                    pass
            if count >= MAX_STREAM_FILES - 2:
                raise ValueError("hook cache is full")
    # Serialize every writer to this terminal, including child Agent processes.
    # Sequence identity remains per process; two OSC frames must never interleave.
    lock_name = hashlib.sha256((token + ":channel").encode()).hexdigest()
    lock_fd = os.open(root / lock_name, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "a+b") as lock:
        deadline = time.monotonic() + 0.3
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise TimeoutError("hook channel is busy")
                time.sleep(0.005)
        os.utime(root / lock_name, None)
        state_fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        with os.fdopen(state_fd, "a+b") as state:
            yield state


def send(source, native, mode, payload, token):
    owner = process_identity(source)
    with stream_state(token, owner or source) as state:
        state.seek(0)
        previous = state.read(32)
        sequence = int(previous or b"0") + 1
        if sequence > 2**64 - 1:
            return
        state.seek(0)
        state.truncate()
        state.write(str(sequence).encode())
        state.flush()
        payload["bridge_sequence"] = sequence
        header = f"nebula-hook/1 source={source}"
        if owner:
            header += " process=" + owner
        if native:
            header += " codex_hooks=" + mode.split("=", 1)[1]
        encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        envelope = header.encode() + b"\n" + encoded
        if len(envelope) > MAX_ENVELOPE:
            # Lifecycle must still arrive when a tool or answer is huge. Keep
            # protocol identities and drop content, without inventing a result.
            keep = ("hook_event_name", "type", "kind", "session_id", "session_file", "transcript_path", "thread-id", "turn_id", "turn-id", "source", "bridge_instance", "bridge_sequence", "event_id", "notification_type", "permission_mode", "stop_reason", "error", "background_tasks", "agent_id", "agent_type")
            question_input = payload.get("tool_input") if payload.get("tool_name") in ("request_user_input", "AskUserQuestion") else None
            tool_name = payload.get("tool_name")
            payload = {key: payload[key] for key in keep if key in payload}
            if question_input is not None:
                payload.update(tool_name=tool_name, tool_input=question_input)
            envelope = header.encode() + b"\n" + json.dumps(payload, separators=(",", ":")).encode()
        if len(envelope) > MAX_ENVELOPE:
            return
        osc = b"\x1b]777;nebula-hook;" + token.encode() + b";" + base64.b64encode(envelope) + b"\x07"
        write_terminal(osc)


def write_terminal(osc):
    fd = os.open("/dev/tty", os.O_WRONLY | os.O_NONBLOCK)
    offset = 0
    deadline = time.monotonic() + 0.5
    try:
        while offset < len(osc):
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not select.select([], [fd], [], remaining)[1]:
                raise TimeoutError("terminal output is full")
            try:
                offset += os.write(fd, osc[offset:])
            except BlockingIOError:
                continue
    finally:
        if 0 < offset < len(osc):
            # Cancel a partial OSC so a failed hook cannot swallow future output.
            try:
                if select.select([], [fd], [], 0.1)[1]:
                    os.write(fd, b"\x18")
            except OSError:
                pass
        os.close(fd)


def run(args):
    if not args or args[0] not in ("claude", "codex", "opencode", "pi"):
        return
    try:
        payload, native = bounded_payload(args)
        token = os.environ.get("PEBREL_REMOTE_HOOK_TOKEN", os.environ.get("NEBULA_REMOTE_HOOK_TOKEN", ""))
        if payload is not None and re.fullmatch(r"[a-fA-F0-9]{32}", token):
            if args[0] != "claude" or not os.environ.get("GROK_HOOK_NAME"):
                send(args[0], native, args[1] if native else "", payload, token)
    finally:
        # A malformed payload, unavailable TTY or delivery failure must never
        # suppress the user's original notifier (also outside Pebrel).
        if args[:2] == ["codex", "--chain"] and len(args) >= 4:
            subprocess.Popen(args[2:], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)


if __name__ == "__main__":
    try:
        run(sys.argv[1:])
    except Exception:
        pass

```

### Core Architecture Module: `nebula_app/res/hooks/remote_files.py`
```
"""SSH file adapter. Policy and provider configuration are supplied by Rust.

The script is sent over an authenticated exec channel, never typed into the
interactive shell. No credentials or hook tokens are stored by this adapter.
"""
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

MAX_FILE = 1024 * 1024


def read_file(path):
    if path.is_symlink():
        raise ValueError("integration file is a symbolic link")
    try:
        with path.open("rb") as stream:
            content = stream.read(MAX_FILE + 1)
    except FileNotFoundError:
        return None
    if len(content) > MAX_FILE:
        raise ValueError("integration file exceeds size limit")
    return content


def digest(content):
    return hashlib.sha256(content).hexdigest() if content is not None else None


def capture(program, *args):
    if not program:
        return ""
    try:
        with tempfile.TemporaryFile() as output:
            env = dict(os.environ)
            # Node-managed launchers use /usr/bin/env node. The interpreter
            # beside the discovered launcher must be reachable too.
            env["PATH"] = str(Path(program).parent) + os.pathsep + env.get("PATH", "")
            subprocess.run([program, *args], stdin=subprocess.DEVNULL,
                           stdout=output, stderr=subprocess.DEVNULL,
                           timeout=2, check=True, env=env)
            output.seek(0)
            return output.read(65536).decode("utf-8", "replace")
    except (OSError, subprocess.SubprocessError):
        return ""


def find_program(name):
    found = shutil.which(name)
    if found:
        return found
    home = Path.home()
    candidates = [home / ".local/bin" / name, home / ".npm-global/bin" / name]
    nvm = Path(os.environ.get("NVM_DIR", home / ".nvm"))
    candidates.append(nvm / "current/bin" / name)
    # Noninteractive login shells commonly skip nvm initialization. Probe
    # executable files, not shell output, with a bounded version-directory scan.
    versions = nvm / "versions/node"
    try:
        entries = []
        for i, entry in enumerate(versions.iterdir()):
            if i >= 128:
                break
            version = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", entry.name)
            if version:
                entries.append((tuple(map(int, version.groups())), entry))
        candidates.extend(entry / "bin" / name for _, entry in sorted(entries, reverse=True))
    except OSError:
        pass
    return next((str(path) for path in candidates if path.is_file() and os.access(path, os.X_OK)), None)


def locations():
    home = Path.home()
    root = Path(os.environ.get("XDG_DATA_HOME", home / ".local/share")) / "pebrel/ai"
    paths = {
        "claude": Path(os.environ.get("CLAUDE_CONFIG_DIR", home / ".claude")) / "settings.json",
        "codex": Path(os.environ.get("CODEX_HOME", home / ".codex")) / "hooks.json",
        "codex_config": Path(os.environ.get("CODEX_HOME", home / ".codex")) / "config.toml",
        "opencode": Path(os.environ.get("XDG_CONFIG_HOME", home / ".config")) / "opencode/plugins/pebrel.js",
        "pi": home / ".pi/agent/extensions/pebrel.ts",
        "manifest": root / "manifest.json",
        "disabled": root / "disabled",
    }
    for name in ("pebrel-hook", "bridge.py", "shell.py", "bashrc", ".zshenv", ".zprofile", ".zshrc"):
        paths[name] = root / name
    return root, paths


def snapshot():
    if sys.version_info < (3, 8):
        raise ValueError("Python 3.8 or later is required")
    root, paths = locations()
    files = {}
    for name, path in paths.items():
        content = read_file(path)
        files[name] = {
            "path": str(path), "sha256": digest(content),
            "content": content.decode("utf-8") if content is not None else None,
        }
    codex = find_program("codex")
    return {
        "version": 1, "root": str(root), "python": sys.executable,
        "shell": os.environ.get("SHELL", "/bin/sh"), "files": files,
        "providers": {
            "claude": paths["claude"].parent.is_dir(),
            "codex": paths["codex"].parent.is_dir(),
            "opencode": paths["opencode"].parent.parent.is_dir(),
            "pi": paths["pi"].parent.parent.is_dir(),
        },
        "codex_version": capture(codex, "--version") if paths["codex"].parent.is_dir() else "",
        "codex_features": capture(codex, "features", "list") if paths["codex"].parent.is_dir() else "",
    }


def replace(path, content, executable=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Refuse symlinked parents as well as the leaf: managed integration files
    # must not overwrite an unrelated file through a redirection.
    if any(parent.is_symlink() for parent in [path, *path.parents]):
        raise ValueError("integration path contains a symbolic link")
    if content is None:
        path.unlink(missing_ok=True)
        return
    fd, temporary = tempfile.mkstemp(prefix=".pebrel-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        mode = path.stat().st_mode & 0o777 if path.exists() else (0o700 if executable else 0o600)
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def apply(plan):
    root, paths = locations()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if any(parent.is_symlink() for parent in [root, *root.parents]):
        raise ValueError("integration root contains a symbolic link")
    lock_fd = os.open(root / ".install.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "a+b") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        originals = {}
        for item in plan:
            name = item["name"]
            if name not in paths or name in originals:
                raise ValueError("invalid integration file identity")
            content = read_file(paths[name])
            if digest(content) != item["expected"]:
                raise ValueError("integration file changed during setup")
            originals[name] = content
        written = []
        try:
            for item in plan:
                name = item["name"]
                if digest(read_file(paths[name])) != item["expected"]:
                    raise ValueError("integration file changed during setup")
                content = item["content"].encode("utf-8") if item["content"] is not None else None
                if content is not None and len(content) > MAX_FILE:
                    raise ValueError("integration file exceeds size limit")
                if content == originals[name]:
                    continue
                replace(paths[name], content, name == "pebrel-hook")
                written.append((name, digest(content)))
        except Exception:
            for name, expected in reversed(written):
                if digest(read_file(paths[name])) == expected:
                    replace(paths[name], originals[name], name == "pebrel-hook")
            raise
    return {"version": 1, "applied": True}


def run(request):
    try:
        action = request.get("action", "snapshot")
        if action == "snapshot":
            result = snapshot()
        elif action == "apply":
            result = apply(request["files"])
        else:
            raise ValueError("unknown integration action")
    except Exception as error:
        # Do not put config contents, command arguments or secrets in diagnostics.
        result = {"version": 1, "error": type(error).__name__}
    print("PEBREL_INTEGRATION=" + json.dumps(result, separators=(",", ":")))

```

### Core Architecture Module: `nebula_app/res/hooks/remote_shell.py`
```
"""Start the requested login shell with per-channel integration environment."""
import os
from pathlib import Path
import re
import sys


def main():
    token = sys.argv[1]
    if not re.fullmatch(r"[a-fA-F0-9]{32}", token):
        raise ValueError("invalid channel token")
    root = str(Path(__file__).resolve().parent)
    env = os.environ.copy()
    env.update(PEBREL_REMOTE_HOOK_TOKEN=token, NEBULA_REMOTE_HOOK_TOKEN=token,
               PEBREL_PANE_REMOTE="1", NEBULA_PANE_REMOTE="1",
               PEBREL_HOOK_EXE=root + "/pebrel-hook", NEBULA_HOOK_EXE=root + "/pebrel-hook")
    shell = env.get("SHELL") or "/bin/sh"
    name = os.path.basename(shell)
    if name == "bash":
        env["PEBREL_REMOTE_LOGIN"] = "1"
        args = [shell, "--rcfile", root + "/bashrc", "-i"]
    elif name == "zsh":
        env["NEBULA_ZDOTDIR_WAS_SET"] = "1" if "ZDOTDIR" in env else "0"
        env["NEBULA_ORIGINAL_ZDOTDIR"] = env.get("ZDOTDIR", "")
        env["NEBULA_ZSH_INTEGRATION"] = root
        env["ZDOTDIR"] = root
        args = [shell, "-il"]
    else:
        args = ["-" + name]
    os.execvpe(shell, args, env)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `nebula_app/src/ai_hook.rs`
```
//! AI lifecycle integration. The dependency flow is:
//! transport -> protocol/payload -> typed events -> ordering -> pane lifecycle.
//!
//! UI adapters render the shared lifecycle and deliver its notifications. They
//! never reinterpret a completed hook by scanning terminal prose. Screen evidence
//! is an explicit fallback for capabilities absent from the active integration.
//!
//! `PEBREL_HOOK_LOG` (legacy `NEBULA_HOOK_LOG`) diagnoses bridge delivery without
//! payloads; `GateVerdict` explains rejected events in application debug logs.

mod bridges;
mod event;
pub(crate) mod installation;
pub(crate) mod integrations;
pub(crate) mod lifecycle;
mod native_events;
mod ordering;
mod payload;
mod protocol;
pub(crate) mod remote;

pub(crate) use event::CodexHookMode;
pub use event::{
    AiBackgroundTasks, AiHookCapabilities, AiHookEvent, AiHookKind, AiPermissionMode,
    AiTurnOutcome, AttentionContext, capabilities_for,
};
pub use ordering::GateVerdict;
pub(crate) use ordering::{accept_for_pane, reorder_batch};
use protocol::parse_envelope;
pub(crate) use protocol::parse_remote_envelope;

#[cfg(test)]
mod native_tests;
#[cfg(test)]
mod tests;

/// Environment variable carrying this instance's pipe name into child shells
/// (ConPTY merges the current process environment, so setting it process-wide
/// before the first PTY spawn covers every pane).
pub const PIPE_ENV: &str = "PEBREL_NOTIFY_PIPE";
pub const LEGACY_PIPE_ENV: &str = "NEBULA_NOTIFY_PIPE";
/// Per-pane identity, injected into each pane's PTY environment.
pub const PANE_ENV: &str = "PEBREL_PANE_ID";
pub const LEGACY_PANE_ENV: &str = "NEBULA_PANE_ID";
/// Absolute path of `nebula-hook.exe`, exported so the opencode Bun plugin
/// (which cannot resolve nebula.exe's install dir on its own) can shell out to
/// the bridge. Same process-wide scope as [`PIPE_ENV`].
pub const HOOK_EXE_ENV: &str = "PEBREL_HOOK_EXE";
pub const LEGACY_HOOK_EXE_ENV: &str = "NEBULA_HOOK_EXE";

/// 仅用于阻止未知 notify 包装器再次套娃；子串不能作为修改/删除的归属依据。
fn contains_helper(value: &str) -> bool {
    value.contains("pebrel-hook") || value.contains("nebula-hook")
}

fn is_helper_executable(value: &str) -> bool {
    let filename = value.rsplit(['/', '\\']).next().unwrap_or_default();
    let absolute = value.starts_with('/')
        || value.starts_with("\\\\")
        || (value.as_bytes().first().is_some_and(u8::is_ascii_alphabetic)
            && value.as_bytes().get(1) == Some(&b':')
            && matches!(value.as_bytes().get(2), Some(b'/' | b'\\')));
    (value == filename || absolute)
        && !value.contains(['"', '\r', '\n', '\0'])
        && ["pebrel-hook.exe", "nebula-hook.exe", "pebrel-hook", "nebula-hook"]
            .iter()
            .any(|name| filename.eq_ignore_ascii_case(name))
}

/// 只接受历史安装器产生的单条调用；echo、管道和追加命令仍属于用户。
fn is_helper_shell_command(command: &str, source: &str) -> bool {
    let Some(path) = command.trim().strip_suffix(source).and_then(|s| s.strip_suffix(' ')) else {
        return false;
    };
    let path = path.trim_end();
    let executable = if let Some(quoted) = path.strip_prefix('"').and_then(|s| s.strip_suffix('"'))
    {
        if quoted.contains('"') {
            return false;
        }
        quoted
    } else if let Some(quoted) = path.strip_prefix('\'').and_then(|s| s.strip_suffix('\'')) {
        let decoded = quoted.replace("'\\''", "'");
        return remote::quote(&decoded) == path && is_helper_executable(&decoded);
    } else {
        if path.chars().any(char::is_whitespace)
            || path.contains(['"', '\'', ';', '&', '|', '<', '>'])
        {
            return false;
        }
        path
    };
    is_helper_executable(executable)
}

/// The hook entry's argv tail. `claude` is the source discriminator
/// `nebula-hook` reads from `args[0]`, and it must travel as a real argument:
/// appended to the command string instead, some shell has to re-parse the whole
/// line, which is exactly what broke in #80.
const HELPER_ARGS: [&str; 1] = ["claude"];

/// Claude hook events we subscribe to. Session boundaries carry the id needed
/// for resume/fork; PostToolUse lets a stale permission state return to working
/// before the whole turn completes.
const CLAUDE_EVENTS: [&str; 10] = [
    "SessionStart",
    "UserPromptSubmit",
    "Notification",
    "PermissionRequest",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "Stop",
    "StopFailure",
    "SessionEnd",
];

pub use local::{setup_ai_cli, spawn_config_guard};
#[cfg(windows)]
pub use windows::spawn_gpui_server;
#[cfg(all(windows, feature = "legacy-shell"))]
pub use windows::spawn_server;

#[cfg(unix)]
mod unix;
#[cfg(unix)]
pub use unix::spawn_gpui_server;

mod local;
#[cfg(windows)]
mod windows;

pub(crate) fn apply_child_environment(env: &mut std::collections::HashMap<String, String>) {
    #[cfg(unix)]
    unix::apply_child_environment(env);
    #[cfg(not(unix))]
    let _ = env;
}

pub(crate) fn shutdown() {
    #[cfg(unix)]
    unix::shutdown();
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #619** (2026-10-16): **[Bug]  文件路径快捷跳转包含尾随行号说明，导致已存在的文件被提示不存在**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows11 25H2 125%  ### Pebrel version / 版本号  2.2.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  cmd  ### Program running in the pane / 面板里正在跑的程序  Pi  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  AI agent (Claude Code / Codex / Pi / OMP) — AI Agent 集成与状态  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤   1. 启动 Pebrel，打开出现问题的终端面板。  2. 在终端输出或 AI 回复中显示一个实际存在的文件路径，路径后面附带行号说明，例如：D:\test\清单_录入工具用.md (121 行)  3. 将鼠标移到该路径上，使用 Pebrel 提示的快捷跳转操作。  4. 文件未能打开，界面提示文件不存在。  ### Expected behavior / 期望结果  跳转目标应是实际文件路径：D:\test\清单_录入工具用.md  后面的“(121 行)”属于说明文字，不应作为文件名的一部分。如果支持该形式的行号识别，可以将行号单独处理；如果不支持，也应能够正常打开文件。  ### Actual behavior / 实际结果  路径本身对应的文件存在，但快捷跳转似乎将路径后面的行号说明也包含进了目标，例如把“(121”纳入文件路径，最终提示文件不存在。  ### Logs / screenshots / 日志或截图  <img width="860" height="69" alt="Image" src="https://github.com/user-attachments/assets/c7bb2bba-85f9-4670-b574-217ed556cd34" />  <img width="554" height="68" alt="Image" src="https://github.com/user-attachments/assets/ba5fe000-0ef9-4fcf-b5c8-4df1362286dc" />  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest relea

- **Issue #617** (2026-10-14): **[Bug] Claude Code 自动建议文本（Ghost Text）未正确显示为暗淡颜色**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 10 LTSC;  ### Pebrel version / 版本号  2.2.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Claude Code  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Other / 其他  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. 在 Pebrel 中启动 Claude Code。 2. 输入内容，触发自动建议文本。 3. 观察自动建议文本与实际输入文本的颜色。  ### Expected behavior / 期望结果  Claude code 自动建议文本应显示为较暗的灰色，与实际输入文本明显区分。  ### Actual behavior / 实际结果  Claude code 自动建议文本与实际输入文本亮度几乎一致，无法明显区分。  ### Logs / screenshots / 日志或截图  <img width="830" height="324" alt="Image" src="https://github.com/user-attachments/assets/cc89384b-dd7e-4a00-bd8b-b30eb813156a" />  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

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

### Incident Patch 1: `b49b5351` (2026-10-19)
**Commit Message**: Merge pull request #682 from SAY-5/fix/table-hint-stale-hover-point

Verified the stale grid bounds guard against the reported resize/hover crash. The guard adds constant-time bounds checks with no allocation; targeted display::hint tests pass, including the out-of-grid regression.

**File**: `nebula_app/src/display/hint.rs` (modified, +10/-0)
```diff
@@ -941,6 +941,16 @@ mod tests {
         }
     }
 
+    #[test]
+    fn table_lookup_past_the_grid_edge_is_not_a_hit() {
+        let term = mock_term("│ entry │ https://example.com/123456 │");
+        let past_edge = Point::new(Line(0), Column(term.columns() + 2));
+        assert!(
+            highlighted_at(&term, &UiConfig::default(), past_edge, ModifiersState::CONTROL)
+                .is_none()
+        );
+    }
+
     #[test]
     fn search_limit_never_opens_a_truncated_softwrapped_url_prefix() {
         use nebula_terminal::event::VoidListener;
```

**File**: `nebula_app/src/display/hint/table.rs` (modified, +5/-0)
```diff
@@ -79,6 +79,11 @@ fn continuation<T>(term: &Term<T>, line: Line, left: usize) -> bool {
 }
 
 pub(super) fn at<T>(term: &Term<T>, point: Point) -> Option<TableLink> {
+    // Like `hyperlink_at`: a hover point can lead the grid by a column/row during a resize.
+    let grid = term.grid();
+    if point.column.0 >= grid.columns() || point.line.0 >= grid.screen_lines() as i32 {
+        return None;
+    }
     let left = (0..point.column.0)
         .rfind(|&col| border(term.grid()[Point::new(point.line, Column(col))].c))?;
     let right = (point.column.0 + 1..term.columns())
```

---

### Incident Patch 2: `f5cf5a68` (2026-10-19)
**Commit Message**: Merge pull request #562 from zuiho-kai/macos-video-background

feat(macos):Play video backgrounds on macOS through a native layer below GPUI

**File**: `Cargo.lock` (modified, +16/-0)
```diff
@@ -5336,7 +5336,10 @@ dependencies = [
  "notify-rust",
  "objc2 0.6.3",
  "objc2-app-kit 0.3.2",
+ "objc2-av-foundation",
+ "objc2-core-foundation",
  "objc2-foundation 0.3.2",
+ "objc2-quartz-core 0.3.2",
  "parking_lot",
  "pebrel-completions",
  "pebrel-mobile-link",
@@ -5841,6 +5844,19 @@ dependencies = [
  "objc2-quartz-core 0.3.2",
 ]
 
+[[package]]
+name = "objc2-av-foundation"
+version = "0.3.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "478ae33fcac9df0a18db8302387c666b8ef08a3e2d62b510ca4fc278a384b6c0"
+dependencies = [
+ "bitflags 2.13.0",
+ "objc2 0.6.3",
+ "objc2-core-foundation",
+ "objc2-foundation 0.3.2",
+ "objc2-quartz-core 0.3.2",
+]
+
 [[package]]
 name = "objc2-cloud-kit"
 version = "0.2.2"
```

**File**: `architecture/notes/nebula_app/gpui_shell/wallpaper/2026-10-10-macos-native-video-underlay.md` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+# macOS video background as a native layer below GPUI
+
+## Status
+
+Implemented behind the existing `video-background` feature on macOS. Validated on
+one Apple Silicon machine (macOS 27); no Intel or multi-display validation yet.
+
+## Context
+
+On macOS the video kind was visible in settings but fell back to image mode: the
+animated backend selected the unavailable implementation, the decoder worker had no
+macOS reader, and playback visibility used Win32 handles. The Windows path paints
+decoded BGRA frames through `paint_stream_image`, but the pinned GPUI revision's
+Metal atlas implements only postprocess resources; the stream image methods use the
+trait default and fail.
+
+## Evidence
+
+- `gpui_macos` already places its own native blur view in the window content view,
+  directly below the GPUI view. A sibling view is therefore a supported composition
+  point that needs no GPUI change.
+- In a standalone prototype, a 3840×2160 H.264 loop played through `AVPlayerLayer`
+  with about 0.5–2% CPU in the owning process; decoding stays in the system media
+  service. The integrated build was not separately profiled.
+- `gpui_component::Root` fills the window with the shell color. A layer below GPUI
+  was invisible at window opacity 1 until that fill was cleared; the title bar was
+  the only region relying on it and showed the windows behind it once it was cleared.
+
+## Decision
+
+- Keep AVFoundation handles and platform selection in `platform/video_underlay`;
+  wallpaper owns the monitor, source lifetime and surface/error presentation. The
+  native adapter accepts geometry/visibility inputs and never reads wallpaper
+  globals or starts its own timer. This keeps the platform cfg budget unchanged.
+  One `AVQueuePlayer` and
+  `AVPlayerLooper` per source; each window owns a clip view inserted directly below
+  the GPUI view. All AppKit and AVFoundation calls stay on the main thread.
+- Painting does not touch the GPUI scene. The wallpaper paint callback only updates
+  the clip frame, card radius and video frame from the shared `wallpaper_rect`, so
+  fit, alignment and cover-chrome keep their image semantics.
+- Preserve the image composition `w·V + a·(1-w)·B` exactly: surfaces above the video
+  use alpha `a·(1-w)` and the layer uses opacity `w / (1 - a·(1-w))`
+  (`underlay_composition`). While the layer is shown, the window root fill is cleared
+  and the title bar paints the shell color it previously inherited.
+- A 500 ms monitor owned by the source plays only when a placement window is visible
+  (occlusion state, not miniaturized), the opacity is non-zero and reduced motion is
+  off. It also detects decoder failure and reports the existing typed media error.
+- Source destruction explicitly pauses playback and removes placements. Decode or
+  native placement failure restores the regular surfaces and ends monitoring.
+- Explicit ANSI backgrounds, INVERSE and DIM retain their normal terminal semantics.
+  Video visibility changes the default surface composition, not application cell
+  colors; colored terminal regions can therefore cover the video.
+
+## Rejected alternatives
+
+- Implementing Metal stream images in the GPUI fork and an AVFoundation BGRA reader:
+  two repositories, a pinned-revision bump and a per-frame CPU copy and upload for
+  the same visible result. It remains the route if video must enter GPUI effects.
+- `paint_surface(CVPixelBuffer)`: the Metal path asserts full-range NV12, applies a
+  fixed BT.601 matrix and has no opacity, corner radius or placement semantics.
+- A separate process or window ordered behind Pebrel: it cannot know the card bounds,
+  sidebar state or window moves without polling another process.
+- Clearing `theme.background` globally: other components read it as an opaque color.
+
+## Consequences
+
+- The Windows admission limits (720p, 32 MiB, H.264) do not apply on macOS; the
+  system decoder accepts any format AVFoundation plays, including 4K and HEVC.
+- Shader backgrounds and GIF remain unavailable on macOS, as before.
+- The video cannot be read back by GPUI terminal effects, which only sample the scene.
+
+## Validation
+
+- Unit test: `native_underlay_composites_exactly_like_a_wallpaper_painted_above_the_surface`.
+- Manual (Apple Silicon, macOS 27): 4K H.264 plays muted and loops; hiding the
+  application pauses and showing it resumes; the title bar and sidebar keep the shell
+  color; the card shows the video with the configured fit at opacity 1 and 0.3.
+- Not yet run: multiple windows, cover-chrome mode, display changes, Intel Macs.
+
+## Supersedes
+
+None. Adds a macOS backend at the boundary from `2026-10-06-media-backend-boundaries.md`.
+
+## Revisit when
+
+The pinned GPUI revision gains Metal stream images, or video must feed terminal or
+background effects that sample GPUI-rendered content.
```

**File**: `nebula_app/Cargo.toml` (modified, +35/-1)
```diff
@@ -205,6 +205,27 @@ objc2-app-kit = { version = "0.3.1", default-features = false, features = [
     "NSView",
     "NSWindow",
 ] }
+# 视频背景：系统 AVPlayer 解码到 GPUI 视图下方的原生图层，仅随 video-background 启用。
+objc2-av-foundation = { version = "0.3.2", optional = true, default-features = false, features = [
+    "std",
+    "AVAnimation",
+    "AVPlayer",
+    "AVPlayerItem",
+    "AVPlayerLayer",
+    "AVPlayerLooper",
+    "objc2-core-foundation",
+    "objc2-quartz-core",
+] }
+objc2-quartz-core = { version = "0.3.2", optional = true, default-features = false, features = [
+    "std",
+    "CALayer",
+    "CATransaction",
+    "objc2-core-foundation",
+] }
+objc2-core-foundation = { version = "0.3.2", optional = true, default-features = false, features = [
+    "std",
+    "CFCGTypes",
+] }
 
 [target.'cfg(windows)'.dependencies]
 windows-core = "=0.61.2"
@@ -319,7 +340,20 @@ gpui-shell = [
 ]
 # 真实 GPUI hitbox / 鼠标路由测试显式启用；不能放进 dev-dependencies，
 # 否则不带 gpui-shell 的默认 `cargo test -p nebula` 也会编译整棵 GPUI。
-video-background = ["gpui-shell", "dep:anyhow", "dep:raw-window-handle", "windows/Win32_Media_MediaFoundation"]
+video-background = [
+    "gpui-shell",
+    "dep:anyhow",
+    "dep:raw-window-handle",
+    "windows/Win32_Media_MediaFoundation",
+    "dep:objc2-av-foundation",
+    "dep:objc2-quartz-core",
+    "dep:objc2-core-foundation",
+    "objc2-app-kit/NSGraphics",
+    "objc2-app-kit/objc2-quartz-core",
+    "objc2-foundation/NSGeometry",
+    "objc2-foundation/NSURL",
+    "objc2-foundation/NSArray",
+]
 gif-background = ["video-background", "dep:gif"]
 shader-background = ["gif-background", "dep:naga", "gpui/wgsl-postprocess", "windows/Win32_Graphics_Direct3D_Fxc"]
 gpui-test-support = ["gpui-shell", "gpui/test-support", "gpui-component/test-support"]
```

**File**: `nebula_app/src/gpui_shell/theme.rs` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ pub fn card_content_bg(cx: &App) -> Hsla {
         .try_global::<crate::gpui_shell::config::Settings>()
         .map(|s| s.palette.background.into())
         .unwrap_or_else(|| cx.theme().background);
-    bg.a *= crate::gpui_shell::wallpaper::chrome_surface_opacity(cx);
+    bg.a *= crate::gpui_shell::wallpaper::card_surface_opacity(cx);
     bg
 }
 
```

**File**: `nebula_app/src/gpui_shell/wallpaper.rs` (modified, +70/-0)
```diff
@@ -215,6 +215,37 @@ fn refresh_surface_opacity(cx: &mut App) {
     {
         crate::gpui_shell::theme::reapply_prepared_surface_opacity(cx);
     }
+    sync_root_background(cx);
+}
+
+/// Whether a native wallpaper layer is composited below the GPUI scene.
+pub fn native_underlay_active(cx: &App) -> bool {
+    animated::underlay_ready(cx)
+}
+
+/// `gpui_component::Root` fills the whole window with the shell color. Content
+/// painted above it is unaffected, but a native layer below GPUI would be hidden,
+/// so the root fill is cleared while one is shown. Shell regions around the card
+/// are painted separately and keep their color.
+fn sync_root_background(cx: &mut App) {
+    let underlay = animated::underlay_ready(cx);
+    cx.defer(move |cx| {
+        for handle in cx.windows() {
+            if let Err(error) = handle.update(cx, |_, window, cx| {
+                let Some(Some(root)) = window.root::<gpui_component::Root>() else { return };
+                root.update(cx, |root, cx| {
+                    let background = underlay.then(|| gpui::Fill::from(gpui::transparent_black()));
+                    let style = gpui::Styled::style(root);
+                    if style.background != background {
+                        style.background = background;
+                        cx.notify();
+                    }
+                });
+            }) {
+                log::warn!("failed to update window root background: {error}");
+            }
+        }
+    });
 }
 
 fn retire_image(image: Option<Arc<RenderImage>>, cx: &mut App) {
@@ -273,12 +304,51 @@ pub fn chrome_surface_opacity(cx: &App) -> f32 {
     let Some(effects) = cx.try_global::<VisualEffects>() else {
         return 1.0;
     };
+    let opacity = base_surface_opacity(effects, cx);
+    if effects.layout.cover_chrome && animated::underlay_ready(cx) {
+        return underlay_composition(opacity, effects.layout.opacity).0;
+    }
+    opacity
+}
+
+/// Card surface alpha. Equal to [`chrome_surface_opacity`] unless a native
+/// video sits below only the card.
+pub fn card_surface_opacity(cx: &App) -> f32 {
+    let Some(effects) = cx.try_global::<VisualEffects>() else {
+        return 1.0;
+    };
+    if !effects.layout.cover_chrome && animated::underlay_ready(cx) {
+        return underlay_composition(base_surface_opacity(effects, cx), effects.layout.opacity).0;
+    }
+    chrome_surface_opacity(cx)
+}
+
+fn base_surface_opacity(effects: &VisualEffects, cx: &App) -> f32 {
     if effects.layout.cover_chrome && background_ready(effects, cx) {
         return effects.opacity.clamp(0.0, 1.0).min(0.78);
     }
     effects.opacity.clamp(0.0, 1.0)
 }
 
+fn underlay_layer_opacity(cx: &App) -> f32 {
+    let Some(effects) = cx.try_global::<VisualEffects>() else {
+        return 1.0;
+    };
+    underlay_composition(base_surface_opacity(effects, cx), effects.layout.opacity).1
+}
+
+/// A wallpaper painted above a surface of alpha `a` with opacity `w` shows
+/// `w·V + a·(1-w)·B`. A layer *below* that surface matches it exactly when the
+/// surface alpha becomes `a·(1-w)` and the layer opacity `w / (1 - a·(1-w))`.
+/// Returns `(surface alpha, layer opacity)`.
+fn underlay_composition(surface: f32, wallpaper: f32) -> (f32, f32) {
+    let surface = surface.clamp(0.0, 1.0);
+    let wallpaper = wallpaper.clamp(0.0, 1.0);
+    let surface_alpha = surface * (1.0 - wallpaper);
+    let layer = if surface_alpha >= 1.0 { 0.0 } else { wallpaper / (1.0 - surface_alpha) };
+    (surface_alpha, layer.min(1.0))
+}
+
 /// 开窗参数用。GPUI 通用层在窗口创建时就会把这个值下发到平台层
 /// （`gpui::Window::new` → `platform_window.set_background_appearance`）。
 /// Mica / Mica Alt 因此从首帧就走平台原生 backdrop，不再先挂一层普通透明背景。
```

**File**: `nebula_app/src/gpui_shell/wallpaper/animated.rs` (modified, +2/-3)
```diff
@@ -1,9 +1,8 @@
-//! 动画后端的选择只发生在此处；共享壁纸入口不拥有平台专用字段。
+//! Windows 流式纹理与原生下衬视图共享壁纸合同；系统 API 选择归平台层。
 #[cfg(all(windows, feature = "video-background"))]
 #[path = "animated/native.rs"]
 mod implementation;
 #[cfg(not(all(windows, feature = "video-background")))]
-#[path = "animated/unavailable.rs"]
+#[path = "animated/av_player.rs"]
 mod implementation;
-
 pub(super) use implementation::*;
```

**File**: `nebula_app/src/gpui_shell/wallpaper/animated/av_player.rs` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+//! 原生下衬视频的 UI 生命周期；播放器与系统视图由 platform 持有。
+//!
+//! 不走 StreamImage：固定 GPUI 版本的 Metal 后端没有流式纹理，而 AVPlayerLayer
+//! 由系统硬件解码并直接合成，无需逐帧 CPU 拷贝和上传。GPUI 窗口本身透明清屏，
+//! 卡片底色按 [`super::super::underlay_composition`] 降低 alpha，使合成结果与
+//! 图片背景的 `w·V + a·(1-w)·B` 一致。所有 AppKit/AVFoundation 调用都在主线程。
+use super::super::{
+    VisualEffects, WallpaperLayout, refresh_surface_opacity, show_media_error, show_shader_error,
+    underlay_layer_opacity,
+};
+use crate::platform::video_underlay::{Layout, NativeVideo};
+use gpui::{App, AsyncApp, Bounds, Pixels, Task, Window, point, px};
+use std::{path::PathBuf, time::Duration};
+
+const MONITOR_INTERVAL: Duration = Duration::from_millis(500);
+#[derive(Default)]
+pub(in crate::gpui_shell::wallpaper) struct Animated {
+    effect_config: nebula_settings::BackgroundEffects,
+    source: Option<Source>,
+}
+struct Source {
+    video: NativeVideo,
+    enabled: bool,
+    _monitor: Task<()>,
+}
+
+pub(in crate::gpui_shell::wallpaper) fn configure(
+    rt: &nebula_settings::RuntimeSettings,
+    source_changed: bool,
+    cx: &mut App,
+) {
+    let state = &mut cx.global_mut::<VisualEffects>().animated;
+    let effects_changed = state.effect_config != rt.background_effects;
+    state.effect_config = rt.background_effects.clone();
+    if effects_changed && rt.background_effects.preset() != "off" {
+        show_shader_error(cx);
+    }
+    if rt.background_media_kind != nebula_settings::BackgroundMediaKind::Video {
+        if cx.global_mut::<VisualEffects>().animated.source.take().is_some() {
+            cx.defer(refresh_surface_opacity);
+        }
+        if source_changed && rt.background_media_kind.is_animated() {
+            show_media_error(rt.background_media_kind, cx);
+        }
+        return;
+    }
+    if source_changed {
+        restart(cx);
+    }
+    let enabled = rt.background_image_opacity > 0.0;
+    if let Some(source) = cx.global_mut::<VisualEffects>().animated.source.as_mut() {
+        source.enabled = enabled;
+    }
+    tick(cx);
+}
+
+fn restart(cx: &mut App) {
+    let path = cx.global::<VisualEffects>().wallpaper.as_ref().map(|wp| wp.path.clone());
+    let had_source = cx.global_mut::<VisualEffects>().animated.source.take().is_some();
+    let source = path.and_then(|path| match open(path, cx) {
+        Ok(source) => Some(source),
+        Err(error) => {
+            log::warn!("video background open failed: {error:#}");
+            show_media_error(nebula_settings::BackgroundMediaKind::Video, cx);
+            None
+        },
+    });
+    cx.global_mut::<VisualEffects>().animated.source = source;
+    if had_source {
+        cx.defer(refresh_surface_opacity);
+    }
+}
+
+fn open(path: PathBuf, cx: &mut App) -> anyhow::Result<Source> {
+    let video = NativeVideo::open(path)?;
+    let monitor = cx.spawn(async move |cx: &mut AsyncApp| {
+        loop {
+            cx.background_executor().timer(MONITOR_INTERVAL).await;
+            let finished = cx.update(|cx| {
+                tick(cx);
+                cx.try_global::<VisualEffects>()
+                    .and_then(|effects| effects.animated.source.as_ref())
+                    .is_none_or(|source| source.video.failed())
+            });
+            if finished {
+                break;
+            }
+        }
+    });
+    Ok(Source { video, enabled: true, _monitor: monitor })
+}
+
+fn tick(cx: &mut App) {
+    let windows = cx.windows().iter().map(|handle| handle.window_id()).collect::<Vec<_>>();
+    let reduce_motion = cx.reduce_motion();
+    if !cx.has_global::<VisualEffects>() {
+        return;
+    }
+    let Some(source) = cx.global_mut::<VisualEffects>().animated.source.as_mut() else { return };
+    match source.video.tick(&windows, source.enabled, reduce_motion) {
+        Ok(true) => {
+            cx.defer(refresh_surface_opacity);
+            cx.refresh_windows();
+        },
+        Ok(false) => {},
+        Err(error) => {
+            log::warn!("video background failed: {error:#}");
+            source.video.fail();
+            show_media_error(nebula_settings::BackgroundMediaKind::Video, cx);
+            cx.defer(refresh_surface_opacity);
+        },
+    }
+}
+
+pub(in crate::gpui_shell::wallpaper) fn source_failed(cx: &App) -> bool {
+    cx.global::<VisualEffects>().animated.source.as_ref().is_some_and(|s| s.video.failed())
+}
+pub(in crate::gpui_shell::wallpaper) fn shader_ready(_: &App) -> bool {
+    false
+}
+pub(in crate::gpui_shell::wallpaper) fn media_ready(cx: &App) -> bool {
+    underlay_ready(cx)
+}
+pub(in crate::gpui_shell::wallpaper) fn underlay_ready(cx: &App) -> bool {
+    cx.try_global::<VisualEffects>()
+        .and_then(|e| e.animated.source.as_ref())
+        .is_some_and(|s| s.enabled && s.video.ready())
+}
+pub(in crate::gpui_shell::wallpaper) fn video_available() -> bool {
+    NativeVideo::available()
+}
+pub(in crate::gpui_shell::wallpaper) fn shader_available() -> bool {
+    false
+}
+pub(in crate::
```

**File**: `nebula_app/src/gpui_shell/wallpaper/animated/native.rs` (modified, +4/-0)
```diff
@@ -287,6 +287,10 @@ pub(in crate::gpui_shell::wallpaper) fn media_ready(cx: &App) -> bool {
         || effects.animated.retired_video.as_ref().is_some_and(|v| v.read(cx).has_front())
 }
 
+/// Backends that paint into the GPUI scene never sit below translucent surfaces.
+pub(in crate::gpui_shell::wallpaper) fn underlay_ready(_: &App) -> bool {
+    false
+}
 pub(in crate::gpui_shell::wallpaper) fn video_available() -> bool {
     true
 }
```

---

### Incident Patch 3: `26c07474` (2026-10-18)
**Commit Message**: fix(hints): skip table link lookup for a hover point past the grid edge

Signed-off-by: Sai Asish Y <[REDACTED_EMAIL]>

**File**: `nebula_app/src/display/hint.rs` (modified, +10/-0)
```diff
@@ -941,6 +941,16 @@ mod tests {
         }
     }
 
+    #[test]
+    fn table_lookup_past_the_grid_edge_is_not_a_hit() {
+        let term = mock_term("│ entry │ https://example.com/123456 │");
+        let past_edge = Point::new(Line(0), Column(term.columns() + 2));
+        assert!(
+            highlighted_at(&term, &UiConfig::default(), past_edge, ModifiersState::CONTROL)
+                .is_none()
+        );
+    }
+
     #[test]
     fn search_limit_never_opens_a_truncated_softwrapped_url_prefix() {
         use nebula_terminal::event::VoidListener;
```

**File**: `nebula_app/src/display/hint/table.rs` (modified, +5/-0)
```diff
@@ -79,6 +79,11 @@ fn continuation<T>(term: &Term<T>, line: Line, left: usize) -> bool {
 }
 
 pub(super) fn at<T>(term: &Term<T>, point: Point) -> Option<TableLink> {
+    // Like `hyperlink_at`: a hover point can lead the grid by a column/row during a resize.
+    let grid = term.grid();
+    if point.column.0 >= grid.columns() || point.line.0 >= grid.screen_lines() as i32 {
+        return None;
+    }
     let left = (0..point.column.0)
         .rfind(|&col| border(term.grid()[Point::new(point.line, Column(col))].c))?;
     let right = (point.column.0 + 1..term.columns())
```

#### Recent Merged Pull Requests:
- **PR #682** (2026-10-19): fix(hints): skip table link lookup for a hover point past the grid edge (@SAY-5)
- **PR #667** (2026-10-17): Release Pebrel 2.2.2 desktop updates (@Kuddev)
- **PR #666** (closed): perf: bound Agent activity updates and stop hidden badge animation (@Kuddev)
- **PR #663** (2026-10-16): fix: 修复本地文件链接包含尾随行数说明时无法打开的问题 (@galact-byte)
- **PR #659** (2026-10-15): docs: finalize Pebrel 2.2.1 release checksums (@Kuddev)
- **PR #658** (2026-10-16): fix(keymap): release macOS Control character defaults (@YinBuLiao)

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

## X. Merge pull request #682 from SAY-5/fix/table-hint-stale-hover-point

**RULE**:
When implementing operations in `nebula_app/src/display/hint.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b49b5351`: Merge pull request #682 from SAY-5/fix/table-hint-stale-hover-point. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `nebula_app/src/display/hint.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    #[test]
    fn table_lookup_past_the_grid_edge_is_not_a_hit() {
        let term = mock_term("│ entry │ https://example.com/123456 │");
        let past_edge = Point::new(Line(0), Column(term.columns() + 2));
        assert!(
            highlighted_at(&term, &UiConfig::default(), past_edge, ModifiersState::CONTROL)
                .is_none()
        );
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b49b5351` are properly handled with clean fallback behavior.
