# Forensic Learning Record (Deep Inspection): xinnan-tech/xiaozhi-esp32-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/xinnan-tech-xiaozhi-esp32-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xinnan-tech/xiaozhi-esp32-server](https://github.com/xinnan-tech/xiaozhi-esp32-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:08.425Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xinnan-tech/xiaozhi-esp32-server`
- **Description**: 本项目为xiaozhi-esp32提供后端服务，帮助您快速搭建ESP32设备控制服务器。Backend service for xiaozhi-esp32, helps you quickly build an ESP32 device control server.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10734 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `main/digital-human/js/core/audio/opus-codec.js`
```
import { log } from '../../utils/logger.js?v=0205';


// 检查Opus库是否已加载
export function checkOpusLoaded() {
    try {
        // 检查Module是否存在（本地库导出的全局变量）
        if (typeof Module === 'undefined') {
            throw new Error('Opus库未加载，Module对象不存在');
        }

        // 尝试先使用Module.instance（libopus.js最后一行导出方式）
        if (typeof Module.instance !== 'undefined' && typeof Module.instance._opus_decoder_get_size === 'function') {
            // 使用Module.instance对象替换全局Module对象
            window.ModuleInstance = Module.instance;
            log('Opus库加载成功（使用Module.instance）', 'success');

            // 3秒后隐藏状态
            const statusElement = document.getElementById('scriptStatus');
            if (statusElement) statusElement.style.display = 'none';
            return;
        }

        // 如果没有Module.instance，检查全局Module函数
        if (typeof Module._opus_decoder_get_size === 'function') {
            window.ModuleInstance = Module;
            log('Opus库加载成功（使用全局Module）', 'success');

            // 3秒后隐藏状态
            const statusElement = document.getElementById('scriptStatus');
            if (statusElement) statusElement.style.display = 'none';
            return;
        }

        throw new Error('Opus解码函数未找到，可能Module结构不正确');
    } catch (err) {
        log(`Opus库加载失败，请检查libopus.js文件是否存在且正确: ${err.message}`, 'error');
    }
}


// 创建一个Opus编码器
let opusEncoder = null;
export function initOpusEncoder() {
    try {
        if (opusEncoder) {
            return opusEncoder; // 已经初始化过
        }

        if (!window.ModuleInstance) {
            log('无法创建Opus编码器：ModuleInstance不可用', 'error');
            return;
        }

        // 初始化一个Opus编码器
        const mod = window.ModuleInstance;
        const sampleRate = 16000; // 16kHz采样率
        const channels = 1;       // 单声道
        const application = 2048; // OPUS_APPLICATION_VOIP = 2048

        // 创建编码器
        opusEncoder = {
            channels: channels,
            sampleRate: sampleRate,
            frameSize: 960, // 60ms @ 16kHz = 60 * 16 = 960 samples
            maxPacketSize: 4000, // 最大包大小
            module: mod,

            // 初始化编码器
            init: function () {
                try {
                    // 获取编码器大小
                    const encoderSize = mod._opus_encoder_get_size(this.channels);
                    log(`Opus编码器大小: ${encoderSize}字节`, 'info');

                    // 分配内存
                    this.encoderPtr = mod._malloc(encoderSize);
                    if (!this.encoderPtr) {
                        throw new Error("无法分配编码器内存");
                    }

                    // 初始化编码器
                    const err = mod._opus_encoder_init(
                        this.encoderPtr,
                        this.sampleRate,
                        this.channels,
                        application
                    );

                    if (err < 0) {
                        throw new Error(`Opus编码器初始化失败: ${err}`);
                    }

                    // 设置位率 (16kbps)
                    mod._opus_encoder_ctl(this.encoderPtr, 4002, 16000); // OPUS_SET_BITRATE

                    // 设置复杂度 (0-10, 越高质量越好但CPU使用越多)
                    mod._opus_encoder_ctl(this.encoderPtr, 4010, 5);     // OPUS_SET_COMPLEXITY

                    // 设置使用DTX (不传输静音帧)
                    mod._opus_encoder_ctl(this.encoderPtr, 4016, 1);     // OPUS_SET_DTX

                    log("Opus编码器初始化成功", 'success');
                    return true;
                } catch (error) {
                    if (this.encoderPtr) {
                        mod._free(this.encoderPtr);
                        this.encoderPtr = null;
                    }
                    log(`Opus编码器初始化失败: ${error.message}`, 'error');
                    return false;
                }
            },

            // 编码PCM数据为Opus
            encode: function (pcmData) {
                if (!this.encoderPtr) {
                    if (!this.init()) {
                        return null;
                    }
                }

                try {
                    const mod = this.module;

                    // 为PCM数据分配内存
                    const pcmPtr = mod._malloc(pcmData.length * 2); // 2字节/int16

                    // 将PCM数据复制到HEAP
                    for (let i = 0; i < pcmData.length; i++) {
                        mod.HEAP16[(pcmPtr >> 1) + i] = pcmData[i];
                    }

                    // 为输出分配内存
                    const outPtr = mod._malloc(this.maxPacketSize);

                    // 进行编码
                    const encodedLen = mod._opus_encode(
                        this.encoderPtr,
                        pcmPtr,
                        this.frameSize,
                        outPtr,
                        this.maxPacketSize
                    );

                    if (encodedLen < 0) {
                        throw new Error(`Opus编码失败: ${encodedLen}`);
                    }

                    // 复制编码后的数据
                    const opusData = new Uint8Array(encodedLen);
                    for (let i = 0; i < encodedLen; i++) {
                        opusData[i] = mod.HEAPU8[outPtr + i];
                    }

                    // 释放内存
                    mod._free(pcmPtr);
                    mod._free(outPtr);

                    return opusData;
                } catch (error) {
                    log(`Opus编码出错: ${error.message}`, 'error');
                    return null;
                }
            },

            // 销毁编码器
            destroy: function () {
                if (this.encoderPtr) {
                    this.module._free(this.encoderPtr);
                    this.encoderPtr = null;
                }
            }
        };

        opusEncoder.init();
        return opusEncoder;
    } catch (error) {
        log(`创建Opus编码器失败: ${error.message}`, 'error');
        return false;
    }
}
```

### Core Architecture Module: `main/digital-human/js/core/audio/player.js`
```
// 音频播放模块
import BlockingQueue from '../../utils/blocking-queue.js?v=0205';
import { log } from '../../utils/logger.js?v=0205';
import { createStreamingContext } from './stream-context.js?v=0205';

// 音频播放器类
export class AudioPlayer {
    constructor() {
        // 音频参数
        this.SAMPLE_RATE = 16000;
        this.CHANNELS = 1;
        this.FRAME_SIZE = 960;
        this.MIN_AUDIO_DURATION = 0.12;

        // 状态
        this.audioContext = null;
        this.opusDecoder = null;
        this.streamingContext = null;
        this.queue = new BlockingQueue();
        this.isPlaying = false;
    }

    // 获取或创建AudioContext
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.SAMPLE_RATE,
                latencyHint: 'interactive'
            });
            log('创建音频上下文，采样率: ' + this.SAMPLE_RATE + 'Hz', 'debug');
        }
        return this.audioContext;
    }

    // 初始化Opus解码器
    async initOpusDecoder() {
        if (this.opusDecoder) return this.opusDecoder;

        try {
            if (typeof window.ModuleInstance === 'undefined') {
                if (typeof Module !== 'undefined') {
                    window.ModuleInstance = Module;
                    log('使用全局Module作为ModuleInstance', 'info');
                } else {
                    throw new Error('Opus库未加载，ModuleInstance和Module对象都不存在');
                }
            }

            const mod = window.ModuleInstance;

            this.opusDecoder = {
                channels: this.CHANNELS,
                rate: this.SAMPLE_RATE,
                frameSize: this.FRAME_SIZE,
                module: mod,
                decoderPtr: null,

                init: function () {
                    if (this.decoderPtr) return true;

                    const decoderSize = mod._opus_decoder_get_size(this.channels);
                    log(`Opus解码器大小: ${decoderSize}字节`, 'debug');

                    this.decoderPtr = mod._malloc(decoderSize);
                    if (!this.decoderPtr) {
                        throw new Error("无法分配解码器内存");
                    }

                    const err = mod._opus_decoder_init(
                        this.decoderPtr,
                        this.rate,
                        this.channels
                    );

                    if (err < 0) {
                        this.destroy();
                        throw new Error(`Opus解码器初始化失败: ${err}`);
                    }

                    log("Opus解码器初始化成功", 'success');
                    return true;
                },

                decode: function (opusData) {
                    if (!this.decoderPtr) {
                        if (!this.init()) {
                            throw new Error("解码器未初始化且无法初始化");
                        }
                    }

                    try {
                        const mod = this.module;

                        const opusPtr = mod._malloc(opusData.length);
                        mod.HEAPU8.set(opusData, opusPtr);

                        const pcmPtr = mod._malloc(this.frameSize * 2);

                        const decodedSamples = mod._opus_decode(
                            this.decoderPtr,
                            opusPtr,
                            opusData.length,
                            pcmPtr,
                            this.frameSize,
                            0
                        );

                        if (decodedSamples < 0) {
                            mod._free(opusPtr);
                            mod._free(pcmPtr);
                            throw new Error(`Opus解码失败: ${decodedSamples}`);
                        }

                        const decodedData = new Int16Array(decodedSamples);
                        for (let i = 0; i < decodedSamples; i++) {
                            decodedData[i] = mod.HEAP16[(pcmPtr >> 1) + i];
                        }

                        mod._free(opusPtr);
                        mod._free(pcmPtr);

                        return decodedData;
                    } catch (error) {
                        log(`Opus解码错误: ${error.message}`, 'error');
                        return new Int16Array(0);
                    }
                },

                destroy: function () {
                    if (this.decoderPtr) {
                        this.module._free(this.decoderPtr);
                        this.decoderPtr = null;
                    }
                }
            };

            if (!this.opusDecoder.init()) {
                throw new Error("Opus解码器初始化失败");
            }

            return this.opusDecoder;

        } catch (error) {
            log(`Opus解码器初始化失败: ${error.message}`, 'error');
            this.opusDecoder = null;
            throw error;
        }
    }

    // 启动音频缓冲
    async startAudioBuffering() {
        log("开始音频缓冲...", 'info');

        this.initOpusDecoder().catch(error => {
            log(`预初始化Opus解码器失败: ${error.message}`, 'warning');
        });

        const timeout = 400;
        while (true) {
            const packets = await this.queue.dequeue(
                6,
                timeout,
                (count) => {
                    log(`缓冲超时，当前缓冲包数: ${count}，开始播放`, 'info');
                }
            );
            if (packets.length) {
                log(`已缓冲 ${packets.length} 个音频包，开始播放`, 'info');
                this.streamingContext.pushAudioBuffer(packets);
            }

            while (true) {
                const data = await this.queue.dequeue(99, 30);
                if (data.length) {
                    this.streamingContext.pushAudioBuffer(data);
                } else {
                    break;
                }
            }
        }
    }

    // 播放已缓冲的音频
    async playBufferedAudio() {
        try {
            this.audioContext = this.getAudioContext();

            if (!this.opusDecoder) {
                log('初始化Opus解码器...', 'info');
                try {
                    this.opusDecoder = await this.initOpusDecoder();
                    if (!this.opusDecoder) {
                        throw new Error('解码器初始化失败');
                    }
                    log('Opus解码器初始化成功', 'success');
                } catch (error) {
                    log('Opus解码器初始化失败: ' + error.message, 'error');
                    this.isPlaying = false;
                    return;
                }
            }

            if (!this.streamingContext) {
                this.streamingContext = createStreamingContext(
                    this.opusDecoder,
                    this.audioContext,
                    this.SAMPLE_RATE,
                    this.CHANNELS,
                    this.MIN_AUDIO_DURATION
                );
            }

            this.streamingContext.decodeOpusFrames();
            this.streamingContext.startPlaying();

        } catch (error) {
            log(`播放已缓冲的音频出错: ${error.message}`, 'error');
            this.isPlaying = false;
            this.streamingContext = null;
        }
    }

    // 添加音频数据到队列
    enqueueAudioData(opusData) {
        if (opusData.length > 0) {
            this.queue.enqueue(opusData);
        } else {
            log('收到空音频数据帧，可能是结束标志', 'warning');
            if (this.isPlaying && this.streamingContext) {
                this.streamingContext.endOfStream = true;
            }
        }
    }

    // 预加载解码器
    async preload() {
        log('预加载Opus解码器...', 'info');
        try {
            await this.initOpusDecoder();
            log('Opus解码器预加载成功', 'success');
        } catch (error) {
            log(`Opus解码器预加载失败: ${error.message}，将在需要时重试`, 'warning');
        }
    }

    // 启动播放系统
    async start() {
        await this.preload();
        this.playBufferedAudio();
        this.startAudioBuffering();
    }

    // 获取音频包统计信息
    getAudioStats() {
        if (!this.streamingContext) {
            return {
                pendingDecode: 0,
                pendingPlay: 0,
                totalPending: 0
            };
        }

        const pendingDecode = this.streamingContext.getPendingDecodeCount();
        const pendingPlay = this.streamingContext.getPendingPlayCount();

        return {
            pendingDecode,  // 待解码包数
            pendingPlay,    // 待播放包数
            totalPending: pendingDecode + pendingPlay  // 总待处理包数
        };
    }

    // 清空所有音频缓冲并停止播放
    clearAllAudio() {
        log('AudioPlayer: 清空所有音频', 'info');

        // 清空接收队列（使用clear方法保持对象引用）
        this.queue.clear();

        // 清空流上下文的所有缓冲
        if (this.streamingContext) {
            this.streamingContext.clearAllBuffers();
        }

        log('AudioPlayer: 音频已清空', 'success');
    }
}

// 创建单例
let audioPlayerInstance = null;

export function getAudioPlayer() {
    if (!audioPlayerInstance) {
        audioPlayerInstance = new AudioPlayer();
    }
    return audioPlayerInstance;
}

```

