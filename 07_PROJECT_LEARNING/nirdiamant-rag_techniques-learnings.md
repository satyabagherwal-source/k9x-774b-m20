# Forensic Learning Record (Deep Inspection): NirDiamant/RAG_Techniques

> **Canonical Artifact**: `07_PROJECT_LEARNING/nirdiamant-rag_techniques-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NirDiamant/RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:19.501Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NirDiamant/RAG_Techniques`
- **Description**: This repository showcases various advanced techniques for Retrieval-Augmented Generation (RAG) systems. Each technique has a detailed notebook tutorial.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 29669 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `all_rag_techniques_runnable_scripts/retrieval_with_feedback_loop.py`
```
import os
import sys
import json
from typing import List, Dict, Any
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"


# Define the Response class
class Response(BaseModel):
    answer: str = Field(..., title="The answer to the question. The options can be only 'Yes' or 'No'")


# Define utility functions
def get_user_feedback(query, response, relevance, quality, comments=""):
    return {
        "query": query,
        "response": response,
        "relevance": int(relevance),
        "quality": int(quality),
        "comments": comments
    }


def store_feedback(feedback):
    with open("../data/feedback_data.json", "a") as f:
        json.dump(feedback, f)
        f.write("\n")


def load_feedback_data():
    feedback_data = []
    try:
        with open("../data/feedback_data.json", "r") as f:
            for line in f:
                feedback_data.append(json.loads(line.strip()))
    except FileNotFoundError:
        print("No feedback data file found. Starting with empty feedback.")
    return feedback_data


def adjust_relevance_scores(query: str, docs: List[Any], feedback_data: List[Dict[str, Any]]) -> List[Any]:
    relevance_prompt = PromptTemplate(
        input_variables=["query", "feedback_query", "doc_content", "feedback_response"],
        template="""
        Determine if the following feedback response is relevant to the current query and document content.
        You are also provided with the Feedback original query that was used to generate the feedback response.
        Current query: {query}
        Feedback query: {feedback_query}
        Document content: {doc_content}
        Feedback response: {feedback_response}

        Is this feedback relevant? Respond with only 'Yes' or 'No'.
        """
    )
    llm = ChatOpenAI(temperature=0, model_name="gpt-4o", max_tokens=4000)
    relevance_chain = relevance_prompt | llm.with_structured_output(Response)

    for doc in docs:
        relevant_feedback = []
        for feedback in feedback_data:
            input_data = {
                "query": query,
                "feedback_query": feedback['query'],
                "doc_content": doc.page_content[:1000],
                "feedback_response": feedback['response']
            }
            result = relevance_chain.invoke(input_data).answer

            if result == 'yes':
                relevant_feedback.append(feedback)

        if relevant_feedback:
            avg_relevance = sum(f['relevance'] for f in relevant_feedback) / len(relevant_feedback)
            doc.metadata['relevance_score'] *= (avg_relevance / 3)

    return sorted(docs, key=lambda x: x.metadata['relevance_score'], reverse=True)


def fine_tune_index(feedback_data: List[Dict[str, Any]], texts: List[str]) -> Any:
    good_responses = [f for f in feedback_data if f['relevance'] >= 4 and f['quality'] >= 4]
    additional_texts = " ".join([f['query'] + " " + f['response'] for f in good_responses])
    all_texts = texts + additional_texts
    new_vectorstore = encode_from_string(all_texts)
    return new_vectorstore


# Define the main RAG class
class RetrievalAugmentedGeneration:
    def __init__(self, path: str):
        self.path = path
        self.content = read_pdf_to_string(self.path)
        self.vectorstore = encode_from_string(self.content)
        self.retriever = self.vectorstore.as_retriever()
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o", max_tokens=4000)
        self.qa_chain = RetrievalQA.from_chain_type(self.llm, retriever=self.retriever)

    def run(self, query: str, relevance: int, quality: int):
        response = self.qa_chain(query)["result"]
        feedback = get_user_feedback(query, response, relevance, quality)
        store_feedback(feedback)

        docs = self.retriever.get_relevant_documents(query)
        adjusted_docs = adjust_relevance_scores(query, docs, load_feedback_data())
        self.retriever.search_kwargs['k'] = len(adjusted_docs)
        self.retriever.search_kwargs['docs'] = adjusted_docs

        return response


# Argument parsing
def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description="Run the RAG system with feedback integration.")
    parser.add_argument('--path', type=str, default="../data/Understanding_Climate_Change.pdf",
                        help="Path to the document.")
    parser.add_argument('--query', type=str, default='What is the greenhouse effect?',
                        help="Query to ask the RAG system.")
    parser.add_argument('--relevance', type=int, default=5, help="Relevance score for the feedback.")
    parser.add_argument('--quality', type=int, default=5, help="Quality score for the feedback.")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    rag = RetrievalAugmentedGeneration(args.path)
    result = rag.run(args.query, args.relevance, args.quality)
    print(f"Response: {result}")

    # Fine-tune the vectorstore periodically
    new_vectorstore = fine_tune_index(load_feedback_data(), rag.content)
    rag.retriever = new_vectorstore.as_retriever()

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/HyDe_Hypothetical_Document_Embedding.py`
```
import os
import sys
import argparse
from dotenv import load_dotenv

# Add the parent directory to the path since we work with notebooks
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))

from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

# Define the HyDe retriever class - creating vector store, generating hypothetical document, and retrieving
class HyDERetriever:
    def __init__(self, files_path, chunk_size=500, chunk_overlap=100):
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o-mini", max_tokens=4000)
        self.embeddings = OpenAIEmbeddings()
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.vectorstore = encode_pdf(files_path, chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)

        self.hyde_prompt = PromptTemplate(
            input_variables=["query", "chunk_size"],
            template="""Given the question '{query}', generate a hypothetical document that directly answers this question. The document should be detailed and in-depth.
            The document size has to be exactly {chunk_size} characters.""",
        )
        self.hyde_chain = self.hyde_prompt | self.llm

    def generate_hypothetical_document(self, query):
        input_variables = {"query": query, "chunk_size": self.chunk_size}
        return self.hyde_chain.invoke(input_variables).content

    def retrieve(self, query, k=3):
        hypothetical_doc = self.generate_hypothetical_document(query)
        similar_docs = self.vectorstore.similarity_search(hypothetical_doc, k=k)
        return similar_docs, hypothetical_doc


# Main class for running the retrieval process
class ClimateChangeRAG:
    def __init__(self, path, query):
        self.retriever = HyDERetriever(path)
        self.query = query

    def run(self):
        # Retrieve results and hypothetical document
        results, hypothetical_doc = self.retriever.retrieve(self.query)

        # Plot the hypothetical document and the retrieved documents
        docs_content = [doc.page_content for doc in results]

        print("Hypothetical document:\n")
        print(text_wrap(hypothetical_doc) + "\n")
        show_context(docs_content)


# Argument parsing function
def parse_args():
    parser = argparse.ArgumentParser(description="Run the Climate Change RAG method.")
    parser.add_argument("--path", type=str, default="../data/Understanding_Climate_Change.pdf",
                        help="Path to the PDF file to process.")
    parser.add_argument("--query", type=str, default="What is the main cause of climate change?",
                        help="Query to test the retriever (default: 'What is the main topic of the document?').")
    return parser.parse_args()


if __name__ == "__main__":
    # Parse command-line arguments
    args = parse_args()

    # Create and run the RAG method instance
    rag_runner = ClimateChangeRAG(args.path, args.query)
    rag_runner.run()

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/HyPE_Hypothetical_Prompt_Embeddings.py`
```
import os
import sys
import argparse
import time
import faiss
from dotenv import load_dotenv
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_community.docstore.in_memory import InMemoryDocstore

# Add the parent directory to the path since we work with notebooks
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))

from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file (e.g., OpenAI API key)
load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

class HyPE:
    """
    A class to handle the HyPE RAG process, which enhances document chunking by 
    generating hypothetical questions as proxies for retrieval.
    """

    def __init__(self, path, chunk_size=1000, chunk_overlap=200, n_retrieved=3):
        """
        Initializes the HyPE-based RAG retriever by encoding the PDF document with 
        hypothetical prompt embeddings.

        Args:
            path (str): Path to the PDF file to encode.
            chunk_size (int): Size of each text chunk (default: 1000).
            chunk_overlap (int): Overlap between consecutive chunks (default: 200).
            n_retrieved (int): Number of chunks to retrieve for each query (default: 3).
        """
        print("\n--- Initializing HyPE RAG Retriever ---")

        # Encode the PDF document into a FAISS vector store using hypothetical prompt embeddings
        start_time = time.time()
        self.vector_store = self.encode_pdf(path, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        self.time_records = {'Chunking': time.time() - start_time}
        print(f"Chunking Time: {self.time_records['Chunking']:.2f} seconds")

        # Create a retriever from the vector store
        self.chunks_query_retriever = self.vector_store.as_retriever(search_kwargs={"k": n_retrieved})

    def generate_hypothetical_prompt_embeddings(self, chunk_text):
        """
        Uses an LLM to generate multiple hypothetical questions for a single chunk.
        These questions act as 'proxies' for the chunk during retrieval.

        Parameters:
        chunk_text (str): Text contents of the chunk.

        Returns:
        tuple: (Original chunk text, List of embedding vectors generated from the questions)
        """
        llm = ChatOpenAI(temperature=0, model_name="gpt-4o-mini")
        embedding_model = OpenAIEmbeddings(model="text-embedding-3-small")

        question_gen_prompt = PromptTemplate.from_template(
            "Analyze the input text and generate essential questions that, when answered, \
            capture the main points of the text. Each question should be one line, \
            without numbering or prefixes.\n\n \
            Text:\n{chunk_text}\n\nQuestions:\n"
        )
        question_chain = question_gen_prompt | llm | StrOutputParser()

        # Parse questions from response
        questions = question_chain.invoke({"chunk_text": chunk_text}).replace("\n\n", "\n").split("\n")

        return chunk_text, embedding_model.embed_documents(questions)

    def prepare_vector_store(self, chunks):
        """
        Creates and populates a FAISS vector store using hypothetical prompt embeddings.

        Parameters:
        chunks (List[str]): A list of text chunks to be embedded and stored.

        Returns:
        FAISS: A FAISS vector store containing the embedded text chunks.
        """
        vector_store = None  # Wait to initialize to determine vector size

        with ThreadPoolExecutor() as pool:
            # Parallelized embedding generation
            futures = [pool.submit(self.generate_hypothetical_prompt_embeddings, c) for c in chunks]

            for f in tqdm(as_completed(futures), total=len(chunks)):  
                chunk, vectors = f.result()  # Retrieve processed chunk and embeddings

                # Initialize FAISS store once vector size is known
                if vector_store is None:
                    vector_store = FAISS(
                        embedding_function=OpenAIEmbeddings(model="text-embedding-3-small"),
                        index=faiss.IndexFlatL2(len(vectors[0])),
                        docstore=InMemoryDocstore(),
                        index_to_docstore_id={}
                    )

                # Store multiple vector representations per chunk
                chunks_with_embedding_vectors = [(chunk.page_content, vec) for vec in vectors]
                vector_store.add_embeddings(chunks_with_embedding_vectors)

        return vector_store

    def encode_pdf(self, path, chunk_size=1000, chunk_overlap=200):
        """
        Encodes a PDF document into a vector store using hypothetical prompt embeddings.

        Args:
            path: The path to the PDF file.
            chunk_size: The size of each text chunk.
            chunk_overlap: The overlap between consecutive chunks.

        Returns:
            A FAISS vector store containing the encoded book content.
        """
        # Load PDF documents
        loader = PyPDFLoader(path)
        documents = loader.load()

        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
        )
        texts = text_splitter.split_documents(documents)
        cleaned_texts = replace_t_with_space(texts)

        return self.prepare_vector_store(cleaned_texts)

    def run(self, query):
        """
        Retrieves and displays the context for the given query.

        Args:
            query (str): The query to retrieve context for.

        Returns:
            None
        """
        # Measure retrieval time
        start_time = time.time()
        context = retrieve_context_per_question(query, self.chunks_query_retriever)
        self.time_records['Retrieval'] = time.time() - start_time
        print(f"Retrieval Time: {self.time_records['Retrieval']:.2f} seconds")

        # Deduplicate context and display results
        context = list(set(context))
        show_context(context)


def validate_args(args):
    if args.chunk_size <= 0:
        raise ValueError("chunk_size must be a positive integer.")
    if args.chunk_overlap < 0:
        raise ValueError("chunk_overlap must be a non-negative integer.")
    if args.n_retrieved <= 0:
        raise ValueError("n_retrieved must be a positive integer.")
    return args


def parse_args():
    parser = argparse.ArgumentParser(description="Encode a PDF document and test a HyPE-based RAG system.")
    parser.add_argument("--path", type=str, default="../data/Understanding_Climate_Change.pdf",
                        help="Path to the PDF file to encode.")
    parser.add_argument("--chunk_size", type=int, default=1000,
                        help="Size of each text chunk (default: 1000).")
    parser.add_argument("--chunk_overlap", type=int, default=200,
                        help="Overlap between consecutive chunks (default: 200).")
    parser.add_argument("--n_retrieved", type=int, default=3,
                        help="Number of chunks to retrieve for each query (default: 3).")
    parser.add_argument("--query", type=str, default="What is the main cause of climate change?",
                        help="Query to test the retriever (default: 'What is the main cause of climate change?').")
    parser.add_argument("--evaluate", action="store_true",
                        help="Whether to evaluate the retriever's performance (default: False).")

    return validate_args(parser.parse_args())


def main(args):
    # Initialize the HyPE-based RAG Retriever
    hyperag = HyPE(
        path=args.path,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        n_retrieved=args.n_retrieved
    )

    # Retrieve context based on the query
    hyperag.run(args.query)

    # Evaluate the retriever's performance on the query (if requested)
    if args.evaluate:
        evaluate_rag(hyperag.chunks_query_retriever)


if __name__ == '__main__':
    # Call the main function with parsed arguments
    main(parse_args())

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/adaptive_retrieval.py`
```
import os
import sys
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import CharacterTextSplitter

from langchain_core.retrievers import BaseRetriever
from typing import List, Dict, Any
from langchain.docstore.document import Document
from langchain_openai import ChatOpenAI
from langchain_core.pydantic_v1 import BaseModel, Field

sys.path.append(os.path.abspath(
    os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path since we work with notebooks
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


# Define all the required classes and strategies
class CategoriesOptions(BaseModel):
    category: str = Field(
        description="The category of the query, the options are: Factual, Analytical, Opinion, or Contextual",
        example="Factual"
    )


class RelevantScore(BaseModel):
    score: float = Field(description="The relevance score of the document to the query", example=8.0)


class SelectedIndices(BaseModel):
    indices: List[int] = Field(description="Indices of selected documents", example=[0, 1, 2, 3])


class SubQueries(BaseModel):
    sub_queries: List[str] = Field(description="List of sub-queries for comprehensive analysis",
                                   example=["What is the population of New York?", "What is the GDP of New York?"])


class QueryClassifier:
    def __init__(self):
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o", max_tokens=4000)
        self.prompt = PromptTemplate(
            input_variables=["query"],
            template="Classify the following query into one of these categories: Factual, Analytical, Opinion, or Contextual.\nQuery: {query}\nCategory:"
        )
        self.chain = self.prompt | self.llm.with_structured_output(CategoriesOptions)

    def classify(self, query):
        print("Classifying query...")
        return self.chain.invoke(query).category


class BaseRetrievalStrategy:
    def __init__(self, texts):
        self.embeddings = OpenAIEmbeddings()
        text_splitter = CharacterTextSplitter(chunk_size=800, chunk_overlap=0)
        self.documents = text_splitter.create_documents(texts)
        self.db = FAISS.from_documents(self.documents, self.embeddings)
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o", max_tokens=4000)

    def retrieve(self, query, k=4):
        return self.db.similarity_search(query, k=k)


class FactualRetrievalStrategy(BaseRetrievalStrategy):
    def retrieve(self, query, k=4):
        print("Retrieving factual information...")
        enhanced_query_prompt = PromptTemplate(
            input_variables=["query"],
            template="Enhance this factual query for better information retrieval: {query}"
        )
        query_chain = enhanced_query_prompt | self.llm
        enhanced_query = query_chain.invoke(query).content
        print(f'Enhanced query: {enhanced_query}')

        docs = self.db.similarity_search(enhanced_query, k=k * 2)

        ranking_prompt = PromptTemplate(
            input_variables=["query", "doc"],
            template="On a scale of 1-10, how relevant is this document to the query: '{query}'?\nDocument: {doc}\nRelevance score:"
        )
        ranking_chain = ranking_prompt | self.llm.with_structured_output(RelevantScore)

        ranked_docs = []
        print("Ranking documents...")
        for doc in docs:
            input_data = {"query": enhanced_query, "doc": doc.page_content}
            score = float(ranking_chain.invoke(input_data).score)
            ranked_docs.append((doc, score))

        ranked_docs.sort(key=lambda x: x[1], reverse=True)
        return [doc for doc, _ in ranked_docs[:k]]


class AnalyticalRetrievalStrategy(BaseRetrievalStrategy):
    def retrieve(self, query, k=4):
        print("Retrieving analytical information...")
        sub_queries_prompt = PromptTemplate(
            input_variables=["query", "k"],
            template="Generate {k} sub-questions for: {query}"
        )
        sub_queries_chain = sub_queries_prompt | self.llm.with_structured_output(SubQueries)
        input_data = {"query": query, "k": k}
        sub_queries = sub_queries_chain.invoke(input_data).sub_queries
        print(f'Sub-queries: {sub_queries}')

        all_docs = []
        for sub_query in sub_queries:
            all_docs.extend(self.db.similarity_search(sub_query, k=2))

        diversity_prompt = PromptTemplate(
            input_variables=["query", "docs", "k"],
            template="Select the most diverse and relevant set of {k} documents for the query: '{query}'\nDocuments: {docs}\n"
        )
        diversity_chain = diversity_prompt | self.llm.with_structured_output(SelectedIndices)
        docs_text = "\n".join([f"{i}: {doc.page_content[:50]}..." for i, doc in enumerate(all_docs)])
        input_data = {"query": query, "docs": docs_text, "k": k}
        selected_indices = diversity_chain.invoke(input_data).indices

        return [all_docs[i] for i in selected_indices if i < len(all_docs)]


class OpinionRetrievalStrategy(BaseRetrievalStrategy):
    def retrieve(self, query, k=3):
        print("Retrieving opinions...")
        viewpoints_prompt = PromptTemplate(
            input_variables=["query", "k"],
            template="Identify {k} distinct viewpoints or perspectives on the topic: {query}"
        )
        viewpoints_chain = viewpoints_prompt | self.llm
        input_data = {"query": query, "k": k}
        viewpoints = viewpoints_chain.invoke(input_data).content.split('\n')
        print(f'Viewpoints: {viewpoints}')

        all_docs = []
        for viewpoint in viewpoints:
            all_docs.extend(self.db.similarity_search(f"{query} {viewpoint}", k=2))

        opinion_prompt = PromptTemplate(
            input_variables=["query", "docs", "k"],
            template="Classify these documents into distinct opinions on '{query}' and select the {k} most representative and diverse viewpoints:\nDocuments: {docs}\nSelected indices:"
        )
        opinion_chain = opinion_prompt | self.llm.with_structured_output(SelectedIndices)

        docs_text = "\n".join([f"{i}: {doc.page_content[:100]}..." for i, doc in enumerate(all_docs)])
        input_data = {"query": query, "docs": docs_text, "k": k}
        selected_indices = opinion_chain.invoke(input_data).indices

        return [all_docs[int(i)] for i in selected_indices if i.isdigit() and int(i) < len(all_docs)]


class ContextualRetrievalStrategy(BaseRetrievalStrategy):
    def retrieve(self, query, k=4, user_context=None):
        print("Retrieving contextual information...")
        context_prompt = PromptTemplate(
            input_variables=["query", "context"],
            template="Given the user context: {context}\nReformulate the query to best address the user's needs: {query}"
        )
        context_chain = context_prompt | self.llm
        input_data = {"query": query, "context": user_context or "No specific context provided"}
        contextualized_query = context_chain.invoke(input_data).content
        print(f'Contextualized query: {contextualized_query}')

        docs = self.db.similarity_search(contextualized_query, k=k * 2)

        ranking_prompt = PromptTemplate(
            input_variables=["query", "context", "doc"],
            template="Given the query: '{query}' and user context: '{context}', rate the relevance of this document on a scale of 1-10:\nDocument: {doc}\nRelevance score:"
        )
        ranking_chain = ranking_prompt | self.llm.with_structured_output(RelevantScore)

        ranked_docs = []
        for doc in docs:
            input_data = {"query": contextualized_query, "context": user_context or "No specific context provided",
                          "doc": doc.page_content}
            score = float(ranking_chain.invoke(input_data).score)
            ranked_docs.append((doc, score))

        ranked_docs.sort(key=lambda x: x[1], reverse=True)

        return [doc for doc, _ in ranked_docs[:k]]


# Define the main Adaptive RAG class
class AdaptiveRAG:
    def __init__(self, texts: List[str]):
        self.classifier = QueryClassifier()
        self.strategies = {
            "Factual": FactualRetrievalStrategy(texts),
            "Analytical": AnalyticalRetrievalStrategy(texts),
            "Opinion": OpinionRetrievalStrategy(texts),
            "Contextual": ContextualRetrievalStrategy(texts)
        }
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o", max_tokens=4000)
        prompt_template = """Use the following pieces of context to answer the question at the end. 
        If you don't know the answer, just say that you don't know, don't try to make up an answer.

        {context}

        Question: {question}
        Answer:"""
        self.prompt = PromptTemplate(template=prompt_template, input_variables=["context", "question"])
        self.llm_chain = self.prompt | self.llm

    def answer(self, query: str) -> str:
        category = self.classifier.classify(query)
        strategy = self.strategies[category]
        docs = strategy.retrieve(query)
        input_data = {"context": "\n".join([doc.page_content for doc in docs]), "question": query}
        return self.llm_chain.invoke(input_data).content


# Argument parsing functions
def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description="Run AdaptiveRAG system.")
    parser.add_argument('--texts', nargs='+', help="Input texts for retrieval")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    texts = args.texts or [
        "The Earth is the third planet from the Sun and the only astronomical object known to harbor life."]
    rag_sys
```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/choose_chunk_size.py`
```
import nest_asyncio
import random
import time
import os
from dotenv import load_dotenv
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings
from llama_index.core.prompts import PromptTemplate
from llama_index.core.evaluation import DatasetGenerator, FaithfulnessEvaluator, RelevancyEvaluator
from llama_index.llms.openai import OpenAI
from llama_index.core.node_parser import SentenceSplitter

