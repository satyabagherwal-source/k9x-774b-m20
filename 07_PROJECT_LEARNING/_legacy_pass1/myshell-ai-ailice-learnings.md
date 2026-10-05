# Forensic Learning Record (Deep Inspection): myshell-ai/AIlice

> **Canonical Artifact**: `07_PROJECT_LEARNING/myshell-ai-ailice-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/myshell-ai/AIlice](https://github.com/myshell-ai/AIlice))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:26:53.291Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `myshell-ai/AIlice`
- **Description**: AIlice is a fully autonomous, general-purpose AI agent.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1417 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ailice/AIliceMain.py`
```
import time
import os
import simplejson as json
import re
import appdirs
import traceback
from termcolor import colored

from ailice.common.AConfig import config
from ailice.core.AProcessor import AProcessor
from ailice.core.llm.ALLMPool import ALLMPool
from ailice.common.utils.ALogger import ALogger
from ailice.common.ARemoteAccessors import AClientPool
from ailice.common.AMessenger import AMessenger
from ailice.common.AGas import AGasTank
from ailice.AServices import StartServices, TerminateSubprocess

from ailice.common.APrompts import APromptsManager
from ailice.prompts.APromptChat import APromptChat
from ailice.prompts.APromptMain import APromptMain
from ailice.prompts.APromptSearchEngine import APromptSearchEngine
from ailice.prompts.APromptResearcher import APromptResearcher
from ailice.prompts.APromptCoder import APromptCoder
from ailice.prompts.APromptModuleCoder import APromptModuleCoder
from ailice.prompts.APromptCoderProxy import APromptCoderProxy
from ailice.prompts.APromptDocReader import APromptDocReader


def GetInput(speech) -> str:
    if config.speechOn:
        print(colored("USER: ", "green"), end="", flush=True)
        inp = speech.GetAudio()
        print(inp, end="", flush=True)
        print("")
    else:
        inp = input(colored("USER: ", "green"))
    return inp

def mainLoop(session: str):
    print(colored("In order to simplify installation and usage, we have set local execution as the default behavior, which means AI has complete control over the local environment. \
To prevent irreversible losses due to potential AI errors, you may consider one of the following two methods: the first one, run AIlice in a virtual machine; the second one, install Docker, \
use the provided Dockerfile to build an image and container, and modify the relevant configurations in config.json. For detailed instructions, please refer to the documentation.", "red"))
    
    print(colored("If you find that ailice is running slowly or experiencing high CPU usage, please run `ailice_turbo` to install GPU acceleration support.", "green"))
    
    if "" != session.strip():
        sessionPath = os.path.join(config.chatHistoryPath, session)
        storagePath = os.path.join(sessionPath, "storage")
        historyPath = os.path.join(sessionPath, "ailice_history.json")
        os.makedirs(sessionPath, exist_ok=True)
        os.makedirs(storagePath, exist_ok=True)
    else:
        storagePath = ""
    
    clientPool = AClientPool()
    StartServices()
    for i in range(5):
        try:
            clientPool.Init()
            break
        except Exception as e:
            if i == 4:
                print(f"It seems that some peripheral module services failed to start. EXCEPTION: {str(e)}")
                print(e.tb) if hasattr(e, 'tb') else traceback.print_tb(e.__traceback__)
                exit(-1)
            time.sleep(5)
            continue
    
    print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
    print("We now start the vector database. Note that this may include downloading the model weights, so it may take some time.")
    storage = clientPool.GetClient(config.services['storage']['addr'])
    with storage.Timeout(-1):
        msg = storage.Open(storagePath)
    print(msg)
    print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))

    if config.speechOn:
        speech = clientPool.GetClient(config.services['speech']['addr'])
        print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
        print("The speech module is preparing speech recognition and TTS models, which may include the work of downloading weight data, so it may take a long time.")
        with speech.Timeout(-1):
            speech.PrepareModel()
        print("The speech module model preparation work is completed.")
        print(colored(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>", "green"))
        if any([re.fullmatch(r"(cuda|cpu)(:(\d+))?", s) == None for s in [config.ttsDevice, config.sttDevice]]):
            print("the value of ttsDevice and sttDevice should be a valid cuda device, such as cuda, cuda:0, or cpu, the default is cpu.")
            exit(-1)
        else:
            speech.SetDevices({"tts": config.ttsDevice, "stt": config.sttDevice})
    else:
        speech = None
    
    timestamp = str(int(time.time()))
    collection = "ailice_" + timestamp

    promptsManager = APromptsManager()
    promptsManager.Init(storage=storage, collection=collection)
    promptsManager.RegisterPrompts([APromptChat, APromptMain, APromptSearchEngine, APromptResearcher, APromptCoder, APromptModuleCoder, APromptCoderProxy, APromptDocReader])
    
    llmPool = ALLMPool(config=config)
    llmPool.Init([config.modelID])
    
    logger = ALogger(speech=None)
    processor = AProcessor(name='AIlice', modelID=config.modelID, promptName=config.prompt, llmPool=llmPool, promptsManager=promptsManager, services=clientPool, messenger=AMessenger(), outputCB=logger.Receiver, gasTank=AGasTank(1e8), config=config, collection=collection)
    moduleList = [serviceCfg['addr'] for serviceName, serviceCfg in config.services.items()]
    if not config.speechOn:
        moduleList.remove(config.services['speech']['addr'])
    processor.RegisterModules(moduleList)

    if "" != session.strip():
        if os.path.exists(historyPath):
            with open(historyPath, "r") as f:
                processor.FromJson(json.load(f))
    
    while True:
        if "" != session.strip():
            with open(historyPath, "w") as f:
                    json.dump(processor.ToJson(), f, indent=2)
        inpt = GetInput(speech)
        processor.SetGas(1e8)
        try:
            processor(inpt)
        except Exception as e:
            continue
    return

def main():
    config.Initialize(configFile=os.path.join(appdirs.user_config_dir("ailice", "Steven Lu"), "config.json"))
    
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--modelID',type=str,default=config.modelID, help="modelID specifies the model. There are two modes for model configuration. In the first mode, the model is uniformly specified by modelID. In the second mode, different types of agents will run on different models. When this parameter is an empty string (unspecified), the second mode will be used automatically, i.e., the models configured individually for different agents under the agentModelConfig field in config.json will be used. The currently supported models can be seen in config.json. Default: %(default)s")
    parser.add_argument('--quantization',type=str,default=config.quantization, help="quantization is the quantization option, you can choose 4bit or 8bit. Default: %(default)s")
    parser.add_argument('--maxMemory',type=dict,default=config.maxMemory, help='maxMemory is the memory video memory capacity constraint, the format when set is like "{0:"23GiB", 1:"24GiB", "cpu": "64GiB"}". Default: %(default)s')
    parser.add_argument('--prompt',type=str,default=config.prompt, help="prompt specifies the prompt to be executed, which is the type of agent. Default: %(default)s")
    parser.add_argument('--temperature',type=float,default=config.temperature, help="temperature sets the temperature parameter of LLM reasoning. Default: %(default)s")
    parser.add_argument('--flashAttention2',type=bool,default=config.flashAttention2, help="flashAttention2 is the switch to enable flash attention 2 to speed up inference. It may have a certain impact on output quality. Default: %(default)s")
    parser.add_argument('--contextWindowRatio',type=float,default=config.contextWindowRatio, help="contextWindowRatio is a user-specified proportion coefficient, which determines the proportion of the upper limit of the prompt length constructed during inference to the LLM context window in some cases. Default: %(default)s")
    parser.add_argument('--speechOn',type=bool,default=config.speechOn, help="speechOn is the switch to enable voice conversation. Please note 
```

