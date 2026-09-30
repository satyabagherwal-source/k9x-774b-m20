# Forensic Learning Record (Deep Inspection): tiajinsha/JKVideo

> **Canonical Artifact**: `07_PROJECT_LEARNING/tiajinsha-jkvideo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tiajinsha/JKVideo](https://github.com/tiajinsha/JKVideo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:31:56.521Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tiajinsha/JKVideo`
- **Description**: 高颜值第三方 B 站 React Native 客户端
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4991 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `App.tsx`
```
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://bdb940f3a950ee46ce8ba651dee9b433@o4511094585819136.ingest.de.sentry.io/4511094601810000',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

```

### Core Architecture Module: `app/_layout.tsx`
```
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useDownloadStore } from '../store/downloadStore';
import { useSettingsStore } from '../store/settingsStore';
import { usePlayProgressStore } from '../store/playProgressStore';
import { initMiniExclusion } from '../store/miniExclusion';
import { useTheme } from '../utils/theme';
import { MiniPlayer } from '../components/MiniPlayer';
import { LiveMiniPlayer } from '../components/LiveMiniPlayer';
import * as Sentry from '@sentry/react-native';
import { ErrorBoundary } from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  enabled: !__DEV__,
  tracesSampleRate: 0.05,
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? 'production',
});

function RootLayout() {
  const restore = useAuthStore(s => s.restore);
  const loadDownloads = useDownloadStore(s => s.loadFromStorage);
  const restoreSettings = useSettingsStore(s => s.restore);
  const darkMode = useSettingsStore(s => s.darkMode);

  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    restore();
    loadDownloads();
    restoreSettings();
    usePlayProgressStore.getState().hydrate();
    initMiniExclusion();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <ErrorBoundary fallback={<Text style={{ padding: 32, textAlign: 'center' }}>发生错误，请重启 App</Text>}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen
              name="video"
              options={{
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
              }}
            />
            <Stack.Screen
              name="live"
              options={{
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
              }}
            />
            <Stack.Screen
              name="search"
              options={{
                animation: "slide_from_right",
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="downloads"
              options={{
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
              }}
            />
            <Stack.Screen
              name="creator"
              options={{
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
              }}
            />
          </Stack>
        </ErrorBoundary>
        <MiniPlayer />
        <LiveMiniPlayer />
      </View>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(RootLayout);

```

### Core Architecture Module: `app/creator/[mid].tsx`
```
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { getUploaderInfo, getUploaderVideos } from '../../services/bilibili';
import type { VideoItem } from '../../services/types';
import { useTheme } from '../../utils/theme';
import { formatCount, formatDuration, formatTime } from '../../utils/format';
import { proxyImageUrl, coverImageUrl } from '../../utils/imageUrl';
import { useSettingsStore } from '../../store/settingsStore';

const PAGE_SIZE = 20;
const TOPBAR_HEIGHT = 44;
const FADE_START = 80;
const FADE_END = 160;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<VideoItem>);

export default function CreatorScreen() {
  const { mid: midStr } = useLocalSearchParams<{ mid: string }>();
  const mid = Number(midStr);
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const trafficSaving = useSettingsStore(s => s.trafficSaving);

  const [info, setInfo] = useState<{
    name: string; face: string; sign: string; follower: number; archiveCount: number;
  } | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const topBarOpacity = scrollY.interpolate({
    inputRange: [FADE_START, FADE_END],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    getUploaderInfo(mid)
      .then(setInfo)
      .catch(() => {})
      .finally(() => setInfoLoading(false));
    loadVideos(1, true);
  }, [mid]);

  const loadVideos = useCallback(async (pn: number, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const { videos: newVideos, total: t } = await getUploaderVideos(mid, pn, PAGE_SIZE);
      setTotal(t);
      setVideos(prev => reset ? newVideos : [...prev, ...newVideos]);
      setPage(pn);
    } catch {}
    finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [mid]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [infoData, { videos: newVideos, total: t }] = await Promise.all([
        getUploaderInfo(mid),
        getUploaderVideos(mid, 1, PAGE_SIZE),
      ]);
      setInfo(infoData);
      setTotal(t);
      setVideos(newVideos);
      setPage(1);
    } catch {}
    finally {
      setRefreshing(false);
    }
  }, [mid]);

  const hasMore = videos.length < total;

  const HeroHeader = (
    <View style={[styles.hero, { borderBottomColor: theme.border }]}>
      {info ? (
        <>
          <Image
            source={{ uri: proxyImageUrl(info.face) }}
            style={styles.heroBg}
            contentFit="cover"
            blurRadius={20}
          />
          <View style={[styles.heroOverlay, { backgroundColor: theme.card }]} />
        </>
      ) : (
        <View style={[styles.heroBg, { backgroundColor: theme.card }]} />
      )}
      {infoLoading ? (
        <View style={[styles.profileContent, { paddingTop: TOPBAR_HEIGHT + 24 }]}>
          <ActivityIndicator color="#00AEEC" />
        </View>
      ) : info ? (
        <View style={[styles.profileContent, { paddingTop: TOPBAR_HEIGHT + 12 }]}>
          <Image
            source={{ uri: proxyImageUrl(info.face) }}
            style={styles.avatar}
            contentFit="cover"
            recyclingKey={String(mid)}
          />
          <Text style={[styles.name, { color: theme.text }]}>{info.name}</Text>
          {info.sign ? (
            <Text style={[styles.sign, { color: theme.textSub }]} numberOfLines={2}>{info.sign}</Text>
          ) : null}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.text }]}>{formatCount(info.follower)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSub }]}>粉丝</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: theme.text }]}>{formatCount(info.archiveCount)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSub }]}>视频</Text>
            </View>
          </View>
          <Text style={[styles.videoListHeader, { color: theme.textSub }]}>
            全部视频（{total}）
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.card }]}
      edges={['top', 'left', 'right']}
    >
      <AnimatedFlatList
        data={videos}
        keyExtractor={item => item.bvid}
        showsVerticalScrollIndicator={false}
        onEndReached={() => { if (hasMore && !loading) loadVideos(page + 1); }}
        onEndReachedThreshold={0.3}
        windowSize={7}
        maxToRenderPerBatch={6}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00AEEC"
            colors={["#00AEEC"]}
            progressViewOffset={insets.top + TOPBAR_HEIGHT}
          />
        }
        ListHeaderComponent={HeroHeader}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.videoRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
            onPress={() => router.push(`/video/${item.bvid}` as any)}
            activeOpacity={0.85}
          >
            <View style={styles.thumbWrap}>
              <Image
                source={{ uri: coverImageUrl(item.pic, trafficSaving ? 'normal' : 'hd') }}
                style={styles.thumb}
                contentFit="cover"
                recyclingKey={item.bvid}
                transition={200}
              />
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
              </View>
            </View>
            <View style={styles.videoInfo}>
              <Text style={[styles.videoTitle, { color: theme.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.videoMeta}>
                <Ionicons name="play" size={11} color={theme.textSub} />
                <Text style={[styles.metaText, { color: theme.textSub }]}>{formatCount(item.stat?.view ?? 0)}</Text>
                {!!item.pubdate && (
                  <Text style={[styles.metaText, { color: theme.textSub }]}>· {formatTime(item.pubdate)}</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading && !infoLoading ? (
            <Text style={[styles.emptyTxt, { color: theme.textSub }]}>暂无视频</Text>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loading && <ActivityIndicator color="#00AEEC" />}
          </View>
        }
      />

      {/* 浮动 topBar：背景透明 → 不透明，跟随滚动 */}
      <View
        style={[styles.topBarFloat, { height: TOPBAR_HEIGHT, top: insets.top }]}
        pointerEvents="box-none"
      >
  
```

### Core Architecture Module: `app/creator/_layout.tsx`
```
import { Stack } from 'expo-router';

export default function CreatorLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

```

### Core Architecture Module: `app/downloads.tsx`
```
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  StatusBar,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Video from 'react-native-video';
let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch {}
import { useDownloadStore, DownloadTask } from '../store/downloadStore';
import { LanShareModal } from '../components/LanShareModal';
import { proxyImageUrl } from '../utils/imageUrl';
import { useTheme } from '../utils/theme';

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DownloadsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { tasks, loadFromStorage, removeTask } = useDownloadStore();
  const [playingUri, setPlayingUri] = useState<string | null>(null);
  const [playingTitle, setPlayingTitle] = useState('');
  const [shareTask, setShareTask] = useState<(DownloadTask & { key: string }) | null>(null);

  async function openPlayer(uri: string, title: string) {
    setPlayingTitle(title);
    setPlayingUri(uri);
    await ScreenOrientation?.unlockAsync();
  }

  async function closePlayer() {
    setPlayingUri(null);
    await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }

  function confirmDelete(key: string, status: DownloadTask['status']) {
    const isDownloading = status === 'downloading';
    Alert.alert(
      isDownloading ? '取消下载' : '删除下载',
      isDownloading ? '确定取消该下载任务？' : '确定删除该文件？删除后不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        { text: isDownloading ? '取消下载' : '删除', style: 'destructive', onPress: () => removeTask(key) },
      ],
    );
  }

  useEffect(() => {
    loadFromStorage();
  }, []);

  const all = Object.entries(tasks).map(([key, task]) => ({ key, ...task }));
  const downloading = all.filter((t) => t.status === 'downloading' || t.status === 'error');
  const done = all.filter((t) => t.status === 'done');

  const sections = [];
  if (downloading.length > 0) sections.push({ title: '下载中', data: downloading });
  if (done.length > 0) sections.push({ title: '已下载', data: done });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.text }]}>我的下载</Text>
        <View style={{ width: 32 }} />
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-download-outline" size={56} color={theme.textSub} />
          <Text style={[styles.emptyTxt, { color: theme.textSub }]}>暂无下载记录</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
              <Text style={[styles.sectionTitle, { color: theme.textSub }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <DownloadRow
              task={item}
              theme={theme}
              onPlay={() => {
                if (item.localUri) openPlayer(item.localUri, item.title);
              }}
              onDelete={() => confirmDelete(item.key, item.status)}
              onShare={() => setShareTask(item)}
              onRetry={() => router.push(`/video/${item.bvid}` as any)}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 108 }]} />
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}

      <LanShareModal
        visible={!!shareTask}
        task={shareTask}
        onClose={() => setShareTask(null)}
      />

      {/* Local file player modal */}
      <Modal
        visible={!!playingUri}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePlayer}
      >
        <StatusBar hidden />
        <View style={styles.playerBg}>
          {playingUri && (
            <Video
              source={{ uri: playingUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="contain"
              controls
              paused={false}
            />
          )}
          <View style={styles.playerBar}>
            <TouchableOpacity onPress={closePlayer} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.playerTitle} numberOfLines={1}>{playingTitle}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DownloadRow({
  task,
  theme,
  onPlay,
  onDelete,
  onShare,
  onRetry,
}: {
  task: DownloadTask & { key: string };
  theme: ReturnType<typeof useTheme>;
  onPlay: () => void;
  onDelete: () => void;
  onShare: () => void;
  onRetry: () => void;
}) {
  const isDone = task.status === 'done';
  const isError = task.status === 'error';
  const isDownloading = task.status === 'downloading';

  const rowContent = (
    <View style={[styles.row, { backgroundColor: theme.card }]}>
      <Image source={{ uri: proxyImageUrl(task.cover) }} style={styles.cover} contentFit="cover" recyclingKey={task.bvid} />
      <View style={styles.info}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{task.title}</Text>
        <Text style={[styles.qdesc, { color: theme.textSub }]}>
          {task.qdesc}{task.fileSize ? `  ·  ${formatFileSize(task.fileSize)}` : ''}
        </Text>
        {isDownloading && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(task.progress * 100)}%` as any }]} />
            </View>
            <Text style={styles.progressTxt}>{Math.round(task.progress * 100)}%</Text>
          </View>
        )}
        {isError && (
          <View style={styles.errorRow}>
            <Text style={styles.errorTxt} numberOfLines={1}>{task.error ?? '下载失败'}</Text>
            <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
              <Text style={styles.retryTxt}>重新下载</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {isDone && (
          <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
            <Ionicons name="share-social-outline" size={20} color="#00AEEC" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onDelete}
        >
          <Ionicons
            name={isDownloading ? 'close-circle-outline' : 'trash-outline'}
            size={20}
            color="#bbb"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isDone) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPlay}>
        {rowContent}
      </TouchableOpacity>
    );
  }

  return rowContent;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'r
