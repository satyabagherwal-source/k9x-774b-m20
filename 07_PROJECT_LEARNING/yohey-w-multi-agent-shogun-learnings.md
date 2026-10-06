# Forensic Learning Record (Deep Inspection): yohey-w/multi-agent-shogun

> **Canonical Artifact**: `07_PROJECT_LEARNING/yohey-w-multi-agent-shogun-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yohey-w/multi-agent-shogun](https://github.com/yohey-w/multi-agent-shogun))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:40.750Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yohey-w/multi-agent-shogun`
- **Description**: Samurai-inspired multi-agent system for Claude Code. Orchestrate parallel AI tasks via tmux with shogun → karo → ashigaru hierarchy.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1423 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/ui/AnsiUtils.kt`
```
package com.shogun.android.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle

private val ANSI_COLOR_RE = Regex("\u001B\\[([0-9;]*)m")
private val ANSI_ESCAPE_RE = Regex("\u001B(?:\\[[0-9;]*[A-Za-z]|[^\\[])")

// Standard 8-color palette (codes 0-7 in 256-color, or 30-37 basic)
private val STANDARD_COLORS = arrayOf(
    Color(0xFF000000), // 0 black
    Color(0xFFCC4444), // 1 red
    Color(0xFF66BB6A), // 2 green
    Color(0xFFFFEB3B), // 3 yellow
    Color(0xFF42A5F5), // 4 blue
    Color(0xFFAB47BC), // 5 magenta
    Color(0xFF26C6DA), // 6 cyan
    Color(0xFFE0E0E0), // 7 white
)

// Bright 8-color palette (codes 8-15 in 256-color, or 90-97 basic)
private val BRIGHT_COLORS = arrayOf(
    Color(0xFF757575), // 8  bright black (gray)
    Color(0xFFFF5252), // 9  bright red
    Color(0xFF69F0AE), // 10 bright green
    Color(0xFFFFD740), // 11 bright yellow
    Color(0xFF448AFF), // 12 bright blue
    Color(0xFFE040FB), // 13 bright magenta
    Color(0xFF18FFFF), // 14 bright cyan
    Color.White,       // 15 bright white
)

/**
 * Convert 256-color code (0-255) to Compose Color.
 * 0-7: standard, 8-15: bright, 16-231: 6x6x6 RGB cube, 232-255: grayscale
 */
private fun color256(n: Int): Color? = when {
    n in 0..7 -> STANDARD_COLORS[n]
    n in 8..15 -> BRIGHT_COLORS[n - 8]
    n in 16..231 -> {
        val idx = n - 16
        val r = (idx / 36) * 51
        val g = ((idx % 36) / 6) * 51
        val b = (idx % 6) * 51
        Color(0xFF000000 or (r.toLong() shl 16) or (g.toLong() shl 8) or b.toLong())
    }
    n in 232..255 -> {
        val gray = 8 + (n - 232) * 10
        Color(0xFF000000 or (gray.toLong() shl 16) or (gray.toLong() shl 8) or gray.toLong())
    }
    else -> null
}

fun parseAnsiColors(text: String): AnnotatedString = buildAnnotatedString {
    var currentColor: Color? = null
    var isBold = false
    var pos = 0

    fun appendChunk(s: String) {
        val clean = ANSI_ESCAPE_RE.replace(s, "")
        if (clean.isEmpty()) return
        val style = SpanStyle(
            color = currentColor ?: Color.Unspecified,
            fontWeight = if (isBold) FontWeight.Bold else null
        )
        if (currentColor != null || isBold) {
            withStyle(style) { append(clean) }
        } else {
            append(clean)
        }
    }

    for (match in ANSI_COLOR_RE.findAll(text)) {
        appendChunk(text.substring(pos, match.range.first))
        val codesStr = match.groupValues[1]
        if (codesStr.isEmpty()) {
            currentColor = null
            isBold = false
        } else {
            val codes = codesStr.split(";").mapNotNull { it.toIntOrNull() }
            var i = 0
            while (i < codes.size) {
                when (codes[i]) {
                    0 -> { currentColor = null; isBold = false }
                    1 -> isBold = true
                    2 -> isBold = false // dim
                    22 -> isBold = false // normal intensity
                    // Basic foreground colors 30-37
                    in 30..37 -> currentColor = STANDARD_COLORS[codes[i] - 30]
                    // Default foreground
                    39 -> currentColor = null
                    // Basic background colors 40-47 (ignore for text display)
                    in 40..47 -> { /* skip */ }
                    49 -> { /* default background, skip */ }
                    // Bright foreground colors 90-97
                    in 90..97 -> currentColor = BRIGHT_COLORS[codes[i] - 90]
                    // Bright background colors 100-107 (ignore)
                    in 100..107 -> { /* skip */ }
                    // Extended color: 38;5;N (256-color fg) or 38;2;R;G;B (truecolor fg)
                    38 -> {
                        if (i + 1 < codes.size) {
                            when (codes[i + 1]) {
                                5 -> { // 256-color: 38;5;N
                                    if (i + 2 < codes.size) {
                                        currentColor = color256(codes[i + 2])
                                        i += 2
                                    }
                                }
                                2 -> { // Truecolor: 38;2;R;G;B
                                    if (i + 4 < codes.size) {
                                        val r = codes[i + 2].coerceIn(0, 255)
                                        val g = codes[i + 3].coerceIn(0, 255)
                                        val b = codes[i + 4].coerceIn(0, 255)
                                        currentColor = Color(
                                            0xFF000000 or (r.toLong() shl 16) or (g.toLong() shl 8) or b.toLong()
                                        )
                                        i += 4
                                    }
                                }
                            }
                        }
                    }
                    // Extended background: 48;5;N or 48;2;R;G;B (skip)
                    48 -> {
                        if (i + 1 < codes.size) {
                            when (codes[i + 1]) {
                                5 -> i += 2 // skip 48;5;N
                                2 -> i += 4 // skip 48;2;R;G;B
                            }
                        }
                    }
                }
                i++
            }
        }
        pos = match.range.last + 1
    }
    appendChunk(text.substring(pos))
}

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/util/AppLogger.kt`
```
package com.shogun.android.util

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CopyOnWriteArrayList

object AppLogger {
    private val entries = CopyOnWriteArrayList<String>()
    private const val MAX_ENTRIES = 200
    private val fmt = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault())

    fun log(tag: String, message: String) {
        val ts = fmt.format(Date())
        val entry = "$ts [$tag] $message"
        entries.add(entry)
        while (entries.size > MAX_ENTRIES) {
            entries.removeAt(0)
        }
    }

    fun getEntries(): List<String> = entries.toList()

    fun clear() = entries.clear()
}

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/util/Constants.kt`
```
package com.shogun.android.util

/** SharedPreferences keys — single source of truth to prevent typo bugs. */
object PrefsKeys {
    const val PREFS_NAME = "shogun_prefs"
    const val SSH_HOST = "ssh_host"
    const val SSH_PORT = "ssh_port"
    const val SSH_USER = "ssh_user"
    const val SSH_KEY_PATH = "ssh_key_path"
    const val SSH_PASSWORD = "ssh_password"
    const val PROJECT_PATH = "project_path"
    const val SHOGUN_SESSION = "shogun_session"
    const val AGENTS_SESSION = "agents_session"
    const val NOTIFICATION_ENABLED = "notification_enabled"
    const val NTFY_TOPIC = "ntfy_topic"
    const val NOTIFY_CMD_COMPLETE = "notify_cmd_complete"
    const val NOTIFY_CMD_FAILURE = "notify_cmd_failure"
    const val NOTIFY_ACTION_REQUIRED = "notify_action_required"
    const val NOTIFY_DASHBOARD_UPDATE = "notify_dashboard_update"
    const val NOTIFY_STREAK_UPDATE = "notify_streak_update"
    const val NOTIFY_AGENT_RESPONSE = "notify_agent_response"
}

object Defaults {
    const val SSH_HOST = "192.168.1.1"
    const val SSH_PORT = 22
    const val SSH_PORT_STR = "22"
    const val SHOGUN_SESSION = "shogun"
    const val AGENTS_SESSION = "multiagent"
    const val NTFY_TOPIC = "sho-y0uhey"
    const val TMUX = "/usr/bin/tmux"
}

```

### Core Architecture Module: `.opencode/tools/mark-as-read.ts`
```
import { tool } from "@opencode-ai/plugin";
import {
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const LOCK_RETRY_COUNT = 50;
const LOCK_RETRY_DELAY_MS = 100;

// Dedicated inbox state updater.
// It only flips a processed inbox entry from read:false to read:true.

const AGENT_ID_RE = /^[a-z][a-z0-9_-]*$/;

type InboxBlock = {
  id?: string;
  idLine?: number;
  read?: "true" | "false";
  readLine?: number;
};

function stripYamlScalarQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function resolveInboxPath(worktree: string, agentId: string): string {
  const normalizedAgentId = agentId.trim();
  if (!AGENT_ID_RE.test(normalizedAgentId)) {
    throw new Error(
      `Invalid agentId ${JSON.stringify(agentId)}. Expected a simple inbox name such as karo or ashigaru3.`,
    );
  }

  const inboxRoot = path.resolve(worktree, "queue", "inbox");
  const inboxPath = path.resolve(inboxRoot, `${normalizedAgentId}.yaml`);
  const relativeToInboxRoot = path.relative(inboxRoot, inboxPath);

  if (
    relativeToInboxRoot.startsWith("..") ||
    path.isAbsolute(relativeToInboxRoot)
  ) {
    throw new Error(
      `Refusing to access path outside queue/inbox: ${inboxPath}`,
    );
  }

  return inboxPath;
}

function parseInbox(raw: string): {
  lines: string[];
  newline: string;
  blocks: InboxBlock[];
} {
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);

  const headerIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && trimmed !== "---" && !trimmed.startsWith("#");
  });
  if (
    headerIndex === -1 ||
    !lines[headerIndex].trim().startsWith("messages:")
  ) {
    throw new Error("Inbox YAML must start with a top-level 'messages:' key.");
  }

  const blocks: InboxBlock[] = [];
  let currentBlock: InboxBlock | null = null;

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.startsWith("- ")) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {};
      continue;
    }

    if (!currentBlock) {
      continue;
    }

    const idMatch = line.match(/^  id:\s*(.+)$/);
    if (idMatch) {
      if (currentBlock.id !== undefined) {
        throw new Error(
          "Inbox YAML contains a duplicate id field within one message block.",
        );
      }
      currentBlock.id = stripYamlScalarQuotes(idMatch[1].trim());
      currentBlock.idLine = i;
      continue;
    }

    const readMatch = line.match(/^  read:\s*(true|false)\s*$/);
    if (readMatch) {
      if (currentBlock.read !== undefined) {
        throw new Error(
          "Inbox YAML contains a duplicate read field within one message block.",
        );
      }
      currentBlock.read = readMatch[1] as "true" | "false";
      currentBlock.readLine = i;
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return { lines, newline, blocks };
}

async function atomicWrite(filePath: string, contents: string): Promise<void> {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(tempPath, contents, "utf8");
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withInboxLock<T>(
  inboxPath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockDir = `${inboxPath}.lock.d`;

  for (let attempt = 0; attempt < LOCK_RETRY_COUNT; attempt += 1) {
    try {
      await mkdir(lockDir);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "EEXIST") {
        throw error;
      }
      await sleep(LOCK_RETRY_DELAY_MS);
      continue;
    }

    try {
      return await operation();
    } finally {
      await rmdir(lockDir).catch(() => {});
    }
  }

  throw new Error(
    `Failed to acquire inbox lock: ${path.relative(process.cwd(), lockDir)}`,
  );
}

function assertCurrentAgent(targetAgentId: string): void {
  const currentAgentId = process.env.OPENCODE_AGENT_ID?.trim();
  if (!currentAgentId) {
    throw new Error(
      "OPENCODE_AGENT_ID is required so mark-as-read can only update the current agent's inbox.",
    );
  }
  if (currentAgentId !== targetAgentId) {
    throw new Error(
      `Refusing to mark another agent's inbox as read: current=${currentAgentId}, target=${targetAgentId}.`,
    );
  }
}

async function markAsRead(
  worktree: string,
  agentId: string,
  messageId: string,
): Promise<{
  inboxPath: string;
  relativeInboxPath: string;
  changed: boolean;
}> {
  const normalizedMessageId = messageId.trim();
  if (!normalizedMessageId) {
    throw new Error("messageId must not be empty.");
  }

  const normalizedAgentId = agentId.trim();
  assertCurrentAgent(normalizedAgentId);

  const inboxPath = resolveInboxPath(worktree, normalizedAgentId);
  return withInboxLock(inboxPath, async () => {
    const raw = await readFile(inboxPath, "utf8");
    const { lines, newline, blocks } = parseInbox(raw);

    const targetBlocks = blocks.filter(
      (block) => block.id === normalizedMessageId,
    );
    if (targetBlocks.length === 0) {
      throw new Error(
        `Message ${JSON.stringify(normalizedMessageId)} was not found in ${path.relative(worktree, inboxPath)}.`,
      );
    }
    if (targetBlocks.length > 1) {
      throw new Error(
        `Inbox YAML contains duplicate message id ${JSON.stringify(normalizedMessageId)}.`,
      );
    }

    const targetBlock = targetBlocks[0];
    if (targetBlock.read === undefined) {
      throw new Error(
        `Message ${JSON.stringify(normalizedMessageId)} in ${path.relative(worktree, inboxPath)} has no read field.`,
      );
    }

    if (targetBlock.read === "true") {
      return {
        inboxPath,
        relativeInboxPath: path
          .relative(worktree, inboxPath)
          .split(path.sep)
          .join("/"),
        changed: false,
      };
    }

    if (targetBlock.readLine === undefined) {
      throw new Error(
        `Message ${JSON.stringify(normalizedMessageId)} in ${path.relative(worktree, inboxPath)} has no read line.`,
      );
    }

    lines[targetBlock.readLine] = "  read: true";
    const updated = lines.join(newline);
    await atomicWrite(
      inboxPath,
      updated.endsWith(newline) ? updated : `${updated}${newline}`,
    );

    return {
      inboxPath,
      relativeInboxPath: path
        .relative(worktree, inboxPath)
        .split(path.sep)
        .join("/"),
      changed: true,
    };
  });
}

export default tool({
  description:
    "Mark one processed inbox entry as read without using the generic Edit tool",
  args: {
    agentId: tool.schema
      .string()
      .trim()
      .regex(
        AGENT_ID_RE,
        "Agent IDs must match an inbox file name such as karo or ashigaru3",
      )
      .describe("Target inbox owner"),
    messageId: tool.schema
      .string()
      .trim()
      .min(1)
      .describe("Inbox message id to mark as read"),
  },
  async execute(args, context) {
    if (!context.worktree) {
      throw new Error(
        "mark-as-read requires context.worktree so it can edit queue/inbox files under the repo root.",
      );
    }

    const result = await markAsRead(
      context.worktree,
      args.agentId,
      args.messageId,
    );
    return result.changed
      ? `Marked ${result.relativeInboxPath} message ${args.messageId} as read.`
      : `Message ${args.messageId} in ${result.relativeInboxPath} was already read.`;
  },
});

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/MainActivity.kt`
```
package com.shogun.android

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import com.shogun.android.ssh.SshManager
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.shogun.android.ui.theme.*
import com.shogun.android.util.PrefsKeys
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.shogun.android.ui.AgentsScreen
import com.shogun.android.ui.DashboardScreen
import com.shogun.android.ui.SettingsScreen
import com.shogun.android.ui.ShogunScreen
import com.shogun.android.ui.theme.ShogunTheme

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    object Shogun : Screen("shogun", "将軍", Icons.Default.Star)
    object Agents : Screen("agents", "エージェント", Icons.Default.List)
    object Dashboard : Screen("dashboard", "戦況", Icons.Default.Home)
    object Settings : Screen("settings", "設定", Icons.Default.Settings)
}

val bottomNavItems = listOf(
    Screen.Shogun,
    Screen.Agents,
    Screen.Dashboard,
    Screen.Settings
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationHelper.initChannels(this)
        setContent {
            ShogunTheme {
                ShogunApp()
            }
        }
        handleShareIntent(intent)
        // Only start NtfyService if notification permission is granted (Android 13+)
        val hasNotifPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        } else true
        if (hasNotifPerm && getSharedPreferences(PrefsKeys.PREFS_NAME, MODE_PRIVATE)
                .getBoolean(PrefsKeys.NOTIFICATION_ENABLED, true)) {
            try {
                startForegroundService(Intent(this, NtfyService::class.java))
            } catch (_: Exception) {
                // Foreground service start blocked by system — skip silently
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShareIntent(intent)
    }

    private fun handleShareIntent(intent: Intent) {
        val imageUris: List<Uri> = when (intent.action) {
            Intent.ACTION_SEND -> {
                val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_STREAM)
                }
                listOfNotNull(uri)
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
                } ?: emptyList()
            }
            else -> return
        }
        if (imageUris.isEmpty()) return

        val sshManager = SshManager.getInstance()
        if (!sshManager.isConnected()) {
            Toast.makeText(this, "❌ SSH未接続。先にアプリを開いて接続してください", Toast.LENGTH_LONG).show()
            return
        }

        val prefs = getSharedPreferences(PrefsKeys.PREFS_NAME, Context.MODE_PRIVATE)
        val projectPath = prefs.getString(PrefsKeys.PROJECT_PATH, "") ?: ""
        if (projectPath.isBlank()) {
            Toast.makeText(this, "❌ 設定画面でプロジェクトパスを設定してください", Toast.LENGTH_LONG).show()
            return
        }
        val total = imageUris.size
        Toast.makeText(this, "転送中... (${total}枚)", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch {
            var success = 0
            var failed = 0
            for (uri in imageUris) {
                sshManager.uploadScreenshot(this@MainActivity, uri, projectPath).fold(
                    onSuccess = { success++ },
                    onFailure = { failed++ }
                )
            }
            val msg = if (failed == 0) "✅ ${success}枚 転送完了" else "✅ ${success}枚 完了 / ❌ ${failed}枚 失敗"
            Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
        }
    }
}

