
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const taskId = 'f3a3fbee-8acb-4c7f-b1ad-e5ecced63552';
  const { data, error } = await supabase.from('news_tasks').select('id, created_at, cycle_start_at').eq('id', taskId).single();
  if (error) console.error('Error fetching task:', error);
  else console.log('Task dates:', data);
}
diagnose();
