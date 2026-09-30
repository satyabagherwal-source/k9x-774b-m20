# Forensic Learning Record (Deep Inspection): pinecone-io/examples

> **Canonical Artifact**: `07_PROJECT_LEARNING/pinecone-io-examples-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pinecone-io/examples](https://github.com/pinecone-io/examples))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:24:23.322Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pinecone-io/examples`
- **Description**: Jupyter Notebooks to help you get hands-on with Pinecone vector databases
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3044 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `learn/experimental/semantic-text-search/helper.py`
```
import os
import itertools
import re
import getpass

from IPython.display import display, Markdown
import numpy as np
import pandas as pd
import seaborn as sns


ENVIRONMENTAL_VARIABLE_NAME = 'PINECONE_EXAMPLE_API_KEY'
PINECONE_PALETTE = [
    "#1C17FF",
    "#000000",
    "#030080",
    "#25239D",
    "#738FAB",
    "#DFECF9",
    "#F1F5F8",
    "#FFFFFF",
    "#FAFF00",
    "#8CF1FF"
]
pinecone_api_key = None


def set_pinecone_api_key():
    global pinecone_api_key
    api_key_prompt = (
        f'{ENVIRONMENTAL_VARIABLE_NAME} not found in environmental variables list.\n'
        'Get yours at https://app.pinecone.io and enter it here: '
    )
    printmd(f'Extracting API Key from environmental variable `{ENVIRONMENTAL_VARIABLE_NAME}`...')
    pinecone_api_key = os.getenv(ENVIRONMENTAL_VARIABLE_NAME)
    if not pinecone_api_key:
        printmd(api_key_prompt)
        pinecone_api_key = getpass.getpass('')
    printmd('Pinecone API Key available at `h.pinecone_api_key`')


printmd = lambda x: display(Markdown(x))


def chunks(lst, n):
    """A generator function that iterates through lst in batches.
    
    Each batch is of size n except possibly the last batch, which may be of 
    size less than n.
    """
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def get_top_sources(dataframe, n=20):
    """Return an iterable with the top n most frequent domains."""
    sources = dataframe.domain.value_counts().head(n).index.tolist()
    return sources


def get_processed_domain(df_row, sources):
    """Return metadata for top sources."""
    domain = df_row['domain']
    return domain if domain in sources else 'other'


def get_text_prefix(text, num_fragments_to_keep=5):
    """Return an abridged version of text."""
    fragmented_text = re.split(r'(?<=[.:;])\s', text)
    abridged_text = " ".join(fragmented_text[:num_fragments_to_keep])
    return abridged_text


def get_processed_df(df):
    """Return processed dataframe ready for usage."""
    # keep first few sentences
    df['text_to_encode'] = df.title + ' ' + df.text.apply(get_text_prefix)
    # parse date
    df.date = pd.to_datetime(df.date)
    df['year'] = df.date.dt.strftime('%Y').fillna(-1).astype(int)
    df['month'] = df.date.dt.strftime('%m').fillna(-1).astype(int)
    # Process domain (keeping top 20 and labeling the rest as 'other')
    sources = get_top_sources(df)
    df['processed_domain'] = df.apply(
        get_processed_domain, 
        axis=1, 
        args=(sources,)
    )
    # prepare index as string
    df.index = df.index.map(str)
    df.index.name = 'vector_id'
    return df


def get_tqdm_kwargs(dataframe, chunksize):
    return dict(
        smoothing=0, 
        unit='chunk of vectors', 
        total=int(np.ceil(len(dataframe)/chunksize))
    )


def get_ids_scores(response):
    """Return ids and scores from Pinecone query response."""
    matches = response['matches']
    ids, scores = zip(*[(match['id'], match['score']) for match in matches])
    return list(ids), list(scores)


def make_clickable(val):
    # target _blank to open new window
    return f'<a target="_blank" href="{val}">link</a>'


def run_on_module_import():
    sns.set_palette(PINECONE_PALETTE)
    set_pinecone_api_key()
    pd.set_option('display.max_colwidth', 2000)


run_on_module_import()


```

### Core Architecture Module: `learn/generation/langchain/handbook/09-langchain-streaming/main.py`
```
import os
import asyncio
from typing import Any

import uvicorn
from fastapi import FastAPI, Body
from fastapi.responses import StreamingResponse
from queue import Queue
from pydantic import BaseModel

from langchain.agents import AgentType, initialize_agent
from langchain.chat_models import ChatOpenAI
from langchain.memory import ConversationBufferWindowMemory
from langchain.callbacks.streaming_aiter import AsyncIteratorCallbackHandler
from langchain.callbacks.streaming_stdout_final_only import FinalStreamingStdOutCallbackHandler
from langchain.schema import LLMResult

app = FastAPI()

# initialize the agent (we need to do this for the callbacks)
llm = ChatOpenAI(
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    temperature=0.0,
    model_name="gpt-3.5-turbo",
    streaming=True,  # ! important
    callbacks=[]  # ! important (but we will add them later)
)
memory = ConversationBufferWindowMemory(
    memory_key="chat_history",
    k=5,
    return_messages=True,
    output_key="output"
)
agent = initialize_agent(
    agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
    tools=[],
    llm=llm,
    verbose=True,
    max_iterations=3,
    early_stopping_method="generate",
    memory=memory,
    return_intermediate_steps=False
)

class AsyncCallbackHandler(AsyncIteratorCallbackHandler):
    content: str = ""
    final_answer: bool = False
    
    def __init__(self) -> None:
        super().__init__()

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        self.content += token
        # if we passed the final answer, we put tokens in queue
        if self.final_answer:
            if '"action_input": "' in self.content:
                if token not in ['"', "}"]:
                    self.queue.put_nowait(token)
        elif "Final Answer" in self.content:
            self.final_answer = True
            self.content = ""
    
    async def on_llm_end(self, response: LLMResult, **kwargs: Any) -> None:
        if self.final_answer:
            self.content = ""
            self.final_answer = False
            self.done.set()
        else:
            self.content = ""

async def run_call(query: str, stream_it: AsyncCallbackHandler):
    # assign callback handler
    agent.agent.llm_chain.llm.callbacks = [stream_it]
    # now query
    await agent.acall(inputs={"input": query})

# request input format
class Query(BaseModel):
    text: str

async def create_gen(query: str, stream_it: AsyncCallbackHandler):
    task = asyncio.create_task(run_call(query, stream_it))
    async for token in stream_it.aiter():
        yield token
    await task

@app.post("/chat")
async def chat(
    query: Query = Body(...),
):
    stream_it = AsyncCallbackHandler()
    gen = create_gen(query.text, stream_it)
    return StreamingResponse(gen, media_type="text/event-stream")

@app.get("/health")
async def health():
    """Check the api is running"""
    return {"status": "🤙"}
    

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="localhost",
        port=8000,
        reload=True
    )

```