# Apply asyncio fix for Jupyter notebooks
nest_asyncio.apply()

# Load environment variables
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


# Utility functions
def evaluate_response_time_and_accuracy(chunk_size, eval_questions, eval_documents, faithfulness_evaluator,
                                        relevancy_evaluator):
    """
    Evaluate the average response time, faithfulness, and relevancy of responses generated by GPT-3.5-turbo for a given chunk size.

    Parameters:
    chunk_size (int): The size of data chunks being processed.
    eval_questions (list): List of evaluation questions.
    eval_documents (list): Documents used for evaluation.
    faithfulness_evaluator (FaithfulnessEvaluator): Evaluator for faithfulness.
    relevancy_evaluator (RelevancyEvaluator): Evaluator for relevancy.

    Returns:
    tuple: A tuple containing the average response time, faithfulness, and relevancy metrics.
    """

    total_response_time = 0
    total_faithfulness = 0
    total_relevancy = 0

    # Set global LLM as GPT-3.5 
    llm = OpenAI(model="gpt-3.5-turbo")
    Settings.llm = llm
    
    # Create vector index
    splitter = SentenceSplitter(chunk_size=chunk_size)
    vector_index = VectorStoreIndex.from_documents(eval_documents, transformations=[splitter])

    # Build query engine
    query_engine = vector_index.as_query_engine(similarity_top_k=5)
    num_questions = len(eval_questions)

    # Iterate over each question in eval_questions to compute metrics
    for question in eval_questions:
        start_time = time.time()
        response_vector = query_engine.query(question)
        elapsed_time = time.time() - start_time

        faithfulness_result = faithfulness_evaluator.evaluate_response(response=response_vector).passing
        relevancy_result = relevancy_evaluator.evaluate_response(query=question, response=response_vector).passing

        total_response_time += elapsed_time
        total_faithfulness += faithfulness_result
        total_relevancy += relevancy_result

    average_response_time = total_response_time / num_questions
    average_faithfulness = total_faithfulness / num_questions
    average_relevancy = total_relevancy / num_questions

    return average_response_time, average_faithfulness, average_relevancy


# Define the main class for the RAG method

