# Forensic Learning Record (Deep Inspection): genieincodebottle/generative-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/genieincodebottle-generative-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/genieincodebottle/generative-ai](https://github.com/genieincodebottle/generative-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:01:44.101Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genieincodebottle/generative-ai`
- **Description**: Comprehensive resources on Generative AI, including a detailed roadmap, projects, use cases, interview preparation, and coding preparation.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2644 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `archive_legacy/chatbot-local/app.py`
```
import streamlit as st
from streamlit_chat import message

# All utility functions
import utils

from PIL import Image

def initialize_session_state():
    """
    Session State is a way to share variables between reruns, for each user session.
    """

    st.session_state.setdefault('history', [])
    st.session_state.setdefault('generated', ["Hello! I am here to provide answers to questions fetched from Database."])
    st.session_state.setdefault('past', ["Hello Buddy!"])

def display_chat(conversation_chain, chain):
    """
    Streamlit relatde code where we are passing conversation_chain instance created earlier
    It creates two containers
    container: To group our chat input form
    reply_container: To group the generated chat response

    Args:
    - conversation_chain: Instance of LangChain ConversationalRetrievalChain
    """
    #In Streamlit, a container is an invisible element that can hold multiple 
    #elements together. The st.container function allows you to group multiple 
    #elements together. For example, you can use a container to insert multiple 
    #elements into your app out of order.
    reply_container = st.container()
    container = st.container()

    with container:
        with st.form(key='chat_form', clear_on_submit=True):
            user_input = st.text_input("Question:", placeholder="Ask me questions from uploaded PDF", key='input')
            submit_button = st.form_submit_button(label='Send ⬆️')
        
        #Check if user submit question with user input and generate response of the question
        if submit_button and user_input:
            generate_response(user_input, conversation_chain, chain)
    
    #Display generated response to streamlit web UI
    display_generated_responses(reply_container)


def generate_response(user_input, conversation_chain, chain):
    """
    Generate LLM response based on the user question by retrieving data from Database
    Also, stores information to streamlit session states 'past' and 'generated' so that it can
    have memory of previous generation for converstational type of chats (Like chatGPT)

    Args
    - user_input(str): User input as a text
    - conversation_chain: Instance of ConversationalRetrievalChain 
    """

    with st.spinner('Spinning a snazzy reply...'):
        output = conversation_chat(user_input, conversation_chain, chain, st.session_state['history'])

    st.session_state['past'].append(user_input)
    st.session_state['generated'].append(output)

def conversation_chat(user_input, conversation_chain, chain, history):
    """
    Returns LLM response after invoking model through conversation_chain

    Args:
    - user_input(str): User input
    - conversation_chain: Instance of ConversationalRetrievalChain
    - history: Previous response history
    returns:
    - result["answer"]: Response generated from LLM
    """
    response = conversation_chain.invoke(user_input)
    final_response = chain.invoke(f"Based on the following information generate human redable response: {response['query']},  {response['result']}")

    history.append((user_input, final_response))
    return final_response


def display_generated_responses(reply_container):
    """
    Display generated LLM response to Streamlit Web UI

    Args:
    - reply_container: Streamlit container created at previous step
    """
    if st.session_state['generated']:
        with reply_container:
            for i in range(len(st.session_state['generated'])):
                message(st.session_state["past"][i], is_user=True, key=f"{i}_user", avatar_style="adventurer")
                message(st.session_state["generated"][i], key=str(i), avatar_style="bottts")

def main():
    """
    First function to call when we start streamlit app
    """
    # Step 1: Initialize session state
    initialize_session_state()
    
    st.title("Genie")

    image = Image.open('chatbot.jpg')
    st.image(image, width=150)
    
    hide_streamlit_style = """
            <style>
            #MainMenu {visibility: hidden;}
            footer {visibility: hidden;}
            </style>

            """
    st.markdown(hide_streamlit_style, unsafe_allow_html=True) 

    # Step 2: Initialize Streamlit
    conversation_chain, chain = utils.create_conversational_chain()

    #Step 3 - Display Chat to Web UI
    display_chat(conversation_chain, chain)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `archive_legacy/chatbot-local/utils.py`
```
from langchain_community.utilities import SQLDatabase

from langchain_core.prompts import PromptTemplate

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_experimental.sql.base import SQLDatabaseChain
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_community.utilities import SQLDatabase
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory

import configparser
import os

import retrying

def read_properties_file(file_path):
    # Check if the file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"The file '{file_path}' does not exist.")
    
    # Initialize the configparser
    config = configparser.ConfigParser()
    
    # Read the properties file
    config.read(file_path)
    
    # Access values
    db_path = config['DEFAULT']['db_path']
    gemini_api_key = config['DEFAULT']['gemini_api_key']
    
    return db_path, gemini_api_key

def get_property():
    # Path to the properties file
    file_path = 'config.properties'

    try:
        db_path, gemini_api_key = read_properties_file(file_path)
        print("Database path:", db_path)
        print("Gemini API Key", gemini_api_key)
        return db_path, gemini_api_key
    except FileNotFoundError as e:
        print(e)
        raise e
    
def get_llm(gemini_api_key):
    """
    Creata an instance of og Google Gemini Pro

    returns:
    - llm: An instance of Google Gemini Pro
    """
    # Create llm
    llm = ChatGoogleGenerativeAI(model="gemini-pro", google_api_key=gemini_api_key, 
                                 convert_system_message_to_human=True, temperature=0.0)
    return llm

def db_connection(db_path):
    db = SQLDatabase.from_uri(f"sqlite:///{db_path}")
    print(db.dialect)
    print(db.get_usable_table_names())
    resp = db.run("SELECT * FROM Employees LIMIT 10;")
    print(resp)
    return db

def create_conversational_chain():

    try:
        db, gemini_api_key = get_property()

        # Get the instance of LLM
        llm = get_llm(gemini_api_key)
        # Get the DB connection
        db = db_connection(db)

        sql_prompt_template = """
        Only use the following tables:
        {table_info}
        Question: {input}

        Given an input question, first create a syntactically correct
        {dialect} query to run.
        
        Relevant pieces of previous conversation:
        {history}

        (You do not need to use these pieces of information if not relevant)
        Dont include ```, ```sql and \n in the output.
        """
        prompt = PromptTemplate(
                input_variables=["input", "table_info", "dialect", "history"],
                template=sql_prompt_template,
            )
        memory = ConversationBufferMemory(memory_key="history")

        
        db_chain = SQLDatabaseChain.from_llm(
                llm, db, memory=memory, prompt=prompt, return_direct=True,  verbose=True
            )

        output_parser = StrOutputParser()
        chain = llm | output_parser
        

    except Exception as e:
        raise e
    return  db_chain, chain




```

### Core Architecture Module: `archive_legacy/chatbot/app.py`
```
#Streamlit is a free, open-source Python library that helps developers 
#and data scientists create interactive web applications for machine learning 
#and data science
import streamlit as st
from streamlit_chat import message

#ConversationalRetrievalChain is designed to process queries and generate responses by leveraging 
#information extracted from the associated documents. 
#It represents a form of Retrieval-Augmented Generation (RAG), offering a method to 
#enhance the quality of generated responses through retrieved documents.
from langchain.chains import ConversationalRetrievalChain

#Conversational memory is the mechanism that empowers a chatbot to respond 
#coherently to multiple queries, providing a chat-like experience. 
#It ensures continuity in the conversation, allowing the chatbot to consider 
#past interactions and provide contextually relevant responses.
from langchain.memory import ConversationBufferMemory

# All utility functions
import utils

from PIL import Image

def initialize_session_state():
    """
    Session State is a way to share variables between reruns, for each user session.
    """

    st.session_state.setdefault('history', [])
    st.session_state.setdefault('generated', ["Hello! I am here to provide answers to questions extracted from uploaded PDF files."])
    st.session_state.setdefault('past', ["Hello Buddy!"])

def create_conversational_chain(llm, vector_store):
    """
    Creating conversational chain using Mistral 7B LLM instance and vector store instance

    Args:
    - llm: Instance of Mistral 7B GGUF
    - vector_store: Instance of FAISS Vector store having all the PDF document chunks 
    """

    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
    
    chain = ConversationalRetrievalChain.from_llm(llm=llm, chain_type='stuff',
                                                 retriever=vector_store.as_retriever(search_kwargs={"k": 2}),
                                                 memory=memory)
    return chain

def display_chat(conversation_chain):
    """
    Streamlit relatde code wher we are passing conversation_chain instance created earlier
    It creates two containers
    container: To group our chat input form
    reply_container: To group the generated chat response

    Args:
    - conversation_chain: Instance of LangChain ConversationalRetrievalChain
    """
    #In Streamlit, a container is an invisible element that can hold multiple 
    #elements together. The st.container function allows you to group multiple 
    #elements together. For example, you can use a container to insert multiple 
    #elements into your app out of order.
    reply_container = st.container()
    container = st.container()

    with container:
        with st.form(key='chat_form', clear_on_submit=True):
            user_input = st.text_input("Question:", placeholder="Ask me questions from uploaded PDF", key='input')
            submit_button = st.form_submit_button(label='Send ⬆️')
        
        #Check if user submit question with user input and generate response of the question
        if submit_button and user_input:
            generate_response(user_input, conversation_chain)
    
    #Display generated response to streamlit web UI
    display_generated_responses(reply_container)


def generate_response(user_input, conversation_chain):
    """
    Generate LLM response based on the user question by retrieving data from Vector Database
    Also, stores information to streamlit session states 'past' and 'generated' so that it can
    have memory of previous generation for converstational type of chats (Like chatGPT)

    Args
    - user_input(str): User input as a text
    - conversation_chain: Instance of ConversationalRetrievalChain 
    """

    with st.spinner('Spinning a snazzy reply...'):
        output = conversation_chat(user_input, conversation_chain, st.session_state['history'])

    st.session_state['past'].append(user_input)
    st.session_state['generated'].append(output)

def conversation_chat(user_input, conversation_chain, history):
    """
    Returns LLM response after invoking model through conversation_chain

    Args:
    - user_input(str): User input
    - conversation_chain: Instance of ConversationalRetrievalChain
    - history: Previous response history
    returns:
    - result["answer"]: Response generated from LLM
    """
    result = conversation_chain.invoke({"question": user_input, "chat_history": history})
    history.append((user_input, result["answer"]))
    return result["answer"]


def display_generated_responses(reply_container):
    """
    Display generated LLM response to Streamlit Web UI

    Args:
    - reply_container: Streamlit container created at previous step
    """
    if st.session_state['generated']:
        with reply_container:
            for i in range(len(st.session_state['generated'])):
                message(st.session_state["past"][i], is_user=True, key=f"{i}_user", avatar_style="adventurer")
                message(st.session_state["generated"][i], key=str(i), avatar_style="bottts")