### Core Architecture Module: `learn/generation/openai/fine-tuning/gpt-3.5-agent-training/chains.py`
```
from pinecone import Pinecone
import openai
from uuid import uuid4
from tqdm.auto import tqdm


class VectorDBChain:
    name: str = "Vector Search Tool"
    description: str = "A tool for finding information about a topic."
    class Config:
        arbitrary_types_allowed = True

    def __init__(
        self,
        index_name: str,
        environment: str,
        pinecone_api_key: str
    ):
        pinecone.init(api_key=pinecone_api_key, environment=environment)
        if index_name not in pinecone.list_indexes().names():
            pinecone.create_index(
                name=index_name,metric="cosine", shards=1)
        self.index = pinecone.Index(index_name)

    def _embed(self, texts: list[str]):
        res = openai.Embedding.create(
            input=texts, engine="text-embedding-ada-002"
        )
        embeds = [x["embedding"] for x in res["data"]]
        return embeds
    
    def query(self, text: str) -> list[str]:
        # create query vector
        xq = self._embed([text])[0]
        res = self.index.query(vector=xq, top_k=3, include_metadata=True)
        # get documents
        documents = [x.metadata["text"] for x in res.matches]
        return documents

    def build_index(self, documents: list[str], batch_size: int = 100):
        for i in tqdm(range(0, len(documents), batch_size)):
            # get end of batch
            i_end = min(i + batch_size, len(documents))
            batch = documents[i:i_end]
            # create document/context embeddings
            xd = self._embed(batch)
            # create metadata
            metadata = [{"document": x} for x in batch]
            ids = [str(uuid4()) for _ in batch]
            # add to index
            self.index.upsert(vectors=zip(ids, xd, metadata))

```

### Core Architecture Module: `learn/search/image/image-search/helper.py`
```
"""Helper module for Pinecone's image search example"""

import os
import itertools
import re
import getpass
import random

from IPython.display import display, Markdown
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.axes_grid1 import ImageGrid
import seaborn as sns

from torchvision.transforms import (
    Compose, 
    Resize, 
    CenterCrop, 
    ToTensor, 
    Normalize
)


ENVIRONMENTAL_VARIABLE_NAME = 'PINECONE_EXAMPLE_API_KEY'
PINECONE_PALETTE = [
    "#1C17FF",
    "#000000",
    "#030080",
    "#25239D",
    "#738FAB",
    "#DFECF9",
    "#F1F5F8",
    "#FFFFFF",
    "#FAFF00",
    "#8CF1FF"
]
pinecone_api_key = None


printmd = lambda x: display(Markdown(x))


def set_pinecone_api_key():
    global pinecone_api_key
    api_key_prompt = (
        f'{ENVIRONMENTAL_VARIABLE_NAME} not found in environmental variables list.\n'
        'Get yours at https://app.pinecone.io and enter it here: '
    )
    printmd(f'Extracting API Key from environmental variable `{ENVIRONMENTAL_VARIABLE_NAME}`...')
    pinecone_api_key = os.getenv(ENVIRONMENTAL_VARIABLE_NAME)
    if not pinecone_api_key:
        printmd(api_key_prompt)
        pinecone_api_key = getpass.getpass('')
    printmd('Pinecone API Key available at `h.pinecone_api_key`')


preprocess = Compose([
    Resize(256),
    CenterCrop(224),
    ToTensor(),
    Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def show_random_images_from_full_dataset(dset, num_rows=4, num_cols=8):
    """Show random sample of images in PyTorch dataset."""
    
    ### get random sample of images and labels
    indices = np.random.randint(0, high=len(dset)+1, size=num_rows*num_cols)
    im_arrays = np.take(dset.data, indices, axis=0)
    labels = map(dset.classes.__getitem__, np.take(dset.targets, indices))

    ### plot sample
    fig = plt.figure(figsize=(20, 20))
    grid = ImageGrid(
        fig, 
        111,
        nrows_ncols=(num_rows, num_cols),
        axes_pad=0.3)
    for ax, im_array, label in zip(grid, im_arrays, labels):
        ax.imshow(im_array)
        ax.set_title(label)
        ax.axis("off")


def get_tqdm_kwargs(dataloader):
    batch_size, total_samples = dataloader.batch_size, len(dataloader.dataset)
    return dict(
        smoothing=0, 
        unit=f'chunk of {batch_size} '
             f'{dataloader.dataset.__class__.__name__} vectors',
        total=int(np.ceil(total_samples/batch_size))
    )


def _get_ids_scores_metadatas(response):
    """Return ids and scores from Pinecone query response."""
    matches = response['results'][0]['matches']
    ids, scores, metadatas = zip(*[(
        match['id'], 
        match['score'], 
        match['metadata']
    ) for match in matches])
    return list(ids), list(scores), list(metadatas)


def get_response_information(response):
    """Return dataset, ids, and scores from Pinecone query response."""
    ids, scores, metadatas = _get_ids_scores_metadatas(response)
    datasets, rows = list(zip(*[id_.split('.') for id_ in ids]))
    return datasets, map(int, rows), scores, metadatas


def show_response_as_grid(response, datasets, nrows, ncols, **subplot_kwargs):
    fig, axes = plt.subplots(nrows, ncols, **subplot_kwargs)
    fig.tight_layout()
    iter_response = get_response_information(response)
    iter_images = zip(*[*iter_response, axes.flat])
    for dataset_name, row, score, metadata, ax in iter_images:
        result_array = datasets[dataset_name].data[row]
        ax.imshow(result_array)
        ax.set_title(
            f'{dataset_name}: {metadata["label"]}\nsimilarity: {score:.4}'
        )
        ax.axis("off")


def run_on_module_import():
    sns.set_palette(PINECONE_PALETTE)
    set_pinecone_api_key()
    import warnings
    warnings.filterwarnings('ignore')


run_on_module_import()

```

