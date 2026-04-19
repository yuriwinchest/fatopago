const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // Sources distinct em notícias abertas
  console.log('=== DISTRIBUIÇÃO POR SOURCE (abertas) ===');
  const sources = ['Meio News', 'G1', 'CNN Brasil', 'UOL', 'Jovem Pan', 'Admin FatoPago'];
  for (const s of sources) {
    const { count } = await supabase
      .from('news_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('consensus_reached', false)
      .eq('consensus_status', 'open')
      .eq('content->>source', s);
    console.log(`  ${s}: ${count}`);
  }

  // Distribuição por categoria nas abertas
  console.log('\n=== DISTRIBUIÇÃO POR CATEGORIA (abertas) ===');
  const cats = ['Política', 'Economia', 'Esportes', 'Internacional', 'Brasil', 'Entretenimento'];
  for (const c of cats) {
    const { count } = await supabase
      .from('news_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('consensus_reached', false)
      .eq('consensus_status', 'open')
      .eq('content->>category', c);
    console.log(`  ${c}: ${count}`);
  }

  // Última notícia de cada source não-MeioNews
  console.log('\n=== ÚLTIMA NOTÍCIA POR SOURCE (todas, não só abertas) ===');
  for (const s of sources) {
    const { data } = await supabase
      .from('news_tasks')
      .select('content, created_at')
      .eq('content->>source', s)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data[0]) {
      console.log(`  ${s}: ${data[0].created_at} | ${(data[0].content?.title||'').substring(0,50)}`);
    } else {
      console.log(`  ${s}: NUNCA inseriu`);
    }
  }

  // Notícias criadas nas últimas 2h por source
  console.log('\n=== CRIADAS NAS ÚLTIMAS 2H POR SOURCE ===');
  const twoHAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  for (const s of sources) {
    const { count } = await supabase
      .from('news_tasks')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', twoHAgo)
      .eq('content->>source', s);
    console.log(`  ${s}: ${count}`);
  }
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