def main():
    """
    First function to call when we start streamlit app
    """
    # Step 1: Initialize session state
    initialize_session_state()
    
    st.title("Chat Bot")

    image = Image.open('chatbot.jpg')
    st.image(image, width=150)
    
    hide_streamlit_style = """
            <style>
            #MainMenu {visibility: hidden;}
            footer {visibility: hidden;}
            </style>

            """
    st.markdown(hide_streamlit_style, unsafe_allow_html=True) 

    # Step 2: Initialize Streamlit
    st.sidebar.title("Upload Pdf")
    #file_uploader, the data are copied to the Streamlit backend via the browser, 
    #and contained in a BytesIO buffer in Python memory (i.e. RAM, not disk).
    pdf_files = st.sidebar.file_uploader("", accept_multiple_files=True)
    
    # Step 3: Create instance of Mistral 7B GGUF file format using llama.cpp    
    llm = utils.create_llm()

    #Step 4: Create Vector Store and store uploaded Pdf file to in-mempry Vector Database FAISS
    # and return instance of vector store
    vector_store = utils.create_vector_store(pdf_files)

    if vector_store:
        #Step 5: If Vetor Store created successful with chunks of PDF files
        # then Create the chain object
        chain = create_conversational_chain(llm, vector_store)

        #Step 6 - Display Chat to Web UI
        display_chat(chain)
    else:
        print('Initialzed App.')

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `archive_legacy/chatbot/utils.py`
```
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import LlamaCpp
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader

import os
import tempfile
from typing import List
# Tqdm is a popular Python library that provides a simple and convenient way to add 
# progress bars to loops and iterable objects. 
from tqdm import tqdm

def create_llm():
    """
    Creata an instance of Mistral 7B GGUF format LLM using LlamaCpp

    returns:
    - llm: An instance of Mistral 7B LLM
    """
    # Create llm
    llm = LlamaCpp(
        streaming = True,
        model_path="artifcats/mistral-7b-instruct-v0.2.Q2_K.gguf",
        temperature=0.3,
        top_p=0.8,
        verbose=True,
        n_ctx=4096 #Context Length
    )
    return llm

def create_vector_store(pdf_files: List):
    """
    Create In-memory FAISS vetor store using uploaded Pdf

    Args:
    - pdf_files(List): PDF file uploaded
    retunrs:
    - vector_store: In-memory Vector store fo further processing at chat app

    """
    vector_store = None

    if pdf_files:
        text = []
        
        for file in tqdm(pdf_files, desc="Processing files"):
            #Get the file and check it's extension
            file_extension = os.path.splitext(file.name)[1]
            #Write the PDF file to temporary location
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                temp_file.write(file.read())
                temp_file_path = temp_file.name
            #Load the PDF files using PyPdf library 
            loader = None
            if file_extension == ".pdf":
                loader = PyPDFLoader(temp_file_path)

            #Load if text file
            if loader:
                text.extend(loader.load())
                os.remove(temp_file_path)

        #Split the file to chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=10)
        text_chunks = text_splitter.split_documents(text)

        # Create embeddings
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2", 
                                           model_kwargs={'device': 'cpu'})

        # Create vector store and storing document chunks using embedding model
        vector_store = FAISS.from_documents(text_chunks, embedding=embeddings)

    return vector_store
    

```

### Core Architecture Module: `archive_legacy/claude-sonnet-pdf-extraction/app.py`
```
from anthropic import Anthropic
import base64
import os
from dotenv import load_dotenv


# Load environment variables
load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    raise ValueError("ANTHROPIC_API_KEY not set in environment variables")
os.environ["API_KEY"] = ANTHROPIC_API_KEY

# While PDF support is in beta, you must pass in the correct beta header
client = Anthropic(default_headers={
    "anthropic-beta": "pdfs-2024-09-25"
  }
)
# For now, only claude-3-5-sonnet-20241022 supports PDFs
MODEL_NAME = "claude-3-5-sonnet-20241022"


# Start by reading in the PDF and encoding it as base64
file_name = "pdf_3.pdf"
with open(file_name, "rb") as pdf_file:
  binary_data = pdf_file.read()
  base64_encoded_data = base64.standard_b64encode(binary_data)
  base64_string = base64_encoded_data.decode("utf-8")


prompt = """
Please do the following:
1. Extract all the content from the pdf
"""
messages = [
    {
        "role": 'user',
        "content": [
            {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64_string}},
            {"type": "text", "text": prompt}
        ]
    }
]

def get_completion(client, messages):
    return client.messages.create(
        model=MODEL_NAME,
        max_tokens=2048,
        messages=messages
    ).content[0].text


completion = get_completion(client, messages)
print(completion)
```

### Core Architecture Module: `archive_legacy/scrapgraph/app.py`
```
import streamlit as st

from scrapegraphai.graphs import SmartScraperGraph, SearchGraph, SpeechGraph
from scrapegraphai.utils import prettify_exec_info

import utils
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(filename='app.log', encoding='utf-8', level=logging.INFO)


# Page configuration
st.set_page_config(page_title="Research Tool", page_icon="🌐")
st.header("`Research Tool`")
st.info("`I am an AI Agent equipped to provide insightful answers by delving into, comprehending, \
        and condensing information from various web sources.`")

# Hide Streamlit menu and footer
hide_streamlit_style = """
    <style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    </style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True) 

# Sidebar setup
st.sidebar.image("img/globe.png")

# Model selection
model_options = ['ollama', 'OpenAI', 'gemini-pro']
model_selection = st.sidebar.selectbox('Select Model', options=model_options)
model_type_selection = None
if model_selection == "ollama":
    model_type_options = ['llama3', 'mistral', 'phi3']
    model_type_selection = st.sidebar.selectbox('Select Model Type', options=model_type_options)
elif model_selection == "OpenAI":
    model_type_selection = "gpt-3.5-turbo"
elif model_selection == "gemini-pro":
    model_type_selection = "gemini-pro"

# Scraping options
scrap_options = ['SearchGraph', 'SmartScraperGraph', 'SpeechGraph']
scrap_selection = st.sidebar.selectbox('Select Scrap Option', options=scrap_options)

# User input handling
if scrap_selection in ["SmartScraperGraph", "SpeechGraph"]:
    source_text_input = st.sidebar.text_input("`Source:`", key='source')
    #source_text_input = st.sidebar.file_uploader("Upload file", accept_multiple_files=True)
else:
    source_text_input = None

# Step 2: Initialize Streamlit
#file_uploader, the data are copied to the Streamlit backend via the browser, 
#and contained in a BytesIO buffer in Python memory (i.e. RAM, not disk).
#pdf_files = st.sidebar.file_uploader("Upload file", accept_multiple_files=True)


# Container setup
reply_container = st.container()
container = st.container()

submit_button = None
user_input = None
with container:
    if scrap_selection in ["SmartScraperGraph", "SpeechGraph"] and source_text_input:
        with st.form(key='chat_form', clear_on_submit=True):
            user_input = st.text_input("`Ask a question:`", key='input')
            submit_button = st.form_submit_button(label='Send ⬆️')
    elif scrap_selection == "SearchGraph":
        with st.form(key='chat_form', clear_on_submit=True):
            user_input = st.text_input("`Ask a question:`", key='input')
            submit_button = st.form_submit_button(label='Send ⬆️')
    else:
        st.text("Source Input required")

    # Response generation
    if submit_button and user_input:
        result = utils.main(model_selection, model_type_selection, scrap_selection, user_input, source_text_input)    
        st.info(result)

```

### Core Architecture Module: `archive_legacy/scrapgraph/utils.py`
```
from scrapegraphai.graphs import SmartScraperGraph, SearchGraph, SpeechGraph
from scrapegraphai.utils import convert_to_csv, convert_to_json, prettify_exec_info

import logging
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(filename='app.log', encoding='utf-8', level=logging.INFO)


openai_key = os.getenv("OPENAI_APIKEY")
gemini_pro_key = os.getenv("GEMINI_PRO_API_KEY")

def smart_scraper_graph(prompt, source, config):
    smart_scraper_graph = SmartScraperGraph(
        prompt=prompt,
        source=source,
        config=config
    )
    result = smart_scraper_graph.run()
    # Run the graph
    result = smart_scraper_graph.run()
    graph_exec_info = smart_scraper_graph.get_execution_info()
    logger.info(prettify_exec_info(graph_exec_info))  
    result_format(result) 

    return result

def search_graph(prompt, config):
    search_graph = SearchGraph(
        prompt=prompt,
        config=config
    )
    # Run the graph
    result = search_graph.run() 
    graph_exec_info = search_graph.get_execution_info()
    logger.info(prettify_exec_info(graph_exec_info))  

    result_format(result) 
    return result

def speech_graph(prompt, config):
    speech_graph = SpeechGraph(
        prompt=prompt,
        config=config
    )
    # Run the graph
    result = speech_graph.run()
    graph_exec_info = speech_graph.get_execution_info()
    logger.info(prettify_exec_info(graph_exec_info))  

    return result

def result_format(result):
    convert_to_csv(result, "result")
    convert_to_json(result, "result")

def get_ollama_config(model_type, graph_type):
    base_config = {
        "llm": {
            "model": f"ollama/{model_type}",
            "temperature": 0,
            "format": "json",  # Ollama needs the format to be specified explicitly
            "base_url": "http://localhost:11434",  # set Ollama URL
        },
        "embeddings": {
            "model": "ollama/nomic-embed-text",
            "base_url": "http://localhost:11434",  # set Ollama URL
        },
        "verbose": True,
    }
    if graph_type == "SearchGraph":
        base_config["max_results"] = 5
    return base_config

def get_openai_config(model_type, openai_key):
    return {
        "llm": {
            "api_key": openai_key,
            "model": model_type,
        },
        "tts_model": {
            "api_key": openai_key,
            "model": "tts-1",
            "voice": "alloy"
        },
        "output_path": "audio_summary.mp3",
    }

def get_gemini_pro_config(graph_type, gemini_pro_key):
    base_config = {
        "llm": {
            "api_key": gemini_pro_key,
            "model": "gemini-pro",
        },
    }
    if graph_type == "SmartScraperGraph":
        base_config["embeddings"] = {
            "model": "ollama/nomic-embed-text",
            "base_url": "http://localhost:11434",  # set Ollama URL
        }
    elif graph_type == "SearchGraph":
        base_config.update({
            "temperature": 0,
            "streaming": True,
            "max_results": 5,
            "verbose": True,
        })
    return base_config

def main(model, model_type, graph_type, question, source=None):
    print(f"Model: {model}, Model Type: {model_type}, Type: {graph_type}, Question: {question}, Source: {source}")
    try:
        graph_config = None
        if model == "ollama":
            graph_config = get_ollama_config(model_type, graph_type)
        elif model == "OpenAI":
            graph_config = get_openai_config(model_type, openai_key)
        elif model == "gemini-pro":
            graph_config = get_gemini_pro_config(graph_type, gemini_pro_key)
        
        logger.info(f"Graph Config: {graph_config}")

        if graph_type == "SmartScraperGraph":
            result = smart_scraper_graph(question, source, graph_config)
        elif graph_type == "SearchGraph":
            result = search_graph(question, graph_config)
        elif graph_type == "SpeechGraph":
            result = speech_graph(question, graph_config)
        
        return result
    except Exception as e:
        raise e

#if __name__ == "__main__":
#    main('ollama', 'llama3', 'SearchGraph', 'List me all the traditional recipes from Chioggia', None )
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23** (2026-09-30): **Add agent-manager to Agentic AI & Orchestration**
  *Symptoms*: I'm the author of agent-manager, an Apache-2.0 terminal UI that runs coding-agent CLIs such as Claude Code, Codex and Gemini CLI side by side, each in its own persistent tmux session. This adds one line at the end of Agentic AI & Orchestration, in the same format as the YYLO entry above it. It runs on macOS and Linux, and on Windows inside WSL2. 

- **Issue #22** (2026-09-13): **Add YYLO to Agentic AI & Orchestration**
  *Symptoms*: Adds **YYLO** — an open-source command-line orchestrator for coding agents — to the `### 🤖 Agentic AI & Orchestration` section, following the format of the recently merged `agent-qa` and `Tura` entries.  **What it is:** YYLO is a command-line orchestrator for coding agents, repeatable workflows, and receipt-backed repository changes. It gives developers a quick agent loop and project operators typed task, validation, merge, and release-readiness boundaries: each task runs in a dedicated branch/worktree, and a merge queue owns risk-based review with hash-linked receipts.  **Why it fits this section:** it sits directly beside `Tura` (coding agent) and `agent-qa` (QA agent) as practical agentic tooling — the orchestration noun is literal ("orchestrator for coding agents").  **Project signals:** MIT-licensed, 58★, commits pushed daily since Jan 2026, installable from npm as [`@yylo/cli`](https://www.npmjs.com/package/@yylo/cli) (~780 downloads/month).  **Disclosure:** I'm on the YYLO team, and I prepared this PR with the help of an AI coding agent — happy to adjust the description or placement however you prefer. 

