# Verification Protocol: Verification Protocol: Empirical Defect Shield for kuddev/pebrel

<!-- PROVENANCE_START
{
  "source_repository": "kuddev/pebrel",
  "source_url": "https://github.com/kuddev/pebrel",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kuddev/pebrel](https://github.com/kuddev/pebrel) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `kuddev/pebrel` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `d79d5796`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T18:35:36.501Z  
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
> **Harvest Timestamp**: 2026-11-11T18:35:36.313Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3758 stars

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
- **Issue #924** (2026-11-11): **[Bug] 删除仍在占用的文件时程序崩溃**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  24h2  ### Pebrel version / 版本号  v2.4.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  Not sure / 不确定  ### Program running in the pane / 面板里正在跑的程序  Other / 其他  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Startup crash / hang / cannot exit — 启动崩溃、卡死、无法退出  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤   比如一个db文件正被后端服务占用着，此时通过侧边栏删除该文件直接系统崩溃。  ### Expected behavior / 期望结果  当然是不崩溃，并提醒一下正在被占用  ### Actual behavior / 实际结果  崩溃  ### Logs / screenshots / 日志或截图  <img width="686" height="340" alt="Image" src="https://github.com/user-attachments/assets/aace50eb-a95b-4347-a71c-c0d30799fc6b" />  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

- **Issue #870** (2026-11-07): **[Bug] 文件管理器图标乱码**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  macos 26.0  ### Pebrel version / 版本号  2.4.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  zsh  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  File tree / drag-and-drop upload — 文件树、拖拽上传  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  <img width="425" height="293" alt="Image" src="https://github.com/user-attachments/assets/b79f6e67-9b1c-4eef-a239-ebc55bc004fb" />  ### Expected behavior / 期望结果  图标显示  ### Actual behavior / 实际结果  无  ### Logs / screenshots / 日志或截图  无  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息

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

### Incident Patch 1: `1fe45e0d` (2026-11-11)
**Commit Message**: Merge pull request #946 from Kuddev/merge/reviewed-bugs-936-945-20261111

fix: integrate reviewed rendering, workspace and hook regressions

**File**: `architecture/notes/nebula_app/ai_hook/2026-11-11-detached-claude-session-end.md` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+# Deliver detached Claude SessionEnd to its verified Linux terminal
+
+## Status
+
+Proposed for review with implementation.
+
+## Context
+
+Issue #434 reports a WSL zsh pane retaining its Claude identity after a double
+Ctrl+C exit. Closing and reopening Pebrel then resumes an already exited CLI.
+The shared pane lifecycle clears the saved identity on SessionEnd or OSC 133;D,
+but either signal must first reach the pane.
+
+## Evidence
+
+A real zsh PTY running Claude Code 2.1.310 invoked both SessionStart and SessionEnd
+hooks. Claude detached each hook from its controlling terminal. The bridge
+returned authenticated OSC frames in terminalSequence JSON in both cases.
+Claude relayed SessionStart to the terminal, but discarded SessionEnd during
+both double Ctrl+C and /exit.
+
+The shared zsh integration still emitted OSC 133;D. Starting the same zsh without
+that integration demonstrated the missing second exit signal. These observations
+come from Linux ARM64; the reported Windows 11 WSL desktop path remains to be
+verified.
+
+## Decision
+
+For a Claude SessionEnd whose hook has no controlling terminal, recover the
+verified ancestor CLI's Linux devpts terminal from its stdin descriptor. Require
+the process epoch, foreground process group, controlling device, descriptor
+identity and device ownership to match before writing. Open without following
+symlinks or acquiring a controlling terminal.
+
+Reuse the existing bounded OSC write and pane token. When verification fails,
+retain the terminalSequence response. Existing controlling-terminal and tmux
+routes keep their delivery rules. Other hook events keep their existing path.
+The application continues to use its shared SessionEnd lifecycle and session-save
+logic.
+
+## Rejected alternatives
+
+- Clear state on Ctrl+C: interruption can stop one turn while leaving Claude open.
+- Rely only on a matching shell prompt: guest shell integration and prompt
+  recognition can be unavailable.
+- Scan every terminal or use a PID supplied in hook JSON: neither establishes the
+  owning terminal.
+- Return more SessionEnd JSON: the real CLI does not relay this response on exit.
+- Add a background relay: the current short-lived hook can deliver the event.
+
+## Consequences
+
+The additional procfs reads and device open occur only on detached Claude exit.
+There is no new persisted route, token, worker or setting. Linux devpts is the
+supported recovery path; other hosts retain their existing transport.
+
+## Validation
+
+- The real-PTY regression fails before the change and passes after it. A detached
+  hook reaches its foreground Claude ancestor, while redirected stdin and a
+  background process group retain the JSON fallback.
+- The remote-hook Python suite covers authenticated delivery, partial writes,
+  detached JSON responses, native hooks and configuration preservation.
+- Real Claude Code 2.1.310 delivers SessionStart and SessionEnd with the same
+  process identity after the change: double Ctrl+C with and without zsh
+  integration, and /exit with integration.
+- The GPUI regression checks that a WSL SessionEnd without shell markers removes
+  the foreground and saved recovery identities before window close.
+
+## Supersedes
+
+None. Extends the [WSL hook transport](../platform/wsl_hooks/2026-09-20-wsl-hook-transport.md).
+
+## Revisit when
+
+Claude relays terminalSequence during SessionEnd, or supplies an authenticated
+terminal endpoint for detached hooks.
```

**File**: `architecture/notes/nebula_app/display/file_operations/2026-11-11-recycle-bin-reentrancy.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Recycle-bin operations outside the GPUI update
+
+## Status
+
+Proposed in the fix for issue #924.
+
+## Context
+
+The file-tree confirmation invoked `SHFileOperationW` synchronously inside a
+workspace update. The Windows Shell can pump messages while handling a locked
+file, re-entering GPUI while its application `RefCell` is already borrowed.
+
+## Evidence
+
+[Issue #924](https://github.com/Kuddev/pebrel/issues/924) reports deleting a database
+held open by a service. Its screenshot identifies `gpui/src/app/async_context.rs`
+at `AsyncApp::update`, with `RefCell already borrowed`. The confirmation callback
+held the workspace update across the native operation.
+
+## Decision
+
+Dispatch the synchronous file operation through the existing background executor.
+The task owns the requested path; only its result returns to the foreground.
+Use the existing weak workspace handle so closing the window prevents a late
+result from updating a destroyed view. Refresh the tree after success and retain
+the existing localized failure notice on error.
+
+Initialize and uninitialize the worker's COM apartment around the synchronous
+Windows Shell call. Balance both successful COM initialization return codes;
+report initialization failure before invoking the Shell.
+
+## Rejected alternatives
+
+- A foreground async task still executes the native call on the UI thread and
+  permits its nested message loop to re-enter GPUI.
+- Catching a panic leaves the reentrant borrow and UI blockage in place.
+- Permanently deleting the file would change the Windows recycle-bin contract.
+
+## Consequences
+
+The confirmation closes while the operation runs. A confirmed deletion finishes
+even if the workspace closes; its result is then discarded. The native call is
+synchronous within one worker poll, keeping COM initialization on one thread.
+Sharing and lock violations use the operating system's error text.
+
+## Validation
+
+The Windows regression holds a real file with sharing disabled, runs the recycle
+operation on a fresh worker, and checks the error and retained file contents.
+Native GPUI message-loop acceptance is tracked in the PR's validation record.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The shared native file-operation adapter gains a cancellable asynchronous API.
```

**File**: `architecture/notes/nebula_app/gpui_shell/file_editor/2026-11-11-markdown-reload-snapshot.md` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+# Markdown ranges belong to the loaded snapshot
+
+## Status
+
+Implemented for document reloads.
+
+## Context
+
+Reopening a Markdown file starts an asynchronous read. The old outline and
+live edit used to survive after the source input was cleared, so a frame
+between the two load stages could slice the empty buffer with old byte ranges.
+
+## Evidence
+
+Ropey 2.0.0-beta.1 calls `is_char_boundary` before its bounds check in
+`try_slice`. Slicing an empty rope at the old paragraph's range panics at
+`rope.rs:694:22`, matching the later panics reported in #911. A range ending
+inside a multibyte character returns `NonCharBoundary` in the same probe.
+The first string-slicing panic in #911 has not been attributed.
+
+## Decision
+
+Discard the old outline and edit sessions before clearing the source. Keep the
+scroll position separately and apply it when the new input and outline are
+installed together. Range readers check bounds before calling Ropey.
+
+## Rejected alternatives
+
+Bounds checks alone would still leave old actions and ranges active while the
+source is unavailable. Rechecking the file's modification time would not
+prevent a frame from using those ranges during a reload.
+
+## Consequences
+
+The loading frame has no document rows. A successful load restores the prior
+reading position within the new document; a failed read leaves no old ranges
+active.
+
+## Validation
+
+`reloading_rewritten_markdown_replaces_the_visible_snapshot` draws before
+the reload completes and after a shorter UTF-8 snapshot is installed. A
+standalone probe exercises the slice guard with the locked Ropey version.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+Remove the explicit Ropey bounds workaround when the pinned version guarantees
+that `try_slice` handles out-of-bounds offsets without panicking.
```

**File**: `architecture/notes/nebula_app/gpui_shell/workspace/2026-10-03-ordinary-window-geometry.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # Ordinary-window startup geometry
 
+Superseded for Windows directory-launch size by [Directory launches retain their normal window size](windowing/2026-11-11-directory-launch-window-size.md).
+
 ## Status
 
 Proposed for review.
```

**File**: `architecture/notes/nebula_app/gpui_shell/workspace/windowing/2026-11-11-directory-launch-window-size.md` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+# Directory launches retain their normal window size
+
+## Status
+
+Proposed for [#922](https://github.com/Kuddev/pebrel/issues/922).
+
+## Context
+
+Explorer opens Pebrel with an explicit working directory. A new regular window
+should use the last normal size and open a terminal in that directory.
+
+## Evidence
+
+Both cold startup and the resident runtime fallback choose
+`WorkspaceStartup::NewTerminal` for this request. The geometry loader accepted
+only `RestoreOrDefault`, so the first window in either path used the default
+grid. A resident process allocates a new window ID after the last window closes.
+
+## Decision
+
+When an explicit directory opens the only regular window on Windows, load the
+saved normal width and height through the existing session geometry reader.
+Scope the values to the allocated window ID, which also tells the workspace to
+size its initial terminal grid from the window. Explicit grid configuration
+still takes precedence. An isolated process cannot use ordinary geometry.
+
+## Rejected alternatives
+
+- Use `RestoreOrDefault` for Explorer launches: restoring old tabs can override
+  the requested directory and start programs the user did not ask to reopen.
+- Extend the first-window ID check: that ID is already consumed when a
+  resident process creates a replacement window.
+- Persist another size setting: the ordinary session snapshot already stores
+  the normal bounds at close.
+
+## Consequences
+
+Directory launches restore size while using ordinary placement for a new
+window. Opening a second regular window retains the existing defaults.
+
+## Validation
+
+`directory_launch_uses_saved_size_without_restoring_the_old_window` exercises
+both startup constructors, the geometry loader, and window options with a
+saved maximized rectangle. The existing explicit-grid regression covers
+configured dimensions.
+
+## Supersedes
+
+The Windows directory-launch eligibility rule in
+[Ordinary-window startup geometry](../2026-10-03-ordinary-window-geometry.md).
+
+## Revisit when
+
+Regular geometry has a persistence owner independent of the session snapshot.
```

**File**: `nebula_app/AGENTS.md` (modified, +2/-0)
```diff
@@ -5,6 +5,7 @@
 - GLSL/WGSL 源码转换、Luau shader 参数与帧 ABI 边界见 [`shader_source`](../architecture/notes/nebula_app/gpui_shell/shader_source/)。
 - `src/gpui_shell` 负责 GPUI 呈现、命令和订阅。交互改动必须覆盖默认、hover、pressed、键盘焦点、disabled/loading 以及成功/失败中实际需要的状态。
 - 首帧窗口尺寸、非阻塞 logo 准备与原生呈现顺序的因果记录见 [`workspace`](../architecture/notes/nebula_app/gpui_shell/workspace/)。
+- Windows 指定目录启动时的窗口尺寸恢复见 [`startup geometry`](../architecture/notes/nebula_app/gpui_shell/workspace/windowing/2026-11-11-directory-launch-window-size.md)。
 - 本地启动失败的诊断保留与显式 Shell 选择见 [`terminal/view`](../architecture/notes/nebula_app/gpui_shell/terminal/view/2026-10-24-failed-local-session-retention.md)。
 - 独立本地草稿写入的 canonical target 并发合同见 [`file_editor writers`](../architecture/notes/nebula_app/gpui_shell/file_editor/2026-10-11-canonical-target-writers.md)。
 - GPUI 图片解码帧与 zoom/pan 几何一致性见 [`doc_tabs`](../architecture/notes/nebula_app/gpui_shell/doc_tabs/)。
@@ -18,6 +19,7 @@
 - 只有跨层所有权、持久化、协议、线程/生命周期或重要性能取舍才写 note，路径镜像到 `architecture/notes/nebula_app/<capability>/`。
 - Agent 集成、改键输入与 SSH 认证的因果记录分别位于 [`ai_hook`](../architecture/notes/nebula_app/ai_hook/)、[`input`](../architecture/notes/nebula_app/input/) 和 [`ssh_session`](../architecture/notes/nebula_app/ssh_session/)。
 - Windows PowerShell 剪贴板粘贴与当前编辑器能力的边界见 [`terminal/view`](../architecture/notes/nebula_app/gpui_shell/terminal/view/)。
+- Windows 回收站调用的消息重入与后台 COM 生命周期见 [`file_operations`](../architecture/notes/nebula_app/display/file_operations/2026-11-11-recycle-bin-reentrancy.md)。
 - Runtime 地址发现与隔离实例的生命周期边界见 [`runtime_api`](../architecture/notes/nebula_app/runtime_api/)。
 - 补齐数据源选择和请求快照归 `completion.rs`，界面仅拥有任务与交互；边界依据见 [`completion`](../architecture/notes/nebula_app/completion/)。
 - 旧渲染入口的窗口动画状态归 `display/animations.rs`；迁移及显式 legacy 验证依据见 [`display`](../architecture/notes/nebula_app/display/)。
```

**File**: `nebula_app/res/hooks/remote_bridge.py` (modified, +40/-8)
```diff
@@ -161,20 +161,52 @@ def send(source, native, mode, payload, token, owner=None, route=None, deadline=
         if len(envelope) > MAX_ENVELOPE:
             return
         osc = b"\x1b]777;nebula-hook;" + token.encode() + b";" + base64.b64encode(envelope) + b"\x07"
-        write_terminal(osc, source, route, deadline)
+        exit_owner = owner if source == "claude" and payload.get("hook_event_name") == "SessionEnd" else None
+        write_terminal(osc, source, route, deadline, exit_owner=exit_owner)
 
 
-def write_terminal(osc, source=None, route=None, deadline=None):
+def open_claude_exit_terminal(owner, flags):
+    """A detached SessionEnd can still reach Claude's verified Linux terminal."""
+    if sys.platform != "linux" or not owner:
+        return None
+    pid, _, epoch = owner.partition(":")
+    proc = Path("/proc") / pid
+    stdin = proc / "fd/0"
     try:
-        fd = os.open(route["tty"] if route else "/dev/tty",
-                     os.O_WRONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
+        tty = stdin.readlink()
+        if not re.fullmatch(r"/dev/pts/[0-9]+", str(tty)):
+            return None
+        fd = os.open(tty, flags | os.O_NOCTTY)
+    except OSError:
+        return None
+    try:
+        info = os.fstat(fd)
+        raw = (proc / "stat").read_text(encoding="utf-8")
+        fields = raw[raw.rfind(")") + 2:].split()
+        if (stat.S_ISCHR(info.st_mode) and info.st_uid == os.geteuid()
+                and fields[19] == epoch and int(fields[2]) > 0 and fields[2] == fields[5]
+                and info.st_rdev == (int(fields[4]) & 0xffffffff)
+                and os.path.samestat(info, stdin.stat())):
+            return fd
+    except (OSError, ValueError, IndexError):
+        pass
+    os.close(fd)
+    return None
+
+
+def write_terminal(osc, source=None, route=None, deadline=None, *, exit_owner=None):
+    flags = os.O_WRONLY | os.O_NONBLOCK | os.O_NOFOLLOW
+    try:
+        fd = os.open(route["tty"] if route else "/dev/tty", flags)
     except OSError as error:
         if route or source != "claude" or error.errno != errno.ENXIO:
             raise
-        # Interactive Claude consumes hook JSON even when its hook has no TTY.
-        # This fallback is only possible before any part of the OSC was written.
-        print(json.dumps({"terminalSequence": osc.decode("ascii")}), flush=True)
-        return
+        fd = open_claude_exit_terminal(exit_owner, flags)
+        if fd is None:
+            # Interactive Claude consumes terminalSequence for other hooks but
+            # does not relay it during SessionEnd.
+            print(json.dumps({"terminalSequence": osc.decode("ascii")}), flush=True)
+            return
     offset = 0
     deadline = min(deadline or float("inf"), time.monotonic() + 0.5)
     try:
```

**File**: `nebula_app/src/display/file_operations.rs` (modified, +35/-0)
```diff
@@ -4,6 +4,9 @@
 pub(crate) fn send_to_recycle_bin(path: &std::path::Path) -> Result<(), String> {
     use std::os::windows::ffi::OsStrExt;
 
+    use windows_sys::Win32::System::Com::{
+        COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE, CoInitializeEx, CoUninitialize,
+    };
     use windows_sys::Win32::UI::Shell::{
         FO_DELETE, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI, FOF_SILENT, SHFILEOPSTRUCTW,
         SHFileOperationW,
@@ -25,14 +28,46 @@ pub(crate) fn send_to_recycle_bin(path: &std::path::Path) -> Result<(), String>
         hNameMappings: std::ptr::null_mut(),
         lpszProgressTitle: std::ptr::null(),
     };
+    // Background executor threads do not inherit the UI thread's COM apartment.
+    // Keep initialization and the synchronous Shell operation on this thread.
+    let initialized = unsafe {
+        CoInitializeEx(std::ptr::null(), (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32)
+    };
+    if initialized < 0 {
+        return Err(format!("COM initialization failed (HRESULT {initialized:#010x})"));
+    }
     let code = unsafe { SHFileOperationW(&mut operation) };
+    // Both S_OK and S_FALSE acquire an initialization reference.
+    unsafe { CoUninitialize() };
     if code == 0 && operation.fAnyOperationsAborted == 0 {
         Ok(())
+    } else if matches!(code, 32 | 33) {
+        Err(std::io::Error::from_raw_os_error(code).to_string())
     } else {
         Err(format!("\u{7cfb}\u{7edf}\u{62d2}\u{7edd}\u{ff08}\u{4ee3}\u{7801} {code}\u{ff09}"))
     }
 }
 
+#[cfg(all(test, windows))]
+mod tests {
+    use super::*;
+    use std::os::windows::fs::OpenOptionsExt;
+
+    #[test]
+    fn recycling_a_locked_file_on_a_worker_returns_an_error_and_keeps_the_file() {
+        let directory = tempfile::tempdir().unwrap();
+        let path = directory.path().join("locked.db");
+        std::fs::write(&path, b"in use").unwrap();
+        let locked = std::fs::OpenOptions::new().read(true).share_mode(0).open(&path).unwrap();
+        let worker_path = path.clone();
+        let result = std::thread::spawn(move || send_to_recycle_bin(&worker_path)).join().unwrap();
+        assert!(result.is_err(), "a locked file must report a deletion failure");
+        assert!(path.exists());
+        drop(locked);
+        assert_eq!(std::fs::read(&path).unwrap(), b"in use");
+    }
+}
+
 #[cfg(not(windows))]
 pub(crate) fn send_to_recycle_bin(path: &std::path::Path) -> Result<(), String> {
     let result =
```

---

### Incident Patch 2: `d79d5796` (2026-11-11)
**Commit Message**: Merge pull request #948 from Kuddev/fix/settings-card-palette-20261111

Use theme palettes for grouped settings cards

**File**: `nebula_app/src/gpui_shell/network_settings.rs` (modified, +5/-4)
```diff
@@ -176,9 +176,9 @@ impl SettingsPane {
     pub(super) fn section_network(&mut self, cx: &mut Context<Self>) -> gpui::Div {
         let custom = shows_manual_proxy_address(self.runtime.ssh_proxy_mode);
         let language = crate::gpui_shell::config::ui_language(cx);
-        self.group(language.tr("settings.network.title"), cx)
-            .child(self.proxy_test_banner(cx))
-            .child(div().h(px(PROXY_TEST_GAP)).w_full().flex_shrink_0())
+        // 连通性检测是页面级状态，放在卡片之上；卡内只放设置行。
+        let settings = self
+            .group(language.tr("settings.network.title"), cx)
             .child(self.proxy_mode_row(cx))
             .when(custom, |page| page.child(self.proxy_address_row(cx)))
             .child(self.switch_row(
@@ -187,7 +187,8 @@ impl SettingsPane {
                 language.text(crate::i18n::Message::SettingsNetworkTerminalDescription),
                 self.runtime.terminal_proxy,
                 cx,
-            ))
+            ));
+        v_flex().w_full().gap(px(PROXY_TEST_GAP)).child(self.proxy_test_banner(cx)).child(settings)
     }
 
     fn proxy_test_banner(&self, cx: &mut Context<Self>) -> gpui::Div {
```

**File**: `nebula_app/src/gpui_shell/settings_pane.rs` (modified, +27/-43)
```diff
@@ -900,9 +900,9 @@ impl SettingsPane {
                     cx,
                 )
                 .into_any_element(),
-            None => self
-                .row_shell(label, desc.into(), None, false, layout, control, cx)
-                .into_any_element(),
+            None => {
+                self.row_shell(label, desc.into(), None, layout, control, cx).into_any_element()
+            },
         }
     }
 
@@ -1433,7 +1433,8 @@ impl SettingsPane {
         // 平台没实现的开关整行不画：开着却没效果比没有更糟（见
         // `platform::capabilities` 的说明）。
         let caps = crate::platform::CAPABILITIES;
-        self.group(language.pick("会话生命周期", "Session lifecycle"), cx)
+        let lifecycle = self
+            .group(language.pick("会话生命周期", "Session lifecycle"), cx)
             .when(caps.launch_at_login, |group| {
                 group.child(self.switch_row(
                     "launch_at_login",
@@ -1486,7 +1487,8 @@ impl SettingsPane {
                     self.runtime.tray,
                     cx,
                 ))
-            })
+            });
+        v_flex().w_full().child(lifecycle)
     }
 
     fn section_content(&mut self, window: &mut Window, cx: &mut Context<Self>) -> gpui::AnyElement {
@@ -1655,6 +1657,8 @@ impl Render for SettingsPane {
         let provider_drawer = self.provider_drawer(window, cx);
         let application_page = self.active_section == 0;
         let mobile_page = self.active_section == MOBILE_SECTION;
+        let form_page = matches!(self.active_section, 1 | 2 | 5 | 6 | 8);
+        let has_cards = form_page || mobile_page || self.active_section == 9;
 
         div()
             .size_full()
@@ -1704,57 +1708,37 @@ impl Render for SettingsPane {
                     .flex_1()
                     .min_w_0()
                     .h_full()
+                    .when(has_cards, |pane| pane.bg(crate::gpui_shell::theme::settings_canvas_tint(cx)))
                     .child(
                         v_flex()
                             .flex_1()
                             .min_h_0()
-                            .px_5()
-                            // 内容与页头线之间的一口气。分组之间的 24 由各
-                            // section 容器的 `gap` 提供，不放在这里，也不放在
-                            // 组自己身上——组自带 `pt` 时，首个元素不是分组的
-                            // 页（按键映射开头是搜索框）就会直接贴到线上。
-                            .pt(px(20.0))
-                            .pb(px(22.0))
-                            .when(!application_page, |content| content.pt(px(28.0)).pb(px(30.0)))
-                            .when(mobile_page, |content| content.p_0())
-                            .when(self.active_section == 3, |content| content.p_0())
-                            // 注意这层包装 `v_flex` 的 `w_full` 不能删（2026-08-23
-                            // 又栽了一次）：`overflow_y_scrollbar` 把内容层清成
-                            // `Display::Block`，而 flex 容器在 block 父里
-                            // `width:auto` 是 shrink-to-fit——不写 `w_full` 就退回
-                            // 按内容取宽，每行各算一个宽度。判据是"窗口拖宽拖窄
-                            // 都齐、卡在中间某个宽度不齐"：内容自然宽超过可用宽
-                            // 时被压住反而对齐，没超过就各取各的。
-                            //
-                            // 不设行宽上限：内容跟着窗口延伸。标签与值离得
-                            // 太远的问题由控件列定宽 + 右对齐解决（见
-                            // design::CTRL_COL_W），不靠把整页钉窄。
-                            // 正文继承设置根的统一主字号；只有说明、徽标、
-                            // 快捷键提示等次级信息在各自元素上显式缩小。
+                            .when(!form_page, |content| {
+                                content.px_5().pt(px(20.0)).pb(px(22.0))
+                            })
+                            .when(!form_page && !application_page, |content| {
+                                content.pt(px(28.0)).pb(px(30.0))
+                            })
+                            .when(mobile_page || self.active_section == 3, |content| content.p_0())
                             .overflow_y_scrollbar()
-                            // 这层 v_flex 不能省。`overflow_y_scrollbar` 不是
-                            // 就地加滚动条：它把本容器的样式 clone 到自己新建
-                            // 的外层 div，再把这层样式清空、只补 flex_1（见
-                            // gpui-component scroll/scrollable.rs）。于是真正
-                            // 承载正文的那层退回 gpui 默认的 Display::Block，
-                            // 各分组的 `w_full` 不再撑满，而是各自按内容取宽：
-                            // 2026-08-17 A/B 实测，去掉这层后预览组右缘停在
-                            // 1356 而主题组到 1762，一组一个宽度，控件既不贴左
-                            // 也不贴右。补一层竖向 flex 后分组走交叉轴 stretch
-                            // 取宽，症状消失。
-                            //
-                            // 行宽上限：控件贴的是这个上限的右边，不是窗口的右
-                            // 边。没有它时标签在最左、值在最右，1080px 宽的窗口
-                            // 里眼睛要横跨一整屏才能把"这一项"和"它现在是什么"
-                            // 配上，扫到第三行就串行。窗口再宽只是两侧留白变多。
+                            // Scrollable wraps the content in a block; the full-width flex
+                            // column keeps cards aligned when the windo
```

**File**: `nebula_app/src/gpui_shell/settings_pane/appearance.rs` (modified, +2/-2)
```diff
@@ -219,8 +219,8 @@ impl SettingsPane {
         let theme = self.appearance_trigger(true, window, cx);
         let icon = self.appearance_trigger(false, window, cx);
         // 与开关、字体等设置共用行原语，字号、字重和说明缩放只维护一份。
-        let selectors = v_flex()
-            .w_full()
+        let selectors = self
+            .group(language.text(crate::i18n::Message::CommonTheme), cx)
             .child(self.row(
                 language.text(crate::i18n::Message::CommonTheme),
                 language.text(crate::i18n::Message::SettingsAppearanceOnePaletteForTheTerminal),
```

**File**: `nebula_app/src/gpui_shell/settings_pane/backup/view.rs` (modified, +38/-61)
```diff
@@ -1,8 +1,8 @@
 //! 原型的阅读顺序：状态 → 存储 → 时间线；低频操作放在面板下面。
 use super::*;
 
-pub(super) fn panel(_cx: &App) -> gpui::Div {
-    v_flex().w_full().min_w_0().flex_shrink_0().overflow_hidden()
+pub(super) fn panel(cx: &App) -> gpui::Div {
+    super::super::design::settings_card(cx).flex_shrink_0().overflow_hidden()
 }
 
 pub(super) fn caption(text: impl Into<SharedString>, cx: &App) -> gpui::Div {
@@ -57,7 +57,7 @@ impl SettingsPane {
             .w_full()
             .flex_shrink_0()
             .max_w(px(700.0))
-            .gap(px(48.0))
+            .gap(px(super::super::design::GROUP_GAP))
             .text_size(px(14.0))
             .child(
                 v_flex()
@@ -376,21 +376,13 @@ impl SettingsPane {
     fn backup_encryption_row(&self, cx: &mut Context<Self>) -> gpui::Div {
         let l = crate::gpui_shell::config::ui_language(cx);
         let ready = cx.try_global::<BackupPassword>().is_some_and(|p| p.0.is_some());
-        v_flex()
-            .debug_selector(|| "backup-encryption".into())
-            .w_full()
-            .flex_shrink_0()
-            .gap(px(20.0))
-            .child(super::super::design::group_heading(
-                l.text(Message::BackupFlowEncryption),
-                14.0,
-                cx,
-            ))
-            .child(
+        v_flex().debug_selector(|| "backup-encryption".into()).w_full().flex_shrink_0().child(
+            self.group(l.text(Message::BackupFlowEncryption), cx).child(
                 v_flex()
                     .w_full()
                     .flex_shrink_0()
                     .gap_2()
+                    .px(px(super::super::design::CARD_PAD_X))
                     .py(px(self.row_padding_y()))
                     .child(
                         h_flex()
@@ -445,57 +437,42 @@ impl SettingsPane {
                         caption(l.text(Message::BackupFlowPasswordHint), cx)
                             .debug_selector(|| "backup-password-description".into())
                             .w_full()
-                            .max_w(px(560.0))
                             .flex_shrink_0(),
                     ),
-            )
+            ),
+        )
     }
 
-    fn backup_file_rows(&self, cx: &mut Context<Self>) -> gpui::Div {
+    fn backup_file_rows(&self, cx: &mut Context<Self>) -> super::super::design::SettingsGroup {
         let l = crate::gpui_shell::config::ui_language(cx);
-        v_flex()
-            .gap(px(20.0))
-            .child(super::super::design::group_heading(l.text(Message::BackupFlowFiles), 14.0, cx))
-            .children(
-                [
-                    (true, Message::CloudExport, Message::BackupFlowExportHint),
-                    (false, Message::CloudImport, Message::BackupFlowImportHint),
-                ]
-                .into_iter()
-                .map(|(export, title, hint)| {
-                    h_flex()
-                        .gap_4()
-                        .items_center()
-                        .flex_wrap()
-                        .py(px(self.row_padding_y()))
-                        .child(
-                            v_flex()
-                                .flex_1()
-                                .min_w(px(180.0))
-                                .gap_1()
-                                .child(l.text(title))
-                                .child(caption(l.text(hint), cx)),
-                        )
-                        .child(
-                            Button::new(if export { "backup-export" } else { "backup-import" })
-                                .map(|button| {
-                                    crate::gpui_shell::widgets::settings_button(button, true, cx)
-                                })
-                                .label(l.text(if export {
-                                    Message::CloudExport
-                                } else {
-                                    Message::BackupFlowChooseFile
-                                }))
-                                .disabled(self.backup_busy)
-                                .on_click(cx.listener(move |this, _, window, cx| {
-                                    if export {
-                                        this.open_backup_sheet(BackupSheet::Export, window, cx);
-                                    } else {
-                                        this.restore_backup(window, cx);
-                                    }
-                                })),
-                        )
-                }),
-            )
+        self.group(l.text(Message::BackupFlowFiles), cx).children(
+            [
+                (true, Message::CloudExport, Message::BackupFlowExportHint),
+                (false, Message::CloudImport, Message::BackupFlowImportHint),
+            ]
+            .into_iter()
+            .map(|(export, title, hint)| {
+                self.row(
+                    l.text(title),
+                    l.text(hint),
+                    Butto
```

**File**: `nebula_app/src/gpui_shell/settings_pane/design.rs` (modified, +110/-95)
```diff
@@ -1,12 +1,10 @@
 //! 设置页的设计 token 与行原语。
 //!
-//! 分组标题使用更大、加粗的主文本；设置项名称和说明留在左列，控件在右列
-//! 垂直居中。标准密度沿用原紧凑间距，紧凑档只再微收；字号、命中区域和窗口
-//! 标题栏不随内容密度缩小。分组通过留白表达，不添加标题下横线。
+//! 每组设置使用一张卡片，标题在卡外，组内分隔线与行内容对齐。
+//! 窄窗中的控件可以换行；内容密度只调整留白，不改变字号和命中区域。
 
-use std::time::Duration;
-
-use gpui::{Animation, AnimationExt as _, ElementId, FontWeight, ease_out_quint, relative};
+use gpui::FontWeight;
+use gpui_component::button::ButtonCustomVariant;
 
 use super::*;
 
@@ -15,24 +13,26 @@ use super::*;
 pub(super) const DESC_SCALE: f32 = 0.82;
 /// Parent headings stay above item labels in the visual hierarchy.
 const GROUP_TITLE_SCALE: f32 = 16.0 / 14.0;
+/// 卡外分组标题比卡内条目略小、更淡：卡片本身已经说明了“这是一组”。
+const CARD_TITLE_SCALE: f32 = 12.5 / 14.0;
+const CARD_RADIUS: f32 = 10.0;
+/// 卡内行的左右留白，同时是行间细线的内缩量。
+pub(super) const CARD_PAD_X: f32 = 16.0;
 /// label ↔ 说明。这 4px 在说"这两行是同一件事"。
 const LABEL_DESC_GAP: f32 = 4.0;
 /// 标准密度沿用原紧凑档的行留白；间距只由行内 padding 提供。
 const ROW_PAD_Y: f32 = 12.0;
 /// 紧凑档只再收紧少量留白，字号与控件命中区域保持不变。
 const ROW_PAD_Y_COMPACT: f32 = 10.0;
 /// 组与组。
-pub(super) const GROUP_GAP: f32 = 48.0;
-/// 轨道宽度。
-const RAIL_W: f32 = 2.0;
-/// 内容相对轨道的缩进。标题左对齐轨道本身、行内容缩进这么多——标题是命名者
-/// 而不是组员，这个位置差比任何字重都更能表达层级。
-pub(super) const RAIL_INDENT: f32 = 13.0;
+pub(super) const GROUP_GAP: f32 = 28.0;
+pub(super) const CONTENT_MAX_WIDTH: f32 = 960.0;
+pub(super) const CONTENT_PAD_X: f32 = 32.0;
+pub(super) const CONTENT_PAD_TOP: f32 = 36.0;
+pub(super) const CONTENT_PAD_BOTTOM: f32 = 64.0;
 /// 控件列宽。够放下最宽的下拉（220）加一点余量；开关这类窄控件在列内右对齐，
 /// 右缘与下拉保持一致。文字列允许收缩换行，避免窄窗口被旧的 320px 下限撑宽。
 const CTRL_COL_W: f32 = 232.0;
-/// 脏值段升起的时长。
-const MARK_RISE: Duration = Duration::from_millis(260);
 
 #[derive(Clone, Copy)]
 pub(super) enum RowLayout {
@@ -62,30 +62,13 @@ impl SettingsPane {
         }
     }
 
-    /// 一组设置的开头：标题出线。轨道不在这里画——它由组内每一行自己接续，
-    /// 这样才能做到"同一条线，某几段是亮的"。
-    pub(crate) fn group(&self, title: &'static str, cx: &Context<Self>) -> gpui::Div {
-        let base_px = self.font_size_px(cx);
-        // 组间距归 section 容器的 `gap`（HTML 原型里就是 `.a-main` 自己
-        // `gap:24`），组不自带 `pt`：自带的话，首个元素不是分组的页会拿不到
-        // 那段留白而直接贴住页头线，而首组又会拿到"正文上留白 + 组上留白"的
-        // 双份。间距是**容器**的事，不是组的事。
-        // 这里**不能**写 `w_full()`。`width:100%` 依赖父的已解析宽度，链条上
-        // 任何一层是 auto / max-content，100% 就解析成内容宽——于是每个分组、
-        // 每一行各按自己的文字长度取宽，控件右缘参差不齐（宽窗口下差到 280px，
-        // 窄窗口反而齐，因为那时被可用宽度压住了）。
-        //
-        // 不设宽度则走 flex 交叉轴 stretch：布局算法直接拉伸，不依赖父宽解析。
-        v_flex().w_full().child(group_heading(title, base_px, cx).pb(px(20.0)))
+    /// 一组设置：标题在卡外，行在卡内。返回的构建器照常 `.child(row)`。
+    pub(crate) fn group(&self, title: &'static str, cx: &Context<Self>) -> SettingsGroup {
+        SettingsGroup { title, rows: Vec::new(), base_px: self.font_size_px(cx) }
     }
 
     /// 组与组之间的间隔。
     ///
-    /// 原来这里是 32px 容器夹一条 1px 细线。线现在多余了：分组的范围由左侧
-    /// 轨道表达，横线再圈一道等于同一件事说两遍，而且横线会把"一组"读成
-    /// "一段到此为止"——前者是归属，后者是切断。
-    /// 保留给"两块内容之间需要一口气"的非分组场景（关于页把外链沉到下面就
-    /// 用它）。分组之间**不要**用它——组自己带上留白，再插一段就是两倍。
     pub(crate) fn group_divider(_cx: &Context<Self>) -> gpui::Div {
         div().w_full().h(px(GROUP_GAP - 8.0)).flex_shrink_0()
     }
@@ -98,14 +81,10 @@ impl SettingsPane {
         control: impl IntoElement,
         cx: &Context<Self>,
     ) -> impl IntoElement {
-        self.row_shell(label, desc.into(), None, false, RowLayout::Standard, control, cx)
+        self.row_shell(label, desc.into(), None, RowLayout::Standard, control, cx)
     }
 
-    /// 带撤销的设置行：该项被覆盖过时，左侧轨道这一段亮起来，行内出现 ↶。
-    ///
-    /// 两个信号的时态不同，所以显示时机也不同：
-    /// - 轨道亮色是**状态**（"这台机器上我动过它"），必须常显才能一眼扫完；
-    /// - ↶ 是**动作**，只有真想撤销时才有用，常显就是噪音——所以 hover 才现。
+    /// 偏离默认值的设置项常驻显示恢复按钮，恢复后移除。
     pub(crate) fn row_with_reset(
         &self,
         label: &'static str,
@@ -128,35 +107,41 @@ impl SettingsPane {
         control: impl IntoElement,
         cx: &mut Context<Self>,
     ) -> impl IntoElement {
-        let hover_group = Self::row_hover_group(label);
         let reset = dirty.then(|| {
-            div()
-                .id(SharedString::from(format!("setting-reset-{label}")))
+            let action = crate::gpui_shell::config::ui_language(cx)
+                .text(crate::i18n::Message::SettingsPaneRestoreDefault);
+            let id: SharedString = format!("setting-reset-{label}").into();
+            let ink = cx.theme().foreground;
+            let hover = crate::gpui_shell::theme::neutral_hover(cx);
+            Button::new(id.clone())
+                .debug_selector(move || format!("setting-reset-{label}"))
+                .group(id.clone())
+                .custom(ButtonCustomVariant::new(cx).foreground(cx.theme().muted_foreground))
                 .size(px(32.0))
-                .rounded_md()
-                .flex()
-                .items_center()
-                .justify_center()
+                .px_0()
+                .rounded(px(6.0))
                 .cursor_pointer()
-                .invisible()
-                .group_hover(hover_group, |el| el.
```

**File**: `nebula_app/src/gpui_shell/settings_pane/mobile/view.rs` (modified, +86/-80)
```diff
@@ -1,5 +1,6 @@
 //! 三态共享同一份运行快照；二维码、在线状态和批准请求均来自实际连接。
 
+use super::super::design::settings_card;
 use super::*;
 use crate::gpui_shell::widgets::NebulaSwitch;
 use gpui::{Animation, AnimationExt as _, relative};
@@ -188,15 +189,12 @@ impl SettingsPane {
     fn mobile_off(&self, cx: &Context<Self>) -> gpui::Stateful<gpui::Div> {
         let language = crate::gpui_shell::config::ui_language(cx);
         let busy = self.mobile.operation || self.mobile.loading;
-        v_flex()
+        settings_card(cx)
             .id("mobile-off")
             .debug_selector(|| "mobile-off".into())
             .w_full()
             .mt(px(28.0))
             .p(px(24.0))
-            .border_1()
-            .border_color(cx.theme().border)
-            .rounded(px(10.0))
             .gap_1()
             .child(
                 div()
@@ -455,17 +453,15 @@ impl SettingsPane {
                     ),
             );
         }
-        h_flex()
+        settings_card(cx)
+            .flex_row()
             .id("mobile-pairing")
             .debug_selector(|| "mobile-pairing".into())
             .w_full()
             .mt(px(28.0))
             .p(px(24.0))
             .gap(px(32.0))
             .items_start()
-            .border_1()
-            .border_color(cx.theme().border)
-            .rounded(px(10.0))
             .when(narrow, |hero| hero.flex_col())
             .child(left)
             .child(qr)
@@ -493,17 +489,16 @@ impl SettingsPane {
                 ("code", &request.verification_code),
             ],
         );
-        h_flex()
+        settings_card(cx)
+            .flex_row()
+            .items_center()
             .id(SharedString::from(format!("mobile-request-{}", request.id)))
             .debug_selector(|| "mobile-pairing-request".into())
             .w_full()
             .mt(px(16.0))
             .px(px(16.0))
             .py(px(14.0))
             .gap(px(14.0))
-            .border_1()
-            .border_color(cx.theme().border)
-            .rounded(px(10.0))
             .flex_wrap()
             .child(Icon::default().path(crate::gpui_shell::assets::nav::PHONE).size(px(20.0)))
             .child(
@@ -616,7 +611,7 @@ impl SettingsPane {
 
     fn mobile_devices(&self, cx: &Context<Self>) -> gpui::Stateful<gpui::Div> {
         let language = crate::gpui_shell::config::ui_language(cx);
-        let mut group = v_flex().id("mobile-devices").w_full().mt(px(36.0)).child(
+        let group = v_flex().id("mobile-devices").w_full().mt(px(36.0)).child(
             h_flex()
                 .w_full()
                 .justify_between()
@@ -639,10 +634,11 @@ impl SettingsPane {
         );
         let devices =
             self.mobile.snapshot.as_ref().map(|s| s.devices.as_slice()).unwrap_or_default();
+        let mut card = settings_card(cx).debug_selector(|| "mobile-devices-card".into());
         if devices.is_empty() {
-            return group.child(
+            return group.child(card.child(
                 description(language.text(Message::MobileNoDevices), cx).px(px(13.0)).py(px(12.0)),
-            );
+            ));
         }
         for device in devices {
             let id = device.id.clone();
@@ -664,7 +660,7 @@ impl SettingsPane {
             } else {
                 status.to_owned()
             };
-            group = group.child(
+            card = card.child(
                 h_flex()
                     .id(SharedString::from(format!("mobile-device-{id}")))
                     .debug_selector(|| "mobile-device-row".into())
@@ -706,7 +702,7 @@ impl SettingsPane {
                     ),
             );
         }
-        group
+        group.child(card)
     }
 
     fn mobile_lan_options(&self, compact: bool, cx: &Context<Self>) -> gpui::Div {
@@ -796,19 +792,17 @@ impl SettingsPane {
         let language = crate::gpui_shell::config::ui_language(cx);
         let preferences = self.mobile.preferences();
         let busy = self.mobile.operation;
-        let mut group = v_flex()
-            .w_full()
-            .mt(px(36.0))
-            .child(
-                h_flex()
-                    .w_full()
-                    .justify_between()
-                    .gap_3()
-                    .pb(px(6.0))
-                    .child(group_heading(language.text(Message::MobileConnections), cx))
-                    .child(description(language.text(Message::MobileConnectionsHint), cx)),
-            )
-            .child(row(
+        let group = v_flex().w_full().mt(px(36.0)).child(
+            h_flex()
+                .w_full()
+                .justify_between()
+                .gap_3()
+                .pb(px(6.0))
+                .child(group_heading(language.text(Message::MobileConnections), cx))
+                .child(description(language.text(Message::MobileConnectionsHint), cx)),
+        );
+        let mut card =
+            settings_card(cx).debug_selector(|| "mobile-connections-card".into()).child(row(
               
```

**File**: `nebula_app/src/gpui_shell/settings_pane/terminal_effect.rs` (modified, +1/-2)
```diff
@@ -276,8 +276,7 @@ impl SettingsPane {
             panel.child(
                 v_flex()
                     .w_full()
-                    .pl(px(super::design::RAIL_INDENT))
-                    .pr_4()
+                    .px(px(super::design::CARD_PAD_X))
                     .pb(px(self.row_padding_y()))
                     .gap_2()
                     .children(sources),
```

**File**: `nebula_app/src/gpui_shell/settings_pane/terminal_effect_tests.rs` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ fn keyboard_picker_enable_reload_and_remove_use_rendered_controls(cx: &mut TestA
         focus.focus(window, cx);
     });
     draw(&mut window);
+    press("shift-tab", &mut window); // Restore the modified animation setting.
     press("shift-tab", &mut window); // Enable; disabled Reload is skipped.
     press("shift-tab", &mut window); // Add WGSL.
     press("enter", &mut window);
```

---

### Incident Patch 3: `898c4c39` (2026-11-11)
**Commit Message**: Merge reviewed bug fix #945

**File**: `architecture/notes/nebula_app/ai_hook/2026-11-11-detached-claude-session-end.md` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+# Deliver detached Claude SessionEnd to its verified Linux terminal
+
+## Status
+
+Proposed for review with implementation.
+
+## Context
+
+Issue #434 reports a WSL zsh pane retaining its Claude identity after a double
+Ctrl+C exit. Closing and reopening Pebrel then resumes an already exited CLI.
+The shared pane lifecycle clears the saved identity on SessionEnd or OSC 133;D,
+but either signal must first reach the pane.
+
+## Evidence
+
+A real zsh PTY running Claude Code 2.1.310 invoked both SessionStart and SessionEnd
+hooks. Claude detached each hook from its controlling terminal. The bridge
+returned authenticated OSC frames in terminalSequence JSON in both cases.
+Claude relayed SessionStart to the terminal, but discarded SessionEnd during
+both double Ctrl+C and /exit.
+
+The shared zsh integration still emitted OSC 133;D. Starting the same zsh without
+that integration demonstrated the missing second exit signal. These observations
+come from Linux ARM64; the reported Windows 11 WSL desktop path remains to be
+verified.
+
+## Decision
+
+For a Claude SessionEnd whose hook has no controlling terminal, recover the
+verified ancestor CLI's Linux devpts terminal from its stdin descriptor. Require
+the process epoch, foreground process group, controlling device, descriptor
+identity and device ownership to match before writing. Open without following
+symlinks or acquiring a controlling terminal.
+
+Reuse the existing bounded OSC write and pane token. When verification fails,
+retain the terminalSequence response. Existing controlling-terminal and tmux
+routes keep their delivery rules. Other hook events keep their existing path.
+The application continues to use its shared SessionEnd lifecycle and session-save
+logic.
+
+## Rejected alternatives
+
+- Clear state on Ctrl+C: interruption can stop one turn while leaving Claude open.
+- Rely only on a matching shell prompt: guest shell integration and prompt
+  recognition can be unavailable.
+- Scan every terminal or use a PID supplied in hook JSON: neither establishes the
+  owning terminal.
+- Return more SessionEnd JSON: the real CLI does not relay this response on exit.
+- Add a background relay: the current short-lived hook can deliver the event.
+
+## Consequences
+
+The additional procfs reads and device open occur only on detached Claude exit.
+There is no new persisted route, token, worker or setting. Linux devpts is the
+supported recovery path; other hosts retain their existing transport.
+
+## Validation
+
+- The real-PTY regression fails before the change and passes after it. A detached
+  hook reaches its foreground Claude ancestor, while redirected stdin and a
+  background process group retain the JSON fallback.
+- The remote-hook Python suite covers authenticated delivery, partial writes,
+  detached JSON responses, native hooks and configuration preservation.
+- Real Claude Code 2.1.310 delivers SessionStart and SessionEnd with the same
+  process identity after the change: double Ctrl+C with and without zsh
+  integration, and /exit with integration.
+- The GPUI regression checks that a WSL SessionEnd without shell markers removes
+  the foreground and saved recovery identities before window close.
+
+## Supersedes
+
+None. Extends the [WSL hook transport](../platform/wsl_hooks/2026-09-20-wsl-hook-transport.md).
+
+## Revisit when
+
+Claude relays terminalSequence during SessionEnd, or supplies an authenticated
+terminal endpoint for detached hooks.
```

**File**: `nebula_app/res/hooks/remote_bridge.py` (modified, +40/-8)
```diff
@@ -161,20 +161,52 @@ def send(source, native, mode, payload, token, owner=None, route=None, deadline=
         if len(envelope) > MAX_ENVELOPE:
             return
         osc = b"\x1b]777;nebula-hook;" + token.encode() + b";" + base64.b64encode(envelope) + b"\x07"
-        write_terminal(osc, source, route, deadline)
+        exit_owner = owner if source == "claude" and payload.get("hook_event_name") == "SessionEnd" else None
+        write_terminal(osc, source, route, deadline, exit_owner=exit_owner)
 
 
-def write_terminal(osc, source=None, route=None, deadline=None):
+def open_claude_exit_terminal(owner, flags):
+    """A detached SessionEnd can still reach Claude's verified Linux terminal."""
+    if sys.platform != "linux" or not owner:
+        return None
+    pid, _, epoch = owner.partition(":")
+    proc = Path("/proc") / pid
+    stdin = proc / "fd/0"
     try:
-        fd = os.open(route["tty"] if route else "/dev/tty",
-                     os.O_WRONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
+        tty = stdin.readlink()
+        if not re.fullmatch(r"/dev/pts/[0-9]+", str(tty)):
+            return None
+        fd = os.open(tty, flags | os.O_NOCTTY)
+    except OSError:
+        return None
+    try:
+        info = os.fstat(fd)
+        raw = (proc / "stat").read_text(encoding="utf-8")
+        fields = raw[raw.rfind(")") + 2:].split()
+        if (stat.S_ISCHR(info.st_mode) and info.st_uid == os.geteuid()
+                and fields[19] == epoch and int(fields[2]) > 0 and fields[2] == fields[5]
+                and info.st_rdev == (int(fields[4]) & 0xffffffff)
+                and os.path.samestat(info, stdin.stat())):
+            return fd
+    except (OSError, ValueError, IndexError):
+        pass
+    os.close(fd)
+    return None
+
+
+def write_terminal(osc, source=None, route=None, deadline=None, *, exit_owner=None):
+    flags = os.O_WRONLY | os.O_NONBLOCK | os.O_NOFOLLOW
+    try:
+        fd = os.open(route["tty"] if route else "/dev/tty", flags)
     except OSError as error:
         if route or source != "claude" or error.errno != errno.ENXIO:
             raise
-        # Interactive Claude consumes hook JSON even when its hook has no TTY.
-        # This fallback is only possible before any part of the OSC was written.
-        print(json.dumps({"terminalSequence": osc.decode("ascii")}), flush=True)
-        return
+        fd = open_claude_exit_terminal(exit_owner, flags)
+        if fd is None:
+            # Interactive Claude consumes terminalSequence for other hooks but
+            # does not relay it during SessionEnd.
+            print(json.dumps({"terminalSequence": osc.decode("ascii")}), flush=True)
+            return
     offset = 0
     deadline = min(deadline or float("inf"), time.monotonic() + 0.5)
     try:
```

**File**: `nebula_app/src/gpui_shell/terminal/view/activity_tests.rs` (modified, +22/-0)
```diff
@@ -26,6 +26,28 @@ fn remote_hook(session: &str, name: &str, process: &str, sequence: u64) -> AiHoo
     crate::ai_hook::parse_remote_envelope(wire.as_bytes(), None).unwrap()
 }
 
+#[gpui::test]
+fn wsl_claude_session_end_without_shell_markers_clears_the_saved_agent(cx: &mut TestAppContext) {
+    let (view, window, _) = open(cx);
+    view.update(window, |view, cx| {
+        view.suggest.suggest_env =
+            crate::display::SuggestEnv::Wsl { distro: "session-end-434".into() };
+        assert!(view.handle_ai_hook(&remote_hook("exited", "SessionStart", "434:1", 1), cx));
+        let saved = view.session_agent().expect("running conversation is restorable");
+        assert_eq!(saved.source, "claude");
+        assert_eq!(saved.session_id.as_deref(), Some("exited"));
+        assert_eq!(view.running_program.as_deref(), Some("claude"));
+        assert!(view.handle_ai_hook(&remote_hook("exited", "SessionEnd", "434:1", 2), cx));
+        view.prepare_ai_session_save(cx);
+        assert!(view.session_agent().is_none(), "window close must not resume an exited CLI");
+        assert!(view.ai_session.is_none());
+        assert!(view.recovery.target.is_none());
+        assert!(view.running_program.is_none());
+        assert!(!view.ai_session_save_pending());
+        assert_eq!(view.sidebar_activity(), SidebarActivity::Idle);
+    });
+}
+
 #[gpui::test]
 fn pi_redraw_anchor_follows_accepted_hook_and_command_lifecycle(cx: &mut TestAppContext) {
     use nebula_terminal::term::test::TermSize;
```

**File**: `scripts/tests/test_remote_hooks.py` (modified, +62/-0)
```diff
@@ -93,6 +93,68 @@ def test_claude_with_controlling_terminal_does_not_duplicate_stdout(self):
             write.assert_called_once_with(42, b"\x07")
             self.assertEqual(output.getvalue(), "")
 
+    @unittest.skipUnless(sys.platform == "linux", "requires Linux procfs and a devpts terminal")
+    def test_detached_claude_session_end_reaches_its_foreground_terminal(self):
+        import pty
+
+        provider = self.root / "claude"
+        bridge = ASSETS / "remote_bridge.py"
+        provider.write_text(
+            "import json, os, subprocess, sys\n"
+            "if sys.argv[1] == 'background':\n"
+            " raise SystemExit(subprocess.run([sys.executable, __file__, 'worker'], process_group=0, timeout=5).returncode)\n"
+            "if sys.argv[1] == 'redirected':\n"
+            " fd = os.open(os.devnull, os.O_RDONLY)\n"
+            " os.dup2(fd, 0)\n"
+            " os.close(fd)\n"
+            "payload = json.dumps({'hook_event_name': 'SessionEnd', 'session_id': 'fixture', 'pid': 1})\n"
+            f"result = subprocess.run([sys.executable, {str(bridge)!r}, 'claude'], input=payload, "
+            "text=True, capture_output=True, start_new_session=True, check=True, timeout=4)\n"
+            # Claude ignores the terminalSequence response during SessionEnd.
+            "print('response=' + ('fallback' if result.stdout else 'empty'))\n"
+        )
+        for mode in ("foreground", "redirected", "background"):
+            with self.subTest(mode=mode):
+                pid, master = pty.fork()
+                if pid == 0:
+                    os.execv(sys.executable, [sys.executable, str(provider), mode])
+                output = bytearray()
+                try:
+                    deadline = time.monotonic() + 6
+                    while time.monotonic() < deadline:
+                        if select.select([master], [], [], 0.1)[0]:
+                            try:
+                                part = os.read(master, 65536)
+                            except OSError as error:
+                                if error.errno != errno.EIO:
+                                    raise
+                                break
+                            if not part:
+                                break
+                            output.extend(part)
+                    waited, status = os.waitpid(pid, os.WNOHANG)
+                    self.assertEqual(waited, pid, "provider did not finish within the PTY budget")
+                    self.assertEqual(status, 0, output)
+                finally:
+                    os.close(master)
+                    try:
+                        os.kill(pid, 9)
+                        os.waitpid(pid, 0)
+                    except ProcessLookupError:
+                        pass
+                frames = re.findall(
+                    rb"\x1b\]777;nebula-hook;" + TOKEN.encode() + rb";([^\x07]+)\x07", output
+                )
+                if mode != "foreground":
+                    self.assertEqual(frames, [])
+                    self.assertIn(b"response=fallback", output)
+                    continue
+                self.assertEqual(len(frames), 1, output)
+                header, body = base64.b64decode(frames[0]).split(b"\n", 1)
+                self.assertTrue(header.startswith(f"nebula-hook/1 source=claude process={pid}:".encode()))
+                self.assertEqual(json.loads(body)["hook_event_name"], "SessionEnd")
+                self.assertIn(b"response=empty", output)
+
     def test_claude_partial_terminal_frame_is_cancelled_without_stdout_retry(self):
         bridge = module("remote_bridge")
         writes = []
```

#### Recent Merged Pull Requests:
- **PR #948** (2026-11-11): Use theme palettes for grouped settings cards (@Kuddev)
- **PR #946** (2026-11-11): fix: integrate reviewed rendering, workspace and hook regressions (@Kuddev)
- **PR #945** (2026-11-11): fix(hooks): deliver detached Claude session end to its terminal (@Kuddev)
- **PR #944** (2026-11-11): fix(macos): align top tabs with native window controls (@Kuddev)
- **PR #943** (2026-11-11): fix(math): recover collapsed matrix rows from terminal output (@Kuddev)
- **PR #942** (2026-11-11): fix(math): recognize uppercase variables with numeric subscripts (@Kuddev)

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

## X. Merge pull request #946 from Kuddev/merge/reviewed-bugs-936-945-20261111

**RULE**:
When implementing operations in `architecture/notes/nebula_app/ai_hook/2026-11-11-detached-claude-session-end.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1fe45e0d`: Merge pull request #946 from Kuddev/merge/reviewed-bugs-936-945-20261111. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `architecture/notes/nebula_app/ai_hook/2026-11-11-detached-claude-session-end.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Deliver detached Claude SessionEnd to its verified Linux terminal

## Status

Proposed for review with implementation.

## Context

Issue #434 reports a WSL zsh pane retaining its Claude identity after a double
Ctrl+C exit. Closing and reopening Pebrel then resumes an already exited CLI.
The shared pane lifecycle clears the saved identity on SessionEnd or OSC 133;D,
but either signal must first reach the pane.

## Evidence

A real zsh PTY running Claude Code 2.1.310 invoked both SessionStart and SessionEnd
hooks. Claude detached each hook from its controlling terminal. The bridge
returned authenticated OSC frames in terminalSequence JSON in both cases.
Claude relayed SessionStart to the terminal, but discarded SessionEnd during
both double Ctrl+C and /exit.

The shared zsh integration still emitted OSC 133;D. Starting the same zsh without
that integration demonstrated the missing second exit signal. These observations
come from Linux ARM64; the reported Windows 11 WSL desktop path remains to be
verified.

## Decision

For a Claude SessionEnd whose hook has no controlling terminal, recover the
verified ancestor CLI's Linux devpts terminal from its stdin descriptor. Require
the pro
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1fe45e0d` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
