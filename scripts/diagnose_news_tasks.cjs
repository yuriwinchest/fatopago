
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const { data, error } = await supabase.from('news_tasks').select('*').limit(1);
  if (error) {
    console.error('Erro ao ler news_tasks:', error);
  } else {
    console.log('news_tasks columns:', data && data.length > 0 ? Object.keys(data[0]) : 'Tabela vazia');
  }
}
diagnose();
