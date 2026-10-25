> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source**: github ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Source Version**: `c04e3749`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T13:30:49.537Z  
> **Learning ID**: `learn-github-zeronsh-zeron`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zeronsh/zeron

> **Canonical Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T13:30:48.697Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3350 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/AppModel.kt`
```
package sh.zeron.android.core

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import sh.zeron.android.design.Appearance
import sh.zeron.android.design.ThemeMode
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull
import uniffi.zeron_core.ConnectivityState
import uniffi.zeron_core.ProjectView
import uniffi.zeron_core.SendState
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import uniffi.zeron_core.AuthCallback
import uniffi.zeron_core.AuthOrg
import uniffi.zeron_core.ChatConfig
import uniffi.zeron_core.ClientEvent
import uniffi.zeron_core.ClientListener
import uniffi.zeron_core.Connectivity
import uniffi.zeron_core.CoreClient
import uniffi.zeron_core.CoreConfig
import uniffi.zeron_core.Credentials
import uniffi.zeron_core.DemoFixture
import uniffi.zeron_core.DemoOptions
import uniffi.zeron_core.NewSession
import uniffi.zeron_core.SandboxLevel
import uniffi.zeron_core.SendRequest
import uniffi.zeron_core.BusyPolicy
import uniffi.zeron_core.SessionRow
import uniffi.zeron_core.SessionTarget
import uniffi.zeron_core.StreamSpeed
import uniffi.zeron_core.TranscriptScale
import uniffi.zeron_core.WorkspaceSnapshot
import uniffi.zeron_core.WorktreeSpec
import uniffi.zeron_core.authExchangeCode
import uniffi.zeron_core.authListOrgs
import uniffi.zeron_core.authProductionEdgeUrl
import uniffi.zeron_core.authRefresh
import uniffi.zeron_core.parseAuthCallback
import uniffi.zeron_core.workosAuthorizeUrl
import java.io.File
import java.util.UUID

/** How the app was launched (adb extras mirror the iOS launch arguments). */
data class LaunchOptions(
    val demo: Boolean = false,
    val fast: Boolean = false,
    val longReply: Boolean = false,
    val big: Boolean = false,
    val huge: Boolean = false,
    val noProjects: Boolean = false,
    val signedOut: Boolean = false,
    val route: String? = null,
    /** `--es companion companions|terminal|side-chat:<id>|subagent:<tool id>`: open it over the routed chat (screenshots). */
    val companion: String? = null,
    /** `--ez terminal-demo true`: the opened terminal types a short script. */
    val terminalDemo: Boolean = false,
    /** `--ez cloud true`: offer Cloud in the demo (its pages read the demo's Cloud). */
    val cloud: Boolean = false,
    val wallpaper: String? = null,
    val wallpaperEffect: String? = null,
    /** `--ez voice-preview true`: the scripted call (debuggable builds). */
    val voicePreview: Boolean = false,
    /** `--ez voice-stage true`: open the call stage at launch (with the preview). */
    val voiceStage: Boolean = false,
    /** `--ez remote-voice true`: offer voice before any host advertises it. */
    val remoteVoice: Boolean = false,
    /** `--ez voice-selftest true`: log a host-less WebRTC offer (debuggable builds). */
    val voiceSelfTest: Boolean = false,
)

/**
 * App-wide state owner: holds the Rust [CoreClient], republishes its
 * snapshots as flows, and fans session events out to screens. Core events
 * arrive on Rust threads and hop to the main thread here.
 */
class AppModel(private val app: Application) {
    private val scope = MainScope()
    private val main = Handler(Looper.getMainLooper())
    val credentials = CredentialStore(app)
    val wallpaper = WallpaperStore(app)

    /** The app-wide voice call (one at a time, outlives screens). */
    val voice: sh.zeron.android.voice.VoiceController by lazy {
        sh.zeron.android.voice.VoiceController(app, client, workspace)
    }

    private val _client = MutableStateFlow<CoreClient?>(null)
    val client: StateFlow<CoreClient?> = _client.asStateFlow()

    private val _workspace = MutableStateFlow<WorkspaceSnapshot?>(null)
    val workspace: StateFlow<WorkspaceSnapshot?> = _workspace.asStateFlow()

    private val _connectivity = MutableStateFlow<Connectivity?>(null)
    val connectivity: StateFlow<Connectivity?> = _connectivity.asStateFlow()

    /** Chat ids whose session or composer changed. */
    private val _sessionEvents = MutableSharedFlow<String>(extraBufferCapacity = 256)
    val sessionEvents: SharedFlow<String> = _sessionEvents

    /** Organizations to pick from mid sign-in (more than one). */
    val orgChoice = MutableStateFlow<Pair<List<AuthOrg>, CompletableDeferred<AuthOrg?>>?>(null)
    val signInError = MutableStateFlow<String?>(null)

    /** App-wide snackbars ("Archived · Undo", open failures) shown by the shell. */
    val toasts = MutableSharedFlow<Toast>(extraBufferCapacity = 8)

    fun toast(message: String, action: String? = null, run: (() -> Unit)? = null) {
        toasts.tryEmit(Toast(message, action, run))
    }

    private val settings = app.getSharedPreferences("settings", 0)
    private val _appearance = MutableStateFlow(
        Appearance(
            runCatching { ThemeMode.valueOf(settings.getString("theme", "System")!!) }.getOrDefault(ThemeMode.System),
            settings.getBoolean("dynamicColor", false),
        ),
    )
    val appearance: StateFlow<Appearance> = _appearance.asStateFlow()

    fun setAppearance(value: Appearance) {
        _appearance.value = value
        settings.edit().putString("theme", value.mode.name).putBoolean("dynamicColor", value.dynamicColor).apply()
    }

    /** Sessions grouped by project in place of the flat Recent list. */
    private val _groupByProject = MutableStateFlow(settings.getBoolean("groupByProject", false))
    val groupByProject: StateFlow<Boolean> = _groupByProject.asStateFlow()

    fun setGroupByProject(on: Boolean) {
        _groupByProject.value = on
        settings.edit().putBoolean("groupByProject", on).apply()
    }

    /** Folded sidebar groups (pinned, recent, project groups), kept on this device. */
    private val _collapsed = MutableStateFlow(settings.getStringSet("collapsedGroups", emptySet())!!.toSet())
    val collapsed: StateFlow<Set<String>> = _collapsed.asStateFlow()

    fun setGroupCollapsed(id: String, collapsed: Boolean) {
        _collapsed.value = if (collapsed) _collapsed.value + id else _collapsed.value - id
        settings.edit().putStringSet("collapsedGroups", _collapsed.value).apply()
    }

    /** Unsent composer text per chat (and the new-session page), kept across launches. */
    val drafts = Drafts(app)

    /** The demo keeps the new-session page in memory only: one run's leftovers must not seed the next. */
    private val persistsNewSession get() = !launch.demo
    private var volatileNewSessionText = ""

    /** What was typed on the new-session page when it was closed unsent. */
    var newSessionText: String
        get() = if (persistsNewSession) drafts.load(Drafts.NEW_SESSION) else volatileNewSessionText
        set(value) {
            if (persistsNewSession) drafts.save(Drafts.NEW_SESSION, value) else volatileNewSessionText = value
        }

    /** Images staged there (this launch only). */
    var newSessionImages: List<sh.zeron.android.ui.StagedImage> = emptyList()

    /** The new-session page's options (project, host, branch, model, effort), kept across launches. */
    var lastDraft: NewSessionDraft = storedDraft()
        set(value) {
            field = value
            if (persistsNewSession) {
                settings.edit()
                    .putString("draft.project", value.projectId)
                    .putString("draft.host", value.hostId)
                    .putString("draft.harness", value.harness)
                    .putString("draft.model", value.model)
                    .putString("draft.effort", value.effort)
                    .putBoolean("draft.cloud", value.cloud)
                    .apply()
            }
        }

    private fun storedDraft() = NewSessionDraft(
        projectId = settings.getString("draft.project", null),
        hostId = settings.getString("draft.host", null),
        harness = settings.getString("draft.harness", null) ?: "claude-code",
        model = settings.getString("draft.model", null),
        effort = settings.getString("draft.effort", null),
        cloud = settings.getBoolean("draft.cloud", false),
    )

    var launch = LaunchOptions()
        private set

    val isDemo: Boolean get() = _client.value?.isDemo() == true
    private var refreshScheduled = false
    /** The pending sign-in's OAuth `state` (persisted: the process may die while the browser is up). */
    private var authState: String?
        get() = settings.getString("authState", null)
        set(value) = settings.edit().putString("authState", value).apply()

    private val listener = object : ClientListener {
        override fun onEvent(event: ClientEvent) {
            main.post { handle(event) }
        }
    }

