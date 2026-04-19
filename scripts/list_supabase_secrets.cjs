
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkEdgeFunctionSecrets() {
    const projectRef = 'raxjzfvunjxqbxswuipp';
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

    if (!accessToken) {
        console.error('SUPABASE_ACCESS_TOKEN not found in .env.local');
        return;
    }

    console.log(`Listing Secrets for project ${projectRef}...`);
    
    try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/secrets`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        const secrets = await response.json();
        console.log('--- EDGE FUNCTION SECRETS (NAMES ONLY) ---');
        console.log(JSON.stringify(secrets.map(s => s.name), null, 2));
    } catch (err) {
        console.error('Failed to list secrets:', err.message);
    }
}

checkEdgeFunctionSecrets();
