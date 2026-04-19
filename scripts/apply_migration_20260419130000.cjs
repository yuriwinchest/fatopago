// Aplica a migration 20260419130000_get_pending_news_tasks_rpc.sql em transação
// e imediatamente testa a nova função contra a consulta legada para confirmar
// paridade (mesmo conjunto de IDs para mesmo usuário/categoria).
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const MIGRATION = path.resolve(__dirname, '..', 'supabase', 'migrations', '20260419130000_get_pending_news_tasks_rpc.sql');

const PG_HOST = 'aws-1-us-east-1.pooler.supabase.com';
const PG_PORT = 6543;
const PG_USER = 'postgres.raxjzfvunjxqbxswuipp';
const PG_PASS = process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD;

if (!PG_PASS) { console.error('Missing SUPABASE_DB_PASSWORD in .env.local'); process.exit(1); }

async function main() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const client = new Client({
    host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASS,
    database: 'postgres', ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    console.log('[apply] rodando migration em transação...');
    await client.query(sql);

    // Teste 1: função existe e retorna estrutura esperada
    const fn = await client.query(`
      SELECT proname, pg_get_function_identity_arguments(oid) AS args
      FROM pg_proc WHERE proname = 'get_pending_news_tasks'
    `);
    console.log('[check] função registrada:', fn.rows);

    // Teste 2: GRANT correto
    const grant = await client.query(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_name = 'get_pending_news_tasks'
    `);
    console.log('[check] grants:', grant.rows);

    // Teste 3: paridade — para um user qualquer com validações, conferir que
    // o count da RPC casa com a query legada equivalente.
    const probe = await client.query(`
      SELECT user_id, plan_purchase_id, COUNT(*) AS n
      FROM public.validations
      WHERE plan_purchase_id IS NOT NULL
      GROUP BY user_id, plan_purchase_id
      HAVING COUNT(*) >= 10
      ORDER BY n DESC
      LIMIT 1
    `);

    if (probe.rowCount > 0) {
      const { user_id, plan_purchase_id, n } = probe.rows[0];
      console.log(`[parity] testando com user=${user_id.slice(0,8)}... plan=${plan_purchase_id.slice(0,8)}... (${n} validações)`);

      // Simula auth.uid() via SET LOCAL para escopo da transação
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [user_id]);
      await client.query(`SELECT set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`, [user_id]);
      await client.query(`SET LOCAL ROLE authenticated`);

      // Chama a RPC nova (usa o cap interno da função, que é 100)
      const LIMIT = 100;
      const rpcRows = await client.query(
        `SELECT id FROM public.get_pending_news_tasks('Todas'::text, $1::uuid, NULL::timestamptz, $2, 0)`,
        [plan_purchase_id, LIMIT]
      );

      await client.query('RESET ROLE');

      // Query legada equivalente (mesmo filtros, mesmo LIMIT)
      const legacyRows = await client.query(`
        SELECT nt.id
        FROM public.news_tasks nt
        WHERE nt.is_admin_post = true
          AND nt.consensus_reached = false
          AND nt.consensus_status = 'open'
          AND nt.id NOT IN (
              SELECT v.task_id FROM public.validations v
              WHERE v.user_id = $1 AND v.plan_purchase_id = $2
          )
        ORDER BY nt.admin_priority ASC NULLS LAST, nt.created_at DESC
        LIMIT $3
      `, [user_id, plan_purchase_id, LIMIT]);

      const rpcIds = new Set(rpcRows.rows.map(r => r.id));
      const legacyIds = new Set(legacyRows.rows.map(r => r.id));
      const onlyRpc = [...rpcIds].filter(x => !legacyIds.has(x));
      const onlyLegacy = [...legacyIds].filter(x => !rpcIds.has(x));

      console.log(`[parity] RPC retornou ${rpcIds.size} IDs, legado retornou ${legacyIds.size}`);
      console.log(`[parity] diff: +${onlyRpc.length} na RPC / +${onlyLegacy.length} no legado`);

      if (onlyRpc.length === 0 && onlyLegacy.length === 0 && rpcIds.size > 0) {
        console.log('[parity] ✅ paridade OK — mesmo conjunto de IDs');
      } else if (rpcIds.size === 0 && legacyIds.size === 0) {
        console.log('[parity] ⚠ ambos vazios — probe não validativo');
      } else {
        console.error('[parity] ❌ divergência — abortando commit');
        throw new Error('RPC divergiu da query legada');
      }
    } else {
      console.log('[parity] ⚠ nenhum user com ≥10 validações em plano ativo — paridade não verificada');
    }

    await client.query('COMMIT');
    console.log('[done] migration aplicada e COMMITada');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[fail] ROLLBACK:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
