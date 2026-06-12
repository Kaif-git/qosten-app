import React from 'react';
import 'katex/dist/katex.min.css';
import TeX from '@matejmazur/react-katex';
import { autoWrapLatex, normalizeLatexDelimiters } from '../../utils/latexUtils';
import './LatexRenderer.css';

/****
 * LatexRenderer: Safely renders inline and block LaTeX strings.
 * Usage:
 *   <LatexRenderer text="Euler: $e^{i\\pi}+1=0$" />
 *   <LatexRenderer text={"\\[ \\int_0^1 x^2 \\mathrm{d}x \\]"} />
 * Behavior:
 *   - Detects $...$ for inline and $$...$$ or \[...\] for block math.
 *   - Also auto-wraps bare LaTeX (no delimiters) containing \commands like \frac.
 *   - Falls back to plain text if parsing fails.
 */

// Auto-wrap bare LaTeX expressions that have \command patterns but no delimiters.
// Handles mixed Bengali/English text by only wrapping regions without Bengali chars.

export default function LatexRenderer({ text, inline = false }) {
  if (!text) return null;

  // Auto-wrap bare LaTeX before parsing
  let processed = autoWrapLatex(text);
  processed = normalizeLatexDelimiters(processed);

  // If caller forces inline/block explicitly, render directly
  if (inline) {
    return <TeX>{processed}</TeX>;
  }

  // Heuristics: detect block markers $$...$$ or \[...\]
  const isBlock = /\$\$[\s\S]*\$\$/.test(processed) || /\\\[[\s\S]*\\\]/.test(processed);

  // Tokenize into text and math segments
  // Uses balanced-pair matching for \(...\) and \[...\] to handle nesting
  const parts = [];
  let i = 0;
  let lastTextStart = 0;
  while (i < processed.length) {
    let matchLen = 0;
    // $$...$$ (block math)
    if (processed[i] === '$' && processed[i + 1] === '$') {
      const end = processed.indexOf('$$', i + 2);
      if (end >= 0) {
        matchLen = end + 2 - i;
      }
    }
    // $...$ (inline math, no nesting)
    if (matchLen === 0 && processed[i] === '$') {
      const end = processed.indexOf('$', i + 1);
      if (end >= 0 && processed[end + 1] !== '$') {
        matchLen = end + 1 - i;
      }
    }
    // \(...\) with balanced depth tracking
    if (matchLen === 0 && processed[i] === '\\' && processed[i + 1] === '(') {
      let depth = 1;
      let j = i + 2;
      while (j < processed.length - 1 && depth > 0) {
        if (processed[j] === '\\' && processed[j + 1] === '(') { depth++; j++; }
        else if (processed[j] === '\\' && processed[j + 1] === ')') { depth--; j++; }
        j++;
      }
      if (depth === 0) {
        matchLen = j - i;
      }
    }
    // \[...\] with balanced depth tracking
    if (matchLen === 0 && processed[i] === '\\' && processed[i + 1] === '[') {
      let depth = 1;
      let j = i + 2;
      while (j < processed.length - 1 && depth > 0) {
        if (processed[j] === '\\' && processed[j + 1] === '[') { depth++; j++; }
        else if (processed[j] === '\\' && processed[j + 1] === ']') { depth--; j++; }
        j++;
      }
      if (depth === 0) {
        matchLen = j - i;
      }
    }
    if (matchLen > 0) {
      if (i > lastTextStart) {
        parts.push({ type: 'text', value: processed.slice(lastTextStart, i) });
      }
      parts.push({ type: 'tex', value: processed.slice(i, i + matchLen) });
      i += matchLen;
      lastTextStart = i;
    } else {
      i++;
    }
  }
  if (lastTextStart < processed.length) {
    parts.push({ type: 'text', value: processed.slice(lastTextStart) });
  }

  // If no math tokens detected, render as plain text
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <span>{processed}</span>;
  }

  // Strip inner \( \) and \[ \] delimiters from content that is already
  // inside math mode (they are not valid inside math mode and cause KaTeX errors).
  const stripInnerDelimiters = (str) =>
    str.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\[/g, '[').replace(/\\\]/g, ']');

  const renderPart = (part, idx) => {
    if (part.type === 'text') return <span key={idx}>{part.value}</span>;
    let content = part.value;
    let displayMode = false;
    if (content.startsWith('$$') && content.endsWith('$$')) {
      content = content.slice(2, -2);
      displayMode = true;
      if (/\$[^$]*\$/.test(content)) {
        return <LatexRenderer text={content} />;
      }
      content = stripInnerDelimiters(content);
    } else if (content.startsWith('\\[') && content.endsWith('\\]')) {
      content = content.slice(2, -2);
      displayMode = true;
      if (/\$[^$]*\$/.test(content)) {
        return <LatexRenderer text={content} />;
      }
      content = stripInnerDelimiters(content);
    } else if (content.startsWith('\\(') && content.endsWith('\\)')) {
      content = content.slice(2, -2);
      displayMode = false;
      if (/\$[^$]*\$/.test(content)) {
        return <LatexRenderer text={content} />;
      }
      content = stripInnerDelimiters(content);
    } else if (content.startsWith('$') && content.endsWith('$')) {
      content = content.slice(1, -1);
      displayMode = false;
      content = stripInnerDelimiters(content);
    }
    try {
      return <TeX key={idx} math={content} block={displayMode} />;
    } catch (e) {
      // Fallback to text on parse errors
      console.error('LaTeX render error:', e, 'Content:', part.value);
      return <span key={idx}>{part.value}</span>;
    }
  };

  return (
    <span className={isBlock ? 'latex-block' : 'latex-inline'}>
      {parts.map(renderPart)}
    </span>
  );
}