### Core Architecture Module: `learn/search/semantic-search/gif-search/app.py`
```
import streamlit as st
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

@st.experimental_singleton
def init_pinecone():
    # find API key at app.pinecone.io
    pinecone.init(api_key="<<YOUR_API_KEY>>", environment="us-west1-gcp")
    return pinecone.Index('gif-search')
    
@st.experimental_singleton
def init_retriever():
    return SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

index = init_pinecone()
retriever = init_retriever()


def card(urls):
    figures = [f"""
        <figure style="margin-top: 5px; margin-bottom: 5px; !important;">
            <img src="{url}" style="width: 130px; height: 100px; padding-left: 5px; padding-right: 5px" >
        </figure>
    """ for url in urls]
    return st.markdown(f"""
        <div style="display: flex; flex-flow: row wrap; text-align: center; justify-content: center;">
        {''.join(figures)}
        </div>
    """, unsafe_allow_html=True)

 
st.write("""
## ⚡️ AI-Powered GIF Search ⚡️
""")

query = st.text_input("What are you looking for?", "")

if query != "":
    with st.spinner(text="Similarity Searching..."):
        xq = retriever.encode([query]).tolist()
        xc = index.query(vector=xq, top_k=30, include_metadata=True)
        
        urls = []
        for context in xc['results'][0]['matches']:
            urls.append(context['metadata']['url'])

    with st.spinner(text="Fetching GIFs 🚀🚀🚀"):
        card(urls)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #335** (2024-11-18): **[Bug] Unable to reproduce zero-shot object detection**
  *Symptoms*: ### Is this a new bug?  - [X] I believe this is a new bug - [X] I have searched the existing issues, and I could not find an existing issue for this bug  ### Current Behavior  I tried running the zero=shot object detection notebook at https://www.pinecone.io/learn/series/image-search/zero-shot-object-detection-clip/ without any changes but am unable to reproduce the result given on the website. The bounding boxes output for the cat and butterfly are identical  Kindly help me debug this.  ### Expected Behavior  The expected output is the set of correct bounding boxes for cat and butterfly.  ### Steps To Reproduce  The colab notebook with outputs is https://colab.research.google.com/drive/1Js1aame9wOYSkiOz0Fi14aemLSeycR1R?usp=sharing  ### Relevant log output  _No response_  ### Environment  ```markdown - **OS**: Colab runtime  - **Language version**: - **Pinecone client version**: ```   ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi there, I am facing the same issue. Does anyone have solutions? Thanks :)
  > Try adding `do_rescale=False` when passing the image to the processor. Before: `inputs = processor(                 images=big_patch,                 return_tensors="pt",                 text=prompt,                 padding=True             ).to(device)` After: `inputs = processor(                 images=big_patch,                 return_tensors="pt",                 text=prompt,                 padding=True,                 do_rescale=False             ).to(device)`
  > > Try adding `do_rescale=False` when passing the image to the processor. Before: `inputs = processor( images=big_patch, return_tensors="pt", text=prompt, padding=True ).to(device)` After: `inputs = processor( images=big_patch, return_tensors="pt", text=prompt, padding=True, do_rescale=False ).to(device)`  This worked for me! Thank you!

- **Issue #301** (2023-12-24): **[Bug] 'threading' has no attribute '_Condition' on 05-langchain-retrieval-augmentation.ipynb**
  *Symptoms*: ### Is this a new bug?  - [X] I believe this is a new bug - [X] I have searched the existing issues, and I could not find an existing issue for this bug  ### Current Behavior  from datasets import load_dataset  data = load_dataset("wikipedia", "20220301.simple", split='train[:10000]') data  ### Expected Behavior  loading wikipedia dataset  ### Steps To Reproduce  run https://github.com/pinecone-io/examples/blob/master/learn/generation/langchain/handbook/05-langchain-retrieval-augmentation.ipynb on google colab  ### Relevant log output  ```shell ---------------------------------------------------------------------------  AttributeError                            Traceback (most recent call last)  <ipython-input-2-1665814e1737> in <cell line: 1>() ----> 1 from datasets import load_dataset       2        3 data = load_dataset("wikipedia", "20220301.simple", split='train[:10000]')       4 data  8 frames  /usr/local/lib/python3.10/dist-packages/multiprocess/dummy/__init__.py in <module>      85 #      86  ---> 87 class Condition(threading._Condition):      88     # XXX      89     if sys.version_info < (3, 0):  AttributeError: module 'threading' has no attribute '_Condition' ```   ### Environment  ```markdown google colab ```   ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > same as #229 

- **Issue #193** (2023-08-02): **Notebook Crashes when loading model to CUDA**
  *Symptoms*: ### Is this a new bug?  - [X] I believe this is a new bug - [X] I have searched the existing issues, and I could not find an existing issue for this bug  ### Current Behavior  Hi, I was executing your notebook, but somehow my Kernel crashes every time I try to load the model. I am using an NVIDIA GeForce RTX 4090 GPU. The point at which it crashes -  ```  from torch import cuda, bfloat16 import transformers  device = f'cuda:{cuda.current_device()}' if cuda.is_available() else 'cpu'  model = transformers.AutoModelForCausalLM.from_pretrained(     'mosaicml/mpt-7b-instruct',     trust_remote_code=True,     torch_dtype=bfloat16,     max_seq_len=2048 ) model.eval() model.to(device) print(f"Model loaded on {device}") ``` I am using the latest version of the transformers library and the model checkpoint. I have also ensured that all the dependencies are up to date.  Any assistance would be greatly appreciated. Thank you!   ### Expected Behavior  Model should get loaded on CUDA   ### Steps To Reproduce  Ran it as the same way as your code.   If possible can you confirm if you were using Colab Pro?  ### Relevant log output  _No response_  ### Environment  ```markdown - **OS**: Ubuntu - **Language version**: Python3  My System Specs - NVIDIA GeForce RTX 4090 PyTorch -2.0.1,  Cuda 11.7 ```   ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > the same is happening to me
  > Hello, it appears that your instance lacks sufficient RAM capacity to load the entire model into memory. To resolve this, you can execute our notebooks using Google Colab with a modified Runtime Environment. I recommend setting the Hardware accelerator to GPU, selecting T4 as the GPU type, and configuring the Runtime Shape to "High RAM."  If the issue persists, consider running the notebook on a larger GPU instance.

- **Issue #182** (2023-07-31): **[Bug] redundancy in URL: gpt-4-langchain-docs.ipynb**
  *Symptoms*: ### Is this a new bug?  - [X] I believe this is a new bug - [X] I have searched the existing issues, and I could not find an existing issue for this bug  ### Current Behavior  the domain_full variable adds en/latest on to en/latest, causing the BS4 module to recursively 404 across langchain ``` from bs4 import BeautifulSoup import urllib.parse import html import re  domain = "https://python.langchain.com/en/latest/" domain_full = domain+"en/latest/"  soup = BeautifulSoup(res.text, 'html.parser') ```    ### Expected Behavior  it should recursively pull the documentation from langchain  ### Steps To Reproduce  attempt to run the script, by the fourth notebook action it will 404  ### Relevant log output  _No response_  ### Environment  ```markdown - M1 Mac ```   ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed with more recent changes, should be working now, thanks!

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

