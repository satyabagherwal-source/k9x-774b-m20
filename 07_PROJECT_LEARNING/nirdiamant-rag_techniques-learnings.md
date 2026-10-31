> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nirdiamant-rag_techniques-learnings.md`  
> **Source**: github ([https://github.com/NirDiamant/RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques))  
> **Source Version**: `4fea9188`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T06:38:35.761Z  
> **Learning ID**: `learn-github-nirdiamant-rag_techniques`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): NirDiamant/RAG_Techniques

> **Canonical Artifact**: `07_PROJECT_LEARNING/nirdiamant-rag_techniques-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NirDiamant/RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T06:38:35.756Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NirDiamant/RAG_Techniques`
- **Description**: This repository showcases various advanced techniques for Retrieval-Augmented Generation (RAG) systems. Each technique has a detailed notebook tutorial.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 30149 stars

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
from langchain_classic.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate

sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"
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
    llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)
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
        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)
        self.qa_chain = RetrievalQA.from_chain_type(self.llm, retriever=self.retriever)

    def run(self, query: str, relevance: int, quality: int):
        response = self.qa_chain.invoke(query)["result"]
        feedback = get_user_feedback(query, response, relevance, quality)
        store_feedback(feedback)

        docs = self.retriever.invoke(query)
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

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"

# Define the HyDe retriever class - creating vector store, generating hypothetical document, and retrieving
class HyDERetriever:
    def __init__(self, files_path, chunk_size=500, chunk_overlap=100):
        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)
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

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"

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
        llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL)
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
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

sys.path.append(os.path.abspath(
    os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path since we work with notebooks
from helper_functions import *
from evaluation.evalute_rag import *

# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"


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
        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)
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
        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)

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
        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)
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
        "The Earth is the third planet from the Sun and the only astronomical
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

# Models used in this script: a small one answers, a stronger one judges
LLM_MODEL = "gpt-5.4-mini"
JUDGE_MODEL = "gpt-5.4"


# Utility functions
def evaluate_response_time_and_accuracy(chunk_size, eval_questions, eval_documents, faithfulness_evaluator,
                                        relevancy_evaluator):
    """
    Evaluate the average response time, faithfulness, and relevancy of responses generated by LLM_MODEL for a given chunk size.

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

    # Set the global LLM to the small answering model
    llm = OpenAI(model=LLM_MODEL)
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
        # Use the stronger judge model for evaluation
        self.llm_gpt4 = OpenAI(model=JUDGE_MODEL)
        self.faithfulness_evaluator = self.create_faithfulness_evaluator()
        self.relevancy_evaluator = self.create_relevancy_evaluator()

    def load_documents(self):
        return SimpleDirectoryReader(self.data_dir).load_data()

    def generate_eval_questions(self):
        eval_documents = self.documents[0:20]
        # Name the question-writing model: LlamaIndex's default, gpt-3.5-turbo, was shut down on 2026-10-23
        data_generator = DatasetGenerator.from_documents(eval_documents, llm=OpenAI(model=LLM_MODEL))
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
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # repo root, for helper_functions and evaluation: set it before importing them
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
    relevant_chunks = retriever.invoke(query)
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
        baseline_chunk = self.retriever.invoke(query)
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
from langchain_classic.retrievers.document_compressors import LLMChainExtractor
from langchain_classic.retrievers import ContextualCompressionRetriever
from langchain_classic.chains import RetrievalQA
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # repo root, for helper_functions and evaluation: set it before importing them
from helper_functions import *
from evaluation.evalute_rag import *

# Add the parent directory to the path since we work with notebooks
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))

# Load environment variables from a .env file
load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"


class ContextualCompressionRAG:
    """
    A class to handle the process of creating a retrieval-based Question Answering system
    with a contextual compression retriever.
    """

    def __init__(self, path, model_name=LLM_MODEL, temperature=0, max_tokens=4000):
        """
        Initializes the ContextualCompressionRAG by setting up the document store and retriever.

        Args:
            path (str): Path to the PDF file to process.
            model_name (str): The name of the language model to use (default: gpt-5.4-mini).
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
    parser.add_argument("--model_name", type=str, default=LLM_MODEL,
                        help="Name of the language model to use (default: gpt-5.4-mini).")
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
from pydantic import BaseModel, Field
from langchain_community.tools import DuckDuckGoSearchResults
sys.path.append(os.path.abspath(os.path.join(os.getcwd(), '..')))  # repo root, for helper_functions and evaluation: set it before importing them
from helper_functions import encode_pdf
import json

sys.path.append(os.path.abspath(
    os.path.join(os.getcwd(), '..')))  # Add the parent directory to the path since we work with notebooks

# Load environment variables from a .env file
load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv('OPENAI_API_KEY')

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"


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

    def __init__(self, path, model=LLM_MODEL, max_tokens=1000, temperature=0, lower_threshold=0.3,
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
        self.search = DuckDuckGoSearchResults(output_format="json")  # parse_search_results reads JSON

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
    parser.add_argument("--model", type=str, default=LLM_MODEL,
                        help="Language model to use (default: gpt-5.4-mini).")
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

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"

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
    llm = ChatOpenAI(model=LLM_MODEL, temperature=0)
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
    llm = ChatOpenAI(model=LLM_MODEL, temperature=0)
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
    retrieved_docs = document_query_retriever.invoke(query)
    print(f"\nQuery: {query}")
    print(f"Retrieved document: {retrieved_docs[0].page_content}")

    # Further query example
    query = "How do freshwater ecosystems change due to alterations in climatic factors?"
    retrieved_documents = document_query_retriever.invoke(query)
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

# Chat model used in this script
LLM_MODEL = "gpt-5.4-mini"


# Define utility classes/functions
class ExplainableRetriever:
    def __init__(self, texts):
        self.embeddings = OpenAIEmbeddings()
        self.vectorstore = FAISS.from_texts(texts, self.embeddings)
        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)
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
        docs = self.retriever.invoke(query)
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #212** (2026-10-31): **Make notebooks and scripts import and run on LangChain 1.x and LlamaIndex 0.14**
  *Symptoms*: Second wave after #211. On a fresh install, 21 notebooks, 2 evaluation notebooks and 9 scripts failed at their import cell because they import paths LangChain 1.x removed, and most install cells did not list what the notebook imports. This PR fixes both, plus the follow-ups #211 left open.  ## What changed  **Imports (21 notebooks, 2 evaluation notebooks, 9 scripts).** Every import was checked in a fresh Python 3.11 venv with current releases (langchain-core 1.7.3, langchain-community 0.4.2, langchain-classic 1.0.8, langchain-openai 1.7.3, llama-index 0.14.25). - `langchain.text_splitter`, `.vectorstores`, `.embeddings`, `.prompts`, `.docstore`, `.schema`, `.document_loaders`, `.callbacks`, `.output_parsers`, `.tools`, `.chat_models` and `langchain_core.pydantic_v1` now import from `langchain_text_splitters`, `langchain_community`, `langchain_openai`, `langchain_core` or `pydantic`. - `langchain.chains` (RetrievalQA, create_retrieval_chain, load_summarize_chain), `langchain.retrievers` (ContextualCompressionRetriever, LLMChainExtractor) and `langchain.evaluation` now import from `langchain_classic`, where LangChain moved them. - fusion_retrieval_with_llamaindex: `llama_index.legacy` no longer exists; BM25 comes from `llama_index.retrievers.bm25`. - Calls that LangChain 1.x removed: custom retrievers (adaptive_retrieval, reranking) implement `_get_relevant_documents`; `get_relevant_documents()` calls became `invoke()`; `qa_chain(...)` became `qa_chain.invoke(...)`; raptor no l

- **Issue #211** (2026-10-31): **Fix the 31 Oct audit: retired models, HyPE syntax error, CI, footer links**
  *Symptoms*: Fixes the problems the 31 Oct audit found in this repo: retired model IDs, the HyPE syntax error, the broken CI set, and missing cross-links in the README footer.  ## What changed  **Models (56 files: 38 notebooks, 16 scripts, evaluation/evalute_rag.py, tests/conftest.py).** OpenAI shut down gpt-3.5-turbo, gpt-4 and gpt-4-turbo on 2026-10-23, and shuts down gpt-4o, gpt-4o-mini, gpt-4.1 and gpt-4.1-mini on 2027-01-14. - OpenAI chat calls now use `gpt-5.4-mini`, set once per notebook or script (`LLM_MODEL`, or the constant the notebook already had), so the next shutdown is a one-line change. Where a lesson pairs a small generator with a stronger judge (choose_chunk_size, GroUSE, end-to-end evaluation), the judge is `gpt-5.4`. - Raw OpenAI client calls send `max_completion_tokens` instead of `max_tokens`, which GPT-5.x rejects (contextual_chunk_headers, memorag). - Two notebooks silently used LlamaIndex's default LLM, gpt-3.5-turbo, so they had been failing since 23 Oct: simple_rag_with_llamaindex and the question generation in choose_chunk_size. Both now name their model. - GroUSE's default judge is gpt-4, so the notebook now passes a model explicitly. - `evaluation/evalute_rag.py`, the shared judge that simple_rag, HyPE and memorag call, used gpt-4-turbo for `evaluate_rag` and its three deepeval metrics. They now use one `EVAL_MODEL = "gpt-5.4"`, and `evaluate_rag` retrieves with `invoke()` (LangChain 1.x removed `get_relevant_documents()`). The judge no longer passes `tempera

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