### Core Architecture Module: `main/digital-human/js/core/audio/recorder.js`
```
// Audio recording module
import { log } from '../../utils/logger.js?v=0205';
import { initOpusEncoder } from './opus-codec.js?v=0205';
import { getAudioPlayer } from './player.js?v=0205';

// Audio recorder class
export class AudioRecorder {
    constructor() {
        this.isRecording = false;
        this.audioContext = null;
        this.analyser = null;
        this.audioProcessor = null;
        this.audioProcessorType = null;
        this.audioSource = null;
        this.opusEncoder = null;
        this.pcmDataBuffer = new Int16Array();
        this.audioBuffers = [];
        this.totalAudioSize = 0;
        this.visualizationRequest = null;
        this.recordingTimer = null;
        this.websocket = null;
        // Callback functions
        this.onRecordingStart = null;
        this.onRecordingStop = null;
        this.onVisualizerUpdate = null;
    }

    // Set WebSocket instance
    setWebSocket(ws) {
        this.websocket = ws;
    }

    // Get AudioContext instance
    getAudioContext() {
        return getAudioPlayer().getAudioContext();
    }

    // Initialize encoder
    initEncoder() {
        if (!this.opusEncoder) {
            this.opusEncoder = initOpusEncoder();
        }
        return this.opusEncoder;
    }

    // PCM processor code
    getAudioProcessorCode() {
        return `
            class AudioRecorderProcessor extends AudioWorkletProcessor {
                constructor() {
                    super();
                    this.buffers = [];
                    this.frameSize = 960;
                    this.buffer = new Int16Array(this.frameSize);
                    this.bufferIndex = 0;
                    this.isRecording = false;
                    this.port.onmessage = (event) => {
                        if (event.data.command === 'start') {
                            this.isRecording = true;
                            this.port.postMessage({ type: 'status', status: 'started' });
                        } else if (event.data.command === 'stop') {
                            this.isRecording = false;
                            if (this.bufferIndex > 0) {
                                const finalBuffer = this.buffer.slice(0, this.bufferIndex);
                                this.port.postMessage({ type: 'buffer', buffer: finalBuffer });
                                this.bufferIndex = 0;
                            }
                            this.port.postMessage({ type: 'status', status: 'stopped' });
                        }
                    };
                }
                process(inputs, outputs, parameters) {
                    if (!this.isRecording) return true;
                    const input = inputs[0][0];
                    if (!input) return true;
                    for (let i = 0; i < input.length; i++) {
                        if (this.bufferIndex >= this.frameSize) {
                            this.port.postMessage({ type: 'buffer', buffer: this.buffer.slice(0) });
                            this.bufferIndex = 0;
                        }
                        this.buffer[this.bufferIndex++] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 32767)));
                    }
                    return true;
                }
            }
            registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
        `;
    }

    // Create audio processor
    async createAudioProcessor() {
        this.audioContext = this.getAudioContext();
        try {
            if (this.audioContext.audioWorklet) {
                const blob = new Blob([this.getAudioProcessorCode()], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                await this.audioContext.audioWorklet.addModule(url);
                URL.revokeObjectURL(url);
                const audioProcessor = new AudioWorkletNode(this.audioContext, 'audio-recorder-processor');
                audioProcessor.port.onmessage = (event) => {
                    if (event.data.type === 'buffer') {
                        this.processPCMBuffer(event.data.buffer);
                    }
                };
                log('使用AudioWorklet处理音频', 'success');
                const silent = this.audioContext.createGain();
                silent.gain.value = 0;
                audioProcessor.connect(silent);
                silent.connect(this.audioContext.destination);
                return { node: audioProcessor, type: 'worklet' };
            } else {
                log('AudioWorklet不可用，使用ScriptProcessorNode作为后备方案', 'warning');
                return this.createScriptProcessor();
            }
        } catch (error) {
            log(`创建音频处理器失败: ${error.message}，尝试后备方案`, 'error');
            return this.createScriptProcessor();
        }
    }

    // Create ScriptProcessor as fallback
    createScriptProcessor() {
        try {
            const frameSize = 4096;
            const scriptProcessor = this.audioContext.createScriptProcessor(frameSize, 1, 1);
            scriptProcessor.onaudioprocess = (event) => {
                if (!this.isRecording) return;
                const input = event.inputBuffer.getChannelData(0);
                const buffer = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    buffer[i] = Math.max(-32768, Math.min(32767, Math.floor(input[i] * 32767)));
                }
                this.processPCMBuffer(buffer);
            };
            const silent = this.audioContext.createGain();
            silent.gain.value = 0;
            scriptProcessor.connect(silent);
            silent.connect(this.audioContext.destination);
            log('使用ScriptProcessorNode作为后备方案成功', 'warning');
            return { node: scriptProcessor, type: 'processor' };
        } catch (fallbackError) {
            log(`后备方案也失败: ${fallbackError.message}`, 'error');
            return null;
        }
    }

    // Process PCM buffer data
    processPCMBuffer(buffer) {
        if (!this.isRecording) return;
        const newBuffer = new Int16Array(this.pcmDataBuffer.length + buffer.length);
        newBuffer.set(this.pcmDataBuffer);
        newBuffer.set(buffer, this.pcmDataBuffer.length);
        this.pcmDataBuffer = newBuffer;
        const samplesPerFrame = 960;
        while (this.pcmDataBuffer.length >= samplesPerFrame) {
            const frameData = this.pcmDataBuffer.slice(0, samplesPerFrame);
            this.pcmDataBuffer = this.pcmDataBuffer.slice(samplesPerFrame);
            this.encodeAndSendOpus(frameData);
        }
    }

    // Encode and send Opus data
    encodeAndSendOpus(pcmData = null) {
        if (!this.opusEncoder) {
            log('Opus编码器未初始化', 'error');
            return;
        }
        try {
            if (pcmData) {
                const opusData = this.opusEncoder.encode(pcmData);
                if (opusData && opusData.length > 0) {
                    this.audioBuffers.push(opusData.buffer);
                    this.totalAudioSize += opusData.length;
                    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                        try {
                            this.websocket.send(opusData.buffer);
                        } catch (error) {
                            log(`WebSocket发送错误: ${error.message}`, 'error');
                        }
                    }
                } else {
                    log('Opus编码失败，未返回有效数据', 'error');
                }
            } else {
                if (this.pcmDataBuffer.length > 0) {
                    const samplesPerFrame = 960;
                    if (this.pcmDataBuffer.length < samplesPerFrame) {
                        const paddedBuffer = new Int16Array(samplesPerFrame);
                        paddedBuffer.set(this.pcmDataBuffer);
                        this.encodeAndSendOpus(paddedBuffer);
                    } else {
                        this.encodeAndSendOpus(this.pcmDataBuffer.slice(0, samplesPerFrame));
                    }
                    this.pcmDataBuffer = new Int16Array(0);
                }
            }
        } catch (error) {
            log(`Opus编码错误: ${error.message}`, 'error');
        }
    }

    // Start recording
    async start() {
        if (this.isRecording) return false;
        try {
            if (!this.initEncoder()) {
                log('无法开始录音: Opus编码器初始化失败', 'error');
                return false;
            }
            log('请至少录制1-2秒音频以确保收集足够的数据', 'info');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000, channelCount: 1 } });
            this.audioContext = this.getAudioContext();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            const processorResult = await this.createAudioProcessor();
            if (!processorResult) {
                log('无法创建音频处理器', 'error');
                return false;
            }
            this.audioProcessor = processorResult.node;
            this.audioProcessorType = processorResult.type;
            this.audioSource = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.audioSource.connect(this.analyser);
            this.audioSource.connect(this.audioProcessor);
            this.pcmDataBuffer = new Int16Array();
            this.audioBuffers = [];
            this.totalAudioSize = 0;
            this.isRecording = true;
            if (this.audioProcessorType === 'worklet' && this.audioProcessor.port) {
                this.audioProcessor.port.postMessage({ command: 'start' });
            }
            // Send listening start message
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                log(`已发送录音开始消息`
```

### Core Architecture Module: `main/digital-human/js/core/audio/stream-context.js`
```
import BlockingQueue from '../../utils/blocking-queue.js?v=0205';
import { log } from '../../utils/logger.js?v=0205';

// 音频流播放上下文类
export class StreamingContext {
    constructor(opusDecoder, audioContext, sampleRate, channels, minAudioDuration) {
        this.opusDecoder = opusDecoder;
        this.audioContext = audioContext;

        // 音频参数
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.minAudioDuration = minAudioDuration;

        // 初始化队列和状态
        this.queue = [];          // 已解码的PCM队列。正在播放
        this.activeQueue = new BlockingQueue(); // 已解码的PCM队列。准备播放
        this.pendingAudioBufferQueue = [];  // 待处理的缓存队列
        this.audioBufferQueue = new BlockingQueue();  // 缓存队列
        this.playing = false;     // 是否正在播放
        this.endOfStream = false; // 是否收到结束信号
        this.source = null;       // 当前音频源
        this.totalSamples = 0;    // 累积的总样本数
        this.lastPlayTime = 0;    // 上次播放的时间戳
        this.scheduledEndTime = 0; // 已调度音频的结束时间

        // 初始化分析器节点（供Live2D使用）
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
    }

    // 缓存音频数组
    pushAudioBuffer(item) {
        this.audioBufferQueue.enqueue(...item);
    }

    // 获取需要处理缓存队列，单线程：在audioBufferQueue一直更新的状态下不会出现安全问题
    async getPendingAudioBufferQueue() {
        // 等待数据到达并获取
        const data = await this.audioBufferQueue.dequeue();
        // 赋值给待处理队列
        this.pendingAudioBufferQueue = data;
    }

    // 获取正在播放已解码的PCM队列，单线程：在activeQueue一直更新的状态下不会出现安全问题
    async getQueue(minSamples) {
        const num = minSamples - this.queue.length > 0 ? minSamples - this.queue.length : 1;

        // 等待数据并获取
        const tempArray = await this.activeQueue.dequeue(num);
        this.queue.push(...tempArray);
    }

    // 将Int16音频数据转换为Float32音频数据
    convertInt16ToFloat32(int16Data) {
        const float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
            // 将[-32768,32767]范围转换为[-1,1]，统一使用32768.0避免不对称失真
            float32Data[i] = int16Data[i] / 32768.0;
        }
        return float32Data;
    }

    // 获取待解码包数
    getPendingDecodeCount() {
        return this.audioBufferQueue.length + this.pendingAudioBufferQueue.length;
    }

    // 获取待播放样本数（转换为包数，每包960样本）
    getPendingPlayCount() {
        // 计算已在队列中的样本
        const queuedSamples = this.activeQueue.length + this.queue.length;

        // 计算已调度但未播放的样本（在Web Audio缓冲区中）
        let scheduledSamples = 0;
        if (this.playing && this.scheduledEndTime) {
            const currentTime = this.audioContext.currentTime;
            const remainingTime = Math.max(0, this.scheduledEndTime - currentTime);
            scheduledSamples = Math.floor(remainingTime * this.sampleRate);
        }

        const totalSamples = queuedSamples + scheduledSamples;
        return Math.ceil(totalSamples / 960);
    }

    // 清空所有音频缓冲
    clearAllBuffers() {
        log('清空所有音频缓冲', 'info');

        // 清空所有队列（使用clear方法保持对象引用）
        this.audioBufferQueue.clear();
        this.pendingAudioBufferQueue = [];
        this.activeQueue.clear();
        this.queue = [];

        // 停止当前播放的音频源
        if (this.source) {
            try {
                this.source.stop();
                this.source.disconnect();
            } catch (e) {
                // 忽略已经停止的错误
            }
            this.source = null;
        }

        // 重置状态
        this.playing = false;
        this.scheduledEndTime = this.audioContext.currentTime;
        this.totalSamples = 0;

        log('音频缓冲已清空', 'success');
    }

    // 获取分析器节点（供Live2D使用）
    getAnalyser() {
        return this.analyser;
    }

    // 将Opus数据解码为PCM
    async decodeOpusFrames() {
        if (!this.opusDecoder) {
            log('Opus解码器未初始化，无法解码', 'error');
            return;
        } else {
            log('Opus解码器启动', 'info');
        }

        while (true) {
            let decodedSamples = [];
            for (const frame of this.pendingAudioBufferQueue) {
                try {
                    // 使用Opus解码器解码
                    const frameData = this.opusDecoder.decode(frame);
                    if (frameData && frameData.length > 0) {
                        // 转换为Float32
                        const floatData = this.convertInt16ToFloat32(frameData);
                        // 使用循环替代展开运算符
                        for (let i = 0; i < floatData.length; i++) {
                            decodedSamples.push(floatData[i]);
                        }
                    }
                } catch (error) {
                    log("Opus解码失败: " + error.message, 'error');
                }
            }

            if (decodedSamples.length > 0) {
                // 使用循环替代展开运算符
                for (let i = 0; i < decodedSamples.length; i++) {
                    this.activeQueue.enqueue(decodedSamples[i]);
                }
                this.totalSamples += decodedSamples.length;
            } else {
                log('没有成功解码的样本', 'warning');
            }
            await this.getPendingAudioBufferQueue();
        }
    }

    // 开始播放音频
    async startPlaying() {
        this.scheduledEndTime = this.audioContext.currentTime; // 跟踪已调度音频的结束时间

        while (true) {
            // 初始缓冲：等待足够的样本再开始播放
            const minSamples = this.sampleRate * this.minAudioDuration * 2;
            if (!this.playing && this.queue.length < minSamples) {
                await this.getQueue(minSamples);
            }
            this.playing = true;

            // 持续播放队列中的音频，每次播放一个小块
            while (this.playing && this.queue.length > 0) {
                // 每次播放120ms的音频（2个Opus包）
                const playDuration = 0.12;
                const targetSamples = Math.floor(this.sampleRate * playDuration);
                const actualSamples = Math.min(this.queue.length, targetSamples);

                if (actualSamples === 0) break;

                const currentSamples = this.queue.splice(0, actualSamples);
                const audioBuffer = this.audioContext.createBuffer(this.channels, currentSamples.length, this.sampleRate);
                audioBuffer.copyToChannel(new Float32Array(currentSamples), 0);

                // 创建音频源
                this.source = this.audioContext.createBufferSource();
                this.source.buffer = audioBuffer;

                // 精确调度播放时间
                const currentTime = this.audioContext.currentTime;
                const startTime = Math.max(this.scheduledEndTime, currentTime);

                // 连接到分析器和输出
                this.source.connect(this.analyser);
                this.source.connect(this.audioContext.destination);

                log(`调度播放 ${currentSamples.length} 个样本，约 ${(currentSamples.length / this.sampleRate).toFixed(2)} 秒`, 'debug');
                this.source.start(startTime);

                // 更新下一个音频块的调度时间
                const duration = audioBuffer.duration;
                this.scheduledEndTime = startTime + duration;
                this.lastPlayTime = startTime;

                // 如果队列中数据不足，等待新数据
                if (this.queue.length < targetSamples) {
                    break;
                }
            }

            // 等待新数据
            await this.getQueue(minSamples);
        }
    }
}

// 创建streamingContext实例的工厂函数
export function createStreamingContext(opusDecoder, audioContext, sampleRate, channels, minAudioDuration) {
    return new StreamingContext(opusDecoder, audioContext, sampleRate, channels, minAudioDuration);
}
```

