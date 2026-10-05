# Forensic Learning Record (Deep Inspection): Kuddev/pebrel

> **Canonical Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:01:01.261Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2953 stars

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
    jint meta[] = {columns, rows, cx, cy, visible && in_viewport, argb(colors.background),
        argb(colors.cursor_has_value ? colors.cursor : colors.foreground), static_cast<jint>(cursor_style),
        static_cast<jint>(std::min(scrollbar.total, uint64_t{INT32_MAX})),
        static_cast<jint>(std::min(scrollbar.offset, uint64_t{INT32_MAX}))};
    env->SetIntArrayRegion(metadata, 0, 10, meta);
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

class TerminalFrame(val rows: Array<TerminalRow?>, val meta: IntArray, val wrapped: BooleanArray? = null) {
    val columns get() = meta[0]
    val cursorX get() = meta[2]
    val cursorY get() = meta[3]
    val cursorVisible get() = meta[4] != 0
    val background get() = meta[5]
    val cursorColor get() = meta[6]
    val cursorStyle get() = meta[7]
    val scrollTotal get() = meta.getOrElse(8) { rows.size }
    val scrollOffset get() = meta.getOrElse(9) { 0 }
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
        val meta = IntArray(10)
        NativeBridge.render(pointer(), rowCache, meta)
        // Unchanged immutable rows are shared across frames; changed rows are replaced by JNI.
        return TerminalFrame(rowCache.copyOf(), meta)
    }
    @Synchronized fun scroll(lines: Int) = NativeBridge.scroll(pointer(), lines)
    @Synchronized fun scrollTo(offset: Int) = NativeBridge.scrollTo(pointer(), offset.coerceAtLeast(0))
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

### Core Architecture Module: `nebula_app/src/ai_hook/bridges.rs`
```
//! Identical provider adapters are installed on Windows and SSH hosts.

pub(super) const OPENCODE_PLUGIN_JS: &str = include_str!("../../res/hooks/opencode.js");
pub(super) const PI_EXTENSION_TS: &str = include_str!("../../res/hooks/pi.ts");

```

### Core Architecture Module: `nebula_app/src/ai_hook/event.rs`
```
//! Normalized provider facts. No terminal scanning, I/O or pane mutation.

use super::payload::{MESSAGE_MAX_CHARS, truncate};

/// What a lifecycle event means for the pane's turn state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AiHookKind {
    /// Agent process/session became live; usually the earliest session-id edge.
    SessionStart,
    /// The user submitted a prompt: a turn is running.
    PromptSubmit,
    /// A tool completed; clears a stale permission/question wait.
    ToolComplete,
    /// The turn finished; the CLI waits for the next instruction.
    TurnDone,
    /// An explicit permission request or input question is blocking the CLI.
    NeedsAttention,
    /// Agent session shut down and no longer owns the pane.
    SessionEnd,
}

/// A stopped turn is not necessarily a successful answer. Only explicit
/// provider result metadata may classify it; never scan assistant prose.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiTurnOutcome {
    /// Older Pi bridges omit result metadata; preserve their activity edge.
    Unspecified,
    Succeeded,
    Failed,
    Cancelled,
    Incomplete,
    Unknown,
}

/// Provider 的 Hook 能力并不对称。这里描述 Nebula 当前实际安装的桥接能力，
/// 避免上层把“有生命周期 Hook”误当成“也有权限上下文或事件顺序保证”。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AiHookCapabilities {
    /// The installed bridge reports turn starts as well as completions.
    pub lifecycle: bool,
    /// The bridge also reports explicit waiting/resumption. This is separate
    /// from turn boundaries: Pi's extension has no permission callback.
    pub attention_events: bool,
    pub attention_context: bool,
    pub background_tasks: bool,
    /// Nebula 自己的 bridge 是否为事件盖了单调序号。**没有任何 provider 提供
    /// 原生顺序字段**：opencode/pi 的序号由我们注入的 plugin/extension 生成
    /// （启动纪元 × 1e6 + 自增），claude/codex 的 hook 完全没有顺序信息，只能
    /// 依赖本地到达顺序。名字里是 bridge 而不是 provider，正是这个原因。
    pub bridge_sequence: bool,
    pub serialized_delivery: bool,
}

/// Versioned contract of the installed Codex command hooks. Legacy notify has
/// no start/permission authority; it remains available until native hooks run.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CodexHookMode {
    Turns,
    Full,
}

pub fn capabilities_for(source: &str) -> AiHookCapabilities {
    match source {
        "claude" => AiHookCapabilities {
            lifecycle: true,
            attention_events: true,
            attention_context: true,
            background_tasks: true,
            bridge_sequence: false,
            serialized_delivery: false,
        },
        "opencode" => AiHookCapabilities {
            lifecycle: true,
            attention_events: true,
            attention_context: true,
            background_tasks: false,
            bridge_sequence: true,
            serialized_delivery: true,
        },
        "pi" | "omp" => AiHookCapabilities {
            lifecycle: true,
            attention_events: false,
            attention_context: false,
            background_tasks: false,
            bridge_sequence: true,
            serialized_delivery: false,
        },
        // Codex notify 当前只给 turn-complete；没有 permission payload，也没有
        // 可验证的 provider sequence。接收顺序只能代表本机实际到达顺序。
        "codex" => AiHookCapabilities {
            lifecycle: false,
            attention_events: false,
            attention_context: false,
            background_tasks: false,
            bridge_sequence: false,
            serialized_delivery: false,
        },
        "kimi" | "copilot" | "grok" => AiHookCapabilities {
            lifecycle: true,
            attention_events: true,
            attention_context: true,
            background_tasks: false,
            bridge_sequence: false,
            serialized_delivery: false,
        },
        "cursor" => AiHookCapabilities {
            lifecycle: true,
            attention_events: false,
            attention_context: false,
            background_tasks: false,
            bridge_sequence: false,
            serialized_delivery: false,
        },
        _ => AiHookCapabilities {
            lifecycle: false,
            attention_events: false,
            attention_context: false,
            background_tasks: false,
            bridge_sequence: false,
            serialized_delivery: false,
        },
    }
}

/// Agent 当前的权限档位。**这不是「正在等你批准」**，两者必须分开：
///
/// * `BypassPermissions` 是一个持续状态——用户用 `--dangerously-skip-permissions`
///   起的会话根本不会来问，把它当成 awaiting 会让徽标永远误亮；
/// * `NeedsAttention` 是一次瞬时事件，只有真的卡住等人时才发。
///
/// 合起来才能正确回答「这个 pane 现在是不是在无人监督地改我的仓库」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AiPermissionMode {
    /// 每次动作都会问。
    Default,
    /// 自动同意文件编辑，其余仍会问。
    AcceptEdits,
    /// 全部跳过：不会有任何权限请求抵达。
    BypassPermissions,
    /// 只读规划，不落盘。
    Plan,
}

impl AiPermissionMode {
    /// Claude 的 hook 载荷直接带 `permission_mode`，这比读 agent 进程的 argv
    /// 可靠得多——会话中途切档、包装脚本启动、`npx claude` 都不会反映在命令行
    /// 里。Windows 上读别的进程命令行还要 WMI 或 PEB 遍历，代价与收益完全不成
    /// 比例，所以这里只认 provider 自己声明的值，读不到就是 `None`。
    pub(super) fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "default" => Some(Self::Default),
            "acceptEdits" | "accept_edits" => Some(Self::AcceptEdits),
            "bypassPermissions" | "bypass_permissions" => Some(Self::BypassPermissions),
            "plan" => Some(Self::Plan),
            _ => None,
        }
    }

    /// 这一档会不会产生权限请求。用来判断一个没有明确类型的通知该不该被解释
    /// 成「等你批准」。
    pub fn can_ask_for_permission(self) -> bool {
        !matches!(self, Self::BypassPermissions)
    }
}

/// Claude `Stop` 会携带本回合的后台 Task 列表。主回合停止不等于后台
/// subagent 已经停止；至少一个 task 仍 running 时，Pane 必须保持 Working。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AiBackgroundTasks {
    pub active: u32,
    pub total: u32,
}

/// 权限/等待输入事件的可行动上下文。`raw_context` 是经过字段脱敏、深度和
/// 体积限制的副本；它绝不能等同于 provider 的原始 stdin，也不能进 Debug 日志。
#[derive(Clone)]
pub struct AttentionContext {
    pub source: String,
    pub pane_id: Option<u64>,
    pub session_id: Option<String>,
    pub event_kind: AiHookKind,
    pub event_id: Option<String>,
    pub bridge_sequence: Option<u64>,
    /// Provider 声明的 Unix 时间戳（毫秒）；没有可靠字段时保持 None。
    pub occurred_at_ms: Option<u64>,
    /// Nebula 完成 envelope 解析的 Unix 时间戳（毫秒）。
    pub received_at_ms: u64,
    pub cwd: Option<String>,
    pub project: Option<String>,
    pub git_branch: Option<String>,
    pub permission_or_tool: Option<String>,
    /// 事件抵达时 agent 声明的权限档位。`BypassPermissions` 时这条 attention
    /// 一定不是「等你批准」（那种会话不会来问），只可能是等你输入——UI 的文案
    /// 必须据此区分，否则用户会以为有个批准按钮在等他。
    pub permission_mode: Option<AiPermissionMode>,
    pub message: Option<String>,
    pub selection: Option<String>,
    pub raw_context: Option<String>,
}

impl std::fmt::Debug for AttentionContext {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("AttentionContext")
            .field("source", &self.source)
            .field("pane_id", &self.pane_id)
            .field("session_id", &self.session_id)
            .field("event_kind", &self.event_kind)
            .field("event_id", &self.event_id)
            .field("bridge_sequence", &self.bridge_sequence)
            .field("occurred_at_ms", &self.occurred_at_ms)
            .field("received_at_ms", &self.received_at_ms)
            .field("cwd", &self.cwd)
            .field("project", &self.project)
            .field("git_branch", &self.git_branch)
            .field("permission_or_tool", &self.permission_or_tool)
            .field("permission_mode", &self.permission_mode)
            .field("message", &self.message)
            .field("selection_chars", &self.selection.as_ref().map(|s| s.chars().count()))
            .field("raw_context_bytes", &self.raw_context.as_ref().map(String::len))
            .finish()
    }
}

impl AttentionContext {
    /// 通知正文只放定位和请求摘要；选区正文、raw context 从不进入系统通知。
    pub fn summary_for_pane(&self, pane_id: u64) -> String {
        let mut parts = Vec::with_capacity(4);
        if let Some(project) = self.project.as_deref().or(self.cwd.as_deref()) {
            parts.push(truncate(project, 120));
        }
        parts.push(format!("Pane {pane_id}"));
        if let Some(request) = self.permission_or_tool.as_deref() {
            parts.push(truncate(request, 100));
        }
        if let Some(message) = self.message.as_deref() {
            let message = truncate(message, MESSAGE_MAX_CHARS);
            if !parts.iter().any(|part| part == &message) {
                parts.push(message);
            }
        }
        if self.selection.is_some() {
            parts.push("selection context".to_owned());
        }
        parts.join(" · ")
    }
}

/// A typed AI-CLI lifecycle event, parsed from one pipe connection.
#[derive(Debug, Clone)]
pub struct AiHookEvent {
    /// Older Claude notifications omit their type. They may signal attention
    /// during work, but cannot reopen an idle/completed turn.
    pub(super) legacy_attention: bool,
    pub(crate) codex_hooks: Option<CodexHookMode>,
    /// Identity supplied by our bridge on an authenticated SSH channel. Kept
    /// separate from local kernel PIDs; never used for host process queries.
    pub(crate) remote_process: Option<String>,
    pub(crate) turn_id: Option<String>,
    /// Compaction starts hooks inside an existing turn; it is not an idle edge.
    pub(crate) session_compacted: bool,
    pub answer: Option<crate::assistant_answer::AssistantAnswer>,
    pub answer_cwd: Option<std::path::PathBuf>,
    /// Pane hosting the CLI (from `NEBULA_PANE_ID`); `None` falls back to the
    /// focused pane (only happens when the env was stripped along the way).
    pub pane: Option<u64>,
    /// AI CLI identity, used as the toast title.
    pub source: String,
    pub kind: AiHookKind,
    pub turn_outcome: AiTurnOutcome,
    /// Human text when the event carries one (claude's notification message,
    /// codex's last assistant message).
    p
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #464** (2026-10-05): **[Bug] v2.1.1 Windows 版本被卡巴斯基行为分析检测为 PDM.Win32.Generic**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 26H1  ### Pebrel version / 版本号  2.1.1  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Claude Code, Pi  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Startup crash / hang / cannot exit — 启动崩溃、卡死、无法退出  ### Did it work in a previous version? / 旧版本是否正常？  Yes, it worked before / 旧版本正常，新版本坏了  ### Can you reproduce it? / 复现概率  Sometimes / 偶尔  ### Steps to reproduce / 复现步骤  GitHub Release 最新版本 v2.1.1 ，当时运行了Claude Code 和Pi，然后突然卡巴斯基21.26.4.406把进程停了，程序也删掉了，我当时Pi还在运行😒之前的版本没有遇到过这个问题  ### Expected behavior / 期望结果  卡巴斯基不报毒。  ### Actual behavior / 实际结果  卡巴斯基标准版的“系统监控”将运行中的 pebrel.exe 检测为 PDM:Trojan.Win32.Generic，随后终止进程并删除对象，提示需要清除并重启计算机。  ### Logs / screenshots / 日志或截图  [电脑卡巴斯基报告.csv](https://github.com/user-attachments/files/33003792/default.csv) [卡巴斯基Kaspersky Threat Intelligence Portal报告](https://opentip.kaspersky.com/850A2567DFBD0E42DA790D8C67BA4C3B/results?tab=lookup)中也显示BSS:Trojan.Win32.Generic <img width="2514" height="1005" alt="Image" src="https://github.com/user-attachments/assets/a91473eb-1b9e-421f-b036-f41048e80ff7" /> <img width="1898" height="1404" alt="Image" src="https://github.com/user-attachments/assets/3996ae4f-504c-4ba2-94fa-d977eb93a45e" /> 已重新下载GitHub Pebrel-v2.1.1-windows-x64.zip，其 SHA256 与发
  **Post-Mortem & Fix Analysis**:
  > 这个事情就严重了，
  > 关注
  > 可以使用 OpenTip 向卡巴斯基实验室提交样本报告，我觉得应该是误报，可以让他们那边人工复审下，卡巴是偶尔会对这种有文件访问形式的相关报 这个，我之前装那个cortexkit/aft 它也是直接报这个

- **Issue #420** (2026-10-02): **[Bug] latex公式存在语法分析问题**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  win 26H2  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Claude Code  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Terminal rendering / scrolling / selection / garbled text — 终端渲染、滚动、选区、乱码  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Often (>50%) / 经常  ### Steps to reproduce / 复现步骤  1.利用打开claude code令其输出latex的行内公式：$ ... $ 2.其中有概率行内公式没有渲染为公式，依旧为代码形式显示。 3.其中$0$这类显示单个数字的公式渲染概率为100%，同时若latex公式出现换行时，其依旧不会渲染。同时还有其他情况没有探明其复现步骤，有概率不会渲染。  ### Expected behavior / 期望结果  所有形式的latex公式可以正常在终端中渲染输出。  ### Actual behavior / 实际结果  <img width="1007" height="78" alt="Image" src="https://github.com/user-attachments/assets/ec7f0e44-6ccb-48c2-a3e8-4f1988df9014" />  <img width="1029" height="53" alt="Image" src="https://github.com/user-attachments/assets/c039f798-a447-4dfb-9b55-2cd7aec5d6b6" />  ### Logs / screenshots / 日志或截图  Reported from Pebrel Settings (Pebrel 2.0.0).  Platform: windows x86_64 Build: release  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, privat
  **Post-Mortem & Fix Analysis**:
  > <img width="1079" height="441" alt="Image" src="https://github.com/user-attachments/assets/fa0ba16d-9cd7-4ae7-ad42-cb1cc4db718a" /> 由于其随机的不渲染，但是若要求单独输出公式大概率会有渲染。  <img width="775" height="120" alt="Image" src="https://github.com/user-attachments/assets/f703b3ef-1de2-4fdc-9262-d491df7c751b" />
  > 请下载2.1.1验收修复；如再次出现请再开issue，感谢反馈。

- **Issue #395** (2026-09-30): **[Bug] Windows 终端代理对带 http:// 的系统代理地址重复添加协议头，导致 Pi 启动失败**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 25H2 125% monitor 1  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  cmd  ### Program running in the pane / 面板里正在跑的程序  Pi  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  AI agent (Claude Code / Codex / Pi / OMP) — AI Agent 集成与状态  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤   1. 使用类似ProxyPin的软件开启系统代理。    2. 当时 Windows 注册表中的配置为：        路径：`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings`        ```text       ProxyEnable = 1       ProxyServer = http://127.0.0.1:9099       ```     3. 开启 Pebrel 的“终端代理”功能（配置文件中为 `terminal_proxy=1`）。    4. 在 Pebrel 中新建 CMD 标签页，执行：        ```bat       set HTTP_PROXY       set HTTPS_PROXY       pi       ```  ### Expected behavior / 期望结果  pi可以正常启动  ### Actual behavior / 实际结果  上述操作会导致多加一个协议头成为"http://http://127.0.0.1:9099"， 导致pi出现如下错误，拒绝启动，所有抓包软件应该都有这个问题   ### Logs / screenshots / 日志或截图  ``` InvalidArgumentError: invalid url      at Object.parseOrigin  (file:///D:/Tools/DevData/npm/node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks/chunk-OJP47DM6.js:2:35  940)      at new Client2  (file:///D:/Tools/DevData/npm/node_modules/@earendil-works/pi-coding-agent/dist/bund
  **Post-Mortem & Fix Analysis**:
  > 已在 main 修复：提交 d114ea83（随 PR #366 合入）。  Windows 系统代理地址已有 `http://`、`socks5://` 等协议头时会原样保留，仅对裸地址补充协议，避免生成 `http://http://...` 后污染新终端的代理环境变量。对应回归覆盖本报告的 `http://127.0.0.1:9099`，以及分协议配置、大小写协议、凭据和 IPv6 地址。  按已合入修复结项。请使用包含上述提交的构建验证；这里记录的是主分支修复状态，不将其视为旧发布包已经更新。若在包含修复的构建中新建终端后仍复现，请重新打开并补充版本与复现步骤。

- **Issue #363** (2026-09-29): **[Bug] Macos没有终端文字没有高亮显示**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  macos27  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  zsh  ### Program running in the pane / 面板里正在跑的程序  ssh client / remote shell — 远程 shell  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Terminal rendering / scrolling / selection / garbled text — 终端渲染、滚动、选区、乱码  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  打开即可看见  ### Expected behavior / 期望结果  添加文字颜色  ### Actual behavior / 实际结果  没有文字颜色  ### Logs / screenshots / 日志或截图  没有文字颜色  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. It is missing details we need before anyone can reproduce it, so it is parked as `needs-info`. Please edit the issue and fill in: 感谢反馈。目前缺少复现所需的信息，已标记 `needs-info`。请**编辑 issue** 补齐以下内容，补齐后标签会自动移除：  - **Steps to reproduce / 复现步骤**: numbered steps from launch to the failing moment / 从启动开始按序写到出错那一步  Reports without these are closed after 14 days of silence. / 14 天无补充将关闭。

- **Issue #362** (2026-09-29): **[Bug] 部分键转换成了非 ASCII 字符**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  Macos27  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  zsh  ### Program running in the pane / 面板里正在跑的程序  ssh client / remote shell — 远程 shell  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  SSH / proxy / jump host — SSH、代理、跳板  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  部分键转换成了非 ASCII 字符  ### Expected behavior / 期望结果  修复BUG  ### Actual behavior / 实际结果  部分键转换成了非 ASCII 字符  ### Logs / screenshots / 日志或截图  部分键转换成了非 ASCII 字符  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. It is missing details we need before anyone can reproduce it, so it is parked as `needs-info`. Please edit the issue and fill in: 感谢反馈。目前缺少复现所需的信息，已标记 `needs-info`。请**编辑 issue** 补齐以下内容，补齐后标签会自动移除：  - **Steps to reproduce / 复现步骤**: numbered steps from launch to the failing moment / 从启动开始按序写到出错那一步  Reports without these are closed after 14 days of silence. / 14 天无补充将关闭。

- **Issue #361** (2026-09-30): **[Bug] S3 备份无法连接阿里云 OSS**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  windows11  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Other / 其他  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  - 存储服务：阿里云 OSS，S3 兼容接口 - 地域：华北 2（北京），`cn-beijing` 1. 打开 **设置 → 备份**，存储位置选择 S3 兼容存储。 2. 在“连接”页填写：    - 服务地址：`https://s3.oss-cn-beijing.aliyuncs.com`    - 区域：`cn-beijing`    - 存储桶：`<bucket>`    - Access Key ID / Secret Access Key：一个 RAM 用户的 AccessKey，该用户已被授予这个桶的列举、读取、写入权限 3. 点击 **检查连接并继续**。  ### Expected behavior / 期望结果  连接检查通过，进入“备份密码”步骤。   ### Actual behavior / 实际结果  备份操作失败: 认证失败：检查 S3 Access Key / Secret Key / 区域   ### Logs / screenshots / 日志或截图  排查结果  用同一组 AccessKey、同一个桶和地域，在 Pebrel 之外手动发送只读的列举请求（ListObjects）：  | 请求方式 | 地址 | 结果 | |---|---|---| | OSS 原生接口 | `https://<bucket>.oss-cn-beijing.aliyuncs.com/` | `200` 成功 | | S3 SigV4，虚拟主机式 | `https://<bucket>.s3.oss-cn-beijing.aliyuncs.com/` | `200` 成功 | | S3 SigV4，路径式 | `https://s3.oss-cn-beijing.aliyuncs.com/<bucket>` | `403` |   - AccessKey、Secret、RAM 权限和地域都没有问题，因为虚拟主机式请求能成功。 - 阿里云 OSS 的 S3 兼容接口**拒绝路径式请求**，只接受虚拟主机式。  另外试过把服务地址改成 `

- **Issue #354** (2026-09-30): **[Bug] 备份后无法更改存储位置**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 24H2  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Settings / theme / layout / blur — 设置页、主题、布局、模糊背景  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. 设置 2. 备份 3. 更改 4. 点击存储位置下拉框 5. 点击无响应  ### Expected behavior / 期望结果  可以点击切换  ### Actual behavior / 实际结果  点击下拉框无响应  ### Logs / screenshots / 日志或截图  <img width="1293" height="740" alt="Image" src="https://github.com/user-attachments/assets/ff9715bc-3dbc-4c25-ab13-f9834a264604" />  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > 已由 PR #365 修复并合入 main（合并提交 84b007f5）。  原因是备份抽屉与下拉菜单的绘制层级冲突，菜单被抽屉覆盖。现在抽屉先绘制，下拉菜单位于其上，可以正常选择存储位置。  已有针对本 Issue 的回归 `issue_354_storage_menu_accepts_mouse_and_keyboard_inside_drawer`，覆盖真实鼠标选择、键盘选择、Escape 关闭菜单，以及取消抽屉后保留原存储配置。  按已合入修复结项。请使用包含上述提交的构建验证；这里记录的是主分支修复状态，不将其视为旧发布包已经更新。若仍复现，请重新打开并补充版本与操作步骤。

- **Issue #330** (2026-09-30): **[Bug] 代理加载环境变量问题**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows11 25H2  ### Pebrel version / 版本号    Version: 1.9.1  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  Windows PowerShell 5.1  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  SSH / proxy / jump host — SSH、代理、跳板  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1.填写自定义代理 2.开启pebrel系统代理/关闭pebrel系统代理 3.开启新终端去Invoke-WebRequest https://www.google.com -UseBasicParsing -TimeoutSec 15  ### Expected behavior / 期望结果  网络页里填好自定义代理地址后，新开的本地终端会直接使用这个代理，不必再打开「系统代理」。 代理方式选「自定义代理」，并填上地址，例如 127.0.0.1:7897。之后新开的终端会带上 http_proxy、https_proxy 和 all_proxy。已经打开的终端不会变，需要再开一个。Windows 下变量名用小写，这样本机程序和 WSL 里的 curl 都能认到。 「系统代理」开关仍然只负责「跟随系统」：打开后，新终端才读取当前 Windows 系统代理。自定义地址不看这个开关。跳板和自定义命令只给 SSH 用，不会写进终端环境变量。 本机 GNU 工具链的 dlltool 无法启动，代理相关测试没有编译跑过。重新编译 Pebrel 后，新开一个终端，用 $env:http_proxy 可以核对地址。  <img width="2484" height="828" alt="Image" src="https://github.com/user-attachments/assets/3f4518c9-8502-4ec3-a15f-eba5516070b6" />  ### Actual behavior / 实际结果  1.开启代理和系统代理<img width="1695" height="911" alt="Image" src="https://github.com/user-attachments/assets/3aef6b3b-5ae4-4ff7-8afe-4aa0e3ce3655" /> 2.新建终端去测试代理可用性  <img width="1695
  **Post-Mortem & Fix Analysis**:
  > <!-- Failed to upload "pebrel-1.9.0-dev-src.zip" --> 用grok改出来的
  > <!-- Failed to upload "pebrel-1.9.1-dev-src.zip" -->

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

