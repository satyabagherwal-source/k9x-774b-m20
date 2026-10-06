# Forensic Learning Record (Deep Inspection): khoj-ai/khoj

> **Canonical Artifact**: `07_PROJECT_LEARNING/khoj-ai-khoj-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/khoj-ai/khoj](https://github.com/khoj-ai/khoj))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:00.850Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `khoj-ai/khoj`
- **Description**: Your AI second brain. Self-hostable. Get answers from the web or your docs. Build custom agents, schedule automations, do deep research. Turn any online or local LLM into your personal, autonomous AI (gpt, claude, gemini, llama, qwen, mistral). Get started - free.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 37564 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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
        let imageMarkdown = generateImageMarkdown(message, intentType, inferredQueries);
        chatEl = renderMessage(imageMarkdown, by, dt, null, false, "return");
    } else if (intentType === "excalidraw") {
        let domain = hostURL ?? "https://app.khoj.dev/";

        if (!domain.endsWith("/")) domain += "/";

        let excalidrawMessage = `Hey, I'm not ready to show you diagrams yet here. But you can view it in the web app at ${domain}chat?conversationId=${conversationId}`;

        chatEl = renderMessage(excalidrawMessage, by, dt, null, false, "return");
    } else {
        chatEl = renderMessage(message, by, dt, null, false, "return");
    }

    // If no document or online context is provided, render the message as is
    if ((context == null || context?.length == 0)
        && (onlineContext == null || (onlineContext && Object.keys(onlineContext).length == 0))) {
        return chatEl;
    }

    // If document or online context is provided, render the message with its references
    let references = {};
    if (!!context) references["notes"] = context;
    if (!!onlineContext) references["online"] = onlineContext;
    let chatMessageEl = chatEl.getElementsByClassName("chat-message-text")[0];
    chatMessageEl.appendChild(createReferenceSection(references));

    return chatEl;
}

function generateImageMarkdown(message, intentType, inferredQueries=null) { //same
    let imageMarkdown;
    if (intentType === "text-to-image") {
        imageMarkdown = `![](data:image/png;base64,${message})`;
    } else if (intentType === "text-to-image2") {
        imageMarkdown = `![](${message})`;
    } else if (intentType === "text-to-image-v3") {
        imageMarkdown = `![](${message})`;
    }
    const inferredQuery = inferredQueries?.[0];
    if (inferredQuery) {
        imageMarkdown += `\n\n**Inferred Query**:\n\n${inferredQuery}`;
    }
    return imageMarkdown;
}

