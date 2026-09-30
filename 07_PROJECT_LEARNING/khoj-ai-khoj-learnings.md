# Forensic Learning Record (Deep Inspection): khoj-ai/khoj

> **Canonical Artifact**: `07_PROJECT_LEARNING/khoj-ai-khoj-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/khoj-ai/khoj](https://github.com/khoj-ai/khoj))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:42:36.192Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `khoj-ai/khoj`
- **Description**: Your AI second brain. Self-hostable. Get answers from the web or your docs. Build custom agents, schedule automations, do deep research. Turn any online or local LLM into your personal, autonomous AI (gpt, claude, gemini, llama, qwen, mistral). Get started - free.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 37547 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `documentation/babel.config.js`
```
module.exports = {
  presets: [require.resolve('@docusaurus/core/lib/babel/preset')],
};

```

### Core Architecture Module: `documentation/docusaurus.config.js`
```
// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Khoj AI',
  tagline: 'Your Second Brain',

  staticDirectories: ['assets'],

  favicon: 'img/favicon-128x128.ico',

  // Set the production url of your site here
  url: 'https://docs.khoj.dev',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'khoj-ai', // Usually your GitHub org/user name.
  projectName: 'khoj', // Usually your repo name.

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
        onBrokenMarkdownLinks: 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Add a widget for Chatwoot for live chat if users need help
  clientModules: [require.resolve('./src/components/ChatwootWidget.js')],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/khoj-ai/khoj/tree/master/documentation/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/khoj-ai/khoj/tree/master/documentation/blog/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          lastmod: 'date',
          changefreq: 'weekly',
          priority: 0.5,
          filename: 'sitemap.xml',
        },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/khoj_documentation.png',
      metadata: [
        {name: 'og:title', content: 'Docs'},
        {name: 'og:type', content: 'website'},
        {name: 'og:site_name', content: 'Khoj Documentation'},
        {name: 'og:description', content: 'Quickly get started with using or self-hosting Khoj'},
        {name: 'og:url', content: 'https://docs.khoj.dev'},
        {name: 'keywords', content: 'khoj, khoj ai, chatgpt, open source ai, open source, transparent, accessible, trustworthy, hackable, index notes, rag, productivity'}
      ],
      navbar: {
        title: 'Khoj',
        logo: {
          alt: 'Khoj AI',
          src: 'img/favicon-128x128.ico',
        },
        items: [
          {
            href: 'https://github.com/khoj-ai/khoj',
            position: 'right',
            className: 'header-github-link',
            title: 'Codebase',
            'aria-label': 'GitHub repository',
          },
          {
            href: 'https://app.khoj.dev',
            position: 'right',
            className: 'header-cloud-link',
            title: 'Khoj Cloud',
            'aria-label': 'Khoj Cloud',
          },
          {
            href: 'https://discord.gg/BDgyabRM6e',
            position: 'right',
            className: 'header-discord-link',
            title: 'Community',
            'aria-label': 'Discord community',
          },
          {
            href: 'https://blog.khoj.dev',
            position: 'right',
            className: 'header-blog-link',
            title: 'Blog',
            'aria-label': 'Khoj Blog',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Get Started',
                to: '/',
              },
              {
                label: 'Privacy',
                to: '/privacy',
              },
              {
                label: 'Features',
                to: '/features/all-features',
              },
              {
                label: 'Client Apps',
                to: '/category/clients',
              },
              {
                label: 'Self-Host',
                to: '/get-started/setup',
              },
              {
                label: 'Contribute',
                to: '/contributing/development',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/BDgyabRM6e',
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/company/khoj-ai/'
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/khoj_ai',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/khoj-ai/khoj/issues',
              },
              {
                label: 'Email',
                href: 'mailto:team@khoj.dev',
              }
            ],
          },
          {
            title: 'More',
            items: [
              {
                href: 'https://blog.khoj.dev',
                label: 'Blog',
              },
              {
                label: 'Khoj Cloud',
                href: 'https://app.khoj.dev',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/khoj-ai/khoj',
              },
              {
                label: 'Khoj Inc.',
                href: 'https://khoj.dev',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Khoj, Inc.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
      algolia: {
        appId: "NBR0FXJNGW",
        apiKey: "8841b34192a28b2d06f04dd28d768017",
        indexName: "khoj",
        contextualSearch: false,
      }
    }),
};

export default config;

```

### Core Architecture Module: `documentation/sidebars.js`
```
/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  tutorialSidebar: [{type: 'autogenerated', dirName: '.'}],

  // But you can create a sidebar manually
  /*
  tutorialSidebar: [
    'intro',
    'hello',
    {
      type: 'category',
      label: 'Tutorial',
      items: ['tutorial-basics/create-a-document'],
    },
  ],
   */
};

export default sidebars;

```

### Core Architecture Module: `documentation/src/components/ChatwootWidget.js`
```
import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

// Only execute on client-side
if (ExecutionEnvironment.canUseDOM) {
  (function (d, t) {
    var BASE_URL = "https://app.chatwoot.com";
    var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + "/packs/js/sdk.js";
    g.defer = true;
    g.async = true;
    s.parentNode.insertBefore(g, s);
    g.onload = function () {
      window.chatwootSDK.run({
        websiteToken: 'cFxvnLSjfE2UF4UUiPCA5NsF',
        baseUrl: BASE_URL
      })
    }
  })(document, 'script');
}

```

### Core Architecture Module: `gunicorn-config.py`
```
import os

bind = "0.0.0.0:42110"

# Worker Configuration
workers = int(os.environ.get("GUNICORN_WORKERS", 6))
worker_class = "uvicorn.workers.UvicornWorker"

# Worker Timeout Configuration
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 180))
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", 90))
keep_alive = int(os.environ.get("GUNICORN_KEEP_ALIVE", 60))

# Logging Configuration
accesslog = "-"
errorlog = "-"
loglevel = "debug"

```

### Core Architecture Module: `src/interface/desktop/chatutils.js`
```
function copyParentText(event, message=null) {
    const button = event.currentTarget;
    const textContent = message ?? button.parentNode.textContent.trim();
    navigator.clipboard.writeText(textContent).then(() => {
        button.firstChild.src = "./assets/icons/copy-button-success.svg";
        setTimeout(() => {
            button.firstChild.src = "./assets/icons/copy-button.svg";
        }, 1000);
    }).catch((error) => {
        console.error("Error copying text to clipboard:", error);
        const originalButtonText = button.innerHTML;
        button.innerHTML = "⛔️";
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.firstChild.src = "./assets/icons/copy-button.svg";
        }, 2000);
    });
}

function createCopyParentText(message) {
    return function(event) {
        copyParentText(event, message);
    }
}
function formatDate(date) {
    // Format date in HH:MM, DD MMM YYYY format
    let time_string = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
    let date_string = date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit'}).replaceAll('-', ' ');
    return `${time_string}, ${date_string}`;
}

function generateReference(referenceJson, index) {
    let reference = referenceJson.hasOwnProperty("compiled") ? referenceJson.compiled : referenceJson;
    let referenceFile = referenceJson.hasOwnProperty("file") ? referenceJson.file : null;

    // Escape reference for HTML rendering
    let escaped_ref = reference.replaceAll('"', '&quot;');

    // Generate HTML for Chat Reference
    let short_ref = escaped_ref.slice(0, 100);
    short_ref = short_ref.length < escaped_ref.length ? short_ref + "..." : short_ref;
    let referenceButton = document.createElement('button');
    referenceButton.textContent = short_ref;
    referenceButton.id = `ref-${index}`;
    referenceButton.classList.add("reference-button");
    referenceButton.classList.add("collapsed");
    referenceButton.tabIndex = 0;

    // Add event listener to toggle full reference on click
    referenceButton.addEventListener('click', function() {
        if (this.classList.contains("collapsed")) {
            this.classList.remove("collapsed");
            this.classList.add("expanded");
            this.textContent = escaped_ref;
        } else {
            this.classList.add("collapsed");
            this.classList.remove("expanded");
            this.textContent = short_ref;
        }
    });

    return referenceButton;
}