### Incident Patch 1: `d12615d4` (2026-09-04)
**Commit Message**: Fix stale Parquet references and drop intro flow diagram (#618)

- Update intro step list from Parquet to JSONL to match the
schema-based/Documents API flow already used elsewhere in the notebook
- Remove the outdated "data flow" image and its lead-in sentence
- Fixed an issue with link checker so docs urls pointing to "latest"
won't fail


<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Documentation and CI allowlist changes only; no runtime product or
auth logic.
> 
> **Overview**
> Updates **`docs/pinecone-import.ipynb`** so the intro matches the
notebook’s actual Documents API / JSONL bulk-import path: solution steps
**3–5** now say **JSONL** instead of Parquet, the imports guide link
points to **`guides/index-data/import-data`**, and the outdated
**data-flow diagram** (embedded image + lead-in) is removed.
**`pandas`** is added to the install cell so dependencies match the code
that already uses a DataFrame.
> 
> In **`.github/actions/check-links/check-links.py`**,
**`docs.pinecone.io/reference/api/latest/`** is added to
**`ignore_links`** so CI does not fail on Pinecone’s intentional
“latest” API permalink redirects (scoped to that path only).
> 
> <sup>Reviewed by [C

**File**: `.github/actions/check-links/check-links.py` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@
     "q4cdn.com",  # CDN returns 451 for HEAD requests but works with GET
     "prod-1-data.ke.pinecone.io",  # internal API endpoint requiring auth
     "aistudio.google.com",  # redirects to Google sign-in, requires auth
+    "docs.pinecone.io/reference/api/latest/",  # intentional permalink redirect to the current API version; not a general allowance for redirects
 ]
 
 known_good_links = set(known_good)
```

**File**: `docs/pinecone-import.ipynb` (modified, +43/-63)
```diff
@@ -35,43 +35,23 @@
     "\n",
     "2. **Embed data**: Create vector embeddings from each article using Pinecone's Inference API. These embeddings are crucial for indexing and retrieval in Pinecone.\n",
     "\n",
-    "3. **Create Parquet files**: Save the vector embeddings, along with metadata, into Parquet files.\n",
+    "3. **Create JSONL files**: Save the vector embeddings, along with metadata, into JSONL files.\n",
     "\n",
-    "4. **Access S3 bucket**: Access the S3 bucket where the Parquet files will be stored.\n",
+    "4. **Access S3 bucket**: Access the S3 bucket where the JSONL files will be stored.\n",
     "\n",
-    "5. **Upload Parquet files**: Upload the Parquet files containing the embeddings to the S3 bucket.\n",
+    "5. **Upload JSONL files**: Upload the JSONL files containing the embeddings to the S3 bucket.\n",
     "\n",
     "6. **Create Pinecone index**: Create a Pinecone index where the embeddings will be stored. This index will allow for efficient similarity search and other tasks.\n",
     "\n",
     "7. **Load S3 data into Pinecone index**: Load the embeddings from the S3 bucket into the Pinecone index.\n",
     "\n",
     "\n",
-    "Please see our official [Understanding Imports in Pinecone documentation](https://docs.pinecone.io/guides/data/understanding-imports) for additional information."
+    "Please see our official [Understanding Imports in Pinecone documentation](https://docs.pinecone.io/guides/index-data/import-data) for additional information."
    ]
   },
   {
    "cell_type": "markdown",
    "id": "2",
-   "metadata": {
-    "id": "kdJjv4CHJOwA"
-   },
-   "source": [
-    "The data flow for the notebook is outlined below:"
-   ]
-  },
-  {
-   "cell_type": "markdown",
-   "id": "3",
-   "metadata": {
-    "id": "DP3Q0AhuXRQ9"
-   },
-   "source": [
-    "![Pinecone101_flow.png](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZEAAALtCAYAAADpKVlwAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAABkaADAAQAAAABAAAC7QAAAAAbQfJfAABAAElEQVR4AeydB3xUVdrGn/TeE0JJKCEQaujSEZQiKuiuhV17X+uurrriun6Ku2td17L23jv2giAigvReEkogCSQhkN578p1zwoSUSTKZzNyZufc5/sjccs553/f/jve555w7M24NooCFBEiABEiABKwg4G5FGzYhARIgARIgAUWAIsI3AgmQAAmQgNUEKCJWo2NDEiABEiABigjfAyRAAiRAAlYToIhYjY4NSYAESIAEKCJ8D5AACZAACVhNgCJiNTo2JAESIAESoIjwPUACJEACJGA1AYqI1ejYkARIgARIgCLC9wAJkAAJkIDVBCgiVqNjQxIgARIgAYoI3wMkQAIkQAJWE6CIWI2ODUmABEiABCgifA+QAAmQAAlYTYAiYjU6NiQBEiABEqCI8D1AAiRAAiRgNQGKiNXo2JAESIAESIAiwvcACZAACZCA1QQoIlajY0MSIAESIAGKCN8DJEACJEACVhOgiFiNjg1JgARIgAQoInwPkAAJkAAJWE2AImI1OjYkARIgARKgiPA9QAIkQAIkYDUBiojV6NiQBEiABEiAIsL3AAmQAAmQgNUEKCJWo2NDEiABEiABigjfAyRAAiRAAlYToIhYjY4NSYAESIAEKCJ8D5AACZAACVhNgCJiNTo2JAESIAESoIjwPUACJEACJGA1AYqI1ejYkARIgARIgCLC9wAJkAAJkIDVBCgiVqNjQxIgARIgAYoI3wMkQAIkQAJWE6CIWI2ODUmABEiABCgifA+QAAmQAAlYTYAiYjU6NiQBEiABEqCI8D1AAiRAAiRgNQGKiNXo2JAESIAESIAiwvcACZAACZCA1QQoIlajY0MSIAESIAGKCN8DJEACJEACVhOgiFiNjg1JgARIgAQoInwPkAAJkAAJWE2AImI1OjYkARIgARKgiPA9QAIkQAIkYDUBiojV6NiQBEiABEiAIsL3AAmQAAmQgNUEKCJWo2NDEiABEiABigjfAyRAAiRAAlYToIhYjY4NSYAESIAEKCJ8D5AACZAACVhNwNPqlmxIAiRgMYEfN++3uC4rujaBeRMSXDuALnpPEekiMFYnAWsIvP7DFmxMO25NU7ZxIQI9g/1AEXGhhNFVEnAlAglx/XDa+PGu5DJ97QKBvUnJyDqS2oUW+qjKkYg+8sgoXISAv7+fi3hKN0nAMgJcWLeME2uRAAmQAAmYIUARMQOFh0iABEiABCwjQBGxjBNrkQAJkAAJmCFAETEDhYdIgARIgAQsI0ARsYwTa5EACZAACZghQBExA4WHSIAESIAELCNAEbGME2uRAAmQAAmYIUARMQOFh0iABEiABCwjQBGxjBNrkQAJkAAJmCFAETEDhYdIgARIgAQsI0ARsYwTa5EACZAACZghQBExA4WHSIAESIAELCPAL2C0jBNrkYDTEyg+fgTH9m5EWU42IuNHoOeQ8fAOCHJ6v805mH9kPzJ3rQNq6+AbFiniGYmwPgPNVeUxBxPgSMTBCaB5ErAFgSPbV+Onx25EUcYhBERGI2XV5zi4+gtbdN2tPrZ88CSOH9je5T6Ks9KRtu57uHt74/Car7DqyduQ8kvn8aStX4b9Kz/usj02sJ4ARyLWs2NLEnAKAlUlBdjy7mMYfs5VSDjzYuWTfG2or2vyr6GhAQVpyaiurkBU3Eh4eHmrc4VCdIKieqNAvMoSOWA44O6mtttrk3d4LwJ69EHJsSOob6hD9OAxKMnJEvtp8A0KRVj/oXBzcxPHMnFszwYE9ewLd3dP9Bg4Ag3ieG11JfJTk+Dh44+IvuJXAE/aU0ab/QmI6oPhZ1+BYfMvR/rGFdj2ydNidDUOgaI/c/aqSouQJUZiXj5+yEnZjdA+cfD09UdhRgpK87LVfpDok8W2BCgituXJ3khAcwLygilLzJjTW9h2c/dQ+/X19dj09sPIObgToeKivfntRzFm0e2IGTU
```

---

### Incident Patch 2: `4b182043` (2026-08-13)
**Commit Message**: security: remediate critical/high Dependabot alerts (lockfile bumps) (#605)

Part of the public-repo security fast-track (Pinecone internal PIN-15 /
PIN-6). Clears the **critical/high** Dependabot alerts that are fixable
via safe, verified **lockfile-only** transitive bumps — no manifest or
notebook changes.

## Cleared (1 critical + 10 high)

**Root `uv.lock`** (dev-extra transitives):
| pkg | from → to | alerts |
|---|---|---|
| langsmith | 0.6.6 → 0.10.2 | high ×2 |
| starlette | 1.0.0 → 1.3.1 | high ×2 |
| urllib3 | 2.6.3 → 2.7.0 | high ×2 |


**`learn/generation/langchain/langgraph/02-ollama-langgraph-agent/poetry.lock`**
(surgical `poetry update`, lock-version 2.1 preserved):
| pkg | from → to | alerts |
|---|---|---|
| **h11** | 0.14.0 → **0.16.0** | **CRITICAL** (GHSA-vqfr-h8mv-ghfj —
chunked-encoding request smuggling); freed via httpcore 1.0.9 / httpx
0.28.1 |
| tornado | 6.5.1 → 6.5.7 | high ×3 |
| orjson | 3.10.7 → 3.11.9 | high ×1 |

Compatible subtree bumps pulled in by the above: pydantic 2.8.2 →
2.11.10, ollama 0.3.1 → 0.6.2.

## Verification (local)
- `uv lock --check` — passes (root lockfile consistent).
- poetry env installs; import + construction smoke test pass

**File**: `learn/generation/langchain/langgraph/02-ollama-langgraph-agent/poetry.lock` (modified, +235/-192)
```diff
@@ -1,4 +1,4 @@
-# This file is automatically @generated by Poetry 2.2.1 and should not be changed by hand.
+# This file is automatically @generated by Poetry 2.4.1 and should not be changed by hand.
 
 [[package]]
 name = "aiohappyeyeballs"
@@ -937,62 +937,62 @@ test = ["objgraph", "psutil"]
 
 [[package]]
 name = "h11"
-version = "0.14.0"
+version = "0.16.0"
 description = "A pure-Python, bring-your-own-I/O implementation of HTTP/1.1"
 optional = false
-python-versions = ">=3.7"
+python-versions = ">=3.8"
 groups = ["main"]
 files = [
-    {file = "h11-0.14.0-py3-none-any.whl", hash = "sha256:e3fe4ac4b851c468cc8363d500db52c2ead036020723024a109d37346efaa761"},
-    {file = "h11-0.14.0.tar.gz", hash = "sha256:8f19fbbe99e72420ff35c00b27a34cb9937e902a8b810e2c88300c6f0a3b699d"},
+    {file = "h11-0.16.0-py3-none-any.whl", hash = "sha256:63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"},
+    {file = "h11-0.16.0.tar.gz", hash = "sha256:4e35b956cf45792e4caa5885e69fba00bdbc6ffafbfa020300e549b208ee5ff1"},
 ]
 
 [[package]]
 name = "httpcore"
-version = "1.0.5"
+version = "1.0.9"
 description = "A minimal low-level HTTP client."
 optional = false
 python-versions = ">=3.8"
 groups = ["main"]
 files = [
-    {file = "httpcore-1.0.5-py3-none-any.whl", hash = "sha256:421f18bac248b25d310f3cacd198d55b8e6125c107797b609ff9b7a6ba7991b5"},
-    {file = "httpcore-1.0.5.tar.gz", hash = "sha256:34a38e2f9291467ee3b44e89dd52615370e152954ba21721378a87b2960f7a61"},
+    {file = "httpcore-1.0.9-py3-none-any.whl", hash = "sha256:2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"},
+    {file = "httpcore-1.0.9.tar.gz", hash = "sha256:6e34463af53fd2ab5d807f399a9b45ea31c3dfa2276f15a2c3f00afff6e176e8"},
 ]
 
 [package.dependencies]
 certifi = "*"
-h11 = ">=0.13,<0.15"
+h11 = ">=0.16"
 
 [package.extras]
 asyncio = ["anyio (>=4.0,<5.0)"]
 http2 = ["h2 (>=3,<5)"]
 socks = ["socksio (==1.*)"]
-trio = ["trio (>=0.22.0,<0.26.0)"]
+trio = ["trio (>=0.22.0,<1.0)"]
 
 [[package]]
 name = "httpx"
-version = "0.27.0"
+version = "0.28.1"
 description = "The next generation HTTP client."
 optional = false
 python-versions = ">=3.8"
 groups = ["main"]
 files = [
-    {file = "httpx-0.27.0-py3-none-any.whl", hash = "sha256:71d5465162c13681bff01ad59b2cc68dd838ea1f10e51574bac27103f00c91a5"},
-    {file = "httpx-0.27.0.tar.gz", hash = "sha256:a0cb88a46f32dc874e04ee956e4c2764aba2aa228f650b06788ba6bda2962ab5"},
+    {file = "httpx-0.28.1-py3-none-any.whl", hash = "sha256:d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"},
+    {file = "httpx-0.28.1.tar.gz", hash = "sha256:75e98c5f16b0f35b567856f597f06ff2270a374470a5c2392242528e3e3e42fc"},
 ]
 
 [package.dependencies]
 anyio = "*"
 certifi = "*"
 httpcore = "==1.*"
 idna = "*"
-sniffio = "*"
 
 [package.extras]
 brotli = ["brotli ; platform_python_implementation == \"CPython\"", "brotlicffi ; platform_python_implementation != \"CPython\""]
 cli = ["click (==8.*)", "pygments (==2.*)", "rich (>=10,<14)"]
 http2 = ["h2 (>=3,<5)"]
 socks = ["socksio (==1.*)"]
+zstd = ["zstandard (>=0.18.0)"]
 
 [[package]]
 name = "httpx-sse"
@@ -1634,18 +1634,19 @@ files = [
 
 [[package]]
 name = "ollama"
-version = "0.3.1"
+version = "0.6.2"
 description = "The official Python client for Ollama."
 optional = false
-python-versions = "<4.0,>=3.8"
+python-versions = ">=3.8"
 groups = ["main"]
 files = [
-    {file = "ollama-0.3.1-py3-none-any.whl", hash = "sha256:db50034c73d6350349bdfba19c3f0d54a3cea73eb97b35f9d7419b2fc7206454"},
-    {file = "ollama-0.3.1.tar.gz", hash = "sha256:032572fb494a4fba200c65013fe937a65382c846b5f358d9e8918ecbc9ac44b5"},
+    {file = "ollama-0.6.2-py3-none-any.whl", hash = "sha256:3ad7daab28e5a973445c36a73882a3ef698c2ebb00e21e308652741577509f7d"},
+    {file = "ollama-0.6.2.tar.gz", hash = "sha256:936d55daa684f474364c098611c933626f8d6c7d67065c5b7ae0c477b508b07f"},
 ]
 
 [package.dependencies]
-httpx = ">=0.27.0,<0.28.0"
+httpx = ">=0.27"
+pydantic = ">=2.9"
 
 [[package]]

```

**File**: `uv.lock` (modified, +15/-9)
```diff
@@ -616,21 +616,27 @@ wheels = [
 
 [[package]]
 name = "langsmith"
-version = "0.6.6"
+version = "0.10.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
+    { name = "anyio" },
+    { name = "distro" },
     { name = "httpx" },
     { name = "orjson", marker = "platform_python_implementation != 'PyPy'" },
     { name = "packaging" },
     { name = "pydantic" },
     { name = "requests" },
     { name = "requests-toolbelt" },
+    { name = "sniffio" },
+    { name = "typing-extensions" },
     { name = "uuid-utils" },
+    { name = "websockets" },
+    { name = "xxhash" },
     { name = "zstandard" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1a/3d/04a79fb7f0e72af88e26295d3b9ab88e5204eafb723a8ed3a948f8df1f19/langsmith-0.6.6.tar.gz", hash = "sha256:64ba70e7b795cff3c498fe6f2586314da1cc855471a5e5b6a357950324af3874", size = 953566, upload-time = "2026-01-27T17:37:21.166Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/eb/8e/49a69c6793bf3fc5af62481e7e9b678fce59d1b384323d3ce87959a653e3/langsmith-0.10.2.tar.gz", hash = "sha256:9aa685383fbdec07a0df51dafc333ab0d4b6b995771172a232c3364714eb17a6", size = 4707343, upload-time = "2026-07-10T13:21:54.931Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/81/81/62c5cc980a3f5a7476792769616792e0df8ba9c8c4730195ec700a56a962/langsmith-0.6.6-py3-none-any.whl", hash = "sha256:fe655e73b198cd00d0ecd00a26046eaf1f78cd0b2f0d94d1e5591f3143c5f592", size = 308542, upload-time = "2026-01-27T17:37:19.201Z" },
+    { url = "https://files.pythonhosted.org/packages/ee/17/cc8eaf4e82e4bb22009bdde20085ff91719dce643d355fed94d523300130/langsmith-0.10.2-py3-none-any.whl", hash = "sha256:c2a3929055758ac1831582f0939fafc0973cc08432365bbad335c336338ec37c", size = 652545, upload-time = "2026-07-10T13:21:52.13Z" },
 ]
 
 [[package]]
@@ -1612,15 +1618,15 @@ wheels = [
 
 [[package]]
 name = "starlette"
-version = "1.0.0"
+version = "1.3.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/81/69/17425771797c36cded50b7fe44e850315d039f28b15901ab44839e70b593/starlette-1.0.0.tar.gz", hash = "sha256:6a4beaf1f81bb472fd19ea9b918b50dc3a77a6f2e190a12954b25e6ed5eea149", size = 2655289, upload-time = "2026-03-22T18:29:46.779Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/eb/e3/7c1dc7381d9f8ab7d854328ebfa884e62cb3f3d8549ddfd37c7814f42afa/starlette-1.3.1.tar.gz", hash = "sha256:05d0213193f2fbaae60e2ecb593b4add4262ad4e46536b54abe36f11a71724e0", size = 2703240, upload-time = "2026-06-12T09:23:11.602Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/0b/c9/584bc9651441b4ba60cc4d557d8a547b5aff901af35bda3a4ee30c819b82/starlette-1.0.0-py3-none-any.whl", hash = "sha256:d3ec55e0bb321692d275455ddfd3df75fff145d009685eb40dc91fc66b03d38b", size = 72651, upload-time = "2026-03-22T18:29:45.111Z" },
+    { url = "https://files.pythonhosted.org/packages/ec/bb/2799cc2ede3ed41131f8975621e7213dfc7ef4acbbaadfa440f32500c370/starlette-1.3.1-py3-none-any.whl", hash = "sha256:c7372aae11c3c3f26a42df7bd626cec2f47d03483d261d369516a615a53714c6", size = 73632, upload-time = "2026-06-12T09:23:10.017Z" },
 ]
 
 [[package]]
@@ -1732,11 +1738,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.6.3"
+version = "2.7.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/c7/24/5f1b3bdffd70275f6661c76461e25f024d5a38a46f04aaca912426a2b1d3/urllib3-2.6.3.tar.gz", hash = "sha256:1b62b6884944a57dbe321509ab94fd4d3b307075e0c2eae991ac71ee15ad38ed", size = 435556, upload-time = "2026-01-07T16:24:43.925Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c
```

---

### Incident Patch 3: `be4fa866` (2026-08-13)
**Commit Message**: Fix broken import and embed() retry bug in rerankers notebook (#583)

## Summary

Two fixes to `learn/generation/better-rag/00-rerankers-pinecone.ipynb`:

1. **Broken import.**
`pinecone_plugins.inference.core.client.exceptions.PineconeApiException`
no longer exists in current `pinecone[grpc]` releases (the plugin
module's `exceptions.py` is empty). The notebook fails immediately on
cell 18 with `ImportError`. Replaced with
`pinecone.exceptions.PineconeApiException`.

2. **`embed()` retry-loop bugs:**
- `passed` was never initialized — if all 5 retries failed, `if not
passed` raised `UnboundLocalError` instead of the intended
`RuntimeError`. Now initialized to `False` at the top of the function.
- The loop had no `break` after success, so every batch issued all 5 API
calls even when the first one succeeded. This compounds with embedding
rate limits and makes indexing extremely slow (I was seeing ~25s per
batch with constant 429s before this fix).
- `except PineconeApiException:` swallowed the exception, so the only
feedback was a bare `"Retrying..."`. Now prints `f"Retry {j}: {e}"` so
users can see whether it's rate limiting, auth, quota, etc.

## Test plan

- [x] Notebook imports 

**File**: `learn/generation/better-rag/00-rerankers-pinecone.ipynb` (modified, +6/-4)
```diff
@@ -517,9 +517,10 @@
       },
       "outputs": [],
       "source": [
-        "from pinecone_plugins.inference.core.client.exceptions import PineconeApiException\n",
+        "from pinecone.exceptions import PineconeApiException\n",
         "\n",
         "def embed(batch: list[str]) -> list[float]:\n",
+        "    passed = False\n",
         "    # create embeddings (exponential backoff to avoid RateLimitError)\n",
         "    for j in range(5):  # max 5 retries\n",
         "        try:\n",
@@ -532,9 +533,10 @@
         "                }\n",
         "            )\n",
         "            passed = True\n",
-        "        except PineconeApiException:\n",
+        "            break\n",
+        "        except PineconeApiException as e:\n",
+        "            print(f\"Retry {j}: {e}\")\n",
         "            time.sleep(2**j)  # wait 2^j seconds before retrying\n",
-        "            print(\"Retrying...\")\n",
         "    if not passed:\n",
         "        raise RuntimeError(\"Failed to create embeddings.\")\n",
         "    # get embeddings\n",
@@ -1946,4 +1948,4 @@
   },
   "nbformat": 4,
   "nbformat_minor": 0
-}
\ No newline at end of file
+}
```

---

### Incident Patch 4: `97f4811f` (2026-05-21)
**Commit Message**: fix: add trust_remote_code=True to load_dataset call

Required for Helsinki-NLP/tatoeba which uses a custom loading script.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>

**File**: `docs/semantic-search.py` (modified, +1/-0)
```diff
@@ -190,6 +190,7 @@ def _(load_dataset):
         "Helsinki-NLP/tatoeba",
         lang1="en",
         lang2="es",
