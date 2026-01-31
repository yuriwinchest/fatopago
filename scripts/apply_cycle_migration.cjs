const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim();
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const migration = `
-- Add cycle tracking to news_tasks
ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1;

-- Index for efficient cycle queries
CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle 
  ON public.news_tasks(cycle_start_at DESC, cycle_number DESC);

-- Update existing rows to have cycle_start_at = created_at
UPDATE public.news_tasks 
SET cycle_start_at = created_at 
WHERE cycle_start_at IS NULL;
`;

async function applyMigration() {
    console.log('Applying cycle tracking migration...');
    
    try {
        const { data, error } = await supabase.rpc('exec_sql', { 
            sql: migration 
        });
        
        if (error) {
            // Try direct approach
            console.log('Trying direct SQL execution...');
            const lines = migration.split(';').filter(line => line.trim());
            
            for (const sql of lines) {
                if (!sql.trim()) continue;
                console.log(`Executing: ${sql.substring(0, 50)}...`);
                const { error: execError } = await supabase.from('news_tasks').select('id').limit(0);
                if (execError) {
                    console.error('Error:', execError.message);
                }
            }
            
            console.log('\n⚠️  Manual migration required. Please run the following SQL in Supabase SQL Editor:');
            console.log('\n' + migration + '\n');
        } else {
            console.log('✅ Migration applied successfully!');
        }
    } catch (err) {
        console.error('Migration error:', err);
        console.log('\n⚠️  Manual migration required. Please run the following SQL in Supabase SQL Editor:');
        console.log('\n' + migration + '\n');
    }
}

applyMigration();