function formatHTMLMessage(message, raw=false, willReplace=true) { //same
    var md = window.markdown
```

### Core Architecture Module: `src/interface/desktop/renderer.js`
```
const setFolderButton = document.getElementById('update-folder');
const setFileButton = document.getElementById('update-file');
const loadingBar = document.getElementById('loading-bar');

async function removeFile(filePath) {
    const updatedFiles = await window.removeFileAPI.removeFile(filePath);

    let currentFilesElement = document.getElementById("current-files");
    currentFilesElement.innerHTML = '';
    for (const file of updatedFiles) {
        console.log(file);
        let fileElement = makeFileElement(file);
        currentFilesElement.appendChild(fileElement);
    }
}

async function removeFolder(folderPath) {
    const updatedFolders = await window.removeFolderAPI.removeFolder(folderPath);

    let currentFoldersElement = document.getElementById("current-folders");
    currentFoldersElement.innerHTML = '';
    for (const folder of updatedFolders) {
        console.log(folder);
        let folderElement = makeFolderElement(folder);
        currentFoldersElement.appendChild(folderElement);
    }
}

const currentFiles = document.getElementById('current-files');

const currentFolders = document.getElementById('current-folders');

function makeFileElement(file) {
    let fileElement = document.createElement("div");
    fileElement.classList.add("file-element");

    let fileNameElement = document.createElement("div");
    fileNameElement.classList.add("content-name");
    fileNameElement.innerHTML = file.path;
    fileNameElement.style.cursor = "pointer";

    fileNameElement.addEventListener("click", () => {
        window.openFileAPI.openFile(file.path);
    });

    fileElement.appendChild(fileNameElement);

    let buttonContainer = document.createElement("div");
    buttonContainer.classList.add("remove-button-container");
    let removeFileButton = document.createElement("button");
    let fileSyncedImage = document.createElement("img");
    fileSyncedImage.classList.add("file-synced-image");
    fileSyncedImage.src = "./assets/icons/file-synced.svg";

    // Create trash icon image
    let trashIcon = document.createElement("img");
    trashIcon.src = "./assets/icons/trash-solid.svg";
    trashIcon.classList.add("trash-icon");

    removeFileButton.classList.add("remove-file-button");
    removeFileButton.appendChild(trashIcon);
    removeFileButton.addEventListener("click", () => {
        removeFile(file.path);
    });

    buttonContainer.appendChild(removeFileButton);
    buttonContainer.insertAdjacentElement("afterbegin", fileSyncedImage);
    fileElement.appendChild(buttonContainer);
    return fileElement;
}

function makeFolderElement(folder) {
    let folderElement = document.createElement("div");
    folderElement.classList.add("folder-element");

    let folderNameElement = document.createElement("div");
    folderNameElement.classList.add("content-name");
    folderNameElement.innerHTML = folder.path;
    folderNameElement.style.cursor = "pointer";

    folderNameElement.addEventListener("click", () => {
        window.openFileAPI.openFile(folder.path);
    });

    folderElement.appendChild(folderNameElement);

    let buttonContainer = document.createElement("div");
    buttonContainer.classList.add("remove-button-container");
    let removeFolderButton = document.createElement("button");
    removeFolderButton.classList.add("remove-folder-button");

    // Create trash icon image
    let trashIcon = document.createElement("img");
    trashIcon.src = "./assets/icons/trash-solid.svg";
    trashIcon.classList.add("trash-icon");

    removeFolderButton.appendChild(trashIcon);

    removeFolderButton.addEventListener("click", () => {
        removeFolder(folder.path);
    });
    buttonContainer.appendChild(removeFolderButton);
    folderElement.appendChild(buttonContainer);
    return folderElement;
}

(async function () {
    const files = await window.getFilesAPI.getFiles();
    let currentFilesElement = document.getElementById("current-files");
    for (const file of files) {
        console.log(file);
        let fileElement = makeFileElement(file);
        currentFilesElement.appendChild(fileElement);
    }

    const folders = await window.getFoldersAPI.getFolders();
    let currentFoldersElement = document.getElementById("current-folders");
    for (const folder of folders) {
        let folderElement = makeFolderElement(folder);
        currentFoldersElement.appendChild(folderElement);
    }
})();

setFolderButton.addEventListener('click', async () => {
    await handleFileOpen('folder');
});

setFileButton.addEventListener('click', async () => {
    await handleFileOpen('file');
});

async function handleFileOpen(type) {
    const value = await window.storeValueAPI.handleFileOpen(type);
    console.log(value);
    let currentFilesElement = document.getElementById("current-files");
    let currentFoldersElement = document.getElementById("current-folders");

    if (value.files) {
        currentFilesElement.innerHTML = '';
        value.files.forEach((file) => {
            let fileElement = makeFileElement(file);
            currentFilesElement.appendChild(fileElement);
        });
    }

    if (value.folders) {
        currentFoldersElement.innerHTML = '';
        value.folders.forEach((folder) => {
            let folderElement = makeFolderElement(folder);
            currentFoldersElement.appendChild(folderElement);
        });
    }
}

window.updateStateAPI.onUpdateState((event, state) => {
    const fileSyncedImage = document.querySelectorAll(".file-synced-image");
    console.log("state was updated", state);
    loadingBar.style.display = 'none';
    let syncStatusElement = document.getElementById("sync-status");
    syncStatusElement.innerHTML = '';
    const currentTime = new Date();
    nextSyncTime = new Date();
    nextSyncTime.setMinutes(Math.ceil((nextSyncTime.getMinutes() + 1) / 10) * 10);
    if (state.completed == false) {

        fileSyncedImage.forEach((image) => {
            image.style.display = "block"
            image.src = "./assets/icons/file-not-synced.svg"
        })
        if (state.error) syncStatusElement.innerHTML = state.error;
        return;
    } else {
        fileSyncedImage.forEach((image) => {
            image.style.display = "block"
            image.src = "./assets/icons/file-synced.svg"
        })

    }
    const options = { hour: '2-digit', minute: '2-digit' };

    const clockElement = document.createElement("div");
    const clockIcon = document.createElement("img");
    clockIcon.src = "./assets/icons/clock.svg";
    clockIcon.classList.add("clock-icon");

    clockElement.appendChild(clockIcon);
    syncStatusElement.appendChild(clockElement);
    syncStatusElement.innerHTML += ` Synced at ${currentTime.toLocaleTimeString(undefined, options)}. Next sync at ${nextSyncTime.toLocaleTimeString(undefined, options)}.`;
});

window.needsSubscriptionAPI.onNeedsSubscription((event, needsSubscription) => {
    console.log("needs subscription", needsSubscription);
    if (needsSubscription) {
        window.alert("Looks like you're out of space to sync your files. Upgrade your plan to unlock more space here: https://app.khoj.dev/settings#subscription");
        needsSubscriptionElement.style.display = 'block';
    }
});

const urlInput = document.getElementById('khoj-host-url');
(async function () {
    const url = await window.hostURLAPI.getURL();
    urlInput.value = url;
})();

urlInput.addEventListener('blur', async () => {
    const urlInputValue = urlInput.value;

    // Check if it's a valid URL
    try {
        new URL(urlInputValue);
    } catch (e) {
        console.log(e);
        alert('Please enter a valid URL');
        return;
    }

    const url = await window.hostURLAPI.setURL(urlInput.value.trim());
    urlInput.value = url;
});

const khojKeyInput = document.getElementById('khoj-access-key');
(async function () {
    const token = await window.tokenAPI.getToken();
    khojKeyInput.value = token;
})();

khojKeyInput.addEventListener('blur', async () => {
    const token = await window.tokenAPI.setToken(khojKeyInput.value.trim());
    khojKeyInput.value = token;
});

const syncForceButton = document.getElementById('sync-force');
syncForceButton.addEventListener('click', async () => {
    loadingBar.style.display = 'block';
    await window.syncDataAPI.syncData(true);
});

const deleteAllButton = document.getElementById('delete-all');
deleteAllButton.addEventListener('click', async () => {
    loadingBar.style.display = 'block';
    await window.syncDataAPI.deleteAllFiles();
});

```

### Core Architecture Module: `src/interface/desktop/utils.js`
```
console.log(`%c %s`, "font-family:monospace", `
 __  __     __  __     ______       __        _____      __
/\\ \\/ /    /\\ \\_\\ \\   /\\  __ \\     /\\ \\      /\\  __ \\   /\\ \\
\\ \\  _"-.  \\ \\  __ \\  \\ \\ \\/\\ \\   _\\_\\ \\     \\ \\  __ \\  \\ \\ \\
 \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_____\\ /\\_____\\     \\ \\_\\ \\_\\  \\ \\_\\
  \\/_/\\/_/   \\/_/\\/_/   \\/_____/ \\/_____/      \\/_/\\/_/   \\/_/

Greetings traveller,

I am ✨Khoj✨, your open-source, personal AI copilot.

See my source code at https://github.com/khoj-ai/khoj
Read my operating manual at https://docs.khoj.dev
`);


window.appInfoAPI.getInfo((_, info) => {
    let khojVersionElement = document.getElementById("about-page-version");
    if (khojVersionElement) {
        khojVersionElement.innerHTML = `<code>${info.version}</code>`;
    }
    let khojTitleElement = document.getElementById("about-page-title");
    if (khojTitleElement) {
        khojTitleElement.innerHTML = '<b>Khoj for ' + (info.platform === 'win32' ? 'Windows' : info.platform === 'darwin' ? 'macOS' : 'Linux') + '</b>';
    }
});

function toggleNavMenu() {
    let menu = document.getElementById("khoj-nav-menu");
    menu.classList.toggle("show");
}

// Close the dropdown menu if the user clicks outside of it
document.addEventListener('click', function (event) {
    let menu = document.getElementById("khoj-nav-menu");
    let menuContainer = document.getElementById("khoj-nav-menu-container");
    let isClickOnMenu = menuContainer?.contains(event.target) || menuContainer === event.target;
    if (menu && isClickOnMenu === false && menu.classList.contains("show")) {
        menu.classList.remove("show");
    }
});

async function populateHeaderPane() {
    let userInfo = null;
    try {
        userInfo = await window.userInfoAPI.getUserInfo();
    } catch (error) {
        console.log("User not logged in");
    }

    let username = userInfo?.username ?? "?";
    let user_photo = userInfo?.photo;
    let is_active = userInfo?.is_active;
    let has_documents = userInfo?.has_documents;

    // Populate the header element with the navigation pane
    return `
        <a class="khoj-logo" href="/">
            <img class="khoj-logo" src="./assets/icons/khoj_logo.png" alt="Khoj"></img>
        </a>
        <nav class="khoj-nav">
        ${userInfo && userInfo.email
            ? `<div class="khoj-status-box">
              <span class="khoj-status-connected"></span>
               <span class="khoj-status-text">Connected to server</span>
               </div>`
            : `<div class="khoj-status-box">
              <span class="khoj-status-not-connected"></span>
               <span class="khoj-status-text">Not connected to server</span>
               </div>`
        }
            ${username ? `
                <div id="khoj-nav-menu-container" class="khoj-nav dropdown">
                    ${user_photo && user_photo != "None" ? `
                        <img id="profile-picture" class="${is_active ? 'circle subscribed' : 'circle'}" src="${user_photo}" alt="${username[0].toUpperCase()}" referrerpolicy="no-referrer">
                    ` : `
                        <div id="profile-picture" class="${is_active ? 'circle user-initial subscribed' : 'circle user-initial'}" alt="${username[0].toUpperCase()}">${username[0].toUpperCase()}</div>
                    `}
                    <div id="khoj-nav-menu" class="khoj-nav-dropdown-content">
                        <div class="khoj-nav-username"> ${username} </div>
                        <a onclick="window.navigateAPI.navigateToWebHome()" class="khoj-nav-link">
                        <img class="khoj-nav-icon" src="./assets/icons/open-link.svg" alt="Open Host Url"></img>
                        Open App
                        </a>
                    </div>
                </div>
            ` : ''}
        </nav>
    `;
}

```

### Core Architecture Module: `src/interface/obsidian/src/utils.ts`
```
import { FileSystemAdapter, Notice, Vault, Modal, TFile, request, setIcon, Editor, WorkspaceLeaf } from 'obsidian';
import { KhojSetting, ModelOption, ServerUserConfig, UserInfo } from 'src/settings'
import { deleteContentByType, uploadContentBatch } from './api';
import { KhojSearchModal } from './search_modal';

export function getVaultAbsolutePath(vault: Vault): string {
    let adaptor = vault.adapter;
    if (adaptor instanceof FileSystemAdapter) {
        return adaptor.getBasePath();
    }
    return '';
}

function fileExtensionToMimeType(extension: string): string {
    switch (extension) {
        case 'pdf':
            return 'application/pdf';
        case 'png':
            return 'image/png';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'md':
        case 'markdown':
            return 'text/markdown';
        case 'org':
            return 'text/org';
        default:
            return 'text/plain';
    }
}

function filenameToMimeType(filename: TFile): string {
    switch (filename.extension) {
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
            console.warn(`Unknown file type: ${filename.extension}. Defaulting to text/plain.`);
            return 'text/plain';
    }
}

export const fileTypeToExtension = {
    'pdf': ['pdf'],
    'image': ['png', 'jpg', 'jpeg', 'webp'],
    'markdown': ['md', 'markdown'],
};
export const supportedImageFilesTypes = fileTypeToExtension.image;
export const supportedBinaryFileTypes = fileTypeToExtension.pdf.concat(supportedImageFilesTypes);
export const supportedFileTypes = fileTypeToExtension.markdown.concat(supportedBinaryFileTypes);

export function getFilesToSync(vault: Vault, setting: KhojSetting): TFile[] {
    const files = vault.getFiles()
        // Filter supported file types for syncing
        .filter(file => supportedFileTypes.includes(file.extension))
        // Filter user configured file types for syncing
        .filter(file => {
            if (fileTypeToExtension.markdown.includes(file.extension)) return setting.syncFileType.markdown;
            if (fileTypeToExtension.pdf.includes(file.extension)) return setting.syncFileType.pdf;
            if (fileTypeToExtension.image.includes(file.extension)) return setting.syncFileType.images;
            return false;
        })
        // Filter in included folders
        .filter(file => {
            // If no folders are specified, sync all files
            if (setting.syncFolders.length === 0) return true;
            // Otherwise, check if the file is in one of the specified folders
            return setting.syncFolders.some(folder =>
                file.path.startsWith(folder + '/') || file.path === folder
            );
        })
        // Filter out excluded folders
        .filter(file => {
            // If no folders are excluded, include all files
            if (setting.excludeFolders.length === 0) return true;
            // Exclude files in any of the excluded folders
            return !setting.excludeFolders.some(folder =>
                file.path.startsWith(folder + '/') || file.path === folder
            );
        })
        // Sort files by type: markdown > pdf > image
        .sort((a, b) => {
            const typeOrder: (keyof typeof fileTypeToExtension)[] = ['markdown', 'pdf', 'image'];
            const aType = typeOrder.findIndex(type => fileTypeToExtension[type].includes(a.extension));
            const bType = typeOrder.findIndex(type => fileTypeToExtension[type].includes(b.extension));
            return aType - bType;
        });

    return files;
}

export async function updateContentIndex(
    vault: Vault,
    setting: KhojSetting,
    lastSync: Map<TFile, number>,
    regenerate: boolean = false,
    userTriggered: boolean = false,
    onProgress?: (progress: { processed: number, total: number }) => void
): Promise<Map<TFile, number>> {
    // Get all markdown, pdf files in the vault
    console.log(`Khoj: Updating Khoj content index...`);
    const files = getFilesToSync(vault, setting);
    console.log(`Khoj: Found ${files.length} eligible files in vault`);

    let countOfFilesToIndex = 0;
    let countOfFilesToDelete = 0;
    lastSync = lastSync.size > 0 ? lastSync : new Map<TFile, number>();

    // Count files that need indexing (modified since last sync or regenerating)
    const filesToSync = regenerate
        ? files
        : files.filter(file => file.stat.mtime >= (lastSync.get(file) ?? 0));

    // Show notice with file counts when user triggers sync
    if (userTriggered) {
        new Notice(`🔄 Syncing ${filesToSync.length} of ${files.length} files to Khoj...`);
    }
    console.log(`Khoj: ${filesToSync.length} files to sync (${files.length} total eligible)`);

    // Add all files to index as multipart form data, batched by size, item count
    const MAX_BATCH_SIZE = 10 * 1024 * 1024; // 10MB max batch size
    const MAX_BATCH_ITEMS = 50; // Max 50 items per batch
    let fileData: { blob: Blob, path: string }[][] = [];
    let currentBatch: { blob: Blob, path: string }[] = [];
    let currentBatchSize = 0;

    for (const file of files) {
        // Only push files that have been modified since last sync if not regenerating
        if (!regenerate && file.stat.mtime < (lastSync.get(file) ?? 0)) {
            continue;
        }

        countOfFilesToIndex++;
        const encoding = supportedBinaryFileTypes.includes(file.extension) ? "binary" : "utf8";
        const mimeType = fileExtensionToMimeType(file.extension) + (encoding === "utf8" ? "; charset=UTF-8" : "");
        const fileContent = encoding == 'binary' ? await vault.readBinary(file) : await vault.read(file);
        const fileItem = { blob: new Blob([fileContent], { type: mimeType }), path: file.path };

        const fileSize = (typeof fileContent === 'string') ? new Blob([fileContent]).size : fileContent.byteLength;
        if ((currentBatchSize + fileSize > MAX_BATCH_SIZE || currentBatch.length >= MAX_BATCH_ITEMS) && currentBatch.length > 0) {
            fileData.push(currentBatch);
            currentBatch = [];
            currentBatchSize = 0;
        }

        currentBatch.push(fileItem);
        currentBatchSize += fileSize;
    }

    // Add files to delete (previously synced but no longer in vault) to final batch
    let filesToDelete: TFile[] = [];
    for (const lastSyncedFile of lastSync.keys()) {
        if (!files.includes(lastSyncedFile)) {
            countOfFilesToDelete++;
            const fileObj = new Blob([""], { type: filenameToMimeType(lastSyncedFile) });
            currentBatch.push({ blob: fileObj, path: lastSyncedFile.path });
            filesToDelete.push(lastSyncedFile);
        }
    }

    // Add final batch if not empty
    if (currentBatch.length > 0) {
        fileData.push(currentBatch);
    }

    // Delete all files of enabled content types first if regenerating
    let error_message: string | null = null;
    if (regenerate) {
        // Mark content types to delete based on user sync file type settings
        const contentTypesToDelete: string[] = [];
        if (setting.syncFileType.markdown) contentTypesToDelete.push('markdown');
        if (setting.syncFileType.pdf) contentTypesToDelete.push('pdf');
        if (setting.syncFileType.images) contentTypesToDelete.push('image');

        try {
            for (const contentType of contentTypesToDelete) {
                await deleteContentByType(setting.khojUrl, setting.khojApiKey, contentType);
            }
        } catch (err) {
            console.error('Khoj: Error deleting content types:', err);
            error_message = "❗️Failed to clear existing content index";
            fileData = [];
        }
    }

    // Upload files in batches
    let responses: string[] = [];
    let processedFiles = 0;
    const totalFiles = fileData.reduce((sum, batch) => sum + batch.length, 0);

    // Report initial progress with total count before uploading
    if (onProgress) {
        onProgress({ processed: 0, total: totalFiles });
    }

    for (const batch of fileData) {
        try {
            const resultText = await uploadContentBatch(setting.khojUrl, setting.khojApiKey, batch);
            responses.push(resultText);
            processedFiles += batch.length;
            if (onProgress) {
                onProgress({ processed: processedFiles, total: totalFiles });
            }
        } catch (err: any) {
            console.error('Khoj: Failed to upload batch:', err);
            if (err.message?.includes('429')) {
                error_message = `❗️Requests were throttled. Upgrade your subscription or try again later.`;
            } else {
                error_message = `❗️Failed to sync content with Khoj server. Error: ${err.message ?? String(err)}`;
            }
            break;
        }
    }

    // Update last sync time for each successfully indexed file
    files
        .filter(file => responses.find(response => response.includes(file.path)))
        .reduce((newSync, file) => {
            newSync.set(file, new Date().getTime());
            return newSync;
        }, lastSync);

    // Remove files that were deleted from last sync
    filesToDelete
        .filter(file => responses.find(response => response.includes(file.path)))
        .forEach(file => lastSync.delete(file));

    if (error_message) {
        new Notice(error_message);
    } else {
        const summary = `Updated ${countOfFilesToIndex}, deleted ${countOfFilesToDelete} files`;
        if (userTriggered) new Notice(`✅ ${summary}`);
        console.log(`✅ Refreshed Khoj content index. ${summary}.`);
    }

    return
```

### Core Architecture Module: `src/interface/web/app/common/colorUtils.ts`
```
export const tailwindColors = [
    "red",
    "yellow",
    "green",
    "blue",
    "orange",
    "purple",
    "pink",
    "teal",
    "cyan",
    "lime",
    "indigo",
    "fuchsia",
    "rose",
    "sky",
    "amber",
    "emerald",
];

export function convertColorToTextClass(color: string) {
    if (tailwindColors.includes(color)) {
        return `text-${color}-500`;
    }
    return `text-gray-500`;
}

export function convertToBGGradientClass(color: string) {
    if (tailwindColors.includes(color)) {
        return `bg-gradient-to-b from-[hsl(var(--background))] to-${color}-100/70 dark:from-[hsl(var(--background))] dark:to-${color}-950/30 `;
    }
    return `bg-gradient-to-b from-white to-orange-50`;
}

export function convertToBGClass(color: string) {
    if (tailwindColors.includes(color)) {
        return `bg-${color}-500 dark:bg-${color}-900 hover:bg-${color}-400 dark:hover:bg-${color}-800`;
    }
    return `bg-background`;
}

export function converColorToBgGradient(color: string) {
    return `${convertToBGGradientClass(color)} dark:border dark:border-neutral-700`;
}

export function convertColorToCaretClass(color: string | undefined) {
    if (color && tailwindColors.includes(color)) {
        return `caret-${color}-500`;
    }
    return `caret-orange-500`;
}

export function convertColorToRingClass(color: string | undefined) {
    if (color && tailwindColors.includes(color)) {
        return `focus-visible:ring-${color}-500`;
    }
    return `focus-visible:ring-orange-500`;
}

export function convertColorToBorderClass(color: string) {
    if (tailwindColors.includes(color)) {
        return `border-${color}-500`;
    }
    return `border-gray-500`;
}
//rewrite colorMap using the convertColorToBorderClass function and iteration through the tailwindColors array
export const colorMap: Record<string, string> = {};
for (const color of tailwindColors) {
    colorMap[color] = convertColorToBorderClass(color);
}

```

### Core Architecture Module: `src/interface/web/app/common/iconUtils.tsx`
```
import React from "react";
import { convertColorToTextClass } from "./colorUtils";
import {
    Lightbulb,
    Robot,
    Aperture,
    GraduationCap,
    Jeep,
    Island,
    MathOperations,
    Asclepius,
    Couch,
    Code,
    Atom,
    ClockCounterClockwise,
    File,
    Globe,
    Palette,
    Book,
    Confetti,
    House,
    Translate,
    Image,
    BowlFood,
    Lectern,
    Wallet,
    PencilLine,
    Chalkboard,
    Gps,
    Question,
    Browser,
    Notebook,
    Shapes,
    ChatsTeardrop,
    GlobeSimple,
    ArrowRight,
    Cigarette,
    CraneTower,
    Heart,
    Leaf,
    NewspaperClipping,
    OrangeSlice,
    SmileyMelting,
    YinYang,
    SneakerMove,
    Student,
    Oven,
    Gavel,
    Broadcast,
    KeyReturn,
    FilePdf,
    FileMd,
    MicrosoftWordLogo,
    Microscope,
} from "@phosphor-icons/react";
import { OrgMode } from "@/app/components/logo/fileLogo";

interface IconMap {
    [key: string]: (color: string, width: string, height: string) => JSX.Element | null;
}

const iconMap: IconMap = {
    Lightbulb: (color: string, width: string, height: string) => (
        <Lightbulb className={`${width} ${height} ${color} mr-2`} />
    ),
    Robot: (color: string, width: string, height: string) => (
        <Robot className={`${width} ${height} ${color} mr-2`} />
    ),
    Aperture: (color: string, width: string, height: string) => (
        <Aperture className={`${width} ${height} ${color} mr-2`} />
    ),
    GraduationCap: (color: string, width: string, height: string) => (
        <GraduationCap className={`${width} ${height} ${color} mr-2`} />
    ),
    Jeep: (color: string, width: string, height: string) => (
        <Jeep className={`${width} ${height} ${color} mr-2`} />
    ),
    Island: (color: string, width: string, height: string) => (
        <Island className={`${width} ${height} ${color} mr-2`} />
    ),
    MathOperations: (color: string, width: string, height: string) => (
        <MathOperations className={`${width} ${height} ${color} mr-2`} />
    ),
    Asclepius: (color: string, width: string, height: string) => (
        <Asclepius className={`${width} ${height} ${color} mr-2`} />
    ),
    Couch: (color: string, width: string, height: string) => (
        <Couch className={`${width} ${height} ${color} mr-2`} />
    ),
    Code: (color: string, width: string, height: string) => (
        <Code className={`${width} ${height} ${color} mr-2`} />
    ),
    Atom: (color: string, width: string, height: string) => (
        <Atom className={`${width} ${height} ${color} mr-2`} />
    ),
    ClockCounterClockwise: (color: string, width: string, height: string) => (
        <ClockCounterClockwise className={`${width} ${height} ${color} mr-2`} />
    ),
    Globe: (color: string, width: string, height: string) => (
        <Globe className={`${width} ${height} ${color} mr-2`} />
    ),
    Palette: (color: string, width: string, height: string) => (
        <Palette className={`${width} ${height} ${color} mr-2`} />
    ),
    Book: (color: string, width: string, height: string) => (
        <Book className={`${width} ${height} ${color} mr-2`} />
    ),
    Confetti: (color: string, width: string, height: string) => (
        <Confetti className={`${width} ${height} ${color} mr-2`} />
    ),
    House: (color: string, width: string, height: string) => (
        <House className={`${width} ${height} ${color} mr-2`} />
    ),
    Translate: (color: string, width: string, height: string) => (
        <Translate className={`${width} ${height} ${color} mr-2`} />
    ),
    BowlFood: (color: string, width: string, height: string) => (
        <BowlFood className={`${width} ${height} ${color} mr-2`} />
    ),
    Lectern: (color: string, width: string, height: string) => (
        <Lectern className={`${width} ${height} ${color} mr-2`} />
    ),
    Wallet: (color: string, width: string, height: string) => (
        <Wallet className={`${width} ${height} ${color} mr-2`} />
    ),
    PencilLine: (color: string, width: string, height: string) => (
        <PencilLine className={`${width} ${height} ${color} mr-2`} />
    ),
    Chalkboard: (color: string, width: string, height: string) => (
        <Chalkboard className={`${width} ${height} ${color} mr-2`} />
    ),
    Cigarette: (color: string, width: string, height: string) => (
        <Cigarette className={`${width} ${height} ${color} mr-2`} />
    ),
    CraneTower: (color: string, width: string, height: string) => (
        <CraneTower className={`${width} ${height} ${color} mr-2`} />
    ),
    Heart: (color: string, width: string, height: string) => (
        <Heart className={`${width} ${height} ${color} mr-2`} />
    ),
    Leaf: (color: string, width: string, height: string) => (
        <Leaf className={`${width} ${height} ${color} mr-2`} />
    ),
    NewspaperClipping: (color: string, width: string, height: string) => (
        <NewspaperClipping className={`${width} ${height} ${color} mr-2`} />
    ),
    OrangeSlice: (color: string, width: string, height: string) => (
        <OrangeSlice className={`${width} ${height} ${color} mr-2`} />
    ),
    SmileyMelting: (color: string, width: string, height: string) => (
        <SmileyMelting className={`${width} ${height} ${color} mr-2`} />
    ),
    YinYang: (color: string, width: string, height: string) => (
        <YinYang className={`${width} ${height} ${color} mr-2`} />
    ),
    SneakerMove: (color: string, width: string, height: string) => (
        <SneakerMove className={`${width} ${height} ${color} mr-2`} />
    ),
    Student: (color: string, width: string, height: string) => (
        <Student className={`${width} ${height} ${color} mr-2`} />
    ),
    Oven: (color: string, width: string, height: string) => (
        <Oven className={`${width} ${height} ${color} mr-2`} />
    ),
    Gavel: (color: string, width: string, height: string) => (
        <Gavel className={`${width} ${height} ${color} mr-2`} />
    ),
    Broadcast: (color: string, width: string, height: string) => (
        <Broadcast className={`${width} ${height} ${color} mr-2`} />
    ),
    Image: (color: string, width: string, height: string) => (
        <Image className={`${width} ${height} ${color} mr-2`} />
    ),
    File: (color: string, width: string, height: string) => (
        <File className={`${width} ${height} ${color} mr-2`} />
    ),
};

export function getIconForSlashCommand(command: string, customClassName: string | null = null) {
    const className = customClassName ?? "h-4 w-4";
    if (command.includes("summarize")) {
        return <Gps className={className} />;
    }

    if (command.includes("help")) {
        return <Question className={className} />;
    }

    if (command.includes("automation")) {
        return <Robot className={className} />;
    }

    if (command.includes("webpage")) {
        return <Browser className={className} />;
    }

    if (command.includes("notes")) {
        return <Notebook className={className} />;
    }

    if (command.includes("image")) {
        return <Image className={className} />;
    }

    if (command.includes("default")) {
        return <KeyReturn className={className} />;
    }

    if (command.includes("diagram")) {
        return <Shapes className={className} />;
    }

    if (command.includes("general")) {
        return <ChatsTeardrop className={className} />;
    }

    if (command.includes("online")) {
        return <GlobeSimple className={className} />;
    }

    if (command.includes("text")) {
        return <PencilLine className={className} />;
    }

    if (command.includes("code")) {
        return <Code className={className} />;
    }

    if (command.includes("research")) {
        return <Microscope className={className} />;
    }

    return <ArrowRight className={className} />;
}

function getIconFromIconName(
    iconName: string,
    color: string = "gray",
    width: string = "w-6",
    height: string = "h-6",
) {
    const icon = iconMap[iconName];
    const colorName = color.toLowerCase();
    const colorClass = convertColorToTextClass(colorName);
    return icon ? icon(colorClass, width, height) : null;
}

function getIconFromFilename(
    filename: string,
    className: string = "w-6 h-6 text-muted-foreground inline-flex mr-1",
) {
    const extension = filename.split(".").pop();
    switch (extension) {
        case "org":
            return <OrgMode className={className} />;
        case "markdown":
        case "md":
            return <FileMd className={className} />;
        case "pdf":
            return <FilePdf className={className} />;
        case "doc":
        case "docx":
            return <MicrosoftWordLogo className={className} />;
        case "csv":
        case "json":
            return <MathOperations className={className} />;
        case "txt":
            return <Notebook className={className} />;
        case "py":
            return <Code className={className} />;
        case "jpg":
        case "jpeg":
        case "png":
        case "webp":
            return <Image className={className} weight="fill" />;
        default:
            return <File className={className} weight="fill" />;
    }
}

function getAvailableIcons() {
    return Object.keys(iconMap);
}

export { getIconFromIconName, getIconFromFilename, getAvailableIcons };

```

### Core Architecture Module: `src/interface/web/app/common/utils.ts`
```
import { useEffect, useState } from "react";
import useSWR from "swr";
import * as React from "react";

export interface LocationData {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    timezone: string;
}

const locationFetcher = () =>
    window
        .fetch("https://ipapi.co/json")
        .then((res) => res.json())
        .catch((err) => console.log(err));

export const toTitleCase = (str: string) =>
    str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

export function welcomeConsole() {
    console.log(
        `%c %s`,
        "font-family:monospace",
        `
 __  __     __  __     ______       __        _____      __
/\\ \\/ /    /\\ \\_\\ \\   /\\  __ \\     /\\ \\      /\\  __ \\   /\\ \\
\\ \\  _"-.  \\ \\  __ \\  \\ \\ \\/\\ \\   _\\_\\ \\     \\ \\  __ \\  \\ \\ \\
 \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_____\\ /\\_____\\     \\ \\_\\ \\_\\  \\ \\_\\
  \\/_/\\/_/   \\/_/\\/_/   \\/_____/ \\/_____/      \\/_/\\/_/   \\/_/


Greetings traveller,

I am ✨Khoj✨, your open-source, personal AI copilot.

See my source code at https://github.com/khoj-ai/khoj
Read my operating manual at https://docs.khoj.dev
`,
    );
}

export function useIPLocationData() {
    const {
        data: locationData,
        error: locationDataError,
        isLoading: locationDataLoading,
    } = useSWR<LocationData>("/api/ip", locationFetcher, { revalidateOnFocus: false });
    return { locationData, locationDataError, locationDataLoading };
}

export function useIsMobileWidth() {
    const [isMobileWidth, setIsMobileWidth] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsMobileWidth(true);
            } else {
                setIsMobileWidth(false);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return isMobileWidth;
}

export const useMutationObserver = (
    ref: React.MutableRefObject<HTMLElement | null>,
    callback: MutationCallback,
    options = {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
    },
) => {
    React.useEffect(() => {
        if (ref.current) {
            const observer = new MutationObserver(callback);
            observer.observe(ref.current, options);
            return () => observer.disconnect();
        }
    }, [ref, callback, options]);
};

export function useIsDarkMode() {
    const [darkMode, setDarkMode] = useState(false);
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    useEffect(() => {
        if (localStorage.getItem("theme") === "dark") {
            document.documentElement.classList.add("dark");
            setDarkMode(true);
        } else if (localStorage.getItem("theme") === "light") {
            document.documentElement.classList.remove("dark");
            setDarkMode(false);
        } else {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            if (mq.matches) {
                document.documentElement.classList.add("dark");
                setDarkMode(true);
            }
        }
        setInitialLoadDone(true);
    }, []);

    useEffect(() => {
        if (!initialLoadDone) return;
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        localStorage.setItem("theme", darkMode ? "dark" : "light");
    }, [darkMode, initialLoadDone]);

    return [darkMode, setDarkMode] as const;
}

export const convertBytesToText = (fileSize: number) => {
    if (fileSize < 1024) {
        return `${fileSize} B`;
    } else if (fileSize < 1024 * 1024) {
        return `${(fileSize / 1024).toFixed(2)} KB`;
    } else {
        return `${(fileSize / (1024 * 1024)).toFixed(2)} MB`;
    }
};

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export const formatDateTime = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

        // Show relative time for recent dates
        if (diffInMinutes < 1) return "just now";
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        if (diffInMinutes < 120) return "1 hour ago";
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;

        // For older dates, show full formatted date
        const formatter = new Intl.DateTimeFormat("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZoneName: "short",
        });

        return formatter.format(date);
    } catch (error) {
        console.error("Error formatting date:", error);
        return isoString;
    }
};