+        trust_remote_code=True,
         split="train",
     )
     return (tatoeba,)
```

---

### Incident Patch 5: `b107555b` (2026-05-12)
**Commit Message**: chore: fix some minor issues for README.md (#492)

## Problem

fix some minor issues for README.md

## Solution

fix it

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing
functionality to not work as expected)
- [ ] This change requires a documentation update
- [ ] Infrastructure change (CI configs, etc)
- [x] Non-code change (docs, etc)
- [ ] None of the above: (explain here)

## Test Plan

Describe specific steps for validating this change.

Signed-off-by: jishudashu <979260390@qq.com>

**File**: `learn/README.md` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Paste the full URL (including the `.ipynb` extension) into the URL bar in the mo
 
 ![Import Notebook to Google Colab](./images/import-pinecone-notebook-in-google-collab.png)
 
-Next, click the the name of the Notebook you want to run in the list that appears in the middle of the modal.
+Next, click the name of the Notebook you want to run in the list that appears in the middle of the modal.
 
 If this is your first time using Google Colab, you are likely to run into one or both of the two following issues: 
 
```

**File**: `learn/experimental/grafana-monitoring/README.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ scrape_configs:
 
 Grafana is configured by default to run against the local Prometheus instance. A sample dashboard
 for monitoring all indexes in a Project is preloaded into Grafana. You can add this dashboard to your own
-Grafana instance by copying `./grafana/dashbords/pinecone.json`.
+Grafana instance by copying `./grafana/dashboards/pinecone.json`.
 
 ## Run
 
```

