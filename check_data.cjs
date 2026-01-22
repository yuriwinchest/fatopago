
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://raxjzfvunjxqbxswuipp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheGp6ZnZ1bmp4cWJ4c3d1aXBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyNjQ4MywiZXhwIjoyMDg0MTAyNDgzfQ.sxj5zUp1RoZ45TAQg1IyE1cPg8AWI-RHaBNxmI_aTwg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.from('news_tasks').select('*');
    if (error) {
        console.error(error);
        return;
    }
    console.log("Count:", data.length);
    if (data.length > 0) {
        console.log("First item content:", JSON.stringify(data[0].content, null, 2));
    }
}

check();
