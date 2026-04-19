const { ingestOnce } = require('./news_ingest.cjs');

const INTERVAL_MS = Number(process.env.NEWS_POLL_INTERVAL_MS || 60_000);
// [2026-04-15] Default elevado de 20 para 80. Mantem override por env no PM2 (.env).
const PER_FEED_LIMIT = Number(process.env.NEWS_PER_FEED_LIMIT || 80);

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const res = await ingestOnce({ perFeedLimit: PER_FEED_LIMIT });
    // eslint-disable-next-line no-console
    console.log(
      `[news] tick ok: inserted=${res.inserted} fetched=${res.fetched} durationMs=${res.durationMs}`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[news] tick fail:', err?.message || err);
  } finally {
    running = false;
  }
}

// Run immediately, then every minute
tick();
setInterval(tick, INTERVAL_MS);