```

### Core Architecture Module: `src/interface/web/hooks/use-mobile.tsx`
```
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };
        mql.addEventListener("change", onChange);
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        return () => mql.removeEventListener("change", onChange);
    }, []);

    return !!isMobile;
}

```

### Core Architecture Module: `src/interface/web/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `src/khoj/interface/web/assets/utils.js`
```
// Toggle the navigation menu
function toggleMenu() {
    let menu = document.getElementById("khoj-nav-menu");
    menu.classList.toggle("show");
}

// Close the dropdown menu if the user clicks outside of it
document.addEventListener('click', function(event) {
    let menu = document.getElementById("khoj-nav-menu");
    let menuContainer = document.getElementById("khoj-nav-menu-container");
    if (menuContainer) {
        let isClickOnMenu = menuContainer.contains(event.target) || menuContainer === event.target;
        if (isClickOnMenu === false && menu.classList.contains("show")) {
            menu.classList.remove("show");
        }
    }
});

console.log(`%c %s`, "font-family:monospace", `
 __  __     __  __     ______       __        _____      __
/\\ \\/ /    /\\ \\_\\ \\   /\\  __ \\     /\\ \\      /\\  __ \\   /\\ \\
\\ \\  _"-.  \\ \\  __ \\  \\ \\ \\/\\ \\   _\\_\\ \\     \\ \\  __ \\  \\ \\ \\
 \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_____\\ /\\_____\\     \\ \\_\\ \\_\\  \\ \\_\\
  \\/_/\\/_/   \\/_/\\/_/   \\/_____/ \\/_____/      \\/_/\\/_/   \\/_/


