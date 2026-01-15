from ultralytics import YOLO
import json

model = YOLO('ppe_model.pt')

print("All model classes:")
for idx, name in model.names.items():
    print(f"  {idx}: {name}")

print("\nViolation-related classes:")
violation_keywords = ['no ', 'no_', 'without', 'missing']
for idx, name in model.names.items():
    name_lower = name.lower()
    for kw in violation_keywords:
        if kw in name_lower:
            print(f"  {idx}: {name} (contains '{kw}')")
            break
