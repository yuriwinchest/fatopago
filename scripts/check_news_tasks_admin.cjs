const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: latest, error: latestErr } = await supabase
    .from('news_tasks')
    .select('id, created_at, cycle_start_at, cycle_number, content')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;

  const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count, error: countErr } = await supabase
    .from('news_tasks')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);
  if (countErr) throw countErr;

  console.log(
    JSON.stringify(
      {
        supabaseUrl: url,
        latest: latest
          ? {
              id: latest.id,
              created_at: latest.created_at,
              cycle_start_at: latest.cycle_start_at,
              cycle_number: latest.cycle_number,
              title: latest?.content?.title || null,
              link: latest?.content?.link || null,
            }
          : null,
        inserted_last_2h: count ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