### Core Architecture Module: `ailice/AIliceTurbo.py`
```
import os
import subprocess
import sys
def detect_hardware():
    hardwares = []
    try:
        subprocess.run(["nvidia-smi"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        hardwares.append("cuda")
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    try:
        subprocess.run(["rocminfo"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        hardwares.append("rocm")
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    try:
        subprocess.run(["vulkaninfo"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        hardwares.append("vulkan")
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return hardwares

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--hardware',type=str,default=None, help="Specify preferred hardware, options include: cuda/rocm/vulkan.")
    kwargs = vars(parser.parse_args())

    hardwares = detect_hardware()
    print(f"Detected {'/'.join(hardwares)} support.")
    
    if (kwargs["hardware"] is None) and (len(hardwares) > 0):
        hardware = hardwares[0]
    elif (kwargs["hardware"] in hardwares):
        hardware = kwargs["hardware"]
    
    if hardware == "cuda":
        os.environ["CMAKE_ARGS"] = "-DGGML_CUDA=on -DLLAVA_BUILD=off"
        print("Using CUDA for installation.")
    elif hardware == "rocm":
        os.environ["CMAKE_ARGS"] = "-DGGML_HIPBLAS=on -DLLAVA_BUILD=off"
        print("Using HIPBLAS for installation.")
    elif hardware == "vulkan":
        os.environ["CMAKE_ARGS"] = "-DGGML_VULKAN=on -DLLAVA_BUILD=off"
        print("Using Vulkan for installation.")
    else:
        print("No compatible hardware detected. Exiting.")
        sys.exit(0)
    
    os.environ["FORCE_CMAKE"] = "1"
    subprocess.run([sys.executable, "-m", "pip", "install", "llama-cpp-python", "--force-reinstall", "--upgrade", "--no-cache-dir"])
if __name__ == "__main__":
    main()
```

