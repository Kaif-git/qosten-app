import json

input_file = r'C:\Users\DFIT\Downloads\question-bank-full-2026-06-04.json'

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    types = {}
    for item in data:
        if item.get('subject') == 'বাংলা দ্বিতীয় পত্র':
            t = item.get('type')
            types[t] = types.get(t, 0) + 1

    print(f"Type distribution for 'বাংলা দ্বিতীয় পত্র': {types}")
except Exception as e:
    print(f'Error: {e}')