### Incident Patch 1: `fd58b10e` (2026-10-05)
**Commit Message**: fix(mobile): add saved SSH hosts directly from relay setup

**File**: `mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/ui/HostForms.kt` (modified, +2/-1)
```diff
@@ -35,6 +35,7 @@ fun HostForm(
     passwordSaved: Boolean,
     busy: Boolean,
     onClearPassword: () -> Unit,
+    allowConnect: Boolean = true,
     onSave: (HostProfile, CharArray?, Boolean, Boolean) -> Unit,
 ) {
     var name by rememberSaveable { mutableStateOf(initial?.name.orEmpty()) }
@@ -162,7 +163,7 @@ fun HostForm(
                 modifier = Modifier.weight(1f).heightIn(min = 48.dp), shape = MaterialTheme.shapes.medium) {
                 Text(stringResource(R.string.save))
             }
-            Button({ submit(true) }, enabled = valid && !busy,
+            if (allowConnect) Button({ submit(true) }, enabled = valid && !busy,
                 modifier = Modifier.weight(1.6f).heightIn(min = 48.dp), shape = MaterialTheme.shapes.medium) {
                 Text(stringResource(R.string.save_connect))
             }
```

**File**: `mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/ui/RelayDeploymentFlow.kt` (modified, +29/-1)
```diff
@@ -38,6 +38,8 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
     var advanced by remember { mutableStateOf(false) }
     var manual by remember { mutableStateOf(false) }
     var choosing by remember { mutableStateOf(false) }
+    var addingHost by remember { mutableStateOf(false) }
+    var savingHost by remember { mutableStateOf(false) }
     var result by remember { mutableStateOf<RelayServiceResult?>(null) }
     var stage by remember { mutableStateOf<String?>(null) }
     var installProgress by remember { mutableStateOf<RelayInstallProgress?>(null) }
@@ -49,7 +51,7 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
     var purge by remember { mutableStateOf(false) }
     var exportFeedback by remember { mutableStateOf<Int?>(null) }
     var exportText by remember { mutableStateOf("") }
-    val busy = running
+    val busy = running || savingHost
     val host = hosts.find { it.id == selectedId }
     val endpoint = runCatching { parseSshEndpoint(address, user) }.getOrNull()
     val savedPassword = credentials.isNotEmpty() && host != null && repository.hasSavedPassword(host)
@@ -123,6 +125,9 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
         Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
             HelperText(stringResource(R.string.service_intro))
             if (!busy) {
+                OutlinedButton({ addingHost = true }, modifier = Modifier.fillMaxWidth()) {
+                    Text(stringResource(R.string.service_add_ssh_host))
+                }
                 if (hosts.isNotEmpty()) OutlinedButton({ choosing = true }, modifier = Modifier.fillMaxWidth()) {
                     Text(host?.name ?: stringResource(R.string.deploy_choose_host))
                 }
@@ -186,6 +191,29 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
             }
         }
     }
+    if (addingHost) HostForm(
+        initial = null,
+        onCancel = { addingHost = false },
+        passwordSaved = false,
+        busy = savingHost,
+        onClearPassword = {},
+        allowConnect = false,
+        onSave = save@ { entry, secret, rememberPassword, _ ->
+            if (savingHost) { secret?.fill('\u0000'); return@save }
+            savingHost = true
+            scope.launch {
+                try {
+                    // 复用 SSH 主机表单及其文档授权/凭据事务，保存后回到安装而非启动终端。
+                    if (repository.saveHostWithCredentials(entry, secret, rememberPassword)) {
+                        selectedId = entry.id
+                        password = if (rememberPassword) "" else secret?.concatToString().orEmpty()
+                        addingHost = false
+                        resetStatus()
+                    }
+                } finally { secret?.fill('\u0000'); savingHost = false }
+            }
+        },
+    )
     if (choosing) AlertDialog(onDismissRequest = { choosing = false }, title = { Text(stringResource(R.string.deploy_choose_host)) },
         text = { Column { hosts.forEach { entry -> TextButton({ selectedId = entry.id; password = ""; choosing = false; resetStatus() }) { Text(entry.name) } }
             TextButton({ selectedId = null; password = ""; choosing = false; resetStatus() }) { Text(stringResource(R.string.deploy_manual)) } } },
```

**File**: `mobile/android/app/src/main/res/values-zh-rCN/native_service.xml` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 <resources>
     <string name="service_intro">选择要使用的服务器，Pebrel 通过 SSH 安装轻量加密中转服务，无需 Docker、Node.js 或域名。</string>
     <string name="service_title">Pebrel 中转服务</string>
+    <string name="service_add_ssh_host">添加 SSH 主机或私钥</string>
     <string name="service_manual_commands">手动安装命令</string>
     <string name="service_manual_hint">先上传并解压配套的离线中转安装包，以 root 进入其中的 pebrel-relay-manual 目录，再执行以下命令。若显示 SERVER_IP 或 PORT，请替换成实际值。脚本显示四个步骤，失败即停止；无需 Docker 或 Node.js。</string>
     <string name="service_advanced">高级连接设置</string>
```

**File**: `mobile/android/app/src/main/res/values/native_service.xml` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 <resources>
     <string name="service_intro">Choose the server you want to use. Pebrel installs a small encrypted relay over SSH; no Docker, Node.js or domain name is required.</string>
     <string name="service_title">Pebrel relay service</string>
+    <string name="service_add_ssh_host">Add SSH host or private key</string>
     <string name="service_manual_commands">Manual installation commands</string>
     <string name="service_manual_hint">Upload and extract the companion offline relay kit, then enter its pebrel-relay-manual directory as root. Run the commands below; replace SERVER_IP or PORT if shown. The script prints four steps and stops on failure. No Docker or Node.js is required.</string>
     <string name="service_advanced">Advanced connection settings</string>
```

**File**: `mobile/android/app/src/test/java/io/github/kuddev/pebrel/mobile/ui/CommandComposerTest.kt` (modified, +39/-2)
```diff
@@ -65,7 +65,7 @@ class CommandComposerTest {
     @Test fun keyAuthenticationCanBeSelectedAndRequiresAKeyDocument() {
         val context = ApplicationProvider.getApplicationContext<PebrelApplication>()
         compose.setContent {
-            MaterialTheme { HostForm(HostProfile("key-form", "Key host", "127.0.0.1", 22, "test"), {}, false, false, {}, { _, _, _, _ -> }) }
+            MaterialTheme { HostForm(HostProfile("key-form", "Key host", "127.0.0.1", 22, "test"), {}, false, false, {}, onSave = { _, _, _, _ -> }) }
         }
         assertTrue(compose.onNodeWithTag("ssh-session-mode").fetchSemanticsNode().boundsInRoot.width <= 240 * context.resources.displayMetrics.density)
         assertTrue(compose.onNodeWithTag("ssh-auth-mode").fetchSemanticsNode().boundsInRoot.width <= 220 * context.resources.displayMetrics.density)
@@ -80,7 +80,7 @@ class CommandComposerTest {
         val context = ApplicationProvider.getApplicationContext<PebrelApplication>()
         compose.setContent {
             MaterialTheme { HostForm(HostProfile("saved-key", "Key host", "127.0.0.1", 22, "test",
-                keyUri = "content://fixture/key", keyName = "encrypted-key"), {}, true, false, {}, { _, _, _, _ -> }) }
+                keyUri = "content://fixture/key", keyName = "encrypted-key"), {}, true, false, {}, onSave = { _, _, _, _ -> }) }
         }
         compose.onNodeWithText(context.getString(R.string.ssh_clear_saved_passphrase)).performScrollTo().assertIsDisplayed()
         compose.onNodeWithText(context.getString(R.string.ssh_passphrase_saved_hint)).performScrollTo().assertIsDisplayed()
@@ -318,6 +318,43 @@ class CommandComposerTest {
         compose.onNodeWithText(context.getString(R.string.service_install)).assertIsNotEnabled()
     }
 
+    @Test fun serviceSetupCanOpenTheSharedKeyPickerAndCancelWithoutLosingItsHost() {
+        val context = ApplicationProvider.getApplicationContext<PebrelApplication>()
+        val repository = SessionRepository(context)
+        repository.saveHost(HostProfile("existing-relay", "Existing relay", "192.0.2.1", user = "root"))
+        compose.setContent { MaterialTheme { RelayDeploymentFlow(repository) {} } }
+        compose.onNodeWithText(context.getString(R.string.service_add_ssh_host)).performClick()
+        compose.onNodeWithText(context.getString(R.string.auth_key)).performScrollTo().performClick()
+        compose.onNodeWithText(context.getString(R.string.ssh_choose_key)).performScrollTo().assertIsDisplayed()
+        compose.onNodeWithText(context.getString(R.string.save_connect)).assertDoesNotExist()
+        compose.onAllNodesWithContentDescription(context.getString(R.string.close)).onLast().performScrollTo().performClick()
+        compose.onNodeWithText("Existing relay").assertExists()
+        compose.onNodeWithText(context.getString(R.string.service_install)).assertExists()
+        assertEquals(1, repository.hosts.value.size)
+        assertTrue(repository.sessions.value.isEmpty())
+    }
+
+    @Test fun serviceSetupSavesAndSelectsTheNewHostWithoutOpeningATerminal() {
+        val context = ApplicationProvider.getApplicationContext<PebrelApplication>()
+        val repository = SessionRepository(context)
+        repository.saveHost(HostProfile("existing-relay", "Existing relay", "192.0.2.1", user = "root"))
+        compose.setContent { MaterialTheme { RelayDeploymentFlow(repository) {} } }
+        compose.onNodeWithText(context.getString(R.string.service_add_ssh_host)).performClick()
+        compose.onNodeWithContentDescription(context.getString(R.string.host_name)).performTextInput("New relay")
+        compose.onNodeWithContentDescription(context.getString(R.string.host_address)).performTextInput("192.0.2.2")
+        compose.onNodeWithText(context.getString(R.string.save)).performScrollTo().assertIsEnabled().performClick()
+        compose.waitUntil(10_000) {
+            // 凭据事务在 IO 完成后投递 Android 主队列，需推进它而不只推进 Compose 时钟。
+            org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle()
+            repository.hosts.value.size == 2 || repository.error.value != null
+        }
+        assertNull("Host persistence must complete before returning to relay setup", repository.error.value)
+        compose.onNodeWithText("New relay").assertExists()
+        compose.onNodeWithText("Existing relay").assertDoesNotExist()
+        compose.onNodeWithText(context.getString(R.string.service_install)).assertExists()
+        assertTrue(repository.sessions.value.isEmpty())
+    }
+
     private fun saveSurface(tag: String) {
         val file = File("build/reports/composer/$tag.png")
         check(file.parentFile!!.isDirectory || file.parentFile!!.mkdirs())
```

---

### Incident Patch 2: `1647dcb9` (2026-10-05)
**Commit Message**: Merge reviewed paste icon fix before relay authentication integration