### Core Architecture Module: `ailice/AServices.py`
```
import os
import sys
import subprocess
import signal
import psutil

from ailice.common.AConfig import config

processes = []

def StartServices():
    for process in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if process.info['cmdline'] and ('ailice.modules' in ' '.join(process.info['cmdline'])):
                print(f"killing proc with PID {process.info['pid']}")
                process.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    for serviceName, cfg in config.services.items():
        if ("speech" == serviceName) and not config.speechOn:
            continue
        if ("cmd" not in cfg) or ("" == cfg['cmd'].strip()):
            print(f"{serviceName}'s cmd is not configured and will attempt to connect {cfg['addr']} directly.")
            continue
        p = subprocess.Popen(cfg['cmd'], shell=True, cwd=None, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        processes.append(p)
        print(serviceName," started.")
    signal.signal(signal.SIGINT, TerminateSubprocess)
    signal.signal(signal.SIGTERM, TerminateSubprocess)

def TerminateSubprocess(signum=None, frame=None):
    for p in processes:
        if p.poll() is None:
            p.terminate()
            p.wait()
    sys.exit(0)
```

### Core Architecture Module: `ailice/app/app.py`
```
import os
import sys
import simplejson as json
import traceback
import requests
import appdirs
import tempfile
import traceback
import logging

from functools import wraps
from logging.handlers import RotatingFileHandler
from urllib.parse import unquote
from flask import render_template, request, jsonify, Response, send_file, redirect, url_for, session, make_response

from ailice.common.AConfig import config
from ailice.AServices import StartServices, TerminateSubprocess

from ailice.app.factory import CreateApp
from ailice.app.context import UserContext
from ailice.app.log import logger
from ailice.app.exceptions import AWExceptionSessionNotExist

from datetime import datetime, timedelta

AILICE_CONFIG = os.path.join(appdirs.user_config_dir("ailice", "Steven Lu"), "config.json")

app = CreateApp()
context = UserContext(userID="0")

def Init():
    StartServices()
    logger.info("Services started")
    
    context.Create()

    InitServer()
    return

def InitServer():
    os.makedirs(f'{config.chatHistoryPath}/logs', exist_ok=True)
    handler = RotatingFileHandler(f'{config.chatHistoryPath}/logs/app.log', maxBytes=1000000, backupCount=5)
    handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
    logger.info(f"Flask app logger configured to write to {config.chatHistoryPath}/logs/app.log")
    return

def main():
    config.Initialize(configFile=AILICE_CONFIG)
    logger.info("Configuration initialized")
    
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--modelID',type=str,default=config.modelID, help="modelID specifies the model. There are two modes for model configuration. In the first mode, the model is uniformly specified by modelID. In the second mode, different types of agents will run on different models. When this parameter is an empty string (unspecified), the second mode will be used automatically, i.e., the models configured individually for different agents under the agentModelConfig field in config.json will be used. The currently supported models can be seen in config.json. Default: %(default)s")
    parser.add_argument('--quantization',type=str,default=config.quantization, help="quantization is the quantization option, you can choose 4bit or 8bit. Default: %(default)s")
    parser.add_argument('--maxMemory',type=dict,default=config.maxMemory, help='maxMemory is the memory video memory capacity constraint, the format when set is like "{0:"23GiB", 1:"24GiB", "cpu": "64GiB"}". Default: %(default)s')
    parser.add_argument('--prompt',type=str,default=config.prompt, help="prompt specifies the prompt to be executed, which is the type of agent. Default: %(default)s")
    parser.add_argument('--temperature',type=float,default=config.temperature, help="temperature sets the temperature parameter of LLM reasoning. Default: %(default)s")
    parser.add_argument('--flashAttention2',type=bool,default=config.flashAttention2, help="flashAttention2 is the switch to enable flash attention 2 to speed up inference. It may have a certain impact on output quality. Default: %(default)s")
    parser.add_argument('--contextWindowRatio',type=float,default=config.contextWindowRatio, help="contextWindowRatio is a user-specified proportion coefficient, which determines the proportion of the upper limit of the prompt length constructed during inference to the LLM context window in some cases. Default: %(default)s")
    parser.add_argument('--speechOn',type=bool,default=config.speechOn, help="speechOn is the switch to enable voice conversation. Please note that the voice dialogue is currently not smooth yet. Default: %(default)s")
    parser.add_argument('--ttsDevice',type=str,default=config.ttsDevice,help='ttsDevice specifies the computing device used by the text-to-speech model. You can set it to "cuda" if there is enough video memory. Default: %(default)s')
    parser.add_argument('--sttDevice',type=str,default=config.sttDevice,help='sttDevice specifies the computing device used by the speech-to-text model. You can set it to "cuda" if there is enough video memory. Default: %(default)s')
    parser.add_argument('--resetApiKey',action='store_true', help="Whether to reset the model's API key after startup.")
    parser.add_argument('--chatHistoryPath',type=str,default=config.chatHistoryPath, help="chatHistoryPath is used to specify the chat history storage path. Default: %(default)s")
    parser.add_argument('--certificate',type=str,default=config.certificate, help="""Certificate settings for the web interface. The simplest option is an empty string, which will use the HTTP protocol for the UI web page. Setting it to 'adhoc' will use a self-generated certificate, providing encryption for the data flow between the UI and server, but it requires dismissing browser security warnings. The most secure method is to apply for a certificate and set this parameter to '{"cert": "your_cert.pem", "key": "your_key.pem")'. Default: %(default)s""")
    parser.add_argument('--expose',type=bool,default=False, help="Whether to provide public access. Default: %(default)s")
    parser.add_argument('--logLevel',type=str,default="INFO", help="Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL). Default: %(default)s")
    #parser.add_argument('--share',type=bool,default=False, help="Whether to create a publicly shareable link for AIlice.")
    kwargs = vars(parser.parse_args())

    # Set log level based on command line argument
    log_level = getattr(logging, kwargs['logLevel'].upper(), logging.INFO)
    logger.setLevel(log_level)
    logger.info(f"Log level set to {kwargs['logLevel']}")

    config.Check4Update(kwargs['modelID'], kwargs['resetApiKey'])
    config.Update(kwargs)
    logger.info(f"Configuration updated with command line arguments")

    try:
        Init()
        if kwargs['certificate'] == '':
            ssl_context = None
            logger.info("Starting server with HTTP (no SSL)")
        elif kwargs['certificate'] == 'adhoc':
            ssl_context = 'adhoc'
            logger.info("Starting server with self-signed certificate")
        else:
            try:
                certCfg = json.loads(kwargs['certificate'])
                ssl_context = (certCfg['cert'], certCfg['key'])
                logger.info(f"Starting server with certificate: {certCfg['cert']} and key: {certCfg['key']}")
            except Exception as e:
                error_msg = """The certificate configuration you entered could not be recognized. Please set it according to the following format: {"cert": "your_cert.pem", "key": "your_key.pem")"""
                logger.error(f"{error_msg}. Error: {str(e)}")
                print(error_msg)
                sys.exit(0)
        
        host = '0.0.0.0' if kwargs['expose'] else '127.0.0.1'
        port = 5000
        logger.info(f"Starting Flask server on {host}:{port}")
        app.run(debug=False, ssl_context=ssl_context, host=host, port=port)
        
    except Exception as e:
        error_msg = f"Encountered an exception, AIlice is exiting: {str(e)}"
        logger.critical(error_msg, exc_info=True)
        print(error_msg)
        if hasattr(e, 'tb'):
            print(e.tb)
        else:
            traceback.print_tb(e.__traceback__)
        TerminateSubprocess()
        raise

@app.route('/get_announcement', methods=['GET'])
def get_announcement():
    logger.debug("Announcement requested")
    return jsonify({'announcement': ""})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/list_agent_type', methods=['GET'])
def list_agent_type():
    logger.debug("Agent type list requested")
    return jsonify(["main", "researcher", "search-engine", "coder-proxy", "coder", "doc-reader", "module-coder", "chat"])

@app.route('/current_session', methods=['GET'])
def current_session():
    logger.debug("Current session requested"
```

