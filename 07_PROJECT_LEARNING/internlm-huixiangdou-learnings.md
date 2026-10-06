# Forensic Learning Record (Deep Inspection): InternLM/HuixiangDou

> **Canonical Artifact**: `07_PROJECT_LEARNING/internlm-huixiangdou-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/InternLM/HuixiangDou](https://github.com/InternLM/HuixiangDou))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:53.592Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `InternLM/HuixiangDou`
- **Description**: HuixiangDou: Overcoming Group Chat Scenarios with LLM-based Technical Assistance
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2500 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `huixiangdou/primitive/utils.py`
```
import asyncio
from loguru import logger

def always_get_an_event_loop() -> asyncio.AbstractEventLoop:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.info("Creating a new event loop in a sub-thread.")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop
```

### Core Architecture Module: `web/front-end/scripts/utils.ts`
```
import path from 'path';

export const resolvePath = p => path.resolve(__dirname, '..', p);

```

### Core Architecture Module: `web/front-end/src/hooks/useLocale.ts`
```
import { useContext, useState, useEffect } from 'react';
import { GlobalLangeContext } from '@components/global-lang';
import Locale from '@/locales';

export const useLocale = (propertyName: string) => {
    const [locales, setLocales] = useState<any>({});
    const { locale: lang } = useContext(GlobalLangeContext);

    useEffect(() => {
        if (lang && Locale[lang] && Locale[lang][propertyName]) {
            setLocales(Locale[lang][propertyName]);
        }
    }, [lang, propertyName]);

    return locales;
};

```

### Core Architecture Module: `web/front-end/src/utils/ajax.ts`
```
import axios, { AxiosError } from 'axios';
import qs from 'qs';
import { BaseURL, ApiPrefix } from '@config/base-url';
import { requestInterceptors } from '@interceptors/request';
import { responsetInterceptors, responsetErrorInterceptors } from '@interceptors/response';

export const compose = (...args: any[]) => {
    const fns = args.map(arg => {
        return typeof arg === 'function' ? arg : () => arg;
    });

    return (...innerArgs: any) => {
        let index = 0;
        let result;
        result = fns.length === 0 ? innerArgs : fns[index++](...innerArgs);

        while (index < fns.length) {
            result = fns[index++](result);
        }

        return result;
    };
};

export const instance = axios.create({
    method: 'get',
    timeout: 300000,
    responseType: 'json',
    paramsSerializer: params => qs.stringify(params, { indices: false })
});

const MetaDataMap = new Map();
export interface Meta {
    isAllResponseBody?:boolean
    isIgnoreError?:boolean
    isIgnoreGatewayError?:boolean
}

const getMeta = (url) => {
    let meta:Meta = {};
    if (MetaDataMap.has(url)) {
        meta = MetaDataMap.get(url);
        MetaDataMap.delete(url);
    }
    return meta;
};

const inBuildHandleMetaResponseInterceptors = (response) => {
    return {
        ...response,
        __meta: getMeta(response.config.url)
    };
};

const inBuildHandleMetaErrorInterceptors = (error:AxiosError) => {
    const { response } = error;
    return {
        ...error,
        __meta: getMeta(response.config.url)
    };
};

responsetInterceptors.unshift(inBuildHandleMetaResponseInterceptors);
responsetErrorInterceptors.unshift(inBuildHandleMetaErrorInterceptors);

const handleRequestInterceptors = compose(...requestInterceptors);
const handleResponsetInterceptors = compose(...responsetInterceptors);
const handleResponsetErrorInterceptors = compose(...responsetErrorInterceptors);

instance.interceptors.request.use(
    handleRequestInterceptors,
    err => (Promise.reject(err))
);

instance.interceptors.response.use(handleResponsetInterceptors, handleResponsetErrorInterceptors);

export interface DefaultRespDTO<T> {
    msgCode: number;
    msg: string;
    data: T;
}

export const ajax = <T>(api, {
    method = 'GET',
    params = {}, // url query参数
    data = {}, // http body 参数
    ...rest
}): Promise<T> => {
    const url = `${BaseURL}${api}`;
    switch (method.toLowerCase()) {
    case 'get':
        return instance.get(url, { params, ...rest });
    case 'delete':
        return instance.delete(url, { params, data, ...rest });
    case 'post':
        return instance.post(url, data, { params, ...rest });
    case 'put':
        return instance.put(url, data, { params, ...rest });
    default:
        return instance.get(url, { params, ...rest });
    }
};

export const request = <T>(api: string, options: any = {}, prefix = ApiPrefix) => {
    const needPrefix = prefix || ApiPrefix;
    const fullApi = (`${needPrefix}/${api}`).replace(/\/\//g, '/');
    if (options.meta) {
        MetaDataMap.set(fullApi, options.meta);
        delete options.meta;
    }
    return ajax<T>(fullApi, options);
};

export default ajax;

```

### Core Architecture Module: `web/front-end/src/utils/mlog.ts`
```
import { MeasurementId, openLog } from '@config/log';

declare global {
    interface Window {
        dataLayer: any;
        mlog: any;
    }
}

window.mlog = null;

export const ScriptUrl = `https://www.googletagmanager.com/gtag/js?id=${MeasurementId}`;

class Mlog {
    log: ((...params: any[]) => void) | undefined;

    static init(): Promise<string | null> {
        if (!openLog) return Promise.resolve(null);

        return new Promise((resolve, reject) => {
            if (window.mlog && window.mlog instanceof Mlog) {
                resolve(null);
                return;
            }

            const syncScript = document.createElement('script');
            syncScript.innerHTML = `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${MeasurementId}');
            `;

            document.head.append(syncScript);
            const statisScript = document.createElement('script');
            statisScript.async = true;
            statisScript.src = ScriptUrl;
            statisScript.onload = () => {
                resolve(null);
            };

            statisScript.onerror = () => {
                reject('load failed');
            };
            document.head.insertBefore(statisScript, syncScript);
            window.mlog = new Mlog();
        });
    }

    static configUserId(userId) {
        if (!openLog) return;
        if (typeof window.gtag === 'function') {
            window.gtag('config', MeasurementId, {
                user_id: userId
            });
        }
    }

    static sendEvent(eventName: string, ext: any): void {
        if (!openLog) return;

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, ext);
        }
    }
}

export default Mlog;

```

### Core Architecture Module: `web/front-end/src/utils/utils.ts`
```
import { useIntl } from 'react-intl';
import qs from 'query-string';
import jsCookie from 'js-cookie';
import { clientId, logURL, TokenCookieDomain } from '@config/auth';
import { fetchCurrentUser as queryCurrentUser } from '@services/user';

export type Language = 'zh-CN' | 'en-US';
export const LanguageKey = 'locale';

export const loadLang = () => {
    const storeLang = window.localStorage.getItem(LanguageKey);
    if (storeLang) {
        return storeLang === 'en-US' ? 'en-US' : 'zh-CN';
    }
    // auto detect system language
    const systemLang = window.navigator.language;
    if (systemLang.includes('zh')) {
        localStorage.setItem(LanguageKey, 'zh-CN');
        return 'zh-CN';
    }
    // default lang: English
    localStorage.setItem(LanguageKey, 'en-US');
    return 'en-US';
};

let currentLang: Language = loadLang();
const saveLang = (lang: Language) => {
    window.localStorage.setItem(LanguageKey, lang);
    return lang;
};

export const getLang = () => currentLang;
export const setLang = (lang: Language) => {
    currentLang = saveLang(lang);
};

export const Intl = (id: string) => {
    return useIntl().formatMessage({ id });
};

// 用javascript删除某一个cookie的方法，该方法传入要删除cookie的名称
export const removeCookie = (cookieName: string) => {
    const cookies = document.cookie.split(';');// 将所有cookie键值对通过分号分割为数组
    // 循环遍历所有cookie键值对
    for (let i = 0; i < cookies.length; i++) {
        // 有些cookie键值对前面会莫名其妙产生一个空格，将空格去掉
        const _cookieName = cookies[i].split('=')[0].trim();
        // 比较每个cookie的名称，找到要删除的那个cookie键值对
        if (_cookieName === cookieName) {
            const exp = new Date();// 获取客户端本地当前系统时间

            // 将exp设置为客户端本地时间1分钟以前，将exp赋值给cookie作为过期时间后，就表示该cookie已经过期了, 那么浏览器就会将其立刻删除掉
            exp.setTime(exp.getTime() - 60);

            // 设置要删除的cookie的过期时间，即在该cookie的键值对后面再添加一个expires键值对
            // 并将上面的exp赋给expires作为值(注意expires的值必须为UTC或者GMT时间，不能用本地时间）
            // 那么浏览器就会将该cookie立刻删除掉
            document.cookie = `${cookies[i]};expires=${exp.toUTCString()};path=/;domain=${TokenCookieDomain}`;

            // 注意document.cookie的用法很巧妙，在对其进行赋值的时候是设置单个cookie的信息，但是获取document.cookie的值的时候是返回所有cookie的信息
            break;// 要删除的cookie已经在客户端被删除掉，跳出循环
        }
    }
};

export const formatQuery = (basename = '') => {
    const { search, pathname } = window.location;
    const url: string = pathname + search;
    let oauthCode;
    let realPath = '';
    const query = qs.parse(search) || {};
    const code = query.code || '';
    const lang = query.lang || '';
    if (url.startsWith(basename)) {
        // 判断 pathname 是否是以 basename 开头
        realPath = url.slice(basename?.length);
        realPath = realPath.startsWith('/') ? realPath : `/${realPath}`;
    }
    // 从 uaa 鉴权成功后，会把 code 拼在 url 最后
    // 兼容 子平台中用 code 作为业务参数
    if (Array.isArray(code)) {
        oauthCode = code[code.length - 1] || '';
    } else {
        oauthCode = code;
    }
    // 除了 code 外 url 还有其他的 query ，或者 有多个 code 的情况下
    // 鉴权 code 一定在 url 最后
    if (Object.keys(query).length > 1 || Array.isArray(code)) {
        realPath = realPath.replace(`&code=${oauthCode}`, '');
    } else {
        // url 只有 code 一个 query
        realPath = realPath.replace(`?code=${oauthCode}`, '');
    }

    realPath = realPath.replace(`?lang=${lang}&`, '?');
    realPath = realPath.replace(`?lang=${lang}`, '');
    realPath = realPath.replace(`&lang=${lang}`, '');

    return {
        realPath,
        oauthCode,
        lang,
    };
};

export const Token = {
    tokenKey: 'hxd_token',
    cookieTokenKey: 'hxd_token',
    getFromCookie() {
        return jsCookie.get(this.cookieTokenKey);
    },

    storage(token: string | null | undefined) {
        if (token === undefined || token === null) {
            // localStorage.removeItem(this.tokenKey);
            console.log(`[Token]: ${token} is invalidate`);
            return false;
        }
        localStorage.setItem(this.tokenKey, token);
        return true;
    },

    update(token: string | null) {
        const oldToken = localStorage.getItem(this.tokenKey);
        if (oldToken !== token) {
            this.storage(token);
        }
    },

    get() {
        const currentToken = this.getFromCookie() as (string | null);

        this.update(currentToken);
        return currentToken || localStorage.getItem(this.tokenKey);
    },

    has() {
        return !!this.get();
    },

    removeAll() {
        removeCookie(this.cookieTokenKey);
        removeCookie('ssouid');
        localStorage.removeItem(this.tokenKey);
    }
};

export const UserInfo = {
    key: '_$_userinfo_key_$_',

    async get(token: string) {
        const userInfo = localStorage.getItem(this.key);
        if (userInfo) return JSON.parse(userInfo);

        if (token && !userInfo) {
            const resp = await queryCurrentUser(token);
            localStorage.setItem(this.key, JSON.stringify(resp));
            return resp;
        }

        return null;
    },

    del() {
        localStorage.removeItem(this.key);
    }
};

// Function which concat all functions together
export const callFnsInSequence = (...fns: any[]) => (...args: any) => fns.forEach((fn) => fn && fn(...args));

export const jumpLogin = () => {
    let href = window.location.href;
    const url = new URL(href);

    if (url.searchParams.has('code')) {
        url.searchParams.delete('code');

        if (url.searchParams.has('lang')) url.searchParams.delete('lang');

        href = url.toString();
    }
    // debugger;
    return `${logURL}/authentication?redirect=${href}&clientId=${clientId}&lang=${getLang()}`;
};

export const isNeedAuth = (authPages): boolean => {
    const pathname = window.location.pathname.endsWith('/') ? window.location.pathname.slice(0, -1) : window.location.pathname;
    const matchPage = authPages.find(page => new RegExp(page).test(pathname));
    return !!matchPage;
};

```

### Core Architecture Module: `web/proxy/web_worker.py`
```
"""Pipeline."""
import argparse
import json
import random
import re
import time

import pytoml
import requests
from loguru import logger

from huixiangdou.services import ErrorCode, FeatureStore
from huixiangdou.services import (LLM, QueryTracker, WebSearch)


def openxlab_security(query: str, retry=1):
    life = 0
    while life < retry:
        try:
            headers = {'Content-Type': 'application/json'}
            data = {
                'bizId': str('antiseed' + str(time.time())),
                'contents': [query],
                'scopes': [],
                'vendor': 1,
            }

            resp = requests.post(
                'https://openxlab.org.cn/gw/checkit/api/v1/audit/text',
                data=json.dumps(data),
                headers=headers)
            logger.debug((resp, resp.content))

            json_obj = json.loads(resp.content)
            items = json_obj['data']

            block = False
            for item in items:
                label = item['label']
                if label is not None and label in ['porn', 'politics']:
                    suggestion = item['suggestion']
                    if suggestion == 'block':
                        logger.debug(items)
                        block = True
                        break

            if block:
                return False
            return True
        except Exception as e:
            logger.debug(e)
            life += 1

            randval = random.randint(1, int(pow(2, life)))
            time.sleep(randval)
    return False


