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

const MEIO_NEWS_SOURCE = 'Meio News';
const MEIO_NEWS_BASE = 'https://www.meionews.com';
const MEIO_NEWS_SITEMAP_NEWS_GZ = 'https://www.meionews.com/sitemaps/news/sitemap.xml.gz';
// [2026-04-15] Ampliado de 20 para 40 para aumentar o pool por tick.
const MEIO_NEWS_PRIORITY_COUNT = Number(process.env.MEIO_NEWS_PRIORITY_COUNT || 40);

const ENABLE_RSS_FEEDS = String(process.env.ENABLE_RSS_FEEDS || 'true').toLowerCase() !== 'false';
// [2026-04-15] Expansao da matriz de feeds para reduzir risco de estagnacao do pool.
// Adicionadas subcategorias de veiculos ja existentes e novas fontes publicas de RSS.
const FEEDS = [
  // G1 (Globo)
  { url: 'https://g1.globo.com/rss/g1/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/politica/', category: 'Política', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/economia/', category: 'Economia', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/mundo/', category: 'Internacional', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/tecnologia/', category: 'Entretenimento', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/ciencia-e-saude/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/educacao/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/carros/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/turismo-e-viagem/', category: 'Entretenimento', source: 'G1' },
  { url: 'https://ge.globo.com/rss/ge/', category: 'Esportes', source: 'ge' },
  { url: 'https://ge.globo.com/rss/ge/futebol/', category: 'Esportes', source: 'ge' },
  // CNN Brasil (somente feed raiz; subcategorias retornaram 404 em validacao local 2026-04-15)
  { url: 'https://www.cnnbrasil.com.br/feed/', category: 'Brasil', source: 'CNN Brasil' },
  // UOL (feeds validados; tecnologia.xml e tilt.xml foram descontinuados em 2026-04-15)
  { url: 'https://rss.uol.com.br/feed/economia.xml', category: 'Economia', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/noticias.xml', category: 'Política', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/esporte.xml', category: 'Esportes', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/cinema.xml', category: 'Entretenimento', source: 'UOL' },
  // Jovem Pan
  { url: 'https://jovempan.com.br/feed', category: 'Brasil', source: 'Jovem Pan' },
  { url: 'https://jovempan.com.br/noticias/politica/feed', category: 'Política', source: 'Jovem Pan' },
  { url: 'https://jovempan.com.br/noticias/economia/feed', category: 'Economia', source: 'Jovem Pan' },
  { url: 'https://jovempan.com.br/esportes/feed', category: 'Esportes', source: 'Jovem Pan' },
  // Agencia Brasil
  { url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', category: 'Brasil', source: 'Agência Brasil' },
  { url: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml', category: 'Política', source: 'Agência Brasil' },
  { url: 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', category: 'Economia', source: 'Agência Brasil' },
  { url: 'https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml', category: 'Internacional', source: 'Agência Brasil' },
  // Metropoles
  { url: 'https://www.metropoles.com/feed', category: 'Brasil', source: 'Metrópoles' },
  // R7 (api/feed/rss retornou 404 em 2026-04-15; removido ate validar novo endpoint)
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;

// Content settings (kept small-ish to avoid bloating payloads and DB rows)
const NEWS_DESC_MAX_CHARS = Math.max(120, Number(process.env.NEWS_DESC_MAX_CHARS || 650));
const NEWS_FETCH_FULL_TEXT = String(process.env.NEWS_FETCH_FULL_TEXT || 'true').toLowerCase() !== 'false';
const NEWS_FULL_TEXT_MAX_CHARS = Math.max(1000, Number(process.env.NEWS_FULL_TEXT_MAX_CHARS || 10_000));
const NEWS_FULL_TEXT_MIN_CHARS = Math.max(0, Number(process.env.NEWS_FULL_TEXT_MIN_CHARS || 900));
const NEWS_FULL_TEXT_CONCURRENCY = Math.max(1, Number(process.env.NEWS_FULL_TEXT_CONCURRENCY || 5));
const NEWS_RETENTION_DAYS = Math.max(0, Number(process.env.NEWS_RETENTION_DAYS || 0));
const NEWS_RETENTION_RUN_INTERVAL_MS = Math.max(
  15 * 60 * 1000,
  Number(process.env.NEWS_RETENTION_RUN_INTERVAL_MS || 6 * 60 * 60 * 1000),
);

let lastRetentionRunAt = 0;

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

function decodeHtmlEntities(str) {
  if (!str) return '';
  const s = String(str);
  const named = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    copy: '©',
    reg: '®',
  };

  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, ent) => {
    const e = String(ent || '');
    if (!e) return m;
    if (e[0] === '#') {
      const isHex = e[1] === 'x' || e[1] === 'X';
      const num = isHex ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(num)) return m;
      try {
        return String.fromCodePoint(num);
      } catch {
        return m;
      }
    }
    const repl = named[e.toLowerCase()];
    return typeof repl === 'string' ? repl : m;
  });
}

function htmlToText(html) {
  if (!html) return '';
  let s = String(html);

  // Remove scripts/styles early to reduce noise.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  s = s.replace(/<aside[\s\S]*?<\/aside>/gi, ' ');
  s = s.replace(/<header[\s\S]*?<\/header>/gi, ' ');

  // Preserve some line breaks for readability.
  s = s.replace(/<(br|hr)\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article|blockquote|header|footer)>/gi, '\n');

  // Drop remaining tags.
  s = s.replace(/<[^>]*>/g, ' ');
  s = decodeHtmlEntities(s);

  // Normalize whitespace (keep paragraphs).
  s = s.replace(/\r/g, '');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n[ \t]+/g, '\n');
  s = s.replace(/[ \t]{2,}/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function clipText(text, maxChars) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (!Number.isFinite(maxChars) || maxChars <= 0) return s;
  if (s.length <= maxChars) return s;

  // Try to cut on a word boundary near maxChars.
  const slice = s.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.75 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractBestJsonLdArticleBody(html) {
  const rgx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let best = '';

  const pickBest = (val) => {
    if (!val) return;
    const txt = htmlToText(val);
    if (txt.length > best.length) best = txt;
  };

  const visit = (node) => {
    if (!node) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    if (typeof node !== 'object') return;

    // Common schema.org field for the article content.
    if (typeof node.articleBody === 'string') pickBest(node.articleBody);

    // Some sites put the body inside @graph.
    if (node['@graph']) visit(node['@graph']);

    // Dive into nested objects (best-effort).
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (!v) continue;
      if (typeof v === 'object') visit(v);
    }
  };

  const matches = String(html || '').matchAll(rgx);
  for (const m of matches) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    const parsed = safeJsonParse(raw);
    if (!parsed) continue;
    visit(parsed);
  }

  return best.trim();
}

