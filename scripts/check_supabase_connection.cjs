
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Try to load .env file from root
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    console.log('Loading .env from:', envPath);
    dotenv.config({ path: envPath });
} else {
    console.log('.env file not found at:', envPath);
    // Try current dir or default locations if needed, but usually it's in root
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase credentials not found in environment variables.');
    console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
    console.log(`Testing connection to ${supabaseUrl}...`);
    const start = Date.now();

    // Simple query to 'news_tasks' which we know acts like a public/readable table or profiles
    const { data, error } = await supabase.from('news_tasks').select('count', { count: 'exact', head: true });

    const duration = Date.now() - start;

    if (error) {
        console.error('Connection Failed:', error.message);
        console.error('Details:', error);
        process.exit(1);
    } else {
        console.log(`Connection Successful!`);
        console.log(`Response time: ${duration}ms`);
        console.log(`Table 'news_tasks' exists and accessible.`);
        process.exit(0);
    }
}

checkConnection();
