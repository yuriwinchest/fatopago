
const { ingestOnce } = require('./news_ingest.cjs');

async function main() {
    console.log("Fetching live news (one-off)...");
    const res = await ingestOnce({ perFeedLimit: 20 });
    console.log(`Done. inserted=${res.inserted} fetched=${res.fetched} durationMs=${res.durationMs}`);
}

main().catch((err) => {
    console.error('Fetch failed:', err?.message || err);
    process.exit(1);
});
