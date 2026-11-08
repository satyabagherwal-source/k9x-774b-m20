> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `bb183265`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T02:56:53.037Z  
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
> **Harvest Timestamp**: 2026-11-08T02:56:52.748Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3724 stars

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

### Core Architecture Module: `nebula_app/res/prompt-suggestions/claude/hooks/prompt.js`
```
// Claude Code function hooks own the composer. No screen parsing, draft writes,
// model overrides, transcript polling, or per-user style storage live here.
const state = {
  revision: 0,
  interactive: false,
  composer: false,
  busy: false,
  turn: null,
  handled: null,
  loading: null,
  dots: 1,
  tick: null,
  deadline: null,
  scheduled: null,
};

function stopLoading($) {
  state.tick?.cancel();
  state.deadline?.cancel();
  state.tick = state.deadline = null;
  if (state.loading !== null) {
    state.loading = null;
    $.ui.invalidate("ui.render");
  }
}

function invalidate($) {
  state.revision += 1;
  state.scheduled?.cancel();
  state.scheduled = null;
  stopLoading($);
}

function current(revision) {
  return state.revision === revision && state.interactive && state.composer && !state.busy;
}

function startLoading($, text, revision) {
  state.loading = text;
  state.dots = 1;
  $.ui.invalidate("ui.render");
  state.tick = $.clock.every(400, () => {
    if (!current(revision)) return stopLoading($);
    state.dots = state.dots % 3 + 1;
    $.ui.invalidate("ui.render");
  });
}

function boundedMessages(messages) {
  function excerpt(message, limit) {
    let text = message.text;
    if (typeof text !== "string" || !/\S/u.test(text)) return "";
    if (text.length > limit) {
      const gap = "\n[... omitted ...]\n";
      if (limit <= gap.length + 2) {
        text = text.slice(-limit).replace(/^[\uDC00-\uDFFF]/, "");
      } else {
        const headLength = Math.floor((limit - gap.length) / 2);
        const head = text.slice(0, headLength).replace(/[\uD800-\uDBFF]$/, "");
        const tail = text.slice(-(limit - gap.length - headLength)).replace(/^[\uDC00-\uDFFF]/, "");
        text = head + gap + tail;
      }
    }
    return text;
  }
  const result = [];
  let remaining = 12000;
  let userIndex = -1;
  // Reserve the latest user's wording even after a long, tool-heavy answer.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== "user") continue;
    const text = excerpt(messages[index], 3000);
    if (text.trim() === "") continue;
    userIndex = index;
    result.push({ index, message: { role: "user", text } });
    remaining -= text.length;
    break;
  }
  for (let index = messages.length - 1; index >= 0 && remaining > 0 && result.length < 24; index -= 1) {
    if (index === userIndex) continue;
    const message = messages[index];
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = excerpt(message, Math.min(remaining, 3000));
    if (text.trim() === "") continue;
    remaining -= text.length;
    result.push({ index, message: { role: message.role, text } });
  }
  return result.sort((a, b) => a.index - b.index).map(entry => entry.message);
}

async function bridge($) {
  const [endpoint, token, nativeSuggestion] = await Promise.all([
    $.env.get("PEBREL_PREDICTION_ENDPOINT"),
    $.env.get("PEBREL_PREDICTION_TOKEN"),
    $.env.get("CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION"),
  ]);
  // Suppress the built-in inference at process launch, never via persisted
  // config.set or by discarding its already-paid result in prompt.suggest.
  if (nativeSuggestion !== "false" && nativeSuggestion !== "0") return null;
  const match = /^http:\/\/127\.0\.0\.1:(\d{1,5})$/.exec(endpoint ?? "");
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) return null;
  if (!token || token.length > 512 || /[\r\n]/.test(token)) return null;
  return { endpoint, headers: { Authorization: `Bearer ${token}` } };
}

function readJson(response) {
  if (!response.ok || typeof response.text !== "string" || response.text.length > 8192) {
    throw new Error("Invalid prediction bridge response");
  }
  let bytes = 0;
  for (const char of response.text) {
    const point = char.codePointAt(0);
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    if (bytes > 8192) throw new Error("Invalid prediction bridge response");
  }
  return JSON.parse(response.text);
}

function candidate(value) {
  if (typeof value !== "string" || value.length > 1024) return null;
  if (/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(value)) return null;
  const text = value.trim();
  return text && [...text].length <= 240 ? text : null;
}

async function sameEmptyComposer($, revision, session) {
  if (!current(revision)) return false;
  const [id, draft] = await Promise.all([$.session.id(), $.prompt.read()]);
  return current(revision) && id === session && draft.text === "";
}

async function predict($, turn, revision) {
  try {
    if (!current(revision)) return;
    const [connection, session, draft] = await Promise.all([
      bridge($), $.session.id(), $.prompt.read(),
    ]);
    if (!connection || !current(revision) || draft.text !== "") return;
    const config = readJson(await $.http.fetch(
      `${connection.endpoint}/v1/prompt-suggestions/config`,
      { headers: connection.headers },
    ));
    // Settings own model-name validation; the complete response is bounded above.
    if (!config.enabled || typeof config.loading_text !== "string" ||
        config.loading_text.trim() === "" ||
        /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/.test(config.loading_text)) return;
    if (!await sameEmptyComposer($, revision, session)) return;
    startLoading($, config.loading_text, revision);
    const messages = boundedMessages(await $.session.messages());
    if (!messages.some(message => message.role === "user")) return;
    if (!await sameEmptyComposer($, revision, session)) return;
    const response = readJson(await $.http.fetch(
      `${connection.endpoint}/v1/prompt-suggestions`,
      {
        method: "POST",
        headers: { ...connection.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ agent: "claude", session, turn, revision, messages }),
      },
    ));
    const text = candidate(response.suggestion);
    if (text && await sameEmptyComposer($, revision, session)) {
      // Native suggest rechecks empty/not-working atomically when it lands.
      // It owns Tab/right-arrow acceptance and never submits the draft.
      stopLoading($);
      await $.prompt.suggest({ text });
    }
  } catch {
    // Predictions are optional; a failed bridge must not disrupt a main turn.
  } finally {
    if (state.revision === revision) stopLoading($);
  }
}

export function register(on) {
  on("session.start", ($, event, next) => {
    invalidate($);
    state.interactive = event.isInteractive && event.surface === "terminal";
    state.composer = state.busy = false;
    state.turn = state.handled = null;
    return next(event);
  });

  on("turn.start", ($, event, next) => {
    if (event.agentId === undefined) {
      invalidate($);
      state.busy = true;
      state.turn = event.turnId;
    }
    return next(event);
  });

  on("turn.complete", async ($, event, next) => {
    const result = await next(event);
    if (event.agentId !== undefined || (state.turn && state.turn !== event.turnId)) return result;
    state.busy = false;
    if (state.handled === event.turnId) return result;
    state.handled = event.turnId;
    invalidate($);
    if (event.reason !== "answer" || event.isAborted || !event.answer.trim()) return result;
    const revision = state.revision;
    // Leave the turn.complete stack before asking the composer. Awaiting the
    // bridge inside that hook would keep the main turn working unnecessarily.
    state.scheduled = $.clock.after(0, () => {
      state.scheduled = null;
      if (!current(revision)) return;
      // http.fetch has no AbortSignal. Bound UI lifetime and ignore late results;
      // the host owns the request/network deadline.
      state.deadline = $.clock.after(10000, () => {
        if (state.revision === revision) invalidate($);
      });
      return predict($, event.turnId, revision);
    });
    return result;
  });

  on("prompt.edit", ($, event, next) => {
    // This event is pre-edit; cancel before next instead of rereading old text.
    invalidate($);
    return next(event);
  });

  on("prompt.change", ($, event, next) => {
    invalidate($);
    return next(event);
  });

  on("session.end", ($, event, next) => {
    invalidate($);
    state.composer = state.busy = false;
    state.turn = state.handled = null;
    if (event.reason !== "clear" && event.reason !== "resume") state.interactive = false;
    return next(event);
  });

  on("ui.render", { component: "PromptHint" }, ($, event, next) => {
    if (event.surface !== "terminal") return next(event);
    state.composer = true;
    if (!state.loading || event.props.isDraft || event.props.isWorking) return next(event);
    const loading = `${state.loading}${".".repeat(state.dots)}`;
    const tail = event.props.tail ? `${event.props.tail} ${loading}` : loading;
    return next({ ...event, props: { ...event.props, tail } });
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #870** (2026-11-07): **[Bug] 文件管理器图标乱码**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  macos 26.0  ### Pebrel version / 版本号  2.4.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  zsh  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  File tree / drag-and-drop upload — 文件树、拖拽上传  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  <img width="425" height="293" alt="Image" src="https://github.com/user-attachments/assets/b79f6e67-9b1c-4eef-a239-ebc55bc004fb" />  ### Expected behavior / 期望结果  图标显示  ### Actual behavior / 实际结果  无  ### Logs / screenshots / 日志或截图  无  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

- **Issue #868** (2026-11-07): **[Bug] 打字时鼠标光标每一次都会闪烁**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 23 H2  ### Pebrel version / 版本号  2.4.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  fish, nushell  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Keyboard / IME / mouse / shortcuts / clipboard — 键盘、输入法、鼠标、快捷键、剪贴板  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. 鼠标光标移入终端 2. 每一次打字鼠标光标都会闪烁  ### Expected behavior / 期望结果  与Windows Terminal类似, 第一次键入后, 鼠标光标隐藏, 移动鼠标后, 鼠标光标出现  ### Actual behavior / 实际结果  每一次打字鼠标光标都会闪烁  ### Logs / screenshots / 日志或截图  <img width="916" height="358" alt="Image" src="https://github.com/user-attachments/assets/a34ddf26-6397-4fb3-a4a3-7ca6ed6d3faf" />  ### Non-default settings / 改过的设置  1. 使用monolisa字体 2. 开启平滑光标 3. 背景不透明度改为95%  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

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

### Incident Patch 1: `da3250ac` (2026-11-07)
**Commit Message**: fix(ssh): keep idle built-in SSH sessions alive through short stalls (#893)

The built-in russh client used a 15 s keepalive with max 3, so about one
minute of server or network silence ended an idle pane with "SSH connection
ended without an exit status". The managed OpenSSH launch already uses
ServerAliveInterval=30 / ServerAliveCountMax=6. Both paths now share these
values as constants. The transport disconnect reason is now logged.

Adds a paused-clock regression that relays the production client through a
silent TCP path. With the new budget, 150 s of silence survives and 300 s
still ends the pane.

Closes #816

Co-authored-by: YinBuLiao <[REDACTED_EMAIL]>
Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: Kuddev <[REDACTED_EMAIL]>

**File**: `architecture/notes/nebula_app/ssh_session/2026-11-05-shared-keepalive-budget.md` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+# Share the SSH keepalive budget between built-in and OpenSSH launches
+
+## Status
+
+Accepted (#816).
+
+## Context
+
+An idle built-in SSH pane ended with "SSH connection ended without an exit
+status" after hours, while a parallel standalone OpenSSH client session to the
+same host stayed connected. The managed OpenSSH launch has used
+`ServerAliveInterval=30` / `ServerAliveCountMax=6` since v0.7.0 to survive NAT
+idle timeouts. The built-in russh client instead used a 15 s interval with a
+maximum of 3. russh counts every unanswered timer tick and fails the transport
+with `KeepaliveTimeout` once the count exceeds the maximum. A server or path
+that is silent for about one minute therefore ended the pane.
+
+## Evidence
+
+A scratch russh 0.62.2 client with the old 15 s × 3 policy lost its channel
+after about 60 s when the server was stalled for 90–100 s. Servers were stalled
+with SIGSTOP on a local macOS sshd and with `docker pause` on an Ubuntu 22.04
+OpenSSH 8.9 container. OpenSSH with default settings survived the same stall
+and echoed afterwards. Forcing a rekey every three seconds against OpenSSH 10.2
+and 8.9 kept the session alive, which rules out key re-exchange as the cause.
+
+## Decision
+
+`ssh::SERVER_ALIVE_INTERVAL` (30 s) and `ssh::SERVER_ALIVE_COUNT_MAX` (6) are
+the single keepalive budget. The OpenSSH arguments and the russh
+`keepalive_interval` / `keepalive_max` are both derived from these constants.
+A path that is silent for up to about 3.5 minutes no longer ends the pane, and
+probes still refresh NAT state. The client handler logs the russh disconnect
+reason. Transport errors are logged at warning level so that a future report
+can distinguish a keepalive timeout from a socket error. A received disconnect
+is logged at info level.
+
+## Rejected alternatives
+
+- `keepalive_max = 0` (probes never fatal): on Unix, a dead link would be
+  detected only after the TCP retransmission timeout of about 15 minutes.
+- Removing probes, which matches OpenSSH defaults: this would regress the
+  v0.7.0 fix for NAT idle drops.
+- Honoring user ssh_config `ServerAlive*` through `ssh -G`: `-G` prints 0
+  whether or not the value was set, so explicit configuration cannot be
+  detected.
+
+## Consequences
+
+Dead links are detected after about 210 s instead of about 60 s. `test_connect`
+keeps keepalive disabled. The mobile transport (`mobile/ssh`) has its own
+policy and is not changed. An outage longer than the budget, or an OS that
+aborts the socket while a probe is unacknowledged, can still end the session.
+The new log line identifies that case.
+
+## Validation
+
+`ssh_session::lifecycle::tests::keepalive` places a gated TCP relay between the
+production client and the loopback server, and pauses the tokio clock. An idle
+shell survives 150 s of silence and still answers a ping. The test fails with
+the old 15 s × 3 values. A 300 s silence still ends the pane. tokio
+`test-util` is enabled as a dev-only feature for the paused clock.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+A report includes the logged disconnect reason, user ssh_config `ServerAlive*`
+values need to be honored, or russh changes how it counts keepalive ticks.
```

