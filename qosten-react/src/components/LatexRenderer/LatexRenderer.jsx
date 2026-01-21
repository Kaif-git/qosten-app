import React from 'react';
import 'katex/dist/katex.min.css';
import TeX from '@matejmazur/react-katex';
import './LatexRenderer.css';

/****
 * LatexRenderer: Safely renders inline and block LaTeX strings.
 * Usage:
 *   <LatexRenderer text="Euler: $e^{i\\pi}+1=0$" />
 *   <LatexRenderer text={"\\[ \\int_0^1 x^2 \\mathrm{d}x \\]"} />
 * Behavior:
 *   - Detects $...$ for inline and $$...$$ or \[...\] for block math.
 *   - Falls back to plain text if parsing fails.
 */
export default function LatexRenderer({ text, inline = false }) {
  if (!text) return null;

  // If caller forces inline/block explicitly, render directly
  if (inline) {
    return <TeX>{text}</TeX>;
  }

  // Heuristics: detect block markers $$...$$ or \[...\]
  const isBlock = /\$\$[\s\S]*\$\$/.test(text) || /\\\[[\s\S]*\\\]/.test(text);

  // Split content to render mixed text and formulas
  // Supports $...$, $$...$$, \(...\), and \[...\]
  const parts = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [token] = match;
    const start = match.index;
    if (start > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    parts.push({ type: 'tex', value: token });
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  // If no math tokens detected, render as plain text
  if (parts.length === 0 || parts.every(p => p.type === 'text')) {
    return <span>{text}</span>;
  }

  const renderPart = (part, idx) => {
    if (part.type === 'text') return <span key={idx}>{part.value}</span>;
    let content = part.value;
    let displayMode = false;
    if (content.startsWith('$$') && content.endsWith('$$')) {
      content = content.slice(2, -2);
      displayMode = true;
    } else if (content.startsWith('\\[') && content.endsWith('\\]')) {
      content = content.slice(2, -2);
      displayMode = true;
    } else if (content.startsWith('\\(') && content.endsWith('\\)')) {
      content = content.slice(2, -2);
      displayMode = false;
    } else if (content.startsWith('$') && content.endsWith('$')) {
      content = content.slice(1, -1);
      displayMode = false;
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