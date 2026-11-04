import subprocess
import sys
import tempfile
import os
import time

BLOCKED_PATTERNS = [
    "import os",
    "import sys",
    "shutil.rmtree",
    "subprocess.",
    "socket.",
    "urllib.",
    "requests.",
    "open(",
]

def execute_sandboxed_code(code: str) -> dict:
    # 1. Static security check
    for pattern in BLOCKED_PATTERNS:
        if pattern in code:
            return {
                "status": "failed",
                "stdout": "",
                "stderr": f"Execution halted: Disallowed pattern '{pattern}' detected for security.",
                "latency_ms": 0.0
            }

    # 2. Write code to a temporary file
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(code)
        temp_file = f.name

    start_time = time.time()
    try:
        # Run with strict 15-second timeout
        result = subprocess.run(
            [sys.executable, temp_file],
            capture_output=True,
            text=True,
            timeout=15.0
        )
        duration_ms = round((time.time() - start_time) * 1000, 2)
        
        return {
            "status": "passed" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "latency_ms": duration_ms
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": "Execution timed out after 15 seconds.",
            "latency_ms": 15000.0
        }
    except Exception as e:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": str(e),
            "latency_ms": 0.0
        }
    finally:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except Exception:
                pass