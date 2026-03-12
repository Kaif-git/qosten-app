import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

const SUBJECT_MAP = {
  'পদার্থবিজ্ঞান': {
    target: 'Physics',
    chapters: {
      'ভৌত রাশি ও তাদের পরিমাপ': 'Physical Quantities and Their Measurements',
      'গতি': 'Motion',
      'বল': 'Force',
      'কাজ, ক্ষমতা ও শক্তি': 'Work, Power and Energy',
      'পদার্থের অবস্থা এবং চাপ': 'State of Matter and Pressure',
      'পদার্থের উপর তাপের প্রভাব': 'Effect of Heat on Matter',
      'তরঙ্গ ও শব্দ': 'Waves and Sound',
      'আলোর প্রতিফলন': 'Reflection of Light',
      'আলোর প্রতিসরণ': 'Refraction of Light',
      'স্থির তড়িৎ': 'Static Electricity',
      'বর্তমান বিদ্যুৎ': 'Current Electricity',
      'কারেন্টের চৌম্বকীয় প্রভাব': 'Magnetic Effects of Current',
      'আধুনিক পদার্থবিদ্যা ও ইলেকট্রনিক্স': 'Modern Physics & Electronics',
      'জীবন বাঁচাতে পদার্থবিজ্ঞান': 'Physics to Save Life'
    }
  },
  'পদার্থবিদ্যা': { // Alias for Physics
    target: 'Physics',
    chapters: {
        'ভৌত রাশি ও তাদের পরিমাপ': 'Physical Quantities and Their Measurements',
        'গতি': 'Motion',
        'বল': 'Force',
        'কাজ, ক্ষমতা ও শক্তি': 'Work, Power and Energy',
        'পদার্থের অবস্থা এবং চাপ': 'State of Matter and Pressure',
        'পদার্থের উপর তাপের প্রভাব': 'Effect of Heat on Matter',
        'তরঙ্গ ও শব্দ': 'Waves and Sound',
        'আলোর প্রতিফলন': 'Reflection of Light',
        'আলোর প্রতিসরণ': 'Refraction of Light',
        'স্থির তড়িৎ': 'Static Electricity',
        'বর্তমান বিদ্যুৎ': 'Current Electricity',
        'কারেন্টের চৌম্বকীয় প্রভাব': 'Magnetic Effects of Current',
        'আধুনিক পদার্থবিদ্যা ও ইলেকট্রনিক্স': 'Modern Physics & Electronics',
        'জীবন বাঁচাতে পদার্থবিজ্ঞান': 'Physics to Save Life'
    }
  },
  'রসায়ন': {
    target: 'Chemistry',
    chapters: {
      'আমাদের জীবনের রসায়ন': 'Concepts of Chemistry',
      'পদার্থের অবস্থা': 'States of Matter',
      'পদার্থের গঠন': 'Structure of Matter',
      'পর্যায় সারণি': 'Periodic Table',
      'রাসায়নিক বন্ধন': 'Chemical Bond',
      'মোলের ধারণা ও রাসায়নিক গণনা': 'Concept of Mole and Chemical Counting',
      'রাসায়নিক বিক্রিয়া': 'Chemical Reactions',
      'রসায়ন ও শক্তি': 'Chemistry and Energy',
      'অ্যাসিড-ক্ষার ভারসাম্য': 'Acid-Base Balance',
      'খনিজ সম্পদ: ধাতু- অধাতু': 'Mineral Resources: Metal-Nonmetal',
      'খনিজ সম্পদ: জীবাশ্ম': 'Mineral Resources: Fossils',
      'আমাদের জীবনে রসায়ন': 'Chemistry in Our Lives',
      'পৃথিবীর রসায়ন ও খনিজ': 'Chemistry of Earth and Minerals'
    }
  },
  'জীববিজ্ঞান': {
    target: 'Biology',
    chapters: {
      'জীবন পাঠ': 'Lessons on Life',
      'জীবের কোষ ও টিস্যু': 'Cells and Tissues of Organisms',
      'কোষ বিভাজন': 'Cell Division',
      'জৈভশক্তিবিদ্যা': 'Bioenergetics',
      'স্বাস্থ্য ও পুষ্টি': 'Food, Nutrition and Digestion',
      'জীব মধ্যে পরিবহন': 'Transport in Organisms',
      'গ্যাসের বিনিময়': 'Exchange of Gases',
      'রেচন তন্ত্র': 'Excretory System',
      'দৃঢ়তা এবং গতিবিধি': 'Firmness and Locomotion',
      'সমন্বয়': 'Co-ordination',
      'জীবের প্রজনন': 'Reproduction in Organism',
      'জীবের বংশগতি ও বিবর্তন': 'Heredity in Organisms and Biological Evolution',
      'জীবনের পরিবেশ': 'Environment of Life',
      'জীবপ্রযুক্তি': 'Biotechnology'
    }
  },
  'তথ্য ও যোগাযোগ প্রযুক্তি': {
    target: 'ICT',
    chapters: {
      'তথ্য ও যোগাযোগ প্রযুক্তি এবং আমাদের বাংলাদেশ': 'ICT and Our Bangladesh',
      'কম্পিউটার রক্ষণাবেক্ষণ ও সাইবার নিরাপত্তা': 'Computer Maintenance and Cyber Security',
      'ইন্টারনেট ও ওয়েব পরিচিতি': 'Internet and Introduction to Web',
      'আমার লেখা এবং হিসাব': 'My Writings and Accounts',
      'মাল্টিমিডিয়া ও গ্রাফিক্স': 'Multimedia and Graphics',
      'স্প্রেডশীট সফটওয়্যার': 'Spreadsheet Software',
      'প্রোগ্রামিংয়ের মাধ্যমে সমস্যা সমাধান': 'Problem Solving Through Programming'
    }
  },
  'বাংলাদেশ ও বিশ্বপরিচয়': {
    target: 'BGS',
    chapters: {
      'পূর্ব বাংলার রাজনৈতিক আন্দোলন (১৯৪৭-১৯৭০)': 'The Political Movement in East Bengal (1947-1970)',
      'বাংলাদেশের স্বাধীনতা': 'The Independence of Bangladesh',
      'সৌরজগৎ ও পৃথিবী': 'The Solar System and the Earth',
      'বাংলাদেশের ভূপ্রকৃতি ও জলবায়ু': 'The Topography and the Climate of Bangladesh',
      'বাংলাদেশের নদী ও প্রাকৃতিক সম্পদ': 'The Rivers of Bangladesh and Natural Resources',
      'রাষ্ট্র, নাগরিকতা ও আইন': 'The State, Citizenship and Law',
      'বাংলাদেশ সরকারের অঙ্গ': 'The Organs of Bangladesh Government',
      'বাংলাদেশের গণতন্ত্র ও নির্বাচন ব্যবস্থা': 'The Democracy of Bangladesh and Election System',
      'জাতিসংঘ ও বাংলাদেশ': 'The United Nations and Bangladesh',
      'জাতীয় সম্পদ ও অর্থনৈতিক ব্যবস্থা': 'The National Resources and Economic Systems',
      'বাংলাদেশের অর্থনৈতিক নির্দেশক ও অর্থনীতির প্রকৃতি': 'Economic Indicators and Nature of Bangladesh Economy',
      'বাংলাদেশ সরকারের আর্থিক ও ব্যাংকিং ব্যবস্থা': 'Financial and Banking Systems of Bangladesh',
      'বাংলাদেশের পরিবার কাঠামো ও সমাজিকীকরণ': 'Family Structure of Bangladesh and Socialization',
      'বাংলাদেশের সামাজিক পরিবর্তন': 'Social Change of Bangladesh',
      'বাংলাদেশের সামাজিক সমস্যা ও প্রতিকার': 'Social Problems of Bangladesh and Remedies'
    }
  },
  'ইসলাম ও নৈতিক শিক্ষা': {
    target: 'Islamic and Moral Studies',
    chapters: {
      'আকাইদ ও নৈতিক জীবন': 'Aqaid and Moral Life',
      'শরিয়তের উৎস': 'Sources of Shariat',
      'ইবাদত': 'Ibadat',
      'আখলাক': 'Akhlaq',
      'আদর্শ জীবন': 'Model Lives'
    }
  }
};

