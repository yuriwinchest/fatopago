// Testa cada feed RSS para verificar quais estão retornando itens
const Parser = require('rss-parser');
const zlib = require('zlib');

const parser = new Parser({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

const FEEDS = [
  // G1 (Globo)
  { url: 'https://g1.globo.com/rss/g1/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/politica/', category: 'Política', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/economia/', category: 'Economia', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/mundo/', category: 'Internacional', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/tecnologia/', category: 'Entretenimento', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/ciencia-e-saude/', category: 'Brasil', source: 'G1' },
  { url: 'https://g1.globo.com/rss/g1/educacao/', category: 'Brasil', source: 'G1' },
  // CNN Brasil
  { url: 'https://www.cnnbrasil.com.br/feed/', category: 'Brasil', source: 'CNN Brasil' },
  // UOL
  { url: 'https://rss.uol.com.br/feed/economia.xml', category: 'Economia', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/noticias.xml', category: 'Política', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/esporte.xml', category: 'Esportes', source: 'UOL' },
  { url: 'https://rss.uol.com.br/feed/cinema.xml', category: 'Entretenimento', source: 'UOL' },
  // Jovem Pan
  { url: 'https://jovempan.com.br/feed', category: 'Brasil', source: 'Jovem Pan' },
];

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
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    const enc = (res.headers.get('content-encoding') || '').toLowerCase();
    let out = buf;
    try {
      if (enc.includes('br')) out = zlib.brotliDecompressSync(buf);
      else if (enc.includes('gzip')) out = zlib.gunzipSync(buf);
      else if (enc.includes('deflate')) out = zlib.inflateSync(buf);
      else if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) out = zlib.gunzipSync(buf);
    } catch {}
    return { text: out.toString('utf8'), status: res.status };
  } catch (e) {
    clearTimeout(timeoutId);
    return { error: e.message };
  }
}

async function main() {
  for (const feed of FEEDS) {
    const { text, error, status } = await fetchText(feed.url);
    if (error) {
      console.log(`[FAIL] ${feed.source} ${feed.url}\n  -> ${error}`);
      continue;
    }
    try {
      const parsed = await parser.parseString(text);
      const n = (parsed.items || []).length;
      const first = parsed.items?.[0];
      console.log(`[OK ${status}] ${feed.source} (${feed.category}) ${feed.url}`);
      console.log(`   items=${n} | sample="${(first?.title || '').substring(0, 60)}" | pub=${first?.pubDate || '?'}`);
    } catch (e) {
      console.log(`[PARSE-FAIL] ${feed.source} ${feed.url}\n  -> ${e.message}\n  head=${text.substring(0, 120).replace(/\s+/g,' ')}`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
