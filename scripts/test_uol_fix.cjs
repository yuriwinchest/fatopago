// Valida a correcao de UOL: charset ISO-8859-1 + fallback regex simpleParseRssItems.
// Reproduz a mesma logica de fetchText/fetchFeedXml + fallback do news_ingest.cjs.
const Parser = require('rss-parser');
const zlib = require('zlib');

const parser = new Parser({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

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
    const description = (chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1] || '';
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

async function fetchText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const enc = (res.headers.get('content-encoding') || '').toLowerCase();
    const contentType = res.headers.get('content-type') || '';
    let outBuf = buf;
    try {
      if (enc.includes('br')) outBuf = zlib.brotliDecompressSync(buf);
      else if (enc.includes('gzip')) outBuf = zlib.gunzipSync(buf);
      else if (enc.includes('deflate')) outBuf = zlib.inflateSync(buf);
      else if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) outBuf = zlib.gunzipSync(buf);
    } catch {}
    // 1. Header
    let isLatin1 = /charset\s*=\s*(iso-8859-1|latin1)/i.test(contentType);
    // 2. Fallback: XML prolog sniff
    if (!isLatin1) {
      const sniffHead = outBuf.slice(0, 200).toString('ascii');
      if (/<\?xml[^>]*encoding\s*=\s*["'](iso-8859-1|latin1)["']/i.test(sniffHead)) {
        isLatin1 = true;
      }
    }
    return { text: outBuf.toString(isLatin1 ? 'latin1' : 'utf8'), isLatin1, contentType };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function testOne(url) {
  console.log(`\n--- ${url} ---`);
  const { text, isLatin1, contentType } = await fetchText(url);
  console.log(`Content-Type: ${contentType}`);
  console.log(`Decoded as: ${isLatin1 ? 'latin1' : 'utf8'}`);
  console.log(`Prolog: ${text.substring(0, 80).replace(/\s+/g, ' ')}`);

  let items = [];
  let path = 'parser';
  try {
    const parsed = await parser.parseString(text);
    items = Array.isArray(parsed?.items) ? parsed.items : [];
  } catch (e) {
    path = `fallback (rss-parser falhou: ${e.message})`;
    items = simpleParseRssItems(text);
  }
  console.log(`Path: ${path}`);
  console.log(`Items encontrados: ${items.length}`);
  if (items[0]) {
    console.log(`Sample title: "${items[0].title}"`);
    console.log(`Sample link:  ${items[0].link}`);
  }
}

async function main() {
  const urls = [
    'https://rss.uol.com.br/feed/economia.xml',
    'https://rss.uol.com.br/feed/noticias.xml',
    'https://rss.uol.com.br/feed/esporte.xml',
    'https://rss.uol.com.br/feed/cinema.xml',
  ];
  for (const u of urls) {
    try { await testOne(u); } catch (e) { console.error(`FAIL ${u}: ${e.message}`); }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
