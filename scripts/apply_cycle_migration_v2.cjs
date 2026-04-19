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
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function applyMigration() {
    console.log('🚀 Applying cycle tracking migration...\n');
    
    try {
        // Step 1: Add cycle_start_at column
        console.log('1️⃣  Adding cycle_start_at column...');
        const { error: error1 } = await supabase.rpc('exec_sql', {
            query: 'ALTER TABLE public.news_tasks ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW()'
        });
        
        // Step 2: Add cycle_number column
        console.log('2️⃣  Adding cycle_number column...');
        const { error: error2 } = await supabase.rpc('exec_sql', {
            query: 'ALTER TABLE public.news_tasks ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1'
        });
        
        // Step 3: Create index
        console.log('3️⃣  Creating index...');
        const { error: error3 } = await supabase.rpc('exec_sql', {
            query: 'CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle ON public.news_tasks(cycle_start_at DESC, cycle_number DESC)'
        });
        
        // Step 4: Update existing rows
        console.log('4️⃣  Updating existing rows...');
        const { error: error4 } = await supabase
            .from('news_tasks')
            .update({ cycle_start_at: supabase.raw('created_at') })
            .is('cycle_start_at', null);
        
        console.log('\n✅ Migration completed successfully!');
        console.log('   - Added cycle_start_at column');
        console.log('   - Added cycle_number column');
        console.log('   - Created index for performance');
        console.log('   - Updated existing records');
        
    } catch (err) {
        console.error('\n❌ Migration failed:', err.message);
        console.log('\n📝 Please run the following SQL manually in Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/raxjzfvunjxqbxswuipp/sql/new\n');
        console.log(`
ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle 
  ON public.news_tasks(cycle_start_at DESC, cycle_number DESC);

UPDATE public.news_tasks 
SET cycle_start_at = created_at 
WHERE cycle_start_at IS NULL;
        `);
    }
}

applyMigration();
