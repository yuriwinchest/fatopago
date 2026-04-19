// Diagnóstico via Supabase REST client (sem conexão direta ao DB)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Faltam credenciais Supabase'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1. Últimas 10 notícias (para saber se worker está rodando)
  console.log('=== ÚLTIMAS 10 NOTÍCIAS CRIADAS ===');
  const { data: latest } = await supabase
    .from('news_tasks')
    .select('id, content, is_admin_post, consensus_status, consensus_reached, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  (latest || []).forEach(t => {
    const src = t.content?.source || '?';
    const title = (t.content?.title || '').substring(0, 50);
    console.log(`  [admin=${t.is_admin_post}] [${t.consensus_status}/${t.consensus_reached}] ${src} | ${title} | ${t.created_at}`);
  });

  // 2. Total de notícias abertas e por status
  const { data: allOpen, count: cOpen } = await supabase
    .from('news_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('consensus_reached', false)
    .eq('consensus_status', 'open');
  console.log(`\n=== TOTAL ABERTAS (visíveis ao usuário): ${cOpen} ===`);

  const { count: cAdminOpen } = await supabase
    .from('news_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin_post', true)
    .eq('consensus_reached', false)
    .eq('consensus_status', 'open');
  console.log(`  Admin posts abertos: ${cAdminOpen}`);

  const { count: cScrapedOpen } = await supabase
    .from('news_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('is_admin_post', false)
    .eq('consensus_reached', false)
    .eq('consensus_status', 'open');
  console.log(`  Scraped posts abertos: ${cScrapedOpen}`);

  // 3. Notícias criadas nas últimas 6h (sinal do worker)
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { count: cRecent } = await supabase
    .from('news_tasks')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo);
  console.log(`\n=== NOTÍCIAS CRIADAS NAS ÚLTIMAS 6H: ${cRecent} ===`);
  if (cRecent === 0) console.log('  ⚠️  WORKER PARADO! Nenhuma notícia inserida nas últimas 6h.');

  // 4. Detalhes da última notícia scraped
  const { data: lastScraped } = await supabase
    .from('news_tasks')
    .select('content, created_at, is_admin_post, consensus_status')
    .eq('is_admin_post', false)
    .order('created_at', { ascending: false })
    .limit(1);
  console.log('\n=== ÚLTIMA NOTÍCIA SCRAPED (is_admin_post=false) ===');
  if (lastScraped && lastScraped[0]) {
    const t = lastScraped[0];
    console.log(`  source=${t.content?.source} | status=${t.consensus_status} | created=${t.created_at}`);
  } else {
    console.log('  NENHUMA notícia scraped encontrada no banco!');
  }
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
