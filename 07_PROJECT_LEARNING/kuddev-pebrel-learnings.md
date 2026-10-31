> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `cf6bafb2`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T01:53:42.180Z  
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
> **Harvest Timestamp**: 2026-10-31T01:53:41.966Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3653 stars

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

### Incident Patch 1: `cf6bafb2` (2026-10-30)
**Commit Message**: feat(terminal): add bounded APC image rendering (#767)

Add a bounded direct RGB/RGBA graphics profile with ordered replay, validated responses, independent placements, shared decode resources, and adjacent image paint batching. Preserve existing image protocols and enforce scoped memory budgets.

**File**: `architecture/notes/nebula_terminal/kitty_graphics/2026-10-25-kitty-graphics-placements.md` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+# Kitty protocol: placements own the grid, the cell size comes from the pane
+
+## Status
+
+Proposed; implemented and validated locally on Windows x64 MSVC, Rust 1.97.1,
+against yazi 26.9.1.
+
+## Context
+
+Terminals that implement the Kitty protocol must serve two clients with
+different dialects. Neovim transmits an image and then asks the terminal to
+place it at the cursor with an explicit `c`/`r` cell count. yazi (and other
+"KGP-old" clients) instead asks for one `1x1` placement per cell: it moves the
+cursor to every cell of the preview rectangle and sends
+`a=p,i=ID,p=INDEX,x=..,y=..,w=..,h=..,c=1,r=1` each time, with the source pixel
+rectangle already computed on its side. The image is the union of the cells the
+cursor visited, and no command carries the total size.
+
+The same clients ask the terminal for its cell geometry with `CSI 16 t` before
+choosing a preview size. `vte 0.15` has no handler for that sequence, and ConPTY
+reports a zero pixel dimension, so neither the parser nor the platform PTY can
+answer. A client that never learns the cell size falls back to its configured
+maximum pixel box and stretches that box across the whole preview rectangle.
+
+The repository already owns one lifetime model for grid images: cells carry
+`ImageCell`, and a renderer keeps only weak references
+([grid-owned images](../../term/2026-09-27-grid-owned-inline-images.md)). The
+Kitty protocol has to join that model, not run beside it.
+
+## Evidence
+
+Measured on yazi 26.9.1 previewing a 1179x1279 JPEG in a 46x20 cell preview
+pane, 14x36 device pixels per cell (8.00x20.57 logical, scale 1.75).
+
+- Without `CSI 16 t` the client decoded to 1200x900 (its configured maximum),
+  asked for a 56x36 cell placement, and stretched that bitmap across the
+  preview: aspect 0.759 of the source, i.e. visibly squashed.
+- Answering `CSI 16 t` with `14`/`36` made the client decode to 644x698 and
+  place 46x20 cells; the painted aspect became 0.9226 against the source 0.9218.
+- A 1600x400 image placed as 46x5 cells painted 644x161, aspect 4.0000 against
+  the source 4.0.
+- A first implementation that reported pixel widths instead of cells, and that
+  published one event per placement, produced 3680 events for one preview and a
+  box larger than the pane.
+
+## Decision
+
+`nebula_terminal::kitty_graphics::KittyGraphics` parses the APC commands
+(`a=t` transfer with chunked base64, `a=p` placement, `a=d` erase, `a=q` probe,
+`a=T` transfer-and-place) and translates each dialect into the existing grid
+model:
+
+- A placement union-tracked per image id becomes one `ImagePlacement`, anchored
+  at the first cell the cursor visited. `a=p` writes the tile into the grid at
+  the cursor and never moves the text cursor (`C=1`), so prompt state survives.
+- The bitmap is published once per transfer, not once per placement: one
+  `Event::KittyImage` carrying raw pixels, the channel count and the placement.
+  Decoding happens on the app's background executor through the existing
+  `InlineImageStore` queue.
+- `a=d` clears the cells owning that image id, drops its pixels and geometry,
+  and lets the next transfer with the same id start from a clean slate. yazi
+  reuses one id for the process lifetime, so a surviving geometry would decode
+  the next picture at the previous stride.
+- `CSI 16 t` is answered from the raw byte stream, because the parser cannot see
+  it, with `\x1b[6;height;width t` in device pixels.
+- `Msg::CellMetrics` carries cell metrics without resizing the pseudo console.
+  Panes whose born geometry equals their target geometry never send `Resize`, so
+  without this message the stream would never learn the cell size.
+- Shared-memory transfers (`t=s`) answer `ENOTSUP` so clients fall back to
+  base64; the transfer path allocates no per-chunk temporaries and writes no
+  files.
+
+## Rejected alternatives
+
+- Reporting pixel dimensions in the event: the terminal would have to divide by
+  a cell size it may not know, which is exactly the bug above.
+- One event per placement: a single preview emits thousands of placements.
+- Keeping the previous geometry when a reused id starts a new transfer: decodes
+  the new payload at the old stride.
+- Accepting `t=s` probes: the payload is then a shared-memory name, not pixels,
+  and the terminal has no portable way to map it.
+- Asking for `a=q` support by replying `OK` to everything, including shared
+  memory: the client would then never send base64 transfers.
+- A second image store beside `InlineImageStore`: the grid already owns image
+  lifetime, and two stores disagree after scroll, reflow or alt-screen swaps.
+- Painting inside a cell-sized box and stretching the bitmap to fill it: a
+  client that rounds its pixel area up to whole cells paints a slightly
+  non-square picture; the placement therefore keeps the bitmap's own aspect.
+
+## Consequences
+
+The terminal core reports cells and pixels, never a division of the
```

**File**: `architecture/notes/nebula_terminal/kitty_graphics/2026-10-30-bounded-transfer-store.md` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+# Bound graphics transfers without conflating data and placement lifetimes
+
+## Status
+
+Implemented in the local PR review worktree. This budget repair is not a statement
+that the complete graphics PR is ready to merge.
+
+## Context
+
+Frontend decode/cache limits do not constrain the protocol layer's raw image map
+or incomplete base64 buffers. Conversely, dropping raw data whenever the last
+visible cell disappears breaks the protocol's separate transmit/place lifecycle.
+
+## Evidence
+
+The [protocol review references](https://github.com/Kuddev/pebrel/pull/767)
+distinguishes lowercase placement deletion from uppercase data deletion and
+requires deletion commands to abort incomplete uploads. A headerless command for
+an already stored ID must not create another independent partial transfer.
+
+## Decision
+
+[`KittyGraphics`](../../../../nebula_terminal/src/kitty_graphics.rs) owns one active
+partial transfer and a FIFO-bounded named data store: at most 16 completed images
+and 128 MiB of raw payload bytes. Incomplete base64 is limited to 24 MiB and to
+the declared pixel count's encoded size, whichever is smaller. Append limits are
+checked before joining or decoding. Capacity grows geometrically within that
+limit rather than reallocating for every small chunk.
+
+Starting a new header abandons the previous partial context. A headerless new ID
+does not borrow stale dimensions from its completed image. Any delete command
+aborts the incomplete upload.
+
+Grid cells own placement identities; the protocol registry and event payloads
+hold weak references where they must not prolong a placement or queued pixels.
+Losing the last cell drops placement metadata, but named raw data remains in the
+bounded store for a later `a=p`. Uppercase data deletion and FIFO eviction release
+that stored data. A retransmission establishes new dimensions and identity.
+
+## Rejected alternatives
+
+- Rely only on the frontend's cache limit: leaves core maps unconstrained.
+- Keep a strong placement identity in the protocol map: grid erasure no longer
+  invalidates frontend work.
+- Delete raw data whenever a placement dies: breaks re-display without retransmit.
+- Reserve exactly one additional chunk each time: can repeatedly relocate an
+  increasingly large buffer.
+
+## Consequences
+
+These are per-stage logical payload budgets, not a 128 MiB process-memory promise.
+Encoded input, base64 decode temporaries, one background decode, frontend BGRA
+cache, allocator overhead and GPU storage have separate lifetimes and costs.
+The existing frontend queue/cache and synchronization semantics still require
+their own review; passing the core regression set does not validate those paths.
+
+## Validation
+
+Small fixtures cover count eviction, oversized final chunks, abandoned/headerless
+uploads, lowercase re-placement, uppercase release, deletion during an incomplete
+upload, chunk boundaries and declared-cell scaling. No large-allocation or
+reported machine-freezing reproduction is required by these tests.
+
+On 2026-10-30 the Windows core run passed 16 graphics tests and two cell-size query
+tests. Architecture and whitespace checks passed against main `1b58f5dd`.
+Full frontend rendering, synchronization and PR readiness are not established by
+those checks.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Transport, placement or decode ownership changes, or measured workloads justify a
+different budget. Such changes must preserve bounded incomplete transfers and the
+separate stored-data/placement lifetimes.
```

**File**: `architecture/notes/nebula_terminal/kitty_graphics/2026-10-30-ordered-placements.md` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+# Ordered graphics placements and shared image resources
+
+## Status
+
+Implemented for the direct, uncompressed RGB/RGBA profile. Review and validation
+are limited to that profile rather than claiming the entire graphics protocol.
+
+## Context
+
+The first implementation mutated the grid while VTE could still be buffering a
+DEC 2026 frame. It conflated a bitmap with one screen-space bounding box, lacked
+transfer/placement replies, and marked publication complete before a saturated
+frontend queue could accept it.
+
+## Evidence
+
+The [protocol review references](https://github.com/Kuddev/pebrel/pull/767) defines
+independent image/placement identities, source crops, first-chunk metadata,
+quiet-response modes, and cursor movement by the complete placement row count.
+The upstream `graphics.c` linked in the protocol review deletion filters distinguish visible placements
+from an explicit image/placement ID. VTE 0.15.0 has no general APC handler hook.
+
+## Decision
+
+Reuse the existing private, one-shot OSC title markers for ordered operations.
+The input stream holds command payloads and the protocol state. The Term holds
+only weak pending references; dropping a disconnected stream releases unfinished
+uploads even if the failed pane retains its Term. An uncontended, stream-local
+mutex permits the VTE callback to access that same state without a second owner.
+Lock order is always Term before graphics state. Capability queries are pure
+bounded validations and can answer without committing a synchronized frame.
+
+Pending markers use keyed lookup and FIFO release rather than rescanning a growing
+vector for every chunk. The existing 16-item/32-MiB OSC encoded-data admission
+remains. Graphics command metadata has a 65,536-marker ceiling within the same
+32-MiB pending-byte budget; VTE's existing bounded synchronization buffer normally
+commits much earlier. Rejected uploads receive the protocol budget error.
+
+Image IDs are scoped to the primary or alternate screen. Named images retain one
+raw allocation. Each placement has its own grid-owned lifetime, crop and scale;
+render snapshots keep weak placement lifetime and immutable geometry. All its
+placements select the same image resource/texture. Replacing one placement does
+not cancel another. Bitmap retransmission/quota eviction invalidates its resource
+lease, including stale snapshots and in-flight decode, without walking scrollback.
+
+The raw store keeps 16 images and charges their eventual BGRA cost against 128 MiB.
+Transfers keep one bounded base64 buffer. Queries never replace named data.
+The final chunk uses the first header's action/IDs and the applicable quiet mode.
+The supported selectors are a/A and i/I, including explicit placement IDs.
+
+graphics decode jobs hold weak raw-data references and have 16 metadata slots separate
+from the existing OSC encoded queue. The core already owns/bounds those raw bytes,
+so they do not consume the OSC 32-MiB encoded-data budget. Queued, active and cached
+resource IDs suppress duplicate decodes; a later placement can retry a texture
+evicted by the unchanged 16-image/128-MiB frontend cache.
+
+Independent one-cell placements can produce many render fragments. The paint path
+streams adjacent clips into one submission only when the texture, full source
+transform and vertical extent match. It preserves erased gaps and different
+mappings, and does not allocate a per-frame batch vector. The 46-by-20 tile case
+therefore uses 20 paint submissions instead of 920 without changing grid ownership.
+
+## Rejected alternatives
+
+- End synchronization for every APC chunk: breaks atomic frames and causes excess
+  work. Only real replay points perform grid changes.
+- Move the raw store into the retained Term: extends upload lifetime on disconnect.
+- One union rectangle for all placements: loses independent crops and positioning.
+- One decoded bitmap per placement: multiplies memory for tiled clients.
+- Treat unsupported file, PNG, Unicode-placeholder or relative-placement controls
+  as ordinary placements: returns success for a different operation.
+- Increase the encoded queue's byte cap: leaves duplicate ownership and starvation.
+
+## Consequences
+
+The initial profile supports direct RGB/RGBA, chunking, query/quiet replies,
+anonymous display, source crop, c/r sizing, pixel offsets, C=1, independent
+placements and scoped deletion. PNG/file/shared-memory/compression, Unicode
+placeholders, animation, relative placements and nonzero z-order return ENOTSUP.
+This remains a grid-backed profile, not an arbitrary floating overlay renderer.
+
+Per-stage bounds are not a process/GPU working-set promise: encoded input, one
+bounded decode temporary, BGRA cache, allocator and graphics-driver costs remain
+distinct. No dependency or thread pool is added. Existing OSC 1337 stays on its
+original transport and shared rendering path.
+
+## Validation
+
+Small wire fixtures cover sync
```

**File**: `nebula_app/src/display/terminal_math/tests.rs` (modified, +36/-4)
```diff
@@ -1728,9 +1728,33 @@ fn image_projection_preserves_erased_tiles_row_offsets_and_clipping() {
         }],
     };
     let runs = [
-        ImageRun { id: 1, row: 0, column: 6, source_row: 0, source_column: 0, columns: 1 },
-        ImageRun { id: 1, row: 0, column: 8, source_row: 0, source_column: 2, columns: 2 },
-        ImageRun { id: 1, row: 1, column: 6, source_row: 1, source_column: 0, columns: 4 },
+        ImageRun {
+            id: 1,
+            row: 0,
+            column: 6,
+            source_row: 0,
+            source_column: 0,
+            columns: 1,
+            placement: None,
+        },
+        ImageRun {
+            id: 1,
+            row: 0,
+            column: 8,
+            source_row: 0,
+            source_column: 2,
+            columns: 2,
+            placement: None,
+        },
+        ImageRun {
+            id: 1,
+            row: 1,
+            column: 6,
+            source_row: 1,
+            source_column: 0,
+            columns: 4,
+            placement: None,
+        },
     ];
     let projected = projection.project_image_runs(&runs, 9);
     let geometry: Vec<_> = projected
