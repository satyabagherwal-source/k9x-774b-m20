# Forensic Learning Record (Deep Inspection): maotoumao/MusicFree

> **Canonical Artifact**: `07_PROJECT_LEARNING/maotoumao-musicfree-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/maotoumao/MusicFree](https://github.com/maotoumao/MusicFree))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:47.458Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `maotoumao/MusicFree`
- **Description**: 插件化、定制化、无广告的免费音乐播放器
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json
- **Stars / Engagement**: 27306 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/lyricUtil/LyricUtilModule.kt`
```
package `fun`.upup.musicfree.lyricUtil

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import java.util.*

class LyricUtilModule(private val reactContext: ReactApplicationContext): ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "LyricUtil"
    private var lyricView: LyricView? = null

    @ReactMethod
    fun checkSystemAlertPermission(promise: Promise) {
        try {
            promise.resolve(Settings.canDrawOverlays(reactContext))
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    @ReactMethod
    fun requestSystemAlertPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                data = Uri.parse("package:" + reactContext.packageName)
            }
            currentActivity?.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    @ReactMethod
    fun showStatusBarLyric(initLyric: String?, options: ReadableMap?, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                if (lyricView == null) {
                    lyricView = LyricView(reactContext)
                }

                val mapOptions = mutableMapOf<String, Any>().apply {
                    if (options == null) {
                        return@apply
                    }
                    if (options.hasKey("topPercent")) {
                        put("topPercent", options.getDouble("topPercent"))
                    }
                    if (options.hasKey("leftPercent")) {
                        put("leftPercent", options.getDouble("leftPercent"))
                    }
                    if (options.hasKey("align")) {
                        put("align", options.getInt("align"))
                    }
                    if (options.hasKey("color")) {
                        options.getString("color")?.let { put("color", it) }
                    }
                    if (options.hasKey("backgroundColor")) {
                        options.getString("backgroundColor")?.let { put("backgroundColor", it) }
                    }
                    if (options.hasKey("widthPercent")) {
                        put("widthPercent", options.getDouble("widthPercent"))
                    }
                    if (options.hasKey("fontSize")) {
                        put("fontSize", options.getDouble("fontSize"))
                    }
                }

                try {
                    lyricView?.showLyricWindow(initLyric, mapOptions)
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("Exception", e.message)
                }
            }
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun hideStatusBarLyric(promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.hideLyricWindow()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricText(lyric: String, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setText(lyric)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricAlign(alignment: Int, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setAlign(alignment)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricTop(pct: Double, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setTopPercent(pct)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricLeft(pct: Double, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setLeftPercent(pct)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricWidth(pct: Double, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setWidth(pct)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarLyricFontSize(fontSize: Float, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setFontSize(fontSize)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun setStatusBarColors(textColor: String?, backgroundColor: String?, promise: Promise) {
        try {
            UiThreadUtil.runOnUiThread {
                lyricView?.setColors(textColor, backgroundColor)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

}

```

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/lyricUtil/LyricUtilPackage.kt`
```
package `fun`.upup.musicfree.lyricUtil

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class LyricUtilPackage : ReactPackage {

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): MutableList<ViewManager<View, ReactShadowNode<*>>> = mutableListOf()

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): MutableList<NativeModule> = listOf(LyricUtilModule(reactContext)).toMutableList()
}
```

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/lyricUtil/LyricView.kt`
```
package `fun`.upup.musicfree.lyricUtil

import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.ColorDrawable
import android.hardware.SensorManager
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.OrientationEventListener
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import com.facebook.react.bridge.ReactContext



class LyricView(private val reactContext: ReactContext) : Activity(), View.OnTouchListener {

    private var windowManager: WindowManager? = null
    private var orientationEventListener: OrientationEventListener? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var tv: TextView? = null

    // 窗口信息
    private var windowWidth = 0.0
    private var windowHeight = 0.0
    private var widthPercent = 0.0
    private var leftPercent = 0.0
    private var topPercent = 0.0

    override fun onTouch(view: View, motionEvent: MotionEvent): Boolean {
        Log.d("touch", "Desktop Touch")
        return false
    }

    // 展示歌词窗口
    fun showLyricWindow(initText: String?, options: Map<String, Any>) {
        try {
            if (windowManager == null) {
                windowManager = reactContext.getSystemService(WINDOW_SERVICE) as WindowManager
                layoutParams = WindowManager.LayoutParams()

                val outMetrics = DisplayMetrics()
                windowManager?.defaultDisplay?.getMetrics(outMetrics)
                windowWidth = outMetrics.widthPixels.toDouble()
                windowHeight = outMetrics.heightPixels.toDouble()

                layoutParams?.type = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
                else
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY

                /*
                 * topPercent: number;
                 * leftPercent: number;
                 * align: number;
                 * color: string;
                 * backgroundColor: string;
                 * widthPercent: number;
                 * fontSize: number;
                 */
                val topPercent = options["topPercent"]
                val leftPercent = options["leftPercent"]
                val align = options["align"]
                val color = options["color"]
                val backgroundColor = options["backgroundColor"]
                val widthPercent = options["widthPercent"]
                val fontSize = options["fontSize"]

                this.widthPercent = widthPercent?.toString()?.toDouble() ?: 0.5

                layoutParams?.width = (this.widthPercent * windowWidth).toInt()
                layoutParams?.height = WindowManager.LayoutParams.WRAP_CONTENT
                layoutParams?.gravity = Gravity.TOP or Gravity.START

                this.leftPercent = leftPercent?.toString()?.toDouble() ?: 0.5
                layoutParams?.x = (this.leftPercent * (windowWidth - layoutParams!!.width)).toInt()
                layoutParams?.y = 0

                layoutParams?.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE

                layoutParams?.format = PixelFormat.TRANSPARENT

                tv = TextView(reactContext).apply {
                    text = initText ?: ""
                    textSize = fontSize?.toString()?.toFloat() ?: 14f
                    setBackgroundColor(Color.parseColor(rgba2argb(backgroundColor?.toString() ?: "#84888153")))
                    setTextColor(Color.parseColor(rgba2argb(color?.toString() ?: "#FFE9D2")))
                    setPadding(12, 6, 12, 6)
                    gravity = align?.toString()?.toInt() ?: Gravity.CENTER
                }
                windowManager?.addView(tv, layoutParams)

                topPercent?.toString()?.toDouble()?.let { setTopPercent(it) }

                listenOrientationChange()
            }
        } catch (e: Exception) {
            hideLyricWindow()
            throw e
        }
    }

    private fun listenOrientationChange() {
        if (windowManager == null) return

        if (orientationEventListener == null) {
            orientationEventListener = object : OrientationEventListener(reactContext, SensorManager.SENSOR_DELAY_NORMAL) {
                override fun onOrientationChanged(orientation: Int) {
                    if (windowManager != null) {
                        val outMetrics = DisplayMetrics()
                        windowManager?.defaultDisplay?.getMetrics(outMetrics)
                        windowWidth = outMetrics.widthPixels.toDouble()
                        windowHeight = outMetrics.heightPixels.toDouble()
                        layoutParams?.width = (widthPercent * windowWidth).toInt()
                        layoutParams?.x = (leftPercent * (windowWidth - layoutParams!!.width)).toInt()
                        layoutParams?.y = (topPercent * (windowHeight - tv!!.height)).toInt()
                        windowManager?.updateViewLayout(tv, layoutParams)
                    }
                }
            }
        }

        if (orientationEventListener?.canDetectOrientation() == true) {
            orientationEventListener?.enable()
        }
    }

    private fun unlistenOrientationChange() {
        orientationEventListener?.disable()
    }

    private fun rgba2argb(color: String): String {
        return if (color.length == 9) {
            color[0] + color.substring(7, 9) + color.substring(1, 7)
        } else {
            color
        }
    }

    // 隐藏歌词窗口
    fun hideLyricWindow() {
        if (windowManager != null) {
            tv?.let {
                try {
                    windowManager?.removeView(it)
                } catch (e: Exception) {
                    // Handle exception
                }
                tv = null
            }
            windowManager = null
            layoutParams = null
            unlistenOrientationChange()
        }
    }

    // 设置歌词内容
    fun setText(text: String) {
        tv?.text = text
    }

    fun setAlign(gravity: Int) {
        tv?.gravity = gravity
    }

    fun setTopPercent(pct: Double) {
        var percent = pct.coerceIn(0.0, 1.0)
        tv?.let {
            layoutParams?.y = (percent * (windowHeight - it.height)).toInt()
            windowManager?.updateViewLayout(it, layoutParams)
        }
        this.topPercent = percent
    }

    fun setLeftPercent(pct: Double) {
        var percent = pct.coerceIn(0.0, 1.0)
        tv?.let {
            layoutParams?.x = (percent * (windowWidth - layoutParams!!.width)).toInt()
            windowManager?.updateViewLayout(it, layoutParams)
        }
        this.leftPercent = percent
    }

    fun setColors(textColor: String?, backgroundColor: String?) {
        tv?.let {
            textColor?.let { color -> it.setTextColor(Color.parseColor(rgba2argb(color))) }
            backgroundColor?.let { color ->
                it.background = ColorDrawable(Color.parseColor(rgba2argb(color)))
            }
        }
    }

    fun setWidth(pct: Double) {
        var percent = pct.coerceIn(0.3, 1.0)
        tv?.let {
            val width = (percent * windowWidth).toInt()
            val originalWidth = layoutParams?.width ?: 0
            layoutParams?.x = if (width <= originalWidth) {
                layoutParams!!.x + (originalWidth - width) / 2
            } else {
                layoutParams!!.x - (width - originalWidth) / 2
            }.coerceAtLeast(0).coerceAtMost((windowWidth - width).toInt())
            layoutParams?.width = width
            windowManager?.updateViewLayout(it, layoutParams)
        }
        this.widthPercent = percent
    }

    fun setFontSize(fontSize: Float) {
        tv?.textSize = fontSize
    }
}
```

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/mp3Util/Mp3UtilModule.kt`
```
package `fun`.upup.musicfree.mp3Util

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import com.facebook.react.bridge.*
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class Mp3UtilModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "Mp3Util"

    private fun isContentUri(uri: Uri?): Boolean {
        return uri?.scheme?.equals("content", ignoreCase = true) == true
    }

    @ReactMethod
    fun getBasicMeta(filePath: String, promise: Promise) {
        try {
            val uri = Uri.parse(filePath)
            val mmr = MediaMetadataRetriever()
            if (isContentUri(uri)) {
                mmr.setDataSource(reactApplicationContext, uri)
            } else {
                mmr.setDataSource(filePath)
            }

            val properties = Arguments.createMap().apply {
                putString("duration", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION))
                putString("bitrate", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE))
                putString("artist", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
                putString("author", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_AUTHOR))
                putString("album", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))
                putString("title", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
                putString("date", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))
                putString("year", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR))
            }
            promise.resolve(properties)
        } catch (e: Exception) {
            promise.reject("Exception", e.message)
        }
    }

    @ReactMethod
    fun getMediaMeta(filePaths: ReadableArray, promise: Promise) {
        val metas = Arguments.createArray()
        val mmr = MediaMetadataRetriever()
        for (i in 0 until filePaths.size()) {
            try {
                val filePath = filePaths.getString(i)
                val uri = Uri.parse(filePath)

                if (isContentUri(uri)) {
                    mmr.setDataSource(reactApplicationContext, uri)
                } else {
                    mmr.setDataSource(filePath)
                }

                val properties = Arguments.createMap().apply {
                    putString("duration", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION))
                    putString("bitrate", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE))
                    putString("artist", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST))
                    putString("author", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_AUTHOR))
                    putString("album", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM))
                    putString("title", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE))
                    putString("date", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE))
                    putString("year", mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_YEAR))
                }
                metas.pushMap(properties)
            } catch (e: Exception) {
                metas.pushNull()
            }
        }
        try {
            mmr.release()
        } catch (ignored: Exception) {
        }
        promise.resolve(metas)
    }


    @ReactMethod
    fun getMediaCoverImg(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("File not exist", "File not exist")
                return
            }

            val pathHashCode = file.hashCode()
            if (pathHashCode == 0) {
                promise.resolve(null)
                return
            }

            val cacheDir = reactContext.cacheDir
            val coverFile = File(cacheDir, "image_manager_disk_cache/$pathHashCode.jpg")
            if (coverFile.exists()) {
                promise.resolve(coverFile.toURI().toString())
                return
            }

            val mmr = MediaMetadataRetriever()
            mmr.setDataSource(filePath)
            val coverImg = mmr.embeddedPicture
            if (coverImg != null) {
                val bitmap = BitmapFactory.decodeByteArray(coverImg, 0, coverImg.size)
                FileOutputStream(coverFile).use { outputStream ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 100, outputStream)
                    outputStream.flush()
                }
                promise.resolve(coverFile.toURI().toString())
            } else {
                promise.resolve(null)
            }
            mmr.release()
        } catch (ignored: Exception) {
            promise.reject("Error", "Got error")
        }
    }

    @ReactMethod
    fun getLyric(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag
                val lrc = tag.getFirst(FieldKey.LYRICS)
                promise.resolve(lrc)
            } else {
                throw IOException("File not found")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    @ReactMethod
    fun setMediaTag(filePath: String, meta: ReadableMap, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag
                meta.getString("title")?.let { tag.setField(FieldKey.TITLE, it) }
                meta.getString("artist")?.let { tag.setField(FieldKey.ARTIST, it) }
                meta.getString("album")?.let { tag.setField(FieldKey.ALBUM, it) }
                meta.getString("lyric")?.let { tag.setField(FieldKey.LYRICS, it) }
                meta.getString("comment")?.let { tag.setField(FieldKey.COMMENT, it) }
                audioFile.commit()
                promise.resolve(true)
            } else {
                promise.reject("Error", "File Not Exist")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }

    @ReactMethod
    fun getMediaTag(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val audioFile = AudioFileIO.read(file)
                val tag = audioFile.tag

                val properties = Arguments.createMap().apply {
                    putString("title", tag.getFirst(FieldKey.TITLE))
                    putString("artist", tag.getFirst(FieldKey.ARTIST))
                    putString("album", tag.getFirst(FieldKey.ALBUM))
                    putString("lyric", tag.getFirst(FieldKey.LYRICS))
                    putString("comment", tag.getFirst(FieldKey.COMMENT))
                }
                promise.resolve(properties)
            } else {
                promise.reject("Error", "File Not Found")
            }
        } catch (e: Exception) {
            promise.reject("Error", e.message)
        }
    }
}
```

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/mp3Util/Mp3UtilPackage.kt`
```
package `fun`.upup.musicfree.mp3Util

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class Mp3UtilPackage : ReactPackage {

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): MutableList<ViewManager<View, ReactShadowNode<*>>> = mutableListOf()

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): MutableList<NativeModule> = listOf(Mp3UtilModule(reactContext)).toMutableList()
}
```

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/utils/UtilsModule.kt`
```
package `fun`.upup.musicfree.utils; // replace your-apps-package-name with your app’s package name
import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.DisplayMetrics
import android.view.WindowInsets
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import kotlin.system.exitProcess

class UtilsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

    private val reactContext: ReactApplicationContext = context;

    override fun getName() = "NativeUtils"

    @ReactMethod
    fun exitApp() {
        val activity = reactContext.currentActivity
        activity?.finishAndRemoveTask()
        android.os.Process.killProcess(android.os.Process.myPid())
        exitProcess(0)
    }

    @ReactMethod
    fun checkStoragePermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            promise.resolve(Environment.isExternalStorageManager())
        } else {
            val readPermission = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            val writePermission = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            promise.resolve(readPermission && writePermission)
        }
    }

    @ReactMethod
    fun requestStoragePermission() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${reactContext.packageName}")
            }
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
            }
        }
        reactContext.currentActivity?.startActivity(intent)
    }

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getWindowDimensions(): WritableMap {
        val windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val displayMetrics: DisplayMetrics = reactApplicationContext.resources.displayMetrics
        val density = displayMetrics.density

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11 (API 30) 及以上使用新 API
            val windowMetrics = windowManager.currentWindowMetrics
            val insets = windowMetrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars())
            val bounds = windowMetrics.bounds

            val totalWidthPx = bounds.width()
            val totalHeightPx = bounds.height()

            val leftInsetPx = insets.left
            val rightInsetPx = insets.right
            val topInsetPx = insets.top
            val bottomInsetPx = insets.bottom

            val usableWidthPx = totalWidthPx - leftInsetPx - rightInsetPx
            val usableHeightPx = totalHeightPx - topInsetPx - bottomInsetPx

            val usableWidthDp = usableWidthPx / density
            val usableHeightDp = usableHeightPx / density

            Arguments.createMap().apply {
                putDouble("width", usableWidthDp.toDouble())
                putDouble("height", usableHeightDp.toDouble())
            }
        } else {
            // Android 10 及以下使用旧 API
            val display = windowManager.defaultDisplay
            val realSize = android.graphics.Point()
            display.getRealSize(realSize)

            // 获取状态栏和导航栏高度
            val resources = reactApplicationContext.resources
            var statusBarHeight = 0
            var navigationBarHeight = 0

            // 状态栏高度
            val statusBarResourceId = resources.getIdentifier("status_bar_height", "dimen", "android")
            if (statusBarResourceId > 0) {
                statusBarHeight = resources.getDimensionPixelSize(statusBarResourceId)
            }

            // 导航栏高度
            val navigationBarResourceId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
            if (navigationBarResourceId > 0) {
                navigationBarHeight = resources.getDimensionPixelSize(navigationBarResourceId)
            }

            val usableWidthPx = realSize.x
            val usableHeightPx = realSize.y - statusBarHeight - navigationBarHeight

            val usableWidthDp = usableWidthPx / density
            val usableHeightDp = usableHeightPx / density

            Arguments.createMap().apply {
                putDouble("width", usableWidthDp.toDouble())
                putDouble("height", usableHeightDp.toDouble())
            }
        }
    }
}

```

### Core Architecture Module: `android/app/src/main/java/fun/upup/musicfree/utils/UtilsPackage.kt`
```
package `fun`.upup.musicfree.utils

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class UtilsPackage : ReactPackage {

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): MutableList<ViewManager<View, ReactShadowNode<*>>> = mutableListOf()

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): MutableList<NativeModule> = listOf(UtilsModule(reactContext)).toMutableList()
}
```

### Core Architecture Module: `src/core.defination/trackPlayer/index.ts`
```
export enum TrackPlayerEvents {
    // 一首歌曲播放结束
    PlayEnd = "play-end",
    // 更换正在播放的歌曲
    CurrentMusicChanged = "current-music-changed",
    // 进度更新
    ProgressChanged = "progress-changed",
}
```

### Core Architecture Module: `src/core/appConfig.ts`
```
import { useMMKVObject } from "react-native-mmkv";

import { getStorage, removeStorage } from "@/utils/storage";
import getOrCreateMMKV from "@/utils/getOrCreateMMKV.ts";

import type { AppConfigPropertyKey, IAppConfig, IAppConfigProperties } from "@/types/core/config";
import { safeStringify } from "@/utils/jsonUtil";

