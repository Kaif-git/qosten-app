const metadataRegex = /^(?:\[)?(ID|Subject|Topic|Chapter|Lesson|Board|বিষয়|বিষয়|অধ্যায়|পাঠ|বোর্ড)[:ঃ]\s*([^\]\n]*?)(?:\])?$/i;

const headingRegex = /^(?:#(?:#|##)?\s*\*{0,2}|###|\*{2}|_{-2,})/;

const quizHeaderRegex = /^\*{0,2}.*?(?:কুইজ|Quiz|MCQ|CQ|SQ|Category|PRACTICE|EXERCISE|প্র্যাকটিস|অনুশীলনী|অধ্যায়|পর্ব).*?\*{0,2}$/i;

function extractMetadata(lines) {
  const meta = {};
  const cleanLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(metadataRegex);
    if (m) {
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      const keyMap = {
        subject: 'subject', topic: 'subject', বিষয়: 'subject', বিষয়: 'subject',
        chapter: 'chapter', অধ্যায়: 'chapter',
        lesson: 'lesson', পাঠ: 'lesson',
        board: 'board', বোর্ড: 'board',
      };
      if (keyMap[key]) meta[keyMap[key]] = value;
    } else {
      cleanLines.push(trimmed);
    }
  }
  return { meta, cleanLines };
}

function isHeadingLine(line) {
  if (headingRegex.test(line)) return true;
  if (quizHeaderRegex.test(line)) return true;
  if (/^[\d০-৯]+\.\s*(?:MCQ|CQ|SQ|Question|প্রশ্ন|সৃজনশীল)/i.test(line)) return true;
  return false;
}

function hasRealContent(lines) {
  for (const line of lines) {
    if (isHeadingLine(line)) continue;
    if (/^(?:Question|প্রশ্ন|Q\.?)\s*[\d০-৯টে]+/i.test(line)) return true;
    if (/^[\d০-৯]+[।.)]/.test(line)) return true;
    if (/^(?:answer|ans|উত্তর)\s*[:=ঃ]/i.test(line)) return true;
    if (line.length > 20) return true;
  }
  return false;
}

export function parseSQQuestions(text) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text.normalize('NFC').replace(/\u200b/g, '');

  const sections = cleaned.split(/\n-{3,}\n?/).filter(s => s.trim());
  const questions = [];

  for (const section of sections) {
    const lines = section.split('\n').filter(l => l.trim());
    if (lines.length === 0) continue;

    const { meta, cleanLines } = extractMetadata(lines);
    if (cleanLines.length === 0) continue;
    if (!hasRealContent(cleanLines)) continue;

    let current = null;
    const save = () => {
      if (current && current.question && current.question.trim()) {
        const qText = current.question.trim();
        const aText = current.answer.trim();
        if (qText && !isHeadingLine(qText) && !quizHeaderRegex.test(qText)) {
          questions.push({ ...meta, question: qText, answer: aText });
        }
      }
      current = null;
    };

    for (const line of cleanLines) {
      if (isHeadingLine(line)) continue;

      const headerMatch = line.match(/^(?:Question|প্রশ্ন|Q\.?)\s*[\d০-৯টে]+[:ঃ]?\s*(.*)/i);
      if (headerMatch) {
        save();
        current = { question: headerMatch[1], answer: '' };
        continue;
      }

      const digitMatch = line.match(/^[\d০-৯]+[।.)]\s*(.+)/);
      if (digitMatch && !current) {
        current = { question: digitMatch[1], answer: '' };
        const inlineAnswer = current.question.match(/(answer|ans|উত্তর)\s*[:=ঃ]\s*(.*)/i);
        if (inlineAnswer) {
          current.question = current.question.substring(0, inlineAnswer.index).trim();
          current.answer = inlineAnswer[2].trim();
        }
        continue;
      }

      const answerMatch = line.match(/^(?:answer|ans|উত্তর)\s*[:=ঃ]\s*(.*)/i);
      if (answerMatch) {
        if (!current) current = { question: '', answer: '' };
        if (current.answer && current.answer.trim()) {
          current.answer += '\n' + answerMatch[1];
        } else {
          current.answer = answerMatch[1];
        }
        continue;
      }

      if (!current) {
        current = { question: '', answer: '' };
      }
      if (current.answer && current.answer.trim()) {
        current.answer += '\n' + line;
      } else {
        current.question = (current.question ? current.question + '\n' : '') + line;
      }
    }
    save();
  }

  return questions;
}