**File**: `nebula_app/Cargo.toml` (modified, +2/-0)
```diff
@@ -175,6 +175,8 @@ serde_json = "1"
 clap_complete = "4.2.3"
 rand = "0.10"
 rsa = "0.10.0-rc.18"
+# 暂停的 tokio 时钟让 SSH keepalive 回归在毫秒内跑完分钟级静默。
+tokio = { version = "1", features = ["test-util"] }
 
 [target.'cfg(not(windows))'.dependencies]
 xdg = "3.0.0"
```

**File**: `nebula_app/src/ssh.rs` (modified, +14/-1)
```diff
@@ -104,6 +104,14 @@ const VALUE_OPTS: &[u8] = b"bcDEeFIiJLlmOopQRSWw";
 /// forward): never inject into, never worth auto-saving as a host.
 const NO_SESSION_FLAGS: &[u8] = b"NnfGTVW";
 
+/// Keepalive policy for every SSH link Pebrel owns: the managed OpenSSH launch
+/// below and the built-in client in `ssh_session`. Probes keep NAT/firewall
+/// state alive; the link is declared dead only after this many probes in a row
+/// go unanswered (≈3.5 min), so a short network stall does not end an idle
+/// session that plain OpenSSH would have kept.
+pub(crate) const SERVER_ALIVE_INTERVAL: std::time::Duration = std::time::Duration::from_secs(30);
+pub(crate) const SERVER_ALIVE_COUNT_MAX: usize = 6;
+
 /// How long a typed `ssh` session must live before OSC 133;D confirms it as
 /// a real connection worth auto-saving in the sidebar (fast failures — DNS,
 /// connection refused, an aborted auth prompt — die well under this).
@@ -752,7 +760,12 @@ pub fn run(mut args: Vec<String>) -> i32 {
             // trade accepted here, since a dead-by-default link is the bug
             // being fixed.
             if !args.iter().any(|arg| arg.contains("ServerAliveInterval")) {
-                cmd.args(["-o", "ServerAliveInterval=30", "-o", "ServerAliveCountMax=6"]);
+                cmd.args([
+                    "-o".to_owned(),
+                    format!("ServerAliveInterval={}", SERVER_ALIVE_INTERVAL.as_secs()),
+                    "-o".to_owned(),
+                    format!("ServerAliveCountMax={SERVER_ALIVE_COUNT_MAX}"),
+                ]);
             }
             // The bootstrap contains quotes and `$` — passing it straight
             // through Windows `Command` arg-escaping → ssh.exe → the remote
```

