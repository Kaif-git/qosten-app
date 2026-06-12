import json

input_file = r'C:\Users\DFIT\Downloads\question-bank-full-2026-06-04.json'

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    bangla_2nd = [item for item in data if item.get('subject') == 'বাংলা দ্বিতীয় পত্র']
    total = len(bangla_2nd)
    filled = sum(1 for item in bangla_2nd if item.get('explanation') and item.get('explanation').strip())
    empty = total - filled

    print(f'Total "বাংলা দ্বিতীয় পত্র" questions: {total}')
    print(f'Filled explanations: {filled}')
    print(f'Empty explanations: {empty}')
    if total > 0:
        print(f'Fill rate: {(filled/total)*100:.2f}%')
except Exception as e:
    print(f'Error: {e}')
