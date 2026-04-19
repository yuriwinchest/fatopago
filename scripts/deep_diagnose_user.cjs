
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function deepDiagnose() {
    console.log('--- Deep Diagnose Noel* ---');
    
    // 1. Search in Auth (the source of truth for reset email)
    const { data: { users }, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) return console.error('Auth list error:', authErr);
    
    const possibleUsers = users.filter(u => 
        (u.email && u.email.toLowerCase().includes('noel')) ||
        (u.user_metadata?.name && u.user_metadata.name.toLowerCase().includes('noel'))
    );
    
    if (possibleUsers.length === 0) {
        console.log('No user found in Auth matching "Noel*".');
        return;
    }
    
    for (const u of possibleUsers) {
        console.log(`\nFound Auth User: ID=${u.id}, Email=${u.email}, Name=${u.user_metadata?.name || 'N/A'}`);
        
        // 2. Check Profile
        const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle();
        if (profErr) console.error(`Profile error for ${u.id}:`, profErr);
        else if (profile) {
            console.log(`Profile Found: Name=${profile.name} ${profile.lastname}, Balance=${profile.current_balance}`);
        } else {
            console.log('No profile record found in public.profiles for this ID.');
        }
    }
}

deepDiagnose();
