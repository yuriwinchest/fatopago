
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixCollaboratorRpc() {
  const projectRef = 'raxjzfvunjxqbxswuipp';
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('SUPABASE_ACCESS_TOKEN missing in .env.local');
    return;
  }

  const sqlPath = path.join(__dirname, '../supabase/migrations/20260404144500_collaborator_management.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found at:', sqlPath);
    return;
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log(`Applying migration to project ${projectRef}...`);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: sql
        })
    });
    
    if (response.ok) {
        console.log('Migration applied successfully via Supabase API!');
        // Reload Schema Cache
        console.log('Reloading schema cache...');
        await fetch(`https://raxjzfvunjxqbxswuipp.supabase.co/rest/v1/`, {
            method: 'GET',
            headers: {
                'apikey': process.env.VITE_SUPABASE_ANON_KEY || '',
                'x-client-info': 'supabase-js/2.39.0'
            }
        });
        console.log('Done!');
    } else {
        const errJson = await response.json().catch(() => ({}));
        console.error('Failed to apply migration:', response.status, errJson);
    }
  } catch (err) {
    console.error('Network error:', err.message);
  }
}

fixCollaboratorRpc();