```

### Core Architecture Module: `app/index.tsx`
```
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
  RefreshControl,
  ViewToken,
  FlatList,
  ScrollView,
} from "react-native";
import PagerView from "react-native-pager-view";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { VideoCard } from "../components/VideoCard";
import { LiveCard } from "../components/LiveCard";
import { LoginModal } from "../components/LoginModal";
import { DownloadProgressBtn } from "../components/DownloadProgressBtn";
import { useVideoList } from "../hooks/useVideoList";
import { useLiveList } from "../hooks/useLiveList";
import { useAuthStore } from "../store/authStore";
import {
  toListRows,
  type ListRow,
  type BigRow,
} from "../utils/videoRows";
import { BigVideoCard } from "../components/BigVideoCard";
import { FollowedLiveStrip } from "../components/FollowedLiveStrip";
import { useTheme } from "../utils/theme";
import { useVisibleBigKeyStore } from "../store/visibleBigKeyStore";
import type { LiveRoom } from "../services/types";

const HEADER_H = 44;
const TAB_H = 38;
const NAV_H = HEADER_H + TAB_H;

const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 50 };

type TabKey = "hot" | "live";

const TABS: { key: TabKey; label: string }[] = [
  { key: "hot", label: "热门" },
  { key: "live", label: "直播" },
];

const LIVE_AREAS = [
  { id: 0, name: "推荐" },
  { id: 2, name: "网游" },
  { id: 3, name: "手游" },
  { id: 6, name: "单机游戏" },
  { id: 1, name: "娱乐" },
  { id: 9, name: "虚拟主播" },
  { id: 10, name: "生活" },
  { id: 11, name: "知识" },
];

