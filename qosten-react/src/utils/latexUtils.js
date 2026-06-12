export const BOARD_MAP = {
  'Dhaka': 'ঢাকা',
  'Cumilla': 'কুমিল্লা',
  'Rajshahi': 'রাজশাহী',
  'Chattogram': 'চট্টগ্রাম',
  'Sylhet': 'সিলেট',
  'Barishal': 'বরিশাল',
  'Mymensingh': 'ময়মনসিংহ',
  'Dinajpur': 'দিনাজপুর',
  'Jashore': 'যশোর',
};

export const YEAR_MAP = {
  '2024': '২০২৪',
  '2023': '২০২৩',
  '2022': '২০২২',
  '2021': '২০২১',
  '2020': '২০২০',
  '2019': '২০১৯',
  '2018': '২০১৮',
  '2017': '২০১৭',
  '2016': '২০১৬',
};

export function areBoardsEquivalent(enBoard, bnBoard) {
  if (!enBoard || !bnBoard) return false;
  
  const enBoardLower = enBoard.toLowerCase();
  const bnBoardLower = bnBoard.toLowerCase();

  // Check for exact match first
  if (enBoardLower === bnBoardLower) return true;

  // Check mapping
  for (const [en, bn] of Object.entries(BOARD_MAP)) {
    if (enBoardLower.includes(en.toLowerCase()) && bnBoardLower.includes(bn)) {
      // Also check if the year matches if present
      const enYearMatch = enBoard.match(/\d{4}/);
      const bnYearMatch = bnBoard.match(/\u09E6-\u09F9{4}/); // Bengali digits 0-9
      
      if (enYearMatch && bnYearMatch) {
        const enYear = enYearMatch[0];
        const bnYear = bnYearMatch[0];
        if (YEAR_MAP[enYear] === bnYear) return true;
      } else if (!enYearMatch && !bnYearMatch) {
        return true; // No years to compare, but board name matches
      }
    }
  }
  return false;
}

export function normalizeLatexDelimiters(text) {
  if (!text) return text;
  return text
    .replace(/(\\+)\\\(/g, '\\(')
    .replace(/(\\+)\\\[/g, '\\[')
    .replace(/(\\+)\$\$/g, '$$')
    .replace(/(\\+)\$/g, '$')
    .replace(/(\\+)\\\)/g, '\\)')
    .replace(/(\\+)\\\]/g, '\\]');
}

export function autoWrapLatex(text) {
  if (!text) return text;
  if (/\\\(/.test(text) || /\\\[/.test(text) || /\$\$/.test(text) || /\$[^$]*\$/.test(text)) return text;
  if (!/\\[a-zA-Z{}()\[\]\\]/.test(text)) return text;

  const out = [];
  let i = 0;
  while (i < text.length) {
    // Skip non-math characters (Bengali, other scripts, etc.)
    if (/[\u0980-\u09FF]/.test(text[i]) || !/[\da-zA-Z\s()+\-*/=<>,.;:'"{}^_\[\\\]]/.test(text[i])) {
      out.push(text[i]);
      i++;
      continue;
    }
    // Scan ahead through a region of math-allowed characters
    let j = i;
    let hasCommand = false;
    while (j < text.length) {
      // \text{...} can contain Bengali text; skip to its matching } as a unit
      if (text[j] === '\\' && j + 5 < text.length && text.slice(j, j + 6) === '\\text{' && text[j + 6] !== undefined) {
        let depth = 1;
        let k = j + 6;
        while (k < text.length && depth > 0) {
          if (text[k] === '{') depth++;
          else if (text[k] === '}') depth--;
          if (depth > 0) k++;
        }
        j = k + 1;
        hasCommand = true;
        continue;
      }
      if (/[\u0980-\u09FF]/.test(text[j])) break;
      if (text[j] === '\\' && j + 1 < text.length && (/[a-zA-Z]/.test(text[j + 1]) || text[j + 1] === '{' || text[j + 1] === '}' || text[j + 1] === '\\')) {
        hasCommand = true;
      }
      j++;
    }
    if (hasCommand) {
      const expr = text.slice(i, j).trim();
      if (expr) out.push(`\\(${expr}\\)`);
    } else {
      out.push(text.slice(i, j));
    }
    i = j;
  }
  return out.join('');
}
