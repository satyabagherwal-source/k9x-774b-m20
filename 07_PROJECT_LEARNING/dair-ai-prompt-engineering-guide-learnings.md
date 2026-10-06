# Forensic Learning Record (Deep Inspection): dair-ai/Prompt-Engineering-Guide

> **Canonical Artifact**: `07_PROJECT_LEARNING/dair-ai-prompt-engineering-guide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dair-ai/Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:50:53.249Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dair-ai/Prompt-Engineering-Guide`
- **Description**: 🐙 Guides, papers, lessons, notebooks and resources for prompt engineering, context engineering, RAG, and AI Agents.
- **Primary Language / Ecosystem**: MDX
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 78845 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `components/AnnouncementBar.tsx`
```
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const AnnouncementBar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Watch for Nextra's mobile menu state by observing body classes
    const observer = new MutationObserver(() => {
      // Nextra adds nx-overflow-hidden class to body when menu is open
      const hasOverflowHidden = document.body.classList.contains('nx-overflow-hidden');
      setIsMenuOpen(hasOverflowHidden);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="announcement-bar"
      style={{
        width: '100%',
        backgroundColor: '#8b5cf6',
        color: 'white',
        padding: '10px 20px',
        textAlign: 'center',
        fontSize: '1rem',
        fontWeight: 500,
        borderBottom: '1px solid #7c3aed',
        display: isMenuOpen ? 'none' : 'block',
      }}
    >
      🚀 Learn to build apps with Claude Code! Use <strong style={{ fontWeight: 800, backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '4px', letterSpacing: '0.5px' }}>PROMPTING</strong> for 20% off{' '}
      <Link
        href="https://academy.dair.ai/courses/build-apps-with-claude-code"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          marginLeft: '8px',
          padding: '6px 16px',
          backgroundColor: 'white',
          color: '#8b5cf6',
          fontWeight: 'bold',
          textDecoration: 'none',
          borderRadius: '20px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#f3f4f6';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'white';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Enroll now →
      </Link>
    </div>
  );
};

export default AnnouncementBar;

```

### Core Architecture Module: `components/CodeBlock.tsx`
```
import React, { useRef, useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faCheck } from '@fortawesome/free-solid-svg-icons';

const CodeBlock = ({ children }) => {
  const textareaRef = useRef(null);
  const [codeString, setCodeString] = useState('');
  const [copied, setCopied] = useState(false);  // New state variable

  useEffect(() => {
    if (textareaRef.current) {
      setCodeString(textareaRef.current.textContent || '');
    }
  }, [children]);

  const handleCopyClick = () => {
    if (codeString) {
      navigator.clipboard.writeText(codeString).then(() => {
        setCopied(true); // Set copied state to true
        setTimeout(() => setCopied(false), 3000); // Reset after 3 seconds

        //alert('Code copied to clipboard!');
      }, () => {
        alert('Failed to copy code!');
      });
    }
  };

  return (
    <div style={{ position: 'relative', borderRadius: '5px', top: '20px' }}>
      <pre style={{ margin: 0, padding: '0px', fontSize: '1.1em' }}>
        <code ref={textareaRef} style={{fontSize: '0.9em' }}>
          {children}
        </code>
      </pre>
      <button 
        onClick={handleCopyClick} 
        style={{
          position: 'absolute', 
          top: '10px', 
          right: '10px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '0.5em',
          transition: 'color 0.3s',
        }}
        //onMouseOver={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.color = '#007bff'}
        //onMouseOut={(e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.style.color = 'black'}
      >
        <FontAwesomeIcon 
            icon={copied ? faCheck : faCopy}
            size="2x" 
            style={{ opacity: 0.5 }}
            onMouseOver={(e: React.MouseEvent<SVGSVGElement>) => e.currentTarget.style.opacity = '1'}
            onMouseOut={(e: React.MouseEvent<SVGSVGElement>) => e.currentTarget.style.opacity = '0.5'}
        />
      </button>
    </div>
  );
};

export default CodeBlock;

```

### Core Architecture Module: `components/ContentFileNames.tsx`
```
// components/ContentFileNames.tsx
import React, { useEffect, useState } from 'react';
import { Cards, Card } from 'nextra-theme-docs';
import { FilesIcon } from './icons';

const ContentFileNames = ({ section = 'research', lang = 'en' }) => {
  const [fileNames, setFileNames] = useState([]);

  useEffect(() => {
    fetch(`/api/contentFiles?section=${section}&lang=${lang}`)
      .then(response => response.json())
      .then(data => setFileNames(data.fileNames));
  }, [section, lang]);

  return (
    <Cards>
      {fileNames.map(({ slug, title }, index) => (
        <React.Fragment key={index}>
          <Card
            icon={<FilesIcon />}
            title={title}
            href={`/${section}/${slug}`}
            children={<></>}
          />
        </React.Fragment>
      ))}
    </Cards>
  );
};

export default ContentFileNames;

```