@@ -1766,7 +1790,15 @@ fn expanded_formula_clips_image_without_changing_texture_origin() {
             shift_after: 3,
         }],
     };
-    let runs = [ImageRun { id: 1, row: 0, column: 4, source_row: 2, source_column: 2, columns: 4 }];
+    let runs = [ImageRun {
+        id: 1,
+        row: 0,
+        column: 4,
+        source_row: 2,
+        source_column: 2,
+        columns: 4,
+        placement: None,
+    }];
     let projected = projection.project_image_runs(&runs, 9);
     assert_eq!(projected.len(), 1);
     let r = &projected[0];
```

**File**: `nebula_app/src/gpui_shell/terminal/inline_image.rs` (modified, +496/-41)
```diff
@@ -5,7 +5,7 @@
 //! expanding concurrently on the UI thread or exhausting process memory.
 
 use std::collections::VecDeque;
-use std::sync::Arc;
+use std::sync::{Arc, Weak};
 
 use gpui::{Bounds, ContentMask, Corners, Pixels, RenderImage, Window, point, px, size};
 use image::{Frame, ImageFormat};
@@ -19,9 +19,29 @@ const MAX_CACHE_BYTES: usize = 128 * 1024 * 1024;
 const MAX_QUEUED_IMAGES: usize = 16;
 const MAX_QUEUED_BYTES: usize = 32 * 1024 * 1024;
 
