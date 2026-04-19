
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) {
    console.error('Erro ao buscar usuários:', error);
    return;
  }
  
  users.forEach(u => {
    console.log(`User: ${u.id}, ${u.name} ${u.lastname}, Email: ${u.email}`);
  });
}
diagnose();
