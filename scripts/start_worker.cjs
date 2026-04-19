const fs = require('fs');
const path = require('path');
// Load .env manually (no dotenv dependency needed)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0 && !line.startsWith('#')) {
      const key = line.substring(0, eqIdx).trim();
      let val = line.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
require('./scripts/live_news_worker.cjs');
