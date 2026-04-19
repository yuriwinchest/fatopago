
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const userId = 'd406769d-2c4b-4695-b560-b64609741f07';
  const { data: vals, error } = await supabase.from('validations').select('id, created_at, task_id').eq('user_id', userId);
  if (error) {
    console.error('Erro ao buscar validations:', error);
    return;
  }
  
  for (const val of vals) {
    const { data: task, error: taskErr } = await supabase.from('news_tasks').select('*').eq('id', val.task_id).single();
    if (taskErr) {
      console.error(`  Erro ao buscar task ${val.task_id}:`, taskErr);
    } else {
      console.log(`  Task: ${task.id}, Title: ${task.content.title}, Cat: ${task.content.category}`);
    }
  }
}
diagnose();
