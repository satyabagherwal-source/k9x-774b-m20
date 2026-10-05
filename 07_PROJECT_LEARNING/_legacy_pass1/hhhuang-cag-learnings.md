# Forensic Learning Record (Deep Inspection): hhhuang/CAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hhhuang-cag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hhhuang/CAG](https://github.com/hhhuang/CAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:24:12.928Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hhhuang/CAG`
- **Description**: Cache-Augmented Generation: A Simple, Efficient Alternative to RAG
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1602 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cag/dataset.py`
```
import json
import random
import pandas as pd
from typing import Iterator
from config import ConfigName, get_config

rand_seed = None

def _parse_squad_data(raw):
    dataset = {"ki_text": [], "qas": []}

    for k_id, data in enumerate(raw["data"]):
        article = []
        for p_id, para in enumerate(data["paragraphs"]):
            article.append(para["context"])
            for qa in para["qas"]:
                ques = qa["question"]
                answers = [ans["text"] for ans in qa["answers"]]
                dataset["qas"].append(
                    {
                        "title": data["title"],
                        "paragraph_index": tuple((k_id, p_id)),
                        "question": ques,
                        "answers": answers,
                    }
                )
        dataset["ki_text"].append(
            {"id": k_id, "title": data["title"], "paragraphs": article}
        )

    return dataset


def squad(
    filepath: str,
    max_knowledge: int | None = None,
    max_paragraph: int | None = None,
    max_questions: int | None = None,
) -> tuple[list[str], Iterator[tuple[str, str]]]:
    """
    @param filepath: path to the dataset's JSON file
    @param max_knowledge: maximum number of docs in dataset
    @param max_paragraph:
    @param max_questions:
    @return: knowledge list, question & answer pair list
    """
    # Open and read the JSON file
    with open(filepath, "r") as file:
        data = json.load(file)
    # Parse the SQuAD data
    parsed_data = _parse_squad_data(data)

    print(
        "max_knowledge",
        max_knowledge,
        "max_paragraph",
        max_paragraph,
        "max_questions",
        max_questions,
    )

    # Set the limit Maximum Articles, use all Articles if max_knowledge is None or greater than the number of Articles
    max_knowledge = (
        max_knowledge
        if max_knowledge is not None and max_knowledge < len(parsed_data["ki_text"])
        else len(parsed_data["ki_text"])
    )
    max_paragraph = max_paragraph if max_knowledge == 1 else None

    # Shuffle the Articles and Questions
    if rand_seed is not None:
        print("rand_seed: ", rand_seed)
        random.seed(rand_seed)
        random.shuffle(parsed_data["ki_text"])
        random.shuffle(parsed_data["qas"])

    k_ids = [i["id"] for i in parsed_data["ki_text"][:max_knowledge]]

    text_list = []
    # Get the knowledge Articles for at most max_knowledge, or all Articles if max_knowledge is None
    for article in parsed_data["ki_text"][:max_knowledge]:
        max_para = (
            max_paragraph
            if max_paragraph is not None and max_paragraph < len(article["paragraphs"])
            else len(article["paragraphs"])
        )
        text_list.append(article["title"])
        text_list.append("\n".join(article["paragraphs"][0:max_para]))

    # Check if the knowledge id of qas is less than the max_knowledge
    questions = [
        qa["question"]
        for qa in parsed_data["qas"]
        if qa["paragraph_index"][0] in k_ids
        and (max_paragraph is None or qa["paragraph_index"][1] < max_paragraph)
    ]
    answers = [
        qa["answers"][0]
        for qa in parsed_data["qas"]
        if qa["paragraph_index"][0] in k_ids
        and (max_paragraph is None or qa["paragraph_index"][1] < max_paragraph)
    ]

    dataset = zip(questions, answers)

    return text_list, dataset


def hotpotqa(
    filepath: str, max_knowledge: int | None = None
) -> tuple[list[str], Iterator[tuple[str, str]]]:
    """
    @param filepath: path to the dataset's JSON file
    @param max_knowledge:
    @return: knowledge list, question & answer pair list
    """
    # Open and read the JSON
    with open(filepath, "r") as file:
        data = json.load(file)

    if rand_seed is not None:
        print("rand_seed: ", rand_seed)
        random.seed(rand_seed)
        random.shuffle(data)

    questions = [qa["question"] for qa in data]
    answers = [qa["answer"] for qa in data]
    dataset = zip(questions, answers)

    if max_knowledge is None:
        max_knowledge = len(data)
    else:
        max_knowledge = min(max_knowledge, len(data))

    text_list = []
    for _, qa in enumerate(data[:max_knowledge]):
        context = qa["context"]
        context = [c[0] + ": \n" + "".join(c[1]) for c in context]
        article = "\n\n".join(context)

        text_list.append(article)

    return text_list, dataset