**File**: `nebula_app/assets/icons/nebula-clipboard-paste.svg` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+<!--
+Source: https://raw.githubusercontent.com/lucide-icons/lucide/500620a2e8123f8d1db191538886dc0c223f69a9/icons/clipboard-paste.svg
+
+ISC License
+
+Copyright (c) 2026 Lucide Icons and Contributors
+
+Permission to use, copy, modify, and/or distribute this software for any
+purpose with or without fee is hereby granted, provided that the above
+copyright notice and this permission notice appear in all copies.
+
+THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
+WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
+MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
+ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
+WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
+ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
+OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
+-->
+<svg
+  xmlns="http://www.w3.org/2000/svg"
+  width="24"
+  height="24"
+  viewBox="0 0 24 24"
+  fill="none"
+  stroke="currentColor"
+  stroke-width="2"
+  stroke-linecap="round"
+  stroke-linejoin="round"
+>
+  <path d="M11 14h10" />
+  <path d="M16 4h2a2 2 0 0 1 2 2v1.344" />
+  <path d="m17 18 4-4-4-4" />
+  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" />
+  <rect x="8" y="2" width="8" height="4" rx="1" />
+</svg>
```

**File**: `nebula_app/src/gpui_shell/assets.rs` (modified, +2/-0)
```diff
@@ -40,6 +40,7 @@ const NEBULA_ICONS: &[(&str, &[u8])] = icons![
     "backup-check",
     "pin",
     "pencil",
+    "clipboard-paste",
     "trash-2",
     "refresh",
     "phone",
@@ -107,6 +108,7 @@ pub mod nav {
     pub const KEYMAP: &str = "icons/nebula-keymap.svg";
     /// Lucide pencil；固定组件资产集未收录，命令行内编辑动作需要明确图形语义。
     pub const PENCIL: &str = "icons/nebula-pencil.svg";
+    pub const CLIPBOARD_PASTE: &str = "icons/nebula-clipboard-paste.svg";
     /// Lucide trash-2；删除保存命令不能借用表示 Backspace 的 `IconName::Delete`。
     pub const TRASH: &str = "icons/nebula-trash-2.svg";
     pub const REFRESH: &str = "icons/nebula-refresh.svg";
```

**File**: `nebula_app/src/gpui_shell/workspace/send_to_chat.rs` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@ impl NebulaWorkspace {
                 }
             });
         let paste_item = PopupMenuItem::new(language.text(crate::i18n::Message::CommonPaste))
+            .icon(Icon::default().path(crate::gpui_shell::assets::nav::CLIPBOARD_PASTE))
             .on_click(move |_, window, cx| {
                 if let Some(source) = paste_source.upgrade() {
                     source.update(cx, |view, cx| view.paste(window, cx));
```

**File**: `nebula_app/src/gpui_shell/workspace/send_to_chat/menu_tests.rs` (modified, +6/-1)
```diff
@@ -1,7 +1,7 @@
 use super::*;
 use crate::gpui_shell::terminal::view::TerminalLaunch;
 use crate::gpui_shell::workspace::{TabMeta, windowing};
-use gpui::{TestAppContext, VisualTestContext, point, size};
+use gpui::{AssetSource as _, TestAppContext, VisualTestContext, point, size};
 use gpui_component::Root;
 use nebula_split::SplitTree;
 
@@ -15,6 +15,11 @@ fn draw(cx: &mut VisualTestContext) {
 
 #[gpui::test]
 fn terminal_menu_renders_without_a_selection_and_escape_restores_focus(cx: &mut TestAppContext) {
+    let paste_icon = crate::gpui_shell::assets::NebulaAssets
+        .load(crate::gpui_shell::assets::nav::CLIPBOARD_PASTE)
+        .unwrap()
+        .expect("paste icon must be embedded in the product asset source");
+    assert!(std::str::from_utf8(&paste_icon).unwrap().contains("viewBox=\"0 0 24 24\""));
     let hub = crate::runtime_api::RuntimeHub::new();
     cx.update(|cx| {
         gpui_component::init(cx);
```

---

### Incident Patch 3: `36d30ca9` (2026-10-05)
**Commit Message**: Merge reviewed desktop fixes before relay authentication validation

**File**: `Cargo.lock` (modified, +2/-0)
```diff
@@ -5435,6 +5435,8 @@ dependencies = [
  "serde",
  "serde_json",
  "signal-hook",
+ "unicode-properties",
+ "unicode-segmentation",
  "unicode-width",
  "vte",
  "windows-sys 0.59.0",
```

**File**: `architecture/notes/nebula_terminal/term/2026-10-03-emoji-input-clusters.md` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+# Streaming emoji cell allocation
+
+## Status
+Proposed production fix for Issue #403; remote core evidence recorded below.
+
+Superseded by [the state-cost revision](2026-10-05-emoji-input-state-cost.md)
+for boxed-state ownership and local performance evidence only.
+
+## Context
+Single-codepoint input width splits ZWJ, modifier and regional-indicator emoji.
+The report supplies seven exact sequences and contrasts single-codepoint emoji.
+
+## Evidence
+`Term::input` previously placed every positive-width codepoint independently.
+`Cell::extra`, copying and `RenderSnapshot` already retain a head plus trailing
+codepoints; GPUI sends that complete cell string to its existing text shaper.
+The grid allocation prevents composition before font support can be evaluated.
+
+## Decision
+Move character placement into `term/input.rs`, a real input responsibility rather
+than a file-budget split. Reuse the locked unicode-segmentation 1.13.3 UAX #29
+implementation and unicode-properties 0.1.4 Emoji property (emoji feature only)
+as direct core dependencies. They add no renderer dependency or new lock package.
+Unicode-width 0.2.2 remains the width authority for individual bases and bounded
+modifier/RI/presentation pairs. Emoji ZWJ continuations occupy two columns;
+non-emoji positive-width allocation retains the existing contract.
+
+Only a pending input endpoint is recorded for ordinary characters. A boxed
+GraphemeCursor is created when an actual emoji continuation arrives; its open-ended
+length consumes each UTF-8 codepoint and defers the final boundary using NextChunk. PreContext is supplied from the owning cell
+only when requested; its cache then grows incrementally. Ordinary ASCII letters
+and BMP CJK have no cluster allocation or property lookup. An active regression
+checks every locked Emoji base against every positive-width BMP Emoji successor,
+protecting the negative fast path when Unicode data changes. Combining marks do
+not trigger whole-cluster width scans. Emoji presentation pairs and standard keycaps use a bounded
+UTF-8 buffer; already composed emoji remain two columns.
+
+Consecutive ownership ends at actual cursor/grid edits, alternate-buffer changes
+and resize. No-op resize, SGR, synchronized output and parser chunk boundaries do
+not end it. Width promotion/shrink updates the head/spacer and pending-wrap cursor
+state; promotion at the last column relocates the complete cell through normal
+wrapping. The leading spacer copy reads the following row and its full text.
+
+## Rejected alternatives
+A hand-maintained emoji table would drift. Per-codepoint reconstruction/width
+scans make long untrusted combining output quadratic. Unconditionally merging
+all graphemes into two columns changes Indic and other non-emoji width contracts.
+A font substitution does not repair terminal cell allocation.
+
+## Consequences
+Existing cell extra storage carries positive-width emoji continuations too.
+SGR inside one emoji retains the first cell's style and its spacer retains OSC8
+links/underline color. Wrapped INSERT reserves two cells in the destination row;
+non-wrapped promotion inserts only the extra cell. Wrapping at physical bottom
+outside the scroll margin does not leave a nonexistent-next-row placeholder. Line-wrap-disabled edge
+promotion retains clipped text without creating an out-of-bounds spacer.
+This fixes model/snapshot input to the shaper; actual Windows glyph/font coverage
+remains a separate native acceptance requirement.
+
+## Validation
+[Fork proof](https://github.com/WilliamWang1721/pebrel/actions/runs/37103145372)
+tested source `c684654b` after the attached formatting patch: 237 core tests passed,
+zero failures/ignored tests; architecture checks against `9dd3d649` passed. Tests
+cover the seven original sequences and controls across UTF-8 chunks, copy/spacer
+selection, snapshots, selectors/wrap/reflow, SGR/sync/OSC8, edits/DECALN/scroll,
+cursor/alternate/resize resets, INSERT, bottom-margin copy and long marks.
+
+The same fork job compared instrumented release input cost with exact main
+`9dd3d649`, on Ubuntu 24.04 x86_64/Rust 1.97.1, median of five samples per unchanged workload.
+The harness uses direct `Term::input`, 120×32 cells and zero scrollback, not PTY,
+GPU, fonts or end-to-end UI timing. Final base/candidate ns per character:
+
+| Workload | Base | Candidate | Base/candidate allocations |
+| --- | ---: | ---: | ---: |
+| ASCII (372k chars) | 8.51 | 9.00 | 0 / 0 |
+| BMP CJK (200k chars) | 17.01 | 17.32 | 0 / 0 |
+| Reported emoji (192k chars) | 26.94 | 102.16 | 96,000 / 228,000 |
+| Long ZWJ (160,120 chars) | 33.23 | 89.73 | 160,000 / 1,000 |
+| Repeated selectors (160,024 chars) | 21.53 | 57.06 | 160,112 / 242 |
+
+Long-mark lengths 1k/2k/4k/16k measured 59.50/59.29/59.20/58.73 ns per character,
+with 3,200/1,760/960/280 allocations for roughly 160k total characters. This supports
+linear growth for that workload, not a universal speed guar
```

**File**: `architecture/notes/nebula_terminal/term/2026-10-05-emoji-input-state-cost.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+# Emoji input state ownership and ordinary-text cost
+
+## Status
+Maintainer revision for PR #451; final-head CI and native glyph acceptance remain separate.
+
+## Context
+The streaming cluster fix preserves complete emoji cells, but boxing the pending
+segmenter allocates once per new cluster. Taking an inline segmenter on every
+continuation would instead move its entire state per codepoint. Ordinary input
+must not inherit large emoji-only stack temporaries.
+
+## Evidence
+Local Windows x86_64 release probes compare main `b6e7b78d`, the original PR
+integrated at `8c770233`, and the revised implementation in `term/input.rs`.
+Later main application changes through `57c7bfdb` do not change this core.
+The probe uses 120 x 40 cells, 1,000 history lines, four warm-up feeds, thin LTO
+and one codegen unit. Timings use the default System allocator; allocation counts
+come from a separate instrumented build and are not timing evidence.
+Nine rounds rotate variant order on CPU affinity mask `0x1`.
+
+Median ns per input character, including parser control bytes for VT workloads:
+
+| Workload | Main | Original PR | Revision |
+| --- | ---: | ---: | ---: |
+| ASCII input | 15.625 | 14.992 | 15.088 |
+| BMP CJK input | 28.323 | 29.087 | 27.935 |
+| ASCII VT | 15.028 | 16.763 | 14.670 |
+| ANSI VT | 12.790 | 11.764 | 11.946 |
+| Reported emoji input | 57.976 | 215.737 | 198.931 |
+| Long combining input | 79.558 | 79.317 | 78.869 |
+
+The emoji workload repeats seven reported sequences 512 times per feed, for 24
+measured feeds. Allocations fall from 467,625 to 381,609 (86,016 fewer, about 18.4%).
+The ASCII, CJK and VT workloads allocate zero times during steady-state input.
+`size_of::<Term<VoidListener>>()` is 1,848 / 1,880 / 2,008 bytes respectively:
+the revision trades 128 fixed bytes per terminal against repeated heap allocation.
+The ordinary-input function's `sub rsp` reservation is `0x68` / `0x168` / `0x58`;
+these figures exclude pushed registers and are not total thread stack usage.
+
+Scheduling spread is substantial. These observations support the bounded
+ownership change, not a universal throughput guarantee or total RSS reduction.
+Main renders these emoji incorrectly, so its emoji timing is not equal-work
+correctness evidence. Probe sources and raw results remain local diagnostic data.
+
+## Decision
+Store `Option<EmojiInput>` inline and update an active segmenter in place. Only
+width migration temporarily takes ownership because wrapping and cell edits
+invalidate input continuity through the existing reset authority. Keep the exact
+cursor and pending-wrap endpoint checks rather than introducing a second policy.
+
+Keep the cheap negative BMP continuation check in `input_character`, and mark
+`extend_emoji_input` non-inlinable so initialization and width migration temporaries
+do not enlarge the ordinary-text frame. Reuse existing character placement for
+ASCII, CJK, insert mode, mapped characters and wrapping.
+
+## Rejected alternatives
+- Per-cluster boxing retains avoidable allocation on emoji-heavy output.
+- Taking the full inline state on every codepoint trades allocation for copying.
+- An ASCII-specific placement branch duplicates established VT behavior without
+  stable measured benefit; it is not retained.
+- Replacing the endpoint with a continuity boolean or conditionally recording it
+  weakens the existing check or adds branches without stable measured benefit.
+- Allocation-instrumented timing perturbs allocation-heavy workloads and is not
+  used as the final throughput comparison.
+
+## Consequences
+Each terminal has a small fixed size increase; cell size and persistence formats
+are unchanged. Emoji cell tails and requested lookbehind context still allocate
+when necessary. No new dependency, thread, cache or background task is introduced.
+Compiler and Unicode upgrades can change both layout and the negative fast path.
+
+## Validation
+The revision passes 90 terminal-module tests, 45 reference-replay tests and 16
+redraw-anchor tests, plus formatting, architecture and diff checks. Added cases
+cover ASCII following an emoji, keycaps, mapped characters, insert/wrap behavior
+and invalidation by cursor/grid edits. Existing chunking, copy, snapshot, selectors,
+width promotion/shrink, reflow and long-mark regressions remain enabled.
+
+An earlier complete local core run had three environment-dependent failures:
+two missing-shell executable cases and one WSL-selected input fixture also
+reproduced on main. They were not counted as passes or repaired by unrelated edits.
+These checks do not establish real-window font coverage or end-to-end latency.
+
+## Supersedes
+The boxed-state ownership and cost discussion in
+[the original cluster decision](2026-10-03-emoji-input-clusters.md).
+Its segmentation, cell-width and continuity contracts remain in effect.
+
+## Revisit when
+Unicode or compiler versions change, representative production traces show an
+
```

**File**: `nebula_terminal/Cargo.toml` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ parking_lot = "0.12.0"
 polling = "3.8.0"
 regex-automata = "0.4.3"
 unicode-width = "0.2.0"
+unicode-segmentation = "1.13.3"
+unicode-properties = { version = "0.1.4", default-features = false, features = ["emoji"] }
 vte = { version = "0.15.0", default-features = false, features = ["std", "ansi"] }
 serde = { version = "1", features = ["derive", "rc"], optional = true }
 
```

**File**: `nebula_terminal/src/term/cell.rs` (modified, +3/-3)
```diff
@@ -153,16 +153,16 @@ impl Default for Cell {
 }
 
 impl Cell {
-    /// Zerowidth characters stored in this cell.
+    /// Additional codepoints sharing this cell, including emoji continuations.
     #[inline]
     pub fn zerowidth(&self) -> Option<&[char]> {
         self.extra.as_ref().map(|extra| extra.zerowidth.as_slice())
     }
 
-    /// Write a new zerowidth character to this cell.
+    /// Append a codepoint without allocating another terminal cell.
     #[inline]
     pub fn push_zerowidth(&mut self, character: char) {
-        let extra = self.extra.get_or_insert(Default::default());
+        let extra = self.extra.get_or_insert_with(Default::default);
         Arc::make_mut(extra).zerowidth.push(character);
     }
 
```

**File**: `nebula_terminal/src/term/emoji_input_tests.rs` (added, +285/-0)
```diff
@@ -0,0 +1,285 @@
+use super::*;
+use crate::event::VoidListener;
+use crate::index::{Column, Line};
+use crate::render::{RenderSnapshot, SnapshotConfig};
+use crate::term::{Config, test::TermSize};
+use crate::vte::ansi::{Handler as _, Processor};
+use unicode_properties::UnicodeEmoji as _;
+use unicode_segmentation::UnicodeSegmentation as _;
+use unicode_width::{UnicodeWidthChar as _, UnicodeWidthStr as _};
+
+const EMOJI: &[&str] = &["👨‍👩‍👧", "🏳️‍🌈", "❤️‍🔥", "🐦‍⬛", "🙂‍↔️", "👍🏽", "🇨🇳"];
+
+fn terminal(columns: usize) -> Term<VoidListener> {
+    Term::new(Config::default(), &TermSize::new(columns, 4), VoidListener)
+}
+
+fn feed(term: &mut Term<VoidListener>, text: &str, chunk: usize) {
+    let mut parser = Processor::<crate::vte::ansi::StdSyncHandler>::default();
+    for bytes in text.as_bytes().chunks(chunk) {
+        parser.advance(term, bytes);
+    }
+}
+
+fn cell_text(cell: &Cell) -> String {
+    let mut text = cell.c.to_string();
+    text.extend(cell.zerowidth().into_iter().flatten());
+    text
+}
+
+#[test]
+fn reported_emoji_are_one_wide_cell_across_utf8_chunks_copy_and_snapshot() {
+    for text in EMOJI.iter().copied().chain(["🔥", "😀", "🚀", "🎉", "🐦", "1️⃣"]) {
+        assert_eq!(text.width(), 2, "reference width: {text}");
+        for chunk in [1, 2, 5, text.len()] {
+            let mut term = terminal(80);
+            feed(&mut term, text, chunk);
+            assert_eq!(
+                term.grid.cursor.point,
+                Point::new(Line(0), Column(2)),
+                "{text}, chunk {chunk}"
+            );
+            assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), text);
+            assert!(term.grid[Line(0)][Column(0)].flags.contains(Flags::WIDE_CHAR));
+            assert!(term.grid[Line(0)][Column(1)].flags.contains(Flags::WIDE_CHAR_SPACER));
+            assert_eq!(
+                term.bounds_to_string(
+                    Point::new(Line(0), Column(1)),
+                    Point::new(Line(0), Column(1))
+                ),
+                text
+            );
+            let snap = RenderSnapshot::capture(&term, &SnapshotConfig { rows: 4, cols: 80 });
+            assert_eq!(snap.segments.len(), 1);
+            assert!(snap.segments[0].wide);
+            assert_eq!(snap.segments[0].cells.len(), 1);
+            assert_eq!(snap.segments[0].cells[0].text, text);
+        }
+    }
+}
+
+#[test]
+fn ordinary_ascii_ends_emoji_clusters_while_keycaps_still_compose() {
+    for c in ' '..='~' {
+        let mut term = terminal(80);
+        feed(&mut term, "👨‍👩", 1);
+        term.input(c);
+        assert!(term.input_cluster.is_none());
+        assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), "👨‍👩");
+        assert_eq!(term.grid[Line(0)][Column(2)].c, c);
+    }
+    for c in ['#', '*', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] {
+        let mut term = terminal(80);
+        let keycap = format!("{c}\u{fe0f}\u{20e3}");
+        feed(&mut term, &keycap, 1);
+        assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), keycap);
+        assert_eq!(term.grid.cursor.point.column, Column(2));
+    }
+}
+
+#[test]
+fn ordinary_input_preserves_insert_wrap_and_mapped_characters() {
+    let mut term = terminal(4);
+    feed(&mut term, "ABCDX", 1);
+    assert_eq!(term.grid[Line(1)][Column(0)].c, 'X');
+    assert!(term.grid[Line(0)][Column(3)].flags.contains(Flags::WRAPLINE));
+    feed(&mut term, "\x1b[1;2H\x1b[4hZ", 1);
+    let row: String = (0..4).map(|column| term.grid[Line(0)][Column(column)].c).collect();
+    assert_eq!(row, "AZBC");
+
+    for c in ' '..='~' {
+        if c.is_emoji_char() {
+            continue;
+        }
+        let mut term = terminal(4);
+        feed(&mut term, "\x1b(0", 1);
+        term.input(c);
+        assert!(!term.grid[Line(0)][Column(0)].c.is_emoji_char());
+        assert_eq!(term.grid.cursor.point.column, Column(1));
+    }
+}
+
+#[test]
+fn emoji_continuity_survives_sgr_sync_and_noop_resize_but_not_cursor_or_grid_edits() {
+    let mut term = terminal(80);
+    feed(&mut term, "👨\x1b[31m\x1b[?2026h‍👩\x1b[?2026l‍👧", 1);
+    assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), EMOJI[0]);
+    assert_eq!(
+        term.grid[Line(0)][Column(0)].fg,
+        crate::vte::ansi::Color::Named(crate::vte::ansi::NamedColor::Foreground)
+    );
+    let mut term = terminal(80);
+    term.input('👍');
+    term.resize(TermSize::new(80, 4));
+    term.input('🏽');
+    assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), "👍🏽");
+
+    for control in [
+        "\x1b[3G",
+        "\x1b[1D\x1b[1C",
+        "\x1b[0K",
+        "\x1b#8",
+        "\x1b[1L",
+        "\x1b[1M",
+        "\x1b[1I\x1b[1Z",
+        "\x1b[1A",
+        "\x1b[1B",
+        "\x1b[1P",
+        "\x1b[1@",
+        "\x1b[1X",
+        "\x1b[1S",
+        "\x1b[1T",
+        "\x08",
+        "\r",
+        "\n",
+        "\t",
+        "\x1bM",
+        "\x1b7\x1b8",
+        "\x1b[2J",
+        "\x1bc",
+        "\x1b
```

**File**: `nebula_terminal/src/term/input.rs` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+//! Streaming emoji cell allocation. Ordinary text keeps the existing VT placement.
+
+use unicode_properties::UnicodeEmoji as _;
+use unicode_segmentation::{GraphemeCursor, GraphemeIncomplete};
+use unicode_width::{UnicodeWidthChar as _, UnicodeWidthStr as _};
+
+use super::{Cell, Dimensions, EventListener, Flags, Point, Term, TermMode};
+use crate::vte::ansi::Handler as _;
+
+pub(super) struct EmojiInput {
+    segmenter: GraphemeCursor,
+    bytes: usize,
+    context: String,
+    last: char,
+    graphic: char,
+    joined: bool,
+}
+
+impl EmojiInput {
+    fn new(c: char) -> Option<Self> {
+        // The only ASCII emoji bases are the standardized keycap bases.
+        if (c.is_ascii() && !matches!(c, '#' | '*' | '0'..='9')) || !c.is_emoji_char() {
+            return None;
+        }
+        let mut buffer = [0; 4];
+        let text = c.encode_utf8(&mut buffer);
+        // An open-ended cursor defers the boundary until the next UTF-8 chunk.
+        let mut segmenter = GraphemeCursor::new(0, usize::MAX, true);
+        let result = segmenter.next_boundary(text, 0);
+        debug_assert_eq!(result, Err(GraphemeIncomplete::NextChunk));
+        Some(Self {
+            segmenter,
+            bytes: text.len(),
+            context: String::new(),
+            last: c,
+            graphic: c,
+            joined: false,
+        })
+    }
+
+    fn continues(&mut self, c: char, cell: &Cell) -> bool {
+        let mut buffer = [0; 8];
+        let (text, chunk_start) = if cell.zerowidth().is_none_or(|tail| tail.is_empty()) {
+            let first_len = cell.c.encode_utf8(&mut buffer).len();
+            let next_len = c.encode_utf8(&mut buffer[first_len..]).len();
+            (std::str::from_utf8(&buffer[..first_len + next_len]).unwrap(), 0)
+        } else {
+            (c.encode_utf8(&mut buffer) as &str, self.bytes)
+        };
+        loop {
+            match self.segmenter.next_boundary(text, chunk_start) {
+                Err(GraphemeIncomplete::NextChunk) => {
+                    self.bytes += c.len_utf8();
+                    if !self.context.is_empty() {
+                        self.context.push(c);
+                    }
+                    return true;
+                },
+                Err(GraphemeIncomplete::PreContext(end)) => {
+                    // Context is built only when GB11/Indic lookbehind asks for it;
+                    // later extensions append, rather than rescan/rebuild a long cluster.
+                    if self.context.is_empty() {
+                        self.context.push(cell.c);
+                        self.context.extend(cell.zerowidth().into_iter().flatten());
+                    }
+                    self.segmenter.provide_context(&self.context[..end], 0);
+                },
+                Ok(Some(_)) => return false,
+                other => unreachable!("complete UTF-8 input chunk: {other:?}"),
+            }
+        }
+    }
+}
+
+fn sequence_width(first: char, tail: &[char]) -> usize {
+    let mut buffer = [0; 12];
+    let mut len = first.encode_utf8(&mut buffer).len();
+    for c in tail {
+        len += c.encode_utf8(&mut buffer[len..]).len();
+    }
+    std::str::from_utf8(&buffer[..len]).unwrap().width()
+}
+
+impl<T> Term<T> {
+    #[inline]
+    pub(super) fn reset_input_cluster(&mut self) {
+        self.input_cluster = None;
+        self.input_end = None;
+    }
+}
+
+impl<T: EventListener> Term<T> {
+    #[inline]
+    pub(super) fn input_character(&mut self, c: char) {
+        // Number of cells the char will occupy.
+        let width = match c.width() {
+            Some(width) => width,
+            None => return,
+        };
+
+        if !c.is_ascii()
+            && (self.input_cluster.is_some() || width == 0 || c > '\u{ffff}')
+            && self.extend_emoji_input(c, width)
+        {
+            return;
+        }
+        self.reset_input_cluster();
+
+        // Preserve the existing placement of standalone combining characters.
+        if width == 0 {
+            // Get previous column.
+            let mut column = self.grid.cursor.point.column;
+            if !self.grid.cursor.input_needs_wrap {
+                column.0 = column.saturating_sub(1);
+            }
+
+            // Put zerowidth characters over first fullwidth character cell.
+            let line = self.grid.cursor.point.line;
+            if self.grid[line][column].flags.contains(Flags::WIDE_CHAR_SPACER) {
+                column.0 = column.saturating_sub(1);
+            }
+
+            self.grid[line][column].push_zerowidth(c);
+            return;
+        }
+
+        // Move cursor to next line.
+        if self.grid.cursor.input_needs_wrap {
+            self.wrapline();
+        }
+
+        // If in insert mode, first shift cells to the right.
+        let columns = self.columns();
+        if self.mode.contains(TermMode::INSERT) && self.grid.cursor.point.column + width < columns {
+            let l
```

**File**: `nebula_terminal/src/term/mod.rs` (modified, +48/-79)
```diff
@@ -12,7 +12,6 @@ use base64::Engine;
 use base64::engine::general_purpose::STANDARD as Base64;
 use bitflags::bitflags;
 use log::{debug, trace};
-use unicode_width::UnicodeWidthChar;
 
 use crate::event::{Event, EventListener};
 use crate::grid::{Dimensions, Grid, Scroll};
@@ -31,6 +30,7 @@ pub mod cell;
 mod clear;
 pub mod color;
 mod damage;
+mod input;
 mod keyboard;
 #[cfg(test)]
 mod keyboard_contract_tests;
@@ -161,6 +161,8 @@ pub fn viewport_to_point_from(origin: Line, point: Point<usize>) -> Point {
 
 pub struct Term<T> {
     redraw_anchor: redraw_anchor::RedrawAnchor,
+    input_cluster: Option<input::EmojiInput>,
+    input_end: Option<(Point, bool)>,
     /// Terminal focus controlling the cursor shape.
     pub is_focused: bool,
 
@@ -387,6 +389,8 @@ impl<T> Term<T> {
 
         Term {
             redraw_anchor: Default::default(),
+            input_cluster: None,
+            input_end: None,
             inactive_grid,
             scroll_region,
             event_proxy,
@@ -652,8 +656,13 @@ impl<T> Term<T> {
             && line_length.0 >= 2
             && grid_line[line_length - 1].flags.contains(Flags::LEADING_WIDE_CHAR_SPACER)
             && include_wrapped_wide
+            && line < self.bottommost_line()
         {
-            text.push(self.grid[line - 1i32][Column(0)].c);
+            let cell = &self.grid[line + 1i32][Column(0)];
+            if cell.flags.contains(Flags::WIDE_CHAR) {
+                text.push(cell.c);
+                text.extend(cell.zerowidth().into_iter().flatten());
+            }
         }
 
         text
@@ -727,6 +736,7 @@ impl<T> Term<T> {
 
     /// Mutable access to the raw grid data structure.
     pub fn grid_mut(&mut self) -> &mut Grid<Cell> {
+        self.reset_input_cluster();
         &mut self.grid
     }
 
@@ -744,6 +754,7 @@ impl<T> Term<T> {
             return;
         }
 
+        self.reset_input_cluster();
         debug!("New num_cols is {num_cols} and num_lines is {num_lines}");
 
         // Move vi mode cursor with the content.
@@ -810,6 +821,7 @@ impl<T> Term<T> {
 
     /// Swap primary and alternate screen buffer.
     pub fn swap_alt(&mut self) {
+        self.reset_input_cluster();
         self.cancel_redraw_anchor();
         if !self.mode.contains(TermMode::ALT_SCREEN) {
             // Set alt screen cursor to the current primary screen cursor.
@@ -839,6 +851,7 @@ impl<T> Term<T> {
     /// Expects origin to be in scroll range.
     #[inline]
     fn scroll_down_relative(&mut self, origin: Line, mut lines: usize) {
+        self.reset_input_cluster();
         trace!("Scrolling down relative: origin={origin}, lines={lines}");
 
         lines = cmp::min(lines, (self.scroll_region.end - self.scroll_region.start).0 as usize);
@@ -867,6 +880,7 @@ impl<T> Term<T> {
     /// Expects origin to be in scroll range.
     #[inline]
     fn scroll_up_relative(&mut self, origin: Line, mut lines: usize) {
+        self.reset_input_cluster();
         trace!("Scrolling up relative: origin={origin}, lines={lines}");
 
         lines = cmp::min(lines, (self.scroll_region.end - self.scroll_region.start).0 as usize);
@@ -923,6 +937,7 @@ impl<T> Term<T> {
         if delta == 0 || delta >= self.screen_lines() {
             return;
         }
+        self.reset_input_cluster();
         let region = Line(0)..Line(self.screen_lines() as i32);
         // 选区跟着内容走：`rotate` 的正负与内容位移同向（上滚为负）。
         let rotation = if target < cursor { delta as i32 } else { -(delta as i32) };
@@ -1125,9 +1140,16 @@ impl<T> Term<T> {
 
         trace!("Wrapping input");
 
-        self.grid.cursor_cell().flags.insert(Flags::WRAPLINE);
+        let next_line = self.grid.cursor.point.line + 1;
+        if next_line < self.screen_lines() || next_line == self.scroll_region.end {
+            self.grid.cursor_cell().flags.insert(Flags::WRAPLINE);
+        } else {
+            // Below the scrolling margin at the physical bottom, wrapping cannot
+            // advance. Do not leave a placeholder pointing at a nonexistent row.
+            self.grid.cursor_cell().flags.remove(Flags::WRAPLINE | Flags::LEADING_WIDE_CHAR_SPACER);
+        }
 
-        if self.grid.cursor.point.line + 1 >= self.scroll_region.end {
+        if next_line >= self.scroll_region.end {
             self.linefeed();
         } else {
             self.damage_cursor();
@@ -1207,85 +1229,12 @@ impl<T: EventListener> Handler for Term<T> {
     /// A character to be displayed.
     #[inline(never)]
     fn input(&mut self, c: char) {
-        // Number of cells the char will occupy.
-        let width = match c.width() {
-            Some(width) => width,
-            None => return,
-        };
-
-        // Handle zero-width characters.
-        if width == 0 {
-            // Get previous column.
-            let mut column = self.grid.cursor.point.column;
-            if !self.grid.cursor.input_needs_wrap {
-                column.0 = column.saturating_sub(1);
-            }
-
-       
```

---

### Incident Patch 4: `6a59eb0a` (2026-10-05)
**Commit Message**: fix(mobile): reuse SSH private keys and passphrases for relay deployment

**File**: `mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/connection/NativeRelayDeployment.kt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ object NativeRelayDeployment {
         require(port in 1..65535)
         val endpoint = validatedAddress(address)
         val stage: (String) -> Unit = { progress(RelayServiceProgress(it)) }
-        DeploymentSsh(host, password, verify).use { ssh ->
+        DeploymentSsh(host, password, verify, sshKeySource(context, host)).use { ssh ->
             stage("connecting")
             val preflight = command(ssh, preflightCommand(), progress = stage, connected = { stage("checking") })
             val arch = preflight.last().getString("arch")
```

**File**: `mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/connection/RelayDeployment.kt` (modified, +9/-4)
```diff
@@ -123,6 +123,7 @@ internal class DeploymentSsh(
     private val host: HostProfile,
     private val password: CharArray,
     private val verifyHost: (HostProfile, String) -> Boolean,
+    private val keySource: (() -> ByteArray)?,
 ) : Closeable {
     private val guard = Any()
     @Volatile private var active: SshConnection? = null
@@ -132,7 +133,9 @@ internal class DeploymentSsh(
     suspend fun open(timeoutMs: Long): SshConnection {
         val connection = synchronized(guard) {
             check(!closed) { "closed" }
-            SshConnection(host.copy(fingerprint = trustedFingerprint), password.copyOf(), ::verify)
+            // 部署会为每条命令重连；每次都复用普通 SSH 的按需私钥读取和清零流程。
+            SshConnection(host.copy(fingerprint = trustedFingerprint), password.copyOf(), ::verify,
+                keySource = keySource)
                 .also { active = it }
         }
         return try {
@@ -191,7 +194,7 @@ internal class DeploymentSsh(
     }
 }
 
-/** Android adapter for deploying the existing user-hosted relay over password SSH. */
+/** Android adapter for deploying the existing user-hosted relay over authenticated SSH. */
 object RelayDeployment {
     const val ASSET_NAME = "relay-kit.bin"
 
@@ -227,7 +230,8 @@ object RelayDeployment {
         } catch (error: Exception) {
             throw RelayDeploymentException(RelayDeploymentErrorCode.ASSET_MISSING, cause = error)
         }
-        return deploy(host, password, verify, request, archive, onProgress)
+        return deploy(host, password, verify, request, archive,
+            keySource = sshKeySource(context, host), onProgress = onProgress)
     }
 
     /** Entry point useful to tests and to build tooling that already has the asset bytes. */
@@ -237,6 +241,7 @@ object RelayDeployment {
         verify: (HostProfile, String) -> Boolean,
         request: RelayDeploymentRequest,
         archive: ByteArray,
+        keySource: (() -> ByteArray)? = null,
         onProgress: (RelayDeploymentProgress) -> Unit = {},
     ): RelayDeploymentResult {
         if (archive.isEmpty() || archive.size > MAX_ARCHIVE_BYTES) {
@@ -245,7 +250,7 @@ object RelayDeployment {
         val config = validate(request)
         emit(onProgress, RelayDeploymentStage.VALIDATING, 1)
 
-        val ssh = DeploymentSsh(host, password, verify)
+        val ssh = DeploymentSsh(host, password, verify, keySource)
         val parentJob = currentCoroutineContext().job
         val closeOnCancel = parentJob.invokeOnCompletion { cause ->
             if (cause is CancellationException) ssh.close()
```

**File**: `mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/ui/RelayDeploymentFlow.kt` (modified, +6/-3)
```diff
@@ -53,8 +53,9 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
     val host = hosts.find { it.id == selectedId }
     val endpoint = runCatching { parseSshEndpoint(address, user) }.getOrNull()
     val savedPassword = credentials.isNotEmpty() && host != null && repository.hasSavedPassword(host)
+    val keyAuthentication = host?.keyUri?.isNotBlank() == true
     val valid = (host != null || endpoint != null && (sshPort.toIntOrNull() ?: 0) in 1..65535) &&
-        (password.isNotEmpty() || savedPassword) && (servicePort.toIntOrNull() ?: 0) in 1..65535
+        (keyAuthentication || password.isNotEmpty() || savedPassword) && (servicePort.toIntOrNull() ?: 0) in 1..65535
     val saveFile = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
         val text = exportText
         exportText = ""
@@ -83,7 +84,8 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
         job = scope.launch {
             var secret = entered
             try {
-                if (secret == null) secret = repository.loadSavedPassword(selected)
+                // 与普通 SSH 共用凭据解析：未加密私钥可空口令，已存口令读取失败仍阻止连接。
+                if (secret == null) secret = repository.passwordForConnection(selected, null)
                 if (secret == null) throw RelayServiceFailure("missing_credentials")
                 result = NativeRelayDeployment.execute(context, selected, checkNotNull(secret),
                     { h, fingerprint -> repository.verifySshOperation(owner, h, fingerprint) },
@@ -128,9 +130,10 @@ fun RelayDeploymentFlow(repository: SessionRepository, onCancel: () -> Unit) {
                     ConnectionField(address, { address = it; resetStatus() }, R.string.host_address, keyboard = KeyboardType.Uri)
                     ConnectionField(user, { user = it; resetStatus() }, R.string.username)
                 }
-                ConnectionField(password, { password = it }, R.string.password, keyboard = KeyboardType.Password,
+                ConnectionField(password, { password = it }, if (keyAuthentication) R.string.ssh_key_passphrase else R.string.credential_password, keyboard = KeyboardType.Password,
                     placeholder = if (savedPassword) stringResource(R.string.password_saved_placeholder) else "",
                     transformation = PasswordVisualTransformation(), limit = 1024)
+                if (keyAuthentication) HelperText(stringResource(R.string.ssh_key_passphrase_hint))
                 TextButton({ advanced = !advanced }) { Text(stringResource(R.string.service_advanced)) }
                 if (advanced) {
                     if (host == null) ConnectionField(sshPort, { sshPort = it; resetStatus() }, R.string.port, keyboard = KeyboardType.Number, limit = 5)
```

**File**: `mobile/android/app/src/test/java/io/github/kuddev/pebrel/mobile/connection/NativeRelayDeploymentTest.kt` (modified, +17/-0)
```diff
@@ -10,6 +10,23 @@ import org.robolectric.annotation.Config
 @RunWith(RobolectricTestRunner::class)
 @Config(sdk = [28])
 class NativeRelayDeploymentTest {
+    @Test fun everyDeploymentReconnectReadsTheSelectedPrivateKey() = kotlinx.coroutines.runBlocking {
+        val host = HostProfile("key-host", "Key host", "192.0.2.1", user = "root",
+            keyUri = "content://fixture/private-key")
+        var reads = 0
+        DeploymentSsh(host, charArrayOf(), { _, _ -> false }, {
+            reads++
+            // 在 JNI 前终止，验证重连接线，不让单测依赖真实网络和密钥文件。
+            throw io.github.kuddev.pebrel.ssh.NativeSshException("KEY")
+        }).use { ssh ->
+            repeat(2) {
+                val failure = runCatching { ssh.open(5_000) }.exceptionOrNull()
+                assertEquals(SshFailureKind.KEY, classifySshFailure(checkNotNull(failure)))
+            }
+        }
+        assertEquals(2, reads)
+    }
+
     @Test fun fourStepsKeepTheExactFailureAndIgnoreLateOrRegressiveProgress() {
         var progress = RelayInstallProgress()
         assertEquals(InstallStepState.ACTIVE, progress.state(1))
```

**File**: `mobile/android/app/src/test/java/io/github/kuddev/pebrel/mobile/ui/CommandComposerTest.kt` (modified, +20/-0)
```diff
@@ -298,6 +298,26 @@ class CommandComposerTest {
         compose.onNodeWithText("sh install.sh 'SERVER_IP' 443\n/opt/pebrel-relay/pebrel-relay service-status").assertExists()
     }
 
+    @Test fun servicePageAllowsAnUnencryptedKeyAndSeparatesItsPassphraseFromAPassword() {
+        val context = ApplicationProvider.getApplicationContext<PebrelApplication>()
+        val repository = SessionRepository(context)
+        val keyHost = HostProfile("relay-key", "Key host", "192.0.2.1", user = "root",
+            keyUri = "content://fixture/private-key", keyName = "private-key")
+        repository.saveHost(keyHost)
+        compose.setContent { MaterialTheme { RelayDeploymentFlow(repository) {} } }
+        compose.onNodeWithContentDescription(context.getString(R.string.ssh_key_passphrase)).assertExists()
+        compose.onNodeWithText(context.getString(R.string.ssh_key_passphrase_hint)).assertExists()
+        compose.onNodeWithText(context.getString(R.string.service_install)).assertIsEnabled()
+        compose.onNodeWithText(context.getString(R.string.service_check)).assertIsEnabled()
+        compose.onNodeWithContentDescription(context.getString(R.string.ssh_key_passphrase))
+            .performTextInput("private-key-passphrase")
+        compose.onNodeWithText(context.getString(R.string.service_install)).assertIsEnabled()
+        compose.runOnIdle { repository.saveHost(keyHost.copy(keyUri = "", keyName = "")) }
+        compose.onNodeWithContentDescription(context.getString(R.string.credential_password))
+            .performTextClearance()
+        compose.onNodeWithText(context.getString(R.string.service_install)).assertIsNotEnabled()
+    }
+
     private fun saveSurface(tag: String) {
         val file = File("build/reports/composer/$tag.png")
         check(file.parentFile!!.isDirectory || file.parentFile!!.mkdirs())
```

---

### Incident Patch 5: `347bba69` (2026-10-05)
**Commit Message**: Merge reviewed emoji fix before paste icon integration

**File**: `Cargo.lock` (modified, +2/-0)
```diff
@@ -5435,6 +5435,8 @@ dependencies = [
  "serde",
  "serde_json",
  "signal-hook",
+ "unicode-properties",
+ "unicode-segmentation",
  "unicode-width",
  "vte",
  "windows-sys 0.59.0",
```

**File**: `architecture/notes/nebula_terminal/term/2026-10-03-emoji-input-clusters.md` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+# Streaming emoji cell allocation
+
+## Status
+Proposed production fix for Issue #403; remote core evidence recorded below.
+
+Superseded by [the state-cost revision](2026-10-05-emoji-input-state-cost.md)
+for boxed-state ownership and local performance evidence only.
+
+## Context
+Single-codepoint input width splits ZWJ, modifier and regional-indicator emoji.
+The report supplies seven exact sequences and contrasts single-codepoint emoji.
+
+## Evidence
+`Term::input` previously placed every positive-width codepoint independently.
+`Cell::extra`, copying and `RenderSnapshot` already retain a head plus trailing
+codepoints; GPUI sends that complete cell string to its existing text shaper.
+The grid allocation prevents composition before font support can be evaluated.
+
+## Decision
+Move character placement into `term/input.rs`, a real input responsibility rather
+than a file-budget split. Reuse the locked unicode-segmentation 1.13.3 UAX #29
+implementation and unicode-properties 0.1.4 Emoji property (emoji feature only)
+as direct core dependencies. They add no renderer dependency or new lock package.
+Unicode-width 0.2.2 remains the width authority for individual bases and bounded
+modifier/RI/presentation pairs. Emoji ZWJ continuations occupy two columns;
+non-emoji positive-width allocation retains the existing contract.
+
+Only a pending input endpoint is recorded for ordinary characters. A boxed
+GraphemeCursor is created when an actual emoji continuation arrives; its open-ended
+length consumes each UTF-8 codepoint and defers the final boundary using NextChunk. PreContext is supplied from the owning cell
+only when requested; its cache then grows incrementally. Ordinary ASCII letters
+and BMP CJK have no cluster allocation or property lookup. An active regression
+checks every locked Emoji base against every positive-width BMP Emoji successor,
+protecting the negative fast path when Unicode data changes. Combining marks do
+not trigger whole-cluster width scans. Emoji presentation pairs and standard keycaps use a bounded
+UTF-8 buffer; already composed emoji remain two columns.
+
+Consecutive ownership ends at actual cursor/grid edits, alternate-buffer changes
+and resize. No-op resize, SGR, synchronized output and parser chunk boundaries do
+not end it. Width promotion/shrink updates the head/spacer and pending-wrap cursor
+state; promotion at the last column relocates the complete cell through normal
+wrapping. The leading spacer copy reads the following row and its full text.
+
+## Rejected alternatives
+A hand-maintained emoji table would drift. Per-codepoint reconstruction/width
+scans make long untrusted combining output quadratic. Unconditionally merging
+all graphemes into two columns changes Indic and other non-emoji width contracts.
+A font substitution does not repair terminal cell allocation.
+
+## Consequences
+Existing cell extra storage carries positive-width emoji continuations too.
+SGR inside one emoji retains the first cell's style and its spacer retains OSC8
+links/underline color. Wrapped INSERT reserves two cells in the destination row;
+non-wrapped promotion inserts only the extra cell. Wrapping at physical bottom
+outside the scroll margin does not leave a nonexistent-next-row placeholder. Line-wrap-disabled edge
+promotion retains clipped text without creating an out-of-bounds spacer.
+This fixes model/snapshot input to the shaper; actual Windows glyph/font coverage
+remains a separate native acceptance requirement.
+
+## Validation
+[Fork proof](https://github.com/WilliamWang1721/pebrel/actions/runs/37103145372)
+tested source `c684654b` after the attached formatting patch: 237 core tests passed,
+zero failures/ignored tests; architecture checks against `9dd3d649` passed. Tests
+cover the seven original sequences and controls across UTF-8 chunks, copy/spacer
+selection, snapshots, selectors/wrap/reflow, SGR/sync/OSC8, edits/DECALN/scroll,
+cursor/alternate/resize resets, INSERT, bottom-margin copy and long marks.
+
+The same fork job compared instrumented release input cost with exact main
+`9dd3d649`, on Ubuntu 24.04 x86_64/Rust 1.97.1, median of five samples per unchanged workload.
+The harness uses direct `Term::input`, 120×32 cells and zero scrollback, not PTY,
+GPU, fonts or end-to-end UI timing. Final base/candidate ns per character:
+
+| Workload | Base | Candidate | Base/candidate allocations |
+| --- | ---: | ---: | ---: |
+| ASCII (372k chars) | 8.51 | 9.00 | 0 / 0 |
+| BMP CJK (200k chars) | 17.01 | 17.32 | 0 / 0 |
+| Reported emoji (192k chars) | 26.94 | 102.16 | 96,000 / 228,000 |
+| Long ZWJ (160,120 chars) | 33.23 | 89.73 | 160,000 / 1,000 |
+| Repeated selectors (160,024 chars) | 21.53 | 57.06 | 160,112 / 242 |
+
+Long-mark lengths 1k/2k/4k/16k measured 59.50/59.29/59.20/58.73 ns per character,
+with 3,200/1,760/960/280 allocations for roughly 160k total characters. This supports
+linear growth for that workload, not a universal speed guar
```

**File**: `architecture/notes/nebula_terminal/term/2026-10-05-emoji-input-state-cost.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+# Emoji input state ownership and ordinary-text cost
+
+## Status
+Maintainer revision for PR #451; final-head CI and native glyph acceptance remain separate.
+
+## Context
+The streaming cluster fix preserves complete emoji cells, but boxing the pending
+segmenter allocates once per new cluster. Taking an inline segmenter on every
+continuation would instead move its entire state per codepoint. Ordinary input
+must not inherit large emoji-only stack temporaries.
+
+## Evidence
+Local Windows x86_64 release probes compare main `b6e7b78d`, the original PR
+integrated at `8c770233`, and the revised implementation in `term/input.rs`.
+Later main application changes through `57c7bfdb` do not change this core.
+The probe uses 120 x 40 cells, 1,000 history lines, four warm-up feeds, thin LTO
+and one codegen unit. Timings use the default System allocator; allocation counts
+come from a separate instrumented build and are not timing evidence.
+Nine rounds rotate variant order on CPU affinity mask `0x1`.
+
+Median ns per input character, including parser control bytes for VT workloads:
+
+| Workload | Main | Original PR | Revision |
+| --- | ---: | ---: | ---: |
+| ASCII input | 15.625 | 14.992 | 15.088 |
+| BMP CJK input | 28.323 | 29.087 | 27.935 |
+| ASCII VT | 15.028 | 16.763 | 14.670 |
+| ANSI VT | 12.790 | 11.764 | 11.946 |
+| Reported emoji input | 57.976 | 215.737 | 198.931 |
+| Long combining input | 79.558 | 79.317 | 78.869 |
+
+The emoji workload repeats seven reported sequences 512 times per feed, for 24
+measured feeds. Allocations fall from 467,625 to 381,609 (86,016 fewer, about 18.4%).
+The ASCII, CJK and VT workloads allocate zero times during steady-state input.
+`size_of::<Term<VoidListener>>()` is 1,848 / 1,880 / 2,008 bytes respectively:
+the revision trades 128 fixed bytes per terminal against repeated heap allocation.
+The ordinary-input function's `sub rsp` reservation is `0x68` / `0x168` / `0x58`;
+these figures exclude pushed registers and are not total thread stack usage.
+
+Scheduling spread is substantial. These observations support the bounded
+ownership change, not a universal throughput guarantee or total RSS reduction.
+Main renders these emoji incorrectly, so its emoji timing is not equal-work
+correctness evidence. Probe sources and raw results remain local diagnostic data.
+
+## Decision
+Store `Option<EmojiInput>` inline and update an active segmenter in place. Only
+width migration temporarily takes ownership because wrapping and cell edits
+invalidate input continuity through the existing reset authority. Keep the exact
+cursor and pending-wrap endpoint checks rather than introducing a second policy.
+
+Keep the cheap negative BMP continuation check in `input_character`, and mark
+`extend_emoji_input` non-inlinable so initialization and width migration temporaries
+do not enlarge the ordinary-text frame. Reuse existing character placement for
+ASCII, CJK, insert mode, mapped characters and wrapping.
+
+## Rejected alternatives
+- Per-cluster boxing retains avoidable allocation on emoji-heavy output.
+- Taking the full inline state on every codepoint trades allocation for copying.
+- An ASCII-specific placement branch duplicates established VT behavior without
+  stable measured benefit; it is not retained.
+- Replacing the endpoint with a continuity boolean or conditionally recording it
+  weakens the existing check or adds branches without stable measured benefit.
+- Allocation-instrumented timing perturbs allocation-heavy workloads and is not
+  used as the final throughput comparison.
+
+## Consequences
+Each terminal has a small fixed size increase; cell size and persistence formats
+are unchanged. Emoji cell tails and requested lookbehind context still allocate
+when necessary. No new dependency, thread, cache or background task is introduced.
+Compiler and Unicode upgrades can change both layout and the negative fast path.
+
+## Validation
+The revision passes 90 terminal-module tests, 45 reference-replay tests and 16
+redraw-anchor tests, plus formatting, architecture and diff checks. Added cases
+cover ASCII following an emoji, keycaps, mapped characters, insert/wrap behavior
+and invalidation by cursor/grid edits. Existing chunking, copy, snapshot, selectors,
+width promotion/shrink, reflow and long-mark regressions remain enabled.
+
+An earlier complete local core run had three environment-dependent failures:
+two missing-shell executable cases and one WSL-selected input fixture also
+reproduced on main. They were not counted as passes or repaired by unrelated edits.
+These checks do not establish real-window font coverage or end-to-end latency.
+
+## Supersedes
+The boxed-state ownership and cost discussion in
+[the original cluster decision](2026-10-03-emoji-input-clusters.md).
+Its segmentation, cell-width and continuity contracts remain in effect.
+
+## Revisit when
+Unicode or compiler versions change, representative production traces show an
+
```

**File**: `nebula_terminal/Cargo.toml` (modified, +2/-0)
```diff
@@ -23,6 +23,8 @@ parking_lot = "0.12.0"
 polling = "3.8.0"
 regex-automata = "0.4.3"
 unicode-width = "0.2.0"
+unicode-segmentation = "1.13.3"
+unicode-properties = { version = "0.1.4", default-features = false, features = ["emoji"] }
 vte = { version = "0.15.0", default-features = false, features = ["std", "ansi"] }
 serde = { version = "1", features = ["derive", "rc"], optional = true }
 
```

**File**: `nebula_terminal/src/term/cell.rs` (modified, +3/-3)
```diff
@@ -153,16 +153,16 @@ impl Default for Cell {
 }
 
 impl Cell {
-    /// Zerowidth characters stored in this cell.
+    /// Additional codepoints sharing this cell, including emoji continuations.
     #[inline]
     pub fn zerowidth(&self) -> Option<&[char]> {
         self.extra.as_ref().map(|extra| extra.zerowidth.as_slice())
     }
 
-    /// Write a new zerowidth character to this cell.
+    /// Append a codepoint without allocating another terminal cell.
     #[inline]
     pub fn push_zerowidth(&mut self, character: char) {
-        let extra = self.extra.get_or_insert(Default::default());
+        let extra = self.extra.get_or_insert_with(Default::default);
         Arc::make_mut(extra).zerowidth.push(character);
     }
 
```

**File**: `nebula_terminal/src/term/emoji_input_tests.rs` (added, +285/-0)
```diff
@@ -0,0 +1,285 @@
+use super::*;
+use crate::event::VoidListener;
+use crate::index::{Column, Line};
+use crate::render::{RenderSnapshot, SnapshotConfig};
+use crate::term::{Config, test::TermSize};
+use crate::vte::ansi::{Handler as _, Processor};
+use unicode_properties::UnicodeEmoji as _;
+use unicode_segmentation::UnicodeSegmentation as _;
+use unicode_width::{UnicodeWidthChar as _, UnicodeWidthStr as _};
+
+const EMOJI: &[&str] = &["👨‍👩‍👧", "🏳️‍🌈", "❤️‍🔥", "🐦‍⬛", "🙂‍↔️", "👍🏽", "🇨🇳"];
+
+fn terminal(columns: usize) -> Term<VoidListener> {
+    Term::new(Config::default(), &TermSize::new(columns, 4), VoidListener)
+}
+
+fn feed(term: &mut Term<VoidListener>, text: &str, chunk: usize) {
+    let mut parser = Processor::<crate::vte::ansi::StdSyncHandler>::default();
+    for bytes in text.as_bytes().chunks(chunk) {
+        parser.advance(term, bytes);
+    }
+}
+
+fn cell_text(cell: &Cell) -> String {
+    let mut text = cell.c.to_string();
+    text.extend(cell.zerowidth().into_iter().flatten());
+    text
+}
+
+#[test]
+fn reported_emoji_are_one_wide_cell_across_utf8_chunks_copy_and_snapshot() {
+    for text in EMOJI.iter().copied().chain(["🔥", "😀", "🚀", "🎉", "🐦", "1️⃣"]) {
+        assert_eq!(text.width(), 2, "reference width: {text}");
+        for chunk in [1, 2, 5, text.len()] {
+            let mut term = terminal(80);
+            feed(&mut term, text, chunk);
+            assert_eq!(
+                term.grid.cursor.point,
+                Point::new(Line(0), Column(2)),
+                "{text}, chunk {chunk}"
+            );
+            assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), text);
+            assert!(term.grid[Line(0)][Column(0)].flags.contains(Flags::WIDE_CHAR));
+            assert!(term.grid[Line(0)][Column(1)].flags.contains(Flags::WIDE_CHAR_SPACER));
+            assert_eq!(
+                term.bounds_to_string(
+                    Point::new(Line(0), Column(1)),
+                    Point::new(Line(0), Column(1))
+                ),
+                text
+            );
+            let snap = RenderSnapshot::capture(&term, &SnapshotConfig { rows: 4, cols: 80 });
+            assert_eq!(snap.segments.len(), 1);
+            assert!(snap.segments[0].wide);
+            assert_eq!(snap.segments[0].cells.len(), 1);
+            assert_eq!(snap.segments[0].cells[0].text, text);
+        }
+    }
+}
+
+#[test]
+fn ordinary_ascii_ends_emoji_clusters_while_keycaps_still_compose() {
+    for c in ' '..='~' {
+        let mut term = terminal(80);
+        feed(&mut term, "👨‍👩", 1);
+        term.input(c);
+        assert!(term.input_cluster.is_none());
+        assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), "👨‍👩");
+        assert_eq!(term.grid[Line(0)][Column(2)].c, c);
+    }
+    for c in ['#', '*', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] {
+        let mut term = terminal(80);
+        let keycap = format!("{c}\u{fe0f}\u{20e3}");
+        feed(&mut term, &keycap, 1);
+        assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), keycap);
+        assert_eq!(term.grid.cursor.point.column, Column(2));
+    }
+}
+
+#[test]
+fn ordinary_input_preserves_insert_wrap_and_mapped_characters() {
+    let mut term = terminal(4);
+    feed(&mut term, "ABCDX", 1);
+    assert_eq!(term.grid[Line(1)][Column(0)].c, 'X');
+    assert!(term.grid[Line(0)][Column(3)].flags.contains(Flags::WRAPLINE));
+    feed(&mut term, "\x1b[1;2H\x1b[4hZ", 1);
+    let row: String = (0..4).map(|column| term.grid[Line(0)][Column(column)].c).collect();
+    assert_eq!(row, "AZBC");
+
+    for c in ' '..='~' {
+        if c.is_emoji_char() {
+            continue;
+        }
+        let mut term = terminal(4);
+        feed(&mut term, "\x1b(0", 1);
+        term.input(c);
+        assert!(!term.grid[Line(0)][Column(0)].c.is_emoji_char());
+        assert_eq!(term.grid.cursor.point.column, Column(1));
+    }
+}
+
+#[test]
+fn emoji_continuity_survives_sgr_sync_and_noop_resize_but_not_cursor_or_grid_edits() {
+    let mut term = terminal(80);
+    feed(&mut term, "👨\x1b[31m\x1b[?2026h‍👩\x1b[?2026l‍👧", 1);
+    assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), EMOJI[0]);
+    assert_eq!(
+        term.grid[Line(0)][Column(0)].fg,
+        crate::vte::ansi::Color::Named(crate::vte::ansi::NamedColor::Foreground)
+    );
+    let mut term = terminal(80);
+    term.input('👍');
+    term.resize(TermSize::new(80, 4));
+    term.input('🏽');
+    assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), "👍🏽");
+
+    for control in [
+        "\x1b[3G",
+        "\x1b[1D\x1b[1C",
+        "\x1b[0K",
+        "\x1b#8",
+        "\x1b[1L",
+        "\x1b[1M",
+        "\x1b[1I\x1b[1Z",
+        "\x1b[1A",
+        "\x1b[1B",
+        "\x1b[1P",
+        "\x1b[1@",
+        "\x1b[1X",
+        "\x1b[1S",
+        "\x1b[1T",
+        "\x08",
+        "\r",
+        "\n",
+        "\t",
+        "\x1bM",
+        "\x1b7\x1b8",
+        "\x1b[2J",
+        "\x1bc",
+        "\x1b
```

**File**: `nebula_terminal/src/term/input.rs` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+//! Streaming emoji cell allocation. Ordinary text keeps the existing VT placement.
+
+use unicode_properties::UnicodeEmoji as _;
+use unicode_segmentation::{GraphemeCursor, GraphemeIncomplete};
+use unicode_width::{UnicodeWidthChar as _, UnicodeWidthStr as _};
+
+use super::{Cell, Dimensions, EventListener, Flags, Point, Term, TermMode};
+use crate::vte::ansi::Handler as _;
+
+pub(super) struct EmojiInput {
+    segmenter: GraphemeCursor,
+    bytes: usize,
+    context: String,
+    last: char,
+    graphic: char,
+    joined: bool,
+}
+
+impl EmojiInput {
+    fn new(c: char) -> Option<Self> {
+        // The only ASCII emoji bases are the standardized keycap bases.
+        if (c.is_ascii() && !matches!(c, '#' | '*' | '0'..='9')) || !c.is_emoji_char() {
+            return None;
+        }
+        let mut buffer = [0; 4];
+        let text = c.encode_utf8(&mut buffer);
+        // An open-ended cursor defers the boundary until the next UTF-8 chunk.
+        let mut segmenter = GraphemeCursor::new(0, usize::MAX, true);
+        let result = segmenter.next_boundary(text, 0);
+        debug_assert_eq!(result, Err(GraphemeIncomplete::NextChunk));
+        Some(Self {
+            segmenter,
+            bytes: text.len(),
+            context: String::new(),
+            last: c,
+            graphic: c,
+            joined: false,
+        })
+    }
+
+    fn continues(&mut self, c: char, cell: &Cell) -> bool {
+        let mut buffer = [0; 8];
+        let (text, chunk_start) = if cell.zerowidth().is_none_or(|tail| tail.is_empty()) {
+            let first_len = cell.c.encode_utf8(&mut buffer).len();
+            let next_len = c.encode_utf8(&mut buffer[first_len..]).len();
+            (std::str::from_utf8(&buffer[..first_len + next_len]).unwrap(), 0)
+        } else {
+            (c.encode_utf8(&mut buffer) as &str, self.bytes)
+        };
+        loop {
+            match self.segmenter.next_boundary(text, chunk_start) {
+                Err(GraphemeIncomplete::NextChunk) => {
+                    self.bytes += c.len_utf8();
+                    if !self.context.is_empty() {
+                        self.context.push(c);
+                    }
+                    return true;
+                },
+                Err(GraphemeIncomplete::PreContext(end)) => {
+                    // Context is built only when GB11/Indic lookbehind asks for it;
+                    // later extensions append, rather than rescan/rebuild a long cluster.
+                    if self.context.is_empty() {
+                        self.context.push(cell.c);
+                        self.context.extend(cell.zerowidth().into_iter().flatten());
+                    }
+                    self.segmenter.provide_context(&self.context[..end], 0);
+                },
+                Ok(Some(_)) => return false,
+                other => unreachable!("complete UTF-8 input chunk: {other:?}"),
+            }
+        }
+    }
+}
+
+fn sequence_width(first: char, tail: &[char]) -> usize {
+    let mut buffer = [0; 12];
+    let mut len = first.encode_utf8(&mut buffer).len();
+    for c in tail {
+        len += c.encode_utf8(&mut buffer[len..]).len();
+    }
+    std::str::from_utf8(&buffer[..len]).unwrap().width()
+}
+
+impl<T> Term<T> {
+    #[inline]
+    pub(super) fn reset_input_cluster(&mut self) {
+        self.input_cluster = None;
+        self.input_end = None;
+    }
+}
+
+impl<T: EventListener> Term<T> {
+    #[inline]
+    pub(super) fn input_character(&mut self, c: char) {
+        // Number of cells the char will occupy.
+        let width = match c.width() {
+            Some(width) => width,
+            None => return,
+        };
+
+        if !c.is_ascii()
+            && (self.input_cluster.is_some() || width == 0 || c > '\u{ffff}')
+            && self.extend_emoji_input(c, width)
+        {
+            return;
+        }
+        self.reset_input_cluster();
+
+        // Preserve the existing placement of standalone combining characters.
+        if width == 0 {
+            // Get previous column.
+            let mut column = self.grid.cursor.point.column;
+            if !self.grid.cursor.input_needs_wrap {
+                column.0 = column.saturating_sub(1);
+            }
+
+            // Put zerowidth characters over first fullwidth character cell.
+            let line = self.grid.cursor.point.line;
+            if self.grid[line][column].flags.contains(Flags::WIDE_CHAR_SPACER) {
+                column.0 = column.saturating_sub(1);
+            }
+
+            self.grid[line][column].push_zerowidth(c);
+            return;
+        }
+
+        // Move cursor to next line.
+        if self.grid.cursor.input_needs_wrap {
+            self.wrapline();
+        }
+
+        // If in insert mode, first shift cells to the right.
+        let columns = self.columns();
+        if self.mode.contains(TermMode::INSERT) && self.grid.cursor.point.column + width < columns {
+            let l
```

**File**: `nebula_terminal/src/term/mod.rs` (modified, +48/-79)
```diff
@@ -12,7 +12,6 @@ use base64::Engine;
 use base64::engine::general_purpose::STANDARD as Base64;
 use bitflags::bitflags;
 use log::{debug, trace};
-use unicode_width::UnicodeWidthChar;
 
 use crate::event::{Event, EventListener};
 use crate::grid::{Dimensions, Grid, Scroll};
@@ -31,6 +30,7 @@ pub mod cell;
 mod clear;
 pub mod color;
 mod damage;
+mod input;
 mod keyboard;
 #[cfg(test)]
 mod keyboard_contract_tests;
@@ -161,6 +161,8 @@ pub fn viewport_to_point_from(origin: Line, point: Point<usize>) -> Point {
 
 pub struct Term<T> {
     redraw_anchor: redraw_anchor::RedrawAnchor,
+    input_cluster: Option<input::EmojiInput>,
+    input_end: Option<(Point, bool)>,
     /// Terminal focus controlling the cursor shape.
     pub is_focused: bool,
 
@@ -387,6 +389,8 @@ impl<T> Term<T> {
 
         Term {
             redraw_anchor: Default::default(),
+            input_cluster: None,
+            input_end: None,
             inactive_grid,
             scroll_region,
             event_proxy,
@@ -652,8 +656,13 @@ impl<T> Term<T> {
             && line_length.0 >= 2
             && grid_line[line_length - 1].flags.contains(Flags::LEADING_WIDE_CHAR_SPACER)
             && include_wrapped_wide
+            && line < self.bottommost_line()
         {
-            text.push(self.grid[line - 1i32][Column(0)].c);
+            let cell = &self.grid[line + 1i32][Column(0)];
+            if cell.flags.contains(Flags::WIDE_CHAR) {
+                text.push(cell.c);
+                text.extend(cell.zerowidth().into_iter().flatten());
+            }
         }
 
         text
@@ -727,6 +736,7 @@ impl<T> Term<T> {
 
     /// Mutable access to the raw grid data structure.
     pub fn grid_mut(&mut self) -> &mut Grid<Cell> {
+        self.reset_input_cluster();
         &mut self.grid
     }
 
@@ -744,6 +754,7 @@ impl<T> Term<T> {
             return;
         }
 
+        self.reset_input_cluster();
         debug!("New num_cols is {num_cols} and num_lines is {num_lines}");
 
         // Move vi mode cursor with the content.
@@ -810,6 +821,7 @@ impl<T> Term<T> {
 
     /// Swap primary and alternate screen buffer.
     pub fn swap_alt(&mut self) {
+        self.reset_input_cluster();
         self.cancel_redraw_anchor();
         if !self.mode.contains(TermMode::ALT_SCREEN) {
             // Set alt screen cursor to the current primary screen cursor.
@@ -839,6 +851,7 @@ impl<T> Term<T> {
     /// Expects origin to be in scroll range.
     #[inline]
     fn scroll_down_relative(&mut self, origin: Line, mut lines: usize) {
+        self.reset_input_cluster();
         trace!("Scrolling down relative: origin={origin}, lines={lines}");
 
         lines = cmp::min(lines, (self.scroll_region.end - self.scroll_region.start).0 as usize);
@@ -867,6 +880,7 @@ impl<T> Term<T> {
     /// Expects origin to be in scroll range.
     #[inline]
     fn scroll_up_relative(&mut self, origin: Line, mut lines: usize) {
+        self.reset_input_cluster();
         trace!("Scrolling up relative: origin={origin}, lines={lines}");
 
         lines = cmp::min(lines, (self.scroll_region.end - self.scroll_region.start).0 as usize);
@@ -923,6 +937,7 @@ impl<T> Term<T> {
         if delta == 0 || delta >= self.screen_lines() {
             return;
         }
+        self.reset_input_cluster();
         let region = Line(0)..Line(self.screen_lines() as i32);
         // 选区跟着内容走：`rotate` 的正负与内容位移同向（上滚为负）。
         let rotation = if target < cursor { delta as i32 } else { -(delta as i32) };
@@ -1125,9 +1140,16 @@ impl<T> Term<T> {
 
         trace!("Wrapping input");
 
-        self.grid.cursor_cell().flags.insert(Flags::WRAPLINE);
+        let next_line = self.grid.cursor.point.line + 1;
+        if next_line < self.screen_lines() || next_line == self.scroll_region.end {
+            self.grid.cursor_cell().flags.insert(Flags::WRAPLINE);
+        } else {
+            // Below the scrolling margin at the physical bottom, wrapping cannot
+            // advance. Do not leave a placeholder pointing at a nonexistent row.
+            self.grid.cursor_cell().flags.remove(Flags::WRAPLINE | Flags::LEADING_WIDE_CHAR_SPACER);
+        }
 
-        if self.grid.cursor.point.line + 1 >= self.scroll_region.end {
+        if next_line >= self.scroll_region.end {
             self.linefeed();
         } else {
             self.damage_cursor();
@@ -1207,85 +1229,12 @@ impl<T: EventListener> Handler for Term<T> {
     /// A character to be displayed.
     #[inline(never)]
     fn input(&mut self, c: char) {
-        // Number of cells the char will occupy.
-        let width = match c.width() {
-            Some(width) => width,
-            None => return,
-        };
-
-        // Handle zero-width characters.
-        if width == 0 {
-            // Get previous column.
-            let mut column = self.grid.cursor.point.column;
-            if !self.grid.cursor.input_needs_wrap {
-                column.0 = column.saturating_sub(1);
-            }
-
-       
```

---

### Incident Patch 6: `c43e953c` (2026-10-05)
**Commit Message**: fix(menu): add the missing terminal paste icon

**File**: `nebula_app/assets/icons/nebula-clipboard-paste.svg` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+<!--
+Source: https://raw.githubusercontent.com/lucide-icons/lucide/500620a2e8123f8d1db191538886dc0c223f69a9/icons/clipboard-paste.svg
+
+ISC License
+
+Copyright (c) 2026 Lucide Icons and Contributors
+
+Permission to use, copy, modify, and/or distribute this software for any
+purpose with or without fee is hereby granted, provided that the above
+copyright notice and this permission notice appear in all copies.
+
+THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
+WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
+MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
+ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
+WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
+ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
+OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
+-->
+<svg
+  xmlns="http://www.w3.org/2000/svg"
+  width="24"
+  height="24"
+  viewBox="0 0 24 24"
+  fill="none"
+  stroke="currentColor"
+  stroke-width="2"
+  stroke-linecap="round"
+  stroke-linejoin="round"
+>
+  <path d="M11 14h10" />
+  <path d="M16 4h2a2 2 0 0 1 2 2v1.344" />
+  <path d="m17 18 4-4-4-4" />
+  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113" />
+  <rect x="8" y="2" width="8" height="4" rx="1" />
+</svg>
```

**File**: `nebula_app/src/gpui_shell/assets.rs` (modified, +2/-0)
```diff
@@ -40,6 +40,7 @@ const NEBULA_ICONS: &[(&str, &[u8])] = icons![
     "backup-check",
     "pin",
     "pencil",
+    "clipboard-paste",
     "trash-2",
     "refresh",
     "phone",
@@ -107,6 +108,7 @@ pub mod nav {
     pub const KEYMAP: &str = "icons/nebula-keymap.svg";
     /// Lucide pencil；固定组件资产集未收录，命令行内编辑动作需要明确图形语义。
     pub const PENCIL: &str = "icons/nebula-pencil.svg";
+    pub const CLIPBOARD_PASTE: &str = "icons/nebula-clipboard-paste.svg";
     /// Lucide trash-2；删除保存命令不能借用表示 Backspace 的 `IconName::Delete`。
     pub const TRASH: &str = "icons/nebula-trash-2.svg";
     pub const REFRESH: &str = "icons/nebula-refresh.svg";
```

**File**: `nebula_app/src/gpui_shell/workspace/send_to_chat.rs` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@ impl NebulaWorkspace {
                 }
             });
         let paste_item = PopupMenuItem::new(language.text(crate::i18n::Message::CommonPaste))
+            .icon(Icon::default().path(crate::gpui_shell::assets::nav::CLIPBOARD_PASTE))
             .on_click(move |_, window, cx| {
                 if let Some(source) = paste_source.upgrade() {
                     source.update(cx, |view, cx| view.paste(window, cx));
```

**File**: `nebula_app/src/gpui_shell/workspace/send_to_chat/menu_tests.rs` (modified, +6/-1)
```diff
@@ -1,7 +1,7 @@
 use super::*;
 use crate::gpui_shell::terminal::view::TerminalLaunch;
 use crate::gpui_shell::workspace::{TabMeta, windowing};
-use gpui::{TestAppContext, VisualTestContext, point, size};
+use gpui::{AssetSource as _, TestAppContext, VisualTestContext, point, size};
 use gpui_component::Root;
 use nebula_split::SplitTree;
 
@@ -15,6 +15,11 @@ fn draw(cx: &mut VisualTestContext) {
 
 #[gpui::test]
 fn terminal_menu_renders_without_a_selection_and_escape_restores_focus(cx: &mut TestAppContext) {
+    let paste_icon = crate::gpui_shell::assets::NebulaAssets
+        .load(crate::gpui_shell::assets::nav::CLIPBOARD_PASTE)
+        .unwrap()
+        .expect("paste icon must be embedded in the product asset source");
+    assert!(std::str::from_utf8(&paste_icon).unwrap().contains("viewBox=\"0 0 24 24\""));
     let hub = crate::runtime_api::RuntimeHub::new();
     cx.update(|cx| {
         gpui_component::init(cx);
```

---

### Incident Patch 7: `ec46eb55` (2026-10-05)
**Commit Message**: Merge reviewed WSL and cold-start fixes before emoji integration

**File**: `architecture/notes/nebula_app/shell_detect/2026-09-28-wsl-spawn-distro-snapshot.md` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+# WSL pane identity is the distribution resolved at spawn
+
+## Status
+
+Proposed for review with implementation.
+
+## Context
+
+`wsl_launch_distro` recognizes only an explicit `-d`/`--distribution`; its test
+states that guessing the default distribution for a bare `wsl` could point at the
+wrong guest. As a consequence, bare `wsl`, legacy `shell=wsl` and panes whose
+default shell is WSL had no cwd mapping: the file tree, Git view and prompt-path
+links ignored them. The workspace also read WSL identity from the tab-level
+launch, which is `Default` for a default-shell tab and `Profile` for imported
+profiles, so those panes were ignored even with an explicit distribution.
+
+## Evidence
+
+`wsl.exe` itself reads `HKCU\...\Lxss\DefaultDistribution` when it starts. The
+completion context already resolved that value at spawn for history scoping
+(`completion_context::launch_environment`). Each view keeps its own spawn-time
+`session_launch`; split panes can differ from the first pane of a tab.
+
+Review of the first cut found that the helpers disagreed on where WSL's options
+end. `wsl_launch_distro` scanned the whole argv, so `wsl -e tool -d x` named the
+guest command's `x`. `--distribution=Debian` and `--system` fell through to the
+registry default. Explicit shell arguments are joined raw
+(`tty::Options::escape_args` is `false`), so an injected `--cd /home/a b` split
+into a directory plus a guest command; a directory name from a cloned repository
+could thus run a guest command on split, duplicate or fork. `runtime_exec`, the WSL hook setup and a
+PTY-default `shell=wsl` pane still read launch arguments without the snapshot.
+
+`wsl.exe -- …` hands the joined line to the guest's login shell: measured on
+2026-09-30, a directory named `x$(touch /tmp/pwned)` ran the `touch` through
+`--` and not through `--exec`. Direct exec also keeps `find -printf`'s single
+backslash.
+
+## Decision
+
+A pane's WSL identity is the distribution resolved at spawn
+(`shell_detect::wsl_spawn_distro`): the explicit distribution, else the registry
+default; `--distribution-id` and `--system` resolve to `None` rather than to the
+default. `shell_detect::spawn_shell` pins every WSL spawn to it
+(`wsl_args_pinned`) while the persisted launch stays as the user configured it,
+and a PTY-default `shell=wsl` pane now spawns the snapshotted `wsl.exe`
+explicitly. The pane's `PaneExecContext` records the pinned options, so the
+workspace WSL location and prompt-path links read the focused pane's snapshot
+(`TerminalView::wsl_distro`) instead of the tab launch. Completion scoping
+reuses the spawn's value; a new-tab decision reads it on its own.
+`wsl_launch_distro` keeps its explicit-only semantics.
+
+One parser, `shell_detect::wsl_options`, reads WSL's option region for every
+reader, and `is_wsl_launcher` is the one WSL program detector for launches. The
+parser tolerates the `=` forms that `wsl_args_with_directory` already preserved,
+although `wsl.exe` itself rejects them. Completion classifies a typed command
+word separately.
+
+An injected guest cwd is encoded for `wsl.exe`'s own command-line splitting,
+not the CRT's (`shell_detect::wsl_raw_arg`). Measured on WSL 2 on 2026-09-29:
+`wsl.exe` pairs `"` and keeps every backslash literal, so a CRT `\"` ends the
+quote and the rest of the path runs as a guest command. A path with whitespace
+is wrapped in quotes; a path containing `"` has no encoding and is not
+injected: a split, duplicate or fork keeps the launch's own `--cd` or `~`, and
+only a file-tree terminal starts without `--cd`. `pane.exec` keeps the same
+restriction for startup `--cd` through `wsl_accepts_startup_arg`. The argv after
+`--exec` uses native `Command` quoting, not that startup option restriction.
+A maintainer's native Rust round-trip on WSL 2.7.13.0 / Windows 22631 preserved
+double quotes, whitespace and a trailing backslash in direct-exec arguments.
+Persisted WSL launch arguments follow the raw convention too:
+a spaced `--cd` value is stored quoted, which is what a restored raw spawn needs.
+
+Host-side guest helpers (the side panel's git and `find`, the merge tab's
+`cat`/`tee`/git) start through `shell_detect::wsl_exec_command`
+(`wsl.exe -d <distro> --exec`), because the snapshot made every WSL pane, not
+only an explicit `-d` one, feed its reported cwd to them. Helper paths remain
+separate argv after `--exec`, including literal quotes; they are never shell text.
+
+Copies of a pane follow its snapshot through one rule
+(`tab_duplication::copy_launch`). Split, duplicate and AI-session fork insert
+`-d <snapshot>` into a bare launch, after a leading `~`, so a later default
+change cannot move the copy; the pin is persisted only in the copy, and the
+restored original follows the default again. Full-layout duplication pins every
+pane's launch and reuses shared reconstruction for directories and layout; it
+does not return to single-pane duplication. The guest cwd travels 
```

**File**: `architecture/notes/scripts/check_prohibited_names/2026-10-05-diff-header-byte-boundary.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Diff metadata and source decoding boundaries
+
+## Status
+
+Proposed maintainer repair for the reproduced PR #351 check failure.
+
+## Context
+
+The naming checker must scan added source and pending commit messages, including
+text added and later removed. It decoded an entire Git diff as UTF-8 before
+finding source lines.
+
+## Evidence
+
+Git 2.55.0 emitted a combined hunk title ending in bytes `e8 b0`, cutting the final
+codepoint of a Chinese context label. Both document revisions are valid UTF-8.
+The failing input is reproducible with `git show --format= --cc --no-ext-diff
+--unified=0 78b20d2c -- docs/runtime-control-api.md`. The title is metadata, not an
+added source line; decoding it rejected a legitimate edit before scanning it.
+
+## Decision
+
+Read physical diff lines and ASCII hunk/addition prefixes as bytes. Decode only
+the added source payload, still using strict UTF-8. Staged and commit scans share
+that implementation. File headers are recognized by their pre-hunk position,
+so added source beginning with multiple plus signs remains subject to checking.
+
+## Rejected alternatives
+
+- Replacement decoding would hide invalid added source bytes.
+- Ignoring files, commits or the failing check would weaken the actual policy.
+- Editing legitimate document text merely to change Git's context truncation
+  would conceal the parser defect.
+
+## Consequences
+
+Patterns, exemptions, commit-message/path decoding and whole-history scope are
+unchanged. Malformed added UTF-8 still fails. There is no product runtime change.
+
+## Validation
+
+Focused regressions cover regular and combined truncated headers, prohibited
+source after those headers, plus-prefixed source and invalid added bytes. Run the
+existing naming-check suite and the original failing range before integration.
+
+## Supersedes
+
+None; repairs metadata parsing without changing the naming policy.
+
+## Revisit when
+
+Git's diff output format or the checker's source selection changes.
```

**File**: `docs/runtime-control-api.md` (modified, +4/-2)
```diff
@@ -297,8 +297,10 @@ managed generation 改变时，旧回调直接丢弃，不会寻找替代 pane
 
 `pane.exec` 与 `pane.run` 是两种刻意分开的执行语义：它直接接收 argv，不经过 shell 展开，
 在 Pane 当前上报的本地 cwd 中启动独立 non-TTY child，不写入 Grid、history 或交互 shell
-环境。WSL Pane 通过对应 distribution 和 guest cwd 执行；SSH Pane 返回
-`remote_exec_unsupported`。stdout/stderr 始终并行排水，每条默认最多保留 1 MiB、可配置上限
+环境。WSL Pane 通过对应 distribution 和 guest cwd 执行；argv 通过 `--exec` 保留原生参数边界，
+包括参数内部的双引号。当前启动目录模型不接收含 `"` 的 guest cwd，此时返回
+`exec_argument_unsupported`（`details.argument` 为该目录），不会改写后执行。
+SSH Pane 返回 `remote_exec_unsupported`。stdout/stderr 始终并行排水，每条默认最多保留 1 MiB、可配置上限
 16 MiB；响应的 `stdout`/`stderr` 是直接字符串，`capture` 分别报告 encoding、总字节数、保留
 字节数和截断状态。超时会回收整个子进程树，并保留已捕获输出与 `timed_out: true`。
 
```

**File**: `nebula_app/AGENTS.md` (modified, +1/-0)
```diff
@@ -12,5 +12,6 @@
 - 补齐数据源选择和请求快照归 `completion.rs`，界面仅拥有任务与交互；边界依据见 [`completion`](../architecture/notes/nebula_app/completion/)。
 - 旧渲染入口的窗口动画状态归 `display/animations.rs`；迁移及显式 legacy 验证依据见 [`display`](../architecture/notes/nebula_app/display/)。
 - 新终端代理保持选定协议，不把 SOCKS 改写成 HTTP。见 [`terminal proxy scheme`](../architecture/notes/nebula_app/ssh_proxy/2026-09-29-terminal-proxy-scheme.md)。
+- WSL pane 的发行版快照与分屏/新标签继承见 [`shell_detect`](../architecture/notes/nebula_app/shell_detect/)。
 - Windows Acrylic 的运行库回退与窗口生命周期见 [`platform`](../architecture/notes/nebula_app/platform/2026-09-22-acrylic-controller.md)。
 - Windows Acrylic 的动画期间透明回退与计时边界见 [`窗口状态切换`](../architecture/notes/nebula_app/platform/2026-09-22-acrylic-window-transitions.md)。
```

**File**: `nebula_app/src/completion_context.rs` (modified, +4/-7)
```diff
@@ -209,15 +209,12 @@ fn typed_environment(parent: &SuggestEnv, words: &[String], wsl: bool) -> Sugges
 }
 
 pub(crate) fn launch_environment(program: &str, args: &[String]) -> SuggestEnv {
+    if crate::shell_detect::is_wsl_launcher(program) {
+        let distro = crate::shell_detect::wsl_spawn_distro(program, args).unwrap_or_default();
+        return SuggestEnv::Wsl { distro };
+    }
     let program_name = program.rsplit(['/', '\\']).next().unwrap_or(program);
     match crate::display::extract_program(program_name).as_deref() {
-        Some("wsl") => {
-            let distro = crate::shell_detect::wsl_launch_distro(program, args)
-                .map(str::to_owned)
-                .or_else(crate::platform::shell::default_wsl_distro)
-                .unwrap_or_default();
-            SuggestEnv::Wsl { distro }
-        },
         Some("ssh") => {
             let words: Vec<_> =
                 std::iter::once(program.to_owned()).chain(args.iter().cloned()).collect();
```

**File**: `nebula_app/src/display/side_panel/enumerate.rs` (modified, +8/-19)
```diff
@@ -116,8 +116,8 @@ pub(crate) fn run_wsl_find_lenient(
     distro: &str,
     args: impl IntoIterator<Item = OsString>,
 ) -> Option<(Vec<u8>, bool)> {
-    let mut command = std::process::Command::new("wsl.exe");
-    command.args(["-d", distro, "--", "find"]).args(args);
+    let mut command = crate::shell_detect::wsl_exec_command(distro);
+    command.arg("find").args(args);
     crate::platform::process::hidden_command(&mut command);
     let output = match command_output_with_timeout(command, Some(WSL_COMMAND_TIMEOUT)) {
         Ok(output) => output,
@@ -143,24 +143,13 @@ pub(crate) fn run_wsl_find(
     exit_ok.then_some(stdout)
 }
 
-/// `find -printf` 的格式串：类型 + NUL + 全路径 + NUL。**反斜杠必须写两遍**。
+/// `find -printf` 的格式串：类型 + NUL + 全路径 + NUL。
 ///
-/// 2026-08-21 实测：`wsl.exe -d <发行版> -- <命令>` 在把参数转发给来宾时会吞掉
-/// 一层反斜杠。同一条 find、同一个目录，三种写法的输出对照：
-///
-/// | 传入 | NUL 个数 | 输出开头 |
-/// |---|---|---|
-/// | `%y\0%f\0`   | **0**  | `l0lib0d0opt0…` |
-/// | `%y\\0%f\\0` | 54     | `l\0lib\0d\0opt\0…` |
-/// | `sh -c` 包一层 | 54   | `l\0lib\0d\0opt\0…` |
-///
-/// 也就是说单反斜杠版本让 find 收到的是 `%y0%f0`，输出用字面字符 `'0'` 分隔、
-/// 一个 NUL 都没有，[`parse_wsl_find_pairs`] 因此永远配不出记录、返回空列表——
-/// UI 再把空列表显示成"此目录为空"。这就是 WSL 文件树空白的根因。
-///
-/// 用双反斜杠而不是 `sh -c` 包装：后者要为含空格/引号的来宾路径再做一层 shell
-/// 引用，而这里只需要把转义层数补对。
-pub(crate) const WSL_FIND_PATH_FORMAT: &str = r"%y\\0%p\\0";
+/// 单反斜杠：[`crate::shell_detect::wsl_exec_command`] 直接 exec `find`，不经
+/// 来宾 shell（`search/walk.rs` 同理）。旧的 `wsl.exe -d <发行版> -- find` 会让
+/// 来宾 shell 解释路径里的 `$(…)`，还会吞掉一层反斜杠（2026-08-21 实测单反斜杠
+/// 版本一个 NUL 都输出不了，文件树因此全空），所以当时写两遍；那条路已弃用。
+pub(crate) const WSL_FIND_PATH_FORMAT: &str = r"%y\0%p\0";
 
 /// 一趟 `find` 的结果，按父目录分桶。
 pub(crate) struct WslDirListing {
```

**File**: `nebula_app/src/display/side_panel/vcs.rs` (modified, +3/-5)
```diff
@@ -320,7 +320,7 @@ impl SidePanel {
             let mut guest_args: Vec<OsString> = [
                 "-d",
                 located.distro.as_str(),
-                "--",
+                "--exec",
                 "git",
                 "-C",
                 located.guest.as_str(),
@@ -824,12 +824,10 @@ pub(crate) fn read_git(root: &Path) -> Option<GitInfo> {
 /// 代价是每次快照多一次 `wsl.exe` 进程往返（发行版没运行时还会把它拉起
 /// 来）。快照本来就在后台线程上、且有节流，不进渲染路径。
 pub(crate) fn read_git_wsl(located: &crate::shell_detect::WslCwd) -> Option<GitInfo> {
-    use std::process::Command;
     let location = format!("{}:{}", located.distro, located.guest);
     collect_git_info(|args| {
-        let mut cmd = Command::new("wsl.exe");
-        cmd.args(["-d", &located.distro, "--", "git", "-C", &located.guest, "--no-optional-locks"])
-            .args(args);
+        let mut cmd = crate::shell_detect::wsl_exec_command(&located.distro);
+        cmd.args(["git", "-C", &located.guest, "--no-optional-locks"]).args(args);
         run_git(cmd, args, &location, Some(WSL_COMMAND_TIMEOUT))
     })
 }
```

**File**: `nebula_app/src/gpui_shell/code_tab.rs` (modified, +6/-6)
```diff
@@ -654,9 +654,9 @@ fn read_worktree_file(key: &MergeKey) -> Result<Vec<u8>, String> {
         },
         GitLocation::Wsl { distro, root } => {
             let path = join_guest_path(root, &key.relative_path);
-            let mut command = Command::new("wsl.exe");
+            let mut command = crate::shell_detect::wsl_exec_command(distro);
             let output = crate::platform::process::hidden_command(&mut command)
-                .args(["-d", distro, "--", "cat", "--", path.as_str()])
+                .args(["cat", "--", path.as_str()])
                 .output()
                 .map_err(|error| format!("无法从 WSL 读取冲突文件: {error}"))?;
             if output.status.success() { Ok(output.stdout) } else { Ok(Vec::new()) }
@@ -676,9 +676,9 @@ fn write_conflict_result(key: &MergeKey, result: String) -> Result<(), String> {
         },
         GitLocation::Wsl { distro, root } => {
             let path = join_guest_path(root, &key.relative_path);
-            let mut command = Command::new("wsl.exe");
+            let mut command = crate::shell_detect::wsl_exec_command(distro);
             let mut child = crate::platform::process::hidden_command(&mut command)
-                .args(["-d", distro, "--", "sh", "-c", "cat > \"$1\"", "nebula", path.as_str()])
+                .args(["tee", "--", path.as_str()])
                 .stdin(Stdio::piped())
                 .stdout(Stdio::null())
                 .stderr(Stdio::piped())
@@ -720,8 +720,8 @@ fn git_command(location: &GitLocation, args: &[&str]) -> Result<std::process::Ou
             command
         },
         GitLocation::Wsl { distro, root } => {
-            let mut command = Command::new("wsl.exe");
-            command.args(["-d", distro, "--", "git", "-C", root, "--no-optional-locks"]);
+            let mut command = crate::shell_detect::wsl_exec_command(distro);
+            command.args(["git", "-C", root, "--no-optional-locks"]);
             command
         },
     };
```

---

### Incident Patch 8: `aedfd3e7` (2026-10-05)
**Commit Message**: Merge reviewed WSL fixes before cold-start integration

**File**: `architecture/notes/nebula_app/shell_detect/2026-09-28-wsl-spawn-distro-snapshot.md` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+# WSL pane identity is the distribution resolved at spawn
+
+## Status
+
+Proposed for review with implementation.
+
+## Context
+
+`wsl_launch_distro` recognizes only an explicit `-d`/`--distribution`; its test
+states that guessing the default distribution for a bare `wsl` could point at the
+wrong guest. As a consequence, bare `wsl`, legacy `shell=wsl` and panes whose
+default shell is WSL had no cwd mapping: the file tree, Git view and prompt-path
+links ignored them. The workspace also read WSL identity from the tab-level
+launch, which is `Default` for a default-shell tab and `Profile` for imported
+profiles, so those panes were ignored even with an explicit distribution.
+
+## Evidence
+
+`wsl.exe` itself reads `HKCU\...\Lxss\DefaultDistribution` when it starts. The
+completion context already resolved that value at spawn for history scoping
+(`completion_context::launch_environment`). Each view keeps its own spawn-time
+`session_launch`; split panes can differ from the first pane of a tab.
+
+Review of the first cut found that the helpers disagreed on where WSL's options
+end. `wsl_launch_distro` scanned the whole argv, so `wsl -e tool -d x` named the
+guest command's `x`. `--distribution=Debian` and `--system` fell through to the
+registry default. Explicit shell arguments are joined raw
+(`tty::Options::escape_args` is `false`), so an injected `--cd /home/a b` split
+into a directory plus a guest command; a directory name from a cloned repository
+could thus run a guest command on split, duplicate or fork. `runtime_exec`, the WSL hook setup and a
+PTY-default `shell=wsl` pane still read launch arguments without the snapshot.
+
+`wsl.exe -- …` hands the joined line to the guest's login shell: measured on
+2026-09-30, a directory named `x$(touch /tmp/pwned)` ran the `touch` through
+`--` and not through `--exec`. Direct exec also keeps `find -printf`'s single
+backslash.
+
+## Decision
+
+A pane's WSL identity is the distribution resolved at spawn
+(`shell_detect::wsl_spawn_distro`): the explicit distribution, else the registry
+default; `--distribution-id` and `--system` resolve to `None` rather than to the
+default. `shell_detect::spawn_shell` pins every WSL spawn to it
+(`wsl_args_pinned`) while the persisted launch stays as the user configured it,
+and a PTY-default `shell=wsl` pane now spawns the snapshotted `wsl.exe`
+explicitly. The pane's `PaneExecContext` records the pinned options, so the
+workspace WSL location and prompt-path links read the focused pane's snapshot
+(`TerminalView::wsl_distro`) instead of the tab launch. Completion scoping
+reuses the spawn's value; a new-tab decision reads it on its own.
+`wsl_launch_distro` keeps its explicit-only semantics.
+
+One parser, `shell_detect::wsl_options`, reads WSL's option region for every
+reader, and `is_wsl_launcher` is the one WSL program detector for launches. The
+parser tolerates the `=` forms that `wsl_args_with_directory` already preserved,
+although `wsl.exe` itself rejects them. Completion classifies a typed command
+word separately.
+
+An injected guest cwd is encoded for `wsl.exe`'s own command-line splitting,
+not the CRT's (`shell_detect::wsl_raw_arg`). Measured on WSL 2 on 2026-09-29:
+`wsl.exe` pairs `"` and keeps every backslash literal, so a CRT `\"` ends the
+quote and the rest of the path runs as a guest command. A path with whitespace
+is wrapped in quotes; a path containing `"` has no encoding and is not
+injected: a split, duplicate or fork keeps the launch's own `--cd` or `~`, and
+only a file-tree terminal starts without `--cd`. `pane.exec` keeps the same
+restriction for startup `--cd` through `wsl_accepts_startup_arg`. The argv after
+`--exec` uses native `Command` quoting, not that startup option restriction.
+A maintainer's native Rust round-trip on WSL 2.7.13.0 / Windows 22631 preserved
+double quotes, whitespace and a trailing backslash in direct-exec arguments.
+Persisted WSL launch arguments follow the raw convention too:
+a spaced `--cd` value is stored quoted, which is what a restored raw spawn needs.
+
+Host-side guest helpers (the side panel's git and `find`, the merge tab's
+`cat`/`tee`/git) start through `shell_detect::wsl_exec_command`
+(`wsl.exe -d <distro> --exec`), because the snapshot made every WSL pane, not
+only an explicit `-d` one, feed its reported cwd to them. Helper paths remain
+separate argv after `--exec`, including literal quotes; they are never shell text.
+
+Copies of a pane follow its snapshot through one rule
+(`tab_duplication::copy_launch`). Split, duplicate and AI-session fork insert
+`-d <snapshot>` into a bare launch, after a leading `~`, so a later default
+change cannot move the copy; the pin is persisted only in the copy, and the
+restored original follows the default again. Full-layout duplication pins every
+pane's launch and reuses shared reconstruction for directories and layout; it
+does not return to single-pane duplication. The guest cwd travels 
```

**File**: `architecture/notes/scripts/check_prohibited_names/2026-10-05-diff-header-byte-boundary.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Diff metadata and source decoding boundaries
+
+## Status
+
+Proposed maintainer repair for the reproduced PR #351 check failure.
+
+## Context
+
+The naming checker must scan added source and pending commit messages, including
+text added and later removed. It decoded an entire Git diff as UTF-8 before
+finding source lines.
+
+## Evidence
+
+Git 2.55.0 emitted a combined hunk title ending in bytes `e8 b0`, cutting the final
+codepoint of a Chinese context label. Both document revisions are valid UTF-8.
+The failing input is reproducible with `git show --format= --cc --no-ext-diff
+--unified=0 78b20d2c -- docs/runtime-control-api.md`. The title is metadata, not an
+added source line; decoding it rejected a legitimate edit before scanning it.
+
+## Decision
+
+Read physical diff lines and ASCII hunk/addition prefixes as bytes. Decode only
+the added source payload, still using strict UTF-8. Staged and commit scans share
+that implementation. File headers are recognized by their pre-hunk position,
+so added source beginning with multiple plus signs remains subject to checking.
+
+## Rejected alternatives
+
+- Replacement decoding would hide invalid added source bytes.
+- Ignoring files, commits or the failing check would weaken the actual policy.
+- Editing legitimate document text merely to change Git's context truncation
+  would conceal the parser defect.
+
+## Consequences
+
+Patterns, exemptions, commit-message/path decoding and whole-history scope are
+unchanged. Malformed added UTF-8 still fails. There is no product runtime change.
+
+## Validation
+
+Focused regressions cover regular and combined truncated headers, prohibited
+source after those headers, plus-prefixed source and invalid added bytes. Run the
+existing naming-check suite and the original failing range before integration.
+
+## Supersedes
+
+None; repairs metadata parsing without changing the naming policy.
+
+## Revisit when
+
+Git's diff output format or the checker's source selection changes.
```

**File**: `docs/runtime-control-api.md` (modified, +4/-2)
```diff
@@ -297,8 +297,10 @@ managed generation 改变时，旧回调直接丢弃，不会寻找替代 pane
 
 `pane.exec` 与 `pane.run` 是两种刻意分开的执行语义：它直接接收 argv，不经过 shell 展开，
 在 Pane 当前上报的本地 cwd 中启动独立 non-TTY child，不写入 Grid、history 或交互 shell
-环境。WSL Pane 通过对应 distribution 和 guest cwd 执行；SSH Pane 返回
-`remote_exec_unsupported`。stdout/stderr 始终并行排水，每条默认最多保留 1 MiB、可配置上限
+环境。WSL Pane 通过对应 distribution 和 guest cwd 执行；argv 通过 `--exec` 保留原生参数边界，
+包括参数内部的双引号。当前启动目录模型不接收含 `"` 的 guest cwd，此时返回
+`exec_argument_unsupported`（`details.argument` 为该目录），不会改写后执行。
+SSH Pane 返回 `remote_exec_unsupported`。stdout/stderr 始终并行排水，每条默认最多保留 1 MiB、可配置上限
 16 MiB；响应的 `stdout`/`stderr` 是直接字符串，`capture` 分别报告 encoding、总字节数、保留
 字节数和截断状态。超时会回收整个子进程树，并保留已捕获输出与 `timed_out: true`。
 
```

**File**: `nebula_app/AGENTS.md` (modified, +1/-0)
```diff
@@ -12,5 +12,6 @@
 - 补齐数据源选择和请求快照归 `completion.rs`，界面仅拥有任务与交互；边界依据见 [`completion`](../architecture/notes/nebula_app/completion/)。
 - 旧渲染入口的窗口动画状态归 `display/animations.rs`；迁移及显式 legacy 验证依据见 [`display`](../architecture/notes/nebula_app/display/)。
 - 新终端代理保持选定协议，不把 SOCKS 改写成 HTTP。见 [`terminal proxy scheme`](../architecture/notes/nebula_app/ssh_proxy/2026-09-29-terminal-proxy-scheme.md)。
+- WSL pane 的发行版快照与分屏/新标签继承见 [`shell_detect`](../architecture/notes/nebula_app/shell_detect/)。
 - Windows Acrylic 的运行库回退与窗口生命周期见 [`platform`](../architecture/notes/nebula_app/platform/2026-09-22-acrylic-controller.md)。
 - Windows Acrylic 的动画期间透明回退与计时边界见 [`窗口状态切换`](../architecture/notes/nebula_app/platform/2026-09-22-acrylic-window-transitions.md)。
```

**File**: `nebula_app/src/completion_context.rs` (modified, +4/-7)
```diff
@@ -209,15 +209,12 @@ fn typed_environment(parent: &SuggestEnv, words: &[String], wsl: bool) -> Sugges
 }
 
 pub(crate) fn launch_environment(program: &str, args: &[String]) -> SuggestEnv {
+    if crate::shell_detect::is_wsl_launcher(program) {
+        let distro = crate::shell_detect::wsl_spawn_distro(program, args).unwrap_or_default();
+        return SuggestEnv::Wsl { distro };
+    }
     let program_name = program.rsplit(['/', '\\']).next().unwrap_or(program);
     match crate::display::extract_program(program_name).as_deref() {
-        Some("wsl") => {
-            let distro = crate::shell_detect::wsl_launch_distro(program, args)
-                .map(str::to_owned)
-                .or_else(crate::platform::shell::default_wsl_distro)
-                .unwrap_or_default();
-            SuggestEnv::Wsl { distro }
-        },
         Some("ssh") => {
             let words: Vec<_> =
                 std::iter::once(program.to_owned()).chain(args.iter().cloned()).collect();
```

**File**: `nebula_app/src/display/side_panel/enumerate.rs` (modified, +8/-19)
```diff
@@ -116,8 +116,8 @@ pub(crate) fn run_wsl_find_lenient(
     distro: &str,
     args: impl IntoIterator<Item = OsString>,
 ) -> Option<(Vec<u8>, bool)> {
-    let mut command = std::process::Command::new("wsl.exe");
-    command.args(["-d", distro, "--", "find"]).args(args);
+    let mut command = crate::shell_detect::wsl_exec_command(distro);
+    command.arg("find").args(args);
     crate::platform::process::hidden_command(&mut command);
     let output = match command_output_with_timeout(command, Some(WSL_COMMAND_TIMEOUT)) {
         Ok(output) => output,
@@ -143,24 +143,13 @@ pub(crate) fn run_wsl_find(
     exit_ok.then_some(stdout)
 }
 
-/// `find -printf` 的格式串：类型 + NUL + 全路径 + NUL。**反斜杠必须写两遍**。
+/// `find -printf` 的格式串：类型 + NUL + 全路径 + NUL。
 ///
-/// 2026-08-21 实测：`wsl.exe -d <发行版> -- <命令>` 在把参数转发给来宾时会吞掉
-/// 一层反斜杠。同一条 find、同一个目录，三种写法的输出对照：
-///
-/// | 传入 | NUL 个数 | 输出开头 |
-/// |---|---|---|
-/// | `%y\0%f\0`   | **0**  | `l0lib0d0opt0…` |
-/// | `%y\\0%f\\0` | 54     | `l\0lib\0d\0opt\0…` |
-/// | `sh -c` 包一层 | 54   | `l\0lib\0d\0opt\0…` |
-///
-/// 也就是说单反斜杠版本让 find 收到的是 `%y0%f0`，输出用字面字符 `'0'` 分隔、
-/// 一个 NUL 都没有，[`parse_wsl_find_pairs`] 因此永远配不出记录、返回空列表——
-/// UI 再把空列表显示成"此目录为空"。这就是 WSL 文件树空白的根因。
-///
-/// 用双反斜杠而不是 `sh -c` 包装：后者要为含空格/引号的来宾路径再做一层 shell
-/// 引用，而这里只需要把转义层数补对。
-pub(crate) const WSL_FIND_PATH_FORMAT: &str = r"%y\\0%p\\0";
+/// 单反斜杠：[`crate::shell_detect::wsl_exec_command`] 直接 exec `find`，不经
+/// 来宾 shell（`search/walk.rs` 同理）。旧的 `wsl.exe -d <发行版> -- find` 会让
+/// 来宾 shell 解释路径里的 `$(…)`，还会吞掉一层反斜杠（2026-08-21 实测单反斜杠
+/// 版本一个 NUL 都输出不了，文件树因此全空），所以当时写两遍；那条路已弃用。
+pub(crate) const WSL_FIND_PATH_FORMAT: &str = r"%y\0%p\0";
 
 /// 一趟 `find` 的结果，按父目录分桶。
 pub(crate) struct WslDirListing {
```

**File**: `nebula_app/src/display/side_panel/vcs.rs` (modified, +3/-5)
```diff
@@ -320,7 +320,7 @@ impl SidePanel {
             let mut guest_args: Vec<OsString> = [
                 "-d",
                 located.distro.as_str(),
-                "--",
+                "--exec",
                 "git",
                 "-C",
                 located.guest.as_str(),
@@ -824,12 +824,10 @@ pub(crate) fn read_git(root: &Path) -> Option<GitInfo> {
 /// 代价是每次快照多一次 `wsl.exe` 进程往返（发行版没运行时还会把它拉起
 /// 来）。快照本来就在后台线程上、且有节流，不进渲染路径。
 pub(crate) fn read_git_wsl(located: &crate::shell_detect::WslCwd) -> Option<GitInfo> {
-    use std::process::Command;
     let location = format!("{}:{}", located.distro, located.guest);
     collect_git_info(|args| {
-        let mut cmd = Command::new("wsl.exe");
-        cmd.args(["-d", &located.distro, "--", "git", "-C", &located.guest, "--no-optional-locks"])
-            .args(args);
+        let mut cmd = crate::shell_detect::wsl_exec_command(&located.distro);
+        cmd.args(["git", "-C", &located.guest, "--no-optional-locks"]).args(args);
         run_git(cmd, args, &location, Some(WSL_COMMAND_TIMEOUT))
     })
 }
```

**File**: `nebula_app/src/gpui_shell/code_tab.rs` (modified, +6/-6)
```diff
@@ -654,9 +654,9 @@ fn read_worktree_file(key: &MergeKey) -> Result<Vec<u8>, String> {
         },
         GitLocation::Wsl { distro, root } => {
             let path = join_guest_path(root, &key.relative_path);
-            let mut command = Command::new("wsl.exe");
+            let mut command = crate::shell_detect::wsl_exec_command(distro);
             let output = crate::platform::process::hidden_command(&mut command)
-                .args(["-d", distro, "--", "cat", "--", path.as_str()])
+                .args(["cat", "--", path.as_str()])
                 .output()
                 .map_err(|error| format!("无法从 WSL 读取冲突文件: {error}"))?;
             if output.status.success() { Ok(output.stdout) } else { Ok(Vec::new()) }
@@ -676,9 +676,9 @@ fn write_conflict_result(key: &MergeKey, result: String) -> Result<(), String> {
         },
         GitLocation::Wsl { distro, root } => {
             let path = join_guest_path(root, &key.relative_path);
-            let mut command = Command::new("wsl.exe");
+            let mut command = crate::shell_detect::wsl_exec_command(distro);
             let mut child = crate::platform::process::hidden_command(&mut command)
-                .args(["-d", distro, "--", "sh", "-c", "cat > \"$1\"", "nebula", path.as_str()])
+                .args(["tee", "--", path.as_str()])
                 .stdin(Stdio::piped())
                 .stdout(Stdio::null())
                 .stderr(Stdio::piped())
@@ -720,8 +720,8 @@ fn git_command(location: &GitLocation, args: &[&str]) -> Result<std::process::Ou
             command
         },
         GitLocation::Wsl { distro, root } => {
-            let mut command = Command::new("wsl.exe");
-            command.args(["-d", distro, "--", "git", "-C", root, "--no-optional-locks"]);
+            let mut command = crate::shell_detect::wsl_exec_command(distro);
+            command.args(["git", "-C", root, "--no-optional-locks"]);
             command
         },
     };
```

---

### Incident Patch 9: `44ef63b0` (2026-10-05)
**Commit Message**: test(workspace): use a neutral startup directory fixture

**File**: `nebula_app/src/gpui_shell/workspace/session_recovery.rs` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ mod cold_start_tests {
     #[test]
     fn configured_startup_directory_wins_over_the_launch_directory() {
         let home = PathBuf::from("C:/Users/fixture");
-        let configured = PathBuf::from("C:/Users/fixture/.claude");
+        let configured = PathBuf::from("C:/Users/fixture/workspace");
         assert_eq!(cold_start_cwd(Some(configured.clone()), Some(home)), Some(configured));
     }
 
```

---

### Incident Patch 10: `4a627fad` (2026-10-05)
**Commit Message**: fix(terminal): keep emoji state inline and isolate continuation cost

**File**: `architecture/notes/nebula_terminal/term/2026-10-03-emoji-input-clusters.md` (modified, +3/-0)
```diff
@@ -3,6 +3,9 @@
 ## Status
 Proposed production fix for Issue #403; remote core evidence recorded below.
 
+Superseded by [the state-cost revision](2026-10-05-emoji-input-state-cost.md)
+for boxed-state ownership and local performance evidence only.
+
 ## Context
 Single-codepoint input width splits ZWJ, modifier and regional-indicator emoji.
 The report supplies seven exact sequences and contrasts single-codepoint emoji.
```

**File**: `architecture/notes/nebula_terminal/term/2026-10-05-emoji-input-state-cost.md` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+# Emoji input state ownership and ordinary-text cost
+
+## Status
+Maintainer revision for PR #451; final-head CI and native glyph acceptance remain separate.
+
+## Context
+The streaming cluster fix preserves complete emoji cells, but boxing the pending
+segmenter allocates once per new cluster. Taking an inline segmenter on every
+continuation would instead move its entire state per codepoint. Ordinary input
+must not inherit large emoji-only stack temporaries.
+
+## Evidence
+Local Windows x86_64 release probes compare main `b6e7b78d`, the original PR
+integrated at `8c770233`, and the revised implementation in `term/input.rs`.
+Later main application changes through `57c7bfdb` do not change this core.
+The probe uses 120 x 40 cells, 1,000 history lines, four warm-up feeds, thin LTO
+and one codegen unit. Timings use the default System allocator; allocation counts
+come from a separate instrumented build and are not timing evidence.
+Nine rounds rotate variant order on CPU affinity mask `0x1`.
+
+Median ns per input character, including parser control bytes for VT workloads:
+
+| Workload | Main | Original PR | Revision |
+| --- | ---: | ---: | ---: |
+| ASCII input | 15.625 | 14.992 | 15.088 |
+| BMP CJK input | 28.323 | 29.087 | 27.935 |
+| ASCII VT | 15.028 | 16.763 | 14.670 |
+| ANSI VT | 12.790 | 11.764 | 11.946 |
+| Reported emoji input | 57.976 | 215.737 | 198.931 |
+| Long combining input | 79.558 | 79.317 | 78.869 |
+
+The emoji workload repeats seven reported sequences 512 times per feed, for 24
+measured feeds. Allocations fall from 467,625 to 381,609 (86,016 fewer, about 18.4%).
+The ASCII, CJK and VT workloads allocate zero times during steady-state input.
+`size_of::<Term<VoidListener>>()` is 1,848 / 1,880 / 2,008 bytes respectively:
+the revision trades 128 fixed bytes per terminal against repeated heap allocation.
+The ordinary-input function's `sub rsp` reservation is `0x68` / `0x168` / `0x58`;
+these figures exclude pushed registers and are not total thread stack usage.
+
+Scheduling spread is substantial. These observations support the bounded
+ownership change, not a universal throughput guarantee or total RSS reduction.
+Main renders these emoji incorrectly, so its emoji timing is not equal-work
+correctness evidence. Probe sources and raw results remain local diagnostic data.
+
+## Decision
+Store `Option<EmojiInput>` inline and update an active segmenter in place. Only
+width migration temporarily takes ownership because wrapping and cell edits
+invalidate input continuity through the existing reset authority. Keep the exact
+cursor and pending-wrap endpoint checks rather than introducing a second policy.
+
+Keep the cheap negative BMP continuation check in `input_character`, and mark
+`extend_emoji_input` non-inlinable so initialization and width migration temporaries
+do not enlarge the ordinary-text frame. Reuse existing character placement for
+ASCII, CJK, insert mode, mapped characters and wrapping.
+
+## Rejected alternatives
+- Per-cluster boxing retains avoidable allocation on emoji-heavy output.
+- Taking the full inline state on every codepoint trades allocation for copying.
+- An ASCII-specific placement branch duplicates established VT behavior without
+  stable measured benefit; it is not retained.
+- Replacing the endpoint with a continuity boolean or conditionally recording it
+  weakens the existing check or adds branches without stable measured benefit.
+- Allocation-instrumented timing perturbs allocation-heavy workloads and is not
+  used as the final throughput comparison.
+
+## Consequences
+Each terminal has a small fixed size increase; cell size and persistence formats
+are unchanged. Emoji cell tails and requested lookbehind context still allocate
+when necessary. No new dependency, thread, cache or background task is introduced.
+Compiler and Unicode upgrades can change both layout and the negative fast path.
+
+## Validation
+The revision passes 90 terminal-module tests, 45 reference-replay tests and 16
+redraw-anchor tests, plus formatting, architecture and diff checks. Added cases
+cover ASCII following an emoji, keycaps, mapped characters, insert/wrap behavior
+and invalidation by cursor/grid edits. Existing chunking, copy, snapshot, selectors,
+width promotion/shrink, reflow and long-mark regressions remain enabled.
+
+An earlier complete local core run had three environment-dependent failures:
+two missing-shell executable cases and one WSL-selected input fixture also
+reproduced on main. They were not counted as passes or repaired by unrelated edits.
+These checks do not establish real-window font coverage or end-to-end latency.
+
+## Supersedes
+The boxed-state ownership and cost discussion in
+[the original cluster decision](2026-10-03-emoji-input-clusters.md).
+Its segmentation, cell-width and continuity contracts remain in effect.
+
+## Revisit when
+Unicode or compiler versions change, representative production traces show an
+
```

**File**: `nebula_terminal/src/term/emoji_input_tests.rs` (modified, +72/-3)
```diff
@@ -58,6 +58,47 @@ fn reported_emoji_are_one_wide_cell_across_utf8_chunks_copy_and_snapshot() {
     }
 }
 
+#[test]
+fn ordinary_ascii_ends_emoji_clusters_while_keycaps_still_compose() {
+    for c in ' '..='~' {
+        let mut term = terminal(80);
+        feed(&mut term, "👨‍👩", 1);
+        term.input(c);
+        assert!(term.input_cluster.is_none());
+        assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), "👨‍👩");
+        assert_eq!(term.grid[Line(0)][Column(2)].c, c);
+    }
+    for c in ['#', '*', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] {
+        let mut term = terminal(80);
+        let keycap = format!("{c}\u{fe0f}\u{20e3}");
+        feed(&mut term, &keycap, 1);
+        assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), keycap);
+        assert_eq!(term.grid.cursor.point.column, Column(2));
+    }
+}
+
+#[test]
+fn ordinary_input_preserves_insert_wrap_and_mapped_characters() {
+    let mut term = terminal(4);
+    feed(&mut term, "ABCDX", 1);
+    assert_eq!(term.grid[Line(1)][Column(0)].c, 'X');
+    assert!(term.grid[Line(0)][Column(3)].flags.contains(Flags::WRAPLINE));
+    feed(&mut term, "\x1b[1;2H\x1b[4hZ", 1);
+    let row: String = (0..4).map(|column| term.grid[Line(0)][Column(column)].c).collect();
+    assert_eq!(row, "AZBC");
+
+    for c in ' '..='~' {
+        if c.is_emoji_char() {
+            continue;
+        }
+        let mut term = terminal(4);
+        feed(&mut term, "\x1b(0", 1);
+        term.input(c);
+        assert!(!term.grid[Line(0)][Column(0)].c.is_emoji_char());
+        assert_eq!(term.grid.cursor.point.column, Column(1));
+    }
+}
+
 #[test]
 fn emoji_continuity_survives_sgr_sync_and_noop_resize_but_not_cursor_or_grid_edits() {
     let mut term = terminal(80);
@@ -73,9 +114,33 @@ fn emoji_continuity_survives_sgr_sync_and_noop_resize_but_not_cursor_or_grid_edi
     term.input('🏽');
     assert_eq!(cell_text(&term.grid[Line(0)][Column(0)]), "👍🏽");
 
-    for control in
-        ["\x1b[3G", "\x1b[1D\x1b[1C", "\x1b[0K", "\x1b#8", "\x1b[1L", "\x1b[1M", "\x1b[1I\x1b[1Z"]
-    {
+    for control in [
+        "\x1b[3G",
+        "\x1b[1D\x1b[1C",
+        "\x1b[0K",
+        "\x1b#8",
+        "\x1b[1L",
+        "\x1b[1M",
+        "\x1b[1I\x1b[1Z",
+        "\x1b[1A",
+        "\x1b[1B",
+        "\x1b[1P",
+        "\x1b[1@",
+        "\x1b[1X",
+        "\x1b[1S",
+        "\x1b[1T",
+        "\x08",
+        "\r",
+        "\n",
+        "\t",
+        "\x1bM",
+        "\x1b7\x1b8",
+        "\x1b[2J",
+        "\x1bc",
+        "\x1b[?1049h\x1b[?1049l",
+        "\x1b[4h\x1b[4l",
+        "\x1b[2;4r",
+    ] {
         let mut term = terminal(80);
         feed(&mut term, "👍", 1);
         feed(&mut term, control, 1);
@@ -93,6 +158,10 @@ fn emoji_continuity_survives_sgr_sync_and_noop_resize_but_not_cursor_or_grid_edi
     term.input('👍');
     term.swap_alt();
     assert!(term.input_cluster.is_none());
+    let mut term = terminal(80);
+    term.input('👍');
+    let _ = term.grid_mut();
+    assert!(term.input_end.is_none(), "raw grid access invalidates the pending head");
 }
 
 #[test]
```

**File**: `nebula_terminal/src/term/input.rs` (modified, +20/-19)
```diff
@@ -98,7 +98,10 @@ impl<T: EventListener> Term<T> {
             None => return,
         };
 
-        if !c.is_ascii() && self.extend_emoji_input(c, width) {
+        if !c.is_ascii()
+            && (self.input_cluster.is_some() || width == 0 || c > '\u{ffff}')
+            && self.extend_emoji_input(c, width)
+        {
             return;
         }
         self.reset_input_cluster();
@@ -178,13 +181,9 @@ impl<T: EventListener> Term<T> {
         self.input_end = Some((self.grid.cursor.point, self.grid.cursor.input_needs_wrap));
     }
 
+    // 分段器初始化和宽度迁移需要大临时状态；禁止内联以免扩大普通字符的栈帧。
+    #[inline(never)]
     fn extend_emoji_input(&mut self, c: char, char_width: usize) -> bool {
-        // Without a preceding zero-width continuation, Unicode 17's positive
-        // emoji extensions are supplementary-plane modifiers or RI symbols.
-        // The locked-data regression checks every BMP successor against all bases.
-        if self.input_cluster.is_none() && char_width > 0 && c <= '\u{ffff}' {
-            return false;
-        }
         let Some((next, wrap)) = self.input_end else { return false };
         if next != self.grid.cursor.point || wrap != self.grid.cursor.input_needs_wrap {
             return false;
@@ -197,12 +196,12 @@ impl<T: EventListener> Term<T> {
             point.column.0 = point.column.saturating_sub(1);
         }
         let cell = &self.grid[point];
-        let mut cluster = if let Some(cluster) = self.input_cluster.take() {
-            cluster
-        } else {
-            let Some(cluster) = EmojiInput::new(cell.c) else { return false };
-            Box::new(cluster)
-        };
+        // 每个 pane 只有一份分段状态，原地更新，避免逐 emoji 分配 Box，
+        // 也避免在每个码点上搬动整个 GraphemeCursor。
+        if self.input_cluster.is_none() {
+            self.input_cluster = EmojiInput::new(cell.c);
+        }
+        let Some(cluster) = self.input_cluster.as_mut() else { return false };
         let old_width = if cell.flags.contains(Flags::WIDE_CHAR) { 2 } else { 1 };
         let width = if char_width > 0 {
             if !c.is_emoji_char() {
@@ -228,18 +227,20 @@ impl<T: EventListener> Term<T> {
         if !cluster.continues(c, cell) {
             return false;
         }
-        self.grid[point].push_zerowidth(c);
-        if width != old_width {
-            self.resize_emoji_cell(&mut point, width);
-        }
-        self.damage.damage_point(Point::new(point.line.0 as usize, point.column));
         if char_width > 0 {
             cluster.graphic = c;
             cluster.joined = true;
         }
         cluster.last = c;
+        self.grid[point].push_zerowidth(c);
+        if width != old_width {
+            // 换行/插删格会统一清除连续输入状态；仅在这条冷路径暂存它。
+            let cluster = self.input_cluster.take();
+            self.resize_emoji_cell(&mut point, width);
+            self.input_cluster = cluster;
+        }
+        self.damage.damage_point(Point::new(point.line.0 as usize, point.column));
         self.input_end = Some((self.grid.cursor.point, self.grid.cursor.input_needs_wrap));
-        self.input_cluster = Some(cluster);
         true
     }
 
```

**File**: `nebula_terminal/src/term/mod.rs` (modified, +1/-1)
```diff
@@ -161,7 +161,7 @@ pub fn viewport_to_point_from(origin: Line, point: Point<usize>) -> Point {
 
 pub struct Term<T> {
     redraw_anchor: redraw_anchor::RedrawAnchor,
-    input_cluster: Option<Box<input::EmojiInput>>,
+    input_cluster: Option<input::EmojiInput>,
     input_end: Option<(Point, bool)>,
     /// Terminal focus controlling the cursor shape.
     pub is_focused: bool,
```

---

### Incident Patch 11: `f14aecc5` (2026-10-05)
**Commit Message**: fix(checks): decode added source independently of diff metadata

**File**: `architecture/notes/scripts/check_prohibited_names/2026-10-05-diff-header-byte-boundary.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Diff metadata and source decoding boundaries
+
+## Status
+
+Proposed maintainer repair for the reproduced PR #351 check failure.
+
+## Context
+
+The naming checker must scan added source and pending commit messages, including
+text added and later removed. It decoded an entire Git diff as UTF-8 before
+finding source lines.
+
+## Evidence
+
+Git 2.55.0 emitted a combined hunk title ending in bytes `e8 b0`, cutting the final
+codepoint of a Chinese context label. Both document revisions are valid UTF-8.
+The failing input is reproducible with `git show --format= --cc --no-ext-diff
+--unified=0 78b20d2c -- docs/runtime-control-api.md`. The title is metadata, not an
+added source line; decoding it rejected a legitimate edit before scanning it.
+
+## Decision
+
+Read physical diff lines and ASCII hunk/addition prefixes as bytes. Decode only
+the added source payload, still using strict UTF-8. Staged and commit scans share
+that implementation. File headers are recognized by their pre-hunk position,
+so added source beginning with multiple plus signs remains subject to checking.
+
+## Rejected alternatives
+
+- Replacement decoding would hide invalid added source bytes.
+- Ignoring files, commits or the failing check would weaken the actual policy.
+- Editing legitimate document text merely to change Git's context truncation
+  would conceal the parser defect.
+
+## Consequences
+
+Patterns, exemptions, commit-message/path decoding and whole-history scope are
+unchanged. Malformed added UTF-8 still fails. There is no product runtime change.
+
+## Validation
+
+Focused regressions cover regular and combined truncated headers, prohibited
+source after those headers, plus-prefixed source and invalid added bytes. Run the
+existing naming-check suite and the original failing range before integration.
+
+## Supersedes
+
+None; repairs metadata parsing without changing the naming policy.
+
+## Revisit when
+
+Git's diff output format or the checker's source selection changes.
```

**File**: `scripts/check_prohibited_names.py` (modified, +13/-15)
```diff
@@ -193,9 +193,7 @@ def changed_paths(*revision_args: str) -> list[str]:
 
 def added_lines(path: str, *revision_args: str) -> Iterable[tuple[int, str]]:
     patch = git("diff", *revision_args, "--no-ext-diff", "--unified=0", "--", path)
-    for line_no, raw_line in enumerate(patch.decode("utf-8").splitlines(), 1):
-        if raw_line.startswith("+") and not raw_line.startswith("+++"):
-            yield line_no, raw_line[1:]
+    yield from added_patch_lines(patch, None)
 
 
 def scan_added_lines(*revision_args: str) -> list[str]:
@@ -211,22 +209,22 @@ def scan_added_lines(*revision_args: str) -> list[str]:
 
 
 def added_patch_lines(patch: bytes, merge_parent_count: int | None) -> Iterable[tuple[int, str]]:
-    lines = patch.decode("utf-8").splitlines()
-    if merge_parent_count is None:
-        for line_no, raw_line in enumerate(lines, 1):
-            if raw_line.startswith("+") and not raw_line.startswith("+++"):
-                yield line_no, raw_line[1:]
-        return
-
+    # Git 的 hunk 标题可在 UTF-8 码点中间截断；它不是新增源码。
+    # 先按物理行识别 ASCII 差异前缀，仅对真正新增的内容严格解码。
     in_hunk = False
-    prefix = "+" * merge_parent_count
-    for line_no, raw_line in enumerate(lines, 1):
-        if raw_line.startswith("@@@"):
+    parents = merge_parent_count if merge_parent_count is not None else 1
+    prefix = b"+" * parents
+    for line_no, raw_line in enumerate(patch.split(b"\n"), 1):
+        raw_line = raw_line.removesuffix(b"\r")
+        if raw_line.startswith(b"diff --"):
+            in_hunk = False
+            continue
+        if raw_line.startswith(b"@@"):
             in_hunk = True
             continue
-        # Combined diff headers (including `+++ `) occur before the hunk.
+        # 文件标题在 hunk 之前；正文里的多个 '+' 仍是需要检查的源码。
         if in_hunk and raw_line.startswith(prefix):
-            yield line_no, raw_line[merge_parent_count:]
+            yield line_no, raw_line[parents:].decode("utf-8")
 
 
 def scan_pending_commits(revision_range: str) -> list[str]:
```

**File**: `scripts/tests/test_prohibited_names.py` (modified, +20/-0)
```diff
@@ -6,6 +6,7 @@
 import tempfile
 import unittest
 from pathlib import Path
+from unittest.mock import patch
 
 from scripts import check_prohibited_names
 
@@ -20,6 +21,25 @@ def run_git(repository: Path, *args: str) -> None:
 
 
 class ProhibitedNamesTests(unittest.TestCase):
+    def test_truncated_unicode_hunk_context_preserves_added_source_checks(self) -> None:
+        context = "managed generation 改变时，旧回调".encode("utf-8")[:-1]
+        for parents, header, prefix in ((None, b"@@ -1 +1 @@ ", b"+"), (2, b"@@@ -1 -1 +1 @@@ ", b"++")):
+            with self.subTest(parents=parents):
+                diff = b"+++ b/source.rs\n" + header + context + b"\n" + prefix + b"safe\n" + prefix + b"++Ghostty\n"
+                lines = list(check_prohibited_names.added_patch_lines(diff, parents))
+                self.assertEqual(lines, [(3, "safe"), (4, "++Ghostty")])
+                self.assertTrue(check_prohibited_names.prohibited_source_line("source.rs", lines[1][1]))
+                if parents is None:
+                    with patch.object(check_prohibited_names, "git", return_value=diff):
+                        self.assertEqual(list(check_prohibited_names.added_lines("source.rs", "--cached")), lines)
+
+    def test_invalid_added_utf8_is_not_hidden_by_a_truncated_hunk_header(self) -> None:
+        for parents, prefix in ((None, b"+"), (2, b"++")):
+            with self.subTest(parents=parents):
+                diff = b"@@@ context \xe8\xb0\n" + prefix + b"bad \xff\n"
+                with self.assertRaises(UnicodeDecodeError):
+                    list(check_prohibited_names.added_patch_lines(diff, parents))
+
     def check_staged(self, repository: Path):
         return subprocess.run(
             [sys.executable, str(CHECKER), "staged"], cwd=repository,
```

---

### Incident Patch 12: `6f70552a` (2026-10-05)
**Commit Message**: fix(workspace): honour the startup directory on cold start

When no tab is restored (empty session, restore disabled, missing
session, tripped boot breaker or failed post-update restore), the first
terminal used the process working directory. The login-autostart
shortcut sets that to %USERPROFILE%, so the configured startup directory
was ignored on every boot while Ctrl+T tabs honoured it.

Prefer the startup directory for both cold-start fallbacks, falling back
to the launch directory when it is unset or invalid.

Fixes #479

**File**: `nebula_app/src/gpui_shell/workspace.rs` (modified, +2/-2)
```diff
@@ -1013,15 +1013,15 @@ impl NebulaWorkspace {
         match startup {
             windowing::WorkspaceStartup::RestoreUpdate(session) => {
                 if !this.restore_update_session(&session, runtime.resume_ai, window, cx) {
-                    this.add_terminal_at(std::env::current_dir().ok(), None, window, cx);
+                    this.add_terminal_at(Self::cold_start_cwd(), None, window, cx);
                 }
             },
             windowing::WorkspaceStartup::RestoreOrDefault => {
                 // 只有首窗恢复全局 session，避免每个新窗口重复回放同一批 PTY。
                 if !runtime.restore_session
                     || !this.try_restore_session(runtime.resume_ai, window, cx)
                 {
-                    this.add_terminal_at(std::env::current_dir().ok(), None, window, cx);
+                    this.add_terminal_at(Self::cold_start_cwd(), None, window, cx);
                 }
             },
             windowing::WorkspaceStartup::NewTerminal { cwd } => {
```

**File**: `nebula_app/src/gpui_shell/workspace/session_recovery.rs` (modified, +35/-0)
```diff
@@ -3,6 +3,12 @@
 use super::*;
 
 impl NebulaWorkspace {
+    /// 冷启动回退（没有恢复出任何标签）时首个终端的 cwd：与 `add_terminal`
+    /// 同一合同，设置页「启动目录」优先，未设置或失效时才继承进程启动目录。
+    pub(super) fn cold_start_cwd() -> Option<std::path::PathBuf> {
+        cold_start_cwd(Self::startup_directory(), std::env::current_dir().ok())
+    }
+
     pub(super) fn restore_update_session(
         &mut self,
         session: &crate::session::Session,
@@ -244,3 +250,32 @@ impl NebulaWorkspace {
         Session::new(active_out, tabs)
     }
 }
+
+/// 开机自启动快捷方式把进程启动目录固定为 `%USERPROFILE%`；只看进程 cwd
+/// 会让首个终端无视「启动目录」，与 Ctrl+T 新标签不一致（#479）。
+fn cold_start_cwd(
+    startup_directory: Option<std::path::PathBuf>,
+    launch_cwd: Option<std::path::PathBuf>,
+) -> Option<std::path::PathBuf> {
+    startup_directory.or(launch_cwd)
+}
+
+#[cfg(test)]
+mod cold_start_tests {
+    use super::cold_start_cwd;
+    use std::path::PathBuf;
+
+    #[test]
+    fn configured_startup_directory_wins_over_the_launch_directory() {
+        let home = PathBuf::from("C:/Users/fixture");
+        let configured = PathBuf::from("C:/Users/fixture/.claude");
+        assert_eq!(cold_start_cwd(Some(configured.clone()), Some(home)), Some(configured));
+    }
+
+    #[test]
+    fn unset_startup_directory_keeps_inheriting_the_launch_directory() {
+        let home = PathBuf::from("C:/Users/fixture");
+        assert_eq!(cold_start_cwd(None, Some(home.clone())), Some(home));
+        assert_eq!(cold_start_cwd(None, None), None);
+    }
+}
```

---

### Incident Patch 13: `f3bbb03a` (2026-10-05)
**Commit Message**: Merge branch 'main' into codex/issue-398-fixed-theme-preview

**File**: `architecture/notes/nebula_app/gpui_shell/workspace/2026-10-03-empty-workspace-residency.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Empty workspace residency
+
+## Status
+
+Proposed in the PR for #428.
+
+## Context
+
+Closing a tab means releasing its panes. With `keep_session` enabled, closing
+that final tab should not also terminate the discoverable desktop process.
+
+## Evidence
+
+`finish_close_tab` and `close_settings` previously sent an empty workspace directly
+to `close_empty_workspace_window`, which unregisters and removes the window.
+The residency policy required live terminal panes. Separately,
+`SessionPersistence::save_with` ignores empty checkpoints to protect saved
+sessions; using a checkpoint after explicitly closing all tabs would retain the
+old saved tabs.
+
+## Decision
+
+Route user tab/settings closure through the existing residency capability.
+Ordinary empty workspaces may remain hidden when `keep_session` and the platform
+visibility capability permit it. Preserve administrator isolation and the quick
+terminal role boundary. Persist an empty workspace with `TabsClosed` before
+hiding; keep the checkpoint reason for live workspaces.
+
+Retain the empty window in the existing registry. Tray activation and mux attach
+reveal it, and its existing plus controls and Ctrl+Shift+T create a fresh terminal.
+Closing panes still sends shutdown and clears their registry/browser/bounds state.
+
+## Rejected alternatives
+
+- Creating a replacement terminal while hiding: starts a process the user did
+  not request and undermines closing the final terminal.
+- Persisting an empty checkpoint: may restore explicitly closed tabs.
+- A second process-residency framework or a new setting: existing discovery,
+  visibility and `keep_session` already own these responsibilities.
+
+## Consequences
+
+Explicit runtime window closure and empty sources after tab transfer still remove
+the window. A failed durable save leaves the empty window visible with the
+existing error feedback. A platform hide failure falls back to ordinary closure.
+
+## Validation
+
+The residency regression checks empty-workspace eligibility with retention on/off
+and tray on/off. Existing persistence coverage verifies that `TabsClosed` clears
+saved tabs through subsequent quit. GitHub Actions results are pending; native
+tray/launcher visibility and shell release require platform acceptance.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The desktop registry or resident discovery lifecycle no longer owns hidden windows.
```

**File**: `architecture/notes/nebula_app/ssh_session/2026-09-26-pane-local-forwarding.md` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# Pane-owned local SSH forwarding
+
+## Status
+
+Reviewed for integration on 2026-09-26.
+
+## Context
+
+An authenticated native SSH pane needs a small local forwarding control. Opening
+another SSH process would duplicate authentication and connection ownership.
+A listener must not survive its pane, including normal shell exit, and a pending
+creation must not finish after the owner has closed.
+
+## Evidence
+
+- `ssh_session/forward.rs` reuses authenticated pooled sessions and opens
+  direct-tcpip channels through the existing SSH runtime.
+- The original change cleared established forwards on failure but not normal
+  exit; its detached creation task outlived the pane.
+- An unrestricted accept loop could create arbitrary numbers of channel tasks
+  and bidirectional copy buffers from local clients.
+- The legacy dialog child scroller clipped the port controls: the real-click
+  regression left the port value unchanged after typing. The form now uses
+  `DialogContent`, with explicit input geometry and read-back assertions.
+- The original screenshot-only readiness override read the process environment
+  from a render-time query and bypassed real SSH readiness in test builds.
+
+## Decision
+
+Keep listeners in the terminal view and the pending GPUI operation in an owned
+Task. Exit, connection failure and view destruction release both. The existing
+network-to-GPUI bridge cancels its future when the result receiver is dropped;
+a stale completion cannot install a forward or show a toast for a dead pane.
+
+Each listener accepts at most 64 concurrent channel tasks. Excess clients wait
+in the OS TCP backlog until a slot is available. This bounds task/copy-buffer
+cost per listener; it is an engineering limit, not a throughput guarantee.
+Completed channels are reaped and failures are logged without killing the SSH
+transport shared by the terminal and other forwards.
+
+The endpoints remain loopback-only on both sides. Creating and stopping a
+forward requires explicit user action. New labels use typed catalog messages.
+Readiness uses actual session state; screenshots cannot enable SSH on local panes.
+
+## Rejected alternatives
+
+- A second SSH process or global forwarding service would duplicate lifetime
+  and authentication policy.
+- Detached creation cannot guarantee cancellation when the pane disappears.
+- Unbounded per-client tasks allow local load to grow memory without a limit.
+- Persisted rules, automatic discovery and remote/dynamic forwarding are outside
+  this local forwarding capability.
+
+## Consequences
+
+The new behavior adds no persistent thread or timer. UI rendering does not read
+files, resolve destinations or inspect environment variables. File/profile
+resolution and network I/O remain in the existing background runtime. A forward
+owns its channels but never disconnects the shared authenticated transport.
+
+## Validation
+
+Regression coverage exercises real SSH channel exchange, half-close, occupied
+ports, channel rejection, listener/connection disposal, and bounded concurrency.
+UI regressions click the actual port fields and confirmation/cancel controls,
+check invalid input, and reject submission after the pane stops being ready.
+Terminal and bridge regressions cover normal exit, failure and pending-work
+cancellation. These tests do not claim arbitrary-host throughput or physical
+platform visual acceptance.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Revisit the limit and UI state model if measured workloads need more concurrent
+channels, or when persistent/reconnecting forwards are explicitly introduced.
```

**File**: `nebula_app/i18n/en-US.json` (modified, +12/-1)
```diff
@@ -1292,5 +1292,16 @@
       "failed": "Could not complete the operation: {detail}",
       "changed": "The package changed after inspection. Choose the file again before installing."
     }
-  }
+  },
+  "ssh.ports.button": "Ports",
+  "ssh.ports.title": "SSH port forwarding",
+  "ssh.ports.empty": "No forwarded ports",
+  "ssh.ports.stop": "Stop forwarding",
+  "ssh.ports.remote": "Remote port",
+  "ssh.ports.local": "Local port",
+  "ssh.ports.forward": "Forward",
+  "ssh.ports.invalid": "Enter ports from 1–65535",
+  "ssh.ports.pending": "Starting port forwarding…",
+  "ssh.ports.unavailable": "SSH network runtime unavailable",
+  "ssh.ports.started": "Forwarding 127.0.0.1:{local} to {host} port {remote}"
 }
```

**File**: `nebula_app/i18n/zh-CN.json` (modified, +12/-1)
```diff
@@ -1292,5 +1292,16 @@
       "failed": "操作未完成：{detail}",
       "changed": "主题包在检查后发生了变化。请重新选择文件，再确认安装。"
     }
-  }
+  },
+  "ssh.ports.button": "端口",
+  "ssh.ports.title": "SSH 端口转发",
+  "ssh.ports.empty": "暂无端口转发",
+  "ssh.ports.stop": "停止转发",
+  "ssh.ports.remote": "服务器端口",
+  "ssh.ports.local": "本地端口",
+  "ssh.ports.forward": "转发",
+  "ssh.ports.invalid": "请输入 1–65535 的端口",
+  "ssh.ports.pending": "正在启动端口转发…",
+  "ssh.ports.unavailable": "SSH 网络运行时不可用",
+  "ssh.ports.started": "正在将 127.0.0.1:{local} 转发至 {host} 的 {remote} 端口"
 }
```

**File**: `nebula_app/src/gpui_shell/terminal/view.rs` (modified, +8/-0)
```diff
@@ -341,6 +341,9 @@ pub struct TerminalView {
     path_drop: path_drop::PathDropState,
     /// SSH 直连目的地（`user@host[:port]`）；本地会话为 None。
     pub ssh_destination: Option<String>,
+    /// 本 pane 拥有的本地端口转发；pane 销毁即停止监听。
+    pub(crate) port_forwards: Vec<crate::ssh_session::LocalForward>,
+    pub(crate) port_forward_task: Option<gpui::Task<()>>,
     ssh_label: Option<String>,
     /// 创建本地 PTY 时冻结的受控环境，供独立 `pane.exec` child 复用。
     pub(crate) exec_context: Option<crate::runtime_exec::PaneExecContext>,
@@ -719,6 +722,8 @@ impl TerminalView {
 
     /// `Exited` 只对宿主发一次；重复的退出信号（ChildExit 之后必然跟 Exit）只更新文案。
     fn mark_exited(&mut self, message: String, cx: &mut Context<Self>) {
+        self.port_forward_task = None;
+        self.port_forwards.clear();
         self.confirmation.invalidate();
         self.pending_runtime_submit = None;
         self.pending_shell_command = None;
@@ -990,6 +995,9 @@ impl TerminalView {
     /// 通道，撞上一个还没建立的传输——用户看到的是文件面板先报一个错，然后
     /// 终端才连上。
     pub fn ready_ssh_destination(&self) -> Option<&str> {
+        if self.exited.is_some() {
+            return None;
+        }
         let destination = self.ssh_destination.as_deref()?;
         matches!(self.ssh_stage, Some(crate::ssh_session::SshStage::Ready)).then_some(destination)
     }
```

**File**: `nebula_app/src/gpui_shell/terminal/view/output_tests.rs` (modified, +25/-0)
```diff
@@ -177,3 +177,28 @@ fn hidden_wakeup_still_flushes_shell_commands_and_pending_enter(cx: &mut TestApp
         assert!(view.pending_runtime_submit.is_none());
     });
 }
+
+#[gpui::test]
+fn ssh_exit_and_failure_cancel_pending_forward_and_hide_remote_actions(cx: &mut TestAppContext) {
+    let (view, window, _) = open(cx);
+    for failed in [false, true] {
+        view.update(window, |view, cx| {
+            view.exited = None;
+            view.ssh_destination = Some("fixture@localhost".into());
+            view.apply_ssh_stage(crate::ssh_session::SshStage::Ready, cx);
+            assert_eq!(view.ready_ssh_destination(), Some("fixture@localhost"));
+            view.port_forward_task =
+                Some(cx.spawn(async |_, _| std::future::pending::<()>().await));
+            if failed {
+                view.apply_ssh_stage(
+                    crate::ssh_session::SshStage::Failed("disconnected".into()),
+                    cx,
+                );
+            } else {
+                view.process_event(TermEvent::Exit, cx);
+            }
+            assert!(view.port_forward_task.is_none());
+            assert!(view.ready_ssh_destination().is_none());
+        });
+    }
+}
```

**File**: `nebula_app/src/gpui_shell/terminal/view/runtime.rs` (modified, +2/-0)
```diff
@@ -111,6 +111,8 @@ impl TerminalView {
         );
         self.ssh_connect_last_step = std::time::Instant::now();
         if matches!(stage, crate::ssh_session::SshStage::Failed(_)) {
+            self.port_forward_task = None;
+            self.port_forwards.clear();
             self.pending_runtime_submit = None;
             self.pending_shell_command = None;
             self.command_running = false;
```

**File**: `nebula_app/src/gpui_shell/terminal/view/startup.rs` (modified, +2/-0)
```diff
@@ -302,6 +302,8 @@ impl TerminalView {
             image_paste: image_paste::ImagePasteState::default(),
             path_drop: path_drop::PathDropState::default(),
             ssh_destination,
+            port_forwards: Vec::new(),
+            port_forward_task: None,
             ssh_label: None,
             exec_context,
             ssh_stage: None,
```

---

### Incident Patch 14: `513e1822` (2026-10-04)
**Commit Message**: Merge upstream main into codex/issue-398-fixed-theme-preview

**File**: `.config/nextest.toml` (modified, +11/-0)
```diff
@@ -14,3 +14,14 @@ test-group = 'theme-studio'
 [[profile.default.overrides]]
 filter = 'test(=gpui_shell::terminal::view::startup_tests::git_completion_real_repository_reaches_all_modes_and_preserves_quoted_edits)'
 threads-required = 'num-test-threads'
+
+# 这些语义夹具同样要求真实 Git 在产品的 3 秒预算内成功；并发绘制负载
+# 可以合法耗尽该预算，不能把这种回退结果当成候选语义的反例。
+# 只预留这七个完整名称；取消、失败/超时和普通纯规则测试继续并发执行。
+[[profile.default.overrides]]
+filter = 'test(=git_completion::tests::real_explicit_tracking_creates_and_inherits_the_expected_upstream) or test(=git_completion::tests::real_remote_guesses_follow_configuration_and_refspecs) or test(=git_completion::tests::real_branches_cache_invalidation_and_directory_context)'
+threads-required = 'num-test-threads'
+
+[[profile.default.overrides]]
+filter = 'test(=completion::tests::completion_requests_work_without_a_view_and_keep_repository_invalidation) or test(=completion::tests::editor_cursor_requests_replace_only_the_active_token_and_keep_following_options) or test(=completion::tests::checkout_completion_combines_branches_and_paths_and_scopes_remote_demand) or test(=completion::tests::explicit_tracking_requests_keep_edits_scoped_and_do_not_execute)'
+threads-required = 'num-test-threads'
```

**File**: `architecture/notes/nebula_app/gpui_shell/terminal/view/2026-10-04-remote-editor-startup.md` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+# Advertise native editing from every integrated startup route
+
+## Status
+
+Implemented. Route acceptance evidence accompanies the review.
+
+## Context
+
+Completion accepts authoritative editor snapshots only after the owning shell
+advertises the query binding. Installing a widget without its readiness report
+leaves the view on native fallback. Backend metadata and remote command tests do
+not exercise that handshake.
+
+An audit found that the default WSL Bash prompt and external SSH Bash/zsh prompts
+installed the adapter without advertising readiness. The authenticated SSH hook
+installer also composed its shell assets from raw rc files without the shared
+connection/editor adapter. Local shell acceptance did not reveal these routes.
+
+## Evidence
+
+Three real PTY regressions executing the actual WSL and external SSH startup
+constants failed before the repair because the initial prompt lacked readiness.
+After the repair they verify the initial and next prompt, the same snapshot owner,
+UTF-8 caret position, a quoted Unicode middle edit and actual command output.
+
+The remote installation regression checks the actual planned Bash/zsh assets.
+Existing repeat-install, upgrade, removal and foreign-edit tests retain ownership
+protection. The native remote fixture uses the ordinary WSL launch and an actual
+authenticated SSH connection, rather than supplying synthetic readiness events.
+
+## Decision
+
+Keep one readiness reporter in the shared terminal shell adapter. Prompt owners
+call it after reporting their shell token; it emits only when installation
+established the private query binding and a token exists. Local, WSL and external
+SSH prompts use that same reporter. The authenticated SSH installer appends the
+same connection/editor adapter to its owned shell assets and updates their existing
+hash receipts through its normal upgrade policy.
+
+Window acceptance waits for the real readiness event, queries the actual buffer,
+accepts through product input/keyboard handlers and paints through the product
+renderer. It verifies that acceptance leaves Git HEAD unchanged and that a later
+explicit Enter executes the completed command. Probe queries reuse the product's
+existing encoding and classic VT fallback, including the private F24 sequence.
+
+## Rejected alternatives
+
+- Infer editor readiness from prompt pixels: a prompt does not prove a binding.
+- Treat remote metadata tests as window acceptance: they omit the editor handshake.
+- Duplicate an adapter in each startup script: separates binding ownership and
+  protocol behavior across routes.
+- Force a supported shell or overwrite a user binding: changes startup semantics.
+- Enable installation after an explicit integration opt-out: changes the user's
+  installation policy. Ordinary-shell fallback remains available.
+
+## Consequences
+
+Repeated same-owner readiness keeps an immediate Tab request alive under the
+existing editor state contract. User-owned F24 bindings still prevent adapter
+installation. Unsupported editors, custom startup commands and failed integration
+retain existing fallback behavior; this does not promise every shell is supported.
+Bash before version 4 lacks the required native buffer/caret interface and does
+not install or advertise the query widget. Its startup regression requires native
+command execution without a readiness claim.
+
+The QA driver keeps settings and SSH authentication profiles in a fresh config,
+uses an owned known-host file and loopback key, and launches a desktop that is never
+switched to. WSL QA disables hook installation into the guest home and redirects
+shell history into the owned fixture. Authenticated SSH QA uses an isolated remote
+HOME while exercising the normal installer and authenticated connection pool.
+
+## Validation
+
+[`test_completion_editor.py`](../../../../../../scripts/tests/test_completion_editor.py)
+tests real Bash/zsh buffers and startup constants. The native
+[`remote.rs`](../../../../../../nebula_app/src/gpui_shell/terminal/view/completion_native_tests/remote.rs)
+fixture tests inline, popup and hybrid modes, immediate Tab, Chinese/emoji middle
+editing with following flags, acceptance without execution, execution and Escape
+cancellation. CI still compiles the shared test driver on selected native hosts;
+an ignored graphical fixture is executed explicitly and is not counted as CI GUI
+coverage. Actual native route results and limitations accompany the review.
+
+## Supersedes
+
+None. Extends [`2026-10-03-editor-snapshots.md`](2026-10-03-editor-snapshots.md).
+
+## Revisit when
+
+Additional shell editors expose a verified buffer API, or startup integration can
+advertise capabilities independently of the existing owned shell assets.
```

**File**: `architecture/notes/nebula_app/platform/2026-10-04-owned-process-startup.md` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+# Attach Windows process ownership before execution
+
+## Status
+
+Implemented. Native validation accompanies the review.
+
+## Context
+
+Bounded metadata probes and pane execution share the process-group adapter.
+Windows uses a kill-on-close Job Object so cancellation and timeouts also reap
+descendants. Previously the child could run between `spawn` and job assignment.
+A short command could exit during that interval; attaching its job then failed
+and discarded otherwise valid output.
+
+The full main Windows suite reported unavailable Git metadata before its
+candidate assertions. Retrying the fixture did not resolve the repeated failure.
+The original failure discarded the operating-system error, so it cannot establish
+that this race explains every unavailable read.
+
+## Evidence
+
+An owned native Windows probe assigned a job successfully to a live child.
+Assignment after a fast child's successful exit returned error 5 even though its
+captured output was intact. The production adapter treated that assignment error
+as a failed acquisition.
+
+The regression in [`process.rs`](../../../../nebula_app/src/platform/process.rs)
+delays ownership attachment and requires the child to remain alive with no output.
+Only attachment may release execution; the test then checks its exit and output.
+
+## Decision
+
+Create owned Windows children with `CREATE_SUSPENDED` and the existing hidden
+console flag. Establish the kill-on-close job first, then locate and resume the
+new child's initial thread using the existing ToolHelp API dependency. Thread
+selection is restricted to the PID of that still-owned child. Close every native
+handle and fail the acquisition if attachment or resumption fails. The callers
+retain their kill-and-wait error cleanup; a job guard covers resumption failure.
+
+This changes only the shared owned-process adapter. Interactive terminal startup
+and Unix process groups keep their existing paths. Git assertions require a
+successful metadata read directly, without a fixture retry wrapper.
+
+## Rejected alternatives
+
+- Retry Git assertions or extend their deadlines: hides failed process ownership
+  and does not prevent a descendant from escaping before attachment.
+- Ignore job assignment failure after exit: cannot prove that no descendants were
+  created before the parent exited.
+- Resume before assigning the job: retains the same ownership race.
+- Use nightly-only process-spawn APIs: changes the pinned stable toolchain for an
+  operation supported by the existing native adapter.
+
+## Consequences
+
+Each owned Windows spawn has an additional thread snapshot on a background path.
+No snapshot or process wait occurs in a render callback. Successful attachment
+releases the child once; failed setup retains cleanup ownership. Output bounds,
+timeouts, cancellation and separate stdout/stderr capture remain the caller's
+responsibility.
+
+## Validation
+
+The native Windows ownership regression and existing process/cancellation suite
+pass on an isolated desktop. Git metadata acquisition, pane execution, remote
+window acceptance and selected native CI results accompany the final review.
+The independent probe and regression establish the race mechanism; they do not
+replace a fresh full Windows run of the formerly failing metadata fixture.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Stable Rust exposes the initial thread handle or process attribute-list spawn,
+or a measured background-spawn cost requires a narrower native implementation.
```

**File**: `architecture/notes/scripts/ci/2026-10-04-bounded-git-semantic-fixtures.md` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+# Preserve quiescent resources for bounded Git semantic fixtures
+
+## Status
+
+Implemented for review. Fresh complete native CI remains required before merge.
+
+## Context
+
+Real Git completion uses a three-second wall-clock metadata budget. An unavailable
+read is a legitimate bounded-request outcome, with native fallback, rather than a
+successful empty repository. Semantic fixtures require successful acquisition to
+assert candidate meaning. Competing UI work can make that precondition unavailable.
+
+The existing resource rule protects the nine-scene window fixture, but not the
+three backend Git fixtures or four request fixtures with the same acquisition
+requirement. Their production queries share that deadline.
+
+## Evidence
+
+Windows x64 [job 111441616189](https://github.com/Kuddev/pebrel/actions/runs/37204079779/job/111441616189)
+ran 2796 tests: 2795 passed, one remote-guess fixture failed for unavailable metadata
+before candidate assertions, and 35 were skipped. The prior process repair's full
+five-platform PR CI and subsequent main run passed; that fixed ownership race does
+not establish availability under every parallel load.
+
+A local Windows run with 16 test threads reproduced four metadata request fixture
+failures. Diagnostics identify `for-each-ref`, remaining budgets of roughly
+1.36–1.71 seconds, `Interrupted`, no native OS error, and an expired overall deadline.
+The same application revision had passed its full four-thread suite. This proves
+the load mechanism locally; the original hosted failure did not retain a raw error.
+
+## Decision
+
+Extend the existing nextest resource policy to seven complete test names: three
+real Git semantic fixtures and four metadata request fixtures. Each occupies the
+runner's test-thread capacity while active. Keep the existing settings-write group
+and nine-scene fixture rule. The configuration contract enumerates every exact
+override and rejects broad serialization, exclusions or retries.
+
+Keep the production three-second budget, cancellation, output bounds, cleanup and
+semantic assertions. Test-only diagnostics retain acquisition errors and stages
+without printing command buffers, cwd, configuration contents or credentials.
+Success fixtures still read actual Git metadata and execute their relevant effects.
+
+## Rejected alternatives
+
+- Extend production timeouts for a loaded test runner: changes interactive behavior.
+- Retry until acquisition succeeds: obscures the actual failure and test precondition.
+- Accept empty candidates: weakens semantic assertions and confuses unavailable data
+  with a valid empty repository.
+- Serialize the complete suite or entire completion module: constrains unrelated
+  pure tests and failure/cancellation coverage without this resource requirement.
+- Replace real metadata with canned candidates: removes the execution contract.
+
+## Consequences
+
+These seven fixtures briefly reserve all test slots; all tests still run and the
+complete platform matrix remains selected. Cancellation, stale-result and failure
+tests retain normal scheduling. This is a semantic integration contract, not an
+availability or performance guarantee under arbitrary competing load.
+
+## Validation
+
+The existing CI configuration test validates the exact filters and resource weight
+alongside the unchanged settings group. Actual quiescent native fixture results
+and fresh complete native CI accompany the review. The failing local load run and
+hosted run are retained as evidence; they are not relabeled as passing runs.
+
+## Supersedes
+
+Extends the scheduling decision in
+[`2026-09-30-git-fixture-resource-weight.md`](2026-09-30-git-fixture-resource-weight.md)
+to the semantic fixtures that require the same bounded acquisition. Its original
+window-fixture rationale remains applicable.
+
+## Revisit when
+
+The metadata adapter can prove successful acquisition independently of wall-clock
+contention, or measured native runner resources support safe fixture concurrency.
```

**File**: `nebula_app/res/shell/bashrc` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ _nebula_capture_status() {
 
 _nebula_precmd() {
     printf '\e]1337;SetUserVar=pebrel_shell=%s\a' "$__pebrel_shell_token"
-    if [ "${__pebrel_editor_ready:-0}" = 1 ]; then printf '\033]1337;SetUserVar=pebrel_editor_ready=%s\007' "$__pebrel_shell_token"; fi
+    if typeset -f __pebrel_editor_ready_report >/dev/null; then __pebrel_editor_ready_report; fi
     if [[ ${_nebula_command_running:-0} == 1 ]]; then
         printf '\e]133;D;%s\a' "$_nebula_last_status"
     fi
```

**File**: `nebula_app/res/shell/zshrc` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ _nebula_preexec() {
 _nebula_precmd() {
     local status_code=$?
     printf '\e]1337;SetUserVar=pebrel_shell=%s\a' "$__pebrel_shell_token"
-    if [ "${__pebrel_editor_ready:-0}" = 1 ]; then printf '\033]1337;SetUserVar=pebrel_editor_ready=%s\007' "$__pebrel_shell_token"; fi
+    if typeset -f __pebrel_editor_ready_report >/dev/null; then __pebrel_editor_ready_report; fi
     if [[ ${_nebula_command_running:-0} == 1 ]]; then
         printf '\e]133;D;%s\a' "$status_code"
     fi
```

**File**: `nebula_app/src/ai_hook/remote.rs` (modified, +12/-2)
```diff
@@ -219,14 +219,24 @@ impl Snapshot {
             quote(&self.python),
             quote(&self.file("bridge.py")?.path)
         );
+        let bashrc = format!(
+            "{}\n{}",
+            include_str!("../../res/shell/bashrc"),
+            nebula_terminal::tty::connection_shell()
+        );
+        let zshrc = format!(
+            "{}\n{}",
+            include_str!("../../res/shell/zshrc"),
+            nebula_terminal::tty::connection_shell()
+        );
         let mut assets = vec![
             ("pebrel-hook", launcher.as_str()),
             ("bridge.py", BRIDGE),
             ("shell.py", SHELL),
-            ("bashrc", include_str!("../../res/shell/bashrc")),
+            ("bashrc", bashrc.as_str()),
             (".zshenv", include_str!("../../res/shell/zshenv")),
             (".zprofile", include_str!("../../res/shell/zprofile")),
-            (".zshrc", include_str!("../../res/shell/zshrc")),
+            (".zshrc", zshrc.as_str()),
         ];
         if self.present("opencode") {
             assets.push(("opencode", bridges::OPENCODE_PLUGIN_JS));
```

**File**: `nebula_app/src/ai_hook/remote/tests.rs` (modified, +15/-0)
```diff
@@ -52,6 +52,21 @@ fn apply(snapshot: &mut Snapshot, edits: Vec<Edit>) {
     }
 }
 
+#[test]
+fn installed_shell_assets_include_the_native_editor_adapter() {
+    let snapshot = snapshot();
+    let edits = snapshot.plan(Action::Install).unwrap().unwrap();
+    for name in ["bashrc", ".zshrc"] {
+        let content =
+            edits.iter().find(|edit| edit.name == name).unwrap().content.as_deref().unwrap();
+        assert!(
+            content.contains("__pebrel_editor_report()"),
+            "{name} must install the native query"
+        );
+        assert!(content.contains("SetUserVar=pebrel_editor="), "{name} must report actual buffers");
+    }
+}
+
 #[test]
 fn install_repeat_upgrade_remove_restores_foreign_configuration() {
     let mut snapshot = snapshot();
```

---

### Incident Patch 15: `51514bd5` (2026-10-04)
**Commit Message**: Merge pull request #476 from Kuddev/fix/completion-fixture-resources-20261004

ci: reserve runner capacity for bounded Git semantic fixtures

**File**: `.config/nextest.toml` (modified, +11/-0)
```diff
@@ -14,3 +14,14 @@ test-group = 'theme-studio'
 [[profile.default.overrides]]
 filter = 'test(=gpui_shell::terminal::view::startup_tests::git_completion_real_repository_reaches_all_modes_and_preserves_quoted_edits)'
 threads-required = 'num-test-threads'
+
+# 这些语义夹具同样要求真实 Git 在产品的 3 秒预算内成功；并发绘制负载
+# 可以合法耗尽该预算，不能把这种回退结果当成候选语义的反例。
+# 只预留这七个完整名称；取消、失败/超时和普通纯规则测试继续并发执行。
+[[profile.default.overrides]]
+filter = 'test(=git_completion::tests::real_explicit_tracking_creates_and_inherits_the_expected_upstream) or test(=git_completion::tests::real_remote_guesses_follow_configuration_and_refspecs) or test(=git_completion::tests::real_branches_cache_invalidation_and_directory_context)'
+threads-required = 'num-test-threads'
+
+[[profile.default.overrides]]
+filter = 'test(=completion::tests::completion_requests_work_without_a_view_and_keep_repository_invalidation) or test(=completion::tests::editor_cursor_requests_replace_only_the_active_token_and_keep_following_options) or test(=completion::tests::checkout_completion_combines_branches_and_paths_and_scopes_remote_demand) or test(=completion::tests::explicit_tracking_requests_keep_edits_scoped_and_do_not_execute)'
+threads-required = 'num-test-threads'
```

**File**: `architecture/notes/scripts/ci/2026-10-04-bounded-git-semantic-fixtures.md` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+# Preserve quiescent resources for bounded Git semantic fixtures
+
+## Status
+
+Implemented for review. Fresh complete native CI remains required before merge.
+
+## Context
+
+Real Git completion uses a three-second wall-clock metadata budget. An unavailable
+read is a legitimate bounded-request outcome, with native fallback, rather than a
+successful empty repository. Semantic fixtures require successful acquisition to
+assert candidate meaning. Competing UI work can make that precondition unavailable.
+
+The existing resource rule protects the nine-scene window fixture, but not the
+three backend Git fixtures or four request fixtures with the same acquisition
+requirement. Their production queries share that deadline.
+
+## Evidence
+
+Windows x64 [job 111441616189](https://github.com/Kuddev/pebrel/actions/runs/37204079779/job/111441616189)
+ran 2796 tests: 2795 passed, one remote-guess fixture failed for unavailable metadata
+before candidate assertions, and 35 were skipped. The prior process repair's full
+five-platform PR CI and subsequent main run passed; that fixed ownership race does
+not establish availability under every parallel load.
+
+A local Windows run with 16 test threads reproduced four metadata request fixture
+failures. Diagnostics identify `for-each-ref`, remaining budgets of roughly
+1.36–1.71 seconds, `Interrupted`, no native OS error, and an expired overall deadline.
+The same application revision had passed its full four-thread suite. This proves
+the load mechanism locally; the original hosted failure did not retain a raw error.
+
+## Decision
+
+Extend the existing nextest resource policy to seven complete test names: three
+real Git semantic fixtures and four metadata request fixtures. Each occupies the
+runner's test-thread capacity while active. Keep the existing settings-write group
+and nine-scene fixture rule. The configuration contract enumerates every exact
+override and rejects broad serialization, exclusions or retries.
+
+Keep the production three-second budget, cancellation, output bounds, cleanup and
+semantic assertions. Test-only diagnostics retain acquisition errors and stages
+without printing command buffers, cwd, configuration contents or credentials.
+Success fixtures still read actual Git metadata and execute their relevant effects.
+
+## Rejected alternatives
+
+- Extend production timeouts for a loaded test runner: changes interactive behavior.
+- Retry until acquisition succeeds: obscures the actual failure and test precondition.
+- Accept empty candidates: weakens semantic assertions and confuses unavailable data
+  with a valid empty repository.
+- Serialize the complete suite or entire completion module: constrains unrelated
+  pure tests and failure/cancellation coverage without this resource requirement.
+- Replace real metadata with canned candidates: removes the execution contract.
+
+## Consequences
+
+These seven fixtures briefly reserve all test slots; all tests still run and the
+complete platform matrix remains selected. Cancellation, stale-result and failure
+tests retain normal scheduling. This is a semantic integration contract, not an
+availability or performance guarantee under arbitrary competing load.
+
+## Validation
+
+The existing CI configuration test validates the exact filters and resource weight
+alongside the unchanged settings group. Actual quiescent native fixture results
+and fresh complete native CI accompany the review. The failing local load run and
+hosted run are retained as evidence; they are not relabeled as passing runs.
+
+## Supersedes
+
+Extends the scheduling decision in
+[`2026-09-30-git-fixture-resource-weight.md`](2026-09-30-git-fixture-resource-weight.md)
+to the semantic fixtures that require the same bounded acquisition. Its original
+window-fixture rationale remains applicable.
+
+## Revisit when
+
+The metadata adapter can prove successful acquisition independently of wall-clock
+contention, or measured native runner resources support safe fixture concurrency.
```

**File**: `scripts/tests/test_ci_native_tests.py` (modified, +12/-1)
```diff
@@ -176,7 +176,7 @@ def test_native_workflow_installs_nextest_without_changing_release_callers(self)
         release = (root / ".github/workflows/release.yml").read_text(encoding="utf-8")
         self.assertIn("run: python scripts/ci_native_tests.py\n", release)
 
-    def test_nextest_reserves_only_shared_settings_and_the_heavy_git_fixture(self):
+    def test_nextest_reserves_only_shared_settings_and_exact_bounded_git_fixtures(self):
         root = Path(__file__).resolve().parents[2]
         config = tomllib.loads((root / ".config/nextest.toml").read_text(encoding="utf-8"))
         self.assertEqual(config["test-groups"], {"theme-studio": {"max-threads": 1}})
@@ -197,6 +197,17 @@ def test_nextest_reserves_only_shared_settings_and_the_heavy_git_fixture(self):
                 "filter": "test(=gpui_shell::terminal::view::startup_tests::"
                           "git_completion_real_repository_reaches_all_modes_and_preserves_quoted_edits)",
                 "threads-required": "num-test-threads",
+            }, {
+                "filter": "test(=git_completion::tests::real_explicit_tracking_creates_and_inherits_the_expected_upstream)"
+                          " or test(=git_completion::tests::real_remote_guesses_follow_configuration_and_refspecs)"
+                          " or test(=git_completion::tests::real_branches_cache_invalidation_and_directory_context)",
+                "threads-required": "num-test-threads",
+            }, {
+                "filter": "test(=completion::tests::completion_requests_work_without_a_view_and_keep_repository_invalidation)"
+                          " or test(=completion::tests::editor_cursor_requests_replace_only_the_active_token_and_keep_following_options)"
+                          " or test(=completion::tests::checkout_completion_combines_branches_and_paths_and_scopes_remote_demand)"
+                          " or test(=completion::tests::explicit_tracking_requests_keep_edits_scoped_and_do_not_execute)",
+                "threads-required": "num-test-threads",
             }],
         })
 
```

#### Recent Merged Pull Requests:
- **PR #490** (2026-10-05): fix(mobile): add SSH key setup directly from relay installation (@Kuddev)
- **PR #488** (2026-10-05): fix(mobile): reuse SSH key authentication for relay deployment (@Kuddev)
- **PR #487** (2026-10-05): fix(menu): add the missing terminal paste icon (@Kuddev)
- **PR #485** (2026-10-05): fix(workspace): honour the startup directory on cold start (@azzliang6)
- **PR #476** (2026-10-04): ci: reserve runner capacity for bounded Git semantic fixtures (@Kuddev)
- **PR #473** (2026-10-04): fix(completion): wire native editor readiness through WSL and SSH (@Kuddev)
- **PR #470** (2026-10-04): fix(process): attach Windows cleanup ownership before execution (@Kuddev)
- **PR #469** (2026-10-04): Complete from native editor buffers without accepting prediction text (@Kuddev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
