const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // Get profiles with null CPF (skip deleted accounts)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, name, cpf, birth_date, affiliate_code')
    .is('cpf', null)
    .not('email', 'like', 'deleted+%');

  console.log(`Profiles ativos com CPF null: ${profiles.length}\n`);

  let fixed = 0;
  let skipped = 0;

  for (const p of profiles) {
    const { data: authUser } = await admin.auth.admin.getUserById(p.id);
    const meta = authUser?.user?.user_metadata || {};

    if (!meta.cpf) {
      skipped++;
      continue;
    }

    // Build update object — only sync fields that are null in profile but present in auth
    const updates = {};
    if (!p.cpf && meta.cpf) updates.cpf = meta.cpf.replace(/\D/g, ''); // normalize to digits
    if (!p.birth_date && meta.birth_date) updates.birth_date = meta.birth_date;
    if (!p.affiliate_code && meta.affiliate_code) updates.affiliate_code = meta.affiliate_code;
    // Don't overwrite name if profile already has one — Giovana case was already fixed manually
    if ((!p.name || p.name === 'Usuário') && meta.name) updates.name = meta.name;

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    const { error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', p.id);

    if (error) {
      console.error(`ERRO ${p.email}:`, error.message);
    } else {
      console.log(`OK: ${p.email} -> ${JSON.stringify(updates)}`);
      fixed++;
    }
  }

  console.log(`\n--- RESULTADO ---`);
  console.log(`Fixados: ${fixed}`);
  console.log(`Pulados (sem CPF no auth): ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
