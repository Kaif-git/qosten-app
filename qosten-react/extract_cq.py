import json

input_file = r"C:\Users\DFIT\Downloads\question-bank-full-2026-06-05.json"
output_file = "higher_math_cq.txt"
target_subject = "?????? ????"
target_type = "cq"

try:
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    filtered_data = [item for item in data if item.get("subject") == target_subject and item.get("type") == target_type]
    
    with open(output_file, "w", encoding="utf-8") as f:
        for item in filtered_data:
            f.write(json.dumps(item, ensure_ascii=False, indent=2) + "\n\n" + "-"*40 + "\n\n")
    
    print(f"Successfully extracted {len(filtered_data)} questions to {output_file}")

except Exception as e:
    print(f"Error: {e}")
