const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://idgogbisqacywbfnhdzy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ29nYmlzcWFjeXdiZm5oZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMjAxODMsImV4cCI6MjA2Nzg5NjE4M30.vPUQowhkQVLcQQziELxvLt3cz0QO8cBonxQwIYcjJHs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUBJECT = 'বাংলা প্রথম পত্র';
const TYPES = ['mcq', 'sq', 'cq'];

const CHAPTERS = [
  'অভাগীর স্বর্গ', 'আম-আঁটির ভেঁপু', 'আমার দেশ', 'আমি কোনো আগন্তুক নই',
  'ঈশ্বরচন্দ্র বিদ্যাসাগর', 'উমর ফারুক', 'একুশের গল্প', 'কপোতাক্ষ নদ',
  'জীবন বিনিময়', 'জীবন বিনিময়', 'ঝরনার গান', 'নিমগাছ', 'নিরীহ বাঙালি',
  'পল্লিসাহিত্য', 'প্রত্যুপকার', 'প্রবাস বন্ধু', 'প্রাণ', 'ফুলের বিবাহ',
  'বই পড়া', 'বন্দনা', 'বহিপীর', 'বৃষ্টি', 'মমতাদি', 'মানুষ মুহম্মদ (স.)',
  'যাবো আমি তোমার দেশে', 'রানার', 'সুভা', 'সেইদিন এই মাঠ', 'হে স্বাধীনতা', '১৯৭১',
];

const TABLES = ['questions', 'questions_duplicate'];

async function markHalfPremium(tableName, subject, chapter, type) {
  const { data, error } = await supabase
    .from(tableName)
    .select('id, is_premium')
    .eq('subject', subject)
    .eq('chapter', chapter)
    .eq('type', type);

  if (error) {
    console.error(`      ❌ Error fetching ${tableName}: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) return;

  const shuffled = data.sort(() => Math.random() - 0.5);
  const half = Math.ceil(data.length / 2);
  const premiumIds = shuffled.slice(0, half).map(q => q.id);
  const freeIds = shuffled.slice(half).map(q => q.id);

  if (premiumIds.length > 0) {
    const { error: upErr } = await supabase
      .from(tableName)
      .update({ is_premium: true })
      .in('id', premiumIds);
    if (upErr) console.error(`      ❌ Premium update error: ${upErr.message}`);
  }

  if (freeIds.length > 0) {
    const { error: upErr } = await supabase
      .from(tableName)
      .update({ is_premium: false })
      .in('id', freeIds);
    if (upErr) console.error(`      ❌ Free update error: ${upErr.message}`);
  }

  const premium = data.filter(q => q.is_premium).length;
  console.log(`      ${tableName}: ${data.length} total, ${premiumIds.length} → premium, ${freeIds.length} → free`);
}

async function main() {
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║   Mark 50% Premium for ALL Chapters - ${SUBJECT}        ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const chapter = CHAPTERS[ci];
    console.log(`[${ci + 1}/${CHAPTERS.length}] 📖 ${chapter}`);

    for (const type of TYPES) {
      console.log(`   📝 ${type}:`);

      for (const table of TABLES) {
        await markHalfPremium(table, SUBJECT, chapter, type);
      }
    }
    console.log('');
  }

  console.log('✅ All done!');
}

main().catch(err => console.error('❌ Fatal:', err));
