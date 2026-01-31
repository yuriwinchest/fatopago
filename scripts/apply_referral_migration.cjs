const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
let envVars = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            envVars[match[1].trim()] = match[2].trim();
        }
    });
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    console.log('Ensure .env exists with these keys.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260131170000_referral_system.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

async function applyMigration() {
    console.log('Applying Referral System migration...');
    
    try {
        // Try to execute via exec_sql RPC if it exists (common pattern in this project?)
        const { data, error } = await supabase.rpc('exec_sql', { 
            sql: migrationSql 
        });
        
        if (error) {
            console.error('RPC execution failed:', error.message);
            console.log('\n--- MANUAL ACTION REQUIRED ---');
            console.log('Please copy the content of supabase/migrations/20260131170000_referral_system.sql');
            console.log('and run it in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql');
        } else {
            console.log('✅ Migration applied successfully via RPC!');
        }
    } catch (err) {
        console.error('Migration error:', err);
        console.log('\n--- MANUAL ACTION REQUIRED ---');
        console.log('Please run the migration SQL manually.');
    }
}

applyMigration();
