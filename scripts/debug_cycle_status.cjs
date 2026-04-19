const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing creds");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Checking DB Status...");
    
    // Get latest task
    const { data: tasks, error } = await supabase
        .from('news_tasks')
        .select('id, content, created_at, cycle_start_at, cycle_number')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching tasks:", error);
        return;
    }

    console.log("LATEST 5 TASKS:");
    tasks.forEach(t => {
        const title = t.content?.title || 'No Title';
        console.log(`[${t.id}] Cycle #${t.cycle_number} | Start: ${t.cycle_start_at} | Created: ${t.created_at}`);
        console.log(`   Title: ${title.substring(0, 50)}...`);
        
        const start = new Date(t.cycle_start_at || t.created_at);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const now = new Date();
        const expired = now >= end;
        console.log(`   -> Ends: ${end.toISOString()} | Expired? ${expired ? 'YES' : 'NO'}`);
    });

    const now = new Date();
    console.log(`\nServer Time (approx): ${now.toISOString()}`);
}

check();
