
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTypes() {
  const { data, error } = await supabase
    .from('notifications')
    .select('type');
  
  if (error) {
    console.error('Error fetching notification types:', error);
    return;
  }
  
  const uniqueTypes = [...new Set(data.map(n => n.type))];
  console.log('Existing notification types in the database:');
  console.log(uniqueTypes);
}

checkTypes();
