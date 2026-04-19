
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const userId = 'd406769d-2c4b-4695-b560-b64609741f07';
  const { data: plans, error } = await supabase.from('plan_purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) console.error('Error fetching plans:', error);
  else console.log('All plans for Noely:', JSON.stringify(plans, null, 2));
}
diagnose();
