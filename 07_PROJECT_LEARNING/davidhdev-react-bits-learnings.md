# Forensic Learning Record (Deep Inspection): DavidHDev/react-bits

> **Canonical Artifact**: `07_PROJECT_LEARNING/davidhdev-react-bits-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DavidHDev/react-bits](https://github.com/DavidHDev/react-bits))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:29:40.244Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DavidHDev/react-bits`
- **Description**: An open source collection of animated, interactive & fully customizable React components for building memorable websites.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 48536 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/constants/code/Animations/logoLoopCode.js`
```
import code from '@content/Animations/LogoLoop/LogoLoop.jsx?raw';
import css from '@content/Animations/LogoLoop/LogoLoop.css?raw';
import tailwind from '@tailwind/Animations/LogoLoop/LogoLoop.jsx?raw';
import tsCode from '@ts-default/Animations/LogoLoop/LogoLoop.tsx?raw';
import tsTailwind from '@ts-tailwind/Animations/LogoLoop/LogoLoop.tsx?raw';

export const logoLoop = {
  usage: `import LogoLoop from './LogoLoop';
import { SiReact, SiNextdotjs, SiTypescript, SiTailwindcss } from 'react-icons/si';

const techLogos = [
  { node: <SiReact />, title: "React", href: "https://react.dev" },
  { node: <SiNextdotjs />, title: "Next.js", href: "https://nextjs.org" },
  { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org" },
  { node: <SiTailwindcss />, title: "Tailwind CSS", href: "https://tailwindcss.com" },
];

// Alternative with image sources
const imageLogos = [
  { src: "/logos/company1.png", alt: "Company 1", href: "https://company1.com" },
  { src: "/logos/company2.png", alt: "Company 2", href: "https://company2.com" },
  { src: "/logos/company3.png", alt: "Company 3", href: "https://company3.com" },
];

function App() {
  return (
    <div style={{ height: '200px', position: 'relative', overflow: 'hidden'}}>
      {/* Basic horizontal loop */}
      <LogoLoop
        logos={techLogos}
        speed={120}
        direction="left"
        logoHeight={48}
        gap={40}
        hoverSpeed={0}
        scaleOnHover
        fadeOut
        fadeOutColor="#ffffff"
        ariaLabel="Technology partners"
      />
      
      {/* Vertical loop with deceleration on hover */}
      <LogoLoop
        logos={techLogos}
        speed={80}
        direction="up"
        logoHeight={48}
        gap={40}
        hoverSpeed={20}
        fadeOut
      />
    </div>
  );
}`,
  code,
  css,
  tailwind,
  tsCode,
  tsTailwind
};

```

### Core Architecture Module: `src/constants/code/TextAnimations/curvedLoopCode.js`
```
import code from '@content/TextAnimations/CurvedLoop/CurvedLoop.jsx?raw';
import css from '@content/TextAnimations/CurvedLoop/CurvedLoop.css?raw';
import tailwind from '@tailwind/TextAnimations/CurvedLoop/CurvedLoop.jsx?raw';
import tsCode from '@ts-default/TextAnimations/CurvedLoop/CurvedLoop.tsx?raw';
import tsTailwind from '@ts-tailwind/TextAnimations/CurvedLoop/CurvedLoop.tsx?raw';

export const curvedLoop = {
  usage: `import CurvedLoop from './CurvedLoop';

// Basic usage
<CurvedLoop marqueeText="Welcome to React Bits ✦" />

// With custom props
<CurvedLoop 
  marqueeText="Be ✦ Creative ✦ With ✦ React ✦ Bits ✦"
  speed={3}
  curveAmount={500}
  direction="right"
  interactive={true}
  className="custom-text-style"
/>

// Non-interactive with slower speed
<CurvedLoop 
  marqueeText="Smooth Curved Animation"
  speed={1}
  curveAmount={300}
  interactive={false}
/>`,
  code,
  css,
  tailwind,
  tsCode,
  tsTailwind
};

```

### Core Architecture Module: `src/constants/code/TextAnimations/textLoopCode.js`
```
import code from '@content/TextAnimations/TextLoop/TextLoop.jsx?raw';
import css from '@content/TextAnimations/TextLoop/TextLoop.css?raw';
import tailwind from '@tailwind/TextAnimations/TextLoop/TextLoop.jsx?raw';
import tsCode from '@ts-default/TextAnimations/TextLoop/TextLoop.tsx?raw';
import tsTailwind from '@ts-tailwind/TextAnimations/TextLoop/TextLoop.tsx?raw';

export const textLoop = {
  dependencies: `gsap`,
  usage: `import TextLoop from './TextLoop';

<TextLoop
  text="React ✦ Bits"
  shape="wave"
  speed={90}
  direction="forward"
  separator="✦"
  curviness={90}
  fontSize={46}
  fontWeight={800}
  letterSpacing={2}
  uppercase
  color="#ffffff"
  ribbon
  ribbonColor="#5227FF"
  ribbonWidth={86}
  pauseOnHover
/>`,
  code,
  css,
  tailwind,
  tsCode,
  tsTailwind
};

```

### Core Architecture Module: `src/content/Animations/LogoLoop/LogoLoop.jsx`
```
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import './LogoLoop.css';

const ANIMATION_CONFIG = { SMOOTH_TAU: 0.25, MIN_COPIES: 2, COPY_HEADROOM: 2 };

const toCssLength = value => (typeof value === 'number' ? `${value}px` : (value ?? undefined));

const useResizeObserver = (callback, elements, dependencies) => {
  useEffect(() => {
    if (!window.ResizeObserver) {
      const handleResize = () => callback();
      window.addEventListener('resize', handleResize);
      callback();
      return () => window.removeEventListener('resize', handleResize);
    }
    const observers = elements.map(ref => {
      if (!ref.current) return null;
      const observer = new ResizeObserver(callback);
      observer.observe(ref.current);
      return observer;
    });
    callback();
    return () => {
      observers.forEach(observer => observer?.disconnect());
    };
  }, [callback, elements, dependencies]);
};

const useImageLoader = (seqRef, onLoad, dependencies) => {
  useEffect(() => {
    const images = seqRef.current?.querySelectorAll('img') ?? [];
    if (images.length === 0) {
      onLoad();
      return;
    }
    let remainingImages = images.length;
    const handleImageLoad = () => {
      remainingImages -= 1;
      if (remainingImages === 0) onLoad();
    };
    images.forEach(img => {
      const htmlImg = img;
      if (htmlImg.complete) {
        handleImageLoad();
      } else {
        htmlImg.addEventListener('load', handleImageLoad, { once: true });
        htmlImg.addEventListener('error', handleImageLoad, { once: true });
      }
    });
    return () => {
      images.forEach(img => {
        img.removeEventListener('load', handleImageLoad);
        img.removeEventListener('error', handleImageLoad);
      });
    };
  }, [onLoad, seqRef, dependencies]);
};

const useAnimationLoop = (trackRef, targetVelocity, seqWidth, seqHeight, isHovered, hoverSpeed, isVertical) => {
  const rafRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const seqSize = isVertical ? seqHeight : seqWidth;

    if (seqSize > 0) {
      offsetRef.current = ((offsetRef.current % seqSize) + seqSize) % seqSize;
      const transformValue = isVertical
        ? `translate3d(0, ${-offsetRef.current}px, 0)`
        : `translate3d(${-offsetRef.current}px, 0, 0)`;
      track.style.transform = transformValue;
    }

    const animate = timestamp => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const deltaTime = Math.max(0, timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      const target = isHovered && hoverSpeed !== undefined ? hoverSpeed : targetVelocity;

      const easingFactor = 1 - Math.exp(-deltaTime / ANIMATION_CONFIG.SMOOTH_TAU);
      velocityRef.current += (target - velocityRef.current) * easingFactor;

      if (seqSize > 0) {
        let nextOffset = offsetRef.current + velocityRef.current * deltaTime;
        nextOffset = ((nextOffset % seqSize) + seqSize) % seqSize;
        offsetRef.current = nextOffset;

        const transformValue = isVertical
          ? `translate3d(0, ${-offsetRef.current}px, 0)`
          : `translate3d(${-offsetRef.current}px, 0, 0)`;
        track.style.transform = transformValue;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimestampRef.current = null;
    };
  }, [targetVelocity, seqWidth, seqHeight, isHovered, hoverSpeed, isVertical, trackRef]);
};

