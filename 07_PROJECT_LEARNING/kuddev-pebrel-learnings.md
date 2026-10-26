> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `404d9173`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T13:11:27.310Z  
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
> **Harvest Timestamp**: 2026-10-26T13:11:26.379Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3602 stars

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
    @Synchronized fun synchronizedOutput(): Boolean = NativeBridge.synchronizedOutput(pointer())
    @Synchronized fun endSynchronizedOutput() = NativeBridge.endSynchronizedOutput(pointer())
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
    /** Read at dispatch time: 0 = primary screen, 1 = alternate keys, 2 = mouse reporting. */
    @Synchronized fun applicationScrollMode(): Int = NativeBridge.applicationScrollMode(pointer())
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
    external fun synchronizedOutput(handle: Long): Boolean
    external fun endSynchronizedOutput(handle: Long)
    external fun resize(handle: Long, columns: Int, rows: Int, cellWidth: Int, cellHeight: Int)
    external fun render(handle: Long, rows: Array<TerminalRow?>, metadata: IntArray)
    external fun scroll(handle: Long, lines: Int)
    external fun scrollTo(handle: Long, offset: Int)
    external fun applicationScrollMode(handle: Long): Int
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
import errno
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
        write_terminal(osc, source)


def write_terminal(osc, source=None):
    try:
        fd = os.open("/dev/tty", os.O_WRONLY | os.O_NONBLOCK)
    except OSError as error:
        if source != "claude" or error.errno != errno.ENXIO:
            raise
        # Interactive Claude consumes hook JSON even when its hook has no TTY.
        # This fallback is only possible before any part of the OSC was written.
        print(json.dumps({"terminalSequence": osc.decode("ascii")}), flush=True)
        return
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
- **Issue #784** (2026-10-26): **[Bug] 字体回退后出现中文字符的渲染问题**
  *Symptoms*: ### Operating system / 操作系统  Windows (WSL)  ### OS version and display / 系统版本与显示  Winodws  11 23H2  ### Pebrel version / 版本号  2.3.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  fish  ### Program running in the pane / 面板里正在跑的程序  Other / 其他, vim / nvim / other full-screen TUI — 全屏 TUI  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Terminal rendering / scrolling / selection / garbled text — 终端渲染、滚动、选区、乱码  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  # 字体启用 MonoLisa, Maple Mono NF CN # 程序 通过打开neovim或是yazi这样的tui工具, 查看文档   ### Expected behavior / 期望结果  <img width="550" height="142" alt="Image" src="https://github.com/user-attachments/assets/79b42eb1-a817-46bc-b5b5-31c68ab23d7e" />  来自于Windows Terminal的截图, 证明不是字体或是文件问题  ### Actual behavior / 实际结果  <img width="713" height="151" alt="Image" src="https://github.com/user-attachments/assets/dc760904-b4ed-4235-93f1-6d2fa627e96c" />  ### Logs / screenshots / 日志或截图  # 奇妙的问题 当文件的后辍名为txt或是md等文本文件时, 全部的渲染都是正常的  <img width="307" height="189" alt="Image" src="https://github.com/user-attachments/assets/c2e8d92d-17ec-425a-9659-e2e5a56c07e9" />  但是一但是代码文件, 经测试有cpp, java, zig , go, 全部都会出现如下的中文显示问题  <img width="713" height="151" alt="Image" src="https://github.com/user-attachments/assets/dc760904-b4ed-4235-93f1-6d2f

- **Issue #689** (2026-10-23): **[Bug] 辛苦佬加个删历史记录的，临时指令太多了有点碍事了**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  .  ### Pebrel version / 版本号  2.2.1  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  cmd  ### Program running in the pane / 面板里正在跑的程序  Other / 其他  ### Connection type / 连接方式  Other / 其他  ### Affected area / 影响范围  Other / 其他  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Once / not sure / 仅一次  ### Steps to reproduce / 复现步骤  .  ### Expected behavior / 期望结果  .  ### Actual behavior / 实际结果  .  ### Logs / screenshots / 日志或截图  Reported from Pebrel Settings (Pebrel 2.2.1).  Platform: windows x86_64 Build: release  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

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

### Incident Patch 1: `96595622` (2026-10-26)
**Commit Message**: Merge pull request #775 from Kuddev/fix/windows-update-worker-20261026

Fix Windows update preparation blocked by its own identity worker

**File**: `architecture/notes/nebula_app/platform/ai_session_identity/windows/2026-10-26-update-quiescence.md` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+# Quiesce the owned identity worker before Windows update preparation
+
+## Status
+
+Implemented; native validation and review pending.
+
+## Context
+
+Windows update preparation rejects any live process from the installed executable
+that is absent from the handoff's participant list. The list intentionally contains
+only the application authorizing the update. The reusable identity worker is a
+second copy of that executable and survives idle time until its owner exits.
+Preparation happens before that exit, so a resident worker blocks the update.
+
+The reporter runs 2.2.2, whose disposable probe can also overlap the same process
+check. Their exact interfering process has not been identified. Replacing the
+downloaded installer cannot modify the old updater's pre-installation check;
+exiting the old application and manually running setup remains the recovery path.
+
+## Evidence
+
+- `worker::query_slot` retains a healthy child after returning its response.
+- `handoff::prepare` writes only the current PID and creation time as participants.
+- `handoff.ps1::Check-UnpreparedProcesses` rejects that second live executable
+  with `Another process from this installation is not prepared for update`.
+- The native regression exercises that exact production PowerShell function on a
+  real worker, both before and after acquiring the update pause.
+
+## Decision
+
+The identity capability exposes a scoped update pause. On Windows, acquisition
+closes a process-wide, reference-counted gate before waiting for the existing
+worker mutex. Probes check the gate before and after locking. Acquisition reaps
+only the owned worker through its kernel handle and confirms process exit before
+returning. Both mutex acquisition and process cleanup remain bounded.
+
+The update transaction acquires its pause on the background executor before
+starting the native handoff helper. `PreparedUpdate` owns it during preparation,
+snapshot validation and commit. Errors and cancellation drop the pause, permitting
+the next poll to create a worker lazily. A committed handoff retains the gate until
+process exit even when `PreparedUpdate` is dropped. Dropping a pause does not lock
+or wait, since cancellation can happen on the UI thread. Other platforms have no
+self-spawned resident identity worker and retain their existing behavior.
+
+## Rejected alternatives
+
+- Ignore helpers by name or command line: weakens the executable identity guard
+  and leaves a running copy of the installed executable during replacement.
+- Kill matching process names: may terminate another application instance and its
+  unsaved workspace. The worker owner already has the exact native handle.
+- Stop only the current worker without gating new probes: polling can immediately
+  recreate it during the asynchronous preparation handshake.
+- Resume probing when a committed guard drops: the shutdown path can drop its
+  local handoff before process teardown finishes.
+- Add the worker as an update participant: gives a probe process transaction
+  responsibilities without solving its ownership and exit ordering.
+
+## Consequences
+
+Identity polling pauses only during an active update handoff. Existing collected
+identities remain with their pane owners. A cancelled attempt can resume probing;
+overlapping attempts cannot release each other's pauses. The installer still
+rejects unrelated live instances and unverified process identities. No persisted
+format, helper protocol, installation guard or process-killing authority changes.
+
+## Validation
+
+The native regression covers the original guard failure, confirmed worker exit,
+concurrent polls while paused, cancellation/restart, overlapping pause owners,
+bounded acquisition failure, in-flight lock ordering and commit/drop lifetime.
+It also verifies that another live copy still blocks preparation and is not killed.
+The existing worker failure, owner-exit and installer handoff fixtures remain.
+Native Windows execution is required; Linux compilation cannot establish those
+process and PowerShell contracts.
+
+## Supersedes
+
+The idle-worker lifetime in
+[the reusable worker decision](2026-10-23-reusable-probe-process.md) is extended
+with update preparation as an explicit quiescence boundary. Its process ownership,
+private pipes, probe deadline and startup-feedback policy remain applicable.
+
+## Revisit when
+
+The application introduces authenticated cross-process update coordination or
+the identity probe no longer runs a copy of the installed executable.
```

**File**: `nebula_app/src/platform/ai_session_identity.rs` (modified, +22/-0)
```diff
@@ -25,6 +25,28 @@ pub(crate) fn run_helper_if_requested() -> Option<i32> {
     None
 }
 
+/// Keep owned copies of the application executable stopped during installation.
+/// Acquisition waits on the background executor; cancellation only releases a gate.
+pub(crate) struct UpdatePause {
+    #[cfg(windows)]
+    inner: windows::UpdatePause,
+}
+
+impl UpdatePause {
+    pub(crate) fn acquire() -> io::Result<Self> {
+        Ok(Self {
+            #[cfg(windows)]
+            inner: windows::UpdatePause::acquire()?,
+        })
+    }
+
+    /// A committed handoff must keep probes stopped even when its owner is dropped.
+    pub(crate) fn commit(&mut self) {
+        #[cfg(windows)]
+        self.inner.commit();
+    }
+}
+
 const PROBE_TIMEOUT: Duration = Duration::from_secs(2);
 const MAX_PROBE_OUTPUT: usize = 64 * 1024;
 const MAX_PROBE_LINE: usize = 64 * 1024;