function extractLongestTagText(html, tag) {
  const rgx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let best = '';
  const matches = String(html || '').matchAll(rgx);
  for (const m of matches) {
    const chunk = m[1] || '';
    const txt = htmlToText(chunk);
    if (txt.length > best.length) best = txt;
  }
  return best.trim();
}

function extractFullTextFromHtml(html, { maxChars, minChars } = {}) {
  const max = Number.isFinite(Number(maxChars)) ? Number(maxChars) : NEWS_FULL_TEXT_MAX_CHARS;
  const min = Number.isFinite(Number(minChars)) ? Number(minChars) : NEWS_FULL_TEXT_MIN_CHARS;

  if (!html) return '';

  // Best-effort extraction in descending "quality".
  let best = extractBestJsonLdArticleBody(html);

  if (best.length < min) {
    const fromArticle = extractLongestTagText(html, 'article');
    if (fromArticle.length > best.length) best = fromArticle;
  }

  if (best.length < min) {
    const fromMain = extractLongestTagText(html, 'main');
    if (fromMain.length > best.length) best = fromMain;
  }

  if (!best) {
    let cleanHtml = html;
    const h1Match = cleanHtml.match(/<h1[^>]*>[\s\S]*?<\/h1>/i);
    if (h1Match && h1Match.index) {
       cleanHtml = cleanHtml.substring(h1Match.index);
    }
    const endMatch = cleanHtml.match(/<(footer|aside|nav)[^>]*>/i);
    if (endMatch && endMatch.index) {
       cleanHtml = cleanHtml.substring(0, endMatch.index);
    }
    best = htmlToText(cleanHtml);
  }

  best = clipText(best, max);
  return best.trim();
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

function extractMetaContent(html, key) {
  const rgx = new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
  const match = String(html).match(rgx);
  return match ? match[1] : '';
}

function extractTitleTag(html) {
  const match = String(html).match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function normalizeLink(url) {
  if (!url) return '';
  return String(url).split('#')[0].split('?')[0].trim();
}

function isLikelyMeioNewsArticle(url) {
  const u = normalizeLink(url);
  if (!u.startsWith(MEIO_NEWS_BASE)) return false;
  if (u === MEIO_NEWS_BASE) return false;
  // Most MeioNews articles end with a numeric ID like "-551445"
  return /-\d{5,}\/?$/.test(u);
}

function parseSitemapUrlset(xml) {
  const out = [];
  const blocks = String(xml).matchAll(/<url>([\s\S]*?)<\/url>/g);
  for (const m of blocks) {
    const chunk = m[1] || '';
    const loc = (chunk.match(/<loc>([^<]+)<\/loc>/) || [])[1] || '';
    const lastmod = (chunk.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '';
    if (!loc) continue;
    out.push({ loc: normalizeLink(loc), lastmod });
  }
  return out;
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

function categoryFromUrl(url) {
  const path = String(url || '').toLowerCase();
  if (path.includes('/economia')) return 'Economia';
  if (path.includes('/internacional')) return 'Internacional';
  if (path.includes('/politica') || path.includes('/eleicoes')) return 'Política';
  if (path.includes('/esportes')) return 'Esportes';
  if (path.includes('/entretemeio') || path.includes('/famosos') || path.includes('/novelas')) return 'Entretenimento';
  return 'Brasil';
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

function normalizeItemToTask({ item, feed, createdAtIso }) {
  const img = extractImage(item) || CATEGORY_IMAGES[feed.category] || CATEGORY_IMAGES.Default;
  const rawDesc = stripHtml(item.description || item.contentSnippet || item.content || '');
  const cleanDesc = rawDesc.length > NEWS_DESC_MAX_CHARS ? `${rawDesc.slice(0, NEWS_DESC_MAX_CHARS)}...` : rawDesc;

  // Try to use RSS full content when available (avoids extra HTTP calls).
  // Many feeds do NOT include full content; in that case we'll fetch HTML later.
  const rssFullRaw = item?.['content:encoded'] || item?.content || '';
  const rssFullText = htmlToText(rssFullRaw);
  const rssFullOk =
    rssFullText && rssFullText.length >= NEWS_FULL_TEXT_MIN_CHARS ? clipText(rssFullText, NEWS_FULL_TEXT_MAX_CHARS) : '';

  const difficulty = pickDifficulty();
  const createdAt = createdAtIso || item.isoDate || item.pubDate || new Date().toISOString();

  const link = normalizeLink(item.link || '');
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
      ...(rssFullOk ? { full_text: rssFullOk } : {}),
    },
    consensus_reached: false,
  };
}

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://raxjzfvunjxqbxswuipp.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (required to bypass RLS and insert into news_tasks).');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchText(url, { accept } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();

  const lenHeader = res.headers.get('content-length');
  if (lenHeader && Number(lenHeader) > MAX_RESPONSE_BYTES) {
    throw new Error(`Response too large: ${lenHeader} bytes`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Response too large: ${buf.length} bytes`);
  }

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

  let outBuf = buf;
  try {
    outBuf = tryDecode();
  } catch {
    outBuf = buf;
  }

  if (outBuf.length > MAX_RESPONSE_BYTES) {
    throw new Error(`Decoded response too large: ${outBuf.length} bytes`);
  }

  // Some providers still serve RSS as ISO-8859-1.
  // Primeira tentativa: Content-Type do header.
  let isLatin1 = /charset\s*=\s*(iso-8859-1|latin1)/i.test(contentType);
  // Fallback: muitos feeds brasileiros (UOL) não declaram charset no header,
  // mas trazem a declaração no prólogo XML (<?xml version="1.0" encoding="ISO-8859-1"?>).
  if (!isLatin1) {
    const sniffHead = outBuf.slice(0, 200).toString('ascii');
    if (/<\?xml[^>]*encoding\s*=\s*["'](iso-8859-1|latin1)["']/i.test(sniffHead)) {
      isLatin1 = true;
    }
  }
  return outBuf.toString(isLatin1 ? 'latin1' : 'utf8');
}

async function fetchFeedXml(url) {
  return fetchText(url, {
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  });
}

// [2026-04-15] UOL envelopa title/link/description em <![CDATA[...]]>. O stripHtml antigo
// removia o CDATA inteiro como se fosse uma tag, zerando os campos. Aqui extraimos o CDATA
// primeiro e so entao passamos pelo stripHtml para limpar tags residuais em description.
function unwrapCdataAndStrip(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (m) return stripHtml(m[1]).trim();
  return stripHtml(s).trim();
}

function simpleParseRssItems(xml) {
  const items = [];
  const blocks = String(xml).matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  for (const m of blocks) {
    const chunk = m[1] || '';
    const title = (chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const link = (chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const description =
      (chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '';
    const pubDate = (chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || '';
    items.push({
      title: unwrapCdataAndStrip(title),
      link: unwrapCdataAndStrip(link),
      description: unwrapCdataAndStrip(description),
      pubDate: unwrapCdataAndStrip(pubDate),
    });
  }
  return items;
}

async function fetchMeioNewsCandidateUrls({ want = 20, scan = 200 } = {}) {
  // Use sitemap (reliable) instead of scraping homepage/category pages.
  const xml = await fetchText(MEIO_NEWS_SITEMAP_NEWS_GZ, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8' });
  const urls = parseSitemapUrlset(xml)
    .filter((u) => isLikelyMeioNewsArticle(u.loc))
    .map((u) => ({
      loc: u.loc,
      lastmod: u.lastmod,
      ts: u.lastmod ? Date.parse(u.lastmod) : 0,
    }));

  urls.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return urls.slice(0, Math.max(scan, want)).map((u) => u.loc);
}

// --- CYCLE MANAGEMENT START ---
const WEEKLY_CYCLE_ANCHOR_ISO = process.env.WEEKLY_CYCLE_ANCHOR_ISO || '2026-03-08T15:00:00.000Z';
const WEEKLY_CYCLE_TOTAL_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_CYCLE_ACTIVE_MS = ((6 * 24) + 23) * 60 * 60 * 1000;

function getWeeklyCycleFallback(reference = new Date()) {
  const refMs = reference instanceof Date ? reference.getTime() : new Date(reference).getTime();
  const anchorMs = Date.parse(WEEKLY_CYCLE_ANCHOR_ISO);
  const cycleIndex = Math.max(0, Math.floor((refMs - anchorMs) / WEEKLY_CYCLE_TOTAL_MS));
  const cycleStartMs = anchorMs + (cycleIndex * WEEKLY_CYCLE_TOTAL_MS);

  return {
    cycle_number: cycleIndex + 1,
    cycle_start_at: new Date(cycleStartMs).toISOString(),
    cycle_end_at: new Date(cycleStartMs + WEEKLY_CYCLE_ACTIVE_MS).toISOString(),
  };
}

async function getCurrentCycle(supabase) {
  try {
    const { data, error } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.cycle_start_at) {
      return {
        cycle_number: Number(row.cycle_number || 1),
        cycle_start_at: String(row.cycle_start_at),
        cycle_end_at: row.cycle_end_at ? String(row.cycle_end_at) : null,
      };
    }
  } catch (err) {
    console.error('[cycle] RPC fallback acionado:', err?.message || err);
  }

  return getWeeklyCycleFallback(new Date());
}
// --- CYCLE MANAGEMENT END ---

// [2026-04-15] Kill switch global da ingestao externa.
// Regra de negocio: o hub agora serve APENAS noticias cadastradas manualmente no
// painel admin (is_admin_post=true). Enquanto esse flag estiver 'false', o worker
// nao raspa MeioNews nem consome feeds RSS — nenhuma linha scraped eh inserida.
// Reativar = setar ENABLE_EXTERNAL_INGESTION=true no .env do VPS e reiniciar o pm2.
const ENABLE_EXTERNAL_INGESTION =
  String(process.env.ENABLE_EXTERNAL_INGESTION || 'false').toLowerCase() === 'true';

async function ingestOnce({ perFeedLimit = 20 } = {}) {
  if (!ENABLE_EXTERNAL_INGESTION) {
    console.log('[news] ingestao externa DESATIVADA (ENABLE_EXTERNAL_INGESTION != true). Nenhuma noticia sera raspada.');
    return { inserted: 0, skipped: true };
  }

  const supabase = getSupabaseAdmin();
  const startedAt = Date.now();

  let cycleInfo;
  try {
    cycleInfo = await getCurrentCycle(supabase);
  } catch (err) {
    console.error('[cycle] Error determining cycle:', err);
    cycleInfo = { cycle_number: 1, cycle_start_at: new Date().toISOString() };
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function withRetry(fn, { attempts = 3, baseDelayMs = 400 } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        await sleep(baseDelayMs * Math.pow(2, i));
      }
    }
    throw lastErr;
  }

  const nowMs = Date.now();

  // Optional retention. Disabled by default (NEWS_RETENTION_DAYS=0).
  if (NEWS_RETENTION_DAYS > 0 && nowMs - lastRetentionRunAt >= NEWS_RETENTION_RUN_INTERVAL_MS) {
    lastRetentionRunAt = nowMs;
    const cutoffIso = new Date(nowMs - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { data: deletedCount, error: pruneError } = await withRetry(() =>
        supabase
          .rpc('prune_old_news_tasks', { p_retention_days: NEWS_RETENTION_DAYS }),
      );
      if (pruneError) throw pruneError;
      const deleted = Number(deletedCount || 0);
      console.log(`[news] retention prune ok (older_than=${cutoffIso}, deleted=${deleted})`);
    } catch (err) {
      console.error('[news] retention prune fail:', err?.message || err);
    }
  }

  // [2026-04-15] Teto global por tick elevado de 20 para 80 e scan por feed de 10 para 25.
  // Racional: com ~30 feeds ativos x 25 itens = 750 candidatos/tick no melhor caso; a deduplicacao
  // por link (RECENT_WINDOW) mantem o numero efetivo inserido baixo. O objetivo e garantir
  // resposta a picos de publicacao dos veiculos (manha/tarde) sem estourar quota Supabase.
  const rssTotalLimit = Math.max(0, Number(perFeedLimit || 80));
  const rssScanPerFeed = Math.max(1, Number(process.env.RSS_SCAN_PER_FEED || 25));
  // [2026-04-15] Fair share: cap de INSERCOES por feed por tick. Impede que G1 (7+ feeds)
  // monopolize o rssTotalLimit e deixe CNN/UOL/JovemPan zerados. Com ~30 feeds x 8 insercoes
  // = 240 max/tick, mas na pratica a dedup por link derruba para dezenas (esperado).
  const rssPerFeedInsertLimit = Math.max(
    1,
    Number(process.env.RSS_PER_FEED_INSERT_LIMIT || 8),
  );

  // Load a recent window to avoid inserting duplicates by link.
  const RECENT_WINDOW = Number(process.env.NEWS_RECENT_WINDOW || 2000);
  const { data: recent, error: recentError } = await withRetry(() =>
    supabase
      .from('news_tasks')
      .select('link:content->>link, created_at')
      .order('created_at', { ascending: false })
      .range(0, Math.max(1, RECENT_WINDOW) - 1),
  );
  if (recentError) throw recentError;

  const normalizedExisting = new Set(
    (recent || [])
      .map((row) => normalizeLink(row?.link))
      .filter((v) => typeof v === 'string' && v.length > 0),
  );

  let fetchedCandidates = 0;
  let inserted = 0;

  // 1) MeioNews: always attempt the latest 20 URLs from the sitemap.
  const meioWanted = Math.max(0, MEIO_NEWS_PRIORITY_COUNT);
  const meioTasks = [];
  if (meioWanted > 0) {
    try {
      const candidates = await fetchMeioNewsCandidateUrls({ want: meioWanted, scan: meioWanted });
      fetchedCandidates += candidates.length;

      const selected = [];
      for (const u of candidates) {
        const nu = normalizeLink(u);
        if (!nu) continue;
        if (normalizedExisting.has(nu)) continue;
        selected.push(nu);
        normalizedExisting.add(nu);
      }

      const built = await asyncMapLimit(selected, 5, async (link, idx) => {
        try {
          const html = await fetchText(link);
          const title = extractMetaContent(html, 'og:title') || extractTitleTag(html) || 'Notícia';
          const description = extractMetaContent(html, 'og:description') || '';
          const image = extractMetaContent(html, 'og:image') || null;
          const category = categoryFromUrl(link);
          const fullText = NEWS_FETCH_FULL_TEXT ? extractFullTextFromHtml(html) : '';

          const item = { title, description, link };
          const feed = { source: MEIO_NEWS_SOURCE, category };

          // Keep MeioNews at the top of the dashboard ordering.
          const createdAtIso = new Date(nowMs - idx * 1000).toISOString();
          const task = normalizeItemToTask({ item, feed, createdAtIso });
          if (image) task.content.image_url = image;
          if (fullText && fullText.length >= NEWS_FULL_TEXT_MIN_CHARS) task.content.full_text = fullText;

          task.cycle_number = cycleInfo.cycle_number;
          task.cycle_start_at = cycleInfo.cycle_start_at;
          return task;
        } catch (err) {
          console.error(`[news] ${MEIO_NEWS_SOURCE} fail:`, err?.message || err);
          return null;
        }
      });

      for (const t of built) if (t) meioTasks.push(t);
      console.log(`[news] ${MEIO_NEWS_SOURCE} ok (new=${meioTasks.length} scanned=${candidates.length})`);
    } catch (err) {
      console.error(`[news] ${MEIO_NEWS_SOURCE} fail:`, err?.message || err);
    }
  }

  if (meioTasks.length > 0) {
    const { error: insertError } = await withRetry(() => supabase.from('news_tasks').insert(meioTasks));
    if (insertError) throw insertError;
    inserted += meioTasks.length;
  }

  // Determine a "floor" timestamp: RSS tasks must be older than the oldest item
  // among the latest 20 MeioNews tasks, so the first 20 tasks in the UI remain MeioNews.
  let floorAtMs = nowMs - MEIO_NEWS_PRIORITY_COUNT * 1000;
  try {
    const { data: top, error: topError } = await withRetry(() =>
      supabase
        .from('news_tasks')
        .select('created_at')
        .eq('content->>source', MEIO_NEWS_SOURCE)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, MEIO_NEWS_PRIORITY_COUNT)),
    );
    if (topError) throw topError;
    const floorRow = Array.isArray(top) && top.length > 0 ? top[top.length - 1] : null;
    if (floorRow?.created_at) {
      const t = Date.parse(floorRow.created_at);
      if (Number.isFinite(t)) floorAtMs = t;
    }
  } catch (err) {
    console.error('[news] floor calc fail:', err?.message || err);
  }

  // 2) RSS: scan top N per feed and insert only the new ones.
  if (ENABLE_RSS_FEEDS && FEEDS.length > 0 && rssTotalLimit > 0) {
    const rssTasks = [];
    let rssIdx = 0;

    for (const feed of FEEDS) {
      // [2026-04-15] Fair share: o antigo `if (rssTasks.length >= rssTotalLimit) break;`
      // quebrava o outer loop assim que G1 enchia os slots globais, starvando CNN/UOL/JovemPan.
      // Agora cada feed tem sua propria cota (rssPerFeedInsertLimit) e o cap global so entra
      // como ultimo recurso (protecao contra estourar Supabase).
      if (rssTasks.length >= rssTotalLimit) break;
      let insertedFromThisFeed = 0;
      try {
        const xml = await fetchFeedXml(feed.url);
        let items = [];
        try {
          const parsed = await parser.parseString(xml);
          items = Array.isArray(parsed?.items) ? parsed.items : [];
        } catch (e) {
          // Fallback for slightly non-standard feeds (ex: missing rss version attribute).
          items = simpleParseRssItems(xml);
        }
        fetchedCandidates += Math.min(items.length, rssScanPerFeed);

        for (const item of items.slice(0, rssScanPerFeed)) {
          if (insertedFromThisFeed >= rssPerFeedInsertLimit) break;
          if (rssTasks.length >= rssTotalLimit) break;
          const link = normalizeLink(item?.link || '');
          if (!link) continue;
          if (normalizedExisting.has(link)) continue;
          normalizedExisting.add(link);

          // Make RSS tasks older than the "top 20" floor so they never appear above MeioNews.
          rssIdx++;
          const createdAtIso = new Date(floorAtMs - rssIdx * 1000).toISOString();
          const task = normalizeItemToTask({ item: { ...item, link }, feed, createdAtIso });
          task.cycle_number = cycleInfo.cycle_number;
          task.cycle_start_at = cycleInfo.cycle_start_at;
          rssTasks.push(task);
          insertedFromThisFeed++;
        }
        if (insertedFromThisFeed > 0) {
          console.log(`[news] RSS ${feed.source} (${feed.category}) +${insertedFromThisFeed}`);
        }
      } catch (err) {
        console.error(`[news] RSS fail (${feed.source}):`, err?.message || err);
      }
    }

    // Best-effort: fetch the article HTML and extract readable text for the app.
    // Many sites may block scraping; failures are ignored per item.
    if (NEWS_FETCH_FULL_TEXT && rssTasks.length > 0) {
      const hydrated = await asyncMapLimit(rssTasks, NEWS_FULL_TEXT_CONCURRENCY, async (t) => {
        try {
          const link = t?.content?.link;
          const current = String(t?.content?.full_text || '').trim();
          if (!link) return t;
          if (current && current.length >= NEWS_FULL_TEXT_MIN_CHARS) return t;

          const html = await fetchText(link);
          const full = extractFullTextFromHtml(html);
          if (full && full.length >= NEWS_FULL_TEXT_MIN_CHARS) {
            t.content.full_text = full;
          }
        } catch {
          // ignore
        }
        return t;
      });

      rssTasks.length = 0;
      for (const t of hydrated) rssTasks.push(t);
    }

    if (rssTasks.length > 0) {
      const { error: insertError } = await withRetry(() => supabase.from('news_tasks').insert(rssTasks));
      if (insertError) throw insertError;
      inserted += rssTasks.length;
    }
  }

  return { inserted, fetched: fetchedCandidates, durationMs: Date.now() - startedAt };
}

module.exports = { ingestOnce, fetchText, extractFullTextFromHtml };