Greetings traveller,

I am ✨Khoj✨, your open-source, personal AI copilot.

See my source code at https://github.com/khoj-ai/khoj
Read my operating manual at https://docs.khoj.dev
`);

```

### Core Architecture Module: `src/khoj/processor/conversation/anthropic/utils.py`
```
import json
import logging
from copy import deepcopy
from time import perf_counter
from typing import AsyncGenerator, Dict, List

import anthropic
from langchain_core.messages.chat import ChatMessage
from pydantic import BaseModel
from tenacity import (
    before_sleep_log,
    retry,
    stop_after_attempt,
    wait_exponential,
    wait_random_exponential,
)

from khoj.processor.conversation.utils import (
    ResponseWithThought,
    ToolCall,
    commit_conversation_trace,
    get_image_from_base64,
    get_image_from_url,
)
from khoj.utils.helpers import (
    ToolDefinition,
    create_tool_definition,
    get_anthropic_async_client,
    get_anthropic_client,
    get_chat_usage_metrics,
    is_none_or_empty,
    is_promptrace_enabled,
)

logger = logging.getLogger(__name__)

anthropic_clients: Dict[str, anthropic.Anthropic | anthropic.AnthropicVertex] = {}
anthropic_async_clients: Dict[str, anthropic.AsyncAnthropic | anthropic.AsyncAnthropicVertex] = {}

DEFAULT_MAX_TOKENS_ANTHROPIC = 8000
MAX_REASONING_TOKENS_ANTHROPIC = 12000
REASONING_MODELS = ["claude-3-7", "claude-sonnet-4", "claude-opus-4", "claude-haiku-4"]


@retry(
    wait=wait_random_exponential(min=1, max=10),
    stop=stop_after_attempt(2),
    before_sleep=before_sleep_log(logger, logging.DEBUG),
    reraise=True,
)
def anthropic_completion_with_backoff(
    messages: list[ChatMessage],
    system_prompt: str,
    model_name: str,
    temperature: float = 0.4,
    api_key: str | None = None,
    api_base_url: str | None = None,
    model_kwargs: dict | None = None,
    max_tokens: int | None = None,
    response_type: str = "text",
    response_schema: BaseModel | None = None,
    tools: List[ToolDefinition] = None,
    deepthought: bool = False,
    tracer: dict = {},
) -> ResponseWithThought:
    client = anthropic_clients.get(api_key)
    if not client:
        client = get_anthropic_client(api_key, api_base_url)
        anthropic_clients[api_key] = client

    formatted_messages, system = format_messages_for_anthropic(messages, system_prompt)

    thoughts = ""
    aggregated_response = ""
    final_message = None
    model_kwargs = model_kwargs or dict()

    # Configure structured output
    if tools:
        # Convert tools to Anthropic format
        model_kwargs["tools"] = [
            anthropic.types.ToolParam(name=tool.name, description=tool.description, input_schema=tool.schema)
            for tool in tools
        ]
        # Cache tool definitions
        last_tool = model_kwargs["tools"][-1]
        last_tool["cache_control"] = {"type": "ephemeral"}
        model_kwargs["tool_choice"] = {"type": "auto"}
    elif response_schema:
        tool = create_tool_definition(response_schema)
        model_kwargs["tools"] = [
            anthropic.types.ToolParam(name=tool.name, description=tool.description, input_schema=tool.schema)
        ]
    elif response_type == "json_object" and not (is_reasoning_model(model_name) and deepthought):
        # Prefill model response with '{' to make it output a valid JSON object. Not supported with extended thinking.
        formatted_messages.append(anthropic.types.MessageParam(role="assistant", content="{"))
        aggregated_response += "{"

    if system:
        model_kwargs["system"] = system

    max_tokens = max_tokens or DEFAULT_MAX_TOKENS_ANTHROPIC
    if deepthought and is_reasoning_model(model_name):
        model_kwargs["thinking"] = {"type": "enabled", "budget_tokens": MAX_REASONING_TOKENS_ANTHROPIC}
        model_kwargs["betas"] = ["context-management-2025-06-27"]
        model_kwargs["context_management"] = {"edits": [{"type": "clear_thinking_20251015", "keep": "all"}]}
        max_tokens += MAX_REASONING_TOKENS_ANTHROPIC
        # Temperature control not supported when using extended thinking
        temperature = 1.0

    with client.beta.messages.stream(
        messages=formatted_messages,
        model=model_name,  # type: ignore
        temperature=temperature,
        timeout=20,
        max_tokens=max_tokens,
        **(model_kwargs),
    ) as stream:
        for chunk in stream:
            if chunk.type != "content_block_delta":
                continue
            if chunk.delta.type == "thinking_delta":
                thoughts += chunk.delta.thinking
            elif chunk.delta.type == "text_delta":
                aggregated_response += chunk.delta.text
        final_message = stream.get_final_message()

    # Track raw content of model response to reuse for cache hits in multi-turn chats
    raw_content = [item.model_dump(exclude_none=True) for item in final_message.content]

    # Extract all tool calls if tools are enabled
    if tools:
        tool_calls = [
            ToolCall(name=item.name, args=item.input, id=item.id).__dict__
            for item in final_message.content
            if item.type == "tool_use"
        ]
        if tool_calls:
            # If there are tool calls, aggregate thoughts and responses into thoughts
            if thoughts and aggregated_response:
                # wrap each line of thought in italics
                thoughts = "\n".join([f"*{line.strip()}*" for line in thoughts.splitlines() if line.strip()])
                thoughts = f"{thoughts}\n\n{aggregated_response}"
            else:
                thoughts = thoughts or aggregated_response
            # Json dump tool calls into aggregated response
            aggregated_response = json.dumps(tool_calls)
    # If response schema is used, return the first tool call's input
    elif response_schema:
        for item in final_message.content:
            if item.type == "tool_use":
                aggregated_response = json.dumps(item.input)
                break

    # Calculate cost of chat
    input_tokens = final_message.usage.input_tokens
    output_tokens = final_message.usage.output_tokens
    cache_read_tokens = final_message.usage.cache_read_input_tokens
    cache_write_tokens = final_message.usage.cache_creation_input_tokens
    tracer["usage"] = get_chat_usage_metrics(
        model_name, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, usage=tracer.get("usage")
    )

    # Validate the response. If empty, raise an error to retry.
    if is_none_or_empty(aggregated_response):
        logger.warning(f"No response by {model_name}\nLast Message by {messages[-1].role}: {messages[-1].content}.")
        raise ValueError(f"Empty or no response by {model_name} over API. Retry if needed.")

    # Save conversation trace
    tracer["chat_model"] = model_name
    tracer["temperature"] = temperature
    if is_promptrace_enabled():
        commit_conversation_trace(messages, aggregated_response, tracer)

    return ResponseWithThought(text=aggregated_response, thought=thoughts, raw_content=raw_content)


@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(2),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=False,
)
async def anthropic_chat_completion_with_backoff(
    messages: list[ChatMessage],
    model_name: str | None,
    temperature: float,
    api_key: str | None,
    api_base_url: str,
    system_prompt: str = "",
    deepthought: bool = False,
    model_kwargs: dict | None = None,
    tracer: dict = {},
) -> AsyncGenerator[ResponseWithThought, None]:
    client = anthropic_async_clients.get(api_key)
    if not client:
        client = get_anthropic_async_client(api_key, api_base_url)
        anthropic_async_clients[api_key] = client

    model_kwargs = model_kwargs or dict()
    max_tokens = DEFAULT_MAX_TOKENS_ANTHROPIC
    if deepthought and is_reasoning_model(model_name):
        model_kwargs["thinking"] = {"type": "enabled", "budget_tokens": MAX_REASONING_TOKENS_ANTHROPIC}
        max_tokens += MAX_REASONING_TOKENS_ANTHROPIC
        # Temperature control not supported when using extended thinking
        temperature = 1.0

    formatted_messages, system = format_messages_for_anthropic(messages, system_prompt)

    aggregated_response = ""
    response_started = False
    final_message = None
    start_time = perf_counter()
    async with client.messages.stream(
        messages=formatted_messages,
        model=model_name,  # type: ignore
        temperature=temperature,
        system=system,
        timeout=20,
        max_tokens=max_tokens,
        **model_kwargs,
    ) as stream:
        async for chunk in stream:
            # Log the time taken to start response
            if not response_started:
                response_started = True
                logger.info(f"First response took: {perf_counter() - start_time:.3f} seconds")
            if chunk.type == "message_delta":
                if chunk.delta.stop_reason == "refusal":
                    yield ResponseWithThought(
                        text="...I'm sorry, but my safety filters prevent me from assisting with this query."
                    )
                elif chunk.delta.stop_reason == "max_tokens":
                    yield ResponseWithThought(text="...I'm sorry, but I've hit my response length limit.")
                if chunk.delta.stop_reason in ["refusal", "max_tokens"]:
                    logger.warning(
                        f"LLM Response Prevented for {model_name}: {chunk.delta.stop_reason}.\n"
                        + f"Last Message by {messages[-1].role}: {messages[-1].content}"
                    )
                    break
            # Skip empty chunks
            if chunk.type != "content_block_delta":
                continue
            # Handle streamed response chunk
            response_chunk: ResponseWithThought = None
            if chunk.delta.type == "text_delta":
                response_chunk = ResponseWithThought(text=chunk.delta.text)
                aggregated_response += chunk.delta.text
            if chunk.delta.type == "thinking_delta":
                response_chunk = ResponseWithThought(thought=chunk.delta.thinking)
            # Handle streamed response chun
```