    fun boot(options: LaunchOptions) {
        launch = options
        if (_client.value != null) return
        if (options.signedOut) credentials.clear()
        // The demo starts from the in-memory defaults, never a real account's options.
        if (options.demo) lastDraft = NewSessionDraft()
        watchNetwork()
        // `wallpaper <path>` / `wallpaper none` and `wallpaper-effect <name>`:
        // set the wallpaper at launch (screenshots, tests).
        options.wallpaper?.let { path ->
            if (path == "none") wallpaper.remove() else scope.launch { wallpaper.set(File(path)) }
        }
        options.wallpaperEffect?.let { name ->
            WallpaperStore.effects.firstOrNull { it.name.equals(name, ignoreCase = true) }?.let(wallpa
```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/Cloud.kt`
```
package sh.zeron.android.core

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import uniffi.zeron_core.BillingInfo
import uniffi.zeron_core.CloudAccountInfo
import uniffi.zeron_core.CloudInfo
import uniffi.zeron_core.CloudSessionInfo
import uniffi.zeron_core.CloudUsageInfo
import uniffi.zeron_core.CoreClient
import uniffi.zeron_core.CoreException
import uniffi.zeron_core.GithubRepoInfo
import uniffi.zeron_core.VaultInfo
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.cancellation.CancellationException
import kotlin.math.floor

/**
 * Cloud for this account (iOS `CloudStore`): status and credits, GitHub, the
 * agents' logins, billing. Every screen reads it; reads are cached so a page
 * paints at once and revalidates. Snapshot state, main thread only.
 */
@Stable
class CloudStore(private val scope: CoroutineScope, private val client: () -> CoreClient?, private val workspaceChanged: () -> Unit) {
    /** The agents Cloud runs, with the vault providers behind them. */
    data class Agent(
        val harness: String,
        val name: String,
        /** Subscription sign-in provider (`claude` · `codex`). */
        val login: String,
        /** API key provider (`anthropic-key` · `openai-key`). */
        val key: String,
        /** What signing in is called ("Sign in with Claude"). */
        val signInTitle: String,
        val keyName: String,
    )

    /** What's wrong with Cloud as a whole, for the top of its page. */
    data class Problem(val title: String, val detail: String, /** Credits fix it: the row leads to Billing. */ val billing: Boolean)

    var info by mutableStateOf<CloudInfo?>(null); private set
    var vault by mutableStateOf<VaultInfo?>(null); private set
    var repos by mutableStateOf<List<GithubRepoInfo>?>(null); private set
    var accounts by mutableStateOf<Map<String, List<CloudAccountInfo>>>(emptyMap()); private set
    /** Each Cloud login's plan usage by `provider:slot` (read by the vault), and why it couldn't be read. */
    var usage by mutableStateOf<Map<String, CloudUsageInfo>>(emptyMap()); private set
    var usageErrors by mutableStateOf<Map<String, String>>(emptyMap()); private set
    var billing by mutableStateOf<BillingInfo?>(null); private set
    /** Why the last billing read failed (shown with Retry until one succeeds). */
    var billingError by mutableStateOf<String?>(null); private set
    /** The account's session machines (read when a Cloud chat needs them). */
    var sessions by mutableStateOf<List<CloudSessionInfo>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    // ── reading ───────────────────────────────────────────────────────────

    val available: Boolean get() = info?.available == true
    val credits: Double? get() = billing?.creditsTotal ?: info?.credits

    /** Cloud can't start or wake a machine (the desktop's rule). */
    val outOfCredits: Boolean get() = (info?.credits ?: billing?.creditsTotal)?.let { it <= 0 } == true

    val problem: Problem?
        get() {
            val i = info ?: return null
            if (!i.available) return null
            if (i.state == "error") return Problem("Cloud ran into a problem", i.error ?: "Something went wrong with Cloud.", billing = false)
            if (outOfCredits) return Problem("Out of credits", "Cloud sessions can't start or wake until you add credits.", billing = true)
            return null
        }

    /** Why a Cloud chat's machine isn't running, when the edge said. */
    fun sessionError(chatId: String, device: String?): String? {
        val s = sessions.firstOrNull { it.chatId == chatId } ?: sessions.firstOrNull { it.deviceId == device } ?: return null
        return if (s.state == "error") s.error ?: "Its machine failed to start." else null
    }

    val githubAccount: String? get() = vault?.connections?.firstOrNull { it.provider == "github" && !it.needsReconnect }?.account
    val githubConnected: Boolean get() = vault?.connections?.any { it.provider == "github" && !it.needsReconnect } == true

    /** The active login (or key) Cloud uses for `agent`. */
    fun activeAccount(agent: Agent): CloudAccountInfo? =
        accounts[agent.login]?.firstOrNull { it.active } ?: accounts[agent.key]?.firstOrNull { it.active }

    fun hasAccount(agent: Agent): Boolean =
        !accounts[agent.login].isNullOrEmpty() || !accounts[agent.key].isNullOrEmpty() ||
            vault?.connections?.any { (it.provider == agent.login || it.provider == agent.key) && it.accounts > 0u } == true

    /** Cloud reaches `repo` (`owner/name`): its sessions can run there. */
    fun reaches(repo: String?): Boolean {
        if (!available || repo == null) return false
        return repos?.any { it.fullName.equals(repo, ignoreCase = true) } == true
    }

    // ── loading ───────────────────────────────────────────────────────────

    private var refreshJob: Job? = null
    /** How long until a failed status read is tried again (30 s, doubling to 5 min). */
    private var retryDelayMs = 30_000L
    private var sessionsReadAt = 0L

    /** Re-read everything (status first: the rest needs Cloud set up). */
    fun refresh() {
        val c = client() ?: return
        if (refreshJob?.isActive == true) return
        loading = true
        refreshJob = scope.launch {
            try {
                var status = c.cloudStatus()
                // Cloud is part of every signed-in account: set it up.
                if (status.available && status.state == "off") status = runCatching { c.cloudEnable() }.getOrDefault(status)
                if (client() !== c) return@launch
                info = status
                error = null
                if (!status.available) return@launch
                coroutineScope {
                    val v = async { runCatching { c.vaultStatus() }.getOrNull() }
                    val r = async { runCatching { c.githubRepos(null) }.getOrNull() }
                    val b = async { runCatching { c.billingStatus() }.getOrNull() }
                    val lists = readAccounts(c)
                    if (client() !== c) return@coroutineScope
                    vault = v.await()
                    repos = r.await() ?: emptyList()
                    billing = b.await()
                    accounts = lists
                }
                retryDelayMs = 30_000L
                refreshUsage()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (client() !== c) return@launch
                error = message(e)
                // Until a read answers, Cloud reads as not offered: ask again rather than hide it for good.
                val wait = retryDelayMs
                retryDelayMs = minOf(wait * 2, 300_000L)
                scope.launch {
                    delay(wait)
                    if (client() === c && (info == null || error != null)) refresh()
                }
            } finally {
                if (client() === c) loading = false
            }
        }
    }

    private suspend fun readAccounts(c: CoreClient): Map<String, List<CloudAccountInfo>> = coroutineScope {
        agents.flatMap { listOf(it.login, it.key) }
            .map { provider -> async { provider to (runCatching { c.vaultAccounts(provider) }.getOrNull() ?: emptyList()) } }
            .awaitAll()
            .toMap()
    }

    /** Re-read the session machines (at most every few seconds). */
    fun refreshSessions() {
        val c = client() ?: return
        if (!available && info != null) return
        val now = System.currentTimeMillis()
        if (now - sessionsReadAt < 8_000) return
        sessionsReadAt = now
        scope.launch {
            val list = runCatching { c.cloudSessions() }.getOrNull()
            val status = runCatching { c.cloudStatus() }.getOrNull()
            if (client() !== c) return@launch
            list?.let { sessions = it }
            status?.let { info = it }
        }
    }

    fun refreshAccounts() {
        val c = client() ?: return
        scope.launch {
            val lists = readAccounts(c)
            val v = runCatching { c.vaultStatus() }.getOrNull()
            if (client() !== c) return@launch
            accounts = lists
            v?.let { vault = it }
            refreshUsage()
        }
    }

    /** Re-read every Cloud login's plan usage (keys have none). */
    fun refreshUsage() {
        val c = client() ?: return
        val logins = agents.flatMap { agent -> accounts[agent.login].orEmpty().map { agent.login to it.slot } }
        scope.launch {
            val results = logins.map { (provider, slot) ->
                async { "$provider:$slot" to runCatching { c.vaultUsage(provider, slot) } }
            }.awaitAll()
            if (client() !== c) return@launch
            val u = usage.toMutableMap()
            val errors = usageErrors.toMutableMap()
            for ((key, result) in results) {
                result.onSuccess { u[key] = it; errors.remove(key) }.onFailure { errors[key] = message(it) }
            }
            usage = u
            usageErrors = errors
        }
    }

    suspend fun refreshGitHub() {
        val c = client() ?: return
        val v = runCatchin
```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/CredentialStore.kt`
```
package sh.zeron.android.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject
import uniffi.zeron_core.AuthTokens
import uniffi.zeron_core.Credentials

/**
 * Credentials and the signed-in account's display identity, in app-private
 * storage (the client itself only knows ids). Tokens are sealed with an
 * Android Keystore key (the iOS Keychain's counterpart): the key never
 * leaves the keystore, so a copied preferences file can't be replayed.
 */
class CredentialStore(context: Context) {
    private val prefs = context.getSharedPreferences("credentials", Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build(),
        )
        return generator.generateKey()
    }

    private fun seal(plain: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
        val sealed = cipher.iv + cipher.doFinal(plain.toByteArray())
        return Base64.encodeToString(sealed, Base64.NO_WRAP)
    }

    private fun open(sealed: String): String? = runCatching {
        val bytes = Base64.decode(sealed, Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, 12))
        String(cipher.doFinal(bytes, 12, bytes.size - 12))
    }.getOrNull()

    private fun storedJson(): String? {
        prefs.getString("sealed", null)?.let { return open(it) }
        // Builds before the keystore stored plain JSON: seal it on first read.
        val legacy = prefs.getString("credentials", null) ?: return null
        prefs.edit().putString("sealed", seal(legacy)).remove("credentials").apply()
        return legacy
    }

    fun stored(): Credentials? {
        val json = storedJson()?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
        return when (json.optString("kind")) {
            "workos" -> Credentials.WorkOs(
                json.getString("userId"),
                json.getString("orgId"),
                AuthTokens(json.getString("access"), json.getString("refresh")),
            )
            "dev" -> Credentials.Dev(json.getString("userId"), json.getString("orgId"))
            else -> null
        }
    }

    fun store(credentials: Credentials) {
        val json = when (credentials) {
            is Credentials.WorkOs -> JSONObject()
                .put("kind", "workos")
                .put("userId", credentials.userId)
                .put("orgId", credentials.orgId)
                .put("access", credentials.tokens.accessToken)
                .put("refresh", credentials.tokens.refreshToken)
            is Credentials.Dev -> JSONObject().put("kind", "dev").put("userId", credentials.userId).put("orgId", credentials.orgId)
            is Credentials.Demo -> return
        }
        prefs.edit().putString("sealed", seal(json.toString())).remove("credentials").apply()
    }

    fun updateTokens(tokens: AuthTokens) {
        val current = stored() as? Credentials.WorkOs ?: return
        store(Credentials.WorkOs(current.userId, current.orgId, tokens))
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    data class Profile(val name: String? = null, val email: String? = null, val orgName: String? = null)

    var profile: Profile
        get() = Profile(prefs.getString("name", null), prefs.getString("email", null), prefs.getString("orgName", null))
        set(value) {
            prefs.edit().putString("name", value.name).putString("email", value.email).putString("orgName", value.orgName).apply()
        }

    private companion object {
        const val KEY_ALIAS = "zeron-credentials"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/DeliveryService.kt`
```
package sh.zeron.android.core

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import sh.zeron.android.R

/**
 * Keeps the process running for a few seconds after the user leaves, so a
 * message sent just before can reach the edge (iOS `beginBackgroundTask`).
 * The core does the work on its own threads; this only holds the process
 * out of the cached (frozen) state. Started from the activity's onStop,
 * inside the platform's foreground-to-background grace window.
 */
class DeliveryService : Service() {
    private val main = Handler(Looper.getMainLooper())
    private val stop = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE else ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), type)
        } catch (e: Exception) {
            // Too late to start from the background: delivery resumes next launch.
            Log.w("Zeron", "delivery hold refused", e)
            stopSelf()
            return START_NOT_STICKY
        }
        running = true
        main.removeCallbacks(stop)
        main.postDelayed(stop, intent?.getLongExtra(EXTRA_MS, DEFAULT_MS) ?: DEFAULT_MS)
        return START_NOT_STICKY
    }

    /** Android 14+ short services must stop when their time is up. */
    override fun onTimeout(startId: Int) = stopSelf()

    override fun onDestroy() {
        running = false
        main.removeCallbacks(stop)
        super.onDestroy()
    }

    private fun notification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "Message delivery", NotificationManager.IMPORTANCE_MIN).apply {
                    description = "Shown briefly while a message you just sent is delivered"
                    setShowBadge(false)
                },
            )
        }
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.zi_arrow_up)
            .setContentTitle("Sending your message…")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val CHANNEL = "delivery"
        private const val NOTIFICATION_ID = 7101
        private const val EXTRA_MS = "ms"
        private const val DEFAULT_MS = 25_000L

        /** In the foreground state (stopping one that hasn't got there yet is an error). */
        @Volatile private var running = false

        fun hold(context: Context, ms: Long) {
            val intent = Intent(context, DeliveryService::class.java).putExtra(EXTRA_MS, ms)
            try {
                context.startForegroundService(intent)
            } catch (e: Exception) {
                Log.w("Zeron", "delivery hold refused", e)
            }
        }

        fun release(context: Context) {
            if (running) context.stopService(Intent(context, DeliveryService::class.java))
        }
    }
}

```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/Drafts.kt`
```
package sh.zeron.android.core

import android.content.Context

/** Unsent composer text per chat (iOS `Drafts`): blank drafts are forgotten. */
class Drafts(context: Context) {
    private val prefs = context.getSharedPreferences("drafts", Context.MODE_PRIVATE)

    fun load(key: String): String = prefs.getString(key, null) ?: ""

    fun save(key: String, text: String) {
        val edit = prefs.edit()
        if (text.isBlank()) edit.remove(key) else edit.putString(key, text)
        edit.apply()
    }

    companion object {
        const val NEW_SESSION = "new-session"
    }
}

```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/Fonts.kt`
```
package sh.zeron.android.core

