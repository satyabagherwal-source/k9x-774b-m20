# Forensic Learning Record (Deep Inspection): myshell-ai/AIlice

> **Canonical Artifact**: `07_PROJECT_LEARNING/myshell-ai-ailice-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/myshell-ai/AIlice](https://github.com/myshell-ai/AIlice))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:34:06.512Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `myshell-ai/AIlice`
- **Description**: AIlice is a fully autonomous, general-purpose AI agent.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1419 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ailice/app/static/js/rendering.js`
```
class MediaPlaceholder extends HTMLElement {
    constructor() {
        super();
        this.hasStartedLoading = false;
    }

    connectedCallback() {
        if (this.hasStartedLoading) {
            return;
        }
        this.hasStartedLoading = true;
        this.loadAndReplace();
    }

    async loadAndReplace() {
        const href = this.dataset.href;
        const title = this.dataset.title;
        const text = this.dataset.text;

        try {
            const mediaType = href.startsWith("blob:") ? text :
                await getContentType(convertToProxyURL(href));

            if (!this.isConnected) {
                return;
            }

            let containerHTML = '<div class="media-container" style="position: relative; display: inline-block;">';

            const fileName = href.split('/').pop() || 'file';

            if (mediaType.startsWith('image')) {
                containerHTML += `<img src="${convertToProxyURL(href)}" alt="${text}" title="${title}" 
                    style="max-width: 100%; height: auto; display: block;"
                    onerror="this.onerror=null; this.innerHTML='Failed to load image';">`;
            } else if (mediaType.startsWith('audio')) {
                containerHTML += `<audio controls><source src="${convertToProxyURL(href)}" type="${mediaType}">Your browser does not support the audio element.</audio>`;
            } else if (mediaType.startsWith('video')) {
                containerHTML += `<video controls><source src="${convertToProxyURL(href)}" type="${mediaType}">Your browser does not support the video element.</video>`;
            } else {
                containerHTML += `
                    <div class="file-preview" style="display: flex; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; max-width: 300px;">
                        <div style="font-size: 32px; margin-right: 15px;">📄</div>
                        <div style="overflow: hidden; text-overflow: ellipsis;">
                            <div style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fileName}</div>
                            <div style="font-size: 12px; color: #666;">Click to Download</div>
                        </div>
                    </div>`;
            }

            containerHTML += `
                <button class="download-media-btn" data-href="${convertToProxyURL(href)}" data-filename="${fileName}">
                    <span class="download-icon">⬇️</span>Download
                </button>
            </div>`;

            if (this.isConnected) {
                this.outerHTML = containerHTML;

                setTimeout(() => {
                    document.querySelectorAll('.download-media-btn').forEach(btn => {
                        if (!btn.hasListener) {
                            btn.hasListener = true;
                            btn.addEventListener('click', function (e) {
                                e.stopPropagation();
                                const url = this.getAttribute('data-href');
                                const fileName = this.getAttribute('data-filename');
                                downloadMedia(url, fileName);
                            });
                        }
                    });
                }, 0);
            }
        } catch (error) {
            console.error('Error loading media:', error);
            if (this.isConnected) {
                this.innerHTML = 'Failed to load media';
                this.style.color = 'red';
            }
        }
    }
}

customElements.define('media-placeholder', MediaPlaceholder);


function convertToProxyURL(href) {
    if (href.startsWith("/proxy?href=")) {
        return href
    }
    else if (href.startsWith("blob:")) {
        return href
    }
    else {
        const encodedURL = encodeURIComponent(href);
        return `/proxy?href=${encodedURL}`;
    }
}


async function getContentType(url) {
    try {
        const extension = url.split('.').pop().toLowerCase();
        if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'aiff', 'wma', 'opus', 'ra', 'mid'].includes(extension)) {
            return `audio/${extension}`;
        } else if (['mp4', 'webm', 'ogg', 'wmv', 'mov', 'avi', 'flv', 'mkv', 'mpeg', 'vob', 'rm', '3gp', 'ogv', 'm4v', 'h264', 'ts', 'm2ts', 'divx'].includes(extension)) {
            return `video/${extension}`;
        } else if (['jpg', 'jpeg', 'bmp', 'png', 'gif', 'tiff', 'tif', 'webp', 'svg', 'heif', 'heic', 'raw'].includes(extension)) {
            return `image/${extension}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            return response.headers.get("Content-Type");
        }
        throw new Error("Failed to fetch Content-Type");
    } catch (error) {
        console.error("Error getting content type:", error);
        return "";
    }
}

function mathsExpression(expr, force) {
    if (expr.match(/^\$\$[\s\S]*\$\$$/)) {
        expr = expr.substr(2, expr.length - 4);
        return [`$$${expr}$$`, true];
    } else if (expr.match(/^\$[\s\S]*\$$/)) {
        expr = expr.substr(1, expr.length - 2);
        return [`\\(${expr}\\)`, true];
    } else if (force) {
        return [`$$${expr}$$`, true];
    }
    else {
        return [expr, false]
    }
}

function downloadMedia(url, fileName) {
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const a = document.createElement('a');
            const objectUrl = URL.createObjectURL(blob);
            a.href = objectUrl;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(objectUrl);
        })
        .catch(error => {
            console.error('Error downloading media:', error);
            alert('Failed to download media');
        });
}
```

### Core Architecture Module: `ailice/app/static/js/state_machine.js`
```
import { createMachine, createActor } from 'https://cdn.jsdelivr.net/npm/xstate@5.19.2/+esm';

function createUIStateMachine(initialState) {
    return createMachine({
        id: 'ui',
        initial: initialState,
        states: {
            busy: {
                on: {
                    READY: { target: 'ready' },
                    SETUP: { target: 'ready' }
                }
            },
            ready: {
                on: {
                    INPUT: { target: 'update' },
                    LOAD: { target: 'busy' },
                    DELETE: { target: 'busy' },
                    SETUP: { target: 'ready' }
                }
            },
            update: {
                on: {
                    RESPOND: { target: 'ready' },
                    INTERRUPT: { target: 'interrupt' },
                    STOP: { target: 'stop' },
                    SETUP: { target: 'ready' }
                }
            },
            interrupt: {
                on: {
                    INPUT: { target: 'update' },
                    STOP: { target: 'stop' },
                    SETUP: { target: 'ready' }
                }
            },
            stop: {
                on: {
                    RESPOND: { target: 'ready' },
                    LOAD: { target: 'busy' },
                    SETUP: { target: 'ready' }
                }
            }
        }
    });
}

function updateUI(state) {
    try {
        console.log("updateUI called with state:", state.value);
        document.getElementById('new-chat-button').disabled = (!state.matches('ready') && !state.matches('stop'));
        document.getElementById('text-input').disabled = (!state.matches('ready') && !state.matches('interrupt'));
        //document.getElementById('audio-button').disabled = (!state.matches('ready') && !state.matches('interrupt'));
        document.getElementById('file-button').disabled = (!state.matches('ready') && !state.matches('interrupt'));

        document.getElementById('interrupt-button').style.display = ((state.matches('update') || state.matches('interrupt')) ? 'inline-block' : 'none');
        document.getElementById('stop-button').disabled = !((state.matches('update') || state.matches('interrupt')));
        document.getElementById('stop-button').style.display = ((state.matches('update') || state.matches('interrupt')) ? 'inline-block' : 'none');

        var menubtns = document.getElementsByClassName('menu-button');
        for (var i = 0; i < menubtns.length; i++) {
            menubtns[i].disabled = !state.matches('ready');
        }

        var historyItems = document.getElementsByClassName('history-item');
        if (!state.matches('ready') && !state.matches('stop')) {
            for (var i = 0; i < historyItems.length; i++) {
                if (historyItems[i].historyClickHandler) {
                    historyItems[i].removeEventListener('click', historyItems[i].historyClickHandler);
                }
            }
        } else {
            for (var i = 0; i < historyItems.length; i++) {
                if (historyItems[i].historyClickHandler) {
                    historyItems[i].addEventListener('click', historyItems[i].historyClickHandler);
                }
            }
        }

        if (state.matches('ready')) {
            document.getElementById('text-input').placeholder = "Type a message... (Markdown/LaTeX/code highlighting Supported. Shift+Enter for new line)";
            collapseHistoryPanel();
        }

        if (state.matches('update')) {
            document.getElementById('interrupt-button').textContent = '⏹️';
            expandHistoryPanel();
        }

        if (state.matches('interrupt')) {
            document.getElementById('text-input').placeholder = "Send a message to the currently active agent.";
            document.getElementById('interrupt-button').textContent = 'Send';
        }
    } catch (e) {
        console.error("updateUI FAILED. Exception: ", e);
    }
}

export const uiController = {
    actor: null,

    init(initState = 'ready') {
        if (this.actor) {
            this.actor.stop();
        }
        
        const uiMachine = createUIStateMachine(initState);
        this.actor = createActor(uiMachine);
        
        this.actor.subscribe((state) => {
            updateUI(state);
        });
        
        this.actor.start();
        console.log("State machine started with state: ", initState);
        updateUI(this.actor.getSnapshot());
    }
};
```

### Core Architecture Module: `ailice/common/utils/AFileUtils.py`
```

def LoadTXTFile(path: str) -> str:
    ret = ""
    with open(path,'r') as file:
        ret += file.read()
    return ret
```

### Core Architecture Module: `ailice/common/utils/ALogger.py`
```
from termcolor import colored
import queue

from ailice.common.AConfig import config

class ALogger():
    def __init__(self, speech):
        self.colorMap = {'CONTEXT': 'blue', 'USER': 'green', 'ASSISTANT': 'green', 'SYSTEM': 'yellow', 'OUTPUT': 'green'}
        self.depth = -1
        self.speech = speech
        self.queue = queue.Queue()
        return
    
    def ParseChannel(self, channel: str) -> tuple[str]:
        if channel in ["<", ">"]:
            return channel, ""
        l = channel.find("_")
        channelType, agentName = channel[:l], channel[l+1:]
        return channelType, agentName
    
    def SinkPrint(self, channel: str, txt: str = None, action: str = ''):
        channelType, agentName = self.ParseChannel(channel)
        if 'open' == action:
            print(colored(channel + ": ", self.colorMap[channelType]), txt, end="", flush=True)
        elif 'append' == action:
            print(txt, end="", flush=True)
        elif 'close' == action:
            print(txt, end="", flush=True)
            print("")
        else:
            print(colored(channel + ": ", self.colorMap[channelType]), txt)
        return
    
    def SinkSpeech(self, channel: str, txt: str = None, action: str = ''):
        if self.speech:
            self.speech.Speak(txt)
        return
    
    def SinkQueue(self, channel: str, txt: str = None, action: str = ''):
        self.queue.put((channel, txt, action))
        return

    def Receiver(self, channel: str, txt: str = None, action: str = ''):
        braketMap = {"<": 1, ">": -1}
        self.depth += (braketMap[channel] if channel in braketMap else 0)
        
        channelType, _ = self.ParseChannel(channel)
        if (channelType in ["ASSISTANT", "SYSTEM"]):
            self.SinkPrint(channel=channel, txt=txt, action=action)
        if config.speechOn and ((channelType in ["ASSISTANT"]) and (0 == self.depth)):
            self.SinkSpeech(channel=channel, txt=txt, action=action)
        if ((channelType in ["ASSISTANT", "SYSTEM", "<", ">"]) or (0 >= self.depth)):
            self.SinkQueue(channel=channel, txt=txt, action=action)
        return
    
class ALoggerSection:
    def __init__(self, recv):
        self.recv = recv
        return
    
    def __enter__(self):
        self.recv("<")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.recv(">")
        return False
    
    def __call__(self, channel: str, txt: str = None, action: str = ""):
        return self.recv(channel, txt, action)
    
class ALoggerMsg:
    def __init__(self, recv, channel):
        self.recv = recv
        self.channel = channel
        return
    
    def __enter__(self):
        self.recv(channel = self.channel, txt = "", action = "open")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.recv(channel = self.channel, txt = "", action = "close")
        return False
    
    def __call__(self, txt: str):
        return self.recv(channel = self.channel, txt = txt, action = "append")
    
```

### Core Architecture Module: `ailice/common/utils/ATextSpliter.py`
```
import re

def sentences_split(paragraph):
    for sent in re.split(r'(?<=[?。；，\.\?\;\,])', paragraph, flags=re.U):
        yield sent

def paragraph_generator(text):
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    for paragraph in paragraphs:
        yield paragraph
```

### Core Architecture Module: `ailice/core/AConversation.py`
```
import re
import time
import random
import concurrent.futures

from typing import Any
from ailice.common.ADataType import typeInfo, GuessMediaType, ToJson, FromJson, AImageLocation, AVideoLocation


