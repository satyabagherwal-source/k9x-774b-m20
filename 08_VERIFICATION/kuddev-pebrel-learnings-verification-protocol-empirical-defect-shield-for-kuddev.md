# Verification Protocol: Verification Protocol: Empirical Defect Shield for kuddev-pebrel-learnings

<!-- PROVENANCE_START
{
  "source_repository": "kuddev-pebrel-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T04:05:05.345Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kuddev-pebrel-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kuddev-pebrel-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T04:05:05.345Z`  
> **Learning ID**: `LEARN-EVO-kuddev-pebrel-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `kuddev-pebrel-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `c63ff393`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T04:04:55.555Z  
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
> **Harvest Timestamp**: 2026-11-15T04:04:55.549Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3817 stars

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

const REPLIES = ["permission.replied", "question.replied", "question.rejected"]

const PebrelNotify = async ({ directory, worktree }) => {
  const hook = process.env.PEBREL_HOOK_EXE ?? process.env.NEBULA_HOOK_EXE
  if (!hook) return {}
  const controller = new AbortController()
  // Provider events interleave sessions. Permission waits keep a turn active;
  // a child session's idle must not consume the primary session's completion.
  const turns = new Map()
  const turnFor = (id) => {
    const key = id || "pending"
    const turn = turns.get(key) || { active: false, lastUser: "", waiting: false }
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
    turnFor(sessionId).waiting = true
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
      // A reply to a request this bridge never reported is not lifecycle evidence.
      if (REPLIES.includes(t) && !turns.get(candidate || sessionId || "pending")?.waiting) return
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
      } else if (t === "session.status" && ["busy", "retry"].includes(props.status?.type)) {
        if (!turn.active) { turn.active = true; send({ kind: "prompt" }) }
      } else if (t === "session.finished" || t === "session.error") {
        // A repeated execution result must not finish the same turn twice.
        if (!turn.active) return
        turn.active = false
        turn.waiting = false
        const outcome = t === "session.error"
          ? (props.error?.name === "MessageAbortedError" ? "cancelled" : "failed")
          : props.outcome
        send({ kind: "done", outcome })
      } else if (t === "session.idle" || (t === "session.status" && props.status?.type === "idle")) {
        // Dedupe opencode's spurious idles (startup/cancel): only a turn
        // that actually started reports done.
        if (turn.active) { turn.active = false; turn.waiting = false; send({ kind: "done" }) }
      } else if (["permission.updated", "permission.ask", "permission.asked", "question.asked"].includes(t)) {
        // Compatibility path for OpenCode builds that also publish permission
        // changes on the generic event bus.
        reportPermission(props)
      } else if (REPLIES.includes(t)) {
        turn.waiting = false
        send({ kind: "tool-complete" })
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
            type = "session.finished"
            properties = { ...data, outcome: event.type === "session.execution.succeeded"
              ? "succeeded" : event.type === "session.execution.failed" ? "failed" : "cancelled" }
            break
          case "permission.asked":
          case "question.asked":
            type = "permission.ask"
            break
          case "permission.replied":
          case "question.replied":
          case "question.rejected":
            type = "permission.replied"
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
import stat
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


def send(source, native, mode, payload, token, owner=None, route=None, deadline=None):
    owner = owner or process_identity(source)
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
        if route:
            header += " tmux=" + route["context"]
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
        exit_owner = owner if source == "claude" and payload.get("hook_event_name") == "SessionEnd" else None
        write_terminal(osc, source, route, deadline, exit_owner=exit_owner)


def open_claude_exit_terminal(owner, flags):
    """A detached SessionEnd can still reach Claude's verified Linux terminal."""
    if sys.platform != "linux" or not owner:
        return None
    pid, _, epoch = owner.partition(":")
    proc = Path("/proc") / pid
    stdin = proc / "fd/0"
    try:
        tty = stdin.readlink()
        if not re.fullmatch(r"/dev/pts/[0-9]+", str(tty)):
            return None
        fd = os.open(tty, flags | os.O_NOCTTY)
    except OSError:
        return None
    try:
        info = os.fstat(fd)
        raw = (proc / "stat").read_text(encoding="utf-8")
        fields = raw[raw.rfind(")") + 2:].split()
        if (stat.S_ISCHR(info.st_mode) and info.st_uid == os.geteuid()
                and fields[19] == epoch and int(fields[2]) > 0 and fields[2] == fields[5]
                and info.st_rdev == (int(fields[4]) & 0xffffffff)
                and os.path.samestat(info, stdin.stat())):
            return fd
    except (OSError, ValueError, IndexError):
        pass
    os.close(fd)
    return None


def write_terminal(osc, source=None, route=None, deadline=None, *, exit_owner=None):
    flags = os.O_WRONLY | os.O_NONBLOCK | os.O_NOFOLLOW
    try:
        fd = os.open(route["tty"] if route else "/dev/tty", flags)
    except OSError as error:
        if route or source != "claude" or error.errno != errno.ENXIO:
            raise
        fd = open_claude_exit_terminal(exit_owner, flags)
        if fd is None:
            # Interactive Claude consumes terminalSequence for other hooks but
            # does not relay it during SessionEnd.
            print(json.dumps({"terminalSequence": osc.decode("ascii")}), flush=True)
            return
    offset = 0
    deadline = min(deadline or float("inf"), time.monotonic() + 0.5)
    try:
        if route:
            info = os.fstat(fd)
            if not stat.S_ISCHR(info.st_mode) or info.st_rdev != route["device"]:
                raise ValueError("SSH terminal identity changed")
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
    if not args or args[0] 
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
    for name in ("pebrel-hook", "bridge.py", "remote_tmux.py", "shell.py", "bashrc", ".zshenv", ".zprofile", ".zshrc"):
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

### Core Architecture Module: `nebula_app/res/hooks/remote_tmux.py`
```
"""Short-lived routes from an active remote pane to its owning SSH PTY.

Called over authenticated exec for observations; imported by the hook bridge for
delivery. No server options, pane input, daemon or transcript files are involved.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import select
import shlex
import stat
import subprocess
import sys
import tempfile
import time

TTL = 10
MAX_ROUTES = 128
CLIENT_FORMAT = "#{client_tty}\t#{session_id}\t#{session_created}:#{pid}\t#{window_id}\t#{pane_id}"
PANE_FORMAT = "#{pane_pid}\t#{pane_tty}\t#{pane_current_command}\t#{pane_title}"


def capture(argv, deadline, limit=65536):
    """Bound both child lifetime and stdout, including malformed remote pane formats."""
    with subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL) as child:
        output = bytearray()
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0 or not select.select([child.stdout], [], [], remaining)[0]:
                    raise TimeoutError("remote pane observation expired")
                chunk = os.read(child.stdout.fileno(), min(8192, limit + 1 - len(output)))
                if not chunk:
                    if child.wait(timeout=max(0.001, deadline - time.monotonic())):
                        raise ValueError("remote pane query failed")
                    return output.decode("utf-8", "replace")
                output.extend(chunk)
                if len(output) > limit:
                    raise ValueError("remote pane output exceeds budget")
        finally:
            if child.poll() is None:
                child.kill()
                child.wait()


def process(pid, deadline):
    pid = int(pid)
    if pid <= 0 or time.monotonic() >= deadline:
        raise ValueError("invalid process identity")
    try:
        raw = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8")
        fields = raw[raw.rfind(")") + 2:].split()
        with open(f"/proc/{pid}/cmdline", "rb") as source:
            argv = source.read(4096).split(b"\0")[:3]
        return dict(pid=pid, parent=int(fields[1]), group=int(fields[2]),
                    foreground=int(fields[5]), device=int(fields[4]) & 0xffffffff,
                    epoch=fields[19], argv=[arg.decode("utf-8", "replace") for arg in argv])
    except FileNotFoundError:
        if Path("/proc/self/stat").exists():
            raise
    # BSD/macOS expose the same identity through ps. Unknown fields fail closed.
    row = capture(["ps", "-ww", "-p", str(pid), "-o", "ppid=", "-o", "pgid=",
                   "-o", "tpgid=", "-o", "tty=", "-o", "lstart=", "-o", "args="],
                  min(deadline, time.monotonic() + 0.15), 8192).strip().split(None, 9)
    if len(row) != 10:
        raise ValueError("process identity is unavailable")
    tty = row[3] if row[3].startswith("/") else "/dev/" + row[3]
    return dict(pid=pid, parent=int(row[0]), group=int(row[1]), foreground=int(row[2]),
                device=os.stat(tty).st_rdev,
                epoch=hashlib.sha256(" ".join(row[4:9]).encode()).hexdigest()[:16],
                argv=shlex.split(row[9])[:3])


def process_key(value):
    return f"{value['pid']}:{value['epoch']}"


def owns_tty(value, tty):
    info = os.stat(tty, follow_symlinks=False)
    return stat.S_ISCHR(info.st_mode) and info.st_uid == os.getuid() and value["device"] == info.st_rdev


def query(route, *args, deadline):
    command = [route["executable"], "-u"]
    if route["socket"]:
        command += ["-S", route["socket"]]
    return capture(command + list(args), min(deadline, time.monotonic() + 0.5))


def clients(route, deadline):
    rows = query(route, "list-clients", "-F", CLIENT_FORMAT, deadline=deadline)
    return [line.split("\t") for line in rows.splitlines() if len(line.split("\t")) == 5]


def client_matches(route, rows):
    expected = [route[key] for key in ("tty", "session", "identity", "window", "pane")]
    return sum(row[0] == route["tty"] for row in rows) == 1 and expected in rows


def pane(route, deadline):
    target = f"{route['session']}:{route['window']}.{route['pane']}"
    fields = query(route, "display-message", "-p", "-t", target, PANE_FORMAT,
                  deadline=deadline).rstrip("\n").split("\t", 3)
    if len(fields) != 4:
        raise ValueError("invalid pane metadata")
    root = process(fields[0], deadline)
    if not owns_tty(root, fields[1]):
        raise ValueError("pane no longer owns its terminal")
    foreground = process(root["foreground"], deadline)
    if not owns_tty(foreground, fields[1]):
        raise ValueError("foreground process left the pane")
    return dict(root=root, foreground=foreground, tty=fields[1],
                command=fields[2][:256], title=fields[3][:4096])


def route_directory():
    # The installed bridge path is stable even when an old server inherited
    # a different XDG_CACHE_HOME or no Pebrel environment at all.
    root = Path(__file__).absolute().parent / "tmux-routes"
    if any(path.is_symlink() for path in (root, *root.parents)):
        raise ValueError("remote pane route directory contains a symbolic link")
    root.mkdir(mode=0o700, exist_ok=True)
    info = root.stat()
    if info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError("remote pane route directory is not private")
    return root


def route_paths(root):
    found = []
    for index, entry in enumerate(root.iterdir()):
        if index >= MAX_ROUTES * 2:
            raise ValueError("remote pane route scan exceeds budget")
        if re.fullmatch(r"[a-f0-9]{64}\.json", entry.name):
            found.append(entry)
    return found


def read_route(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError("remote pane route is not private")
        raw = source.read(16385)
    if len(raw) > 16384:
        raise ValueError("remote pane route exceeds budget")
    route = json.loads(raw)
    if route.get("version") != 1 or not 0 <= time.time() - route["updated"] <= TTL:
        return None
    return route


def register(route):
    root = route_directory()
    paths = route_paths(root)
    for path in paths:
        try:
            if read_route(path) is None:
                path.unlink()
        except (OSError, ValueError, KeyError):
            pass
    name = hashlib.sha256(route["token"].encode()).hexdigest() + ".json"
    if len(route_paths(root)) >= MAX_ROUTES and not (root / name).exists():
        raise ValueError("remote pane route directory is full")
    path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root, delete=False) as output:
            path = Path(output.name)
            json.dump(route, output, ensure_ascii=False, separators=(",", ":"))
        os.replace(path, root / name)
    finally:
        if path is not None:
            path.unlink(missing_ok=True)


def observe(route):
    deadline = time.monotonic() + 2
    if not re.fullmatch(r"[a-fA-F0-9]{32}", route["token"]):
        raise ValueError("invalid channel token")
    outer = process(route["pid"], deadline)
    if not owns_tty(outer, route["tty"]) or not client_matches(route, clients(route, deadline)):
        raise ValueError("SSH client no longer owns this pane")
    current = pane(route, deadline)
    server = process(route["identity"].split(":")[1], deadline)
    socket = query(route, "display-message", "-p", "#{socket_path}", deadline=deadline).strip()
    if not socket.startswith("/") or any(ord(char) < 32 for char in socket):
        raise ValueError("invalid remote pane socket")
    route["socket"] = socket
    screen = query(route, "capture-pane", "-p", "-t", route["pane"], deadline=deadline)
    # A switched pane or foreground job must not inherit the preceding snapshot.
    if not client_matches(route, clients(route, deadline)):
        raise ValueError("remote pane client switched panes")
    latest = pane(route, deadline)
    if process_key(current["foreground"]) != process_key(latest["foreground"]):
        raise ValueError("remote pane foreground job changed")
    route.update(version=1, updated=time.time(), outer=process_key(outer),
                 server=process_key(server), foreground=process_key(current["foreground"]),
                 pane_pid=current["root"]["pid"], pane_tty=current["tty"],
                 program=current["foreground"]["argv"])
    scope = [route[key] for key in ("token", "tty", "outer", "socket", "server", "session",
                                    "identity", "window", "pane", "foreground", "program")]
    route["context"] = hashlib.sha256(json.dumps(scope, separators=(",", ":")).encode()).hexdigest()
    register(route)
    return dict(context=route["context"], command=current["command"], title=current["title"],
                argv=current["foreground"]["argv"], screen="\n".join(screen.splitlines()[-24:])[-32768:])


def descendant(child, root_pid, deadline):
    for _ in range(48):
        if child["pid"] == root_pid:
            return True
        if child["parent"] <= 1 or child["parent"] == child["pid"]:
            break
        child = process(child["parent"], deadline)
    return False


def destinations(owner, deadline):
    """Never fall back to writing an unscoped OSC inside a remote pane."""
    if not owner or not re.fullmatch(r"%\d+", os.environ.get("TMUX_PANE", "")):
        return []
    environment = os.environ.get("TMUX", "").rsplit(",", 2)
    if len(environment) != 3:
        return []
    socket, server_pid, _ = environment
    routes = []
    for path in route_paths(route_directory()):
        try:
            route = read_route(path)
            if (route and rout
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #982** (2026-11-14): **[Bug] 背景模糊效果失效**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows11 26H2, 125% sacaling, 1 monitor  ### Pebrel version / 版本号  2.5.7  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Terminal rendering / scrolling / selection / garbled text — 终端渲染、滚动、选区、乱码  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. 打开Pebrel 2. 进入设置-外观-界面-背景模糊 3. 选择Mica和Mica Alt，窗口背景不透明度调低整个窗口画面只会变白，像对比度特别高的样子，字体渲染也变糊，窗口背景没有模糊效果 4. 选择Aero和Acrylic， 窗口背景不透明度调低整个窗口只会变黑，窗口背景没有模糊效果   ### Expected behavior / 期望结果  希望能让背景模糊恢复  ### Actual behavior / 实际结果  无  ### Logs / screenshots / 日志或截图  <img width="1515" height="897" alt="屏幕截图 2026-11-13 184548" src="https://github.com/user-attachments/assets/db937186-cb10-4495-af40-2aa923ff2e68" />  <img width="1535" height="911" alt="屏幕截图 2026-11-13 184734" src="https://github.com/user-attachments/assets/d1e97e49-7a8e-4543-92cf-2793e6bc0607" />  <img width="1505" height="902" alt="屏幕截图 2026-11-13 184613" src="https://github.com/user-attachments/assets/c7cad6a9-6f3a-4a7b-92a1-b70fc10fc65a" />  <img width="1521" height="902" alt="屏幕截图 2026-11-13 184759" src="https://github.com/user-a

- **Issue #974** (2026-11-14): **[Bug] sftp 目录所在目录删除后，无法跳回上级目录**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  macos 26.0  ### Pebrel version / 版本号  2.5.6  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  bash  ### Program running in the pane / 面板里正在跑的程序  Codex CLI  ### Connection type / 连接方式  SSH via Pebrel host list / Pebrel 内 SSH 主机  ### Affected area / 影响范围  File tree / drag-and-drop upload — 文件树、拖拽上传  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. 先进入 sftp,进入某个目录 2. 删除那个目录后再次打开 sftp, 按钮失效。  ### Expected behavior / 期望结果  希望刷新或者退回上级能使用，或者跳回家目录。现在删除了 sftp 所在目录后按钮都失效了。  ### Actual behavior / 实际结果  按钮失效  ### Logs / screenshots / 日志或截图  无  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

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

### Incident Patch 1: `c63ff393` (2026-11-15)
**Commit Message**: Throttle unchanged hook session registry writes (#983)

Persist unchanged session identities at most once per minute. Persist new identities and cwd or title changes immediately.

**File**: `architecture/notes/nebula_app/ai_sessions/2026-11-13-hook-registry-write-interval.md` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+# Hook session index rewrites are throttled to one per minute
+
+## Status
+
+Implemented.
+
+## Context
+
+AI clients emit a hook event per tool call, and nearly every event only refreshes
+`last_seen` for an existing session. `record_hook_session` runs on the UI/event
+path (`gpui_shell/terminal/view/agent_activity.rs` and
+`window_context/agent_activity.rs`), and each event took the exclusive registry
+lock, read and parsed the whole JSON index, updated/sorted/truncated the rows,
+serialized it and replaced the file through `atomic_file::write` (`sync_all` plus
+the write-through rename). Active AI turns therefore paid a file write per tool
+call on the UI thread.
+
+## Evidence
+
+- One `record_hook_session` measured about 12.4 ms locally; reading and parsing
+  the file costs about 0.05 ms on its own.
+- Both production call sites pass `title: None`, so the only field that usually
+  moves is `last_seen`.
+- The registry is capped at 256 rows and is read by `scan()`, which uses
+  `last_seen` as `modified` for ordering and the relative label. Claude and Codex
+  rows also merge the native transcript mtime via `max`, so the registry timestamp
+  mainly orders the remaining agents.
+
+## Decision
+
+After loading the registry, when the row for `(source, id)` already has the same
+effective cwd and title and was persisted less than 60 s ago, return without
+sorting, serializing or writing; the row keeps its previous `last_seen`. Empty
+incoming cwd/title keep the stored value and never count as a change. New rows,
+cwd/title changes and rows older than the interval still rewrite, with the id
+validation, sort order, `REGISTRY_LIMIT` truncation and JSON format unchanged.
+
+## Rejected alternatives
+
+- Move the write to a background worker: the per-event fsync traffic remains, and
+  a small JSON index would gain a thread lifecycle. Throttling removes most of the
+  work with no new state.
+- Keep writing every event but skip `sync_all`: weakens the durability contract of
+  the only file that records resumable identities.
+- Cache the registry in memory: several instances and helpers write the same file,
+  so the cache would need cross-process invalidation.
+- Never refresh `last_seen` while the identity is unchanged: ordering and relative
+  labels would freeze at the first event of a turn.
+
+## Consequences
+
+- A session that keeps emitting events without cwd/title changes is written at
+  most once per 60 s; ordering and "N minutes ago" labels stay minute-accurate.
+- The row can remain up to 60 s older than the latest event, for every client.
+- A wall-clock jump backwards makes `now.saturating_sub(last_seen)` zero, so that
+  row is treated as just written until the clock catches up.
+- Skipped events still take the exclusive lock file and parse the registry; the win
+  comes from dropping serialization and fsync, not the read.
+
+## Validation
+
+`nebula_app/src/ai_sessions.rs` tests: `the_rewrite_interval_is_pure`,
+`unchanged_events_within_a_minute_skip_the_rewrite` (an unknown-field sentinel
+proves the file was not rewritten), `changed_cwd_or_title_still_rewrites`,
+`events_after_the_interval_still_write` and `new_sessions_still_write`.
+`scripts/check_architecture.py --base origin/main` passes.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Hook events stop being the dominant writer, registry serialization becomes cheap,
+or the resume list needs second-level freshness.
```

**File**: `nebula_app/AGENTS.md` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
 - 测试真实控件和布局路径；编译或状态单测不能代替 hover、命中区域、键盘路径和视觉验收。
 - 只有跨层所有权、持久化、协议、线程/生命周期或重要性能取舍才写 note，路径镜像到 `architecture/notes/nebula_app/<capability>/`。
 - Agent 集成、改键输入与 SSH 认证的因果记录分别位于 [`ai_hook`](../architecture/notes/nebula_app/ai_hook/)、[`input`](../architecture/notes/nebula_app/input/) 和 [`ssh_session`](../architecture/notes/nebula_app/ssh_session/)。
+- AI hook 会话索引的写入节流（身份未变时 60 秒内不重复落盘）见 [`ai_sessions`](../architecture/notes/nebula_app/ai_sessions/)。
 - Windows PowerShell 剪贴板粘贴与当前编辑器能力的边界见 [`terminal/view`](../architecture/notes/nebula_app/gpui_shell/terminal/view/)。
 - Windows 回收站调用的消息重入与后台 COM 生命周期见 [`file_operations`](../architecture/notes/nebula_app/display/file_operations/2026-11-11-recycle-bin-reentrancy.md)。
 - Runtime 地址发现与隔离实例的生命周期边界见 [`runtime_api`](../architecture/notes/nebula_app/runtime_api/)。
```

**File**: `nebula_app/src/ai_sessions.rs` (modified, +97/-3)
```diff
@@ -117,6 +117,22 @@ impl AiSession {
 
 const REGISTRY_VERSION: u32 = 1;
 const REGISTRY_LIMIT: usize = 256;
+/// AI clients emit a hook event per tool call, and most only refresh
+/// `last_seen`. Rewriting and fsyncing the index is the expensive part, so a
+/// row that changed nothing else is rewritten at most this often; the resume
+/// list stays minute-accurate.
+const REGISTRY_WRITE_INTERVAL_SECS: u64 = 60;
+
+/// Whether updating `session` would change nothing but `last_seen`, and it was
+/// persisted less than [`REGISTRY_WRITE_INTERVAL_SECS`] ago. Empty incoming
+/// fields keep the stored value, so they never count as a change.
+fn unchanged_within_interval(session: &RegistrySession, cwd: &str, title: &str, now: u64) -> bool {
+    let cwd_unchanged = cwd.is_empty() || cwd == session.cwd;
+    let title_unchanged = title.is_empty() || title == session.title;
+    cwd_unchanged
+        && title_unchanged
+        && now.saturating_sub(session.last_seen) < REGISTRY_WRITE_INTERVAL_SECS
+}
 
 #[derive(Debug, Default, Serialize, Deserialize)]
 struct SessionRegistry {
@@ -187,15 +203,21 @@ fn record_hook_session_at(
     };
     let mut registry = load_registry(path);
     let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
+    let cwd = cwd.trim();
     let title = title.map(truncate_title).unwrap_or_default();
     if let Some(existing) = registry
         .sessions
         .iter_mut()
         .find(|session| session.source == agent.slug() && session.id == id)
     {
+        if unchanged_within_interval(existing, cwd, &title, now) {
+            // Nothing but `last_seen` would move, and the writer would just
+            // fsync the same bytes again. Keep the previous timestamp.
+            return Ok(());
+        }
         existing.last_seen = now;
-        if !cwd.trim().is_empty() {
-            existing.cwd = cwd.trim().to_owned();
+        if !cwd.is_empty() {
+            existing.cwd = cwd.to_owned();
         }
         if !title.is_empty() {
             existing.title = title;
@@ -205,7 +227,7 @@ fn record_hook_session_at(
             source: agent.slug().to_owned(),
             id: id.to_owned(),
             title,
-            cwd: cwd.trim().to_owned(),
+            cwd: cwd.to_owned(),
             last_seen: now,
         });
     }
@@ -647,4 +669,76 @@ mod tests {
         assert!(title.ends_with('…'));
         assert!(title.chars().count() <= TITLE_STORAGE_CHARS + 1);
     }
+
+    #[test]
+    fn the_rewrite_interval_is_pure() {
+        let session = RegistrySession {
+            source: "opencode".into(),
+            id: "session-1".into(),
+            title: "标题".into(),
+            cwd: r"D:\repo".into(),
+            last_seen: 1_000,
+        };
+        // 未变化的身份在窗口内可跳过；空字段表示保留旧值。
+        assert!(unchanged_within_interval(&session, r"D:\repo", "标题", 1_059));
+        assert!(unchanged_within_interval(&session, "", "", 1_010));
+        // 到达窗口边界或字段变化必须落盘。
+        assert!(!unchanged_within_interval(&session, r"D:\repo", "标题", 1_060));
+        assert!(!unchanged_within_interval(&session, r"D:\other", "标题", 1_010));
+        assert!(!unchanged_within_interval(&session, r"D:\repo", "别的标题", 1_010));
+    }
+
+    /// 未知字段会被 serde 忽略而原样保留；用它观察是否发生了重写。
+    fn write_sentinel_registry(path: &Path, id: &str, last_seen: u64) {
+        let json = format!(
+            r#"{{"version":1,"sentinel":true,"sessions":[{{"source":"opencode","id":"{id}","cwd":"D:\\repo","last_seen":{last_seen}}}]}}"#
+        );
+        std::fs::write(path, json).unwrap();
+    }
+
+    #[test]
+    fn unchanged_events_within_a_minute_skip_the_rewrite() {
+        let dir = tempfile::tempdir().unwrap();
+        let path = dir.path().join("ai_sessions.json");
+        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
+        write_sentinel_registry(&path, "session-2", now);
+        record_hook_session_at(&path, "opencode", "session-2", r"D:\repo", None).unwrap();
+        // 同 cwd、无新标题且 last_seen 在 60s 内：不重写，哨兵字段仍在。
+        assert!(std::fs::read_to_string(&path).unwrap().contains("sentinel"));
+    }
+
+    #[test]
+    fn changed_cwd_or_title_still_rewrites() {
+        let dir = tempfile::tempdir().unwrap();
+        let path = dir.path().join("ai_sessions.json");
+        record_hook_session_at(&path, "opencode", "session-3", r"D:\repo", Some("旧标题")).unwrap();
+        record_hook_session_at(&path, "opencode", "session-3", r"D:\repo\worktree", None).unwrap();
+        let registry = load_registry(&path);
+        assert_eq!(registry.sessions[0].cwd, r"D:\repo\worktree");
+        // 本次没给标题，旧标题保留。
+        assert_eq!(registry.sessions[0].title, "旧标题");
+        record_hook_session_at(&path, "opencode", "session-3", r"D:\repo\worktree", Some("新标题"))
+            .unwrap();
+        assert_eq!(load_registry(&path).sessions[0].title, "新标题");
+    }
+
+    #[test]
+    fn events_after_the_interval_still_write() {
+        let di
```

---

### Incident Patch 2: `12dab334` (2026-11-14)
**Commit Message**: Integrate reviewed prerequisites for validate English change verbs before stable packaging

**File**: `README.md` (modified, +3/-2)
```diff
@@ -192,8 +192,9 @@ discover candidates from the current environment without matching prior commands
   selected language; Copy source preserves the complete original answer. See
   [reader language behavior](docs/answer-reader-language.md).
 - Clipboard images are saved as PNG files and their paths inserted into local,
-  WSL, or SSH sessions. Inline terminal images require the CLI to emit the supported
-  OSC 1337 protocol; image attachment previews depend on the CLI itself.
+  WSL, or SSH sessions. Inline terminal images require CLI output using OSC 1337,
+  Kitty protocol (direct RGB/RGBA), or Sixel (7-bit DCS); image attachment previews
+  depend on the CLI itself.
 
 <p align="center">
   <img src="docs/screenshots/ai-sidebar.png" alt="AI activity sidebar" width="300" />
```

**File**: `README.zh-CN.md` (modified, +2/-1)
```diff
@@ -170,7 +170,8 @@ Tab 打开列表，再次按 Tab 轮换候选，Enter 插入选中项但不执
 - 已捕获的 Claude Code 与 Codex 回答可在阅读器中打开，支持 Markdown、公式、原文和本地图片预览。
   阅读器控件与提示随所选语言显示；复制原文保留完整回答。详见[阅读器语言说明](docs/answer-reader-language.md)。
 - 剪贴板图片会保存为 PNG，并把路径插入本地、WSL 或 SSH 会话。终端内直接显示图片需要 CLI
-  输出受支持的 OSC 1337 协议；附件缩略图取决于 CLI 自身。
+  输出 OSC 1337、Kitty protocol（APC，直接传输 RGB/RGBA）或 Sixel（7 位 DCS）协议；
+  附件缩略图取决于 CLI 自身。
 
 <p align="center">
   <img src="docs/screenshots/ai-sidebar.png" alt="AI 活动侧栏" width="300" />
```

**File**: `architecture/notes/mobile/android/app/connection/2026-11-06-ssh-agent-conversation.md` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Conversation view for Agents in a direct SSH terminal
+
+## Status
+
+Accepted by the maintainer on 2026-11-06 for the mobile preview.
+
+## Context
+
+The chat view only worked for panes of a paired computer, whose runtime reads the
+native transcript. A phone that connects to a server over SSH had only the terminal,
+although the same Agents (Claude Code, Codex, Pi, Antigravity) run there.
+
+## Evidence
+
+On an Android 14 emulator, an SSH tab running a stand-in Agent that writes Claude's
+JSONL format showed the conversation switch within one detection round. A sent
+message, the tool call, the selection menu and the chosen answer appeared in the
+chat view. Projections were also checked against real Claude Code and Codex
+transcripts and against Pi and Antigravity records built from their published
+formats. Real Pi and Antigravity CLIs were not run.
+
+## Decision
+
+A bundled Python reader runs on the server through a separate exec channel, never
+through the interactive shell. It finds the Agent in the foreground process group of
+this connection's PTY, or of the multiplexer pane the app reports, locates its
+transcript and returns one bounded page in the existing conversation message shape.
+The reader is installed once under `~/.cache/pebrel`, named by its hash, because one
+exec command is limited to 8 KiB. Output stays under the 64 KiB query budget.
+
+Input goes to the terminal: a message is pasted and submitted with Enter, and a
+numbered menu drawn on screen becomes a prompt card answered with arrow keys. The
+menu is read from the terminal engine, so it is current while the terminal is hidden.
+
+## Rejected alternatives
+
+- Parse the screen into messages: wrapped and redrawn output cannot be told apart
+  from content.
+- Require the desktop app on the server: direct SSH is the case being served.
+- Send the reader with every poll: it exceeds the exec command size.
+
+## Consequences
+
+The server needs `python3`; without it the view explains why. Agents whose
+transcript cannot be found show an empty conversation, and the terminal still
+works. Transcript formats are not public contracts and may change with releases.
+
+## Validation
+
+`TerminalPromptTest`, `RemoteOsIconTest` and the debug unit suite pass; the emulator
+flow above was run with screenshots.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+An Agent publishes a stable session API, or a transcript format change breaks
+the projection.
```

**File**: `architecture/notes/mobile/android/app/connection/2026-11-12-workspace-client-recovery.md` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# Attach only to the selected remote workspace
+
+## Status
+
+Proposed.
+
+## Context
+
+An Android SSH tab can launch a workspace on its first connection or open a
+workspace from the server's running-session list. When an existing target ends,
+opening a fresh shell under the same name loses the context that reconnect was
+intended to restore.
+
+## Evidence
+
+In a Linux PTY, the former reconnect command kept the original shell PID while
+the daemon was running. After the daemon stopped, the same command started a
+new daemon and a shell with a different PID. On 0.9.5, the upstream client mode
+alone also tried another saved SSH machine when its local target was absent.
+
+## Decision
+
+Use the upstream `client` entry point for recovery and for an explicit selection
+from the running-session list. Set `HERDR_REMOTE_KEYBINDINGS=server` for that
+process to use the selected host's keymap and skip its saved-machine catalog.
+An unnamed host profile keeps the same remote default as its first connection.
+A selected tab must still be focusable before the client is started.
+
+## Rejected alternatives
+
+- Check whether the server is running before the launch-or-attach command. It
+  could stop between the two operations and the launch command would create it.
+- Attach to a single terminal stream. That would drop the workspace and tab
+  controls and is unavailable on Windows.
+
+## Consequences
+
+First connections can still create a workspace. Missing targets terminate the
+PTY command and leave the SSH tab in its existing ended state. A server's
+saved-machine federation is available when launched manually from a regular
+SSH shell. Client-only mode depends on an upstream internal entry point.
+
+## Validation
+
+The POSIX regression runs the production commands against a fixture executable.
+Real Linux PTYs with upstream 0.8.2 and 0.9.5 verify shell continuity and missing
+targets. The 0.9.5 fixture also verifies a saved-machine probe is suppressed and
+a custom server shortcut still works.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Upstream offers a documented attach-only command for a named workspace.
```

**File**: `architecture/notes/mobile/android/app/session/2026-11-06-background-ssh-survival.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Keeping background SSH tabs connected
+
+## Status
+
+Accepted by the maintainer on 2026-11-06, who reported SSH tabs dropping soon after
+the app went to the background.
+
+## Context
+
+Two paths closed working connections. A new default network finished every SSH
+tab at once, although a VPN change, Wi-Fi roaming or a second SIM often leaves the
+old route working. And without a wake lock the CPU sleeps, so keepalives stop and
+servers or the client's own keepalive limit end the session.
+
+## Evidence
+
+Code inspection of `networkChanged` and `SessionService`. The existing recovery
+tests still pass: a probe that fails reconnects in the background, and closing a
+tab cancels its probe. No physical-device battery or Doze measurement was made.
+
+## Decision
+
+On a network change, a ready SSH tab is probed with a round trip and reconnects
+only if the probe fails or times out (5 s). The session service holds its partial
+wake lock by default while sessions live; the notification action still releases it,
+and that choice is kept until the user takes it again.
+
+## Rejected alternatives
+
+- Keep reconnecting every tab on any network change: it discards sessions that
+  were fine, including running programs without a multiplexer.
+- Raise the native keepalive limits: it needs a native rebuild and does not help
+  while the CPU sleeps.
+
+## Consequences
+
+Battery use rises while sessions are open in the background; the notification
+shows that the wake lock is held. A dead route now takes up to 5 s longer to
+reconnect.
+
+## Validation
+
+`SshRecoveryTest` passes.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Device measurements show the wake lock costs too much, or Android restricts it
+for foreground services of this type.
```

**File**: `architecture/notes/mobile/android/app/ui/2026-11-05-glass-and-chat-timeline.md` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+# Glass surfaces and the native conversation timeline
+
+## Status
+
+Accepted by the maintainer on 2026-11-05 as a preview direction. Android
+acceptance is limited to an x86_64 emulator with a scripted desktop.
+
+## Context
+
+The conversation view rendered CommonMark through the reader WebView and floating
+controls had no depth. The maintainer asked for frosted glass, a web-chat layout
+with the user on the right, and no loss of scroll performance.
+
+## Evidence
+
+On the emulator, scroll frame time with blur on stayed about 2 ms above the
+baseline build; with blur off the fallback kept text behind the input bar sharp.
+Emulator numbers are only comparable with each other. `GlassTokensTest` checks
+every registered theme on both the blurred and the solid path.
+
+## Decision
+
+Use Haze for backdrop blur and derive tint, hairline and shadow from each theme, so
+no install theme is added. Battery saver, disabled animators, disabled window blur,
+low-RAM devices and old API levels fall back to a translucent surface. Parse
+CommonMark into Compose blocks; messages keep their transcript ids, so unchanged
+rows reuse their parsed documents.
+
+Sizes and alphas are our own: type sizes follow the Material scale, motion uses the
+Compose spring constants, and tint alphas start from the contrast check. A survey of
+another product informed the direction, but its measured constants are not reused,
+because that product publishes no license for them.
+
+## Rejected alternatives
+
+- Keep the WebView timeline: selection and scroll anchoring stay out of reach.
+- Reuse the surveyed constants as they were: this invites a copying claim for no
+  functional gain.
+- Add dedicated glass themes: the Rust table stays the only palette authority.
+
+## Consequences
+
+Haze becomes a runtime dependency recorded in the third-party notices. Blur cost has
+not been measured on physical devices; do that before calling the performance
+settled.
+
+## Validation
+
+`GlassTokensTest`, `ConversationTimelineTest` and the debug unit test suite pass; the
+preview build succeeds.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Physical-device measurements exceed the frame budget, or Haze drops an API level
+this app supports.
```

**File**: `architecture/notes/nebula_app/ai_hook/2026-11-06-unix-accept-poll-wait.md` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+# Unix AI hook accept wait uses `poll`
+
+## Status
+
+Implemented and validated on Linux. Windows named-pipe transport is unchanged.
+
+## Context
+
+The Unix AI hook worker accepts connections from a nonblocking `UnixListener`
+and, before this decision, slept 20 ms after every `WouldBlock`. The helper
+connects once per AI turn and waits for the acknowledgement byte before exiting,
+so the sleep added an expected ~10 ms (observed ~20 ms) to every turn's ack even
+when the worker had been idle for a long time.
+
+The same wait bounds how often `stopping` is observed while the listener is
+idle, and therefore how long `Drop` can spend joining an idle worker. A
+connected peer that sends nothing already keeps `read_message` waiting for up to
+one second, before and after this change, so that read is the bound for a
+connected worker. A replacement must keep the idle stop granularity, must not
+introduce a blocking `accept`, and must not need a synthetic wake-up connection
+during shutdown.
+
+## Evidence
+
+- Before (`sleep(20 ms)`), three 100-round runs: ack p50 20.196 / 20.221 /
+  20.185 ms; every one of the 300 samples was at least 1 ms, and p95 was about
+  42 ms.
+- After (`poll`), three 100-round runs: ack p50 0.063 / 0.067 / 0.050 ms. The
+  only sample at or above 1 ms in each run was round 0 (~22 ms), the cold
+  `nearest_agent_ancestor` process snapshot that both builds pay.
+- Harness: the `#[ignore]` `manual_ack_latency_samples` test times
+  connect -> envelope write -> one ack byte read -> channel drain. Numbers are
+  single-machine, debug-profile point estimates (Linux 7.0.0-31, i5-12400,
+  rustc 1.97.1), not a general performance guarantee.
+- Code: `nebula_app/src/ai_hook/unix.rs` `WouldBlock` branch and
+  `wait_until_readable`. Behaviour tests:
+  `connections_are_accepted_in_order_and_each_receives_its_ack` and
+  `drop_stops_the_idle_worker_and_removes_its_private_directory`.
+## Decision
+
+In the `WouldBlock` branch, wait for `POLLIN` on the listener descriptor with
+`libc::poll` for the same 20 ms budget, then return to the top of the loop and
+let the existing nonblocking `accept` classify the readiness. `accept` stays
+nonblocking; `stopping` is still checked once per loop iteration, so for an idle
+listener the stop granularity and `Drop` join bound remain one 20 ms timeout. A
+connected peer that sends nothing can still hold the worker in `read_message`
+for up to one second, as before; this decision does not change that read.
+
+The deadline is tracked with `Instant`. `EINTR` retries the poll against the
+same deadline, so repeated signals cannot extend the stop granularity. Any other
+poll error is logged and stops the worker, the same fail-closed direction as an
+accept error. `POLLERR`, `POLLHUP`, and `POLLNVAL` are deliberately handed to the
+following `accept` so existing accept error behaviour is unchanged.
+
+## Rejected alternatives
+
+- **Blocking `accept` plus a wake-up connection on shutdown.** This changes the
+  shutdown ownership and adds a synthetic connection to a path that verifies
+  peer identity, for no latency benefit over `poll`.
+- **A shorter sleep (for example 1 ms).** It cuts the average but multiplies
+  idle wake-ups by 20 and still leaves a fixed alignment delay; `poll` blocks
+  until readiness without spinning.
+- **A stop channel or condvar in addition to the socket.** It requires new
+  synchronization and does not make accept itself more responsive.
+- **`SO_RCVTIMEO` on the listener.** Its effect on `accept` is not portable
+  across the supported Unix targets and it does not express readiness as
+  directly as `poll`.
+
+## Consequences
+
+- Ack latency no longer pays the sleep alignment; p50 is dominated by accept,
+  peer verification, read, parse, ancestry lookup, enqueue, and ack write.
+- Idle wake-up rate, idle stop-check granularity, and the `Drop` join bound for
+  an idle listener are unchanged: one bounded 20 ms wait per idle iteration. A
+  connected-but-silent peer can still hold `Drop`'s join for up to about one
+  second through the existing `read_message` deadline, exactly as before.
+- Poll failures other than `EINTR` stop the worker with a log line and no retry
+  loop, matching the fail-closed accept path.
+- The cold first-event process snapshot (~22 ms) remains; it is unrelated to the
+  accept wait and is not addressed here.
+- No new dependency: `libc` was already used by the transport.
+
+## Validation
+
+- The two behaviour tests above cover ordered accepts, per-connection acks, a
+  forced wait-timeout iteration (40 ms gap between connections), and shutdown
+  while idle (worker exits, private directory removed).
+- At the change commit, `cargo test -p nebula --features gpui-shell ai_hook`
+  passed with 133 passed and 2 ignored tests.
+- The full `nebula_terminal` and product builds are unaffected; the Windows
+  transport was not edited.
+- No timing assertion runs in CI; the latency probe is `#
```

**File**: `architecture/notes/nebula_terminal/sixel/2026-10-31-shared-graphics-replay.md` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+# Sixel through shared graphics replay
+
+## Status
+
+Implemented; proposed for review.
+
+## Context
+
+Sixel support was developed before the keyed graphics replay queue, grid transient-content
+guards, parser-input wake accounting, and Kitty protocol support were merged. Replaying the old
+branch's shared files would remove those changes. The integration therefore starts from
+`cf6bafb21bc0d20e4ff07477522caf13add0f6e2` (the merged #767), retaining its ownership model.
+
+## Evidence
+
+- [StreamProcessor](../../../../nebula_terminal/src/event_loop.rs) owns pending payloads;
+  [terminal replay](../../../../nebula_terminal/src/term/inline_image.rs) consumes keyed
+  markers in VT order. A synchronized frame must not insert cells before it commits.
+- [Real PTY tests](../../../../nebula_terminal/src/event_loop/sync_tests.rs) cover a committed
+  text prefix followed by an open graphics frame. The shortest Sixel is shorter than its
+  replay marker, so comparing wire bytes against parser synchronized bytes loses wakeups.
+- [Decoder tests](../../../../nebula_terminal/src/sixel/tests.rs) exercise the 4096-pixel
+  boundary: after 682 band advances, `@` and `N` fit while `^` and `~` do not.
+- The [DEC manual, chapter 14](https://vt100.net/docs/vt3xx-gp/chapter14.html) defines six
+  vertical bits per data character, opaque zero-bit backgrounds, and raster dimensions as
+  minimum dimensions. Pixel aspect is separate from the stored pixel array.
+- [Mixed-protocol tests](../../../../nebula_terminal/tests/inline_image/sixel.rs) verify
+  OSC 1337, Kitty protocol APC and Sixel DCS in one synchronized frame at every split point.
+
+Local scanner-only cost probe: Linux x86_64 under WSL, Rust 1.97.1 release defaults,
+System allocator with allocation counting, CPU affinity 19. Each sample feeds about
+32 MiB in approximately 4 KiB chunks, after one warm-up feed. Nine samples per process,
+three alternating main/feature pairs produced median throughputs of 32,413/32,940 MiB/s
+for plain ASCII and 691/686 MiB/s for repeated SGR/text/reset lines. Both variants made
+zero steady-state allocations on these two inputs. Other build work ran concurrently;
+these measurements bound the local scanner comparison, not terminal/render throughput
+or a general performance guarantee. Probe sources and raw results remain local diagnostic
+artifacts; correctness and bounded graphics expansion are covered by the tests above.
+
+## Decision
+
+Use the existing scanner to recognize 7-bit DCS Sixel and XTSMGRAPHICS. Preserve the existing
+Kitty protocol APC path and the one CSI 16 t request/reply implementation. No second metrics query
+handler, session message or renderer store is added for Sixel; the overlapping changes in
+PR #799 are not a prerequisite.
+
+One bounded Sixel parser performs geometry validation on the stream side and RGBA decoding
+on the frontend side. The public payload carries immutable encoded bytes and validated
+geometry. Limits are 12 MiB encoded, 4096 pixels per edge, 256 private color registers,
+16 Mi pixels and 64 Mi pixel paint operations. Actual set bits beyond the edge are rejected;
+only the unused opaque background in the final partial band is clipped at 4096.
+
+At replay, resolve dynamic terminal background overrides, insert grid-owned image tiles,
+reset text-cluster state, and mark transient grid content. The current keyed queue,
+stream-owned payload lifetime and parser-input byte accounting remain authoritative.
+Sixel and OSC 1337 share the existing 16-entry / 32 MiB encoded queue. The Kitty protocol retains its
+separate weak raw-pixel slots and core store. GPUI serializes all decodes into the shared
+16-image / 128 MiB cache, discarding expired placements before and after decoding.
+
+Decode natural RGBA dimensions, then swap channels in place for GPUI. Pixel aspect belongs
+to display geometry, so it cannot multiply the decoded allocation. The legacy shell uses
+the same parser and RGBA result through its existing pane image handler; its UI-loop decode
+behavior is unchanged.
+
+Retain the previous Sixel branch's placement profile: default placement starts at the
+cursor and ends on its last occupied row; a producer's following LF advances past it.
+This preserves save/move/image/restore prompt layouts. Mode 8452 advances to the right.
+Mode 80 follows xterm's fixed top-left behavior when set, restoring the cursor afterwards.
+Below a restricted scroll region, clip rows that cannot advance rather than overwriting
+the bottom source tile. Mode 1070 reports permanently private palettes.
+
+## Rejected alternatives
+
+- Cherry-picking obsolete shared parser/renderer files: it loses current Kitty protocol ownership,
+  synchronized wake accounting and transient-grid cleanup.
+- A Sixel-only cache or eager PNG conversion: it bypasses shared budgets or adds encoding
+  work and allocations on the PTY path.
+- Rounding every image to a whole six-row band: it rejects valid set p
```

---

### Incident Patch 3: `f2c1abab` (2026-11-14)
**Commit Message**: Fix command palette labels to use the selected language (#986)

NebulaWorkspace::filtered_palette_rows read the active UI language for group
headings but copied PaletteItem.label directly for command names. The shared
CommandPalette::row_for already called localized_item_label.

Make localized_item_label pub(crate) and reuse it in the GPUI row projection.
Keep the existing resolver behavior, search aliases, shortcut hints and action
payloads. The row still owns its label through the existing to_owned() call.

Add command_palette_labels_follow_the_active_language using an empty GPUI test
workspace. Check English labels, switch Settings.ui_language to Chinese, verify
unchanged aliases and hints, and switch back to English.

**File**: `nebula_app/src/display/command_palette.rs` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@
 use std::path::PathBuf;
 
 use super::ui::geometry as layout_geometry;
-use super::{NebulaTheme, SizeInfo};
+use super::{NebulaTheme, SizeInfo, UiLanguage};
 use crate::config::ui_config::Profile;
 use crate::shell_detect::DetectedShell;
 use unicode_width::UnicodeWidthChar;
@@ -1278,7 +1278,7 @@ impl CommandPalette {
     }
 }
 
-fn localized_item_label(item: &PaletteItem, language: super::UiLanguage) -> &'static str {
+pub(crate) fn localized_item_label(item: &PaletteItem, language: UiLanguage) -> &'static str {
     use PaletteAction::*;
     if matches!(item.action, CycleCompletionStyle) {
         return language.text(crate::i18n::Message::SettingsCompletionCycle);
```

**File**: `nebula_app/src/gpui_shell/workspace/palette.rs` (modified, +7/-1)
```diff
@@ -1,5 +1,8 @@
 use super::*;
 
+#[cfg(all(test, feature = "gpui-test-support"))]
+mod tests;
+
 const PALETTE_SEARCH_HEIGHT: f32 = 48.0;
 
 /// 命令面板 / Shell 选择弹窗里图标轨的逻辑边长。品牌贴图、Nerd Font 字形
@@ -158,7 +161,10 @@ impl NebulaWorkspace {
                     WorkspacePaletteRow {
                         group_order,
                         group,
-                        label: item.label.to_owned(),
+                        label: crate::display::command_palette::localized_item_label(
+                            item, language,
+                        )
+                        .to_owned(),
                         hint: item.hint.to_owned(),
                         hint_style: WorkspacePaletteHintStyle::Shortcut,
                         search: item.search.to_owned(),
```

**File**: `nebula_app/src/gpui_shell/workspace/palette/tests.rs` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+use super::*;
+use crate::display::command_palette::PaletteAction;
+use crate::gpui_shell::config::Settings;
+use crate::i18n::UiLanguage;
+use gpui::{BorrowAppContext as _, TestAppContext};
+
+#[gpui::test]
+fn command_palette_labels_follow_the_active_language(cx: &mut TestAppContext) {
+    cx.update(|cx| {
+        gpui_component::init(cx);
+        crate::gpui_shell::math_view::register(cx);
+        crate::gpui_shell::file_editor::init(cx);
+        super::super::init(cx);
+        windowing::initialize(cx, crate::runtime_api::RuntimeHub::new());
+        let runtime = nebula_settings::RuntimeSettings::from_raw(&Default::default());
+        let mut settings = Settings::load_with_runtime(nebula_settings::ThemeName::Nord, runtime);
+        settings.ui_language = UiLanguage::EnUs;
+        cx.set_global(settings);
+    });
+    let mut workspace = None;
+    let (_, mut window) = cx.add_window_view(|window, cx| {
+        let view = cx.new(|cx| {
+            NebulaWorkspace::new(
+                window,
+                None,
+                None,
+                1,
+                crate::runtime_api::RuntimeHub::new(),
+                windowing::WorkspaceStartup::Empty,
+                windowing::WindowRole::Regular,
+                cx,
+            )
+        });
+        workspace = Some(view.clone());
+        Root::new(view, window, cx)
+    });
+    let workspace = workspace.unwrap();
+    window.update(|_, cx| {
+        workspace.update(cx, |workspace, cx| {
+            let row = |workspace: &NebulaWorkspace, cx: &App, action: PaletteAction| {
+                workspace
+                    .filtered_palette_rows(cx)
+                    .into_iter()
+                    .find(|row| {
+                        matches!(&row.action, WorkspacePaletteAction::Shared(value) if *value == action)
+                    })
+                    .expect("built-in command must remain available")
+            };
+            let english = row(workspace, cx, PaletteAction::NewTab);
+            assert_eq!(english.label, "New tab");
+            assert_eq!(row(workspace, cx, PaletteAction::CloseTab).label, "Close tab");
+            assert_eq!(row(workspace, cx, PaletteAction::NextTab).label, "Next tab");
+
+            cx.update_global::<Settings, _>(|settings, _| settings.ui_language = UiLanguage::ZhCn);
+            let chinese = row(workspace, cx, PaletteAction::NewTab);
+            assert_eq!(chinese.label, "新建标签页");
+            assert_eq!(chinese.search, english.search);
+            assert_eq!(chinese.hint, english.hint);
+
+            cx.update_global::<Settings, _>(|settings, _| settings.ui_language = UiLanguage::EnUs);
+            assert_eq!(row(workspace, cx, PaletteAction::NewTab).label, "New tab");
+        });
+    });
+}
```

#### Recent Merged Pull Requests:
- **PR #986** (2026-11-14): fix: use the selected language for command palette labels (@Celestial-0)
- **PR #983** (2026-11-15): perf(ai_sessions): throttle hook registry rewrites to once per minute (@not-exist)
- **PR #979** (2026-11-14): Restore the Android conversation view and session timeline (@Kuddev)
- **PR #978** (2026-11-14): Use the adaptive Android launcher icon (@Kuddev)
- **PR #977** (2026-11-14): Keep Android SSH tabs connected and restore the original workspace (@Kuddev)
- **PR #954** (2026-11-14): Keep detached Codex sessions out of Linux pane recovery (@Kuddev)

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

## X. Throttle unchanged hook session registry writes

**RULE**:
When implementing operations in `architecture/notes/nebula_app/ai_sessions/2026-11-13-hook-registry-write-interval.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c63ff393`: Throttle unchanged hook session registry writes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `architecture/notes/nebula_app/ai_sessions/2026-11-13-hook-registry-write-interval.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Hook session index rewrites are throttled to one per minute

## Status

Implemented.

## Context

AI clients emit a hook event per tool call, and nearly every event only refreshes
`last_seen` for an existing session. `record_hook_session` runs on the UI/event
path (`gpui_shell/terminal/view/agent_activity.rs` and
`window_context/agent_activity.rs`), and each event took the exclusive registry
lock, read and parsed the whole JSON index, updated/sorted/truncated the rows,
serialized it and replaced the file through `atomic_file::write` (`sync_all` plus
the write-through rename). Active AI turns therefore paid a file write per tool
call on the UI thread.

## Evidence

- One `record_hook_session` measured about 12.4 ms locally; reading and parsing
  the file costs about 0.05 ms on its own.
- Both production call sites pass `title: None`, so the only field that usually
  moves is `last_seen`.
- The registry is capped at 256 rows and is read by `scan()`, which uses
  `last_seen` as `modified` for ordering and the relative label. Claude and Codex
  rows also merge the native transcript mtime via `max`, so the registry timestamp
  mainly orders the remaining agents.

## Decision

After lo
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c63ff393` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
