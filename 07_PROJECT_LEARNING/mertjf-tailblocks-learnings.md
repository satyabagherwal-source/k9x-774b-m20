# Forensic Learning Record (Deep Inspection): mertJF/tailblocks

> **Canonical Artifact**: `07_PROJECT_LEARNING/mertjf-tailblocks-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mertJF/tailblocks](https://github.com/mertJF/tailblocks))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:10:29.373Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mertJF/tailblocks`
- **Description**: Ready-to-use Tailwind CSS blocks.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8882 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/serviceWorker.js`
```
// This optional code is used to register a service worker.
// register() is not called by default.

// This lets the app load faster on subsequent visits in production, and gives
// it offline capabilities. However, it also means that developers (and users)
// will only see deployed updates on subsequent visits to a page, after all the
// existing tabs open on the page have been closed, since previously cached
// resources are updated in the background.

// To learn more about the benefits of this model and instructions on how to
// opt-in, read https://bit.ly/CRA-PWA

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // from what our page is served on. This might happen if a CDN is used to
      // serve assets; see https://github.com/facebook/create-react-app/issues/2374
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://bit.ly/CRA-PWA'
          );
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://bit.ly/CRA-PWA.'
              );

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' }
  })
    .then(response => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log(
        'No internet connection found. App is running in offline mode.'
      );
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.unregister();
    });
  }
}

```

### Core Architecture Module: `src/App.js`
```
import React, { Component } from 'react';
import Frame from 'react-frame-component';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs2015, docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import getBlock from './blocks';
import getIcons from './icons';

const iconList = getIcons();
const blockListArr = [];

Object.entries(iconList).forEach(([type, icons]) => {
 Object.keys(icons).map(name =>  blockListArr.push(`${name},${type}`));
});

const themeList = ["indigo", "yellow", "red", "purple", "pink", "blue", "green"];

const desktopIcon = (
  <svg
    stroke="currentColor"
    strokeWidth={2}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <rect x={2} y={3} width={20} height={14} rx={2} ry={2} />
    <path d="M8 21h8m-4-4v4" />
  </svg>
);

const phoneIcon = (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x={5} y={2} width={14} height={20} rx={2} ry={2} />
    <path d="M12 18h.01" />
  </svg>
);

const tabletIcon = (
  <svg
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x={4} y={2} width={16} height={20} rx={2} ry={2} />
    <path d="M12 18h.01" />
  </svg>
);

const clipboardIcon = (
  <svg
    viewBox="0 0 25 24"
    stroke="currentColor"
    strokeWidth={2}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19.914 1h-18v19"/>
    <path d="M6 5v18h18V5z"/>
  </svg>
);