class OpenXLabWorker:
    """The OpenXLab Worker class orchestrates the logic of handling user queries,
    generating responses and managing several aspects of a chat assistant. It
    enables feature storage, language model client setup, time scheduling and
    much more.

    Attributes:
        llm: A LLM instance that communicates with the language model.
        fs: An instance of FeatureStore for loading and querying features.
        config_path: A string indicating the path of the configuration file.
        config: A dictionary holding the configuration settings.
        language: A string indicating the language of the chat, default is 'zh' (Chinese).  # noqa E501
        context_max_length: An integer representing the maximum length of the context used by the language model.  # noqa E501

        Several template strings for various prompts are also defined.
    """

    def __init__(self, work_dir: str, config_path: str, language: str = 'zh'):
        """Constructs all the necessary attributes for the worker object.

        Args:
            work_dir (str): The working directory where feature files are located.
            config_path (str): The location of the configuration file.
            language (str, optional): Specifies the language to be used. Defaults to 'zh' (Chinese).  # noqa E501
        """
        self.llm = LLM(config_path=config_path)
        self.config_path = config_path
        self.config = None
        self.language = language
        with open(config_path, encoding='utf8') as f:
            self.config = pytoml.load(f)
        if self.config is None:
            raise Exception('worker config can not be None')

        self.context_max_length = -1
        llm_config = self.config['llm']
        self.context_max_length = llm_config['server']['remote_llm_max_text_length']

        # Switch languages according to the scenario.
        if self.language == 'zh':
            self.TOPIC_TEMPLATE = '告诉我这句话的主题，直接说主题不要解释：“{}”'
            self.SCORING_QUESTION_TEMPLATE = '“{}”\n请仔细阅读以上内容，判断句子是否是个疑问句，结果用 0～10 表示。直接提供得分不要解释。\n判断标准：有主语谓语宾语并且是疑问句得 10 分；缺少主谓宾扣分；陈述句直接得 0 分；不是疑问句直接得 0 分。直接提供得分不要解释。'  # noqa E501
            self.SCORING_RELAVANCE_TEMPLATE = '问题：“{}”\n材料：“{}”\n请仔细阅读以上内容，判断问题和材料的关联度，用0～10表示。判断标准：非常相关得 10 分；完全没关联得 0 分。直接提供得分不要解释。\n'  # noqa E501
            self.KEYWORDS_TEMPLATE = '谷歌搜索是一个通用搜索引擎，可用于访问互联网、查询百科知识、了解时事新闻等。搜索参数类型 string， 内容是短语或关键字，以空格分隔。\n你现在是{}交流群里的技术助手，用户问“{}”，你打算通过谷歌搜索查询相关资料，请提供用于搜索的关键字或短语，不要解释直接给出关键字或短语。'  # noqa E501
            self.SECURITY_TEMAPLTE = '判断以下句子是否涉及政治、辱骂、色情、恐暴、宗教、网络暴力、种族歧视等违禁内容，结果用 0～10 表示，不要解释直接给出得分。判断标准：涉其中任一问题直接得 10 分；完全不涉及得 0 分。直接给得分不要解释：“{}”'  # noqa E501
            self.PERPLESITY_TEMPLATE = '“question:{} answer:{}”\n阅读以上对话，answer 是否在表达自己不知道，回答越全面得分越少，用0～10表示，不要解释直接给出得分。\n判断标准：准确回答问题得 0 分；答案详尽得 1 分；知道部分答案但有不确定信息得 8 分；知道小部分答案但推荐求助其他人得 9 分；不知道任何答案直接推荐求助别人得 10 分。直接打分不要解释。'  # noqa E501
            self.SUMMARIZE_TEMPLATE = '{} \n 仔细阅读以上内容，总结得简短有力点'  # noqa E501
            # self.GENERATE_TEMPLATE = '材料：“{}”\n 问题：“{}” \n 请仔细阅读参考材料回答问题，材料可能和问题无关。如果材料和问题无关，尝试用你自己的理解来回答问题。如果无法确定答案，直接回答不知道。'  # noqa E501
            self.GENERATE_TEMPLATE = '材料：“{}”\n 问题：“{}” \n 请仔细阅读参考材料回答问题。'  # noqa E501
        else:
            self.TOPIC_TEMPLATE = 'Tell me the theme of this sentence, just state the theme without explanation: "{}"'  # noqa E501
            self.SCORING_QUESTION_TEMPLATE = '"{}"\nPlease read the content above carefully and judge whether the sentence is a thematic question. Rate it on a scale of 0-10. Only provide the score, no explanation.\nThe criteria are as follows: a sentence gets 10 points if it has a subject, predicate, object and is a question; points are deducted for missing subject, predicate or object; declarative sentences get 0 points; sentences that are not questions also get 0 points. Just give the score, no explanation.'  # noqa E501
            self.SCORING_RELAVANCE_TEMPLATE = 'Question: "{}", Background Information: "{}"\nPlease read the content above carefully and assess the relevance between the question and the material on a scale of 0-10. The scoring standard is as follows: extremely relevant gets 10 points; completely irrelevant gets 0 points. Only provide the score, no explanation needed.'  # noqa E501
            self.KEYWORDS_TEMPLATE = 'Google search is a general-purpose search engine that can be used to access the internet, look up encyclopedic knowledge, keep abreast of current affairs and more. Search parameters type: string, content consists of phrases or keywords separated by spaces.\nYou are now the assistant in the "{}" communication group. A user asked "{}", you plan to use Google search to find related information, please provide the keywords or phrases for the search, no explanation, just give the keywords or phrases.'  # noqa E501
            self.SECURITY_TEMAPLTE = 'Evaluate whether the following sentence involves prohibited content such as politics, insult, pornography, terror, religion, cyber violence, racial discrimination, etc., rate it on a scale of 0-10, do not explain, just give the score. The scoring standard is as follows: any violation directly gets 10 points; completely unrelated gets 0 points. Give the score, no explanation: "{}"'  # noqa E501
            self.PERPLESITY_TEMPLATE = 'Question: {} Answer: {}\nRead the dialogue above, does the answer express that they don\'t know? The more comprehensive the answer, the lower the score. Rate it on a scale of 0-10, no explanation, just give the score.\nThe scoring standard is as follows: an accurate answer to the question gets 0 points; a detailed answer gets 1 point; knowing some answers but having uncertain information gets 8 points; knowing a small part of the answer but recommends seeking help from others gets 9 points; not knowing any of the answers and directly recommending asking others for help gets 10 points. Just give the score, no explanation.'  # noqa E501
            self.SUMMARIZE_TEMPLATE = '"{}" \n Read the content above carefully, summarize it in a short and powerful way.'  # noqa E501
            self.GENERATE_TEMPLATE = 'Background Information: "{}"\n Question: "{}"\n Please read the reference material carefully and answer the question.'  # noqa E501

    def security_content(self, tracker, response: str):
        # 安全检查，通过为 true
        return True
        # if len(response) < 1:
        #     return True
        # if self.single_judge(self.SECURITY_TEMAPLTE.format(response),
        #     tracker=tracker,
        #     throttle=3,
        #     default=0):
        #     return False

        # if openxlab_security(response):
        #     return True
        # return False

    async def single_judge(self, prompt, tracker, throttle: int, default: int, **kwargs):
        """Generates a score based on the prompt, and then compares it to
        threshold.

        Args:
            prompt (str): The prompt for the language model.
            tracker (obj): An instance of QueryTracker logs the operations.
            throttle (int): Threshold value to compare the score against.
            default (int): Default score to be assigned in case of failure in score calculation.  # noqa E501

        Returns:
            bool: True if the score surpasses the throttle, otherwise False.
        """
        if prompt is None or len(prompt) == 0:
            return False

        score = default
        relation = await self.llm.chat(prompt=prompt)
        tracker.log('score' + prompt[0:20], [relation, throttle, default])
        filtered_relation = ''.join([c for c in relation if c.isdigit()])
        try:
            score_str = re.sub(r'[^\d]', ' ', filtered_relation).strip()
            score = int(score_str.split(' ')[0])
        except Exception as e:
            logger.error(str(e))
        if score >= throttle:
            return True
        return False

    async def generate(self, query, history, retriever, groupname):
        """Processes user queries and generates appropriate responses. It
        involves several steps including checking for valid questions,
        extracting topics, querying the feature store, searching the web, and
        generating responses from the language model.

        Args:
            query (str): User's query.
            history (list): Chat history.
            groupname (str): The group name in which user asked the query.

        Returns:
            
```

### Core Architecture Module: `web/util/image.py`
```
from web.model.base import Image


def detect_base64_image_suffix(base64: str) -> [Image, str]:
    if not base64 or len(base64) == 0:
        return [Image.INVALID, '']

    s = base64.split('base64,')
    if len(s) < 2:
        return [Image.INVALID, '']

    base64_prefix = s[0].lower()
    if 'data:image/jpeg;' == base64_prefix:
        return [Image.JPG, s[1]]
    if 'data:image/png;' == base64_prefix:
        return [Image.PNG, s[1]]
    if 'data:image/bmp;' == base64_prefix:
        return [Image.BMP, s[1]]

    return [Image.INVALID, '']

```

### Core Architecture Module: `web/util/log.py`
```
import logging


def log(name):
    """
    @param name: python file name
    @return: Logger
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter(
        '%(levelname)s:     %(asctime)s - %(module)s-%(funcName)s-line:%(lineno)d - %(message)s'
    )
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    return logger


def clear_other_log():
    for name, item in logging.Logger.manager.loggerDict.items():
        if not isinstance(item, logging.Logger):
            continue
        if 'aoe' not in name:
            item.setLevel(logging.CRITICAL)


clear_other_log()
logger = log('util')

```

### Core Architecture Module: `web/util/str.py`
```
import os
import random
import string
import time
from typing import List

import jwt
from fastapi import HTTPException

from web.config.env import HuixiangDouEnv


def gen_random_string(length=4) -> str:
    """
    :param length: random string's length
    :return: a string with the given length, includes only A-Za-z0-9
    """
    # 字符集包含所有大写字母和数字
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def gen_jwt(feature_store_id: str, qa_name: str, expire: int) -> str:
    """
    :param feature_store_id:
    :param qa_name: 知识库名称
    :param expire: 过期时间 unix 时间戳
    :return: jwt
    """
    payload = {
        'iat': time.time(),
        'jti': feature_store_id,
        'qa_name': qa_name,
        'exp': expire
    }
    token = jwt.encode(payload,
                       HuixiangDouEnv.get_jwt_secret(),
                       algorithm='HS256')
    return token


def parse_jwt(token: str) -> dict:
    hxd_token = jwt.decode(token,
                           HuixiangDouEnv.get_jwt_secret(),
                           algorithms='HS256')
    return hxd_token


def safe_join(directory: str, path: str) -> str:
    """Safely path to a base directory to avoid escaping the base directory.
    Borrowed from: werkzeug.security.safe_join.

    @param directory:
    @param path:
    """
    _os_alt_seps: List[str] = [
        sep for sep in [os.path.sep, os.path.altsep]
        if sep is not None and sep != '/'
    ]

    if path == '':
        raise HTTPException(status_code=400, detail='path is empty')

    filename = os.path.normpath(path)
    full_path = os.path.join(directory, filename)
    if (any(sep in filename for sep in _os_alt_seps) or os.path.isabs(filename)
            or filename == '..' or filename.startswith('../')
            or os.path.isdir(full_path)):
        raise HTTPException(status_code=400, detail='path is illegal')

    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail='path is not existed')
    return full_path

```

### Core Architecture Module: `web/util/time_util.py`
```
#! python3
from datetime import datetime


def get_month_time_str(t: datetime) -> str:
    return t.strftime('%y-%m')

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #443** (2025-11-24): **feat(uv): add pyproject.toml**
  *Symptoms*: 

- **Issue #442** (2025-08-13): **fix(wechat.py): filter msg by unique id**
  *Symptoms*: - 支持仅转发消息，不处理 - 增加消息去重，防止重发

- **Issue #441** (2025-07-14): **Support kimi k2**
  *Symptoms*: - using `kimi-k2` by default - update README about Cell MP  <img width="1083" height="152" alt="image" src="https://github.com/user-attachments/assets/b1cdd62c-789c-47b0-aa8c-58bbfaaa645f" /> 

- **Issue #439** (2025-05-21): **Fix/circular import**
  *Symptoms*: 

- **Issue #438** (2025-05-21): **Rename feature_store.py to store.py and move to services directory**
  *Symptoms*: 

- **Issue #437** (2025-05-21): **Update README.md**
  *Symptoms*: 

- **Issue #435** (2025-04-15): **Update README.md**
  *Symptoms*: 

- **Issue #434** (2025-04-15): **feat(project): support internlm3 and ppio**
  *Symptoms*: support  - internlm3 - ppio  https://ppinfra.com/user/register?invited_by=7GF8QS

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

