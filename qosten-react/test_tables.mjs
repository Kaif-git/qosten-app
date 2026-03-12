import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://idgogbisqacywbfnhdzy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ29nYmlzcWFjeXdiZm5oZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMjAxODMsImV4cCI6MjA2Nzg5NjE4M30.vPUQowhkQVLcQQziELxvLt3cz0QO8cBonxQwIYcjJHs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('--- Checking dev_chats ---');
  const { data: devChats, error: devChatsError } = await supabase
    .from('dev_chats')
    .select('*')
    .limit(1);
  
  if (devChatsError) {
    console.log('dev_chats Error:', devChatsError.message);
  } else {
    console.log('dev_chats exists! Sample:', devChats);
  }

  console.log('\n--- Checking notifications ---');
  const { data: notifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('*')
    .limit(1);
  
  if (notificationsError) {
    console.log('notifications Error:', notificationsError.message);
  } else {
    console.log('notifications exists! Sample:', notifications);
  }
}

checkTables();
