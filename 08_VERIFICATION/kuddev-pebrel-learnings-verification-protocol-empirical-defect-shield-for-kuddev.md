# Verification Protocol: Verification Protocol: Empirical Defect Shield for kuddev-pebrel-learnings

<!-- PROVENANCE_START
{
  "source_repository": "kuddev-pebrel-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T06:07:48.474Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kuddev-pebrel-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kuddev-pebrel-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T06:07:48.474Z`  
> **Learning ID**: `LEARN-EVO-kuddev-pebrel-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `kuddev-pebrel-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source**: github ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Source Version**: `303a7f4e`  
> **License**: GPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T06:07:38.715Z  
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
> **Harvest Timestamp**: 2026-11-18T06:07:38.337Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3836 stars

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

### Core Architecture Module: `pebrel_app/res/hooks/opencode.js`
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

### Core Architecture Module: `pebrel_app/res/hooks/pi.ts`
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

### Core Architecture Module: `pebrel_app/res/hooks/remote_bridge.py`
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

### Core Architecture Module: `pebrel_app/res/hooks/remote_files.py`
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

### Core Architecture Module: `pebrel_app/res/hooks/remote_shell.py`
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

### Core Architecture Module: `pebrel_app/res/hooks/remote_tmux.py`
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

### Incident Patch 1: `c0112ee2` (2026-11-17)
**Commit Message**: Handle nonblocking writes in the native ConPTY keyboard regression

**File**: `pebrel_app/src/platform/keyboard/tests.rs` (modified, +66/-1)
```diff
@@ -103,6 +103,71 @@ fn wait_file(pty: &mut tty::Pty, path: &Path) -> Vec<u8> {
     }
 }
 
+fn write_input(writer: &mut impl Write, mut input: &[u8], timeout: Duration) -> io::Result<()> {
+    let deadline = Instant::now() + timeout;
+    while !input.is_empty() {
+        match writer.write(input) {
+            Ok(count) => input = &input[count..],
+            Err(error)
+                if matches!(
+                    error.kind(),
+                    io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
+                ) => {},
+            Err(error) => return Err(error),
+        }
+        if !input.is_empty() {
+            if Instant::now() >= deadline {
+                return Err(io::Error::new(
+                    io::ErrorKind::TimedOut,
+                    "ConPTY input remained blocked",
+                ));
+            }
+            // The evented writer reports zero while its asynchronous pipe is busy.
+            // Retain the unaccepted suffix; no input or reader assertion is retried.
+            std::thread::sleep(Duration::from_millis(5));
+        }
+    }
+    Ok(())
+}
+
+#[test]
+fn conpty_fixture_write_preserves_partial_input_and_bounds_backpressure() {
+    #[derive(Default)]
+    struct Backpressure {
+        step: usize,
+        accepted: Vec<u8>,
+    }
+    impl Write for Backpressure {
+        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
+            self.step += 1;
+            match self.step {
+                1 => return Ok(0),
+                2 => return Err(io::ErrorKind::WouldBlock.into()),
+                4 => return Err(io::ErrorKind::Interrupted.into()),
+                _ => {},
+            }
+            let count = bytes.len().min(2);
+            self.accepted.extend_from_slice(&bytes[..count]);
+            Ok(count)
+        }
+        fn flush(&mut self) -> io::Result<()> {
+            Ok(())
+        }
+    }
+    let input = b"\x1b[13;2u~";
+    let mut previous = Backpressure::default();
+    assert_eq!(previous.write_all(input).unwrap_err().kind(), io::ErrorKind::WriteZero);
+    let mut writer = Backpressure::default();
+    write_input(&mut writer, input, Duration::from_secs(1)).unwrap();
+    assert_eq!(writer.accepted, input);
+    let mut stalled = Backpressure::default();
+    assert_eq!(
+        write_input(&mut stalled, input, Duration::ZERO).unwrap_err().kind(),
+        io::ErrorKind::TimedOut
+    );
+    assert!(stalled.accepted.is_empty());
+}
+
 #[test]
 fn modified_enter_reaches_native_and_byte_readers_through_conpty() {
     let native = TermMode::WIN32_INPUT_MODE;
@@ -145,7 +210,7 @@ fn modified_enter_reaches_native_and_byte_readers_through_conpty() {
         if reader == "bytes" {
             input.push(b'~');
         }
-        pty.writer().write_all(&input).unwrap();
+        write_input(pty.writer(), &input, Duration::from_secs(10)).unwrap();
         let result = wait_file(&mut pty, &directory.path().join("result"));
         assert_eq!(result, expected, "{program}: {mode:?}");
     }
```

---

### Incident Patch 2: `53b8f42b` (2026-11-17)
**Commit Message**: Verify image control semantics on the corrected foreground fixture

**File**: `pebrel_app/src/ai_hook/native_events/subagent_tests.rs` (modified, +13/-0)
```diff
@@ -725,6 +725,19 @@ fn antigravity_confirmed_foreground_finishes_after_brain_exceeds_scan_limit() {
         };
 
         let mut activity = AgentActivity::default();
+        // Establish the already-confirmed foreground through its normal pathless start.
+        // Cold transcript admission may legitimately time out before the scan-limit case.
+        {
+            let _paused = PausedProbe::new();
+            let wire = format!(
+                "nebula-hook/1 source=antigravity pane=5 event=session-start\n{}",
+                json!({"conversationId": root_id})
+            );
+            let mut start = parse_envelope(wire.as_bytes()).expect("pathless foreground start");
+            start.agent_pid = Some(8899);
+            assert!(activity.apply_hook(&start));
+            assert!(is_confirmed_antigravity_foreground(root_id));
+        }
         assert!(
             activity
                 .apply_hook(&send("session-start", root_id, &root_transcript, json!({})).unwrap())
```

---

### Incident Patch 3: `1516ae67` (2026-11-17)
**Commit Message**: Integrate verified native notifications with the reviewed hook and test fixes

**File**: `architecture/notes/pebrel_app/ai_hook/2026-11-13-antigravity-subagent-isolation.md` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+# Antigravity in-process subagent hook isolation
+
+## Status
+
+Implemented on 2026-11-13.
+
+## Context
+
+Antigravity CLI (`agy`) executes subagents (`invoke_subagent` and `swarm` workers) inside
+the primary CLI OS process and fires the same global `SessionStart`, `PreInvocation` and
+`Stop` hooks for each child conversation. Because both conversations share one `agent_pid`,
+[`AgentActivity::accepts_hook`](../../../../pebrel_app/src/ai_hook/lifecycle.rs) treated a
+subagent `SessionStart` as a foreground `/new` reset, overwriting the pane's active
+`conversationId`, cold-restore resume target (`agy --conversation <id>`), session history
+and turn state while dropping subsequent hooks from the real foreground conversation.
+
+## Evidence
+
+- In Antigravity CLI, `HookArgsCommon` populates `parentConversationId`,
+  `rootConversationId` and `callerContext` internally, but `jsonhook.marshalHookArgs` scrubs
+  internal fields before serializing hook stdin JSON
+  ([upstream #1527](https://github.com/google-antigravity/antigravity-cli/issues/1527)),
+  leaving external payloads with only the child `conversationId`, `transcriptPath` and
+  `artifactDirectoryPath`.
+- `SessionStart` runs as a `PreInvocationHook` after step `0` is synchronously flushed to
+  `~/.gemini/antigravity-cli/brain/<conversationId>/.system_generated/logs/transcript.jsonl`
+  and `transcript_full.jsonl` under mutex.
+- Root interactive conversations record step `0` with `"source":"USER_EXPLICIT"` (later
+  steps in a root conversation may use `"source":"SYSTEM"` on background task wakeups, so
+  only step `0` is invariant). Un-forked subagents start with step `0` `"source":"SYSTEM"`.
+- Forked subagents (`swarm` `fork`) copy the parent's step `0`, and `ProtoStoreSubagentHub`
+  synchronously writes `<brain>/<parentId>/.system_generated/subagents/<childId>.json`
+  before starting the child.
+
+## Decision
+
+Gate Antigravity envelopes in
+[`protocol.rs`](../../../../pebrel_app/src/ai_hook/protocol.rs) via tri-state
+[`classify_antigravity_envelope`](../../../../pebrel_app/src/ai_hook/native_events.rs)
+(`Primary`, `Subagent`, `Unverified`) before event ordering or pane routing, accepting only
+`AntigravityVerdict::Primary`:
+
+- Reject immediately as `Subagent` on explicit subagent fields (`parentConversationId`,
+  `callerContext == "subagent"`, or `rootConversationId != conversationId`) on both local
+  and remote transports so upstream payload fixes work without disk reads.
+- Remote SSH envelopes (`parse_remote_envelope`) never inspect local host files; local
+  envelopes that omit both `artifactDirectoryPath` and `transcriptPath` remain `Primary`.
+- On local envelopes carrying path metadata, restrict paths lexically to the CLI's single
+  trusted root `<home>/.gemini/antigravity-cli/brain/<conversationId>` (shared with
+  [`local::antigravity::directory`](../../../../pebrel_app/src/ai_hook/local/antigravity.rs))
+  without `.` or `..` components.
+- Enforce no-symlink / no-reparse-point policy across the trusted `brain` directory itself,
+  all of its ancestors, every relative subdirectory, and the leaf file
+  ([`regular_file.rs`](../../../../pebrel_app/src/platform/regular_file.rs): ancestor
+  `symlink_metadata` check plus Unix `O_DIRECTORY | O_NOFOLLOW` `openat` + `fstatat` +
+  `O_NONBLOCK | O_NOFOLLOW`, and Windows segment `symlink_metadata` +
+  `FILE_FLAG_OPEN_REPARSE_POINT` + `FILE_TYPE_DISK`).
+- Execute disk probes on a bounded worker (`sync_channel(8)`, `200 ms` listener wait cap).
+  Unknown conversations remain `Unverified` on timeouts or full queues. If no worker
+  result arrives for an already admitted foreground owner, recheck its live lease and
+  the subagent cache before accepting its own event. A cached child verdict wins over
+  the lease. Completed probe verdicts, including unreadable/symlinked files, metadata
+  errors and incomplete scans, retain their classification.
+- Cache positive `Subagent` verdicts permanently (64-entry ring); for non-`SYSTEM` step-`0`
+  conversations, cache only the immutable step-`0` check while re-verifying parent subagent
+  records on subsequent hooks so delayed or previously unreadable parent records still
+  upgrade the conversation to `Subagent`.
+- Guard mid-turn foreground ownership in
+  [`AgentActivity::accepts_hook`](../../../../pebrel_app/src/ai_hook/lifecycle.rs): while an
+  Antigravity turn is active (`Working` or `Blocked`), a same-PID `SessionStart` carrying a
+  different `session_id` cannot replace `owner.session` even if its parent subagent record is
+  not yet readable on disk; `/new` switches remain allowed once the turn ends (`Idle`/`Done`).
+- Hold an RAII `AntigravityForegroundLease` on accepted local Antigravity `Owner`s so an
+  already-confirmed foreground conversation validates known parent records without re-scanning
+  `read_dir(brain_root)`, allowing its subsequent `done` hooks to succeed even after `brain`
+  grows past `4,096
```

**File**: `architecture/notes/pebrel_app/platform/notifications/2026-11-17-process-notification-identities.md` (modified, +9/-3)
```diff
@@ -2,7 +2,8 @@
 
 ## Status
 
-Implemented for review of PR #289; native App acceptance is pending.
+Implemented for integration of PR #289. Bundled App acceptance passed on macOS 26
+Apple Silicon and Intel for notification commit `6b253485` on 2026-11-17.
 
 ## Context
 
@@ -55,8 +56,13 @@ the new process; current requests still use their existing activation/choice pat
 
 Registry cases cover default and valid choices, malformed choices, consumption,
 previous-generation responses, eviction and sequence exhaustion. Native acceptance
-uses the current bundled App and the normal permission flow; registry tests do
-not establish operating-system authorization or visible delivery.
+used the bundled App and the normal permission flow in
+[run 43998356666](https://github.com/Kuddev/pebrel/actions/runs/43998356666). Both Mac
+architectures granted the real system permission, displayed the foreground
+notification in Notification Center, and returned from a different tab to the
+originating pane after a native click. Package identities and screenshots were
+retained with the run. The hosted image needed its standard Notification Center
+agent started; application authorization used the normal native Allow action.
 
 ## Supersedes
 
```

**File**: `architecture/notes/pebrel_app/platform/regular_file/2026-11-17-local-probe-file-admission.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# Local probe file admission
+
+## Status
+
+Implemented for review as the platform prerequisite of PR #966.
+
+## Context
+
+Local hook metadata identifies transcript and registration files. A probe must
+distinguish an absent record from an unreadable or unsuitable filesystem object,
+and must not wait for a writer on a named pipe. The hook classifier owns session
+identity; the platform adapter owns native file opening and file-type checks.
+
+## Evidence
+
+PR #966 introduced this adapter for Antigravity transcript probes. Its consumer
+has a bounded listener wait and a separate worker. The adapter is reviewed here
+with direct filesystem cases so native file admission can be verified separately
+from conversation ordering and worker saturation.
+
+## Decision
+
+Require an absolute existing root, reject linked roots and ancestors during
+validation, and reject relative traversal components. Unix descent below the
+opened root uses directory descriptors, no-follow flags and a nonblocking leaf
+open. Windows validates path segments and checks the opened disk handle. The
+opened object must be a regular file. An absent relative record is `NotFound`;
+an invalid root or unsuitable object is `InvalidOrError`.
+
+These checks do not make the preliminary ancestor observations atomic with the
+root open. The adapter does not claim to contain a hostile concurrent ancestor
+rename. Native path observations and the hook worker's time limit have separate
+responsibilities; a regular disk file can still be slow to read.
+
+## Rejected alternatives
+
+- Treating every error as absence could admit an unclassified conversation.
+- Opening a path with blocking default flags before checking its type can wait
+  indefinitely on a named pipe without a writer.
+- Placing native flags and filesystem policy in the hook parser would duplicate
+  the adapter boundary and make file admission harder to test independently.
+
+## Consequences
+
+The platform module exposes file admission and lexical path comparison, with no
+new dependency, thread, persistent state or UI. PR #966 uses this contract for
+its own transcript layout and lifecycle decisions.
+
+## Validation
+
+Direct tests cover a nested Unicode file, missing relative paths, invalid roots,
+directory leaves, traversal components, linked leaves/directories/ancestors and
+a Unix FIFO without a writer. The consumer retains its complete parser and
+conversation regressions. Windows link fixtures require symbolic-link privilege
+and report its absence separately from ordinary filesystem cases.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+A caller requires protection against concurrent ancestor replacement or adds
+a filesystem object type beyond local regular files.
```

**File**: `pebrel_app/src/ai_hook/lifecycle.rs` (modified, +33/-5)
```diff
@@ -27,6 +27,7 @@ struct Owner {
     pid: Option<u32>,
     remote_process: Option<String>,
     bridge_instance: Option<String>,
+    antigravity_lease: Option<super::native_events::AntigravityForegroundLease>,
 }
 
 /// Owns status and arbitration. Adapters may submit facts but cannot set fields.
@@ -109,6 +110,9 @@ impl AgentActivity {
     pub fn primary_pid(&self) -> Option<u32> {
         self.owner.as_ref().and_then(|owner| owner.pid)
     }
+    pub fn primary_session(&self) -> Option<&str> {
+        self.owner.as_ref().and_then(|owner| owner.session.as_deref())
+    }
     pub fn allows_screen(&self) -> bool {
         !self.command_ended
             && self.native_title.is_none()
@@ -192,8 +196,10 @@ impl AgentActivity {
 
     pub fn submitted_text(&mut self, program: &str, text: &str) {
         // Codex /plan 只切换交互模式，不触发任务 hook；若先制造 Running，
-        // 对话输入会一直等一个不存在的完成事件。普通任务仍保留提交屏障。
-        if program == "codex" && text.trim() == "/plan" {
+        // 对话输入会一直等一个不存在的完成事件。Antigravity /new 同理只切新会话。
+        if (program == "codex" && text.trim() == "/plan")
+            || (program == "antigravity" && text.trim() == "/new")
+        {
             self.input_sent();
         } else {
             self.submitted();
@@ -268,12 +274,20 @@ impl AgentActivity {
                 || matches!(event.source.as_str(), "pi" | "omp")
                     && owner.bridge_instance.is_some()
                     && owner.bridge_instance == event.bridge_instance;
+            // Antigravity spawns in-process subagents inside an active primary turn (`Working`
+            // or `Blocked`). Even if a forked subagent's parent registration file is not yet
+            // readable on disk when its `SessionStart` fires, an in-flight foreground turn must
+            // never be replaced mid-turn; legitimate `/new` switches occur only between turns.
+            let active_antigravity_turn = owner.source == "antigravity"
+                && matches!(self.status(), AgentStatus::Working | AgentStatus::Blocked);
             match (owner.pid, event.agent_pid) {
                 (Some(primary), Some(incoming)) if primary != incoming => return false,
                 _ if owner.session.is_some()
                     && event.session_id.is_some()
                     && owner.session != event.session_id
-                    && !(same_process && event.kind == AiHookKind::SessionStart) =>
+                    && !(same_process
+                        && event.kind == AiHookKind::SessionStart
+                        && !active_antigravity_turn) =>
                 {
                     return false;
                 },
@@ -283,6 +297,15 @@ impl AgentActivity {
         true
     }
 
+    fn antigravity_lease_for(
+        event: &AiHookEvent,
+    ) -> Option<super::native_events::AntigravityForegroundLease> {
+        (event.source == "antigravity" && event.remote_process.is_none())
+            .then_some(event.session_id.as_deref())
+            .flatten()
+            .map(super::native_events::AntigravityForegroundLease::acquire)
+    }
+
     fn record_owner(&mut self, event: &AiHookEvent) {
         if let Some(owner) = &mut self.owner {
             owner.pid = owner.pid.or(event.agent_pid);
@@ -292,8 +315,12 @@ impl AgentActivity {
             if owner.bridge_instance.is_none() {
                 owner.bridge_instance = event.bridge_instance.clone();
             }
-            if event.session_id.is_some() {
-                owner.session = event.session_id.clone();
+            if let Some(session_id) = event.session_id.as_deref() {
+                if owner.session.as_deref() != Some(session_id) || owner.antigravity_lease.is_none()
+                {
+                    owner.antigravity_lease = Self::antigravity_lease_for(event);
+                }
+                owner.session = Some(session_id.to_owned());
             }
         } else {
             self.owner = Some(Owner {
@@ -302,6 +329,7 @@ impl AgentActivity {
                 pid: event.agent_pid,
                 remote_process: event.remote_process.clone(),
                 bridge_instance: event.bridge_instance.clone(),
+                antigravity_lease: Self::antigravity_lease_for(event),
             });
         }
     }
```

**File**: `pebrel_app/src/ai_hook/local.rs` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ use serde_json::{Value, json};
 
 use super::{CLAUDE_EVENTS, HELPER_ARGS, is_helper_executable, is_helper_shell_command};
 
-mod antigravity;
+pub(super) mod antigravity;
 mod claude_style;
 mod codex_hooks;
 mod codex_notify;
```

**File**: `pebrel_app/src/ai_hook/local/antigravity.rs` (modified, +2/-2)
```diff
@@ -15,8 +15,8 @@ const GROUP: &str = "pebrel";
 const EVENTS: &[(&str, &str)] =
     &[("SessionStart", "session-start"), ("PreInvocation", "tool-complete"), ("Stop", "done")];
 
-pub(super) fn directory() -> Option<PathBuf> {
-    Some(crate::platform::dirs::home_dir()?.join(".gemini/antigravity-cli"))
+pub(in crate::ai_hook) fn directory() -> Option<PathBuf> {
+    Some(crate::platform::dirs::home_dir()?.join(".gemini").join("antigravity-cli"))
 }
 
 pub(super) fn path() -> Option<PathBuf> {
```

**File**: `pebrel_app/src/ai_hook/native_events.rs` (modified, +486/-0)
```diff
@@ -1,8 +1,133 @@
 //! Native lifecycle hooks that carry their event in the helper argv.
+use std::collections::{HashMap, VecDeque};
+use std::io::{BufRead, BufReader, ErrorKind, Read};
+use std::path::{Component, Path, PathBuf};
+use std::sync::{LazyLock, Mutex, mpsc};
+use std::time::{Duration, Instant};
+
 use serde_json::Value;
 
 use super::payload::{attention_message, context_string};
 use super::{AiHookKind, AiTurnOutcome, AttentionKind};
+use crate::platform::regular_file::{
+    RegularProbe, is_dir_and_ancestors_no_symlink, is_dir_no_symlink, open_regular_under_root,
+    paths_equal_lexically, probe_regular_under_root,
+};
+
+const MAX_TRACKED_ANTIGRAVITY_CONVERSATIONS: usize = 64;
+const MAX_TRANSCRIPT_LINE_BYTES: u64 = 256 * 1024;
+const MAX_BRAIN_SCAN_DIRS: usize = 4_096;
+const SUBAGENT_PROBE_TIMEOUT: Duration = Duration::from_millis(200);
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+pub(super) enum AntigravityVerdict {
+    Primary,
+    Subagent,
+    Unverified,
+}
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum CachedConversation {
+    Subagent,
+    NonSystemStepZero,
+}
+
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+enum BrainScan {
+    RegisteredSubagent,
+    NotFoundComplete,
+    Incomplete,
+}
+
+static ANTIGRAVITY_CONVERSATIONS: LazyLock<Mutex<VecDeque<(PathBuf, CachedConversation)>>> =
+    LazyLock::new(|| Mutex::new(VecDeque::new()));
+static ACTIVE_ANTIGRAVITY_FOREGROUND: LazyLock<Mutex<HashMap<String, usize>>> =
+    LazyLock::new(|| Mutex::new(HashMap::new()));
+static PROBE_WORKER: LazyLock<ProbeWorker> = LazyLock::new(ProbeWorker::new);
+
+#[derive(Debug)]
+pub(in crate::ai_hook) struct AntigravityForegroundLease {
+    session_id: String,
+}
+
+impl AntigravityForegroundLease {
+    pub(in crate::ai_hook) fn acquire(session_id: &str) -> Self {
+        let mut active =
+            ACTIVE_ANTIGRAVITY_FOREGROUND.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
+        *active.entry(session_id.to_owned()).or_insert(0) += 1;
+        Self { session_id: session_id.to_owned() }
+    }
+}
+
+impl Clone for AntigravityForegroundLease {
+    fn clone(&self) -> Self {
+        Self::acquire(&self.session_id)
+    }
+}
+
+impl Drop for AntigravityForegroundLease {
+    fn drop(&mut self) {
+        let mut active =
+            ACTIVE_ANTIGRAVITY_FOREGROUND.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
+        if let Some(count) = active.get_mut(&self.session_id) {
+            *count = count.saturating_sub(1);
+            if *count == 0 {
+                active.remove(&self.session_id);
+            }
+        }
+    }
+}
+
+fn is_confirmed_antigravity_foreground(session_id: &str) -> bool {
+    ACTIVE_ANTIGRAVITY_FOREGROUND
+        .lock()
+        .unwrap_or_else(|poisoned| poisoned.into_inner())
+        .get(session_id)
+        .copied()
+        .unwrap_or(0)
+        > 0
+}
+
+#[cfg(test)]
+std::thread_local! {
+    static TEST_TRUSTED_BRAIN_ROOT: std::cell::RefCell<Option<PathBuf>> =
+        const { std::cell::RefCell::new(None) };
+}
+
+type ProbeJob = Box<dyn FnOnce() + Send>;
+
+struct ProbeWorker {
+    tx: Option<mpsc::SyncSender<ProbeJob>>,
+}
+
+impl ProbeWorker {
+    fn new() -> Self {
+        let (tx, rx) = mpsc::sync_channel::<ProbeJob>(8);
+        let spawned = std::thread::Builder::new()
+            .name("pebrel-agy-probe".into())
+            .spawn(move || {
+                while let Ok(job) = rx.recv() {
+                    job();
+                }
+            })
+            .is_ok();
+        Self { tx: spawned.then_some(tx) }
+    }
+
+    fn run<T: Send + 'static>(
+        &self,
+        timeout: Duration,
+        job: impl FnOnce() -> T + Send + 'static,
+    ) -> Option<T> {
+        let tx = self.tx.as_ref()?;
+        let (reply_tx, reply_rx) = mpsc::sync_channel(1);
+        tx.try_send(Box::new(move || {
+            let _ = reply_tx.send(job());
+        }))
+        .ok()?;
+        reply_rx.recv_timeout(timeout).ok()
+    }
+}
 
 pub(super) struct NativeEvent {
     pub kind: AiHookKind,
@@ -80,6 +205,367 @@ fn antigravity_outcome(payload: &Value) -> AiTurnOutcome {
     }
 }
 
+/// Antigravity runs subagents inside the primary CLI process, firing the same
+/// global `SessionStart`, `PreInvocation` and `Stop` hooks while scrubbing
+/// internal parent fields from external JSON payloads. Require positive primary
+/// verification when local path metadata is supplied so subagents and unverified
+/// envelopes (timeout, full queue, symlinked roots, incomplete scans) never
+/// replace foreground pane ownership.
+pub(super) fn classify_antigravity_envelope(
+    payload: &Value,
+    conversation_id: Option<&str>,
+    local_transport: bool,
+) -> AntigravityVerdict {
+    classify_antigravity_envelope_with_worker(
+        payload,
+        conversation_id,
+        local_transport,
+        &trusted_antigravity_brain_roots(),
+        &PROBE_WORKER,
+        SUBAGENT_PROBE_TIMEOUT,
+    )
+}
+
+f
```

**File**: `pebrel_app/src/ai_hook/native_events/subagent_tests.rs` (added, +745/-0)
```diff
@@ -0,0 +1,745 @@
+use std::sync::{Arc, Condvar, Mutex};
+
+use serde_json::json;
+
+use super::*;
+use crate::ai_agents::AgentStatus;
+use crate::ai_hook::lifecycle::AgentActivity;
+use crate::ai_hook::{AiHookEvent, parse_envelope, parse_remote_envelope};
+
+static TEST_PROBE_MUTEX: Mutex<()> = Mutex::new(());
+
+fn temp_brain_root() -> (tempfile::TempDir, PathBuf) {
+    let temp = tempfile::tempdir().unwrap();
+    let base = if is_dir_and_ancestors_no_symlink(temp.path()) {
+        temp.path().to_path_buf()
+    } else {
+        // Resolve system symlinks such as `/var -> /private/var` on macOS temp roots.
+        std::fs::canonicalize(temp.path()).unwrap()
+    };
+    let brain = base.join(".gemini").join("antigravity-cli").join("brain");
+    std::fs::create_dir_all(&brain).unwrap();
+    (temp, brain)
+}
+
+fn with_trusted_brain_root<R>(brain_root: &Path, f: impl FnOnce() -> R) -> R {
+    let _guard = TEST_PROBE_MUTEX.lock().unwrap_or_else(|e| e.into_inner());
+    struct Reset;
+    impl Drop for Reset {
+        fn drop(&mut self) {
+            TEST_TRUSTED_BRAIN_ROOT.with(|slot| *slot.borrow_mut() = None);
+        }
+    }
+    TEST_TRUSTED_BRAIN_ROOT.with(|slot| *slot.borrow_mut() = Some(brain_root.to_path_buf()));
+    let _reset = Reset;
+    f()
+}
+
+fn write_antigravity_transcript(brain: &Path, id: &str, source: &str, step_type: &str) -> PathBuf {
+    let logs = brain.join(id).join(".system_generated").join("logs");
+    std::fs::create_dir_all(&logs).unwrap();
+    let step = json!({"step_index": 0, "source": source, "type": step_type}).to_string();
+    let content = format!("{step}\n");
+    std::fs::write(logs.join("transcript.jsonl"), &content).unwrap();
+    let full = logs.join("transcript_full.jsonl");
+    std::fs::write(&full, &content).unwrap();
+    full
+}
+
+fn write_subagent_record(brain: &Path, parent_id: &str, child_id: &str) {
+    let subagents_dir = brain.join(parent_id).join(".system_generated").join("subagents");
+    std::fs::create_dir_all(&subagents_dir).unwrap();
+    std::fs::write(
+        subagents_dir.join(format!("{child_id}.json")),
+        json!({"conversationId": child_id, "state": "SUBAGENT_STATE_ALIVE"}).to_string(),
+    )
+    .unwrap();
+}
+
+fn parse_antigravity_hook(
+    event: &str,
+    id: &str,
+    transcript: &Path,
+    pid: Option<u32>,
+    extra: Value,
+) -> Option<AiHookEvent> {
+    let mut body = json!({
+        "conversationId": id,
+        "transcriptPath": transcript.to_str().unwrap(),
+    });
+    if let Some(obj) = extra.as_object() {
+        for (k, v) in obj {
+            body[k] = v.clone();
+        }
+    }
+    let wire = format!("nebula-hook/1 source=antigravity pane=5 event={event}\n{body}");
+    parse_envelope(wire.as_bytes()).map(|mut parsed| {
+        parsed.agent_pid = pid;
+        parsed
+    })
+}
+
+fn route_antigravity_hook(
+    activity: &mut AgentActivity,
+    active_session: &mut Option<String>,
+    maybe_event: Option<AiHookEvent>,
+) -> bool {
+    let Some(event) = maybe_event else { return false };
+    if activity.apply_hook(&event) {
+        if let Some(id) = event.session_id {
+            *active_session = Some(id);
+        }
+        true
+    } else {
+        false
+    }
+}
+
+#[test]
+fn antigravity_in_process_subagents_never_hijack_primary_conversation_or_turn() {
+    let (_temp, brain) = temp_brain_root();
+
+    let root_id = "11111111-1111-4111-8111-111111111111";
+    let sub_id = "22222222-2222-4222-8222-222222222222";
+    let fork_id = "33333333-3333-4333-8333-333333333333";
+    let next_root_id = "44444444-4444-4444-8444-444444444444";
+
+    let root_transcript =
+        write_antigravity_transcript(&brain, root_id, "USER_EXPLICIT", "USER_INPUT");
+    let sub_transcript = write_antigravity_transcript(&brain, sub_id, "SYSTEM", "SYSTEM_MESSAGE");
+    let fork_transcript =
+        write_antigravity_transcript(&brain, fork_id, "USER_EXPLICIT", "USER_INPUT");
+    let next_root_transcript =
+        write_antigravity_transcript(&brain, next_root_id, "USER_EXPLICIT", "USER_INPUT");
+    write_subagent_record(&brain, root_id, fork_id);
+
+    with_trusted_brain_root(&brain, || {
+        let send = |event: &str, id: &str, transcript: &Path, extra: Value| {
+            parse_antigravity_hook(event, id, transcript, Some(4242), extra)
+        };
+        let mut activity = AgentActivity::default();
+        let mut active_session = None;
+
+        assert!(route_antigravity_hook(
+            &mut activity,
+            &mut active_session,
+            send("session-start", root_id, &root_transcript, json!({})),
+        ));
+        assert_eq!(activity.status(), AgentStatus::Idle);
+        assert!(route_antigravity_hook(
+            &mut activity,
+            &mut active_session,
+            send("tool-complete", root_id, &root_transcript, json!({})),
+        ));
+        assert_eq!(activity.status(), AgentStatus::Working);
+        assert_eq!(active_session.as_d
```

#### Recent Merged Pull Requests:
- **PR #1021** (2026-11-17): Establish confirmed foreground ownership before exercising transcript scan limits (@Kuddev)
- **PR #1020** (2026-11-17): Import Niu installations as independent terminal profiles (@Kuddev)
- **PR #1019** (2026-11-17): Resolve terminal image numbers and delete placements at their current cells (@Kuddev)
- **PR #1018** (2026-11-17): Decode bounded PNG transfers from terminal readers (@Kuddev)
- **PR #1017** (2026-11-17): Refresh the WeChat invitation and remove Sidrune AI from the READMEs (@Kuddev)
- **PR #1015** (2026-11-17): Make the Antigravity eviction fixture independent of disk timing (@Kuddev)

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

## X. Handle nonblocking writes in the native ConPTY keyboard regression

**RULE**:
When implementing operations in `pebrel_app/src/platform/keyboard/tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Kuddev/pebrel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c0112ee2`: Handle nonblocking writes in the native ConPTY keyboard regression. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `pebrel_app/src/platform/keyboard/tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
fn write_input(writer: &mut impl Write, mut input: &[u8], timeout: Duration) -> io::Result<()> {
    let deadline = Instant::now() + timeout;
    while !input.is_empty() {
        match writer.write(input) {
            Ok(count) => input = &input[count..],
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                ) => {},
            Err(error) => return Err(error),
        }
        if !input.is_empty() {
            if Instant::now() >= deadline {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "ConPTY input remained blocked",
                ));
            }
            // The evented writer reports zero while its asynchronous pipe is busy.
            // Retain the unaccepted suffix; no input or reader assertion is retried.
            std::thread::sleep(Duration::from_millis(5));
        }
    }
    Ok(())
}

#[test]
fn conpty_fixture_write_preserves_partial_input_and_bounds_backpressure() {
    #[derive(Default)]
    struct Backpressure {
        step: usize,
        accepted: Vec<u8>,
    }
    im
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        pty.writer().write_all(&input).unwrap();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c0112ee2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
