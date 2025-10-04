const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://idgogbisqacywbfnhdzy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ29nYmlzcWFjeXdiZm5oZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMjAxODMsImV4cCI6MjA2Nzg5NjE4M30.vPUQowhkQVLcQQziELxvLt3cz0QO8cBonxQwIYcjJHs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
  console.log('Fetching sample questions from database...\n');
  
  // Fetch a few sample questions to see the structure
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .limit(3);

  if (error) {
    console.error('Error fetching questions:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Sample questions found:', data.length);
    console.log('\nTable columns:');
    console.log(Object.keys(data[0]).join(', '));
    console.log('\n\nFirst question structure:');
    console.log(JSON.stringify(data[0], null, 2));
    
    if (data.length > 1) {
      console.log('\n\nSecond question structure:');
      console.log(JSON.stringify(data[1], null, 2));
    }
  } else {
    console.log('No questions found in the database.');
  }

  // Get total count
  const { count, error: countError } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log('\n\nTotal questions in database:', count);
  }
}

inspectDatabase();