class RAGEvaluator:
    def __init__(self, data_dir, num_eval_questions, chunk_sizes):
        self.data_dir = data_dir
        self.num_eval_questions = num_eval_questions
        self.chunk_sizes = chunk_sizes
        self.documents = self.load_documents()
        self.eval_questions = self.generate_eval_questions()
        # Set GPT-4o as local configuration for evaluation
        self.llm_gpt4 = OpenAI(model="gpt-4o")
        self.faithfulness_evaluator = self.create_faithfulness_evaluator()
        self.relevancy_evaluator = self.create_relevancy_evaluator()

    def load_documents(self):
        return SimpleDirectoryReader(self.data_dir).load_data()

    def generate_eval_questions(self):
        eval_documents = self.documents[0:20]
        data_generator = DatasetGenerator.from_documents(eval_documents)
        eval_questions = data_generator.generate_questions_from_nodes()
        return random.sample(eval_questions, self.num_eval_questions)


    def create_faithfulness_evaluator(self):
        faithfulness_evaluator = FaithfulnessEvaluator(llm=self.llm_gpt4)
        faithfulness_new_prompt_template = PromptTemplate("""
            Please tell if a given piece of information is directly supported by the context.
            You need to answer with either YES or NO.
            Answer YES if any part of the context explicitly supports the information, even if most of the context is unrelated. If the context does not explicitly support the information, answer NO. Some examples are provided below.
            ...
            """)
        faithfulness_evaluator.update_prompts({"your_prompt_key": faithfulness_new_prompt_template})
        return faithfulness_evaluator

    def create_relevancy_evaluator(self):
        return RelevancyEvaluator(llm=self.llm_gpt4)

    def run(self):
        for chunk_size in self.chunk_sizes:
            avg_response_time, avg_faithfulness, avg_relevancy = evaluate_response_time_and_accuracy(
                chunk_size,
                self.eval_questions,
                self.documents[0:20],
                self.faithfulness_evaluator,
                self.relevancy_evaluator
            )
            print(f"Chunk size {chunk_size} - Average Response time: {avg_response_time:.2f}s, "
                  f"Average Faithfulness: {avg_faithfulness:.2f}, Average Relevancy: {avg_relevancy:.2f}")


# Argument Parsing

def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description='RAG Method Evaluation')
    parser.add_argument('--data_dir', type=str, default='../data', help='Directory of the documents')
    parser.add_argument('--num_eval_questions', type=int, default=25, help='Number of evaluation questions')
    parser.add_argument('--chunk_sizes', nargs='+', type=int, default=[128, 256], help='List of chunk sizes')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    evaluator = RAGEvaluator(data_dir=args.data_dir, num_eval_questions=args.num_eval_questions,
                             chunk_sizes=args.chunk_sizes)
    evaluator.run()

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/context_enrichment_window_around_chunk.py`
```
import os
import sys
from dotenv import load_dotenv
from langchain_core.documents import Document
from helper_functions import *
from evaluation.evalute_rag import *
from typing import List

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


# Function to split text into chunks with metadata of the chunk chronological index
def split_text_to_chunks_with_indices(text: str, chunk_size: int, chunk_overlap: int) -> List[Document]:
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(Document(page_content=chunk, metadata={"index": len(chunks), "text": text}))
        start += chunk_size - chunk_overlap
    return chunks


# Function to retrieve a chunk from the vectorstore based on its index in the metadata
def get_chunk_by_index(vectorstore, target_index: int) -> Document:
    all_docs = vectorstore.similarity_search("", k=vectorstore.index.ntotal)
    for doc in all_docs:
        if doc.metadata.get('index') == target_index:
            return doc
    return None


# Function that retrieves from the vectorstore based on semantic similarity and pads each retrieved chunk with its neighboring chunks
def retrieve_with_context_overlap(vectorstore, retriever, query: str, num_neighbors: int = 1, chunk_size: int = 200,
                                  chunk_overlap: int = 20) -> List[str]:
    relevant_chunks = retriever.get_relevant_documents(query)
    result_sequences = []

    for chunk in relevant_chunks:
        current_index = chunk.metadata.get('index')
        if current_index is None:
            continue

        # Determine the range of chunks to retrieve
        start_index = max(0, current_index - num_neighbors)
        end_index = current_index + num_neighbors + 1

        # Retrieve all chunks in the range
        neighbor_chunks = []
        for i in range(start_index, end_index):
            neighbor_chunk = get_chunk_by_index(vectorstore, i)
            if neighbor_chunk:
                neighbor_chunks.append(neighbor_chunk)

        # Sort chunks by their index to ensure correct order
        neighbor_chunks.sort(key=lambda x: x.metadata.get('index', 0))

        # Concatenate chunks, accounting for overlap
        concatenated_text = neighbor_chunks[0].page_content
        for i in range(1, len(neighbor_chunks)):
            current_chunk = neighbor_chunks[i].page_content
            overlap_start = max(0, len(concatenated_text) - chunk_overlap)
            concatenated_text = concatenated_text[:overlap_start] + current_chunk

        result_sequences.append(concatenated_text)

    return result_sequences


# Main class that encapsulates the RAG method
class RAGMethod:
    def __init__(self, chunk_size: int = 400, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.docs = self._prepare_docs()
        self.vectorstore, self.retriever = self._prepare_retriever()

    def _prepare_docs(self) -> List[Document]:
        content = """
            Artificial Intelligence (AI) has a rich history dating back to the mid-20th century. The term "Artificial Intelligence" was coined in 1956 at the Dartmouth Conference, marking the field's official beginning.
            
            In the 1950s and 1960s, AI research focused on symbolic methods and problem-solving. The Logic Theorist, created in 1955 by Allen Newell and Herbert A. Simon, is often considered the first AI program.
            
            The 1960s saw the development of expert systems, which used predefined rules to solve complex problems. DENDRAL, created in 1965, was one of the first expert systems, designed to analyze chemical compounds.
            
            However, the 1970s brought the first "AI Winter," a period of reduced funding and interest in AI research, largely due to overpromised capabilities and underdelivered results.
            
            The 1980s saw a resurgence with the popularization of expert systems in corporations. The Japanese government's Fifth Generation Computer Project also spurred increased investment in AI research globally.
            
            Neural networks gained prominence in the 1980s and 1990s. The backpropagation algorithm, although discovered earlier, became widely used for training multi-layer networks during this time.
            
            The late 1990s and 2000s marked the rise of machine learning approaches. Support Vector Machines (SVMs) and Random Forests became popular for various classification and regression tasks.
            
            Deep Learning, a subset of machine learning using neural networks with many layers, began to show promising results in the early 2010s. The breakthrough came in 2012 when a deep neural network significantly outperformed other machine learning methods in the ImageNet competition.
            
            Since then, deep learning has revolutionized many AI applications, including image and speech recognition, natural language processing, and game playing. In 2016, Google's AlphaGo defeated a world champion Go player, a landmark achievement in AI.
            
            The current era of AI is characterized by the integration of deep learning with other AI techniques, the development of more efficient and powerful hardware, and the ethical considerations surrounding AI deployment.
            
            Transformers, introduced in 2017, have become a dominant architecture in natural language processing, enabling models like GPT (Generative Pre-trained Transformer) to generate human-like text.
            
            As AI continues to evolve, new challenges and opportunities arise. Explainable AI, robust and fair machine learning, and artificial general intelligence (AGI) are among the key areas of current and future research in the field.
            """
        return split_text_to_chunks_with_indices(content, self.chunk_size, self.chunk_overlap)

    def _prepare_retriever(self):
        embeddings = OpenAIEmbeddings()
        vectorstore = FAISS.from_documents(self.docs, embeddings)
        retriever = vectorstore.as_retriever(search_kwargs={"k": 1})
        return vectorstore, retriever

    def run(self, query: str, num_neighbors: int = 1):
        baseline_chunk = self.retriever.get_relevant_documents(query)
        enriched_chunks = retrieve_with_context_overlap(self.vectorstore, self.retriever, query, num_neighbors,
                                                        self.chunk_size, self.chunk_overlap)
        return baseline_chunk[0].page_content, enriched_chunks[0]


# Argument parsing function
def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description="Run RAG method on a given PDF and query.")
    parser.add_argument("--query", type=str, default="When did deep learning become prominent in AI?",
                        help="Query to test the retriever (default: 'What is the main topic of the document?').")
    parser.add_argument('--chunk_size', type=int, default=400, help="Size of text chunks.")
    parser.add_argument('--chunk_overlap', type=int, default=200, help="Overlap between chunks.")
    parser.add_argument('--num_neighbors', type=int, default=1, help="Number of neighboring chunks for context.")
    return parser.parse_args()


# Main execution
if __name__ == "__main__":
    args = parse_args()

    # Initialize and run the RAG method
    rag_method = RAGMethod(chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap)
    baseline, enriched = rag_method.run(args.query, num_neighbors=args.num_neighbors)

    print("Baseline Chunk:")
    print(baseline)

    print("\nEnriched Chunks:")
    print(enriched)

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/contextual_compression.py`
```
import os
import sys
import time
import argparse
from dotenv import load_dotenv
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain.retrievers import ContextualCompressionRetriever
from langchain.chains import RetrievalQA
from helper_functions import *
from evaluation.evalute_rag import *

# Add the parent directory to the path since we work with notebooks
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))

# Load environment variables from a .env file
load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


class ContextualCompressionRAG:
    """
    A class to handle the process of creating a retrieval-based Question Answering system
    with a contextual compression retriever.
    """

    def __init__(self, path, model_name="gpt-4o-mini", temperature=0, max_tokens=4000):
        """
        Initializes the ContextualCompressionRAG by setting up the document store and retriever.

        Args:
            path (str): Path to the PDF file to process.
            model_name (str): The name of the language model to use (default: gpt-4o-mini).
            temperature (float): The temperature for the language model.
            max_tokens (int): The maximum tokens for the language model (default: 4000).
        """
        print("\n--- Initializing Contextual Compression RAG ---")
        self.path = path
        self.model_name = model_name
        self.temperature = temperature
        self.max_tokens = max_tokens

        # Step 1: Create a vector store
        self.vector_store = self._encode_document()

        # Step 2: Create a retriever
        self.retriever = self.vector_store.as_retriever()

        # Step 3: Initialize language model and create a contextual compressor
        self.llm = self._initialize_llm()
        self.compressor = LLMChainExtractor.from_llm(self.llm)

        # Step 4: Combine the retriever with the compressor
        self.compression_retriever = ContextualCompressionRetriever(
            base_compressor=self.compressor,
            base_retriever=self.retriever
        )

        # Step 5: Create a QA chain with the compressed retriever
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            retriever=self.compression_retriever,
            return_source_documents=True
        )

    def _encode_document(self):
        """Helper function to encode the document into a vector store."""
        return encode_pdf(self.path)

    def _initialize_llm(self):
        """Helper function to initialize the language model."""
        return ChatOpenAI(temperature=self.temperature, model_name=self.model_name, max_tokens=self.max_tokens)

    def run(self, query):
        """
        Executes a query using the QA chain and prints the result.

        Args:
            query (str): The query to run against the document.
        """
        print("\n--- Running Query ---")
        start_time = time.time()
        result = self.qa_chain.invoke({"query": query})
        elapsed_time = time.time() - start_time

        # Display the result and the source documents
        print(f"Result: {result['result']}")
        print(f"Source Documents: {result['source_documents']}")
        print(f"Query Execution Time: {elapsed_time:.2f} seconds")
        return result, elapsed_time


# Function to parse command line arguments
def parse_args():
    parser = argparse.ArgumentParser(description="Process a PDF document with contextual compression RAG.")
    parser.add_argument("--model_name", type=str, default="gpt-4o-mini",
                        help="Name of the language model to use (default: gpt-4o-mini).")
    parser.add_argument("--path", type=str, default="../data/Understanding_Climate_Change.pdf",
                        help="Path to the PDF file to process.")
    parser.add_argument("--query", type=str, default="What is the main topic of the document?",
                        help="Query to test the retriever (default: 'What is the main topic of the document?').")
    parser.add_argument("--temperature", type=float, default=0,
                        help="Temperature setting for the language model (default: 0).")
    parser.add_argument("--max_tokens", type=int, default=4000,
                        help="Max tokens for the language model (default: 4000).")

    return parser.parse_args()


# Main function to run the RAG pipeline
def main(args):
    # Initialize ContextualCompressionRAG
    contextual_compression_rag = ContextualCompressionRAG(
        path=args.path,
        model_name=args.model_name,
        temperature=args.temperature,
        max_tokens=args.max_tokens
    )

    # Run a query
    contextual_compression_rag.run(args.query)


if __name__ == '__main__':
    # Call the main function with parsed arguments
    main(parse_args())

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/crag.py`
```
import os
import sys
import argparse
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.pydantic_v1 import BaseModel, Field
from langchain_community.tools import DuckDuckGoSearchResults
from helper_functions import encode_pdf
import json

