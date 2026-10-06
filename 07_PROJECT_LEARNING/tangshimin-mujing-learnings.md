# Forensic Learning Record (Deep Inspection): tangshimin/MuJing

> **Canonical Artifact**: `07_PROJECT_LEARNING/tangshimin-mujing-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tangshimin/MuJing](https://github.com/tangshimin/MuJing))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:55:59.728Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tangshimin/MuJing`
- **Description**: 一款通过电影、美剧或文档中的真实语境学习英语单词的应用，让您在原汁原味的情境中记忆词汇，提升学习效率。
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4659 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/main/kotlin/com/mujingx/ffmpeg/FFmpegUtil.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.ffmpeg

import net.bramp.ffmpeg.FFmpeg
import net.bramp.ffmpeg.FFmpegExecutor
import net.bramp.ffmpeg.builder.FFmpegBuilder
import net.bramp.ffmpeg.builder.FFmpegBuilder.Verbosity
import net.bramp.ffmpeg.job.FFmpegJob
import com.mujingx.player.isWindows
import com.mujingx.state.getResourcesFile
import com.mujingx.state.getSettingsDirectory
import com.mujingx.ui.dialog.replaceNewLine
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import javax.swing.JOptionPane

fun findFFmpegPath(): String {
    val path: String = if(isWindows()){
        getResourcesFile("ffmpeg/ffmpeg.exe").absolutePath
    }else{
        val ffmpegFile = getResourcesFile("ffmpeg/ffmpeg")
        if(ffmpegFile.exists() && !ffmpegFile.canExecute()){
            ffmpegFile.setExecutable(true)
        }
        getResourcesFile("ffmpeg/ffmpeg").absolutePath
    }
    return path
}

/**
 * 使用 FFmpeg 提取视频里的字幕,并且把字幕转换成 SRT 格式
 */
fun extractSubtitles(
    input: String, subtitleId: Int,
    output: String,
    verbosity: Verbosity = Verbosity.INFO
): String {
    return try {
        val ffmpeg = FFmpeg(findFFmpegPath())
        val builder = FFmpegBuilder()
            .setVerbosity(verbosity)
            .setInput(input)
            .addOutput(output)
            .addExtraArgs("-map", "0:s:$subtitleId") //  -map 0:s:0 表示提取第一个字幕，-map 0:s:1 表示提取第二个字幕。
            .done()
        val executor = FFmpegExecutor(ffmpeg)
        val job = executor.createJob(builder)
        job.run()
        if (job.state == FFmpegJob.State.FINISHED) {
            "finished"
        } else {
            JOptionPane.showMessageDialog(null, "提取字幕失败", "错误", JOptionPane.ERROR_MESSAGE)
            "failed"
        }
    } catch (e: Exception) {
        JOptionPane.showMessageDialog(null, "选择的字幕格式暂时不支持\n ${e.message}", "错误", JOptionPane.ERROR_MESSAGE)
        "failed"
    }
}

/**
 * 使用 FFmpeg 把字幕格式转换成 SRT 格式
 */
fun convertToSrt(
    input:String,
    output:String,
    verbosity: Verbosity = Verbosity.INFO
    ):String{
    val ffmpeg = FFmpeg(findFFmpegPath())
    val builder = FFmpegBuilder()
        .setVerbosity(verbosity)
        .setInput(input)
        .addOutput(output)
        .done()
    val executor = FFmpegExecutor(ffmpeg)
    val job = executor.createJob(builder)
    job.run()
    if (job.state == FFmpegJob.State.FINISHED) {
        return "finished"
    }
    return "failed"
}



/**
 * 匹配富文本标签的正则表达式
 * 保留换行标签 <br />
 */

const val RICH_TEXT_REGEX = "</?(b|i|u|font|s|ruby|rt|rb|sub|sup)(\\s[^>]*)?>"
/**
 * 移除 SRT 字幕里的富文本标签
 *使用 FFmpeg 提取 mov_text 字幕时，会保留这些富文本标签，但是我们只需要纯文本，所以需要移除这些标签。
 *
 * mov_text 字幕支持以下富文本格式标签：
 * <font>: 字体样式（包括 face、size 和 color 属性）
 * <b>: 粗体文本
 * <i>: 斜体文本
 * <u>: 下划线文本
 * <s>: 删除线文本
 * <ruby>: 用于注音或解释的文本
 * <rt>: 注音文本
 * <rb>: 基本文本（与 <ruby> 一起使用）
 * <sub>: 下标文本
 * <sup>: 上标文本
 */
fun removeRichText(srtFile: File){
    var content = srtFile.readText()
    content = removeRichText(content)
    // 把换行标签 <br /> 替换成 \n
   content =  replaceNewLine(content)
    srtFile.writeText(content)
}

fun removeRichText(content: String): String {
    val richTextRegex = Regex(RICH_TEXT_REGEX)
    return richTextRegex.replace(content, "")
}


fun hasRichText(srtFile: File): Boolean {
    val content = srtFile.readText()
    val richTextRegex = Regex(RICH_TEXT_REGEX)
        return richTextRegex.containsMatchIn(content)
}
fun hasRichText(content: String): Boolean {
    val richTextRegex = Regex(RICH_TEXT_REGEX)
        return richTextRegex.containsMatchIn(content)
}


/**
 * 使用 Whisper 模型生成 SRT 字幕
 * @param input 输入视频/音频文件路径
 * @param output 输出 SRT 文件路径
 * @param modelPath Whisper 模型文件的绝对路径（必需参数）
 * @param language 语言代码 (例如 "en", "zh", "auto")
 * @param queue 队列大小，控制处理延迟和准确性的平衡
 * @return Result<Unit> 成功时返回 Result.success()，失败时返回 Result.failure()
 */
fun generateSrtWithWhisper(
    input: String,
    output: String,
    modelPath: String,
    language: String = "en",
    queue: Int = 3,
    useGpu: Boolean = true,
    gpuDevice: Int = 0,
): Result<Unit> {
    return try {
        val ffmpeg = FFmpeg(findFFmpegPath())

        // 检查模型文件是否存在
        val modelFile = File(modelPath)
        if (!modelFile.exists()) {
            val error = "Whisper 模型文件不存在: $modelPath\n" +
                    "请运行 './gradlew downloadWhisperModels' 下载模型文件"
            println("错误: $error")
            return Result.failure(IllegalArgumentException(error))
        }

        // 将路径转换为绝对路径并统一为 Unix 风格
        val normalizedModelPath = modelFile.absolutePath.replace("\\", "/")
        val normalizedOutput = File(output).absolutePath.replace("\\", "/")

        val escapedModelPath = escapeFilterPath(normalizedModelPath)
        val escapedOutput = escapeFilterPath(normalizedOutput)

        // 构建 whisper 滤镜参数
        val whisperFilter = buildString {
            append("whisper=model=$escapedModelPath:language=$language:queue=$queue")
            append(":use_gpu=").append(if (useGpu) "true" else "false")
            append(":gpu_device=").append(gpuDevice)
            append(":destination=$escapedOutput:format=srt")
        }

        // 确保输出目录存在
        val outputFile = File(output)
        outputFile.parentFile?.mkdirs()

        val builder = FFmpegBuilder()
            .setVerbosity(Verbosity.INFO)
            .setInput(input)
            .addOutput(output)
            .addExtraArgs("-vn") // 禁用视频流
            .addExtraArgs("-af", whisperFilter)
            .addExtraArgs("-f", "null") // 输出格式为 null，因为实际输出由 whisper 滤镜处理
            .done()

        val executor = FFmpegExecutor(ffmpeg)
        val job = executor.createJob(builder)
        job.run()

        if (job.state == FFmpegJob.State.FINISHED) {
            // 检查输出文件是否生成成功
            val outputFile2 = File(output)
            if (outputFile2.exists() && outputFile2.length() > 0) {
                Result.success(Unit)
            } else {
                val error = "生成字幕文件失败，文件为空或不存在: $output"
                println("错误: $error")
                Result.failure(RuntimeException(error))
            }
        } else {
            val error = "使用 Whisper 生成字幕失败，FFmpeg 任务状态: ${job.state}"
            println("错误: $error")
            Result.failure(RuntimeException(error))
        }
    } catch (e: Exception) {
        println("使用 Whisper 生成字幕时出现错误:")
        e.printStackTrace()
        Result.failure(e)
    }
}

// 在 FFmpeg 滤镜参数中，需要转义某些特殊字符
// Windows 路径中的盘符冒号需要转义为 \\:
fun escapeFilterPath(path: String): String {
    return path
        .replace(":", "\\\\:")
        .replace("[", "\\[")
        .replace("]", "\\]")
        .replace("'", "\\'")
        .replace("\"", "\\\"")
}

/**
 * 提取选择的字幕到用户目录,字幕浏览器界面使用
 * */
fun writeSubtitleToFile(
    videoPath: String,
    trackId: Int,
): File? {
    val settingsDir = getSettingsDirectory()
    val subtitleFile = File(settingsDir, "subtitles.srt")
    val result = extractSubtitles(videoPath, trackId, subtitleFile.absolutePath)
    if(result == "finished"){
        // 检查字幕文件是否包含富文本标签
        val hasRichText = hasRichText(subtitleFile)
        if(hasRichText){
            removeRichText(subtitleFile)
        }

        return subtitleFile
    }else{
        return null
    }
}

/**
 * 启动一个可中断的 Whisper 生成字幕进程（非阻塞）。
 * 返回 Process 用于外部中断；完成与否需调用方等待 process.waitFor() 后自判输出文件。
 * @param onProgress 解析 FFmpeg 日志后的进度回调 (timeSec, totalSec, speed)
 */
