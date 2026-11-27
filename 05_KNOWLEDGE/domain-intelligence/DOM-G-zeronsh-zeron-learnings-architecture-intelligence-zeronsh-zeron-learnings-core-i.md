# Domain G — Architecture Intelligence: Architecture Intelligence: zeronsh-zeron-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zeronsh-zeron-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T17:42:05.710Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zeronsh-zeron-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zeronsh-zeron-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T17:42:05.710Z`  
> **Learning ID**: `LEARN-EVO-zeronsh-zeron-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), E (Creative Intelligence), F (Design Intelligence), K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zeronsh-zeron-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zeronsh-zeron-learnings.md`  
> **Source**: github ([https://github.com/zeronsh/zeron](https://github.com/zeronsh/zeron))  
> **Source Version**: `9d1c0fc3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-27T17:41:48.150Z  
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
> **Harvest Timestamp**: 2026-11-27T17:41:47.972Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zeronsh/zeron`
- **Description**: A native control plane for Claude Code, Codex, Cursor, Devin and other coding agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3771 stars

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

### Incident Patch 1: `a04a322e` (2026-11-14)
**Commit Message**: zgx dictation: a processor without AVX2 is told so, not crashed

zeron_voice::cpu_supported checks AVX2, FMA, F16C and BMI2 at run time (the
models are built for them); without, no model loads, start and download
refuse with why, and Settings → Voice says so in place of a Download.

**File**: `apps/zgx/src/dictation.rs` (modified, +7/-1)
```diff
@@ -176,10 +176,13 @@ impl Service {
                     "slow":m.cpu_slow && cfg!(not(target_os = "macos"))})
             })
             .collect();
-        Ok(json!({ "models": list }))
+        Ok(json!({ "models": list, "supported": zeron_voice::cpu_supported() }))
     }
     fn start(&mut self, args: &Json) -> Result<Json, String> {
         let dir = self.dir(args)?;
+        if !zeron_voice::cpu_supported() {
+            return Err(zeron_voice::CPU_UNSUPPORTED.into());
+        }
         self.idle()?;
         // (The page says what to do about it: no words for the composer.)
         if !zeron_voice::installed(&dir) {
@@ -199,6 +202,9 @@ impl Service {
     }
     fn download(&mut self, args: &Json) -> Result<Json, String> {
         let dir = self.dir(args)?;
+        if !zeron_voice::cpu_supported() {
+            return Err(zeron_voice::CPU_UNSUPPORTED.into());
+        }
         let total = zeron_voice::model_for(&dir).map_or(0, |m| m.size());
         self.idle()?;
         if DOWNLOADING.swap(true, Ordering::AcqRel) {
```

**File**: `apps/zgx/ui/locales/en.json` (modified, +1/-0)
```diff
@@ -2414,6 +2414,7 @@
       "model": {
         "title": "Speech models",
         "about": "{size} · {n, plural, one {# language} other {# languages}}",
+        "unsupported": "This computer's processor can't run speech models (they need AVX2).",
         "about_slow": "{size} · {n, plural, one {# language} other {# languages}} · Slower on this computer",
         "mb": "{n} MB",
         "gb": "{n} GB",
```

**File**: `apps/zgx/ui/locales/zh-Hans.json` (modified, +1/-0)
```diff
@@ -2414,6 +2414,7 @@
       "model": {
         "title": "语音模型",
         "about": "{size} · {n} 种语言",
+        "unsupported": "这台电脑的处理器无法运行语音模型（需要 AVX2）。",
         "about_slow": "{size} · {n} 种语言 · 在这台电脑上较慢",
         "mb": "{n} MB",
         "gb": "{n} GB",
```

**File**: `apps/zgx/ui/screens/settings/voice.luau` (modified, +12/-2)
```diff
@@ -28,6 +28,8 @@ search.index(M.ID, ui.t("settings.voice.title"), ui.t("settings.voice.terms"), {
 -- The models on offer, as the host lists them: { id, name, size,
 -- languages, installed }, the default first.
 local models = ui.state("settings_voice_models", {} :: { any })
+-- This computer's processor runs them (x86-64 without AVX2 doesn't).
+local supported = ui.state("settings_voice_supported", true)
 -- The chosen one (its first when the saved one isn't offered).
 local function chosen(): any?
 	local list, want = models:get(), prefs.dictation_model:get()
@@ -49,7 +51,10 @@ local on = ui.state("settings_voice_on", false)
 
 local function refresh()
 	host.call("dictation.call", { op = "status" }):after(function(s: any)
-		models:set(s.models or {})
+		ui.batch(function()
+			models:set(s.models or {})
+			supported:set(s.supported ~= false)
+		end)
 	end, function() end)
 	host.call("dictation.call", { op = "inputs" }):after(function(list: any)
 		inputs:set(list)
@@ -167,6 +172,9 @@ end
 -- A model's line: its size, how many languages it speaks, and whether it's
 -- slow here (on the CPU).
 local function about(m: any): string
+	if not supported:get() then
+		return ui.t("settings.voice.model.unsupported"):get()
+	end
 	return ui.t(if m.slow then "settings.voice.model.about_slow" else "settings.voice.model.about", { size = weight(m.size), n = #(m.languages or {}) }):get()
 end
 -- Download or Remove `m` (a function: the model as it is now).
@@ -180,7 +188,7 @@ local function model_action(m: () -> any?): Node
 			ui.t("settings.voice.model.remove"), tone = "secondary", size = "sm",
 			on_click = function() remove(m().id) end,
 		}),
-		ui.show(function(): boolean return m() ~= nil and not here() end, ds.Button {
+		ui.show(function(): boolean return m() ~= nil and not here() and supported:get() end, ds.Button {
 			ui.t("settings.voice.model.download"), tone = "secondary", size = "sm", disabled = downloading,
 			on_click = function() download(m().id) end,
 		}),
@@ -271,6 +279,8 @@ function M.view(): Node
 						local s = dictation.state:get()
 						if s.phase == "downloading" then
 							return ui.t("settings.voice.dictation.downloading", { done = weight(s.bytes or 0), total = weight(s.total or 0) }):get()
+						elseif not supported:get() then
+							return ui.t("settings.voice.model.unsupported"):get()
 						elseif not installed:get() then
 							return ui.t("settings.voice.dictation.needs_download", { total = weight(size:get()) }):get()
 						end
```

**File**: `apps/zgx/ui/settings_stub.luau` (modified, +8/-2)
```diff
@@ -23,6 +23,7 @@ local auth = require("@account/auth")
 local M = {}
 
 local calls = ui.state("settings_stub_calls", {} :: { string })
+local voice = ui.state("settings_stub_voice", { cohere = "absent", supported = true } :: any)
 local refuse = ui.state("settings_stub_refuse", false)
 local role = ui.state("settings_stub_role", "admin")
 local about_next = ui.state("settings_stub_about_next", "ok")
@@ -144,12 +145,17 @@ local answers: { [string]: (arg: any) -> any } = {
 	["account.me"] = function()
 		return settled(table.clone(me))
 	end,
+	-- Settings → Voice: Ultra downloaded; Cohere as `settings_stub_voice`
+	-- says ("absent", "partial": some files, "installed"), and whether this
+	-- processor runs them (`supported`).
 	["dictation.call"] = function(arg: any)
+		local v = voice:peek()
 		return settled(if arg.op == "status"
 			then {
+				supported = v.supported,
 				models = {
-					{ id = "parakeet-ultra-q8", name = "Parakeet Ultra", size = 740363168, memory = 1150000000, installed = true, languages = table.create(25, "") },
-					{ id = "cohere-transcribe-q5", name = "Cohere Transcribe", size = 1796963840, memory = 2800000000, installed = false, slow = true, languages = table.create(14, "") },
+					{ id = "parakeet-ultra-q8", name = "Parakeet Ultra", size = 740363168, memory = 1150000000, installed = true, present = true, languages = table.create(25, "") },
+					{ id = "cohere-transcribe-q5", name = "Cohere Transcribe", size = 1796963840, memory = 2800000000, installed = v.cohere == "installed", present = v.cohere ~= "absent", slow = true, languages = table.create(14, "") },
 				},
 			}
 			elseif arg.op == "inputs" then {}
```

**File**: `apps/zgx/ui/tests/voice_models.test.luau` (modified, +9/-1)
```diff
@@ -6,10 +6,11 @@
 
 local PAGE = "#settings-page"
 
-local function voice(): any
+local function voice(stub: any?): any
 	local app = mount("shell_fixture.luau")
 	app:resize(1200, 900)
 	app:frames(30)
+	if stub then app:set_state("settings_stub_voice", stub) end
 	app:set_state("settings_dictation", true)
 	app:command("shell.settings")
 	app:frames(20)
@@ -45,3 +46,10 @@ test("removing the model in use turns dictation off, nothing in use", function()
 	expect(app:count(`{PAGE} >> role:button "Download"`)).to_be(2)
 	expect(app:error()).to_be(nil)
 end)
+
+test("a processor that can't run them says so and offers no download", function()
+	local app = voice({ cohere = "absent", supported = false })
+	expect(shows(app, "can't run speech models")).to_be(true)
+	expect(app:has(`{PAGE} >> role:button "Download"`)).to_be(false)
+	expect(app:error()).to_be(nil)
+end)
```

**File**: `crates/voice/src/lib.rs` (modified, +21/-0)
```diff
@@ -77,6 +77,24 @@ pub fn download(dir: &Path, cancel: &AtomicBool, progress: impl FnMut(u64)) -> R
         .download(dir, cancel, progress)
 }
 
+/// Whether this computer's processor runs the models: on x86-64 they're
+/// built for AVX2, FMA, F16C and BMI2 (most since 2013, not every Celeron or
+/// Pentium: Gemini Lake and Jasper Lake have none of them), and would crash
+/// the app without them.
+pub fn cpu_supported() -> bool {
+    #[cfg(target_arch = "x86_64")]
+    {
+        std::arch::is_x86_feature_detected!("avx2")
+            && std::arch::is_x86_feature_detected!("fma")
+            && std::arch::is_x86_feature_detected!("f16c")
+            && std::arch::is_x86_feature_detected!("bmi2")
+    }
+    #[cfg(not(target_arch = "x86_64"))]
+    true
+}
+pub const CPU_UNSUPPORTED: &str =
+    "This computer's processor can't run speech models (they need AVX2).";
+
 /// Models Zeron no longer offers, by folder.
 const RETIRED: &[&str] = &["parakeet-tdt-0.6b-v3-int8"];
 /// Frees what retired models take in `models` (Parakeet v3: 670 MB). Whoever
@@ -155,6 +173,9 @@ pub struct Recognizer {
 }
 impl Recognizer {
     pub fn load(dir: &Path) -> Result<Self> {
+        if !cpu_supported() {
+            bail!(CPU_UNSUPPORTED)
+        }
         let m = model_for(dir).context("No such speech model")?;
         // Hashed once, at download: a load reads only what it needs.
         if !m.installed(dir) {
```

---

### Incident Patch 2: `f2b36135` (2026-11-14)
**Commit Message**: zeron-voice: a folder is its model's or none, and every build is portable

The old app keeps Ultra in Ultra's folder (models/<id>), as zgx does: no
more downloading it into v3's, which zgx clears at launch. An unknown
folder or model id is an error, never the default's (Remove could have
deleted Ultra). TRANSCRIBE_CMAKE_ARGS moves to the repository's own cargo
config, so a build from the root is as portable as apps/zgx's.

**File**: `.cargo/config.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Read by every build in this repository, apps/zgx's included (Cargo reads the
+# parents' config too).
+[env]
+# transcribe.cpp (dictation, crates/voice) built for x86-64 CPUs with AVX2 and
+# FMA, never for the machine that builds it (ggml's default, `-march=native`).
+# 2.8× faster than its plain-SSE floor; CPUs without them are told so before
+# a model loads (`zeron_voice::cpu_supported`). Apple silicon and arm64 Linux
+# ignore these.
+TRANSCRIBE_CMAKE_ARGS = "-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_BMI2=ON"
```

**File**: `apps/zgx/.cargo/config.toml` (modified, +0/-4)
```diff
@@ -13,7 +13,3 @@ LUAU_CXXFLAGS = "-DNDEBUG"
 # sizes all its own, so one block of 50 KiB left in such a page holds up to a
 # megabyte. Each now has a page of its own, freed with it.
 CFLAGS_aarch64_apple_darwin = "-DMI_ARENA_SLICE_SHIFT=14 -DMI_ENABLE_LARGE_PAGES=0"
-# transcribe.cpp (dictation) for any x86-64 since 2013 (AVX2, FMA), not for the
-# machine that builds it: 2.8× faster than its plain-SSE floor. Apple silicon
-# and arm64 Linux ignore these.
-TRANSCRIBE_CMAKE_ARGS = "-DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DGGML_BMI2=ON"
```

**File**: `apps/zgx/src/dictation.rs` (modified, +12/-5)
```diff
@@ -144,12 +144,19 @@ impl Service {
             self.state["phase"] = json!("finalizing");
         }
     }
-    /// The folder of the model `args` names (`model`, an id), else the default's.
+    /// The folder of the model `args` names (`model`, an id; none or empty:
+    /// the default). One it doesn't offer is an error, never another's folder.
     fn dir(&self, args: &Json) -> Result<PathBuf, String> {
-        let models = zeron_voice::models();
-        let id = args["model"].as_str().filter(|id| models.iter().any(|m| m.id == *id));
         let models_dir = self.models.as_ref().ok_or("Zeron's data folder isn't known")?;
-        Ok(models_dir.join(id.unwrap_or(&models[0].id)))
+        let id = match args["model"].as_str().filter(|id| !id.is_empty()) {
+            Some(id) => zeron_voice::models()
+                .into_iter()
+                .find(|m| m.id == id)
+                .ok_or("No such speech model")?
+                .id,
+            None => zeron_voice::manifest().id,
+        };
+        Ok(models_dir.join(id))
     }
     fn idle(&self) -> Result<(), String> {
         if self.needs_poll() || zeron_voice::busy() || DOWNLOADING.load(Ordering::Acquire) {
@@ -192,7 +199,7 @@ impl Service {
     }
     fn download(&mut self, args: &Json) -> Result<Json, String> {
         let dir = self.dir(args)?;
-        let total = zeron_voice::model_for(&dir).size();
+        let total = zeron_voice::model_for(&dir).map_or(0, |m| m.size());
         self.idle()?;
         if DOWNLOADING.swap(true, Ordering::AcqRel) {
             return Err("Another window is downloading the model".into());
```

**File**: `crates/voice/src/lib.rs` (modified, +13/-18)
```diff
@@ -60,24 +60,21 @@ pub fn manifest() -> Manifest {
     models().swap_remove(0)
 }
 /// The model a folder holds: the one its name is the id of (each lives in
-/// `<data>/models/<id>`), else the default.
-pub fn model_for(dir: &Path) -> Manifest {
-    let id = dir.file_name().and_then(|n| n.to_str());
-    let mut all = models();
-    let at = all
-        .iter()
-        .position(|m| Some(m.id.as_str()) == id)
-        .unwrap_or(0);
-    all.swap_remove(at)
+/// `<data>/models/<id>`). None for any other folder.
+pub fn model_for(dir: &Path) -> Option<Manifest> {
+    let id = dir.file_name().and_then(|n| n.to_str())?;
+    models().into_iter().find(|m| m.id == id)
 }
 pub fn download_size() -> u64 {
     manifest().size()
 }
 pub fn installed(dir: &Path) -> bool {
-    model_for(dir).installed(dir)
+    model_for(dir).is_some_and(|m| m.installed(dir))
 }
 pub fn download(dir: &Path, cancel: &AtomicBool, progress: impl FnMut(u64)) -> Result<()> {
-    model_for(dir).download(dir, cancel, progress)
+    model_for(dir)
+        .context("No such speech model")?
+        .download(dir, cancel, progress)
 }
 
 /// Models Zeron no longer offers, by folder.
@@ -158,7 +155,7 @@ pub struct Recognizer {
 }
 impl Recognizer {
     pub fn load(dir: &Path) -> Result<Self> {
-        let m = model_for(dir);
+        let m = model_for(dir).context("No such speech model")?;
         // Hashed once, at download: a load reads only what it needs.
         if !m.installed(dir) {
             bail!("Model is damaged. Remove it in Settings and download again.")
@@ -894,13 +891,11 @@ mod tests {
         assert_eq!(manifest().name, "Parakeet Ultra");
         assert_eq!(download_size(), 740363168);
         let dir = Path::new("models/cohere-transcribe-q5");
-        assert_eq!(model_for(dir).name, "Cohere Transcribe");
-        assert_eq!(
-            model_for(Path::new("models/elsewhere")).name,
-            "Parakeet Ultra"
-        );
+        assert_eq!(model_for(dir).unwrap().name, "Cohere Transcribe");
+        // Any other folder is no model's, not the default's.
+        assert!(model_for(Path::new("models/parakeet-tdt-0.6b-v3-int8")).is_none());
         // A model that can't tell the language hears the person's own.
-        let cohere = model_for(dir).languages;
+        let cohere = model_for(dir).unwrap().languages;
         let locales = ["fr-FR", "en_GB.UTF-8", "fr-CA", "uk-UA"].map(String::from);
         assert_eq!(spoken(locales, &cohere), ["fr", "en"]);
         assert_eq!(spoken(["uk-UA".to_string()], &cohere), ["en"]);
```

#### Recent Merged Pull Requests:
- **PR #1630** (closed): omp harness: merge main, and work with omp 19 (catalog keyed by login) (@andreiverdes)
- **PR #1627** (closed): Add provider-native cloud execution (@Yorizel)
- **PR #1618** (2026-11-27): iOS: one … on iPhone Duo's vertical bar (@zeronsh[bot])
- **PR #1617** (2026-11-25): Landing: the Pixel Walker walks the hero window's top bar, and the hero drops its "What's new" badge (@SinaKhalili)
- **PR #1616** (2026-11-25): Zeron v2: closed sidebar leaves no 5pt sliver on the new chat page (@zeronsh[bot])
- **PR #1615** (2026-11-25): Landing: the working ring turns on the compositor, and the glass drops its blur (@SinaKhalili)

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

## X. zgx dictation: a processor without AVX2 is told so, not crashed

**RULE**:
When implementing operations in `apps/zgx/src/dictation.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zeronsh/zeron. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a04a322e`: zgx dictation: a processor without AVX2 is told so, not crashed. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/zgx/src/dictation.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        Ok(json!({ "models": list, "supported": zeron_voice::cpu_supported() }))
        if !zeron_voice::cpu_supported() {
            return Err(zeron_voice::CPU_UNSUPPORTED.into());
        }
        if !zeron_voice::cpu_supported() {
            return Err(zeron_voice::CPU_UNSUPPORTED.into());
        }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        Ok(json!({ "models": list }))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a04a322e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
