
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const categories = ['Brasil', 'Brasil ', 'brasil', 'POLITIK', 'Mundo', 'Saúde'];
  for (const cat of categories) {
    const { data, error } = await supabase.rpc('get_validation_cost_by_category', { p_category: cat });
    if (error) console.error(`Erro para ${cat}:`, error);
    else console.log(`Cost for ${cat}:`, data);
  }
}
diagnose();
