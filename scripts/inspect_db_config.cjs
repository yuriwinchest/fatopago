const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function getEnv(key) {
    const envPath = path.join(__dirname, '../.env');
    const envLocalPath = path.join(__dirname, '../.env.local');
    const load = (p) => {
        if (!fs.existsSync(p)) return null;
        const c = fs.readFileSync(p, 'utf8');
        const m = c.match(new RegExp(`^${key}=(.*)$`, 'm'));
        return m ? m[1].replace(/['"]/g, '').trim() : null;
    };
    return load(envLocalPath) || load(envPath);
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || getEnv('SUPABASE_URL');
const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
    console.log('Listando tabelas...');
    const { data, error } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    if (error) {
        console.error('Erro ao listar tabelas:', error);
        return;
    }
    console.log('Tabelas encontradas:', data.map(t => t.table_name));
    
    for (const t of data) {
        if (t.table_name.includes('setting') || t.table_name.includes('config')) {
            console.log(`Verificando o conteúdo da tabela ${t.table_name}...`);
            const { data: content, error: err2 } = await supabase.from(t.table_name).select('*');
            console.log(content);
        }
    }
}

listTables();
