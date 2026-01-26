const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const zlib = require('zlib');

const parser = new Parser({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
  customFields: {
    item: [['media:content', 'media'], ['media:thumbnail', 'thumbnail'], ['description', 'description']],
  },
});

const FEEDS = [
  { url: 'https://g1.globo.com/rss/g1/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/politica/', category: 'Política', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/economia/', category: 'Economia', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/mundo/', category: 'Internacional', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/tecnologia/', category: 'Entretenimento', source: 'G1' },
  { url: 'https://rss.uol.com.br/feed/economia.xml', category: 'Economia', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/noticias.xml', category: 'Política', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/esporte.xml', category: 'Esportes', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/cinema.xml', category: 'Entretenimento', source: 'UOL' },
  { url: 'https://www.cnnbrasil.com.br/feed/', category: 'Política', source: 'CNN Brasil' },
  { url: 'https://jovempan.com.br/feed', category: 'Brasil', source: 'Jovem Pan' },
];

const CATEGORY_IMAGES = {
  Política: 'https://images.unsplash.com/photo-1541872703-74c59636a226?q=80&w=800',
  Economia: 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?q=80&w=800',
  Brasil: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=800',
  Internacional: 'https://images.unsplash.com/photo-1529101091760-61df6be34fc0?q=80&w=800',
  Esportes: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800',
  Entretenimento: 'https://images.unsplash.com/photo-1499364615650-ec387c130087?q=80&w=800',
  Default: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800',
};

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>?/gm, '');
}

function extractImage(item) {
  if (item?.enclosure?.url) return item.enclosure.url;
  if (item?.media?.$?.url) return item.media.$.url;
  if (item?.thumbnail?.$?.url) return item.thumbnail.$.url;

  const content = item?.['content:encoded'] || item?.content || item?.description || '';
  const match = String(content).match(/src="([^"]+)"/);
  if (match) return match[1];
  return null;
}

function pickDifficulty() {
  const r = Math.random();
  if (r > 0.85) return 'hard';
  if (r > 0.55) return 'medium';
  return 'easy';
}

function rewardForDifficulty(diff) {
  const ranges = {
    easy: [0.3, 0.7],
    medium: [0.6, 1.2],
    hard: [1.0, 1.8],
  };
  const [min, max] = ranges[diff] || ranges.easy;
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function normalizeItemToTask({ item, feed }) {
  const img = extractImage(item) || CATEGORY_IMAGES[feed.category] || CATEGORY_IMAGES.Default;
  const rawDesc = stripHtml(item.description || item.contentSnippet || item.content || '');
  const cleanDesc = rawDesc.length > 160 ? `${rawDesc.slice(0, 160)}...` : rawDesc;

  const difficulty = pickDifficulty();
  const createdAt = item.isoDate || item.pubDate || new Date().toISOString();

  const link = item.link || '';
  return {
    created_at: new Date(createdAt).toISOString(),
    content: {
      title: item.title || 'Notícia',
      description: cleanDesc,
      source: feed.source,
      category: feed.category,
      difficulty,
      reward: rewardForDifficulty(difficulty),
      image_url: img,
      ...(link ? { link } : {}),
    },
    consensus_reached: false,
  };
}

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://raxjzfvunjxqbxswuipp.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (required to bypass RLS and insert into news_tasks).',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchFeedXml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const enc = (res.headers.get('content-encoding') || '').toLowerCase();

  const tryDecode = () => {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buf);
    if (enc.includes('gzip')) return zlib.gunzipSync(buf);
    if (enc.includes('deflate')) return zlib.inflateSync(buf);

    // Some providers return gzipped body without a proper header; detect gzip magic bytes too.
    const looksGz = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    if (looksGz) return zlib.gunzipSync(buf);
    return buf;
  };

  let xmlBuf = buf;
  try {
    xmlBuf = tryDecode();
  } catch {
    // If decode fails, fall back to raw buffer
    xmlBuf = buf;
  }

  return xmlBuf.toString('utf8');
}

async function ingestOnce({ perFeedLimit = 20 } = {}) {
  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  const tasks = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchFeedXml(feed.url);
      const feedData = await parser.parseString(xml);
      const items = (feedData.items || []).slice(0, perFeedLimit);
      for (const item of items) {
        const link = item?.link;
        if (!link) continue; // link is our dedupe key
        tasks.push(normalizeItemToTask({ item, feed }));
      }
      // eslint-disable-next-line no-console
      console.log(`[news] ${feed.source} ok (${items.length})`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[news] ${feed.source} fail:`, err?.message || err);
    }
  }

  // Batch dedupe by link
  const linkToTask = new Map();
  for (const t of tasks) {
    const link = t?.content?.link;
    if (!link) continue;
    if (!linkToTask.has(link)) linkToTask.set(link, t);
  }
  const links = Array.from(linkToTask.keys());

  if (links.length === 0) {
    return { inserted: 0, fetched: 0, durationMs: Date.now() - startedAt };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function withRetry(fn, { attempts = 3, baseDelayMs = 400 } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        // small exponential-ish backoff
        await sleep(baseDelayMs * Math.pow(2, i));
      }
    }
    throw lastErr;
  }

  // Dedupe against a recent window to avoid huge "in(...)" queries.
  // This keeps the carousel effectively unlimited while staying reliable.
  const RECENT_WINDOW = 2000;
  const { data: recent, error: recentError } = await withRetry(() =>
    supabase.from('news_tasks').select('content, created_at').order('created_at', { ascending: false }).range(0, RECENT_WINDOW - 1),
  );
  if (recentError) throw recentError;

  const existingLinks = new Set(
    (recent || [])
      .map((row) => row?.content?.link)
      .filter((v) => typeof v === 'string' && v.length > 0),
  );

  const toInsert = links
    .filter((l) => !existingLinks.has(l))
    .map((l) => linkToTask.get(l));

  if (toInsert.length === 0) {
    return { inserted: 0, fetched: links.length, durationMs: Date.now() - startedAt };
  }

  const { error: insertError } = await withRetry(() => supabase.from('news_tasks').insert(toInsert));
  if (insertError) throw insertError;

  return { inserted: toInsert.length, fetched: links.length, durationMs: Date.now() - startedAt };
}

module.exports = { ingestOnce };

