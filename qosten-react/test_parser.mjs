
import { parseLessonText } from './src/utils/lessonParser.js';

const testContent = `বিষয়: বাংলাদেশ ও বিশ্বপরিচয়
অধ্যায়: বাংলাদেশের পারিবারিক কাঠামো ও সামাজিকীকরণ

### **বিষয়: বাংলাদেশের পারিবারিক কাঠামো ও সামাজিকীকরণ**
**উপবিষয়: সামাজিকীকরণের প্রক্রিয়া**
*   **সংজ্ঞা:** যে অভিযোজন প্রক্রিয়ার মাধ্যমে একজন ব্যক্তি বিভিন্ন সামাজিক প্রতিষ্ঠানের সাথে যুক্ত হয় এবং সামাজিক পরিবেশের সাথে খাপ খাইয়ে নেয়।
*   **ব্যাখ্যা:** সামাজিকীকরণ একটি ব্যক্তির পুরো জীবনব্যাপী ঘটে, পরিবার জীবনের প্রাথমিক পর্যায় থেকে শুরু করে জীবনের শেষ পর্যন্ত। এই প্রক্রিয়ার মাধ্যমেই একজন মানুষ পূর্ণতা লাভ করে এবং সমাজের একজন দায়িত্বশীল সদস্য হয়ে ওঠে।
*   **মুখস্থ/বোধগম্য করার সহজ উপায়:** সামাজিকীকরণ = "সমাজের সাথে তাল মিলানো" (আপনার চারপাশের নিয়ম ও মূল্যবোধের সাথে নিজেকে মানিয়ে নেওয়া)।
*   **সাধারণ ভুল ধারণা:** মনে করা যে সামাজিকীকরণ শুধুমাত্র শৈশবে ঘটে; আসলে এটি একটি ধারাবাহিক প্রক্রিয়া যা একজন ব্যক্তির সারা জীবন ধরে চলে।
*   **জটিলতা:** সহজ।

---

### **পুনরাবৃত্তিমূলক প্রশ্ন ও উত্তর: বাংলাদেশের পারিবারিক কাঠামো ও সামাজিকীকরণ**
**প্রশ্ন ১: উৎস অনুসারে, সমাজের প্রাথমিক ও মৌলিক প্রতিষ্ঠান কোনটি?**
ক) স্কুল
খ) পরিবার
গ) সরকার
ঘ) কর্মক্ষেত্র
**সঠিক: খ**
**ব্যাখ্যা:** উৎসগুলোতে পরিবারকে সমাজের প্রাথমিক ও মৌলিক প্রতিষ্ঠান হিসেবে বর্ণনা করা হয়েছে, যা সামাজিক সংগঠনের ক্ষুদ্রতম একক হিসেবে কাজ করে।
`;

try {
    const result = parseLessonText(testContent);
    console.log('Parse Result:', JSON.stringify(result, null, 2));
    if (result.length > 0 && result[0].topics.length > 0) {
        const topic = result[0].topics[0];
        const subtopic = topic.subtopics[0];
        console.log('\nVerification:');
        console.log('Subject:', result[0].subject);
        console.log('Chapter:', result[0].chapter);
        console.log('Topic:', topic.title);
        console.log('Subtopic:', subtopic.title);
        console.log('Shortcut found:', !!subtopic.shortcut);
        console.log('Mistakes found:', !!subtopic.mistakes);
        console.log('Questions count:', topic.questions.length);
        if (topic.questions.length > 0) {
            console.log('First Question:', topic.questions[0].question);
            console.log('Correct Answer:', topic.questions[0].correct_answer);
        }
    } else {
        console.log('Parse failed to return expected structure');
    }
} catch (error) {
    console.error('Parse error:', error);
}
