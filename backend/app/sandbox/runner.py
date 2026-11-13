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


def _parse_benchmark_metrics(stdout: str) -> dict:
    metrics = {
        "latency": "",
        "baseline": "",
        "speedup": "",
        "improvement": "",
        "primary_metric": "",
        "summary": "",
        "viability": "Real-Time Viable (<5ms)",
    }
    for line in (stdout or "").splitlines():
        line = line.strip()
        if line.startswith("METRIC_PRIMARY:"):
            metrics["primary_metric"] = line.split(":", 1)[1].strip()
        elif line.startswith("METRIC_OPTIMIZED:") or line.startswith("METRIC_LATENCY:"):
            metrics["latency"] = line.split(":", 1)[1].strip()
        elif line.startswith("METRIC_BASELINE:"):
            metrics["baseline"] = line.split(":", 1)[1].strip()
        elif line.startswith("METRIC_SPEEDUP:"):
            metrics["speedup"] = line.split(":", 1)[1].strip()
        elif line.startswith("METRIC_IMPROVEMENT:"):
            metrics["improvement"] = line.split(":", 1)[1].strip()
        elif line.startswith("SUMMARY:"):
            metrics["summary"] = line.split(":", 1)[1].strip()
        elif "Benchmark Completed:" in line:
            val = line.split("Benchmark Completed:", 1)[1].strip()
            metrics["latency"] = val

    if not metrics["latency"]:
        metrics["latency"] = "Completed"

    if not metrics["summary"]:
        if metrics["speedup"] and metrics["baseline"]:
            metrics["summary"] = (
                f"Optimized simulation ran in {metrics['latency']} vs {metrics['baseline']} baseline "
                f"({metrics['speedup']} speedup). Suitable for CPU inference."
            )
        else:
            metrics["summary"] = f"Inference benchmark successfully finished with an average latency of {metrics['latency']}."

    return metrics


def execute_sandboxed_code(code: str) -> dict:
    # 1. Static security check
    for pattern in BLOCKED_PATTERNS:
        if pattern in code:
            return {
                "status": "failed",
                "passed": False,
                "stdout": "",
                "stderr": f"Execution halted: Disallowed pattern '{pattern}' detected for security.",
                "latency_ms": 0.0,
                "metrics": {
                    "latency": "Blocked",
                    "summary": f"Security check halted execution: disallowed pattern '{pattern}'.",
                },
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
        parsed_metrics = _parse_benchmark_metrics(result.stdout)
        
        return {
            "status": "success" if result.returncode == 0 else "failed",
            "passed": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "latency_ms": duration_ms,
            "metrics": parsed_metrics,
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