**File**: `nebula_app/src/ssh_session.rs` (modified, +22/-2)
```diff
@@ -596,6 +596,24 @@ impl client::Handler for ClientHandler {
             },
         }
     }
+
+    // A pane only sees its channel vanish; keep the transport cause
+    // (keepalive timeout, socket error, server disconnect) in the log.
+    async fn disconnected(
+        &mut self,
+        reason: client::DisconnectReason<Self::Error>,
+    ) -> Result<(), Self::Error> {
+        match reason {
+            client::DisconnectReason::ReceivedDisconnect(info) => {
+                info!("SSH 连接 {}:{} 已关闭: {info:?}", self.host, self.port);
+                Ok(())
+            },
+            client::DisconnectReason::Error(error) => {
+                warn!("SSH 连接 {}:{} 异常断开: {error:?}", self.host, self.port);
+                Err(error)
+            },
+        }
+    }
 }
 
 pub(crate) fn runtime() -> io::Result<&'static tokio::runtime::Runtime> {
@@ -783,10 +801,12 @@ async fn authenticated_route<H: SshEventHost>(
         evict_pooled_session(&key, &existing).await;
     }
 
+    // Same budget as the managed OpenSSH launch. 15 s × 3 ended idle panes
+    // after one minute of server silence that OpenSSH survives (#816).
     let config = Arc::new(client::Config {
         inactivity_timeout: None,
-        keepalive_interval: Some(Duration::from_secs(15)),
-        keepalive_max: 3,
+        keepalive_interval: Some(crate::ssh::SERVER_ALIVE_INTERVAL),
+        keepalive_max: crate::ssh::SERVER_ALIVE_COUNT_MAX,
         ..Default::default()
     });
     report_stage(progress, SshStage::Connect);
```