---

### Incident Patch 6: `fc7793f5` (2026-05-06)
**Commit Message**: fix(ci): use main as default base ref instead of master

Workflows defaulted BASE_REF/branch to 'master' but the repo's default
branch is 'main', causing every PR/push run to fail with
"fatal: couldn't find remote ref master" before any real checks ran.

**File**: `.github/workflows/lint.yaml` (modified, +4/-4)
```diff
@@ -17,14 +17,14 @@ jobs:
       - name: Fetch base branch
         run: |
           BASE_REF="${{ github.base_ref }}"
-          BASE_REF="${BASE_REF:-master}"
+          BASE_REF="${BASE_REF:-main}"
           git fetch origin ${BASE_REF}
 
       - name: Get changed files
         id: changed
         run: |
           BASE_REF="${{ github.base_ref }}"
-          BASE_REF="${BASE_REF:-master}"
+          BASE_REF="${BASE_REF:-main}"
           CHANGED=$(git diff --diff-filter=d --name-only origin/${BASE_REF}...HEAD | grep -E '\.(py|ipynb)$' || true)
           echo "files<<EOF" >> $GITHUB_OUTPUT
           echo "$CHANGED" >> $GITHUB_OUTPUT
@@ -59,14 +59,14 @@ jobs:
       - name: Fetch base branch
         run: |
           BASE_REF="${{ github.base_ref }}"
-          BASE_REF="${BASE_REF:-master}"
+          BASE_REF="${BASE_REF:-main}"
           git fetch origin ${BASE_REF}
 
       - name: Get changed notebooks
         id: changed
         run: |
           BASE_REF="${{ github.base_ref }}"
-          BASE_REF="${BASE_REF:-master}"
+          BASE_REF="${BASE_REF:-main}"
           CHANGED=$(git diff --diff-filter=d --name-only origin/${BASE_REF}...HEAD | grep -E '\.ipynb$' || true)
           echo "files<<EOF" >> $GITHUB_OUTPUT
           echo "$CHANGED" >> $GITHUB_OUTPUT
```

