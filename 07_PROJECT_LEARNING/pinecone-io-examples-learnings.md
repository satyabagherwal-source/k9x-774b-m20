# Forensic Learning Record (Deep Inspection): pinecone-io/examples

> **Canonical Artifact**: `07_PROJECT_LEARNING/pinecone-io-examples-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pinecone-io/examples](https://github.com/pinecone-io/examples))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:21:03.204Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pinecone-io/examples`
- **Description**: Jupyter Notebooks to help you get hands-on with Pinecone vector databases
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3048 stars

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

### Core Architecture Module: `learn/search/semantic-search/jeopardy/helper.py`
```
import os
import getpass
import itertools 

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
JEOPARDY_STANDARD_AMOUNTS = [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000]
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


def is_index_nonempty(index):
    """Return a boolean that corresponds with whether the index has 
    been used.
    """
    return bool(index.describe_index_stats()['namespaces'])


def get_processed_df(df):
    """Return processed dataframe ready for usage."""
    # rename columns to conventional lowercase naming with no space
    df = df.rename(columns={'value': 'amount'})
    # remove the rows with no amount or nonstandard amount 
    df = df.drop(df.index[~df.amount.isin(JEOPARDY_STANDARD_AMOUNTS)])
    # parse air date
    df.air_date = df.air_date.apply(pd.to_datetime)
    df['year'] = df.air_date.dt.strftime('%Y')
    df['month'] = df.air_date.dt.strftime('%m')
    # prepare text to encode
    df['text_to_encode'] = df.question + ' ' + df.answer
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


def get_ids(response):
    """Return ids from results."""
    matches = response['matches']
    return [match['id'] for match in matches]


def get_query_results_from_api_response(dataframe, response, query):
    """Return pandas.DataFrame containing query_results with original text."""
    response_df = dataframe.loc[get_ids(response), ['question', 'answer', 'amount']]
    response_df['query'] = query
    return response_df


def get_query_results_from_query(query, pinecone_index, dataframe, model, top_k=1, filter_criteria=None):
    """Return a dataframe of results from a Pinecone query."""
    embedding = model.encode(query).tolist()
    response = pinecone_index.query(
        vector=embedding,
        top_k=top_k,
        filter=filter_criteria,
        include_metadata=True,
    )
    return get_query_results_from_api_response(dataframe, response, query)


def get_jeopardy_questions(queries, pinecone_index, dataframe, model):
    """Return the questions to be used by making API requests to Pinecone."""
    df_list = []
    get_single_result = lambda query, amount: get_query_results_from_query(
        query,
        pinecone_index,
        dataframe,
        model,
        filter_criteria={'amount': {'$eq': amount}}
    )
    for qry, amt in itertools.product(queries, JEOPARDY_STANDARD_AMOUNTS):
        results = get_single_result(qry, amt)
        df_list.append(results)
    return pd.concat(df_list)


def get_jeopardy_boards(jeopardy_questions, queries):
    """Return Jeopardy! and Double Jeopardy! boards according to various topics.
    
    Each category will have representation from each historical difficulty level. 
    
    This capability is only made possible by Pinecone's metadata filtering feature.
    """
    
    # get one result per amount in [$200, $400, .. , $2000]
    
    # wrangle data and display 3-category jeopardy board
    
    jeopardy_board = pd.DataFrame(
        columns=queries, 
        index=JEOPARDY_STANDARD_AMOUNTS)
    grouper = jeopardy_questions.groupby(['query', 'amount'])['question']
    for (query, amount), question_series in grouper:
        jeopardy_board.loc[amount, query] = question_series[0]

    jeopardy_board.index.name = 'amount'
    jeopardy_round_1_filter = jeopardy_board.index <= 1000
    jeopardy_board_first_round = jeopardy_board[jeopardy_round_1_filter]
    jeopardy_board_second_round = jeopardy_board[~jeopardy_round_1_filter]
    
    return jeopardy_board_first_round, jeopardy_board_second_round


def show_answer_widget(jeopardy_questions, queries):
    """Display answer widget in Jupyter Notebook."""
    from ipywidgets import Dropdown, widgets
    from IPython.display import clear_output

    def handle_change(c):
        pass

    def on_button_clicked(b):
        query, amount = dropdown_query.value, dropdown_amount.value
        row_idx_cond = (jeopardy_questions['query'] == query) & (jeopardy_questions['amount'] == amount)
        with output:
            clear_output()
            print(jeopardy_questions.loc[row_idx_cond].iloc[0], flush=True)

    dropdown_query = Dropdown(
        description="query:", 
        options=queries)
    dropdown_amount = Dropdown(
        description="amount:", 
        options=JEOPARDY_STANDARD_AMOUNTS)
    dropdown_query.observe(handle_change, names="value")
    dropdown_amount.observe(handle_change, names="value")
    button = widgets.Button(description='Submit')
    button.on_click(on_button_clicked)
    output = widgets.Output()
    return display(dropdown_query, dropdown_amount, button, output)


def run_on_module_import():
    sns.set_palette(PINECONE_PALETTE)
    set_pinecone_api_key()
    pd.set_option('display.max_colwidth', 2000)


run_on_module_import()


```

### Core Architecture Module: `learn/search/semantic-search/yt-search/app.py`
```
import streamlit as st
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

@st.experimental_singleton
def init_pinecone():
    pinecone.init(api_key="<<YOUR_API_KEY>>", environment="us-west1-gcp")
    return pinecone.Index('youtube-search')
    
@st.experimental_singleton
def init_retriever():
    return SentenceTransformer('flax-sentence-embeddings/all_datasets_v3_mpnet-base')

index = init_pinecone()
retriever = init_retriever()

def card(thubmnail, title, url, context):
    return st.markdown(f"""
    <div class="container-fluid">
        <div class="row align-items-start">
            <div class="col-md-4 col-sm-4">
                 <div class="position-relative">
                     <a href={url}><img src={thubmnail} class="img-fluid" style="width: 192px; height: 106px"></a>
                 </div>
             </div>
             <div  class="col-md-8 col-sm-8">
                 <a href={url}>{title}</a>
                 <br>
                 <span style="color: #808080;">
                     <small>{context[:200].capitalize()+"...."}</small>
                 </span>
             </div>
        </div>
     </div>
        """, unsafe_allow_html=True)

    
st.write("""
# YouTube Q&A
Ask me a question!
""")

st.markdown("""
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.0.0/dist/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
""", unsafe_allow_html=True)

query = st.text_input("Search!", "")

if query != "":
    xq = retriever.encode([query]).tolist()
    xc = index.query(vector=xq, top_k=5, include_metadata=True)
    
    for context in xc['results'][0]['matches']:
        card(
            context['metadata']['thumbnail'],
            context['metadata']['title'],
            context['metadata']['url'],
            context['metadata']['text']
        )
```

### Core Architecture Module: `scripts/shields-checker.py`
```
import click
import logging
from pathlib import Path
import re

colab_link = re.compile(r"(?<=\[!\[Open In Colab\]\(https:\/\/colab\.research\.google\.com\/assets\/colab-badge\.svg\)]\()[\w:\/.-]+(?=\))")
nbviewer_link = re.compile(r"(?<=\[!\[Open nbviewer\]\(https:\/\/raw\.githubusercontent\.com\/pinecone-io\/examples\/master\/assets\/nbviewer-shield\.svg\)]\()[\w:\/.-]+(?=\))")


def link_valid(current_url: str, path: str, version: str) -> bool:
    # generate correct link
    if version == "colab":
        url = f"https://colab.research.google.com/github/pinecone-io/examples/blob/master/{path}"
    elif version == "nbviewer":
        url = f"https://nbviewer.org/github/pinecone-io/examples/blob/master/{path}"
    else:
        raise ValueError("version must be one of colab or nbviewer")
    # check if link is correct
    return current_url == url, url

def link_update(current_url: str, path: str, version: str) -> dict:
    # check link validity
    valid, url = link_valid(current_url, path, version)
    if not valid:
        # if link is not correct, update it
        with open(path, "r") as f:
            content = f.read()
        content = content.replace(current_url, url)
        with open(path, "w") as f:
            f.write(content)
    return {
        "updated": not valid,
        "past_url": current_url,
        "new_url": url
    }

def handle_no_shield(path: str, version: str, shield_error: bool) -> None:
    if shield_error:
        raise ValueError(f"No {version} shield found in {path}")
    else:
        logging.warning(f"No {version} shield found in {path}")


@click.group(help="Shields CLI")
def cli():
    pass


@click.command(help="Check if shields are up to date.")
@click.option("--update", default=False, help="Automatically update shield links.")
@click.option("--path", default=".", help="Path to check for shields.")
@click.option("--shield-error", default=False, help="Raise error if no shield is found.")
def run(update, path, shield_error):
    logging.basicConfig(level=logging.INFO)
    # get all notebook paths
    paths = [str(x) for x in Path(path).glob("**/*.ipynb")]
    logging.info(f"Found {len(paths)} notebooks")
    # check each notebook for shields
    for path in paths:
        with open(path, "r") as f:
            content = f.read()
        # try to find shields
        colab_url = colab_link.search(content)
        if colab_url:
            # if link exists, check it and update if incorrect
            colab_url = colab_url.group(0)
            if update:
                info = link_update(colab_url, path, "colab")
                if info["updated"]:
                    logging.info(f"Updated: {path}")
                else:
                    pass
            else:
                valid = link_valid(colab_url, path, "colab")
                if valid:
                    pass
                else:
                    logging.warning(f"Failed: {path}")
        else:
            handle_no_shield(path, "colab", shield_error)
        # now check nbviewer link
        nbviewer_url = nbviewer_link.search(content)
        if nbviewer_url:
            nbviewer_url = nbviewer_url.group(0)
            if update:
                info = link_update(nbviewer_url, path, "nbviewer")
                if info["updated"]:
                    logging.info(f"Updated: {path}")
                else:
                    pass
            else:
                valid = link_valid(nbviewer_url, path, "nbviewer")
                if valid:
                    pass
                else:
                    logging.warning(f"Failed: {path}")
        else:
            handle_no_shield(path, "nbviewer", shield_error)


cli.add_command(run)

if __name__ == "__main__":
    cli()

```

