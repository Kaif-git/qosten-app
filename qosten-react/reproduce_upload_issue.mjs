const inputText = `# **বাংলা সংস্করণ (জীববিদ্যা - অধ্যায় অনুযায়ী সারসংক্ষেপ)**

---

## **অধ্যায় ০২: কোষ জীববিদ্যা**

**T-01: জীবন্ত কোষ**
- কোষ: জীবনের একক, স্ব-প্রতিরূপী, নির্বাচিতভাবে পর্ভেদ্য পর্দা।
- প্রোক্যারিয়োটিক কোষ: সুসংগঠিত নিউক্লিয়াস নেই, বৃত্তাকার DNA, 70S রাইবোজোম, অবাত শ্বসন।
- ইউক্যারিয়োটিক কোষ: সুসংগঠিত নিউক্লিয়াস, রৈখিক DNA, 80S রাইবোজোম, আবাত শ্বসন।

**T-02: কোষ প্রাচীর**
- উদ্ভিদ, ব্যাকটেরিয়া, ছত্রাকে পাওয়া যায়।
- উদ্ভিদ: সেলুলোজ, হেমিসেলুলোজ, লিগনিন।
- ব্যাকটেরিয়া: প্রোটিন, লিপিড, পলিস্যাকারাইড।
- ছত্রাক: কাইটিন।
- কাজ: দৃঢ়তা প্রদান, প্লাজমোডেসমাটা গঠন, পানি চলাচল নিয়ন্ত্রণ।
`;

function parse(inputText) {
    const lines = inputText.split('\n');
    const chapters = [];
    
    // Global state for current logical block
    let currentHeader = '';
    let buckets = {
      en: { topics: [], lastNum: 0, titleFallback: '' },
      bn: { topics: [], lastNum: 0, titleFallback: '' }
    };

    const flushBuckets = () => {
      const hasEN = buckets.en.topics.length > 0;
      const hasBN = buckets.bn.topics.length > 0;

      if (hasEN) {
        const name = currentHeader || `Chapter: ${buckets.en.titleFallback}`;
        chapters.push({
          name: hasBN ? `${name} (English)` : name,
          data: { topics: [...buckets.en.topics] }
        });
      }
      if (hasBN) {
        const name = currentHeader || `Chapter: ${buckets.bn.titleFallback}`;
        chapters.push({
          name: hasEN ? `${name} (Bangla)` : name,
          data: { topics: [...buckets.bn.topics] }
        });
      }
      
      // Reset buckets
      buckets = {
        en: { topics: [], lastNum: 0, titleFallback: '' },
        bn: { topics: [], lastNum: 0, titleFallback: '' }
      };
    };

    let activeTopic = null;
    let activeContent = [];

    const saveActiveTopicToBucket = () => {
      if (activeTopic) {
        activeTopic.content = activeContent.join('\n').trim();
        const lang = activeTopic.lang; // 'en' or 'bn'
        buckets[lang].topics.push({
          id: activeTopic.id,
          title: activeTopic.title,
          content: activeTopic.content
        });
        if (!buckets[lang].titleFallback) {
          buckets[lang].titleFallback = activeTopic.title;
        }
        activeTopic = null;
        activeContent = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
      if (!trimmed) continue;

      // IMPROVED REGEX
      const headerMatch = trimmed.match(/^(?:[#\s*]*)(Chapter\s*[\d০-৯]+|অধ্যা[য়য়]\s*[\d০-৯]+|English\s*Version|বাংলা\s*সংস্করণ)(.*)$/i);
      
      const topicMatch = trimmed.match(/^(?:[#\s*]*)((?:T|টি)-[০-৯\d]+(?:\s*&\s*(?:T|টি)-[০-৯\d]+)?)\s*[:：ঃ]\s*(.+)$/i);
      
      const isHardSplit = /^[\s\-*#=]{3,}$/.test(trimmed);

      if (headerMatch || isHardSplit) {
        saveActiveTopicToBucket();
        if (headerMatch) {
          if (buckets.en.topics.length > 0 || buckets.bn.topics.length > 0) {
              flushBuckets();
          }
          // IMPROVED HEADER CAPTURE
          const mainHeader = headerMatch[1].replace(/\*+/g, '').trim();
          const subHeader = headerMatch[2].replace(/[#\s*:]+/g, ' ').trim();
          currentHeader = subHeader ? `${mainHeader}: ${subHeader}` : mainHeader;
        } else {
          saveActiveTopicToBucket();
          flushBuckets();
          currentHeader = '';
        }
        continue;
      }

      if (topicMatch) {
        saveActiveTopicToBucket();

        const fullId = topicMatch[1].trim();
        const isBengali = fullId.includes('টি');
        const lang = isBengali ? 'bn' : 'en';
        
        const numMatch = fullId.match(/[০-৯\d]+/);
        const numStr = numMatch ? numMatch[0] : '0';
        const bengaliMap = {'০':0,'১':1,'২':2,'৩':3,'৪':4,'৫':5,'৬':6,'৭':7,'৮':8,'৯':9};
        const num = isBengali ? parseInt(numStr.split('').map(c => bengaliMap[c] ?? c).join('')) : parseInt(numStr);

        if (buckets[lang].topics.length > 0 && num <= buckets[lang].lastNum && num > 0) {
          flushBuckets();
        }

        activeTopic = {
          id: fullId,
          title: topicMatch[2].replace(/\*+/g, '').trim().replace(/[:：ঃ]$/, ''),
          lang: lang
        };
        buckets[lang].lastNum = num;
        continue;
      }

      if (activeTopic) {
        activeContent.push(line);
      }
    }

    saveActiveTopicToBucket();
    flushBuckets();
    return chapters;
}

const result = parse(inputText);
console.log(JSON.stringify(result, null, 2));