**File**: `.github/workflows/post-merge.yaml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: "Post Merge"
 on:
   push:
     branches:
-      - master
+      - main
 
 permissions:
   contents: read
```

**File**: `.github/workflows/test-notebooks-changed.yaml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ on:
       base_ref:
         required: false
         type: string
-        default: 'master'
+        default: 'main'
 
 jobs:
   validate-notebooks:
```

---

### Incident Patch 7: `96502ae3` (2026-02-01)
**Commit Message**: fix(learn): modernize audio-search.ipynb to Pinecone SDK v8 (#538)

## Summary
Updates `learn/search/audio/audio-search/audio-search.ipynb` to use
Pinecone SDK v8.

## Changes
- Replace `pinecone-client` with `pinecone` package in pip install
- Use getpass fallback for API key per
[.github/NOTEBOOK_REVIEW_TEMPLATE.md](.github/NOTEBOOK_REVIEW_TEMPLATE.md)
standard pattern

## Audience / use case
Developers building audio similarity search with Pinecone (e.g. finding
similar sounds, song/catalog search).

## Prerequisites
- Pinecone API key
- panns-inference, datasets, librosa for audio embedding and playback

## Linear
Closes
[SDK-170](https://linear.app/pinecone-io/issue/SDK-170/modernize-sdk-audio-searchipynb)

<!-- CURSOR_SUMMARY -->
---

> [!NOTE]
> **Low Risk**
> Low risk: changes are limited to a tutorial notebook’s dependency
install and Pinecone client initialization/key handling, with no impact
on production code paths.
> 
> **Overview**
> Updates `learn/search/audio/audio-search/audio-search.ipynb` to use
the Pinecone SDK v8 (`pinecone==8.0.0`) instead of the legacy client.
> 
> Standardizes API key handling to prefer `PINECONE_API_KEY` from the
environment with a `getpass



---

### Incident Patch 8: `927cfda6` (2026-01-29)
**Commit Message**: fix(ticketbot): use detached HEAD for PR checkout

Adds --detach flag to gh pr checkout to allow multiple worktrees
to work on the same PR without branch conflicts.

**File**: `.cursor/commands/tb-iterate-review-tickets.md` (modified, +2/-2)
```diff
@@ -42,10 +42,10 @@ Once you have a PR, proceed immediately to checkout and work on it.
 
 ## Checkout the PR Branch
 
-Run these commands to checkout the PR branch:
+Run these commands to checkout the PR branch in detached HEAD mode (allows multiple worktrees to work on the same PR):
 ```bash
 git fetch origin
-gh pr checkout <PR_NUMBER>
+gh pr checkout <PR_NUMBER> --detach
 ```
 
 **Important:** After checkout, restore ticketbot files to avoid including them in commits:
```

---

### Incident Patch 9: `e743b79f` (2026-01-29)
**Commit Message**: fix(deps): align Python version requirements to >=3.10

- Added PEP 621 [project] section for uv compatibility
- Updated requires-python to >=3.10,<3.14 (click>=8.3 requires Python 3.10+)
- Added dev dependencies in PEP 621 format
- Regenerated uv.lock with correct Python constraints

**File**: `pyproject.toml` (modified, +28/-1)
```diff
@@ -1,3 +1,30 @@
+[project]
+name = "examples"
+version = "0.1.0"
+description = "Example notebooks and documentation for Pinecone"
+readme = "README.md"
+requires-python = ">=3.10,<3.14"
+
+[project.optional-dependencies]
+dev = [
+    "nbformat>=5.10.4",
+    "langchain>=0.3.21",
+    "pinecone>=6.0.2",
+    "python-dotenv>=1.0.1",
+    "tiktoken>=0.9.0",
+    "openai>=1.68.0",
+    "pychalk>=2.0.1",
+    "pre-commit>=4.0",
+    "ruff>=0.9",
+    "click>=8.3",
+]
+
+[tool.uv]
+package = false
+
+[tool.setuptools]
+packages = []
+
 [tool.poetry]
 name = "examples"
 authors = [
@@ -11,7 +38,7 @@ description = "Add your description here"
 readme = "README.md"
 
 [tool.poetry.dependencies]
-python = ">=3.9,<3.14"
+python = ">=3.10,<3.14"
 
 [tool.poetry.group.dev.dependencies]
 nbformat = "^5.10.4"
```

---

### Incident Patch 10: `70976e2a` (2026-01-29)
**Commit Message**: fix(deps): remove conflicting click version constraints

Removed duplicate [dependency-groups] section added by uv and
aligned poetry constraint to ^8.3 to match installed version.

**File**: `pyproject.toml` (modified, +1/-6)
```diff
@@ -23,7 +23,7 @@ openai = "^1.68.0"
 pychalk = "^2.0.1"
 pre-commit = "^4.0"
 ruff = "^0.9"
-click = "^8.1"
+click = "^8.3"
 
 [tool.ruff]
 extend-include = ["*.ipynb"]
@@ -36,8 +36,3 @@ ignore = ["E501"]
 [tool.ruff.format]
 docstring-code-format = true
 
-[dependency-groups]
-dev = [
-    "click>=8.3.1",
-]
-
```

#### Recent Merged Pull Requests:
- **PR #618** (2026-09-04): Fix stale Parquet references and drop intro flow diagram (@jennapederson)
- **PR #617** (2026-09-03): chore: bump google-genai to 2.12.1 in full-text-search notebook (@jennapederson)
- **PR #615** (2026-09-03): Bulk import sdk update (@jennapederson)
- **PR #614** (2026-09-03): Pinecone sdk 10.0.0 migration (@jennapederson)
- **PR #610** (2026-08-14): chore: add CODEOWNERS (@jhamon)
- **PR #605** (2026-08-13): security: remediate critical/high Dependabot alerts (lockfile bumps) (@jhamon)
- **PR #604** (closed): ci: add least-privilege workflow permissions (CodeQL) (@jhamon)
- **PR #603** (2026-08-13): ci: add least-privilege workflow permissions (CodeQL) (@jhamon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