### Core Architecture Module: `main/digital-human/js/core/mcp/tools.js`
```
import { log } from '../../utils/logger.js?v=0205';

// ==========================================
// MCP 工具管理逻辑
// ==========================================

// 全局变量
let mcpTools = [];
let mcpEditingIndex = null;
let mcpProperties = [];
let websocket = null; // 将从外部设置

/**
 * 设置 WebSocket 实例
 * @param {WebSocket} ws - WebSocket 连接实例
 */
export function setWebSocket(ws) {
    websocket = ws;
}

/**
 * 初始化 MCP 工具
 */
export async function initMcpTools() {
    // 加载默认工具数据
    const defaultMcpTools = await fetch("js/config/default-mcp-tools.json").then(res => res.json());
    const savedTools = localStorage.getItem('mcpTools');
    if (savedTools) {
        try {
            const parsedTools = JSON.parse(savedTools);
            // 合并默认工具和用户保存的工具，保留用户自定义的工具
            const defaultToolNames = new Set(defaultMcpTools.map(t => t.name));
            // 添加默认工具中不存在的新工具
            parsedTools.forEach(tool => {
                if (!defaultToolNames.has(tool.name)) {
                    defaultMcpTools.push(tool);
                }
            });
            mcpTools = defaultMcpTools;
        } catch (e) {
            log('加载MCP工具失败，使用默认工具', 'warning');
            mcpTools = [...defaultMcpTools];
        }
    } else {
        mcpTools = [...defaultMcpTools];
    }
    renderMcpTools();
    setupMcpEventListeners();
}

/**
 * 渲染工具列表
 */
function renderMcpTools() {
    const container = document.getElementById('mcpToolsContainer');
    const countSpan = document.getElementById('mcpToolsCount');
    if (!container) {
        return; // Container not found, skip rendering
    }
    if (countSpan) {
        countSpan.textContent = `${mcpTools.length} 个工具`;
    }
    if (mcpTools.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #999;">暂无工具，点击下方按钮添加新工具</div>';
        return;
    }
    container.innerHTML = mcpTools.map((tool, index) => {
        const paramCount = tool.inputSchema.properties ? Object.keys(tool.inputSchema.properties).length : 0;
        const requiredCount = tool.inputSchema.required ? tool.inputSchema.required.length : 0;
        const hasMockResponse = tool.mockResponse && Object.keys(tool.mockResponse).length > 0;
        return `
            <div class="mcp-tool-card">
                <div class="mcp-tool-header">
                    <div class="mcp-tool-name">${tool.name}</div>
                    <div class="mcp-tool-actions">
                        <button class="mcp-edit-btn" onclick="window.mcpModule.editMcpTool(${index})">
                            ✏️ 编辑
                        </button>
                        <button class="mcp-delete-btn" onclick="window.mcpModule.deleteMcpTool(${index})">
                            🗑️ 删除
                        </button>
                    </div>
                </div>
                <div class="mcp-tool-description">${tool.description}</div>
                <div class="mcp-tool-info">
                    <div class="mcp-tool-info-row">
                        <span class="mcp-tool-info-label">参数数量:</span>
                        <span class="mcp-tool-info-value">${paramCount} 个 ${requiredCount > 0 ? `(${requiredCount} 个必填)` : ''}</span>
                    </div>
                    <div class="mcp-tool-info-row">
                        <span class="mcp-tool-info-label">模拟返回:</span>
                        <span class="mcp-tool-info-value">${hasMockResponse ? '✅ 已配置: ' + JSON.stringify(tool.mockResponse) : '⚪ 使用默认'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 渲染参数列表
 */
function renderMcpProperties() {
    const container = document.getElementById('mcpPropertiesContainer');
    const emptyState = document.getElementById('mcpEmptyState');
    if (!container) {
        return; // Container not found, skip rendering
    }
    if (mcpProperties.length === 0) {
        if (emptyState) {
            emptyState.style.display = 'block';
        }
        container.innerHTML = '';
        return;
    }
    if (emptyState) {
        emptyState.style.display = 'none';
    }
    container.innerHTML = mcpProperties.map((prop, index) => `
        <div class="mcp-property-card" onclick="window.mcpModule.editMcpProperty(${index})">
            <div class="mcp-property-row-label">
                <span class="mcp-property-label">参数名称</span>
                <span class="mcp-property-value">${prop.name}${prop.required ? ' <span class="mcp-property-required-badge">[必填]</span>' : ''}</span>
            </div>
            <div class="mcp-property-row-label">
                <span class="mcp-property-label">数据类型</span>
                <span class="mcp-property-value">${getTypeLabel(prop.type)}</span>
            </div>
            <div class="mcp-property-row-label">
                <span class="mcp-property-label">描述</span>
                <span class="mcp-property-value">${prop.description || '-'}</span>
            </div>
            <div class="mcp-property-row-action">
                <button class="mcp-property-delete-btn" onclick="event.stopPropagation(); window.mcpModule.deleteMcpProperty(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

/**
 * 获取数据类型标签
 */
function getTypeLabel(type) {
    const typeMap = {
        'string': '字符串',
        'integer': '整数',
        'number': '数字',
        'boolean': '布尔值',
        'array': '数组',
        'object': '对象'
    };
    return typeMap[type] || type;
}

/**
 * 添加参数 - 打开参数编辑模态框
 */
function addMcpProperty() {
    openPropertyModal();
}

/**
 * 编辑参数 - 打开参数编辑模态框
 */
function editMcpProperty(index) {
    openPropertyModal(index);
}

/**
 * 打开参数编辑模态框
 */
function openPropertyModal(index = null) {
    const form = document.getElementById('mcpPropertyForm');
    const title = document.getElementById('mcpPropertyModalTitle');
    document.getElementById('mcpPropertyIndex').value = index !== null ? index : -1;

    if (index !== null) {
        const prop = mcpProperties[index];
        title.textContent = '编辑参数';
        document.getElementById('mcpPropertyName').value = prop.name;
        document.getElementById('mcpPropertyType').value = prop.type || 'string';
        document.getElementById('mcpPropertyMinimum').value = prop.minimum !== undefined ? prop.minimum : '';
        document.getElementById('mcpPropertyMaximum').value = prop.maximum !== undefined ? prop.maximum : '';
        document.getElementById('mcpPropertyDescription').value = prop.description || '';
        document.getElementById('mcpPropertyRequired').checked = prop.required || false;
    } else {
        title.textContent = '添加参数';
        form.reset();
        document.getElementById('mcpPropertyName').value = `param_${mcpProperties.length + 1}`;
        document.getElementById('mcpPropertyType').value = 'string';
        document.getElementById('mcpPropertyMinimum').value = '';
        document.getElementById('mcpPropertyMaximum').value = '';
        document.getElementById('mcpPropertyDescription').value = '';
        document.getElementById('mcpPropertyRequired').checked = false;
    }

    updatePropertyRangeVisibility();
    document.getElementById('mcpPropertyModal').style.display = 'flex';
}

/**
 * 关闭参数编辑模态框
 */
function closePropertyModal() {
    document.getElementById('mcpPropertyModal').style.display = 'none';
}

/**
 * 更新数值范围输入框的可见性
 */
function updatePropertyRangeVisibility() {
    const type = document.getElementById('mcpPropertyType').value;
    const rangeGroup = document.getElementById('mcpPropertyRangeGroup');
    if (type === 'integer' || type === 'number') {
        rangeGroup.style.display = 'block';
    } else {
        rangeGroup.style.display = 'none';
    }
}

/**
 * 处理参数表单提交
 */
function handlePropertySubmit(e) {
    e.preventDefault();
    const index = parseInt(document.getElementById('mcpPropertyIndex').value);
    const name = document.getElementById('mcpPropertyName').value.trim();
    const type = document.getElementById('mcpPropertyType').value;
    const minimum = document.getElementById('mcpPropertyMinimum').value;
    const maximum = document.getElementById('mcpPropertyMaximum').value;
    const description = document.getElementById('mcpPropertyDescription').value.trim();
    const required = document.getElementById('mcpPropertyRequired').checked;

    // 检查名称重复
    const isDuplicate = mcpProperties.some((p, i) => i !== index && p.name === name);
    if (isDuplicate) {
        alert('参数名称已存在，请使用不同的名称');
        return;
    }

    const propData = {
        name,
        type,
        description,
        required
    };

    // 数值类型添加范围限制
    if (type === 'integer' || type === 'number') {
        if (minimum !== '') {
            propData.minimum = parseFloat(minimum);
        }
        if (maximum !== '') {
            propData.maximum = parseFloat(maximum);
        }
    }

    if (index >= 0) {
        mcpProperties[index] = propData;
    } else {
        mcpProperties.push(propData);
    }

    renderMcpProperties();
    closePropertyModal();
}

/**
 * 删除参数
 */
function deleteMcpProperty(index) {
    mcpProperties.splice(index, 1);
    renderMcpProperties();
}

/**
 * 设置事件监听
 */
function setupMcpEventListeners() {
    const panel = document.getElementById('mcpToolsPanel');
    const addBtn = document.getElementById('addMcpToolBtn');
    const modal = document.getElementById('mcpToolModal');
    const closeBtn = document.getElementById('closeMcpModalBtn');
    const cancelBtn = document.getElementById('cancelMcpBtn');
    const form = document.getElementById('mcpToolForm');
    const addPropertyBtn = document.getElementById('addMcpPropertyBtn');

    // 参数编辑模态框相关元素
    const propertyModal = document.getElementById('mcpPropertyModal');
    const closePropertyBtn = document.getElementById('closeMcpPropertyModalBtn');
    const cancelPropertyBtn = document.getElementById('cancelMcpPropertyBtn');
    const propertyForm = document.getElementById('mcpPropertyForm');
    const 
```

### Core Architecture Module: `main/digital-human/js/core/network/ota-connector.js`
```
import { log } from '../../utils/logger.js?v=0205';

// WebSocket 连接
export async function webSocketConnect(otaUrl, config) {

    if (!validateConfig(config)) {
        return;
    }

    // 发送OTA请求并获取返回的websocket信息
    const otaResult = await sendOTA(otaUrl, config);
    if (!otaResult) {
        log('无法从OTA服务器获取信息', 'error');
        return;
    }

    // 从OTA响应中提取websocket信息
    const { websocket } = otaResult;
    if (!websocket || !websocket.url) {
        log('OTA响应中缺少websocket信息', 'error');
        return;
    }

    // 使用OTA返回的websocket URL
    let connUrl = new URL(websocket.url);

    // 添加token参数（从OTA响应中获取）
    if (websocket.token) {
        if (websocket.token.startsWith("Bearer ")) {
            connUrl.searchParams.append('authorization', websocket.token);
        } else {
            connUrl.searchParams.append('authorization', 'Bearer ' + websocket.token);
        }
    }

    // 添加认证参数（保持原有逻辑）
    connUrl.searchParams.append('device-id', config.deviceId);
    connUrl.searchParams.append('client-id', config.clientId);

    const wsurl = connUrl.toString()

    log(`正在连接: ${wsurl}`, 'info');

    if (wsurl) {
        document.getElementById('serverUrl').value = wsurl;
    }

    return new WebSocket(connUrl.toString());
}

// 验证配置
function validateConfig(config) {
    if (!config.deviceMac) {
        log('设备MAC地址不能为空', 'error');
        return false;
    }
    if (!config.clientId) {
        log('客户端ID不能为空', 'error');
        return false;
    }
    return true;
}

// OTA发送请求，验证状态，并返回响应数据
async function sendOTA(otaUrl, config) {
    try {
        const res = await fetch(otaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Device-Id': config.deviceId,
                'Client-Id': config.clientId
            },
            body: JSON.stringify({
                version: 0,
                uuid: '',
                application: {
                    name: 'xiaozhi-web-test',
                    version: '1.0.0',
                    compile_time: '2025-04-16 10:00:00',
                    idf_version: '4.4.3',
                    elf_sha256: '1234567890abcdef1234567890abcdef1234567890abcdef'
                },
                ota: { label: 'xiaozhi-web-test' },
                board: {
                    type: config.deviceName,
                    ssid: 'xiaozhi-web-test',
                    rssi: 0,
                    channel: 0,
                    ip: '192.168.1.1',
                    mac: config.deviceMac
                },
                flash_size: 0,
                minimum_free_heap_size: 0,
                mac_address: config.deviceMac,
                chip_model_name: '',
                chip_info: { model: 0, cores: 0, revision: 0, features: 0 },
                partition_table: [{ label: '', type: 0, subtype: 0, address: 0, size: 0 }]
            })
        });

        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

        const result = await res.json();
        return result; // 返回完整的响应数据
    } catch (err) {
        return null; // 失败返回null
    }
}
```

### Core Architecture Module: `main/digital-human/js/core/network/wakeword-bridge.js`
```
import { uiController } from '../../ui/controller.js?v=0205';
import { log } from '../../utils/logger.js?v=0205';

let wakewordSocket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let shouldReconnect = true;
let wakewordRequestSeq = 0;
let onNextBridgeConnectedCallback = null;

const pendingWakewordRequests = new Map();

export function startWakewordBridgeListener() {
    if (wakewordSocket) {
        return wakewordSocket;
    }

    shouldReconnect = true;
    log('正在连接本地唤醒事件桥...', 'info');
    tryConnect();
    return wakewordSocket;
}

function tryConnect() {
    const bridgeUrl = buildWakewordBridgeUrl();

    try {
        wakewordSocket = new WebSocket(bridgeUrl);
        wakewordSocket.onopen = () => {
            reconnectAttempts = 0;
            log(`本地唤醒事件桥已连接: ${bridgeUrl}`, 'success');
            // 连接成功后自动保存地址，刷新后仍能记住
            localStorage.setItem('xz_tester_wakewordWsUrl', bridgeUrl);
            const urlInput = document.getElementById('wakewordWsUrl');
            if (urlInput) urlInput.value = bridgeUrl;
        };

        wakewordSocket.onerror = () => {
            log(`本地唤醒事件桥连接失败: ${bridgeUrl}`, 'error');
        };

        wakewordSocket.onmessage = async (event) => {
            try {
                const message = parseWakewordBridgeMessage(event.data);
                if (message.requestId && pendingWakewordRequests.has(message.requestId)) {
                    settleWakewordRequest(message);
                    return;
                }

                if (message.success === false) {
                    log(`本地唤醒事件桥返回错误: ${message.error || '未知错误'}`, 'error');
                    return;
                }

                if (message.type === 'bridge_connected') {
                    log('本地唤醒监听已就绪', 'info');
                    if (onNextBridgeConnectedCallback) {
                        const cb = onNextBridgeConnectedCallback;
                        onNextBridgeConnectedCallback = null;
                        cb(message);
                    }
                    return;
                }

                if (message.type === 'service_ready') {
                    log('本地唤醒服务已启动', 'info');
                    return;
                }

                if (message.type === 'wakeword_config') {
                    uiController.applyWakewordConfig(message.payload || {});
                    log('已同步本地唤醒词配置', 'info');
                    return;
                }

                if (message.type === 'service_stopping') {
                    log('本地唤醒服务正在停止', 'warning');
                    return;
                }

                if (message.type === 'wake_word_detected') {
                    const wakeWord = message.payload?.wake_word || '唤醒词';
                    log(`检测到本地唤醒事件: ${wakeWord}`, 'info');
                    await uiController.triggerWakewordDial(wakeWord);
                }
            } catch (error) {
                log(`解析本地唤醒事件失败: ${error.message}`, 'error');
            }
        };

        wakewordSocket.onclose = () => {
            if (wakewordSocket) {
                wakewordSocket = null;
            }

            rejectAllWakewordRequests('本地唤醒事件桥已断开');

            if (!shouldReconnect) {
                return;
            }

            if (reconnectTimer) {
                return;
            }

            reconnectAttempts += 1;
            const delay = Math.min(1000 * reconnectAttempts, 5000);
            log(`本地唤醒事件桥将在 ${delay}ms 后重连: ${bridgeUrl}`, 'warning');
            reconnectTimer = window.setTimeout(() => {
                reconnectTimer = null;
                tryConnect();
            }, delay);
        };

        return wakewordSocket;
    } catch (error) {
        log(`启动本地唤醒监听失败: ${error.message}`, 'error');
        return null;
    }
}

export function stopWakewordBridgeListener() {
    shouldReconnect = false;

    if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (!wakewordSocket) {
        return;
    }

    wakewordSocket.onclose = null;
    wakewordSocket.close();
    wakewordSocket = null;
}

export function sendWakewordBridgeMessage(type, payload = {}, requestId = null) {
    if (!wakewordSocket || wakewordSocket.readyState !== WebSocket.OPEN) {
        log('本地唤醒事件桥未连接，无法发送消息', 'warning');
        return false;
    }

    wakewordSocket.send(JSON.stringify({
        type,
        requestId,
        payload,
    }));
    return true;
}

export function requestWakewordBridge(type, payload = {}, timeout = 5000) {
    const requestId = `wakeword-${Date.now()}-${++wakewordRequestSeq}`;

    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            pendingWakewordRequests.delete(requestId);
            reject(new Error('本地唤醒服务响应超时'));
        }, timeout);

        pendingWakewordRequests.set(requestId, { resolve, reject, timer });

        if (!sendWakewordBridgeMessage(type, payload, requestId)) {
            window.clearTimeout(timer);
            pendingWakewordRequests.delete(requestId);
            reject(new Error('本地唤醒事件桥未连接'));
        }
    });
}

export function getWakewordBridgeUrl() {
    if (wakewordSocket && wakewordSocket.url) {
        return wakewordSocket.url;
    }
    return buildWakewordBridgeUrl();
}

export function onNextBridgeConnected(callback) {
    onNextBridgeConnectedCallback = callback;
}

function buildWakewordBridgeUrl() {
    const configured = localStorage.getItem('xz_tester_wakewordWsUrl');
    if (configured && configured.trim()) {
        return configured.trim();
    }
    return 'ws://127.0.0.1:8006/wakeword-ws';
}

function parseWakewordBridgeMessage(rawData) {
    const message = JSON.parse(rawData);
    return {
        type: message.type || '',
        requestId: message.requestId || null,
        success: message.success !== false,
        payload: message.payload || {},
        error: message.error || null,
    };
}

function settleWakewordRequest(message) {
    const pendingRequest = pendingWakewordRequests.get(message.requestId);
    if (!pendingRequest) {
        return;
    }

    window.clearTimeout(pendingRequest.timer);
    pendingWakewordRequests.delete(message.requestId);

    if (message.success === false) {
        pendingRequest.reject(new Error(message.error || '本地唤醒服务返回失败'));
        return;
    }

    pendingRequest.resolve(message);
}

function rejectAllWakewordRequests(errorMessage) {
    pendingWakewordRequests.forEach((pendingRequest) => {
        window.clearTimeout(pendingRequest.timer);
        pendingRequest.reject(new Error(errorMessage));
    });
    pendingWakewordRequests.clear();
}
```

### Core Architecture Module: `main/digital-human/js/core/network/websocket.js`
```
// WebSocket消息处理模块
import { getConfig, saveConnectionUrls } from '../../config/manager.js?v=0205';
import { uiController } from '../../ui/controller.js?v=0205';
import { log } from '../../utils/logger.js?v=0205';
import { getAudioPlayer } from '../audio/player.js?v=0205';
import { getAudioRecorder } from '../audio/recorder.js?v=0205';
import { executeMcpTool, getMcpTools, setWebSocket as setMcpWebSocket } from '../mcp/tools.js?v=0205';
import { webSocketConnect } from './ota-connector.js?v=0205';

// WebSocket处理器类
export class WebSocketHandler {
    constructor() {
        this.websocket = null;
        this.onConnectionStateChange = null;
        this.onRecordButtonStateChange = null;
        this.onSessionStateChange = null;
        this.onSessionEmotionChange = null;
        this.onChatMessage = null; // 新增：聊天消息回调
        this.currentSessionId = null;
        this.isRemoteSpeaking = false;
    }

    // 发送hello握手消息
    async sendHelloMessage() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return false;

        try {
            const config = getConfig();

            const helloMessage = {
                type: 'hello',
                device_id: config.deviceId,
                device_name: config.deviceName,
                device_mac: config.deviceMac,
                token: config.token,
                features: {
                    mcp: true,
                    emoji: config.emojiEnabled
                }
            };

            log('发送hello握手消息', 'info');
            this.websocket.send(JSON.stringify(helloMessage));

            return new Promise(resolve => {
                const timeout = setTimeout(() => {
                    log('等待hello响应超时', 'error');
                    log('提示: 请尝试点击"测试认证"按钮进行连接排查', 'info');
                    resolve(false);
                }, 5000);

                const onMessageHandler = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        if (response.type === 'hello' && response.session_id) {
                            log(`服务器握手成功，会话ID: ${response.session_id}`, 'success');
                            clearTimeout(timeout);
                            this.websocket.removeEventListener('message', onMessageHandler);
                            resolve(true);
                        }
                    } catch (e) {
                        // 忽略非JSON消息
                    }
                };

                this.websocket.addEventListener('message', onMessageHandler);
            });
        } catch (error) {
            log(`发送hello消息错误: ${error.message}`, 'error');
            return false;
        }
    }

    _sendWakeupMessages(sessionId) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

        // listen detect
        this.websocket.send(JSON.stringify({
            session_id: sessionId,
            type: 'listen',
            state: 'detect',
            text: '嘿，你好呀'
        }));
        log('发送listen detect消息，唤醒词: 嘿，你好呀', 'info');

        // listen start：开始监听
        this.websocket.send(JSON.stringify({
            session_id: sessionId,
            type: 'listen',
            state: 'start',
            mode: 'auto'
        }));
        log('发送listen start消息', 'info');
    }

    // 处理文本消息
    handleTextMessage(message) {
        if (message.type === 'hello') {
            log(`服务器回应：${JSON.stringify(message, null, 2)}`, 'success');
            window.cameraAvailable = true;
            log('连接成功，摄像头已可用', 'success');
            uiController.updateDialButton(true);

            this._sendWakeupMessages(message.session_id);

            uiController.startAIChatSession();
        } else if (message.type === 'tts') {
            this.handleTTSMessage(message);
        } else if (message.type === 'audio') {
            log(`收到音频控制消息: ${JSON.stringify(message)}`, 'info');
        } else if (message.type === 'stt') {
            log(`识别结果: ${message.text}`, 'info');
            // 检查是否需要绑定设备
            if (message.text && (message.text.includes('绑定') || message.text.includes('bind'))) {
                log('收到设备绑定提示，更新摄像头状态', 'warning');
                window.cameraAvailable = false;
                // 关闭摄像头
                if (typeof window.stopCamera === 'function') {
                    window.stopCamera();
                }
                // 更新摄像头按钮状态
                const cameraBtn = document.getElementById('cameraBtn');
                if (cameraBtn) {
                    cameraBtn.classList.remove('camera-active');
                    cameraBtn.querySelector('.btn-text').textContent = '摄像头';
                    cameraBtn.disabled = true;
                    cameraBtn.title = '请先绑定验证码';
                }
            }
            // 使用新的聊天消息回调显示STT消息
            if (this.onChatMessage && message.text) {
                this.onChatMessage(message.text, true);
            }
        } else if (message.type === 'llm') {
            log(`大模型回复: ${message.text}`, 'info');
            // 使用新的聊天消息回调显示LLM回复
            if (this.onChatMessage && message.text) {
                this.onChatMessage(message.text, false);
            }

            // 如果包含表情，更新sessionStatus表情并触发Live2D动作
            if (message.text && /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(message.text)) {
                // 提取表情符号
                const emojiMatch = message.text.match(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u);
                if (emojiMatch && this.onSessionEmotionChange) {
                    this.onSessionEmotionChange(emojiMatch[0]);
                }

                // 触发Live2D情绪动作
                if (message.emotion) {
                    console.log(`收到情绪消息: emotion=${message.emotion}, text=${message.text}`);
                    this.triggerLive2DEmotionAction(message.emotion);
                }
            }

            // 只有当文本不仅仅是表情时，才添加到对话中
            // 移除文本中的表情后检查是否还有内容
            const textWithoutEmoji = message.text ? message.text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim() : '';
            if (textWithoutEmoji && this.onChatMessage) {
                this.onChatMessage(message.text, false);
            }
        } else if (message.type === 'mcp') {
            this.handleMCPMessage(message);
        } else {
            log(`未知消息类型: ${message.type}`, 'info');
            if (this.onChatMessage) {
                this.onChatMessage(`未知消息类型: ${message.type}\n${JSON.stringify(message, null, 2)}`, false);
            }
        }
    }

    // 处理TTS消息
    handleTTSMessage(message) {
        if (message.state === 'start') {
            log('服务器开始发送语音', 'info');
            this.currentSessionId = message.session_id;
            this.isRemoteSpeaking = true;
            if (this.onSessionStateChange) {
                this.onSessionStateChange(true);
            }

            // 启动Live2D说话动画
            this.startLive2DTalking();
        } else if (message.state === 'sentence_start') {
            log(`服务器发送语音段: ${message.text}`, 'info');
            this.ttsSentenceCount = (this.ttsSentenceCount || 0) + 1;

            if (message.text && this.onChatMessage) {
                this.onChatMessage(message.text, false);
            }

            // 确保动画在句子开始时运行
            const live2dManager = window.chatApp?.live2dManager;
            if (live2dManager && !live2dManager.isTalking) {
                this.startLive2DTalking();
            }
        } else if (message.state === 'sentence_end') {
            log(`语音段结束: ${message.text}`, 'info');

            // 句子结束时不清除动画，等待下一个句子或最终停止
        } else if (message.state === 'stop') {
            log('服务器语音传输结束，清空所有音频缓冲', 'info');

            // 清空所有音频缓冲并停止播放
            const audioPlayer = getAudioPlayer();
            audioPlayer.clearAllAudio();

            this.isRemoteSpeaking = false;
            if (this.onRecordButtonStateChange) {
                this.onRecordButtonStateChange(false);
            }
            if (this.onSessionStateChange) {
                this.onSessionStateChange(false);
            }

            // 延迟停止Live2D说话动画，确保所有句子都播放完毕
            setTimeout(() => {
                this.stopLive2DTalking();
                this.ttsSentenceCount = 0; // 重置计数器
            }, 1000); // 1秒延迟，确保所有句子都完成
        }
    }

    // 启动Live2D说话动画
    startLive2DTalking() {
        try {
            // 获取Live2D管理器实例
            const live2dManager = window.chatApp?.live2dManager;
            if (live2dManager && live2dManager.live2dModel) {
                // 使用音频播放器的分析器节点
                live2dManager.startTalking();
                log('Live2D说话动画已启动', 'info');
            }
        } catch (error) {
            log(`启动Live2D说话动画失败: ${error.message}`, 'error');
        }
    }

    // 停止Live2D说话动画
    stopLive2DTalking() {
        try {
            const live2dManager = window.chatApp?.live2dManager;
            if (live2dManager) {
                live2dManager.stopTalking();
                log('Live2D说话动画已停止', 'info');
            }
        } catch (error) {
            log(`停止Live2D说话动画失败: ${error.message}`, 'error');
        }
    }

    // 初始化Live2D音频分析器
    initializeLive2DAudioAnalyzer() {
        try {
            const live2dManager = window.chatApp?.live2dManager;
            if (live2dManager) {
                // 初始化音频分析器（使用音频播放器的上下文）
                if (live2dManager.initializeAudioAnalyzer()) {
                    log('Live2D音频分析器初始化完成，已连接到音频播放器', 'success');
                } else {
                    log('Live2D音频分析器初始化失败，将使用模拟动画', 'warning');
                }
            }
        } catch (error) {
            log(`初始化Live2D音频分析器失败: ${error.message}`, 'error');
        }
    }

    // 处理MCP消息
    handleMCPMessage(message) {
        const payload = message.payload || {};
        log(`服务器下发: ${JSON.stringify(message)}`, 'info');

        if (payl
```

### Core Architecture Module: `main/digital-human/js/utils/blocking-queue.js`
```
export default class BlockingQueue {
    #items   = [];
    #waiters = [];          // {resolve, reject, min, timer, onTimeout}

    /* 空队列一次性闸门 */
    #emptyPromise = null;
    #emptyResolve = null;

    /* 生产者：把数据塞进去 */
    enqueue(item, ...restItems) {
        if (restItems.length === 0) {
            this.#items.push(item);
        }
        // 如果有额外参数，批量处理所有项
        else {
            const items = [item, ...restItems].filter(i => i);
            if (items.length === 0) return;
            this.#items.push(...items);
        }
        // 若有空队列闸门，一次性放行所有等待者
        if (this.#emptyResolve) {
            this.#emptyResolve();
            this.#emptyResolve = null;
            this.#emptyPromise = null;
        }

        // 唤醒所有正在等的 waiter
        this.#wakeWaiters();
    }

    /* 消费者：min 条或 timeout ms 先到谁 */
    async dequeue(min = 1, timeout = Infinity, onTimeout = null) {
        // 1. 若空，等第一次数据到达（所有调用共享同一个 promise）
        if (this.#items.length === 0) {
            await this.#waitForFirstItem();
        }

        // 立即满足
        if (this.#items.length >= min) {
            return this.#flush();
        }

        // 需要等待
        return new Promise((resolve, reject) => {
            let timer = null;
            const waiter = { resolve, reject, min, onTimeout, timer };

            // 超时逻辑
            if (Number.isFinite(timeout)) {
                waiter.timer = setTimeout(() => {
                    this.#removeWaiter(waiter);
                    if (onTimeout) onTimeout(this.#items.length);
                    resolve(this.#flush());
                }, timeout);
            }

            this.#waiters.push(waiter);
        });
    }

    /* 空队列闸门生成器 */
    #waitForFirstItem() {
        if (!this.#emptyPromise) {
            this.#emptyPromise = new Promise(r => (this.#emptyResolve = r));
        }
        return this.#emptyPromise;
    }

    /* 内部：每次数据变动后，检查哪些 waiter 已满足 */
    #wakeWaiters() {
        for (let i = this.#waiters.length - 1; i >= 0; i--) {
            const w = this.#waiters[i];
            if (this.#items.length >= w.min) {
                this.#removeWaiter(w);
                w.resolve(this.#flush());
            }
        }
    }

    #removeWaiter(waiter) {
        const idx = this.#waiters.indexOf(waiter);
        if (idx !== -1) {
            this.#waiters.splice(idx, 1);
            if (waiter.timer) clearTimeout(waiter.timer);
        }
    }

    #flush() {
        const snapshot = [...this.#items];
        this.#items.length = 0;
        return snapshot;
    }

    /* 当前缓存长度（不含等待者） */
    get length() {
        return this.#items.length;
    }

    /* 清空队列（保持对象引用，不影响等待者） */
    clear() {
        this.#items.length = 0;
    }
}
```

### Core Architecture Module: `main/digital-human/js/utils/libopus.js`
```
var Module = function(Module) {
    Module = Module || {};
  
  var b;b||(b=eval("(function() { try { return Module || {} } catch(e) { return {} } })()"));var f={},l;for(l in b)b.hasOwnProperty(l)&&(f[l]=b[l]);var p=!1,q=!1,r=!1,t=!1;
  if(b.ENVIRONMENT)if("WEB"===b.ENVIRONMENT)p=!0;else if("WORKER"===b.ENVIRONMENT)q=!0;else if("NODE"===b.ENVIRONMENT)r=!0;else if("SHELL"===b.ENVIRONMENT)t=!0;else throw Error("The provided Module['ENVIRONMENT'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.");else p="object"===typeof window,q="function"===typeof importScripts,r="object"===typeof process&&"function"===typeof require&&!p&&!q,t=!p&&!r&&!q;
  if(r){b.print||(b.print=console.log);b.printErr||(b.printErr=console.warn);var u,v;b.read=function(a,c){u||(u=null);v||(v=require("path"));a=v.normalize(a);var d=u.readFileSync(a);d||a==v.resolve(a)||(a=path.join(__dirname,"..","src",a),d=u.readFileSync(a));d&&!c&&(d=d.toString());return d};b.readBinary=function(a){a=b.read(a,!0);a.buffer||(a=new Uint8Array(a));assert(a.buffer);return a};b.load=function(a){aa(read(a))};b.thisProgram||(b.thisProgram=1<process.argv.length?process.argv[1].replace(/\\/g,
  "/"):"unknown-program");b.arguments=process.argv.slice(2);"undefined"!==typeof module&&(module.exports=b);process.on("uncaughtException",function(a){if(!(a instanceof w))throw a;});b.inspect=function(){return"[Emscripten Module object]"}}else if(t)b.print||(b.print=print),"undefined"!=typeof printErr&&(b.printErr=printErr),b.read="undefined"!=typeof read?read:function(){throw"no read() available (jsc?)";},b.readBinary=function(a){if("function"===typeof readbuffer)return new Uint8Array(readbuffer(a));
  a=read(a,"binary");assert("object"===typeof a);return a},"undefined"!=typeof scriptArgs?b.arguments=scriptArgs:"undefined"!=typeof arguments&&(b.arguments=arguments),eval("if (typeof gc === 'function' && gc.toString().indexOf('[native code]') > 0) var gc = undefined");else if(p||q)b.read=function(a){var c=new XMLHttpRequest;c.open("GET",a,!1);c.send(null);return c.responseText},b.readAsync=function(a,c,d){var e=new XMLHttpRequest;e.open("GET",a,!0);e.responseType="arraybuffer";e.onload=function(){200==
  e.status||0==e.status&&e.response?c(e.response):d()};e.onerror=d;e.send(null)},"undefined"!=typeof arguments&&(b.arguments=arguments),"undefined"!==typeof console?(b.print||(b.print=function(a){console.log(a)}),b.printErr||(b.printErr=function(a){console.warn(a)})):b.print||(b.print=function(){}),q&&(b.load=importScripts),"undefined"===typeof b.setWindowTitle&&(b.setWindowTitle=function(a){document.title=a});else throw"Unknown runtime environment. Where are we?";function aa(a){eval.call(null,a)}
  !b.load&&b.read&&(b.load=function(a){aa(b.read(a))});b.print||(b.print=function(){});b.printErr||(b.printErr=b.print);b.arguments||(b.arguments=[]);b.thisProgram||(b.thisProgram="./this.program");b.print=b.print;b.m=b.printErr;b.preRun=[];b.postRun=[];for(l in f)f.hasOwnProperty(l)&&(b[l]=f[l]);
  var f=void 0,y={B:function(a){tempRet0=a},w:function(){return tempRet0},g:function(){return x},c:function(a){x=a},q:function(a){switch(a){case "i1":case "i8":return 1;case "i16":return 2;case "i32":return 4;case "i64":return 8;case "float":return 4;case "double":return 8;default:return"*"===a[a.length-1]?y.i:"i"===a[0]?(a=parseInt(a.substr(1)),assert(0===a%8),a/8):0}},v:function(a){return Math.max(y.q(a),y.i)},C:16,Q:function(a,c){"double"===c||"i64"===c?a&7&&(assert(4===(a&7)),a+=4):assert(0===(a&
  3));return a},K:function(a,c,d){return d||"i64"!=a&&"double"!=a?a?Math.min(c||(a?y.v(a):0),y.i):Math.min(c,8):8},k:function(a,c,d){return d&&d.length?(d.splice||(d=Array.prototype.slice.call(d)),d.splice(0,0,c),b["dynCall_"+a].apply(null,d)):b["dynCall_"+a].call(null,c)},e:[],r:function(a){for(var c=0;c<y.e.length;c++)if(!y.e[c])return y.e[c]=a,2*(1+c);throw"Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";},A:function(a){y.e[(a-2)/2]=null},d:function(a){y.d.n||
  (y.d.n={});y.d.n[a]||(y.d.n[a]=1,b.m(a))},l:{},M:function(a,c){assert(c);y.l[c]||(y.l[c]={});var d=y.l[c];d[a]||(d[a]=function(){return y.k(c,a,arguments)});return d[a]},L:function(){throw"You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work";},f:function(a){var c=x;x=x+a|0;x=x+15&-16;return c},o:function(a){var c=z;z=z+a|0;z=z+15&-16;return c},b:function(a){var c=E;E=E+a|0;E=E+15&-16;if(a=E>=F)G("Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value "+
  F+", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which adjusts the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 "),a=!0;return a?(E=c,0):c},p:function(a,c){return Math.ceil(a/(c?c:16))*(c?c:16)},P:function(a,c,d){return d?+(a>>>0)+4294967296*+(c>>>0):+(a>>>0)+4294967296*+(c|0)},h:8,i:4,D:0};b.Runtime=y;y.addFunction=y.r;
  y.removeFunction=y.A;var H=!1;function assert(a,c){a||G("Assertion failed: "+c)}function ba(a){var c=b["_"+a];if(!c)try{c=eval("_"+a)}catch(d){}assert(c,"Cannot call unknown function "+a+" (perhaps LLVM optimizations or closure removed it?)");return c}var ca,da;
  (function(){function a(a){a=a.toString().match(g).slice(1);return{arguments:a[0],body:a[1],returnValue:a[2]}}function c(){if(!k){k={};for(var c in d)d.hasOwnProperty(c)&&(k[c]=a(d[c]))}}var d={stackSave:function(){y.g()},stackRestore:function(){y.c()},arrayToC:function(a){var c=y.f(a.length);ea(a,c);return c},stringToC:function(a){var c=0;null!==a&&void 0!==a&&0!==a&&(c=y.f((a.length<<2)+1),fa(a,c));return c}},e={string:d.stringToC,array:d.arrayToC};da=function(a,c,d,g,k){a=ba(a);var C=[],D=0;if(g)for(var n=
  0;n<g.length;n++){var P=e[d[n]];P?(0===D&&(D=y.g()),C[n]=P(g[n])):C[n]=g[n]}d=a.apply(null,C);"string"===c&&(d=I(d));if(0!==D){if(k&&k.async){EmterpreterAsync.F.push(function(){y.c(D)});return}y.c(D)}return d};var g=/^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/,k=null;ca=function(d,e,g){g=g||[];var B=ba(d);d=g.every(function(a){return"number"===a});var oa="string"!==e;if(oa&&d)return B;var C=g.map(function(a,c){return"$"+c});e="(function("+C.join(",")+
  ") {";var D=g.length;if(!d){c();e+="var stack = "+k.stackSave.body+";";for(var n=0;n<D;n++){var P=C[n],K=g[n];"number"!==K&&(K=k[K+"ToC"],e+="var "+K.arguments+" = "+P+";",e+=K.body+";",e+=P+"=("+K.returnValue+");")}}g=a(function(){return B}).returnValue;e+="var ret = "+g+"("+C.join(",")+");";oa||(g=a(function(){return I}).returnValue,e+="ret = "+g+"(ret);");d||(c(),e+=k.stackRestore.body.replace("()","(stack)")+";");return eval(e+"return ret})")}})();b.ccall=da;b.cwrap=ca;
  function ga(a,c,d){d=d||"i8";"*"===d.charAt(d.length-1)&&(d="i32");switch(d){case "i1":J[a>>0]=c;break;case "i8":J[a>>0]=c;break;case "i16":L[a>>1]=c;break;case "i32":M[a>>2]=c;break;case "i64":tempI64=[c>>>0,(tempDouble=c,1<=+ha(tempDouble)?0<tempDouble?(ia(+ja(tempDouble/4294967296),4294967295)|0)>>>0:~~+ka((tempDouble-+(~~tempDouble>>>0))/4294967296)>>>0:0)];M[a>>2]=tempI64[0];M[a+4>>2]=tempI64[1];break;case "float":N[a>>2]=c;break;case "double":la[a>>3]=c;break;default:G("invalid type for setValue: "+
  d)}}b.setValue=ga;function ma(a,c){c=c||"i8";"*"===c.charAt(c.length-1)&&(c="i32");switch(c){case "i1":return J[a>>0];case "i8":return J[a>>0];case "i16":return L[a>>1];case "i32":return M[a>>2];case "i64":return M[a>>2];case "float":return N[a>>2];case "double":return la[a>>3];default:G("invalid type for setValue: "+c)}return null}b.getValue=ma;b.ALLOC_NORMAL=0;b.ALLOC_STACK=1;b.ALLOC_STATIC=2;b.ALLOC_DYNAMIC=3;b.ALLOC_NONE=4;
  function O(a,c,d,e){var g,k;"number"===typeof a?(g=!0,k=a):(g=!1,k=a.length);var h="string"===typeof c?c:null;d=4==d?e:["function"===typeof Q?Q:y.o,y.f,y.o,y.b][void 0===d?2:d](Math.max(k,h?1:c.length));if(g){e=d;assert(0==(d&3));for(a=d+(k&-4);e<a;e+=4)M[e>>2]=0;for(a=d+k;e<a;)J[e++>>0]=0;return d}if("i8"===h)return a.subarray||a.slice?R.set(a,d):R.set(new Uint8Array(a),d),d;e=0;for(var A,m;e<k;){var B=a[e];"function"===typeof B&&(B=y.N(B));g=h||c[e];0===g?e++:("i64"==g&&(g="i32"),ga(d+e,B,g),m!==
  g&&(A=y.q(g),m=g),e+=A)}return d}b.allocate=O;b.getMemory=function(a){return na?"undefined"!==typeof S&&!S.a||!T?y.b(a):Q(a):y.o(a)};function I(a,c){if(0===c||!a)return"";for(var d=0,e,g=0;;){e=R[a+g>>0];d|=e;if(0==e&&!c)break;g++;if(c&&g==c)break}c||(c=g);e="";if(128>d){for(;0<c;)d=String.fromCharCode.apply(String,R.subarray(a,a+Math.min(c,1024))),e=e?e+d:d,a+=1024,c-=1024;return e}return b.UTF8ToString(a)}b.Pointer_stringify=I;
  b.AsciiToString=function(a){for(var c="";;){var d=J[a++>>0];if(!d)return c;c+=String.fromCharCode(d)}};b.stringToAscii=function(a,c){return pa(a,c,!1)};
  function qa(a,c){for(var d,e,g,k,h,A,m="";;){d=a[c++];if(!d)return m;d&128?(e=a[c++]&63,192==(d&224)?m+=String.fromCharCode((d&31)<<6|e):(g=a[c++]&63,224==(d&240)?d=(d&15)<<12|e<<6|g:(k=a[c++]&63,240==(d&248)?d=(d&7)<<18|e<<12|g<<6|k:(h=a[c++]&63,248==(d&252)?d=(d&3)<<24|e<<18|g<<12|k<<6|h:(A=a[c++]&63,d=(d&1)<<30|e<<24|g<<18|k<<12|h<<6|A))),65536>d?m+=String.fromCharCode(d):(d-=65536,m+=String.fromCharCode(55296|d>>10,56320|d&1023)))):m+=String.fromCharCode(d)}}b.UTF8ArrayToString=qa;
  b.UTF8ToString=function(a){return qa(R,a)};
  function ra(a,c,d,e){if(!(0<e))return 0;var g=d;e=d+e-1;for(var k=0;k<a.length;++k){var h=a.charCodeAt(k);55296<=h&&57343>=h&&(h=65536+((h&1023)<<10)|a.charCodeAt(++k)&1023);if(127>=h){if(d>=e)break;c[d++]=h}else{if(2047>=h){if(d+1>=e)break;c[d++]=192|h>>6}else{if(65535>=h){if(d+2>=e)break;c[d++]=224|h>>12}else{if(2097151>=h){if(d+3>=e)break;c[d++]=240|h>>18}else{if(67108863>=h){if(d+4>=e)break;c[d++]=248|h>>24}else{if(d+5>=e)break;c[d++]=252|h>>30;c[d++]=128|h>>24&63}c[d++]=128|h>>18&63}c[d++]=128|
  h>>12&63}c[d++]=128|h>>6&63}c[d++]=128|h&63}}c
```

### Core Architecture Module: `main/digital-human/js/utils/logger.js`
```
// 日志记录函数
export function log(message, type = 'info') {
    // 将消息按换行符分割成多行
    const lines = message.split('\n');
    const now = new Date();
    // const timestamp = `[${now.toLocaleTimeString()}] `;
    const timestamp = `[${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}] `;

    // 检查是否存在日志容器
    const logContainer = document.getElementById('logContainer');
    if (!logContainer) {
        // 如果日志容器不存在，只输出到控制台
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }

    // 为每一行创建日志条目
    lines.forEach((line, index) => {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        // 如果是第一条日志，显示时间戳
        const prefix = index === 0 ? timestamp : ' '.repeat(timestamp.length);
        logEntry.textContent = `${prefix}${line}`;
        // logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        // logEntry.style 保留起始的空格
        logEntry.style.whiteSpace = 'pre';
        if (type === 'error') {
            logEntry.style.color = 'red';
        } else if (type === 'debug') {
            logEntry.style.color = 'gray';
            return;
        } else if (type === 'warning') {
            logEntry.style.color = 'orange';
        } else if (type === 'success') {
            logEntry.style.color = 'green';
        } else {
            logEntry.style.color = 'black';
        }
        logContainer.appendChild(logEntry);
    });

    logContainer.scrollTop = logContainer.scrollHeight;
}
```

### Core Architecture Module: `main/digital-human/wakeword_runtime/core/__init__.py`
```
from .detector_assets import DetectorAssets, DetectorAssetsBuilder
from .detector import WakewordDetector
from .microphone import MicrophoneListener

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3372** (2026-09-16): **[Bug] 后台ota升级没有触发**
  *Symptoms*: 你好！我在使用后台ota时遭遇如下问题：  如图，我已经上传了对应的新版固件：  <img width="1890" height="288" alt="Image" src="https://github.com/user-attachments/assets/fdddde95-172f-402e-9ed1-5851e411c93b" />  设备里的固件是旧版：  <img width="1543" height="210" alt="Image" src="https://github.com/user-attachments/assets/1fdb8959-52e1-41c4-bd69-32d26da4b0f2" />  但是设备端没有触发更新，而是直接进入对话，这是为何  已核对设备固件型号名称，都是对的上的

- **Issue #3333** (2026-08-21): **[Bug] 声纹识别开启后, 会导致对话卡住, 有遇到同样问题的吗**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 -->  ## 🖥️ 环境信息 - 部署方式: 全模块部署 还是 单Server部署 - 版本号: 例如 0.3.x  ## 🔍 告诉我们，应该怎么复现这个问题 <!-- 这个很重要，方便我们快速定位 --> 1. 打开 '...' 2. 点击 '...' 3. 滚动到 '...' 4. 看到错误  ## 🤔 你原本希望是怎么样的 <!-- 简要描述预期的正确行为 -->  ## 😯 提供一些截图 <!-- 如果适用，添加问题的截图 --> 1. 比如日志截图，越多越好 2. 比如界面反应  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 
  **Post-Mortem & Fix Analysis**:
  > 请详细描述
  > @wengzh12138    260821 12:08:53[0.9.5-SiFuChEdnocaCh][core.handle.textMessageProcessor]-INFO-收到listen消息：{"session_id":"33eb33c3-1d2c-4bd8-8b2d-7f790bd94ad7","type":"listen","state":"start","mode":"auto"} 260821 12:08:53[0.9.5-SiFuChEdnocaCh][core.handle.textMessageProcessor]-INFO-收到mcp消息：{"session_id":"33eb33c3-1d2c-4bd8-8b2d-7f790bd94ad7","type":"mcp","payload":{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"self.get_device_status","description":"Provides the real-time information of the device, including the current status of the audio speaker, screen, battery, network, etc.\nUse this tool for: \n1. Answering questions about current condition (e.g. what is the current volume of the audio speaker?)\n2. As the first step to control the device (e.g. turn up / down the volume of the audio speaker, etc.)","inputSchema":{"type":"object","properties":{}}},{"name":"self.audio_speaker.set_volume","description":"Set the volume of the audio speaker. If the current volume is unknown, you mus
  > 识别正确的时候, 就不会卡住

- **Issue #3311** (2026-08-10): **[Bug] 不算是 bug 的问题**
  *Symptoms*: ## 🐛问题描述  不清楚是否算bug，因为这是一个太棒的项目！  遇到的情况是： 头一天 通过 脚本 算是部署成功了，已经到核心配置的阶段，因ws配置报错，临下班再次 重装乌班图 后 重新通过脚本部署，大概1小时后，xiaozhi-esp32-server:server_latest等都下载完毕，删除了 docker-compose_all.yml 中的"version"（忘了具体啥时删除的）。 其实这时应该就开始无法访问服务器（120.*.*.166）了，但没注意。 第二天发现多个SSH客户端都无法访问服务器，在云服务器厂商官网的控制面板上也无法访问，都是超时一类。 求助云服务器厂商，检测后发现是有个Python进程一直重启，占用资源太多所致，估计就是22端口吧。 ......  这应该不算是 bug，最多是个隐患吧。 也没有能力提供改进方法，就只是反馈一下吧，希望能有点启发吧，因为这项目太棒了。  ## 🖥️ 环境信息 - 部署方式: 全模块部署  Server部署 - 版本号: 最新   
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，也谢谢你对项目的认可！  从目前的信息来看，服务器无法 SSH 登录更可能是主机资源耗尽导致的，并不是 Python 进程占用了 22 端口。删除 `docker-compose_all.yml` 中的 `version` 也不会造成这个问题，新版 Docker Compose 已经不再需要该字段。  全模块部署如果使用本地 FunASR，建议至少准备 4 核 8 GB；如果机器配置较低，而服务又因配置错误持续重启，确实可能导致 CPU、内存或磁盘 I/O 被占满。项目目前使用了 `restart: always`，这也可能放大启动失败带来的影响，我们会关注并考虑增加资源检查和更友好的失败保护。  为了进一步确认原因，方便的话请补充以下信息：  - 云服务器的 CPU、内存和磁盘配置； - `docker ps -a` 的输出； - `docker logs --tail 300 xiaozhi-esp32-server` 的输出； - 如果还能进入控制台，请提供 `free -h` 和 `docker stats --no-stream` 的结果。  如果再次出现无法访问，可以先通过云厂商控制台执行：  ```bash docker compose -f /opt/xiaozhi-server/docker-compose_all.yml down ```  等服务器恢复后再排查具体的启动日志。现阶段还不能确定是项目 Bug，但你反馈的“异常重启可能拖垮低配服务器”确实是一个值得改进的隐患，再次感谢提醒！
  > 非常感谢回复！ 并且，您说的对，是预置的 ASR 模型造成 OOM 了，也把 CPU 给累坏了。 后来，也知道可以在编排 Docker 时指定空间上限 等 可以避免这样 —— 第一次 从 部署开源库中 感觉收获满满。  如果可能，希望可以给这个原本就很出色的库 做点什么。 

- **Issue #3299** (2026-07-22): **[Bug] 设备管理中的“自动升级”选项不生效**
  *Symptoms*: ## 🐛 问题描述 设备管理中的“自动升级”选项无论开启与否，终端设备都会自动升级。  ## 🖥️ 环境信息 - 部署方式: 全模块部署 - 版本号: 例如 0.9.5 ~ e3453b1a87  ## 🔍 告诉我们，应该怎么复现这个问题 升级server到上述版本； 将OTA升级中的设备版本升级到高于实际设备版本； 关闭、打开设备管理中该设备的“自动升级”开关； 无论是“自动升级”开关处于何种状态，设备总会自动升级。  
  **Post-Mortem & Fix Analysis**:
  > 找到问题了。 main\manager-api\src\main\java\xiaozhi\modules\device\vo\UserShowDeviceListVO.java, Line 36, 将otaUpgrade修改为autoUpdate
  > 感谢反馈！已定位到设备列表接口的字段不一致，导致页面显示为关闭，但数据库中的自动升级状态仍可能是开启。已在 #3301 从接口契约处修复并补充回归测试，欢迎有空帮忙验证。 

- **Issue #3282** (2026-07-24): **[Bug] 简短描述问题 本地部署Qwen3.5-35B-A3B-FP8，调用报ValueError: System message must be at the beginning.**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 --> 本地部署Qwen3.5-35B-A3B-FP8，调用报ValueError: System message must be at the beginning. ## 🖥️ 环境信息 - 部署方式: 全模块部署  - 版本号:  0.94  ## 🔍 告诉我们，应该怎么复现这个问题 <!-- 这个很重要，方便我们快速定位 --> 1. 打开 智控台 2. 设置好本地部署的模型参数 3. 配置智能体，使用配置好的本地模型 4. 硬件听到，小智有点忙。实际就是模型调用错误  ## 🤔 你原本希望是怎么样的 <!-- 简要描述预期的正确行为 --> 调用的时候将 system提示词合并，并且放到第一个  ## 😯 提供一些截图 <!-- 如果适用，添加问题的截图 -->  <img width="1077" height="543" alt="Image" src="https://github.com/user-attachments/assets/e46bf99c-007b-4ca6-8d7c-9dc33a3d836f" />  <img width="1077" height="543" alt="Image" src="https://github.com/user-attachments/assets/93d3157c-6fdd-4625-a527-ac2dead866d0" />  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 问题已经定位清楚：平台发送的 messages 顺序不符合 Qwen3.5 的 chat template 要求。 核心报错： ValueError: System message must be at the beginning. 也就是说，请求里出现了类似顺序： [   {"role": "user", "content": "你好"},   {"role": "system", "content": "你是一个助手"} ] 或者： [   {"role": "system", "content": "系统提示词1"},   {"role": "user", "content": "你好"},   {"role": "system", "content": "平台后来追加的提示词"} ] Qwen3.5 要求： system 消息只能位于最前面； 后续不能再次插入 system； 多个 system 最好合并成一个。 正确格式 {   "model": "Qwen3.5-35B-A3B-FP8",   "messages": [     {       "role": "system",       "content": "你是一个专业、准确的中文助手。"     },     {       "role": "user",       "content": "你好"     }   ] } 错误格式： {   "messages": [     {       "role": "user",       "content": "你好"     },     {       "role": "system",       "content": "请使用中文回答"     }   ] }
  **Post-Mortem & Fix Analysis**:
  > 这个[pr](https://github.com/xinnan-tech/xiaozhi-esp32-server/pull/3270)中有修复这个问题，可以更新试一下；如果还有报错，麻烦提供下日志

- **Issue #3280** (2026-07-16): **[Bug] 时区导致的设备离线问题**
  *Symptoms*: 这份完整的 Issue 草稿严格整合了之前整理的四个实际排查阶段、测试命令、实际的矛盾终端日志输出，以及后续排查到的数据库表结构和 API 配置发现，以专业、客观的软件工程事实逻辑呈现：  ---  ## 🐛 问题描述  设备在成功配置并连接网络后，设备底层鉴权、系统管理后台（Web UI）以及服务端的当前时间存在严重的 8 小时时差对齐失败。 由于容器层及 MySQL 引擎对本地时区环境变量（`TZ=Asia/Shanghai`）存在加载失效或解析畸变，导致新绑定的设备时间戳错位（写入了 UTC 0 时区时间）。  1. 控制台 UI 永久显示设备“离线”，设置入口被锁死。   ## 🖥️ 环境信息  * **部署方式**: 全模块部署 (Docker Compose) * **硬件平台**: Waveshare ESP32-S3-Touch-LCD-3.5 (-C) * **固件版本号**: v2.1.0 / v2.2.6 * **服务端镜像版本**: `server_latest` / `web_latest`  ## 🔍 告诉我们，应该怎么复现这个问题  1. 使用全模块部署 YAML（其中包含 `- TZ=Asia/Shanghai`）拉起容器。 2. 将开发板上电连接 Wi-Fi，在管理后台完成设备绑定。 3. 观察当前实际时间与界面上生成的设备绑定时间、活跃时间，发现二者存在固定的 8 小时时差（设备显示正确，但服务端日志/后台记录了 0 时区时间）。 4. 在该时差以及时钟不同步状态下，网页端的设备状态栏始终保持灰色“离线”；按键语音通信时，服务端终端抛出处理异常，导致界面参数（唤醒词/音色等）配置被锁定或调用失败。  ## 🛠️ 已做过的 YAML 修改、测试命令与终端现象输出  为了对齐时区并解决时差引发的连锁状态离线，先后对 YAML 进行了 4 个阶段的配置尝试，每次执行验证命令均出现了与配置预期不符或矛盾的实际日志输出：  ### 阶段一：尝试注入常规环境变量与启动参数  * **更改的 YAML 配置**： 在 `xiaozhi-esp32-server-web` 中追加 `JAVA_OPTS=-Duser.timezone=Asia/Shanghai`；在 `xiaozhi-esp32-server-db` 中追加 `command: --default-time-zone='+08:00'` 与 `TZ=Asia/Shanghai`。 * **测试命令**： ```bash sudo docker exec -it xiaozhi-esp32-server-web date  ```   * **实际终端输出**： ```text Fri Jul 10 08:56:26 Asia 2026  ```   * **矛盾现象**：输出既不是 `CST` 也不是 `UTC`，而是畸形的 `Asia 2026`，且时间仍为伦敦 0 时区（08点，实际物理时间应为 16点）。证明精简版基础镜像底层无 `tzdata` 组件，无法正确解析该时区字符串。  ### 阶段二：尝试挂载宿主机物理时区文件  * **更改的 YAML 配置**： 在 `xiaozhi-esp32-server`、`web`、`db`、`redis` 多个服务的 `volumes` 中均追加： `- /etc/localtime:/etc/localtime:ro` `- /etc/timezone:/etc/timezone:ro` * **测
  **Post-Mortem & Fix Analysis**:
  > 我在wsl部署依然是这样的问题，在wsl 是ubuntu 22.04，用的一键部署。前面问题中的部署方式是docker逐步部署。
  > 感谢反馈，相关修复已提交至 PR #3283，目前正在等待审查，尚未合并。  本次主要处理了两个跨时区问题：  - 后端返回绑定时间和最后连接时间的毫秒时间戳，由前端按浏览器本地时区显示，避免固定时差。 - 修复管理服务与 MQTT Gateway 处于不同时区时，日期鉴权 Token 不一致导致设备被误判为离线的问题。  如果方便，欢迎协助验证：  1. 绑定时间和最后连接时间是否正确； 2. 设备连接后是否能正常显示为在线； 3. 修改 TZ 后是否仍会出现固定时差或假离线。  如果问题仍然存在，也请提供管理服务请求 MQTT Gateway 时的 HTTP 状态或相关日志，方便继续定位。  PR: https://github.com/xinnan-tech/xiaozhi-esp32-server/pull/3283

- **Issue #3276** (2026-07-17): **[Bug] ContextProviderListTypeHandler类会导致一些bug问题**
  *Symptoms*: ## 🐛 问题描述  <img width="1012" height="600" alt="Image" src="https://github.com/user-attachments/assets/32b08447-e8c5-4631-b537-e8414374d9cf" />  启动也会发生依赖链路问题报错 2026-07-09 17:02:10.834 [main] DEBUG c.b.m.e.spring.MybatisSqlSessionFactoryBean - Registered plugin: 'MybatisPlusInterceptor{interceptors=[xiaozhi.common.interceptor.DataFilterInterceptor@68fa8ea5, PaginationInnerInterceptor(logger=org.apache.ibatis.logging.slf4j.Slf4jImpl@68c47cf9, overflow=false, maxLimit=null, dbType=null, dialect=null, optimizeJoin=true), com.baomidou.mybatisplus.extension.plugins.inner.OptimisticLockerInnerInterceptor@ecb8b3e, com.baomidou.mybatisplus.extension.plugins.inner.BlockAttackInnerInterceptor@7e764e5c]}' 2026-07-09 17:02:10.968 [main] DEBUG c.b.m.e.spring.MybatisSqlSessionFactoryBean - Parsed mapper file: 'file [D:\xiaozhi-esp32-server\main\manager-api\target\classes\mapper\agent\AgentCorrectWordMappingDao.xml]' 2026-07-09 17:02:10.982 [main] WARN  o.s.b.w.s.c.AnnotationConfigServletWebServerApplicationContext - Exception encountered during context initialization - cancelling refresh attempt: org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'methodValidationPostProcessor' defined in class path resource [org/springframework/boot/autoconfigure/validation/ValidationAutoConfiguration.class]: Failed to instantiate [org.springframework.validation.beanvalidation.MethodValidationPostProcessor]: Factory method 'methodValidationPostProcessor' threw exception 
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，已提交 PR #3279 处理该问题。  本次修复主要包含：  - `ContextProviderListTypeHandler` 改为基于 MyBatis `BaseTypeHandler` 实现，避免 MyBatis-Plus 3.5.6 之后 `AbstractJsonTypeHandler` 接口变化导致的编译冲突。 - 保留 `List<ContextProviderDTO>` 的准确序列化和反序列化类型。 - 补充 MyBatis-Plus 3.5.17 拆分后的 Spring Service、starter、JSqlParser 和批处理适配。 - 增加 Maven profile，支持 MyBatis-Plus 3.5.5、3.5.6、3.5.17 三个版本。  三个版本均已完成 clean 编译和相关运行测试，每个版本 25 项测试全部通过。  PR 当前正在等待评审，issue 会继续保持 Open，并在 PR 合并后自动关闭。如果方便，也请协助在完整 MySQL、Redis 环境中复测启动流程。 
  > @chentyke 建议直接升级MyBatis-Plus最新版本来适配解决问题，以支撑以后使用新特性带来的变化  > 感谢反馈，已提交 PR [#3279](https://github.com/xinnan-tech/xiaozhi-esp32-server/pull/3279) 处理该问题。 >  > 本次修复主要包含： >  > * `ContextProviderListTypeHandler` 改为基于 MyBatis `BaseTypeHandler` 实现，避免 MyBatis-Plus 3.5.6 之后 `AbstractJsonTypeHandler` 接口变化导致的编译冲突。 > * 保留 `List<ContextProviderDTO>` 的准确序列化和反序列化类型。 > * 补充 MyBatis-Plus 3.5.17 拆分后的 Spring Service、starter、JSqlParser 和批处理适配。 > * 增加 Maven profile，支持 MyBatis-Plus 3.5.5、3.5.6、3.5.17 三个版本。 >  > 三个版本均已完成 clean 编译和相关运行测试，每个版本 25 项测试全部通过。 >  > PR 当前正在等待评审，issue 会继续保持 Open，并在 PR 合并后自动关闭。如果方便，也请协助在完整 MySQL、Redis 环境中复测启动流程。  

- **Issue #3264** (2026-07-06): **[Bug] 最近的测试页面又用不了了，测试服务器也用不了，连接不上websocket，和上次一样**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 -->  ## 🖥️ 环境信息 - 部署方式: 全模块部署 还是 单Server部署 - 版本号: 例如 0.3.x  ## 🔍 告诉我们，应该怎么复现这个问题 <!-- 这个很重要，方便我们快速定位 --> 1. 打开 '...' 2. 点击 '...' 3. 滚动到 '...' 4. 看到错误  ## 🤔 你原本希望是怎么样的 <!-- 简要描述预期的正确行为 -->  ## 😯 提供一些截图 <!-- 如果适用，添加问题的截图 --> 1. 比如日志截图，越多越好 2. 比如界面反应  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 
  **Post-Mortem & Fix Analysis**:
  > 再次感谢，终于找到了一个隐藏很久，但是又很难复现的一个bug。

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

### Incident Patch 1: `788f5301` (2026-09-21)
**Commit Message**: Merge pull request #3378 from xinnan-tech/fix-deps

fix(deps): 移除 chardet 直接依赖

**File**: `main/xiaozhi-server/requirements.txt` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ cnlunar==0.2.0
 PySocks==1.7.1
 dashscope==1.25.2
 baidu-aip==4.16.13
-chardet==7.6.0
 aioconsole==0.8.2
 markitdown==0.1.3
 mcp-proxy==0.10.0
```

---

### Incident Patch 2: `edad16ae` (2026-09-20)
**Commit Message**: fix(deps): 移除 chardet 直接依赖

**File**: `main/xiaozhi-server/requirements.txt` (modified, +0/-1)
```diff
@@ -32,7 +32,6 @@ cnlunar==0.2.0
 PySocks==1.7.1
 dashscope==1.25.2
 baidu-aip==4.16.13
-chardet==7.6.0
 aioconsole==0.8.2
 markitdown==0.1.3
 mcp-proxy==0.10.0
```

---

### Incident Patch 3: `f4ba65f2` (2026-09-17)
**Commit Message**: Merge pull request #3375 from xinnan-tech/fix-snapshot-dialog-diff-style

fix: 修复 v-code-diff 斜体样式干扰 diff 展示

**File**: `main/manager-web/src/components/AgentSnapshotDialog.vue` (modified, +1/-1)
```diff
@@ -2479,7 +2479,7 @@ export default {
 
 ::v-deep .code-diff-view .hljs-emphasis,
 ::v-deep .code-diff-view em {
-  font-style: normal;
+  font-style: normal !important;
 }
 
 ::v-deep .code-diff-view .diff-table .blob-code-deletion .x,
```

---

### Incident Patch 4: `87c2bae5` (2026-09-17)
**Commit Message**: fix: 修复 v-code-diff 斜体样式干扰 diff 展示

**File**: `main/manager-web/src/components/AgentSnapshotDialog.vue` (modified, +1/-1)
```diff
@@ -2479,7 +2479,7 @@ export default {
 
 ::v-deep .code-diff-view .hljs-emphasis,
 ::v-deep .code-diff-view em {
-  font-style: normal;
+  font-style: normal !important;
 }
 
 ::v-deep .code-diff-view .diff-table .blob-code-deletion .x,
```

---

### Incident Patch 5: `daccfeb9` (2026-09-11)
**Commit Message**: Merge pull request #3364 from xinnan-tech/fix-memory-title

fix: 记忆模式为nomem时错误生成标题

**File**: `main/xiaozhi-server/core/connection.py` (modified, +4/-1)
```diff
@@ -279,7 +279,10 @@ async def _save_and_close(self, ws):
         """保存记忆并关闭连接"""
         try:
             # 守护线程1：独立生成标题（不依赖记忆模型）
-            if self.session_id:
+            # 仅在服务端开启 chat_history 上报时才触发标题生成，
+            # 否则服务端无法按 session_id 反查到对应的 agent/chat_history，
+            # 会抛出"智能体未找到"错误
+            if self.session_id and self.chat_history_conf != 0:
                 def generate_title_task():
                     try:
                         loop = asyncio.new_event_loop()
```

---

### Incident Patch 6: `d6d2da3d` (2026-09-09)
**Commit Message**: fix: 记忆模式为nomem时错误生成标题

**File**: `main/xiaozhi-server/core/connection.py` (modified, +4/-1)
```diff
@@ -279,7 +279,10 @@ async def _save_and_close(self, ws):
         """保存记忆并关闭连接"""
         try:
             # 守护线程1：独立生成标题（不依赖记忆模型）
-            if self.session_id:
+            # 仅在服务端开启 chat_history 上报时才触发标题生成，
+            # 否则服务端无法按 session_id 反查到对应的 agent/chat_history，
+            # 会抛出"智能体未找到"错误
+            if self.session_id and self.chat_history_conf != 0:
                 def generate_title_task():
                     try:
                         loop = asyncio.new_event_loop()
```

---

### Incident Patch 7: `5aa46538` (2026-09-08)
**Commit Message**: Merge pull request #3358 from xinnan-tech/fix-audio-delay

fix: 修复固定延迟不生效，调整相关逻辑

**File**: `main/xiaozhi-server/core/handle/sendAudioHandle.py` (modified, +26/-21)
```diff
@@ -64,16 +64,19 @@ async def _wait_for_audio_completion(conn: "ConnectionHandler"):
     """
     if hasattr(conn, "audio_rate_controller") and conn.audio_rate_controller:
         rate_controller = conn.audio_rate_controller
+        send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
         conn.logger.bind(tag=TAG).debug(
             f"等待音频发送完成，队列中还有 {len(rate_controller.queue)} 个包"
         )
         await rate_controller.queue_empty_event.wait()
 
-        # 等待预缓冲包播放完成
-        # 前N个包直接发送，增加2个网络抖动包，需要额外等待它们在客户端播放完成
-        frame_duration_ms = rate_controller.frame_duration
-        pre_buffer_playback_time = (PRE_BUFFER_COUNT + 2) * frame_duration_ms / 1000.0
-        await asyncio.sleep(pre_buffer_playback_time)
+        if send_delay_ms > 0:
+            # 自定义节奏：等待最后帧在客户端播放完成
+            playback_time = 2 * rate_controller.interval_ms / 1000.0
+        else:
+            # 默认节奏：前 N 帧预缓冲已直接发出，需要等待它们播放完成
+            playback_time = (PRE_BUFFER_COUNT + 2) * rate_controller.interval_ms / 1000.0
+        await asyncio.sleep(playback_time)
 
         conn.logger.bind(tag=TAG).debug("音频发送完成")
 
@@ -127,25 +130,25 @@ async def sendAudio(
     if audios is None or len(audios) == 0:
         return
 
-    send_delay = conn.config.get("tts_audio_send_delay", -1) / 1000.0
+    send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
     is_single_packet = isinstance(audios, bytes)
 
     # 初始化或获取 RateController
     rate_controller, flow_control = _get_or_create_rate_controller(
-        conn, frame_duration, is_single_packet
+        conn, frame_duration, is_single_packet, send_delay_ms
     )
 
     # 统一转换为列表处理
     audio_list = [audios] if is_single_packet else audios
 
     # 发送音频包
     await _send_audio_with_rate_control(
-        conn, audio_list, rate_controller, flow_control, send_delay
+        conn, audio_list, rate_controller, flow_control, send_delay_ms
     )
 
 
 def _get_or_create_rate_controller(
-    conn: "ConnectionHandler", frame_duration, is_single_packet
+    conn: "ConnectionHandler", frame_duration, is_single_packet, send_delay_ms=0
 ):
     """
     获取或创建 RateController 和 flow_control
@@ -154,6 +157,7 @@ def _get_or_create_rate_controller(
         conn: 连接对象
         frame_duration: 帧时长
         is_single_packet: 是否单包模式（True: TTS流式单包, False: 批量包）
+        send_delay_ms: 自定义发送间隔（毫秒）。
 
     Returns:
         (rate_controller, flow_control)
@@ -183,7 +187,9 @@ def _get_or_create_rate_controller(
     if need_reset:
         # 创建或获取 rate_controller
         if not hasattr(conn, "audio_rate_controller"):
-            conn.audio_rate_controller = AudioRateController(frame_duration)
+            conn.audio_rate_controller = AudioRateController(
+                frame_duration, send_delay=send_delay_ms
+            )
         else:
             conn.audio_rate_controller.reset()
 
@@ -225,7 +231,7 @@ async def send_callback(packet):
 
 
 async def _send_audio_with_rate_control(
-    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay
+    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay_ms
 ):
     """
     使用 rate_controller 发送音频包
@@ -235,24 +241,23 @@ async def _send_audio_with_rate_control(
         audio_list: 音频包列表
         rate_controller: 速率控制器
         flow_control: 流控状态
-        send_delay: 固定延迟（秒），-1表示使用动态流控
+        send_delay_ms: 自定义发送间隔（毫秒）。
     """
     for packet in audio_list:
         if conn.client_abort:
             return
 
         conn.last_activity_time = time.time() * 1000
 
-        # 预缓冲：前N个包直接发送
-        if flow_control["packet_count"] < PRE_BUFFER_COUNT:
-            await _do_send_audio(conn, packet, flow_control)
-        elif send_delay > 0:
-            # 固定延迟模式
-            await asyncio.sleep(send_delay)
-            await _do_send_audio(conn, packet, flow_control)
-        else:
-            # 动态流控模式：仅添加到队列，由后台循环负责发送
+        if send_delay_ms > 0:
+            # 自定义节奏模式：所有包入队按 send_delay 发（关闭预缓冲）
             rate_controller.add_audio(packet)
+        else:
+            # 默认节奏模式（60ms/包）：前 N 包预缓冲直接发，后续入队由后台任务按 interval_ms 节奏发
+            if flow_control["packet_count"] < PRE_BUFFER_COUNT:
+                await _do_send_audio(conn, packet, flow_control)
+            else:
+                rate_controller.add_audio(packet)
 
 
 async def _do_send_audio(conn: "ConnectionHandler", opus_packet, flow_control):
```

**File**: `main/xiaozhi-server/core/utils/audioRateController.py` (modified, +9/-5)
```diff
@@ -13,12 +13,16 @@ class AudioRateController:
     解决高并发下的时间累积误差问题
     """
 
-    def __init__(self, frame_duration=60):
+    def __init__(self, frame_duration=60, send_delay=0):
         """
         Args:
             frame_duration: 单个音频帧时长（毫秒），默认60ms
+            send_delay: 自定义发送间隔（毫秒）。
+                        0 = 按 frame_duration 节奏发；
+                        >0 = 按 send_delay 节奏发（主线程不入队延迟，无预缓冲）
         """
-        self.frame_duration = frame_duration
+        # 流控间隔（毫秒）：send_delay > 0 时用配置值，否则用 frame_duration
+        self.interval_ms = send_delay if send_delay > 0 else frame_duration
         self.queue = deque()
         self.play_position = 0  # 虚拟播放位置（毫秒）
         self.start_timestamp = None  # 开始时间戳（只读，不修改）
@@ -51,7 +55,7 @@ def add_audio(self, opus_packet):
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
             # 只有间隔超过1帧时长，才认为是真正的"暂停恢复"
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -71,7 +75,7 @@ def add_message(self, message_callback):
         """
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -138,7 +142,7 @@ async def check_queue(self, send_audio_callback):
 
                 # 时间已到，从队列移除并发送
                 self.queue.popleft()
-                self.play_position += self.frame_duration
+                self.play_position += self.interval_ms
                 try:
                     await send_audio_callback(opus_packet)
                 except Exception as e:
```

---

### Incident Patch 8: `79a95af3` (2026-09-07)
**Commit Message**: fix: 修复固定延迟不生效，调整相关逻辑

**File**: `main/xiaozhi-server/core/handle/sendAudioHandle.py` (modified, +26/-21)
```diff
@@ -64,16 +64,19 @@ async def _wait_for_audio_completion(conn: "ConnectionHandler"):
     """
     if hasattr(conn, "audio_rate_controller") and conn.audio_rate_controller:
         rate_controller = conn.audio_rate_controller
+        send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
         conn.logger.bind(tag=TAG).debug(
             f"等待音频发送完成，队列中还有 {len(rate_controller.queue)} 个包"
         )
         await rate_controller.queue_empty_event.wait()
 
-        # 等待预缓冲包播放完成
-        # 前N个包直接发送，增加2个网络抖动包，需要额外等待它们在客户端播放完成
-        frame_duration_ms = rate_controller.frame_duration
-        pre_buffer_playback_time = (PRE_BUFFER_COUNT + 2) * frame_duration_ms / 1000.0
-        await asyncio.sleep(pre_buffer_playback_time)
+        if send_delay_ms > 0:
+            # 自定义节奏：等待最后帧在客户端播放完成
+            playback_time = 2 * rate_controller.interval_ms / 1000.0
+        else:
+            # 默认节奏：前 N 帧预缓冲已直接发出，需要等待它们播放完成
+            playback_time = (PRE_BUFFER_COUNT + 2) * rate_controller.interval_ms / 1000.0
+        await asyncio.sleep(playback_time)
 
         conn.logger.bind(tag=TAG).debug("音频发送完成")
 
@@ -127,25 +130,25 @@ async def sendAudio(
     if audios is None or len(audios) == 0:
         return
 
-    send_delay = conn.config.get("tts_audio_send_delay", -1) / 1000.0
+    send_delay_ms = conn.config.get("tts_audio_send_delay", 0)
     is_single_packet = isinstance(audios, bytes)
 
     # 初始化或获取 RateController
     rate_controller, flow_control = _get_or_create_rate_controller(
-        conn, frame_duration, is_single_packet
+        conn, frame_duration, is_single_packet, send_delay_ms
     )
 
     # 统一转换为列表处理
     audio_list = [audios] if is_single_packet else audios
 
     # 发送音频包
     await _send_audio_with_rate_control(
-        conn, audio_list, rate_controller, flow_control, send_delay
+        conn, audio_list, rate_controller, flow_control, send_delay_ms
     )
 
 
 def _get_or_create_rate_controller(
-    conn: "ConnectionHandler", frame_duration, is_single_packet
+    conn: "ConnectionHandler", frame_duration, is_single_packet, send_delay_ms=0
 ):
     """
     获取或创建 RateController 和 flow_control
@@ -154,6 +157,7 @@ def _get_or_create_rate_controller(
         conn: 连接对象
         frame_duration: 帧时长
         is_single_packet: 是否单包模式（True: TTS流式单包, False: 批量包）
+        send_delay_ms: 自定义发送间隔（毫秒）。
 
     Returns:
         (rate_controller, flow_control)
@@ -183,7 +187,9 @@ def _get_or_create_rate_controller(
     if need_reset:
         # 创建或获取 rate_controller
         if not hasattr(conn, "audio_rate_controller"):
-            conn.audio_rate_controller = AudioRateController(frame_duration)
+            conn.audio_rate_controller = AudioRateController(
+                frame_duration, send_delay=send_delay_ms
+            )
         else:
             conn.audio_rate_controller.reset()
 
@@ -225,7 +231,7 @@ async def send_callback(packet):
 
 
 async def _send_audio_with_rate_control(
-    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay
+    conn: "ConnectionHandler", audio_list, rate_controller, flow_control, send_delay_ms
 ):
     """
     使用 rate_controller 发送音频包
@@ -235,24 +241,23 @@ async def _send_audio_with_rate_control(
         audio_list: 音频包列表
         rate_controller: 速率控制器
         flow_control: 流控状态
-        send_delay: 固定延迟（秒），-1表示使用动态流控
+        send_delay_ms: 自定义发送间隔（毫秒）。
     """
     for packet in audio_list:
         if conn.client_abort:
             return
 
         conn.last_activity_time = time.time() * 1000
 
-        # 预缓冲：前N个包直接发送
-        if flow_control["packet_count"] < PRE_BUFFER_COUNT:
-            await _do_send_audio(conn, packet, flow_control)
-        elif send_delay > 0:
-            # 固定延迟模式
-            await asyncio.sleep(send_delay)
-            await _do_send_audio(conn, packet, flow_control)
-        else:
-            # 动态流控模式：仅添加到队列，由后台循环负责发送
+        if send_delay_ms > 0:
+            # 自定义节奏模式：所有包入队按 send_delay 发（关闭预缓冲）
             rate_controller.add_audio(packet)
+        else:
+            # 默认节奏模式（60ms/包）：前 N 包预缓冲直接发，后续入队由后台任务按 interval_ms 节奏发
+            if flow_control["packet_count"] < PRE_BUFFER_COUNT:
+                await _do_send_audio(conn, packet, flow_control)
+            else:
+                rate_controller.add_audio(packet)
 
 
 async def _do_send_audio(conn: "ConnectionHandler", opus_packet, flow_control):
```

**File**: `main/xiaozhi-server/core/utils/audioRateController.py` (modified, +9/-5)
```diff
@@ -13,12 +13,16 @@ class AudioRateController:
     解决高并发下的时间累积误差问题
     """
 
-    def __init__(self, frame_duration=60):
+    def __init__(self, frame_duration=60, send_delay=0):
         """
         Args:
             frame_duration: 单个音频帧时长（毫秒），默认60ms
+            send_delay: 自定义发送间隔（毫秒）。
+                        0 = 按 frame_duration 节奏发；
+                        >0 = 按 send_delay 节奏发（主线程不入队延迟，无预缓冲）
         """
-        self.frame_duration = frame_duration
+        # 流控间隔（毫秒）：send_delay > 0 时用配置值，否则用 frame_duration
+        self.interval_ms = send_delay if send_delay > 0 else frame_duration
         self.queue = deque()
         self.play_position = 0  # 虚拟播放位置（毫秒）
         self.start_timestamp = None  # 开始时间戳（只读，不修改）
@@ -51,7 +55,7 @@ def add_audio(self, opus_packet):
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
             # 只有间隔超过1帧时长，才认为是真正的"暂停恢复"
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -71,7 +75,7 @@ def add_message(self, message_callback):
         """
         if len(self.queue) == 0 and self.play_position > 0:
             elapsed_since_empty = (time.monotonic() - self._last_queue_empty_time) * 1000
-            if elapsed_since_empty >= self.frame_duration:
+            if elapsed_since_empty >= self.interval_ms:
                 self.start_timestamp = time.monotonic() - (self.play_position / 1000)
                 self.logger.bind(tag=TAG).debug(
                     f"队列从空恢复，重置时间戳，当前播放位置: {self.play_position}ms，间隔: {elapsed_since_empty:.0f}ms"
@@ -138,7 +142,7 @@ async def check_queue(self, send_audio_callback):
 
                 # 时间已到，从队列移除并发送
                 self.queue.popleft()
-                self.play_position += self.frame_duration
+                self.play_position += self.interval_ms
                 try:
                     await send_audio_callback(opus_packet)
                 except Exception as e:
```

---

### Incident Patch 9: `32cba362` (2026-09-07)
**Commit Message**: fix: 修复 ManageApiClient 关闭期间的连接池创建竞态

**File**: `main/xiaozhi-server/config/manage_api_client.py` (modified, +30/-26)
```diff
@@ -60,31 +60,33 @@ async def _ensure_async_client(cls):
         """确保异步客户端已创建（为每个事件循环创建独立的客户端）"""
         import asyncio
 
-        if cls._closed:
-            raise Exception("ManageApiClient已关闭，不再创建新的HTTP客户端")
-
         try:
             loop = asyncio.get_running_loop()
             loop_id = id(loop)
 
-            # 为每个事件循环创建独立的客户端
-            if loop_id not in cls._async_clients:
-                # 服务端可能主动关闭连接，httpx 连接池无法正确检测和清理
-                limits = httpx.Limits(
-                    max_keepalive_connections=0,  # 禁用 keep-alive，每次都新建连接
-                )
-                cls._async_clients[loop_id] = httpx.AsyncClient(
-                    base_url=cls.config.get("url"),
-                    headers={
-                        "User-Agent": f"PythonClient/2.0 (PID:{os.getpid()})",
-                        "Accept": "application/json",
-                        "Authorization": "Bearer " + cls._secret,
-                    },
-                    timeout=cls.config.get("timeout", 30),
-                    limits=limits,  # 使用限制
-                    trust_env=False,
-                )
-            return cls._async_clients[loop_id]
+            # 检查关闭状态与创建连接池必须是同一个临界区，避免 safe_close()
+            # 清空连接池后又有请求将新客户端写回。
+            with cls._instance_lock:
+                if cls._closed:
+                    raise Exception("ManageApiClient已关闭，不再创建新的HTTP客户端")
+
+                if loop_id not in cls._async_clients:
+                    # 服务端可能主动关闭连接，httpx 连接池无法正确检测和清理
+                    limits = httpx.Limits(
+                        max_keepalive_connections=0,  # 禁用 keep-alive，每次都新建连接
+                    )
+                    cls._async_clients[loop_id] = httpx.AsyncClient(
+                        base_url=cls.config.get("url"),
+                        headers={
+                            "User-Agent": f"PythonClient/2.0 (PID:{os.getpid()})",
+                            "Accept": "application/json",
+                            "Authorization": "Bearer " + cls._secret,
+                        },
+                        timeout=cls.config.get("timeout", 30),
+                        limits=limits,  # 使用限制
+                        trust_env=False,
+                    )
+                return cls._async_clients[loop_id]
         except RuntimeError:
             # 如果没有运行中的事件循环，创建一个临时的
             raise Exception("必须在异步上下文中调用")
@@ -176,14 +178,16 @@ def safe_close(cls):
 
         with cls._instance_lock:
             cls._closed = True
-            for client in list(cls._async_clients.values()):
-                try:
-                    asyncio.run(client.aclose())
-                except Exception:
-                    pass
+            clients = list(cls._async_clients.values())
             cls._async_clients.clear()
             cls._instance = None
 
+        for client in clients:
+            try:
+                asyncio.run(client.aclose())
+            except Exception:
+                pass
+
 
 def api_guard(error_msg: str = None, raise_when_closed: bool = False):
     """装饰器：统一获取单例实例、判空与异常兜底
```

---

### Incident Patch 10: `82e3c187` (2026-09-07)
**Commit Message**: Merge pull request #3353 from muxinshijie/feature/manage-api-client-toctou

fix: 根治ManageApiClient单例TOCTOU竞态，锁保护+统一防护 #3339

**File**: `main/xiaozhi-server/config/manage_api_client.py` (modified, +114/-92)
```diff
@@ -1,5 +1,7 @@
 import os
 import base64
+import functools
+import threading
 from typing import Optional, Dict
 
 import httpx
@@ -19,15 +21,18 @@ def __init__(self, bind_code):
 
 class ManageApiClient:
     _instance = None
+    _instance_lock = threading.Lock()  # 保护 _instance 与 _closed 的读写
     _async_clients = {}  # 为每个事件循环存储独立的客户端
     _secret = None
+    _closed = False  # safe_close() 后置为 True，关闭后不再创建新连接
 
     def __new__(cls, config):
         """单例模式确保全局唯一实例，并支持传入配置参数"""
-        if cls._instance is None:
-            cls._instance = super().__new__(cls)
-            cls._init_client(config)
-        return cls._instance
+        with cls._instance_lock:
+            if cls._instance is None:
+                cls._instance = super().__new__(cls)
+                cls._init_client(config)
+            return cls._instance
 
     @classmethod
     def _init_client(cls, config):
@@ -48,12 +53,16 @@ def _init_client(cls, config):
         cls.retry_delay = cls.config.get("retry_delay", 10)  # 初始重试延迟(秒)
         # 不在这里创建 AsyncClient，延迟到实际使用时创建
         cls._async_clients = {}
+        cls._closed = False
 
     @classmethod
     async def _ensure_async_client(cls):
         """确保异步客户端已创建（为每个事件循环创建独立的客户端）"""
         import asyncio
 
+        if cls._closed:
+            raise Exception("ManageApiClient已关闭，不再创建新的HTTP客户端")
+
         try:
             loop = asyncio.get_running_loop()
             loop_id = id(loop)
@@ -148,32 +157,78 @@ async def _execute_async_request(cls, method: str, endpoint: str, **kwargs) -> D
                     # 不重试，直接抛出异常
                     raise
 
+    @classmethod
+    def _get_instance(cls):
+        """线程安全地获取单例实例引用
+
+        调用方应使用返回的局部引用，而不是判空后再次读取
+        ManageApiClient._instance：即使随后 safe_close() 将 _instance
+        置为 None，已获取的引用仍指向原对象，从而消除"判空之后、
+        使用之前实例被置空"的 TOCTOU 竞态窗口。
+        """
+        with cls._instance_lock:
+            return cls._instance
+
     @classmethod
     def safe_close(cls):
         """安全关闭所有异步连接池"""
         import asyncio
 
-        for client in list(cls._async_clients.values()):
+        with cls._instance_lock:
+            cls._closed = True
+            for client in list(cls._async_clients.values()):
+                try:
+                    asyncio.run(client.aclose())
+                except Exception:
+                    pass
+            cls._async_clients.clear()
+            cls._instance = None
+
+
+def api_guard(error_msg: str = None, raise_when_closed: bool = False):
+    """装饰器：统一获取单例实例、判空与异常兜底
+
+    - 通过 _get_instance() 一次性获取实例局部引用，注入为被装饰函数的
+      第一个参数，消除与 safe_close() 之间的 TOCTOU 竞态窗口；
+    - 实例未初始化或已关闭时：raise_when_closed=True 抛出明确异常
+      （用于启动路径函数），否则静默返回 None（用于守护线程路径）；
+    - error_msg 不为 None 时捕获请求异常、打印日志并返回 None；
+      为 None 时异常原样抛出，由调用方处理。
+    """
+
+    def decorator(func):
+        @functools.wraps(func)
+        async def wrapper(*args, **kwargs):
+            instance = ManageApiClient._get_instance()
+            if instance is None:
+                if raise_when_closed:
+                    raise Exception("ManageApiClient未初始化或已关闭")
+                return None
+            if error_msg is None:
+                return await func(instance, *args, **kwargs)
             try:
-                asyncio.run(client.aclose())
-            except Exception:
-                pass
-        cls._async_clients.clear()
-        cls._instance = None
+                return await func(instance, *args, **kwargs)
+            except Exception as e:
+                print(f"{error_msg}: {e}")
+                return None
+
+        return wrapper
+
+    return decorator
 
 
-async def get_server_config() -> Optional[Dict]:
+@api_guard(raise_when_closed=True)
+async def get_server_config(instance) -> Optional[Dict]:
     """获取服务器基础配置"""
-    return await ManageApiClient._instance._execute_async_request(
-        "POST", "/config/server-base"
-    )
+    return await instance._execute_async_request("POST", "/config/server-base")
 
 
+@api_guard(raise_when_closed=True)
 async def get_agent_models(
-    mac_address: str, client_id: str, selected_module: Dict
+    instance, mac_address: str, client_id: str, selected_module: Dict
 ) -> Optional[Dict]:
     """获取代理模型配置"""
-    return await ManageApiClient._instance._execute_async_request(
+    return await instance._execute_async_request(
         "POST",
         "/config/agent-models",
         json={
@@ -184,96 +239,63 @@ async def get_agent_models(
     )
 
 
-async def get_correct_words(mac_address: str) -> Optional[Dict]:
+@api_guard("获取替换词失败")
+async def get_correct_words(instance, mac_address: str) -> Optional[Dict]:
     """获取智能体替换词"""
-    try:
-        return await ManageApiClient._instance._execute_async_request(
-            "POST", "/config/correct-words",
-            json={"macAddress": mac_address}
-        )
-    except Exception as e:
-        print(f"获取替换词失败: {e}")
-        return None
-
-
-async def generate_and_save_chat_summary(session_id:
```

---

### Incident Patch 11: `c4782575` (2026-09-06)
**Commit Message**: Merge pull request #3356 from xinnan-tech/fix/docs-typos

docs: 批量修正文档里的错别字和拼写错误

**File**: `docs/Deployment.md` (modified, +2/-2)
```diff
@@ -70,7 +70,7 @@ xiaozhi-server
 
 ## 2. 配置项目文件
 
-接下里，程序还不能直接运行，你需要配置一下，你到底使用的是什么模型。你可以看这个教程：
+接下来，程序还不能直接运行，你需要配置一下，你到底使用的是什么模型。你可以看这个教程：
 [跳转到配置项目文件](#配置项目)
 
 配置完项目文件后，回到本教程继续往下。
@@ -119,7 +119,7 @@ docker rmi ghcr.nju.edu.cn/xinnan-tech/xiaozhi-esp32-server:web_latest
 如果确定使用`conda`，则安装好后，开始执行以下命令。
 
 重要提示！windows 用户，可以通过安装`Anaconda`来管理环境。安装好`Anaconda`后，在`开始`那里搜索`anaconda`相关的关键词，
-找到`Anaconda Prpmpt`，使用管理员身份运行它。如下图。
+找到`Anaconda Prompt`，使用管理员身份运行它。如下图。
 
 ![conda_prompt](./images/conda_env_1.png)
 
```

**File**: `docs/Deployment_all.md` (modified, +1/-1)
```diff
@@ -335,7 +335,7 @@ npm run serve
 如果确定使用`conda`，则安装好后，开始执行以下命令。
 
 重要提示！windows 用户，可以通过安装`Anaconda`来管理环境。安装好`Anaconda`后，在`开始`那里搜索`anaconda`相关的关键词，
-找到`Anaconda Prpmpt`，使用管理员身份运行它。如下图。
+找到`Anaconda Prompt`，使用管理员身份运行它。如下图。
 
 ![conda_prompt](./images/conda_env_1.png)
 
```

**File**: `docs/context-provider-integration.md` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 `上下文源` 在小智在唤醒那一刻，获取外部系统的数据，并将其动态注入到大模型的系统提示词（System Prompt）中。
 让其做到唤醒时感知世界某个事物的状态。
 
-它和MCP、记忆有本质的区别：`上下文源`是强制让小智感知世界的数据；`记忆(Mem)`是让他知道之前聊了什么内容；`MCP(functionc all)`是当需要调用某项能力/知识的时候使用调用。
+它和MCP、记忆有本质的区别：`上下文源`是强制让小智感知世界的数据；`记忆(Mem)`是让他知道之前聊了什么内容；`MCP(function_call)`是当需要调用某项能力/知识的时候使用调用。
 
 通过这个功能，在小智唤醒的一刹那，“感知”到：
 - 人体健康传感器状态（体温、血压、血氧状态等）
```

**File**: `docs/dev-ops-integration.md` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@ cp 你原来的model.pt完整路径 /home/system/xiaozhi/xiaozhi-esp32-server/ma
 
 # 第四步 建立三个自动编译文件
 
-## 4.1 自动编译mananger-web模块
+## 4.1 自动编译manager-web模块
 在`/home/system/xiaozhi/`目录下，创建名字为`update_8001.sh`的文件，内容如下
 
 ```
@@ -106,7 +106,7 @@ fi
 
 nohup java -jar xiaozhi-esp32-api.jar --spring.profiles.active=dev &
 
-tail tail -f nohup.out
+tail -f nohup.out
 ```
 
 保存好后执行赋权命令
```

**File**: `docs/fish-speech-integration.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ python download_models.py
 python -m tools.api_server --listen 0.0.0.0:6006 
 ```
 
-然后用浏览器去到aotodl实例页面
+然后用浏览器去到autodl实例页面
 ```
 https://autodl.com/console/instance/list
 ```
```

**File**: `docs/homeassistant-integration.md` (modified, +2/-2)
```diff
@@ -68,7 +68,7 @@ http://homeassistant.local:8123
 
 然后在实体中搜索你相关控制的开关，结果出来后，在列表中，点击其中一个结果，这是会出现一个开关的界面。
 
-在开关的界面，我们尝试点击开关，看看是开发会随着我们的点击开/关。如果能操作，说明是正常联网的。
+在开关的界面，我们尝试点击开关，看看是否会随着我们的点击开/关。如果能操作，说明是正常联网的。
 
 接着在开关面板找到设置按钮，点击后，可以查看这个开关的`实体标识符`。
 
@@ -107,7 +107,7 @@ http://homeassistant.local:8123
 
 保存成功后，即可唤醒设备操作。
 
-#### 3. 唤醒设别进行控制
+#### 3. 唤醒设备进行控制
 
 尝试和esp32说，“打开XXX灯”
 
```

**File**: `docs/huoshan-streamTTS-voice-cloning.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 本教程分为4个阶段：准备阶段、配置阶段、克隆阶段、使用阶段。主要是介绍通过智控台配置火山双流式语音合成+音色克隆的过程。
 
 ## 第一阶段：准备阶段
-超级管理员先预先把火山引擎服务开通好，获取到App Id，Access Token。默认火上引擎会赠送一个音色资源。这个音色资源需要把它复制到本项目里。
+超级管理员先预先把火山引擎服务开通好，获取到App Id，Access Token。默认火山引擎会赠送一个音色资源。这个音色资源需要把它复制到本项目里。
 
 如果你想克隆多个音色，需要购买开通多个音色资源。只要把每个音色资源的声音ID(S_xxxxx)复制到本项目。然后分配给系统的账号使用即可。以下是详细步骤：
 
```

**File**: `docs/mcp-endpoint-integration.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@
 
 打开完，找到页面中一个绿色的按钮，写着`Code`的按钮，点开它，然后你就看到`Download ZIP`的按钮。
 
-点击它，下载本项目源码压缩包。下载到你电脑后，解压它，此时它的名字可能叫`mcp-calculatorr-main`
+点击它，下载本项目源码压缩包。下载到你电脑后，解压它，此时它的名字可能叫`mcp-calculator-main`
 你需要把它重命名成`mcp-calculator`。接下来，我们用命令行进入项目目录即安装依赖
 
 
```

---

### Incident Patch 12: `9fdb72cf` (2026-09-06)
**Commit Message**: Merge pull request #3355 from xinnan-tech/fix/3354-建议修改docsmcpvisionintegrationmd

docs: 修正视觉模型配置文档里的错字

**File**: `docs/mcp-vision-integration.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ server:
 
 那我们需要先登录[智谱AI](https://bigmodel.cn/usercenter/proj-mgmt/apikeys)网站，申请密钥。如果你之前已经申请过了密钥，可以复用这个密钥。
 
-登录`智控台`，顶部菜单点击`模型配置`，在左侧栏点击`视觉打语言模型`，找到`VLLM_ChatGLMVLLM`，点击修改按钮，在弹框中，在`API密钥`输入你密钥，点击保存。
+登录`智控台`，顶部菜单点击`模型配置`，在左侧栏点击`视觉大语言模型`，找到`VLLM_ChatGLMVLLM`，点击修改按钮，在弹框中，在`API密钥`输入你密钥，点击保存。
 
 保存成功后，去到你需要测试的智能体哪里，点击`配置角色`，在打开的内容里，查看`视觉大语言模型(VLLM)`是否选择了刚才的视觉模型。点击保存。
 
```

---

### Incident Patch 13: `61e48798` (2026-09-04)
**Commit Message**: fix: 根治ManageApiClient单例TOCTOU竞态，锁保护+统一防护 #3339

**File**: `main/xiaozhi-server/config/manage_api_client.py` (modified, +114/-92)
```diff
@@ -1,5 +1,7 @@
 import os
 import base64
+import functools
+import threading
 from typing import Optional, Dict
 
 import httpx
@@ -19,15 +21,18 @@ def __init__(self, bind_code):
 
 class ManageApiClient:
     _instance = None
+    _instance_lock = threading.Lock()  # 保护 _instance 与 _closed 的读写
     _async_clients = {}  # 为每个事件循环存储独立的客户端
     _secret = None
+    _closed = False  # safe_close() 后置为 True，关闭后不再创建新连接
 
     def __new__(cls, config):
         """单例模式确保全局唯一实例，并支持传入配置参数"""
-        if cls._instance is None:
-            cls._instance = super().__new__(cls)
-            cls._init_client(config)
-        return cls._instance
+        with cls._instance_lock:
+            if cls._instance is None:
+                cls._instance = super().__new__(cls)
+                cls._init_client(config)
+            return cls._instance
 
     @classmethod
     def _init_client(cls, config):
@@ -48,12 +53,16 @@ def _init_client(cls, config):
         cls.retry_delay = cls.config.get("retry_delay", 10)  # 初始重试延迟(秒)
         # 不在这里创建 AsyncClient，延迟到实际使用时创建
         cls._async_clients = {}
+        cls._closed = False
 
     @classmethod
     async def _ensure_async_client(cls):
         """确保异步客户端已创建（为每个事件循环创建独立的客户端）"""
         import asyncio
 
+        if cls._closed:
+            raise Exception("ManageApiClient已关闭，不再创建新的HTTP客户端")
+
         try:
             loop = asyncio.get_running_loop()
             loop_id = id(loop)
@@ -148,32 +157,78 @@ async def _execute_async_request(cls, method: str, endpoint: str, **kwargs) -> D
                     # 不重试，直接抛出异常
                     raise
 
+    @classmethod
+    def _get_instance(cls):
+        """线程安全地获取单例实例引用
+
+        调用方应使用返回的局部引用，而不是判空后再次读取
+        ManageApiClient._instance：即使随后 safe_close() 将 _instance
+        置为 None，已获取的引用仍指向原对象，从而消除"判空之后、
+        使用之前实例被置空"的 TOCTOU 竞态窗口。
+        """
+        with cls._instance_lock:
+            return cls._instance
+
     @classmethod
     def safe_close(cls):
         """安全关闭所有异步连接池"""
         import asyncio
 
-        for client in list(cls._async_clients.values()):
+        with cls._instance_lock:
+            cls._closed = True
+            for client in list(cls._async_clients.values()):
+                try:
+                    asyncio.run(client.aclose())
+                except Exception:
+                    pass
+            cls._async_clients.clear()
+            cls._instance = None
+
+
+def api_guard(error_msg: str = None, raise_when_closed: bool = False):
+    """装饰器：统一获取单例实例、判空与异常兜底
+
+    - 通过 _get_instance() 一次性获取实例局部引用，注入为被装饰函数的
+      第一个参数，消除与 safe_close() 之间的 TOCTOU 竞态窗口；
+    - 实例未初始化或已关闭时：raise_when_closed=True 抛出明确异常
+      （用于启动路径函数），否则静默返回 None（用于守护线程路径）；
+    - error_msg 不为 None 时捕获请求异常、打印日志并返回 None；
+      为 None 时异常原样抛出，由调用方处理。
+    """
+
+    def decorator(func):
+        @functools.wraps(func)
+        async def wrapper(*args, **kwargs):
+            instance = ManageApiClient._get_instance()
+            if instance is None:
+                if raise_when_closed:
+                    raise Exception("ManageApiClient未初始化或已关闭")
+                return None
+            if error_msg is None:
+                return await func(instance, *args, **kwargs)
             try:
-                asyncio.run(client.aclose())
-            except Exception:
-                pass
-        cls._async_clients.clear()
-        cls._instance = None
+                return await func(instance, *args, **kwargs)
+            except Exception as e:
+                print(f"{error_msg}: {e}")
+                return None
+
+        return wrapper
+
+    return decorator
 
 
-async def get_server_config() -> Optional[Dict]:
+@api_guard(raise_when_closed=True)
+async def get_server_config(instance) -> Optional[Dict]:
     """获取服务器基础配置"""
-    return await ManageApiClient._instance._execute_async_request(
-        "POST", "/config/server-base"
-    )
+    return await instance._execute_async_request("POST", "/config/server-base")
 
 
+@api_guard(raise_when_closed=True)
 async def get_agent_models(
-    mac_address: str, client_id: str, selected_module: Dict
+    instance, mac_address: str, client_id: str, selected_module: Dict
 ) -> Optional[Dict]:
     """获取代理模型配置"""
-    return await ManageApiClient._instance._execute_async_request(
+    return await instance._execute_async_request(
         "POST",
         "/config/agent-models",
         json={
@@ -184,96 +239,63 @@ async def get_agent_models(
     )
 
 
-async def get_correct_words(mac_address: str) -> Optional[Dict]:
+@api_guard("获取替换词失败")
+async def get_correct_words(instance, mac_address: str) -> Optional[Dict]:
     """获取智能体替换词"""
-    try:
-        return await ManageApiClient._instance._execute_async_request(
-            "POST", "/config/correct-words",
-            json={"macAddress": mac_address}
-        )
-    except Exception as e:
-        print(f"获取替换词失败: {e}")
-        return None
-
-
-async def generate_and_save_chat_summary(session_id:
```

---

### Incident Patch 14: `eda3c23d` (2026-09-04)
**Commit Message**: fix: disable library WebSocket keepalive for device server

websockets.serve() defaults to ping_interval=20 and ping_timeout=20.
ESP32 clients that do not answer those pings are dropped with
1011 keepalive ping timeout roughly 40 seconds into a healthy session.
The application-level ping is configured separately via
enable_websocket_ping.

Refs #3348

**File**: `main/xiaozhi-server/core/websocket_server.py` (modified, +5/-1)
```diff
@@ -74,7 +74,11 @@ async def start(self):
         port = int(server_config.get("port", 8000))
 
         async with websockets.serve(
-            self._handle_connection, host, port, process_request=self._http_response
+            self._handle_connection,
+            host,
+            port,
+            process_request=self._http_response,
+            ping_interval=None,
         ):
             await asyncio.Future()
 
```

---

### Incident Patch 15: `a03a0a73` (2026-09-04)
**Commit Message**: fix: send server hello before MCP initialize

The MCP initialize task was scheduled before the server hello was sent,
so the MCP frame could reach the device first. ESP32 firmware waits for
the server hello before it treats the channel as ready, so the device
never answered the initialize request.

Refs #3347

**File**: `main/xiaozhi-server/core/handle/helloHandle.py` (modified, +4/-2)
```diff
@@ -54,14 +54,16 @@ async def handleHelloMessage(conn: "ConnectionHandler", msg_json):
         if features.get("mcp"):
             conn.logger.bind(tag=TAG).debug("客户端支持MCP")
             conn.mcp_client = MCPClient()
-            # 发送初始化
-            asyncio.create_task(send_mcp_initialize_message(conn))
         if features.get("aec"):
             conn.logger.bind(tag=TAG).debug("客户端启用了服务端AEC")
             conn.client_aec = True
 
     await conn.websocket.send(json.dumps(conn.welcome_msg))
 
+    # The device waits for the server hello before processing MCP messages.
+    if features and features.get("mcp"):
+        asyncio.create_task(send_mcp_initialize_message(conn))
+
 
 async def checkWakeupWords(conn: "ConnectionHandler", text):
     enable_wakeup_words_response_cache = conn.config[
```

#### Recent Merged Pull Requests:
- **PR #3387** (closed): Use (@karl9527)
- **PR #3386** (2026-09-29): Bump to 0.9.7 (@openrz)
- **PR #3385** (2026-09-28): Serpapi (@wengzh12138)
- **PR #3379** (closed): Sparkbot zgc (@sisufo)
- **PR #3378** (2026-09-21): fix(deps): 移除 chardet 直接依赖 (@Sakura-RanChen)
- **PR #3376** (2026-09-28): feat(web_search): 新增Serply搜索源 (@googio)
- **PR #3375** (2026-09-17): fix: 修复 v-code-diff 斜体样式干扰 diff 展示 (@lww155)
- **PR #3374** (2026-09-17): chore(deps): 批量升级 4 个允许的依赖 (@Sakura-RanChen)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
