const supabaseUrl = 'https://idgogbisqacywbfnhdzy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ29nYmlzcWFjeXdiZm5oZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMjAxODMsImV4cCI6MjA2Nzg5NjE4M30.vPUQowhkQVLcQQziELxvLt3cz0QO8cBonxQwIYcjJHs';

async function testSupabase() {
  const url = `${supabaseUrl}/rest/v1/questions?limit=1`;
  
  console.log('Testing direct Supabase REST API...');
  const res = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('✅ Success! Questions table exists in Supabase.');
    console.log('Sample columns:', Object.keys(data[0]).join(', '));
  } else {
    console.error('❌ Supabase REST API failed:', res.status, await res.text());
    
    // Try questions_duplicate
    console.log('Trying questions_duplicate...');
    const res2 = await fetch(`${supabaseUrl}/rest/v1/questions_duplicate?limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    if (res2.ok) {
        const data2 = await res2.json();
        console.log('✅ Success! questions_duplicate table exists.');
        console.log('Sample columns:', Object.keys(data2[0]).join(', '));
    } else {
        console.error('❌ questions_duplicate also failed.');
    }
  }
}

testSupabase();