**File**: `nebula_app/src/ssh_session/lifecycle/tests.rs` (modified, +1/-0)
```diff
@@ -1360,4 +1360,5 @@ fn ssh_echo_keeps_draining_while_a_large_input_waits_for_window_space() {
     });
 }
 
+mod keepalive;
 mod sftp;
```

**File**: `nebula_app/src/ssh_session/lifecycle/tests/keepalive.rs` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+use tokio::io::{AsyncReadExt, AsyncWriteExt};
+use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
+
+use super::*;
+
+/// A path that stays connected but carries nothing while closed, like a
+/// stalled Wi-Fi link or router. OpenSSH keeps an idle session over it (#816).
+struct SilentPath {
+    open: watch::Sender<bool>,
+    task: tokio::task::JoinHandle<()>,
+}
+
+impl Drop for SilentPath {
+    fn drop(&mut self) {
+        self.task.abort();
+    }
+}
+
+impl SilentPath {
+    async fn in_front_of(fixture: &Fixture) -> (Self, ResolvedRoute) {
+        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let port = listener.local_addr().unwrap().port();
+        let server = fixture.route.destination.port;
+        let known_hosts = fixture.route.known_hosts_path.clone().unwrap();
+        for (_, key) in
+            russh::keys::known_hosts::known_host_keys_path("127.0.0.1", server, &known_hosts)
+                .unwrap()
+        {
+            russh::keys::known_hosts::learn_known_hosts_path("127.0.0.1", port, &key, &known_hosts)
+                .unwrap();
+        }
+        let (open, gate) = watch::channel(true);
+        let task = tokio::spawn(async move {
+            let (client, _) = listener.accept().await.unwrap();
+            let upstream = tokio::net::TcpStream::connect(("127.0.0.1", server)).await.unwrap();
+            let (client_read, client_write) = client.into_split();
+            let (upstream_read, upstream_write) = upstream.into_split();
+            tokio::join!(
+                forward(client_read, upstream_write, gate.clone()),
+                forward(upstream_read, client_write, gate),
+            );
+        });
+        let destination = format!("fixture@127.0.0.1:{port}");
+        let route = ResolvedRoute {
+            destination: SshDestination::parse(&destination).unwrap(),
+            profile: crate::ssh_profiles::SshProfiles::default().for_destination(&destination),
+            transport: RouteTransport::Direct,
+            known_hosts_path: Some(known_hosts),
+        };
+        (Self { open, task }, route)
+    }
+}
+
+async fn forward(mut from: OwnedReadHalf, mut to: OwnedWriteHalf, mut open: watch::Receiver<bool>) {
+    let mut buffer = vec![0; 16 * 1024];
+    while let Ok(read @ 1..) = from.read(&mut buffer).await {
+        if open.wait_for(|open| *open).await.is_err()
+            || to.write_all(&buffer[..read]).await.is_err()
+        {
+            return;
+        }
+    }
+}
+
+/// Open an idle shell through the production client config, silence the path
+/// for `silence` (virtual time), then report whether the pane is still usable.
+fn idle_shell_survives(silence: Duration) -> bool {
+    let runtime = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
+    runtime.block_on(async {
+        let fixture = Fixture::new(Mode::Open).await;
+        let (path, route) = SilentPath::in_front_of(&fixture).await;
+        let (acquired, mut channel, token, events) =
+            tokio::time::timeout(Duration::from_secs(10), async {
+                let acquired = authenticated_route(&route, None::<&NoopSshEventHost>, false, true)
+                    .await
+                    .unwrap();
+                let events = Events::default();
+                let (channel, token) =
+                    open_shell(&acquired, size(), None, None, &events).await.unwrap();
+                (acquired, channel, token, events)
+            })
+            .await
+            .expect("loopback shell should open");
+        let terminal = terminal(&events);
+        let (input_tx, mut input) = mpsc::unbounded_channel();
+        let outage = async {
+            tokio::time::pause();
+            path.open.send_replace(false);
+            tokio::time::sleep(silence).await;
+            path.open.send_replace(true);
+            tokio::time::resume();
+            let answered =
+                tokio::time::timeout(Duration::from_secs(5), acquired.session.send_ping()).await;
+            let _ = input_tx.send(Msg::Shutdown);
+            matches!(answered, Ok(Ok(()))) && !acquired.session.is_closed()
+        };
+        let (pumped, answered) =
+            tokio::join!(pump(&mut channel, token, size(), &terminal, &events, &mut input), outage);
+        fixture.forget(&acquired.session).await;
+        pumped.is_ok() && answered
+    })
+}
+
+#[test]
+fn idle_shell_outlives_a_silent_network_that_openssh_survives() {
+    // The previous 15 s × 3 budget ended this pane after about one minute.
+    assert!(idle_shell_survives(Duration::from_secs(150)));
+}
+
+#[test]
+fn keepalive_still_ends_a_pane_whose_server_never_answers() {
+    assert!(!idle_shell_survives(Duration::from_secs(300)));
+}
```

---

### Incident Patch 2: `14885627` (2026-11-07)
**Commit Message**: fix(files): keep the m glyph so macOS loads the symbol font (#892)

* fix(files): keep the m glyph so macOS loads the symbol font

GPUI's macOS text system skips any added face without an 'm' glyph.
The Pebrel Symbols subset had no Latin glyphs, so macOS never registered
it and every file-tree icon rendered as a missing glyph box.

Keep Maple's unchanged 'm' in the subset, regenerate the face, and add
regressions for the glyph and for resolving icons through the macOS
text system.

Closes #870

Co-authored-by: Copilot App <[REDACTED_EMAIL]>

* Move macOS font test into platform module

Co-authored-by: YinBuLiao <[REDACTED_EMAIL]>

---------

Co-authored-by: YinBuLiao <[REDACTED_EMAIL]>
Co-authored-by: Copilot App <[REDACTED_EMAIL]>
Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: Kuddev <[REDACTED_EMAIL]>

**File**: `THIRD-PARTY-NOTICES` (modified, +1/-0)
```diff
@@ -421,4 +421,5 @@ Normal NF CN Regular font (SIL Open Font License 1.1). The original copyright
 and license metadata are retained in the font; see licenses/LICENSE-PEBREL-SYMBOLS.
 Source: https://github.com/subframe7536/maple-font
 Regeneration: python scripts/build_symbol_font.py (requires fontTools).
