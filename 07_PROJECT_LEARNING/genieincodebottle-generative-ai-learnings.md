# Forensic Learning Record (Deep Inspection): genieincodebottle/generative-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/genieincodebottle-generative-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/genieincodebottle/generative-ai](https://github.com/genieincodebottle/generative-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:24:39.502Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genieincodebottle/generative-ai`
- **Description**: Comprehensive resources on Generative AI, including a detailed roadmap, projects, use cases, interview preparation, and coding preparation.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2643 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `archive_legacy/translation-agent/src/translation_agent/utils.py`
```
import os
from typing import List
from typing import Union

import openai
import tiktoken
from dotenv import load_dotenv
from icecream import ic
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage


load_dotenv()  # read local .env file

MAX_TOKENS_PER_CHUNK = (
    1000  # if text is more than this many tokens, we'll break it up into
)
# discrete chunks to translate one chunk at a time

def openai_completion(
    prompt: str,
    system_message: str = "You are a helpful assistant.",
    model: str = "gpt-4-turbo",
    temperature: float = 0.3,
    json_mode: bool = False,
) -> Union[str, dict]:
    """
        Generate a completion using the OpenAI API.

    Args:
        prompt (str): The user's prompt or query.
        system_message (str, optional): The system message to set the context for the assistant.
            Defaults to "You are a helpful assistant.".
        temperature (float, optional): The sampling temperature for controlling the randomness of the generated text.
            Defaults to 0.3.
        json_mode (bool, optional): Whether to return the response in JSON format.
            Defaults to False.

    Returns:
        Union[str, dict]: The generated completion.
            If json_mode is True, returns the complete API response as a dictionary.
            If json_mode is False, returns the generated text as a string.
    """
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    if json_mode:
        response = client.chat.completions.create(
            model=model,
            temperature=temperature,
            top_p=1,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content
    else:
        response = client.chat.completions.create(
            model=model,
            temperature=temperature,
            top_p=1,
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content
    
def gemini_completion(
    prompt: str,
    system_message: str = "You are a helpful assistant.",
    temperature: float = 0.3,
) -> str:
    """
        Generate a completion using the Google Gemini Pro API.

    Args:
        prompt (str): The user's prompt or query.
        system_message (str, optional): The system message to set the context for the assistant.
            Defaults to "You are a helpful assistant.".
        temperature (float, optional): The sampling temperature for controlling the randomness of the generated text.
            Defaults to 0.3.
    Returns:
        str: The generated completion.
            Returns the generated text as a string.
    """
    os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
    model = ChatGoogleGenerativeAI(model="gemini-pro", temperature=0.3, convert_system_message_to_human=True)
    response = model.invoke(
        [
            SystemMessage(content=system_message),
            HumanMessage(content=prompt),
        ]
    ).content
    return response
    
def get_completion(
    prompt: str,
    system_message: str = "You are a helpful assistant.",
    temperature: float = 0.3,
    json_mode: bool = False,
    model: str = "gemini-pro"
) -> Union[str, dict]:
    """
        Generate a completion using the OpenAI API.

    Args:
        prompt (str): The user's prompt or query.
        system_message (str, optional): The system message to set the context for the assistant.
            Defaults to "You are a helpful assistant.".
        temperature (float, optional): The sampling temperature for controlling the randomness of the generated text.
            Defaults to 0.3.
        json_mode (bool, optional): Whether to return the response in JSON format.
            Defaults to False.

    Returns:
        Union[str, dict]: The generated completion.
            If json_mode is True, returns the complete API response as a dictionary.
            If json_mode is False, returns the generated text as a string.
    """
    if model == "gemini-pro":
        response = gemini_completion(prompt, system_message, temperature)
    elif model == "openAI":
        response = openai_completion(prompt, system_message, temperature, json_mode)
    
    return response

def one_chunk_initial_translation(
    source_lang: str, target_lang: str, source_text: str, model: str = "gemini-pro"
) -> str:
    """
    Translate the entire text as one chunk using an LLM.

    Args:
        source_lang (str): The source language of the text.
        target_lang (str): The target language for translation.
        source_text (str): The text to be translated.

    Returns:
        str: The translated text.
    """

    system_message = f"You are an expert linguist, specializing in translation from {source_lang} to {target_lang}."

    translation_prompt = f"""This is an {source_lang} to {target_lang} translation, please provide the {target_lang} translation for this text. \
Do not provide any explanations or text apart from the translation.
{source_lang}: {source_text}

{target_lang}:"""

    prompt = translation_prompt.format(source_text=source_text)

    translation = get_completion(prompt, system_message=system_message,  model=model)

    return translation


def one_chunk_reflect_on_translation(
    source_lang: str,
    target_lang: str,
    source_text: str,
    translation_1: str,
    country: str,
    model: str
) -> str:
    """
    Use an LLM to reflect on the translation, treating the entire text as one chunk.

    Args:
        source_lang (str): The source language of the text.
        target_lang (str): The target language of the translation.
        source_text (str): The original text in the source language.
        translation_1 (str): The initial translation of the source text.
        country (str): Country specified for target language.

    Returns:
        str: The LLM's reflection on the translation, providing constructive criticism and suggestions for improvement.
    """

    system_message = f"You are an expert linguist specializing in translation from {source_lang} to {target_lang}. \
You will be provided with a source text and its translation and your goal is to improve the translation."

    if country != "":
        reflection_prompt = f"""Your task is to carefully read a source text and a translation from {source_lang} to {target_lang}, and then give constructive criticism and helpful suggestions to improve the translation. \
The final style and tone of the translation should match the style of {target_lang} colloquially spoken in {country}.

The source text and initial translation, delimited by XML tags <SOURCE_TEXT></SOURCE_TEXT> and <TRANSLATION></TRANSLATION>, are as follows:

<SOURCE_TEXT>
{source_text}
</SOURCE_TEXT>

<TRANSLATION>
{translation_1}
</TRANSLATION>

When writing suggestions, pay attention to whether there are ways to improve the translation's \n\
(i) accuracy (by correcting errors of addition, mistranslation, omission, or untranslated text),\n\
(ii) fluency (by applying {target_lang} grammar, spelling and punctuation rules, and ensuring there are no unnecessary repetitions),\n\
(iii) style (by ensuring the translations reflect the style of the source text and takes into account any cultural context),\n\
(iv) terminology (by ensuring terminology use is consistent and reflects the source text domain; and by only ensuring you use equivalent idioms {target_lang}).\n\

Write a list of specific, helpful and constructive suggestions for improving the translation.
Each suggestion should address one specific part of the translation.
Output only the suggestions and nothing else."""

    else:
        reflection_prompt = f"""Your task is to carefully read a source text and a translation from {source_lang} to {target_lang}, and then give constructive criticism and helpful suggestions to improve the translation. \

The source text and initial translation, delimited by XML tags <SOURCE_TEXT></SOURCE_TEXT> and <TRANSLATION></TRANSLATION>, are as follows:

<SOURCE_TEXT>
{source_text}
</SOURCE_TEXT>

<TRANSLATION>
{translation_1}
</TRANSLATION>

When writing suggestions, pay attention to whether there are ways to improve the translation's \n\
(i) accuracy (by correcting errors of addition, mistranslation, omission, or untranslated text),\n\
(ii) fluency (by applying {target_lang} grammar, spelling and punctuation rules, and ensuring there are no unnecessary repetitions),\n\
(iii) style (by ensuring the translations reflect the style of the source text and takes into account any cultural context),\n\
(iv) terminology (by ensuring terminology use is consistent and reflects the source text domain; and by only ensuring you use equivalent idioms {target_lang}).\n\

Write a list of specific, helpful and constructive suggestions for improving the translation.
Each suggestion should address one specific part of the translation.
Output only the suggestions and nothing else."""

    prompt = reflection_prompt.format(
        source_lang=source_lang,
        target_lang=target_lang,
        source_text=source_text,
        translation_1=translation_1,
    )
    reflection = get_completion(prompt, system_message=system_message, model=model)
    return reflection


def one_chunk_improve_translation(
    source_lang: str,
    target_lang: str,
    source_text: str,
    translation_1: str,
    reflection: str,
    model: str
) -> str:
    """
    Use the reflection to improve the translation, treating the entire text as one chunk.

    Args:
        source_lang (str): The source language of the text.
        target_lang (str): The target language 
```