- **Issue #20** (2026-09-07): **Add agent-qa to Agentic AI & Orchestration**
  *Symptoms*: ## Summary  Adds agent-qa under **Agentic AI & Orchestration** as an source-available, self-improving QA agent for software teams. It gives coding agents natural-language web/mobile regression testing, persistent execution memory, an MCP server, and Agent Skills for authoring, execution, evidence-based triage, and debug fixes.  ## Validation  - Public repository and documentation links verified - Project was not already listed or proposed - Existing Markdown format preserved - `git diff --check` passes  Project disclosure: this submission is for agent-qa itself. Its current FSL-1.1-ALv2 license converts to Apache-2.0 after two years.  License note: Agent QA's current FSL-1.1-ALv2 release is source-available rather than OSI open source and converts to Apache-2.0 after two years.  Disclosure: I am affiliated with Agent QA and Vostride.

- **Issue #19** (2026-09-07): **Add StructEval evaluation benchmark**
  *Symptoms*: ## Summary  Adds StructEval as a numbered benchmark resource in the Phase 5 LLM Evaluation row.  StructEval is a TMLR 2025 benchmark for LLM generation and conversion across 2,035 examples, 18 text and visual structured-output formats, and 44 task types.  ## Fit  The roadmap has an explicit Optimization & Evaluation phase and an LLM Evaluation topic with an Additional Resources column. The entry follows that column's numbered-link format and adds a benchmark alongside the existing evaluation guide.  ## Validation  - Searched the default tree, repository history, all branch/tag/PR refs, pull requests, issues, reviews, comments, and discussions for duplicates or conflicting rules. - Verified the official repository and OpenReview publication links return HTTP 200. - Confirmed `GenAI_Roadmap.md` is a manually maintained source file and preserved the Markdown table's four-column structure. - Ran `git diff --check`.  ## Disclosure  I maintain StructEval and am submitting this project directly.  This pull request was prepared with assistance from OpenAI Codex. I reviewed and verified the final change. 

- **Issue #18** (2026-09-07): **Add Tura coding agent resource**
  *Symptoms*: Adds Tura under Agentic AI & Orchestration.  Tura is a local, open-source coding agent with CLI, TUI, web, and desktop interfaces for context-aware development workflows.  I am affiliated with Tura-AI. This is a single neutral listing addition; no performance claims.

- **Issue #14** (2026-05-27): **[Security] Exposed API credentials detected — please revoke immediately**
  *Symptoms*: ## [Security Notice] Exposed API Credentials Detected  Hello! This is a **responsible disclosure** notification.  An automated scanner found what appears to be an exposed **Google API** API key committed to this repository.  > This notification was sent to **help you**, before someone with bad intentions finds and uses your credentials. > API keys exposed in public repositories are actively targeted by malicious actors.  ---  ### What you should do RIGHT NOW  1. **Revoke the exposed key** immediately at the provider's dashboard:    - Anthropic: https://console.anthropic.com/settings/keys    - OpenAI: https://platform.openai.com/api-keys    - Google/Gemini: https://console.cloud.google.com/apis/credentials 2. **Generate a new key** to replace it 3. **Remove the key from git history** (removing the file is not enough):    ```bash    # Install git-filter-repo first: pip install git-filter-repo    git filter-repo --path <file-with-key> --invert-paths    git push --force    ``` 4. **Store keys safely** going forward — use a `.env` file and add it to `.gitignore`:    ```    echo '.env' >> .gitignore    ``` 5. **Prevent future leaks** with [gitleaks](https://github.com/gitleaks/gitleaks) pre-commit hooks  ---  ### Why removing the file is not enough  Git stores the full history. Even after you delete or edit the file, the old commit with the key is still accessible via `git log`. You **must** rewrite history or consider the key permanently compromised.  ---  _This is an automated re
  **Post-Mortem & Fix Analysis**:
  > Thanks. Those were expired and invalid keys. Already revoked when exposed.

- **Issue #13** (2026-05-27): **📋 Documentation Enhancement Suggestion**
  *Symptoms*: ## 📋 Documentation Enhancement Suggestion  > This observation was generated by [Crovia](https://croviatrust.com) — the AI transparency observation layer. > > Crovia does **not** accuse or judge. It observes publicly available information and suggests improvements.  ---  ### 📊 Quick Stats  | Metric | Value | |--------|-------| | Source | github | | Downloads | N/A | | Likes | N/A | | Last Updated | 2026-05-15 |  ---  ### 💻 Ready-to-Use Code  ```python # Clone the repository git clone https://github.com/genieincodebottle/generative-ai  # Check README for installation instructions ```  ---  ### 📚 Citation  If you use this model, please cite:  ```bibtex @misc{genieincodebottle_generative_ai_2026,   author = {genieincodebottle},   title = {genieincodebottle/generative-ai},   year = {2026},   url = {https://github.com/genieincodebottle/generative-ai},   note = {Accessed via CROVIA transparency registry} } ```  ---  ### 🔎 README Observations (public)  > Checklist items are based solely on what we could observe in the public README.  - [x] README present - [x] License mentioned in README - [ ] Training data mentioned in README - [ ] Evaluation/benchmarks mentioned - [ ] Limitations/risks mentioned - [x] Usage/installation mentioned  ---  ### 🔍 Training Data Transparency  **Training Data Status (Observed):** Not observed in README  We did not find explicit training data wording in the public README. This is an observation, not a compliance claim.   ---  *Enhancement generated by
  **Post-Mortem & Fix Analysis**:
  > NA

- **Issue #11** (2026-04-11): **Genai Workflow**
  *Symptoms*: A simplified generative AI workflow showing how a user query is processed, enriched with context through retrieval and embeddings, orchestrated, and passed to an AI model to generate the final answer.

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

### Incident Patch 1: `2b1ce817` (2026-09-07)
**Commit Message**: Refresh the platform counts and fix a wrong badge link

The track, module, project and interview-module counts had drifted below
what the platform now carries, and one social badge pointed at another
account.