### Core Architecture Module: `src/khoj/processor/conversation/google/utils.py`
```
import json
import logging
import os
import random
import re
from copy import deepcopy
from time import perf_counter
from typing import Any, AsyncGenerator, AsyncIterator, Dict, List

import httpx
from google import genai
from google.genai import errors as gerrors
from google.genai import types as gtypes
from langchain_core.messages.chat import ChatMessage
from pydantic import BaseModel
from tenacity import (
    RetryCallState,
    before_sleep_log,
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
    wait_random_exponential,
)

from khoj.processor.conversation.utils import (
    ResponseWithThought,
    ToolCall,
    commit_conversation_trace,
    get_image_from_base64,
    get_image_from_url,
)
from khoj.utils.helpers import (
    ToolDefinition,
    get_chat_usage_metrics,
    get_gemini_client,
    is_none_or_empty,
    is_promptrace_enabled,
)

logger = logging.getLogger(__name__)

gemini_clients: Dict[str, genai.Client] = {}

# Output tokens should be more than reasoning tokens.
# This avoids premature response termination.
MAX_OUTPUT_TOKENS_FOR_REASONING_GEMINI = 20000
MAX_OUTPUT_TOKENS_FOR_STANDARD_GEMINI = 8000
MAX_REASONING_TOKENS_GEMINI = 512

SAFETY_SETTINGS = [
    gtypes.SafetySetting(
        category=gtypes.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold=gtypes.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    gtypes.SafetySetting(
        category=gtypes.HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold=gtypes.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    gtypes.SafetySetting(
        category=gtypes.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold=gtypes.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    gtypes.SafetySetting(
        category=gtypes.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold=gtypes.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
    gtypes.SafetySetting(
        category=gtypes.HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
        threshold=gtypes.HarmBlockThreshold.BLOCK_ONLY_HIGH,
    ),
]


class GeminiRetryableClientError(Exception):
    """Wrapper for retryable Gemini client errors that should surface a friendly message if retries exhaust.

    Stores the original exception plus a fallback `response_text` to return after retries are exhausted.
    """

    def __init__(self, original: gerrors.ClientError, response_text: str):
        super().__init__(str(original))
        self.original = original
        self.response_text = response_text
        # Expose code attribute so existing retry predicate logic can still inspect it if needed
        self.code = getattr(original, "code", None)


def _gemini_retry_error_callback(retry_state: RetryCallState):
    """Produce a graceful fallback ResponseWithThought after all retry attempts fail.

    Tenacity will call this when stop condition reached and reraise=False.
    Extract our custom exception to build a ResponseWithThought with the stored friendly message.
    """
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exc, GeminiRetryableClientError):
        # Access original call arguments to optionally record a trace
        kwargs = retry_state.kwargs or {}
        messages = kwargs.get("messages")
        tracer = kwargs.get("tracer", {})
        model_name = kwargs.get("model_name")
        temperature = kwargs.get("temperature")
        if tracer is not None:
            tracer["chat_model"] = model_name
            tracer["temperature"] = temperature
        if messages and is_promptrace_enabled():
            try:
                commit_conversation_trace(messages, exc.response_text, tracer or {})
            except Exception:
                logger.debug("Failed to commit conversation trace on retry exhaustion", exc_info=True)
        return ResponseWithThought(text=exc.response_text, thought=None, raw_content=[])
    else:
        # Propagate other exceptions to caller. Tenacity re-raises if we re-raise here.
        raise exc


def _is_retryable_error(exception: BaseException) -> bool:
    """Check if the exception is a retryable error"""
    # server errors
    if isinstance(exception, (gerrors.APIError, gerrors.ClientError, GeminiRetryableClientError)):
        return exception.code in [429, 502, 503, 504]
    # client errors
    if isinstance(exception, httpx.TimeoutException) or isinstance(exception, httpx.NetworkError):
        return True
    # validation errors
    if isinstance(exception, ValueError):
        return True
    return False


def _extract_retry_delay(exception: BaseException) -> float:
    """Extract retry delay from Gemini error response, return in seconds"""
    if (
        isinstance(exception, (gerrors.ClientError, gerrors.APIError))
        and hasattr(exception, "details")
        and isinstance(exception.details, dict)
    ):
        # Look for retryDelay key, value pair. E.g "retryDelay": "54s"
        if delay_str := exception.details.get("retryDelay"):
            delay_seconds_match = re.search(r"(\d+)s", delay_str)
            if delay_seconds_match:
                delay_seconds = float(delay_seconds_match.group(1))
                return delay_seconds
    return None


def _wait_with_gemini_delay(min_wait=4, max_wait=120, multiplier=1, fallback_wait=None):
    """Custom wait strategy that respects Gemini's retryDelay if present"""

    def wait_func(retry_state: RetryCallState) -> float:
        # Use backoff time if last exception suggests a retry delay
        if retry_state.outcome and retry_state.outcome.failed:
            exception = retry_state.outcome.exception()
            gemini_delay = _extract_retry_delay(exception)
            if gemini_delay:
                # Use the Gemini-suggested delay, but cap it at max_wait
                suggested_delay = min(gemini_delay, max_wait)
                logger.info(f"Using Gemini suggested retry delay: {suggested_delay} seconds")
                return suggested_delay
        # Else use fallback backoff if provided
        if fallback_wait:
            return fallback_wait(retry_state)
        # Else use exponential backoff with provided parameters
        else:
            return wait_exponential(multiplier=multiplier, min=min_wait, max=max_wait)(retry_state)

    return wait_func


@retry(
    retry=retry_if_exception(_is_retryable_error),
    wait=_wait_with_gemini_delay(min_wait=1, max_wait=10, fallback_wait=wait_random_exponential(min=1, max=10)),
    stop=stop_after_attempt(2),
    before_sleep=before_sleep_log(logger, logging.DEBUG),
    reraise=False,
    retry_error_callback=_gemini_retry_error_callback,
)
def gemini_completion_with_backoff(
    messages: list[ChatMessage],
    system_prompt: str,
    model_name: str,
    temperature=1.0,
    api_key=None,
    api_base_url: str = None,
    model_kwargs={},
    deepthought=False,
    tracer={},
) -> ResponseWithThought:
    client = gemini_clients.get(api_key)
    if not client:
        client = get_gemini_client(api_key, api_base_url)
        gemini_clients[api_key] = client

    formatted_messages, system_instruction = format_messages_for_gemini(messages, system_prompt)
    raw_content, response_text, response_thoughts = [], "", None

    # Configure structured output
    tools = None
    response_schema = None
    if model_kwargs.get("tools"):
        tools = to_gemini_tools(model_kwargs["tools"])
    elif model_kwargs.get("response_schema"):
        response_schema = clean_response_schema(model_kwargs["response_schema"])

    thinking_config = None
    if deepthought and model_name.startswith("gemini-2.5"):
        thinking_config = gtypes.ThinkingConfig(thinking_budget=MAX_REASONING_TOKENS_GEMINI, include_thoughts=True)
    elif model_name.startswith("gemini-3"):
        thinking_level = gtypes.ThinkingLevel.HIGH if deepthought else gtypes.ThinkingLevel.LOW
        thinking_config = gtypes.ThinkingConfig(thinking_level=thinking_level, include_thoughts=True)

    max_output_tokens = MAX_OUTPUT_TOKENS_FOR_STANDARD_GEMINI
    if is_reasoning_model(model_name):
        max_output_tokens = MAX_OUTPUT_TOKENS_FOR_REASONING_GEMINI

    seed = int(os.getenv("KHOJ_LLM_SEED")) if os.getenv("KHOJ_LLM_SEED") else None
    config = gtypes.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
        thinking_config=thinking_config,
        max_output_tokens=max_output_tokens,
        safety_settings=SAFETY_SETTINGS,
        response_mime_type=model_kwargs.get("response_mime_type", "text/plain"),
        response_schema=response_schema,
        tools=tools,
        seed=seed,
        top_p=0.95,
        http_options=gtypes.HttpOptions(client_args={"timeout": httpx.Timeout(30.0, read=60.0)}),
    )

    try:
        # Generate the response
        response = client.models.generate_content(model=model_name, config=config, contents=formatted_messages)
        if (
            not response.candidates
            or not response.candidates[0].content
            or response.candidates[0].content.parts is None
        ):
            raise ValueError("Failed to get response from model.")
        raw_content = [part.model_dump() for part in response.candidates[0].content.parts]
        if response.function_calls:
            function_calls = [
                ToolCall(name=function_call.name, args=function_call.args, id=function_call.id).__dict__
                for function_call in response.function_calls
            ]
            response_text = json.dumps(function_calls)
        else:
            # If no function calls, use the text response
            response_text = response.text
        response_thoughts = "\n".join(
            [part.text for part in response.candidates[0].content.parts if part.thought and isinstance(part.text, str)]
        )
    except gerrors.ClientError as e:
        response = None
        # For 429 rate-limit errors, raise wrapped exception so tenacity can retry.
        if e.code == 429:
     
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

- **Issue #1419** (2026-10-01): **feat: recognise llmman when naming an OpenAI-compatible provider**
  *Symptoms*: The provider label in `_create_chat_configuration` was decided by a ternary matching one port suffix:  ```python provider = "Ollama" if openai_base_url and openai_base_url.endswith(":11434/v1/") else "OpenAI" ```  Naming a second local runner would mean nesting another ternary, so this replaces it with a port-to-name map and adds 17434 for [llmman](https://github.com/llmmanorg/llmman), a local model runner that serves an OpenAI-compatible API (alongside Ollama- and Anthropic-compatible ones).  Behaviour is otherwise unchanged: any base URL that doesn't match a known local runner is still labelled `OpenAI`, and the label only affects what shows in the admin UI — model fetching already worked for any OpenAI-compatible endpoint.  **Testing:** new `tests/test_openai_compatible_provider_name.py`, 2 cases covering both runners on two host spellings, plus the fallbacks — `None`, empty string, the real OpenAI URL, and a matching port with a non-matching path (which must *not* match). Both pass.  > AI-assisted, reviewed before submitting. 
  **Post-Mortem & Fix Analysis**:
  > @debanjum PTAL when you get a chance. If useful, please also try https://github.com/llmmanorg/llmman. Thank you!
  > Closing as this has gone quiet. Happy to reopen if useful. Thanks!

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
+    # Act, Assert: negative offsets and limits would raise on the queryset slice, huge limits
+    # would load every conversation into memory at once. Reject them at the API boundary.
+    for query in ["offset=-1", "limit=0", "limit=-5", "limit=101", "limit=1000000"]:
+        response = client.get(f"/api/chat/export?{query}", headers=headers)
+        assert response.status_code == 422, f"Expected 422 for {query}, got {response.status_code}"
+
+    # Act, Assert: the accepted bounds still work
+    for query in ["", "offset=0&limit=1", "offset=0&limit=100"]:
+        response = client.get(f"/api/chat/export?{query}", headers=headers)
+        assert response.status_code == 200, f"Expected 200 for {query}, got {response.status_code}"
```