@Composable
fun ShogunApp() {
    val context = LocalContext.current
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // BGM — 3 tracks, tap to cycle: shogun → shogun_reiwa → shogun_ashigirls → OFF → shogun ...
    data class BgmTrack(val resId: Int, val label: String)
    val tracks = remember { listOf(
        BgmTrack(R.raw.shogun, "将軍"),
        BgmTrack(R.raw.shogun_reiwa, "令和"),
        BgmTrack(R.raw.shogun_ashigirls, "足軽ガールズ")
    ) }
    var currentTrackIndex by remember { mutableIntStateOf(-1) } // -1 = OFF
    var isBgmPlaying by remember { mutableStateOf(false) }
    var bgmTrackLabel by remember { mutableStateOf("") }
    val audioManager = remember { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    var mediaPlayer by remember { mutableStateOf<MediaPlayer?>(null) }

    // AudioFocus
    val focusRequest = remember {
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setOnAudioFocusChangeListener { focusChange ->
                when (focusChange) {
                    AudioManager.AUDIOFOCUS_LOSS -> {
                        mediaPlayer?.pause()
                        isBgmPlaying = false
                    }
                }
            }
            .build()
    }

    fun switchTrack(index: Int) {
        mediaPlayer?.release()
        if (index < 0) {
            mediaPlayer = null
            audioManager.abandonAudioFocusRequest(focusRequest)
            isBgmPlaying = false
            currentTrackIndex = -1
            bgmTrackLabel = ""
            return
        }
        val track = tracks[index]
        mediaPlayer = MediaPlayer.create(context, track.resId)?.apply {
            isLooping = true
            setVolume(1.0f, 1.0f)
        }
        audioManager.requestAudioFocus(focusRequest)
        mediaPlayer?.start()
        currentTrackIndex = index
        isBgmPlaying = true
        bgmTrackLabel = track.label
    }

    DisposableEffect(Unit) {
        onDispose {
            audioManager.abandonAudioFocusRequest(focusRequest)
            mediaPlayer?.release()
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            NavigationBar(
                containerColor = Shikkoku,
                contentColor = Kinpaku,
            ) {
                bottomNavItems.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label, fontSize = 10.sp, maxLines = 1) },
                        selected = currentRoute == screen.route,
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Kinpaku,
                            selectedTextColor = Kinpaku,
                            unselectedIconColor = TextMuted,
                            unselectedTextColor = TextMuted,
                            indicatorColor = Sumi,
                        ),
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
       
```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/NotificationHelper.kt`
```
package com.shogun.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.shogun.android.util.PrefsKeys

object NotificationHelper {

    private const val CH_CMD_COMPLETE = "cmd_complete"
    private const val CH_CMD_FAILURE = "cmd_failure"
    private const val CH_ACTION_REQUIRED = "action_required"
    private const val CH_DASHBOARD_UPDATE = "dashboard_update"
    private const val CH_STREAK_UPDATE = "streak_update"
    private const val CH_AGENT_RESPONSE = "agent_response"

    fun initChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        val channels = listOf(
            NotificationChannel(CH_CMD_COMPLETE, "タスク完了", NotificationManager.IMPORTANCE_DEFAULT).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 200)
            },
            NotificationChannel(CH_CMD_FAILURE, "タスク失敗", NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 100, 300)
            },
            NotificationChannel(CH_ACTION_REQUIRED, "要対応", NotificationManager.IMPORTANCE_HIGH).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 300, 100, 300)
            },
            NotificationChannel(CH_DASHBOARD_UPDATE, "ダッシュボード", NotificationManager.IMPORTANCE_LOW).apply {
                enableVibration(false)
            },
            NotificationChannel(CH_STREAK_UPDATE, "ストリーク", NotificationManager.IMPORTANCE_LOW).apply {
                enableVibration(false)
            },
            NotificationChannel(CH_AGENT_RESPONSE, "エージェント", NotificationManager.IMPORTANCE_LOW).apply {
                enableVibration(false)
            },
        )
        nm.createNotificationChannels(channels)
    }

    fun showNotification(context: Context, message: String, tags: List<String>, title: String) {
        val prefs = context.getSharedPreferences(PrefsKeys.PREFS_NAME, Context.MODE_PRIVATE)

        val channelId: String
        val prefKey: String
        when {
            tags.any { it.contains("cmd_complete") } -> {
                channelId = CH_CMD_COMPLETE
                prefKey = "notify_cmd_complete"
            }
            tags.any { it.contains("failure") } -> {
                channelId = CH_CMD_FAILURE
                prefKey = "notify_cmd_failure"
            }
            tags.any { it.contains("action_required") } -> {
                channelId = CH_ACTION_REQUIRED
                prefKey = "notify_action_required"
            }
            tags.any { it.contains("dashboard") } -> {
                channelId = CH_DASHBOARD_UPDATE
                prefKey = "notify_dashboard_update"
            }
            tags.any { it.contains("streak") } -> {
                channelId = CH_STREAK_UPDATE
                prefKey = "notify_streak_update"
            }
            tags.any { it.contains("agent") } -> {
                channelId = CH_AGENT_RESPONSE
                prefKey = "notify_agent_response"
            }
            else -> {
                channelId = CH_CMD_COMPLETE
                prefKey = "notify_cmd_complete"
            }
        }

        if (!prefs.getBoolean(prefKey, true)) return

        val pendingIntent = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = Notification.Builder(context, channelId)
            .setContentTitle(title.ifBlank { "将軍通知" })
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        val nm = context.getSystemService(NotificationManager::class.java)
        nm.notify(System.currentTimeMillis().toInt(), notification)
    }
}

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/NtfyService.kt`
```
package com.shogun.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import com.shogun.android.util.Defaults
import com.shogun.android.util.PrefsKeys
import java.util.concurrent.TimeUnit

class NtfyService : Service() {

    private val client = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var lastReceivedId: String = ""
    private var backoffIndex = 0
    private val reconnectHandler = Handler(Looper.getMainLooper())
    private var reconnectRunnable: Runnable? = null
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    companion object {
        private const val CHANNEL_ID = "ntfy_service"
        private const val NOTIFICATION_ID = 2
        private val TOPIC = Defaults.NTFY_TOPIC
        private val BACKOFF_DELAYS = longArrayOf(5_000L, 10_000L, 30_000L, 60_000L)
    }

    override fun onCreate() {
        super.onCreate()
        val prefs = getSharedPreferences(PrefsKeys.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(PrefsKeys.NOTIFICATION_ENABLED, true)) {
            stopSelf()
            return
        }
        createForegroundChannel()
        startForeground(NOTIFICATION_ID, buildForegroundNotification())
        connectivityManager = getSystemService(ConnectivityManager::class.java)
        registerNetworkCallback()
        connect()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onBind(intent: Intent): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        reconnectRunnable?.let { reconnectHandler.removeCallbacks(it) }
        networkCallback?.let { connectivityManager.unregisterNetworkCallback(it) }
        webSocket?.cancel()
        client.dispatcher.executorService.shutdown()
    }

    private fun connect() {
        val since = if (lastReceivedId.isNotEmpty()) "?since=$lastReceivedId" else "?since=30m"
        val url = "wss://ntfy.sh/$TOPIC/ws$since"
        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, NtfyWebSocketListener())
    }

    private fun scheduleReconnect() {
        reconnectRunnable?.let { reconnectHandler.removeCallbacks(it) }
        val delay = BACKOFF_DELAYS.getOrElse(backoffIndex) { BACKOFF_DELAYS.last() }
        if (backoffIndex < BACKOFF_DELAYS.size - 1) backoffIndex++
        reconnectRunnable = Runnable { connect() }.also {
            reconnectHandler.postDelayed(it, delay)
        }
    }

    private fun registerNetworkCallback() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                reconnectRunnable?.let { reconnectHandler.removeCallbacks(it) }
                webSocket?.cancel()
                backoffIndex = 0
                connect()
            }
        }
        connectivityManager.registerNetworkCallback(request, networkCallback!!)
    }

    private fun createForegroundChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "ntfy接続",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "プッシュ通知の受信を維持します"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildForegroundNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("将軍通知")
            .setContentText("ntfy受信中...")
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    inner class NtfyWebSocketListener : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            try {
                val json = JSONObject(text)
                if (json.optString("event") != "message") return

                lastReceivedId = json.optString("id", lastReceivedId)
                backoffIndex = 0

                val title = json.optString("title", "")
                val message = json.optString("message", "")
                val tagsArray = json.optJSONArray("tags")
                val tags = buildList {
                    if (tagsArray != null) {
                        for (i in 0 until tagsArray.length()) add(tagsArray.getString(i))
                    }
                }
                NotificationHelper.showNotification(this@NtfyService, message, tags, title)
            } catch (_: Exception) {
                // Malformed JSON — ignore
            }
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            scheduleReconnect()
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            scheduleReconnect()
        }
    }
}

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/SshForegroundService.kt`
```
package com.shogun.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.IBinder

class SshForegroundService : Service() {

    private val binder = SshBinder()

    inner class SshBinder : Binder() {
        fun getService(): SshForegroundService = this@SshForegroundService
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent): IBinder = binder

    override fun onDestroy() {
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "SSH接続",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "将軍セッションのSSH接続を維持します"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("将軍アプリ")
            .setContentText("将軍セッション接続中")
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "ssh_connection"
        private const val NOTIFICATION_ID = 1
    }
}

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/ssh/SshManager.kt`
```
package com.shogun.android.ssh

import android.content.Context
import android.net.Uri
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.ChannelSftp
import com.jcraft.jsch.JSch
import com.jcraft.jsch.Session
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import com.shogun.android.util.AppLogger
import java.io.File
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.Properties

class SshManager private constructor() {

    companion object {
        @Volatile private var INSTANCE: SshManager? = null
        fun getInstance(): SshManager = INSTANCE ?: synchronized(this) {
            INSTANCE ?: SshManager().also { INSTANCE = it }
        }
    }

    @Volatile private var session: Session? = null

    // Mutex serializes ALL SSH operations (exec, reconnect, connect).
    // Prevents race condition where multiple ViewModels' concurrent reconnects
    // kill each other's newly-created sessions.
    private val sshMutex = Mutex()

    // Stored for reconnect
    private var lastHost = ""
    private var lastPort = 22
    private var lastUser = ""
    private var lastKeyPath = ""
    private var lastPassword = ""

    var disconnectCallback: (() -> Unit)? = null

    suspend fun connect(
        host: String,
        port: Int,
        user: String,
        privateKeyPath: String,
        password: String = "",
        onOutput: ((String) -> Unit)? = null,
        onDisconnect: (() -> Unit)? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        if (onDisconnect != null) disconnectCallback = onDisconnect

        sshMutex.withLock {
            if (isConnectedInternal()) {
                AppLogger.log("SSH", "Already connected, skipping")
                return@withContext Result.success(Unit)
            }

            AppLogger.log("SSH", "Connecting to $host:$port user=$user key=${privateKeyPath.takeLast(20)}")
            lastHost = host
            lastPort = port
            lastUser = user
            lastKeyPath = privateKeyPath.trim()
            lastPassword = password
            connectInternal()
        }
    }

    private fun connectInternal(): Result<Unit> {
        return try {
            val trimmedPassword = lastPassword.trim()
            val jsch = JSch()
            val privateKeyIdentity = loadPrivateKeyIdentity()
            if (privateKeyIdentity != null) {
                val (identityName, privateKeyBytes) = privateKeyIdentity
                val passphraseBytes = trimmedPassword.takeIf { it.isNotEmpty() }?.toByteArray()
                jsch.addIdentity(identityName, privateKeyBytes, null, passphraseBytes)
            }
            val newSession = jsch.getSession(lastUser, lastHost, lastPort)
            val config = Properties()
            config["StrictHostKeyChecking"] = "no"
            config["MaxAuthTries"] = "2"
            if (privateKeyIdentity != null) {
                config["PreferredAuthentications"] = "publickey"
            } else {
                config["PreferredAuthentications"] = "keyboard-interactive,password"
            }
            newSession.setConfig(config)
            if (privateKeyIdentity == null && trimmedPassword.isNotEmpty()) {
                newSession.setPassword(trimmedPassword)
            }
            var passwordAttempted = false
            val userInfo = object : com.jcraft.jsch.UserInfo {
                override fun getPassword(): String = trimmedPassword
                override fun promptPassword(message: String): Boolean {
                    if (passwordAttempted) return false
                    passwordAttempted = true
                    return true
                }
                override fun promptPassphrase(message: String): Boolean = true
                override fun getPassphrase(): String = ""
                override fun promptYesNo(message: String): Boolean = true
                override fun showMessage(message: String) {}
            }
            newSession.userInfo = userInfo
            // No aggressive keepalive — Tailscale VPN delays cause false disconnects
            // Disconnect detection handled by exec retry logic instead
            newSession.connect(10000)
            session = newSession
            // Verify exec channel works immediately after connect
            val testResult = execCommandInternal(newSession, "echo ssh_exec_ok")
            if (testResult.isSuccess) {
                val out = testResult.getOrDefault("").trim()
                AppLogger.log("SSH", "Connected OK (exec verified: $out)")
            } else {
                AppLogger.log("SSH", "Connected but exec FAILED: ${testResult.exceptionOrNull()?.message}")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.log("SSH", "Connect FAILED: ${e.message}")
            Result.failure(Exception("SSH接続失敗 (pw=${lastPassword.trim().length}文字): ${e.message}", e))
        }
    }

    fun isConnected(): Boolean = session?.isConnected == true
    private fun isConnectedInternal(): Boolean = session?.isConnected == true

    /**
     * Execute a remote command via SSH exec channel.
     * All operations are serialized by sshMutex to prevent concurrent reconnect storms.
     * On session failure, reconnects and retries once.
     */
    suspend fun execCommand(cmd: String): Result<String> = withContext(Dispatchers.IO) {
        sshMutex.withLock {
            val s = session
            if (s == null || !s.isConnected) {
                AppLogger.log("SSH", "exec: session dead, reconnecting...")
                val reconn = reconnectLocked()
                if (reconn.isFailure) {
                    disconnectCallback?.invoke()
                    return@withContext Result.failure(IllegalStateException("SSH not connected"))
                }
            }

            val currentSession = session
            if (currentSession == null) {
                return@withContext Result.failure(IllegalStateException("SSH not connected"))
            }

            val result = execCommandInternal(currentSession, cmd)
            if (result.isSuccess) {
                return@withContext result
            }

            // Session died mid-exec — reconnect and retry once
            val errorMsg = result.exceptionOrNull()?.message ?: ""
            if (errorMsg.contains("channel is not opened") || errorMsg.contains("session is down")) {
                AppLogger.log("SSH", "exec failed (session dead), auto-reconnecting...")
                val reconn = reconnectLocked()
                if (reconn.isSuccess) {
                    val retrySession = session
                    if (retrySession != null) {
                        AppLogger.log("SSH", "Retrying exec after reconnect...")
                        return@withContext execCommandInternal(retrySession, cmd)
                    }
                }
                disconnectCallback?.invoke()
            }

            result
        }
    }

    /**
     * Reconnect while sshMutex is already held.
     * No synchronization needed — caller holds the mutex.
     */
    private fun reconnectLocked(): Result<Unit> {
        AppLogger.log("SSH", "reconnectLocked: disconnecting old session...")
        session?.disconnect()
        session = null
        val result = connectInternal()
        if (result.isSuccess) {
            AppLogger.log("SSH", "reconnectLocked: success")
        } else {
            AppLogger.log("SSH", "reconnectLocked: failed: ${result.exceptionOrNull()?.message}")
        }
        return result
    }

    private fun execCommandInternal(s: Session, cmd: String): Result<String> {
        val shortCmd = if (cmd.length > 80) cmd.take(80) + "..." else cmd
        return try {
            val channel = s.openChannel("exec") as ChannelExec
            channel.setCommand(cmd)
            val inputStream = channel.inputStream
            val errStream = channel.errStream
            channel.connect(5000)
            val baos = ByteArrayOutputStream()
            val errBaos = ByteArrayOutputStream()
            val buffer = ByteArray(4096)
            while (true) {
                val n = inputStream.read(buffer)
                if (n < 0) break
                baos.write(buffer, 0, n)
            }
            // Read any remaining stderr
            while (errStream.available() > 0) {
                val n = errStream.read(buffer)
                if (n < 0) break
                errBaos.write(buffer, 0, n)
            }
            channel.disconnect()
            val out = baos.toString("UTF-8")
            val err = errBaos.toString("UTF-8")
            if (err.isNotBlank()) {
                AppLogger.log("SSH", "exec STDERR (${err.length}ch): ${err.take(200)}")
            }
            AppLogger.log("SSH", "exec OK (${out.length}ch): $shortCmd")
            Result.success(out)
        } catch (e: Exception) {
            val trace = e.stackTraceToString().take(500)
            AppLogger.log("SSH", "exec FAIL: ${e.message} cmd=$shortCmd")
            AppLogger.log("SSH", "exec TRACE: $trace")
            Result.failure(e)
        }
    }

    suspend fun reconnect(maxAttempts: Int = 3, delayMs: Long = 5000): Result<Unit> =
        withContext(Dispatchers.IO) {
            AppLogger.log("SSH", "reconnect start (max=$maxAttempts)")
            var lastError: Exception? = null
            for (attempt in 0 until maxAttempts) {
                sshMutex.withLock {
                    session?.disconnect()
                    session = null
                    val result = connectInternal()
     
```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/ui/AgentsScreen.kt`
```
package com.shogun.android.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Speed
import androidx.core.content.ContextCompat
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.shogun.android.ui.theme.*
import com.shogun.android.util.Defaults
import com.shogun.android.util.PrefsKeys
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.shogun.android.R
import com.shogun.android.viewmodel.AgentsViewModel
import com.shogun.android.viewmodel.PaneInfo

// ── Rate limit data classes ──────────────────────────────────────────────────
private data class WindowInfo(val percent: Float, val resetStr: String)
private data class ClaudeMaxInfo(
    val window5h: WindowInfo?,
    val window7d: WindowInfo?,
    val sonnet7d: Float?,
    val opus7d: Float?,
    val todayTokens: String?,
    val sessions: Int?,
    val messages: Int?
)
private data class CodexQuotaInfo(
    val account5h: WindowInfo?,
    val account7d: WindowInfo?,
    val model5h: WindowInfo?,
    val model7d: WindowInfo?,
    val modelName: String?
)
private data class CodexEntry(val ashigaru: Int, val percent: Float?) // null = unknown

private data class RateLimitData(
    val claudeMax: ClaudeMaxInfo,
    val codexQuota: CodexQuotaInfo,
    val codexEntries: List<CodexEntry>
)

private fun parseRateLimitResult(text: String): RateLimitData {
    val window5h = Regex("""5h window:\s+([\d.]+)%.*\(resets ([^)]+)\)""").find(text)?.let {
        WindowInfo(it.groupValues[1].toFloatOrNull() ?: 0f, it.groupValues[2])
    }
    val window7d = Regex("""7d window:\s+([\d.]+)%.*\(resets ([^)]+)\)""").find(text)?.let {
        WindowInfo(it.groupValues[1].toFloatOrNull() ?: 0f, it.groupValues[2])
    }
    val sonnet7d = Regex("""sonnet 7d:\s+([\d.]+)%""").find(text)?.groupValues?.get(1)?.toFloatOrNull()
    val opus7d   = Regex("""opus 7d:\s+([\d.]+)%""").find(text)?.groupValues?.get(1)?.toFloatOrNull()
    val todayTokens = Regex("""Today:\s+([\d,]+) tokens""").find(text)?.groupValues?.get(1)
    val sessions = Regex("""Sessions:\s+(\d+)""").find(text)?.groupValues?.get(1)?.toIntOrNull()
    val messages = Regex("""Messages:\s+(\d+)""").find(text)?.groupValues?.get(1)?.toIntOrNull()

    val claudeMax = ClaudeMaxInfo(window5h, window7d, sonnet7d, opus7d, todayTokens, sessions, messages)

    // Codex quota: "5h limit: NN% left (resets HH:MM)" — note: "left" not "used"
    val quotaRegex5h = Regex("""5h limit:\s+(\d+)% left\s+\(resets ([^)]+)\)""")
    val quotaRegex7d = Regex("""Weekly limit:\s+(\d+)% left\s+\(resets ([^)]+)\)""")
    val all5h = quotaRegex5h.findAll(text).toList()
    val all7d = quotaRegex7d.findAll(text).toList()

    // First match = account-level, second = model-level
    val acct5h = all5h.getOrNull(0)?.let { WindowInfo(100f - (it.groupValues[1].toFloatOrNull() ?: 0f), it.groupValues[2]) }
    val acct7d = all7d.getOrNull(0)?.let { WindowInfo(100f - (it.groupValues[1].toFloatOrNull() ?: 0f), it.groupValues[2]) }
    val mdl5h  = all5h.getOrNull(1)?.let { WindowInfo(100f - (it.groupValues[1].toFloatOrNull() ?: 0f), it.groupValues[2]) }
    val mdl7d  = all7d.getOrNull(1)?.let { WindowInfo(100f - (it.groupValues[1].toFloatOrNull() ?: 0f), it.groupValues[2]) }
    val modelName = Regex("""Quota \(([^)]+)\)""").find(text)?.groupValues?.get(1)

    val codexQuota = CodexQuotaInfo(acct5h, acct7d, mdl5h, mdl7d, modelName)

    val codexEntries = mutableListOf<CodexEntry>()
    Regex("""(\d+):(\d+)%""").findAll(text).forEach { m ->
        val ash = m.groupValues[1].toIntOrNull() ?: return@forEach
        codexEntries.add(CodexEntry(ash, m.groupValues[2].toFloatOrNull()))
    }
    Regex("""(\d+):\?""").findAll(text).forEach { m ->
        val ash = m.groupValues[1].toIntOrNull() ?: return@forEach
        if (codexEntries.none { it.ashigaru == ash }) codexEntries.add(CodexEntry(ash, null))
    }
    codexEntries.sortBy { it.ashigaru }
    return RateLimitData(claudeMax, codexQuota, codexEntries)
}

private fun rateLimitBarColor(percent: Float): Color = when {
    percent >= 80f -> Color(0xFFCC4444)
    percent >= 50f -> Kinpaku
    else           -> Color(0xFF4CAF50)
}

private fun formatResetTime(resetStr: String): String {
    val locale = java.util.Locale.getDefault()
    val now = java.time.LocalDateTime.now()
    return try {
        if (resetStr.contains('T')) {
            val ldt = java.time.LocalDateTime.parse(resetStr.take(16))
            val dow = ldt.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, locale)
            val timeStr = "${ldt.monthValue}/${ldt.dayOfMonth}($dow) %02d:%02d".format(ldt.hour, ldt.minute)
            if (ldt.isBefore(now)) {
                "$timeStr にリセット済み"
            } else {
                "$timeStr にリセット"
            }
        } else {
            val ld = java.time.LocalDate.parse(resetStr)
            val today = java.time.LocalDate.now()
            val dow = ld.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, locale)
            val dateStr = "${ld.monthValue}/${ld.dayOfMonth}($dow)"
            if (ld.isBefore(today)) {
                "$dateStr にリセット済み"
            } else {
                "$dateStr にリセット"
            }
        }
    } catch (_: Exception) {
        resetStr
    }
}