class AConversations():
    def __init__(self, proxy):
        self.proxy = proxy
        self.conversations: list[dict] = []
        return
    
    def Add(self, role: str, msg: str, env: dict[str,Any], entry: bool = False):
        msg = "<EMPTY MSG>" if ("" == msg) else msg
        record = {"role": role, "time": time.time(), "entry": entry, "msg": msg, "attachments": []}
        
        if role in ["USER", "SYSTEM"]:
            matches = re.findall(r"```(\w*)\n([\s\S]*?)```", msg)
            vars = []
            for language, code in matches:
                varName = f"code_{language}_{str(random.randint(0,10000))}"
                env[varName] = code
                vars.append(varName)
            if 0 < len(vars):
                record['msg'] += f"\nSystem notification: The code snippets within the triple backticks in this message have been saved as variables, in accordance with their order in the text, the variable names are as follows: {vars}\n"
            
            matches = [m for m in re.findall(r"(!\[([^\]]*?)\]\((.*?)\)(?:<([a-zA-Z0-9_\-&]+)>)?)", msg)]
            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = [executor.submit(self.ProcessMultimodalTags, m, param, label, env) for m, txt, param, label in matches]
                for future, match in zip(concurrent.futures.as_completed(futures), matches):
                    try:
                        m, txt, param, label = match
                        result = future.result()
                        if isinstance(result, Exception):
                            msgNew = msg.replace(m, f"{m}\n(System notification: Unable to get multimodal content: {e})")
                            record["msg"] = msgNew
                        elif None != result:
                            record["attachments"].append(result)
                    except Exception as e:
                        record["msg"] += f"\nSystem notification: Exception encountered while processing multimodal tags: {str(e)}"

        self.conversations.append(record)
        return
    
    def ProcessMultimodalTags(self, m, param, label, env):
        if ("&" == label):
            if ("" == param) or (param not in env):
                raise ValueError(f"variable name ({param}) not defined.")
            return {"type": typeInfo[type(env[param])]['modal'], "tag": m, "content": env[param].Standardize()}
        elif "" != label:
            targetType = [t for t in typeInfo if (t.__name__ == label)]
            if 0 == len(targetType):
                raise ValueError(f"modal type: {label} not found. supported modal type list: {[str(t.__name__) for t in typeInfo]}. please check your input.")
            else:
                return {"type": typeInfo[targetType[0]]['modal'], "tag": m, "content": targetType[0](param).Standardize()}
        else:
            mimeType = GuessMediaType(param)
            if "image" in mimeType:
                return {"type": "image", "tag": m, "content": AImageLocation(urlOrPath=param).Standardize(self.proxy)}
            elif "video" in mimeType:
                return {"type": "video", "tag": m, "content": AVideoLocation(urlOrPath=param).Standardize(self.proxy)}
            return
    
    def LatestEntry(self):
        for i in range(len(self.conversations)):
            if self.conversations[-i-1]['entry']:
                break
        return (-(i+1)//2) if ('ASSISTANT' == self.conversations[-1]['role']) else ((-i-2)//2)
    
    def GetConversations(self, frm=0):
        s = (2*frm) if (frm >= 0) or ('ASSISTANT' == self.conversations[-1]['role']) else (2*frm+1)
        return self.conversations[s:]
    
    def __len__(self):
        return (len(self.conversations)+1) // 2
    
    def FromJson(self, data):
        def AddRecord(role, time, entry, msg, attachments):
            self.conversations.append({'role': role,
                                       'time': time,
                                       'entry': entry,
                                       'msg': msg,
                                       'attachments': attachments})
        for i in range(0, len(data)):
            d = data[i]
            if i > 0:
                assert not ({d['role'], data[i-1]['role']} <= {"ASSISTANT"}), f"Consecutive ASSISTANT messages were found in conversations. {str(d)}, {str(data[i-1])}"
                if {d['role'], data[i-1]['role']} <= {"USER", "SYSTEM"}:
                    AddRecord('ASSISTANT', None, False, '<EMPTY MSG>', [])
            AddRecord(d['role'], d.get('time', None), d.get('entry', None), d['msg'] if '' != d['msg'] else '<EMPTY MSG>', [{'type': a['type'], 'tag': a.get('tag', None), 'content': FromJson(a['content'])} for a in d['attachments']])
        if (len(data) > 0) and (data[-1]['role'] in ['USER', 'SYSTEM']):
            AddRecord('ASSISTANT', None, False, '<EMPTY MSG>', [])
        return
    
    def ToJson(self) -> str:
        return [{'role': record['role'],
                 'time': record['time'],
                 'entry': record['entry'],
                 'msg': record['msg'],
                 'attachments': [{'type': a['type'],
                                  'tag': a['tag'],
                                  'content': ToJson(a['content'])} for a in record['attachments']]} for record in self.conversations]
```

### Core Architecture Module: `ailice/core/AInterpreter.py`
```
import re
import inspect
import random
import ast
import traceback
from typing import Any
from ailice.common.AExceptions import AExceptionOutofGas, AExceptionStop
from ailice.common.ADataType import typeInfo, ToJson, FromJson
from ailice.prompts.ARegex import GenerateRE4FunctionCalling, GenerateRE4ObjectExpr, ARegexMap, VAR_DEF, EXPR_OBJ

def HasReturnValue(action):
    return action['signature'].return_annotation != inspect.Parameter.empty

class AInterpreter():
    def __init__(self, messenger):
        self.actions = {}#nodeType: {"func": func}
        self.patterns = []#[{nodeType,re,isEntry,noTrunc,priority}]
        self.env = {}
        self.messenger = messenger

        self.RegisterPattern("_STR", f"(?P<txt>({ARegexMap['str']}))", False)
        self.RegisterPattern("_INT", f"(?P<txt>({ARegexMap['int']}))", False)
        self.RegisterPattern("_FLOAT", f"(?P<txt>({ARegexMap['float']}))", False)
        self.RegisterPattern("_BOOL", f"(?P<txt>({ARegexMap['bool']}))", False)
        self.RegisterPattern("_VAR", VAR_DEF, True)
        self.RegisterPattern("_PRINT", GenerateRE4FunctionCalling("PRINT<!|txt: str|!> -> str", faultTolerance = True), True)
        self.RegisterAction("_PRINT", {"func": self.EvalPrint})
        self.RegisterPattern("_VAR_REF", f"(?P<varName>({ARegexMap['ref']}))", False)
        self.RegisterPattern("_EXPR_CAT", f"(?P<expr>({ARegexMap['expr_cat']}))", False)
        for dataType in typeInfo:
            if not typeInfo[dataType]["tag"]:
                continue
            self.RegisterPattern(f"_EXPR_OBJ_{dataType.__name__}", GenerateRE4ObjectExpr([(fieldName, fieldInfo.annotation.__name__) for fieldName, fieldInfo in dataType.model_fields.items()], dataType.__name__, faultTolerance=True), False)
            self.RegisterAction(f"_EXPR_OBJ_{dataType.__name__}", {"func": self.CreateObjCB(dataType)})
        self.RegisterPattern("_EXPR_OBJ_DEFAULT", EXPR_OBJ, False)
        self.RegisterAction("_EXPR_OBJ_DEFAULT", {"func": self.EvalObjDefault, "noEval": ["typeBra", "typeKet"]})
        return
    
    def RegisterAction(self, nodeType: str, action: dict):
        signature = inspect.signature(action["func"])
        if not all([param.annotation != inspect.Parameter.empty for param in signature.parameters.values()]):
            print("Need annotations in registered function. node type: ", nodeType)
            exit()
        self.actions[nodeType] = {k:v for k,v in action.items()}
        self.actions[nodeType]["signature"] = signature
        return
    
    def RegisterPattern(self, nodeType: str, pattern: str, isEntry: bool, noTrunc: bool = False, priority: int = 0):
        p = {"nodeType": nodeType, "re": pattern, "isEntry": isEntry, "noTrunc": noTrunc, "priority": priority}
        if pattern not in [p["re"] for p in self.patterns]:
            loc = 0
            for loc in range(0, len(self.patterns)):
                if self.patterns[loc]["priority"] > priority:
                    break
            self.patterns.insert(loc, p)
        return
    
    def CreateVar(self, content: Any, basename: str, dynamicSuffix: bool = True) -> str:
        if dynamicSuffix and (basename not in self.env):
            varName = basename
        else:
            varName = f"{basename}_{type(content).__name__}_{str(random.randint(0,999999))}"
        self.env[varName] = content
        return varName
    
    def EndChecker(self, txt: str) -> bool:
        endPatterns = [p['re'] for p in self.patterns if p['isEntry'] and (not p['noTrunc']) and (HasReturnValue(self.actions[p['nodeType']]) if p['nodeType'] in self.actions else False)]
        return any([bool(re.findall(pattern, txt, re.DOTALL)) for pattern in endPatterns]) or (None != self.messenger.Get())
    
    def GetEntryPatterns(self) -> dict[str,str]:
        return [(p['nodeType'], p['re']) for p in self.patterns if p["isEntry"]]
    
    def Parse(self, txt: str) -> tuple[str,dict[str,str]]:
        for p in self.patterns:
            m = re.fullmatch(p['re'], txt, re.DOTALL)
            if m:
                return (p['nodeType'], m.groupdict())
        return (None, None)

    def CallWithTextArgs(self, nodeType, txtArgs) -> Any:
        action = self.actions[nodeType]
        #print(f"action: {action}, {txtArgs}")
        signature = action["signature"]
        if set(txtArgs.keys()) != set(signature.parameters.keys()):
            return "The function call failed because the arguments did not match. txtArgs.keys(): " + str(txtArgs.keys()) + ". func params: " + str(signature.parameters.keys())
        paras = dict()
        for k,v in txtArgs.items():
            paras[k] = v if (k in action.get("noEval", [])) else self.Eval(v)
            if type(paras[k]) != signature.parameters[k].annotation:
                raise TypeError(f"parameter {k} should be of type {signature.parameters[k].annotation.__name__}, but got {type(paras[k]).__name__}.")
        return action['func'](**paras)
    
    def Eval(self, txt: str) -> Any:
        nodeType, paras = self.Parse(txt)
        if None == nodeType:
            return txt
        elif "_STR" == nodeType:
            return self.EvalStr(txt)
        elif "_INT" == nodeType:
            return int(txt)
        elif "_FLOAT" == nodeType:
            return float(txt)
        elif "_BOOL" ==nodeType:
            return {"true": True, "false": False}[txt.strip().lower()]
        elif "_VAR" == nodeType:
            return self.EvalVar(varName=paras['varName'], content=self.Eval(paras['content']))
        elif "_VAR_REF" == nodeType:
            return self.EvalVarRef(txt)
        elif "_EXPR_CAT" == nodeType:
            return self.EvalExprCat(txt)
        else:
            return self.CallWithTextArgs(nodeType, paras)

    def ParseEntries(self, txt_input: str) -> list[str]:
        ms = {}
        for nodeType, pattern in self.GetEntryPatterns():
            for match in re.finditer(pattern, txt_input, re.DOTALL):
                ms[(match.start(), match.end())] = match
        matches = sorted(list(ms.values()), key=lambda match: match.start())
        
        ret = []
        for match in matches:
            isSubstring = any(
                (m.start() <= match.start()) and (m.end() >= match.end()) and (m is not match)
                for m in matches
            )
            if not isSubstring:
                ret.append(match.group(0))
        return ret

    def EvalEntries(self, txt: str) -> str:
        scripts = self.ParseEntries(txt)
        resp = ""
        try:
            for script in scripts:
                r = self.Eval(script)
                r = self.ConvertToText(r)

                if r not in ["", None]:
                    resp += (r + "\n\n")
        except SyntaxError as e:
            resp += f"EXCEPTION: {str(e)}\n{traceback.format_exc()}\n"
            if "unterminated string literal" in str(e):
                resp += "Please check if there are any issues with your string syntax. For instance, are you using a newline within a single-quoted string? Or should you use triple quotes to avoid error-prone escape sequences?"
        except AExceptionStop as e:
            raise e
        except AExceptionOutofGas as e:
            resp += "The current task has run out of gas and has been terminated. Please ask the user to help recharge gas."
        except Exception as e:
            resp += f"EXCEPTION: {str(e)}\n{e.tb if hasattr(e, 'tb') else traceback.format_exc()}"
        return resp

    def EvalStr(self, txt: str) -> str:
        return ast.literal_eval(txt)
    
    def EvalVarRef(self, varName: str) -> Any:
        if varName in self.env:
            return self.env[varName]
        else:
            raise ValueError(f'Variable name {varName} NOT FOUND, did you mean to use a string "{varName}" but forgot the quotation marks?')

    def EvalVar(self, varName: str, content: Any):
        self.env[varName] = content
        return
    
    def EvalExprCat(self, expr: str) -> str:
        pattern = f"{ARegexMap['str']}|{ARegexMap['ref']}"
        ret = ""
        for match in re.finditer(pattern, expr):
            ret += self.Eval(match.group(0))
        return ret
    
    def EvalObjDefault(self, typeBra: str, args: str, typeKet: str) -> Any:
        if typeBra != typeKet:
            raise ValueError(f"The left and right types in braket should be the same. But in fact the left side is ({typeBra}), and the right side is ({typeKet}). Please correct your syntax.")
        if typeBra not in [t.__name__ for t in typeInfo.keys()]+['&', '!']:
            raise ValueError(f"The specified object type ({typeBra}) is not supported. Please check your input.")
        if "!" == typeBra.strip():
            return args
        elif "&" == typeBra.strip():
            return self.env.get(args.strip())
        else:
            raise ValueError(f"It looks like you are trying to create an object of type ({typeBra}), but syntax parsing fails for unrecognized reasons. Please check your syntax.")
    
    def EvalPrint(self, txt: str) -> str:
        return txt
    
    def CreateObjCB(self, dataType):
        def callback(*args,**kwargs):
            return dataType(*args,**kwargs)
        newSignature = inspect.Signature(parameters=[inspect.Parameter(name=t.name, kind=inspect.Parameter.POSITIONAL_OR_KEYWORD, annotation=t.annotation) for p,t in inspect.signature(dataType.__init__).parameters.items() if t.name != 'self'],
                                         return_annotation=dataType)
        callback.__signature__ = newSignature
        return callback
    
    def ConvertToText(self, r) -> str:
        if (type(r) == str) or (r is None):
            return r
        elif type(r) in typeInfo:
            varName = self.CreateVar(content=r, basename="ret")
            return f"![Returned data is stored to variable: {varName} := {str(r)}]({varName})<&>"
        elif type(r) == list:
            return f"{str([self.ConvertToText(item) for item in r])}"
        elif
```

### Core Architecture Module: `ailice/core/AProcessor.py`
```
import sys
import string
import secrets
import importlib
import time
import inspect
import re
import random
import json
from ailice.common.AExceptions import AExceptionStop
from ailice.common.AGas import AGasTank
from ailice.common.utils.ALogger import ALoggerSection, ALoggerMsg
from ailice.core.AConversation import AConversations
from ailice.core.AInterpreter import AInterpreter
from ailice.prompts.ARegex import GenerateRE4FunctionCalling, FUNCTION_CALL_DEFAULT


class AProcessor():
    def __init__(self, name, modelID, promptName, llmPool, promptsManager, services, messenger, outputCB, gasTank, config, collection = None):
        self.name = name
        self.modelID = modelID
        self.llmPool = llmPool
        self.llm = llmPool.GetModel(modelID, promptName)
        self.promptsManager = promptsManager
        self.services = services
        self.messenger = messenger
        self.interpreter = AInterpreter(messenger)
        self.conversation = AConversations(proxy=services["computer"].Proxy)
        self.subProcessors = dict()
        self.modules = {}
        self.outputCB = outputCB
        self.gasTank = gasTank
        self.config = config
        self.collection = "ailice" + str(time.time()) if collection is None else collection
        
        self.RegisterModules([config.services['storage']['addr']])
        self.interpreter.RegisterAction("CALL", {"func": self.EvalCall})
        self.interpreter.RegisterAction("RESPOND", {"func": self.EvalRespond})
        self.interpreter.RegisterAction("RETURN", {"func": self.Return})
        self.interpreter.RegisterAction("STORE", {"func": self.EvalStore})
        self.interpreter.RegisterAction("QUERY", {"func": self.EvalQuery})
        self.interpreter.RegisterAction("WAIT", {"func": self.EvalWait})
        self.interpreter.RegisterAction("DEFINE-CODE-VARS", {"func": self.DefineCodeVars})
        self.interpreter.RegisterAction("LOADEXTMODULE", {"func": self.LoadExtModule})
        self.interpreter.RegisterAction("LOADEXTPROMPT", {"func": self.LoadExtPrompt})
        
        self.prompt = promptsManager[promptName](processor=self, storage=self.modules['storage']['module'], collection=self.collection, conversations=self.conversation, formatter=self.llm.formatter, config=self.config, outputCB=self.outputCB)
        self.result = "None."

        self.modules['storage']['module'].Store(self.collection + "_functions", json.dumps({"module": "core",
                                                                                            "action": "LOADEXTMODULE",
                                                                                            "signature": "LOADEXTMODULE<!|addr: str|!> -> str",
                                                                                            "prompt": "Load the ext-module and get the list of callable functions in it. addr is a service address in the format protocol://ip:port.",
                                                                                            "type": "primary"}))
        self.modules['storage']['module'].Store(self.collection + "_functions", json.dumps({"module": "core",
                                                                                            "action": "LOADEXTPROMPT",
                                                                                            "signature": "LOADEXTPROMPT<!|path: str|!> -> str",
                                                                                            "prompt": "Load ext-prompt from the path pointing to python source code file, which include available new agent type.",
                                                                                            "type": "primary"}))
        return
    
    def RegisterAction(self, nodeType: str, action: dict):
        self.interpreter.RegisterAction(nodeType, action)
        return
    
    def RegisterModules(self, moduleAddrs):
        ret = []
        modules = {}
        funcList = []
        actions = {}
        for moduleAddr in moduleAddrs:
            module = self.services.GetClient(moduleAddr)
            if (not hasattr(module, "ModuleInfo")) or (not callable(getattr(module, "ModuleInfo"))):
                raise Exception("EXCEPTION: ModuleInfo() not found in module.")
            info = module.ModuleInfo()
            if "NAME" not in info:
                raise Exception("EXCEPTION: 'NAME' is not found in module info.")
            if "ACTIONS" not in info:
                raise Exception("EXCEPTION: 'ACTIONS' is not found in module info.")
            
            modules[info['NAME']] = {'addr': moduleAddr, 'module': module}
            for actionName, actionMeta in info["ACTIONS"].items():
                sig = actionName + str(inspect.signature(getattr(module, actionMeta['func']))).replace('(', '<!|').replace(')', '|!>')
                ret.append({"action": actionName, "signature": sig, "prompt": actionMeta["prompt"]})
                actions[actionName] = {"func": self.CreateActionCB(actionName, module, actionMeta["func"])}
                funcList.append(json.dumps({"module": info["NAME"], "action": actionName, "signature": sig, "prompt": actionMeta["prompt"], "type": actionMeta["type"]}))
        self.modules.get('storage', modules.get('storage', None))['module'].Store(self.collection + "_functions", funcList)
        for actionName, action in actions.items():
            self.RegisterAction(nodeType=actionName, action=action)
        self.modules.update(modules)
        return ret
    
    def CreateActionCB(self, actionName, module, actionFunc):
        func = getattr(module, actionFunc)
        def callback(*args,**kwargs):
            return func(*args,**kwargs)
        newSignature = inspect.Signature(parameters=[inspect.Parameter(name=t.name, kind=inspect.Parameter.POSITIONAL_OR_KEYWORD, annotation=t.annotation) for p,t in inspect.signature(func).parameters.items()],
                                         return_annotation=inspect.signature(func).return_annotation)
        callback.__signature__ = newSignature
        return callback
        
    def GetPromptName(self) -> str:
        return self.prompt.PROMPT_NAME
    
    def SetGas(self, amount: int):
        self.gasTank.Set(amount)
        return
    
    def Prepare(self):
        self.RegisterModules(set(self.services.pool) - set([d['addr'] for name, d in self.modules.items()]))
        for nodeType, action in self.prompt.GetActions().items():
            self.interpreter.RegisterAction(nodeType, action)
        for nodeType, patterns in self.prompt.GetPatterns().items():
            for p in patterns:
                self.interpreter.RegisterPattern(nodeType, p["re"], p["isEntry"])
        self.interpreter.RegisterPattern("_FUNCTION_CALL_DEFAULT", FUNCTION_CALL_DEFAULT, True, True, 99999999)
        self.interpreter.RegisterAction("_FUNCTION_CALL_DEFAULT", {"func": self.EvalFunctionCallDefault, "noEval": ["funcName", "paras"]})
        return
    
    def SaveMsg(self, role: str, msg: str, storeMsg: str = None, logMsg: str = None, logger = None, entry: bool = False):
        self.conversation.Add(role=role, msg=msg, env=self.interpreter.env, entry=entry)
        if storeMsg:
            self.EvalStore(storeMsg)
        if logMsg and logger:
            logger(f"{role}_{self.name}", logMsg)
        return
    
    def __call__(self, txt: str) -> str:
        self.SaveMsg(role="USER", msg=txt, storeMsg=txt, entry=True)
        
        with ALoggerSection(recv=self.outputCB) as loggerSection:
            loggerSection(f"USER_{self.name}", txt)

            while True:
                self.Prepare()
                prompt = self.prompt.BuildPrompt()
                try:
                    with ALoggerMsg(recv=self.outputCB, channel="ASSISTANT_" + self.name) as loggerMsg:
                        ret = self.llm.Generate(prompt, proc=loggerMsg, endchecker=self.interpreter.EndChecker, temperature = self.config.temperature, gasTank = self.gasTank)
                except Exception as e:
                    ret = f"An exception was encountered while generating the reply message. EXCEPTION:\n\n{str(e)}"
                    self.SaveMsg(role="ASSISTANT", msg=ret, storeMsg=ret)
                    raise e
                ret = "System notification: The empty output was detected, which is usually caused by an agent error. You can urge it to resolve this issue and return meaningful information." if "" == ret.strip() else ret
                self.SaveMsg(role="ASSISTANT", msg=ret, storeMsg=ret)
                self.result = ret
                
                try:
                    msg = self.messenger.GetPreviousMsg()
                    if (str == type(msg)) and ("/stop" == msg.strip()):
                        raise AExceptionStop()
                    elif msg != None:
                        resp = f"Interruption. Reminder from super user: {msg}"
                        self.SaveMsg(role="SYSTEM", msg=resp, storeMsg=resp, logMsg=resp, logger=loggerSection)
                        continue
                    
                    resp = self.interpreter.EvalEntries(ret)
                    
                    if "" != resp:
                        self.interpreter.EvalVar(varName="returned_content_in_last_function_call", content=resp)
                        m = "This is a system-generated message. Since the function call in your previous message has returned information, the response to this message will be handled by the backend system instead of the user. Meanwhile, your previous message has been marked as private and has not been sent to the user. Function returned: {" + resp + "}\n\nThe returned text has been automatically saved to variable 'returned_content_in_last_function_call' for quick reference."
                        self.SaveMsg(role="SYSTEM", msg=m, storeMsg="Function returned: {" + resp + "}", logMsg=resp, logger=loggerSection)
                    else:
        
```

### Core Architecture Module: `ailice/core/llm/AFormatter.py`
```
import copy
import inspect
import io
import av
from ailice.common.ADataType import AImage
from ailice.core.llm.ATokenEstimator import TokenEstimatorOAI

class AFormatterVicuna():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        sep = {"USER": " ", "ASSISTANT": "</s>", "SYSTEM": " "}
        roleMap = {"USER": "USER", "ASSISTANT": "ASSISTANT", "SYSTEM": "SYSTEM" if not self.systemAsUser else "USER"}
        ret = prompt0 + "\n" + "".join([roleMap[c['role']] + ": " + c['msg'] + sep[roleMap[c['role']]] for c in conversations]) + (" ASSISTANT:" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))
    