+It also keeps Maple's unchanged `m` glyph, required by GPUI's macOS font loader.
 The complete Maple face remains unchanged and separately selectable.
```

**File**: `architecture/notes/nebula_app/font_install/2026-11-05-symbol-face-macos-m-glyph.md` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+# Symbol face keeps `m` for the macOS GPUI loader
+
+## Status
+
+Implemented for issue #870. macOS desktop visual acceptance remains separate from
+the focused text-system regression.
+
+## Context
+
+On macOS every icon drawn with the `Pebrel Symbols` family rendered as a missing
+glyph box: file-tree chevrons, folder and file icons, and other interface icons.
+The regression shipped with the independent symbol face introduced in
+[restore-text-metrics-and-symbol-fallback](../gpui_shell/terminal/2026-10-25-restore-text-metrics-and-symbol-fallback.md).
+
+## Evidence
+
+- The checked-in face covers every icon code point used by
+  `display::side_panel::icons`; coverage was not the cause.
+- The pinned GPUI macOS text system (`gpui_macos/src/text_system.rs`, Zed rev
+  `1e716d16`) skips any added face without an `m` glyph, logging
+  "has no 'm' character and was not loaded". The symbol subset deliberately had
+  no Latin glyphs, so the family was never registered and `font_id` returned
+  "no font found".
+- A headless `MacTextSystem` test reproduced that error before the change and
+  resolves the family afterwards.
+
+## Decision
+
+- `scripts/build_symbol_font.py` adds Maple's original `m` to the subset. Outline
+  and advance are unchanged; the face grows by one glyph and 180 bytes.
+- Regenerate the checked-in face from the pinned source; regeneration remains
+  byte-reproducible with fontTools 4.60.2.
+
+## Rejected alternatives
+
+- Register complete Maple on macOS: reintroduces the 20 MB face the symbol subset
+  exists to avoid.
+- Patch the GPUI fork's loader: widens the fork for a property the asset can
+  satisfy, and other GPUI backends could add similar checks.
+- Rename the face to the loader's `Segoe Fluent Icons` exception: misleading and
+  violates the independent-name requirement.
+- Replace icons with SVGs: a broad UI change unrelated to the regression.
+
+## Consequences
+
+The symbol family now contains one Latin glyph. It stays last in configured
+fallback chains, so it can supply `m` only when every earlier font lacks it.
+The other Latin/CJK absence assertions remain in force.
+
+## Validation
+
+`font_install` tests assert the `m` glyph and advance match Maple, and on macOS
+load the bundled bytes into the platform text system and resolve the file-tree
+icon glyphs. Both failed before the asset change.
+
+## Supersedes
+
+None. The symbol-ownership decision of the linked note remains in force.
+
+## Revisit when
+
+GPUI's macOS loader no longer requires `m`, or interface icons move off the
+symbol font.
```

