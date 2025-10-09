/**
 * Translates text using MyMemory Translation API (CORS-friendly, browser-compatible)
 * Free tier: 1000 words/day, no API key needed
 * @param {string} text - Text to translate
 * @param {string} from - Source language (default: 'en')
 * @param {string} to - Target language (default: 'bn' for Bangla)
 * @returns {Promise<string>} - Translated text
 */
const translateWithMyMemory = async (text, from, to) => {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.responseStatus === 200 && data.responseData) {
    return data.responseData.translatedText;
  }
  
  throw new Error('Translation failed');
};

/**
 * Translates English text to Bangla
 * @param {string} text - Text to translate (can be mixed Bangla-English)
 * @param {string} from - Source language (default: 'en')
 * @param {string} to - Target language (default: 'bn' for Bangla)
 * @returns {Promise<string>} - Translated text
 */
export const translateToBangla = async (text, from = 'en', to = 'bn') => {
  try {
    if (!text || text.trim() === '') {
      return text;
    }

    const result = await translateWithMyMemory(text, from, to);
    return result;
  } catch (error) {
    console.error('Translation error:', error);
    // Return original text if translation fails
    return text;
  }
};

/**
 * Detects English words in mixed Bangla-English text and translates them
 * @param {string} text - Mixed language text
 * @returns {Promise<string>} - Text with English words translated to Bangla
 */
export const translateEnglishWordsToBangla = async (text) => {
  try {
    if (!text || text.trim() === '') {
      return text;
    }

    // Regular expression to detect English words (Latin characters)
    const englishWordRegex = /[a-zA-Z]+(?:['-][a-zA-Z]+)*/g;
    const matches = text.match(englishWordRegex);

    if (!matches || matches.length === 0) {
      // No English words found, return original text
      return text;
    }

    // Create a map to store translations
    const translationMap = new Map();

    // Translate each unique English word
    const uniqueWords = [...new Set(matches)];
    for (const word of uniqueWords) {
      try {
        const result = await translateWithMyMemory(word, 'en', 'bn');
        translationMap.set(word, result);
      } catch (err) {
        // If translation fails, keep the original word
        translationMap.set(word, word);
      }
    }

    // Replace English words with their Bangla translations
    let translatedText = text;
    translationMap.forEach((banglaWord, englishWord) => {
      const regex = new RegExp(`\\b${englishWord}\\b`, 'gi');
      translatedText = translatedText.replace(regex, banglaWord);
    });

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
};

/**
 * Auto-detects language and translates entire text to Bangla
 * @param {string} text - Text to translate
 * @returns {Promise<string>} - Translated text in Bangla
 */
export const autoTranslateToBangla = async (text) => {
  try {
    if (!text || text.trim() === '') {
      return text;
    }

    const result = await translateWithMyMemory(text, 'auto', 'bn');
    return result;
  } catch (error) {
    console.error('Auto-translation error:', error);
    return text;
  }
};

export default translateToBangla;
