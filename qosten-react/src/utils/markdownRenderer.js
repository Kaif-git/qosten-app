import { marked } from 'marked';
import katex from 'katex';

marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdownHTML(mdText) {
  if (!mdText) return '';

  // 1. Convert markdown to HTML (marked preserves raw HTML tags)
  let html = marked.parse(mdText);

  // 2. Render LaTeX block math $$...$$ or \[...\]
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="latex-error">${math}</span>`;
    }
  });
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="latex-error">${math}</span>`;
    }
  });

  // 3. Render LaTeX inline math $...$ or \(...\)
  html = html.replace(/\$([^$\n]*?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="latex-error">${math}</span>`;
    }
  });
  html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="latex-error">${math}</span>`;
    }
  });

  return html;
}
