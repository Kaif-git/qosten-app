import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSubjects() {
  console.log('--- Checking learn_topics table ---');
  
  // Total Count
  const { count, error: countError } = await supabase
    .from('learn_topics')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error fetching count:', countError);
  } else {
    console.log('Total rows in learn_topics:', count);
  }

  // Unique Subjects (Paginated to be sure)
  let allSubjects = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('learn_topics')
      .select('subject')
      .range(from, from + pageSize - 1);
      
    if (error) {
      console.error('Error fetching subjects batch:', error);
      break;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allSubjects = allSubjects.concat(data.map(item => item.subject));
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }
  }

  const uniqueSubjects = [...new Set(allSubjects)].sort();
  console.log('--- Unique Subjects (Total: ' + uniqueSubjects.length + ') ---');
  console.log(uniqueSubjects);
}

checkSubjects();
