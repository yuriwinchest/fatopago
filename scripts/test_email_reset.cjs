
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function testReset() {
    const email = 'noely202123@gmail.com'; // Valid email found in DB
    console.log(`Checking if user exists: ${email}`);
    
    // Check if user exists in Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) return console.error('Error listing users:', listError);
    
    const user = users.find(u => u.email === email);
    if (!user) {
        console.log(`User ${email} NOT found in Supabase Auth.`);
        console.log('Registered users:', users.map(u => u.email));
    } else {
        console.log(`User ${email} found! Testing password reset...`);
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
            console.error('Reset error:', error);
        } else {
            console.log('Reset request sent successfully (according to Supabase).');
        }
    }
}

testReset();
