
/**
 * Detects and fixes MCQs where options are merged into the question text.
 * Common patterns: ① 1 ② 2 ③ 3 ④ 4 or a) text b) text ...
 * 
 * @param {Object} question - The question object.
 * @returns {Object|null} - The fixed question object if corruption was found and fixed, otherwise null.
 */
export const detectAndFixMCQOptions = (question) => {
    if (question.type !== 'mcq') return null;

    const originalText = (question.questionText || question.question || '').toString();
    if (!originalText || originalText.length < 10) return null;

    let fixedText = originalText;
    let foundOptions = [];

    // Pattern 1: Circled numbers ①-⑳ (2460-2473), ❶-❿ (2776-277F), ⓫-⓴ (24EB-24F4)
    // Using explicit ranges to avoid "Range out of order" errors in character classes
    const circledPattern = /([①-⑳❶-❿⓫-⓴])\s*(.*?)(?=\s*[①-⑳❶-❿⓫-⓴]|\s*(?:Correct|সঠিক|Ans|Answer)|$)/gi;
    const circledMatches = [...originalText.matchAll(circledPattern)];

    if (circledMatches.length >= 2) {
        const firstMatchIndex = circledMatches[0].index;
        fixedText = originalText.substring(0, firstMatchIndex).trim();
        
        const labelMap = { 
            '①': 'a', '②': 'b', '③': 'c', '④': 'd', '⑤': 'e',
            '❶': 'a', '❷': 'b', '❸': 'c', '❹': 'd', '❺': 'e'
        };
        
        foundOptions = circledMatches.map(m => {
            const rawLabel = m[1];
            // Normalize to a-d if possible, else keep raw
            let label = labelMap[rawLabel] || rawLabel;
            return {
                label: label,
                text: m[2].trim()
            };
        });
    } 
    // Pattern 2: Standard a) b) c) d) or 1. 2. 3. 4. labels
    else {
        const alphaPattern = /(?:^|\s+)(?:\()?([a-dক-ঘ1-4১-৪])[).।]\s*(.*?)(?=\s+(?:\()?[a-dক-ঘ1-4১-৪][).।]\s*|\s*(?:Correct|সঠিক|Ans|Answer)|$)/gi;
        const alphaMatches = [...originalText.matchAll(alphaPattern)];
        
        if (alphaMatches.length >= 2) {
            const firstMatchIndex = alphaMatches[0].index;
            fixedText = originalText.substring(0, firstMatchIndex).trim();
            
            const labelMap = { 
                'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
                '১': 'a', '২': 'b', '৩': 'c', '৪': 'd',
                '1': 'a', '2': 'b', '3': 'c', '4': 'd'
            };
            
            foundOptions = alphaMatches.map(m => {
                const rawLabel = m[1].toLowerCase();
                return {
                    label: labelMap[rawLabel] || rawLabel,
                    text: m[2].trim()
                };
            });
        }
    }

    if (foundOptions.length >= 2) {
        console.log(`✅ [MCQFix] Detected fixable options for ID: ${question.id}`);
        
        // Remove common prefixes
        fixedText = fixedText
            .replace(/^Question:\s*/i, '')
            .replace(/^\(N\/A\)\s*/i, '')
            .replace(/^\(-\)\s*/i, '')
            .trim();

        const fixedQ = {
            ...question,
            questionText: fixedText,
            question: fixedText,
            options: foundOptions
        };

        // If the original text had a "Correct Answer: ②" part, try to extract it
        const ansMatch = originalText.match(/(?:Correct Answer|সঠিক উত্তর|Ans|Answer)\s*[:=ঃ]\s*([①-④❶-❹a-dক-ঘ1-4১-৪])/i);
        if (ansMatch) {
            let ansLabel = ansMatch[1].toLowerCase();
            const labelMap = { 
                '①': 'a', '②': 'b', '③': 'c', '④': 'd',
                '❶': 'a', '❷': 'b', '❸': 'c', '❹': 'd',
                'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
                '১': 'a', '২': 'b', '৩': 'c', '৪': 'd',
                '1': 'a', '2': 'b', '3': 'c', '4': 'd'
            };
            fixedQ.correctAnswer = labelMap[ansLabel] || ansLabel;
        }

        return fixedQ;
    }

    return null;
};
