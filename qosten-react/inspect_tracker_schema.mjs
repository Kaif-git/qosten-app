
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTracker() {
  console.log('Fetching daily_guide_trackers info...');

  const { data, error } = await supabase
    .from('daily_guide_trackers')
    .select('activity_history')
    .limit(50);

  if (error) {
    console.error('Error fetching trackers:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('Table exists but is empty.');
    return;
  }

  const extraKeys = new Set();
  const examples = [];

  data.forEach(row => {
    const history = row.activity_history;
    if (Array.isArray(history)) {
      history.forEach(item => {
        Object.keys(item).forEach(key => {
          if (key !== 'task' && key !== 'time') {
            extraKeys.add(key);
            if (examples.length < 5) {
              examples.push(item);
            }
          }
        });
      });
    }
  });

  console.log('--- Analysis of activity_history ---');
  console.log('Extra keys found:', Array.from(extraKeys));
  console.log('--- Examples with extra data ---');
  examples.forEach(ex => console.log(JSON.stringify(ex, null, 2)));
}

inspectTracker();
