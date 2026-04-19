
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function checkAuthConfig() {
    const projectRef = 'raxjzfvunjxqbxswuipp';
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

    if (!accessToken) {
        console.error('SUPABASE_ACCESS_TOKEN not found in .env.local');
        return;
    }

    console.log(`Checking Auth Config for project ${projectRef}...`);
    
    try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP ${response.status}: ${err}`);
        }

        const config = await response.json();
        console.log('--- AUTH CONFIG ---');
        console.log(JSON.stringify(config, null, 2));
    } catch (err) {
        console.error('Failed to get auth config:', err.message);
    }
}

checkAuthConfig();
