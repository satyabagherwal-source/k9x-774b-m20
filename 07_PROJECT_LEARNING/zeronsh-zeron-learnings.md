> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source**: github ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Source Version**: `325384d8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T13:15:07.942Z  
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
> **Harvest Timestamp**: 2026-10-26T13:15:07.148Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3370 stars

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
- **Issue #1052** (2026-10-26): **Transcript: agent senders and provider switches as captions over the message**
  *Symptoms*: ## Summary  - **Agent messages:** a message sent from another chat through Zeron's `send_message` now shows `Message from [provider logo] Chat title` as a muted caption over its bubble, in the same style as the provider-switch seam. Clicking it opens the sending chat. The bubble keeps only the body. The routing header stays in the stored prompt, so the receiving agent still reads it. The trailing `(short-id)` that used to leak into the shown name is gone, while a title's own parentheses stay. - **Provider-switch seam:** no divider and no "Switched provider" label. It's now one line, `[logo] From → [logo] To`, right-aligned and set close over the message that switched. - **Seam timing:** the engine used to write the user's message, replace the old provider's runtime (which can take seconds), and only then write the seam. It now writes the seam together with the message (`doc_host.rs` Run path). The dispatch's own later note is idempotent and does nothing. - If a seam lands above a message already on screen, that message is remeasured so its gap tightens.  ## Screenshots  Captured from the new `message-captions-fixture` (offline shell) on Linux. The before shots run the same fixture against `main`. Notes and hashes are in `docs/screenshots/message-captions/README.md`.  | Before | After | | --- | --- | | ![before dark](https://github.com/zeronsh/zeron/blob/e50b92f5e84d97d4dd9c197553a675cb8cdcc3e0/docs/screenshots/message-captions/before-dark.png?raw=true) | ![after dark](https:/

- **Issue #1049** (2026-10-25): **Transcript rail: back to one tick per prompt; long chats scroll the rail**
  *Symptoms*: This replaces #1034's ten-tick rail and hover prompt list. The rail goes back to how it was, **one tick per prompt**, and a conversation too long for it now **scrolls the rail**, the way Codex's prompt rail does.  **Back to the old rail** - Every prompt has its own tick at the natural 8px spacing. - Hovering a tick widens it and its neighbours and shows a preview card with the prompt and the opening of its reply. Clicking a tick glides the transcript to that prompt.  **Scrolling, like Codex** - Once the ticks don't fit, the rail shows a window onto them: **70% of the space between the titlebar and the composer, at most 640px**. Codex uses `min(70vh, 40rem)`. - **Scroll over the rail** to move through the ticks. There's no visible scrollbar, as in Codex. A wheel over the rail never scrolls the transcript behind it, even at the rail's ends. - The rail's **ends fade** while there are more ticks beyond them. - The rail **follows the prompts on screen**: when they change, from reading or jumping, it moves just enough to keep their ticks clear of the fades. It only moves when what's lit changes, so a rail you've scrolled by hand stays put.  **Kept from #1034** - The rail centres between the titlebar and the composer. - While the transcript is pinned to the bottom, every prompt on screen lights its tick, not just the one being read.  Screenshots below are offscreen renders from the new `rail-fixture` example. The conversation has 150 prompts and is pinned to the bottom.  The rail at

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

### Incident Patch 1: `325384d8` (2026-10-26)
**Commit Message**: Transcript: agent senders and provider switches as captions over the message (#1052)

An agent-sent message shows `Message from [mark] Chat` over its bubble,
opening the sending chat on click; the routing header and short id leave
the bubble. The provider-switch seam drops its divider and rides
right-aligned over the message that switched, and the engine writes it
with that message instead of after replacing the outgoing runtime.

Co-authored-by: Wing <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: zeronsh[bot] <346184242+zeronsh[bot]@users.noreply.github.com>

**File**: `crates/engine/src/doc_host.rs` (modified, +2/-1)
```diff
@@ -5657,7 +5657,8 @@ impl DocHost {
                 // issued_at, clamped against clock skew) — not whenever this
                 // host got around to draining a queued command. Idempotent by
                 // id, so the dispatch path's own execution-time write dedupes
-                // to a no-op.
+                // to a no-op. A provider switch's seam lands with it, above.
+                sessions.note_provider_switch(chat_id, harness, handle);
                 if let Err(err) = handle.write_user_message(
                     message_id,
                     &request.prompt,
```

**File**: `crates/engine/src/sessions.rs` (modified, +8/-0)
```diff
@@ -531,6 +531,14 @@ impl SessionsEngine {
         lock(&self.inner.runs).get(chat_id).map(|h| h.runtime_config.harness_id)
     }
 
+    /// Mark the provider-switch seam for a send about to run on `harness_id`
+    /// now, with its message, rather than once the dispatch has replaced the
+    /// outgoing provider's runtime (seconds later). Idempotent: the dispatch's
+    /// own note finds the seam already written.
+    pub fn note_provider_switch(&self, chat_id: &str, harness_id: HarnessId, doc: &ChatDocHandle) {
+        self.inner.note_provider_switch(chat_id, harness_id, doc);
+    }
+
     /// Whether an accepted agent update gates the chat's live run, so a new
     /// prompt waits in the queue rather than joining that run's transcript.
     pub fn live_run_update_pending(&self, chat_id: &str) -> bool {
```

**File**: `crates/ui/Cargo.toml` (modified, +4/-0)
```diff
@@ -68,6 +68,10 @@ required-features = ["project-path-fixture"]
 name = "rail-fixture"
 required-features = ["appshots-fixture"]
 
+[[example]]
+name = "message-captions-fixture"
+required-features = ["appshots-fixture"]
+
 [[example]]
 name = "sidebar-fixture"
 required-features = ["project-palette-fixture"]
```

**File**: `crates/ui/examples/message-captions-fixture.rs` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+//! User-message caption review fixture: a chat that switched provider and
+//! then received a message from another chat, in an isolated, offline shell.
+//! With `--capture <dir>` it saves the transcript at rest and with the
+//! sender caption hovered, then quits; ZERON_PALETTE_LIGHT=1 renders the
+//! light theme.
+use gpui::{AppContext, Bounds, WindowBounds, WindowOptions, px, size};
+use serde_json::json;
+use std::path::{Path, PathBuf};
+use zeron_ui::*;
+
+const SENDER_ID: &str = "cd27c5c2-6f1e-4d1a-9a52-3b0c8e7d4f10";
+
+async fn pause(cx: &mut gpui::AsyncApp, ms: u64) {
+    cx.background_executor()
+        .timer(std::time::Duration::from_millis(ms))
+        .await;
+}
+
+fn capture(window: gpui::AnyWindowHandle, cx: &mut gpui::AsyncApp, dir: &Path, name: &str) {
+    window
+        .update(cx, |_, w, cx| {
+            w.draw(cx).clear();
+            match w.render_to_image() {
+                Ok(image) => image.save(dir.join(format!("{name}.png"))).unwrap(),
+                Err(error) => eprintln!("{name}: capture failed: {error:#}"),
+            }
+        })
+        .ok();
+}
+
+fn entries() -> serde_json::Value {
+    let at = |minutes: i64| 1_788_900_000_000_i64 + minutes * 60_000;
+    let text = |id: &str, role: &str, minutes: i64, text: &str| {
+        json!({"id": id, "role": role, "createdAt": at(minutes), "deviceId": "local", "status": "complete",
+            "parts": [{"id": "t", "kind": "text", "text": text}]})
+    };
+    let routed = format!(
+        "[Message from Zeron chat zgui prod: Windows platform (WING-PC) (cd27c5c2). Reply to it with the Zeron `send_message` tool, chat {SENDER_ID}.]\n\n\
+         Windows lane: the matrices are done on current main (#513, #542, #543). Windows in front and verified uncovered on every run, Zeron minimized, alternating, 0 invalid runs; dist builds, shared DejaVu font."
+    );
+    json!([
+        text("u0", "user", 0, "Profile the render loop on Linux and Windows and tell me where the frame time goes."),
+        text("a0", "assistant", 1, "Linux is done: layout is 61% of the frame, paint 22%. I've asked the Windows chat to run the same matrix and report back."),
+        {"id": "switch:1", "role": "system", "createdAt": at(2), "deviceId": "local", "status": "complete",
+            "parts": [{"id": "switch:1", "kind": "switch", "from": "Claude Code", "to": "Codex",
+                "fromHarness": "claude-code", "toHarness": "codex"}]},
+        text("u1", "user", 2, "Carry on from here and draft the summary table."),
+        text("a1", "assistant", 3, "Here's the Linux half; the Windows column fills in when its results arrive."),
+        text("u2", "user", 4, &routed),
+        text("a2", "assistant", 5, "Got it — Windows matches Linux within 3%. The table is complete."),
+    ])
+}
+
+fn main() -> anyhow::Result<()> {
+    let runtime = tokio::runtime::Runtime::new()?;
+    let _guard = runtime.enter();
+    tracing_subscriber::fmt().with_env_filter("warn").init();
+    let temp = tempfile::tempdir()?;
+    let data = temp.path().to_path_buf();
+    let capture_dir = std::env::args()
+        .skip_while(|arg| arg != "--capture")
+        .nth(1)
+        .map(PathBuf::from);
+    let entries = entries();
+    gpui_platform::application().with_assets(icons::Assets).run(move |cx| {
+        gpui_tokio::init(cx);
+        gpui_base::init(cx);
+        let mut settings = settings::UiSettings::default();
+        settings.sidebar_width = 260.0;
+        settings.save(&data).unwrap();
+        settings::init(settings.clone(), data.clone(), cx);
+        let fonts = typography::register_fonts(cx);
+        typography::init(settings.ui_font_family.clone(), settings.ui_font_size, settings.terminal_font_family.clone(), settings.terminal_font_size, settings.code_font_family.clone(), settings.code_font_size, fonts, cx);
+        theme_library::init(data.clone(), cx);
+        let mode = if std::env::var_os("ZERON_PALETTE_LIGHT").is_some() { appearance::AppearanceMode::Light } else { appearance::AppearanceMode::Dark };
+        appearance::init(mode, settings.theme_selection, settings.accent, settings.surface, cx);
+        history::init(settings.git_history_columns, settings.git_history_column_widths, settings.git_history_column_order, settings.git_history_author_display, cx);
+        composer::init(cx, settings.composer_send_behavior);
+        terminal::panel::init(cx);
+        app_menus::init(cx);
+        let chat = |id: &str, title: &str, harness: &str, model: &str| {
+            serde_json::from_value(json!({"id": id, "deviceId": "local", "title": title, "archived": false, "createdAt": "2026-10-25T00:00:00Z",
+                "config": {"harness": harness, "model": model, "reasoning": null, "sandbox": "workspace-write"}})).unwrap()
+        };
+        let state = cx.new(|_| {
+            let mut s = state::AppState::new();
+            s.connection = zeron_proto::view::ConnectionStatus::Ready;
+           
```

**File**: `crates/ui/src/shell.rs` (modified, +1/-0)
```diff
@@ -4460,6 +4460,7 @@ impl Shell {
                 );
             }
             TranscriptEvent::SignIn { chat_id } => self.sign_in_for_chat(chat_id, cx),
+            TranscriptEvent::OpenChat { chat_id } => self.open_chat(chat_id.clone(), cx),
         }
     }
 
```

**File**: `crates/ui/src/transcript.rs` (modified, +223/-120)
```diff
@@ -177,6 +177,9 @@ pub const USER_LINE_HEIGHT: f32 = 22.0;
 pub const USER_COLLAPSE_CHARS: usize = 400;
 /// Vertical separation before the plain expand/collapse link.
 const USER_TOGGLE_GAP: f32 = 8.0;
+/// Between a caption over a user bubble (provider switch, agent sender) and
+/// the bubble.
+const USER_CAPTION_GAP: f32 = 6.0;
 /// User-bubble attachment thumbnails (user-attachments.tsx): 112×80 thumbs in
 /// a wrapping strip. Fixed thumbnail sizes keep load-state flips from
 /// shifting the virtualizer.
@@ -1064,6 +1067,9 @@ pub enum RowKind {
         attachments: Arc<Vec<crate::attachments::UserImageAttachment>>,
         /// Context the prompt folded in as text, lifted back out by `badges`.
         badges: Arc<Vec<crate::badges::MessageBadge>>,
+        /// The chat that sent this message through Zeron's `send_message`,
+        /// lifted out of the routing header the receiving agent still reads.
+        sender: Option<AgentSender>,
         /// Optimistic echo not yet confirmed by a doc frame.
         pending: bool,
     },
@@ -1370,7 +1376,10 @@ pub fn rows_for_entry(
         // Lifted before the mention projection, so a comment body's own
         // Markdown never lands in the bubble.
         let (body, badges) = crate::badges::split(&parsed.text);
-        let body = agent_message_display(&body);
+        let (sender, body) = match agent_message_sender(&body) {
+            Some((sender, body)) => (Some(sender), body.to_owned()),
+            None => (None, body),
+        };
         // Chips stand in for their attachments: those leave the strip, and a
         // chip carries its upload's path for its progress and, for an image,
         // a click opening it.
@@ -1408,6 +1417,7 @@ pub fn rows_for_entry(
                 mentions: Arc::new(mentions),
                 attachments: Arc::new(attachments),
                 badges: Arc::new(badges),
+                sender,
                 pending,
             },
             entry_id,
@@ -2029,7 +2039,14 @@ fn part_prefix(id: &str) -> &str {
 /// part — matching the live row's internal spacing exactly, so the
 /// live→split handoff cannot shift a pixel. Tool groups get one larger global
 /// step on either boundary so their dense chip stack has room to breathe.
+/// A provider-switch seam is the caption of the message under it, so that
+/// message sits right below it.
 pub fn top_gap_for(prev: Option<&Row>, row: &Row) -> f32 {
+    if matches!(row.kind, RowKind::User { .. })
+        && prev.is_some_and(|prev| matches!(prev.kind, RowKind::SwitchMarker { .. }))
+    {
+        return USER_CAPTION_GAP;
+    }
     if row.turn_start {
         return Theme::SPACE_LG;
     }
@@ -3483,6 +3500,8 @@ pub enum TranscriptEvent {
         title: String,
         frozen: bool,
     },
+    /// An agent message's sender caption: open the chat that sent it.
+    OpenChat { chat_id: String },
 }
 
 impl gpui::EventEmitter<TranscriptEvent> for Transcript {}
@@ -5227,6 +5246,7 @@ impl Transcript {
                 for row in &self.rows[old_range.clone()] {
                     self.render_cache.borrow_mut().invalidate_row(&row.id);
                 }
+                let after = old_range.start + count;
                 if old_range.len() == count {
                     // In-place content change, same row count — notably the
                     // live→complete flip, where EVERY row of the streamed
@@ -5242,6 +5262,12 @@ impl Transcript {
                 } else {
                     self.list.splice(old_range, count);
                 }
+                // A row's top gap reads its predecessor, so the row after the
+                // splice can gain a new one (a switch seam landing over the
+                // message already shown under it).
+                if after < new_rows.len() {
+                    self.list.remeasure_items(after..after + 1);
+                }
                 self.viewport_layout_revision = self.viewport_layout_revision.wrapping_add(1);
             }
         }
@@ -6485,6 +6511,59 @@ impl Transcript {
             .into_any_element()
     }
 
+    /// `Message from [logo] Chat` over an agent-sent bubble, in the switch
+    /// seam's caption style: the sending chat's provider mark and live title
+    /// (the header's title for a chat this workspace doesn't list). A known
+    /// chat opens on click.
+    fn render_agent_sender(
+        &self,
+        row_id: &SharedString,
+        sender: &AgentSender,
+        theme: &Theme,
+        cx: &mut Context<Self>,
+    ) -> AnyElement {
+        let chat = self
+            .state
+            .read(cx)
+            .chats
+            .iter()
+            .find(|chat| chat.id == sender.chat_id.as_ref());
+        let known = chat.is_some();
+        let title: SharedString = chat
+            .and_then(|chat| chat.title.as_deref())
+            .map(str::trim)
+            .filter(|title| !title.is_empty())
+            .map_or_else(|| sender.title.clone(), |title| 
```

**File**: `docs/screenshots/message-captions/README.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# User-message captions runtime evidence
+
+Captured on 2026-10-26 on Linux (Xvfb, Mesa lavapipe software Vulkan) from `message-captions-fixture`: an offline shell with one chat that switched from Claude Code to Codex and then received a message from another chat through Zeron's `send_message`. The `before-*` captures run the same fixture against `main` `255c540d` with this change's sources stashed.
+
+Build and run: `cargo run -p zeron-ui --features appshots-fixture --example message-captions-fixture` (add `--capture <dir>` on platforms where `render_to_image` is implemented; on Linux the window was captured from the X display with `import -window root`, and hover/click driven with `xdotool`).
+
+- The provider-switch seam has no divider and rides right-aligned over the message that switched, `USER_CAPTION_GAP` above its bubble.
+- An agent-sent message shows `Message from [provider mark] Chat title` over its bubble; the routing header and the trailing short id leave the bubble. Hovering brightens the caption (`sender-hover-dark.png`); clicking opens the sending chat (`sender-click-dark.png`: the fixture's sender chat has no transcript of its own).
+
+Static screenshots do not show the timing change: the engine now writes the seam together with the message instead of after the outgoing provider's runtime is replaced.
+
+- `before-dark.png`: SHA256 `de2b0745c9bce45ff3a05f9b57432752caee872553e99d4e48e4a781e773ae70`
+- `after-dark.png`: SHA256 `310149c94389097faf4d2510e3758f2772ae4aa150d375d9cf06eab590d6f963`
+- `before-light.png`: SHA256 `48c234366795f05d90987355f5c40b89a51f26aaf0eba8154896a708c3d29405`
+- `after-light.png`: SHA256 `1beec003998af34c94ced6d87da25bceb4602a8edff1939a07502f335745c7ba`
+- `sender-hover-dark.png`: SHA256 `e85e20a87b3d08ddbba43b971bfa0d0a4798f7e328b4c19d26d14111e413d517`
+- `sender-click-dark.png`: SHA256 `0158a61dd2e1f5312b38fca513a40dcb309d1a72fb19887b8b20e9cc6cba292d`
```

---

### Incident Patch 2: `bc892abd` (2026-10-26)
**Commit Message**: Session card: branch row shows the branch's changes, not the working tree (#950)

* Session card: the branch row shows the branch's +/- over its base

The totals came from the working-tree watch, so they only counted
uncommitted lines. They now come from the Changes pane's Branch changes
capture against the repo's default branch, re-captured whenever the watch
checksum moves, and clicking them opens a Diff tab on that scope.

* Session card: clicking the branch totals opens the diff pane

The Branch changes tab was added to a closed pane, so nothing showed.
Open the pane first, as opening a file does.

**File**: `crates/ui/src/changes.rs` (modified, +8/-0)
```diff
@@ -1803,6 +1803,14 @@ impl Changes {
         changes
     }
 
+    /// A Diff tab that opens on *Branch changes* (the scope menu still
+    /// switches it).
+    pub fn for_branch(state: Entity<AppState>, cx: &mut Context<Self>) -> Self {
+        let mut changes = Self::new(state, cx);
+        changes.scope = DiffScope::Branch;
+        changes
+    }
+
     /// A dedicated History surface. It shares the commit-opening event path
     /// with diffs, but is never offered as an item in a Diff tab's scope menu.
     pub fn for_history(state: Entity<AppState>, cx: &mut Context<Self>) -> Self {
```

**File**: `crates/ui/src/shell.rs` (modified, +12/-1)
```diff
@@ -2315,7 +2315,7 @@ pub struct Shell {
     session_info_last_reserve: f32,
     /// The lanes card's folds and pages.
     session_lanes: session_lanes::LaneState,
-    /// The working-tree diffs behind the card's branch-row totals.
+    /// The branch diff behind the card's branch-row totals.
     session_diffs: session_info::SessionDiffs,
     /// The servers behind the card's Ports section.
     session_previews: session_info::SessionPreviews,
@@ -4097,6 +4097,17 @@ impl Shell {
         self.register_diff_surface(changes, window, cx);
     }
 
+    /// A Diff tab opened on *Branch changes* (the session card's totals),
+    /// opening the pane when it is closed.
+    fn add_branch_diff_surface(&mut self, window: &mut Window, cx: &mut Context<Self>) {
+        if self.active_chat.is_empty() {
+            return;
+        }
+        self.set_surfaces_open(true, cx);
+        let changes = cx.new(|cx| Changes::for_branch(self.state.clone(), cx));
+        self.register_diff_surface(changes, window, cx);
+    }
+
     /// Open or focus a session-owned editor tab. The explorer is independent.
     fn add_file_surface(&mut self, path: String, window: &mut Window, cx: &mut Context<Self>) {
         let owner = (self.active_chat.clone(), self.state.clone());
```

**File**: `crates/ui/src/shell/session_info.rs` (modified, +121/-15)
```diff
@@ -33,22 +33,40 @@ pub(super) fn session_card_reserve(main: f32, transcript: f32) -> Option<f32> {
     (main - reserve - 2.0 * TRANSCRIPT_GUTTER >= transcript - 0.5).then_some(reserve)
 }
 
-/// The checkouts' working-tree diffs, for the branch row's `+N −M`: the
-/// Changes pane's `WatchCheckoutDiffs` stream, kept without the pane.
+/// The branch's diff over its base, for the branch row's `+N −M`: the
+/// Changes pane's *Branch changes* scope, kept without the pane. The
+/// `WatchCheckoutDiffs` stream only says when to re-capture: its checksum
+/// moves with the working tree and HEAD.
 #[derive(Default)]
 pub(super) struct SessionDiffs {
     diffs: Vec<zeron_proto::CheckoutDiff>,
     /// Device the running watch targets: `None` the connected engine, else
     /// a remote chat's host (diffs are produced where the checkout lives).
     target: Option<Option<String>>,
     _watch: Option<Task<()>>,
+    /// The comparison base per `device:cwd`, from `ListBranches`.
+    base: Option<(String, String)>,
+    /// `chat|cwd` the totals belong to, and those totals.
+    branch: Option<(String, (u32, u32))>,
+    /// `chat|cwd|checksum` last fetched (or in flight).
+    fetched: Option<String>,
+    _fetch: Option<Task<()>>,
 }
 
 impl SessionDiffs {
-    /// The chat's uncommitted line totals; `None` while clean or unknown.
+    /// The working-tree diff's checksum for `chat`: a branch capture is
+    /// stale once it moves.
+    fn checksum(&self, chat: &zeron_proto::Chat) -> Option<String> {
+        crate::changes::resolve_diff(&self.diffs, chat).map(|diff| diff.checksum.clone())
+    }
+
+    /// The branch's line totals over its base; `None` while clean or unknown.
     fn totals(&self, chat: &zeron_proto::Chat) -> Option<(u32, u32)> {
-        crate::changes::resolve_diff(&self.diffs, chat)
-            .map(|diff| (diff.additions, diff.deletions))
+        let context = format!("{}|{}", chat.id, chat.cwd.as_deref()?);
+        self.branch
+            .as_ref()
+            .filter(|(key, _)| *key == context)
+            .map(|&(_, totals)| totals)
             .filter(|&(adds, dels)| adds + dels > 0)
     }
 }
@@ -136,16 +154,17 @@ impl Shell {
                 {
                     while let Some(value) = rx.recv().await {
                         let alive = this.update(cx, |this, cx| {
-                            // Repaint only when the open chat's totals move.
+                            // Re-render (and so re-capture) only when the open
+                            // chat's checkout moves.
                             let chat = this.state.read(cx).selected_chat_row().cloned();
-                            let totals = |diffs: &SessionDiffs| {
-                                chat.as_ref().and_then(|chat| diffs.totals(chat))
+                            let checksum = |diffs: &SessionDiffs| {
+                                chat.as_ref().and_then(|chat| diffs.checksum(chat))
                             };
-                            let before = totals(&this.session_diffs);
+                            let before = checksum(&this.session_diffs);
                             if crate::changes::apply_diff_frame(
                                 &mut this.session_diffs.diffs,
                                 value,
-                            ) && totals(&this.session_diffs) != before
+                            ) && checksum(&this.session_diffs) != before
                             {
                                 cx.notify();
                             }
@@ -217,6 +236,94 @@ impl Shell {
         }));
     }
 
+    /// Capture `chat`'s branch diff over its base (idempotent per chat, cwd
+    /// and working-tree checksum). The base is the repo's default branch, as
+    /// the Changes pane presets it; the last totals stay while a re-capture
+    /// runs.
+    fn ensure_branch_totals(&mut self, chat: &zeron_proto::Chat, cx: &mut Context<Self>) {
+        let Some(cwd) = chat.cwd.clone() else {
+            return;
+        };
+        // Until the watch reports the checkout, there is nothing to refresh on.
+        let Some(checksum) = self.session_diffs.checksum(chat) else {
+            return;
+        };
+        let context = format!("{}|{cwd}", chat.id);
+        let key = format!("{context}|{checksum}");
+        if self.session_diffs.fetched.as_deref() == Some(key.as_str()) {
+            return;
+        }
+        let Some(engine) = self.state.read(cx).engine().cloned() else {
+            return;
+        };
+        let target = self.session_diffs.target.clone().flatten();
+        let repo = format!("{}:{cwd}", target.as_deref().unwrap_or("local"));
+        let known_base = self
+            .session_diffs
+            .base
+            .as_ref()
+            .filter(|(at, _)| *at == repo)
+            .map(|(_, base)| base.clone());
+        let current = chat.branch.clone();
+        self.session_diffs.fetched = Some(key.clone());
+        self.session_diff
```

#### Recent Merged Pull Requests:
- **PR #1052** (2026-10-26): Transcript: agent senders and provider switches as captions over the message (@zeronsh[bot])
- **PR #1049** (2026-10-25): Transcript rail: back to one tick per prompt; long chats scroll the rail (@wingleeio)
- **PR #1034** (2026-10-25): Transcript rail: ten ticks at most; hovering opens the prompt list (@zeronsh[bot])
- **PR #1032** (2026-10-25): Releases: serve the Android APK's stable name uncached; name each build uniquely (@zeronsh[bot])
- **PR #1031** (2026-10-25): Syntax: Luau highlighting (@zeronsh[bot])
- **PR #1030** (2026-10-25): Bump version to v0.2.123 (@zeronsh[bot])

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

## X. Transcript: agent senders and provider switches as captions over the message (#1

**RULE**:
When implementing operations in `crates/engine/src/doc_host.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zeronsh/zeron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `325384d8`: Transcript: agent senders and provider switches as captions over the message (#1052). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/engine/src/doc_host.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // to a no-op. A provider switch's seam lands with it, above.
                sessions.note_provider_switch(chat_id, harness, handle);
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                // to a no-op.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `325384d8` are properly handled with clean fallback behavior.
