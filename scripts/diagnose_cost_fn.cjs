
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const { data, error } = await supabase.from('news_tasks').select('id, content').limit(5);
  if (error) console.error('Error fetching tasks:', error);
  else console.log('Recent tasks:', data.map(t => ({ id: t.id, category: t.content.category })));

  const { data: fn, error: fnErr } = await supabase.rpc('get_validation_cost_by_category', { p_category: 'Brasil' });
  if (fnErr) console.error('Error in rpc call:', fnErr);
  else console.log('Result for Brasil:', fn);
}
diagnose();