### Core Architecture Module: `genai-usecases/content-moderation-system/backend/src/core/llm_schemas.py`
```
"""
Structured Output Schemas for LLM Responses.

This module defines Pydantic models for structured LLM outputs,
replacing string parsing with type-safe structured responses.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from enum import Enum

# ============================================================================
# Common Enums for LLM Responses
# ============================================================================

class ModerationDecision(str, Enum):
    """Possible moderation decisions."""
    APPROVE = "approve"
    FLAG = "flag"
    WARN = "warn"
    REMOVE = "remove"
    BAN_USER = "ban_user"
    SUSPEND_USER = "suspend_user"
    NEEDS_REVIEW = "needs_review"


class ConfidenceLevel(str, Enum):
    """Confidence level categories."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SeverityLevel(str, Enum):
    """Violation severity levels."""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TrendDirection(str, Enum):
    """Trend direction for metrics."""
    IMPROVING = "improving"
    STABLE = "stable"
    DECLINING = "declining"
    NEEDS_ATTENTION = "needs_attention"


# ============================================================================
# Content Analysis Agent Schemas
# ============================================================================

class TopicExtractionResponse(BaseModel):
    """Structured response for topic extraction."""
    topics: List[str] = Field(
        description="Main topics in the content (up to 5)",
        max_length=5
    )
    category: str = Field(
        description="Content category (news, opinion, meme, question, personal, commercial, etc.)"
    )
    entities: List[str] = Field(
        default=[],
        description="Detected entities (people, organizations, locations)"
    )
    sensitive_topics: List[str] = Field(
        default=[],
        description="Sensitive topics detected (politics, religion, health, finance)"
    )
    explicit_content: bool = Field(
        default=False,
        description="Whether explicit content is detected"
    )
    language: str = Field(
        default="en",
        description="Detected language code"
    )


class ContentAnalysisResponse(BaseModel):
    """Structured response for content analysis agent."""
    decision: ModerationDecision = Field(
        description="Recommended moderation action"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the decision (0.0 to 1.0)"
    )
    reasoning: str = Field(
        description="Explanation for the decision"
    )
    content_summary: str = Field(
        description="Brief summary of the content"
    )
    risk_factors: List[str] = Field(
        default=[],
        description="Identified risk factors"
    )
    requires_human_review: bool = Field(
        default=False,
        description="Whether human review is recommended"
    )


# ============================================================================
# Toxicity Detection Agent Schemas
# ============================================================================

class ToxicityCategoryModel(BaseModel):
    """Individual toxicity category with score."""
    category: str = Field(description="Category name (profanity, threat, hate_speech, etc.)")
    score: float = Field(ge=0.0, le=1.0, description="Category score")
    evidence: List[str] = Field(default=[], description="Text evidence for this category")


class ToxicityAnalysisResponse(BaseModel):
    """Structured response for toxicity detection agent."""
    decision: ModerationDecision = Field(
        description="Recommended action: approve, flag, or remove"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the decision"
    )
    toxicity_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall toxicity score"
    )
    toxicity_level: Literal["none", "low", "medium", "high", "severe"] = Field(
        description="Categorical toxicity level"
    )
    categories: List[ToxicityCategoryModel] = Field(
        default=[],
        description="Detected toxicity categories with scores"
    )
    is_satire: bool = Field(
        default=False,
        description="Whether content appears to be satire/humor"
    )
    is_quote: bool = Field(
        default=False,
        description="Whether toxic content is a quote/reference"
    )
    is_educational: bool = Field(
        default=False,
        description="Whether content is educational discussion"
    )
    context_notes: str = Field(
        default="",
        description="Notes about context that affects interpretation"
    )
    reasoning: str = Field(
        description="Detailed reasoning for the decision"
    )


# ============================================================================
# Policy Violation Agent Schemas
# ============================================================================

class PolicyViolation(BaseModel):
    """Individual policy violation."""
    policy: str = Field(description="Name of violated policy")
    severity: SeverityLevel = Field(description="Violation severity")
    evidence: str = Field(description="Evidence of violation")
    recommendation: str = Field(description="Recommended action for this violation")


class PolicyAnalysisResponse(BaseModel):
    """Structured response for policy violation agent."""
    decision: ModerationDecision = Field(
        description="Recommended moderation action"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the decision"
    )
    violations: List[PolicyViolation] = Field(
        default=[],
        description="List of detected policy violations"
    )
    overall_severity: SeverityLevel = Field(
        default=SeverityLevel.NONE,
        description="Overall severity of all violations"
    )
    is_repeat_offender: bool = Field(
        default=False,
        description="Whether user is a repeat offender"
    )
    escalation_recommended: bool = Field(
        default=False,
        description="Whether to escalate to senior moderator"
    )
    reasoning: str = Field(
        description="Detailed reasoning for the decision"
    )
    user_history_considered: bool = Field(
        default=True,
        description="Whether user history was considered"
    )


# ============================================================================
# User Reputation Agent Schemas
# ============================================================================

class ReputationAnalysisResponse(BaseModel):
    """Structured response for user reputation agent."""
    decision: ModerationDecision = Field(
        description="Recommended action regarding user"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the decision"
    )
    risk_level: Literal["low", "medium", "high", "critical"] = Field(
        description="User risk level"
    )
    trust_score: float = Field(
        ge=0.0,
        le=1.0,
        description="User trust score"
    )
    risk_factors: List[str] = Field(
        default=[],
        description="Identified risk factors"
    )
    positive_factors: List[str] = Field(
        default=[],
        description="Positive reputation factors"
    )
    recommended_tier: Literal["veteran", "trusted", "new_user", "flagged", "suspended", "banned"] = Field(
        description="Recommended user tier"
    )
    should_suspend: bool = Field(
        default=False,
        description="Whether user should be suspended"
    )
    should_ban: bool = Field(
        default=False,
        description="Whether user should be banned"
    )
    reasoning: str = Field(
        description="Detailed reasoning"
    )


# ============================================================================
# Appeal Review Agent Schemas
# ============================================================================

class AppealDecision(str, Enum):
    """Possible appeal decisions."""
    UPHOLD = "uphold"
    OVERTURN = "overturn"
    PARTIAL = "partial"
    NEEDS_MORE_INFO = "needs_more_info"


class AppealReviewResponse(BaseModel):
    """Structured response for appeal review agent."""
    appeal_decision: AppealDecision = Field(
        description="Decision on the appeal"
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence in the decision"
    )
    original_decision_correct: bool = Field(
        description="Whether original moderation decision was correct"
    )
    new_evidence_found: bool = Field(
        default=False,
        description="Whether new evidence supports overturning"
    )
    false_positive_likely: bool = Field(
        default=False,
        description="Whether this was likely a false positive"
    )
    context_missing: bool = Field(
        default=False,
        description="Whether important context was missing"
    )
    recommended_action: ModerationDecision = Field(
        description="Recommended action after appeal"
    )
    user_notification: str = Field(
        description="Message to send to user about appeal result"
    )
    reasoning: str = Field(
        description="Detailed reasoning for appeal decision"
    )


# ============================================================================
# Action Enforcement Agent Schemas
# ============================================================================

class EnforcementAction(BaseModel):
    """Specific enforcement action to take."""
    action_type: str = Field(description="Type of action (remove_content, warn_user, etc.)")
    target: str = Field(description="Target of action (content_id, user_id)")
    severity: SeverityLevel = Field(description="Action severity")
    duration: Optional[str] = F
```