class AFormatterLLAMA2():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        B_INST="[INST]"
        E_INST="[/INST]"
        B_SYS="<<SYS>>\n"
        E_SYS="\n<</SYS>>\n\n"
        
        roleMap = {"USER": "USER", "ASSISTANT": "ASSISTANT", "SYSTEM": "SYSTEM" if not self.systemAsUser else "USER"}
        conv = [{'role': roleMap[c['role']], 'msg': c['msg']} for c in copy.deepcopy(conversations)]
        
        conv[0]['msg'] = (B_SYS + prompt0 + E_SYS + conv[0]["msg"]) if self.systemAsUser or ("SYSTEM" != conv[0]['role']) else (prompt0 + conv[0]["msg"])
        conv = [{"role": c["role"], "msg": B_SYS + c["msg"] + E_SYS} if "SYSTEM" == c["role"] else c for c in conv]

        assert len(conversations) % 2 == 1, "conversations has an even length. "
        
        self.tokenizer.add_bos_token=True
        self.tokenizer.add_eos_token=True
        
        tokens = sum([self.tokenizer.encode(f"{B_INST} {prompt['msg'].strip()} {E_INST} {answer['msg'].strip()} ") for prompt,answer in zip(conv[0::2], conv[1::2])],
                    [])
        if assistTag and (1 == (len(conv) % 2)):
            self.tokenizer.add_bos_token=True
            self.tokenizer.add_eos_token=False
            tokens += self.tokenizer.encode(f"{B_INST} {conv[-1]['msg'].strip()} {E_INST}")
        #print("\n prompt: ", self.tokenizer.decode(ret))
        if not encode:
            ret = sum([f"{B_INST} {prompt['msg'].strip()} {E_INST} {answer['msg'].strip()} " for prompt,answer in zip(conv[0::2], conv[1::2])],
                        [])
            if assistTag and (1 == (len(conv) % 2)):
                ret += f"{B_INST} {conv[-1]['msg'].strip()} {E_INST}"
            #print("\n prompt: ", ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterLLAMA3():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.roles={'USER': "user", 'ASSISTANT': "assistant", 'SYSTEM': "system"}
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def BuildMsg(self, role: str, msg: str):
        if self.systemAsUser and "SYSTEM" == role:
            role = "USER"
        return f"<|start_header_id|>{self.roles[role]}<|end_header_id|>\n{msg}<|eot_id|>"
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        ret = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n{prompt0}<|eot_id|>" + "".join([self.BuildMsg(c["role"], c["msg"]) for c in conversations]) + (f"<|start_header_id|>{self.roles['ASSISTANT']}<|end_header_id|>\n" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))
    