fun startWhisperSrt(
    input: String,
    output: String,
    modelPath: String,
    language: String = "en",
    queue: Int = 3,
    useGpu: Boolean = true,
    gpuDevice: Int = 0,
    onProgress: (Double?, Double?, String?) -> Unit = { _, _, _ -> }
): Result<Process> {
    return try {
        val modelFile = File(modelPath)
        if (!modelFile.exists()) {
            return Result.failure(IllegalArgumentException("Whisper 模型文件不存在: $modelPath"))
        }
        File(output).parentFile?.mkdirs()

        val ffmpegPath = findFFmpegPath()
        val normalizedModelPath = modelFile.absolutePath.replace("\\", "/")
        val normalizedOutput = File(output).absolutePath.replace("\\", "/")
        val escapedModelPath = escapeFilterPath(normalizedModelPath)
        val escapedOutput = escapeFilterPath(normalizedOutput)
        val whisperFilter = buildString {
            append("whisper=model=$escapedModelPath:language=$language:queue=$queue")
            append(":use_gpu=").append(if (useGpu) "true" else "false")
            append(":gpu_device=").append(gpuDevice)
            append(":destination=$escapedOutput:format=srt")
        }

        val command = listOf(
            ffmpegPath,
            "-y",
            "-loglevel", "info",
            "-vn",
            "-i", input,
            "-af", whisperFilter,
            "-f", "null",
            "-"
        )
        val builder = ProcessBuilder(command)
        builder.redirectErrorStream(true)
        val process = builder.start()

        // 解析日志，提取 Duration 与 time/speed
        Thread {
            var totalSec: Double? = null
            val durationRegex = Regex("Duration: (\\d+):(\\d+):(\\d+\\.?\\d*)")
            val timeRegex = Regex("time=(\\d+):(\\d+):(\\d+\\.?\\d*)")
            val speedRegex = Regex("speed=([0-9.]+)x")
            try {
                BufferedReader(InputStreamReader(process.inputStream)).use {
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/fsrs/FSRSTimeUtils.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing, which is licensed under GPL v3.
 */

package com.mujingx.fsrs

import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * FSRS 时间工具类
 *
 * 提供与 FSRS 算法配套的时间计算和转换功能
 */
object FSRSTimeUtils {

    /**
     * 在当前时间基础上添加指定毫秒数
     *
     * 用于根据 FSRS 计算出的 durationMillis 确定下次复习的具体时间点
     *
     * @param millis 要添加的毫秒数（通常来自 Grade.durationMillis）
     * @return 计算后的本地时间
     */
    fun addMillisToNow(millis: Long): LocalDateTime {
        val nowInstant = Instant.now()
        val newInstant = nowInstant.plusMillis(millis)
        return LocalDateTime.ofInstant(newInstant, ZoneId.systemDefault())
    }

    /**
     * 在指定时间基础上添加毫秒数
     *
     * @param baseTime 基准时间
     * @param millis 要添加的毫秒数
     * @return 计算后的时间
     */
    fun addMillisToTime(baseTime: LocalDateTime, millis: Long): LocalDateTime {
        val baseInstant = baseTime.atZone(ZoneId.systemDefault()).toInstant()
        val newInstant = baseInstant.plusMillis(millis)
        return LocalDateTime.ofInstant(newInstant, ZoneId.systemDefault())
    }

    /**
     * 根据 FSRS Grade 结果更新闪卡的下次复习时间
     *
     * @param card 要更新的闪卡
     * @param selectedGrade 用户选择的评分结果
     * @return 更新了 dueDate 的闪卡副本
     */
    fun updateCardDueDate(card: FlashCard, selectedGrade: Grade): FlashCard {
        val nextReviewTime = addMillisToNow(selectedGrade.durationMillis)
        return card.copy(
            dueDate = nextReviewTime,
            stability = selectedGrade.stability,
            difficulty = selectedGrade.difficulty,
            interval = selectedGrade.interval,
            lastReview = LocalDateTime.now(),
            reviewCount = card.reviewCount + 1
        )
    }

    /**
     * 检查闪卡是否到期需要复习
     *
     * @param card 要检查的闪卡
     * @param currentTime 当前时间（默认为系统当前时间）
     * @return 如果到期返回 true，否则返回 false
     */
    fun isCardDue(card: FlashCard, currentTime: LocalDateTime = LocalDateTime.now()): Boolean {
        return currentTime.isAfter(card.dueDate) || currentTime.isEqual(card.dueDate)
    }

    /**
     * 计算距离下次复习还有多长时间
     *
     * @param card 闪卡
     * @param currentTime 当前时间（默认为系统当前时间）
     * @return 剩余时间的毫秒数，如果已经到期则返回 0
     */
    fun timeUntilDue(card: FlashCard, currentTime: LocalDateTime = LocalDateTime.now()): Long {
        if (isCardDue(card, currentTime)) {
            return 0L
        }

        val currentInstant = currentTime.atZone(ZoneId.systemDefault()).toInstant()
        val dueInstant = card.dueDate.atZone(ZoneId.systemDefault()).toInstant()

        return dueInstant.toEpochMilli() - currentInstant.toEpochMilli()
    }
}

```

### Core Architecture Module: `src/main/kotlin/com/mujingx/player/PlayerState.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.player

import androidx.compose.runtime.*
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import com.mujingx.data.ExternalCaption
import com.mujingx.data.MutableVocabulary
import com.mujingx.data.VocabularyType
import com.mujingx.data.Word
import com.mujingx.data.deepCopy
import com.mujingx.data.getFamiliarVocabularyFile
import com.mujingx.data.loadMutableVocabulary
import com.mujingx.data.loadVocabulary
import com.mujingx.data.saveVocabulary
import io.ktor.utils.io.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.mujingx.state.getSettingsDirectory
import com.mujingx.ui.wordscreen.WordScreenState
import java.io.File
import java.time.LocalDateTime
import javax.swing.JOptionPane
import kotlinx.coroutines.*

@OptIn(ExperimentalSerializationApi::class)
class PlayerState(playerData: PlayerData) {

    /** 显示视频播放器 */
    var visible by  mutableStateOf(false)
    /** 播放器 > 视频地址 */
    var videoPath by mutableStateOf("")
    var startTime by mutableStateOf("00:00:00")
    /** 记忆单词界面调用的查看语境功能时，显示哪个字幕轨道的字幕 */
    var showContextTrackId by mutableStateOf(0)

    /** 与视频关联的词库，用于生成弹幕 */
    var vocabulary by  mutableStateOf<MutableVocabulary?>(null)
    /** 与视频关联的词库地址，用于保存词库，因为看视频时可以查看单词详情，如果觉得太简单了可以删除或加入到熟悉词库 */
    var vocabularyPath by mutableStateOf("")

    /** 记忆单词界面正在记忆的词库 */
    var wordScreenVocabulary by mutableStateOf<MutableVocabulary?>(null)
    var wordScreenVocabularyPath by mutableStateOf("")


    var showSequence by mutableStateOf(playerData.showSequence)
    var danmakuVisible by mutableStateOf(playerData.danmakuVisible)
    var autoCopy by mutableStateOf(playerData.autoCopy)
    var autoSpeak by mutableStateOf(playerData.autoSpeak)
    var preferredChinese by mutableStateOf(playerData.preferredChinese)
    var autoPause by mutableStateOf(playerData.autoPause)
    var showClose by mutableStateOf(playerData.showClose)

    var showCaptionList by mutableStateOf(false)
    var recentList = readRecentList()
    
    /** 播放列表状态 */
    var playlist = mutableStateListOf<PlaylistItem>()
    var currentPlayingIndex by mutableStateOf(-1)
    /** 字幕列表/播放列表 Tab 的选中索引 */
    var listSelectedTab by mutableStateOf(0)
    
    /** 通知消息 */
    var notificationMessage by mutableStateOf("")
    var notificationType by mutableStateOf(NotificationType.INFO)
    var showNotification by mutableStateOf(false)
    private var notificationJob: Job? = null

    /** 从记忆单词界面调用的查看语境功能 */
    val showContext :(MediaInfo) -> Unit = { mediaInfo ->
        // 显示视频播放器窗口
        visible = true
        showCaptionList = true
        // 设置视频路径和开始时间
        videoPath = mediaInfo.mediaPath
        startTime = mediaInfo.caption.start
        if(mediaInfo.trackId != -1){
            showContextTrackId = mediaInfo.trackId
        }
    }

    /** 从工具栏打开视频播放器 */
    val showPlayer :(WordScreenState) -> Unit = { wordScreenState ->
        // 显示视频播放器窗口
        visible = true
        // 设置记忆单词界面的词库
        wordScreenVocabulary = wordScreenState.vocabulary
        wordScreenVocabularyPath = wordScreenState.vocabularyPath
    }

    /** 设置视频地址的函数，放到这里是因为记忆单词窗口可以接受拖放的视频，然后打开视频播放器 */
    val videoPathChanged:(String) -> Unit = {
        // 已经打开了一个视频再打开一个新的视频，重置与旧视频相关联的词库。
        if(videoPath.isNotEmpty() && vocabulary != null){
            vocabularyPath = ""
            vocabulary = null
        }
        videoPath = it
        // 当视频路径改变时，只有当 CaptionAndVideoList 显示且播放列表 Tab 选中时才加载播放列表
        if (showCaptionList && listSelectedTab == 1) {
            loadPlaylist(it)
        }
    }
    /** 设置词库地址的函数，放到这里是因为记忆单词可以接受拖放的视频，然后把当前词库关联到打开的视频播放器。*/
    val vocabularyPathChanged:(String) -> Unit = {
        if(videoPath.isNotEmpty()){
            vocabularyPath = it
            val newVocabulary = loadMutableVocabulary(it)
            vocabulary = newVocabulary
        }else{
            JOptionPane.showMessageDialog(null,"先打开视频，再拖放词库。")
        }
    }

    /** 在记忆单词界面拖放一个视频，当前的词库会被当成弹幕显示 */
    val openVideo:(String, String) -> Unit = { videoPath, danmakuPath ->
        // 打开视频播放器窗口
        visible = true
        // 设置视频路径和开始时间
        this.videoPath = videoPath
        startTime = "00:00:00"
        // 如果视频的路径和词库对应的视频路径不一致怎么办？
        // 这里不处理，VideoPlayer 加载弹幕的函数会处理。
        // 设置词库路径
        vocabularyPath = danmakuPath
        // 加载词库
        vocabulary = loadMutableVocabulary(danmakuPath)
    }


    fun savePlayerState() {
        runBlocking {
            launch (Dispatchers.IO){
                val playerData = PlayerData(
                    showSequence, danmakuVisible, autoCopy, autoSpeak, preferredChinese, autoPause,showClose
                )
                val encodeBuilder = Json {
                    prettyPrint = true
                    encodeDefaults = true
                }
                val json = encodeBuilder.encodeToString(playerData)
                val playerSettings = getPlayerSettingsFile()
                playerSettings.writeText(json)
            }
        }
    }




    /**
     * 读取最近播放视频的列表。
     *
     * 从存储的文件中加载最近播放的视频列表，并按时间倒序排序。
     * 如果文件不存在或解析失败，则返回一个空列表。
     *
     * @return 一个包含最近播放视频的可观察状态列表（SnapshotStateList）。
     */
    private fun readRecentList(): SnapshotStateList<RecentVideo> {
        val recentListFile = getRecentVideoFile()
        var list = if (recentListFile.exists()) {
            try {
                Json.decodeFromString<List<RecentVideo>>(recentListFile.readText())
            } catch (exception: Exception) {
                exception.printStack()
                listOf()
            }

        } else {
            listOf()
        }
        list = list.sortedByDescending { it.dateTime }
        return list.toMutableStateList()
    }

    fun updateLastPlayedTime(newTime: String) {
        runBlocking {
            launch(Dispatchers.IO) {
                if (recentList.isNotEmpty()) {
                    val firstItem = recentList.first()
                    firstItem.lastPlayedTime =newTime
                    val encodeBuilder = Json {
                        prettyPrint = true
                        encodeDefaults = true
                    }
                    val json = encodeBuilder.encodeToString(recentList.toList())
                    getRecentVideoFile().writeText(json)
                }
            }
        }
    }

    /**
     * 将视频保存到最近播放列表。
     *
     * 如果视频已存在于最近播放列表中，则将其移到列表顶部。
     * 如果列表已满（最多20个），则移除最旧的条目。
     * 保存更新后的列表到存储文件中。
     *
     * @param recentVideo 最近播放的视频条目，包含视频的名称和路径。
     */
    fun saveToRecentList(recentVideo: RecentVideo) {
        runBlocking {
            launch(Dispatchers.IO) {
                if (recentVideo.name.isNotEmpty()) {
                    val existingItem = recentList.find { it.name == recentVideo.name && it.path == recentVideo.path }
                    if (existingItem != null) {
                        recentList.remove(existingItem)
                    }
                    // 更新播放日期
                    val newItem = recentVideo.copy(dateTime = LocalDateTime.now().toString())
                    recentList.add(0, newItem)
                    if (recentList.size > 20) {
                        recentList.removeAt(20) // 保持最近列表最多20个
                    }
                    val encodeBuilder = Json {
                        prettyPrint = true
                        encodeDefaults = true
                    }

                    val json = encodeBuilder.encodeToString(recentList.toList())
                   val recentListFile = getRecentVideoFile()
                    if(!recentListFile.parentFile.exists()){
                        recentListFile.parentFile.mkdirs()
                    }
                    recentListFile.writeText(json)
                }
            }
        }
    }

    fun clearRecentList() {
        runBlocking {
            launch(Dispatchers.IO) {
                recentList.clear()
                val encodeBuilder = Json {
                    prettyPrint = true
                    encodeDefaults = true
                }
                val json = encodeBuilder.encodeToString(recentList.toList())
                getRecentVideoFile().writeText(json)
            }
        }
    }

    /** 显示通知消息 */
    fun showNotification(
        message: String,
        type: NotificationType = NotificationType.INFO
    ) {
        notificationJob?.cancel()
        notificationMessage = message
        notificationType = type
        showNotification = true

        // 消息显示时间，信息类消息显示3秒，操作类消息显示1.5秒
        val delay = if(type == NotificationType.INFO) 3000L else 1500L
        notificationJob = CoroutineScope(Dispatchers.Main).launch {
            delay(delay) // 3秒后自动隐藏
            showNotification = false
        }
    }

    /**
     * 从最近播放列表中移除无效视频条目。
     *
     * 从列表中删除指定的视频条目，并将更新后的列表保存到存储文件中。
     *
     * @param invalidItem 要移除的最近播放视频条目。
     */
    fun removeRecentItem(invalidItem: RecentVideo) {
        runBlocking {
            launch (Dispatchers.IO){
                recentList.remove(inval
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/player/danmaku/CanvasDanmakuRenderer.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.player.danmaku

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

/**
 * 基于 Canvas 的弹幕渲染器
 * 第一阶段：实现基础的从右到左移动的弹幕渲染
 */
@Composable
fun CanvasDanmakuRenderer(
    danmakuItems: List<CanvasDanmakuItem>,
    modifier: Modifier = Modifier,
    fontFamily: FontFamily = FontFamily.Default,
    fontSize: Int = 18,
    speed: Float = 3f
) {
    val density = LocalDensity.current
    val textMeasurer = rememberTextMeasurer()
    val textStyle = TextStyle(
        fontSize = fontSize.sp,
        fontFamily = fontFamily
    )

    // 启动动画循环
    LaunchedEffect(danmakuItems) {
        while (isActive) {
            // 更新所有弹幕的位置
            danmakuItems.forEach { item ->
                if (item.isActive) {
                    item.updatePosition(speed)
                    // 测量文字宽度（如果还未测量）
                    if (item.textWidth == 0f) {
                        val measured = textMeasurer.measure(item.text, textStyle)
                        item.textWidth = measured.size.width.toFloat()
                    }

                    // 检查弹幕是否已移出屏幕（静止弹幕由时间控制生命周期）
                    if (item.type == DanmakuType.SCROLL && item.x + item.textWidth < 0) {
                        item.isActive = false
                    }

                }
            }
            delay(16) // ~60 FPS
        }
    }

    Canvas(
        modifier = modifier.fillMaxSize()
    ) {
        drawDanmakuItems(
            danmakuItems = danmakuItems,
            textMeasurer = textMeasurer,
            textStyle = textStyle,
            canvasWidth = size.width
        )
    }
}

/**
 * 在 Canvas 上绘制弹幕项目
 */
private fun DrawScope.drawDanmakuItems(
    danmakuItems: List<CanvasDanmakuItem>,
    textMeasurer: TextMeasurer,
    textStyle: TextStyle,
    canvasWidth: Float
) {
    danmakuItems.forEach { item ->
        if (item.isActive && item.isVisible(canvasWidth)) {
            // 确保文字宽度已经测量
            if (item.textWidth == 0f) {
                val measured = textMeasurer.measure(item.text, textStyle)
                item.textWidth = measured.size.width.toFloat()

                // 对于静止弹幕，重新计算居中位置（仅限顶部和底部弹幕）
                if (item.type == DanmakuType.TOP || item.type == DanmakuType.BOTTOM) {
                    item.x = (canvasWidth - item.textWidth) / 2
                }
                // 标注弹幕保持原始位置，不需要重新计算
            }

            // 绘制完整文字 - 取消 maxLines 限制，让文字在一行内完全显示
            drawText(
                textMeasurer = textMeasurer,
                text = item.text,
                style = textStyle.copy(
                    color = item.color
                ),
                topLeft = androidx.compose.ui.geometry.Offset(item.x, item.y - textStyle.fontSize.toPx()),
                // 移除 maxLines 和 overflow 限制，让文字自然显示
                softWrap = false  // 禁止软换行，强制在一行显示
            )


        }
    }
}

```

### Core Architecture Module: `src/main/kotlin/com/mujingx/player/danmaku/DanmakuStateManager.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.player.danmaku

import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color
import com.mujingx.data.Word
import kotlinx.coroutines.flow.Flow

/**
 * 弹幕状态管理器
 * 管理弹幕的整个生命周期：创建、调度、移除
 */
class DanmakuStateManager {
    // 当前活跃的弹幕列表
    private val _activeDanmakus = mutableStateListOf<CanvasDanmakuItem>()
    val activeDanmakus: List<CanvasDanmakuItem> = _activeDanmakus

    // 弹幕配置
    var isEnabled by mutableStateOf(true)
    var globalOpacity by mutableStateOf(1f)
    var speed by mutableStateOf(3f)
    var maxDanmakuCount by mutableStateOf(50) // 最大同时显示弹幕数

    // Canvas 尺寸
    private var canvasWidth by mutableStateOf(0f)
    private var canvasHeight by mutableStateOf(0f)

    // 字体相关
    private var lineHeight = 30f

    // 轨道管理器
    private val trackManager = TrackManager()

    // 等待队列：没有找到可用轨道的弹幕
    private val waitingQueue = mutableListOf<PendingDanmaku>()

    // 时间轴同步器（可选）
    private var timelineSynchronizer: TimelineSynchronizer? = null

    /**
     * 等待中的弹幕数据类
     */
    private data class PendingDanmaku(
        val text: String,
        val word: Word?,
        val color: Color,
        val type: DanmakuType,
        val addTime: Long = System.currentTimeMillis()
    )

    /**
     * 初始化时间轴同步器
     */
    fun initializeTimelineSync(mediaTimeFlow: Flow<Long>? = null): TimelineSynchronizer {
        if (timelineSynchronizer == null) {
            timelineSynchronizer = TimelineSynchronizer(this)
        }
        return timelineSynchronizer!!
    }

    /**
     * 获取时间轴同步器
     */
    fun getTimelineSynchronizer(): TimelineSynchronizer? = timelineSynchronizer

    /**
     * 设置 Canvas 尺寸
     */
    fun setCanvasSize(width: Float, height: Float) {
        canvasWidth = width
        canvasHeight = height
        trackManager.updateCanvasSize(height, lineHeight)
    }

    /**
     * 设置行高
     */
    fun setLineHeight(lineHeight: Float) {
        this.lineHeight = lineHeight
        trackManager.updateCanvasSize(canvasHeight, lineHeight)
    }

    /**
     * 添加新弹幕
     */
    fun addDanmaku(
        text: String,
        word: Word? = null,
        color: Color = Color.White,
        type: DanmakuType = DanmakuType.SCROLL,
        timeMs: Long? = null // 弹幕的时间戳（可选）
    ) {
        if (!isEnabled || _activeDanmakus.size >= maxDanmakuCount) {
            return
        }

        when (type) {
            DanmakuType.SCROLL -> {
                addScrollDanmaku(text, word, color, timeMs)
            }
            DanmakuType.TOP, DanmakuType.BOTTOM -> {
                addStaticDanmaku(text, word, color, type)
            }
            DanmakuType.ANNOTATION -> {
                // 标注弹幕需要具体位置，这里提供默认位置
                addAnnotationDanmaku(text, canvasWidth * 0.5f, canvasHeight * 0.5f, word, color)
            }
        }
    }

    /**
     * 移除指定的弹幕
     */
    fun removeDanmaku(danmaku: CanvasDanmakuItem) {
        // 从活跃弹幕列表中移除
        val removed = _activeDanmakus.remove(danmaku)

        if (removed) {
            // 释放轨道资源
            trackManager.releaseTrack(danmaku)

            // 标记弹幕为不活跃状态
            danmaku.isActive = false

            // 立即尝试处理等待队列中的弹幕
            processWaitingQueue()
        }
    }

    /**
     * 添加滚动弹幕（使用轨道管理）
     */
    private fun addScrollDanmaku(text: String, word: Word?, color: Color, timeMs: Long? = null) {
        val danmaku = CanvasDanmakuItem(
            text = text,
            word = word,
            color = color,
            type = DanmakuType.SCROLL,
            timeMs = timeMs,
            initialX = canvasWidth,
            initialY = 0f // Y坐标会由轨道管理器设置
        )

        // 尝试分配轨道
        val trackIndex = trackManager.assignTrack(danmaku, canvasWidth)

        if (trackIndex >= 0) {
            // 成功分配轨道，添加到活跃弹幕列表
            _activeDanmakus.add(danmaku)
        } else {
            // 没有可用轨道，加入等待队列
            waitingQueue.add(PendingDanmaku(text, word, color, DanmakuType.SCROLL))

            // 限制等待队列大小，避免内存溢出
            if (waitingQueue.size > 20) {
                waitingQueue.removeAt(0) // 移除最老的等待弹幕
            }
        }
    }

    /**
     * 添加静态弹幕（顶部/底部）
     */
    private fun addStaticDanmaku(text: String, word: Word?, color: Color, type: DanmakuType) {
        val startY = when (type) {
            DanmakuType.TOP -> lineHeight
            DanmakuType.BOTTOM -> canvasHeight - lineHeight
            else -> lineHeight
        }

        // 计算居中位置
        val estimatedTextWidth = text.length * 12f // 粗略估算，实际会在渲染时精确测量
        val centerX = (canvasWidth - estimatedTextWidth) / 2

        val danmaku = CanvasDanmakuItem(
            text = text,
            word = word,
            color = color,
            type = type,
            initialX = centerX,
            initialY = startY
        )

        // 设置显示时长
        danmaku.setDisplayDuration(3000L) // 默认3秒

        _activeDanmakus.add(danmaku)
    }

    /**
     * 添加顶部静止弹幕
     */
    fun addTopDanmaku(
        text: String,
        word: Word? = null,
        color: Color = Color.White,
        durationMs: Long = 3000L
    ) {
        if (!isEnabled || _activeDanmakus.size >= maxDanmakuCount) {
            return
        }

        val estimatedTextWidth = text.length * 12f
        val centerX = (canvasWidth - estimatedTextWidth) / 2

        val danmaku = CanvasDanmakuItem(
            text = text,
            word = word,
            color = color,
            type = DanmakuType.TOP,
            initialX = centerX,
            initialY = lineHeight
        )

        danmaku.setDisplayDuration(durationMs)
        _activeDanmakus.add(danmaku)
    }

    /**
     * 添加底部静止弹幕
     */
    fun addBottomDanmaku(
        text: String,
        word: Word? = null,
        color: Color = Color.White,
        durationMs: Long = 3000L
    ) {
        if (!isEnabled || _activeDanmakus.size >= maxDanmakuCount) {
            return
        }

        val estimatedTextWidth = text.length * 12f
        val centerX = (canvasWidth - estimatedTextWidth) / 2

        val danmaku = CanvasDanmakuItem(
            text = text,
            word = word,
            color = color,
            type = DanmakuType.BOTTOM,
            initialX = centerX,
            initialY = canvasHeight - lineHeight
        )

        danmaku.setDisplayDuration(durationMs)
        _activeDanmakus.add(danmaku)
    }

    /**
     * 添加自定义位置的静止弹幕（用于视频标注）
     */
    fun addAnnotationDanmaku(
        text: String,
        x: Float,
        y: Float,
        word: Word? = null,
        color: Color = Color.White,
        durationMs: Long = 5000L
    ) {
        if (!isEnabled || _activeDanmakus.size >= maxDanmakuCount) {
            return
        }

        val danmaku = CanvasDanmakuItem(
            text = text,
            word = word,
            color = color,
            type = DanmakuType.ANNOTATION,
            initialX = x,
            initialY = y
        )

        danmaku.setDisplayDuration(durationMs)
        _activeDanmakus.add(danmaku)
    }

    /**
     * 添加相对位置的标注弹幕（基于百分比）
     */
    fun addAnnotationDanmakuRelative(
        text: String,
        xPercent: Float, // 0.0-1.0，表示在屏幕宽度的百分比位置
        yPercent: Float, // 0.0-1.0，表示在屏幕高度的百分比位置
        word: Word? = null,
        color: Color = Color.White,
        durationMs: Long = 5000L
    ) {
        val absoluteX = canvasWidth * xPercent
        val absoluteY = canvasHeight * yPercent
        addAnnotationDanmaku(text, absoluteX, absoluteY, word, color, durationMs)
    }

    /**
     * 清理不活跃的弹幕并尝试处理等待队列
     */
    fun cleanup() {
        // 清理不活跃的弹幕
        val removedDanmakus = _activeDanmakus.filter { !it.isActive }
        _activeDanmakus.removeAll { !it.isActive }

        // 释放轨道
        removedDanmakus.forEach { danmaku ->
            trackManager.releaseTrack(danmaku)
        }

        // 清理轨道管理器
        trackManager.cleanup()

        // 尝试处理等待队列中的弹幕
        processWaitingQueue()
    }

    /**
     * 处理等待队列中的弹幕
     */
    private fun processWaitingQueue() {
        if (waitingQueue.isEmpty()) return

        val iterator = waitingQueue.iterator()
        while (iterator.hasNext() && _activeDanmakus.size < maxDanmakuCount) {
            val pending = iterator.next()

            // 检查是否等待时间过长，如果是则丢弃
            if (System.currentTimeMillis() - pending.addTime > 5000) { // 5秒超时
                iterator.remove()
                continue
            }

            // 尝试创建弹幕并分配轨道
            val danmaku = CanvasDanmakuItem(
                text = pending.text,
                word = pending.word,
                color = pending.color,
                type = pending.type,
                initialX = canvasWidth,
                initialY = 0f
            )

            val trackIndex = trackManager.assignTrack(danmaku, canvasWidth)
            if (trackIndex >= 0) {
                // 成功分配，添加到活跃列表并从等待队列移除
                _activeDanmakus.add(danmaku)
                iterator.remove()
            }
        }
    }

    /**
     * 暂停所有弹幕
     */
    fun pauseAll() {
        _activeDanmakus.forEach { it.isPaused = true }
    }

    /**
     * 恢复所有弹幕
     */
    fun resumeAll() {
        _activeDanmakus.forEach { it.isPaused = false }
    }

    /**
     * 根据时间添加弹幕（现在真正实现时间轴同步）
     */
    fun addTimedDanmaku(
        te
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/player/danmaku/InteractiveDanmakuRenderer.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.player.danmaku

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material.Text
import androidx.compose.runtime.*
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.onPointerEvent
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import kotlinx.coroutines.delay
import com.mujingx.player.PlayerState

@OptIn(ExperimentalComposeUiApi::class)
@Composable
fun InteractiveDanmakuRenderer(
    danmakuItems: List<CanvasDanmakuItem>,
    playerState: PlayerState,
    modifier: Modifier = Modifier,
    fontFamily: FontFamily = FontFamily.Default,
    fontSize: Int = 18,
    speed: Float = 3f,
    isPaused: Boolean = false,
    deleteWord: (CanvasDanmakuItem) -> Unit = {},
    addToFamiliar: (CanvasDanmakuItem) -> Unit = {},
    playAudio: (String) -> Unit ={},
    onHoverChanged: (Boolean) -> Unit = {}
) {

    val density = LocalDensity.current
    var hoveredItem by remember { mutableStateOf<CanvasDanmakuItem?>(null) }
    var popupOffset by remember { mutableStateOf(IntOffset.Zero) }

   // 循环动画
    LaunchedEffect(isPaused) {
        while (true) {
            if (!isPaused) {
                danmakuItems.forEach { item ->
                    if (item.isActive && item != hoveredItem) {  // 只有非悬停的弹幕才移动
                        item.x -= speed
                        if (item.x + item.textWidth < 0) {
                            item.isActive = false
                        }
                    }
                }
            }
            delay(16)
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        danmakuItems.forEach { item ->
            if (item.isActive && item != hoveredItem) {
                Text(
                    text = item.text,
                    fontSize = fontSize.sp,
                    color = item.color,
                    fontFamily = fontFamily,
                    modifier = Modifier
                        .offset(
                            x = item.x.dp / LocalDensity.current.density,
                            y = (item.y - fontSize * LocalDensity.current.density).dp / LocalDensity.current.density
                        )
                        .onPointerEvent(PointerEventType.Enter) { event ->
                            hoveredItem = item
                            onHoverChanged(true)
                            // 悬停时固定弹窗位置
                            popupOffset = IntOffset(
                                x = (item.x - 200 * density.density).toInt(), // 向左偏移200dp
                                y = (item.y - fontSize * density.density - 50).toInt()
                            )


                        }
                        .onPointerEvent(PointerEventType.Exit) {
                            hoveredItem = null
                            onHoverChanged(false)
                        }
                )
            }
        }

        if(hoveredItem != null){
            Popup(
                offset = popupOffset,
                onDismissRequest = { hoveredItem = null },
                properties = PopupProperties(
                    focusable = false,
                    dismissOnBackPress = true,
                    dismissOnClickOutside = true
                )
            ) {

                WordDetail(
                    word = hoveredItem?.word!!,
                    playerState =playerState,
                    pointerExit = {hoveredItem = null},
                    height = 350.dp,
                    deleteWord = {
                        deleteWord(hoveredItem!!)
                        hoveredItem = null
                    },
                    addToFamiliar = {
                        addToFamiliar(hoveredItem!!)
                        hoveredItem = null
                    },
                    playAudio = playAudio
                )

            }


        }
    }
}


```

### Core Architecture Module: `src/main/kotlin/com/mujingx/state/AppState.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.state

import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.ExperimentalComposeUiApi
import com.formdev.flatlaf.FlatLightLaf
import com.mujingx.data.RecentItem
import com.mujingx.data.getHardVocabularyFile
import com.mujingx.data.loadMutableVocabulary
import com.mujingx.data.loadMutableVocabularyByName
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.mujingx.player.isLinux
import com.mujingx.player.isMacOS
import com.mujingx.player.isWindows
import com.mujingx.theme.createColors
import com.mujingx.ui.wordscreen.MemoryStrategy
import com.mujingx.ui.wordscreen.WordScreenState
import java.io.File
import java.time.LocalDateTime
import javax.imageio.ImageIO
import javax.swing.JFrame
import javax.swing.JOptionPane

/** 所有界面共享的状态 */
@ExperimentalSerializationApi
class AppState {

    /** 全局状态里需要持久化的状态 */
    var global: GlobalState = loadGlobalState()

    /** Material 颜色 */
    var colors by mutableStateOf(createColors(global))

    /** 一个后台窗口，用于放置 VLC 组件在后台解析字幕列表  */
    var videoPlayerWindow = createVideoPlayerWindow()

    /** 困难词库 */
    var hardVocabulary = loadMutableVocabularyByName("HardVocabulary")

    /** 最近生成的词库列表 */
    var recentList = readRecentList()

    /** 打开侧边栏 */
    var openSidebar by mutableStateOf(false)

    /** 打开设置*/
    var openSettings by mutableStateOf(false)

    /** 是否显示等待窗口 */
    var loadingFileChooserVisible by mutableStateOf(false)

    /** 是否显示【新建词库】窗口 */
    var newVocabulary by  mutableStateOf(false)
    /** 是否显示【编辑词库】窗口 */
    var editVocabulary by  mutableStateOf(false)

    /** 是否显示【合并词库】窗口 */
    var mergeVocabulary by mutableStateOf(false)

    /** 是否显示【过滤词库】窗口 */
    var filterVocabulary by mutableStateOf(false)

    /** 是否显示【导入词库到熟悉词库】窗口 */
    var importFamiliarVocabulary by mutableStateOf(false)

    /** 是否显示【用文档生成词库】窗口 */
    var generateVocabularyFromDocument by mutableStateOf(false)

    /** 是否显示【用字幕文件生成词库】窗口 */
    var generateVocabularyFromSubtitles by mutableStateOf(false)

    /** 是否显示【用视频生成词库】 窗口 */
    var generateVocabularyFromVideo by mutableStateOf(false)

    var showGenerateSrtDialog by mutableStateOf(false)
    var generateSrtVideoPath by mutableStateOf("")

    /** 显示软件更新对话框 */
    var showUpdateDialog by mutableStateOf(false)

    /** 软件的最新版本 */
    var latestVersion by mutableStateOf("")

    /** 版本说明 **/
    var releaseNote by mutableStateOf("")

    /** 下载地址 **/
    var downloadUrl by mutableStateOf("")

    /** 本地缓存的单词发音列表 */
    var localAudioSet = loadAudioSet()

    var vocabularyChanged by mutableStateOf(false)

    /** 加载全局的设置信息 */
    private fun loadGlobalState(): GlobalState {
        val globalSettings = getGlobalSettingsFile()
        return if (globalSettings.exists()) {
            try {
                val decodeFormat = Json { ignoreUnknownKeys = true }
                val globalData = decodeFormat.decodeFromString<GlobalData>(globalSettings.readText())
                GlobalState(globalData)
            } catch (exception: Exception) {
                FlatLightLaf.setup()
                JOptionPane.showMessageDialog(null, "设置信息解析错误，将使用默认设置。\n地址：$globalSettings")
                GlobalState(GlobalData())
            }
        } else {
            GlobalState(GlobalData())
        }
    }


    /** 初始化视频播放窗口 */
    @OptIn(ExperimentalComposeUiApi::class)
    private fun createVideoPlayerWindow(): JFrame {
        val window = JFrame()
        window.title = "视频播放窗口"
        javaClass.getResourceAsStream("/logo/logo.png")?.use { inputStream ->
            val image = ImageIO.read(inputStream)
            window.iconImage = image
        }
        window.isUndecorated = true
        window.isAlwaysOnTop = true
        return window
    }

    /** 保存全局的设置信息 */
    fun saveGlobalState() {
        runBlocking {
            launch (Dispatchers.IO){
                val globalData = GlobalData(
                    global.type,
                    global.isDarkTheme,
                    global.isFollowSystemTheme,
                    global.audioVolume,
                    global.videoVolume,
                    global.keystrokeVolume,
                    global.isPlayKeystrokeSound,
                    global.primaryColor.value,
                    global.backgroundColor.value,
                    global.onBackgroundColor.value,
                    global.wordTextStyle,
                    global.detailTextStyle,
                    global.letterSpacing.value,
                    global.position.x.value,
                    global.position.y.value,
                    global.size.width.value,
                    global.size.height.value,
                    global.placement,
                    global.autoUpdate,
                    global.ignoreVersion,
                    global.bncNum,
                    global.frqNum,
                    global.maxSentenceLength,
                    global.showInputCount
                )
                val json = encodeBuilder.encodeToString(globalData)
                val settings = getGlobalSettingsFile()
                settings.writeText(json)
            }
        }
    }

    /** 改变词库 */
    fun changeVocabulary(
        vocabularyFile: File,
        wordScreenState: WordScreenState,
        index: Int
    ):Boolean {
        val newVocabulary = loadMutableVocabulary(vocabularyFile.absolutePath)
        if(newVocabulary.wordList.size>0){

            wordScreenState.clearInputtedState()
            if(wordScreenState.memoryStrategy == MemoryStrategy.Dictation || wordScreenState.memoryStrategy == MemoryStrategy.DictationTest){
                wordScreenState.memoryStrategy = MemoryStrategy.Normal
                wordScreenState.showInfo()
            }
            // 把困难词库和熟悉词库的索引保存在 wordScreenState.
            when (wordScreenState.vocabulary.name) {
                "HardVocabulary" -> {
                    wordScreenState.hardVocabularyIndex = wordScreenState.index
                }
                "FamiliarVocabulary" -> {
                    wordScreenState.familiarVocabularyIndex = wordScreenState.index
                }
                else -> {
                    // 保存当前词库的索引到最近列表,
                    if(wordScreenState.vocabularyPath.isNotEmpty()){
                        saveToRecentList(wordScreenState.vocabulary.name, wordScreenState.vocabularyPath,wordScreenState.index)
                    }
                }
            }

            wordScreenState.vocabulary = newVocabulary
            wordScreenState.vocabularyName = vocabularyFile.nameWithoutExtension
            wordScreenState.vocabularyPath = vocabularyFile.absolutePath
            wordScreenState.unit = (index / 20) + 1
            wordScreenState.index = index
            vocabularyChanged = true
            wordScreenState.saveWordScreenState()
            return true
        }
        return false
    }

    fun findVocabularyIndex(file:File):Int{
        var index = 0
        for (recentItem in recentList) {
            if(file.absolutePath == recentItem.path){
                index = recentItem.index
            }
        }
        return index
    }

    /** 保存困难词库 */
    fun saveHardVocabulary(){
        runBlocking {
            launch (Dispatchers.IO){
                val json = encodeBuilder.encodeToString(hardVocabulary.serializeVocabulary)
                val file = getHardVocabularyFile()
                file.writeText(json)
            }
        }
    }

    /** 读取最近生成的词库列表 */
    private fun readRecentList(): SnapshotStateList<RecentItem> {
        val recentListFile = getRecentListFile()
        var list = if (recentListFile.exists()) {
            try {
                Json.decodeFromString<List<RecentItem>>(recentListFile.readText())
            } catch (exception: Exception) {
                listOf()
            }

        } else {
            listOf()
        }
        list = list.sortedByDescending { it.time }
        return list.toMutableStateList()
    }

    private fun getRecentListFile(): File {
        val settingsDir = getSettingsDirectory()
        return File(settingsDir, "recentList.json")
    }

    fun saveToRecentList(name: String, path: String,index: Int) {
        runBlocking {
            launch (Dispatchers.IO){
                if(name.isNotEmpty()){
                    val item = RecentItem(LocalDateTime.now().toString(), name, path,index)
                    if (!recentList.contains(item)) {
                        if (recentList.size == 1000) {
                            recentList.removeAt(999)
                        }
                        recentList.add(0, item)
                    } else {
                        recentList.remove(item)
                        recentList.add(0, item)
                    }
                    val serializeList = mutableListOf<RecentItem>()
                    serializeList.addAll(recentList)

                    val json = encodeBuilder.encodeToString(serializeList)
                    val recentListFile = getRecentListFile()
                    rec
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/state/GlobalState.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.state

import androidx.compose.material.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.WindowPlacement
import androidx.compose.ui.window.WindowPosition
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/** 全局的数据类 */
@ExperimentalSerializationApi
@Serializable
data class GlobalData(
    val type: ScreenType = ScreenType.WORD,
    val isDarkTheme: Boolean = true,
    val isFollowSystemTheme: Boolean = false,
    val audioVolume: Float = 0.8F,
    val videoVolume: Float = 80F,
    val keystrokeVolume: Float = 0.75F,
    val isPlayKeystrokeSound: Boolean = false,
    val primaryColorValue: ULong = 18377412168996880384UL,
    val backgroundColorValue:ULong = 18446744069414584320UL,
    val onBackgroundColorValue:ULong = 18374686479671623680UL,
    val wordTextStyle: String = "H2",
    val detailTextStyle: String = "Body1",
    val letterSpacing: Float = 5F,
    val x:Float = 100F,
    val y:Float = 100F,
    val width:Float = 1030F,
    val height:Float = 862F,
    val placement:WindowPlacement = WindowPlacement.Maximized,
    val autoUpdate:Boolean = true,
    val ignoreVersion:String = "",
    val bnc:Int = 1000,
    val frq:Int = 1000,
    val maxSentenceLength:Int = 25,
    val showInputCount:Boolean = true
)

/** 全局状态的需要持久化的部分 */
@OptIn(ExperimentalSerializationApi::class)
class GlobalState(globalData: GlobalData) {
    /**
     * 练习的类型
     */
    var type by mutableStateOf(globalData.type)

    /**
     * 是否是深色模式
     */
    var isDarkTheme by mutableStateOf(globalData.isDarkTheme)

    /**
     * 是否跟随系统主题
     */
    var isFollowSystemTheme by mutableStateOf(globalData.isFollowSystemTheme)

    /**
     * 单词发音的音量
     */
    var audioVolume by mutableStateOf(globalData.audioVolume)

    /**
     * 视频播放的音量
     */
    var videoVolume by mutableStateOf(globalData.videoVolume)

    /**
     * 按键音效音量
     */
    var keystrokeVolume by mutableStateOf(globalData.keystrokeVolume)

    /**
     * 是否播放按键音效
     */
    var isPlayKeystrokeSound by mutableStateOf(globalData.isPlayKeystrokeSound)

    /**
     * 主色调，默认为绿色
     */
    var primaryColor by mutableStateOf(Color(globalData.primaryColorValue))

    /**
     * 浅色主题的背景色
     */
    var backgroundColor by mutableStateOf(Color(globalData.backgroundColorValue))

    /**
     * 浅色主题的背景色
     */
    var onBackgroundColor by mutableStateOf(Color(globalData.onBackgroundColorValue))

    /**
     * 单词的字体样式，需要持久化
     */
    var wordTextStyle by mutableStateOf(globalData.wordTextStyle)

    /**
     * 详细信息的字体样式，需要持久化
     */
    var detailTextStyle by mutableStateOf(globalData.detailTextStyle)

    /**
     * 单词的字体大小，不用持久化
     */
    var wordFontSize by mutableStateOf(TextUnit.Unspecified)

    /**
     * 详细信息的的字体大小，不用持久化
     */
    var detailFontSize by mutableStateOf(TextUnit.Unspecified)

    /**
     *  字间隔空
     */
    var letterSpacing by mutableStateOf((globalData.letterSpacing).sp)

    /**
     * 主窗口的位置
     */
    var position by mutableStateOf(WindowPosition(globalData.x.dp,globalData.y.dp))

    /**
     * 主窗口的尺寸
     */
    var size by mutableStateOf(DpSize(globalData.width.dp,globalData.height.dp))

    /**
     * 描述如何放置窗口在屏幕
     */
    var placement by mutableStateOf(globalData.placement)

    /**
     * 自动检查更新
     */
    var autoUpdate by mutableStateOf(globalData.autoUpdate)

    /**
     * 忽略的版本
     */
    var ignoreVersion by mutableStateOf(globalData.ignoreVersion)

    /**
     * 过滤 BNC 词频最常见的单词数量，默认为 1000
     */
    var bncNum by mutableStateOf(globalData.bnc)

    /**
     * 过滤 COCA 词频最常见的单词数量，默认为 1000
     */
    var frqNum by mutableStateOf(globalData.frq)

    /**
     * 单词所在句子的最大单词数, 默认为 25
     */
    var maxSentenceLength by mutableStateOf(globalData.maxSentenceLength)

    /**
     * 显示输入次数
     */
    var showInputCount by mutableStateOf(globalData.showInputCount)
}
@Composable
 fun computeFontSize(textStyle: String): TextUnit {
   return when(textStyle){
        "H1" ->{
            MaterialTheme.typography.h1.fontSize
        }
        "H2" ->{
            MaterialTheme.typography.h2.fontSize
        }
        "H3" ->{
            MaterialTheme.typography.h3.fontSize
        }
        "H4" ->{
            MaterialTheme.typography.h4.fontSize
        }
        "H5" ->{
            MaterialTheme.typography.h5.fontSize
        }
        "H6" ->{
            MaterialTheme.typography.h6.fontSize
        }
        "Subtitle1" ->{
            MaterialTheme.typography.subtitle1.fontSize
        }
        "Subtitle2" ->{
            MaterialTheme.typography.subtitle2.fontSize
        }
        "Body1" ->{
            MaterialTheme.typography.body1.fontSize
        }
        "Body2" ->{
            MaterialTheme.typography.body2.fontSize
        }
        "Caption" ->{
            MaterialTheme.typography.caption.fontSize
        }
        "Overline" ->{
            MaterialTheme.typography.overline.fontSize
        }
        else ->{ MaterialTheme.typography.h2.fontSize
        }

    }
}

```

### Core Architecture Module: `src/main/kotlin/com/mujingx/state/ScreenType.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.state

enum class ScreenType {
    WORD, SUBTITLES,TEXT
}
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/ui/edit/CellVisibleState.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.ui.edit

import androidx.compose.runtime.*
import com.formdev.flatlaf.FlatLightLaf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.mujingx.state.getSettingsDirectory
import java.io.File
import javax.swing.JOptionPane

@ExperimentalSerializationApi
@Serializable
data class CellVisible(
    var translationVisible: Boolean = true,
    var definitionVisible: Boolean = true,
    var uKPhoneVisible: Boolean = true,
    var usPhoneVisible: Boolean = true,
    var exchangeVisible: Boolean = true,
    var captionsVisible: Boolean = true,
    var sentencesVisible: Boolean = true,
)

@OptIn(ExperimentalSerializationApi::class)
class CellVisibleState(cellVisible: CellVisible){
    var translationVisible by mutableStateOf(cellVisible.translationVisible)
    var definitionVisible by mutableStateOf(cellVisible.definitionVisible)
    var uKPhoneVisible by mutableStateOf(cellVisible.uKPhoneVisible)
    var usPhoneVisible by mutableStateOf(cellVisible.usPhoneVisible)
    var exchangeVisible by mutableStateOf(cellVisible.exchangeVisible)
    var captionsVisible by mutableStateOf(cellVisible.captionsVisible)
    var sentencesVisible by mutableStateOf(cellVisible.sentencesVisible)


    /** 保持列可见性的配置信息 */
    fun saveCellVisibleState() {
        runBlocking {
            launch (Dispatchers.IO){
                val cellVisible = CellVisible(
                    translationVisible,
                    definitionVisible,
                    uKPhoneVisible,
                    usPhoneVisible,
                    exchangeVisible,
                    captionsVisible,
                    sentencesVisible
                )
                val encodeBuilder = Json {
                    prettyPrint = true
                    encodeDefaults = true
                }
                val json = encodeBuilder.encodeToString(cellVisible)
                val typingTextSetting = getCellVisibleFile()
                typingTextSetting.writeText(json)
            }
        }
    }

}
@OptIn(ExperimentalSerializationApi::class)
class CellVisibleSwingState(cellVisible: CellVisible){
    var translationVisible = cellVisible.translationVisible
    var definitionVisible = cellVisible.definitionVisible
    var uKPhoneVisible = cellVisible.uKPhoneVisible
    var usPhoneVisible = cellVisible.usPhoneVisible
    var exchangeVisible = cellVisible.exchangeVisible
    var captionsVisible = cellVisible.captionsVisible
    var sentencesVisible = cellVisible.sentencesVisible
}


/** 用于显示和隐藏列窗口 */
@Composable
fun rememberCellVisibleState():CellVisibleState = remember{
    loadCellVisibleState()
}
@OptIn(ExperimentalSerializationApi::class)
private fun loadCellVisibleState():CellVisibleState{
    val cellVisibleSetting = getCellVisibleFile()
    return if(cellVisibleSetting.exists()){
        try{
            val decodeFormat = Json { ignoreUnknownKeys = true }
            val dataTextState = decodeFormat.decodeFromString<CellVisible>(cellVisibleSetting.readText())
            CellVisibleState(dataTextState)
        }catch (exception:Exception){
            FlatLightLaf.setup()
            JOptionPane.showMessageDialog(null, "设置信息解析错误，将使用默认设置。\n地址：$cellVisibleSetting")
            CellVisibleState(CellVisible())
        }

    }else{
        CellVisibleState(CellVisible())
    }


}

/** 加载编辑词库界面的设置信息 */
@OptIn(ExperimentalSerializationApi::class)
fun loadCellVisibleSwingState():CellVisibleSwingState{
    val cellVisibleSetting = getCellVisibleFile()
    return if(cellVisibleSetting.exists()){
        try{
            val decodeFormat = Json { ignoreUnknownKeys = true }
            val dataTextState = decodeFormat.decodeFromString<CellVisible>(cellVisibleSetting.readText())
            CellVisibleSwingState(dataTextState)
        }catch (exception:Exception){
            FlatLightLaf.setup()
            JOptionPane.showMessageDialog(null, "设置信息解析错误，将使用默认设置。\n地址：$cellVisibleSetting")
            CellVisibleSwingState(CellVisible())
        }

    }else{
        CellVisibleSwingState(CellVisible())
    }
}

/** 获取编辑词库界面的配置文件 */
private fun getCellVisibleFile(): File {
    val settingsDir = getSettingsDirectory()
    return File(settingsDir, "CellVisible.json")
}
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/ui/edit/SearchState.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.ui.edit

import com.formdev.flatlaf.FlatLightLaf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.mujingx.state.getSettingsDirectory
import java.io.File
import javax.swing.JOptionPane

@ExperimentalSerializationApi
@Serializable
data class SearchData(
    val matchCaseIsSelected: Boolean = false,
    val wordsIsSelected: Boolean = false,
    val regexIsSelected: Boolean = false,
    val numberSelected: Boolean = false,
)

@OptIn(ExperimentalSerializationApi::class)
class SearchState (searchState: SearchData){
    var matchCaseIsSelected = searchState.matchCaseIsSelected
    var wordsIsSelected = searchState.wordsIsSelected
    var regexIsSelected = searchState.regexIsSelected
    var numberSelected = searchState.numberSelected

    /**  */
    fun saveSearchState() {
        val encodeBuilder = Json {
            prettyPrint = true
            encodeDefaults = true
        }
        runBlocking {
            launch (Dispatchers.IO){
                val searchState = SearchData(
                    matchCaseIsSelected,
                    wordsIsSelected,
                    regexIsSelected,
                    numberSelected
                )
                val json = encodeBuilder.encodeToString(searchState)
                val searchStateFile = getSearchDataFile()
                searchStateFile.writeText(json)
            }
        }
    }
}

/** 加载编辑词库界面的设置信息 */
@OptIn(ExperimentalSerializationApi::class)
fun loadSearchState():SearchState{
    val cellVisibleSetting = getSearchDataFile()
    return if(cellVisibleSetting.exists()){
        try{
            val decodeFormat = Json { ignoreUnknownKeys = true }
            val searchData = decodeFormat.decodeFromString<SearchData>(cellVisibleSetting.readText())
            SearchState(searchData)
        }catch (exception:Exception){
            FlatLightLaf.setup()
            JOptionPane.showMessageDialog(null, "设置信息解析错误，将使用默认设置。\n地址：$cellVisibleSetting")
            SearchState(SearchData())
        }

    }else{
        SearchState(SearchData())
    }
}

/**   */
private fun getSearchDataFile(): File {
    val settingsDir = getSettingsDirectory()
    return File(settingsDir, "SearchState.json")
}
```

### Core Architecture Module: `src/main/kotlin/com/mujingx/ui/subtitlescreen/SubtitlesState.kt`
```
/*
 * Copyright (c) 2023-2025 tang shimin
 *
 * This file is part of MuJing.
 *
 * MuJing is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * MuJing is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with MuJing. If not, see <https://www.gnu.org/licenses/>.
 */

package com.mujingx.ui.subtitlescreen

import androidx.compose.runtime.*
import com.formdev.flatlaf.FlatLightLaf
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.mujingx.state.getSettingsDirectory
import java.awt.Rectangle
import java.io.File
import javax.swing.JOptionPane

/** 抄写单词的数据类 */
@ExperimentalSerializationApi
@Serializable
data class DataSubtitlesState(
    val videoPath: String = "",
    val subtitlesPath: String = "",
    val trackID: Int = 0,
    val trackDescription: String = "",
    val trackSize: Int = 0,
    val currentIndex: Int = 0,
    val firstVisibleItemIndex: Int = 0,
    var sentenceMaxLength: Int = 0,
    var transcriptionCaption: Boolean = false,
    var currentCaptionVisible: Boolean = true,
    var notWroteCaptionVisible: Boolean = true,
    var externalSubtitlesVisible: Boolean = true,
    var videoX:Int = 0,
    var videoY:Int = 0,
    var videoWidth:Int = 0,
    var videoHeight:Int = 0,
)

/** 抄写单词的可观察状态 */
@OptIn(ExperimentalSerializationApi::class)
class SubtitlesState(dataSubtitlesState: DataSubtitlesState) {

    /**
     * 抄写字幕时的媒体文件，支持的格式： mp3、aac、wav、mp4、mkv，
     * 因为最开始只支持 mkv,要向后兼容，就没有改数据类的变量名
     */
    var mediaPath by mutableStateOf(dataSubtitlesState.videoPath)

    /** 抄写字幕时的字幕文件的路径 */
    var subtitlesPath by mutableStateOf(dataSubtitlesState.subtitlesPath)

    /** 抄写字幕时的字幕的轨道 ID,
     *  如果等于 -1 表示不使用内置的轨道，
     *  而是使用外部的字幕。
     */
    var trackID by mutableStateOf(dataSubtitlesState.trackID)

    /** 选择的字幕名称  */
    var trackDescription by mutableStateOf(dataSubtitlesState.trackDescription)

    /** 字幕轨道的数量  */
    var trackSize by mutableStateOf(dataSubtitlesState.trackSize)

    /** 抄写字幕的索引  */
    var currentIndex by mutableStateOf(dataSubtitlesState.currentIndex)

    /** 抄写字幕时屏幕顶部的行索引  */
    var firstVisibleItemIndex by mutableStateOf(dataSubtitlesState.firstVisibleItemIndex)

    /** 字幕的最大长度，用来计算字幕的宽度，限制最大值为 100 防止布局崩溃  */
    var sentenceMaxLength by mutableStateOf(dataSubtitlesState.sentenceMaxLength.coerceAtMost(100))

    /** 是否抄写字幕 */
    var transcriptionCaption by mutableStateOf(dataSubtitlesState.transcriptionCaption)

    /** 当前字幕的可见性 */
    var currentCaptionVisible by mutableStateOf(dataSubtitlesState.currentCaptionVisible)

    /** 未抄写字幕的可见性 */
    var notWroteCaptionVisible by mutableStateOf(dataSubtitlesState.notWroteCaptionVisible)

    /** 外部字幕的可见性 */
    var externalSubtitlesVisible by mutableStateOf(dataSubtitlesState.externalSubtitlesVisible)

    /** 视频播放器的大小和位置 */
    var videoBounds by mutableStateOf(
    Rectangle(
        dataSubtitlesState.videoX,
        dataSubtitlesState.videoY,
        dataSubtitlesState.videoWidth,
        dataSubtitlesState.videoHeight)
    )

    /** 通知消息 */
    var notificationMessage by mutableStateOf("")

    /** 是否显示通知 */
    var showNotification by mutableStateOf(false)

    /** 通知任务 */
    private var notificationJob: kotlinx.coroutines.Job? = null

    /**
     * 显示通知消息
     * @param message 通知消息内容
     * @param duration 显示时长（毫秒），默认3秒
     */
    fun showNotification(message: String, duration: Long = 3000L) {
        notificationJob?.cancel()
        notificationMessage = message
        showNotification = true

        notificationJob = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
            kotlinx.coroutines.delay(duration)
            showNotification = false
        }
    }

    /** 保存抄写字幕的配置信息 */
    fun saveTypingSubtitlesState() {
        runBlocking {
            launch (Dispatchers.IO){
                val dataSubtitlesState = DataSubtitlesState(
                    mediaPath,
                    subtitlesPath,
                    trackID,
                    trackDescription,
                    trackSize,
                    currentIndex,
                    firstVisibleItemIndex,
                    sentenceMaxLength.coerceAtMost(100), // 限制最大值为 100，防止保存异常数据
                    transcriptionCaption,
                    currentCaptionVisible,
                    notWroteCaptionVisible,
                    externalSubtitlesVisible,
                    videoBounds.x,
                    videoBounds.y,
                    videoBounds.width,
                    videoBounds.height
                )
                val encodeBuilder = Json {
                    prettyPrint = true
                    encodeDefaults = true
                }
                val json = encodeBuilder.encodeToString(dataSubtitlesState)
                val typingSubtitlesSetting = getSubtitlesSettingsFile()
                typingSubtitlesSetting.writeText(json)
            }
        }
    }

}


@Composable
fun rememberSubtitlesState(): SubtitlesState = remember{
    loadSubtitlesState()
}

/** 加载抄写字幕的配置信息 */
@OptIn(ExperimentalSerializationApi::class)
private fun loadSubtitlesState(): SubtitlesState {
    val typingSubtitlesSetting = getSubtitlesSettingsFile()
    return if (typingSubtitlesSetting.exists()) {
        try {
            val decodeFormat = Json { ignoreUnknownKeys = true }
            val dataSubtitlesState = decodeFormat.decodeFromString<DataSubtitlesState>(typingSubtitlesSetting.readText())
            SubtitlesState(dataSubtitlesState)
        } catch (exception: Exception) {
            FlatLightLaf.setup()
            JOptionPane.showMessageDialog(null, "设置信息解析错误，将使用默认设置。\n地址：$typingSubtitlesSetting")
            SubtitlesState(DataSubtitlesState())
        }
    } else {
        SubtitlesState(DataSubtitlesState())
    }
}

/** 获取抄写字幕的配置文件 */
private fun getSubtitlesSettingsFile(): File {
    val settingsDir = getSettingsDirectory()
    return File(settingsDir, "TypingSubtitlesSettings.json")
}
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #104** (2025-12-03): **困难词库中，拼写部分单词后取消标记时，若已拼写的单词长度超过下一个单词，则会产生“超出边界错误”**
  *Symptoms*: **稳定复现该BUG**  如图： 已拼写的单词长度为7，下一个单词的长度为6，此时“Ctrl+I”取消标记，则会产生“超出边界错误”。  已拼写的单词长度为7 <img width="1920" height="1020" alt="Image" src="https://github.com/user-attachments/assets/d04b7bc7-3089-4a1a-ada4-003fb06094a2" /> 下一个单词长度为6 <img width="1920" height="1020" alt="Image" src="https://github.com/user-attachments/assets/419fa757-caab-4b46-b870-49e2c00353c5" /> “Ctrl+I”取消标记，产生“超出边界错误” <img width="1920" height="1020" alt="Image" src="https://github.com/user-attachments/assets/fd8e2435-e754-4351-999a-6f8f337312e1" />
  **Post-Mortem & Fix Analysis**:
  > 最新版修复了这个问题

- **Issue #103** (2025-12-03): **在幕境使用了本地文件选择器后，在其它应用移动鼠标时，可能会出现文件名称提示**
  *Symptoms*: 就像在文件选择器鼠标移动到一个文件后，出现的文件名提示。 出现在 macOS ，windows 还没有测试。

- **Issue #101** (2025-12-03): **生成词库时，先选择过滤词库，再按【开始】，选择的词库会被清除**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 先点击【开始】再选择过滤的词库就没事 

- **Issue #99** (2025-12-03): **使用视频播放器时，添加外部字幕.srt无法正常显示**
  *Symptoms*:    字幕文件可以正常提取词库，但在使用视频播放器的时候，导入字幕文件无法显示字幕，同时按钮栏会多出一行显示 关闭字幕 选项。
  **Post-Mortem & Fix Analysis**:
  > 添加字幕后那个显示字幕的区域没有更新，向下滑动就可以看到刚刚添加的字幕了。

- **Issue #98** (2025-12-03): **Error on startup**
  *Symptoms*: <img width="545" height="166" alt="Image" src="https://github.com/user-attachments/assets/fcf04ace-3955-4c95-86c7-bf67b33cf1a5" />
  **Post-Mortem & Fix Analysis**:
  > 刚开始能启动，用了一段时间之后才出现的这种情况吗 
  > 你还记得你做了什么操作之后就无法启动了吗 
  > 是的，第一次安装可以启动，打开了一个srt文件后就报错了，把那个srt文件删掉后，又可以正常启动了。现在已经好了。

- **Issue #96** (2025-12-03): **在 macOS 保存词库失败**
  *Symptoms*: 如果词库的文件名的最后一个字符是 `]` ，比如 `fileName[tv].json` 将无法保存词库。这是 Swing JFileChooser 的 bug。 暂时的解决方法是把最后一个字符 `]` 删掉，删掉就可以保存，如果确实需要可以在保存词库后再重命名。

- **Issue #84** (2025-08-27): **优化 macOS 端的交互**
  *Symptoms*: - [x] 快捷键不符合苹果的交互习惯，应该吧 Control 键改成 Command 键 - [x] 取消菜单栏的快捷字母 - [x] [修复FFmpeg 动态库缺失](https://github.com/tangshimin/MuJing/issues/81) - [x]  优化记忆单词界面的视频播放 - [x]  优化字幕浏览器 - [x]  优化视频播放器 

- **Issue #83** (2025-02-16): **发现问题：使用文档生成词库时选择还原单词形式以后导出没有例句**
  *Symptoms*: 在使用文档生成词库时，选择将单词的形式还原后，导出的词库中没有例句，考虑因为小说的例句中的单词多为过去式和进行式，是否可以修复该功能，感谢！
  **Post-Mortem & Fix Analysis**:
  > 复现了确实是 bug，处理词形还原的时候没有处理例句
  > 我会尽快修复
  > 修复版本已经发布了，你可以下载最新版试一下。[Github 下载地址](https://github.com/tangshimin/MuJing/releases/tag/v2.6.12)

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

### Incident Patch 1: `a65a3834` (2025-12-02)
**Commit Message**: 优化 Build Package.yml 中的 macOS 支持和 artifacts 字段，简化文件匹配规则

**File**: `.github/workflows/Build Package.yml` (modified, +6/-4)
```diff
@@ -12,15 +12,15 @@ jobs:
     runs-on: ${{ matrix.os }}
     strategy:
       matrix:
-        os: [ windows-latest, macos-15, macos-latest ]
+        os: [ windows-latest, macos-15-intel, macos-latest ]
         include:
           - os: windows-latest
             arch: x64
             name: Windows x86_64
             packageTask: light
             artifactPath: build/compose/binaries/main/app/*.msi
             artifactName: windows-package-x64
-          - os: macos-15
+          - os: macos-15-intel
             arch: x64
             name: macOS x86_64
             packageTask: packageDmg
@@ -90,6 +90,8 @@ jobs:
           if ($version -eq "" -or $version -eq "refs/heads/main") {
             $version = (Get-Content gradle.properties | Select-String "version=" | ForEach-Object { $_.ToString().Split('=')[1].Trim() })
           }
+          # 去掉 v 前缀
+          $version = $version -replace '^v', ''
           # 统一命名为 MuJing-版本号.zip
           $zipFile = "build/compose/binaries/main/app/MuJing-$version.zip"
           Write-Host "Creating portable package: $zipFile"
@@ -150,5 +152,5 @@ jobs:
             - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-x64.dmg)
             - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-aarch64.dmg)
           artifactErrorsFailBuild: false # 如果某个附件找不到，不要让整个 workflow 失败
-          # 使用 artifacts 字段上传文件
-          artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"
+          # 使用 artifacts 字段上传文件 - 使用通配符匹配所有文件
+          artifacts: "artifacts/**/*.msi,artifacts/**/*.zip,artifacts/**/*.dmg"
```

---

### Incident Patch 2: `faa7adc0` (2025-12-02)
**Commit Message**: 优化 Build Package.yml 中的版本号处理，简化 token 生成步骤

**File**: `.github/workflows/Build Package.yml` (modified, +10/-13)
```diff
@@ -119,21 +119,18 @@ jobs:
     permissions:
       contents: write
     steps:
-      - name: Generate a token
-        id: generate-token
-        uses: actions/create-github-app-token@v2
-        with:
-          app-id: ${{ vars.APP_ID }}
-          private-key: ${{ secrets.APP_PRIVATE_KEY }}
-
       - name: Download all artifacts
         uses: actions/download-artifact@v4
         with:
           path: artifacts/
 
       - name: Get Tag
         id: get_tag
-        run: echo "TAG=${{ github.ref_name }}" >> $GITHUB_ENV
+        run: |
+          TAG=${{ github.ref_name }}
+          VERSION=${TAG#v}  # 去掉 v 前缀，得到纯版本号
+          echo "TAG=$TAG" >> $GITHUB_ENV
+          echo "VERSION=$VERSION" >> $GITHUB_ENV
 
       - name: Draft Release
         uses: ncipollo/release-action@v1
@@ -143,15 +140,15 @@ jobs:
           generateReleaseNotes: false
           name: ${{ env.TAG }} # 设置 Release 的标题为 Tag 名称
           tag: ${{ env.TAG }}
-          token: ${{ steps.generate-token.outputs.token }}
+          token: ${{ secrets.GITHUB_TOKEN }}
           body: |
             ---
             ### Windows 版本下载
-            - [Windows 安装包 (MSI)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}.msi)
-            - [Windows 绿色版 (ZIP)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}.zip)
+            - [Windows 安装包 (MSI)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}.msi)
+            - [Windows 绿色版 (ZIP)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}.zip)
             ### macOS 版本下载
-            - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-x64.dmg)
-            - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-aarch64.dmg)
+            - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-x64.dmg)
+            - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.VERSION }}-aarch64.dmg)
           artifactErrorsFailBuild: false # 如果某个附件找不到，不要让整个 workflow 失败
           # 使用 artifacts 字段上传文件
           artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"
```

---

### Incident Patch 3: `13492355` (2025-12-02)
**Commit Message**: 优化 Build Package.yml 中的 artifacts 字段格式以支持文件上传

**File**: `.github/workflows/Build Package.yml` (modified, +2/-6)
```diff
@@ -153,9 +153,5 @@ jobs:
             - [macOS x86_64 Intel 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-x64.dmg)
             - [macOS aarch64 M 芯片(DMG)](https://github.com/${{ github.repository }}/releases/download/${{ env.TAG }}/MuJing-${{ env.TAG }}-aarch64.dmg)
           artifactErrorsFailBuild: false # 如果某个附件找不到，不要让整个 workflow 失败
-          # 'assets' 字段需要是多行字符串格式
-          assets: |
-            artifacts/windows-package-x64/*.msi:MuJing-${{ env.TAG }}.msi
-            artifacts/windows-package-portable-x64/*.zip:MuJing-${{ env.TAG }}.zip
-            artifacts/macos-package-x64/*.dmg:MuJing-${{ env.TAG }}-x64.dmg
-            artifacts/macos-package-aarch64/*.dmg:MuJing-${{ env.TAG }}-aarch64.dmg
+          # 使用 artifacts 字段上传文件
+          artifacts: "artifacts/windows-package-x64/*.msi,artifacts/windows-package-portable-x64/*.zip,artifacts/macos-package-x64/*.dmg,artifacts/macos-package-aarch64/*.dmg"
```

---

### Incident Patch 4: `895a7b0b` (2025-10-01)
**Commit Message**: 更新 Build FFmpeg for MacOS.yml

**File**: `.github/workflows/Build FFmpeg for MacOS.yml` (modified, +16/-3)
```diff
@@ -54,9 +54,22 @@ jobs:
           echo "Installed static libraries:"
           find "${PREFIX}/lib" -name "*.a" | sort
           
-          # 验证 pkg-config
-          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper || { echo 'whisper.pc validation failed'; exit 1; }
-          echo "Whisper version: $(PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper)"
+          # 创建正确的 whisper.pc 文件（解决版本问题的关键修复）
+          PC_FILE="${PREFIX}/lib/pkgconfig/whisper.pc"
+          mkdir -p "${PREFIX}/lib/pkgconfig"
+          cat > "$PC_FILE" << EOF
+          prefix=${PREFIX}
+          exec_prefix=\${prefix}
+          libdir=\${exec_prefix}/lib
+          includedir=\${prefix}/include
+
+          Name: whisper
+          Description: Port of OpenAI's Whisper model in C/C++
+          Version: 1.8.0
+          Libs: -L\${libdir} -lwhisper -lggml -lggml-cpu -lggml-blas -lggml-metal -lggml-base
+          Libs.private: -framework Accelerate -framework Metal -framework Foundation -lc++
+          Cflags: -I\${includedir}
+          EOF
 
       - name: Configure FFmpeg (with whisper support)
         run: |
```

---

### Incident Patch 5: `02c09804` (2025-10-01)
**Commit Message**: 更新 Build FFmpeg for MacOS.yml

**File**: `.github/workflows/Build FFmpeg for MacOS.yml` (modified, +12/-56)
```diff
@@ -50,68 +50,24 @@ jobs:
           cmake --build . --config Release -j ${NPROC}
           cmake --install .
           
-          # 验证只有静态库被安装
-          echo "--- Installed libraries ---"
-          find "${PREFIX}/lib" -name "*.a" -o -name "*.dylib" -o -name "*.so" | sort
+          # 验证安装
+          echo "Installed static libraries:"
+          find "${PREFIX}/lib" -name "*.a" | sort
           
-          # 确保没有动态库
-          if find "${PREFIX}/lib" -name "*.dylib" -o -name "*.so" | head -1 | grep -q .; then
-            echo "ERROR: Found dynamic libraries, but we want static only!"
-            exit 1
-          fi
-          
-          PC_DIR="${PREFIX}/lib/pkgconfig"
-          mkdir -p "$PC_DIR"
-          
-          # FFmpeg configure 期望的是 "whisper" 包名，不是 "libwhisper"
-          # 同时版本需要 >= 1.7.5
-          if [ ! -f "$PC_DIR/whisper.pc" ]; then
-            printf '%s\n' \
-              'prefix=${pcfiledir}/../..' \
-              'exec_prefix=${prefix}' \
-              'libdir=${exec_prefix}/lib' \
-              'includedir=${prefix}/include' \
-              '' \
-              'Name: whisper' \
-              'Description: whisper.cpp inference library' \
-              'Version: 1.8.0' \
-              'Libs: -L${libdir} -lwhisper -lggml' \
-              'Libs.private: -framework Accelerate -lc++' \
-              'Cflags: -I${includedir}' \
-              > "$PC_DIR/whisper.pc"
-          fi
-          
-          # 同时创建 libwhisper.pc 作为备用（某些工具可能需要）
-          if [ ! -f "$PC_DIR/libwhisper.pc" ]; then
-            printf '%s\n' \
-              'prefix=${pcfiledir}/../..' \
-              'exec_prefix=${prefix}' \
-              'libdir=${exec_prefix}/lib' \
-              'includedir=${prefix}/include' \
-              '' \
-              'Name: libwhisper' \
-              'Description: whisper.cpp inference library' \
-              'Version: 1.8.0' \
-              'Libs: -L${libdir} -lwhisper -lggml' \
-              'Libs.private: -framework Accelerate -lc++' \
-              'Cflags: -I${includedir}' \
-              > "$PC_DIR/libwhisper.pc"
-          fi
-          
-          echo '--- Validating pkg-config ---'
+          # 验证 pkg-config
           PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper || { echo 'whisper.pc validation failed'; exit 1; }
-          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --cflags whisper
-          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --libs --static whisper
-          echo "Whisper version reported: $(PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper)"
+          echo "Whisper version: $(PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper)"
 
-      - name: Configure FFmpeg (detect whisper support)
+      - name: Configure FFmpeg (with whisper support)
         run: |
           set -euo pipefail
           cd ffmpeg
           PREFIX="$GITHUB_WORKSPACE/local"
           export PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
-          EXTRA_CFLAGS="-I${PREFIX}/include"
-          EXTRA_LDFLAGS="-L${PREFIX}/lib"
+          
+          # 验证 whisper 可用
+          pkg-config --exists whisper || { echo 'whisper package not found'; exit 1; }
+          
           ./configure --disable-everything \
             --disable-ffprobe \
             --enable-ffmpeg \
@@ -148,8 +104,8 @@ jobs:
             --enable-decoder=mp3 \
             --enable-decoder=aac \
             --pkg-config-flags="--static" \
-            --extra-cflags="$EXTRA_CFLAGS" \
-            --extra-ldflags="$EXTRA_LDFLAGS -framework Accelerate"
+            --extra-cflags="-I${PREFIX}/include" \
+            --extra-ldflags="-L${PREFIX}/lib -framework Accelerate"
 
       - name: Build & Install FFmpeg
         run: |
```

---

### Incident Patch 6: `6dc720c1` (2025-10-01)
**Commit Message**: 更新 Build FFmpeg for MacOS.yml

**File**: `.github/workflows/Build FFmpeg for MacOS.yml` (modified, +25/-5)
```diff
@@ -62,8 +62,27 @@ jobs:
           
           PC_DIR="${PREFIX}/lib/pkgconfig"
           mkdir -p "$PC_DIR"
+          
+          # FFmpeg configure 期望的是 "whisper" 包名，不是 "libwhisper"
+          # 同时版本需要 >= 1.7.5
+          if [ ! -f "$PC_DIR/whisper.pc" ]; then
+            printf '%s\n' \
+              'prefix=${pcfiledir}/../..' \
+              'exec_prefix=${prefix}' \
+              'libdir=${exec_prefix}/lib' \
+              'includedir=${prefix}/include' \
+              '' \
+              'Name: whisper' \
+              'Description: whisper.cpp inference library' \
+              'Version: 1.8.0' \
+              'Libs: -L${libdir} -lwhisper -lggml' \
+              'Libs.private: -framework Accelerate -lc++' \
+              'Cflags: -I${includedir}' \
+              > "$PC_DIR/whisper.pc"
+          fi
+          
+          # 同时创建 libwhisper.pc 作为备用（某些工具可能需要）
           if [ ! -f "$PC_DIR/libwhisper.pc" ]; then
-            # 创建 pkg-config 文件，确保包含所有必要的静态链接标志
             printf '%s\n' \
               'prefix=${pcfiledir}/../..' \
               'exec_prefix=${prefix}' \
@@ -72,17 +91,18 @@ jobs:
               '' \
               'Name: libwhisper' \
               'Description: whisper.cpp inference library' \
-              'Version: 1.0' \
+              'Version: 1.8.0' \
               'Libs: -L${libdir} -lwhisper -lggml' \
               'Libs.private: -framework Accelerate -lc++' \
               'Cflags: -I${includedir}' \
               > "$PC_DIR/libwhisper.pc"
           fi
           
           echo '--- Validating pkg-config ---'
-          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion libwhisper || { echo 'libwhisper.pc validation failed'; exit 1; }
-          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --cflags libwhisper
-          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --libs --static libwhisper
+          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper || { echo 'whisper.pc validation failed'; exit 1; }
+          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --cflags whisper
+          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --libs --static whisper
+          echo "Whisper version reported: $(PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion whisper)"
 
       - name: Configure FFmpeg (detect whisper support)
         run: |
```

---

### Incident Patch 7: `e5a24142` (2025-10-01)
**Commit Message**: 更新 Build FFmpeg for MacOS.yml

**File**: `.github/workflows/Build FFmpeg for MacOS.yml` (modified, +24/-5)
```diff
@@ -30,7 +30,7 @@ jobs:
           git clone https://git.ffmpeg.org/ffmpeg.git ffmpeg
           cd ffmpeg
 
-      - name: Clone & Build whisper.cpp (libwhisper static)
+      - name: Clone & Build whisper.cpp (static only)
         run: |
           set -euo pipefail
           PREFIX="$GITHUB_WORKSPACE/local"
@@ -43,14 +43,27 @@ jobs:
                 -DWHISPER_BUILD_TESTS=OFF \
                 -DWHISPER_BUILD_EXAMPLES=OFF \
                 -DWHISPER_BUILD_SHARED_LIB=OFF \
+                -DGGML_SHARED=OFF \
                 -DWHISPER_NO_ACCELERATE=OFF \
+                -DBUILD_SHARED_LIBS=OFF \
                 ..
           cmake --build . --config Release -j ${NPROC}
           cmake --install .
+          
+          # 验证只有静态库被安装
+          echo "--- Installed libraries ---"
+          find "${PREFIX}/lib" -name "*.a" -o -name "*.dylib" -o -name "*.so" | sort
+          
+          # 确保没有动态库
+          if find "${PREFIX}/lib" -name "*.dylib" -o -name "*.so" | head -1 | grep -q .; then
+            echo "ERROR: Found dynamic libraries, but we want static only!"
+            exit 1
+          fi
+          
           PC_DIR="${PREFIX}/lib/pkgconfig"
           mkdir -p "$PC_DIR"
           if [ ! -f "$PC_DIR/libwhisper.pc" ]; then
-            # 使用 printf 逐行写入，避免 heredoc 里冒号被某些 YAML 校验器误解析
+            # 创建 pkg-config 文件，确保包含所有必要的静态链接标志
             printf '%s\n' \
               'prefix=${pcfiledir}/../..' \
               'exec_prefix=${prefix}' \
@@ -60,12 +73,18 @@ jobs:
               'Name: libwhisper' \
               'Description: whisper.cpp inference library' \
               'Version: 1.0' \
-              'Libs: -L${libdir} -lwhisper' \
+              'Libs: -L${libdir} -lwhisper -lggml' \
+              'Libs.private: -framework Accelerate -lc++' \
               'Cflags: -I${includedir}' \
               > "$PC_DIR/libwhisper.pc"
           fi
+          
+          echo '--- Validating pkg-config ---'
+          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --modversion libwhisper || { echo 'libwhisper.pc validation failed'; exit 1; }
+          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --cflags libwhisper
+          PKG_CONFIG_PATH="${PREFIX}/lib/pkgconfig" pkg-config --libs --static libwhisper
 
-      - name: Configure FFmpeg (minimal + subtitles + whisper)
+      - name: Configure FFmpeg (detect whisper support)
         run: |
           set -euo pipefail
           cd ffmpeg
@@ -110,7 +129,7 @@ jobs:
             --enable-decoder=aac \
             --pkg-config-flags="--static" \
             --extra-cflags="$EXTRA_CFLAGS" \
-            --extra-ldflags="$EXTRA_LDFLAGS"
+            --extra-ldflags="$EXTRA_LDFLAGS -framework Accelerate"
 
       - name: Build & Install FFmpeg
         run: |
```

---

### Incident Patch 8: `4c5ff87d` (2025-10-01)
**Commit Message**: 更新 Build FFmpeg for MacOS.yml

**File**: `.github/workflows/Build FFmpeg for MacOS.yml` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ jobs:
             --enable-static \
             --disable-shared \
             --disable-autodetect \
-            --enable-libwhisper \
+            --enable-whisper \
             --enable-filter=whisper \
             --enable-decoder=srt \
             --enable-decoder=movtext \
```

---

### Incident Patch 9: `29ff55f9` (2025-09-22)
**Commit Message**: 重构 build.gradle.kts

**File**: `build.gradle.kts` (modified, +28/-27)
```diff
@@ -7,32 +7,6 @@ import java.nio.file.Files
 import org.gradle.api.tasks.Exec
 import java.io.File
 
-// 解析 cargo 路径（优先级：-PcargoPath > CARGO 环境变量 > 常见安装路径列表 > PATH 中的 cargo）
-fun resolveCargoPath(): String {
-    // 允许通过 -PcargoPath 显式指定
-    val propPath = (project.findProperty("cargoPath") as String?)?.trim()?.takeIf { it.isNotEmpty() }
-    if (propPath != null && File(propPath).canExecute()) return propPath
-
-    // 允许通过环境变量 CARGO 指定
-    val envCargo = System.getenv("CARGO")?.trim()?.takeIf { it.isNotEmpty() }
-    if (envCargo != null && File(envCargo).canExecute()) return envCargo
-
-    val home = System.getProperty("user.home") ?: System.getenv("HOME") ?: ""
-    val candidates = buildList {
-        if (home.isNotEmpty()) add("$home/.cargo/bin/cargo")
-        // macOS Homebrew
-        add("/opt/homebrew/bin/cargo")
-        // 常见 Linux/macOS 路径
-        add("/usr/local/bin/cargo")
-        add("/usr/bin/cargo")
-    }
-    val hit = candidates.firstOrNull { File(it).canExecute() }
-    if (hit != null) return hit
-
-    // 回退到 PATH 中的 cargo（若存在）
-    return "cargo"
-}
-
 plugins {
     // 版本设置在 settings.gradle.kts 的 plugins 块中
     // kotlin
@@ -329,4 +303,31 @@ fun decompressDict(input: File, destination: File) {
             }
         }
     }
-}
\ No newline at end of file
+}
+
+
+// 解析 cargo 路径（优先级：-PcargoPath > CARGO 环境变量 > 常见安装路径列表 > PATH 中的 cargo）
+fun resolveCargoPath(): String {
+    // 允许通过 -PcargoPath 显式指定
+    val propPath = (project.findProperty("cargoPath") as String?)?.trim()?.takeIf { it.isNotEmpty() }
+    if (propPath != null && File(propPath).canExecute()) return propPath
+
+    // 允许通过环境变量 CARGO 指定
+    val envCargo = System.getenv("CARGO")?.trim()?.takeIf { it.isNotEmpty() }
+    if (envCargo != null && File(envCargo).canExecute()) return envCargo
+
+    val home = System.getProperty("user.home") ?: System.getenv("HOME") ?: ""
+    val candidates = buildList {
+        if (home.isNotEmpty()) add("$home/.cargo/bin/cargo")
+        // macOS Homebrew
+        add("/opt/homebrew/bin/cargo")
+        // 常见 Linux/macOS 路径
+        add("/usr/local/bin/cargo")
+        add("/usr/bin/cargo")
+    }
+    val hit = candidates.firstOrNull { File(it).canExecute() }
+    if (hit != null) return hit
+
+    // 回退到 PATH 中的 cargo（若存在）
+    return "cargo"
+}
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