function generateOnlineReference(reference, index) {

    // Generate HTML for Chat Reference
    let title = reference.title || reference.link;
    let link = reference.link;
    let snippet = reference.snippet;
    let question = reference.question;
    if (question) {
        question = `<b>Question:</b> ${question}<br><br>`;
    } else {
        question = "";
    }

    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', link);
    linkElement.setAttribute('target', '_blank');
    linkElement.setAttribute('rel', 'noopener noreferrer');
    linkElement.classList.add("inline-chat-link");
    linkElement.classList.add("reference-link");
    linkElement.setAttribute('title', title);
    linkElement.textContent = title;

    let referenceButton = document.createElement('button');
    referenceButton.innerHTML = linkElement.outerHTML;
    referenceButton.id = `ref-${index}`;
    referenceButton.classList.add("reference-button");
    referenceButton.classList.add("collapsed");
    referenceButton.tabIndex = 0;

    // Add event listener to toggle full reference on click
    referenceButton.addEventListener('click', function() {
        if (this.classList.contains("collapsed")) {
            this.classList.remove("collapsed");
            this.classList.add("expanded");
            this.innerHTML = linkElement.outerHTML + `<br><br>${question + snippet}`;
        } else {
            this.classList.add("collapsed");
            this.classList.remove("expanded");
            this.innerHTML = linkElement.outerHTML;
        }
    });

    return referenceButton;
}

function renderMessage(message, by, dt=null, annotations=null, raw=false, renderType="append") {
    let message_time = formatDate(dt ?? new Date());
    let by_name =  by == "khoj" ? "🏮 Khoj" : "🤔 You";
    let formattedMessage = formatHTMLMessage(message, raw);

    // Create a new div for the chat message
    let chatMessage = document.createElement('div');
    chatMessage.className = `chat-message ${by}`;
    chatMessage.dataset.meta = `${by_name} at ${message_time}`;

    // Create a new div for the chat message text and append it to the chat message
    let chatMessageText = document.createElement('div');
    chatMessageText.className = `chat-message-text ${by}`;
    chatMessageText.appendChild(formattedMessage);
    chatMessage.appendChild(chatMessageText);

    // Append annotations div to the chat message
    if (annotations) {
        chatMessageText.appendChild(annotations);
    }

    // Append chat message div to chat body
    let chatBody = document.getElementById("chat-body");
    let body = document.body;
    if (renderType === "append") {
        chatBody.appendChild(chatMessage);
        // Scroll to bottom of chat-body element
        body.scrollTop = chatBody.scrollHeight;
    } else if (renderType === "prepend") {
        chatBody.insertBefore(chatMessage, chatBody.firstChild);
    } else if (renderType === "return") {
        return chatMessage;
    }

    let chatBodyWrapper = document.getElementById("chat-body");
    chatBodyWrapperHeight = chatBodyWrapper.clientHeight;
}

function processOnlineReferences(referenceSection, onlineContext) {
    let numOnlineReferences = 0;
    for (let subquery in onlineContext) {
        let onlineReference = onlineContext[subquery];
        if (onlineReference.organic && onlineReference.organic.length > 0) {
            numOnlineReferences += onlineReference.organic.length;
            for (let index in onlineReference.organic) {
                let reference = onlineReference.organic[index];
                let polishedReference = generateOnlineReference(reference, index);
                referenceSection.appendChild(polishedReference);
            }
        }

        if (onlineReference.knowledgeGraph && onlineReference.knowledgeGraph.length > 0) {
            numOnlineReferences += onlineReference.knowledgeGraph.length;
            for (let index in onlineReference.knowledgeGraph) {
                let reference = onlineReference.knowledgeGraph[index];
                let polishedReference = generateOnlineReference(reference, index);
                referenceSection.appendChild(polishedReference);
            }
        }

        if (onlineReference.peopleAlsoAsk && onlineReference.peopleAlsoAsk.length > 0) {
            numOnlineReferences += onlineReference.peopleAlsoAsk.length;
            for (let index in onlineReference.peopleAlsoAsk) {
                let reference = onlineReference.peopleAlsoAsk[index];
                let polishedReference = generateOnlineReference(reference, index);
                referenceSection.appendChild(polishedReference);
            }
        }

        if (onlineReference.webpages && onlineReference.webpages.length > 0) {
            numOnlineReferences += onlineReference.webpages.length;
            for (let index in onlineReference.webpages) {
                let reference = onlineReference.webpages[index];
                let polishedReference = generateOnlineReference(reference, index);
                referenceSection.appendChild(polishedReference);
            }
        }
    }

    return numOnlineReferences;
}

function renderMessageWithReference(message, by, context=null, dt=null, onlineContext=null, intentType=null, inferredQueries=null, conversationId=null, hostURL=null) {
    let chatEl;
    if (intentType?.includes("text-to-image")) {
        l
```

### Core Architecture Module: `src/interface/desktop/loading-animation.js`
```
let $wrap = document.getElementById('loading-animation'),

canvassize = 380,

length = 40,
radius = 6.8,

rotatevalue = 0.02,
acceleration = 0,
animatestep = 0,
toend = false,

pi2 = Math.PI*2,

group = new THREE.Group(),
mesh, ringcover, ring,

camera, scene, renderer;


camera = new THREE.PerspectiveCamera(65, 1, 1, 10000);
camera.position.z = 120;

scene = new THREE.Scene();
// scene.add(new THREE.AxisHelper(30));
scene.add(group);

mesh = new THREE.Mesh(
    new THREE.TubeGeometry(new (THREE.Curve.create(function() {},
        function(percent) {

            let x = length*Math.sin(pi2*percent),
                y = radius*Math.cos(pi2*3*percent),
                z, t;

            t = percent%0.25/0.25;
            t = percent%0.25-(2*(1-t)*t* -0.0185 +t*t*0.25);
            if (Math.floor(percent/0.25) == 0 || Math.floor(percent/0.25) == 2) {
                t *= -1;
            }
            z = radius*Math.sin(pi2*2* (percent-t));

            return new THREE.Vector3(x, y, z);

        }
    ))(), 200, 1.1, 2, true),
    new THREE.MeshBasicMaterial({
        color: 0xfcc50b
        // , wireframe: true
    })
);
group.add(mesh);

ringcover = new THREE.Mesh(new THREE.PlaneGeometry(50, 15, 1), new THREE.MeshBasicMaterial({color: 0xd1684e, opacity: 0, transparent: true}));
ringcover.position.x = length+1;
ringcover.rotation.y = Math.PI/2;
group.add(ringcover);

ring = new THREE.Mesh(new THREE.RingGeometry(4.3, 5.55, 32), new THREE.MeshBasicMaterial({color: 0xfcc50b, opacity: 0, transparent: true}));
ring.position.x = length+1.1;
ring.rotation.y = Math.PI/2;
group.add(ring);

// fake shadow
(function() {
    let plain, i;
    for (i = 0; i < 10; i++) {
        plain = new THREE.Mesh(new THREE.PlaneGeometry(length*2+1, radius*3, 1), new THREE.MeshBasicMaterial({color: 0xd1684e, transparent: true, opacity: 0.15}));
        plain.position.z = -2.5+i*0.5;
        group.add(plain);
    }
})();

renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvassize, canvassize);
renderer.setClearColor('#d1684e');


$wrap.appendChild(renderer.domElement);

function start() {
    toend = true;
}

function back() {
    toend = false;
}

function tilt(percent) {
    group.rotation.y = percent*0.5;
}

function render() {
    let progress;

    animatestep = Math.max(0, Math.min(240, toend ? animatestep+1 : animatestep-4));
    acceleration = easing(animatestep, 0, 1, 240);

    if (acceleration > 0.35) {
        progress = (acceleration-0.35)/0.65;
        group.rotation.y = -Math.PI/2 *progress;
        group.position.z = 20*progress;
        progress = Math.max(0, (acceleration-0.99)/0.01);
        mesh.material.opacity = 1-progress;
        ringcover.material.opacity = ring.material.opacity = progress;
        ring.scale.x = ring.scale.y = 0.9 + 0.1*progress;
    }

    renderer.render(scene, camera);

}

function animate() {
    mesh.rotation.x += rotatevalue + acceleration*Math.sin(Math.PI*acceleration);
    render();
    requestAnimationFrame(animate);
}

function easing(t, b, c, d) {
    if ((t /= d/2) < 1)
        return c/2*t*t+b;
    return c/2*((t-=2)*t*t+2)+b;
}

animate();
setTimeout(start, 30);

```

### Core Architecture Module: `src/interface/desktop/main.js`
```
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, session } = require('electron');
const todesktop = require("@todesktop/runtime");
const khojPackage = require('./package.json');