class AFormatterSimple():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser

    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        roleMap={'USER': 'User', 'ASSISTANT': 'Assistant', 'SYSTEM': 'System' if not self.systemAsUser else "User"}
        seps={'USER': "\n", 'ASSISTANT': "\n", 'SYSTEM': "\n"}

        ret = prompt0 + "\n" + "".join([f"### {roleMap[c['role']]}:\n{c['msg']}{seps[c['role']]}" for c in conversations]) + (f"### {roleMap['ASSISTANT']}:\n" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterChatML():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.START = "<|im_start|>"
        self.END = "<|im_end|>"
        self.roles={'USER': 'user', 'ASSISTANT': 'assistant', 'SYSTEM': 'system'}
        self.left={'USER': self.START, 'ASSISTANT': self.START, 'SYSTEM': self.START}
        self.right={'USER': self.END + "\n", 'ASSISTANT': self.END  + "\n", 'SYSTEM': self.END  + "\n"}
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def BuildMsg(self, role: str, msg: str):
        if self.systemAsUser and "SYSTEM" == role:
            role = "USER"
        return f"{self.left[role]}{self.roles[role]}\n{msg}{self.right[role]}"
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        ret = f"{self.START}system\n{prompt0}\n{self.END}\n" + "".join([self.BuildMsg(c["role"], c["msg"]) for c in conversations]) + (f"{self.START}assistant\n" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterAMAZON():
    def __init__(self, tokenizer=None, systemAsUser = False):
        #self.roles={'USER': 'user', 'ASSISTANT': 'assistant', 'SYSTEM': 'system'}
        self.left={'USER': "<|prompter|>", 'ASSISTANT': "<|assistant|>", 'SYSTEM': ""}
        self.right={'USER': "</s>", 'ASSISTANT': "</s>", 'SYSTEM': ""}
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def BuildMsg(self, role: str, msg: str):
        if self.systemAsUser and "SYSTEM" == role:
            role = "USER"
        return f"{self.left[role]}{msg}{self.right[role]}"
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        ret = f"{self.left['SYSTEM']}{prompt0}{self.right['SYSTEM']}" + "".join([self.BuildMsg(c["role"], c["msg"]) for c in conversations]) + (f"<|assistant|>" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterZephyr():
    def __init__(self, tokenizer=None, systemAsUser = False):
        #self.roles={'USER': 'user', 'ASSISTANT': 'assistant', 'SYSTEM': 'system'}
        self.left={'USER': "<|user|>\n", 'ASSISTANT': "<|assistant|>\n", 'SYSTEM': "<|system|>\n"}
        self.right={'USER': "</s>\n", 'ASSISTANT': "</s>\n", 'SYSTEM': "</s>\n"}
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def BuildMsg(self, role: str, msg: str):
        if self.systemAsUser and "SYSTEM" == role:
            role = "USER"
        return f"{self.left[role]}{msg}{self.right[role]}"
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        ret = f"{self.left['SYSTEM']}{prompt0}{self.right['SYSTEM']}" + "".join([self.BuildMsg(c["role"], c["msg"]) for c in conversations]) + (f"<|assistant|>" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterOpenChat():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.left={'USER': "GPT4 User:", 'ASSISTANT': "GPT4 Assistant:", 'SYSTEM': "GPT4 System:"}
        self.right={'USER': "<|end_of_turn|>", 'ASSISTANT': "<|end_of_turn|>", 'SYSTEM': "<|end_of_turn|>"}
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def BuildMsg(self, role: str, msg: str):
        if self.systemAsUser and "SYSTEM" == role:
            role = "USER"
        return f"{self.left[role]}{msg}{self.right[role]}"
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        ret = f"{prompt0}{self.right['SYSTEM']}" + "".join([self.BuildMsg(c["role"], c["msg"]) for c in conversations]) + (f"{self.left['ASSISTANT']}" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterCommandR():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.left={'USER': "<|START_OF_TURN_TOKEN|><|USER_TOKEN|>", 'ASSISTANT': "<|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>", 'SYSTEM': "<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|>"}
        self.right={'USER': "<|END_OF_TURN_TOKEN|>", 'ASSISTANT': "<|END_OF_TURN_TOKEN|>", 'SYSTEM': "<|END_OF_TURN_TOKEN|>"}
        self.tokenizer = tokenizer
        self.systemAsUser = systemAsUser
    
    def BuildMsg(self, role: str, msg: str):
        if self.systemAsUser and "SYSTEM" == role:
            role = "USER"
        return f"{self.left[role]}{msg}{self.right[role]}"
    
    def __call__(self, prompt0, conversations, encode = True, assistTag = True):
        ret = f"<BOS_TOKEN>{self.left['SYSTEM']}{prompt0}{self.right['SYSTEM']}" + "".join([self.BuildMsg(c["role"], c["msg"]) for c in conversations]) + (f"{self.left['ASSISTANT']}" if assistTag else "")
        #print("prompt: ", ret)
        tokens = self.tokenizer.encode(ret)
        return (tokens, len(tokens)) if encode else (ret, len(tokens))

class AFormatterGPT():
    def __init__(self, tokenizer=None, systemAsUser = False):
        self.systemAsUser = systemAsUser
        return
    
    def __call__(self, prompt0, conversations, e
```

### Core Architecture Module: `ailice/core/llm/ALLMPool.py`
```
import sys
import importlib.util


requirements = [x for x in ["torch", "transformers", "accelerate", "bitsandbytes"] if (None == importlib.util.find_spec(x))]
if 0 == len(requirements):
    from ailice.core.llm.AModelCausalLM import AModelCausalLM
from ailice.core.llm.AModelChatGPT import AModelChatGPT
from ailice.core.llm.AModelMistral import AModelMistral
from ailice.core.llm.AModelAnthropic import AModelAnthropic


class ALLMPool():
    def __init__(self, config):
        self.pool = dict()
        self.config = config
        return
    
    def ParseID(self, id):
        split = id.find(":")
        return id[:split], id[split+1:]
    
    def Init(self, llmIDs: list[str]):
        MODEL_WRAPPER_MAP = {"AModelChatGPT": AModelChatGPT, "AModelMistral": AModelMistral, "AModelAnthropic": AModelAnthropic}
        if 0 == len(requirements):
            MODEL_WRAPPER_MAP["AModelCausalLM"] = AModelCausalLM
            MODEL_WRAPPER_MAP["AModelLLAMA"] = AModelCausalLM
        
        llmIDs = list(set([id for k,id in self.config.agentModelConfig.items()] + [id for id in llmIDs if "" != id])) if "" in llmIDs else llmIDs

        for id in llmIDs:
            modelType, modelName = self.ParseID(id)
            if (0 != len(requirements)) and (self.config.models[modelType]["modelWrapper"] in ["AModelCausalLM", "AModelLLAMA"]):
                print(f"The specified modelID {id} requires the installation of the following dependencies: {str(requirements)}. Please execute the following command to install: pip install {' '.join(requirements)}")
                sys.exit(0)
            if id not in self.pool:
                self.pool[id] = MODEL_WRAPPER_MAP[self.config.models[modelType]["modelWrapper"]](modelType=modelType, modelName=modelName, config=self.config)
        return
    
    def GetModel(self, modelID: str, agentType: str):
        if "" == modelID:
            if 'DEFAULT' not in self.config.agentModelConfig:
                print('You did not configure a default modelID (agentModelConfig["DEFAULT"]), which makes config.json invalid and unable to start. Please update your configuration.')
                sys.exit(0)
            modelID = self.config.agentModelConfig.get(agentType, self.config.agentModelConfig['DEFAULT'])
        return self.pool[modelID]
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #73** (2025-07-21): **integration with n8n or automation tools**
  *Symptoms*: I'm exploring possibility to link this with either n8n or some other tool where data is passed through some sort of webhook to AIlice.  Once data is received then have some sort of interaction for the user like socket alert/notification or some sidearea popping those messages  most simple usecase would be to remind about some tasks and then taking user's input and reminding him again or marking those as done (even if this needs interaction/integration with some task app)  any pointers to have data captured and fed into the agent?
  **Post-Mortem & Fix Analysis**:
  > By design, AIlice must first receive input from a user or a system message before it can start working and producing output. We can feed notifications to AIlice as user messages, accompanied by a corresponding prompt (of course, I'm assuming you are building an application based on AProcessor yourself, rather than using ailice_main or ailice_web directly).  To implement features like socket pushes or pop-up windows, you would need to build an ext-module (which is analogous to an MCP), either by yourself or by having AIlice build it for you. Then, in the message sent to AIlice, you would instruct it to run and load this module and use its functions to execute the push or pop-up action. This way, upon receiving the notification, AIlice can proactively load the tool module and display the pop-up.  You can design the pop-up from this module to be interactive and have the interaction results returned to AIlice. When returning the results, you should also include a prompt that suggests which
  > Thank you Stenven for the explanation and the pointers.  I'll try to do a POC and see how it goes. I was also thinking along the same lines to have a non-blocking flow or pass details as input messages.

- **Issue #70** (2025-05-29): **Add Execution Warning or Sandbox Mode for Sensitive Operations**
  *Symptoms*: Hello,  First of all, thank you for sharing and open-sourcing this excellent agent project.  During our usage and testing, we identified some potential security risks. Specifically, the agent currently runs with **excessive execution privileges by default**. If integrated into production environments and made accessible to external users, this could lead to a **Remote Code Execution (RCE)** vulnerability. We have located the relevant code that could potentially trigger this risk:  ![Image](https://github.com/user-attachments/assets/369a0c07-c165-4e53-b1bd-bcaad69c0334)  To mitigate this issue, we would like to suggest the following enhancements:  - Display a **clear warning or user confirmation** before executing high-privilege operations; - Provide an option to run the agent in a **sandboxed or restricted execution mode**, isolating potentially dangerous actions.  These improvements could significantly reduce the security risks without compromising the agent's flexibility and would greatly enhance its reliability for real-world applications.  Thank you again for your outstanding work!
  **Post-Mortem & Fix Analysis**:
  > Hello, I've also been hesitating about the question of how much system operation permission to grant agents. Later, for the sake of installation convenience, I cancelled the default sandbox installation method and resolved it by giving users warnings at startup.   However, for users with higher security requirements, sandbox remains viable: the simplest approach is to use Dockerfile to run AIlice directly in a docker container; for more complex solutions, you can run AIlice on the host machine while only starting `python3 -m ailice.modules.AScripter --addr=tcp://0.0.0.0:59100` and `python3 -m ailice.modules.AComputer --addr=tcp://0.0.0.0:59107` in a virtual machine, then set up proper port mapping from the virtual machine to the host machine, and configure the corresponding service addresses for scripter and computer in config.json.   Why don't we request user authorization for every command execution? Because we will soon enter an era where large numbers of agents execute tasks in par
  > Thank you very much for your explanation. 

- **Issue #69** (2025-05-22): **Potential Inconsistencies Between Repo and Model License**
  *Symptoms*: Hi, while reviewing the licenses for this repository and the model it depends on, I noticed a potential inconsistency that could cause confusion or legal risks in some situations.  Your repository uses the `espnet/kan-bayashi_ljspeech_vits` at `ailice/modules/speech/ATTS_LJS.py`, which is licensed under **cc by 4.0**. This license includes the requirement:  > "indicate if You modified the Licensed Material and retain an indication of any previous modifications;"  However, your repository license **mit** does not mention this, and therefore has no such requirement.  As a result, developers might assume no action is needed when modifying the model, which could unintentionally lead to non-compliance with the model license.  Suggested Actions: 1.You might consider adding a brief note in the README, LICENSE, or a separate NOTICE file to clarify the model’s license requirements (e.g., stating changes). 2.It could be helpful to include a reference to the model license and summarize any key obligations, so developers are aware of them. 3.You may want to gently remind users that, in some cases, they should check both the repository license and the model license, especially when redistributing or modifying the model.
  **Post-Mortem & Fix Analysis**:
  > I apologize for my oversight that led to this license issue. However, since this module was no longer in use anyway, I have removed it completely.  Thank you!

- **Issue #68** (2025-01-30): **Allice stops responding**
  *Symptoms*: I'm really enjoying Allice. But when it says it has to spin off another agent to do more web stuff, it comes back and gets stuck. And then it stops responding.  See screenshots <img width="1728" alt="Image" src="https://github.com/user-attachments/assets/2a6717cf-4980-434e-b2b6-ee7924fc9d7d" /> <img width="1728" alt="Image" src="https://github.com/user-attachments/assets/50a1a6c5-8e87-40aa-95e5-a6f615abb7f2" />
  **Post-Mortem & Fix Analysis**:
  > Hello, this situation usually occurs when the LLM inference service is not functioning properly. If it can be reproduced, please save the output from the command line so that we can better examine the error messages.
  > It might've been because I ran out of Claude credits. I've topped them off.....  On Wed, Jan 29, 2025, 6:39 PM stevenlu ***@***.***> wrote:  > Hello, this situation usually occurs when the LLM inference service is not > functioning properly. If it can be reproduced, please save the output from > the command line so that we can better examine the error messages. > > — > Reply to this email directly, view it on GitHub > <https://github.com/myshell-ai/AIlice/issues/68#issuecomment-2623174928>, > or unsubscribe > <https://github.com/notifications/unsubscribe-auth/AABRD6OHCLWD6JPHMCK6V3L2NFRBLAVCNFSM6AAAAABWD5TKZ6VHI2DSMVQWIX3LMV43OSLTON2WKQ3PNVWWK3TUHMZDMMRTGE3TIOJSHA> > . > You are receiving this because you authored the thread.Message ID: > ***@***.***> > 
  > Ah, I'll close this issue then. Hope you have fun!

- **Issue #67** (2025-01-28): **Docs fix spelling issues**
  *Symptoms*: Hello While looking through your docs I found and fixed several spelling issues. Br, Elias.

- **Issue #66** (2025-01-24): **I like the idea of this agent, unfortunately, this has never worked for me using openrouter. I spent some time trying to debug and decided not to waste more time on this. What a shame!**
  *Symptoms*: I like the idea of this agent, unfortunately, this has never worked for me using openrouter. I spent some time trying to debug and decided not to waste more time on this. What a shame!
  **Post-Mortem & Fix Analysis**:
  > Hello! I just noticed the email and simplified README you sent. Indeed, my lazy practice of putting all documentation in the README scared away many users. Thank you for your work, and I will split the README content based on your version.   If you encounter any problems, it would be best to provide the runtime environment and error information so we can better solve the issue. It's not surprising that this project has been stalled for nearly four months due to my personal reasons.
  > It was not working for openroute and as a result I had to modify the code. I will send you all files which I have modified. I didn't like the  idea of creating new file for every provider as all these files seems to have repeated code. So, I created one universal version which can work with any provider/any model. However, it was taking way too long.

- **Issue #65** (2025-02-01): **failure to launch**
  *Symptoms*: failure to launch. your requirements.txt has syntax errors and the build wheel fails, particularly with cmake. i just spent more than $20 with claude through cline trying to fix it and no joy.  in the last 6 months i've only had your project up and running 4 times and that after getting lucky. have yet to get scripter running without loading a new DB and rarely get to a web page from docker. 
  **Post-Mortem & Fix Analysis**:
  > Please provide the details of your runtime environment so that I can reproduce the issue. If AIlice installation or startup fails, the error message is also necessary for troubleshooting. As far as I know, the main issue with installing AIlice on Ubuntu is that llama-cpp-python occasionally causes installation failures. I am currently looking for a more stable alternative to address this problem. Your situation seems a bit different, but I don't have enough information to reproduce your issue.
  > There is indeed a syntax error in the requirements.txt, which may have been caused by the PR submitter using AI to generate the code. For some reason, I didn’t carefully review this change, which led to the faulty code being merged into the repository. It is more convenient to maintain a single approach, so I have deleted this file. Please use pip install -e . to install AIlice.
  > Still can't get scripter running, but i think that's a problem with windows configuration and Ubuntu doesn't play nice with Ailice for some reason. as for installation, i've traced down a couple more bugs. in windows it mainly revolves around cmake and python if the paths aren't just right as well as dependency version conflicts. My easiest installs were installing Ailice as my first program in AFTER a fresh install of  windows 11 23H2.   I'd really like you to look at https://github.com/frdel/agent-zero and see what he did with his UI and a full docker download of the agent. Ailice has too much potential to let wither, but she needs better code monkeys than me (noob). 

- **Issue #63** (2024-12-30): **Update ASpeech.py**
  *Symptoms*:  I changed the function names to follow PEP 8 conventions (lowercase with underscores)  I moved the strip function inside the ASpeech class to make it a method  I added a print statement to the play function to provide feedback. I added a try-except block to the process_text function to handle potential errors.  I used daemon threads to allow the main thread to exit even if the threads are still running.  I organized the code into logical sections to improve readability.

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

### Incident Patch 1: `92e2edd9` (2025-08-15)
**Commit Message**: 1. docker containers with GUI support.

**File**: `Dockerfile` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@ RUN apt-get update && apt-get install -y python3 python3-pip python3-venv git cm
 RUN apt-get install -y wget \
     && wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
     && apt-get install -y ./google-chrome-stable_current_amd64.deb \
+    libgtk-3-0 \
+    libdbus-glib-1-2 \
     && rm google-chrome-stable_current_amd64.deb \
     && rm -rf /var/lib/apt/lists/*
 
```

**File**: `README.md` (modified, +25/-19)
```diff
@@ -57,7 +57,6 @@ To understand Ailice's present abilities, watch the following videos:
 - [Installation and Usage](#installation-and-usage)
   - [System Requirements](#system-requirements)
   - [Environment Configuration and Installation](#environment-configuration-and-installation)
-  - [Run Ailice in Docker Containers](#run-ailice-in-docker-containers)
   - [If You Need to Frequently Use Google](#if-you-need-to-frequently-use-google)
   - [Usage](#usage)
   - [Configuring Extension Modules and MCP Servers](#configuring-extension-modules-and-mcp-servers)
@@ -108,11 +107,34 @@ Key technical features of Ailice include:
 
 Install and run Ailice with the following commands. Once Ailice is launched, use a browser to open the web page it provides, a dialogue interface will appear. Issue commands to Ailice through the conversation to accomplish various tasks. For your first use, you can try the commands provided in the [COOL things we can do](#cool-things-we-can-do) section to quickly get familiarized.
 
+**Local run:**
+
 ```bash
 git clone https://github.com/myshell-ai/AIlice.git
 cd AIlice
 pip install -e .
-ailice --modelID=anthropic:claude-3-5-sonnet-20241022 --contextWindowRatio=0.2
+ailice --contextWindowRatio=0.2
+```
+
+**Sandbox run:**
+
+```bash
+git clone https://github.com/myshell-ai/AIlice.git
+cd AIlice
+docker build -t ailice .
+docker run -it -p 127.0.0.1:5000:5000 ailice --expose=1 --contextWindowRatio=0.2
+```
+
+**Sandbox run with GUI support**(Linux only, special configuration required for Windows and macOS):
+
+```bash
+git clone https://github.com/myshell-ai/AIlice.git
+cd AIlice
+docker build -t ailice .
+docker run -it -p 127.0.0.1:5000:5000 \
+    -e DISPLAY=$DISPLAY \
+    -v /tmp/.X11-unix:/tmp/.X11-unix \
+    ailice --expose=1 --contextWindowRatio=0.2
 ```
 
 - For a more detailed understanding of the installation and configuration methods, please visit the [Installation and Usage](#installation-and-usage) section and the [Selection and Configuration of LLM](#selection-and-configuration-of-LLM) section.
@@ -159,14 +181,12 @@ If users do not plan to run LLMs locally, then running Ailice has virtually no h
 - The usability in a **MacOS** environment is similar to that in an Ubuntu environment.
 - For **Windows** users, using **Docker** or installing **WSL** (Windows Subsystem for Linux) and running Ailice within WSL is a better choice, especially for users who need to execute programming tasks -- I haven't integrated Windows command execution tools yet (this will be considered in the future, but the flexibility of command-line tools is of great significance for AI agents, which makes Linux platforms more advantageous). Additionally, the lack of testing on Windows significantly increases the likelihood of bugs; if you encounter related issues, please submit issues for resolution. 
 
-Before installing Ailice, it is strongly recommended to install **Anaconda and create a virtual environment** first (you can also use other tools you prefer, such as venv). You will also need **Chrome**, as Ailice needs it for web browsing. For users who want to run Ailice in a fully controlled virtual machine, you will need **Docker** (or other virtual machines, such as VirtualBox), please refer to [Run Ailice in Docker Containers](#run-ailice-in-docker-containers).
+Before installing Ailice, it is strongly recommended to install **Anaconda and create a virtual environment** first (you can also use other tools you prefer, such as venv). You will also need **Chrome**, as Ailice needs it for web browsing. For users who want to run Ailice in a fully controlled container/virtual machine, you will need **Docker** (or other virtual machines, such as VirtualBox).
 
 If you want to run Ailice in a virtual machine, ensure **Hyper-V** is turned off(otherwise llama.cpp cannot be installed). In a VirtualBox environment, you can disable it by following these steps: disable PAE/NX and VT-X/AMD-V ( Hyper-V) on VirtualBox settings for the VM. Set paravirtualization Interface to Default, disable nested paging.
 
 <a name="environment-configuration-and-installation"></a>
 ### Environment Configuration and Installation
-Agents need to interact with various aspects of the surrounding environment, their operating environment is often more complex than typical software. It may take us a long time to install the dependencies, but fortunately, this is basically done automatically.
-
 You can use the following command to install Ailice:
 
 ```bash
@@ -192,20 +212,6 @@ pip install -e .[finetuning]
 
 You can run Ailice now! Use the commands in [Usage](#usage).
 
-<a name="run-ailice-in-docker-containers"></a>
-### Run Ailice in Docker Containers
-By default, code execution utilizes the local environment. To prevent potential AI errors leading to irreversible losses, it is recommended to run Ailice inside a Docker container.
-
-```bash
-git clone https://github.com/myshell-ai/AIlice.git
-cd AIlice
-docker build -t ailice .
-docker
```

---

### Incident Patch 2: `8e96c91f` (2025-07-29)
**Commit Message**: 1. new UI.

**File**: `ailice/app/app.py` (added, +308/-0)
```diff
@@ -0,0 +1,308 @@
+import os
+import sys
+import simplejson as json
+import traceback
+import requests
+import appdirs
+import tempfile
+import traceback
+import logging
+
+from functools import wraps
+from logging.handlers import RotatingFileHandler
+from urllib.parse import unquote
+from flask import render_template, request, jsonify, Response, send_file, redirect, url_for, session, make_response
+
+from ailice.common.AConfig import config
+from ailice.AServices import StartServices, TerminateSubprocess
+
+from ailice.app.factory import CreateApp
+from ailice.app.context import UserContext
+from ailice.app.log import logger
+from ailice.app.exceptions import AWExceptionSessionNotExist
+
+from datetime import datetime, timedelta
+
+AILICE_CONFIG = os.path.join(appdirs.user_config_dir("ailice", "Steven Lu"), "config.json")
+
+app = CreateApp()
+context = UserContext(userID="0")
+
+def Init():
+    StartServices()
+    logger.info("Services started")
+    
+    context.Create()
+
+    InitServer()
+    return
+
+def InitServer():
+    os.makedirs(f'{config.chatHistoryPath}/logs', exist_ok=True)
+    handler = RotatingFileHandler(f'{config.chatHistoryPath}/logs/app.log', maxBytes=1000000, backupCount=5)
+    handler.setLevel(logging.INFO)
+    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
+    handler.setFormatter(formatter)
+    app.logger.addHandler(handler)
+    logger.info(f"Flask app logger configured to write to {config.chatHistoryPath}/logs/app.log")
+    return
+
+def main():
+    config.Initialize(configFile=AILICE_CONFIG)
+    logger.info("Configuration initialized")
+    
+    import argparse
+    parser = argparse.ArgumentParser()
+    parser.add_argument('--modelID',type=str,default=config.modelID, help="modelID specifies the model. There are two modes for model configuration. In the first mode, the model is uniformly specified by modelID. In the second mode, different types of agents will run on different models. When this parameter is an empty string (unspecified), the second mode will be used automatically, i.e., the models configured individually for different agents under the agentModelConfig field in config.json will be used. The currently supported models can be seen in config.json. Default: %(default)s")
+    parser.add_argument('--quantization',type=str,default=config.quantization, help="quantization is the quantization option, you can choose 4bit or 8bit. Default: %(default)s")
+    parser.add_argument('--maxMemory',type=dict,default=config.maxMemory, help='maxMemory is the memory video memory capacity constraint, the format when set is like "{0:"23GiB", 1:"24GiB", "cpu": "64GiB"}". Default: %(default)s')
+    parser.add_argument('--prompt',type=str,default=config.prompt, help="prompt specifies the prompt to be executed, which is the type of agent. Default: %(default)s")
+    parser.add_argument('--temperature',type=float,default=config.temperature, help="temperature sets the temperature parameter of LLM reasoning. Default: %(default)s")
+    parser.add_argument('--flashAttention2',type=bool,default=config.flashAttention2, help="flashAttention2 is the switch to enable flash attention 2 to speed up inference. It may have a certain impact on output quality. Default: %(default)s")
+    parser.add_argument('--contextWindowRatio',type=float,default=config.contextWindowRatio, help="contextWindowRatio is a user-specified proportion coefficient, which determines the proportion of the upper limit of the prompt length constructed during inference to the LLM context window in some cases. Default: %(default)s")
+    parser.add_argument('--speechOn',type=bool,default=config.speechOn, help="speechOn is the switch to enable voice conversation. Please note that the voice dialogue is currently not smooth yet. Default: %(default)s")
+    parser.add_argument('--ttsDevice',type=str,default=config.ttsDevice,help='ttsDevice specifies the computing device used by the text-to-speech model. You can set it to "cuda" if there is enough video memory. Default: %(default)s')
+    parser.add_argument('--sttDevice',type=str,default=config.sttDevice,help='sttDevice specifies the computing device used by the speech-to-text model. You can set it to "cuda" if there is enough video memory. Default: %(default)s')
+    parser.add_argument('--resetApiKey',action='store_true', help="Whether to reset the model's API key after startup.")
+    parser.add_argument('--chatHistoryPath',type=str,default=config.chatHistoryPath, help="chatHistoryPath is used to specify the chat history storage path. Default: %(default)s")
+    parser.add_argument('--certificate',type=str,default=config.certificate, help="""Certificate settings for the web interface. The simplest option is an empty string, which will use the HTTP protocol for the UI web page. Setting it to 'adhoc' will use a self-generated certificate, providing encryption for the data flow between the UI and server, but it requires dismissing bro
```

**File**: `ailice/app/cleaner.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import threading
+import time
+from concurrent.futures import ThreadPoolExecutor
+from ailice.app.log import logger
+
+
+class SessionCleaner:
+    def __init__(self, max_workers=5):
+        self.pendingGCPool = {}
+        self.poolLock = threading.Lock()
+        
+        self.gcThread = threading.Thread(target=self.GCThread, daemon=True)
+        self.gcThread.start()
+        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="SessionReleaser")
+        logger.info(f"SessionCleaner initialized with {max_workers} release workers and GC thread started")
+        return
+    
+    def AddSessionToGC(self, sessionName, session):
+        with self.poolLock:
+            self.pendingGCPool[sessionName] = session
+            logger.info(f"Session '{sessionName}' added to GC pool")
+    
+    def IsSessionInGC(self, sessionName):
+        with self.poolLock:
+            return sessionName in self.pendingGCPool
+    
+    def ReleaseSession(self, session):
+        session._release_flag = True
+        try:
+            session.Release()
+        finally:
+            session._release_flag = False
+        return
+    
+    def GCThread(self):
+        while True:
+            try:
+                inactiveList = []
+                with self.poolLock:
+                    for sessionName, session in self.pendingGCPool.items():
+                        if session.state == "init":
+                            inactiveList.append(sessionName)
+                        elif (not getattr(session, "_release_flag", False)) and session.IsStopped():
+                            self.executor.submit(self.ReleaseSession, session)
+                    
+                    for sessionName in inactiveList:
+                        self.pendingGCPool.pop(sessionName)
+                        logger.info(f"Session '{sessionName}' removed from GC pool")
+                
+                if len(inactiveList) > 0:
+                    logger.info(f"{len(inactiveList)} sessions released. GCPool size: {len(self.pendingGCPool)}")
+                time.sleep(1)
+            except Exception as e:
+                logger.error(f"Unexpected exception in GCThread: {str(e)}")
+        return
+
+
+cleaner = SessionCleaner()
\ No newline at end of file
```

**File**: `ailice/app/config.py` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+from typing import Dict, List, Optional, Any, Union, Annotated, Literal
+from pydantic import BaseModel, field_validator, Field
+from pydantic.networks import AnyUrl
+
+class AiliceModelConfig(BaseModel):
+     formatter: str
+     contextWindow: int
+     systemAsUser: bool
+     
+class AiliceWebProviderConfig(BaseModel):
+    modelWrapper: str
+    apikey: Optional[str] = None
+    baseURL: Optional[Union[AnyUrl, str]] = None
+    modelList: dict[str, AiliceModelConfig]
+    
+    @field_validator('baseURL')
+    def validate_base_url(cls, v):
+        if v == '':
+            return v
+        return v
+
+
+class AiliceWebServiceConfig(BaseModel):
+    protocol: Literal["aexp", "mcp"]
+    addr: AnyUrl
+    
+class AiliceWebConfig(BaseModel):
+    agentModelConfig: dict[str, str]
+    models: dict[str, AiliceWebProviderConfig]
+    temperature: Annotated[float, Field(ge=0.0)]
+    contextWindowRatio: Annotated[float, Field(ge=0.0, le=1.0)]
+    
+    
\ No newline at end of file
```

**File**: `ailice/app/context.py` (added, +318/-0)
```diff
@@ -0,0 +1,318 @@
+import os
+import time
+import json
+import copy
+import threading
+import shutil
+from transitions.extensions import LockedMachine
+
+from ailice.common.AConfig import AConfig
+from ailice.common.AConfig import config as global_config
+from ailice.common.lightRPC import GenerateCertificates
+
+from ailice.app.decorators import atomic_transition
+from ailice.app.task import TaskSession
+from ailice.app.config import AiliceWebConfig
+from ailice.app.schema import apply_patches, build_settings_schema, check_path, validate_patches
+from ailice.app.log import logger
+from ailice.app.cleaner import cleaner
+from ailice.app.exceptions import *
+
+
+
+class UserContext():
+    states = ['init', 'ready', 'released']
+    settings = ["agentModelConfig", "models", "temperature", "contextWindowRatio"]
+    allowedPathes = [["agentModelConfig"],
+                     ["models", ["oai", "groq", "openrouter", "apipie", "deepseek", "mistral", "anthropic"], "apikey"],
+                     ["temperature"],
+                     ["contextWindowRatio"]]
+    
+    def __init__(self, userID: str):
+        self.userID = userID
+        self.config = AConfig()
+        self.currentSession = None
+        self.context = dict()
+        self.speech = None
+        self.methodLock = threading.RLock()
+        self.machine = LockedMachine(model=self, states=UserContext.states, initial='init')
+        self.machine.add_transition(trigger='create', source='init', dest='ready')
+        self.machine.add_transition(trigger='release', source='*', dest='released')
+        self.machine.add_transition(trigger='session_call', source='ready', dest='ready')
+        self.serverPublicFile = None
+        self.serverSecretFile = None
+        self.serverPublicFile = None
+        self.serverSecretFile = None
+        logger.debug(f"UserContext initialized for user ID: {userID}")
+        return
+
+    def GetPath(self, pathType: str="", sessionName: str=""):
+        pathes = {"": "",
+                  "user_config": "user_config.json",
+                  "certificates": "certificates",
+                  "sessions": "sessions",
+                  "session": f"sessions/{sessionName}",
+                  "history": f"sessions/{sessionName}/ailice_history.json"}
+        return os.path.join(self.config.chatHistoryPath, str(self.userID), pathes[pathType])
+    
+    def StoreConfig(self):
+        userCfg = {"agentModelConfig": self.config.agentModelConfig,
+                   "models": {providerName: {k: v for k, v in providerCfg.items() if k!="modelList"} for providerName, providerCfg in self.config.models.items() if providerName not in ["default"]},
+                   "temperature": self.config.temperature,
+                   "contextWindowRatio": self.config.contextWindowRatio}
+        
+        config_path = self.GetPath(pathType="user_config")
+        with open(config_path, "w") as f:
+            json.dump(userCfg, f, indent=2)
+        logger.info(f"User configuration stored to {config_path}")
+        return
+    
+    def UpdateConfig(self, updatedConfig):
+        logger.info(f"Updating configuration for user {self.userID}")
+        if "agentModelConfig" in updatedConfig:
+            self.config.agentModelConfig = updatedConfig["agentModelConfig"]
+            logger.debug("Updated agentModelConfig")
+        if "models" in updatedConfig:
+            #protect the models in config from being modified.
+            updateModels = {providerName: providerCfg for providerName, providerCfg in updatedConfig["models"].items() if providerName not in ["default"]}
+            for providerName in updateModels:
+                updateModels[providerName]["modelList"] = self.config.models[providerName]["modelList"]
+            self.config.models.update(updateModels)
+            logger.debug(f"Updated models configuration for providers: {list(updateModels.keys())}")
+        if "temperature" in updatedConfig:
+            self.config.temperature = float(updatedConfig["temperature"])
+            logger.debug(f"Updated temperature to {self.config.temperature}")
+        if "contextWindowRatio" in updatedConfig:
+            self.config.contextWindowRatio = float(updatedConfig["contextWindowRatio"])
+            logger.debug(f"Updated contextWindowRatio to {self.config.contextWindowRatio}")
+        return
+        
+    def InitConfig(self):
+        logger.info(f"Initializing configuration for user {self.userID}")
+        self.config.__dict__.update(copy.deepcopy(global_config.ToJson()))
+        
+        configFile = self.GetPath(pathType="user_config")
+        userConfig = {}
+        if os.path.exists(configFile):
+            with open(configFile, "r") as f:
+                userConfig = json.load(f)
+                logger.info(f"Loaded user configuration from {configFile}")
+        else:
+            logger.info(f"No user configuration found at {configFile}, using defaults")
+        self.UpdateConfig(userConf
```

**File**: `ailice/app/decorators.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import traceback
+from functools import wraps
+
+from ailice.app.log import logger
+from ailice.app.exceptions import AWExceptionNotReadyForOperation
+
+
+def atomic_transition(action):
+    def decorator(func):
+        @wraps(func)
+        def wrapper(self, *args, **kwargs):
+            if not hasattr(self, 'methodLock'):
+                raise AttributeError("Object has no methodLock attribute")
+                
+            with self.methodLock:
+                if getattr(self, f"may_{action}")():
+                    try:
+                        ret = func(self, *args, **kwargs)
+                        getattr(self, action)()
+                    except Exception as e:
+                        logger.error(f"Call method '{func.__name__}' FAILED, EXCEPTION: {str(e)}\n\nStack: {''.join(traceback.format_stack())}")
+                        raise e
+                    return ret
+                else:
+                    logger.error(f"Method '{func.__name__}' cannot be called in state '{self.state}'")
+                    raise AWExceptionNotReadyForOperation(f"Method '{func.__name__}' cannot be called in state '{self.state}'. ")
+        return wrapper
+    return decorator
\ No newline at end of file
```

**File**: `ailice/app/exceptions.py` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+class AWExceptionInsufficientResources(Exception):
+    pass
+
+
+class AWExceptionCreateSandboxFailed(Exception):
+    pass
+
+
+class AWExceptionSessionNotExist(Exception):
+    pass
+
+class AWExceptionUserContextNotExist(Exception):
+    pass
+
+class AWExceptionSessionBusy(Exception):
+    pass
+
+class AWExceptionNotReadyForOperation(Exception):
+    pass
+
+class AWExceptionIllegalInput(Exception):
+    pass
\ No newline at end of file
```

**File**: `ailice/app/factory.py` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+from flask import Flask
+from ailice.app.log import logger
+
+
+def CreateApp():
+    app = Flask(__name__, static_folder='static')
+    return app
\ No newline at end of file
```

**File**: `ailice/app/log.py` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+import os
+import appdirs
+import logging
+from logging.handlers import RotatingFileHandler
+import multiprocessing
+
+
+def get_process_logger(process_name=None):
+    
+    if process_name is None:
+        process_name = f"{multiprocessing.current_process().name}_{os.getpid()}"
+        
+    # Log format
+    log_format = (
+        '%(asctime)s.%(msecs)03d|'  # Timestamp with milliseconds
+        '%(levelname)s|'            # Log level
+        '%(thread)d|'               # Thread ID
+        '%(threadName)s|'           # Thread name
+        '%(name)s|'                 # Logger name (usually module name)
+        '%(filename)s:%(lineno)d|'  # File name and line number
+        '%(funcName)s|'             # Function name where logging call was issued
+        '%(message)s'               # Log message
+    )
+    
+    # Create unique logger for process
+    logger_name = f'ailice.{process_name}'
+    logger = logging.getLogger(logger_name)
+    
+    # If logger already configured, return it
+    if logger.handlers:
+        return logger
+    
+    # Set log level
+    logger.setLevel(logging.INFO)
+    
+    # Log file directory
+    LOG_DIR = os.path.join(appdirs.user_log_dir("ailice", "Steven Lu"), "logs")
+    os.makedirs(LOG_DIR, exist_ok=True)
+    
+    # Use different log files for different processes
+    LOG_FILE = os.path.join(LOG_DIR, f"ailice_{process_name}.log")
+    
+    # Set up file handler with rotation
+    file_handler = RotatingFileHandler(
+        LOG_FILE, 
+        maxBytes=10*1024*1024,  # 10MB
+        backupCount=5
+    )
+    file_handler.setLevel(logging.INFO)
+    
+    # Set up console handler
+    console_handler = logging.StreamHandler()
+    console_handler.setLevel(logging.INFO)
+    
+    # Create formatter and add to handlers
+    formatter = logging.Formatter(log_format)
+    file_handler.setFormatter(formatter)
+    console_handler.setFormatter(formatter)
+    
+    # Add handlers to logger
+    logger.addHandler(file_handler)
+    logger.addHandler(console_handler)
+    
+    # Ensure logs are not propagated to root logger
+    logger.propagate = False
+    
+    return logger
+
+
+logger = get_process_logger()
\ No newline at end of file
```

---

### Incident Patch 3: `d876ee1b` (2025-06-12)
**Commit Message**: 1. fixed a resource leak issue in the LLM wrappers.

**File**: `ailice/core/llm/AModelAnthropic.py` (modified, +13/-13)
```diff
@@ -12,8 +12,6 @@ def __init__(self, modelType: str, modelName: str, config):
         self.modelType = modelType
         self.modelName = modelName
         self.config = config
-        self.client = anthropic.Anthropic(api_key = config.models[modelType]["apikey"],
-                                          base_url = config.models[modelType]["baseURL"])
 
         self.modelCfg = config.models[modelType]["modelList"][modelName]
         self.formatter = CreateFormatter(self.modelCfg["formatter"], tokenizer = self.tokenizer, systemAsUser = self.modelCfg['systemAsUser'])
@@ -28,23 +26,25 @@ def Generate(self, prompt: tuple[list[dict[str,str]],int], proc: callable, endch
         extras.update({"temperature": temperature} if None != temperature else {})
         try:
             gasTank.Consume(resourceType="Anthropic/InputTokens", amount=prompt[1])
-            with self.client.messages.stream(model=self.modelName,
+            with anthropic.Anthropic(api_key = self.config.models[self.modelType]["apikey"],
+                                     base_url = self.config.models[self.modelType]["baseURL"]) as client:
+                with client.messages.stream(model=self.modelName,
                                             max_tokens=4096,
                                             system=prompt[0][0]["content"],
                                             messages=prompt[0][1:],
                                             timeout=60,
                                             **extras) as stream:
-                for delta in stream.text_stream:
-                    text += delta
+                    for delta in stream.text_stream:
+                        text += delta
 
-                    if endchecker(text):
-                        break
-                    
-                    sentences = [x for x in sentences_split(text[currentPosition:])]
-                    if (2 <= len(sentences)) and ("" != sentences[0].strip()):
-                        gasTank.Consume(resourceType="Anthropic/OutputTokens", amount=len(sentences[0]) // 4)
-                        proc(txt=sentences[0])
-                        currentPosition += len(sentences[0])
+                        if endchecker(text):
+                            break
+                        
+                        sentences = [x for x in sentences_split(text[currentPosition:])]
+                        if (2 <= len(sentences)) and ("" != sentences[0].strip()):
+                            gasTank.Consume(resourceType="Anthropic/OutputTokens", amount=len(sentences[0]) // 4)
+                            proc(txt=sentences[0])
+                            currentPosition += len(sentences[0])
         except anthropic.AuthenticationError as e:
             msg = colored("The program encountered an authorization error. Please check your API key:", "yellow") + \
                   colored(f"\n\n{self.modelType}: ", "green") + colored(f"'{self.config.models[self.modelType]['apikey']}'\n\n", "blue") + \
```

**File**: `ailice/core/llm/AModelChatGPT.py` (modified, +12/-12)
```diff
@@ -11,8 +11,6 @@ def __init__(self, modelType: str, modelName: str, config):
         self.modelType = modelType
         self.modelName = modelName
         self.config = config
-        self.client = openai.OpenAI(api_key = self.config.models[modelType]["apikey"],
-                                    base_url = self.config.models[modelType]["baseURL"])
 
         self.modelCfg = self.config.models[modelType]["modelList"][modelName]
         self.formatter = CreateFormatter(self.modelCfg["formatter"], tokenizer = self.tokenizer, systemAsUser = self.modelCfg['systemAsUser'])
@@ -28,21 +26,23 @@ def Generate(self, prompt: tuple[list[dict[str,str]],int], proc: callable, endch
         extras.update({"temperature": temperature} if None != temperature else {})
         try:
             gasTank.Consume(resourceType="ChatGPT/InputTokens", amount=prompt[1])
-            for chunk in self.client.chat.completions.create(model=self.modelName,
+            with openai.OpenAI(api_key = self.config.models[self.modelType]["apikey"],
+                               base_url = self.config.models[self.modelType]["baseURL"]) as client:
+                for chunk in client.chat.completions.create(model=self.modelName,
                                                             messages=prompt[0],
                                                             stream=True,
                                                             timeout=60,
                                                             **extras):
-                text += (chunk.choices[0].delta.content or "")
+                    text += (chunk.choices[0].delta.content or "")
 
-                if endchecker(text):
-                    break
-                
-                sentences = [x for x in sentences_split(text[currentPosition:])]
-                if (2 <= len(sentences)) and ("" != sentences[0].strip()):
-                    gasTank.Consume(resourceType="ChatGPT/OutputTokens", amount=len(sentences[0]) // 4)
-                    proc(txt=sentences[0])
-                    currentPosition += len(sentences[0])
+                    if endchecker(text):
+                        break
+                    
+                    sentences = [x for x in sentences_split(text[currentPosition:])]
+                    if (2 <= len(sentences)) and ("" != sentences[0].strip()):
+                        gasTank.Consume(resourceType="ChatGPT/OutputTokens", amount=len(sentences[0]) // 4)
+                        proc(txt=sentences[0])
+                        currentPosition += len(sentences[0])
         except openai.AuthenticationError as e:
             msg = colored("The program encountered an authorization error. Please check your API key:", "yellow") + \
                   colored(f"\n\n{self.modelType}: ", "green") + colored(f"'{self.config.models[self.modelType]['apikey']}'\n\n", "blue") + \
```

**File**: `ailice/core/llm/AModelMistral.py` (modified, +14/-14)
```diff
@@ -13,7 +13,6 @@ def __init__(self, modelType: str, modelName: str, config):
         self.modelType = modelType
         self.modelName = modelName
         self.config = config
-        self.client = Mistral(api_key = config.models[modelType]["apikey"])
 
         self.modelCfg = config.models[modelType]["modelList"][modelName]
         self.formatter = CreateFormatter(self.modelCfg["formatter"], tokenizer = self.tokenizer, systemAsUser = self.modelCfg['systemAsUser'])
@@ -28,20 +27,21 @@ def Generate(self, prompt: tuple[list[dict[str,str]],int], proc: callable, endch
         extras.update({"temperature": temperature} if None != temperature else {})
         try:
             gasTank.Consume(resourceType="Mistral/InputTokens", amount=prompt[1])
-            for chunk in self.client.chat.stream(model=self.modelName,
-                                                 messages=prompt[0],
-                                                 timeout_ms=60000,
-                                                 **extras):
-                text += (chunk.data.choices[0].delta.content or "")
+            with Mistral(api_key = self.config.models[self.modelType]["apikey"]) as client:
+                for chunk in client.chat.stream(model=self.modelName,
+                                                messages=prompt[0],
+                                                timeout_ms=60000,
+                                                **extras):
+                    text += (chunk.data.choices[0].delta.content or "")
 
-                if endchecker(text):
-                    break
-                
-                sentences = [x for x in sentences_split(text[currentPosition:])]
-                if (2 <= len(sentences)) and ("" != sentences[0].strip()):
-                    gasTank.Consume(resourceType="Mistral/OutputTokens", amount=len(sentences[0]) // 4)
-                    proc(txt=sentences[0])
-                    currentPosition += len(sentences[0])
+                    if endchecker(text):
+                        break
+                    
+                    sentences = [x for x in sentences_split(text[currentPosition:])]
+                    if (2 <= len(sentences)) and ("" != sentences[0].strip()):
+                        gasTank.Consume(resourceType="Mistral/OutputTokens", amount=len(sentences[0]) // 4)
+                        proc(txt=sentences[0])
+                        currentPosition += len(sentences[0])
         except models.sdkerror.SDKError as e:
             if "Unauthorized" in e.body:
                 msg = colored("The program encountered an authorization error. Please check your API key:", "yellow") + \
```

---

### Incident Patch 4: `c72e8f53` (2025-05-25)
**Commit Message**: 1. fixed an issue in lightRPC. KeyError is not serializable.

**File**: `ailice/common/lightRPC.py` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ def Worker(self):
           
           try:
             if ('clientID' in msg) and (msg['clientID'] not in self.objPool):
-              ret = {"exception": KeyError(f"clientID {msg['clientID']} not exist.")}
+              ret = {"exception": str(KeyError(f"clientID {msg['clientID']} not exist."))}
             elif "GET_META" in msg:
               methods = inspect.getmembers(self.objCls, predicate=lambda x: (inspect.isfunction(x) and x.__name__ in self.APIList))
               ret = {"META": {"methods": {methodName: {
```

---

### Incident Patch 5: `72de7929` (2025-05-25)
**Commit Message**: 1. fixed some issues in lightRPC.

**File**: `ailice/common/lightRPC.py` (modified, +10/-5)
```diff
@@ -122,11 +122,15 @@ def Run(self):
       self.receiver.close()
       self.dealer.close()
   
-  def Worker(self):
+  def CreateSocket(self):
     socket = self.context.socket(zmq.DEALER)
     socket.setsockopt(zmq.HEARTBEAT_IVL, 2000)
     socket.setsockopt(zmq.HEARTBEAT_TIMEOUT, 10000)
     socket.connect(self.WORKERS_ADDR)
+    return socket
+  
+  def Worker(self):
+    socket = self.CreateSocket()
 
     while True:
       try:
@@ -158,6 +162,7 @@ def Worker(self):
               with self.objPoolLock:
                 if msg['clientID'] in self.objPool:
                   del self.objPool[msg['clientID']]
+                ret = {}
             elif "NEXT" in msg:
               gen = self.objPool[msg['clientID']].GetGenerator(msg['generatorID'])
               try:
@@ -183,12 +188,12 @@ def Worker(self):
             socket.send_multipart([clientIdentity, delimiter, responseData])
         else:
           print(f"Warning: Received unexpected frame count: {len(frames)}")
-              
-      except zmq.Again:
-        continue
+      
       except Exception as e:
-        print('Worker fatal exception:', str(e))
+        print('Worker exception:', str(e))
         traceback.print_tb(e.__traceback__)
+        socket.close()
+        socket = self.CreateSocket()
         continue
 
 def makeServer(objCls, objArgs, url, APIList, serverPrivateKeyPath=None, clientPublicKeysDir=None, validateReturn=True):
```

---

### Incident Patch 6: `38e99656` (2025-05-24)
**Commit Message**: 1. replace REP with DEALER to avoid network errs causing deadlocks or resource leaks.
2. improved error handling.
3. client default timeout is now 5 min, no longer waiting indefinitely.
4. for cases requiring indefinite waiting, use the Timeout() decorator.

**File**: `ailice/AIliceMain.py` (modified, +4/-2)
```diff
@@ -69,15 +69,17 @@ def mainLoop(session: str):
     print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
     print("We now start the vector database. Note that this may include downloading the model weights, so it may take some time.")
     storage = clientPool.GetClient(config.services['storage']['addr'])
-    msg = storage.Open(storagePath)
+    with storage.Timeout(-1):
+        msg = storage.Open(storagePath)
     print(msg)
     print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
 
     if config.speechOn:
         speech = clientPool.GetClient(config.services['speech']['addr'])
         print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
         print("The speech module is preparing speech recognition and TTS models, which may include the work of downloading weight data, so it may take a long time.")
-        speech.PrepareModel()
+        with speech.Timeout(-1):
+            speech.PrepareModel()
         print("The speech module model preparation work is completed.")
         print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
         if any([re.fullmatch(r"(cuda|cpu)(:(\d+))?", s) == None for s in [config.ttsDevice, config.sttDevice]]):
```

**File**: `ailice/common/lightRPC.py` (modified, +96/-49)
```diff
@@ -17,6 +17,7 @@
 import secrets
 import traceback
 from zmq.auth.thread import ThreadAuthenticator
+from contextlib import contextmanager
 from pydantic import validate_call
 from ailice.common.ADataType import *
 from ailice.common.AExceptions import ALightRPCException
@@ -122,53 +123,73 @@ def Run(self):
       self.dealer.close()
   
   def Worker(self):
-    socket = self.context.socket(zmq.REP)
+    socket = self.context.socket(zmq.DEALER)
     socket.setsockopt(zmq.HEARTBEAT_IVL, 2000)
     socket.setsockopt(zmq.HEARTBEAT_TIMEOUT, 10000)
     socket.connect(self.WORKERS_ADDR)
 
     while True:
-      msg=ReceiveMsg(socket)
-      ret=None
       try:
-        if ('clientID' in msg) and (msg['clientID'] not in self.objPool):
-          ret = {"exception": KeyError(f"clientID {msg['clientID']} not exist.")}
-        elif "GET_META" in msg:
-          methods=inspect.getmembers(self.objCls, predicate=lambda x: (inspect.isfunction(x) and x.__name__ in self.APIList))
-          ret = {"META": {"methods": {methodName: {
+        # [clientIdentity, empty_delimiter, message_data]
+        frames = socket.recv_multipart()
+        if len(frames) >= 3:
+          clientIdentity = frames[0]
+          delimiter = frames[1]
+          msgData = frames[2]
+          
+          msg = json.loads(msgData.decode("utf-8"), cls=AJSONDecoder)
+          ret = None
+          
+          try:
+            if ('clientID' in msg) and (msg['clientID'] not in self.objPool):
+              ret = {"exception": KeyError(f"clientID {msg['clientID']} not exist.")}
+            elif "GET_META" in msg:
+              methods = inspect.getmembers(self.objCls, predicate=lambda x: (inspect.isfunction(x) and x.__name__ in self.APIList))
+              ret = {"META": {"methods": {methodName: {
                                         'signature': str(inspect.signature(method)),
                                         'is_generator': inspect.isgeneratorfunction(method)
                                       } for methodName, method in methods}}}
-        elif "CREATE" in msg:
-          with self.objPoolLock:
-            newID = str(secrets.token_hex(64))
-            self.objPool[newID] = GeneratorStorage(self.objCls(**self.objArgs))
-          ret = {"clientID": newID}
-        elif "DEL" in msg:
-          with self.objPoolLock:
-            del self.objPool[msg['clientID']]
-        elif "NEXT" in msg:
-          gen = self.objPool[msg['clientID']].GetGenerator(msg['generatorID'])
-          try:
-            ret = {'ret': next(gen), 'finished': False}
-          except StopIteration:
-            ret = {'ret': None, 'finished': True}
+            elif "CREATE" in msg:
+              with self.objPoolLock:
+                newID = str(secrets.token_hex(64))
+                self.objPool[newID] = GeneratorStorage(self.objCls(**self.objArgs))
+              ret = {"clientID": newID}
+            elif "DEL" in msg:
+              with self.objPoolLock:
+                if msg['clientID'] in self.objPool:
+                  del self.objPool[msg['clientID']]
+            elif "NEXT" in msg:
+              gen = self.objPool[msg['clientID']].GetGenerator(msg['generatorID'])
+              try:
+                ret = {'ret': next(gen), 'finished': False}
+              except StopIteration:
+                ret = {'ret': None, 'finished': True}
+            else:
+              result = getattr(self.objPool[msg['clientID']], msg['function'])(*msg['args'], **msg['kwargs'])
+              if inspect.isgenerator(result):
+                generatorID = str(id(result))
+                self.objPool[msg['clientID']].SaveGenerator(generatorID, result)
+                ret = {'ret': {'generatorID': generatorID}}
+              else:
+                ret = {'ret': result}
+          except Exception as e:
+            e.tb = ''.join(traceback.format_tb(e.__traceback__))
+            ret = {'exception': f"{str(e)}\n\n{e.tb}"}
+            traceback.print_tb(e.__traceback__)
+            print('Exception. msg:', str(msg), '. Except:', str(e))
+          
+          if ret is not None:
+            responseData = json.dumps(ret, cls=AJSONEncoder).encode("utf-8")
+            socket.send_multipart([clientIdentity, delimiter, responseData])
         else:
-          result = getattr(self.objPool[msg['clientID']], msg['function'])(*msg['args'], **msg['kwargs'])
-          if inspect.isgenerator(result):
-            generatorID = str(id(result))
-            self.objPool[msg['clientID']].SaveGenerator(generatorID, result)
-            ret = {'ret': {'generatorID': generatorID}}
-          else:
-            ret = {'ret': result}
+          print(f"Warning: Received unexpected frame count: {len(frames)}")
+              
+      except zmq.Again:
+        continue
       except Exception as e:
-        e.tb = ''.join(traceback.format_tb(e.__traceback__))
-        ret={'exception':f"{str(e)}\n\n{e.tb}"}
+        print('Worker fatal exception:', str(e))

```

**File**: `ailice/ui/app.py` (modified, +4/-2)
```diff
@@ -66,7 +66,8 @@ def InitSpeech(clientPool):
         speech = clientPool.GetClient(config.services['speech']['addr'])
         print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
         print("The speech module is preparing speech recognition and TTS models, which may include the work of downloading weight data, so it may take a long time.")
-        speech.PrepareModel()
+        with speech.Timeout(-1):
+            speech.PrepareModel()
         print("The speech module model preparation work is completed.")
         print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
         if any([re.fullmatch(r"(cuda|cpu)(:(\d+))?", s) == None for s in [config.ttsDevice, config.sttDevice]]):
@@ -110,7 +111,8 @@ def LoadSession(sessionName: str):
         print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
         print("We now start the vector database. Note that this may include downloading the model weights, so it may take some time.")
         storage = clientPool.GetClient(config.services['storage']['addr'])
-        msg = storage.Open(os.path.join(sessionPath, "storage"))
+        with storage.Timeout(-1):
+            msg = storage.Open(os.path.join(sessionPath, "storage"))
         print(msg)
         print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
 
```

---

### Incident Patch 7: `75117f44` (2025-05-22)
**Commit Message**: 1. added timeout parameter to avoid hanging during LLM inference.

**File**: `ailice/core/llm/AModelAnthropic.py` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ def Generate(self, prompt: tuple[list[dict[str,str]],int], proc: callable, endch
                                             max_tokens=4096,
                                             system=prompt[0][0]["content"],
                                             messages=prompt[0][1:],
+                                            timeout=60,
                                             **extras) as stream:
                 for delta in stream.text_stream:
                     text += delta
```

**File**: `ailice/core/llm/AModelChatGPT.py` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ def Generate(self, prompt: tuple[list[dict[str,str]],int], proc: callable, endch
             for chunk in self.client.chat.completions.create(model=self.modelName,
                                                             messages=prompt[0],
                                                             stream=True,
+                                                            timeout=60,
                                                             **extras):
                 text += (chunk.choices[0].delta.content or "")
 
```

**File**: `ailice/core/llm/AModelMistral.py` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ def Generate(self, prompt: tuple[list[dict[str,str]],int], proc: callable, endch
             gasTank.Consume(resourceType="Mistral/InputTokens", amount=prompt[1])
             for chunk in self.client.chat.stream(model=self.modelName,
                                                  messages=prompt[0],
+                                                 timeout_ms=60000,
                                                  **extras):
                 text += (chunk.data.choices[0].delta.content or "")
 
```

---

### Incident Patch 8: `800232ad` (2025-05-20)
**Commit Message**: 1. fixed a problem when using multiple server objects in one process.

**File**: `ailice/common/lightRPC.py` (modified, +15/-10)
```diff
@@ -12,6 +12,7 @@
 import inspect
 import zmq
 import zmq.auth
+import uuid
 import json
 import secrets
 import traceback
@@ -21,8 +22,9 @@
 from ailice.common.AExceptions import ALightRPCException
 from ailice.common.ASerialization import AJSONEncoder, AJSONDecoder, SignatureFromString, AnnotationsFromSignature
 
-WORKERS_ADDR="inproc://workers"
 context=zmq.Context()
+auth = None
+authLock = threading.Lock()
 
 def SendMsg(conn,msg):
   try:
@@ -64,13 +66,17 @@ def __getattr__(self, name):
 
 class GenesisRPCServer(object):
   def __init__(self, objCls, objArgs, url, APIList, serverPrivateKeyPath=None, clientPublicKeysDir=None, validateReturn=True):
+    global auth, authLock
+    
     self.objCls = validate_methods(objCls, APIList, validateReturn)
     self.objArgs = objArgs
     self.url = url
     self.objPool = dict()
     self.objPoolLock=threading.Lock()
     self.APIList = APIList
     self.context = context
+    self.domain = str(uuid.uuid4())
+    self.WORKERS_ADDR=f"inproc://workers-{self.domain}"
     self.receiver = self.context.socket(zmq.ROUTER)
 
     if serverPrivateKeyPath is None:
@@ -82,19 +88,22 @@ def __init__(self, objCls, objArgs, url, APIList, serverPrivateKeyPath=None, cli
     
     if self.enableSecurity:
       print("lightRPC server encryption ENABLED.")
-      self.auth = ThreadAuthenticator(self.context)
-      self.auth.start()
-      self.auth.configure_curve(domain='*', location=zmq.auth.CURVE_ALLOW_ANY if (clientPublicKeysDir is None) else clientPublicKeysDir)
+      with authLock:
+        if auth is None:
+          auth = ThreadAuthenticator(context)
+          auth.start()
+        auth.configure_curve(domain=self.domain, location=zmq.auth.CURVE_ALLOW_ANY if (clientPublicKeysDir is None) else clientPublicKeysDir)
       
       serverPublic, serverSecret = zmq.auth.load_certificate(serverPrivateKeyPath)
       
+      self.receiver.setsockopt_string(zmq.ZAP_DOMAIN, self.domain)
       self.receiver.setsockopt(zmq.CURVE_PUBLICKEY, serverPublic)
       self.receiver.setsockopt(zmq.CURVE_SECRETKEY, serverSecret)
       self.receiver.setsockopt(zmq.CURVE_SERVER, True)
     
     self.receiver.bind(url)
     self.dealer = self.context.socket(zmq.DEALER)
-    self.dealer.bind(WORKERS_ADDR)
+    self.dealer.bind(self.WORKERS_ADDR)
     return
   
   def Run(self):
@@ -107,20 +116,16 @@ def Run(self):
       zmq.device(zmq.QUEUE, self.receiver, self.dealer)
     except Exception as e:
       print('GenesisRPCServer:Run() FATAL EXCEPTION. ',self.url,', ',str(e))
-      if self.enableSecurity:
-        self.auth.stop()
       sys.exit(1)
     finally:
       self.receiver.close()
       self.dealer.close()
-      if self.enableSecurity:
-        self.auth.stop()
   
   def Worker(self):
     socket = self.context.socket(zmq.REP)
     socket.setsockopt(zmq.HEARTBEAT_IVL, 2000)
     socket.setsockopt(zmq.HEARTBEAT_TIMEOUT, 10000)
-    socket.connect(WORKERS_ADDR)
+    socket.connect(self.WORKERS_ADDR)
 
     while True:
       msg=ReceiveMsg(socket)
```

---

### Incident Patch 9: `09d0d99e` (2025-04-11)
**Commit Message**: 1. fixed an issue in client pool Destroy().

**File**: `ailice/common/ARemoteAccessors.py` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@ def __getitem__(self, key: str):
     
     def Destroy(self):
         for _, client in self.pool.items():
-            destroy = getattr(client, "Destroy", None)
+            destroy = getattr(client["client"], "Destroy", None)
             if callable(destroy):
                 try:
                     destroy()
```

---

### Incident Patch 10: `80352d77` (2025-03-31)
**Commit Message**: 1. fixed an issue in AComputer. only ascii allowed in headers.

**File**: `ailice/modules/AComputer.py` (modified, +2/-1)
```diff
@@ -3,6 +3,7 @@
 import io
 import re
 import typing
+import urllib.parse
 import datetime
 import mimetypes
 import requests
@@ -127,7 +128,7 @@ def Proxy(self, href: str, method: str, headers: dict={}, body: dict={}, params:
                 'Content-Type': contentType,
                 'Content-Length': str(endByte - startByte + 1),
                 'Accept-Ranges': 'bytes',
-                'Content-Disposition': f'inline; filename="{fileName}"',
+                'Content-Disposition': f'inline; filename="{urllib.parse.quote(fileName)}"; filename*=UTF-8\'\'{urllib.parse.quote(fileName)}',
                 'Last-Modified': datetime.datetime.fromtimestamp(os.stat(filePath).st_mtime, tz=datetime.timezone.utc).strftime('%a, %d %b %Y %H:%M:%S GMT')
             }
             
```

---

### Incident Patch 11: `753379af` (2025-03-31)
**Commit Message**: 1. the ui supports one-click downloading of various types of files now.

**File**: `ailice/ui/templates/index.html` (modified, +120/-6)
```diff
@@ -586,6 +586,73 @@
             color: var(--link-color);
             text-decoration: underline;
         }
+
+        .media-container {
+            position: relative;
+            display: inline-block;
+        }
+
+        .download-media-btn {
+            position: absolute;
+            top: 8px;
+            right: 8px;
+            background-color: rgba(255,255,255,0.8);
+            border: 1px solid #ccc;
+            border-radius: 6px;
+            padding: 8px 12px;
+            cursor: pointer;
+            opacity: 0;
+            transition: all 0.2s ease;
+            font-size: 16px;
+            display: flex;
+            align-items: center;
+            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
+            z-index: 10;
+        }
+
+        .download-media-btn .download-icon {
+            font-size: 20px;
+            margin-right: 5px;
+        }
+
+        .media-container:hover .download-media-btn {
+            opacity: 1;
+        }
+
+        .download-media-btn:hover {
+            background-color: rgba(255,255,255,0.9);
+            transform: scale(1.05);
+        }
+
+        .file-preview {
+            margin: 10px 0;
+            transition: all 0.2s ease;
+        }
+
+        .file-preview:hover {
+            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
+        }
+
+        [data-theme="dark"] .download-media-btn {
+            background-color: rgba(47, 53, 77, 0.8);
+            border-color: #414868;
+            color: #c0caf5;
+            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
+        }
+
+        [data-theme="dark"] .download-media-btn:hover {
+            background-color: rgba(65, 72, 104, 0.9);
+        }
+
+        [data-theme="dark"] .file-preview {
+            background-color: #2f354d !important;
+            border-color: #414868 !important;
+            color: #c0caf5 !important;
+        }
+
+        [data-theme="dark"] .file-preview div:nth-child(2) div:nth-child(2) {
+            color: #9aa5ce !important;
+        }
     </style>
 
     <!-- Load MathJax -->
@@ -726,6 +793,23 @@
             }
         }
         
+        function downloadMedia(url, fileName) {
+            fetch(url)
+                .then(response => response.blob())
+                .then(blob => {
+                    const a = document.createElement('a');
+                    const objectUrl = URL.createObjectURL(blob);
+                    a.href = objectUrl;
+                    a.download = fileName;
+                    a.click();
+                    URL.revokeObjectURL(objectUrl);
+                })
+                .catch(error => {
+                    console.error('Error downloading media:', error);
+                    alert('Failed to download media');
+                });
+        }
+        
         const renderer = new marked.Renderer();
         const rendererCode = renderer.code;
         const rendererCodespan = renderer.codespan;
@@ -757,21 +841,51 @@
                         return;
                     }
 
-                    let mediaElement = '';
+                    let containerHTML = '<div class="media-container" style="position: relative; display: inline-block;">';
+                    
+                    const fileName = href.split('/').pop() || 'file';
+                    
                     if (mediaType.startsWith('image')) {
-                        mediaElement = `<img src="${convertToProxyURL(href)}" alt="${text}" title="${title}" 
+                        containerHTML += `<img src="${convertToProxyURL(href)}" alt="${text}" title="${title}" 
                             style="max-width: 100%; height: auto; display: block;"
                             onerror="this.onerror=null; this.innerHTML='Failed to load image';">`;
                     } else if (mediaType.startsWith('audio')) {
-                        mediaElement = `<audio controls><source src="${convertToProxyURL(href)}" type="${mediaType}">Your browser does not support the audio element.</audio>`;
+                        containerHTML += `<audio controls><source src="${convertToProxyURL(href)}" type="${mediaType}">Your browser does not support the audio element.</audio>`;
                     } else if (mediaType.startsWith('video')) {
-                        mediaElement = `<video controls><source src="${convertToProxyURL(href)}" type="${mediaType}">Your browser does not support the video element.</video>`;
+                        containerHTML += `<video controls><source src="${convertToProxyURL(href)}" type="${mediaType}">Your browser does not support the video element.</video>`;
                     } else {
-                        mediaElement = `<a href="${href}">${text}</a>`;
+                        containerHTML += `
+                            <div class="file-preview" style="display: flex; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; max-width: 300px;">
+                            
```

---

### Incident Patch 12: `52500350` (2025-03-30)
**Commit Message**: 1. fixed the bug that prevented voice conversation module from starting.

**File**: `ailice/modules/ASpeech.py` (modified, +6/-5)
```diff
@@ -56,16 +56,17 @@ def SetDevices(self, deviceMap: dict[str,str]):
             t2s.To(deviceMap['tts'])
         return
     
-    def Speech2Text(self, wav: np.ndarray, sr: int) -> str:
+    def Speech2Text(self, wav: list, sr: int) -> str:
         global s2t
-        return s2t.recognize(audio_data_to_numpy((wav, sr)))
+        return s2t.recognize(audio_data_to_numpy((np.array(wav), sr)))
 
-    def Text2Speech(self, txt: str) -> tuple[np.ndarray, int]:
+    def Text2Speech(self, txt: str) -> tuple[list, int]:
         global t2s
         
         if (None == txt) or ("" == strip(txt)):
-            return (np.zeros(1), 24000)
-        return t2s(txt)
+            return ([1], 24000)
+        audio, sr = t2s(txt)
+        return audio.tolist(), sr
     
     def GetAudio(self) -> str:
         global s2t
```

**File**: `ailice/ui/app.py` (modified, +1/-1)
```diff
@@ -247,7 +247,7 @@ def upload_audio():
         
         if config.speechOn:
             audio_data, sample_rate = librosa.load(filepath)
-            message = speech.Speech2Text(audio_data, sample_rate)
+            message = speech.Speech2Text(audio_data.tolist(), sample_rate)
         else:
             message = f"![audio]({str(filepath)})"
         return Response(generate_response(f"{message}"), mimetype='text/event-stream')
```

---

### Incident Patch 13: `7e783266` (2025-03-29)
**Commit Message**: 1. fixed a bunch of bugs in lightRPC encryption. AI generated code is unreliable.

**File**: `ailice/common/lightRPC.py` (modified, +27/-29)
```diff
@@ -41,11 +41,6 @@ def GenerateCertificates(baseDir, name):
     publicFile, secretFile = zmq.auth.create_certificates(keysDir, name)
     return publicFile, secretFile
 
-def LoadCertificate(filename):
-    with open(filename, 'r') as f:
-        keyText = f.read()
-    return keyText
-
 def validate_methods(cls, methodList=None):
     for name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
         if (not name.startswith('_')) and ((methodList is None) or (name in methodList)):
@@ -67,7 +62,7 @@ def __getattr__(self, name):
         return getattr(self.obj, name)
 
 class GenesisRPCServer(object):
-  def __init__(self, objCls, objArgs, url, APIList, enableSecurity=False, keysDir=None):
+  def __init__(self, objCls, objArgs, url, APIList, enableSecurity=False, serverKeyPath=None, clientKeysDir=None):
     self.objCls = validate_methods(objCls, APIList)
     self.objArgs = objArgs
     self.url = url
@@ -79,19 +74,18 @@ def __init__(self, objCls, objArgs, url, APIList, enableSecurity=False, keysDir=
     
     self.enableSecurity = enableSecurity
     if enableSecurity:
-      if keysDir is None:
-        keysDir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'certificates')
+      if serverKeyPath is None:
+        raise ValueError("A value to serverKeyPath is necessary but not specified.")
       
       self.auth = ThreadAuthenticator(self.context)
       self.auth.start()
-      self.auth.configure_curve(domain='*', location=zmq.auth.CURVE_ALLOW_ANY)
+      self.auth.configure_curve(domain='*', location=zmq.auth.CURVE_ALLOW_ANY if (clientKeysDir is None) else clientKeysDir)
       
-      serverPublicFile, serverSecretFile = zmq.auth.find_certificates(keysDir, "server")
-      serverPublic, serverSecret = zmq.auth.load_certificate(serverSecretFile)
+      serverPublic, serverSecret = zmq.auth.load_certificate(serverKeyPath)
       
-      self.receiver.curve_secretkey = serverSecret
-      self.receiver.curve_publickey = serverPublic
-      self.receiver.curve_server = True
+      self.receiver.setsockopt(zmq.CURVE_PUBLICKEY, serverPublic)
+      self.receiver.setsockopt(zmq.CURVE_SECRETKEY, serverSecret)
+      self.receiver.setsockopt(zmq.CURVE_SERVER, True)
     
     self.receiver.bind(url)
     self.dealer = self.context.socket(zmq.DEALER)
@@ -166,8 +160,8 @@ def Worker(self):
     return
 
 
-def makeServer(objCls, objArgs, url, APIList, enableSecurity=False, keysDir=None):
-  return GenesisRPCServer(objCls, objArgs, url, APIList, enableSecurity, keysDir)
+def makeServer(objCls, objArgs, url, APIList, enableSecurity=False, serverKeyPath=None, clientKeysDir=None):
+  return GenesisRPCServer(objCls, objArgs, url, APIList, enableSecurity, serverKeyPath, clientKeysDir)
 
 def AddMethod(kls, methodName, methodMeta):
   signature = methodMeta['signature']
@@ -183,7 +177,14 @@ def methodTemplate(self,*args,**kwargs):
   setattr(kls,methodName,methodTemplate)
 
 
-def makeClient(url, returnClass=False, enableSecurity=False, keysDir=None, serverPublicKey=None):
+def makeClient(url, returnClass=False, enableSecurity=False, clientKeyPath=None, serverKeyPath=None):
+  if enableSecurity:
+    if clientKeyPath is None:
+      raise ValueError("A value to clientKeyPath is necessary but not specified.")
+    
+    clientPublic, clientSecret = zmq.auth.load_certificate(clientKeyPath)
+    serverPublic, _ = zmq.auth.load_certificate(serverKeyPath)
+  
   class RemoteGenerator:
       def __init__(self, client, generatorID):
           self.client = client
@@ -214,15 +215,7 @@ def __init__(self):
       self.enableSecurity = enableSecurity
       
       if self.enableSecurity:
-        if keysDir is None:
-          keysDir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'certificates')
-        
-        clientPublicFile, clientSecretFile = zmq.auth.find_certificates(keysDir, "client")
-        clientPublic, clientSecret = zmq.auth.load_certificate(clientSecretFile)
-        
-        self.clientPublic = clientPublic
-        self.clientSecret = clientSecret
-        self.serverPublic = serverPublicKey
+        self.clientPublic, self.clientSecret, self.serverPublic = clientPublic, clientSecret, serverPublic
       
       ret = self.Send({'CREATE':''})
       if "exception" in ret:
@@ -233,9 +226,9 @@ def __init__(self):
     def Send(self, msg):
       with self.context.socket(zmq.REQ) as socket:
         if self.enableSecurity:
-          socket.curve_secretkey = self.clientSecret
-          socket.curve_publickey = self.clientPublic
-          socket.curve_serverkey = self.serverPublic
+          socket.setsockopt(zmq.CURVE_PUBLICKEY, self.clientPublic)
+          socket.setsockopt(zmq.CURVE_SECRETKEY, self.clientSecret)
+          socket.setsockopt(zmq.CURVE_SERVERKEY, self.serverPublic)
         
         socket.setsockopt(zmq.CONNECT_TIMEOUT, 10000)
         socket.setsockopt(zmq.HEARTBEAT_IVL, 2000)
@@ -258,6 +251,11 @@ def __del__(self):
       return
   
   with
```

---

### Incident Patch 14: `91f48270` (2025-03-29)
**Commit Message**: 1. fixed an issue in AConversation.

**File**: `ailice/core/AConversation.py` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ def AddRecord(role, time, entry, msg, attachments):
                 if {d['role'], data[i-1]['role']} <= {"USER", "SYSTEM"}:
                     AddRecord('ASSISTANT', None, False, '<EMPTY MSG>', [])
             AddRecord(d['role'], d.get('time', None), d.get('entry', None), d['msg'] if '' != d['msg'] else '<EMPTY MSG>', [{'type': a['type'], 'tag': a.get('tag', None), 'content': FromJson(a['content'])} for a in d['attachments']])
-        if data[-1]['role'] in ['USER', 'SYSTEM']:
+        if (len(data) > 0) and (data[-1]['role'] in ['USER', 'SYSTEM']):
             AddRecord('ASSISTANT', None, False, '<EMPTY MSG>', [])
         return
     
```

---

### Incident Patch 15: `208d949a` (2025-03-27)
**Commit Message**: 1. fixed a bug that would invalidate services/MCP servers configurations in config.json.

**File**: `ailice/AIliceMain.py` (modified, +4/-6)
```diff
@@ -99,12 +99,10 @@ def mainLoop(session: str):
     
     logger = ALogger(speech=None)
     processor = AProcessor(name='AIlice', modelID=config.modelID, promptName=config.prompt, llmPool=llmPool, promptsManager=promptsManager, services=clientPool, messenger=AMessenger(), outputCB=logger.Receiver, gasTank=AGasTank(1e8), config=config, collection=collection)
-    processor.RegisterModules([config.services['browser']['addr'],
-                               config.services['arxiv']['addr'],
-                               config.services['google']['addr'],
-                               config.services['duckduckgo']['addr'],
-                               config.services['scripter']['addr'],
-                               config.services['computer']['addr']] + ([config.services['speech']['addr']] if config.speechOn else []))
+    moduleList = [serviceCfg['addr'] for serviceName, serviceCfg in config.services.items()]
+    if not config.speechOn:
+        moduleList.remove(config.services['speech']['addr'])
+    processor.RegisterModules(moduleList)
 
     if "" != session.strip():
         if os.path.exists(historyPath):
```

**File**: `ailice/ui/app.py` (modified, +3/-8)
```diff
@@ -126,14 +126,9 @@ def LoadSession(sessionName: str):
         logger = ALogger(speech=None)
         
         processor = AProcessor(name="AIlice", modelID=config.modelID, promptName=config.prompt, llmPool=llmPool, promptsManager=promptsManager, services=clientPool, messenger=messenger, outputCB=logger.Receiver, gasTank=AGasTank(1e8), config=config, collection=sessionName)
-        moduleList = [config.services['browser']['addr'],
-                      config.services['arxiv']['addr'],
-                      config.services['google']['addr'],
-                      config.services['duckduckgo']['addr'],
-                      config.services['scripter']['addr'],
-                      config.services['computer']['addr']]
-        if config.speechOn:
-            moduleList.append(config.services['speech']['addr'])
+        moduleList = [serviceCfg['addr'] for serviceName, serviceCfg in config.services.items()]
+        if not config.speechOn:
+            moduleList.remove(config.services['speech']['addr'])
         processor.RegisterModules(moduleList)
         
         p = os.path.join(sessionPath, "ailice_history.json")
```

#### Recent Merged Pull Requests:
- **PR #67** (closed): Docs fix spelling issues (@nnsW3)
- **PR #63** (closed): Update ASpeech.py (@Yash-2707)
- **PR #62** (closed): Update AServices.py (@Yash-2707)
- **PR #60** (closed): Enhance Prompt Generation Logic and Code Structure for APromptCoder (@YadlaMani)
- **PR #59** (2024-10-24): Create requirements.txt (@PentesterPriyanshu)
- **PR #4** (2024-01-12): Update README.md (@eltociear)
- **PR #3** (closed): added missing dependency `chardet` (@iksnae)
- **PR #2** (2023-12-02): 1. README.md updated. (@stevenlu137)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