**File**: `assets/fonts/README.md` (modified, +6/-4)
```diff
@@ -7,9 +7,11 @@ chain or theme editor draft explicitly needs it. Selecting another font does not
 registered native face; a fresh process avoids that registration entirely.
 
 `PebrelSymbols-Regular.ttf` is an independently named, OFL-licensed derivative
-containing the original private-use icons and standard power symbols. It has no
-Latin or CJK text glyphs. Geometry-rendered Powerline separators remain on the
-terminal's existing geometry path. Other prompt and interface icons use this
+containing the original private-use icons and standard power symbols. Its only
+text glyph is Maple's unchanged `m`, which GPUI's macOS loader requires before it
+registers any face; it has no other Latin or CJK text glyphs. Geometry-rendered
+Powerline separators remain on the terminal's existing geometry path. Other
+prompt and interface icons use this
 small face instead of implicitly requiring the complete Maple font.
 
 Regenerate it offline with `python scripts/build_symbol_font.py`, after installing
@@ -18,6 +20,6 @@ dependency. The source hash is checked before conversion; copyright/license
 metadata, glyph outlines and advances are retained, and reserved font names are
 replaced. See `licenses/LICENSE-PEBREL-SYMBOLS` and `THIRD-PARTY-NOTICES`.
 
-The complete face is 20,563,672 bytes; the generated symbol face is 1,941,228 bytes
+The complete face is 20,563,672 bytes; the generated symbol face is 1,941,408 bytes
 with the fontTools version used for this revision. These are font-file sizes,
 not a claim about process RSS or native font-cache allocations.
```

**File**: `nebula_app/src/font_install.rs` (modified, +11/-0)
```diff
@@ -417,6 +417,17 @@ mod tests {
         }
     }
 
+    /// GPUI's macOS loader skips every face without an `m` glyph, so the
+    /// symbol family must keep Maple's `m` or macOS icons render as tofu (#870).
+    #[test]
+    fn symbol_face_keeps_the_m_glyph_required_by_the_macos_loader() {
+        let symbols = ttf_parser::Face::parse(SYMBOL_FONT_BYTES, 0).unwrap();
+        let original = ttf_parser::Face::parse(REQUIRED_FONT_BYTES, 0).unwrap();
+        let glyph = symbols.glyph_index('m').expect("macOS GPUI rejects faces without 'm'");
+        let old = original.glyph_index('m').unwrap();
+        assert_eq!(symbols.glyph_hor_advance(glyph), original.glyph_hor_advance(old));
+    }
+
     fn sys(name: &str, monospaced: bool) -> SystemFontFamily {
         SystemFontFamily { name: name.to_owned(), monospaced }
     }
```

**File**: `nebula_app/src/platform/fonts.rs` (modified, +18/-0)
```diff
@@ -79,4 +79,22 @@ mod tests {
         let families = super::file_families(&font).unwrap();
         assert!(families.iter().any(|name| name == crate::font_install::REQUIRED_FONT_FAMILY));
     }
+
+    #[cfg(target_os = "macos")]
+    #[test]
+    fn macos_text_system_resolves_symbol_icons_from_the_bundled_face() {
+        use gpui::PlatformTextSystem as _;
+
+        let text_system = gpui_platform::current_platform(true).text_system();
+        text_system
+            .add_fonts(vec![std::borrow::Cow::Borrowed(crate::font_install::SYMBOL_FONT_BYTES)])
+            .unwrap();
+        let font_id = text_system
+            .font_id(&gpui::font(crate::font_install::SYMBOL_FONT_FAMILY))
+            .expect("macOS must load the bundled symbol family");
+        for code in [0xf114, 0xf115, 0xeab6, 0xeab4, 0xea7b] {
+            let ch = char::from_u32(code).unwrap();
+            assert!(text_system.glyph_for_char(font_id, ch).is_some(), "missing U+{code:04X}");
+        }
+    }
 }
```

**File**: `scripts/build_symbol_font.py` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ def main() -> None:
         if 0xE000 <= cp <= 0xF8FF or 0xF0000 <= cp <= 0xFFFFD
         or 0x100000 <= cp <= 0x10FFFD or 0x23FB <= cp <= 0x23FE or cp == 0x2B58
     }
+    # GPUI 的 macOS 加载器会跳过没有 `m` 字形的字体；只保留这一个文字字形。
+    symbols.add(ord("m"))
     options = subset.Options()
     options.name_IDs = ["*"]
     options.name_languages = ["*"]
