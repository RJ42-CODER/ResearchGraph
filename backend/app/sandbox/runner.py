import subprocess
import sys
import tempfile
import os

def execute_sandboxed_code(code_string: str, timeout_seconds: int = 15) -> dict:
    """Executes Python benchmark code in an isolated process with strict time caps."""
    with tempfile.NamedTemporaryFile(suffix=".py", delete=False, mode="w", encoding="utf-8") as temp_file:
        temp_file.write(code_string)
        temp_path = temp_file.name

    try:
        result = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
        return {
            "status": "success" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": f"Execution timed out after {timeout_seconds}s.",
            "returncode": -1
        }
    except Exception as e:
        return {
            "status": "failed",
            "stdout": "",
            "stderr": str(e),
            "returncode": -1
        }
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)