import android.content.res.AssetManager
import android.graphics.Paint
import android.graphics.Typeface
import uniffi.zeron_core.FaceData
import uniffi.zeron_core.FaceRole
import uniffi.zeron_core.PlatformMeasurer
import uniffi.zeron_core.TextSystem

/**
 * The bundled faces. Rust measures the exact bytes Skia draws with (the same
 * files the iOS app registers with CoreText), so measurement and rendering
 * share one source of truth.
 */
object Fonts {
    val files: List<Pair<FaceRole, String>> = listOf(
        FaceRole.SANS to "Geist.ttf",
        FaceRole.SANS_MEDIUM to "Geist-Medium.ttf",
        FaceRole.SANS_SEMIBOLD to "Geist-SemiBold.ttf",
        FaceRole.SANS_BOLD to "Geist-Bold.ttf",
        FaceRole.SANS_ITALIC to "Geist-Italic.ttf",
        FaceRole.SANS_MEDIUM_ITALIC to "Geist-MediumItalic.ttf",
        FaceRole.SANS_SEMIBOLD_ITALIC to "Geist-SemiBoldItalic.ttf",
        FaceRole.SANS_BOLD_ITALIC to "Geist-BoldItalic.ttf",
        FaceRole.MONO to "GeistMono.ttf",
        FaceRole.MONO_MEDIUM to "GeistMono-Medium.ttf",
        FaceRole.MONO_SEMIBOLD to "GeistMono-SemiBold.ttf",
        FaceRole.MONO_ITALIC to "GeistMono-Italic.ttf",
    )

    private lateinit var faces: List<FaceData>
    private val typefaces = HashMap<FaceRole, Typeface>()

    fun init(assets: AssetManager) {
        if (::faces.isInitialized) return
        faces = files.mapNotNull { (role, file) ->
            runCatching {
                val bytes = assets.open(file).use { it.readBytes() }
                typefaces[role] = Typeface.createFromAsset(assets, file)
                FaceData(role, bytes)
            }.getOrNull()
        }
    }

    val faceData: List<FaceData> get() = faces

    fun typeface(face: FaceRole): Typeface = typefaces[face] ?: typefaces[FaceRole.SANS] ?: Typeface.DEFAULT

    /** A paint for `face` at `size` px. Linear metrics: advances match Rust's unhinted ones. */
    fun paint(face: FaceRole, size: Float, ligatures: Boolean): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = typeface(face)
        textSize = size
        isSubpixelText = true
        isLinearText = true
        if (!ligatures) fontFeatureSettings = "'liga' 0, 'calt' 0"
    }
}

/** Skia (via Minikin) as ground truth for glyphs the bundled faces don't cover. */
class AndroidMeasurer : PlatformMeasurer {
    private data class Key(val face: FaceRole, val centi: Int, val ligatures: Boolean)

    // Called on the Rust layout thread; Paint isn't thread-safe.
    private val paints = ThreadLocal.withInitial { HashMap<Key, Paint>() }

    private fun paint(face: FaceRole, size: Float, ligatures: Boolean): Paint =
        paints.get()!!.getOrPut(Key(face, (size * 100).toInt(), ligatures)) { Fonts.paint(face, size, ligatures) }

    override fun measure(face: FaceRole, size: Float, ligatures: Boolean, text: String): Float =
        paint(face, size, ligatures).measureText(text)

    /** Per-scalar advances of `text` laid out as one run, folded from UTF-16 units. */
    override fun measureRun(face: FaceRole, size: Float, ligatures: Boolean, text: String): List<Float> {
        val n = text.length
        if (n == 0) return emptyList()
        val perUnit = FloatArray(n)
        paint(face, size, ligatures).getTextRunAdvances(text.toCharArray(), 0, n, 0, n, false, perUnit, 0)
        val out = ArrayList<Float>(text.codePointCount(0, n))
        var i = 0
        while (i < n) {
            val w = Character.charCount(text.codePointAt(i))
            var sum = 0f
            for (k in i until minOf(n, i + w)) sum += perUnit[k]
            out.add(sum)
            i += w
        }
        return out
    }
}

/** One process-wide text system shared by every transcript. */
object TextEngine {
    val shared: TextSystem by lazy { TextSystem(Fonts.faceData, AndroidMeasurer()) }
}

```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/Terminals.kt`
```
package sh.zeron.android.core

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONArray
import org.json.JSONObject
import uniffi.zeron_core.CoreClient
import uniffi.zeron_core.CoreException
import uniffi.zeron_core.TerminalListener
import uniffi.zeron_core.TerminalPhase
import uniffi.zeron_core.TerminalRef
import uniffi.zeron_core.TerminalSession
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicBoolean

/**
 * One terminal on a chat's host. The Rust session keeps the emulator and the
 * output stream alive while no screen shows it, so coming back is instant
 * and the session knows what's still running.
 */
class TerminalTab(val chatId: String, val session: TerminalSession, ordinal: Int) : TerminalListener {
    private val main = Handler(Looper.getMainLooper())
    private val scheduled = AtomicBoolean(false)
    private val observers = CopyOnWriteArraySet<() -> Unit>()

    /** Position among the chat's terminals ("zsh", "zsh 2", …). */
    var ordinal by mutableIntStateOf(ordinal)
    /** The phase as last seen on main (drives the session's chips). */
    var phase by mutableStateOf<TerminalPhase>(TerminalPhase.Connecting)
        private set
    var title by mutableStateOf<String?>(null)
        private set
    internal var onPhaseChange: (() -> Unit)? = null
    var onBell: (() -> Unit)? = null

    val ref: TerminalRef get() = session.info()

    /** "zsh", or what the running program calls itself. */
    val name: String
        get() {
            title?.takeIf { it.isNotEmpty() }?.let { return it }
            val shell = ref.shell.ifEmpty { "Terminal" }
            return if (ordinal > 1) "$shell $ordinal" else shell
        }

    /** The folder it started in, home-abbreviated. */
    val folder: String get() = abbreviateHome(ref.cwd)

    val isLive: Boolean get() = phase !is TerminalPhase.Exited && phase !is TerminalPhase.Gone

    /** Called on main after each coalesced change; returns the unsubscribe. */
    fun observe(handler: () -> Unit): () -> Unit {
        observers.add(handler)
        return { observers.remove(handler) }
    }

    // TerminalListener: client threads. Bursts coalesce into one pull per loop turn.
    override fun changed() {
        if (!scheduled.compareAndSet(false, true)) return
        main.post {
            scheduled.set(false)
            val p = session.phase()
            val t = session.title()
            if (p != phase || t != title) {
                phase = p
                title = t
                onPhaseChange?.invoke()
            }
            observers.forEach { it() }
        }
    }

    override fun bell() {
        main.post { onBell?.invoke() }
    }
}

fun abbreviateHome(cwd: String): String {
    for (home in listOf("/Users/", "/home/")) {
        if (cwd.startsWith(home)) {
            val rest = cwd.removePrefix(home)
            val slash = rest.indexOf('/')
            return if (slash >= 0) "~" + rest.substring(slash) else "~"
        }
    }
    return if (cwd == "/root") "~" else cwd
}

/**
 * Every chat's terminals. Their refs persist, so a relaunch reattaches to
 * shells still running on their hosts (their output replays).
 */
class TerminalStore(context: Context, private val client: () -> CoreClient?) {
    private val prefs = context.getSharedPreferences("terminals", 0)
    private val tabs = HashMap<String, MutableList<TerminalTab>>()
    private val restored = HashSet<String>()
    private val _changes = MutableSharedFlow<String>(extraBufferCapacity = 64)
    /** Chat ids whose terminals came, went, or changed phase. */
    val changes: SharedFlow<String> = _changes
    var dark = false
        set(value) {
            field = value
            tabs.values.flatten().forEach { it.session.setDark(value) }
        }

    fun tabs(chatId: String): List<TerminalTab> {
        restore(chatId)
        return tabs[chatId].orEmpty().toList()
    }

    /** Open a shell on the chat's host. */
    suspend fun open(chatId: String, cols: Int, rows: Int): TerminalTab {
        val client = client() ?: throw CoreException.Closed()
        restore(chatId)
        val ordinal = (tabs[chatId]?.maxOfOrNull { it.ordinal } ?: 0) + 1
        val relay = ListenerRelay()
        val session = client.openTerminal(chatId, cols.toUShort(), rows.toUShort(), relay)
        val tab = adopt(chatId, session, ordinal, relay)
        persist(chatId)
        _changes.tryEmit(chatId)
        return tab
    }

    /** End the shell on its host and forget it. */
    fun close(tab: TerminalTab) {
        tab.session.end()
        forget(tab)
    }

    /** Forget a tab whose shell already ended. */
    fun forget(tab: TerminalTab) {
        tab.session.detach()
        tabs[tab.chatId]?.remove(tab)
        persist(tab.chatId)
        _changes.tryEmit(tab.chatId)
    }

    private fun adopt(chatId: String, session: TerminalSession, ordinal: Int, relay: ListenerRelay): TerminalTab {
        val tab = TerminalTab(chatId, session, ordinal)
        relay.target = tab
        tab.onPhaseChange = {
            // A terminal its host forgot can't come back.
            if (tab.phase is TerminalPhase.Gone) forget(tab) else _changes.tryEmit(chatId)
        }
        session.setDark(dark)
        tabs.getOrPut(chatId) { mutableListOf() }.add(tab)
        return tab
    }

    private fun restore(chatId: String) {
        val client = client() ?: return
        if (!restored.add(chatId)) return
        val saved = runCatching { JSONObject(prefs.getString("all", "{}")!!).optJSONArray(chatId) }.getOrNull() ?: return
        for (i in 0 until saved.length()) {
            val o = saved.optJSONObject(i) ?: continue
            val id = o.optString("id")
            val device = o.optString("device")
            if (id.isEmpty() || device.isEmpty()) continue
            val ref = TerminalRef(
                id = id,
                deviceId = device,
                cwd = o.optString("cwd"),
                shell = o.optString("shell", "zsh"),
                hostReplies = o.optBoolean("replies", true),
            )
            val relay = ListenerRelay()
            val session = client.attachTerminal(ref, 80u, 24u, relay)
            adopt(chatId, session, i + 1, relay)
        }
    }

    private fun persist(chatId: String) {
        val all = runCatching { JSONObject(prefs.getString("all", "{}")!!) }.getOrDefault(JSONObject())
        val list = JSONArray()
        for (tab in tabs[chatId].orEmpty()) {
            val r = tab.ref
            list.put(JSONObject().put("id", r.id).put("device", r.deviceId).put("cwd", r.cwd).put("shell", r.shell).put("replies", r.hostReplies))
        }
        if (list.length() == 0) all.remove(chatId) else all.put(chatId, list)
        prefs.edit().putString("all", all.toString()).apply()
    }

    fun signOut() {
        tabs.values.flatten().forEach { it.session.detach() }
        tabs.clear()
        restored.clear()
        prefs.edit().clear().apply()
    }

    /** The session exists before its tab (the listener is a constructor argument): this forwards once it does. */
    private class ListenerRelay : TerminalListener {
        @Volatile var target: TerminalTab? = null
        override fun changed() { target?.changed() }
        override fun bell() { target?.bell() }
    }
}

```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/Wallpaper.kt`
```
package sh.zeron.android.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import uniffi.zeron_core.WallpaperEffect
import uniffi.zeron_core.wallpaperRender
import uniffi.zeron_core.wallpaperSafeOpacity
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The chat wallpaper (desktop "new thread background"): one image plus an
 * effect, stored locally. Effects and the contrast guard run in the Rust
 * core (`wallpaper.rs`) off the main thread; renders are cached per
 * appearance — the same pipeline as iOS.
 */