const configStore = getOrCreateMMKV("App.config");

class AppConfig implements IAppConfig {
    // 迁移函数
    private async migrateConfig(): Promise<void> {

        const schemaVersion = !configStore.contains("$schema") ? 0 : parseInt(configStore.getString("$schema") || "0", 10);

        if (schemaVersion < 1) {
            // 获取旧配置
            const oldConfig = await getStorage("local-config");

            // 如果没有旧配置，直接初始化新配置
            if (!oldConfig) {
                configStore.set("$schema", "1");
                return;
            }

            // 迁移每个字段
            const mapping: [string, AppConfigPropertyKey][] = [
                // Basic
                [
                    "setting.basic.autoPlayWhenAppStart",
                    "basic.autoPlayWhenAppStart",
                ],
                [
                    "setting.basic.useCelluarNetworkPlay",
                    "basic.useCelluarNetworkPlay",
                ],
                [
                    "setting.basic.useCelluarNetworkDownload",
                    "basic.useCelluarNetworkDownload",
                ],
                ["setting.basic.maxDownload", "basic.maxDownload"],
                ["setting.basic.clickMusicInSearch", "basic.clickMusicInSearch"],
                ["setting.basic.clickMusicInAlbum", "basic.clickMusicInAlbum"],
                ["setting.basic.downloadPath", "basic.downloadPath"],
                ["setting.basic.notInterrupt", "basic.notInterrupt"],
                ["setting.basic.tempRemoteDuck", "basic.tempRemoteDuck"],
                ["setting.basic.autoStopWhenError", "basic.autoStopWhenError"],
                ["setting.basic.pluginCacheControl", "basic.pluginCacheControl"],
                ["setting.basic.maxCacheSize", "basic.maxCacheSize"],
                ["setting.basic.defaultPlayQuality", "basic.defaultPlayQuality"],
                ["setting.basic.playQualityOrder", "basic.playQualityOrder"],
                [
                    "setting.basic.defaultDownloadQuality",
                    "basic.defaultDownloadQuality",
                ],
                [
                    "setting.basic.downloadQualityOrder",
                    "basic.downloadQualityOrder",
                ],
                ["setting.basic.musicDetailDefault", "basic.musicDetailDefault"],
                ["setting.basic.musicDetailAwake", "basic.musicDetailAwake"],
                ["setting.basic.debug.errorLog", "debug.errorLog"],
                ["setting.basic.debug.traceLog", "debug.traceLog"],
                ["setting.basic.debug.devLog", "debug.devLog"],
                ["setting.basic.maxHistoryLen", "basic.maxHistoryLen"],
                ["setting.basic.autoUpdatePlugin", "basic.autoUpdatePlugin"],
                [
                    "setting.basic.notCheckPluginVersion",
                    "basic.notCheckPluginVersion",
                ],
                ["setting.basic.associateLyricType", "basic.associateLyricType"],
                [
                    "setting.basic.showExitOnNotification",
                    "basic.showExitOnNotification",
                ],
                [
                    "setting.basic.musicOrderInLocalSheet",
                    "basic.musicOrderInLocalSheet",
                ],
                [
                    "setting.basic.tryChangeSourceWhenPlayFail",
                    "basic.tryChangeSourceWhenPlayFail",
                ],

                // Lyric
                ["setting.lyric.showStatusBarLyric", "lyric.showStatusBarLyric"],
                ["setting.lyric.topPercent", "lyric.topPercent"],
                ["setting.lyric.leftPercent", "lyric.leftPercent"],
                ["setting.lyric.align", "lyric.align"],
                ["setting.lyric.color", "lyric.color"],
                ["setting.lyric.backgroundColor", "lyric.backgroundColor"],
                ["setting.lyric.widthPercent", "lyric.widthPercent"],
                ["setting.lyric.fontSize", "lyric.fontSize"],
                ["setting.lyric.detailFontSize", "lyric.detailFontSize"],
                ["setting.lyric.autoSearchLyric", "lyric.autoSearchLyric"],

                // Theme
                ["setting.theme.background", "theme.background"],
                ["setting.theme.backgroundOpacity", "theme.backgroundOpacity"],
                ["setting.theme.backgroundBlur", "theme.backgroundBlur"],
                ["setting.theme.colors", "theme.colors"],
                ["setting.theme.customColors", "theme.customColors"],
                ["setting.theme.followSystem", "theme.followSystem"],
                ["setting.theme.selectedTheme", "theme.selectedTheme"],

                // Backup
                ["setting.backup.resumeMode", "backup.resumeMode"],

                // Plugin
                ["setting.plugin.subscribeUrl", "plugin.subscribeUrl"],

                // WebDAV
                ["setting.webdav.url", "webdav.url"],
                ["setting.webdav.username", "webdav.username"],
                ["setting.webdav.password", "webdav.password"],
            ];

            // 执行迁移
            function getPathValue(obj: Record<string, any>, path: string) {
                const keys = path.split(".");
                let tmp = obj;
                for (let i = 0; i < keys.length; ++i) {
                    tmp = tmp?.[keys[i]];
                }
                return tmp;
            }

            mapping.forEach(([oldPath, newKey]) => {
                const value = getPathValue(oldConfig, oldPath);
                if (value !== undefined) {
                    configStore.set(newKey, safeStringify(value));
                }
            });

            // 设置版本标识
            configStore.set("$schema", "1");

            // 清理旧配置
            await removeStorage("local-config"); // 根据需求决定是否删除旧配置
        }

        if (schemaVersion < 2) {
            // @ts-expect-error 兼容旧版本
            if (this.getConfig("basic.clickMusicInSearch") === "播放歌曲") {
                this.setConfig("basic.clickMusicInSearch", "playMusic");
            } else {
                this.setConfig("basic.clickMusicInSearch", "playMusicAndReplace");
            }

            // @ts-expect-error 兼容旧版本
            if (this.getConfig("basic.clickMusicInAlbum") === "播放专辑") {
                this.setConfig("basic.clickMusicInAlbum", "playAlbum");
            } else {
                this.setConfig("basic.clickMusicInAlbum", "playMusic");
            }

            // @ts-expect-error 兼容旧版本
            if (this.getConfig("basic.tempRemoteDuck") === "暂停") {
                this.setConfig("basic.tempRemoteDuck", "pause");
            } else {
                this.setConfig("basic.tempRemoteDuck", "lowerVolume");
            }

            configStore.set("$schema", "2");
        }


    }

    async setup(): Promise<void> {
        await this.migrateConfig();
    }

    setConfig<K extends keyof IAppConfigProperties>(
        key: K,
        value?: IAppConfigProperties[K] | undefined,
    ): void {
        if (value === undefined) {
            configStore.delete(key);
        } else {
            configStore.set(key, safeStringify(value));
        }
    }

    getConfig<K extends keyof IAppConfigProperties>(
        key: K,
    ): IAppConfigProperties[K] | undefined {
        const value = configStore.getString(key);
        if (value === undefined) {
            return undefined;
        }
        return JSON.parse(value);
    }
}

const appConfig = new AppConfig();
export default appConfig;

/***** hooks *****/
export function useAppConfig<K extends keyof IAppConfigProperties>(key: K): IAppConfigProperties[K] | undefined {
    return useMMKVObject<IAppConfigProperties[K]>(key, configStore)[0];
}
```

### Core Architecture Module: `src/core/appMeta.ts`
```
import getOrCreateMMKV from "@/utils/getOrCreateMMKV";

class AppMeta {
    private getAppMeta(key: string) {
        const metaMMKV = getOrCreateMMKV("App.meta");

        return metaMMKV.getString(key);
    }
    private setAppMeta(key: string, value: any) {
        const metaMMKV = getOrCreateMMKV("App.meta");

        return metaMMKV.set(key, value);
    }


    /// 歌单的版本号
    get musicSheetVersion(): number {
        const version = this.getAppMeta("MusicSheetVersion");
        if (version?.length) {
            return +version;
        }
        return 0;
    }

    setMusicSheetVersion(version: number) {
        this.setAppMeta("MusicSheetVersion", "" + version);
    }

    get historySheetVersion(): number {
        const version = this.getAppMeta("HistorySheetVersion");
        if (version?.length) {
            return +version;
        }
        return 0;
    }

    setHistorySheetVersion(version: number) {
        this.setAppMeta("HistorySheetVersion", "" + version);
    }
}

const appMeta = new AppMeta();
export default appMeta;
```

### Core Architecture Module: `src/core/backup.ts`
```
/** 备份与恢复 */
/** 歌单、插件 */
import { compare } from "compare-versions";
import PluginManager from "./pluginManager";
import MusicSheet from "@/core/musicSheet";
import { ResumeMode } from "@/constants/commonConst.ts";

/**
 * 结果：一份大的json文件
 * {
 *     musicSheets: [],
 *     plugins: [],
 * }
 */

interface IBackJson {
    musicSheets: IMusic.IMusicSheetItem[];
    plugins: Array<{ srcUrl: string; version: string }>;
}

function backup() {
    const musicSheets = MusicSheet.backupSheets();
    const plugins = PluginManager.getEnabledPlugins();
    const normalizedPlugins = plugins.map(_ => ({
        srcUrl: _.instance.srcUrl,
        version: _.instance.version,
    }));

    return JSON.stringify({
        musicSheets: musicSheets,
        plugins: normalizedPlugins,
    });
}