sys.path.append(os.path.abspath(
    os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path since we work with notebooks

# Load environment variables from a .env file
load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


class RetrievalEvaluatorInput(BaseModel):
    """
    Model for capturing the relevance score of a document to a query.
    """
    relevance_score: float = Field(..., description="Relevance score between 0 and 1, "
                                                    "indicating the document's relevance to the query.")


class QueryRewriterInput(BaseModel):
    """
    Model for capturing a rewritten query suitable for web search.
    """
    query: str = Field(..., description="The query rewritten for better web search results.")


class KnowledgeRefinementInput(BaseModel):
    """
    Model for extracting key points from a document.
    """
    key_points: str = Field(..., description="Key information extracted from the document in bullet-point form.")


class CRAG:
    """
    A class to handle the CRAG process for document retrieval, evaluation, and knowledge refinement.
    """

    def __init__(self, path, model="gpt-4o-mini", max_tokens=1000, temperature=0, lower_threshold=0.3,
                 upper_threshold=0.7):
        """
        Initializes the CRAG Retriever by encoding the PDF document and creating the necessary models and search tools.

        Args:
            path (str): Path to the PDF file to encode.
            model (str): The language model to use for the CRAG process.
            max_tokens (int): Maximum tokens to use in LLM responses (default: 1000).
            temperature (float): The temperature to use for LLM responses (default: 0).
            lower_threshold (float): Lower threshold for document evaluation scores (default: 0.3).
            upper_threshold (float): Upper threshold for document evaluation scores (default: 0.7).
        """
        print("\n--- Initializing CRAG Process ---")

        self.lower_threshold = lower_threshold
        self.upper_threshold = upper_threshold

        # Encode the PDF document into a vector store
        self.vectorstore = encode_pdf(path)

        # Initialize OpenAI language model
        self.llm = ChatOpenAI(model=model, max_tokens=max_tokens, temperature=temperature)

        # Initialize search tool
        self.search = DuckDuckGoSearchResults()

    @staticmethod
    def retrieve_documents(query, faiss_index, k=3):
        docs = faiss_index.similarity_search(query, k=k)
        return [doc.page_content for doc in docs]

    def evaluate_documents(self, query, documents):
        return [self.retrieval_evaluator(query, doc) for doc in documents]

    def retrieval_evaluator(self, query, document):
        prompt = PromptTemplate(
            input_variables=["query", "document"],
            template="On a scale from 0 to 1, how relevant is the following document to the query? "
                     "Query: {query}\nDocument: {document}\nRelevance score:"
        )
        chain = prompt | self.llm.with_structured_output(RetrievalEvaluatorInput)
        input_variables = {"query": query, "document": document}
        result = chain.invoke(input_variables).relevance_score
        return result

    def knowledge_refinement(self, document):
        prompt = PromptTemplate(
            input_variables=["document"],
            template="Extract the key information from the following document in bullet points:"
                     "\n{document}\nKey points:"
        )
        chain = prompt | self.llm.with_structured_output(KnowledgeRefinementInput)
        input_variables = {"document": document}
        result = chain.invoke(input_variables).key_points
        return [point.strip() for point in result.split('\n') if point.strip()]

    def rewrite_query(self, query):
        prompt = PromptTemplate(
            input_variables=["query"],
            template="Rewrite the following query to make it more suitable for a web search:\n{query}\nRewritten query:"
        )
        chain = prompt | self.llm.with_structured_output(QueryRewriterInput)
        input_variables = {"query": query}
        return chain.invoke(input_variables).query.strip()

    @staticmethod
    def parse_search_results(results_string):
        try:
            results = json.loads(results_string)
            return [(result.get('title', 'Untitled'), result.get('link', '')) for result in results]
        except json.JSONDecodeError:
            print("Error parsing search results. Returning empty list.")
            return []

    def perform_web_search(self, query):
        rewritten_query = self.rewrite_query(query)
        web_results = self.search.run(rewritten_query)
        web_knowledge = self.knowledge_refinement(web_results)
        sources = self.parse_search_results(web_results)
        return web_knowledge, sources

    def generate_response(self, query, knowledge, sources):
        response_prompt = PromptTemplate(
            input_variables=["query", "knowledge", "sources"],
            template="Based on the following knowledge, answer the query. "
                     "Include the sources with their links (if available) at the end of your answer:"
                     "\nQuery: {query}\nKnowledge: {knowledge}\nSources: {sources}\nAnswer:"
        )
        input_variables = {
            "query": query,
            "knowledge": knowledge,
            "sources": "\n".join([f"{title}: {link}" if link else title for title, link in sources])
        }
        response_chain = response_prompt | self.llm
        return response_chain.invoke(input_variables).content

    def run(self, query):
        print(f"\nProcessing query: {query}")

        # Retrieve and evaluate documents
        retrieved_docs = self.retrieve_documents(query, self.vectorstore)
        eval_scores = self.evaluate_documents(query, retrieved_docs)

        print(f"\nRetrieved {len(retrieved_docs)} documents")
        print(f"Evaluation scores: {eval_scores}")

        # Determine action based on evaluation scores
        max_score = max(eval_scores)
        sources = []

        if max_score > self.upper_threshold:
            print("\nAction: Correct - Using retrieved document")
            best_doc = retrieved_docs[eval_scores.index(max_score)]
            final_knowledge = best_doc
            sources.append(("Retrieved document", ""))
        elif max_score < self.lower_threshold:
            print("\nAction: Incorrect - Performing web search")
            final_knowledge, sources = self.perform_web_search(query)
        else:
            print("\nAction: Ambiguous - Combining retrieved document and web search")
            best_doc = retrieved_docs[eval_scores.index(max_score)]
            retrieved_knowledge = self.knowledge_refinement(best_doc)
            web_knowledge, web_sources = self.perform_web_search(query)
            final_knowledge = "\n".join(retrieved_knowledge + web_knowledge)
            sources = [("Retrieved document", "")] + web_sources

        print("\nFinal knowledge:")
        print(final_knowledge)

        print("\nSources:")
        for title, link in sources:
            print(f"{title}: {link}" if link else title)

        print("\nGenerating response...")
        response = self.generate_response(query, final_knowledge, sources)
        print("\nResponse generated")
        return response


# Function to validate command line inputs
def validate_args(args):
    if args.max_tokens <= 0:
        raise ValueError("max_tokens must be a positive integer.")
    if args.temperature < 0 or args.temperature > 1:
        raise ValueError("temperature must be between 0 and 1.")
    return args


# Function to parse command line arguments
def parse_args():
    parser = argparse.ArgumentParser(description="CRAG Process for Document Retrieval and Query Answering.")
    parser.add_argument("--path", type=str, default="../data/Understanding_Climate_Change.pdf",
                        help="Path to the PDF file to encode.")
    parser.add_argument("--model", type=str, default="gpt-4o-mini",
                        help="Language model to use (default: gpt-4o-mini).")
    parser.add_argument("--max_tokens", type=int, default=1000,
                        help="Maximum tokens to use in LLM responses (default: 1000).")
    parser.add_argument("--temperature", type=float, default=0,
                        help="Temperature to use for LLM responses (default: 0).")
    parser.add_argument("--query", type=str, default="What are the main causes of climate change?",
                        help="Query to test the CRAG process.")
    parser.add_argument("--lower_threshold", type=float, default=0.3,
                        help="Lower threshold for score evaluation (default: 0.3).")
    parser.add_argument("--upper_threshold", type=float, default=0.7,
                        help="Upper threshold for score evaluation (default: 0.7).")

    return validate_args(parser.parse_args())


# Main function to handle argument parsing and call the CRAG class
def main(args):
    # Initialize the CRAG process
    crag = CRAG(
        path=args.path,
        model=args.model,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
        lower_threshold=args.lower_threshold,
        upper_threshold=args.upper_threshold
    )

    # Process the query
    response = crag.run(args.query)
    print(f"Query: {args.query}")
    print(f"Answer: {response}")


if __name__ == '__main__':
    main(parse_args())

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/document_augmentation.py`
```
import sys
import os
import re
from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from enum import Enum
from langchain_openai import OpenAIEmbeddings
from langchain_openai import ChatOpenAI
from typing import Any, Dict, List, Tuple
from pydantic import BaseModel, Field
import argparse

from dotenv import load_dotenv

load_dotenv()

os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path

from helper_functions import *


class QuestionGeneration(Enum):
    """
    Enum class to specify the level of question generation for document processing.
    """
    DOCUMENT_LEVEL = 1
    FRAGMENT_LEVEL = 2


DOCUMENT_MAX_TOKENS = 4000
DOCUMENT_OVERLAP_TOKENS = 100
FRAGMENT_MAX_TOKENS = 128
FRAGMENT_OVERLAP_TOKENS = 16
QUESTION_GENERATION = QuestionGeneration.DOCUMENT_LEVEL
QUESTIONS_PER_DOCUMENT = 40


class QuestionList(BaseModel):
    question_list: List[str] = Field(..., title="List of questions generated for the document or fragment")


class OpenAIEmbeddingsWrapper(OpenAIEmbeddings):
    """
    A wrapper class for OpenAI embeddings, providing a similar interface to the original OllamaEmbeddings.
    """
    def __call__(self, query: str) -> List[float]:
        return self.embed_query(query)


def clean_and_filter_questions(questions: List[str]) -> List[str]:
    cleaned_questions = []
    for question in questions:
        cleaned_question = re.sub(r'^\d+\.\s*', '', question.strip())
        if cleaned_question.endswith('?'):
            cleaned_questions.append(cleaned_question)
    return cleaned_questions


def generate_questions(text: str) -> List[str]:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    prompt = PromptTemplate(
        input_variables=["context", "num_questions"],
        template="Using the context data: {context}\n\nGenerate a list of at least {num_questions} "
                 "possible questions that can be asked about this context."
    )
    chain = prompt | llm.with_structured_output(QuestionList)
    input_data = {"context": text, "num_questions": QUESTIONS_PER_DOCUMENT}
    result = chain.invoke(input_data)
    questions = result.question_list
    return list(set(clean_and_filter_questions(questions)))


def generate_answer(content: str, question: str) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    prompt = PromptTemplate(
        input_variables=["context", "question"],
        template="Using the context data: {context}\n\nProvide a brief and precise answer to the question: {question}"
    )
    chain = prompt | llm
    input_data = {"context": content, "question": question}
    return chain.invoke(input_data)


def split_document(document: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    tokens = re.findall(r'\b\w+\b', document)
    chunks = []
    for i in range(0, len(tokens), chunk_size - chunk_overlap):
        chunk_tokens = tokens[i:i + chunk_size]
        chunks.append(chunk_tokens)
        if i + chunk_size >= len(tokens):
            break
    return [" ".join(chunk) for chunk in chunks]


def print_document(comment: str, document: Any) -> None:
    print(f'{comment} (type: {document.metadata["type"]}, index: {document.metadata["index"]}): {document.page_content}')


class DocumentProcessor:
    def __init__(self, content: str, embedding_model: OpenAIEmbeddings):
        self.content = content
        self.embedding_model = embedding_model

    def run(self):
        text_documents = split_document(self.content, DOCUMENT_MAX_TOKENS, DOCUMENT_OVERLAP_TOKENS)
        print(f'Text content split into: {len(text_documents)} documents')

        documents = []
        counter = 0
        for i, text_document in enumerate(text_documents):
            text_fragments = split_document(text_document, FRAGMENT_MAX_TOKENS, FRAGMENT_OVERLAP_TOKENS)
            print(f'Text document {i} - split into: {len(text_fragments)} fragments')

            for j, text_fragment in enumerate(text_fragments):
                documents.append(Document(
                    page_content=text_fragment,
                    metadata={"type": "ORIGINAL", "index": counter, "text": text_document}
                ))
                counter += 1

                if QUESTION_GENERATION == QuestionGeneration.FRAGMENT_LEVEL:
                    questions = generate_questions(text_fragment)
                    documents.extend([
                        Document(page_content=question,
                                 metadata={"type": "AUGMENTED", "index": counter + idx, "text": text_document})
                        for idx, question in enumerate(questions)
                    ])
                    counter += len(questions)
                    print(f'Text document {i} Text fragment {j} - generated: {len(questions)} questions')

            if QUESTION_GENERATION == QuestionGeneration.DOCUMENT_LEVEL:
                questions = generate_questions(text_document)
                documents.extend([
                    Document(page_content=question,
                             metadata={"type": "AUGMENTED", "index": counter + idx, "text": text_document})
                    for idx, question in enumerate(questions)
                ])
                counter += len(questions)
                print(f'Text document {i} - generated: {len(questions)} questions')

        for document in documents:
            print_document("Dataset", document)

        print(f'Creating store, calculating embeddings for {len(documents)} FAISS documents')
        vectorstore = FAISS.from_documents(documents, self.embedding_model)

        print("Creating retriever returning the most relevant FAISS document")
        return vectorstore.as_retriever(search_kwargs={"k": 1})


def parse_args():
    parser = argparse.ArgumentParser(description="Process a document and create a retriever.")
    parser.add_argument('--path', type=str, default='../data/Understanding_Climate_Change.pdf',
                        help="Path to the PDF document to process")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Load sample PDF document to string variable
    content = read_pdf_to_string(args.path)

    # Instantiate OpenAI Embeddings class that will be used by FAISS
    embedding_model = OpenAIEmbeddings()

    # Process documents and create retriever
    processor = DocumentProcessor(content, embedding_model)
    document_query_retriever = processor.run()

    # Example usage of the retriever
    query = "What is climate change?"
    retrieved_docs = document_query_retriever.get_relevant_documents(query)
    print(f"\nQuery: {query}")
    print(f"Retrieved document: {retrieved_docs[0].page_content}")

    # Further query example
    query = "How do freshwater ecosystems change due to alterations in climatic factors?"
    retrieved_documents = document_query_retriever.get_relevant_documents(query)
    for doc in retrieved_documents:
        print_document("Relevant fragment retrieved", doc)

    context = doc.metadata['text']
    answer = generate_answer(context, query)
    print(f'{os.linesep}Answer:{os.linesep}{answer}')

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/explainable_retrieval.py`
```
import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


# Define utility classes/functions
class ExplainableRetriever:
    def __init__(self, texts):
        self.embeddings = OpenAIEmbeddings()
        self.vectorstore = FAISS.from_texts(texts, self.embeddings)
        self.llm = ChatOpenAI(temperature=0, model_name="gpt-4o-mini", max_tokens=4000)
        self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 5})

        explain_prompt = PromptTemplate(
            input_variables=["query", "context"],
            template="""
            Analyze the relationship between the following query and the retrieved context.
            Explain why this context is relevant to the query and how it might help answer the query.

            Query: {query}

            Context: {context}

            Explanation:
            """
        )
        self.explain_chain = explain_prompt | self.llm

    def retrieve_and_explain(self, query):
        docs = self.retriever.get_relevant_documents(query)
        explained_results = []

        for doc in docs:
            input_data = {"query": query, "context": doc.page_content}
            explanation = self.explain_chain.invoke(input_data).content
            explained_results.append({
                "content": doc.page_content,
                "explanation": explanation
            })
        return explained_results


class ExplainableRAGMethod:
    def __init__(self, texts):
        self.explainable_retriever = ExplainableRetriever(texts)

    def run(self, query):
        return self.explainable_retriever.retrieve_and_explain(query)


# Argument Parsing
def parse_args():
    import argparse
    parser = argparse.ArgumentParser(description="Explainable RAG Method")
    parser.add_argument('--query', type=str, default='Why is the sky blue?', help="Query for the retriever")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    # Sample texts (these can be replaced by actual data)
    texts = [
        "The sky is blue because of the way sunlight interacts with the atmosphere.",
        "Photosynthesis is the process by which plants use sunlight to produce energy.",
        "Global warming is caused by the increase of greenhouse gases in Earth's atmosphere."
    ]

    explainable_rag = ExplainableRAGMethod(texts)
    results = explainable_rag.run(args.query)

    for i, result in enumerate(results, 1):
        print(f"Result {i}:")
        print(f"Content: {result['content']}")
        print(f"Explanation: {result['explanation']}")
        print()

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/fusion_retrieval.py`
```
import os
import sys
from dotenv import load_dotenv
from langchain_core.documents import Document
from typing import List
from rank_bm25 import BM25Okapi
import numpy as np

# Add the parent directory to the path
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables
load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')


# Function to encode the PDF to a vector store and return split documents
def encode_pdf_and_get_split_documents(path, chunk_size=1000, chunk_overlap=200):
    """
    Encodes a PDF book into a vector store using OpenAI embeddings.

    Args:
        path: The path to the PDF file.
        chunk_size: The desired size of each text chunk.
        chunk_overlap: The amount of overlap between consecutive chunks.

    Returns:
        A FAISS vector store containing the encoded book content.
    """
    loader = PyPDFLoader(path)
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
    )
    texts = text_splitter.split_documents(documents)
    cleaned_texts = replace_t_with_space(texts)
    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(cleaned_texts, embeddings)

    return vectorstore, cleaned_texts


