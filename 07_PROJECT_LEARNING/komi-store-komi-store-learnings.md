# Forensic Learning Record (Deep Inspection): komi-store/komi-store

> **Canonical Artifact**: `07_PROJECT_LEARNING/komi-store-komi-store-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/komi-store/komi-store](https://github.com/komi-store/komi-store))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:10.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `komi-store/komi-store`
- **Description**: 🩵 A free, open-source app store for developers' releases on GitHub, Codeberg & Forgejo — browse, discover, and install apps with one click. Formerly GitHub Store.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 19087 stars

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

### Core Architecture Module: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/local/db/initDatabase.kt`
```
package zed.rainxch.core.data.local.db

import android.content.Context
import androidx.room.Room
import kotlinx.coroutines.Dispatchers
import zed.rainxch.core.data.local.db.migrations.MIGRATION_1_2
import zed.rainxch.core.data.local.db.migrations.MIGRATION_2_3
import zed.rainxch.core.data.local.db.migrations.MIGRATION_3_4
import zed.rainxch.core.data.local.db.migrations.MIGRATION_4_5
import zed.rainxch.core.data.local.db.migrations.MIGRATION_5_6
import zed.rainxch.core.data.local.db.migrations.MIGRATION_6_7
import zed.rainxch.core.data.local.db.migrations.MIGRATION_7_8
import zed.rainxch.core.data.local.db.migrations.MIGRATION_8_9
import zed.rainxch.core.data.local.db.migrations.MIGRATION_9_10
import zed.rainxch.core.data.local.db.migrations.MIGRATION_10_11
import zed.rainxch.core.data.local.db.migrations.MIGRATION_11_12
import zed.rainxch.core.data.local.db.migrations.MIGRATION_12_13
import zed.rainxch.core.data.local.db.migrations.MIGRATION_13_14
import zed.rainxch.core.data.local.db.migrations.MIGRATION_14_15
import zed.rainxch.core.data.local.db.migrations.MIGRATION_15_16
import zed.rainxch.core.data.local.db.migrations.MIGRATION_16_17
import zed.rainxch.core.data.local.db.migrations.MIGRATION_17_18

fun initDatabase(context: Context): AppDatabase {
    val appContext = context.applicationContext
    val dbFile = appContext.getDatabasePath("github_store.db")
    return Room
        .databaseBuilder<AppDatabase>(
            context = appContext,
            name = dbFile.absolutePath,
        ).setQueryCoroutineContext(Dispatchers.IO)
        .addMigrations(
            MIGRATION_1_2,
            MIGRATION_2_3,
            MIGRATION_3_4,
            MIGRATION_4_5,
            MIGRATION_5_6,
            MIGRATION_6_7,
            MIGRATION_7_8,
            MIGRATION_8_9,
            MIGRATION_9_10,
            MIGRATION_10_11,
            MIGRATION_11_12,
            MIGRATION_12_13,
            MIGRATION_13_14,
            MIGRATION_14_15,
            MIGRATION_15_16,
            MIGRATION_16_17,
            MIGRATION_17_18,
        ).fallbackToDestructiveMigrationOnDowngrade(dropAllTables = true)
        .build()
}

```

### Core Architecture Module: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/local/db/migrations/MIGRATION_10_11.kt`
```
package zed.rainxch.core.data.local.db.migrations

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_10_11 =
    object : Migration(10, 11) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE installed_apps ADD COLUMN preferredAssetVariant TEXT")
            db.execSQL(
                "ALTER TABLE installed_apps ADD COLUMN preferredVariantStale INTEGER NOT NULL DEFAULT 0",
            )
        }
    }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #988** (2026-10-04): **bug: Codeberg/Forgejo repos fail to open from Favourites and Recently viewed**
  *Symptoms*: ## What's wrong  Follow-up to #866 / #987, which fixed this for Search only.  Favourites and Recently viewed open Details with just `repositoryId`. For a Codeberg/Forgejo repo that id is the encoded negative one from `RepoIdCodec`, and with no `sourceHost`/`owner`/`repo` Details falls through to `getRepositoryById`, which asks GitHub for `/repositories/<negative id>`. Expected result: "We couldn't load this repo."  `FavoriteRepo` and `SeenRepo` don't store `sourceHost`, and the host can't be recovered from the id (it's a one-way fingerprint). Both do store `repoUrl`, so `RepositoryUrlParser` could recover host, owner and name from it.  Affected call sites in `AppNavigation.kt`: - `FavouritesScreen`: `DetailsScreen(it)` - `RecentlyViewedScreen`: `DetailsScreen(repositoryId = repoId)` - Worth checking too: `ExternalImportScreen` (`repositoryId` + `isComingFromUpdate`, no host)  ## How to reproduce  1. Search with Codeberg as the source and open a repo (e.g. `raincord/rainManager`). 2. Favourite it, then go back. 3. Open it from Favourites, or from Recently viewed.  ## Your setup  Found by reading the code; not yet confirmed on a device.

- **Issue #961** (2026-09-10): **KomiStore cannot connect when Android Always-on VPN and "Block connections without VPN" are enabled.**
  *Symptoms*: Steps to reproduce     Enable Rethink local VPN.     Enable:         Always-on VPN         Block connections without VPN     Open KomiStore.   Expected KomiStore works through the active VPN connection.  Actual KomiStore cannot connect. Disabling Rethink VPN immediately fixes the issue.  Notes     KomiStore is allowed in Rethink.     No firewall/DNS blocks are shown.     DNS works.     IPv6 disabled.     Other apps work with the same VPN setup.  Device Moto G15 Android 15 Komi Store version 1.9.2     

- **Issue #950** (2026-09-04): **Shizuku's alternative has a problem**
  *Symptoms*: Unable to install apps while the 3rd-party app Stellar WADB is activated (Shizuku alternative)  1. Activate the Stellar app 2. Download and install apps 3. Pops up default installer options  1.9.2 (21) • Android 13  <img width="720" height="1284" alt="Image" src="https://github.com/user-attachments/assets/d8f5a6d8-c132-4645-ad1b-95dcc3a1eaf4" />
  **Post-Mortem & Fix Analysis**:
  > Kindly use the recommended installers specified. 

- **Issue #945** (2026-08-28): **"Couldn\'t load the feed  Permission denied: getsockopt"**
  *Symptoms*: ## Komi Store cannot load the feed when on "Explore" page  Komi Store is unable to load the feed when opened in its default page, "Explore"  ## How to reproduce  1. Install 1.9.2 on Windows 11 2. Try to get feed  ## Setup  Windows 11.  ## Screenshot of the issue  <img width="2520" height="918" alt="Image" src="https://github.com/user-attachments/assets/dc300f46-ab00-424b-ab05-5d55ec7bdbb9" />
  **Post-Mortem & Fix Analysis**:
  > Hi! I’d like to work on this issue. I’m going to try reproducing the `Permission denied: getsockopt` error on Windows 11 and investigate the feed/networking code to find the root cause.  If no one else is currently working on it, I’d be happy to take this issue. 
  > I think the issue is basically a repo availability issue. At the time when this issue happened, feed was probably unavailable for some reason.  Repository feed is loaded in `loadPage` function in `FeedViewModel.kt`. Error is triggered by `feedRepos.isEmpty()` check.   As of 08.28.2026, it is working as usual.

- **Issue #927** (2026-08-29): **What are these overlays and how can I remove them?**
  *Symptoms*: I've tried uninstalling and other stuff but it just keeps popping  I cannot do anything   <img width="1264" height="2780" alt="Image" src="https://github.com/user-attachments/assets/e6eadedc-be35-4eeb-bf49-ae0897440814" />
  **Post-Mortem & Fix Analysis**:
  > Just came here to report this, but you beat me to it.😅 same exact issue and they blоck the button with no way to close them. Driving me insane 

- **Issue #910** (2026-08-10): **[BUG] Sorting search results renders no results**
  *Symptoms*: > Already in the app? **Profile → Send feedback** auto-fills app version, platform, and installer. Fastest path.  ↑ this "provide feedback" option is missing.  ## What's wrong When selecting any other sort method (than the default "Best Match" the app fails to load any results.  ## How to reproduce  1. Search something popular, ie 'Shizuku' 2. Filter for Android 4. Try to sort results by anything other than "Best Match"  ## Your setup  1.9.2 · Android 16 / OneUI 8 / Galaxy S24 Ultra  <img width="720" height="928" alt="Image" src="https://github.com/user-attachments/assets/bc7a2708-66f1-41a9-af0f-303b11b72c6b" /> <img width="720" height="909" alt="Image" src="https://github.com/user-attachments/assets/69a36f63-97dc-4c10-933d-315074c822c6" /> 
  **Post-Mortem & Fix Analysis**:
  > <img width="1080" height="2193" alt="Image" src="https://github.com/user-attachments/assets/2607d270-5d63-4d2b-987d-c9a9dfa13e87" />

- **Issue #895** (2026-07-28): **Update Download Badges for "Komi Store"**
  *Symptoms*: The [download badge](https://github.com/kurikomi-labs/komi-store/blob/main/media-resources/ghs_download_badge.png) should be updated to reflect the new name.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the suggestion 

- **Issue #866** (2026-10-03): **bug: Codeberg Repos fails to load**
  *Symptoms*: ## What's wrong  I was trying to open and install the public Codeberg repository:  https://codeberg.org/raincord/rainManager  I selected Codeberg as the search source, searched for `rainManager`, and opened the `raincord/rainManager` result.  Instead of opening the repository details, Komi displayed:  > Something went wrong > We couldn't load this repo.  The repository loads normally in a browser. I was also able to install this app from ObtainX without any issues.  ## How to reproduce  1. Open Search in Komi. 2. Select Codeberg as the source. 3. Search for `rainManager`. 4. Open the `raincord/rainManager` result. 5. The repository details page fails to load.  ## Your setup  App version: 1.9.2 Android version: 16 Device: Realme GT8 Pro (RMX5210)  ## Anything else  Repository:  https://codeberg.org/raincord/rainManager  There may be an issue with the navigation parameters for non-GitHub search results.  The Codeberg result appears to navigate to `DetailsScreen` with `repositoryId` and `sourceHost`, but without the repository owner and name. The details loader appears to require both `owner` and `repo` when `sourceHost` is present, otherwise it throws:  ```text Foreign-source Details opened without owner/repo for host=codeberg.org ```  The Codeberg search-result route may need to pass all of these values:  ```text repositoryId sourceHost owner repo ```  Screenshot of the error is attached.  <img width="1440" height="3136" alt="Image" src="https://github.com/user-attachments/ass
  **Post-Mortem & Fix Analysis**:
  > I also have this issue, appver: 1.9.2, android 16
  > Same problem with every codeberg repo. For example https://codeberg.org/Freeyourgadget/Gadgetbridge 

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

### Incident Patch 1: `6eaa4885` (2026-10-04)
**Commit Message**: Fix/foreign details from history (#989)

* fix(history): preserve repository identity for details navigation

* fix(navigation): restore foreign repo details from history

* fix(history): compile, and keep custom forge hosts when opening Details

The click actions carry the screens' UI models (FavouriteRepository,
RecentlyViewedRepo), not the domain FavoriteRepo / SeenRepo, so the
previous change did not compile. Both screens now pass
(repoId, owner, repo, sourceHost) like Search does.

The host no longer goes through RepositoryUrlParser.parse without the
user's custom forge hosts, which returned null for a self-hosted Forgejo
whose name doesn't look like one and sent it to GitHub. A foreign repo
is already marked by its id, so RepoIdCodec.sourceHostOf takes the host
from the stored URL for those and returns null for GitHub repos.

---------

Co-authored-by: Rainxch Zed <[REDACTED_EMAIL]>

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/AppNavigation.kt` (modified, +13/-3)
```diff
@@ -713,8 +713,15 @@ fun AppNavigation(
                                     onNavigateBack = {
                                         navController.navigateUp()
                                     },
-                                    onNavigateToDetails = {
-                                        navController.navigate(GithubStoreGraph.DetailsScreen(it))
+                                    onNavigateToDetails = { repoId, owner, repo, sourceHost ->
+                                        navController.navigate(
+                                            GithubStoreGraph.DetailsScreen(
+                                                repositoryId = repoId,
+                                                owner = owner,
+                                                repo = repo,
+                                                sourceHost = sourceHost,
+                                            ),
+                                        )
                                     },
                                     onNavigateToDeveloperProfile = { username ->
                                         navController.navigate(
@@ -796,10 +803,13 @@ fun AppNavigation(
                                     onNavigateBack = {
                                         navController.navigateUp()
                                     },
-                                    onNavigateToDetails = { repoId ->
+                                    onNavigateToDetails = { repoId, owner, repo, sourceHost ->
                                         navController.navigate(
                                             GithubStoreGraph.DetailsScreen(
                                                 repositoryId = repoId,
+                                                owner = owner,
+                                                repo = repo,
+                                                sourceHost = sourceHost,
                                             ),
                                         )
                                     },
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/RepoIdCodec.kt` (modified, +5/-0)
```diff
@@ -14,4 +14,9 @@ object RepoIdCodec {
     }
 
     fun isForeignSource(repoId: Long): Boolean = repoId < 0L
+
+    fun sourceHostOf(repoId: Long, repoUrl: String): String? {
+        if (!isForeignSource(repoId)) return null
+        return repoUrl.substringAfter("://").substringBefore('/').lowercase().ifBlank { null }
+    }
 }
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/utils/RepoIdCodecTest.kt` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+package zed.rainxch.core.domain.utils
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertNull
+
+class RepoIdCodecTest {
+    @Test
+    fun a_github_repo_has_no_source_host() {
+        assertNull(RepoIdCodec.sourceHostOf(123L, "https://github.com/ente/ente"))
+    }
+
+    @Test
+    fun a_codeberg_repo_takes_its_host_from_the_url() {
+        val id = RepoIdCodec.encode("codeberg.org", 42L)
+        assertEquals("codeberg.org", RepoIdCodec.sourceHostOf(id, "https://codeberg.org/raincord/rainManager"))
+    }
+
+    @Test
+    fun a_custom_forge_host_is_kept_as_is() {
+        val id = RepoIdCodec.encode("codefloe.com", 7L)
+        assertEquals("codefloe.com", RepoIdCodec.sourceHostOf(id, "https://CodeFloe.com/owner/app"))
+    }
+}
```

**File**: `feature/favourites/presentation/src/commonMain/kotlin/zed/rainxch/favourites/presentation/FavouritesRoot.kt` (modified, +9/-2)
```diff
@@ -30,6 +30,7 @@ import kotlinx.collections.immutable.ImmutableList
 import kotlinx.collections.immutable.toImmutableList
 import org.jetbrains.compose.resources.stringResource
 import org.koin.compose.viewmodel.koinViewModel
+import zed.rainxch.core.domain.utils.RepoIdCodec
 import zed.rainxch.core.presentation.components.bars.KomiTopBar
 import zed.rainxch.core.presentation.components.bars.KomiTopBarSize
 import zed.rainxch.core.presentation.components.buttons.KomiButtonVariant