async function resume(
    raw: string | Object,
    resumeMode: ResumeMode = ResumeMode.Append,
) {
    let obj: IBackJson;
    if (typeof raw === "string") {
        try {
            obj = JSON.parse(raw);
        } catch {
            throw new Error("备份文件格式无效");
        }
    } else {
        obj = raw as IBackJson;
    }

    const { plugins, musicSheets } = obj ?? {};
    /** 恢复插件 */
    const validPlugins = PluginManager.getEnabledPlugins();
    const resumePlugins = plugins?.map(_ => {
        // 校验是否安装过: 同源且本地版本更高就忽略掉
        if (
            validPlugins.find(
                plugin =>
                    plugin.instance.srcUrl === _.srcUrl &&
                    compare(
                        plugin.instance.version ?? "0.0.0",
                        _.version ?? "0.0.1",
                        ">=",
                    ),
            )
        ) {
            return;
        }
        return PluginManager.installPluginFromUrl(_.srcUrl);
    });

    /** 恢复歌单 */
    const resumeMusicSheets = MusicSheet.resumeSheets(musicSheets, resumeMode);

    return Promise.all([...(resumePlugins ?? []), resumeMusicSheets]);
}

const Backup = {
    backup,
    resume,
};
export default Backup;

```

### Core Architecture Module: `src/core/downloader.ts`
```
import { internalSerializeKey, supportLocalMediaType } from "@/constants/commonConst";
import pathConst from "@/constants/pathConst";
import { IAppConfig } from "@/types/core/config";
import { IInjectable } from "@/types/infra";
import { addFileScheme, escapeCharacter, mkdirR } from "@/utils/fileUtils";
import { errorLog } from "@/utils/log";
import { patchMediaExtra } from "@/utils/mediaExtra";
import { getMediaUniqueKey, isSameMediaItem } from "@/utils/mediaUtils";
import network from "@/utils/network";
import { getQualityOrder } from "@/utils/qualities";
import EventEmitter from "eventemitter3";
import { atom, getDefaultStore, useAtomValue } from "jotai";
import { nanoid } from "nanoid";
import path from "path-browserify";
import { useEffect, useState } from "react";
import { copyFile, downloadFile, exists, unlink } from "react-native-fs";
import LocalMusicSheet from "./localMusicSheet";
import { IPluginManager } from "@/types/core/pluginManager";


export enum DownloadStatus {
    // 等待下载
    Pending,
    // 准备下载链接
    Preparing,
    // 下载中
    Downloading,
    // 下载完成
    Completed,
    // 下载失败
    Error
}


export enum DownloaderEvent {
    // 某次下载行为出错
    DownloadError = "download-error",

    // 下载任务更新
    DownloadTaskUpdate = "download-task-update",

    // 下载某个音乐时出错
    DownloadTaskError = "download-task-error",

    // 下载完成
    DownloadQueueCompleted = "download-queue-completed",
}

export enum DownloadFailReason {
    /** 无网络 */
    NetworkOffline = "network-offline",
    /** 设置-禁止在移动网络下下载 */
    NotAllowToDownloadInCellular = "not-allow-to-download-in-cellular",
    /** 无法获取到媒体源 */
    FailToFetchSource = "no-valid-source",
    /** 没有文件写入的权限 */
    NoWritePermission = "no-write-permission",
    Unknown = "unknown",
}

interface IDownloadTaskInfo {
    // 状态
    status: DownloadStatus;
    // 目标文件名
    filename: string;
    // 下载id
    jobId?: number;
    // 下载音质
    quality?: IMusic.IQualityKey;
    // 文件大小
    fileSize?: number;
    // 已下载大小
    downloadedSize?: number;
    // 音乐信息
    musicItem: IMusic.IMusicItem;
    // 如果下载失败，下载失败的原因
    errorReason?: DownloadFailReason;
}


const downloadQueueAtom = atom<IMusic.IMusicItem[]>([]);
const downloadTasks = new Map<string, IDownloadTaskInfo>();


interface IEvents {
    /** 某次下载行为出现报错 */
    [DownloaderEvent.DownloadError]: (reason: DownloadFailReason, error?: Error) => void;
    /** 下载某个媒体时报错 */
    [DownloaderEvent.DownloadTaskError]: (reason: DownloadFailReason, mediaItem: IMusic.IMusicItem, error?: Error) => void;
    /** 下载任务更新 */
    [DownloaderEvent.DownloadTaskUpdate]: (task: IDownloadTaskInfo) => void;
    /** 下载队列清空 */
    [DownloaderEvent.DownloadQueueCompleted]: () => void;
}

class Downloader extends EventEmitter<IEvents> implements IInjectable {
    private configService!: IAppConfig;
    private pluginManagerService!: IPluginManager;

    private downloadingCount = 0;

    private static generateFilename(musicItem: IMusic.IMusicItem) {
        return `${escapeCharacter(musicItem.platform)}@${escapeCharacter(
            musicItem.id,
        )}@${escapeCharacter(musicItem.title)}@${escapeCharacter(
            musicItem.artist,
        )}`.slice(0, 200);
    }


    injectDependencies(configService: IAppConfig, pluginManager: IPluginManager): void {
        this.configService = configService;
        this.pluginManagerService = pluginManager;
    }

    private updateDownloadTask(musicItem: IMusic.IMusicItem, patch: Partial<IDownloadTaskInfo>) {
        const newValue = {
            ...downloadTasks.get(getMediaUniqueKey(musicItem)),
            ...patch,
        } as IDownloadTaskInfo;
        downloadTasks.set(getMediaUniqueKey(musicItem), newValue);
        this.emit(DownloaderEvent.DownloadTaskUpdate, newValue);
        return newValue;
    }

    // 开始下载
    private markTaskAsStarted(musicItem: IMusic.IMusicItem) {
        this.downloadingCount++;
        this.updateDownloadTask(musicItem, {
            status: DownloadStatus.Preparing,
        });
    }

    private markTaskAsCompleted(musicItem: IMusic.IMusicItem) {
        this.downloadingCount--;
        this.updateDownloadTask(musicItem, {
            status: DownloadStatus.Completed,
        });
    }

    private markTaskAsError(musicItem: IMusic.IMusicItem, reason: DownloadFailReason, error?: Error) {
        this.downloadingCount--;
        this.updateDownloadTask(musicItem, {
            status: DownloadStatus.Error,
            errorReason: reason,
        });
        this.emit(DownloaderEvent.DownloadTaskError, reason, musicItem, error);
    }

    /** 匹配文件后缀 */
    private getExtensionName(url: string) {
        const regResult = url.match(
            /^https?\:\/\/.+\.([^\?\.]+?$)|(?:([^\.]+?)\?.+$)/,
        );
        if (regResult) {
            return regResult[1] ?? regResult[2] ?? "mp3";
        } else {
            return "mp3";
        }
    };

    /** 获取下载路径 */
    private getDownloadPath(fileName: string) {
        const dlPath =
            this.configService.getConfig("basic.downloadPath") ?? pathConst.downloadMusicPath;
        if (!dlPath.endsWith("/")) {
            return `${dlPath}/${fileName ?? ""}`;
        }
        return fileName ? dlPath + fileName : dlPath;
    };

    /** 获取缓存的下载路径 */
    private getCacheDownloadPath(fileName: string) {
        const cachePath = pathConst.downloadCachePath;
        if (!cachePath.endsWith("/")) {
            return `${cachePath}/${fileName ?? ""}`;
        }
        return fileName ? cachePath + fileName : cachePath;
    }


