"""
Quick test of the new violation inference logic.
"""
import sys
sys.path.insert(0, '.')

from app.ai.pipeline import VideoPipeline

# Initialize pipeline
print("Initializing pipeline...")
pipeline = VideoPipeline()

# Test the new _is_violation method
test_classes = ['person', 'head', 'hands', 'foot', 'face', 'helmet', 'gloves', 'shoes', 'glasses']

print("\n=== Testing _is_violation logic ===")
for cls_name in test_classes:
    is_viol, vtype = pipeline._is_violation(cls_name)
    status = "✓ VIOLATION" if is_viol else "  (not violation)"
    print(f"  {cls_name:12} -> {status}: {vtype}")

print("\nIf head, hands, foot show as VIOLATION, the fix is working!")
