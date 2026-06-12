import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const inputText = `
   [ID: Fuler_bibaho-MCQ-001]
   [Subject: বাংলা প্রথম পত্র]                                                                                                                                                       
   [Chapter: ফুলের বিবাহ]                                                                                                                                                          
   ১। ‘ফুলের বিবাহ’ গল্পের পাত্র কে ছিল?                                                                                                                                              
   a) মল্লিকা                                                                                                                                                                      
   b) স্থলপদ্ম
   c) রজনীগন্ধা                                                                                                                                                                    
   d) গোলাপ                                                                                                                                                                       
   Correct: d
   Explanation: গল্পের বর্ণনা অনুযায়ী, ভ্রমররাজ ঘটক হয়ে গোলাব বাবুর বাড়িতে খবর দেন এবং গোলাব বর হিসেবে বিবাহের প্রস্তুতি নেন।

   [ID: Fuler_bibaho-MCQ-002]
   [Subject: বাংলা প্রথম পত্র]
   [Chapter: ফুলের বিবাহ]
   ২। এ গল্পে কন্যাকুল বলতে কাদের বোঝানো হয়েছে?
   a) ভোমর
   b) বৃক্ষ
   c) গাছপালা
   d) ফুল
   Correct: d
   Explanation: এখানে কন্যাকুল বলতে মল্লিকা এবং তার সহোদরা ফুলদের বোঝানো হয়েছে।
`;

const parsed = parseMCQQuestions(inputText);
console.log(JSON.stringify(parsed, null, 2));