todesktop.init();

const fs = require('fs');
const {dialog} = require('electron');

const cron = require('cron').CronJob;
const axios = require('axios');

const KHOJ_URL = 'https://app.khoj.dev';

const Store = require('electron-store');

const textFileTypes = [
    // Default valid file extensions supported by Khoj
    'org', 'md', 'markdown', 'txt', 'html', 'xml',
    // Other valid text file extensions from https://google.github.io/magika/model/config.json
    'appleplist', 'asm', 'asp', 'batch', 'c', 'cs', 'css', 'csv', 'eml', 'go', 'html', 'ini', 'internetshortcut', 'java', 'javascript', 'json', 'latex', 'lisp', 'makefile', 'markdown', 'mht', 'mum', 'pem', 'perl', 'php', 'powershell', 'python', 'rdf', 'rst', 'rtf', 'ruby', 'rust', 'scala', 'shell', 'smali', 'sql', 'svg', 'symlinktext', 'txt', 'vba', 'winregistry', 'xml', 'yaml']
const binaryFileTypes = ['pdf', 'jpg', 'jpeg', 'png', 'webp']
const validFileTypes = textFileTypes.concat(binaryFileTypes);

const schema = {
    files: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                path: {
                    type: 'string'
                }
            }
        },
        default: []
    },
    folders: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                path: {
                    type: 'string'
                }
            }
        },
        default: []
    },
    khojToken: {
        type: 'string',
        default: ''
    },
    hostURL: {
        type: 'string',
        default: KHOJ_URL
    },
    lastSync: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                path: {
                    type: 'string'
                },
                datetime: {
                    type: 'string'
                }
            }
        }
    }
};

let syncing = false;
let state = {}
const store = new Store({ schema });

console.log(store);

// include the Node.js 'path' module at the top of your file
const path = require('path');

function handleSetTitle (event, title) {
    const webContents = event.sender
    const win = BrowserWindow.fromWebContents(webContents)
    win.setTitle(title)
    dialog.showOpenDialog({properties: ['openFile', 'openDirectory'] }).then(function (response) {
        if (!response.canceled) {
            // handle fully qualified file name
          console.log(response.filePaths[0]);
        } else {
          console.log("no file selected");
        }
    });
}

function filenameToMimeType (filename) {
    const extension = filename.split('.').pop();
    switch (extension) {
        case 'pdf':
            return 'application/pdf';
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'webp':
            return 'image/webp';
        case 'md':
        case 'markdown':
            return 'text/markdown';
        case 'org':
            return 'text/org';
        default:
            console.warn(`Unknown file type: ${extension}. Defaulting to text/plain.`);
            return 'text/plain';
    }
}

function isSupportedFileType(filePath) {
    const fileExtension = filePath.split('.').pop().toLowerCase();
    return validFileTypes.includes(fileExtension);
}

function processDirectory(filesToPush, folder) {
    try {
        const files = fs.readdirSync(folder.path, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(file.path, file.name || '');
            // Skip hidden files and folders
            if (file.name.startsWith('.')) {
                continue;
            }
            // Add supported files to index
            if (file.isFile() && isSupportedFileType(filePath)) {
                console.log(`Add ${file.name} in ${file.path} for indexing`);
                filesToPush.push(filePath);
            }
            // Recursively process subdirectories
            if (file.isDirectory()) {
                processDirectory(filesToPush, {'path': filePath});
            }
        }
    } catch (err) {
        if (err.code === 'EACCES') {
            console.error(`Access denied to ${folder.path}`);
        } else if (err.code === 'ENOENT') {
            console.error(`${folder.path} does not exist`);
        } else {
            console.error(`An error occurred while reading directory: ${error.message}`);
        }
        return;
    }

}