const viewList = [
  {
    icon: desktopIcon,
    name: 'desktop'
  },
  {
    icon: tabletIcon,
    name: 'tablet'
  },
  {
    icon: phoneIcon,
    name: 'phone'
  }
]

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ready: false,
      darkMode: false,
      copied: false,
      sidebar: true,
      codeView: false,
      currentKeyCode: null,
      view: 'desktop',
      theme: 'indigo',
      blockType: 'Blog',
      blockName: 'BlogA',
      markup: ''
    }
    
    this.changeMode = this.changeMode.bind(this);
    this.changeTheme = this.changeTheme.bind(this);
    this.changeBlock = this.changeBlock.bind(this);
    this.handleContentDidMount = this.handleContentDidMount.bind(this);
    this.changeView = this.changeView.bind(this);
    this.toggleSidebar = this.toggleSidebar.bind(this);
    this.toggleView = this.toggleView.bind(this);
    this.copyToClipboard = this.copyToClipboard.bind(this);
    this.keyboardNavigation = this.keyboardNavigation.bind(this);
    this.markupRef = React.createRef();
    this.textareaRef = React.createRef();
    this.sidebarRef = React.createRef();
    this.openerRef = React.createRef();
  }

  componentDidMount() {
    document.addEventListener('keydown', this.keyboardNavigation);
  }

  hideSidebar() {
    const sidebar = this.sidebarRef.current;
    const opener = this.openerRef.current;

    document.addEventListener('click', (e) => {
      if (e.target === opener) {
        return;
      }

      if ((!e.target === sidebar || !sidebar.contains(e.target))) {
        this.setState({ sidebar: false });
      }
    });
  }

  keyboardNavigation(e) {
    const { blockType, blockName } = this.state;
    const blockStringFormat = `${blockName},${blockType}`;
    const keyCode = e.which || e.keyCode;

    switch (keyCode) {
      case 40: // Down
        e.preventDefault();
        blockListArr.forEach((block, index) => {
          if (block === blockStringFormat) {
            const newActiveBlock = index + 1 <= blockListArr.length - 1  ? blockListArr[index + 1].split(',') : blockListArr[0].split(',');
            const newBlockName = newActiveBlock[0];
            const newBlockType = newActiveBlock[1];
            const newBlockNode = document.querySelector(`.block-item[block-name="${newBlockName}"]`);
            if (newBlockNode) newBlockNode.focus();
            this.setState({
              blockType: newBlockType,
              blockName: newBlockName,
              codeView: false,
              currentKeyCode: 40
            });
          }
        });
        break;
      case 37: // Left
        e.preventDefault();
        this.setState({ sidebar: false, currentKeyCode: 37 });
        break;
      case 39: // Right
        e.preventDefault();
        this.setState({ sidebar: true, currentKeyCode: 39 });
        break;  
      case 38: // Up
        e.preventDefault();
        blockListArr.forEach((block, index) => {
          if (block === blockStringFormat) {
            const newActiveBlock = index - 1 >= 0 ? blockListArr[index - 1].split(',') : blockListArr[blockListArr.length - 1].split(',');
            const newBlockName = newActiveBlock[0];
            const newBlockType = newActiveBlock[1];
            const newBlockNode = document.querySelector(`.block-item[block-name="${newBlockName}"]`);
            if (newBlockNode) newBlockNode.focus();

            this.setState({
              blockType: newBlockType,
              blockName: newBlockName,
              codeView: false,
              currentKeyCode: 38
            });
          }
        });
        break;
      default:
        return;
    }

    setTimeout(() => {
      if (keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40) {
        this.setState({ currentKeyCode: null })
      }
    }, 200);
   }

  changeMode() {
    this.setState({ darkMode: !this.state.darkMode })
  }

  handleContentDidMount() {
    const iframe = document.querySelector('iframe');
    iframe.contentWindow.document.addEventListener('keydown', this.keyboardNavigation);
    iframe.contentWindow.document.addEventListener('click', () => this.setState({ sidebar: false }));

    setTimeout(() => {
      this.setState({
        ready: true,
        markup: this.markupRef.current.innerHTML
      })
    }, 400);
  }

  beautifyHTML(codeStr) {
    const process = (str) => {
      let div = document.createElement('div');
      div.innerHTML = str.trim();
      return format(div, 0).innerHTML.trim();
    }
    
    const format = (node, level) => {
      let indentBefore = new Array(level++ + 1).join('  '),
        indentAfter = new Array(level - 1).join('  '),
        textNode;
    
      for (let i = 0; i < node.children.length; i++) {
        textNode = document.createTextNode('\n' + indentBefore);
        node.insertBefore(textNode, node.children[i]);
    
        format(node.children[i], level);
    
        if (node.lastElementChild === node.children[i]) {
          textNode = document.createTextNode('\n' + indentAfter);
          node.appendChild(textNode);
        }
      }

      return node;
    }
    return process(codeStr);
  }

  changeBlock(e) {
    const { currentTarget } = e;
    const blockType = currentTarget.getAttribute('block-type');
    const blockName = currentTarget.getAttribute('block-name');
    this.setState({
      blockType, blockName,
      codeView: false
    });
  }

  changeTheme(e) {
    const { currentTarget } = e;
    const theme = currentTarget.getAttribute('data-theme');
    this.setState({ theme });
  }

  changeView(e) {
    const { currentTarget } = e;
    const view = currentTarget.getAttribute('data-view');
    this.setState({ view, codeView: false });
  }

  toggleView() {
    this.setState({ codeView: !this.state.codeView, view: 'desktop', markup: this.markupRef.current.innerHTML })
  }

  themeListRenderer() {
    const { theme } = this.state;
    return themeList.map((t, k) => 
      <button key={k} data-theme={t} onKeyDown={this.keyboardNavigation} className={`theme-button bg-${t}-500${theme === t ? ' is-active' : ''}`} onClick={this.changeTheme}></button>
    )
  }

  listRenderer() {
    const { blockName } = this.state;
    return Object.entries(iconList).map(([type, icons]) => 
      <div className="blocks" key={type}>
        <div className="block-category">{type}</div>
        <div className="block-list">
        {Object.entries(icons).map(icon => <button key={icon[0]} tabIndex="0" onClick={this.changeBlock} className={`block-item${icon[0] === blockName ? ' is-active': ''}`} block-type={type} block-name={icon[0]}>{icon[1]}</button>)}
        </div>
      </div>
    );
  }

  viewModeRenderer() {
    const { view } = this.state;
    return viewList.map((v, k) => <button key={k} className={`device${view === v.name ? ' is-active' : ''}`} data-view={v.name} onClick={this.changeView}>{v.icon}</button>);
  }

  toggleSidebar() {
    this.setState({ sidebar: !this.state.sidebar });
  }

  copyToClipboard() {
    const code = this.beautifyHTML(this.state.markup);
    var input = document.createElement('textarea');
    input.innerHTML = code;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    this.setState({copied: true});
    setTimeout(() => {
      this.setState({
        copied: false
      })
    }, 2000);
}

  render() {
    const { darkMode, theme, blockName, blockType, sidebar, view, copied, currentKeyCode } = this.state;
    return (
      <div className={`app${darkMode ? ' dark-mode' : ''}${sidebar ? ' has-sidebar' : ''} ${theme} ${view}`}>
        <textarea className="copy-textarea" ref={this.textareaRef} />
        <aside className="sidebar" ref={this.sidebarRef}>
          {this.listRenderer()}
        </aside>
        <div className="toolbar">
          <button className="opener" onClick={this.toggleSidebar} ref={this.openerRef}>TAILBLOCKS</button>
          {this.state.codeView &&
            <div className="clipboard-wrapper">
              <button className="copy-the-block copy-to-clipboard" onClick={this.copyToClipboard}>
                {clipboardIcon}
                <span>COPY TO CLIPBOARD</span>
              </button>
              <span className={`clipboard-tooltip${copied ? ' is-copied ' : ''}`} >Copied!</span>
     
```

### Core Architecture Module: `src/blocks/blog/dark/a.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function DarkBlogA(props) {
  return (
    <section className="text-gray-400 bg-gray-900 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-4">
          <div className="p-4 md:w-1/3">
            <div className="h-full border-2 border-gray-800 rounded-lg overflow-hidden">
              <img
                className="lg:h-48 md:h-36 w-full object-cover object-center"
                src="https://dummyimage.com/720x400"
                alt="blog"
              />
              <div className="p-6">
                <h2 className="tracking-widest text-xs title-font font-medium text-gray-500 mb-1">
                  CATEGORY
                </h2>
                <h1 className="title-font text-lg font-medium text-white mb-3">
                  The Catalyzer
                </h1>
                <p className="leading-relaxed mb-3">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <div className="flex items-center flex-wrap ">
                  <a href className={`text-${props.theme}-400 inline-flex items-center md:mb-2 lg:mb-0`}>
                    Learn More
                    <svg
                      className="w-4 h-4 ml-2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <span className="text-gray-500 mr-3 inline-flex items-center lg:ml-auto md:ml-0 ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-800">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx={12} cy={12} r={3} />
                    </svg>
                    1.2K
                  </span>
                  <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    6
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 md:w-1/3">
            <div className="h-full border-2 border-gray-800 rounded-lg overflow-hidden">
              <img
                className="lg:h-48 md:h-36 w-full object-cover object-center"
                src="https://dummyimage.com/721x401"
                alt="blog"
              />
              <div className="p-6">
                <h2 className="tracking-widest text-xs title-font font-medium text-gray-500 mb-1">
                  CATEGORY
                </h2>
                <h1 className="title-font text-lg font-medium text-white mb-3">
                  The 400 Blows
                </h1>
                <p className="leading-relaxed mb-3">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <div className="flex items-center flex-wrap">
                  <a href className={`text-${props.theme}-400 inline-flex items-center md:mb-2 lg:mb-0`}>
                    Learn More
                    <svg
                      className="w-4 h-4 ml-2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <span className="text-gray-500 mr-3 inline-flex items-center lg:ml-auto md:ml-0 ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-800">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx={12} cy={12} r={3} />
                    </svg>
                    1.2K
                  </span>
                  <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    6
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 md:w-1/3">
            <div className="h-full border-2 border-gray-800 rounded-lg overflow-hidden">
              <img
                className="lg:h-48 md:h-36 w-full object-cover object-center"
                src="https://dummyimage.com/722x402"
                alt="blog"
              />
              <div className="p-6">
                <h2 className="tracking-widest text-xs title-font font-medium text-gray-500 mb-1">
                  CATEGORY
                </h2>
                <h1 className="title-font text-lg font-medium text-white mb-3">
                  Shooting Stars
                </h1>
                <p className="leading-relaxed mb-3">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <div className="flex items-center flex-wrap ">
                  <a
                    href
                    className={`text-${props.theme}-400 inline-flex items-center md:mb-2 lg:mb-0`}
                  >
                    Learn More
                    <svg
                      className="w-4 h-4 ml-2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <span className="text-gray-500 mr-3 inline-flex items-center lg:ml-auto md:ml-0 ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-800">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx={12} cy={12} r={3} />
                    </svg>
                    1.2K
                  </span>
                  <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    6
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>    
  )
}

DarkBlogA.defaultProps = {
  theme: 'indigo'
};

DarkBlogA.propTypes = {
  theme: PropTypes.string.isRequired
};

export default DarkBlogA;

```

### Core Architecture Module: `src/blocks/blog/dark/b.js`
```

import React from 'react';
import PropTypes from  "prop-types";

function DarkBlogB(props) {
  return (
    <section className="text-gray-400 bg-gray-900 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-4">
          <div className="p-4 lg:w-1/3">
            <div className="h-full bg-gray-800 bg-opacity-40 px-8 pt-16 pb-24 rounded-lg overflow-hidden text-center relative">
              <h2 className="tracking-widest text-xs title-font font-medium text-gray-500 mb-1">
                CATEGORY
              </h2>
              <h1 className="title-font sm:text-2xl text-xl font-medium text-white mb-3">
                Raclette Blueberry Nextious Level
              </h1>
              <p className="leading-relaxed mb-3">
                Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                microdosing tousled waistcoat.
              </p>
              <a href className={`text-${props.theme}-400 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div className="text-center mt-2 leading-none flex justify-center absolute bottom-0 left-0 w-full py-4">
                <span className="text-gray-500 mr-3 inline-flex items-center leading-none text-sm pr-3 py-1 border-r-2 border-gray-700 border-opacity-50">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                  1.2K
                </span>
                <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  6
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 lg:w-1/3">
            <div className="h-full bg-gray-800 bg-opacity-40 px-8 pt-16 pb-24 rounded-lg overflow-hidden text-center relative">
              <h2 className="tracking-widest text-xs title-font font-medium text-gray-500 mb-1">
                CATEGORY
              </h2>
              <h1 className="title-font sm:text-2xl text-xl font-medium text-white mb-3">
                Ennui Snackwave Thundercats
              </h1>
              <p className="leading-relaxed mb-3">
                Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                microdosing tousled waistcoat.
              </p>
              <a href className={`text-${props.theme}-400 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div className="text-center mt-2 leading-none flex justify-center absolute bottom-0 left-0 w-full py-4">
                <span className="text-gray-500 mr-3 inline-flex items-center leading-none text-sm pr-3 py-1 border-r-2 border-gray-700 border-opacity-50">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                  1.2K
                </span>
                <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  6
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 lg:w-1/3">
            <div className="h-full bg-gray-800 bg-opacity-40 px-8 pt-16 pb-24 rounded-lg overflow-hidden text-center relative">
              <h2 className="tracking-widest text-xs title-font font-medium text-gray-500 mb-1">
                CATEGORY
              </h2>
              <h1 className="title-font sm:text-2xl text-xl font-medium text-white mb-3">
                Selvage Poke Waistcoat Godard
              </h1>
              <p className="leading-relaxed mb-3">
                Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                microdosing tousled waistcoat.
              </p>
              <a href className={`text-${props.theme}-400 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div className="text-center mt-2 leading-none flex justify-center absolute bottom-0 left-0 w-full py-4">
                <span className="text-gray-500 mr-3 inline-flex items-center leading-none text-sm pr-3 py-1 border-r-2 border-gray-700 border-opacity-50">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                  1.2K
                </span>
                <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  6
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

DarkBlogB.defaultProps = {
  theme: 'indigo'
};

DarkBlogB.propTypes = {
  theme: PropTypes.string.isRequired
};

export default DarkBlogB;

```

### Core Architecture Module: `src/blocks/blog/dark/c.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function DarkBlogC(props) {
  return (
    <section className="text-gray-400 bg-gray-900 body-font overflow-hidden">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-12">
          <div className="p-12 md:w-1/2 flex flex-col items-start">
            <span className="inline-block py-1 px-2 rounded bg-gray-800 text-gray-400 text-opacity-75 text-xs font-medium tracking-widest">
              CATEGORY
            </span>
            <h2 className="sm:text-3xl text-2xl title-font font-medium text-white mt-4 mb-4">
              Roof party normcore before they sold out, cornhole vape
            </h2>
            <p className="leading-relaxed mb-8">
              Live-edge letterpress cliche, salvia fanny pack humblebrag narwhal
              portland. VHS man braid palo santo hoodie brunch trust fund. Bitters
              hashtag waistcoat fashion axe chia unicorn. Plaid fixie chambray 90's,
              slow-carb etsy tumeric. Cray pug you probably haven't heard of them
              hexagon kickstarter craft beer pork chic.
            </p>
            <div className="flex items-center flex-wrap pb-4 mb-4 border-b-2 border-gray-800 border-opacity-75 mt-auto w-full">
              <a href className={`text-${props.theme}-400 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <span className="text-gray-500 mr-3 inline-flex items-center ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-800">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx={12} cy={12} r={3} />
                </svg>
                1.2K
              </span>
              <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                6
              </span>
            </div>
            <a href className="inline-flex items-center">
              <img
                alt="blog"
                src="https://dummyimage.com/104x104"
                className="w-12 h-12 rounded-full flex-shrink-0 object-cover object-center"
              />
              <span className="flex-grow flex flex-col pl-4">
                <span className="title-font font-medium text-white">
                  Holden Caulfield
                </span>
                <span className="text-gray-500 text-xs tracking-widest mt-0.5">UI DEVELOPER</span>
              </span>
            </a>
          </div>
          <div className="p-12 md:w-1/2 flex flex-col items-start">
            <span className="inline-block py-1 px-2 rounded bg-gray-800 text-gray-400 text-opacity-75 text-xs font-medium tracking-widest">
              CATEGORY
            </span>
            <h2 className="sm:text-3xl text-2xl title-font font-medium text-white mt-4 mb-4">
              Pinterest DIY dreamcatcher gentrify single-origin coffee
            </h2>
            <p className="leading-relaxed mb-8">
              Live-edge letterpress cliche, salvia fanny pack humblebrag narwhal
              portland. VHS man braid palo santo hoodie brunch trust fund. Bitters
              hashtag waistcoat fashion axe chia unicorn. Plaid fixie chambray 90's,
              slow-carb etsy tumeric.
            </p>
            <div className="flex items-center flex-wrap pb-4 mb-4 border-b-2 border-gray-800 border-opacity-75 mt-auto w-full">
              <a href className={`text-${props.theme}-400 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <span className="text-gray-500 mr-3 inline-flex items-center ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-800">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx={12} cy={12} r={3} />
                </svg>
                1.2K
              </span>
              <span className="text-gray-500 inline-flex items-center leading-none text-sm">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                6
              </span>
            </div>
            <a href className="inline-flex items-center">
              <img
                alt="blog"
                src="https://dummyimage.com/103x103"
                className="w-12 h-12 rounded-full flex-shrink-0 object-cover object-center"
              />
              <span className="flex-grow flex flex-col pl-4">
                <span className="title-font font-medium text-white">
                  Alper Kamu
                </span>
                <span className="text-gray-500 text-xs tracking-widest mt-0.5">DESIGNER</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

DarkBlogC.defaultProps = {
  theme: 'indigo'
};

DarkBlogC.propTypes = {
  theme: PropTypes.string.isRequired
};

export default DarkBlogC;

```

### Core Architecture Module: `src/blocks/blog/dark/d.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function DarkBlogD(props) {
  return (
    <section className="text-gray-400 bg-gray-900 body-font overflow-hidden">
      <div className="container px-5 py-24 mx-auto">
        <div className="-my-8 divide-y-2 divide-gray-800">
          <div className="py-8 flex flex-wrap md:flex-nowrap">
            <div className="md:w-64 md:mb-0 mb-6 flex-shrink-0 flex flex-col">
              <span className="font-semibold title-font text-white">
                CATEGORY
              </span>
              <span className="mt-1 text-gray-500 text-sm">12 Jun 2019</span>
            </div>
            <div className="md:flex-grow">
              <h2 className="text-2xl font-medium text-white title-font mb-2">
                Bitters hashtag waistcoat fashion axe chia unicorn
              </h2>
              <p className="leading-relaxed">
                Glossier echo park pug, church-key sartorial biodiesel vexillologist
                pop-up snackwave ramps cornhole. Marfa 3 wolf moon party messenger
                bag selfies, poke vaporware kombucha lumbersexual pork belly
                polaroid hoodie portland craft beer.
              </p>
              <a href className={`text-${props.theme}-400 inline-flex items-center mt-4`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
          <div className="py-8 flex border-t-2 border-gray-800 flex-wrap md:flex-nowrap">
            <div className="md:w-64 md:mb-0 mb-6 flex-shrink-0 flex flex-col">
              <span className="font-semibold title-font text-white">
                CATEGORY
              </span>
              <span className="mt-1 text-gray-500 text-sm">12 Jun 2019</span>
            </div>
            <div className="md:flex-grow">
              <h2 className="text-2xl font-medium text-white title-font mb-2">
                Meditation bushwick direct trade taxidermy shaman
              </h2>
              <p className="leading-relaxed">
                Glossier echo park pug, church-key sartorial biodiesel vexillologist
                pop-up snackwave ramps cornhole. Marfa 3 wolf moon party messenger
                bag selfies, poke vaporware kombucha lumbersexual pork belly
                polaroid hoodie portland craft beer.
              </p>
              <a href className={`text-${props.theme}-400 inline-flex items-center mt-4`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
          <div className="py-8 flex border-t-2 border-gray-800 flex-wrap md:flex-nowrap">
            <div className="md:w-64 md:mb-0 mb-6 flex-shrink-0 flex flex-col">
              <span className="font-semibold title-font text-white">
                CATEGORY
              </span>
              <span className="mt-1 text-gray-500 text-sm">12 Jun 2019</span>
            </div>
            <div className="md:flex-grow">
              <h2 className="text-2xl font-medium text-white title-font mb-2">
                Woke master cleanse drinking vinegar salvia
              </h2>
              <p className="leading-relaxed">
                Glossier echo park pug, church-key sartorial biodiesel vexillologist
                pop-up snackwave ramps cornhole. Marfa 3 wolf moon party messenger
                bag selfies, poke vaporware kombucha lumbersexual pork belly
                polaroid hoodie portland craft beer.
              </p>
              <a href className={`text-${props.theme}-400 inline-flex items-center mt-4`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

DarkBlogD.defaultProps = {
  theme: 'indigo'
};

DarkBlogD.propTypes = {
  theme: PropTypes.string.isRequired
};

export default DarkBlogD;

```

### Core Architecture Module: `src/blocks/blog/dark/e.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function DarkBlogE(props) {
  return (
    <section className="text-gray-400 bg-gray-900 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -mx-4 -my-8">
          <div className="py-8 px-4 lg:w-1/3">
            <div className="h-full flex items-start">
              <div className="w-12 flex-shrink-0 flex flex-col text-center leading-none">
                <span className="text-gray-400 pb-2 mb-2 border-b-2 border-gray-700">
                  Jul
                </span>
                <span className="font-medium text-lg leading-none text-gray-300 title-font">
                  18
                </span>
              </div>
              <div className="flex-grow pl-6">
                <h2 className={`tracking-widest text-xs title-font font-medium text-${props.theme}-400 mb-1`}>
                  CATEGORY
                </h2>
                <h1 className="title-font text-xl font-medium text-white mb-3">
                  The 400 Blows
                </h1>
                <p className="leading-relaxed mb-5">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <a href className="inline-flex items-center">
                  <img
                    alt="blog"
                    src="https://dummyimage.com/103x103"
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover object-center"
                  />
                  <span className="flex-grow flex flex-col pl-3">
                    <span className="title-font font-medium text-white">
                      Alper Kamu
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
          <div className="py-8 px-4 lg:w-1/3">
            <div className="h-full flex items-start">
              <div className="w-12 flex-shrink-0 flex flex-col text-center leading-none">
                <span className="text-gray-400 pb-2 mb-2 border-b-2 border-gray-700">
                  Jul
                </span>
                <span className="font-medium text-lg leading-none text-gray-300 title-font">
                  18
                </span>
              </div>
              <div className="flex-grow pl-6">
                <h2 className={`tracking-widest text-xs title-font font-medium text-${props.theme}-400 mb-1`}>
                  CATEGORY
                </h2>
                <h1 className="title-font text-xl font-medium text-white mb-3">
                  Shooting Stars
                </h1>
                <p className="leading-relaxed mb-5">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <a href className="inline-flex items-center">
                  <img
                    alt="blog"
                    src="https://dummyimage.com/102x102"
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover object-center"
                  />
                  <span className="flex-grow flex flex-col pl-3">
                    <span className="title-font font-medium text-white">
                      Holden Caulfield
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
          <div className="py-8 px-4 lg:w-1/3">
            <div className="h-full flex items-start">
              <div className="w-12 flex-shrink-0 flex flex-col text-center leading-none">
                <span className="text-gray-400 pb-2 mb-2 border-b-2 border-gray-700">
                  Jul
                </span>
                <span className="font-medium text-lg leading-none text-gray-300 title-font">
                  18
                </span>
              </div>
              <div className="flex-grow pl-6">
                <h2 className={`tracking-widest text-xs title-font font-medium text-${props.theme}-400 mb-1`}>
                  CATEGORY
                </h2>
                <h1 className="title-font text-xl font-medium text-white mb-3">
                  Neptune
                </h1>
                <p className="leading-relaxed mb-5">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <a href className="inline-flex items-center">
                  <img
                    alt="blog"
                    src="https://dummyimage.com/101x101"
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover object-center"
                  />
                  <span className="flex-grow flex flex-col pl-3">
                    <span className="title-font font-medium text-white">
                      Henry Letham
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

DarkBlogE.defaultProps = {
  theme: 'indigo'
};

DarkBlogE.propTypes = {
  theme: PropTypes.string.isRequired
};

export default DarkBlogE;

```

### Core Architecture Module: `src/blocks/blog/light/a.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function LightBlogA(props) {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-4">
          <div className="p-4 md:w-1/3">
            <div className="h-full border-2 border-gray-200 border-opacity-60 rounded-lg overflow-hidden">
              <img
                className="lg:h-48 md:h-36 w-full object-cover object-center"
                src="https://dummyimage.com/720x400"
                alt="blog"
              />
              <div className="p-6">
                <h2 className="tracking-widest text-xs title-font font-medium text-gray-400 mb-1">
                  CATEGORY
                </h2>
                <h1 className="title-font text-lg font-medium text-gray-900 mb-3">
                  The Catalyzer
                </h1>
                <p className="leading-relaxed mb-3">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <div className="flex items-center flex-wrap ">
                  <a
                    href
                    className={`text-${props.theme}-500 inline-flex items-center md:mb-2 lg:mb-0`}
                  >
                    Learn More
                    <svg
                      className="w-4 h-4 ml-2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <span className="text-gray-400 mr-3 inline-flex items-center lg:ml-auto md:ml-0 ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx={12} cy={12} r={3} />
                    </svg>
                    1.2K
                  </span>
                  <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    6
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 md:w-1/3">
            <div className="h-full border-2 border-gray-200 border-opacity-60 rounded-lg overflow-hidden">
              <img
                className="lg:h-48 md:h-36 w-full object-cover object-center"
                src="https://dummyimage.com/721x401"
                alt="blog"
              />
              <div className="p-6">
                <h2 className="tracking-widest text-xs title-font font-medium text-gray-400 mb-1">
                  CATEGORY
                </h2>
                <h1 className="title-font text-lg font-medium text-gray-900 mb-3">
                  The 400 Blows
                </h1>
                <p className="leading-relaxed mb-3">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <div className="flex items-center flex-wrap">
                  <a
                    href
                    className={`text-${props.theme}-500 inline-flex items-center md:mb-2 lg:mb-0`}
                  >
                    Learn More
                    <svg
                      className="w-4 h-4 ml-2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <span className="text-gray-400 mr-3 inline-flex items-center lg:ml-auto md:ml-0 ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx={12} cy={12} r={3} />
                    </svg>
                    1.2K
                  </span>
                  <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    6
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 md:w-1/3">
            <div className="h-full border-2 border-gray-200 border-opacity-60 rounded-lg overflow-hidden">
              <img
                className="lg:h-48 md:h-36 w-full object-cover object-center"
                src="https://dummyimage.com/722x402"
                alt="blog"
              />
              <div className="p-6">
                <h2 className="tracking-widest text-xs title-font font-medium text-gray-400 mb-1">
                  CATEGORY
                </h2>
                <h1 className="title-font text-lg font-medium text-gray-900 mb-3">
                  Shooting Stars
                </h1>
                <p className="leading-relaxed mb-3">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <div className="flex items-center flex-wrap ">
                  <a
                    href
                    className={`text-${props.theme}-500 inline-flex items-center md:mb-2 lg:mb-0`}
                  >
                    Learn More
                    <svg
                      className="w-4 h-4 ml-2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </a>
                  <span className="text-gray-400 mr-3 inline-flex items-center lg:ml-auto md:ml-0 ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx={12} cy={12} r={3} />
                    </svg>
                    1.2K
                  </span>
                  <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                    </svg>
                    6
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

LightBlogA.defaultProps = {
  theme: 'indigo'
};

LightBlogA.propTypes = {
  theme: PropTypes.string.isRequired
};

export default LightBlogA;

```

### Core Architecture Module: `src/blocks/blog/light/b.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function LightBlogB(props) {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-4">
          <div className="p-4 lg:w-1/3">
            <div className="h-full bg-gray-100 bg-opacity-75 px-8 pt-16 pb-24 rounded-lg overflow-hidden text-center relative">
              <h2 className="tracking-widest text-xs title-font font-medium text-gray-400 mb-1">
                CATEGORY
              </h2>
              <h1 className="title-font sm:text-2xl text-xl font-medium text-gray-900 mb-3">
                Raclette Blueberry Nextious Level
              </h1>
              <p className="leading-relaxed mb-3">
                Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                microdosing tousled waistcoat.
              </p>
              <a href className={`text-${props.theme}-500 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div className="text-center mt-2 leading-none flex justify-center absolute bottom-0 left-0 w-full py-4">
                <span className="text-gray-400 mr-3 inline-flex items-center leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                  1.2K
                </span>
                <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  6
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 lg:w-1/3">
            <div className="h-full bg-gray-100 bg-opacity-75 px-8 pt-16 pb-24 rounded-lg overflow-hidden text-center relative">
              <h2 className="tracking-widest text-xs title-font font-medium text-gray-400 mb-1">
                CATEGORY
              </h2>
              <h1 className="title-font sm:text-2xl text-xl font-medium text-gray-900 mb-3">
                Ennui Snackwave Thundercats
              </h1>
              <p className="leading-relaxed mb-3">
                Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                microdosing tousled waistcoat.
              </p>
              <a href className={`text-${props.theme}-500 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div className="text-center mt-2 leading-none flex justify-center absolute bottom-0 left-0 w-full py-4">
                <span className="text-gray-400 mr-3 inline-flex items-center leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                  1.2K
                </span>
                <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  6
                </span>
              </div>
            </div>
          </div>
          <div className="p-4 lg:w-1/3">
            <div className="h-full bg-gray-100 bg-opacity-75 px-8 pt-16 pb-24 rounded-lg overflow-hidden text-center relative">
              <h2 className="tracking-widest text-xs title-font font-medium text-gray-400 mb-1">
                CATEGORY
              </h2>
              <h1 className="title-font sm:text-2xl text-xl font-medium text-gray-900 mb-3">
                Selvage Poke Waistcoat Godard
              </h1>
              <p className="leading-relaxed mb-3">
                Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                microdosing tousled waistcoat.
              </p>
              <a href className={`text-${props.theme}-500 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <div className="text-center mt-2 leading-none flex justify-center absolute bottom-0 left-0 w-full py-4">
                <span className="text-gray-400 mr-3 inline-flex items-center leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx={12} cy={12} r={3} />
                  </svg>
                  1.2K
                </span>
                <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                  <svg
                    className="w-4 h-4 mr-1"
                    stroke="currentColor"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                  </svg>
                  6
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

LightBlogB.defaultProps = {
  theme: 'indigo'
};

LightBlogB.propTypes = {
  theme: PropTypes.string.isRequired
};

export default LightBlogB;

```

### Core Architecture Module: `src/blocks/blog/light/c.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function LightBlogC(props) {
  return (
    <section className="text-gray-600 body-font overflow-hidden">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -m-12">
          <div className="p-12 md:w-1/2 flex flex-col items-start">
            <span className={`inline-block py-1 px-2 rounded bg-${props.theme}-50 text-${props.theme}-500 text-xs font-medium tracking-widest`}>
              CATEGORY
            </span>
            <h2 className="sm:text-3xl text-2xl title-font font-medium text-gray-900 mt-4 mb-4">
              Roof party normcore before they sold out, cornhole vape
            </h2>
            <p className="leading-relaxed mb-8">
              Live-edge letterpress cliche, salvia fanny pack humblebrag narwhal
              portland. VHS man braid palo santo hoodie brunch trust fund. Bitters
              hashtag waistcoat fashion axe chia unicorn. Plaid fixie chambray 90's,
              slow-carb etsy tumeric. Cray pug you probably haven't heard of them
              hexagon kickstarter craft beer pork chic.
            </p>
            <div className="flex items-center flex-wrap pb-4 mb-4 border-b-2 border-gray-100 mt-auto w-full">
              <a href className={`text-${props.theme}-500 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <span className="text-gray-400 mr-3 inline-flex items-center ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx={12} cy={12} r={3} />
                </svg>
                1.2K
              </span>
              <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                6
              </span>
            </div>
            <a href className="inline-flex items-center">
              <img
                alt="blog"
                src="https://dummyimage.com/104x104"
                className="w-12 h-12 rounded-full flex-shrink-0 object-cover object-center"
              />
              <span className="flex-grow flex flex-col pl-4">
                <span className="title-font font-medium text-gray-900">
                  Holden Caulfield
                </span>
                <span className="text-gray-400 text-xs tracking-widest mt-0.5">UI DEVELOPER</span>
              </span>
            </a>
          </div>
          <div className="p-12 md:w-1/2 flex flex-col items-start">
            <span className={`inline-block py-1 px-2 rounded bg-${props.theme}-50 text-${props.theme}-500 text-xs font-medium tracking-widest`}>
              CATEGORY
            </span>
            <h2 className="sm:text-3xl text-2xl title-font font-medium text-gray-900 mt-4 mb-4">
              Pinterest DIY dreamcatcher gentrify single-origin coffee
            </h2>
            <p className="leading-relaxed mb-8">
              Live-edge letterpress cliche, salvia fanny pack humblebrag narwhal
              portland. VHS man braid palo santo hoodie brunch trust fund. Bitters
              hashtag waistcoat fashion axe chia unicorn. Plaid fixie chambray 90's,
              slow-carb etsy tumeric.
            </p>
            <div className="flex items-center flex-wrap pb-4 mb-4 border-b-2 border-gray-100 mt-auto w-full">
              <a href className={`text-${props.theme}-500 inline-flex items-center`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <span className="text-gray-400 mr-3 inline-flex items-center ml-auto leading-none text-sm pr-3 py-1 border-r-2 border-gray-200">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx={12} cy={12} r={3} />
                </svg>
                1.2K
              </span>
              <span className="text-gray-400 inline-flex items-center leading-none text-sm">
                <svg
                  className="w-4 h-4 mr-1"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                6
              </span>
            </div>
            <a href className="inline-flex items-center">
              <img
                alt="blog"
                src="https://dummyimage.com/103x103"
                className="w-12 h-12 rounded-full flex-shrink-0 object-cover object-center"
              />
              <span className="flex-grow flex flex-col pl-4">
                <span className="title-font font-medium text-gray-900">
                  Alper Kamu
                </span>
                <span className="text-gray-400 text-xs tracking-widest mt-0.5">DESIGNER</span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

LightBlogC.defaultProps = {
  theme: 'indigo'
};

LightBlogC.propTypes = {
  theme: PropTypes.string.isRequired
};

export default LightBlogC;

```

### Core Architecture Module: `src/blocks/blog/light/d.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function LightBlogD(props) {
  return (
    <section className="text-gray-600 body-font overflow-hidden">
      <div className="container px-5 py-24 mx-auto">
        <div className="-my-8 divide-y-2 divide-gray-100">
          <div className="py-8 flex flex-wrap md:flex-nowrap">
            <div className="md:w-64 md:mb-0 mb-6 flex-shrink-0 flex flex-col">
              <span className="font-semibold title-font text-gray-700">
                CATEGORY
              </span>
              <span className="mt-1 text-gray-500 text-sm">12 Jun 2019</span>
            </div>
            <div className="md:flex-grow">
              <h2 className="text-2xl font-medium text-gray-900 title-font mb-2">
                Bitters hashtag waistcoat fashion axe chia unicorn
              </h2>
              <p className="leading-relaxed">
                Glossier echo park pug, church-key sartorial biodiesel vexillologist
                pop-up snackwave ramps cornhole. Marfa 3 wolf moon party messenger
                bag selfies, poke vaporware kombucha lumbersexual pork belly
                polaroid hoodie portland craft beer.
              </p>
              <a href className={`text-${props.theme}-500 inline-flex items-center mt-4`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
          <div className="py-8 flex flex-wrap md:flex-nowrap">
            <div className="md:w-64 md:mb-0 mb-6 flex-shrink-0 flex flex-col">
              <span className="font-semibold title-font text-gray-700">
                CATEGORY
              </span>
              <span className="mt-1 text-gray-500 text-sm">12 Jun 2019</span>
            </div>
            <div className="md:flex-grow">
              <h2 className="text-2xl font-medium text-gray-900 title-font mb-2">
                Meditation bushwick direct trade taxidermy shaman
              </h2>
              <p className="leading-relaxed">
                Glossier echo park pug, church-key sartorial biodiesel vexillologist
                pop-up snackwave ramps cornhole. Marfa 3 wolf moon party messenger
                bag selfies, poke vaporware kombucha lumbersexual pork belly
                polaroid hoodie portland craft beer.
              </p>
              <a href className={`text-${props.theme}-500 inline-flex items-center mt-4`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
          <div className="py-8 flex flex-wrap md:flex-nowrap">
            <div className="md:w-64 md:mb-0 mb-6 flex-shrink-0 flex flex-col">
              <span className="font-semibold title-font text-gray-700">
                CATEGORY
              </span>
              <span className="text-sm text-gray-500">12 Jun 2019</span>
            </div>
            <div className="md:flex-grow">
              <h2 className="text-2xl font-medium text-gray-900 title-font mb-2">
                Woke master cleanse drinking vinegar salvia
              </h2>
              <p className="leading-relaxed">
                Glossier echo park pug, church-key sartorial biodiesel vexillologist
                pop-up snackwave ramps cornhole. Marfa 3 wolf moon party messenger
                bag selfies, poke vaporware kombucha lumbersexual pork belly
                polaroid hoodie portland craft beer.
              </p>
              <a href className={`text-${props.theme}-500 inline-flex items-center mt-4`}>
                Learn More
                <svg
                  className="w-4 h-4 ml-2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

LightBlogD.defaultProps = {
  theme: 'indigo'
};

LightBlogD.propTypes = {
  theme: PropTypes.string.isRequired
};

export default LightBlogD;

```

### Core Architecture Module: `src/blocks/blog/light/e.js`
```
import React from 'react';
import PropTypes from  "prop-types";

function LightBlogE(props) {
  return (
    <section className="text-gray-600 body-font">
      <div className="container px-5 py-24 mx-auto">
        <div className="flex flex-wrap -mx-4 -my-8">
          <div className="py-8 px-4 lg:w-1/3">
            <div className="h-full flex items-start">
              <div className="w-12 flex-shrink-0 flex flex-col text-center leading-none">
                <span className="text-gray-500 pb-2 mb-2 border-b-2 border-gray-200">
                  Jul
                </span>
                <span className="font-medium text-lg text-gray-800 title-font leading-none">
                  18
                </span>
              </div>
              <div className="flex-grow pl-6">
                <h2 className={`tracking-widest text-xs title-font font-medium text-${props.theme}-500 mb-1`}>
                  CATEGORY
                </h2>
                <h1 className="title-font text-xl font-medium text-gray-900 mb-3">
                  The 400 Blows
                </h1>
                <p className="leading-relaxed mb-5">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <a href className="inline-flex items-center">
                  <img
                    alt="blog"
                    src="https://dummyimage.com/103x103"
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover object-center"
                  />
                  <span className="flex-grow flex flex-col pl-3">
                    <span className="title-font font-medium text-gray-900">
                      Alper Kamu
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
          <div className="py-8 px-4 lg:w-1/3">
            <div className="h-full flex items-start">
              <div className="w-12 flex-shrink-0 flex flex-col text-center leading-none">
                <span className="text-gray-500 pb-2 mb-2 border-b-2 border-gray-200">
                  Jul
                </span>
                <span className="font-medium text-lg text-gray-800 title-font leading-none">
                  18
                </span>
              </div>
              <div className="flex-grow pl-6">
                <h2 className={`tracking-widest text-xs title-font font-medium text-${props.theme}-500 mb-1`}>
                  CATEGORY
                </h2>
                <h1 className="title-font text-xl font-medium text-gray-900 mb-3">
                  Shooting Stars
                </h1>
                <p className="leading-relaxed mb-5">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <a href className="inline-flex items-center">
                  <img
                    alt="blog"
                    src="https://dummyimage.com/102x102"
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover object-center"
                  />
                  <span className="flex-grow flex flex-col pl-3">
                    <span className="title-font font-medium text-gray-900">
                      Holden Caulfield
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
          <div className="py-8 px-4 lg:w-1/3">
            <div className="h-full flex items-start">
              <div className="w-12 flex-shrink-0 flex flex-col text-center leading-none">
                <span className="text-gray-500 pb-2 mb-2 border-b-2 border-gray-200">
                  Jul
                </span>
                <span className="font-medium text-lg text-gray-800 title-font leading-none">
                  18
                </span>
              </div>
              <div className="flex-grow pl-6">
                <h2 className={`tracking-widest text-xs title-font font-medium text-${props.theme}-500 mb-1`}>
                  CATEGORY
                </h2>
                <h1 className="title-font text-xl font-medium text-gray-900 mb-3">
                  Neptune
                </h1>
                <p className="leading-relaxed mb-5">
                  Photo booth fam kinfolk cold-pressed sriracha leggings jianbing
                  microdosing tousled waistcoat.
                </p>
                <a href className="inline-flex items-center">
                  <img
                    alt="blog"
                    src="https://dummyimage.com/101x101"
                    className="w-8 h-8 rounded-full flex-shrink-0 object-cover object-center"
                  />
                  <span className="flex-grow flex flex-col pl-3">
                    <span className="title-font font-medium text-gray-900">
                      Henry Letham
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

LightBlogE.defaultProps = {
  theme: 'indigo'
};

LightBlogE.propTypes = {
  theme: PropTypes.string.isRequired
};

export default LightBlogE;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #47** (2020-12-24): **Pricing 2 does not show labels on mobile view**
  *Symptoms*: The labels that details each pricing features is not shown on the Pricing 2
  **Post-Mortem & Fix Analysis**:
  > The block is removed, I didn't find the solution to making responsive the block.

- **Issue #8** (2020-05-25): **Hide sidebar on Firefox**
  *Symptoms*: The 8d9fb271523d70c6889a6ef831218e17dcf746fe commit doesn't work on Firefox. Works on Chrome.
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting it @bptrsn.  Fixed - 710b1911aff3ece37921d202661dda6f6fb65ed2

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

### Incident Patch 1: `8a5855dc` (2021-01-02)
**Commit Message**: app:: ui updates for mobile view

**File**: `src/index.css` (modified, +3/-1)
```diff
@@ -127,14 +127,16 @@ iframe {
 
 .app {
   height: 100vh;
+  display: flex;
+  flex-direction: column;
 }
 
 .app.dark-mode {
   background-color: #111827;
 }
 
 .main {
-  height: calc(100vh - 64px);
+  flex-grow: 1;
   overflow: auto;
   transition: .3s;
 }
```

---

### Incident Patch 2: `a543ec91` (2020-12-29)
**Commit Message**: Revert "Revert "promote bar""

This reverts commit 1fd7a75368153b0b5e8a2c54c970ccd71fee435d.

**File**: `src/App.js` (modified, +12/-1)
```diff
@@ -94,6 +94,7 @@ class App extends Component {
       copied: false,
       sidebar: true,
       codeView: false,
+      showNotification: false,
       currentKeyCode: null,
       view: 'desktop',
       theme: 'indigo',
@@ -119,6 +120,9 @@ class App extends Component {
 
   componentDidMount() {
     document.addEventListener('keydown', this.keyboardNavigation);
+    setTimeout(() => {
+      this.setState({ showNotification: true })
+    }, 1000);
   }
 
   hideSidebar() {
@@ -315,13 +319,20 @@ class App extends Component {
 }
 
   render() {
-    const { darkMode, theme, blockName, blockType, sidebar, view, copied, currentKeyCode } = this.state;
+    const { darkMode, theme, blockName, blockType, sidebar, view, copied, currentKeyCode, showNotification } = this.state;
     return (
       <div className={`app${darkMode ? ' dark-mode' : ''}${sidebar ? ' has-sidebar' : ''} ${theme} ${view}`}>
         <textarea className="copy-textarea" ref={this.textareaRef} />
         <aside className="sidebar" ref={this.sidebarRef}>
           {this.listRenderer()}
         </aside>
+        <div className={`md:flex hidden lg:text-sm text-xs bg-${theme}-600 text-white text-center ${showNotification ? 'h-14' : 'h-0'} overflow-hidden items-center justify-center relative`} style={{ paddingLeft: 160, transition: 'height .45s' }}>
+          <p>Would you like to work with the <span className="font-medium">Tailblocks Team</span> on your new Tailwind project?</p>
+          <a href="mailto:tailblocksteam@gmail.com" className="text-white border-b border-white font-medium ml-2 px-0.5">Email us</a>
+          <button className={`w-8 h-8 inline-flex items-center justify-center bg-${theme}-700 rounded-full absolute right-4 top-3 z-index-20`} onClick={() => this.setState({ showNotification: false })}>
+            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
+          </button>
+        </div>
         <div className="toolbar">
           <button className="opener" onClick={this.toggleSidebar} ref={this.openerRef}>TAILBLOCKS</button>
           {this.state.codeView &&
```

**File**: `src/index.css` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@
   --base-200: #E2E8F0;
   --base-300: #E2E8F0;
   --base-400: #CBD5E0;
-  --main-500: #667EEA;
+  --main-500: #6366f1;
   --main-400: #7F9CF5;
   --main-200: #c3dafe;
   --main-100: #EBF4FF;
@@ -24,7 +24,7 @@
   --base-200: #2d3748;
   --base-300: #4a5568;
   --base-400: #4a5568;
-  --main-500: #667eea;
+  --main-500: #6366f1;
   --main-200: #4a5568;
   --main-100: #2d3648;
   --solid: #111827;
```

---

### Incident Patch 3: `1fd7a753` (2020-12-29)
**Commit Message**: Revert "promote bar"

This reverts commit f969597853d0ed4892c12dc8fcf410a71e606fd4.

**File**: `src/App.js` (modified, +1/-12)
```diff
@@ -94,7 +94,6 @@ class App extends Component {
       copied: false,
       sidebar: true,
       codeView: false,
-      showNotification: false,
       currentKeyCode: null,
       view: 'desktop',
       theme: 'indigo',
@@ -120,9 +119,6 @@ class App extends Component {
 
   componentDidMount() {
     document.addEventListener('keydown', this.keyboardNavigation);
-    setTimeout(() => {
-      this.setState({ showNotification: true })
-    }, 1000);
   }
 
   hideSidebar() {
@@ -319,20 +315,13 @@ class App extends Component {
 }
 
   render() {
-    const { darkMode, theme, blockName, blockType, sidebar, view, copied, currentKeyCode, showNotification } = this.state;
+    const { darkMode, theme, blockName, blockType, sidebar, view, copied, currentKeyCode } = this.state;
     return (
       <div className={`app${darkMode ? ' dark-mode' : ''}${sidebar ? ' has-sidebar' : ''} ${theme} ${view}`}>
         <textarea className="copy-textarea" ref={this.textareaRef} />
         <aside className="sidebar" ref={this.sidebarRef}>
           {this.listRenderer()}
         </aside>
-        <div className={`md:flex hidden lg:text-sm text-xs bg-${theme}-600 text-white text-center ${showNotification ? 'h-14' : 'h-0'} overflow-hidden items-center justify-center relative`} style={{ paddingLeft: 160, transition: 'height .45s' }}>
-          <p>Would you like to work with the <span className="font-medium">Tailblocks Team</span> on your new Tailwind project?</p>
-          <a href="mailto:tailblocksteam@gmail.com" className="text-white border-b border-white font-medium ml-2 px-0.5">Email us</a>
-          <button className={`w-8 h-8 inline-flex items-center justify-center bg-${theme}-700 rounded-full absolute right-4 top-3 z-index-20`} onClick={() => this.setState({ showNotification: false })}>
-            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
-          </button>
-        </div>
         <div className="toolbar">
           <button className="opener" onClick={this.toggleSidebar} ref={this.openerRef}>TAILBLOCKS</button>
           {this.state.codeView &&
```

**File**: `src/index.css` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@
   --base-200: #E2E8F0;
   --base-300: #E2E8F0;
   --base-400: #CBD5E0;
-  --main-500: #6366f1;
+  --main-500: #667EEA;
   --main-400: #7F9CF5;
   --main-200: #c3dafe;
   --main-100: #EBF4FF;
@@ -24,7 +24,7 @@
   --base-200: #2d3748;
   --base-300: #4a5568;
   --base-400: #4a5568;
-  --main-500: #6366f1;
+  --main-500: #667eea;
   --main-200: #4a5568;
   --main-100: #2d3648;
   --solid: #111827;
```

---

### Incident Patch 4: `8f13a53c` (2020-11-08)
**Commit Message**: team :: issue fix #35

**File**: `src/App.js` (modified, +8/-0)
```diff
@@ -390,6 +390,14 @@ class App extends Component {
             </div>
           </div>
         </main>
+        <a href="https://twitter.com/knyttneve" className="twitter" target="_blank" rel="noopener noreferrer">
+          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
+            <path
+              fill="currentColor"
+              d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.082 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.282.76-1.577-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209.96-.262 1.98-.392 3-.398 1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.56C20.565 21.917 24 17.495 24 12.292 24 5.78 18.627.5 12 .5z"
+            />
+          </svg>
+        </a>
         <a href="https://github.com/mertJF/tailblocks" className="github" target="_blank" rel="noopener noreferrer">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
             <path
```

**File**: `src/blocks/team/dark/b.js` (modified, +12/-0)
```diff
@@ -35,6 +35,7 @@ function DarkTeamB() {
                   <a href className="text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -47,6 +48,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -59,6 +61,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -92,6 +95,7 @@ function DarkTeamB() {
                   <a href className="text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -104,6 +108,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -116,6 +121,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -149,6 +155,7 @@ function DarkTeamB() {
                   <a href className="text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -161,6 +168,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -173,6 +181,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -206,6 +215,7 @@ function DarkTeamB() {
                   <a href className="text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -218,6 +228,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -230,6 +241,7 @@ function DarkTeamB() {
                   <a href className="ml-2 text-gray-700">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
```

**File**: `src/blocks/team/light/b.js` (modified, +12/-0)
```diff
@@ -35,6 +35,7 @@ function LightTeamB() {
                   <a href className="text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -47,6 +48,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -59,6 +61,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -92,6 +95,7 @@ function LightTeamB() {
                   <a href className="text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -104,6 +108,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -116,6 +121,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -149,6 +155,7 @@ function LightTeamB() {
                   <a href className="text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -161,6 +168,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -173,6 +181,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -206,6 +215,7 @@ function LightTeamB() {
                   <a href className="text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -218,6 +228,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
@@ -230,6 +241,7 @@ function LightTeamB() {
                   <a href className="ml-2 text-gray-500">
                     <svg
                       fill="none"
+                      stroke="currentColor"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                       strokeWidth="2"
```

---

### Incident Patch 5: `44b9a41d` (2020-05-30)
**Commit Message**: ContactA - Light :: fix, class name typo

**File**: `src/blocks/contact/light/a.js` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ function LightContactA(props) {
           <div className="relative mb-4">
             <label
               htmlFor="email"
-              className="leading-7text-sm text-gray-600"
+              className="leading-7 text-sm text-gray-600"
             >
               Email
             </label>
```

---

### Incident Patch 6: `710b1911` (2020-05-25)
**Commit Message**: App :: fix, the sidebar hiding issue on Firefox

**File**: `src/App.js` (modified, +10/-5)
```diff
@@ -114,13 +114,18 @@ class App extends Component {
     const iframe = document.querySelector('iframe');
     const sidebar = this.sidebarRef.current;
     const opener = this.openerRef.current;
+    let iframeMouseOver = false;
 
+    window.focus();
     window.addEventListener('blur', () => {
-     if (document.activeElement === iframe) {
-      this.setState({ sidebar: false });
-     }
+      if (iframeMouseOver) {
+        this.setState({ sidebar: false });
+      }
     });
 
+    iframe.addEventListener('mouseover', () => iframeMouseOver = true);
+    iframe.addEventListener('mouseout', () => iframeMouseOver = false);
+
     document.addEventListener('click', (e) => {
       if (e.target === opener) {
         return;
@@ -197,7 +202,7 @@ class App extends Component {
     this.setState({ view, codeView: false });
   }
 
-  toggleView(e) {
+  toggleView() {
     this.setState({ codeView: !this.state.codeView, view: 'desktop', markup: this.markupRef.current.innerHTML })
   }
 
@@ -225,7 +230,7 @@ class App extends Component {
     return viewList.map((v, k) => <button key={k} className={`device${view === v.name ? ' is-active' : ''}`} data-view={v.name} onClick={this.changeView}>{v.icon}</button>);
   }
 
-  toggleSidebar(e) {
+  toggleSidebar() {
     this.setState({ sidebar: !this.state.sidebar });
   }
 
```

---

### Incident Patch 7: `2855e366` (2020-05-23)
**Commit Message**: App :: github link ui update

**File**: `src/App.js` (modified, +6/-2)
```diff
@@ -297,9 +297,13 @@ class App extends Component {
           </div>
         </main>
         <a href="https://github.com/mertJF/tailblocks" className="github" target="_blank" rel="noopener noreferrer">
-          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
-            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
+          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
+            <path
+              fill="currentColor"
+              d="M12 .5C5.37.5 0 5.78 0 12.292c0 5.211 3.438 9.63 8.205 11.188.6.111.82-.254.82-.567 0-.28-.01-1.022-.015-2.005-3.338.711-4.042-1.582-4.042-1.582-.546-1.361-1.335-1.725-1.335-1.725-1.087-.731.084-.716.084-.716 1.205.082 1.838 1.215 1.838 1.215 1.07 1.803 2.809 1.282 3.495.981.108-.763.417-1.282.76-1.577-2.665-.295-5.466-1.309-5.466-5.827 0-1.287.465-2.339 1.235-3.164-.135-.298-.54-1.497.105-3.121 0 0 1.005-.316 3.3 1.209.96-.262 1.98-.392 3-.398 1.02.006 2.04.136 3 .398 2.28-1.525 3.285-1.209 3.285-1.209.645 1.624.24 2.823.12 3.121.765.825 1.23 1.877 1.23 3.164 0 4.53-2.805 5.527-5.475 5.817.42.354.81 1.077.81 2.182 0 1.578-.015 2.846-.015 3.229 0 .309.21.678.825.56C20.565 21.917 24 17.495 24 12.292 24 5.78 18.627.5 12 .5z"
+            />
           </svg>
+          GitHub
         </a>
       </div>
     );
```

**File**: `src/index.css` (modified, +37/-4)
```diff
@@ -552,19 +552,25 @@ pre, code {
 }
 
 .github {
-  width: 52px;
-  height: 52px;
-  border-radius: 50%;
+  padding: 8px 12px;
+  border-radius: 50px;
   position: fixed;
   right: 20px;
   bottom: 20px;
   background-color: var(--solid-900);
   color: #fff;
   display: inline-flex;
+  font-weight: 600;
   align-items: center;
   justify-content: center;
 }
 
+.github svg {
+  width: 24px;
+  flex-shrink: 0;
+  margin-right: 6px;
+}
+
 .dark-mode .github {
   color: #1a202c;
   background-color: #fff;
@@ -649,5 +655,32 @@ pre, code {
 
   .dark-mode .switcher {
     background-color: #1a202c;
-  } 
+  }
+}
+
+@media (max-width: 380px) {
+  .github {
+    width: 36px;
+    height: 36px;
+    overflow: hidden;
+    border-radius: 50%;
+    color: transparent;
+    white-space: nowrap;
+  }
+
+  .github svg {
+    position: absolute;
+    top: 50%;
+    left: 50%;
+    color: #fff;
+    transform: translate(-50%, -50%);
+  }
+
+  .dark-mode .github {
+    color: transparent;
+  }
+
+  .dark-mode .github svg {
+    color: #1a202c;
+  }
 }
```

---

### Incident Patch 8: `77629048` (2020-05-18)
**Commit Message**: UI :: toolbar ui updates

**File**: `src/index.css` (modified, +5/-20)
```diff
@@ -435,26 +435,7 @@ svg { width: 100%; }
 }
 
 .copy-to-clipboard {
-  width: 200px;
-}
-
-.copy-the-block:hover {
-  background-color: rgba(255, 255, 255, .12);
-}
-
-.copy-the-block.is-copied {
-  background-color: #fff;
-  color: #333;
-  animation-name: pulse;
-  animation-duration: .16s;
-  animation-direction: alternate;
-  animation-iteration-count: infinite;
-}
-
-@keyframes pulse{
-  100% {
-    box-shadow: 0 0 0 10px rgba(255, 255, 255, .1);
-  }
+  width: auto;
 }
 
 .copy-the-block > svg {
@@ -463,6 +444,10 @@ svg { width: 100%; }
   margin-right: 6px;
 }
 
+.copy-to-clipboard > svg {
+  width: 13px;
+}
+
 .knyttneve {
   position: fixed;
   bottom: 20px;
```

---

### Incident Patch 9: `7c948086` (2020-05-18)
**Commit Message**: Merge pull request #2 from omergulen/fix-stuff

App :: Fix svg element attributes

**File**: `src/App.js` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ class App extends Component {
           </div>
         </main>
         <a href="https://github.com/mertJF/tailblocks" className="github" target="_blank" rel="noopener noreferrer">
-          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
+          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
           </svg>
         </a>
```

---

### Incident Patch 10: `a043eda0` (2020-05-18)
**Commit Message**: App :: Fix svg element attributes

**File**: `src/App.js` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ class App extends Component {
           </div>
         </main>
         <a href="https://github.com/mertJF/tailblocks" className="github" target="_blank" rel="noopener noreferrer">
-          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
+          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
           </svg>
         </a>
```

#### Recent Merged Pull Requests:
- **PR #111** (closed): Fixing the footer at the bottom (@manamelacedric)
- **PR #105** (closed): added font color to select menu under dark mode (@visheshism)
- **PR #72** (closed): Added pagination (@berkslv)
- **PR #71** (closed): fix: remove undefined classnames (@brc-dd)
- **PR #66** (2021-05-24): TeamC:: Add stroke color to SVG icons (@a4vg)
- **PR #65** (closed): Enhanced Documentation (@HimajPatil)
- **PR #64** (closed): Adds support for native TW2.0 dark-mode (via class) & theme with CSS variables (@kenotron)
- **PR #54** (closed): Upgrade nowrap classes for Tailwind 2.0 (@mike-hearn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