### Incident Patch 1: `aa49b841` (2026-10-31)
**Commit Message**: Fix the 31 Oct audit: retired models, HyPE syntax error, CI, footer links (#211)

* Fix the SyntaxError in the HyPE notebook's vector store cell

A missing comma after faiss.IndexFlatL2(...) in the FAISS(...) call stopped
the notebook from parsing.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* CI: replace the never-triggered requirements test with a notebook parse check

github-test.yml only ran when a root requirements.txt changed, and that file
was removed in 97b19f9, so it could never fire. notebook-smoke.yml runs on
every push and pull request: it compiles each notebook's code cells in order
(IPython magics and shell lines converted the way Jupyter sees them) and
byte-compiles every .py file. No API keys and no execution.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* Move retired and retiring model IDs to current ones

OpenAI shut down gpt-3.5-turbo, gpt-4 and gpt-4-turbo on 2026-10-23 and
shuts down gpt-4o, gpt-4o-mini, gpt-4.1 and gpt-4.1-mini on 2027-01-14.

- OpenAI chat calls now use gpt-5.4-mini, set once per notebook or script
  (LLM_MODEL, or the notebook's existing constant). Where a lesson pairs a
  small generator with a st

**File**: `.github/workflows/github-test.yml` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-name: GitHub PR Test
-
-on:
-  pull_request:
-    types: [opened, synchronize, reopened]
-    branches:
-      - main
-    paths:
-      - "requirements.txt"
-
-jobs:
-  test:
-    runs-on: ubuntu-latest
-
-    env:
-      OPENAI_API_KEY: "123"
-      
-    steps:
-      - name: Checkout code
-        uses: actions/checkout@v7
-
-      - name: Set up Python
-        uses: actions/setup-python@v7
-        with:
-          python-version: '3.12.6'
-          cache: 'pip'
-
-      - name: Install dependencies
-        run: |
-          python -m pip install --upgrade pip
-          pip install -r requirements.txt
-
-      - name: Run tests
-        run: |
-          pytest
\ No newline at end of file
```

**File**: `.github/workflows/notebook-smoke.yml` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+# Parse check for every notebook and script. It needs no API keys and runs no code:
+# each notebook's code cells are converted the way Jupyter sees them (IPython turns
+# %magics and !shell lines into plain Python), joined in order and compiled, and every
+# .py file is byte-compiled. A syntax error anywhere fails the check.
+name: Notebook smoke test
+
+on:
+  push:
+  pull_request:
+
+permissions:
+  contents: read
+
+jobs:
+  parse:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Checkout code
+        uses: actions/checkout@v7
+
+      - name: Set up Python
+        uses: actions/setup-python@v7
+        with:
+          python-version: "3.11"
+
+      - name: Install parser dependencies
+        run: python -m pip install --quiet nbformat ipython
+
+      - name: Parse every notebook and script
+        run: |
+          python - <<'EOF'
+          import ast
+          import pathlib
+          import py_compile
+          import sys
+          import warnings
+
+          import nbformat
+          from IPython.core.inputtransformer2 import TransformerManager
+
+          warnings.filterwarnings("ignore")
+          to_python = TransformerManager().transform_cell
+          failures = []
+
+          notebooks = sorted(p for p in pathlib.Path(".").rglob("*.ipynb") if ".git" not in p.parts)
+          for path in notebooks:
+              try:
+                  nb = nbformat.read(path, as_version=4)
+              except Exception as exc:
+                  failures.append(f"{path}: cannot load ({exc})")
+                  continue
+              cells = [to_python(c.source) for c in nb.cells if c.cell_type == "code"]
+              try:
+                  compile("\n\n".join(cells), str(path), "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
+              except SyntaxError as exc:
+                  failures.append(f"{path}: line {exc.lineno}: {exc.msg}")
+
+          scripts = sorted(p for p in pathlib.Path(".").rglob("*.py") if ".git" not in p.parts)
+          for path in scripts:
+              try:
+                  py_compile.compile(str(path), doraise=True)
+              except py_compile.PyCompileError as exc:
+                  failures.append(f"{path}: {exc.msg}")
+
+          print(f"Checked {len(notebooks)} notebooks and {len(scripts)} scripts.")
+          if failures:
+              print("\n".join(failures))
+              sys.exit(1)
+          print("Everything parses.")
+          EOF
```

**File**: `README.md` (modified, +8/-2)
```diff
@@ -533,7 +533,7 @@ Explore our extensive list of cutting-edge RAG techniques:
     Evaluate the final stage of Retrieval-Augmented Generation using metrics of the GroUSE framework and meta-evaluate your custom LLM judge on GroUSE unit tests.
 
     #### Implementation 🛠️
-    Use the `grouse` package to evaluate contextually-grounded LLM generations with GPT-4 on the 6 metrics of the GroUSE framework and use unit tests to evaluate a custom Llama 3.1 405B evaluator.
+    Use the `grouse` package to evaluate contextually-grounded LLM generations with an OpenAI judge (gpt-5.4) on the 6 metrics of the GroUSE framework and use unit tests to evaluate a custom, cheaper gpt-5.4-mini evaluator.
     
 
 27. **End-to-End RAG Evaluation**: [<img src="https://img.shields.io/badge/GitHub-View-blue" height="20">](https://github.com/NirDiamant/RAG_TECHNIQUES/blob/main/evaluation/end-2-end_rag_evaluation.ipynb) [<img src="https://colab.research.google.com/assets/colab-badge.svg" height="20">](https://colab.research.google.com/github/NirDiamant/RAG_Techniques/blob/main/evaluation/end-2-end_rag_evaluation.ipynb) | Complete evaluation pipeline |
@@ -706,14 +706,20 @@ To begin implementing these advanced RAG techniques in your projects:
 
 > 🌟 **Support This Project:** Your sponsorship fuels innovation in RAG technologies. **[Become a sponsor](https://www.diamant-ai.com/sponsorship)** to help maintain and expand this valuable resource!
 
-## 📚 More from the same author
+## 📚 More from DiamantAI
+
+**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=footer-book-rag&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0GWDH8JJL%3Fmaas%3Dmaas_adg_api_580351185840460851_static_9_573%26ref_%3Daa_maas%26tag%3Dmaas%26aa_campaignid%3Drag-en%26aa_adgroupid%3Dgithub-readme%26aa_creativeid%3Drag-book-footer-rag&retarget=0&text=footer-book-rag)** - the companion book to this repo, featured at the top.
 
 **[Agent Memory Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=book-footer-am&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0HCRMGHCM%3Fmaas%3Dmaas_adg_api_580351185840460851_static_9_573%26ref_%3Daa_maas%26tag%3Dmaas%26aa_campaignid%3Dam-en%26aa_adgroupid%3Dgithub-readme%26aa_creativeid%3Drag-book-footer-am&retarget=0&text=book-footer-am)** - the visual guide to memory for AI agents: buffers, vector and graph memory, cognitive architectures and the frameworks in production.
 
 **[Prompt Engineering: Master the Art of AI Interaction](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=book-footer-pe&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0DZ85RPB5%3Ftag%3Ddiamantai-ragrm-20&retarget=0&text=book-footer-pe)** - the prompting foundation that makes RAG work better. Same visual approach, 22 hands-on techniques.
 
 **[AI Agents Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=book-footer-agents&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0HNXRSRH2%3Fmaas%3Dmaas_adg_api_580351185840460851_static_9_573%26ref_%3Daa_maas%26tag%3Dmaas%26aa_campaignid%3Dagents-en%26aa_adgroupid%3Dgithub-readme%26aa_creativeid%3Drag-book-footer-agents&retarget=0&text=book-footer-agents)** - the decision guide to building agents that work: 28 chapters on what each pattern does, what breaks, what it costs, and when it is overkill. No code.
 
+**Other repos:** [GenAI Agents](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=footer-genai-agents&target=https%3A%2F%2Fgithub.com%2FNirDiamant%2FGenAI_Agents&retarget=0&text=footer-genai-agents) · [Agents Towards Production](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=footer-atp&target=https%3A%2F%2Fgithub.com%2FNirDiamant%2Fagents-towards-production&retarget=0&text=footer-atp) · [Prompt Engineering](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=footer-prompt-engineering&target=https%3A%2F%2Fgithub.com%2FNirDiamant%2FPrompt_Engineering&retarget=0&text=footer-prompt-engineering) · [Agent Memory Techniques](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=footer-agent-memory&target=https%3A%2F%2Fgithub.com%2FNirDiamant%2FAgent_Memory_Techniques&retarget=0&text=footer-agent-memory)
+
+**Follow along:** [Newsletter](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=main-readme&click=footer-newsletter&target=https%3A%2F%2Fnewsletter.diamant-ai.com&retarget=0&text=footer-newsletter) · [YouTube](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?no
```

**File**: `all_rag_techniques/HyDe_Hypothetical_Document_Embedding.ipynb` (modified, +7/-4)
```diff
@@ -30,7 +30,7 @@
     "\n",
     "### Hypothetical Document Generation\n",
     "\n",
-    "1. A language model (GPT-4) is used to generate a hypothetical document that answers the given query.\n",
+    "1. A language model (gpt-5.4-mini) is used to generate a hypothetical document that answers the given query.\n",
     "2. The generation is guided by a prompt template that ensures the hypothetical document is detailed and matches the chunk size used in the vector store.\n",
     "\n",
     "### Retrieval Process\n",
@@ -45,7 +45,7 @@
     "\n",
     "1. Query Expansion: Transforms short queries into detailed hypothetical documents.\n",
     "2. Flexible Configuration: Allows adjustment of chunk size, overlap, and number of retrieved documents.\n",
-    "3. Integration with OpenAI Models: Uses GPT-4 for hypothetical document generation and OpenAI embeddings for vector representation.\n",
+    "3. Integration with OpenAI Models: Uses gpt-5.4-mini for hypothetical document generation and OpenAI embeddings for vector representation.\n",
     "\n",
     "## Benefits of this Approach\n",
     "\n",
@@ -146,7 +146,10 @@
     "load_dotenv()\n",
     "\n",
     "# Set the OpenAI API key environment variable\n",
-    "os.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')"
+    "os.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')\n",
+    "\n",
+    "# Chat model used in this notebook\n",
+    "LLM_MODEL = \"gpt-5.4-mini\""
    ]
   },
   {
@@ -195,7 +198,7 @@
    "source": [
     "class HyDERetriever:\n",
     "    def __init__(self, files_path, chunk_size=500, chunk_overlap=100):\n",
-    "        self.llm = ChatOpenAI(temperature=0, model_name=\"gpt-4o-mini\", max_tokens=4000)\n",
+    "        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)\n",
     "\n",
     "        self.embeddings = OpenAIEmbeddings()\n",
     "        self.chunk_size = chunk_size\n",
```

**File**: `all_rag_techniques/HyPE_Hypothetical_Prompt_Embeddings.ipynb` (modified, +3/-3)
```diff
@@ -178,7 +178,7 @@
    "outputs": [],
    "source": [
     "PATH = \"data/Understanding_Climate_Change.pdf\"\n",
-    "LANGUAGE_MODEL_NAME = \"gpt-4o-mini\"\n",
+    "LANGUAGE_MODEL_NAME = \"gpt-5.4-mini\"\n",
     "EMBEDDING_MODEL_NAME = \"text-embedding-3-small\"\n",
     "CHUNK_SIZE = 1000\n",
     "CHUNK_OVERLAP = 200"
@@ -232,7 +232,7 @@
     "\n",
     "    # parse questions from response\n",
     "    # Notes: \n",
-    "    # - gpt4o likes to split questions by \\n\\n so we remove one \\n\n",
+    "    # - the model often splits questions by \\n\\n so we remove one \\n\n",
     "    # - for production or if using smaller models from ollama, it's beneficial to use regex to parse \n",
     "    # things like (un)ordeed lists\n",
     "    # r\"^\\s*[\\-\\*\\\u2022]|\\s*\\d+\\.\\s*|\\s*[a-zA-Z]\\)\\s*|\\s*\\(\\d+\\)\\s*|\\s*\\([a-zA-Z]\\)\\s*|\\s*\\([ivxlcdm]+\\)\\s*\"\n",
@@ -295,7 +295,7 @@
     "            if vector_store == None:  \n",
     "                vector_store = FAISS(\n",
     "                    embedding_function=OpenAIEmbeddings(model=EMBEDDING_MODEL_NAME),  # Define embedding model\n",
-    "                    index=faiss.IndexFlatL2(len(vectors[0]))  # Define an L2 index for similarity search\n",
+    "                    index=faiss.IndexFlatL2(len(vectors[0])),  # Define an L2 index for similarity search\n",
     "                    docstore=InMemoryDocstore(),  # Use in-memory document storage\n",
     "                    index_to_docstore_id={}  # Maintain index-to-document mapping\n",
     "                )\n",
```

**File**: `all_rag_techniques/Microsoft_GraphRag.ipynb` (modified, +10/-4)
```diff
@@ -94,7 +94,7 @@
    "source": [
     "AZURE_OPENAI_API_KEY=\"\"\n",
     "AZURE_OPENAI_ENDPOINT=\"\"\n",
-    "GPT4O_MODEL_NAME=\"gpt-4o\"\n",
+    "CHAT_DEPLOYMENT_NAME=\"\"  # Azure: your chat deployment. Older .env files call it GPT4O_MODEL_NAME, which still works.\n",
     "TEXT_EMBEDDING_3_LARGE_DEPLOYMENT_NAME=\"\"\n",
     "AZURE_OPENAI_API_VERSION=\"2024-06-01\"\n",
     "\n",
@@ -159,11 +159,17 @@
     "load_dotenv()\n",
     "from openai import AzureOpenAI, OpenAI\n",
     "\n",
+    "# OpenAI chat model. On Azure, set this to the model behind your chat deployment.\n",
+    "LLM_MODEL = \"gpt-5.4-mini\"\n",
+    "\n",
     "AZURE=True #Change to False to use OpenAI\n",
     "if AZURE:\n",
     "    AZURE_OPENAI_API_KEY = os.getenv(\"AZURE_OPENAI_API_KEY\")\n",
     "    AZURE_OPENAI_ENDPOINT = os.getenv(\"AZURE_OPENAI_ENDPOINT\")\n",
-    "    GPT4O_DEPLOYMENT_NAME = os.getenv(\"GPT4O_MODEL_NAME\")\n",
+    "    # Your Azure chat deployment name. Older .env files call it GPT4O_MODEL_NAME, which still works.\n",
+    "    CHAT_DEPLOYMENT_NAME = os.getenv(\"CHAT_DEPLOYMENT_NAME\") or os.getenv(\"GPT4O_MODEL_NAME\")\n",
+    "    if not CHAT_DEPLOYMENT_NAME:\n",
+    "        raise ValueError(\"Set CHAT_DEPLOYMENT_NAME in your .env to the name of your Azure chat deployment.\")\n",
     "    TEXT_EMBEDDING_3_LARGE_NAME = os.getenv(\"TEXT_EMBEDDING_3_LARGE_DEPLOYMENT_NAME\")\n",
     "    AZURE_OPENAI_API_VERSION = os.getenv(\"AZURE_OPENAI_API_VERSION\")\n",
     "    oai = AzureOpenAI(azure_endpoint=AZURE_OPENAI_ENDPOINT, api_key=AZURE_OPENAI_API_KEY, api_version=AZURE_OPENAI_API_VERSION)\n",
@@ -224,15 +230,15 @@
     "\n",
     "with open('data/graphrag/settings.yaml', 'r') as f:\n",
     "    settings_yaml = yaml.load(f, Loader=yaml.FullLoader)\n",
-    "settings_yaml['llm']['model'] = \"gpt-4o\"\n",
+    "settings_yaml['llm']['model'] = LLM_MODEL\n",
     "settings_yaml['llm']['api_key'] = AZURE_OPENAI_API_KEY if AZURE else OPENAI_API_KEY\n",
     "settings_yaml['llm']['type'] = 'azure_openai_chat' if AZURE else 'openai_chat'\n",
     "settings_yaml['embeddings']['llm']['api_key'] = AZURE_OPENAI_API_KEY if AZURE else OPENAI_API_KEY\n",
     "settings_yaml['embeddings']['llm']['type'] = 'azure_openai_embedding' if AZURE else 'openai_embedding'\n",
     "settings_yaml['embeddings']['llm']['model'] = TEXT_EMBEDDING_3_LARGE_NAME if AZURE else 'text-embedding-3-large'\n",
     "if AZURE:\n",
     "    settings_yaml['llm']['api_version'] = AZURE_OPENAI_API_VERSION\n",
-    "    settings_yaml['llm']['deployment_name'] = GPT4O_DEPLOYMENT_NAME\n",
+    "    settings_yaml['llm']['deployment_name'] = CHAT_DEPLOYMENT_NAME\n",
     "    settings_yaml['llm']['api_base'] = AZURE_OPENAI_ENDPOINT\n",
     "    settings_yaml['embeddings']['llm']['api_version'] = AZURE_OPENAI_API_VERSION\n",
     "    settings_yaml['embeddings']['llm']['deployment_name'] = TEXT_EMBEDDING_3_LARGE_NAME\n",
```

**File**: `all_rag_techniques/adaptive_retrieval.ipynb` (modified, +8/-5)
```diff
@@ -164,7 +164,10 @@
     "load_dotenv()\n",
     "\n",
     "# Set the OpenAI API key environment variable\n",
-    "os.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')"
+    "os.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')\n",
+    "\n",
+    "# Chat model used in this notebook\n",
+    "LLM_MODEL = \"gpt-5.4-mini\""
    ]
   },
   {
@@ -186,7 +189,7 @@
     "\n",
     "class QueryClassifier:\n",
     "    def __init__(self):\n",
-    "        self.llm = ChatOpenAI(temperature=0, model_name=\"gpt-4o\", max_tokens=4000)\n",
+    "        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)\n",
     "        self.prompt = PromptTemplate(\n",
     "            input_variables=[\"query\"],\n",
     "            template=\"Classify the following query into one of these categories: Factual, Analytical, Opinion, or Contextual.\\nQuery: {query}\\nCategory:\"\n",
@@ -218,7 +221,7 @@
     "        text_splitter = CharacterTextSplitter(chunk_size=800, chunk_overlap=0)\n",
     "        self.documents = text_splitter.create_documents(texts)\n",
     "        self.db = FAISS.from_documents(self.documents, self.embeddings)\n",
-    "        self.llm = ChatOpenAI(temperature=0, model_name=\"gpt-4o\", max_tokens=4000)\n",
+    "        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)\n",
     "\n",
     "\n",
     "    def retrieve(self, query, k=4):\n",
@@ -303,7 +306,7 @@
     "            template=\"Generate {k} sub-questions for: {query}\"\n",
     "        )\n",
     "\n",
-    "        llm = ChatOpenAI(temperature=0, model_name=\"gpt-4o\", max_tokens=4000)\n",
+    "        llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)\n",
     "        sub_queries_chain = sub_queries_prompt | llm.with_structured_output(SubQueries)\n",
     "\n",
     "        input_data = {\"query\": query, \"k\": k}\n",
@@ -496,7 +499,7 @@
     "    def __init__(self, texts: List[str]):\n",
     "        adaptive_retriever = AdaptiveRetriever(texts)\n",
     "        self.retriever = PydanticAdaptiveRetriever(adaptive_retriever=adaptive_retriever)\n",
-    "        self.llm = ChatOpenAI(temperature=0, model_name=\"gpt-4o\", max_tokens=4000)\n",
+    "        self.llm = ChatOpenAI(temperature=0, model_name=LLM_MODEL, max_tokens=4000)\n",
     "        \n",
     "        # Create a custom prompt\n",
     "        prompt_template = \"\"\"Use the following pieces of context to answer the question at the end. \n",
```

**File**: `all_rag_techniques/choose_chunk_size.ipynb` (modified, +14/-9)
```diff
@@ -46,7 +46,11 @@
     "import time\n",
     "import os\n",
     "load_dotenv()\n",
-    "openai.api_key = os.getenv(\"OPENAI_API_KEY\")"
+    "openai.api_key = os.getenv(\"OPENAI_API_KEY\")\n",
+    "\n",
+    "# Models used in this notebook: a small one answers, a stronger one judges\n",
+    "LLM_MODEL = \"gpt-5.4-mini\"\n",
+    "JUDGE_MODEL = \"gpt-5.4\""
    ]
   },
   {
@@ -82,7 +86,8 @@
     "num_eval_questions = 25\n",
     "\n",
     "eval_documents = documents[0:20]\n",
-    "data_generator = DatasetGenerator.from_documents(eval_documents)\n",
+    "# Name the question-writing model: LlamaIndex's default, gpt-3.5-turbo, was shut down on 2026-10-23\n",
+    "data_generator = DatasetGenerator.from_documents(eval_documents, llm=OpenAI(model=LLM_MODEL))\n",
     "eval_questions = data_generator.generate_questions_from_nodes()\n",
     "k_eval_questions = random.sample(eval_questions, num_eval_questions)"
    ]
@@ -100,13 +105,13 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "# We will use GPT-4 for evaluating the responses\n",
-    "gpt4 = OpenAI(temperature=0, model=\"gpt-4o\")\n",
+    "# We use the stronger model (JUDGE_MODEL) to evaluate the responses\n",
+    "gpt4 = OpenAI(temperature=0, model=JUDGE_MODEL)\n",
     "\n",
     "# Set appropriate settings for the LLM\n",
     "Settings.llm = gpt4\n",
     "\n",
-    "# Define Faithfulness Evaluators which are based on GPT-4\n",
+    "# Define Faithfulness Evaluators which are based on the judge model\n",
     "faithfulness_gpt4 = FaithfulnessEvaluator()\n",
     "\n",
     "faithfulness_new_prompt_template = PromptTemplate(\"\"\" Please tell if a given piece of information is directly supported by the context.\n",
@@ -137,7 +142,7 @@
     "\n",
     "faithfulness_gpt4.update_prompts({\"your_prompt_key\": faithfulness_new_prompt_template}) # Update the prompts dictionary with the new prompt template\n",
     "\n",
-    "# Define Relevancy Evaluators which are based on GPT-4\n",
+    "# Define Relevancy Evaluators which are based on the judge model\n",
     "relevancy_gpt4 = RelevancyEvaluator()"
    ]
   },
@@ -155,10 +160,10 @@
    "outputs": [],
    "source": [
     "# Define function to calculate average response time, average faithfulness and average relevancy metrics for given chunk size\n",
-    "# We use GPT-3.5-Turbo to generate response and GPT-4 to evaluate it.\n",
+    "# We use LLM_MODEL to generate responses and the stronger JUDGE_MODEL to evaluate them.\n",
     "def evaluate_response_time_and_accuracy(chunk_size, eval_questions):\n",
     "    \"\"\"\n",
-    "    Evaluate the average response time, faithfulness, and relevancy of responses generated by GPT-3.5-turbo for a given chunk size.\n",
+    "    Evaluate the average response time, faithfulness, and relevancy of responses generated by LLM_MODEL for a given chunk size.\n",
     "    \n",
     "    Parameters:\n",
     "    chunk_size (int): The size of data chunks being processed.\n",
@@ -172,7 +177,7 @@
     "    total_relevancy = 0\n",
     "\n",
     "    # create vector index\n",
-    "    llm = OpenAI(model=\"gpt-3.5-turbo\")\n",
+    "    llm = OpenAI(model=LLM_MODEL)\n",
     "\n",
     "    Settings.llm = llm\n",
     "    Settings.chunk_size = chunk_size\n",
```

#### Recent Merged Pull Requests:
- **PR #212** (2026-10-31): Make notebooks and scripts import and run on LangChain 1.x and LlamaIndex 0.14 (@NirDiamant)
- **PR #211** (2026-10-31): Fix the 31 Oct audit: retired models, HyPE syntax error, CI, footer links (@NirDiamant)
- **PR #210** (2026-10-20): Add Document Parsing with Mistral OCR 4 (sponsored by Mistral AI) (@NirDiamant)
- **PR #209** (2026-10-31): ci: fix invalid local-test workflow (missing runs-on) (@NirDiamant)
- **PR #208** (closed): Add Late Chunking notebook (@NirDiamant)
- **PR #207** (2026-10-11): Decode HTML entities in Qodo finding titles (@NirDiamant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
