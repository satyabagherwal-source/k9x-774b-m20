# Forensic Learning Record (Deep Inspection): zoontek/react-native-bootsplash

> **Canonical Artifact**: `07_PROJECT_LEARNING/zoontek-react-native-bootsplash-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zoontek/react-native-bootsplash](https://github.com/zoontek/react-native-bootsplash))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:03:16.287Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zoontek/react-native-bootsplash`
- **Description**: 🚀 Show a splash screen during app startup. Hide it when you are ready.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4305 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/extras/utils.ts`
```
import * as Expo from "@expo/config-plugins";
import crypto from "crypto";
import detectIndent, { type Indent } from "detect-indent";
import fs from "fs";
import { parse as parseHtml } from "node-html-parser";
import path from "path";
import pc from "picocolors";
import type { Options as PrettierOptions } from "prettier";
import * as htmlPlugin from "prettier/plugins/html";
import * as cssPlugin from "prettier/plugins/postcss";
import * as prettier from "prettier/standalone";
import semver from "semver";
import sharp, { type Sharp } from "sharp";
import { dedent } from "ts-dedent";
import formatXml, { type XMLFormatterOptions } from "xml-formatter";
import type { Manifest } from "..";

export const PACKAGE_NAME = "react-native-bootsplash";

export type BootSplashPluginConfig = {
  /**
   * Logo file path (PNG or SVG)
   */
  logo: string;
  /**
   * Background color (in hexadecimal format)
   * @default "#fff"
   */
  background?: string;
  /**
   * Logo width at @1x (in dp - we recommend approximately ~100)
   * @default 100
   */
  logoWidth?: number;
  /**
   * Assets output directory path
   * @default "assets/bootsplash"
   */
  assetsOutput?: string;
  /**
   * License key to enable brand and dark mode assets generation
   * @deprecated Passing `licenseKey` directly in plugin config is deprecated as it could be leaked by `expo-constants`. Use the `BOOTSPLASH_LICENSE_KEY` environment variable instead.
   */
  licenseKey?: string;
  /**
   * Brand file path (PNG or SVG)
   */
  brand?: string;
  /**
   * Brand width at @1x (in dp - we recommend approximately ~80)
   * @default 80
   */
  brandWidth?: number;
  /**
   * [dark mode] Background color (in hexadecimal format)
   */
  darkBackground?: string;
  /**
   * [dark mode] Logo file path (PNG or SVG)
   */
  darkLogo?: string;
  /**
   * [dark mode] Brand file path (PNG or SVG)
   */
  darkBrand?: string;

  android?: {
    /**
     * Enforce system bars style
     */
    darkContentBarsStyle?: boolean;
  };
};

type LoggerMode = { type: "plugin" } | { type: "cli"; cwd: string };
let loggerMode: LoggerMode = { type: "plugin" };

export const setLoggerMode = (value: LoggerMode) => {
  loggerMode = value;
};

const warningMessages = new Set<string>();
const errorMessages = new Set<string>();

export const log = {
  warn: (text: string) => {
    if (loggerMode.type === "cli") {
      console.log(pc.yellow(`⚠️  ${text}`));
    } else {
      const message = `⚠️  [${PACKAGE_NAME}] ${text}`;

      if (!warningMessages.has(message)) {
        warningMessages.add(message);
        console.log(pc.yellow(message));
      }
    }
  },
  error: (text: string) => {
    if (loggerMode.type === "cli") {
      console.log(pc.red(`❌  ${text}`));
    } else {
      const message = `❌ [${PACKAGE_NAME}] ${text}`;

      if (!errorMessages.has(message)) {
        errorMessages.add(message);
        console.log(pc.red(message));
      }
    }
  },
  title: (emoji: string, text: string) => {
    if (loggerMode.type === "cli") {
      console.log(`\n${emoji}  ${pc.underline(pc.bold(text))}`);
    }
  },
  write: (filePath: string, dimensions?: { width: number; height: number }) => {
    if (loggerMode.type === "cli") {
      console.log(
        `    ${path.relative(loggerMode.cwd, filePath)}` +
          (dimensions != null
            ? ` (${dimensions.width}x${dimensions.height})`
            : ""),
      );
    }
  },
};

// Freely inspired by https://github.com/humanwhocodes/humanfs
export const hfs = {
  buffer: (path: string) => fs.readFileSync(path),
  exists: (path: string) => fs.existsSync(path),
  json: (path: string) => JSON.parse(fs.readFileSync(path, "utf-8")) as unknown,
  readDir: (path: string) => fs.readdirSync(path, "utf-8"),
  realPath: (path: string) => fs.realpathSync(path, "utf-8"),
  rm: (path: string) => fs.rmSync(path, { force: true, recursive: true }),
  text: (path: string) => fs.readFileSync(path, "utf-8"),

  ensureDir: (dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
  },
  write: (path: string, content: string) => {
    const trimmed = content.trim();
    fs.writeFileSync(path, trimmed === "" ? trimmed : trimmed + "\n", "utf-8");
  },
};

export const writeJson = (filePath: string, content: object) => {
  hfs.write(filePath, JSON.stringify(content, null, 2));
  log.write(filePath);
};

type FormatOptions = { indent?: Indent } & (
  | {
      formatter: "prettier";
      selfClosingTags?: boolean;
      useCssPlugin?: boolean;
      htmlWhitespaceSensitivity?: PrettierOptions["htmlWhitespaceSensitivity"];
      singleAttributePerLine?: PrettierOptions["singleAttributePerLine"];
    }
  | {
      formatter: "xmlFormatter";
      whiteSpaceAtEndOfSelfclosingTag?: XMLFormatterOptions["whiteSpaceAtEndOfSelfclosingTag"];
    }
);

export const readXmlLike = (filePath: string) => {
  const content = hfs.text(filePath);

  return {
    root: parseHtml(content),
    formatOptions: { indent: detectIndent(content) },
  };
};

export const writeXmlLike = async (
  filePath: string,
  content: string,
  { indent, ...formatOptions }: FormatOptions,
) => {
  if (formatOptions.formatter === "prettier") {
    const {
      formatter,
      useCssPlugin = false,
      selfClosingTags = false,
      ...options
    } = formatOptions;

    const formatted = await prettier.format(content, {
      parser: "html",
      bracketSameLine: true,
      printWidth: 10000,
      plugins: [htmlPlugin, ...(useCssPlugin ? [cssPlugin] : [])],
      useTabs: indent?.type === "tab",
      tabWidth: (indent?.amount ?? 0) || 2,
      ...options,
    });

    hfs.write(
      filePath,
      selfClosingTags
        ? formatted.replace(/><\/[a-z-0-9]+>/gi, " />")
        : formatted,
    );

    log.write(filePath);
  } else {
    const { formatter, ...options } = formatOptions;

    const formatted = formatXml(content, {
      collapseContent: true,
      forceSelfClosingEmptyTag: true,
      lineSeparator: "\n",
      whiteSpaceAtEndOfSelfclosingTag: true,
      indentation: (indent?.indent ?? "") || "    ",
      ...options,
    });

    hfs.write(filePath, formatted);
    log.write(filePath);
  }
};

export type Asset = {
  path: string;
  image: Sharp;
  hash: string;
  height: number;
  width: number;
};