### Core Architecture Module: `components/CopyPageDropdown.tsx`
```
import React, { useState } from 'react';
import { useRouter } from 'next/router';

const CopyPageDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [markdownContent, setMarkdownContent] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success'>('idle');
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const router = useRouter();

  // Helper to get hover background color based on theme
  const getHoverBg = (buttonId: string) => {
    if (hoveredButton !== buttonId) return 'transparent';
    // Check if dark mode (this works with Nextra's dark mode)
    const isDark = document.documentElement.classList.contains('dark');
    return isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
  };

  // Get current page path
  const getPagePath = (): string => {
    const pathname = router.pathname;
    // Convert route path to file path (e.g., /guides/deep-research -> guides/deep-research.en.mdx)
    const cleanPath = pathname.replace(/^\//, '').replace(/\/$/, '');

    // Check if the path already ends with .en - if so, just add .mdx
    if (cleanPath.endsWith('.en')) {
      return `${cleanPath}.mdx`;
    }

    // Otherwise add .en.mdx
    return `${cleanPath}.en.mdx`;
  };

  // Cross-platform copy function with mobile fallback
  const copyToClipboard = async (text: string): Promise<void> => {
    // Try modern Clipboard API first (works in HTTPS contexts)
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        console.warn('Clipboard API failed, trying fallback:', error);
      }
    }

    // Enhanced fallback for mobile browsers
    return new Promise<void>((resolve, reject) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // Position off-screen but keep it in viewport for mobile compatibility
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '1px';
      textArea.style.height = '1px';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.style.fontSize = '16px'; // Prevent iOS zoom
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';

      // Don't use readonly - it prevents selection on some mobile browsers
      document.body.appendChild(textArea);

      // Focus and select
      textArea.focus();

      const isIOS = /ipad|iphone/i.test(navigator.userAgent);

      if (isIOS) {
        // iOS-specific handling
        const range = document.createRange();
        range.selectNodeContents(textArea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textArea.setSelectionRange(0, text.length);
      } else {
        // Standard selection for Android and others
        textArea.select();
        textArea.setSelectionRange(0, text.length);
      }

      // Wait a bit for selection to take effect on mobile
      setTimeout(() => {
        try {
          const successful = document.execCommand('copy');

          // Clean up after a short delay
          setTimeout(() => {
            document.body.removeChild(textArea);
          }, 100);

          if (successful) {
            resolve();
          } else {
            reject(new Error('Copy command was unsuccessful'));
          }
        } catch (error) {
          document.body.removeChild(textArea);
          reject(error);
        }
      }, 100);
    });
  };

  // Fetch page content from API
  const fetchPageContent = async (): Promise<string> => {
    const pagePath = getPagePath();
    console.log('Fetching page path:', pagePath);
    const response = await fetch(`/api/getPageContent?pagePath=${encodeURIComponent(pagePath)}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.error || 'Failed to fetch page content');
    }

    const data = await response.json();
    return data.content;
  };

  // Handle Copy as Markdown
  const handleCopyAsMarkdown = async () => {
    try {
      setCopyStatus('copying');
      const content = await fetchPageContent();
      await copyToClipboard(content);
      setCopyStatus('success');
      setTimeout(() => {
        setCopyStatus('idle');
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy:', error);
      setCopyStatus('idle');
      const errorMessage = error instanceof Error ? error.message : 'Failed to copy content';
      alert(errorMessage);
    }
  };

  // Handle View as Markdown
  const handleViewAsMarkdown = async () => {
    try {
      const content = await fetchPageContent();
      setMarkdownContent(content);
      setShowMarkdownModal(true);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to fetch content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load content';
      alert(errorMessage);
    }
  };

  // Handle Open in Claude
  const handleOpenInClaude = () => {
    const currentUrl = window.location.origin + router.asPath;
    // Convert .html or route to .md for Claude
    const mdUrl = currentUrl.replace(/\.html$/, '.md');
    const prompt = `Read from ${mdUrl} so I can ask questions about it.`;
    const claudeUrl = `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
    window.open(claudeUrl, '_blank');
    setIsOpen(false);
  };

  // Handle Open in ChatGPT
  const handleOpenInChatGPT = () => {
    const currentUrl = window.location.origin + router.asPath;
    const mdUrl = currentUrl.replace(/\.html$/, '.md');
    const prompt = `Read from ${mdUrl} so I can ask questions about it.`;
    const chatGPTUrl = `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`;
    window.open(chatGPTUrl, '_blank');
    setIsOpen(false);
  };

  // Copy markdown from modal
  const handleCopyFromModal = async () => {
    try {
      await copyToClipboard(markdownContent);
      alert('Content copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy content');
    }
  };

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800 nx-border nx-border-gray-200 dark:nx-border-neutral-700"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            backgroundColor: 'transparent',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            color: 'inherit',
            transition: 'all 0.2s ease',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy page
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {isOpen && (
          <div
            className="nx-bg-white dark:nx-bg-neutral-900 nx-border nx-border-gray-200 dark:nx-border-neutral-700"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              minWidth: '240px',
              zIndex: 50,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={handleCopyAsMarkdown}
              disabled={copyStatus === 'copying'}
              onMouseEnter={() => setHoveredButton('copy')}
              onMouseLeave={() => setHoveredButton(null)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: getHoverBg('copy'),
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.875rem',
                cursor: copyStatus === 'copying' ? 'wait' : 'pointer',
                textAlign: 'left',
                color: 'inherit',
                transition: 'background-color 0.15s ease',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
 
```

### Core Architecture Module: `components/CourseCard.tsx`
```
'use client'

import React, { useEffect, useState } from 'react'

interface CourseCardProps {
  tag: string
  tagColor?: 'blue' | 'green' | 'purple' | 'orange'
  title: string
  description: string
  href: string
  level?: string
  duration?: string
  isFree?: boolean
}

const tagColors = {
  blue: {
    bg: '#dbeafe',
    darkBg: '#1e3a5f',
    text: '#1e40af',
    darkText: '#93c5fd',
    border: '#93c5fd',
    darkBorder: '#3b82f6'
  },
  green: {
    bg: '#ecfccb',
    darkBg: '#1a2e05',
    text: '#365314',
    darkText: '#bef264',
    border: '#bef264',
    darkBorder: '#84cc16'
  },
  purple: {
    bg: '#f3e8ff',
    darkBg: '#2e1065',
    text: '#6b21a8',
    darkText: '#d8b4fe',
    border: '#d8b4fe',
    darkBorder: '#a855f7'
  },
  orange: {
    bg: '#ffedd5',
    darkBg: '#431407',
    text: '#9a3412',
    darkText: '#fdba74',
    border: '#fdba74',
    darkBorder: '#f97316'
  }
}

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }

    checkDarkMode()

    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return isDark
}

export const CourseCard = ({
  tag,
  tagColor = 'blue',
  title,
  description,
  href,
  level,
  duration,
  isFree
}: CourseCardProps) => {
  const isDark = useDarkMode()
  const colors = tagColors[tagColor]

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        backgroundColor: isDark ? '#1e293b' : 'white',
        borderRadius: '12px',
        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
        height: '100%'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.boxShadow = isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.boxShadow = isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Colored tag bar */}
      <div
        style={{
          backgroundColor: isDark ? colors.darkBg : colors.bg,
          borderBottom: `2px solid ${isDark ? colors.darkBorder : colors.border}`,
          padding: '8px 16px',
          fontSize: '12px',
          fontWeight: 600,
          color: isDark ? colors.darkText : colors.text,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
      >
        {tag}
      </div>

      {/* Card content */}
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1
      }}>
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '18px',
            fontWeight: 700,
            color: isDark ? '#f1f5f9' : '#111827',
            lineHeight: 1.3
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: '0',
            fontSize: '14px',
            color: isDark ? '#94a3b8' : '#6b7280',
            lineHeight: 1.6,
            flex: 1
          }}
        >
          {description}
        </p>

        {/* Metadata footer */}
        {(level || duration) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '12px',
              marginTop: '16px',
              borderTop: `1px dashed ${isDark ? '#475569' : '#e5e7eb'}`,
              fontSize: '13px',
              color: isDark ? '#94a3b8' : '#6b7280'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{level}</span>
            </div>
            {duration && (
              <span style={{ fontWeight: 500 }}>{duration}</span>
            )}
          </div>
        )}
      </div>
    </a>
  )
}

interface CoursesSectionProps {
  title?: string
  children: React.ReactNode
}

export const CoursesSection = ({
  title = "Related Learning",
  children
}: CoursesSectionProps) => {
  const isDark = useDarkMode()

  return (
    <div
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        borderRadius: '16px',
        padding: '24px',
        marginTop: '32px',
        border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
      }}
    >
      <h2
        style={{
          margin: '0 0 20px 0',
          fontSize: '20px',
          fontWeight: 700,
          color: isDark ? '#f1f5f9' : '#1e293b'
        }}
      >
        {title}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}
      >
        {children}
      </div>
    </div>
  )
}

// Single card variant for inline use
export const CoursePromo = ({
  title = "Want to learn more?",
  description = "Learn more about advanced prompt engineering techniques and best practices in our AI courses.",
  href = "https://academy.dair.ai/",
  buttonText = "Explore Courses",
  promoCode
}: {
  title?: string
  description?: string
  href?: string
  buttonText?: string
  promoCode?: string
}) => {
  const isDark = useDarkMode()

  return (
    <div
      style={{
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        borderRadius: '12px',
        padding: '24px',
        marginTop: '24px',
        border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        <div
          style={{
            backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
            borderRadius: '10px',
            padding: '12px',
            flexShrink: 0
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#60a5fa' : '#2563eb'} strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: 700,
              color: isDark ? '#f1f5f9' : '#1e293b'
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: '0 0 16px 0',
              fontSize: '14px',
              color: isDark ? '#94a3b8' : '#64748b',
              lineHeight: 1.6
            }}
          >
            {description}
            {promoCode && (
              <span style={{ display: 'block', marginTop: '8px', fontWeight: 500, color: isDark ? '#cbd5e1' : '#475569' }}>
                Use code <code style={{
                  backgroundColor: isDark ? '#78350f' : '#fef3c7',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  color: isDark ? '#fcd34d' : '#92400e'
                }}>{promoCode}</code> for 20% off!
              </span>
            )}
          </p>

          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1d4ed8'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb'
            }}
          >
            {buttonText}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}

```

### Core Architecture Module: `components/PromptFiles.jsx`
```
// components/PromptFiles.js
import React, { useEffect, useState } from 'react';
import { Cards, Card } from 'nextra-theme-docs';
import { FilesIcon } from './icons'; // Ensure this path is correct for your project

const PromptFiles = ({ lang = 'en' }) => {
  const [promptsData, setPromptsData] = useState([]);

  useEffect(() => {
    // Fetch the data from the API
    fetch(`/api/promptsFiles?lang=${lang}`)
      .then((response) => response.json())
      .then((data) => {
        // Assuming the API returns data structured as an array of objects
        setPromptsData(data);
    })
    .catch((error) => {
    console.error('Error fetching prompt files:', error);
    });
    }, [lang]);
    
    return (
        <div>
        {promptsData.map(({ folderKey, folderName, files }) => (
        <section key={folderKey}>
        <br></br>
        <h2 class="nx-font-semibold nx-tracking-tight nx-text-slate-900 dark:nx-text-slate-100 nx-mt-10 nx-border-b nx-pb-1 nx-text-3xl nx-border-neutral-200/70 contrast-more:nx-border-neutral-400 dark:nx-border-primary-100/10 contrast-more:dark:nx-border-neutral-400">{folderName}
        <a href={`#${folderKey}`} id={folderKey} class="subheading-anchor" aria-label="Permalink for this section"></a>
        </h2>
        <Cards>
        {files.map(({ slug, title }) => (
        <Card
        key={slug}
        icon={<FilesIcon />} // This should be the icon component you want to use
        title={title}
        href={`/prompts/${folderKey}/${slug}`} // Adjust the href to match your routing pattern
        >
        {/* Additional content for each card, if any, goes here */}
        </Card>
        ))}
        </Cards>
        </section>
        ))}
        </div>
    );
    };
    
    export default PromptFiles;
    
    

```

### Core Architecture Module: `components/TabsComponent.tsx`
```
// In components/TabsComponent.tsx
import React from 'react';
import { Tabs, Tab } from 'nextra/components';

interface TabInfo {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
}

interface TabsComponentProps {
    tabsData: TabInfo[];
}

const TabsComponent: React.FC<TabsComponentProps> = ({ tabsData }) => {
    const renderCodeBlock = (tab: TabInfo) => {
        return `
from openai import OpenAI
client = OpenAI()

response = client.chat.completions.create(
    model="${tab.model}",
    messages=${JSON.stringify(tab.messages, null, 4)},
    temperature=1,
    max_tokens=${tab.max_tokens},
    top_p=1,
    frequency_penalty=0,
    presence_penalty=0
)
        `;
    };

    return (
        <Tabs items={tabsData.map(tab => tab.model)} children={
            tabsData.map((tab, index) => (
                <Tab key={index}>
                    <pre><code data-language="python">{renderCodeBlock(tab)}</code></pre>
                </Tab>
            ))
        } />
    );
};

export default TabsComponent;

```

### Core Architecture Module: `components/button.tsx`
```
import cn from 'clsx'
import type { ReactNode, ReactElement } from 'react'

interface ButtonProps {
  children?: ReactNode
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  title?: string
  tabIndex?: number
}

export const Button = ({
  children,
  className,
  onClick,
  type = 'button',
  disabled,
  title,
  tabIndex
}: ButtonProps): ReactElement => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      tabIndex={tabIndex}
      className={cn(
        'nextra-button nx-transition-all active:nx-opacity-50',
        'nx-bg-primary-700/5 nx-border nx-border-black/5 nx-text-gray-600 hover:nx-text-gray-900 nx-rounded-md nx-p-1.5',
        'dark:nx-bg-primary-300/10 dark:nx-border-white/10 dark:nx-text-gray-400 dark:hover:nx-text-gray-50',
        className
      )}
    >
      {children}
    </button>
  )
}

```

### Core Architecture Module: `components/check.tsx`
```
import type { ReactElement, SVGAttributes } from 'react'

