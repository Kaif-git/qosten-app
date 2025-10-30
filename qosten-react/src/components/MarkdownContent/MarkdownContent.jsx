import React from 'react';
import LatexRenderer from '../LatexRenderer/LatexRenderer';

/**
 * Renders markdown content with bullet points and LaTeX formulas
 * Preserves indentation structure
 */
export default function MarkdownContent({ content }) {
  if (!content) return null;

  const renderTextWithFormatting = (text) => {
    if (!text) return null;
    
    // First, convert markdown to HTML tags
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    
    // Split by HTML tags and LaTeX delimiters
    const parts = [];
    let currentIndex = 0;
    const regex = /(<strong>|<\/strong>|<em>|<\/em>)|(\\\([^)]*\\\)|\\\[[^\]]*\\\])/g;
    let match;
    let openTags = [];

    while ((match = regex.exec(formatted)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const textContent = formatted.substring(currentIndex, match.index);
        parts.push({
          type: 'text',
          content: textContent,
          tags: [...openTags]
        });
      }

      // Check if it's an HTML tag or LaTeX
      if (match[1]) {
        // HTML tag
        const tag = match[1];
        if (tag.startsWith('</')) {
          const tagName = tag.slice(2, -1);
          openTags = openTags.filter(t => t !== tagName);
        } else {
          const tagName = tag.slice(1, -1);
          openTags.push(tagName);
        }
      } else if (match[2]) {
        // LaTeX formula
        parts.push({
          type: 'latex',
          content: match[2],
          tags: [...openTags]
        });
      }

      currentIndex = regex.lastIndex;
    }

    // Add remaining text
    if (currentIndex < formatted.length) {
      const textContent = formatted.substring(currentIndex);
      parts.push({
        type: 'text',
        content: textContent,
        tags: [...openTags]
      });
    }

    // Render parts
    return parts.map((part, index) => {
      let element;
      
      if (part.type === 'latex') {
        element = <LatexRenderer key={index} text={part.content} />;
      } else {
        element = <span key={index}>{part.content}</span>;
      }

      // Wrap with formatting tags
      if (part.tags.includes('strong')) {
        element = <strong key={`strong-${index}`}>{element}</strong>;
      }
      if (part.tags.includes('em')) {
        element = <em key={`em-${index}`}>{element}</em>;
      }

      return element;
    });
  };

  const lines = content.split('\n');
  const renderedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match bullet points with indentation
    const bulletMatch = line.match(/^(\s*)\*\s+(.+)$/);
    
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const text = bulletMatch[2];
      const level = Math.floor(indent / 4);
      
      renderedLines.push(
        <div
          key={i}
          style={{
            marginLeft: `${level * 20}px`,
            marginBottom: '8px',
            lineHeight: '1.7',
            display: 'flex',
            alignItems: 'flex-start'
          }}
        >
          <span style={{ 
            marginRight: '8px',
            minWidth: '8px',
            fontSize: level === 0 ? '16px' : '14px'
          }}>
            {level === 0 ? '•' : level === 1 ? '◦' : '▪'}
          </span>
          <span style={{ flex: 1 }}>
            {renderTextWithFormatting(text)}
          </span>
        </div>
      );
    }
  }

  return <div>{renderedLines}</div>;
}