def kis(filepath: str) -> tuple[list[str], Iterator[tuple[str, str]]]:
    """
    @param filepath: path to the dataset's JSON file
    @return: knowledge list, question & answer pair list
    """
    df = pd.read_csv(filepath)
    dataset = zip(df["sample_question"], df["sample_ground_truth"])
    text_list = df["ki_text"].to_list()

    return text_list, dataset


def get(
    dataset: str,
    max_knowledge: int | None = None,
    max_paragraph: int | None = None,
    max_questions: int | None = None,
) -> tuple[list[str], Iterator[tuple[str, str]]]:
    global rand_seed
    rand_seed = get_config(ConfigName.RAND_SEED)
    match dataset:
        case "kis_sample":
            path = "./datasets/rag_sample_qas_from_kis.csv"
            return kis(path)
        case "kis":
            path = "./datasets/synthetic_knowledge_items.csv"
            return kis(path)
        case "squad-dev":
            path = "./datasets/squad/dev-v1.1.json"
            return squad(path, max_knowledge, max_paragraph, max_questions)
        case "squad-train":
            path = "./datasets/squad/train-v1.1.json"
            return squad(path, max_knowledge, max_paragraph, max_questions)
        case "hotpotqa-dev":
            path = "./datasets/hotpotqa/hotpot_dev_fullwiki_v1.json"
            return hotpotqa(path, max_knowledge)
        case "hotpotqa-test":
            path = "./datasets/hotpotqa/hotpot_test_fullwiki_v1.json"
            return hotpotqa(path, max_knowledge)
        case "hotpotqa-train":
            path = "./datasets/hotpotqa/hotpot_train_v1.1.json"
            return hotpotqa(path, max_knowledge)
        case _:
            return [], zip([], [])

```

### Core Architecture Module: `cag/similarity.py`
```
from sentence_transformers import SentenceTransformer, util

# Use a lightweight sentence-transformer
bert_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


def bert(response, ground_truth):
    """
    @param response: the response from LLM
    @param ground_truth: the ground truth of the question
    @return: the cosine similarity
    """
    query_embedding = bert_model.encode(response, convert_to_tensor=True)
    text_embedding = bert_model.encode(ground_truth, convert_to_tensor=True)

    # Compute the cosine similarity between the query and text
    cosine_score = util.pytorch_cos_sim(query_embedding, text_embedding)

    return cosine_score.item()

```

### Core Architecture Module: `config.py`
```
from enum import Enum

class ConfigName(Enum):
    RAND_SEED = "RAND_SEED"

_CONFIG = {
    # Add default configuration parameters
}

def get_config(key=None, default=None):
    if key is None:
        return _CONFIG
    return _CONFIG.get(key, default)

def set_config(key, value):
    _CONFIG[key] = value
```

### Core Architecture Module: `kvcache.py`
```
import torch
import argparse
import os
import cag.dataset as cagds
import cag.similarity as cagsim
from time import time
from transformers import BitsAndBytesConfig, AutoTokenizer, AutoModelForCausalLM
from transformers.cache_utils import DynamicCache
import logging 
from config import ConfigName, set_config


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

from dotenv import load_dotenv
load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("HF_TOKEN not found")


"""Hugging Face Llama model"""

global model_name, model, tokenizer


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Using device: {device}")


"""KV Cache test"""
# Allowlist the DynamicCache class
torch.serialization.add_safe_globals([DynamicCache])
torch.serialization.add_safe_globals([set])


def generate(
    model,
    input_ids: torch.Tensor,
    past_key_values,
    max_new_tokens: int = 300
) -> torch.Tensor:
    """
    Generate text with greedy decoding.

    Args:
        model: HuggingFace model with automatic device mapping
        input_ids: Input token ids
        past_key_values: KV Cache for knowledge
        max_new_tokens: Maximum new tokens to generate
    """

    embed_device = model.model.embed_tokens.weight.device

    origin_ids = input_ids
    input_ids = input_ids.to(embed_device)

    output_ids = input_ids.clone()
    next_token = input_ids

    with torch.no_grad():
        for _ in range(max_new_tokens):
            outputs = model(
                input_ids=next_token, 
                past_key_values=past_key_values,
                use_cache=True
            )
            next_token_logits = outputs.logits[:, -1, :]
            next_token = next_token_logits.argmax(dim=-1).unsqueeze(-1)
            next_token = next_token.to(embed_device)

            past_key_values = outputs.past_key_values

            output_ids = torch.cat([output_ids, next_token], dim=1)

            if next_token.item() in model.config.eos_token_id:
                break
    return output_ids[:, origin_ids.shape[-1]:]


def preprocess_knowledge(
    model,
    tokenizer,
    prompt: str,
) -> DynamicCache:
    """
    Prepare knowledge kv cache for CAG.
    Args:
        model: HuggingFace model with automatic device mapping
        tokenizer: HuggingFace tokenizer
        prompt: The knowledge to preprocess, which is basically a prompt

    Returns:
        DynamicCache: KV Cache
    """
    embed_device = model.model.embed_tokens.weight.device
    input_ids = tokenizer.encode(prompt, return_tensors="pt").to(embed_device)
    past_key_values = DynamicCache()
    with torch.no_grad():
        outputs = model(
            input_ids=input_ids,
            past_key_values=past_key_values,
            use_cache=True,
            output_attentions=False,
            output_hidden_states=False
        )
    return outputs.past_key_values


