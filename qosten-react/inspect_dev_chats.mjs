
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase
    .from('dev_chats')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('Error fetching dev_chats:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Sample data from dev_chats:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if any sender_type is 'developer'
    const devMsgs = data.filter(m => m.sender_type === 'developer');
    if (devMsgs.length > 0) {
      console.log('\nFound existing developer messages. Valid sender_ids include:');
      const ids = [...new Set(devMsgs.map(m => m.sender_id))];
      console.log(ids);
    } else {
      console.log('\nNo developer messages found in sample.');
    }
  } else {
    console.log('No data found in dev_chats.');
  }
}

inspect();