# Function to create BM25 index for keyword retrieval
def create_bm25_index(documents: List[Document]) -> BM25Okapi:
    """
    Create a BM25 index from the given documents.

    Args:
        documents (List[Document]): List of documents to index.

    Returns:
        BM25Okapi: An index that can be used for BM25 scoring.
    """
    tokenized_docs = [doc.page_content.split() for doc in documents]
    return BM25Okapi(tokenized_docs)


# Function for fusion retrieval combining keyword-based (BM25) and vector-based search
def fusion_retrieval(vectorstore, bm25, query: str, k: int = 5, alpha: float = 0.5) -> List[Document]:
    """
    Perform fusion retrieval combining keyword-based (BM25) and vector-based search.

    Args:
    vectorstore (VectorStore): The vectorstore containing the documents.
    bm25 (BM25Okapi): Pre-computed BM25 index.
    query (str): The query string.
    k (int): The number of documents to retrieve.
    alpha (float): The weight for vector search scores (1-alpha will be the weight for BM25 scores).

    Returns:
    List[Document]: The top k documents based on the combined scores.
    """
    all_docs = vectorstore.similarity_search("", k=vectorstore.index.ntotal)
    bm25_scores = bm25.get_scores(query.split())
    vector_results = vectorstore.similarity_search_with_score(query, k=len(all_docs))

    vector_scores = np.array([score for _, score in vector_results])
    vector_scores = 1 - (vector_scores - np.min(vector_scores)) / (np.max(vector_scores) - np.min(vector_scores))
    bm25_scores = (bm25_scores - np.min(bm25_scores)) / (np.max(bm25_scores) - np.min(bm25_scores))

    combined_scores = alpha * vector_scores + (1 - alpha) * bm25_scores
    sorted_indices = np.argsort(combined_scores)[::-1]

    return [all_docs[i] for i in sorted_indices[:k]]