def write_kv_cache(kv: DynamicCache, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    """
    Write the KV Cache to a file.
    """
    torch.save(kv, path)


def clean_up(kv: DynamicCache, origin_len: int):
    """
    Truncate the KV Cache to the original length.
    """
    for i in range(len(kv.key_cache)):
        kv.key_cache[i] = kv.key_cache[i][:, :, :origin_len, :]
        kv.value_cache[i] = kv.value_cache[i][:, :, :origin_len, :]


def read_kv_cache(path: str) -> DynamicCache | None:
    """
    Read the KV Cache from a file. If the cache file is invalid or empty, return None.
    """
    if os.path.exists(path) and os.path.getsize(path) > 0:
        kv = torch.load(path, weights_only=True)
        return kv
    else:
        # Regenerate cache if it doesn't exist or is too small
        return None


def prepare_kvcache(documents, filepath: str = "./data_cache/cache_knowledges.pt", answer_instruction: str | None = None):
    # Prepare the knowledges kvcache

    if answer_instruction is None:
        answer_instruction = "Answer the question with a super short answer."
    knowledges = f"""
    <|begin_of_text|>
    <|start_header_id|>system<|end_header_id|>
    You are an assistant for giving short answers based on given context.<|eot_id|>
    <|start_header_id|>user<|end_header_id|>
    Context information is bellow.
    ------------------------------------------------
    {documents}
    ------------------------------------------------
    {answer_instruction}
    Question:
    """
    # Get the knowledge cache
    t1 = time()
    kv = preprocess_knowledge(model, tokenizer, knowledges)
    print("kvlen: ", kv.key_cache[0].shape[-2])
    write_kv_cache(kv, filepath)
    t2 = time()
    logger.info(f"KV cache prepared in {t2 - t1:.2f} seconds.")
    return kv, t2 - t1


def kvcache_test(args: argparse.Namespace):
    answer_instruction = "Answer the question with a super short answer."
    text_list, dataset = cagds.get(args.dataset, max_knowledge=args.maxKnowledge, max_paragraph=args.maxParagraph, max_questions=args.maxQuestion)

    kvcache_path = "./data_cache/cache_knowledges.pt"

    knowledges = '\n\n\n\n\n\n'.join(text_list)
    knowledge_cache, prepare_time = prepare_kvcache(knowledges, filepath=kvcache_path, answer_instruction=answer_instruction)
    kv_len = knowledge_cache.key_cache[0].shape[-2]
    print(f"KVcache prepared in {prepare_time} seconds")
    with open(args.output, "a") as f:
        f.write(f"KVcache prepared in {prepare_time} seconds\n")

    results = {
        "cache_time": [],
        "generate_time": [],
        "similarity": [],
        "prompts": [],
        "responses": []
    }

    dataset = list(dataset)  # Convert the dataset to a list

    max_questions = min(len(dataset), args.maxQuestion) if args.maxQuestion is not None else len(dataset)
    # Retrieve the knowledge from the vector database
    for id, (question, ground_truth) in enumerate(dataset[:max_questions]):
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()

        # Read the knowledge cache from the cache file
        cache_t1 = time()
        # if args.kvcache == "file":
        #     knowledge_cache = read_kv_cache(kvcache_path)

        # Not a good idea to use this method, as it will consume a lot of memory
        # if args.kvcache == "variable":
        #     knowledge_cache = documents_cache
        cache_t2 = time()

        # Generate Response for the question
        knowledges = '\n\n\n'.join(text_list)

        if args.usePrompt:
            prompt = f"""
    <|begin_of_text|>
    <|start_header_id|>system<|end_header_id|>
    You are an assistant for giving short answers based on given context.<|eot_id|>
    <|start_header_id|>user<|end_header_id|>
    Context information is bellow.
    ------------------------------------------------
    {knowledges}
    ------------------------------------------------
    {answer_instruction}
    Question:
    {question}<|eot_id|>
    <|start_header_id|>assistant<|end_header_id|>
    """
            generate_t1 = time()
            input_ids = tokenizer.encode(prompt, return_tensors="pt").to(model.device)
            output = generate(model, input_ids, DynamicCache()) 
            generated_text = tokenizer.decode(output[0], skip_special_tokens=True, temperature=None)
            generate_t2 = time()
        else:
            prompt = f"""
    {question}<|eot_id|>
    <|start_header_id|>assistant<|end_header_id|>
    """
            generate_t1 = time()
            clean_up(knowledge_cache, kv_len)
            input_ids = tokenizer.encode(prompt, return_tensors="pt").to(model.device)
            output = generate(model, input_ids, knowledge_cache)
            generated_text = tokenizer.decode(output[0], skip_special_tokens=True, temperature=None)
            generate_t2 = time()

        # print("D: ", knowledges)
        print("Q: ", question)
        print("A: ", generated_text)
 
        # Evaluate bert-score similarity
        similarity = cagsim.bert(generated_text, ground_truth)

        print(f"[{id}]: Semantic Similarity: {round(similarity, 5)},",
              f"cache time: {cache_t2 - cache_t1},",
              f"generate time: {generate_t2 - generate_t1}")
        with open(args.output, "a") as f:
            f.write(f"[{id}]: Semantic Similarity: {round(similarity, 5)},\t cache time: {cache_t2 - cache_t1},\t generate time: {generate_t2 - generate_t1}\n")

        results["prompts"].append(question)
        results["responses"].append(generated_text)
        results["cache_time"].append(cache_t2 - cache_t1)
        results["generate_time"].append(generate_t2 - generate_t1)
        results["similarity"].append(similarity)

        with open(args.output, "a") as f:
            f.write(f"[{id}]: [Cumulative]: "
                    + f"Semantic Similarity: {round(sum(results['similarity']) / (len(results['similarity'])) , 5)},"
                    + f"\t cache time: {sum(results['cache_time']) / (len(results['cache_time'])) },"
                    + f"\t generate time: {sum(results['generate_time']) / (len(results['generate_time'])) }\n")

    avg_similarity = sum(results["similarity"]) / len(results["similarity"])
    avg_cache_time = sum(results["cache_time"]) / len(results["cache_time"])
    avg_generate_time = sum(results["generate_time"]) / len(results["generate_time"])
    print()
    print(f"Prepare time: {prepare_time}")
    print(f"Average Semantic Similarity: {avg_similarity}")
    print(f"cache time: {avg_cache_time},\t generate time: {avg_generate_time}")
    print()
    with open(args.output, "a") as f:
        f.write("\n")
        f.write(f"Result for {args.output}\n")
        f.write(f"Prepare time: {prepare_time}\n")
        f.write(f"Average Semantic Similarity: {avg_similarity}\n")
        f.write(f"cache time: {avg_cache_time},\t generate time: {avg_generate_time}\n")


# Define quantization configuration
bnb_config = BitsAndBytesConfig(
    
```

### Core Architecture Module: `rag.py`
```
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from llama_index.core import VectorStoreIndex, Document
from transformers.cache_utils import DynamicCache
import cag.dataset as cagds
import cag.similarity as cagsim
import argparse
import os
from transformers import BitsAndBytesConfig
import logging
from config import ConfigName, set_config

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

from dotenv import load_dotenv
load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("HF_TOKEN not found")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
JINA_API_KEY = os.getenv("JINA_API_KEY")


"""Hugging Face Llama model"""

global model_name, model, tokenizer

# Allowlist the DynamicCache class
torch.serialization.add_safe_globals([DynamicCache])
torch.serialization.add_safe_globals([set])


from time import time
from llama_index.core import Settings

def getOpenAIRetriever(documents: list[Document], similarity_top_k: int = 1):
    """OpenAI RAG model"""
    import openai
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found")
    openai.api_key = OPENAI_API_KEY
    # from llama_index.llms.openai import OpenAI
    # Settings.llm = OpenAI(model="gpt-3.5-turbo")
    
    from llama_index.embeddings.openai import OpenAIEmbedding
    # Set the embed_model in llama_index
    Settings.embed_model = OpenAIEmbedding(model_name="text-embedding-3-small", api_key=OPENAI_API_KEY, title="openai-embedding")
    # model_name: "text-embedding-3-small", "text-embedding-3-large"
    
    # Create the OpenAI retriever
    t1 = time()
    index = VectorStoreIndex.from_documents(documents)
    OpenAI_retriever = index.as_retriever(similarity_top_k=similarity_top_k)
    t2 = time()
    logger.info(f"OpenAI retriever prepared in {t2 - t1:.2f} seconds.")
    return OpenAI_retriever, t2 - t1
    

def getGeminiRetriever(documents: list[Document], similarity_top_k: int = 1):
    """Gemini Embedding RAG model"""
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not found")
    from llama_index.embeddings.gemini import GeminiEmbedding
    model_name = "models/embedding-001"
    # Set the embed_model in llama_index
    Settings.embed_model = GeminiEmbedding( model_name=model_name, api_key=GOOGLE_API_KEY, title="gemini-embedding")
    
    # Create the Gemini retriever
    t1 = time()
    index = VectorStoreIndex.from_documents(documents)
    Gemini_retriever = index.as_retriever(similarity_top_k=similarity_top_k)
    t2 = time()
    logger.info(f"Gemini retriever prepared in {t2 - t1:.2f} seconds.")
    return Gemini_retriever, t2 - t1
    
def getBM25Retriever(documents: list[Document], similarity_top_k: int = 1):
    from llama_index.core.node_parser import SentenceSplitter  
    from llama_index.retrievers.bm25 import BM25Retriever
    import Stemmer

    splitter = SentenceSplitter(chunk_size=512)
    
    t1 = time()
    nodes = splitter.get_nodes_from_documents(documents)
    # We can pass in the index, docstore, or list of nodes to create the retriever
    bm25_retriever = BM25Retriever.from_defaults(
        nodes=nodes,
        similarity_top_k=similarity_top_k,
        stemmer=Stemmer.Stemmer("english"),
        language="english",
    )
    t2 = time()
    bm25_retriever.persist("./bm25_retriever")

    return bm25_retriever, t2 - t1

def getJinaRetriever(documents: list[Document], similarity_top_k: int = 1):
    """Jina Embedding model"""
    if not JINA_API_KEY:
        raise ValueError("JINA_API_KEY not found")
    try:
        from llama_index.embeddings.jinaai import JinaEmbedding
        model_name = "jina-embeddings-v3"
        Settings.embed_model = JinaEmbedding(
            api_key=JINA_API_KEY,
            model=model_name,
            task="retrieval.passage",
        )

        # Create the Jina retriever
        t1 = time()
        index = VectorStoreIndex.from_documents(documents)
        Jina_retriever = index.as_retriever(similarity_top_k=similarity_top_k)
        t2 = time()
        logger.info(f"Jina retriever prepared in {t2 - t1:.2f} seconds.")
        return Jina_retriever, t2 - t1
    except ImportError:
        logger.error("Failed to import JinaEmbedding. Please install jinaai package.")
        raise
    except Exception as e:
        logger.error(f"Error creating Jina retriever: {str(e)}")
        raise

    
def rag_test(args: argparse.Namespace):
    answer_instruction = "Answer the question with a super short answer."
    text_list, dataset = cagds.get(args.dataset, max_knowledge=args.maxKnowledge, max_paragraph=args.maxParagraph, max_questions=args.maxQuestion)
        
    if answer_instruction != None:
        answer_instruction = "Answer the question with a super short answer."
    
    # document indexing for the rag retriever
    documents = [Document(text=t) for t in text_list]
    
    retriever = None
    prepare_time = 0.0
    if args.index == "gemini":
        retriever, prepare_time = getGeminiRetriever(documents, similarity_top_k=args.topk)
    if args.index == "openai":
        retriever, prepare_time = getOpenAIRetriever(documents, similarity_top_k=args.topk)
        logger.info(f"Testing {args.index.upper()} retriever with {len(documents)} documents.")
    if args.index == "bm25":
        retriever, prepare_time = getBM25Retriever(documents, similarity_top_k=args.topk)
    if args.index == "jina":
        retriever, prepare_time = getJinaRetriever(documents, similarity_top_k=args.topk)
        logger.info(f"Testing {args.index.upper()} retriever with {len(documents)} documents.")

    if retriever is None:
        raise ValueError("No retriever, `--index` not set")
        
    print(f"Retriever {args.index.upper()} prepared in {prepare_time} seconds")
    with open(args.output, "a") as f:
        f.write(f"Retriever {args.index.upper()} prepared in {prepare_time} seconds\n")
    
    results = {
        "retrieve_time": [],
        "generate_time": [],
        "similarity": [],
        "prompts": [],
        "responses": []
    }
    
    dataset = list(dataset) # Convert the dataset to a list
    
    max_questions = min(len(dataset), args.maxQuestion) if args.maxQuestion != None else len(dataset)
    
    for id, (question, ground_truth) in enumerate(dataset[:max_questions]):    # Retrieve the knowledge from the vector database
        retrieve_t1 = time()
        nodes = retriever.retrieve(question)
        retrieve_t2 = time()
        
        knowledge = "\n---------------------\n".join([node.text for node in nodes])
        # short_knowledge = knowledge[:knowledge.find("**Step 4")]
        
        prompt = f"""
    <|begin_of_text|>
    <|start_header_id|>system<|end_header_id|>
    You are an assistant for giving short answers based on given context.<|eot_id|>
    <|start_header_id|>user<|end_header_id|>
    Context information is below.
    ------------------------------------------------
    {knowledge}
    ------------------------------------------------
    {answer_instruction}
    Question:
    {question}
    <|eot_id|>
    <|start_header_id|>assistant<|end_header_id|>
    """

        # Generate Response for the question
        generate_t1 = time() 
        input_ids = tokenizer.encode(prompt, return_tensors="pt").to(model.device)
        output = model.generate(
            input_ids,
            max_new_tokens=300,  # Set the maximum length of the generated text
            do_sample=False,  # Ensures greedy decoding,
            temperature=None
        )
        generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
        generate_t2 = time() 

        generated_text = generated_text[generated_text.find(question) + len(question):]
        generated_text = generated_text[generated_text.find('assistant') + len('assistant'):].lstrip()
        
        # print("R: ", knowledge)
        print("Q: ", question)
        print("A: ", generated_text)
        
        # Evaluate bert-score similarity
        similarity = cagsim.bert(generated_text, ground_truth)
        
        print(f"[{id}]: Semantic Similarity: {round(similarity, 5)},\t",
            f"retrieve time: {retrieve_t2 - retrieve_t1},\t",
            f"generate time: {generate_t2 - generate_t1}"
            )
        with open(args.output, "a") as f:
            f.write(f"[{id}]: Semantic Similarity: {round(similarity, 5)},\t retrieve time: {retrieve_t2 - retrieve_t1},\t generate time: {generate_t2 - generate_t1}\n")
            
        results["prompts"].append(prompt)
        results["responses"].append(generated_text)
        results["retrieve_time"].append(retrieve_t2 - retrieve_t1)
        results["generate_time"].append(generate_t2 - generate_t1)
        results["similarity"].append(similarity)
        
        with open(args.output, "a") as f:
            f.write(f"[{id}]: [Cumulative]: " 
                    + f"Semantic Similarity: {round(sum(results['similarity']) / (len(results['similarity'])) , 5)}," 
                    + f"\t retrieve time: {sum(results['retrieve_time']) / (len(results['retrieve_time'])) },"
                    + f"\t generate time: {sum(results['generate_time']) / (len(results['generate_time'])) }\n")
        
        
    avg_similarity = sum(results["similarity"]) / len(results["similarity"])
    avg_retrieve_time = sum(results["retrieve_time"]) / len(results["retrieve_time"])
    avg_generate_time = sum(results["generate_time"]) / len(results["generate_time"])
    print()
    print(f"Prepare time: {prepare_time}")
    print(f"Average Semantic Similarity: {avg_similarity}")
    print(f"retrieve time: {avg_retrieve_time},\t generate time: {avg_generate_time}")
    print()
    with open(args.output, "a") as f:
        f.write("\n")
        f.write(f"Result for {args.output}\n")
        f.write(f"Prepare time: {prepare_time}\n")
        f.write(f"Aver
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #24** (2025-05-13): **Run on Google Colab Error**
  *Symptoms*: Here is the Google colab I use  https://colab.research.google.com/drive/1kEL75fLy246_SYvTSCIk3iYxKa-I9157?usp=sharing  I run the code on google colab and here is the error I got ``` 2025-05-12 09:04:49.416076: E external/local_xla/xla/stream_executor/cuda/cuda_fft.cc:477] Unable to register cuFFT factory: Attempting to register factory for plugin cuFFT when one has already been registered WARNING: All log messages before absl::InitializeLog() is called are written to STDERR E0000 00:00:1747040689.437876   16296 cuda_dnn.cc:8310] Unable to register cuDNN factory: Attempting to register factory for plugin cuDNN when one has already been registered E0000 00:00:1747040689.444600   16296 cuda_blas.cc:1418] Unable to register cuBLAS factory: Attempting to register factory for plugin cuBLAS when one has already been registered 2025-05-12 09:04:49.468254: I tensorflow/core/platform/cpu_feature_guard.cc:210] This TensorFlow binary is optimized to use available CPU instructions in performance-critical operations. To enable the following instructions: AVX2 AVX512F FMA, in other operations, rebuild TensorFlow with the appropriate compiler flags. 2025-05-12 09:04:54,796 - INFO - Using device: cuda maxKnowledge 10 maxParagraph 10 maxQuestion 10 randomeSeed 0 False  ===================================BUG REPORT=================================== /usr/local/lib/python3.11/dist-packages/bitsandbytes/cuda_setup/main.py:167: UserWarning: Welcome to bitsandbytes. For bug reports, please run  pyt
  **Post-Mortem & Fix Analysis**:
  > Looks like it's bitsandbytes version `!pip install --no-cache-dir bitsandbytes==0.45.5` solve this

- **Issue #23** (2025-05-26): **Fix random seed not working bug**
  *Symptoms*: Example prompt: ``` python ./kvcache.py --kvcache file --dataset "squad-train" --similarity bertscore \     --maxKnowledge 3 --maxParagraph 100 --maxQuestion 100  \     --modelname "meta-llama/Llama-3.1-8B-Instruct" --randomSeed 0 \     --output "./result_kvcache.txt" ```  The random seed parameter does not work due to a bug in the code. Here is a quick fix. 

- **Issue #22** (2025-02-03): **refactor**
  *Symptoms*: - Isolate similarity & dataset utilities - Improve codes readability

- **Issue #21** (2025-02-01): **Refactor/dev**
  *Symptoms*: - Use python-dotenv - Fix type error for both `kvcache.py` and `rag.py`

- **Issue #19** (2025-02-01): **如何 正確設定 HF_TOKEN**
  *Symptoms*: 您好! 你們是台灣之光  突破 我客製LLM的最後防線RAG  我用HF mistralai/Mistral-7B-Instruct-v0.1，成功 login  或將HF_TOKEN寫入 .env， 但都得到以下訊息： Access to model mistralai/Mistral-7B-Instruct-v0.1 is restricted. You must have access to it and be authenticated to access it. Please log in.  可不可以 告知 如何正確  設定HF_TOKEN 謝謝!
  **Post-Mortem & Fix Analysis**:
  > 順提一下  我是在Colab 上試 !cd CAG !cp /content/CAG/.env.template ./.env  之後 將我的HF_TOKEN 寫入 .env
  > Hi @elliotthwang  新年快樂！  關於 hf token 的問題 不知道你在寫 .env 的時候 有沒有加上雙引號，像是以下這樣  HF_TOKEN="hf...."
  > Hi @RyanCheng98153  新年快樂!  Indeed 是雙引號

- **Issue #17** (2025-01-23): **Implement batch processing with configurable size**
  *Symptoms*: feat(kvcache): Implement batch processing with configurable size  - Add chunked processing for large documents - Implement configurable batch_size parameter (default: 1000) - Add batch_size argument to CLI interface - Add KV cache merging functionality - Update prepare_kvcache call with batch_size parameter  Benefits: - Reduces memory usage for large documents - Prevents OOM errors in GPU processing - Allows fine-tuning based on hardware resources - Improves system stability for large-scale processing  Technical details: - Document chunking with customizable size - Sequential chunk processing - Memory-efficient document handling - CLI argument for batch size control  Testing: - Verified with various document sizes and batch sizes - Confirmed memory usage optimization - Tested output consistency - Validated CLI parameter functionality  This change enables efficient processing of large documents while allowing users to optimize memory usage based on their specific hardware constraints and performance requirements.

- **Issue #16** (2025-02-06): **Receiving Invalid Buffer size error when running kvcache (CPU)**
  *Symptoms*: M1 Macbook Pro - CPU Logs: ` Code/current_projects/CAG  main  python3 ./kvcache.py --kvcache file --dataset "squad-train" --similarity bertscore --maxKnowledge 5 --maxParagraph 100 --maxQuestion 1000 --modelname "meta-llama/Llama-3.1-8B-Instruct" --randomSeed 0 --output "./result_kvcache.txt" 2025-01-22 13:43:55,158 - INFO - Using device: cpu 2025-01-22 13:43:55,184 - INFO - Use pytorch device_name: mps 2025-01-22 13:43:55,184 - INFO - Load pretrained SentenceTransformer: all-MiniLM-L6-v2 maxKnowledge 5 maxParagraph 100 maxQuestion 1000 randomeSeed 0 Loading checkpoint shards: 100%|█████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 4/4 [00:14<00:00,  3.73s/it] 2025-01-22 13:44:12,200 - WARNING - Some parameters are on the meta device because they were offloaded to the disk. max_knowledge 5 max_paragraph 100 max_questions 1000 Traceback (most recent call last):   File "/Users/georgeli/Documents/Code/current_projects/CAG/./kvcache.py", line 500, in <module>     kvcache_test(args)   File "/Users/georgeli/Documents/Code/current_projects/CAG/./kvcache.py", line 318, in kvcache_test     knowledge_cache, prepare_time = prepare_kvcache(knowledges, filepath=kvcache_path, answer_instruction=answer_instruction)                                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/Users/georgeli/Documents/Code/current_projects/CAG/./kvcac
  **Post-Mortem & Fix Analysis**:
  > Hi george, how much RAM does your system have?
  > Hi Brian, I think 16 GB of RAM
  > It’s most likely an out-of-memory error running on MAC with CPU, as discussed in this issue: https://github.com/huggingface/diffusers/issues/5894  For running a Large Language Model, a dedicated GPU is highly recommended. If you don’t have access to one, I suggest using Google Colab, which offers a free tier with GPU support.

- **Issue #15** (2025-01-21): **Add Jina AI Embeddings Support**
  *Symptoms*: ## Description This PR adds support for Jina AI Embeddings as a new retriever option in our RAG system, providing an alternative to existing OpenAI and Gemini embeddings.  ## Features - New `getJinaRetriever` function for Jina AI integration - Support for "jina-embeddings-v3" model - Consistent interface with existing retrievers - Comprehensive error handling and logging  ## Dependencies - Requires `jinaai` package - Requires `JINA_API_KEY` environment variable  ## Checklist - [x] Code follows project style guidelines - [x] Error handling implemented

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

### Incident Patch 1: `69212fff` (2025-04-10)
**Commit Message**: Add print for debug

**File**: `cag/dataset.py` (modified, +2/-1)
```diff
@@ -69,7 +69,7 @@ def squad(
 
     # Shuffle the Articles and Questions
     if rand_seed is not None:
-        print("rand_seed", rand_seed)
+        print("rand_seed: ", rand_seed)
         random.seed(rand_seed)
         random.shuffle(parsed_data["ki_text"])
         random.shuffle(parsed_data["qas"])
@@ -119,6 +119,7 @@ def hotpotqa(
         data = json.load(file)
 
     if rand_seed is not None:
+        print("rand_seed: ", rand_seed)
         random.seed(rand_seed)
         random.shuffle(data)
 
```

---

### Incident Patch 2: `f5efa144` (2025-04-10)
**Commit Message**: Fix rand_seed not working bug

**File**: `cag/dataset.py` (modified, +2/-3)
```diff
@@ -2,9 +2,7 @@
 import random
 import pandas as pd
 from typing import Iterator
-
-
-rand_seed = None
+from config import rand_seed
 
 
 def _parse_squad_data(raw):
@@ -70,6 +68,7 @@ def squad(
 
     # Shuffle the Articles and Questions
     if rand_seed is not None:
+        print("rand_seed", rand_seed)
         random.seed(rand_seed)
         random.shuffle(parsed_data["ki_text"])
         random.shuffle(parsed_data["qas"])
```

**File**: `config.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+rand_seed = None
\ No newline at end of file
```

**File**: `kvcache.py` (modified, +1/-1)
```diff
@@ -7,6 +7,7 @@
 from transformers import BitsAndBytesConfig, AutoTokenizer, AutoModelForCausalLM
 from transformers.cache_utils import DynamicCache
 import logging 
+from config import rand_seed
 
 
 logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
@@ -23,7 +24,6 @@
 """Hugging Face Llama model"""
 
 global model_name, model, tokenizer
-global rand_seed
 
 
 device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
```

**File**: `rag.py` (modified, +1/-1)
```diff
@@ -8,6 +8,7 @@
 import os
 from transformers import BitsAndBytesConfig
 import logging
+from config import rand_seed
 
 logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
 logger = logging.getLogger(__name__)
@@ -26,7 +27,6 @@
 """Hugging Face Llama model"""
 
 global model_name, model, tokenizer
-global rand_seed
 
 # Allowlist the DynamicCache class
 torch.serialization.add_safe_globals([DynamicCache])
```

---

### Incident Patch 3: `72eb89d6` (2025-01-14)
**Commit Message**: Update requirements.txt

Missing dependency

**File**: `requirements.txt` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
-﻿aiohappyeyeballs==2.4.4
+accelerate==1.2.1
+aiohappyeyeballs==2.4.4
 aiohttp==3.11.9
 aiosignal==1.3.1
 annotated-types==0.7.0
```

---

### Incident Patch 4: `2c75c599` (2025-01-12)
**Commit Message**: Merge pull request #9 from ShanukaLakshan/fix-bitsandbytes

Update requirements.txt with bitsandbytes==0.42.0

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ async-timeout==5.0.1
 attrs==24.2.0
 beautifulsoup4==4.12.3
 bert-score==0.3.13
+bitsandbytes==0.42.0
 bm25s==0.2.5
 cachetools==5.5.0
 certifi==2024.8.30
```

---

### Incident Patch 5: `6185798d` (2025-01-11)
**Commit Message**: Update requirements.txt with bitsandbytes==0.42.0

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ async-timeout==5.0.1
 attrs==24.2.0
 beautifulsoup4==4.12.3
 bert-score==0.3.13
+bitsandbytes==0.42.0
 bm25s==0.2.5
 cachetools==5.5.0
 certifi==2024.8.30
```

---

### Incident Patch 6: `5662e763` (2025-01-02)
**Commit Message**: Convert requirements.txt to UTF-8 with unix line endings

Fixes a number of errors in a few tools. Also stops git considering it
binary.



---

### Incident Patch 7: `ddc1d28b` (2024-12-27)
**Commit Message**: doc: preparation note block fix

**File**: `README.md` (modified, +2/-4)
```diff
@@ -13,18 +13,16 @@ pip install -r ./requirements.txt
 > ```bash
 > sh ./downloads.sh
 > ```
-> 
-> [!IMPORTANT]  
 > unzip the dataset zip file in datasets directory
+
 > [!TIP] 
 > make sure the `train-v1.1.json` in `./datasets/squad` and `hotpot_train_v1.1.json` in `./datasets/hotpotqa`
-> 
+
 > [!IMPORTANT]
 > create `.env` file by `.env.template` and input the keys required
 > ```bash
 > cp ./.env.template ./.env
 > ```
->
 
 ## Usage
 - `rag.py` is for RAG Experiment
```

#### Recent Merged Pull Requests:
- **PR #23** (2025-05-26): Fix random seed not working bug (@Jasonzzzz28)
- **PR #22** (2025-02-03): refactor (@GNITOAHC)
- **PR #21** (2025-02-01): Refactor/dev (@GNITOAHC)
- **PR #17** (closed): Implement batch processing with configurable size (@theQuert)
- **PR #15** (2025-01-21): Add Jina AI Embeddings Support (@theQuert)
- **PR #14** (2025-01-21): added dockerfile enhanced functionality with improved validation, bet… (@Adesoji1)
- **PR #11** (2025-01-15): Update requirements.txt (@ivangarcia88)
- **PR #9** (2025-01-12): Update requirements.txt with bitsandbytes==0.42.0 (@ShanukaLakshan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