### Incident Patch 1: `be7daa0f` (2025-08-13)
**Commit Message**: fix(wechat.py): filter msg by unique id (#442)

**File**: `huixiangdou/frontend/wechat.py` (modified, +28/-6)
```diff
@@ -56,6 +56,7 @@ def __init__(self, name, namespace='HuixiangDou', **redis_kwargs):
                                 charset='utf-8',
                                 decode_responses=True)
         self.key = '%s:%s' % (namespace, name)
+        print(self.qsize())
 
     def qsize(self):
         """Return the approximate size of the queue."""
@@ -151,6 +152,7 @@ def __init__(self):
         self.thumburl = ''
         self.md5 = ''
         self.length = 0
+        self.new_msg_id = ''
 
     def parse(self, wx_msg: dict, bot_wxid: str, auth:str='', wkteam_ip_port:str=''):
         # str or int
@@ -279,6 +281,8 @@ def search_key(xml_key: str):
 
         self.sender = data['fromUser']
         self.data = data
+        if 'newMsgId' in data:
+            self.new_msg_id = data['newMsgId']
         self.type = parse_type
         if 'fromGroup' not in data:
             return Exception('GroupID not found in message')
@@ -404,6 +408,7 @@ def __init__(self, config_path: str):
         self.qrCodeUrl = ''
         self.wkteam_config = dict()
         self.users = dict()
+        self.preprocessed = set()
         self.messages = []
 
         # {group_id: group_name}
@@ -780,10 +785,16 @@ def bind(self, logdir: str, port: int, forward:bool=False):
 
         async def forward_msg(input_json: dict):
             msg = Message()
+            print(input_json)
             err = msg.parse(wx_msg=input_json, bot_wxid=self.wId, auth=self.auth, wkteam_ip_port=self.WKTEAM_IP_PORT)
             if err is not None:
                 logger.error(str(err))
                 return
+
+            if msg.new_msg_id in self.preprocessed:
+                print(f'{msg.new_msg_id} repeated, skip')
+                return
+            self.preprocessed.add(msg.new_msg_id)
             
             # 不是白名单群里的消息，不处理
             come_from_whitelist = False
@@ -826,14 +837,20 @@ async def msg_callback(request):
             """Save wechat message to redis, for revert command, use high
             priority."""
             input_json = await request.json()
+
+
             with open(logpath, 'a') as f:
                 json_str = json.dumps(input_json, indent=2, ensure_ascii=False)
                 f.write(json_str)
                 f.write('\n')
 
             logger.debug(input_json)
-            msg_que = Queue(name='wechat')
-            revert_que = Queue(name='wechat-high-priority')
+            try:
+                msg_que = Queue(name='wechat')
+            except Exception as e:
+                msg_que = None
+                print('redis unavailable')
+                pass
 
             if input_json['messageType'] == '00000':
                 return web.json_response(text='done')
@@ -844,7 +861,8 @@ async def msg_callback(request):
                     self.revert_all()
                     return web.json_response(text='done')
 
-                msg_que.put(json_str)
+                if msg_que:
+                    msg_que.put(json_str)
 
                 if forward and not is_revert_command(input_json):
                     await forward_msg(input_json)
@@ -859,7 +877,9 @@ async def msg_callback(request):
         web.run_app(app, host='0.0.0.0', port=port)
 
     def serve(self, forward:bool=False):
-        # self.bind(self.wkteam_config.dir, self.wkteam_config.callback_port, forward=forward)
+        ## self.bind(self.wkteam_config.dir, self.wkteam_config.callback_port, forward=forward)
+
+        ## TODO
         p = Process(target=self.bind, args=(self.wkteam_config.dir, self.wkteam_config.callback_port, forward))
         p.start()
         self.set_callback()
@@ -893,10 +913,12 @@ async def loop(self, assistant):
         que = Queue(name='wechat')
 
         while True:
-            time.sleep(1)
-
+            # time.sleep(1)
             # parse wx_msg, add it to group
             for wx_msg_str in que.get_all():
+                # print(wx_msg_str)
+                # time.sleep(0.01)
+                # continue
                 wx_msg = json.loads(wx_msg_str)
                 logger.debug(wx_msg)
                 msg = Message()
```

---

### Incident Patch 2: `e0d94b59` (2025-05-21)
**Commit Message**: Fix/circular import (#439)

* Add QA pair support and refactor initialize method

* Update README with QA pair feature documentation

* Fix circular import warning in services module

* feat(project): update

---------

Co-authored-by: openhands <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +5/-0)
```diff
@@ -212,6 +212,11 @@ cp -rf resource/data* repodir/
 # Build knowledge base, this will save the features of repodir to workdir, and update the positive and negative example thresholds into `config.ini`
 mkdir workdir
 python3 -m huixiangdou.services.store
+
+# You can also build knowledge base from QA pairs (CSV or JSON format)
+# CSV: First column is key (question), second column is value (answer)
+# JSON: {"question1": "answer1", "question2": "answer2", ...}
+# python3 -m huixiangdou.services.store --qa-pair resource/data/qa_pair.csv
 ```
 
 ## III. Setup LLM API and test
```

**File**: `README_zh.md` (modified, +5/-0)
```diff
@@ -211,6 +211,11 @@ cp -rf resource/data* repodir/
 # 建立知识库，repodir 的特征会保存到 workdir，拒答阈值也会自动更新进 `config.ini`
 mkdir workdir
 python3 -m huixiangdou.services.store
+
+# 你也可以从问答对（QA pairs）构建知识库（支持 CSV 或 JSON 格式）
+# CSV 格式：第一列为问题（key），第二列为答案（value）
+# JSON 格式：{"问题1": "答案1", "问题2": "答案2", ...}
+# python3 -m huixiangdou.services.store --qa-pair resource/data/qa_pair.csv
 ```
 
 ## 三、配置 LLM，运行测试
```

**File**: `huixiangdou/primitive/chunk.py` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ class Chunk():
     modal: str = 'text'
 
     def __post_init__(self):
-        if self.modal not in ['text', 'image', 'audio']:
+        if self.modal not in ['text', 'image', 'audio', 'qa']:
             raise ValueError(
-                f'Invalid modal: {self.modal}. Allowed values are: `text`, `image`, `audio`'
+                f'Invalid modal: {self.modal}. Allowed values are: `text`, `image`, `audio`, `qa`'
             )
 
     def __str__(self) -> str:
```

**File**: `huixiangdou/primitive/faiss.py` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ def save_local(self, folder_path: str, chunks: List[Chunk],
             for chunk in tqdm(chunks, 'chunks'):
                 np_feature = None
                 try:
-                    if chunk.modal == 'text':
+                    if chunk.modal == 'text' or chunk.modal == 'qa':
                         np_feature = embedder.embed_query(text=chunk.content_or_path)
                     elif chunk.modal == 'image':
                         np_feature = embedder.embed_query(path=chunk.content_or_path)
```

**File**: `huixiangdou/services/__init__.py` (modified, +2/-1)
```diff
@@ -1,7 +1,6 @@
 """LLM service module."""
 from .config import (feature_store_base_dir, redis_host, redis_passwd,
                      redis_port)
-from .store import FeatureStore  # noqa E401
 from .helper import (ErrorCode, QueryTracker, Queue, TaskCode,
                      build_reply_text, check_str_useful, histogram, kimi_ocr,
                      multimodal, parse_json_str)
@@ -10,3 +9,5 @@
 from .web_search import WebSearch  # noqa E401
 from .serial_pipeline import SerialPipeline
 from .parallel_pipeline import ParallelPipeline
+# Import FeatureStore at the end to avoid circular imports
+from .store import FeatureStore  # noqa E401
```

**File**: `huixiangdou/services/llm.py` (modified, +1/-2)
```diff
@@ -193,8 +193,7 @@ async def chat(self,
         try:
             response = await openai_async_client.chat.completions.create(**kwargs)
         except Exception as e:
-            import pdb
-            pdb.set_trace()
+            logger.error(str(e) + ' input len {}'.format(len(str(messages))))
             pass
         logger.info(response.choices[0].message.content)
 
```

**File**: `huixiangdou/services/retriever.py` (modified, +5/-3)
```diff
@@ -169,7 +169,7 @@ def rerank_fuse(self, query: Union[Query, str], chunks: List[Chunk], context_max
         context = ''
         references = []
         ref_texts = []
-        for idx, chunk in enumerate(rerank_chunks):
+        for chunk in rerank_chunks:
 
             content = chunk.content_or_path
             splits.append(content)
@@ -178,12 +178,14 @@ def rerank_fuse(self, query: Union[Query, str], chunks: List[Chunk], context_max
             if '://' in source:
                 # url
                 file_text = content
-            else:
+            elif chunk.modal == 'text':
                 file_text, error = file_opr.read(chunk.metadata['read'])
                 if error is not None:
                     # read file failed, skip
                     continue
-
+            elif chunk.modal == 'qa':
+                file_text = chunk.metadata['qa']
+     
             logger.info('target {} content length {}'.format(
                 source, len(file_text)))
             if len(file_text) + len(context) > context_max_length:
```

**File**: `huixiangdou/services/store.py` (modified, +107/-12)
```diff
@@ -6,8 +6,10 @@
 import re
 import shutil
 import time
+import csv
+from dataclasses import dataclass
 from multiprocessing import Pool
-from typing import Any, Dict, List, Optional
+from typing import Any, Dict, List, Optional, Tuple
 import random
 import pytoml
 from loguru import logger
@@ -22,6 +24,15 @@
 from .helper import histogram
 from .retriever import CacheRetriever, Retriever
 
+
+@dataclass
+class InitializeConfig:
+    """Configuration for initializing the feature store."""
+    files: List[FileName]
+    work_dir: str
+    ner_file: Optional[str] = None
+    qa_pair_file: Optional[str] = None
+
 def empty_cache():
     try:
         from torch.cuda import empty_cache as cuda_empty_cache
@@ -170,7 +181,68 @@ def build_sparse(self, files: List[FileName], work_dir: str):
         bm25 = BM25Okapi()
         bm25.save(chunks, sparse_dir)
 
-    def build_dense(self, files: List[FileName], work_dir: str, markdown_as_txt: bool=False):
+    def process_qa_pairs(self, qa_pair_file: str) -> List[Chunk]:
+        """Process QA pairs from CSV or JSON file.
+        
+        Args:
+            qa_pair_file: Path to the CSV or JSON file containing QA pairs.
+            
+        Returns:
+            List of Chunk objects where key is the content and value is stored in metadata.
+        """
+        chunks = []
+        file_ext = os.path.splitext(qa_pair_file)[1].lower()
+        
+        try:
+            if file_ext == '.csv':
+                # Process CSV file - first column is key, second column is value
+                with open(qa_pair_file, 'r', encoding='utf-8') as f:
+                    csv_reader = csv.reader(f)
+                    for row in csv_reader:
+                        if len(row) >= 2:
+                            key, value = row[0], row[1]
+                            # Create a chunk with key as content and value in metadata
+                            chunk = Chunk(
+                                modal='qa',
+                                content_or_path=key,
+                                metadata={'read': qa_pair_file, 'source': qa_pair_file, 'qa': f'{key}: {value}'}
+                            )
+                            chunks.append(chunk)
+            
+            elif file_ext == '.json':
+                # Process JSON file
+                with open(qa_pair_file, 'r', encoding='utf-8') as f:
+                    qa_data = json.load(f)
+                    
+                    # Handle different JSON formats
+                    if isinstance(qa_data, dict):
+                        # Format: {"key1": "value1", "key2": "value2", ...}
+                        for key, value in qa_data.items():
+                            chunk = Chunk(
+                                modal='qa',
+                                content_or_path=key,
+                                metadata={'read': qa_pair_file, 'source': qa_pair_file, 'qa': f'{key}: {value}'}
+                            )
+                            chunks.append(chunk)
+                    elif isinstance(qa_data, list):
+                        # Format: [{"key": "key1", "value": "value1"}, ...]
+                        for item in qa_data:
+                            if isinstance(item, dict) and 'key' in item and 'value' in item:
+                                chunk = Chunk(
+                                    modal='qa',
+                                    content_or_path=key,
+                                    metadata={'read': qa_pair_file, 'source': qa_pair_file, 'qa': f'{key}: {value}'}
+                                )
+                                chunks.append(chunk)
+            
+            logger.info(f"Processed {len(chunks)} QA pairs from {qa_pair_file}")
+            return chunks
+            
+        except Exception as e:
+            logger.error(f"Error processing QA pairs from {qa_pair_file}: {str(e)}")
+            return []
+
+    def build_dense(self, files: List[FileName], work_dir: str, markdown_as_txt: bool=False, qa_pair_file: str = None):
         """Extract the features required for the response pipeline based on the
         document."""
         feature_dir = os.path.join(work_dir, 'db_dense')
@@ -179,7 +251,14 @@ def build_dense(self, files: List[FileName], work_dir: str, markdown_as_txt: boo
 
         file_opr = FileOperation()
         chunks = []
-
+        
+        # Process QA pairs if provided
+        if qa_pair_file is not None:
+            qa_chunks = self.process_qa_pairs(qa_pair_file)
+            chunks.extend(qa_chunks)
+            logger.info(f"Added {len(qa_chunks)} chunks from QA pairs")
+        
+        # Process regular files
         for i, file in tqdm(enumerate(files), 'split'):
             if not file.state:
                 continue
@@ -205,7 +284,7 @@ def build_dense(self, files: List[FileName], work_dir: str, markdown_as_txt: boo
                     texts=[text], metadatas=[metadata])
 
         if not self.embedde
```

---

### Incident Patch 3: `2a98f626` (2025-04-07)
**Commit Message**: fix(service): llm reply (#432)

**File**: `huixiangdou/frontend/wechat.py` (modified, +33/-7)
```diff
@@ -312,8 +312,11 @@ def convert_talk_to_dict(talk: Talk):
 
 
 def convert_history_to_tuple(history: List[Talk]):
-    return [(item.query, item.reply, item.refs, item.now) for item in history]
-
+    history = []
+    for item in history:
+        history.append({"role": "user", "content": item.query})
+        history.append({"role": "assistant", "content": item.reply})
+    return history
 
 class User:
 
@@ -724,6 +727,29 @@ def send_message(self, groupId: str, text: str):
 
         return None
 
+    def send_user_message(self, userId: str, text: str):
+        headers = {
+            'Content-Type': 'application/json',
+            'Authorization': self.auth
+        }
+        data = {'wId': self.wId, 'wcId': userId, 'content': text}
+
+        json_obj, err = self.post(url='http://{}/sendText'.format(
+            self.WKTEAM_IP_PORT),
+                                  data=data,
+                                  headers=headers)
+        if err is not None:
+            return err
+
+        sent = json_obj['data']
+        sent['wId'] = self.wId
+        if groupId not in self.sent_msg:
+            self.sent_msg[groupId] = [sent]
+        else:
+            self.sent_msg[groupId].append(sent)
+
+        return None
+
     def send_url(self, groupId: str, description: str, title: str, thumb_url: str, url: str):
         headers = {
             'Content-Type': 'application/json',
@@ -860,14 +886,14 @@ def fetch_groupchats(self, user: User, max_length: int = 12):
                 conversations.append(msg)
         return conversations
 
-    async def loop(self, worker):
+    async def loop(self, assistant):
         """Fetch all messages from redis, split it by groupId; concat by
         timestamp."""
         from huixiangdou.service.helper import ErrorCode, kimi_ocr
         que = Queue(name='wechat')
 
         while True:
-            time.sleep(0.01)
+            time.sleep(1)
 
             # parse wx_msg, add it to group
             for wx_msg_str in que.get_all():
@@ -907,8 +933,8 @@ async def loop(self, worker):
                     continue
 
                 now = time.time()
-                # if a user not send new message in 18 seconds, process and mark it
-                if now - user.last_msg_time >= 18 and user.last_process_time < user.last_msg_time:
+                # if a user not send new message in 12 seconds, process and mark it
+                if now - user.last_msg_time >= 12 and user.last_process_time < user.last_msg_time:
                     if user.last_msg_type in ['link', 'image']:
                         # if user image or link contains question, do not process
                         continue
@@ -937,7 +963,7 @@ async def loop(self, worker):
                         tuple_history = convert_history_to_tuple(
                             user.history[0:-1])
 
-                        async for sess in worker.generate(
+                        async for sess in assistant.generate(
                             query=query,
                             history=tuple_history,
                             groupname=groupname,
```

**File**: `huixiangdou/primitive/llm_reranker.py` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@
 from .embedder import Embedder
 from .limitter import RPM
 from .utils import always_get_an_event_loop
+from loguru import logger
 
 class LLMReranker:
     _type: str
@@ -168,7 +169,7 @@ def _sort(self, texts: List[str], query: str):
                 return indexes[0:self.topn]
             except Exception as e:
                 logger.error(f'reranker API fail {e}, use default order')
-                return [i for i in range(self.topn)]
+                return [i for i in range(min(len(texts), self.topn))]
 
         # get descending order
         return scores.argsort()[::-1][0:self.topn]
```

**File**: `huixiangdou/service/llm.py` (modified, +14/-10)
```diff
@@ -100,23 +100,24 @@ def __init__(self, config_path: str):
 
     def choose_model(self, backend: Backend, token_size: int) -> str:
         model = backend.model
+        response_reserve_length = 2048
         if backend.name == 'kimi' and model == 'auto':
-            if token_size <= 8192 - 1024:
+            if token_size <= 8192 - response_reserve_length:
                 model = 'moonshot-v1-8k'
-            elif token_size <= 32768 - 1024:
+            elif token_size <= 32768 - response_reserve_length:
                 model = 'moonshot-v1-32k'
-            elif token_size <= 128000 - 1024:
+            elif token_size <= 128000 - response_reserve_length:
                 model = 'moonshot-v1-128k'
             else:
                 raise ValueError('Input token length exceeds 128k')
         elif backend.name == 'step' and model == 'auto':
-            if token_size <= 8192 - 1024:
+            if token_size <= 8192 - response_reserve_length:
                 model = 'step-1-8k'
-            elif token_size <= 32768 - 1024:
+            elif token_size <= 32768 - response_reserve_length:
                 model = 'step-1-32k'
-            elif token_size <= 128000 - 1024:
+            elif token_size <= 128000 - response_reserve_length:
                 model = 'step-1-128k'
-            elif token_size <= 256000 - 1024:
+            elif token_size <= 256000 - response_reserve_length:
                 model = 'step-1-256k'
             else:
                 raise ValueError('Input token length exceeds 256k')
@@ -134,7 +135,7 @@ def choose_model(self, backend: Backend, token_size: int) -> str:
     async def chat(self,
                    prompt: str,
                    backend: str = 'default',
-                   system_prompt=None,
+                   system_prompt='你是茴香豆，简称豆哥。是一个微信群机器人，用于回答群友的疑问。',
                    history=[],
                    allow_truncate=False,
                    max_tokens=1024,
@@ -184,8 +185,11 @@ async def chat(self,
         if max_tokens:
             kwargs['max_tokens'] = max_tokens
 
-        response = await openai_async_client.chat.completions.create(**kwargs)
-        if response.choices is None:
+        try:
+            response = await openai_async_client.chat.completions.create(**kwargs)
+        except Exception as e:
+            import pdb
+            pdb.set_trace()
             pass
         logger.info(response.choices[0].message.content)
 
```

**File**: `huixiangdou/service/parallel_pipeline.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ async def process(self, sess: Session) -> AsyncGenerator[Session, Session]:
             else:
                 topic = 'undefine'
             
-            for block_intention in ['问候', 'greeting', 'undefine']:
+            for block_intention in ['问候', 'greeting', 'undefine', '表达个人感受']:
                 if block_intention in intention:
                     sess.code = ErrorCode.NOT_A_QUESTION
                     yield sess
```

---

### Incident Patch 4: `65f3f600` (2025-03-27)
**Commit Message**: fix

**File**: `huixiangdou/frontend/wechat.py` (modified, +1/-2)
```diff
@@ -967,8 +967,7 @@ async def loop(self, worker):
                         if user.group_id in self.group_whitelist:
                             logger.warning(r'send {} to {}'.format(
                                 formatted_reply, user.group_id))
-                            print(formatted_reply)
-                            # self.send_message(groupId=user.group_id, text=formatted_reply)
+                            self.send_message(groupId=user.group_id, text=formatted_reply)
                         else:
                             logger.warning(r'prepare respond {} to {}'.format(
                                 formatted_reply, user.group_id))
```

---

### Incident Patch 5: `713075a3` (2025-03-27)
**Commit Message**: fix(web/proxy/main.py): async bug (#431)

**File**: `config.ini` (modified, +1/-1)
```diff
@@ -148,4 +148,4 @@ introduction = "github https://github.com/InternLM/HuixiangDou 用户体验群"
 # github.com/tencent/ncnn contributors
 [frontend.wechat_wkteam.18356748488]
 name = "卷卷群"
-introduction = "ncnn contributors group"
+introduction = "ncnn contributors group"
\ No newline at end of file
```

**File**: `evaluation/end2end/main.py` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ async def run(query_text: str):
     async for sess in assistant.generate(query=query, enable_web_search=False):
         if len(sess.delta) > 0:
             sentence += sess.delta
-            if refs is None:
+            if not refs:
                 refs = sess.references
     return sentence, refs
 
```

**File**: `evaluation/rejection/kg_filter.py` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ def summarize():
             for line in f:
                 json_obj = json.loads(line)
                 gts.append(json_obj['gt'])
-                if json_obj['result'] is None:
+                if not json_obj['result']:
                     dts.append(False)
                     # max_ref_cnts.append(0)
                 elif len(json_obj['result']) <= throttle:
```

**File**: `huixiangdou/frontend/wechat.py` (modified, +13/-21)
```diff
@@ -34,7 +34,7 @@ def redis_host():
 
 def redis_port():
     port = os.getenv('REDIS_PORT')
-    if port is None:
+    if not port:
         logger.debug('REDIS_PORT not set, try 6379')
         port = 6379
     return port
@@ -161,6 +161,9 @@ def parse(self, wx_msg: dict, bot_wxid: str, auth:str='', wkteam_ip_port:str='')
             return Exception('data not in wx_msg')
 
         data = wx_msg['data']
+        if not data:
+            return Exception('data is None')
+
         if 'self' in data:
             if data['self']:
                 return Exception('self msg, return')
@@ -247,6 +250,10 @@ def search_key(xml_key: str):
                 jsonobj = json.loads(json_str)
                 if jsonobj['code'] != '1000':
                     logger.error('download {} {}'.format(data, json_str))
+
+                jsondata = jsonobj['data']
+                if not jsondata:
+                    return Exception('download image failed, skip')
                 self.url = jsonobj['data']['url']
 
         elif msg_type in ['80001', '60001']:
@@ -853,24 +860,14 @@ def fetch_groupchats(self, user: User, max_length: int = 12):
                 conversations.append(msg)
         return conversations
 
-    def loop(self, worker):
+    async def loop(self, worker):
         """Fetch all messages from redis, split it by groupId; concat by
         timestamp."""
         from huixiangdou.service.helper import ErrorCode, kimi_ocr
-
-        revert_que = Queue(name='wechat-high-priority')
         que = Queue(name='wechat')
 
         while True:
-            time.sleep(1)
-            # react to revert msg first
-            for wx_msg_str in revert_que.get_all():
-                wx_msg = json.loads(wx_msg_str)
-                data = wx_msg['data']
-                if 'fromGroup' in data:
-                    self.revert(groupId=data['fromGroup'])
-                    # “群友学习法”。命令撤回将提升阈值，提升量越来越小。
-                    worker.notify_badcase()
+            time.sleep(0.01)
 
             # parse wx_msg, add it to group
             for wx_msg_str in que.get_all():
@@ -909,11 +906,6 @@ def loop(self, worker):
                 if len(user.history) < 1:
                     continue
 
-                # debug
-                # if '20158567857@chatroom' not in user.group_id:
-                #     logger.debug('user.group_id {}'.format(user.group_id))
-                #     continue
-
                 now = time.time()
                 # if a user not send new message in 18 seconds, process and mark it
                 if now - user.last_msg_time >= 18 and user.last_process_time < user.last_msg_time:
@@ -945,7 +937,7 @@ def loop(self, worker):
                         tuple_history = convert_history_to_tuple(
                             user.history[0:-1])
 
-                        for sess in worker.generate(
+                        async for sess in worker.generate(
                             query=query,
                             history=tuple_history,
                             groupname=groupname,
@@ -975,8 +967,8 @@ def loop(self, worker):
                         if user.group_id in self.group_whitelist:
                             logger.warning(r'send {} to {}'.format(
                                 formatted_reply, user.group_id))
-                            self.send_message(groupId=user.group_id,
-                                              text=formatted_reply)
+                            print(formatted_reply)
+                            # self.send_message(groupId=user.group_id, text=formatted_reply)
                         else:
                             logger.warning(r'prepare respond {} to {}'.format(
                                 formatted_reply, user.group_id))
```

**File**: `huixiangdou/gradio_ui.py` (modified, +2/-2)
```diff
@@ -117,7 +117,7 @@ async def predict(text:str, image:str):
 
     query = Query(text, image_path)
     if 'chat_in_group' in pipeline:
-        if serial_assistant is None:
+        if not serial_assistant:
             serial_assistant = SerialPipeline(work_dir=main_args.work_dir, config_path=main_args.config_path)
         args = {'query':query, 'history': [], 'groupname':''}
         pipeline = {'status': {}}
@@ -140,7 +140,7 @@ async def predict(text:str, image:str):
                 yield json_str
 
     else:
-        if parallel_assistant is None:
+        if not parallel_assistant:
             parallel_assistant = ParallelPipeline(work_dir=main_args.work_dir, config_path=main_args.config_path)
         args = {'query':query, 'history':[], 'language':language}
         args['enable_web_search'] = enable_web_search
```

**File**: `huixiangdou/main.py` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@
 from loguru import logger
 from termcolor import colored
 
-from .service import ErrorCode, SerialPipeline, build_reply_text
+from .service import ErrorCode, SerialPipeline, ParallelPipeline, build_reply_text
 from .primitive import always_get_an_event_loop
 
 def parse_args():
@@ -167,7 +167,7 @@ async def run(args):
     elif fe_type == 'wechat_wkteam':
         from .frontend import WkteamManager
         manager = WkteamManager(args.config_path)
-        manager.loop(assistant)
+        await manager.loop(assistant)
     else:
         logger.info(
             f'unsupported fe_config.type {fe_type}, please read `config.ini` description.'  # noqa E501
```

**File**: `huixiangdou/primitive/embedder.py` (modified, +5/-4)
```diff
@@ -12,6 +12,7 @@
 from .query import DistanceStrategy
 from .limitter import RPM, TPM
 from .chunk import Chunk
+from .utils import always_get_an_event_loop
 
 class Embedder:
     """Wrap text2vec (multimodal) model."""
@@ -95,19 +96,19 @@ def embed_query(self, text: str = None, path: str = None) -> np.ndarray:
                 feature = self.client.encode(text=text, image=path)
                 return feature.cpu().numpy().astype(np.float32)
         elif 'bce' in self._type:
-            if text is None:
+            if not text:
                 raise ValueError('This model only support text')
             emb = self.client.encode([text], show_progress_bar=False, normalize_embeddings=True)
             emb = emb.astype(np.float32)
             # for norm in np.linalg.norm(emb, axis=1):
             #     assert abs(norm - 1) < 0.001
             return emb
         else:
-            self.client['api_rpm'].wait(silent=True)
-            self.client['api_tpm'].wait(silent=True, token_count=len(text))
+            self.client['api_rpm'].wait_sync(silent=True)
+            self.client['api_tpm'].wait_sync(silent=True, token_count=len(text))
 
             # siliconcloud bce API
-            if text is None:
+            if not text:
                 raise ValueError('This api only support text')
             
             url = "https://api.siliconflow.cn/v1/embeddings"
```

**File**: `huixiangdou/primitive/limitter.py` (modified, +50/-2)
```diff
@@ -1,4 +1,5 @@
 import time
+import asyncio
 from datetime import datetime, timedelta
 from loguru import logger
 
@@ -14,7 +15,7 @@ def get_minute_slot(self):
         total_minutes_since_midnight = dt_object.hour * 60 + dt_object.minute
         return total_minutes_since_midnight
 
-    async def wait(self, silent=False):
+    def wait_sync(self, silent=False):
         current = time.time()
         dt_object = datetime.fromtimestamp(current)
         minute_slot = self.get_minute_slot()
@@ -37,6 +38,29 @@ async def wait(self, silent=False):
         if not silent:
             logger.debug(self.record)
 
+    async def wait(self, silent=False):
+        current = time.time()
+        dt_object = datetime.fromtimestamp(current)
+        minute_slot = self.get_minute_slot()
+
+        if self.record['slot'] == minute_slot:
+            # check RPM exceed
+            if self.record['counter'] >= self.rpm:
+                # wait until next minute
+                next_minute = dt_object.replace(
+                    second=0, microsecond=0) + timedelta(minutes=1)
+                _next = next_minute.timestamp()
+                sleep_time = abs(_next - current)
+                asyncio.sleep(sleep_time)
+
+                self.record = {'slot': self.get_minute_slot(), 'counter': 0}
+        else:
+            self.record = {'slot': self.get_minute_slot(), 'counter': 0}
+        self.record['counter'] += 1
+
+        if not silent:
+            logger.debug(self.record)
+
 class TPM:
 
     def __init__(self, tpm: int = 20000):
@@ -49,6 +73,30 @@ def get_minute_slot(self):
         total_minutes_since_midnight = dt_object.hour * 60 + dt_object.minute
         return total_minutes_since_midnight
 
+
+    def wait_sync(self, token_count, silent=False):
+            current = time.time()
+            dt_object = datetime.fromtimestamp(current)
+            minute_slot = self.get_minute_slot()
+            self.record['counter'] += token_count
+
+            if self.record['slot'] == minute_slot:
+                # check RPM exceed
+                if self.record['counter'] >= self.tpm:
+                    # wait until next minute
+                    next_minute = dt_object.replace(
+                        second=0, microsecond=0) + timedelta(minutes=1)
+                    _next = next_minute.timestamp()
+                    sleep_time = abs(_next - current)
+                    time.sleep(sleep_time)
+
+                    self.record = {'slot': self.get_minute_slot(), 'counter': 0}
+            else:
+                self.record = {'slot': self.get_minute_slot(), 'counter': 0}
+
+            if not silent:
+                logger.debug(self.record)
+
     async def wait(self, token_count, silent=False):
         current = time.time()
         dt_object = datetime.fromtimestamp(current)
@@ -63,7 +111,7 @@ async def wait(self, token_count, silent=False):
                     second=0, microsecond=0) + timedelta(minutes=1)
                 _next = next_minute.timestamp()
                 sleep_time = abs(_next - current)
-                time.sleep(sleep_time)
+                asyncio.sleep(sleep_time)
 
                 self.record = {'slot': self.get_minute_slot(), 'counter': 0}
         else:
```

---

### Incident Patch 6: `51b413b1` (2025-03-14)
**Commit Message**: fix(wechat.py): image forwarding (#425)

**File**: `huixiangdou/frontend/wechat.py` (modified, +5/-1)
```diff
@@ -192,6 +192,8 @@ def search_key(xml_key: str):
                 return value
             
             displayname = search_key(xml_key='displayname')
+            if displayname == '茴香豆':
+                displayname = ''
             displaycontent = search_key(xml_key='content')
             content = '{}:{}'.format(displayname, displaycontent)
             to_user = search_key(xml_key='chatusr')
@@ -775,7 +777,9 @@ async def forward_msg(input_json: dict):
                     username = msg.push_content.split(':')[0].strip()
                     formatted_reply = '{}：{}'.format(username, msg.content)
                     self.send_message(groupId=groupId, text=formatted_reply)
-                elif msg.type == 'image' or msg.type == 'emoji':
+                elif msg.type == 'image':
+                    self.send_image(groupId=groupId, image_url=msg.url)
+                elif msg.type == 'emoji':
                     self.send_emoji(groupId=groupId, md5=msg.md5, length=msg.length)
                 elif msg.type == 'ref_for_others' or msg.type == 'ref_for_bot':
                     formatted_reply = '{}\n---\n{}'.format(msg.content, msg.query)
```

---

### Incident Patch 7: `67e6947d` (2024-10-29)
**Commit Message**: fix(llm_server_hybrid.py): local qwen streaming (#399)

* fix(llm_server_hybrid.py): qwen streaming output

**File**: `README.md` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ The Web version's API for Android also supports other devices. See [Python sampl
       <td>
 
 - [InternLM2/InternLM2.5](https://github.com/InternLM/InternLM)
-- [Qwen/Qwen2](https://github.com/QwenLM/Qwen2)
+- [Qwen1.5~2.5](https://github.com/QwenLM/Qwen2)
 - [puyu](https://internlm.openxlab.org.cn/)
 - [StepFun](https://platform.stepfun.com)
 - [KIMI](https://kimi.moonshot.cn)
```

**File**: `huixiangdou/service/llm_server_hybrid.py` (modified, +12/-20)
```diff
@@ -17,9 +17,10 @@
 from fastapi.middleware.cors import CORSMiddleware
 from pydantic import BaseModel
 from sse_starlette.sse import EventSourceResponse
-
+from transformers import TextIteratorStreamer
 import uvicorn
 from typing import List, Tuple
+from threading import Thread
 
 def os_run(cmd: str):
     ret = os.popen(cmd)
@@ -57,6 +58,7 @@ def __init__(self, model_path: str):
         self.model_path = model_path
         self.tokenizer = AutoTokenizer.from_pretrained(model_path,
                                                        trust_remote_code=True)
+        self.streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
 
         model_path_lower = model_path.lower()
 
@@ -69,14 +71,6 @@ def __init__(self, model_path: str):
         elif 'qwen1.5' in model_path_lower:
             self.model = AutoModelForCausalLM.from_pretrained(
                 model_path, device_map='auto', trust_remote_code=True).eval()
-        elif 'qwen' in model_path_lower:
-            self.model = AutoModelForCausalLM.from_pretrained(
-                model_path,
-                device_map='auto',
-                trust_remote_code=True,
-                use_cache_quantization=True,
-                use_cache_kernel=True,
-                use_flash_attn=False).eval()
         elif 'internlm2_5' in model_path_lower:
             self.model = AutoModelForCausalLM.from_pretrained(
                 model_path,
@@ -112,17 +106,15 @@ async def chat_stream(self, prompt: str, history=[]):
                 messages, tokenize=False, add_generation_prompt=True)
             model_inputs = self.tokenizer([text],
                                           return_tensors='pt').to('cuda')
-            generated_ids = self.model.generate(model_inputs.input_ids,
-                                                max_new_tokens=512,
-                                                top_k=1)
-            generated_ids = [
-                output_ids[len(input_ids):] for input_ids, output_ids in zip(
-                    model_inputs.input_ids, generated_ids)
-            ]
-
-            output_text = self.tokenizer.batch_decode(
-                generated_ids, skip_special_tokens=True)[0]
-            yield output_text
+            
+            generation_kwargs = dict(model_inputs, streamer=self.streamer, max_new_tokens=512)
+            thread = Thread(target=self.model.generate, kwargs=generation_kwargs)
+            thread.start()
+            
+            for new_text in self.streamer:
+                yield new_text
+                
+            thread.join()
 
         elif type(self.model).__name__ == 'InternLM2ForCausalLM':
 
```

---

### Incident Patch 8: `8e5a2946` (2024-10-17)
**Commit Message**: fix(service/prompt.py): optimize citation format (#397)

* docs(en): add readthedocs

* fix(service/prompt.py): optimize ciation format

**File**: `huixiangdou/service/prompt.py` (modified, +21/-37)
```diff
@@ -1,5 +1,5 @@
 from typing import List
-
+import re
 # PreprocNode
 SCORING_QUESTION_TEMPLATE_CN = '“{}”\n请仔细阅读以上内容，判断句子是否是个有主题的疑问句，结果用 0～10 表示。直接提供得分不要解释。\n判断标准：有主语谓语宾语并且是疑问句得 10 分；缺少主谓宾扣分；陈述句直接得 0 分；不是疑问句直接得 0 分。直接提供得分不要解释。'
 # modified from kimi
@@ -111,38 +111,12 @@
 GENERATE_TEMPLATE_CN = '材料：“{}”\n 问题：“{}” \n 请仔细阅读参考材料回答问题。'  # noqa E501
 GENERATE_TEMPLATE_EN = 'Background Information: "{}"\n Question: "{}"\n Please read the reference material carefully and answer the question.'  # noqa E501
 
-GENERATE_TEMPLATE_CITATION_HEAD_CN = '''你是一个文本专家，擅长阅读理解任务，根据检索结果回答用户输入。 
-
-## 任务
-仅使用提供的搜索结果（其中一些可能不相关）来准确、吸引人且简洁地回答给定的问题，并正确引用它们。使用无偏见和新闻业语调。对于任何事实性声明都要引用。当引用多个搜索结果时，使用[1][2][3]。在每条句子中至少引用一个文档，最多引用三个文档。如果多个文档支持该句子，则只引用支持文档的最小必要子集。
-
-## 指令遵循与提供有用的回复要求
-- 在满足安全合规要求下，注意并遵循用户问题中提到的每条指令，对于用户的问题你必须直接的给出回答。如果指令超出了你的能力范围，礼貌的告诉用户。
-- 请严格遵循指令，请说话不要啰嗦，不要不简洁明了。
--【重要！】对于数字比较问题，请先一步一步分析再回答。
-
-## 输出格式与语言风格要求
-- 使用\(...\) 或\[...\]来输出数学公式，例如：使用\[x^2\]来表示x的平方。
-- 当你介绍自己时，请记住保持幽默和简短。
-- 你不会不用简洁简短的文字输出，你不会输出无关用户指令的文字。
-- 你不会重复表达和同义反复。
+GENERATE_TEMPLATE_CITATION_HEAD_CN = '''## 任务
+请使用仅提供的搜索结果（其中一些可能不相关）写出准确、有吸引力且简洁的回答，并正确引用它们。使用不偏不倚且新闻式的语气。对于任何事实性陈述都必须引用。引用多个搜索结果时，使用[1][2][3]格式。每个句子至少引用一个文档，最多引用三个文档。如果多个文档支持同一个句子，引用最小的必要子集。
 '''
 
-GENERATE_TEMPLATE_CITATION_HEAD_EN = '''You are a text expert, proficient in reading comprehension tasks, answering user input based on search results.
-
-## Task
-Write an accurate, engaging, and concise answer for the given question using only the provided search results (some of which might be irrelevant) and cite them properly. Use an unbiased and journalistic tone. Always cite for any factual claim. When citing several search results, use [1][2][3]. Cite at least one document and at most three documents in each sentence. If multiple documents support the sentence, only cite a minimum sufficient subset of the documents.
-
-## Instructions and Providing Helpful Responses
-- While adhering to safety and compliance requirements, pay attention to and follow each instruction mentioned in the user's question. You must directly answer the user's question. If the instruction is beyond your capabilities, politely inform the user.
-- Please strictly follow the instructions and avoid verbosity and ambiguity.
-- [Important!] For numerical comparison questions, analyze step by step before answering.
-
-## Output Format and Language Style Requirements
-- Use \(...\) or \[...\] to output mathematical formulas, for example: use \[x^2\] to represent the square of x.
-- When introducing yourself, remember to be humorous and concise.
-- You will not use verbose language and will not output text unrelated to the user's instructions.
-- You will not repeat expressions and will avoid tautology.
+GENERATE_TEMPLATE_CITATION_HEAD_EN = '''## Task
+Please use only the provided search results (some of which may be irrelevant) to write accurate, engaging, and concise answers, and correctly cite them. Use an impartial and journalistic tone. For any factual statements, citations are required. When citing multiple search results, use the format [1][2][3]. Each sentence should reference at least one document, and no more than three. If multiple documents support the same sentence, cite the smallest necessary subset.
 '''
 
 # WebSearchNode
@@ -161,19 +135,29 @@ class CitationGeneratePrompt:
     def __init__(self, language: str):
         self.language = language
     
+    def remove_markdown_headers(self, texts: List[str]):
+        pure_texts = []
+        for text in texts:
+            # 移除Markdown中的标题
+            pure_text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
+            pure_texts.append(pure_text)
+        return pure_texts
+
     def build(self, texts: List[str], question:str):
+        pure_texts = self.remove_markdown_headers(texts)
+
         if self.language == 'zh':
             head = GENERATE_TEMPLATE_CITATION_HEAD_CN
-            question_prompt = '\n## 用户输入\n{}\n'.format(question*2)
+            question_prompt = '\n## 用户输入\n{}\n'.format(question)
             context_prompt = ''
-            for index, text in enumerate(texts):
-                context_prompt += '\n## 检索结果{}\n"""\n{}\n"""\n'.format(index+1, text)
+            for index, text in enumerate(pure_texts):
+                context_prompt += '\n## 检索结果{}\n{}\n'.format(index+1, text)
         elif self.language == 'en':
             head = GENERATE_TEMPLATE_CITATION_HEAD_EN            
-            question_prompt = '\n## user input\n{}\n'.format(question*2)
+            question_prompt = '\n## user input\n{}\n'.format(question)
             context_prompt = ''
-            for index, text in enumerate(texts):
-                context_prompt += '\n## search result{}\n"""\n{}\n"""\n'.format(index+1, text)
+            for index, text in enumerate(pure_texts):
+                context_prompt += '\n## search result{}\n{}\n'.format(index+1, text)
 
         prompt = head + context_prompt + question_prompt
         return prompt
\ N
```

---

### Incident Patch 9: `ce0d4866` (2024-09-27)
**Commit Message**: fix(web_search.py): add missing method (#391)

**File**: `huixiangdou/service/web_search.py` (modified, +7/-0)
```diff
@@ -88,9 +88,16 @@ def __init__(self, config_path: str, retry: int = 1, language:str='zh') -> None:
         with open(config_path, encoding='utf8') as f:
             config = pytoml.load(f)
             self.search_config = types.SimpleNamespace(**config['web_search'])
+
         self.retry = retry
         self.language = language
 
+    def load_key():
+        try:
+            return self.search_config.serper_x_api_key
+        except Exception as e:
+            return ''
+
     def fetch_url(self, query: str, target_link: str, brief: str = ''):
         if not target_link.startswith('http'):
             return None
```

---

### Incident Patch 10: `7e1be3fa` (2024-09-23)
**Commit Message**: feat(primitive/faiss.py): support HNSW and reverted indexer (#387)

* feat(primitive/faiss.py): support HNSW

* feat(feature_store.py): simplify distribution

* feat(primitive/entity.py): add inverted index retrieve

**File**: `README.md` (modified, +2/-1)
```diff
@@ -50,7 +50,8 @@ Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/det
 
 The Web version's API for Android also supports other devices. See [Python sample code](./tests/test_openxlab_android_api.py).
 
-- \[2024/09\] [code retrieval](./huixiangdou/service/parallel_pipeline.py)
+- \[2024/09\] [Inverted indexer](https://github.com/InternLM/HuixiangDou/pull/387) makes LLM prefer knowledge base🎯
+- \[2024/09\] [Code retrieval](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] [chat_with_readthedocs](https://huixiangdou.readthedocs.io/en/latest/), see [how to integrate](./docs/zh/doc_add_readthedocs.md) 👍
 - \[2024/07\] Image and text retrieval & Removal of `langchain` 👍
 - \[2024/07\] [Hybrid Knowledge Graph and Dense Retrieval](./docs/en/doc_knowledge_graph.md) improve 1.7% F1 score 🎯
```

**File**: `README_zh.md` (modified, +11/-7)
```diff
@@ -52,6 +52,7 @@ Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 
 
 Web 版给 android 的接口，也支持非 android 调用，见[python 样例代码](./tests/test_openxlab_android_api.py)。
 
+- \[2024/09\] [倒排索引](https://github.com/InternLM/HuixiangDou/pull/387)让 LLM 更偏向使用领域知识 🎯
 - \[2024/09\] 稀疏方法实现[代码检索](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] ["chat_with readthedocs"](https://huixiangdou.readthedocs.io/zh-cn/latest/) ，见[集成说明](./docs/zh/doc_add_readthedocs.md)
 - \[2024/07\] 图文检索 & 移除 `langchain` 👍
@@ -366,7 +367,11 @@ python3 tests/test_query_gradio.py
 
 # 🛠️ FAQ
 
-1. 机器人太高冷/太嘴碎怎么办？
+1. 对于通用问题（如 “番茄是什么” ），我希望 LLM 优先用领域知识（如 “普罗旺斯番茄”）怎么办？
+
+    参照 [PR](https://github.com/InternLM/HuixiangDou/pull/387)，准备实体列表，构建特征库时传入列表，`ParallelPipeline`检索会基于倒排索引增大召回
+
+2. 机器人太高冷/太嘴碎怎么办？
 
    - 把真实场景中，应该回答的问题填入`resource/good_questions.json`，应该拒绝的填入`resource/bad_questions.json`
    - 调整 `repodir` 中的文档，确保不包含场景无关内容
@@ -375,30 +380,29 @@ python3 tests/test_query_gradio.py
 
    ⚠️ 如果你足够自信，也可以直接修改 config.ini 的 `reject_throttle` 数值，一般来说 0.5 是很高的值；0.2 过低。
 
-2. 启动正常，但运行期间显存 OOM 怎么办？
+3. 启动正常，但运行期间显存 OOM 怎么办？
 
    基于 transformers 结构的 LLM 长文本需要更多显存，此时需要对模型做 kv cache 量化，如 [lmdeploy 量化说明](https://github.com/InternLM/lmdeploy/blob/main/docs/zh_cn/quantization)。然后使用 docker 独立部署 Hybrid LLM Service。
 
-3. 如何接入其他 local LLM / 接入后效果不理想怎么办？
+4. 如何接入其他 local LLM / 接入后效果不理想怎么办？
 
    - 打开 [hybrid llm service](./huixiangdou/service/llm_server_hybrid.py)，增加新的 LLM 推理实现
    - 参照 [test_intention_prompt 和测试数据](./tests/test_intention_prompt.py)，针对新模型调整 prompt 和阈值，更新到 [prompt.py](./huixiangdou/service/prompt.py)
 
-4. 响应太慢/网络请求总是失败怎么办？
+5. 响应太慢/网络请求总是失败怎么办？
 
    - 参考 [hybrid llm service](./huixiangdou/service/llm_server_hybrid.py) 增加指数退避重传
    - local LLM 替换为 [lmdeploy](https://github.com/internlm/lmdeploy) 等推理框架，而非原生的 huggingface/transformers
 
-5. 机器配置低，GPU 显存不足怎么办？
+6. 机器配置低，GPU 显存不足怎么办？
 
    此时无法运行 local LLM，只能用 remote LLM 配合 text2vec 执行 pipeline。请确保 `config.ini` 只使用 remote LLM，关闭 local LLM
 
-6. 报错 `(500, 'Internal Server Error')`，意为 standalone 模式启动的 LLM 服务没访问到。按如下方式定位
+7. 报错 `(500, 'Internal Server Error')`，意为 standalone 模式启动的 LLM 服务没访问到。按如下方式定位
 
    - 执行 `python3 -m huixiangdou.service.llm_server_hybrid` 确定 LLM 服务无报错，监听的端口和配置一致。检查结束后按 ctrl-c 关掉。
    - 检查 `config.ini` 中各种 TOKEN 书写正确。
 
-
 # 🍀 致谢
 
 - [KIMI](https://kimi.moonshot.cn/): 长文本 LLM，支持直接上传文件
```

**File**: `evaluation/end2end/main.py` (modified, +48/-38)
```diff
@@ -2,12 +2,15 @@
 from huixiangdou.primitive import Query
 import json
 import asyncio
+import jieba
 import pdb
+import os
 from typing import List
 from rouge import Rouge 
 from loguru import logger
 
-assistant = ParallelPipeline(work_dir='/home/khj/hxd-ci/workdir', config_path='/home/khj/hxd-ci/config.ini')
+config_path = '/home/data/khj/workspace/huixiangdou/config.ini'
+assistant = ParallelPipeline(work_dir='/home/data/khj/workspace/huixiangdou/workdir', config_path=config_path)
 
 def format_refs(refs: List[str]):
     refs_filter = list(set(refs))
@@ -31,49 +34,56 @@ async def run(query_text: str):
                 refs = sess.references
     return sentence, refs
 
-gts = []
-dts = []
 
-output_filepath = 'out.jsonl'
-
-finished_query = []
-with open(output_filepath) as fin:
-    json_str = ""
-    for line in fin:
-        json_str += line
+if __name__ == "__main__":
+    gts = []
+    dts = []
     
-        if '}\n' == line:
-            print(json_str)
-            json_obj = json.loads(json_str)
-            finished_query.append(json_obj['query'].strip())
+    # hybrid llm serve
+    print('evaluate ParallelPipeline precision, first `python3 -m huixiangdou.service.llm_server_hybrid`, then prepare your qa pair in `qa.json`.')
+    output_filepath = 'out.jsonl'
+
+    finished_query = []
+    if os.path.exists(output_filepath):
+        with open(output_filepath) as fin:
             json_str = ""
+            for line in fin:
+                json_str += line
+            
+                if '}\n' == line:
+                    print(json_str)
+                    json_obj = json.loads(json_str)
+                    finished_query.append(json_obj['query'].strip())
+                    json_str = ""
 
-with open('evaluation/end2end/qa.jsonl') as fin:
-    for json_str in fin:
-        json_obj = json.loads(json_str)
-        query = json_obj['query'].strip()
-        if query in finished_query:
-            continue
-        
-        gt = json_obj['resp']
-        gts.append(gt)
+    with open('evaluation/end2end/qa.jsonl') as fin:
+        for json_str in fin:
+            json_obj = json.loads(json_str)
+            query = json_obj['query'].strip()
+            if query in finished_query:
+                continue
+            
+            gt = json_obj['resp']
+            gts.append(gt)
 
-        loop = asyncio.get_event_loop()
-        dt, refs = loop.run_until_complete(run(query_text=query))
-        dts.append(dt)
+            loop = asyncio.get_event_loop()
+            dt, refs = loop.run_until_complete(run(query_text=query))
+            dts.append(dt)
 
-        distance = assistant.retriever.embedder.distance(text1=gt, text2=dt).tolist()
+            distance = assistant.retriever.embedder.distance(text1=gt, text2=dt).tolist()
 
-        rouge = Rouge()
-        scores = rouge.get_scores(gt, dt)
-        json_obj['distance'] = distance
-        json_obj['rouge_scores'] = scores
-        json_obj['dt'] = dt
-        json_obj['dt_refs'] = refs
+            rouge = Rouge()
+            dt_tokenized = ' '.join(jieba.cut(dt))
+            gt_tokenized = ' '.join(jieba.cut(gt))
+            scores = rouge.get_scores(dt_tokenized, gt_tokenized)
+            json_obj['distance'] = distance
+            json_obj['rouge_scores'] = scores
+            json_obj['dt'] = dt
+            json_obj['dt_refs'] = refs
 
-        out_json_str = json.dumps(json_obj, ensure_ascii=False, indent=2)
-        logger.info(out_json_str)
+            out_json_str = json.dumps(json_obj, ensure_ascii=False, indent=2)
+            logger.info(out_json_str)
 
-        with open(output_filepath, 'a') as fout:
-            fout.write(out_json_str)
-            fout.write('\n')
+            with open(output_filepath, 'a') as fout:
+                fout.write(out_json_str)
+                fout.write('\n')
```

**File**: `huixiangdou/main.py` (modified, +2/-4)
```diff
@@ -13,7 +13,6 @@
 
 from .service import ErrorCode, SerialPipeline, build_reply_text, start_llm_server
 
-
 def parse_args():
     """Parse args."""
     parser = argparse.ArgumentParser(description='SerialPipeline.')
@@ -60,7 +59,6 @@ def check_env(args):
 
 
 def show(assistant, fe_config: dict):
-    
     queries = ['请问如何安装 mmpose ?', '请问明天天气如何？']
     print(colored('Running some examples..', 'yellow'))
     for query in queries:
@@ -142,7 +140,7 @@ def lark_group_recv_and_send(assistant, fe_config: dict):
         code, reply, refs = str(sess.code), sess.response, sess.references
         if code == ErrorCode.SUCCESS:
             json_obj['reply'] = build_reply_text(reply=reply,
-                                                 references=references)
+                                                 references=refs)
             error, msg_id = send_to_lark_group(
                 json_obj=json_obj,
                 app_id=lark_group_config['app_id'],
@@ -169,7 +167,7 @@ async def api(request):
         for sess in assistant.generate(query=query, history=[], groupname=''):
             pass
         code, reply, refs = str(sess.code), sess.response, sess.references
-        reply_text = build_reply_text(reply=reply, references=references)
+        reply_text = build_reply_text(reply=reply, references=refs)
 
         return web.json_response({'code': int(code), 'reply': reply_text})
 
```

**File**: `huixiangdou/primitive/__init__.py` (modified, +1/-0)
```diff
@@ -15,3 +15,4 @@
     nested_split_markdown, split_python_code)
 from .limitter import RPM, TPM
 from .bm250kapi import BM25Okapi
+from .entity import NamedEntity2Chunk
```

**File**: `huixiangdou/primitive/entity.py` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import sqlite3
+import os
+import json
+from typing import List, Union, Set
+
+class NamedEntity2Chunk:
+    """Save the relationship between Named Entity and Chunk to sqlite"""
+    def __init__(self, file_dir:str, ignore_case=True):
+        self.file_dir = file_dir
+        # case sensitive
+        self.ignore_case = ignore_case
+        if not os.path.exists(file_dir):
+            os.makedirs(file_dir)
+        self.conn = sqlite3.connect(os.path.join(file_dir, 'entity2chunk.sql'))
+        self.cursor = self.conn.cursor()
+        self.cursor.execute('''
+        CREATE TABLE IF NOT EXISTS entities (
+            eid INTEGER PRIMARY KEY,
+            chunk_ids TEXT
+        )
+        ''')
+        self.conn.commit()
+        self.entities = []
+        self.entity_path = os.path.join(self.file_dir, 'entities.json') 
+        if os.path.exists(self.entity_path):
+            with open(self.entity_path) as f:
+                self.entities = json.load(f)
+                if self.ignore_case:
+                    for id, value in enumerate(self.entities):
+                        self.entities[id] = value.lower()
+
+    def clean(self):
+        self.cursor.execute('''DROP TABLE entities;''')
+        self.cursor.execute('''
+        CREATE TABLE IF NOT EXISTS entities (
+            eid INTEGER PRIMARY KEY,
+            chunk_ids TEXT
+        )
+        ''')
+        self.conn.commit()
+
+    def insert_relation(self, eid: int, chunk_ids: List[int]):
+        """Insert the relationship between keywords id and List of chunk_id"""
+        chunk_ids_str = ','.join(map(str, chunk_ids)) 
+        self.cursor.execute('INSERT INTO entities (eid, chunk_ids) VALUES (?, ?)', (eid, chunk_ids_str))
+        self.conn.commit()
+    
+    def parse(self, text:str) -> List[int]:
+        if self.ignore_case:
+            text = text.lower()
+        
+        if len(self.entities) < 1:
+            raise ValueError('entity list empty, please check feature_store init')
+        ret = []
+        for index, entity in enumerate(self.entities):
+            if entity in text:
+                ret.append(index)
+        return ret
+
+    def set_entity(self, entities: List[str]):
+        json_str = json.dumps(entities, ensure_ascii=False)
+        with open(self.entity_path, 'w') as f:
+            f.write(json_str)
+            
+        self.entities = entities
+        if self.ignore_case:
+            for id, value in enumerate(self.entities):
+                self.entities[id] = value.lower()
+
+    def get_chunk_ids(self, entity_ids: Union[List, int]) -> Set:
+        """Query by keywords ids"""
+        if type(entity_ids) is int:
+            entity_ids = [entity_ids]
+        
+        counter = dict()
+        for eid in entity_ids:
+            self.cursor.execute('SELECT chunk_ids FROM entities WHERE eid = ?', (eid,))
+            result = self.cursor.fetchone()
+            if result:
+                chunk_ids = result[0].split(',')
+                for chunk_id_str in chunk_ids:
+                    chunk_id = int(chunk_id_str)
+                    if chunk_id not in counter:
+                        counter[chunk_id] = 1
+                    else:
+                        counter[chunk_id] += 1
+        
+        counter_list = []
+        for k,v in counter.items():
+            counter_list.append((k,v))
+        counter_list.sort(key=lambda item: item[1], reverse=True)
+        return counter_list
+    
+    def __del__(self):
+        self.cursor.close()
+        self.conn.close()
```

**File**: `huixiangdou/primitive/faiss.py` (modified, +35/-41)
```diff
@@ -1,6 +1,7 @@
 # Copyright (c) OpenMMLab. All rights reserved.
 from __future__ import annotations
 
+import time
 import logging
 import os
 import pdb
@@ -16,25 +17,13 @@
 from .embedder import Embedder
 from .query import Query, DistanceStrategy
 from .chunk import Chunk
-
-
-# heavily modified from langchain
-def dependable_faiss_import(no_avx2: Optional[bool] = None) -> Any:
-    """Import faiss if available, otherwise raise error.
-
-    Args:
-        no_avx2: Load FAISS strictly with no AVX2 optimization
-            so that the vectorstore is portable and compatible with other devices.
-    """
-    try:
-        import faiss
-    except ImportError:
-        raise ImportError(
-            'Could not import faiss python package. '
-            'Please install it with `pip install faiss-gpu` (for CUDA supported GPU) '
-            'or `pip install faiss-cpu` (depending on Python version).')
-    return faiss
-
+try:
+    import faiss
+except ImportError:
+    raise ImportError(
+        'Could not import faiss python package. '
+        'Please install it with `pip install faiss-gpu` (for CUDA supported GPU) '
+        'or `pip install faiss-cpu` (depending on Python version).')
 
 class Faiss():
 
@@ -57,8 +46,6 @@ def similarity_search(self,
             List of chunks most similar to the query text and L2 distance
             in float for each. High score represents more similarity.
         """
-        faiss = dependable_faiss_import()
-
         embedding = embedding.astype(np.float32)
         scores, indices = self.index.search(embedding, self.k)
         pairs = []
@@ -133,6 +120,23 @@ def split_by_batchsize(self, chunks: List[Chunk] = [], batchsize:int = 4):
             block_image.append(images[i:i+batchsize])
         return block_text, block_image
 
+    @classmethod
+    def build_index(self, np_feature: np.ndarray, distance_strategy: DistanceStrategy):
+            dimension = np_feature.shape[-1]
+            M = 16
+            # max neighours for each node 
+            # see https://github.com/facebookresearch/faiss/wiki/Indexing-1M-vectors
+            if distance_strategy == DistanceStrategy.EUCLIDEAN_DISTANCE:
+                # index = faiss.IndexFlatL2(dimension)
+                index = faiss.IndexHNSWFlat(dimension, M, faiss.METRIC_L2)
+            elif distance_strategy == DistanceStrategy.MAX_INNER_PRODUCT:
+                # index = faiss.IndexFlatIP(dimension)
+                index = faiss.IndexHNSWFlat(dimension, M, faiss.METRIC_IP)
+            else:
+                raise ValueError('Unknown distance {}'.format(distance_strategy))
+            index.hnsw.efSearch = 128
+            return index
+
     @classmethod
     def save_local(self, folder_path: str, chunks: List[Chunk],
                    embedder: Embedder) -> None:
@@ -144,9 +148,9 @@ def save_local(self, folder_path: str, chunks: List[Chunk],
             embedder: embedding function.
         """
 
-        faiss = dependable_faiss_import()
         index = None
         batchsize = 1
+        # max neighbours for each node
 
         try:
             batchsize_str = os.getenv('HUIXIANGDOU_BATCHSIZE')
@@ -176,25 +180,16 @@ def save_local(self, folder_path: str, chunks: List[Chunk],
                     continue
 
                 if index is None:
-                    dimension = np_feature.shape[-1]
-
-                    if embedder.distance_strategy == DistanceStrategy.EUCLIDEAN_DISTANCE:
-                        index = faiss.IndexFlatL2(dimension)
-                    elif embedder.distance_strategy == DistanceStrategy.MAX_INNER_PRODUCT:
-                        index = faiss.IndexFlatIP(dimension)
+                    index = self.build_index(np_feature=np_feature, distance_strategy=embedder.distance_strategy)
                 index.add(np_feature)
         else:
             # batching
             block_text, block_image = self.split_by_batchsize(chunks=chunks, batchsize=batchsize)
             for subchunks in tqdm(block_text, 'build_text'):
                 np_features = embedder.embed_query_batch_text(chunks=subchunks)
+                
                 if index is None:
-                    dimension = np_features[0].shape[-1]
-
-                    if embedder.distance_strategy == DistanceStrategy.EUCLIDEAN_DISTANCE:
-                        index = faiss.IndexFlatL2(dimension)
-                    elif embedder.distance_strategy == DistanceStrategy.MAX_INNER_PRODUCT:
-                        index = faiss.IndexFlatIP(dimension)
+                    index = self.build_index(np_feature=np_features, distance_strategy=embedder.distance_strategy)
                 index.add(np_features)
 
             for subchunks in tqdm(block_image, 'build_image'):
@@ -205,12 +200,7 @@ def save_local(self, folder_path: str, chunks: List[Chunk],
                         continue
 
                     if index is None:
-                        dimension = np_feature.shape[-1]
-
-                        i
```

**File**: `huixiangdou/primitive/splitter.py` (modified, +5/-4)
```diff
@@ -618,11 +618,12 @@ def nested_split_markdown(filepath: str,
                           modal='image')
                 image_chunks.append(c)
             else:
-                logger.error(
-                    f'image cannot access. file: {filepath}, image path: {image_path}'
-                )
+                pass
+                # logger.error(
+                #     f'image cannot access. file: {filepath}, image path: {image_path}'
+                # )
 
-    logger.info('{} text_chunks, {} image_chunks'.format(len(text_chunks), len(image_chunks)))
+    # logger.info('{} text_chunks, {} image_chunks'.format(len(text_chunks), len(image_chunks)))
     return text_chunks + image_chunks
 
 def split_python_code(filepath: str, text: str, metadata: dict = {}):
```

---

### Incident Patch 11: `03421975` (2024-09-05)
**Commit Message**: Merge branch 'main' of https://github.com/internlm/huixiangdou into main

**File**: `README.md` (modified, +2/-0)
```diff
@@ -48,6 +48,8 @@ If this helps you, please give it a star ⭐
 
 Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/detail/tpoisonooo/huixiangdou-web), where you can create knowledge base, update positive and negative examples, turn on web search, test chat, and integrate into Feishu/WeChat groups. See [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) and [YouTube](https://www.youtube.com/watch?v=ylXrT-Tei-Y) !
 
+The Web version's API for Android also supports other devices. See [Python sample code](./tests/test_openxlab_android_api.py).
+
 - \[2024/09\] [code retrieval](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] [chat_with_readthedocs](https://huixiangdou.readthedocs.io/en/latest/), see [how to integrate](./docs/zh/doc_add_readthedocs.md) 👍
 - \[2024/07\] Image and text retrieval & Removal of `langchain` 👍
```

**File**: `README_zh.md` (modified, +2/-0)
```diff
@@ -50,6 +50,8 @@
 
 Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 和 [YouTube](https://www.youtube.com/watch?v=ylXrT-Tei-Y)。
 
+Web 版给 android 的接口，也支持非 android 调用，见[python 样例代码](./tests/test_openxlab_android_api.py)。
+
 - \[2024/09\] 稀疏方法实现[代码检索](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] ["chat_with readthedocs"](https://huixiangdou.readthedocs.io/zh-cn/latest/) ，见[集成说明](./docs/zh/doc_add_readthedocs.md)
 - \[2024/07\] 图文检索 & 移除 `langchain` 👍
```

**File**: `tests/test_openxlab_android_api.py` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+import requests
+import json
+import time
+
+# 定义要发送的数据
+data = {
+    "query_id": "random_string_for_log_analysis",  # 自己定义的随机 str，用来 async 映射谁是谁的消息
+    "groupname": "茴香豆（大暑群）",  # 群名
+    "username": "tpoisonooo", # 微信群中的用户名
+    "query": {
+        "type": "text",  # 类型，支持 text 和 poll 两种。 text 意味上行给服务器发消息； poll 意味着拉**所有历史** chat 结果。
+        "content": "你好，请问如何安装 mmpose ?" # 群里发的问题
+    }
+}
+
+# 输出样例
+# {
+#   "msg": "ok",
+#   "msgCode": "10000",
+#   "data": [
+#     {
+#       "req": {
+#         "query_id": "random_string_for_log_analysis",
+#         "groupname": "茴香豆（大暑群）",
+#         "username": "tpoisonooo",
+#         "query": {
+#           "type": "text",
+#           "content": "你好，请问如何安装 mmpose ?"
+#         }
+#       },
+#       "rsp": {
+#         "code": 15,
+#         "state": "Web search fail, please check network, TOKEN and quota",
+#         "text": "根据提供的材料，HuixiangDou 是一个基于大型语言模型（LLM）的技术助手，旨在帮助算法开发者回答与开源算法项目相关的问题，例如计算机视觉和深度学习项目。这个系统被设计成可以集成到即时通讯工具（如微信和飞书）的群聊中，以提供技术支持。\n\n为了回答用户的问题，HuixiangDou 会首先通过其拒绝管道（Reject Pipeline）来确定这个问题是否值得回答。如果问题与技术相关，它将通过响应管道（Response Pipeline）来寻找答案。在这个过程中，系统会使用关键词提取、文档片段搜索和 LLM 评分等技术来确保答案的准确性和相关性。\n\n因此，对于用户提出的问题“你好，请问如何安装 mmpose ?”，HuixiangDou 会首先判断这个问题是否与技术相关，如果是，它将尝试从其知识库中搜索相关信息，并提供一个基于 LLM 的响应来指导用户如何安装 mmpose。\n\n请注意，由于 HuixiangDou 是一个技术助手，它可能无法提供非常详细的安装步骤，但它应该能够提供一些基本的指导和建议，帮助用户开始安装过程。如果需要更具体的帮助，用户可能需要参考 mmpose 的官方文档或寻求社区支持。",
+#         "references": []
+#       }
+#     },
+#     {
+#       "req": {
+#         "query_id": "random_string_for_log_analysis",
+#         "groupname": "茴香豆（大暑群）",
+#         "username": "tpoisonooo",
+#         "query": {
+#           "type": "text",
+#           "content": "你好，请问如何安装 mmpose ?"
+#         }
+#       },
+#       "rsp": {
+#         "code": 15,
+#         "state": "Web search fail, please check network, TOKEN and quota",
+#         "text": "根据提供的材料，HuixiangDou 是一个基于大型语言模型（LLM）的技术助手，旨在帮助算法开发者回答与开源算法项目相关的问题，例如计算机视觉和深度学习项目。这个系统被设计成可以集成到即时通讯工具（如微信和飞书）的群聊中，以提供技术支持。\n\n为了回答用户的问题，HuixiangDou 会首先通过其拒绝管道（Reject Pipeline）来确定这个问题是否值得回答。如果问题与技术相关，它将通过响应管道（Response Pipeline）来寻找答案。在这个过程中，系统会使用关键词提取、文档片段搜索和 LLM 评分等技术来确保答案的准确性和相关性。\n\n因此，对于用户提出的问题“你好，请问如何安装 mmpose ?”，HuixiangDou 会首先判断这个问题是否与技术相关，如果是，它将尝试从其知识库中搜索相关信息，并提供一个基于 LLM 的响应来指导用户如何安装 mmpose。\n\n请注意，由于 HuixiangDou 是一个技术助手，它可能无法提供非常详细的安装步骤，但它应该能够提供一些基本的指导和建议，帮助用户开始安装过程。如果需要更具体的帮助，用户可能需要参考 mmpose 的官方文档或寻求社区支持。",
+#         "references": []
+#       }
+#     }
+#   ]
+# }
+
+# 指定API的URL
+url = "http://139.224.198.162:18443/api/v1/message/v1/wechat/3Cy7"  # 请替换为实际的API URL
+
+# 设置请求头，通常需要包含Content-Type为application/json
+headers = {
+    'Content-Type': 'application/json'
+}
+
+# 发送POST请求
+response = requests.post(url, data=json.dumps(data), headers=headers)
+
+# 打印响应的状态码和内容
+print("Status Code:", response.status_code)
+print("Response Body:", response.text)
+
+for i in range(60):
+    print("waiting for reply")
+    data['query']['type'] = 'poll'
+    response = requests.post(url, data=json.dumps(data), headers=headers)
+    json_obj = json.loads(response.text)
+
+    resp_data = json_obj['data']
+    if len(resp_data) > 0:
+        import pdb
+        pdb.set_trace()
+        print(response.text)
+        break
+    else:
+        print(resp_data)
+
+    time.sleep(2)
+
```

---

### Incident Patch 12: `96c1f5d7` (2024-09-02)
**Commit Message**: feat(huixiangdou): add code retrieval (#379)

* feat(huixiangdou): add bm25 retriever

* feat(huixiangdou): support code search

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -57,3 +57,4 @@ evaluation/rejection/gt_good.txt
 workdir832/
 workdir.bak/
 workdir-20240729-kg-included/
+bm25.pkl
```

**File**: `README.md` (modified, +4/-1)
```diff
@@ -48,6 +48,7 @@ If this helps you, please give it a star ⭐
 
 Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/detail/tpoisonooo/huixiangdou-web), where you can create knowledge base, update positive and negative examples, turn on web search, test chat, and integrate into Feishu/WeChat groups. See [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) and [YouTube](https://www.youtube.com/watch?v=ylXrT-Tei-Y) !
 
+- \[2024/09\] [code retrieval](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] [chat_with_readthedocs](https://huixiangdou.readthedocs.io/en/latest/), see [how to integrate](./docs/zh/doc_add_readthedocs.md) 👍
 - \[2024/07\] Image and text retrieval & Removal of `langchain` 👍
 - \[2024/07\] [Hybrid Knowledge Graph and Dense Retrieval](./docs/en/doc_knowledge_graph.md) improve 1.7% F1 score 🎯
@@ -117,10 +118,12 @@ Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/det
 
 <td>
 
+- Dense for Document
+- Sparse for Code 
 - [Knowledge Graph](./docs/en/doc_knowledge_graph.md)
 - [Internet Search](./huixiangdou/service/web_search.py)
 - [SourceGraph](https://sourcegraph.com)
-- Image and text (only markdown)
+- Image and Text
 
 </td>
 
```

**File**: `README_zh.md` (modified, +3/-1)
```diff
@@ -50,6 +50,7 @@
 
 Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 和 [YouTube](https://www.youtube.com/watch?v=ylXrT-Tei-Y)。
 
+- \[2024/09\] 稀疏方法实现[代码检索](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] ["chat_with readthedocs"](https://huixiangdou.readthedocs.io/zh-cn/latest/) ，见[集成说明](./docs/zh/doc_add_readthedocs.md)
 - \[2024/07\] 图文检索 & 移除 `langchain` 👍
 - \[2024/07\] [混合知识图谱和稠密检索，F1 提升 1.7%](./docs/zh/doc_knowledge_graph.md) 🎯
@@ -119,10 +120,11 @@ Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 
 
 <td>
 
+- 文档用稠密，代码用稀疏
 - [知识图谱](./docs/zh/doc_knowledge_graph.md)
 - [联网搜索](./huixiangdou/service/web_search.py)
 - [SourceGraph](https://sourcegraph.com)
-- 图文混合（仅 markdown）
+- 图文混合
 
 </td>
 
```

**File**: `evaluation/README.md` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ For bce-embedding-base_v1
 For bge-large-zh-v1.5
 
 - The chunksize range should be (423, 1240)
-- The compression rate of embedding.tokenzier is slightly lower
+- The compression rate of embedding.tokenizer is slightly lower
 - The best F1@throttle obtained on the right value is 72.23@0.34
 
 The basis for choosing splitter is:
```

**File**: `evaluation/README_zh.md` (modified, +1/-1)
```diff
@@ -66,7 +66,7 @@ print(result)
 对 bge-large-zh-v1.5
 
 - chunksize 范围应在 (423, 1240)
-- embedding.tokenzier 的压缩率略低
+- embedding.tokenizer 的压缩率略低
 - 右值取到的最佳 F1@throttle 为 72.23@0.34
 
 splitter 选择依据
```

**File**: `huixiangdou/__init__.py` (modified, +1/-1)
```diff
@@ -9,4 +9,4 @@
 from .service import SerialPipeline, ParallelPipeline # no E401
 from .service import build_reply_text  # noqa E401
 from .service import llm_serve  # noqa E401
-from .version import __version__
+from .version import __version__
\ No newline at end of file
```

**File**: `huixiangdou/gradio_ui.py` (modified, +17/-3)
```diff
@@ -53,6 +53,7 @@ def parse_args():
 
 language='en'
 enable_web_search=False
+enable_code_search=True
 pipeline='chat_with_repo'
 main_args = None
 paralle_assistant = None
@@ -76,6 +77,13 @@ def on_web_search_changed(value: str):
     else:
         enable_web_search = True
 
+def on_code_search_changed(value: str):
+    global enable_code_search
+    print(value)
+    if 'no' in value:
+        enable_code_search = False
+    else:
+        enable_code_search = True
 
 def format_refs(refs: List[str]):
     refs_filter = list(set(refs))
@@ -92,7 +100,6 @@ def format_refs(refs: List[str]):
     text += '\r\n'
     return text
 
-
 async def predict(text:str, image:str):
     global language
     global enable_web_search
@@ -142,6 +149,7 @@ async def predict(text:str, image:str):
             paralle_assistant = ParallelPipeline(work_dir=main_args.work_dir, config_path=main_args.config_path)
         args = {'query':query, 'history':[], 'language':language}
         args['enable_web_search'] = enable_web_search
+        args['enable_code_search'] = enable_code_search
 
         sentence = ''
         async for sess in paralle_assistant.generate(**args):
@@ -212,6 +220,7 @@ def build_feature_store(main_args):
             gr.Markdown("""
             #### [HuixiangDou](https://github.com/internlm/huixiangdou) AI assistant
             """, label='Reply', header_links=True, line_breaks=True,)
+
         with gr.Row():
             if len(radio_options) > 1:
                 with gr.Column():
@@ -222,17 +231,22 @@ def build_feature_store(main_args):
                 ui_language.change(fn=on_language_changed, inputs=ui_language, outputs=[])
             with gr.Column():
                 ui_web_search = gr.Radio(["no", "yes"], label="Enable web search", info="Disable by default                                 ")
-                ui_web_search.change(on_web_search_changed, inputs=ui_web_search, outputs=[])
+                ui_web_search.change(fn=on_web_search_changed, inputs=ui_web_search, outputs=[])
+            with gr.Column():
+                ui_code_search = gr.Radio(["yes", "no"], label="Enable code search", info="Enable by default                                 ")
+                ui_code_search.change(fn=on_code_search_changed, inputs=ui_code_search, outputs=[])
 
         with gr.Row():
             input_question = gr.TextArea(label='Input your question', placeholder=main_args.placeholder, show_copy_button=True, lines=9)
             input_image = gr.Image(label='[Optional] Image-text retrieval needs `config-multimodal.ini`', render=show_image)
+
         with gr.Row():
             run_button = gr.Button()
+
         with gr.Row():
             result = gr.Markdown('>Text reply or inner status callback here, depends on `pipeline type`', label='Reply', show_label=True, header_links=True, line_breaks=True, show_copy_button=True)
             # result = gr.TextArea(label='Reply', show_copy_button=True, placeholder='Text Reply or inner status callback, depends on `pipeline type`')
-            
+
         run_button.click(predict, [input_question, input_image], [result])
     demo.queue()
     demo.launch(share=False, server_name='0.0.0.0', debug=True)
```

**File**: `huixiangdou/primitive/__init__.py` (modified, +2/-1)
```diff
@@ -12,5 +12,6 @@
     MarkdownHeaderTextSplitter,
     MarkdownTextRefSplitter,
     RecursiveCharacterTextSplitter,
-    nested_split_markdown)
+    nested_split_markdown, split_python_code)
 from .rpm import RPM
+from .bm250kapi import BM25Okapi
```

---

### Incident Patch 13: `87492bae` (2024-08-26)
**Commit Message**: Update requirements.txt (#371)

**File**: `requirements.txt` (modified, +2/-1)
```diff
@@ -33,4 +33,5 @@ fastapi
 uvicorn
 termcolor
 opencv-python-headless
-gradio>=4.41
\ No newline at end of file
+gradio>=4.41
+bcembedding
```

---

### Incident Patch 14: `88a1bf3d` (2024-08-26)
**Commit Message**: fix(parallel_pipeline.py): multimodal retrieval (#370)

**File**: `README.md` (modified, +5/-2)
```diff
@@ -83,7 +83,7 @@ Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/det
         <b>Retrieval Method</b>
       </td>
       <td>
-        <b>Instant Messaging</b>
+        <b>Integration</b>
       </td>
       <td>
         <b>Preprocessing</b>
@@ -126,8 +126,11 @@ Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/det
 
 <td>
 
-- WeChat
+- WeChat([android](./docs/add_wechat_accessibility_zh.md)/[wkteam](./docs/add_wechat_commercial_zh.md))
 - Lark
+- [OpenXLab Web](https://openxlab.org.cn/apps/detail/tpoisonooo/huixiangdou-web)
+- [Gradio Demo](./huixiangdou/gradio.py)
+- [HTTP Server](./huixiangdou/server.py)
 
 </td>
 
```

**File**: `README_zh.md` (modified, +8/-5)
```diff
@@ -82,7 +82,7 @@ Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 
         <b>检索方法</b>
       </td>
       <td>
-        <b>即时通讯</b>
+        <b>接入方法</b>
       </td>
       <td>
         <b>预处理</b>
@@ -125,8 +125,11 @@ Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 
 
 <td>
 
-- WeChat
-- Lark
+- 微信（[android](./docs/add_wechat_accessibility_zh.md)/[wkteam](./docs/add_wechat_commercial_zh.md)）
+- 飞书
+- [OpenXLab Web](https://openxlab.org.cn/apps/detail/tpoisonooo/huixiangdou-web)
+- [Gradio Demo](./huixiangdou/gradio.py)
+- [HTTP Server](./huixiangdou/server.py)
 
 </td>
 
@@ -321,8 +324,8 @@ reranker_model_path = "BAAI/bge-reranker-v2-minicpm-layerwise"
 
 需要注意：
 
-- 要手动下载 [Visualized_m3.pth](https://huggingface.co/BAAI/bge-visualized/blob/main/Visualized_m3.pth) 到 [bge-m3](https://huggingface.co/BAAI/bge-m3) 目录下
-- FlagEmbedding 需要安装新版，我们做了 [bugfix](https://github.com/FlagOpen/FlagEmbedding/commit/3f84da0796d5badc3ad519870612f1f18ff0d1d3)；[这里](https://github.com/FlagOpen/FlagEmbedding/blob/master/FlagEmbedding/visual/eva_clip/bpe_simple_vocab_16e6.txt.gz)可以下载 BGE 打包漏掉的 `bpe_simple_vocab_16e6.txt.gz`
+- 先下载 [bge-m3](https://huggingface.co/BAAI/bge-m3)，然后把 [Visualized_m3.pth](https://huggingface.co/BAAI/bge-visualized/blob/main/Visualized_m3.pth) 放进 `bge-m3` 目录
+- FlagEmbedding 需要安装 master 最新版，我们做了 [bugfix](https://github.com/FlagOpen/FlagEmbedding/commit/3f84da0796d5badc3ad519870612f1f18ff0d1d3)；[这里](https://github.com/FlagOpen/FlagEmbedding/blob/master/FlagEmbedding/visual/eva_clip/bpe_simple_vocab_16e6.txt.gz)可以下载 BGE 打包漏掉的 `bpe_simple_vocab_16e6.txt.gz`
 - 安装 [requirments-multimodal.txt](./requirements-multimodal.txt)
 
 运行 gradio 测试，图文检索效果见[这里](https://github.com/InternLM/HuixiangDou/pull/326).
```

**File**: `docs/architecture_en.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # Code Structure Explanation
 
+<img src="./figures/huixiangdou.png" width="400">
+
 This document primarily explains the directory structure and functionalities of HuixiangDou. The documentation may not be updated in real-time with the code, but the definitions that are in place will no longer change.
 
 ## First Layer: Project Introduction
```

**File**: `docs/architecture_zh.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # 代码结构说明
 
+<img src="./figures/huixiangdou.png" width="400">
+
 本文主要解释豆哥（茴香豆）各目录和功能。文档可能无法随代码即时更新，但已有定义不会再变动。
 
 ## 第一层：项目介绍
```

**File**: `huixiangdou/gradio.py` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ async def predict(text:str, image:str):
 
     if image is not None:
         filename = 'image.png'
-        image_path = os.path.join(args.work_dir, filename)
+        image_path = os.path.join(main_args.work_dir, filename)
         cv2.imwrite(image_path, image)
     else:
         image_path = None
```

**File**: `huixiangdou/primitive/query.py` (modified, +3/-3)
```diff
@@ -50,11 +50,11 @@ def __str__(self) -> str:
 
         formatted = ''
         if self.text is not None:
-            formatted += f"text='{self.text}'"
+            formatted += f"text='{self.text}' "
         if self.image is not None:
-            formatted += f"image='{self.image}'"
+            formatted += f"image='{self.image}' "
         if self.audio is not None:
-            formatted += f"audio='{self.audio}'"
+            formatted += f"audio='{self.audio}' "
         return formatted
 
     def __repr__(self) -> str:
```

**File**: `huixiangdou/primitive/splitter.py` (modified, +10/-6)
```diff
@@ -566,7 +566,8 @@ def nested_split_markdown(filepath: str,
     image_chunks = []
 
     text_ref_splitter = MarkdownTextRefSplitter(chunk_size=chunksize)
-    ref_pattern = re.compile(r'\[([^\]]+)\]\(([a-zA-Z0-9:/._~#-]+)?\)')
+    md_image_pattern = re.compile(r'\[([^\]]+)\]\(([a-zA-Z0-9:/._~#-]+)?\)')
+    html_image_pattern = re.compile(r'<img\s+[^>]*?src=["\']([^"\']*)["\'][^>]*>')
     file_opr = FileOperation()
 
     for chunk in chunks:
@@ -592,12 +593,15 @@ def nested_split_markdown(filepath: str,
             content = '{} {}'.format(header, chunk.content_or_path.lower())
             text_chunks.append(Chunk(content, metadata))
     
-        # extract images
-        matches = ref_pattern.findall(chunk.content_or_path)
+        # extract images path
         dirname = os.path.dirname(filepath)
-        for match in matches:
-            # target = match[0]
-            image_path = match[1]
+
+        image_paths = []
+        for match in md_image_pattern.findall(chunk.content_or_path):
+            image_paths.append(match[1])
+        for match in html_image_pattern.findall(chunk.content_or_path):
+            image_paths.append(match)
+        for image_path in image_paths:
             if file_opr.get_type(image_path) != 'image':
                 continue
 
```

**File**: `huixiangdou/service/parallel_pipeline.py` (modified, +3/-3)
```diff
@@ -46,7 +46,7 @@ def __init__(self, config: dict, llm: ChatClient, language: str):
 
     def process(self, sess: Session) -> Generator[Session, None, None]:
         # check input
-        if sess.query.text is None or len(sess.query.text) < 6:
+        if sess.query.text is None or len(sess.query.text) < 2:
             sess.code = ErrorCode.QUESTION_TOO_SHORT
             yield sess
             return
@@ -127,7 +127,7 @@ async def process_coroutine(self, sess: Session) -> Session:
         """Try get reply with text2vec & rerank model."""
 
         # retrieve from knowledge base
-        sess.parallel_chunks = await asyncio.to_thread(self.retriever.text2vec_retrieve, sess.query.text) 
+        sess.parallel_chunks = await asyncio.to_thread(self.retriever.text2vec_retrieve, sess.query) 
         # sess.parallel_chunks = self.retriever.text2vec_retrieve(query=sess.query.text)
         return sess
 
@@ -220,7 +220,7 @@ async def process(self, sess: Session) -> Generator[Session, None, None]:
         else:
             _, context_str, references = self.retriever.rerank_fuse(query=sess.query, chunks=sess.parallel_chunks, context_max_length=self.context_max_length)
             sess.references = references
-            prompt = self.GENERATE_TEMPLATE.format(context_str, sess.query)
+            prompt = self.GENERATE_TEMPLATE.format(context_str, sess.query.text)
             async for part in self.llm.chat_stream(prompt=prompt, history=history):
                 sess.delta = part
                 yield sess
```

---

### Incident Patch 15: `8a96608a` (2024-08-21)
**Commit Message**: fix undefined main_args in server.py (#365)

correct the main_args to args



#### Recent Merged Pull Requests:
- **PR #443** (2025-11-24): feat(uv): add pyproject.toml (@tpoisonooo)
- **PR #442** (2025-08-13): fix(wechat.py): filter msg by unique id (@tpoisonooo)
- **PR #441** (2025-07-14): Support kimi k2 (@tpoisonooo)
- **PR #439** (2025-05-21): Fix/circular import (@tpoisonooo)
- **PR #438** (2025-05-21): Rename feature_store.py to store.py and move to services directory (@tpoisonooo)
- **PR #437** (2025-05-21): Update README.md (@tpoisonooo)
- **PR #435** (2025-04-15): Update README.md (@tpoisonooo)
- **PR #434** (2025-04-15): feat(project): support internlm3 and ppio (@tpoisonooo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