@@ -52,7 +53,7 @@ import zed.rainxch.githubstore.core.presentation.res.*
 @Composable
 fun FavouritesRoot(
     onNavigateBack: () -> Unit,
-    onNavigateToDetails: (repoId: Long) -> Unit,
+    onNavigateToDetails: (repoId: Long, owner: String, repo: String, sourceHost: String?) -> Unit,
     onNavigateToDeveloperProfile: (username: String) -> Unit,
     onNavigateToImportStars: () -> Unit,
     viewModel: FavouritesViewModel = koinViewModel(),
@@ -68,7 +69,13 @@ fun FavouritesRoot(
                 }
 
                 is FavouritesAction.OnRepositoryClick -> {
-                    onNavigateToDetails(action.favouriteRepository.repoId)
+                    val repo = action.favouriteRepository
+                    onNavigateToDetails(
+                        repo.repoId,
+                        repo.repoOwner,
+                        repo.repoName,
+                        RepoIdCodec.sourceHostOf(repo.repoId, repo.repoUrl),
+                    )
                 }
 
                 is FavouritesAction.OnDeveloperProfileClick -> {
```

**File**: `feature/recently-viewed/presentation/src/commonMain/kotlin/zed/rainxch/recentlyviewed/presentation/RecentlyViewedRoot.kt` (modified, +9/-2)
```diff
@@ -20,6 +20,7 @@ import androidx.compose.ui.unit.dp
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import org.jetbrains.compose.resources.stringResource
 import org.koin.compose.viewmodel.koinViewModel
+import zed.rainxch.core.domain.utils.RepoIdCodec
 import zed.rainxch.core.presentation.components.ScrollbarContainer
 import zed.rainxch.core.presentation.components.bars.KomiTopBar
 import zed.rainxch.core.presentation.components.bars.KomiTopBarSize
@@ -35,7 +36,7 @@ import zed.rainxch.recentlyviewed.presentation.components.RecentlyViewedItem
 @Composable
 fun RecentlyViewedRoot(
     onNavigateBack: () -> Unit,
-    onNavigateToDetails: (repoId: Long) -> Unit,
+    onNavigateToDetails: (repoId: Long, owner: String, repo: String, sourceHost: String?) -> Unit,
     onNavigateToDeveloperProfile: (username: String) -> Unit,
     viewModel: RecentlyViewedViewModel = koinViewModel(),
 ) {
@@ -50,7 +51,13 @@ fun RecentlyViewedRoot(
                 }
 
                 is RecentlyViewedAction.OnRepositoryClick -> {
-                    onNavigateToDetails(action.repo.repoId)
+                    val repo = action.repo
+                    onNavigateToDetails(
+                        repo.repoId,
+                        repo.repoOwner,
+                        repo.repoName,
+                        RepoIdCodec.sourceHostOf(repo.repoId, repo.repoUrl),
+                    )
                 }
 
                 is RecentlyViewedAction.OnDeveloperProfileClick -> {
```

---

### Incident Patch 2: `104c609e` (2026-10-04)
**Commit Message**: fix: stop the profile screen and every image flashing on rebuild (#968)

* fix: stop the profile screen and every image flashing on rebuild

* fix: stop the profile screen and images flashing on rebuild

Image component: replace the catch-all else with the explicit Empty state,
expose contentScale and contentDescription, and drop the redundant platform
context from the remember key. Document that the model must compare by value,
since it is used as a key.

Session handling:
- serve an expired cached profile only where a stale row is acceptable — the
  prime read and the error fallback. The hot read goes to the network again,
  instead of treating an expired row as a hit and skipping the refresh for the
  rest of the TTL.
- keep the last known profile when a read fails, rather than downgrading a
  signed-in account to (true, null) and blanking its first frame.
- cancel an in-flight profile load when the session ends, so a late emission
  cannot refill the state after sign-out or write the account back.
- reject a signed-out snapshot carrying a profile by construction.
- correct the snapshot's contract. It is null until the first successful
  observation: primeSession can fail and ge

**File**: `composeApp/proguard-rules.pro` (modified, +0/-3)
```diff
@@ -132,11 +132,8 @@
 -dontwarn androidx.datastore.**
 
 # ── Landscapist / Coil3 (Image Loading) ────────────────────────────────────
--keep class com.skydoves.landscapist.** { *; }
--keep interface com.skydoves.landscapist.** { *; }
 -keep class coil3.** { *; }
 -dontwarn coil3.**
--dontwarn com.skydoves.landscapist.**
 
 # ── Multiplatform Markdown Renderer ────────────────────────────────────────
 -keep class com.mikepenz.markdown.** { *; }
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/Main.kt` (modified, +21/-0)
```diff
@@ -8,15 +8,20 @@ import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
 import androidx.compose.runtime.remember
 import androidx.compose.ui.Modifier
+import androidx.compose.ui.platform.LocalDensity
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.navigation.compose.currentBackStackEntryAsState
 import androidx.navigation.compose.rememberNavController
 import coil3.ImageLoader
+import coil3.SingletonImageLoader
+import coil3.compose.LocalPlatformContext
 import coil3.compose.setSingletonImageLoaderFactory
+import coil3.request.ImageRequest
 import coil3.svg.SvgDecoder
 import kotlinx.coroutines.channels.Channel
 import org.koin.compose.viewmodel.koinViewModel
 import zed.rainxch.core.domain.model.appearance.AppPersonality
+import zed.rainxch.core.presentation.ProfileAvatarSpec
 import zed.rainxch.core.presentation.personality.classicPersonality
 import zed.rainxch.core.presentation.personality.mangaPersonality
 import zed.rainxch.core.presentation.personality.toMangaAccent
@@ -68,6 +73,22 @@ fun App(
 
     LaunchedEffect(Unit) { onContentPainted() }
 
+    val imageContext = LocalPlatformContext.current
+    val avatarSizePx = with(LocalDensity.current) { ProfileAvatarSpec.Size.roundToPx() }
+    LaunchedEffect(mainState.signedInAvatarUrl, avatarSizePx) {
+        mainState.signedInAvatarUrl?.let { url ->
+            runCatching {
+                SingletonImageLoader.get(imageContext).enqueue(
+                    ImageRequest
+                        .Builder(imageContext)
+                        .data(url)
+                        .size(avatarSizePx)
+                        .build(),
+                )
+            }
+        }
+    }
+
     val currentScreen = navController.currentBackStackEntryAsState().value.getCurrentScreen()
 
     HandleKeyboardEvents(navController)
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/MainState.kt` (modified, +1/-0)
```diff
@@ -19,5 +19,6 @@ data class MainState(
     val isScrollbarEnabled: Boolean = false,
     val contentWidth: ContentWidth = ContentWidth.COMPACT,
     val appLanguageTag: String? = null,
+    val signedInAvatarUrl: String? = null,
     val isAppearanceLoaded: Boolean = false,
 )
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/MainViewModel.kt` (modified, +49/-2)
```diff
@@ -9,10 +9,12 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.asStateFlow
 import kotlinx.coroutines.flow.combine
+import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
 import kotlinx.coroutines.withTimeoutOrNull
 import zed.rainxch.core.data.services.LocalizationManager
+import zed.rainxch.core.domain.logging.KomiStoreLogger
 import zed.rainxch.core.domain.model.appearance.AccentId
 import zed.rainxch.core.domain.model.appearance.AppPersonality
 import zed.rainxch.core.domain.model.appearance.MangaPaperId
@@ -30,21 +32,64 @@ class MainViewModel(
     private val userSessionRepository: UserSessionRepository,
     private val rateLimitRepository: RateLimitRepository,
     private val syncUseCase: SyncInstalledAppsUseCase,
+    private val logger: KomiStoreLogger,
     private val localizationManager: LocalizationManager,
 ) : ViewModel() {
     private val _state = MutableStateFlow(MainState())
     val state = _state.asStateFlow()
 
     init {
+        viewModelScope.launch(Dispatchers.IO) {
+            try {
+                userSessionRepository.primeSession()
+            } catch (e: CancellationException) {
+                throw e
+            } catch (e: Exception) {
+                logger.warn("Session prime failed; continuing without it: ${e.message}")
+            }
+            _state.update {
+                it.copy(
+                    signedInAvatarUrl = userSessionRepository.lastKnownSession?.profile?.imageUrl,
+                )
+            }
+        }
+
         viewModelScope.launch(Dispatchers.IO) {
             userSessionRepository
                 .isUserLoggedIn()
                 .collect { isLoggedIn ->
-                    _state.update { it.copy(isLoggedIn = isLoggedIn) }
+                    val avatarUrl =
+                        if (isLoggedIn) {
+                            userSessionRepository.lastKnownSession
+                                ?.takeIf { it.isLoggedIn }
+                                ?.profile
+                                ?.imageUrl
+                        } else {
+                            null
+                        }
+
+                    _state.update {
+                        it.copy(
+                            isLoggedIn = isLoggedIn,
+                            signedInAvatarUrl = avatarUrl,
+                        )
+                    }
 
                     if (isLoggedIn) {
                         rateLimitRepository.clear()
                     }
+
+                    if (isLoggedIn && avatarUrl == null) {
+                        launch {
+                            val fetched = userSessionRepository.getUser().first()?.imageUrl
+                            if (fetched != null &&
+                                _state.value.isLoggedIn &&
+                                userSessionRepository.lastKnownSession?.isLoggedIn == true
+                            ) {
+                                _state.update { it.copy(signedInAvatarUrl = fetched) }
+                            }
+                        }
+                    }
                 }
         }
 
@@ -113,7 +158,9 @@ class MainViewModel(
 
         viewModelScope.launch {
             userSessionRepository.sessionExpiredEvent.collect {
-                _state.update { it.copy(showSessionExpiredDialog = true) }
+                _state.update {
+                    it.copy(showSessionExpiredDialog = true, signedInAvatarUrl = null)
+                }
             }
         }
 
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/di/SharedModules.kt` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ val mainModule: Module =
                 rateLimitRepository = get(),
                 syncUseCase = get(),
                 userSessionRepository = get(),
+                logger = get(),
                 localizationManager = get(),
             )
         }
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/BottomNavigation.kt` (modified, +2/-1)
```diff
@@ -49,7 +49,8 @@ fun BottomNavigation(
         items = items,
         selectedId = selectedId,
         onSelect = { id ->
-            allowedScreens.firstOrNull { idOf(it.screen) == id }?.let { onNavigate(it.screen) }
+            val target = allowedScreens.firstOrNull { idOf(it.screen) == id }?.screen
+            if (target != null && target != currentScreen) onNavigate(target)
         },
         modifier = modifier,
     )
```

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/repository/UserSessionRepositoryImpl.kt` (modified, +74/-7)
```diff
@@ -19,10 +19,12 @@ import kotlinx.coroutines.sync.withLock
 import zed.rainxch.core.data.cache.CacheManager
 import zed.rainxch.core.data.cache.CacheManager.CacheTtl.USER_PROFILE
 import zed.rainxch.core.data.data_source.TokenStore
+import zed.rainxch.core.data.dto.GithubDeviceTokenSuccessDto
 import zed.rainxch.core.data.dto.UserProfileNetwork
 import zed.rainxch.core.data.mappers.toUserProfile
 import zed.rainxch.core.data.network.executeRequest
 import zed.rainxch.core.domain.logging.KomiStoreLogger
+import zed.rainxch.core.domain.model.account.SessionSnapshot
 import zed.rainxch.core.domain.model.account.UserProfile
 import zed.rainxch.core.domain.repository.UserSessionRepository
 import kotlin.time.Clock
@@ -53,18 +55,62 @@ class UserSessionRepositoryImpl(
 
     override suspend fun isCurrentlyUserLoggedIn(): Boolean = tokenStore.currentToken() != null
 
+    @Volatile
+    private var _lastKnownSession: SessionSnapshot? = null
+
+    override val lastKnownSession: SessionSnapshot? get() = _lastKnownSession
+
+    private fun recordSession(isLoggedIn: Boolean, profile: UserProfile?) {
+        _lastKnownSession = SessionSnapshot(isLoggedIn, profile)
+    }
+
+    override fun clearLastKnownSession() {
+        recordSession(isLoggedIn = false, profile = null)
+    }
+
+    private suspend fun ownedCachedProfile(
+        token: GithubDeviceTokenSuccessDto,
+        allowStale: Boolean,
+    ): UserProfile? {
+        val stored =
+            cacheManager.get<String>(CACHE_OWNER_KEY)
+                ?: if (allowStale) cacheManager.getStale<String>(CACHE_OWNER_KEY) else null
+        val current = ownershipStamp(token)
+        if (stored != null && current != null && stored != current) return null
+        return cacheManager.get<UserProfile>(CACHE_KEY)
+            ?: if (allowStale) cacheManager.getStale<UserProfile>(CACHE_KEY) else null
+    }
+
+    private fun ownershipStamp(token: GithubDeviceTokenSuccessDto): String? =
+        token.savedAtEpochMillis?.toString()
+
+    private suspend fun isCurrentToken(token: GithubDeviceTokenSuccessDto): Boolean =
+        tokenStore.currentToken()?.accessToken == token.accessToken
+
+    override suspend fun primeSession() {
+        val token = tokenStore.currentToken()
+        val profile = token?.let { ownedCachedProfile(it, allowStale = true) }
+        recordSession(token != null, profile)
+    }
+
     override fun getUser(): Flow<UserProfile?> = flow {
         val token = tokenStore.currentToken()
         if (token == null) {
             cacheManager.invalidate(CACHE_KEY)
+            recordSession(isLoggedIn = false, profile = null)
             emit(null)
             return@flow
         }
 
-        val cached = cacheManager.get<UserProfile>(CACHE_KEY)
+        val cached = ownedCachedProfile(token, allowStale = false)
         if (cached != null) {
             logger.debug("Profile cache hit")
-            emit(cached)
+            if (isCurrentToken(token)) {
+                recordSession(isLoggedIn = true, profile = cached)
+                emit(cached)
+            } else {
+                emit(null)
+            }
             return@flow
         }
 
@@ -79,18 +125,35 @@ class UserSessionRepositoryImpl(
 
             val userProfile = networkProfile.toUserProfile()
             cacheManager.put(CACHE_KEY, userProfile, USER_PROFILE)
+            ownershipStamp(token)?.let { cacheManager.put(CACHE_OWNER_KEY, it, USER_PROFILE) }
             logger.debug("Fetched and cached user profile: ${userProfile.username}")
-            emit(userProfile)
+            if (isCurrentToken(token)) {
+                recordSession(isLoggedIn = true, profile = userProfile)
+                emit(userProfile)
+            } else {
+                emit(null)
+            }
         } catch (e: CancellationException) {
             throw e
         } catch (e: Exception) {
             logger.error("Failed to fetch user profile: ${e.message}")
 
-            val stale = cacheManager.getStale<UserProfile>(CACHE_KEY)
-            if (stale != null) {
-                logger.debug("Using stale cached profile as fallback")
-                emit(stale)
+            val fallback = ownedCachedProfile(token, allowStale = true)
+            if (fallback != null) {
+                logger.debug("Using cached profile as fallback")
+                if (isCurrentToken(token)) {
+                    recordSession(isLoggedIn = true, profile = fallback)
+                    emit(fallback)
+                } else {
+                    emit(null)
+                }
             } else {
+                if (isCurrentToken(token)) {
+                    val previous = _lastKnownSession?.takeIf { it.isLoggedIn }?.profile
+                    if (previous != null) {
+                        recordSession(isLoggedIn = true, profile = previous)
+                    }
+                }
                 emit(null)
             }
         }
@@ -133,6 +196,8 @@ class UserSessi
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/model/account/SessionSnapshot.kt` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+package zed.rainxch.core.domain.model.account
+
+data class SessionSnapshot(
+    val isLoggedIn: Boolean,
+    val profile: UserProfile?,
+) {
+    init {
+        require(isLoggedIn || profile == null) {
+            val carried = profile?.username
+            "A signed-out snapshot cannot carry a profile: isLoggedIn=$isLoggedIn, " +
+                "profile=$carried"
+        }
+    }
+}
```

---

### Incident Patch 3: `f977ff52` (2026-10-04)
**Commit Message**: fix(updates): a failed check keeps the update it found before (#1008)

When the release fetch came back empty, which is what a failed fetch
looks like (backend error, rate limit, network), checkForUpdates cleared
the stored latest version and the "update available" flag. On 2026-10-04
the backend returned 403 for many repos during its quiet window; Ente
Auth (4.4.24 -> 4.4.25) and Ensu (0.1.19 -> 0.1.20) lost their pending
updates and showed as up to date. Anyone checking in those hours got the
same.

An empty window now keeps the stored state and leaves lastCheckedAt alone
so the next check retries. shouldRetainSnapshotBaseline, which only fed
that clearing, is removed with its tests.

Also: in a monorepo, the selected "Photos" app chip in the Details header
could sit scrolled off-screen when the row had last scrolled to an
installed app's chip; the row now scrolls to it.

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/repository/InstalledAppsRepositoryImpl.kt` (modified, +5/-15)
```diff
@@ -264,19 +264,6 @@ class InstalledAppsRepositoryImpl(
         return null
     }
 
-    private suspend fun recordTransientFailure(
-        installedTag: String?,
-        storedLatestTag: String?,
-        packageName: String,
-    ) {
-        val now = System.currentTimeMillis()
-        if (VersionMath.shouldRetainSnapshotBaseline(installedTag, storedLatestTag)) {
-            installedAppsDao.updateLastChecked(packageName, now)
-        } else {
-            installedAppsDao.clearUpdateMetadata(packageName, now)
-        }
-    }
-
     private suspend fun recordUnmatchedRelease(packageName: String) {
         installedAppsDao.clearUpdateFlagKeepBaseline(packageName, System.currentTimeMillis())
     }
@@ -311,9 +298,12 @@ class InstalledAppsRepositoryImpl(
                     sourceHost = app.sourceHost,
                 )
 
+            // An empty window is a failed fetch (backend error, rate limit, network), not
+            // proof the repo lost its releases. Keep what the last good check found and
+            // leave lastCheckedAt alone so the next check retries.
             if (releases.isEmpty()) {
-                recordTransientFailure(app.installedVersion, app.latestVersion, packageName)
-                return false
+                Logger.d { "No releases for ${app.appName} this time; keeping its stored update state" }
+                return app.isUpdateAvailable
             }
 
             val compiledFilter =
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/VersionMath.kt` (modified, +0/-8)
```diff
@@ -144,14 +144,6 @@ object VersionMath {
         return hasHexTailAfterNumericPrefix(normalizeVersion(version))
     }
 
-    fun shouldRetainSnapshotBaseline(
-        installedTag: String?,
-        storedLatestTag: String?,
-    ): Boolean =
-        isTimestampTrackedTag(storedLatestTag) ||
-            isTimestampTrackedTag(installedTag) ||
-            !versionsReconcilable(installedTag, storedLatestTag)
-
     internal fun parsePublishedAtToInstant(raw: String?): Instant? {
         val trimmed = raw?.trim().orEmpty()
         if (trimmed.isEmpty()) return null
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/utils/UpdateVerdictTest.kt` (modified, +0/-23)
```diff
@@ -492,29 +492,6 @@ class UpdateVerdictTest {
         assertTrue(UpdateVerdict.shouldAdoptMatchedTag(true, "1.0.0", "2.0.0"))
     }
 
-    @Test
-    fun snapshot_baseline_survives_when_only_the_installed_side_is_timestamp_tracked() {
-        assertFalse(VersionMath.isTimestampTrackedTag("1.1.0-beta.2"))
-        assertFalse(VersionMath.isTimestampTrackedTag("1.0.0-abc1234"))
-
-        assertTrue(
-            VersionMath.shouldRetainSnapshotBaseline(
-                installedTag = "1.0.0-abc1234",
-                storedLatestTag = "1.1.0-beta.2",
-            ),
-        )
-    }
-
-    @Test
-    fun snapshot_baseline_is_cleared_for_a_plain_comparable_pair() {
-        assertFalse(
-            VersionMath.shouldRetainSnapshotBaseline(
-                installedTag = "1.0.0",
-                storedLatestTag = "1.1.0",
-            ),
-        )
-    }
-
     @Test
     fun a_rebuilt_nightly_is_reported_from_its_release_identity_alone() {
         val result =
```

**File**: `feature/details/presentation/src/commonMain/kotlin/zed/rainxch/details/presentation/components/AppHeader.kt` (modified, +8/-3)
```diff
@@ -315,9 +315,14 @@ fun AppHeader(
                 val selectedIndex =
                     switcherApps.indexOfFirst { it.packageName == installedApp?.packageName }
                 val rowState = rememberLazyListState()
-                LaunchedEffect(selectedIndex) {
-                    if (selectedIndex < 0) return@LaunchedEffect
-                    val target = firstChipIndex + selectedIndex
+                val targetIndex = when {
+                    showAppLabel -> 0
+                    selectedIndex >= 0 -> firstChipIndex + selectedIndex
+                    else -> -1
+                }
+                LaunchedEffect(targetIndex) {
+                    if (targetIndex < 0) return@LaunchedEffect
+                    val target = targetIndex
                     val layout = snapshotFlow { rowState.layoutInfo }
                         .first { it.visibleItemsInfo.isNotEmpty() }
                     val item = layout.visibleItemsInfo.firstOrNull { it.index == target }
```

---

### Incident Patch 4: `bb764970` (2026-10-04)
**Commit Message**: fix(updates): run background checks on Android 12+, check every 12 hours (#1006)

On Android 12 and newer the periodic UpdateCheckWorker never checked
anything while the app was in the background: its first step,
setForeground(...), throws ("startForegroundService() not allowed due to
mAllowStartForeground false"), the worker returned retry and finally
failure. Background update checks, update notifications and the
auto-update they trigger only happened when the work ran with the app
open. AutoUpdateWorker had the same call.

- both workers treat the foreground notification as optional
  (setForegroundIfAllowed) and keep going when Android refuses it; the
  check is short and fits WorkManager's normal execution window
- default check interval 12 hours instead of 6, so restoring background
  checks adds half the traffic it otherwise would
- schedule() updates the queued periodic work (UPDATE keeps its timing)
  instead of keeping it, so existing installs on the old 6-hour default
  move to 12 hours; a user-picked interval is kept
- the boot receiver schedules with the saved interval instead of the
  built-in default

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/AutoUpdateWorker.kt` (modified, +2/-2)
```diff
@@ -88,13 +88,13 @@ class AutoUpdateWorker(
                 return Result.success()
             }
 
-            setForeground(createForegroundInfo("Updating apps...", 0, appsWithUpdates.size))
+            setForegroundIfAllowed(createForegroundInfo("Updating apps...", 0, appsWithUpdates.size))
 
             val successfulApps = mutableListOf<String>()
             val failedApps = mutableListOf<String>()
 
             appsWithUpdates.forEachIndexed { index, app ->
-                setForeground(
+                setForegroundIfAllowed(
                     createForegroundInfo(
                         "Updating ${app.appName}...",
                         index + 1,
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/BootReceiver.kt` (modified, +11/-1)
```diff
@@ -25,7 +25,17 @@ class BootReceiver : BroadcastReceiver() {
                 }
             if (enabled) {
                 Logger.i { "BootReceiver: Device booted, scheduling update checks" }
-                UpdateScheduler.schedule(context)
+                val intervalHours =
+                    runCatching {
+                        runBlocking {
+                            GlobalContext.get().get<TweaksRepository>().getUpdateCheckInterval().first()
+                        }
+                    }.getOrNull()
+                if (intervalHours != null) {
+                    UpdateScheduler.schedule(context, intervalHours)
+                } else {
+                    UpdateScheduler.schedule(context)
+                }
             } else {
                 Logger.i { "BootReceiver: Device booted, update check disabled — skipping" }
                 UpdateScheduler.cancel(context)
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/ForegroundIfAllowed.kt` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+package zed.rainxch.core.data.services
+
+import androidx.work.CoroutineWorker
+import androidx.work.ForegroundInfo
+import co.touchlab.kermit.Logger
+import kotlin.coroutines.cancellation.CancellationException
+
+// Android 12+ refuses to start a foreground service while the app is in the background,
+// which is when periodic work runs. The work doesn't need one, so it carries on without
+// the notification instead of failing before it starts.
+internal suspend fun CoroutineWorker.setForegroundIfAllowed(info: ForegroundInfo) {
+    try {
+        setForeground(info)
+    } catch (e: CancellationException) {
+        throw e
+    } catch (e: Exception) {
+        Logger.i { "${this::class.simpleName}: running without foreground notification (${e.message})" }
+    }
+}
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/UpdateCheckWorker.kt` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ class UpdateCheckWorker(
         try {
             Logger.i { "UpdateCheckWorker: Starting periodic update check" }
 
-            setForeground(createForegroundInfo("Checking for updates..."))
+            setForegroundIfAllowed(createForegroundInfo("Checking for updates..."))
 
             val syncResult = syncInstalledAppsUseCase()
             if (syncResult.isFailure) {
```

**File**: `core/data/src/androidMain/kotlin/zed/rainxch/core/data/services/UpdateScheduler.kt` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@ import co.touchlab.kermit.Logger
 import java.util.concurrent.TimeUnit
 
 object UpdateScheduler {
-    private const val DEFAULT_INTERVAL_HOURS = 6L
+    private const val DEFAULT_INTERVAL_HOURS = 12L
     private const val IMMEDIATE_CHECK_WORK_NAME = "github_store_immediate_update_check"
 
     fun schedule(
@@ -41,7 +41,7 @@ object UpdateScheduler {
             .getInstance(context)
             .enqueueUniquePeriodicWork(
                 uniqueWorkName = UpdateCheckWorker.WORK_NAME,
-                existingPeriodicWorkPolicy = ExistingPeriodicWorkPolicy.KEEP,
+                existingPeriodicWorkPolicy = ExistingPeriodicWorkPolicy.UPDATE,
                 request = request,
             )
 
```

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/repository/TweaksRepositoryImpl.kt` (modified, +1/-1)
```diff
@@ -467,7 +467,7 @@ class TweaksRepositoryImpl(
     }
 
     companion object {
-        private const val DEFAULT_UPDATE_CHECK_INTERVAL_HOURS = 6L
+        private const val DEFAULT_UPDATE_CHECK_INTERVAL_HOURS = 12L
         private const val MIGRATION_MARKER = "__migrated_from_datastore_v1__"
 
         private const val K_THEME = "app_theme"
```

**File**: `feature/tweaks/presentation/src/commonMain/kotlin/zed/rainxch/tweaks/presentation/TweaksState.kt` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ data class TweaksState(
     val rootAvailability: RootAvailability = RootAvailability.UNAVAILABLE,
     val autoUpdateEnabled: Boolean = false,
     val updateCheckEnabled: Boolean = true,
-    val updateCheckIntervalHours: Long = 6L,
+    val updateCheckIntervalHours: Long = 12L,
     val includePreReleases: Boolean = false,
     val isHideSeenEnabled: Boolean = false,
     val isScrollbarEnabled: Boolean = false,
```

---

### Incident Patch 5: `87fff64d` (2026-10-03)
**Commit Message**: fix(updates): keep apps sharing a repo from tracking each other's releases (#993)

* fix(details): tell apart apps that differ only by version, open on their own release

Godot ships org.godotengine.editor.v3 and .v4 from one repo with asset
names that match on glob and stem (Godot_v3.6.3-stable_android_editor.apk
vs Godot_v4.7.2-...). Both Library cards opened on 3.6.3, the newest
release, bound to whichever app was installed last.

- Move installed-app ownership into AssetOwnership (core/domain) with
  tests, so the update checker can share it.
- Break filter/glob/stem ties by major version (AssetVariant.versionMajor).
- Only treat a missing asset family as a rename when every release with
  the new name is newer than every release with the old one. Apps
  released side by side (K9MAIL_* / THUNDERBIRD_* tags) interleave and are
  no longer bound to each other's APK.
- loadInitial opens on the newest release in the installed channel whose
  chosen APK belongs to the opened app, instead of the newest release.

* docs: note AssetOwnership in the core util list

* fix(details): never uninstall a different app from the downgrade dialog

"Uninstall first" removed whatever app the scree

**File**: `core/data/src/commonMain/kotlin/zed/rainxch/core/data/repository/InstalledAppsRepositoryImpl.kt` (modified, +26/-22)
```diff
@@ -35,6 +35,7 @@ import zed.rainxch.core.domain.model.smart_detect.MatchingPreview
 import zed.rainxch.core.domain.repository.InstalledAppsRepository
 import zed.rainxch.core.domain.system.Installer
 import zed.rainxch.core.domain.utils.AssetFilter
+import zed.rainxch.core.domain.utils.AssetOwnership
 import zed.rainxch.core.domain.utils.AssetVariant
 import zed.rainxch.core.domain.utils.UpdateVerdict
 import zed.rainxch.core.domain.utils.VersionMath
@@ -181,9 +182,22 @@ class InstalledAppsRepositoryImpl(
         pickedSiblingCount: Int?,
         trackedPackageName: String,
         installedAssetName: String?,
+        repoApps: List<InstalledApp>,
     ): ResolvedRelease? {
         if (releases.isEmpty()) return null
 
+        val self = repoApps.firstOrNull { it.packageName == trackedPackageName }
+
+        // An APK no installed app owns is usually a sibling app the user never installed
+        // (monorepos). Only an app with no asset name or glob to compare can't tell.
+        fun belongsElsewhere(asset: GithubAsset, releaseAssets: List<GithubAsset>): Boolean {
+            if (self == null) return false
+            if (!AssetOwnership.canOwn(self, asset.name)) return true
+            val owner = AssetOwnership.ownerOf(asset.name, repoApps, releaseAssets, releases)
+                ?: return self.installedAssetName != null || !self.assetGlobPattern.isNullOrBlank()
+            return owner.packageName != trackedPackageName
+        }
+
         val candidates =
             if (filter != null && !fallbackToOlderReleases) {
                 releases.take(1)
@@ -200,21 +214,24 @@ class InstalledAppsRepositoryImpl(
             val installableForPlatform =
                 release.assets.filter { installer.isAssetInstallable(it.name) }
             val installableForApp =
-                if (filter == null) installableForPlatform
-                else installableForPlatform.filter { filter.matches(it.name) }
+                (
+                    if (filter == null) installableForPlatform
+                    else installableForPlatform.filter { filter.matches(it.name) }
+                ).filterNot { belongsElsewhere(it, installableForPlatform) }
 
             if (installableForApp.isEmpty()) continue
 
+            val sameApp = AssetOwnership.narrowToApp(installableForApp, installedAssetName)
             val fingerprintMatch =
                 AssetVariant.resolvePreferredAsset(
-                    assets = installableForApp,
+                    assets = sameApp,
                     pinnedVariant = preferredVariant,
                     pinnedTokens = preferredTokens.takeIf { it.isNotEmpty() },
                     pinnedGlob = preferredGlob,
                 )
 
             val positionMatch =
-                if (fingerprintMatch == null && hasAnyPin) {
+                if (fingerprintMatch == null && hasAnyPin && sameApp.size == installableForApp.size) {
                     AssetVariant.resolveBySamePosition(
                         assets = installableForApp,
                         originalIndex = pickedIndex,
@@ -224,25 +241,11 @@ class InstalledAppsRepositoryImpl(
                     null
                 }
 
-            val installedStem =
-                installedAssetName
-                    ?.let { AssetVariant.extractBaseStem(it) }
-                    ?.takeIf { it.isNotEmpty() }
             val autoPickPool =
-                AssetVariant
-                    .filterByPackageFlavor(installableForApp, trackedPackageName)
-                    .let { pool ->
-                        if (installedStem == null) {
-                            pool
-                        } else {
-                            val matching =
-                                pool.filter {
-                                    AssetVariant.extractBaseStem(it.name) == installedStem
-                                }
-
-                            matching.ifEmpty { pool }
-                        }
-                    }
+                AssetOwnership.narrowToApp(
+                    AssetVariant.filterByPackageFlavor(installableForApp, trackedPackageName),
+                    installedAssetName,
+                )
             val primary = fingerprintMatch
                 ?: positionMatch
                 ?: installer.choosePrimaryAsset(autoPickPool)
@@ -329,6 +332,7 @@ class InstalledAppsRepositoryImpl(
                 pickedSiblingCount = app.pickedAssetSiblingCount,
                 trackedPackageName = app.packageName,
                 installedAssetName = app.installedAssetName,
+                repoApps = installedAppsDao.getAppsByRepoId(app.repoId).map { it.toDomain() },
             )
 
             if (resolved == null) {
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/AssetOwnership.kt` (modified, +7/-4)
```diff
@@ -46,10 +46,13 @@ object AssetOwnership {
         }
         if (byStem.isNotEmpty()) return byStem.closestVersionLine(assetName)
 
-        val sole = apps.singleOrNull()?.takeIf { canOwn(it, assetName) } ?: return null
-        val soleAsset = sole.installedAssetName ?: return sole
-        if (releaseAssets.any { isSameApp(it.name, soleAsset) }) return null
-        return sole.takeIf { isRename(soleAsset, assetName, releaseHistory) }
+        val missing = apps.filter { app ->
+            canOwn(app, assetName) &&
+                app.installedAssetName?.let { own -> releaseAssets.none { isSameApp(it.name, own) } } != false
+        }
+        val renamed = missing.singleOrNull() ?: return null
+        val renamedFrom = renamed.installedAssetName ?: return renamed.takeIf { apps.size == 1 }
+        return renamed.takeIf { isRename(renamedFrom, assetName, releaseHistory) }
     }
 
     // Newest first. A rename never goes back: every release with the new name is newer than
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/utils/AssetOwnershipTest.kt` (modified, +65/-0)
```diff
@@ -152,6 +152,57 @@ class AssetOwnershipTest {
         )
     }
 
+    @Test
+    fun aSoleAppInAMonorepoDoesNotOwnTheOtherAppsReleases() {
+        val auth = app("io.ente.auth.independent", "ente-auth-v4.4.24.apk", installedVersion = "auth-v4.4.24")
+        val photos = listOf(asset("ente-photos-v1.3.64.apk"))
+        val ensu = listOf(asset("ensu-v0.1.20.apk"))
+        val authNewest = listOf(asset("ente-auth-v4.4.25.apk"))
+        val history = listOf(
+            release("photos-v1.3.64", photos),
+            release("ensu-v0.1.20", ensu),
+            release("auth-v4.4.25", authNewest),
+            release("photos-v1.3.59", listOf(asset("ente-photos-v1.3.59.apk"))),
+            release("auth-v4.4.24", listOf(asset("ente-auth-v4.4.24.apk"))),
+            release("photos-v1.3.57", listOf(asset("ente-photos-v1.3.57.apk"))),
+            release("ensu-v0.1.17", listOf(asset("ensu-v0.1.17.apk"))),
+        )
+        assertNull(AssetOwnership.ownerOf("ente-photos-v1.3.64.apk", listOf(auth), photos, history))
+        assertNull(AssetOwnership.ownerOf("ensu-v0.1.20.apk", listOf(auth), ensu, history))
+        assertEquals(auth, AssetOwnership.ownerOf("ente-auth-v4.4.25.apk", listOf(auth), authNewest, history))
+    }
+
+    @Test
+    fun aSiblingNobodyInstalledIsOwnedByNoneOfTheInstalledApps() {
+        val auth = app("io.ente.auth.independent", "ente-auth-v4.4.24.apk")
+        val ensu = app("io.ente.ensu", "ensu-v0.1.19.apk")
+        val photos = listOf(asset("ente-photos-v1.3.64.apk"))
+        val history = listOf(
+            release("photos-v1.3.64", photos),
+            release("ensu-v0.1.20", listOf(asset("ensu-v0.1.20.apk"))),
+            release("auth-v4.4.25", listOf(asset("ente-auth-v4.4.25.apk"))),
+            release("photos-v1.3.63", listOf(asset("ente-photos-v1.3.63.apk"))),
+        )
+        assertNull(AssetOwnership.ownerOf("ente-photos-v1.3.64.apk", listOf(auth, ensu), photos, history))
+        assertEquals(
+            ensu,
+            AssetOwnership.ownerOf("ensu-v0.1.20.apk", listOf(auth, ensu), listOf(asset("ensu-v0.1.20.apk")), history),
+        )
+    }
+
+    @Test
+    fun oneRenamedAppAmongSeveralKeepsItsUpdates() {
+        val renamed = app("com.app", "OldName-1.0.apk")
+        val other = app("com.app.companion", "Companion-1.0.apk")
+        val newest = listOf(asset("NewName-2.0.apk"), asset("Companion-2.0.apk"))
+        val history = listOf(
+            release("2.0", newest),
+            release("1.0", listOf(asset("OldName-1.0.apk"), asset("Companion-1.0.apk"))),
+        )
+        assertEquals(renamed, AssetOwnership.ownerOf("NewName-2.0.apk", listOf(renamed, other), newest, history))
+        assertEquals(other, AssetOwnership.ownerOf("Companion-2.0.apk", listOf(renamed, other), newest, history))
+    }
+
     @Test
     fun aMonoreposNewAppIsNotARenameOfTheInstalledOne() {
         val auth = app("io.ente.auth.independent", "ente-auth-v4.4.25.apk")
@@ -231,6 +282,20 @@ class AssetOwnershipTest {
         assertEquals(abiRelease, AssetOwnership.narrowToApp(abiRelease, null))
     }
 
+    @Test
+    fun pinnedTokensResolveWithinTheAppsOwnFamily() {
+        val pinned = setOf("stable")
+        assertEquals(
+            "Godot_v4.7.2-stable_android_debug.perfetto.apk",
+            AssetVariant.resolvePreferredAsset(godot472, null, pinned)?.name,
+        )
+        val sameApp = AssetOwnership.narrowToApp(godot472, godotV4.installedAssetName)
+        assertEquals(
+            "Godot_v4.7.2-stable_android_editor.apk",
+            AssetVariant.resolvePreferredAsset(sameApp, null, pinned)?.name,
+        )
+    }
+
     @Test
     fun emptyStemsNeverMatch() {
         assertFalse(AssetOwnership.isSameApp("arm64-v8a.apk", "x86.apk"))
```

---

### Incident Patch 6: `18591322` (2026-10-03)
**Commit Message**: fix(details): tell apart apps that differ only by version, open on their own release (#992)

* fix(details): tell apart apps that differ only by version, open on their own release

Godot ships org.godotengine.editor.v3 and .v4 from one repo with asset
names that match on glob and stem (Godot_v3.6.3-stable_android_editor.apk
vs Godot_v4.7.2-...). Both Library cards opened on 3.6.3, the newest
release, bound to whichever app was installed last.

- Move installed-app ownership into AssetOwnership (core/domain) with
  tests, so the update checker can share it.
- Break filter/glob/stem ties by major version (AssetVariant.versionMajor).
- Only treat a missing asset family as a rename when every release with
  the new name is newer than every release with the old one. Apps
  released side by side (K9MAIL_* / THUNDERBIRD_* tags) interleave and are
  no longer bound to each other's APK.
- loadInitial opens on the newest release in the installed channel whose
  chosen APK belongs to the opened app, instead of the newest release.

* docs: note AssetOwnership in the core util list

* fix(details): never uninstall a different app from the downgrade dialog

"Uninstall first" removed whatever app

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ Koin. Feature modules in `data/di/SharedModule.kt`. ViewModels in `composeApp/..
 
 ## Core repositories (`core/domain`)
 
-`FavouritesRepository`, `StarredRepository`, `InstalledAppsRepository`, `SeenReposRepository`, `HiddenReposRepository`, `SearchHistoryRepository`, `TweaksRepository`, `AuthenticationState`, `ThemesRepository`, `ProxyRepository`, `RateLimitRepository`, `ExternalImportRepository`, `TelemetryRepository`, `HostTokenRepository` (per-host PATs, KSafe-encrypted). Network: `ForgejoApiClient` + `ForgejoClientRegistry` (per-host Ktor clients, thread-safe via Mutex, proxy-aware, closes cached engines on shutdown / proxy change). Util: `AssetVariant` (token/glob/stem fingerprinting), `assetPlatformOf`, `RepoIdCodec` (23-bit host fingerprint + 40-bit raw id packed into the existing 64-bit `repoId` slot — sign bit = foreign source), `RepositoryUrlParser` (recognises GitHub + Codeberg + gitea.com + git.disroot.org + user-added forge hosts). System interfaces: `Installer`, `InstallerStatusProvider`, `PackageMonitor`, `SystemInstallSerializer`.
+`FavouritesRepository`, `StarredRepository`, `InstalledAppsRepository`, `SeenReposRepository`, `HiddenReposRepository`, `SearchHistoryRepository`, `TweaksRepository`, `AuthenticationState`, `ThemesRepository`, `ProxyRepository`, `RateLimitRepository`, `ExternalImportRepository`, `TelemetryRepository`, `HostTokenRepository` (per-host PATs, KSafe-encrypted). Network: `ForgejoApiClient` + `ForgejoClientRegistry` (per-host Ktor clients, thread-safe via Mutex, proxy-aware, closes cached engines on shutdown / proxy change). Util: `AssetVariant` (token/glob/stem fingerprinting, `versionMajor`), `AssetOwnership` (which installed app owns an asset when a repo ships several apps: filter → glob → stem, ties by major version; shared by Details and the update checker), `assetPlatformOf`, `RepoIdCodec` (23-bit host fingerprint + 40-bit raw id packed into the existing 64-bit `repoId` slot — sign bit = foreign source), `RepositoryUrlParser` (recognises GitHub + Codeberg + gitea.com + git.disroot.org + user-added forge hosts). System interfaces: `Installer`, `InstallerStatusProvider`, `PackageMonitor`, `SystemInstallSerializer`.
 
 ## Tech
 
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/AssetOwnership.kt` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+package zed.rainxch.core.domain.utils
+
+import zed.rainxch.core.domain.model.account.github.GithubAsset
+import zed.rainxch.core.domain.model.account.github.GithubRelease
+import zed.rainxch.core.domain.model.installation.InstalledApp
+
+object AssetOwnership {
+
+    fun isSameApp(assetName: String, otherAssetName: String): Boolean {
+        val stem = AssetVariant.extractBaseStem(assetName)
+        return stem.isNotEmpty() && stem == AssetVariant.extractBaseStem(otherAssetName)
+    }
+
+    fun narrowToApp(assets: List<GithubAsset>, anchorAssetName: String?): List<GithubAsset> {
+        if (anchorAssetName == null) return assets
+        return assets.filter { isSameApp(it.name, anchorAssetName) }.ifEmpty { assets }
+    }
+
+    fun ownerOf(
+        assetName: String,
+        apps: List<InstalledApp>,
+        releaseAssets: List<GithubAsset>,
+        releaseHistory: List<GithubRelease>,
+    ): InstalledApp? {
+        if (apps.isEmpty()) return null
+
+        val byFilter = apps.filter { app ->
+            AssetFilter.parse(app.assetFilterRegex)?.getOrNull()?.matches(assetName) == true
+        }
+        if (byFilter.isNotEmpty()) return byFilter.closestVersionLine(assetName)
+
+        val candidates = apps.filter { canOwn(it, assetName) }
+
+        val glob = AssetVariant.deriveGlob(assetName)
+        if (glob != null) {
+            val byGlob = candidates.filter { app ->
+                val appGlob =
+                    app.installedAssetName?.let(AssetVariant::deriveGlob) ?: app.assetGlobPattern
+                appGlob == glob
+            }
+            if (byGlob.isNotEmpty()) return byGlob.closestVersionLine(assetName)
+        }
+
+        val byStem = candidates.filter { app ->
+            app.installedAssetName?.let { isSameApp(it, assetName) } == true
+        }
+        if (byStem.isNotEmpty()) return byStem.closestVersionLine(assetName)
+
+        val sole = apps.singleOrNull()?.takeIf { canOwn(it, assetName) } ?: return null
+        val soleAsset = sole.installedAssetName ?: return sole
+        if (releaseAssets.any { isSameApp(it.name, soleAsset) }) return null
+        return sole.takeIf { isRename(soleAsset, assetName, releaseHistory) }
+    }
+
+    // Newest first. A rename never goes back: every release with the new name is newer than
+    // every release with the old one. Apps released side by side (K-9 / Thunderbird) interleave.
+    private fun isRename(
+        fromAssetName: String,
+        toAssetName: String,
+        releaseHistory: List<GithubRelease>,
+    ): Boolean {
+        val newestWithOld = releaseHistory.indexOfFirst { release ->
+            release.assets.any { isSameApp(it.name, fromAssetName) }
+        }
+        if (newestWithOld < 0) return true
+        val oldestWithNew = releaseHistory.indexOfLast { release ->
+            release.assets.any { isSameApp(it.name, toAssetName) }
+        }
+        if (oldestWithNew > newestWithOld) return false
+        if (oldestWithNew < 0) return true
+        // A monorepo's brand-new app also starts after the installed one's last release;
+        // its tags (locker-v1.0.0 vs auth-v4.4.25) still say it is another app.
+        return ReleaseLines.of(releaseHistory[oldestWithNew].tagName) ==
+            ReleaseLines.of(releaseHistory[newestWithOld].tagName)
+    }
+
+    // A package that names its major version (org.godotengine.editor.v4) can't be updated by
+    // another major's APK; that APK is a different app installed side by side.
+    fun canOwn(app: InstalledApp, assetName: String): Boolean {
+        val packageMajor = app.packageName.split('.').firstNotNullOfOrNull { segment ->
+            PACKAGE_MAJOR.matchEntire(segment)?.groupValues?.get(1)?.toIntOrNull()
+        } ?: return true
+        val assetMajor = AssetVariant.versionMajor(assetName) ?: return true
+        return packageMajor == assetMajor
+    }
+
+    private val PACKAGE_MAJOR = Regex("""v(\d+)""", RegexOption.IGNORE_CASE)
+
+    // Apps named alike except the version (Godot editor.v3 / .v4) tie on glob and stem.
+    private fun List<InstalledApp>.closestVersionLine(assetName: String): InstalledApp {
+        if (size == 1) return first()
+        val major = AssetVariant.versionMajor(assetName) ?: return first()
+        return firstOrNull { it.versionLineMajor() == major } ?: first()
+    }
+
+    private fun InstalledApp.versionLineMajor(): Int? =
+        installedAssetName?.let(AssetVariant::versionMajor)
+            ?: AssetVariant.versionMajor(installedVersion)
+}
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/AssetVariant.kt` (modified, +5/-0)
```diff
@@ -167,6 +167,11 @@ object AssetVariant {
         return versionPattern.replace(lower, "*")
     }
 
+    fun versionMajor(name: String): Int? =
+        VERSION_MAJOR.find(name)?.groupValues?.get(1)?.toIntOrNull()
+
+    private val VERSION_MAJOR = Regex("""(?<![A-Za-z\d])v?(\d+)\.\d+""", RegexOption.IGNORE_CASE)
+
     fun extract(assetName: String): String? {
         val withoutExt = assetName.substringBeforeLast('.')
         val match = VERSION_SEGMENT.find(withoutExt) ?: return null
```

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/utils/ReleaseLines.kt` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+package zed.rainxch.core.domain.utils
+
+import zed.rainxch.core.domain.model.account.github.GithubRelease
+
+object ReleaseLines {
+
+    fun of(tag: String): String {
+        val lower = tag.lowercase()
+        val prefix = VERSION.find(lower)?.let { lower.substring(0, it.range.first) }
+            ?: lower.takeWhile { !it.isDigit() }
+        return prefix.split(SEPARATORS)
+            .filter { it.isNotEmpty() && it !in NOT_AN_APP }
+            .joinToString("-")
+    }
+
+    // Lines are separate apps only when they interleave; a tag scheme that changed once
+    // (release-1.0 then v1.1) or a lone `nightly` tag is still one app.
+    fun isMultiLine(releases: List<GithubRelease>): Boolean {
+        val spans = releases.withIndex()
+            .groupBy({ of(it.value.tagName) }, { it.index })
+            .values
+            .map { it.min() to it.max() }
+        return spans.indices.any { i ->
+            (i + 1 until spans.size).any { j ->
+                spans[i].first < spans[j].second && spans[j].first < spans[i].second
+            }
+        }
+    }
+
+    fun sameLine(
+        releases: List<GithubRelease>,
+        anchor: GithubRelease,
+        history: List<GithubRelease> = releases,
+    ): List<GithubRelease> {
+        if (!isMultiLine(history)) return releases
+        val line = of(anchor.tagName)
+        return releases.filter { of(it.tagName) == line }
+    }
+
+    private val VERSION = Regex("""\d+(?:[._]\d+)+""")
+    private val SEPARATORS = Regex("""[-_./@\s]+""")
+    private val NOT_AN_APP = setOf(
+        "v", "android", "ios", "desktop", "mobile", "windows", "win", "macos", "mac", "osx", "linux",
+    )
+}
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/utils/AssetOwnershipTest.kt` (added, +239/-0)
```diff
@@ -0,0 +1,239 @@
+package zed.rainxch.core.domain.utils
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertNull
+import zed.rainxch.core.domain.model.account.github.GithubAsset
+import zed.rainxch.core.domain.model.account.github.GithubRelease
+import zed.rainxch.core.domain.model.installation.InstallSource
+import zed.rainxch.core.domain.model.installation.InstalledApp
+
+class AssetOwnershipTest {
+    private fun asset(name: String) =
+        GithubAsset(
+            id = name.hashCode().toLong(),
+            name = name,
+            contentType = "application/vnd.android.package-archive",
+            size = 1L,
+            downloadUrl = "https://dl/$name",
+        )
+
+    private fun release(tag: String, assets: List<GithubAsset>) =
+        GithubRelease(
+            id = tag.hashCode().toLong(),
+            tagName = tag,
+            name = tag,
+            publishedAt = "2026-01-01T00:00:00Z",
+            description = null,
+            assets = assets,
+            tarballUrl = "",
+            zipballUrl = "",
+            htmlUrl = "",
+        )
+
+    private fun app(
+        packageName: String,
+        installedAssetName: String?,
+        installedVersion: String = "1.0.0",
+        glob: String? = null,
+        filter: String? = null,
+    ) = InstalledApp(
+        packageName = packageName,
+        repoId = 1L,
+        repoName = "repo",
+        repoOwner = "owner",
+        repoOwnerAvatarUrl = "",
+        repoDescription = null,
+        primaryLanguage = null,
+        repoUrl = "",
+        installedVersion = installedVersion,
+        installedAssetName = installedAssetName,
+        installedAssetUrl = null,
+        latestVersion = null,
+        latestAssetName = null,
+        latestAssetUrl = null,
+        latestAssetSize = null,
+        appName = packageName,
+        installSource = InstallSource.THIS_APP,
+        installedAt = 0L,
+        lastCheckedAt = 0L,
+        lastUpdatedAt = 0L,
+        isUpdateAvailable = false,
+        signingFingerprint = null,
+        systemArchitecture = "arm64-v8a",
+        fileExtension = "apk",
+        assetFilterRegex = filter,
+        assetGlobPattern = glob,
+    )
+
+    private fun ownerOf(name: String, apps: List<InstalledApp>, assets: List<GithubAsset>) =
+        AssetOwnership.ownerOf(name, apps, assets, listOf(release("current", assets)))
+
+    private val abiRelease = listOf(
+        asset("app-arm64-v8a-1.3.0.apk"),
+        asset("app-armeabi-v7a-1.3.0.apk"),
+        asset("app-universal-1.3.0.apk"),
+    )
+
+    private val morphe = listOf(
+        asset("google-photos-arm64-v8a-morphe-patches-v7.95.0.989626323.apk"),
+        asset("instagram-arm64-v8a-piko-patches-v440.0.0.1.1.apk"),
+        asset("instagram-armeabi-v7a-piko-patches-v436.0.0.1.1.apk"),
+        asset("youtube-universal-morphe-patches-v20.1.1.apk"),
+    )
+
+    private val godotV4 = app(
+        "org.godotengine.editor.v4",
+        "Godot_v4.7.2-stable_android_editor.apk",
+        installedVersion = "4.7.2-stable",
+        glob = "godot_*-stable_android_editor.apk",
+    )
+    private val godotV3 = app(
+        "org.godotengine.editor.v3",
+        "Godot_v3.6.3-stable_android_editor.apk",
+        installedVersion = "3.6.3-stable",
+    )
+    private val godot363 = listOf(asset("Godot_v3.6.3-stable_android_editor.apk"))
+    private val godot472 = listOf(
+        asset("Godot_v4.7.2-stable_android_debug.perfetto.apk"),
+        asset("Godot_v4.7.2-stable_android_editor.apk"),
+        asset("Godot_v4.7.2-stable_android_editor_horizonos.apk"),
+        asset("Godot_v4.7.2-stable_android_editor_picoos.apk"),
+        asset("Godot_v4.7.2-stable_android_release.perfetto.apk"),
+    )
+
+    @Test
+    fun versionMajorReadsTheFirstDottedVersion() {
+        assertEquals(4, AssetVariant.versionMajor("Godot_v4.7.2-stable_android_editor.apk"))
+        assertEquals(3, AssetVariant.versionMajor("3.6.3-stable"))
+        assertEquals(1, AssetVariant.versionMajor("MyApp_v1.2.apk"))
+        assertEquals(439, AssetVariant.versionMajor("instagram-arm64-v8a-piko-patches-v439.0.0.37.89.apk"))
+        assertNull(AssetVariant.versionMajor("app-arm64-v8a.apk"))
+        assertNull(AssetVariant.versionMajor("app-x86_64-release.apk"))
+    }
+
+    @Test
+    fun singleAppKeepsOwnershipAcrossAbis() {
+        val installed = app("com.app", "app-arm64-v8a-1.2.3.apk")
+        assertEquals(installed, ownerOf("app-universal-1.3.0.apk", listOf(installed), abiRelease))
+        assertEquals(installed, ownerOf("app-armeabi-v7a-1.3.0.apk", listOf(installed), abiRelease))
+    }
+
+    @Test
+    fun singleAppKeepsOwnershipAcrossRenames() {
+        val separators = app("com.app", "MyApp_v1.2.apk")
+        assertEquals(separators, ownerOf("MyApp-1.3.apk", listOf(separators), listOf(asset("MyApp-1.3.apk"))))
+
+        val renamed = app("com.app", "OldName-1.0.apk")
+        
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/utils/ReleaseLinesTest.kt` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package zed.rainxch.core.domain.utils
+
+import kotlin.test.Test
+import kotlin.test.assertEquals
+import kotlin.test.assertFalse
+import kotlin.test.assertTrue
+import zed.rainxch.core.domain.model.account.github.GithubRelease
+
+class ReleaseLinesTest {
+    private fun release(tag: String) =
+        GithubRelease(
+            id = tag.hashCode().toLong(),
+            tagName = tag,
+            name = tag,
+            publishedAt = "2026-01-01T00:00:00Z",
+            description = null,
+            assets = emptyList(),
+            tarballUrl = "",
+            zipballUrl = "",
+            htmlUrl = "",
+        )
+
+    private fun releases(vararg tags: String) = tags.map(::release)
+
+    @Test
+    fun lineIsTheTagWithoutItsVersion() {
+        assertEquals("auth", ReleaseLines.of("auth-v4.4.25"))
+        assertEquals("photos", ReleaseLines.of("photos-v1.3.64"))
+        assertEquals("thunderbird", ReleaseLines.of("THUNDERBIRD_24_0b2"))
+        assertEquals("k9mail", ReleaseLines.of("K9MAIL_23_1"))
+        assertEquals("", ReleaseLines.of("v3.4.8"))
+        assertEquals("", ReleaseLines.of("4.7.2-stable"))
+        assertEquals("nightly", ReleaseLines.of("nightly"))
+    }
+
+    @Test
+    fun platformWordsDoNotSplitAnApp() {
+        assertEquals("", ReleaseLines.of("3.4.13-android"))
+        assertEquals("", ReleaseLines.of("desktop-v2026.9.1"))
+        assertEquals(
+            ReleaseLines.of("@standardnotes/desktop@3.202.8"),
+            ReleaseLines.of("@standardnotes/mobile@3.202.8"),
+        )
+    }
+
+    @Test
+    fun interleavedLinesAreSeparateApps() {
+        assertTrue(
+            ReleaseLines.isMultiLine(
+                releases("photos-v1.3.64", "ensu-v0.1.20", "auth-v4.4.25", "photos-v1.3.63", "auth-v4.4.24"),
+            ),
+        )
+        assertTrue(
+            ReleaseLines.isMultiLine(releases("THUNDERBIRD_23_1", "K9MAIL_23_1", "THUNDERBIRD_23_0", "K9MAIL_23_0")),
+        )
+    }
+
+    @Test
+    fun oneAppStaysOneLine() {
+        assertFalse(ReleaseLines.isMultiLine(releases("3.4.13-android", "v3.4.8", "3.4.12-android", "v3.4.7")))
+        assertFalse(ReleaseLines.isMultiLine(releases("nightly", "2.0.1", "0.10.15")))
+        assertFalse(ReleaseLines.isMultiLine(releases("v1.2", "v1.1", "release-1.0", "release-0.9")))
+    }
+
+    @Test
+    fun sameLineKeepsOnlyTheAnchorsAppInAMonorepo() {
+        val history = releases("photos-v1.3.64", "ensu-v0.1.20", "auth-v4.4.25", "photos-v1.3.63", "auth-v4.4.24")
+        assertEquals(
+            listOf("auth-v4.4.25", "auth-v4.4.24"),
+            ReleaseLines.sameLine(history, history[2]).map { it.tagName },
+        )
+        val single = releases("3.4.13-android", "v3.4.8")
+        assertEquals(single, ReleaseLines.sameLine(single, single[1]))
+    }
+}
```

**File**: `feature/details/CLAUDE.md` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ feature/details/
 - **Skip release (E542):** per-app `skippedReleaseTag` on `InstalledApp`. `SmartInstallButton` suppresses CTA; auto-clears on strictly-newer release.
 - **Forgejo / Codeberg branch:** `DetailsRepositoryImpl.getRepositoryByOwnerAndName / getAllReleases / getReadme / getRepoStats / getLatestPublishedRelease` accept `sourceHost: String? = null`. Non-null → `ForgejoApiClient` direct call (no backend mediator). README from `/contents/README.md?ref={branch}` (Forgejo lacks `/readme`); license sniffed from `/contents/LICENSE` via SPDX regex; downloads aggregated by summing asset `download_count`. CRLF release bodies normalized so GFM tables render. Foreign-source `getUserProfile` skipped (GitHub-only). `AppHeader` avatar falls back to `repository.owner.avatarUrl` when profile null.
 - **Multi-flavor primary picker (#638):** with no asset selected, `pickPrimaryInstalledApp` prefers the `isUpdateAvailable=false` variant → `first()`. Prevents false "Update" CTA when a project ships multiple packages (e.g. generic + Play APK) and only one variant is current.
-- **Multi-app repos (#970):** with an asset selected, `pickPrimaryInstalledApp` returns the app that owns it (asset filter → `deriveGlob` → `extractBaseStem`), or null so a different app in the same repo can be installed. A sole app whose own asset family is missing from the release is kept (rename). `recomputeAssetsForRelease` narrows to the anchor asset's family (filter, else stem) before the variant resolver, so pinned tokens can't land on another app's APK. Stem = which app (ignores ABI/flavor); glob = which variant (keeps them).
+- **Multi-app repos (#970):** with an asset selected, `pickPrimaryInstalledApp` delegates to `AssetOwnership.ownerOf` (`core/domain`): asset filter → `deriveGlob` → `extractBaseStem`, ties broken by major version (Godot `editor.v3` / `.v4` share every name token but the version), else null so a different app in the same repo can be installed. A sole app whose own asset family is missing from the release is kept only for a real rename (all new-name releases newer than all old-name ones); apps released side by side (K-9 / Thunderbird tags) interleave and stay separate. `recomputeAssetsForRelease` narrows to the anchor asset's family (filter, else stem) before the variant resolver, so pinned tokens can't land on another app's APK. `loadInitial` opens on the newest release in the installed channel whose chosen APK the opened app owns. Stem = which app (ignores ABI/flavor); glob = which variant (keeps them).
 - **Content width:** `LocalContentWidth` (`COMPACT` 680dp default, `WIDE` 960dp, `EXTRA_WIDE` fills window). Set in `Tweaks → Appearance` (desktop). Outer Box's `Modifier.scrollable(state=listState, reverseDirection=true, enabled = !ANDROID)` forwards mouse-wheel events from empty side gutters to the LazyColumn — gated to non-Android to avoid double scrollable contending with LazyColumn touch.
 - **Markdown perf:** Chunked progressive rendering (`splitMarkdownIntoChunks`, ~4000 chars). Pre-processing (theme-aware images + `separateAdjacentImageLinks`) on `Dispatchers.Default`. `onAction` lambda hoisted via `remember`; `MarkdownComponents` memoized; `TranslationState @Immutable`. Together kills download-progress-driven recomp storms.
 - **Markdown image link awareness:** `LinkAwareMarkdownImage` walks `ASTNode.parent` for `INLINE_LINK`, makes badge images clickable to outer href. `MarkdownImageTransformer` adds browser-like User-Agent + accept header to bypass CDN hotlink protection on common badge services.
```

**File**: `feature/details/presentation/src/commonMain/kotlin/zed/rainxch/details/presentation/DetailsViewModel.kt` (modified, +48/-44)
```diff
@@ -56,6 +56,7 @@ import zed.rainxch.core.domain.system.PackageMonitor
 import zed.rainxch.core.domain.use_cases.SyncInstalledAppsUseCase
 import zed.rainxch.core.presentation.utils.daysSinceIso
 import zed.rainxch.core.domain.utils.AssetFilter
+import zed.rainxch.core.domain.utils.AssetOwnership
 import zed.rainxch.core.domain.utils.AssetVariant
 import zed.rainxch.core.domain.utils.VersionMath
 import zed.rainxch.core.domain.helpers.BrowserHelper
@@ -266,9 +267,9 @@ class DetailsViewModel(
             }
 
             DetailsAction.OnConfirmDowngradeUninstall -> {
-                _state.value.downgradeWarning ?: return
+                val warning = _state.value.downgradeWarning ?: return
                 dismissDowngradeWarning()
-                uninstallApp()
+                uninstallPackage(warning.packageName)
             }
 
             DetailsAction.OnDismissSigningKeyWarning -> {
@@ -920,7 +921,12 @@ class DetailsViewModel(
                 val (installable, primary) =
                     recomputeAssetsForRelease(selected, _state.value.installedApp)
                 val newInstalledApp =
-                    pickPrimaryInstalledApp(_state.value.installedApps, primary?.name, installable)
+                    pickPrimaryInstalledApp(
+                        _state.value.installedApps,
+                        primary?.name,
+                        installable,
+                        releases,
+                    )
                 val insights = computeReleaseInsights(releases, newInstalledApp)
                 _state.update {
                     it.copy(
@@ -1015,45 +1021,42 @@ class DetailsViewModel(
             val filtered = installable.filter { filter.matches(it.name) }
             if (filtered.isNotEmpty()) return filtered
         }
-        if (anchorAssetName == null) return installable
-        return installable.filter { isSameAppAsset(it.name, anchorAssetName) }.ifEmpty { installable }
-    }
-
-    private fun isSameAppAsset(assetName: String, otherAssetName: String): Boolean {
-        val stem = AssetVariant.extractBaseStem(assetName)
-        return stem.isNotEmpty() && stem == AssetVariant.extractBaseStem(otherAssetName)
+        return AssetOwnership.narrowToApp(installable, anchorAssetName)
     }
 
     private fun pickPrimaryInstalledApp(
         apps: List<InstalledApp>,
         primaryAssetName: String?,
         releaseAssets: List<GithubAsset>,
+        releaseHistory: List<GithubRelease> = _state.value.allReleases,
     ): InstalledApp? {
         if (apps.isEmpty()) return null
         if (primaryAssetName == null) {
             return apps.singleOrNull() ?: apps.firstOrNull { !it.isUpdateAvailable } ?: apps.first()
         }
-        apps.firstOrNull { app ->
-            AssetFilter.parse(app.assetFilterRegex)?.getOrNull()?.matches(primaryAssetName) == true
-        }?.let { return it }
-        val primaryGlob = AssetVariant.deriveGlob(primaryAssetName)
-        if (primaryGlob != null) {
-            apps.firstOrNull { app ->
-                val appGlob =
-                    app.installedAssetName?.let(AssetVariant::deriveGlob) ?: app.assetGlobPattern
-                appGlob == primaryGlob
-            }?.let { return it }
-        }
-        apps.firstOrNull { app ->
-            app.installedAssetName?.let { isSameAppAsset(it, primaryAssetName) } == true
-        }?.let { return it }
-
-        // Own asset family absent from this release means a rename, not a different app.
-        val sole = apps.singleOrNull() ?: return null
-        val soleAsset = sole.installedAssetName ?: return sole
-        return sole.takeIf { releaseAssets.none { isSameAppAsset(it.name, soleAsset) } }
+        return AssetOwnership.ownerOf(primaryAssetName, apps, releaseAssets, releaseHistory)
     }
 
+    private fun List<GithubRelease>.firstOwnedBy(
+        app: InstalledApp,
+        category: ReleaseCategory,
+        repoApps: List<InstalledApp>,
+        anchorAssetName: String?,
+    ): GithubRelease? =
+        firstOrNull { release ->
+            val inCategory =
+                when (category) {
+                    ReleaseCategory.STABLE -> !release.isEffectivelyPreRelease()
+                    ReleaseCategory.PRE_RELEASE -> release.isEffectivelyPreRelease()
+                    ReleaseCategory.ALL -> true
+                }
+            if (!inCategory) return@firstOrNull false
+            val (installable, primary) = recomputeAssetsForRelease(release, app, anchorAssetName)
+            primary != null &&
+                pickPrimaryInstalledApp(repoApps, primary.name, installable, this)?.packageName ==
+                app.packageName
+        }
+
     private fun observeInstalledApp(repoId: Long) {
         viewModelScope.launch {
             installedAppsRepository
@@ -1533,17 +1536,21 @@ class DetailsViewModel(
 
     private fun uninstallApp() {
         val installedApp = _state.value.installedApp ?: return
-        logger.debug("Uninstallin
```

---

### Incident Patch 7: `eff78740` (2026-10-03)
**Commit Message**: fix(apps): keep the Library at the top when a section appears above (#995)

A lazy grid keeps its first visible item in place across data changes.
When an update check found updates while the list was at the top, the
new "updates available" section was inserted above that item and stayed
offscreen until the user scrolled up, which looked like the app was
missing.

When the sections above the list (import banner, KAO banner, pending,
updates) change while the grid is at the very top, request item 0 for
the next layout. If the user has scrolled down, nothing moves.

**File**: `feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/AppsRoot.kt` (modified, +27/-0)
```diff
@@ -15,6 +15,7 @@ import androidx.compose.foundation.layout.height
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.size
 import androidx.compose.foundation.lazy.grid.GridItemSpan
+import androidx.compose.foundation.lazy.grid.LazyGridState
 import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
 import androidx.compose.foundation.lazy.grid.items
 import androidx.compose.foundation.lazy.grid.rememberLazyGridState
@@ -23,6 +24,8 @@ import androidx.compose.material.icons.filled.Add
 import androidx.compose.material.icons.filled.Search
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.DisposableEffect
+import androidx.compose.runtime.SideEffect
+import androidx.compose.runtime.remember
 import androidx.compose.runtime.rememberCoroutineScope
 import androidx.compose.ui.Alignment
 import androidx.compose.ui.Modifier
@@ -290,6 +293,15 @@ fun AppsScreen(
                     }
 
                     val listState = rememberLazyGridState()
+                    KeepAtTopWhenSectionsChange(
+                        gridState = listState,
+                        sections = listOf(
+                            state.showImportProposalBanner,
+                            state.showKaoBanner,
+                            state.pendingApps.isNotEmpty(),
+                            state.updateApps.isNotEmpty() || state.isUpdatingAll,
+                        ),
+                    )
 
                     when {
                         state.isLoading -> {
@@ -529,6 +541,21 @@ fun AppsScreen(
     }
 }
 
+// A lazy grid keeps its first visible item in place, so a section that appears above it while
+// the user is at the top (an update check finding updates) would land offscreen.
+@Composable
+private fun KeepAtTopWhenSectionsChange(
+    gridState: LazyGridState,
+    sections: List<Boolean>,
+) {
+    val previous = remember { arrayOf(sections) }
+    SideEffect {
+        val atTop = gridState.firstVisibleItemIndex == 0 && gridState.firstVisibleItemScrollOffset == 0
+        if (previous[0] != sections && atTop) gridState.requestScrollToItem(0)
+        previous[0] = sections
+    }
+}
+
 @Composable
 private fun AppItemCardWithActions(
     appItem: AppItem,
```

---

### Incident Patch 8: `ca6980f5` (2026-10-03)
**Commit Message**: fix: support installing and managing multiple distinct APKs from single repository (#970)

* fix: support installing and managing multiple distinct APKs from single repository

- Resolve UI locking issue where repositories distributing multiple distinct
  apps (such as RookieEnough/Morphe-AutoBuilds) locked the details screen
  to an already installed app when viewing other assets. Previously, if one
  app was installed from the repository, attempting to select or download
  another distinct app would fail and lock the screen's state to the first
  app. This resulted in being unable to install additional apps as the
  first installed app's state was shown.
- In DetailsViewModel.pickPrimaryInstalledApp(), return null when
  primaryAssetName does not match an installed app's filter regex, derived
  glob, or base stem, ensuring uninstalled assets display 'Install latest'.
- Pass target packageName and initialAssetName through navigation arguments,
  actions, and events from the Library screen so tapping an installed app
  focuses directly on that specific asset.
- In DetailsViewModel.loadInitial() and recomputeAssetsForRelease(), fallback
  to matching assetFilterRegex and latestAsset

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ class XViewModel : ViewModel() {
 
 ### Navigation
 
-`@Serializable` sealed interface `GithubStoreGraph` in `composeApp/.../app/navigation/`. Routes: `HomeScreen`, `SearchScreen`, `AuthenticationScreen`, `ProfileScreen`, `TweaksScreen`, `FavouritesScreen`, `StarredReposScreen`, `RecentlyViewedScreen`, `AppsScreen`, `OnboardingScreen`, `ExternalImportScreen`, `MirrorPickerScreen`, `StarredPickerScreen`, `SkippedUpdatesScreen`, `HiddenRepositoriesScreen`, `WhatsNewHistoryScreen`, `AnnouncementsScreen`, `HostTokensScreen`, `DetailsScreen(repositoryId, owner, repo, isComingFromUpdate, sourceHost)`, `DeveloperProfileScreen(username)`. `DetailsScreen.sourceHost` is non-null for Codeberg / Forgejo / custom-forge repos — routes all `DetailsRepository` calls through `ForgejoClientRegistry` instead of the GitHub-backed default path.
+`@Serializable` sealed interface `GithubStoreGraph` in `composeApp/.../app/navigation/`. Routes: `HomeScreen`, `SearchScreen`, `AuthenticationScreen`, `ProfileScreen`, `TweaksScreen`, `FavouritesScreen`, `StarredReposScreen`, `RecentlyViewedScreen`, `AppsScreen`, `OnboardingScreen`, `ExternalImportScreen`, `MirrorPickerScreen`, `StarredPickerScreen`, `SkippedUpdatesScreen`, `HiddenRepositoriesScreen`, `WhatsNewHistoryScreen`, `AnnouncementsScreen`, `HostTokensScreen`, `DetailsScreen(repositoryId, owner, repo, isComingFromUpdate, sourceHost, packageName)`, `DeveloperProfileScreen(username)`. `DetailsScreen.packageName` (set from Apps) opens on that installed app in multi-app repos. `DetailsScreen.sourceHost` is non-null for Codeberg / Forgejo / custom-forge repos — routes all `DetailsRepository` calls through `ForgejoClientRegistry` instead of the GitHub-backed default path.
 
 ### DI
 
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/di/ViewModelsModule.kt` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ val viewModelsModule =
                 repoParam = params[2],
                 isComingFromUpdate = params[3],
                 sourceHostParam = if (params.size() > 4) params[4] else null,
+                packageNameParam = if (params.size() > 5) params[5] else null,
                 detailsRepository = get(),
                 downloader = get(),
                 installer = get(),
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/AdaptiveDetailPaneContent.kt` (modified, +3/-0)
```diff
@@ -159,6 +159,8 @@ private fun MainDetailPane(
             append(args.repo.orEmpty())
             append('|')
             append(args.sourceHost.orEmpty())
+            append('|')
+            append(args.packageName.orEmpty())
         }
     val viewModel: DetailsViewModel =
         koinViewModel(key = vmKey) {
@@ -168,6 +170,7 @@ private fun MainDetailPane(
                 args.repo.orEmpty(),
                 args.isComingFromUpdate,
                 args.sourceHost,
+                args.packageName,
             )
         }
     DetailsRoot(
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/AppNavigation.kt` (modified, +4/-1)
```diff
@@ -491,6 +491,7 @@ fun AppNavigation(
                                                     args.repo,
                                                     args.isComingFromUpdate,
                                                     args.sourceHost,
+                                                    args.packageName,
                                                 )
                                             },
                                     )
@@ -927,7 +928,7 @@ fun AppNavigation(
                                             onNavigateBack = {
                                                 navController.navigateUp()
                                             },
-                                            onNavigateToRepo = { repoId, sourceHost, owner, repo ->
+                                            onNavigateToRepo = { repoId, sourceHost, owner, repo, packageName ->
                                                 if (isExpanded) {
                                                     listDetailState.select(
                                                         AdaptiveDetailArgs(
@@ -936,6 +937,7 @@ fun AppNavigation(
                                                             sourceHost = sourceHost,
                                                             owner = owner,
                                                             repo = repo,
+                                                            packageName = packageName,
                                                         ),
                                                     )
                                                 } else {
@@ -946,6 +948,7 @@ fun AppNavigation(
                                                             sourceHost = sourceHost,
                                                             owner = owner.orEmpty(),
                                                             repo = repo.orEmpty(),
+                                                            packageName = packageName,
                                                         ),
                                                     )
                                                 }
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/GithubStoreGraph.kt` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ sealed interface GithubStoreGraph {
         val repo: String = "",
         val isComingFromUpdate: Boolean = false,
         val sourceHost: String? = null,
+        val packageName: String? = null,
     ) : GithubStoreGraph
 
     @Serializable
```

**File**: `core/presentation/src/commonMain/kotlin/zed/rainxch/core/presentation/components/adaptive/AdaptiveDetailArgs.kt` (modified, +1/-0)
```diff
@@ -11,4 +11,5 @@ data class AdaptiveDetailArgs(
     val repo: String? = null,
     val isComingFromUpdate: Boolean = false,
     val sourceHost: String? = null,
+    val packageName: String? = null,
 )
```

**File**: `feature/apps/CLAUDE.md` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ interface AppsRepository {
 ## Notes
 
 - Uses `InstalledAppsRepository` + `SyncInstalledAppsUseCase`. `openApp` via `AppLauncher`. `PackageMonitor` + `Installer` (Android). Data layer injects `ForgejoClientRegistry`; non-null `sourceHost` on `getLatestRelease` / `fetchRepoInfo` / `linkAppToRepo` routes to the Forgejo client (else default GitHub-direct path).
-- **`sourceHost` propagation:** `InstalledApp.sourceHost` persisted on link; `AppsAction.OpenAppDetails` / `OpenRepoDetails` + `AppsEvent.NavigateToRepo` carry `sourceHost`; `AppsRoot.onNavigateToRepo` is `(repoId, sourceHost, owner, repo) -> Unit` and routes to `GithubStoreGraph.DetailsScreen(sourceHost = …)`.
+- **`sourceHost` propagation:** `InstalledApp.sourceHost` persisted on link; `AppsAction.OpenAppDetails` / `OpenRepoDetails` + `AppsEvent.NavigateToRepo` carry `sourceHost`; `AppsRoot.onNavigateToRepo` is `(repoId, sourceHost, owner, repo, packageName) -> Unit` and routes to `GithubStoreGraph.DetailsScreen(sourceHost = …, packageName = …)`.
 - **Multi-source backend match:** `RepoSuggestion` candidates may come from GitHub *or* a Forgejo host; the link sheet displays the source host chip per row so the user picks the right forge variant.
 - Sort + search: `AppSortRule` enum (UpdatesFirst default, AlphabeticalAZ, RecentlyAdded, RecentlyUpdated). Persisted in DataStore. Inline search filters appName / packageName.
 - Per-app actions: Ignore-updates (silence badge), Skip-this-release (per-tag, auto-clear on next release), Advanced filter (regex on asset names + monorepo fallback), Pin variant (token-set + glob fingerprint), Inspect APK (decoded manifest sheet).
```

**File**: `feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/AppsAction.kt` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ sealed interface AppsAction {
         val sourceHost: String? = null,
         val owner: String? = null,
         val repo: String? = null,
+        val packageName: String? = null,
     ) : AppsAction
 
     data class OnUninstallApp(
```

---

### Incident Patch 9: `281f8aef` (2026-10-03)
**Commit Message**: fix(apps): let parked pending installs be installed from the card (#990)

Every row in the Ready to install section has isPendingInstall set, and
computeIsBusy treats that as busy, so the Install button there was always
disabled. The button already sits in the branch that only renders when no
download, install, or update check is in flight (those show Cancel), so
the isBusy gate only ever blocked it for being pending.

**File**: `feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/components/AppItemCard.kt` (modified, +0/-1)
```diff
@@ -529,7 +529,6 @@ fun AppItemCard(
                                 label = stringResource(Res.string.install),
                                 variant = KomiButtonVariant.Primary,
                                 leadingIcon = Icons.Default.Update,
-                                enabled = !appItem.isBusy,
                                 modifier = Modifier.weight(1f),
                             )
 
```

---

### Incident Patch 10: `582ad1be` (2026-10-03)
**Commit Message**: fix(apps): hide uninstall button for pending apps (#973)

* fix(apps): hide uninstall button for pending apps

Pending apps are staged APKs that aren't yet installed on Android, so attempting to uninstall them via the OS PackageInstaller does not apply. The button was already permanently disabled (isBusy == true), so clicking it did nothing. This change conditionally hides the icon entirely when app.isPendingInstall == true, leaving only the 'Install' and 'Discard pending install' buttons visible.

* fix(apps): hide uninstall button for pending apps in AppDetailPane

Align AppDetailPane with AppItemCard and CompactAppRow by conditionally hiding the uninstall button when an app is pending installation (app.isPendingInstall == true).

**File**: `feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/components/AppDetailPane.kt` (modified, +9/-7)
```diff
@@ -175,13 +175,15 @@ fun AppDetailPane(
                 modifier = Modifier.weight(1f),
             )
 
-            KomiButton(
-                onClick = onUninstall,
-                label = stringResource(Res.string.uninstall),
-                variant = KomiButtonVariant.Destructive,
-                enabled = !appItem.isBusy,
-                leadingIcon = Icons.Outlined.DeleteOutline,
-            )
+            if (!app.isPendingInstall) {
+                KomiButton(
+                    onClick = onUninstall,
+                    label = stringResource(Res.string.uninstall),
+                    variant = KomiButtonVariant.Destructive,
+                    enabled = !appItem.isBusy,
+                    leadingIcon = Icons.Outlined.DeleteOutline,
+                )
+            }
         }
 
         Spacer(Modifier.height(20.dp))
```

**File**: `feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/components/AppItemCard.kt` (modified, +14/-12)
```diff
@@ -495,18 +495,20 @@ fun AppItemCard(
                 horizontalArrangement = Arrangement.spacedBy(8.dp),
                 verticalAlignment = Alignment.CenterVertically,
             ) {
-                val uninstallDescription = stringResource(Res.string.uninstall)
-                Box(
-                    modifier = Modifier
-                        .size(48.dp)
-                        .clickable(enabled = !appItem.isBusy, onClick = onUninstallClick),
-                    contentAlignment = Alignment.Center,
-                ) {
-                    KomiIcon(
-                        imageVector = Icons.Outlined.DeleteOutline,
-                        contentDescription = uninstallDescription,
-                        tint = colors.error,
-                    )
+                if (!app.isPendingInstall) {
+                    val uninstallDescription = stringResource(Res.string.uninstall)
+                    Box(
+                        modifier = Modifier
+                            .size(48.dp)
+                            .clickable(enabled = !appItem.isBusy, onClick = onUninstallClick),
+                        contentAlignment = Alignment.Center,
+                    ) {
+                        KomiIcon(
+                            imageVector = Icons.Outlined.DeleteOutline,
+                            contentDescription = uninstallDescription,
+                            tint = colors.error,
+                        )
+                    }
                 }
 
                 when (appItem.updateState) {
```

---

### Incident Patch 11: `6be3da12` (2026-10-03)
**Commit Message**: fix: load persisted appearance before first frame; splash covers the load (#955)

* fix: load persisted appearance before first frame; splash covers the load

* fix: read the startup language once and hold the splash on painted content

Three defects on the cold-start path.

The splash's keep-on-screen condition read MainState's StateFlow directly,
while the frame actually rendered is decided by the Compose gate reading the
same flow through collectAsStateWithLifecycle. The flow's value flips a frame
before the composition catches up, so the splash could be released onto the
frame that still draws the gate's placeholder. Report from inside the
composition instead, once the real UI is past the gate.

The startup language was read twice on independent timeout budgets — once by
each platform entry point and again by the gated combine — so a slow first
read could leave the JVM locale and the rendered language disagreeing for the
rest of the session. MainViewModel is now the single reader and applies the
locale before the gate opens, so the first real frame already resolves its
resources against the stored language. The watchdog and error paths
deliberately leave the system default: not

**File**: `composeApp/src/androidMain/kotlin/zed/rainxch/githubstore/MainActivity.kt` (modified, +14/-20)
```diff
@@ -19,50 +19,43 @@ import androidx.lifecycle.repeatOnLifecycle
 import co.touchlab.kermit.Logger
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.flow.drop
-import kotlinx.coroutines.flow.first
 import kotlinx.coroutines.launch
-import kotlinx.coroutines.runBlocking
-import kotlinx.coroutines.withTimeoutOrNull
 import org.koin.android.ext.android.inject
+import org.koin.androidx.viewmodel.ext.android.getViewModel
 import zed.rainxch.core.data.services.LocalizationManager
 import zed.rainxch.core.data.utils.AndroidShareManager
 import zed.rainxch.core.domain.helpers.ShareManager
 import zed.rainxch.core.domain.repository.TweaksRepository
 import zed.rainxch.core.domain.use_cases.SyncInstalledAppsUseCase
 import zed.rainxch.githubstore.app.deeplink.DeepLinkParser
 import zed.rainxch.githubstore.utils.updateSystemBars
-import kotlin.time.Duration.Companion.milliseconds
-
-private const val LANGUAGE_PREF_READ_TIMEOUT_MS = 2000L
 
 class MainActivity : ComponentActivity() {
     private var deepLinkUri by mutableStateOf<String?>(null)
+
     private val shareManager: ShareManager by inject()
-    private val tweaksRepository: TweaksRepository by inject()
     private val localizationManager: LocalizationManager by inject()
+    private val tweaksRepository: TweaksRepository by inject()
     private val syncInstalledAppsUseCase: SyncInstalledAppsUseCase by inject()
     private val appScope: CoroutineScope by inject()
 
+    private val contentPainted =
+        java.util.concurrent.atomic
+            .AtomicBoolean(false)
+
     override fun onCreate(savedInstanceState: Bundle?) {
-        installSplashScreen()
+        val splash = installSplashScreen()
         enableEdgeToEdge()
 
         (shareManager as? AndroidShareManager)?.registerActivityResultLauncher(this)
 
-        runBlocking {
-            val tag =
-                try {
-                    withTimeoutOrNull(LANGUAGE_PREF_READ_TIMEOUT_MS.milliseconds) {
-                        tweaksRepository.getAppLanguage().first()
-                    }
-                } catch (_: Exception) {
-                    null
-                }
-            localizationManager.setActiveLanguageTag(tag)
-        }
-
         super.onCreate(savedInstanceState)
 
+        // Cancels draw requests until the real UI past the gate has composed, so no placeholder
+        // frame is rendered.
+        getViewModel<MainViewModel>()
+        splash.setKeepOnScreenCondition { !contentPainted.get() }
+
         handleIncomingIntent(intent)
 
         lifecycleScope.launch {
@@ -96,6 +89,7 @@ class MainActivity : ComponentActivity() {
                 onResolvedDarkTheme = { isDarkTheme ->
                     this@MainActivity.updateSystemBars(isDarkTheme)
                 },
+                onContentPainted = { contentPainted.set(true) },
             )
         }
     }
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/Main.kt` (modified, +22/-1)
```diff
@@ -1,22 +1,28 @@
 package zed.rainxch.githubstore
 
 import androidx.compose.foundation.isSystemInDarkTheme
+import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.fillMaxSize
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
+import androidx.compose.ui.Modifier
 import androidx.lifecycle.compose.collectAsStateWithLifecycle
 import androidx.navigation.compose.currentBackStackEntryAsState
 import androidx.navigation.compose.rememberNavController
 import coil3.ImageLoader
 import coil3.compose.setSingletonImageLoaderFactory
 import coil3.svg.SvgDecoder
+import kotlinx.coroutines.channels.Channel
 import org.koin.compose.viewmodel.koinViewModel
 import zed.rainxch.core.domain.model.appearance.AppPersonality
 import zed.rainxch.core.presentation.personality.classicPersonality
 import zed.rainxch.core.presentation.personality.mangaPersonality
 import zed.rainxch.core.presentation.personality.toMangaAccent
 import zed.rainxch.core.presentation.personality.toMangaPaper
 import zed.rainxch.core.presentation.personality.utils.PersonalityTheme
+import zed.rainxch.core.presentation.utils.ObserveTimeZoneChanges
 import zed.rainxch.githubstore.app.components.RateLimitDialog
 import zed.rainxch.githubstore.app.components.SessionExpiredDialog
 import zed.rainxch.githubstore.app.navigation.AppNavigation
@@ -32,27 +38,42 @@ fun App(
     deepLinkUri: String? = null,
     onDeepLinkConsumed: () -> Unit = {},
     onResolvedDarkTheme: (Boolean) -> Unit = {},
+    onContentPainted: () -> Unit = {},
 ) {
     val mainViewModel: MainViewModel = koinViewModel()
     val whatsNewViewModel: WhatsNewViewModel = koinViewModel()
 
     val mainState by mainViewModel.state.collectAsStateWithLifecycle()
 
+    ObserveTimeZoneChanges()
+
     val navController = rememberNavController()
 
+    val pendingDeepLinks = remember { Channel<String>(Channel.UNLIMITED) }
+    LaunchedEffect(deepLinkUri) {
+        deepLinkUri?.let { pendingDeepLinks.trySend(it) }
+    }
+
     setSingletonImageLoaderFactory { context ->
         ImageLoader
             .Builder(context)
             .components { add(SvgDecoder.Factory()) }
             .build()
     }
 
+    if (!mainState.isAppearanceLoaded) {
+        Box(modifier = Modifier.fillMaxSize())
+        return
+    }
+
+    LaunchedEffect(Unit) { onContentPainted() }
+
     val currentScreen = navController.currentBackStackEntryAsState().value.getCurrentScreen()
 
     HandleKeyboardEvents(navController)
 
     HandleDesktopToolbarDeeplinks(
-        deepLinkUri = deepLinkUri,
+        deepLinkUris = pendingDeepLinks,
         onDeepLinkConsumed = onDeepLinkConsumed,
         navController = navController,
     )
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/MainState.kt` (modified, +1/-4)
```diff
@@ -2,9 +2,7 @@ package zed.rainxch.githubstore
 
 import zed.rainxch.core.domain.model.appearance.AccentId
 import zed.rainxch.core.domain.model.appearance.AppPersonality
-import zed.rainxch.core.domain.model.appearance.AppTheme
 import zed.rainxch.core.domain.model.appearance.ContentWidth
-import zed.rainxch.core.domain.model.appearance.FontTheme
 import zed.rainxch.core.domain.model.appearance.MangaPaperId
 import zed.rainxch.core.domain.model.error.RateLimitInfo
 
@@ -16,11 +14,10 @@ data class MainState(
     val personality: AppPersonality = AppPersonality.MANGA,
     val accent: AccentId = AccentId.CRIMSON,
     val mangaPaper: MangaPaperId = MangaPaperId.DAY,
-    val currentColorTheme: AppTheme = AppTheme.NORD,
     val isAmoledTheme: Boolean = false,
     val isDarkTheme: Boolean? = null,
-    val currentFontTheme: FontTheme = FontTheme.CUSTOM,
     val isScrollbarEnabled: Boolean = false,
     val contentWidth: ContentWidth = ContentWidth.COMPACT,
     val appLanguageTag: String? = null,
+    val isAppearanceLoaded: Boolean = false,
 )
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/MainViewModel.kt` (modified, +62/-56)
```diff
@@ -2,23 +2,35 @@ package zed.rainxch.githubstore
 
 import androidx.lifecycle.ViewModel
 import androidx.lifecycle.viewModelScope
+import co.touchlab.kermit.Logger
+import kotlinx.coroutines.CancellationException
+import kotlinx.coroutines.CompletableDeferred
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.flow.MutableStateFlow
 import kotlinx.coroutines.flow.asStateFlow
+import kotlinx.coroutines.flow.combine
 import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
+import kotlinx.coroutines.withTimeoutOrNull
+import zed.rainxch.core.data.services.LocalizationManager
+import zed.rainxch.core.domain.model.appearance.AccentId
+import zed.rainxch.core.domain.model.appearance.AppPersonality
+import zed.rainxch.core.domain.model.appearance.MangaPaperId
 import zed.rainxch.core.domain.repository.InstalledAppsRepository
 import zed.rainxch.core.domain.repository.RateLimitRepository
 import zed.rainxch.core.domain.repository.TweaksRepository
 import zed.rainxch.core.domain.repository.UserSessionRepository
 import zed.rainxch.core.domain.use_cases.SyncInstalledAppsUseCase
+import zed.rainxch.githubstore.utils.STARTUP_PREFERENCE_TIMEOUT_MS
+import kotlin.time.Duration.Companion.milliseconds
 
 class MainViewModel(
     private val tweaksRepository: TweaksRepository,
     private val installedAppsRepository: InstalledAppsRepository,
     private val userSessionRepository: UserSessionRepository,
     private val rateLimitRepository: RateLimitRepository,
     private val syncUseCase: SyncInstalledAppsUseCase,
+    private val localizationManager: LocalizationManager,
 ) : ViewModel() {
     private val _state = MutableStateFlow(MainState())
     val state = _state.asStateFlow()
@@ -37,58 +49,39 @@ class MainViewModel(
         }
 
         viewModelScope.launch {
-            tweaksRepository
-                .getThemeColor()
-                .collect { theme ->
-                    _state.update {
-                        it.copy(currentColorTheme = theme)
-                    }
-                }
-        }
-        viewModelScope.launch {
-            tweaksRepository
-                .getAmoledTheme()
-                .collect { isAmoled ->
-                    _state.update {
-                        it.copy(isAmoledTheme = isAmoled)
-                    }
+            val firstEmitted = CompletableDeferred<Unit>()
+            launch {
+                if (
+                    withTimeoutOrNull(STARTUP_PREFERENCE_TIMEOUT_MS.milliseconds) {
+                        firstEmitted.await()
+                    } == null
+                ) {
+                    Logger.w { "Appearance preference load timed out, releasing gate on defaults" }
+                    _state.update { it.copy(isAppearanceLoaded = true) }
                 }
-        }
-        viewModelScope.launch {
-            tweaksRepository
-                .getIsDarkTheme()
-                .collect { isDarkTheme ->
-                    _state.update {
-                        it.copy(isDarkTheme = isDarkTheme)
-                    }
-                }
-        }
-
-        viewModelScope.launch {
-            tweaksRepository
-                .getFontTheme()
-                .collect { fontTheme ->
-                    _state.update {
-                        it.copy(currentFontTheme = fontTheme)
-                    }
-                }
-        }
-
-        viewModelScope.launch {
-            tweaksRepository.getPersonality().collect { personality ->
-                _state.update { it.copy(personality = personality) }
-            }
-        }
-
-        viewModelScope.launch {
-            tweaksRepository.getAccentId().collect { accent ->
-                _state.update { it.copy(accent = accent) }
             }
-        }
-
-        viewModelScope.launch {
-            tweaksRepository.getMangaPaper().collect { paper ->
-                _state.update { it.copy(mangaPaper = paper) }
+            try {
+                combine(
+                    tweaksRepository.getPersonality(),
+                    tweaksRepository.getAccentId(),
+                    tweaksRepository.getMangaPaper(),
+                    tweaksRepository.getAmoledTheme(),
+                    tweaksRepository.getIsDarkTheme(),
+                ) { personality, accent, paper, amoled, isDark ->
+                    Appearance(personality, accent, paper, amoled, isDark)
+                }.combine(tweaksRepository.getAppLanguage()) { appearance, appLanguageTag ->
+                    appearance.copy(appLanguageTag = appLanguageTag)
+                }.collect { snapshot ->
+                    localizationManager.setActiveLanguageTag(snapshot.appLanguageTag)
+                    _state.update { it.withAppearance(snapshot).copy(isAppearanceLoaded = true) }
+                    firstEmitted.complete(Unit)
+                }
+            } catch (e: CancellationException) {
+                throw e
+            } catch (e: Exception) {
+            
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/di/SharedModules.kt` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ val mainModule: Module =
                 rateLimitRepository = get(),
                 syncUseCase = get(),
                 userSessionRepository = get(),
+                localizationManager = get(),
             )
         }
     }
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/utils/HandleDesktopToolbarDeeplinks.kt` (modified, +5/-6)
```diff
@@ -3,7 +3,7 @@ package zed.rainxch.githubstore.utils
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.LaunchedEffect
 import androidx.navigation.NavHostController
-import androidx.navigation.compose.currentBackStackEntryAsState
+import kotlinx.coroutines.channels.ReceiveChannel
 import zed.rainxch.auth.presentation.AuthDeepLinkBus
 import zed.rainxch.auth.presentation.AuthDeepLinkEvent
 import zed.rainxch.githubstore.app.deeplink.DeepLinkDestination
@@ -14,14 +14,13 @@ import zed.rainxch.tweaks.presentation.utils.TweaksDeepLinkBus
 
 @Composable
 fun HandleDesktopToolbarDeeplinks(
-    deepLinkUri: String?,
+    deepLinkUris: ReceiveChannel<String>,
     onDeepLinkConsumed: () -> Unit,
     navController: NavHostController,
 ) {
-    val currentScreen = navController.currentBackStackEntryAsState().value.getCurrentScreen()
-
-    LaunchedEffect(deepLinkUri) {
-        deepLinkUri?.let { uri ->
+    LaunchedEffect(deepLinkUris) {
+        for (uri in deepLinkUris) {
+            val currentScreen = navController.currentBackStackEntry.getCurrentScreen()
             when (val destination = DeepLinkParser.parse(uri)) {
                 is DeepLinkDestination.Repository -> {
                     navController.navigate(
```

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/utils/StartupPreferences.kt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+package zed.rainxch.githubstore.utils
+
+internal const val STARTUP_PREFERENCE_TIMEOUT_MS: Long = 2000L
```

**File**: `composeApp/src/jvmMain/kotlin/zed/rainxch/githubstore/DesktopApp.kt` (modified, +3/-3)
```diff
@@ -58,6 +58,7 @@ import zed.rainxch.githubstore.desktop.WindowStateStore
 import zed.rainxch.githubstore.desktop.applyMacosWindowAppearance
 import zed.rainxch.githubstore.desktop.applyWindowsImmersiveDarkMode
 import zed.rainxch.githubstore.desktop.installMacosSystemAppearance
+import zed.rainxch.githubstore.utils.STARTUP_PREFERENCE_TIMEOUT_MS
 import java.awt.Desktop
 import java.net.URI
 import java.security.Security
@@ -66,8 +67,6 @@ import kotlin.time.Duration.Companion.milliseconds
 
 private const val PRIVACY_POLICY_URL = "https://komistore.app/privacy-policy"
 
-private const val LANGUAGE_PREF_READ_TIMEOUT_MS = 2000L
-
 fun main(args: Array<String>) {
     installMacosSystemAppearance()
     CrashReporter.install()
@@ -87,13 +86,14 @@ fun main(args: Array<String>) {
 
     initKoin()
 
+    // title/MenuBar compose outside App() and never recompose, so apply the stored language first.
     runBlocking {
         val koin = GlobalContext.get()
         val tweaksRepo = koin.get<TweaksRepository>()
         val localization = koin.get<LocalizationManager>()
         val tag =
             try {
-                withTimeoutOrNull(LANGUAGE_PREF_READ_TIMEOUT_MS.milliseconds) {
+                withTimeoutOrNull(STARTUP_PREFERENCE_TIMEOUT_MS.milliseconds) {
                     tweaksRepo.getAppLanguage().first()
                 }
             } catch (_: Exception) {
```

---

### Incident Patch 12: `d8ef884e` (2026-10-03)
**Commit Message**: fix: stop content being cut off in a band above the bottom bar (#966)

* fix: stop content being cut off in a band above the bottom bar

* fix: stop the scaffold dropping the bottom display cutout

ScaffoldDefaults.contentWindowInsets bundles the bottom display cutout
together with the navigation bar, so restricting the insets to Top and
Horizontal — so the outer container owns the navigation bar — dropped the
cutout along with it. Add the bottom cutout back. The navigation bar itself
still belongs to the container, which already reserves it.

Collapse the two independent showBottomBar conditions into one modifier, and
lift the background to the container so the second copy on NavHost, painting
the same colour over the same region, is gone.

One visible consequence, accepted: with the bar shown, the container's
background now also covers the strip the bar's height reserves. That strip is
painted by BottomNavigation, which fills its full height with an opaque
surface colour, so nothing changes on screen; with the bar hidden the change
is strictly a removal, since the ancestor was already covering that area.

Give the issue composer an IME inset. It sits in the Scaffold's bottomBar
s

**File**: `feature/profile/presentation/src/commonMain/kotlin/zed/rainxch/profile/presentation/ProfileRoot.kt` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 package zed.rainxch.profile.presentation
 
 import androidx.compose.foundation.layout.Box
+import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.Spacer
 import androidx.compose.foundation.layout.fillMaxHeight
 import androidx.compose.foundation.layout.fillMaxSize
@@ -142,11 +143,11 @@ fun ProfileScreen(
         ) {
             LazyColumn(
                 state = listState,
+                contentPadding = PaddingValues(16.dp),
                 modifier =
                     Modifier
                         .constrainedContentWidth()
                         .fillMaxHeight()
-                        .padding(16.dp)
                         .arrowKeyScroll(listState, autoFocus = true),
             ) {
                 profileSections(
```

**File**: `feature/repo-pages/presentation/src/commonMain/kotlin/zed/rainxch/repopages/presentation/issuedetail/IssueDetailRoot.kt` (modified, +10/-5)
```diff
@@ -4,10 +4,14 @@ import androidx.compose.foundation.layout.Arrangement
 import androidx.compose.foundation.layout.Column
 import androidx.compose.foundation.layout.PaddingValues
 import androidx.compose.foundation.layout.Row
+import androidx.compose.foundation.layout.WindowInsets
 import androidx.compose.foundation.layout.fillMaxWidth
+import androidx.compose.foundation.layout.ime
 import androidx.compose.foundation.layout.padding
 import androidx.compose.foundation.layout.size
-import androidx.compose.foundation.layout.systemBarsPadding
+import androidx.compose.foundation.layout.systemBars
+import androidx.compose.foundation.layout.union
+import androidx.compose.foundation.layout.windowInsetsPadding
 import androidx.compose.foundation.lazy.LazyColumn
 import androidx.compose.foundation.lazy.items
 import androidx.compose.material.icons.Icons
@@ -316,10 +320,11 @@ private fun CommentComposer(
         elevation = KomiSurfaceElevation.Raised,
     ) {
         Column(
-            modifier = Modifier
-                .fillMaxWidth()
-                .systemBarsPadding()
-                .padding(horizontal = 12.dp, vertical = 8.dp),
+            modifier =
+                Modifier
+                    .fillMaxWidth()
+                    .windowInsetsPadding(WindowInsets.systemBars.union(WindowInsets.ime))
+                    .padding(horizontal = 12.dp, vertical = 8.dp),
         ) {
             if (!isLoggedIn) {
                 KomiText(
```

---

### Incident Patch 13: `02edadcb` (2026-10-03)
**Commit Message**: fix: let the user decide when a downgrade is suspected (#964)

* fix: let the user decide when a downgrade is suspected

* fix: hold the downgrade gate and settle the dialog

OnConfirmDowngradeInstall acted without checking that a warning was still
pending, so a dismissed dialog and a button press landing in the same frame
(multi-touch, or Esc plus Enter on desktop) would install with the downgrade
check skipped — the regression this PR exists to fix. Guard both confirm
actions, including the uninstall path: it erases the app's data, so acting on
a consent the user has just withdrawn is not recoverable, and that asymmetry
decides which way to fail.

Bind the consent to the release it was given for. If a refresh swapped the
selection while the dialog was open, fall back to the gated path, which
re-warns for the new target rather than applying the old consent to it.

Give cancel an explicit neutral pair, so it stops being the only one of the
three that follows the accent — which on a personality whose accent runs near
the error colour made it read as both the emphasis and a destructive action.
Read the dark/light branch off the surface the labels actually sit on rather
than the backg

**File**: `core/domain/src/commonMain/kotlin/zed/rainxch/core/domain/model/installation/InstalledAppUpdates.kt` (modified, +2/-0)
```diff
@@ -27,6 +27,7 @@ fun InstalledApp.confirmInstall(
     val landedCodeBelowTarget =
         latestVersionCode != null && latestVersionCode > 0L && versionCode < latestVersionCode
     val isUpdateStillAvailable = targetVersionStillNewer || landedCodeBelowTarget
+    val latestIsSkipped = VersionMath.isExactSameVersion(latestVersion, skippedReleaseTag)
 
     val parkedFile = if (isPending) pendingInstallFilePath else null
     val parkedVersion = if (isPending) pendingInstallVersion else null
@@ -40,6 +41,7 @@ fun InstalledApp.confirmInstall(
         installedVersionCode = versionCode,
         isUpdateAvailable =
             when {
+                latestIsSkipped -> false
                 !timestampTrackedTag -> isUpdateStillAvailable
                 landedCodeBelowTarget -> true
                 else -> false
```

**File**: `core/domain/src/commonTest/kotlin/zed/rainxch/core/domain/model/installation/InstalledAppUpdatesTest.kt` (modified, +25/-0)
```diff
@@ -16,6 +16,7 @@ class InstalledAppUpdatesTest {
         isUpdateAvailable: Boolean = true,
         isPendingInstall: Boolean = false,
         pendingFilePath: String? = "/data/parked.apk",
+        skippedReleaseTag: String? = null,
     ): InstalledApp = InstalledApp(
         packageName = "com.example.app",
         repoId = 1L,
@@ -50,6 +51,7 @@ class InstalledAppUpdatesTest {
         pendingInstallFilePath = pendingFilePath,
         pendingInstallVersion = if (pendingFilePath != null) "2.0.0" else null,
         pendingInstallAssetName = if (pendingFilePath != null) "app-2.0.0.apk" else null,
+        skippedReleaseTag = skippedReleaseTag,
     )
 
     @Test
@@ -105,6 +107,29 @@ class InstalledAppUpdatesTest {
         assertEquals(300L, result.latestVersionCode)
     }
 
+    @Test
+    fun confirmInstallKeepsASkippedLatestHiddenAfterARollback() {
+        val result =
+            app(
+                installedVersion = "2.0.0",
+                installedVersionCode = 200L,
+                latestVersion = "2.0.0",
+                latestVersionCode = 200L,
+                skippedReleaseTag = "2.0.0",
+            ).confirmInstall(
+                tag = "1.9.0",
+                assetName = "a",
+                assetUrl = "u",
+                versionName = "1.9.0",
+                versionCode = 190L,
+                signingFingerprint = null,
+                at = 1L,
+            )
+        assertFalse(result.isUpdateAvailable)
+        assertEquals(200L, result.latestVersionCode)
+        assertEquals("2.0.0", result.skippedReleaseTag)
+    }
+
     @Test
     fun confirmInstallKeepsFlagWhenLandedBuildIsOlderThanTarget() {
         val result =
```

**File**: `core/presentation/src/commonMain/composeResources/values-ar/strings-ar.xml` (modified, +3/-2)
```diff
@@ -185,8 +185,9 @@
     <!-- Uninstall / Open -->
     <string name="uninstall">إزالة التثبيت</string>
     <string name="open_app">فتح</string>
-    <string name="downgrade_requires_uninstall">الرجوع لإصدار أقدم يتطلب إزالة التثبيت</string>
-    <string name="downgrade_warning_message">تثبيت الإصدار %1$s يتطلب إزالة الإصدار الحالي (%2$s) أولاً. سيتم فقدان بيانات التطبيق.</string>
+    <string name="downgrade_warning_title">تم تحديد إصدار أقدم</string>
+    <string name="downgrade_warning_message">%1$s أقل من %2$s المثبّت بالفعل.\nقد يرفض Android تثبيت إصدار أقل.\nإذا رفض ذلك، يبقى %2$s المثبّت كما هو.</string>
+    <string name="downgrade_warning_uninstall_note">إزالة %1$s ستحذف بيانات التطبيق.</string>
     <string name="uninstall_first">إزالة التثبيت أولاً</string>
     <string name="install_version">تثبيت %1$s</string>
     <string name="failed_to_open_app">فشل فتح %1$s</string>
```

**File**: `core/presentation/src/commonMain/composeResources/values-bn/strings-bn.xml` (modified, +3/-2)
```diff
@@ -339,8 +339,9 @@
     <!-- Uninstall / Open -->
     <string name="uninstall">আনইনস্টল</string>
     <string name="open_app">খুলুন</string>
-    <string name="downgrade_requires_uninstall">ডাউনগ্রেডের জন্য আনইনস্টল প্রয়োজন</string>
-    <string name="downgrade_warning_message">সংস্করণ %1$s ইনস্টল করতে বর্তমান সংস্করণ (%2$s) প্রথমে আনইনস্টল করতে হবে। অ্যাপের ডেটা মুছে যাবে।</string>
+    <string name="downgrade_warning_title">পুরোনো সংস্করণ নির্বাচন করা হয়েছে</string>
+    <string name="downgrade_warning_message">%1$s ইতিমধ্যে ইনস্টল করা %2$s-এর চেয়ে কম।\nAndroid কম সংস্করণ ইনস্টল করতে অস্বীকার করতে পারে।\nযদি অস্বীকার করে, ইনস্টল করা %2$s অপরিবর্তিত থাকে।</string>
+    <string name="downgrade_warning_uninstall_note">%1$s আনইনস্টল করলে অ্যাপের ডেটা মুছে যাবে।</string>
     <string name="uninstall_first">প্রথমে আনইনস্টল করুন</string>
     <string name="install_version">%1$s ইনস্টল করুন</string>
     <string name="failed_to_open_app">%1$s খুলতে ব্যর্থ</string>
```

**File**: `core/presentation/src/commonMain/composeResources/values-es/strings-es.xml` (modified, +3/-2)
```diff
@@ -310,8 +310,9 @@
     <!-- Uninstall / Open -->
     <string name="uninstall">Desinstalar</string>
     <string name="open_app">Abrir</string>
-    <string name="downgrade_requires_uninstall">La degradación requiere desinstalar</string>
-    <string name="downgrade_warning_message">Instalar la versión %1$s requiere desinstalar la versión actual (%2$s) primero. Los datos de la app se perderán.</string>
+    <string name="downgrade_warning_title">Versión más antigua seleccionada</string>
+    <string name="downgrade_warning_message">%1$s es inferior a la %2$s ya instalada.\nAndroid puede negarse a instalar una versión inferior.\nSi lo hace, la %2$s instalada no se modifica.</string>
+    <string name="downgrade_warning_uninstall_note">Desinstalar %1$s borra los datos de la aplicación.</string>
     <string name="uninstall_first">Desinstalar primero</string>
     <string name="install_version">Instalar %1$s</string>
     <string name="failed_to_open_app">Error al abrir %1$s</string>
```

**File**: `core/presentation/src/commonMain/composeResources/values-fr/strings-fr.xml` (modified, +3/-2)
```diff
@@ -310,8 +310,9 @@
     <!-- Uninstall / Open -->
     <string name="uninstall">Désinstaller</string>
     <string name="open_app">Ouvrir</string>
-    <string name="downgrade_requires_uninstall">La rétrogradation nécessite la désinstallation</string>
-    <string name="downgrade_warning_message">L'installation de la version %1$s nécessite la désinstallation de la version actuelle (%2$s). Les données de l'application seront perdues.</string>
+    <string name="downgrade_warning_title">Version plus ancienne sélectionnée</string>
+    <string name="downgrade_warning_message">%1$s est inférieure à la %2$s déjà installée.\nAndroid peut refuser d'installer une version plus ancienne.\nS'il refuse, la %2$s installée reste inchangée.</string>
+    <string name="downgrade_warning_uninstall_note">Désinstaller %1$s efface les données de l'application.</string>
     <string name="uninstall_first">Désinstaller d'abord</string>
     <string name="install_version">Installer %1$s</string>
     <string name="failed_to_open_app">Impossible d'ouvrir %1$s</string>
```

**File**: `core/presentation/src/commonMain/composeResources/values-hi/strings-hi.xml` (modified, +3/-2)
```diff
@@ -337,8 +337,9 @@
     <!-- Uninstall / Open -->
     <string name="uninstall">अनइंस्टॉल</string>
     <string name="open_app">खोलें</string>
-    <string name="downgrade_requires_uninstall">डाउनग्रेड के लिए अनइंस्टॉल आवश्यक</string>
-    <string name="downgrade_warning_message">संस्करण %1$s इंस्टॉल करने के लिए पहले वर्तमान संस्करण (%2$s) को अनइंस्टॉल करना होगा। ऐप डेटा खो जाएगा।</string>
+    <string name="downgrade_warning_title">पुराना संस्करण चुना गया</string>
+    <string name="downgrade_warning_message">%1$s पहले से इंस्टॉल %2$s से कम है।\nAndroid कम संस्करण इंस्टॉल करने से मना कर सकता है।\nऐसा होने पर, इंस्टॉल किया गया %2$s वैसा ही रहता है।</string>
+    <string name="downgrade_warning_uninstall_note">%1$s को अनइंस्टॉल करने पर ऐप का डेटा मिट जाएगा।</string>
     <string name="uninstall_first">पहले अनइंस्टॉल करें</string>
     <string name="install_version">%1$s इंस्टॉल करें</string>
     <string name="failed_to_open_app">%1$s खोलने में विफल</string>
```

**File**: `core/presentation/src/commonMain/composeResources/values-it/strings-it.xml` (modified, +3/-2)
```diff
@@ -335,8 +335,9 @@
     <!-- Uninstall / Open -->
     <string name="uninstall">Disinstalla</string>
     <string name="open_app">Apri</string>
-    <string name="downgrade_requires_uninstall">Il downgrade richiede la disinstallazione</string>
-    <string name="downgrade_warning_message">L'installazione della versione %1$s richiede la disinstallazione della versione corrente (%2$s). I dati dell'app verranno persi.</string>
+    <string name="downgrade_warning_title">Versione precedente selezionata</string>
+    <string name="downgrade_warning_message">%1$s è inferiore alla %2$s già installata.\nAndroid potrebbe rifiutarsi di installare una versione precedente.\nSe lo fa, la %2$s installata resta invariata.</string>
+    <string name="downgrade_warning_uninstall_note">Disinstallare %1$s cancella i dati dell'app.</string>
     <string name="uninstall_first">Disinstalla prima</string>
     <string name="install_version">Installa %1$s</string>
     <string name="failed_to_open_app">Impossibile aprire %1$s</string>
```

---

### Incident Patch 14: `07cf7c15` (2026-10-03)
**Commit Message**: fix(search): pass owner and repo when opening foreign repos (#987)

* fix(search): preserve foreign repo identity when opening details

* fix(navigation): pass owner and repo for foreign details

**File**: `composeApp/src/commonMain/kotlin/zed/rainxch/githubstore/app/navigation/AppNavigation.kt` (modified, +5/-1)
```diff
@@ -343,18 +343,22 @@ fun AppNavigation(
                                             onNavigateBack = {
                                                 navController.navigateUp()
                                             },
-                                            onNavigateToDetails = { repoId, sourceHost ->
+                                            onNavigateToDetails = { repoId, owner, repo, sourceHost ->
                                                 if (isExpanded) {
                                                     listDetailState.select(
                                                         AdaptiveDetailArgs(
                                                             repositoryId = repoId,
+                                                            owner = owner,
+                                                            repo = repo,
                                                             sourceHost = sourceHost,
                                                         ),
                                                     )
                                                 } else {
                                                     navController.navigate(
                                                         GithubStoreGraph.DetailsScreen(
                                                             repositoryId = repoId,
+                                                            owner = owner,
+                                                            repo = repo,
                                                             sourceHost = sourceHost,
                                                         ),
                                                     )
```

**File**: `feature/search/presentation/src/commonMain/kotlin/zed/rainxch/search/presentation/SearchRoot.kt` (modified, +7/-2)
```diff
@@ -124,7 +124,7 @@ import kotlin.time.Duration.Companion.milliseconds
 @Composable
 fun SearchRoot(
     onNavigateBack: () -> Unit,
-    onNavigateToDetails: (repoId: Long, sourceHost: String?) -> Unit,
+    onNavigateToDetails: (repoId: Long, owner: String, repo: String, sourceHost: String?) -> Unit,
     onNavigateToDetailsFromLink: (owner: String, repo: String) -> Unit,
     onNavigateToDeveloperProfile: (username: String) -> Unit,
     viewModel: SearchViewModel = koinViewModel(),
@@ -153,7 +153,12 @@ fun SearchRoot(
         onAction = { action ->
             when (action) {
                 is SearchAction.OnRepositoryClick -> {
-                    onNavigateToDetails(action.repository.id, action.repository.sourceHost)
+                    onNavigateToDetails(
+                        action.repository.id,
+                        action.repository.owner.login,
+                        action.repository.name,
+                        action.repository.sourceHost,
+                    )
                 }
 
                 SearchAction.OnNavigateBackClick -> {
```

---

### Incident Patch 15: `ec9f0d26` (2026-10-03)
**Commit Message**: fix: display release and advisory dates in the device timezone (#954)

* fix: display release and advisory dates in the device timezone

* fix: stop a bare release date shifting a day in western timezones

A date-only publishedAt ("2026-09-23") was parsed as UTC midnight and then
rendered through the device zone, so anything west of UTC showed the day
before and disagreed with GitHub's own page.

Add formatIsoDateOrRaw, which only routes a value through the timezone when
it actually carries a time component, and use it at every call site that
formatted a release or advisory date — including the apps list, which had no
raw fallback at all.

Lift the security advisory's date out of the composable's buildString so it
is remembered rather than re-parsed on every recomposition.

**File**: `core/presentation/src/commonMain/kotlin/zed/rainxch/core/presentation/utils/TimeFormatters.kt` (modified, +4/-0)
```diff
@@ -112,6 +112,10 @@ fun formatIsoDate(isoTimestamp: String?): String? {
     return instant.toLocalDateTime(TimeZone.currentSystemDefault()).date.toString()
 }
 
+@OptIn(ExperimentalTime::class)
+fun formatIsoDateOrRaw(iso: String): String =
+    if (iso.length > 10) formatIsoDate(iso) ?: iso.take(10) else iso.take(10)
+
 @OptIn(ExperimentalTime::class)
 fun formatEpochDate(timestamp: Long): String? {
     if (timestamp <= 0L) return null
```

**File**: `feature/apps/presentation/src/commonMain/kotlin/zed/rainxch/apps/presentation/mappers/AppItemMapper.kt` (modified, +5/-2)
```diff
@@ -5,7 +5,7 @@ import zed.rainxch.apps.presentation.model.AppItem
 import zed.rainxch.apps.presentation.model.InstalledAppUi
 import zed.rainxch.apps.presentation.model.UpdateState
 import zed.rainxch.core.presentation.utils.formatEpochDate
-import zed.rainxch.core.presentation.utils.formatIsoDate
+import zed.rainxch.core.presentation.utils.formatIsoDateOrRaw
 import zed.rainxch.githubstore.core.presentation.res.Res
 import zed.rainxch.githubstore.core.presentation.res.apps_version_dated
 import zed.rainxch.githubstore.core.presentation.res.apps_version_update
@@ -55,7 +55,10 @@ private suspend fun buildVersionLabel(
     lastUpdatedAt: Long,
 ): String {
     val displayDate = if (latestVersion != null) {
-        formatIsoDate(latestReleasePublishedAt)
+        // Release publish times can arrive as a bare date. Formatting one through the local
+        // timezone is what shifted it a day back west of UTC, so this goes through the raw-aware
+        // helper like the details and security screens do.
+        latestReleasePublishedAt?.let { formatIsoDateOrRaw(it) }
     } else {
         formatEpochDate(lastUpdatedAt)
     }
```

**File**: `feature/details/presentation/src/commonMain/kotlin/zed/rainxch/details/presentation/components/VersionPicker.kt` (modified, +2/-1)
```diff
@@ -40,6 +40,7 @@ import zed.rainxch.core.presentation.components.overlays.KomiSheetPlacement
 import zed.rainxch.core.presentation.components.text.KomiText
 import zed.rainxch.core.presentation.components.text.KomiTextRole
 import zed.rainxch.core.presentation.locals.LocalPersonality
+import zed.rainxch.core.presentation.utils.formatIsoDateOrRaw
 import zed.rainxch.details.presentation.DetailsAction
 import zed.rainxch.githubstore.core.presentation.res.Res
 import zed.rainxch.githubstore.core.presentation.res.latest_badge
@@ -251,7 +252,7 @@ private fun VersionListItem(
                 }
             }
             KomiText(
-                text = release.publishedAt.take(10),
+                text = formatIsoDateOrRaw(release.publishedAt),
                 role = KomiTextRole.Label,
                 fontSize = 12.sp,
                 fontWeight = FontWeight.Medium,
```

**File**: `feature/details/presentation/src/commonMain/kotlin/zed/rainxch/details/presentation/components/sections/WhatsNew.kt` (modified, +2/-1)
```diff
@@ -49,6 +49,7 @@ import zed.rainxch.core.presentation.components.markdown.rememberMarkdownTypogra
 import zed.rainxch.core.presentation.components.text.KomiText
 import zed.rainxch.core.presentation.components.text.KomiTextRole
 import zed.rainxch.core.presentation.locals.LocalPersonality
+import zed.rainxch.core.presentation.utils.formatIsoDateOrRaw
 import zed.rainxch.githubstore.core.presentation.res.*
 
 fun LazyListScope.whatsNew(
@@ -104,7 +105,7 @@ fun LazyListScope.whatsNew(
                 uppercase = false,
             )
             KomiText(
-                text = release.publishedAt.take(10),
+                text = formatIsoDateOrRaw(release.publishedAt),
                 role = KomiTextRole.Label,
                 fontSize = 12.sp,
                 color = colors.onSurfaceVariant,
```

**File**: `feature/details/presentation/src/commonMain/kotlin/zed/rainxch/details/presentation/whatsnew/DetailsWhatsNewViewModel.kt` (modified, +2/-1)
```diff
@@ -9,6 +9,7 @@ import kotlinx.coroutines.flow.update
 import kotlinx.coroutines.launch
 import org.jetbrains.compose.resources.getString
 import zed.rainxch.core.domain.model.account.github.GithubRelease
+import zed.rainxch.core.presentation.utils.formatIsoDateOrRaw
 import zed.rainxch.details.domain.repository.DetailsRepository
 import zed.rainxch.details.domain.repository.TranslationRepository
 import zed.rainxch.details.presentation.model.SupportedLanguages
@@ -168,7 +169,7 @@ class DetailsWhatsNewViewModel(
             WhatsNewReleaseUi(
                 id = release.id,
                 tagName = release.tagName,
-                publishedDate = release.publishedAt.take(10),
+                publishedDate = formatIsoDateOrRaw(release.publishedAt),
                 body = body,
             )
         }.toImmutableList()
```

**File**: `feature/repo-pages/presentation/src/commonMain/kotlin/zed/rainxch/repopages/presentation/security/SecurityRoot.kt` (modified, +7/-2)
```diff
@@ -13,6 +13,7 @@ import androidx.compose.foundation.lazy.items
 import androidx.compose.foundation.shape.RoundedCornerShape
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.getValue
+import androidx.compose.runtime.remember
 import androidx.compose.ui.Modifier
 import androidx.compose.ui.text.font.FontWeight
 import androidx.compose.ui.unit.dp
@@ -25,6 +26,7 @@ import zed.rainxch.core.presentation.components.text.KomiText
 import zed.rainxch.core.presentation.components.text.KomiTextRole
 import zed.rainxch.core.presentation.locals.LocalPersonality
 import zed.rainxch.core.presentation.locals.LocalStatusColors
+import zed.rainxch.core.presentation.utils.formatIsoDateOrRaw
 import zed.rainxch.githubstore.core.presentation.res.Res
 import zed.rainxch.githubstore.core.presentation.res.repo_pages_security_advisories_header
 import zed.rainxch.githubstore.core.presentation.res.repo_pages_security_no_advisories
@@ -160,6 +162,9 @@ private fun SectionHeader(text: String) {
 @Composable
 private fun AdvisoryCard(advisory: SecurityAdvisory) {
     val colors = LocalPersonality.current.colors
+    val publishedDate = remember(advisory.publishedAt) {
+        advisory.publishedAt?.let { formatIsoDateOrRaw(it) }
+    }
     KomiSurface(
         modifier = Modifier.fillMaxWidth(),
     ) {
@@ -181,9 +186,9 @@ private fun AdvisoryCard(advisory: SecurityAdvisory) {
 
                 val meta = buildString {
                     advisory.cveId?.let { append(it) }
-                    advisory.publishedAt?.let {
+                    publishedDate?.let {
                         if (isNotEmpty()) append(" · ")
-                        append(it.take(10))
+                        append(it)
                     }
                 }
                 if (meta.isNotEmpty()) {
```

#### Recent Merged Pull Requests:
- **PR #1008** (2026-10-04): fix(updates): a failed check keeps the update it found before (@rainxchzed)
- **PR #1006** (2026-10-04): fix(updates): run background checks on Android 12+, check every 12 hours (@rainxchzed)
- **PR #1005** (2026-10-04): perf: cut requests the app makes on its own, mark the rest as background (@rainxchzed)
- **PR #999** (2026-10-03): feat(details): name the app being viewed in a monorepo (@rainxchzed)
- **PR #997** (2026-10-03): feat(discovery): show the filtered platform's release date on cards (@rainxchzed)
- **PR #996** (2026-10-03): feat(details): open on a release this device can install, show every platform (@rainxchzed)
- **PR #995** (2026-10-03): fix(apps): keep the Library at the top when a section appears above (@rainxchzed)
- **PR #994** (2026-10-03): feat: group apps that share a repository (@rainxchzed)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
