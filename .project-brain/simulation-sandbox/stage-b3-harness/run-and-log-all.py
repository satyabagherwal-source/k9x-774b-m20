import subprocess
import sys
import os
import time

harness_dir = os.path.dirname(os.path.abspath(__file__))
logs_dir = os.path.join(harness_dir, "actual-execution-logs")
stage_b2_fixtures = os.path.join(harness_dir, "..", "stage-b2-verification", "test-fixtures")
python_bin = sys.executable

os.makedirs(logs_dir, exist_ok=True)

tests = [
    {
        "name": "tokenizer-config",
        "script": os.path.join(stage_b2_fixtures, "test-source-tokenizer-config.py"),
        "log_file": os.path.join(logs_dir, "tokenizer-config-execution.log")
    },
    {
        "name": "binary-gguf-header",
        "script": os.path.join(stage_b2_fixtures, "test-source-binary-gguf-header.py"),
        "log_file": os.path.join(logs_dir, "binary-gguf-header-execution.log")
    },
    {
        "name": "ternary-lut",
        "script": os.path.join(stage_b2_fixtures, "test-reference-ternary-lut.py"),
        "log_file": os.path.join(logs_dir, "ternary-lut-execution.log")
    }
]

print(f"[RUNNER] Executing and logging remaining tests using Python: {python_bin}")

for t in tests:
    print(f"\n--- Running: {t['name']} ---")
    start = time.time()
    res = subprocess.run([python_bin, t['script']], capture_output=True, text=True)
    duration = time.time() - start
    
    log_content = f"=== {t['name'].upper()} EXECUTION LOG ===\n"
    log_content += f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
    log_content += f"Command: {python_bin} {t['script']}\n"
    log_content += f"Duration: {duration:.4f}s\n"
    log_content += f"Exit Code: {res.returncode}\n\n"
    log_content += "--- STDOUT ---\n"
    log_content += res.stdout
    log_content += "\n--- STDERR ---\n"
    log_content += res.stderr
    
    with open(t['log_file'], "w", encoding="utf-8") as f:
        f.write(log_content)
        
    print(f"Result: Exit {res.returncode} ({duration:.4f}s). Log saved to {t['log_file']}")
    assert res.returncode == 0, f"Test failed with exit {res.returncode}"

print("\n[RUNNER] All tests completed and logged successfully.")