### Core Architecture Module: `genai-usecases/content-moderation-system/backend/src/core/models.py`
```
"""
Data models for the Content Moderation & Community Safety Platform.

This module defines core data structures for content moderation processing.
"""

from enum import Enum
from dataclasses import dataclass
from typing import TypedDict, List, Optional, Dict, Any


class ContentType(Enum):
    """Types of content that can be moderated."""

    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    COMMENT = "comment"
    POST = "post"
    MESSAGE = "message"
    STORY = "story"
    STORY_COMMENT = "story_comment"


class ContentStatus(Enum):
    """Content status throughout the moderation pipeline."""

    SUBMITTED = "submitted"
    ANALYZING = "analyzing"
    TOXICITY_CHECK = "toxicity_check"
    POLICY_CHECK = "policy_check"
    REACT_SYNTHESIS = "react_synthesis"  # ReAct loop decision synthesis
    REPUTATION_SCORING = "reputation_scoring"
    APPEAL_REVIEW = "appeal_review"
    ACTION_ENFORCEMENT = "action_enforcement"
    APPROVED = "approved"
    REMOVED = "removed"
    WARNED = "warned"
    FLAGGED = "flagged"
    UNDER_REVIEW = "under_review"
    # Human-in-the-Loop (HITL) statuses
    PENDING_HUMAN_REVIEW = "pending_human_review"  # Waiting for human decision
    HUMAN_REVIEW_COMPLETED = "human_review_completed"  # Human made decision
    ESCALATED = "escalated"  # Escalated to senior moderator


class DecisionType(Enum):
    """Types of decisions agents can make."""

    APPROVE = "approve"
    REMOVE = "remove"
    WARN = "warn"
    FLAG = "flag"
    SUSPEND_USER = "suspend_user"
    BAN_USER = "ban_user"
    NEEDS_REVIEW = "needs_review"
    # Human-in-the-Loop decisions
    AWAIT_HUMAN = "await_human"  # Pause for human input
    HUMAN_APPROVED = "human_approved"  # Human approved action
    HUMAN_ESCALATED = "human_escalated"  # Human escalated to higher authority


class HITLTriggerReason(Enum):
    """Reasons for triggering Human-in-the-Loop review."""

    LOW_CONFIDENCE = "low_confidence"  # Agent confidence below threshold
    HIGH_SEVERITY = "high_severity"  # Severe violation detected
    USER_APPEAL = "user_appeal"  # User requested appeal
    CONFLICTING_DECISIONS = "conflicting_decisions"  # Agents disagree
    EDGE_CASE = "edge_case"  # Content doesn't fit clear categories
    SENSITIVE_CONTENT = "sensitive_content"  # Politics, religion, etc.
    HIGH_PROFILE_USER = "high_profile_user"  # Verified/high-follower user
    POTENTIAL_FALSE_POSITIVE = "potential_false_positive"  # Possible mistake
    FIRST_OFFENSE_SEVERE = "first_offense_severe"  # First violation but severe
    LEGAL_CONCERN = "legal_concern"  # Potential legal implications


class ToxicityLevel(Enum):
    """Toxicity level classifications."""

    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SEVERE = "severe"


class PolicyCategory(Enum):
    """Policy violation categories."""

    HATE_SPEECH = "hate_speech"
    HARASSMENT = "harassment"
    BULLYING = "bullying"
    VIOLENCE = "violence"
    SPAM = "spam"
    SEXUAL_CONTENT = "sexual_content"
    MISINFORMATION = "misinformation"
    SELF_HARM = "self_harm"
    ILLEGAL_ACTIVITY = "illegal_activity"
    COPYRIGHT = "copyright"
    IMPERSONATION = "impersonation"
    PRIVACY_VIOLATION = "privacy_violation"
    NONE = "none"


class ReputationTier(Enum):
    """User reputation tiers."""

    NEW_USER = "new_user"
    TRUSTED = "trusted"
    VETERAN = "veteran"
    MODERATOR = "moderator"
    FLAGGED = "flagged"
    SUSPENDED = "suspended"
    BANNED = "banned"


@dataclass
class ContentMetadata:
    """Metadata about the content."""

    content_id: str
    content_type: str  # ContentType enum value
    platform: str  # twitter, reddit, discord, youtube, etc.
    created_at: str
    language: str
    parent_id: Optional[str] = None  # For comments/replies
    thread_id: Optional[str] = None
    media_urls: List[str] = None
    hashtags: List[str] = None
    mentions: List[str] = None


@dataclass
class UserProfile:
    """User profile information."""

    user_id: str
    username: str
    account_age_days: int
    total_posts: int
    total_violations: int
    previous_warnings: int
    previous_suspensions: int
    reputation_score: float  # 0.0 to 1.0
    reputation_tier: str  # ReputationTier enum value
    verified: bool = False
    follower_count: int = 0
    following_count: int = 0


@dataclass
class AgentDecision:
    """Represents a decision made by an agent."""

    agent_name: str
    decision: DecisionType
    confidence: float  # 0.0 to 1.0
    reasoning: str
    flags: List[str]
    recommendations: List[str]
    extracted_data: Dict[str, Any]
    requires_human_review: bool = False
    processing_time: float = 0.0


class ContentState(TypedDict, total=False):
    """
    Central state object passed between all agents in the LangGraph workflow.

    This is the primary data structure that gets updated as the content
    moves through the moderation pipeline.
    """

    # Content identification
    content_id: str
    submission_id: str
    submission_timestamp: str

    # Content details
    content_text: Optional[str]
    content_type: str  # ContentType enum value
    content_metadata: ContentMetadata

    # Image/video analysis (for multimodal content)
    image_urls: List[str]
    video_urls: List[str]
    image_descriptions: List[str]
    detected_objects: List[str]
    detected_text_in_media: List[str]

    # User information
    user_profile: UserProfile
    user_id: str
    username: str

    # Content Analysis (populated by Content Analysis Agent)
    content_category: Optional[str]
    content_sentiment: Optional[str]
    content_topics: List[str]
    contains_sensitive_content: bool
    explicit_content_detected: bool

    # Toxicity Detection (populated by Toxicity Detection Agent)
    toxicity_score: Optional[float]  # 0.0 to 1.0
    toxicity_level: Optional[str]  # ToxicityLevel enum value
    toxicity_categories: List[str]  # profanity, insult, threat, etc.
    hate_speech_detected: bool
    harassment_detected: bool

    # Policy Violation (populated by Policy Violation Agent)
    policy_violations: List[str]  # PolicyCategory enum values
    violation_severity: Optional[str]  # low, medium, high, critical
    policy_flags: List[str]
    recommended_action: Optional[str]

    # Reputation Scoring (populated by Reputation Agent)
    user_reputation_score: Optional[float]
    user_reputation_tier: Optional[str]
    user_risk_score: Optional[float]  # 0.0 to 1.0
    user_history_flags: List[str]
    similar_violations_count: int

    # Appeal Information (for Appeal Review Agent)
    is_appeal: bool
    appeal_reason: Optional[str]
    original_decision: Optional[str]
    appeal_timestamp: Optional[str]

    # Action Enforcement (populated by Action Enforcement Agent)
    moderation_action: Optional[str]  # DecisionType enum value
    action_reason: str
    action_timestamp: Optional[str]
    user_notified: bool
    content_removed: bool
    user_suspended: bool
    suspension_duration_days: Optional[int]

    # Agent decisions tracking
    agent_decisions: List[AgentDecision]
    current_agent: Optional[str]

    # Workflow control
    status: str  # ContentStatus enum value
    requires_human_review: bool
    human_review_reason: Optional[str]
    overall_confidence: float

    # Manual review
    reviewer_name: Optional[str]
    review_notes: Optional[str]
    review_decision: Optional[str]
    review_timestamp: Optional[str]

    # Timestamps
    created_at: str
    processed_at: Optional[str]

    # Memory/learning
    similar_content: Optional[List[Dict[str, Any]]]
    historical_patterns: Optional[List[Dict[str, Any]]]

    # ReAct Loop (Think-Act-Observe synthesis)
    react_think_output: Optional[str]  # Analysis of all agent decisions
    react_act_decision: Optional[str]  # Synthesized decision
    react_observe_result: Optional[str]  # Observation after action
    react_confidence: Optional[float]  # Synthesized confidence score
    react_reasoning: Optional[str]  # Full reasoning chain

    # Human-in-the-Loop (HITL) fields
    hitl_required: bool  # Whether HITL is needed
    hitl_trigger_reasons: List[str]  # Why HITL was triggered (HITLTriggerReason values)
    hitl_checkpoint: Optional[str]  # Which checkpoint triggered HITL
    hitl_priority: Optional[str]  # Priority level: low, medium, high, critical
    hitl_assigned_to: Optional[str]  # Assigned human reviewer
    hitl_queue_position: Optional[int]  # Position in review queue
    hitl_waiting_since: Optional[str]  # Timestamp when entered HITL queue
    hitl_human_decision: Optional[str]  # Human's decision
    hitl_human_notes: Optional[str]  # Human's notes
    hitl_human_confidence_override: Optional[float]  # Human can override confidence
    hitl_resolution_timestamp: Optional[str]  # When human resolved

    # Guardrails tracking (internal use)
    _guardrail_iteration: Optional[int]  # Current iteration count
    _guardrail_checks: Optional[List[Dict[str, Any]]]  # Guardrail check results
    guardrail_violations: Optional[List[str]]  # List of guardrail violations
    guardrail_warnings: Optional[List[str]]  # List of guardrail warnings


@dataclass
class ToxicityAnalysis:
    """Toxicity detection analysis results."""

    toxicity_score: float  # 0.0 to 1.0
    toxicity_level: str  # ToxicityLevel enum value
    categories: List[str]  # profanity, insult, threat, hate, harassment
    hate_speech_score: float
    harassment_score: float
    threat_score: float
    profanity_count: int
    confidence: float


@dataclass
class PolicyAnalysis:
    """Policy violation analysis results."""

    violations: List[str]  # PolicyCategory enum values
    severity: str  # low, medium, high, critical
    confidence: float
    flags: List[str]
    recommended_action: str
    reasoning: str


@dataclass
class ReputationAnalysis:
    """User reputation analysis results."""

    reputation_score: float  # 0.0 to 1.0
   
```

### Core Architecture Module: `genai-usecases/content-moderation-system/backend/src/utils/evaluation.py`
```
"""
Evaluation system for multi-agent content moderation.

This module implements:
1. LLM-as-Judge - Evaluate decision quality using LLM
2. Cost and latency tracking - Monitor resource usage
3. A/B testing framework - Compare different moderation strategies
"""

from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import json
import time
import sqlite3
from contextlib import contextmanager

from langchain_google_genai import ChatGoogleGenerativeAI
from ..core.models import AgentDecision, ContentState
from .llm_text import message_text


class EvaluationMetric(Enum):
    """Types of evaluation metrics."""
    ACCURACY = "accuracy"
    PRECISION = "precision"
    RECALL = "recall"
    F1_SCORE = "f1_score"
    CONSISTENCY = "consistency"
    REASONING_QUALITY = "reasoning_quality"
    FAIRNESS = "fairness"
    LATENCY = "latency"
    COST = "cost"


@dataclass
class CostMetrics:
    """Track cost and resource usage for LLM calls."""
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    api_calls: int = 0
    agent_costs: Dict[str, float] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    # Pricing (Gemini Flash pricing as of 2024)
    INPUT_TOKEN_COST = 0.075 / 1_000_000  # $0.075 per 1M tokens
    OUTPUT_TOKEN_COST = 0.30 / 1_000_000  # $0.30 per 1M tokens


@dataclass
class LatencyMetrics:
    """Track latency for agent execution."""
    agent_name: str
    start_time: float
    end_time: float
    duration_ms: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class JudgeEvaluation:
    """Result from LLM-as-Judge evaluation."""
    decision_id: str
    overall_score: float  # 0-10
    accuracy_score: float
    reasoning_score: float
    consistency_score: float
    fairness_score: float
    strengths: List[str]
    weaknesses: List[str]
    improvements: List[str]
    confidence: float
    judge_reasoning: str
    timestamp: datetime = field(default_factory=datetime.now)


class CostTracker:
    """
    Track API costs and token usage for LLM calls.

    Monitors:
    - Total tokens used (input + output)
    - Cost per agent
    - Cost per moderation decision
    - Budget alerts
    """

    def __init__(self, budget_limit_usd: Optional[float] = None):
        """
        Initialize cost tracker.

        Args:
            budget_limit_usd: Optional budget limit in USD
        """
        self.metrics = CostMetrics()
        self.budget_limit = budget_limit_usd
        self.session_costs: List[Dict[str, Any]] = []

    def track_llm_call(
        self,
        agent_name: str,
        input_tokens: int,
        output_tokens: int,
        model: str = "gemini-flash"
    ) -> Dict[str, Any]:
        """
        Track a single LLM API call.

        Args:
            agent_name: Name of the agent making the call
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            model: Model name

        Returns:
            Dictionary with call cost information
        """
        # Calculate cost
        input_cost = input_tokens * CostMetrics.INPUT_TOKEN_COST
        output_cost = output_tokens * CostMetrics.OUTPUT_TOKEN_COST
        total_call_cost = input_cost + output_cost

        # Update metrics
        self.metrics.total_input_tokens += input_tokens
        self.metrics.total_output_tokens += output_tokens
        self.metrics.total_cost_usd += total_call_cost
        self.metrics.api_calls += 1

        # Track per-agent costs
        if agent_name not in self.metrics.agent_costs:
            self.metrics.agent_costs[agent_name] = 0.0
        self.metrics.agent_costs[agent_name] += total_call_cost

        # Record session
        call_record = {
            "agent": agent_name,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": total_call_cost,
            "timestamp": datetime.now().isoformat()
        }
        self.session_costs.append(call_record)

        # Check budget
        if self.budget_limit and self.metrics.total_cost_usd > self.budget_limit:
            call_record["budget_exceeded"] = True

        return call_record

    def get_summary(self) -> Dict[str, Any]:
        """Get cost summary."""
        return {
            "total_cost_usd": round(self.metrics.total_cost_usd, 6),
            "total_tokens": self.metrics.total_input_tokens + self.metrics.total_output_tokens,
            "input_tokens": self.metrics.total_input_tokens,
            "output_tokens": self.metrics.total_output_tokens,
            "api_calls": self.metrics.api_calls,
            "avg_cost_per_call": round(
                self.metrics.total_cost_usd / max(self.metrics.api_calls, 1), 6
            ),
            "agent_costs": {
                agent: round(cost, 6)
                for agent, cost in self.metrics.agent_costs.items()
            },
            "budget_limit": self.budget_limit,
            "budget_remaining": round(
                (self.budget_limit or 0) - self.metrics.total_cost_usd, 6
            ) if self.budget_limit else None,
            "budget_exceeded": (
                self.metrics.total_cost_usd > self.budget_limit
                if self.budget_limit else False
            )
        }

    def reset(self):
        """Reset cost tracking."""
        self.metrics = CostMetrics()
        self.session_costs = []


class LatencyTracker:
    """
    Track execution latency for agents and overall pipeline.
    """

    def __init__(self):
        """Initialize latency tracker."""
        self.measurements: List[LatencyMetrics] = []
        self.active_timers: Dict[str, float] = {}

    def start_timer(self, agent_name: str) -> float:
        """
        Start timing an agent execution.

        Args:
            agent_name: Name of the agent

        Returns:
            Start timestamp
        """
        start_time = time.time()
        self.active_timers[agent_name] = start_time
        return start_time

    def end_timer(
        self,
        agent_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LatencyMetrics:
        """
        End timing and record metrics.

        Args:
            agent_name: Name of the agent
            metadata: Optional metadata

        Returns:
            LatencyMetrics object
        """
        end_time = time.time()
        start_time = self.active_timers.get(agent_name, end_time)

        duration_ms = (end_time - start_time) * 1000

        metric = LatencyMetrics(
            agent_name=agent_name,
            start_time=start_time,
            end_time=end_time,
            duration_ms=duration_ms,
            metadata=metadata or {}
        )

        self.measurements.append(metric)

        # Clean up timer
        if agent_name in self.active_timers:
            del self.active_timers[agent_name]

        return metric

    def get_summary(self) -> Dict[str, Any]:
        """Get latency summary."""
        if not self.measurements:
            return {
                "total_measurements": 0,
                "total_time_ms": 0,
                "avg_time_ms": 0,
                "agent_latencies": {}
            }

        total_time = sum(m.duration_ms for m in self.measurements)
        agent_times: Dict[str, List[float]] = {}

        for measurement in self.measurements:
            if measurement.agent_name not in agent_times:
                agent_times[measurement.agent_name] = []
            agent_times[measurement.agent_name].append(measurement.duration_ms)

        return {
            "total_measurements": len(self.measurements),
            "total_time_ms": round(total_time, 2),
            "avg_time_ms": round(total_time / len(self.measurements), 2),
            "agent_latencies": {
                agent: {
                    "calls": len(times),
                    "total_ms": round(sum(times), 2),
                    "avg_ms": round(sum(times) / len(times), 2),
                    "min_ms": round(min(times), 2),
                    "max_ms": round(max(times), 2)
                }
                for agent, times in agent_times.items()
            }
        }

    def reset(self):
        """Reset latency tracking."""
        self.measurements = []
        self.active_timers = {}


class LLMJudge:
    """
    Use LLM to evaluate moderation decision quality.

    Evaluates:
    - Accuracy: Is the decision correct?
    - Reasoning: Is the reasoning sound?
    - Consistency: Does it align with previous decisions?
    - Fairness: Is it fair and unbiased?
    """

    def __init__(self, llm: ChatGoogleGenerativeAI, cost_tracker: Optional[CostTracker] = None):
        """
        Initialize LLM Judge.

        Args:
            llm: Language model for evaluation
            cost_tracker: Optional cost tracker
        """
        self.llm = llm
        self.cost_tracker = cost_tracker

    def evaluate_decision(
        self,
        decision: AgentDecision,
        content_state: ContentState,
        ground_truth: Optional[str] = None,
        previous_decisions: Optional[List[AgentDecision]] = None
    ) -> JudgeEvaluation:
        """
        Evaluate a moderation decision.

        Args:
            decision: The decision to evaluate
            content_state: Content state context
            ground_truth: Optional ground truth decision
            previous_decisions: Previous decisions for consistency check

        Returns:
            JudgeEvaluation with scores and feedback
        """
        content_text = content_state.get("content_text", "")
        user_profile = content_state.get("user_profile", {})

        prompt = f"""You are an expert evaluator of content moderation decisions.
        Evaluate this moderation decision on a scale of 1-10.

        CONTENT
```

