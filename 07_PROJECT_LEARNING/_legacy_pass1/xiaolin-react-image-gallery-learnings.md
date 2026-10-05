# Forensic Learning Record (Deep Inspection): xiaolin/react-image-gallery

> **Canonical Artifact**: `07_PROJECT_LEARNING/xiaolin-react-image-gallery-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xiaolin/react-image-gallery](https://github.com/xiaolin/react-image-gallery))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:34:05.874Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xiaolin/react-image-gallery`
- **Description**: React carousel image gallery component with thumbnail support  🖼
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3941 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.mjs`
```
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import react from "eslint-plugin-react";
import jest from "eslint-plugin-jest";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import tseslint from "typescript-eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

// Shared rules for both JS and TS files
const sharedRules = {
  "react/display-name": "off",
  "sort-imports": [
    "error",
    {
      ignoreCase: true,
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
    },
  ],
  "import/order": [
    "error",
    {
      groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
      pathGroups: [
        {
          pattern: "react",
          group: "external",
          position: "before",
        },
        {
          pattern: "src/**",
          group: "internal",
        },
      ],
      pathGroupsExcludedImportTypes: ["react"],
      "newlines-between": "never",
      alphabetize: {
        order: "asc",
        caseInsensitive: true,
      },
    },
  ],
  "react/jsx-sort-props": [
    "error",
    {
      callbacksLast: true,
      shorthandFirst: true,
      ignoreCase: true,
      reservedFirst: true,
    },
  ],
  "react/sort-prop-types": [
    "error",
    {
      callbacksLast: true,
      ignoreCase: true,
      sortShapeProp: true,
    },
  ],
  "prettier/prettier": [
    "error",
    {
      trailingComma: "es5",
    },
  ],
};

export default [
  {
    ignores: ["**/*.cjs"],
  },
  ...fixupConfigRules(
    compat.extends(
      "eslint:recommended",
      "plugin:react/recommended",
      "plugin:prettier/recommended",
      "plugin:import/errors",
      "plugin:import/warnings",
      "plugin:jsx-a11y/recommended",
      "plugin:react-hooks/recommended",
      "plugin:jest/recommended"
    )
  ),
  // JavaScript/JSX configuration
  {
    files: ["**/*.js", "**/*.jsx"],
    plugins: {
      react: fixupPluginRules(react),
      jest: fixupPluginRules(jest),
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parser: babelParser,
      ecmaVersion: 12,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
        alias: {
          map: [["src", "./src"]],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
    },
    rules: sharedRules,
  },
  // TypeScript/TSX configuration
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      react: fixupPluginRules(react),
      jest: fixupPluginRules(jest),
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
        },
        alias: {
          map: [["src", "./src"]],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
      },
    },
    rules: {
      ...sharedRules,
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Disable base rules that are handled by TypeScript
      "no-unused-vars": "off",
      "no-undef": "off",
      // Disable prop-types for TypeScript (TS handles this)
      "react/prop-types": "off",
    },
  },
];

```

### Core Architecture Module: `example/App.jsx`
```
import React from "react";
import { createRoot } from "react-dom/client";
import ImageGallery from "src/components/ImageGallery";
import "../styles/image-gallery.css";