### Core Architecture Module: `ailice/app/cleaner.py`
```
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from ailice.app.log import logger


class SessionCleaner:
    def __init__(self, max_workers=5):
        self.pendingGCPool = {}
        self.poolLock = threading.Lock()
        
        self.gcThread = threading.Thread(target=self.GCThread, daemon=True)
        self.gcThread.start()
        self.executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="SessionReleaser")
        logger.info(f"SessionCleaner initialized with {max_workers} release workers and GC thread started")
        return
    
    def AddSessionToGC(self, sessionName, session):
        with self.poolLock:
            self.pendingGCPool[sessionName] = session
            logger.info(f"Session '{sessionName}' added to GC pool")
    
    def IsSessionInGC(self, sessionName):
        with self.poolLock:
            return sessionName in self.pendingGCPool
    
    def ReleaseSession(self, session):
        session._release_flag = True
        try:
            session.Release()
        finally:
            session._release_flag = False
        return
    
    def GCThread(self):
        while True:
            try:
                inactiveList = []
                with self.poolLock:
                    for sessionName, session in self.pendingGCPool.items():
                        if session.state == "init":
                            inactiveList.append(sessionName)
                        elif (not getattr(session, "_release_flag", False)) and session.IsStopped():
                            self.executor.submit(self.ReleaseSession, session)
                    
                    for sessionName in inactiveList:
                        self.pendingGCPool.pop(sessionName)
                        logger.info(f"Session '{sessionName}' removed from GC pool")
                
                if len(inactiveList) > 0:
                    logger.info(f"{len(inactiveList)} sessions released. GCPool size: {len(self.pendingGCPool)}")
                time.sleep(1)
            except Exception as e:
                logger.error(f"Unexpected exception in GCThread: {str(e)}")
        return


cleaner = SessionCleaner()
```