    private async downloadNextPendingTask() {
        const maxDownloadCount = Math.max(1, Math.min(+(this.configService.getConfig("basic.maxDownload") || 3), 10));
        const downloadQueue = getDefaultStore().get(downloadQueueAtom);

        // 如果超过最大下载数量，或者没有下载任务，则不执行
        if (this.downloadingCount >= maxDownloadCount || this.downloadingCount >= downloadQueue.length) {
            return;
        }

        // 寻找下一个pending task
        let nextTask: IDownloadTaskInfo | null = null;
        for (let i = 0; i < downloadQueue.length; i++) {
            const musicItem = downloadQueue[i];
            const key = getMediaUniqueKey(musicItem);
            const task = downloadTasks.get(key);
            if (task && task.status === DownloadStatus.Pending) {
                nextTask = task;
                break;
            }
        }

        // 没有下一个任务了
        if (!nextTask) {
            if (this.downloadingCount === 0) {
                this.emit(DownloaderEvent.DownloadQueueCompleted);
            }
            return;
        }

        const musicItem = nextTask.musicItem;
        // 更新下载状态
        this.markTaskAsStarted(musicItem);

        let url = musicItem.url;
        let headers = musicItem.headers;

        const plugin = this.pluginManagerService.getByName(musicItem.platform);

        try {
            if (plugin) {
                const qualityOrder = getQualityOrder(
                    nextTask.quality ??
                    this.configService.getConfig("basic.defaultDownloadQuality") ??
                    "standard",
                    this.configService.getConfig("basic.downloadQualityOrder") ?? "asc",
                );
                let data: IPlugin.IMediaSourceResult | null = null;
                for (let quality of qualityOrder) {
                    try {
                        data = await plugin.methods.getMediaSource(
                            musicItem,
                            quality,
                            1,
                            true,
                        );
                        if (!data?.url) {
                            continue;
                        }
                        break;
                    } catch { }
                }
                url = data?.url ?? url;
                headers = data?.headers;
            }
            if (!url) {
                throw new Error(DownloadFailReason.FailToFetchSource);
            }
        } catch (e: any) {
            /** 无法下载，跳过 */
            errorLog("下载失败-无法获取下载链接", {
                item: {
                    id: musicItem.id,
                    title: musicItem.title,
                    platform: musicItem.platform,
                    quality: nextTask.quality,
                },
                reason: e?.message ?? e,
            });

            if (e.message === DownloadFailReason.FailToFetchSource) {
                this.markTaskAsError(musicItem, DownloadFailReason.FailToFetchSource, e);
            } else {
                this.markTaskAsError(musicItem, DownloadFailReason.Unknown, e);
            }
            return;
        }

        // 预处理完成，可以开始处理下一个任务
        this.downloadNextPendingTask();

        // 下载逻辑
        // 识别文件后缀
        let extension = this.getExtensionName(url);
        if (supportLocalMediaType.every(item => item !== ("." + extension))) {
            extension = "mp3";
        }

        // 缓存下载地址
        const cacheDownloadPath = addFileScheme(
            this.getCacheDownloadPath(`${nanoid()}.${extension}`),
        );

        // 真实下载地址
        const targetDownloadPath = addFileScheme(
            this.getDownloadPath(`${nextTask.filename}.${extension}`),
        );

        // 检测下载位置是否存在
        try {
            const folder = path.dirname(targetDownloadPath);
            const folderExists = await exists(folder);
            if (!folderExists) {
                await mkdirR(folder);
            }
        } catch (e: any) {
            this.emit(DownloaderEvent.DownloadTaskError, DownloadFailReason.NoWritePermission, musicItem, e);
            return;
        }

        // 下载
        const { promise } = downloadFile({
            fromUrl: url ?? "",
            toFile: cacheDownloadPath,
            headers: headers,
            background: true,
            begin: (res) => {
                this.updateDownloadTask(musicItem, {
                    status: DownloadStatus.Downloading,
                    downloaded
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #660** (2026-09-22): **很奇怪的系统能播放的mp3这个播放器播放不了**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  鸿蒙next.  系统  ### 问题描述  在目录里面点击播放可以用系统自带的播放器播放，在这个软件里面没响应，音频文件里面带的属性是繁体字  ### 复现步骤  加入列表播放，每次点击都无法播放  ### 截图 & 日志  MusicFree 错误报告 版本 1.0.0-beta.3 (400011) · android 12 · CHZ-AL00 设备标识 fab7232d  [黄昏.mp3](https://github.com/user-attachments/files/32448241/default.mp3)  时间 2026-09-21T01:06:39.020Z 页面 PlaylistDetail 来源 未捕获异常  AxiosError: Network Error  --- 调用栈（请保持原样，改动会导致无法定位）--- AxiosError: Network Error     at construct (native)     at apply (native)     at _construct (address at index.android.bundle:1:1115349)     at Wrapper (address at index.android.bundle:1:3441515)     at construct (native)     at _callSuper (address at index.android.bundle:1:1114358)     at AxiosError (address at index.android.bundle:1:2873053)     at handleError (address at index.android.bundle:1:3666762)     at invoke (address at index.android.bundle:1:1170077)     at dispatch (address at index.android.bundle:1:1169414)     at value (address at index.android.bundle:1:2447274)     at dispatchTrustedEvent (address at index.android.bundle:1:1168410)     at setReadyState (address at index.android.bundle:1:2480567)     at __didCompleteResponse (address at index.android.bundle:1:2478801)     at apply (native)     at anonymous (address at index.android.bundle:1:3444781)     at apply (native)     at emit (address at index.android.bundle:
  **Post-Mortem & Fix Analysis**:
  > 可能跟这个问题有关的报告  MusicFree 错误报告 版本 1.0.0-beta.3 (400011) · android 12 · CHZ-AL00 设备标识 fab7232 时间 2026-09-20T08:32:30.441Z 页面 SearchPage 来源 未捕获异常  TypeError: Cannot read property 'match' of undefined  --- 调用栈（请保持原样，改动会导致无法定位）--- TypeError: Cannot read property 'match' of undefined     at ?anon_0_$19a45cbfdc5a1d1d$var$searchMusic (:31:71)     at next (native)     at anonymous (address at InternalBytecode.js:1:8991)     at step (address at InternalBytecode.js:1:6731)     at anonymous (address at InternalBytecode.js:1:7890)     at tryCallOne (address at InternalBytecode.js:1:1296)     at anonymous (address at InternalBytecode.js:1:4984)  --- 已启用插件 --- 小蜗音乐 0.0.3 小蜜音乐 0.0.3 种子 0.1.0 小秋音乐 0.0.3 6yueting 0.1.5 好听轻音乐 0.1.2 小枸音乐 0.0.3 猫耳FM 0.1.4 小芸音乐 0.0.3 udio 0.0.0 书音FM 0.3.6 音悦台 0.0.1 果核音乐 0.0.1 Navidrome 0.0.0 歌词千寻 0.0.0 快手 0.0.2 爱听 0.1.0 网易云电台 0.0.2 歌曲宝 0.0.6 酷狗 0.1.3 WebDAV 0.0.2 Audiomack 0.0.2 suno 0.0.0 bilibili 0.3.0 歌词网 0.0.0 元力MG 0.1.0 元力KW 0.1.0 元力WY 0.1 网易音乐 2025.09.14 元力QQ 0.1.0 5si
  > 不知道啥情况，我把软件卸载了重新下载安装又能放了

- **Issue #630** (2026-06-07): **Art malagasy**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  Artisanal   ### 问题描述  Travail mémorisé   ### 复现步骤  Temps partiel   ### 截图 & 日志  Temps pleins 

- **Issue #588** (2026-03-19): **开始播放音乐没有声音,时间已经在走了.**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  0.6.3-beta.1 Xiaomi HyperOS 1.0.4.0 MIX4  播放没有声音,其它播放器正常,比如:汽水,网易等.都没有问题  ### 问题描述  正常启动musicFree,选择一个音乐->播放->时间已经在走了->没有声音->换一个->还是没声音->时间在走 希望正常播放音乐,或者如何排查问题  ### 复现步骤  1.打开MusicFree 2.搜索"音乐名" 3.选择一个音乐 4.播放  ### 截图 & 日志  无错误日志
  **Post-Mortem & Fix Analysis**:
  > 应该是插件问题 -- 某些音源有加密 播放就是没有声音的

- **Issue #553** (2025-11-28): **为什么用完musicfree后我决定用落雪？**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  所有  ### 问题描述  一个致命问题：播放机制   本来音源就很容易失效所有要经常换源，但是换了源后如果源的名字不同就算之前下载好的音乐都不能听了，清楚插件缓存都没用，还要去编辑器里面把源的名字改成上一个源的名字，最后导入进来才能播放，只要是用上一个源下载或者收藏的音乐就像被诅咒了一样，就算换源名字也得一样，用着就很难受  ### 复现步骤  每次  ### 截图 & 日志  _No response_
  **Post-Mortem & Fix Analysis**:
  > 移动端侧边栏-插件管理有音源重定向功能
  >  > 移动端侧边栏-插件管理有音源重定向功能    只能这样解决了  已经找到解决办法了，把软件升级到最新版本，在设置的插件左下角找到音源重定向，这个的意思是：把你需要的这个旧的不能用的音源调用别的能用的音源来解析就算名字不一样也可以，有个前提条件就是用什么源收藏或者下载的这个源不能删掉也就是删了就不能听了，这个源失效后就只能用其它源代替它来解析，但是它已经给收藏或者下载的源有了跟踪，要是删了名字对不上就不能听了，这个就跟播放失败后自动换源一样，在设置里面也有这个功能，不过它一个好处就是源失效后它可以很快的用有效的源来解析，源多的话就不用一个一个很慢的去试，方法很巧妙也是目前最优的方法了    现在终于知道落雪musicfree的最大区别了，落雪是在软件里面提前设定好的五家前台的生态，源作者只要根据落雪的规则来定制源就好了就像苹果一样，按道理来说也相对于安全些，而musicfree就跟安卓一样可以作者可以定制很多的规则，不用受限于软件的限制，每个源都是单独的独立的，想做哪个网站的源就做可以做，虽然安全性比落雪低但是比较开放   最后就是难题了如果要让musicfree去像落雪一样那低层逻辑就得重写软件也得重做，况且已经有了落雪了，相信musicfree能走出他自己的天地

- **Issue #544** (2026-09-15): **背景未完全覆盖**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  0.6.3-beta.0 coloros15  ### 问题描述  背景底有未被覆盖的白边。打开菜单其背景显示正常，可以确定非手势条  ### 复现步骤  主题选择深色模式  ### 截图 & 日志  ![Image](https://github.com/user-attachments/assets/f1221857-c489-4608-8e0d-661bc291b3cb) ![Image](https://github.com/user-attachments/assets/7a30adff-c2fd-481f-a6fc-591c9da9f18f)
  **Post-Mortem & Fix Analysis**:
  > 试着让Copilot修了下没修好= = 等之后改一下吧，之后升级React Native版本的时候一起做了

- **Issue #536** (2025-11-08): **获取音源失败**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  0.6.2 VNEmixm xiaomi 14T  ### 问题描述  已经切换多个音源，均无法播放歌曲，且无法下载  ### 复现步骤  打开应用 查找并播放歌曲 播放失败/下载失败  ### 截图 & 日志  <!-- Failed to upload "Screenshot_2025-11-08-22-20-06-641_fun.upup.musicfree.jpg" -->  <!-- Failed to upload "Screenshot_2025-11-08-22-20-30-538_fun.upup.musicfree.jpg" -->
  **Post-Mortem & Fix Analysis**:
  > ![Image](https://github.com/user-attachments/assets/15bc7508-8f3c-4752-a1a1-061eeb6196d3)  ![Image](https://github.com/user-attachments/assets/66f2f986-27dc-4763-b407-276b1eb1204a)
  > 如果不是所有音源都无法播放的话，那就是音源问题

- **Issue #532** (2025-11-25): **歌单和搜索页等歌曲列表的三个点触发区域太小了,非常难点到**
  *Symptoms*: ### 提问题之前，请先确认  - [x] 已经阅读过Q&A (https://musicfree.catcat.work/qa/mobile.html) - [x] 要提出的问题与插件功能无关（类似某个插件搜索结果不全、ip被封禁等请找对应插件作者，在此仓库下提具体插件的问题将会被直接关闭） - [x] 不与其他已有issue重复  ### 系统信息  0.6.2 与设备无关  ### 问题描述  主页搜索页等歌曲列表的三个点触发区域太小了,非常难点到, 导致点的时候会变成播放  ### 复现步骤  主页搜索页等歌曲列表的三个点触发区域太小了,非常难点到  ### 截图 & 日志  _No response_

- **Issue #529** (2025-10-20): **mac 编译之后崩溃，求帮助指正**
  *Symptoms*: 

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

### Incident Patch 1: `d68fa837` (2025-08-03)
**Commit Message**: fix: 修复无法添加到歌单的问题

**File**: `src/core/musicSheet/index.ts` (modified, +2/-4)
```diff
@@ -333,13 +333,12 @@ class MusicSheetClazz implements IInjectable {
         if (
             !musicSheets
                 .find(_ => _.id === sheetId)
-                ?.coverImg?.startsWith("file://")
+                ?.coverImg?.startsWith?.("file://")
         ) {
             await this.updateMusicSheetBase(sheetId, {
                 coverImg: musicList.at(0)?.artwork,
             });
         }
-
         // 更新音乐数量
         getDefaultStore().set(
             musicSheetsBaseAtom,
@@ -350,7 +349,6 @@ class MusicSheetClazz implements IInjectable {
                 }
             }),
         );
-
         await storage.setMusicList(sheetId, musicList.musicList);
         ee.emit("UpdateMusicList", {
             sheetId,
@@ -415,7 +413,7 @@ class MusicSheetClazz implements IInjectable {
         if (
             !musicSheets
                 .find(_ => _.id === sheetId)
-                ?.coverImg?.startsWith("file://")
+                ?.coverImg?.startsWith?.("file://")
         ) {
             patchData.coverImg = musicList.at(0)?.artwork;
         }
```

---

### Incident Patch 2: `4f72da22` (2025-08-03)
**Commit Message**: fix: 修复进入软件时进度丢失的问题

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "MusicFree",
-  "version": "0.6.0",
+  "version": "0.6.1-alpha.0",
   "private": true,
   "license": "AGPL",
   "author": {
```

**File**: `src/core/trackPlayer/index.ts` (modified, +12/-4)
```diff
@@ -166,13 +166,17 @@ class TrackPlayer extends EventEmitter<{
 
                     if (isSameMediaItem(this.currentMusic, track)) {
                         await this.setTrackSource(track as Track, false);
+                        if (progress) {
+                            // 异步
+                            this.seekTo(progress);
+                        }
                     }
                 });
             this.setCurrentMusic(track);
 
             if (progress) {
                 // 异步
-                ReactNativeTrackPlayer.seekTo(progress);
+                this.seekTo(progress);
             }
         }
 
@@ -433,7 +437,7 @@ class TrackPlayer extends EventEmitter<{
                     }
                     if (forcePlay) {
                         // 2.1.1 强制重新开始
-                        await ReactNativeTrackPlayer.seekTo(0);
+                        await this.seekTo(0);
                     }
                     const currentState = (
                         await ReactNativeTrackPlayer.getPlaybackState()
@@ -689,7 +693,7 @@ class TrackPlayer extends EventEmitter<{
                     !musicIsPaused(playingState),
                 );
 
-                await ReactNativeTrackPlayer.seekTo(progress.position ?? 0);
+                await this.seekTo(progress.position ?? 0);
                 this.setQuality(newQuality);
             }
             return true;
@@ -726,10 +730,14 @@ class TrackPlayer extends EventEmitter<{
         }
     }
 
+    async seekTo(progress: number) {
+        PersistStatus.set("music.progress", progress);
+        return ReactNativeTrackPlayer.seekTo(progress);
+    }
+
     getProgress = ReactNativeTrackPlayer.getProgress;
     getRate = ReactNativeTrackPlayer.getRate;
     setRate = ReactNativeTrackPlayer.setRate;
-    seekTo = ReactNativeTrackPlayer.seekTo;
     reset = ReactNativeTrackPlayer.reset;
 
 
```

**File**: `src/entry/bootstrap/bootstrap.ts` (modified, +4/-6)
```diff
@@ -95,6 +95,10 @@ async function bootstrapImpl() {
     trace("配置初始化完成");
     logger.mark("配置初始化完成");
 
+    // 加载插件
+    await PluginManager.setup();
+    logger.mark("插件初始化完成");
+    trace("插件初始化完成");
 
     await initTrackPlayer(logger).catch(err => {
         // 初始化播放器出错，延迟初始化
@@ -108,12 +112,6 @@ async function bootstrapImpl() {
         }
     });
 
-    // 加载插件
-    await PluginManager.setup();
-    logger.mark("插件初始化完成");
-    trace("插件初始化完成");
-
-
     await LocalMusicSheet.setup();
     trace("本地音乐初始化完成");
     logger.mark("本地音乐初始化完成");
```

---

### Incident Patch 3: `338aefab` (2025-06-24)
**Commit Message**: fix: 输入框位置偏移

**File**: `android/app/src/main/java/fun/upup/musicfree/utils/UtilsModule.kt` (modified, +36/-0)
```diff
@@ -1,16 +1,22 @@
 package `fun`.upup.musicfree.utils; // replace your-apps-package-name with your app’s package name
 import android.Manifest
+import android.content.Context
 import android.content.Intent
 import android.content.pm.PackageManager
 import android.net.Uri
 import android.os.Build
 import android.os.Environment
 import android.provider.Settings
+import android.util.DisplayMetrics
+import android.view.WindowInsets
+import android.view.WindowManager
 import androidx.core.content.ContextCompat
+import com.facebook.react.bridge.Arguments
 import com.facebook.react.bridge.Promise
 import com.facebook.react.bridge.ReactApplicationContext
 import com.facebook.react.bridge.ReactContextBaseJavaModule
 import com.facebook.react.bridge.ReactMethod
+import com.facebook.react.bridge.WritableMap
 import kotlin.system.exitProcess
 
 class UtilsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
@@ -51,4 +57,34 @@ class UtilsModule(context: ReactApplicationContext) : ReactContextBaseJavaModule
         }
         reactContext.currentActivity?.startActivity(intent)
     }
+
+    @ReactMethod(isBlockingSynchronousMethod = true)
+    fun getWindowDimensions(): WritableMap {
+        val windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
+        val windowMetrics = windowManager.currentWindowMetrics
+        val insets = windowMetrics.windowInsets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars())
+        val bounds = windowMetrics.bounds
+
+        val totalWidthPx = bounds.width()
+        val totalHeightPx = bounds.height()
+
+        val leftInsetPx = insets.left
+        val rightInsetPx = insets.right
+        val topInsetPx = insets.top
+        val bottomInsetPx = insets.bottom
+
+        val usableWidthPx = totalWidthPx - leftInsetPx - rightInsetPx
+        val usableHeightPx = totalHeightPx - topInsetPx - bottomInsetPx
+
+        val displayMetrics: DisplayMetrics = reactApplicationContext.resources.displayMetrics
+        val density = displayMetrics.density
+
+        val usableWidthDp = usableWidthPx / density
+        val usableHeightDp = usableHeightPx / density
+
+        return Arguments.createMap().apply {
+            putDouble("width", usableWidthDp.toDouble())
+            putDouble("height", usableHeightDp.toDouble())
+        }
+    }
 }
```

**File**: `android/build.gradle` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ buildscript {
         kotlinVersion = "1.9.24"
     }
     repositories {
+        maven { url 'https://maven.aliyun.com/repository/central'}
         maven { url 'https://maven.aliyun.com/repository/public' }
         maven { url 'https://maven.aliyun.com/repository/gradle-plugin' }
         google()
```

**File**: `src/components/panels/base/panelBase.tsx` (modified, +2/-1)
```diff
@@ -21,6 +21,7 @@ import Animated, {
 } from 'react-native-reanimated';
 import { useSafeAreaInsets } from 'react-native-safe-area-context';
 import { panelInfoStore } from '../usePanel';
+import NativeUtils from '@/native/utils';
 
 const ANIMATION_EASING: EasingFunction = Easing.out(Easing.exp);
 const ANIMATION_DURATION = 250;
@@ -163,7 +164,7 @@ export default function (props: IPanelBaseProps) {
                     height: vh(100) - safeAreaInsets.top,
                     bottom: 0,
                 } : {
-                    top: positionMethod === 'top' ? vh(100) - height - safeAreaInsets.bottom : undefined,
+                    top: positionMethod === 'top' ? (NativeUtils.getWindowDimensions().height + safeAreaInsets.top) - height - safeAreaInsets.bottom : undefined,
                     bottom: positionMethod === 'bottom' ? 0 : undefined,
                     height: height
                 },
```

**File**: `src/native/utils/index.ts` (modified, +1/-0)
```diff
@@ -4,6 +4,7 @@ interface INativeUtils extends NativeModule {
     exitApp: () => void;
     checkStoragePermission: () => Promise<boolean>;
     requestStoragePermission: () => void;
+    getWindowDimensions: () => { width: number, height: number }; // Fix bug: https://github.com/facebook/react-native/issues/47080
 }
 
 const NativeUtils = NativeModules.NativeUtils;
```

---

### Incident Patch 4: `19813455` (2025-06-22)
**Commit Message**: fix: 部分歌曲无法播放

**File**: `src/core/trackPlayer/index.ts` (modified, +2/-2)
```diff
@@ -462,7 +462,7 @@ class TrackPlayer extends EventEmitter<{
             await ReactNativeTrackPlayer.setQueue([{
                 ...musicItem,
                 url: TrackPlayer.proposedAudioUrl,
-                artwork: resolveImportedAssetOrPath(musicItem.artwork?.trim()?.length ? musicItem.artwork : ImgAsset.albumDefault) as unknown as any,
+                artwork: resolveImportedAssetOrPath(musicItem.artwork?.trim?.()?.length ? musicItem.artwork : ImgAsset.albumDefault) as unknown as any,
             }, this.getFakeNextTrack()]);
 
             // 5. 获取音源
@@ -977,7 +977,7 @@ class TrackPlayer extends EventEmitter<{
         return {
             ...track,
             artwork: resolveImportedAssetOrPath(
-                track.artwork?.trim()?.length ? track.artwork : ImgAsset.albumDefault,
+                track.artwork?.trim?.()?.length ? track.artwork : ImgAsset.albumDefault,
             ) as unknown as any,
         }
     }
```

---

### Incident Patch 5: `bac4e34a` (2025-06-22)
**Commit Message**: fix: portal层级问题

**File**: `src/components/base/portal.tsx` (modified, +9/-1)
```diff
@@ -52,6 +52,13 @@ export default function Portal(props: IPortalProps) {
     return null;
 }
 
+const styles = StyleSheet.create({
+    portalContainer: {
+        zIndex: 20000,
+    },
+});
+const composedStyle = [StyleSheet.absoluteFill, styles.portalContainer];
+
 export function PortalHost() {
     const portals = useAtomValue(portalsAtom);
 
@@ -62,10 +69,11 @@ export function PortalHost() {
                     key={key}
                     collapsable={false}
                     pointerEvents="box-none"
-                    style={StyleSheet.absoluteFill}>
+                    style={composedStyle}>
                     {children}
                 </View>
             ))}
         </>
     );
 }
+
```

**File**: `src/entry/index.tsx` (modified, +2/-3)
```diff
@@ -52,13 +52,12 @@ export default function Pages() {
                                     component={route.component}
                                 />
                             ))}
-                        </Stack.Navigator>
-
+                        </Stack.Navigator>                        
                         <Panels />
                         <Dialogs />
                         <Debug />
-                        <PortalHost />
                         <ToastBaseComponent />
+                        <PortalHost />
                     </NavigationContainer>
                 </SafeAreaProvider>
             </GestureHandlerRootView>
```

---

### Incident Patch 6: `039292a4` (2025-06-21)
**Commit Message**: fix: #357 播放列表为空时添加下一曲，不会立刻播放

**File**: `src/core/trackPlayer/index.ts` (modified, +2/-1)
```diff
@@ -329,9 +329,10 @@ class TrackPlayer extends EventEmitter<{
     }
 
     addNext(musicItem: IMusic.IMusicItem | IMusic.IMusicItem[]): void {
+        const shouldAutoPlay = this.isPlayListEmpty() || !this.currentMusic;
+
         this.add(musicItem, this.currentIndex + 1);
 
-        const shouldAutoPlay = this.isPlayListEmpty();
         if (shouldAutoPlay) {
             this.play(Array.isArray(musicItem) ? musicItem[0] : musicItem);
         }
```

---

### Incident Patch 7: `a2bc9b53` (2025-06-21)
**Commit Message**: fix: #459 点击更新订阅插件后，始终显示加载中

**File**: `src/pages/setting/settingTypes/pluginSetting/views/pluginList.tsx` (modified, +1/-1)
```diff
@@ -211,8 +211,8 @@ export default function PluginList() {
                     Toast.warn(t("toast.subscriptionInvalid"));
                 }
             }
-            setLoading(false);
         }
+        setLoading(false);
     }
 
     async function onUpdateAllClick() {
```

---

### Incident Patch 8: `8ceba30d` (2025-06-21)
**Commit Message**: fix: #458

**File**: `src/pages/recommendSheets/components/body/index.tsx` (modified, +0/-1)
```diff
@@ -72,7 +72,6 @@ export default function Body() {
             }}
             onIndexChange={setIndex}
             initialLayout={{ width: vw(100) }}
-            swipeEnabled={false}
         />
     );
 }
```

---

### Incident Patch 9: `009fa189` (2025-06-19)
**Commit Message**: fix: 修复图片导致的闪退问题

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "MusicFree",
-  "version": "0.6.0-alpha.3",
+  "version": "0.6.0-beta.2",
   "private": true,
   "license": "AGPL",
   "author": {
```

---

### Incident Patch 10: `eace65f7` (2025-06-19)
**Commit Message**: fix: 修复图片导致的闪退问题

**File**: `src/components/base/image.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ interface IImageProps extends ImageProps {
 }
 export default function (props: Omit<IImageProps, 'source'>) {
     const { uri, emptySrc } = props;
-    const source = uri
+    const source = typeof uri === "string"
         ? {
               uri,
           }
```

**File**: `src/pages/musicDetail/components/background.tsx` (modified, +17/-7)
```diff
@@ -1,19 +1,29 @@
-import React from 'react';
+import React, { useMemo } from 'react';
 import { Image, StyleSheet, View } from 'react-native';
 import { ImgAsset } from '@/constants/assetsConst';
 import { useCurrentMusic } from '@/core/trackPlayer';
 
 export default function Background() {
     const musicItem = useCurrentMusic();
-    const source = musicItem?.artwork
-        ? {
-              uri: musicItem.artwork,
-          }
-        : ImgAsset.albumDefault;
+
+    const artworkSource = useMemo(() => {
+        if (!musicItem?.artwork) {
+            return ImgAsset.albumDefault;
+        }
+
+        if(typeof musicItem.artwork === 'string') {
+            return {
+                uri: musicItem.artwork
+            };
+        }
+        return musicItem.artwork;
+
+    }, [musicItem?.artwork])
+
     return (
         <>
             <View style={style.background} />
-            <Image style={style.blur} blurRadius={50} source={source} />
+            <Image style={style.blur} blurRadius={50} source={artworkSource} />
         </>
     );
 }
```

---

### Incident Patch 11: `d3ed5f49` (2025-06-19)
**Commit Message**: fix: 尝试修复闪退

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "MusicFree",
-  "version": "0.6.0-beta.1",
+  "version": "0.6.0-alpha.3",
   "private": true,
   "license": "AGPL",
   "author": {
```

**File**: `src/components/base/fastImage.tsx` (modified, +23/-10)
```diff
@@ -1,30 +1,43 @@
 import React, { useEffect, useState } from 'react';
+import { ImageRequireSource } from 'react-native';
 import FastImage, { FastImageProps } from 'react-native-fast-image';
 
 interface IFastImageProps {
     style: FastImageProps['style'];
     defaultSource?: FastImageProps['defaultSource'];
-    emptySrc?: number;
-    uri?: string;
+    placeholderSource?: ImageRequireSource;
+    source?: FastImageProps['source'] | string;
 }
 export default function (props: IFastImageProps) {
-    const { style, emptySrc, uri, defaultSource } = props ?? {};
+    const { style, placeholderSource, defaultSource, source } = props ?? {};
     const [isError, setIsError] = useState(false);
-    const source = uri
-        ? {
-              uri,
-          }
-        : emptySrc;
+
+
+    let realSource: FastImageProps['source'];
+    if (typeof source === 'string') {
+        realSource = { uri: source };
+        if (source.length === 0) {
+            realSource = placeholderSource;
+        }
+    } else if (source){
+        realSource = source;
+    } else {
+        realSource = placeholderSource;
+    }
+
 
     useEffect(() => {
         setIsError(false);
-    }, [uri]);
+    }, [source]);
+
+
     return (
         <FastImage
             style={style}
-            source={isError ? emptySrc : source}
+            source={isError ? placeholderSource : realSource}
             onError={() => {
                 setIsError(true);
+                console.error('Image load error:', realSource);
             }}
             defaultSource={defaultSource}
         />
```

**File**: `src/components/base/listItem.tsx` (modified, +2/-2)
```diff
@@ -213,8 +213,8 @@ function ListItemImage(props: IListItemImageProps) {
         <View style={[styles.actionBase, defaultStyle, containerStyle]}>
             <FastImage
                 style={[styles.leftImage, contentStyle]}
-                uri={uri}
-                emptySrc={fallbackImg}
+                source={uri}
+                placeholderSource={fallbackImg}
             />
             {maskIcon ? (
                 <View style={[styles.leftImage, styles.imageMask]}>
```

**File**: `src/components/musicBar/musicInfo.tsx` (modified, +2/-2)
```diff
@@ -50,8 +50,8 @@ function _BarMusicItem(props: IBarMusicItemProps) {
             ]}>
             <FastImage
                 style={styles.artworkImg}
-                uri={musicItem.artwork}
-                emptySrc={ImgAsset.albumDefault}
+                source={musicItem.artwork}
+                placeholderSource={ImgAsset.albumDefault}
             />
             <Text
                 ellipsizeMode="tail"
```

**File**: `src/components/musicSheetPage/components/header.tsx` (modified, +2/-2)
```diff
@@ -32,8 +32,8 @@ export default function Header(props: IHeaderProps) {
                 <View style={style.content}>
                     <FastImage
                         style={style.coverImg}
-                        uri={musicSheet?.artwork ?? musicSheet?.coverImg}
-                        emptySrc={ImgAsset.albumDefault}
+                        source={musicSheet?.artwork ?? musicSheet?.coverImg}
+                        placeholderSource={ImgAsset.albumDefault}
                     />
                     <View style={style.details}>
                         <ThemeText numberOfLines={3}>
```

**File**: `src/components/panels/types/musicComment/comment.tsx` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ export default function Comment(props: ICommentProps) {
     return (
         <View style={styles.container}>
             <View style={styles.headerLine}>
-                <FastImage uri={comment.avatar} style={styles.avatar} />
+                <FastImage source={comment.avatar} style={styles.avatar} />
                 <ThemeText numberOfLines={1} fontSize={'subTitle'}>
                     {comment.nickName}
                 </ThemeText>
```

**File**: `src/components/panels/types/musicComment/index.tsx` (modified, +2/-2)
```diff
@@ -52,8 +52,8 @@ export default function MusicComment(props: IMusicCommentProps) {
                 <View style={styles.musicItemContainer}>
                     <FastImage
                         style={styles.musicItemArtwork}
-                        uri={musicItem?.artwork}
-                        emptySrc={ImgAsset.albumDefault}
+                        source={musicItem?.artwork}
+                        placeholderSource={ImgAsset.albumDefault}
                     />
                     <View style={styles.musicItemContent}>
                         <ThemeText fontSize="subTitle" numberOfLines={1}>
```

**File**: `src/components/panels/types/musicItemLyricOptions.tsx` (modified, +2/-2)
```diff
@@ -202,8 +202,8 @@ export default function MusicItemLyricOptions(
                     <View style={style.header}>
                         <FastImage
                             style={style.artwork}
-                            uri={musicItem?.artwork}
-                            emptySrc={ImgAsset.albumDefault}
+                            source={musicItem?.artwork}
+                            placeholderSource={ImgAsset.albumDefault}
                         />
                         <View style={style.content}>
                             <ThemeText numberOfLines={2} style={style.title}>
```

---

### Incident Patch 12: `2c02939e` (2025-06-14)
**Commit Message**: fix: 推荐歌单部分情况下只加载第一页

**File**: `src/pages/recommendSheets/hooks/useRecommendSheets.ts` (modified, +6/-6)
```diff
@@ -36,7 +36,12 @@ export default function (pluginHash: string, tag: ICommon.IUnique) {
                     tag,
                     pageRef.current,
                 );
-                console.log(res.isEnd);
+                
+                if (res.isEnd) {
+                    setRequestState(RequestStateCode.FINISHED);
+                } else {
+                    setRequestState(RequestStateCode.PARTLY_DONE);
+                }
                 if (tag.id === currentTagRef.current) {
                     setSheets(prev => [
                         ...prev,
@@ -46,11 +51,6 @@ export default function (pluginHash: string, tag: ICommon.IUnique) {
                     ]);
                 }
 
-                if (res.isEnd) {
-                    setRequestState(RequestStateCode.FINISHED);
-                } else {
-                    setRequestState(RequestStateCode.PARTLY_DONE);
-                }
             } else {
                 setRequestState(RequestStateCode.FINISHED);
                 setSheets([]);
```

---

### Incident Patch 13: `0f5a5db2` (2025-06-07)
**Commit Message**: fix: 本地音乐无法播放

**File**: `android/app/src/main/AndroidManifest.xml` (modified, +115/-8)
```diff
@@ -40,20 +40,127 @@
               <category android:name="android.intent.category.BROWSABLE" />
               <data android:scheme="musicfree" android:host="app"/>
               <data android:scheme="musicfree" android:host="install"/>
+          </intent-filter>          
+          <!-- 处理音频文件 -->
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="file" />
+              <data android:mimeType="audio/*" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="content" />
+              <data android:mimeType="audio/*" />
+          </intent-filter>
+          <!-- 处理特定音频格式 -->
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="file" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.mp3" />
+              <data android:pathPattern=".*\\.MP3" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="file" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.flac" />
+              <data android:pathPattern=".*\\.FLAC" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="file" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.m4a" />
+              <data android:pathPattern=".*\\.M4A" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="file" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.wav" />
+              <data android:pathPattern=".*\\.WAV" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="content" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.mp3" />
+              <data android:pathPattern=".*\\.MP3" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="content" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.flac" />
+              <data android:pathPattern=".*\\.FLAC" />
+          </intent-filter>
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="content" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.m4a" />
+              <data android:pathPattern=".*\\.M4A" />
+          </intent-filter>          
+          <intent-filter>
+              <action android:name="android.intent.action.VIEW" />
+              <category android:name="android.intent.category.DEFAULT" />
+              <category android:name="android.intent.category.BROWSABLE" />
+              <data android:scheme="content" />
+              <data android:mimeType="*/*" />
+              <data android:pathPattern=".*\\.wav" />
+              <data android:pathPattern=".*\\.WAV" />
+     
```

**File**: `src/core/trackPlayer/index.ts` (modified, +4/-2)
```diff
@@ -37,6 +37,7 @@ import type { IMusicHistory } from '@/types/core/musicHistory';
 import { ITrackPlayer } from '@/types/core/trackPlayer/index';
 import minDistance from '@/utils/minDistance';
 import { IPluginManager } from '@/types/core/pluginManager';
+import { ImgAsset } from '@/constants/assetsConst';
 
 
 
@@ -458,7 +459,8 @@ class TrackPlayer extends EventEmitter<{
             this.setCurrentMusic(musicItem);
             await ReactNativeTrackPlayer.setQueue([{
                 ...musicItem,
-                url: TrackPlayer.proposedAudioUrl
+                url: TrackPlayer.proposedAudioUrl,
+                artwork: musicItem.artwork?.trim()?.length ? musicItem.artwork : ImgAsset.albumDefault,
             }, this.getFakeNextTrack()]);
 
             // 5. 获取音源
@@ -783,7 +785,7 @@ class TrackPlayer extends EventEmitter<{
     // 设置音源
     private async setTrackSource(track: Track, autoPlay = true) {
         if (!track.artwork?.trim()?.length) {
-            track.artwork = undefined;
+            track.artwork = ImgAsset.albumDefault;
         }
         await ReactNativeTrackPlayer.setQueue([track, this.getFakeNextTrack()]);
         PersistStatus.set('music.musicItem', track as IMusic.IMusicItem);
```

---

### Incident Patch 14: `1c39b59f` (2025-06-06)
**Commit Message**: fix: 选择颜色弹窗点击确认时未生效

**File**: `src/components/panels/types/colorPicker.tsx` (modified, +23/-1)
```diff
@@ -189,7 +189,29 @@ export default function ColorPicker(props: IColorPickerProps) {
                     <PanelHeader
                         onCancel={hidePanel}
                         onOk={async () => {
-                            onSelected?.(currentColorWithAlpha);
+                            // 检查输入框的值是否与当前颜色不同
+                            if (inputValue !== colorHexString) {
+                                try {
+                                    const color = Color(inputValue);
+                                    const hsl = color.hsl();
+                                    
+                                    // 更新颜色状态
+                                    setCurrentHue(hsl.hue() || 0);
+                                    setCurrentSaturation(hsl.saturationl());
+                                    setCurrentLightness(hsl.lightness());
+                                    setCurrentAlpha(color.alpha());
+                                    
+                                    // 使用输入的颜色进行提交
+                                    onSelected?.(color);
+                                } catch (error) {
+                                    // 如果输入的颜色无效，使用当前颜色
+                                    onSelected?.(currentColorWithAlpha);
+                                }
+                            } else {
+                                // 输入值与当前颜色相同，直接使用当前颜色
+                                onSelected?.(currentColorWithAlpha);
+                            }
+                            
                             if (closePanelWhenSelected) {
                                 hidePanel();
                             }
```

**File**: `src/core/pluginManager/plugin.ts` (modified, +2/-0)
```diff
@@ -775,9 +775,11 @@ class PluginMethodsWrapper implements IPlugin.IPluginInstanceMethods {
 
     async getMusicComments(
         musicItem: IMusic.IMusicItem,
+        page?: number
     ): Promise<ICommon.PaginationResponse<IMedia.IComment>> {
         const result = await this.plugin.instance?.getMusicComments?.(
             musicItem,
+            page ?? 1
         );
         if (!result) {
             throw new Error();
```

---

### Incident Patch 15: `c59735f2` (2025-06-04)
**Commit Message**: fix: 移除冗余的默认音量降低幅度设置

**File**: `src/pages/setting/settingTypes/basicSetting.tsx` (modified, +0/-6)
```diff
@@ -277,12 +277,6 @@ export default function BasicSetting() {
                     'basic.tempRemoteDuck',
                     ['暂停', '降低音量'],
                     tempRemoteDuck ?? '暂停',
-                    undefined,
-                    (val) => {
-                        if (val === '降低音量' && !tempRemoteDuckVolume) {
-                            Config.setConfig('basic.tempRemoteDuckVolume', 0.5);
-                        }
-                    }
                 ),
                 ...(tempRemoteDuck === '降低音量' ? [
                     createRadio(
```

#### Recent Merged Pull Requests:
- **PR #649** (closed): 车机USB读取 (@xisohi)
- **PR #646** (closed): Add Linux desktop support with Wayland/X11 and CI fixes (@lrplrplrp)
- **PR #640** (closed): feat: add Korean (ko-KR) translation (@moduvoice)
- **PR #632** (2026-06-20): 修复：稳定性与跨平台优化 (@zhumengting01)
- **PR #627** (closed): feat: 设置导航栏沉浸, 播放页图片放大，背景模糊增加 (@hanks-zyh)
- **PR #624** (closed): feat: 搜索结果页面增加操作条 (@z974890869)
- **PR #618** (closed): Create webpack.yml (@YixingTRD2943)
- **PR #616** (closed): fix(downloader): 修复下载队列卡死、计数器泄漏和缺少重试机制等5个Bug (@Junctiono369)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
