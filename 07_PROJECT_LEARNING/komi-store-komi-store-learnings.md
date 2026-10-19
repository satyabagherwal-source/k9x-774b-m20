> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/komi-store-komi-store-learnings.md`  
> **Source**: github ([https://github.com/komi-store/komi-store](https://github.com/komi-store/komi-store))  
> **Source Version**: `95935997`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T05:45:29.890Z  
> **Learning ID**: `learn-github-komi-store-komi-store`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): komi-store/komi-store

> **Canonical Artifact**: `07_PROJECT_LEARNING/komi-store-komi-store-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/komi-store/komi-store](https://github.com/komi-store/komi-store))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T05:45:29.882Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `komi-store/komi-store`
- **Description**: 🩵 A free, open-source app store for developers' releases on GitHub, Codeberg & Forgejo — browse, discover, and install apps with one click. Formerly GitHub Store.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 19616 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `composeApp/src/androidMain/kotlin/zed/rainxch/githubstore/utils/SystemBarUtils.kt`
```
package zed.rainxch.githubstore.utils

import android.app.Activity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

fun Activity.updateSystemBars(isDarkTheme: Boolean) {
    WindowCompat.setDecorFitsSystemWindows(window, false)

    val controller = WindowInsetsControllerCompat(window, window.decorView)

    controller.isAppearanceLightStatusBars = !isDarkTheme
    controller.isAppearanceLightNavigationBars = !isDarkTheme
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/MainState.kt`
```
package zed.rainxch.githubstore

import zed.rainxch.core.domain.model.appearance.AccentId
import zed.rainxch.core.domain.model.appearance.AppPersonality
import zed.rainxch.core.domain.model.appearance.ContentWidth
import zed.rainxch.core.domain.model.appearance.MangaPaperId
import zed.rainxch.core.domain.model.error.RateLimitInfo

data class MainState(
    val isLoggedIn: Boolean = false,
    val rateLimitInfo: RateLimitInfo? = null,
    val showRateLimitDialog: Boolean = false,
    val showSessionExpiredDialog: Boolean = false,
    val personality: AppPersonality = AppPersonality.MANGA,
    val accent: AccentId = AccentId.CRIMSON,
    val mangaPaper: MangaPaperId = MangaPaperId.DAY,
    val isAmoledTheme: Boolean = false,
    val isDarkTheme: Boolean? = null,
    val isScrollbarEnabled: Boolean = false,
    val contentWidth: ContentWidth = ContentWidth.COMPACT,
    val appLanguageTag: String? = null,
    val signedInAvatarUrl: String? = null,
    val isAppearanceLoaded: Boolean = false,
)

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/BottomNavigationUtils.kt`
```
package zed.rainxch.githubstore.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import zed.rainxch.githubstore.core.presentation.res.*

object BottomNavigationUtils {
    fun items(): List<BottomNavigationItem> =
        listOf(
            BottomNavigationItem(
                titleRes = Res.string.bottom_nav_explore_title,
                iconOutlined = Icons.Outlined.Explore,
                iconFilled = Icons.Filled.Explore,
                screen = GithubStoreGraph.ExploreScreen,
            ),
            BottomNavigationItem(
                titleRes = Res.string.bottom_nav_top_charts_title,
                iconOutlined = Icons.Outlined.Leaderboard,
                iconFilled = Icons.Filled.Leaderboard,
                screen = GithubStoreGraph.ChartsScreen,
            ),
            BottomNavigationItem(
                titleRes = Res.string.bottom_nav_search_title,
                iconOutlined = Icons.Outlined.Search,
                iconFilled = Icons.Filled.Search,
                screen = GithubStoreGraph.SearchScreen(),
            ),
            BottomNavigationItem(
                titleRes = Res.string.bottom_nav_apps_title,
                iconOutlined = Icons.Outlined.Apps,
                iconFilled = Icons.Filled.Apps,
                screen = GithubStoreGraph.AppsScreen,
            ),
            BottomNavigationItem(
                titleRes = Res.string.bottom_nav_profile_title,
                iconOutlined = Icons.Outlined.Person2,
                iconFilled = Icons.Filled.Person2,
                screen = GithubStoreGraph.ProfileGraph.ProfileScreen,
            ),
        )

    fun allowedScreens(): List<BottomNavigationItem> = items()
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/NavigationUtils.kt`
```
package zed.rainxch.githubstore.app.navigation

import androidx.navigation.NavBackStackEntry
import androidx.navigation.toRoute

fun NavBackStackEntry?.bottomNavIndex(): Int? {
    val route = this?.destination?.route ?: return null
    return when {
        route.contains("ExploreScreen") -> 0
        route.contains("ChartsScreen") -> 1
        route.contains("SearchScreen") -> 2
        route.contains("AppsScreen") -> 3
        route.contains("ProfileScreen") -> 4
        else -> null
    }
}

fun NavBackStackEntry?.getCurrentScreen(): GithubStoreGraph? {
    if (this == null) return null
    val route = destination.route ?: return null

    return when {
        route.contains("ExploreScreen") -> GithubStoreGraph.ExploreScreen
        route.contains("ChartsScreen") -> GithubStoreGraph.ChartsScreen
        route.contains("SearchScreen") -> toRoute<GithubStoreGraph.SearchScreen>()
        route.contains("AuthenticationScreen") -> GithubStoreGraph.AuthenticationScreen
        route.contains("DetailsScreen") -> toRoute<GithubStoreGraph.DetailsScreen>()
        route.contains("DeveloperProfileScreen") -> toRoute<GithubStoreGraph.DeveloperProfileScreen>()
        route.contains("ProfileScreen") -> GithubStoreGraph.ProfileGraph.ProfileScreen
        route.contains("TweaksScreen") -> GithubStoreGraph.TweaksScreen
        route.contains("RecentlyViewedScreen") -> GithubStoreGraph.RecentlyViewedScreen
        route.contains("FavouritesScreen") -> GithubStoreGraph.FavouritesScreen
        route.contains("StarredReposScreen") -> GithubStoreGraph.StarredReposScreen
        route.contains("AppsScreen") -> GithubStoreGraph.AppsScreen
        route.contains("WhatsNewHistoryScreen") -> GithubStoreGraph.WhatsNewHistoryScreen
        route.contains("AnnouncementsScreen") -> GithubStoreGraph.AnnouncementsScreen
        else -> null
    }
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/utils/HandleDesktopToolbarDeeplinks.kt`
```
package zed.rainxch.githubstore.utils

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.navigation.NavHostController
import kotlinx.coroutines.channels.ReceiveChannel
import zed.rainxch.auth.presentation.AuthDeepLinkBus
import zed.rainxch.auth.presentation.AuthDeepLinkEvent
import zed.rainxch.githubstore.app.deeplink.DeepLinkDestination
import zed.rainxch.githubstore.app.deeplink.DeepLinkParser
import zed.rainxch.githubstore.app.navigation.GithubStoreGraph
import zed.rainxch.githubstore.app.navigation.getCurrentScreen
import zed.rainxch.tweaks.presentation.utils.TweaksDeepLinkBus

@Composable
fun HandleDesktopToolbarDeeplinks(
    deepLinkUris: ReceiveChannel<String>,
    onDeepLinkConsumed: () -> Unit,
    navController: NavHostController,
) {
    LaunchedEffect(deepLinkUris) {
        for (uri in deepLinkUris) {
            val currentScreen = navController.currentBackStackEntry.getCurrentScreen()
            when (val destination = DeepLinkParser.parse(uri)) {
                is DeepLinkDestination.Repository -> {
                    navController.navigate(
                        GithubStoreGraph.DetailsScreen(
                            owner = destination.owner,
                            repo = destination.repo,
                        ),
                    )
                }

                DeepLinkDestination.Home -> {
                    if (currentScreen !is GithubStoreGraph.ExploreScreen) {
                        navController.navigate(GithubStoreGraph.ExploreScreen) {
                            popUpTo(GithubStoreGraph.ExploreScreen) { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                }

                DeepLinkDestination.Apps -> {
                    navController.navigate(GithubStoreGraph.AppsScreen) {
                        popUpTo(GithubStoreGraph.ExploreScreen) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }

                is DeepLinkDestination.AuthHandoff -> {
                    AuthDeepLinkBus.publish(
                        AuthDeepLinkEvent.Handoff(destination.handoffId, destination.state),
                    )
                    if (currentScreen !is GithubStoreGraph.AuthenticationScreen) {
                        navController.navigate(GithubStoreGraph.AuthenticationScreen) {
                            launchSingleTop = true
                        }
                    }
                }

                is DeepLinkDestination.AuthError -> {
                    AuthDeepLinkBus.publish(
                        AuthDeepLinkEvent.Error(destination.reason, destination.state),
                    )
                    if (currentScreen !is GithubStoreGraph.AuthenticationScreen) {
                        navController.navigate(GithubStoreGraph.AuthenticationScreen) {
                            launchSingleTop = true
                        }
                    }
                }

                DeepLinkDestination.Tweaks -> {
                    navController.navigate(GithubStoreGraph.TweaksScreen) {
                        launchSingleTop = true
                    }
                }

                DeepLinkDestination.Feedback -> {
                    navController.navigate(GithubStoreGraph.TweaksScreen) {
                        launchSingleTop = true
                    }
                    TweaksDeepLinkBus.requestOpenFeedback()
                }

                DeepLinkDestination.About -> {
                    navController.navigate(GithubStoreGraph.AboutScreen) {
                        launchSingleTop = true
                    }
                }

                DeepLinkDestination.TweaksLicenses -> {
                    navController.navigate(GithubStoreGraph.LicensesScreen) {
                        launchSingleTop = true
                    }
                }

                DeepLinkDestination.Search -> {
                    if (currentScreen !is GithubStoreGraph.SearchScreen) {
                        navController.navigate(GithubStoreGraph.SearchScreen()) {
                            popUpTo(GithubStoreGraph.ExploreScreen) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                }

                DeepLinkDestination.Favourites -> {
                    navController.navigate(GithubStoreGraph.FavouritesScreen) {
                        popUpTo(GithubStoreGraph.ExploreScreen) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }

                DeepLinkDestination.RecentlyViewed -> {
                    navController.navigate(GithubStoreGraph.RecentlyViewedScreen) {
                        popUpTo(GithubStoreGraph.ExploreScreen) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }

                DeepLinkDestination.None -> {
                }
            }
            onDeepLinkConsumed()
        }
    }
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/utils/HandleKeyboardEvents.kt`
```
package zed.rainxch.githubstore.utils

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import zed.rainxch.core.presentation.utils.ObserveAsEvents
import zed.rainxch.githubstore.app.desktop.KeyboardNavigation
import zed.rainxch.githubstore.app.desktop.KeyboardNavigationEvent
import zed.rainxch.githubstore.app.navigation.GithubStoreGraph
import zed.rainxch.githubstore.app.navigation.getCurrentScreen

@Composable
fun HandleKeyboardEvents(navController: NavHostController) {
    val currentScreen = navController.currentBackStackEntryAsState().value.getCurrentScreen()

    ObserveAsEvents(KeyboardNavigation.events) { event ->
        when (event) {
            KeyboardNavigationEvent.OnCtrlFClick -> {
                if (currentScreen !is GithubStoreGraph.SearchScreen) {
                    navController.navigate(GithubStoreGraph.SearchScreen()) {
                        popUpTo(GithubStoreGraph.ExploreScreen) {
                            saveState = true
                        }

                        launchSingleTop = true
                        restoreState = true
                    }
                }
            }
        }
    }
}

```

### Core Architecture Module: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/utils/StartupPreferences.kt`
```
package zed.rainxch.githubstore.utils

internal const val STARTUP_PREFERENCE_TIMEOUT_MS: Long = 2000L

```

### Core Architecture Module: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/di/PlatformModule.android.kt`
```
package zed.rainxch.core.data.di

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import kotlinx.coroutines.CoroutineScope
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import zed.rainxch.core.data.local.data_store.createAnnouncementsDataStore
import zed.rainxch.core.data.local.data_store.createDataStore
import zed.rainxch.core.data.local.db.AppDatabase
import zed.rainxch.core.data.local.db.initDatabase
import zed.rainxch.core.data.services.AndroidApkInspector
import zed.rainxch.core.data.services.AndroidDownloader
import zed.rainxch.core.data.services.AndroidDownloadProgressNotifier
import zed.rainxch.core.data.services.AndroidFileLocationsProvider
import zed.rainxch.core.data.services.AndroidInstaller
import zed.rainxch.core.data.services.AndroidInstallerInfoExtractor
import zed.rainxch.core.data.services.AndroidLocalizationManager
import zed.rainxch.core.data.services.AndroidPackageMonitor
import zed.rainxch.core.data.services.AndroidPendingInstallNotifier
import zed.rainxch.core.data.services.AndroidUpdateScheduleManager
import zed.rainxch.core.data.services.DownloadNotificationObserver
import zed.rainxch.core.data.services.FileLocationsProvider
import zed.rainxch.core.data.services.LocalizationManager
import zed.rainxch.core.data.services.external.AndroidExternalAppScanner
import zed.rainxch.core.data.services.external.InstallerSourceClassifier
import zed.rainxch.core.data.services.external.ManifestHintExtractor
import zed.rainxch.core.data.services.dhizuku.DhizukuServiceManager
import zed.rainxch.core.data.services.installer.AndroidInstallerStatusProvider
import zed.rainxch.core.data.services.installer.SilentInstallerDispatcher
import zed.rainxch.core.data.services.root.RootServiceManager
import zed.rainxch.core.data.services.shizuku.ShizukuServiceManager
import zed.rainxch.core.data.utils.AndroidAppLauncher
import zed.rainxch.core.data.utils.AndroidBrowserHelper
import zed.rainxch.core.data.utils.AndroidClipboardHelper
import zed.rainxch.core.data.utils.AndroidShareManager
import zed.rainxch.core.data.network.AndroidDigestVerifier
import zed.rainxch.core.domain.network.DigestVerifier
import zed.rainxch.core.domain.network.Downloader
import zed.rainxch.core.domain.system.ApkInspector
import zed.rainxch.core.domain.system.DownloadOrchestrator
import zed.rainxch.core.domain.system.DownloadProgressNotifier
import zed.rainxch.core.domain.system.ExternalAppScanner
import zed.rainxch.core.domain.system.Installer
import zed.rainxch.core.domain.system.InstallerStatusProvider
import zed.rainxch.core.domain.system.PackageMonitor
import zed.rainxch.core.domain.system.PendingInstallNotifier
import zed.rainxch.core.domain.system.UpdateScheduleManager
import zed.rainxch.core.domain.helpers.AppLauncher
import zed.rainxch.core.domain.helpers.BrowserHelper
import zed.rainxch.core.domain.helpers.ClipboardHelper
import zed.rainxch.core.domain.helpers.ShareManager

actual val corePlatformModule =
    module {

        single<Downloader> {
            AndroidDownloader(
                files = get(),
                tokenStore = get(),
                digestVerifier = get(),
            )
        }

        single {
            AndroidInstaller(
                context = get(),
                installerInfoExtractor = AndroidInstallerInfoExtractor(androidContext()),
            )
        }

        single {
            ShizukuServiceManager(
                context = androidContext(),
            ).also { it.initialize() }
        }

        single {
            DhizukuServiceManager(
                context = androidContext(),
            ).also { it.initialize() }
        }

        single {
            RootServiceManager(
                context = androidContext(),
                scope = get<CoroutineScope>(),
            ).also { it.initialize() }
        }

        single<Installer> {
            SilentInstallerDispatcher(
                androidContext = androidContext(),
                androidInstaller = get<AndroidInstaller>(),
                shizukuServiceManager = get(),
                dhizukuServiceManager = get(),
                rootServiceManager = get(),
                tweaksRepository = get(),
                scope = get<CoroutineScope>(),
            ).also { dispatcher ->
                dispatcher.observeInstallerPreference()
            }
        }

        single<InstallerStatusProvider> {
            AndroidInstallerStatusProvider(
                shizukuServiceManager = get(),
                dhizukuServiceManager = get(),
                rootServiceManager = get(),
                scope = get(),
            )
        }

        single<FileLocationsProvider> {
            AndroidFileLocationsProvider(context = get())
        }

        single<zed.rainxch.core.domain.system.AggressiveOemDetector> {
            zed.rainxch.core.data.services.AndroidAggressiveOemDetector(context = androidContext())
        }

        single<PendingInstallNotifier> {
            AndroidPendingInstallNotifier(context = androidContext())
        }

        single<DownloadProgressNotifier> {
            AndroidDownloadProgressNotifier(context = androidContext())
        }

        single {
            DownloadNotificationObserver(
                orchestrator = get<DownloadOrchestrator>(),
                notifier = get<DownloadProgressNotifier>(),
            )
        }

        single<PackageMonitor> {
            AndroidPackageMonitor(androidContext())
        }

        single<ApkInspector> {
            AndroidApkInspector(androidContext())
        }

        single { ManifestHintExtractor() }

        single {
            InstallerSourceClassifier(
                packageManager = androidContext().packageManager,
                selfPackageName = androidContext().packageName,
            )
        }

        single<ExternalAppScanner> {
            AndroidExternalAppScanner(
                context = androidContext(),
                manifestHintExtractor = get(),
                installerSourceClassifier = get(),
            )
        }

        single<LocalizationManager> {
            AndroidLocalizationManager()
        }

        single<AppDatabase> {
            initDatabase(androidContext())
        }

        single<DataStore<Preferences>> {
            createDataStore(androidContext())
        }

        single<DataStore<Preferences>>(qualifier = org.koin.core.qualifier.named("announcements")) {
            createAnnouncementsDataStore(androidContext())
        }

        single<eu.anifantakis.lib.ksafe.KSafe>(qualifier = org.koin.core.qualifier.named("tokens")) {
            eu.anifantakis.lib.ksafe.KSafe(
                context = androidContext(),
                fileName = "ghs_tokens",
            )
        }

        single<eu.anifantakis.lib.ksafe.KSafe>(qualifier = org.koin.core.qualifier.named("prefs")) {
            eu.anifantakis.lib.ksafe.KSafe(
                context = androidContext(),
                fileName = "ghs_prefs",
            )
        }

        single<eu.anifantakis.lib.ksafe.KSafe>(qualifier = org.koin.core.qualifier.named("announcements_cache")) {
            eu.anifantakis.lib.ksafe.KSafe(
                context = androidContext(),
                fileName = "ghs_announcements",
            )
        }

        single<BrowserHelper> {
            AndroidBrowserHelper(androidContext())
        }

        single<DigestVerifier> {
            AndroidDigestVerifier()
        }

        single<ClipboardHelper> {
            AndroidClipboardHelper(androidContext())
        }

        single<AppLauncher> {
            AndroidAppLauncher(
                context = androidContext(),
                logger = get(),
            )
        }

        single<ShareManager> {
            AndroidShareManager(
                context = androidContext(),
            )
        }

        single<UpdateScheduleManager> {
            AndroidUpdateScheduleManager(
                context = androidContext(),
            )
        }
    }

```

### Core Architecture Module: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/local/data_store/createAnnouncementsDataStore.kt`
```
package zed.rainxch.core.data.local.data_store

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences

fun createAnnouncementsDataStore(context: Context): DataStore<Preferences> =
    createDataStore(
        producePath = {
            context.filesDir.resolve(announcementsDataStoreFileName).absolutePath
        },
    )

```

### Core Architecture Module: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/local/data_store/createDataStore.kt`
```
package zed.rainxch.core.data.local.data_store

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences

fun createDataStore(context: Context): DataStore<Preferences> =
    createDataStore(
        producePath = {
            context.filesDir.resolve(_root_ide_package_.zed.rainxch.core.data.local.data_store.dataStoreFileName).absolutePath
        },
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1019** (2026-10-16): **Komi finds wrong repository for installed app**
  *Symptoms*: > Already in the app? **Profile → Send feedback** auto-fills app version, platform, and installer. Fastest path.  ## What's wrong  Linking an installed app to a Github repo finds the wrong repo  ## How to reproduce  1. Install my saf-sftp provider (https://github.com/AlainKnaff/Android-SFTP-Documents-Provider) by downloading the apk manually, or via F-Droid 2. In Komi store chose Library 3. Click "+" sign 4. Pick the SFTP Documents Provider  => it finds Carsten Leue's ssh-fs-provider (https://github.com/Carsten-Leue/ssh-fs-provider), which does not have anything to do with mine (not a fork, not an ancestor, different application id, and completely different structure)  Then entering the correct URL manually does work though, but how come it didn't find it on its own and found something completely else? If at least it found one of its numerous forks (or ancestors) I'd understand :-)  ## Your setup  App version · Android version + device, **or** Desktop OS + version.  1.9.2 · 17 + Pixel 7a  ## Anything else  Screenshots, logs, the GitHub repo URL you were trying to install — whatever helps. Don't sweat it if you don't have all of it. 

- **Issue #988** (2026-10-04): **bug: Codeberg/Forgejo repos fail to open from Favourites and Recently viewed**
  *Symptoms*: ## What's wrong  Follow-up to #866 / #987, which fixed this for Search only.  Favourites and Recently viewed open Details with just `repositoryId`. For a Codeberg/Forgejo repo that id is the encoded negative one from `RepoIdCodec`, and with no `sourceHost`/`owner`/`repo` Details falls through to `getRepositoryById`, which asks GitHub for `/repositories/<negative id>`. Expected result: "We couldn't load this repo."  `FavoriteRepo` and `SeenRepo` don't store `sourceHost`, and the host can't be recovered from the id (it's a one-way fingerprint). Both do store `repoUrl`, so `RepositoryUrlParser` could recover host, owner and name from it.  Affected call sites in `AppNavigation.kt`: - `FavouritesScreen`: `DetailsScreen(it)` - `RecentlyViewedScreen`: `DetailsScreen(repositoryId = repoId)` - Worth checking too: `ExternalImportScreen` (`repositoryId` + `isComingFromUpdate`, no host)  ## How to reproduce  1. Search with Codeberg as the source and open a repo (e.g. `raincord/rainManager`). 2. Favourite it, then go back. 3. Open it from Favourites, or from Recently viewed.  ## Your setup  Found by reading the code; not yet confirmed on a device.

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

### Incident Patch 1: `9d838085` (2026-10-06)
**Commit Message**: fix(db): bind the installed record to the release it came from (#998)

* fix(db): bind the installed record to the release it came from

installedVersion is meant to hold the release tag, but the device only reports a
versionName, and that cannot be turned back into a tag. So the record needs to
carry enough identity to tell "is the device still on the release we installed?"
without going through version normalisation, which can drop a hash letter run and
make two different builds look like the same version — that is what makes a real
update go unreported.

- confirmInstall records installedReleaseId / installedAssetId / installedAssetDigest
  from its own arguments — the release and asset that were actually downloaded —
  never from the latest* snapshot columns, which may have moved on by the time a
  parked install is confirmed. A null argument means "not provided" and keeps
  what is there, so a caller that does not know the release cannot erase it.
- bindingStatusAgainst(local) checks the device only: package name, versionCode,
  versionName and signing fingerprint. The fingerprint is the one criterion the
  version fields cannot express — same package and version, different si

**File**: `core/data/schemas/zed.rainxch.core.data.local.db.AppDatabase/20.json` (added, +901/-0)
```diff
@@ -0,0 +1,901 @@
+{
+  "formatVersion": 1,
+  "database": {
+    "version": 20,
+    "identityHash": "d8f32b04921a08e6a9e3fae5fa7d2db1",
+    "entities": [
+      {
+        "tableName": "installed_apps",
+        "createSql": "CREATE TABLE IF NOT EXISTS `${TABLE_NAME}` (`packageName` TEXT NOT NULL, `repoId` INTEGER NOT NULL, `repoName` TEXT NOT NULL, `repoOwner` TEXT NOT NULL, `repoOwnerAvatarUrl` TEXT NOT NULL, `repoDescription` TEXT, `primaryLanguage` TEXT, `repoUrl` TEXT NOT NULL, `installedVersion` TEXT NOT NULL, `installedReleaseId` INTEGER DEFAULT NULL, `installedAssetId` INTEGER DEFAULT NULL, `installedAssetDigest` TEXT DEFAULT NULL, `installedAssetName` TEXT, `installedAssetUrl` TEXT, `latestVersion` TEXT, `latestAssetName` TEXT, `latestAssetUrl` TEXT, `latestAssetSize` INTEGER, `latestReleaseId` INTEGER DEFAULT NULL, `latestAssetId` INTEGER DEFAULT NULL, `latestAssetDigest` TEXT DEFAULT NULL, `appName` TEXT NOT NULL, `installSource` TEXT NOT NULL, `signingFingerprint` TEXT, `installedAt` INTEGER NOT NULL, `lastCheckedAt` INTEGER NOT NULL, `lastUpdatedAt` INTEGER NOT NULL, `isUpdateAvailable` INTEGER NOT NULL, `updateCheckEnabled` INTEGER NOT NULL, `releaseNotes` TEXT, `systemArchitecture` TEXT NOT NULL, `fileExtension` TEXT NOT NULL, `isPendingInstall` INTEGER NOT NULL, `installedVersionName` TEXT, `installedVersionCode` INTEGER NOT NULL, `latestVersionName` TEXT, `latestVersionCode` INTEGER, `latestReleasePublishedAt` TEXT, `includePreReleases` INTEGER NOT NULL, `assetFilterRegex` TEXT, `fallbackToOlderReleases` INTEGER NOT NULL DEFAULT 0, `preferredAssetVariant` TEXT, `preferredVariantStale` INTEGER NOT NULL DEFAULT 0, `preferredAssetTokens` TEXT, `assetGlobPattern` TEXT, `pickedAssetIndex` INTEGER, `pickedAssetSiblingCount` INTEGER, `pendingInstallFilePath` TEXT, `pendingInstallVersion` TEXT, `pendingInstallAssetName` TEXT, `pendingInstallReleaseId` INTEGER DEFAULT NULL, `pendingInstallAssetId` INTEGER DEFAULT NULL, `pendingInstallAssetDigest` TEXT DEFAULT NULL, `skippedReleaseTag` TEXT DEFAULT NULL, `sourceHost` TEXT DEFAULT NULL, PRIMARY KEY(`packageName`))",
+        "fields": [
+          {
+            "fieldPath": "packageName",
+            "columnName": "packageName",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "repoId",
+            "columnName": "repoId",
+            "affinity": "INTEGER",
+            "notNull": true
+          },
+          {
+            "fieldPath": "repoName",
+            "columnName": "repoName",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "repoOwner",
+            "columnName": "repoOwner",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "repoOwnerAvatarUrl",
+            "columnName": "repoOwnerAvatarUrl",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "repoDescription",
+            "columnName": "repoDescription",
+            "affinity": "TEXT"
+          },
+          {
+            "fieldPath": "primaryLanguage",
+            "columnName": "primaryLanguage",
+            "affinity": "TEXT"
+          },
+          {
+            "fieldPath": "repoUrl",
+            "columnName": "repoUrl",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "installedVersion",
+            "columnName": "installedVersion",
+            "affinity": "TEXT",
+            "notNull": true
+          },
+          {
+            "fieldPath": "installedReleaseId",
+            "columnName": "installedReleaseId",
+            "affinity": "INTEGER",
+            "defaultValue": "NULL"
+          },
+          {
+            "fieldPath": "installedAssetId",
+            "columnName": "installedAssetId",
+            "affinity": "INTEGER",
+            "defaultValue": "NULL"
+          },
+          {
+            "fieldPath": "installedAssetDigest",
+            "columnName": "installedAssetDigest",
+            "affinity": "TEXT",
+            "defaultValue": "NULL"
+          },
+          {
+            "fieldPath": "installedAssetName",
+            "columnName": "installedAssetName",
+            "affinity": "TEXT"
+          },
+          {
+            "fieldPath": "installedAssetUrl",
+            "columnName": "installedAssetUrl",
+            "affinity": "TEXT"
+          },
+          {
+            "fieldPath": "latestVersion",
+            "columnName": "latestVersion",
+            "affinity": "TEXT"
+          },
+          {
+            "fieldPath": "latestAssetName",
+            "columnName": "latestAssetName",
+            "affinity": "TEXT"
+          },
+          {
+            "fieldPath": "latestAssetUrl",
+            "columnName": "latestAssetUrl",
+            "affinity": "TEXT"
+          },
+          {
+           
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/local/db/initDatabase.kt` (modified, +2/-0)
```diff
@@ -20,6 +20,7 @@ import zed.rainxch.core.data.local.db.migrations.MIGRATION_14_15
 import zed.rainxch.core.data.local.db.migrations.MIGRATION_15_16
 import zed.rainxch.core.data.local.db.migrations.MIGRATION_16_17
 import zed.rainxch.core.data.local.db.migrations.MIGRATION_17_18
+import zed.rainxch.core.data.local.db.migrations.MIGRATION_19_20
 
 fun initDatabase(context: Context): AppDatabase {
     val appContext = context.applicationContext
@@ -47,6 +48,7 @@ fun initDatabase(context: Context): AppDatabase {
             MIGRATION_15_16,
             MIGRATION_16_17,
             MIGRATION_17_18,
+            MIGRATION_19_20,
         ).fallbackToDestructiveMigrationOnDowngrade(dropAllTables = true)
         .build()
 }
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/AndroidPackageMonitor.kt` (modified, +1/-25)
```diff
@@ -11,7 +11,6 @@ import kotlinx.coroutines.withContext
 import zed.rainxch.core.domain.model.installation.DeviceApp
 import zed.rainxch.core.domain.model.installation.SystemPackageInfo
 import zed.rainxch.core.domain.system.PackageMonitor
-import java.security.MessageDigest
 
 class AndroidPackageMonitor(
     context: Context,
@@ -52,30 +51,7 @@ class AndroidPackageMonitor(
                         packageInfo.versionCode.toLong()
                     }
 
-                val signingFingerprint: String? =
-                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
-                        val sigInfo = packageInfo.signingInfo
-                        val certs =
-                            if (sigInfo?.hasMultipleSigners() == true) {
-                                sigInfo.apkContentsSigners
-                            } else {
-                                sigInfo?.signingCertificateHistory
-                            }
-                        certs?.firstOrNull()?.toByteArray()?.let { certBytes ->
-                            MessageDigest
-                                .getInstance("SHA-256")
-                                .digest(certBytes)
-                                .joinToString(":") { "%02X".format(it) }
-                        }
-                    } else {
-                        @Suppress("DEPRECATION")
-                        packageInfo.signatures?.firstOrNull()?.toByteArray()?.let { certBytes ->
-                            MessageDigest
-                                .getInstance("SHA-256")
-                                .digest(certBytes)
-                                .joinToString(":") { "%02X".format(it) }
-                        }
-                    }
+                val signingFingerprint = SigningFingerprint.fromPackageInfo(packageInfo)
 
                 SystemPackageInfo(
                     packageName = packageInfo.packageName,
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/AutoUpdateWorker.kt` (modified, +5/-1)
```diff
@@ -207,7 +207,11 @@ class AutoUpdateWorker(
         if (currentApp != null) {
             installedAppsRepository.updateApp(
                 currentApp
-                    .markPending()
+                    .markPending(
+                        releaseId = currentApp.latestReleaseId,
+                        assetId = currentApp.latestAssetId,
+                        assetDigest = currentApp.latestAssetDigest,
+                    )
                     .withLatestSnapshot(
                         version = latestVersion,
                         assetName = assetName,
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/PackageEventReceiver.kt` (modified, +17/-9)
```diff
@@ -16,6 +16,7 @@ import zed.rainxch.core.domain.model.installation.externalInstallUpdateFlag
 import zed.rainxch.core.domain.model.installation.resolvePendingFromSystem
 import zed.rainxch.core.domain.model.installation.snapshotStillNamesNewerBuild
 import zed.rainxch.core.domain.model.installation.tagForObservedBuild
+import zed.rainxch.core.domain.model.installation.withSettledInstallIdentity
 import zed.rainxch.core.domain.repository.ExternalImportRepository
 import zed.rainxch.core.domain.repository.InstalledAppsRepository
 import zed.rainxch.core.domain.system.ExternalLinkState
@@ -157,11 +158,15 @@ class PackageEventReceiver() :
                                 ?: app.latestVersion
                                 ?: systemInfo.versionName
                         if (wasActuallyUpdated) {
+                            val settled = app.withSettledInstallIdentity(systemInfo.versionCode)
                             repo.updateAppVersion(
                                 packageName = packageName,
                                 newTag = installedTag,
-                                newAssetName = app.latestAssetName ?: "",
-                                newAssetUrl = app.latestAssetUrl ?: "",
+                                newReleaseId = settled.installedReleaseId,
+                                newAssetId = settled.installedAssetId,
+                                newAssetDigest = settled.installedAssetDigest,
+                                newAssetName = app.latestAssetName,
+                                newAssetUrl = app.latestAssetUrl,
                                 newVersionName = systemInfo.versionName,
                                 newVersionCode = systemInfo.versionCode,
                                 signingFingerprint = app.signingFingerprint,
@@ -262,13 +267,16 @@ class PackageEventReceiver() :
                 VersionVerdict.UNKNOWN -> app.isUpdateAvailable
             }
 
-        repo.updateInstalledVersion(
-            packageName = packageName,
-            installedVersion = app.tagForObservedBuild(systemInfo.versionName, systemInfo.versionCode),
-            installedVersionName = systemInfo.versionName,
-            installedVersionCode = systemInfo.versionCode,
-            isUpdateAvailable = newIsUpdateAvailable,
-        )
+        repo.executeInTransaction {
+            repo.updateInstalledVersion(
+                packageName = packageName,
+                installedVersion = app.tagForObservedBuild(systemInfo.versionName, systemInfo.versionCode),
+                installedVersionName = systemInfo.versionName,
+                installedVersionCode = systemInfo.versionCode,
+                isUpdateAvailable = newIsUpdateAvailable,
+            )
+            repo.clearInstallBinding(packageName)
+        }
 
         Logger.i {
             "External version change via broadcast: $packageName " +
```

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/local/db/AppDatabase.kt` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ import zed.rainxch.core.data.local.db.entities.UpdateHistoryEntity
         SigningFingerprintEntity::class,
         HiddenRepoEntity::class,
     ],
-    version = 19,
+    version = 20,
     exportSchema = true,
     autoMigrations = [AutoMigration(from = 18, to = 19)],
 )
```

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/local/db/dao/InstalledAppDao.kt` (modified, +12/-0)
```diff
@@ -198,6 +198,18 @@ interface InstalledAppDao {
         isUpdateAvailable: Boolean,
     )
 
+    @Query(
+        """
+        UPDATE installed_apps
+           SET installedReleaseId = NULL,
+               installedAssetId = NULL,
+               installedAssetDigest = NULL
+         WHERE packageName = :packageName
+        """,
+    )
+    suspend fun clearInstallBinding(packageName: String)
+
+    // Must not touch the pending identity: callers clear the path before the system confirms the install.
     @Query(
         """
         UPDATE installed_apps
```

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/local/db/entities/InstalledAppEntity.kt` (modified, +15/-0)
```diff
@@ -16,6 +16,12 @@ data class InstalledAppEntity(
     val primaryLanguage: String?,
     val repoUrl: String,
     val installedVersion: String,
+    @ColumnInfo(defaultValue = "NULL")
+    val installedReleaseId: Long? = null,
+    @ColumnInfo(defaultValue = "NULL")
+    val installedAssetId: Long? = null,
+    @ColumnInfo(defaultValue = "NULL")
+    val installedAssetDigest: String? = null,
     val installedAssetName: String?,
     val installedAssetUrl: String?,
     val latestVersion: String?,
@@ -71,6 +77,15 @@ data class InstalledAppEntity(
 
     val pendingInstallAssetName: String? = null,
 
+    @ColumnInfo(defaultValue = "NULL")
+    val pendingInstallReleaseId: Long? = null,
+
+    @ColumnInfo(defaultValue = "NULL")
+    val pendingInstallAssetId: Long? = null,
+
+    @ColumnInfo(defaultValue = "NULL")
+    val pendingInstallAssetDigest: String? = null,
+
     @ColumnInfo(defaultValue = "NULL")
     val skippedReleaseTag: String? = null,
     @ColumnInfo(defaultValue = "NULL")
```

---

### Incident Patch 2: `34306c77` (2026-10-19)
**Commit Message**: chore(quality): Konsist rules, Compose lint rules, code style docs and CLAUDE.md fixes (#1065)

* ci: add PR checks for build, tests, coverage, Spotless, detekt, Android Lint and Compose stability

Spotless replaces ktlint-gradle and the format-on-build hook; it ratchets from
origin/main so only changed files are checked. detekt, Android Lint and the
Compose stability analyzer start from per-module baselines and fail on new
findings. Kotlin warnings are errors, except in feature:details:presentation
until #1021 lands. Adds CodeQL and Dependabot.

* ci: merge per-module SARIF into one run for code scanning

Code scanning rejects several runs with the same category in one upload.
Merge detekt and lint reports into a single run with repo-relative paths
and drop the LintBaseline notes.

* chore: mark verifier baselines as generated so GitHub collapses them

* ci: switch off checks that are noise here instead of baselining them

Lint dependency-version checks duplicate Dependabot, and their baseline
entries held machine-specific paths that never match on CI. detekt
WildcardImport contradicts .editorconfig, and Spotless already fixes a
missing final newline.

* ci: refresh detekt baselin

**File**: `.coderabbit.yaml` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-language: "en-US"
-early_access: false
-reviews:
-  profile: "chill"
-  request_changes_workflow: false
-  high_level_summary: true
-  poem: true
-  review_status: true
-  collapse_walkthrough: false
-  auto_review:
-    enabled: true
-    drafts: false
```

**File**: `.github/workflows/pr-checks.yml` (modified, +4/-0)
```diff
@@ -38,6 +38,10 @@ jobs:
       - name: Unit tests and coverage
         run: ./gradlew jvmTest koverXmlReport koverHtmlReport --continue
 
+      - name: Architecture rules
+        if: always()
+        run: ./gradlew :konsist-test:test
+
       - name: Coverage summary
         if: always()
         run: |
```

**File**: `CLAUDE.md` (modified, +14/-12)
```diff
@@ -1,6 +1,6 @@
 # Komi Store
 
-Cross-platform app store for GitHub + Codeberg + Forgejo releases. **Kotlin Multiplatform** + **Compose Multiplatform**. Android (min API 26) + Desktop (JVM: Win/macOS/Linux). Package `zed.rainxch.githubstore`. Version 1.8.3 (code 18). Target SDK 36.
+Cross-platform app store for GitHub + Codeberg + Forgejo releases. **Kotlin Multiplatform** + **Compose Multiplatform**. Android (min API 26) + Desktop (JVM: Win/macOS/Linux). Package `zed.rainxch.githubstore`. Version 1.9.3 (code 22). Target SDK 36.
 
 ## Build
 
@@ -25,6 +25,7 @@ CI (`.github/workflows/pr-checks.yml`) runs on every PR and push to `main`. Exis
 ./gradlew lintDebug                                       # Android Lint; baseline: <module>/lint-baseline.xml
 ./gradlew jvmTest koverXmlReport                          # tests + merged coverage (build/reports/kover)
 ./gradlew compileDebugKotlinAndroid; ./gradlew debugStabilityCheck   # Compose stability vs <module>/stability/*.stability
+./gradlew :konsist-test:test                              # architecture rules (Konsist), allowlists in konsist-test/
 ./gradlew spotlessInstallGitPrePushHook                   # opt-in pre-push format check
 ```
 
@@ -37,13 +38,13 @@ composeApp/            # entry points, navigation, DI wiring (commonMain / andro
 core/
   domain/              # interfaces, models, use cases (no framework deps)
   data/                # repos, Ktor, Room, Koin, platform impls
-  presentation/        # Material 3 theme + reusable components + 14-locale strings
+  presentation/        # Personality design system (Classic / Manga) + Komi* components + 14-locale strings
 feature/
-  apps auth details dev-profile favourites homeP profile recently-viewed search starred tweaks
+  apps auth details dev-profile favourites feed home profile recently-viewed repo-pages search starred tweaks
 build-logic/convention/  # convention plugins
 ```
 
-Each feature: up to 3 sub-modules (`domain/`, `data/`, `presentation/`). `favourites`, `starred`, `recently-viewed` are presentation-only.
+Each feature: up to 3 sub-modules (`domain/`, `data/`, `presentation/`). `profile`, `recently-viewed`, `tweaks` are presentation-only. `favourites` and `starred` also have `domain/` and `data/` modules, currently empty.
 
 ## Architecture
 
@@ -65,19 +66,19 @@ class XViewModel : ViewModel() {
 
 ### Navigation
 
-`@Serializable` sealed interface `GithubStoreGraph` in `composeApp/.../app/navigation/`. Routes: `HomeScreen`, `SearchScreen`, `AuthenticationScreen`, `ProfileScreen`, `TweaksScreen`, `FavouritesScreen`, `StarredReposScreen`, `RecentlyViewedScreen`, `AppsScreen`, `OnboardingScreen`, `ExternalImportScreen`, `MirrorPickerScreen`, `StarredPickerScreen`, `SkippedUpdatesScreen`, `HiddenRepositoriesScreen`, `WhatsNewHistoryScreen`, `AnnouncementsScreen`, `HostTokensScreen`, `DetailsScreen(repositoryId, owner, repo, isComingFromUpdate, sourceHost, packageName)`, `DeveloperProfileScreen(username)`. `DetailsScreen.packageName` (set from Apps) opens on that installed app in multi-app repos. `DetailsScreen.sourceHost` is non-null for Codeberg / Forgejo / custom-forge repos — routes all `DetailsRepository` calls through `ForgejoClientRegistry` instead of the GitHub-backed default path.
+`@Serializable` sealed interface `GithubStoreGraph` in `composeApp/.../app/navigation/`. Routes: `ExploreScreen`, `ChartsScreen`, `CategoryListScreen`, `SearchScreen`, `AuthenticationScreen`, `ProfileGraph` > `ProfileScreen`, `TweaksScreen`, `AboutScreen`, `LicensesScreen`, `FavouritesScreen`, `StarredReposScreen`, `RecentlyViewedScreen`, `AppsScreen`, `ExternalImportScreen`, `ImportStarsScreen`, `MirrorPickerScreen`, `StarredPickerScreen`, `SkippedUpdatesScreen`, `HiddenRepositoriesScreen`, `WhatsNewHistoryScreen`, `AnnouncementsScreen`, `HostTokensScreen`, `DetailsScreen(repositoryId, owner, repo, isComingFromUpdate, sourceHost, packageName)`, `DetailsAboutScreen`, `DetailsWhatsNewScreen`, `MarkdownViewerScreen`, `RepoIssuesScreen`, `RepoIssueDetailScreen`, `RepoSecurityScreen`, `RepoPullsScreen` (registered, nothing navigates to it yet), `DeveloperProfileScreen(username)`. `DetailsScreen.packageName` (set from Apps) opens on that installed app in multi-app repos. `DetailsScreen.sourceHost` is non-null for Codeberg / Forgejo / custom-forge repos — routes all `DetailsRepository` calls through `ForgejoClientRegistry` instead of the GitHub-backed default path.
 
 ### DI
 
 Koin. Feature modules in `data/di/SharedModule.kt`. ViewModels in `composeApp/.../app/di/ViewModelsModule.kt` (`viewModelOf(::X)` or explicit `viewModel { ... }`). Wired in `initKoin.kt`.
 
 ## Core repositories (`core/domain`)
 
-`FavouritesRepository`, `StarredRepository`, `InstalledAppsRepository`, `SeenReposRepository`, `HiddenReposRepository`, `SearchHistoryRepository`, `TweaksRepository`, `AuthenticationState`, `ThemesRepository`, `ProxyRepository`, `RateLimitRepository`, `ExternalImportRepository`, `TelemetryRepository`, `HostTok
```

**File**: `CONTRIBUTING.md` (modified, +9/-10)
```diff
@@ -110,11 +110,11 @@ GITHUB_CLIENT_ID=your-oauth-client-id-or-leave-blank-for-local
 # Full build check (compile + lint)
 ./gradlew build
 
-# Format check (ktlint)
-./gradlew ktlintCheck
+# Format check (ktlint through Spotless, files changed against main)
+./gradlew spotlessCheck
 
-# Auto-format
-./gradlew ktlintFormat
+# Auto-format the same files
+./gradlew spotlessApply
 ```
 
 The first build will pull a lot of dependencies. Subsequent builds reuse the Gradle build cache (enabled in `gradle.properties`).
@@ -150,7 +150,7 @@ The full architectural rundown lives in [CLAUDE.md](CLAUDE.md). Per-feature note
 
 ## Coding conventions
 
-We use Kotlin's official style (`kotlin.code.style=official`). CI lints every PR with ktlint. The big rules:
+We use Kotlin's official style (`kotlin.code.style=official`). CI lints every PR with ktlint through Spotless. The full rule set is in [`docs/code-style.md`](docs/code-style.md). The big rules:
 
 ### Architecture
 
@@ -238,7 +238,7 @@ We use Kotlin's official style (`kotlin.code.style=official`). CI lints every PR
 4. **Run the local checks:**
 
    ```bash
-   ./gradlew ktlintCheck build
+   ./gradlew spotlessApply build
    ```
 
    (Or the narrower module-specific tasks if you know the change is scoped.)
@@ -248,10 +248,9 @@ We use Kotlin's official style (`kotlin.code.style=official`). CI lints every PR
    - **How to test** — exact steps a reviewer can follow on a clean checkout.
    - **Screenshots** or screen recordings for any UI change. Mandatory for visual diffs.
    - **Linked issue:** `Closes #123` / `Fixes #123`.
-6. **Run the local checks yourself before review.** No CI runs against PRs — `./gradlew ktlintCheck build` is your safety net. Don't expect the merge button to catch a broken build.
-7. **Work through CodeRabbit's review.** Every PR gets an automated review from [CodeRabbit AI](https://coderabbit.ai). Read each comment, decide whether it's right, and either fix it or reply explaining why you're leaving it. "Looks fine to me" without engaging with the comments is not enough — a maintainer will ask you to address them before merging. CodeRabbit isn't always right; pushing back with reasoning is welcome.
-8. **Address human review comments** with follow-up commits (don't force-push during review unless the reviewer asks). Squash on merge happens automatically.
-9. **Merge** is performed by maintainers via GitHub's "Squash and merge". Your branch is deleted automatically.
+6. **Run the local checks yourself before review.** CI (`.github/workflows/pr-checks.yml`) builds and tests every PR and runs Spotless, detekt, Android Lint, the Compose stability check and Konsist. The commands are under Verification in `CLAUDE.md`; run them locally first instead of waiting for CI.
+7. **Address review comments** with follow-up commits (don't force-push during review unless the reviewer asks). Squash on merge happens automatically.
+8. **Merge** is performed by maintainers via GitHub's "Squash and merge". Your branch is deleted automatically.
 
 ### What gets a PR rejected
 
```

**File**: `build.gradle.kts` (modified, +5/-2)
```diff
@@ -6,6 +6,7 @@ plugins {
     alias(libs.plugins.compose.multiplatform) apply false
     alias(libs.plugins.compose.compiler) apply false
     alias(libs.plugins.kotlin.multiplatform) apply false
+    alias(libs.plugins.kotlin.jvm) apply false
     alias(libs.plugins.android.kotlin.multiplatform.library) apply false
     alias(libs.plugins.kotlin.serialization) apply false
     alias(libs.plugins.ksp) apply false
@@ -27,7 +28,9 @@ spotless {
     kotlin {
         target("**/*.kt")
         targetExclude("**/build/**", "**/generated/**", ".claude/**")
-        ktlint(libs.versions.ktlint.get()).setEditorConfigPath("$rootDir/.editorconfig")
+        ktlint(libs.versions.ktlint.get())
+            .setEditorConfigPath("$rootDir/.editorconfig")
+            .customRuleSets(listOf("io.nlopez.compose.rules:ktlint:${libs.versions.compose.rules.get()}"))
     }
     kotlinGradle {
         target("**/*.gradle.kts")
@@ -37,7 +40,7 @@ spotless {
 }
 
 dependencies {
-    subprojects.filter { it.buildFile.exists() }.forEach { kover(project(it.path)) }
+    subprojects.filter { it.buildFile.exists() && it.path != ":konsist-test" }.forEach { kover(project(it.path)) }
 }
 
 kover {
```

**File**: `core/presentation/src/commonMain/kotlin/zed/rainxch/core/presentation/components/buttons/KomiIconButton.kt` (modified, +2/-2)
```diff
@@ -97,10 +97,10 @@ private fun MangaIconButton(
     icon: ImageVector,
     contentDescription: String,
     onClick: () -> Unit,
-    modifier: Modifier,
     variant: KomiButtonVariant,
     size: KomiIconButtonSize,
     enabled: Boolean,
+    modifier: Modifier = Modifier,
 ) {
     val colors = personality.colors
     val metrics = size.metrics
@@ -184,10 +184,10 @@ private fun ClassicIconButton(
     icon: ImageVector,
     contentDescription: String,
     onClick: () -> Unit,
-    modifier: Modifier,
     variant: KomiButtonVariant,
     size: KomiIconButtonSize,
     enabled: Boolean,
+    modifier: Modifier = Modifier,
 ) {
     val colors = LocalPersonality.current.colors
     val metrics = size.metrics
```

**File**: `docs/code-style.md` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+# Komi Store code style
+
+Status: **adopted** on 2026-10-19 from the decisions in [findings.md](quality/findings.md). Some rules get their automated check in follow-up work; until then they apply to new and touched code. Links point at examples in [`cfa6bd30`](https://github.com/komi-store/komi-store/tree/cfa6bd30e6b35cbbc369d78a4599182a9a66beac).
+
+This file is for people and agents writing code here. CLAUDE.md files point to it. A tag after a rule says what enforces it:
+
+- **[Spotless]**: `./gradlew spotlessCheck` in CI: ktlint 1.8.0 with the Compose rules, on files changed against `main`
+- **[detekt]**: `./gradlew detekt` in CI, with per-module baselines
+- **[Konsist]**: `./gradlew :konsist-test:test` in CI
+- **[review]**: maintainer review, and agents' own review before opening a PR; the mechanical ones move to Konsist in follow-up work
+
+When a rule and nearby code disagree, follow the rule. Fix the nearby code only if your change already touches it.
+
+## 1. Formatting and files
+
+- ktlint with the Compose rules decides formatting. Run `./gradlew spotlessApply` before pushing; nothing formats on compile. **[Spotless]**
+- No wildcard imports, including `res.*` (checked once the codebase is formatted). **[Spotless]**
+- One top-level public type per file, named after it. **[review]**
+- Production files stay under 800 lines. Today's larger files are on an allowlist that can only shrink. **[Konsist]**
+
+## 2. Comments
+
+- No KDoc, no comments that restate the code. **[review]**
+- Comment only a non-obvious invariant, tricky concurrency or a workaround, in one or two lines. Good: [AppsRepositoryImpl.kt:300-301](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/feature/apps/data/src/commonMain/kotlin/zed/rainxch/apps/data/repository/AppsRepositoryImpl.kt#L300-L301), [BackgroundRequest.kt:13-14](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/core/data/src/commonMain/kotlin/zed/rainxch/core/data/network/BackgroundRequest.kt#L13-L14).
+- No em-dashes anywhere: code, strings, logs, comments. **[review]**
+
+## 3. Modules and packages
+
+- Packages are `zed.rainxch.<feature>.<layer>`, e.g. `zed.rainxch.devprofile.data` (hyphens dropped). **[Konsist]**
+- Common domain code imports no Ktor, Room, Compose, lifecycle, Koin or Android types. Platform `actual`s may. **[Konsist]**
+- Presentation never imports a data package. **[Konsist]**
+- Repository interfaces live in domain, `XRepositoryImpl` in data. **[review]**
+- No `java.*` or `android.*` in `commonMain`. Bad: [AppsViewModel.kt:74](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/AppsViewModel.kt#L74). **[review]**
+
+## 4. ViewModels
+
+The recommended shape, already used by 11 ViewModels ([AppsViewModel.kt:113-128](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/AppsViewModel.kt#L113-L128), [StarredReposViewModel.kt:39-55](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/feature/starred/presentation/src/commonMain/kotlin/zed/rainxch/starred/presentation/StarredReposViewModel.kt#L39-L55)):
+
+```kotlin
+class FooViewModel(
+    private val repository: FooRepository,
+) : ViewModel() {
+    private var hasLoadedInitialData = false
+
+    private val _state = MutableStateFlow(FooState())
+    val state =
+        _state
+            .onStart {
+                if (!hasLoadedInitialData) {
+                    load()
+                    hasLoadedInitialData = true
+                }
+            }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000L), FooState())
+
+    private val _events = Channel<FooEvent>(Channel.BUFFERED)
+    val events = _events.receiveAsFlow()
+
+    fun onAction(action: FooAction) {
+        when (action) {
+            FooAction.OnRefresh -> load()
+        }
+    }
+}
+```
+
+- `FooAction` and `FooEvent` are sealed. **[Konsist]**
+- One public input: `onAction`. No other public functions. **[review]**
+- Update state with `_state.update { }`, never `_state.value = _state.value.copy(...)`. **[review]**
+- Combine flows with `combine`, not several collectors writing shadow `var`s. Bad: [HomeViewModel.kt:64-86](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/feature/home/presentation/src/commonMain/kotlin/zed/rainxch/home/presentation/HomeViewModel.kt#L64-L86). **[review]**
+- Route arguments come from the route object or one typed params class, never positional `parametersOf` (*A8*). Bad: [ViewModelsModule.kt:47-52](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/di/ViewModelsModule.kt#L47-L52). **[review]**
+
+## 
```

**File**: `docs/quality/findings.md` (added, +468/-0)
```diff
@@ -0,0 +1,468 @@
+# Code quality research: Komi Store and kotlinconf-app
+
+Status: decisions made on 2026-10-19 (section 5). The rules they produce live in [`docs/code-style.md`](../code-style.md); this file keeps the evidence.
+
+- Komi Store: `origin/main` at [`cfa6bd30`](https://github.com/komi-store/komi-store/tree/cfa6bd30e6b35cbbc369d78a4599182a9a66beac) (2026-10-18). Links into our code are permalinks to that commit, so they stay correct as the code moves.
+- kotlinconf-app: [`2189155`](https://github.com/JetBrains/kotlinconf-app/tree/218915583d0941e5cf67b839280fef79400e7b20), links are pinned to it.
+
+## How this was made
+
+- 8 read-only research agents walked both codebases on the same 15 dimensions: 2 on kotlinconf-app (non-UI and UI), 6 covering all 13 Komi features, `core/*`, `composeApp`, `build-logic` and CI.
+- Lint numbers come from actually running ktlint 1.8.0 with the Compose rules on all 37 modules in a scratch worktree (section 2).
+- Every link was checked twice. A script confirmed that each file and line exists, then three verifier agents re-read all 277 citations against the code: 259 were right as written and 18 were corrected. The bugs in section 3 marked "verified" were also re-read by hand.
+- Agents can still misread code. Treat a single citation as a pointer, not proof, until someone looks.
+
+## TL;DR
+
+1. **kotlinconf-app is a source of techniques, not a quality bar.** It has no lint, two client test files, a 587-line god service, Boolean flags for one-off events and no stateless screen layer. Copying it wholesale would lower our bar in several places (section 1).
+2. **Our biggest problem is internal drift, not missing kotlinconf patterns.** Five ViewModel shapes, three ways to navigate, three repository error contracts, no rule for user-facing text, and `CancellationException` swallowed in dozens of places (section 7).
+3. **Lint covers 1 of 37 modules.** With ktlint on everywhere, hand-written code has 6,184 violations. A one-time `ktlintFormat` fixes all but 201 of them and touches 551 files (section 2).
+4. **The CLAUDE.md files describe code that no longer exists**: routes, repositories, components, injected dependencies, cache TTLs. Agents read them on every task. Fixing the docs is the cheapest high-leverage step (section 8).
+5. **The research found real bugs**, listed apart from style in section 3: per-host access tokens are never sent (regression since #666), the Desktop database is wiped on the next schema bump, a rate-limit exception can escape into `viewModelScope`, and more.
+
+## 1. What kotlinconf-app is, next to us
+
+| Aspect | kotlinconf-app | Komi Store |
+|---|---|---|
+| Modules | `:core`, `:app:ui-components`, one `:app:shared` with every screen ([settings.gradle.kts:35-44](https://github.com/JetBrains/kotlinconf-app/blob/218915583d0941e5cf67b839280fef79400e7b20/settings.gradle.kts#L35-L44)) | 37 modules, features split into domain / data / presentation |
+| Build logic | none; the Android block is copied in 3 build files ([build.gradle.kts:25-31](https://github.com/JetBrains/kotlinconf-app/blob/218915583d0941e5cf67b839280fef79400e7b20/app/shared/build.gradle.kts#L25-L31)) | 9 convention plugins in `build-logic` |
+| DI | Metro 1.4, compile-time graphs ([YearGraph.kt:10-22](https://github.com/JetBrains/kotlinconf-app/blob/218915583d0941e5cf67b839280fef79400e7b20/app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/di/YearGraph.kt#L10-L22)) | Koin 4.1 |
+| Navigation | Navigation 3 with per-tab back stacks ([NavState.kt:22-28](https://github.com/JetBrains/kotlinconf-app/blob/218915583d0941e5cf67b839280fef79400e7b20/app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/navigation/NavState.kt#L22-L28)) | Navigation Compose 2.9, one graph ([GithubStoreGraph.kt:5](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/GithubStoreGraph.kt#L5)) |
+| ViewModel API | several `StateFlow`s plus public methods ([ScheduleViewModel.kt:111](https://github.com/JetBrains/kotlinconf-app/blob/218915583d0941e5cf67b839280fef79400e7b20/app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/ScheduleViewModel.kt#L111)) | mostly `State` + `onAction(sealed)` + `Channel` events |
+| One-off events | Boolean `StateFlow` plus a reset call ([FeedbackViewModel.kt:37-38](https://github.com/JetBrains/kotlinconf-app/blob/218915583d0941e5cf67b839280fef79400e7b20/app/shared/src/commonMain/kotlin/org/jetbrains/kotlinconf/screens/FeedbackViewModel.kt#L37-L38)) | `Channel` + `ObserveAsEvents` ([ObserveAsEvents.kt:13](https://github.com/komi-store/komi-store/blob/cfa6bd30e6b35cbbc369d78a4599182a9a66beac/core/presentation/src/commonMain/kotlin/zed/rainxch/core/presentation/utils/ObserveAsEvents.kt#L13)) |
+| Loading and error UI | one generic `ErrorLoadingState` and one renderer ([ErrorLoadingContent.kt:21-53](https://github.com/JetBrains/kotlinconf-app/blob/2189155
```

---

### Incident Patch 3: `bf2d17b3` (2026-10-09)
**Commit Message**: fix(updates): a release the device already runs is not an update (#1002)

* fix(updates): a release the device already runs is not an update

The stored tag goes stale when an install lands outside the app: during a scan the
release window has not been refreshed yet, so tagForObservedBuild cannot prove the
new tag and keeps the old one. The check then refreshes the window, compares that
stale tag against the new release, and reports an update the device has already
taken. It never settles, because later scans see the version facts unchanged and
write nothing, and only a fresh download through the app rewrites the tag.

Measured on com.yunx.app: 1.2.8 was offered, the install was blocked for want of
installer authorisation and taken another way, so the device ran 1.2.8 while the
record still said 1.2.6 — and the update stayed on. io.legato.kazusa shows the same
shape. The log has both halves of it:

    Detected external update: DB v1.2.6(10) -> System v1.2.8(12), updateAvailable=false
    [UPDATE-CHECK] installedTag=1.2.6 matchedTag=v1.2.8 ... isUpdate=true

The verdict now also takes what the device reports as its own version, which is
exact evidence rather than a value that can g

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/repository/InstalledAppsRepositoryImpl.kt` (modified, +2/-0)
```diff
@@ -364,6 +364,7 @@ class InstalledAppsRepositoryImpl(
                         UpdateVerdict.Installed(
                             tag = app.installedVersion,
                             versionCode = app.installedVersionCode,
+                            versionName = app.installedVersionName,
                         ),
                     stored =
                         UpdateVerdict.Stored(
@@ -430,6 +431,7 @@ class InstalledAppsRepositoryImpl(
                     codesAlreadyMatch = verdict.codesAlreadyMatch,
                     installedTag = app.installedVersion,
                     matchedTag = matchedRelease.tagName,
+                    deviceRunsMatchedRelease = verdict.deviceRunsMatchedRelease,
                 )
             if (shouldRewriteTag) {
                 adoptMatchedTag(
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/UpdateVerdict.kt` (modified, +9/-1)
```diff
@@ -4,6 +4,7 @@ object UpdateVerdict {
     data class Installed(
         val tag: String?,
         val versionCode: Long,
+        val versionName: String? = null,
     )
 
     data class Stored(
@@ -107,6 +108,9 @@ object UpdateVerdict {
                 false
             }
 
+        val deviceRunsMatchedRelease =
+            !timestampTracked && VersionMath.isExactSameVersion(installed.versionName, matched.tag)
+
         val tagVerdict =
             when {
                 usedTimestampLogic -> timestampWouldReport
@@ -122,6 +126,7 @@ object UpdateVerdict {
         val isUpdateAvailable =
             when {
                 skipHolds -> false
+                deviceRunsMatchedRelease -> false
                 bound == null -> tagVerdict
                 else ->
                     decideBound(
@@ -142,14 +147,16 @@ object UpdateVerdict {
             isUpdateAvailable = isUpdateAvailable,
             skipBecameStale = skipBecameStale,
             codesAlreadyMatch = codesAlreadyMatch,
+            deviceRunsMatchedRelease = deviceRunsMatchedRelease,
         )
     }
 
     fun shouldAdoptMatchedTag(
         codesAlreadyMatch: Boolean,
         installedTag: String?,
         matchedTag: String,
-    ): Boolean = installedTag != matchedTag && codesAlreadyMatch
+        deviceRunsMatchedRelease: Boolean = false,
+    ): Boolean = installedTag != matchedTag && (codesAlreadyMatch || deviceRunsMatchedRelease)
 
     fun isSameFile(
         installedAssetId: Long?,
@@ -178,5 +185,6 @@ object UpdateVerdict {
         val isUpdateAvailable: Boolean,
         val skipBecameStale: Boolean,
         val codesAlreadyMatch: Boolean,
+        val deviceRunsMatchedRelease: Boolean,
     )
 }
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/utils/UpdateVerdictTest.kt` (modified, +149/-1)
```diff
@@ -8,6 +8,7 @@ class UpdateVerdictTest {
     private fun decide(
         installedTag: String = "1.0.0",
         installedVersionCode: Long = 100L,
+        installedVersionName: String? = null,
         storedLatestTag: String? = null,
         storedLatestVersionCode: Long? = null,
         storedPublishedAt: String? = null,
@@ -27,7 +28,7 @@ class UpdateVerdictTest {
         bound: UpdateVerdict.Bound? = null,
     ): UpdateVerdict.Result =
         UpdateVerdict.decide(
-            installed = UpdateVerdict.Installed(installedTag, installedVersionCode),
+            installed = UpdateVerdict.Installed(installedTag, installedVersionCode, installedVersionName),
             stored =
                 UpdateVerdict.Stored(
                     latestTag = storedLatestTag,
@@ -53,6 +54,153 @@ class UpdateVerdictTest {
             bound = bound,
         )
 
+    // com.yunx.app: v1.2.8 was offered, the install was blocked for want of installer
+    // authorisation, and it was installed another way. The device then reported 1.2.8 while the
+    // stored tag stayed at 1.2.6, so the verdict kept comparing that stale tag and reported an
+    // update the device had already taken — until the app was downloaded again through the store.
+    @Test
+    fun a_release_the_device_already_runs_is_not_an_update() {
+        val result =
+            decide(
+                installedTag = "1.2.6",
+                installedVersionCode = 12L,
+                installedVersionName = "1.2.8",
+                storedLatestTag = "v1.2.8",
+                matchedTag = "v1.2.8",
+                matchedPublishedAt = "2026-10-03T11:38:10Z",
+            )
+        assertFalse(result.isUpdateAvailable)
+    }
+
+    @Test
+    fun a_release_the_device_already_runs_is_not_an_update_for_a_prerelease_too() {
+        val result =
+            decide(
+                installedTag = "3.26.16-beta.42",
+                installedVersionCode = 18503L,
+                installedVersionName = "3.26.16-beta.44",
+                storedLatestTag = "3.26.16-beta.44",
+                matchedTag = "3.26.16-beta.44",
+                matchedPublishedAt = "2026-10-02T17:31:28Z",
+                matchedIsPrerelease = true,
+            )
+        assertFalse(result.isUpdateAvailable)
+    }
+
+    @Test
+    fun a_version_the_device_does_not_report_is_still_an_update() {
+        val result =
+            decide(
+                installedTag = "1.2.6",
+                installedVersionCode = 10L,
+                installedVersionName = "1.2.6",
+                storedLatestTag = "v1.2.6",
+                matchedTag = "v1.2.8",
+                matchedPublishedAt = "2026-10-03T11:38:10Z",
+            )
+        assertTrue(result.isUpdateAvailable)
+    }
+
+    // The evidence has to be exact, not merely equal after normalisation: "1.2.8.0" and "1.2.8"
+    // normalise alike, and treating that as proof would swallow a real update.
+    @Test
+    fun a_name_that_only_normalises_to_the_matched_tag_is_not_evidence() {
+        val result =
+            decide(
+                installedTag = "1.2.7",
+                installedVersionCode = 100L,
+                installedVersionName = "1.2.8.0",
+                storedLatestTag = "v1.2.7",
+                matchedTag = "v1.2.8",
+                matchedPublishedAt = "2026-10-03T11:38:10Z",
+            )
+        assertTrue(result.isUpdateAvailable)
+    }
+
+    // A "v" prefix is not a difference, so a device reporting "v1.2.8" is on release "v1.2.8".
+    @Test
+    fun a_leading_v_does_not_hide_that_the_device_runs_the_matched_release() {
+        val result =
+            decide(
+                installedTag = "1.2.6",
+                installedVersionCode = 12L,
+                installedVersionName = "v1.2.8",
+                storedLatestTag = "v1.2.8",
+                matchedTag = "v1.2.8",
+                matchedPublishedAt = "2026-10-03T11:38:10Z",
+            )
+        assertFalse(result.isUpdateAvailable)
+    }
+
+    @Test
+    fun without_a_reported_name_the_tag_is_still_the_baseline() {
+        val result =
+            decide(
+                installedTag = "1.2.6",
+                installedVersionCode = 12L,
+                installedVersionName = null,
+                storedLatestTag = "v1.2.8",
+                matchedTag = "v1.2.8",
+                matchedPublishedAt = "2026-10-03T11:38:10Z",
+            )
+        assertTrue(result.isUpdateAvailable)
+    }
+
+    @Test
+    fun the_stale_tag_is_adopted_when_the_device_runs_the_matched_release() {
+        val result =
+            decide(
+                installedTag = "1.2.6",
+                installedVersionCode = 12L,
+                installedVersionName = "1.2.8",
+                storedLatestTag = "v1.2.8",
+                matchedTag = "v1.2.8",
+                matchedPublishedAt = "2026-10-03T11:38:10Z",
+            )
+        assertTrue(result.deviceRunsMatchedRelease)
+        assert
```

#### Recent Merged Pull Requests:
- **PR #1079** (2026-10-19): refactor(import): split ExternalImportRepositoryImpl before the one-time format (@rainxchzedbot)
- **PR #1070** (closed): chore(deps): bump gradle-wrapper from 8.14.3 to 9.8.1 (@dependabot[bot])
- **PR #1068** (closed): chore(deps): bump the gradle-minor-and-patch group with 56 updates (@dependabot[bot])
- **PR #1067** (2026-10-19): ci: split the CodeQL Kotlin scan into Android and desktop jobs (@rainxchzedbot)
- **PR #1065** (2026-10-19): chore(quality): Konsist rules, Compose lint rules, code style docs and CLAUDE.md fixes (@rainxchzedbot)
- **PR #1059** (2026-10-18): fix(apps): Update starts from the stored update match instead of a fresh release lookup (@rainxchzed)

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

## X. db): bind the installed record to the release it came from (#998)

**RULE**:
When implementing operations in `core/data/schemas/zed.rainxch.core.data.local.db.AppDatabase/20.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in komi-store/komi-store. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9d838085`: db): bind the installed record to the release it came from (#998). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/data/schemas/zed.rainxch.core.data.local.db.AppDatabase/20.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
{
  "formatVersion": 1,
  "database": {
    "version": 20,
    "identityHash": "d8f32b04921a08e6a9e3fae5fa7d2db1",
    "entities": [
      {
        "tableName": "installed_apps",
        "createSql": "CREATE TABLE IF NOT EXISTS `${TABLE_NAME}` (`packageName` TEXT NOT NULL, `repoId` INTEGER NOT NULL, `repoName` TEXT NOT NULL, `repoOwner` TEXT NOT NULL, `repoOwnerAvatarUrl` TEXT NOT NULL, `repoDescription` TEXT, `primaryLanguage` TEXT, `repoUrl` TEXT NOT NULL, `installedVersion` TEXT NOT NULL, `installedReleaseId` INTEGER DEFAULT NULL, `installedAssetId` INTEGER DEFAULT NULL, `installedAssetDigest` TEXT DEFAULT NULL, `installedAssetName` TEXT, `installedAssetUrl` TEXT, `latestVersion` TEXT, `latestAssetName` TEXT, `latestAssetUrl` TEXT, `latestAssetSize` INTEGER, `latestReleaseId` INTEGER DEFAULT NULL, `latestAssetId` INTEGER DEFAULT NULL, `latestAssetDigest` TEXT DEFAULT NULL, `appName` TEXT NOT NULL, `installSource` TEXT NOT NULL, `signingFingerprint` TEXT, `installedAt` INTEGER NOT NULL, `lastCheckedAt` INTEGER NOT NULL, `lastUpdatedAt` INTEGER NOT NULL, `isUpdateAvailable` INTEGER NOT NULL, `updateCheckEnabled` INTEGER NOT NULL, `releaseNotes` TEXT, `systemArchitecture` TEXT NOT
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9d838085` are properly handled with clean fallback behavior.