**File**: `GenAI_Roadmap.md` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ Each phase is split by week and builds progressively.
 | Model Context Protocol (MCP) |[YT- MCP Clearly Explained](https://www.youtube.com/watch?v=7j_NE6Pjv-E) <br> [YT- MCP Crash Course for Python Developers](https://www.youtube.com/watch?v=5xqFjh56AwM) <br> [Official Claude Doc](https://modelcontextprotocol.io/introduction) <br> [GitHub-Awsome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers) <br> [MCP Protocol - interactive](https://aimlcompanion.ai/module/aiAgents/mcpProtocol?utm_source=github&utm_medium=roadmap&utm_campaign=tools)||
 | Agent2Agent Protocol (A2A) |[Video - Demo](https://storage.googleapis.com/gweb-developer-goog-blog-assets/original_videos/A2A_demo_v4.mp4) <br> [Specification](https://github.com/google/A2A) <br> [GitHub](https://github.com/google/A2A) <br> [A2A Protocol - interactive](https://aimlcompanion.ai/module/aiAgents/a2aProtocol?utm_source=github&utm_medium=roadmap&utm_campaign=tools)||
 | AI Coding Assistants |[Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview), [Gemini CLI](https://blog.google/technology/developers/introducing-gemini-cli-open-source-ai-agent/), [Cursor](https://www.cursor.com/), [Bolt](https://bolt.new/), [Lovable](https://lovable.dev/), [Replit](https://replit.com/), [V0](https://v0.dev/) ||
-| Learning Platform  |[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=roadmap&utm_campaign=tools) - Interactive AI/ML learning platform with 22 tracks, 300+ modules, visualizations, quizzes, and hands-on coding (ML fundamentals → LLMs → MLOps)||
+| Learning Platform  |[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=roadmap&utm_campaign=tools) - Interactive AI/ML learning platform with 28 tracks, 400+ modules, visualizations, quizzes, and hands-on coding (ML fundamentals → LLMs → MLOps)||
 
 ### 💡 GenAI Use Cases
 
```

**File**: `README.md` (modified, +8/-8)
```diff
@@ -6,7 +6,7 @@
    <a target="_blank" href="https://www.youtube.com/@genieincodebottle"><img src="https://img.shields.io/badge/YouTube-11.5K-blue"></a>&nbsp;
    <a target="_blank" href="https://github.com/genieincodebottle/generative-ai"><img src="https://img.shields.io/github/stars/genieincodebottle/generative-ai"></a>&nbsp;
    <a target="_blank" href="https://www.linkedin.com/in/rajesh-srivastava"><img src="https://img.shields.io/badge/style--5eba00.svg?label=LinkedIn&logo=linkedin&style=social"></a>&nbsp;
-   <a target="_blank" href="https://www.instagram.com/genieincodebottle/"><img src="https://img.shields.io/badge/56K-C13584?style=round-square&labelColor=C13584&logo=instagram&logoColor=white&link=https://www.instagram.com/eduardopiresbr/"></a>&nbsp;
+   <a target="_blank" href="https://www.instagram.com/genieincodebottle/"><img src="https://img.shields.io/badge/56K-C13584?style=round-square&labelColor=C13584&logo=instagram&logoColor=white&link=https://www.instagram.com/genieincodebottle/"></a>&nbsp;
    <a target="_blank" href="https://medium.com/@raj-srivastava"><img src="https://img.shields.io/badge/Medium-12100E?style=round-square&style=for-the-badge&logo=medium"></a>&nbsp;
     <a target="_blank" href="https://x.com/zero2nn"><img src="https://img.shields.io/twitter/url/https/twitter.com/cloudposse.svg?style=social&label=%20%40zero2nn"></a>
 </div>
@@ -16,7 +16,7 @@
 
 I built **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=intro)** - every AI, ML, GenAI and Agentic AI concept covered here, taught visually with animated diagrams, quizzes, and hands-on Python. The guides below are the **full, continuously-updated versions** of the reference material in this repo.
 
-**300+ modules • 22 tracks • 9 real-world projects • free to start**
+**400+ modules • 28 tracks • 23 real-world projects • free to start**
 
 [![Try AI-ML Companion](https://img.shields.io/badge/Try%20AI--ML%20Companion-Live%20App-blue?style=for-the-badge)](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=cta)
 <br><br/>
@@ -36,7 +36,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 ## 📖 Documentation & Learning Resources
 
 ### 🎯 Getting Started
-- **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Interactive AI/ML learning platform with 22 tracks, 300+ modules, visualizations, quizzes, and hands-on coding (ML fundamentals → LLMs → MLOps)
+- **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Interactive AI/ML learning platform with 28 tracks, 400+ modules, visualizations, quizzes, and hands-on coding (ML fundamentals → LLMs → MLOps)
 - **[GenAI Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Your complete learning path for GenAI (interactive) &nbsp;·&nbsp; [markdown](./GenAI_Roadmap.md)
 - **[AI/ML Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Comprehensive AI/ML learning  &nbsp;·&nbsp; [PDF](./docs/ai_ml_roadmap.pdf)
 
@@ -60,7 +60,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 
 ### 💼 Career & Interview Preparation
 
-**[Interview Q&A track](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=interview)** - 13 always-current Q&A modules across ML, GenAI, and Agentic AI (free preview questions, full sets with Pro). The PDFs below are downloadable companions to these live modules.
+**[Interview Q&A track](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=interview)** - 20 always-current Q&A modules across ML, GenAI, and Agentic AI (free preview questions, full sets with Pro). The PDFs below are downloadable companions to these live modules.
 
 - **[GenAI & Transformers 
```

---

### Incident Patch 2: `7a0af810` (2026-09-06)
**Commit Message**: Fix two prompt-engineering notebooks that could not run

**File**: `genai-usecases/embedding-models/README.md` (modified, +4/-3)
```diff
@@ -128,9 +128,10 @@ Two rules that matter more than the choice itself:
   single highest-leverage thing to change in a RAG pipeline.
 - **The vector store is in memory.** It disappears when the kernel restarts,
   so every run re-embeds the whole article.
-- **Only the Google path is verified end to end** in this revision. The OpenAI
-  and HuggingFace sections are correct against their current APIs but were not
-  run - no key, and no GPU.
+- **The Google and HuggingFace paths are verified end to end**; the local
+  `nomic-embed-text-v1.5` returns 768 dimensions on CPU. The OpenAI section
+  is correct against the current API but could not be executed - the key
+  available had no credit.
 
 ## 7. Further reading
 
```

**File**: `genai-usecases/llm-providers/README.md` (modified, +4/-4)
```diff
@@ -145,10 +145,10 @@ through `message_text()` instead of touching `.content` directly.
 - **Cross-provider comparison here is qualitative.** The apps make it easy to
   ask the same question of four providers; they do not score the answers, and
   four samples is not a benchmark.
-- **Only the Gemini app was booted end to end in this revision.** The Groq,
-  OpenAI and Anthropic paths were verified by install, import, and static
-  check against each vendor's current model list - no key for them was
-  available.
+- **The Gemini, Groq, OpenAI and Anthropic apps were all booted end to end**
+  in this revision. Booting proves wiring, imports and the key guard - it
+  does not prove every model in each dropdown answers, and the OpenAI key
+  used had no credit to spend on a real call.
 - **Paid providers cost real money per call.** The apps have no spend guard.
 - **Keys live in a plaintext `.env`.** Fine locally; not how you would deploy
   this.
```

**File**: `genai-usecases/prompt-engineering/README.md` (modified, +11/-3)
```diff
@@ -64,6 +64,11 @@ provider or model is a one-line edit:
 llm = ChatGroq(model="openai/gpt-oss-20b", temperature=0.5)
 ```
 
+One exception: `automatic_reasoning_and_tool_use.ipynb` uses
+**`qwen/qwen3.6-27b`**. ART teaches a *text* tool protocol - the model writes
+JSON and the notebook parses it - and a tool-calling-native model emits a real
+tool call instead, which the API then rejects because no tools were bound.
+
 `prompt_engineering_main.ipynb` is the multi-provider notebook: it shows the
 same techniques against Groq, Gemini, OpenAI and Claude, with each provider in
 its own cell.
@@ -135,6 +140,8 @@ that you are comparing single samples of a non-deterministic system.
 | `model_not_found` / `model_decommissioned` on Groq | a retired model ID | use `openai/gpt-oss-20b`; see the note above |
 | `401 Invalid API Key` | key pasted with a newline | re-copy from the provider console |
 | `429 Too Many Requests` | free-tier rate limit | wait, or lower the sample count in Self-Consistency |
+| `400 Tool choice is none, but model called a tool` | a tool-calling-native model against a text tool protocol | use `qwen/qwen3.6-27b`, as ART does |
+| A cell returns success but prints nothing | some models put everything in a reasoning field | check `response.additional_kwargs`; try another model |
 | `ImportError: langchain_groq` | first cell skipped | run the install cell |
 | `ImportError` for openai / anthropic / google | that provider is optional | install only the provider you use |
 | Ollama notebook cannot connect | Ollama not running | `ollama serve`, then `ollama pull llama3.2` |
@@ -151,9 +158,10 @@ that you are comparing single samples of a non-deterministic system.
   next step, and it is the step most people skip.
 - **Results are non-deterministic** at any temperature above 0, and several
   notebooks deliberately use a higher temperature.
-- **The Groq path is unverified against a live key in this revision.** The
-  model ID was updated to the vendor's stated replacement for a
-  decommissioned model; the code around it is unchanged.
+- **All 14 Groq notebooks were run end to end against a live key.** Two
+  needed real fixes to get there, and one uses `qwen/qwen3.6-27b` rather
+  than `gpt-oss`: ART teaches a *text* tool protocol, and a tool-calling
+  native model emits a real tool call that the API then rejects.
 - **Cost is not shown.** Self-Consistency and Tree-of-Thoughts issue many
   calls per question. On a free tier that is a rate limit rather than a bill,
   but the arithmetic is the same.
```

**File**: `genai-usecases/prompt-engineering/automatic_reasoning_and_tool_use.ipynb` (modified, +10/-1)
```diff
@@ -146,7 +146,11 @@
    "outputs": [],
    "source": [
     "llm = ChatGroq(\n",
-    "    model=\"openai/gpt-oss-20b\",\n",
+    "    # ART here teaches a TEXT protocol: the model writes JSON, the code\n",
+    "    # below parses it. Tool-calling-native models emit a real tool call\n",
+    "    # instead and Groq rejects it, so use a model that follows the text\n",
+    "    # protocol.\n",
+    "    model=\"qwen/qwen3.6-27b\",\n",
     "    temperature=0.5\n",
     ")"
    ]
@@ -194,6 +198,11 @@
     "def art_response(task):\n",
     "    chain = art_prompt | llm\n",
     "    raw_response = chain.invoke({\"task\": task}).content\n",
+    "\n",
+    "    # Reasoning-capable models wrap their scratchpad in <think>...</think>.\n",
+    "    # Left in, the closing tag leaks into the parsed output.\n",
+    "    if \"</think>\" in raw_response:\n",
+    "        raw_response = raw_response.split(\"</think>\", 1)[1]\n",
     "    # Process the response to use tools\n",
     "    lines = raw_response.split(\"\\n\")\n",
     "    processed_response = []\n",
```

**File**: `genai-usecases/prompt-engineering/recursive_prompting.ipynb` (modified, +8/-4)
```diff
@@ -192,13 +192,17 @@
     "                (\"human\", \"\"\"Based on these questions:\n",
     "                    {questions}\n",
     "\n",
-    "                    Generate three more detailed follow-up questions. Current depth: {max_depth}\"\"\",\n",
+    "                    Generate three more detailed follow-up questions. Current depth: {depth} of {max_depth}\"\"\",\n",
     "                ),\n",
     "            ]\n",
     "        )\n",
     "        recursive_chain = recursive_prompt | llm\n",
-    "        questions = recursive_chain.invoke({\"questions\": questions}).content\n",
-    "        questions = llm.invoke(recursive_prompt.format_prompt().to_messages()).content\n",
+    "        # Each round's output becomes the next round's input - that is the\n",
+    "        # whole pattern. The second call here re-formatted the prompt with no\n",
+    "        # variables (KeyError) and threw away the result of the first.\n",
+    "        questions = recursive_chain.invoke(\n",
+    "            {\"questions\": questions, \"depth\": depth, \"max_depth\": max_depth}\n",
+    "        ).content\n",
     "\n",
     "    return questions"
    ]
@@ -229,7 +233,7 @@
    "source": [
     "topic = \"artificial intelligence\"\n",
     "response = recursive_prompting(topic)\n",
-    "print(response.content)"
+    "print(response)"
    ]
   },
   {
```

---

### Incident Patch 3: `1d0d353d` (2026-09-06)
**Commit Message**: Refactor projects to UI -> FastAPI -> services; fix retired model IDs

**File**: `genai-usecases/advance-rag/README.md` (modified, +15/-15)
```diff
@@ -1,4 +1,4 @@
-## 📚 Advance RAG
+## Advance RAG
 
 ![alt text](images/rag.gif)
 
@@ -14,7 +14,7 @@ When you send a query:
 This makes RAG essential for building reliable GenAI applications. As queries and data grow in complexity, advanced RAG techniques, like agentic RAG, Graph RAG, Corrective RAG, Reranking RAG etc further improve accuracy, adaptability & relevance.
 
 ---
-## 🔑 Core Components of RAG
+## Core Components of RAG
 
    - **Knowledge Base**: External data source (e.g. documents, databases) that the system relies on.
 
@@ -27,7 +27,7 @@ This makes RAG essential for building reliable GenAI applications. As queries an
    - **Language Model (LLM)**: Generates responses using both retrieved data and the query.
 
 ---
-## 📚 Super Handy Resources
+## Super Handy Resources
 
 | Resource | Link | Description |
 |----------|------|-------------|
@@ -37,7 +37,7 @@ This makes RAG essential for building reliable GenAI applications. As queries an
 | **Uber's Usecase -> Enhanced Agentic-RAG: What If Chatbots Could Deliver Near-Human Precision?** | [Blog](https://lnkd.in/eGz5a9xm) | Genie is Uber's internal on-call copilot in Slack, delivering real-time, cited answers from internal docs and boosting on-call engineers' and SMEs' productivity by handling common queries efficiently. |
 
 ---
-## 🗺️ Recommended Learning Path
+## Recommended Learning Path
 
 If you are new to RAG, work through the techniques in this order to build understanding progressively:
 
@@ -56,13 +56,13 @@ If you are new to RAG, work through the techniques in this order to build unders
 > **Tip:** Refer to the [RAG Decision Flow PDF](./docs/advance-rag-decision-flow-chart.pdf) to quickly choose the right technique for your use case.
 
 ---
-## 🧪 Exploring Advanced RAG
+## Exploring Advanced RAG
 
 **A. Try Graph RAG**
 
 Knowledge-graph based retrieval using LangGraph, HuggingFace embeddings, and ChromaDB. Understands relationships between concepts in your documents — not just keyword matches.
 
-👉 [Full setup instructions →](graph-rag/README.md)
+[Full setup instructions →](graph-rag/README.md)
 
 ```bash
 # After completing setup in graph-rag/README.md:
@@ -75,7 +75,7 @@ streamlit run streamlit_app.py
 
 Multi-agent workflow with five specialized agents (Planner, Retriever, Research, Synthesizer, Validator). Uses LangGraph for orchestration and optionally Tavily for live web search.
 
-👉 [Full setup instructions →](agentic-rag/README.md)
+[Full setup instructions →](agentic-rag/README.md)
 
 ```bash
 # After completing setup in agentic-rag/README.md:
@@ -90,7 +90,7 @@ Processes both PDF text and images. Uses Gemini Vision to describe images and st
 
 > **Entry point:** Always run `streamlit_app.py` — not `app.py`. The `app.py` file is the backend and is not meant to be executed directly.
 
-👉 [Full setup instructions →](multimodal-rag/README.md)
+[Full setup instructions →](multimodal-rag/README.md)
 
 ```bash
 # After completing setup in multimodal-rag/README.md:
@@ -103,7 +103,7 @@ streamlit run streamlit_app.py
 
 Semantic search over code repositories using Tree-sitter AST parsing. Understands code structure — functions, classes, imports — not just raw text.
 
-👉 [Full setup instructions →](code-search-rag/README.md)
+[Full setup instructions →](code-search-rag/README.md)
 
 ```bash
 # After completing setup in code-search-rag/README.md:
@@ -114,12 +114,12 @@ streamlit run app.py
 ---
 **E. Try Advanced RAG Techniques in Google Colab**
 
-> ⚠️ **Different tech stack from the Streamlit apps (Section F) below:**
+> **Different tech stack from the Streamlit apps (Section F) below:**
 > The notebooks run on **Groq API** (free LLMs) + **HuggingFace Embeddings** + **FAISS**.
 > You will need a free [Groq API key](https://console.groq.com/keys) and a [HuggingFace token](https://huggingface.co/settings/tokens) — **not** a Google API key.
 > Each notebook has an **Open in Colab** button at the top — click it to run without any local setup.
 
-👉 [No
```

**File**: `genai-usecases/advance-rag/agentic-rag/.streamlit/config.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Streamlit prints a "Help agents write better Streamlit apps / install the
+# official Streamlit skills" advert on every start. It is Streamlit's own
+# promo, not part of this project, and it is noise for someone following the
+# README for the first time. This switches it off.
+[logger]
+hideWelcomeMessage = true
+
+[browser]
+gatherUsageStats = false
```

**File**: `genai-usecases/advance-rag/agentic-rag/README.md` (modified, +196/-281)
```diff
@@ -1,298 +1,213 @@
-# Agentic RAG System
+# Agentic RAG
 
+> **Learn how to build this project step-by-step on [AI-ML Companion](https://aimlcompanion.ai/)**. Interactive ML learning platform with guided walkthroughs, architecture decisions, and hands-on challenges.
 
-![Agentic RAG](https://img.shields.io/badge/Agentic-RAG-blue)
-[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://www.python.org/downloads/)
-![Streamlit](https://img.shields.io/badge/Streamlit-UI_Framework-ff4b4b)
-![Gemini LLM](https://img.shields.io/badge/Gemini-LLM_&_Embedding_Model-00bfa5)
-[![LangChain](https://img.shields.io/badge/LangChain-AI_Framework-0e76a8.svg)](https://langchain.com/)
-[![LangGraph](https://img.shields.io/badge/LangGraph-Agent_Framework-f39c12.svg)](https://langchain.com/langgraph)
-![ChromaDB](https://img.shields.io/badge/Chroma-Vector_DB-9b59b6)
+![Python](https://img.shields.io/badge/Python-3.10+-blue)
+![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688)
+![LangGraph](https://img.shields.io/badge/LangGraph-0.6+-1f6feb)
+![Tests](https://img.shields.io/badge/tests-21%20passing-brightgreen)
 
+**Plain RAG retrieves once and answers. This one decides how hard the question
+is first, and only then chooses what to do about it.**
 
-![Agentic RAG](./images/agentic-rag.png)
+---
 
-An <strong>Agentic Retrieval-Augmented Generation (RAG)</strong> system built with LangChain, LangGraph & Google's Gemini LLM. This system implements advanced multi-agent workflows for intelligent question answering with adaptive reasoning strategies.
+## 1. The problem
 
-## 📁 File Overview
+"What are the three principal risks, and which are rated HIGH?" and
+"What is the mitigation budget?" are not the same kind of question, but plain
+RAG treats them identically: embed, fetch `k` chunks, generate.
 
-| File | Role |
-|------|------|
-| `agentic_rag_system.py` | Core backend — defines all five agents, the LangGraph workflow, document loading, and query processing logic |
-| `streamlit_app.py` | Frontend UI — Streamlit web application that wraps `agentic_rag_system.py` and exposes all features through a browser interface |
-| `requirements.txt` | All Python dependencies |
-| `.env.example` | Template for environment variables — copy to `.env` and add your keys |
+A pipeline that plans first can behave differently. Five agents run in order:
 
-## ✨ Features
+| Agent | Decides |
+|---|---|
+| **Planning** | how complex the question is, and whether to split it into sub-queries |
+| **Retrieval** | which chunks to pull from your documents |
+| **Research** | whether the documents are enough, or the web is needed |
+| **Synthesis** | how to combine document and web context into one answer |
+| **Validation** | whether the result is good enough, and what confidence to report |
 
-- 🧠 **Multi-Agent Architecture**
-   - **Planner Agent**: Analyzes queries and creates intelligent execution plans
-   - **Retriever Agent**: Performs semantic document retrieval from vector database
-   - **Research Agent**: Conducts web searches for current information
-   - **Synthesizer Agent**: Combines information from multiple sources
-   - **Validator Agent**: Validates and refines final answers
+The execution log in the UI shows each decision, which is the point of the
+project: you can see *why* it answered the way it did.
 
-   ```
-   Planner Agent → Retriever Agent → Research Agent → Synthesizer Agent → Validator Agent
-   ```
+## 2. The shape of the fix
 
-- 🔮 **Advanced Capabilities**
-   - **Adaptive Query Planning**: Automatically detects query complexity and selects optimal strategies
-   - **Multi-Format Document Support**: Handles PDF, TXT, and CSV file formats
-   - **Web-Augmented RAG**: Combines document knowledge with real-time web search via Tavily
-   - **Confidence Scoring**: Provides transparency in answer reliability
-   - **Source Tracking**: Detailed citation of information sources
-
-### 🔧 Tech Stack
-
-- **Python**: Pr
```

**File**: `genai-usecases/advance-rag/agentic-rag/api/main.py` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+"""FastAPI routing layer for the Agentic RAG system."""
+
+from __future__ import annotations
+
+from fastapi import FastAPI, File, Form, HTTPException, UploadFile
+from fastapi.middleware.cors import CORSMiddleware
+from pydantic import BaseModel, Field
+
+from services import config
+from services.system_manager import IngestError, SystemNotReady, Upload, manager
+
+app = FastAPI(
+    title="Agentic RAG API",
+    description=(
+        "A multi-agent RAG pipeline: plan, retrieve, research the web, "
+        "synthesise, validate. The Streamlit UI in `ui/` is a client of this API."
+    ),
+    version="1.0.0",
+)
+
+app.add_middleware(
+    CORSMiddleware,
+    allow_origins=["*"],
+    allow_credentials=False,
+    allow_methods=["*"],
+    allow_headers=["*"],
+)
+
+
+class HealthResponse(BaseModel):
+    status: str
+    google_key: bool
+    tavily_key: bool
+    configured: bool
+
+
+class ModelsResponse(BaseModel):
+    llm_models: list[str]
+    embedding_models: list[str]
+    web_search_available: bool
+
+
+class ConfigureRequest(BaseModel):
+    llm_model: str = "gemini-flash-latest"
+    embedding_model: str = "models/gemini-embedding-001"
+    temperature: float = Field(0.1, ge=0.0, le=1.0)
+    max_tokens: int = Field(8192, ge=256, le=32768)
+    chunk_size: int = Field(1000, ge=200, le=8000)
+    chunk_overlap: int = Field(200, ge=0, le=2000)
+    k_retrieval: int = Field(8, ge=1, le=50)
+    max_iterations: int = Field(10, ge=1, le=50)
+    confidence_threshold: float = Field(0.7, ge=0.0, le=1.0)
+    enable_web_search: bool = True
+    max_web_results: int = Field(5, ge=1, le=20)
+
+
+class QueryRequest(BaseModel):
+    question: str = Field(..., min_length=1, max_length=4000)
+    thread_id: str | None = None
+
+
+@app.get("/health", response_model=HealthResponse, tags=["meta"])
+def health() -> HealthResponse:
+    return HealthResponse(
+        status="ok",
+        google_key=config.has_google_key(),
+        tavily_key=config.has_tavily_key(),
+        configured=manager.is_configured,
+    )
+
+
+@app.get("/models", response_model=ModelsResponse, tags=["meta"])
+def models() -> ModelsResponse:
+    return ModelsResponse(
+        llm_models=config.LLM_MODELS,
+        embedding_models=config.EMBEDDING_MODELS,
+        # Web search is optional. Saying so up front is better than a
+        # research step that quietly returns nothing.
+        web_search_available=config.has_tavily_key(),
+    )
+
+
+@app.get("/status", tags=["meta"])
+def status() -> dict:
+    return manager.status()
+
+
+@app.post("/configure", tags=["system"])
+def configure(request: ConfigureRequest) -> dict:
+    """Build or rebuild the system. Indexed documents in Chroma survive this."""
+    if request.chunk_overlap >= request.chunk_size:
+        raise HTTPException(
+            status_code=422,
+            detail="chunk_overlap must be smaller than chunk_size.",
+        )
+    try:
+        manager.configure(**request.model_dump())
+    except SystemNotReady as exc:
+        raise HTTPException(status_code=503, detail=str(exc)) from exc
+    except Exception as exc:
+        raise HTTPException(
+            status_code=502, detail=f"Could not initialize the system: {exc}"
+        ) from exc
+    return manager.status()
+
+
+@app.post("/documents", tags=["documents"])
+async def upload_documents(files: list[UploadFile] = File(...)) -> dict:
+    uploads = [
+        Upload(filename=f.filename or "upload.pdf", content=await f.read())
+        for f in files
+    ]
+    try:
+        result = manager.load_documents(uploads)
+    except IngestError as exc:
+        raise HTTPException(status_code=422, detail=str(exc)) from exc
+    except SystemNotReady as exc:
+        raise HTTPException(status_code=503, detail=str(exc)) from exc
+    return {"filenames": result.filenames, "loaded": result.loaded}
+
+
+@app.post("/query", tags=["query"])
+def query(request: QueryRequest) -> dict:
+    """Run the full ag
```

**File**: `genai-usecases/advance-rag/agentic-rag/docs/img/architecture.svg` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 562" role="img" aria-label="Agentic RAG: three layers, one direction. UI calls the API over HTTP; the API calls the service layer.">
+  <title>Agentic RAG: three layers, one direction</title>
+  <desc>Agentic RAG: three layers, one direction. UI calls the API over HTTP; the API calls the service layer.</desc>
+  <rect x="0" y="0" width="760" height="562" rx="10" fill="#f7f8fa"/>
+  <style>
+    .t  { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; fill: #1b2430; }
+    .h  { font-size: 15px; font-weight: 600; }
+    .s  { font-size: 12.5px; fill: #5b6675; }
+    .m  { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px; fill: #1b2430; }
+    .ms { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 11.5px; fill: #5b6675; }
+    .lbl{ font-size: 11.5px; fill: #5b6675; }
+    .cap{ font-size: 12px; font-weight: 600; letter-spacing: .06em; }
+  </style>
+  <defs>
+    <marker id="arw" viewBox="0 0 10 10" refX="9" refY="5"
+            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
+      <path d="M 0 0 L 10 5 L 0 10 z" fill="#5b6675"/>
+    </marker>
+  </defs>
+
+  <text class="t h" x="24" y="34">Agentic RAG: three layers, one direction</text>
+  <text class="t s" x="24" y="54">Five agents run behind one endpoint. The UI never sees a chain.</text>
+
+  <rect x="24" y="74" width="712" height="106" rx="8"
+        fill="#e8f0fe" stroke="#4c7fd4" stroke-width="1.5"/>
+  <text class="t cap" x="44" y="100" fill="#4c7fd4">UI</text>
+  <text class="t m"   x="44" y="124">ui/app.py</text>
+  <text class="t ms" x="44" y="152">sidebar, upload, answer</text>
+  <text class="t ms" x="238" y="152">query plan, execution log</text>
+  <text class="t ms" x="44" y="170">requests only</text>
+
+  <line x1="380" y1="180" x2="380" y2="228" stroke="#5b6675" stroke-width="1.6" marker-end="url(#arw)"/>
+  <text class="t lbl" x="392" y="207">HTTP</text>
+  <rect x="24" y="232" width="712" height="106" rx="8"
+        fill="#e6f4ec" stroke="#3f9d6b" stroke-width="1.5"/>
+  <text class="t cap" x="44" y="258" fill="#3f9d6b">ROUTING</text>
+  <text class="t m"   x="44" y="282">api/main.py</text>
+  <text class="t ms" x="44" y="310">GET</text>
+  <text class="t ms" x="238" y="310">/models  /status</text>
+  <text class="t ms" x="44" y="328">POST</text>
+  <text class="t ms" x="238" y="328">/configure  /documents  /query</text>
+
+  <line x1="380" y1="338" x2="380" y2="386" stroke="#5b6675" stroke-width="1.6" marker-end="url(#arw)"/>
+  <text class="t lbl" x="392" y="365">function calls</text>
+  <rect x="24" y="390" width="712" height="144" rx="8"
+        fill="#fdf0e3" stroke="#d98a34" stroke-width="1.5"/>
+  <text class="t cap" x="44" y="416" fill="#d98a34">BUSINESS LOGIC</text>
+  <text class="t m"   x="44" y="440">services/</text>
+  <text class="t ms" x="44" y="468">agentic_rag_system.py</text>
+  <text class="t ms" x="238" y="468">plan > retrieve > research > synthesise > validate</text>
+  <text class="t ms" x="44" y="486">system_manager.py</text>
+  <text class="t ms" x="238" y="486">one configured system, upload validation</text>
+  <text class="t ms" x="44" y="504">config.py</text>
+  <text class="t ms" x="238" y="504">the only file that names a model</text>
+
+  <text class="t lbl" x="44" y="526" font-style="italic">message_text() flattens Gemini 3 content blocks - .content is a list, not a str</text>
+
+</svg>
```

---

### Incident Patch 4: `18c82d5e` (2026-08-24)
**Commit Message**: Fix heading formatting in README.md

**File**: `README.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 - **[AI/ML Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Comprehensive AI/ML learning  &nbsp;·&nbsp; [PDF](./docs/ai_ml_roadmap.pdf)
 
 
-### 🧠 Core Concepts & s
+### 🧠 Core Concepts
 - **[Vector Embeddings ](./docs/vector-embeddings-guide.pdf)** - Understanding vector representations (PDF)
 - **[Prompt Engineering](./docs/prompt_engineering.ipynb)** - Crafting effective prompts (notebook)
 - **[AI Patterns](./docs/ai-patterns.pdf)** - Top 25 AI design patterns (PDF)
```

---

### Incident Patch 5: `f152e4ce` (2026-08-05)
**Commit Message**: Fix blog link formatting in GenAI_Roadmap.md

**File**: `GenAI_Roadmap.md` (modified, +4/-1)
```diff
@@ -19,8 +19,11 @@
 <br>
 Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated with the latest GenAI resources :)
 <br>
-![New](https://img.shields.io/badge/NEW-brightgreen) [Blog: Inside a Production Multi-Agent GenAI System](https://aimlcompanion.ai/blog/production-multi-agent-genai-architecture-2026?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
+
+![New](https://img.shields.io/badge/NEW-brightgreen) [Blog - Inside a Production Multi-Agent GenAI System](https://aimlcompanion.ai/blog/production-multi-agent-genai-architecture-2026?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
+
 <br>
+
 ### 🔗 Quick Links
  [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) | [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI Blogs](https://aimlcompanion.ai/blog?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
 
```

---

### Incident Patch 6: `d57cdc99` (2026-08-04)
**Commit Message**: Fix broken link in README.md for AI Blogs

**File**: `README.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ I built **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medi
 
 [![Try AI-ML Companion](https://img.shields.io/badge/Try%20AI--ML%20Companion-Live%20App-blue?style=for-the-badge)](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=cta)
 
-**Popular guides:** [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Full Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=popular) • [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) • [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) • [AI Blogs]([https://aimlcompanion.ai/ml-visualization](https://aimlcompanion.ai/blog?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
+**Popular guides:** [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Full Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=popular) • [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) • [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) • [AI Blogs](https://aimlcompanion.ai/blog?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
 
 <br>
 Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated with the latest GenAI resources :)
```

---

### Incident Patch 7: `c34372a7` (2026-08-03)
**Commit Message**: Fix broken link in GenAI Roadmap

**File**: `GenAI_Roadmap.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 
 
 ### 🔗 Quick Links
- [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs(https://github.com/genieincodebottle/generative-ai/tree/main/docs)]
+ [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs)
 
 ### 📦 Comprehensive Prep Resources
 
```

---

### Incident Patch 8: `2a49b486` (2026-03-26)
**Commit Message**: docs: fix learner friction across all genai-usecases READMEs

- Fix wrong clone path in text-to-sql (advance-rag\text-to-sql -> text-to-sql)
- Fix wrong clone path in content-moderation-system (remove agentic-ai\ prefix)
- Rewrite llama-4-multi-function-app README with features, API keys, troubleshooting
- Add "No API keys needed" callout to chatbot-with-memory
- Highlight free-tier providers in llm-providers (Groq/Gemini vs paid OpenAI/Claude)
- Add "you only need ONE key" tip to text-to-sql
- Remove outdated inline requirements from llm-providers, prompt-guard, graph-qa, mcp
- Clarify two-terminal setup in mcp/web_search_mcp
- Add missing venv step to content-moderation-system backend setup
- Fix frontend path in content-moderation-system
- Clarify Docker requirement in conversational-analytics
- Add README for ai-patterns (23 notebooks, pattern descriptions)
- Add README for embedding-models (quick start, Colab link)

**File**: `genai-usecases/ai-patterns/README.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# AI Reasoning Patterns
+
+23 hands-on Jupyter notebooks demonstrating advanced AI reasoning and agentic patterns. Each notebook is self-contained and runs on Google Colab (no local setup needed).
+
+## Quick Start
+
+Click any notebook below to open it in Google Colab, or run locally with `jupyter notebook`.
+
+## Patterns
+
+| # | Pattern | Notebook | Description |
+|---|---------|----------|-------------|
+| 1 | Chain-of-Thought | `Chain-of-Thought.ipynb` | Step-by-step reasoning before answering |
+| 2 | Tree of Thought | `Tree-of-Thought.ipynb` | Explore multiple reasoning branches |
+| 3 | Graph of Thoughts | `Graph-of-Thoughts.ipynb` | Non-linear reasoning with graph structure |
+| 4 | Skeleton of Thought | `Skeleton-of-Thought.ipynb` | Generate outline first, then fill in details |
+| 5 | Chain of Verification | `Chain-of-Verification.ipynb` | Verify answers with follow-up questions |
+| 6 | ReAct | `ReAct.ipynb` | Reason + Act loop with tool use |
+| 7 | Reflexion | `Reflexion.ipynb` | Self-reflection to improve responses |
+| 8 | Self-Refine | `Self-Refine.ipynb` | Iterative self-improvement of outputs |
+| 9 | Recursive Criticism | `Recursive-Criticism-and-Improvement.ipynb` | Critique and revise in a loop |
+| 10 | Least-to-Most | `Least-to-Most-Prompting.ipynb` | Decompose into sub-problems, solve incrementally |
+| 11 | Decomposed Prompting | `Decomposed-Prompting.ipynb` | Break complex tasks into simpler sub-tasks |
+| 12 | Plan and Solve | `Plan-and-Solve.ipynb` | Create a plan, then execute step-by-step |
+| 13 | Reasoning via Planning | `Reasoning-via-Planning.ipynb` | Use planning as a reasoning strategy |
+| 14 | Meta-Prompting | `Meta-Prompting.ipynb` | LLM generates its own prompts |
+| 15 | RAG | `RAG.ipynb` | Retrieval-Augmented Generation |
+| 16 | Toolformer | `Toolformer.ipynb` | LLM learns when and how to use tools |
+| 17 | Auto Reasoning + Tools | `Automatic-Reasoning-and-Tool-Use.ipynb` | Automatic tool selection and reasoning |
+| 18 | Multi-Agent Debate | `Multi-Agent-Debate.ipynb` | Multiple agents argue to reach better answers |
+| 19 | Orchestrator-Worker | `Orchestrator-Worker.ipynb` | One agent coordinates, others execute |
+| 20 | Generative Agents | `Generative-Agents.ipynb` | Simulated agents with memory and reflection |
+| 21 | Self-Evolving Agent | `Self-Evolving-Agent.ipynb` | Agent that improves itself over time |
+| 22 | Language Agent Tree Search | `Language-Agent-Tree-Search.ipynb` | Tree search for optimal agent actions |
+| 23 | Model Context Protocol | `Model-Context-Protocol.ipynb` | MCP standard for LLM tool interoperability |
+
+## Reference
+
+See `ai-patterns.pdf` for a visual guide covering all patterns.
+
+## Run Locally (Optional)
+
+```bash
+pip install jupyter langchain-google-genai python-dotenv
+jupyter notebook
+```
+
+You'll need a free Google Gemini API key: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
```

**File**: `genai-usecases/chatbot-with-memory/README.md` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@
 
 A beginner friendly GenAI based chatbot that provides a conversational interface for PDF documents using Ollama based local open models.
 
+> **No API keys needed!** This project runs entirely on your local machine using Ollama. No cloud APIs, no credit cards, no sign-ups. Just install Ollama, pull a model, and run.
+
 ## Features
 
 - 🤖 **Multiple Local Models** - Support for various [Ollama](https://ollama.com/) based open models (Llama, Gemma, DeepSeek, gpt-oss, phi etc.)
```

**File**: `genai-usecases/content-moderation-system/README.md` (modified, +7/-5)
```diff
@@ -62,12 +62,14 @@ If you're using VS Code, you can split the terminal and run both the backend and
 
 ```bash
 git clone https://github.com/genieincodebottle/generative-ai.git
-cd generative-ai\genai-usecases\agentic-ai\content-moderation-system\backend
+cd generative-ai\genai-usecases\content-moderation-system\backend
 ```
 
-**Step 2: Install Python dependencies**
+**Step 2: Create virtual environment and install Python dependencies**
 ```bash
-pip install uv
+pip install uv       # if uv not installed
+uv venv
+.venv\Scripts\activate    # On Linux/Mac: source .venv/bin/activate
 uv pip install -r requirements.txt
 ```
 
@@ -108,11 +110,11 @@ python main.py
 
 The API will be available at `http://localhost:8000`
 
-### Frontend Setup (In the different terminal)
+### Frontend Setup (In a second terminal)
 
 **Step 1: Install Node dependencies**
 ```bash
-cd content-moderation-system\frontend
+cd generative-ai\genai-usecases\content-moderation-system\frontend
 npm install
 ```
 
```

**File**: `genai-usecases/conversational-analytics/README.md` (modified, +3/-3)
```diff
@@ -92,9 +92,9 @@ Conversational-analytics/
 #### Prerequisites
 
 - [Git](https://git-scm.com/downloads)
-- [Docker Desktop](https://docs.docker.com/engine/install/)
-- [Postman (for API testing)](https://www.postman.com/downloads/)
-- [Free Google's Gemini API Key](https://makersuite.google.com/app/apikey)
+- [Docker Desktop](https://docs.docker.com/engine/install/) - **Required** (MongoDB runs inside Docker, no separate install needed)
+- [Free Google Gemini API Key](https://aistudio.google.com/app/apikey) - Free-tier, no credit card
+- [Postman](https://www.postman.com/downloads/) (optional, for creating admin user - can use curl instead)
 
 #### Installation
 
```

**File**: `genai-usecases/embedding-models/README.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# Vector Embeddings Guide
+
+Learn how vector embeddings work and how to generate them using Google, OpenAI, and HuggingFace embedding models.
+
+## What are Embeddings?
+
+Embeddings convert text into numerical vectors that capture meaning. Similar texts produce similar vectors, enabling semantic search, clustering, and RAG (Retrieval-Augmented Generation).
+
+## Contents
+
+| File | Description |
+|------|-------------|
+| `embedding_models.ipynb` | Hands-on notebook comparing embedding models from Google, OpenAI, and HuggingFace |
+| `vector-embeddings-guide.pdf` | Visual guide explaining embedding concepts |
+
+## Quick Start (Google Colab - Recommended)
+
+1. Open the notebook in Google Colab (no local setup needed)
+2. Get a free Google API key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
+3. Run the cells and experiment with different texts
+
+## Run Locally
+
+1. Create a virtual environment:
+   ```bash
+   pip install uv
+   uv venv
+   .venv\Scripts\activate    # On Linux/Mac: source .venv/bin/activate
+   ```
+
+2. Install dependencies:
+   ```bash
+   uv pip install jupyter langchain-google-genai python-dotenv numpy
+   ```
+
+3. Set up your API key:
+   ```bash
+   echo "GOOGLE_API_KEY=your_key_here" > .env
+   ```
+
+4. Launch Jupyter:
+   ```bash
+   jupyter notebook embedding_models.ipynb
+   ```
```

---

### Incident Patch 9: `2d49f299` (2026-03-26)
**Commit Message**: feat: update dependencies to latest versions and fix langchain 1.x breaking imports

- Bump langchain/langchain-core/langchain-community to >=0.3.20+ across 12 projects
- Migrate deprecated imports: langchain.text_splitter -> langchain_text_splitters,
  langchain.prompts -> langchain_core.prompts, langchain.chains.LLMChain -> LCEL pipe
- Replace LLMChain with LCEL pattern (prompt | llm) in conversational-analytics
- Replace ConversationBufferMemory with InMemoryChatMessageHistory in agentic workflows
- Pin unpinned deps in conversational-analytics and cache_augmented_generation
- Remove harmful asyncio PyPI package from mcp/web_search_mcp
- Cap langchain<1.0 for text-to-sql (uses create_sql_query_chain)
- Bump OpenTelemetry, crewai, sentence-transformers, ragas to latest

**File**: `genai-usecases/advance-rag/code-search-rag/rag.py` (modified, +2/-2)
```diff
@@ -31,8 +31,8 @@
 # LangChain imports
 from langchain_google_genai import GoogleGenerativeAI, GoogleGenerativeAIEmbeddings
 from langchain_chroma import Chroma
-from langchain.schema import Document
-from langchain.prompts import PromptTemplate
+from langchain_core.documents import Document
+from langchain_core.prompts import PromptTemplate
 
 # ChromaDB
 import chromadb
```

**File**: `genai-usecases/advance-rag/code-search-rag/requirements.txt` (modified, +4/-5)
```diff
@@ -1,11 +1,10 @@
 # Core RAG dependencies
-langchain>=0.3.0
-langchain-core>=0.3.0
-langchain-community>=0.3.0
+langchain>=0.3.20
+langchain-core>=0.3.20
+langchain-community>=0.3.20
 langchain-google-genai>=2.0.0
 langchain-chroma>=0.2.0
 chromadb>=0.5.0
-google-generativeai>=0.8.0
 pydantic>=2.0.0
 
 # Code parsing
@@ -14,7 +13,7 @@ tree-sitter-python>=0.21.0
 tree-sitter-javascript>=0.21.0
 
 # Streamlit UI
-streamlit>=1.38.0
+streamlit>=1.41.0
 
 # Environment variables
 python-dotenv>=1.0.0
```

**File**: `genai-usecases/advance-rag/multimodal-rag/requirements.txt` (modified, +5/-5)
```diff
@@ -1,13 +1,13 @@
 # Core Streamlit dependency
-streamlit>=1.38.0
+streamlit>=1.41.0
 
 # Google AI and LangChain dependencies
-google-generativeai>=0.8.0
-langchain>=0.3.0
+google-generativeai>=0.8.4
+langchain>=0.3.20
 langchain-google-genai>=2.0.0
 langchain-chroma>=0.2.0
-langchain-community>=0.3.0
-langchain-core>=0.3.0
+langchain-community>=0.3.20
+langchain-core>=0.3.20
 langchain-text-splitters>=0.3.0
 
 # Vector Database
```

**File**: `genai-usecases/advance-rag/rag_techniques/requirements.txt` (modified, +2/-2)
```diff
@@ -2,10 +2,10 @@ streamlit>=1.47.1
 langchain>=0.3.27
 langchain-google-genai>=2.1.8
 langchain-chroma>=0.2.5
-langchain-community>=0.3.27
+langchain-community>=0.3.20
 langchain-text-splitters>=0.3.0
 langchain-groq>=0.3.0
-langchain-huggingface>=0.1.0
+langchain-huggingface>=0.1.2
 sentence-transformers>=3.0.0
 nest-asyncio>=1.6.0
 pypdf>=5.9.0
```

**File**: `genai-usecases/agentic-ai/agentic_workflows/prompt_chaining.py` (modified, +2/-5)
```diff
@@ -42,7 +42,7 @@
 from langchain_core.prompts import ChatPromptTemplate
 from langchain_core.output_parsers import StrOutputParser
 from langchain_core.runnables import RunnablePassthrough, RunnableLambda, RunnableParallel
-from langchain.memory import ConversationBufferMemory
+from langchain_core.chat_history import InMemoryChatMessageHistory
 
 # Multi-provider LLM support
 from langchain_openai import ChatOpenAI
@@ -118,10 +118,7 @@ def __init__(self, llm, use_memory: bool = True):
         """
         self.llm = llm
         self.parser = StrOutputParser()
-        self.memory = ConversationBufferMemory(
-            memory_key="chat_history",
-            return_messages=True
-        ) if use_memory else None
+        self.memory = InMemoryChatMessageHistory() if use_memory else None
         self.results: List[ChainStepResult] = []
 
     def create_step_chain(self, step_name: str, prompt_template: str) -> Any:
```

---

### Incident Patch 10: `4f2d6834` (2026-03-11)
**Commit Message**: fix: repair broken links, refactor RAG code for updated libraries and updated GenAI Interview Q&A with latest details

**File**: `GenAI_Roadmap.md` (modified, +16/-11)
```diff
@@ -8,11 +8,15 @@
     <a target="_blank" href="https://www.youtube.com/@genieincodebottle"><img src="https://img.shields.io/badge/YouTube-11.5K-blue"></a>&nbsp;
     <a target="_blank" href="https://github.com/genieincodebottle/generative-ai"><img src="https://img.shields.io/github/stars/genieincodebottle/generative-ai"></a>&nbsp;
     <a target="_blank" href="https://www.linkedin.com/in/rajesh-srivastava"><img src="https://img.shields.io/badge/style--5eba00.svg?label=LinkedIn&logo=linkedin&style=social"></a>&nbsp;
-    <a target="_blank" href="https://www.instagram.com/genieincodebottle/"><img src="https://img.shields.io/badge/53K-C13584?style=flat-square&labelColor=C13584&logo=instagram&logoColor=white&link=https://www.instagram.com/genieincodebottle/"></a>&nbsp;
+    <a target="_blank" href="https://www.instagram.com/genieincodebottle/"><img src="https://img.shields.io/badge/55.5K-C13584?style=flat-square&labelColor=C13584&logo=instagram&logoColor=white&link=https://www.instagram.com/genieincodebottle/"></a>&nbsp;
     <a target="_blank" href="https://medium.com/@raj-srivastava"><img src="https://img.shields.io/badge/Medium-12100E?style=round-square&style=for-the-badge&logo=medium"></a>&nbsp;
     <a target="_blank" href="https://x.com/zero2nn"><img src="https://img.shields.io/twitter/url/https/twitter.com/cloudposse.svg?style=social&label=%20%40zero2nn"></a>
 </div>
 <br>
+<div align="center">
+    <a target="_blank" href="https://aimlcompanion.com/"><img src="https://img.shields.io/badge/🚀%20AI--ML%20Companion-Live%20Now!%20Interactive%20Learning%20Platform%20⭐-0EA5E9?style=for-the-badge&labelColor=0D1117"></a>
+</div>
+<br>
 Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated with the latest GenAI resources :)
 
 
@@ -65,8 +69,8 @@ Each phase is split by week and builds progressively.
 
 | Topics                      | Core Material | Additional Resources | Code |
 |----------------------------|---------------|-----------------------|------|
-| Retrieval-Augmented Generation (RAG) | [1. Blog - Advance RAG Techniques](https://8738733.fs1.hubspotusercontent-na1.net/hubfs/8738733/eBooks/Weaviate-Advanced-RAG-Techniques-ebook.pdf) <br/> [2. PDF - RAG Decisions](https://github.com/genieincodebottle/generative-ai/blob/main/genai-usecases/advance-rag/advance-rag-decision-flow-chart.pdf) || [1. GitHub - Advanced RAG (Graph RAG, Agentic RAG, Multimodal RAG etc)](https://github.com/genieincodebottle/generative-ai/tree/main/genai-usecases/advance-rag) <br/> [2. GitHub - Microsoft's Agentic RAG](https://github.com/microsoft/ai-agents-for-beginners/blob/main/05-agentic-rag/README.md) |
-| Agentic AI                 | [1. Blog - Building Agents (Claude)](https://www.anthropic.com/research/building-effective-agents) <br> [2. Huggingface Agents Course](https://huggingface.co/learn/agents-course/en/unit0/introduction) | [1. Blog - Chip Huyen](https://huyenchip.com/2025/01/07/agents.html) <br/> [2. Google Whitepaper](https://www.kaggle.com/whitepaper-agents) | [1. GitHub-Agentic AI](https://github.com/genieincodebottle/generative-ai/tree/main/genai-usecases/agentic-ai) <br/>  [2. GitHub-NirDimant](https://github.com/NirDiamant/GenAI_Agents) <br/> [3. LangGraph](https://github.com/langchain-ai/langgraph/tree/main/docs/docs/tutorials/multi_agent) |
+| Retrieval-Augmented Generation (RAG) | [1. Blog - Advance RAG Techniques](https://8738733.fs1.hubspotusercontent-na1.net/hubfs/8738733/eBooks/Weaviate-Advanced-RAG-Techniques-ebook.pdf) <br/> [2. PDF - RAG Decisions](https://github.com/genieincodebottle/generative-ai/blob/main/genai-usecases/advance-rag/docs/advance-rag-decision-flow-chart.pdf) || [1. GitHub - Advanced RAG (Graph RAG, Agentic RAG, Multimodal RAG etc)](https://github.com/genieincodebottle/generative-ai/tree/main/genai-usecases/advance-rag) <br/> [2. GitHub - Microsoft's Agentic RAG](https://github.com/microsoft/ai-agents-for-beginners/blob/main/05-agentic-rag/README.md) |
+| Agentic AI              
```

**File**: `README.md` (modified, +7/-1)
```diff
@@ -6,11 +6,15 @@
    <a target="_blank" href="https://www.youtube.com/@genieincodebottle"><img src="https://img.shields.io/badge/YouTube-11.5K-blue"></a>&nbsp;
    <a target="_blank" href="https://github.com/genieincodebottle/generative-ai"><img src="https://img.shields.io/github/stars/genieincodebottle/generative-ai"></a>&nbsp;
    <a target="_blank" href="https://www.linkedin.com/in/rajesh-srivastava"><img src="https://img.shields.io/badge/style--5eba00.svg?label=LinkedIn&logo=linkedin&style=social"></a>&nbsp;
-   <a target="_blank" href="https://www.instagram.com/genieincodebottle/"><img src="https://img.shields.io/badge/53K-C13584?style=round-square&labelColor=C13584&logo=instagram&logoColor=white&link=https://www.instagram.com/eduardopiresbr/"></a>&nbsp;
+   <a target="_blank" href="https://www.instagram.com/genieincodebottle/"><img src="https://img.shields.io/badge/55.5K-C13584?style=round-square&labelColor=C13584&logo=instagram&logoColor=white&link=https://www.instagram.com/eduardopiresbr/"></a>&nbsp;
    <a target="_blank" href="https://medium.com/@raj-srivastava"><img src="https://img.shields.io/badge/Medium-12100E?style=round-square&style=for-the-badge&logo=medium"></a>&nbsp;
     <a target="_blank" href="https://x.com/zero2nn"><img src="https://img.shields.io/twitter/url/https/twitter.com/cloudposse.svg?style=social&label=%20%40zero2nn"></a>
 </div>
 <br>
+<div align="center">
+    <a target="_blank" href="https://aimlcompanion.com/"><img src="https://img.shields.io/badge/🚀%20AI--ML%20Companion-Live%20Now!%20Interactive%20Learning%20Platform%20⭐-0EA5E9?style=for-the-badge&labelColor=0D1117"></a>
+</div>
+<br>
 Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated with the latest GenAI resources :)
 
 ## 📚 Table of Contents
@@ -24,6 +28,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 ### 🎯 Getting Started
 - **[GenAI Roadmap](./GenAI_Roadmap.md)** - Your complete learning path for GenAI
 - **[AI/ML Roadmap](./docs/ai_ml_roadmap.pdf)** - Comprehensive AI/ML learning guide
+- **[AI-ML Companion](https://aimlcompanion.com/)** - Interactive AI/ML learning platform with 17 tracks, 250+ modules, visualizations, quizzes, and hands-on coding (ML fundamentals → LLMs → MLOps)
 - **[Essential GenAI Terms](./docs/essential-terms-genai.pdf)** - Key terminology and concepts
 - **[LLM Fundamentals](./docs/llm_fundamentals.pdf)** - Core concepts of Large Language Models
 
@@ -98,6 +103,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 ### 🔗 Quick Access Links
 | Category | Resources |
 |----------|-----------|
+| **Learning Platform** | [AI-ML Companion](https://aimlcompanion.com/) — Interactive AI/ML learning with 17 tracks, 250+ modules, quizzes & coding |
 | **Learning Path** | [GenAI Roadmap](./GenAI_Roadmap.md) • [AI/ML Roadmap](./docs/ai_ml_roadmap.pdf) |
 | **Fundamentals** | [Essential Terms](./docs/essential-terms-genai.pdf) • [LLM Fundamentals](./docs/llm_fundamentals.pdf) • [Embeddings Guide](./docs/vector-embeddings-guide.pdf) |
 | **Cloud Platforms** | [AWS](./docs/genai-with-aws-cloud.pdf) • [Azure](./docs/genai-with-azure-cloud.pdf) • [VertexAI](./docs/genai-with-vertexai.pdf) |
```

**File**: `docs/prompt_engineering.ipynb` (modified, +1/-1)
```diff
@@ -260,7 +260,7 @@
         "# If you want to use Groq API then uncomment following\n",
         "\"\"\"\n",
         "llm = ChatGroq(\n",
-        "    model=\"llama3-8b-8192\",\n",
+        "    model=\"llama-3.1-8b-instant\",\n",
         "    temperature=0.5\n",
         ")\n",
         "\"\"\""
```

**File**: `genai-usecases/advance-rag/README.md` (modified, +120/-56)
```diff
@@ -3,7 +3,7 @@
 ![alt text](images/rag.gif)
 
 ---
-<strong>**Retrieval-Augmented Generation (RAG)**</strong> enhances Large Language Models (LLMs) by combining them with an external knowledge retrieval system.
+**Retrieval-Augmented Generation (RAG)** enhances Large Language Models (LLMs) by combining them with an external knowledge retrieval system.
 
 When you send a query:
 
@@ -16,138 +16,202 @@ This makes RAG essential for building reliable GenAI applications. As queries an
 ---
 ## 🔑 Core Components of RAG
 
-   - <strong>**Knowledge Base**</strong>: External data source (e.g. documents, databases) that the system relies on.
+   - **Knowledge Base**: External data source (e.g. documents, databases) that the system relies on.
 
-   - <strong>**Retrieval System**</strong>:
+   - **Retrieval System**:
 
-      - <strong>**Vector Database**</strong> for storing and searching embeddings.
+      - **Vector Database** for storing and searching embeddings.
 
-      - <strong>**Embedding Model**</strong> to convert queries and documents into vector representations.
+      - **Embedding Model** to convert queries and documents into vector representations.
 
-   - <strong>**Language Model (LLM)**</strong>: Generates responses using both retrieved data and the query.
+   - **Language Model (LLM)**: Generates responses using both retrieved data and the query.
 
 ---
-## 📚 Super Handy Resources 
+## 📚 Super Handy Resources
 
 | Resource | Link | Description |
 |----------|------|-------------|
 | **Embedding Models • Vector Stores • Vector Embeddings (Guide)** | [PDF](https://github.com/genieincodebottle/generative-ai/blob/main/docs/vector-embeddings-guide.pdf) | Guide covering embedding models, vector stores, and embeddings explained with examples |
 | **RAG Decision Flow** | [PDF](./docs/advance-rag-decision-flow-chart.pdf) | Quick reference flowchart to select the right **RAG technique** for your use case |
 | **Advanced Snapshot-Based PDF Parsing** | [GitHub](https://github.com/genieincodebottle/parsemypdf) | End-to-end parsing using **Docling, Markitdown, Gemini, Llama 4, Claude, GPT-4 & more** |
-| **Uber's Usecase -> Enhanced Agentic-RAG: What If Chatbots Could Deliver Near-Human Precision?** | [Blog](https://lnkd.in/eGz5a9xm) | Genie is Uber’s internal on-call copilot in Slack, delivering real-time, cited answers from internal docs and boosting on-call engineers’ and SMEs’ productivity by handling common queries efficiently. |
+| **Uber's Usecase -> Enhanced Agentic-RAG: What If Chatbots Could Deliver Near-Human Precision?** | [Blog](https://lnkd.in/eGz5a9xm) | Genie is Uber's internal on-call copilot in Slack, delivering real-time, cited answers from internal docs and boosting on-call engineers' and SMEs' productivity by handling common queries efficiently. |
+
+---
+## 🗺️ Recommended Learning Path
+
+If you are new to RAG, work through the techniques in this order to build understanding progressively:
+
+| Step | Technique | Where to run |
+|------|-----------|--------------|
+| 1 | **Basic RAG** — core retrieve-then-generate loop | [Notebook](notebooks/basic-rag.ipynb) · [Streamlit](rag_techniques/basic_rag.py) |
+| 2 | **Hybrid Search RAG** — combine keyword (BM25) + semantic search | [Notebook](notebooks/hybrid-search-rag.ipynb) · [Streamlit](rag_techniques/hybrid_search_rag.py) |
+| 3 | **Re-ranking RAG** — improve relevance with a reranker | [Notebook](notebooks/re_ranking_rag.ipynb) · [Streamlit](rag_techniques/re_ranking_rag.py) |
+| 4 | **Corrective RAG** — self-correct low-quality retrievals | [Notebook](notebooks/corrective-rag.ipynb) · [Streamlit](rag_techniques/corrective_rag.py) |
+| 5 | **Adaptive RAG** — route queries to the best strategy | [Notebook](notebooks/adaptive-rag.ipynb) · [Streamlit](rag_techniques/adaptive_rag.py) |
+| 6 | **Agentic RAG** — multi-agent workflow with LangGraph | [App](agentic-rag/) |
+| 7 | **Graph RAG** — relationship-aware retrieval over a document graph | [App](graph-rag/) 
```

**File**: `genai-usecases/advance-rag/agentic-rag/README.md` (modified, +55/-61)
```diff
@@ -14,9 +14,18 @@
 
 An <strong>Agentic Retrieval-Augmented Generation (RAG)</strong> system built with LangChain, LangGraph & Google's Gemini LLM. This system implements advanced multi-agent workflows for intelligent question answering with adaptive reasoning strategies.
 
+## 📁 File Overview
+
+| File | Role |
+|------|------|
+| `agentic_rag_system.py` | Core backend — defines all five agents, the LangGraph workflow, document loading, and query processing logic |
+| `streamlit_app.py` | Frontend UI — Streamlit web application that wraps `agentic_rag_system.py` and exposes all features through a browser interface |
+| `requirements.txt` | All Python dependencies |
+| `.env.example` | Template for environment variables — copy to `.env` and add your keys |
+
 ## ✨ Features
 
-- 🧠 **Multi Agent Architecture**
+- 🧠 **Multi-Agent Architecture**
    - **Planner Agent**: Analyzes queries and creates intelligent execution plans
    - **Retriever Agent**: Performs semantic document retrieval from vector database
    - **Research Agent**: Conducts web searches for current information
@@ -29,19 +38,19 @@ An <strong>Agentic Retrieval-Augmented Generation (RAG)</strong> system built wi
 
 - 🔮 **Advanced Capabilities**
    - **Adaptive Query Planning**: Automatically detects query complexity and selects optimal strategies
-   - **Multi-Modal Processing**: Handles text, PDFs & CSV document formats
-   - **Web Augmented RAG**: Combines document knowledge with real time web search
+   - **Multi-Format Document Support**: Handles PDF, TXT, and CSV file formats
+   - **Web-Augmented RAG**: Combines document knowledge with real-time web search via Tavily
    - **Confidence Scoring**: Provides transparency in answer reliability
    - **Source Tracking**: Detailed citation of information sources
 
 ### 🔧 Tech Stack
 
 - **Python**: Programming Language
 - **LangGraph**: State-of-the-art agent workflow orchestration
-- **Gemini LLM API (Free tier)**: Google's AI models (gemini-2.0-flash, gemini-2.0-pro, gemini-2.5-pro, gemini-2.5-flash & Gemini Embedding Models)
+- **Gemini LLM API (Free tier)**: Google's AI models (gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite & Gemini Embedding Models)
 - **Tavily Search API (Free Tier)**: Advanced web search integration
 - **ChromaDB (Open Source)**: High performance open-source vector database
-- **Streamlit**: Interactive python based web interface
+- **Streamlit**: Interactive Python-based web interface
 
 ## ⚡ Quick Start
 
@@ -54,59 +63,44 @@ An <strong>Agentic Retrieval-Augmented Generation (RAG)</strong> system built wi
 
       ```bash
       git clone https://github.com/genieincodebottle/generative-ai.git
+
+      # Windows
       cd genai-usecases\advance-rag\agentic-rag
+
+      # Linux / macOS
+      cd genai-usecases/advance-rag/agentic-rag
       ```
-   3. Open the Project in VS Code or any code editor.
-   4. Create a virtual environment by running the following command in the terminal:
-   
+   3. Open the project in VS Code or any code editor.
+   4. Create a virtual environment:
+
       ```bash
-      pip install uv #if uv not installed
+      pip install uv  # skip if uv is already installed
       uv venv
-      .venv\Scripts\activate # On Linux -> source venv/bin/activate
-      ```
-   5. Create a `requirements.txt` file and add the following libraries:
-      
-      ```bash
-      # LangGraph for agent workflows
-      langgraph>=0.6.7
-      # Core LangChain packages
-      langchain-core>=0.3.75
-      langchain-google-genai>=2.1.10
-      langchain-community>=0.3.29
-      langchain-text-splitters>=0.3.11
-      langchain-chroma>=0.2.5
-      # Vector store and embeddings
-      chromadb>=1.0.20
-      # Web search capabilities
-      tavily-python>=0.7.11
-      # Document processing
-      pypdf>=6.0.0
-      # Streamlit app dependencies
-      streamlit>=1.49.1
-      plotly>=6.3.0
-      pandas>=2.3.2
-      # Structured outputs
-      pydantic>=2.11.7
-      # E
```

#### Recent Merged Pull Requests:
- **PR #23** (2026-09-30): Add agent-manager to Agentic AI & Orchestration (@YoanWai)
- **PR #22** (2026-09-13): Add YYLO to Agentic AI & Orchestration (@InsightFactoryAPP)
- **PR #20** (2026-09-07): Add agent-qa to Agentic AI & Orchestration (@pranshuchittora)
- **PR #19** (2026-09-07): Add StructEval evaluation benchmark (@reacher-z)
- **PR #18** (2026-09-07): Add Tura coding agent resource (@Yohjisakamoto)
- **PR #11** (2026-04-11): Genai Workflow (@deepthinkss)
- **PR #9** (2026-03-11): docs: fix typos, broken links, and paths across documentation (@ljluestc)
- **PR #6** (2025-04-15): Fix broken assets (@emmanuel-ferdman)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