---

### Incident Patch 2: `2f77ec60` (2026-06-24)
**Commit Message**: Use structured Docker exec args for operator gui commands

**File**: `src/khoj/processor/operator/operator_environment_computer.py` (modified, +13/-9)
```diff
@@ -624,17 +624,21 @@ async def docker_execute(self, python_command_str: str) -> Optional[str]:
             logger.error("Container name or Docker display not set for Docker execution.")
             return None
 
-        safe_python_cmd = python_command_str.replace('"', '\\"')
-        docker_full_cmd = (
-            f'docker exec -e DISPLAY={self.docker_display} "{self.docker_container_name}" '
-            f'python3 -c "{safe_python_cmd}"'
-        )
+        docker_args = [
+            "docker",
+            "exec",
+            "-e",
+            f"DISPLAY={self.docker_display}",
+            self.docker_container_name,
+            "python3",
+            "-c",
+            python_command_str,
+        ]
 
         try:
             process = await asyncio.to_thread(
                 subprocess.run,
-                docker_full_cmd,
-                shell=True,
+                docker_args,
                 capture_output=True,
                 text=True,
                 check=False,  # We check returncode manually
@@ -644,7 +648,7 @@ async def docker_execute(self, python_command_str: str) -> Optional[str]:
                     raise KeyboardInterrupt(process.stderr or process.stdout)
                 else:
                     error_msg = (
-                        f"Docker command failed:\nCmd: {docker_full_cmd}\n"
+                        f"Docker command failed:\nCmd: {docker_args}\n"
                         f"Return Code: {process.returncode}\nStderr: {process.stderr}\nStdout: {process.stdout}"
                     )
                     logger.error(error_msg)
@@ -653,6 +657,6 @@ async def docker_execute(self, python_command_str: str) -> Optional[str]:
         except KeyboardInterrupt:  # Re-raise if caught from above
             raise
         except Exception as e:
-            logger.error(f"Unexpected error running command in Docker '{docker_full_cmd}': {e}")
+            logger.error(f"Unexpected error running command in Docker '{docker_args}': {e}")
             # Encapsulate as RuntimeError to avoid leaking subprocess errors directly
             raise RuntimeError(f"Unexpected Docker error: {e}") from e
```