function pushDataToKhoj (regenerate = false) {
    // Don't sync if token or hostURL is not set or if already syncing
    if (store.get('khojToken') === '' || store.get('hostURL') === '' || syncing === true) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) win.webContents.send('update-state', state);
        return;
    } else {
        syncing = true;
    }

    let filesToPush = [];
    const files = store.get('files') || [];
    const folders = store.get('folders') || [];
    state = { completed: true }

    // Collect paths of all configured files to index
    for (const file of files) {
        // Remove files that no longer exist
        if (!fs.existsSync(file.path)) {
            console.error(`${file.path} does not exist`);
            continue;
        }
        filesToPush.push(file.path);
    }

    // Collect paths of all indexable files in configured folders
    for (const folder of folders) {
        // Remove folders that no longer exist
        if (!fs.existsSync(folder.path)) {
            console.error(`${folder.path} does not exist`);
            continue;
        }
        processDirectory(filesToPush, folder);
    }

    const lastSync = store.get('lastSync') || [];
    const filesDataToPush = [];
    for (const file of filesToPush) {
        const stats = fs.statSync(file);
        if (!regenerate) {
            // Only push files that have been modified since last sync
            if (stats.mtime.toISOString() < lastSync.find((syncedFile) => syncedFile.path === file)?.datetime) {
                continue;
            }
        }

        // Collect all updated or newly created files since last sync to index on Khoj server
        try {
            let encoding = binaryFileTypes.includes(file.split('.').pop()) ? "binary" : "utf8";
            let mimeType = filenameToMimeType(file) + (encoding === "utf8" ? "; charset=UTF-8" : "");
            let fileContent = Buffer.from(fs.readFileSync(file, { encoding: encoding }), encoding);
            let fileObj = new Blob([fileContent], { type: mimeType });
            filesDataToPush.push({blob: fileObj, path: file});
            state[file] = {
                success: true,
            }
        } catch (err) {
            console.error(err);
            state[file] = {
                success: false,
                error: err
            }
        }
    }

    // Mark deleted files for removal from index on Khoj server
    for (const syncedFile of lastSync) {
        if (!filesToPush.includes(syncedFile.path)) {
            fileObj = new Blob([""], { type: filenameToMimeType(syncedFile.path) });
            filesDataToPush.push({blob: fileObj, path: syncedFile.path});
        }
    }

    // Send collected files to Khoj server for indexing
    const hostURL = store.get('hostURL') || KHOJ_URL;
    const headers = { 'Authorization': `Bearer ${store.get("khojToken")}` };
    let requests = [];

    // Request indexing files on server. With upto 1000 files in each request
    for (let i = 0; i < filesDataToPush.length; i += 1000) {
        const syncUrl = `${hostURL}/api/content?client=desktop`;
        const filesDataGroup = filesDataToPush.slice(i, i + 1000);
        const formData = new FormData();
        filesDataGroup.forEach(fileDa
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1431** (2026-09-28): **Community guide: Khoj + HAL SUPREME as custom OpenAI-compatible endpoint**
  *Symptoms*: ﻿Hi Khoj folks,  I'm Jakob (UniteAndCreateForLife). Soft community note from a fellow self-host companion.  HAL SUPREME is a free/community AI companion with OpenAI-compat peer gateway (`https://api.halsupreme.com/v1`) + MCP. Khoj users already point at local/remote LLMs — a clean "use HAL as a custom OpenAI-compatible endpoint" recipe could help both communities.  Happy to draft a short guide (placeholders only) if welcome.  - Site: https://halsupreme.com - Agent card: https://halsupreme.com/.well-known/agent-card.json - Discord: https://discord.gg/GnufdBbyg - Community: https://github.com/UniteAndCreateForLife/hal-supreme-community  Thanks for Khoj.  - Jakob / UniteAndCreateForLife 
  **Post-Mortem & Fix Analysis**:
  > Closing this: it was a promotional note rather than an issue for khoj, and I shouldn't have opened it here. Sorry for the noise, and thanks for maintaining khoj.

- **Issue #1422** (2026-09-08): **[First-time contributor] Looking for beginner-friendly issues to contribute**
  *Symptoms*: Hi maintainers! 👋  I'm a CS student and first-time open source contributor excited about khoj and AI-powered personal knowledge management. I've been following the project and would love to contribute back.  **My background:** - Python (type hints, async, pytest) - Basic experience with LLM integrations and RAG pipelines - Eager to learn and follow your contribution guidelines  **What I'm looking for:** - Good first issues or beginner-friendly tasks (bug fixes, tests, docs, small features) - Guidance on where to start if you have any suggestions  I've read the contributing guidelines and I'm happy to start small. Could you point me to any issues that would be suitable for a first-time contributor?  Thanks for your time and for building this awesome project! 🚀
  **Post-Mortem & Fix Analysis**:
  > Closing this issue as I've decided to focus on other contribution opportunities. Thank you for your time and for building this great project! ??

- **Issue #1402** (2026-09-15): **[Proposal] Memory for Khoj agents — 97.5% fewer tokens (ViBo)**
  *Symptoms*: Hi Khoj team,  Your project khoj-ai/khoj is impressive — 36478 stars says it all. One thing I noticed: agents built on it forget everything between sessions, and sending ALL memory to the model on every request costs a fortune.  **ViBo** solves this — memory for AI agents: - 🧠 Encrypted L1/L2/L3: secrets (API keys) NEVER reach the LLM - 🌐 Web search savings: articles compressed 47,443 → 186 tokens (99.6%) - 💬 Thread memory: conversations -72%, details restored on demand - Measured: 118 facts → 263 tokens instead of 13,775 (97.5% fewer)  Integrates via Python API or MCP (any agent, any framework). Works with your stack in minutes.  Model: $5/month, 2-day free trial (key built-in). Site: https://wwwvibo.com · Docs: https://github.com/vnbochkarev-netizen/ViBo-memory  Happy to discuss integration or partnership (30% recurring for referrals). Honest limits: code gen doesn't save — we say so openly.  Best, ViBo team 
  **Post-Mortem & Fix Analysis**:
  > Sorry for the noise here — this was part of an outreach batch and doesn't belong in this tracker. Closing it on our side. If a real integration proposal would ever be useful, we'll come back with a concrete interface and ownership, not a pitch.

- **Issue #1390** (2026-09-08): **feat: Add search support for Notion databases**
  *Symptoms*: ## Overview This PR resolves the `TODO: Handle databases` placeholder explicitly mentioned in `notion_to_entries.py` by introducing full support for parsing and indexing Notion databases.   Previously, this placeholder logic caused Khoj to silently skip databases entirely during a Notion sync, leaving structured data such as task boards, reading lists, and CRM tables unsearchable. This update fixes that by recursively querying database rows and extracting their structured properties alongside their nested page content.  ## Technical Changes  - Database Querying: Added process_database() to handle paginated querying of database rows via the POST /v1/databases/{id}/query endpoint.  - Property Extraction: Implemented extract_property_value() to properly parse various Notion property types, including nested formula results, while explicitly handling falsy values like zero and false.  - Structured Formatting: Updated process_page() to capture and format page properties into human-readable, searchable text blocks.  - Unit Testing: Added tests/test_notion_to_entries.py using mocked Notion API responses to validate row extraction and database parsing without requiring live network calls.  ## How to Test  - Run the unit tests using uv run pytest tests/test_notion_to_entries.py -v to ensure they pass successfully.  - Connect a Notion database to a local instance of Khoj and trigger a synchronization.  - Check the application logs to confirm that the database rows a

- **Issue #1384** (2026-08-07): **Add GreenPT as an OpenAI-compatible model provider**
  *Symptoms*: ## What and why  I'd like to add a focused GreenPT integration to Khoj.  GreenPT is a European AI provider with an OpenAI-compatible API, optimized infrastructure, and data centers powered by 100% renewable energy. Its API base URL is `https://api.greenpt.ai/v1`.  Khoj already has most of the required plumbing: custom OpenAI-compatible base URLs, live model discovery through `/v1/models`, and OpenAI-compatible embedding endpoints. Today, however, initialization labels every non-Ollama custom endpoint as “OpenAI”, and there is no GreenPT-specific setup guidance.  ## Proposed scope  - Recognize the official GreenPT API base URL and label the provider “GreenPT”. - Keep Khoj's existing live `/v1/models` discovery instead of maintaining a static model list. - Add a self-hosting guide using `OPENAI_BASE_URL=https://api.greenpt.ai/v1` and `OPENAI_API_KEY`. - Feature the current flagship chat models `glm-5.2` and `kimi-k2.7-code`. - Document `green-embedding` through Khoj's existing OpenAI-compatible Search Model configuration. - Add focused tests for provider detection and configuration.  This should require no new SDK and no new request adapter.  ## Out of scope  GreenPT reranking and speech-to-text use endpoint contracts that do not match Khoj's current remote reranker and OpenAI Whisper paths, so I would leave those out rather than add unrelated abstractions.  Would this focused scope be acceptable for a PR? I'm happy to implement it and adjust the design based on maintainer guid
  **Post-Mortem & Fix Analysis**:
  > @debanjum, you reviewed the recent MiniMax model integration, so I'd appreciate your view on whether this focused scope fits Khoj before I open the PR.
  > Hey @robertkeus, we aren't adding custom logic for every ai model provider. Folks should be able to use GreenPT as long as it works as an openai compatible API. An admin can name providers they add however they want, users only see model names, not providers and OpenAI is just the type of provider the model is served over.
  > What do you mean? Or API is fully OpenAI compatible. We also have been approve by models.dev and OpenCode.

- **Issue #1382** (2026-08-02): **Stop sending client IP in telemetry so it matches the privacy docs**
  *Symptoms*: Closes #1374. Taking this up per @debanjum's offer on the issue — thanks for confirming it.  ## What  Removes one line from `update_telemetry_state` in `src/khoj/routers/helpers.py`: the `client_host` property, which was set to `request.client.host` — the caller's IP address.  ## Why  The documentation says the opposite of what the code did:  - `documentation/docs/get-started/privacy-security.md:15` — *"We do not log your IP address, nor upload any of your personal data to PostHog."* - `documentation/docs/miscellaneous/telemetry.md` lists what is collected: client, API usage, configured content types, and *"Request metadata (e.g., host, referrer)"* — no client IP.  @debanjum confirmed on the issue that the IP is already dropped at the PostHog layer and that it shouldn't be sent in the first place:  > *"we do drop client I.P at posthog layer, so not sure why client host was still being passed. We should stop passing client host as telemetry so it agrees with the docs for sure."*  This removes it at the source, so the payload matches the promise regardless of what any downstream layer does.  ## Scope, and why it's safe  I checked every reference before cutting it rather than assuming:  - `client_host` occurs **exactly once** in the entire repository — the line removed here. `grep -rn client_host .` now returns zero hits. - Nothing reads it back. `log_telemetry` in `src/khoj/utils/helpers.py` merges `properties` into the request body verbatim (`request_body.update(properties or 

- **Issue #1379** (2026-08-02): **feat: add Tenki Cloud code sandbox provider**
  *Symptoms*: ## What & why  khoj's run-code tool executes LLM-generated Python in a sandbox — currently **Terrarium** (local Docker, no network) or **E2B** (managed, network). This adds **[Tenki Cloud](https://tenki.cloud)** as a third option: a managed sandbox of disposable Linux microVMs with network access.  ## What it does  - New `execute_tenki(code, input_files)` in `src/khoj/processor/tools/run_code.py`, selected in `execute_sandboxed_python` (precedence: E2B → Tenki → Terrarium, so existing setups are unchanged). Mirrors the E2B/Terrarium contract: create sandbox → upload input files → run the code → return `std_out`/`std_err` and any new `output_files`. - Enabled by `TENKI_API_KEY` (`is_tenki_code_sandbox_enabled()`); a Tenki-specific code-gen prompt context + tool description advertise exactly the packages installed. Optional `KHOJ_TENKI_IMAGE` / `KHOJ_TENKI_WORKSPACE_ID` / `KHOJ_TENKI_PROJECT_ID`. - `tenki-sandbox` added as a core dependency (declared like E2B); docs in `code_execution.md` + `docker-compose.yml`; mocked + live tests.  ## Feature scope  Uses stable Tenki primitives only — ephemeral `exec` + file I/O. The stock image ships `python3`; the common data packages (`requests`/`matplotlib`/`pandas`/`numpy`/`scipy`) are installed on start (or point `KHOJ_TENKI_IMAGE` at a prebaked image with them baked in).  ## Dependency note  `tenki-sandbox` requires `protobuf>=6.31`, so the lock moves to **protobuf 7** and **e2b 1.11.x** (and adds `grpcio` / `websocket-client`). Flaggi
  **Post-Mortem & Fix Analysis**:
  > Thanks but we're not adding new code sandbox providers at this point. 

- **Issue #1376** (2026-08-02): **Drop client IP (client_host) from usage telemetry payload**
  *Symptoms*: ## Summary  The self-hosted Khoj server builds its usage-telemetry payload with the requesting client's IP address under the `client_host` key in `update_telemetry_state` (`src/khoj/routers/helpers.py`), and uploads it verbatim to the telemetry endpoint. This contradicts the privacy documentation (`documentation/docs/get-started/privacy-security.md`), which states:  > **We do not log your IP address**, nor upload any of your personal data to PostHog.  As reported in #1374, `request.client.host` is the client IP, and it was present in the payload the open-source server uploads. A privacy-conscious self-hoster reading that guarantee would not expect the IP to leave their machine.  Per the maintainer's confirmation on the issue ("we do drop client I.P at posthog layer ... We should stop passing client host as telemetry so it agrees with the docs"), this removes the field at the source rather than adding a surrogate.  ## Changes  - Remove the `client_host` entry from the `user_state` dict in   `update_telemetry_state`. This was the sole producer of the field; it   flowed unchanged through `log_telemetry` into the uploaded `request_body`.  No other behaviour changes. The field had no in-repo consumer (it was write-only into the uploaded payload), and `update_telemetry_state`'s signature is unchanged, so none of its call sites are affected.  ## Test plan  - `ruff check src/khoj/routers/helpers.py` — passes. - `ruff format --check src/khoj/routers/helpers.py` — already formatted. - 
  **Post-Mortem & Fix Analysis**:
  > Thanks @debanjum for confirming the direction on #1374. This draft implements the minimal change you described — dropping `client_host` from the telemetry payload in `update_telemetry_state` so the uploaded data matches the "we do not log your IP address" guarantee. It's a single-line removal; the field had no in-repo consumer.  A couple of notes: - @kobihikri kindly offered to open a PR too — happy to close this if you'd prefer their submission; I put this up in case it's useful to have a ready diff. - I couldn't run the full pytest suite locally (it needs a Postgres-backed Django setup plus the torch/transformers deps), so I didn't add a regression test. Glad to add one asserting the payload no longer includes the client IP if you'd like it before merge.  I've left it in draft — let me know if you'd like me to mark it ready for review.
  > Hi @gaurav0107, thanks for the draft PR. @kobihikri created a PR for this. I've merged it, so closing this too

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

### Incident Patch 1: `ae229ca8` (2026-08-02)
**Commit Message**: Make chat export robust and fix export truncation (#1314)

Exporting chats produced an incomplete conversations.json that missed
recent conversations and repeated others.

The export endpoint paginates by explicit offset and limit rather than a
page index that slid the query window by a single row per request. The
queryset orders by created_at, id, which keeps pagination stable across
the multi-request export even when conversations are written to while it
runs. Both parameters are bounded (offset >= 0, 1 <= limit <= 100), so out
of range values are rejected at the API boundary instead of raising on the
queryset slice or pulling every conversation log into memory at once.

The web client walks the endpoint until a page shorter than the batch size
comes back, which marks the end of the data more reliably than a
conversation count read once before the loop starts. The loop is bounded
by a max offset derived from that count, checks each response before
using it, and reports progress from the number of conversations actually
exported.

Tests cover pagination across pages, ordering stability when a
conversation is updated mid-export, and rejection of out of range
pagination parameters.


**File**: `src/interface/web/app/settings/page.tsx` (modified, +22/-5)
```diff
@@ -95,6 +95,10 @@ import { Progress } from "@/components/ui/progress";
 import JSZip from "jszip";
 import { saveAs } from "file-saver";
 
+// Number of conversations to fetch per request when exporting chats.
+// Keep in sync with the max limit accepted by the /api/chat/export endpoint.
+const EXPORT_BATCH_SIZE = 10;
+
 interface DropdownComponentProps {
     items: ModelOptions[];
     selected: number;
@@ -562,6 +566,7 @@ export default function SettingsView() {
 
             // Get total conversation count
             const statsResponse = await fetch("/api/chat/stats");
+            if (!statsResponse.ok) throw new Error("Failed to fetch conversation count");
             const stats = await statsResponse.json();
             const total = stats.num_conversations;
             setTotalConversations(total);
@@ -570,14 +575,26 @@ export default function SettingsView() {
             const zip = new JSZip();
             const conversations = [];
 
-            // Fetch all conversations in batches of 10
-            for (let page = 0; page * 10 < total; page++) {
-                const response = await fetch(`/api/chat/export?page=${page}`);
+            // Fetch all conversations in batches, stopping on a page shorter than the batch size.
+            // A short page means the server ran out of rows, so it marks the end of the export
+            // more reliably than the total count, which goes stale if conversations are added
+            // while the export runs. The max offset keeps the loop bounded even if the server
+            // were to keep returning full pages, with slack for conversations added mid-export.
+            const maxOffset = total + 2 * EXPORT_BATCH_SIZE;
+            for (let offset = 0; offset <= maxOffset; offset += EXPORT_BATCH_SIZE) {
+                const response = await fetch(
+                    `/api/chat/export?offset=${offset}&limit=${EXPORT_BATCH_SIZE}`,
+                );
+                if (!response.ok) throw new Error("Failed to fetch conversations to export");
                 const data = await response.json();
                 conversations.push(...data);
 
-                setExportedConversations((page + 1) * 10);
-                setExportProgress((((page + 1) * 10) / total) * 100);
+                setExportedConversations(conversations.length);
+                setExportProgress(
+                    total > 0 ? Math.min((conversations.length / total) * 100, 100) : 100,
+                );
+
+                if (data.length < EXPORT_BATCH_SIZE) break;
             }
 
             // Add conversations to zip
```

**File**: `src/khoj/database/adapters/__init__.py` (modified, +8/-2)
```diff
@@ -1026,8 +1026,14 @@ def get_conversation_by_user(
 
     @staticmethod
     @require_valid_user
-    def get_all_conversations_for_export(user: KhojUser, page: Optional[int] = 0):
-        all_conversations = Conversation.objects.filter(user=user).prefetch_related("agent")[page : page + 10]
+    def get_all_conversations_for_export(user: KhojUser, offset: int = 0, limit: int = 10):
+        # Order by immutable fields to keep pagination stable across the multi-request export.
+        # Sorting by updated_at would reshuffle rows mid-export whenever a conversation is written to.
+        all_conversations = (
+            Conversation.objects.filter(user=user)
+            .prefetch_related("agent")
+            .order_by("-created_at", "id")[offset : offset + limit]
+        )
         histories = []
         for conversation in all_conversations:
             history = {
```

**File**: `src/khoj/routers/api_chat.py` (modified, +10/-2)
```diff
@@ -14,6 +14,7 @@
     APIRouter,
     Depends,
     HTTPException,
+    Query,
     Request,
     WebSocket,
     WebSocketDisconnect,
@@ -116,8 +117,15 @@ def chat_stats(request: Request, common: CommonQueryParams) -> Response:
 
 @api_chat.get("/export", response_class=Response)
 @requires(["authenticated"])
-def export_conversation(request: Request, common: CommonQueryParams, page: Optional[int] = 1) -> Response:
-    all_conversations = ConversationAdapters.get_all_conversations_for_export(request.user.object, page=page)
+def export_conversation(
+    request: Request,
+    common: CommonQueryParams,
+    offset: int = Query(0, ge=0),
+    limit: int = Query(10, ge=1, le=100),
+) -> Response:
+    all_conversations = ConversationAdapters.get_all_conversations_for_export(
+        request.user.object, offset=offset, limit=limit
+    )
     return Response(content=json.dumps(all_conversations), media_type="application/json", status_code=200)
 
 
```

**File**: `tests/test_conversation_export.py` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import json
+
+import pytest
+
+from khoj.database.adapters import ConversationAdapters
+from khoj.database.models import Conversation
+
+EXPORT_BATCH_SIZE = 10
+
+
+def export_all_conversations(user, limit=EXPORT_BATCH_SIZE):
+    """Walk the export adapter the way the web client's export loop does.
+
+    Pages until a page shorter than the requested limit comes back, bounded by a max
+    offset so a regression that keeps returning full pages fails instead of hanging.
+    """
+    exported = []
+    max_offset = Conversation.objects.filter(user=user).count() + 2 * limit
+    offset = 0
+    while offset <= max_offset:
+        page = ConversationAdapters.get_all_conversations_for_export(user, offset=offset, limit=limit)
+        exported.extend(page)
+        if len(page) < limit:
+            break
+        offset += limit
+    return exported
+
+
+# ----------------------------------------------------------------------------------------------------
+@pytest.mark.django_db(transaction=True)
+def test_export_conversations_across_pages(default_user):
+    # Arrange
+    for index in range(25):
+        Conversation.objects.create(user=default_user, title=f"conv-{index:02d}")
+
+    # Act
+    titles = [conversation["title"] for conversation in export_all_conversations(default_user)]
+
+    # Assert
+    assert len(titles) == 25, f"Expected 25 conversations, exported {len(titles)}"
+    assert len(set(titles)) == 25, "Export contains duplicate conversations"
+    assert set(titles) == {f"conv-{index:02d}" for index in range(25)}
+
+
+# ----------------------------------------------------------------------------------------------------
+@pytest.mark.django_db(transaction=True)
+def test_export_order_unaffected_by_conversation_update(default_user):
+    """Conversations written to mid-export must not shift rows across page boundaries."""
+    # Arrange
+    for index in range(25):
+        Conversation.objects.create(user=default_user, title=f"conv-{index:02d}")
+    before = [conversation["title"] for conversation in export_all_conversations(default_user)]
+
+    # Act: touch a conversation to bump its auto_now updated_at, as a concurrent write would
+    stale_conversation = Conversation.objects.filter(user=default_user, title="conv-00").first()
+    stale_conversation.save()
+    after = [conversation["title"] for conversation in export_all_conversations(default_user)]
+
+    # Assert
+    assert before == after, "Export order shifted after a conversation was updated"
+    assert len(set(after)) == 25, "Export contains duplicate conversations after an update"
+
+
+# ----------------------------------------------------------------------------------------------------
+@pytest.mark.django_db(transaction=True)
+def test_export_endpoint_paginates_with_offset_and_limit(client, default_user):
+    # Arrange
+    headers = {"Authorization": "Bearer kk-secret"}
+    for index in range(15):
+        Conversation.objects.create(user=default_user, title=f"conv-{index:02d}")
+
+    # Act
+    first = client.get("/api/chat/export?offset=0&limit=10", headers=headers)
+    second = client.get("/api/chat/export?offset=10&limit=10", headers=headers)
+
+    # Assert
+    assert first.status_code == 200 and second.status_code == 200
+    first_titles = [conversation["title"] for conversation in json.loads(first.content)]
+    second_titles = [conversation["title"] for conversation in json.loads(second.content)]
+    assert len(first_titles) == 10 and len(second_titles) == 5
+    assert not set(first_titles) & set(second_titles), "Export endpoint returned overlapping pages"
+
+
+# ----------------------------------------------------------------------------------------------------
+@pytest.mark.django_db(transaction=True)
+def test_export_endpoint_rejects_out_of_range_pagination(client):
+    # Arrange
+    headers = {"Authorization": "Bearer kk-secret"}
+
+    # Act, Assert: negative offsets and limits would raise on the query
```

---

### Incident Patch 2: `f285132f` (2026-06-24)
**Commit Message**: Fix contributor guide typos (#1319)

## Fixes a few small typos in the contributor development guide.

This updates “corner-store” to “cornerstone”, fixes “wil” to “will”, and
makes the PR guidance sentence grammatical. No behavior changes.

**File**: `documentation/docs/contributing/development.mdx` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@ sidebar_position: 0
 
 # Development
 
-Welcome to the development docs of Khoj! Thanks for your interest in being a contributor ❤️. Open source contributors are a corner-store of the Khoj community. We welcome all contributions, big or small.
+Welcome to the development docs of Khoj! Thanks for your interest in being a contributor ❤️. Open source contributors are a cornerstone of the Khoj community. We welcome all contributions, big or small.
 
 To get started with contributing, check out the official GitHub docs on [contributing to an open-source project](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project).
 
@@ -203,10 +203,10 @@ In whichever clients you're using for testing, you'll need to update the server
 ### Before Creating PR
 
 :::tip[Note]
-You should be in an active virtual environment for Khoj in order to run the unit tests and linter. The `dev_setup.sh` script wil automatically create and activate it for you.
+You should be in an active virtual environment for Khoj in order to run the unit tests and linter. The `dev_setup.sh` script will automatically create and activate it for you.
 :::
 
-1. Ensure that you have a [Github Issue](https://github.com/khoj-ai/khoj/issues) that can be linked to the PR. If not, create one. Make sure you've tagged one of the maintainers to the issue. This will ensure that the maintainers are notified of the PR and can review it. It's best discuss the code design on an existing issue or Discord thread before creating a PR. This helps get your PR merged faster.
+1. Ensure that you have a [Github Issue](https://github.com/khoj-ai/khoj/issues) that can be linked to the PR. If not, create one. Make sure you've tagged one of the maintainers to the issue. This will ensure that the maintainers are notified of the PR and can review it. It's best to discuss the code design on an existing issue or Discord thread before creating a PR. This helps get your PR merged faster.
 1. Run unit tests.
    ```shell
    pytest
```

---

### Incident Patch 3: `fdd5fd8f` (2026-03-26)
**Commit Message**: Fix getting billing config to show deprecation banner on Khoj cloud

**File**: `src/interface/web/app/components/deprecationBanner.tsx` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@ const DISMISS_KEY = "khoj-cloud-deprecation-dismissed";
 
 export function DeprecationBanner() {
     const [isDismissed, setIsDismissed] = useState(true);
-    const { data: userConfig } = useUserConfig();
+    const { data: userConfig } = useUserConfig(true);
 
     useEffect(() => {
         setIsDismissed(localStorage.getItem(DISMISS_KEY) === "true");
```

---

### Incident Patch 4: `8b8504ed` (2026-03-26)
**Commit Message**: Fix AttributeError when memories disabled and setting is None (#1296)

## Summary
- Add null checks for `config.setting` in `get_chat_model()` and
`aget_chat_model()` to prevent `AttributeError` when memories are
disabled
- When the memory toggle creates a `UserConversationConfig` via
`get_or_create` with `setting=None`, accessing
`config.setting.price_tier` crashes — now falls through to the default
chat model instead

## Root Cause
The "Enable Memories" toggle PATCH endpoint uses `get_or_create` on
`UserConversationConfig`, which can create a config with `setting=None`.
Both `get_chat_model()` and `aget_chat_model()` then crash:
- For subscribed users: `if config:` passes but `return config.setting`
returns `None`, causing downstream crashes
- For non-subscribed users: `config.setting.price_tier` raises
`AttributeError` on `None`

## Fix
Change `if config:` → `if config and config.setting:` (subscribed path)
and add `and config.setting` guard before `.price_tier` access
(non-subscribed path), in both sync and async variants.

## Test plan
- [ ] Toggle memories off with no prior chat model configured — settings
page should still load
- [ ] Chat responses should use default model w

**File**: `src/khoj/database/adapters/__init__.py` (modified, +4/-4)
```diff
@@ -1192,13 +1192,13 @@ def get_chat_model(user: KhojUser):
         config = UserConversationConfig.objects.filter(user=user).first()
         if subscribed:
             # Subscibed users can use any available chat model
-            if config:
+            if config and config.setting:
                 return config.setting
             # Fallback to the default advanced chat model
             return ConversationAdapters.get_advanced_chat_model(user)
         else:
             # Non-subscribed users can use any free chat model
-            if config and config.setting.price_tier == PriceTier.FREE:
+            if config and config.setting and config.setting.price_tier == PriceTier.FREE:
                 return config.setting
             # Fallback to the default chat model
             return ConversationAdapters.get_default_chat_model(user)
@@ -1213,13 +1213,13 @@ async def aget_chat_model(user: KhojUser):
         )
         if subscribed:
             # Subscibed users can use any available chat model
-            if config:
+            if config and config.setting:
                 return config.setting
             # Fallback to the default advanced chat model
             return await ConversationAdapters.aget_advanced_chat_model(user)
         else:
             # Non-subscribed users can use any free chat model
-            if config and config.setting.price_tier == PriceTier.FREE:
+            if config and config.setting and config.setting.price_tier == PriceTier.FREE:
                 return config.setting
             # Fallback to the default chat model
             return await ConversationAdapters.aget_default_chat_model(user)
```

---

### Incident Patch 5: `a19e7acd` (2026-03-25)
**Commit Message**: Fix TemplateResponse calls to be compatible with Starlette 1.0.0

Starlette 1.0.0 removed the deprecated TemplateResponse signature
where `name` was the first positional arg and `request` was passed
inside `context`. The new signature requires `request` as the first
positional argument: TemplateResponse(request, name=...).

This caused a 500 error in production on web client endpoints with:
"Jinja2Templates.TemplateResponse() missing 1 required positional
argument: 'name'" (with older Starlette) or "'request'" (with 1.0.0).

Update all TemplateResponse calls in web_client.py to use the new
Starlette 1.0.0 signature: pass `request` as the first positional
arg and `name` as an explicit keyword argument.

Issue didn't trigger locally as uv is used locally and pip in docker
builds. These resolve dependencies including starletter version to
install differently. Locally 0.52.0 was installed while on production
starlette 1.0.0 was used. This is what caused the issue and the
mismatch in expectation

**File**: `src/khoj/routers/web_client.py` (modified, +11/-36)
```diff
@@ -25,13 +25,13 @@ def index(request: Request):
     if not state.anonymous_mode and not request.user.is_authenticated:
         if "v" not in request.query_params:
             return RedirectResponse(url="/home")
-    return templates.TemplateResponse("index.html", context={"request": request})
+    return templates.TemplateResponse(request, name="index.html")
 
 
 @web_client.post("/", response_class=FileResponse)
 @requires(["authenticated"], redirect="login_page")
 def index_post(request: Request):
-    return templates.TemplateResponse("index.html", context={"request": request})
+    return templates.TemplateResponse(request, name="index.html")
 
 
 @web_client.get("/home", response_class=HTMLResponse)
@@ -40,7 +40,7 @@ def home_page(request: Request):
     # If user is authenticated, redirect to main app
     if request.user.is_authenticated:
         return RedirectResponse(url="/")
-    return home_templates.TemplateResponse("index.html", context={"request": request})
+    return home_templates.TemplateResponse(request, name="index.html")
 
 
 @web_client.get("/home/{file_path:path}", response_class=FileResponse)
@@ -55,23 +55,13 @@ def home_static_files(file_path: str):
 @web_client.get("/search", response_class=FileResponse)
 @requires(["authenticated"], redirect="login_page")
 def search_page(request: Request):
-    return templates.TemplateResponse(
-        "search/index.html",
-        context={
-            "request": request,
-        },
-    )
+    return templates.TemplateResponse(request, name="search/index.html")
 
 
 @web_client.get("/chat", response_class=FileResponse)
 @requires(["authenticated"], redirect="login_page")
 def chat_page(request: Request):
-    return templates.TemplateResponse(
-        "chat/index.html",
-        context={
-            "request": request,
-        },
-    )
+    return templates.TemplateResponse(request, name="chat/index.html")
 
 
 @web_client.get("/login", response_class=FileResponse)
@@ -87,18 +77,13 @@ def login_page(request: Request):
 
 @web_client.get("/agents", response_class=HTMLResponse)
 def agents_page(request: Request):
-    return templates.TemplateResponse(
-        "agents/index.html",
-        context={
-            "request": request,
-        },
-    )
+    return templates.TemplateResponse(request, name="agents/index.html")
 
 
 @web_client.get("/settings", response_class=HTMLResponse)
 @requires(["authenticated"], redirect="login_page")
 def config_page(request: Request):
-    return templates.TemplateResponse("settings/index.html", context={"request": request})
+    return templates.TemplateResponse(request, name="settings/index.html")
 
 
 @web_client.get("/settings/content/github", response_class=HTMLResponse)
@@ -128,29 +113,19 @@ def github_config_page(request: Request):
         current_config = {}  # type: ignore
 
     user_config["current_config"] = current_config
-    return templates.TemplateResponse("content_source_github_input.html", context=user_config)
+    return templates.TemplateResponse(request, name="content_source_github_input.html", context=user_config)
 
 
 @web_client.get("/share/chat/{public_conversation_slug}", response_class=HTMLResponse)
 def view_public_conversation(request: Request):
-    return templates.TemplateResponse(
-        "share/chat/index.html",
-        context={
-            "request": request,
-        },
-    )
+    return templates.TemplateResponse(request, name="share/chat/index.html")
 
 
 @web_client.get("/automations", response_class=HTMLResponse)
 def automations_config_page(
     request: Request,
 ):
-    return templates.TemplateResponse(
-        "automations/index.html",
-        context={
-            "request": request,
-        },
-    )
+    return templates.TemplateResponse(request, name="automations/index.html")
 
 
 @web_client.get("/.well-known/assetlinks.json", response_class=FileResponse)
@@ -160,4 +135,4 @@ def assetlinks(request: Request):
 
 @web_client.get("/server/error", respons
```

---

### Incident Patch 6: `0e169159` (2026-03-25)
**Commit Message**: Close leaked file handle in orgnode parser (#1284)

## Summary

`src/khoj/processor/content/org_mode/orgnode.py:57` opens a file with
`open(filename, "r")` but never closes it. The file handle leaks for the
lifetime of the returned `Orgnode` list.

## Fix

Replaced bare `open()` with a `with` statement to ensure the file is
closed after `makelist()` finishes reading.

```python
# Before
def makelist_with_filepath(filename):
    f = open(filename, "r")
    return makelist(f, filename)

# After
def makelist_with_filepath(filename):
    with open(filename, "r") as f:
        return makelist(f, filename)
```

This is safe because `makelist()` fully consumes the file during the
call (building the Orgnode list from file contents), so the file handle
is no longer needed after it returns.

**File**: `src/khoj/processor/content/org_mode/orgnode.py` (modified, +2/-2)
```diff
@@ -54,8 +54,8 @@ def normalize_filename(filename):
 
 
 def makelist_with_filepath(filename):
-    f = open(filename, "r")
-    return makelist(f, filename)
+    with open(filename, "r") as f:
+        return makelist(f, filename)
 
 
 def makelist(file, filename, start_line: int = 1, ancestry_lines: int = 0) -> List["Orgnode"]:
```

---

### Incident Patch 7: `530443a4` (2026-03-25)
**Commit Message**: Fix UnboundLocalError in PdfToEntries.extract_text when PDF processing fails (#1292)

When PyMuPDFLoader fails to process an invalid PDF file, the exception
is caught but pdf_entry_by_pages is referenced before assignment, 
causing an UnboundLocalError.

Initialized pdf_entry_by_pages to an empty list before the try block so 
the return statement always has a valid value, even when an exception
occurs.

Verified with both invalid input (returns []) and valid PDFs (returns
extracted text).

Fixes #1289

Co-authored-by: BillionClaw <267901332+BillionClaw@users.noreply.github.com>

**File**: `src/khoj/processor/content/pdf/pdf_to_entries.py` (modified, +1/-0)
```diff
@@ -94,6 +94,7 @@ def convert_pdf_entries_to_maps(parsed_entries: List[str], entry_to_file_map) ->
     @staticmethod
     def extract_text(pdf_file):
         """Extract text from specified PDF files"""
+        pdf_entry_by_pages = []
         try:
             # Create temp file with .pdf extension that gets auto-deleted
             with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as tmpf:
```

---

### Incident Patch 8: `e8631261` (2026-03-19)
**Commit Message**: fix: ChatModel.__str__ returns None when friendly_name is null (#1277)

## Problem
When `ChatModel.friendly_name` is `None`, the `__str__` method returns
`None`, causing:
```
TypeError: __str__ returned non-string (type NoneType)
```

## Solution
Fall back to `name` field when `friendly_name` is `None`.

Related issue: #1251

Co-authored-by: 阳虎 <yanghu@yanghudeMacBook-Pro.local>

**File**: `src/khoj/database/models/__init__.py` (modified, +1/-1)
```diff
@@ -236,7 +236,7 @@ class ModelType(models.TextChoices):
     strengths = models.TextField(default=None, null=True, blank=True)
 
     def __str__(self):
-        return self.friendly_name
+        return self.friendly_name or self.name
 
 
 class VoiceModelOption(DbBaseModel):
```

---

### Incident Patch 9: `678549c6` (2026-03-17)
**Commit Message**: Fix extract_from_webpage discarding pre-fetched content (#1269)

## Summary

In `extract_from_webpage()`, the `content` parameter is unconditionally
overwritten to `None` on the line before the `is_none_or_empty(content)`
check. This means any pre-fetched content (e.g. text content already
retrieved by the Exa search engine) is always discarded, forcing an
unnecessary re-scrape of the webpage.

## Bug

```python
async def extract_from_webpage(
    url: str,
    subqueries: set[str] = None,
    content: str = None,     # <-- caller passes pre-fetched content
    ...
) -> Tuple[set[str], str, Union[None, str]]:
    content = None            # <-- BUG: immediately overwrites it
    if is_none_or_empty(content):  # always True
        content = await scrape_webpage_with_fallback(url)
```

## Fix

Remove the `content = None` assignment so the passed-in content is used
when available, falling back to scraping only when needed.

This bug was introduced in a refactor and causes:
- Wasted API calls to web scrapers for pages whose content is already
available
- Increased latency for search results that include inline content (e.g.
Exa)

Signed-off-by: JiangNan <1394485448@qq.com>

**File**: `src/khoj/processor/tools/online_search.py` (modified, +0/-1)
```diff
@@ -556,7 +556,6 @@ async def extract_from_webpage(
     tracer: dict = {},
 ) -> Tuple[set[str], str, Union[None, str]]:
     # Read the web page
-    content = None
     if is_none_or_empty(content):
         content = await scrape_webpage_with_fallback(url)
 
```

---

### Incident Patch 10: `6735d33a` (2026-03-17)
**Commit Message**: Fix operator precedence in research iteration counter (#1271)

## Summary

Fix a Python operator precedence bug in the `research()` function that
causes `current_iteration` to be set to a boolean instead of the actual
count of previous iterations.

## Bug

```python
if current_iteration := len(previous_iterations) > 0:
```

Python evaluates this as:
```python
if current_iteration := (len(previous_iterations) > 0):  # assigns True or False
```

So `current_iteration` becomes `True` (1) or `False` (0) regardless of
how many previous iterations exist.

## Fix

```python
if (current_iteration := len(previous_iterations)) > 0:
```

With parentheses, `current_iteration` is correctly set to the count
(e.g. 4), and then compared to 0.

## Impact

When resuming research with previous iterations, the loop counter was
effectively reset to 1 instead of the true count. This allowed the
research loop to run significantly more iterations than `MAX_ITERATIONS`
intended, wasting compute and API calls.

Signed-off-by: JiangNan <1394485448@qq.com>

**File**: `src/khoj/routers/research.py` (modified, +1/-1)
```diff
@@ -503,7 +503,7 @@ async def research(
 
     # Incorporate previous partial research into current research chat history
     research_conversation_history = [chat for chat in deepcopy(conversation_history) if chat.message]
-    if current_iteration := len(previous_iterations) > 0:
+    if (current_iteration := len(previous_iterations)) > 0:
         logger.info(f"Continuing research with the previous {len(previous_iterations)} iteration results.")
         previous_iterations_history = construct_iteration_history(previous_iterations)
         research_conversation_history += previous_iterations_history
```

#### Recent Merged Pull Requests:
- **PR #1390** (closed): feat: Add search support for Notion databases (@SyncWithRaj)
- **PR #1382** (2026-08-02): Stop sending client IP in telemetry so it matches the privacy docs (@kobihikri)
- **PR #1379** (closed): feat: add Tenki Cloud code sandbox provider (@rishijoshi)
- **PR #1376** (closed): Drop client IP (client_host) from usage telemetry payload (@gaurav0107)
- **PR #1373** (closed): docs: add DaoXE OpenAI-compatible gateway guide (@seven7763)
- **PR #1371** (closed): Add MiniMax chat model defaults (@octo-patch)
- **PR #1366** (closed): Update README.md (@chirag127)
- **PR #1353** (closed): Rebrand Khoj → AlphaMind + Groq managed AI backend (@isharmamudit)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