export const LogoLoop = memo(
  ({
    logos,
    speed = 120,
    direction = 'left',
    width = '100%',
    logoHeight = 28,
    gap = 32,
    pauseOnHover,
    hoverSpeed,
    fadeOut = false,
    fadeOutColor,
    scaleOnHover = false,
    renderItem,
    ariaLabel = 'Partner logos',
    className,
    style
  }) => {
    const containerRef = useRef(null);
    const trackRef = useRef(null);
    const seqRef = useRef(null);

    const [seqWidth, setSeqWidth] = useState(0);
    const [seqHeight, setSeqHeight] = useState(0);
    const [copyCount, setCopyCount] = useState(ANIMATION_CONFIG.MIN_COPIES);
    const [isHovered, setIsHovered] = useState(false);

    const effectiveHoverSpeed = useMemo(() => {
      if (hoverSpeed !== undefined) return hoverSpeed;
      if (pauseOnHover === true) return 0;
      if (pauseOnHover === false) return undefined;
      return 0;
    }, [hoverSpeed, pauseOnHover]);

    const isVertical = direction === 'up' || direction === 'down';

    const targetVelocity = useMemo(() => {
      const magnitude = Math.abs(speed);
      let directionMultiplier;
      if (isVertical) {
        directionMultiplier = direction === 'up' ? 1 : -1;
      } else {
        directionMultiplier = direction === 'left' ? 1 : -1;
      }
      const speedMultiplier = speed < 0 ? -1 : 1;
      return magnitude * directionMultiplier * speedMultiplier;
    }, [speed, direction, isVertical]);

    const updateDimensions = useCallback(() => {
      const containerWidth = containerRef.current?.clientWidth ?? 0;
      const sequenceRect = seqRef.current?.getBoundingClientRect?.();
      const sequenceWidth = sequenceRect?.width ?? 0;
      const sequenceHeight = sequenceRect?.height ?? 0;
      if (isVertical) {
        const parentHeight = containerRef.current?.parentElement?.clientHeight ?? 0;
        if (containerRef.current && parentHeight > 0) {
          const targetHeight = Math.ceil(parentHeight);
          if (containerRef.current.style.height !== `${targetHeight}px`)
            containerRef.current.style.height = `${targetHeight}px`;
        }
        if (sequenceHeight > 0) {
          setSeqHeight(Math.ceil(sequenceHeight));
          const viewport = containerRef.current?.clientHeight ?? parentHeight ?? sequenceHeight;
          const copiesNeeded = Math.ceil(viewport / sequenceHeight) + ANIMATION_CONFIG.COPY_HEADROOM;
          setCopyCount(Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded));
        }
      } else if (sequenceWidth > 0) {
        setSeqWidth(Math.ceil(sequenceWidth));
        const copiesNeeded = Math.ceil(containerWidth / sequenceWidth) + ANIMATION_CONFIG.COPY_HEADROOM;
        setCopyCount(Math.max(ANIMATION_CONFIG.MIN_COPIES, copiesNeeded));
      }
    }, [isVertical]);

    useResizeObserver(updateDimensions, [containerRef, seqRef], [logos, gap, logoHeight, isVertical]);

    useImageLoader(seqRef, updateDimensions, [logos, gap, logoHeight, isVertical]);

    useAnimationLoop(trackRef, targetVelocity, seqWidth, seqHeight, isHovered, effectiveHoverSpeed, isVertical);

    const cssVariables = useMemo(
      () => ({
        '--logoloop-gap': `${gap}px`,
        '--logoloop-logoHeight': `${logoHeight}px`,
        ...(fadeOutColor && { '--logoloop-fadeColor': fadeOutColor })
      }),
      [gap, logoHeight, fadeOutColor]
    );

    const rootClassName = useMemo(
      () =>
        [
          'logoloop',
          isVertical ? 'logoloop--vertical' : 'logoloop--horizontal',
          fadeOut && 'logoloop--fade',
          scaleOnHover && 'logoloop--scale-hover',
          className
        ]
          .filter(Boolean)
          .join(' '),
      [isVertical, fadeOut, scaleOnHover, className]
    );

    const handleMouseEnter = useCallback(() => {
      if (effectiveHoverSpeed !== undefined) setIsHovered(true);
    }, [effectiveHoverSpeed]);
    const handleMouseLeave = useCallback(() => {
      if (effectiveHoverSpeed !== undefined) setIsHovered(false);
    }, [effectiveHoverSpeed]);

    const renderLogoItem = useCallback(
      (item, key) => {
        if (renderItem) {
          return (
            <li className="logoloop__item" key={key} role="listitem">
              {renderItem(item, key)}
            </li>
          );
        }
        const isNodeItem = 'node' in item;
        const content = isNodeItem ? (
          <span className="logoloop__node" aria-hidden={!!item.href && !item.ariaLabel}>
            {item.node}
          </span>
        ) : (
          <img
            src={item.src}
            srcSet={item.srcSet}
            sizes={item.sizes}
            width={item.width}
            height={item.height}
            alt={item.alt ?? ''}
            title={item.title}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        );
        const itemAriaLabel = isNodeItem ? (item.ariaLabel ?? item.title) : (item.alt ?? item.title);
        const itemContent = item.href ? (
          <a
            className="logoloop__link"
            href={item.href}
            aria-label={itemAriaLabel || 'logo link'}
            target="_blank"
            rel="noreferrer noopener"
          >
            {content}
          </a>
        ) : (
          content
        );
        return (
          <li className="logoloop__item" key={key} role="listitem">
            {itemContent}
          </li>
        );
      },
      [renderItem]
    );

    const logoLists = useMemo(
      () =>
        Array.from({ length: copyCount }, (_, copyIndex) => (
          <ul
            className="logoloop__list"
            key={`copy-${copyIndex}`}
            role="list"
            aria-hidden={copyIndex > 0}
            ref={copyIndex === 0 ? seqRef : undefined}
          >
            {logos.map((item, itemIndex) => renderLogoItem(item, `${copyIndex}-${itemIndex}`))}
          </ul>
        )),
      [copyCount, logos, renderLogoItem]
    );

    const containerStyle = useMemo(
      () => ({
        width: isVertical
          ? toCssLength(width) === '100%'
            ? undefined
            : toCssLength(width)
   
```

### Core Architecture Module: `src/content/TextAnimations/CurvedLoop/CurvedLoop.jsx`
```
'use client';

import { useRef, useEffect, useState, useMemo, useId } from 'react';
import './CurvedLoop.css';

const CurvedLoop = ({
  marqueeText = '',
  speed = 2,
  className,
  curveAmount = 400,
  direction = 'left',
  interactive = true
}) => {
  const text = useMemo(() => {
    const hasTrailing = /\s|\u00A0$/.test(marqueeText);
    return (hasTrailing ? marqueeText.replace(/\s+$/, '') : marqueeText) + '\u00A0';
  }, [marqueeText]);

  const measureRef = useRef(null);
  const textPathRef = useRef(null);
  const pathRef = useRef(null);
  const [spacing, setSpacing] = useState(0);
  const [offset, setOffset] = useState(0);
  const uid = useId();
  const pathId = `curve-${uid}`;
  const pathD = `M-100,40 Q500,${40 + curveAmount} 1540,40`;

  const dragRef = useRef(false);
  const lastXRef = useRef(0);
  const dirRef = useRef(direction);
  const velRef = useRef(0);

  const textLength = spacing;
  const totalText = textLength
    ? Array(Math.ceil(1800 / textLength) + 2)
        .fill(text)
        .join('')
    : text;
  const ready = spacing > 0;

  useEffect(() => {
    if (measureRef.current) setSpacing(measureRef.current.getComputedTextLength());
  }, [text, className]);

  useEffect(() => {
    if (!spacing) return;
    if (textPathRef.current) {
      const initial = -spacing;
      textPathRef.current.setAttribute('startOffset', initial + 'px');
      setOffset(initial);
    }
  }, [spacing]);

  useEffect(() => {
    if (!spacing || !ready) return;
    let frame = 0;
    const step = () => {
      if (!dragRef.current && textPathRef.current) {
        const delta = dirRef.current === 'right' ? speed : -speed;
        const currentOffset = parseFloat(textPathRef.current.getAttribute('startOffset') || '0');
        let newOffset = currentOffset + delta;

        const wrapPoint = spacing;
        if (newOffset <= -wrapPoint) newOffset += wrapPoint;
        if (newOffset > 0) newOffset -= wrapPoint;

        textPathRef.current.setAttribute('startOffset', newOffset + 'px');
        setOffset(newOffset);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [spacing, speed, ready]);

  const onPointerDown = e => {
    if (!interactive) return;
    dragRef.current = true;
    lastXRef.current = e.clientX;
    velRef.current = 0;
    e.target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = e => {
    if (!interactive || !dragRef.current || !textPathRef.current) return;
    const dx = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;
    velRef.current = dx;

    const currentOffset = parseFloat(textPathRef.current.getAttribute('startOffset') || '0');
    let newOffset = currentOffset + dx;

    const wrapPoint = spacing;
    if (newOffset <= -wrapPoint) newOffset += wrapPoint;
    if (newOffset > 0) newOffset -= wrapPoint;

    textPathRef.current.setAttribute('startOffset', newOffset + 'px');
    setOffset(newOffset);
  };

  const endDrag = () => {
    if (!interactive) return;
    dragRef.current = false;
    dirRef.current = velRef.current > 0 ? 'right' : 'left';
  };

  const cursorStyle = interactive ? (dragRef.current ? 'grabbing' : 'grab') : 'auto';

  return (
    <div
      className="curved-loop-jacket"
      style={{ visibility: ready ? 'visible' : 'hidden', cursor: cursorStyle }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      <svg className="curved-loop-svg" viewBox="0 0 1440 120">
        <text ref={measureRef} xmlSpace="preserve" style={{ visibility: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          {text}
        </text>
        <defs>
          <path ref={pathRef} id={pathId} d={pathD} fill="none" stroke="transparent" />
        </defs>
        {ready && (
          <text fontWeight="bold" xmlSpace="preserve" className={className}>
            <textPath ref={textPathRef} href={`#${pathId}`} startOffset={offset + 'px'} xmlSpace="preserve">
              {totalText}
            </textPath>
          </text>
        )}
      </svg>
    </div>
  );
};

export default CurvedLoop;

```

### Core Architecture Module: `src/content/TextAnimations/TextLoop/TextLoop.jsx`
```
'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

import './TextLoop.css';

const VIEW_W = 1200;
const VIEW_H = 520;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const EDGE_PAD = 6;

const buildPath = (shape, curviness, ribbonWidth) => {
  const c = Math.max(0, curviness);
  const room = Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);

  switch (shape) {
    case 'circle': {
      const r = Math.min(90 + c * 0.95, room);
      return `M ${CX - r} ${CY} A ${r} ${r} 0 1 1 ${CX + r} ${CY} A ${r} ${r} 0 1 1 ${CX - r} ${CY} Z`;
    }
    case 'infinity': {
      const r = 150 + c * 1.4;
      const h = Math.min(60 + c * 0.95, room);
      return [
        `M ${CX} ${CY}`,
        `C ${CX + r * 0.55} ${CY - h} ${CX + r} ${CY - h} ${CX + r} ${CY}`,
        `C ${CX + r} ${CY + h} ${CX + r * 0.55} ${CY + h} ${CX} ${CY}`,
        `C ${CX - r * 0.55} ${CY - h} ${CX - r} ${CY - h} ${CX - r} ${CY}`,
        `C ${CX - r} ${CY + h} ${CX - r * 0.55} ${CY + h} ${CX} ${CY}`,
        'Z'
      ].join(' ');
    }
    case 'arch': {
      const rise = Math.min(120 + c * 1.1, room * 2);
      return `M 120 ${CY + rise / 2} Q ${CX} ${CY - rise * 1.5} ${VIEW_W - 120} ${CY + rise / 2}`;
    }
    case 'line':
      return `M -320 ${CY} L ${VIEW_W + 320} ${CY}`;
    case 'wave':
    default: {
      const a = Math.min(c * 2.2, room * 2);
      return `M -320 ${CY} Q -160 ${CY - a} 0 ${CY} T 320 ${CY} T 640 ${CY} T 960 ${CY} T 1280 ${CY} T ${VIEW_W + 320} ${CY}`;
    }
  }
};

const TextLoop = ({
  text = 'React ✦ Bits',
  shape = 'wave',
  path,
  speed = 90,
  direction = 'forward',
  separator = '✦',
  curviness = 90,
  fontSize = 46,
  fontWeight = 800,
  letterSpacing = 2,
  uppercase = true,
  color = '#ffffff',
  ribbon = true,
  ribbonColor = '#5227FF',
  ribbonWidth = 86,
  pauseOnHover = true,
  className = '',
  style = {}
}) => {
  const rootRef = useRef(null);
  const pathRef = useRef(null);
  const measureRef = useRef(null);
  const headRef = useRef(null);
  const tailRef = useRef(null);

  const [metrics, setMetrics] = useState({ length: 0, reps: 1 });

  const rawId = useId();
  const pathId = `text-loop-${rawId.replace(/:/g, '')}`;

  const d = useMemo(() => path || buildPath(shape, curviness, ribbonWidth), [path, shape, curviness, ribbonWidth]);

  const unit = useMemo(() => {
    const base = uppercase ? String(text).toUpperCase() : String(text);
    const gap = separator ? `\u00A0${separator}\u00A0` : '\u00A0\u00A0\u00A0';
    return `${base}${gap}`;
  }, [text, separator, uppercase]);

  const textStyle = useMemo(
    () => ({ fontSize: `${fontSize}px`, fontWeight, letterSpacing: `${letterSpacing}px` }),
    [fontSize, fontWeight, letterSpacing]
  );

  useLayoutEffect(() => {
    const pathEl = pathRef.current;
    const measureEl = measureRef.current;
    if (!pathEl || !measureEl) return undefined;

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      let length = 0;
      let unitWidth = 0;
      try {
        length = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
      } catch {
        return;
      }
      if (!length) return;

      const reps = unitWidth > 0 ? Math.max(1, Math.round(length / unitWidth)) : 1;
      setMetrics(prev => (prev.length === length && prev.reps === reps ? prev : { length, reps }));
    };

    measure();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [d, unit, fontSize, fontWeight, letterSpacing]);

  useEffect(() => {
    const { length } = metrics;
    const head = headRef.current;
    const tail = tailRef.current;
    if (!head || !tail || !length) return undefined;

    const apply = offset => {
      const partner = offset >= 0 ? offset - length : offset + length;
      head.setAttribute('startOffset', String(offset));
      tail.setAttribute('startOffset', String(partner));
    };

    apply(0);

    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || speed <= 0) return undefined;

    const state = { offset: 0 };
    const tween = gsap.to(state, {
      offset: direction === 'reverse' ? -length : length,
      duration: length / speed,
      ease: 'none',
      repeat: -1,
      onUpdate: () => apply(state.offset)
    });

    const root = rootRef.current;
    const pause = () => tween.pause();
    const resume = () => tween.resume();

    if (pauseOnHover && root) {
      root.addEventListener('pointerenter', pause);
      root.addEventListener('pointerleave', resume);
    }

    return () => {
      tween.kill();
      if (pauseOnHover && root) {
        root.removeEventListener('pointerenter', pause);
        root.removeEventListener('pointerleave', resume);
      }
    };
  }, [metrics, speed, direction, pauseOnHover]);

  const loopText = unit.repeat(metrics.reps);
  const fitLength = metrics.length || undefined;

  return (
    <div ref={rootRef} className={`text-loop ${className}`.trim()} style={style}>
      <svg
        className="text-loop-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={text}
      >
        <path
          ref={pathRef}
          id={pathId}
          d={d}
          fill="none"
          stroke={ribbon ? ribbonColor : 'none'}
          strokeWidth={ribbon ? ribbonWidth : 0}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <text ref={measureRef} className="text-loop-measure" style={textStyle} aria-hidden="true">
          {unit}
        </text>

        <text
          className="text-loop-text"
          style={textStyle}
          fill={color}
          dominantBaseline="central"
          aria-hidden="true"
          textLength={fitLength}
          lengthAdjust="spacing"
        >
          <textPath ref={headRef} href={`#${pathId}`} startOffset={0}>
            {loopText}
          </textPath>
        </text>

        <text
          className="text-loop-text"
          style={textStyle}
          fill={color}
          dominantBaseline="central"
          aria-hidden="true"
          textLength={fitLength}
          lengthAdjust="spacing"
        >
          <textPath ref={tailRef} href={`#${pathId}`} startOffset={0}>
            {loopText}
          </textPath>
        </text>
      </svg>
    </div>
  );
};

export default TextLoop;

```

### Core Architecture Module: `src/demo/Animations/LogoLoopDemo.jsx`
```
import { useMemo } from 'react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';
import { Box } from '@chakra-ui/react';

import Customize from '../../components/common/Preview/Customize';
import CodeExample from '../../components/code/CodeExample';

import PropTable from '../../components/common/Preview/PropTable';
import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewSwitch from '../../components/common/Preview/PreviewSwitch';
import PreviewSelect from '../../components/common/Preview/PreviewSelect';
import useForceRerender from '../../hooks/useForceRerender';
import useComponentProps from '../../hooks/useComponentProps';
import { ComponentPropsProvider } from '../../components/context/ComponentPropsContext';

import { logoLoop } from '../../constants/code/Animations/logoLoopCode';
import LogoLoop from '../../content/Animations/LogoLoop/LogoLoop';
import { useColorModeValue } from '../../components/setup/color-mode';

import {
  SiReact,
  SiNextdotjs,
  SiTypescript,
  SiTailwindcss,
  SiVercel,
  SiGithub,
  SiDocker,
  SiPrisma,
  SiSupabase,
  SiStripe
} from 'react-icons/si';

const items = [
  { node: <SiReact />, title: 'React', href: 'https://react.dev' },
  { node: <SiNextdotjs />, title: 'Next.js', href: 'https://nextjs.org' },
  { node: <SiTypescript />, title: 'TypeScript', href: 'https://www.typescriptlang.org' },
  { node: <SiTailwindcss />, title: 'Tailwind CSS', href: 'https://tailwindcss.com' },
  { node: <SiVercel />, title: 'Vercel', href: 'https://vercel.com' },
  { node: <SiGithub />, title: 'GitHub', href: 'https://github.com' },
  { node: <SiDocker />, title: 'Docker', href: 'https://www.docker.com' },
  { node: <SiPrisma />, title: 'Prisma', href: 'https://www.prisma.io' },
  { node: <SiSupabase />, title: 'Supabase', href: 'https://supabase.com' },
  { node: <SiStripe />, title: 'Stripe', href: 'https://stripe.com' }
];

const DEFAULT_PROPS = {
  speed: 100,
  logoHeight: 60,
  gap: 60,
  hoverSpeed: 0,
  fadeOut: true,
  scaleOnHover: true,
  direction: 'left',
  useCustomRender: false
};

const LogoLoopDemo = () => {
  const [key, forceRerender] = useForceRerender();
  const { props, updateProp, resetProps, hasChanges } = useComponentProps(DEFAULT_PROPS);
  const { speed, logoHeight, gap, hoverSpeed, fadeOut, scaleOnHover, direction, useCustomRender } = props;
  const fadeOutColor = useColorModeValue('#ffffff', '#120F17');
  const customBorder = useColorModeValue('#d4d4d8', '#8b5cf6');
  const customBackground = useColorModeValue('rgba(24, 24, 27, 0.035)', 'rgba(139, 92, 246, 0.1)');

  const directionOptions = [
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
    { value: 'up', label: 'Up' },
    { value: 'down', label: 'Down' }
  ];

  const propData = useMemo(
    () => [
      {
        name: 'logos',
        type: 'LogoItem[]',
        default: 'required',
        description: 'Array of logo items to display. Each item can be either a React node or an image src.'
      },
      {
        name: 'speed',
        type: 'number',
        default: '120',
        description:
          'Animation speed in pixels per second. Positive values move based on direction, negative values reverse direction.'
      },
      {
        name: 'direction',
        type: "'left' | 'right' | 'up' | 'down'",
        default: "'left'",
        description:
          'Direction of the logo animation loop. Supports horizontal (left/right) and vertical (up/down) scrolling.'
      },
      {
        name: 'width',
        type: 'number | string',
        default: "'100%'",
        description: 'Width of the logo loop container.'
      },
      {
        name: 'logoHeight',
        type: 'number',
        default: '28',
        description: 'Height of the logos in pixels.'
      },
      {
        name: 'gap',
        type: 'number',
        default: '32',
        description: 'Gap between logos in pixels.'
      },
      {
        name: 'hoverSpeed',
        type: 'number | undefined',
        default: '0',
        description:
          'Speed when hovering over the component. Set to 0 to pause, or a lower value for deceleration effect.'
      },
      {
        name: 'fadeOut',
        type: 'boolean',
        default: 'false',
        description: 'Whether to apply fade-out effect at the edges of the container.'
      },
      {
        name: 'fadeOutColor',
        type: 'string',
        default: 'undefined',
        description: 'Color used for the fade-out effect. Only applies when fadeOut is true.'
      },
      {
        name: 'scaleOnHover',
        type: 'boolean',
        default: 'false',
        description: 'Whether to scale logos on hover.'
      },
      {
        name: 'renderItem',
        type: '(item: LogoItem, key: React.Key) => React.ReactNode',
        default: 'undefined',
        description:
          'Custom render function for each logo item. Allows full control over item rendering for animations, tooltips, etc.'
      },
      {
        name: 'ariaLabel',
        type: 'string',
        default: "'Partner logos'",
        description: 'Accessibility label for the logo loop component.'
      },
      {
        name: 'className',
        type: 'string',
        default: 'undefined',
        description: 'Additional CSS class names to apply to the root element.'
      },
      {
        name: 'style',
        type: 'React.CSSProperties',
        default: 'undefined',
        description: 'Inline styles to apply to the root element.'
      }
    ],
    []
  );

  return (
    <ComponentPropsProvider props={props} defaultProps={DEFAULT_PROPS} resetProps={resetProps} hasChanges={hasChanges}>
      <TabsLayout>
        <PreviewTab>
          <Box position="relative" className="demo-container" h={400} p={0} overflow="hidden">
            <LogoLoop
              key={key}
              logos={items}
              width="100%"
              logoHeight={logoHeight}
              gap={gap}
              speed={speed}
              direction={direction}
              scaleOnHover={scaleOnHover}
              hoverSpeed={hoverSpeed}
              fadeOut={fadeOut}
              fadeOutColor={fadeOutColor}
              ariaLabel="Our tech stack"
              renderItem={
                useCustomRender
                  ? item => (
                      <div
                        style={{
                          padding: '8px',
                          border: `1px solid ${customBorder}`,
                          borderRadius: '8px',
                          background: customBackground
                        }}
                      >
                        {'node' in item ? (
                          item.node
                        ) : (
                          <img src={item.src} alt={item.alt} style={{ height: `${logoHeight}px` }} />
                        )}
                      </div>
                    )
                  : undefined
              }
            />
          </Box>

          <Customize>
            <PreviewSelect
              title="Direction"
              options={directionOptions}
              value={direction}
              onChange={value => {
                updateProp('direction', value);
                forceRerender();
              }}
            />

            <PreviewSlider
              title="Speed"
              min={0}
              max={300}
              step={10}
              value={speed}
              valueUnit="px/s"
              onChange={value => {
                updateProp('speed', value);
                forceRerender();
              }}
            />

            <PreviewSlider
              title="Hover Speed"
              min={0}
              max={200}
              step={10}
              value={hoverSpeed}
              valueUnit="px/s"
              onChange={value => {
                updateProp('hoverSpeed', value);
                forceRerender();
              }}
            />

            <PreviewSlider
              title="Logo Height"
              min={20}
              max={120}
              step={5}
              value={logoHeight}
              valueUnit="px"
              onChange={value => {
                updateProp('logoHeight', value);
                forceRerender();
              }}
            />

            <PreviewSlider
              title="Gap"
              min={10}
              max={120}
              step={5}
              value={gap}
              valueUnit="px"
              onChange={value => {
                updateProp('gap', value);
                forceRerender();
              }}
            />

            <PreviewSwitch
              title="Fade Out"
              isChecked={fadeOut}
              onChange={checked => {
                updateProp('fadeOut', checked);
                forceRerender();
              }}
            />

            <PreviewSwitch
              title="Scale on Hover"
              isChecked={scaleOnHover}
              onChange={checked => {
                updateProp('scaleOnHover', checked);
                forceRerender();
              }}
            />

            <PreviewSwitch
              title="Use Custom Render"
              isChecked={useCustomRender}
              onChange={checked => {
                updateProp('useCustomRender', checked);
                forceRerender();
              }}
            />
          </Customize>

          <PropTable data={propData} />
        </PreviewTab>

        <CodeTab>
          <CodeExample codeObject={logoLoop} componentName="LogoLoop" />
        </CodeTab>
      </TabsLayout>
    </ComponentPropsProvider>
  );
};

export default LogoLoopDemo;

```

### Core Architecture Module: `src/demo/TextAnimations/CurvedLoopDemo.jsx`
```
import { useMemo } from 'react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';
import { Box } from '@chakra-ui/react';

import Customize from '../../components/common/Preview/Customize';
import CodeExample from '../../components/code/CodeExample';

import PropTable from '../../components/common/Preview/PropTable';
import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewInput from '../../components/common/Preview/PreviewInput';
import PreviewSwitch from '../../components/common/Preview/PreviewSwitch';
import useForceRerender from '../../hooks/useForceRerender';
import useComponentProps from '../../hooks/useComponentProps';
import { ComponentPropsProvider } from '../../components/context/ComponentPropsContext';

import { curvedLoop } from '../../constants/code/TextAnimations/curvedLoopCode';
import CurvedLoop from '../../content/TextAnimations/CurvedLoop/CurvedLoop';

const DEFAULT_PROPS = {
  marqueeText: 'Be ✦ Creative ✦ With ✦ React ✦ Bits ✦',
  speed: 2,
  curveAmount: 400,
  interactive: true
};

const CurvedLoopDemo = () => {
  const [key, forceRerender] = useForceRerender();

  const { props, updateProp, resetProps, hasChanges } = useComponentProps(DEFAULT_PROPS);
  const { marqueeText, speed, curveAmount, interactive } = props;

  const propData = useMemo(
    () => [
      {
        name: 'marqueeText',
        type: 'string',
        default: '""',
        description: 'The text to display in the curved marquee'
      },
      {
        name: 'speed',
        type: 'number',
        default: '2',
        description: 'Animation speed of the marquee text'
      },
      {
        name: 'className',
        type: 'string',
        default: 'undefined',
        description: 'CSS class name for styling the text'
      },
      {
        name: 'curveAmount',
        type: 'number',
        default: '400',
        description: 'Amount of curve in the text path'
      },
      {
        name: 'direction',
        type: '"left" | "right"',
        default: '"left"',
        description: 'Initial direction of the marquee animation'
      },
      {
        name: 'interactive',
        type: 'boolean',
        default: 'true',
        description: 'Whether the marquee can be dragged by the user'
      }
    ],
    []
  );

  return (
    <ComponentPropsProvider props={props} defaultProps={DEFAULT_PROPS} resetProps={resetProps} hasChanges={hasChanges}>
      <TabsLayout>
        <PreviewTab>
          <Box position="relative" className="demo-container" h={400} overflow="hidden" p={0}>
            <CurvedLoop
              key={key}
              marqueeText={marqueeText}
              speed={speed}
              curveAmount={curveAmount}
              interactive={interactive}
            />
          </Box>

          <Customize>
            <PreviewInput
              title="Marquee Text"
              value={marqueeText}
              placeholder="Enter text..."
              width={300}
              onChange={value => {
                updateProp('marqueeText', value);
                forceRerender();
              }}
            />

            <PreviewSlider
              title="Speed"
              min={0}
              max={10}
              step={0.1}
              value={speed}
              onChange={value => {
                updateProp('speed', value);
                forceRerender();
              }}
            />

            <PreviewSlider
              title="Curve Amount"
              min={-400}
              max={400}
              step={10}
              value={curveAmount}
              valueUnit="px"
              onChange={value => {
                updateProp('curveAmount', value);
                forceRerender();
              }}
            />

            <PreviewSwitch
              title="Draggable"
              isChecked={interactive}
              onChange={checked => {
                updateProp('interactive', checked);
                forceRerender();
              }}
            />
          </Customize>

          <PropTable data={propData} />
        </PreviewTab>

        <CodeTab>
          <CodeExample codeObject={curvedLoop} componentName="CurvedLoop" />
        </CodeTab>
      </TabsLayout>
    </ComponentPropsProvider>
  );
};

export default CurvedLoopDemo;

```

### Core Architecture Module: `src/demo/TextAnimations/TextLoopDemo.jsx`
```
import { useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import { CodeTab, PreviewTab, TabsLayout } from '../../components/common/TabsLayout';

import CodeExample from '../../components/code/CodeExample';
import Customize from '../../components/common/Preview/Customize';
import Dependencies from '../../components/code/Dependencies';
import PreviewColorPickerCustom from '../../components/common/Preview/PreviewColorPickerCustom';
import PreviewInput from '../../components/common/Preview/PreviewInput';
import PreviewSelect from '../../components/common/Preview/PreviewSelect';
import PreviewSlider from '../../components/common/Preview/PreviewSlider';
import PreviewSwitch from '../../components/common/Preview/PreviewSwitch';
import PropTable from '../../components/common/Preview/PropTable';
import useComponentProps from '../../hooks/useComponentProps';
import { ComponentPropsProvider } from '../../components/context/ComponentPropsContext';
import { useColorModeValue } from '../../components/setup/color-mode';

import TextLoop from '../../content/TextAnimations/TextLoop/TextLoop';
import { textLoop } from '../../constants/code/TextAnimations/textLoopCode';

const DEFAULT_PROPS = {
  text: 'React ✦ Bits',
  shape: 'wave',
  speed: 90,
  direction: 'forward',
  separator: '✦',
  curviness: 90,
  fontSize: 46,
  fontWeight: 800,
  letterSpacing: 2,
  uppercase: true,
  color: '#ffffff',
  ribbon: true,
  ribbonColor: '#5227FF',
  ribbonWidth: 86,
  pauseOnHover: true
};

const SHAPE_OPTIONS = [
  { value: 'wave', label: 'Wave' },
  { value: 'circle', label: 'Circle' },
  { value: 'infinity', label: 'Infinity' },
  { value: 'arch', label: 'Arch' },
  { value: 'line', label: 'Line' }
];

const DIRECTION_OPTIONS = [
  { value: 'forward', label: 'Forward' },
  { value: 'reverse', label: 'Reverse' }
];

const TextLoopDemo = () => {
  const { props, updateProp, resetProps, hasChanges } = useComponentProps(DEFAULT_PROPS);
  const {
    text,
    shape,
    speed,
    direction,
    separator,
    curviness,
    fontSize,
    fontWeight,
    letterSpacing,
    uppercase,
    color,
    ribbon,
    ribbonColor,
    ribbonWidth,
    pauseOnHover
  } = props;
  const renderedColor = useColorModeValue(color === DEFAULT_PROPS.color ? '#ffffff' : color, color);

  const propData = useMemo(
    () => [
      { name: 'text', type: 'string', default: '"React ✦ Bits"', description: 'The phrase repeated along the curve.' },
      {
        name: 'shape',
        type: '"wave" | "circle" | "infinity" | "arch" | "line"',
        default: '"wave"',
        description: 'Built-in curve the text flows along.'
      },
      {
        name: 'path',
        type: 'string',
        default: 'undefined',
        description: 'Custom SVG path data, drawn in a 1200x400 viewBox. Overrides shape when provided.'
      },
      {
        name: 'speed',
        type: 'number',
        default: '90',
        description: 'Travel speed along the path, in units per second.'
      },
      {
        name: 'direction',
        type: '"forward" | "reverse"',
        default: '"forward"',
        description: 'Direction the text scrolls around the curve.'
      },
      { name: 'separator', type: 'string', default: '"✦"', description: 'Glyph placed between each repetition.' },
      {
        name: 'curviness',
        type: 'number',
        default: '90',
        description: 'Amplitude of the wave, or the radius of the closed shapes.'
      },
      { name: 'fontSize', type: 'number', default: '46', description: 'Font size of the looping text.' },
      { name: 'fontWeight', type: 'number', default: '800', description: 'Font weight of the looping text.' },
      { name: 'letterSpacing', type: 'number', default: '2', description: 'Extra tracking between letters.' },
      { name: 'uppercase', type: 'boolean', default: 'true', description: 'Renders the phrase in uppercase.' },
      { name: 'color', type: 'string', default: '"#ffffff"', description: 'Fill color of the text.' },
      {
        name: 'ribbon',
        type: 'boolean',
        default: 'true',
        description: 'Draws a solid band behind the text along the path.'
      },
      { name: 'ribbonColor', type: 'string', default: '"#5227FF"', description: 'Color of the band behind the text.' },
      { name: 'ribbonWidth', type: 'number', default: '86', description: 'Thickness of the band behind the text.' },
      {
        name: 'pauseOnHover',
        type: 'boolean',
        default: 'true',
        description: 'Pauses the loop while the pointer is over it.'
      },
      { name: 'className', type: 'string', default: '""', description: 'Additional CSS classes for the wrapper.' },
      { name: 'style', type: 'object', default: '{}', description: 'Inline styles for the wrapper.' }
    ],
    []
  );

  return (
    <ComponentPropsProvider props={props} defaultProps={DEFAULT_PROPS} resetProps={resetProps} hasChanges={hasChanges}>
      <TabsLayout>
        <PreviewTab>
          <Box
            className="demo-container"
            p={0}
            minH={430}
            overflow="hidden"
            position="relative"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <TextLoop
              text={text}
              shape={shape}
              speed={speed}
              direction={direction}
              separator={separator}
              curviness={curviness}
              fontSize={fontSize}
              fontWeight={fontWeight}
              letterSpacing={letterSpacing}
              uppercase={uppercase}
              color={renderedColor}
              ribbon={ribbon}
              ribbonColor={ribbonColor}
              ribbonWidth={ribbonWidth}
              pauseOnHover={pauseOnHover}
            />
          </Box>

          <Customize>
            <PreviewInput
              title="Text"
              value={text}
              placeholder="Your phrase"
              maxLength={30}
              onChange={value => updateProp('text', value)}
            />

            <PreviewInput
              title="Separator"
              value={separator}
              placeholder="✦"
              width={90}
              maxLength={3}
              onChange={value => updateProp('separator', value)}
            />

            <PreviewSelect
              title="Shape"
              options={SHAPE_OPTIONS}
              value={shape}
              onChange={value => updateProp('shape', value)}
            />

            <PreviewSelect
              title="Direction"
              options={DIRECTION_OPTIONS}
              value={direction}
              onChange={value => updateProp('direction', value)}
            />

            <PreviewColorPickerCustom
              title="Text Color"
              color={renderedColor}
              onChange={value => updateProp('color', value)}
            />
            <PreviewColorPickerCustom
              title="Ribbon Color"
              color={ribbonColor}
              onChange={value => updateProp('ribbonColor', value)}
            />

            <PreviewSwitch title="Ribbon" isChecked={ribbon} onChange={value => updateProp('ribbon', value)} />
            <PreviewSwitch title="Uppercase" isChecked={uppercase} onChange={value => updateProp('uppercase', value)} />
            <PreviewSwitch
              title="Pause On Hover"
              isChecked={pauseOnHover}
              onChange={value => updateProp('pauseOnHover', value)}
            />

            <PreviewSlider
              title="Speed"
              min={10}
              max={260}
              step={5}
              value={speed}
              onChange={value => updateProp('speed', value)}
            />

            <PreviewSlider
              title="Curviness"
              min={0}
              max={160}
              step={2}
              value={curviness}
              onChange={value => updateProp('curviness', value)}
            />

            <PreviewSlider
              title="Ribbon Width"
              min={0}
              max={160}
              step={2}
              value={ribbonWidth}
              valueUnit="px"
              onChange={value => updateProp('ribbonWidth', value)}
            />

            <PreviewSlider
              title="Font Size"
              min={18}
              max={90}
              step={2}
              value={fontSize}
              valueUnit="px"
              onChange={value => updateProp('fontSize', value)}
            />

            <PreviewSlider
              title="Font Weight"
              min={300}
              max={900}
              step={50}
              value={fontWeight}
              onChange={value => updateProp('fontWeight', value)}
            />

            <PreviewSlider
              title="Letter Spacing"
              min={-2}
              max={14}
              step={0.5}
              value={letterSpacing}
              valueUnit="px"
              onChange={value => updateProp('letterSpacing', value)}
            />
          </Customize>

          <PropTable data={propData} />
          <Dependencies dependencyList={['gsap']} />
        </PreviewTab>

        <CodeTab>
          <CodeExample codeObject={textLoop} componentName="TextLoop" />
        </CodeTab>
      </TabsLayout>
    </ComponentPropsProvider>
  );
};

export default TextLoopDemo;

```

### Core Architecture Module: `src/hooks/useAIExportActions.js`
```
import { useCallback, useMemo, useState } from 'react';
import { Sparkles, FileCode2, Terminal, FileText } from 'lucide-react';
import { SiOpenai, SiClaude, SiVercel } from 'react-icons/si';
import { toast } from 'sonner';
import { generateCliCommands } from '../utils/cli';
import { useOptions } from '../components/context/OptionsContext/useOptions';
import { useInstallation } from './useInstallation';
import { copyText, openInAI, buildCompactPrompt, registryUrl } from '../utils/aiExport';

export function useAIExportActions({
  componentName,
  category,
  subcategory,
  fullPrompt,
  configuredUsage,
  componentSource,
  componentCss,
  dependencies
}) {
  const [done, setDone] = useState(null);
  const { languagePreset, stylePreset } = useOptions();
  const { cliTool, packageManager } = useInstallation();

  const installCommand = useMemo(() => {
    const commands = generateCliCommands(languagePreset, stylePreset, category, subcategory, dependencies);
    if (!commands) return '';
    const key = packageManager === 'npm' ? 'npx' : packageManager;
    return cliTool === 'jsrepo' ? commands.jsrepo[key] : commands.shadcn[key];
  }, [languagePreset, stylePreset, category, subcategory, dependencies, cliTool, packageManager]);

  const run = useCallback(async (key, text, message) => {
    if (!text) {
      toast.error('Nothing to copy for this component');
      return;
    }
    if (await copyText(text)) {
      setDone(key);
      toast.success(message);
      setTimeout(() => setDone(null), 2000);
    } else {
      toast.error('Could not copy to clipboard');
    }
  }, []);

  const copyItems = useMemo(() => {
    const sourceWithCss = componentCss
      ? `${componentSource}\n\n/* ---- ${componentName}.css ---- */\n${componentCss}`
      : componentSource;

    return [
      {
        key: 'prompt',
        label: 'Copy prompt',
        icon: Sparkles,
        run: () => run('prompt', fullPrompt, 'Prompt copied — paste into any AI assistant')
      },
      {
        key: 'usage',
        label: 'Copy configured code',
        icon: FileText,
        run: () => run('usage', configuredUsage, 'Configured usage copied')
      },
      {
        key: 'source',
        label: 'Copy component source',
        icon: FileCode2,
        run: () => run('source', sourceWithCss, 'Component source copied')
      },
      {
        key: 'install',
        label: 'Copy install command',
        icon: Terminal,
        run: () => run('install', installCommand, 'Install command copied')
      }
    ];
  }, [componentName, componentCss, componentSource, fullPrompt, configuredUsage, installCommand, run]);

  const openItems = useMemo(() => {
    const compactPrompt = buildCompactPrompt({
      componentName,
      category,
      subcategory,
      language: languagePreset,
      style: stylePreset,
      installCommand,
      usage: configuredUsage
    });

    const payload = {
      prompt: compactPrompt,
      registryUrl: registryUrl(componentName, languagePreset, stylePreset)
    };

    return [
      { key: 'chatgpt', label: 'Open in ChatGPT', icon: SiOpenai },
      { key: 'claude', label: 'Open in Claude', icon: SiClaude },
      { key: 'v0', label: 'Open in v0', icon: SiVercel }
    ].map(item => ({ ...item, run: () => openInAI(item.key, payload) }));
  }, [componentName, category, subcategory, languagePreset, stylePreset, installCommand, configuredUsage]);

  return { copyItems, openItems, done };
}

```

### Core Architecture Module: `src/hooks/useActiveRoute.js`
```
import { useContext } from 'react';
import { ActiveRouteContext } from '../components/context/ActiveRouteContext/ActiveRouteContext';

export const useActiveRoute = () => {
  const ctx = useContext(ActiveRouteContext);
  if (!ctx) throw new Error('useActiveRoute must be used within an ActiveRouteProvider');
  return ctx;
};

```

### Core Architecture Module: `src/hooks/useComponentProps.js`
```
import { useQueryStates } from 'nuqs';
import { useCallback, useMemo, useRef } from 'react';
import { useColorMode } from '../components/setup/color-mode';
import { getBackgroundLightProps } from '../constants/backgroundThemeProps';

const isHexColor = value => typeof value === 'string' && /^#?[0-9a-fA-F]{3,8}$/.test(value);

const createParser = defaultValue => {
  if (typeof defaultValue === 'number') {
    return {
      parse: v => (v === null || v === '' ? null : Number(v)),
      serialize: v => String(v),
      eq: (a, b) => a === b
    };
  }
  if (typeof defaultValue === 'boolean') {
    return {
      parse: v => (v === null || v === '' ? null : v === 'true'),
      serialize: v => String(v),
      eq: (a, b) => a === b
    };
  }
  if (isHexColor(defaultValue)) {
    return {
      parse: v => (v === null || v === '' ? null : `#${v}`),
      serialize: v => v.replace(/^#/, ''),
      eq: (a, b) => a === b
    };
  }
  return {
    parse: v => (v === null || v === '' ? null : v),
    serialize: v => String(v),
    eq: (a, b) => a === b
  };
};

export function useComponentProps(defaultProps) {
  const defaultPropsRef = useRef(defaultProps);
  const { colorMode } = useColorMode();
  const lightProps = useMemo(() => getBackgroundLightProps(), []);

  const effectiveDefaultProps = useMemo(
    () => (colorMode === 'light' && lightProps ? { ...defaultPropsRef.current, ...lightProps } : defaultPropsRef.current),
    [colorMode, lightProps]
  );

  const parsers = useMemo(() => {
    const result = {};
    for (const [key, defaultValue] of Object.entries(defaultPropsRef.current)) {
      result[key] = createParser(defaultValue);
    }
    return result;
  }, []);

  const [queryState, setQueryState] = useQueryStates(parsers);

  const props = useMemo(() => {
    const merged = { ...effectiveDefaultProps };
    for (const [key, value] of Object.entries(queryState)) {
      if (value !== null) {
        merged[key] = value;
      }
    }
    return merged;
  }, [effectiveDefaultProps, queryState]);

  const hasChanges = useMemo(() => {
    return Object.values(queryState).some(v => v !== null);
  }, [queryState]);

  const updateProp = useCallback(
    (name, value) => {
      const newValue = value === effectiveDefaultProps[name] ? null : value;
      setQueryState({ [name]: newValue });
    },
    [effectiveDefaultProps, setQueryState]
  );

  const updateProps = useCallback(
    updates => {
      const newState = {};
      for (const [name, value] of Object.entries(updates)) {
        newState[name] = value === effectiveDefaultProps[name] ? null : value;
      }
      setQueryState(newState);
    },
    [effectiveDefaultProps, setQueryState]
  );

  const resetProps = useCallback(() => {
    const resetState = {};
    for (const key of Object.keys(defaultPropsRef.current)) {
      resetState[key] = null;
    }
    setQueryState(resetState);
  }, [setQueryState]);

  const getShareUrl = useCallback(() => {
    return window.location.href;
  }, []);

  return {
    props,
    defaultProps: effectiveDefaultProps,
    updateProp,
    updateProps,
    resetProps,
    hasChanges,
    getShareUrl
  };
}

export default useComponentProps;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1091** (2026-09-19): **[BUG]: Crtwarp section is unavailable**
  *Symptoms*: ### Describe the issue  <img width="1920" height="1039" alt="Image" src="https://github.com/user-attachments/assets/a54c78ba-2d58-4a23-80b4-034d033434f9" />  ### Reproduction Link  _No response_  ### Steps to reproduce  go to https://reactbits.dev/get-started/index  click here ->  <img width="1117" height="754" alt="Image" src="https://github.com/user-attachments/assets/bc3de2c4-4c77-4546-b0e6-82db89776d69" />  ### Validations  - [x] I have checked other issues to see if my issue was already reported or addressed
  **Post-Mortem & Fix Analysis**:
  > Which link sends you here?  The correct URL is:  https://reactbits.dev/backgrounds/crt-warp  
  > Yeah, but if you go to [https://reactbits.dev/get-started/index](https://reactbits.dev/get-started/index) and click it, it redirects you to a different URL. fixed -> https://github.com/DavidHDev/react-bits/pull/1092  

- **Issue #1089** (2026-09-18): **[BUG]: Glide Select micro interaction feels a bit odd**
  *Symptoms*: ### Describe the issue  When we move out of modal, either it should close or hover state stay where user left, instead it moves to top by default, making it look a bit laggy and odd, we can either close it going out of focus or keep hover state on user active state  https://github.com/user-attachments/assets/e45f6920-f657-4a9a-a977-85e681fea645  ### Reproduction Link  _No response_  ### Steps to reproduce  go to: https://reactbits.dev/c/micro/glide-select and try to hover on 3-4 item and come out of modal, it will move to top again  ### Validations  - [x] I have checked other issues to see if my issue was already reported or addressed
  **Post-Mortem & Fix Analysis**:
  > If you are okay, i can solve this very easily
  > Thanks for flagging this, I just pushed a fix

- **Issue #1087** (2026-09-18): **[BUG]: Showcase link sent me to a fake Apple support page — please remove it**
  *Symptoms*: ### Describe the issue  I clicked the Deepraj / CardSwap card on the React Bits showcase page and ended up on a fake Apple support site.  It filled my screen, kept playing spoken warnings telling me my Mac was in danger, and urged me to call a phone number. Chrome became unresponsive, and I eventually had to close and restart it. This honestly scared me — I thought my computer had been infected. I wasn't expecting this from a link featured on the official showcase.  This happened on September 16, 2026. The card links to architech-dev[.]tech. My browser history showed redirects through cf.neat-slate[.]site and myhealthyjoys[.]com, ending on a page titled “MacBook Security & Protection”.  Could you take this entry down while checking what happened to the destination? Someone else could end up calling that number.  The entry is in src/constants/Showcase.js. I don't know who currently controls the external domain. I've written the suspicious domains with [.] to avoid making them clickable.  Thanks for looking into this.  <img width="2548" height="1478" alt="Image" src="https://github.com/user-attachments/assets/80f6cb17-d16c-4c00-ac91-f14b0eee52a8" />  <img width="1183" height="578" alt="Image" src="https://github.com/user-attachments/assets/f9f9bd28-6e9b-4060-b0e6-8b43f06a1c14" />  ### Reproduction Link  _No response_  ### Steps to reproduce  Observed on September 16, 2026:  1. Opened https://reactbits.dev/showcase. 2. Clicked the Deepraj / CardSwap showcase card. 3. Was redirec

- **Issue #1066** (2026-09-10): **[BUG]: Decrypted Text Visibility**
  *Symptoms*: ### Describe the issue  For TS and JS component, the reference text is not being hidden (srOnly)  It should be fixed by adding  visibility: 'hidden' to srOnly style  ### Reproduction Link  _No response_  ### Steps to reproduce  -  ### Validations  - [x] I have checked other issues to see if my issue was already reported or addressed

- **Issue #1062** (2026-09-11): **[BUG]: TextLoop separator overlaps letters because default text already contains the separator**
  *Symptoms*: ### Describe the issue  On the TextLoop component, one of the ✦ separators occasionally lands on top of a letter instead of sitting cleanly between repetitions.  I noticed this bug while using Firefox on my system. It is visible on the wave shape. You usually have to wait a few seconds for it to appear. Chromium-based browsers often do not show the problem.  ### Root cause  The default props are:  text = 'React ✦ Bits' separator = '✦'  When uppercase is true, the text becomes "REACT ✦ BITS". The component then appends another separator:  const gap = separator ? `\u00A0${separator}\u00A0` : '\u00A0\u00A0\u00A0'; return `${base}${gap}`;  So the actual string that gets repeated is:  REACT ✦ BITS ✦ REACT ✦ BITS ✦ ...  Having the separator character both inside the phrase and as the joining character breaks the text measurement + textLength / lengthAdjust calculation on the SVG path in stricter browsers (like Firefox).  <img width="1073" height="465" alt="Image" src="https://github.com/user-attachments/assets/90bf077f-5699-4703-9d66-512d9db0b9a1" />  <img width="187" height="96" alt="Image" src="https://github.com/user-attachments/assets/c6fd7bcf-a5cc-4139-9330-aebb3642b330" />  ### Reproduction Link  https://reactbits.dev/text-animations/text-loop  ### Steps to reproduce  ### Steps to reproduce 1. Open https://reactbits.dev/text-animations/text-loop on firefox 2. Wait a few seconds and watch the wave animation — one of the ✦ characters will land on top of a letter (usually the “R
  **Post-Mortem & Fix Analysis**:
  > Following this one, would be great to see it addressed.

- **Issue #1057** (2026-08-31): **[BUG]: incorrect installation command for SpecularButton ("npm i ogl")**
  *Symptoms*: ### Describe the issue  ### Description On the SpecularButton documentation page, selecting any package manager shows an incorrect install command with duplicate `npm i` prefixes (e.g. `npm install npm i ogl` or `pnpm add npm i ogl`).  https://github.com/user-attachments/assets/dfdc45b6-51ec-4038-a1d6-e8fe7a25c7f6  ### Location `src/constants/code/Components/specularButtonCode.js` (line 8)  ### Proposed Fix Change `'npm i ogl'` to `'ogl'` in `dependencyList`.  ### Reproduction Link  _No response_  ### Steps to reproduce  1. Go to the [Specular Button](https://reactbits.dev/components/specular-button) component page. 2. Look at the "Install" section where the command is displayed. 3. Switch between package managers (npm, pnpm, yarn, bun). 4. Notice that all commands incorrectly include duplicate `npm i` prefixes (e.g. `pnpm add npm i ogl` or `npm install npm i ogl`).  ### Validations  - [x] I have checked other issues to see if my issue was already reported or addressed

- **Issue #1049** (2026-08-29): **[BUG]: Error: "Unexpected token (1:0)" when trying to install @react-bits/Lanyard-JS-CSS via shadcn CLI**
  *Symptoms*: ### Describe the issue  I'm encountering a persistent error when attempting to add the @react-bits/Lanyard-JS-CSS component using the shadcn CLI. The installation fails with an "Unexpected token (1:0)" error across multiple versions of the CLI.  ### Reproduction Link  _No response_  ### Steps to reproduce  Run the following command in a Next.js/React project:  bash npx shadcn@4.18.0 add @react-bits/Lanyard-JS-CSS Observe the error:  text ✔ Checking registry. ⠼ Updating files.  Something went wrong. Please check the error below for more details. If the problem persists, please open an issue on GitHub.  Unexpected token (1:0) Tried downgrading to previous versions as suggested:  bash npx shadcn@4.17.0 add @react-bits/Lanyard-JS-CSS npx shadcn@4.16.0 add @react-bits/Lanyard-JS-CSS All attempts resulted in the same error.  Expected Behavior The component should install successfully via the shadcn CLI.  Actual Behavior Installation fails with "Unexpected token (1:0)" error. The process gets stuck at "Updating files" before failing.  Environment OS: Windows (PowerShell)  Node Version: [Add your Node version]  Package Manager: npm  Project: Next.js/React portfolio project  shadcn CLI Versions Attempted: 4.18.0, 4.17.0, 4.16.0  Additional Context Running in PowerShell (PS C:\Users\eyob\portfolio>)  The CLI successfully checks the registry but fails during file updates  The error message suggests it might be a parsing issue with the component files  Possible Cause The "Unexpected toke
  **Post-Mortem & Fix Analysis**:
  > Resolved by the registry stylesheet fix in #1053. I reran the exact command `npx shadcn@4.18.0 add @react-bits/Lanyard-JS-CSS` against the current registry; it completes successfully and creates both `Lanyard.css` and `Lanyard.jsx`.

- **Issue #1044** (2026-08-14): **[BUG]: ShapeBlur: Changing prop values causes canvas flickering**
  *Symptoms*: ### Describe the issue  Changing control values (`shapeSize`, `roundness`, `borderSize`, `circleSize`, `circleEdge`, `pixelRatioProp`) on the `ShapeBlur` component (such as dragging preview sliders in the demo) causes a noticeable flickering effect  ### Reproduction Link  _No response_  ### Steps to reproduce  1. Navigate to the **Shape Blur** component demo. 2. Interact with any control slider (e.g., `Shape Size`, `Roundness`, or `Border Size`). 3. Drag the slider continuously. 4. **Observe**: The canvas flashes/flickers rapidly  ### Validations  - [x] I have checked other issues to see if my issue was already reported or addressed

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

### Incident Patch 1: `ca44b3f9` (2026-10-03)
**Commit Message**: Merge pull request #1093 from xiehuanyi/feat/fix-masonry-media-listener-cleanup

**File**: `public/r/Masonry-JS-CSS.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry.jsx",
-			"content": "'use client';\n\nimport { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nimport './Masonry.css';\n\nconst useMedia = (queries, values, defaultValue) => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = () => {\n  const ref = useRef(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size];\n};\n\nconst preloadImages = async urls => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\nconst Masonry = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = item => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n\n    if (animateFrom === 'random') {\n      const directions = ['top', 'bottom', 'left', 'right'];\n      direction = directions[Math.floor(Math.random() * directions.length)];\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo(() => {\n    if (!width) return [];\n\n    const colHeights = new Array(columns).fill(0);\n    const columnWidth = width / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = columnWidth * col;\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height;\n\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animationProps = {\n        x: item.x,\n        y: item.y,\n        width: item.w,\n        height: item.h\n      };\n\n      if (!hasMounted.current) {\n        const initialPos = getInitialPosition(item, index);\n        const initialState = {\n          opacity: 0,\n          x: initialPos.x,\n          y: initialPos.y,\n          width: item.w,\n          height: item.h,\n          ...(blurToFocus && { filter: 'blur(10px)' })\n        };\n\n        gsap.fromTo(selector, initialState, {\n          opacity: 1,\n          ...animationProps,\n          ...(blurToFocus && { filter: 'blur(0px)' }),\n          duration: 0.8,\n          ease: 'power3.out',\n          delay: index * stagger\n        });\n      } else {\n        gsap.to(selector, {\n          ...animationProps,\n          duration: duration,\n          ease: ease,\n          overwrite: 'auto'\n        });\n      }\n    });\n\n    hasMounted.current = true;\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);\n\n  const handleMouseEnter = (e, item) => {\n    const element = e.currentTarget;\n    const select
```

**File**: `public/r/Masonry-JS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry/Masonry.jsx",
-			"content": "'use client';\n\nimport { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nconst useMedia = (queries, values, defaultValue) => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = () => {\n  const ref = useRef(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size];\n};\n\nconst preloadImages = async urls => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\nconst Masonry = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = item => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n    if (animateFrom === 'random') {\n      const dirs = ['top', 'bottom', 'left', 'right'];\n      direction = dirs[Math.floor(Math.random() * dirs.length)];\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo(() => {\n    if (!width) return [];\n    const colHeights = new Array(columns).fill(0);\n    const gap = 16;\n    const totalGaps = (columns - 1) * gap;\n    const columnWidth = (width - totalGaps) / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = col * (columnWidth + gap);\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height + gap;\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };\n\n      if (!hasMounted.current) {\n        const start = getInitialPosition(item);\n        gsap.fromTo(\n          selector,\n          {\n            opacity: 0,\n            x: start.x,\n            y: start.y,\n            width: item.w,\n            height: item.h,\n            ...(blurToFocus && { filter: 'blur(10px)' })\n          },\n          {\n            opacity: 1,\n            ...animProps,\n            ...(blurToFocus && { filter: 'blur(0px)' }),\n            duration: 0.8,\n            ease: 'power3.out',\n            delay: index * stagger\n          }\n        );\n      } else {\n        gsap.to(selector, {\n          ...animProps,\n          duration,\n          ease,\n          overwrite: 'auto'\n        });\n      }\n    });\n\n    hasMounted.current = true;\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);\n\n  const handleMouseEnter = (id, element) => {\n    if (scaleOnHover) {\n      gsap.to(`[data-key=\"${id}\"]`, {\n      
```

**File**: `public/r/Masonry-TS-CSS.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry.tsx",
-			"content": "'use client';\n\nimport React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nimport './Masonry.css';\n\nconst useMedia = (queries: string[], values: number[], defaultValue: number): number => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState<number>(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = <T extends HTMLElement>() => {\n  const ref = useRef<T | null>(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size] as const;\n};\n\nconst preloadImages = async (urls: string[]): Promise<void> => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise<void>(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\ninterface Item {\n  id: string;\n  img: string;\n  url: string;\n  height: number;\n}\n\ninterface GridItem extends Item {\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n}\n\ninterface MasonryProps {\n  items: Item[];\n  ease?: string;\n  duration?: number;\n  stagger?: number;\n  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random';\n  scaleOnHover?: boolean;\n  hoverScale?: number;\n  blurToFocus?: boolean;\n  colorShiftOnHover?: boolean;\n}\n\nconst Masonry: React.FC<MasonryProps> = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure<HTMLDivElement>();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = (item: GridItem) => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n\n    if (animateFrom === 'random') {\n      const directions = ['top', 'bottom', 'left', 'right'];\n      direction = directions[Math.floor(Math.random() * directions.length)] as typeof animateFrom;\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo<GridItem[]>(() => {\n    if (!width) return [];\n\n    const colHeights = new Array(columns).fill(0);\n    const columnWidth = width / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = columnWidth * col;\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height;\n\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animationProps = {\n        x: item.x,\n        y: item.y,\n        width: item.w,\n        height: item.h\n      };\n\n      if (!hasMounted.current) {\n        const initialPos = getInitialPosition(item);\n        const initialState = {\n          opacity: 0,\n          x: initialPos.x,\n          y: initialPos.y,\n          width: item.w,\n          height: item.h,\n          ...(blurToFocus && { filter: 'blur(10px)' })\n        };\n\n        gsap.fromTo(selector, initialState, {\n          opacity: 1,\n          ...animationProps,
```

**File**: `public/r/Masonry-TS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry/Masonry.tsx",
-			"content": "'use client';\n\nimport React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nconst useMedia = (queries: string[], values: number[], defaultValue: number): number => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState<number>(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = <T extends HTMLElement>() => {\n  const ref = useRef<T | null>(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size] as const;\n};\n\nconst preloadImages = async (urls: string[]): Promise<void> => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise<void>(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\ninterface Item {\n  id: string;\n  img: string;\n  url: string;\n  height: number;\n}\n\ninterface GridItem extends Item {\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n}\n\ninterface MasonryProps {\n  items: Item[];\n  ease?: string;\n  duration?: number;\n  stagger?: number;\n  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random';\n  scaleOnHover?: boolean;\n  hoverScale?: number;\n  blurToFocus?: boolean;\n  colorShiftOnHover?: boolean;\n}\n\nconst Masonry: React.FC<MasonryProps> = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure<HTMLDivElement>();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = (item: GridItem) => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n    if (animateFrom === 'random') {\n      const dirs = ['top', 'bottom', 'left', 'right'];\n      direction = dirs[Math.floor(Math.random() * dirs.length)] as typeof animateFrom;\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo<GridItem[]>(() => {\n    if (!width) return [];\n    const colHeights = new Array(columns).fill(0);\n    const gap = 16;\n    const totalGaps = (columns - 1) * gap;\n    const columnWidth = (width - totalGaps) / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = col * (columnWidth + gap);\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height + gap;\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };\n\n      if (!hasMounted.current) {\n        const start = getInitialPosition(item);\n        gsap.fromTo(\n          selector,\n          {\n            opacity: 0,\n            x: start.x,\n            y: start.y,\n            width: item.w,\n            height: item.h,\n            ...(blurToFocus && { filter: 'blur(10px)' })\n          },\n          {\n            opacity: 1,\n            ...animProps,\n            
```

**File**: `src/content/Components/Masonry/Masonry.jsx` (modified, +3/-2)
```diff
@@ -14,9 +14,10 @@ const useMedia = (queries, values, defaultValue) => {
   const [value, setValue] = useState(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [queries]);
 
```

**File**: `src/tailwind/Components/Masonry/Masonry.jsx` (modified, +3/-2)
```diff
@@ -12,9 +12,10 @@ const useMedia = (queries, values, defaultValue) => {
   const [value, setValue] = useState(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [queries]);
 
```

**File**: `src/ts-default/Components/Masonry/Masonry.tsx` (modified, +3/-2)
```diff
@@ -14,9 +14,10 @@ const useMedia = (queries: string[], values: number[], defaultValue: number): nu
   const [value, setValue] = useState<number>(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
   }, [queries]);
 
   return value;
```

**File**: `src/ts-tailwind/Components/Masonry/Masonry.tsx` (modified, +3/-2)
```diff
@@ -12,9 +12,10 @@ const useMedia = (queries: string[], values: number[], defaultValue: number): nu
   const [value, setValue] = useState<number>(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
   }, [queries]);
 
   return value;
```

---

### Incident Patch 2: `3c00d4ed` (2026-10-02)
**Commit Message**: fix(Masonry): resolve registry conflicts with current main

**File**: `.claude/launch.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "version": "0.0.1",
+  "configurations": [
+    {
+      "name": "react-bits-vite",
+      "runtimeExecutable": "npx",
+      "runtimeArgs": ["vite", "--port", "5174", "--strictPort"],
+      "port": 5174
+    }
+  ]
+}
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ We welcome pull requests from everyone as long as they respect the quality stand
 2. Make your changes in the new branch.
 3. Submit a pull request to the main repository's `main` branch.
 4. Provide a clear and descriptive title for your pull request, along with a detailed description of the changes you have made, and screenshots/videos where possible.
-5. For components updates, ensure that changes are reflected in all related files. Each component change must be updated in all 4 variants of that particular component.
+5. For components updates, ensure that changes are reflected in all related files. Each component change must be updated in all 4 variants of that particular component. If the change is something users would notice (a fix, a new prop), also add `{ date, note }` to the component's `updates` array in `src/constants/Information.js` so it shows up on the changelog.
 6. Before you open a pull request, please make sure that your changes are tested locally, and everything looks good on desktop and mobile, also check the browser console for errors, and so on, so that we can keep this library at the highest quality possible. Run `npm run check:prop-docs` after changing defaults or prop tables; the production build also runs this check. It compares scalar component defaults across all four variants and their documentation. Run `npm run test:prop-docs` when editing the checker, and extend its parser for new declaration patterns instead of silently skipping them.
 7. Any pull requests that fail to meet these requirements will be denied, so please make sure you respect them so that your work can go through.
 
```

**File**: `README.md` (modified, +8/-0)
```diff
@@ -103,6 +103,14 @@ React Bits is proudly supported by these amazing sponsors:
   </picture>
 </a>
 
+<a href="https://shadcnstudio.com/?utm_source=reactbits&utm_medium=sponsor&utm_campaign=silver&ref=reactbits" target="_blank">
+  <picture>
+    <source media="(prefers-color-scheme: dark)" srcset="public/assets/sponsors/shadcnstudio.svg">
+    <source media="(prefers-color-scheme: light)" srcset="public/assets/sponsors/shadcnstudio-lightmode.svg">
+    <img src="public/assets/sponsors/shadcnstudio.svg" alt="Shadcn Studio" style="height: 40px;">
+  </picture>
+</a>
+
 <hr />
 
 **[Become a sponsor](https://reactbits.dev/sponsors)** — Get your brand in front of 500K+ developers monthly.
```

**File**: `index.html` (modified, +6/-5)
```diff
@@ -51,6 +51,7 @@
     <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
     <meta name="apple-mobile-web-app-title" content="React Bits" />
     <link rel="manifest" href="/site.webmanifest" />
+    <link rel="alternate" type="application/rss+xml" title="React Bits changelog" href="https://reactbits.dev/rss.xml" />
 
     <!-- Open Graph (OG) - Facebook, LinkedIn, etc. -->
     <meta property="og:type" content="website" />
@@ -59,8 +60,8 @@
       property="og:description"
       content="An open source collection of 200+ high quality, animated, interactive & fully customizable React components and micro interactions for building stunning, memorable user interfaces."
     />
-    <meta property="og:image" content="https://reactbits.dev/og.png" />
-    <meta property="og:image:alt" content="The React Bits landing page design, showcasing the logo and a subtitle!" />
+    <meta property="og:image" content="https://reactbits.dev/og.jpg" />
+    <meta property="og:image:alt" content="React Bits: React components that stand out. 200+ free creative components." />
     <meta property="og:image:width" content="1200" />
     <meta property="og:image:height" content="630" />
     <meta property="og:url" content="https://reactbits.dev" />
@@ -76,8 +77,8 @@
       name="twitter:description"
       content="An open source collection of 200+ high quality, animated, interactive & fully customizable React components and micro interactions for building stunning, memorable user interfaces."
     />
-    <meta name="twitter:image" content="https://reactbits.dev/og.png" />
-    <meta name="twitter:image:alt" content="The React Bits landing page design, showcasing the logo and a subtitle!" />
+    <meta name="twitter:image" content="https://reactbits.dev/og.jpg" />
+    <meta name="twitter:image:alt" content="React Bits: React components that stand out. 200+ free creative components." />
 
     <!-- Robots Meta Tag (canonical is set per-route by usePageSEO) -->
     <meta name="robots" content="index, follow" />
@@ -90,7 +91,7 @@
         "name": "React Bits",
         "url": "https://reactbits.dev",
         "description": "An open source collection of 200+ high quality, animated, interactive & fully customizable React components and micro interactions for building stunning, memorable user interfaces.",
-        "image": "https://reactbits.dev/og.png",
+        "image": "https://reactbits.dev/og.jpg",
         "sameAs": [
           "https://github.com/DavidHDev/react-bits",
           "https://x.com/davidhaz"
```

**File**: `package.json` (modified, +5/-2)
```diff
@@ -5,12 +5,15 @@
   "type": "module",
   "scripts": {
     "dev": "concurrently -n \"registry,docs\" -c \"blue,green\" \"npm run registry:dev\" \"vite\"",
-    "build": "npm run check:prop-docs && npm run registry:build && npm run llms:text && npm run sitemap && vite build",
+    "build": "npm run check:prop-docs && npm run registry:build && npm run llms:text && npm run sitemap && npm run rss && vite build && npm run og:routes",
     "new:component": "node scripts/generateComponent.js",
     "llms:text": "node ./scripts/generateLlmsText.js",
     "sitemap": "node ./scripts/generateSitemap.js",
+    "rss": "node ./scripts/generateRss.js",
+    "og:images": "node ./scripts/generateOgImages.js",
+    "og:routes": "node ./scripts/generateRouteMeta.js",
     "registry:build": "jsrepo build",
-    "registry:dev": "jsrepo build --watch",
+    "registry:dev": "node ./scripts/watchRegistry.js",
     "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
     "format": "prettier --write .",
     "check:prop-docs": "node scripts/checkPropDocs.js",
```

**File**: `public/assets/sponsors/shadcnstudio-lightmode.svg` (modified, +11/-10)
```diff
@@ -1,11 +1,12 @@
-<svg width="3721" height="675" viewBox="0 0 3721 675" fill="none" xmlns="http://www.w3.org/2000/svg">
-<path d="M595.302 339.707C595.302 175.319 462.039 42.0562 297.651 42.0562C133.263 42.0562 0 175.319 0 339.707C0 504.095 133.263 637.358 297.651 637.358C462.039 637.358 595.302 504.095 595.302 339.707Z" fill="black"/>
-<path d="M299.547 172.384V282.134C299.547 318.219 270.294 347.472 234.209 347.472H127.51" stroke="white" stroke-width="36.2989"/>
-<path d="M302.447 522.554V412.804C302.447 376.72 331.699 347.466 367.785 347.466H474.484" stroke="white" stroke-width="36.2989"/>
-<path d="M432.259 220.516L357.164 294.726" stroke="white" stroke-width="36.2989"/>
-<path d="M246.34 405.876L171.246 480.085" stroke="white" stroke-width="36.2989"/>
-<path d="M242.692 290.747L168.039 216.094" stroke="white" stroke-width="36.2989"/>
-<path d="M431.426 480.018L356.773 405.366" stroke="white" stroke-width="36.2989"/>
-<path d="M844.215 286.581C834.266 286.581 825.114 285.089 816.757 282.105C808.401 279.12 801.238 274.942 795.269 269.57C789.3 263.999 784.723 257.532 781.54 250.17L810.49 237.337C813.474 242.908 817.852 247.584 823.622 251.364C829.591 255.145 836.157 257.035 843.319 257.035C851.079 257.035 857.247 255.741 861.823 253.155C866.599 250.369 868.986 246.589 868.986 241.814C868.986 237.237 867.196 233.755 863.614 231.368C860.033 228.781 854.959 226.692 848.393 225.1L834.366 221.221C820.239 217.639 809.196 211.969 801.238 204.209C793.279 196.25 789.3 187.197 789.3 177.05C789.3 162.127 794.075 150.587 803.625 142.429C813.375 134.272 827.303 130.193 845.409 130.193C854.561 130.193 862.918 131.586 870.478 134.371C878.238 136.958 884.904 140.738 890.475 145.712C896.046 150.488 899.926 156.158 902.114 162.724L874.358 175.259C872.369 170.285 868.588 166.504 863.017 163.918C857.446 161.132 851.278 159.74 844.513 159.74C837.748 159.74 832.476 161.232 828.695 164.216C824.915 167.002 823.025 170.981 823.025 176.154C823.025 179.139 824.716 181.924 828.098 184.511C831.481 186.899 836.356 188.888 842.722 190.48L860.331 194.658C870.081 197.046 878.039 200.826 884.207 205.999C890.375 210.974 894.952 216.644 897.936 223.011C900.921 229.179 902.413 235.447 902.413 241.814C902.413 250.767 899.826 258.626 894.653 265.391C889.679 272.156 882.814 277.429 874.06 281.209C865.305 284.791 855.357 286.581 844.215 286.581ZM929.22 283V74.0839H962.646V283H929.22ZM1030.39 283V206.596H1063.82V283H1030.39ZM1030.39 206.596C1030.39 194.658 1029 185.506 1026.22 179.139C1023.43 172.573 1019.55 167.997 1014.58 165.41C1009.8 162.824 1004.23 161.53 997.864 161.53C986.523 161.331 977.768 165.012 971.6 172.573C965.631 180.134 962.646 190.977 962.646 205.104H949.813C949.813 189.386 952.101 175.955 956.677 164.813C961.453 153.472 968.118 144.916 976.674 139.146C985.229 133.177 995.377 130.193 1007.12 130.193C1018.85 130.193 1029 132.58 1037.56 137.356C1046.11 142.131 1052.58 149.592 1056.96 159.74C1061.53 169.688 1063.82 182.72 1063.82 198.837V206.596H1030.39ZM1188.7 283L1187.21 254.946V206.298C1187.21 196.151 1186.12 187.694 1183.93 180.93C1181.94 173.966 1178.56 168.693 1173.78 165.112C1169.2 161.331 1163.04 159.441 1155.28 159.441C1148.11 159.441 1141.85 160.933 1136.47 163.918C1131.1 166.902 1126.53 171.578 1122.74 177.945L1093.5 167.201C1096.68 160.635 1100.86 154.566 1106.03 148.995C1111.4 143.225 1118.07 138.649 1126.03 135.266C1134.19 131.884 1143.93 130.193 1155.28 130.193C1169.8 130.193 1181.94 133.078 1191.69 138.848C1201.44 144.419 1208.6 152.477 1213.18 163.022C1217.95 173.568 1220.34 186.302 1220.34 201.224L1219.44 283H1188.7ZM1145.73 286.581C1127.82 286.581 1113.89 282.602 1103.94 274.643C1094.19 266.685 1089.32 255.443 1089.32 240.918C1089.32 225.399 1094.49 213.56 1104.84 205.403C1115.38 197.245 1130.01 193.166 1148.71 193.166H1188.7V218.833H1159.45C1146.12 218.833 1136.77 220.723 1131.4 224.503C1126.03 228.085 1123.34 233.258 1123.34 240.023C1123.34 245.793 1125.63 250.369 1130.21 253.752C1134.98 256.935 1141.55 258.527 1149.9 258.527C1157.46 258.527 1164.03 256.836 1169.6 253.453C1175.17 250.071 1179.45 245.594 1182.43 240.023C1185.62 234.452 1187.21 228.184 1187.21 221.221H1197.06C1197.06 241.515 1192.98 257.532 1184.82 269.271C1176.66 280.811 1163.63 286.581 1145.73 286.581ZM1361.93 283L1360.44 255.244V74.0839H1393.56V283H1361.93ZM1313.28 286.581C1299.75 286.581 1287.91 283.398 1277.76 277.031C1267.82 270.465 1259.96 261.313 1254.19 249.573C1248.62 237.834 1245.83 224.106 1245.83 208.387C1245.83 192.47 1248.62 178.741 1254.19 167.201C1259.96 155.462 1267.82 146.409 1277.76 140.042C1287.91 133.476 1299.75 130.193 1313.28 130.193C1325.82 130.193 1336.56 133.476 1345.51 140.042C1354.67 146.409 1361.63 155.462 1366.4 167.201C1371.18 178.741 1373.57 192.47 1373.57 208.387C1373.57 224.106 1371.18 237.834 1366.4 249.573C1361.63 261.313 1354.67 270.465 1345.51 277.031C1336.56 283.398 1325.82 286.581 1313.28 286.581ZM1321.64 256.139C1329.2 256.139 1335.86 254.15 1341.63 250.17C1347.6 245.992 1352.18 240.321 1355.36 233.159C13
```

**File**: `public/assets/sponsors/shadcnstudio.svg` (modified, +11/-10)
```diff
@@ -1,11 +1,12 @@
-<svg width="3721" height="675" viewBox="0 0 3721 675" fill="none" xmlns="http://www.w3.org/2000/svg">
-<path d="M595.302 339.707C595.302 175.319 462.039 42.0562 297.651 42.0562C133.263 42.0562 0 175.319 0 339.707C0 504.095 133.263 637.358 297.651 637.358C462.039 637.358 595.302 504.095 595.302 339.707Z" fill="white"/>
-<path d="M299.547 172.384V282.134C299.547 318.219 270.294 347.472 234.209 347.472H127.51" stroke="black" stroke-width="36.2989"/>
-<path d="M302.447 522.554V412.804C302.447 376.72 331.699 347.466 367.785 347.466H474.484" stroke="black" stroke-width="36.2989"/>
-<path d="M432.259 220.516L357.164 294.726" stroke="black" stroke-width="36.2989"/>
-<path d="M246.34 405.876L171.246 480.085" stroke="black" stroke-width="36.2989"/>
-<path d="M242.692 290.747L168.039 216.094" stroke="black" stroke-width="36.2989"/>
-<path d="M431.426 480.018L356.773 405.366" stroke="black" stroke-width="36.2989"/>
-<path d="M844.215 286.581C834.266 286.581 825.114 285.089 816.757 282.105C808.401 279.12 801.238 274.942 795.269 269.57C789.3 263.999 784.723 257.532 781.54 250.17L810.49 237.337C813.474 242.908 817.852 247.584 823.622 251.364C829.591 255.145 836.157 257.035 843.319 257.035C851.079 257.035 857.247 255.741 861.823 253.155C866.599 250.369 868.986 246.589 868.986 241.814C868.986 237.237 867.196 233.755 863.614 231.368C860.033 228.781 854.959 226.692 848.393 225.1L834.366 221.221C820.239 217.639 809.196 211.969 801.238 204.209C793.279 196.25 789.3 187.197 789.3 177.05C789.3 162.127 794.075 150.587 803.625 142.429C813.375 134.272 827.303 130.193 845.409 130.193C854.561 130.193 862.918 131.586 870.478 134.371C878.238 136.958 884.904 140.738 890.475 145.712C896.046 150.488 899.926 156.158 902.114 162.724L874.358 175.259C872.369 170.285 868.588 166.504 863.017 163.918C857.446 161.132 851.278 159.74 844.513 159.74C837.748 159.74 832.476 161.232 828.695 164.216C824.915 167.002 823.025 170.981 823.025 176.154C823.025 179.139 824.716 181.924 828.098 184.511C831.481 186.899 836.356 188.888 842.722 190.48L860.331 194.658C870.081 197.046 878.039 200.826 884.207 205.999C890.375 210.974 894.952 216.644 897.936 223.011C900.921 229.179 902.413 235.447 902.413 241.814C902.413 250.767 899.826 258.626 894.653 265.391C889.679 272.156 882.814 277.429 874.06 281.209C865.305 284.791 855.357 286.581 844.215 286.581ZM929.22 283V74.0839H962.646V283H929.22ZM1030.39 283V206.596H1063.82V283H1030.39ZM1030.39 206.596C1030.39 194.658 1029 185.506 1026.22 179.139C1023.43 172.573 1019.55 167.997 1014.58 165.41C1009.8 162.824 1004.23 161.53 997.864 161.53C986.523 161.331 977.768 165.012 971.6 172.573C965.631 180.134 962.646 190.977 962.646 205.104H949.813C949.813 189.386 952.101 175.955 956.677 164.813C961.453 153.472 968.118 144.916 976.674 139.146C985.229 133.177 995.377 130.193 1007.12 130.193C1018.85 130.193 1029 132.58 1037.56 137.356C1046.11 142.131 1052.58 149.592 1056.96 159.74C1061.53 169.688 1063.82 182.72 1063.82 198.837V206.596H1030.39ZM1188.7 283L1187.21 254.946V206.298C1187.21 196.151 1186.12 187.694 1183.93 180.93C1181.94 173.966 1178.56 168.693 1173.78 165.112C1169.2 161.331 1163.04 159.441 1155.28 159.441C1148.11 159.441 1141.85 160.933 1136.47 163.918C1131.1 166.902 1126.53 171.578 1122.74 177.945L1093.5 167.201C1096.68 160.635 1100.86 154.566 1106.03 148.995C1111.4 143.225 1118.07 138.649 1126.03 135.266C1134.19 131.884 1143.93 130.193 1155.28 130.193C1169.8 130.193 1181.94 133.078 1191.69 138.848C1201.44 144.419 1208.6 152.477 1213.18 163.022C1217.95 173.568 1220.34 186.302 1220.34 201.224L1219.44 283H1188.7ZM1145.73 286.581C1127.82 286.581 1113.89 282.602 1103.94 274.643C1094.19 266.685 1089.32 255.443 1089.32 240.918C1089.32 225.399 1094.49 213.56 1104.84 205.403C1115.38 197.245 1130.01 193.166 1148.71 193.166H1188.7V218.833H1159.45C1146.12 218.833 1136.77 220.723 1131.4 224.503C1126.03 228.085 1123.34 233.258 1123.34 240.023C1123.34 245.793 1125.63 250.369 1130.21 253.752C1134.98 256.935 1141.55 258.527 1149.9 258.527C1157.46 258.527 1164.03 256.836 1169.6 253.453C1175.17 250.071 1179.45 245.594 1182.43 240.023C1185.62 234.452 1187.21 228.184 1187.21 221.221H1197.06C1197.06 241.515 1192.98 257.532 1184.82 269.271C1176.66 280.811 1163.63 286.581 1145.73 286.581ZM1361.93 283L1360.44 255.244V74.0839H1393.56V283H1361.93ZM1313.28 286.581C1299.75 286.581 1287.91 283.398 1277.76 277.031C1267.82 270.465 1259.96 261.313 1254.19 249.573C1248.62 237.834 1245.83 224.106 1245.83 208.387C1245.83 192.47 1248.62 178.741 1254.19 167.201C1259.96 155.462 1267.82 146.409 1277.76 140.042C1287.91 133.476 1299.75 130.193 1313.28 130.193C1325.82 130.193 1336.56 133.476 1345.51 140.042C1354.67 146.409 1361.63 155.462 1366.4 167.201C1371.18 178.741 1373.57 192.47 1373.57 208.387C1373.57 224.106 1371.18 237.834 1366.4 249.573C1361.63 261.313 1354.67 270.465 1345.51 277.031C1336.56 283.398 1325.82 286.581 1313.28 286.581ZM1321.64 256.139C1329.2 256.139 1335.86 254.15 1341.63 250.17C1347.6 245.992 1352.18 240.321 1355.36 233.159C13
```

**File**: `public/llms.txt` (modified, +40/-2)
```diff
@@ -1,10 +1,10 @@
 # React Bits
 
-> React Bits is an open source collection of memorable UI elements - Components, Animations, Backgrounds, and Text Animations - provided in four implementation variants: JavaScript + CSS, JavaScript + Tailwind, TypeScript + CSS, and TypeScript + Tailwind. Components are copy-friendly and installable via CLI (jsrepo or shadcn).
+> React Bits is an open source collection of memorable UI elements - Components, Animations, Backgrounds, Text Animations, and Micro interactions - provided in four implementation variants: JavaScript + CSS, JavaScript + Tailwind, TypeScript + CSS, and TypeScript + Tailwind. Components are copy-friendly and installable via CLI (jsrepo or shadcn).
 
 Important notes for agents:
 
-- Components are organized by semantics first: UI Components, Animations, Backgrounds, Text Animations.
+- Components are organized by semantics first: UI Components, Animations, Backgrounds, Text Animations, Micro (small, satisfying micro-interactions such as switches, buttons and loaders).
 - Each component has 4 variants. All variants are kept in sync when updated.
 - Dependencies vary by component (e.g., gsap, motion, three, ogl). Always check and install dependencies before usage.
 - Everything on reactbits.dev is free and open source. There is a separate paid library, React Bits Pro, covering page blocks, application UI, templates and agent skills - see the React Bits Pro sections below.
@@ -58,6 +58,7 @@ Notes:
 - [Split Flap Text](https://www.reactbits.dev/text-animations/split-flap-text): Mechanical split-flap departure board that clacks through to each new phrase. CLI: `SplitFlapText`.
 - [Split Text](https://www.reactbits.dev/text-animations/split-text): Splits text into characters / words for staggered entrance animation. CLI: `SplitText`.
 - [Stroke Text](https://www.reactbits.dev/text-animations/stroke-text): Outlined letterforms draw themselves on, then flood with fill. CLI: `StrokeText`.
+- [Tech Text](https://www.reactbits.dev/text-animations/tech-text): A wordmark whose letters turn into dashed vector paths under the cursor. Grab any letter to drag it off the baseline and it springs back home. CLI: `TechText`.
 - [Text Cursor](https://www.reactbits.dev/text-animations/text-cursor): Make any text element follow your cursor, leaving a trail of copies behind it. CLI: `TextCursor`.
 - [Text Loop](https://www.reactbits.dev/text-animations/text-loop): A seamless text marquee that flows along curved SVG paths. CLI: `TextLoop`.
 - [Text Pressure](https://www.reactbits.dev/text-animations/text-pressure): Characters scale / warp interactively based on pointer pressure zone. CLI: `TextPressure`.
@@ -75,8 +76,10 @@ Notes:
 - [Crosshair](https://www.reactbits.dev/animations/crosshair): Custom crosshair cursor with tracking, and link hover effects. CLI: `Crosshair`.
 - [Cubes](https://www.reactbits.dev/animations/cubes): 3D rotating cube cluster. Supports auto-rotation or hover interaction. CLI: `Cubes`.
 - [Cursor Grid](https://www.reactbits.dev/animations/cursor-grid): Canvas grid whose cells light up around the cursor with configurable radius, falloff and click pulses. CLI: `CursorGrid`.
+- [Dither Veil](https://www.reactbits.dev/animations/dither-veil): A photo printed as a 1-bit dither that the cursor burns through to full colour, leaving a trail that knits back cell by cell. CLI: `DitherVeil`.
 - [Elastic Mesh](https://www.reactbits.dev/animations/elastic-mesh): Spring-mesh surface that stretches under the pointer and settles back with damped physics. CLI: `ElasticMesh`.
 - [Electric Border](https://www.reactbits.dev/animations/electric-border): Jittery electric energy border with animated arcs, glow and adjustable intensity. CLI: `ElectricBorder`.
+- [Electric Logo](https://www.reactbits.dev/animations/electric-logo): Turns any SVG or PNG into a living lightning outline, with flowing strands, arcs that leap off the edges and a charge that follows the cursor. CLI: `ElectricLogo`.
 - [Fade Content](https://www.reactbits.dev/animations/fade-content): Simple directional fade / slide entrance / exit wrapper with threshold-based activation. CLI: `FadeContent`.
 - [Ghost Cursor](https://www.reactbits.dev/animations/ghost-cursor): Semi-transparent ghost cursor that smoothly follows the real cursor with a trailing effect. CLI: `GhostCursor`.
 - [Glare Hover](https://www.reactbits.dev/animations/glare-hover): Adds a realistic moving glare highlight on hover over any element. CLI: `GlareHover`.
@@ -127,6 +130,7 @@ Notes:
 - [Dome Gallery](https://www.reactbits.dev/components/dome-gallery): Immersive 3D dome gallery projecting images on a hemispheric surface. CLI: `DomeGallery`.
 - [Drift Wall](https://www.reactbits.dev/components/drift-wall): An endless perspective wall of tiles drifting past, lifting on hover. CLI: `DriftWall`.
 - [Elastic Slider](https://www.reactbits.dev/components/elastic-slider): Slider handle stretches elastically then snaps with spring physics. CLI: 
```

---

### Incident Patch 3: `4d6a46d3` (2026-10-02)
**Commit Message**: Merge pull request #1098 from DavidHDev/copilot/fix-shadcn-cli-install-command

**File**: `src/components/context/ActiveRouteContext/ActiveRouteContext.jsx` (modified, +3/-19)
```diff
@@ -1,29 +1,13 @@
 /* eslint-disable react-refresh/only-export-components */
-import { createContext, useEffect, useMemo, useState } from 'react';
+import { createContext, useMemo } from 'react';
 import { useLocation } from 'react-router-dom';
+import { getActiveRoute } from '../../../utils/activeRoute';
 
 export const ActiveRouteContext = createContext();
 
 export const ActiveRouteProvider = ({ children }) => {
   const location = useLocation();
-  const [category, setCategory] = useState(null);
-  const [subcategory, setSubcategory] = useState(null);
-
-  useEffect(() => {
-    const parts = location.pathname.split('/');
-    if (parts.length >= 3 && parts[1] && parts[2]) {
-      setCategory(parts[1]);
-      setSubcategory(parts[2]);
-    } else {
-      setCategory(null);
-      setSubcategory(null);
-    }
-  }, [location.pathname]);
-
-  const value = useMemo(
-    () => ({ category, subcategory, isCategoryRoute: !!(category && subcategory) }),
-    [category, subcategory]
-  );
+  const value = useMemo(() => getActiveRoute(location.pathname), [location.pathname]);
 
   return <ActiveRouteContext.Provider value={value}>{children}</ActiveRouteContext.Provider>;
 };
```

**File**: `src/utils/activeRoute.js` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+export const getActiveRoute = pathname => {
+  const parts = pathname.split('/');
+  const offset = parts[1] === 'c' ? 2 : 1;
+  const category = parts[offset] || null;
+  const subcategory = parts[offset + 1] || null;
+
+  if (!category || !subcategory) return { category: null, subcategory: null, isCategoryRoute: false };
+
+  return { category, subcategory, isCategoryRoute: true };
+};
```

**File**: `src/utils/activeRoute.test.js` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/* eslint-env node */
+import assert from 'node:assert/strict';
+import test from 'node:test';
+import { getActiveRoute } from './activeRoute.js';
+import { generateCliCommands } from './cli.js';
+
+test('reads component routes with and without the /c prefix', () => {
+  for (const prefix of ['', '/c']) {
+    for (const suffix of ['', '/']) {
+      assert.deepEqual(getActiveRoute(`${prefix}/text-animations/tech-text${suffix}`), {
+        category: 'text-animations',
+        subcategory: 'tech-text',
+        isCategoryRoute: true
+      });
+    }
+  }
+});
+
+test('does not treat category index or single-segment routes as component routes', () => {
+  for (const pathname of ['/', '/favorites', '/text-animations', '/c', '/c/text-animations', '/c/text-animations/']) {
+    assert.deepEqual(getActiveRoute(pathname), {
+      category: null,
+      subcategory: null,
+      isCategoryRoute: false
+    });
+  }
+});
+
+test('generates component CLI commands for every selected stack on both route formats', () => {
+  const runners = { pnpm: 'pnpm dlx', npx: 'npx', yarn: 'yarn', bun: 'bun x --bun' };
+  for (const prefix of ['', '/c']) {
+    for (const [categorySlug, componentSlug, componentName] of [
+      ['text-animations', 'tech-text', 'TechText'],
+      ['backgrounds', 'aurora', 'Aurora']
+    ]) {
+      const { category, subcategory } = getActiveRoute(`${prefix}/${categorySlug}/${componentSlug}`);
+      for (const language of ['JS', 'TS']) {
+        for (const style of ['CSS', 'Tailwind']) {
+          const variant = `${language}-${style === 'Tailwind' ? 'TW' : 'CSS'}`;
+          const commands = generateCliCommands(language, style, category, subcategory);
+          for (const [manager, runner] of Object.entries(runners)) {
+            assert.equal(
+              commands.shadcn[manager],
+              `${runner} shadcn@latest add @react-bits/${componentName}-${variant}`
+            );
+            assert.equal(
+              commands.jsrepo[manager],
+              `${runner} jsrepo@latest add https://reactbits.dev/r/${componentName}-${variant}`
+            );
+          }
+        }
+      }
+    }
+  }
+});
```

---

### Incident Patch 4: `d1543c6d` (2026-10-02)
**Commit Message**: Fix component CLI commands on prefixed documentation routes

Co-authored-by: DavidHDev <[REDACTED_EMAIL]>

**File**: `src/components/context/ActiveRouteContext/ActiveRouteContext.jsx` (modified, +3/-19)
```diff
@@ -1,29 +1,13 @@
 /* eslint-disable react-refresh/only-export-components */
-import { createContext, useEffect, useMemo, useState } from 'react';
+import { createContext, useMemo } from 'react';
 import { useLocation } from 'react-router-dom';
+import { getActiveRoute } from '../../../utils/activeRoute';
 
 export const ActiveRouteContext = createContext();
 
 export const ActiveRouteProvider = ({ children }) => {
   const location = useLocation();
-  const [category, setCategory] = useState(null);
-  const [subcategory, setSubcategory] = useState(null);
-
-  useEffect(() => {
-    const parts = location.pathname.split('/');
-    if (parts.length >= 3 && parts[1] && parts[2]) {
-      setCategory(parts[1]);
-      setSubcategory(parts[2]);
-    } else {
-      setCategory(null);
-      setSubcategory(null);
-    }
-  }, [location.pathname]);
-
-  const value = useMemo(
-    () => ({ category, subcategory, isCategoryRoute: !!(category && subcategory) }),
-    [category, subcategory]
-  );
+  const value = useMemo(() => getActiveRoute(location.pathname), [location.pathname]);
 
   return <ActiveRouteContext.Provider value={value}>{children}</ActiveRouteContext.Provider>;
 };
```

**File**: `src/utils/activeRoute.js` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+export const getActiveRoute = pathname => {
+  const parts = pathname.split('/');
+  const offset = parts[1] === 'c' ? 2 : 1;
+  const category = parts[offset] || null;
+  const subcategory = parts[offset + 1] || null;
+
+  if (!category || !subcategory) return { category: null, subcategory: null, isCategoryRoute: false };
+
+  return { category, subcategory, isCategoryRoute: true };
+};
```

**File**: `src/utils/activeRoute.test.js` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+/* eslint-env node */
+import assert from 'node:assert/strict';
+import test from 'node:test';
+import { getActiveRoute } from './activeRoute.js';
+import { generateCliCommands } from './cli.js';
+
+test('reads component routes with and without the /c prefix', () => {
+  for (const prefix of ['', '/c']) {
+    for (const suffix of ['', '/']) {
+      assert.deepEqual(getActiveRoute(`${prefix}/text-animations/tech-text${suffix}`), {
+        category: 'text-animations',
+        subcategory: 'tech-text',
+        isCategoryRoute: true
+      });
+    }
+  }
+});
+
+test('does not treat category index or single-segment routes as component routes', () => {
+  for (const pathname of ['/', '/favorites', '/text-animations', '/c', '/c/text-animations', '/c/text-animations/']) {
+    assert.deepEqual(getActiveRoute(pathname), {
+      category: null,
+      subcategory: null,
+      isCategoryRoute: false
+    });
+  }
+});
+
+test('generates component CLI commands for every selected stack on both route formats', () => {
+  const runners = { pnpm: 'pnpm dlx', npx: 'npx', yarn: 'yarn', bun: 'bun x --bun' };
+  for (const prefix of ['', '/c']) {
+    for (const [categorySlug, componentSlug, componentName] of [
+      ['text-animations', 'tech-text', 'TechText'],
+      ['backgrounds', 'aurora', 'Aurora']
+    ]) {
+      const { category, subcategory } = getActiveRoute(`${prefix}/${categorySlug}/${componentSlug}`);
+      for (const language of ['JS', 'TS']) {
+        for (const style of ['CSS', 'Tailwind']) {
+          const variant = `${language}-${style === 'Tailwind' ? 'TW' : 'CSS'}`;
+          const commands = generateCliCommands(language, style, category, subcategory);
+          for (const [manager, runner] of Object.entries(runners)) {
+            assert.equal(
+              commands.shadcn[manager],
+              `${runner} shadcn@latest add @react-bits/${componentName}-${variant}`
+            );
+            assert.equal(
+              commands.jsrepo[manager],
+              `${runner} jsrepo@latest add https://reactbits.dev/r/${componentName}-${variant}`
+            );
+          }
+        }
+      }
+    }
+  }
+});
```

---

### Incident Patch 5: `61fa2537` (2026-09-28)
**Commit Message**: Rebuild 404 glass as independently scattered fragments

**File**: `src/components/common/NotFound/glassGeometry.js` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ export const createShardGeometry = shard => {
     steps: 1,
     bevelEnabled: true,
     bevelThickness: BEVEL_THICKNESS,
-    bevelSize: 0.45,
+    bevelSize: 0.75,
     bevelSegments: 8,
     curveSegments: 1
   });
```

**File**: `src/components/common/NotFound/glassScene.js` (modified, +111/-84)
```diff
@@ -1,10 +1,9 @@
 import {
   CanvasTexture,
   Color,
-  EquirectangularReflectionMapping,
   LinearFilter,
   Mesh,
-  MeshBasicMaterial,
+  MeshLambertMaterial,
   MeshPhysicalMaterial,
   NoToneMapping,
   PerspectiveCamera,
@@ -19,42 +18,95 @@ import { PANE_HEIGHT, PANE_WIDTH, SHARDS } from './shardGeometry';
 import { createShardGeometry } from './glassGeometry';
 import { createShardMotion, stepShardMotion } from './shardMotion';
 
-// Broad studio softboxes give clear glass something to reflect. A narrow strip
-// catches the fractured bevels as they turn, without drawing artificial outlines.
-const createEnvironment = renderer => {
-  const canvas = document.createElement('canvas');
-  canvas.width = 1024;
-  canvas.height = 512;
-  const context = canvas.getContext('2d');
-  context.fillStyle = '#6a6a6a';
-  context.fillRect(0, 0, 1024, 512);
-  const softbox = (x, y, rx, ry, color) => {
-    context.save();
-    context.translate(x, y);
-    context.scale(rx, ry);
-    const gradient = context.createRadialGradient(0, 0, 0.08, 0, 0, 1);
-    gradient.addColorStop(0, color);
-    gradient.addColorStop(0.4, color);
-    gradient.addColorStop(1, 'rgba(16, 16, 16, 0)');
-    context.fillStyle = gradient;
-    context.fillRect(-1, -1, 2, 2);
-    context.restore();
+// The front hemisphere stays dim so the faces remain clear. Grazing cut walls
+// reflect the rear hemisphere; broad rear cards reveal their thickness while
+// the smaller, brighter strips give them moving white catchlights.
+const createEnvironment = (renderer, light) => {
+  const studio = new Scene();
+  studio.background = new Color().setRGB(0.035, 0.035, 0.035);
+  const cards = [];
+  // The softbox has a narrow luminous core and gradual falloff across both
+  // axes. Its reflection changes across a bevel instead of filling it with a
+  // uniform gray band. A separate broad reflector preserves edge visibility.
+  const softboxCanvas = document.createElement('canvas');
+  softboxCanvas.width = 128;
+  softboxCanvas.height = 256;
+  const softboxContext = softboxCanvas.getContext('2d');
+  const softboxPixels = softboxContext.createImageData(128, 256);
+  for (let y = 0; y < 256; y++) {
+    for (let x = 0; x < 128; x++) {
+      const across = (x / 127 - 0.5) * 2;
+      const along = (y / 255 - 0.5) * 2;
+      const radiance = Math.exp(-3.4 * across * across) * Math.exp(-Math.pow(along / 0.94, 8));
+      const offset = (y * 128 + x) * 4;
+      const value = Math.round(255 * radiance);
+      softboxPixels.data.set([value, value, value, 255], offset);
+    }
+  }
+  softboxContext.putImageData(softboxPixels, 0, 0);
+  const softboxMap = new CanvasTexture(softboxCanvas);
+  const reflectorCanvas = document.createElement('canvas');
+  reflectorCanvas.width = 256;
+  reflectorCanvas.height = 256;
+  const reflectorContext = reflectorCanvas.getContext('2d');
+  const reflectorGradient = reflectorContext.createLinearGradient(0, 240, 230, 15);
+  reflectorGradient.addColorStop(0, '#464646');
+  reflectorGradient.addColorStop(0.35, '#8b8b8b');
+  reflectorGradient.addColorStop(0.68, '#ededed');
+  reflectorGradient.addColorStop(1, '#939393');
+  reflectorContext.fillStyle = reflectorGradient;
+  reflectorContext.fillRect(0, 0, 256, 256);
+  const reflectorMap = new CanvasTexture(reflectorCanvas);
+  const lightCard = (position, width, height, intensity, roll = 0, map = softboxMap) => {
+    const card = new Mesh(
+      new PlaneGeometry(width, height),
+      new MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: intensity, emissiveMap: map })
+    );
+    card.position.set(...position);
+    card.lookAt(0, 0, 0);
+    card.rotateZ(roll);
+    studio.add(card);
+    cards.push(card);
   };
-  softbox(240, 160, 135, 85, '#ababab');
-  softbox(740, 260, 38, 210, '#fafafa');
-  softbox(520, 420, 220, 55, '#525252');
-  const texture = new CanvasTexture(canvas);
-  texture.mapping = EquirectangularReflectionMapping;
-  texture.colorSpace = SRGBColorSpace;
+  lightCard([0, 0, -8], 19, 15, light ? 0.2 : 1.6, 0, reflectorMap);
+  lightCard([-5.5, 1, -5], 1.5, 10, 10, -0.2);
+  lightCard([5.5, -2, -5], 1.2, 11, 14, 0.25);
+  lightCard([-6, 2, 1], 4, 12, 0.35, -0.1);
+  lightCard([6, 1, 1.5], 4, 12, 0.45, 0.2);
+  lightCard([-5.8, 2.2, 1.5], 0.55, 9, 8, -0.1);
+  lightCard([5.8, 1.2, 2], 0.5, 9, 11, 0.2);
+  lightCard([-5, 5, 4], 5.5, 1.8, 0.65, -0.3);
+  lightCard([-4, -5, 1], 5, 0.65, 8, -0.5);
   const generator = new PMREMGenerator(renderer);
-  const environment = generator.fromEquirectangular(texture);
-  texture.dispose();
+  const environment = generator.fromScene(studio, 0, 0.1, 30, { size: 512 });
+  cards.forEach(card => {
+    card.geometry.dispose();
+    card.material.dispose();
+  });
+  softboxMap.dispose();
+  reflectorMap.dispose();
   generator.dispose();
   return environment;
 };
 
-// A reflected view ray intersects the live electric canvas above the glass.
-// Every tilted fragment catches a di
```

**File**: `src/components/common/NotFound/shardGeometry.js` (modified, +94/-141)
```diff
@@ -1,158 +1,111 @@
 export const PANE_WIDTH = 760;
 export const PANE_HEIGHT = 440;
 
-const clip = (polygon, nx, ny, limit) => {
-  const result = [];
-  for (let index = 0; index < polygon.length; index++) {
-    const a = polygon[index];
-    const b = polygon[(index + 1) % polygon.length];
-    const da = a.x * nx + a.y * ny - limit;
-    const db = b.x * nx + b.y * ny - limit;
-    if (da <= 0) result.push(a);
-    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
-      const t = da / (da - db);
-      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
-    }
-  }
-  return result;
-};
-
-const area = polygon =>
-  Math.abs(
-    polygon.reduce((sum, point, index) => {
-      const next = polygon[(index + 1) % polygon.length];
-      return sum + point.x * next.y - next.x * point.y;
-    }, 0) / 2
-  );
-const span = polygon => Math.max(...polygon.flatMap(a => polygon.map(b => Math.hypot(a.x - b.x, a.y - b.y))));
-const center = polygon => ({
-  x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
-  y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
-});
+const TAU = Math.PI * 2;
+const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
 
-const inset = (polygon, margin) => {
-  let result = polygon;
-  polygon.forEach((a, index) => {
-    const b = polygon[(index + 1) % polygon.length];
-    const length = Math.hypot(b.x - a.x, b.y - a.y);
-    const nx = (b.y - a.y) / length;
-    const ny = (a.x - b.x) / length;
-    result = clip(result, nx, ny, a.x * nx + a.y * ny - margin);
-  });
-  return result;
-};
-
-const minimumAngle = polygon =>
-  Math.min(
-    ...polygon.map((point, index) => {
-      const a = polygon[(index + polygon.length - 1) % polygon.length];
-      const b = polygon[(index + 1) % polygon.length];
-      const ax = a.x - point.x;
-      const ay = a.y - point.y;
-      const bx = b.x - point.x;
-      const by = b.y - point.y;
-      return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)))));
-    })
-  );
-
-// Tiny clipped tips soften the silhouette without turning the fragments into
-// rounded tiles. All points remain inside their original fracture cell.
-const softenTips = polygon =>
-  polygon.flatMap((point, index) => {
-    const previous = polygon[(index + polygon.length - 1) % polygon.length];
-    const next = polygon[(index + 1) % polygon.length];
-    const cut = Math.min(
-      2.4,
-      Math.hypot(previous.x - point.x, previous.y - point.y) * 0.1,
-      Math.hypot(next.x - point.x, next.y - point.y) * 0.1
-    );
-    return [previous, next].map(neighbor => {
-      const ratio = cut / Math.hypot(neighbor.x - point.x, neighbor.y - point.y);
-      return { x: point.x + (neighbor.x - point.x) * ratio, y: point.y + (neighbor.y - point.y) * ratio };
+const hull = points => {
+  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
+  const half = list => {
+    const result = [];
+    list.forEach(point => {
+      while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
+      result.push(point);
     });
-  });
-
-const targetArea = polygon => {
-  const point = center(polygon);
-  const radius = Math.min(1, Math.hypot((point.x - 380) / 380, (point.y - 220) / 220));
-  return 850 + 8500 * (1 - radius) ** 1.45;
+    return result;
+  };
+  return [...half(sorted).slice(0, -1), ...half([...sorted].reverse()).slice(0, -1)];
 };
 
 const createShards = () => {
-  let seed = 404;
-  const random = () => {
+  let seed = 4821;
+  const random = (min = 0, max = 1) => {
     seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
-    return seed / 4294967296;
+    return min + (seed / 4294967296) * (max - min);
   };
-  const between = (min, max) => min + random() * (max - min);
-  const cells = [
-    {
-      polygon: [
-        [0, 217],
-        [57, 77],
-        [219, 16],
-        [474, 0],
-        [675, 64],
-        [760, 212],
-        [693, 366],
-        [466, 440],
-        [238, 398],
-        [70, 339]
-      ].map(([x, y]) => ({ x, y })),
-      complete: false
+  const shards = [];
+
+  // Each fragment is placed independently. Conservative circular clearances
+  // leave room for arbitrary in-plane rotation and the separate spring motion.
+  for (let index = 0; index < 56; index++) {
+    const large = index < 12;
+    const chip = index >= 30;
+    let placement;
+    for (let attempt = 0; attempt < 1800; attempt++) {
+      const px = random(-350, 350);
+      const py = random(-203, 203);
+      const radial = Math.hypot(px / 380, py / 220);
+      if (radial > 0.96 || radial < (large ? 0.4 : chip ? 0.48 : 0.25)) continue;
+      const radius = chip ? random(5, 10) : (large ? 64 - radial * 28 : 32 - radial * 16) * random(0.78, 1.18);
+      if (shards.some(shard => Math.hypot(px - shard.px, py - shard.py) < (radius + shard.radius) * 1.08 + 14))
+        continue;
+      placem
```

**File**: `src/components/common/NotFound/shardMotion.js` (modified, +9/-6)
```diff
@@ -8,15 +8,18 @@ export const createShardMotion = (shard, index) => {
     seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
     return min + (seed / 4294967296) * (max - min);
   };
-  const x = shard.x + shard.width / 2 - PANE_WIDTH / 2;
-  const y = PANE_HEIGHT / 2 - shard.y - shard.height / 2;
+  // Compensate the resting position for perspective so depth doesn't collapse
+  // the independently scattered screen-space clearances.
+  const perspective = 1 - shard.z / 1400;
+  const x = (shard.x + shard.width / 2 - PANE_WIDTH / 2) * perspective;
+  const y = (PANE_HEIGHT / 2 - shard.y - shard.height / 2) * perspective;
   return {
     x,
     y,
-    z: random(-4, 4),
-    rx: (y - 65) * 0.00045 + random(-0.2, 0.2),
-    ry: -x * 0.00045 + random(-0.24, 0.24),
-    rz: random(-0.045, 0.045),
+    z: shard.z,
+    rx: shard.tiltX,
+    ry: shard.tiltY,
+    rz: shard.turn,
     mobility: Math.min(1, Math.sqrt(shard.width * shard.height) / 100),
     phase: random(0, TAU),
     frequency: TAU / random(22, 36),
```

**File**: `src/css/not-found.css` (modified, +4/-4)
```diff
@@ -45,10 +45,10 @@
   --nf-shard-outer-mask: radial-gradient(
     ellipse 50% 50% at 50% 50%,
     #000 0%,
-    #000 54%,
-    rgb(0 0 0 / 0.85) 68%,
-    rgb(0 0 0 / 0.48) 82%,
-    rgb(0 0 0 / 0.16) 93%,
+    #000 58%,
+    rgb(0 0 0 / 0.94) 72%,
+    rgb(0 0 0 / 0.64) 84%,
+    rgb(0 0 0 / 0.25) 94%,
     transparent 100%
   );
   -webkit-mask-image: var(--nf-shard-outer-mask);
```

---

### Incident Patch 6: `0cb75b89` (2026-09-28)
**Commit Message**: Render 404 shards as physical glass with live electric reflections

**File**: `public/r/ElectricLogo-JS-CSS.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 		{
 			"type": "registry:component",
 			"path": "ElectricLogo.jsx",
-			"content": "'use client';\n\nimport { useEffect, useRef } from 'react';\nimport { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';\n\nimport './ElectricLogo.css';\n\nconst BOLT = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(\n  '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\"><path d=\"M39 3 12 37h17l-4 24 27-34H35z\" fill=\"#fff\"/></svg>'\n)}`;\nconst RASTER = 560;\nconst CELL = 4;\nconst FAR = 1e20;\nconst ARCS = 5;\nconst PULSES = 3;\nconst PIXEL_BUDGET = 4e6;\n\nconst hexToRgb = hex => {\n  let h = String(hex || '').replace('#', '');\n  if (h.length === 3) h = h.replace(/./g, c => c + c);\n  const n = parseInt(h.slice(0, 6), 16);\n  return Number.isNaN(n) ? [1, 1, 1] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n};\n\nconst transformLine = (f, d, v, z, n) => {\n  let k = 0;\n  v[0] = 0;\n  z[0] = -FAR;\n  z[1] = FAR;\n  for (let q = 1; q < n; q++) {\n    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    while (s <= z[k]) {\n      k--;\n      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    }\n    k++;\n    v[k] = q;\n    z[k] = s;\n    z[k + 1] = FAR;\n  }\n  k = 0;\n  for (let q = 0; q < n; q++) {\n    while (z[k + 1] < q) k++;\n    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];\n  }\n};\n\nconst transformGrid = (grid, w, h) => {\n  const n = Math.max(w, h);\n  const f = new Float64Array(n);\n  const d = new Float64Array(n);\n  const v = new Int32Array(n);\n  const z = new Float64Array(n + 1);\n  for (let x = 0; x < w; x++) {\n    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];\n    transformLine(f, d, v, z, h);\n    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];\n  }\n  for (let y = 0; y < h; y++) {\n    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];\n    transformLine(f, d, v, z, w);\n    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];\n  }\n};\n\nconst blurLine = (src, dst, offset, stride, n, r) => {\n  const scale = 1 / (2 * r + 1);\n  let sum = 0;\n  for (let i = 0; i <= r && i < n; i++) sum += src[offset + i * stride];\n  for (let i = 0; i < n; i++) {\n    dst[offset + i * stride] = sum * scale;\n    if (i + r + 1 < n) sum += src[offset + (i + r + 1) * stride];\n    if (i - r >= 0) sum -= src[offset + (i - r) * stride];\n  }\n};\n\nconst blurGrid = (grid, w, h, r) => {\n  const tmp = new Float32Array(w * h);\n  for (let pass = 0; pass < 3; pass++) {\n    for (let y = 0; y < h; y++) blurLine(grid, tmp, y * w, 1, w, r);\n    for (let x = 0; x < w; x++) blurLine(tmp, grid, x, w, h, r);\n  }\n};\n\nconst readCoverage = (data, w, h) => {\n  const coverage = new Float32Array(w * h);\n  let clear = 0;\n  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 250) clear++;\n  if (clear > w * h * 0.01) {\n    for (let i = 0; i < w * h; i++) coverage[i] = data[i * 4 + 3] / 255;\n    return coverage;\n  }\n  let r = 0;\n  let g = 0;\n  let b = 0;\n  let n = 0;\n  const sample = i => {\n    r += data[i * 4];\n    g += data[i * 4 + 1];\n    b += data[i * 4 + 2];\n    n++;\n  };\n  for (let x = 0; x < w; x++) {\n    sample(x);\n    sample((h - 1) * w + x);\n  }\n  for (let y = 0; y < h; y++) {\n    sample(y * w);\n    sample(y * w + w - 1);\n  }\n  r /= n;\n  g /= n;\n  b /= n;\n  for (let i = 0; i < w * h; i++) {\n    const diff = Math.max(Math.abs(data[i * 4] - r), Math.abs(data[i * 4 + 1] - g), Math.abs(data[i * 4 + 2] - b));\n    coverage[i] = Math.min(1, Math.max(0, (diff - 24) / 48));\n  }\n  return coverage;\n};\n\nconst sampleField = (shape, x, y) => {\n  const { field, width, height } = shape;\n  const cx = Math.min(Math.max(x, 0.5), width - 0.5);\n  const cy = Math.min(Math.max(y, 0.5), height - 0.5);\n  const x0 = Math.min(Math.floor(cx - 0.5), width - 2);\n  const y0 = Math.min(Math.floor(cy - 0.5), height - 2);\n  const tx = cx - 0.5 - x0;\n  const ty = cy - 0.5 - y0;\n  const i = y0 * width + x0;\n  const top = field[i] + (field[i + 1] - field[i]) * tx;\n  const bottom = field[i + width] + (field[i + width + 1] - field[i + width]) * tx;\n  return top + (bottom - top) * ty + Math.hypot(x - cx, y - cy);\n};\n\nconst traceShape = image => {\n  const iw = image.naturalWidth || image.width;\n  const ih = image.naturalHeight || image.height;\n  if (!iw || !ih) return null;\n  const fit = RASTER / Math.max(iw, ih);\n  const w = Math.max(2, Math.round(iw * fit));\n  const h = Math.max(2, Math.round(ih * fit));\n  const canvas = document.createElement('canvas');\n  canvas.width = w;\n  canvas.height = h;\n  const ctx = canvas.getContext('2d', { willReadFrequently: true });\n  if (!ctx) return null;\n  ctx.drawImage(image, 0, 0, w, h);\n  const coverage = readCoverage(ctx.getImageData(0, 0, w, h).data, w, h);\n\n  let left = w;\n  let top = h;\n  let right = -1;\n  let bottom = -1;\n  for (let y = 0; y < h; y++) {\n    for (let x = 0; x < w; x++) {\n      if (coverage[y
```

**File**: `public/r/ElectricLogo-JS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "ElectricLogo/ElectricLogo.jsx",
-			"content": "'use client';\n\nimport { useEffect, useRef } from 'react';\nimport { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';\n\nconst BOLT = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(\n  '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\"><path d=\"M39 3 12 37h17l-4 24 27-34H35z\" fill=\"#fff\"/></svg>'\n)}`;\nconst RASTER = 560;\nconst CELL = 4;\nconst FAR = 1e20;\nconst ARCS = 5;\nconst PULSES = 3;\nconst PIXEL_BUDGET = 4e6;\n\nconst hexToRgb = hex => {\n  let h = String(hex || '').replace('#', '');\n  if (h.length === 3) h = h.replace(/./g, c => c + c);\n  const n = parseInt(h.slice(0, 6), 16);\n  return Number.isNaN(n) ? [1, 1, 1] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n};\n\nconst transformLine = (f, d, v, z, n) => {\n  let k = 0;\n  v[0] = 0;\n  z[0] = -FAR;\n  z[1] = FAR;\n  for (let q = 1; q < n; q++) {\n    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    while (s <= z[k]) {\n      k--;\n      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    }\n    k++;\n    v[k] = q;\n    z[k] = s;\n    z[k + 1] = FAR;\n  }\n  k = 0;\n  for (let q = 0; q < n; q++) {\n    while (z[k + 1] < q) k++;\n    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];\n  }\n};\n\nconst transformGrid = (grid, w, h) => {\n  const n = Math.max(w, h);\n  const f = new Float64Array(n);\n  const d = new Float64Array(n);\n  const v = new Int32Array(n);\n  const z = new Float64Array(n + 1);\n  for (let x = 0; x < w; x++) {\n    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];\n    transformLine(f, d, v, z, h);\n    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];\n  }\n  for (let y = 0; y < h; y++) {\n    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];\n    transformLine(f, d, v, z, w);\n    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];\n  }\n};\n\nconst blurLine = (src, dst, offset, stride, n, r) => {\n  const scale = 1 / (2 * r + 1);\n  let sum = 0;\n  for (let i = 0; i <= r && i < n; i++) sum += src[offset + i * stride];\n  for (let i = 0; i < n; i++) {\n    dst[offset + i * stride] = sum * scale;\n    if (i + r + 1 < n) sum += src[offset + (i + r + 1) * stride];\n    if (i - r >= 0) sum -= src[offset + (i - r) * stride];\n  }\n};\n\nconst blurGrid = (grid, w, h, r) => {\n  const tmp = new Float32Array(w * h);\n  for (let pass = 0; pass < 3; pass++) {\n    for (let y = 0; y < h; y++) blurLine(grid, tmp, y * w, 1, w, r);\n    for (let x = 0; x < w; x++) blurLine(tmp, grid, x, w, h, r);\n  }\n};\n\nconst readCoverage = (data, w, h) => {\n  const coverage = new Float32Array(w * h);\n  let clear = 0;\n  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 250) clear++;\n  if (clear > w * h * 0.01) {\n    for (let i = 0; i < w * h; i++) coverage[i] = data[i * 4 + 3] / 255;\n    return coverage;\n  }\n  let r = 0;\n  let g = 0;\n  let b = 0;\n  let n = 0;\n  const sample = i => {\n    r += data[i * 4];\n    g += data[i * 4 + 1];\n    b += data[i * 4 + 2];\n    n++;\n  };\n  for (let x = 0; x < w; x++) {\n    sample(x);\n    sample((h - 1) * w + x);\n  }\n  for (let y = 0; y < h; y++) {\n    sample(y * w);\n    sample(y * w + w - 1);\n  }\n  r /= n;\n  g /= n;\n  b /= n;\n  for (let i = 0; i < w * h; i++) {\n    const diff = Math.max(Math.abs(data[i * 4] - r), Math.abs(data[i * 4 + 1] - g), Math.abs(data[i * 4 + 2] - b));\n    coverage[i] = Math.min(1, Math.max(0, (diff - 24) / 48));\n  }\n  return coverage;\n};\n\nconst sampleField = (shape, x, y) => {\n  const { field, width, height } = shape;\n  const cx = Math.min(Math.max(x, 0.5), width - 0.5);\n  const cy = Math.min(Math.max(y, 0.5), height - 0.5);\n  const x0 = Math.min(Math.floor(cx - 0.5), width - 2);\n  const y0 = Math.min(Math.floor(cy - 0.5), height - 2);\n  const tx = cx - 0.5 - x0;\n  const ty = cy - 0.5 - y0;\n  const i = y0 * width + x0;\n  const top = field[i] + (field[i + 1] - field[i]) * tx;\n  const bottom = field[i + width] + (field[i + width + 1] - field[i + width]) * tx;\n  return top + (bottom - top) * ty + Math.hypot(x - cx, y - cy);\n};\n\nconst traceShape = image => {\n  const iw = image.naturalWidth || image.width;\n  const ih = image.naturalHeight || image.height;\n  if (!iw || !ih) return null;\n  const fit = RASTER / Math.max(iw, ih);\n  const w = Math.max(2, Math.round(iw * fit));\n  const h = Math.max(2, Math.round(ih * fit));\n  const canvas = document.createElement('canvas');\n  canvas.width = w;\n  canvas.height = h;\n  const ctx = canvas.getContext('2d', { willReadFrequently: true });\n  if (!ctx) return null;\n  ctx.drawImage(image, 0, 0, w, h);\n  const coverage = readCoverage(ctx.getImageData(0, 0, w, h).data, w, h);\n\n  let left = w;\n  let top = h;\n  let right = -1;\n  let bottom = -1;\n  for (let y = 0; y < h; y++) {\n    for (let x = 0; x < w; x++) {\n      if (coverage[y * w + x] <= 0.01) co
```

**File**: `public/r/ElectricLogo-TS-CSS.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 		{
 			"type": "registry:component",
 			"path": "ElectricLogo.tsx",
-			"content": "'use client';\n\nimport { useEffect, useRef } from 'react';\nimport type { CSSProperties } from 'react';\nimport { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';\n\nimport './ElectricLogo.css';\n\nconst BOLT = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(\n  '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\"><path d=\"M39 3 12 37h17l-4 24 27-34H35z\" fill=\"#fff\"/></svg>'\n)}`;\nconst RASTER = 560;\nconst CELL = 4;\nconst FAR = 1e20;\nconst ARCS = 5;\nconst PULSES = 3;\nconst PIXEL_BUDGET = 4e6;\n\ntype Rgb = [number, number, number];\n\nexport interface ElectricLogoProps {\n  src?: string;\n  color?: string;\n  glowColor?: string;\n  scale?: number;\n  intensity?: number;\n  glow?: number;\n  thickness?: number;\n  strands?: number;\n  bend?: number;\n  crackle?: number;\n  arcs?: number;\n  flicker?: number;\n  fill?: number;\n  speed?: number;\n  interactive?: boolean;\n  cursorIntensity?: number;\n  cursorRadius?: number;\n  theme?: 'dark' | 'light';\n  className?: string;\n  style?: CSSProperties;\n}\n\ntype Settings = Required<Omit<ElectricLogoProps, 'src' | 'className' | 'style'>>;\n\ninterface Shape {\n  field: Float32Array;\n  edges: number[];\n  width: number;\n  height: number;\n  pad: number;\n  logoWidth: number;\n  logoHeight: number;\n  glow: Float32Array;\n  glowWidth: number;\n  glowHeight: number;\n  glowOffset: number;\n}\n\ninterface Slot {\n  shape: Shape | null;\n  field: Texture;\n  glow: Texture;\n}\n\ninterface Pulse {\n  x: number;\n  y: number;\n  born: number;\n}\n\ninterface Point {\n  x: number;\n  y: number;\n}\n\ninterface Focus {\n  x: number;\n  y: number;\n  radius: number;\n}\n\ninterface Spark {\n  ax: number;\n  ay: number;\n  bx: number;\n  by: number;\n  bow: number;\n  seed: number;\n  born: number;\n  life: number;\n}\n\nconst hexToRgb = (hex: string): Rgb => {\n  let h = String(hex || '').replace('#', '');\n  if (h.length === 3) h = h.replace(/./g, c => c + c);\n  const n = parseInt(h.slice(0, 6), 16);\n  return Number.isNaN(n) ? [1, 1, 1] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n};\n\nconst transformLine = (f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number) => {\n  let k = 0;\n  v[0] = 0;\n  z[0] = -FAR;\n  z[1] = FAR;\n  for (let q = 1; q < n; q++) {\n    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    while (s <= z[k]) {\n      k--;\n      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    }\n    k++;\n    v[k] = q;\n    z[k] = s;\n    z[k + 1] = FAR;\n  }\n  k = 0;\n  for (let q = 0; q < n; q++) {\n    while (z[k + 1] < q) k++;\n    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];\n  }\n};\n\nconst transformGrid = (grid: Float32Array, w: number, h: number) => {\n  const n = Math.max(w, h);\n  const f = new Float64Array(n);\n  const d = new Float64Array(n);\n  const v = new Int32Array(n);\n  const z = new Float64Array(n + 1);\n  for (let x = 0; x < w; x++) {\n    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];\n    transformLine(f, d, v, z, h);\n    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];\n  }\n  for (let y = 0; y < h; y++) {\n    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];\n    transformLine(f, d, v, z, w);\n    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];\n  }\n};\n\nconst blurLine = (src: Float32Array, dst: Float32Array, offset: number, stride: number, n: number, r: number) => {\n  const scale = 1 / (2 * r + 1);\n  let sum = 0;\n  for (let i = 0; i <= r && i < n; i++) sum += src[offset + i * stride];\n  for (let i = 0; i < n; i++) {\n    dst[offset + i * stride] = sum * scale;\n    if (i + r + 1 < n) sum += src[offset + (i + r + 1) * stride];\n    if (i - r >= 0) sum -= src[offset + (i - r) * stride];\n  }\n};\n\nconst blurGrid = (grid: Float32Array, w: number, h: number, r: number) => {\n  const tmp = new Float32Array(w * h);\n  for (let pass = 0; pass < 3; pass++) {\n    for (let y = 0; y < h; y++) blurLine(grid, tmp, y * w, 1, w, r);\n    for (let x = 0; x < w; x++) blurLine(tmp, grid, x, w, h, r);\n  }\n};\n\nconst readCoverage = (data: Uint8ClampedArray, w: number, h: number) => {\n  const coverage = new Float32Array(w * h);\n  let clear = 0;\n  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 250) clear++;\n  if (clear > w * h * 0.01) {\n    for (let i = 0; i < w * h; i++) coverage[i] = data[i * 4 + 3] / 255;\n    return coverage;\n  }\n  let r = 0;\n  let g = 0;\n  let b = 0;\n  let n = 0;\n  const sample = (i: number) => {\n    r += data[i * 4];\n    g += data[i * 4 + 1];\n    b += data[i * 4 + 2];\n    n++;\n  };\n  for (let x = 0; x < w; x++) {\n    sample(x);\n    sample((h - 1) * w + x);\n  }\n  for (let y = 0; y < h; y++) {\n    sample(y * w);\n    sample(y * w + w - 1);\n  }\n  r /= n;\n  g /= n;\n  b /= n;\n  for (let i = 0; i < w * h; i++) {\n    c
```

**File**: `public/r/ElectricLogo-TS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "ElectricLogo/ElectricLogo.tsx",
-			"content": "'use client';\n\nimport { useEffect, useRef } from 'react';\nimport type { CSSProperties } from 'react';\nimport { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';\n\nconst BOLT = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(\n  '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\" viewBox=\"0 0 64 64\"><path d=\"M39 3 12 37h17l-4 24 27-34H35z\" fill=\"#fff\"/></svg>'\n)}`;\nconst RASTER = 560;\nconst CELL = 4;\nconst FAR = 1e20;\nconst ARCS = 5;\nconst PULSES = 3;\nconst PIXEL_BUDGET = 4e6;\n\ntype Rgb = [number, number, number];\n\nexport interface ElectricLogoProps {\n  src?: string;\n  color?: string;\n  glowColor?: string;\n  scale?: number;\n  intensity?: number;\n  glow?: number;\n  thickness?: number;\n  strands?: number;\n  bend?: number;\n  crackle?: number;\n  arcs?: number;\n  flicker?: number;\n  fill?: number;\n  speed?: number;\n  interactive?: boolean;\n  cursorIntensity?: number;\n  cursorRadius?: number;\n  theme?: 'dark' | 'light';\n  className?: string;\n  style?: CSSProperties;\n}\n\ntype Settings = Required<Omit<ElectricLogoProps, 'src' | 'className' | 'style'>>;\n\ninterface Shape {\n  field: Float32Array;\n  edges: number[];\n  width: number;\n  height: number;\n  pad: number;\n  logoWidth: number;\n  logoHeight: number;\n  glow: Float32Array;\n  glowWidth: number;\n  glowHeight: number;\n  glowOffset: number;\n}\n\ninterface Slot {\n  shape: Shape | null;\n  field: Texture;\n  glow: Texture;\n}\n\ninterface Pulse {\n  x: number;\n  y: number;\n  born: number;\n}\n\ninterface Point {\n  x: number;\n  y: number;\n}\n\ninterface Focus {\n  x: number;\n  y: number;\n  radius: number;\n}\n\ninterface Spark {\n  ax: number;\n  ay: number;\n  bx: number;\n  by: number;\n  bow: number;\n  seed: number;\n  born: number;\n  life: number;\n}\n\nconst hexToRgb = (hex: string): Rgb => {\n  let h = String(hex || '').replace('#', '');\n  if (h.length === 3) h = h.replace(/./g, c => c + c);\n  const n = parseInt(h.slice(0, 6), 16);\n  return Number.isNaN(n) ? [1, 1, 1] : [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];\n};\n\nconst transformLine = (f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number) => {\n  let k = 0;\n  v[0] = 0;\n  z[0] = -FAR;\n  z[1] = FAR;\n  for (let q = 1; q < n; q++) {\n    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    while (s <= z[k]) {\n      k--;\n      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);\n    }\n    k++;\n    v[k] = q;\n    z[k] = s;\n    z[k + 1] = FAR;\n  }\n  k = 0;\n  for (let q = 0; q < n; q++) {\n    while (z[k + 1] < q) k++;\n    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];\n  }\n};\n\nconst transformGrid = (grid: Float32Array, w: number, h: number) => {\n  const n = Math.max(w, h);\n  const f = new Float64Array(n);\n  const d = new Float64Array(n);\n  const v = new Int32Array(n);\n  const z = new Float64Array(n + 1);\n  for (let x = 0; x < w; x++) {\n    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];\n    transformLine(f, d, v, z, h);\n    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];\n  }\n  for (let y = 0; y < h; y++) {\n    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];\n    transformLine(f, d, v, z, w);\n    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];\n  }\n};\n\nconst blurLine = (src: Float32Array, dst: Float32Array, offset: number, stride: number, n: number, r: number) => {\n  const scale = 1 / (2 * r + 1);\n  let sum = 0;\n  for (let i = 0; i <= r && i < n; i++) sum += src[offset + i * stride];\n  for (let i = 0; i < n; i++) {\n    dst[offset + i * stride] = sum * scale;\n    if (i + r + 1 < n) sum += src[offset + (i + r + 1) * stride];\n    if (i - r >= 0) sum -= src[offset + (i - r) * stride];\n  }\n};\n\nconst blurGrid = (grid: Float32Array, w: number, h: number, r: number) => {\n  const tmp = new Float32Array(w * h);\n  for (let pass = 0; pass < 3; pass++) {\n    for (let y = 0; y < h; y++) blurLine(grid, tmp, y * w, 1, w, r);\n    for (let x = 0; x < w; x++) blurLine(tmp, grid, x, w, h, r);\n  }\n};\n\nconst readCoverage = (data: Uint8ClampedArray, w: number, h: number) => {\n  const coverage = new Float32Array(w * h);\n  let clear = 0;\n  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 250) clear++;\n  if (clear > w * h * 0.01) {\n    for (let i = 0; i < w * h; i++) coverage[i] = data[i * 4 + 3] / 255;\n    return coverage;\n  }\n  let r = 0;\n  let g = 0;\n  let b = 0;\n  let n = 0;\n  const sample = (i: number) => {\n    r += data[i * 4];\n    g += data[i * 4 + 1];\n    b += data[i * 4 + 2];\n    n++;\n  };\n  for (let x = 0; x < w; x++) {\n    sample(x);\n    sample((h - 1) * w + x);\n  }\n  for (let y = 0; y < h; y++) {\n    sample(y * w);\n    sample(y * w + w - 1);\n  }\n  r /= n;\n  g /= n;\n  b /= n;\n  for (let i = 0; i < w * h; i++) {\n    const diff = Math.max(
```

**File**: `src/components/common/NotFound/FloatingShards.jsx` (modified, +82/-92)
```diff
@@ -1,146 +1,136 @@
 import { useEffect, useRef } from 'react';
+import { createGlassScene } from './glassScene';
 
-import { SHARDS, PANE_WIDTH, PANE_HEIGHT } from './shardGeometry';
-
-const FloatingShards = ({ reducedMotion }) => {
+const FloatingShards = ({ reducedMotion, theme, stageRef, reflectionRef, layoutKey }) => {
   const rootRef = useRef(null);
+  const measureRef = useRef(null);
 
   useEffect(() => {
     const root = rootRef.current;
-    if (!root) return undefined;
     const plane = root.querySelector('.nf-shard-plane');
-    const elements = [...root.querySelectorAll('.nf-shard')];
+    const glass = createGlassScene(plane, theme);
+    if (!glass) return undefined;
+
     const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
     const target = { x: 0, y: 0 };
-    const position = { x: 0, y: 0 };
-    let rect = root.getBoundingClientRect();
-    let scale = plane.getBoundingClientRect().width / PANE_WIDTH;
+    const pointer = { x: 0, y: 0, vx: 0, vy: 0 };
+    let rect;
     let frame = 0;
     let last = 0;
+    let time = 0;
+    let sourceElapsed = 0;
+    let sourceLast = 0;
+    let sourceWidth = 0;
+    let sourceHeight = 0;
     let inView = true;
-
-    const render = () => {
-      plane.style.transform = `translate(calc(-50% + ${position.x * 5 * scale}px), calc(-50% + ${position.y * 4 * scale}px))`;
-      elements.forEach((element, index) => {
-        const depth = SHARDS[index].depth;
-        element.style.transform = `translate3d(${position.x * depth * 3 * scale}px, ${position.y * depth * 2 * scale}px, 0)`;
-      });
-    };
+    let disposed = false;
+    const active = () => !disposed && inView && !document.hidden;
 
     const tick = now => {
       frame = 0;
-      const dt = Math.min((now - (last || now)) / 1000, 0.05) || 1 / 60;
+      if (!active()) return;
+      const dt = Math.min((now - (last || now)) / 1000, 0.032);
       last = now;
-      const blend = 1 - Math.exp(-5 * dt);
-      position.x += (target.x - position.x) * blend;
-      position.y += (target.y - position.y) * blend;
-      const settled = Math.abs(target.x - position.x) + Math.abs(target.y - position.y) < 0.001;
-      if (settled) Object.assign(position, target);
-      render();
-      if (!settled) frame = requestAnimationFrame(tick);
-      else last = 0;
+      if (!reducedMotion) {
+        time += dt;
+        // A critically damped spring keeps changes in direction continuous.
+        for (const axis of ['x', 'y']) {
+          const velocity = `v${axis}`;
+          pointer[velocity] += ((target[axis] - pointer[axis]) * 36 - pointer[velocity] * 12) * dt;
+          pointer[axis] += pointer[velocity] * dt;
+        }
+      }
+      glass.render(time, pointer);
+      if (!reducedMotion) frame = requestAnimationFrame(tick);
     };
-
     const wake = () => {
-      if (!frame && !reducedMotion && inView && !document.hidden) frame = requestAnimationFrame(tick);
+      if (!frame && active()) frame = requestAnimationFrame(tick);
     };
+    const capture = canvas => {
+      if (!active()) return;
+      if (reducedMotion) {
+        if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
+          sourceElapsed = 0;
+          sourceLast = 0;
+          sourceWidth = canvas.width;
+          sourceHeight = canvas.height;
+        }
+        if (sourceElapsed >= 1.6) return;
+        const now = performance.now();
+        sourceElapsed += sourceLast ? Math.min((now - sourceLast) / 1000, 0.05) : 1 / 60;
+        sourceLast = now;
+      }
+      glass.capture(canvas);
+      wake();
+    };
+    reflectionRef.current = capture;
 
+    const measure = () => {
+      rect = root.getBoundingClientRect();
+      glass.resize(plane.getBoundingClientRect(), stageRef.current?.getBoundingClientRect());
+      wake();
+    };
+    measureRef.current = measure;
     const reset = () => {
       target.x = 0;
       target.y = 0;
-      wake();
     };
-
-    const onPointerMove = event => {
+    const onMove = event => {
       if (reducedMotion || !pointerQuery.matches || event.pointerType !== 'mouse') return;
-      const nx = (event.clientX - rect.left) / rect.width;
-      const ny = (event.clientY - rect.top) / rect.height;
-      target.x = Math.max(-1, Math.min(1, nx * 2 - 1));
-      target.y = Math.max(-1, Math.min(1, ny * 2 - 1));
-      wake();
+      target.x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
+      target.y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
     };
-
-    const onPointerOut = event => {
+    const onOut = event => {
       if (!event.relatedTarget) reset();
     };
-
-    const syncPlayback = () => {
-      const paused = reducedMotion || !inView || document.hidden;
-      root.dataset.paused = String(paused);
-      if (paused) {
-        cancelAnimationFrame(frame);
-        frame = 0;
-        last = 0;
-        if (reducedMotion) {
-        
```

**File**: `src/components/common/NotFound/glassScene.js` (added, +274/-0)
```diff
@@ -0,0 +1,274 @@
+import {
+  CanvasTexture,
+  Color,
+  EquirectangularReflectionMapping,
+  ExtrudeGeometry,
+  LinearFilter,
+  Mesh,
+  MeshBasicMaterial,
+  MeshPhysicalMaterial,
+  NoToneMapping,
+  PerspectiveCamera,
+  PlaneGeometry,
+  PMREMGenerator,
+  Scene,
+  Shape,
+  SRGBColorSpace,
+  Vector2,
+  Vector4,
+  WebGLRenderer
+} from 'three';
+import { PANE_HEIGHT, PANE_WIDTH, SHARDS } from './shardGeometry';
+
+// Broad studio softboxes give clear glass something to reflect. A narrow strip
+// catches the fractured bevels as they turn, without drawing artificial outlines.
+const createEnvironment = renderer => {
+  const canvas = document.createElement('canvas');
+  canvas.width = 1024;
+  canvas.height = 512;
+  const context = canvas.getContext('2d');
+  context.fillStyle = '#141218';
+  context.fillRect(0, 0, 1024, 512);
+  const softbox = (x, y, rx, ry, color) => {
+    context.save();
+    context.translate(x, y);
+    context.scale(rx, ry);
+    const gradient = context.createRadialGradient(0, 0, 0.08, 0, 0, 1);
+    gradient.addColorStop(0, color);
+    gradient.addColorStop(0.4, color);
+    gradient.addColorStop(1, 'rgba(25, 22, 32, 0)');
+    context.fillStyle = gradient;
+    context.fillRect(-1, -1, 2, 2);
+    context.restore();
+  };
+  softbox(240, 160, 150, 100, '#a4a0ae');
+  softbox(740, 260, 35, 200, '#e9e6f2');
+  softbox(520, 420, 250, 80, '#50435d');
+  const texture = new CanvasTexture(canvas);
+  texture.mapping = EquirectangularReflectionMapping;
+  texture.colorSpace = SRGBColorSpace;
+  const generator = new PMREMGenerator(renderer);
+  const environment = generator.fromEquirectangular(texture);
+  texture.dispose();
+  generator.dispose();
+  return environment;
+};
+
+// A reflected view ray intersects the live electric canvas above the glass.
+// Every tilted fragment catches a different part, with dielectric Fresnel.
+const reflectedElectricity = /* glsl */ `
+  vec3 glassNormal = inverseTransformDirection(normal, viewMatrix);
+  vec3 eye = normalize(cameraPosition - vWorldPosition);
+  vec3 ray = reflect(-eye, glassNormal);
+  float distanceToLight = (310.0 - vWorldPosition.z) / max(ray.z, 0.001);
+  vec2 hit = vWorldPosition.xy + ray.xy * distanceToLight;
+  vec2 reflectedUV = (hit - electricBounds.xy) / electricBounds.zw + 0.5;
+  float inside = step(0.0, reflectedUV.x) * step(reflectedUV.x, 1.0)
+    * step(0.0, reflectedUV.y) * step(reflectedUV.y, 1.0) * step(0.0, ray.z);
+  vec4 center = texture2D(electricFrame, reflectedUV);
+  vec4 left = texture2D(electricFrame, reflectedUV + vec2(0.0015, 0.0));
+  vec4 right = texture2D(electricFrame, reflectedUV - vec2(0.0015, 0.0));
+  vec3 electric = center.rgb * center.a + (left.rgb * left.a + right.rgb * right.a) * 0.3;
+  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(eye, glassNormal), 0.0), 5.0);
+  float energy = center.a + (left.a + right.a) * 0.3;
+  outgoingLight += electric * fresnel * inside * 0.65 * (1.0 - electricInk);
+  outgoingLight = mix(outgoingLight, electric / max(energy, 0.001), electricInk * inside * energy * 0.08);
+`;
+
+// Small preblurred silhouettes provide the broad, faint contact shadows of
+// suspended clear glass without hard opaque shadow-map silhouettes.
+const createShadow = (shard, light) => {
+  const padding = 35;
+  const width = shard.width + padding * 2;
+  const height = shard.height + padding * 2;
+  const canvas = document.createElement('canvas');
+  canvas.width = Math.ceil(width * 1.5);
+  canvas.height = Math.ceil(height * 1.5);
+  const context = canvas.getContext('2d');
+  context.scale(1.5, 1.5);
+  context.filter = 'blur(10px)';
+  context.fillStyle = '#000';
+  context.beginPath();
+  shard.vertices.forEach((point, index) => {
+    context[index ? 'lineTo' : 'moveTo'](point.x - shard.x + padding, point.y - shard.y + padding);
+  });
+  context.closePath();
+  context.fill();
+  const texture = new CanvasTexture(canvas);
+  const material = new MeshBasicMaterial({
+    map: texture,
+    transparent: true,
+    opacity: light ? 0.045 : 0.16,
+    depthWrite: false
+  });
+  return new Mesh(new PlaneGeometry(width, height), material);
+};
+
+export const createGlassScene = (container, theme) => {
+  let renderer;
+  try {
+    renderer = new WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'low-power' });
+  } catch {
+    // The decoration is optional; navigation and the page message stay intact.
+    return null;
+  }
+  const light = theme === 'light';
+  renderer.outputColorSpace = SRGBColorSpace;
+  renderer.toneMapping = NoToneMapping;
+  renderer.setClearColor(light ? '#ffffff' : '#120f17', 1);
+  renderer.domElement.className = 'nf-glass-canvas';
+  container.appendChild(renderer.domElement);
+  const scene = new Scene();
+  scene.background = new Color(light ? '#ffffff' : '#120f17');
+  const environment = createEnvironment(renderer);
+  scene.environment = environment.texture;
+
+  const camera = new PerspectiveCamera(24, 1, 10, 2400);
+  c
```

**File**: `src/components/common/NotFound/shardGeometry.js` (modified, +1/-0)
```diff
@@ -96,6 +96,7 @@ const createShards = () => {
       y,
       width,
       height,
+      vertices,
       points: vertices.map(point => `${point.x - x},${point.y - y}`).join(' '),
       sourcePolygon,
       offsetX: 0,
```

**File**: `src/constants/Information.js` (modified, +2/-1)
```diff
@@ -124,7 +124,8 @@ export const componentMetadata = {
     name: 'ElectricLogo',
     docsUrl: 'https://reactbits.dev/animations/electric-logo',
     tags: [],
-    added: '2026-09-25'
+    added: '2026-09-25',
+    updates: [{ date: '2026-09-28', note: 'Added an onRender callback for capturing live frames and reflection effects.' }]
   },
   'Animations/DitherVeil': {
     videoUrl: '/assets/video/ditherveil.webm',
```

---

### Incident Patch 7: `5b31a64a` (2026-09-21)
**Commit Message**: fix(Masonry): clean up media query listeners on the original instances

**File**: `public/r/Masonry-JS-CSS.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry.jsx",
-			"content": "import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nimport './Masonry.css';\n\nconst useMedia = (queries, values, defaultValue) => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = () => {\n  const ref = useRef(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size];\n};\n\nconst preloadImages = async urls => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\nconst Masonry = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = item => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n\n    if (animateFrom === 'random') {\n      const directions = ['top', 'bottom', 'left', 'right'];\n      direction = directions[Math.floor(Math.random() * directions.length)];\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo(() => {\n    if (!width) return [];\n\n    const colHeights = new Array(columns).fill(0);\n    const columnWidth = width / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = columnWidth * col;\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height;\n\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animationProps = {\n        x: item.x,\n        y: item.y,\n        width: item.w,\n        height: item.h\n      };\n\n      if (!hasMounted.current) {\n        const initialPos = getInitialPosition(item, index);\n        const initialState = {\n          opacity: 0,\n          x: initialPos.x,\n          y: initialPos.y,\n          width: item.w,\n          height: item.h,\n          ...(blurToFocus && { filter: 'blur(10px)' })\n        };\n\n        gsap.fromTo(selector, initialState, {\n          opacity: 1,\n          ...animationProps,\n          ...(blurToFocus && { filter: 'blur(0px)' }),\n          duration: 0.8,\n          ease: 'power3.out',\n          delay: index * stagger\n        });\n      } else {\n        gsap.to(selector, {\n          ...animationProps,\n          duration: duration,\n          ease: ease,\n          overwrite: 'auto'\n        });\n      }\n    });\n\n    hasMounted.current = true;\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);\n\n  const handleMouseEnter = (e, item) => {\n    const element = e.currentTarget;\n    const selector = `[data-key=\
```

**File**: `public/r/Masonry-JS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry/Masonry.jsx",
-			"content": "import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nconst useMedia = (queries, values, defaultValue) => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = () => {\n  const ref = useRef(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size];\n};\n\nconst preloadImages = async urls => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\nconst Masonry = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = item => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n    if (animateFrom === 'random') {\n      const dirs = ['top', 'bottom', 'left', 'right'];\n      direction = dirs[Math.floor(Math.random() * dirs.length)];\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo(() => {\n    if (!width) return [];\n    const colHeights = new Array(columns).fill(0);\n    const gap = 16;\n    const totalGaps = (columns - 1) * gap;\n    const columnWidth = (width - totalGaps) / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = col * (columnWidth + gap);\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height + gap;\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };\n\n      if (!hasMounted.current) {\n        const start = getInitialPosition(item);\n        gsap.fromTo(\n          selector,\n          {\n            opacity: 0,\n            x: start.x,\n            y: start.y,\n            width: item.w,\n            height: item.h,\n            ...(blurToFocus && { filter: 'blur(10px)' })\n          },\n          {\n            opacity: 1,\n            ...animProps,\n            ...(blurToFocus && { filter: 'blur(0px)' }),\n            duration: 0.8,\n            ease: 'power3.out',\n            delay: index * stagger\n          }\n        );\n      } else {\n        gsap.to(selector, {\n          ...animProps,\n          duration,\n          ease,\n          overwrite: 'auto'\n        });\n      }\n    });\n\n    hasMounted.current = true;\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [grid, imagesReady, stagger, animateFrom, blurToFocus, duration, ease]);\n\n  const handleMouseEnter = (id, element) => {\n    if (scaleOnHover) {\n      gsap.to(`[data-key=\"${id}\"]`, {\n        scale: hoverSca
```

**File**: `public/r/Masonry-TS-CSS.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry.tsx",
-			"content": "import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nimport './Masonry.css';\n\nconst useMedia = (queries: string[], values: number[], defaultValue: number): number => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState<number>(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = <T extends HTMLElement>() => {\n  const ref = useRef<T | null>(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size] as const;\n};\n\nconst preloadImages = async (urls: string[]): Promise<void> => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise<void>(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\ninterface Item {\n  id: string;\n  img: string;\n  url: string;\n  height: number;\n}\n\ninterface GridItem extends Item {\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n}\n\ninterface MasonryProps {\n  items: Item[];\n  ease?: string;\n  duration?: number;\n  stagger?: number;\n  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random';\n  scaleOnHover?: boolean;\n  hoverScale?: number;\n  blurToFocus?: boolean;\n  colorShiftOnHover?: boolean;\n}\n\nconst Masonry: React.FC<MasonryProps> = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure<HTMLDivElement>();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = (item: GridItem) => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n\n    if (animateFrom === 'random') {\n      const directions = ['top', 'bottom', 'left', 'right'];\n      direction = directions[Math.floor(Math.random() * directions.length)] as typeof animateFrom;\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo<GridItem[]>(() => {\n    if (!width) return [];\n\n    const colHeights = new Array(columns).fill(0);\n    const columnWidth = width / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = columnWidth * col;\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height;\n\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animationProps = {\n        x: item.x,\n        y: item.y,\n        width: item.w,\n        height: item.h\n      };\n\n      if (!hasMounted.current) {\n        const initialPos = getInitialPosition(item);\n        const initialState = {\n          opacity: 0,\n          x: initialPos.x,\n          y: initialPos.y,\n          width: item.w,\n          height: item.h,\n          ...(blurToFocus && { filter: 'blur(10px)' })\n        };\n\n        gsap.fromTo(selector, initialState, {\n          opacity: 1,\n          ...animationProps,\n          ...(b
```

**File**: `public/r/Masonry-TS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "Masonry/Masonry.tsx",
-			"content": "import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';\nimport { gsap } from 'gsap';\n\nconst useMedia = (queries: string[], values: number[], defaultValue: number): number => {\n  const get = () => {\n    if (typeof window === 'undefined') return defaultValue;\n    return values[queries.findIndex(q => matchMedia(q).matches)] ?? defaultValue;\n  };\n\n  const [value, setValue] = useState<number>(get);\n\n  useEffect(() => {\n    const handler = () => setValue(get);\n    queries.forEach(q => matchMedia(q).addEventListener('change', handler));\n    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));\n  }, [queries]);\n\n  return value;\n};\n\nconst useMeasure = <T extends HTMLElement>() => {\n  const ref = useRef<T | null>(null);\n  const [size, setSize] = useState({ width: 0, height: 0 });\n\n  useLayoutEffect(() => {\n    if (!ref.current) return;\n    const ro = new ResizeObserver(([entry]) => {\n      const { width, height } = entry.contentRect;\n      setSize({ width, height });\n    });\n    ro.observe(ref.current);\n    return () => ro.disconnect();\n  }, []);\n\n  return [ref, size] as const;\n};\n\nconst preloadImages = async (urls: string[]): Promise<void> => {\n  await Promise.all(\n    urls.map(\n      src =>\n        new Promise<void>(resolve => {\n          const img = new Image();\n          img.src = src;\n          img.onload = img.onerror = () => resolve();\n        })\n    )\n  );\n};\n\ninterface Item {\n  id: string;\n  img: string;\n  url: string;\n  height: number;\n}\n\ninterface GridItem extends Item {\n  x: number;\n  y: number;\n  w: number;\n  h: number;\n}\n\ninterface MasonryProps {\n  items: Item[];\n  ease?: string;\n  duration?: number;\n  stagger?: number;\n  animateFrom?: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random';\n  scaleOnHover?: boolean;\n  hoverScale?: number;\n  blurToFocus?: boolean;\n  colorShiftOnHover?: boolean;\n}\n\nconst Masonry: React.FC<MasonryProps> = ({\n  items,\n  ease = 'power3.out',\n  duration = 0.6,\n  stagger = 0.05,\n  animateFrom = 'bottom',\n  scaleOnHover = true,\n  hoverScale = 0.95,\n  blurToFocus = true,\n  colorShiftOnHover = false\n}) => {\n  const columns = useMedia(\n    ['(min-width:1500px)', '(min-width:1000px)', '(min-width:600px)', '(min-width:400px)'],\n    [5, 4, 3, 2],\n    1\n  );\n\n  const [containerRef, { width }] = useMeasure<HTMLDivElement>();\n  const [imagesReady, setImagesReady] = useState(false);\n\n  const getInitialPosition = (item: GridItem) => {\n    const containerRect = containerRef.current?.getBoundingClientRect();\n    if (!containerRect) return { x: item.x, y: item.y };\n\n    let direction = animateFrom;\n    if (animateFrom === 'random') {\n      const dirs = ['top', 'bottom', 'left', 'right'];\n      direction = dirs[Math.floor(Math.random() * dirs.length)] as typeof animateFrom;\n    }\n\n    switch (direction) {\n      case 'top':\n        return { x: item.x, y: -200 };\n      case 'bottom':\n        return { x: item.x, y: window.innerHeight + 200 };\n      case 'left':\n        return { x: -200, y: item.y };\n      case 'right':\n        return { x: window.innerWidth + 200, y: item.y };\n      case 'center':\n        return {\n          x: containerRect.width / 2 - item.w / 2,\n          y: containerRect.height / 2 - item.h / 2\n        };\n      default:\n        return { x: item.x, y: item.y + 100 };\n    }\n  };\n\n  useEffect(() => {\n    preloadImages(items.map(i => i.img)).then(() => setImagesReady(true));\n  }, [items]);\n\n  const grid = useMemo<GridItem[]>(() => {\n    if (!width) return [];\n    const colHeights = new Array(columns).fill(0);\n    const gap = 16;\n    const totalGaps = (columns - 1) * gap;\n    const columnWidth = (width - totalGaps) / columns;\n\n    return items.map(child => {\n      const col = colHeights.indexOf(Math.min(...colHeights));\n      const x = col * (columnWidth + gap);\n      const height = child.height / 2;\n      const y = colHeights[col];\n\n      colHeights[col] += height + gap;\n      return { ...child, x, y, w: columnWidth, h: height };\n    });\n  }, [columns, items, width]);\n\n  const hasMounted = useRef(false);\n\n  useLayoutEffect(() => {\n    if (!imagesReady) return;\n\n    grid.forEach((item, index) => {\n      const selector = `[data-key=\"${item.id}\"]`;\n      const animProps = { x: item.x, y: item.y, width: item.w, height: item.h };\n\n      if (!hasMounted.current) {\n        const start = getInitialPosition(item);\n        gsap.fromTo(\n          selector,\n          {\n            opacity: 0,\n            x: start.x,\n            y: start.y,\n            width: item.w,\n            height: item.h,\n            ...(blurToFocus && { filter: 'blur(10px)' })\n          },\n          {\n            opacity: 1,\n            ...animProps,\n            ...(blurToFocus &
```

**File**: `src/content/Components/Masonry/Masonry.jsx` (modified, +3/-2)
```diff
@@ -12,9 +12,10 @@ const useMedia = (queries, values, defaultValue) => {
   const [value, setValue] = useState(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [queries]);
 
```

**File**: `src/tailwind/Components/Masonry/Masonry.jsx` (modified, +3/-2)
```diff
@@ -10,9 +10,10 @@ const useMedia = (queries, values, defaultValue) => {
   const [value, setValue] = useState(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [queries]);
 
```

**File**: `src/ts-default/Components/Masonry/Masonry.tsx` (modified, +3/-2)
```diff
@@ -12,9 +12,10 @@ const useMedia = (queries: string[], values: number[], defaultValue: number): nu
   const [value, setValue] = useState<number>(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
   }, [queries]);
 
   return value;
```

**File**: `src/ts-tailwind/Components/Masonry/Masonry.tsx` (modified, +3/-2)
```diff
@@ -10,9 +10,10 @@ const useMedia = (queries: string[], values: number[], defaultValue: number): nu
   const [value, setValue] = useState<number>(get);
 
   useEffect(() => {
+    const mediaQueries = queries.map(q => matchMedia(q));
     const handler = () => setValue(get);
-    queries.forEach(q => matchMedia(q).addEventListener('change', handler));
-    return () => queries.forEach(q => matchMedia(q).removeEventListener('change', handler));
+    mediaQueries.forEach(query => query.addEventListener('change', handler));
+    return () => mediaQueries.forEach(query => query.removeEventListener('change', handler));
   }, [queries]);
 
   return value;
```

---

### Incident Patch 8: `b6770192` (2026-09-19)
**Commit Message**: Merge pull request #1092 from saimaneim/fix/component-list-acronym-slug

fix: handle acronyms in ComponentList fromPascal conversion

**File**: `src/components/common/ComponentList.jsx` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ const slug = str => (str || '').replace(/\s+/g, '-').toLowerCase();
 const fromPascal = str =>
   (str || '')
     .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
+    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
     .replace(/_/g, ' ')
     .trim();
 
```

---

### Incident Patch 9: `40390777` (2026-09-19)
**Commit Message**: fix: handle acronyms in ComponentList fromPascal conversion

**File**: `src/components/common/ComponentList.jsx` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ const slug = str => (str || '').replace(/\s+/g, '-').toLowerCase();
 const fromPascal = str =>
   (str || '')
     .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
+    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
     .replace(/_/g, ' ')
     .trim();
 
```

---

### Incident Patch 10: `fcf6679d` (2026-09-18)
**Commit Message**: fix highlighting

**File**: `src/styles.css` (modified, +11/-0)
```diff
@@ -30,6 +30,17 @@ html {
   background: var(--bg-body);
 }
 
+::selection {
+  background: rgba(168, 85, 247, 0.42);
+  color: #ffffff;
+  text-shadow: none;
+}
+
+:root[data-theme='light'] ::selection {
+  background: rgba(143, 54, 232, 0.22);
+  color: #18181b;
+}
+
 input[type='color'] {
   border: 2px solid #999;
   border-radius: 15px;
```

---

### Incident Patch 11: `163f42fb` (2026-09-18)
**Commit Message**: Merge pull request #1079 from MauryaQbit/feat/fix-scrollvelocity-undefined-class

fix(ScrollVelocity): default parallax/scroller class in tailwind variants

**File**: `public/r/ScrollVelocity-JS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "ScrollVelocity/ScrollVelocity.jsx",
-			"content": "import { useRef, useLayoutEffect, useState } from 'react';\nimport {\n  motion,\n  useScroll,\n  useSpring,\n  useTransform,\n  useMotionValue,\n  useVelocity,\n  useAnimationFrame\n} from 'motion/react';\n\nfunction useElementWidth(ref) {\n  const [width, setWidth] = useState(0);\n\n  useLayoutEffect(() => {\n    function updateWidth() {\n      if (ref.current) {\n        setWidth(ref.current.offsetWidth);\n      }\n    }\n    updateWidth();\n    window.addEventListener('resize', updateWidth);\n    return () => window.removeEventListener('resize', updateWidth);\n  }, [ref]);\n\n  return width;\n}\n\nexport const ScrollVelocity = ({\n  scrollContainerRef,\n  texts = [],\n  velocity = 100,\n  className = '',\n  damping = 50,\n  stiffness = 400,\n  numCopies = 6,\n  velocityMapping = { input: [0, 1000], output: [0, 5] },\n  parallaxClassName,\n  scrollerClassName,\n  parallaxStyle,\n  scrollerStyle\n}) => {\n  function VelocityText({\n    children,\n    baseVelocity = velocity,\n    scrollContainerRef,\n    className = '',\n    damping,\n    stiffness,\n    numCopies,\n    velocityMapping,\n    parallaxClassName,\n    scrollerClassName,\n    parallaxStyle,\n    scrollerStyle\n  }) {\n    const baseX = useMotionValue(0);\n    const scrollOptions = scrollContainerRef ? { container: scrollContainerRef } : {};\n    const { scrollY } = useScroll(scrollOptions);\n    const scrollVelocity = useVelocity(scrollY);\n    const smoothVelocity = useSpring(scrollVelocity, {\n      damping: damping ?? 50,\n      stiffness: stiffness ?? 400\n    });\n    const velocityFactor = useTransform(\n      smoothVelocity,\n      velocityMapping?.input || [0, 1000],\n      velocityMapping?.output || [0, 5],\n      { clamp: false }\n    );\n\n    const copyRef = useRef(null);\n    const copyWidth = useElementWidth(copyRef);\n\n    function wrap(min, max, v) {\n      const range = max - min;\n      const mod = (((v - min) % range) + range) % range;\n      return mod + min;\n    }\n\n    const x = useTransform(baseX, v => {\n      if (copyWidth === 0) return '0px';\n      return `${wrap(-copyWidth, 0, v)}px`;\n    });\n\n    const directionFactor = useRef(1);\n    useAnimationFrame((t, delta) => {\n      let moveBy = directionFactor.current * baseVelocity * (delta / 1000);\n\n      if (velocityFactor.get() < 0) {\n        directionFactor.current = -1;\n      } else if (velocityFactor.get() > 0) {\n        directionFactor.current = 1;\n      }\n\n      moveBy += directionFactor.current * moveBy * velocityFactor.get();\n      baseX.set(baseX.get() + moveBy);\n    });\n\n    const spans = [];\n    for (let i = 0; i < (numCopies ?? 1); i++) {\n      spans.push(\n        <span className={`flex-shrink-0 ${className}`} key={i} ref={i === 0 ? copyRef : null}>\n          {children}&nbsp;\n        </span>\n      );\n    }\n\n    return (\n      <div className={`${parallaxClassName} relative overflow-hidden`} style={parallaxStyle}>\n        <motion.div\n          className={`${scrollerClassName} flex whitespace-nowrap text-center font-sans text-4xl font-bold tracking-[-0.02em] drop-shadow md:text-[5rem] md:leading-[5rem]`}\n          style={{ x, ...scrollerStyle }}\n        >\n          {spans}\n        </motion.div>\n      </div>\n    );\n  }\n\n  return (\n    <section>\n      {texts.map((text, index) => (\n        <VelocityText\n          key={index}\n          className={className}\n          baseVelocity={index % 2 !== 0 ? -velocity : velocity}\n          scrollContainerRef={scrollContainerRef}\n          damping={damping}\n          stiffness={stiffness}\n          numCopies={numCopies}\n          velocityMapping={velocityMapping}\n          parallaxClassName={parallaxClassName}\n          scrollerClassName={scrollerClassName}\n          parallaxStyle={parallaxStyle}\n          scrollerStyle={scrollerStyle}\n        >\n          {text}\n        </VelocityText>\n      ))}\n    </section>\n  );\n};\n\nexport default ScrollVelocity;\n"
+			"content": "import { useRef, useLayoutEffect, useState } from 'react';\nimport {\n  motion,\n  useScroll,\n  useSpring,\n  useTransform,\n  useMotionValue,\n  useVelocity,\n  useAnimationFrame\n} from 'motion/react';\n\nfunction useElementWidth(ref) {\n  const [width, setWidth] = useState(0);\n\n  useLayoutEffect(() => {\n    function updateWidth() {\n      if (ref.current) {\n        setWidth(ref.current.offsetWidth);\n      }\n    }\n    updateWidth();\n    window.addEventListener('resize', updateWidth);\n    return () => window.removeEventListener('resize', updateWidth);\n  }, [ref]);\n\n  return width;\n}\n\nexport const ScrollVelocity = ({\n  scrollContainerRef,\n  texts = [],\n  velocity = 100,\n  className = '',\n  damping = 50,\n  stiffness = 400,\n  numCopies = 6,\n  velocityMapping = { input: [0, 1000], output: [0, 5] },\n  parallaxClassName = 'parallax',\n  scrollerClassName = 'scr
```

**File**: `public/r/ScrollVelocity-TS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "ScrollVelocity/ScrollVelocity.tsx",
-			"content": "import React, { useRef, useLayoutEffect, useState } from 'react';\nimport {\n  motion,\n  useScroll,\n  useSpring,\n  useTransform,\n  useMotionValue,\n  useVelocity,\n  useAnimationFrame\n} from 'motion/react';\n\ninterface VelocityMapping {\n  input: [number, number];\n  output: [number, number];\n}\n\ninterface VelocityTextProps {\n  children: React.ReactNode;\n  baseVelocity: number;\n  scrollContainerRef?: React.RefObject<HTMLElement>;\n  className?: string;\n  damping?: number;\n  stiffness?: number;\n  numCopies?: number;\n  velocityMapping?: VelocityMapping;\n  parallaxClassName?: string;\n  scrollerClassName?: string;\n  parallaxStyle?: React.CSSProperties;\n  scrollerStyle?: React.CSSProperties;\n}\n\ninterface ScrollVelocityProps {\n  scrollContainerRef?: React.RefObject<HTMLElement>;\n  texts: React.ReactNode[];\n  velocity?: number;\n  className?: string;\n  damping?: number;\n  stiffness?: number;\n  numCopies?: number;\n  velocityMapping?: VelocityMapping;\n  parallaxClassName?: string;\n  scrollerClassName?: string;\n  parallaxStyle?: React.CSSProperties;\n  scrollerStyle?: React.CSSProperties;\n}\n\nfunction useElementWidth<T extends HTMLElement>(ref: React.RefObject<T | null>): number {\n  const [width, setWidth] = useState(0);\n\n  useLayoutEffect(() => {\n    function updateWidth() {\n      if (ref.current) {\n        setWidth(ref.current.offsetWidth);\n      }\n    }\n    updateWidth();\n    window.addEventListener('resize', updateWidth);\n    return () => window.removeEventListener('resize', updateWidth);\n  }, [ref]);\n\n  return width;\n}\n\nexport const ScrollVelocity: React.FC<ScrollVelocityProps> = ({\n  scrollContainerRef,\n  texts = [],\n  velocity = 100,\n  className = '',\n  damping = 50,\n  stiffness = 400,\n  numCopies = 6,\n  velocityMapping = { input: [0, 1000], output: [0, 5] },\n  parallaxClassName,\n  scrollerClassName,\n  parallaxStyle,\n  scrollerStyle\n}) => {\n  function VelocityText({\n    children,\n    baseVelocity = velocity,\n    scrollContainerRef,\n    className = '',\n    damping,\n    stiffness,\n    numCopies,\n    velocityMapping,\n    parallaxClassName,\n    scrollerClassName,\n    parallaxStyle,\n    scrollerStyle\n  }: VelocityTextProps) {\n    const baseX = useMotionValue(0);\n    const scrollOptions = scrollContainerRef ? { container: scrollContainerRef } : {};\n    const { scrollY } = useScroll(scrollOptions);\n    const scrollVelocity = useVelocity(scrollY);\n    const smoothVelocity = useSpring(scrollVelocity, {\n      damping: damping ?? 50,\n      stiffness: stiffness ?? 400\n    });\n    const velocityFactor = useTransform(\n      smoothVelocity,\n      velocityMapping?.input || [0, 1000],\n      velocityMapping?.output || [0, 5],\n      { clamp: false }\n    );\n\n    const copyRef = useRef<HTMLSpanElement>(null);\n    const copyWidth = useElementWidth(copyRef);\n\n    function wrap(min: number, max: number, v: number): number {\n      const range = max - min;\n      const mod = (((v - min) % range) + range) % range;\n      return mod + min;\n    }\n\n    const x = useTransform(baseX, v => {\n      if (copyWidth === 0) return '0px';\n      return `${wrap(-copyWidth, 0, v)}px`;\n    });\n\n    const directionFactor = useRef<number>(1);\n    useAnimationFrame((t, delta) => {\n      let moveBy = directionFactor.current * baseVelocity * (delta / 1000);\n\n      if (velocityFactor.get() < 0) {\n        directionFactor.current = -1;\n      } else if (velocityFactor.get() > 0) {\n        directionFactor.current = 1;\n      }\n\n      moveBy += directionFactor.current * moveBy * velocityFactor.get();\n      baseX.set(baseX.get() + moveBy);\n    });\n\n    const spans = [];\n    for (let i = 0; i < (numCopies ?? 6); i++) {\n      spans.push(\n        <span className={`flex-shrink-0 ${className}`} key={i} ref={i === 0 ? copyRef : null}>\n          {children}&nbsp;\n        </span>\n      );\n    }\n\n    return (\n      <div className={`${parallaxClassName} relative overflow-hidden`} style={parallaxStyle}>\n        <motion.div\n          className={`${scrollerClassName} flex whitespace-nowrap text-center font-sans text-4xl font-bold tracking-[-0.02em] drop-shadow md:text-[5rem] md:leading-[5rem]`}\n          style={{ x, ...scrollerStyle }}\n        >\n          {spans}\n        </motion.div>\n      </div>\n    );\n  }\n\n  return (\n    <section>\n      {texts.map((text, index) => (\n        <VelocityText\n          key={index}\n          className={className}\n          baseVelocity={index % 2 !== 0 ? -velocity : velocity}\n          scrollContainerRef={scrollContainerRef}\n          damping={damping}\n          stiffness={stiffness}\n          numCopies={numCopies}\n          velocityMapping={velocityMapping}\n          parallaxClassName={parallaxClassName}\n          scrollerClassName={scrollerClassName}\n          parallaxStyle={pa
```

**File**: `src/tailwind/TextAnimations/ScrollVelocity/ScrollVelocity.jsx` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@ export const ScrollVelocity = ({
   stiffness = 400,
   numCopies = 6,
   velocityMapping = { input: [0, 1000], output: [0, 5] },
-  parallaxClassName,
-  scrollerClassName,
+  parallaxClassName = 'parallax',
+  scrollerClassName = 'scroller',
   parallaxStyle,
   scrollerStyle
 }) => {
```

**File**: `src/ts-tailwind/TextAnimations/ScrollVelocity/ScrollVelocity.tsx` (modified, +2/-2)
```diff
@@ -70,8 +70,8 @@ export const ScrollVelocity: React.FC<ScrollVelocityProps> = ({
   stiffness = 400,
   numCopies = 6,
   velocityMapping = { input: [0, 1000], output: [0, 5] },
-  parallaxClassName,
-  scrollerClassName,
+  parallaxClassName = 'parallax',
+  scrollerClassName = 'scroller',
   parallaxStyle,
   scrollerStyle
 }) => {
```

---

### Incident Patch 12: `4753f35e` (2026-09-18)
**Commit Message**: Merge pull request #1084 from EvgenyPonomarevNova/feat/fix-glass-surface-refs

fix(GlassSurface): initialize refs in Tailwind JS variant

**File**: `public/r/GlassSurface-JS-TW.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 		{
 			"type": "registry:component",
 			"path": "GlassSurface/GlassSurface.jsx",
-			"content": "/* eslint-disable react-hooks/exhaustive-deps */\nimport { useEffect, useRef, useState, useId } from 'react';\n\nconst useDarkMode = () => {\n  const [isDark, setIsDark] = useState(false);\n\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n\n    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');\n    setIsDark(mediaQuery.matches);\n\n    const handler = e => setIsDark(e.matches);\n    mediaQuery.addEventListener('change', handler);\n    return () => mediaQuery.removeEventListener('change', handler);\n  }, []);\n\n  return isDark;\n};\n\nconst GlassSurface = ({\n  children,\n  width = 200,\n  height = 80,\n  borderRadius = 20,\n  borderWidth = 0.07,\n  brightness = 50,\n  opacity = 0.93,\n  blur = 11,\n  displace = 0,\n  backgroundOpacity = 0,\n  saturation = 1,\n  distortionScale = -180,\n  redOffset = 0,\n  greenOffset = 10,\n  blueOffset = 20,\n  xChannel = 'R',\n  yChannel = 'G',\n  mixBlendMode = 'difference',\n  className = '',\n  style = {}\n}) => {\n  const uniqueId = useId().replace(/:/g, '-');\n  const filterId = `glass-filter-${uniqueId}`;\n  const redGradId = `red-grad-${uniqueId}`;\n  const blueGradId = `blue-grad-${uniqueId}`;\n\n  const [svgSupported, setSvgSupported] = useState(false);\n\n  const containerRef = useRef < HTMLDivElement > null;\n  const feImageRef = useRef < SVGFEImageElement > null;\n  const redChannelRef = useRef < SVGFEDisplacementMapElement > null;\n  const greenChannelRef = useRef < SVGFEDisplacementMapElement > null;\n  const blueChannelRef = useRef < SVGFEDisplacementMapElement > null;\n  const gaussianBlurRef = useRef < SVGFEGaussianBlurElement > null;\n\n  const isDarkMode = useDarkMode();\n\n  const generateDisplacementMap = () => {\n    const rect = containerRef.current?.getBoundingClientRect();\n    const actualWidth = rect?.width || 400;\n    const actualHeight = rect?.height || 200;\n    const edgeSize = Math.min(actualWidth, actualHeight) * (borderWidth * 0.5);\n\n    const svgContent = `\n      <svg viewBox=\"0 0 ${actualWidth} ${actualHeight}\" xmlns=\"http://www.w3.org/2000/svg\">\n        <defs>\n          <linearGradient id=\"${redGradId}\" x1=\"100%\" y1=\"0%\" x2=\"0%\" y2=\"0%\">\n            <stop offset=\"0%\" stop-color=\"#0000\"/>\n            <stop offset=\"100%\" stop-color=\"red\"/>\n          </linearGradient>\n          <linearGradient id=\"${blueGradId}\" x1=\"0%\" y1=\"0%\" x2=\"0%\" y2=\"100%\">\n            <stop offset=\"0%\" stop-color=\"#0000\"/>\n            <stop offset=\"100%\" stop-color=\"blue\"/>\n          </linearGradient>\n        </defs>\n        <rect x=\"0\" y=\"0\" width=\"${actualWidth}\" height=\"${actualHeight}\" fill=\"black\"></rect>\n        <rect x=\"0\" y=\"0\" width=\"${actualWidth}\" height=\"${actualHeight}\" rx=\"${borderRadius}\" fill=\"url(#${redGradId})\" />\n        <rect x=\"0\" y=\"0\" width=\"${actualWidth}\" height=\"${actualHeight}\" rx=\"${borderRadius}\" fill=\"url(#${blueGradId})\" style=\"mix-blend-mode: ${mixBlendMode}\" />\n        <rect x=\"${edgeSize}\" y=\"${edgeSize}\" width=\"${actualWidth - edgeSize * 2}\" height=\"${actualHeight - edgeSize * 2}\" rx=\"${borderRadius}\" fill=\"hsl(0 0% ${brightness}% / ${opacity})\" style=\"filter:blur(${blur}px)\" />\n      </svg>\n    `;\n\n    return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;\n  };\n\n  const updateDisplacementMap = () => {\n    feImageRef.current?.setAttribute('href', generateDisplacementMap());\n  };\n\n  useEffect(() => {\n    updateDisplacementMap();\n    [\n      { ref: redChannelRef, offset: redOffset },\n      { ref: greenChannelRef, offset: greenOffset },\n      { ref: blueChannelRef, offset: blueOffset }\n    ].forEach(({ ref, offset }) => {\n      if (ref.current) {\n        ref.current.setAttribute('scale', (distortionScale + offset).toString());\n        ref.current.setAttribute('xChannelSelector', xChannel);\n        ref.current.setAttribute('yChannelSelector', yChannel);\n      }\n    });\n\n    gaussianBlurRef.current?.setAttribute('stdDeviation', displace.toString());\n  }, [\n    width,\n    height,\n    borderRadius,\n    borderWidth,\n    brightness,\n    opacity,\n    blur,\n    displace,\n    distortionScale,\n    redOffset,\n    greenOffset,\n    blueOffset,\n    xChannel,\n    yChannel,\n    mixBlendMode\n  ]);\n\n  useEffect(() => {\n    if (!containerRef.current) return;\n\n    const resizeObserver = new ResizeObserver(() => {\n      setTimeout(updateDisplacementMap, 0);\n    });\n\n    resizeObserver.observe(containerRef.current);\n\n    return () => {\n      resizeObserver.disconnect();\n    };\n  }, []);\n\n  useEffect(() => {\n    setTimeout(updateDisplacementMap, 0);\n  }, [width, height]);\n\n  useEffect(() => {\n    setSvgSupported(supportsSVGFilters());\n  }, []);\n\n  const supportsSVGFilters = () => {\n    if (typeof window === 'undefined' |
```

**File**: `src/tailwind/Components/GlassSurface/GlassSurface.jsx` (modified, +6/-6)
```diff
@@ -47,12 +47,12 @@ const GlassSurface = ({
 
   const [svgSupported, setSvgSupported] = useState(false);
 
-  const containerRef = useRef < HTMLDivElement > null;
-  const feImageRef = useRef < SVGFEImageElement > null;
-  const redChannelRef = useRef < SVGFEDisplacementMapElement > null;
-  const greenChannelRef = useRef < SVGFEDisplacementMapElement > null;
-  const blueChannelRef = useRef < SVGFEDisplacementMapElement > null;
-  const gaussianBlurRef = useRef < SVGFEGaussianBlurElement > null;
+  const containerRef = useRef(null);
+  const feImageRef = useRef(null);
+  const redChannelRef = useRef(null);
+  const greenChannelRef = useRef(null);
+  const blueChannelRef = useRef(null);
+  const gaussianBlurRef = useRef(null);
 
   const isDarkMode = useDarkMode();
 
```

---

### Incident Patch 13: `dfe85a90` (2026-09-18)
**Commit Message**: Merge pull request #1085 from MauryaQbit/fix/chromagrid-tailwind-columns-rows

fix(ChromaGrid): add columns/rows props to tailwind variants for parity

**File**: `src/tailwind/Components/ChromaGrid/ChromaGrid.jsx` (modified, +11/-3)
```diff
@@ -1,7 +1,7 @@
 import { useRef, useEffect } from 'react';
 import { gsap } from 'gsap';
 
-const ChromaGrid = ({ items, className = '', radius = 300, damping = 0.45, fadeOut = 0.6, ease = 'power3.out' }) => {
+const ChromaGrid = ({ items, className = '', radius = 300, columns = 3, rows = 2, damping = 0.45, fadeOut = 0.6, ease = 'power3.out' }) => {
   const rootRef = useRef(null);
   const fadeRef = useRef(null);
   const setX = useRef(null);
@@ -122,11 +122,19 @@ const ChromaGrid = ({ items, className = '', radius = 300, damping = 0.45, fadeO
       ref={rootRef}
       onPointerMove={handleMove}
       onPointerLeave={handleLeave}
-      className={`relative w-full h-full flex flex-wrap justify-center items-start gap-3 ${className}`}
+      className={`relative w-full h-full grid justify-center gap-3 ${className}`}
       style={{
         '--r': `${radius}px`,
+        '--cols': columns,
+        '--rows': rows,
         '--x': '50%',
-        '--y': '50%'
+        '--y': '50%',
+        gridTemplateColumns: `repeat(${columns}, 320px)`,
+        gridAutoRows: 'auto',
+        maxWidth: '1200px',
+        margin: '0 auto',
+        padding: '1rem',
+        boxSizing: 'border-box'
       }}
     >
       {data.map((c, i) => (
```

**File**: `src/ts-tailwind/Components/ChromaGrid/ChromaGrid.tsx` (modified, +14/-2)
```diff
@@ -16,6 +16,8 @@ export interface ChromaGridProps {
   items?: ChromaItem[];
   className?: string;
   radius?: number;
+  columns?: number;
+  rows?: number;
   damping?: number;
   fadeOut?: number;
   ease?: string;
@@ -27,6 +29,8 @@ const ChromaGrid: React.FC<ChromaGridProps> = ({
   items,
   className = '',
   radius = 300,
+  columns = 3,
+  rows = 2,
   damping = 0.45,
   fadeOut = 0.6,
   ease = 'power3.out'
@@ -151,12 +155,20 @@ const ChromaGrid: React.FC<ChromaGridProps> = ({
       ref={rootRef}
       onPointerMove={handleMove}
       onPointerLeave={handleLeave}
-      className={`relative w-full h-full flex flex-wrap justify-center items-start gap-3 ${className}`}
+      className={`relative w-full h-full grid justify-center gap-3 ${className}`}
       style={
         {
           '--r': `${radius}px`,
+          '--cols': columns,
+          '--rows': rows,
           '--x': '50%',
-          '--y': '50%'
+          '--y': '50%',
+          gridTemplateColumns: `repeat(${columns}, 320px)`,
+          gridAutoRows: 'auto',
+          maxWidth: '1200px',
+          margin: '0 auto',
+          padding: '1rem',
+          boxSizing: 'border-box'
         } as React.CSSProperties
       }
     >
```

---

### Incident Patch 14: `d80cab8b` (2026-09-18)
**Commit Message**: Merge pull request #1090 from MauryaQbit/fix/remove-compromised-showcase-1087

Remove compromised Deepraj showcase link

**File**: `src/constants/Showcase.js` (modified, +0/-6)
```diff
@@ -23,12 +23,6 @@ export const SHOWCASE_ITEMS = [
     using: '<SpotlightCard />',
     image: '/assets/showcase/showcase-afaq.webp'
   },
-  {
-    name: 'Deepraj',
-    url: 'https://www.architech-dev.tech/',
-    using: '<CardSwap />',
-    image: '/assets/showcase/showcase-deepraj.webp'
-  },
   {
     name: 'Devraj',
     url: 'https://devrajchatribin.com/about',
```

---

### Incident Patch 15: `7cc1be9d` (2026-09-18)
**Commit Message**: fix glideselect

**File**: `src/content/Micro/GlideSelect/GlideSelect.jsx` (modified, +7/-7)
```diff
@@ -104,18 +104,18 @@ export default function GlideSelect({
       p.style.opacity = '0';
       return;
     }
-    const jump = instant.current || (p.style.opacity !== '1' && !rememberPosition);
+    const jump = instant.current || p.style.opacity !== '1';
     p.style.transitionDuration = jump ? '0ms, 150ms' : '';
     p.style.transform = `translateY(${active * step}px)`;
     p.style.opacity = '1';
     instant.current = false;
-  }, [active, phase, rememberPosition, step]);
+  }, [active, phase, step]);
 
   const open = viaKey => {
     if (disabled) return;
     clearTimeout(closeTimer.current);
-    instant.current = !!viaKey;
-    setActive(viaKey ? Math.max(0, selected) : null);
+    instant.current = true;
+    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
     setPhase('open');
   };
   const close = mode => {
@@ -212,8 +212,8 @@ export default function GlideSelect({
     if (!scrub.current || scrub.current.id !== e.pointerId) return;
     const i = e.type === 'pointerup' ? rowAt(e.clientY) : null;
     scrub.current = null;
-    if (i === null) setActive(null);
-    else pick(i, false);
+    if (i !== null) pick(i, false);
+    else if (!rememberPosition) setActive(null);
   };
   const onListOver = e => {
     if (e.pointerType === 'touch' || scrub.current) return;
@@ -286,7 +286,7 @@ export default function GlideSelect({
             data-live={active !== null ? '' : undefined}
             onPointerOver={onListOver}
             onPointerLeave={() => {
-              if (!scrub.current) setActive(null);
+              if (!scrub.current && !rememberPosition) setActive(null);
             }}
             onPointerDown={onListDown}
             onPointerMove={onListMove}
```

**File**: `src/demo/Micro/GlideSelectDemo.jsx` (modified, +2/-1)
```diff
@@ -193,7 +193,8 @@ const GlideSelectDemo = () => {
         name: 'rememberPosition',
         type: 'boolean',
         default: 'true',
-        description: 'After leaving the list, re-entry glides from the row you left instead of fading in place.'
+        description:
+          'The highlight stays on the row the pointer left, so re-entry glides from there. Off, it clears on leave and the selected row shows again.'
       },
       { name: 'disabled', type: 'boolean', default: 'false', description: 'Dims the chip and ignores input.' },
       { name: 'ariaLabel', type: 'string', default: '"Select"', description: 'Accessible name of the chip and list.' },
```

**File**: `src/tailwind/Micro/GlideSelect/GlideSelect.jsx` (modified, +7/-7)
```diff
@@ -103,18 +103,18 @@ export default function GlideSelect({
       p.style.opacity = '0';
       return;
     }
-    const jump = instant.current || (p.style.opacity !== '1' && !rememberPosition);
+    const jump = instant.current || p.style.opacity !== '1';
     p.style.transitionDuration = jump ? '0ms, 150ms' : '';
     p.style.transform = `translateY(${active * step}px)`;
     p.style.opacity = '1';
     instant.current = false;
-  }, [active, phase, rememberPosition, step]);
+  }, [active, phase, step]);
 
   const open = viaKey => {
     if (disabled) return;
     clearTimeout(closeTimer.current);
-    instant.current = !!viaKey;
-    setActive(viaKey ? Math.max(0, selected) : null);
+    instant.current = true;
+    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
     setPhase('open');
   };
   const close = mode => {
@@ -211,8 +211,8 @@ export default function GlideSelect({
     if (!scrub.current || scrub.current.id !== e.pointerId) return;
     const i = e.type === 'pointerup' ? rowAt(e.clientY) : null;
     scrub.current = null;
-    if (i === null) setActive(null);
-    else pick(i, false);
+    if (i !== null) pick(i, false);
+    else if (!rememberPosition) setActive(null);
   };
   const onListOver = e => {
     if (e.pointerType === 'touch' || scrub.current) return;
@@ -299,7 +299,7 @@ export default function GlideSelect({
             data-live={active !== null ? '' : undefined}
             onPointerOver={onListOver}
             onPointerLeave={() => {
-              if (!scrub.current) setActive(null);
+              if (!scrub.current && !rememberPosition) setActive(null);
             }}
             onPointerDown={onListDown}
             onPointerMove={onListMove}
```

**File**: `src/ts-default/Micro/GlideSelect/GlideSelect.tsx` (modified, +7/-7)
```diff
@@ -136,18 +136,18 @@ const GlideSelect: React.FC<GlideSelectProps> = ({
       p.style.opacity = '0';
       return;
     }
-    const jump = instant.current || (p.style.opacity !== '1' && !rememberPosition);
+    const jump = instant.current || p.style.opacity !== '1';
     p.style.transitionDuration = jump ? '0ms, 150ms' : '';
     p.style.transform = `translateY(${active * step}px)`;
     p.style.opacity = '1';
     instant.current = false;
-  }, [active, phase, rememberPosition, step]);
+  }, [active, phase, step]);
 
   const open = (viaKey: boolean) => {
     if (disabled) return;
     clearTimeout(closeTimer.current);
-    instant.current = !!viaKey;
-    setActive(viaKey ? Math.max(0, selected) : null);
+    instant.current = true;
+    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
     setPhase('open');
   };
   const close = (mode: 'instant' | 'pop') => {
@@ -244,8 +244,8 @@ const GlideSelect: React.FC<GlideSelectProps> = ({
     if (!scrub.current || scrub.current.id !== e.pointerId) return;
     const i = e.type === 'pointerup' ? rowAt(e.clientY) : null;
     scrub.current = null;
-    if (i === null) setActive(null);
-    else pick(i, false);
+    if (i !== null) pick(i, false);
+    else if (!rememberPosition) setActive(null);
   };
   const onListOver = (e: React.PointerEvent<HTMLDivElement>) => {
     if (e.pointerType === 'touch' || scrub.current) return;
@@ -320,7 +320,7 @@ const GlideSelect: React.FC<GlideSelectProps> = ({
             data-live={active !== null ? '' : undefined}
             onPointerOver={onListOver}
             onPointerLeave={() => {
-              if (!scrub.current) setActive(null);
+              if (!scrub.current && !rememberPosition) setActive(null);
             }}
             onPointerDown={onListDown}
             onPointerMove={onListMove}
```

**File**: `src/ts-tailwind/Micro/GlideSelect/GlideSelect.tsx` (modified, +7/-7)
```diff
@@ -135,18 +135,18 @@ const GlideSelect: React.FC<GlideSelectProps> = ({
       p.style.opacity = '0';
       return;
     }
-    const jump = instant.current || (p.style.opacity !== '1' && !rememberPosition);
+    const jump = instant.current || p.style.opacity !== '1';
     p.style.transitionDuration = jump ? '0ms, 150ms' : '';
     p.style.transform = `translateY(${active * step}px)`;
     p.style.opacity = '1';
     instant.current = false;
-  }, [active, phase, rememberPosition, step]);
+  }, [active, phase, step]);
 
   const open = (viaKey: boolean) => {
     if (disabled) return;
     clearTimeout(closeTimer.current);
-    instant.current = !!viaKey;
-    setActive(viaKey ? Math.max(0, selected) : null);
+    instant.current = true;
+    setActive(selected >= 0 ? selected : viaKey ? 0 : null);
     setPhase('open');
   };
   const close = (mode: 'instant' | 'pop') => {
@@ -243,8 +243,8 @@ const GlideSelect: React.FC<GlideSelectProps> = ({
     if (!scrub.current || scrub.current.id !== e.pointerId) return;
     const i = e.type === 'pointerup' ? rowAt(e.clientY) : null;
     scrub.current = null;
-    if (i === null) setActive(null);
-    else pick(i, false);
+    if (i !== null) pick(i, false);
+    else if (!rememberPosition) setActive(null);
   };
   const onListOver = (e: React.PointerEvent<HTMLDivElement>) => {
     if (e.pointerType === 'touch' || scrub.current) return;
@@ -333,7 +333,7 @@ const GlideSelect: React.FC<GlideSelectProps> = ({
             data-live={active !== null ? '' : undefined}
             onPointerOver={onListOver}
             onPointerLeave={() => {
-              if (!scrub.current) setActive(null);
+              if (!scrub.current && !rememberPosition) setActive(null);
             }}
             onPointerDown={onListDown}
             onPointerMove={onListMove}
```

#### Recent Merged Pull Requests:
- **PR #1098** (2026-10-02): Fix incorrect component names in CLI install commands (@Copilot)
- **PR #1094** (closed): fix: restore mobile scrolling for background demos (@kod88vn)
- **PR #1093** (2026-10-03): fix(Masonry): clean up media query listeners on the original instances (@xiehuanyi)
- **PR #1092** (2026-09-19): fix: handle acronyms in ComponentList fromPascal conversion (@saimaneim)
- **PR #1090** (2026-09-18): Remove compromised Deepraj showcase link (@MauryaQbit)
- **PR #1088** (2026-09-19): Fix ASCIIText in light mode (@Brisk4t)
- **PR #1085** (2026-09-18): fix(ChromaGrid): add columns/rows props to tailwind variants for parity (@MauryaQbit)
- **PR #1084** (2026-09-18): fix(GlassSurface): initialize refs in Tailwind JS variant (@EvgenyPonomarevNova)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