const PREFIX_URL =
  "https://raw.githubusercontent.com/xiaolin/react-image-gallery/master/static/";

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      showIndex: false,
      showBullets: true,
      infinite: true,
      showThumbnails: true,
      showFullscreenButton: true,
      showGalleryFullscreenButton: true,
      showPlayButton: true,
      showGalleryPlayButton: true,
      showNav: true,
      slideVertically: false,
      isRTL: false,
      slideDuration: 550,
      slideInterval: 2000,
      slideOnThumbnailOver: false,
      thumbnailPosition: "bottom",
      showVideo: false,
      useWindowKeyDown: true,
      lazyLoad: false,
      maxBullets: 0,
      darkMode: false,
    };
    this._toggleShowVideo = this._toggleShowVideo.bind(this);

    this.images = [
      {
        thumbnail: `${PREFIX_URL}4v.jpg`,
        original: `${PREFIX_URL}4v.jpg`,
        embedUrl:
          "https://www.youtube.com/embed/4pSzhZ76GdM?autoplay=1&showinfo=0",
        description: "Render custom slides (such as videos)",
        renderItem: this._renderVideo.bind(this),
      },
      {
        original: `${PREFIX_URL}1.jpg`,
        thumbnail: `${PREFIX_URL}1t.jpg`,
        originalClass: "featured-slide",
        thumbnailClass: "featured-thumb",
        description: "Custom class for slides & thumbnails",
      },
    ].concat(this._getStaticImages());
  }

  _onImageClick(event) {
    console.debug(
      "clicked on image",
      event.target,
      "at index",
      this._imageGallery.getCurrentIndex()
    );
  }

  _onImageLoad(event) {
    console.debug("loaded image", event.target.src);
  }

  _onSlide(index) {
    this._resetVideo();
    console.debug("slid to index", index);
  }

  _onPause(index) {
    console.debug("paused on index", index);
  }

  _onScreenChange(fullScreenElement) {
    console.debug("isFullScreen?", !!fullScreenElement);
  }

  _onPlay(index) {
    console.debug("playing from index", index);
  }

  _handleInputChange(state, event) {
    if (event.target.value > 0) {
      this.setState({ [state]: event.target.value });
    }
  }

  _handleCheckboxChange(state, event) {
    this.setState({ [state]: event.target.checked });
  }

  _handleThumbnailPositionChange(event) {
    this.setState({ thumbnailPosition: event.target.value });
  }

  _getStaticImages() {
    let images = [];
    for (let i = 2; i < 12; i++) {
      images.push({
        original: `${PREFIX_URL}${i}.jpg`,
        thumbnail: `${PREFIX_URL}${i}t.jpg`,
      });
    }

    return images;
  }

  _resetVideo() {
    this.setState({ showVideo: false });

    if (this.state.showPlayButton) {
      this.setState({ showGalleryPlayButton: true });
    }

    if (this.state.showFullscreenButton) {
      this.setState({ showGalleryFullscreenButton: true });
    }
  }

  _toggleShowVideo() {
    const { showVideo } = this.state;
    this.setState({
      showVideo: !showVideo,
    });

    if (!showVideo) {
      if (this.state.showPlayButton) {
        this.setState({ showGalleryPlayButton: false });
      }

      if (this.state.showFullscreenButton) {
        this.setState({ showGalleryFullscreenButton: false });
      }
    }
  }

  _renderVideo(item) {
    return (
      <div>
        {this.state.showVideo ? (
          <div className="video-wrapper">
            <button className="close-video" onClick={this._toggleShowVideo} />
            <iframe
              allowFullScreen
              height="315"
              src={item.embedUrl}
              style={{ border: "none" }}
              title="sample video"
              width="560"
            />
          </div>
        ) : (
          <>
            <button className="play-button" onClick={this._toggleShowVideo} />
            <img
              alt="sample video cover"
              className="image-gallery-image"
              src={item.original}
            />
            {item.description && (
              <span
                className="image-gallery-description"
                style={{ right: "0", left: "initial" }}
              >
                {item.description}
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  render() {
    return (
      <section className={`app${this.state.darkMode ? " dark-mode" : ""}`}>
        <div className="dark-mode-toggle">
          <input
            checked={this.state.darkMode}
            id="dark_mode"
            type="checkbox"
            onChange={this._handleCheckboxChange.bind(this, "darkMode")}
          />
          <label htmlFor="dark_mode">
            {this.state.darkMode ? "☀️ Light" : "🌙 Dark"}
          </label>
        </div>

        <section className="gallery-demo">
          <h1 className="gallery-demo-header">React Image Gallery</h1>
          <h3 className="gallery-demo-header-3">
            A beautiful, responsive, and customizable image gallery component
            for React applications
          </h3>
          <div className="gallery-demo-subheader">
            <a
              aria-label="Star xiaolin/react-image-gallery on GitHub"
              className="github-button"
              data-icon="octicon-star"
              data-show-count="true"
              data-size="large"
              href="https://github.com/xiaolin/react-image-gallery"
            >
              Star
            </a>
            <a
              aria-label="Fork xiaolin/react-image-gallery on GitHub"
              className="github-button"
              data-icon="octicon-repo-forked"
              data-show-count="true"
              data-size="large"
              href="https://github.com/xiaolin/react-image-gallery/fork"
            >
              Fork
            </a>
          </div>
          <div className="feature-badges">
            <span className="feature-badge">📱 Mobile Friendly</span>
            <span className="feature-badge">⌨️ Keyboard Navigation</span>
            <span className="feature-badge">🎨 Fully Customizable</span>
            <span className="feature-badge">🖼️ Thumbnail Support</span>
            <span className="feature-badge">📺 Fullscreen Mode</span>
          </div>
        </section>

        <ImageGallery
          ref={(i) => (this._imageGallery = i)}
          additionalClass="app-image-gallery"
          infinite={this.state.infinite}
          isRTL={this.state.isRTL}
          items={this.images}
          lazyLoad={this.state.lazyLoad}
          maxBullets={
            this.state.maxBullets > 0 ? this.state.maxBullets : undefined
          }
          showBullets={this.state.showBullets}
          showFullscreenButton={
            this.state.showFullscreenButton &&
            this.state.showGalleryFullscreenButton
          }
          showIndex={this.state.showIndex}
          showNav={this.state.showNav}
          showPlayButton={
            this.state.showPlayButton && this.state.showGalleryPlayButton
          }
          showThumbnails={this.state.showThumbnails}
          slideDuration={parseInt(this.state.slideDuration)}
          slideInterval={parseInt(this.state.slideInterval)}
          slideOnThumbnailOver={this.state.slideOnThumbnailOver}
          slideVertically={this.state.slideVertically}
          thumbnailPosition={this.state.thumbnailPosition}
          useWindowKeyDown={this.state.useWindowKeyDown}
          onClick={this._onImageClick.bind(this)}
          onImageLoad={this._onImageLoad}
          onPause={this._onPause.bind(this)}
          onPlay={this._onPlay.bind(this)}
          onScreenChange={this._onScreenChange.bind(this)}
          onSlide={this._onSlide.bind(this)}
        />

        <div className="app-sandbox">
          <div className="app-sandbox-content">
            <h2 className="app-header">Settings</h2>

       
```

### Core Architecture Module: `src/components/Bullet.tsx`
```
import React, { memo } from "react";
import clsx from "clsx";

interface BulletProps {
  index: number;
  isActive?: boolean;
  bulletClass?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Bullet button component for bullet navigation
 */
const Bullet = memo<BulletProps>(function Bullet({
  index,
  isActive = false,
  bulletClass = "",
  onClick,
}) {
  const className = clsx("image-gallery-bullet", bulletClass, {
    active: isActive,
  });

  return (
    <button
      key={`bullet-${index}`}
      aria-label={`Go to Slide ${index + 1}`}
      aria-pressed={isActive ? "true" : "false"}
      className={className}
      type="button"
      onClick={onClick}
    />
  );
});

export default Bullet;

```

### Core Architecture Module: `src/components/BulletNav.tsx`
```
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

interface BulletNavProps {
  bullets?: React.ReactNode[];
  slideVertically?: boolean;
  currentIndex?: number;
  maxBullets?: number;
}

/**
 * Bullet navigation component with optional sliding window
 * When maxBullets is set, bullets slide to keep the active bullet centered
 */
const BulletNav = memo<BulletNavProps>(function BulletNav({
  bullets = [],
  slideVertically = false,
  currentIndex = 0,
  maxBullets: maxBulletsProp,
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bulletSize, setBulletSize] = useState(0);

  // Enforce minimum of 3 for maxBullets (anything less makes no sense)
  const maxBullets =
    maxBulletsProp !== undefined && maxBulletsProp < 3 ? 3 : maxBulletsProp;

  const bulletsClass = clsx("image-gallery-bullets", {
    "image-gallery-bullets-vertical": slideVertically,
  });

  // Measure bullet size on mount and when bullets change
  useEffect(() => {
    const measureBulletSize = () => {
      if (containerRef.current && maxBullets && bullets.length > 0) {
        const firstBullet = containerRef.current.querySelector(
          ".image-gallery-bullet"
        ) as HTMLElement;
        if (firstBullet) {
          // Get computed style to include margins
          const style = window.getComputedStyle(firstBullet);
          const width = firstBullet.offsetWidth;
          const marginLeft = parseFloat(style.marginLeft) || 0;
          const marginRight = parseFloat(style.marginRight) || 0;
          const height = firstBullet.offsetHeight;
          const marginTop = parseFloat(style.marginTop) || 0;
          const marginBottom = parseFloat(style.marginBottom) || 0;

          const size = slideVertically
            ? height + marginTop + marginBottom
            : width + marginLeft + marginRight;
          setBulletSize(size);
        }
      }
    };

    measureBulletSize();

    // Add resize observer to remeasure on window resize
    const resizeObserver = new ResizeObserver(() => {
      measureBulletSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [bullets.length, maxBullets, slideVertically]);

  // Calculate the translation to center the active bullet
  const translateStyle = useMemo(() => {
    if (!maxBullets || maxBullets >= bullets.length || bulletSize === 0) {
      return {};
    }

    const total = bullets.length;
    const half = Math.floor(maxBullets / 2);

    let offset: number;

    if (currentIndex <= half) {
      // Near the beginning - no translation needed
      offset = 0;
    } else if (currentIndex >= total - half - 1) {
      // Near the end - translate to show last maxBullets
      offset = -(total - maxBullets) * bulletSize;
    } else {
      // In the middle - center the current bullet
      offset = -(currentIndex - half) * bulletSize;
    }

    return {
      transform: slideVertically
        ? `translateY(${offset}px)`
        : `translateX(${offset}px)`,
      transition: "transform 0.3s ease-out",
    };
  }, [bullets.length, currentIndex, maxBullets, bulletSize, slideVertically]);

  // Calculate container size to show only maxBullets
  const containerStyle = useMemo(() => {
    if (!maxBullets || maxBullets >= bullets.length || bulletSize === 0) {
      return {};
    }

    const size = maxBullets * bulletSize;
    return slideVertically
      ? { height: `${size}px`, overflow: "hidden" }
      : { width: `${size}px`, overflow: "hidden" };
  }, [maxBullets, bullets.length, bulletSize, slideVertically]);

  if (!bullets || bullets.length === 0) {
    return null;
  }

  return (
    <div className={bulletsClass}>
      <div
        aria-label="Bullet Navigation"
        className="image-gallery-bullets-container"
        role="navigation"
        style={containerStyle}
      >
        <div
          ref={containerRef}
          className="image-gallery-bullets-inner"
          style={translateStyle}
        >
          {bullets}
        </div>
      </div>
    </div>
  );
});

export default BulletNav;

```

### Core Architecture Module: `src/components/ImageGallery.tsx`
```
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ForwardedRef, RefObject } from "react";
import clsx from "clsx";
import Bullet from "src/components/Bullet";
import BulletNav from "src/components/BulletNav";
import {
  DEFAULT_EASING,
  DEFAULT_FLICK_THRESHOLD,
  DEFAULT_SLIDE_DURATION,
  DEFAULT_SLIDE_INTERVAL,
  DEFAULT_SWIPE_THRESHOLD,
} from "src/components/constants";
import BottomNav from "src/components/controls/BottomNav";
import Fullscreen from "src/components/controls/Fullscreen";
import LeftNav from "src/components/controls/LeftNav";
import PlayPause from "src/components/controls/PlayPause";
import RightNav from "src/components/controls/RightNav";
import TopNav from "src/components/controls/TopNav";
import { useAutoPlay } from "src/components/hooks/useAutoPlay";
import { useFullscreen } from "src/components/hooks/useFullscreen";
import { useGalleryNavigation } from "src/components/hooks/useGalleryNavigation";
import { useThumbnails } from "src/components/hooks/useThumbnails";
import IndexIndicator from "src/components/IndexIndicator";
import Item from "src/components/Item";
import Slide from "src/components/Slide";
import SwipeWrapper from "src/components/SwipeWrapper";
import Thumbnail from "src/components/Thumbnail";
import ThumbnailBar from "src/components/ThumbnailBar";
import debounce from "src/components/utils/debounce";
import {
  calculateSwipeOffset,
  computeSlideTarget,
  computeTargetDisplayIndex,
  computeVelocityDuration,
  getSwipeDirection,
  isFlickSwipe,
  isSufficientSwipe,
  shouldIgnoreSwipeDirection,
} from "src/components/utils/swipe";
import { calculateMomentum } from "src/components/utils/thumbnailMomentum";
import type {
  GalleryItem,
  ImageGalleryProps,
  ImageGalleryRef,
  SwipeDirection,
  SwipeEventData,
  ThumbnailPosition,
} from "src/types";

// ============= Constants =============
const screenChangeEvents = [
  "fullscreenchange",
  "MSFullscreenChange",
  "mozfullscreenchange",
  "webkitfullscreenchange",
];

// ============= Helper Functions =============
function isEnterOrSpaceKey(event: React.KeyboardEvent): boolean {
  const key = parseInt(String(event.keyCode || event.which || 0), 10);
  const ENTER_KEY_CODE = 13;
  const SPACEBAR_KEY_CODE = 32;
  return key === ENTER_KEY_CODE || key === SPACEBAR_KEY_CODE;
}

function getThumbnailPositionClassName(
  thumbnailPosition: ThumbnailPosition
): string {
  const classNames: Record<ThumbnailPosition, string> = {
    left: " image-gallery-thumbnails-left",
    right: " image-gallery-thumbnails-right",
    bottom: " image-gallery-thumbnails-bottom",
    top: " image-gallery-thumbnails-top",
  };
  return classNames[thumbnailPosition] || "";
}

/**
 * ImageGallery - A responsive and customizable image gallery component
 *
 * Refactored to functional component with custom hooks for better maintainability.
 * Supports swipe gestures, thumbnails, fullscreen, autoplay, and more.
 */
const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
  function ImageGallery(
    props: ImageGalleryProps,
    ref: ForwardedRef<ImageGalleryRef>
  ) {
    // ============= Props with Defaults =============
    const {
      additionalClass = "",
      autoPlay = false,
      disableKeyDown = false,
      disableSwipe = false,
      disableThumbnailScroll = false,
      disableThumbnailSwipe = false,
      flickThreshold = DEFAULT_FLICK_THRESHOLD,
      indexSeparator = " / ",
      infinite = true,
      isRTL = false,
      items,
      lazyLoad = false,
      onBeforeSlide,
      onBulletClick,
      onClick,
      onErrorImageURL = "",
      onImageError,
      onImageLoad,
      onMouseLeave,
      onMouseOver,
      onPause,
      onPlay,
      onScreenChange,
      onSlide,
      onThumbnailClick,
      onThumbnailError,
      onTouchEnd,
      onTouchMove,
      onTouchStart,
      renderBottomNav = (onClick, disabled) => (
        <BottomNav disabled={disabled} onClick={onClick} />
      ),
      renderCustomControls,
      renderFullscreenButton = (onClick, isFullscreen) => (
        <Fullscreen isFullscreen={isFullscreen} onClick={onClick} />
      ),
      renderItem,
      renderLeftNav = (onClick, disabled) => (
        <LeftNav disabled={disabled} onClick={onClick} />
      ),
      renderPlayPauseButton = (onClick, isPlaying) => (
        <PlayPause isPlaying={isPlaying} onClick={onClick} />
      ),
      renderRightNav = (onClick, disabled) => (
        <RightNav disabled={disabled} onClick={onClick} />
      ),
      renderThumbInner,
      renderTopNav = (onClick, disabled) => (
        <TopNav disabled={disabled} onClick={onClick} />
      ),
      showBullets = false,
      maxBullets,
      showFullscreenButton = true,
      showIndex = false,
      showNav = true,
      showPlayButton = true,
      showThumbnails = true,
      slideDuration = DEFAULT_SLIDE_DURATION,
      slideInterval = DEFAULT_SLIDE_INTERVAL,
      slideOnThumbnailOver = false,
      slideVertically = false,
      startIndex = 0,
      stopPropagation = false,
      swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
      thumbnailPosition = "bottom",
      useBrowserFullscreen = true,
      useTranslate3D = true,
      useWindowKeyDown = true,
    } = props;

    // ============= Refs =============
    const imageGalleryRef = useRef<HTMLDivElement | null>(null);
    const imageGallerySlideWrapperRef = useRef<HTMLDivElement | null>(null);
    const thumbnailMouseOverTimerRef = useRef<number | null>(null);
    const loadedImagesRef = useRef<Record<string, boolean>>({});
    const lazyLoadedRef = useRef<boolean[]>([]);
    const resizeSlideWrapperObserverRef = useRef<ResizeObserver | null>(null);
    const handleKeyDownRef = useRef<((event: KeyboardEvent) => void) | null>(
      null
    );

    // ============= Local State =============
    const [galleryWidth, setGalleryWidth] = useState(0);
    const [galleryHeight, setGalleryHeight] = useState(0);
    const [gallerySlideWrapperHeight, setGallerySlideWrapperHeight] =
      useState(0);
    const swipingUpDownRef = useRef(false);
    const swipingLeftRightRef = useRef(false);
    const slideContainerRef = useRef<HTMLDivElement | null>(null);
    const swipeOffsetRef = useRef(0);
    const swipeRafRef = useRef<number | null>(null);

    const totalSlides = items.length;
    const canSlide = totalSlides >= 2;

    // ============= Use Gallery Navigation Hook =============
    const {
      currentIndex,
      displayIndex,
      isTransitioning,
      currentSlideOffset: _currentSlideOffset,
      canSlideLeft,
      canSlideRight,
      slideToIndex,
      slideToIndexCore,
      slideToIndexWithStyleReset,
      slideLeft,
      slideRight,
      getContainerStyle,
      getExtendedSlides,
      getAlignmentClass,
      setCurrentSlideOffset,
      setSlideStyle: _setSlideStyle,
      setIsTransitioning,
      totalDisplaySlides,
    } = useGalleryNavigation({
      items,
      startIndex,
      infinite,
      isRTL,
      slideDuration,
      onSlide,
      onBeforeSlide,
    });

    // ============= Use Thumbnails Hook =============
    const {
      thumbsTranslate,
      setThumbsTranslate,
      thumbsSwipedTranslate,
      setThumbsSwipedTranslate,
      setThumbsStyle,
      thumbnailsWrapperWidth,
      thumbnailsWrapperHeight,
      isSwipingThumbnail,
      setIsSwipingThumbnail,
      thumbnailsWrapperRef,
      thumbnailsRef,
      isThumbnailVertical,
      getThumbnailStyle,
      getThumbnailBarHeight,
      initResizeObserver: initThumbnailResizeObserver,
      removeResizeObserver: removeThumbnailsResizeObserver,
    } = useThumbnails({
      currentIndex,
      items,
      thumbnailPosition,
      disableThumbnailScroll,
      slideDuration,
      isRTL,
      useTranslate3D,
    });

    // ============= Use Fullscreen Hook =============
    const {
      isFullscreen,
      modalFullscreen,
      fullScreen,
     
```

### Core Architecture Module: `src/components/IndexIndicator.tsx`
```
import React, { memo } from "react";

interface IndexIndicatorProps {
  currentIndex: number;
  totalItems: number;
  indexSeparator?: string;
}

/**
 * Index indicator component showing current slide position
 */
const IndexIndicator = memo<IndexIndicatorProps>(function IndexIndicator({
  currentIndex,
  totalItems,
  indexSeparator = " / ",
}) {
  return (
    <div className="image-gallery-index">
      <span className="image-gallery-index-current">{currentIndex + 1}</span>
      <span className="image-gallery-index-separator">{indexSeparator}</span>
      <span className="image-gallery-index-total">{totalItems}</span>
    </div>
  );
});

export default IndexIndicator;

```

### Core Architecture Module: `src/components/Item.tsx`
```
import React from "react";

interface ItemProps {
  original: string;
  handleImageLoaded: (
    event: React.SyntheticEvent<HTMLImageElement>,
    originalSrc: string
  ) => void;
  onImageError: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  description?: string;
  fullscreen?: string;
  isFullscreen?: boolean;
  originalAlt?: string;
  originalHeight?: string;
  originalWidth?: string;
  originalTitle?: string;
  sizes?: string;
  srcSet?: string;
  loading?: "eager" | "lazy";
}

const defaultProps: Partial<ItemProps> = {
  description: "",
  fullscreen: "",
  isFullscreen: false,
  originalAlt: "",
  originalHeight: "",
  originalWidth: "",
  originalTitle: "",
  sizes: "",
  srcSet: "",
  loading: "eager",
};

const Item = React.memo<ItemProps>((props) => {
  const {
    description,
    fullscreen, // fullscreen version of img
    handleImageLoaded,
    isFullscreen,
    onImageError,
    original,
    originalAlt,
    originalHeight,
    originalWidth,
    originalTitle,
    sizes,
    srcSet,
    loading,
  } = { ...defaultProps, ...props };
  const itemSrc = isFullscreen ? fullscreen || original : original;

  return (
    <React.Fragment>
      <img
        alt={originalAlt}
        className="image-gallery-image"
        height={originalHeight}
        loading={loading}
        sizes={sizes}
        src={itemSrc}
        srcSet={srcSet}
        title={originalTitle}
        width={originalWidth}
        onError={onImageError}
        onLoad={(event) => handleImageLoaded(event, original)}
      />
      {description && (
        <span className="image-gallery-description">{description}</span>
      )}
    </React.Fragment>
  );
});

Item.displayName = "Item";

export default Item;

```

### Core Architecture Module: `src/components/SVG.tsx`
```
import React from "react";

type IconType =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "maximize"
  | "minimize"
  | "play"
  | "pause";

interface SVGProps {
  icon: IconType;
  strokeWidth?: number;
  viewBox?: string;
}

const left = <polyline points="15 18 9 12 15 6" />;
const right = <polyline points="9 18 15 12 9 6" />;
const top = <polyline points="6 15 12 9 18 15" />;
const bottom = <polyline points="6 9 12 15 18 9" />;
const maximize = <path d="M8 3H3v5m18 0V3h-5m0 18h5v-5M3 16v5h5" />;
const minimize = <path d="M8 3v5H3m18 0h-5V3m0 18v-5h5M3 16h5v5" />;
const play = <polygon points="5 3 19 12 5 21 5 3" />;
const pause = (
  <React.Fragment>
    <rect height="16" width="4" x="6" y="4" />
    <rect height="16" width="4" x="14" y="4" />
  </React.Fragment>
);

const iconMapper: Record<IconType, React.ReactNode> = {
  left,
  right,
  top,
  bottom,
  maximize,
  minimize,
  play,
  pause,
};

const defaultProps: Omit<SVGProps, "icon"> = {
  strokeWidth: 1,
  viewBox: "0 0 24 24",
};

const SVG: React.FC<SVGProps> = (props) => {
  const { strokeWidth, viewBox, icon } = { ...defaultProps, ...props };
  return (
    <svg
      className="image-gallery-svg"
      fill="none"
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="miter"
      strokeWidth={strokeWidth}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      {iconMapper[icon]}
    </svg>
  );
};

export default SVG;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #838** (2026-03-05): **slideToIndex does not work anymore**
  *Symptoms*: ### Before submitting  - [x] I searched existing issues to avoid duplicates  ### Bug description  <!-- What happened? What did you expect instead? --> After updating to 2.x.x the following setup does not work anymore:  ```ts const Gallery = ({   gallery,   customSettings = {},   refInitialized, }: Props): React.JSX.Element => {   const galleryRef = React.useRef<     ImageGalleryRef    >(null);    React.useEffect(() => {     if (customSettings.autoPlay) {       galleryRef.current?.play();     }   }, [customSettings]);      setGalleryItems(tmp as any);   }, [gallery]);    React.useEffect(() => {     if (refInitialized && galleryRef.current) {       refInitialized(galleryRef.current);     }   }, []);    return (     <ImageGallery       ref={galleryRef}       items={galleryItems}       lazyLoad       {...customSettings}     />   ); };  export default Gallery; ```  and the consuming component: ```ts export default function ExampleComponent() {   const [galleryImages, setGalleryImages] = useState<GalleryItem[]>([]);   const [galleryRef, setGalleryRef] = useState<ImageGalleryRef>();    const openGallery = (idx: number, slide: number) => {     const items = mapImagesToGalleryImages(idx);     setGalleryImages(items);      setTimeout(() => {       galleryRef?.slideToIndex(slide);       galleryRef?.fullScreen();     }, 25);   };    return (     <>       <button       type="button"       onClick={() => openGallery(2)} // example     >     </button>       <div className="w-0 overflow-hidd
  **Post-Mortem & Fix Analysis**:
  > v2.1.2 should fix this.  https://github.com/xiaolin/react-image-gallery/releases/tag/v2.1.2

- **Issue #837** (2026-02-19): **Mouse scroll function disabled**
  *Symptoms*: The mouse wheel scroll is disabled when the mouse pointer is over the main image.
  **Post-Mortem & Fix Analysis**:
  > I found a temporary soluation, may break some other features:  `.image-gallery, .image-gallery-content, .image-gallery-swipe, .image-gallery-slides {   overscroll-behavior: auto !important;   touch-action: pan-y !important; } `
  > this version should fix the issue.  https://github.com/xiaolin/react-image-gallery/releases/tag/v2.1.1
  > Confirm it is fixed, Thanks!

- **Issue #836** (2026-02-16): **CSS auto-injection is broken (by design) for SSR**
  *Symptoms*: ### Before submitting  - [x] I searched existing issues to avoid duplicates  ### Bug description  v2.0.0 introduced auto CSS injection via js bundles. When used in a project that does SSR, the styles don't load until the client js bundle loads. This is expected, given the approach, but very much not ideal.  I can still: ```js import "react-image-gallery/styles/image-gallery.css"; ```  But this causes duplicate styles to load (both the CSS file and the injected styles from the js bundle).  ### Version  `react-image-gallery` version: 2.0.8  ### Reproduction  Use in any react-router (as framework) project... or a Next.js one...  Or any other form of a project that uses React with SSR.  ### Environment  - Browser: Irrelevant - OS: Irrelevant  ### Possible solutions - Provide additional bundles without the injection of styles  OR - Revert back to the more agnostic 1.x approach (user is the one importing the css).
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, reverted back to 1.x approach with explicit import of css.  https://github.com/xiaolin/react-image-gallery/releases/tag/v2.1.0
  > Probably the better solution. Much appreciated. 🙏 

- **Issue #687** (2022-07-30): **flickering issue when colour swatch is changed**
  *Symptoms*: **Describe the bug** when changing image with item image is flickering in mobile  **Image Gallery Version** What version of `react-image-gallery` are you using? 1.2.7  **To Reproduce** Steps to reproduce the behavior: open this in mobile and try to change image by carousel and then change item colour by swatch .  **Expected behavior** 0th index image should load with out flickering.  **Screenshots** If applicable, add screenshots to help explain your problem.   **Smartphone (please complete the following information):**  - Device: [ iPhoneXR]  - Browser [ safari]  **Additional context** <ImageGallery           ref={elementRef}           items={items}           infinite           showThumbnails={false}           showNav={false}           showFullscreenButton={false}           showPlayButton={false}           showBullets={true}           swipeThreshold="10"           onSlide={handleOnSlide}         /> 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting, this looks like an issue with transition when rendering a new array of items that needs to start at index 0.
  > Hi @xiaolin yes it need to start from start at index 0 and it does like that but smoothness is not there in transition flickering of last set of image is happening.
  > This should be fixed in v1.2.9 https://github.com/xiaolin/react-image-gallery/releases/tag/v1.2.9

- **Issue #674** (2022-10-01): **Vertical thumbnail scrolling broken with react 18 rendering**
  *Symptoms*: The thumbnail scrolling does not get the proper translate when rendering with react 18.  Using the latest image gallery version (1.2.8) and react (18.1.0).  My guess is that the thumbnailsWrapperHeight is registering as 0 at the start (the translation seems to match that) maybe because of how batch updates or rendering has changed in react 18.  After manually resizing the window and thus resizing react-image-gallery, the resize observers fire and the issue improves. However the calculation is still wrong and it is slightly offset from where the scroll should be.  To reproduce, use the latest react and the new way to start the rendering (createRoot() and root.render() instead of ReactDOM.render()), and set thumbnail position to "left" or "right". Then just change slides around and the issue can be seen.  Changing the render back to ReactDOM.render() (which reverts rendering the same way as React 17) fixes the issue.  A picture attached demonstrates the thumbnail scroll being in the wrong position (and out of bounds)  ![react-image-gallery-bug](https://user-images.githubusercontent.com/35713583/172502068-e1ac15d6-61ac-4632-9a4a-c417f9d37b73.JPG)  
  **Post-Mortem & Fix Analysis**:
  > Is there anything I can add to help get this looked at? Thanks for the updates!
  > Thanks for reporting, I've not had a chance to test react18's new render. Will look into it when I get a chance.  Fastest way is to open a PR if anyone is down to tackle this issue.
  > Anyone found a fix for this? Can't figure it out.

- **Issue #655** (2023-07-30): **images slide above each other**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **Image Gallery Version** What version of `react-image-gallery` are you using? 1.2.7   if you have only two or three images.. try to navigate between them by nav buttons . then navigate using thumbnail .. click twowice on the same thumbnail .. you will show a strange behavior   **To Reproduce** Steps to reproduce the behavior: 1.make sure you have only two images. 2.try to navigate between them by nav buttons. 3. then navigate using thumbnail. 4. click twice on the same thumbnail. 5. you will see unexpected behavior.  **Expected behavior** A clear and concise description of what you expected to happen. images not slide above each other.  **Desktop (please complete the following information):**  - OS: [10.15.7 iOS]   - Browser [chrome, safari]  
  **Post-Mortem & Fix Analysis**:
  > Yes. It is happening. Strange, it is reported recently after previous release. 
  > It is happening for the case of 2 images. 👍 Strangely, nobody has reported since ages. lol  I will try to fix it and generate a pull request.
  > The issue persists at least 2 years. lol 

- **Issue #615** (2024-08-22): **useWindowKeyDown={false} doesn't work correctly on Chrome**
  *Symptoms*: **Summary** After navigating through 2 images, arrow keys stop working and you need to "refocus" the gallery by clicking on the image to be able to use them again.  **To Reproduce** Steps to reproduce the behavior: 1. Go to https://www.linxtion.com/demo/react-image-gallery/ 2. Uncheck "use window keydown"  3. Click in the middle of an image 4. Use arrows to navigate through the gallery  **Expected behavior** Should be able to navigate through the entire gallery with arrow keys without the need to click on it every 2 images.  **Desktop:**  - MacBook Pro (15-inch, 2018)  - Chrome Version 91.0.4472.164 (Official Build) (x86_64)  **Additional context** Bug occurs only when clicking on the image, clicking on the navigation icons and using arrow keys works fine.  Works correctly  Firefox and Safari. 
  **Post-Mortem & Fix Analysis**:
  > Looks like this may be a little tough since different browsers handles it differently. Chrome loses focus and `document.activeElement` becomes `body` after two keydowns.  If there is no clean fix, may get rid of `useWindowKeyDown={false}` and let the user handle that case (as its a custom keydown event)  **Solution 1**: Find a fix for all browser **Solution 2**: `useWindowKeyDown={false}` acts as the current `disableKeyDown` and removes window keydown event handlers

- **Issue #499** (2021-05-28): **prop `items[0].original` is marked as required warning**
  *Symptoms*: this happen after I update the dependency from 0.9.1 to 1.0.7  ![1](https://user-images.githubusercontent.com/5227509/78500302-2f3ce900-7788-11ea-83e3-4a69d85ec92d.png) 
  **Post-Mortem & Fix Analysis**:
  > `objects` in `items` array should have a `original` value. How are you using the library without `items[x].original` ?
  > I use `renderItem `and `renderThumbInner`
  > Ah, `original` is also used as a unique key for each slide.  Will mark this as an issue and look into it. For now If you like to get rid of the error, you can probably add an index key. [{original: 0}, {original: 1}]

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

### Incident Patch 1: `8683e932` (2026-02-26)
**Commit Message**: fix lint

**File**: `src/components/ImageGallery.test.tsx` (modified, +5/-7)
```diff
@@ -2481,14 +2481,14 @@ describe("<ImageGallery />", () => {
       // after items have been populated.
       const ref = React.createRef<ImageGalleryRef>();
       const { rerender } = render(
-        <ImageGallery items={singleItem} ref={ref} />
+        <ImageGallery ref={ref} items={singleItem} />
       );
 
       // Cache the handle object (simulates storing ref.current in state)
       const cachedHandle = ref.current!;
 
       // Update items to a larger set
-      rerender(<ImageGallery items={defaultItems} ref={ref} />);
+      rerender(<ImageGallery ref={ref} items={defaultItems} />);
 
       // Use the CACHED handle to slide — this previously broke because
       // slideToIndexCore closed over totalSlides=1 from the first render.
@@ -2503,9 +2503,7 @@ describe("<ImageGallery />", () => {
 
     it("getCurrentIndex returns latest index from a cached handle", () => {
       const ref = React.createRef<ImageGalleryRef>();
-      const { rerender } = render(
-        <ImageGallery items={defaultItems} ref={ref} />
-      );
+      render(<ImageGallery ref={ref} items={defaultItems} />);
 
       const cachedHandle = ref.current!;
       expect(cachedHandle.getCurrentIndex()).toBe(0);
@@ -2527,8 +2525,8 @@ describe("<ImageGallery />", () => {
       const emptyItems: GalleryItem[] = [];
       const { rerender } = render(
         <ImageGallery
-          items={emptyItems}
           ref={ref}
+          items={emptyItems}
           useBrowserFullscreen={false}
         />
       );
@@ -2538,8 +2536,8 @@ describe("<ImageGallery />", () => {
       // Populate items
       rerender(
         <ImageGallery
-          items={defaultItems}
           ref={ref}
+          items={defaultItems}
           useBrowserFullscreen={false}
         />
       );
```

**File**: `tsconfig.json` (modified, +1/-1)
```diff
@@ -20,5 +20,5 @@
     "types": ["jest", "node", "@testing-library/jest-dom"]
   },
   "include": ["src/**/*"],
-  "exclude": ["node_modules", "build", "**/*.test.ts", "**/*.test.tsx"]
+  "exclude": ["node_modules", "build"]
 }
```

---

### Incident Patch 2: `192f7ccb` (2026-02-19)
**Commit Message**: [#837] Fix mous scroll and mobile swipe

**File**: `src/components/ImageGallery.tsx` (modified, +10/-0)
```diff
@@ -310,6 +310,16 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
 
         if (disableSwipe) return;
 
+        // Once the swipe direction is locked to the gallery's slide axis,
+        // prevent the browser from scrolling the page during the gesture.
+        // Only affects touch devices (useSwipeHandlers listens to touch only).
+        if (
+          (!slideVertically && swipingLeftRightRef.current) ||
+          (slideVertically && swipingUpDownRef.current)
+        ) {
+          event.preventDefault();
+        }
+
         if (stopPropagation) {
           event.preventDefault();
         }
```

**File**: `styles/image-gallery.css` (modified, +4/-4)
```diff
@@ -291,8 +291,6 @@
   backface-visibility: hidden;
   -webkit-transform: translateZ(0);
   transform: translateZ(0);
-  /* Prevent overscroll during swipe */
-  overscroll-behavior: contain;
   touch-action: pan-y pinch-zoom;
 }
 
@@ -303,13 +301,15 @@
 .image-gallery-slides {
   overflow: hidden;
   position: relative;
-  touch-action: none;
+  /* Allow vertical scroll and pinch-zoom; block horizontal pan so JS handles swipe.
+     The browser's built-in direction detection prevents vertical scroll during
+     horizontal swipes. On desktop, wheel/trackpad scroll passes through normally. */
+  touch-action: pan-y pinch-zoom;
   /* GPU acceleration for smooth swiping */
   -webkit-backface-visibility: hidden;
   backface-visibility: hidden;
   contain: layout style paint;
   isolation: isolate;
-  overscroll-behavior: none;
 }
 
 /* Flex container that holds all slides and gets transformed */
```

---

### Incident Patch 3: `bf3ebb02` (2026-02-10)
**Commit Message**: Fix jsx runtime issue

**File**: `webpack.build.cjs` (modified, +14/-0)
```diff
@@ -82,6 +82,8 @@ const jsEsOutput = Object.assign({}, config, {
   externals: {
     react: "react",
     "react-dom": "react-dom",
+    "react/jsx-runtime": "react/jsx-runtime",
+    "react/jsx-dev-runtime": "react/jsx-dev-runtime",
   },
 });
 
@@ -133,6 +135,18 @@ const jsOutput = Object.assign({}, config, {
       amd: "react-dom",
       root: "ReactDOM",
     },
+    "react/jsx-runtime": {
+      commonjs: "react/jsx-runtime",
+      commonjs2: "react/jsx-runtime",
+      amd: "react/jsx-runtime",
+      root: "ReactJSXRuntime",
+    },
+    "react/jsx-dev-runtime": {
+      commonjs: "react/jsx-dev-runtime",
+      commonjs2: "react/jsx-dev-runtime",
+      amd: "react/jsx-dev-runtime",
+      root: "ReactJSXDevRuntime",
+    },
   },
 });
 
```

---

### Incident Patch 4: `0ffe0f6d` (2026-02-07)
**Commit Message**: fixes veritical slide not resizing

**File**: `src/components/ImageGallery.tsx` (modified, +54/-8)
```diff
@@ -740,27 +740,64 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
     const handleImageLoaded = useCallback(
       (event: React.SyntheticEvent<HTMLImageElement>, original: string) => {
         const imageExists = loadedImagesRef.current[original];
-        if (!imageExists && onImageLoad) {
+        if (!imageExists) {
           loadedImagesRef.current[original] = true;
-          onImageLoad(event);
+          if (onImageLoad) {
+            onImageLoad(event);
+          }
+          // In vertical mode, recalculate height once the image's natural
+          // dimensions become available so the slide container sizes correctly.
+          if (slideVertically) {
+            handleResizeRef.current?.();
+          }
         }
       },
-      [onImageLoad]
+      [onImageLoad, slideVertically]
     );
 
     // ============= Resize Handling =============
     const handleResize = useCallback(() => {
       if (!imageGalleryRef.current) return;
 
-      setGalleryWidth(imageGalleryRef.current.offsetWidth);
+      const galleryW = imageGalleryRef.current.offsetWidth;
+      setGalleryWidth(galleryW);
       setGalleryHeight(imageGalleryRef.current.offsetHeight);
 
       if (imageGallerySlideWrapperRef.current) {
-        setGallerySlideWrapperHeight(
-          imageGallerySlideWrapperRef.current.offsetHeight
-        );
+        if (slideVertically) {
+          // In vertical mode, images have height:100%/width:auto, so the
+          // wrapper's natural offsetHeight may collapse to 0 or be stale.
+          // Instead, find the currently visible image and compute the slide
+          // height from its natural aspect ratio and the available width.
+          const wrapperWidth =
+            imageGallerySlideWrapperRef.current.offsetWidth || galleryW;
+          const img =
+            imageGallerySlideWrapperRef.current.querySelector<HTMLImageElement>(
+              ".image-gallery-center .image-gallery-image"
+            ) ??
+            imageGallerySlideWrapperRef.current.querySelector<HTMLImageElement>(
+              ".image-gallery-image"
+            );
+
+          if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
+            const aspectRatio = img.naturalHeight / img.naturalWidth;
+            const computedHeight = Math.round(wrapperWidth * aspectRatio);
+            // Respect the max-height constraint from CSS (100vh - 80px)
+            const maxHeight = window.innerHeight - 80;
+            setGallerySlideWrapperHeight(Math.min(computedHeight, maxHeight));
+          } else {
+            // Fallback: if no image loaded yet, use the wrapper's current height
+            setGallerySlideWrapperHeight(
+              imageGallerySlideWrapperRef.current.offsetHeight
+            );
+          }
+        } else {
+          setGallerySlideWrapperHeight(
+            imageGallerySlideWrapperRef.current.offsetHeight
+          );
+        }
       }
-    }, []);
+    }, [slideVertically]);
 
     const initSlideWrapperResizeObserver = useCallback(
       (element: RefObject<HTMLElement | null>) => {
@@ -1064,6 +1101,15 @@ const ImageGallery = forwardRef<ImageGalleryRef, ImageGalleryProps>(
       handleResizeRef.current?.();
     }, [showThumbnails, thumbnailsWrapperRef]);
 
+    // Handle slideVertically changes - reinitialize observers and recalculate dimensions
+    useEffect(() => {
+      removeSlideWrapperResizeObserverRef.current?.();
+      removeThumbnailsResizeObserverRef.current?.();
+      initSlideWrapperResizeObserverRef.current?.(imageGallerySlideWrapperRef);
+      initThumbnailResizeObserverRef.current?.(thumbnailsWrapperRef);
+      handleResizeRef.current?.();
+    }, [slideVertically, thumbnailsWrapperRef]);
+
     // Handle items changes - reset lazyLoaded
     useEffect(() => {
       if (lazyLoad) {
```

**File**: `styles/image-gallery.css` (modified, +9/-9)
```diff
@@ -404,11 +404,6 @@
   padding: 2px 0;
 }
 
-.image-gallery-bullets-vertical .image-gallery-bullets-inner {
-  flex-direction: column;
-  padding: 0 2px;
-}
-
 .image-gallery-bullets .image-gallery-bullet {
   appearance: none;
   background-color: transparent;
@@ -472,21 +467,26 @@
   transform: translateY(-50%);
 }
 
+.image-gallery-bullets.image-gallery-bullets-vertical
+  .image-gallery-bullets-inner {
+  flex-direction: column;
+  padding: 0 2px;
+}
+
 .image-gallery-bullets.image-gallery-bullets-vertical .image-gallery-bullet {
   display: block;
-  margin: 12px 0;
+  margin: 4px 0;
 }
 
 @media (max-width: 768px) {
   .image-gallery-bullets.image-gallery-bullets-vertical .image-gallery-bullet {
-    margin: 8px 0;
-    padding: var(--ig-bullet-size-small, 3px);
+    margin: 3px 0;
   }
 }
 
 @media (max-width: 480px) {
   .image-gallery-bullets.image-gallery-bullets-vertical .image-gallery-bullet {
-    padding: 3px;
+    margin: 3px 0;
   }
 }
 
```

---

### Incident Patch 5: `48da49a5` (2026-02-05)
**Commit Message**: template update for bug

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (modified, +19/-28)
```diff
@@ -1,41 +1,32 @@
 ---
 name: Bug report
 about: Create a report to help us improve
-title: ''
-labels: ''
-assignees: ''
-
+title: ""
+labels: bug
+assignees: ""
 ---
 
-<!--- NOTE: Issues that do not follow the template below will be closed -->
+### Before submitting
+
+- [ ] I searched existing issues to avoid duplicates
+
+### Bug description
+
+<!-- What happened? What did you expect instead? -->
 
-**Checklist before opening an issue**\
-Lots of issues are opened that are unrelated to this lib, please take a moment to ensure the issue is not on your end 🙏.
-- [ ] Did you try google/chatgpt?
-- [ ] Did you search for previous Issues in this repo?
+### Version
 
-**Describe the bug**\
-A clear and concise description of what the bug is.
+`react-image-gallery` version:
 
-**Image Gallery Version**\
-What version of `react-image-gallery` are you using?
+### Reproduction
 
-**To Reproduce**\
-Steps to reproduce the behavior:
-1. Go to '...'
-2. Click on '....'
-3. Scroll down to '....'
-4. See error
+<!-- Link to CodeSandbox/StackBlitz or steps to reproduce -->
 
-**Expected behavior**\
-A clear and concise description of what you expected to happen.
+### Environment
 
-**Screenshots**\
-If applicable, add screenshots to help explain your problem.
+- Browser:
+- OS:
 
-**Client info (please complete the following information):**\
- - OS: [e.g. iOS]
- - Browser: [e.g. chrome, safari]
+### Screenshots (optional)
 
-**Additional context**\
-Add any other context about the problem here.
+<!-- Drag and drop images here if helpful -->
```

---

### Incident Patch 6: `babadb2c` (2026-02-05)
**Commit Message**: fix broken typescript import types

**File**: `README.md` (modified, +55/-3)
```diff
@@ -65,6 +65,55 @@ For more examples, see [`example/App.jsx`](https://github.com/xiaolin/react-imag
 
 <br />
 
+## 📘 TypeScript
+
+This package includes TypeScript definitions. Import types for props, items, and refs:
+
+```tsx
+import ImageGallery from "react-image-gallery";
+import type {
+  GalleryItem,
+  ImageGalleryProps,
+  ImageGalleryRef,
+} from "react-image-gallery";
+
+const images: GalleryItem[] = [
+  {
+    original: "https://picsum.photos/id/1018/1000/600/",
+    thumbnail: "https://picsum.photos/id/1018/250/150/",
+    originalAlt: "Mountain landscape",
+    description: "A beautiful mountain view",
+  },
+  {
+    original: "https://picsum.photos/id/1015/1000/600/",
+    thumbnail: "https://picsum.photos/id/1015/250/150/",
+    originalAlt: "Flowing river",
+  },
+  {
+    original: "https://picsum.photos/id/1019/1000/600/",
+    thumbnail: "https://picsum.photos/id/1019/250/150/",
+    originalAlt: "Sunset over the ocean",
+  },
+];
+
+function MyGallery() {
+  const galleryRef = useRef<ImageGalleryRef>(null);
+
+  const handleClick = () => {
+    galleryRef.current?.fullScreen();
+  };
+
+  return (
+    <>
+      <ImageGallery ref={galleryRef} items={images} />
+      <button onClick={handleClick}>Enter Fullscreen</button>
+    </>
+  );
+}
+```
+
+<br />
+
 ## ⚙️ Props
 
 - `items`: (required) Array of objects. Available properties:
@@ -153,9 +202,12 @@ For more examples, see [`example/App.jsx`](https://github.com/xiaolin/react-imag
 
 The following functions can be accessed using [refs](https://reactjs.org/docs/refs-and-the-dom.html)
 
-- `play()`: plays the slides
-- `pause()`: pauses the slides
-- `toggleFullScreen()`: toggles full screen
+- `play()`: starts the slideshow
+- `pause()`: pauses the slideshow
+- `togglePlay()`: toggles between play and pause
+- `fullScreen()`: enters fullscreen mode
+- `exitFullScreen()`: exits fullscreen mode
+- `toggleFullScreen()`: toggles fullscreen mode
 - `slideToIndex(index)`: slides to a specific index
 - `getCurrentIndex()`: returns the current index
 
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -31,6 +31,7 @@
   },
   "exports": {
     ".": {
+      "types": "./build/types/types.d.ts",
       "import": "./build/image-gallery.es.js",
       "require": "./build/image-gallery.cjs"
     },
@@ -121,4 +122,4 @@
   "peerDependencies": {
     "react": "^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"
   }
-}
+}
\ No newline at end of file
```

**File**: `scripts/test-package.sh` (modified, +72/-0)
```diff
@@ -165,10 +165,82 @@ for (const type of essentialTypes) {
     process.exit(1);
   }
 }
+
+// Check for default export declaration
+if (!typesContent.includes('export default')) {
+  console.error('❌ Missing default export in types');
+  process.exit(1);
+}
+console.log('✅ Default export is declared');
 EOF
 
 node test-types.mjs
 
+# Test TypeScript compilation with modern module resolution (node16/nodenext/bundler)
+echo -e "${YELLOW}🧪 Testing TypeScript compilation with modern moduleResolution...${NC}"
+npm install typescript @types/react --silent
+
+cat > test-ts.ts << 'EOF'
+import ImageGallery from 'react-image-gallery';
+import type { GalleryItem, ImageGalleryProps, ImageGalleryRef } from 'react-image-gallery';
+
+// Test default import is a valid component type
+const gallery: typeof ImageGallery = ImageGallery;
+
+// Test named type imports
+const item: GalleryItem = { original: 'test.jpg' };
+const props: ImageGalleryProps = { items: [item] };
+
+// Test ref type
+const ref: ImageGalleryRef | null = null;
+
+console.log('✅ TypeScript types work correctly');
+EOF
+
+# Test with moduleResolution: bundler (common modern setup)
+cat > tsconfig.json << 'EOF'
+{
+  "compilerOptions": {
+    "target": "ES2020",
+    "module": "ESNext",
+    "moduleResolution": "bundler",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true
+  },
+  "include": ["test-ts.ts"]
+}
+EOF
+
+if npx tsc --noEmit 2>&1; then
+  echo -e "${GREEN}✅ TypeScript compilation (bundler) passed${NC}"
+else
+  echo -e "${RED}❌ TypeScript compilation (bundler) failed${NC}"
+  exit 1
+fi
+
+# Test with moduleResolution: node16 (stricter, used by many projects)
+cat > tsconfig.json << 'EOF'
+{
+  "compilerOptions": {
+    "target": "ES2020",
+    "module": "Node16",
+    "moduleResolution": "Node16",
+    "strict": true,
+    "skipLibCheck": true,
+    "noEmit": true
+  },
+  "include": ["test-ts.ts"]
+}
+EOF
+
+if npx tsc --noEmit 2>&1; then
+  echo -e "${GREEN}✅ TypeScript compilation (node16) passed${NC}"
+else
+  echo -e "${RED}❌ TypeScript compilation (node16) failed${NC}"
+  exit 1
+fi
+
 # Cleanup
 echo -e "${YELLOW}🧹 Cleaning up...${NC}"
 cd /
```

**File**: `src/types.ts` (modified, +9/-0)
```diff
@@ -6,6 +6,7 @@ import {
   SyntheticEvent,
   TouchEvent,
 } from "react";
+import type React from "react";
 
 // ============= Gallery Item Types =============
 
@@ -515,3 +516,11 @@ export type SwipeDirection = "Left" | "Right" | "Up" | "Down";
 export interface SVGProps {
   strokeWidth?: number;
 }
+
+// ============= Default Export Declaration =============
+// This declares the ImageGallery component type for consumers
+// The actual implementation is in ImageGallery.tsx
+declare const ImageGallery: React.ForwardRefExoticComponent<
+  ImageGalleryProps & React.RefAttributes<ImageGalleryRef>
+>;
+export default ImageGallery;
```

---

### Incident Patch 7: `a31678a0` (2026-02-01)
**Commit Message**: fix deploy demo

**File**: `package.json` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
     "lint": "eslint src",
     "start": "webpack serve --hot --mode development --static ./example",
     "build": "webpack --config webpack.build.cjs && rm -rf build/types/components",
-    "deploy-demo": "bash scripts/deploy-demo.sh",
+    "deploy-demo": "npm run build && bash scripts/deploy-demo.sh",
     "preversion": "npm run lint && npm test",
     "version": "npm run build && git add -A",
     "postversion": "git push && git push --tags && npm run deploy-demo"
```

---

### Incident Patch 8: `7d064e07` (2026-02-01)
**Commit Message**: fix: use npm 11.5.1+ for true tokenless trusted publishing

**File**: `.github/workflows/ci.yml` (modified, +5/-4)
```diff
@@ -64,20 +64,21 @@ jobs:
       - name: Setup Node.js
         uses: actions/setup-node@v4
         with:
-          node-version: "20"
+          node-version: "22"
           cache: "npm"
           registry-url: "https://registry.npmjs.org"
 
+      - name: Update npm to latest
+        run: npm install -g npm@latest
+
       - name: Install Packages
         run: npm ci
 
       - name: Build
         run: npm run build
 
       - name: Publish to npm
-        run: npm publish --provenance --access public
-        env:
-          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
+        run: npm publish --access public
 
       - name: Create GitHub Release
         uses: softprops/action-gh-release@v2
```

---

### Incident Patch 9: `80110522` (2026-02-01)
**Commit Message**: fix: add NPM_TOKEN for npm publish

**File**: `.github/workflows/ci.yml` (modified, +2/-0)
```diff
@@ -76,6 +76,8 @@ jobs:
 
       - name: Publish to npm
         run: npm publish --provenance --access public
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
 
       - name: Create GitHub Release
         uses: softprops/action-gh-release@v2
```

---

### Incident Patch 10: `72ed9d8f` (2026-02-01)
**Commit Message**: fix: handle no-changes case in deploy-demo script

**File**: `scripts/deploy-demo.sh` (modified, +9/-4)
```diff
@@ -16,8 +16,13 @@ cp "$DEMO_SOURCE/demo.mini.js" "$DEMO_DEST/app.min.js"
 
 echo "📤 Pushing to linxtion.github.io..."
 cd "$DEMO_DEST"
-git add app.min.css app.min.js
-git commit -m "Update react-image-gallery demo to $(node -p "require('$PROJECT_ROOT/package.json').version")"
-git push
 
-echo "✅ Demo deployed!"
+# Only commit and push if there are changes
+if git diff --quiet app.min.css app.min.js; then
+  echo "ℹ️  No demo changes to deploy"
+else
+  git add app.min.css app.min.js
+  git commit -m "Update react-image-gallery demo to $(node -p "require('$PROJECT_ROOT/package.json').version")"
+  git push
+  echo "✅ Demo deployed!"
+fi
```

#### Recent Merged Pull Requests:
- **PR #841** (closed): Bump serialize-javascript, terser-webpack-plugin and css-minimizer-webpack-plugin (@dependabot[bot])
- **PR #840** (2026-03-05): Bump svgo from 4.0.0 to 4.0.1 (@dependabot[bot])
- **PR #839** (2026-03-05): Bump minimatch (@dependabot[bot])
- **PR #835** (2026-02-19): Bump qs from 6.14.1 to 6.14.2 (@dependabot[bot])
- **PR #833** (2026-02-19): Bump webpack from 5.97.1 to 5.105.0 (@dependabot[bot])
- **PR #831** (2026-01-31): Bump node-forge from 1.3.1 to 1.3.3 (@dependabot[bot])
- **PR #830** (closed): Bump lodash from 4.17.21 to 4.17.23 (@dependabot[bot])
- **PR #829** (closed): Bump lodash-es from 4.17.21 to 4.17.23 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
