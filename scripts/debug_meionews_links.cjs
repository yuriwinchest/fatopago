const zlib = require('zlib');

const MEIO_NEWS_BASE = 'https://www.meionews.com';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;

async function fetchBody(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const buf = Buffer.from(await res.arrayBuffer());
  const enc = (res.headers.get('content-encoding') || '').toLowerCase();
  const looksGz = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;

  let out = buf;
  try {
    if (enc.includes('gzip') || looksGz) out = zlib.gunzipSync(buf);
    else if (enc.includes('deflate')) out = zlib.inflateSync(buf);
  } catch {
    out = buf;
  }

  if (out.length > MAX_RESPONSE_BYTES) throw new Error('Too big');
  return out.toString('utf8');
}

function extractLinks(html, { limit = 200 } = {}) {
  const urls = new Set();
  const hrefRgx = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRgx.exec(html)) !== null) {
    const raw = match[1];
    if (!raw || raw.startsWith('#') || raw.length < 5) continue;
    if (raw.startsWith('mailto:') || raw.startsWith('javascript:')) continue;

    const url = raw.startsWith('http') ? raw : `${MEIO_NEWS_BASE}${raw}`;
    if (!url.startsWith(MEIO_NEWS_BASE)) continue;

    const cleanUrl = url.split('#')[0].split('?')[0];
    const path = cleanUrl.replace(MEIO_NEWS_BASE, '');
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) continue;

    urls.add(cleanUrl);
    if (urls.size >= limit) break;
  }
  return Array.from(urls);
}

async function main() {
  const url = process.argv[2] ? String(process.argv[2]) : MEIO_NEWS_BASE;
  const target = url.startsWith('http') ? url : `${MEIO_NEWS_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
  const html = await fetchBody(target);
  const links = extractLinks(html, { limit: 200 });
  const sample = links.slice(0, 80);

  const lower = html.toLowerCase();
  const signals = [
    '/api/',
    '__next_data__',
    'window.__nuxt__',
    'nuxt',
    'graphql',
    'wp-json',
    'rss',
  ];
  const found = {};
  for (const s of signals) found[s] = lower.includes(s);

  // Try to extract an embedded JSON blob (common in SSR apps).
  const nextDataMatch = html.match(/<script[^>]+id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/i);
  const nextDataLen = nextDataMatch && nextDataMatch[1] ? nextDataMatch[1].length : 0;

  console.log(JSON.stringify({ target, total: links.length, sample, found, nextDataLen }, null, 2));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
