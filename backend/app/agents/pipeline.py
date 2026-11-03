import json
import re
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END
from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage

# Connect to local Ollama instance running on port 11434
llm = ChatOllama(
    base_url="http://localhost:11434",
    model="llama3.2:3b",
    temperature=0.1
)

class ResearchAgentState(TypedDict):
    paper_text: str
    hyperparameters: Optional[dict]
    generated_code: Optional[str]
    eval_status: Optional[str]

# 1. Paper Reader Agent: extracts model architecture parameters
def paper_reader_node(state: ResearchAgentState) -> dict:
    context = state.get("paper_text", "")[:3000]
    prompt = (
        "You are an expert ML research assistant. Extract the baseline model hyperparameters "
        "from the following text excerpt.\n"
        "Return strictly a raw JSON object with keys: 'model_name', 'd_model', 'heads', 'layers'.\n"
        "Do not include any explanation or markdown formatting.\n\n"
        f"Excerpt:\n{context}"
    )
    
    try:
        response = llm.invoke([
            SystemMessage(content="You output ONLY valid, parseable JSON."),
            HumanMessage(content=prompt)
        ])
        raw_text = response.content.strip()
        match = re.search(r"\{.*?\}", raw_text, re.DOTALL)
        if match:
            params = json.loads(match.group(0))
        else:
            params = {"model_name": "Transformer", "d_model": 512, "heads": 8, "layers": 6}
    except Exception as e:
        print(f"Reader fallback: {e}")
        params = {"model_name": "Transformer", "d_model": 512, "heads": 8, "layers": 6}

    return {"hyperparameters": params}

# 2. Code Synthesis Agent: generates a reproducible CPU benchmark script
def code_generator_node(state: ResearchAgentState) -> dict:
    params = state.get("hyperparameters", {})
    d_model = int(params.get("d_model", 512))
    heads = int(params.get("heads", 8))
    d_k = max(1, d_model // heads)

    prompt = (
        f"Write a standalone runnable Python script benchmarking Multi-Head Attention on CPU.\n"
        f"Model parameters: d_model={d_model}, heads={heads}, d_k={d_k}, seq_len=64, batch_size=1.\n\n"
        "Rules:\n"
        "1. Standard libraries only: `import time` and `import numpy as np`.\n"
        "2. IMPORTANT: NumPy does NOT have np.softmax. You MUST define a helper function:\n"
        "   def softmax(x):\n"
        "       e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))\n"
        "       return e_x / np.sum(e_x, axis=-1, keepdims=True)\n"
        "3. Tensor shapes: Q, K, V must be shaped (batch_size, heads, seq_len, d_k).\n"
        "4. Attention score calculation: np.matmul(Q, np.swapaxes(K, -1, -2)) / np.sqrt(d_k).\n"
        "5. Output calculation: np.matmul(softmax(scores), V).\n"
        "6. Time 10 iterations using time.time(), compute average latency in milliseconds, and print:\n"
        "   print(f'Benchmark Completed: {latency:.2f}ms latency')\n"
        "7. Output ONLY executable Python code. No explanations, no markdown ticks."
    )

    try:
        response = llm.invoke([
            SystemMessage(content="You generate valid, runnable NumPy benchmark scripts without markdown formatting. Never use np.softmax."),
            HumanMessage(content=prompt)
        ])
        code = response.content.replace("```python", "").replace("```", "").strip()
    except Exception as e:
        print(f"Coder fallback: {e}")
        code = (
            "import time\n"
            "import numpy as np\n\n"
            f"d_model = {d_model}\n"
            f"heads = {heads}\n"
            f"d_k = {d_k}\n"
            "seq_len = 64\n"
            "batch_size = 1\n\n"
            "def softmax(x):\n"
            "    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))\n"
            "    return e_x / np.sum(e_x, axis=-1, keepdims=True)\n\n"
            "Q = np.random.randn(batch_size, heads, seq_len, d_k)\n"
            "K = np.random.randn(batch_size, heads, seq_len, d_k)\n"
            "V = np.random.randn(batch_size, heads, seq_len, d_k)\n\n"
            "start = time.time()\n"
            "for _ in range(10):\n"
            "    scores = np.matmul(Q, np.swapaxes(K, -1, -2)) / np.sqrt(d_k)\n"
            "    weights = softmax(scores)\n"
            "    out = np.matmul(weights, V)\n"
            "latency = (time.time() - start) / 10 * 1000\n"
            "print(f'Benchmark Completed: {latency:.2f}ms latency')\n"
        )

    return {"generated_code": code}

# 3. Evaluator Agent: static safety inspection prior to execution
def evaluator_node(state: ResearchAgentState) -> dict:
    code = state.get("generated_code", "")
    unsafe_patterns = ["import os", "import sys", "subprocess", "shutil", "socket", "open("]
    
    for pattern in unsafe_patterns:
        if pattern in code:
            return {"eval_status": "flagged_safety_risk"}
            
    return {"eval_status": "ready_for_hitl"}

# Assemble LangGraph Workflow
workflow = StateGraph(ResearchAgentState)
workflow.add_node("reader", paper_reader_node)
workflow.add_node("coder", code_generator_node)
workflow.add_node("evaluator", evaluator_node)

workflow.set_entry_point("reader")
workflow.add_edge("reader", "coder")
workflow.add_edge("coder", "evaluator")
workflow.add_edge("evaluator", END)

research_graph_pipeline = workflow.compile()