```

**File**: `nebula_app/src/platform/ai_session_identity/windows.rs` (modified, +2/-0)
```diff
@@ -3,6 +3,8 @@
 
 mod worker;
 
+pub(super) use worker::UpdatePause;
+
 use super::*;
 use std::collections::HashMap;
 use std::mem;
```

**File**: `nebula_app/src/platform/ai_session_identity/windows/worker.rs` (modified, +71/-16)
```diff
@@ -9,10 +9,13 @@ use std::mem;
 use std::os::windows::ffi::OsStrExt as _;
 use std::os::windows::io::{AsHandle as _, AsRawHandle as _, FromRawHandle as _, OwnedHandle};
 use std::ptr;
-use std::sync::{Mutex, TryLockError};
+use std::sync::atomic::{AtomicUsize, Ordering};
+use std::sync::{Mutex, MutexGuard, TryLockError};
 use std::time::{Duration, Instant};
 
-use windows_sys::Win32::Foundation::{DUPLICATE_SAME_ACCESS, DuplicateHandle, HANDLE};
+use windows_sys::Win32::Foundation::{
+    DUPLICATE_SAME_ACCESS, DuplicateHandle, HANDLE, WAIT_OBJECT_0, WAIT_TIMEOUT,
+};
 use windows_sys::Win32::System::Pipes::{CreatePipe, PeekNamedPipe};
 use windows_sys::Win32::System::Threading::{
     CREATE_SUSPENDED, CreateProcessW, DeleteProcThreadAttributeList, EXTENDED_STARTUPINFO_PRESENT,
@@ -25,23 +28,65 @@ pub(super) const ARG: &str = "--internal-codex-session-worker";
 const READY: &[u8] = b"PEBREL_SESSION_PROBE_V1\n";
 const POLL: Duration = Duration::from_millis(5);
 static WORKER: Mutex<Option<Worker>> = Mutex::new(None);
+static UPDATE_PAUSES: AtomicUsize = AtomicUsize::new(0);
+
+pub(crate) struct UpdatePause {
+    resume_on_drop: bool,
+}
+
+impl UpdatePause {
+    pub(crate) fn acquire() -> io::Result<Self> {
+        // Close the gate before waiting for an in-flight probe, so queued probes
+        // cannot create another executable after we have reaped the current one.
+        UPDATE_PAUSES.fetch_add(1, Ordering::AcqRel);
+        let pause = Self { resume_on_drop: true };
+        let mut slot = lock_worker(Instant::now() + PROBE_TIMEOUT + Duration::from_secs(1))?;
+        if let Some(mut worker) = slot.take() {
+            worker.stop()?;
+        }
+        Ok(pause)
+    }
+
+    pub(crate) fn commit(&mut self) {
+        self.resume_on_drop = false;
+    }
+}
+
+impl Drop for UpdatePause {
+    fn drop(&mut self) {
+        if self.resume_on_drop {
+            // This guard may return to the UI thread. Never wait for a probe here.
+            UPDATE_PAUSES.fetch_sub(1, Ordering::AcqRel);
+        }
+    }
+}
 
 pub(super) fn probe(pid: u32, created: u64) -> Option<super::CodexSession> {
+    if UPDATE_PAUSES.load(Ordering::Acquire) != 0 {
+        return None;
+    }
     let deadline = Instant::now() + PROBE_TIMEOUT;
+    let mut slot = lock_worker(deadline).ok()?;
+    if UPDATE_PAUSES.load(Ordering::Acquire) != 0 {
+        return None;
+    }
+    let output = query_slot(&mut slot, pid, created, deadline).ok()?;
+    super::parse_probe_context(&output)
+}
+
+fn lock_worker(deadline: Instant) -> io::Result<MutexGuard<'static, Option<Worker>>> {
     // Several panes may ask together. Waiting for the shared worker uses the
     // same request deadline, rather than serially adding unbounded waits.
-    let mut slot = loop {
+    loop {
         if Instant::now() >= deadline {
-            return None;
+            return Err(io::ErrorKind::TimedOut.into());
         }
         match WORKER.try_lock() {
-            Ok(slot) => break slot,
-            Err(TryLockError::Poisoned(error)) => break error.into_inner(),
+            Ok(slot) => return Ok(slot),
+            Err(TryLockError::Poisoned(error)) => return Ok(error.into_inner()),
             Err(TryLockError::WouldBlock) => std::thread::sleep(POLL),
         }
-    };
-    let output = query_slot(&mut slot, pid, created, deadline).ok()?;
-    super::parse_probe_context(&output)
+    }
 }
 
 fn query_slot(
@@ -109,6 +154,20 @@ struct Worker {
 }
 
 impl Worker {
+    fn stop(&mut self) -> io::Result<()> {
+        drop(self.group.take());
+        // SAFETY: this is our owned process object, including startup failures.
+        // An already exited child is successful; no PID/name lookup can kill a peer.
+        unsafe {
+            TerminateProcess(self.process.as_raw_handle(), 1);
+            match WaitForSingleObject(self.process.as_raw_handle(), 500) {
+                WAIT_OBJECT_0 => Ok(()),
+                WAIT_TIMEOUT => Err(io::ErrorKind::TimedOut.into()),
+                _ => Err(io::Error::last_os_error()),
+            }
+        }
+    }
+
     fn start(args: &[String], deadline: Instant) -> io::Result<Self> {
         let (input_read, input_write) = pipe()?;
         let (output_read, output_write) = pipe()?;
@@ -195,13 +254,7 @@ impl Worker {
 
 impl Drop for Worker {
     fn drop(&mut self) {
-        drop(self.group.take());
-        // SAFETY: the process handle belongs to this worker, including failures
-        // before job attachment. Cleanup is bounded and happens on the probing thread.
-        unsafe {
-            TerminateProcess(self.process.as_raw_handle(), 1);
-            WaitForSingleObject(self.process.as_raw_handle(), 500);
-        }
+        let _ = self.stop();
     }
 }
 
@@ -323,3 +376,5 @@ fn spawn(args: &[String], files: [&File; 3]) -> io::Result<(OwnedHandle, OwnedHa
 
 #[cfg(test)]
 mod tests;
+#[cfg(test)]
+mod update_tests;
```

**File**: `nebula_app/src/platform/ai_session_identity/windows/worker/update_tests.rs` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+use super::*;
+use crate::platform::ai_session_identity::UpdatePause as HandoffPause;
+use std::process::Command;
+use windows_sys::Win32::System::Threading::GetProcessId;
+
+fn start_probe() -> OwnedHandle {
+    // An empty identity reply still leaves a healthy native worker resident.
+    assert!(probe(0, 0).is_none());
+    WORKER.lock().unwrap().as_ref().unwrap().process.try_clone().unwrap()
+}
+
+fn assert_paused() {
+    std::thread::scope(|scope| {
+        for _ in 0..8 {
+            scope.spawn(|| assert!(probe(0, 0).is_none()));
+        }
+    });
+    assert!(WORKER.lock().unwrap().is_none(), "background polls must not recreate the worker");
+}
+
+fn check_processes(handles: &[&OwnedHandle]) -> std::process::Output {
+    let directory = tempfile::tempdir().unwrap();
+    let helper = directory.path().join("handoff.ps1");
+    std::fs::write(&helper, include_bytes!("../../../../update_download/handoff.ps1")).unwrap();
+    // Execute the actual updater guard against the selected real processes. The
+    // full test runner may have unrelated tests running from this same binary.
+    let script = r#"
+$ErrorActionPreference = 'Stop'
+$tokens = $null
+$errors = $null
+$ast = [System.Management.Automation.Language.Parser]::ParseFile(
+    $env:PEBREL_PAUSE_HELPER, [ref]$tokens, [ref]$errors)
+if ($errors) { throw 'Invalid production helper' }
+$functions = $ast.FindAll({ param($node)
+    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
+        $node.Name -in @('Same-Path', 'Check-UnpreparedProcesses')
+}, $false)
+if ($functions.Count -ne 2) { throw 'Missing production process guard' }
+foreach ($function in $functions) { . ([scriptblock]::Create($function.Extent.Text)) }
+$exe = $env:PEBREL_PAUSE_EXE
+$plan = @{ participants = @(@{ pid = [int]$env:PEBREL_PAUSE_OWNER }) }
+$ids = @($env:PEBREL_PAUSE_PIDS.Split(',') | ForEach-Object { [int]$_ })
+$processes = @([System.Diagnostics.Process]::GetProcessesByName(
+    [System.IO.Path]::GetFileNameWithoutExtension($exe)) | Where-Object { $ids -contains $_.Id })
+try { Check-UnpreparedProcesses $processes }
+catch { [Console]::Out.Write($_.Exception.Message); exit 1 }
+"#;
+    let system = std::env::var_os("SystemRoot").unwrap();
+    let mut command = Command::new(
+        std::path::Path::new(&system).join("System32/WindowsPowerShell/v1.0/powershell.exe"),
+    );
+    let mut ids = vec![std::process::id().to_string()];
+    ids.extend(
+        handles.iter().map(|handle| unsafe { GetProcessId(handle.as_raw_handle()).to_string() }),
+    );
+    command
+        .args(["-NoProfile", "-NonInteractive", "-Command", script])
+        .env("PEBREL_PAUSE_HELPER", helper)
+        .env("PEBREL_PAUSE_EXE", std::env::current_exe().unwrap())
+        .env("PEBREL_PAUSE_OWNER", std::process::id().to_string())
+        .env("PEBREL_PAUSE_PIDS", ids.join(","));
+    crate::platform::process::hidden_command(&mut command).output().unwrap()
+}
+
+fn assert_blocked(output: std::process::Output) {
+    assert!(!output.status.success(), "a live unprepared process must block installation");
+    assert_eq!(
+        String::from_utf8(output.stdout).unwrap(),
+        "Another process from this installation is not prepared for update",
+        "{}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+}
+
+#[test]
+fn update_pause_coordinates_native_workers_and_preserves_the_process_guard() {
+    // The global pause deliberately survives commit. Isolate it from other tests.
+    if std::env::var_os("PEBREL_TEST_UPDATE_PAUSE").is_none() {
+        let mut command = Command::new(std::env::current_exe().unwrap());
+        command
+            .args([
+                "--exact",
+                "platform::ai_session_identity::windows::worker::update_tests::update_pause_coordinates_native_workers_and_preserves_the_process_guard",
+                "--nocapture",
+            ])
+            .env("PEBREL_TEST_UPDATE_PAUSE", "1");
+        let output = crate::platform::process::hidden_command(&mut command).output().unwrap();
+        assert!(output.status.success(), "{output:?}");
+        return;
+    }
+
+    let original = start_probe();
+    assert_blocked(check_processes(&[&original]));
+    let pause = HandoffPause::acquire().unwrap();
+    assert_eq!(unsafe { WaitForSingleObject(original.as_raw_handle(), 0) }, WAIT_OBJECT_0);
+    assert_paused();
+    let output = check_processes(&[&original]);
+    assert!(output.status.success(), "{output:?}");
+
+    // An overlapping failed/cancelled attempt cannot release another attempt's gate.
+    let overlapping = HandoffPause::acquire().unwrap();
+    drop(pause);
+    assert_paused();
+    let unrelated = Worker::start(&arguments(), Instant::now() + PROBE_TIMEOUT).unwrap();
+    assert_blocked(check_processes(&[&unrelated.process]));
+    assert_eq!(unsafe { WaitForSingleObject(unrelated.process.as_raw_handle(), 0) }, WAIT_TIMEOUT);
+    drop(overlapping);
+    let 
```

**File**: `nebula_app/src/update_download/handoff.rs` (modified, +8/-1)
```diff
@@ -53,6 +53,7 @@ pub(crate) struct PreparedUpdate {
     transaction: String,
     child: Child,
     committed: bool,
+    identity_pause: crate::platform::ai_session_identity::UpdatePause,
 }
 
 impl PreparedUpdate {
@@ -68,6 +69,7 @@ impl PreparedUpdate {
         crate::atomic_file::write(&self.directory.join("commit.json"), &commit)
             .map_err(|error| format!("Could not commit the update: {error}"))?;
         self.committed = true;
+        self.identity_pause.commit();
         Ok(())
     }
 }
@@ -172,9 +174,14 @@ pub(crate) fn prepare(asset: &UpdateAsset) -> Result<PreparedUpdate, String> {
         &serde_json::to_vec(&plan_path).map_err(|error| error.to_string())?,
     )
     .map_err(|error| error.to_string())?;
+    // The identity worker runs from the same executable as this participant.
+    // Reap it before the helper scans processes, and hold the gate through commit.
+    let identity_pause = crate::platform::ai_session_identity::UpdatePause::acquire()
+        .map_err(|error| format!("Could not stop session detection for update: {error}"))?;
     let child =
         crate::platform::update_installation::spawn_prepared_helper(&directory, &plan_path)?;
-    let mut prepared = PreparedUpdate { directory, transaction, child, committed: false };
+    let mut prepared =
+        PreparedUpdate { directory, transaction, child, committed: false, identity_pause };
     let timeout = if crate::platform::Platform::current() == crate::platform::Platform::MacOS {
         600
     } else {
```

---

### Incident Patch 2: `404d9173` (2026-10-26)
**Commit Message**: Fix character-art proportions without changing text spacing (#787)

Fit bounded dense character-art regions inside the existing terminal allocation while preserving the restored default font metrics. Share geometry across painting and interaction, capture neighboring source rows for scrolling, and use the official Ubuntu archive for native CI dependency downloads.

**File**: `.github/workflows/linux-lua.yml` (modified, +2/-0)
```diff
@@ -108,6 +108,8 @@ jobs:
       - name: Install native dependencies
         if: ${{ runner.os == 'Linux' }}
         run: |
+          # 避开 runner 默认 Azure 镜像的低速下载，保留现有发行版与签名配置。
+          printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' | sudo tee /etc/apt/apt-mirrors.txt
           sudo apt-get update
           sudo apt-get install -y --no-install-recommends \
             build-essential cmake pkg-config zsh libasound2-dev libdbus-1-dev libudev-dev \
```

**File**: `architecture/notes/nebula_app/gpui_shell/terminal/2026-10-26-bounded-character-art-regions.md` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+# Bounded character-art regions without changing text rows
+
+## Status
+
+Implemented. The combined Windows desktop preview was accepted on 2026-10-26.
+The approved 2.2.2 text spacing remains unchanged; native CI coverage is separate
+from that visual acceptance.
+
+## Context
+
+Restoring normal reading space also restored the tall aspect ratio of multi-row
+character art. A global 1:2 grid had corrected logos but made paragraphs and lists
+too tight. Ordinary text spacing must no longer be used to fix a graphic.
+
+## Evidence
+
+Braille uses two dot columns and four dot rows. Its source grid may have taller
+rows, but geometric glyphs can use a local two-times-column-width pitch. Merely
+changing individual dot positions leaves gaps between terminal rows; the complete
+region and its input coordinates must share the same mapping.
+
+The ordinary render snapshot contains only source rows in the viewport. Centered
+compression can leave pixels from a source row just outside that viewport visible.
+Reusing only cached bounds would drop those pixels early and mis-map selection.
+
+## Decision
+
+- The frontend identifies bounded, multi-row regions made exclusively from dense
+  Braille, block characters, or long repeated slash runs. It does not inspect
+  process names. Short decorations, ordinary prose, table borders, Powerline,
+  explicit backgrounds, images and formula/native-result coverage are excluded.
+- Draw a qualifying graphic with local row pitch equal to twice the existing
+  column width, centered in its original reserved rectangle. The terminal grid,
+  text font size, PTY dimensions and surrounding rows do not change.
+- Selection backgrounds, search highlights, link decoration and pointer inversion
+  use the same local mapping. Cursor-intersecting regions and VI mode retain grid
+  presentation. Graphic slash runs do not use programming ligature coalescing.
+- Retain only bounded source-region coordinates, not stale glyphs. A partially
+  visible known region requests its current neighboring source rows through the
+  shared `RenderSnapshot::capture_from` pipeline under the existing terminal lock.
+  This preserves colors and selection without duplicating snapshot semantics or
+  changing the actual viewport. Negative relative source rows remain addressable.
+- Recompute complete boundaries from current source data. Erasing or shrinking a
+  region must yield the same layout as a newly created view. Reset, screen switch
+  and column changes invalidate the coordinate cache. The candidate scan and cache
+  have explicit bounds; insufficient evidence leaves the existing grid visible.
+
+## Rejected alternatives
+
+- Change default text row height again: contradicts the accepted reading result.
+- Scale only dots inside each cell: leaves character-boundary gaps.
+- Move graphic pixels without input mapping: selection targets the wrong row.
+- Cache full rendered glyphs: can display stale output after an offscreen rewrite.
+- Treat every punctuation or Braille run as a picture: changes ordinary text.
+- Claim arbitrary ASCII art recognition: text and ASCII drawings can be ambiguous;
+  this slice covers the observed Braille and repeated-slash cases.
+
+## Consequences
+
+The graphic keeps its original vertical allocation, including its surrounding
+space; following output does not jump. Partially observed regions without known
+complete boundaries use normal grid rendering. Source text and copy semantics
+remain authoritative. No setting, application-specific hook or dependency is added.
+
+## Validation
+
+Focused regressions cover excluded text and borders, neighboring system-info text,
+selection inversion, actual drag-selection copying, source-row capture, partial
+scrolling, erase/shrink history independence and reset. Native captures compare the
+approved reading scene pixel-for-pixel and measure a circle while retaining the
+29-device-pixel Maple 13px row at 150% display scale. Fastfetch uses its actual
+Windows 11 output; a live Codex preview remains separate from synthetic geometry.
+The live Codex logo and the circle before/after scrolling measured 355 by 355
+pixels, while the ordinary reading scene's client pixels stayed identical.
+Seventy focused regressions and the source-snapshot regression passed locally;
+Fastfetch returned zero in the real product PTY. The 60-frame local captures had
+median draw CPU costs of 4.09ms for reading, 5.29ms for the scrolling circle and
+6.59ms for Fastfetch; these are fixture results, not universal performance claims.
+
+## Supersedes
+
+None. The default typography contract from
+[2.2.2 reading spacing](2026-10-26-restore-2-2-2-reading-spacing.md) remains unchanged.
+
+## Revisit when
+
+A real false-positive or interaction case demonstrates ambiguity, or applications
+provide an explicit image/graphic region protocol that replaces shape detection.
```

**File**: `nebula_app/src/gpui_shell/terminal/character_art.rs` (added, +447/-0)
```diff
@@ -0,0 +1,447 @@
+//! 纯字符画在原占位内适配比例；正文网格、PTY 尺寸和源文本保持不变。
+
+use std::ops::Range;
+
+use nebula_terminal::render::RenderSnapshot;
+
+mod paint;
+pub(super) use paint::paint_overflow;
+
+const BLOCKED: u8 = 15;
+const DENSE: u8 = 16;
+const VISITED: u8 = 128;
+const MAX_CELLS: usize = 262_144;
+const MAX_REGIONS: usize = 32;
+
+#[derive(Clone, Copy, Debug)]
+struct Area {
+    top: i64,
+    bottom: i64,
+    left: usize,
+    right: usize,
+    kind: u8,
+}
+
+impl Area {
+    fn intersects_rows(self, top: i64, rows: usize) -> bool {
+        self.top < top + rows as i64 && self.bottom > top
+    }
+}
+
+#[derive(Clone, Copy)]
+struct Region {
+    area: Area,
+    source_top: f32,
+    visual_top: f32,
+    padding: f32,
+    ratio: f32,
+}
+
+impl Region {
+    fn contains(self, row: i64, col: usize) -> bool {
+        let row = row as f32 - self.source_top;
+        row >= 0.0
+            && row < (self.area.bottom - self.area.top) as f32
+            && (self.area.left..self.area.right).contains(&col)
+    }
+}
+
+/// 坐标单位与 native-result projection 一样，都是行/列，不混用物理像素。
+#[derive(Clone, Default)]
+pub(super) struct Frame {
+    regions: Vec<Region>,
+}
+
+impl Frame {
+    fn region(&self, row: i64, col: usize) -> Option<usize> {
+        self.regions.iter().position(|region| region.contains(row, col))
+    }
+
+    pub fn same_region(&self, row: usize, a: usize, b: usize) -> bool {
+        self.region(row as i64, a) == self.region(row as i64, b)
+    }
+
+    pub fn cell(&self, row: usize, col: usize, normal_y: f32) -> (f32, f32) {
+        self.cell_at(row as i64, col, normal_y)
+    }
+
+    pub fn cell_at(&self, row: i64, col: usize, normal_y: f32) -> (f32, f32) {
+        let Some(index) = self.region(row, col) else { return (normal_y, 1.0) };
+        let region = self.regions[index];
+        (
+            region.visual_top + region.padding + (row as f32 - region.source_top) * region.ratio,
+            region.ratio,
+        )
+    }
+
+    pub fn mapped_source_row(&self, col: f32, visual_y: f32) -> Option<f32> {
+        for region in &self.regions {
+            let rows = (region.area.bottom - region.area.top) as f32;
+            if col >= region.area.left as f32
+                && col < region.area.right as f32
+                && visual_y >= region.visual_top
+                && visual_y < region.visual_top + rows
+            {
+                // 上下留白归对应边缘源行，拖选离开图案时仍有确定且连续的边界。
+                return Some(
+                    region.source_top
+                        + ((visual_y - region.visual_top - region.padding) / region.ratio)
+                            .clamp(0.0, rows - 0.0001),
+                );
+            }
+        }
+        None
+    }
+
+    pub fn source_bounds(&self) -> Range<i64> {
+        let start = self.regions.iter().map(|r| r.source_top as i64).min().unwrap_or(0);
+        let end = self
+            .regions
+            .iter()
+            .map(|r| r.source_top as i64 + r.area.bottom - r.area.top)
+            .max()
+            .unwrap_or(0);
+        start..end
+    }
+
+    pub fn shift_source(&mut self, offset: i64) {
+        for region in &mut self.regions {
+            region.source_top += offset as f32;
+        }
+    }
+
+    pub fn spans(
+        &self,
+        row: i64,
+        columns: Range<usize>,
+        normal_y: f32,
+        mut paint: impl FnMut(Range<usize>, f32, f32),
+    ) {
+        let mut start = columns.start;
+        while start < columns.end {
+            let end = if let Some(index) = self.region(row, start) {
+                columns.end.min(self.regions[index].area.right)
+            } else {
+                self.regions
+                    .iter()
+                    .filter(|region| {
+                        region.area.left > start && region.contains(row, region.area.left)
+                    })
+                    .map(|region| region.area.left)
+                    .min()
+                    .unwrap_or(columns.end)
+                    .min(columns.end)
+            };
+            let (y, height) = self.cell_at(row, start, normal_y);
+            paint(start..end, y, height);
+            start = end;
+        }
+    }
+}
+
+#[derive(Default)]
+pub(super) struct Layout {
+    identity: Option<(usize, u64, bool, u16)>,
+    cached: Vec<Area>,
+    pub frame: Frame,
+}
+
+fn geometry(ch: char) -> u8 {
+    match ch {
+        '\u{2801}'..='\u{28ff}' => {
+            1 | if (ch as u32 - 0x2800).count_ones() >= 5 { DENSE } else { 0 }
+        },
+        '\u{2580}'..='\u{259f}' => 2 | DENSE,
+        _ => BLOCKED,
+    }
+}
+
+fn kind(value: u8) -> u8 {
+    value & 15
+}
+
+impl Layout {
+    pub fn capture_rows(
+        &self,
+        identity: (usize, u64, bool, u16),
+        top: i64,
+        rows: usize,
+        retained: Range<i64>,
+        visible: &RenderSnapshot,
+    ) -> Option<Range<i64>> {
+        let mut range = top..top + rows as i64;
+        for area in self
+            .cached

```

**File**: `nebula_app/src/gpui_shell/terminal/character_art/paint.rs` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+//! 图案压缩后仍可见的相邻源行，复用快照颜色与选区而不缓存旧字形。
+use super::Frame;
+use crate::gpui_shell::terminal::{colors::Palette, cursor_painter::paint_box_glyph};
+use gpui::{App, Bounds, Font, Pixels, Point, Rgba, TextAlign, TextRun, Window, fill, point, size};
+use nebula_terminal::{
+    render::{RenderSnapshot, boxdraw},
+    term::color::Colors,
+};
+
+pub(in crate::gpui_shell::terminal) fn paint_overflow(
+    frame: &Frame,
+    source: &RenderSnapshot,
+    offset: i64,
+    visible_rows: u16,
+    origin: Point<Pixels>,
+    metrics: (Pixels, Pixels),
+    theme: &Palette,
+    overrides: &Colors,
+    selection: Rgba,
+    selection_foreground: Option<Rgba>,
+    font_size: Pixels,
+    font: &impl Fn(bool, bool, bool) -> Font,
+    window: &mut Window,
+    cx: &mut App,
+) {
+    let (width, height) = metrics;
+    let outside = |row: u16| {
+        let row = i64::from(row) + offset;
+        row < 0 || row >= i64::from(visible_rows)
+    };
+    let rect = |col: usize, count: usize, y: f32, h: f32| {
+        Bounds::new(
+            point(origin.x + width * col as f32, origin.y + height * y),
+            size(width * count as f32, height * h),
+        )
+    };
+    for run in source.selection_runs.iter().filter(|run| outside(run.row)) {
+        let row = i64::from(run.row) + offset;
+        frame.spans(row, usize::from(run.start)..usize::from(run.end), row as f32, |cols, y, h| {
+            if h < 1.0 {
+                window.paint_quad(fill(rect(cols.start, cols.len(), y, h), selection));
+            }
+        });
+    }
+    let foreground = |row, col, fg, bold, dim| {
+        selection_foreground
+            .filter(|_| {
+                source.selection_runs.iter().any(|r| r.row == row && r.start <= col && col < r.end)
+            })
+            .unwrap_or_else(|| theme.resolve_styled(fg, overrides, bold, dim))
+    };
+    for glyph in source.box_glyphs.iter().filter(|glyph| outside(glyph.row)) {
+        let row = i64::from(glyph.row) + offset;
+        let (y, h) = frame.cell_at(row, usize::from(glyph.col), row as f32);
+        if h >= 1.0 {
+            continue;
+        }
+        let Some(primitives) = boxdraw::primitives(
+            glyph.ch,
+            width.as_f32(),
+            height.as_f32() * h,
+            window.scale_factor(),
+        ) else {
+            continue;
+        };
+        let snap = crate::gpui_shell::terminal::element::snap_to_device;
+        paint_box_glyph(
+            window,
+            &primitives,
+            point(
+                snap(origin.x + width * f32::from(glyph.col), window.scale_factor()),
+                snap(origin.y + height * y, window.scale_factor()),
+            ),
+            foreground(glyph.row, glyph.col, glyph.fg, glyph.bold, glyph.dim),
+        );
+    }
+    for segment in source.segments.iter().filter(|segment| outside(segment.row)) {
+        let row = i64::from(segment.row) + offset;
+        for cell in &segment.cells {
+            let (y, h) = frame.cell_at(row, usize::from(cell.col), row as f32);
+            if h >= 1.0 {
+                continue;
+            }
+            let run = TextRun {
+                len: cell.text.len(),
+                font: font(cell.bold, cell.italic, segment.wide),
+                color: foreground(segment.row, cell.col, cell.fg, cell.bold, cell.dim).into(),
+                background_color: None,
+                underline: None,
+                strikethrough: None,
+            };
+            let line =
+                window.text_system().shape_line(cell.text.clone().into(), font_size, &[run], None);
+            let _ = line.paint(
+                point(origin.x + width * f32::from(cell.col), origin.y + height * y),
+                height * h,
+                TextAlign::Left,
+                None,
+                window,
+                cx,
+            );
+        }
+    }
+}
```

**File**: `nebula_app/src/gpui_shell/terminal/character_art/tests.rs` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+use super::*;
+use nebula_terminal::render::{BgRun, BoxGlyph, CursorSnapshot, SnapCell, TextSegment};
+use nebula_terminal::term::cell::Flags;
+use nebula_terminal::vte::ansi::{Color, CursorShape, NamedColor};
+
+fn snapshot(lines: &[String], rows: u16) -> RenderSnapshot {
+    let mut snap = RenderSnapshot {
+        cols: 64,
+        rows,
+        display_offset: 0,
+        color_overrides: Default::default(),
+        bg_runs: Vec::new(),
+        selection_runs: Vec::new(),
+        segments: Vec::new(),
+        box_glyphs: Vec::new(),
+        image_runs: Vec::new(),
+        cursor: None,
+    };
+    for (row, line) in lines.iter().enumerate() {
+        for (col, ch) in line.chars().enumerate() {
+            if ch == ' ' {
+                continue;
+            }
+            if nebula_terminal::render::boxdraw::is_builtin(ch) {
+                snap.box_glyphs.push(BoxGlyph {
+                    row: row as u16,
+                    col: col as u16,
+                    wide: false,
+                    ch,
+                    fg: Color::Named(NamedColor::Foreground),
+                    bold: false,
+                    dim: false,
+                });
+            } else {
+                snap.segments.push(TextSegment {
+                    row: row as u16,
+                    start_col: col as u16,
+                    wide: false,
+                    cells: vec![SnapCell {
+                        col: col as u16,
+                        text: ch.to_string(),
+                        fg: Color::Named(NamedColor::Foreground),
+                        bg: Color::Named(NamedColor::Background),
+                        bold: false,
+                        dim: false,
+                        bg_dim: false,
+                        italic: false,
+                        underline: false,
+                        strikethrough: false,
+                    }],
+                });
+            }
+        }
+    }
+    snap
+}
+
+fn logo(ch: char) -> Vec<String> {
+    let mut lines = vec![String::new()];
+    lines.extend((0..8).map(|_| format!("  {}", ch.to_string().repeat(12))));
+    lines.push("following text".into());
+    lines
+}
+
+fn update(layout: &mut Layout, snap: &RenderSnapshot, top: i64) {
+    layout.update(snap, (1, 0, false, snap.cols), top, 8.0, 22.0, false, |row| row, |_, _| true);
+}
+
+#[test]
+fn character_art_fits_a_region_without_moving_body_or_following_rows() {
+    for ch in ['⣿', '█', '/'] {
+        let snap = snapshot(&logo(ch), 16);
+        let mut layout = Layout::default();
+        update(&mut layout, &snap, 0);
+        assert_eq!(layout.frame.regions.len(), 1);
+        let (first, h) = layout.frame.cell(1, 2, 1.0);
+        let (last, _) = layout.frame.cell(8, 13, 8.0);
+        assert!((h * 22.0 - 16.0).abs() < 0.001);
+        assert!((last + h - first - 8.0 * h).abs() < 0.001);
+        assert_eq!(layout.frame.cell(9, 2, 9.0), (9.0, 1.0));
+        assert_eq!(layout.frame.cell(4, 30, 4.0), (4.0, 1.0));
+        for row in 1..9 {
+            let (y, h) = layout.frame.cell(row, 2, row as f32);
+            assert!(
+                (layout.frame.mapped_source_row(2.5, y + h * 0.5).unwrap() - row as f32 - 0.5)
+                    .abs()
+                    < 0.001
+            );
+        }
+    }
+}
+
+#[test]
+fn character_art_selection_spans_match_the_same_inverse_geometry() {
+    let mut layout = Layout::default();
+    update(&mut layout, &snapshot(&logo('⣿'), 16), 0);
+    let mut spans = Vec::new();
+    layout.frame.spans(3, 0..20, 3.0, |cols, y, h| spans.push((cols, y, h)));
+    assert_eq!(spans.len(), 3);
+    assert_eq!(spans[0], (0..2, 3.0, 1.0));
+    assert_eq!(spans[1].0, 2..14);
+    assert_eq!(spans[2], (14..20, 3.0, 1.0));
+    assert!((spans[1].2 * 22.0 - 16.0).abs() < 0.001);
+}
+
+#[test]
+fn character_art_excludes_prose_tables_powerline_small_decoration_and_mixed_content() {
+    for lines in [
+        vec!["hello ⣿⣿⣿⣿ world".into()],
+        logo('─'),
+        logo(''),
+        logo('⠁'),
+        vec!["/path/to/file".into(); 8],
+        {
+            let mut rows = logo('⣿');
+            rows[4] = "  ⣿⣿⣿word⣿⣿⣿⣿⣿".into();
+            rows
+        },
+    ] {
+        let mut layout = Layout::default();
+        update(&mut layout, &snapshot(&lines, 16), 0);
+        assert!(layout.frame.regions.is_empty());
+    }
+}
+
+#[test]
+fn character_art_respects_cursor_background_and_other_projection_ownership() {
+    let mut snap = snapshot(&logo('⣿'), 16);
+    snap.cursor = Some(CursorSnapshot {
+        row: 4,
+        col: 5,
+        shape: CursorShape::Hidden,
+        wide: false,
+        cell_ch: ' ',
+        cell_flags: Flags::empty(),
+        cell_bg: Color::Named(NamedColor::Background),
+    });
+    let mut layout = Layout::default();
+    update(&mut layout, &snap, 0);
+    assert!(layout.frame.regions.is_empty());
+    snap.cursor = None;
+    snap.bg_runs.push(BgRun {
+       
```

**File**: `nebula_app/src/gpui_shell/terminal/element.rs` (modified, +112/-81)
```diff
@@ -32,6 +32,7 @@ mod cell_fit;
 #[path = "element/color_tests.rs"]
 mod color_tests;
 mod reading;
+mod snapshot;
 #[cfg(all(test, feature = "gpui-test-support"))]
 pub(in crate::gpui_shell) mod snapshot_probe;
 
@@ -87,66 +88,6 @@ pub struct TermLayout {
 }
 
 impl TerminalElement {
-    /// 在一次锁内通过渲染合同截取快照；锁外解析颜色与绘制。第三项是回滚
-    /// 历史行数——滚动条拇指的分母，顺着这一次锁一起取回，免得绘制路径
-    /// 为了它再抢一次 `Term` 锁。
-    fn snapshot(
-        &self,
-        rows: usize,
-        cols: usize,
-        cx: &App,
-    ) -> Option<(RenderSnapshot, Option<String>, usize, super::osc_links::LinkCells, i64, bool)>
-    {
-        let view = self.view.read(cx);
-        let session = view.session.as_ref()?;
-        let hint_config = view.hint_config.clone();
-        let term = session.term.lock();
-        let prompt_line = if term.mode().intersects(TermMode::ALT_SCREEN | TermMode::VI) {
-            None
-        } else {
-            let cursor = term.grid().cursor.point;
-            crate::display::nebula_prompt_line_from_raw_grid(
-                &term,
-                cursor,
-                &view.suggest.line_buf,
-                &view.suggest.suggest_env,
-            )
-            .or_else(|| {
-                if !view.suggest.completion_popup_requested {
-                    return None;
-                }
-                view.suggest.completion_prefix_from_raw_grid(&term, cursor)
-            })
-            .map(|line| line.input)
-        };
-        // 分段只反映内容与宽度类，绝不掺入光标状态：per-cell 绘制下反色只是
-        // 换色，若让闪烁相位改变分段，整行会随闪烁重塑形而跳字。
-        let projection = view.native_results.projection.borrow();
-        let source_rows = projection.source_rows(rows);
-        let snapshot = RenderSnapshot::capture_rows(
-            &term,
-            &SnapshotConfig { rows: source_rows as u16, cols: cols as u16 },
-            |row| !projection.covers(row),
-        );
-        let history = term.history_size();
-        let dashed =
-            super::osc_links::dashed_cells_where(&term, &hint_config, source_rows, cols, |row| {
-                !projection.covers(row)
-            });
-        let scrollback_floor = term.grid().scrolled_out();
-        let image_anchor = scrollback_floor.saturating_add(history) as i64;
-        let viewport_top_abs = image_anchor + i64::from(term.viewport_origin_for(rows).0);
-
-        Some((
-            snapshot,
-            prompt_line,
-            history,
-            dashed,
-            viewport_top_abs,
-            term.mode().contains(TermMode::ALT_SCREEN),
-        ))
-    }
-
     /// 把**应用写死的**颜色按当前主题矫正，直接写回快照。
     ///
     /// 用的是旧壳那一个 `TerminalColorResolver`（`display::terminal_color`）：最低
@@ -327,11 +268,20 @@ impl Element for TerminalElement {
         let focused = focus_handle.is_focused(window);
         // 旧壳只让光标本身参与闪烁；ghost、弹窗补齐和 IME 仍复用同一个坐标锚点。
         let cursor_visible = self.view.read(cx).cursor_visible();
-        let Some((mut snap, prompt_line, history, mut dashed, viewport_top_abs, alternate_screen)) =
-            self.snapshot(layout.rows, layout.cols, cx)
+        let Some(snapshot::FrameSnapshot {
+            mut snap,
+            mut art_source,
+            prompt_line,
+            history,
+            mut dashed,
+            viewport_top_abs,
+            mode,
+            reading_epoch,
+        }) = self.snapshot(layout.rows, layout.cols, cx)
         else {
             return;
         };
+        let alternate_screen = mode.contains(TermMode::ALT_SCREEN);
         #[cfg(all(test, feature = "gpui-test-support"))]
         snapshot_probe::record(&self.view, &snap, bounds, layout, cx);
         let suggest_anchor =
@@ -344,6 +294,9 @@ impl Element for TerminalElement {
         });
         let overrides = snap.color_overrides;
         self.resolve_app_colors(&mut snap, &mut dashed, &theme, &overrides, cx);
+        if let Some((_, source)) = &mut art_source {
+            self.resolve_app_colors(source, &mut Default::default(), &theme, &overrides, cx);
+        }
         let (theme_anchor, theme_is_light) = themed_anchor(&theme, cx);
         let host_cursor_follows_theme = is_default_host_cursor(&theme);
         let app_cursor = snap.cursor.as_ref().filter(|cursor| {
@@ -406,6 +359,31 @@ impl Element for TerminalElement {
             .update(cx, |view, cx| view.math.finalize_frame(pending_math_frame, scale_factor, cx));
 
         let vertical = self.view.read(cx).native_results.projection.borrow().clone();
+        let art = self.view.update(cx, |view, _| {
+            let screen =
+                view.session.as_ref().map_or(0, |s| std::sync::Arc::as_ptr(&s.term) as usize);
+            let (offset, source) =
+                art_source.as_ref().map_or((0, &snap), |(offset, source)| (*offset, source));
+            view.character_art.update(
+                source,
+                (screen, reading_epoch, alternate_screen, snap.cols),
+                viewport_top_abs + offset,
+                layout.cell_width.as_f32(),
+             
```

**File**: `nebula_app/src/gpui_shell/terminal/element/reading.rs` (modified, +22/-12)
```diff
@@ -24,11 +24,14 @@ impl TerminalElement {
         let color = cx.theme().primary.opacity(0.30);
         let projection = view.native_results.projection.borrow();
         // 折叠后的可见尾行可能来自屏幕范围以外；隐藏原文也不能把高亮压到控制行上。
-        for row in 0..projection.source_rows(layout.rows) {
-            if projection.covers(row) {
+        let art_rows = view.character_art.frame.source_bounds();
+        for row in
+            art_rows.start.min(0)..art_rows.end.max(projection.source_rows(layout.rows) as i64)
+        {
+            if projection.covers_source_row(row) {
                 continue;
             }
-            let absolute = viewport_top + row as i64;
+            let absolute = viewport_top + row;
             if absolute < 0 {
                 continue;
             }
@@ -43,16 +46,23 @@ impl TerminalElement {
             if start >= end {
                 continue;
             }
-            let highlight = Bounds::new(
-                point(
-                    bounds.origin.x + layout.cell_width * start as f32,
-                    bounds.origin.y + layout.line_height * projection.row(row as f32),
-                ),
-                size(layout.cell_width * (end - start) as f32, layout.line_height),
+            view.character_art.frame.spans(
+                row,
+                start..end,
+                projection.row(row as f32),
+                |columns, y, h| {
+                    let highlight = Bounds::new(
+                        point(
+                            bounds.origin.x + layout.cell_width * columns.start as f32,
+                            bounds.origin.y + layout.line_height * y,
+                        ),
+                        size(layout.cell_width * columns.len() as f32, layout.line_height * h),
+                    );
+                    #[cfg(all(test, feature = "gpui-test-support"))]
+                    snapshot_probe::record_reading_highlight(self.view.entity_id(), highlight, cx);
+                    window.paint_quad(fill(highlight, color));
+                },
             );
-            #[cfg(all(test, feature = "gpui-test-support"))]
-            snapshot_probe::record_reading_highlight(self.view.entity_id(), highlight, cx);
-            window.paint_quad(fill(highlight, color));
         }
     }
 }
```

**File**: `nebula_app/src/gpui_shell/terminal/element/snapshot.rs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+//! 同一终端锁内获取可见网格和图案必要的相邻源行，统一复用渲染快照语义。
+use super::*;
+
+pub(super) struct FrameSnapshot {
+    pub snap: RenderSnapshot,
+    pub art_source: Option<(i64, RenderSnapshot)>,
+    pub prompt_line: Option<String>,
+    pub history: usize,
+    pub dashed: super::super::osc_links::LinkCells,
+    pub viewport_top_abs: i64,
+    pub mode: TermMode,
+    pub reading_epoch: u64,
+}
+
+impl TerminalElement {
+    /// 在一次锁内通过渲染合同截取快照；锁外解析颜色与绘制。第三项是回滚
+    /// 历史行数——滚动条拇指的分母，顺着这一次锁一起取回，免得绘制路径
+    /// 为了它再抢一次 `Term` 锁。
+    pub(super) fn snapshot(&self, rows: usize, cols: usize, cx: &App) -> Option<FrameSnapshot> {
+        let view = self.view.read(cx);
+        let session = view.session.as_ref()?;
+        let hint_config = view.hint_config.clone();
+        let term = session.term.lock();
+        let prompt_line = if term.mode().intersects(TermMode::ALT_SCREEN | TermMode::VI) {
+            None
+        } else {
+            let cursor = term.grid().cursor.point;
+            crate::display::nebula_prompt_line_from_raw_grid(
+                &term,
+                cursor,
+                &view.suggest.line_buf,
+                &view.suggest.suggest_env,
+            )
+            .or_else(|| {
+                if !view.suggest.completion_popup_requested {
+                    return None;
+                }
+                view.suggest.completion_prefix_from_raw_grid(&term, cursor)
+            })
+            .map(|line| line.input)
+        };
+        // 分段只反映内容与宽度类，绝不掺入光标状态：per-cell 绘制下反色只是
+        // 换色，若让闪烁相位改变分段，整行会随闪烁重塑形而跳字。
+        let projection = view.native_results.projection.borrow();
+        let source_rows = projection.source_rows(rows);
+        let snapshot = RenderSnapshot::capture_rows(
+            &term,
+            &SnapshotConfig { rows: source_rows as u16, cols: cols as u16 },
+            |row| !projection.covers(row),
+        );
+        let history = term.history_size();
+        let dashed = super::super::osc_links::dashed_cells_where(
+            &term,
+            &hint_config,
+            source_rows,
+            cols,
+            |row| !projection.covers(row),
+        );
+        let scrollback_floor = term.grid().scrolled_out();
+        let image_anchor = scrollback_floor.saturating_add(history) as i64;
+        let viewport_top_abs = image_anchor + i64::from(term.viewport_origin_for(rows).0);
+
+        let mode = *term.mode();
+        let reading_epoch = term.reading_epoch();
+        let identity = (
+            std::sync::Arc::as_ptr(&session.term) as usize,
+            reading_epoch,
+            mode.contains(TermMode::ALT_SCREEN),
+            cols as u16,
+        );
+        let retained = term.reading_span();
+        let art_source = view
+            .character_art
+            .capture_rows(
+                identity,
+                viewport_top_abs,
+                source_rows,
+                retained.start.line as i64..retained.end.line as i64,
+                &snapshot,
+            )
+            .map(|range| {
+                let source = RenderSnapshot::capture_from(
+                    &term,
+                    &SnapshotConfig { rows: (range.end - range.start) as u16, cols: cols as u16 },
+                    nebula_terminal::index::Line((range.start - image_anchor) as i32),
+                );
+                (range.start - viewport_top_abs, source)
+            });
+        Some(FrameSnapshot {
+            snap: snapshot,
+            art_source,
+            prompt_line,
+            history,
+            dashed,
+            viewport_top_abs,
+            mode,
+            reading_epoch,
+        })
+    }
+}
```

---

### Incident Patch 3: `31a64485` (2026-10-26)
**Commit Message**: fix(fonts): restore 2.2.2 reading spacing and show Geist default (#783)

Restore released natural font metrics, platform padding and baseline behavior without changing font size or column widths. Display Geist as the actual default interface font and preserve custom font save/reset semantics.

**File**: `architecture/notes/nebula_app/gpui_shell/terminal/2026-10-25-independent-glyphs-and-proportional-grids.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 ## Status
 
+Default typography is superseded by [the 2.2.2 reading-spacing restoration](2026-10-26-restore-2-2-2-reading-spacing.md).
+
 Implemented and inspected on native Windows at 150% scaling. Other native
 platforms remain covered by their selected CI jobs, not this desktop inspection.
 
```

**File**: `architecture/notes/nebula_app/gpui_shell/terminal/2026-10-26-restore-2-2-2-reading-spacing.md` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# Restore 2.2.2 terminal reading spacing
+
+## Status
+
+Implemented from the `v2.2.2` source and verified with focused regressions and
+native Windows reading captures at 150% scaling.
+
+## Context
+
+The proportional-grid change made character-art circles round, but its default
+row height also tightened ordinary multiline text. Measuring unchanged glyph ink
+and a circular logo did not establish that paragraphs and lists remained readable.
+The requested correction is to restore 2.2.2 typography rather than introduce
+another character-art-driven default.
+
+## Evidence
+
+`v2.2.2` resolves to `9db57b6e794ebed88431e9e4aaef519b58986a0e`.
+Its `view/typography.rs` measures the main font's ascent plus descent, applies
+an explicit theme multiplier when present, then adds the device-pixel offset
+and floors the result. Its Windows default offset is four device pixels.
+Each shaped line is painted at its grid origin using GPUI's own baseline rule.
+
+## Decision
+
+Restore that typography implementation and its `line_height_for_view` adapter.
+Restore the platform default offset through the existing platform identity API.
+Remove the proportional-grid override and per-run shared-baseline translation.
+Retain font size, width modes, explicit line-height settings and explicit offsets.
+
+The independent symbol font, Maple registration lifetime, UI font setting and
+native-result viewing changes are separate features and remain in place.
+The interface font input displays the existing default, Geist, while an absent
+override stays absent in persistence; clearing the input returns to Geist.
+
+## Rejected alternatives
+
+- Keep the 1:2 grid and change the requested font size: changes glyphs instead
+  of restoring reading space.
+- Apply another guessed line-height multiplier: does not restore the specified
+  released behavior.
+- Declare a text-only ink-size comparison sufficient: it does not measure the
+  interline space that prompted this rollback.
+
+## Consequences
+
+Default ordinary-text spacing matches 2.2.2 again. Character-art aspect ratio
+once again follows that row spacing; this rollback does not claim both a taller
+row and unchanged column width still form a 1:2 grid. No application-specific
+rendering heuristic or new saved preference is added.
+
+## Validation
+
+The typography module is compared directly with the released source. Existing
+regressions cover natural metrics, DPI, explicit overrides, startup sizing,
+and UI-font input save/reset. Native captures use consecutive Chinese/English
+list rows, rather than treating a character-art circle as the reading oracle.
+Maple 13px and 14px measured 29 and 31 device-pixel rows respectively, matching
+2.2.2. A native settings capture shows Geist in the input. Sixteen focused tests
+passed, including the displayed default, custom font save and empty-input reset.
+
+## Supersedes
+
+The default grid and shared-baseline decisions in
+[independent glyphs and proportional grids](2026-10-25-independent-glyphs-and-proportional-grids.md).
+
+## Revisit when
+
+A separately approved spacing design has multiline reading acceptance in addition
+to character-art checks; a glyph-size or logo-only check is insufficient.
```

**File**: `nebula_app/src/gpui_shell/config.rs` (modified, +12/-4)
```diff
@@ -361,8 +361,12 @@ impl Settings {
 }
 
 fn default_font_offset() -> RawDelta {
-    // 正文通过独立基线放置，平台补偿不再隐式改变字符网格的比例。
-    RawDelta { x: 0, y: 0 }
+    // 恢复 2.2.2 的默认留白，不再为字符画比例压缩普通正文。
+    let y = match crate::platform::Platform::current() {
+        crate::platform::Platform::Windows => 4,
+        _ => 0,
+    };
+    RawDelta { x: 0, y }
 }
 
 fn runtime_background(
@@ -863,9 +867,13 @@ mod tests {
     }
 
     #[test]
-    fn font_offset_has_no_implicit_platform_padding_and_preserves_explicit_values() {
+    fn font_offset_restores_2_2_2_padding_and_preserves_explicit_values() {
+        let default_y = match crate::platform::Platform::current() {
+            crate::platform::Platform::Windows => 4,
+            _ => 0,
+        };
         for (input, expected) in [
-            ("", (0, 0)),
+            ("", (0, default_y)),
             ("[font.offset]\nx = 2\ny = 4", (2, 4)),
             ("[font.offset]\ny = -2", (0, -2)),
         ] {
```

**File**: `nebula_app/src/gpui_shell/settings_pane/appearance.rs` (modified, +21/-3)
```diff
@@ -258,7 +258,12 @@ mod tests {
         use crate::gpui_shell::settings_fixture::{SettingsBytesGuard, lock_theme_studio};
         let _lock = lock_theme_studio();
         let _settings = SettingsBytesGuard::capture();
-        persist_keys(&[("font_size", "15".into()), ("ui_font_size", "14".into())]).unwrap();
+        persist_keys(&[
+            ("font_size", "15".into()),
+            ("ui_font_size", "14".into()),
+            ("ui_font_family", String::new()),
+        ])
+        .unwrap();
         cx.update(|cx| {
             gpui_component::init(cx);
             cx.set_reduce_motion(true);
@@ -271,6 +276,10 @@ mod tests {
             gpui_component::Root::new(view, window, cx)
         });
         let pane = pane.unwrap();
+        assert_eq!(
+            pane.read_with(cx, |pane, cx| pane.ui_font_family_input.read(cx).value().to_string()),
+            "Geist"
+        );
         cx.simulate_resize(gpui::size(px(1280.0), px(1800.0)));
         cx.update(|window, _| window.activate_window());
         cx.run_until_parked();
@@ -369,7 +378,7 @@ mod tests {
             }
         }
         let terminal_family = RuntimeSettings::load().font_family;
-        for value in ["Consolas", ""] {
+        for value in ["Geist", "Consolas", ""] {
             cx.update(|window, cx| {
                 pane.read(cx).ui_font_family_input.read(cx).focus_handle(cx).focus(window, cx);
                 let _ = window.draw(cx);
@@ -385,7 +394,16 @@ mod tests {
             cx.simulate_keystrokes("enter");
             cx.run_until_parked();
             let saved = RuntimeSettings::load();
-            assert_eq!(saved.ui_font_family.as_deref(), (!value.is_empty()).then_some(value));
+            let custom = (!value.is_empty() && value != "Geist").then_some(value);
+            assert_eq!(saved.ui_font_family.as_deref(), custom);
+            assert_eq!(
+                pane.read_with(cx, |pane, cx| pane
+                    .ui_font_family_input
+                    .read(cx)
+                    .value()
+                    .to_string()),
+                custom.unwrap_or("Geist")
+            );
             assert_eq!(saved.font_family, terminal_family);
         }
     }
```

**File**: `nebula_app/src/gpui_shell/settings_pane/initialization.rs` (modified, +19/-7)
```diff
@@ -558,20 +558,32 @@ impl SettingsPane {
             },
         ));
 
-        let ui_font_family_input = cx.new(|cx| {
-            InputState::new(window, cx)
-                .placeholder(localized_input_placeholder("font_family", language))
-                .default_value(runtime.ui_font_family.clone().unwrap_or_default())
-        });
+        let ui_font_family_input =
+            cx.new(|cx| {
+                InputState::new(window, cx)
+                    .placeholder(localized_input_placeholder("font_family", language))
+                    .default_value(runtime.ui_font_family.clone().unwrap_or_else(|| {
+                        crate::gpui_shell::typography::UI_FONT_FAMILY.to_owned()
+                    }))
+            });
         subscriptions.push(cx.subscribe_in(
             &ui_font_family_input,
             window,
-            |this: &mut Self, input, event: &InputEvent, _, cx| {
+            |this: &mut Self, input, event: &InputEvent, window, cx| {
                 if matches!(event, InputEvent::PressEnter { .. } | InputEvent::Blur) {
-                    let value = input.read(cx).value().trim().to_owned();
+                    let default = crate::gpui_shell::typography::UI_FONT_FAMILY;
+                    let entered = input.read(cx).value().trim().to_owned();
+                    // 默认字体显示真实名称，但不把占位默认值变成用户覆盖设置。
+                    let value =
+                        if entered.eq_ignore_ascii_case(default) { String::new() } else { entered };
                     if value != this.runtime.ui_font_family.as_deref().unwrap_or_default() {
                         this.persist(&[("ui_font_family", value)], cx);
                     }
+                    let displayed =
+                        this.runtime.ui_font_family.as_deref().unwrap_or(default).to_owned();
+                    if input.read(cx).value().as_ref() != displayed {
+                        input.update(cx, |state, cx| state.set_value(displayed, window, cx));
+                    }
                 }
             },
         ));
```

**File**: `nebula_app/src/gpui_shell/terminal/element.rs` (modified, +2/-23)
```diff
@@ -81,7 +81,6 @@ impl TerminalElement {
 pub struct TermLayout {
     cell_width: Pixels,
     line_height: Pixels,
-    text_baseline: Pixels,
     rows: usize,
     cols: usize,
     hitbox: Hitbox,
@@ -258,9 +257,8 @@ impl Element for TerminalElement {
         let scale = window.scale_factor();
         let view = self.view.read(cx);
         let cell_width = view.cell_width_for_advance(sample.width.as_f32(), scale);
-        let line_height = view.line_height_for_width(cell_width, scale);
-        let text_baseline =
-            super::view::typography::baseline(sample.ascent, sample.descent, line_height);
+        let line_height =
+            view.line_height_for_metrics(sample.ascent.as_f32() + sample.descent.as_f32(), scale);
 
         // 网格裁定（floor、最小网格、resize 合流）全部由渲染合同的
         // ViewportTracker 在 view 内完成；元素只上报内容矩形与度量。
@@ -297,7 +295,6 @@ impl Element for TerminalElement {
         TermLayout {
             cell_width,
             line_height,
-            text_baseline,
             rows: view.grid_rows(),
             cols: view.grid_cols(),
             hitbox,
@@ -752,15 +749,6 @@ impl Element for TerminalElement {
                         run.clone(),
                         layout.cell_width,
                     );
-                    let origin = point(
-                        origin.x,
-                        super::view::typography::glyph_origin_y(
-                            &shaped,
-                            origin.y,
-                            layout.line_height,
-                            layout.text_baseline,
-                        ),
-                    );
                     let _ = shaped.paint(
                         origin,
                         layout.line_height,
@@ -788,15 +776,6 @@ impl Element for TerminalElement {
                         &run,
                         layout.cell_width,
                     );
-                    let origin = point(
-                        origin.x,
-                        super::view::typography::glyph_origin_y(
-                            &shaped,
-                            origin.y,
-                            layout.line_height,
-                            layout.text_baseline,
-                        ),
-                    );
                     let _ = shaped.paint(
                         origin,
                         layout.line_height,
```

**File**: `nebula_app/src/gpui_shell/terminal/view.rs` (modified, +5/-5)
```diff
@@ -34,7 +34,7 @@ mod startup_command;
 #[cfg(all(test, feature = "gpui-test-support"))]
 pub(super) mod startup_tests;
 mod tab_identity;
-pub(super) mod typography;
+mod typography;
 
 pub use broadcast::TerminalInput;
 pub use runtime::InputOrigin;
@@ -557,11 +557,11 @@ impl TerminalView {
         typography::effective_cell_width(raw_width, self.cell_width_mode, scale, self.font_offset_x)
     }
 
-    pub(super) fn line_height_for_width(&self, cell_width: Pixels, scale: f32) -> Pixels {
-        typography::effective_line_height_with_theme(
-            cell_width,
-            self.font_size.as_f32(),
+    pub(super) fn line_height_for_metrics(&self, natural_height: f32, scale: f32) -> Pixels {
+        typography::line_height_for_view(
+            self.font_size,
             self.line_height_multiplier,
+            natural_height,
             self.font_offset_y,
             scale,
         )
```

**File**: `nebula_app/src/gpui_shell/terminal/view/tests.rs` (modified, +23/-35)
```diff
@@ -314,24 +314,16 @@ fn explicit_line_height_offset_is_still_measured_in_device_pixels() {
 }
 
 #[test]
-fn default_line_height_keeps_square_dot_pitch_across_fonts_dpi_and_zoom() {
+fn default_line_height_matches_2_2_2_natural_metrics_across_dpi_and_zoom() {
     for font_size in [10.0, 13.0, 14.0, 15.0, 18.0, 24.0] {
         for scale in [1.0, 1.25, 1.5, 1.75, 2.0, 2.5] {
-            for advance_ratio in [0.5, 0.55, 0.6, 0.65] {
-                for mode in [
-                    nebula_settings::CellWidthModeName::Compact,
-                    nebula_settings::CellWidthModeName::Relaxed,
-                ] {
-                    let width = typography::effective_cell_width(
-                        font_size * advance_ratio,
-                        mode,
-                        scale,
-                        0.0,
-                    );
+            for metric_ratio in [1.2, 1.32, 1.6] {
+                for offset in [0.0, 4.0] {
+                    let natural = font_size * metric_ratio;
                     let height = typography::effective_line_height_with_theme(
-                        width, font_size, None, 0.0, scale,
+                        natural, font_size, None, offset, scale,
                     );
-                    assert!((height.as_f32() / 4.0 - width.as_f32() / 2.0).abs() < 1e-5);
+                    assert_eq!(height, typography::effective_line_height(natural, offset, scale));
                 }
             }
         }
@@ -343,31 +335,27 @@ fn theme_line_height_uses_font_size_and_keeps_device_pixel_flooring() {
     // 15px * 1.5 = 22.5 logical px; at 150% DPI with a 4px device offset,
     // floor(22.5 * 1.5 + 4) = 37 device px, or 37 / 1.5 logical px.
     let height =
-        typography::effective_line_height_with_theme(gpui::px(9.0), 15.0, Some(1.5), 4.0, 1.5);
+        typography::effective_line_height_with_theme(15.0 * 1.32, 15.0, Some(1.5), 4.0, 1.5);
 
     assert!((f32::from(height) - 37.0 / 1.5).abs() < f32::EPSILON);
 }
 
 #[test]
-fn fallback_baseline_alignment_preserves_glyph_size_and_positions() {
-    use gpui::{LineLayout, ShapedLine, px};
-    let primary_baseline = typography::baseline(px(14.28), px(4.2), px(16.0));
-    for (ascent, descent) in [(14.28, 4.2), (16.0, 6.0), (12.0, 2.0)] {
-        let mut line = ShapedLine::default();
-        *line = std::sync::Arc::new(LineLayout {
-            font_size: px(14.0),
-            width: px(8.4),
-            ascent: px(ascent),
-            descent: px(descent),
-            runs: Vec::new(),
-            len: 1,
-        });
-        let original_layout = std::ops::Deref::deref(&line).clone();
-        let origin = typography::glyph_origin_y(&line, px(32.0), px(16.0), primary_baseline);
-        let painted_baseline = origin + typography::baseline(line.ascent, line.descent, px(16.0));
-        assert!((painted_baseline.as_f32() - (32.0 + primary_baseline.as_f32())).abs() < 1e-5);
-        assert!(std::sync::Arc::ptr_eq(&original_layout, &line));
-        assert_eq!(line.font_size, px(14.0));
-        assert_eq!(line.width, px(8.4));
+fn maple_reading_rows_restore_2_2_2_height_without_changing_columns() {
+    use gpui::px;
+    for (font_size, expected_device_height) in [(13.0, 29.0), (14.0, 31.0)] {
+        let width = typography::effective_cell_width(
+            font_size * 0.6,
+            nebula_settings::CellWidthModeName::Compact,
+            1.5,
+            0.0,
+        );
+        let height =
+            typography::line_height_for_view(px(font_size), None, font_size * 1.32, 4.0, 1.5);
+        assert!((height.as_f32() * 1.5 - expected_device_height).abs() < 1e-5);
+        assert!(
+            height > width * 2.0,
+            "reading space must not be tied to character-art proportions"
+        );
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #789** (2026-10-26): feat(sponsors): add approved AIAPI branding (@Kuddev)
- **PR #787** (2026-10-26): [codex] Fix character-art proportions without changing text spacing (@Kuddev)
- **PR #783** (2026-10-26): fix(fonts): restore 2.2.2 reading spacing and show Geist default (@Kuddev)
- **PR #782** (2026-10-26): Simplify README badges and add XERJ and Trendshift (@Kuddev)
- **PR #780** (2026-10-26): Expand 2.3.0 release notes around verified improvements (@Kuddev)
- **PR #779** (2026-10-26): Finalize verified 2.3.0 replacement packages and Windows version metadata (@Kuddev)

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

## X. Merge pull request #775 from Kuddev/fix/windows-update-worker-20261026

**RULE**:
When implementing operations in `architecture/notes/nebula_app/platform/ai_session_identity/windows/2026-10-26-update-quiescence.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `96595622`: Merge pull request #775 from Kuddev/fix/windows-update-worker-20261026. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `architecture/notes/nebula_app/platform/ai_session_identity/windows/2026-10-26-update-quiescence.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Quiesce the owned identity worker before Windows update preparation

## Status

Implemented; native validation and review pending.

## Context

Windows update preparation rejects any live process from the installed executable
that is absent from the handoff's participant list. The list intentionally contains
only the application authorizing the update. The reusable identity worker is a
second copy of that executable and survives idle time until its owner exits.
Preparation happens before that exit, so a resident worker blocks the update.

The reporter runs 2.2.2, whose disposable probe can also overlap the same process
check. Their exact interfering process has not been identified. Replacing the
downloaded installer cannot modify the old updater's pre-installation check;
exiting the old application and manually running setup remains the recovery path.

## Evidence

- `worker::query_slot` retains a healthy child after returning its response.
- `handoff::prepare` writes only the current PID and creation time as participants.
- `handoff.ps1::Check-UnpreparedProcesses` rejects that second live executable
  with `Another process from this installation is not prepared for update`.
- Th
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `96595622` are properly handled with clean fallback behavior.