class WallpaperStore(private val context: Context) {
    data class State(val set: Boolean, val name: String?, val effect: WallpaperEffect, val generation: Int)

    /** A rendered wallpaper and the highest opacity that keeps text readable. */
    class Render(val image: ImageBitmap, val opacity: Float)

    private val prefs = context.getSharedPreferences("wallpaper", 0)
    private val dir = File(context.filesDir, "wallpaper").apply { mkdirs() }
    private val file = File(dir, "wallpaper.jpg")
    private val cache = HashMap<String, Render>()

    private val _state = MutableStateFlow(read(0))
    val state: StateFlow<State> = _state.asStateFlow()

    private fun read(generation: Int) = State(
        set = file.exists(),
        name = prefs.getString("name", null),
        effect = runCatching { WallpaperEffect.valueOf(prefs.getString("effect", "NONE")!!) }.getOrDefault(WallpaperEffect.NONE),
        generation = generation,
    )

    private fun changed() {
        synchronized(cache) { cache.clear() }
        _state.value = read(_state.value.generation + 1)
    }

    /** Store a picked image (long side ≤ 1600 px, decoded downsampled). */
    suspend fun set(uri: Uri, name: String) = withContext(Dispatchers.IO) {
        runCatching {
            val bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri)) { decoder, info, _ ->
                val scale = min(1f, 1600f / max(info.size.width, info.size.height))
                if (scale < 1f) decoder.setTargetSize((info.size.width * scale).roundToInt(), (info.size.height * scale).roundToInt())
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
            store(bitmap, name)
        }
    }

    /** Store an image file (launch extra `wallpaper` for screenshots and tests). */
    suspend fun set(path: File) = withContext(Dispatchers.IO) {
        runCatching {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path.path, bounds)
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= 1600) sample *= 2
            val bitmap = BitmapFactory.decodeFile(path.path, BitmapFactory.Options().apply { inSampleSize = sample })!!
            store(bitmap, path.name)
        }
    }

    private suspend fun store(bitmap: Bitmap, name: String) {
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
        prefs.edit().putString("name", name).apply()
        withContext(Dispatchers.Main) { changed() }
    }

    fun setEffect(effect: WallpaperEffect) {
        prefs.edit().putString("effect", effect.name).apply()
        changed()
    }

    fun remove() {
        file.delete()
        prefs.edit().remove("name").apply()
        changed()
    }

    /** Render for an appearance (null when no wallpaper is set). */
    suspend fun render(dark: Boolean): Render? {
        val s = _state.value
        if (!s.set) return null
        val key = "${s.effect}-$dark"
        synchronized(cache) { cache[key] }?.let { return it }
        return withContext(Dispatchers.Default) {
            runCatching {
                val source = BitmapFactory.decodeFile(file.path) ?: return@runCatching null
                val scale = min(1f, 1200f / max(source.width, source.height))
                val w = max(1, (source.width * scale).roundToInt())
                val h = max(1, (source.height * scale).roundToInt())
                val sized = Bitmap.createScaledBitmap(source, w, h, true).copy(Bitmap.Config.ARGB_8888, false)
                val buffer = ByteBuffer.allocate(w * h * 4)
                sized.copyPixelsToBuffer(buffer)
                val out = wallpaperRender(buffer.array(), w.toUInt(), h.toUInt(), s.effect, !dark)
                // Text sits over the top of the artwork: primary text keeps
                // 4.5:1, secondary 3:1 against its worst pixels there.
                val text = (if (dark) 0xE8E8EA else 0x27272C).toUInt()
                val secondary = (if (dark) 0xA9A9AE else 0x62626A).toUInt()
                val background = (if (dark) 0x060606 else 0xF3F3F5).toUInt()
                val primary = wallpaperSafeOpacity(out, w.toUInt(), h.toUInt(), text, background, 0.6f, 4.5f, 1f)
                val muted = wallpaperSafeOpacity(out, w.toUInt(), h.toUInt(), secondary, background, 0.6f, 3f, 1f)
                val rendered = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                rendered.copyPixelsFromBuffer(ByteBuffer.wrap(out))
                Render(rendered.asImageBitmap(), min(primary, muted))
            }.getOrNull()
        }?.also { r -> if (_state.value.generation == s.generation) synchronized(cache) { cache[key] = r } }
    }

    companion object {
        val effects = listOf(WallpaperEffect.NONE, WallpaperEffect.DITHER, WallpaperEffect.ASCII, WallpaperEffect.HALFTONE, WallpaperEffect.SCANLINES)

        fun label(e: WallpaperEffect) = when (e) {
            WallpaperEffect.NONE -> "None"
            WallpaperEffect.DITHER -> "Dither"
            WallpaperEffect.ASCII -> "ASCII"
            WallpaperEffect.HALFTONE -> "Halftone"
            WallpaperEffect.SCANLINES -> "Scanlines"
        }

        fun detail(e: WallpaperEffect) = when (e) {
            WallpaperEffect.NONE -> "Shows the original artwork."
            WallpaperEffect.DITHER -> "Rebuilds the artwork with a dithered color palette."
            WallpaperEffect.ASCII -> "Recreates the artwork with colored characters."
            WallpaperEffect.HALFTONE -> "Recreates the artwork with colored print dots."
            WallpaperEffect.SCANLINES -> "Adds a pronounced horizontal display-line texture."
        }
    }
}

```

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/transcript/TranscriptState.kt`
```
package sh.zeron.android.transcript

import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import sh.zeron.android.core.TextEngine
import uniffi.zeron_core.LayoutFrame
import uniffi.zeron_core.LayoutListener
import uniffi.zeron_core.RowKind
import uniffi.zeron_core.TranscriptView
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/**
 * One transcript's layout engine plus the viewport over it. Rust owns
 * geometry: each [LayoutFrame] gives exact row offsets, so this only tracks
 * the scroll offset (dp) and keeps the user's place across frames — anchored
 * to a row, or following the tail.
 */
@Stable
class TranscriptState {
    private val main = Handler(Looper.getMainLooper())
    private val pending = AtomicBoolean(false)

    val engine: TranscriptView = TranscriptView(TextEngine.shared, object : LayoutListener {
        // Layout thread: coalesce to one pull per main-loop turn.
        override fun frameReady(revision: ULong) {
            if (pending.compareAndSet(false, true)) main.post {
                pending.set(false)
                if (!closed) apply(engine.frame())
            }
        }
    })

    var frame by mutableStateOf<LayoutFrame?>(null)
        private set
    /** Scroll offset in dp (0 = top of the content). */
    var offset by mutableFloatStateOf(0f)
    var viewport by mutableFloatStateOf(0f)
    /** Breathing room below the last row, on top of the frame's own (dp). */
    var bottomInset by mutableFloatStateOf(12f)
    var following by mutableStateOf(true)
    var dragging by mutableStateOf(false)
    val fonts = StyleFonts()
    /** Rows present before a frame arrived don't fade in. */
    internal val knownKeys = HashSet<ULong>()
    internal var settled = false

    private val cache = object : LinkedHashMap<Triple<ULong, ULong, Float>, RowModel>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Triple<ULong, ULong, Float>, RowModel>?) = size > 400
    }

    private var closed = false
    private var width = 0f
    private var scale = 0f

    /** Attachment upload progress (rings on `pending://` thumbnails). */
    var uploadProgress by mutableStateOf<Double?>(null)

    // ── Runway (desktop transcript.rs `OwnTurnAnchor`) ─────────────────────
    //
    // On an immediate send the prompt glides to the top of the viewport and
    // the content is held at least one viewport tall below it, so the reply
    // streams into reserved space without the view moving on every token.
    // Once the reply fills it, the runway retires and the ordinary follow
    // takes over; a drag releases the hold (the space stays as scroll room).
    private class OwnTurn(val key: ULong?, val before: Set<ULong>)
    private var ownTurn by mutableStateOf<OwnTurn?>(null)
    private var queuedTurn: Set<ULong>? = null

    /** Reserve the reply's space below the prompt about to be sent. */
    fun beginOwnTurn() {
        queuedTurn = null
        ownTurn = OwnTurn(null, recentUserKeys())
        following = true
    }

    /** A message queued behind the live turn takes the runway once its bubble lands. */
    fun expectQueuedTurn() {
        if (queuedTurn == null) queuedTurn = recentUserKeys()
        following = true
    }

    /** The newest user row not in `before`, near the tail. */
    private fun newUserRow(f: LayoutFrame, before: Set<ULong>): ULong? {
        val n = f.rowCount().toInt()
        for (i in (n - 1) downTo max(0, n - 12)) {
            val p = f.placement(i.toUInt()) ?: continue
            if (p.kind == RowKind.USER && p.key !in before) return p.key
        }
        return null
    }

    /** Content height the runway holds, or null when it isn't holding. */
    private val runwayHeight: Float?
        get() {
            val turn = ownTurn ?: return null
            val f = frame ?: return null
            val key = turn.key ?: return null
            val p = f.indexOf(key)?.let { f.placement(it) } ?: return null
            val natural = f.totalHeight() + bottomInset
            val minimum = p.y + viewport
            return if (natural >= minimum - 0.5f) null else minimum
        }

    /** The runway is gliding the prompt up (ease-out instead of the settle spring). */
    val runwayActive: Boolean get() = runwayHeight != null

    val contentHeight: Float get() = max((frame?.totalHeight() ?: 0f) + bottomInset, runwayHeight ?: 0f)
    val maxOffset: Float get() = max(0f, contentHeight - viewport)
    val distanceFromBottom: Float get() = maxOffset - offset

    fun setViewport(widthDp: Float, heightDp: Float, textScale: Float) {
        viewport = heightDp
        if (widthDp != width || textScale != scale) {
            width = widthDp
            scale = textScale
            engine.setViewport(widthDp, textScale)
        }
    }

    fun apply(new: LayoutFrame) {
        val old = frame
        val first = old == null || old.rowCount() == 0u
        var anchor: Pair<ULong, Float>? = null
        if (!following && old != null) {
            old.indexAt(max(0f, offset))?.let { i ->
                old.placement(i)?.let { p -> anchor = p.key to (offset - p.y) }
            }
        }
        queuedTurn?.let { before ->
            newUserRow(new, before)?.let { key ->
                queuedTurn = null
                ownTurn = OwnTurn(key, before)
                following = true
            }
        }
        ownTurn?.let { turn -> if (turn.key == null) newUserRow(new, turn.before)?.let { ownTurn = OwnTurn(it, turn.before) } }
        motion = motionFor(old, new)
        frame = new
        if (first && new.rowCount() > 0u) {
            for (i in 0u until new.rowCount()) new.placement(i)?.let { knownKeys.add(it.key) }
            offset = maxOffset
            settled = true
        } else if (!following) {
            anchor?.let { (key, delta) ->
                new.indexOf(key)?.let { i -> new.placement(i)?.let { p -> offset = (p.y + delta).coerceIn(0f, maxOffset) } }
            }
        }
    }

    // ── Row motion ────────────────────────────────────────────────────────
    //
    // Fold toggles tween 140 ms ease-out; a visible tool group that grew (a
    // new call arrived) reveals over 360 ms expo — the desktop timings. Rows
    // interpolate from where the previous frame placed them.

    class Motion(val id: Int, val from: Map<ULong, Pair<Float, Float>>, val durationMs: Int, val expo: Boolean)

    var motion by mutableStateOf<Motion?>(null)
        private set
    private var motionId = 0
    private var pendingFold: ULong? = null

    private fun motionFor(old: LayoutFrame?, new: LayoutFrame): Motion? {
        if (old == null || old.rowCount() == 0u || old.width() != new.width()) return null
        fun height(f: LayoutFrame, key: ULong) = f.indexOf(key)?.let { f.placement(it)?.height }
        val band = old.rowsIn(offset - viewport, offset + viewport * 2)
        val fold = pendingFold
        val kind = when {
            fold != null && height(old, fold) != null && height(old, fold) != height(new, fold) -> {
                pendingFold = null
                140 to false
            }
            band.any { it.kind == RowKind.TOOLS && (height(new, it.key) ?: 0f) > it.height } -> 360 to true
            else -> return null
        }
        return Motion(++motionId, band.associate { it.key to (it.y to it.height) }, kind.first, kind.second)
    }

    /** The display model for a row at the frame's width (cached per version). */
    fun model(frame: LayoutFrame, index: UInt, key: ULong, version: ULong): RowModel? {
        val k = Triple(key, version, frame.width())
        cache[k]?.let { return it }
        val display = frame.display(index) ?: return null
        return RowModel(display).also { cache[k] = it }
    }

    /** User scroll by `delta` dp (positive = toward the tail). Returns the consumed amount. */
    fun scrollBy(delta: Float): Float {
        val before = offset
        offset = (offset + delta).coerceIn(0f, maxOffset)
        // Momentum carrying the list back into the last 70dp re-latches follow.
        if (!following && !dragging && delta > 0 && distanceFromBottom < 70f) following = true
        return offset - before
    }

    fun scrollToBottom() {
        following = true
    }

    /** A drag hands control to the user (the runway's space stays as scroll room). */
    fun released() {
        following = false
    }

    fun toggle(key: ULong) {
        pendingFold = key
        engine.toggle(key)
    }

    fun toggleDetail(row: ULong, detail: ULong, open: Boolean) {
        pendingFold = row
        engine.toggleDetail(row, detail, open)
    }

    /** Newest user row keys (the runway looks for a new one after a send). */
    fun recentUserKeys(): Set<ULong> {
        val f = frame ?: return emptySet()
        val n = f.rowCount().toInt()
        val out = HashSet<ULong>()
        for (i in (n - 1) downTo max(0, n - 24)) f.placement(i.toUInt())?.let { if (it.kind == RowKind.USER) out.add(it.key) }
        return out
    }

    /** Where this transcript's visuals load their scripts (the chat's host) and the frames' pixel density. */
    fun setVisualSource(client: uniffi.zeron_core.CoreClient, deviceId: String, pixelScale: Float) =
        engine.setVisualSource(client, deviceId, pixelScale)

    fun close() {
        closed = true
        engine.shutdown()
        engine.close()
    }
}