### Core Architecture Module: `ailice/app/config.py`
```
from typing import Dict, List, Optional, Any, Union, Annotated, Literal
from pydantic import BaseModel, field_validator, Field
from pydantic.networks import AnyUrl

class AiliceModelConfig(BaseModel):
     formatter: str
     contextWindow: int
     systemAsUser: bool
     
class AiliceWebProviderConfig(BaseModel):
    modelWrapper: str
    apikey: Optional[str] = None
    baseURL: Optional[Union[AnyUrl, str]] = None
    modelList: dict[str, AiliceModelConfig]
    
    @field_validator('baseURL')
    def validate_base_url(cls, v):
        if v == '':
            return v
        return v


class AiliceWebServiceConfig(BaseModel):
    protocol: Literal["aexp", "mcp"]
    addr: AnyUrl
    
class AiliceWebConfig(BaseModel):
    agentModelConfig: dict[str, str]
    models: dict[str, AiliceWebProviderConfig]
    temperature: Annotated[float, Field(ge=0.0)]
    contextWindowRatio: Annotated[float, Field(ge=0.0, le=1.0)]
    
    
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

### Incident Patch 1: `d876ee1b` (2025-06-12)
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

### Incident Patch 2: `c72e8f53` (2025-05-25)
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

### Incident Patch 3: `72de7929` (2025-05-25)
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

### Incident Patch 4: `38e99656` (2025-05-24)
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
+            traceback.print_tb(e.__tra
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

### Incident Patch 5: `800232ad` (2025-05-20)
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

### Incident Patch 6: `09d0d99e` (2025-04-11)
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

### Incident Patch 7: `80352d77` (2025-03-31)
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

### Incident Patch 8: `52500350` (2025-03-30)
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

### Incident Patch 9: `7e783266` (2025-03-29)
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
-        self.c
```

---

### Incident Patch 10: `91f48270` (2025-03-29)
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