export function CheckIcon(props: SVGAttributes<SVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      width="1em"
      height="1em"
      fill="currentColor"
      {...(props as any)}
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

```

### Core Architecture Module: `components/copy-to-clipboard.tsx`
```
'use client'

import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { CheckIcon } from './check'
import { CopyIcon } from './copy'
import { Button } from './button'

interface CopyToClipboardProps {
  getValue: () => string
  className?: string
}

export const CopyToClipboard = ({
  getValue,
  className
}: CopyToClipboardProps): ReactElement => {
  const [isCopied, setCopied] = useState(false)

  useEffect(() => {
    if (!isCopied) return
    const timerId = setTimeout(() => {
      setCopied(false)
    }, 2000)

    return () => {
      clearTimeout(timerId)
    }
  }, [isCopied])

  const handleClick = useCallback(async () => {
    setCopied(true)
    if (!navigator?.clipboard) {
      console.error('Access to clipboard rejected!')
    }
    try {
      await navigator.clipboard.writeText(getValue())
    } catch {
      console.error('Failed to copy!')
    }
  }, [getValue])

  const IconToUse = isCopied ? CheckIcon : CopyIcon

  return (
    <Button onClick={handleClick} className={className}>
      <IconToUse className="nextra-copy-icon nx-pointer-events-none nx-h-4 nx-w-4" />
    </Button>
  )
}

```

### Core Architecture Module: `components/copy.tsx`
```
import type { ReactElement, SVGAttributes } from 'react'

export function CopyIcon(props: SVGAttributes<SVGElement>): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      {...(props as any)}
    >
      <rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

```

### Core Architecture Module: `components/counters.tsx`
```
// Example from https://beta.reactjs.org/learn

import { useState } from 'react'
import styles from './counters.module.css'

function MyButton() {
  const [count, setCount] = useState(0)

  function handleClick() {
    setCount(count + 1)
  }

  return (
    <div>
      <button onClick={handleClick} className={styles.counter}>
        Clicked {count} times
      </button>
    </div>
  )
}

export default function MyApp() {
  return <MyButton />
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #814** (2026-09-26): **gh repo clone HanSEOHafen/ai-boost.github.io**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @HanSEOHafen is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22b97d88a3715bfad2eaf8c023203a88a2aceef44b%22%7D%2C%22id%22%3A%22QmUEzrSqvcKt9zqqy4nKNshpUTdBe3ciMA1XbBbn9EWB4w%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A814%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  

- **Issue #803** (2026-08-29): **fix: repair broken link in Spanish few-shot page**
  *Symptoms*: Fixes #533  Corrects the malformed Chain-of-Thought link in the Spanish few-shot prompting page.  Verification: - Confirmed the old malformed pattern is absent. - Confirmed the corrected link appears exactly once. - Confirmed the target URL returns HTTP 200. - Ran `pnpm install --frozen-lockfile`. - Ran `pnpm build` (14,790/14,790 static pages). - Ran `git diff --check`.
  **Post-Mortem & Fix Analysis**:
  > @JulianZJN is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22d0bed94ee3941dea5e57a3000bcc3e283c54cb26%22%7D%2C%22id%22%3A%22QmdkGqWEz71WASunGvdRHCGUAdt28bA2BvdSDqmyr9bQSb%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A803%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  
  > Friendly follow-up: this PR is still a one-line fix for the malformed Chain-of-Thought link in the Spanish few-shot page. The target URL returns 200, the old malformed pattern is gone, and the full static build completed successfully (`14,790/14,790` pages).  The Vercel preview is only waiting for DAIR-AI team authorization; it has not reported a code or build failure. Could a maintainer take a look when convenient?

- **Issue #799** (2026-07-31): **Add files via upload**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > @abdbali is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224535edfce6fb07cfa13a370233187b4213bdc821%22%7D%2C%22id%22%3A%22QmZfbfY7hSA7tv324kgqSLiu78QS69pPjx3H2mwmkEPwDH%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A799%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  
  > > @abdbali is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com). >  > A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224535edfce6fb07cfa13a370233187b4213bdc821%22%7D%2C%22id%22%3A%22QmZfbfY7hSA7tv324kgqSLiu78QS69pPjx3H2mwmkEPwDH%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A799%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  

- **Issue #789** (2026-07-11): **Add Spanish translation for Reflexion page**
  *Symptoms*: Translates the Reflexion techniques page into Spanish (it was previously a translation placeholder). Only prose was translated; imports, links, images, the quoted excerpt, and MDX component tags were kept intact.
  **Post-Mortem & Fix Analysis**:
  > @pacocartones is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22d5b03b626c7a15af5432c08518350f8c223d9164%22%7D%2C%22id%22%3A%22QmQi9W7mE8nPx76n3Y5kW41GQVFSVoyyA8xQGkRYZVz23B%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A789%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  

- **Issue #788** (2026-07-11): **Add Spanish translation for Trustworthiness in LLMs page**
  *Symptoms*: Translates the Trustworthiness in LLMs research page into Spanish (it was previously a translation placeholder). Only prose was translated; imports, links, images, and MDX component tags were kept intact.
  **Post-Mortem & Fix Analysis**:
  > @pacocartones is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2215887c60487206065ad6bda3fc2da6a2137899c0%22%7D%2C%22id%22%3A%22QmPADSCtjse1y8QQEaLXyELSnd5WqXGqTBRAQehnhAeQYX%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A788%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  

- **Issue #786** (2026-07-11): **Add Spanish translation for ART page**
  *Symptoms*: Translates the ART (Automatic Reasoning and Tool-use) techniques page into Spanish (it was previously a translation placeholder). Only prose was translated; imports, links, images and MDX component tags were kept intact.
  **Post-Mortem & Fix Analysis**:
  > @pacocartones is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2213940bc3d1248717f1b08624e277ed5c546e4663%22%7D%2C%22id%22%3A%22Qmds3NKVFJicXpsSxAqDqCT41yb6gypyrhEL6s8fBGhV1J%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A786%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  

- **Issue #785** (2026-07-11): **Add Spanish translation for function_calling page**
  *Symptoms*: Translates the function calling applications page into Spanish (it was previously a translation placeholder). Only prose was translated; code blocks, imports, links and MDX component tags were kept intact.
  **Post-Mortem & Fix Analysis**:
  > @pacocartones is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%220b00a77c918eba361714decab87ea448dd78fabe%22%7D%2C%22id%22%3A%22QmYLfzJW97SiKUnfZPG7MQaoZ8FTT3BfnPp8nNQmwbJrak%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A785%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  

- **Issue #775** (2026-07-18): **Add Future AGI**
  *Symptoms*: This PR adds Future AGI to this list in the **Tools & Libraries** section.  [Future AGI](https://github.com/future-agi/future-agi) is an open-source (Apache-2.0), self-hostable platform for evaluating, tracing, and guardrailing LLM and AI agent apps, with 70+ eval metrics and LLM-as-judge.  The entry follows the list's existing format and placement conventions.  Disclosure: I'm affiliated with Future AGI.
  **Post-Mortem & Fix Analysis**:
  > Someone is attempting to deploy a commit to the **DAIR-AI** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=DAIR-AI&slug=dair-ai&teamId=team_CvmleOihKf7h7KltunfusY7j&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224661f5e596c9b1d94f863b9bbd90fc9f309cee35%22%7D%2C%22id%22%3A%22QmNnWvRoTUVxMr5fXkLR8yFSn8VZAaEcTo6SgGmnzzPquP%22%2C%22org%22%3A%22dair-ai%22%2C%22prId%22%3A775%2C%22repo%22%3A%22Prompt-Engineering-Guide%22%7D).  
  > Hi [@dair-ai](https://github.com/dair-ai), following up on this PR. Let me know if any changes are needed on my end to get it merged. Thanks!

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

### Incident Patch 1: `a229d389` (2026-01-16)
**Commit Message**: Update Claude Code course link to cohort 3 and add guide images

- Update announcement bar link to claude-code-for-everyone-cohort-3
- Change coupon code to EARLYBIRDCC3
- Add Claude Code guide images to img/claude-code/

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `components/AnnouncementBar.tsx` (modified, +2/-2)
```diff
@@ -34,9 +34,9 @@ const AnnouncementBar: React.FC = () => {
         display: isMenuOpen ? 'none' : 'block',
       }}
     >
-      🚀 Master building AI workflows and agents with Claude Code! Use <strong style={{ fontWeight: 'bold' }}>AGENTX20</strong> for 20% off{' '}
+      🚀 Master building AI workflows and agents with Claude Code! Use <strong style={{ fontWeight: 'bold' }}>EARLYBIRDCC3</strong> for 20% off{' '}
       <Link
-        href="https://dair-ai.thinkific.com/courses/claude-code-for-everyone-2"
+        href="https://dair-ai.thinkific.com/courses/claude-code-for-everyone-cohort-3"
         target="_blank"
         rel="noopener noreferrer"
         style={{
```

---

### Incident Patch 2: `8edb8870` (2025-12-29)
**Commit Message**: Fix mobile UI issues: hide logo text and announcement bar on menu open

- Hide "Prompt Engineering Guide" text on mobile, show only logo icon
- Hide announcement bar when mobile hamburger menu is opened to prevent
  black empty space at top of menu overlay
- Use MutationObserver to detect Nextra's nx-overflow-hidden class on body

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `components/AnnouncementBar.tsx` (modified, +21/-1)
```diff
@@ -1,9 +1,28 @@
-import React from 'react';
+import React, { useEffect, useState } from 'react';
 import Link from 'next/link';
 
 const AnnouncementBar: React.FC = () => {
+  const [isMenuOpen, setIsMenuOpen] = useState(false);
+
+  useEffect(() => {
+    // Watch for Nextra's mobile menu state by observing body classes
+    const observer = new MutationObserver(() => {
+      // Nextra adds nx-overflow-hidden class to body when menu is open
+      const hasOverflowHidden = document.body.classList.contains('nx-overflow-hidden');
+      setIsMenuOpen(hasOverflowHidden);
+    });
+
+    observer.observe(document.body, {
+      attributes: true,
+      attributeFilter: ['class'],
+    });
+
+    return () => observer.disconnect();
+  }, []);
+
   return (
     <div
+      className="announcement-bar"
       style={{
         width: '100%',
         backgroundColor: '#8b5cf6',
@@ -12,6 +31,7 @@ const AnnouncementBar: React.FC = () => {
         textAlign: 'center',
         fontSize: '0.9rem',
         borderBottom: '1px solid #7c3aed',
+        display: isMenuOpen ? 'none' : 'block',
       }}
     >
       🚀 Master building AI workflows and agents with Claude Code! Use <strong style={{ fontWeight: 'bold' }}>AGENTX20</strong> for 20% off{' '}
```

**File**: `pages/style.css` (modified, +9/-1)
```diff
@@ -1 +1,9 @@
-pre { white-space: pre-wrap; }
\ No newline at end of file
+pre { white-space: pre-wrap; }
+
+/* Mobile responsive styles */
+@media (max-width: 768px) {
+  /* Hide logo text on mobile, show only icon */
+  .logo-text {
+    display: none;
+  }
+}
\ No newline at end of file
```

**File**: `theme.config.tsx` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ const config: DocsThemeConfig = {
         <circle cx="40" cy="206" r="40" fill="currentColor"/>
         <circle cx="166" cy="120" r="40" fill="currentColor"/>
       </svg>
-      <span style={{ marginLeft: '.4em', fontWeight: 800 }}>
+      <span className="logo-text" style={{ marginLeft: '.4em', fontWeight: 800 }}>
         Prompt Engineering Guide
       </span>
     </>
```

---

### Incident Patch 3: `4e3d871a` (2025-12-28)
**Commit Message**: Add CourseCard component and update docs with new course promotion UI

Replace Callout-based course promotions with new CourseCard, CoursesSection, and CoursePromo components across all introduction and techniques pages. The new components provide a cleaner, more visually appealing way to promote courses with dark mode support.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `components/CourseCard.tsx` (added, +340/-0)
```diff
@@ -0,0 +1,340 @@
+'use client'
+
+import React, { useEffect, useState } from 'react'
+
+interface CourseCardProps {
+  tag: string
+  tagColor?: 'blue' | 'green' | 'purple' | 'orange'
+  title: string
+  description: string
+  href: string
+  level?: string
+  duration?: string
+  isFree?: boolean
+}
+
+const tagColors = {
+  blue: {
+    bg: '#dbeafe',
+    darkBg: '#1e3a5f',
+    text: '#1e40af',
+    darkText: '#93c5fd',
+    border: '#93c5fd',
+    darkBorder: '#3b82f6'
+  },
+  green: {
+    bg: '#ecfccb',
+    darkBg: '#1a2e05',
+    text: '#365314',
+    darkText: '#bef264',
+    border: '#bef264',
+    darkBorder: '#84cc16'
+  },
+  purple: {
+    bg: '#f3e8ff',
+    darkBg: '#2e1065',
+    text: '#6b21a8',
+    darkText: '#d8b4fe',
+    border: '#d8b4fe',
+    darkBorder: '#a855f7'
+  },
+  orange: {
+    bg: '#ffedd5',
+    darkBg: '#431407',
+    text: '#9a3412',
+    darkText: '#fdba74',
+    border: '#fdba74',
+    darkBorder: '#f97316'
+  }
+}
+
+const useDarkMode = () => {
+  const [isDark, setIsDark] = useState(false)
+
+  useEffect(() => {
+    const checkDarkMode = () => {
+      setIsDark(document.documentElement.classList.contains('dark'))
+    }
+
+    checkDarkMode()
+
+    const observer = new MutationObserver(checkDarkMode)
+    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
+
+    return () => observer.disconnect()
+  }, [])
+
+  return isDark
+}
+
+export const CourseCard = ({
+  tag,
+  tagColor = 'blue',
+  title,
+  description,
+  href,
+  level,
+  duration,
+  isFree
+}: CourseCardProps) => {
+  const isDark = useDarkMode()
+  const colors = tagColors[tagColor]
+
+  return (
+    <a
+      href={href}
+      target="_blank"
+      rel="noopener noreferrer"
+      style={{
+        display: 'flex',
+        flexDirection: 'column',
+        textDecoration: 'none',
+        color: 'inherit',
+        backgroundColor: isDark ? '#1e293b' : 'white',
+        borderRadius: '12px',
+        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`,
+        overflow: 'hidden',
+        transition: 'all 0.2s ease',
+        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
+        height: '100%'
+      }}
+      onMouseOver={(e) => {
+        e.currentTarget.style.boxShadow = isDark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.1)'
+        e.currentTarget.style.transform = 'translateY(-2px)'
+      }}
+      onMouseOut={(e) => {
+        e.currentTarget.style.boxShadow = isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
+        e.currentTarget.style.transform = 'translateY(0)'
+      }}
+    >
+      {/* Colored tag bar */}
+      <div
+        style={{
+          backgroundColor: isDark ? colors.darkBg : colors.bg,
+          borderBottom: `2px solid ${isDark ? colors.darkBorder : colors.border}`,
+          padding: '8px 16px',
+          fontSize: '12px',
+          fontWeight: 600,
+          color: isDark ? colors.darkText : colors.text,
+          textTransform: 'uppercase',
+          letterSpacing: '0.5px'
+        }}
+      >
+        {tag}
+      </div>
+
+      {/* Card content */}
+      <div style={{
+        padding: '20px',
+        display: 'flex',
+        flexDirection: 'column',
+        flex: 1
+      }}>
+        <h3
+          style={{
+            margin: '0 0 12px 0',
+            fontSize: '18px',
+            fontWeight: 700,
+            color: isDark ? '#f1f5f9' : '#111827',
+            lineHeight: 1.3
+          }}
+        >
+          {title}
+        </h3>
+
+        <p
+          style={{
+            margin: '0',
+            fontSize: '14px',
+            color: isDark ? '#94a3b8' : '#6b7280',
+            lineHeight: 1.6,
+            flex: 1
+          }}
+        >
+          {description}
+        </p>
+
+        {/* Metadata footer */}
+        {(level || duration) && (
+          <div
+            style={{
+              display: 'flex',
+              justifyContent: 'space-between',
+              alignItems: 'center',
+              paddingTop: '12px',
+              marginTop: '16px',
+              borderTop: `1px dashed ${isDark ? '#475569' : '#e5e7eb'}`,
+              fontSize: '13px',
+              color: isDark ? '#94a3b8' : '#6b7280'
+            }}
+          >
+            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
+              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
+                <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round"/>
+              </svg>
+              <span>{level}</span>
+            </div>
+            {duration && (
+              <span style={{ fontWeight: 500 }}>{duration}</span>
+            )}
+          </div>
+        )}
+      </div>
+    </a>
+  )
+}
+
+interface CoursesSectionProps {
+  title?: string
+  children: React.ReactNode
+}
+
+export const CoursesSection = ({
+  title =
```

**File**: `pages/index.en.mdx` (modified, +29/-7)
```diff
@@ -1,6 +1,6 @@
 # Prompt Engineering Guide
 
-import { Callout } from 'nextra/components'
+import { CoursePromo, CoursesSection, CourseCard } from '../components/CourseCard'
 
 Prompt engineering is a relatively new discipline for developing and optimizing prompts to efficiently use language models (LMs) for a wide variety of applications and research topics. Prompt engineering skills help to better understand the capabilities and limitations of large language models (LLMs).
 
@@ -12,9 +12,31 @@ Motivated by the high interest in developing with LLMs, we have created this new
 
 ---
 
-## Want to learn more?
-
-<Callout type= "info" emoji="🎓">
-Learn more about advanced prompt engineering techniques and best practices in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Learn essential prompt engineering techniques to get the most out of large language models. From basic prompting to advanced strategies."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
```

**File**: `pages/introduction/basics.en.mdx` (modified, +29/-5)
```diff
@@ -3,7 +3,7 @@
 import {Screenshot} from 'components/screenshot'
 import INTRO1 from '../../img/introduction/sky.png'
 import {Bleed} from 'nextra-theme-docs'
-import { Callout } from 'nextra/components'
+import { CoursePromo, CoursesSection, CourseCard } from '../../components/CourseCard'
 
 ## Prompting an LLM
 
@@ -145,7 +145,31 @@ Negative
 
 Few-shot prompts enable in-context learning, which is the ability of language models to learn tasks given a few demonstrations. We discuss zero-shot prompting and few-shot prompting more extensively in upcoming sections.
 
-<Callout type= "info" emoji="🎓">
-Learn more about advanced prompting methods in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Master zero-shot, few-shot, and advanced prompting methods to get better results from large language models."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
```

**File**: `pages/introduction/elements.en.mdx` (modified, +29/-5)
```diff
@@ -1,7 +1,7 @@
 # Elements of a Prompt
 
 import {Bleed} from 'nextra-theme-docs'
-import { Callout } from 'nextra/components'
+import { CoursePromo, CoursesSection, CourseCard } from '../../components/CourseCard'
 
 As we cover more and more examples and applications with prompt engineering, you will notice that certain elements make up a prompt. 
 
@@ -37,8 +37,32 @@ In the prompt example above, the instruction correspond to the classification ta
 
 You do not need all the four elements for a prompt and the format depends on the task at hand. We will touch on more concrete examples in upcoming guides.
 
-<Callout type= "info" emoji="🎓">
-Learn more about advanced prompting methods in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Master zero-shot, few-shot, and advanced prompting methods to get better results from large language models."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
 
```

**File**: `pages/introduction/examples.en.mdx` (modified, +30/-7)
```diff
@@ -3,7 +3,7 @@
 import {Cards, Card} from 'nextra-theme-docs'
 import {CodeIcon} from 'components/icons'
 import {Bleed} from 'nextra-theme-docs'
-import {Callout} from 'nextra-theme-docs'
+import { CoursePromo, CoursesSection, CourseCard } from '../../components/CourseCard'
 
 The previous section introduced a basic example of how to prompt LLMs. 
 
@@ -26,12 +26,6 @@ Topics:
   allowFullScreen
   />
 
-<Callout type="info" emoji="🎓">
-Learn more about prompting techniques and examples in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
-
-
 ## Text Summarization
 One of the standard tasks in natural language generation is text summarization. Text summarization can include many different flavors and domains. In fact, one of the most promising applications of language models is the ability to summarize articles and concepts into quick and easy-to-read summaries. Let's try a basic summarization task using prompts.
 
@@ -316,3 +310,32 @@ If you want to practice with the prompts above using Python, we have prepared a
     />
 </Cards>
 
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Learn hands-on examples of text summarization, classification, code generation, and reasoning with LLMs."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
+
```

**File**: `pages/introduction/settings.en.mdx` (modified, +29/-5)
```diff
@@ -1,7 +1,7 @@
 # LLM Settings
 
 import {Bleed} from 'nextra-theme-docs'
-import {Callout} from 'nextra-theme-docs'
+import { CoursePromo, CoursesSection, CourseCard } from '../../components/CourseCard'
 
 <iframe width="100%"
   height="415px"
@@ -29,7 +29,31 @@ Similar to `temperature` and `top_p`, the general recommendation is to alter the
 
 Before starting with some basic examples, keep in mind that your results may vary depending on the version of LLM you use.
 
-<Callout type= "info" emoji="🎓">
-Learn more about LLM settings in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Learn how to configure temperature, top-p, and other LLM parameters for optimal results in our comprehensive course."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
```

**File**: `pages/introduction/tips.en.mdx` (modified, +30/-6)
```diff
@@ -1,7 +1,7 @@
 # General Tips for Designing Prompts
 
 import {Bleed} from 'nextra-theme-docs'
-import {Callout} from 'nextra-theme-docs'
+import { CoursePromo, CoursesSection, CourseCard } from '../../components/CourseCard'
 
 <iframe width="100%"
   height="415px"
@@ -64,11 +64,6 @@ Place: Champalimaud Centre for the Unknown, Lisbon
 
 Input text is obtained from [this Nature article](https://www.nature.com/articles/d41586-023-00509-z).
 
-<Callout type= "info" emoji="🎓">
-Learn more about prompting techniques and examples in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
-
 ### Avoid Impreciseness
 
 Given the tips above about being detailed and improving format, it's easy to fall into the trap of wanting to be too clever about prompts and potentially creating imprecise descriptions. It's often better to be specific and direct. The analogy here is very similar to effective communication -- the more direct, the more effective the message gets across.
@@ -119,3 +114,32 @@ Sorry, I don't have any information about your interests. However, here's a list
 ```
 
 Some of the examples above were adopted from the ["Best practices for prompt engineering with OpenAI API" article.](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-openai-api)
+
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Master prompt design techniques including specificity, formatting, and instruction crafting for better LLM results."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
```

**File**: `pages/techniques/activeprompt.en.mdx` (modified, +30/-5)
```diff
@@ -1,6 +1,7 @@
 # Active-Prompt
 
-import { Callout, FileTree } from 'nextra-theme-docs'
+import { FileTree } from 'nextra-theme-docs'
+import { CoursePromo, CoursesSection, CourseCard } from '../../components/CourseCard'
 import {Screenshot} from 'components/screenshot'
 import ACTIVE from '../../img/active-prompt.png'
 
@@ -11,7 +12,31 @@ Below is an illustration of the approach. The first step is to query the LLM wit
 <Screenshot src={ACTIVE} alt="ACTIVE" />
 Image Source: [Diao et al., (2023)](https://arxiv.org/pdf/2302.12246.pdf)
 
-<Callout type= "info" emoji="🎓">
-Learn more about advanced prompting methods in our new AI courses. [Join now!](https://dair-ai.thinkific.com/)
-Use code PROMPTING20 to get an extra 20% off.
-</Callout>
+<CoursesSection title="Related Learning">
+  <CourseCard
+    tag="Course"
+    tagColor="blue"
+    title="Prompt Engineering for LLMs"
+    description="Master Active-Prompt, chain-of-thought, and advanced prompting techniques for better LLM performance."
+    href="https://dair-ai.thinkific.com/courses/introduction-prompt-engineering"
+    level="Beginner"
+    duration="2 hours"
+  />
+  <CourseCard
+    tag="Course"
+    tagColor="purple"
+    title="Building Effective AI Agents"
+    description="Learn to build effective AI agents. Covers function calling, tool integration, and debugging agentic systems."
+    href="https://dair-ai.thinkific.com/courses/agents-with-n8n"
+    level="Intermediate"
+    duration="5 hours"
+  />
+</CoursesSection>
+
+<CoursePromo
+  title="Explore All Courses"
+  description="Discover our full catalog of AI and prompt engineering courses. From beginners to advanced practitioners."
+  href="https://dair-ai.thinkific.com/"
+  buttonText="Browse Academy"
+  promoCode="PROMPTING20"
+/>
```

---

### Incident Patch 4: `2148331e` (2025-12-28)
**Commit Message**: Fix main component type with explicit typing and cast

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `theme.config.tsx` (modified, +4/-4)
```diff
@@ -89,13 +89,13 @@ const config: DocsThemeConfig = {
   components: {
     pre: Pre,
   },
-  main: ({ children }) => {
+  main: ({ children }: { children: React.ReactNode }) => {
     const router = useRouter();
     // Only show on English pages (not index page)
     const isEnglishPage = router.locale === 'en' && router.pathname !== '/';
 
     return (
-      <div>
+      <>
         {isEnglishPage && (
           <div style={{
             display: 'flex',
@@ -109,8 +109,8 @@ const config: DocsThemeConfig = {
           </div>
         )}
         {children}
-      </div>
-    );
+      </>
+    ) as React.ReactElement;
   },
   navbar: {
     extraContent: (
```

---

### Incident Patch 5: `bdf43886` (2025-12-28)
**Commit Message**: Fix TypeScript type conflicts in all components

- Use explicit interfaces instead of ComponentProps to avoid
  csstype version conflicts between dependencies
- Simplified SVG icon components with type assertions
- Simplified copy-to-clipboard and pre components

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `components/check.tsx` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
-import type { ComponentProps, ReactElement } from 'react'
+import type { ReactElement, SVGAttributes } from 'react'
 
-export function CheckIcon(props: ComponentProps<'svg'>): ReactElement {
+export function CheckIcon(props: SVGAttributes<SVGElement>): ReactElement {
   return (
     <svg
       viewBox="0 0 20 20"
       width="1em"
       height="1em"
       fill="currentColor"
-      {...props}
+      {...(props as any)}
     >
       <path
         fillRule="evenodd"
```

**File**: `components/copy-to-clipboard.tsx` (modified, +10/-9)
```diff
@@ -1,17 +1,20 @@
 'use client'
 
-import type { ComponentProps, ReactElement } from 'react'
+import type { ReactElement } from 'react'
 import { useCallback, useEffect, useState } from 'react'
 import { CheckIcon } from './check'
 import { CopyIcon } from './copy'
 import { Button } from './button'
 
+interface CopyToClipboardProps {
+  getValue: () => string
+  className?: string
+}
+
 export const CopyToClipboard = ({
   getValue,
-  ...props
-}: {
-  getValue: () => string
-} & ComponentProps<'button'>): ReactElement => {
+  className
+}: CopyToClipboardProps): ReactElement => {
   const [isCopied, setCopied] = useState(false)
 
   useEffect(() => {
@@ -25,9 +28,7 @@ export const CopyToClipboard = ({
     }
   }, [isCopied])
 
-  const handleClick = useCallback<
-    NonNullable<ComponentProps<'button'>['onClick']>
-  >(async () => {
+  const handleClick = useCallback(async () => {
     setCopied(true)
     if (!navigator?.clipboard) {
       console.error('Access to clipboard rejected!')
@@ -42,7 +43,7 @@ export const CopyToClipboard = ({
   const IconToUse = isCopied ? CheckIcon : CopyIcon
 
   return (
-    <Button onClick={handleClick} title="Copy code" tabIndex={0} {...props}>
+    <Button onClick={handleClick} className={className}>
       <IconToUse className="nextra-copy-icon nx-pointer-events-none nx-h-4 nx-w-4" />
     </Button>
   )
```

**File**: `components/copy.tsx` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
-import type { ComponentProps, ReactElement } from 'react'
+import type { ReactElement, SVGAttributes } from 'react'
 
-export function CopyIcon(props: ComponentProps<'svg'>): ReactElement {
+export function CopyIcon(props: SVGAttributes<SVGElement>): ReactElement {
   return (
     <svg
       width="24"
@@ -9,7 +9,7 @@ export function CopyIcon(props: ComponentProps<'svg'>): ReactElement {
       fill="none"
       xmlns="http://www.w3.org/2000/svg"
       stroke="currentColor"
-      {...props}
+      {...(props as any)}
     >
       <rect
         x="9"
```

**File**: `components/pre.tsx` (modified, +9/-9)
```diff
@@ -1,25 +1,26 @@
 'use client'
 
 import cn from 'clsx'
-import type { ComponentProps, ReactElement } from 'react'
+import type { ReactElement, HTMLAttributes } from 'react'
 import { useCallback, useRef } from 'react'
 import { WordWrapIcon } from './word-wrap'
 import { Button } from './button'
 import { CopyToClipboard } from './copy-to-clipboard'
 import React from 'react'
 
+interface PreProps {
+  children?: React.ReactNode
+  className?: string
+  hasCopyCode?: boolean
+  filename?: string
+}
 
 export const Pre = ({
   children,
   className,
   hasCopyCode = true,
-  filename,
-  ...props
-}: ComponentProps<'pre'> & {
-  filename?: string
-  hasCopyCode?: boolean
-  children?: React.ReactNode
-}): ReactElement => {
+  filename
+}: PreProps): ReactElement => {
   const preRef = useRef<HTMLPreElement | null>(null);
 
   const toggleWordWrap = useCallback(() => {
@@ -54,7 +55,6 @@ export const Pre = ({
           className
         )}
         ref={preRef}
-        {...props}
       >
         {renderChildren()}
       </pre>
```

**File**: `components/word-wrap.tsx` (modified, +3/-3)
```diff
@@ -1,8 +1,8 @@
-import type { ComponentProps, ReactElement } from 'react'
+import type { ReactElement, SVGAttributes } from 'react'
 
-export function WordWrapIcon(props: ComponentProps<'svg'>): ReactElement {
+export function WordWrapIcon(props: SVGAttributes<SVGElement>): ReactElement {
   return (
-    <svg viewBox="0 0 24 24" width="24" height="24" {...props}>
+    <svg viewBox="0 0 24 24" width="24" height="24" {...(props as any)}>
       <path
         fill="currentColor"
         d="M4 19h6v-2H4v2zM20 5H4v2h16V5zm-3 6H4v2h13.25c1.1 0 2 .9 2 2s-.9 2-2 2H15v-2l-3 3l3 3v-2h2c2.21 0 4-1.79 4-4s-1.79-4-4-4z"
```

---

### Incident Patch 6: `c385212a` (2025-12-28)
**Commit Message**: Simplify button component to avoid csstype version conflict

Use explicit interface instead of spreading HTML attributes to
avoid csstype version mismatch between dependencies.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `components/button.tsx` (modified, +16/-4)
```diff
@@ -1,20 +1,32 @@
 import cn from 'clsx'
-import type { ButtonHTMLAttributes, ReactElement } from 'react'
+import type { ReactNode, ReactElement } from 'react'
+
+interface ButtonProps {
+  children?: ReactNode
+  className?: string
+  onClick?: () => void
+  type?: 'button' | 'submit' | 'reset'
+  disabled?: boolean
+}
 
 export const Button = ({
   children,
   className,
-  ...props
-}: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement => {
+  onClick,
+  type = 'button',
+  disabled
+}: ButtonProps): ReactElement => {
   return (
     <button
+      type={type}
+      onClick={onClick}
+      disabled={disabled}
       className={cn(
         'nextra-button nx-transition-all active:nx-opacity-50',
         'nx-bg-primary-700/5 nx-border nx-border-black/5 nx-text-gray-600 hover:nx-text-gray-900 nx-rounded-md nx-p-1.5',
         'dark:nx-bg-primary-300/10 dark:nx-border-white/10 dark:nx-text-gray-400 dark:hover:nx-text-gray-50',
         className
       )}
-      {...props}
     >
       {children}
     </button>
```

---

### Incident Patch 7: `9010fa1e` (2025-12-28)
**Commit Message**: Fix button component TypeScript type compatibility

Use ButtonHTMLAttributes instead of ComponentProps to avoid
ref type incompatibility issues.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `components/button.tsx` (modified, +2/-2)
```diff
@@ -1,11 +1,11 @@
 import cn from 'clsx'
-import type { ComponentProps, ReactElement } from 'react'
+import type { ButtonHTMLAttributes, ReactElement } from 'react'
 
 export const Button = ({
   children,
   className,
   ...props
-}: ComponentProps<'button'>): ReactElement => {
+}: ButtonHTMLAttributes<HTMLButtonElement>): ReactElement => {
   return (
     <button
       className={cn(
```

---

### Incident Patch 8: `55df002c` (2025-12-28)
**Commit Message**: Fix @types/react version to match React 18

Downgrade @types/react from 19.x to 18.x to fix TypeScript
compatibility error in button component.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@
   },
   "devDependencies": {
     "@types/node": "18.11.10",
-    "@types/react": "19.2.7",
+    "@types/react": "^18.2.0",
     "typescript": "^4.9.5"
   }
 }
```

**File**: `pnpm-lock.yaml` (modified, +12/-6)
```diff
@@ -52,8 +52,8 @@ importers:
         specifier: 18.11.10
         version: 18.11.10
       '@types/react':
-        specifier: 19.2.7
-        version: 19.2.7
+        specifier: ^18.2.0
+        version: 18.3.27
       typescript:
         specifier: ^4.9.5
         version: 4.9.5
@@ -971,8 +971,11 @@ packages:
   '@types/node@18.11.10':
     resolution: {integrity: sha512-juG3RWMBOqcOuXC643OAdSA525V44cVgGV6dUDuiFtss+8Fk5x1hI93Rsld43VeJVIeqlP9I7Fn9/qaVqoEAuQ==}
 
-  '@types/react@19.2.7':
-    resolution: {integrity: sha512-MWtvHrGZLFttgeEj28VXHxpmwYbor/ATPYbBfSFZEIRK0ecCFLl2Qo55z52Hss+UV9CRN7trSeq1zbgx7YDWWg==}
+  '@types/prop-types@15.7.15':
+    resolution: {integrity: sha512-F6bEyamV9jKGAFBEmlQnesRPGOQqS2+Uwi0Em15xenOxHaf2hv6L8YCVn3rPdPJOiJfPiCnLIRyvwVaqMY3MIw==}
+
+  '@types/react@18.3.27':
+    resolution: {integrity: sha512-cisd7gxkzjBKU2GgdYrTdtQx1SORymWyaAFhaxQPK9bYO9ot3Y5OikQRvY0VYQtvwjeQnizCINJAenh/V7MK2w==}
 
   '@types/unist@2.0.11':
     resolution: {integrity: sha512-CmBKiL6NNo/OqgmMn95Fk9Whlp2mtvIv+KNpQKN2F4SjvrEesubTRWGYSg+BnWZOnlCaSTU1sMpsBOzgbYhnsA==}
@@ -3182,7 +3185,7 @@ snapshots:
   '@mdx-js/react@2.3.0(react@18.3.1)':
     dependencies:
       '@types/mdx': 2.0.13
-      '@types/react': 19.2.7
+      '@types/react': 18.3.27
       react: 18.3.1
 
   '@napi-rs/simple-git-android-arm-eabi@0.1.22':
@@ -3447,8 +3450,11 @@ snapshots:
 
   '@types/node@18.11.10': {}
 
-  '@types/react@19.2.7':
+  '@types/prop-types@15.7.15': {}
+
+  '@types/react@18.3.27':
     dependencies:
+      '@types/prop-types': 15.7.15
       csstype: 3.2.3
 
   '@types/unist@2.0.11': {}
```

---

### Incident Patch 9: `a6319d74` (2025-11-01)
**Commit Message**: Fix Copy Page feature for mobile browsers

Enhanced the copyToClipboard function with better mobile browser compatibility:
- Position textarea in viewport (0,0) instead of off-screen for mobile compatibility
- Remove readonly attribute which prevents selection on mobile browsers
- Add 100ms delay before execCommand to allow mobile selection to process
- Implement iOS-specific selection handling using Range API
- Set minimum 16px font size to prevent iOS zoom
- Make textarea invisible using opacity and 1px dimensions
- Add proper cleanup with delayed element removal

Tested successfully on mobile browsers over local network.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `components/CopyPageDropdown.tsx` (modified, +62/-19)
```diff
@@ -34,7 +34,7 @@ const CopyPageDropdown: React.FC = () => {
 
   // Cross-platform copy function with mobile fallback
   const copyToClipboard = async (text: string): Promise<void> => {
-    // Try modern Clipboard API first
+    // Try modern Clipboard API first (works in HTTPS contexts)
     if (navigator.clipboard && window.isSecureContext) {
       try {
         await navigator.clipboard.writeText(text);
@@ -44,28 +44,71 @@ const CopyPageDropdown: React.FC = () => {
       }
     }
 
-    // Fallback for mobile browsers and older browsers
-    const textArea = document.createElement('textarea');
-    textArea.value = text;
+    // Enhanced fallback for mobile browsers
+    return new Promise<void>((resolve, reject) => {
+      const textArea = document.createElement('textarea');
+      textArea.value = text;
 
-    // Make the textarea invisible and position it off-screen
-    textArea.style.position = 'fixed';
-    textArea.style.left = '-999999px';
-    textArea.style.top = '-999999px';
-    document.body.appendChild(textArea);
+      // Position off-screen but keep it in viewport for mobile compatibility
+      textArea.style.position = 'fixed';
+      textArea.style.top = '0';
+      textArea.style.left = '0';
+      textArea.style.width = '1px';
+      textArea.style.height = '1px';
+      textArea.style.padding = '0';
+      textArea.style.border = 'none';
+      textArea.style.outline = 'none';
+      textArea.style.boxShadow = 'none';
+      textArea.style.background = 'transparent';
+      textArea.style.fontSize = '16px'; // Prevent iOS zoom
+      textArea.style.opacity = '0';
+      textArea.style.pointerEvents = 'none';
 
-    // Focus and select the text
-    textArea.focus();
-    textArea.select();
+      // Don't use readonly - it prevents selection on some mobile browsers
+      document.body.appendChild(textArea);
 
-    try {
-      const successful = document.execCommand('copy');
-      if (!successful) {
-        throw new Error('execCommand failed');
+      // Focus and select
+      textArea.focus();
+
+      const isIOS = /ipad|iphone/i.test(navigator.userAgent);
+
+      if (isIOS) {
+        // iOS-specific handling
+        const range = document.createRange();
+        range.selectNodeContents(textArea);
+        const selection = window.getSelection();
+        if (selection) {
+          selection.removeAllRanges();
+          selection.addRange(range);
+        }
+        textArea.setSelectionRange(0, text.length);
+      } else {
+        // Standard selection for Android and others
+        textArea.select();
+        textArea.setSelectionRange(0, text.length);
       }
-    } finally {
-      document.body.removeChild(textArea);
-    }
+
+      // Wait a bit for selection to take effect on mobile
+      setTimeout(() => {
+        try {
+          const successful = document.execCommand('copy');
+
+          // Clean up after a short delay
+          setTimeout(() => {
+            document.body.removeChild(textArea);
+          }, 100);
+
+          if (successful) {
+            resolve();
+          } else {
+            reject(new Error('Copy command was unsuccessful'));
+          }
+        } catch (error) {
+          document.body.removeChild(textArea);
+          reject(error);
+        }
+      }, 100);
+    });
   };
 
   // Fetch page content from API
```

---

### Incident Patch 10: `f4760872` (2025-11-01)
**Commit Message**: Fix Copy Page feature for mobile browsers

Implemented a cross-platform clipboard solution with fallback mechanism to resolve mobile browser compatibility issues.

Changes:
- Added copyToClipboard() helper function that tries modern Clipboard API first
- Falls back to document.execCommand('copy') for mobile browsers with user agent restrictions
- Updated handleCopyAsMarkdown() and handleCopyFromModal() to use new helper
- Fixes "user agent or platform" permission errors on iOS Safari and mobile Chrome

The fallback method uses an invisible textarea element positioned off-screen,
which is the standard approach for mobile clipboard compatibility.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `components/CopyPageDropdown.tsx` (modified, +38/-2)
```diff
@@ -32,6 +32,42 @@ const CopyPageDropdown: React.FC = () => {
     return `${cleanPath}.en.mdx`;
   };
 
+  // Cross-platform copy function with mobile fallback
+  const copyToClipboard = async (text: string): Promise<void> => {
+    // Try modern Clipboard API first
+    if (navigator.clipboard && window.isSecureContext) {
+      try {
+        await navigator.clipboard.writeText(text);
+        return;
+      } catch (error) {
+        console.warn('Clipboard API failed, trying fallback:', error);
+      }
+    }
+
+    // Fallback for mobile browsers and older browsers
+    const textArea = document.createElement('textarea');
+    textArea.value = text;
+
+    // Make the textarea invisible and position it off-screen
+    textArea.style.position = 'fixed';
+    textArea.style.left = '-999999px';
+    textArea.style.top = '-999999px';
+    document.body.appendChild(textArea);
+
+    // Focus and select the text
+    textArea.focus();
+    textArea.select();
+
+    try {
+      const successful = document.execCommand('copy');
+      if (!successful) {
+        throw new Error('execCommand failed');
+      }
+    } finally {
+      document.body.removeChild(textArea);
+    }
+  };
+
   // Fetch page content from API
   const fetchPageContent = async (): Promise<string> => {
     const pagePath = getPagePath();
@@ -53,7 +89,7 @@ const CopyPageDropdown: React.FC = () => {
     try {
       setCopyStatus('copying');
       const content = await fetchPageContent();
-      await navigator.clipboard.writeText(content);
+      await copyToClipboard(content);
       setCopyStatus('success');
       setTimeout(() => {
         setCopyStatus('idle');
@@ -105,7 +141,7 @@ const CopyPageDropdown: React.FC = () => {
   // Copy markdown from modal
   const handleCopyFromModal = async () => {
     try {
-      await navigator.clipboard.writeText(markdownContent);
+      await copyToClipboard(markdownContent);
       alert('Content copied to clipboard!');
     } catch (error) {
       console.error('Failed to copy:', error);
```

---

### Incident Patch 11: `5e99d9c1` (2025-10-31)
**Commit Message**: Improve CopyPageDropdown UI and alignment

- Fix button alignment with page content
- Add theme-aware hover effects for dropdown items
  - Light mode: rgba(0, 0, 0, 0.05)
  - Dark mode: rgba(255, 255, 255, 0.1)
- Fix main button dark mode hover (was showing white, now shows proper dark gray)
- Add external link icons to "Open in Claude" and "Open in ChatGPT" options
- Add border radius to menu items for smoother hover appearance
- Improve button layout with flex for better icon alignment

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `components/CopyPageDropdown.tsx` (modified, +57/-18)
```diff
@@ -6,8 +6,17 @@ const CopyPageDropdown: React.FC = () => {
   const [showMarkdownModal, setShowMarkdownModal] = useState(false);
   const [markdownContent, setMarkdownContent] = useState('');
   const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success'>('idle');
+  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
   const router = useRouter();
 
+  // Helper to get hover background color based on theme
+  const getHoverBg = (buttonId: string) => {
+    if (hoveredButton !== buttonId) return 'transparent';
+    // Check if dark mode (this works with Nextra's dark mode)
+    const isDark = document.documentElement.classList.contains('dark');
+    return isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
+  };
+
   // Get current page path
   const getPagePath = (): string => {
     const pathname = router.pathname;
@@ -109,26 +118,20 @@ const CopyPageDropdown: React.FC = () => {
       <div style={{ position: 'relative', display: 'inline-block' }}>
         <button
           onClick={() => setIsOpen(!isOpen)}
+          className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800 nx-border nx-border-gray-200 dark:nx-border-neutral-700"
           style={{
             display: 'inline-flex',
             alignItems: 'center',
             gap: '6px',
             padding: '6px 12px',
             backgroundColor: 'transparent',
-            border: '1px solid #e5e7eb',
             borderRadius: '6px',
             fontSize: '0.875rem',
             fontWeight: 500,
             cursor: 'pointer',
             color: 'inherit',
             transition: 'all 0.2s ease',
           }}
-          onMouseOver={(e) => {
-            e.currentTarget.style.backgroundColor = '#f3f4f6';
-          }}
-          onMouseOut={(e) => {
-            e.currentTarget.style.backgroundColor = 'transparent';
-          }}
         >
           <svg
             width="16"
@@ -180,20 +183,22 @@ const CopyPageDropdown: React.FC = () => {
             <button
               onClick={handleCopyAsMarkdown}
               disabled={copyStatus === 'copying'}
-              className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800"
+              onMouseEnter={() => setHoveredButton('copy')}
+              onMouseLeave={() => setHoveredButton(null)}
               style={{
                 width: '100%',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px',
                 padding: '10px 12px',
-                backgroundColor: 'transparent',
+                backgroundColor: getHoverBg('copy'),
                 border: 'none',
+                borderRadius: '6px',
                 fontSize: '0.875rem',
                 cursor: copyStatus === 'copying' ? 'wait' : 'pointer',
                 textAlign: 'left',
                 color: 'inherit',
-                transition: 'background-color 0.2s ease',
+                transition: 'background-color 0.15s ease',
               }}
             >
               <svg
@@ -221,20 +226,22 @@ const CopyPageDropdown: React.FC = () => {
 
             <button
               onClick={handleOpenInClaude}
-              className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800"
+              onMouseEnter={() => setHoveredButton('claude')}
+              onMouseLeave={() => setHoveredButton(null)}
               style={{
                 width: '100%',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px',
                 padding: '10px 12px',
-                backgroundColor: 'transparent',
+                backgroundColor: getHoverBg('claude'),
                 border: 'none',
+                borderRadius: '6px',
                 fontSize: '0.875rem',
                 cursor: 'pointer',
                 textAlign: 'left',
                 color: 'inherit',
-                transition: 'background-color 0.2s ease',
+                transition: 'background-color 0.15s ease',
               }}
             >
               <svg
@@ -246,30 +253,47 @@ const CopyPageDropdown: React.FC = () => {
               >
                 <path d="M 233.959793 800.214905 L 468.644287 668.536987 L 472.590637 657.100647 L 468.644287 650.738403 L 457.208069 650.738403 L 417.986633 648.322144 L 283.892639 644.69812 L 167.597321 639.865845 L 54.926208 633.825623 L 26.577238 627.785339 L 3.3e-05 592.751709 L 2.73832 575.27533 L 26.577238 559.248352 L 60.724873 562.228149 L 136.187973 567.382629 L 249.422867 575.194763 L 331.570496 580.026978 L 453.261841 592.671082 L 472.590637 592.671082 L 475.328857 584.859009 L 468.724915 580.026978 L 463.570557 575.194763 L 346.389313 495.785217 L 219.543671 411.865906 L 153.100723 363.543762 L 117.181267 339.060425 L 99.060455 316.107361 L 91.248367 266.01355 L 123.865784 230.093994 L 167.677887 233.073853 L 178.872513 236.053772 L 223.248367 270.201477 L 318.040283 343.570496 L 441.825592 434.738342 L 459.946411 449.798706 L 
```

**File**: `theme.config.tsx` (modified, +15/-12)
```diff
@@ -96,18 +96,21 @@ const config: DocsThemeConfig = {
 
     return (
       <>
-        {isEnglishPage && (
-          <div style={{
-            display: 'flex',
-            justifyContent: 'flex-end',
-            marginBottom: '16px',
-            position: 'relative',
-            zIndex: 10
-          }}>
-            <CopyPageDropdown />
-          </div>
-        )}
-        {children}
+        <div>
+          {isEnglishPage && (
+            <div style={{
+              display: 'flex',
+              justifyContent: 'flex-end',
+              marginBottom: '16px',
+              position: 'relative',
+              zIndex: 10,
+              maxWidth: '100%'
+            }}>
+              <CopyPageDropdown />
+            </div>
+          )}
+          {children}
+        </div>
       </>
     );
   },
```

---

### Incident Patch 12: `9d51039f` (2025-10-31)
**Commit Message**: Fix dark mode visibility in CopyPageDropdown menu

- Replace inline background colors with Tailwind dark mode classes
- Update dropdown container: nx-bg-white dark:nx-bg-neutral-900
- Update button hover states: hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800
- Update description text: nx-text-gray-500 dark:nx-text-gray-400
- Remove inline onMouseOver/onMouseOut handlers in favor of classes
- Improve border visibility with dark:nx-border-neutral-700

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `components/CopyPageDropdown.tsx` (modified, +7/-23)
```diff
@@ -164,13 +164,12 @@ const CopyPageDropdown: React.FC = () => {
 
         {isOpen && (
           <div
+            className="nx-bg-white dark:nx-bg-neutral-900 nx-border nx-border-gray-200 dark:nx-border-neutral-700"
             style={{
               position: 'absolute',
               top: '100%',
               right: 0,
               marginTop: '4px',
-              backgroundColor: 'white',
-              border: '1px solid #e5e7eb',
               borderRadius: '8px',
               boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
               minWidth: '240px',
@@ -181,6 +180,7 @@ const CopyPageDropdown: React.FC = () => {
             <button
               onClick={handleCopyAsMarkdown}
               disabled={copyStatus === 'copying'}
+              className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800"
               style={{
                 width: '100%',
                 display: 'flex',
@@ -195,12 +195,6 @@ const CopyPageDropdown: React.FC = () => {
                 color: 'inherit',
                 transition: 'background-color 0.2s ease',
               }}
-              onMouseOver={(e) => {
-                e.currentTarget.style.backgroundColor = '#f9fafb';
-              }}
-              onMouseOut={(e) => {
-                e.currentTarget.style.backgroundColor = 'transparent';
-              }}
             >
               <svg
                 width="16"
@@ -219,14 +213,15 @@ const CopyPageDropdown: React.FC = () => {
                 <div style={{ fontWeight: 500 }}>
                   {copyStatus === 'success' ? 'Copied!' : 'Copy page'}
                 </div>
-                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
+                <div className="nx-text-gray-500 dark:nx-text-gray-400" style={{ fontSize: '0.75rem' }}>
                   Copy page as Markdown for LLMs
                 </div>
               </div>
             </button>
 
             <button
               onClick={handleOpenInClaude}
+              className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800"
               style={{
                 width: '100%',
                 display: 'flex',
@@ -241,12 +236,6 @@ const CopyPageDropdown: React.FC = () => {
                 color: 'inherit',
                 transition: 'background-color 0.2s ease',
               }}
-              onMouseOver={(e) => {
-                e.currentTarget.style.backgroundColor = '#f9fafb';
-              }}
-              onMouseOut={(e) => {
-                e.currentTarget.style.backgroundColor = 'transparent';
-              }}
             >
               <svg
                 width="16"
@@ -259,14 +248,15 @@ const CopyPageDropdown: React.FC = () => {
               </svg>
               <div>
                 <div style={{ fontWeight: 500 }}>Open in Claude</div>
-                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
+                <div className="nx-text-gray-500 dark:nx-text-gray-400" style={{ fontSize: '0.75rem' }}>
                   Ask questions about this page
                 </div>
               </div>
             </button>
 
             <button
               onClick={handleOpenInChatGPT}
+              className="hover:nx-bg-gray-100 dark:hover:nx-bg-neutral-800"
               style={{
                 width: '100%',
                 display: 'flex',
@@ -281,12 +271,6 @@ const CopyPageDropdown: React.FC = () => {
                 color: 'inherit',
                 transition: 'background-color 0.2s ease',
               }}
-              onMouseOver={(e) => {
-                e.currentTarget.style.backgroundColor = '#f9fafb';
-              }}
-              onMouseOut={(e) => {
-                e.currentTarget.style.backgroundColor = 'transparent';
-              }}
             >
               <svg
                 width="16"
@@ -299,7 +283,7 @@ const CopyPageDropdown: React.FC = () => {
               </svg>
               <div>
                 <div style={{ fontWeight: 500 }}>Open in ChatGPT</div>
-                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
+                <div className="nx-text-gray-500 dark:nx-text-gray-400" style={{ fontSize: '0.75rem' }}>
                   Ask questions about this page
                 </div>
               </div>
```

---

### Incident Patch 13: `36957883` (2025-10-31)
**Commit Message**: Fix Copy Page feature for Vercel deployment

- Replace file system access with GitHub raw URL fetch
- This works on Vercel serverless functions where .mdx files aren't bundled
- Fetch content from https://raw.githubusercontent.com/dair-ai/Prompt-Engineering-Guide/main/
- Keep all cleaning logic (remove imports, exports, frontmatter)
- Maintain error handling and logging

Fixes 404 errors when using Copy Page feature on production deployment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `pages/api/getPageContent.ts` (modified, +14/-14)
```diff
@@ -1,8 +1,6 @@
 import type { NextApiRequest, NextApiResponse } from 'next';
-import fs from 'fs';
-import path from 'path';
 
-export default function handler(
+export default async function handler(
   req: NextApiRequest,
   res: NextApiResponse
 ) {
@@ -18,23 +16,25 @@ export default function handler(
       return res.status(400).json({ error: 'Only English pages are supported' });
     }
 
-    // Construct the file path
-    const filePath = path.join(process.cwd(), 'pages', pagePath);
+    // Construct GitHub raw URL
+    const githubBaseUrl = 'https://raw.githubusercontent.com/dair-ai/Prompt-Engineering-Guide/main/pages';
+    const githubUrl = `${githubBaseUrl}/${pagePath}`;
 
-    console.log('Attempting to read file:', filePath);
-    console.log('File exists:', fs.existsSync(filePath));
+    console.log('Fetching from GitHub:', githubUrl);
 
-    // Check if file exists
-    if (!fs.existsSync(filePath)) {
+    // Fetch content from GitHub
+    const response = await fetch(githubUrl);
+
+    if (!response.ok) {
+      console.error('GitHub fetch failed:', response.status, response.statusText);
       return res.status(404).json({
         error: 'Page not found',
-        attempted: filePath,
+        attempted: githubUrl,
         pagePath: pagePath
       });
     }
 
-    // Read the file content
-    let content = fs.readFileSync(filePath, 'utf8');
+    let content = await response.text();
 
     // Clean the content:
     // 1. Remove import statements
@@ -51,7 +51,7 @@ export default function handler(
 
     return res.status(200).json({ content, pagePath });
   } catch (error) {
-    console.error('Error reading page content:', error);
-    return res.status(500).json({ error: 'Failed to read page content' });
+    console.error('Error fetching page content:', error);
+    return res.status(500).json({ error: 'Failed to fetch page content' });
   }
 }
```

---

### Incident Patch 14: `222e876c` (2025-10-16)
**Commit Message**: Add Context Engineering Deep Dive and Deep Agents guides

- Add new Context Engineering Deep Dive article with detailed system prompt engineering techniques
- Add Deep Agents guide covering planning, orchestrator architecture, and verification
- Fix typos in Deep Agents article (orchestator -> orchestrator, underpsecified -> underspecified)
- Add agent architecture images for customer support system
- Update navigation metadata to include new articles

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `pages/agents/_meta.en.json` (modified, +3/-1)
```diff
@@ -2,5 +2,7 @@
     "introduction": "Introduction to Agents",
     "components": "Agent Components",
     "ai-workflows-vs-ai-agents": "AI Workflows vs AI Agents",
-    "context-engineering": "Context Engineering for AI Agents"
+    "context-engineering": "Context Engineering for AI Agents",
+    "context-engineering-deep-dive": "Context Engineering Deep Dive",
+    "deep-agents": "Deep Agents"
 }
\ No newline at end of file
```

**File**: `pages/agents/context-engineering-deep-dive.en.mdx` (added, +284/-0)
```diff
@@ -0,0 +1,284 @@
+# Context Engineering Deep Dive: Building a Deep Research Agent
+
+import { Callout } from 'nextra/components'
+
+[Context engineering](https://www.promptingguide.ai/guides/context-engineering-guide) requires significant iteration and careful design decisions to build reliable AI agents. This guide takes a deep dive into the practical aspects of context engineering through the development of a basic deep research agent, exploring some of the techniques and design patterns that improve agent reliability and performance.
+
+<Callout type="info" emoji="📚">
+This content is based on our new course ["Building Effective AI Agents with n8n"](https://dair-ai.thinkific.com/courses/agents-with-n8n), which provides comprehensive insights, downloadable templates, prompts, and advanced tips into designing and implementing agentic systems.
+</Callout>
+
+## The Reality of Context Engineering
+
+Building effective AI agents requires substantial tuning of system prompts and tool definitions. The process involves spending hours iterating on:
+
+- System prompt design and refinement
+- Tool definitions and usage instructions
+- Agent architecture and communication patterns
+- Input/output specifications between agents
+
+
+Don't underestimate the effort required for context engineering. It's not a one-time task but an iterative process that significantly impacts agent reliability and performance.
+
+## Agent Architecture Design
+
+### The Original Design Problem
+
+![deep-research-agent](../../img/agents/simple-dr-agent.png)
+
+Let's look at a basic deep research agent architecture. The initial architecture connects the web search tool directly to the deep research agent. This design places too much burden on a single agent responsible for:
+
+- Managing tasks (creating, updating, deleting)
+- Saving information to memory
+- Executing web searches
+- Generating final reports
+
+**Consequences of this design:**
+- Context grew too long
+- Agent forgot to execute web searches
+- Task completion updates were missed
+- Unreliable behavior across different queries
+
+### The Improved Multi-Agent Architecture
+
+The solution involved separating concerns by introducing a dedicated search worker agent:
+
+**Benefits of the multi-agent design:**
+
+1. **Separation of Concerns**: The parent agent (Deep Research Agent) handles planning and orchestration, while the search worker agent focuses exclusively on executing web searches
+2. **Improved Reliability**: Each agent has a clear, focused responsibility, reducing the likelihood of missed tasks or forgotten operations
+3. **Model Selection Flexibility**: Different agents can use different language models optimized for their specific tasks
+   - Deep Research Agent: Uses Gemini 2.5 Pro for complex planning and reasoning
+   - Search Worker Agent: Uses Gemini 2.5 Flash for faster, more cost-effective search execution
+
+If you are using models from other providers like OpenAI, you can leverage GPT-5 (for planning and reasoning) and GPT-5-mini (for search execution) for similar performance. 
+
+<Callout type="info" emoji="💡">
+**Design Principle**: Separating agent responsibilities improves reliability and enables cost-effective model selection for different subtasks.
+</Callout>
+
+## System Prompt Engineering
+
+Here is the full system prompt for the deep research agent we built in n8n:
+
+```md
+You are a deep research agent who will help with planning and executing search tasks to generate a deep research report.
+
+## GENERAL INSTRUCTIONS
+
+The user will provide a query, and you will convert that query into a search plan with multiple search tasks (3 web searches). You will execute each search task and maintain the status of those searches in a spreadsheet.
+
+You will then generate a final deep research report for the user.
+
+For context, today's date is: {{ $now.format('yyyy-MM-dd') }}
+
+## TOOL DESCRIPTIONS
+
+Below are some useful instructions for how to use the available tools. 
+
+Deleting tasks: Use the delete_task tool to clear up all the tasks before starting the search plan. 
+
+Planning tasks: You will create a plan with the search tasks (3 web searches) and add them to the Google Sheet using the append_update_task tool. Make sure to keep the status of each task updated after completing each search. Each task begins with a todo status and will be updated to a "done" status once the search worker returns information regarding the search task.
+
+Executing tasks: Use the Search Worker Agent tool to execute the search plan. The input to the agent are the actual search queries, word for word. 
+
+Use the tools in the order that makes the most sense to you but be efficient. 
+```
+
+Let's break it down into parts and discuss why each section is important:
+
+
+### High-Level Agent Definition
+
+The system prompt begins with a clear definition of the agent's role:
+
+```md
+You are a deep research agent who will help with planning and executing search tas
```

**File**: `pages/agents/deep-agents.en.mdx` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+# Deep Agents
+
+import { Callout } from 'nextra/components'
+
+Most agents today are shallow.
+
+They easily break down on long, multi-step problems (e.g., deep research or agentic coding).
+
+That’s changing fast!
+
+We’re entering the era of "Deep Agents", systems that strategically plan, remember, and delegate intelligently for solving very complex problems.
+
+We at the [DAIR.AI Academy](https://dair-ai.thinkific.com/) and other folks from [LangChain](https://docs.langchain.com/labs/deep-agents/overview), [Claude Code](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk), as well as more recently, individuals like [Philipp Schmid](https://www.philschmid.de/agents-2.0-deep-agents), have been documenting this idea.
+
+Here is an example of a deep agent built to power the [DAIR.AI Academy's](https://dair-ai.thinkific.com/) customer support system intended for students to ask questions regarding our trainings and courses:
+
+![deep-agent](../../img/agents/customer-support-deep-agent.png)
+
+<Callout type="info" emoji="📚">
+This post is based on our new course ["Building Effective AI Agents with n8n"](https://dair-ai.thinkific.com/courses/agents-with-n8n), which provides comprehensive insights, downloadable templates, prompts, and advanced tips into designing and implementing deep agents.
+</Callout>
+
+Here’s roughly the core idea behind Deep Agents (based on my own thoughts and notes that I've gathered from others):
+
+## Planning
+
+![cs-planning](../../img/agents/cs-planning.png)
+
+Instead of reasoning ad-hoc inside a single context window, Deep Agents maintain structured task plans they can update, retry, and recover from. Think of it as a living to-do list that guides the agent toward its long-term goal. To experience this, just try out Claude Code or Codex for planning; the results are significantly better once you enable it before executing any task. 
+
+We have also written recently on the power of brainstorming for longer with Claude Code, and this shows the power of planning, expert context, and human-in-the-loop (your expertise gives you an important edge when working with deep agents). Planning will also be critical for long-horizon problems (think agents for scientific discovery, which comes next).
+
+## Orchestrator & Sub-agent Architecture
+
+![cs-subagents](../../img/agents/cs-subagents.png)
+
+One big agent (typically with a very long context) is no longer enough. I've seen [arguments](https://cognition.ai/blog/dont-build-multi-agents) against multi-agent systems and in favor of monolithic systems, but I'm skeptical about this. 
+
+The orchestrator-sub-agent architecture is one of the most powerful LLM-based agentic architectures you can leverage today for any domain you can imagine. An orchestrator manages specialized sub-agents such as search agents, coders, KB retrievers, analysts, verifiers, and writers, each with its own clean context and domain focus. 
+
+The orchestrator delegates intelligently, and subagents execute efficiently. The orchestrator integrates their outputs into a coherent result. Claude Code popularized the use of this approach for coding and sub-agents, which, it turns out, are particularly useful for efficiently managing context (through separation of concerns).
+
+I wrote a few notes on the power of using orchestrator and subagents [here](https://x.com/omarsar0/status/1960877597191245974) and [here](https://x.com/omarsar0/status/1971975884077965783).
+
+## Context Retrieval and Agentic Search
+
+![persistent-storage](../../img/agents/cs-persistent-storage.png)
+
+Deep Agents don’t rely on conversation history alone. They store intermediate work in external memory like files, notes, vectors, or databases, letting them reference what matters without overloading the model’s context. High-quality structured memory is a thing of beauty. 
+
+Take a look at recent works like [ReasoningBank](https://arxiv.org/abs/2509.25140) and [Agentic Context Engineering](https://arxiv.org/abs/2510.04618) for some really cool ideas on how to better optimize memory building and retrieval. Building with the orchestrator-subagents architecture means that you can also leverage hybrid memory techniques (e.g., agentic search + semantic search), and you can let the agent decide what strategy to use.
+
+## Context Engineering
+
+One of the worst things you can do when interacting with these types of agents is underspecified instructions/prompts. Prompt engineering was and is important, but we will use the new term [context engineering](https://www.promptingguide.ai/guides/context-engineering-guide) to emphasize the importance of building context for agents. The instructions need to be more explicit, detailed, and intentional to define when to plan, when to use a sub-agent, how to name files, and how to collaborate with humans. Part of context engineering also involves efforts around structured outputs, system prompt optimization, compacting contex
```

---

### Incident Patch 15: `ac4f737a` (2025-10-13)
**Commit Message**: Fix TypeScript errors and update course link

- Fix TabsComponent: add children prop explicitly
- Fix course link: update Intro to AI Agents URL to correct path
- Resolves build errors for TypeScript strict mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <[REDACTED_EMAIL]>

**File**: `components/TabsComponent.tsx` (modified, +4/-4)
```diff
@@ -31,13 +31,13 @@ response = client.chat.completions.create(
     };
 
     return (
-        <Tabs items={tabsData.map(tab => tab.model)}>
-            {tabsData.map((tab, index) => (
+        <Tabs items={tabsData.map(tab => tab.model)} children={
+            tabsData.map((tab, index) => (
                 <Tab key={index}>
                     <pre><code data-language="python">{renderCodeBlock(tab)}</code></pre>
                 </Tab>
-            ))}
-        </Tabs>
+            ))
+        } />
     );
 };
 
```

**File**: `pages/_meta.en.json` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
       },
       "intro-ai-agents": {
         "title": "Intro to AI Agents",
-        "href": "https://dair-ai.thinkific.com/courses/introduction-building-ai-agents"
+        "href": "https://dair-ai.thinkific.com/courses/introduction-ai-agents"
       },
       "agents-with-n8n": {
         "title": "Building Effective AI Agents with n8n",
```

#### Recent Merged Pull Requests:
- **PR #814** (closed): gh repo clone HanSEOHafen/ai-boost.github.io (@HanSEOHafen)
- **PR #803** (closed): fix: repair broken link in Spanish few-shot page (@JulianZJN)
- **PR #799** (closed): Add files via upload (@abdbali)
- **PR #789** (closed): Add Spanish translation for Reflexion page (@pacocartones)
- **PR #788** (closed): Add Spanish translation for Trustworthiness in LLMs page (@pacocartones)
- **PR #786** (closed): Add Spanish translation for ART page (@pacocartones)
- **PR #785** (closed): Add Spanish translation for function_calling page (@pacocartones)
- **PR #775** (closed): Add Future AGI (@SuhaniNagpal7)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