### Core Architecture Module: `genai-usecases/content-moderation-system/backend/src/utils/llm_text.py`
```
"""Read text out of an LLM response, whatever shape it arrives in.

Current Gemini 3 models return ``message.content`` as a **list of content
blocks**::

    [{"type": "text", "text": "the answer", "extras": {"signature": "..."}}]

Older models (Gemini 2.5 and earlier) return a plain ``str``. Code written
against the string contract breaks in two ways when the model is upgraded, and
neither announces itself:

* ``response.content.strip()`` / ``.lower()`` / ``.find()`` raise
  ``AttributeError`` - a hard crash.
* ``len(response.content)`` silently measures the *number of blocks*, so a
  900-character answer has "length 1" and fails every length check.
* Rendering it shows the raw block repr, base64 thinking signature and all.

Always route response text through ``message_text``.
"""

from __future__ import annotations


def message_text(response) -> str:
    """Return the plain text of an LLM response.

    Accepts a message object, a raw ``content`` value, a list of content
    blocks, or a string, and always returns a string.
    """
    content = getattr(response, "content", response)

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if text:
                    parts.append(text)
        return "".join(parts)

    if content is None:
        return ""

    return str(content)

```

### Core Architecture Module: `genai-usecases/content-moderation-system/backend/src/utils/observability.py`
```
"""
Observability system for multi-agent content moderation.

This module implements:
1. OpenTelemetry integration for distributed tracing
2. Structured logging with context
3. Performance monitoring and metrics
"""

from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import time
import functools
import logging
import sys
from contextlib import contextmanager

# Note: OpenTelemetry will be optional dependency
try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import ConsoleSpanExporter, BatchSpanProcessor
    from opentelemetry.trace import Status, StatusCode
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    # Create mock classes for when OpenTelemetry is not installed
    class MockSpan:
        def set_attribute(self, key, value): pass
        def set_status(self, status): pass
        def add_event(self, name, attributes=None): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass

    class MockTracer:
        def start_as_current_span(self, name, attributes=None):
            return MockSpan()


class LogLevel(Enum):
    """Log levels for structured logging."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class MetricType(Enum):
    """Types of metrics to track."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


@dataclass
class StructuredLog:
    """Structured log entry with context."""
    timestamp: datetime
    level: LogLevel
    message: str
    agent_name: Optional[str] = None
    content_id: Optional[str] = None
    user_id: Optional[str] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "level": self.level.value,
            "message": self.message,
            "agent_name": self.agent_name,
            "content_id": self.content_id,
            "user_id": self.user_id,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "metadata": self.metadata
        }

@dataclass
class PerformanceMetric:
    """Performance metric data point."""
    metric_name: str
    metric_type: MetricType
    value: float
    timestamp: datetime
    tags: Dict[str, str] = field(default_factory=dict)


class StructuredLogger:
    """
    Structured logging system with context awareness.

    Provides JSON-formatted logs with trace context.
    """

    def __init__(
        self,
        name: str = "content_moderation",
        min_level: LogLevel = LogLevel.INFO,
        output_file: Optional[str] = None
    ):
        """
        Initialize structured logger.

        Args:
            name: Logger name
            min_level: Minimum log level
            output_file: Optional file for log output
        """
        self.name = name
        self.min_level = min_level
        self.output_file = output_file
        self.logs: List[StructuredLog] = []

        # Setup Python logger
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, min_level.value))

        # Add handlers
        formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s", "data": %(data)s}'
        )

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)

        # File handler if specified
        if output_file:
            file_handler = logging.FileHandler(output_file)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

    def log(
        self,
        level: LogLevel,
        message: str,
        agent_name: Optional[str] = None,
        content_id: Optional[str] = None,
        user_id: Optional[str] = None,
        **metadata
    ):
        """
        Log a structured message.

        Args:
            level: Log level
            message: Log message
            agent_name: Optional agent name
            content_id: Optional content ID
            user_id: Optional user ID
            **metadata: Additional metadata
        """
        # Check level
        if self._should_log(level):
            log_entry = StructuredLog(
                timestamp=datetime.now(),
                level=level,
                message=message,
                agent_name=agent_name,
                content_id=content_id,
                user_id=user_id,
                metadata=metadata
            )

            self.logs.append(log_entry)

            # Log to Python logger
            log_dict = log_entry.to_dict()
            log_func = getattr(self.logger, level.value.lower())
            log_func(message, extra={"data": json.dumps(metadata)})

    def debug(self, message: str, **kwargs):
        """Log debug message."""
        self.log(LogLevel.DEBUG, message, **kwargs)

    def info(self, message: str, **kwargs):
        """Log info message."""
        self.log(LogLevel.INFO, message, **kwargs)

    def warning(self, message: str, **kwargs):
        """Log warning message."""
        self.log(LogLevel.WARNING, message, **kwargs)

    def error(self, message: str, **kwargs):
        """Log error message."""
        self.log(LogLevel.ERROR, message, **kwargs)

    def critical(self, message: str, **kwargs):
        """Log critical message."""
        self.log(LogLevel.CRITICAL, message, **kwargs)

    def _should_log(self, level: LogLevel) -> bool:
        """Check if message should be logged based on level."""
        levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR, LogLevel.CRITICAL]
        return levels.index(level) >= levels.index(self.min_level)

    def get_logs(
        self,
        level: Optional[LogLevel] = None,
        agent_name: Optional[str] = None,
        content_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get filtered logs.

        Args:
            level: Filter by log level
            agent_name: Filter by agent name
            content_id: Filter by content ID
            limit: Maximum number of logs to return

        Returns:
            List of log dictionaries
        """
        filtered = self.logs

        if level:
            filtered = [log for log in filtered if log.level == level]
        if agent_name:
            filtered = [log for log in filtered if log.agent_name == agent_name]
        if content_id:
            filtered = [log for log in filtered if log.content_id == content_id]

        # Return most recent first
        filtered = sorted(filtered, key=lambda x: x.timestamp, reverse=True)
        return [log.to_dict() for log in filtered[:limit]]


class TelemetrySystem:
    """
    OpenTelemetry integration for distributed tracing.

    Provides:
    - Distributed tracing across agents
    - Span creation and management
    - Trace context propagation
    """

    def __init__(self, service_name: str = "content-moderation-system"):
        """
        Initialize telemetry system.

        Args:
            service_name: Name of the service
        """
        self.service_name = service_name
        self.enabled = OTEL_AVAILABLE

        if self.enabled:
            # Setup OpenTelemetry
            trace.set_tracer_provider(TracerProvider())
            tracer_provider = trace.get_tracer_provider()

            # Add console exporter for development
            console_exporter = ConsoleSpanExporter()
            span_processor = BatchSpanProcessor(console_exporter)
            tracer_provider.add_span_processor(span_processor)

            self.tracer = trace.get_tracer(service_name)
        else:
            self.tracer = MockTracer()

    @contextmanager
    def trace_agent(
        self,
        agent_name: str,
        content_id: Optional[str] = None,
        **attributes
    ):
        """
        Create a trace span for agent execution.

        Args:
            agent_name: Name of the agent
            content_id: Optional content ID
            **attributes: Additional span attributes

        Yields:
            Span object
        """
        span_attributes = {
            "agent.name": agent_name,
            "service.name": self.service_name,
            **attributes
        }

        if content_id:
            span_attributes["content.id"] = content_id

        with self.tracer.start_as_current_span(
            f"agent.{agent_name}",
            attributes=span_attributes
        ) as span:
            try:
                yield span
            except Exception as e:
                if hasattr(span, 'set_status'):
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                span.set_attribute("error", True)
                span.set_attribute("error.message", str(e))
                raise

    @contextmanager
    def trace_operation(self, operation_name: str, **attributes):
        """
        Create a trace span for a specific operation.

        Args:
            operation_name: Name of the operation
            **attributes: Span attributes

        Yields:
            Span object
        """
        with self.tracer.start_as_current_span(
            operation_name,
            attributes=attributes
        ) as span:
            try:
                yield span
            except Exception as e:
                if hasattr(span, 'set_status'):
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                span.set_
```

