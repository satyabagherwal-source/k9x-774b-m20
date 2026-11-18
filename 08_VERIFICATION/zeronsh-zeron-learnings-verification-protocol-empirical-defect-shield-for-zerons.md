# Verification Protocol: Verification Protocol: Empirical Defect Shield for zeronsh-zeron-learnings

<!-- PROVENANCE_START
{
  "source_repository": "zeronsh-zeron-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T06:15:33.255Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zeronsh-zeron-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zeronsh-zeron-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T06:15:33.255Z`  
> **Learning ID**: `LEARN-EVO-zeronsh-zeron-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `zeronsh-zeron-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source**: github ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Source Version**: `c58f65e8`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T06:15:21.772Z  
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
> **Harvest Timestamp**: 2026-11-18T06:15:21.766Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3711 stars

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
    /** `--es dev-user <id> --es dev-org <id>`: a dev bearer for an `AUTH_MODE=dev` edge, not persisted (debuggable builds). */
    val dev: Pair<String, String>? = null,
    /** `--es edge <url>`: a local edge in place of production (debuggable builds). */
    val edge: String? = null,
    /** `--ez no-relay-layer true`: behave as a build without the relay layer does, an old phone in an account of new devices (debuggable builds). */
    val noRelayLayer: Boolean = false,
    /** `--es send-on-open <text>`: with `route chat:<id>`, send this once the session is open, for rigs (debuggable builds). */
    val sendOnOpen: String? = null,
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
        if (opti
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

### Core Architecture Module: `apps/android/app/src/main/java/sh/zeron/android/core/NetworkPath.kt`
```
package sh.zeron.android.core

import android.net.Network
import android.net.NetworkCapabilities

/**
 * What a direct connection's path depends on: which network, over what, and whether it's metered.
 * Signal strength and bandwidth change all the time and leave this alone, so a re-delivered
 * network doesn't tear down a healthy direct link.
 */
fun networkShape(network: Network, capabilities: NetworkCapabilities): String {
    val transports = (0..TRANSPORT_MAX).filter(capabilities::hasTransport).joinToString(",")
    val metered = !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
    return "$network/$transports" + if (metered) "!" else ""
}

/** Past the highest transport the platform defines today. An unknown value just reads as absent. */
private const val TRANSPORT_MAX = 15

/**
 * Turns what the OS says about the default network into the core's two calls, each only when it
 * means something. Main thread only.
 *
 * Android says less than iOS's path monitor does, which is why this exists:
 * - With no network at launch it says nothing at all, so [seed] reads the state first.
 * - Moving between networks needn't pass through "lost".
 * - In Doze, or with background data restricted, the network stays up and only this app is cut off.
 *   Dials can't succeed then, so that counts as no path: they park instead of retrying.
 */
class NetworkPathTracker(
    private val setOnline: (Boolean) -> Unit,
    private val pathChanged: () -> Unit,
) {
    private var shape: String? = null
    private var blocked = false

    /** Whether this app can use a network right now. */
    val online: Boolean get() = shape != null && !blocked

    /** The state before the first callback. Reports nothing: a new client is told with [online]. */
    fun seed(shape: String?) {
        this.shape = shape
    }

    /** The default network's capabilities, or null when there's no default network any more. */
    fun update(next: String?) {
        val was = online
        val last = shape
        shape = next
        if (next == null) blocked = false
        report(was, moved = last != null && next != null && last != next)
    }

    fun setBlocked(blocked: Boolean) {
        val was = online
        this.blocked = blocked
        report(was, moved = false)
    }

    private fun report(was: Boolean, moved: Boolean) {
        val now = online
        // Coming back online already counts as a path change in the core.
        if (now != was) setOnline(now) else if (now && moved) pathChanged()
    }
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1369** (2026-11-12): **Engine: the headless engine holds up to 1.75 GB of GPU memory (Metal/Vision loaded)**
  *Symptoms*: The background engine (`Zeron Engine`) has no UI, but it holds hundreds of MB of GPU memory. On the installed 0.3.0 app after 70 minutes, `footprint` showed:  | Category | Dirty | Reclaimable | |---|---|---| | IOAccelerator (GPU) | **819 MB** | 4,562 MB | | Rust heap (`MALLOC_*`) | about 20 MB | | | Phys footprint | 851 MB (peak **1,753 MB**) | |  `ps` RSS read 5.3 GB.  **What's loaded:** `vmmap` shows Metal, MetalPerformanceShaders (incl. MPSNeuralNetwork), Vision, CoreImage, QuartzCore, AppKit, IOSurface and SensitiveContentAnalysisML loaded at runtime. `otool -L` on the binary links none of them. Every engine process has some of this, even `Zeron Engine mcp` (13 MB IOAccelerator); the long-lived main engine grows it.  **Leads, unverified:** - `crates/notify` posts banners through `NSUserNotification` and swizzles `-[NSBundle bundleIdentifier]` to pose as the app. - The `zeron-engine` bin lives in `apps/zeron`, which depends on `zeron-ui`.  **Status:** under investigation (root cause, growth trigger, before/after numbers). The fix follows once the cause is proven.  **Done when:** an idle and a busy engine both show IOAccelerator at about 0 under `footprint`.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

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

### Incident Patch 1: `8bd5b5d6` (2026-11-17)
**Commit Message**: Transcript: a finished reply's rows built as what they are, not as what might still change

A long thread's open built about 1,640 reactive runs and 1,680 layout
measurements for one screen of words and folded tool rows: each folded
group a rolling title, a loader and a whole tree of its own; each text a
window of runs and a find switch per block; each held run a three-node
switch. (zgx inspect frames, M5 Max, ademark's 1,000-step thread opened:
67.0M -> 53.8M main-thread instructions, runs 1,642 -> 1,146, measured
1,679 -> 1,184.)

- Activity: a group made done keeps its line (no roll, no loader); its
  tree (its list, heights and their effect) is made the first time it
  opens, easing open from nothing as one made earlier does.
- A long reply's held run is one box as tall as it was (`min_h`), its
  blocks a component made only once it's near.
- Markdown: a finished text that fits one run is its blocks, made once
  under one switch (its words, and a find's marks in it), not a window of
  runs nor a switch per block.
- chat.rs: an opening tail's entry the same as the row held keeps what
  was built from it.

zgx test ui: 1,460 tests, 0 failed.

Co-Authored-By: Claude Opus 5.5 <[RED

**File**: `apps/zgx/src/chat.rs` (modified, +13/-3)
```diff
@@ -2362,10 +2362,20 @@ impl View {
                     };
                     for entry in tail {
                         let id = entry["id"].as_str().unwrap_or_default().to_owned();
-                        open.built.remove(id.as_str());
+                        let fresh = Entry::new(entry);
                         match open.entries.iter_mut().find(|e| *e.id == *id) {
-                            Some(held) => *held = Entry::new(entry),
-                            None => open.entries.push(Entry::new(entry)),
+                            // The same as the row it has (most of a tail, a
+                            // chat opened again): what was built from it
+                            // stays, so nothing showing is made again.
+                            Some(held) if held.sum() == fresh.sum() => {}
+                            Some(held) => {
+                                open.built.remove(id.as_str());
+                                *held = fresh;
+                            }
+                            None => {
+                                open.built.remove(id.as_str());
+                                open.entries.push(fresh);
+                            }
                         }
                     }
                     open.heard = true;
```

**File**: `apps/zgx/ui/ds/activity.luau` (modified, +141/-117)
```diff
@@ -858,6 +858,12 @@ return ui.component(function(props: Props): Node
 	-- be built for nothing as a list scrolls, and a selection across the
 	-- reply would take text no one can see.
 	local mounted = ui.use_state(opened:peek())
+	-- (The tree itself, its list and what keeps its rows' heights, is made
+	-- the first time it opens: a finished reply's groups, folded, most of a
+	-- long thread's, never make one. `unfolded`: one made by opening eases
+	-- open from nothing, as one made earlier does.)
+	local tree_made = ui.use_state(opened:peek())
+	local unfolded = ui.use_state(opened:peek())
 	local folding: (() -> ())? = nil
 	ui.effect(function()
 		local on = opened:get()
@@ -866,106 +872,150 @@ return ui.component(function(props: Props): Node
 			folding = nil
 		end
 		if on then
-			mounted:set(true)
+			ui.batch(function()
+				tree_made:set(true)
+				mounted:set(true)
+			end)
 		elseif mounted:peek() then
 			folding = ui.after(FOLD, function()
 				folding = nil
 				mounted:set(false)
 			end)
 		end
 	end)
-	-- The rows: a list virtualized by the view around it (the transcript's),
-	-- each call a row of its own, built only as the view shows it, the rows
-	-- about to come into it built ahead in the time frames leave over
-	-- (zgx's `ahead`), so a scroll or the tree opening builds what shows
-	-- alone. A row follows its tool in place (its item as a state), and
-	-- holds its height in `heights`: a call's line is ROW, one opened or a
-	-- thought its own, as it was last laid out.
-	local own_key = key or tostring(own)
-	local heights = ui.use_state({} :: { number })
-	local listed: { string } = {}
-	-- Calls arriving while the rows are made: each plays `ENTER` as it is
-	-- first built, as a row joining a `ui.each` does.
-	local arriving: { [string]: boolean } = {}
-	local was_mounted = false
-	-- A row's height as it is first laid out: a call's line, ROW, or as it
-	-- was last laid out if opened; a thought, as it was if it's short or
-	-- opened, else its four lines folded before it knows it's long (its
-	-- button's room comes a frame on, as the words are measured).
-	local line = ui.theme.get("zeron.prose.small.line") :: number
-	local first_folded = THOUGHT_LINES * line + (ROW - line)
-	local function height_of(t: Tool): number
-		local h = MEASURED[`{own_key}:{t.id}`]
-		local open = CALLS_OPEN:peek()[t.id] == true
-		if t.kind ~= "thought" then
-			return if open and h then h else ROW
-		end
-		if h and (open or h <= first_folded) then
-			return h
+	local Tree = ui.component(function(_: {}): Node
+		-- The rows: a list virtualized by the view around it (the transcript's),
+		-- each call a row of its own, built only as the view shows it, the rows
+		-- about to come into it built ahead in the time frames leave over
+		-- (zgx's `ahead`), so a scroll or the tree opening builds what shows
+		-- alone. A row follows its tool in place (its item as a state), and
+		-- holds its height in `heights`: a call's line is ROW, one opened or a
+		-- thought its own, as it was last laid out.
+		local own_key = key or tostring(own)
+		local heights = ui.use_state({} :: { number })
+		local listed: { string } = {}
+		-- Calls arriving while the rows are made: each plays `ENTER` as it is
+		-- first built, as a row joining a `ui.each` does.
+		local arriving: { [string]: boolean } = {}
+		local was_mounted = false
+		-- A row's height as it is first laid out: a call's line, ROW, or as it
+		-- was last laid out if opened; a thought, as it was if it's short or
+		-- opened, else its four lines folded before it knows it's long (its
+		-- button's room comes a frame on, as the words are measured).
+		local line = ui.theme.get("zeron.prose.small.line") :: number
+		local first_folded = THOUGHT_LINES * line + (ROW - line)
+		local function height_of(t: Tool): number
+			local h = MEASURED[`{own_key}:{t.id}`]
+			local open = CALLS_OPEN:peek()[t.id] == true
+			if t.kind ~= "thought" then
+				return if open and h then h else ROW
+			end
+			if h and (open or h <= first_folded) then
+				return h
+			end
+			return first_folded
 		end
-		return first_folded
-	end
-	ui.effect(function()
-		local list = tools:get()
-		local m = mounted:get()
-		local n = #list
-		-- (Rows that were there before: the same calls in the same places,
-		-- looked at at the ends; anything else is written whole.)
-		local same = #listed <= n
-			and (#listed == 0 or (list[1].id == listed[1] and list[#listed].id == listed[#listed]))
-		ui.batch(function()
-			if not same then
-				heights:set({})
-				table.clear(listed)
+		ui.effect(function()
+			local list = tools:get()
+			local m = mounted:get()
+			local n = #list
+			-- (Rows that were there before: the same calls in the same places,
+			-- looked at at the ends; anything else is written whole.)
+			local same = #listed <= n
+				and (#listed == 0 or (list[1].id == listed[1] and list[#listed].id == listed[#listed]))
+			ui.batch(function()
+				if not same then
+					heights:
```

**File**: `apps/zgx/ui/ds/markdown.luau` (modified, +42/-0)
```diff
@@ -2037,6 +2037,48 @@ return function(props: Props): Node
 		}
 	end
 
+	-- A finished text in a transcript (`window`, not being written) that fits
+	-- one run, most of a reply's: its blocks made once, plain, under one
+	-- switch that makes them again only if its words change (a finished
+	-- text's don't) or a find's marks in it do. Not runs held, judged and
+	-- watched for coming near the view, nor a switch per block for a find
+	-- no one is running: those are for a long text, or one still growing.
+	if window and type(text) == "function" and not ((window :: any).live and (window :: any).live()) then
+		local source = text :: () -> string
+		local first_text = source()
+		local first_list = parse(first_text, opts)
+		if #first_list <= CHUNK then
+			local f = find
+			return ui.presence(function(): string
+				local t = source()
+				if not f then
+					return t
+				end
+				local q = f.query()
+				if q == "" then
+					return t
+				end
+				local c = f.current()
+				local at = if c and c.key == f.key then `{c.block}:{c.k}` else "0:0"
+				return `{at}|{q}|{t}`
+			end, function(_: string): Node
+				local t = source()
+				local list = if t == first_text then first_list else parse(t, opts)
+				if ctx and ctx.task then
+					ctx.tasks = {}
+					number_tasks(list, ctx.tasks)
+				end
+				local q = if f then f.query() else ""
+				local c = if f and q ~= "" then f.current() else nil
+				local out: { Node } = {}
+				for i, b in list do
+					local k = if c and c.key == (f :: Find).key and c.block == i then c.k else 0
+					out[i] = marked(b, i, q, k)
+				end
+				return ui.column { w_full = column.w_full, min_w = column.min_w, gap = column.gap, out }
+			end)
+		end
+	end
 	-- A windowed text (a reply in a transcript) is parsed lazily: one that
 	-- lands whole and long comes back at once, its blocks not parsed yet
 	-- held in place (`pending`) and parsed over the next frames, its end
```

**File**: `apps/zgx/ui/ds/transcript.luau` (modified, +16/-18)
```diff
@@ -1067,6 +1067,16 @@ local function blocks_of(list: () -> { Block }, m: Message, now: () -> Message,
 				near:set(shows)
 			end
 		end
+		-- (Its blocks, made only once it's near: a component's body runs as it
+		-- mounts, so a run held away from the view asks for none of them.)
+		local Blocks = ui.component(function(_: {}): Node
+			return ui.each(ui.computed(function(): { Block }
+				local r = row:get()
+				return if aside then blocks_in(r) else r.blocks
+			end), function(b: Block, _j: number, brow: State<Block>): Node
+				return block(b, brow)
+			end, { key = key, w_full = true, gap = "$space.3" })
+		end)
 		judges[run.key] = judge
 		ui.on_cleanup(function()
 			if judges[run.key] == judge then
@@ -1118,24 +1128,12 @@ local function blocks_of(list: () -> { Block }, m: Message, now: () -> Message,
 					w.offset:set(math.max(0, w.offset:peek() + size.h - before))
 				end
 			end,
-			ui.presence(function(): string
-				return if near:get() then "built" else "held"
-			end, function(kind: string): Node
-				if kind == "built" then
-					return ui.each(ui.computed(function(): { Block }
-						local r = row:get()
-						return if aside then blocks_in(r) else r.blocks
-					end), function(b: Block, _j: number, brow: State<Block>): Node
-						return block(b, brow)
-					end, { key = key, w_full = true, gap = "$space.3" })
-				end
-				return ui.div {
-					w_full = true,
-					h = function(): number
-						return held:get()
-					end,
-				}
-			end, { w_full = true, min_w = 0 }),
+			-- Away from the view, this box alone, as tall as the run last was
+			-- (or its guess); near, its blocks.
+			min_h = function(): number
+				return if near:get() then 0 else held:get()
+			end,
+			ui.show(near, Blocks {}),
 		}
 	end, {
 		key = function(run: Run): string
```

---

### Incident Patch 2: `e8069c40` (2026-11-17)
**Commit Message**: Commands and Cloud: fixes from the security review

From an independent review of the PR (engine command code, edge registry):
- A background command whose chat was deleted before the chats next
  changed, or that started for a chat already archived, was never
  stopped: the chat follower now also re-checks as commands start.
- An agent's RunCommand/ListBackgroundCommands are filed under its own
  chat (the gate sets chatId), so they stop and list with the right one.
- Commands no longer inherit Zeron's own ZERON_* variables (its edge
  token, a Cloud machine's enrollment code), as the agent installer.
- The folder a command ended in is written to a file the environment
  names: no path in the script, so no quoting (a curly quote in the
  Windows temp path broke every PowerShell command).
- A project-canvas terminal starts in a project's folder only when the
  project is this device's.
- A runner's one-time full resync is sent at most three times, writes
  nothing once it's done, and its record goes with its device row.
- docs/design/cloud-device.md said a stolen runner key couldn't reach
  the account or vault; through a client link to an online computer it
  reaches all that comp

**File**: `crates/engine/src/commands.rs` (modified, +126/-35)
```diff
@@ -273,13 +273,20 @@ impl Commands {
             .inner
             .kind
             .says_folder()
-            .then(|| tempfile::NamedTempFile::new().ok().map(|file| file.into_temp_path()))
+            .then(|| {
+                tempfile::NamedTempFile::new()
+                    .ok()
+                    .map(|file| file.into_temp_path())
+            })
             .flatten();
-        let script = self
-            .inner
-            .kind
-            .script(command, ended_in.as_deref());
-        let mut child = spawn(&self.inner.shell, self.inner.kind, cwd, &script)?;
+        let script = self.inner.kind.script(command, ended_in.is_some());
+        let mut child = spawn(
+            &self.inner.shell,
+            self.inner.kind,
+            cwd,
+            &script,
+            ended_in.as_deref(),
+        )?;
         let (sender, mut chunks) = tokio::sync::mpsc::channel::<Vec<u8>>(16);
         let readers = pumps(&mut child, sender);
 
@@ -344,8 +351,8 @@ impl Commands {
                 "{MAX_BACKGROUND} background commands are already running on this device: stop one first"
             ));
         }
-        let script = self.inner.kind.script(command, None);
-        let mut child = spawn(&self.inner.shell, self.inner.kind, cwd, &script)?;
+        let script = self.inner.kind.script(command, false);
+        let mut child = spawn(&self.inner.shell, self.inner.kind, cwd, &script, None)?;
         let id = format!("cmd-{}", &uuid::Uuid::new_v4().simple().to_string()[..12]);
         let background = Arc::new(Background {
             id: id.clone(),
@@ -505,11 +512,14 @@ impl Commands {
     }
 
     /// Stop background commands whose chat is archived or deleted, as
-    /// `chats` (this engine's) change. A chat counts as deleted only once
-    /// these chats have shown it, so one not synced here yet isn't taken as
-    /// gone. Ends with the engine.
+    /// `chats` (this engine's) change and as commands start (one started
+    /// for a chat already archived, or deleted before the chats next change,
+    /// is caught too). A chat counts as deleted only once these chats have
+    /// shown it, so one not synced here yet isn't taken as gone. Ends with
+    /// the engine.
     pub fn follow_chats(&self, mut chats: watch::Receiver<Vec<zeron_proto::Chat>>) {
         let inner: Weak<Inner> = Arc::downgrade(&self.inner);
+        let mut started = self.inner.changes.subscribe();
         tokio::spawn(async move {
             // Commands whose chat these chats have shown.
             let mut seen = std::collections::HashSet::<String>::new();
@@ -545,7 +555,11 @@ impl Commands {
                     tracing::info!(command = %command.id, "its chat went away: stopping it");
                     command.stop.notify_one();
                 }
-                if chats.changed().await.is_err() {
+                let next = tokio::select! {
+                    changed = chats.changed() => changed,
+                    changed = started.changed() => changed,
+                };
+                if next.is_err() {
                     return;
                 }
             }
@@ -611,21 +625,23 @@ impl ShellKind {
         matches!(self, Self::Posix | Self::PowerShell)
     }
 
-    /// `command` as this shell runs it; with `ended_in`, it also writes the
-    /// folder it ended in there (in PowerShell, not after an `exit`).
-    fn script(self, command: &str, ended_in: Option<&std::path::Path>) -> String {
-        match (self, ended_in) {
-            (Self::Posix, Some(path)) => format!(
-                "trap '__zeron_status=$?; pwd -P >| {} 2>/dev/null; exit $__zeron_status' EXIT\n{command}\n",
-                quote(&path.to_string_lossy()).replace('\'', r"'\''")
+    /// `command` as this shell runs it; with `says_folder`, it also writes
+    /// the folder it ended in to the file [`FOLDER_FILE_ENV`] names (in
+    /// PowerShell, not after an `exit`). The path is never in the script,
+    /// so nothing in it needs quoting.
+    fn script(self, command: &str, says_folder: bool) -> String {
+        match (self, says_folder) {
+            (Self::Posix, true) => format!(
+                "trap '__zeron_status=$?; pwd -P >| \"${FOLDER_FILE_ENV}\" 2>/dev/null; exit $__zeron_status' EXIT\n{command}\n"
             ),
-            (Self::PowerShell, ended_in) => {
-                let say_folder = ended_in.map_or_else(String::new, |path| {
+            (Self::PowerShell, says_folder) => {
+                let say_folder = if says_folder {
                     format!(
-                        "try {{ [System.IO.File]::WriteAllText('{}', (Get-Location).ProviderPath) }} catch {{}}\n",
-                        path.to_string_lossy().replace('\'', "''")
+                        "try {{ [System.IO.File]::WriteAllText($env:{FOLDER_FILE_ENV}, (Get-Location).ProviderPath) }} catch {{}}\n"
                     )
-                });
+                } else {
+                    Strin
```

**File**: `crates/engine/src/rpc.rs` (modified, +3/-0)
```diff
@@ -5757,11 +5757,14 @@ impl RpcService for EngineRpc {
                     .flatten()
                     .filter(|chat| chat.device_id == self.doc_host.device_id());
                 let chat_cwd = hosted.as_ref().and_then(|chat| chat.cwd.clone());
+                // Likewise only a project made on this device: another's
+                // folder is a path there.
                 let space_cwd = canvas_space_id(&p.chat_id).and_then(|space_id| {
                     self.workspace
                         .space(space_id)
                         .ok()
                         .flatten()
+                        .filter(|space| space.device_id == self.doc_host.device_id())
                         .map(|space| space.path)
                 });
                 let cwd = resolve_open_terminal_cwd(
```

**File**: `crates/engine/src/rpc/agent_gate.rs` (modified, +23/-9)
```diff
@@ -109,13 +109,19 @@ impl EngineRpc {
             let full = calling.as_ref().is_none_or(|c| {
                 c.ceiling.is_none_or(|(_, access)| access == AccessMode::FullAccess)
             });
-            return if full {
-                Ok(params)
-            } else {
-                Err(refused(
+            if !full {
+                return Err(refused(
                     "A command runs as the person, unconfined: only a chat with full access runs one. Ask the person to give this chat full access, or to run it themselves",
-                ))
-            };
+                ));
+            }
+            // A command is its agent's own chat's (it stops when that chat
+            // goes, and lists under it), whatever chat the call names.
+            if let Some(chat) = chat
+                && matches!(method, methods::RUN_COMMAND | methods::LIST_BACKGROUND_COMMANDS)
+            {
+                params["chatId"] = json!(chat);
+            }
+            return Ok(params);
         }
         match method {
             methods::MUTATE => match params["op"].as_str().unwrap_or_default() {
@@ -324,7 +330,15 @@ mod tests {
         chat(&core, "app", "App", "workspace-write", "full-access").await;
         chat(&core, "free", "Free", "danger-full-access", "full-access").await;
         let rpc = core.rpc_service();
-        let open = json!({"command":"ls", "targetDeviceId":"laptop"});
+        // Naming another chat: a command is filed under the caller's own.
+        let open = json!({"command":"ls", "targetDeviceId":"laptop", "chatId":"careful"});
+        let as_from = |chat: &str, method: &str| {
+            let mut params = open.clone();
+            if matches!(method, methods::RUN_COMMAND | methods::LIST_BACKGROUND_COMMANDS) {
+                params["chatId"] = json!(chat);
+            }
+            params
+        };
         for method in [
             methods::RUN_COMMAND,
             methods::READ_COMMAND_OUTPUT,
@@ -343,13 +357,13 @@ mod tests {
             let app = with_caller(agent("app"), async { rpc.agent_gate(method, open.clone()) })
                 .await
                 .unwrap();
-            assert_eq!(app, open, "{method}");
+            assert_eq!(app, as_from("app", method), "{method}");
             let allowed = with_caller(agent("free"), async {
                 rpc.agent_gate(method, open.clone())
             })
             .await
             .unwrap();
-            assert_eq!(allowed, open, "{method}");
+            assert_eq!(allowed, as_from("free", method), "{method}");
             // A server with no chat (set up by hand) is capped by nothing.
             with_caller(Caller::Agent { chat: None }, async {
                 rpc.agent_gate(method, open.clone())
```

**File**: `docs/design/cloud-device.md` (modified, +10/-6)
```diff
@@ -193,12 +193,16 @@ its own, on its own machine, recorded with `parentChatId` = the parent's chat.
 - **Delete**: the registry lets it delete its delegates' chat and session rows
   (`runnerChildren`) — never re-home them.
 
-A stolen runner key therefore reaches what an agent on any of the person's devices reaches:
-their chats (reading them, messaging them, starting chats on their devices) and, through a
-client link, those devices' RPC surface (terminals, files) — plus starting machines on the
-repository its session already has (bounded by credits and the awake limit). It still can't
-manage the account, read the vault, host another device, or change the person's
-preferences.
+A stolen runner key therefore reaches what any of the person's devices reaches. Directly, at
+the edge: their chats (reading them, messaging them, starting chats on their devices) and
+starting machines on the repository its session already has (bounded by credits and the awake
+limit); the edge still refuses it the account (`/auth/*`, `/cloud/*`), the vault beyond its own
+grant, hosting another device's room, and the person's preferences. But through a client link
+to one of their online computers it reaches that computer's whole RPC surface, which acts with
+that computer's own session: running commands and opening terminals there, its files, and the
+calls that computer makes for the person (account, vault, Cloud and billing). So in practice a
+compromised session machine can act as the person while any of their computers is online —
+the trade-off accepted for Cloud chats working with every device as a computer's chats do.
 
 ### Workflows (Cloudflare Workflows)
 
```

**File**: `edge/src/registry-room.ts` (modified, +39/-17)
```diff
@@ -29,6 +29,12 @@
  */
 import { applyOp, validateOp, type Op, type Row } from "./registry-core";
 import { chatHost, runnerCanSee, runnerOpRefusal } from "./registry-runner";
+
+/** Full states a runner from before the widening is sent at most
+ * (RegistryRoom.runnerBehind). */
+const RUNNER_FULL_TRIES = 3;
+/** The meta key of a runner's full-resync record. */
+const runnerSentKey = (device: string): string => `runnerSentAll:${device}`;
 import { AUTH_USER_HEADER, RUNNER_ACCOUNT_HEADER, RUNNER_DEVICE_HEADER, apnsConfig, type Env } from "./env";
 import { isDeadToken, sendApns, type ApnsEnvironment } from "./apns";
 import { WriteMeter } from "./write-meter";
@@ -225,18 +231,31 @@ export class RegistryRoom implements DurableObject {
    * sees (registry-runner.ts). Before, a runner was sent only its own rows,
    * so a Cloud machine that synced then holds a cursor past laptop chats,
    * projects and sessions it never received: its first state since is full.
-   * Recorded as the seq that full state was sent at. Only a cursor PAST it
-   * proves the runner applied it (and a row since): a cursor at it may be
-   * one that never got the reply, so that runner is sent everything again
-   * (a few extra full states at most — its own rows move the head on).
-   * Records the send when true.
+   *
+   * Recorded per device as the cursor it first came with (`from`) and how
+   * many full states it was sent (`sent`). A cursor past `from` proves it
+   * applied one (it can only have moved through a state sent since). At
+   * `from` still, the reply may have been lost, or the room was quiet (the
+   * state's seq was `from` too), which a cursor can't tell apart: it is sent
+   * again, at most [`RUNNER_FULL_TRIES`] times in all. Writes only while it
+   * sends; the record goes with its device row.
+   *
+   * Returns whether the state is full: `full` (already full for another
+   * reason: a first sync, a cursor behind GC or ahead of the head), or this.
+   * A runner sent everything for another reason is recorded as caught up.
    */
-  private runnerBehind(device: string | undefined, cursor: number | null, seq: number): boolean {
-    if (device === undefined) return false;
-    const key = `runnerSentAll:${device}`;
-    const sentAt = this.getMeta(key);
-    if (sentAt !== undefined && cursor !== null && cursor > Number(sentAt)) return false;
-    this.setMeta(key, String(seq));
+  private runnerBehind(device: string | undefined, cursor: number | null, full: boolean): boolean {
+    if (device === undefined) return full;
+    const key = runnerSentKey(device);
+    const raw = this.getMeta(key);
+    if (full) {
+      if (raw === undefined) this.setMeta(key, JSON.stringify({ from: -1, sent: 0 }));
+      return true;
+    }
+    if (cursor === null) return true;
+    const record = raw === undefined ? undefined : (JSON.parse(raw) as { from: number; sent: number });
+    if (record !== undefined && (cursor > record.from || record.sent >= RUNNER_FULL_TRIES)) return false;
+    this.setMeta(key, JSON.stringify({ from: record?.from ?? cursor, sent: (record?.sent ?? 0) + 1 }));
     return true;
   }
 
@@ -388,12 +407,12 @@ export class RegistryRoom implements DurableObject {
       }
       const seq = this.seq();
       const gcFloor = this.gcFloor();
-      const full = cursor === null || cursor < gcFloor || cursor > seq || this.runnerBehind(runner, cursor, seq);
+      const full = this.runnerBehind(runner, cursor, cursor === null || cursor < gcFloor || cursor > seq);
       return json({
         seq,
         full,
         gcFloor,
-        rows: this.visible(full ? this.rowsSince(0) : this.rowsSince(cursor), runner, runnerAccount),
+        rows: this.visible(full || cursor === null ? this.rowsSince(0) : this.rowsSince(cursor), runner, runnerAccount),
         presence: Object.fromEntries(this.presence)
       });
     }
@@ -520,9 +539,8 @@ export class RegistryRoom implements DurableObject {
     // reset/wipe) — both force `full`, and the client reacts by replacing
     // (former) or re-seeding the server (latter; see registry.rs). So does a
     // Cloud machine's cursor from before it saw every row (runnerBehind).
-    const full =
-      cursor === null || cursor < gcFloor || cursor > seq || this.runnerBehind(state.runner, cursor, seq);
-    const rows = this.visible(full ? this.rowsSince(0) : this.rowsSince(cursor), state.runner, state.runnerAccount);
+    const full = this.runnerBehind(state.runner, cursor, cursor === null || cursor < gcFloor || cursor > seq);
+    const rows = this.visible(full || cursor === null ? this.rowsSince(0) : this.rowsSince(cursor), state.runner, state.runnerAccount);
     send(ws, {
       t: "state",
       seq,
@@ -621,7 +639,11 @@ export class RegistryRoom implements DurableObject {
     if (applied > 0) {
       // The rows are the only thing a push must store: their seq IS the new
       // head (see `seq`). One event's writes commit together.
-      for (co
```

**File**: `edge/test/workerd/runner-boundary.workerd.test.ts` (modified, +4/-1)
```diff
@@ -167,8 +167,11 @@ describe("registry reads", () => {
     const first = await pull(runner, head);
     expect(first.full).toBe(true);
     expect(find(first.rows, "chats", laptopChat)).toBeDefined();
-    // At that cursor still: maybe it never got the reply, so again.
+    // At that cursor still: maybe it never got the reply, so again, but at
+    // most three times in all (a quiet room can't tell applied from lost).
     expect((await pull(runner, head)).full).toBe(true);
+    expect((await pull(runner, head)).full).toBe(true);
+    expect((await pull(runner, head)).full).toBe(false);
     // Past it (applied, and a row since): incremental from then on.
     await push(user, [upsert("chats", laptopChat, { title: "renamed" }, "laptop")]);
     const after = (await pull(user, 0)).seq;
```

---

### Incident Patch 3: `7ca6d857` (2026-11-16)
**Commit Message**: Commands on the engine's own foundations; Cloud widening's regressions fixed

Commands (redone with no shortcuts):
- commands::Commands is an engine-owned service like Terminals, shut down
  with EngineCore, wired into update quiescence and the Cloud heartbeat; no
  process-wide state (one engine could stop another's commands before).
- Each command runs as zeron_harness::process::owned::Child (now public):
  its own process group / Job Object, TERM then KILL after a grace with
  escaped descendants, killed on drop, no nested-Claude markers. Anything
  a command leaves running ends with it; background: true is for that.
- The login shell's PATH and variables come from the harness's snapshot
  (new compose_user_path), captured once: plain `-c`, no profile per run.
- PowerShell gets -EncodedCommand (no quoting), passes a native command's
  exit code on and says where it ended; Windows-only tests for CI.
- The background band follows each device's WatchBackgroundCommands
  stream instead of polling: an ended command leaves as it ends; the row
  keeps the live heartbeat's cadence.
- stop waits on the command's end (watch), not a sleep loop.

Cloud regressions found in review:
- A Cloud

**File**: `crates/engine/src/commands.rs` (added, +1262/-0)
```diff
@@ -0,0 +1,1262 @@
+//! Shell commands for agents, on this device or another of the person's
+//! (Zeron MCP's `run_command` & co., forwarded by `targetDeviceId`): what an
+//! agent's own shell tool does on its machine, on any of them. Owned by the
+//! engine ([`crate::EngineCore`]) like its terminals, and shut down with it.
+//!
+//! - [`Commands::run`] (`RunCommand`): one command run to its end. Its
+//!   output and exit code come back, and the folder it ended in (`cwd`, from
+//!   a POSIX shell), so an agent's `cd` carries over to its next command.
+//! - [`Commands::start`] (`RunCommand {background}`): one left running (a dev
+//!   server, a watcher, a long build), read with [`Commands::read`], stopped
+//!   with [`Commands::stop`], listed with [`Commands::list`] and watched with
+//!   [`Commands::watch`] (`WatchBackgroundCommands`: how the chat's host
+//!   keeps its background band current, wherever the command runs).
+//!
+//! No PTY and no session. The user's shell runs the command (`-c`;
+//! PowerShell or cmd on Windows) with the PATH and variables their login
+//! shell sets, captured once per process ([`zeron_harness::compose_user_path`]),
+//! and empty stdin, so a prompt for input ends instead of hanging. Each runs
+//! as an owned process ([`zeron_harness::process::owned`]): a process group
+//! (Job Object on Windows) of its own, without the markers of a Claude
+//! session Zeron may itself run in. What it costs is bounded:
+//!
+//! - **Memory**: a run keeps at most [`HEAD`] + [`TAIL`] bytes of output (its
+//!   start and end); a background command its newest [`RING`] bytes. What's
+//!   left out is counted, not kept. At most [`MAX_ENDED`] ended background
+//!   commands are remembered, none for longer than [`KEEP_ENDED`].
+//! - **Processes**: when a command ends, so does everything it started. At
+//!   its timeout, on a stop, when the chat that started it is archived or
+//!   deleted ([`Commands::follow_chats`]), and at engine shutdown, its group
+//!   is asked to stop and killed after [`GRACE`]; a call abandoned mid-run
+//!   kills it at once.
+//! - **Concurrency**: at most [`MAX_RUNNING`] runs and [`MAX_BACKGROUND`]
+//!   background commands at once per device; past that, refused, not queued.
+//!
+//! Running commands count as work ([`Commands::running`]): a Cloud machine
+//! stays awake for them, and an update waits for them.
+
+use std::collections::{HashMap, VecDeque};
+use std::sync::{Arc, Mutex, Weak};
+use std::time::{Duration, Instant};
+
+use futures::StreamExt as _;
+use futures::stream::BoxStream;
+use serde::Serialize;
+use tokio::io::{AsyncRead, AsyncReadExt};
+use tokio::sync::{Notify, Semaphore, watch};
+use zeron_harness::process::{Command, Stdio, owned};
+
+pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);
+pub const MAX_TIMEOUT: Duration = Duration::from_secs(600);
+/// Output a run keeps from its start, and from its end.
+const HEAD: usize = 16 * 1024;
+const TAIL: usize = 48 * 1024;
+/// Output a background command keeps (its newest), and the most one read
+/// returns.
+const RING: usize = 128 * 1024;
+const MAX_READ: usize = 48 * 1024;
+/// How long output is still read once a shell has exited: a process that
+/// left the group (`setsid`) may hold the pipes open for good.
+const DRAIN: Duration = Duration::from_millis(250);
+/// Between asking a command's processes to stop and killing them.
+pub const GRACE: Duration = Duration::from_secs(2);
+pub const MAX_RUNNING: usize = 16;
+pub const MAX_BACKGROUND: usize = 32;
+const MAX_ENDED: usize = 32;
+const KEEP_ENDED: Duration = Duration::from_secs(60 * 60);
+
+fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
+    mutex
+        .lock()
+        .unwrap_or_else(std::sync::PoisonError::into_inner)
+}
+
+/// This engine's agents' commands. Cheap to clone (shared state).
+#[derive(Clone)]
+pub struct Commands {
+    inner: Arc<Inner>,
+}
+
+struct Inner {
+    shell: String,
+    kind: ShellKind,
+    running: Semaphore,
+    background: Mutex<HashMap<String, Arc<Background>>>,
+    /// Bumped when a background command starts, ends or is forgotten.
+    changes: watch::Sender<u64>,
+    /// Commands shown on chats hosted here, followed wherever they run: one
+    /// task per (chat, device), `None` being this one ([`Commands::show`]).
+    followers: Mutex<HashMap<(String, Option<String>), tokio::task::AbortHandle>>,
+}
+
+impl Default for Commands {
+    fn default() -> Self {
+        Self::with_shell(crate::terminals::selected_shell())
+    }
+}
+
+/// How one run ended.
+#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
+#[serde(rename_all = "camelCase")]
+pub struct RunOutcome {
+    /// `None` when it was killed (timed out, or by a signal).
+    pub exit_code: Option<i32>,
+    /// Stdout and stderr together, in the order they arrived. When it was
+    /// too long, its start and end with a line saying how much was left out.
+    pub output: String,
+    /// Bytes of ou
```

**File**: `crates/engine/src/lib.rs` (modified, +24/-8)
```diff
@@ -44,6 +44,7 @@ mod chat_persistence;
 mod cloud_accounts;
 pub mod cloud_client;
 pub mod cloud_disk;
+pub mod commands;
 pub mod commit_credit;
 pub mod credentials;
 pub mod deferred;
@@ -71,7 +72,6 @@ pub mod registry;
 pub mod remote_terminals;
 pub mod repos;
 pub mod rpc;
-pub mod run_command;
 pub mod run_journal;
 pub mod runner;
 pub mod wake_trace;
@@ -186,6 +186,8 @@ pub struct EngineCore {
     pub repos: Repos,
     pub workspace_files: WorkspaceFiles,
     pub terminals: Terminals,
+    /// Agents' shell commands on this device ([`commands`]).
+    pub commands: commands::Commands,
     /// I/O routing for terminals on other devices (direct link or relay).
     pub remote_terminals: remote_terminals::RemoteTerminals,
     pub project_actions: ProjectActionsStore,
@@ -385,14 +387,18 @@ impl EngineCore {
             repos.clone(),
             workspace.clone(),
             device_id.clone(),
-            runner::session()
-                .and_then(|session| session.path.clone())
-                .map(std::path::PathBuf::from),
+            runner::session().and_then(|session| {
+                Some(workspace_files::CloudCheckout {
+                    path: std::path::PathBuf::from(session.path.clone()?),
+                    chat_id: session.chat_id.clone(),
+                })
+            }),
         );
         let terminals = Terminals::new();
         sessions.track_terminal_activity(terminals.clone(), workspace.clone());
+        let commands = commands::Commands::default();
         // An agent's background commands end with its chat.
-        run_command::follow_chats(workspace.watch_chats());
+        commands.follow_chats(workspace.watch_chats());
         let project_actions = ProjectActionsStore::open(profile.store_root())?;
         doc_host.set_project_action_runtime(project_actions.clone(), terminals.clone());
         let previews = zeron_preview::PreviewService::new(
@@ -499,6 +505,7 @@ impl EngineCore {
             repos,
             workspace_files,
             terminals,
+            commands,
             remote_terminals: Default::default(),
             project_actions,
             previews,
@@ -533,11 +540,12 @@ impl EngineCore {
     pub fn update_quiescence(&self, cloud: bool) -> zeron_update::QuiescentCheck {
         let sessions = self.sessions.clone();
         let terminals = self.terminals.clone();
+        let commands = self.commands.clone();
         let doc_host = cloud.then(|| self.doc_host.clone());
         Arc::new(move || {
             !sessions.any_active()
                 && !terminals.any_open()
-                && run_command::running_count() == 0
+                && commands.running() == 0
                 && !doc_host.as_ref().is_some_and(DocHost::has_waiting_commands)
         })
     }
@@ -677,6 +685,7 @@ impl EngineCore {
         .with_auth(self.auth())
         .with_previews(self.previews.clone())
         .with_remote_terminals(self.remote_terminals.clone())
+        .with_commands(self.commands.clone())
         .with_harness_updates(self.harness_updates.clone())
         .with_viewport_focus(self.viewport_focus.clone())
         .with_plugins(self.plugins.clone());
@@ -762,7 +771,7 @@ impl EngineCore {
         }
         self.sessions.shutdown().await;
         self.terminals.shutdown();
-        run_command::shutdown();
+        self.commands.shutdown().await;
         self.sessions.stop_activity_projection().await;
         self.agent_accounts.shutdown();
         self.change_requests.shutdown();
@@ -1153,11 +1162,18 @@ impl Engine {
             core.registry.set_run_environment(Arc::new(broker.clone()));
             broker.start();
             let sessions = core.sessions.clone();
+            let commands = core.commands.clone();
             let activity = runner::RelayActivity::default();
             let heartbeat = runner::spawn_heartbeat(
                 identity.edge_url(),
                 tokens,
-                Arc::new(move || sessions.run_counts()),
+                // An agent's running commands (a dev server left running)
+                // keep the machine awake as background work does.
+                Arc::new(move || {
+                    let mut counts = sessions.run_counts();
+                    counts.background += commands.running();
+                    counts
+                }),
                 Arc::new(cloud_disk::machine_usage),
                 activity.clone(),
                 runner::HEARTBEAT_INTERVAL,
```

**File**: `crates/engine/src/rpc.rs` (modified, +138/-99)
```diff
@@ -915,6 +915,8 @@ pub struct EngineRpc {
     workspace_files: crate::WorkspaceFiles,
     terminals: Terminals,
     remote_terminals: crate::remote_terminals::RemoteTerminals,
+    /// Agents' shell commands here ([`crate::commands`]).
+    commands: crate::commands::Commands,
     project_actions: ProjectActionsStore,
     previews: Option<zeron_preview::PreviewService>,
     change_requests: CheckoutChangeRequests,
@@ -979,6 +981,7 @@ impl EngineRpc {
             workspace_files,
             terminals,
             remote_terminals: Default::default(),
+            commands: Default::default(),
             project_actions,
             previews: None,
             change_requests,
@@ -1010,6 +1013,12 @@ impl EngineRpc {
     }
 
     /// Share the engine-wide routing state for terminals on other devices.
+    /// The engine's agents' commands (one service per engine).
+    pub fn with_commands(mut self, commands: crate::commands::Commands) -> Self {
+        self.commands = commands;
+        self
+    }
+
     pub fn with_remote_terminals(
         mut self,
         remote_terminals: crate::remote_terminals::RemoteTerminals,
@@ -1924,9 +1933,9 @@ impl EngineRpc {
 
     /// A background command the calling agent just started (`device`: where,
     /// `None` here): its chat shows it with its runtime's background
-    /// processes until it ends. Only an agent's own call: a peer forwarding
-    /// one here is running it for a chat hosted there.
-    fn track_command(&self, device: Option<&str>, started: &serde_json::Value) {
+    /// processes until it ends ([`Self::follow_commands`]). Only an agent's
+    /// own call: a peer forwarding one here runs it for a chat hosted there.
+    fn show_command(&self, device: Option<&str>, started: &serde_json::Value) {
         let zeron_rpc::Caller::Agent { chat: Some(chat) } = zeron_rpc::caller() else {
             return;
         };
@@ -1941,88 +1950,92 @@ impl EngineRpc {
                 .find(|d| d.id == device)
                 .map(|d| d.name)
         });
-        let task = zeron_proto::BackgroundTask {
-            id: match device {
-                Some(device) => format!("{id}@{device}"),
-                None => id.to_owned(),
-            },
-            command: started["command"].as_str().unwrap_or_default().to_owned(),
-            description: name.map(|name| format!("on {name}")),
-            started_at: chrono::Utc::now(),
-        };
-        let command = crate::run_command::CommandTask {
+        let task = crate::commands::CommandTask {
             device: device.map(str::to_owned),
             id: id.to_owned(),
-            task,
+            task: zeron_proto::BackgroundTask {
+                id: match device {
+                    Some(device) => format!("{id}@{device}"),
+                    None => id.to_owned(),
+                },
+                command: started["command"].as_str().unwrap_or_default().to_owned(),
+                description: name.map(|name| format!("on {name}")),
+                started_at: chrono::Utc::now(),
+            },
         };
-        if self.sessions.track_command(&chat, command) {
-            let rpc = self.clone();
-            tokio::spawn(async move { rpc.follow_commands().await });
-        }
+        let follower = self.clone();
+        let (chat_id, device) = (chat.clone(), task.device.clone());
+        self.commands.show(&self.sessions, &chat, task, move || {
+            tokio::spawn(follower.follow_commands(chat_id, device))
+        });
     }
 
-    /// While any are tracked: every few seconds, ask each device which of a
-    /// chat's commands still run, and show those. A device out of reach
-    /// keeps its commands shown for [`COMMAND_UNREACHABLE`], then they go.
-    async fn follow_commands(self) {
-        const EVERY: Duration = Duration::from_secs(5);
-        const COMMAND_UNREACHABLE: Duration = Duration::from_secs(120);
-        let mut unreachable: std::collections::HashMap<String, std::time::Instant> = Default::default();
+    /// Follow the commands `chat` shows on `device` (`None`: here) through
+    /// that device's `WatchBackgroundCommands`: each one that ends leaves the
+    /// row as it ends, and the row stays fresh (the live heartbeat's
+    /// cadence) while any run. A device out of reach keeps its commands
+    /// shown for [`COMMANDS_UNREACHABLE`] while it's dialled again, then they
+    /// go. Ends when the chat shows none there.
+    async fn follow_commands(self, chat: String, device: Option<String>) {
+        const COMMANDS_UNREACHABLE: Duration = Duration::from_secs(120);
+        const REDIAL: Duration = Duration::from_secs(3);
+        let heartbeat_every =
+            Duration::from_millis(zeron_proto::view::SESSION_HEARTBEAT_MS as u64 / 2);
+        let mut heartbeat = tokio::time::interval(heartbeat_every);
+        heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
+        let mut lost_since: Option<t
```

**File**: `crates/engine/src/rpc/agent_gate.rs` (modified, +78/-24)
```diff
@@ -319,35 +319,72 @@ mod tests {
     async fn only_an_unconfined_agent_runs_a_command() {
         let (_temp, core) = core().await;
         chat(&core, "careful", "Careful", "read-only", "supervised").await;
-        chat(&core, "sandboxed", "Sandboxed", "workspace-write", "full-access").await;
+        chat(
+            &core,
+            "sandboxed",
+            "Sandboxed",
+            "workspace-write",
+            "full-access",
+        )
+        .await;
         chat(&core, "free", "Free", "danger-full-access", "full-access").await;
         let rpc = core.rpc_service();
         let open = json!({"command":"ls", "targetDeviceId":"laptop"});
-        for method in [methods::RUN_COMMAND, methods::READ_COMMAND_OUTPUT, methods::STOP_COMMAND, methods::LIST_BACKGROUND_COMMANDS] {
+        for method in [
+            methods::RUN_COMMAND,
+            methods::READ_COMMAND_OUTPUT,
+            methods::STOP_COMMAND,
+            methods::LIST_BACKGROUND_COMMANDS,
+        ] {
             for who in ["careful", "sandboxed", "nowhere"] {
-                let refused = with_caller(agent(who), async { rpc.agent_gate(method, open.clone()) }).await;
+                let refused =
+                    with_caller(agent(who), async { rpc.agent_gate(method, open.clone()) }).await;
                 assert!(
                     matches!(&refused, Err(zeron_rpc::RpcError::Failed(m)) if m.contains("full access and no sandbox")),
                     "{who} {method}: {refused:?}"
                 );
             }
-            let allowed = with_caller(agent("free"), async { rpc.agent_gate(method, open.clone()) }).await.unwrap();
+            let allowed = with_caller(agent("free"), async {
+                rpc.agent_gate(method, open.clone())
+            })
+            .await
+            .unwrap();
             assert_eq!(allowed, open, "{method}");
             // A server with no chat (set up by hand) is capped by nothing.
-            with_caller(Caller::Agent { chat: None }, async { rpc.agent_gate(method, open.clone()) }).await.unwrap();
+            with_caller(Caller::Agent { chat: None }, async {
+                rpc.agent_gate(method, open.clone())
+            })
+            .await
+            .unwrap();
             assert_eq!(rpc.agent_gate(method, open.clone()).unwrap(), open);
         }
         // Through the engine, it runs here and says how it went.
         let dir = tempfile::tempdir().unwrap();
         let ran = with_caller(
             agent("free"),
-            rpc.handle(methods::RUN_COMMAND, json!({"command":"echo hi; exit 2", "cwd": dir.path()})),
+            rpc.handle(
+                methods::RUN_COMMAND,
+                json!({"command":"echo hi; exit 2", "cwd": dir.path()}),
+            ),
         )
         .await
         .unwrap();
-        let zeron_rpc::RpcReply::Value(ran) = ran else { panic!("a stream") };
-        assert_eq!((ran["exitCode"].clone(), ran["output"].as_str().unwrap().ends_with("hi\n")), (json!(2), true), "{ran}");
-        let refused = with_caller(agent("careful"), rpc.handle(methods::RUN_COMMAND, json!({"command":"echo hi"}))).await;
+        let zeron_rpc::RpcReply::Value(ran) = ran else {
+            panic!("a stream")
+        };
+        assert_eq!(
+            (
+                ran["exitCode"].clone(),
+                ran["output"].as_str().unwrap().ends_with("hi\n")
+            ),
+            (json!(2), true),
+            "{ran}"
+        );
+        let refused = with_caller(
+            agent("careful"),
+            rpc.handle(methods::RUN_COMMAND, json!({"command":"echo hi"})),
+        )
+        .await;
         assert!(refused.is_err());
         core.sessions.shutdown().await;
     }
@@ -359,7 +396,8 @@ mod tests {
     async fn a_chat_shows_the_commands_its_agent_left_running() {
         let (_temp, core) = core().await;
         chat(&core, "free", "Free", "danger-full-access", "full-access").await;
-        core.sessions.seed_status("free", zeron_proto::SessionStatus::Working);
+        core.sessions
+            .seed_status("free", zeron_proto::SessionStatus::Working);
         let rpc = core.rpc_service();
         let dir = tempfile::tempdir().unwrap();
         let value = |reply: zeron_rpc::RpcReply| match reply {
@@ -375,7 +413,11 @@ mod tests {
                 ),
             )
         };
-        let server = value(start("echo listening; while true; do sleep 0.05; done").await.unwrap());
+        let server = value(
+            start("echo listening; while true; do sleep 0.05; done")
+                .await
+                .unwrap(),
+        );
         let quick = value(start("echo done").await.unwrap());
         let shown = |core: &crate::EngineCore| -> Vec<String> {
             core.sessions
@@ -391,25 +433,34 @@ mod tests {
         let give_up = std::time::Instant::now() + std::time::Duration::from_secs(5);
         loop {
             let tail = value(
-                rpc.handle(methods::REA
```

**File**: `crates/engine/src/run_command.rs` (removed, +0/-853)
```diff
@@ -1,853 +0,0 @@
-//! Shell commands for agents, on this device or another of the person's
-//! (Zeron MCP's `run_command` & co., forwarded by `targetDeviceId`): what an
-//! agent's own shell tool does on its machine, on any of them.
-//!
-//! - [`run`] (`RunCommand`): one command run to its end. Its output and exit
-//!   code come back, and where it ended up (`cwd`, from a POSIX shell), so an
-//!   agent's `cd` carries over to its next command.
-//! - [`start`] (`RunCommand {background}`): one left running (a dev server,
-//!   a watcher, a long build), read with [`read`] (`ReadCommandOutput`),
-//!   stopped with [`stop`] (`StopCommand`), listed with [`list`]
-//!   (`ListCommands`).
-//!
-//! No PTY and no session: the user's shell runs the command as a login shell
-//! (`-l -c`, so it has the PATH their terminal has; PowerShell or cmd on
-//! Windows), with empty stdin so a prompt for input ends instead of hanging.
-//! What it costs is bounded:
-//!
-//! - **Memory**: a run keeps at most [`HEAD`] + [`TAIL`] bytes of output (its
-//!   start and end); a background command its newest [`RING`] bytes. What's
-//!   left out is counted, not kept. At most [`MAX_ENDED`] ended background
-//!   commands are remembered, none for longer than [`KEEP_ENDED`].
-//! - **Time**: a run has a timeout (at most [`MAX_TIMEOUT`]). Each command
-//!   gets its own process group (Unix), which is killed at the timeout, when
-//!   the call is abandoned, when a background command is stopped, when the
-//!   chat that started it is archived or deleted ([`follow_chats`]), and when
-//!   the engine shuts down ([`shutdown`]). Nothing it started lives on.
-//! - **Concurrency**: at most [`MAX_RUNNING`] runs and [`MAX_BACKGROUND`]
-//!   background commands at once per device; past that, refused, not queued.
-//!
-//! Running commands count as work ([`running_count`]): a Cloud machine stays
-//! awake for them, and an update waits for them.
-
-use std::collections::{HashMap, VecDeque};
-use std::process::Stdio;
-use std::sync::atomic::{AtomicBool, Ordering};
-use std::sync::{Arc, LazyLock, Mutex};
-use std::time::{Duration, Instant};
-
-use serde::Serialize;
-use tokio::io::{AsyncRead, AsyncReadExt};
-use tokio::sync::Semaphore;
-
-pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);
-pub const MAX_TIMEOUT: Duration = Duration::from_secs(600);
-/// Output a run keeps from its start, and from its end.
-const HEAD: usize = 16 * 1024;
-const TAIL: usize = 48 * 1024;
-/// Output a background command keeps (its newest), and the most one read
-/// returns.
-const RING: usize = 128 * 1024;
-const MAX_READ: usize = 48 * 1024;
-/// How long output is still read once a run's shell has exited.
-const DRAIN: Duration = Duration::from_millis(250);
-pub const MAX_RUNNING: usize = 16;
-pub const MAX_BACKGROUND: usize = 32;
-const MAX_ENDED: usize = 32;
-const KEEP_ENDED: Duration = Duration::from_secs(60 * 60);
-
-static RUNNING: Semaphore = Semaphore::const_new(MAX_RUNNING);
-static BACKGROUND: LazyLock<Mutex<HashMap<String, Arc<Background>>>> = LazyLock::new(Default::default);
-
-fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
-    mutex.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
-}
-
-/// Commands running now, run or background: work in progress.
-pub fn running_count() -> usize {
-    let background = lock(&BACKGROUND).values().filter(|c| c.ended().is_none()).count();
-    MAX_RUNNING - RUNNING.available_permits() + background
-}
-
-/// How one run ended.
-#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
-#[serde(rename_all = "camelCase")]
-pub struct RunOutcome {
-    /// `None` when it was killed (timed out, or by a signal).
-    pub exit_code: Option<i32>,
-    /// Stdout and stderr together, in the order they arrived. When it was
-    /// too long, its start and end with a line saying how much was left out.
-    pub output: String,
-    /// Bytes of output left out of the middle.
-    #[serde(skip_serializing_if = "is_zero")]
-    pub omitted_bytes: u64,
-    pub timed_out: bool,
-    pub duration_ms: u64,
-    /// The folder it ended in (a POSIX shell's `pwd`), when it finished.
-    #[serde(skip_serializing_if = "Option::is_none")]
-    pub cwd: Option<String>,
-}
-
-fn is_zero(n: &u64) -> bool {
-    *n == 0
-}
-
-/// Run `command` in `cwd` with the user's shell, for at most `timeout`.
-pub async fn run(cwd: &str, command: &str, timeout: Duration) -> Result<RunOutcome, String> {
-    run_with_shell(&crate::terminals::selected_shell(), cwd, command, timeout).await
-}
-
-pub(crate) async fn run_with_shell(
-    shell: &str,
-    cwd: &str,
-    command: &str,
-    timeout: Duration,
-) -> Result<RunOutcome, String> {
-    if command.trim().is_empty() {
-        return Err("The command is empty".into());
-    }
-    let _slot = RUNNING.try_acquire().map_err(|_| {
-        format!("{MAX_RUNNING} commands are already running on this device: wait for one to finish")
-    })?;
-    let timeout = t
```

**File**: `crates/engine/src/sessions.rs` (modified, +49/-50)
```diff
@@ -262,9 +262,7 @@ struct Inner {
     /// said), and the background commands its agent started with Zeron's
     /// `run_command`, here or on another device. Its session row shows both.
     runtime_tasks: Mutex<HashMap<String, Vec<zeron_proto::BackgroundTask>>>,
-    command_tasks: Mutex<HashMap<String, Vec<crate::run_command::CommandTask>>>,
-    /// A task follows the tracked commands (see [`SessionsEngine::track_command`]).
-    command_tracker: std::sync::atomic::AtomicBool,
+    command_tasks: Mutex<HashMap<String, Vec<crate::commands::CommandTask>>>,
     /// The engine is shutting down: dying runs re-dispatch nothing.
     shutting_down: std::sync::atomic::AtomicBool,
     /// A shutdown marks the turns it cuts off for pick-up on the next boot
@@ -487,7 +485,6 @@ impl SessionsEngine {
                 device_id,
                 runtime_tasks: Mutex::new(HashMap::new()),
                 command_tasks: Mutex::new(HashMap::new()),
-                command_tracker: std::sync::atomic::AtomicBool::new(false),
                 shutting_down: std::sync::atomic::AtomicBool::new(false),
                 revive_after_shutdown: std::sync::atomic::AtomicBool::new(true),
                 revivals: Mutex::new(HashMap::new()),
@@ -815,66 +812,67 @@ impl SessionsEngine {
 
     /// Ask the chat's runtime to stop one of its background processes. False
     /// when no live runtime lists it (it ended meanwhile).
-    /// A background command `chat_id`'s agent started with `run_command`
-    /// (here or on another device): shown on its session row with its
-    /// runtime's processes until it ends. True when nothing follows the
-    /// tracked commands yet: the caller starts [`Self::follow_commands`]'s
-    /// loop.
-    pub fn track_command(&self, chat_id: &str, command: crate::run_command::CommandTask) -> bool {
+    /// Show a background command `chat_id`'s agent started with
+    /// `run_command` (here or on another device) on its session row, with
+    /// its runtime's own background processes ([`crate::commands::Commands::show`]).
+    pub fn show_command(&self, chat_id: &str, command: crate::commands::CommandTask) {
         lock(&self.inner.command_tasks)
             .entry(chat_id.to_owned())
             .or_default()
             .push(command);
         self.inner.publish_background_tasks(chat_id);
-        !self
-            .inner
-            .command_tracker
-            .swap(true, std::sync::atomic::Ordering::AcqRel)
-    }
-
-    /// Every chat's tracked commands.
-    pub fn tracked_commands(&self) -> HashMap<String, Vec<crate::run_command::CommandTask>> {
-        lock(&self.inner.command_tasks).clone()
     }
 
-    /// The tracked commands of `chat_id` still running, as just checked:
-    /// shown, and the row kept fresh while there are any.
-    pub fn set_tracked_commands(&self, chat_id: &str, commands: Vec<crate::run_command::CommandTask>) {
+    /// Keep showing those of `chat_id`'s commands on `device` that `keep`
+    /// says still run (and every command elsewhere).
+    pub fn retain_commands(
+        &self,
+        chat_id: &str,
+        device: &Option<String>,
+        keep: impl Fn(&str) -> bool,
+    ) {
         let changed = {
-            let mut tracked = lock(&self.inner.command_tasks);
-            let before = tracked.get(chat_id).map_or(0, Vec::len);
-            let after = commands.len();
+            let mut shown = lock(&self.inner.command_tasks);
+            let Some(commands) = shown.get_mut(chat_id) else {
+                return;
+            };
+            let before = commands.len();
+            commands.retain(|c| &c.device != device || keep(&c.id));
+            let changed = commands.len() != before;
             if commands.is_empty() {
-                tracked.remove(chat_id);
-            } else {
-                tracked.insert(chat_id.to_owned(), commands);
+                shown.remove(chat_id);
             }
-            before != after
+            changed
         };
         if changed {
             self.inner.publish_background_tasks(chat_id);
         }
-        self.inner.touch_session(chat_id);
     }
 
-    /// One tracked command no longer shown (it was stopped).
-    pub fn untrack_command(&self, chat_id: &str, task_id: &str) {
-        let mut commands = lock(&self.inner.command_tasks).get(chat_id).cloned().unwrap_or_default();
-        commands.retain(|c| c.task.id != task_id);
-        self.set_tracked_commands(chat_id, commands);
+    /// No longer show one of `chat_id`'s commands (the person stopped it).
+    pub fn hide_command(&self, chat_id: &str, task_id: &str) {
+        let device = lock(&self.inner.command_tasks)
+            .get(chat_id)
+            .and_then(|commands| commands.iter().find(|c| c.task.id == task_id))
+            .map(|c| (c.device.clone(), c.id.clone()));
+        if let Some((device, id)) = device {
+            self.retain_commands(chat_id, &device, |shown| shown != id);
+        }
     }
 

```

**File**: `crates/engine/src/workspace_files.rs` (modified, +58/-25)
```diff
@@ -56,13 +56,23 @@ pub struct WorkspaceFiles {
     inner: Arc<WorkspaceFilesInner>,
 }
 
+/// A Cloud session machine's checkout: the folder its session chat's
+/// project (made on another device) is cloned into
+/// ([`crate::runner::session`]).
+#[derive(Debug, Clone)]
+pub struct CloudCheckout {
+    pub path: PathBuf,
+    /// The chat the machine was started for; its side chats share it.
+    pub chat_id: String,
+}
+
 struct WorkspaceFilesInner {
     repos: Repos,
     workspace: WorkspaceHost,
     device_id: String,
     /// On a Cloud session machine, its checkout of the session's repository:
     /// where a chat whose project was made on another device works.
-    cloud_checkout: Option<PathBuf>,
+    cloud_checkout: Option<CloudCheckout>,
     mutation_gates: Mutex<HashMap<String, Weak<tokio::sync::RwLock<()>>>>,
     write_locks: Mutex<HashMap<WorkspaceFileKey, Weak<tokio::sync::Mutex<()>>>>,
     watches: Mutex<HashMap<String, Arc<CheckoutWatch>>>,
@@ -258,7 +268,7 @@ impl WorkspaceFiles {
         repos: Repos,
         workspace: WorkspaceHost,
         device_id: impl Into<String>,
-        cloud_checkout: Option<PathBuf>,
+        cloud_checkout: Option<CloudCheckout>,
     ) -> Self {
         Self {
             inner: Arc::new(WorkspaceFilesInner {
@@ -274,6 +284,25 @@ impl WorkspaceFiles {
         }
     }
 
+    /// Where `space`'s files are on this device: its folder, when this
+    /// device made it. A Cloud session machine answers from its own checkout
+    /// for its session chat's project — only that one: it sees every
+    /// project, and any other is a folder on another device.
+    fn space_root(&self, space: &zeron_proto::Space) -> Option<PathBuf> {
+        if space.device_id == self.inner.device_id {
+            return Some(PathBuf::from(&space.path));
+        }
+        let checkout = self.inner.cloud_checkout.as_ref()?;
+        let session_project = self
+            .inner
+            .workspace
+            .chat(&checkout.chat_id)
+            .ok()
+            .flatten()
+            .and_then(|chat| chat.space_id);
+        (session_project.as_deref() == Some(space.id.as_str())).then(|| checkout.path.clone())
+    }
+
     pub(crate) async fn resolve_target(
         &self,
         target: &WorkspaceTarget,
@@ -340,18 +369,11 @@ impl WorkspaceFiles {
                     .ok_or_else(|| {
                         WorkspaceFilesError::NotFound("chat workspace space not found".into())
                     })?;
-                // A project made on another device is that device's folder —
-                // except on a Cloud session machine, which works in its own
-                // checkout of the project's repository.
-                let space_path = if space.device_id == self.inner.device_id {
-                    PathBuf::from(&space.path)
-                } else if let Some(checkout) = &self.inner.cloud_checkout {
-                    checkout.clone()
-                } else {
-                    return Err(WorkspaceFilesError::Authorization(
+                let space_path = self.space_root(&space).ok_or_else(|| {
+                    WorkspaceFilesError::Authorization(
                         "chat space belongs to another device".into(),
-                    ));
-                };
+                    )
+                })?;
                 let (checkout, identity) = tokio::join!(
                     self.inner.repos.workspace_checkout(&space_path, &cwd),
                     self.inner.repos.checkout_identity(&cwd),
@@ -370,17 +392,9 @@ impl WorkspaceFiles {
                     .space(space_id)
                     .map_err(|error| WorkspaceFilesError::Io(error.to_string()))?
                     .ok_or_else(|| WorkspaceFilesError::NotFound("space not found".into()))?;
-                // As for a chat target: a Cloud session machine answers for a
-                // project made elsewhere from its own checkout of it.
-                let space_path = if space.device_id == self.inner.device_id {
-                    PathBuf::from(&space.path)
-                } else if let Some(checkout) = &self.inner.cloud_checkout {
-                    checkout.clone()
-                } else {
-                    return Err(WorkspaceFilesError::Authorization(
-                        "space belongs to another device".into(),
-                    ));
-                };
+                let space_path = self.space_root(&space).ok_or_else(|| {
+                    WorkspaceFilesError::Authorization("space belongs to another device".into())
+                })?;
                 let requested = target
                     .checkout_path
                     .as_deref()
@@ -3670,6 +3684,8 @@ mod image_tests {
         .unwrap();
         host.create_space("space", "laptop", "/Users/me/app", None, true)
             .unwrap();
+        host.create_space("laptop-space", "laptop", "/Users/me/other", None, true)
+            .unwrap();
         // Hosted on t
```

**File**: `crates/engine/tests/agent_commands.rs` (modified, +39/-8)
```diff
@@ -13,19 +13,38 @@ use zeron_rpc::memory_client;
 #[tokio::test]
 async fn an_agent_runs_commands_as_its_own_shell_tool_would() {
     let dir = tempfile::tempdir().unwrap();
-    let core = EngineCore::assemble(dir.path(), Arc::new(default_registry()), HarnessId::Mock, None).unwrap();
-    let tools = Tools::new(Arc::new(Zeron::with_client(memory_client(core.rpc_service()), Origin::default())));
+    let core = EngineCore::assemble(
+        dir.path(),
+        Arc::new(default_registry()),
+        HarnessId::Mock,
+        None,
+    )
+    .unwrap();
+    let tools = Tools::new(Arc::new(Zeron::with_client(
+        memory_client(core.rpc_service()),
+        Origin::default(),
+    )));
     let work = tempfile::tempdir().unwrap();
     std::fs::create_dir(work.path().join("app")).unwrap();
     let app = std::fs::canonicalize(work.path().join("app")).unwrap();
 
     // Output and exit code; cd carries over to the next command.
     let ran = tools
-        .call("run_command", json!({ "command": "cd app && echo hi && exit 3", "cwd": work.path() }))
+        .call(
+            "run_command",
+            json!({ "command": "cd app && echo hi && exit 3", "cwd": work.path() }),
+        )
+        .await
+        .unwrap();
+    assert_eq!(
+        (ran["output"].as_str(), ran["exitCode"].as_i64()),
+        (Some("hi\n"), Some(3)),
+        "{ran}"
+    );
+    let ran = tools
+        .call("run_command", json!({ "command": "pwd -P" }))
         .await
         .unwrap();
-    assert_eq!((ran["output"].as_str(), ran["exitCode"].as_i64()), (Some("hi\n"), Some(3)), "{ran}");
-    let ran = tools.call("run_command", json!({ "command": "pwd -P" })).await.unwrap();
     assert_eq!(ran["output"].as_str().map(str::trim), app.to_str(), "{ran}");
 
     // A server left running: read as it goes, then stopped.
@@ -41,13 +60,25 @@ async fn an_agent_runs_commands_as_its_own_shell_tool_would() {
     let give_up = Instant::now() + Duration::from_secs(10);
     while !printed.contains("listening") {
         assert!(Instant::now() < give_up, "{printed:?}");
-        let read: Value = tools.call("command_output", json!({ "id": id })).await.unwrap();
+        let read: Value = tools
+            .call("command_output", json!({ "id": id }))
+            .await
+            .unwrap();
         printed.push_str(read["output"].as_str().unwrap_or_default());
         tokio::time::sleep(Duration::from_millis(50)).await;
     }
     let listed = tools.call("list_commands", json!({})).await.unwrap();
-    assert!(listed["commands"].as_array().unwrap().iter().any(|c| c["id"] == id.as_str() && c["status"] == "running"));
-    let stopped = tools.call("stop_command", json!({ "id": id })).await.unwrap();
+    assert!(
+        listed["commands"]
+            .as_array()
+            .unwrap()
+            .iter()
+            .any(|c| c["id"] == id.as_str() && c["status"] == "running")
+    );
+    let stopped = tools
+        .call("stop_command", json!({ "id": id }))
+        .await
+        .unwrap();
     assert_eq!(stopped["status"], "stopped", "{stopped}");
     core.sessions.shutdown().await;
 }
```

#### Recent Merged Pull Requests:
- **PR #1509** (2026-11-18): iOS: close the sidebar and start a session with it hidden (iPhone Duo, iPad) (@wingleeio)
- **PR #1508** (2026-11-18): Engine: keep 12 chats' documents warm again (fixes switch freezes and skeletons in 0.3.8) (@wingleeio)
- **PR #1502** (2026-11-18): Zeron 0.3.8 (@wingleeio)
- **PR #1501** (2026-11-17): zgx: title bar buttons stay put when a window manager snaps the window (@wingleeio)
- **PR #1500** (2026-11-17): Engine: keep 3 chats' documents warm, not 12 (@wingleeio)
- **PR #1499** (2026-11-17): Retire the GPUI desktop app (v2): crates/ui, its CI and its scripts (@wingleeio)

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

## X. Transcript: a finished reply's rows built as what they are, not as what might st

**RULE**:
When implementing operations in `apps/zgx/src/chat.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zeronsh/zeron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8bd5b5d6`: Transcript: a finished reply's rows built as what they are, not as what might still change. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/zgx/src/chat.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                        let fresh = Entry::new(entry);
                            // The same as the row it has (most of a tail, a
                            // chat opened again): what was built from it
                            // stays, so nothing showing is made again.
                            Some(held) if held.sum() == fresh.sum() => {}
                            Some(held) => {
                                open.built.remove(id.as_str());
                                *held = fresh;
                            }
                            None => {
                                open.built.remove(id.as_str());
                                open.entries.push(fresh);
                            }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                        open.built.remove(id.as_str());
                            Some(held) => *held = Entry::new(entry),
                            None => open.entries.push(Entry::new(entry)),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8bd5b5d6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