export default function HomeScreen() {
  const router = useRouter();
  const { pages, loading, refreshing, load, refresh } = useVideoList();
  const {
    rooms,
    loading: liveLoading,
    refreshing: liveRefreshing,
    load: liveLoad,
    refresh: liveRefresh,
  } = useLiveList();
  const { isLoggedIn, face } = useAuthStore();
  const [showLogin, setShowLogin] = useState(false);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>("hot");
  const [liveAreaId, setLiveAreaId] = useState(0);

  const theme = useTheme();
  const rows = useMemo(() => toListRows(pages), [pages]);
  const pagerRef = useRef<PagerView>(null);

  const hotListRef = useRef<FlatList>(null);
  const liveListRef = useRef<FlatList>(null);

  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const bigRow = viewableItems.find(
        (v) => v.item && (v.item as ListRow).type === "big",
      );
      useVisibleBigKeyStore.getState().setKey(bigRow ? (bigRow.item as BigRow).item.bvid : null);
    },
  ).current;

  // 滚动累计阈值：方向反转后需累计滚动该距离才触发显隐切换
  const SCROLL_THRESHOLD = 40;
  // 显隐过渡时长
  const HEADER_ANIM_MS = 100;

  const headerOffset = useRef(new Animated.Value(0)).current; // 0 = 显示，HEADER_H = 隐藏
  const liveHeaderOffset = useRef(new Animated.Value(0)).current;

  const headerTranslate = headerOffset.interpolate({
    inputRange: [0, HEADER_H],
    outputRange: [0, -HEADER_H],
    extrapolate: "clamp",
  });
  const headerOpacity = headerOffset.interpolate({
    inputRange: [0, HEADER_H * 0.6, HEADER_H],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const liveHeaderTranslate = liveHeaderOffset.interpolate({
    inputRange: [0, HEADER_H],
    outputRange: [0, -HEADER_H],
    extrapolate: "clamp",
  });
  const liveHeaderOpacity = liveHeaderOffset.interpolate({
    inputRange: [0, HEADER_H * 0.6, HEADER_H],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });

  const hotScrollState = useRef({ lastY: 0, acc: 0, dir: 0, hidden: false }).current;
  const liveScrollState = useRef({ lastY: 0, acc: 0, dir: 0, hidden: false }).current;

  const animateHeader = useCallback(
    (offset: Animated.Value, hide: boolean) => {
      Animated.timing(offset, {
        toValue: hide ? HEADER_H : 0,
        duration: HEADER_ANIM_MS,
        useNativeDriver: true,
      }).start();
    },
    [],
  );

  const updateHeaderForScroll = useCallback(
    (
      y: number,
      state: { lastY: number; acc: number; dir: number; hidden: boolean },
      offset: Animated.Value,
    ) => {
      // 顶部强制显示
      if (y <= 0) {
        if (state.hidden) {
          state.hidden = false;
          animateHeader(offset, false);
        }
        state.lastY = 0;
        state.acc = 0;
        state.dir = 0;
        return;
      }
      const dy = y - state.lastY;
      state.lastY = y;
      if (Math.abs(dy) < 1) return;
      const dir = dy > 0 ? 1 : -1; // 1=向下滚（隐藏），-1=向上滚（显示）
      if (dir !== state.dir) {
        state.dir = dir;
        state.acc = 0;
      }
      state.acc += Math.abs(dy);
      if (state.acc < SCROLL_THRESHOLD) return;
      const shouldHide = dir === 1;
      if (shouldHide !== state.hidden) {
        state.hidden = shouldHide;
        animateHeader(offset, shouldHide);
      }
      state.acc = 0;
    },
    [animateHeader],
  );

  useEffect(() => {
    load();
  }, []);

  const onScroll = useCallback(
    (e: any) =>
      updateHeaderForScroll(
        e.nativeEvent.contentOffset.y,
        hotScrollState,
        headerOffset,
      ),
    [updateHeaderForScroll],
  );

  const onLiveScroll = useCallback(
    (e: any) =>
      updateHeaderForScroll(
        e.nativeEvent.contentOffset.y,
        liveScrollState,
        liveHeaderOffset,
      ),
    [updateHeaderForScroll],
  );

  const handleTabPress = useCallback(
    (key: TabKey) => {
      if (key === activeTab) {
        // 点击已激活的 tab：滚动到顶部并刷新
        if (key === "hot") {
          hotListRef.current?.scrollToOffset({ offset: 0, animated: true });
          refresh();
        } else {
          liveListRef.current?.scrollToOffset({ offset: 0, animated: true });
          liveRefresh(liveAreaId);
        }
        return;
      }
      // 切换 tab
      pagerRef.current?.setPage(key === "hot" ? 0 : 1);
      setActiveTab(key);
      if (key === "live" && rooms.length === 0) {
        liveLoad(true, liveAreaId);
      }
    },
    [activeTab, rooms.length, liveAreaId],
  );

  const onPageSelected = useCallback(
    (e: any) => {
      const key: TabKey = e.nativeEvent.position === 0 ? "hot" : "live";
      if (key === activeTab) return;
      setActiveTab(key);
      if (key === "live" && rooms.length === 0) {
        liveLoad(true, liveAreaId);
      }
    },
    [activeTab, rooms.length, liveAreaId],
  );

  const handleLiveAreaPress = useCallback(
    (areaId: number) => {
      if (areaId === liveAreaId) return;
      setLiveAreaId(areaId);
      liveListRef.current?.scrollToOffset({ offset: 0, animated: false });
      liveLoad(true, areaId);
    },
    [liveAreaId, liveLoad],
  );

  const renderItem = useCallback(({ item: row }: { item: ListRow }) => {
    if (row.type === "big") {
      return (
        <BigVideoCard
          item={row.item}
          onPress={() => router.push(`/video/${row.item.bvid}` as any)}
        />
      );
    }
    const right = row.right;
    return (
      <View style={styles.row}>
        <View style={styles.leftCol}>
          <VideoCard
            item={row.left}
            onPress={() => router.push(`/video/${row.left.bvid}` as any)}
          />
        </View>
        {right && (
          <View style={styles.rightCol}>
            <VideoCard
              item={right}
              onPress={() => router.push(`/video/${right.bvid}` as any)}
            />
          </View>
        )}
      </View>
    );
  }, []);

  const renderLiveItem = useCallback(
    ({ item }: { item: { left: LiveRoom; right?: LiveRoom } }) => (
      <View style={styles.row}>
        <View style={styles.leftCol}>
          <LiveCard
            item={item.left}
            onPress={() => router.push(`/live/${item.left.roomid}` as any)
```

### Core Architecture Module: `app/live/[roomId].tsx`
```
import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLiveDetail } from "../../hooks/useLiveDetail";
import { useLiveDanmaku } from "../../hooks/useLiveDanmaku";
import { LivePlayer } from "../../components/LivePlayer";
import DanmakuList from "../../components/DanmakuList";
import { formatCount } from "../../utils/format";
import { proxyImageUrl } from "../../utils/imageUrl";
import { useTheme } from "../../utils/theme";
import { useLiveStore } from "../../store/liveStore";

type Tab = "intro" | "danmaku";

export default function LiveDetailScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const id = parseInt(roomId ?? "0", 10);

  // 进入详情页时立即清除小窗（useLayoutEffect 在绘制前同步执行）
  useLayoutEffect(() => {
    useLiveStore.getState().clearLive();
  }, []);

  const { room, anchor, stream, loading, error, changeQuality } =
    useLiveDetail(id);
  const [tab, setTab] = useState<Tab>("intro");

  const isLive = room?.live_status === 1;
  const hlsUrl = stream?.hlsUrl ?? "";
  const flvUrl = stream?.flvUrl ?? "";
  const qualities = stream?.qualities ?? [];
  const currentQn = stream?.qn ?? 0;

  const setLive = useLiveStore(s => s.setLive);

  const actualRoomId = room?.roomid ?? id;
  const { danmakus, giftCounts } = useLiveDanmaku(isLive ? actualRoomId : 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.card }]}>
      {/* TopBar */}
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
          {room?.title ?? "直播间"}
        </Text>
        {isLive && hlsUrl ? (
          <TouchableOpacity
            style={styles.pipBtn}
            onPress={() => {
              setLive(id, room?.title ?? '', room?.keyframe ?? '', hlsUrl);
              router.back();
            }}
          >
            <Ionicons name="browsers-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.pipBtn} />
        )}
      </View>

      {/* Player */}
      <LivePlayer
        hlsUrl={hlsUrl}
        flvUrl={flvUrl}
        isLive={isLive}
        qualities={qualities}
        currentQn={currentQn}
        onQualityChange={changeQuality}
      />

      {/* TabBar */}
      <View style={[styles.tabBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setTab("intro")}
        >
          <Text style={[styles.tabLabel, { color: theme.textSub }, tab === "intro" && styles.tabActive]}>
            简介
          </Text>
          {tab === "intro" && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setTab("danmaku")}
        >
          <Text
            style={[styles.tabLabel, { color: theme.textSub }, tab === "danmaku" && styles.tabActive]}
          >
            弹幕{danmakus.length > 0 ? ` ${danmakus.length}` : ""}
          </Text>
          {tab === "danmaku" && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator style={styles.loader} color="#00AEEC" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <>
          <ScrollView
            style={[styles.scroll, tab !== "intro" && styles.hidden]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleSection}>
              <Text style={[styles.title, { color: theme.text }]}>{room?.title}</Text>
              <View style={styles.metaRow}>
                {isLive ? (
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.livePillText}>直播中</Text>
                  </View>
                ) : (
                  <View style={[styles.livePill, styles.offlinePill]}>
                    <Text style={[styles.livePillText, styles.offlinePillText]}>
                      未开播
                    </Text>
                  </View>
                )}
                <View style={styles.onlineRow}>
                  <Ionicons name="eye-outline" size={13} color="#999" />
                  <Text style={styles.onlineText}>
                    {formatCount(room?.online ?? 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.areaRow}>
                {room?.parent_area_name ? (
                  <Text style={styles.areaTag}>{room.parent_area_name}</Text>
                ) : null}
                {room?.area_name ? (
                  <Text style={styles.areaTag}>{room.area_name}</Text>
                ) : null}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {anchor && (
              <View style={styles.anchorRow}>
                <Image
                  source={{ uri: proxyImageUrl(anchor.face) }}
                  style={styles.avatar}
                />
                <Text style={[styles.anchorName, { color: theme.text }]}>{anchor.uname}</Text>
                <TouchableOpacity style={styles.followBtn}>
                  <Text style={styles.followTxt}>+ 关注</Text>
                </TouchableOpacity>
              </View>
            )}

            {!!room?.description && (
              <View style={styles.descBox}>
                <Text style={[styles.descText, { color: theme.text }]}>{room.description}</Text>
              </View>
            )}
          </ScrollView>

          <DanmakuList
            danmakus={danmakus}
            currentTime={999999}
            visible
            onToggle={() => {}}
            style={[styles.danmakuFull, tab !== "danmaku" && styles.hidden]}
            hideHeader
            isLive
            maxItems={500}
            giftCounts={giftCounts}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4 },
  pipBtn: { padding: 4, width: 32, alignItems: 'center' },
  topTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 4,
  },
  loader: { marginVertical: 30 },
  errorText: { textAlign: "center", color: "#f00", padding: 20 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    position: "relative",
  },
  tabLabel: { fontSize: 14, fontWeight: "500" },
  tabActive: { color: "#00AEEC", fontWeight: "700" },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    width: 24,
    height: 2,
    backgroundColor: "#00AEEC",
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  titleSection: { padding: 14 },
  title: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff0f0",
    paddingH
```

### Core Architecture Module: `app/live/_layout.tsx`
```
import { Slot } from 'expo-router';

export default function LiveLayout() {
  return <Slot />;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #30** (2026-03-25): **fix(web): 补全缺失的 web shims 并修复渲染崩溃问题**
  *Symptoms*: ## 改动说明  补全 web 平台缺失的 shim 文件，修复多个导致页面崩溃的问题，包括 Metro SHA-1 错误、React 渲染崩溃、tab 切换报错及 Ionicons 字体 404。  ## 改动类型  - [x] Bug 修复 - [ ] 新功能 - [ ] 重构（不改变功能） - [x] 文档更新 - [ ] 其他：  ## 关联 Issue  > 无  ## 测试平台  - [ ] Android（Dev Build） - [ ] Android（Expo Go） - [ ] iOS - [x] Web  ## 截图 / 录屏（如适用）  无  ## 注意事项  - [x] 代码中无硬编码账号信息（SESSDATA、uid 等） - [x] Commit 信息符合 Conventional Commits 规范 - [x] 已在本地测试通过 
  **Post-Mortem & Fix Analysis**:
  > 请不要为此项目贡献任何代码，全程营销造假。 请看这里 https://github.com/tiajinsha/JKVideo/discussions/29#discussioncomment-16293632 https://github.com/tiajinsha/JKVideo/discussions/31

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

### Incident Patch 1: `53c67079` (2026-05-12)
**Commit Message**: bug修改

**File**: `app/_layout.tsx` (modified, +4/-0)
```diff
@@ -6,6 +6,8 @@ import { useEffect } from 'react';
 import { useAuthStore } from '../store/authStore';
 import { useDownloadStore } from '../store/downloadStore';
 import { useSettingsStore } from '../store/settingsStore';
+import { usePlayProgressStore } from '../store/playProgressStore';
+import { initMiniExclusion } from '../store/miniExclusion';
 import { useTheme } from '../utils/theme';
 import { MiniPlayer } from '../components/MiniPlayer';
 import { LiveMiniPlayer } from '../components/LiveMiniPlayer';
@@ -35,6 +37,8 @@ function RootLayout() {
     restore();
     loadDownloads();
     restoreSettings();
+    usePlayProgressStore.getState().hydrate();
+    initMiniExclusion();
   }, []);
 
   if (!fontsLoaded) return null;
```

**File**: `app/index.tsx` (modified, +88/-64)
```diff
@@ -36,11 +36,11 @@ import {
   toListRows,
   type ListRow,
   type BigRow,
-  type LiveRow,
 } from "../utils/videoRows";
 import { BigVideoCard } from "../components/BigVideoCard";
 import { FollowedLiveStrip } from "../components/FollowedLiveStrip";
 import { useTheme } from "../utils/theme";
+import { useVisibleBigKeyStore } from "../store/visibleBigKeyStore";
 import type { LiveRoom } from "../services/types";
 
 const HEADER_H = 44;
@@ -69,8 +69,7 @@ const LIVE_AREAS = [
 
 export default function HomeScreen() {
   const router = useRouter();
-  const { pages, liveRooms, loading, refreshing, load, refresh } =
-    useVideoList();
+  const { pages, loading, refreshing, load, refresh } = useVideoList();
   const {
     rooms,
     loading: liveLoading,
@@ -85,8 +84,7 @@ export default function HomeScreen() {
   const [liveAreaId, setLiveAreaId] = useState(0);
 
   const theme = useTheme();
-  const [visibleBigKey, setVisibleBigKey] = useState<string | null>(null);
-  const rows = useMemo(() => toListRows(pages, liveRooms), [pages, liveRooms]);
+  const rows = useMemo(() => toListRows(pages), [pages]);
   const pagerRef = useRef<PagerView>(null);
 
   const hotListRef = useRef<FlatList>(null);
@@ -97,57 +95,113 @@ export default function HomeScreen() {
       const bigRow = viewableItems.find(
         (v) => v.item && (v.item as ListRow).type === "big",
       );
-      setVisibleBigKey(bigRow ? (bigRow.item as BigRow).item.bvid : null);
+      useVisibleBigKeyStore.getState().setKey(bigRow ? (bigRow.item as BigRow).item.bvid : null);
     },
   ).current;
 
-  const scrollY = useRef(new Animated.Value(0)).current;
+  // 滚动累计阈值：方向反转后需累计滚动该距离才触发显隐切换
+  const SCROLL_THRESHOLD = 40;
+  // 显隐过渡时长
+  const HEADER_ANIM_MS = 100;
 
-  const headerTranslate = scrollY.interpolate({
+  const headerOffset = useRef(new Animated.Value(0)).current; // 0 = 显示，HEADER_H = 隐藏
+  const liveHeaderOffset = useRef(new Animated.Value(0)).current;
+
+  const headerTranslate = headerOffset.interpolate({
     inputRange: [0, HEADER_H],
     outputRange: [0, -HEADER_H],
     extrapolate: "clamp",
   });
-
-  const headerOpacity = scrollY.interpolate({
-    inputRange: [0, HEADER_H * 0.2],
-    outputRange: [1, 0],
+  const headerOpacity = headerOffset.interpolate({
+    inputRange: [0, HEADER_H * 0.6, HEADER_H],
+    outputRange: [1, 1, 0],
     extrapolate: "clamp",
   });
 
-  // 直播列表也共用同一个 scrollY
-  const liveScrollY = useRef(new Animated.Value(0)).current;
-
-  const liveHeaderTranslate = liveScrollY.interpolate({
+  const liveHeaderTranslate = liveHeaderOffset.interpolate({
     inputRange: [0, HEADER_H],
     outputRange: [0, -HEADER_H],
     extrapolate: "clamp",
   });
-
-  const liveHeaderOpacity = liveScrollY.interpolate({
-    inputRange: [0, HEADER_H * 0.2],
-    outputRange: [1, 0],
+  const liveHeaderOpacity = liveHeaderOffset.interpolate({
+    inputRange: [0, HEADER_H * 0.6, HEADER_H],
+    outputRange: [1, 1, 0],
     extrapolate: "clamp",
   });
 
+  const hotScrollState = useRef({ lastY: 0, acc: 0, dir: 0, hidden: false }).current;
+  const liveScrollState = useRef({ lastY: 0, acc: 0, dir: 0, hidden: false }).current;
+
+  const animateHeader = useCallback(
+    (offset: Animated.Value, hide: boolean) => {
+      Animated.timing(offset, {
+        toValue: hide ? HEADER_H : 0,
+        duration: HEADER_ANIM_MS,
+        useNativeDriver: true,
+      }).start();
+    },
+    [],
+  );
+
+  const updateHeaderForScroll = useCallback(
+    (
+      y: number,
+      state: { lastY: number; acc: number; dir: number; hidden: boolean },
+      offset: Animated.Value,
+    ) => {
+      // 顶部强制显示
+      if (y <= 0) {
+        if (state.hidden) {
+          state.hidden = false;
+          animateHeader(offset, false);
+        }
+        state.lastY = 0;
+        state.acc = 0;
+        state.dir = 0;
+        return;
+      }
+      const dy = y - state.lastY;
+      state.lastY = y;
+      if (Math.abs(dy) < 1) return;
+      const di
```

**File**: `app/video/[bvid].tsx` (modified, +64/-16)
```diff
@@ -1,11 +1,13 @@
-import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
 import {
   View,
   Text,
   FlatList,
   StyleSheet,
   TouchableOpacity,
   ActivityIndicator,
+  useWindowDimensions,
+  InteractionManager,
 } from "react-native";
 import { Image } from "expo-image";
 import { SafeAreaView } from "react-native-safe-area-context";
@@ -22,6 +24,7 @@ import { useRelatedVideos } from "../../hooks/useRelatedVideos";
 import { formatCount, formatDuration } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { DownloadSheet } from "../../components/DownloadSheet";
+import { VideoDetailSkeleton } from "../../components/VideoDetailSkeleton";
 import { useTheme } from "../../utils/theme";
 import { useLiveStore } from "../../store/liveStore";
 
@@ -36,13 +39,22 @@ export default function VideoDetailScreen() {
     useLiveStore.getState().clearLive();
   }, []);
 
+  // 骨架屏最短展示时长：即便数据秒回，也至少撑够这么久，避免一闪而过
+  const SKELETON_MIN_MS = 600;
+  const [minSkeletonElapsed, setMinSkeletonElapsed] = useState(false);
+  useEffect(() => {
+    const t = setTimeout(() => setMinSkeletonElapsed(true), SKELETON_MIN_MS);
+    return () => clearTimeout(t);
+  }, []);
+
   const {
     video,
     playData,
     loading: videoLoading,
     qualities,
     currentQn,
     changeQuality,
+    initialTime,
   } = useVideoDetail(bvid as string);
   const [commentSort, setCommentSort] = useState<0 | 2>(2);
   const {
@@ -67,20 +79,36 @@ export default function VideoDetailScreen() {
     load: loadRelated,
   } = useRelatedVideos(bvid as string);
 
-  useEffect(() => { loadRelated(); }, []);
+  // 推荐视频不参与首屏，等导航动画结束再拉，避免与详情/播放流抢 JS 线程
+  useEffect(() => {
+    const handle = InteractionManager.runAfterInteractions(() => {
+      loadRelated();
+    });
+    return () => handle.cancel();
+  }, []);
 
   useEffect(() => {
-    if (video?.aid) loadComments();
+    if (!video?.aid) return;
+    const handle = InteractionManager.runAfterInteractions(() => {
+      loadComments();
+    });
+    return () => handle.cancel();
   }, [video?.aid, commentSort]);
 
   useEffect(() => {
     if (!video?.cid) return;
-    getDanmaku(video.cid).then(setDanmakus).catch(() => {});
+    const handle = InteractionManager.runAfterInteractions(() => {
+      getDanmaku(video.cid!).then(setDanmakus).catch(() => {});
+    });
+    return () => handle.cancel();
   }, [video?.cid]);
 
   useEffect(() => {
     if (!video?.owner?.mid) return;
-    getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
+    const handle = InteractionManager.runAfterInteractions(() => {
+      getUploaderStat(video.owner.mid).then(setUploaderStat).catch(() => {});
+    });
+    return () => handle.cancel();
   }, [video?.owner?.mid]);
 
   return (
@@ -107,6 +135,7 @@ export default function VideoDetailScreen() {
         cid={video?.cid}
         danmakus={danmakus}
         onTimeUpdate={setCurrentTime}
+        initialTime={initialTime}
       />
       <DownloadSheet
         visible={showDownload}
@@ -139,9 +168,9 @@ export default function VideoDetailScreen() {
       )}
 
       {/* Tab content */}
-      {videoLoading ? (
-        <ActivityIndicator style={styles.loader} color="#00AEEC" />
-      ) : video ? (
+      {videoLoading || !video || !minSkeletonElapsed ? (
+        <VideoDetailSkeleton />
+      ) : (
         <>
           {tab === "intro" && (
             <FlatList<import("../../services/types").VideoItem>
@@ -306,7 +335,7 @@ export default function VideoDetailScreen() {
             style={[styles.danmakuTab, tab !== "danmaku" && { display: "none" }]}
           />
         </>
-      ) : null}
+      )}
     </SafeAreaView>
   );
 }
@@ -322,17 +351,33 @@ function SeasonSection({
   onEpisodePress: (bvid: string) => void;
 }) {
   const theme = useTheme();
+  const { width: screenW } = useWindowDimen
```

**File**: `components/BigVideoCard.tsx` (modified, +37/-8)
```diff
@@ -24,7 +24,9 @@ import { coverImageUrl } from "../utils/imageUrl";
 import { useSettingsStore } from "../store/settingsStore";
 import { useTheme } from "../utils/theme";
 import { useLiveStore } from "../store/liveStore";
+import { usePlayUrlCache } from "../store/playUrlCache";
 import { formatCount, formatDuration } from "../utils/format";
+import { useVisibleBigKeyStore } from "../store/visibleBigKeyStore";
 import type { VideoItem } from "../services/types";
 
 const HEADERS = {
@@ -45,17 +47,16 @@ function clamp(v: number, lo: number, hi: number) {
 
 interface Props {
   item: VideoItem;
-  isVisible: boolean;
   isScrolling?: boolean;
   onPress: () => void;
 }
 
 export const BigVideoCard = React.memo(function BigVideoCard({
   item,
-  isVisible,
   isScrolling,
   onPress,
 }: Props) {
+  const isVisible = useVisibleBigKeyStore((s) => s.key) === item.bvid;
   const { width: SCREEN_W } = useWindowDimensions();
   const trafficSaving = useSettingsStore(s => s.trafficSaving);
   const liveActive = useLiveStore(s => s.isActive);
@@ -79,6 +80,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
   const durationRef = useRef(0);
   const seekingRef = useRef(false);
   const [seekLabel, setSeekLabel] = useState<string | null>(null);
+  const lastProgressUpdate = useRef(0);
 
   // Reset video state when the item changes
   useEffect(() => {
@@ -98,6 +100,18 @@ export const BigVideoCard = React.memo(function BigVideoCard({
     let cancelled = false;
     (async () => {
       try {
+        // 命中缓存（5min TTL）直接复用
+        const cached = usePlayUrlCache.getState().get(item.bvid, 16);
+        if (cached) {
+          if (cancelled) return;
+          if (cached.playData.dash) {
+            setIsDash(true);
+            setVideoUrl(cached.mpdUri ?? cached.playData.dash.video[0]?.baseUrl);
+          } else {
+            setVideoUrl(cached.playData.durl?.[0]?.url);
+          }
+          return;
+        }
         let cid = item.cid;
         if (!cid) {
           const detail = await getVideoDetail(item.bvid);
@@ -113,13 +127,22 @@ export const BigVideoCard = React.memo(function BigVideoCard({
         if (playData.dash) {
           if (!cancelled) setIsDash(true);
           try {
-            const mpdUri = await buildDashMpdUri(playData, 16);
-            if (!cancelled) setVideoUrl(mpdUri);
+            const mpdUri = await buildDashMpdUri(playData, 16, item.bvid);
+            if (!cancelled) {
+              setVideoUrl(mpdUri);
+              usePlayUrlCache.getState().set(item.bvid, 16, { playData, mpdUri });
+            }
           } catch {
-            if (!cancelled) setVideoUrl(playData.dash.video[0]?.baseUrl);
+            if (!cancelled) {
+              setVideoUrl(playData.dash.video[0]?.baseUrl);
+              usePlayUrlCache.getState().set(item.bvid, 16, { playData });
+            }
           }
         } else {
-          if (!cancelled) setVideoUrl(playData.durl?.[0]?.url);
+          if (!cancelled) {
+            setVideoUrl(playData.durl?.[0]?.url);
+            usePlayUrlCache.getState().set(item.bvid, 16, { playData });
+          }
         }
       } catch (e) {
         console.warn("BigVideoCard: failed to load play URL", e);
@@ -252,8 +275,14 @@ export const BigVideoCard = React.memo(function BigVideoCard({
               seekableDuration: dur,
               playableDuration: buf,
             }) => {
-              if (!seekingRef.current) setCurrentTime(ct);
-              if (dur > 0) setDuration(dur);
+              currentTimeRef.current = ct;
+              if (dur > 0) durationRef.current = dur;
+              if (seekingRef.current) return;
+              const now = Date.now();
+              if (now - lastProgressUpdate.current < 450) return;
+              lastProgressUpdate.current = now;
+              setCurrentTime(ct);
+              if (dur > 0 && Math.abs(dur - duration) > 1) setDuration(dur);
               setBuffered(buf);
             }}
       
```

**File**: `components/DanmakuOverlay.tsx` (modified, +9/-3)
```diff
@@ -13,6 +13,10 @@ interface Props {
 
 const LANE_COUNT = 5;
 const LANE_H = 28;
+// 同屏弹幕上限（原 30，提至 60）
+const MAX_ACTIVE = 60;
+// activated 集合阈值，触达后整体清零防止内存膨胀
+const ACTIVATED_LIMIT = 1000;
 
 interface ActiveDanmaku {
   id: string;
@@ -73,7 +77,10 @@ export default function DanmakuOverlay({ danmakus, currentTime, screenWidth, scr
 
     const newItems: ActiveDanmaku[] = [];
 
-    if (activated.current.size > 200) activated.current.clear(); // prevent memory leak
+    if (activated.current.size > ACTIVATED_LIMIT) {
+      activated.current.clear(); // prevent memory leak
+      idCounter.current = 0;
+    }
     for (const item of candidates) {
       const key = `${item.time}_${item.text}`;
       activated.current.add(key);
@@ -124,8 +131,7 @@ export default function DanmakuOverlay({ danmakus, currentTime, screenWidth, scr
     if (newItems.length > 0) {
       setActiveDanmakus(prev => {
         const combined = [...prev, ...newItems];
-        // Cap at 30 simultaneous danmakus
-        return combined.slice(Math.max(0, combined.length - 30));
+        return combined.slice(Math.max(0, combined.length - MAX_ACTIVE));
       });
     }
   }, [currentTime, visible, danmakus, pickLane, screenWidth]);
```

---

### Incident Patch 2: `014b5d52` (2026-03-25)
**Commit Message**: fix: FollowedLiveStrip 样式优化 + getFollowedLiveRooms 参数调整

**File**: `components/FollowedLiveStrip.tsx` (modified, +8/-3)
```diff
@@ -46,13 +46,18 @@ export function FollowedLiveStrip() {
           >
             <View style={styles.pulseRow}>
               <LivePulse />
-              <Text style={{ color: "#fff", fontSize: 9,marginLeft:2 }}>直播</Text>
+              <Text style={{ color: "#fff", fontSize: 9, marginLeft: 2 }}>
+                直播
+              </Text>
             </View>
             <Image
               source={{ uri: proxyImageUrl(room.face) }}
               style={[styles.avatar, { backgroundColor: theme.card }]}
             />
-            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
+            <Text
+              style={[styles.name, { color: theme.text }]}
+              numberOfLines={1}
+            >
               {room.uname.length > 5 ? room.uname.slice(0, 5) : room.uname}
             </Text>
           </TouchableOpacity>
@@ -65,7 +70,7 @@ export function FollowedLiveStrip() {
 const styles = StyleSheet.create({
   container: {
     backgroundColor: "#f4f4f4",
-    paddingHorizontal: 3,
+    paddingHorizontal: 4,
     paddingVertical: 8,
   },
   scrollContent: {
```

**File**: `services/bilibili.ts` (modified, +1/-2)
```diff
@@ -509,8 +509,7 @@ export async function getDanmaku(cid: number): Promise<DanmakuItem[]> {
 
 export async function getFollowedLiveRooms(): Promise<LiveRoom[]> {
   const res = await api.get(`${LIVE_BASE}/xlive/web-ucenter/v1/xfetter/FeedList`, {
-    params: { page: 1, page_size: 30, platform: 'web' },
-    headers: { Referer: 'https://live.bilibili.com' },
+    params: { page: 1, page_size: 10, platform: 'web' },
   });
   if (res.data?.code !== 0) {
     console.warn('getFollowedLiveRooms error:', res.data?.code, res.data?.message);
```

---

### Incident Patch 3: `5bbc445b` (2026-03-25)
**Commit Message**: fix: login() 改为延迟后台拉取头像，修复 getFollowedLiveRooms 并发问题

login() 内 await getUserInfo() 导致 login() 慢返回，Zustand set 触发
FollowedLiveStrip 立即发起 getFollowedLiveRooms，与内部 getUserInfo
并发打到 B站新 session，触发风控返回空数据。

改为 setTimeout 1s 后台执行，login() 快速返回，各请求错开发出。

**File**: `store/authStore.ts` (modified, +11/-10)
```diff
@@ -27,16 +27,17 @@ export const useAuthStore = create<AuthState>((set) => ({
     // Migrate: remove SESSDATA from AsyncStorage if it was there before
     await AsyncStorage.removeItem('SESSDATA').catch(() => {});
     set({ sessdata, uid: uid || null, username: username || null, isLoggedIn: true });
-    // 登录后立即拉取用户信息，确保当前 session 头像可用（不依赖调用方 setProfile）
-    try {
-      const info = await getUserInfo();
-      await AsyncStorage.multiSet([
-        ['UID', String(info.mid)],
-        ['USERNAME', info.uname],
-        ['FACE', info.face],
-      ]);
-      set({ face: info.face, username: info.uname, uid: String(info.mid) });
-    } catch {}
+    // 延迟 1s 后台拉取头像，避免与登录后立即触发的其他请求（如 getFollowedLiveRooms）并发
+    setTimeout(() => {
+      getUserInfo().then(async (info) => {
+        await AsyncStorage.multiSet([
+          ['UID', String(info.mid)],
+          ['USERNAME', info.uname],
+          ['FACE', info.face],
+        ]).catch(() => {});
+        set({ face: info.face, username: info.uname, uid: String(info.mid) });
+      }).catch(() => {});
+    }, 1000);
   },
 
   logout: async () => {
```

---

### Incident Patch 4: `1e0931b5` (2026-03-25)
**Commit Message**: fix: 登录后头像不更新 — 将 getUserInfo 合并进 login()

登录流程之前分两步：login() 只设 isLoggedIn，getUserInfo/setProfile
由 LoginModal 调用。网络抖动或 B站 session 传播延迟时 getUserInfo
抛错被静默吞掉，face 不更新，直到下次启动 restore() 才修复。

修复：login() 内部完成 getUserInfo + 持久化，LoginModal 只需
await login() 后关闭弹窗，不再重复获取头像。

**File**: `components/LoginModal.tsx` (modified, +3/-7)
```diff
@@ -14,7 +14,7 @@ import * as FileSystem from "expo-file-system/legacy";
 import * as MediaLibrary from "expo-media-library";
 import QRCode from "react-native-qrcode-svg";
 import { Ionicons } from "@expo/vector-icons";
-import { generateQRCode, pollQRCode, getUserInfo } from "../services/bilibili";
+import { generateQRCode, pollQRCode } from "../services/bilibili";
 import { useAuthStore } from "../store/authStore";
 import { useTheme } from "../utils/theme";
 
@@ -33,7 +33,6 @@ export function LoginModal({ visible, onClose }: Props) {
   >("loading");
   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
   const login = useAuthStore((s) => s.login);
-  const setProfile = useAuthStore((s) => s.setProfile);
   const theme = useTheme();
 
   // sheet 滑入动画
@@ -86,14 +85,11 @@ export function LoginModal({ visible, onClose }: Props) {
           clearInterval(pollRef.current!);
           try {
             await login(result.cookie, "", "");
-            if (cancelled) return;
-            setStatus("done");
-            const info = await getUserInfo();
-            if (!cancelled) setProfile(info.face, info.uname, String(info.mid));
           } catch {
             if (!cancelled) setStatus("error");
+            return;
           }
-          onClose();
+          if (!cancelled) onClose();
         }
       } catch {
         // Network error during poll — ignore, will retry next interval
```

**File**: `store/authStore.ts` (modified, +11/-5)
```diff
@@ -24,13 +24,19 @@ export const useAuthStore = create<AuthState>((set) => ({
 
   login: async (sessdata, uid, username) => {
     await setSecure('SESSDATA', sessdata);
-    await AsyncStorage.multiSet([
-      ['UID', uid],
-      ['USERNAME', username ?? ''],
-    ]);
     // Migrate: remove SESSDATA from AsyncStorage if it was there before
     await AsyncStorage.removeItem('SESSDATA').catch(() => {});
-    set({ sessdata, uid, username: username ?? null, isLoggedIn: true });
+    set({ sessdata, uid: uid || null, username: username || null, isLoggedIn: true });
+    // 登录后立即拉取用户信息，确保当前 session 头像可用（不依赖调用方 setProfile）
+    try {
+      const info = await getUserInfo();
+      await AsyncStorage.multiSet([
+        ['UID', String(info.mid)],
+        ['USERNAME', info.uname],
+        ['FACE', info.face],
+      ]);
+      set({ face: info.face, username: info.uname, uid: String(info.mid) });
+    } catch {}
   },
 
   logout: async () => {
```

---

### Incident Patch 5: `463c0db0` (2026-03-25)
**Commit Message**: feat: 性能优化 + Bug修复 + 搜索增强

- expo-image 替换 RN Image（VideoCard/LiveCard/BigVideoCard/CommentItem，recyclingKey）
- DanmakuList Animated.Value 对象池，减少 GC 压力
- FlatList 性能参数：windowSize=7 / maxToRenderPerBatch=6 / removeClippedSubviews
- bilibili.ts 请求去重（getVideoDetail/getPlayUrl）
- SESSDATA 迁移至 expo-secure-store（utils/secureStorage.ts，启动自动迁移）
- 主题系统扩展：新增 sheetBg/modalBg/modalText/placeholder/iconDefault/danger 等 token
- 多组件深色模式适配：DownloadSheet/LivePlayer/NativeVideoPlayer/DownloadProgressBtn/CommentItem/LoginModal
- 搜索页增强：搜索建议 + 热搜榜（hooks/useSearch.ts + app/search.tsx）
- LoginModal 修复轮询竞态（cancelled flag + try-catch）
- 修复 downloads.tsx 冗余三元表达式

**File**: `app.json` (modified, +3/-1)
```diff
@@ -41,7 +41,9 @@
       "expo-router",
       "react-native-video",
       "expo-screen-orientation",
-      "@sentry/react-native/expo"
+      "@sentry/react-native/expo",
+      "expo-secure-store",
+      "expo-image"
     ],
     "experiments": {
       "typedRoutes": true
```

**File**: `app/downloads.tsx` (modified, +2/-2)
```diff
@@ -202,12 +202,12 @@ function DownloadRow({
         )}
         <TouchableOpacity
           style={styles.actionBtn}
-          onPress={isDownloading ? onDelete : onDelete}
+          onPress={onDelete}
         >
           <Ionicons
             name={isDownloading ? 'close-circle-outline' : 'trash-outline'}
             size={20}
-            color={isDownloading ? '#bbb' : '#bbb'}
+            color="#bbb"
           />
         </TouchableOpacity>
       </View>
```

**File**: `app/index.tsx` (modified, +6/-0)
```diff
@@ -334,6 +334,9 @@ export default function HomeScreen() {
             }
             onScroll={onScroll}
             scrollEventThrottle={16}
+            windowSize={7}
+            maxToRenderPerBatch={6}
+            removeClippedSubviews={true}
           />
         </View>
 
@@ -402,6 +405,9 @@ export default function HomeScreen() {
             }
             onScroll={onLiveScroll}
             scrollEventThrottle={16}
+            windowSize={7}
+            maxToRenderPerBatch={6}
+            removeClippedSubviews={true}
           />
         </View>
       </PagerView>
```

**File**: `app/live/[roomId].tsx` (modified, +0/-1)
```diff
@@ -24,7 +24,6 @@ type Tab = "intro" | "danmaku";
 
 export default function LiveDetailScreen() {
   const { roomId } = useLocalSearchParams<{ roomId: string }>();
-  console.log("LiveDetailScreen params:", { roomId });
   const router = useRouter();
   const theme = useTheme();
   const id = parseInt(roomId ?? "0", 10);
```

**File**: `app/search.tsx` (modified, +237/-31)
```diff
@@ -7,26 +7,50 @@ import {
   TouchableOpacity,
   FlatList,
   ActivityIndicator,
+  ScrollView,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
 import { Ionicons } from '@expo/vector-icons';
 import { VideoCard } from '../components/VideoCard';
-import { useSearch } from '../hooks/useSearch';
+import { useSearch, SearchSort } from '../hooks/useSearch';
 import { useTheme } from '../utils/theme';
 import type { VideoItem } from '../services/types';
 
+const SORT_OPTIONS: { key: SearchSort; label: string }[] = [
+  { key: 'default', label: '综合排序' },
+  { key: 'pubdate', label: '最新发布' },
+  { key: 'view', label: '最多播放' },
+];
+
 export default function SearchScreen() {
   const router = useRouter();
-  const { keyword, setKeyword, results, loading, hasMore, search, loadMore } = useSearch();
+  const {
+    keyword, setKeyword,
+    results, loading, hasMore,
+    search, loadMore,
+    sort, changeSort,
+    history, removeFromHistory, clearHistory,
+    suggestions,
+    hotSearches,
+  } = useSearch();
   const theme = useTheme();
   const inputRef = useRef<TextInput>(null);
+  const hasResults = results.length > 0;
+  const hasSearched = hasResults || (loading && results.length === 0);
 
-  const handleSearch = useCallback(() => {
-    if (keyword.trim()) {
-      search(keyword, true);
+  const handleSearch = useCallback((kw?: string) => {
+    const term = (kw ?? keyword).trim();
+    if (term) {
+      if (kw) setKeyword(kw);
+      search(kw ?? keyword, true);
     }
-  }, [keyword, search]);
+  }, [keyword, search, setKeyword]);
+
+  const handleSuggestionPress = useCallback((value: string) => {
+    setKeyword(value);
+    search(value, true);
+  }, [search, setKeyword]);
 
   const renderItem = useCallback(
     ({ item, index }: { item: VideoItem; index: number }) => {
@@ -61,16 +85,37 @@ export default function SearchScreen() {
     [],
   );
 
+  // Show pre-search panel (history + hot searches + suggestions)
+  const showPreSearch = !hasSearched && !loading;
+  const showSuggestions = suggestions.length > 0 && keyword.trim().length > 0 && !hasResults;
+
+  const ListHeaderComponent = useCallback(() => {
+    if (!hasResults) return null;
+    return (
+      <View style={[styles.sortBar, { backgroundColor: theme.card }]}>
+        {SORT_OPTIONS.map(opt => (
+          <TouchableOpacity
+            key={opt.key}
+            style={[styles.sortBtn, sort === opt.key && styles.sortBtnActive]}
+            onPress={() => changeSort(opt.key)}
+            activeOpacity={0.85}
+          >
+            <Text style={[styles.sortBtnText, sort === opt.key && styles.sortBtnTextActive]}>
+              {opt.label}
+            </Text>
+          </TouchableOpacity>
+        ))}
+      </View>
+    );
+  }, [hasResults, sort, changeSort, theme.card]);
+
   const ListEmptyComponent = () => {
     if (loading) return null;
+    if (!keyword.trim()) return null;
     return (
       <View style={styles.emptyBox}>
         <Ionicons name="search-outline" size={48} color="#ddd" />
-        <Text style={[styles.emptyText, { color: theme.textSub }]}>
-          {results.length === 0 && keyword.trim()
-            ? '没有找到相关视频'
-            : '输入关键词搜索'}
-        </Text>
+        <Text style={[styles.emptyText, { color: theme.textSub }]}>没有找到相关视频</Text>
       </View>
     );
   };
@@ -90,7 +135,7 @@ export default function SearchScreen() {
             placeholderTextColor="#999"
             value={keyword}
             onChangeText={setKeyword}
-            onSubmitEditing={handleSearch}
+            onSubmitEditing={() => handleSearch()}
             returnKeyType="search"
             autoFocus
             autoCapitalize="none"
@@ -102,29 +147,109 @@ export default function SearchScreen() {
             </TouchableOpacity>
           )}
         </View>
-        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
+        <Touchable
```

---

### Incident Patch 6: `27587859` (2026-03-25)
**Commit Message**: fix: getFollowedLiveRooms 修正 Referer、校验 code、兼容 list/rooms 字段

**File**: `services/bilibili.ts` (modified, +8/-2)
```diff
@@ -509,9 +509,15 @@ export async function getDanmaku(cid: number): Promise<DanmakuItem[]> {
 
 export async function getFollowedLiveRooms(): Promise<LiveRoom[]> {
   const res = await api.get(`${LIVE_BASE}/xlive/web-ucenter/v1/xfetter/FeedList`, {
-    params: { page: 1, page_size: 10, platform: 'web' },
+    params: { page: 1, page_size: 30, platform: 'web' },
+    headers: { Referer: 'https://live.bilibili.com' },
   });
-  const list = res.data?.data?.list ?? [];
+  if (res.data?.code !== 0) {
+    console.warn('getFollowedLiveRooms error:', res.data?.code, res.data?.message);
+    return [];
+  }
+  // B站不同版本接口返回字段可能为 list 或 rooms
+  const list: any[] = res.data?.data?.list ?? res.data?.data?.rooms ?? [];
   return list.map((r: any) => ({
     roomid: r.room_id ?? r.roomid,
     uid: r.uid,
```

---

### Incident Patch 7: `749dbb81` (2026-03-25)
**Commit Message**: fix: getUploaderVideos 加 WBI 签名，移除调试 log

**File**: `services/bilibili.ts` (modified, +3/-3)
```diff
@@ -193,9 +193,9 @@ export async function getUploaderInfo(mid: number): Promise<{ name: string; face
 }
 
 export async function getUploaderVideos(mid: number, pn = 1, ps = 20): Promise<{ videos: VideoItem[]; total: number }> {
-  const res = await api.get('/x/space/wbi/arc/search', {
-    params: { mid, pn, ps, order: 'pubdate', platform: 'web' },
-  });
+  const { imgKey, subKey } = await getWbiKeys();
+  const signed = signWbi({ mid, pn, ps, order: 'pubdate', platform: 'web' }, imgKey, subKey);
+  const res = await api.get('/x/space/wbi/arc/search', { params: signed });
   const vlist: any[] = res.data?.data?.list?.vlist ?? [];
   const total: number = res.data?.data?.page?.count ?? 0;
   const videos: VideoItem[] = vlist.map((v: any) => ({
```

---

### Incident Patch 8: `b4d5d2a0` (2026-03-25)
**Commit Message**: Merge branch 'master-bug'

# Conflicts:
#	CHANGELOG.md
#	app/video/[bvid].tsx
#	components/DanmakuList.tsx

**File**: `CHANGELOG.md` (modified, +18/-0)
```diff
@@ -5,6 +5,24 @@
 
 ---
 
+## [1.0.13] - 2026-03-25
+
+### 修复
+- **小窗 PanResponder 闭包过期**：`useRef(PanResponder.create(...))` 捕获初始 `roomId=0` / `bvid=""`，导致点击小窗跳转到错误页面；改用 `storeRef` 模式保持最新值
+- **直播小窗进入详情无限 loading**：`useLiveDetail` 使用 `cancelled` 闭包标志，effect cleanup 后 fetch 被静默丢弃；改用 `latestRoomId` ref 比对替代 cancelled 模式
+- **进入播放器页面小窗不关闭**：视频/直播详情页进入时通过 `useLayoutEffect` + `getState().clearLive()` 同步清除小窗，避免双播和资源竞争
+- **BigVideoCard 与直播小窗冲突**：首页 BigVideoCard 自动播放与直播小窗竞争解码器资源；小窗活跃时跳过 Video 渲染，仅显示封面图
+- **退出全屏视频暂停**：互斥渲染后竖屏播放器重新挂载，react-native-video seek 后不自动恢复播放；`onLoad` 中强制 `paused` 状态切换触发播放
+
+### 优化
+- **视频播放器单实例**：竖屏/全屏互斥渲染（`{!fullscreen && ...}` / `{fullscreen && ...}`），不再同时挂载两个 Video 解码器，减半 GPU/内存占用
+- **onProgress 节流**：`progressUpdateInterval` 从 250ms 调为 500ms，回调内增加 450ms 节流和 seeking 跳过，减少重渲染
+- **移除调试日志**：清理 NativeVideoPlayer 中遗留的 `console.log`
+- **下载页 UI 优化**：下载管理页交互和暗黑主题适配
+
+---
+
+
 ## [1.0.12] - 2026-03-25
 
 ### 新增
```

**File**: `app/_layout.tsx` (modified, +2/-0)
```diff
@@ -8,6 +8,7 @@ import { useDownloadStore } from '../store/downloadStore';
 import { useSettingsStore } from '../store/settingsStore';
 import { useTheme } from '../utils/theme';
 import { MiniPlayer } from '../components/MiniPlayer';
+import { LiveMiniPlayer } from '../components/LiveMiniPlayer';
 import * as Sentry from '@sentry/react-native';
 import { ErrorBoundary } from '@sentry/react-native';
 import { useFonts } from 'expo-font';
@@ -87,6 +88,7 @@ function RootLayout() {
           </Stack>
         </ErrorBoundary>
         <MiniPlayer />
+        <LiveMiniPlayer />
       </View>
     </SafeAreaProvider>
   );
```

**File**: `app/downloads.tsx` (modified, +98/-66)
```diff
@@ -6,10 +6,9 @@ import {
   StyleSheet,
   TouchableOpacity,
   Image,
-  ActivityIndicator,
   Modal,
   StatusBar,
-  useWindowDimensions,
+  Alert,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
 import { useRouter } from 'expo-router';
@@ -19,15 +18,15 @@ let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
 try { ScreenOrientation = require('expo-screen-orientation'); } catch {}
 import { useDownloadStore, DownloadTask } from '../store/downloadStore';
 import { LanShareModal } from '../components/LanShareModal';
+import { proxyImageUrl } from '../utils/imageUrl';
+import { useTheme } from '../utils/theme';
 
 function formatFileSize(bytes?: number): string {
   if (!bytes || bytes <= 0) return '';
   if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
   if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
   return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
 }
-import { proxyImageUrl } from '../utils/imageUrl';
-import { useTheme } from '../utils/theme';
 
 export default function DownloadsScreen() {
   const router = useRouter();
@@ -36,8 +35,6 @@ export default function DownloadsScreen() {
   const [playingUri, setPlayingUri] = useState<string | null>(null);
   const [playingTitle, setPlayingTitle] = useState('');
   const [shareTask, setShareTask] = useState<(DownloadTask & { key: string }) | null>(null);
-  const { width, height } = useWindowDimensions();
-  const isLandscape = width > height;
 
   async function openPlayer(uri: string, title: string) {
     setPlayingTitle(title);
@@ -50,6 +47,18 @@ export default function DownloadsScreen() {
     await ScreenOrientation?.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
   }
 
+  function confirmDelete(key: string, status: DownloadTask['status']) {
+    const isDownloading = status === 'downloading';
+    Alert.alert(
+      isDownloading ? '取消下载' : '删除下载',
+      isDownloading ? '确定取消该下载任务？' : '确定删除该文件？删除后不可恢复。',
+      [
+        { text: '取消', style: 'cancel' },
+        { text: isDownloading ? '取消下载' : '删除', style: 'destructive', onPress: () => removeTask(key) },
+      ],
+    );
+  }
+
   useEffect(() => {
     loadFromStorage();
   }, []);
@@ -74,29 +83,33 @@ export default function DownloadsScreen() {
 
       {sections.length === 0 ? (
         <View style={styles.empty}>
-          <Ionicons name="cloud-download-outline" size={56} color="#ccc" />
-          <Text style={styles.emptyTxt}>暂无下载记录</Text>
+          <Ionicons name="cloud-download-outline" size={56} color={theme.textSub} />
+          <Text style={[styles.emptyTxt, { color: theme.textSub }]}>暂无下载记录</Text>
         </View>
       ) : (
         <SectionList
           sections={sections}
           keyExtractor={(item) => item.key}
           renderSectionHeader={({ section }) => (
-            <View style={styles.sectionHeader}>
-              <Text style={styles.sectionTitle}>{section.title}</Text>
+            <View style={[styles.sectionHeader, { backgroundColor: theme.bg }]}>
+              <Text style={[styles.sectionTitle, { color: theme.textSub }]}>{section.title}</Text>
             </View>
           )}
           renderItem={({ item }) => (
             <DownloadRow
               task={item}
+              theme={theme}
               onPlay={() => {
                 if (item.localUri) openPlayer(item.localUri, item.title);
               }}
-              onDelete={() => removeTask(item.key)}
+              onDelete={() => confirmDelete(item.key, item.status)}
               onShare={() => setShareTask(item)}
+              onRetry={() => router.push(`/video/${item.bvid}` as any)}
             />
           )}
-          ItemSeparatorComponent={() => <View style={styles.separator} />}
+          ItemSeparatorComponent={() => (
+            <View style={[styles.separator, { backgroundColor: theme.border, marginLeft: 108 }]} />
+          )}
           conten
```

**File**: `app/index.tsx` (modified, +0/-3)
```diff
@@ -422,7 +422,6 @@ export default function HomeScreen() {
             styles.header,
             {
               opacity: currentHeaderOpacity,
-              borderBottomColor: theme.border,
             },
           ]}
         >
@@ -507,8 +506,6 @@ const styles = StyleSheet.create({
     alignItems: "center",
     paddingHorizontal: 16,
     gap: 10,
-    borderBottomWidth: StyleSheet.hairlineWidth,
-    borderBottomColor: "#eee",
   },
   logo: {
     fontSize: 20,
```

**File**: `app/live/[roomId].tsx` (modified, +25/-1)
```diff
@@ -1,4 +1,4 @@
-import React, { useState } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -18,14 +18,22 @@ import DanmakuList from "../../components/DanmakuList";
 import { formatCount } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { useTheme } from "../../utils/theme";
+import { useLiveStore } from "../../store/liveStore";
 
 type Tab = "intro" | "danmaku";
 
 export default function LiveDetailScreen() {
   const { roomId } = useLocalSearchParams<{ roomId: string }>();
+  console.log("LiveDetailScreen params:", { roomId });
   const router = useRouter();
   const theme = useTheme();
   const id = parseInt(roomId ?? "0", 10);
+
+  // 进入详情页时立即清除小窗（useLayoutEffect 在绘制前同步执行）
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
+
   const { room, anchor, stream, loading, error, changeQuality } =
     useLiveDetail(id);
   const [tab, setTab] = useState<Tab>("intro");
@@ -36,6 +44,8 @@ export default function LiveDetailScreen() {
   const qualities = stream?.qualities ?? [];
   const currentQn = stream?.qn ?? 0;
 
+  const setLive = useLiveStore(s => s.setLive);
+
   const actualRoomId = room?.roomid ?? id;
   const { danmakus, giftCounts } = useLiveDanmaku(isLive ? actualRoomId : 0);
 
@@ -49,6 +59,19 @@ export default function LiveDetailScreen() {
         <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
           {room?.title ?? "直播间"}
         </Text>
+        {isLive && hlsUrl ? (
+          <TouchableOpacity
+            style={styles.pipBtn}
+            onPress={() => {
+              setLive(id, room?.title ?? '', room?.keyframe ?? '', hlsUrl);
+              router.back();
+            }}
+          >
+            <Ionicons name="browsers-outline" size={22} color={theme.text} />
+          </TouchableOpacity>
+        ) : (
+          <View style={styles.pipBtn} />
+        )}
       </View>
 
       {/* Player */}
@@ -177,6 +200,7 @@ const styles = StyleSheet.create({
     borderBottomWidth: StyleSheet.hairlineWidth,
   },
   backBtn: { padding: 4 },
+  pipBtn: { padding: 4, width: 32, alignItems: 'center' },
   topTitle: {
     flex: 1,
     fontSize: 15,
```

---

### Incident Patch 9: `e3def7d0` (2026-03-25)
**Commit Message**: fix: 修复小窗闭包过期、详情页 loading 卡死、视频播放器性能问题

- 小窗 PanResponder 用 storeRef 替代闭包捕获，修复 roomId/bvid 始终为初始值
- useLiveDetail 用 ref 比对替代 cancelled 标志，防止 fetch 被意外取消
- 详情页 useLayoutEffect 同步清除小窗，BigVideoCard 小窗活跃时跳过播放
- 视频播放器竖屏/全屏互斥渲染，减半解码器占用
- onProgress 节流 + 退出全屏强制恢复播放

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -5,6 +5,23 @@
 
 ---
 
+## [1.0.13] - 2026-03-25
+
+### 修复
+- **小窗 PanResponder 闭包过期**：`useRef(PanResponder.create(...))` 捕获初始 `roomId=0` / `bvid=""`，导致点击小窗跳转到错误页面；改用 `storeRef` 模式保持最新值
+- **直播小窗进入详情无限 loading**：`useLiveDetail` 使用 `cancelled` 闭包标志，effect cleanup 后 fetch 被静默丢弃；改用 `latestRoomId` ref 比对替代 cancelled 模式
+- **进入播放器页面小窗不关闭**：视频/直播详情页进入时通过 `useLayoutEffect` + `getState().clearLive()` 同步清除小窗，避免双播和资源竞争
+- **BigVideoCard 与直播小窗冲突**：首页 BigVideoCard 自动播放与直播小窗竞争解码器资源；小窗活跃时跳过 Video 渲染，仅显示封面图
+- **退出全屏视频暂停**：互斥渲染后竖屏播放器重新挂载，react-native-video seek 后不自动恢复播放；`onLoad` 中强制 `paused` 状态切换触发播放
+
+### 优化
+- **视频播放器单实例**：竖屏/全屏互斥渲染（`{!fullscreen && ...}` / `{fullscreen && ...}`），不再同时挂载两个 Video 解码器，减半 GPU/内存占用
+- **onProgress 节流**：`progressUpdateInterval` 从 250ms 调为 500ms，回调内增加 450ms 节流和 seeking 跳过，减少重渲染
+- **移除调试日志**：清理 NativeVideoPlayer 中遗留的 `console.log`
+- **下载页 UI 优化**：下载管理页交互和暗黑主题适配
+
+---
+
 ## [1.0.12] - 2026-03-25
 
 ### 新增
```

**File**: `app/downloads.tsx` (modified, +10/-21)
```diff
@@ -8,7 +8,6 @@ import {
   Image,
   Modal,
   StatusBar,
-  useWindowDimensions,
   Alert,
 } from 'react-native';
 import { SafeAreaView } from 'react-native-safe-area-context';
@@ -36,14 +35,10 @@ export default function DownloadsScreen() {
   const [playingUri, setPlayingUri] = useState<string | null>(null);
   const [playingTitle, setPlayingTitle] = useState('');
   const [shareTask, setShareTask] = useState<(DownloadTask & { key: string }) | null>(null);
-  const [showControls, setShowControls] = useState(true);
-  const { width, height } = useWindowDimensions();
-  const isLandscape = width > height;
 
   async function openPlayer(uri: string, title: string) {
     setPlayingTitle(title);
     setPlayingUri(uri);
-    setShowControls(true);
     await ScreenOrientation?.unlockAsync();
   }
 
@@ -133,29 +128,23 @@ export default function DownloadsScreen() {
         onRequestClose={closePlayer}
       >
         <StatusBar hidden />
-        <TouchableOpacity
-          activeOpacity={1}
-          style={styles.playerBg}
-          onPress={() => setShowControls(v => !v)}
-        >
+        <View style={styles.playerBg}>
           {playingUri && (
             <Video
               source={{ uri: playingUri }}
-              style={isLandscape ? { width, height } : { width, height: width * 0.5625 }}
+              style={StyleSheet.absoluteFillObject}
               resizeMode="contain"
-              controls={false}
+              controls
               paused={false}
             />
           )}
-          {showControls && (
-            <View style={[styles.playerBar, isLandscape && { top: 16 }]}>
-              <TouchableOpacity onPress={closePlayer} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
-                <Ionicons name="chevron-back" size={24} color="#fff" />
-              </TouchableOpacity>
-              <Text style={styles.playerTitle} numberOfLines={1}>{playingTitle}</Text>
-            </View>
-          )}
-        </TouchableOpacity>
+          <View style={styles.playerBar}>
+            <TouchableOpacity onPress={closePlayer} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
+              <Ionicons name="chevron-back" size={24} color="#fff" />
+            </TouchableOpacity>
+            <Text style={styles.playerTitle} numberOfLines={1}>{playingTitle}</Text>
+          </View>
+        </View>
       </Modal>
     </SafeAreaView>
   );
```

**File**: `app/live/[roomId].tsx` (modified, +9/-10)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useEffect } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -24,9 +24,16 @@ type Tab = "intro" | "danmaku";
 
 export default function LiveDetailScreen() {
   const { roomId } = useLocalSearchParams<{ roomId: string }>();
+  console.log("LiveDetailScreen params:", { roomId });
   const router = useRouter();
   const theme = useTheme();
   const id = parseInt(roomId ?? "0", 10);
+
+  // 进入详情页时立即清除小窗（useLayoutEffect 在绘制前同步执行）
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
+
   const { room, anchor, stream, loading, error, changeQuality } =
     useLiveDetail(id);
   const [tab, setTab] = useState<Tab>("intro");
@@ -37,15 +44,7 @@ export default function LiveDetailScreen() {
   const qualities = stream?.qualities ?? [];
   const currentQn = stream?.qn ?? 0;
 
-  const { setLive, clearLive } = useLiveStore();
-
-  // 进入该直播间时，若小窗正在播放同一房间，清除小窗避免双播
-  // 仅在挂载时运行一次（用 getState 读值，不创建响应式依赖）
-  useEffect(() => {
-    if (useLiveStore.getState().roomId === id) {
-      clearLive();
-    }
-  }, []);
+  const setLive = useLiveStore(s => s.setLive);
 
   const actualRoomId = room?.roomid ?? id;
   const { danmakus, giftCounts } = useLiveDanmaku(isLive ? actualRoomId : 0);
```

**File**: `app/video/[bvid].tsx` (modified, +7/-1)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useRef } from "react";
+import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
 import {
   View,
   Text,
@@ -23,13 +23,19 @@ import { formatCount, formatDuration } from "../../utils/format";
 import { proxyImageUrl } from "../../utils/imageUrl";
 import { DownloadSheet } from "../../components/DownloadSheet";
 import { useTheme } from "../../utils/theme";
+import { useLiveStore } from "../../store/liveStore";
 
 type Tab = "intro" | "comments" | "danmaku";
 
 export default function VideoDetailScreen() {
   const { bvid } = useLocalSearchParams<{ bvid: string }>();
   const router = useRouter();
   const theme = useTheme();
+
+  // 进入视频详情页时立即清除直播小窗
+  useLayoutEffect(() => {
+    useLiveStore.getState().clearLive();
+  }, []);
   const {
     video,
     playData,
```

**File**: `components/BigVideoCard.tsx` (modified, +7/-8)
```diff
@@ -23,6 +23,7 @@ import { getPlayUrl, getVideoDetail } from "../services/bilibili";
 import { coverImageUrl } from "../utils/imageUrl";
 import { useSettingsStore } from "../store/settingsStore";
 import { useTheme } from "../utils/theme";
+import { useLiveStore } from "../store/liveStore";
 import { formatCount, formatDuration } from "../utils/format";
 import type { VideoItem } from "../services/types";
 
@@ -57,6 +58,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
 }: Props) {
   const { width: SCREEN_W } = useWindowDimensions();
   const trafficSaving = useSettingsStore(s => s.trafficSaving);
+  const liveActive = useLiveStore(s => s.isActive);
   const theme = useTheme();
   const THUMB_H = SCREEN_W * 0.5625;
   const mediaDimensions = { width: SCREEN_W - 8, height: THUMB_H };
@@ -92,7 +94,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
 
   // Preload: fetch play URL on mount (before card is visible)
   useEffect(() => {
-    if (videoUrl || trafficSaving) return;
+    if (videoUrl || trafficSaving || liveActive) return;
     let cancelled = false;
     (async () => {
       try {
@@ -127,8 +129,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
   // Pause/resume based on visibility and scroll state
   useEffect(() => {
     if (!videoUrl) return;
-    if (!isVisible || trafficSaving) {
-      // Off-screen or traffic saving: pause, mute, show thumbnail
+    if (!isVisible || trafficSaving || liveActive) {
       setPaused(true);
       setMuted(true);
       Animated.timing(thumbOpacity, {
@@ -137,21 +138,19 @@ export const BigVideoCard = React.memo(function BigVideoCard({
         useNativeDriver: true,
       }).start();
     } else if (isScrolling) {
-      // Visible but scrolling: just pause (keep thumbnail hidden, keep mute state)
       setPaused(true);
     } else {
-      // Visible and not scrolling: play, fade out thumbnail
       setPaused(false);
       Animated.timing(thumbOpacity, {
         toValue: 0,
         duration: 300,
         useNativeDriver: true,
       }).start();
     }
-  }, [isVisible, isScrolling, videoUrl, trafficSaving]);
+  }, [isVisible, isScrolling, videoUrl, trafficSaving, liveActive]);
 
   const handleVideoReady = () => {
-    if (!isVisible || isScrolling || trafficSaving) return;
+    if (!isVisible || isScrolling || trafficSaving || liveActive) return;
     setPaused(false);
     Animated.timing(thumbOpacity, {
       toValue: 0,
@@ -229,7 +228,7 @@ export const BigVideoCard = React.memo(function BigVideoCard({
       {/* Media area */}
       <View style={[mediaDimensions, { position: "relative" }]}>
         {/* Video player — rendered first so it sits behind the thumbnail */}
-        {videoUrl && (
+        {videoUrl && !liveActive && (
           <Video
             ref={videoRef}
             source={
```

---

### Incident Patch 10: `68b8b7d6` (2026-03-25)
**Commit Message**: fix: 彻底修复小窗无法拖动问题

根本原因：TouchableOpacity 内嵌在 PanResponder Animated.View 内，
  JS层 TouchableOpacity 与 Video 原生层共同阻断了 PanResponder 响应权。

修复方案：
- onStartShouldSetPanResponder: true，从 start 阶段独占响应权
- 移除主内容区的 TouchableOpacity，改用纯 View
- isDragging ref 区分点击与拖动：位移 >5px 为拖动
- onPanResponderRelease 通过 locationX/Y 坐标判断点击目标（关闭 or 跳转）
- Video 外层 View 加 pointerEvents='none' 防止原生层吞噬触摸

**File**: `components/LiveMiniPlayer.tsx` (modified, +72/-72)
```diff
@@ -4,7 +4,6 @@ import {
   Text,
   Image,
   StyleSheet,
-  TouchableOpacity,
   Animated,
   PanResponder,
   Dimensions,
@@ -26,84 +25,86 @@ const LIVE_HEADERS = {
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
 };
 
+function snapRelease(
+  pan: Animated.ValueXY,
+  curX: number,
+  curY: number,
+  sw: number,
+  sh: number,
+) {
+  const snapRight = 0;
+  const snapLeft = -(sw - MINI_W - 24);
+  const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
+  const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
+  Animated.spring(pan, {
+    toValue: { x: snapX, y: clampedY },
+    useNativeDriver: false,
+    tension: 120,
+    friction: 10,
+  }).start();
+}
+
 export function LiveMiniPlayer() {
   const { isActive, roomId, title, cover, hlsUrl, clearLive } = useLiveStore();
   const videoMiniActive = useVideoStore(s => s.isActive);
   const router = useRouter();
   const insets = useSafeAreaInsets();
   const pan = useRef(new Animated.ValueXY()).current;
+  const isDragging = useRef(false);
 
   const panResponder = useRef(
     PanResponder.create({
-      // 不在 start 阶段抢夺，让 TouchableOpacity 的点击正常触发
-      onStartShouldSetPanResponder: () => false,
-      onStartShouldSetPanResponderCapture: () => false,
-      // 有实际位移时，从子组件夺回响应权（capture 阶段，优先于子组件）
-      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
-      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
+      onStartShouldSetPanResponder: () => true,
       onPanResponderGrant: () => {
+        isDragging.current = false;
         pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
         pan.setValue({ x: 0, y: 0 });
       },
-      onPanResponderMove: Animated.event(
-        [null, { dx: pan.x, dy: pan.y }],
-        { useNativeDriver: false },
-      ),
-      onPanResponderRelease: () => {
-        pan.flattenOffset();
-        const { width: sw, height: sh } = Dimensions.get('window');
-        const curX = (pan.x as any)._value;
-        const curY = (pan.y as any)._value;
-
-        // 吸附到左边缘或右边缘（取最近的一侧）
-        const snapRight = 0;
-        const snapLeft = -(sw - MINI_W - 24);
-        const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
-
-        const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
-
-        Animated.spring(pan, {
-          toValue: { x: snapX, y: clampedY },
-          useNativeDriver: false,
-          tension: 120,
-          friction: 10,
-        }).start();
+      onPanResponderMove: (_, gs) => {
+        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
+          isDragging.current = true;
+        }
+        pan.x.setValue(gs.dx);
+        pan.y.setValue(gs.dy);
       },
-      onPanResponderTerminate: () => {
+      onPanResponderRelease: (evt) => {
         pan.flattenOffset();
+        if (!isDragging.current) {
+          const { locationX, locationY } = evt.nativeEvent;
+          if (locationX > MINI_W - 28 && locationY < 28) {
+            clearLive();
+          } else {
+            router.push(`/live/${roomId}` as any);
+          }
+          return;
+        }
+        const { width: sw, height: sh } = Dimensions.get('window');
+        snapRelease(pan, (pan.x as any)._value, (pan.y as any)._value, sw, sh);
       },
+      onPanResponderTerminate: () => { pan.flattenOffset(); },
     }),
   ).current;
 
   if (!isActive) return null;
 
-  // 视频 MiniPlayer 激活时，直播小窗叠放其上方（避免重叠）
   const bottomOffset = insets.bottom + 16 + (videoMiniActive ? 106 : 0);
 
-  const handlePress = () => {
-    router.push(`/live/${roomId}` as any);
-  };
-
-  // Web 端降级：展示封面图 + LIVE 徽标
+  // Web 端降级：封面图 + LIVE 徽标
   if (Platform.OS === 'web') {
     return (
       <Animated.View
         style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
         {...panResponder.panHand
```

**File**: `components/MiniPlayer.tsx` (modified, +32/-28)
```diff
@@ -1,6 +1,6 @@
 import React, { useRef } from 'react';
 import {
-  View, Text, Image, StyleSheet, TouchableOpacity,
+  View, Text, Image, StyleSheet,
   Animated, PanResponder, Dimensions,
 } from 'react-native';
 import { useRouter } from 'expo-router';
@@ -17,42 +17,52 @@ export function MiniPlayer() {
   const router = useRouter();
   const insets = useSafeAreaInsets();
   const pan = useRef(new Animated.ValueXY()).current;
+  const isDragging = useRef(false);
 
   const panResponder = useRef(
     PanResponder.create({
-      onStartShouldSetPanResponder: () => false,
-      onStartShouldSetPanResponderCapture: () => false,
-      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
-      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) =>
-        Math.abs(dx) > 3 || Math.abs(dy) > 3,
+      // 从 start 阶段即抢占响应权，确保拖动可靠触发
+      onStartShouldSetPanResponder: () => true,
       onPanResponderGrant: () => {
+        isDragging.current = false;
         pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
         pan.setValue({ x: 0, y: 0 });
       },
-      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
-      onPanResponderRelease: () => {
+      onPanResponderMove: (_, gs) => {
+        if (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5) {
+          isDragging.current = true;
+        }
+        pan.x.setValue(gs.dx);
+        pan.y.setValue(gs.dy);
+      },
+      onPanResponderRelease: (evt) => {
         pan.flattenOffset();
+        if (!isDragging.current) {
+          // 点击：通过坐标判断是关闭还是跳转
+          const { locationX, locationY } = evt.nativeEvent;
+          if (locationX > MINI_W - 28 && locationY < 28) {
+            clearVideo();
+          } else {
+            router.push(`/video/${bvid}` as any);
+          }
+          return;
+        }
+        // 拖动：吸附到最近边缘
         const { width: sw, height: sh } = Dimensions.get('window');
         const curX = (pan.x as any)._value;
         const curY = (pan.y as any)._value;
-
         const snapRight = 0;
         const snapLeft = -(sw - MINI_W - 24);
         const snapX = curX < snapLeft / 2 ? snapLeft : snapRight;
-
         const clampedY = Math.max(-sh + MINI_H + 60, Math.min(60, curY));
-
         Animated.spring(pan, {
           toValue: { x: snapX, y: clampedY },
           useNativeDriver: false,
           tension: 120,
           friction: 10,
         }).start();
       },
-      onPanResponderTerminate: () => {
-        pan.flattenOffset();
-      },
+      onPanResponderTerminate: () => { pan.flattenOffset(); },
     })
   ).current;
 
@@ -65,17 +75,12 @@ export function MiniPlayer() {
       style={[styles.container, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
       {...panResponder.panHandlers}
     >
-      <TouchableOpacity
-        style={styles.main}
-        onPress={() => router.push(`/video/${bvid}` as any)}
-        activeOpacity={0.85}
-      >
-        <Image source={{ uri: proxyImageUrl(cover) }} style={styles.cover} />
-        <Text style={styles.title} numberOfLines={1}>{title}</Text>
-      </TouchableOpacity>
-      <TouchableOpacity style={styles.closeBtn} onPress={clearVideo}>
+      <Image source={{ uri: proxyImageUrl(cover) }} style={styles.cover} />
+      <Text style={styles.title} numberOfLines={1}>{title}</Text>
+      {/* 关闭按钮仅作视觉展示，点击逻辑由 onPanResponderRelease 坐标判断处理 */}
+      <View style={styles.closeBtn}>
         <Ionicons name="close" size={14} color="#fff" />
-      </TouchableOpacity>
+      </View>
     </Animated.View>
   );
 }
@@ -84,8 +89,8 @@ const styles = StyleSheet.create({
   container: {
     position: 'absolute',
     right: 12,
-    width: 160,
-    height: 90,
+    width: MINI_W,
+    height: MINI_H,
     borderRadius: 8,
     backgroundColor: '#1a1a1a',
     overflow: 'hidden',
@@ -95,7 +100,6 @@ const styles = StyleSheet.create({
     shadowOpacity: 0.3,
     shadowRa
```

#### Recent Merged Pull Requests:
- **PR #30** (2026-03-25): fix(web): 补全缺失的 web shims 并修复渲染崩溃问题 (@Actv6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