### Core Architecture Module: `genai-usecases/content-moderation-system/backend/src/utils/tools.py`
```
"""
External tools and utilities for content moderation.

This module provides helper functions used by moderation agents.
Includes both keyword-based and ML-based detection methods.
"""

import re
import random
from typing import Dict, Any
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

# ML Classifier integration
def get_ml_classifier():
    """Get or initialize the ML classifier (lazy loading)."""
    try:
        from ..ml.ml_classifier import get_ml_classifier as get_classifier
        return get_classifier()
    except Exception as e:
        logger.warning(f"ML classifier not available: {e}")
        return None


def analyze_text_sentiment(text: str) -> Dict[str, Any]:
    """
    Analyze sentiment of text content.

    Args:
        text: Content text to analyze

    Returns:
        Dictionary with sentiment and score
    """
    # Simplified sentiment analysis (in production, use proper NLP library)
    positive_words = ['love', 'great', 'awesome', 'excellent', 'good', 'happy', 'wonderful', 'amazing']
    negative_words = ['hate', 'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'worst', 'pathetic']

    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)

    if positive_count > negative_count:
        sentiment = "positive"
        score = min(0.5 + (positive_count * 0.1), 1.0)
    elif negative_count > positive_count:
        sentiment = "negative"
        score = max(-0.5 - (negative_count * 0.1), -1.0)
    else:
        sentiment = "neutral"
        score = 0.0

    return {
        "sentiment": sentiment,
        "score": score
    }


def detect_toxicity(text: str, use_ml: bool = True) -> Dict[str, Any]:
    """
    Detect toxic language in text using ML models with keyword fallback.

    Args:
        text: Content text to analyze
        use_ml: Whether to try ML-based detection first (default: True)

    Returns:
        Dictionary with toxicity score and categories
    """
    # Try ML-based detection first
    if use_ml:
        classifier = get_ml_classifier()
        if classifier:
            try:
                ml_result = classifier.predict_toxicity(text)
                # Add keyword counts for compatibility
                from ..ml.keyword_detectors import keyword_toxicity_detection
                keyword_result = keyword_toxicity_detection(text)
                ml_result["profanity_count"] = keyword_result["profanity_count"]
                ml_result["insult_count"] = keyword_result["insult_count"]
                ml_result["threat_count"] = keyword_result["threat_count"]
                return ml_result
            except Exception as e:
                logger.error(f"ML toxicity detection failed, using fallback: {e}")

    # Fallback to keyword-based detection
    from ..ml.keyword_detectors import keyword_toxicity_detection
    return keyword_toxicity_detection(text)


def detect_hate_speech_patterns(text: str, use_ml: bool = True) -> Dict[str, Any]:
    """
    Detect hate speech patterns using ML models with keyword fallback.

    Args:
        text: Content text to analyze
        use_ml: Whether to try ML-based detection first (default: True)

    Returns:
        Dictionary with detection results
    """
    # Try ML-based detection first
    if use_ml:
        classifier = get_ml_classifier()
        if classifier:
            try:
                ml_result = classifier.predict_hate_speech(text)
                return {
                    "detected": ml_result.get("is_hate_speech", False),
                    "score": ml_result.get("hate_score", 0.0),
                    "patterns": ml_result.get("patterns", []),
                    "confidence": ml_result.get("confidence", 0.8),
                    "detection_method": ml_result.get("detection_method", "ml")
                }
            except Exception as e:
                logger.error(f"ML hate speech detection failed, using fallback: {e}")

    # Fallback to keyword-based detection
    from ..ml.keyword_detectors import keyword_hate_speech_detection
    return keyword_hate_speech_detection(text)


def check_policy_violations(
    content_text: str,
    content_type: str,
    user_reputation: float,
    toxicity_score: float
) -> Dict[str, Any]:
    """
    Check content against community policies.

    Args:
        content_text: Content to check
        content_type: Type of content
        user_reputation: User's reputation score
        toxicity_score: Toxicity score from detection

    Returns:
        Dictionary with violations and severity
    """
    violations = []
    flags = []
    severity = "none"

    text_lower = content_text.lower()

    # Check for hate speech policy
    hate_indicators = ['hate', 'supremacist', 'inferior']
    if any(ind in text_lower for ind in hate_indicators):
        violations.append("hate_speech")
        severity = "high"

    # Check for harassment policy
    harassment_indicators = ['harass', 'stalk', 'threaten', 'kill yourself', 'kys']
    if any(ind in text_lower for ind in harassment_indicators):
        violations.append("harassment")
        severity = "high"

    # Check for violence policy
    violence_indicators = ['kill', 'murder', 'assault', 'attack', 'bomb']
    if any(ind in text_lower for ind in violence_indicators):
        violations.append("violence")
        severity = "high"

    # Check for spam (based on patterns)
    spam_indicators = [
        'click here', 'buy now', 'limited offer', 'act now',
        'guaranteed', 'free money', 'work from home'
    ]
    if sum(1 for ind in spam_indicators if ind in text_lower) >= 2:
        violations.append("spam")
        severity = "medium" if severity == "none" else severity

    # Check for sexual content
    sexual_indicators = ['sex', 'porn', 'nude', 'xxx']
    if any(ind in text_lower for ind in sexual_indicators):
        violations.append("sexual_content")
        severity = "medium" if severity == "none" else severity

    # Check for misinformation indicators
    misinfo_indicators = [
        'guaranteed cure', 'doctors don\'t want you to know',
        'secret truth', 'mainstream media lies'
    ]
    if any(ind in text_lower for ind in misinfo_indicators):
        violations.append("misinformation")
        flags.append("potential_misinformation")

    # Check for self-harm content
    self_harm_indicators = ['suicide', 'self harm', 'end it all', 'want to die']
    if any(ind in text_lower for ind in self_harm_indicators):
        violations.append("self_harm")
        severity = "critical"
        flags.append("urgent_review")

    # Adjust severity based on toxicity
    if toxicity_score > 0.8 and severity == "none":
        severity = "high"
    elif toxicity_score > 0.6 and severity == "none":
        severity = "medium"
    elif toxicity_score > 0.3 and severity == "none":
        severity = "low"

    # Adjust based on user reputation
    if user_reputation < 0.3 and len(violations) > 0:
        # Increase severity for low-reputation users
        if severity == "low":
            severity = "medium"
        elif severity == "medium":
            severity = "high"

    return {
        "violations": violations,
        "severity": severity,
        "flags": flags
    }


def check_spam_indicators(content_text: str, user_profile: Any) -> Dict[str, Any]:
    """
    Check for spam indicators.

    Args:
        content_text: Content to check
        user_profile: User profile information

    Returns:
        Dictionary with spam detection results
    """
    indicators = []
    spam_score = 0.0

    text_lower = content_text.lower()

    # Check for excessive links
    url_count = text_lower.count('http://') + text_lower.count('https://') + text_lower.count('www.')
    if url_count > 3:
        indicators.append("excessive_links")
        spam_score += 0.3

    # Check for promotional language
    promo_words = ['buy', 'sale', 'discount', 'offer', 'deal', 'cheap', 'free']
    promo_count = sum(1 for word in promo_words if word in text_lower)
    if promo_count >= 3:
        indicators.append("promotional_content")
        spam_score += 0.2

    # Check for repetitive characters
    if re.search(r'(.)\1{5,}', content_text):
        indicators.append("repetitive_characters")
        spam_score += 0.15

    # Check for new account spamming
    if user_profile.account_age_days < 7 and url_count > 0:
        indicators.append("new_account_with_links")
        spam_score += 0.25

    # Check for ALL CAPS
    if len(content_text) > 20 and content_text.isupper():
        indicators.append("all_caps")
        spam_score += 0.1

    spam_score = min(spam_score, 1.0)

    return {
        "is_spam": spam_score > 0.5,
        "spam_score": spam_score,
        "indicators": indicators
    }


def calculate_user_reputation(
    current_score: float,
    total_posts: int,
    total_violations: int,
    previous_warnings: int,
    previous_suspensions: int,
    account_age_days: int,
    current_violation_severity: str
) -> Dict[str, Any]:
    """
    Calculate updated user reputation score.

    Args:
        current_score: Current reputation score
        total_posts: Total number of posts
        total_violations: Total violations
        previous_warnings: Number of warnings
        previous_suspensions: Number of suspensions
        account_age_days: Account age in days
        current_violation_severity: Severity of current violation

    Returns:
        Dictionary with updated reputation metrics
    """
    # Start with current score
    new_score = current_score

    # Penalty for current violation
    violation_penalties = {
        "critical": -0.3,
        "high": -0.2,
        "medium": -0.1,
        "low": -0.05,
        "none": 0.0
    }
    new_score += violation_
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
 
 - **[GenAI & Transformers Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=readme&utm_campaign=interview)** - GenAI and transformer interview prep &nbsp;·&nbsp; [PDF](./docs/genai-interview-questions.pdf)
 - **[RAG, Prompting & Modern GenAI Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivRAGPromptEng?utm_source=github&utm_medium=readme&utm_campaign=interview)** - Retrieval, prompting and applied GenAI
@@ -85,7 +85,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 ### 🤖 Agentic AI & Orchestration
 - **[Agentic AI](./genai-usecases/agentic-ai/)** - Multi-agent systems with CrewAI & LangGraph frameworks
 - **[Tura](https://github.com/Tura-AI/tura)** - Local, open-source coding agent with CLI, TUI, web, and desktop interfaces for context-aware development workflows
-- **[AI Patterns](./genai-usecases/ai-patterns/)** - 25 advanced reasoning patterns (Chain-of-Thought, ReAct, Tree-of-Thought, Meta-Prompting, etc.)
+- **[AI P
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
 
-👉 [Notebooks](notebooks/)
+[Notebooks](notebooks/)
 
    - [Basic RAG](notebooks/basic-rag.ipynb)
    - [Corrective RAG](notebooks/corrective-rag.ipynb)
@@ -134,15 +134,15 @@ streamlit run app.py
 ---
 **F. Try Advanced RAG Techniques in Streamlit UI**
 
-> 🔑 **Tech stack:** Google Gemini API (LLM + Embeddings) + ChromaDB. Requires a free `GOOGLE_API_KEY` — **not** a Groq key. See step 5 below.
+> **Tech stack:** Google Gemini API (LLM + Embeddings) + ChromaDB. Requires a free `GOOGLE_API_KEY` — **not** a Groq key. See step 5 below.
 
-**🛠️ Setup Instructions**
+** Setup Instructions**
 
-**✅ Prerequisites**
+** Prerequisites**
    - Python 3.10 or higher
    - pip (Python package installer)
 
-**📦 Installation & Running App**
+** Installation & Running App**
    1. Clone the repository:
 
       ```bash
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
-- **Python**: Programming Language
-- **LangGraph**: State-of-the-art agent workflow orchestration
-- **Gemini LLM API (Free tier)**: Google's AI models (gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite & Gemini Embedding Models)
-- **Tavily Search API (Free Tier)**: Advanced web search integration
-- **ChromaDB (Open Source)**: High performance open-source vector database
-- **Streamlit**: Interactive Python-based web interface
-
-## ⚡ Quick Start
-
-### 📋 Installation & Running App
-
-   1. Prerequisites
-      - Python 3.10 or higher
-      - pip (Python package installer)
-   2. Clone the repository:
-
-      ```bash
-      git clone https://github.com/genieincodebottle/generative-ai.git
-
-      # Windows
-      cd genai-usecases\advance-rag\agentic-rag
-
-      # Linux / macOS
-      cd genai-usecases/advance-rag/agentic-rag
-      ```
-   3. Open the project in VS Code or any code editor.
-   4. Create a virtual environment:
-
-      ```bash
-      pip install uv  # skip if uv is alread
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
+    """Run the full agent pipeline over the indexed documents."""
+    try:
+        return manager.query(request.question, request.thread_id)
+    except SystemNotReady as exc:
+        raise HTTPException(status_code=409, detail=str(exc)) from exc
+    except Exception as exc:
+        raise HTTPException(status_code=502, detail=f"Query failed: {exc}") from exc
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

**File**: `genai-usecases/advance-rag/agentic-rag/pytest.ini` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+[pytest]
+testpaths = tests
+pythonpath = .
+addopts = -q
```