const toAsset = async (filePath: string, width: number): Promise<Asset> => {
  const image = sharp(filePath);
  const { format } = await image.metadata();

  if (format !== "png" && format !== "svg") {
    log.error(
      `${path.basename(filePath)} image file format (${format}) is not supported`,
    );
    process.exit(1);
  }

  const [height, hash] = await Promise.all([
    image
      .clone()
      .resize(width)
      .toBuffer()
      .then((buffer) => sharp(buffer).metadata())
      .then(({ height = 0 }) => Math.round(height)),

    image
      .clone()
      .resize(width)
      .png({ quality: 100 })
      .toBuffer()
      .then((buffer) => buffer.toString("base64")),
  ]);

  return {
    path: filePath,
    image,
    hash,
    height,
    width,
  };
};

const parseColor = (value: string) => {
  const up = value.toUpperCase().replace(/[^0-9A-F]/g, "");

  if (up.length !== 3 && up.length !== 6) {
    log.error(`"${value}" value is not a valid hexadecimal color.`);
    process.exit(1);
  }

  const hex =
    up.length === 3
      ? "#" + up[0] + up[0] + up[1] + up[1] + up[2] + up[2]
      : "#" + up;

  const rgb = {
    R: (Number.parseInt("" + hex[1] + hex[2], 16) / 255).toPrecision(15),
    G: (Number.parseInt("" + hex[3] + hex[4], 16) / 255).toPrecision(15),
    B: (Number.parseInt("" + hex[5] + hex[6], 16) / 255).toPrecision(15),
  };

  return { hex: hex.toLowerCase(), rgb };
};

