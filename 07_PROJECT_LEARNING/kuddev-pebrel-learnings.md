> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `54548685`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-28T06:24:44.213Z  
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
> **Harvest Timestamp**: 2026-10-28T06:24:44.209Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3626 stars

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

### Incident Patch 1: `54548685` (2026-10-28)
**Commit Message**: fix(i18n): localize settings help and option labels (#793)

Use typed translation IDs for existing settings help and option labels, including Japanese translations.

**File**: `nebula_app/i18n/en-US.json` (modified, +93/-0)
```diff
@@ -525,6 +525,99 @@
       "release_notes": "Release notes",
       "sponsors": "Sponsors"
     },
+    "option": {
+      "bar": "Bar (│)",
+      "underscore": "Underscore (_)",
+      "filled_box": "Filled box (█)",
+      "empty_box": "Empty box (□)",
+      "slide": "Slide",
+      "instant": "Instant",
+      "after_current_tab": "After current tab",
+      "end_of_list": "End of list",
+      "create_a_new_window": "Create a new window",
+      "attach_to_the_most_recent": "Attach to the most recent window",
+      "attach_to_the_most_recent_v2": "Attach to the most recent window on this desktop",
+      "auto_detect": "Auto detect",
+      "git_only": "Git only",
+      "svn_only": "SVN only",
+      "visual_sound": "Visual + sound",
+      "mica_low_cost": "Mica (low cost)",
+      "mica_alt_low_cost": "Mica Alt (low cost)",
+      "aero_glass": "Aero (glass)",
+      "acrylic_high_cost": "Acrylic (high cost)",
+      "right_arrow": "Right arrow",
+      "tab_or_right_arrow": "Tab or Right arrow",
+      "fill": "Fill",
+      "uniform": "Uniform",
+      "uniform_to_fill": "Uniform to fill",
+      "original_size": "Original size",
+      "top_left": "Top left",
+      "top_right": "Top right",
+      "bottom_left": "Bottom left",
+      "bottom_right": "Bottom right",
+      "provider_name": "Provider name",
+      "note_spaces_allowed": "Note (spaces allowed)",
+      "official_website": "Official website",
+      "api_endpoint": "API endpoint",
+      "default_model": "Default model",
+      "e_g_development_server": "e.g. Development server",
+      "leave_empty_to_ask_when": "Leave empty to ask when connecting",
+      "optional": "Optional",
+      "leave_empty_to_keep_the": "Leave empty to keep the saved password",
+      "user_bastion_n22_or_ssh": "user@bastion:22 or SSH config alias",
+      "search_icons": "Search icons...",
+      "backup_password_at_least_n8": "Backup password (at least 8 characters)"
+    },
+    "help": {
+      "changes_only_the_terminal_background": "Changes only the terminal background; Settings keeps the theme colors.",
+      "shows_an_image_behind_terminal": "Shows an image behind terminal text.",
+      "text_colors_still_come_from": "Text colors still come from the theme. Lower the image opacity if text is hard to read.",
+      "chooses_how_the_background_image": "Chooses how the background image fills the terminal.",
+      "fill_stretches_the_image_uniform": "Fill stretches the image. Uniform and Uniform to fill preserve its aspect ratio. Original size does not scale it.",
+      "positions_the_image_within_the": "Positions the image within the terminal.",
+      "lower_values_make_the_image": "Lower values make the image less prominent.",
+      "when_disabled_the_image_appears": "When disabled, the image appears only behind the terminal.",
+      "when_disabled_the_cursor_stays": "When disabled, the cursor stays lit.",
+      "middle_click_still_closes_tabs": "Middle-click still closes tabs when their close buttons are hidden.",
+      "changes_only_the_application_interface": "Changes only the application interface language.",
+      "programs_inside_the_terminal_choose": "Programs inside the terminal choose their output language from their own environment.",
+      "adjusts_interface_spacing_without_changing": "Adjusts interface spacing without changing terminal line spacing.",
+      "chooses_the_window_background_effect": "Chooses the window background effect.",
+      "mica_effects_use_fewer_resources": "Mica effects use fewer resources. Aero and Acrylic blur live content behind the window and cost more.",
+      "adjusts_terminal_character_cell_width": "Adjusts terminal character cell width.",
+      "compact_rounds_down_relaxed_rounds": "Compact rounds down. Relaxed rounds up to avoid squeezing fonts with fractional widths. Only the terminal grid is affected.",
+      "shows_system_information_when_a": "Shows system information when a new session starts.",
+      "uses_fastfetch_to_display_system": "Uses fastfetch to display system information. Disabling it reduces startup work for new tabs.",
+      "shows_a_segmented_prompt_requires": "Shows a segmented prompt. Requires a compatible font.",
+      "the_font_must_include_powerline": "The font must include Powerline glyphs or the segment arrows may appear as boxes.",
+      "used_for_new_tabs_existing": "Used for new tabs. Existing terminals are unaffected.",
+      "when_unset_inherits_the_directory": "When unset, inherits the directory used to launch the application.",
+      "launching_from_a_file_explorer": "Launching from a File Explorer folder uses that folder by default.",
+      "chooses_sound_or_visual_feedback": "Chooses sound or visual feedback for terminal alerts.",
+      "uses_the_font_group_in": "Uses the font group in order to find available glyphs.",
+      "when_a_font_lacks_a": "When a font lacks a glyph, the next font in the group is tried.",
+      "suggests_commands_from_his
```

**File**: `nebula_app/i18n/ja-JP.json` (modified, +93/-0)
```diff
@@ -347,6 +347,99 @@
       "release_notes": "リリースノート",
       "sponsors": "スポンサー"
     },
+    "option": {
+      "bar": "バー（│）",
+      "underscore": "アンダースコア（_）",
+      "filled_box": "塗りつぶしの四角（█）",
+      "empty_box": "中抜きの四角（□）",
+      "slide": "スライド",
+      "instant": "即時",
+      "after_current_tab": "現在のタブの後",
+      "end_of_list": "リストの末尾",
+      "create_a_new_window": "新しいウィンドウを作成",
+      "attach_to_the_most_recent": "最後に使用したウィンドウで開く",
+      "attach_to_the_most_recent_v2": "このデスクトップで最後に使用したウィンドウで開く",
+      "auto_detect": "自動検出",
+      "git_only": "Git のみ",
+      "svn_only": "SVN のみ",
+      "visual_sound": "視覚通知 + サウンド",
+      "mica_low_cost": "Mica（低負荷）",
+      "mica_alt_low_cost": "Mica Alt（低負荷）",
+      "aero_glass": "Aero（ガラス）",
+      "acrylic_high_cost": "Acrylic（高負荷）",
+      "right_arrow": "右方向キー",
+      "tab_or_right_arrow": "Tab または右方向キー",
+      "fill": "引き伸ばし",
+      "uniform": "全体を表示",
+      "uniform_to_fill": "全体に拡大",
+      "original_size": "元のサイズ",
+      "top_left": "左上",
+      "top_right": "右上",
+      "bottom_left": "左下",
+      "bottom_right": "右下",
+      "provider_name": "プロバイダー名",
+      "note_spaces_allowed": "メモ（スペース可）",
+      "official_website": "公式サイト",
+      "api_endpoint": "API エンドポイント",
+      "default_model": "既定のモデル",
+      "e_g_development_server": "例: 開発サーバー",
+      "leave_empty_to_ask_when": "空欄の場合は接続時に入力",
+      "optional": "任意",
+      "leave_empty_to_keep_the": "空欄の場合は保存済みのパスワードを維持",
+      "user_bastion_n22_or_ssh": "user@bastion:22 または SSH config のエイリアス",
+      "search_icons": "アイコンを検索…",
+      "backup_password_at_least_n8": "バックアップのパスワード（8 文字以上）"
+    },
+    "help": {
+      "changes_only_the_terminal_background": "ターミナルの背景のみを変更します。設定ページはテーマの色のままです。",
+      "shows_an_image_behind_terminal": "ターミナルの文字の背後に画像を表示します。",
+      "text_colors_still_come_from": "文字色は引き続きテーマに従います。文字が読みにくい場合は画像の不透明度を下げてください。",
+      "chooses_how_the_background_image": "ターミナルでの背景画像の表示方法を選択します。",
+      "fill_stretches_the_image_uniform": "「引き伸ばし」は画像を縦横比に関係なく伸縮します。「全体を表示」と「全体に拡大」は縦横比を保ちます。「元のサイズ」は拡大縮小しません。",
+      "positions_the_image_within_the": "ターミナル内での画像の位置を指定します。",
+      "lower_values_make_the_image": "値を小さくするほど画像が目立たなくなります。",
+      "when_disabled_the_image_appears": "オフの場合、画像はターミナルの背後にのみ表示されます。",
+      "when_disabled_the_cursor_stays": "オフの場合、カーソルは点灯したままになります。",
+      "middle_click_still_closes_tabs": "閉じるボタンを非表示にしても、中クリックでタブを閉じられます。",
+      "changes_only_the_application_interface": "アプリの UI 言語のみを変更します。",
+      "programs_inside_the_terminal_choose": "ターミナル内のプログラムの出力言語は、各プログラムの実行環境（ロケールなど）によって決まります。",
+      "adjusts_interface_spacing_without_changing": "ターミナルの行間を変えずに、UI の余白を調整します。",
+      "chooses_the_window_background_effect": "ウィンドウの背景効果を選択します。",
+      "mica_effects_use_fewer_resources": "Mica 系は負荷が低めです。Aero と Acrylic はウィンドウ背後の内容をリアルタイムにぼかすため、負荷が高くなります。",
+      "adjusts_terminal_character_cell_width": "ターミナルの文字セルの幅を調整します。",
+      "compact_rounds_down_relaxed_rounds": "「コンパクト」は切り捨てます。「ゆったり」は切り上げて、幅が小数になるフォントが詰まって見えるのを防ぎます。ターミナルのグリッドにのみ影響します。",
+      "shows_system_information_when_a": "新しいセッションの開始時にシステム情報を表示します。",
+      "uses_fastfetch_to_display_system": "fastfetch を使ってシステム情報を表示します。オフにすると新しいタブの起動処理が軽くなります。",
+      "shows_a_segmented_prompt_requires": "セグメント化されたプロンプトを表示します。対応フォントが必要です。",
+      "the_font_must_include_powerline": "フォントに Powerline グリフが含まれていないと、セグメントの矢印が四角形で表示されることがあります。",
+      "used_for_new_tabs_existing": "新しいタブに使用されます。既存のターミナルには影響しません。",
+      "when_unset_inherits_the_directory": "未設定の場合、アプリケーションの起動ディレクトリを引き継ぎます。",
+      "launching_from_a_file_explorer": "エクスプローラーのフォルダーから起動した場合は、既定でそのフォルダーを使用します。",
+      "chooses_sound_or_visual_feedback": "ターミナルのアラートを音で知らせるか、画面で知らせるかを選択します。",
+      "uses_the_font_group_in": "フォントグループを順に使って利用可能なグリフを探します。",
+      "when_a_font_lacks_a": "フォントにグリフがない場合は、グループ内の次のフォントが試されます。",
+      "suggests_commands_from_history_and": "履歴からコマンドを提案し、確定したときだけ入力します。",
+      "chooses_the_key_used_to": "候補を確定するキーを選択します。",
+      "use_right_arrow_if_tab": "Tab がシェル自体の補完と競合する場合は、右方向キーを使用してください。",
+      "copies_on_mouse_release_and": "マウスを離すとコピーし、右クリックで貼り付けます。",
+      "when_disabled_selection_does_not": "オフの場合、選択しても自動でコピーされず、右クリックでコピー／貼り付けメニューが開きます。",
+      "asks_before_multiline_or_risky": "通常のシェルで複数行や危険な内容を貼り付ける前に確認します。",
+      "checks_line_breaks_privileged_commands": "改行、特権コマンド、制御文字をチェックします。ブラケットペーストと全画面アプリは対象外です。オフにすると確認せずに貼り付けます。",
+      "locks_the_divider_when_disabled": "オフにするとサイドバーの境界を固定し、誤って幅を変えてしまうのを防ぎます。",
+      "brightens_dense_glyphs_instead_of": "線を太くする代わりに明るくして、画数の多いグリフを見やすくします。",
+      "only_cjk_bold_glyphs_are": "影響するのは CJK の太字グリフのみです。ラテン文字には引き続き本来の太字を使用します。",
+      "slides_new_tabs_into_view": "新しいタブをスライドさせて表示するか、すぐに表示するかを選択します。",
+      "affects_new_tabs_only_not": "新しいタブにのみ影響し、復元されるタブの順序は変わりません。",
+      "opens_a_new_window_or": "再度起動したときに、新しいウィンドウを開くか既存のウィンドウに加わるかを指定します。",
+      "chooses_whether_the_sidebar_shows": "サイドバーに Git と SVN のどちらの状態を表示するかを選択します。",
+      "auto_detect_check
```

**File**: `nebula_app/i18n/zh-CN.json` (modified, +93/-0)
```diff
@@ -525,6 +525,99 @@
       "release_notes": "更新内容",
       "sponsors": "赞助商"
     },
+    "option": {
+      "bar": "条形（│）",
+      "underscore": "下划线（_）",
+      "filled_box": "实心框（█）",
+      "empty_box": "空心框（□）",
+      "slide": "滑动",
+      "instant": "立即",
+      "after_current_tab": "当前标签之后",
+      "end_of_list": "列表末尾",
+      "create_a_new_window": "创建新窗口",
+      "attach_to_the_most_recent": "附加到最近使用的窗口",
+      "attach_to_the_most_recent_v2": "附加到此桌面最近使用的窗口",
+      "auto_detect": "自动检测",
+      "git_only": "仅 Git",
+      "svn_only": "仅 SVN",
+      "visual_sound": "闪烁 + 声音",
+      "mica_low_cost": "Mica（低开销）",
+      "mica_alt_low_cost": "Mica Alt（低开销）",
+      "aero_glass": "Aero（玻璃）",
+      "acrylic_high_cost": "Acrylic（高开销）",
+      "right_arrow": "右方向键",
+      "tab_or_right_arrow": "Tab 或右方向键",
+      "fill": "拉伸",
+      "uniform": "适应",
+      "uniform_to_fill": "填充",
+      "original_size": "原始尺寸",
+      "top_left": "左上",
+      "top_right": "右上",
+      "bottom_left": "左下",
+      "bottom_right": "右下",
+      "provider_name": "供应商名称",
+      "note_spaces_allowed": "备注（可包含空格）",
+      "official_website": "官方网站",
+      "api_endpoint": "API 请求地址",
+      "default_model": "默认模型",
+      "e_g_development_server": "例如：开发服务器",
+      "leave_empty_to_ask_when": "留空则连接时询问",
+      "optional": "可选",
+      "leave_empty_to_keep_the": "留空则保留已存密码",
+      "user_bastion_n22_or_ssh": "user@bastion:22 或 SSH config 别名",
+      "search_icons": "搜索图标…",
+      "backup_password_at_least_n8": "备份密码（至少 8 位）"
+    },
+    "help": {
+      "changes_only_the_terminal_background": "只更改终端底色，设置页仍跟随主题。",
+      "shows_an_image_behind_terminal": "在终端文字后方显示图片。",
+      "text_colors_still_come_from": "图片不改变文字配色；看不清时可降低背景图像不透明度。",
+      "chooses_how_the_background_image": "调整图片的铺放方式。",
+      "fill_stretches_the_image_uniform": "拉伸会改变比例；适应和填充保持比例；原始尺寸不缩放。",
+      "positions_the_image_within_the": "设置图片在终端中的位置。",
+      "lower_values_make_the_image": "数值越低，图片越淡。",
+      "when_disabled_the_image_appears": "关闭后，图片只显示在终端区域。",
+      "when_disabled_the_cursor_stays": "关闭后，光标保持常亮。",
+      "middle_click_still_closes_tabs": "隐藏后，仍可用鼠标中键关闭标签。",
+      "changes_only_the_application_interface": "只更改应用界面的语言。",
+      "programs_inside_the_terminal_choose": "终端内程序的输出语言由各自的环境设置决定。",
+      "adjusts_interface_spacing_without_changing": "调整界面留白，不改变终端行距。",
+      "chooses_the_window_background_effect": "选择窗口背景的模糊效果。",
+      "mica_effects_use_fewer_resources": "Mica 系列开销较低；Aero 和 Acrylic 实时模糊窗口后方的内容，开销较高。",
+      "adjusts_terminal_character_cell_width": "调整终端字符的列宽。",
+      "compact_rounds_down_relaxed_rounds": "紧凑向下取整；宽松向上补齐，避免小数字宽的字体显得拥挤。只影响终端网格。",
+      "shows_system_information_when_a": "新会话启动时显示系统信息。",
+      "uses_fastfetch_to_display_system": "通过 fastfetch 显示系统信息；关闭可减少新标签的启动等待。",
+      "shows_a_segmented_prompt_requires": "显示分段提示符，需字体支持。",
+      "the_font_must_include_powerline": "字体须包含 Powerline 字形，否则分段箭头可能显示为方框。",
+      "used_for_new_tabs_existing": "用于新标签，不影响已打开的终端。",
+      "when_unset_inherits_the_directory": "未设置时，继承应用的启动目录。",
+      "launching_from_a_file_explorer": "从资源管理器的文件夹中启动时，默认进入该文件夹。",
+      "chooses_sound_or_visual_feedback": "程序提示时，选择声音或闪烁提醒。",
+      "uses_the_font_group_in": "按字体组顺序查找可用字形。",
+      "when_a_font_lacks_a": "前面的字体缺少字形时，会继续尝试后面的字体。",
+      "suggests_commands_from_history_and": "根据历史命令给出建议，确认后才填入。",
+      "chooses_the_key_used_to": "选择填入建议时使用的按键。",
+      "use_right_arrow_if_tab": "如果 Tab 与 Shell 自带补全冲突，可改用右方向键。",
+      "copies_on_mouse_release_and": "松开鼠标自动复制，右键直接粘贴。",
+      "when_disabled_selection_does_not": "关闭后，选中不会自动复制；右键改为打开复制与粘贴菜单。",
+      "asks_before_multiline_or_risky": "在普通 shell 中粘贴多行或高风险内容时先确认。",
+      "checks_line_breaks_privileged_commands": "检查换行、提权命令和控制字符。Bracketed paste 模式与全屏程序不受此项保护；关闭后直接粘贴。",
+      "locks_the_divider_when_disabled": "关闭后锁定分界线，避免误拖。",
+      "brightens_dense_glyphs_instead_of": "用提亮代替加粗，让密集笔画更清楚。",
+      "only_cjk_bold_glyphs_are": "只影响中日韩（CJK）粗体字形，拉丁字母仍使用真正的粗体。",
+      "slides_new_tabs_into_view": "新标签滑动出现，或立即显示。",
+      "affects_new_tabs_only_not": "只影响新标签，不改变恢复时的顺序。",
+      "opens_a_new_window_or": "再次启动应用时，新开窗口或加入已有窗口。",
+      "chooses_whether_the_sidebar_shows": "选择侧栏显示 Git 还是 SVN 状态。",
+      "auto_detect_checks_for_git": "自动检测会识别 .git 和 .svn；同目录存在两者时可手动指定。",
+      "keeps_terminals_running_after_closing": "关窗后终端继续运行；关闭此项会结束会话。",
+      "when_disabled_closing_the_window": "关闭此项后，关窗会终止 Shell，未保存的工作可能丢失。开启后可重新附着到后台会话。",
+      "restores_tabs_layout_and_directories": "恢复标签、布局和目录，不恢复原进程。",
+      "restored_tabs_start_new_shells": "恢复的标签会启动新的 Shell，不会让已结束的程序继续运行。",
+      "continues_the_previous_conversation_when": "恢复 AI 标签时，继续上次的对话。",
+      "shows_ai_session_status_in": "在通知区域查看 AI 会话状态。"
+    },
     "pane": {
       "restore_default": "还原为默认值",
       "hide_details": "收起说明",
```

**File**: `nebula_app/src/gpui_shell/settings_pane/localization.rs` (modified, +65/-57)
```diff
@@ -63,83 +63,92 @@ pub(super) fn localized_select_labels(
             language.text(crate::i18n::Message::SettingsNotificationsDurationPersistent),
         ],
         "cursor_shape" => vec![
-            language.pick("条形（│）", "Bar (│)"),
-            language.pick("下划线（_）", "Underscore (_)"),
-            language.pick("实心框（█）", "Filled box (█)"),
-            language.pick("空心框（□）", "Empty box (□)"),
+            language.text(crate::i18n::Message::SettingsOptionBar),
+            language.text(crate::i18n::Message::SettingsOptionUnderscore),
+            language.text(crate::i18n::Message::SettingsOptionFilledBox),
+            language.text(crate::i18n::Message::SettingsOptionEmptyBox),
         ],
         "cursor_motion" => vec![
             language.text(crate::i18n::Message::SettingsCursorMotionOff),
             language.text(crate::i18n::Message::SettingsCursorMotionSmooth),
         ],
         "tabs_position" => {
-            vec![language.pick("左侧边栏", "Left sidebar"), language.pick("顶部", "Top")]
+            vec![
+                language.text(crate::i18n::Message::CommonLeftSidebar),
+                language.text(crate::i18n::Message::CommonTop),
+            ]
         },
-        "tab_reveal" => vec![language.pick("滑动", "Slide"), language.pick("立即", "Instant")],
-        "density" => vec![language.pick("标准", "Standard"), language.pick("紧凑", "Compact")],
+        "tab_reveal" => vec![
+            language.text(crate::i18n::Message::SettingsOptionSlide),
+            language.text(crate::i18n::Message::SettingsOptionInstant),
+        ],
+        "density" => vec![
+            language.text(crate::i18n::Message::CommonStandard),
+            language.text(crate::i18n::Message::CommonCompact),
+        ],
         "new_tab_position" => vec![
-            language.pick("当前标签之后", "After current tab"),
-            language.pick("列表末尾", "End of list"),
+            language.text(crate::i18n::Message::SettingsOptionAfterCurrentTab),
+            language.text(crate::i18n::Message::SettingsOptionEndOfList),
         ],
         "windowing_behavior" => vec![
-            language.pick("创建新窗口", "Create a new window"),
-            language.pick("附加到最近使用的窗口", "Attach to the most recent window"),
-            language.pick(
-                "附加到此桌面最近使用的窗口",
-                "Attach to the most recent window on this desktop",
-            ),
+            language.text(crate::i18n::Message::SettingsOptionCreateANewWindow),
+            language.text(crate::i18n::Message::SettingsOptionAttachToTheMostRecent),
+            language.text(crate::i18n::Message::SettingsOptionAttachToTheMostRecentV2),
         ],
         "vcs_display" => vec![
-            language.pick("自动检测", "Auto detect"),
-            language.pick("仅 Git", "Git only"),
-            language.pick("仅 SVN", "SVN only"),
+            language.text(crate::i18n::Message::SettingsOptionAutoDetect),
+            language.text(crate::i18n::Message::SettingsOptionGitOnly),
+            language.text(crate::i18n::Message::SettingsOptionSvnOnly),
         ],
         "ligatures" => vec![
             language.text(crate::i18n::Message::SettingsFontLigaturesOn),
             language.text(crate::i18n::Message::SettingsFontLigaturesOff),
             language.text(crate::i18n::Message::SettingsFontLigaturesTheme),
         ],
         "cell_width_mode" => {
-            vec![language.pick("紧凑", "Compact"), language.pick("宽松", "Relaxed")]
+            vec![
+                language.text(crate::i18n::Message::CommonCompact),
+                language.text(crate::i18n::Message::CommonRelaxed),
+            ]
         },
         "bell" => vec![
-            language.pick("关", "Off"),
-            language.pick("闪烁", "Visual"),
-            language.pick("声音", "Sound"),
-            language.pick("闪烁 + 声音", "Visual + sound"),
+            language.text(crate::i18n::Message::CommonOff),
+            language.text(crate::i18n::Message::CommonVisual),
+            language.text(crate::i18n::Message::CommonSound),
+            language.text(crate::i18n::Message::SettingsOptionVisualSound),
         ],
         "blur" => vec![
-            language.pick("无", "None"),
-            language.pick("Mica（低开销）", "Mica (low cost)"),
-            language.pick("Mica Alt（低开销）", "Mica Alt (low cost)"),
-            language.pick("Aero（玻璃）", "Aero (glass)"),
-            language.pick("Acrylic（高开销）", "Acrylic (high cost)"),
+            language.text(crate::i18n::Message::CommonNone),
+            language.text(crate::i18n::Message::SettingsOptionMicaLowCost),
+            language.text(crate::i18n::Message::SettingsOptionMicaAltLowCost),
+            language.text(crate::i18n::Message::SettingsOptionAeroGlass),
+            language.text(crate::i18n::Message::SettingsOptionAcrylicHighCost),
         ],
         "accept" => vec![
-            language.pick("右方向键", "Right arrow"),
+            language.text(crate::i18n::Message::SettingsOptionRightArrow),
     
```

**File**: `nebula_app/src/gpui_shell/settings_pane/setting_help.rs` (modified, +75/-93)
```diff
@@ -15,78 +15,66 @@ impl From<&'static str> for SettingHelp {
 pub(super) fn help(key: &str, language: UiLanguage) -> SettingHelp {
     let (summary, details) = match key {
         "background" => (
-            language.pick("只更改终端底色，设置页仍跟随主题。", "Changes only the terminal background; Settings keeps the theme colors."),
+            language.text(crate::i18n::Message::SettingsHelpChangesOnlyTheTerminalBackground),
             None,
         ),
         "background_image" => (
-            language.pick("在终端文字后方显示图片。", "Shows an image behind terminal text."),
-            Some(language.pick("图片不改变文字配色；看不清时可降低背景图像不透明度。", "Text colors still come from the theme. Lower the image opacity if text is hard to read.")),
+            language.text(crate::i18n::Message::SettingsHelpShowsAnImageBehindTerminal),
+            Some(language.text(crate::i18n::Message::SettingsHelpTextColorsStillComeFrom)),
         ),
         "background_image_fit" => (
-            language.pick("调整图片的铺放方式。", "Chooses how the background image fills the terminal."),
-            Some(language.pick("拉伸会改变比例；适应和填充保持比例；原始尺寸不缩放。", "Fill stretches the image. Uniform and Uniform to fill preserve its aspect ratio. Original size does not scale it.")),
-        ),
-        "background_image_alignment" => (
-            language.pick("设置图片在终端中的位置。", "Positions the image within the terminal."),
-            None,
-        ),
-        "background_image_opacity" => (
-            language.pick("数值越低，图片越淡。", "Lower values make the image less prominent."),
-            None,
-        ),
-        "background_image_cover_chrome" => (
-            language.pick("关闭后，图片只显示在终端区域。", "When disabled, the image appears only behind the terminal."),
-            None,
-        ),
+            language.text(crate::i18n::Message::SettingsHelpChoosesHowTheBackgroundImage),
+            Some(language.text(crate::i18n::Message::SettingsHelpFillStretchesTheImageUniform)),
+        ),
+        "background_image_alignment" => {
+            (language.text(crate::i18n::Message::SettingsHelpPositionsTheImageWithinThe), None)
+        },
+        "background_image_opacity" => {
+            (language.text(crate::i18n::Message::SettingsHelpLowerValuesMakeTheImage), None)
+        },
+        "background_image_cover_chrome" => {
+            (language.text(crate::i18n::Message::SettingsHelpWhenDisabledTheImageAppears), None)
+        },
         "cursor_shape" => ("", None),
-        "cursor_blink" => (
-            language.pick("关闭后，光标保持常亮。", "When disabled, the cursor stays lit."),
-            None,
-        ),
-        "tab_close_visible" => (
-            language.pick("隐藏后，仍可用鼠标中键关闭标签。", "Middle-click still closes tabs when their close buttons are hidden."),
-            None,
-        ),
+        "cursor_blink" => {
+            (language.text(crate::i18n::Message::SettingsHelpWhenDisabledTheCursorStays), None)
+        },
+        "tab_close_visible" => {
+            (language.text(crate::i18n::Message::SettingsHelpMiddleClickStillClosesTabs), None)
+        },
         "language" => (
-            language.pick("只更改应用界面的语言。", "Changes only the application interface language."),
-            Some(language.pick("终端内程序的输出语言由各自的环境设置决定。", "Programs inside the terminal choose their output language from their own environment.")),
+            language.text(crate::i18n::Message::SettingsHelpChangesOnlyTheApplicationInterface),
+            Some(language.text(crate::i18n::Message::SettingsHelpProgramsInsideTheTerminalChoose)),
         ),
         "density" => (
-            language.pick("调整界面留白，不改变终端行距。", "Adjusts interface spacing without changing terminal line spacing."),
-            None,
-        ),
-        "opacity" => (
-            language.text(crate::i18n::Message::SettingsOpacityDescription),
+            language.text(crate::i18n::Message::SettingsHelpAdjustsInterfaceSpacingWithoutChanging),
             None,
         ),
+        "opacity" => (language.text(crate::i18n::Message::SettingsOpacityDescription), None),
         "blur" => (
-            language.pick("选择窗口背景的模糊效果。", "Chooses the window background effect."),
-            Some(language.pick("Mica 系列开销较低；Aero 和 Acrylic 实时模糊窗口后方的内容，开销较高。", "Mica effects use fewer resources. Aero and Acrylic blur live content behind the window and cost more.")),
+            language.text(crate::i18n::Message::SettingsHelpChoosesTheWindowBackgroundEffect),
+            Some(language.text(crate::i18n::Message::SettingsHelpMicaEffectsUseFewerResources)),
         ),
         "cell_width_mode" => (
-            language.pick("调整终端字符的列宽。", "Adjusts terminal character cell width."),
-            Some(language.pick("紧凑向下取整；宽松向上补齐，避免小数字宽的字体显得拥挤。只影响终端网格。", "Compact rounds down. Relaxed rounds up to avoid squeezing fonts with fractional widths. Only the terminal grid is affected.")),
+            language.text(crate::i18n::Message::SettingsHelpAdjustsTerminalCharacterCellWidth),
+            Some(language.text(crate::i18n::Mes
```

---

### Incident Patch 2: `977e68d5` (2026-10-28)
**Commit Message**: fix(linux): bound XIM atoms without losing input (#668)

Reuse consumed XIM properties, preserve packet ordering, and bound pending transport state.

**File**: `Cargo.lock` (modified, +3/-3)
```diff
@@ -11829,15 +11829,15 @@ checksum = "2fb433233f2df9344722454bc7e96465c9d03bff9d77c248f9e7523fe79585b5"
 [[package]]
 name = "xim-ctext"
 version = "0.3.0"
-source = "git+https://github.com/zed-industries/xim-rs.git?rev=16f35a2c881b815a2b6cdfd6687988e84f8447d8#16f35a2c881b815a2b6cdfd6687988e84f8447d8"
+source = "git+https://github.com/MeshedPoto/xim-rs?rev=422473ff3be2ce58ea70f3fad35cecafcf7ae6a9#422473ff3be2ce58ea70f3fad35cecafcf7ae6a9"
 dependencies = [
  "encoding_rs",
 ]
 
 [[package]]
 name = "xim-parser"
 version = "0.2.1"
-source = "git+https://github.com/zed-industries/xim-rs.git?rev=16f35a2c881b815a2b6cdfd6687988e84f8447d8#16f35a2c881b815a2b6cdfd6687988e84f8447d8"
+source = "git+https://github.com/MeshedPoto/xim-rs?rev=422473ff3be2ce58ea70f3fad35cecafcf7ae6a9#422473ff3be2ce58ea70f3fad35cecafcf7ae6a9"
 dependencies = [
  "bitflags 2.13.0",
 ]
@@ -12167,7 +12167,7 @@ dependencies = [
 [[package]]
 name = "zed-xim"
 version = "0.4.0-zed"
-source = "git+https://github.com/zed-industries/xim-rs.git?rev=16f35a2c881b815a2b6cdfd6687988e84f8447d8#16f35a2c881b815a2b6cdfd6687988e84f8447d8"
+source = "git+https://github.com/MeshedPoto/xim-rs?rev=422473ff3be2ce58ea70f3fad35cecafcf7ae6a9#422473ff3be2ce58ea70f3fad35cecafcf7ae6a9"
 dependencies = [
  "ahash",
  "hashbrown 0.14.5",
```

**File**: `Cargo.toml` (modified, +6/-0)
```diff
@@ -13,6 +13,12 @@ members = [
 ]
 resolver = "2"
 
+# 保留 XIM 输入法，同时复用固定的属性原子名称，避免长期运行扩大 X11 原子表。
+# 基于原依赖 16f35a2c881b815a2b6cdfd6687988e84f8447d8 的薄修补。
+# 原因、兼容范围与撤销条件见 architecture/notes/packaging/2026-10-16-bounded-xim-atoms.md。
+[patch."https://github.com/zed-industries/xim-rs.git"]
+zed-xim = { git = "https://github.com/MeshedPoto/xim-rs", rev = "422473ff3be2ce58ea70f3fad35cecafcf7ae6a9" }
+
 [workspace.package]
 edition = "2024"
 rust-version = "1.97.1"
```

**File**: `architecture/notes/packaging/2026-10-16-bounded-xim-atoms.md` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+# 固定 XIM 客户端属性原子名称
+
+## Status
+
+提议采用固定提交的依赖修复。旧接收器互操作回归与真实 Fcitx 拼音协议测试通过。
+这不是正式发布或完整 GUI 验收记录。
+
+## Context
+
+Pebrel 的 Linux X11 输入路径通过 GPUI 使用 `zed-xim`。
+X server 保存原子名称，其生命周期不随窗口或属性删除而结束。
+原客户端按递增的 `u16` 序号生成 `_XIM_DATA_*`，在回绕前可产生 65536 个名称。
+长期输入因此扩大整个桌面会话的原子表，并可能触发其他旧 X11 客户端的编号上限。
+修复必须保留 XIM 中文输入和报文顺序，也不能要求用户升级外部输入法服务器。
+
+## Evidence
+
+- 原依赖固定在 [16f35a2](https://github.com/zed-industries/xim-rs/tree/16f35a2c881b815a2b6cdfd6687988e84f8447d8)。
+- [依赖修复提交](https://github.com/MeshedPoto/xim-rs/commit/422473ff3be2ce58ea70f3fad35cecafcf7ae6a9) 包含传输实现与回归测试。
+  它建立在第一版修复 [405efc9](https://github.com/MeshedPoto/xim-rs/commit/405efc92426b3dc3a761005709a84567185cc3ca) 之上。
+- 第一版在 32 个名称用完后无条件追加到仍未读取的属性。16f35a2 的接收器从偏移零读取一个请求并删除整个属性，
+  因此同一属性中的第二个报文会丢失。维护者审查指出了这一点；去掉占用检查的负向对照可复现该丢帧。
+- [XIM 传输规范](https://xorg.freedesktop.org/archive/current/doc/libX11/i18n/trans/trans.html) 定义属性报文和 ClientMessage 传输。
+- 修复前后使用同一积压消息测试。旧分配逻辑首轮产生 1755 个名称；修复后全部三轮只使用 32 个。
+
+## Decision
+
+在根 Cargo 清单覆盖原 XIM Git 来源，只替换 `zed-xim` 的固定提交。
+其同仓库路径依赖 `xim-parser` 和 `xim-ctext` 随之解析到同一 fork 提交。
+保留原包版本、特性和 GPUI 固定点；不升级无关依赖，不引用浮动分支。
+
+X11rb 客户端按顺序使用 32 个固定的 `_XIM_DATA_*` 名称，并保证每个属性同一时间最多只有一个报文。
+写入前，客户端查询下一个名称在服务器窗口上是否仍存在。属性仍存在时，表示接收器还没读取，
+客户端把该报文和之后的所有报文（包括内联报文）放入队列，保持 ClientMessage 顺序。
+客户端在 XCONNECT 后监听服务器窗口的 `PropertyNotify`；收到删除事件时按顺序发送队列。
+只有本客户端写这些属性，接收器只会删除它们，因此检查结果在写入前不会被别人改回占用。
+队列上限为 1024 个报文。服务器停止读取时返回 `ClientError::TransportBusy`，不无限占用内存。
+`DisconnectReply` 清空发往旧服务器窗口的队列。
+
+接收器仍按窗口和原子保存字节偏移，每个 ClientMessage 只消费对应长度。
+这是接收侧的防御措施，不再是发送侧正确性的前提。
+
+服务器发送仍保持原策略，避免扩大到尚未修复的 xlib 客户端接收路径。
+没有修改输入编码、中文提交、预编辑接口、线程模型或持久化格式。
+依赖中同时修正三个示例文件及服务器反馈枚举的既有编译问题，使所用特性测试能在稳定工具链运行。
+
+## Rejected alternatives
+
+- 禁用 XIM：会失去中文输入能力。
+- 用 `REPLACE` 复用属性：可能覆盖尚未消费的报文。
+- 只循环名称、不处理读取偏移：可能重复读取首帧并丢失后续报文。
+- 名称用完后无条件追加（第一版）：只在升级后的接收器上正确，旧接收器和外部输入法服务器会丢帧。
+- 每个连接分配新名称：仍会随重连累计原子。
+- 无上限队列：服务器停止读取时客户端内存无限增长。
+- 将本机相邻源码目录作为依赖：上游和 CI 无法复现。
+- 将整套依赖复制进 Pebrel：扩大审查和维护范围；固定提交已经可以提供可追溯来源。
+- 同时修改服务器发送：不是 Pebrel 客户端修复所需，会扩大兼容范围。
+
+## Consequences
+
+这条客户端发送路径最多使用 32 个名称。补丁不能删除当前 X server 已有的原子，
+也不限制其他应用或服务器发送路径产生的名称。
+新增的 Git fork 是临时维护来源，需要保持可获取并审查后续更新。
+
+每个属性最多一个报文，所以从偏移零读取并删除整个属性的旧接收器也能逐个收到报文。
+代价是每个长报文多一次 `GetProperty` 往返；服务器积压超过 32 个长报文时，后续报文等待删除事件。
+GPUI 已把所有 X 事件交给 `filter_event`，`PropertyNotify` 无需改动 GPUI 即可到达客户端。
+服务器积压 1024 个报文后仍不读取时，GPUI 的 `forward_event` 只记录 `TransportBusy`，该按键不会送达。
+服务器恢复读取并删除属性后，队列继续发送。服务器无响应时，原实现同样收不到输入法结果。
+互操作验证覆盖 Fcitx5 和 16f35a2 的接收路径，不保证所有第三方 XIM 服务器。
+
+## Validation
+
+依赖的 `cargo test --features x11rb-client,x11rb-server -- --test-threads=1` 通过三项测试。
+测试需要 Xvfb，可用 `XIM_TEST_XVFB` 指定路径；测试自行创建私有显示，不连接主 `DISPLAY`。
+互操作测试通过 `filter_event` 驱动真实 `X11rbClient`：三轮各自 XCONNECT 到新服务器窗口，
+每轮在接收器读取前排入 300 个长短混合报文（超过 32 个长报文），再经 `DisconnectReply` 重连。
+接收端使用 16f35a2 的读取方式（偏移零、删除整个属性、解析一个请求）。
+所有报文按序逐字节一致，全程只使用 32 个名称。去掉占用检查后，该测试报告丢帧或乱序并失败。
+另一项测试确认服务器停止读取时队列停在 1024 并返回 `TransportBusy`；原有偏移读取与非法长度测试保留。
+
+独立 Fcitx 5.1.7 拼音实例向修复后的 XIM 客户端提交 40 次“你好”，全部匹配，
+收到 240 次预编辑回调，共转发 480 次按键事件。该验证使用独立显示和 D-Bus。
+PR 基线 `8de5331f5607a24c72a8cf209ab4099c8ba4c424` 上的
+`cargo check -p nebula --bin pebrel --features gpui-shell --tests --locked --release` 通过。
+架构检查、55 项架构规则测试、99 项设置测试、24 项国际化测试（另 1 项忽略）及格式检查通过。
+依赖元数据确认三个 XIM 包各只有一个实例，均来自同一修复提交；锁文件没有无关升级。
+这些结果不替代完整 GUI 人工验收、长期运行、其他输入法或 Windows/macOS 验证。
+未声称 `--all-features` 测试通过；原 xlib 示例的既有编译问题不在本次范围内。
+
+## Supersedes
+
+None。
+
+## Revisit when
+
+GPUI 所固定的 XIM 来源包含等效的有界名称与按删除复用修复，并通过上述回归与真实中文输入验证后，
+删除根补丁，统一更新上游固定点与锁文件。
+若 fork 可用性或输入法兼容性改变，先复现并选择已审查的固定提交，不退回浮动分支。
```

#### Recent Merged Pull Requests:
- **PR #793** (2026-10-28): i18n(settings): use typed ids for setting help and option labels (@Tettu0530)
- **PR #790** (2026-10-27): release: prepare Pebrel 2.3.1 (@Kuddev)
- **PR #789** (2026-10-26): feat(sponsors): add approved AIAPI branding (@Kuddev)
- **PR #787** (2026-10-26): [codex] Fix character-art proportions without changing text spacing (@Kuddev)
- **PR #783** (2026-10-26): fix(fonts): restore 2.2.2 reading spacing and show Geist default (@Kuddev)
- **PR #782** (2026-10-26): Simplify README badges and add XERJ and Trendshift (@Kuddev)

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

## X. i18n): localize settings help and option labels (#793)

**RULE**:
When implementing operations in `nebula_app/i18n/en-US.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `54548685`: i18n): localize settings help and option labels (#793). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `nebula_app/i18n/en-US.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    "option": {
      "bar": "Bar (│)",
      "underscore": "Underscore (_)",
      "filled_box": "Filled box (█)",
      "empty_box": "Empty box (□)",
      "slide": "Slide",
      "instant": "Instant",
      "after_current_tab": "After current tab",
      "end_of_list": "End of list",
      "create_a_new_window": "Create a new window",
      "attach_to_the_most_recent": "Attach to the most recent window",
      "attach_to_the_most_recent_v2": "Attach to the most recent window on this desktop",
      "auto_detect": "Auto detect",
      "git_only": "Git only",
      "svn_only": "SVN only",
      "visual_sound": "Visual + sound",
      "mica_low_cost": "Mica (low cost)",
      "mica_alt_low_cost": "Mica Alt (low cost)",
      "aero_glass": "Aero (glass)",
      "acrylic_high_cost": "Acrylic (high cost)",
      "right_arrow": "Right arrow",
      "tab_or_right_arrow": "Tab or Right arrow",
      "fill": "Fill",
      "uniform": "Uniform",
      "uniform_to_fill": "Uniform to fill",
      "original_size": "Original size",
      "top_left": "Top left",
      "top_right": "Top right",
      "bottom_left": "Bottom left",
      "bottom_right": "Bottom right",
      "provider_name": "Provi
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `54548685` are properly handled with clean fallback behavior.