---

### Incident Patch 3: `f285132f` (2026-06-24)
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

### Incident Patch 4: `fdd5fd8f` (2026-03-26)
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

### Incident Patch 5: `8b8504ed` (2026-03-26)
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

### Incident Patch 6: `a19e7acd` (2026-03-25)
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
 
 @web_client.get("/server/error", response_class=HTMLResponse)
 def server_error_page(request: Request):
-    return templates.TemplateResponse("error.html", context={"request": request})
+    return templates.TemplateResponse(request, name="error.html")
```

---

### Incident Patch 7: `0e169159` (2026-03-25)
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

### Incident Patch 8: `530443a4` (2026-03-25)
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

Co-authored-by: BillionClaw <[REDACTED_EMAIL]>

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

### Incident Patch 9: `e8631261` (2026-03-19)
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

Co-authored-by: 阳虎 <[REDACTED_EMAIL]>

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

### Incident Patch 10: `678549c6` (2026-03-17)
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

Signed-off-by: JiangNan <[REDACTED_EMAIL]>

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

### Incident Patch 11: `6735d33a` (2026-03-17)
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

Signed-off-by: JiangNan <[REDACTED_EMAIL]>

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

---

### Incident Patch 12: `2c829678` (2026-03-06)
**Commit Message**: Fix typos in telemetry error message and comment (#1265)

Fix spelling typos in telemetry.py. Corrects 'recieved' to 'received'
and 'equest' to 'request' in comments and error messages.

**File**: `src/telemetry/telemetry.py` (modified, +2/-2)
```diff
@@ -33,10 +33,10 @@ def v1_telemetry(telemetry_data: List[Dict[str, str]]):
     except Exception:
         raise HTTPException(
             status_code=500,
-            detail="Could not POST equest to new khoj telemetry server. Contact developer to get this fixed.",
+            detail="Could not POST request to new khoj telemetry server. Contact developer to get this fixed.",
         )
 
