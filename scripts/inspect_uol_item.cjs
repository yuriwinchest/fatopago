// Mostra o primeiro <item> bruto do UOL para ver a estrutura.
const zlib = require('zlib');

async function fetchLatin1(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept-Encoding': 'gzip, deflate, br',
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const enc = (res.headers.get('content-encoding') || '').toLowerCase();
  let out = buf;
  try {
    if (enc.includes('br')) out = zlib.brotliDecompressSync(buf);
    else if (enc.includes('gzip')) out = zlib.gunzipSync(buf);
    else if (enc.includes('deflate')) out = zlib.inflateSync(buf);
    else if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) out = zlib.gunzipSync(buf);
  } catch (e) { /* ignore; use raw */ }
  return out.toString('latin1');
}

async function main() {
  const text = await fetchLatin1('https://rss.uol.com.br/feed/economia.xml');
  const firstItem = text.match(/<item>[\s\S]*?<\/item>/i);
  console.log('---PRIMEIRO ITEM---');
  console.log(firstItem ? firstItem[0].substring(0, 1200) : 'NAO ENCONTROU <item>');
  console.log('\n---HEAD DO XML (500)---');
  console.log(text.substring(0, 500));
}
main();