@Composable
fun AgentsScreen(
    viewModel: AgentsViewModel = viewModel()
) {
    val context = LocalContext.current
    val panes by viewModel.panes.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val rateLimitLoading by viewModel.rateLimitLoading.collectAsState()
    val rateLimitResult by viewModel.rateLimitResult.collectAsState()

    var selectedPaneIndex by remember { mutableStateOf<Int?>(null) }
    var showRateLimitDialog by remember { mutableStateOf(false) }

    // Derive selected pane from live data so it auto-updates
    val selectedPane = selectedPaneIndex?.let { idx -> panes.find { it.index == idx } }

    LaunchedEffect(Unit) {
        val prefs = context.getSharedPreferences(PrefsKeys.PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val host = prefs.getString(PrefsKeys.SSH_HOST, Defaults.SSH_HOST) ?: Defaults.SSH_HOST
        val port = prefs.getString(PrefsKeys.SSH_PORT, Defaults.SSH_PORT_STR)?.toIntOrNull() ?: Defaults.SSH_PORT
        val user = prefs.getString(PrefsKeys.SSH_USER, "") ?: ""
        val keyPath = prefs.getString(PrefsKeys.SSH_KEY_PATH, "") ?: ""
        val password = prefs.getString(PrefsKeys.SSH_PASSWORD, "") ?: ""
        viewModel.connect(host, port, user, keyPath, password)
    }

    // Pause refresh when app is in background
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> viewModel.resumeRefresh()
                Lifecycle.Event.ON_PAUSE -> viewModel.pauseRefresh()
                else -> {}
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    if (selectedPane != null) {
        // Full screen pane detail — always reads from live panes list
        PaneFullScreen(
            pane = selectedPane,
            onBack = { selectedPaneIndex = null },
            onSendCommand = { cmd ->
                viewModel.sendCommandToPane(selectedPane.index, cmd)
            },
            onRefresh = { viewModel.refreshAllPanes() }
        )
    } else {
        // Grid view
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Shikkoku)
        ) {
            Image(
                painter = painterResource(R.drawable.bg_agents),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = 0.55f,
                modifier = Modifier.fillMaxSize()
            )
   
```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/ui/DashboardScreen.kt`
```
package com.shogun.android.ui

import android.webkit.WebView
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.ui.graphics.Color
import com.shogun.android.ui.theme.*
import com.shogun.android.util.Defaults
import com.shogun.android.util.PrefsKeys
import androidx.compose.ui.layout.ContentScale
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import com.shogun.android.R
import com.shogun.android.viewmodel.DashboardViewModel
import org.commonmark.ext.gfm.tables.TablesExtension
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = viewModel()
) {
    val context = LocalContext.current
    val markdownContent by viewModel.markdownContent.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    val htmlContent = remember(markdownContent) {
        if (markdownContent.isBlank()) "" else markdownToHtml(markdownContent)
    }

    LaunchedEffect(Unit) {
        val prefs = context.getSharedPreferences(PrefsKeys.PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val host = prefs.getString(PrefsKeys.SSH_HOST, Defaults.SSH_HOST) ?: Defaults.SSH_HOST
        val port = prefs.getString(PrefsKeys.SSH_PORT, Defaults.SSH_PORT_STR)?.toIntOrNull() ?: Defaults.SSH_PORT
        val user = prefs.getString(PrefsKeys.SSH_USER, "") ?: ""
        val keyPath = prefs.getString(PrefsKeys.SSH_KEY_PATH, "") ?: ""
        val password = prefs.getString(PrefsKeys.SSH_PASSWORD, "") ?: ""
        viewModel.connect(host, port, user, keyPath, password)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Shikkoku)
    ) {
        Image(
            painter = painterResource(R.drawable.bg_castle),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alpha = 0.55f,
            modifier = Modifier.fillMaxSize()
        )
        if (errorMessage != null) {
            Box(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "エラー: $errorMessage",
                    color = MaterialTheme.colorScheme.error
                )
            }
        } else if (markdownContent.isBlank() && !isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("読み込み中…", color = Zouge)
            }
        } else {
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        setBackgroundColor(android.graphics.Color.TRANSPARENT)
                        settings.javaScriptEnabled = false
                        settings.allowContentAccess = true
                        settings.allowFileAccess = true
                        settings.domStorageEnabled = true
                        settings.setSupportMultipleWindows(true)
                        isFocusable = true
                        isFocusableInTouchMode = true
                        isLongClickable = true
                        setOnLongClickListener { false }
                        setOnTouchListener { _, _ -> false }
                    }
                },
                update = { webView ->
                    if (htmlContent.isNotBlank()) {
                        val fullHtml = buildDashboardHtml(htmlContent)
                        webView.loadDataWithBaseURL(null, fullHtml, "text/html", "UTF-8", null)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    } // Box
}

private fun markdownToHtml(markdown: String): String {
    val extensions = listOf(TablesExtension.create())
    val parser = Parser.builder().extensions(extensions).build()
    val renderer = HtmlRenderer.builder().extensions(extensions).build()
    val document = parser.parse(markdown)
    return renderer.render(document)
}

private fun buildDashboardHtml(bodyHtml: String): String = """
<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body {
    color: #E8DCC8;
    background: transparent;
    -webkit-user-select: text !important;
    -webkit-touch-callout: default;
    font-family: -apple-system, sans-serif;
    user-select: text !important;
    font-size: 14px;
    padding: 16px;
    margin: 0;
    -webkit-text-size-adjust: 100%;
}
* {
    -webkit-user-select: text !important;
    user-select: text !important;
}
h1, h2, h3, h4 { color: #C9A94E; margin-top: 16px; margin-bottom: 8px; }
h1 { font-size: 20px; }
h2 { font-size: 17px; }
h3 { font-size: 15px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { border: 1px solid #555; padding: 6px 8px; text-align: left; }
th { background-color: rgba(60,60,60,0.8); color: #C9A94E; }
tr:nth-child(even) { background-color: rgba(45,45,45,0.5); }
a { color: #D4B96A; }
code { background-color: #333; padding: 1px 4px; border-radius: 3px; font-size: 13px; }
pre { background-color: #222; padding: 8px; border-radius: 4px; overflow-x: auto; }
pre code { background: none; padding: 0; }
ul, ol { padding-left: 20px; }
li { margin-bottom: 4px; }
hr { border: none; border-top: 1px solid #555; margin: 12px 0; }
::selection { background: #C9A94E; color: #1A1A1A; }
</style>
</head>
<body>$bodyHtml</body></html>
""".trimIndent()

```

### Core Architecture Module: `android/app/src/main/java/com/shogun/android/ui/NtfySettingsSection.kt`
```
package com.shogun.android.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.shogun.android.ui.theme.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.shogun.android.viewmodel.SettingsViewModel

@Composable
fun NtfySettingsSection(viewModel: SettingsViewModel) {
    val notificationEnabled by viewModel.notificationEnabled.collectAsState()
    val ntfyTopic by viewModel.ntfyTopic.collectAsState()
    val notifyCmdComplete by viewModel.notifyCmdComplete.collectAsState()
    val notifyCmdFailure by viewModel.notifyCmdFailure.collectAsState()
    val notifyActionRequired by viewModel.notifyActionRequired.collectAsState()
    val notifyDashboardUpdate by viewModel.notifyDashboardUpdate.collectAsState()
    val notifyStreakUpdate by viewModel.notifyStreakUpdate.collectAsState()
    val notifyAgentResponse by viewModel.notifyAgentResponse.collectAsState()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "通知設定",
            style = MaterialTheme.typography.titleMedium,
            color = Kinpaku,
            fontWeight = FontWeight.Bold
        )

        // Master toggle
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("通知を有効にする", color = Zouge)
            Switch(
                checked = notificationEnabled,
                onCheckedChange = { viewModel.setNotificationEnabled(it) },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = Shuaka,
                    uncheckedThumbColor = Color.White,
                    uncheckedTrackColor = TextMuted
                )
            )
        }

        // ntfy topic field
        OutlinedTextField(
            value = ntfyTopic,
            onValueChange = { viewModel.setNtfyTopic(it) },
            label = { Text("ntfyトピック", color = TextTertiary) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = Zouge,
                unfocusedTextColor = Zouge,
                focusedContainerColor = Surface4,
                unfocusedContainerColor = Surface4,
                focusedBorderColor = BorderFocus,
                unfocusedBorderColor = BorderStandard
            )
        )

        Text(
            "カテゴリ別通知（マスタースイッチON時のみ有効）",
            style = MaterialTheme.typography.bodySmall,
            color = TextTertiary
        )

        NtfyCategoryToggle(
            label = "✅ タスク完了",
            checked = notifyCmdComplete,
            onCheckedChange = { viewModel.setNotifyCmdComplete(it) },
            enabled = notificationEnabled
        )
        NtfyCategoryToggle(
            label = "❌ タスク失敗",
            checked = notifyCmdFailure,
            onCheckedChange = { viewModel.setNotifyCmdFailure(it) },
            enabled = notificationEnabled
        )
        NtfyCategoryToggle(
            label = "🚨 要対応",
            checked = notifyActionRequired,
            onCheckedChange = { viewModel.setNotifyActionRequired(it) },
            enabled = notificationEnabled
        )
        NtfyCategoryToggle(
            label = "📊 ダッシュボード更新",
            checked = notifyDashboardUpdate,
            onCheckedChange = { viewModel.setNotifyDashboardUpdate(it) },
            enabled = notificationEnabled
        )
        NtfyCategoryToggle(
            label = "🔥 ストリーク更新",
            checked = notifyStreakUpdate,
            onCheckedChange = { viewModel.setNotifyStreakUpdate(it) },
            enabled = notificationEnabled
        )
        NtfyCategoryToggle(
            label = "💬 エージェント応答",
            checked = notifyAgentResponse,
            onCheckedChange = { viewModel.setNotifyAgentResponse(it) },
            enabled = notificationEnabled
        )
    }
}

@Composable
private fun NtfyCategoryToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            color = if (enabled) Zouge else TextMuted
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Shuaka,
                uncheckedThumbColor = Color.White,
                uncheckedTrackColor = TextMuted,
                disabledCheckedThumbColor = Color(0xFF999999),
                disabledCheckedTrackColor = Color(0xFF555555),
                disabledUncheckedThumbColor = Color(0xFF999999),
                disabledUncheckedTrackColor = Color(0xFF555555)
            )
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #173** (2026-07-29): **SEC-001: gitleaksの自動実行および検出対象が不足している**
  *Symptoms*: ## 重大度 High  ## 問題 - `.gitleaks.toml` は存在するが、GitHub ActionsでもRun pre-commitでも実行されない - カスタムルールの対象が限定的（APIキー系が中心） - SSH秘密鍵ブロック、PEM証明書、Tailscale auth key（tskey-）等の重大な漏洩パターンを   十分に検出できない - 開発者が「安全網がある」と誤認する可能性がある  「設定ファイルだけ存在して自動実行されない」状態は、削除して安全網がないと 明示される状態より危険である。  ## 違反する要件 - NFR-014（秘密情報管理） - NFR-015（構成管理対象） - AC-016（CIによる秘密情報混入検証）— 現状では受入不可 - AC-020（Discord Webhook等の秘密情報保護）  ## 完了条件 1. Pull Requestおよび主要ブランチへのpush時にgitleaksが実行される 2. 全Git履歴または適切なコミット範囲を検査する 3. CI失敗時にマージを阻止できる 4. ローカルpre-commitまたは同等の事前検査手段を用意する 5. SSH秘密鍵、各種秘密鍵ブロック、認証トークン、Webhook URL等を検出対象にする 6. 意図的なテスト文字列に対するallowlistを最小限にする 7. 検出テストをCIへ追加する 8. READMEまたはセキュリティ手順に実行方法を記載する  ## 注記 公開用のPEM証明書自体は秘密情報とは限らない。一律にPEMファイルを禁止するのではなく、 秘密鍵ブロックや秘密情報を含むPEMを確実に検出する設計が適切。  ## cmd_001との関係 cmd_001（AIエージェント監視・可視化システム構築）は本Issueとは分離し、変更なしで継続する。 ただし、cmd_001のAC-016・AC-020はSEC-001解消まで未達とする。 Webhook・Tailscale認証キー等の実秘密情報を扱う工程（Phase 7）は、 SEC-001解消前には進めないことを推奨する。  ## 発見の経緯 cmd_001の品質チェック中に軍師が発見。QC-005（*secret*パターンの過剰ブロックにより 検査機構自体がgit追跡から除外される自己矛盾）の調査中に判明した別件。 
  **Post-Mortem & Fix Analysis**:
  > すみません。記載リポジトリのミスです。

- **Issue #171** (2026-07-02): **skill_candidate pipeline が null 常態化と finalize bypass で機能不全になる**
  *Symptoms*: Filed in the wrong repository by mistake. Content moved to the private tracker. Sorry for the noise.

- **Issue #168** (2026-06-12): **feat(guard): Hook #7 — 上流 repo への gh pr create を機械ブロック**
  *Symptoms*: ## 概要  V002 CRITICAL 恒久対策。足軽1が `yohey-w/multi-agent-shogun` に2度誤 PR した事例を受け、 `guard.sh` に Hook #7 を追加。`gh pr create` 実行時に上流 repo が指定されている場合を PreToolUse 段階で強制拒否する。  ## 変更内容  ### `scripts/hooks/guard.sh` — Hook #7 追加  - `gh pr create` コマンドで `--repo yohey-w/*` / `--repo digital-go-jp/*` を検知 → exit 2 - `cwd` の `git remote origin` が上流を指している場合も同様にブロック - read-only 操作 (`gh api` / `gh pr list` 等) はブロックしない  ### `scripts/hooks/test_hooks.sh` — テスト 5 件追加  | テストケース | 期待 | |---|---| | `gh pr create --repo yohey-w/multi-agent-shogun` | BLOCK | | `gh pr create --repo digital-go-jp/genai-web` | BLOCK | | `gh pr create --repo halsk/multi-agent-shogun` | ALLOW | | `gh pr create --repo geolonia/geonicdb-docs` | ALLOW | | `gh api repos/yohey-w/multi-agent-shogun/pulls` (read-only) | ALLOW |  ## テスト結果  ``` bash scripts/hooks/test_hooks.sh Results: PASS=68, FAIL=0 ✅ 全テスト通過 ```  ## 構文チェック  ``` bash -n scripts/hooks/guard.sh → 構文OK ```
  **Post-Mortem & Fix Analysis**:
  > 誤作成。halsk/multi-agent-shogun に作り直します。

- **Issue #167** (2026-06-12): **feat(scripts): macOS Keychain 秘密キャッシュ helper (cmd_514)**
  *Symptoms*: ## Summary  - `scripts/get-secret.sh`: macOS は Keychain 優先 / op fallback、WSL/Linux は op 直接委譲 - `scripts/sync-secrets-to-keychain.sh`: 1Password → macOS Keychain 一括同期スクリプト (macOS 専用) - `.gitignore`: ホワイトリストに2ファイルを追加  ## 軍師条件付きPASS 対応 (C1-C6 + V1)  | 条件 | 対応 | |------|------| | C1: -A 禁止、partition-list 最小権限 | `security set-generic-password-partition-list -S "apple-tool:,apple:"` で実装。失敗時は警告+継続 | | C2: argv 秘密露出回避 | ヘッダコメントに限界と対策を明記。macOS では他ユーザのプロセス args は不可視 | | C3: set+x / echo・log 禁止 | スクリプト冒頭 `set +x`、関数内でも再設定。秘密を stdout 以外に一切出力しない | | C4a: rotation 手順明記 | `sync-secrets-to-keychain.sh` ヘッダの ROTATION PROCEDURE セクション | | C4b: miss→fallback→exit 1 | Keychain miss → op fallback → 両失敗で exit 1 | | C5: FileVault 推奨明記 | 両スクリプトのセキュリティノートに FileVault 有効化手順を記載 | | C6: WSL2 非破壊 | Darwin 分岐のみ追加。WSL/Linux は `op item get` 直接で完全非破壊 | | V1: prompt-free 実証 | `bash -c 'source scripts/get-secret.sh; get_secret test-keychain-entry'` → Touch ID なしで値取得を実機確認 |  ## Test plan  - [ ] `bash -n scripts/get-secret.sh` → syntax OK - [ ] `bash -n scripts/sync-secrets-to-keychain.sh` → syntax OK - [ ] WSL/Linux で `sync-secrets-to-keychain.sh` 実行 → `INFO: macOS-only. Skipping.` で即 exit 0 - [ ] macOS で `bash -c 'source scripts/get-secret.sh; get_secret <synced-key>'` → Touch ID なしで値返却 - [ ] op 未認証時に `get_secret nonexistent` → `ERROR: ... not found` + exit 1
  **Post-Mortem & Fix Analysis**:
  > 誤作成。halsk/multi-agent-shogun に正 PR を作成します。

- **Issue #166** (2026-06-11): **feat(gunshi2): Fable 5 第二軍師を swarm に常設追加 (創造/知識業務専任)**
  *Symptoms*: ## Summary  - gunshi2 (claude-fable-5) を 10 番目エージェントとして swarm に常設追加 - gunshi (Opus) = cyber/security/QC、gunshi2 (Fable) = 創造/知識業務 の役割分担を確立 - Fable の cyber タスク Usage Policy 拒否を防ぐため、karo.md に明示的な振り分けルールを追加  ## Changes  | ファイル | 内容 | |---------|------| | `instructions/gunshi2.md` | 第二軍師指示書。F006 cyber FORBIDDEN 明記 | | `lib/cli_adapter.sh` | `get_instruction_file` + Fable 表示名 (`*fable*→Fable`) 追加 | | `scripts/watcher_supervisor.sh` | `ALL_AGENTS` に gunshi2 追加 | | `scripts/switch_cli.sh` | フォールバック固定マッピングに gunshi2 (pane_base+9) 追加 | | `scripts/inbox_watcher.sh` | command-layer agent 判定 2 箇所に gunshi2 追加 | | `scripts/ratelimit_check.sh` | `ALL_AGENTS` に gunshi2 追加 | | `instructions/karo.md` | gunshi vs gunshi2 振り分けルール + dispatch 手順追記 | | `docs/migration-to-macos.md` | 10 pane 構成 + gunshi2 手動追加手順 | | `.gitignore` | `instructions/gunshi2.md` を whitelist 追加 |  ## Test plan  - [x] `bash -n` 全変更スクリプト構文チェック OK - [x] `get_cli_type gunshi2` → `claude` - [x] `get_agent_model gunshi2` → `claude-fable-5` - [x] `get_model_display_name gunshi2` → `Fable+T` (worktree lib 使用時) - [x] `inbox_write → gunshi2` 到達確認 (queue/inbox/gunshi2.yaml に届くことを実証) - [x] config/settings.yaml gunshi2 エントリ追加確認 - [x] queue/inbox/gunshi2.yaml, queue/tasks/gunshi2.yaml, queue/reports/gunshi2_report.yaml 作成済  ## Notes  - `config/settings.yaml` は gitignore 対象のため PR 外。殿/将軍が手動で追加済み - queue/ ファイル (inbox/tasks/reports) も gitignore 対象のため PR 外。メインリポに直接作成済み - gunshi2 pane の実際の起動は `docs/migration-to-macos.md` の手動手順を参照
  **Post-Mortem & Fix Analysis**:
  > 誤作成。halsk fork 側で PR を作成し直します。

- **Issue #164** (2026-06-03): **post-merge live GATE-NG: ashigaru3-7 and haru_urara panes fell back to bash with blank @agent_cli**
  *Symptoms*: ## Summary  During cmd_525 post-merge verification for switch_cli partial settings preservation, live status showed new GATE-NG lanes unrelated to the verified type-only settings preservation regression.  ## Evidence collected on 2026-06-03 UTC  - `origin/persona/umamusume` is at `9901ac5d10f9a45edea499a5789458e4efdbf7f1`, satisfying the requested post-merge baseline. - `bash -n scripts/switch_cli.sh` passed. - `bats tests/unit/test_switch_cli.bats` printed `ok 1` through `ok 58` with no FAIL/SKIP lines, but the bats parent process did not exit cleanly and remained waiting after output completion. - `bash scripts/agent_status.sh` showed:   - `daiwa_scarlet`: codex / waiting / task done / inbox 0   - `ashigaru1`: opencode / waiting / task done / inbox 0   - `ashigaru2`: opencode / waiting / task done / inbox 0   - `ashigaru3`: opencode / ゲートNG   - `ashigaru4`: codex / ゲートNG   - `ashigaru5`: codex / ゲートNG   - `ashigaru6`: codex / ゲートNG   - `ashigaru7`: codex / ゲートNG   - `haru_urara`: codex / ゲートNG - tmux metadata/current command snapshot:   - `pane=3 agent=ashigaru3 cli= model=OpenCode (deepseek/deepseek-v4-flash) cmd=bash`   - `pane=4 agent=ashigaru4 cli= model=Spark cmd=bash`   - `pane=5 agent=ashigaru5 cli= model=Spark cmd=bash`   - `pane=6 agent=ashigaru6 cli= model=Spark cmd=bash`   - `pane=7 agent=ashigaru7 cli= model=Spark cmd=bash`   - `pane=8 agent=haru_urara cli= model=Spark cmd=bash` - runtime watcher env still expects AI CLIs:   - `ashigaru3 EXPECTED_CLI=opencode`  
  **Post-Mortem & Fix Analysis**:
  > Opened in the wrong repository during local multi-worktree triage. The relevant evidence is being tracked in NEXTAltair/multi-agent-shogun issues #39 and #49 instead. Closing this upstream issue with no action requested here.
  > Closing as opened in the wrong repository; no upstream action requested.

- **Issue #163** (2026-06-06): **feat: レートリミット時の代理指揮・状態監視メンバーを追加**
  *Symptoms*:  ## 概要  Claude Code / Codex 等の上位エージェントがレートリミットに到達した場合でも、タスク状態の把握・引き継ぎ・監視が止まらないようにする。  具体的には、将軍・家老・軍師などの上位陣が「給料分働いたので休憩」に入った場合でも、まだ稼働可能なエージェントが代理で状況確認・引き継ぎ・再割り当てを行える仕組みを追加する。  ## 背景  弱小な殿の運用では、Claude Code を Claude Pro のアカウント認証、Codex を ChatGPT Plus のアカウント認証で動作させている。  この場合、将軍・家老・軍師などの上位エージェントが比較的早くレートリミットに到達し、以下の問題が発生する。  1. タスクが中途半端な状態で停止する 2. 上位陣が休止すると、全体の情報把握・進捗管理も止まる 3. まだ稼働可能な足軽・別エージェントが存在しても、誰が何を引き継ぐべきか判断できない 4. 殿が手動で状況確認・再指示しないと再開しづらい  まるで近代軍のように、指揮系統が一部停止しても代替指揮・状態監視・引き継ぎが行われる仕組みが必要と思われる。  ## 要件  ### 1. エージェント状態の監視  各エージェントについて、少なくとも以下の状態を確認できるようにする。  - 稼働中 - レートリミット到達中 - 応答待ち - タスク実行中 - 最終応答時刻 - 担当中の task / cmd / issue - 引き継ぎ可能かどうか  状態は dashboard / YAML / ログ等、既存構成に馴染む形で記録する。  ### 2. 上位エージェント停止時の代理指揮  将軍・家老・軍師などの上位エージェントがレートリミット等で停止した場合、稼働可能な別エージェントが以下を代行できるようにする。  - 現在の未完了タスク一覧の確認 - 停止したエージェントの担当タスク確認 - 中途半端なタスクの状態整理 - 引き継ぎ先候補の提示 - 必要に応じた再割り当て - 殿への報告  ただし、代理指揮は無制限に権限を持つのではなく、危険な操作や大きな方針変更は殿または正規の上位エージェント確認待ちとする。  ### 3. 状態監視専任メンバーの追加  常時または定期的に、全体状態を監視する専任ロールを追加する案を検討する。  仮称：  - 見張り - 目付 - 番頭 - 監軍 - watcher supervisor 拡張  役割：  - 各エージェントの生存確認 - レートリミット状態の検出 - 長時間停止しているタスクの検出 - 中途半端な作業の検出 - 代理指揮が必要な場合の起票または通知 - dashboard 更新  ### 4. 引き継ぎルール  レートリミット等により担当者が停止した場合、次のようなルールを定義する。  - 一定時間応答がなければ「要確認」とする - 担当エージェントがレートリミット中なら「代理可能」状態にする - 未完了タスクには `handover_required` のようなフラグを立てる - 引き継ぎ先は、稼働可能かつ負荷が低いエージェントから選ぶ - 引き継ぎ時には、前任者の作業ログ・現在状態・次にやることを要約する  例：  ```yaml agent_status:   shogun:     state: rate_limited     last_seen_at: "2026-06-02T09:00:00+09:00"     current_task: "cmd_XXX
  **Post-Mortem & Fix Analysis**:
  > ご提案ありがとうございます。継戦能力の確保という観点は非常に重要で、要件の整理も丁寧でわかりやすかったです。  ただ、現時点では実装に割けるリソースがなく、着手できる見通しが立っていません。エージェント状態管理・専任監視ロール・引き継ぎルール・代理指揮フローと、実装すべき範囲が広く、中途半端に入れるよりもきちんと設計してから取り組みたい領域です。  もし実装に興味のある方がいれば、コントリビューションは大歓迎です。その際はこのISSUEを参照いただければ要件が整理されています。  引き続きよろしくお願いします。

- **Issue #162** (2026-06-06): **Harden agent startup & setup (inbox, hooks, MCP, permissions)**
  *Symptoms*: ## Why A post-restart 正常化 pass surfaced four independent ways the system could come up degraded — and in three of them, silently. Each fix targets a startup/setup failure mode that left agents running without their comms layer, hooks, or MCP tools, with nothing reported.  ## What & rationale  ### 1. Self-healing inbox symlink  (`fix`) `queue/inbox` symlinks to `~/.local/share/multi-agent-shogun/inbox` to keep the mailbox off the slow `/mnt/c` drvfs mount. The target dir was only created when the symlink itself didn't exist, so a re-run with a stale symlink + missing target left a **dangling link** that broke all agent-to-agent messaging at boot. Now the target is created unconditionally (idempotent), and `inbox_write.sh` recovers a dangling link before writing.  ### 2. Environment-independent Stop hook  (`fix`) `.claude/settings.json` hardcoded a `/home/tono/...` absolute path from another machine, so the Stop hook errored on every turn end here and stop-time inbox delivery never ran. Switched to the relative `bash scripts/stop_hook_inbox.sh`, matching the working SessionStart hook.  ### 3. MCP init-failure detection  (`feat`) One codex agent booted with `codex_apps` not initialized ("MCP startup interrupted") while its siblings were fine — a transient init timeout from simultaneous codex launches, and **silent**. Added `scripts/mcp_health_check.sh` (scans codex panes for MCP init errors) and wired it into `shutsujin` STEP 6.9 (10s settle → check →
  **Post-Mortem & Fix Analysis**:
  > 誠にご尽力、かたじけなく存ずる。@kazumori102 殿。inbox のシンボリックリンク復旧・MCP ヘルスチェック・起動時の権限付与改善、いずれも実運用で痛みのある箇所への的確な一手でございました。一点のみ手を加えさせていただきました。first_setup.sh の sudo chmod を素の chmod に戻しております。sudo が使えぬ環境（CI・共用ホスト）での動作を守るためでございます。commit 1368e1c にて main へ取り込み申した。改めて御礼申し上げます。

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

### Incident Patch 1: `f84d3b74` (2026-07-10)
**Commit Message**: chore(memory): purge retired Memory MCP from instructions/hooks; file-based memory is sole SoT

- CLAUDE.md / .claude/settings.json: land the uncommitted 2026-07-01 memory
  architecture change (Memory MCP retirement note, autoMemoryDirectory pin)
- instructions/{shogun,karo,gunshi,ashigaru}.md: remove dead read_graph steps
  from recovery/context-loading procedures; shogun's "Memory MCP" section
  rewritten as file-based memory procedure
- cli_specific/claude_tools.md: Memory MCP section -> file-based memory;
  recovery step 2 now reads memory/MEMORY.md (shogun only)
- cli_specific/{codex,copilot,kimi}_tools.md: comparison tables no longer
  claim Claude Code has a built-in Memory MCP
- scripts/session_start_hook.sh: drop mcp__memory__read_graph step (agents
  were instructed to call a retired MCP on every session start)
- regenerate instructions/generated/, AGENTS.md, copilot-instructions.md,
  agents/default/system.md via build_instructions.sh

Repo memory/ dir also tidied (untracked): stale MEMORY.md + dead
shogun_memory.jsonl archived to memory/archive_20260711/, pointer stub
installed, CoDD/SEO memories relocated to their canonical stores.

Co-Authored-By: Claude Opus 4.8 (1M

**File**: `.claude/settings.json` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 {
+  "autoMemoryDirectory": "/home/tono/.claude/projects/-home-tono-multi-agent-shogun/memory",
   "hooks": {
     "SessionStart": [
       {
```

**File**: `.github/copilot-instructions.md` (modified, +11/-5)
```diff
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see copilot-instructions.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *GitHub Copilot CLI users: this file is also auto-loaded via GitHub Copilot CLI's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/generated/copilot-shogun.md`, karo→`instructions/generated/copilot-karo.md`, ashigaru→`instructions/generated/copilot-ashigaru.md`, gunshi→`instructions/generated/copilot-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *GitHub Copilot CLI users: this file is also auto-loaded via GitHub Copilot CLI's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/generated/copilot-shogun.md`, karo→`instructions/generated/copilot-karo.md`, ashigaru→`instructions/generated/copilot-ashigaru.md`, gunshi→`instructions/generated/copilot-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -199,7 +200,12 @@ Race condition is eliminated: the context reset wipes old context. Agent re-read
 # Context Layers
 
 ```
-Layer 1: Memory MCP     — persistent across sessions (preferences, rules, lessons)
+Layer 1: Auto-memory (file-based) — persistent across sessions (preferences, rules, lessons)
+         2026-07-01以降は4分割: グローバル(~/.copilot/global-memory/)、
+         CoDD固有(~/.copilot/projects/-home-tono-codd-dev/memory/)、
+         大里LMS固有(~/.copilot/projects/-home-tono-osato-lms/memory/)、
+         shogun固有(本ディレクトリ memory/)。各プロジェクトの autoMemoryDirectory 設定で振り分け。
+         Memory MCP(server-memory)は廃止済み。
 Layer 2: Project files   — persistent per-project (config/, projects/, context/)
 Layer 3: YAML Queue      — persistent task data (queue/ — authoritative source of truth)
 Layer 4: Session context — volatile (copilot-instructions.md auto-loaded, instructions/*.md, lost on /clear)
```

**File**: `AGENTS.md` (modified, +11/-5)
```diff
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see AGENTS.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Codex CLI users: this file is also auto-loaded via Codex CLI's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/generated/codex-shogun.md`, karo→`instructions/generated/codex-karo.md`, ashigaru→`instructions/generated/codex-ashigaru.md`, gunshi→`instructions/generated/codex-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Codex CLI users: this file is also auto-loaded via Codex CLI's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/generated/codex-shogun.md`, karo→`instructions/generated/codex-karo.md`, ashigaru→`instructions/generated/codex-ashigaru.md`, gunshi→`instructions/generated/codex-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -199,7 +200,12 @@ Race condition is eliminated: the context reset wipes old context. Agent re-read
 # Context Layers
 
 ```
-Layer 1: Memory MCP     — persistent across sessions (preferences, rules, lessons)
+Layer 1: Auto-memory (file-based) — persistent across sessions (preferences, rules, lessons)
+         2026-07-01以降は4分割: グローバル(~/.codex/global-memory/)、
+         CoDD固有(~/.codex/projects/-home-tono-codd-dev/memory/)、
+         大里LMS固有(~/.codex/projects/-home-tono-osato-lms/memory/)、
+         shogun固有(本ディレクトリ memory/)。各プロジェクトの autoMemoryDirectory 設定で振り分け。
+         Memory MCP(server-memory)は廃止済み。
 Layer 2: Project files   — persistent per-project (config/, projects/, context/)
 Layer 3: YAML Queue      — persistent task data (queue/ — authoritative source of truth)
 Layer 4: Session context — volatile (AGENTS.md auto-loaded, instructions/*.md, lost on /new)
```

**File**: `CLAUDE.md` (modified, +22/-16)
```diff
@@ -19,7 +19,7 @@ files:
   tasks: "queue/tasks/ashigaru{N}.yaml" # Karo → Ashigaru assignments (per-ashigaru)
   gunshi_task: queue/tasks/gunshi.yaml  # Karo → Gunshi strategic assignments
   pending_tasks: queue/tasks/pending.yaml # Karo管理の保留タスク（blocked未割当）
-  reports: "queue/reports/ashigaru{N}_report.yaml" # Ashigaru → Gunshi reports
+  reports: "queue/reports/ashigaru{N}_report.yaml" # Ashigaru → Gunshi reports
   gunshi_report: queue/reports/gunshi_report.yaml  # Gunshi → Karo strategic reports
   dashboard: dashboard.md              # Human-readable summary (secondary data)
   daily_log: "logs/daily/YYYY-MM-DD.md" # Karo appends cmd summary on completion. Shogun reads for daily reports.
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see CLAUDE.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Claude Code users: this file is also auto-loaded via Claude Code's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/shogun.md`, karo→`instructions/karo.md`, ashigaru→`instructions/ashigaru.md`, gunshi→`instructions/gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Claude Code users: this file is also auto-loaded via Claude Code's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/shogun.md`, karo→`instructions/karo.md`, ashigaru→`instructions/ashigaru.md`, gunshi→`instructions/gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -119,8 +120,8 @@ Examples:
 # Shogun → Karo
 bash scripts/inbox_write.sh karo "cmd_048を書いた。実行せよ。" cmd_new shogun
 
-# Ashigaru → Gunshi
-bash scripts/inbox_write.sh gunshi "足軽5号、任務完了。品質チェックを仰ぎたし。" report_received ashigaru5
+# Ashigaru → Gunshi
+bash scripts/inbox_write.sh gunshi "足軽5号、任務完了。品質チェックを仰ぎたし。" report_received ashigaru5
 
 # Karo → Ashigaru
 bash scripts/inbox_write.sh ashigaru3 "タスクYAMLを読んで作業開始せよ。" task_assigned karo
@@ -141,15 +142,15 @@ The nudge is minimal: `inboxN` (e.g. `inbox3` = 3 unread). That's it.
 **Agent reads the inbox file itself.** Message content never travels through tmux — only a short wake-up signal.
 
 Special cases (CLI commands sent via `tmux send-keys`):
-- `type: clear_command` → sends context reset command via send-keys (Claude/Copilot/Kimi: `/clear`, Codex/OpenCode: `/new`)
+- `type: clear_command` → sends context reset command via send-keys (Claude/Copilot/Kimi: `/clear`, Codex/OpenCode: `/new`)
 - `type: model_switch` → sends the /model command via send-keys
 
 **Escalation** (when nudge is not processed):
 
 | Elapsed | Action | Trigger |
 |---------|--------|---------|
 | 0〜2 min | Standard pty nudge | Normal delivery |
-| 2〜4 min | Escape×2 + recovery nudge | Copilot/Kimi use Escape×2 + Ctrl-C + nudge. Claude/Codex/OpenCode use a plain nudge instead |
+| 2〜4 min | Escape×2 + recovery nudge | Copilot/Kimi use Escape×2 + Ctrl-C + nudge. Claude/Codex/OpenCode use a plain nudge instead |
 | 4 min+ | `/clear` sent (max once per 5 min) | Force session reset + YAML re-read |
 
 ## Inbox Processing Protocol (karo/ashigaru/gunshi)
@@ -168,19 +169,19 @@ When you receive `inboxN` (e.g. `inbox3`):
 2. If any entries have `read: false` → process them
 3. Only then go idle
 
-This is NOT optional. If you skip this and a redo message is waiting,
-you will be stuck idle until the next escalation or task reassignment.
+This is NOT optional. If you skip this and a redo message is waiting,
+you will be stuck idle until the 
```

**File**: `agents/default/system.md` (modified, +11/-5)
```diff
@@ -65,13 +65,14 @@ language:
 **This is ONE procedure for ALL situations**: fresh start, compaction, session continuation, or any state where you see agents/default/system.md. You cannot distinguish these cases, and you don't need to. **Always follow the same steps.**
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons **(shogun/karo/gunshi only. ashigaru skip this step — task YAML is sufficient)**
-3. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Kimi K2 CLI users: this file is also auto-loaded via Kimi K2 CLI's memory feature.*
-4. **Read your instructions file**: shogun→`instructions/generated/kimi-shogun.md`, karo→`instructions/generated/kimi-karo.md`, ashigaru→`instructions/generated/kimi-ashigaru.md`, gunshi→`instructions/generated/kimi-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
+2. **Read `memory/MEMORY.md`** (shogun only) — persistent cross-session memory. If file missing, skip. *Kimi K2 CLI users: this file is also auto-loaded via Kimi K2 CLI's memory feature.*
+3. **Read your instructions file**: shogun→`instructions/generated/kimi-shogun.md`, karo→`instructions/generated/kimi-karo.md`, ashigaru→`instructions/generated/kimi-ashigaru.md`, gunshi→`instructions/generated/kimi-gunshi.md`. **NEVER SKIP** — even if a conversation summary exists. Summaries do NOT preserve persona, speech style, or forbidden actions.
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
 
-**CRITICAL**: Steps 1-3を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+**CRITICAL**: Steps 1-2を完了するまでinbox処理するな。`inboxN` nudgeが先に届いても無視し、自己識別→memory→instructions読み込みを必ず先に終わらせよ。Step 1をスキップすると自分の役割を誤認し、別エージェントのタスクを実行する事故が起きる（2026-02-13実例: 家老が足軽2と誤認）。
+
+**(2026-07-01廃止)**: Memory MCP（`mcp__memory__*`、`server-memory`バックエンド）は廃止した。設計上「簡潔な索引」であるべきところ自己肥大化（read_graph単体でトークン上限超過）し、かつ発火が完全に手動依存（hook等の強制力なし）で実際に長期間呼ばれず死蔵していたため。`memory/MEMORY.md`＋個別ファイルのfile-based系統のみが正本。
 
 **CRITICAL**: dashboard.md is secondary data (karo's summary). Primary data = YAML files. Always verify from YAML.
 
@@ -199,7 +200,12 @@ Race condition is eliminated: the context reset wipes old context. Agent re-read
 # Context Layers
 
 ```
-Layer 1: Memory MCP     — persistent across sessions (preferences, rules, lessons)
+Layer 1: Auto-memory (file-based) — persistent across sessions (preferences, rules, lessons)
+         2026-07-01以降は4分割: グローバル(~/.kimi/global-memory/)、
+         CoDD固有(~/.kimi/projects/-home-tono-codd-dev/memory/)、
+         大里LMS固有(~/.kimi/projects/-home-tono-osato-lms/memory/)、
+         shogun固有(本ディレクトリ memory/)。各プロジェクトの autoMemoryDirectory 設定で振り分け。
+         Memory MCP(server-memory)は廃止済み。
 Layer 2: Project files   — persistent per-project (config/, projects/, context/)
 Layer 3: YAML Queue      — persistent task data (queue/ — authoritative source of truth)
 Layer 4: Session context — volatile (agents/default/system.md auto-loaded, instructions/*.md, lost on /clear)
```

**File**: `instructions/ashigaru.md` (modified, +24/-25)
```diff
@@ -7,15 +7,15 @@
 role: ashigaru
 version: "2.1"
 
-forbidden_actions:
-  - id: F001
-    action: direct_shogun_report
-    description: "Report directly to Shogun (bypass Gunshi/Karo chain)"
-    report_to: gunshi
-  - id: F002
-    action: direct_user_contact
-    description: "Contact human directly"
-    report_to: gunshi
+forbidden_actions:
+  - id: F001
+    action: direct_shogun_report
+    description: "Report directly to Shogun (bypass Gunshi/Karo chain)"
+    report_to: gunshi
+  - id: F002
+    action: direct_user_contact
+    description: "Contact human directly"
+    report_to: gunshi
   - id: F003
     action: unauthorized_work
     description: "Perform work not assigned"
@@ -123,9 +123,9 @@ persona:
     analysis: [Data Analyst, Market Researcher, Strategy Analyst, Business Analyst]
     other: [Professional Translator, Professional Editor, Operations Specialist, Project Coordinator]
 
-skill_candidate:
-  criteria: [reusable across projects, pattern repeated 2+ times, requires specialized knowledge, useful to other ashigaru]
-  action: report_to_gunshi
+skill_candidate:
+  criteria: [reusable across projects, pattern repeated 2+ times, requires specialized knowledge, useful to other ashigaru]
+  action: report_to_gunshi
 
 ---
 
@@ -240,9 +240,8 @@ Recover from primary data:
 2. Read `queue/tasks/ashigaru{N}.yaml`
    - `assigned` → resume work
    - `done` → await next instruction
-3. Read Memory MCP (read_graph) if available
-4. Read `context/{project}.md` if task has project field
-5. dashboard.md is secondary info only — trust YAML as authoritative
+3. Read `context/{project}.md` if task has project field
+4. dashboard.md is secondary info only — trust YAML as authoritative
 
 ## /clear Recovery
 
@@ -267,22 +266,22 @@ Recover from primary data:
 
 Act without waiting for Karo's instruction:
 
-**On task completion** (in this order):
-1. Self-review deliverables (re-read your output)
-2. **Purpose validation**: Read `parent_cmd` in `queue/shogun_to_karo.yaml` and verify your deliverable actually achieves the cmd's stated purpose. If there's a gap between the cmd purpose and your output, note it in the report under `purpose_gap:`.
-3. Write report YAML
-4. Notify Gunshi via inbox_write
-5. **Check own inbox** (MANDATORY): Read `queue/inbox/ashigaru{N}.yaml`, process any `read: false` entries
-6. (No delivery verification needed — inbox_write guarantees persistence)
+**On task completion** (in this order):
+1. Self-review deliverables (re-read your output)
+2. **Purpose validation**: Read `parent_cmd` in `queue/shogun_to_karo.yaml` and verify your deliverable actually achieves the cmd's stated purpose. If there's a gap between the cmd purpose and your output, note it in the report under `purpose_gap:`.
+3. Write report YAML
+4. Notify Gunshi via inbox_write
+5. **Check own inbox** (MANDATORY): Read `queue/inbox/ashigaru{N}.yaml`, process any `read: false` entries
+6. (No delivery verification needed — inbox_write guarantees persistence)
 
 **Quality assurance:**
 - After modifying files → verify with Read
 - If project has tests → run related tests
 - If modifying instructions → check for contradictions
 
-**Anomaly handling:**
-- Context below 30% → write progress to report YAML, tell Gunshi "context running low"
-- Task larger than expected → include split proposal in report
+**Anomaly handling:**
+- Context below 30% → write progress to report YAML, tell Gunshi "context running low"
+- Task larger than expected → include split proposal in report
 
 ## Shout Mode (echo_message)
 
```

**File**: `instructions/cli_specific/claude_tools.md` (modified, +7/-15)
```diff
@@ -37,22 +37,14 @@ Use Task tool when:
 - Complex multi-step tasks require autonomous handling
 - You need to plan implementation strategy
 
-## Memory MCP
+## Memory (file-based)
 
-Save important information to Memory MCP:
+Memory MCP (`mcp__memory__*`, server-memory backend) was **retired 2026-07-01** — never call it.
+Persistent memory is file-based: `memory/MEMORY.md` is the always-loaded index (shogun only),
+with one fact per individual memory file (`feedback_*.md` / `project_*.md` / `reference_*.md` / `user_*.md`).
 
-```python
-mcp__memory__create_entities([{
-    "name": "preference_name",
-    "entityType": "preference",
-    "observations": ["Lord prefers X over Y"]
-}])
-
-mcp__memory__add_observations([{
-    "entityName": "existing_entity",
-    "contents": ["New observation"]
-}])
-```
+To save: write/update the individual file (include Why + How to apply), then add a one-line
+pointer to `MEMORY.md`. Update existing files rather than duplicating; delete memories proven wrong.
 
 Use for: Lord's preferences, key decisions + reasons, cross-project insights, solved problems.
 
@@ -86,7 +78,7 @@ For Ashigaru: After `/clear`, follow CLAUDE.md /clear recovery procedure. Do NOT
 All agents: Follow the Session Start / Recovery procedure in CLAUDE.md. Key steps:
 
 1. Identify self: `tmux display-message -t "$TMUX_PANE" -p '#{@agent_id}'`
-2. `mcp__memory__read_graph` — restore rules, preferences, lessons
+2. (shogun only) Read `memory/MEMORY.md` — restore rules, preferences, lessons (file-based memory)
 3. Read your instructions file (shogun→instructions/shogun.md, karo→instructions/karo.md, ashigaru→instructions/ashigaru.md)
 4. Rebuild state from primary YAML data (queue/, tasks/, reports/)
 5. Review forbidden actions, then start work
```

**File**: `instructions/cli_specific/codex_tools.md` (modified, +8/-8)
```diff
@@ -76,9 +76,9 @@ Set `CODEX_HOME` env var for project-specific automation profiles.
 
 Sessions are stored locally. Use `/resume` or `codex exec resume` to continue previous conversations.
 
-### No Memory MCP equivalent
+### No persistent-memory equivalent
 
-Codex does not have a built-in persistent memory system like Claude Code's Memory MCP. For cross-session knowledge, rely on:
+Codex does not have a built-in persistent memory system like Claude Code's file-based auto-memory (`memory/MEMORY.md` + individual files; the former Memory MCP was retired 2026-07-01). For cross-session knowledge, rely on:
 - AGENTS.md (project-level instructions)
 - File-based state (queue/tasks/*.yaml, queue/reports/*.yaml)
 - MCP servers if configured
@@ -135,7 +135,7 @@ Step 3: If task has "target_path:" → read that file
 Step 4: Resume work based on task status
 ```
 
-**Note**: Unlike Claude Code, Codex has no `mcp__memory__read_graph` equivalent. Recovery relies entirely on AGENTS.md + YAML files.
+**Note**: Unlike Claude Code, Codex has no auto-loaded memory equivalent. Recovery relies entirely on AGENTS.md + YAML files.
 
 ## tmux Interaction
 
@@ -164,10 +164,10 @@ Step 4: Resume work based on task status
 
 ### Nudge Mechanism
 
-For TUI mode with `--no-alt-screen`:
-- inbox_watcher.sh sends nudge text (e.g., `inbox3`) via tmux send-keys
-- Safety (shogun): if the Shogun pane is active (the Lord is typing), watcher avoids send-keys and uses tmux `display-message` only
-- After receiving a nudge, the agent reads `queue/inbox/<agent>.yaml` and processes unread messages
+For TUI mode with `--no-alt-screen`:
+- inbox_watcher.sh sends nudge text (e.g., `inbox3`) via tmux send-keys
+- Safety (shogun): if the Shogun pane is active (the Lord is typing), watcher avoids send-keys and uses tmux `display-message` only
+- After receiving a nudge, the agent reads `queue/inbox/<agent>.yaml` and processes unread messages
 
 For `codex exec` mode:
 - Each task is a separate `codex exec` invocation
@@ -222,7 +222,7 @@ Model is set by `build_cli_command()` in cli_adapter.sh based on settings.yaml.
 
 | Feature | Claude Code | Codex CLI | Impact |
 |---------|------------|-----------|--------|
-| Memory MCP | Built-in | Not built-in (configurable) | Recovery relies on AGENTS.md + files |
+| Persistent memory | File-based auto-memory (MEMORY.md) | Not built-in | Recovery relies on AGENTS.md + files |
 | Task tool (subagents) | Yes | No | Cannot spawn sub-agents |
 | Skill system | Yes | No | No slash command skills |
 | Dynamic model switch | `/model` via send-keys | `/model` in TUI only | Limited in automated mode |
```

---

### Incident Patch 2: `84d2043a` (2026-06-06)
**Commit Message**: fix: repair get_cli_type Python snippet and copilot model default

Auto-merge mangled the get_cli_type Python block — restored clean logic
using normalize_cli() + full 7-CLI allowed tuple. Added copilot case to
get_agent_model() returning empty string so --model flag is not appended
when copilot manages model selection internally.

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `lib/cli_adapter.sh` (modified, +12/-13)
```diff
@@ -180,7 +180,7 @@ get_cli_type() {
     local result
     result=$("$CLI_ADAPTER_PROJECT_ROOT/.venv/bin/python3" -c "
 import yaml, sys
-allowed = ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'antigravity')
+allowed = ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor', 'antigravity')
 def normalize_cli(value):
     value = str(value or '').lower()
     if value in ('gemini', 'agy'):
@@ -194,23 +194,18 @@ try:
         print('claude'); sys.exit(0)
     agents = cli.get('agents', {})
     if not isinstance(agents, dict):
-        print(cli.get('default', 'claude') if cli.get('default', 'claude') in ('claude','codex','copilot','kimi','opencode','cursor') else 'claude')
+        default = normalize_cli(cli.get('default', 'claude'))
+        print(default if default in allowed else 'claude')
         sys.exit(0)
     agent_cfg = agents.get('${agent_id}')
     if isinstance(agent_cfg, dict):
-        t = agent_cfg.get('type', '')
-        if t in ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor'):
-            print(t); sys.exit(0)
-    elif isinstance(agent_cfg, str):
-        if agent_cfg in ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor'):
-            print(agent_cfg); sys.exit(0)
-    default = cli.get('default', 'claude')
-    if default in ('claude', 'codex', 'copilot', 'kimi', 'opencode', 'cursor'):
-        default = normalize_cli(cli.get('default', 'claude'))
-        print(default if default in allowed else 'claude')
         t = normalize_cli(agent_cfg.get('type', ''))
         if t in allowed:
+            print(t); sys.exit(0)
+    elif isinstance(agent_cfg, str):
         t = normalize_cli(agent_cfg)
+        if t in allowed:
+            print(t); sys.exit(0)
     default = normalize_cli(cli.get('default', 'claude'))
     if default in allowed:
         print(default)
@@ -482,8 +477,12 @@ get_agent_model() {
             # Antigravity CLI はホスト側の既定/最後のモデル設定を使う。
             echo "auto"
             ;;
+        copilot)
+            # Copilot CLI manages model selection internally; no default
+            echo ""
+            ;;
         *)
-            # Claude Code/Codex/Copilot用デフォルトモデル
+            # Claude Code/Codex用デフォルトモデル
             case "$agent_id" in
                 shogun)         echo "opus" ;;
                 karo)           echo "sonnet" ;;
```

---

### Incident Patch 3: `4fe68ed5` (2026-06-06)
**Commit Message**: fix: repair cursor/antigravity case syntax in inbox_watcher and build_instructions

Auto-merge dropped closing `;;` and `return 0; fi` from the cursor
case block in both files, causing syntax errors that broke CI.

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `scripts/build_instructions.sh` (modified, +1/-0)
```diff
@@ -106,6 +106,7 @@ EOFYAML
             ;;
         cursor)
             cat "$PARTS_DIR/cli_specific/cursor_tools.md" >> "$output_path"
+            ;;
         antigravity)
             cat "$PARTS_DIR/cli_specific/antigravity_tools.md" >> "$output_path"
             ;;
```

**File**: `scripts/inbox_watcher.sh` (modified, +3/-0)
```diff
@@ -627,6 +627,9 @@ send_cli_command() {
                 timeout 5 tmux send-keys -t "$PANE_TARGET" Enter 2>/dev/null || true
                 sleep 3
                 NEW_CONTEXT_SENT=1
+                return 0
+            fi
+            ;;
         antigravity)
             if [[ "$cmd" == /model* ]]; then
                 echo "[$(date)] Skipping $cmd (Antigravity model changes are restart-only)" >&2
```

---

### Incident Patch 4: `1368e1cd` (2026-06-06)
**Commit Message**: feat: harden agent startup — inbox, hooks, MCP health check, dangling symlink fix (PR #162)

- .claude/settings.json: stop hook uses relative path (portable)
- scripts/inbox_write.sh: recover dangling queue/inbox symlink before mkdir
- scripts/mcp_health_check.sh: new script — detect MCP init failures in codex panes
- shutsujin_departure.sh: mkdir inbox dir before symlink check (idempotent); add STEP 6.9 MCP health check
- first_setup.sh: batch chmod (without sudo) for script permissions

Co-Authored-By: kazumori102 <[REDACTED_EMAIL]>
Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -118,6 +118,7 @@
 !scripts/ratelimit_check.sh
 !scripts/switch_cli.sh
 !scripts/dashboard-viewer.py
+!scripts/mcp_health_check.sh
 
 
 # SayTask (sample template only, not actual data)
```

**File**: `first_setup.sh` (modified, +11/-2)
```diff
@@ -774,13 +774,22 @@ SCRIPTS=(
     "first_setup.sh"
 )
 
+TARGETS=()
+
 for script in "${SCRIPTS[@]}"; do
     if [ -f "$SCRIPT_DIR/$script" ]; then
-        chmod +x "$SCRIPT_DIR/$script"
-        log_info "$script に実行権限を付与しました"
+        TARGETS+=("$SCRIPT_DIR/$script")
     fi
 done
 
+if [ "${#TARGETS[@]}" -ne 0 ]; then
+    chmod +x "${TARGETS[@]}"
+
+    for target in "${TARGETS[@]}"; do
+        log_info "$(basename "$target") に実行権限を付与しました"
+    done
+fi
+
 RESULTS+=("実行権限: OK")
 
 # ============================================================
```

**File**: `scripts/inbox_write.sh` (modified, +6/-1)
```diff
@@ -27,8 +27,13 @@ if [ "$FROM" = "$TARGET" ]; then
 fi
 
 # Initialize inbox if not exists
+# dangling symlink recovery: queue/inbox が壊れたシンボリックリンクならリンク先を再生成
+_inbox_parent="$(dirname "$INBOX")"
+if [ -L "$_inbox_parent" ] && [ ! -d "$_inbox_parent" ]; then
+    mkdir -p "$(readlink "$_inbox_parent")"
+fi
 if [ ! -f "$INBOX" ]; then
-    mkdir -p "$(dirname "$INBOX")"
+    mkdir -p "$_inbox_parent"
     echo "messages: []" > "$INBOX"
 fi
 
```

**File**: `scripts/mcp_health_check.sh` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+#!/usr/bin/env bash
+set -uo pipefail
+
+SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
+LOG_FILE="${PROJECT_ROOT}/logs/mcp_health.log"
+TIMESTAMP="$(date '+%Y-%m-%dT%H:%M:%S')"
+
+mkdir -p "${PROJECT_ROOT}/logs"
+
+errors=0
+checked=0
+
+echo "[${TIMESTAMP}] MCP Health Check Start" | tee -a "$LOG_FILE"
+
+# multiagent:agents セッションの全ペインを走査
+if ! tmux has-session -t multiagent 2>/dev/null; then
+    echo "[${TIMESTAMP}] SKIP: multiagent session not found" | tee -a "$LOG_FILE"
+    exit 0
+fi
+
+while IFS= read -r pane_id; do
+    agent_cli=$(tmux display-message -t "multiagent:agents.${pane_id}" -p '#{@agent_cli}' 2>/dev/null || echo "")
+    agent_id=$(tmux display-message -t "multiagent:agents.${pane_id}" -p '#{@agent_id}' 2>/dev/null || echo "pane${pane_id}")
+
+    if [ "$agent_cli" != "codex" ]; then
+        continue
+    fi
+
+    checked=$((checked + 1))
+    capture=$(tmux capture-pane -t "multiagent:agents.${pane_id}" -p -S -100 2>/dev/null || echo "")
+
+    if echo "$capture" | grep -qiE 'MCP startup interrupted|servers were not initialized|MCP server .+ failed|MCP connection .+ timed out'; then
+        echo "[${TIMESTAMP}] ${agent_id} (codex): NG - MCP initialization error detected" | tee -a "$LOG_FILE"
+        errors=$((errors + 1))
+    else
+        echo "[${TIMESTAMP}] ${agent_id} (codex): OK" | tee -a "$LOG_FILE"
+    fi
+done < <(tmux list-panes -t "multiagent:agents" -F '#{pane_index}' 2>/dev/null || true)
+
+echo "[${TIMESTAMP}] Result: ${errors} errors found (checked ${checked} codex panes)" | tee -a "$LOG_FILE"
+
+if [ "$errors" -gt 0 ]; then
+    echo "⚠️ MCP Health Check: ${errors} error(s) detected. Run 'bash scripts/switch_cli.sh <agent>' to restart affected agents."
+    exit 1
+else
+    echo "✅ MCP Health Check: All codex agents OK (${checked} checked)"
+    exit 0
+fi
```

**File**: `shutsujin_departure.sh` (modified, +15/-1)
```diff
@@ -380,8 +380,8 @@ fi
 # macOSではfswatch使用のためシンボリックリンク不要
 if [ "$(uname -s)" != "Darwin" ]; then
     INBOX_LINUX_DIR="$HOME/.local/share/multi-agent-shogun/inbox"
+    mkdir -p "$INBOX_LINUX_DIR"  # 常に実行（べき等）— dangling symlink 防止
     if [ ! -L ./queue/inbox ]; then
-        mkdir -p "$INBOX_LINUX_DIR"
         [ -d ./queue/inbox ] && cp ./queue/inbox/*.yaml "$INBOX_LINUX_DIR/" 2>/dev/null && rm -rf ./queue/inbox
         ln -sf "$INBOX_LINUX_DIR" ./queue/inbox
         log_info "  └─ inbox → Linux FS ($INBOX_LINUX_DIR) にシンボリックリンク作成"
@@ -1017,6 +1017,20 @@ else
 fi
 echo ""
 
+# ═══════════════════════════════════════════════════════════════════════════════
+# STEP 6.9: MCP ヘルスチェック（codex足軽のMCP初期化状態を検証）
+# ═══════════════════════════════════════════════════════════════════════════════
+log_info ""
+log_info "STEP 6.9: MCP ヘルスチェック..."
+log_info "  └─ 全エージェント起動完了まで10秒待機..."
+sleep 10
+if bash "$SCRIPT_DIR/scripts/mcp_health_check.sh" 2>&1 | tee -a "$SCRIPT_DIR/logs/mcp_health.log"; then
+    log_success "  └─ MCP ヘルスチェック: 全正常"
+else
+    log_error "  └─ ⚠️ MCP初期化失敗を検知。logs/mcp_health.log を確認せよ"
+    log_error "     該当エージェントを 'bash scripts/switch_cli.sh <agent>' で再起動することを推奨"
+fi
+
 # ═══════════════════════════════════════════════════════════════════════════════
 # STEP 7: 環境確認・完了メッセージ
 # ═══════════════════════════════════════════════════════════════════════════════
```

---

### Incident Patch 5: `16660348` (2026-06-06)
**Commit Message**: fix: prevent duplicate inbox_watcher startup via per-agent flock

Root cause: start_watcher_if_missing had a TOCTOU race between the
pgrep check and nohup launch. Under supervisor restart, two instances
could both see "no watcher running" and both start one.

Fix: wrap the check+start block in a per-agent flock (non-blocking).
If another instance is already starting the watcher for that agent,
the second call returns 0 immediately. The OS releases the lock
automatically when the subshell exits.

Also fix pgrep -f → pgrep -Ef for ERE alternation in ( |$) pattern.

Closes #159

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `scripts/watcher_supervisor.sh` (modified, +13/-8)
```diff
@@ -36,22 +36,27 @@ start_watcher_if_missing() {
     local pane="$2"
     local log_file="$3"
     local cli
+    local lockfile="/tmp/shogun_watcher_start_${agent}.lock"
 
     ensure_inbox_file "$agent"
     if ! pane_exists "$pane"; then
         return 0
     fi
 
-    if pgrep -f "scripts/inbox_watcher.sh ${agent} ${pane}( |$)" >/dev/null 2>&1; then
-        return 0
-    fi
+    (
+        flock -n 9 || return 0
+        if pgrep -Ef "scripts/inbox_watcher.sh ${agent} ${pane}( |$)" >/dev/null 2>&1; then
+            return 0
+        fi
 
-    if pgrep -f "scripts/inbox_watcher.sh ${agent} " >/dev/null 2>&1; then
-        echo "[$(date)] [WARN] stale watcher detected for ${agent}; starting watcher for expected pane ${pane}" >&2
-    fi
+        if pgrep -f "scripts/inbox_watcher.sh ${agent} " >/dev/null 2>&1; then
+            echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] stale watcher detected for ${agent}; starting watcher for expected pane ${pane}" >&2
+        fi
 
-    cli=$(tmux show-options -p -t "$pane" -v @agent_cli 2>/dev/null || echo "codex")
-    nohup bash scripts/inbox_watcher.sh "$agent" "$pane" "$cli" >> "$log_file" 2>&1 &
+        cli=$(tmux show-options -p -t "$pane" -v @agent_cli 2>/dev/null || echo "codex")
+        nohup bash scripts/inbox_watcher.sh "$agent" "$pane" "$cli" >> "$log_file" 2>&1 &
+        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [START] inbox_watcher started for ${agent} pane=${pane} PID=$!" >&2
+    ) 9>"$lockfile"
 }
 
 watcher_specs() {
```

**File**: `tests/unit/test_watcher_supervisor.bats` (added, +189/-0)
```diff
@@ -0,0 +1,189 @@
+#!/usr/bin/env bats
+# test_watcher_supervisor.bats — start_watcher_if_missing unit tests
+#
+# Tests the flock-protected start_watcher_if_missing logic via mocking.
+#
+# Test cases:
+#   T-WS-001: pane does not exist → returns 0, no watcher started
+#   T-WS-002: watcher already running for correct pane → no duplicate started
+#   T-WS-003: lockfile path follows pattern /tmp/shogun_watcher_start_{agent}.lock
+#   T-WS-004: no existing watcher → watcher is started
+
+PROJECT_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
+SUPERVISOR_SCRIPT="$PROJECT_ROOT/scripts/watcher_supervisor.sh"
+
+setup() {
+    TEST_TMP="$(mktemp -d)"
+    mkdir -p "$TEST_TMP/scripts"
+    mkdir -p "$TEST_TMP/queue/inbox"
+    mkdir -p "$TEST_TMP/logs"
+
+    # Mock inbox_watcher.sh — records launch args
+    cat > "$TEST_TMP/scripts/inbox_watcher.sh" << 'MOCK'
+#!/bin/bash
+echo "$@" >> "$(dirname "$0")/../watcher_launched.log"
+sleep 60
+MOCK
+    chmod +x "$TEST_TMP/scripts/inbox_watcher.sh"
+
+    # Default mock: pane does NOT exist
+    MOCK_PANE_EXISTS=0
+
+    # Default mock: no existing watcher pgrep hit
+    MOCK_PGREP_CORRECT=1
+    MOCK_PGREP_STALE=1
+}
+
+teardown() {
+    rm -rf "$TEST_TMP"
+}
+
+# Source the function under test with mocked dependencies injected via env overrides.
+# We source the function definitions only, then call start_watcher_if_missing directly.
+source_supervisor_functions() {
+    # Override pane_exists and pgrep with shell functions in the current subshell.
+    pane_exists() {
+        return $MOCK_PANE_EXISTS
+    }
+
+    pgrep() {
+        # Distinguish correct-pane vs stale-pane pgrep call by argument pattern
+        local args="$*"
+        if echo "$args" | grep -q "( |\$)"; then
+            # correct-pane pattern (has trailing space or end anchor)
+            return $MOCK_PGREP_CORRECT
+        else
+            return $MOCK_PGREP_STALE
+        fi
+    }
+
+    ensure_inbox_file() {
+        local agent="$1"
+        touch "$TEST_TMP/queue/inbox/${agent}.yaml"
+    }
+
+    # Load only the start_watcher_if_missing function definition from the script.
+    # We extract and eval it to avoid running the infinite loop at the bottom.
+    eval "$(
+        awk '/^start_watcher_if_missing\(\)/{p=1} p{print} /^\}$/{if(p){p=0}}' \
+            "$SUPERVISOR_SCRIPT"
+    )"
+}
+
+# ---------------------------------------------------------------------------
+# T-WS-001: pane does not exist → function returns 0, no watcher started
+# ---------------------------------------------------------------------------
+@test "T-WS-001: pane does not exist returns 0 and does not start watcher" {
+    (
+        export MOCK_PANE_EXISTS=1   # non-zero = pane missing
+
+        pane_exists() { return 1; }
+        ensure_inbox_file() { :; }
+
+        watcher_started=0
+        nohup() { watcher_started=1; }
+
+        eval "$(
+            awk '/^start_watcher_if_missing\(\)/{p=1} p{print} /^\}$/{if(p){p=0}}' \
+                "$SUPERVISOR_SCRIPT"
+        )"
+
+        start_watcher_if_missing "ashigaru1" "multiagent:agents.1" "/tmp/test_ws_001.log"
+        result=$?
+
+        [ "$result" -eq 0 ]
+        [ "$watcher_started" -eq 0 ]
+    )
+}
+
+# ---------------------------------------------------------------------------
+# T-WS-002: watcher already running for correct pane → no duplicate started
+# ---------------------------------------------------------------------------
+@test "T-WS-002: watcher already running for correct pane does not start duplicate" {
+    local launched_log="$TEST_TMP/watcher_launched.log"
+
+    # Run a subprocess that:
+    #   - pane exists
+    #   - correct-pane pgrep returns 0 (watcher running)
+    #   - records if inbox_watcher.sh gets executed
+    (
+        pane_exists() { return 0; }
+        ensure_inbox_file() { touch "$TEST_TMP/queue/inbox/${1}.yaml"; }
+
+        pgrep() {
+            # Simulate: correct-pane watcher IS running
+            return 0
+        }
+
+        nohup_called=0
+        # Override nohup so we can detect if watcher would be launched
+        nohup() { nohup_called=1; echo "$@" >> "$launched_log"; }
+
+        eval "$(
+            awk '/^start_watcher_if_missing\(\)/{p=1} p{print} /^\}$/{if(p){p=0}}' \
+                "$SUPERVISOR_SCRIPT"
+        )"
+
+        start_watcher_if_missing "ashigaru1" "multiagent:agents.1" "/tmp/test_ws_002.log"
+
+        # If launched_log was created, a duplicate was (incorrectly) started
+        [ ! -f "$launched_log" ]
+    )
+}
+
+# ---------------------------------------------------------------------------
+# T-WS-003: lockfile path follows /tmp/shogun_watcher_start_{agent}.lock
+# ---------------------------------------------------------------------------
+@test "T-WS-003: lockfile path follows /tmp/shogun_watcher_start_{agent}.lock pattern" {
+    local agent="ashigaru3"
+    local expected_lockfile="/tmp/shogun_watcher_start_${agent}.lock"
+
+    # Confirm the s
```

---

### Incident Patch 6: `56519d65` (2026-06-06)
**Commit Message**: fix: remove hardcoded absolute paths from instructions

Replace machine-specific paths (/home/tono/, /mnt/c/tools/multi-agent-shogun/)
with relative paths and project-root-relative examples. Regenerate all
CLI-specific instruction files from updated sources.

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.opencode/agents/karo.md` (modified, +2/-2)
```diff
@@ -116,7 +116,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -128,7 +128,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
```

**File**: `instructions/generated/codex-karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
-Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
+**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
+Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
 
 ## Quality Control (QC) Routing
 
-Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
-
-### Mechanical Completion Checks → Karo
-
-When ashigaru reports task completion, Karo may perform mechanical completion checks only. These are not reviews:
+Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
+
+### Mechanica
```

**File**: `instructions/generated/copilot-karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
-Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
+**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
+Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
 
 ## Quality Control (QC) Routing
 
-Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
-
-### Mechanical Completion Checks → Karo
-
-When ashigaru reports task completion, Karo may perform mechanical completion checks only. These are not reviews:
+Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
+
+### Mechanica
```

**File**: `instructions/generated/karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
-Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
+**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
+Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
 
 ## Quality Control (QC) Routing
 
-Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
-
-### Mechanical Completion Checks → Karo
-
-When ashigaru reports task completion, Karo may perform mechanical completion checks only. These are not reviews:
+Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
+
+### Mechanica
```

**File**: `instructions/generated/kimi-karo.md` (modified, +47/-47)
```diff
@@ -3,23 +3,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -52,10 +52,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -175,25 +175,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
-Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
+**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
+Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
 
 ## Quality Control (QC) Routing
 
-Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
-
-### Mechanical Completion Checks → Karo
-
-When ashigaru reports task completion, Karo may perform mechanical completion checks only. These are not reviews:
+Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
+
+### Mechanica
```

**File**: `instructions/generated/opencode-karo.md` (modified, +2/-2)
```diff
@@ -67,7 +67,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -79,7 +79,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
```

**File**: `instructions/karo.md` (modified, +3/-3)
```diff
@@ -323,7 +323,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -335,7 +335,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -626,7 +626,7 @@ Note: This replaces the need for inbox_write to shogun. ntfy goes directly to Lo
 3. **cmd_390 等の自律改修サイクルで殿判断が必要なポイント** — `bash scripts/ntfy.sh "🚨 要確認 — {内容}"`
 4. **VPS / Azure deploy 完了時 (殿確認 URL あり)** — URL と認証情報を必ず含める
 
-送信コマンド: `bash /home/tono/multi-agent-shogun/scripts/ntfy.sh "<メッセージ>"`
+送信コマンド: `bash scripts/ntfy.sh "<メッセージ>"`
 
 ## Skill Candidates
 
```

**File**: `instructions/roles/karo_role.md` (modified, +47/-47)
```diff
@@ -2,23 +2,23 @@
 
 ## Role
 
-You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
-Do not execute tasks yourself — focus entirely on managing subordinates.
-
-Karo is a traffic controller, not a player on the field.
-Your job is to keep the workflow moving: acknowledge cmds, decompose work,
-assign owners, track dependencies, route reviews to Gunshi, route execution to
-Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
-If Karo performs work directly, Karo becomes the system bottleneck and the army
-loses parallelism.
-
-Do not hold real work yourself:
-- Implementation, shell execution, deploy steps, and test commands → Ashigaru
-- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
-- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
-- Direct Karo execution is an exception only when Karo-only authority is required
-  (all-agent control, secrets, VPS/production connection, or final gate coordination).
-  If you use the exception, write the reason in dashboard/report.
+You are Karo. Receive directives from Shogun and distribute missions to Ashigaru.
+Do not execute tasks yourself — focus entirely on managing subordinates.
+
+Karo is a traffic controller, not a player on the field.
+Your job is to keep the workflow moving: acknowledge cmds, decompose work,
+assign owners, track dependencies, route reviews to Gunshi, route execution to
+Ashigaru, update dashboard/daily logs, and make the final acceptance decision.
+If Karo performs work directly, Karo becomes the system bottleneck and the army
+loses parallelism.
+
+Do not hold real work yourself:
+- Implementation, shell execution, deploy steps, and test commands → Ashigaru
+- Quality reviews, evidence review, adoption decisions, RCA, architecture/design review → Gunshi
+- Karo retains only E2E ownership: execution plan review, prerequisite check, and final pass/fail judgment
+- Direct Karo execution is an exception only when Karo-only authority is required
+  (all-agent control, secrets, VPS/production connection, or final gate coordination).
+  If you use the exception, write the reason in dashboard/report.
 
 ## Language & Tone
 
@@ -51,10 +51,10 @@ Before assigning tasks, ask yourself these five questions:
 **Don't**: Mark cmd as done if any acceptance_criteria is unmet.
 
 ```
-❌ Bad: "Review install.bat" → Karo reviews it directly
-✅ Good: "Review install.bat" →
-    gunshi: quality review / risk assessment
-    ashigaru1: execute mechanical reproduction or fixture checks if needed
+❌ Bad: "Review install.bat" → Karo reviews it directly
+✅ Good: "Review install.bat" →
+    gunshi: quality review / risk assessment
+    ashigaru1: execute mechanical reproduction or fixture checks if needed
 ```
 
 ## Task YAML Format
@@ -66,7 +66,7 @@ task:
   parent_cmd: cmd_001
   bloom_level: L3        # L1-L3=Ashigaru, L4-L6=Gunshi
   description: "Create hello1.md with content 'おはよう1'"
-  target_path: "/mnt/c/tools/multi-agent-shogun/hello1.md"
+  target_path: "hello1.md"  # relative to project root
   echo_message: "🔥 足軽1号、先陣を切って参る！八刃一志！"
   status: assigned
   timestamp: "2026-01-25T12:00:00"
@@ -78,7 +78,7 @@ task:
   bloom_level: L6
   blocked_by: [subtask_001, subtask_002]
   description: "Integrate research results from ashigaru 1 and 2"
-  target_path: "/mnt/c/tools/multi-agent-shogun/reports/integrated_report.md"
+  target_path: "reports/integrated_report.md"  # relative to project root
   echo_message: "⚔️ 足軽3号、統合の刃で斬り込む！"
   status: blocked         # Initial status when blocked_by exists
   timestamp: "2026-01-25T12:00:00"
@@ -174,25 +174,25 @@ status to `in_progress`.
 
 **L3/L4 boundary**: Does a procedure/template exist? YES = L3 (Ashigaru). NO = L4 (Gunshi).
 
-**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
-Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
+**No review shortcut**: Review, adoption judgment, RCA, and architecture/design evaluation go to Gunshi.
+Ashigaru may perform mechanical reproduction or data gathering, but not quality judgment.
 
 ## Quality Control (QC) Routing
 
-Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
-
-### Mechanical Completion Checks → Karo
-
-When ashigaru reports task completion, Karo may perform mechanical completion checks only. These are not reviews:
+Primary QC flow is Ashigaru → Gunshi → Karo. **Ashigaru never perform QC directly.** Gunshi handles quality checks, evidence review, adoption decisions, RCA, and dashboard aggregation. Karo handles workflow state and final cmd acceptance only.
+
+### Mechanica
```

---

### Incident Patch 7: `0838f317` (2026-06-06)
**Commit Message**: fix: use Path.home() for seo-affiliate default dir

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `scripts/seo_qc.py` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
 from datetime import datetime
 from pathlib import Path
 
-DEFAULT_BASE_DIR = "/home/yohei/seo-affiliate"
+DEFAULT_BASE_DIR = str(Path.home() / "seo-affiliate")
 ALL_SITES = ["yane", "kagi", "kyutoki", "ohaka", "gaichuu", "kekkon", "ihin", "fuyouhin", "zeirishi"]
 
 # Forbidden words (check_009)
```

---

### Incident Patch 8: `daad5bf2` (2026-06-06)
**Commit Message**: fix: use relative path for stop hook (closes #160) (#161)

**File**: `.claude/settings.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
         "hooks": [
           {
             "type": "command",
-            "command": "bash /home/tono/multi-agent-shogun/scripts/stop_hook_inbox.sh",
+            "command": "bash scripts/stop_hook_inbox.sh",
             "timeout": 60
           }
         ]
```

---

### Incident Patch 9: `84c8e82b` (2026-05-22)
**Commit Message**: fix: keep OpenCode runtime variants out of tracked output

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -62,6 +62,7 @@
 
 # Multi-CLI: OpenCode agent file
 !.opencode/agents/*.md
+.opencode/agents/*-runtime.md
 
 # Multi-CLI: OpenCode custom tools
 !.opencode/tools/
```

**File**: `.opencode/agents/ashigaru1.md` (modified, +1/-3)
```diff
@@ -4,8 +4,6 @@ mode: primary
 # Auto-generated by build_instructions.sh — do not edit manually.
 # Source: instructions/roles/ashigaru_role.md + instructions/common/* + instructions/cli_specific/opencode_tools.md
 # grep intentionally inherits '*: allow'; OpenCode grep permission rules match the search regex, not file paths.
-model: openrouter/minimax/minimax-m2.5
-variant: xhigh
 permission:
   '*': allow
   edit: &id002
@@ -730,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru2.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru3.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru4.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru5.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru6.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru7.md` (modified, +1/-1)
```diff
@@ -728,7 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
-- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in a git-ignored runtime agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

---

### Incident Patch 10: `18a3e3e3` (2026-05-22)
**Commit Message**: fix: sync OpenCode variants via agent config

**File**: `.opencode/agents/ashigaru1.md` (modified, +3/-0)
```diff
@@ -4,6 +4,8 @@ mode: primary
 # Auto-generated by build_instructions.sh — do not edit manually.
 # Source: instructions/roles/ashigaru_role.md + instructions/common/* + instructions/cli_specific/opencode_tools.md
 # grep intentionally inherits '*: allow'; OpenCode grep permission rules match the search regex, not file paths.
+model: openrouter/minimax/minimax-m2.5
+variant: xhigh
 permission:
   '*': allow
   edit: &id002
@@ -728,6 +730,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru2.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru3.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru4.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru5.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru6.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/ashigaru7.md` (modified, +1/-0)
```diff
@@ -728,6 +728,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

**File**: `.opencode/agents/gunshi.md` (modified, +1/-0)
```diff
@@ -831,6 +831,7 @@ Maintain the multi-agent-shogun roleplay style, but let operational decisions be
 ### TUI mode
 
 - Use `OPENCODE_TUI_CONFIG=... opencode --model provider/model --agent <agent>`.
+- Do not pass `--variant` to the TUI command. Provider-specific variants belong in the agent frontmatter (`model:` / `variant:`), generated from `config/settings.yaml`.
 - Keep the repository-pinned `config/opencode-tui.json` so tmux automation sees stable keybinds.
 - `app_exit` is disabled.
 - `session_interrupt` is `escape`.
```

---

### Incident Patch 11: `65029a0c` (2026-05-21)
**Commit Message**: fix: avoid shogun clear auto-recovery

**File**: `scripts/inbox_watcher.sh` (modified, +4/-3)
```diff
@@ -512,7 +512,7 @@ send_cli_command() {
     # Shogun is controlled by the Lord; keystroke injection can clobber human input.
     if [ "$AGENT_ID" = "shogun" ]; then
         echo "[$(date)] [SKIP] shogun: suppressing CLI command injection ($cmd)" >&2
-        return 0
+        return 1
     fi
 
     # Busy guard: never send /clear when agent is actively processing.
@@ -1074,8 +1074,9 @@ for s in data.get('specials', []):
             fi
             cmd=$(normalize_special_command "$msg_type" "$msg_content")
             if [ -n "$cmd" ]; then
-                send_cli_command "$cmd"
-                [ "$msg_type" = "clear_command" ] && clear_sent=1
+                if send_cli_command "$cmd"; then
+                    [ "$msg_type" = "clear_command" ] && clear_sent=1
+                fi
             fi
         done <<< "$specials"
     fi
```

**File**: `tests/unit/test_send_wakeup.bats` (modified, +48/-0)
```diff
@@ -43,6 +43,7 @@
 #   T-SHOGUN-002: session_has_client — returns 1 when no client
 #   T-SHOGUN-003: send_wakeup — shogun + active + attached → send-keys (post PR#75)
 #   T-SHOGUN-004: send_wakeup — shogun + active + detached → send-keys fallthrough
+#   T-SHOGUN-005: shogun clear_command does not enqueue auto-recovery
 #   T-BUSY-005: agent_is_busy — returns busy during /clear cooldown (LAST_CLEAR_TS)
 #   T-BUSY-006: agent_is_busy — returns idle after /clear cooldown expires
 #   T-BUSY-007: agent_is_busy — /clear cooldown overrides idle pane
@@ -723,6 +724,53 @@ PY
     grep -q "send-keys.*Session Start" "$MOCK_LOG"
 }
 
+@test "T-SHOGUN-005: process_unread does not auto-recover skipped shogun clear_command" {
+    run bash -c '
+        source "'"$TEST_HARNESS"'"
+        AGENT_ID="shogun"
+        PANE_TARGET="shogun:main"
+        CLI_TYPE="codex"
+        INBOX="'"$TEST_INBOX_DIR"'/shogun.yaml"
+        LOCKFILE="${INBOX}.lock"
+        cat > "$INBOX" << "YAML"
+messages:
+  - id: msg_clear
+    from: karo
+    timestamp: "2026-05-22T03:22:46+09:00"
+    type: clear_command
+    content: refresh
+    read: false
+YAML
+        process_unread event
+        "$VENV_PYTHON" - << "PY" "$INBOX"
+import sys
+import yaml
+
+inbox_path = sys.argv[1]
+with open(inbox_path, "r", encoding="utf-8") as f:
+    data = yaml.safe_load(f) or {}
+
+messages = data.get("messages", []) or []
+msg_clear = [m for m in messages if m.get("id") == "msg_clear"]
+assert len(msg_clear) == 1 and msg_clear[0].get("read") is True
+
+auto = [
+    m for m in messages
+    if m.get("from") == "inbox_watcher"
+    and m.get("type") == "task_assigned"
+    and "[auto-recovery]" in (m.get("content") or "")
+]
+assert auto == []
+print("OK")
+PY
+    '
+    [ "$status" -eq 0 ]
+    echo "$output" | grep -q "OK"
+
+    ! grep -q "send-keys.*/new" "$MOCK_LOG"
+    ! grep -q "send-keys.*/clear" "$MOCK_LOG"
+}
+
 # --- T-OPENCODE-003: OpenCode Phase 2 falls back to plain nudge ---
 
 @test "T-OPENCODE-003: send_wakeup_with_escape falls back to plain nudge for OpenCode" {
```

---

### Incident Patch 12: `3bdecf3b` (2026-05-21)
**Commit Message**: fix(ci): use project venv for slim yaml tests

**File**: `scripts/slim_yaml.sh` (modified, +9/-2)
```diff
@@ -11,10 +11,16 @@
 set -u
 
 SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
+PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
 QUEUE_DIR="${SHOGUN_QUEUE_DIR:-${SCRIPT_DIR}/../queue}"
 LOCK_FILE="${QUEUE_DIR}/.slim_yaml.lock"
 LOCK_TIMEOUT=10
 DRY_RUN=false
+PYTHON_BIN="${SHOGUN_PYTHON_BIN:-${PROJECT_ROOT}/.venv/bin/python3}"
+
+if [ ! -x "$PYTHON_BIN" ]; then
+    PYTHON_BIN="python3"
+fi
 
 for arg in "$@"; do
     if [ "$arg" = "--dry-run" ]; then
@@ -43,8 +49,9 @@ if [ "$DRY_RUN" != true ]; then
     fi
 fi
 
-# Call the Python implementation
-python3 "$(dirname "$0")/slim_yaml.py" "$@"
+# Call the Python implementation. Prefer the project venv because CI installs
+# PyYAML there on macOS and does not install it into the system Python.
+"$PYTHON_BIN" "$(dirname "$0")/slim_yaml.py" "$@"
 exit_code=$?
 
 # Lock is automatically released when file descriptor is closed
```

**File**: `tests/unit/test_slim_yaml.bats` (modified, +8/-6)
```diff
@@ -7,6 +7,8 @@ setup() {
     export PROJECT_ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
     export TEST_TMPDIR="$(mktemp -d "$BATS_TMPDIR/slim_yaml.XXXXXX")"
     export SHOGUN_QUEUE_DIR="$TEST_TMPDIR/queue"
+    export TEST_PYTHON="$PROJECT_ROOT/.venv/bin/python3"
+    [ -x "$TEST_PYTHON" ] || TEST_PYTHON="python3"
     mkdir -p "$SHOGUN_QUEUE_DIR"/{tasks,reports,inbox}
 }
 
@@ -21,7 +23,7 @@ write_yaml() {
 }
 
 run_slim() {
-    python3 "$PROJECT_ROOT/scripts/slim_yaml.py" "$@"
+    "$TEST_PYTHON" "$PROJECT_ROOT/scripts/slim_yaml.py" "$@"
 }
 
 run_slim_wrapper() {
@@ -30,7 +32,7 @@ run_slim_wrapper() {
 
 yaml_value() {
     local file="$1" expr="$2"
-    python3 - "$file" "$expr" <<'PY'
+    "$TEST_PYTHON" - "$file" "$expr" <<'PY'
 import sys
 import yaml
 
@@ -78,7 +80,7 @@ PY
 
     [ ! -e "$SHOGUN_QUEUE_DIR/.slim_yaml.lock" ]
     [ "$(yaml_value "$SHOGUN_QUEUE_DIR/shogun_to_karo.yaml" "queue.0.id")" = "" ]
-    python3 - "$SHOGUN_QUEUE_DIR/shogun_to_karo.yaml" <<'PY'
+    "$TEST_PYTHON" - "$SHOGUN_QUEUE_DIR/shogun_to_karo.yaml" <<'PY'
 import sys, yaml
 data = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
 assert data["queue"][0]["id"] == "cmd_done"
@@ -92,7 +94,7 @@ PY
     assert_success
 
     [ "$(yaml_value "$SHOGUN_QUEUE_DIR/shogun_to_karo.yaml" "queue.0.id")" = "" ]
-    python3 - "$SHOGUN_QUEUE_DIR/shogun_to_karo.yaml" <<'PY'
+    "$TEST_PYTHON" - "$SHOGUN_QUEUE_DIR/shogun_to_karo.yaml" <<'PY'
 import sys, yaml
 data = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
 ids = [item["id"] for item in data["queue"]]
@@ -134,7 +136,7 @@ PY
     run run_slim karo
     assert_success
 
-    python3 - "$SHOGUN_QUEUE_DIR/inbox/karo.yaml" <<'PY'
+    "$TEST_PYTHON" - "$SHOGUN_QUEUE_DIR/inbox/karo.yaml" <<'PY'
 import sys, yaml
 data = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
 ids = [item["id"] for item in data["messages"]]
@@ -154,7 +156,7 @@ PY
     assert_output --partial "old ntfy terminal entries available for explicit cleanup"
 
     [ "$(yaml_value "$SHOGUN_QUEUE_DIR/ntfy_inbox.yaml" "inbox.0.id")" = "" ]
-    python3 - "$SHOGUN_QUEUE_DIR/ntfy_inbox.yaml" <<'PY'
+    "$TEST_PYTHON" - "$SHOGUN_QUEUE_DIR/ntfy_inbox.yaml" <<'PY'
 import sys, yaml
 data = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
 ids = [item["id"] for item in data["inbox"]]
```

---

### Incident Patch 13: `964bfd23` (2026-05-21)
**Commit Message**: test: make ntfy failure case uid independent

**File**: `tests/unit/test_ntfy_ack.bats` (modified, +13/-10)
```diff
@@ -195,16 +195,19 @@ JSON
     cat > "$MOCK_CURL_OUTPUT" << 'JSON'
 {"event":"message","id":"msg007","time":1234567890,"message":"should not ack","tags":[]}
 JSON
-    # Make queue directory read-only to force mkstemp/flock failure
-    chmod 555 "$MOCK_PROJECT/queue"
-    run_listener
-    # Both ACK and inbox_write should be skipped (L159 continue)
-    [ ! -s "$ACK_LOG" ]
-    [ ! -s "$INBOX_LOG" ]
-    # Restore for teardown
-    chmod 755 "$MOCK_PROJECT/queue"
-}
-
+    # Force append_ntfy_inbox failure in a UID-independent way.
+    # chmod-based write denial does not fail when the suite runs as root.
+    rm "$MOCK_PROJECT/queue/ntfy_inbox.yaml"
+    mkdir "$MOCK_PROJECT/queue/ntfy_inbox.yaml"
+    run_listener
+    # Both ACK and inbox_write should be skipped (L159 continue)
+    [ ! -s "$ACK_LOG" ]
+    [ ! -s "$INBOX_LOG" ]
+    # Restore for teardown
+    rmdir "$MOCK_PROJECT/queue/ntfy_inbox.yaml"
+    echo "inbox:" > "$MOCK_PROJECT/queue/ntfy_inbox.yaml"
+}
+
 # ═══════════════════════════════════════════════════════════════
 # T-ACK-008: Special characters in message preserved in inbox_write
 # ═══════════════════════════════════════════════════════════════
```

---

### Incident Patch 14: `2406ad55` (2026-05-19)
**Commit Message**: fix: reduced OpenCode launch delay because it doesn't fix SIGILL issue

instead the issue might come from OpenCode itself

**File**: `shutsujin_departure.sh` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ log_war() {
 opencode_startup_delay() {
     local cli_type="$1"
     if [ "$cli_type" = "opencode" ]; then
-        sleep 1
+        sleep 0.1
     fi
 }
 
```

---

### Incident Patch 15: `7c7a3bdc` (2026-05-19)
**Commit Message**: fix: stagger OpenCode agent startup to prevent 'illegal instruction' crash

OpenCode can intermittently fail with SIGILL when many TUI instances are
started in a tight burst under WSL2. The departure script previously
launched karo, ashigaru, and gunshi panes almost back-to-back, which
made the failure timing-sensitive.
This change adds a small helper that sleeps only when the resolved CLI
type is opencode, then calls it after each agent startup command. Other
CLI types keep their existing startup behavior.

**File**: `shutsujin_departure.sh` (modified, +14/-0)
```diff
@@ -83,6 +83,15 @@ log_war() {
     echo -e "\033[1;31m【戦】\033[0m $1"
 }
 
+# OpenCode は複数プロセスを短時間に連続起動すると WSL2 上で SIGILL に
+# なることがあるため、OpenCode のときだけ起動間隔を少し空ける。
+opencode_startup_delay() {
+    local cli_type="$1"
+    if [ "$cli_type" = "opencode" ]; then
+        sleep 1
+    fi
+}
+
 # ═══════════════════════════════════════════════════════════════════════════════
 # プロンプト生成関数（bash/zsh対応）
 # ───────────────────────────────────────────────────────────────────────────────
@@ -701,6 +710,7 @@ with open(f,'w') as fh: yaml.safe_dump(d, fh, default_flow_style=False, allow_un
     tmux set-option -p -t "shogun:main" @agent_cli "$_shogun_cli_type"
     tmux send-keys -t shogun:main "$_shogun_cmd"
     tmux send-keys -t shogun:main Enter
+    opencode_startup_delay "$_shogun_cli_type"
     _shogun_display=$(get_model_display_name "shogun" 2>/dev/null || echo "Opus")
     tmux set-option -p -t "shogun:main" @model_name "$_shogun_display" 2>/dev/null || true
     log_info "  └─ 将軍（${_shogun_cli_type} / ${_shogun_display}）、召喚完了"
@@ -719,6 +729,7 @@ with open(f,'w') as fh: yaml.safe_dump(d, fh, default_flow_style=False, allow_un
     tmux set-option -p -t "multiagent:agents.${p}" @agent_cli "$_karo_cli_type"
     tmux send-keys -t "multiagent:agents.${p}" "$_karo_cmd"
     tmux send-keys -t "multiagent:agents.${p}" Enter
+    opencode_startup_delay "$_karo_cli_type"
     _karo_display=$(get_model_display_name "karo" 2>/dev/null || echo "Sonnet")
     tmux set-option -p -t "multiagent:agents.${p}" @model_name "$_karo_display" 2>/dev/null || true
     log_info "  └─ 家老（${_karo_display}）、召喚完了"
@@ -740,6 +751,7 @@ with open(f,'w') as fh: yaml.safe_dump(d, fh, default_flow_style=False, allow_un
             tmux set-option -p -t "multiagent:agents.${p}" @agent_cli "$_ashi_cli_type"
             tmux send-keys -t "multiagent:agents.${p}" "$_ashi_cmd"
             tmux send-keys -t "multiagent:agents.${p}" Enter
+            opencode_startup_delay "$_ashi_cli_type"
         done
         log_info "  └─ 足軽1-${_ASHIGARU_COUNT}（決戦の陣）、召喚完了"
     else
@@ -755,6 +767,7 @@ with open(f,'w') as fh: yaml.safe_dump(d, fh, default_flow_style=False, allow_un
             tmux set-option -p -t "multiagent:agents.${p}" @agent_cli "$_ashi_cli_type"
             tmux send-keys -t "multiagent:agents.${p}" "$_ashi_cmd"
             tmux send-keys -t "multiagent:agents.${p}" Enter
+            opencode_startup_delay "$_ashi_cli_type"
         done
         log_info "  └─ 足軽1-${_ASHIGARU_COUNT}（平時の陣）、召喚完了"
     fi
@@ -770,6 +783,7 @@ with open(f,'w') as fh: yaml.safe_dump(d, fh, default_flow_style=False, allow_un
     tmux set-option -p -t "multiagent:agents.${p}" @agent_cli "$_gunshi_cli_type"
     tmux send-keys -t "multiagent:agents.${p}" "$_gunshi_cmd"
     tmux send-keys -t "multiagent:agents.${p}" Enter
+    opencode_startup_delay "$_gunshi_cli_type"
     _gunshi_display=$(get_model_display_name "gunshi" 2>/dev/null || echo "Opus+T")
     tmux set-option -p -t "multiagent:agents.${p}" @model_name "$_gunshi_display" 2>/dev/null || true
     log_info "  └─ 軍師（${_gunshi_display}）、召喚完了"
```

#### Recent Merged Pull Requests:
- **PR #168** (closed): feat(guard): Hook #7 — 上流 repo への gh pr create を機械ブロック (@halsk)
- **PR #167** (closed): feat(scripts): macOS Keychain 秘密キャッシュ helper (cmd_514) (@halsk)
- **PR #166** (closed): feat(gunshi2): Fable 5 第二軍師を swarm に常設追加 (創造/知識業務専任) (@halsk)
- **PR #162** (closed): Harden agent startup & setup (inbox, hooks, MCP, permissions) (@kazumori102)
- **PR #161** (2026-06-06): fix: use relative path for stop hook in .claude/settings.json (closes #160) (@mskz-ptplus-jp)
- **PR #157** (closed): docs: TVFプロトコル4層設計反映 (cmd_510 v2 / cmd_517) (@ysaitogrander)
- **PR #155** (2026-06-06): feat: add Cursor Agent CLI (cursor-agent) support (@sousuke0422)
- **PR #154** (2026-06-06): Add Antigravity CLI support (@TsukinowaRin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
