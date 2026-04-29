# Bengali MCQ Format Support - Implementation Summary

## Overview
Updated the MCQ question parser to accept Bengali (Bangla) format in addition to the existing English format, while maintaining full backward compatibility.

## Supported Format

### Your Bengali Format
```
*[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]*  
*[অধ্যায়: বাংলাদেশের স্বাধীনতা]*  
*[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি, সশস্ত্র সংগ্রাম ও সার্বভৌম বাংলাদেশের উদ্ভব]*  
*[বোর্ড: ডি.বি.-২৪]*  
*৩.* "অপারেশন সার্চলাইট"-এর মূল পরিকল্পনাকারী কে ছিলেন?  
ক) ইয়াহিয়া খান  
খ) আইয়ুব খান  
গ) রাও ফরমান আলী  
ঘ) জুলফিকার আলী ভুট্টো  
*সঠিক:* গ  
*ব্যাখ্যা:* মেজর জেনারেল রাও ফরমান আলী পাকিস্তান সেনাবাহিনীর একজন উচ্চপদস্থ কর্মকর্তা ছিলেন এবং তিনি ১৯৭১ সালের মুক্তিযুদ্ধ গণহত্যার মূল পরিকল্পনাকারী হিসেবে বিবেচিত হন।
```

## Field Name Mappings

### Bengali to English Field Names
- `বিষয়` → Subject
- `অধ্যায়` → Chapter
- `পাঠ` → Lesson
- `বোর্ড` → Board
- `সঠিক` → Correct
- `ব্যাখ্যা` → Explanation

### Bengali to English Option Letters
- `ক` → a
- `খ` → b
- `গ` → c
- `ঘ` → d

## Files Modified

### 1. `src/utils/mcqQuestionParser.js`
**Changes:**
- Updated all regex patterns to accept Bengali field names alongside English
- Modified patterns to accept 0, 1, or 2 asterisks (`*{0,2}`)
- Added Bengali option letter support (ক-ঘ) with automatic conversion to English (a-d)
- Updated documentation to include Bengali format examples
- Modified `getMCQQuestionExample()` to include Bengali example

**Key Features:**
- Accepts `Subject` OR `বিষয়` (and all other fields)
- Accepts `Correct` OR `সঠিক`
- Accepts `Explanation` OR `ব্যাখ্যা`
- Accepts `a)` OR `ক)` (and other option letters)
- Converts all Bengali letters to English internally for consistency

### 2. `src/components/ImportTabs/ImportTabs.jsx`
**Changes:**
- Updated example format for Bengali MCQ tab to match your exact format
- Modified `parseMCQQuestions()` function to handle Bengali field names
- Added `keyMap` object to map Bengali keys to English equivalents
- Updated all regex patterns for options, correct answers, and explanations
- Maintained backward compatibility with all existing formats

## Backward Compatibility

### All Previous Formats Still Work
1. **English with double asterisks:**
   ```
   **[Subject: Math]**
   **[Chapter: Algebra]**
   **1.** What is x?
   a) 1
   **Correct: a**
   **Explanation:** ...
   ```

2. **English with single asterisks:**
   ```
   *[Subject: Math]*
   *[Chapter: Algebra]*
   *1.* What is x?
   a) 1
   *Correct: a*
   *Explanation:* ...
   ```

3. **English without asterisks:**
   ```
   [Subject: Math]
   [Chapter: Algebra]
   1. What is x?
   a) 1
   Correct: a
   Explanation: ...
   ```

4. **Mixed formats also work** (e.g., English fields with Bengali fields in same document)

## How It Works

### Regex Pattern Explanation
- `\*{0,2}` - Matches 0, 1, or 2 asterisks
- `(Subject|বিষয়)` - Matches either English OR Bengali field name
- `[a-dক-ঘ]` - Matches either English (a-d) OR Bengali (ক-ঘ) option letters

### Conversion Logic
All Bengali input is automatically converted to English internally:
- Bengali field names → English field names (for storage)
- Bengali option letters (ক, খ, গ, ঘ) → English letters (a, b, c, d)
- This ensures consistency in the database

## Testing

### Test File Created
`test-bangla-mcq.js` - A simple test file to verify Bengali format parsing

### To Test Manually
1. Go to the Bangla MCQ Import tab
2. Paste your Bengali format questions
3. Click "Parse Questions"
4. Verify the preview shows correct data
5. Confirm to add to question bank

## Usage in Application

### Bangla MCQ Tab
The Bangla MCQ import tab (`ImportTabs` component with `type='mcq'` and `language='bn'`) now shows:
- Bengali format example
- Proper parsing of Bengali field names
- Support for Bengali option letters
- Full backward compatibility with previous formats

### MCQ Import Component
The main MCQ Import component uses the updated `parseMCQQuestions()` utility which automatically handles both English and Bengali formats.

## Example Questions

### Example 1 (From your input)
```
*[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]*  
*[অধ্যায়: বাংলাদেশের স্বাধীনতা]*  
*[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি, সশস্ত্র সংগ্রাম ও সার্বভৌম বাংলাদেশের উদ্ভব]*  
*[বোর্ড: ডি.বি.-২৪]*  
*৩.* "অপারেশন সার্চলাইট"-এর মূল পরিকল্পনাকারী কে ছিলেন?  
ক) ইয়াহিয়া খান  
খ) আইয়ুব খান  
গ) রাও ফরমান আলী  
ঘ) জুলফিকার আলী ভুট্টো  
*সঠিক:* গ  
*ব্যাখ্যা:* মেজর জেনারেল রাও ফরমান আলী...
```

### Example 2 (From your input)
```
*[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]*  
*[অধ্যায়: বাংলাদেশের স্বাধীনতা]*  
*[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি, সশস্ত্র সংগ্রাম ও সার্বভৌম বাংলাদেশের উদ্ভব]*  
*[বোর্ড: এম.বি.-২৪; বি.বি.-২৪]*  
*৪.* অস্থায়ী সরকারের অর্থমন্ত্রী কে ছিলেন?  
ক) তাজউদ্দীন আহমেদ  
খ) এ.এইচ.এম. কামারুজ্জামান  
গ) খন্দকার মোশতাক আহমেদ  
ঘ) এম. মনসুর আলী  
*সঠিক:* ঘ  
*ব্যাখ্যা:* মুজিবনগর সরকারে এম. মনসুর আলী অর্থমন্ত্রীর দায়িত্ব পালন করেন।
```

## Summary
✅ Bengali field names fully supported  
✅ Bengali option letters (ক-ঘ) supported  
✅ Backward compatibility maintained  
✅ Works with 0, 1, or 2 asterisks  
✅ Examples updated in UI  
✅ Parser documentation updated  
✅ Both parsers updated (utils and ImportTabs)  

Your Bengali MCQ format is now fully supported alongside all existing English formats!
