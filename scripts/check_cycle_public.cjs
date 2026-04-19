const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;

if (!url) throw new Error('Missing VITE_SUPABASE_URL');
if (!anon) throw new Error('Missing VITE_SUPABASE_ANON_KEY');

const supabase = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data, error } = await supabase
    .from('news_tasks')
    .select('id, created_at, cycle_start_at, cycle_number')
    .order('cycle_start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('check_cycle_public failed:', err);
  process.exit(1);
});