**File**: `genai-usecases/advance-rag/agentic-rag/run.py` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+"""Start the API and the UI together.
+
+    python run.py
+
+Runs uvicorn (FastAPI) and Streamlit as child processes, waits for the API to
+answer /health before starting the UI, and shuts both down on Ctrl+C. Needs no
+install of this project: it puts the project root on PYTHONPATH itself.
+
+Run the two halves separately if you prefer:
+
+    uvicorn api.main:app --reload --port 8000
+    streamlit run ui/app.py
+"""
+
+from __future__ import annotations
+
+import os
+import signal
+import subprocess
+import sys
+import time
+import urllib.error
+import urllib.request
+from pathlib import Path
+
+PROJECT_ROOT = Path(__file__).resolve().parent
+API_PORT = int(os.getenv("API_PORT", "8000"))
+UI_PORT = int(os.getenv("UI_PORT", "8501"))
+API_BASE_URL = f"http://127.0.0.1:{API_PORT}"
+
+processes: list[subprocess.Popen] = []
+
+
+def child_env() -> dict:
+    """Environment for the children: project root importable, API URL known."""
+    env = os.environ.copy()
+    existing = env.get("PYTHONPATH", "")
+    env["PYTHONPATH"] = (
+        str(PROJECT_ROOT) + (os.pathsep + existing if existing else "")
+    )
+    env["API_BASE_URL"] = API_BASE_URL
+    return env
+
+
+def wait_for_api(timeout: float | None = None) -> bool:
+    """Poll /health until the API answers, so the UI never starts too early.
+
+    The wait is generous and configurable because a cold first start can be
+    slow: importing heavy agent frameworks, or downloading a local embedding
+    model, can take minutes the first time. Timing out early kills a perfectly
+    healthy API and reports that it did not start, which sends the reader
+    hunting for a bug that is not there.
+    """
+    timeout = timeout if timeout is not None else float(
+        os.getenv("API_START_TIMEOUT", "300")
+    )
+    deadline = time.time() + timeout
+    started = time.time()
+    notified = False
+    while time.time() < deadline:
+        if processes and processes[0].poll() is not None:
+            return False  # the API died; no point waiting out the timeout
+        try:
+            with urllib.request.urlopen(f"{API_BASE_URL}/health", timeout=10) as response:
+                if response.status == 200:
+                    return True
+        except (urllib.error.URLError, OSError):
+            if not notified and time.time() - started > 20:
+                print("  still starting (first-run imports can be slow)...", flush=True)
+                notified = True
+            time.sleep(0.5)
+    return False
+
+
+def shutdown(*_args) -> None:
+    for process in processes:
+        if process.poll() is None:
+            process.terminate()
+    for process in processes:
+        try:
+            process.wait(timeout=10)
+        except subprocess.TimeoutExpired:
+            process.kill()
+
+
+def main() -> int:
+    env = child_env()
+
+    signal.signal(signal.SIGINT, lambda *a: (shutdown(), sys.exit(0)))
+    if hasattr(signal, "SIGTERM"):
+        signal.signal(signal.SIGTERM, lambda *a: (shutdown(), sys.exit(0)))
+
+    print(f"Starting API on {API_BASE_URL} ...", flush=True)
+    processes.append(subprocess.Popen(
+        [sys.executable, "-m", "uvicorn", "api.main:app",
+         "--host", "127.0.0.1", "--port", str(API_PORT)],
+        cwd=PROJECT_ROOT, env=env,
+    ))
+
+    if not wait_for_api():
+        print("The API did not start. Its output is above.\n"
+              "If it was still loading, raise the wait with "
+              "API_START_TIMEOUT=600 python run.py", file=sys.stderr)
+        shutdown()
+        return 1
+
+    print(f"API ready.  Docs: {API_BASE_URL}/docs", flush=True)
+    print(f"Starting UI on http://localhost:{UI_PORT} ...", flush=True)
+    processes.append(subprocess.Popen(
+        [sys.executable, "-m", "streamlit", "run", "ui/app.py",
+         "--server.port", str(UI_PORT)],
+        cwd=PROJECT_ROOT, env=env,
+    ))
+
+    try:
+        while True:
+            for process in processes:
+                if process.poll() is not None:
+                    print("A service exited; shutting down the other.", file=sys.stderr)
+                    shutdown()
+                    return process.returncode or 0
+            time.sleep(0.5)
+    except KeyboardInterrupt:
+        shutdown()
+        return 0
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `genai-usecases/advance-rag/agentic-rag/services/agentic_rag_system.py` (renamed, +46/-9)
```diff
@@ -39,7 +39,7 @@
 from tavily import TavilyClient
 
 # Pydantic for structured outputs
-from pydantic import BaseModel, Field, PrivateAttr
+from pydantic import BaseModel, ConfigDict, Field, PrivateAttr
 
 # Environment
 from dotenv import load_dotenv
@@ -51,6 +51,36 @@
 logging.basicConfig(level=logging.INFO)
 logger = logging.getLogger(__name__)
 
+
+def message_text(response) -> str:
+    """Flatten an LLM response into plain text.
+
+    Current Gemini models return ``.content`` as a *list of content blocks*
+    (``[{"type": "text", "text": ...,  "extras": {...}}]``) rather than a
+    string. Code written against the old string contract then does two wrong
+    things silently: it renders the raw block repr - base64 thinking signature
+    and all - to the user, and ``len(answer)`` measures the number of blocks,
+    so a 900-character answer reads as length 1 and fails every length check.
+    """
+    content = getattr(response, "content", response)
+
+    if isinstance(content, str):
+        return content
+
+    if isinstance(content, list):
+        parts = []
+        for block in content:
+            if isinstance(block, str):
+                parts.append(block)
+            elif isinstance(block, dict):
+                text = block.get("text")
+                if text:
+                    parts.append(text)
+        return "".join(parts)
+
+    return str(content)
+
+
 class QueryComplexity(Enum):
     """Enum for query complexity levels"""
     SIMPLE = "simple"
@@ -101,16 +131,23 @@ class WebSearchTool(BaseTool):
     description: str = "Search the web for current information, recent developments, or facts not in the knowledge base"
     _tavily_client: Optional[TavilyClient] = PrivateAttr(default=None)
     
-    class Config:
-        arbitrary_types_allowed = True
-    
+    # Pydantic v2 style. The v1 `class Config` form still works but is
+    # deprecated and is removed in Pydantic v3.
+    model_config = ConfigDict(arbitrary_types_allowed=True)
+
     def __init__(self, tavily_client: Optional[TavilyClient] = None, **kwargs):
         super().__init__(
             name="web_search",
             description="Search the web for current information, recent developments, or facts not in the knowledge base",
             **kwargs
         )
-        self._tavily_client = tavily_client or TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
+        if tavily_client is not None:
+            self._tavily_client = tavily_client
+        else:
+            # Building a TavilyClient with a None key raises. Web search is
+            # optional, so stay unconfigured and report it from _run instead.
+            key = os.getenv("TAVILY_API_KEY")
+            self._tavily_client = TavilyClient(api_key=key) if key else None
     
     @property
     def tavily_client(self) -> Optional[TavilyClient]:
@@ -149,8 +186,8 @@ def _run(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
 class AgenticRAGConfig:
     """Configuration for the Agentic RAG system"""
     # Model configurations
-    llm_model: str = "gemini-2.5-flash"
-    embedding_model: str = "models/text-embedding-004"
+    llm_model: str = "gemini-flash-latest"
+    embedding_model: str = "models/gemini-embedding-001"
     temperature: float = 0.1
     max_tokens: int = 8192
     
@@ -398,7 +435,7 @@ def _planning_agent(self, state: AgentState) -> AgentState:
             
             # Try to parse structured output
             try:
-                analysis = parser.parse(response.content)
+                analysis = parser.parse(message_text(response))
             except:
                 # Fallback to basic analysis
                 analysis = QueryAnalysis(
@@ -577,7 +614,7 @@ def _synthesis_agent(self, state: AgentState) -> AgentState:
             })
             
             response = self.llm.invoke(formatted_prompt)
-            state.final_answer = response.content
+            state.final_answer = message_text(response)
             
             # Calculate confidence based on available information
             doc_score = min(len(state.retrieved_documents) / self.config.k_retrieval, 1.0) * 0.6
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

### Incident Patch 6: `75c9fe64` (2026-08-04)
**Commit Message**: Add AI Blogs link to Quick Links section

**File**: `GenAI_Roadmap.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 
 
 ### 🔗 Quick Links