### Core Architecture Module: `scripts/ticketbot.py`
```
#!/usr/bin/env python3
"""
Ticketbot - Automated ticket processing with independent worker pools.

This script manages ticket lifecycle automation by spawning Cursor agents
to handle different stages: picking new work, iterating on PRs, and merging.
"""

import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import click

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Global flag for graceful shutdown
_draining = False


def _handle_drain_signal(signum, frame):
    """Handle SIGTERM by setting drain flag."""
    global _draining
    _draining = True
    logger.info("Received shutdown signal, will exit after current iteration completes...")

WORKSPACE = Path(os.environ.get("TICKETBOT_WORKSPACE", os.getcwd()))
WORKTREE_DIR = WORKSPACE.parent / f"{WORKSPACE.name}-worktrees"
LOG_DIR = WORKSPACE.parent / f"{WORKSPACE.name}-logs"


def get_worktree(job: str, worker_index: int) -> Path:
    """Get or create a worktree for this worker."""
    worktree_path = WORKTREE_DIR / f"{job}-{worker_index}"

    if not worktree_path.exists():
        WORKTREE_DIR.mkdir(exist_ok=True)
        # Use --detach to avoid conflicts with branches checked out elsewhere
        # The Cursor commands will handle checking out the appropriate branch
        subprocess.run(
            ["git", "worktree", "add", "--detach", str(worktree_path), "HEAD"],
            cwd=WORKSPACE,
            check=True,
        )
        logger.info(f"Created worktree: {worktree_path}")

    return worktree_path


MAX_RETRIES = 3
INITIAL_BACKOFF = 10  # seconds


def invoke_cursor(prompt: str, worktree: Path, worker_id: str) -> subprocess.CompletedProcess:
    """Invoke Cursor CLI with the given prompt in the specified worktree.
    
    Retries with exponential backoff on transient failures.
    """
    logger.info(f"[{worker_id}] Invoking Cursor in {worktree}")
    
    # Ensure log directory exists
    LOG_DIR.mkdir(exist_ok=True)
    
    last_error = None
    
    for attempt in range(MAX_RETRIES):
        # Create timestamped log file for this run
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        log_file = LOG_DIR / f"{worker_id}-{timestamp}.log"
        
        result = subprocess.run(
            [
                "agent",
                "--print",
                "--force",
                "--approve-mcps",
                "--workspace", str(worktree),
                prompt,
            ],
            capture_output=True,
            text=True,
        )
        
        # Write output to log file
        with open(log_file, "w") as f:
            f.write(f"=== Ticketbot Agent Log ===\n")
            f.write(f"Worker: {worker_id}\n")
            f.write(f"Timestamp: {timestamp}\n")
            f.write(f"Attempt: {attempt + 1}/{MAX_RETRIES}\n")
            f.write(f"Worktree: {worktree}\n")
            f.write(f"Prompt: {prompt}\n")
            f.write(f"Exit Code: {result.returncode}\n")
            f.write(f"\n=== STDOUT ===\n")
            f.write(result.stdout or "(empty)")
            f.write(f"\n\n=== STDERR ===\n")
            f.write(result.stderr or "(empty)")
        
        logger.info(f"[{worker_id}] Agent output logged to: {log_file}")
        
        # Success
        if result.returncode == 0:
            return result
        
        # Check for transient errors that should be retried
        stderr_lower = (result.stderr or "").lower()
        is_transient = any(err in stderr_lower for err in [
            "connection stalled",
            "connection reset",
            "connection refused",
            "timeout",
            "rate limit",
            "503",
            "502",
            "504",
        ])
        
        if not is_transient:
            # Non-transient error, don't retry
            raise subprocess.CalledProcessError(
                result.returncode, result.args, result.stdout, result.stderr
            )
        
        # Transient error, retry with backoff
        last_error = subprocess.CalledProcessError(
            result.returncode, result.args, result.stdout, result.stderr
        )
        
        if attempt < MAX_RETRIES - 1:
            backoff = INITIAL_BACKOFF * (2 ** attempt)
            logger.warning(
                f"[{worker_id}] Transient error (attempt {attempt + 1}/{MAX_RETRIES}), "
                f"retrying in {backoff}s: {result.stderr[:100] if result.stderr else 'unknown error'}"
            )
            time.sleep(backoff)
    
    # All retries exhausted
    logger.error(f"[{worker_id}] All {MAX_RETRIES} attempts failed")
    raise last_error


def pick_work(worker_index: int) -> None:
    """Pick up new work from the backlog."""
    worker_id = f"tb-pick-work-{worker_index}"
    logger.info(f"[{worker_id}] Starting pick_work iteration")

    worktree = get_worktree("tb-pick-work", worker_index)
    prompt = "Run /tb-pick-next-ticket"

    try:
        invoke_cursor(prompt, worktree, worker_id)
        logger.info(f"[{worker_id}] Completed pick_work iteration")
    except subprocess.CalledProcessError as e:
        logger.error(f"[{worker_id}] Cursor failed: {e.stderr}")
        raise


def iterate_prs(worker_index: int, total_workers: int) -> None:
    """Iterate on PRs in review, filtered by shard."""
    worker_id = f"tb-iterate-prs-{worker_index}"
    logger.info(f"[{worker_id}] Starting iterate_prs iteration (shard {worker_index}/{total_workers})")

    worktree = get_worktree("tb-iterate-prs", worker_index)
    prompt = f"""Run /tb-iterate-review-tickets
Worker shard: {worker_index} of {total_workers}
Only process tickets where (ticket_number % {total_workers}) == {worker_index}"""

    try:
        invoke_cursor(prompt, worktree, worker_id)
        logger.info(f"[{worker_id}] Completed iterate_prs iteration")
    except subprocess.CalledProcessError as e:
        logger.error(f"[{worker_id}] Cursor failed: {e.stderr}")
        raise


def cleanup_orphaned() -> None:
    """Find orphaned In Progress tickets and move them back to Backlog."""
    worker_id = "tb-cleanup-orphaned"
    logger.info(f"[{worker_id}] Starting cleanup of orphaned tickets")

    worktree = get_worktree("tb-cleanup", 0)
    prompt = "Run /tb-cleanup-orphaned"

    try:
        invoke_cursor(prompt, worktree, worker_id)
        logger.info(f"[{worker_id}] Completed cleanup")
    except subprocess.CalledProcessError as e:
        logger.error(f"[{worker_id}] Cursor failed: {e.stderr}")
        raise


def spawn_worker(
    job: str,
    interval: int,
    worker_index: int = 0,
    total_workers: int = 1,
) -> subprocess.Popen:
    """Spawn a worker subprocess for the given job type."""
    cmd = [
        sys.executable,
        __file__,
        "run",
        "--job", job,
        "--interval", str(interval),
        "--worker-index", str(worker_index),
        "--total-workers", str(total_workers),
    ]
    logger.info(f"Spawning worker: {' '.join(cmd)}")
    return subprocess.Popen(cmd)


@click.group()
def cli():
    """Ticketbot - Automated ticket processing with independent worker pools."""
    pass


@cli.command()
@click.option("--pick-workers", default=3, help="Number of pick-work workers")
@click.option("--iterate-workers", default=3, help="Number of iterate-prs workers")
@click.option("--interval", default=45, help="Seconds between job iterations")
@click.option("--stagger", default=30, help="Seconds between worker starts within a pool")
def start_all(
    pick_workers: int,
    iterate_workers: int,
    interval: int,
    stagger: int,
):
    """Start all worker pools."""
    processes = []

    # Spawn pick workers
    for i in range(pick_workers):
        if i > 0:
            time.sleep(stagger)
        processes.append(spawn_worker("tb-pick-work", interval, worker_index=i))

    # Spawn iterate workers (sharded by index)
    # These also handle merging when PR is ready
    for i in range(iterate_workers):
        if i > 0:
            time.sleep(stagger)
        processes.append(
            spawn_worker(
                "tb-iterate-prs",
                interval,
                worker_index=i,
                total_workers=iterate_workers,
            )
        )

    logger.info(f"Started {len(processes)} workers. Press Ctrl+C to drain and stop.")

    try:
        # Wait for all processes (they run forever, so this blocks until interrupt)
        for p in processes:
            p.wait()
    except KeyboardInterrupt:
        logger.info("Draining workers (waiting for current iterations to complete)...")
        
        # Send SIGTERM to all workers to trigger drain mode
        for p in processes:
            if p.poll() is None:  # Still running
                p.send_signal(signal.SIGTERM)
        
        # Wait for workers to finish gracefully (with timeout)
        drain_timeout = 600  # 10 minutes max wait
        start_time = time.time()
        
        while any(p.poll() is None for p in processes):
            elapsed = time.time() - start_time
            if elapsed > drain_timeout:
                logger.warning(f"Drain timeout ({drain_timeout}s) exceeded, force killing...")
                for p in processes:
                    if p.poll() is None:
                        p.kill()
                break
            
            remaining = sum(1 for p in processes if p.poll() is None)
            logger.info(f"Waiting for {remaining} workers to finish (elapsed: {int(elapsed)}s)...")
            time.sleep(5)
        
        logger.info("All workers stopped.")


@cli.command()
@click.option(
    "--job",
    type=click.Choice(["tb-pick-work", "tb-iterate-prs"]),
    required=True,
    help="Job type to run",
)
@click.option("--interval", default=45, help="Seconds between iterations")
@click.option("--worker-index", default=0, help="This worke
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
-    "![Pinecone101_flow.png](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZEAAALtCAYAAADpKVlwAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAABkaADAAQAAAABAAAC7QAAAAAbQfJfAABAAElEQVR4AeydB3xUVdrGn/TeE0JJKCEQaujSEZQiKuiuhV17X+uurrriun6Ku2td17L23jv2giAigvReEkogCSQhkN578p1zwoSUSTKZzNyZufc5/sjccs553/f/jve555w7M24NooCFBEiABEiABKwg4G5FGzYhARIgARIgAUWAIsI3AgmQAAmQgNUEKCJWo2NDEiABEiABigjfAyRAAiRAAlYToIhYjY4NSYAESIAEKCJ8D5AACZAACVhNgCJiNTo2JAESIAESoIjwPUACJEACJGA1AYqI1ejYkARIgARIgCLC9wAJkAAJkIDVBCgiVqNjQxIgARIgAYoI3wMkQAIkQAJWE6CIWI2ODUmABEiABCgifA+QAAmQAAlYTYAiYjU6NiQBEiABEqCI8D1AAiRAAiRgNQGKiNXo2JAESIAESIAiwvcACZAACZCA1QQoIlajY0MSIAESIAGKCN8DJEACJEACVhOgiFiNjg1JgARIgAQoInwPkAAJkAAJWE2AImI1OjYkARIgARKgiPA9QAIkQAIkYDUBiojV6NiQBEiABEiAIsL3AAmQAAmQgNUEKCJWo2NDEiABEiABigjfAyRAAiRAAlYToIhYjY4NSYAESIAEKCJ8D5AACZAACVhNgCJiNTo2JAESIAESoIjwPUACJEACJGA1AYqI1ejYkARIgARIgCLC9wAJkAAJkIDVBCgiVqNjQxIgARIgAYoI3wMkQAIkQAJWE6CIWI2ODUmABEiABCgifA+QAAmQAAlYTYAiYjU6NiQBEiABEqCI8D1AAiRAAiRgNQGKiNXo2JAESIAESIAiwvcACZAACZCA1QQoIlajY0MSIAESIAGKCN8DJEACJEACVhOgiFiNjg1JgARIgAQoInwPkAAJkAAJWE2AImI1OjYkARIgARKgiPA9QAIkQAIkYDUBiojV6NiQBEiABEiAIsL3AAmQAAmQgNUEKCJWo2NDEiABEiABigjfAyRAAiRAAlYToIhYjY4NSYAESIAEKCJ8D5AACZAACVhNwNPqlmxIAiRgMYEfN++3uC4rujaBeRMSXDuALnpPEekiMFYnAWsIvP7DFmxMO25NU7ZxIQI9g/1AEXGhhNFVEnAlAglx/XDa+PGu5DJ97QKBvUnJyDqS2oUW+qjKkYg+8sgoXISAv7+fi3hKN0nAMgJcWLeME2uRAAmQAAmYIUARMQOFh0iABEiABCwjQBGxjBNrkQAJkAAJmCFAETEDhYdIgARIgAQsI0ARsYwTa5EACZAACZghQBExA4WHSIAESIAELCNAEbGME2uRAAmQAAmYIUARMQOFh0iABEiABCwjQBGxjBNrkQAJkAAJmCFAETEDhYdIgARIgAQsI0ARsYwTa5EACZAACZghQBExA4WHSIAESIAELCPAL2C0jBNrkYDTEyg+fgTH9m5EWU42IuNHoOeQ8fAOCHJ6v805mH9kPzJ3rQNq6+AbFiniGYmwPgPNVeUxBxPgSMTBCaB5ErAFgSPbV+Onx25EUcYhBERGI2XV5zi4+gtbdN2tPrZ88CSOH9je5T6Ks9KRtu57uHt74/Car7DqyduQ8kvn8aStX4b9Kz/usj02sJ4ARyLWs2NLEnAKAlUlBdjy7mMYfs5VSDjzYuWTfG2or2vyr6GhAQVpyaiurkBU3Eh4eHmrc4VCdIKieqNAvMoSOWA44O6mtttrk3d4LwJ69EHJsSOob6hD9OAxKMnJEvtp8A0KRVj/oXBzcxPHMnFszwYE9ewLd3dP9Bg4Ag3ieG11JfJTk+Dh44+IvuJXAE/aU0ab/QmI6oPhZ1+BYfMvR/rGFdj2ydNidDUOgaI/c/aqSouQJUZiXj5+yEnZjdA+cfD09UdhRgpK87LVfpDok8W2BCgituXJ3khAcwLygilLzJjTW9h2c/dQ+/X19dj09sPIObgToeKivfntRzFm0e2IGTUVu755DRXiAhvUs7+62Ab3HoBpNzyEjtqsfu5uBIRHwzc0Ej2HjkdgjxiseOQ6hPYeiLL8bCUiso+CIwdQU1mG48lbUJJ9BBFxw1EtBG/1s3fC3dNLiUhlUR6m3/QwgqJjW/jefEcKUszoaUpEcoUQuvn6mbVXXnBC2ElTfadvWg6/2YvUKEjGLm1L8Ru54FoMmnVB8+653U0CFJFuAmRzEnA0gbL8Y0IE+qkLu/SlrDAHmdt+UW71n3gWsg9sUwIy/8F34entiyyx1rBv+YdKRGSlAVPOxuAzLkLJ8QyseOwGVJeXInv/1g7b9B4xFSPPv07ZkH/mP/AO/EIiUZp7DMsfvhaVxfnoO24W9nzzBoaIi3mPhLGqbrKwGxo7GJOuWKxGJbu+fAXpm1ZixIKr1Pn2/sgRhRSpyuI8BIRGmbUXFjsIPYadBh+/QDV6kX35R/TEOQ99pNaGju74Fft/fJ8i0h5kK49TRKwEx2Yk4CwEPMW0UEl2OurrauHuIf6XFiOPqpJCtSbSa+RUFKbvVyOC5Q9fr1yuE9NJcoQgxUIWn6Aw9RogprVkKSs43mmb6GETVF35x01MlWXsWIujm1eqkYg8Vpx9FL7B4XKzRTmxb4uocxzfLUlSx6UoSHFAJyJSU1WOwqxDGDh9QZfs1ddU48Cqz3B06yqY4pZ9eQlmLLYhQBGxDUf2QgIOIxAU3VfZzktNRpR4iklONQ0WayKmhXU3MXUU3m8oZtz2RAsf3d1bPlfTfL+zNh5iwdtUjsqRjbjDn3X7U2pq6/sHL0cD6k2nhaadWptxFyOhoXMvRcLcPzadt2SjIG2fqian2zqz1yBE1FT2/PCuELQ0zL77edRUVeDHf10tRMh0lq+2INDyXWSLHtkHCZCApgR6DExUU0Q7Pn8BeeJiK6eSMneubfIhevBY5Kcn4/jeDaivrRaLzjvFKKSo6by5ja60qSzKRUhsvHgqrBeOJW1SU07VJY39y2k2uWZTJ0Y
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
 name = "openai"
@@ -1674,70 +1675,87 @@ datalib = ["numpy (>=1)", "pandas (>=1.2.3)", "pandas-stubs (>=1.1.0.11)"]
 
 [[package]]
 name = "orjson"
-version = "3.10.7"
+version = "3.11.9"
 description = "Fast, correct Python JSON library supporting dataclasses, datetimes, and numpy"
 optional = false
-python-versions = ">=3.8"
+python-versions = ">=3.10"
 groups = ["main"]
 markers = "platform_python_implementation != \"PyPy\""
 files = [
-    {file = "orjson-3.10.7-cp310-cp310-macosx_10_15_x86_64.macosx_11_0_arm64.macosx_10_15_universal2.whl", hash = "sha256:74f4544f5a6405b90da8ea724d15ac9c36da4d72a738c64685003337401f5c12"},
-    {file = "orjson-3.10.7-cp310-cp310-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:34a566f22c28222b08875b18b0dfbf8a947e69df21a9ed5c51a6bf91cfb944ac"},
-    {file = "orjson-3.10.7-cp310-cp310-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:bf6ba8ebc8ef5792e2337fb0419f8009729335bb400ece005606336b7fd7bab7"},
-    {file = "orjson
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
+sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/39/08/aaaad47bc4e9dc8c725e68f9d04865dbcb2052843ff09c97b08904852d84/urllib3-2.6.3-py3-none-any.whl", hash = "sha256:bf272323e553dfb2e87d9bfd225ca7b0f467b919d7bbd355436d3fd37cb0acd4", size = 131584, upload-time = "2026-01-07T16:24:42.685Z" },
+    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
 ]
 
 [[package]]
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

### Incident Patch 4: `fce762d5` (2026-07-09)
**Commit Message**: docs: bump semantic-search + pinecone-quickstart to pinecone 9.1.0 (#600)

## Why

Continues moving `docs/` off the pre-9.x client (urllib3, no default
data-plane timeout). 9.x (httpx) applies a 30s default with retries.
Both notebooks were `pinecone==8.0.0`.

## Changes

- Pin bump → `pinecone==9.1.0`; pin `pinecone-notebooks==0.1.1` (was
unpinned in pinecone-quickstart).
- **9.x search-hit fix:** `hit['_id']`/`hit['_score']` →
`hit['id']`/`hit['score']` (and `result['_score']`). 9.x renames the
`Hit` wire fields; only the bracket **reads** change — the 50 `"_id":`
**upsert record keys** in pinecone-quickstart are left as-is (the
records API still expects `_id`).
- Consolidate imports into the first (pip) cell (`check-structure`),
normalized via the repo pre-commit pipeline (`ruff` + `nbstripout`).

`SearchQuery`/`SearchRerank`/`Pinecone` and the integrated
`search`/`upsert_records` surface verified present on 9.1.0.

## Verification

All six lint gates pass locally; live `test-notebooks` validates the
runtime on this PR — please confirm green before merge.

## Context

Follows #598 (lexical-search) and #599 (quick-tour). The `_id`/`_score`
break is systemic across integrated-sear

**File**: `docs/pinecone-quickstart.ipynb` (modified, +30/-82)
```diff
@@ -28,15 +28,18 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 1,
+   "execution_count": null,
    "metadata": {
     "id": "4SudLike98WL"
    },
    "outputs": [],
    "source": [
-    "!pip install -qU \\\n",
-    "    pinecone==8.0.0 \\\n",
-    "    pinecone-notebooks"
+    "!pip install -qU pinecone==9.1.0 pinecone-notebooks==0.1.1\n",
+    "\n",
+    "import os\n",
+    "import time\n",
+    "\n",
+    "from pinecone import Pinecone"
    ]
   },
   {
@@ -54,7 +57,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 2,
+   "execution_count": null,
    "metadata": {
     "colab": {
      "base_uri": "https://localhost:8080/",
@@ -65,8 +68,6 @@
    },
    "outputs": [],
    "source": [
-    "import os\n",
-    "\n",
     "if not os.environ.get(\"PINECONE_API_KEY\"):\n",
     "    from pinecone_notebooks.colab import Authenticate\n",
     "\n",
@@ -93,11 +94,14 @@
    "outputs": [],
    "source": [
     "# Import the Pinecone library\n",
-    "from pinecone import Pinecone\n",
     "\n",
     "# Initialize a Pinecone client with your API key\n",
     "api_key = os.environ.get(\"PINECONE_API_KEY\")\n",
-    "pc = Pinecone(api_key=api_key)"
+    "pc = Pinecone(\n",
+    "    # You can remove this for your own projects!\n",
+    "    api_key=api_key,\n",
+    "    source_tag=\"pinecone_examples:docs:pinecone_quickstart\",\n",
+    ")" 
    ]
   },
   {
@@ -117,7 +121,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 4,
+   "execution_count": null,
    "metadata": {
     "id": "FMyeNo6Afh4z"
    },
@@ -151,7 +155,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 12,
+   "execution_count": null,
    "metadata": {
     "id": "ZIclo2UK3NFE"
    },
@@ -186,7 +190,7 @@
     "    },\n",
     "    {\n",
     "        \"_id\": \"rec6\",\n",
-    "        \"chunk_text\": \"Water boils at 100\u00b0C under standard atmospheric pressure.\",\n",
+    "        \"chunk_text\": \"Water boils at 100°C under standard atmospheric pressure.\",\n",
     "        \"category\": \"physics\",\n",
     "    },\n",
     "    {\n",
@@ -206,7 +210,7 @@
     "    },\n",
     "    {\n",
     "        \"_id\": \"rec10\",\n",
-    "        \"chunk_text\": \"Newton\u2019s laws describe the motion of objects.\",\n",
+    "        \"chunk_text\": \"Newton’s laws describe the motion of objects.\",\n",
     "        \"category\": \"physics\",\n",
     "    },\n",
     "    {\n",
@@ -425,7 +429,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 13,
+   "execution_count": null,
    "metadata": {
     "id": "WqDOcyz5gp1Z"
    },
@@ -451,30 +455,12 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 14,
+   "execution_count": null,
    "metadata": {
     "id": "z3B4RkEqg1US"
    },
-   "outputs": [
-    {
-     "data": {
-      "text/plain": [
-       "{'dimension': 1024,\n",
-       " 'index_fullness': 0.0,\n",
-       " 'metric': 'cosine',\n",
-       " 'namespaces': {'example-namespace': {'vector_count': 50}},\n",
-       " 'total_vector_count': 50,\n",
-       " 'vector_type': 'dense'}"
-      ]
-     },
-     "output_type": "execute_result",
-     "metadata": {},
-     "execution_count": 14
-    }
-   ],
+   "outputs": [],
    "source": [
-    "import time\n",
-    "\n",
     "# Wait for the upserted vectors to be indexed\n",
     "time.sleep(10)\n",
     "\n",
@@ -498,7 +484,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 15,
+   "execution_count": null,
    "metadata": {
     "id": "Buo2K1h8O_fN"
    },
@@ -507,41 +493,22 @@
     "def print_results(search_results):\n",
     "    for hit in search_results[\"result\"][\"hits\"]:\n",
     "        print(\n",
-    "            f\"id: {hit['_id']:<5} | score: {round(hit['_score'], 3):<5} | category: {hit['fields']['category']:<10} | text: {hit['fields']['chunk_text']:<50}\"\n",
+    "            f\"id: {hit['id']:<5} | score: {round(hit['score'], 3):<5} | category: {hit['fields']['category']:<10} | text: {hit['fields']['chunk_text']:<50}\"\n",
     "        )"
    ]
   },
   {
    "cell_type": "code",
-   "execution_count": 16,
+   "execution_count": null,
    "metadata": {},
-   "outputs": [
-    {
-     "output_type": "stream",
-     "text": [
-      "id: rec17 | score: 0.252 | category: history    | text: The Pyramids of Giza are among the Seven Wonders of the Ancient World.\n",
-      "id: rec5  | score: 0.186 | category: literature | text: Shakespeare wrote many famous plays, including Hamlet and Macbeth.\n",
-      "id: rec38 | score: 0.186 | category: history    | text: The Taj Mahal is a mausoleum built by Emperor Shah Jahan.\n",
-      "id: rec50 | score: 0.098 | category: energy     | text: Renewable energy sources include wind, solar, and hydroelectric power.\n",
-      "id: rec15 | score: 0.096 | category: art        | text: Leonardo da Vinci painted the Mona Lisa.          \n",
-      "id: rec26 | score: 0.084 | category: history    | text: Rome was once the center of a vast empire.        \n"
```

**File**: `docs/semantic-search.ipynb` (modified, +16/-63)
```diff
@@ -38,22 +38,15 @@
    "metadata": {},
    "outputs": [],
    "source": [
+    "!pip install -qU pinecone==9.1.0 pinecone-notebooks==0.1.1 numpy==2.0.2 datasets==3.5.1\n",
+    "\n",
     "import os\n",
     "\n",
     "from datasets import load_dataset\n",
     "from pinecone import Pinecone\n",
     "from tqdm import tqdm"
    ]
   },
-  {
-   "cell_type": "code",
-   "execution_count": null,
-   "metadata": {},
-   "outputs": [],
-   "source": [
-    "!pip install -qU pinecone==8.0.0 pinecone-notebooks==0.1.1 numpy==2.0.2 datasets==3.5.1"
-   ]
-  },
   {
    "cell_type": "markdown",
    "metadata": {
@@ -148,31 +141,15 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 5,
+   "execution_count": null,
    "metadata": {
     "colab": {
      "base_uri": "https://localhost:8080/"
     },
     "id": "kT8pfoO46Iwg",
     "outputId": "0fec19be-c74d-4602-bec6-24d61cfc5bb4"
    },
-   "outputs": [
-    {
-     "data": {
-      "text/plain": [
-       "{'dimension': 1024,\n",
-       " 'index_fullness': 0.0,\n",
-       " 'metric': 'cosine',\n",
-       " 'namespaces': {},\n",
-       " 'total_vector_count': 0,\n",
-       " 'vector_type': 'dense'}"
-      ]
-     },
-     "execution_count": 5,
-     "metadata": {},
-     "output_type": "execute_result"
-    }
-   ],
+   "outputs": [],
    "source": [
     "index_name = \"semantic-search\"\n",
     "\n",
@@ -220,7 +197,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 6,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
    "source": [
@@ -243,32 +220,16 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 7,
+   "execution_count": null,
    "metadata": {},
-   "outputs": [
-    {
-     "data": {
-      "text/plain": [
-       "{'id': ['0', '1', '2', '3', '4'],\n",
-       " 'translation': [{'en': \"Let's try something.\", 'es': '¡Intentemos algo!'},\n",
-       "  {'en': \"Let's try something.\", 'es': 'Intentemos algo.'},\n",
-       "  {'en': \"Let's try something.\", 'es': 'Permíteme hacer algo.'},\n",
-       "  {'en': \"Let's try something.\", 'es': 'Permíteme intentarlo.'},\n",
-       "  {'en': 'I have to go to sleep.', 'es': 'Tengo que irme a dormir.'}]}"
-      ]
-     },
-     "execution_count": 7,
-     "metadata": {},
-     "output_type": "execute_result"
-    }
-   ],
+   "outputs": [],
    "source": [
     "tatoeba[0:5]"
    ]
   },
   {
    "cell_type": "code",
-   "execution_count": 8,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
    "source": [
@@ -354,7 +315,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 9,
+   "execution_count": null,
    "metadata": {
     "colab": {
      "base_uri": "https://localhost:8080/",
@@ -376,15 +337,7 @@
     "id": "RhR6WOi1huXZ",
     "outputId": "9ae50bfe-3ebf-4d8b-e28e-3230aed0e1d7"
    },
-   "outputs": [
-    {
-     "name": "stdout",
-     "output_type": "stream",
-     "text": [
-      "Upserting records batch: 100%|██████████| 5/5 [00:02<00:00,  1.91it/s]\n"
-     ]
-    }
-   ],
+   "outputs": [],
    "source": [
     "batch_size = 96\n",
     "namespace = \"english-sentences\"\n",
@@ -428,7 +381,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 10,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
    "source": [
@@ -440,7 +393,7 @@
     "\n",
     "for result in results[\"result\"][\"hits\"]:\n",
     "    print(\n",
-    "        f\"Sentence: {result['fields']['chunk_text']} Semantic Similarity Score: {result['_score']}\\n\"\n",
+    "        f\"Sentence: {result['fields']['chunk_text']} Semantic Similarity Score: {result['score']}\\n\"\n",
     "    )"
    ]
   },
@@ -453,7 +406,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 11,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
    "source": [
@@ -465,7 +418,7 @@
     "\n",
     "for result in results[\"result\"][\"hits\"]:\n",
     "    print(\n",
-    "        f\"Sentence: {result['fields']['chunk_text']} Semantic Similarity Score: {result['_score']}\\n\"\n",
+    "        f\"Sentence: {result['fields']['chunk_text']} Semantic Similarity Score: {result['score']}\\n\"\n",
     "    )"
    ]
   },
@@ -495,7 +448,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 12,
+   "execution_count": null,
    "metadata": {
     "id": "-cWdeKzhAtww"
    },
@@ -539,4 +492,4 @@
  },
  "nbformat": 4,
  "nbformat_minor": 4
-}
\ No newline at end of file
+}
```

---

### Incident Patch 5: `77636825` (2026-07-09)
**Commit Message**: docs(quick-tour): bump to pinecone 9.1.0 (#599)

## Why

Part of moving the `docs/` notebooks off the pre-9.x client (urllib3,
**no default data-plane timeout** — the root cause behind the
notebook-checker hangs). 9.x (httpx) applies a 30s default with retries.

Covers the four quick-tour notebooks: `hello-pinecone`,
`interacting-with-the-index`, `namespacing`, `simple-classifier` (all
were `pinecone==8.0.0`).

## Changes (per notebook)

- Pin bump `pinecone==8.0.0` → `9.1.0`.
- **Consolidate imports into the first (pip) code cell** — required by
`check-structure` (imports only in the first code cell), and
runtime-safe because the harness runs cells top-to-bottom with no
pre-install, so imports must follow the `!pip install`.
- **Single-line the `!pip install`** — `check-pinning` reads a `\`
continuation as an unpinned package.
- Normalized with the repo's own pre-commit pipeline (`ruff --fix`,
`ruff-format`, `nbstripout`), which is what accounts for most of the
diff size (stale 8.x outputs stripped, import blocks sorted). The
semantic change is just the three bullets above.

No `_id`/`_score` result access in these notebooks, so no API-shape
fixes were needed. API surface used (`P

**File**: `docs/quick-tour/hello-pinecone.ipynb` (modified, +60/-257)
```diff
@@ -2,7 +2,7 @@
  "cells": [
   {
    "cell_type": "markdown",
-   "id": "023d771c",
+   "id": "0",
    "metadata": {
     "id": "023d771c"
    },
@@ -12,7 +12,7 @@
   },
   {
    "cell_type": "markdown",
-   "id": "conceptual-belfast",
+   "id": "1",
    "metadata": {
     "editable": true,
     "id": "conceptual-belfast",
@@ -36,7 +36,7 @@
   },
   {
    "cell_type": "markdown",
-   "id": "first-affairs",
+   "id": "2",
    "metadata": {
     "id": "first-affairs",
     "papermill": {
@@ -54,7 +54,7 @@
   },
   {
    "cell_type": "markdown",
-   "id": "banned-huntington",
+   "id": "3",
    "metadata": {
     "editable": true,
     "id": "banned-huntington",
@@ -76,8 +76,8 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 1,
-   "id": "parallel-detective",
+   "execution_count": null,
+   "id": "4",
    "metadata": {
     "id": "parallel-detective",
     "papermill": {
@@ -91,12 +91,19 @@
    },
    "outputs": [],
    "source": [
-    "!pip install -qU pandas==2.2.3 pinecone==8.0.0"
+    "!pip install -qU pandas==2.2.3 pinecone==9.1.0\n",
+    "\n",
+    "import os\n",
+    "import random\n",
+    "import time\n",
+    "\n",
+    "import pandas as pd\n",
+    "from pinecone import AwsRegion, CloudProvider, Metric, Pinecone, ServerlessSpec"
    ]
   },
   {
    "cell_type": "markdown",
-   "id": "272f3b6d",
+   "id": "5",
    "metadata": {},
    "source": [
     "## Getting started\n",
@@ -106,24 +113,25 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 2,
-   "id": "3f53fd40",
+   "execution_count": null,
+   "id": "6",
    "metadata": {},
    "outputs": [],
    "source": [
-    "import os\n",
-    "from pinecone import Pinecone\n",
-    "\n",
     "# Get your API key at app.pinecone.io\n",
     "api_key = os.environ.get(\"PINECONE_API_KEY\") or \"PINECONE_API_KEY\"\n",
     "\n",
     "# Instantiate the Pinecone client\n",
-    "pc = Pinecone(api_key=api_key)"
+    "pc = Pinecone(\n",
+    "    # You can remove this for your own projects!\n",
+    "    api_key=api_key,\n",
+    "    source_tag=\"pinecone_examples:docs:quick_tour:hello_pinecone\",\n",
+    ")"
    ]
   },
   {
    "cell_type": "markdown",
-   "id": "forbidden-indication",
+   "id": "7",
    "metadata": {
     "id": "forbidden-indication",
     "papermill": {
@@ -143,8 +151,8 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 3,
-   "id": "EA2EcZsCoWS3",
+   "execution_count": null,
+   "id": "8",
    "metadata": {
     "id": "EA2EcZsCoWS3",
     "tags": [
@@ -159,8 +167,8 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 4,
-   "id": "synthetic-essex",
+   "execution_count": null,
+   "id": "9",
    "metadata": {
     "id": "synthetic-essex",
     "papermill": {
@@ -181,7 +189,7 @@
   },
   {
    "cell_type": "markdown",
-   "id": "94LRI2H8Ch2B",
+   "id": "10",
    "metadata": {
     "editable": true,
     "id": "94LRI2H8Ch2B",
@@ -212,8 +220,8 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 5,
-   "id": "4YwC8livCrn2",
+   "execution_count": null,
+   "id": "11",
    "metadata": {
     "id": "4YwC8livCrn2",
     "papermill": {
@@ -225,39 +233,8 @@
     },
     "tags": []
    },
-   "outputs": [
-    {
-     "data": {
-      "text/plain": [
-       "{\n",
-       "    \"name\": \"hello-pinecone\",\n",
-       "    \"metric\": \"cosine\",\n",
-       "    \"host\": \"hello-pinecone-dojoi3u.svc.aped-4627-b74a.pinecone.io\",\n",
-       "    \"spec\": {\n",
-       "        \"serverless\": {\n",
-       "            \"cloud\": \"aws\",\n",
-       "            \"region\": \"us-east-1\"\n",
-       "        }\n",
-       "    },\n",
-       "    \"status\": {\n",
-       "        \"ready\": true,\n",
-       "        \"state\": \"Ready\"\n",
-       "    },\n",
-       "    \"vector_type\": \"dense\",\n",
-       "    \"dimension\": 3,\n",
-       "    \"deletion_protection\": \"disabled\",\n",
-       "    \"tags\": null\n",
-       "}"
-      ]
-     },
-     "execution_count": null,
-     "metadata": {},
-     "output_type": "execute_result"
-    }
-   ],
+   "outputs": [],
    "source": [
-    "from pinecone import ServerlessSpec, CloudProvider, AwsRegion, Metric\n",
-    "\n",
     "pc.create_index(\n",
     "    name=index_name,\n",
     "    metric=Metric.COSINE,\n",
@@ -268,55 +245,26 @@
   },
   {
    "cell_type": "markdown",
-   "id": "060bb093-fc60-4065-bb6f-529145e6f186",
+   "id": "12",
    "metadata": {},
    "source": [
     "We can look up the configuration for the index anytime we like by using `describe_index`"
    ]
   },
   {
    "cell_type": "code",
-   "execution_count": 6,
-   "id": "eeb2f680-7250-4117-bdbb-b19fc36d476b",
+   "execution_count": null,
+   "id": "13",
    "metadata": {},
-   "outputs": [
-    {
-     "data": {
-      "text/plain": [
-       "{\n",
-       "    \"name\": \"hello-pinecone\",\n",
-       "    \"metric\": \"cosine\",\n",
-       "    \"host\": \"hello-pinecone-dojoi3u.svc.aped-4627-b74a.pinecone.io\",\n",
-       "    \"spec\": {\n
```

**File**: `docs/quick-tour/interacting-with-the-index.ipynb` (modified, +116/-333)
```diff
@@ -2,6 +2,7 @@
  "cells": [
   {
    "cell_type": "markdown",
+   "id": "0",
    "metadata": {
     "editable": true,
     "id": "a3e6b1da",
@@ -12,11 +13,11 @@
    },
    "source": [
     "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/pinecone-io/examples/blob/master/docs/quick-tour/interacting-with-the-index.ipynb) [![Open nbviewer](https://raw.githubusercontent.com/pinecone-io/examples/master/assets/nbviewer-shield.svg)](https://nbviewer.org/github/pinecone-io/examples/blob/master/docs/quick-tour/interacting-with-the-index.ipynb)"
-   ],
-   "id": "a3e6b1da"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "1",
    "metadata": {
     "id": "forbidden-sunglasses",
     "papermill": {
@@ -40,11 +41,11 @@
     "* `query`: query the index and retrieve the top-k nearest neighbors based on dot-product, cosine-similarity, Euclidean distance, and more.\n",
     "* `fetch`: fetch vectors stored in the index by id.\n",
     "* `describe_index_stats`: get statistics about the index."
-   ],
-   "id": "forbidden-sunglasses"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "2",
    "metadata": {
     "id": "quiet-signal",
     "papermill": {
@@ -58,11 +59,11 @@
    },
    "source": [
     "## Prerequisites"
-   ],
-   "id": "quiet-signal"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "3",
    "metadata": {
     "id": "beautiful-paper",
     "papermill": {
@@ -76,11 +77,12 @@
    },
    "source": [
     "Install dependencies."
-   ],
-   "id": "beautiful-paper"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "4",
    "metadata": {
     "colab": {
      "base_uri": "https://localhost:8080/"
@@ -100,15 +102,20 @@
     },
     "tags": []
    },
-   "source": [
-    "!pip install -qU pandas==2.2.3 pinecone==8.0.0"
-   ],
-   "execution_count": 1,
    "outputs": [],
-   "id": "complex-diversity"
+   "source": [
+    "!pip install -qU pandas==2.2.3 pinecone==9.1.0\n",
+    "\n",
+    "import os\n",
+    "from getpass import getpass\n",
+    "\n",
+    "import pandas as pd\n",
+    "from pinecone import AwsRegion, CloudProvider, Metric, Pinecone, ServerlessSpec"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "5",
    "metadata": {
     "editable": true,
     "slideshow": {
@@ -120,45 +127,35 @@
     "## Creating an Index\n",
     "\n",
     "We begin by instantiating the Pinecone client. To do this we need a [free API key](https://app.pinecone.io)."
-   ],
-   "id": "4b7eca35"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "6",
    "metadata": {
     "editable": true,
     "slideshow": {
      "slide_type": ""
     },
     "tags": []
    },
+   "outputs": [],
    "source": [
-    "import os\n",
-    "from getpass import getpass\n",
-    "\n",
-    "from pinecone import Pinecone\n",
-    "\n",
     "# Get API key at app.pinecone.io\n",
     "api_key = os.environ.get(\"PINECONE_API_KEY\") or getpass(\"Enter your Pinecone API key: \")\n",
     "\n",
     "# Instantiate the client\n",
-    "pc = Pinecone(api_key=api_key)"
-   ],
-   "execution_count": 2,
-   "outputs": [
-    {
-     "output_type": "stream",
-     "text": [
-      "/opt/conda/lib/python3.12/site-packages/tqdm/auto.py:21: TqdmWarning: IProgress not found. Please update jupyter and ipywidgets. See https://ipywidgets.readthedocs.io/en/stable/user_install.html\n",
-      "  from .autonotebook import tqdm as notebook_tqdm\n"
-     ],
-     "name": "stderr"
-    }
-   ],
-   "id": "296b4b28"
+    "pc = Pinecone(\n",
+    "    # You can remove this for your own projects!\n",
+    "    api_key=api_key,\n",
+    "    source_tag=\"pinecone_examples:docs:quick_tour:interacting_with_the_index\",\n",
+    ")"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "7",
    "metadata": {
     "editable": true,
     "slideshow": {
@@ -177,11 +174,12 @@
     "- `spec` holds a specification which tells Pinecone how you would like to deploy our index. You can find a list of all [available providers and regions here](https://docs.pinecone.io/guides/index-data/create-an-index#cloud-regions).\n",
     "\n",
     "There are more configurations available, but this minimal set will get us started."
-   ],
-   "id": "e5ded34b-58b6-46b1-9c04-b62e380b80a2"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "8",
    "metadata": {
     "editable": true,
     "id": "MjzMwddcyHM2",
@@ -192,33 +190,33 @@
      "parameters"
     ]
    },
+   "outputs": [],
    "source": [
     "index_name = \"interacting-with-the-index\""
-   ],
-   "execution_count": 3,
-   "outputs": [],
-   "id": "MjzMwddcyHM2"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "9",
    "metadata": {
     "editable": true,
     "slideshow": {
      "slide_type": ""
     },
     "tags": []
    },
+   "outputs": [],
    "source": [
     "# Delete the demo index if it already exists\n",
     "if pc.
```

**File**: `docs/quick-tour/namespacing.ipynb` (modified, +99/-495)
```diff
@@ -2,16 +2,17 @@
  "cells": [
   {
    "cell_type": "markdown",
+   "id": "0",
    "metadata": {
     "id": "43f9ce31"
    },
    "source": [
     "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/pinecone-io/examples/blob/master/docs/quick-tour/namespacing.ipynb) [![Open nbviewer](https://raw.githubusercontent.com/pinecone-io/examples/master/assets/nbviewer-shield.svg)](https://nbviewer.org/github/pinecone-io/examples/blob/master/docs/quick-tour/namespacing.ipynb)"
-   ],
-   "id": "43f9ce31"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "1",
    "metadata": {
     "id": "artificial-devil",
     "papermill": {
@@ -31,19 +32,19 @@
     "If your use-case is one where you feel a temptation to create multiple indexes programatically, consider whether the sort of multitenancy provided by namespaces would be a better solution to isolate different parts of your data.\n",
     "\n",
     "For example, if you were building a movie recommender system, you could use namespacing to separate recommendations by genre. But if you need more flexibility in how you group and search records, putting genre information into metadata and using metadata filtering would probably be a better fit."
-   ],
-   "id": "artificial-devil"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "2",
    "metadata": {},
    "source": [
     "# Prerequisites"
-   ],
-   "id": "ab928f49-67c6-4717-b0c6-47cb795763aa"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "3",
    "metadata": {
     "id": "emotional-lyric",
     "papermill": {
@@ -57,11 +58,12 @@
    },
    "source": [
     "Install dependencies."
-   ],
-   "id": "emotional-lyric"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "4",
    "metadata": {
     "id": "pleasant-transfer",
     "papermill": {
@@ -73,43 +75,48 @@
     },
     "tags": []
    },
-   "source": [
-    "!pip install -qU pandas==2.2.3 pinecone==8.0.0"
-   ],
-   "execution_count": 12,
    "outputs": [],
-   "id": "pleasant-transfer"
+   "source": [
+    "!pip install -qU pandas==2.2.3 pinecone==9.1.0\n",
+    "\n",
+    "import os\n",
+    "import time\n",
+    "\n",
+    "import pandas as pd\n",
+    "from pinecone import AwsRegion, CloudProvider, Metric, Pinecone, ServerlessSpec"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "5",
    "metadata": {},
    "source": [
     "## Creating an Index\n",
     "\n",
     "We begin by instantiating an instance of the Pinecone client. To do this we need a [free API key](https://app.pinecone.io)."
-   ],
-   "id": "4c246952"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "6",
    "metadata": {},
+   "outputs": [],
    "source": [
-    "import os\n",
-    "\n",
-    "from pinecone import Pinecone\n",
-    "\n",
     "# Get API key at app.pinecone.io\n",
     "api_key = os.environ.get(\"PINECONE_API_KEY\") or \"PINECONE_API_KEY\"\n",
     "\n",
     "# Instantiate the client\n",
-    "pc = Pinecone(api_key=api_key)"
-   ],
-   "execution_count": 13,
-   "outputs": [],
-   "id": "a331165c"
+    "pc = Pinecone(\n",
+    "    # You can remove this for your own projects!\n",
+    "    api_key=api_key,\n",
+    "    source_tag=\"pinecone_examples:docs:quick_tour:namespacing\",\n",
+    ")"
+   ]
   },
   {
    "cell_type": "markdown",
+   "id": "7",
    "metadata": {},
    "source": [
     "### Creating a Pinecone Index\n",
@@ -122,38 +129,39 @@
     "- `spec` holds a specification which tells Pinecone how you would like to deploy our index. You can find a list of all [available providers and regions here](https://docs.pinecone.io/guides/index-data/create-an-index#cloud-regions).\n",
     "\n",
     "There are more configurations available, but this minimal set will get us started."
-   ],
-   "id": "e39abbf1"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "8",
    "metadata": {
     "id": "UYgB1gef1Utk",
     "tags": [
      "parameters"
     ]
    },
+   "outputs": [],
    "source": [
     "index_name = \"pinecone-namespacing\""
-   ],
-   "execution_count": 14,
-   "outputs": [],
-   "id": "UYgB1gef1Utk"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "9",
    "metadata": {},
+   "outputs": [],
    "source": [
     "# Delete the demo index if it already exists\n",
     "if pc.has_index(name=index_name):\n",
     "    pc.delete_index(index_name)"
-   ],
-   "execution_count": 15,
-   "outputs": [],
-   "id": "2da6e7ad"
+   ]
   },
   {
    "cell_type": "code",
+   "execution_count": null,
+   "id": "10",
    "metadata": {
     "colab": {
      "base_uri": "https://localhost:8080/"
@@ -169,83 +177,44 @@
     },
     "tags": []
    },
+   "outputs": [],
    "source": [
-    "from pinecone import AwsRegion, CloudProvider, Metric, ServerlessSpec\n",
-    "\n",
     "# Create an index\n",
     "pc.create_index(\n",
     "    name=index_name,\n",
     "    d
```

---

### Incident Patch 6: `283141ec` (2026-05-21)
**Commit Message**: docs: expand convert-to-marimo skill with function extraction guidance

Add detailed guidance on:
- Naming functions to document intent (replacing comments)
- Decomposing monolithic functions by stage
- Splitting large cells so intermediate results are visible
- Extracting reusable helpers into their own cells
- Parameterizing functions to avoid globals

Co-Authored-By: Claude Sonnet 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `.claude/skills/convert-to-marimo/SKILL.md` (modified, +126/-8)
```diff
@@ -231,6 +231,131 @@ Results update when the user changes either input.
 
 ## Phase 6: Code Quality
 
+### Name things to document intent
+
+Well-named functions and variables replace comments. If you find yourself writing a comment to explain what a block of code does, that is a signal to extract it into a named function instead.
+
+**Before:**
+```python
+# Filter sentences containing our keyword and build records for Pinecone
+results = []
+for i, row in enumerate(dataset.filter(lambda x: any(k in x["text"] for k in keywords))):
+    results.append({"id": str(i), "chunk_text": row["text"], "lang": row["lang"]})
+```
+
+**After:**
+```python
+def filter_by_keywords(dataset, keywords):
+    return dataset.filter(lambda x: any(k in x["text"] for k in keywords))
+
+def to_records(sentences, id_prefix=""):
+    return [
+        {"id": f"{id_prefix}{i}", "chunk_text": s["text"], "lang": s["lang"]}
+        for i, s in enumerate(sentences)
+    ]
+
+filtered = filter_by_keywords(dataset, keywords)
+records = to_records(filtered)
+```
+
+The second version reads like a description of what is happening. The function names are the documentation.
+
+### Decompose monolithic functions by stage
+
+Jupyter notebooks often have one large function that loads, filters, transforms, and formats data all at once. Split it along its natural stages — each stage becomes a function with a clear name and a clear input/output contract.
+
+**Identify stages by asking:** at what points does the data change shape or purpose?
+
+Example decomposition:
+```
+prepare_sentences(dataset, keywords)  →  one big function doing everything
+
+becomes:
+
+filter_pairs(dataset, keywords)       →  returns filtered HF dataset (pairs)
+extract_sentences(pairs, lang)        →  returns single-language HF dataset
+to_records(sentences, column)         →  returns list of Pinecone record dicts
+```
+
+Each stage can be shown, inspected, and explained independently. Each can be reused or replaced without touching the others.
+
+### Split large cells to make intermediate results visible
+
+Marimo cells produce output. A single cell that does five things produces one output — or none. Splitting at stage boundaries lets each step show its result, which helps readers understand what changed and why.
+
+**Rule of thumb:** if a cell produces a value worth seeing (a filtered dataset, a record list, a search result), that value should be the last expression in its own cell.
+
+```python
+# Too much in one cell — intermediate state invisible
+filtered = filter_pairs(tatoeba, keywords)
+english = extract_sentences(filtered, lang="en")
+records = to_records(english, column="sentence")
+index.upsert_records(records=records, namespace=namespace)
+```
+
+```python
+# Split: each step's output is inspectable
+# Cell 1
+filtered_pairs = filter_pairs(tatoeba, keywords=keywords)
+
+# Cell 2 — reader can see what was extracted
+english = extract_sentences(filtered_pairs, lang="en")
+mo.ui.table(english, page_size=5)
+
+# Cell 3 — reader can see the record format before upserting
+records = to_records(english, column="sentence")
+mo.ui.table(records, page_size=5)
+
+# Cell 4 — upsert is its own step
+for start in mo.status.progress_bar(range(0, len(records), batch_size)):
+    index.upsert_records(records=records[start:start + batch_size], namespace=namespace)
+```
+
+### Extract reusable helpers into their own cells
+
+If a function is called more than once, or could reasonably be called with different arguments, give it its own cell. Readers can read the definition once, then see it used cleanly at each call site.
+
+The search notebook pattern is a good model:
+
+```python
+# One cell defines the helper
+def search(query, top_k=10, lang=None):
+    results = index.search(
+        namespace=namespace,
+        top_k=top_k,
+        inputs={"text": query},
+        filter={"lang": {"$eq": lang}} if lang else None,
+    )
+    return print_results(query, results)
+
+# Subsequent cells are just clean call sites
+search("I want to go to the park and relax")
+search("Quiero ir al parque a relajarme")
+search("The park is crowded today", lang="en")
+```
+
+### Parameterize functions — avoid globals
+
+Converted notebooks often have functions that silently close over global variables (`keywords`, `index`, `namespace`). This makes the function hard to reuse and hides dependencies.
+
+**Before (globals):**
+```python
+keywords = ["park"]
+
+def prepare_sentences(dataset):
+    return dataset.filter(lambda x: any(k in x["translation"]["en"] for k in keywords))
+```
+
+**After (explicit parameter):**
+```python
+def prepare_sentences(dataset, keywords=None):
+    if keywords:
+        return dataset.filter(lambda x: any(k in x["translation"]["en"] for k in keywords))
+    return dataset
+```
+
+The exception: functions that close over `index` and `namespace` in a "search" helper are reasonable — they're scoped to the notebook, and the closure reads naturally.
+
 ### Remove over-
```

---

### Incident Patch 7: `97f4811f` (2026-05-21)
**Commit Message**: fix: add trust_remote_code=True to load_dataset call

Required for Helsinki-NLP/tatoeba which uses a custom loading script.

Co-Authored-By: Claude Sonnet 4.6 (1M context) <[REDACTED_EMAIL]>

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

### Incident Patch 8: `b107555b` (2026-05-12)
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

Signed-off-by: jishudashu <[REDACTED_EMAIL]>

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

### Incident Patch 9: `9a520d2b` (2026-05-11)
**Commit Message**: build(deps): bump langchain-core from 1.2.7 to 1.3.3 (#568)

Bumps [langchain-core](https://github.com/langchain-ai/langchain) from
1.2.7 to 1.3.3.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/langchain-ai/langchain/releases">langchain-core's
releases</a>.</em></p>
<blockquote>
<h2>langchain-core==1.3.3</h2>
<p>Changes since langchain-core==1.3.2</p>
<p>release(core): 1.3.3 (<a
href="https://redirect.github.com/langchain-ai/langchain/issues/37198">#37198</a>)
fix(core): set deprecation <code>since</code> to 1.3.3 to match release
(<a
href="https://redirect.github.com/langchain-ai/langchain/issues/37200">#37200</a>)
fix(core, langchain): harden <code>load()</code> against untrusted
manifests (<a
href="https://redirect.github.com/langchain-ai/langchain/issues/37197">#37197</a>)
chore: bump notebook from 7.5.0 to 7.5.6 in /libs/core (<a
href="https://redirect.github.com/langchain-ai/langchain/issues/37109">#37109</a>)
chore: bump types-pyyaml from 6.0.12.20250915 to 6.0.12.20260408 in
/libs/core (<a
href="https://redirect.github.com/langchain-ai/langchain/issues/37129">#37129</a>)
fix(core): preserve structured <code>inputs</code> on tool 

**File**: `uv.lock` (modified, +16/-3)
```diff
@@ -436,10 +436,11 @@ wheels = [
 
 [[package]]
 name = "langchain-core"
-version = "1.2.7"
+version = "1.3.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "jsonpatch" },
+    { name = "langchain-protocol" },
     { name = "langsmith" },
     { name = "packaging" },
     { name = "pydantic" },
@@ -448,9 +449,21 @@ dependencies = [
     { name = "typing-extensions" },
     { name = "uuid-utils" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/a2/0e/664d8d81b3493e09cbab72448d2f9d693d1fa5aa2bcc488602203a9b6da0/langchain_core-1.2.7.tar.gz", hash = "sha256:e1460639f96c352b4a41c375f25aeb8d16ffc1769499fb1c20503aad59305ced", size = 837039, upload-time = "2026-01-09T17:44:25.505Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/d3/ae/8b74458fc3850ec3d150eb9f45e857db129dafa801fb5cf173dfc9f8bbf3/langchain_core-1.3.3.tar.gz", hash = "sha256:fa510a5db8efdc0c6ff41c0939fb5c00a0183c11f6b84233e892e3227ff69182", size = 915041, upload-time = "2026-05-05T19:02:36.612Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/1f/01/4771b7ab2af1d1aba5b710bd8f13d9225c609425214b357590a17b01be77/langchain_core-1.3.3-py3-none-any.whl", hash = "sha256:18aae8506f37da7f74398492279a7d6efcee4f8e23c4c41c7af080eeb7ef7bd1", size = 543857, upload-time = "2026-05-05T19:02:34.52Z" },
+]
+
+[[package]]
+name = "langchain-protocol"
+version = "0.0.15"
+source = { registry = "https://pypi.org/simple" }
+dependencies = [
+    { name = "typing-extensions" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/4f/24/9777489d6fbbee64af0c8f96d4f840239c408cf694f3394672807dafc490/langchain_protocol-0.0.15.tar.gz", hash = "sha256:9ab2d11ee73944754f10e037e717098d3a6796f0e58afa9cadda6154e7655ade", size = 5862, upload-time = "2026-05-01T22:30:04.748Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/6e/6f/34a9fba14d191a67f7e2ee3dbce3e9b86d2fa7310e2c7f2c713583481bd2/langchain_core-1.2.7-py3-none-any.whl", hash = "sha256:452f4fef7a3d883357b22600788d37e3d8854ef29da345b7ac7099f33c31828b", size = 490232, upload-time = "2026-01-09T17:44:24.236Z" },
+    { url = "https://files.pythonhosted.org/packages/1d/7a/9c97a7b9cbe4c5dc6a44cdb1545450c28f0c8ce89b9c1f0ee7fbad896263/langchain_protocol-0.0.15-py3-none-any.whl", hash = "sha256:461eb794358f83d5e42635a5797799ffec7b4702314e34edf73ac21e75d3ef79", size = 6982, upload-time = "2026-05-01T22:30:03.877Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 10: `fc7793f5` (2026-05-06)
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

### Incident Patch 11: `96502ae3` (2026-02-01)
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

### Incident Patch 12: `927cfda6` (2026-01-29)
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

### Incident Patch 13: `e743b79f` (2026-01-29)
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

### Incident Patch 14: `70976e2a` (2026-01-29)
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

---

### Incident Patch 15: `b3faed51` (2026-01-29)
**Commit Message**: fix(commands): make iterate command more autonomous

- Do not ask which PR to work on - pick first one
- Do not wait for confirmation
- Emphasize immediate action throughout

**File**: `.cursor/commands/tb-iterate-review-tickets.md` (modified, +8/-2)
```diff
@@ -2,7 +2,11 @@
 
 Find one ticket in review that matches this worker's shard, then actively work on its PR.
 
-**IMPORTANT**: Do not just list PRs or tickets. Pick ONE and actively work on it.
+**CRITICAL RULES**:
+- Do NOT just list PRs or tickets - pick ONE and work on it immediately
+- Do NOT ask which PR to work on - pick the first matching one yourself
+- Do NOT wait for confirmation - this is an autonomous workflow
+- Take action, make commits, push changes
 
 ## Parse Shard Info
 
@@ -23,7 +27,7 @@ For example, if the ticket ID is "EXA-123" and this is worker 1 of 3:
 - Check: 123 % 3 = 0, which does not equal 1
 - Skip this ticket
 
-**Pick the first matching ticket.** If no matching tickets are found, say "No tickets for this shard" and exit.
+**Pick the first matching ticket and proceed immediately.** Do not list options or ask which one to work on. If no matching tickets are found, say "No tickets for this shard" and exit.
 
 ## Find the Associated PR
 
@@ -34,6 +38,8 @@ From the selected ticket, find the associated GitHub PR. Check:
 
 **If no PR is found, say "No PR found for ticket [ID]" and exit.**
 
+Once you have a PR, proceed immediately to checkout and work on it.
+
 ## Checkout the PR Branch
 
 Run these commands to checkout the PR branch:
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
