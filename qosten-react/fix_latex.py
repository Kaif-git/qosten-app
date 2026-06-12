import re, sys, os

if len(sys.argv) < 2:
    print("Usage: python fix_latex.py <input_file> [output_file]")
    print("If output_file is omitted, appends _fixed before the extension.")
    sys.exit(1)

input_path = sys.argv[1]
if len(sys.argv) >= 3:
    output_path = sys.argv[2]
else:
    base, ext = os.path.splitext(input_path)
    output_path = f"{base}_fixed{ext}"

with open(input_path, "r", encoding="utf-8") as f:
    text = f.read()

# --- Pass 1: Fix backtick-wrapped content ---
# Find backtick sequences and replace with \( ... \)
# Handle balanced parentheses inside backticks

def find_matching_paren(s, start):
    """Find the matching close paren from position start (which is at '(')"""
    depth = 1
    i = start + 1
    while i < len(s) and depth > 0:
        if s[i] == '(':
            depth += 1
        elif s[i] == ')':
            depth -= 1
        i += 1
    if depth == 0:
        return i - 1
    return -1

def fix_backtick_content(match):
    content = match.group(1).strip()
    # Remove outer parentheses if they wrap the content
    if content.startswith('(') and content.endswith(')'):
        close = find_matching_paren(content, 0)
        if close == len(content) - 1:
            inner = content[1:-1].strip()
            return r"\( " + inner + r" \)"
    return r"\( " + content + r" \)"

# Match backtick-enclosed content (non-greedy, handles nested parens)
# Using [\s\S] to match any char including newlines
text = re.sub(r"`([\s\S]*?)`", fix_backtick_content, text)

# --- Pass 2: Fix $...$ math -> \( ... \) ---
text = re.sub(r"\$([^$]+)\$", lambda m: r"\( " + m.group(1).strip() + r" \)", text)

# --- Pass 3: Convert bare (...) math in sections that don't use \(...\) ---
def has_math_content(s):
    s = s.strip()
    if len(s) <= 1:
        return False
    if re.search(r'\\(?:frac|sqrt|log|ln|mathbb|text|Rightarrow|left|right|sum|infty|lim|to|ge|le|ne|times|cdot|circ|implies|because|therefore|partial|int|pi|theta|alpha|beta|gamma|delta|varepsilon|varphi|lambda|rho|sigma|omega|approx|equiv|propto|sim|setminus|cup|cap|subset|supset|emptyset)', s):
        return True
    if re.search(r'[\^_{}]', s):
        return True
    if '\\' in s:
        return True
    if '=' in s and len(s) > 3:
        return True
    if re.search(r'[<>]', s) and len(s) > 3:
        return True
    if re.search(r'\s[+\-*/]\s', s):
        return True
    if re.search(r'\b(?:sin|cos|tan|cot|sec|csc|log|ln|det|lim|sum|prod|int|deg|pi|infty|mathbb|Rightarrow|rightarrow|leftarrow)\b', s):
        return True
    if re.match(r'^[a-zA-Z০-৯১২৩৪৫৬৭৮৯]$', s):
        return False
    if re.match(r'^[ivxlcdm]+$', s, re.IGNORECASE):
        return False
    if re.match(r'^[কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ]+$', s):
        return False
    return True

def fix_bare_parens(line):
    result = []
    i = 0
    while i < len(line):
        if line[i] == '(' and (i == 0 or line[i-1] not in ('\\', '`')):
            close = find_matching_paren(line, i)
            if close != -1:
                inner = line[i+1:close]
                if has_math_content(inner):
                    result += r'\( ' + inner.strip() + r' \)'
                    i = close + 1
                    continue
        result.append(line[i])
        i += 1
    return ''.join(result)

lines = text.split('\n')
fixed_lines = []
for line in lines:
    if r'\(' in line:
        fixed_lines.append(line)
    else:
        fixed_lines.append(fix_bare_parens(line))

text = '\n'.join(fixed_lines)

# --- Pass 4: Clean up doubled \( \(  and  \) \) ---
text = re.sub(r'\\\(\s*\\\(\s*', r'\( ', text)
text = re.sub(r'\s*\\\)\s*\\\)', r' \)', text)

with open(output_path, "w", encoding="utf-8") as f:
    f.write(text)

print(f"Fixed LaTeX written to: {output_path}")
