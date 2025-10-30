/**
 * Parses chapter overview text in markdown format and converts to JSON structure
 * 
 * Expected format:
 * ### T-01: Topic Title
 * *   **Point:** Description
 *     *   Subpoint 1
 *     *   Subpoint 2
 * 
 * Stores the raw markdown content as-is for each topic
 */

export function parseOverviewText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  const lines = text.split('\n');
  const topics = [];
  let currentTopic = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Topic header: ### T-01: Topic Title
    if (trimmed.startsWith('###')) {
      // Save previous topic if exists
      if (currentTopic && currentContent.length > 0) {
        currentTopic.content = currentContent.join('\n');
        topics.push(currentTopic);
        currentContent = [];
      }

      // Parse topic
      const topicMatch = trimmed.match(/^###\s+(T-\d+):\s+(.+)$/);
      if (topicMatch) {
        currentTopic = {
          id: topicMatch[1],
          title: topicMatch[2].trim(),
          content: ''
        };
      }
      continue;
    }

    // Add line to current topic content (if it's not empty)
    if (currentTopic && trimmed) {
      currentContent.push(line);
    }
  }

  // Save last topic
  if (currentTopic) {
    currentTopic.content = currentContent.join('\n');
    topics.push(currentTopic);
  }

  return { topics };
}

/**
 * Validates the parsed overview structure
 */
export function validateOverview(overviewData) {
  if (!overviewData || !overviewData.topics) {
    return { valid: false, errors: ['Missing topics array'] };
  }

  const errors = [];

  if (!Array.isArray(overviewData.topics)) {
    errors.push('Topics must be an array');
    return { valid: false, errors };
  }

  if (overviewData.topics.length === 0) {
    errors.push('At least one topic is required');
    return { valid: false, errors };
  }

  overviewData.topics.forEach((topic, topicIndex) => {
    if (!topic.id) {
      errors.push(`Topic at index ${topicIndex} is missing an ID`);
    }
    if (!topic.title) {
      errors.push(`Topic at index ${topicIndex} is missing a title`);
    }
    if (typeof topic.content !== 'string') {
      errors.push(`Topic at index ${topicIndex} has invalid content (must be a string)`);
    } else if (!topic.content.trim()) {
      errors.push(`Topic "${topic.title || topic.id}" has no content`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Converts parsed overview to formatted JSON string
 */
export function overviewToJSON(overviewData, pretty = true) {
  return JSON.stringify(overviewData, null, pretty ? 2 : 0);
}

/**
 * Example usage and format guide
 */
export const EXAMPLE_FORMAT = `### T-01: Work
*   **Definition:** Work is done when a force causes an object to move.
*   **Formula:** It is calculated as \\( W = F \\times s \\), where:
    *   \\( W \\) is Work
    *   \\( F \\) is the Force applied
    *   \\( s \\) is the Displacement in the direction of the force
*   **Unit:** The unit of work is the Joule (J).

### T-02: Energy
*   **Definition:** Energy is the ability to do work.
*   **Types:**
    *   Kinetic Energy
    *   Potential Energy`;