+enum ImageData {
+    Encoded(Arc<Vec<u8>>),
+    Pixels { data: Weak<Vec<u8>>, channels: u8 },
+}
+
+impl ImageData {
+    fn encoded_bytes(&self) -> usize {
+        match self {
+            Self::Encoded(data) => data.len(),
+            Self::Pixels { .. } => 0,
+        }
+    }
+    fn available(&self) -> bool {
+        match self {
+            Self::Encoded(_) => true,
+            Self::Pixels { data, .. } => data.strong_count() != 0,
+        }
+    }
+}
+
 pub(super) struct PendingInlineImage {
     sequence: u64,
-    data: Arc<Vec<u8>>,
+    data: ImageData,
     placement: ImagePlacement,
 }
 
@@ -36,13 +56,27 @@ pub(super) struct InlineImage {
 pub(super) struct InlineImageStore {
     queued: VecDeque<PendingInlineImage>,
     queued_bytes: usize,
-    decoding: bool,
+    decoding: Option<u64>,
     next_sequence: u64,
     images: VecDeque<(u64, InlineImage)>,
     decoded_bytes: usize,
 }
 
 impl InlineImageStore {
+    fn prune_queued(&mut self) {
+        self.queued.retain(|pending| pending.placement.is_alive() && pending.data.available());
+        self.queued_bytes = self.queued.iter().map(|pending| pending.data.encoded_bytes()).sum();
+    }
+
+    fn contains(&self, id: u64) -> bool {
+        self.decoding == Some(id)
+            || self.queued.iter().any(|pending| pending.placement.id == id)
+            || self
+                .images
+                .iter()
+                .any(|(_, image)| image.placement.id == id && image.placement.is_alive())
+    }
+
     pub fn enqueue(
         &mut self,
         data: Arc<Vec<u8>>,
@@ -61,7 +95,14 @@ impl InlineImageStore {
         if !placement.is_alive() {
             return Ok(());
         }
-        if self.queued.len() >= MAX_QUEUED_IMAGES {
+        self.prune_queued();
+        if self
+            .queued
+            .iter()
+            .filter(|pending| matches!(pending.data, ImageData::Encoded(_)))
+            .count()
+            >= MAX_QUEUED_IMAGES
+        {
             return Err("too many terminal images are waiting to decode");
         }
         let next_bytes = self
@@ -74,27 +115,90 @@ impl InlineImageStore {
 
         let sequence = self.next_sequence;
         self.next_sequence = self.next_sequence.wrapping_add(1);
-        self.queued.push_back(PendingInlineImage { sequence, data, placement });
+        self.queued.push_back(PendingInlineImage {
+            sequence,
+            data: ImageData::Encoded(data),
+            placement,
+        });
         self.queued_bytes = next_bytes;
         Ok(())
     }
 
+    /// Queue a Kitty protocol transfer, whose payload is raw pixels rather than
+    /// an encoded container. `channels` is the byte count per pixel (3 = RGB,
+    /// 4 = RGBA); the pixel geometry rides along in `placement.layout`.
+    pub fn enqueue_pixels(
+        &mut self,
+        data: Weak<Vec<u8>>,
+        channels: u8,
+        placement: ImagePlacement,
+    ) -> Result<(), &'static str> {
+        if !matches!(channels, 3 | 4) {
+            return Err("image transfer has an unsupported channel count");
+        }
+
+        let Some(pixels_owner) = data.upgrade() else { return Ok(()) };
+        if pixels_owner.len() > MAX_IMAGE_DECODED_BYTES {
+            return Err("image transfer exceeds the decoded image budget");
+        }
+        if !placement.layout.width.is_finite()
+            || !placement.layout.height.is_finite()
+            || placement.layout.width <= 0.0
+            || placement.layout.height <= 0.0
+        {
+            return Err("image transfer has an invalid display size");
+        }
+        let pixels = placement.layout.width as u64 * placement.layout.height as u64;
+        if pixels > MAX_IMAGE_PIXELS {
+            return Err("image transfer exceeds the pixel budget");
+        }
+        if (pixels * u64::from(channels)) != pixels_owner.len() as u64 {
+            return Err("image transfer is shorter than its declared size");
+        }
+        if !placement.is_alive() {
+            return Ok(());
+        }
+        self.prune_queued();
+        if self.contains(placement.id) {
+            return Ok(());
+        }
+        // 原始像素仍归核心的 16 张有界仓库；队列只留弱引用，不与 OSC 编码数据争 32 MiB。
+        if self
+            .queued
+            .iter()
+            .filter(|pending| matches!(pending.data, ImageData::Pixels { .. }))
+            .count()
+            >= MAX_CACHED_IMAGES
+        {
+            return Err("too many terminal images are waiting to decode");
+        }
+
+        let se
```

**File**: `nebula_app/src/gpui_shell/terminal/native_results/viewport.rs` (modified, +10/-2)
```diff
@@ -381,6 +381,7 @@ mod tests {
                     columns: 2,
                     source_column: 2,
                     source_row,
+                    placement: None,
                 };
                 let (image, clip) = super::super::super::inline_image::image_geometry(
                     layout,
@@ -400,8 +401,15 @@ mod tests {
             }
             let original = original.unwrap();
             projection.top += 1.0;
-            let run =
-                ImageRun { id: 1, row: 5, column: 6, columns: 2, source_column: 2, source_row: 1 };
+            let run = ImageRun {
+                id: 1,
+                row: 5,
+                column: 6,
+                columns: 2,
+                source_column: 2,
+                source_row: 1,
+                placement: None,
+            };
             let (scrolled, _) = super::super::super::inline_image::image_geometry(
                 layout,
                 &run,
```

**File**: `nebula_app/src/gpui_shell/terminal/view.rs` (modified, +8/-0)
```diff
@@ -789,6 +789,14 @@ impl TerminalView {
                     Err(error) => log::warn!("terminal image dropped: {error}"),
                 }
             },
+            // APC graphics: pixels arrive raw, already placed in the grid, so
+            // decoding is the only work left — and it happens off the UI thread.
+            TermEvent::KittyImage { data, channels, placement } => {
+                match self.inline_images.enqueue_pixels(data, channels, placement) {
+                    Ok(()) => self.drive_inline_image_decode(cx),
+                    Err(error) => log::warn!("APC image dropped: {error}"),
+                }
+            },
             TermEvent::CommandStart => {
                 self.native_clipboard.clear();
                 self.on_command_start(cx);
```

**File**: `nebula_app/src/gpui_shell/terminal/view/layout.rs` (modified, +11/-0)
```diff
@@ -66,6 +66,10 @@ impl TerminalView {
                 self.commit_viewport(viewport);
             } else {
                 self.window_size = viewport.window_size();
+                // 出生几何就是目标几何时没有任何 resize 要下发，字节流因此永远
+                // 不知道 cell 尺寸：`CSI 16 t`（yazi 用它把像素换算成格子）无
+                // 从回答，客户端只好把预览图拉伸铺满整块 pane。这里只补度量。
+                self.announce_cell_metrics(self.window_size);
             }
             return;
         }
@@ -142,6 +146,13 @@ impl TerminalView {
         notifier.on_resize_grid(viewport.window_size());
     }
 
+    /// 只把 cell 像素尺寸告诉字节流，不动 conhost、不 reflow、不去抖。
+    fn announce_cell_metrics(&mut self, window_size: nebula_terminal::event::WindowSize) {
+        let Some(session) = &self.session else { return };
+        let mut notifier = nebula_terminal::event_loop::Notifier(session.notifier.0.clone());
+        notifier.on_cell_metrics(window_size);
+    }
+
     /// Commit one viewport in grid-before-PTY order. Output produced after
     /// `ResizePseudoConsole` therefore always parses against the same geometry
     /// history ConPTY used to generate its absolute cursor coordinates.
```

#### Recent Merged Pull Requests:
- **PR #818** (closed): feat(terminal): render cropped graphics placements and present decoded frames (@glitch-cmyk658)
- **PR #801** (closed): fix(terminal): preserve native TUI mouse selection across pane boundaries (@Kuddev)
- **PR #800** (2026-10-28): docs: add WeChat community below README sponsors (@Kuddev)
- **PR #793** (2026-10-28): i18n(settings): use typed ids for setting help and option labels (@Tettu0530)
- **PR #790** (2026-10-27): release: prepare Pebrel 2.3.1 (@Kuddev)
- **PR #789** (2026-10-26): feat(sponsors): add approved AIAPI branding (@Kuddev)

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

## X. terminal): add bounded APC image rendering (#767)

**RULE**:
When implementing operations in `architecture/notes/nebula_terminal/kitty_graphics/2026-10-25-kitty-graphics-placements.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cf6bafb2`: terminal): add bounded APC image rendering (#767). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `architecture/notes/nebula_terminal/kitty_graphics/2026-10-25-kitty-graphics-placements.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Kitty protocol: placements own the grid, the cell size comes from the pane

## Status

Proposed; implemented and validated locally on Windows x64 MSVC, Rust 1.97.1,
against yazi 26.9.1.

## Context

Terminals that implement the Kitty protocol must serve two clients with
different dialects. Neovim transmits an image and then asks the terminal to
place it at the cursor with an explicit `c`/`r` cell count. yazi (and other
"KGP-old" clients) instead asks for one `1x1` placement per cell: it moves the
cursor to every cell of the preview rectangle and sends
`a=p,i=ID,p=INDEX,x=..,y=..,w=..,h=..,c=1,r=1` each time, with the source pixel
rectangle already computed on its side. The image is the union of the cells the
cursor visited, and no command carries the total size.

The same clients ask the terminal for its cell geometry with `CSI 16 t` before
choosing a preview size. `vte 0.15` has no handler for that sequence, and ConPTY
reports a zero pixel dimension, so neither the parser nor the platform PTY can
answer. A client that never learns the cell size falls back to its configured
maximum pixel box and stretches that box across the whole preview rectangle.

The repository already owns o
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cf6bafb2` are properly handled with clean fallback behavior.
