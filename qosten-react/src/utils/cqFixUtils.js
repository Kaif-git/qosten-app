
/**
 * Detects and fixes corrupted CQ (Creative Question) text.
 * 
 * The corruption pattern identified is the presence of sub-questions and answers
 * dumped into the main stimulus/question text, often delimited by pipes like "|a:", "|b:".
 * 
 * Example of corruption: 
 * "Stimulus text... [2]|a:'Question A' (1):'Answer A' [2]|b:..."
 * 
 * @param {Object} question - The question object.
 * @returns {Object|null} - The fixed question object if corruption was found and fixed, otherwise null.
 */
export const detectAndFixCQ = (question) => {
    if (question.type !== 'cq') return null;

    // Identify the field holding the text. In CQs, it's usually 'stimulus' or 'question'/'questionText'.
    const originalText = question.stimulus || question.question || question.questionText;

    if (!originalText) return null;

    // Pattern to find the start of the corruption.
    // We look for the first occurrence of "|a:" or "|b:" or "|c:" or "|d:".
    // Also handling potential preceding marks like "[2]|a:".
    const corruptionMatch = originalText.match(/\|[a-d]:/i);

    if (corruptionMatch) {
        const cutIndex = corruptionMatch.index;
        
        // Extract the clean text part
        let fixedText = originalText.substring(0, cutIndex);
        
        // Cleanup: The corruption often leaves trailing marks from the *previous* part 
        // or leading marks of the *next* part attached to the end of the text.
        // E.g. "...end of story.' [2]" where [2] is the marks for the next question.
        // We remove trailing sequence that looks like marks [num] or (num).
        fixedText = fixedText.replace(/\s*[[(][\d\u09E6-\u09EF]+[\])]\s*$/, '');
        
        fixedText = fixedText.trim();

        // Safety check: Don't return if we somehow wiped everything (unlikely unless text started with corruption)
        if (fixedText.length === 0 && originalText.length > 0) {
             // Maybe the whole thing was just the dump? If so, we can't really "fix" the stimulus by removing it.
             // But usually there is a stimulus.
             return null;
        }

        // Only return if we actually changed something
        if (fixedText.length < originalText.length) {
            // Construct fixed question
            // We update all potential text fields to keep them in sync
            return {
                ...question,
                stimulus: fixedText,
                question: fixedText, 
                questionText: fixedText
            };
        }
    }

    return null;
};
