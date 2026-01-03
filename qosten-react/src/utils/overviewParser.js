/**
 * Parses chapter overview text in markdown format and converts to JSON structure
 * 
 * Supports English and Bengali formats with multiple topics and version headers.
 * 
 * Example Topic Formats:
 * T-01: Topic Title
 * টি-০১: শিরোনাম
 * ### T-01: Topic Title
 */

export function parseOverviewText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  // Split into lines
  const lines = text.split('\n');
  const result = {
    topics: []
  };
  
  let currentTopic = null;
  let currentContent = [];

  console.log('=== OVERVIEW PARSING START ===');
  
  // Clean up Unicode zero-width characters often found in pasted text
  const cleanLine = (l) => l.replace(/[​-\u200D\uFEFF]/g, '').trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = cleanLine(line);

    if (!trimmed) continue;

    // Detect Topic Header
    // Matches: T-01, T-০১, টি-০১, টি-01, T-01 & T-02 with optional ### prefix and ** bolding
    // Group 1: ID (e.g. T-01), Group 2: Title
    const topicMatch = trimmed.match(/^(?:[#\s*]*)((?:T|টি)-[০-৯\d]+(?:\s*&\s*(?:T|টি)-[০-৯\d]+)?)\s*[:：ঃ]\s*(.+)$/i);

    if (topicMatch) {
      // Save previous topic if it exists
      if (currentTopic) {
        currentTopic.content = currentContent.join('\n').trim();
        result.topics.push(currentTopic);
        console.log(`  Saved topic: ${currentTopic.id}`);
      }

      // Start new topic
      currentTopic = {
        id: topicMatch[1].trim(),
        title: topicMatch[2].replace(/\*+/g, '').trim().replace(/[:：ঃ]$/, ''), // Remove markdown and trailing colons
        content: ''
      };
      currentContent = [];
      console.log(`  Found new topic: ${currentTopic.id} - ${currentTopic.title}`);
      continue;
    }

    // Skip version headers or chapter titles if they are just decorative
    if (!currentTopic) {
        if (trimmed.toLowerCase().includes('version') || trimmed.includes('সংস্করণ') || trimmed.toLowerCase().includes('chapter')) {
            console.log(`  Skipping header line: ${trimmed}`);
            continue;
        }
    }

    // Collect content
    if (currentTopic) {
      currentContent.push(line); // Keep original line for better markdown formatting
    }
  }

  // Save last topic
  if (currentTopic) {
    currentTopic.content = currentContent.join('\n').trim();
    result.topics.push(currentTopic);
    console.log(`  Saved final topic: ${currentTopic.id}`);
  }

  console.log(`=== PARSING COMPLETE: ${result.topics.length} topics found ===`);
  return result;
}

/**
 * Validates the parsed overview structure
 */
export function validateOverview(overviewData) {
  if (!overviewData || !overviewData.topics) {
    return { valid: false, errors: ['Missing topics array'] };
  }

  const errors = [];

  if (overviewData.topics.length === 0) {
    errors.push('No topics found. Ensure topics start with "T-01:" or "টি-০১:"');
    return { valid: false, errors };
  }

  overviewData.topics.forEach((t, idx) => {
    if (!t.title) errors.push(`Topic ${t.id || idx} is missing a title`);
    if (!t.content) errors.push(`Topic ${t.title || t.id} has no content`);
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

export function overviewToJSON(data) {
  return JSON.stringify(data, null, 2);
}

export const EXAMPLE_FORMAT = `
English Version
T-01: Basic Concepts of Motion
Types of Motion: Linear, Rotational, Translational, Periodic, Oscillatory.
Distance vs. Displacement: Distance is scalar, Displacement is vector.

T-02: Equations of Motion
v = u + at
s = ut + 1/2at^2

বাংলা সংস্করণ
টি-০১: গতির মৌলিক ধারণা
গতির প্রকারভেদ: রৈখিক, ঘূর্ণন, সরণজনিত, পর্যায়বৃত্ত।
দূরত্ব বনাম সরণ: দূরত্ব স্কেলার, সরণ ভেক্টর।
`;
