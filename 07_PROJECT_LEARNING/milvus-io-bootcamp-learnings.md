# Forensic Learning Record (Deep Inspection): milvus-io/bootcamp

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-bootcamp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/bootcamp](https://github.com/milvus-io/bootcamp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:35:22.990Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/bootcamp`
- **Description**: Dealing with all unstructured data, such as reverse image search, audio search, molecular search, video analysis, question and answer systems, NLP, etc.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2444 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `applications/image/reverse_image_search/client/src/serviceWorker.ts`
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

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

export function register(config?: Config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(
      process.env.PUBLIC_URL,
      window.location.href
    );
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

function registerValidSW(swUrl: string, config?: Config) {
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

function checkValidServiceWorker(swUrl: string, config?: Config) {
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

### Core Architecture Module: `applications/image/reverse_image_search/client/src/utils/Endpoints.ts`
```
declare global {
    interface Window {
        _env_: any;
    }
}

let endpoint = `http://172.16.20.10:5000`;
if (window._env_ && window._env_.API_URL) {
    endpoint = window._env_.API_URL;
}

export const Train = `${endpoint}/img/load`;
export const Processing = `${endpoint}/progress`;
export const Count = `${endpoint}/img/count`;
export const ClearAll = `${endpoint}/img/drop`;
export const Search = `${endpoint}/img/search`;
export const GetImageUrl = `${endpoint}/data`;

```

### Core Architecture Module: `applications/image/reverse_image_search/client/src/utils/Helper.ts`
```
let timeout: any = '';
export const delayRunFunc = (params: any, func: Function, time: number) => {
  if (timeout) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(() => {
    func(params);
  }, time);
  const r = () => {
    clearTimeout(timeout);
  };
  return r;
};
```

### Core Architecture Module: `applications/image/reverse_image_search/client/src/utils/color.ts`
```
export const baseColor = '#3F9CD1';

```

### Core Architecture Module: `applications/nlp/question_answering_system/client/src/serviceWorker.ts`
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

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

export function register(config?: Config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(
      process.env.PUBLIC_URL,
      window.location.href
    );
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

function registerValidSW(swUrl: string, config?: Config) {
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

function checkValidServiceWorker(swUrl: string, config?: Config) {
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

### Core Architecture Module: `applications/nlp/question_answering_system/client/src/utils/Endpoints.ts`
```
declare global {
  interface Window {
    _env_: any;
  }
}
let endpoint = `http://172.16.20.7:5001`;
if (window._env_ && window._env_.API_URL) {
  endpoint = window._env_.API_URL;
}

export const Train = `${endpoint}/api/v1/train`;
export const Processing = `${endpoint}/api/v1/process`;
export const Count = `${endpoint}/api/v1/count`;
export const ClearAll = `${endpoint}/api/v1/delete`;
export const Search = `${endpoint}/api/v1/search`;

export const PATH_IMAGE = `${endpoint}/home/zilliz_support/workspace/lcl/milvus_demo/web_test/pic1`;
export const PATH_IMAGE2 = `${endpoint}/home/zilliz_support/workspace/lcl/milvus_demo/web_test/pic2`;

export const LOAD = `${endpoint}/qa/load_data`;
export const SEARCH = `${endpoint}/qa/search`;
export const ANSWER = `${endpoint}/qa/answer`;
export const COUNT = `${endpoint}/qa/count`;
export const DROP = `${endpoint}/qa/drop`;

```

### Core Architecture Module: `applications/nlp/question_answering_system/client/src/utils/Helper.ts`
```
let timeout: any = '';
export const delayRunFunc = (params: any, func: Function, time: number) => {
  if (timeout) {
    clearTimeout(timeout);
  }
  timeout = setTimeout(() => {
    func(params);
  }, time);
  const r = () => {
    clearTimeout(timeout);
  };
  return r;
};
```

### Core Architecture Module: `applications/nlp/question_answering_system/client/src/utils/color.ts`
```
export const baseColor = '#3F9CD1';

```

### Core Architecture Module: `bootcamp/RAG/advanced_rag/rag_utils/graph_rag.py`
```
"""
Graph RAG Triple Extraction Demo

This module provides functionality to extract triplets (subject, predicate, object) from text passages
using LLM-based prompt engineering. The triplets are used to construct knowledge graphs for Graph RAG.
"""

import os
from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import ChatOpenAI


def extract_triplets_from_passages(
    passages: List[str], llm: ChatOpenAI
) -> List[Dict[str, Any]]:
    """
    Extract triplets from a list of passages using LLM-based prompt engineering.

    Args:
        passages: List of text passages to extract triplets from
        llm: ChatOpenAI instance for LLM processing

    Returns:
        List of dictionaries containing passage and corresponding triplets
        Format: [{"passage": str, "triplets": [[subject, predicate, object], ...]}, ...]
    """

    # Define the prompt template for triplet extraction
    triplet_extraction_prompt = """
You are an expert at extracting structured knowledge from text. Your task is to extract triplets (subject, predicate, object) from the given passage.

Rules:
1. Extract only factual relationships that are explicitly stated in the text
2. Use the exact entities as they appear in the text (maintain proper names, titles, etc.)
3. Keep predicates concise but descriptive
4. Focus on important relationships between entities
5. Each triplet should be in the format: [subject, predicate, object]
6. Return the result as a JSON object with a "triplets" key containing a list of triplets

Example:
Passage: "Albert Einstein was born in Germany in 1879. He developed the theory of relativity and won the Nobel Prize in Physics in 1921."

Output:
{{
  "triplets": [
    ["Albert Einstein", "was born in", "Germany"],
    ["Albert Einstein", "developed", "the theory of relativity"],
    ["Albert Einstein", "won", "the Nobel Prize in Physics"]
  ]
}}

Now extract triplets from the following passage:

Passage: {passage}

Output:
"""

    # Create the prompt template
    prompt_template = ChatPromptTemplate.from_messages(
        [HumanMessagePromptTemplate.from_template(triplet_extraction_prompt)]
    )

    # Create the chain with JSON output parser
    extraction_chain = (
        prompt_template
        | llm.bind(response_format={"type": "json_object"})
        | JsonOutputParser()
    )

    results = []

    # Process each passage
    for passage in passages:
        try:
            # Extract triplets using the LLM
            response = extraction_chain.invoke({"passage": passage})

            # Structure the result to match the expected format
            result = {"passage": passage, "triplets": response.get("triplets", [])}
            results.append(result)

        except Exception as e:
            print(f"Error processing passage: {e}")
            # Add empty triplets for failed passages
            results.append({"passage": passage, "triplets": []})

    return results


def demo_triplet_extraction():
    """
    Demo function showing how to use the triplet extraction functionality.
    """

    # Initialize the LLM (you need to set OPENAI_API_KEY)
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("Please set OPENAI_API_KEY environment variable")

    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
    )

    # Sample passages for demonstration
    sample_passages = [
        "Jakob Bernoulli (1654–1705): Jakob was one of the earliest members of the Bernoulli family to gain prominence in mathematics. He made significant contributions to calculus, particularly in the development of the theory of probability. He is known for the Bernoulli numbers and the Bernoulli theorem, a precursor to the law of large numbers. He was the older brother of Johann Bernoulli, another influential mathematician, and the two had a complex relationship that involved both collaboration and rivalry.",
        "Johann Bernoulli (1667–1748): Johann, Jakob's younger brother, was also a major figure in the development of calculus. He worked on infinitesimal calculus and was instrumental in spreading the ideas of Leibniz across Europe. Johann also contributed to the calculus of variations and was known for his work on the brachistochrone problem, which is the curve of fastest descent between two points.",
        "Daniel Bernoulli (1700–1782): The son of Johann Bernoulli, Daniel made major contributions to fluid dynamics, probability, and statistics. He is most famous for Bernoulli's principle, which describes the behavior of fluid flow and is fundamental to the understanding of aerodynamics.",
        "Leonhard Euler (1707–1783) was one of the greatest mathematicians of all time, and his relationship with the Bernoulli family was significant. Euler was born in Basel and was a student of Johann Bernoulli, who recognized his exceptional talent and mentored him in mathematics. Johann Bernoulli's influence on Euler was profound, and Euler later expanded upon many of the ideas and methods he learned from the Bernoullis.",
    ]

    # Extract triplets
    print("Extracting triplets from sample passages...")
    results = extract_triplets_from_passages(sample_passages, llm)

    # Print results
    for i, result in enumerate(results):
        print(f"\nPassage {i+1}:")
        print(f"Text: {result['passage'][:100]}...")
        print(f"Triplets: {result['triplets']}")

    return results


if __name__ == "__main__":
    demo_triplet_extraction()

```

### Core Architecture Module: `bootcamp/RAG/advanced_rag/rag_utils/hybrid_and_rerank.py`
```
from typing import Optional, List

from langchain_core.documents import BaseDocumentCompressor, Document
from langchain_core.runnables import Runnable, RunnableConfig
from langchain_core.runnables.utils import Input, Output


class RerankerRunnable(Runnable):
    def __init__(self, compressor: BaseDocumentCompressor, top_k: int = 4):
        self.compressor = compressor
        self.top_k = top_k

    def _remove_duplicates(self, retrieved_documents: List[Document]):
        seen_page_contents = set()
        unique_documents = []
        for doc in retrieved_documents:
            if doc.page_content not in seen_page_contents:
                unique_documents.append(doc)
                seen_page_contents.add(doc.page_content)
        return unique_documents

    def invoke(self, input: Input, config: Optional[RunnableConfig] = None) -> Output:
        milvus_retrieved_doc: List[Document] = input.get("milvus_retrieved_doc")
        bm25_retrieved_doc: List[Document] = input.get("bm25_retrieved_doc")
        query: str = input.get("query")
        print(f"len(milvus_retrieved_doc) = {len(milvus_retrieved_doc)}")
        print(f"len(bm25_retrieved_doc) = {len(bm25_retrieved_doc)}")
        unique_documents = self._remove_duplicates(
            milvus_retrieved_doc + bm25_retrieved_doc
        )
        print(f"len(unique_documents) = {len(unique_documents)}")
        result = self.compressor.compress_documents(unique_documents, query)

        return result

```

### Core Architecture Module: `bootcamp/RAG/advanced_rag/rag_utils/hyde.py`
```
from typing import Optional

import numpy as np
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import (
    RunnablePassthrough,
    RunnableLambda,
    Runnable,
    RunnableConfig,
)
from langchain_milvus import Milvus
from langchain_core.runnables.utils import Input, Output

from .vanilla import llm, embeddings

fake_doc_prompt = ChatPromptTemplate.from_template(
    "Generate 3 simulated answers to this question, "
    "return with 3 lines and each line is a simulated answer. \n\n{query}"
)

fake_doc_chain = (
    {"query": RunnablePassthrough()} | fake_doc_prompt | llm | StrOutputParser()
)


class HydeRetriever(Runnable):
    def __init__(self, vectorstore):
        self.vectorstore = vectorstore
        self.hyde_retriever = {
            "fake_generation": fake_doc_chain,
            "query": RunnablePassthrough(),
        } | RunnableLambda(self._retrieve_from_fake_docs)

    @classmethod
    def from_vectorstore(cls, vectorstore: Milvus):
        return cls(vectorstore=vectorstore)

    def invoke(self, input: Input, config: Optional[RunnableConfig] = None) -> Output:
        return self.hyde_retriever.invoke(input)

    def _retrieve_from_fake_docs(self, _dict):
        fake_generation = _dict["fake_generation"]
        query = _dict["query"]

        # Format
        fake_docs = fake_generation.strip().split("\n")
        fake_docs = [
            fake_doc[2:].strip()
            for fake_doc in fake_docs
            if fake_doc[0].isdigit() and fake_doc[1] == "."
        ]
        # print("fake_docs:", fake_docs)

        # Concatenate
        doc_vectors = embeddings.embed_documents(fake_docs)
        # query_vector = embeddings.embed_query(query)
        vector_array = np.array(doc_vectors)  # + [query_vector])

        # Search average embedding
        average_doc_vector = np.mean(vector_array, axis=0).tolist()
        res = self.vectorstore.similarity_search_by_vector(embedding=average_doc_vector)
        # print(res)
        return res

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #856** (2021-11-02): **[BUG]: 当milvus容器重启后, 搜索相似图片会失败一直卡着**
  *Symptoms*: ### Is there an existing issue for this?  - [X] I have searched the existing issues  ### Current Behavior  按教程搭建以图搜图Demo成功，实现加载图片和搜索功能；  当milvus docker容器重启后，搜索功能就不成功了。  ### Expected Behavior  1、milvus docker容器没重启之前功能正常： ![image](https://user-images.githubusercontent.com/22384214/139257250-40aa2e41-d558-422f-980a-8309f4779f09.png)  2、停止容器再启动 ![22ED8266-403E-48ac-B66F-97E25D1FEE8B](https://user-images.githubusercontent.com/22384214/139258704-7d76a09c-a483-4602-98f8-902909590986.png)  ![7CF0C292-B4C8-4054-89F5-5C67F5FC2FD6](https://user-images.githubusercontent.com/22384214/139258758-8a2f7517-e6ce-448d-a0ca-6133c8a2378d.png)  搜索失败，有知道是什么问题或者这么解决的吗？    ### Steps To Reproduce  ```markdown cd milvus docker-compose stop docker-compose start ```   ### Software version  ```markdown Milvus: [e.g. 2.0.0rc7] Server: [e.g. 2.0.0] Client: [e.g. 1.0.0] ```   ### Anything else?  _No response_
  **Post-Mortem & Fix Analysis**:
  > 貌似是这个原因造成的 ![31268e5cf2497cc0e251d2d533cc3ef](https://user-images.githubusercontent.com/22384214/139395465-c8acb54c-2f5d-48b7-988e-b5747def7bae.jpg) 
  > The error in the picture caused by the Milvus service cannot be connected, or the version of pymilvus and Milvus does not correspond.  As for the issue of reverse images search solution, I think this is indeed a bug. Because Milvus must load before a search, in fact, we will [load after we insert data](https://github.com/milvus-io/bootcamp/blob/master/solutions/reverse_image_search/quick_deploy/server/src/milvus_helpers.py#L67). It's just that you restarted Milvus, so need to reload it.  Thanks for your good first issue :) To fix this bug, you only need to add a loading interface before [searching](https://github.com/milvus-io/bootcamp/blob/master/solutions/reverse_image_search/quick_deploy/server/src/milvus_helpers.py#L108). Can you update the code and submit a PR to become our contributor?
  > 技术说下个版本会修复，先关闭

- **Issue #790** (2021-10-19): **[BUG]: reverse_image_search failed while run with custom MYSQL_PORT**
  *Symptoms*: ### Is there an existing issue for this?  - [X] I have searched the existing issues  ### Current Behavior  Follow the guide, deploy the reverse_image_search example, while using the non-default port for MySql and using env MYSQL_PORT pass it to the server. But server start failed.  Trackback log: ``` Traceback (most recent call last):   File "src/main.py", line 33, in <module>     MYSQL_CLI = MySQLHelper()   File "/home/jibin/1018/bootcamp/solutions/reverse_image_search/quick_deploy/server/src/mysql_helpers.py", line 11, in __init__     local_infile=True)   File "/home/jibin/1018/bootcamp/solutions/reverse_image_search/quick_deploy/server/venv/lib/python3.6/site-packages/pymysql/connections.py", line 290, in __init__     raise ValueError("port should be of type int") ValueError: port should be of type int  ```  ### Expected Behavior  Hope server started  ### Steps To Reproduce  ```markdown 1. export MYSQL_PORT=33060 2. start server by code python main.py 3. Got error output. ```   ### Software version  ```markdown Milvus: 2.0.0rc7, not related Server: N/A Client: N/A ```   ### Anything else?  Have some investigation on code, in `config.py` some value are read from env, but the code like `MYSQL_PORT = os.getenv("MYSQL_PORT", 3306)` will always got a string value while MYSQL_PORT is set, so a type cast to number here is needed.  I'll raise PR for fix it.
  **Post-Mortem & Fix Analysis**:
  > Thank you very much :)  Close with #791 

- **Issue #658** (2021-10-19): **The number of images returned is different from TopK**
  *Symptoms*: <!-- Please state your issue using the following template and, most importantly, in English.-->  Hello,I found a trouble that might be a new bug.I planed to stand up milvus server with code.So I came in bootcamp-master\solutions\reverse_image_search\quick_deploy\server\src,  edited ./config.py and ran ./main.py.The output information said all were well.Then I put into a image to get similar ones.However,no matter how much top k similarity I choosed,all returns were ten pictures(the first picture),the output information was OK(the second picture) .Moreover,about 10 mins later, there were some output information:500 internal error!(the third picture).In fact,the reason I choose to rum milvus server with code was that I wanted to use pre-existing mysql:5.7. So I exported Mysql_user,Mysql_pwd and ran milvus server with docker command.However ,it didnot work.The logs about milvus server was connection refuesed(the fourth picture).But when I ran with code,it worked well(the first picture).What problem was that? What should I do? Your help is important to me.I will be appreciated.   In short,I just only got 10 pictures no matter how much top k similarity I choosed.I ran milvus server the code.  **To Reproduce** - Which solution are you running? reverse_image_search;https://github.com/milvus-io/bootcamp/tree/master/solutions/reverse_image_search/quick_deploy  - Steps to reproduce the behavior(Docker or Source code): 1. Go to 'bootcamp-master\solutions\reverse_image_search\q
  **Post-Mortem & Fix Analysis**:
  > How many images did you insert into the service? How about searching for another image, is it still 10 results?
  > Yes,the result is always 10 pictures from 17125 picture collection, no matter what picture I put in,how much top k I choose .
  > I asked this question in wechat group.One administrator said it was found first time in running server with code.This similar issue was put forward when server was started by docker.So she wanted me to submit this issue.

- **Issue #635** (2021-09-13): **milvus2.0.0rc5 requirement.txt problem**
  *Symptoms*: <!-- Please state your issue using the following template and, most importantly, in English.-->  **Describe the issue** The conflict is caused by:     pymilvus 2.0.0rc5 depends on grpcio==1.37.1     tensorflow 2.5.1 depends on grpcio~=1.34.0   **To Reproduce** - Which solution are you running? Please post the link. - Steps to reproduce the behavior(Docker or Source code): 1. pip install -r requirement.txt  **Expected behavior** pip install -r requirement.txt success  **Screenshots** ![image](https://user-images.githubusercontent.com/78945582/131969223-610067fb-638e-47f3-b8ae-c3958418e55a.png)  **Software version (please complete the following information):**  - Milvus: [e.g. 2.0.0rc5]  - Server: [e.g. 2.0.0]  - Client: [e.g. 2.0.0]   **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for your issue.  This is indeed a version conflict, it can solve by specifying the tensorflow version as 2.6.0, so needs changed **requirements.txt**, can you update it and submit us a PR?  Looking forward to having you as a contributor to Bootcamp.
  > > Hi, thanks for your issue. >  > This is indeed a version conflict, it can solve by specifying the tensorflow version as 2.6.0, so needs changed **requirements.txt**, can you update it and submit us a PR? >  > Looking forward to having you as a contributor to Bootcamp.  No problem!
  > Looking forward to your pull request :)

- **Issue #611** (2021-08-31): **Document content error**
  *Symptoms*: <!-- Please state your issue using the following template and, most importantly, in English.-->  **Describe the issue** In the 166 lines, it should be 'cd client'. 
  **Post-Mortem & Fix Analysis**:
  > merged with #610 

- **Issue #521** (2021-08-16): **cannot connect to reverse_image_search**
  *Symptoms*: reverse_image_search服务器长时间不连接，再次连接报错 ![image](https://user-images.githubusercontent.com/863935/123428334-4586cd00-d5f8-11eb-8112-e023b8a134ca.png) 
  **Post-Mortem & Fix Analysis**:
  > Thanks, this is a really good question, it is caused by long Pymysql connections and can be solved by `mysql.ping()`. ```python def test_connection():     try: 	db.ping()     except: 	db = pymysql.connect(localhost, user, passwd, port, db)     return db ``` And we will fix&update it later.  

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

### Incident Patch 1: `14cefc46` (2026-09-24)
**Commit Message**: Fix Markdown rendering in Search with Jev notebooks (#1594)

* Fix Markdown line breaks in Search with Jev notebooks

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

* Clarify tutorial setup and terminal search status

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

* Focus Jev tutorials on workflows and observed results

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

---------

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `bootcamp/RAG/search_with_jev/README.md` (modified, +3/-3)
```diff
@@ -26,9 +26,9 @@ Start with [reranking search results](https://github.com/milvus-io/bootcamp/blob
 
 [Milvus Model](https://github.com/milvus-io/milvus-model) provides an application-side `JevRerankFunction`: pass a query and candidate document texts, and receive scored results with their original indices, sorted by relevance. Use those indices to reorder the records returned by Milvus.
 
-The [Jev integration](https://github.com/milvus-io/milvus-model/pull/90) has been merged. See the [implementation and constructor options](https://github.com/milvus-io/milvus-model/blob/main/src/pymilvus/model/reranker/jev.py) for the current API. It accepts `TYPESAFE_API_KEY` and defaults to `jev-latest`. Check that your installed package includes this integration before importing it; a merged change does not establish availability in a published package.
+The [Jev integration](https://github.com/milvus-io/milvus-model/pull/90) has been merged. See the [implementation and constructor options](https://github.com/milvus-io/milvus-model/blob/main/src/pymilvus/model/reranker/jev.py) for the current API. It accepts `TYPESAFE_API_KEY` and defaults to `jev-latest`. Use a package version that includes this integration.
 
-The current wrapper uses a claim-and-evidence relevance prompt. Check that this criterion fits your task. For custom judgments such as memory compatibility, stopping or routing, follow the linked tutorials using the TypeSafe API directly. The notebooks use that API directly and do not require the Milvus Model wrapper. Neither approach adds a Jev model to the Milvus server.
+The current wrapper uses a claim-and-evidence relevance prompt. Check that this criterion fits your task. For custom judgments such as memory compatibility, stopping or routing, follow the linked tutorials using the TypeSafe API directly. The tutorials demonstrate direct API calls from Python application code.
 
 ## Run a notebook
 
@@ -58,4 +58,4 @@ Keep exact constraints such as tenant access and software versions in applicatio
 | [DeepSearcher](https://github.com/zilliztech/deep-searcher) | Iterative search over private knowledge | [Experiment runner](https://github.com/zilliztech/deep-searcher/blob/master/evaluation/jev_stopping/run_full100.py) · [Search-stopping evaluation](https://github.com/zilliztech/deep-searcher/blob/master/evaluation/jev_stopping/README.md) (standalone experiment) |
 | [GPTCache](https://github.com/zilliztech/GPTCache) | Reuse answers to compatible requests | [Jev implementation](https://github.com/zilliztech/GPTCache/blob/main/gptcache/similarity_evaluation/jev.py) · [Evaluation](https://github.com/zilliztech/GPTCache/blob/main/examples/benchmark/reuse_compatibility/README.md) |
 
-These links lead to implementation code and task-specific evaluation records. DeepSearcher's link is a standalone stopping experiment, not a default search-agent feature. The studies use different datasets and evaluation methods; consult each report before comparing results.
+These links lead to implementation code and task-specific evaluation records. DeepSearcher's link provides a standalone stopping experiment. The studies use different datasets and evaluation methods; consult each report before comparing results.
```

**File**: `bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb` (modified, +55/-12)
```diff
@@ -5,7 +5,16 @@
    "id": "e372c7d7-2ec4-4149-bccc-3dec59106019",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)# Screen retrieved passages with JevFlag text that attempts to redirect an assistant rather than provide evidence. This is a supplemental signal: model screening does not replace application permissions or guarantee protection against prompt injection.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)\n",
+    "\n",
+    "# Screen retrieved passages with Jev\n",
+    "\n",
+    "Flag text that attempts to redirect an assistant rather than provide evidence. This is a supplemental signal: model screening does not replace application permissions or guarantee protection against prompt injection.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "832151d8-b228-4445-ac49-30ea63855370",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "9330566a-2500-4f89-ba99-d86050c56498",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "9cae493b-b8a4-444f-a012-bb554b5d3257",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All names and records below are synthetic teaching examples."
    ]
   },
   {
@@ -199,7 +216,15 @@
    "id": "95c8ea2b-b18f-452d-be3c-e0a24266a8e5",
    "metadata": {},
    "source": [
-    "## Connect to MilvusFor `MilvusClient`:- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).- For [Zilliz Cloud](https://zilliz.com/cloud), set `MILVUS_URI` to the public endpoint and `MILVUS_TOKEN` to your API key.Each run uses its own collection name. Cleanup removes only that collection."
+    "## Connect to Milvus\n",
+    "\n",
+    "For `MilvusClient`:\n",
+    "\n",
+    "- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).\n",
+    "- Set `MILVUS_URI` to a server endpoint such a
```

**File**: `bootcamp/RAG/search_with_jev/curate_search_data.ipynb` (modified, +56/-13)
```diff
@@ -5,7 +5,16 @@
    "id": "f47c2eda-b94e-4b97-8346-5c1c14913ced",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)# Curate documents before indexing with JevJudge whether incoming documents contain substantive operational guidance. Use the accepted IDs to build a filtered Milvus index; review uncertain documents instead of silently publishing them.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)\n",
+    "\n",
+    "# Curate documents before indexing with Jev\n",
+    "\n",
+    "Judge whether incoming documents contain substantive operational guidance. Use the accepted IDs to build a filtered Milvus index; review uncertain documents instead of silently publishing them.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "ac468eaf-a52f-4bee-ae0d-c87d628365cb",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "0da05cfc-8525-4e12-a539-775b644e9e80",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "245d85ea-7808-4617-9268-b3cc18d7a312",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All names and records below are synthetic teaching examples."
    ]
   },
   {
@@ -217,7 +234,9 @@
    "id": "e68ccd5b-02af-4921-aa93-a8e0905e0c10",
    "metadata": {},
    "source": [
-    "## Judge incoming documentsBuild a knowledge base for current technical procedures and troubleshooting fixes. Billing content is outside this particular scope; it is not inherently low quality. Obsolete procedures are unsuitable for current-version guidance but may belong in a historical archive. All seven incoming records are judged before embedding or indexing; there is no initial vector search. Scores are editorial aids and the thresholds are illustrative."
+    "## Judge incoming documents\n",
+    "\n",
+    "Build a knowledge base for current technical procedures and troubleshooting fixes. Billing content is outside this particular scope; it is not inherently low quality. Obsolete procedures are unsuitable for current-version guidance but may belong in a historical archive. All seven 
```

**File**: `bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb` (modified, +75/-18)
```diff
@@ -5,7 +5,16 @@
    "id": "d90f02ce-8bf1-4b79-9b30-2978224b437c",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)# Decide when to stop searching with JevBuild a bounded search loop: Gemini Flash generates each query from the question and evidence collected so far, Milvus retrieves passages, and Jev decides whether the evidence is sufficient. Gemini writes an answer only after the stop gate passes. Compare a direct question, a two-hop question, and a question the corpus cannot answer.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)\n",
+    "\n",
+    "# Decide when to stop searching with Jev\n",
+    "\n",
+    "Build a bounded search loop: Gemini Flash generates each query from the question and evidence collected so far, Milvus retrieves passages, and Jev decides whether the evidence is sufficient. Gemini writes an answer only after the stop gate passes. Compare a direct question, a two-hop question, and a question the corpus cannot answer.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "2310bb53-b550-4963-afef-ae01aeea1a5c",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini receives synthetic documents and queries for embedding, and the question, search history and accumulated evidence for query/answer generation; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini receives synthetic documents and queries for embedding, and the question, search history and accumulated evidence for query/answer generation; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "8da53bb5-23e6-40a2-a681-3927a3ca7854",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "ab91198b-ecfa-452a-bad6-fccae7d55ff4",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All names and records below are synthetic teaching examples."
    ]
   },
   {
@@ -181,7 +198,15 @@
    "id": "7c1496de-c3ce-41df-a754-efdd2e5e4d30",
    "metadata": {},
    "source": [
-    "## Connect to MilvusFor `MilvusClient`:- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).- For [Zilliz 
```

**File**: `bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb` (modified, +62/-13)
```diff
@@ -5,7 +5,16 @@
    "id": "010253d3-c133-4661-8594-88b818f14cc9",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)# Evaluate search evidence with JevUse Jev as a judge after retrieval: assess passage relevance, evidence sufficiency and whether a proposed answer is supported. Compare a few judgments with hand-written labels to illustrate judge validation, not to claim benchmark quality.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)\n",
+    "\n",
+    "# Evaluate search evidence with Jev\n",
+    "\n",
+    "Use Jev as a judge after retrieval: assess passage relevance, evidence sufficiency and whether a proposed answer is supported. Compare a few judgments with hand-written labels to illustrate judge validation, not to claim benchmark quality.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "96d3940b-bbf3-42d2-a25c-deacc1ef9e36",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "4759dd0b-5911-4e80-877f-0a44f93c997d",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "47abfd19-896f-44e7-b877-b59fc59e2235",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All names and records below are synthetic teaching examples."
    ]
   },
   {
@@ -217,7 +234,15 @@
    "id": "dc927fbd-94c1-49ff-9611-700ae469ece3",
    "metadata": {},
    "source": [
-    "## Connect to MilvusFor `MilvusClient`:- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).- For [Zilliz Cloud](https://zilliz.com/cloud), set `MILVUS_URI` to the public endpoint and `MILVUS_TOKEN` to your API key.Each run uses its own collection name. Cleanup removes only that collection."
+    "## Connect to Milvus\n",
+    "\n",
+    "For `MilvusClient`:\n",
+    "\n",
+    "- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).\n",
+    "- Set `MILVUS_URI`
```

**File**: `bootcamp/RAG/search_with_jev/filter_search_context.ipynb` (modified, +65/-14)
```diff
@@ -5,7 +5,16 @@
    "id": "00564030-a5d7-478b-96ac-83833a18e92a",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/filter_search_context.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/filter_search_context.ipynb)# Filter retrieved context with JevKeep passages that provide evidence for the current question before building a generation prompt. No answer-generation call is needed to inspect the filtering step.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/filter_search_context.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/filter_search_context.ipynb)\n",
+    "\n",
+    "# Filter retrieved context with Jev\n",
+    "\n",
+    "Keep passages that provide evidence for the current question before building a generation prompt. \n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "21ddfd8d-bc1a-44e0-b296-a16a1542834e",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "98fb7518-c043-44cc-9820-9487df6e9cbe",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "1cca19a8-610a-4b19-95da-fc7c3edd4b3b",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All names and records below are synthetic teaching examples."
    ]
   },
   {
@@ -217,7 +234,15 @@
    "id": "9d0cef25-bdef-43be-a411-77b02d16fd5d",
    "metadata": {},
    "source": [
-    "## Connect to MilvusFor `MilvusClient`:- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).- For [Zilliz Cloud](https://zilliz.com/cloud), set `MILVUS_URI` to the public endpoint and `MILVUS_TOKEN` to your API key.Each run uses its own collection name. Cleanup removes only that collection."
+    "## Connect to Milvus\n",
+    "\n",
+    "For `MilvusClient`:\n",
+    "\n",
+    "- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).\n",
+    "- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).\n",
+    "- For [Zilliz Cloud](https://zilliz.com/cloud), set `MILVUS_URI` to
```

**File**: `bootcamp/RAG/search_with_jev/rerank_graph_relations.ipynb` (modified, +67/-14)
```diff
@@ -5,7 +5,16 @@
    "id": "0a2ca38b-73d4-46f7-9757-a5754b66faea",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_graph_relations.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_graph_relations.ipynb)# Rerank graph relations with JevRetrieve relationship records from Milvus, score both direct evidence and useful bridge relations, and carry the relationship order into the source-document order.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_graph_relations.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_graph_relations.ipynb)\n",
+    "\n",
+    "# Rerank graph relations with Jev\n",
+    "\n",
+    "Retrieve relationship records from Milvus, score both direct evidence and useful bridge relations, and carry the relationship order into the source-document order.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "a8ffad3f-918d-4f9c-bd21-6a0235c8b153",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "f45f85bd-0b29-490d-afbf-c9b58508afc0",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "bd94b4b8-dab2-4a56-93f2-9bad9799b227",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All names and records below are synthetic teaching examples."
    ]
   },
   {
@@ -186,7 +203,15 @@
    "id": "23c57888-baef-4090-8850-af2b4147ce92",
    "metadata": {},
    "source": [
-    "## Connect to MilvusFor `MilvusClient`:- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).- For [Zilliz Cloud](https://zilliz.com/cloud), set `MILVUS_URI` to the public endpoint and `MILVUS_TOKEN` to your API key.Each run uses its own collection name. Cleanup removes only that collection."
+    "## Connect to Milvus\n",
+    "\n",
+    "For `MilvusClient`:\n",
+    "\n",
+    "- Use a local file such as `./search_with_jev.db` for [Milvus Lite](https://milvus.io/docs/milvus_lite.md).\n",
+    "- Set `MILVUS_URI` to a server endpoint such as `http://localhost:19530` for [Milvus on Docker or Kubernetes](https://milvus.io/docs/quickstart.md).\n",
+    "- F
```

**File**: `bootcamp/RAG/search_with_jev/rerank_search_results.ipynb` (modified, +69/-14)
```diff
@@ -5,7 +5,16 @@
    "id": "19882ba8-f6f5-46ee-bbe6-9ccd327d3b02",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_search_results.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_search_results.ipynb)# Rerank search results with JevA coding agent needs a past fix, but its memories contain several similar failures. Retrieve a shortlist with Milvus, then use Jev to prioritize evidence that answers the current question. Start with a small installation example to show business preferences, then compare retrieval and reranking on eight coding memories. This is a runnable teaching example, not a quality benchmark.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_search_results.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/rerank_search_results.ipynb)\n",
+    "\n",
+    "# Rerank search results with Jev\n",
+    "\n",
+    "A coding agent needs a past fix, but its memories contain several similar failures. Retrieve a shortlist with Milvus, then use Jev to prioritize evidence that answers the current question. Start with a small installation example to show business preferences, then compare retrieval and reranking on eight coding memories. This is a runnable teaching example, not a quality benchmark.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "c0a8dcba-b66a-4ac8-965f-9682b3ef86d4",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "e6112d39-9346-485a-8e85-586b6f71d8ed",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "f3a8e8b5-4547-443f-9ff5-ad1eae3eb9a9",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll records are short synthetic teaching examples. The installation documents mix audiences and versions. The eight Markdown-style memories describe several database incidents, including an unresolved investigation, an effective fix, and its verification. Keeping the corpus small makes every ranking decision inspectable."
+    "## Prepare a small corpus\n",
+    "\n",
+    "All records are short synthetic teaching examples. The installation documents mix audiences and versions. The eight Markdown-style memories describe several database incidents, including an unresolved investigation, an effective fix, and its verification. Keeping the corpus small makes every ranking decision inspectable."
    ]
   },
   {
@@ -198,7 +215,15 @
```

---

### Incident Patch 2: `7b186cb0` (2026-09-08)
**Commit Message**: Add EverOS integration guide for Milvus (#1591)

* Add EverOS integration guide for Milvus

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

* Refresh EverOS provider configuration

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

* Polish EverOS guide introduction and conclusion

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

---------

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `integration/everos_with_milvus.md` (added, +595/-0)
```diff
@@ -0,0 +1,595 @@
+# Build Long-Term Agent Memory with EverOS and Milvus
+
+[EverOS](https://github.com/EverMind-AI/EverOS) is a Markdown-first memory system for AI agents. It extracts durable memories from conversations, keeps Markdown as the source of truth, and builds a searchable derived index.
+
+In this tutorial, we will build a project assistant that remembers release decisions across separate conversations. We will add conversations about the Project Atlas launch alongside unrelated conversations about other projects. EverOS will use an LLM to extract the memories, while [Milvus](https://milvus.io/) stores the BM25 and vector indexes used for hybrid search.
+
+```text
+Conversations
+      |
+      v
+EverOS + LLM ------> Markdown memory files
+      |
+      | embedding model
+      v
+Milvus ------> BM25 + vector hybrid search
+```
+
+The LLM and embedding model have different responsibilities. The LLM turns a conversation into structured memories. The embedding model converts those memories and later search queries into vectors. The basic hybrid search in this tutorial does not require a reranking model.
+
+## Prerequisites
+
+You need:
+
+- Python 3.12 or later
+- [`uv`](https://docs.astral.sh/uv/)
+- A running [Milvus Server](https://milvus.io/docs/install-overview.md)
+- An [OpenAI API key](https://platform.openai.com/api-keys)
+
+This tutorial connects to Milvus Server at `http://localhost:19530`. EverOS also supports [Zilliz Cloud](https://zilliz.com/cloud) through the same URI and token settings. Its Milvus backend expects a remote endpoint and does not accept a Milvus Lite file path.
+
+## Install EverOS
+
+Create a local project and install EverOS with its optional Milvus dependencies:
+
+```shell
+mkdir everos-milvus-demo
+cd everos-milvus-demo
+
+uv init --bare --python 3.12
+uv add "everos[milvus]"
+```
+
+The command intentionally does not pin a version, so a new installation resolves the latest compatible EverOS release.
+
+Initialize a separate memory root for the tutorial:
+
+```shell
+export EVEROS_ROOT="$PWD/everos-data"
+uv run everos init --root "$EVEROS_ROOT"
+```
+
+EverOS creates `everos.toml` and `ome.toml` under this directory. It will also write the extracted memories here.
+
+## Configure OpenAI and Milvus
+
+Set the OpenAI API key and configure EverOS through environment variables:
+
+```shell
+export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
+export MILVUS_URI="http://localhost:19530"
+
+export EVEROS_INDEX__BACKEND="milvus"
+export EVEROS_MILVUS__URI="$MILVUS_URI"
+export EVEROS_MILVUS__COLLECTION_PREFIX="everos_bootcamp"
+
+export EVEROS_LLM__MODEL="gpt-5.4-mini"
+export EVEROS_LLM__API_KEY="$OPENAI_API_KEY"
+export EVEROS_LLM__BASE_URL="https://api.openai.com/v1"
+
+export EVEROS_EMBEDDING__MODEL="text-embedding-3-small"
+export EVEROS_EMBEDDING__API_KEY="$OPENAI_API_KEY"
+export EVEROS_EMBEDDING__BASE_URL="https://api.openai.com/v1"
+export EVEROS_EMBEDDING__DIMENSIONS="1024"
+
+export EVEROS_MEMORIZE__MODE="chat"
+```
+
+EverOS uses OpenAI for both memory extraction and embeddings. `text-embedding-3-small` returns `1536` dimensions by default, but EverOS forwards the configured `dimensions` value to OpenAI. This tutorial requests `1024` dimensions to match the Milvus schemas managed by EverOS.
+
+The `chat` memory mode keeps this example focused on user memories. EverOS manages the Milvus collections and their schemas, so you do not need to create them yourself.
+
+## Start EverOS
+
+Start the EverOS HTTP server:
+
+```shell
+uv run everos server start --root "$EVEROS_ROOT"
+```
+
+Keep this terminal open. EverOS connects to Milvus and creates seven derived-index collections with the configured prefix during startup.
+
+Open another terminal in the same project directory and check the service:
+
+```shell
+curl http://127.0.0.1:8000/health
+```
+
+Reference output:
+
+```json
+{
+  "status": "ok",
+  "version": "1.3.0",
+  "capabilities": {
+    "llm": true,
+    "embed": true,
+    "rerank": false,
+    "multimodal_llm": false,
+    "parser": true
+  },
+  "cascade": {
+    "healthy": true,
+    "pending": 0
+  }
+}
+```
+
+The response contains additional health fields. The important values for this tutorial are `status: "ok"`, `llm: true`, `embed: true`, and `cascade.healthy: true`.
+
+## Add project conversations
+
+The following Python program sends ten independent conversations to EverOS. Atlas has separate launch and rollback discussions. Eight conversations about other projects provide distractors so that the later search has to identify the correct project memories.
+
+Save the following code as `add_memories.py`:
+
+```python
+import json
+import time
+from urllib.request import Request, urlopen
+
+
+API_URL = "http://127.0.0.1:8000/api/v2/memory"
+NOW = int(time.time() * 1000)
+
+conversations = [
+    (
+        "atlas-release",
+        [
+            {
+                "sender_id": "maya",
+                "sender_name": "Maya",
+                "role": "
```

---

### Incident Patch 3: `075884f2` (2026-08-31)
**Commit Message**: Replace MemPalace notebook with a CLI-based Milvus guide (#1590)

* Replace MemPalace notebook with CLI guide

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

* Add reference outputs to MemPalace guide

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

* Refine MemPalace guide details

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

---------

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `integration/mempalace_with_milvus.ipynb` (removed, +0/-617)
```diff
@@ -1,617 +0,0 @@
-{
- "cells": [
-  {
-   "cell_type": "markdown",
-   "id": "fdf9a28f-c72c-4680-b348-2ee33ed1127a",
-   "metadata": {},
-   "source": [
-    "<a href=\"https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/integration/mempalace_with_milvus.ipynb\" target=\"_parent\"><img src=\"https://colab.research.google.com/assets/colab-badge.svg\" alt=\"Open In Colab\"/></a>   <a href=\"https://github.com/milvus-io/bootcamp/blob/master/integration/mempalace_with_milvus.ipynb\" target=\"_blank\">\n",
-    "    <img src=\"https://img.shields.io/badge/View%20on%20GitHub-555555?style=flat&logo=github&logoColor=white\" alt=\"GitHub Repository\"/>\n",
-    "</a>\n",
-    "\n",
-    "# MemPalace with Milvus\n",
-    "\n",
-    "[MemPalace](https://github.com/MemPalace/mempalace) is a memory layer for coding agents and long-running development workflows. It can mine and search project memories, conversation notes, and other \"drawers\" that help an agent keep useful context across sessions.\n",
-    "\n",
-    "In this tutorial, we will configure MemPalace to use [Milvus](https://milvus.io/) as its storage backend. The notebook uses Milvus Lite by default, so it can run locally or in Google Colab without a separate Milvus server. The same MemPalace configuration can also point to Milvus server or Zilliz Cloud for shared or production deployments.\n",
-    "\n",
-    "## Prerequisites\n",
-    "\n",
-    "Install MemPalace with its optional Milvus dependencies from PyPI.\n"
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": 1,
-   "id": "4e100df7-4388-47be-8f57-031063a4b240",
-   "metadata": {
-    "execution": {
-     "iopub.execute_input": "2026-07-23T08:43:02.669594Z",
-     "iopub.status.busy": "2026-07-23T08:43:02.669186Z",
-     "iopub.status.idle": "2026-07-23T08:43:04.005846Z",
-     "shell.execute_reply": "2026-07-23T08:43:04.003242Z"
-    }
-   },
-   "outputs": [],
-   "source": [
-    "%%capture\n",
-    "! pip install --upgrade \"mempalace[milvus]==3.6.0\""
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "id": "aaf1bae6-5026-4844-9a67-483fb8eaf64e",
-   "metadata": {},
-   "source": [
-    "\n",
-    "> If you are using Google Colab, to enable dependencies just installed, you may need to **restart the runtime** (click on the \"Runtime\" menu at the top of the screen, and select \"Restart session\" from the dropdown menu).\n",
-    "\n",
-    "This tutorial uses MemPalace's local embedding model, so you do not need an external model API key. The first run may download a small ONNX embedding model.\n",
-    "\n",
-    "## Configure MemPalace to use Milvus\n",
-    "\n",
-    "MemPalace can work with a real project directory through its CLI, but a notebook is easier to run when it creates a temporary palace directory and inserts a small set of example memories. We set the backend to `milvus`, force CPU embeddings, and keep the demo inside a temporary folder.\n"
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": 2,
-   "id": "8b3840b2-b54b-48ae-909a-af5996240cd6",
-   "metadata": {
-    "execution": {
-     "iopub.execute_input": "2026-07-23T08:43:04.011377Z",
-     "iopub.status.busy": "2026-07-23T08:43:04.010943Z",
-     "iopub.status.idle": "2026-07-23T08:43:04.025606Z",
-     "shell.execute_reply": "2026-07-23T08:43:04.023885Z"
-    }
-   },
-   "outputs": [
-    {
-     "name": "stdout",
-     "output_type": "stream",
-     "text": [
-      "Palace directory: /tmp/mempalace_milvus_demo_k5scv8e9/palace\n"
-     ]
-    }
-   ],
-   "source": [
-    "import os\n",
-    "import tempfile\n",
-    "from pathlib import Path\n",
-    "\n",
-    "os.environ[\"MEMPALACE_BACKEND\"] = \"milvus\"\n",
-    "os.environ[\"MEMPALACE_EMBEDDING_MODEL\"] = \"minilm\"\n",
-    "os.environ[\"MEMPALACE_EMBEDDING_DEVICE\"] = \"cpu\"\n",
-    "os.environ[\"MEMPALACE_EMBEDDING_THREADS\"] = \"2\"\n",
-    "\n",
-    "work_dir = Path(tempfile.mkdtemp(prefix=\"mempalace_milvus_demo_\"))\n",
-    "palace_dir = work_dir / \"palace\"\n",
-    "palace_dir.mkdir(parents=True, exist_ok=True)\n",
-    "\n",
-    "print(f\"Palace directory: {palace_dir}\")"
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "id": "f6b6e7b3-edf1-4e0b-878a-facb34e9126e",
-   "metadata": {},
-   "source": [
-    "\n",
-    "When no remote Milvus URI is configured, the MemPalace Milvus backend creates a local Milvus Lite database at `<palace>/milvus.db`.\n",
-    "\n",
-    "> As for the argument of `MilvusClient` used by the backend:\n",
-    "> - Setting the `uri` as a local file, e.g. `./milvus.db`, is the most convenient method, as it automatically utilizes [Milvus Lite](https://milvus.io/docs/milvus_lite.md) to store all data in this file.\n",
-    "> - If you have large scale of data, you can set up a more performant Milvus server on [Docker or Kubernetes](https://milvus.io/docs/quickstart.md). In this setup, please use the server uri, e.g. `http://localhost:19530`, as your `uri`.\n",
-    "> - If you 
```

**File**: `integration/mempalace_with_milvus.md` (added, +340/-0)
```diff
@@ -0,0 +1,340 @@
+# MemPalace with Milvus
+
+[MemPalace](https://github.com/MemPalace/mempalace) is a memory layer for coding agents and long-running development workflows. It organizes project knowledge into wings, rooms, and drawers, then makes the original content searchable across sessions.
+
+In this tutorial, we will use the MemPalace CLI to mine a real subset of the public [Milvus documentation](https://github.com/milvus-io/milvus-docs) and store it in [Milvus](https://milvus.io/). The corpus contains documentation about analyzers, tokenizers, and token filters. These closely related pages provide enough distractors to make the retrieval examples meaningful.
+
+The example uses Milvus Lite, so it runs locally without Docker or a separate database server. The same MemPalace configuration can also point to Milvus server or Zilliz Cloud for shared deployments.
+
+## Prerequisites
+
+Install MemPalace with its optional Milvus dependencies from PyPI. The command intentionally does not pin a version, so a new installation resolves the latest available release.
+
+```shell
+uv tool install "mempalace[milvus]"
+```
+
+You also need Git to download the documentation corpus.
+
+This tutorial uses MemPalace's local MiniLM embedding model, so it does not require an external model API key. The first mining or search command may download a small ONNX embedding model.
+
+## Configure the workspace
+
+Create a workspace with separate directories for the documentation and the palace:
+
+```shell
+mkdir -p mempalace-milvus-demo
+cd mempalace-milvus-demo
+
+export PALACE_DIR="$PWD/palace"
+export DOCS_REPO="$PWD/milvus-docs"
+export PROJECT_DIR="$PWD/milvus-analyzer-docs"
+export MEMPALACE_EMBEDDING_MODEL="minilm"
+export MEMPALACE_EMBEDDING_DEVICE="cpu"
+export MEMPALACE_EMBEDDING_THREADS="2"
+```
+
+We pass `--backend milvus` to the MemPalace commands below. Because no remote Milvus URI is configured, MemPalace creates a local Milvus Lite database at `$PALACE_DIR/milvus.db`.
+
+> As for the argument of `MilvusClient` used by the backend:
+>
+> - Setting the `uri` to a local path, such as `./milvus.db`, is the most convenient option. It automatically uses [Milvus Lite](https://milvus.io/docs/milvus_lite.md) to store data locally.
+> - For a larger deployment, you can use a [Milvus server](https://milvus.io/docs/quickstart.md) and set the URI to its endpoint, such as `http://localhost:19530`.
+> - To use [Zilliz Cloud](https://zilliz.com/cloud), set the URI and token to the cluster's [Public Endpoint and API key](https://docs.zilliz.com/docs/on-zilliz-cloud-console#free-cluster-details).
+
+## Download the Milvus documentation corpus
+
+The Milvus documentation repository is much larger than this example needs. Use Git sparse checkout to download only the Analyzer documentation directory from the `v3.0.x` branch:
+
+```shell
+git clone \
+  --depth 1 \
+  --filter=blob:none \
+  --sparse \
+  --branch v3.0.x \
+  https://github.com/milvus-io/milvus-docs.git \
+  "$DOCS_REPO"
+
+git -C "$DOCS_REPO" sparse-checkout set \
+  site/en/userGuide/schema/analyzer
+
+cp -R \
+  "$DOCS_REPO/site/en/userGuide/schema/analyzer" \
+  "$PROJECT_DIR"
+```
+
+At the time of writing, this directory contains 31 Markdown pages. They include general Analyzer guides and three groups of closely related pages:
+
+```text
+milvus-analyzer-docs/
+├── analyzer/       # Built-in language analyzers
+├── filter/         # Token filters
+├── tokenizer/      # Tokenizers
+└── *.md            # Analyzer overviews and selection guides
+```
+
+Confirm the number of source pages:
+
+```shell
+find "$PROJECT_DIR" -type f -name "*.md" | wc -l
+```
+
+Reference output:
+
+```text
+31
+```
+
+The exact count may change as the Milvus documentation branch is updated.
+
+## Define the MemPalace rooms
+
+MemPalace can detect rooms during `mempalace init`, but its initialization flow also performs project-wide heuristic entity classification and writes the accepted results to an entity registry. That classification step is not needed to define this documentation corpus, so we provide the small taxonomy directly. During mining, MemPalace may still attach deterministic heuristic entity metadata and build internal hallway links; those associations do not decide which room receives a file or change the room-scoped searches below.
+
+Create `$PROJECT_DIR/mempalace.yaml` with the following content:
+
+```yaml
+wing: milvus_analyzer_docs
+rooms:
+  - name: analyzer
+    description: Built-in language analyzers and analyzer selection guides
+    keywords:
+      - analyzer
+  - name: filter
+    description: Token filters used in analyzer pipelines
+    keywords:
+      - filter
+  - name: tokenizer
+    description: Tokenizers and language identification
+    keywords:
+      - tokenizer
+  - name: general
+    description: Analyzer documentation that does not fit another room
+    keywords: []
+```
+
+The wing represents the whole documentation corpus. A room represen
```

---

### Incident Patch 4: `72792d61` (2026-08-24)
**Commit Message**: Update Basic Memory Milvus installation (#1589)

Signed-off-by: Cheney Zhang <[REDACTED_EMAIL]>

**File**: `integration/basic_memory_with_milvus.md` (modified, +1/-8)
```diff
@@ -27,14 +27,7 @@ You need:
 - A PostgreSQL database and its `postgresql+asyncpg://...` connection URL
 - An OpenAI API key
 
-Milvus support has been merged into Basic Memory but is not yet available in its current PyPI release. Until the next release is published, install the tested upstream commit that includes the Milvus restart fix:
-
-```bash
-uv tool install --python 3.12 \
-  "basic-memory[milvus] @ git+https://github.com/basicmachines-co/basic-memory.git@eedce9bb92750282ceec73f420bb6ef05e954d4c"
-```
-
-After Basic Memory publishes a release containing the integration, the installation can be simplified to:
+Install Basic Memory with its Milvus optional dependencies from PyPI:
 
 ```bash
 uv tool install --python 3.12 "basic-memory[milvus]"
```

---

### Incident Patch 5: `17d1bb31` (2026-02-28)
**Commit Message**: add architecture diagram to multimodal RAG notebook and fix black formatting (#1578)

Signed-off-by: cheney <[REDACTED_EMAIL]>
Co-authored-by: Jael Gu <[REDACTED_EMAIL]>

**File**: `tutorials/quickstart/apps/rag_search_with_milvus/app.py` (modified, +0/-1)
```diff
@@ -9,7 +9,6 @@
 
 from dotenv import load_dotenv
 
-
 load_dotenv()
 COLLECTION_NAME = os.getenv("COLLECTION_NAME")
 MILVUS_ENDPOINT = os.getenv("MILVUS_ENDPOINT")
```

**File**: `tutorials/quickstart/apps/rag_search_with_milvus/insert.py` (modified, +0/-1)
```diff
@@ -10,7 +10,6 @@
 
 from dotenv import load_dotenv
 
-
 load_dotenv()
 COLLECTION_NAME = os.getenv("COLLECTION_NAME")
 MILVUS_ENDPOINT = os.getenv("MILVUS_ENDPOINT")
```

**File**: `tutorials/quickstart/multimodal_rag_with_milvus.ipynb` (modified, +6/-4)
```diff
@@ -27,6 +27,11 @@
     "This tutorial showcases the multimodal RAG powered by Milvus, [Visualized BGE model](https://github.com/FlagOpen/FlagEmbedding/tree/master/FlagEmbedding/visual), and [GPT-4o](https://openai.com/index/hello-gpt-4o/). With this system, users are able to upload an image and edit text instructions, which are processed by BGE's composed retrieval model to search for candidate images. GPT-4o then acts as a reranker, selecting the most suitable image and providing the rationale behind the choice. This powerful combination enables a seamless and intuitive image search experience, leveraging Milvus for efficient retrieval, BGE model for precise image processing and matching, and GPT-4o for advanced reranking."
    ]
   },
+  {
+   "cell_type": "markdown",
+   "source": "<img src=\"../../pics/multimodal_rag_with_milvus.png\" width=\"100%\" />",
+   "metadata": {}
+  },
   {
    "cell_type": "markdown",
    "metadata": {},
@@ -193,7 +198,6 @@
     "from tqdm import tqdm\n",
     "from glob import glob\n",
     "\n",
-    "\n",
     "# Generate embeddings for the image dataset\n",
     "data_dir = (\n",
     "    \"./images_folder\"  # Change to your own value if using a different data directory\n",
@@ -255,7 +259,6 @@
    "source": [
     "from pymilvus import MilvusClient\n",
     "\n",
-    "\n",
     "dim = len(list(image_dict.values())[0])\n",
     "collection_name = \"multimodal_rag_demo\"\n",
     "\n",
@@ -512,7 +515,6 @@
     "import requests\n",
     "import base64\n",
     "\n",
-    "\n",
     "openai_api_key = \"sk-***\"  # Change to your OpenAI API Key\n",
     "\n",
     "\n",
@@ -668,4 +670,4 @@
  },
  "nbformat": 4,
  "nbformat_minor": 2
-}
+}
\ No newline at end of file
```

**File**: `tutorials/quickstart/text_image_search_with_milvus.ipynb` (modified, +0/-3)
```diff
@@ -127,7 +127,6 @@
     "import clip\n",
     "from PIL import Image\n",
     "\n",
-    "\n",
     "# Load CLIP model\n",
     "model_name = \"ViT-B/32\"\n",
     "model, preprocess = clip.load(model_name)\n",
@@ -228,7 +227,6 @@
     "import os\n",
     "from glob import glob\n",
     "\n",
-    "\n",
     "image_dir = \"./images_folder/train\"\n",
     "raw_data = []\n",
     "\n",
@@ -303,7 +301,6 @@
    "source": [
     "from IPython.display import display\n",
     "\n",
-    "\n",
     "width = 150 * 5\n",
     "height = 150 * 2\n",
     "concatenated_image = Image.new(\"RGB\", (width, height))\n",
```

---

### Incident Patch 6: `deb20914` (2025-05-26)
**Commit Message**: remove build_RAG_with_milvus_and_lepton.ipynb

Signed-off-by: CheneyZhang <[REDACTED_EMAIL]>

**File**: `integration/build_RAG_with_milvus_and_lepton.ipynb` (removed, +0/-534)
```diff
@@ -1,534 +0,0 @@
-{
- "cells": [
-  {
-   "cell_type": "markdown",
-   "metadata": {
-    "collapsed": false,
-    "jupyter": {
-     "outputs_hidden": false
-    }
-   },
-   "source": [
-    "<a href=\"https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/integration/build_RAG_with_milvus_and_lepton.ipynb\" target=\"_parent\"><img src=\"https://colab.research.google.com/assets/colab-badge.svg\" alt=\"Open In Colab\"/></a>   <a href=\"https://github.com/milvus-io/bootcamp/blob/master/tutorials/integration/build_RAG_with_milvus_and_lepton.ipynb\" target=\"_blank\">\n",
-    "    <img src=\"https://img.shields.io/badge/View%20on%20GitHub-555555?style=flat&logo=github&logoColor=white\" alt=\"GitHub Repository\"/>"
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {},
-   "source": [
-    "# Build RAG with Milvus and Lepton AI\n",
-    "\n",
-    "[Lepton AI](https://www.lepton.ai/) enables developers and enterprises to run AI applications efficiently in minutes, and at a production ready scale.\n",
-    "Lepton AI allows you to build models in a Python native way, debug and test models locally, deploy them to the cloud with a single command, and consume models in any application with a simple, flexible API. It provides a comprehensive environment for deploying various AI models, including large language models (LLMs) and diffusion models, without the need for extensive infrastructure setup.\n",
-    "\n",
-    "In this tutorial, we will show you how to build a RAG (Retrieval-Augmented Generation) pipeline with Milvus and Lepton AI."
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {},
-   "source": [
-    "\n",
-    "\n",
-    "## Preparation\n",
-    "### Dependencies and Environment"
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": null,
-   "metadata": {
-    "vscode": {
-     "languageId": "shellscript"
-    }
-   },
-   "outputs": [],
-   "source": [
-    "! pip install --upgrade pymilvus[model] openai requests tqdm"
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {
-    "collapsed": false
-   },
-   "source": [
-    "> If you are using Google Colab, to enable dependencies just installed, you may need to **restart the runtime** (click on the \"Runtime\" menu at the top of the screen, and select \"Restart session\" from the dropdown menu)."
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {},
-   "source": [
-    "Lepton enables the OpenAI-style API. You can login to its official website and prepare the [api key](https://www.lepton.ai/docs) `LEPTONAI_TOKEN` as an environment variable."
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": 2,
-   "metadata": {
-    "collapsed": false,
-    "jupyter": {
-     "outputs_hidden": false
-    },
-    "pycharm": {
-     "name": "#%%\n"
-    }
-   },
-   "outputs": [],
-   "source": [
-    "import os\n",
-    "\n",
-    "os.environ[\"LEPTONAI_TOKEN\"] = \"***********\""
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {},
-   "source": [
-    "### Prepare the data\n",
-    "\n",
-    "We use the FAQ pages from the [Milvus Documentation 2.4.x](https://github.com/milvus-io/milvus-docs/releases/download/v2.4.6-preview/milvus_docs_2.4.x_en.zip) as the private knowledge in our RAG, which is a good data source for a simple RAG pipeline.\n",
-    "\n",
-    "Download the zip file and extract documents to the folder `milvus_docs`."
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": null,
-   "metadata": {
-    "vscode": {
-     "languageId": "shellscript"
-    }
-   },
-   "outputs": [],
-   "source": [
-    "! wget https://github.com/milvus-io/milvus-docs/releases/download/v2.4.6-preview/milvus_docs_2.4.x_en.zip\n",
-    "! unzip -q milvus_docs_2.4.x_en.zip -d milvus_docs"
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {},
-   "source": [
-    "We load all markdown files from the folder `milvus_docs/en/faq`. For each document, we just simply use \"# \" to separate the content in the file, which can roughly separate the content of each main part of the markdown file."
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": 17,
-   "metadata": {},
-   "outputs": [],
-   "source": [
-    "from glob import glob\n",
-    "\n",
-    "text_lines = []\n",
-    "\n",
-    "for file_path in glob(\"milvus_docs/en/faq/*.md\", recursive=True):\n",
-    "    with open(file_path, \"r\") as file:\n",
-    "        file_text = file.read()\n",
-    "\n",
-    "    text_lines += file_text.split(\"# \")"
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "metadata": {},
-   "source": [
-    "### Prepare the LLM and Embedding Model\n",
-    "\n",
-    "Lepton enables the OpenAI-style API, and you can use the same API with minor adjustments to call the LLM."
-   ]
-  },
-  {
-   "cell_type": "code",
-   "execution_count": 3,
-   "metadata": {},
-   "outputs": [],
-   "source": [
-    "from openai import OpenAI\n",
-    "\n",
-    "lepton_client = 
```

#### Recent Merged Pull Requests:
- **PR #1594** (2026-09-24): Fix Markdown rendering in Search with Jev notebooks (@zc277584121)
- **PR #1593** (2026-09-23): Improve Search with Jev tutorials with realistic workflows and visible decisions (@zc277584121)
- **PR #1592** (2026-09-22): Add Jev and Milvus search cookbook (@zc277584121)
- **PR #1591** (2026-09-08): Add EverOS integration guide for Milvus (@zc277584121)
- **PR #1590** (2026-08-31): Replace MemPalace notebook with a CLI-based Milvus guide (@zc277584121)
- **PR #1589** (2026-08-24): Update Basic Memory Milvus installation (@zc277584121)
- **PR #1587** (2026-08-11): Add Google ADK and MemPalace Milvus notebooks (@zc277584121)
- **PR #1586** (2026-04-20): Remove outdated ColPali multi-modal retrieval notebook (@zc277584121)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