-    # Insert recieved telemetry data into SQLite db
+    # Insert received telemetry data into SQLite db
     logger.info(f"Insert row into telemetry table at {sqlfile}: {telemetry_data}")
     with sqlite3.connect(sqlfile) as conn:
         cur = conn.cursor()
```

---

### Incident Patch 13: `5a51f17a` (2026-02-22)
**Commit Message**: Fix AttributeError when Eleven Labs API key is not set (#1238)

## Summary
- Fixes AttributeError: 'str' object has no attribute 'iter_content' in
text_to_speech endpoint
- When `ELEVEN_LABS_API_KEY` is not configured, the function was
returning a string instead of a Response object

## Changes
- Introduced `TextToSpeechError` exception class in `text_to_speech.py`
- Changed `generate_text_to_speech` to raise exception instead of
returning error string
- Updated API endpoint to catch the exception and return HTTP 501 (Not
Implemented)

## Test plan
- [x] Code passes ruff lint check
- [ ] Manual testing with and without Eleven Labs API key configured

Fixes #1049

---------

Signed-off-by: majiayu000 <[REDACTED_EMAIL]>
Co-authored-by: Debanjum <[REDACTED_EMAIL]>

**File**: `src/khoj/processor/speech/text_to_speech.py` (modified, +6/-2)
```diff
@@ -17,12 +17,16 @@ def is_eleven_labs_enabled():
     return ELEVEN_LABS_API_KEY is not None
 
 
+class TextToSpeechError(Exception):
+    """Exception raised when text-to-speech generation fails."""
+
+
 def generate_text_to_speech(
     text_to_speak: str,
     voice_id: str = VOICE_ID,
 ):
     if not is_eleven_labs_enabled():
-        return "Eleven Labs API key is not set"
+        raise TextToSpeechError("Eleven Labs API key is not set")
 
     # Convert the incoming text from markdown format to plain text
     html = markdown_renderer.render(text_to_speak)
@@ -47,4 +51,4 @@ def generate_text_to_speech(
     if response.ok:
         return response
     else:
-        raise Exception(f"Failed to generate text-to-speech: {response.text}")
+        raise TextToSpeechError(f"Failed to generate text-to-speech: {response.text}")
```

**File**: `src/khoj/routers/api_chat.py` (modified, +5/-2)
```diff
@@ -44,7 +44,7 @@
 )
 from khoj.processor.image.generate import text_to_image
 from khoj.processor.operator import operate_environment
-from khoj.processor.speech.text_to_speech import generate_text_to_speech
+from khoj.processor.speech.text_to_speech import TextToSpeechError, generate_text_to_speech
 from khoj.processor.tools.online_search import (
     deduplicate_organic_results,
     read_webpages,
@@ -208,7 +208,10 @@ async def text_to_speech(
     if voice_model:
         params["voice_id"] = voice_model.model_id
 
-    speech_stream = generate_text_to_speech(**params)
+    try:
+        speech_stream = generate_text_to_speech(**params)
+    except TextToSpeechError as e:
+        raise HTTPException(status_code=503, detail=str(e))
     return StreamingResponse(speech_stream.iter_content(chunk_size=1024), media_type="audio/mpeg")
 
 
```

---

### Incident Patch 14: `ff4b9f35` (2025-12-29)
**Commit Message**: Render mermaid diagram wrapped in markdown codeblocks on web app

**File**: `src/interface/web/app/components/chatMessage/chatMessage.tsx` (modified, +46/-0)
```diff
@@ -399,6 +399,43 @@ export function TrainOfThought(props: TrainOfThoughtProps) {
     );
 }
 
+// Clean mermaid chart by removing/fixing invalid syntax patterns
+function cleanMermaidChart(chart: string): string {
+    return chart
+        .split("\n")
+        .filter((line) => !line.trim().match(/^title\s*\[.*\]\s*$/i)) // Remove invalid title[...] lines
+        .map((line) => {
+            // Fix parentheses inside square bracket node labels: [Text (with parens)]
+            // Mermaid interprets () as special syntax, so we need to quote the content
+            // Replace [Label (text)] with ["Label (text)"]
+            return line.replace(/\[([^\]]*\([^\]]*\)[^\]]*)\]/g, '["$1"]');
+        })
+        .join("\n");
+}
+
+// Extract mermaid code blocks from markdown content
+function extractMermaidBlocks(content: string): { cleanedContent: string; mermaidBlocks: string[] } {
+    const mermaidBlocks: string[] = [];
+    // Match ```mermaid ... ``` code blocks
+    // Allow optional whitespace before/after delimiters and handle various line endings
+    const mermaidRegex = /```\s*mermaid\s*\r?\n([\s\S]*?)```/gi;
+
+    const cleanedContent = content.replace(mermaidRegex, (match, mermaidCode) => {
+        const trimmedCode = mermaidCode.trim();
+        if (trimmedCode) {
+            // Clean the mermaid chart before adding
+            const cleanedChart = cleanMermaidChart(trimmedCode);
+            if (cleanedChart.trim()) {
+                mermaidBlocks.push(cleanedChart);
+            }
+        }
+        // Replace with empty string to remove from markdown
+        return "";
+    });
+
+    return { cleanedContent, mermaidBlocks };
+}
+
 const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>((props, ref) => {
     const [copySuccess, setCopySuccess] = useState<boolean>(false);
     const [isHovering, setIsHovering] = useState<boolean>(false);
@@ -408,6 +445,7 @@ const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>((props, ref) =>
     const [interrupted, setInterrupted] = useState<boolean>(false);
     const [excalidrawData, setExcalidrawData] = useState<string>("");
     const [mermaidjsData, setMermaidjsData] = useState<string>("");
+    const [inlineMermaidBlocks, setInlineMermaidBlocks] = useState<string[]>([]);
 
     // State for file content preview on file link click, hover
     const [previewOpen, setPreviewOpen] = useState<boolean>(false);
@@ -472,6 +510,11 @@ const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>((props, ref) =>
             setMermaidjsData(props.chatMessage.mermaidjsDiagram);
         }
 
+        // Extract mermaid blocks from the message content
+        const { cleanedContent, mermaidBlocks } = extractMermaidBlocks(message);
+        message = cleanedContent;
+        setInlineMermaidBlocks(mermaidBlocks);
+
         // Replace file links with base64 data
         message = renderCodeGenImageInline(message, props.chatMessage.codeContext);
 
@@ -1065,6 +1108,9 @@ const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>((props, ref) =>
                 </Dialog>
                 {excalidrawData && <ExcalidrawComponent data={excalidrawData} />}
                 {mermaidjsData && <Mermaid chart={mermaidjsData} />}
+                {inlineMermaidBlocks.map((chart, index) => (
+                    <Mermaid key={`inline-mermaid-${index}`} chart={chart} />
+                ))}
             </div>
             <div className={styles.teaserReferencesContainer}>
                 <TeaserReferencesSection
```

---

### Incident Patch 15: `19900e42` (2026-01-02)
**Commit Message**: Fix registering subscription payment failures

**File**: `src/khoj/routers/api_subscription.py` (modified, +2/-2)
```diff
@@ -52,9 +52,9 @@ async def subscribe(request: Request):
     # Verify product ID if official_product_id is configured
     if official_product_id:
         # Get the product ID from the subscription items
-        subscription_items = subscription.get("items", {}).get("data", [])
+        subscription_items = (subscription.get("items") or subscription.get("lines", {})).get("data", [])
         if not subscription_items:
-            logger.warning(f"No subscription items found for event {event['id']}")
+            logger.warning(f"No subscription lines/items found for event {event['id']}")
             return {"success": False}
 
         # Check if any subscription item matches the official product ID
```

#### Recent Merged Pull Requests:
- **PR #1419** (closed): feat: recognise llmman when naming an OpenAI-compatible provider (@ericcurtin)
- **PR #1390** (closed): feat: Add search support for Notion databases (@SyncWithRaj)
- **PR #1382** (2026-08-02): Stop sending client IP in telemetry so it matches the privacy docs (@kobihikri)
- **PR #1379** (closed): feat: add Tenki Cloud code sandbox provider (@rishijoshi)
- **PR #1376** (closed): Drop client IP (client_host) from usage telemetry payload (@gaurav0107)
- **PR #1373** (closed): docs: add DaoXE OpenAI-compatible gateway guide (@seven7763)
- **PR #1371** (closed): Add MiniMax chat model defaults (@octo-patch)
- **PR #1366** (closed): Update README.md (@chirag127)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
