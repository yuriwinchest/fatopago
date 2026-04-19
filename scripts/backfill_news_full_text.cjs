const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { fetchText, extractFullTextFromHtml } = require('./news_ingest.cjs');

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function getSupabaseAdmin() {
  const supabaseUrl = pick(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = pick(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl) throw new Error('SUPABASE_URL (ou VITE_SUPABASE_URL) não configurado.');
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado.');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function asyncMapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  let inFlight = 0;
  return new Promise((resolve, reject) => {
    const launchNext = () => {
      if (i >= items.length && inFlight === 0) return resolve(results);
      while (inFlight < limit && i < items.length) {
        const idx = i++;
        inFlight++;
        Promise.resolve()
          .then(() => fn(items[idx], idx))
          .then((res) => {
            results[idx] = res;
            inFlight--;
            launchNext();
          })
          .catch(reject);
      }
    };
    launchNext();
  });
}

async function main() {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Find the latest cycle that already started (ignore future cycles).
  const startedRes = await supabase
    .from('news_tasks')
    .select('cycle_start_at, cycle_number, created_at')
    .not('cycle_start_at', 'is', null)
    .lte('cycle_start_at', nowIso)
    .order('cycle_start_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const cycleStartAt = startedRes.data?.cycle_start_at || null;
  const cycleNumber = startedRes.data?.cycle_number || null;

  if (!cycleStartAt) {
    console.log('[backfill] Nenhum ciclo encontrado (cycle_start_at nulo). Abortando.');
    return;
  }

  const LIMIT = Math.max(1, Number(process.env.BACKFILL_NEWS_LIMIT || 200));
  const CONCURRENCY = Math.max(1, Number(process.env.BACKFILL_NEWS_CONCURRENCY || 4));
  const MIN_CHARS = Math.max(200, Number(process.env.BACKFILL_NEWS_MIN_CHARS || 900));

  console.log(`[backfill] Ciclo ativo: #${cycleNumber ?? '?'} (${cycleStartAt})`);

  const { data: rows, error } = await supabase
    .from('news_tasks')
    .select('id, content, created_at, cycle_start_at')
    .eq('cycle_start_at', cycleStartAt)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (error) throw error;

  const tasks = Array.isArray(rows) ? rows : [];
  const missing = tasks.filter((t) => {
    const full = String(t?.content?.full_text || '').trim();
    const link = String(t?.content?.link || '').trim();
    return Boolean(link) && (!full || full.length < MIN_CHARS);
  });

  console.log(`[backfill] Encontradas ${missing.length} notícia(s) sem texto completo (limit=${LIMIT}).`);

  let updated = 0;
  let skipped = 0;

  await asyncMapLimit(missing, CONCURRENCY, async (t, idx) => {
    const id = String(t.id);
    const link = String(t?.content?.link || '').trim();
    if (!id || !link) {
      skipped++;
      return;
    }

    try {
      const html = await fetchText(link);
      const full = extractFullTextFromHtml(html);
      if (!full || full.length < MIN_CHARS) {
        skipped++;
        return;
      }

      const nextContent = { ...(t.content || {}), full_text: full };
      const up = await supabase.from('news_tasks').update({ content: nextContent }).eq('id', id);
      if (up.error) throw up.error;

      updated++;
      if ((idx + 1) % 10 === 0) {
        console.log(`[backfill] progresso: ${idx + 1}/${missing.length} (updated=${updated}, skipped=${skipped})`);
      }
    } catch (e) {
      skipped++;
    }
  });

  console.log(`[backfill] Concluído. updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error('[backfill] Falhou:', err?.message || err);
  process.exit(1);
});