class FusionRetrievalRAG:
    def __init__(self, path: str, chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        Initializes the FusionRetrievalRAG class by setting up the vector store and BM25 index.

        Args:
        path (str): Path to the PDF file.
        chunk_size (int): The size of each text chunk.
        chunk_overlap (int): The overlap between consecutive chunks.
        """
        self.vectorstore, self.cleaned_texts = encode_pdf_and_get_split_documents(path, chunk_size, chunk_overlap)
        self.bm25 = create_bm25_index(self.cleaned_texts)

    def run(self, query: str, k: int = 5, alpha: float = 0.5):
        """
        Executes the fusion retrieval for the given query.

        Args:
        query (str): The search query.
        k (int): The number of documents to retrieve.
        alpha (float): The weight of vector search vs. BM25 search.

        Returns:
        List[Document]: The top k retrieved documents.
        """
        top_docs = fusion_retrieval(self.vectorstore, self.bm25, query, k, alpha)
        docs_content = [doc.page_content for doc in top_docs]
        show_context(docs_content)


def parse_args():
    """
    Parses command-line arguments.

    Returns:
    args: The parsed arguments.
    """
    import argparse
    parser = argparse.ArgumentParser(description="Fusion Retrieval RAG Script")
    parser.add_argument('--path', type=str, default="../data/Understanding_Climate_Change.pdf",
                        help='Path to the PDF file.')
    parser.add_argument('--chunk_size', type=int, default=1000, help='Size of each chunk.')
    parser.add_argument('--chunk_overlap', type=int, default=200, help='Overlap between consecutive chunks.')
    parser.add_argument('--query', type=str, default='What are the impacts of climate change on the environment?',
                        help='Query to retrieve documents.')
    parser.add_argument('--k', type=int, default=5, help='Number of documents to retrieve.')
    parser.add_argument('--alpha', type=float, default=0.5, help='Weight for vector search vs. BM25.')

    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    retriever = FusionRetrievalRAG(path=args.path, chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap)
    retriever.run(query=args.query, k=args.k, alpha=args.alpha)

```

### Core Architecture Module: `all_rag_techniques_runnable_scripts/graph_rag.py`
```
import networkx as nx
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_community.callbacks import get_openai_callback

from sklearn.metrics.pairwise import cosine_similarity
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os
import sys
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from typing import List, Tuple, Dict
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
import nltk
import spacy
import heapq
import argparse

from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import numpy as np

from spacy.cli import download
from spacy.lang.en import English

sys.path.append(os.path.abspath(
    os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path sicnce we work with notebooks
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

nltk.download('punkt', quiet=True)
nltk.download('wordnet', quiet=True)


# Define the document processor class
# Define the DocumentProcessor class
class DocumentProcessor:
    def __init__(self):
        """
        Initializes the DocumentProcessor with a text splitter and OpenAI embeddings.

        Attributes:
        - text_splitter: An instance of RecursiveCharacterTextSplitter with specified chunk size and overlap.
        - embeddings: An instance of OpenAIEmbeddings used for embedding documents.
        """
        self.text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        self.embeddings = OpenAIEmbeddings()

    def process_documents(self, documents):
        """
        Processes a list of documents by splitting them into smaller chunks and creating a vector store.

        Args:
        - documents (list of str): A list of documents to be processed.

        Returns:
        - tuple: A tuple containing:
          - splits (list of str): The list of split document chunks.
          - vector_store (FAISS): A FAISS vector store created from the split document chunks and their embeddings.
        """
        splits = self.text_splitter.split_documents(documents)
        vector_store = FAISS.from_documents(splits, self.embeddings)
        return splits, vector_store

    def create_embeddings_batch(self, texts, batch_size=32):
        """
        Creates embeddings for a list of texts in batches.

        Args:
        - texts (list of str): A list of texts to be embedded.
        - batch_size (int, optional): The number of texts to process in each batch. Default is 32.

        Returns:
        - numpy.ndarray: An array of embeddings for the input texts.
        """
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = self.embeddings.embed_documents(batch)
            embeddings.extend(batch_embeddings)
        return np.array(embeddings)

    def compute_similarity_matrix(self, embeddings):
        """
        Computes a cosine similarity matrix for a given set of embeddings.

        Args:
        - embeddings (numpy.ndarray): An array of embeddings.

        Returns:
        - numpy.ndarray: A cosine similarity matrix for the input embeddings.
        """
        return cosine_similarity(embeddings)


# Define the knowledge graph class
# Define the Concepts class
class Concepts(BaseModel):
    concepts_list: List[str] = Field(description="List of concepts")


# Define the KnowledgeGraph class
class KnowledgeGraph:
    def __init__(self):
        """
        Initializes the KnowledgeGraph with a graph, lemmatizer, and NLP model.

        Attributes:
        - graph: An instance of a networkx Graph.
        - lemmatizer: An instance of WordNetLemmatizer.
        - concept_cache: A dictionary to cache extracted concepts.
        - nlp: An instance of a spaCy NLP model.
        - edges_threshold: A float value that sets the threshold for adding edges based on similarity.
        """
        self.graph = nx.Graph()
        self.lemmatizer = WordNetLemmatizer()
        self.concept_cache = {}
        self.nlp = self._load_spacy_model()
        self.edges_threshold = 0.8

    def build_graph(self, splits, llm, embedding_model):
        """
        Builds the knowledge graph by adding nodes, creating embeddings, extracting concepts, and adding edges.

        Args:
        - splits (list): A list of document splits.
        - llm: An instance of a large language model.
        - embedding_model: An instance of an embedding model.

        Returns:
        - None
        """
        self._add_nodes(splits)
        embeddings = self._create_embeddings(splits, embedding_model)
        self._extract_concepts(splits, llm)
        self._add_edges(embeddings)

    def _add_nodes(self, splits):
        """
        Adds nodes to the graph from the document splits.

        Args:
        - splits (list): A list of document splits.

        Returns:
        - None
        """
        for i, split in enumerate(splits):
            self.graph.add_node(i, content=split.page_content)

    def _create_embeddings(self, splits, embedding_model):
        """
        Creates embeddings for the document splits using the embedding model.

        Args:
        - splits (list): A list of document splits.
        - embedding_model: An instance of an embedding model.

        Returns:
        - numpy.ndarray: An array of embeddings for the document splits.
        """
        texts = [split.page_content for split in splits]
        return embedding_model.embed_documents(texts)

    def _compute_similarities(self, embeddings):
        """
        Computes the cosine similarity matrix for the embeddings.

        Args:
        - embeddings (numpy.ndarray): An array of embeddings.

        Returns:
        - numpy.ndarray: A cosine similarity matrix for the embeddings.
        """
        return cosine_similarity(embeddings)

    def _load_spacy_model(self):
        """
        Loads the spaCy NLP model, downloading it if necessary.

        Args:
        - None

        Returns:
        - spacy.Language: An instance of a spaCy NLP model.
        """
        try:
            return spacy.load("en_core_web_sm")
        except OSError:
            print("Downloading spaCy model...")
            download("en_core_web_sm")
            return spacy.load("en_core_web_sm")

    def _extract_concepts_and_entities(self, content, llm):
        """
        Extracts concepts and named entities from the content using spaCy and a large language model.

        Args:
        - content (str): The content from which to extract concepts and entities.
        - llm: An instance of a large language model.

        Returns:
        - list: A list of extracted concepts and entities.
        """
        if content in self.concept_cache:
            return self.concept_cache[content]

        # Extract named entities using spaCy
        doc = self.nlp(content)
        named_entities = [ent.text for ent in doc.ents if ent.label_ in ["PERSON", "ORG", "GPE", "WORK_OF_ART"]]

        # Extract general concepts using LLM
        concept_extraction_prompt = PromptTemplate(
            input_variables=["text"],
            template="Extract key concepts (excluding named entities) from the following text:\n\n{text}\n\nKey concepts:"
        )
        concept_chain = concept_extraction_prompt | llm.with_structured_output(Concepts)
        general_concepts = concept_chain.invoke({"text": content}).concepts_list

        # Combine named entities and general concepts
        all_concepts = list(set(named_entities + general_concepts))

        self.concept_cache[content] = all_concepts
        return all_concepts

    def _extract_concepts(self, splits, llm):
        """
        Extracts concepts for all document splits using multi-threading.

        Args:
        - splits (list): A list of document splits.
        - llm: An instance of a large language model.

        Returns:
        - None
        """
        with ThreadPoolExecutor() as executor:
            future_to_node = {executor.submit(self._extract_concepts_and_entities, split.page_content, llm): i
                              for i, split in enumerate(splits)}

            for future in tqdm(as_completed(future_to_node), total=len(splits),
                               desc="Extracting concepts and entities"):
                node = future_to_node[future]
                concepts = future.result()
                self.graph.nodes[node]['concepts'] = concepts

    def _add_edges(self, embeddings):
        """
        Adds edges to the graph based on the similarity of embeddings and shared concepts.

        Args:
        - embeddings (numpy.ndarray): An array of embeddings for the document splits.

        Returns:
        - None
        """
        similarity_matrix = self._compute_similarities(embeddings)
        num_nodes = len(self.graph.nodes)

        for node1 in tqdm(range(num_nodes), desc="Adding edges"):
            for node2 in range(node1 + 1, num_nodes):
                similarity_score = similarity_matrix[node1][node2]
                if similarity_score > self.edges_threshold:
                    shared_concepts = set(self.graph.nodes[node1]['concepts']) & set(
                        self.graph.nodes[node2]['concepts'])
                    edge_weight = self._calculate_edge_weight(node1, node2, similarity_score, shared_concepts)
                    self.graph.add_edge(node1, node2, weight=edge_weight,
           
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #200** (2026-09-04): **readme: feature the hallucination film in the video rail**
  *Symptoms*: Featured card for https://www.youtube.com/watch?v=AiyRZV38Lk0&list=PLBrpE2PttR2k above the episode table, tracker-routed with the `&list=` deep link.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01LeoqXKAUc1TC2DRQq2AkkH
  **Post-Mortem & Fix Analysis**:
  > <h3>PR Summary by Qodo</h3>  Feature hallucination film in README video rail  <code>📝 Documentation</code> <code>✨ Enhancement</code> <code>🕐 Less than 5 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Features the hallucination film above the README’s RAG episode table. >• Routes clicks through attribution tracking while preserving YouTube playlist context. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid sequenceDiagram   actor U as Reader   participant R as README   participant T as Click Tracker   participant Y as YouTube   R-->>U: Show featured card   U->>T: Open tracked link   T->>Y: Redirect with playlist   Y-->>U: Play film ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >The PR appropriately reuses the established featur
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can route each action level your way: inline, summary, both, or drop</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img src="https://www.qodo.

- **Issue #197** (2026-08-30): **Add Hybrid RAG Issue & PR Assistant to Related Projects**
  *Symptoms*: ### Summary Adds [Hybrid RAG Issue & PR Assistant](https://github.com/Cagrik34/Hybrid-RAG-Issue-PR-Assistant) to the Related Projects section.  ### Why it fits This repo covers a concrete production hybrid retrieval architecture directly related to the techniques documented here. It fuses SQLite FTS5 (Okapi BM25) lexical indexing with dense vector embeddings via Reciprocal Rank Fusion (k=60), producing AST-grounded line citations ([file#L<start>-L<end>]). The entire pipeline runs inside GitHub Actions with zero external vector database dependencies.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added the Hybrid RAG Issue & PR Assistant to the README’s Related Projects section.   * Included a brief description of its hybrid retrieval and CI/CD capabilities.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can enable the Remediation agent and Qodo fixes findings in a dedicated fix PR</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img src="https:/
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/RAG_Techniques/pull/197)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README adds a related-project entry for the Hybrid RAG Issue & PR Assistant. The entry describes its hybrid retrieval method and AST-grounded citations.  ### Changes  **Related project documentation**  |Layer / File(s)|Summary| |---|---| |**Add related-project entry** <br> `README.md`|The “Related Projects” section now links to the Hybrid RAG Issue & PR Assistant and describes its retrieval and citation features.|  **Estimated code review effort:** 1 (Trivial) | ~2 minutes  <!-- final_review_risk_start --> **Merge Risk:** _🔵 Low_ · up to `46ce7`  The change adds a relat
  > <h3>PR Summary by Qodo</h3>  Add Hybrid RAG Assistant to Related Projects  <code>📝 Documentation</code> <code>🕐 Less than 5 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds the Hybrid RAG Issue &amp; PR Assistant to Related Projects. >• Highlights its zero-cloud hybrid retrieval and AST-grounded citation capabilities. ></pre>  </dd> </dl>  </details>  <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >Adding the project directly to the existing Related Projects list is the appropriate approach; no architectural alternative is warranted for this documentation-only change.  </dd> </dl>  </details>  <details> <summary> Files changed (1) <code> +2 / -0 </code> </summary>  <dl> <dd>  <br/>  <details> <summary>Documentation (1) <code> +2 / -0 </code></summary>  <dl> <dd>  <details> <summary>README.md<code>List the Hy

- **Issue #196** (2026-08-29): **Link the Contextual Retrieval explainer to contextual chunk headers**
  *Symptoms*: Wires the new explainer video into the three standard spots for this technique:  1. **Techniques table** — `Video · Watch` badge on the Contextual Chunk Headers row 2. **Detailed list** — a `🎬 Watch it explained` line with a one-sentence hook 3. **The notebook** — a header cell right after the overview  All three route through the views-tracker Cloud Function and carry the playlist context (`&list=PLW_gT61bcB78`), so a click starts a real session instead of a single orphaned view. Verified: the built URL returns `302` to `https://www.youtube.com/watch?v=Gh6VIuA9u1s&list=PLW_gT61bcB78` with the list parameter intact.  Video: **[Contextual Retrieval for RAG: Why Your Best Chunk Ranks Last](https://www.youtube.com/watch?v=Gh6VIuA9u1s&list=PLW_gT61bcB78)** (6 min)  No CTA text added, and no book-promo cell — only the watch links.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_0134RakCjcutR66C7JHwJbwA  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added an explanatory YouTube video link for the Contextual Chunk Headers technique in the README.   * Added the same video resource to the related tutorial notebook for easier access.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/RAG_Techniques/pull/196)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README and contextual chunk headers notebook add links to a YouTube video that explains contextual retrieval for RAG.  ### Changes  **Contextual Chunk Headers Media**  |Layer / File(s)|Summary| |---|---| |**Add explainer video references** <br> `README.md`, `all_rag_techniques/contextual_chunk_headers.ipynb`|The README adds video links to the technique table and detailed section. The notebook adds a “Watch it explained” markdown cell.|  **Estimated code review effort:** 1 (Trivial) | ~2 minutes  <!-- final_review_risk_start --> **Merge Risk:** _🟡 Moderate_ · up to `9ea6
  > <h3>PR Summary by Qodo</h3>  Link Contextual Chunk Headers to its video explainer  <code>📝 Documentation</code> <code>🕐 Less than 5 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds a video badge and explainer link to Contextual Chunk Headers documentation. >• Surfaces the same explainer directly after the notebook overview. >• Routes every placement through view tracking with playlist context. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   Table["Technique table"] --> Tracker["Views tracker"] --> Video["YouTube playlist"]   List["Detailed list"] --> Tracker   Notebook["Notebook header"] --> Tracker ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >The PR appropriately reuses the repository&#x27;s established three
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can reply &#x27;qodo&#x27; on any finding to push back, ask questions, or dig deeper</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img src="h

- **Issue #195** (2026-08-28): **Bump actions/checkout from 6 to 7**
  *Symptoms*: Bumps [actions/checkout](https://github.com/actions/checkout) from 6 to 7. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/checkout/releases">actions/checkout's releases</a>.</em></p> <blockquote> <h2>v7.0.0</h2> <h2>What's Changed</h2> <ul> <li>block checking out fork pr for pull_request_target and workflow_run by <a href="https://github.com/aiqiaoy"><code>@​aiqiaoy</code></a> in <a href="https://redirect.github.com/actions/checkout/pull/2454">actions/checkout#2454</a></li> <li>Bump actions/publish-immutable-action from 0.0.3 to 0.0.4 in the minor-actions-dependencies group across 1 directory by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2458">actions/checkout#2458</a></li> <li>Bump flatted from 3.3.1 to 3.4.2 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2460">actions/checkout#2460</a></li> <li>Bump js-yaml from 4.1.0 to 4.2.0 by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2461">actions/checkout#2461</a></li> <li>Bump <code>@​actions/core</code> and <code>@​actions/tool-cache</code> and Remove uuid by <a href="https://github.com/dependabot"><code>@​dependabot</code></a>[bot] in <a href="https://redirect.github.com/actions/checkout/pull/2459">action
  **Post-Mortem & Fix Analysis**:
  > ### Labels  The following labels could not be found: `dependencies`. Please create it before Dependabot can add it to a pull request.   Please fix the above issues or remove invalid values from `dependabot.yml`.
  > Merging. Both workflows use only the stable inputs (`python-version`, `cache`), so these are drop-in bumps.  Worth flagging separately though: `github-test.yml` is currently dead. It triggers on `paths: ["requirements.txt"]`, and this repo has no root `requirements.txt` - so the workflow has never fired, and if it did, its `pip install -r requirements.txt` step would fail. The `tests/` directory does exist (`test_imports.py`), so there is a real test to run; the trigger just points at a file that is not there. Opened as a note rather than fixed here, since it is unrelated to a dependency bump.

- **Issue #194** (2026-08-28): **Bump actions/setup-python from 6 to 7**
  *Symptoms*: Bumps [actions/setup-python](https://github.com/actions/setup-python) from 6 to 7. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/actions/setup-python/releases">actions/setup-python's releases</a>.</em></p> <blockquote> <h2>v7.0.0</h2> <h2>What's Changed</h2> <h3>Enhancements</h3> <ul> <li>Migrate to ESM and upgrade dependencies by <a href="https://github.com/priyagupta108"><code>@​priyagupta108</code></a> in <a href="https://redirect.github.com/actions/setup-python/pull/1330">actions/setup-python#1330</a></li> <li>Pin SHA commits and update docs with latest versions by <a href="https://github.com/HarithaVattikuti"><code>@​HarithaVattikuti</code></a> in <a href="https://redirect.github.com/actions/setup-python/pull/1338">actions/setup-python#1338</a></li> <li>Remove the pip-install input by <a href="https://github.com/gowridurgad"><code>@​gowridurgad</code></a> in <a href="https://redirect.github.com/actions/setup-python/pull/1336">actions/setup-python#1336</a></li> </ul> <h3>Bug Fix</h3> <ul> <li>Fix to Classify stderr warning messages as warnings instead of errors in annotations by <a href="https://github.com/lmvysakh"><code>@​lmvysakh</code></a> in <a href="https://redirect.github.com/actions/setup-python/pull/1335">actions/setup-python#1335</a></li> <li>Validate and retry manifest fetch to prevent silent failures by <a href="https://github.com/priyagupta108"><code>@​priyagupta108</code></a> in <a href="https://redirect.github.co
  **Post-Mortem & Fix Analysis**:
  > ### Labels  The following labels could not be found: `dependencies`. Please create it before Dependabot can add it to a pull request.   Please fix the above issues or remove invalid values from `dependabot.yml`.
  > Merging. Both workflows use only the stable inputs (`python-version`, `cache`), so these are drop-in bumps.  Worth flagging separately though: `github-test.yml` is currently dead. It triggers on `paths: ["requirements.txt"]`, and this repo has no root `requirements.txt` - so the workflow has never fired, and if it did, its `pip install -r requirements.txt` step would fail. The `tests/` directory does exist (`test_imports.py`), so there is a real test to run; the trigger just points at a file that is not there. Opened as a note rather than fixed here, since it is unrelated to a dependency bump.

- **Issue #193** (2026-08-27): **feat(links): every video link opens in playlist context**
  *Symptoms*: All 23 tracked YouTube links now deep-link with the RAG playlist context (`&list=`), so a repo click autoplays into the next episode — turning single-video external sessions into multi-video native sessions (the co-watch evidence YouTube's suggested/browse surfaces are built from). Tracker redirects curl-verified (302, list param preserved).  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_01Qs3rzXV51DBP7qkQBGWcVj  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Documentation**   - Improved README.md formatting for video references, technique tables, and explanatory links.   - Updated tutorial links to include relevant playlist information, making related learning content easier to access.   - Refined the HyDE tutorial’s video description for clearer, more concise wording.   - No instructional content, examples, or notebook functionality was changed.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/RAG_Techniques/pull/193)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `5e732f4b-f762-49f4-9e4e-0825c90e5e2a`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 8fc1173cf84e86ba78c4d597c8d5af2d39bcdf3d and 1f345eea5ddbcaf63f7925fff0b1669e7353ba8
  > <h3>PR Summary by Qodo</h3>  Open tracked video links in RAG playlist context  <code>✨ Enhancement</code> <code>📝 Documentation</code> <code>🕐 Less than 10 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds RAG playlist context to 23 tracked YouTube destinations. >• Preserves click attribution while continuing viewers into subsequent explainer episodes. >• Applies consistently across the main README and six technique notebooks. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid sequenceDiagram     actor Reader     participant Docs as Repo docs     participant Tracker as Click tracker     participant Video as YouTube video     participant Playlist as RAG playlist     Reader->>Docs: Click explainer     Docs->>Tracker: Send encoded target     Tracker-->>Reader: Return 302 redirect     R
  > <h3>Code Review by Qodo</h3>  <code>🐞 Bugs (1)</code>  <code>📘 Rule violations (0)</code>  <code>📜 Skill insights (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <br/>  <img src="https://img.shields.io/badge/High-634FD1?style=flat-square" height="20px" alt="Action required">  <details> <summary>  1.  Sibling links lack playlist <code>🐞 Bug</code> <code>≡ Correctness</code></summary>  <br/>  > <details open> ><summary>Description</summary> ><br/> > ><pre> >The PR updates the root episode links but leaves the same four tracked episode links in ><b><i>all_rag_techniques/README.md</i></b> without <b><i>list=PLW_gT61bcB78</i></b>. Clicks from that index therefore still >open standalone videos, contradicting the every-link behavior introduced here. ></pre> ></details>  > <details> ><summary>Code</summary> ><br/> > ><code>[README.md[114]](https://github.com/NirDiamant/RAG_Techniques/pull/193/files#diff-b3356305516

- **Issue #192** (2026-08-27): **docs(hyde): add the Watch-it-explained line to the README detailed list**
  *Symptoms*: The HyDE entry had the table badge and the notebook header but was missing the detailed-list 🎬 line every other episode-linked technique carries. Tracker URL curl-tested: 302 → the watch page.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_0148qXP1Qyq5MDFyPazC6M6a  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added a YouTube “Watch” badge for the HyDE technique in the advanced techniques table.   * Added a “Watch it explained” video link to the HyDE query enhancement section.   * Embedded an explanatory HyDE video in the HyDE tutorial notebook.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/RAG_Techniques/pull/192)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `01f08ec1-079a-4f22-90d0-364dca0efaf0`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between eaa4b4c135630ea0991c84112987880b9c28fe73 and 0f49f6a25e5f2fe469cff5964a7e3d3176d1b24
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can ask Qodo to dismiss a finding you disagree with, with your reason on record</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img src="https:
  > <h3>PR Summary by Qodo</h3>  docs(hyde): add tracked explainer links across README and notebook  <code>📝 Documentation</code> <code>🕐 Less than 10 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds HyDE video links to the README table and detailed technique entry. >• Embeds the six-minute explainer in the HyDE notebook. >• Uses placement-specific tracker IDs to preserve click attribution. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   Reader(["Reader"]) --> Readme["README links"] --> Tracker["Click tracker"] --> Video["YouTube video"]   Reader --> Notebook["HyDE notebook"] --> Tracker ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >The current approach is appropriate because it reuses the repository&#x27;s establi

- **Issue #191** (2026-08-28): **docs(hyde): link the HyDE explainer video (RAG Made Simple Ep 6)**
  *Symptoms*: **RAG Made Simple Ep 6 — HyDE** is live: https://youtu.be/koHZ6JbTk_c  Wires the video into the two places this repo's readers actually look, per the launch checklist (~75% of a RAG video's *external* traffic comes from this repo, which makes it the single biggest external driver):  - **README technique table, row 7 (HyDE)** — adds the red `Video / Watch` badge beside the existing GitHub + Colab badges, matching row 6 (Query Transformations). - **`HyDe_Hypothetical_Document_Embedding.ipynb`** — a `## 🎬 Watch it explained` header cell at the top, same shape as the query-transformations notebook.  Both links route through `rag-techniques-tracker` with their own `click=` id (`youtube-hyde-table`, `youtube-hyde-notebook`) so per-placement conversion stays comparable.  **Verified before committing:** both tracker URLs return **HTTP 302 → `https://www.youtube.com/watch?v=koHZ6JbTk_c`**. Worth stating because only `rag-techniques-tracker` allowlists `youtube.com` — the per-repo trackers return 400 on a YouTube target, which would have shipped dead links.  The notebook was re-parsed as JSON after editing; no other cells touched.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  https://claude.ai/code/session_017JBoVjWj6AMHaAGKD6Q1JP  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added a Video-Watch link to the HyDE technique entry in the README.   * Added a six-minute explanatory video li
  **Post-Mortem & Fix Analysis**:
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can start a comment with &#x27;qodo&#x27; or &#x27;@qodo&#x27; to chat about any finding</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img sr
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/RAG_Techniques/pull/191?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README adds a YouTube badge for HyDE. The HyDE notebook adds a markdown cell with the same video and a description of its topics. No functional notebook logic changes.  ### Changes  **HyDE video references**  |Layer / File(s)|Summary| |---|---| |**Add explanatory video links** <br> `README.md`, `all_rag_techniques/HyDe_Hypothetical_Document_Embedding.ipynb`|The README adds a YouTube badge to the HyDE row. The notebook adds a “Watch it explained” markdown cell with the video link and topic summary.|
  > <h3>PR Summary by Qodo</h3>  Link HyDE explainer video from README and notebook  <code>📝 Documentation</code> <code>🕐 Less than 5 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds a tracked HyDE video badge to the README technique table. >• Surfaces the explainer in the HyDE notebook with placement-specific conversion tracking. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   README["README table"] -->|tracked click| Tracker["Views tracker"] -->|HTTP 302| Video["HyDE video"]   Notebook["HyDE notebook"] -->|tracked click| Tracker ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >The current approach is optimal because it reuses the repository&#x27;s established video placement and tracking conventions while assigning 

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

### Incident Patch 1: `b1a3fa5c` (2026-07-24)
**Commit Message**: Fix 404 GitHub links in the techniques list

The GitHub badge links in the numbered list below the table had a Colab
URL concatenated onto the repo blob path, e.g.
  .../RAG_TECHNIQUES/blob/main/https://colab.research.google.com/...
Every one of those 404'd. Rewrote them to the plain blob path, corrected
the HyPE filename (HyPE_Hypothetical_Prompt_Embedding ->
HyPE_Hypothetical_Prompt_Embeddings), and dropped the dead badges from
table row 17, which pointed at a multi_faceted_filtering notebook that
does not exist in the repo.

All 73 GitHub links in the README now return 200.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +35/-35)
```diff
@@ -161,7 +161,7 @@ Explore our extensive list of cutting-edge RAG techniques:
 | 14 | Context Enrichment 📚 | Document Augmentation | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/document_augmentation.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/document_augmentation.ipynb) |
 | 15 | Advanced Retrieval 🚀 | Fusion Retrieval | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/fusion_retrieval.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/fusion_retrieval.ipynb) |
 | 16 | Advanced Retrieval 🚀 | Reranking | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/reranking.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reranking.ipynb) |
-| 17 | Advanced Retrieval 🚀 | Multi-faceted Filtering | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/multi_faceted_filtering.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_faceted_filtering.ipynb) |
+| 17 | Advanced Retrieval 🚀 | Multi-faceted Filtering | Described below (no notebook yet) |
 | 18 | Advanced Retrieval 🚀 | Hierarchical Indices | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/hierarchical_indices.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/hierarchical_indices.ipynb) |
 | 19 | Advanced Retrieval 🚀 | Dartboard Retrieval | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/dartboard.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/dartboard.ipynb) |
 | 20 | Advanced Retrieval 🚀 | Multi-modal RAG with Captioning | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/multi_model_rag_with_captioning.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_model_rag_with_captioning.ipynb) |
@@ -186,8 +186,8 @@ Explore our extensive list of cutting-edge RAG techniques:
 
 1. Simple RAG 🌱
    - **🎬 Watch it explained**: **[RAG Explained: Why AI Gets Your Own Documents Wrong](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=youtube-simple-rag-list&target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DrRCfl4aRYJs&retarget=0&text=youtube-simple-rag-list)** — the intuition behind this notebook in 7 minutes: why chunks overlap, what "meaning space" actually is, and where simple RAG breaks down. *([Subscribe](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=youtube-subscribe-simple-rag&target=https%3A%2F%2Fwww.youtube.com%2F%40DiamantAI%3Fsub_confirmation%3D1&retarget=0&text=youtube-subscribe-simple-rag) to get the next technique explained.)*
-   - **LangChain**: [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb)
-   - **LlamaIndex**: [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag_with_llamaindex.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Technique
```

---

### Incident Patch 2: `90d6c98a` (2026-06-08)
**Commit Message**: fix: makedirs before wget, remove duplicate download

**File**: `all_rag_techniques/local_rag_huggingface_faiss.ipynb` (modified, +13/-9)
```diff
@@ -97,14 +97,10 @@
     "import sys\n",
     "sys.path.append('RAG_Techniques')\n",
     "\n",
-    "# Download the shared PDF document used across notebooks\n",
-    "!wget -q -O data/Understanding_Climate_Change.pdf \\\n",
-    "    https://raw.githubusercontent.com/NirDiamant/RAG_Techniques/main/data/Understanding_Climate_Change.pdf\n",
-    "\n",
+    "# Create data directory and download PDF\n",
     "import os\n",
     "os.makedirs('data', exist_ok=True)\n",
     "\n",
-    "# Re-download to correct path after creating directory\n",
     "!wget -q -O data/Understanding_Climate_Change.pdf \\\n",
     "    https://raw.githubusercontent.com/NirDiamant/RAG_Techniques/main/data/Understanding_Climate_Change.pdf\n",
     "\n",
@@ -616,17 +612,25 @@
   }
  ],
  "metadata": {
+  "colab": {
+   "provenance": []
+  },
   "kernelspec": {
    "display_name": "Python 3",
    "language": "python",
    "name": "python3"
   },
   "language_info": {
+   "codemirror_mode": {
+    "name": "ipython",
+    "version": 3
+   },
+   "file_extension": ".py",
+   "mimetype": "text/x-python",
    "name": "python",
-   "version": "3.9.0"
-  },
-  "colab": {
-   "provenance": []
+   "nbconvert_exporter": "python",
+   "pygments_lexer": "ipython3",
+   "version": "3.7.4"
   }
  },
  "nbformat": 4,
```

---

### Incident Patch 3: `7ca760a5` (2026-06-03)
**Commit Message**: Auto-apply RAGKING via ?code=, frame as GitHub-community offer, fix rating

- RAG book links now use /rag-made-simple?code=RAGKING so the 33% launch
  discount auto-applies at checkout for the GitHub community.
- Reword the coupon copy as a GitHub-community offer.
- Correct the book rating to 4.6 stars.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +6/-6)
```diff
@@ -1,16 +1,16 @@
 <div align="center">
 
-# 📖 [RAG Made Simple: the book that extends this repo](https://diamant-ai.com/rag-made-simple)
+# 📖 [RAG Made Simple: the book that extends this repo](https://diamant-ai.com/rag-made-simple?code=RAGKING)
 
-<a href="https://diamant-ai.com/rag-made-simple"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="600"></a>
+<a href="https://diamant-ai.com/rag-made-simple?code=RAGKING"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="600"></a>
 
 The full reference: a 400-page visual guide that goes deeper than any notebook can. The **intuition** behind every technique, **side-by-side comparisons** of when each one wins (and when it quietly fails), and **diagrams** that make the tricky parts finally click.
 
-**1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.4 stars**
+**1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.6 stars**
 
-📖 **PDF + EPUB · 33% off at checkout with code RAGKING (launch offer)**
+📖 **PDF + EPUB · GitHub community offer: 33% off with code RAGKING**
 
-### 👉 [**Get RAG Made Simple (33% off with code RAGKING)**](https://diamant-ai.com/rag-made-simple)
+### 👉 [**Get RAG Made Simple (33% off with code RAGKING)**](https://diamant-ai.com/rag-made-simple?code=RAGKING)
 
 ---
 
@@ -481,7 +481,7 @@ Explore our extensive list of cutting-edge RAG techniques:
     #### Implementation 🛠️
     - Build a complete MemoryStore with FAISS-based retrieval, surrogate queries, and comparison evaluation against standard RAG.
 
-> 📖 **Want to understand all these techniques visually?** [RAG Made Simple](https://diamant-ai.com/rag-made-simple) covers 22 core RAG techniques through diagrams and plain-English explanations. Now 33% off with code RAGKING for the launch.
+> 📖 **Want to understand all these techniques visually?** [RAG Made Simple](https://diamant-ai.com/rag-made-simple?code=RAGKING) covers 22 core RAG techniques through diagrams and plain-English explanations. Now 33% off for the GitHub community with code RAGKING.
 
 ### 🔬 Explainability and Transparency
 
```

---

### Incident Patch 4: `6375af14` (2026-05-31)
**Commit Message**: Fix README centering: close banner div so body reads left-aligned

The earlier 'demote jobs section' change left the opening <div align=center>
by the banner while moving its closing </div> to the bottom jobs panel, so
the entire README body rendered centered. Close the div right after the
banner (keeps the hero centered) and drop the stray </div> at the bottom,
restoring left-aligned body text and the left-aligned jobs panel.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -41,6 +41,8 @@ The prompting foundation that makes RAG work better. Same author, same visual ap
 
 <img src="images/collective-banner.png" alt="DiamantAI Collective - AI engineering jobs" width="600">
 
+</div>
+
 ## Sponsors ❤️
 
 We gratefully acknowledge the organizations and individuals who have made significant contributions to this project.
@@ -635,8 +637,6 @@ To begin implementing these advanced RAG techniques in your projects:
 
 ---
 
-</div>
-
 > 🌟 **Support This Project:** Your sponsorship fuels innovation in RAG technologies. **[Become a sponsor](https://www.diamant-ai.com/sponsorship)** to help maintain and expand this valuable resource!
 
 ## Contributing
```

---

### Incident Patch 5: `86f129ad` (2026-05-31)
**Commit Message**: Fix stale book pricing in notebooks: $0.99 launch price -> current $9.99/$24.99

The book-promo cell in every notebook still advertised the expired $0.99
launch price with 'launch window only' urgency. The Kindle price is $9.99
now, so readers clicked through to a different price than promised. Updated
all 38 notebooks to accurate pricing and removed the stale urgency.

**File**: `all_rag_techniques/Agentic_RAG.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--agentic-rag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--agentic-rag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--agentic-rag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--agentic-rag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/HyDe_Hypothetical_Document_Embedding.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hyde-hypothetical-document-embedding&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hyde-hypothetical-document-embedding&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hyde-hypothetical-document-embedding&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hyde-hypothetical-document-embedding&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/HyPE_Hypothetical_Prompt_Embeddings.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hype-hypothetical-prompt-embeddings&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hype-hypothetical-prompt-embeddings&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hype-hypothetical-prompt-embeddings&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--hype-hypothetical-prompt-embeddings&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/Microsoft_GraphRag.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--microsoft-graphrag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--microsoft-graphrag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--microsoft-graphrag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--microsoft-graphrag&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/adaptive_retrieval.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--adaptive-retrieval&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--adaptive-retrieval&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--adaptive-retrieval&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--adaptive-retrieval&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/choose_chunk_size.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--choose-chunk-size&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--choose-chunk-size&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--choose-chunk-size&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--choose-chunk-size&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/context_enrichment_window_around_chunk.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

**File**: `all_rag_techniques/context_enrichment_window_around_chunk_with_llamaindex.ipynb` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk-with-llamaindex&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Launch window only: $0.99.** The price goes up once the launch ends, and readers who grab it now lock in the lowest price it will ever have.\n\n### \ud83d\udc49 [Get the book on Amazon before the price changes](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk-with-llamaindex&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
+    "## \ud83d\udcd6 [The RAG Techniques Book is HERE](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk-with-llamaindex&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n**The super extended version of this repository.** The book goes far beyond the notebooks: the **intuition** behind every technique, **side-by-side comparisons** showing when each approach wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.\n\n\u23f3 **Kindle $9.99 / Paperback $24.99 / Free with Kindle Unlimited.** An Amazon Bestseller in Generative AI (hit #1 in Generative AI on Amazon at launch).\n\n### \ud83d\udc49 [Get the book on Amazon](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=all-rag-techniques--context-enrichment-window-around-chunk-with-llamaindex&click=book-buy-amazon&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragnb-20&text=)\n\n---\n"
    ]
   },
   {
```

---

### Incident Patch 6: `f2ed7c46` (2026-05-30)
**Commit Message**: docs(readme): cross-link Agent Memory Techniques repo

Add a link to the Agent Memory Techniques notebooks so readers of this repo
discover the agent-memory tutorials.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +3/-0)
```diff
@@ -150,6 +150,9 @@ Related deep dives: [How to stop AI hallucinations](https://diamant-ai.com/blog/
 🖋️ Check out my  **[Prompt Engineering Techniques guide](https://github.com/NirDiamant/Prompt_Engineering)** for a comprehensive collection of prompting strategies, from basic concepts to advanced techniques, enhancing your ability to interact effectively with AI language models.
 
 
+🧠 Give your agents memory with **[Agent Memory Techniques](https://github.com/NirDiamant/Agent_Memory_Techniques)** — 30 runnable notebooks on conversation buffers, vector stores, knowledge graphs, episodic and semantic memory, plus Mem0, MemGPT/Letta, Zep, and Graphiti.
+
+
 ## A Community-Driven Knowledge Hub
 
 **This repository grows stronger with your contributions!** Join our vibrant communities - the central hubs for shaping and advancing this project together 🤝
```

---

### Incident Patch 7: `615c3ba8` (2026-05-15)
**Commit Message**: Revert Collective CTA to plain markdown 302 link

The new-tab experiments (target="_blank" attribute and the newtab=1 HTML
JS bridge) didn't deliver: GitHub strips target attrs, and the JS bridge
showed a visible intermediate page before popup blockers fell back to
same-tab anyway. Going back to the known-good markdown image-link that
hits the cloud function and 302s in the same tab.

The new-tab branch in the cloud function is dormant (only triggers on
&newtab=1) so no redeploy needed; leaving the dead path for now.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ The series prerequisite, **Prompt Engineering: Master the Art of AI Interaction*
 
 **AI-first companies are hiring through the DiamantAI Collective.**
 
-<a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme--jobs-panel&click=jobs-panel-see-all-roles&target=https%3A%2F%2Fdiamant-ai.com%2Fjobs&text=See%20open%20jobs%20and%20apply&newtab=1" target="_blank" rel="noopener noreferrer"><img src="https://img.shields.io/badge/%E2%9E%A1%EF%B8%8F%20%20See%20open%20jobs%20and%20apply-7c3aed?style=for-the-badge" alt="See open jobs and apply"></a>
+[![See open jobs and apply](https://img.shields.io/badge/%E2%9E%A1%EF%B8%8F%20%20See%20open%20jobs%20and%20apply-7c3aed?style=for-the-badge)](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme--jobs-panel&click=jobs-panel-see-all-roles&target=https%3A%2F%2Fdiamant-ai.com%2Fjobs&text=See%20open%20jobs%20and%20apply)
 
 ---
 
```

---

### Incident Patch 8: `a00eaf05` (2026-04-15)
**Commit Message**: Revert RAG book promotion back to $0.99 launch pricing (#139)

The book was briefly raised to $9.99 to prep for a Kindle Countdown Deal, but KDP's 30-day list price stability rule blocked the countdown. Price restored to $0.99 for the remainder of the launch window.

PE Book countdown banner (where present) remains since PE is still on its Kindle Countdown Deal at $2.99 through April 21.

Co-authored-by: NirDiamant <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +4/-2)
```diff
@@ -10,9 +10,11 @@
 
 Built on top of everything in this repo, the book goes far deeper: the **intuition** behind every technique, **side-by-side comparisons** of when each one wins (and when it quietly fails), and **illustrations** that make the tricky parts finally click.
 
-### **Free with Kindle Unlimited** or **$9.99** on Amazon
+### ⏳ **Free with Kindle Unlimited** or **$0.99** launch price
 
-### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragrm-20&text=Get%20the%20book%20on%20Amazon)
+The price goes up once the launch window closes. Readers who grab it now lock in the lowest price it will ever have, and get the same material that took months of research, writing, and iteration to put together.
+
+### 👉 [**Get the book on Amazon before the price changes**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-ragrm-20&text=Get%20the%20book%20on%20Amazon%20before%20the%20price%20changes)
 
 </div>
 
```

---

### Incident Patch 9: `614fb71a` (2026-04-11)
**Commit Message**: Clean up README: remove Technologies section, fix broken table header (#135)

Two unrelated README fixes in one commit:

1. Remove the "Technologies and Frameworks 🛠️" section. It listed four
   frameworks (PydanticAI, LangChain, LlamaIndex, Contextual AI) but
   the notebooks in this repo aren't tied to those specific frameworks
   and the section was adding noise rather than value.

2. Fix the broken Advanced Techniques table header. The previous
   markdown was malformed:
     | # | Category | Technique | View |
     |---|
     > **Recently added:** ... | **42 notebooks** and growing

     ----------|-----------|------|
   The blockquote was wedged inside the column separator row, breaking
   the table rendering entirely. Fix extracts the "Recently added"
   blockquote to its own line above the table, and restores a proper
   4-column separator row.

Co-authored-by: NirDiamant <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +3/-13)
```diff
@@ -136,24 +136,14 @@ Whether you're an expert or just starting out, your insights can shape the futur
 - 🛠️ Practical implementation guidelines
 - 🌟 Regular updates with the latest advancements
 
-## Technologies and Frameworks 🛠️
-
-This repository leverages cutting-edge frameworks and tools to build production-ready RAG systems:
-
-- **PydanticAI** - A Python framework for building agentic AI applications with type safety and structured outputs. PydanticAI provides seamless integration with LLMs while ensuring data validation through Pydantic models, making it ideal for production RAG systems that require reliable, type-safe agent workflows.
-- **LangChain** - Comprehensive framework for developing LLM applications with powerful abstractions for building RAG pipelines
-- **LlamaIndex** - Data framework for LLM applications with focus on data ingestion and retrieval optimization
-- **Contextual AI** - Managed platform for production-ready agentic RAG with enterprise-grade parsing and grounded LLMs
-
 ## Advanced Techniques
 
 Explore our extensive list of cutting-edge RAG techniques:
 
-| # | Category | Technique | View |
-|---|
-> **Recently added:** MemoRAG (memory-augmented retrieval), End-to-End RAG Evaluation, Open-RAG-Eval, JSON RAG | **42 notebooks** and growing
+> **Recently added:** MemoRAG (memory-augmented retrieval), End-to-End RAG Evaluation, Open-RAG-Eval, JSON RAG. **42 notebooks** and growing.
 
-----------|-----------|------|
+| # | Category | Technique | View |
+|---|----------|-----------|------|
 | 1 | Foundational 🌱 | Basic RAG | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/simple_rag.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb) |
 | 2 | Foundational 🌱 | RAG with CSV Files | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/simple_csv_rag.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_csv_rag.ipynb) |
 | 3 | Foundational 🌱 | Reliable RAG | [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/all_rag_techniques/reliable_rag.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reliable_rag.ipynb) |
```

#### Recent Merged Pull Requests:
- **PR #200** (2026-09-04): readme: feature the hallucination film in the video rail (@NirDiamant)
- **PR #197** (closed): Add Hybrid RAG Issue & PR Assistant to Related Projects (@Cagrik34)
- **PR #196** (2026-08-29): Link the Contextual Retrieval explainer to contextual chunk headers (@NirDiamant)
- **PR #195** (2026-08-28): Bump actions/checkout from 6 to 7 (@dependabot[bot])
- **PR #194** (2026-08-28): Bump actions/setup-python from 6 to 7 (@dependabot[bot])
- **PR #193** (2026-08-27): feat(links): every video link opens in playlist context (@NirDiamant)
- **PR #192** (2026-08-27): docs(hyde): add the Watch-it-explained line to the README detailed list (@NirDiamant)
- **PR #191** (closed): docs(hyde): link the HyDE explainer video (RAG Made Simple Ep 6) (@NirDiamant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