```

### Core Architecture Module: `apps/ios/Zeron/Core/Fonts.swift`
```
import CoreText
import UIKit

/// The bundled faces. Rust measures the exact bytes CoreText draws with, so
/// measurement and rendering share one source of truth.
enum Fonts {
    static let files: [(FaceRole, String)] = [
        (.sans, "Geist"),
        (.sansMedium, "Geist-Medium"),
        (.sansSemibold, "Geist-SemiBold"),
        (.sansBold, "Geist-Bold"),
        (.sansItalic, "Geist-Italic"),
        (.sansMediumItalic, "Geist-MediumItalic"),
        (.sansSemiboldItalic, "Geist-SemiBoldItalic"),
        (.sansBoldItalic, "Geist-BoldItalic"),
        (.mono, "GeistMono"),
        (.monoMedium, "GeistMono-Medium"),
        (.monoSemibold, "GeistMono-SemiBold"),
        (.monoItalic, "GeistMono-Italic"),
    ]

    private static let registry: (faces: [FaceData], graphics: [FaceRole: CGFont]) = {
        var faces: [FaceData] = []
        var graphics: [FaceRole: CGFont] = [:]
        for (role, name) in files {
            guard let url = Bundle.main.url(forResource: name, withExtension: "ttf"),
                  let data = try? Data(contentsOf: url),
                  let provider = CGDataProvider(data: data as CFData),
                  let font = CGFont(provider)
            else { continue }
            CTFontManagerRegisterGraphicsFont(font, nil)
            faces.append(FaceData(role: role, bytes: data))
            graphics[role] = font
        }
        return (faces, graphics)
    }()

    static var faceData: [FaceData] { registry.faces }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var cache: [FontKey: CTFont] = [:]

    private struct FontKey: Hashable {
        let face: FaceRole
        let centi: Int
    }

    /// Thread-safe: the Rust layout thread calls through `PlatformMeasurer`.
    static func ctFont(_ face: FaceRole, size: Float) -> CTFont {
        let key = FontKey(face: face, centi: Int((size * 100).rounded()))
        lock.lock()
        defer { lock.unlock() }
        if let font = cache[key] { return font }
        let font: CTFont
        if let graphic = registry.graphics[face] ?? registry.graphics[.sans] {
            font = CTFontCreateWithGraphicsFont(graphic, CGFloat(size), nil, nil)
        } else {
            font = CTFontCreateUIFontForLanguage(.system, CGFloat(size), nil)!
        }
        cache[key] = font
        return font
    }

    static func ui(_ face: FaceRole, _ size: CGFloat) -> UIFont {
        ctFont(face, size: Float(size)) as UIFont
    }

    /// The core's math faces, by table index (0 Fira Math, 1 STIX Two Math,
    /// …, whichever face the setting picks; glyph ids index these exact
    /// bytes), each at `mathReferenceSize`. Loaded when a row model first
    /// names its index (models build on the prefetch queue, so drawing never
    /// pays the copy) — a face nobody picks is never copied out of the core — and
    /// kept; a failed load is remembered as nil so it's never retried. Never
    /// registered: they're drawn by glyph id, not by name. Glyphs draw at any
    /// size by scaling the context — no per-size fonts, since shrunk formulas
    /// make sizes continuous (and iOS doesn't hint, so a scaled glyph paints
    /// the same as a sized one).
    private static let mathLock = NSLock()
    nonisolated(unsafe) private static var mathFonts: [UInt8: CTFont?] = [:]

    /// The size `mathFont` fonts are made at; scale by `size / this` to draw.
    static let mathReferenceSize: CGFloat = 16

    /// Math font `index` at `mathReferenceSize` (nil: unknown face).
    /// Thread-safe: row models resolve glyph fonts on the prefetch queue (and
    /// on main for a row needed before its prefetch lands).
    static func mathFont(_ index: UInt8) -> CTFont? {
        mathLock.lock()
        defer { mathLock.unlock() }
        if let font = mathFonts[index] { return font }
        let data = mathFontData(index: index)
        var font: CTFont?
        if !data.isEmpty, let provider = CGDataProvider(data: data as CFData), let graphic = CGFont(provider) {
            font = CTFontCreateWithGraphicsFont(graphic, mathReferenceSize, nil, nil)
        }
        mathFonts[index] = .some(font)
        return font
    }
}

/// CoreText as ground truth for glyphs the bundled faces don't cover.
final class CoreTextMeasurer: PlatformMeasurer {
    func measure(face: FaceRole, size: Float, ligatures: Bool, text: String) -> Float {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: Fonts.ctFont(face, size: size),
            .ligature: ligatures ? 1 : 0,
        ]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs))
        return Float(CTLineGetTypographicBounds(line, nil, nil, nil))
    }

    /// Per-scalar advances of `text` laid out as one CoreText line (fallback
    /// font + kerning chosen in context), folded from UTF-16 glyph indices.
    func measureRun(face: FaceRole, size: Float, ligatures: Bool, text: String) -> [Float] {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: Fonts.ctFont(face, size: size),
            .ligature: ligatures ? 1 : 0,
        ]
        let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs))
        let units = text.utf16.count
        var perUnit = [Float](repeating: 0, count: units)
        for case let run as CTRun in CTLineGetGlyphRuns(line) as NSArray {
            let n = CTRunGetGlyphCount(run)
            guard n > 0 else { continue }
            var advances = [CGSize](repeating: .zero, count: n)
            var indices = [CFIndex](repeating: 0, count: n)
            CTRunGetAdvances(run, CFRange(location: 0, length: n), &advances)
            CTRunGetStringIndices(run, CFRange(location: 0, length: n), &indices)
            for i in 0..<n where indices[i] >= 0 && indices[i] < units {
                perUnit[indices[i]] += Float(advances[i].width)
            }
        }
        var out: [Float] = []
        out.reserveCapacity(text.unicodeScalars.count)
        var unit = 0
        for scalar in text.unicodeScalars {
            let width = scalar.utf16.count
            out.append(perUnit[unit..<min(units, unit + width)].reduce(0, +))
            unit += width
        }
        return out
    }
}