function hasBangla(text) {
  if (!text) return false;
  return /[\u0980-\u09FF]/.test(text);
}

async function separateLanguages() {
  console.log('--- Starting Subject/Chapter Separation ---');

  for (const [sourceSubject, config] of Object.entries(SUBJECT_MAP)) {
    console.log(`\nProcessing source subject: ${sourceSubject} -> Target: ${config.target}`);
    
    // 1. Get all topics for this subject
    const { data: topics, error: topicsErr } = await supabase
      .from('learn_topics')
      .select('*')
      .eq('subject', sourceSubject);
    
    if (topicsErr) {
      console.error(`Error fetching topics for ${sourceSubject}:`, topicsErr);
      continue;
    }

    for (const topic of topics) {
      // 2. Get subtopics for this topic
      const { data: subtopics, error: subErr } = await supabase
        .from('learn_subtopics')
        .select('*')
        .eq('topic_id', topic.id);
      
      if (subErr) {
        console.error(`Error fetching subtopics for topic ${topic.id}:`, subErr);
        continue;
      }

      // 3. Filter subtopics that have NO bangla whatsoever
      const englishSubtopics = subtopics.filter(st => {
        return !hasBangla(st.title) && !hasBangla(st.definition) && !hasBangla(st.explanation);
      });

      if (englishSubtopics.length === 0) continue;

      console.log(`  Topic "${topic.title}": Found ${englishSubtopics.length} English subtopics to move.`);

      // 4. Determine target chapter
      const targetChapter = config.chapters[topic.chapter.trim()] || topic.chapter;
      
      // 5. Find or create target topic in English subject
      // Check if a topic with same title exists in target subject/chapter
      let targetTopicId;
      const { data: existingTargetTopics } = await supabase
        .from('learn_topics')
        .select('id')
        .eq('subject', config.target)
        .eq('chapter', targetChapter)
        .eq('title', topic.title) // Use same title; if title is Bangla, user might need to rename later but subtopics are safe
        .limit(1);

      if (existingTargetTopics && existingTargetTopics.length > 0) {
        targetTopicId = existingTargetTopics[0].id;
      } else {
        console.log(`    Creating target topic "${topic.title}" in ${config.target} / ${targetChapter}`);
        const { data: newTopic, error: createErr } = await supabase
          .from('learn_topics')
          .insert([{
            subject: config.target,
            chapter: targetChapter,
            title: topic.title,
            order_index: topic.order_index
          }])
          .select();
        
        if (createErr) {
          console.error(`    Error creating topic:`, createErr);
          continue;
        }
        targetTopicId = newTopic[0].id;
      }

      // 6. Move subtopics
      for (const st of englishSubtopics) {
        const { error: moveErr } = await supabase
          .from('learn_subtopics')
          .update({ topic_id: targetTopicId })
          .eq('id', st.id);
        
        if (moveErr) {
          console.error(`    Error moving subtopic ${st.id}:`, moveErr);
        } else {
          console.log(`    Moved subtopic: ${st.title}`);
        }
      }

      // 7. Cleanup: Check if original topic is now empty
      const { count: remainingCount } = await supabase
        .from('learn_subtopics')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', topic.id);
      
      if (remainingCount === 0) {
        console.log(`    Original topic "${topic.title}" is now empty. Deleting...`);
        await supabase.from('learn_topics').delete().eq('id', topic.id);
      }
    }
  }

  console.log('\n--- Separation Complete ---');
}

separateLanguages();
