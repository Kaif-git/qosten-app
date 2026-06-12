import json

input_file = r'C:\Users\DFIT\Downloads\question-bank-full-2026-06-04.json'
output_file = r'C:\Users\DFIT\Downloads\bangla_2nd_paper_questions.txt'

try:
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in data:
            if item.get('subject') == 'বাংলা দ্বিতীয় পত্র':
                count += 1
                f.write(f'Question {count}:\n')
                f.write(json.dumps(item, indent=2, ensure_ascii=False))
                f.write('\n' + '-'*50 + '\n')

    print(f'Successfully extracted {count} full records to {output_file}')
except Exception as e:
    print(f'Error: {e}')