export const transformProps = async (
  rootPath: string,
  { android = {}, licenseKey, ...rawProps }: BootSplashPluginConfig,
) => {
  if (semver.lt(process.versions.node, "20.0.0")) {
    log.error("Requires Node 20 (or higher)");
    process.exit(1);
  }

  const withDefaults = {
    assetsOutput: "assets/bootsplash",
    background: "#fff",
    brandWidth: 80,
    logoWidth: 100,
    ...rawProps,
  };

  const assetsOutputPath = path.resolve(rootPath, withDefaults.assetsOutput);
  const logoPath = path.resolve(rootPath, withDefaults.logo);

  const darkLogoPath =
    withDefaults.darkLogo != null
      ? path.resolve(rootPath, withDefaults.darkLogo)
      : undefined;

  const brandPath =
    withDefaults.brand != null
      ? path.resolve(rootPath, withDefaults.brand)
      : undefined;

  const darkBrandPath =
    withDefaults.darkBrand != null
      ? path.resolve(rootPath, withDefaults.darkBrand)
      : undefined;

  const logoWidth = withDefaults.logoWidth - (withDefaults.logoWidth % 2);
  const brandWidth = withDefaults.brandWidth - (withDefaults.brandWidth % 2);

  const [logo, darkLogo, brand, darkBrand] = await Promise.all([
    toAsset(logoPath, logoWidth),
    darkLogoPath != null ? toAsset(darkLogoPath, logoWidth) : undefined,
    brandPath != null ? toAsset(brandPath, brandWidth) : undefined,
    darkBrandPath != null ? toAsset(darkBrandPath, brandWidth) : undefined,
  ]);

  const background = parseColor(withDefaults.background);

  const darkBackground =
    withDefaults.darkBackground != null
      ? parseColor(withDefaults.darkBackground)
      : undefined;

  const executeAddon =
    brand != null ||
    darkBackground != null ||
    darkLogo != null ||
    darkBrand != null;

  if (licenseKey != null && !executeAddon) {
    log.warn(
      "You specified a license key but none of the options that requires it.",
    );
  }

  const isPluginLoggerMode = loggerMode.type === "plugin";

  const optionNames = {
    brand: isPluginLoggerMode ? "brand" : "--brand",
    darkBackground: isPluginLoggerMode ? "darkBackground" : "--dark-background",
    darkLogo: isPluginLoggerMode ? "darkLogo" : "--dark-logo",
    darkBrand: isPluginLoggerMode ? "darkBrand" : "--dark-brand",
  };

  if (licenseKey == null && executeAddon) {
    const options = [
      b
```

### Core Architecture Module: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplash.kt`
```
package com.zoontek.rnbootsplash

import android.app.Activity
import androidx.annotation.StyleRes

object RNBootSplash {

  @JvmStatic
  fun init(activity: Activity, @StyleRes themeResId: Int) {
    RNBootSplashModuleImpl.init(activity, themeResId)
  }
}

```

### Core Architecture Module: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplashModuleImpl.kt`
```
package com.zoontek.rnbootsplash

import android.annotation.SuppressLint
import android.app.Activity
import android.content.res.Configuration
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewTreeObserver.OnPreDrawListener
import androidx.annotation.StyleRes
import com.facebook.common.logging.FLog
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.ReactConstants
import com.facebook.react.uimanager.PixelUtil
import java.util.concurrent.ConcurrentLinkedQueue

object RNBootSplashModuleImpl {
  const val NAME = "RNBootSplash"

  private enum class Status {
    HIDDEN,
    HIDING,
    INITIALIZING,
    VISIBLE,
  }

  @StyleRes private var mThemeResId = -1
  private val mPromiseQueue = ConcurrentLinkedQueue<Promise>()
  private var mStatus = Status.HIDDEN
  private var mSplashView: RNBootSplashView? = null

  internal fun init(mainActivity: Activity?, @StyleRes themeResId: Int) {
    if (mThemeResId != -1) {
      return FLog.w(
        ReactConstants.TAG,
        "$NAME: Ignored initialization, module is already initialized."
      )
    }

    mThemeResId = themeResId

    if (mainActivity == null) {
      return FLog.w(
        ReactConstants.TAG,
        "$NAME: Ignored initialization, current activity is null."
      )
    }

    // Apply postBootSplashTheme
    val typedValue = TypedValue()
    val currentTheme = mainActivity.theme

    if (currentTheme.resolveAttribute(R.attr.postBootSplashTheme, typedValue, true)) {
      val finalThemeId = typedValue.resourceId

      if (finalThemeId != 0) {
        mainActivity.setTheme(finalThemeId)
      }
    }

    // Keep the splash screen on-screen until View is shown
    val contentView = mainActivity.findViewById<View>(android.R.id.content)
    mStatus = Status.INITIALIZING

    contentView.viewTreeObserver.addOnPreDrawListener(object : OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        if (mStatus == Status.INITIALIZING) {
          return false
        }

        contentView.viewTreeObserver.removeOnPreDrawListener(this)
        return true
      }
    })

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // This is not called on Android 12 when activity is started using intent
      // (Android studio / CLI / notification / widget…)
      val splashScreen = mainActivity.splashScreen

      // Remove it immediately, without animation. Never clear this listener on activity stop:
      // the view would never be removed and the splash screen would stay visible forever.
      // Running no animation also avoids https://issuetracker.google.com/issues/242118185
      splashScreen.setOnExitAnimationListener { view ->
        view.remove()
        splashScreen.clearOnExitAnimationListener()
      }
    }

    UiThreadUtil.runOnUiThread {
      mSplashView = RNBootSplashView(mainActivity, mThemeResId)
      mStatus = Status.VISIBLE
    }
  }

  private fun clearPromiseQueue() {
    generateSequence { mPromiseQueue.poll() }.forEach { it.resolve(true) }
  }

  private fun hideAndClearPromiseQueue(reactContext: ReactApplicationContext, fade: Boolean) {
    UiThreadUtil.runOnUiThread {
      val activity = reactContext.currentActivity

      if (
        mStatus == Status.INITIALIZING ||
          activity == null ||
          activity.isFinishing ||
          activity.isDestroyed
      ) {
        Handler(Looper.getMainLooper())
          .postDelayed({ hideAndClearPromiseQueue(reactContext, fade) }, 100)
        return@runOnUiThread
      }

      if (mStatus == Status.HIDING) {
        return@runOnUiThread // wait until fade out end for clearPromiseQueue
      }

      if (mStatus == Status.HIDDEN) {
        clearPromiseQueue()
        return@runOnUiThread // view is hidden
      }

      mStatus = Status.HIDING

      val callback = {
        mSplashView = null
        mStatus = Status.HIDDEN
        clearPromiseQueue()
      }

      mSplashView?.remove(fade, callback) ?: callback()
    }
  }

  // From https://stackoverflow.com/a/61062773
  val isSamsungOneUI4: Boolean by lazy {
    runCatching {
      val field = Build.VERSION::class.java.getDeclaredField("SEM_PLATFORM_INT")
      val version = (field.getInt(null) - 90000) / 10000
      version == 4
    }.getOrDefault(false)
  }

  internal fun onHostDestroy() {
    mStatus = Status.HIDDEN
    mThemeResId = -1
    clearPromiseQueue()

    mSplashView?.let { view ->
      view.animate().cancel()
      view.remove(false)
      mSplashView = null
    }
  }

  fun getConstants(reactContext: ReactApplicationContext): Map<String, Any> {
    val resources = reactContext.resources
    val uiMode = reactContext.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK

    @SuppressLint("InternalInsetResource", "DiscouragedApi")
    val statusBarHeightResId =
      resources.getIdentifier("status_bar_height", "dimen", "android")

    @SuppressLint("InternalInsetResource", "DiscouragedApi")
    val navigationBarHeightResId =
      resources.getIdentifier("navigation_bar_height", "dimen", "android")

    val statusBarHeight = when {
      statusBarHeightResId > 0 ->
        PixelUtil.toDIPFromPixel(resources.getDimensionPixelSize(statusBarHeightResId).toFloat())
      else -> 0f
    }

    val navigationBarHeight = when {
      navigationBarHeightResId > 0 && !ViewConfiguration.get(reactContext).hasPermanentMenuKey() ->
        PixelUtil.toDIPFromPixel(resources.getDimensionPixelSize(navigationBarHeightResId).toFloat())
      else -> 0f
    }

    return buildMap {
      put("darkModeEnabled", uiMode == Configuration.UI_MODE_NIGHT_YES)
      put("logoSizeRatio", if (isSamsungOneUI4) 0.5 else 1.0)
      put("navigationBarHeight", navigationBarHeight)
      put("statusBarHeight", statusBarHeight)
    }
  }

  fun hide(reactContext: ReactApplicationContext, fade: Boolean, promise: Promise) {
    mPromiseQueue.add(promise)
    hideAndClearPromiseQueue(reactContext, fade)
  }

  fun isVisible(): Boolean {
    return mStatus != Status.HIDDEN
  }
}

```

### Core Architecture Module: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplashPackage.kt`
```
package com.zoontek.rnbootsplash

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class RNBootSplashPackage : TurboReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == RNBootSplashModuleImpl.NAME) RNBootSplashModule(reactContext) else null
  }

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      RNBootSplashModuleImpl.NAME to ReactModuleInfo(
        RNBootSplashModuleImpl.NAME,
        RNBootSplashModuleImpl.NAME,
        false,
        false,
        false,
        BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      )
    )
  }
}

```

### Core Architecture Module: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplashView.kt`
```
package com.zoontek.rnbootsplash

import android.annotation.SuppressLint
import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateInterpolator
import androidx.annotation.StyleRes
import androidx.appcompat.view.ContextThemeWrapper

@SuppressLint("ViewConstructor")
class RNBootSplashView(activity: Activity, @StyleRes themeResId: Int) :
  View(ContextThemeWrapper(activity, themeResId)) {

  init {
    setBackgroundResource(
      if (RNBootSplashModuleImpl.isSamsungOneUI4) R.drawable.compat_splash_screen_oneui_4
      else R.drawable.compat_splash_screen
    )

    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT
    )

    val decorView = activity.window.decorView as ViewGroup
    decorView.addView(this)
  }

  fun remove(fade: Boolean, callback: () -> Unit = {}) {
    val parent = parent as? ViewGroup

    if (parent == null) {
      callback()
    } else if (fade) {
      animate()
        .alpha(0f)
        .setDuration(250)
        .setInterpolator(AccelerateInterpolator(2f))
        .withEndAction {
          parent.removeView(this)
          callback()
        }
        .start()
    } else {
      parent.removeView(this)
      callback()
    }
  }
}

```

### Core Architecture Module: `android/src/newarch/com/zoontek/rnbootsplash/RNBootSplashModule.kt`
```
package com.zoontek.rnbootsplash

import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNBootSplashModuleImpl.NAME)
class RNBootSplashModule(reactContext: ReactApplicationContext) :
  NativeRNBootSplashSpec(reactContext), LifecycleEventListener {

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String {
    return RNBootSplashModuleImpl.NAME
  }

  override fun onHostResume() {}

  override fun onHostPause() {}

  override fun onHostDestroy() {
    RNBootSplashModuleImpl.onHostDestroy()
  }

  override fun getTypedExportedConstants(): Map<String, Any> {
    return RNBootSplashModuleImpl.getConstants(reactApplicationContext)
  }

  override fun hide(fade: Boolean, promise: Promise) {
    RNBootSplashModuleImpl.hide(reactApplicationContext, fade, promise)
  }

  override fun isVisible(): Boolean {
    return RNBootSplashModuleImpl.isVisible()
  }
}

```

### Core Architecture Module: `android/src/oldarch/com/zoontek/rnbootsplash/RNBootSplashModule.kt`
```
package com.zoontek.rnbootsplash

import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = RNBootSplashModuleImpl.NAME)
class RNBootSplashModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

  init {
    reactContext.addLifecycleEventListener(this)
  }

  override fun getName(): String {
    return RNBootSplashModuleImpl.NAME
  }

  override fun onHostResume() {}

  override fun onHostPause() {}

  override fun onHostDestroy() {
    RNBootSplashModuleImpl.onHostDestroy()
  }

  override fun getConstants(): Map<String, Any> {
    return RNBootSplashModuleImpl.getConstants(reactApplicationContext)
  }

  @ReactMethod
  fun hide(fade: Boolean, promise: Promise) {
    RNBootSplashModuleImpl.hide(reactApplicationContext, fade, promise)
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun isVisible(): Boolean {
    return RNBootSplashModuleImpl.isVisible()
  }
}

```

### Core Architecture Module: `app.plugin.js`
```
const { withBootSplash } = require("./dist/commonjs/extras/expo");
module.exports = withBootSplash;

```

### Core Architecture Module: `cli.js`
```
#!/usr/bin/env node

const { Command } = require("commander");

const program = new Command();
const pkg = require("./package.json");

const validPlatforms = ["android", "ios", "web"];

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .command("generate", { isDefault: true })
  .description("Generate a launch screen using a logo file path (PNG or SVG)")
  .argument("<logo>", "Logo file path (PNG or SVG)")
  .option(
    "--platforms <list>",
    "Platforms to generate for, separated by a comma",
    validPlatforms.join(","),
  )
  .option(
    "--background <string>",
    "Background color (in hexadecimal format)",
    "#fff",
  )
  .option(
    "--logo-width <number>",
    "Logo width at @1x (in dp - we recommend approximately ~100)",
    100,
  )
  .option(
    "--assets-output <string>",
    "Assets output directory path",
    "assets/bootsplash",
  )
  .option(
    "--flavor <string>",
    "Android flavor build variant (where your resource directory is)",
    "main",
  )
  .option(
    "--html <string>",
    "HTML template file path (your web app entry point)",
    "public/index.html",
  )
  .option("--plist <string>", "Custom Info.plist file path")
  .option(
    "--license-key <string>",
    "License key to enable brand and dark mode assets generation",
  )
  .option("--brand <string>", "Brand file path (PNG or SVG)")
  .option(
    "--brand-width <number>",
    "Brand width at @1x (in dp - we recommend approximately ~80)",
    80,
  )
  .option(
    "--dark-background <string>",
    "[dark mode] Background color (in hexadecimal format)",
  )
  .option("--dark-logo <string>", "[dark mode] Logo file path (PNG or SVG)")
  .option("--dark-brand <string>", "[dark mode] Brand file path (PNG or SVG)")
  .action((logo, options) => {
    const { platforms, logoWidth, brandWidth, ...rest } = options;

    const args = {
      ...rest,

      platforms: [
        ...new Set(
          platforms
            .toLowerCase()
            .split(/[ ,;|]/)
            .map((platform) => platform.trim())
            .filter((item) => validPlatforms.includes(item)),
        ),
      ],

      logoWidth: Number.parseInt(logoWidth, 10),
      brandWidth: Number.parseInt(brandWidth, 10),
    };

    const { generate } = require("./dist/commonjs/extras/generate");

    generate({ logo, ...args }).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });

program.parse(process.argv);

```

### Core Architecture Module: `example/android/app/src/main/java/com/rnbootsplashexample/MainActivity.kt`
```
package com.rnbootsplashexample

import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "RNBootSplashExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    RNBootSplash.init(this, R.style.BootTheme) // ⬅️ initialize the splash screen
    super.onCreate(savedInstanceState)
  }
}

```

### Core Architecture Module: `example/android/app/src/main/java/com/rnbootsplashexample/MainApplication.kt`
```
package com.rnbootsplashexample

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}

```

### Core Architecture Module: `example/babel.config.js`
```
const path = require("path");
const pkg = require("../package.json");

const resolverConfig = {
  extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  alias: {
    [pkg.name]: path.resolve(__dirname, "../src"),
    ...(process.env.WEBPACK_SERVE === "true" && {
      react: "./node_modules/react",
      "react-native": "./node_modules/react-native-web",
    }),
  },
};

module.exports = {
  presets: ["module:@react-native/babel-preset"],
  plugins: [["module-resolver", resolverConfig]],
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #793** (2026-08-06): **Android splash logo is not displayed with react-native-bootsplash**
  *Symptoms*: ### Bug summary  ## Android splash logo is not displayed with react-native-bootsplash  ### Description  I am using `react-native-bootsplash` in a React Native Android project. The splash background is displayed correctly, but the configured logo is not shown. Instead, Android shows another/default icon or no logo.  ### Expected behavior  The generated `bootsplash_logo.png` should be displayed during app startup.  ### Actual behavior  The splash screen appears, but the configured logo from:  ```xml <item name="bootSplashLogo">@drawable/bootsplash_logo</item>  ### Library version  7.3.2  ### Environment info  "react-native": "^0.83.1",  ### Steps to reproduce  <resources>      <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">         <item name="android:windowBackground">@color/bootsplash_background</item>     </style>      <style name="BootTheme" parent="Theme.BootSplash">         <item name="bootSplashBackground">@color/bootsplash_background</item>         <item name="bootSplashLogo">@drawable/bootsplash_logo</item>         <item name="postBootSplashTheme">@style/AppTheme</item>     </style>  </resources>  override fun onCreate(savedInstanceState: Bundle?) {     RNBootSplash.init(this, R.style.BootTheme)     super.onCreate(null) }    ### Reproducible sample code  ```js <?xml version="1.0" encoding="utf-8"?> <resources>     <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">         <item name="android:windowBackground">@color/bootsplash_backgro
  **Post-Mortem & Fix Analysis**:
  > Remove `<item name="android:windowBackground">@color/bootsplash_background</item>`. If it doesn't do the trick, then your reproduction is not more complete / different from the example app and this needs a reproduction repository.

- **Issue #785** (2026-07-02): **Crash when opening app (Some Oppo Devices Android =< 12)**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  We can see some crashes like this coming from Oppo devices with Android 12, We tried with Xiaomi and we cannot reproduce this issue:  ````` Fatal Exception: java.lang.NullPointerException: Attempt to invoke 'void android.view.SurfaceControl.checkNotReleased()' on a null object reference at android.view.SurfaceControl$Transaction.hide(SurfaceControl.java:3124) at android.app.ActivityThread.syncTransferSplashscreenViewTransaction(ActivityThread.java:4360) at android.app.ActivityThread$1.onDraw(ActivityThread.java:4337) at android.view.ViewTreeObserver.dispatchOnDraw(ViewTreeObserver.java:1132) `````  We were investigating and iterating with Claude and we get this output we would like to validate with you as the knowledge is on you and not on AI.  > Cold-start crash on Android 12+ (frequent on MIUI / HyperOS): > syncTransferSplashscreenViewTransaction is the Android 12+ platform mechanism that hands the SplashScreenView's surface off from the system to the app window. On the handoff draw it calls Transaction.hide(surfaceControl); if that SurfaceControl was already released, mNativeObject is null → NPE. It runs inside the framework's di
  **Post-Mortem & Fix Analysis**:
  > This is a known AOSP framework race, mostly Android 12 (API 31 / 32), heavily skewed to ColorOS / OneUI-type OEM builds (Oppo / Realme / OnePlus). Google largely mitigated it in 13+. A platform bug that we cannot fully fix from the library (without entirelly disabling the animation for every Android 12 users - even for the 99+% of sessions that don't crash - not realistic)
  > Thanks for the quick response @zoontek 

- **Issue #779** (2026-06-16): **Black circle display when open app with splash screen**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  <img width="296" height="616" alt="Image" src="https://github.com/user-attachments/assets/3dfaed0f-987d-4b6f-b9d1-f7ac4c464d74" />  it happen after migrate to expo-56  ### Library version  7.3.1  ### Environment info  ```shell System:   OS: macOS 26.5.1   CPU: (14) arm64 Apple M4 Pro   Memory: 644.39 MB / 48.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 25.9.0     path: /opt/homebrew/bin/node   Yarn:     version: 1.22.19     path: /opt/homebrew/bin/yarn   npm:     version: 11.12.1     path: /opt/homebrew/bin/npm   Watchman:     version: 2026.05.04.00     path: /opt/homebrew/bin/watchman Managers:   CocoaPods:     version: 1.16.2     path: /opt/homebrew/bin/pod SDKs:   iOS SDK:     Platforms:       - DriverKit 25.5       - iOS 26.5       - macOS 26.5       - tvOS 26.5       - visionOS 26.5       - watchOS 26.5   Android SDK: Not Found IDEs:   Android Studio: 2025.1 AI-251.26094.121.2512.13930704   Xcode:     version: 26.5/17F42     path: /usr/bin/xcodebuild Languages:   Java:     version: 17.0.19     path: /usr/bin/javac   Ruby:     version: 2.6.10     path: /usr/bin/ruby npmPackages:   "@react-n

- **Issue #771** (2026-05-08): **Cannot read property 'hide' of null**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  If I wrap my App from codepush HOC then on next re-start when the bundle try to get installed the app crash with below error.   > E  FATAL EXCEPTION: mqt_native_modules (Ask Gemini) > Process: com.******.stage, PID: 3317 > com.facebook.react.common.JavascriptException:  > TypeError: Cannot read property 'hide' of null    This is how the ap is getting wrapped via codepush along with handling for Bootsplash.hide()  ``` import CodePush from '@revopush/react-native-code-push';  function App(): JSX.Element {     useEffect(() => {         if (BootSplash && BootSplash.isVisible) {             BootSplash.hide();         }     }, []);      return (         <SafeAreaProvider initialMetrics={initialMetrics}>             <TouchEventBoundary>                 <RiderApp                     soundRef={soundRef}                     soundFoodReadyRef={soundFoodReadyRef}                     soundTripRadarRef={soundTripRadarRef}                     soundTripRadarNewOrderRef={soundTripRadarNewOrderRef}                     cancelOrderSoundRef={cancelOrderSoundRef}                 />             </TouchEventBoundary>         </SafeAreaProvider>     ); }  e
  **Post-Mortem & Fix Analysis**:
  > Looks like a `@revopush/react-native-code-push` issue to me.
  > Hi @zoontek   Will check on Revopush's end as well, but can you help me understand why this is specifically a problem with react-native-bootsplash?  Our existing custom splash module has been working fine alongside Revopush, so I want to be sure I understand what changed architecturally before I conclude this is a Revopush issue.  Our current setup (working):  - A dedicated SplashActivity is the LAUNCHER — a thin trampoline that starts MainActivity and finishes - MainActivity.onCreate() calls our native module's show(), which opens a fullscreen Dialog containing the splash layout - JS calls NativeModules.SplashScreenModule.hide() once the app is ready, which dismisses the Dialog - JS-side access is late-bound: NativeModules.SplashScreenModule.hide() resolves the native module on every call
  > Attaching complete crash logs frame for reference. If you can help here 🥲 ``` --------- beginning of crash 2026-05-08 17:04:36.657 26326-26437 ReactNativeJS           com.l.stage      E  TypeError: Cannot read property 'hide' of null                                                                                                                                                                                                          This error is located at:                                                                                                         in App                                                                                                         in FeedbackWidgetProvider                                                                                                         in ReactNativeProfiler                                                                                                         in RCTView                                                        

- **Issue #770** (2026-04-28): **Crash on Android <= 9 - Attempt to invoke virtual method Drawable.isProjected() on a null object reference**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  App is crashing on android devices below android 9, I checked there is a same issue in v5 https://github.com/zoontek/react-native-bootsplash/issues/554 it was fixed then but I think v7 rewrite introduced this issue again   claude suggested  The react-native-bootsplash library bundles a compat_splash_screen.xml that includes   a ?bootSplashBrand layer. Since you don't configure a brand image in your bootsplash plugin   config, that layer resolves to a null drawable. On Android 9+, LayerDrawable handles null layers   gracefully. On Android 7-8.x (API 24-27), LayerDrawable.isProjected() calls .isProjected() on   every child without null-checking, causing the NullPointerException.   ### Library version  ^7.3.1  ### Environment info  ```shell info Fetching system and libraries information... System:   OS: macOS 26.4   CPU: (14) arm64 Apple M4 Pro   Memory: 510.91 MB / 24.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 23.6.0     path: /Users/userName/.nvm/versions/node/v23.6.0/bin/node   Yarn:     version: 1.22.22     path: /Users/userName/.nvm/versions/node/v23.6.0/bin/yarn   npm:     version: 11.12.1
  **Post-Mortem & Fix Analysis**:
  > @dhruvpvx Does the crash occurs with v7.2.0? Did you correctly cleaned your build artifacts after the update?
  > @zoontek crash occurs with 7.2.0 as well
  > @dhruvpvx Tested on Android 7 and 9 with the example project - and no brand, I can't reproduce.  The transparent pixel trick was used on Android < 23 (`compat_splash_screen.xml` was even overwritten in [drawable-v23](https://github.com/zoontek/react-native-bootsplash/blob/6.3.12/android/src/main/res/drawable-v23/compat_splash_screen.xml)), so Claude is hallucinating here.  https://github.com/user-attachments/assets/08a7a2bf-7b2a-45d9-9551-9d542be8855d  Please add a reproduction repository so I could have a check. Meanwhile, I'm closing this.

- **Issue #767** (2026-04-08): **RN 0.85.0 StyleSheet.absoluteFillObject is removed**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  As of RN 0.85 StyleSheet.absoluteFillObject is removed. Please use absoluteFill instead, my animated layour is a bit broken. https://github.com/facebook/react-native/blob/main/CHANGELOG.md#v0850-rc0  ### Library version  7.3.0  ### Environment info  ```shell 0.85.0 CLI new ARCH enabled, Hermes enabled ```  ### Steps to reproduce  N/A  ### Reproducible sample code  ```js N/A ```
  **Post-Mortem & Fix Analysis**:
  > Thanks, I totally forgot. Fixed in [v7.3.1](https://github.com/zoontek/react-native-bootsplash/releases/tag/7.3.1)

- **Issue #766** (2026-04-08): **bug(android assets): missing light theme assets**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  Hi,  I've just upgraded from v5 to v7 and I struggled with figuring out why were my light theme Android assets not generated. I found out in the lib code that if the logo was > 192dp (I was feeding 200 to the cli command) , the assets generation was skipped but the log was swallowed inside many others. I think it would be great to properly document the requirements for the assets.  Also, why where my dark assets still generated with an incorrect size ?  ### Library version  7.2.0  ### Environment info  ```shell System:   OS: macOS 26.4   CPU: (12) arm64 Apple M2 Pro   Memory: 440.45 MB / 32.00 GB   Shell:     version: "5.9"     path: /bin/zsh Binaries:   Node:     version: 24.14.1     path: /Users/alixhumbert/.nvm/versions/node/v24.14.1/bin/node   Yarn: Not Found   npm:     version: 11.11.0     path: /Users/alixhumbert/.nvm/versions/node/v24.14.1/bin/npm   Watchman:     version: 2024.12.02.00     path: /opt/homebrew/bin/watchman Managers:   CocoaPods:     version: 1.16.2     path: /Users/alixhumbert/.rvm/gems/ruby-3.3.5/bin/pod SDKs:   iOS SDK:     Platforms:       - DriverKit 25.2       - iOS 26.2       - macOS 26.2       - tvOS 26
  **Post-Mortem & Fix Analysis**:
  > @AlixH Are you using the Expo plugin or the CLI?
  > > @AlixH Are you using the Expo plugin or the CLI?  CLI
  > @AlixH I updated it to display better warnings, will release it tomorrow:  <img width="854" height="745" alt="Image" src="https://github.com/user-attachments/assets/5aefa857-e27f-464a-8289-3f414fad2955" />  ---  > Also, why where my dark assets still generated with an incorrect size ?  This one was a bug, it's not supposed too. I fixed it.

- **Issue #758** (2026-03-04): **.9 png shows an abnormality**
  *Symptoms*: ### Before submitting a new issue  - [x] I tested using the latest version of the library, as the bug might be already fixed. - [x] I tested using a [supported version](https://github.com/reactwg/react-native-releases/blob/main/docs/support.md) of react native. - [x] I checked for possible duplicate issues, with possible answers.  ### Bug summary  <img width="388" height="891" alt="Image" src="https://github.com/user-attachments/assets/29e1ce2f-a0e4-44f8-9228-36e1dd379cf7" /> In some cases, the simulator behaves abnormally, but it works properly on the actual device.  ### Library version  7.1.0  ### Environment info  ```shell Mac os rn 0.82 ```  ### Steps to reproduce  1. … 2. …   ### Reproducible sample code  ```js Use.9 png ```

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

### Incident Patch 1: `e79f4392` (2026-09-30)
**Commit Message**: Fix splash screen staying visible after activity stop on Android 12-13

**File**: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplashModuleImpl.kt` (modified, +4/-24)
```diff
@@ -2,10 +2,8 @@ package com.zoontek.rnbootsplash
 
 import android.annotation.SuppressLint
 import android.app.Activity
-import android.app.Application.ActivityLifecycleCallbacks
 import android.content.res.Configuration
 import android.os.Build
-import android.os.Bundle
 import android.os.Handler
 import android.os.Looper
 import android.util.TypedValue
@@ -85,31 +83,13 @@ object RNBootSplashModuleImpl {
       // (Android studio / CLI / notification / widget…)
       val splashScreen = mainActivity.splashScreen
 
+      // Remove it immediately, without animation. Never clear this listener on activity stop:
+      // the view would never be removed and the splash screen would stay visible forever.
+      // Running no animation also avoids https://issuetracker.google.com/issues/242118185
       splashScreen.setOnExitAnimationListener { view ->
-        view.remove() // Remove it immediately, without animation
+        view.remove()
         splashScreen.clearOnExitAnimationListener()
       }
-
-      // Mitigates race where splash exit listener may fire after activity stop (not a full fix)
-      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.TIRAMISU) {
-        val application = mainActivity.application
-
-        application.registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
-          override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
-          override fun onActivityDestroyed(activity: Activity) {}
-          override fun onActivityPaused(activity: Activity) {}
-          override fun onActivityResumed(activity: Activity) {}
-          override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
-          override fun onActivityStarted(activity: Activity) {}
-
-          override fun onActivityStopped(activity: Activity) {
-            if (activity == mainActivity) {
-              runCatching { splashScreen.clearOnExitAnimationListener() }
-              application.unregisterActivityLifecycleCallbacks(this)
-            }
-          }
-        })
-      }
     }
 
     UiThreadUtil.runOnUiThread {
```

---

### Incident Patch 2: `d6faabf7` (2026-09-14)
**Commit Message**: fix(android): skip explicit Kotlin plugin when AGP registers the kotlin extension (#798)

AGP 9 ships built-in Kotlin support and registers the kotlin extension
itself. Applying the Kotlin plugin again fails configuration with
"Cannot add extension with name 'kotlin'". Check for the extension
directly, which needs no AGP version table and covers AGP 10, where the
android.builtInKotlin opt-out is removed.

**File**: `android/build.gradle` (modified, +7/-1)
```diff
@@ -17,7 +17,13 @@ def isNewArchitectureEnabled() {
 }
 
 apply plugin: "com.android.library"
-apply plugin: "kotlin-android"
+// AGP 9 ships built-in Kotlin support and registers the `kotlin` extension
+// itself. Applying the Kotlin plugin on top of it fails configuration with
+// "Cannot add extension with name 'kotlin'". Only apply it when nothing has
+// registered that extension yet.
+if (project.extensions.findByName('kotlin') == null) {
+    apply plugin: "kotlin-android"
+}
 
 if (isNewArchitectureEnabled()) {
     apply plugin: "com.facebook.react"
```

---

### Incident Patch 3: `650850d6` (2026-04-07)
**Commit Message**: Fix race condition by clearing splash exit listener on activity stop to reduce crash window

**File**: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplashModuleImpl.kt` (modified, +37/-15)
```diff
@@ -2,8 +2,10 @@ package com.zoontek.rnbootsplash
 
 import android.annotation.SuppressLint
 import android.app.Activity
+import android.app.Application
 import android.content.res.Configuration
 import android.os.Build
+import android.os.Bundle
 import android.util.TypedValue
 import android.view.View
 import android.view.ViewConfiguration
@@ -40,7 +42,7 @@ object RNBootSplashModuleImpl {
   private var mInitialDialog: RNBootSplashDialog? = null
   private var mFadeOutDialog: RNBootSplashDialog? = null
 
-  internal fun init(activity: Activity?, @StyleRes themeResId: Int) {
+  internal fun init(mainActivity: Activity?, @StyleRes themeResId: Int) {
     if (mThemeResId != -1) {
       return FLog.w(
         ReactConstants.TAG,
@@ -50,7 +52,7 @@ object RNBootSplashModuleImpl {
 
     mThemeResId = themeResId
 
-    if (activity == null) {
+    if (mainActivity == null) {
       return FLog.w(
         ReactConstants.TAG,
         "$NAME: Ignored initialization, current activity is null."
@@ -59,18 +61,18 @@ object RNBootSplashModuleImpl {
 
     // Apply postBootSplashTheme
     val typedValue = TypedValue()
-    val currentTheme = activity.theme
+    val currentTheme = mainActivity.theme
 
     if (currentTheme.resolveAttribute(R.attr.postBootSplashTheme, typedValue, true)) {
       val finalThemeId = typedValue.resourceId
 
       if (finalThemeId != 0) {
-        activity.setTheme(finalThemeId)
+        mainActivity.setTheme(finalThemeId)
       }
     }
 
     // Keep the splash screen on-screen until Dialog is shown
-    val contentView = activity.findViewById<View>(android.R.id.content)
+    val contentView = mainActivity.findViewById<View>(android.R.id.content)
     mStatus = Status.INITIALIZING
 
     contentView
@@ -92,18 +94,38 @@ object RNBootSplashModuleImpl {
     if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
       // This is not called on Android 12 when activity is started using intent
       // (Android studio / CLI / notification / widget…)
-      activity
-        .splashScreen
-        .setOnExitAnimationListener { view ->
-          view.remove() // Remove it immediately, without animation
-
-          activity
-            .splashScreen
-            .clearOnExitAnimationListener()
-        }
+      val splashScreen = mainActivity.splashScreen
+
+      splashScreen.setOnExitAnimationListener { view ->
+        view.remove() // Remove it immediately, without animation
+        splashScreen.clearOnExitAnimationListener()
+      }
+
+      // Mitigates race where splash exit listener may fire after activity stop by clearing it early (not a full fix)
+      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.TIRAMISU) {
+        val application = mainActivity.application
+
+        application.registerActivityLifecycleCallbacks(
+          object : Application.ActivityLifecycleCallbacks {
+            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
+            override fun onActivityDestroyed(activity: Activity) {}
+            override fun onActivityPaused(activity: Activity) {}
+            override fun onActivityResumed(activity: Activity) {}
+            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
+            override fun onActivityStarted(activity: Activity) {}
+
+            override fun onActivityStopped(activity: Activity) {
+              if (activity == mainActivity) {
+                runCatching { splashScreen.clearOnExitAnimationListener() }
+                application.unregisterActivityLifecycleCallbacks(this)
+              }
+            }
+          }
+        )
+      }
     }
 
-    mInitialDialog = RNBootSplashDialog(activity, mThemeResId, false)
+    mInitialDialog = RNBootSplashDialog(mainActivity, mThemeResId, false)
 
     UiThreadUtil.runOnUiThread {
       mInitialDialog?.show { mStatus = Status.VISIBLE }
```

---

### Incident Patch 4: `e35f490f` (2026-04-07)
**Commit Message**: Revert "wrap view.remove() in runCatching"

This reverts commit 60da4703ca9fe66993888585f8d7b5b8a7ebadf9.

**File**: `android/src/main/java/com/zoontek/rnbootsplash/RNBootSplashModuleImpl.kt` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ object RNBootSplashModuleImpl {
       activity
         .splashScreen
         .setOnExitAnimationListener { view ->
-          runCatching { view.remove() } // Remove it immediately, without animation
+          view.remove() // Remove it immediately, without animation
 
           activity
             .splashScreen
```

---

### Incident Patch 5: `33ae7f9f` (2026-02-04)
**Commit Message**: Bump @isaacs/brace-expansion from 5.0.0 to 5.0.1 in /example (#751)

**File**: `example/yarn.lock` (modified, +18/-5)
```diff
@@ -1246,9 +1246,9 @@
   integrity sha512-yzMTt9lEb8Gv7zRioUilSglI0c0smZ9k5D65677DLWLtWJaXIS3CqcGyUFByYKlnUj6TkjLVs54fBl6+TiGQDQ==
 
 "@isaacs/brace-expansion@^5.0.0":
-  version "5.0.0"
-  resolved "https://registry.yarnpkg.com/@isaacs/brace-expansion/-/brace-expansion-5.0.0.tgz#4b3dabab7d8e75a429414a96bd67bf4c1d13e0f3"
-  integrity sha512-ZT55BDLV0yv0RBm2czMiZ+SqCGO7AvmOM3G/w2xhVPH+te0aKgFjmBvGlL1dH+ql2tgGO3MVrbb3jCKyvpgnxA==
+  version "5.0.1"
+  resolved "https://registry.yarnpkg.com/@isaacs/brace-expansion/-/brace-expansion-5.0.1.tgz#0ef5a92d91f2fff2a37646ce54da9e5f599f6eff"
+  integrity sha512-WMz71T1JS624nWj2n2fnYAuPovhv7EUhk69R6i9dsVyzxt5eM3bjwvgk9L+APE1TRscGysAVMANkB0jh0LQZrQ==
   dependencies:
     "@isaacs/balanced-match" "^4.0.1"
 
@@ -5626,8 +5626,21 @@ react-is@^18.0.0:
   integrity sha512-/LLMVyas0ljjAtoYiPqYiL8VWXzUUdThrmU5+n20DZv+a+ClRoevUzw5JxU+Ieh5/c87ytoTBV9G1FiKfNJdmg==
 
 "react-native-bootsplash@link:..":
-  version "0.0.0"
-  uid ""
+  version "7.0.2"
+  dependencies:
+    "@expo/config-plugins" "*"
+    commander "^14.0.3"
+    detect-indent "^6.1.0"
+    fast-glob "^3.3.3"
+    find-up "^5.0.0"
+    fs-extra "^11.3.3"
+    node-html-parser "^7.0.2"
+    picocolors "^1.1.1"
+    prettier "^3.8.1"
+    react-native-is-edge-to-edge "^1.2.1"
+    sharp "^0.34.5"
+    ts-dedent "^2.2.0"
+    xml-formatter "^3.6.7"
 
 react-native-edge-to-edge@1.7.0:
   version "1.7.0"
```

---

### Incident Patch 6: `548dab4a` (2026-02-04)
**Commit Message**: Bump @isaacs/brace-expansion from 5.0.0 to 5.0.1 (#752)

**File**: `yarn.lock` (modified, +3/-3)
```diff
@@ -1239,9 +1239,9 @@
   integrity sha512-yzMTt9lEb8Gv7zRioUilSglI0c0smZ9k5D65677DLWLtWJaXIS3CqcGyUFByYKlnUj6TkjLVs54fBl6+TiGQDQ==
 
 "@isaacs/brace-expansion@^5.0.0":
-  version "5.0.0"
-  resolved "https://registry.yarnpkg.com/@isaacs/brace-expansion/-/brace-expansion-5.0.0.tgz#4b3dabab7d8e75a429414a96bd67bf4c1d13e0f3"
-  integrity sha512-ZT55BDLV0yv0RBm2czMiZ+SqCGO7AvmOM3G/w2xhVPH+te0aKgFjmBvGlL1dH+ql2tgGO3MVrbb3jCKyvpgnxA==
+  version "5.0.1"
+  resolved "https://registry.yarnpkg.com/@isaacs/brace-expansion/-/brace-expansion-5.0.1.tgz#0ef5a92d91f2fff2a37646ce54da9e5f599f6eff"
+  integrity sha512-WMz71T1JS624nWj2n2fnYAuPovhv7EUhk69R6i9dsVyzxt5eM3bjwvgk9L+APE1TRscGysAVMANkB0jh0LQZrQ==
   dependencies:
     "@isaacs/balanced-match" "^4.0.1"
 
```

---

### Incident Patch 7: `f884195e` (2026-01-25)
**Commit Message**: Fix require

**File**: `src/generate.ts` (modified, +1/-1)
```diff
@@ -891,7 +891,7 @@ export const requireAddon = ({
   | undefined => {
   if (licenseKey != null && executeAddon) {
     try {
-      const addon = require("./dist/commonjs/addon");
+      const addon = require("./addon");
       return "default" in addon ? addon.default : addon;
     } catch {
       return;
```

---

### Incident Patch 8: `285283ca` (2025-09-07)
**Commit Message**: Fix logo size warnings

**File**: `src/generate.ts` (modified, +4/-4)
```diff
@@ -441,9 +441,9 @@ const getAndroidOutputPath = ({
   }
 
   const withSizeChecks = (assetsOutputPath: string) => {
-    if (logoWidth > 288 || logoHeight > 288) {
+    if (logoWidth > 192 || logoHeight > 192) {
       return log.warn(
-        "Logo size exceeding 288x288dp will be cropped by Android. Skipping Android assets generation…",
+        "Logo size exceeding 192x192dp will be cropped by Android. Skipping Android assets generation…",
       );
     }
     if (brandWidth > 200 || brandHeight > 80) {
@@ -452,8 +452,8 @@ const getAndroidOutputPath = ({
       );
     }
 
-    if (logoWidth > 192 || logoHeight > 192) {
-      log.warn("Logo size exceeds 192x192dp. It might be cropped by Android.");
+    if (logoWidth > 134 || logoHeight > 134) {
+      log.warn("Logo size exceeds 134x134dp. It might be cropped by Android.");
     }
 
     return assetsOutputPath;
```

---

### Incident Patch 9: `d950c8f8` (2025-06-17)
**Commit Message**: chore: Fix error message grammar (#714)

**File**: `src/expo.ts` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@ const withAndroidAssets: Expo.ConfigPlugin<Props> = (config, props) =>
       const srcDir = path.resolve(projectRoot, assetsDir, "android");
 
       if (!hfs.exists(srcDir)) {
-        const error = `"${path.relative(projectRoot, srcDir)}" doesn't exist. Did you ran the asset generation command?`;
+        const error = `"${path.relative(projectRoot, srcDir)}" doesn't exist. Did you run the asset generation command?`;
         log.error(error);
         process.exit(1);
       }
@@ -243,7 +243,7 @@ const withIOSAssets: Expo.ConfigPlugin<Props> = (config, props) =>
       const destDir = path.resolve(platformProjectRoot, projectName);
 
       if (!hfs.exists(srcDir)) {
-        const error = `"${path.relative(projectRoot, srcDir)}" doesn't exist. Did you ran the asset generation command?`;
+        const error = `"${path.relative(projectRoot, srcDir)}" doesn't exist. Did you run the asset generation command?`;
         log.error(error);
         process.exit(1);
       }
```

---

### Incident Patch 10: `07952452` (2025-06-08)
**Commit Message**: Update react-native-builder-bob

**File**: `example/Gemfile.lock` (modified, +8/-8)
```diff
@@ -23,9 +23,9 @@ GEM
       httpclient (~> 2.8, >= 2.8.3)
       json (>= 1.5.1)
     atomos (0.1.3)
-    base64 (0.2.0)
-    benchmark (0.4.0)
-    bigdecimal (3.1.9)
+    base64 (0.3.0)
+    benchmark (0.4.1)
+    bigdecimal (3.2.2)
     claide (1.1.0)
     cocoapods (1.15.2)
       addressable (~> 2.8)
@@ -66,20 +66,20 @@ GEM
     cocoapods-try (1.2.0)
     colored2 (3.1.2)
     concurrent-ruby (1.3.3)
-    connection_pool (2.5.0)
-    drb (2.2.1)
+    connection_pool (2.5.3)
+    drb (2.2.3)
     escape (0.0.4)
     ethon (0.16.0)
       ffi (>= 1.15.0)
-    ffi (1.17.1)
+    ffi (1.17.2)
     fourflusher (2.3.1)
     fuzzy_match (2.0.4)
     gh_inspector (1.1.3)
     httpclient (2.9.0)
       mutex_m
     i18n (1.14.7)
       concurrent-ruby (~> 1.0)
-    json (2.10.2)
+    json (2.12.2)
     logger (1.7.0)
     minitest (5.25.5)
     molinillo (0.8.0)
@@ -121,4 +121,4 @@ RUBY VERSION
    ruby 3.3.1p55
 
 BUNDLED WITH
-   2.6.3
+   2.6.9
```

**File**: `example/ios/Podfile.lock` (modified, +2/-2)
```diff
@@ -1654,7 +1654,7 @@ PODS:
     - React-logger (= 0.79.2)
     - React-perflogger (= 0.79.2)
     - React-utils (= 0.79.2)
-  - RNBootSplash (6.3.8):
+  - RNBootSplash (6.3.9):
     - DoubleConversion
     - glog
     - hermes-engine
@@ -1975,7 +1975,7 @@ SPEC CHECKSUMS:
   ReactAppDependencyProvider: 04d5eb15eb46be6720e17a4a7fa92940a776e584
   ReactCodegen: c63eda03ba1d94353fb97b031fc84f75a0d125ba
   ReactCommon: 76d2dc87136d0a667678668b86f0fca0c16fdeb0
-  RNBootSplash: d370d282f25d7749773cca253f22d63910c2a3d2
+  RNBootSplash: 495054a9704ef6829159f1792763ae163170b2ca
   SocketRocket: d4aabe649be1e368d1318fdf28a022d714d65748
   Yoga: c758bfb934100bb4bf9cbaccb52557cee35e8bdf
 
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "react-native-bootsplash",
-  "version": "6.3.8",
+  "version": "6.3.9",
   "license": "MIT",
   "description": "Display a bootsplash on your app starts. Hide it when you want.",
   "author": "Mathieu Acthernoene <zoontek@gmail.com>",
@@ -99,7 +99,7 @@
     "prettier-plugin-organize-imports": "^4.1.0",
     "react": "19.0.0",
     "react-native": "0.79.2",
-    "react-native-builder-bob": "^0.40.6",
+    "react-native-builder-bob": "^0.40.11",
     "semver": "^7.7.1",
     "typescript": "^5.8.3"
   },
```

---

### Incident Patch 11: `fcb6c327` (2025-04-28)
**Commit Message**: fix: customize root view override signature (#702)

**File**: `src/expo.ts` (modified, +1/-1)
```diff
@@ -305,7 +305,7 @@ const withAppDelegate: Expo.ConfigPlugin<Props> = (config) =>
           offset: 1,
           anchor: /class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {/,
           newSrc: dedent`
-            public override func customize(_ rootView: RCTRootView) {
+            public override func customize(_ rootView: UIView) {
               super.customize(rootView)
               RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
             }
```

#### Recent Merged Pull Requests:
- **PR #805** (2026-09-14): Bump js-yaml from 3.15.1 to 3.15.2 (@dependabot[bot])
- **PR #804** (2026-09-14): Bump js-yaml from 3.15.1 to 3.15.2 in /example (@dependabot[bot])
- **PR #803** (closed): Bump sharp from 0.35.2 to 0.35.4 (@dependabot[bot])
- **PR #802** (closed): Bump baseline-browser-mapping from 2.10.16 to 2.11.22 in /example (@dependabot[bot])
- **PR #801** (closed): Bump @xmldom/xmldom from 0.8.13 to 0.8.15 in /example (@dependabot[bot])
- **PR #800** (closed): Bump browserslist from 4.28.2 to 4.28.9 (@dependabot[bot])
- **PR #799** (closed): Bump browserslist from 4.28.2 to 4.28.9 in /example (@dependabot[bot])
- **PR #798** (2026-09-14): fix(android): skip explicit Kotlin plugin when AGP registers the kotlin extension (@gabrieldonadel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
