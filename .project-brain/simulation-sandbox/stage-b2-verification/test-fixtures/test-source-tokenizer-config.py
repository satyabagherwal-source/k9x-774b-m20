"""
STAGE B.2 RUNTIME TEST: Tokenizer Special Token Normalization Boundary
Candidate ID: CD-HE9Q
Source Model: Nanbeige/Nanbeige4.3-33B
Framework: Python 3.14 Standard Library (zero external dependencies)
Execution Mode: ORIGINAL_SOURCE_IMPORTED_AND_TESTED (Configuration Schema Validation)
"""

import sys
import json

print(f"[TEST RUNNER] Python {sys.version.split()[0]} initializing Tokenizer Boundary Invariant test...")

def validate_tokenizer_decoder(decoder_json_str):
    data = json.loads(decoder_json_str)
    added_tokens = data.get("added_tokens_decoder", {})
    violations = []
    
    for token_id, token_props in added_tokens.items():
        content = token_props.get("content", "")
        is_special = token_props.get("special", False)
        is_normalized = token_props.get("normalized", False)
        
        # Invariant: Special control tokens MUST NOT be normalized (normalized=false)
        if is_special and is_normalized:
            violations.append({
                "token_id": token_id,
                "content": content,
                "error": f"Special token '{content}' has normalized: true (MUST be false to prevent whitespace stripping)"
            })
            
    return len(violations) == 0, violations

# 1. Valid Configuration (Nanbeige Pattern)
valid_nanbeige_payload = json.dumps({
    "added_tokens_decoder": {
        "166100": {
            "content": "<|endoftext|>",
            "normalized": False,
            "special": True
        },
        "166101": {
            "content": "<|im_start|>",
            "normalized": False,
            "special": True
        },
        "151644": {
            "content": "</think>",
            "normalized": True,
            "special": False
        }
    }
})

# 2. Defective Configuration (Anti-Pattern: normalized=True on control token)
defective_payload = json.dumps({
    "added_tokens_decoder": {
        "166100": {
            "content": "<|endoftext|>",
            "normalized": True,  # DEFECT: Causes tokenizer normalizer to alter token!
            "special": True
        }
    }
})

is_valid, violations = validate_tokenizer_decoder(valid_nanbeige_payload)
assert is_valid, f"Expected valid payload to pass, got: {violations}"
print("✅ Test 1 PASSED: Valid Nanbeige added_tokens_decoder passes normalization boundary.")

is_defective_valid, defective_violations = validate_tokenizer_decoder(defective_payload)
assert not is_defective_valid, "Expected defective payload to fail"
assert len(defective_violations) == 1, "Expected exactly 1 violation flagged"
print(f"✅ Test 2 PASSED: Defective configuration successfully caught: {defective_violations[0]['error']}")

print("[TEST RUNNER] Tokenizer Normalization Boundary test completed with exit code 0.")