- [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) | [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
+ [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) | [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI Blogs](https://aimlcompanion.ai/blog?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
 
 ### 📦 Comprehensive Prep Resources
 
```

---

### Incident Patch 7: `d57cdc99` (2026-08-04)
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

### Incident Patch 8: `84d98740` (2026-08-03)
**Commit Message**: Revise popular guides in README

Updated the popular guides section to include AI History and ML Project Interactive Visualization.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ I built **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medi
 
 [![Try AI-ML Companion](https://img.shields.io/badge/Try%20AI--ML%20Companion-Live%20App-blue?style=for-the-badge)](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=cta)
 
-**Popular guides:** [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Full Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=popular) • [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs)
+**Popular guides:** [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Full Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=popular) • [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) • [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
 
 <br>
 Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated with the latest GenAI resources :)
```

---

### Incident Patch 9: `9c96d9a8` (2026-08-03)
**Commit Message**: Update Quick Links in GenAI Roadmap

**File**: `GenAI_Roadmap.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 
 
 ### 🔗 Quick Links
- [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs)
+ [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI History](https://aimlcompanion.ai/ai-story?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs) | [ML Project Interactive Visualization](https://aimlcompanion.ai/ml-visualization?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)
 
 ### 📦 Comprehensive Prep Resources
 
```

---

### Incident Patch 10: `c34372a7` (2026-08-03)
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

### Incident Patch 11: `3a918593` (2026-08-03)
**Commit Message**: Revise README with updated guides and resources

Updated popular guides section and removed outdated links. Added new resources for core concepts and learning paths.

**File**: `README.md` (modified, +6/-10)
```diff
@@ -20,7 +20,7 @@ I built **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medi
 
 [![Try AI-ML Companion](https://img.shields.io/badge/Try%20AI--ML%20Companion-Live%20App-blue?style=for-the-badge)](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=cta)
 
-**Popular guides:** [What is RAG](https://aimlcompanion.ai/guide/what-is-rag?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Agentic AI](https://aimlcompanion.ai/guide/agentic-ai?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Transformer Architecture](https://aimlcompanion.ai/guide/transformer-architecture?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Full Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=popular)
+**Popular guides:** [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks)  • [Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=readme&utm_campaign=popular) • [Full Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=popular) • [GenAI Imp Docs](https://github.com/genieincodebottle/generative-ai/tree/main/docs)
 
 <br>
 Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated with the latest GenAI resources :)
@@ -36,14 +36,11 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 ### 🎯 Getting Started
 - **[AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Interactive AI/ML learning platform with 22 tracks, 300+ modules, visualizations, quizzes, and hands-on coding (ML fundamentals → LLMs → MLOps)
 - **[GenAI Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Your complete learning path for GenAI (interactive) &nbsp;·&nbsp; [markdown](./GenAI_Roadmap.md)
-- **[AI/ML Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Comprehensive AI/ML learning guide &nbsp;·&nbsp; [PDF](./docs/ai_ml_roadmap.pdf)
-- **[Essential GenAI Terms](https://aimlcompanion.ai/glossary?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Illustrated glossary of key terminology &nbsp;·&nbsp; [PDF](./docs/essential-terms-genai.pdf)
-- **[What is Generative AI](https://aimlcompanion.ai/guide/generative-ai?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Full guide to GenAI foundations
-- **[LLM Fundamentals](https://aimlcompanion.ai/guide/transformer-architecture?utm_source=github&utm_medium=readme&utm_campaign=resources)** - How transformers and LLMs work &nbsp;·&nbsp; [PDF](./docs/llm_fundamentals.pdf)
-
-### 🧠 Core Concepts & Guides
-- **[What is RAG](https://aimlcompanion.ai/guide/what-is-rag?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Retrieval-Augmented Generation explained end to end
-- **[Vector Embeddings Guide](./docs/vector-embeddings-guide.pdf)** - Understanding vector representations (PDF)
+- **[AI/ML Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=resources)** - Comprehensive AI/ML learning  &nbsp;·&nbsp; [PDF](./docs/ai_ml_roadmap.pdf)
+
+
+### 🧠 Core Concepts & s
+- **[Vector Embeddings ](./docs/vector-embeddings-guide.pdf)** - Understanding vector representations (PDF)
 - **[Prompt Engineering](./docs/prompt_engineering.ipynb)** - Crafting effective prompts (notebook)
 - **[AI Patterns](./docs/ai-patterns.pdf)** - Top 25 AI design patterns (PDF)
 - **[ML Reference Guide](./docs/ml-reference-guide.pdf)** - Machine learning reference (PDF)
@@ -122,7 +119,6 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 |----------|-----------|
 | **Learning Platform** | [AI-ML Companion](https://aimlcompanion.ai/?utm_source=github&utm_medium=readme&utm_campaign=table) — Interactive AI/ML learning with 22 tracks, 300+ modules, quizzes & coding |
 | **Learning Path** | [GenAI Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=table) • [AI/ML Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=readme&utm_campaign=table) |
-| **Fundamentals** | [What is RAG](https://aimlcompanion.ai/guide/what-is-rag?utm_source=github&utm_medium=readme&utm_campaign=table) • [LLM Fundamentals](https://aimlcompanion.ai/guide/transformer-architecture?utm_source=github&utm_medium=readme&utm_campaign=table) • [Glossary](https://aimlcompanion.ai/glossary?utm_source=github&utm_medium=readme&utm_campaign=table) |
 | **Cloud Platforms** | [AWS](./docs/genai-with-aws-cloud.pdf) • [Azure](./docs/genai-with-azure-cloud.pdf) • [VertexAI](./docs/genai-with-vertexai.pdf) |
 | **Interview Prep** | [Interview Q&A track (1
```

---

### Incident Patch 12: `4d57f752` (2026-08-03)
**Commit Message**: Revise Quick Links in GenAI Roadmap

Updated the Quick Links section to include Cheatsheets and corrected the formatting of the last link.

**File**: `GenAI_Roadmap.md` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 
 
 ### 🔗 Quick Links
- [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Essential Terms](https://aimlcompanion.ai/glossary?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) |
+ [Interactive Roadmap](https://aimlcompanion.ai/roadmap?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Cheatsheets](https://aimlcompanion.ai/cheatsheets?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [AI/ML/Agentic AI Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/ivGenAICore?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [Agentic AI Interview Q&A](https://aimlcompanion.ai/module/interviewScenarios/agentInterviewPrep?utm_source=github&utm_medium=roadmap&utm_campaign=quicklinks) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) | [GenAI Imp Docs(https://github.com/genieincodebottle/generative-ai/tree/main/docs)]
 
 ### 📦 Comprehensive Prep Resources
 
```

---

### Incident Patch 13: `3fb2e8a9` (2026-05-01)
**Commit Message**: Update Quick Links in GenAI Roadmap

**File**: `GenAI_Roadmap.md` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ Your go-to hub for end-to-end GenAI learning. ⭐ Star this repo to stay updated
 
 
 ### 🔗 Quick Links
- [GenAI Essential Terms](https://github.com/genieincodebottle/generative-ai/blob/main/docs/essential-terms-genai.pdf) | [GenAI Interview Q & A](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-interview-questions.pdf) |  [Agentic AI Interview Q & A](./docs/agentic-ai-interview-questions.pdf) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) |
+ [GenAI Essential Terms](https://github.com/genieincodebottle/generative-ai/blob/main/docs/essential-terms-genai.pdf) | [AI Scenario based Interview Q&A](https://aimlcompanion.ai/curriculum/interviewScenarios)| [GenAI Interview Q & A](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-interview-questions.pdf) |  [Agentic AI Interview Q & A](./docs/agentic-ai-interview-questions.pdf) | [GenAI Usecases](./genai-usecases/) | [n8n Automation](./genai-usecases/n8n-automation/) |  [GenAI on Azure](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-azure-cloud.pdf) | [GenAI on AWS](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-aws-cloud.pdf) | [GenAI on VertexAI](https://github.com/genieincodebottle/generative-ai/blob/main/docs/genai-with-vertexai.pdf) |
 
 ### 📦 Comprehensive Prep Resources
 
@@ -147,4 +147,4 @@ Each phase is split by week and builds progressively.
 |Gemini 2.5|[Link](https://storage.googleapis.com/deepmind-media/gemini/gemini_v2_5_report.pdf)|
 |DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning|[Link](https://arxiv.org/abs/2501.12948)|
 |DeepSeek-V3 Technical Report|[Link](https://arxiv.org/abs/2412.19437)|
-|Mixtral of Experts|[Link](https://arxiv.org/abs/2401.04088)|
\ No newline at end of file
+|Mixtral of Experts|[Link](https://arxiv.org/abs/2401.04088)|
```

---

### Incident Patch 14: `2a49b486` (2026-03-26)
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

**File**: `genai-usecases/graph-qa/README.md` (modified, +2/-10)
```diff
@@ -56,16 +56,8 @@ Or any other information available in the Movie graph database.
       uv venv
       .venv\Scripts\activate # On Linux -> source venv/bin/activate
       ```
-   4. Create a requirements.txt file and add the following libraries:
-      ```
-      langchain>=0.3.27
-      langchain-community>=0.2.1
-      langchain-google-genai>=2.1.8
-      neo4j>=5.28.1
-      streamlit>=1.47.1
-      streamlit-chat>=0.1.1
-      python-dotenv==1.1.1
-      ```
+   4. The `requirements.txt` file contains all necessary dependencies.
+
    5. Install dependencies:
       ```bash
       uv pip install -r requirements.txt
```

**File**: `genai-usecases/llama-4-multi-function-app/README.md` (modified, +88/-71)
```diff
@@ -1,74 +1,91 @@
-### All-in-One Chat, OCR, RAG & Agentic AI App with CrewAI Integration
+# All-in-One Chat, OCR, RAG & Agentic AI App
 
 <img src="../../images/llama4_app.png"/>
 
-This app is a unified Streamlit interface that brings together conversational AI, document OCR, Retrieval-Augmented Generation (RAG), and multi-agent workflows-powered by CrewAI and the multimodal 🦙 Llama-4 Scout model.
-
-### 🔗 Dependencies
-
-
-
-### ⚙️ Setup Instructions
-
-- #### Prerequisites
-   - Python 3.10 or higher
-   - pip (Python package installer)
-
-- #### Installation
-   1. Clone the repository:
-      ```bash
-      git clone https://github.com/genieincodebottle/generative-ai.git
-      cd genai-usecases\llama-4-multi-function-app
-      ```
-   2. Open the Project in VS Code or any code editor.
-   3. Create a virtual environment:
-      ```bash
-      pip install uv #if uv not installed
-      uv venv
-      .venv\Scripts\activate # On Linux -> source venv/bin/activate
-      ```
-   4. Create a requirements.txt file and add the following libraries:
-      
-      ```bash
-      streamlit>=1.43.2 
-      groq>=0.22.0
-      python-dotenv>=1.1.0
-      langchain-groq>=0.3.2
-      langchain-huggingface>=0.1.2
-      langchain-community>=0.0.27
-      langchain>=0.0.27
-      python-dotenv>=1.0.0
-      pypdf>=4.0.0
-      faiss-cpu>=1.7.4
-      pillow>=10.2.0
-      streamlit-chat>=0.1.1
-      sentence-transformers>=2.2.2
-      crewai>=0.28.5
-      crewai-tools
-      google-genai>=1.5.0
-      plotly
-      ragas>=0.1.0
-      datasets>=2.0.0
-      pandas>=1.0.0
-      ```
-   5. Install dependencies:
-      ```bash
-      uv pip install -r requirements.txt
-      ```
-   6. Set up environment variables
-      * Rename .env.example to .env
-      * Update the file with your API keys:
-      
-      ```bash
-      GROQ_API_KEY=your_key_here   # using the free-tier Open weight LLM API
-      GOOGLE_API_KEY=your_key_here # Using the free-tier API in CrewAI as a fallback when the primary Llama 4 Scout model fails.
-      ```
-      * 🔑 Get your API keys:
-
-      For **GROQ_API_KEY** follow this -> https://console.groq.com/keys
-      
-      For **GOOGLE_API_KEY** follow this -> https://aistudio.google.com/app/apikey
-
-   7. Run App
-      
-      `streamlit run app.py`
\ No newline at end of file
+A unified Streamlit interface that brings together conversational AI, document OCR, Retrieval-Augmented Generation (RAG), and multi-agent workflows - powered by CrewAI and the multimodal Llama-4 Scout model via Groq.
+
+## Features
+
+| Tab | What it does |
+|-----|-------------|
+| **Chat** | Conversational AI with Llama 4 Scout multimodal model (text + image) |
+| **OCR** | Extract text from images using Llama 4 Scout's vision capabilities |
+| **RAG** | Upload PDFs, build a vector index, and ask questions grounded in your documents |
+| **Agentic AI** | Multi-agent workflows powered by CrewAI (research, analysis, content generation) |
+| **RAG Evaluation** | Evaluate RAG quality using RAGAS metrics (faithfulness, relevance, context precision) |
+
+## API Keys (Both Free-Tier)
+
+| Key | Where to get it | Used for |
+|-----|----------------|----------|
+| **GROQ_API_KEY** | [console.groq.com/keys](https://console.groq.com/keys) | Primary LLM (Llama 4 Scout) |
+| **GOOGLE_API_KEY** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | Fallback LLM for CrewAI + embeddings |
+
+> **Both APIs are free-tier.** No credit card required.
+
+## Setup Instructions
+
+### Prerequisites
+- Python 3.10 or higher
+- pip (Python package installer)
+
+### Installation
+
+1. Clone the repository:
+   ```bash
+   git clone https://github.com/genieincodebottle/generative-ai.git
+   cd genai-usecases/llama-4-multi-function-app
+   ```
+
+2. Create a virtual environment:
+   ```bash
+   pip install uv    # if uv not installed
+   uv venv
+   .venv\Scripts\activate    # On Linux/Mac: source .venv/bin/activate
+   ```
+
+3. Install dependencies:
+   ```bash
+   uv pip install -r requirements.txt
+   ```
+   > **Note:** This installs ~50 packages including CrewAI, RAGAS, sentence-transformers, and FAISS. First install may take 5-10 minutes.
+
+4. Set up environment variables:
+   ```bash
+   cp .env.example .env
+   ```
+   Edit `.env` and add your keys:
+   ```bash
+   GROQ_API_KEY=your_groq_key_here     # Free-tier
+   GOOGLE_API_KEY=your_google_key_here  # Free-tier
+   ```
+
+5. Run the app:
+   ```bash
+   streamlit run app.py
+   ```
+
+## Usage Tips
+
+- **Start with Chat tab** - simplest way to test your setup
+- **For RAG**: Upload a PDF in the sidebar, wait for indexing, then ask questions
+- **For OCR**: Upload an image and the model will extract text
+- **CrewAI agents** take 2-5 minutes per run (this is normal - multiple agents collaborate)
+- **RAG Evaluation** uses RAGAS metrics - requires both Groq and Google API keys
+
+## Tech Stack
+
+- **UI**: Streamlit
+- **Primary LLM**: Llama 4 Scout 
```

**File**: `genai-usecases/llm-providers/README.md` (modified, +11/-22)
```diff
@@ -49,38 +49,27 @@ You can run each LLM provider independently using dedicated Streamlit UI scripts
       uv venv
       .venv\Scripts\activate # On Linux -> source venv/bin/activate
       ```
-   4. Create a requirements.txt file and add the following libraries:
-      
-      ```bash
-        streamlit>=1.47.1
-        langchain-anthropic>=0.3.18
-        langchain-google-genai>=2.1.8
-        langchain-groq>=0.3.6
-        python-dotenv>=1.0.1
-      ```
+   4. The `requirements.txt` file contains all necessary dependencies.
+
    5. Install dependencies:
       
       ```bash
       uv pip install -r requirements.txt
       ```
    6. Configure Environment
       * Rename .env.example → .env
-      * Update with your keys:
+      * **You only need ONE provider key.** Start with a free one:
 
         ```bash
-        ANTHROPIC_API_KEY=your_anthropic_api_key_here
-        GOOGLE_API_KEY=your_google_api_key_here
-        OPENAI_API_KEY=your_openai_api_key_here
-        GROQ_API_KEY=your_groq_api_key_here
-        ```
-      * Get your keys here:
-        * 🔑 [GROQ_API_KEY](https://console.groq.com/keys)
-
-        * 🔑 [ANTHROPIC_API_KEY](https://console.anthropic.com/settings/keys)
+        # --- Free-tier (no credit card) - start here ---
+        GROQ_API_KEY=your_groq_key_here        # Free - https://console.groq.com/keys
+        GOOGLE_API_KEY=your_google_key_here     # Free - https://aistudio.google.com/apikey
 
-        * 🔑 [OPENAI_API_KEY](https://platform.openai.com/api-keys)
-
-        * 🔑 [GOOGLE_API_KEY](https://aistudio.google.com/apikey)
+        # --- Paid (optional) ---
+        ANTHROPIC_API_KEY=your_anthropic_key    # Paid - https://console.anthropic.com/settings/keys
+        OPENAI_API_KEY=your_openai_key          # Paid - https://platform.openai.com/api-keys
+        ```
+      > **Recommended for beginners:** Get a free Groq or Google Gemini key. You can add paid providers later.
 
 
    7. Run the different LLM API located in `genai-usecases/llm-providers/python_scripts`
```

---

### Incident Patch 15: `2d49f299` (2026-03-26)
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

**File**: `genai-usecases/cache_augmented_generation/requirements.txt` (modified, +5/-5)
```diff
@@ -1,9 +1,9 @@
 streamlit>=1.41.1
-plotly>=5.24.1 
+plotly>=5.24.1
 pandas>=2.2.3
 python-dotenv>=1.0.1
 
-transformers
-sentence-transformers
-accelerate
-bitsandbytes
\ No newline at end of file
+transformers>=4.45.0
+sentence-transformers>=3.0.0
+accelerate>=1.0.0
+bitsandbytes>=0.44.0
```

**File**: `genai-usecases/chatbot-with-memory/app.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 from typing import Optional
 
 # LangChain imports
-from langchain.text_splitter import RecursiveCharacterTextSplitter
+from langchain_text_splitters import RecursiveCharacterTextSplitter
 from langchain_community.document_loaders import PyPDFLoader
 from langchain_community.vectorstores import FAISS
 from langchain_huggingface import HuggingFaceEmbeddings
```

**File**: `genai-usecases/content-moderation-system/backend/requirements.txt` (modified, +3/-3)
```diff
@@ -19,6 +19,6 @@ chromadb==1.3.5
 python-dotenv==1.2.1
 
 # Observability and monitoring (optional but recommended)
-opentelemetry-api==1.21.0
-opentelemetry-sdk==1.21.0
-opentelemetry-instrumentation-fastapi==0.42b0
+opentelemetry-api==1.33.0
+opentelemetry-sdk==1.33.0
+opentelemetry-instrumentation-fastapi==0.54b0
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