/// One process-wide text system shared by every transcript.
enum TextEngine {
    static let shared = TextSystem(faces: Fonts.faceData, measurer: CoreTextMeasurer())
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1034** (2026-10-25): **Transcript rail: ten ticks at most; hovering opens the prompt list**
  *Symptoms*: In long conversations the rail had become a dense comb of one tick per prompt. Now it draws **at most 10 ticks**, and **resting the pointer on it replaces it with a list of every prompt**, the pattern [shadcn recommends](https://x.com/shadcn) from ChatGPT web. Each entry shows the prompt *and* the opening of its reply.  **Rail** - Up to 10 prompts, one tick each, as before. Past 10, each tick stands for an even slice of the conversation, lit while any of its prompts is on screen. - The rail now centres between the titlebar and the composer, the same band the list opens in. - **Lighting fix:** while the transcript is pinned to the bottom, the list reported no row positions, so only the prompt being read lit up. Rows are now placed from the content's end in that state, so every prompt on screen lights its tick and its list entry.  **Prompt list (on hover)** - **Opening:** it opens after the pointer **rests on the rail for 150ms**, so passing over it on the way to the sidebar doesn't flash it open. It closes when the pointer leaves. - **Content:** each prompt on **one line**, with its reply's opening on up to **three**. Replies are reduced to prose (no `**`, backticks or link targets). - **Size and position:** it opens where the rail is, replacing it. It's at most **three quarters of the band's height**, and **sizes to the gutter** left of the reading column (260 to 320px) to overlap the transcript as little as possible. - **Navigation:** clicking an entry glides the transcript 

- **Issue #1032** (2026-10-25): **Releases: serve the Android APK's stable name uncached; name each build uniquely**
  *Symptoms*: ## Why  The website's Android download (`zeron.sh/releases/zeron-android-arm64.apk`) could hand back an old build. The edge sent every release artifact except `.txt`/`.json` as `cache-control: public, max-age=86400, immutable`, which overrode the `no-cache` the Android workflow uploads with. Every build replaces that stable name, so a browser that had downloaded it once kept serving its cached copy for up to a day without checking the server again.  ## What  - **edge**: the `/releases/*` route moved to `edge/src/releases.ts`. When an object was uploaded with its own cache-control, the route now serves that. `.apk` files are served as `application/vnd.android.package-archive`. Desktop artifacts are uploaded without metadata, so their headers stay the same. - **android.yml**: each published APK is now named `zeron-<version>-<build>-android-arm64.apk`. Before, the name was reused by every build of a version. These per-build copies are never replaced, so they're uploaded as `immutable` for a year. The stable name is still uploaded `no-cache`. - New workerd test `test/workerd/releases.workerd.test.ts` covers immutable artifacts, short-lived pointers and an upload's own policy. The `RELEASES` bucket is now bound in the workerd test config.  ## Testing  - `npm run typecheck` and `npm test` in `edge/`: everything passes except `device-nudges` (draining 300 queued wakes), which failed in the full run. It passes on its own, both on this branch and on main. - Checked the live origin: wi

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

### Incident Patch 1: `2e151ca6` (2026-10-23)
**Commit Message**: Harden every provider: crash and stall detection, Windows-safe launching, and run recovery (#977)

* Harness: lossy line framing for child stdio; OpenCode startup retries and readiness

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Harness: drop unused line-reader imports; retry OpenCode port races per line

lossy_lines replaced every tokio Lines, leaving AsyncBufReadExt and
BufReader imports unused across the harnesses.

Address-in-use was matched against the stderr tail after exit, but the
tail keeps only the last few lines and Node prints EADDRINUSE above a
stack trace that scrolls it out, so a lost port race failed the spawn
instead of retrying. Match it per line alongside "database is locked",
with a fixture that loses the race once.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* Claude: classify results by their error fields and never drop a result line

The CLI files API failures (invalid key, 429, 529, full context) under
`subtype: "success"` with `is_error`/`terminal_reason`/`api_error_status`;
they ended the turn Completed. They now end Errored with readable wording
(the CLI's own text after a plain headline), aborts end Interrupted, and a
failure already 

**File**: `.github/workflows/windows.yml` (modified, +5/-0)
```diff
@@ -73,6 +73,11 @@ jobs:
       - uses: ./.github/actions/windows-ci-setup
       - name: Native harness security and integration tests
         run: cargo test --release --locked -p zeron-harness --features native-fixture --lib --test codex_availability --test windows_native
+      # The driver suites whose fixtures run without a POSIX shell: an in-test
+      # HTTP/SSE server (OpenCode), node (the Cursor shim) and a Rust peer
+      # (Pi). The shell- and python-fixture suites are unix-only.
+      - name: Portable harness integration tests
+        run: cargo test --release --locked -p zeron-harness --features native-fixture --test opencode --test cursor_shim --test pi_rpc
       - name: Shader layout tests
         run: cargo test --release --locked -p gpui_windows --lib layout
       - name: Application and updater tests
```

**File**: `crates/engine/src/doc_host.rs` (modified, +11/-1)
```diff
@@ -5216,12 +5216,22 @@ impl DocHost {
             // between mark-processed and the outcome write. Left alone it is
             // a send no drain or retry can ever reach ("Sending…" forever,
             // 2026-08-19); terminalize it so the truth lands in the doc and
-            // a user retry can mint a fresh attempt.
+            // a user retry can mint a fresh attempt. `commands` may predate a
+            // racing drain that has since resolved the command and released
+            // its claim (resolve comes first), so once no claim is seen the
+            // status is read again rather than overwriting that outcome.
+            let still_pending = |id: &str| {
+                handle.doc.read_commands().is_ok_and(|now| {
+                    now.iter()
+                        .any(|c| c.id == id && c.status == SessionCommandStatus::Pending)
+                })
+            };
             for c in &commands {
                 if c.status == SessionCommandStatus::Pending
                     && !skipped.contains(&c.id)
                     && is_processed(&c.id)
                     && !lock(&self.inner.executing).contains(&c.id)
+                    && still_pending(&c.id)
                 {
                     tracing::warn!(chat = %handle.chat_id, command = %c.id,
                         "command consumed but never resolved (crash mid-execute?); rejecting");
```

**File**: `crates/engine/src/lib.rs` (modified, +52/-0)
```diff
@@ -579,6 +579,16 @@ impl EngineCore {
         // releases the next queued row. Freeze first so quitting never starts
         // recovered work while the engine is being torn down.
         self.doc_host.pause_all_queues();
+        // Decided here, from the auth state at the stop, so every way an
+        // engine goes down (headless, background, in-process) agrees.
+        let auth = self
+            .auth
+            .lock()
+            .unwrap_or_else(std::sync::PoisonError::into_inner)
+            .clone();
+        if auth.is_some_and(|auth| forgoes_revival(self.workspace_scope, &auth.state())) {
+            self.sessions.forgo_revival();
+        }
         self.sessions.shutdown().await;
         self.terminals.shutdown();
         self.sessions.stop_activity_projection().await;
@@ -1146,6 +1156,16 @@ impl Engine {
     }
 }
 
+/// Whether a stopping engine's cut-off turns stay ended rather than revive on
+/// the next boot ([`EngineCore::shutdown`] asks): a synced engine whose
+/// account is signed out by the time it stops, whichever stop reached it
+/// first — the auth watcher, or the app's StopEngine right after its SignOut.
+/// Sign-out is the user ending the session, like a Stop. A local engine is
+/// signed out as a matter of course.
+pub(crate) fn forgoes_revival(scope: WorkspaceScope, auth: &AuthState) -> bool {
+    scope == WorkspaceScope::Synced && matches!(auth, AuthState::SignedOut)
+}
+
 async fn wait_for_signed_out(state: &mut tokio::sync::watch::Receiver<AuthState>) {
     loop {
         if matches!(&*state.borrow(), AuthState::SignedOut) {
@@ -1698,3 +1718,35 @@ fn replace_empty_device_id(temp_path: &Path, path: &Path) -> std::io::Result<()>
         std::fs::hard_link(temp_path, path)
     }
 }
+
+#[cfg(test)]
+mod revival_tests {
+    use super::*;
+
+    #[test]
+    fn only_a_signed_out_synced_engine_forgoes_revival() {
+        assert!(forgoes_revival(
+            WorkspaceScope::Synced,
+            &AuthState::SignedOut
+        ));
+        let user = AuthUser {
+            id: "u".into(),
+            email: "u@example.com".into(),
+            name: None,
+        };
+        assert!(!forgoes_revival(
+            WorkspaceScope::Synced,
+            &AuthState::SignedIn {
+                user: user.clone(),
+                org_id: Some("o".into()),
+            }
+        ));
+        assert!(!forgoes_revival(
+            WorkspaceScope::Synced,
+            &AuthState::NeedsOrganization { user }
+        ));
+        for scope in [WorkspaceScope::Local, WorkspaceScope::Development] {
+            assert!(!forgoes_revival(scope, &AuthState::SignedOut));
+        }
+    }
+}
```

**File**: `crates/engine/src/managed.rs` (modified, +3/-0)
```diff
@@ -387,6 +387,9 @@ impl Engine {
         engine.refresh_task.abort();
         engine.auth.quiesce_refresh(Duration::from_secs(10)).await;
         let runtime = engine.runtime.lock().await.take();
+        // The app signs out, then stops the engine: the StopEngine may land
+        // before the auth watcher does, so the runtime's shutdown decides
+        // revival from the auth state, not from the branch that fired.
         if let Some(runtime) = runtime {
             runtime.shutdown().await;
         }
```

**File**: `crates/engine/src/run_journal.rs` (modified, +121/-10)
```diff
@@ -5,7 +5,9 @@
 //! journal is the durable replay source for live streams (`Subscribe` = replay then tail
 //! the broadcast hub) and the crash-recovery gauge: a journal whose LAST event is not
 //! `Done` belongs to a run that died mid-stream — boot recovery stamps its doc entry
-//! `aborted` and closes the journal with a synthetic `Done`.
+//! `aborted` and closes the journal with a synthetic `Done`. A turn the engine's own
+//! shutdown cut off closes normally, so a `{chat_id}.shutdown` marker beside the
+//! journal flags it for the same pick-up on the next boot.
 //!
 //! Bounded-window compaction is deferred (whole file kept for now, per M2 scope); a torn
 //! trailing line from a crash mid-write is tolerated everywhere.
@@ -72,24 +74,95 @@ impl RunJournal {
         self.dir.join(format!("{}.resume", sanitize_id(chat_id)))
     }
 
+    fn shutdown_path(&self, chat_id: &str) -> PathBuf {
+        self.dir.join(format!("{}.shutdown", sanitize_id(chat_id)))
+    }
+
+    fn stop_path(&self, chat_id: &str) -> PathBuf {
+        self.dir.join(format!("{}.stopped", sanitize_id(chat_id)))
+    }
+
     /// Auto-resume revival budget (zeron `resumeAttempt`/`MAX_AUTO_RESUME`):
     /// persisted beside the journal so a run that CRASHES THE ENGINE cannot
-    /// revive itself in an infinite boot loop.
-    pub fn resume_attempts(&self, chat_id: &str) -> u32 {
-        std::fs::read_to_string(self.attempts_path(chat_id))
-            .ok()
-            .and_then(|s| s.trim().parse().ok())
-            .unwrap_or(0)
+    /// revive itself in an infinite boot loop. Stored as `{count} {last_ms}`;
+    /// a ledger whose last revival is older than `since_ms` has expired (a
+    /// chain from days ago must not refuse today's crash). A bare count (the
+    /// older format) never expires.
+    pub fn resume_attempts(&self, chat_id: &str, since_ms: i64) -> u32 {
+        let Ok(raw) = std::fs::read_to_string(self.attempts_path(chat_id)) else {
+            return 0;
+        };
+        let mut fields = raw.split_whitespace();
+        let count = fields.next().and_then(|s| s.parse().ok()).unwrap_or(0);
+        match fields.next().and_then(|s| s.parse::<i64>().ok()) {
+            Some(last) if last < since_ms => 0,
+            _ => count,
+        }
     }
 
-    pub fn note_resume_attempt(&self, chat_id: &str) -> u32 {
-        let next = self.resume_attempts(chat_id) + 1;
-        if let Err(err) = std::fs::write(self.attempts_path(chat_id), next.to_string()) {
+    /// Record one revival at `at_ms`, counting on from the unexpired ledger
+    /// (`since_ms` as in [`Self::resume_attempts`]); returns the new count.
+    pub fn note_resume_attempt(&self, chat_id: &str, at_ms: i64, since_ms: i64) -> u32 {
+        let next = self.resume_attempts(chat_id, since_ms) + 1;
+        if let Err(err) = std::fs::write(self.attempts_path(chat_id), format!("{next} {at_ms}")) {
             tracing::warn!(chat = %chat_id, error = %err, "resume-attempt ledger write failed");
         }
         next
     }
 
+    /// Mark a chat whose turn the engine's own shutdown cut off (at `at_ms`):
+    /// its journal closes with an ordinary `Done{interrupted}`, so this marker
+    /// is what tells the next boot the turn was not the user's to end.
+    pub fn note_shutdown_interrupt(&self, chat_id: &str, at_ms: i64) {
+        if let Err(err) = std::fs::write(self.shutdown_path(chat_id), at_ms.to_string()) {
+            tracing::warn!(chat = %chat_id, error = %err, "shutdown marker write failed");
+        }
+    }
+
+    /// Chats marked by [`Self::note_shutdown_interrupt`], with when.
+    pub fn shutdown_interrupts(&self) -> Result<Vec<(String, i64)>, JournalError> {
+        let mut marked = Vec::new();
+        for entry in std::fs::read_dir(&self.dir)? {
+            let path = entry?.path();
+            if path.extension().and_then(|e| e.to_str()) != Some("shutdown") {
+                continue;
+            }
+            let Some(chat_id) = path.file_stem().and_then(|s| s.to_str()) else {
+                continue;
+            };
+            let at = std::fs::read_to_string(&path)
+                .ok()
+                .and_then(|s| s.trim().parse().ok())
+                .unwrap_or(0);
+            marked.push((chat_id.to_string(), at));
+        }
+        marked.sort();
+        Ok(marked)
+    }
+
+    pub fn clear_shutdown_interrupt(&self, chat_id: &str) {
+        let _ = std::fs::remove_file(self.shutdown_path(chat_id));
+    }
+
+    /// Mark a chat whose turn the user stopped. Its journal closes only once
+    /// the stopped run settles (seconds later, for a harness slow to let
+    /// go): an engine that dies in between leaves a journal that reads as a
+    /// crash, and this marker keeps the next boot from reviving the turn.
+    pub fn note_user_stop(&self, chat_id: &str) {
+        if let Err(err) = std::fs::write(self.stop_path(chat_id), b"") {
+            tracing::warn!(chat = %chat_id, error = %err,
```

**File**: `crates/engine/src/sessions.rs` (modified, +1199/-106)
```diff
@@ -184,6 +184,10 @@ struct RunHandle {
     /// is unambiguously before the stop (cancelled with it) or after it
     /// (re-dispatched to a fresh runtime — never lost).
     retiring: Arc<std::sync::atomic::AtomicBool>,
+    /// The turn was working when the engine's shutdown began, and no Stop
+    /// has claimed it since: if the shutdown is what ends it, the next boot
+    /// picks it back up (see [`Inner::mark_shutdown_cut`]).
+    shutdown_cut: std::sync::atomic::AtomicBool,
     /// The credential the run started with (a Cloud device's broker; `None`
     /// elsewhere): a parked session whose account has since changed is
     /// replaced before its next turn.
@@ -225,14 +229,36 @@ struct RoutedSteer {
     request: Option<Box<RunRequest>>,
 }
 
+/// A turn the engine cut off (a crash or its own shutdown), on its way back
+/// to the provider as a fresh dispatch of the same user message.
+#[derive(Debug, Clone)]
+struct Revival {
+    message_id: String,
+    /// Sent instead of the original prompt when the resumed provider session
+    /// already holds that prompt and part of the work on it.
+    continuation: Option<String>,
+}
+
 struct Inner {
     voice: crate::voice::VoiceManager,
     device_id: String,
     /// The engine is shutting down: dying runs re-dispatch nothing.
     shutting_down: std::sync::atomic::AtomicBool,
+    /// A shutdown marks the turns it cuts off for pick-up on the next boot
+    /// (cleared by [`SessionsEngine::forgo_revival`]).
+    revive_after_shutdown: std::sync::atomic::AtomicBool,
+    /// Per chat: the recovery re-dispatch on its way (see
+    /// [`SessionsEngine::recover_stale`]), claimed by its message's dispatch.
+    revivals: Mutex<HashMap<String, Revival>>,
     /// Per chat: messages a Stop cancelled while they were still on their
     /// way (see [`SessionsEngine::cancel_sent_messages`]).
     cancelled_sends: Mutex<HashMap<String, std::collections::HashSet<String>>>,
+    /// Per chat: how many Stops the user has sent, counted before each one
+    /// looks for the run to stop. A retry re-dispatching a failed start
+    /// compares it with the count its run started under: a Stop that landed
+    /// while no run was live (between the failed run and its retry) found
+    /// nothing to stop, and still ends the turn.
+    user_stops: Mutex<HashMap<String, u64>>,
     /// Loopback IPC port this engine serves, once known (0 = not serving):
     /// what the injected `zeron mcp` server dials back into.
     ipc_port: std::sync::atomic::AtomicU16,
@@ -263,6 +289,14 @@ struct Inner {
     /// (zeron kept the same pair on `chats.harness_session_id`). An empty
     /// session id is the "do not resume" tombstone after a rejected resume.
     harness_sessions: Mutex<HashMap<String, HarnessSessionRef>>,
+    /// Per chat: session ids the provider said it no longer has. Never
+    /// resumed again from any source — the per-provider record a switched
+    /// chat keeps would otherwise hand the dead id straight back — until a
+    /// new session replaces them (in memory only, like the tombstone).
+    rejected_resumes: Mutex<HashMap<String, std::collections::HashSet<String>>>,
+    /// Chats whose next run starts over after a rejected resume, owed a
+    /// notice in the transcript that the earlier session is gone.
+    fresh_start_notices: Mutex<std::collections::HashSet<String>>,
     /// Auto-titler for untitled chats (wired at engine assembly; absent in bare tests).
     titles: OnceLock<crate::titles::TitleGenerator>,
     generated_images: OnceLock<(crate::uploads::Uploads, std::path::PathBuf)>,
@@ -299,7 +333,10 @@ impl SessionsEngine {
                 voice: crate::voice::VoiceManager::default(),
                 device_id,
                 shutting_down: std::sync::atomic::AtomicBool::new(false),
+                revive_after_shutdown: std::sync::atomic::AtomicBool::new(true),
+                revivals: Mutex::new(HashMap::new()),
                 cancelled_sends: Mutex::new(HashMap::new()),
+                user_stops: Mutex::new(HashMap::new()),
                 ipc_port: std::sync::atomic::AtomicU16::new(0),
                 ipc_token_file: Mutex::new(None),
                 journal,
@@ -313,6 +350,8 @@ impl SessionsEngine {
                 activity_task: Mutex::new(None),
                 last_requests: Mutex::new(HashMap::new()),
                 harness_sessions: Mutex::new(HashMap::new()),
+                rejected_resumes: Mutex::new(HashMap::new()),
+                fresh_start_notices: Mutex::new(std::collections::HashSet::new()),
                 titles: OnceLock::new(),
                 generated_images: OnceLock::new(),
                 scratch_root: OnceLock::new(),
@@ -572,8 +611,17 @@ impl SessionsEngine {
                 _ => break,
             }
         }
-        self.dispatch_inner(chat_id, HarnessId::Codex, request, None, false, true)
-            .await
+        self.dispatch_inner(
+            chat_id,
+            Ha
```

**File**: `crates/engine/tests/message_queue.rs` (modified, +12/-2)
```diff
@@ -387,7 +387,8 @@ async fn queue_holds_during_a_turn_and_flushes_in_order_at_its_end() {
 
 /// Quitting the host must neither release the queue through the interrupt's
 /// Idle transition nor release it when the persisted document is reopened.
-/// An explicit queue action remains the thaw gesture.
+/// An explicit queue action remains the thaw gesture. (The turn the shutdown
+/// cut off is picked back up on its own; the queue behind it is not.)
 #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
 async fn restart_restores_the_queue_frozen_until_an_explicit_send() {
     let tmp = tempfile::tempdir().unwrap();
@@ -429,9 +430,18 @@ async fn restart_restores_the_queue_frozen_until_an_explicit_send() {
     // Materializing the persisted chat starts its background drain task. Give
     // that task time to prove the restored row stays frozen.
     assert_eq!(queue_texts(&after), vec!["after restart"]);
+    wait_for(
+        || after_prompts.lock().unwrap().iter().any(|p| p == "opening"),
+        "the interrupted opening turn to be picked back up",
+    )
+    .await;
     tokio::time::sleep(Duration::from_millis(250)).await;
     assert!(
-        after_prompts.lock().unwrap().is_empty(),
+        !after_prompts
+            .lock()
+            .unwrap()
+            .iter()
+            .any(|p| p == "after restart"),
         "startup must not dispatch a recovered queue"
     );
     assert_eq!(queue_texts(&after), vec!["after restart"]);
```

**File**: `crates/engine/tests/restart_resume.rs` (modified, +19/-9)
```diff
@@ -732,20 +732,30 @@ async fn fresh_crash_auto_resumes_and_notes_the_interruption() {
         )),
         "aborted entry carries the visible interruption note"
     );
-    // Re-dispatch reuses the original user message id — never a duplicate.
-    assert_eq!(
-        entries
-            .iter()
-            .filter(|e| e.role == MessageRole::User)
-            .count(),
-        1
-    );
+    // Re-dispatch reuses the original user message id — never a duplicate,
+    // and the transcript keeps the user's own words.
+    let users: Vec<_> = entries
+        .iter()
+        .filter(|e| e.role == MessageRole::User)
+        .collect();
+    assert_eq!(users.len(), 1);
+    assert!(matches!(
+        &users[0].parts[0],
+        MessagePart::Text { text, .. } if text == "long task"
+    ));
     // The revived run continues the journal-recovered harness conversation.
+    // That session already holds the request and the partial work on it, so
+    // the provider gets a continuation, never the bare request a second time
+    // (it rides along only for reference, should the session have started over).
     // (An auto-title request may precede it — titling fires at dispatch.)
     let recorded = requests.lock().unwrap().clone();
+    assert!(
+        recorded.iter().all(|r| r.prompt != "long task"),
+        "the crashed request must not be re-sent: {recorded:#?}"
+    );
     let revived = recorded
         .iter()
-        .find(|r| r.prompt == "long task")
+        .find(|r| r.prompt.contains("Continue where you left off"))
         .expect("auto-resumed dispatch reached the harness");
     assert_eq!(
         revived.resume.as_deref(),
```

---

### Incident Patch 2: `3c97a05c` (2026-10-24)
**Commit Message**: iOS: paint terminal box and block glyphs; fix the subagents chip icon (#1010)

Box drawing, block elements and the ⏺ bullet are now painted into their
cells instead of shaped. Geist Mono has none of them, and fallback glyphs
neither fill the terminal's line height nor the cell width, so Claude
Code's block-art mascot showed seams and borders broke between rows; ⏺
fell back to the color emoji. Other one-cell symbols ask for their text
presentation.

The subagents chip drew its bot icon as a speck: the tool-* SVGs declare
1em and load at a point square. Rasterize assets at the icon's size.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/ios/Zeron/Companions/CompanionStrip.swift` (modified, +15/-1)
```diff
@@ -119,7 +119,7 @@ final class CompanionChip: UIControl {
         if spinning { glyph.kind = .spinner }
         icon.isHidden = spinning || symbol == nil
         if let symbol {
-            icon.image = UIImage(named: symbol)?.withRenderingMode(.alwaysTemplate)
+            icon.image = Self.asset(symbol)
                 ?? UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .semibold))
         }
         if case let .dot(color)? = kind {
@@ -136,4 +136,18 @@ final class CompanionChip: UIControl {
     override var isHighlighted: Bool {
         didSet { alpha = isHighlighted ? 0.7 : 1 }
     }
+
+    /// A `tool-*` asset at the icon's size. The SVGs declare `1em` and load
+    /// at about a point square, which a centered image view drew as a speck.
+    private static var assets: [String: UIImage] = [:]
+    private static func asset(_ name: String) -> UIImage? {
+        if let cached = assets[name] { return cached }
+        guard let image = UIImage(named: name) else { return nil }
+        let side: CGFloat = 15
+        let sized = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { _ in
+            image.draw(in: CGRect(x: 0, y: 0, width: side, height: side))
+        }.withRenderingMode(.alwaysTemplate)
+        assets[name] = sized
+        return sized
+    }
 }
```

**File**: `apps/ios/Zeron/Companions/TerminalGlyphs.swift` (added, +198/-0)
```diff
@@ -0,0 +1,198 @@
+import UIKit
+
+/// Box drawing (U+2500–257F), block elements (U+2580–259F) and the `⏺`
+/// bullet, drawn instead of shaped. Geist Mono has none of them, and a
+/// fallback font's glyphs neither fill the roomy line height nor share the
+/// cell width: borders broke between rows and Claude Code's block-art mascot
+/// fell apart. Painted from the cell's own rect, snapped to device pixels,
+/// neighbors meet exactly; `⏺` would otherwise fall back to the color emoji.
+enum TerminalGlyphs {
+    static func draws(_ scalar: Unicode.Scalar) -> Bool {
+        (0x2500...0x259F).contains(scalar.value) || scalar.value == 0x23FA
+    }
+
+    /// `cell` in UIKit coordinates (y down); `baseline` and `xHeight` place
+    /// the bullet like a text glyph.
+    static func draw(_ scalar: Unicode.Scalar, in cell: CGRect, baseline: CGFloat, xHeight: CGFloat, color: UIColor, ctx: CGContext, scale: CGFloat) {
+        let snap = { (v: CGFloat) in (v * scale).rounded() / scale }
+        let rect = CGRect(x: snap(cell.minX), y: snap(cell.minY), width: snap(cell.maxX) - snap(cell.minX), height: snap(cell.maxY) - snap(cell.minY))
+        ctx.saveGState()
+        defer { ctx.restoreGState() }
+        ctx.setFillColor(color.cgColor)
+        ctx.setStrokeColor(color.cgColor)
+        let v = scalar.value
+        if v == 0x23FA {
+            let d = snap(min(rect.width * 0.62, xHeight * 1.15))
+            ctx.fillEllipse(in: CGRect(x: rect.midX - d / 2, y: baseline - xHeight / 2 - d / 2, width: d, height: d))
+        } else if v >= 0x2580 {
+            block(v, rect, ctx, snap)
+        } else {
+            box(v, rect, ctx, snap, scale)
+        }
+    }
+
+    // MARK: Block elements
+
+    private static func block(_ v: UInt32, _ r: CGRect, _ ctx: CGContext, _ snap: (CGFloat) -> CGFloat) {
+        func fill(_ x0: CGFloat, _ y0: CGFloat, _ x1: CGFloat, _ y1: CGFloat) {
+            let a = snap(r.minX + r.width * x0), b = snap(r.minY + r.height * y0)
+            ctx.fill(CGRect(x: a, y: b, width: snap(r.minX + r.width * x1) - a, height: snap(r.minY + r.height * y1) - b))
+        }
+        switch v {
+        case 0x2580: fill(0, 0, 1, 0.5)
+        case 0x2581...0x2588: fill(0, 1 - CGFloat(v - 0x2580) / 8, 1, 1)
+        case 0x2589...0x258F: fill(0, 0, CGFloat(0x2590 - v) / 8, 1)
+        case 0x2590: fill(0.5, 0, 1, 1)
+        case 0x2591...0x2593:
+            ctx.setAlpha(CGFloat(v - 0x2590) / 4)
+            fill(0, 0, 1, 1)
+        case 0x2594: fill(0, 0, 1, 1.0 / 8)
+        case 0x2595: fill(7.0 / 8, 0, 1, 1)
+        default:
+            // Quadrants: upper left, upper right, lower left, lower right.
+            let masks: [UInt32: Int] = [0x2596: 4, 0x2597: 8, 0x2598: 1, 0x2599: 13, 0x259A: 9, 0x259B: 7, 0x259C: 11, 0x259D: 2, 0x259E: 6, 0x259F: 14]
+            let mask = masks[v] ?? 0
+            if mask & 1 != 0 { fill(0, 0, 0.5, 0.5) }
+            if mask & 2 != 0 { fill(0.5, 0, 1, 0.5) }
+            if mask & 4 != 0 { fill(0, 0.5, 0.5, 1) }
+            if mask & 8 != 0 { fill(0.5, 0.5, 1, 1) }
+        }
+    }
+
+    // MARK: Box drawing
+
+    /// Per code point from U+2500: the left, up, right and down arms —
+    /// 0 none, 1 light, 2 heavy, 3 double. `.` marks the arcs and diagonals.
+    private static let arms: [String] = [
+        "1010", "2020", "0101", "0202", "1010", "2020", "0101", "0202", // ─━│┃┄┅┆┇
+        "1010", "2020", "0101", "0202", "0011", "0021", "0012", "0022", // ┈┉┊┋┌┍┎┏
+        "1001", "2001", "1002", "2002", "0110", "0120", "0210", "0220", // ┐┑┒┓└┕┖┗
+        "1100", "2100", "1200", "2200", "0111", "0121", "0211", "0112", // ┘┙┚┛├┝┞┟
+        "0212", "0221", "0122", "0222", "1101", "2101", "1201", "1102", // ┠┡┢┣┤┥┦┧
+        "1202", "2201", "2102", "2202", "1011", "2011", "1021", "2021", // ┨┩┪┫┬┭┮┯
+        "1012", "2012", "1022", "2022", "1110", "2110", "1120", "2120", // ┰┱┲┳┴┵┶┷
+        "1210", "2210", "1220", "2220", "1111", "2111", "1121", "2121", // ┸┹┺┻┼┽┾┿
+        "1211", "1112", "1212", "2211", "1221", "2112", "1122", "2221", // ╀╁╂╃╄╅╆╇
+        "2122", "2212", "1222", "2222", "1010", "2020", "0101", "0202", // ╈╉╊╋╌╍╎╏
+        "3030", "0303", "0031", "0013", "0033", "3001", "1003", "3003", // ═║╒╓╔╕╖╗
+        "0130", "0310", "0330", "3100", "1300", "3300", "0131", "0313", // ╘╙╚╛╜╝╞╟
+        "0333", "3101", "1303", "3303", "3031", "1013", "3033", "3130", // ╠╡╢╣╤╥╦╧
+        "1310", "3330", "3131", "1313", "3333", ".", ".", ".",          // ╨╩╪╫╬╭╮╯
+        ".", ".", ".", ".", "1000", "0100", "0010", "0001",             // ╰╱╲╳╴╵╶╷
+        "2000", "0200", "0020", "0002", "1020", "0102", "2010", "0201", // ╸╹╺╻╼╽╾╿
+    ]
+
+    private static func box(_ v: UInt32, _ r: CGRect, _ ctx: CGContext, _ snap: (CGFloat) -> CGFloat, _ scale: CGFloat) {
+        let light = max(1 / scale, snap(r.width / 9))
+        let heavy = max(2 / scale, snap(light * 2))
+        let gap = max(1 / scale, light)
+        let cx = snap(r.midX 
```

**File**: `apps/ios/Zeron/Companions/TerminalView.swift` (modified, +34/-1)
```diff
@@ -546,6 +546,12 @@ final class TerminalCanvas: UIView {
         )
     }
 
+    /// The scalar `TerminalGlyphs` paints for `ch`, if it does.
+    private static func drawn(_ ch: Character) -> Unicode.Scalar? {
+        guard ch.unicodeScalars.count == 1, let scalar = ch.unicodeScalars.first, TerminalGlyphs.draws(scalar) else { return nil }
+        return scalar
+    }
+
     override func draw(_ rect: CGRect) {
         guard let frame = frameModel, let ctx = UIGraphicsGetCurrentContext() else { return }
         let m = metrics
@@ -571,6 +577,25 @@ final class TerminalCanvas: UIView {
                 }
             }
         }
+        // Box drawing, blocks and the bullet: painted into their cells.
+        let scale = traitCollection.displayScale
+        let xHeight = CTFontGetXHeight(m.regular)
+        for (r, line) in rows {
+            let y = inset.top + CGFloat(r) * m.lineHeight + dy
+            guard y < rect.maxY, y + m.lineHeight > rect.minY else { continue }
+            for run in line.runs where !run.text.allSatisfy(\.isASCII) {
+                let color = run.fg == 0 ? fg : Self.color(run.fg)
+                let span = (run.wide ? 2 : 1) * m.cellWidth
+                var x = inset.left + CGFloat(run.col) * m.cellWidth
+                for ch in run.text {
+                    if let scalar = Self.drawn(ch) {
+                        let cell = CGRect(x: x, y: y, width: span, height: m.lineHeight)
+                        TerminalGlyphs.draw(scalar, in: cell, baseline: y + m.ascent, xHeight: xHeight, color: color, ctx: ctx, scale: scale)
+                    }
+                    x += span
+                }
+            }
+        }
         ctx.textMatrix = .identity
         ctx.translateBy(x: 0, y: bounds.height)
         ctx.scaleBy(x: 1, y: -1)
@@ -600,7 +625,15 @@ final class TerminalCanvas: UIView {
                     var col = x
                     for ch in run.text {
                         let span = (run.wide ? 2 : 1) * m.cellWidth
-                        let line = CTLineCreateWithAttributedString(NSAttributedString(string: String(ch), attributes: attrs))
+                        if Self.drawn(ch) != nil {
+                            col += span
+                            continue
+                        }
+                        // A one-cell symbol that also has an emoji form (`⏵`,
+                        // `☐`): ask for the text glyph, not the color emoji.
+                        let emojiCapable = ch.unicodeScalars.count == 1 && ch.unicodeScalars.first!.properties.isEmoji
+                        let glyph = !run.wide && emojiCapable ? "\(ch)\u{FE0E}" : String(ch)
+                        let line = CTLineCreateWithAttributedString(NSAttributedString(string: glyph, attributes: attrs))
                         let width = CGFloat(CTLineGetTypographicBounds(line, nil, nil, nil))
                         ctx.textPosition = CGPoint(x: col + max(0, (span - width) / 2), y: baseline)
                         CTLineDraw(line, ctx)
```

---

### Incident Patch 3: `5b8edb2d` (2026-10-23)
**Commit Message**: iOS: don't crash Providers when there's no device to pick (#980)

A new account with no paired computer and no Cloud offer has an empty
device menu. UIKit aborts on a .popUpMenu with nothing to select
("Menu does not have a valid element for default selection"), and
onboarding reopens Providers on launch, so the app crashed every time
it opened. Skip the pop-up accessory when the menu is empty.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/ios/Zeron/Cloud/ProvidersViewController.swift` (modified, +6/-1)
```diff
@@ -115,7 +115,12 @@ final class ProvidersViewController: UIViewController, UICollectionViewDelegate
             cell.backgroundConfiguration = bg
             var accessories: [UICellAccessory] = []
             if row.id == "device" {
-                accessories.append(.popUpMenu(self.deviceMenu(), displayed: .always, options: .init(tintColor: Palette.text)))
+                // UIKit aborts on a pop-up menu with nothing to select: a new
+                // account with no computer and no Cloud offer has no devices.
+                let menu = self.deviceMenu()
+                if !menu.children.isEmpty {
+                    accessories.append(.popUpMenu(menu, displayed: .always, options: .init(tintColor: Palette.text)))
+                }
                 let name = UILabel()
                 name.text = self.targetName
                 name.font = Fonts.ui(.sansMedium, 15)
```

#### Recent Merged Pull Requests:
- **PR #1034** (2026-10-25): Transcript rail: ten ticks at most; hovering opens the prompt list (@zeronsh[bot])
- **PR #1032** (2026-10-25): Releases: serve the Android APK's stable name uncached; name each build uniquely (@zeronsh[bot])
- **PR #1031** (2026-10-25): Syntax: Luau highlighting (@zeronsh[bot])
- **PR #1030** (2026-10-25): Bump version to v0.2.123 (@zeronsh[bot])
- **PR #1029** (2026-10-25): Android: Gmail-style Sessions page; the transcript fades behind the composer (@zeronsh[bot])
- **PR #1028** (2026-10-25): Session card: snap on chat switch instead of fading over the next chat (@alexandre-vl)

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

## X. Harden every provider: crash and stall detection, Windows-safe launching, and ru

**RULE**:
When implementing operations in `.github/workflows/windows.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zeronsh/zeron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2e151ca6`: Harden every provider: crash and stall detection, Windows-safe launching, and run recovery (#977). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/windows.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      # The driver suites whose fixtures run without a POSIX shell: an in-test
      # HTTP/SSE server (OpenCode), node (the Cursor shim) and a Rust peer
      # (Pi). The shell- and python-fixture suites are unix-only.
      - name: Portable harness integration tests
        run: cargo test --release --locked -p zeron-harness --features native-fixture --test opencode --test cursor_shim --test pi_rpc
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2e151ca6` are properly handled with clean fallback behavior.
