
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

async function checkTable(tableName) {
  const { error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  if (error) {
    if (error.code === '42P01') {
      console.log(`❌ Table "${tableName}" does not exist.`);
      return false;
    } else {
      console.log(`❓ Table "${tableName}" exists but returned error: ${error.message} (Code: ${error.code})`);
      return true;
    }
  }
  console.log(`✅ Table "${tableName}" exists!`);
  return true;
}

const tablesToCheck = [
  'notifications',
  'user_notifications',
  'app_notifications',
  'user_messages',
  'dev_chats',
  'user_reports',
  'user_profiles'
];

console.log('Checking for tables...');
for (const table of tablesToCheck) {
  await checkTable(table);
}