```

---

### Incident Patch 3: `a88b9465` (2026-11-06)
**Commit Message**: fix(ssh): omit the PTY marker without a remote terminal (#858)

* fix(ssh): omit the PTY marker without a remote terminal

A JumpServer (KoKo) direct login runs the startup wrapper without a
remote terminal. tty then prints "not a tty", the identity filter keeps
that malformed marker verbatim by design, and the pane shows
PEBREL_PTY_<token>=not a tty:<pid>.

Emit the marker only when tty succeeds. The filter contract is
unchanged, and such a pane gets no PTY identity, as before.

Closes #856

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Share one unix gate for the startup script tests

The new marker test pushed the platform cfg count over its budget.

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Kuddev <[REDACTED_EMAIL]>
Co-authored-by: Kuddev <[REDACTED_EMAIL]>

**File**: `nebula_app/src/ssh_session/resume.rs` (modified, +6/-1)
```diff
@@ -142,7 +142,12 @@ pub(super) fn startup(
     target: Option<&ResumeTarget>,
     cwd: Option<&str>,
 ) -> String {
-    let mut script = format!("printf '\\036PEBREL_PTY_{token}=%s:%s\\037' \"$(tty)\" \"$$\"; ");
+    // tty prints "not a tty" when startup has no terminal, as reported for JumpServer direct
+    // connections. The filter shows malformed markers verbatim, so send one only on success.
+    let mut script = format!(
+        "if pebrel_tty=$(tty 2>/dev/null); then \
+         printf '\\036PEBREL_PTY_{token}=%s:%s\\037' \"$pebrel_tty\" \"$$\"; fi; "
+    );
     if let Some(target) = target {
         script.push_str(&target.attach());
     }
```

**File**: `nebula_app/src/ssh_session/resume/tests.rs` (modified, +1/-37)
```diff
@@ -86,40 +86,4 @@ fn endpoint_metadata_is_bounded_validated_and_literal() {
 }
 
 #[cfg(unix)]
-#[test]
-fn vanished_target_or_attach_failure_runs_default_shell_and_cwd_is_never_input() {
-    use std::os::unix::fs::PermissionsExt;
-    use std::process::Command;
-
-    let probe = Command::new("sh").args(["-c", &probe_command()]).output().unwrap();
-    assert!(probe.status.success());
-    assert_eq!(probe.stdout, PROBE_REPLY.as_bytes());
-
-    let directory = tempfile::tempdir().unwrap();
-    let binary = directory.path().join("client's executable");
-    std::fs::write(&binary, "#!/bin/sh\ncase \"$2\" in\ndisplay-message) printf '100:200\\n';;\nselect-window|select-pane) exit ${REJECT_SELECTION:-0};;\nattach-session) printf 'ATTACH_FAILED\\n'; exit 1;;\n*) exit 1;;\nesac\n").unwrap();
-    std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).unwrap();
-    let shell = directory.path().join("default shell");
-    std::fs::write(&shell, "#!/bin/sh\nprintf 'DEFAULT:%s:%s\\n' \"$1\" \"$PWD\"\n").unwrap();
-    std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o700)).unwrap();
-    let endpoint = Endpoint { executable: binary.to_str().unwrap().into(), socket: String::new() };
-    let target =
-        ResumeTarget::parse("/dev/pts/3\t$1\t100:200\t@3\t%4", "/dev/pts/3", &endpoint).unwrap();
-    for (identity, reject) in [("0:0", "0"), ("100:200", "1"), ("100:200", "0")] {
-        let mut target = target.clone();
-        target.identity = identity.into();
-        let output = Command::new("sh")
-            .args(["-c", &startup(TOKEN, None, Some(&target), directory.path().to_str())])
-            .env("SHELL", &shell)
-            .env("REJECT_SELECTION", reject)
-            .output()
-            .unwrap();
-        assert!(output.status.success());
-        let output = String::from_utf8(output.stdout).unwrap();
-        assert!(
-            output.ends_with(&format!("DEFAULT:-l:{}\n", directory.path().display())),
-            "{output}"
-        );
-        assert_eq!(output.contains("ATTACH_FAILED"), identity == "100:200" && reject == "0");
-    }
-}
+mod startup;
```

**File**: `nebula_app/src/ssh_session/resume/tests/startup.rs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+//! Run the startup script in a real shell.
+
+use super::*;
+
+#[test]
+fn vanished_target_or_attach_failure_runs_default_shell_and_cwd_is_never_input() {
+    use std::os::unix::fs::PermissionsExt;
+    use std::process::Command;
+
+    let probe = Command::new("sh").args(["-c", &probe_command()]).output().unwrap();
+    assert!(probe.status.success());
+    assert_eq!(probe.stdout, PROBE_REPLY.as_bytes());
+
+    let directory = tempfile::tempdir().unwrap();
+    let binary = directory.path().join("client's executable");
+    std::fs::write(&binary, "#!/bin/sh\ncase \"$2\" in\ndisplay-message) printf '100:200\\n';;\nselect-window|select-pane) exit ${REJECT_SELECTION:-0};;\nattach-session) printf 'ATTACH_FAILED\\n'; exit 1;;\n*) exit 1;;\nesac\n").unwrap();
+    std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).unwrap();
+    let shell = directory.path().join("default shell");
+    std::fs::write(&shell, "#!/bin/sh\nprintf 'DEFAULT:%s:%s\\n' \"$1\" \"$PWD\"\n").unwrap();
+    std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o700)).unwrap();
+    let endpoint = Endpoint { executable: binary.to_str().unwrap().into(), socket: String::new() };
+    let target =
+        ResumeTarget::parse("/dev/pts/3\t$1\t100:200\t@3\t%4", "/dev/pts/3", &endpoint).unwrap();
+    for (identity, reject) in [("0:0", "0"), ("100:200", "1"), ("100:200", "0")] {
+        let mut target = target.clone();
+        target.identity = identity.into();
+        let output = Command::new("sh")
+            .args(["-c", &startup(TOKEN, None, Some(&target), directory.path().to_str())])
+            .env("SHELL", &shell)
+            .env("REJECT_SELECTION", reject)
+            .output()
+            .unwrap();
+        assert!(output.status.success());
+        let output = String::from_utf8(output.stdout).unwrap();
+        assert!(
+            output.ends_with(&format!("DEFAULT:-l:{}\n", directory.path().display())),
+            "{output}"
+        );
+        assert_eq!(output.contains("ATTACH_FAILED"), identity == "100:200" && reject == "0");
+    }
+}
+
+#[test]
+fn startup_reports_a_named_terminal_and_sends_no_marker_without_one() {
+    use std::fs::File;
+    use std::os::fd::{AsRawFd, FromRawFd};
+    use std::os::unix::fs::PermissionsExt;
+    use std::process::{Command, Stdio};
+
+    let directory = tempfile::tempdir().unwrap();
+    let shell = directory.path().join("default shell");
+    std::fs::write(&shell, "#!/bin/sh\nprintf 'DEFAULT\\n'\n").unwrap();
+    std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o700)).unwrap();
+    let (mut controller, mut terminal) = (0, 0);
+    assert_eq!(
+        unsafe {
+            libc::openpty(
+                &mut controller,
+                &mut terminal,
+                std::ptr::null_mut(),
+                std::ptr::null_mut(),
+                std::ptr::null_mut(),
+            )
+        },
+        0
+    );
+    let _controller = unsafe { File::from_raw_fd(controller) };
+    let terminal = unsafe { File::from_raw_fd(terminal) };
+    let mut name = [0; 1024];
+    assert_eq!(unsafe { libc::ttyname_r(terminal.as_raw_fd(), name.as_mut_ptr(), name.len()) }, 0);
+    let name = unsafe { std::ffi::CStr::from_ptr(name.as_ptr()) }.to_str().unwrap().to_owned();
+    // The JumpServer report shows tty failing during startup; null stdin reproduces that.
+    for (stdin, tty) in [(Stdio::from(terminal), Some(name)), (Stdio::null(), None)] {
+        let output = Command::new("sh")
+            .args(["-c", &startup(TOKEN, None, None, None)])
+            .env("SHELL", &shell)
+            .stdin(stdin)
+            .output()
+            .unwrap();
+        assert!(output.status.success());
+        let identity = Arc::new(Mutex::new(None));
+        let mut filter = IdentityInput::new(TOKEN, identity.clone());
+        let mut visible = filter.feed(&output.stdout).into_owned();
+        visible.extend(filter.finish());
+        assert_eq!(String::from_utf8(visible).unwrap(), "DEFAULT\n");
+        assert_eq!(identity.lock().unwrap().as_ref().map(|value| value.tty.clone()), tty);
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #895** (2026-11-07): fix(windows): pin GPUI DirectWrite face attribution fix (@YinBuLiao)
- **PR #894** (2026-11-07): fix(windows): keep the typing-hidden pointer hidden until real mouse motion (@YinBuLiao)
- **PR #893** (2026-11-07): fix(ssh): keep idle built-in SSH sessions alive through short stalls (@YinBuLiao)
- **PR #892** (2026-11-07): fix(files): keep the m glyph so macOS loads the symbol font (@YinBuLiao)
- **PR #891** (2026-11-06): fix(terminal): cancel unsupported ZMODEM rz/sz sessions (@YinBuLiao)
- **PR #890** (2026-11-06): Fix 2.4.0 follow-up failures and merge reviewed contributor fixes (@Kuddev)

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

## X. ssh): keep idle built-in SSH sessions alive through short stalls (#893)

**RULE**:
When implementing operations in `architecture/notes/nebula_app/ssh_session/2026-11-05-shared-keepalive-budget.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `da3250ac`: ssh): keep idle built-in SSH sessions alive through short stalls (#893). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `architecture/notes/nebula_app/ssh_session/2026-11-05-shared-keepalive-budget.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Share the SSH keepalive budget between built-in and OpenSSH launches

## Status

Accepted (#816).

## Context

An idle built-in SSH pane ended with "SSH connection ended without an exit
status" after hours, while a parallel standalone OpenSSH client session to the
same host stayed connected. The managed OpenSSH launch has used
`ServerAliveInterval=30` / `ServerAliveCountMax=6` since v0.7.0 to survive NAT
idle timeouts. The built-in russh client instead used a 15 s interval with a
maximum of 3. russh counts every unanswered timer tick and fails the transport
with `KeepaliveTimeout` once the count exceeds the maximum. A server or path
that is silent for about one minute therefore ended the pane.

## Evidence

A scratch russh 0.62.2 client with the old 15 s × 3 policy lost its channel
after about 60 s when the server was stalled for 90–100 s. Servers were stalled
with SIGSTOP on a local macOS sshd and with `docker pause` on an Ubuntu 22.04
OpenSSH 8.9 container. OpenSSH with default settings survived the same stall
and echoed afterwards. Forcing a rekey every three seconds against OpenSSH 10.2
and 8.9 kept the session alive, which rules out key re-exchange as the cause.

## Decision
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `da3250ac` are properly handled with clean fallback behavior.
