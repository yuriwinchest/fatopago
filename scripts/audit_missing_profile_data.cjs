const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // Get all profiles with null CPF
  const { data: nullCpfProfiles, error } = await admin
    .from('profiles')
    .select('id, email, name, cpf, birth_date, affiliate_code, created_at')
    .is('cpf', null)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }
  console.log(`Profiles com CPF null: ${nullCpfProfiles.length}\n`);

  let fixable = 0;
  let missingBoth = 0;

  for (const p of nullCpfProfiles) {
    const { data: authUser } = await admin.auth.admin.getUserById(p.id);
    const meta = authUser?.user?.user_metadata || {};
    const authCpf = meta.cpf || null;
    const authBirthDate = meta.birth_date || null;
    const authName = meta.name || null;
    const authAffiliate = meta.affiliate_code || null;

    if (authCpf) {
      fixable++;
      console.log(`FIXÁVEL: ${p.email} | profile.cpf=null | auth.cpf=${authCpf} | auth.name=${authName} | profile.name=${p.name} | auth.affiliate=${authAffiliate} | profile.affiliate=${p.affiliate_code}`);
    } else {
      missingBoth++;
    }
  }

  console.log(`\n--- RESUMO ---`);
  console.log(`CPF null no profile: ${nullCpfProfiles.length}`);
  console.log(`Fixáveis (tem CPF no auth metadata): ${fixable}`);
  console.log(`Sem CPF em nenhum lugar: ${missingBoth}`);

  // Also check birth_date null but present in auth
  const { data: nullBdProfiles } = await admin
    .from('profiles')
    .select('id')
    .is('birth_date', null);
  console.log(`\nProfiles com birth_date null: ${nullBdProfiles?.length || 0}`);
}

main().catch(e => { console.error(e); process.exit(1); });
