// Reconcilia user_validation_cycle_stats do CICLO ATUAL com a verdade de public.validations.
// Nao mexe em ciclos passados.
// Passos:
//   1) Snapshot do stats atual (pra audit/log)
//   2) DELETE linhas do ciclo atual em user_validation_cycle_stats
//   3) INSERT a partir de rollup real em public.validations do ciclo atual
//   4) Verifica final
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const client = new Client({
        host: 'aws-1-us-east-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.raxjzfvunjxqbxswuipp',
        password: process.env.SUPABASE_DB_PASSWORD,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        statement_timeout: 120000,
    });
    await client.connect();

    const cyc = await client.query(`SELECT * FROM public.get_weekly_cycle_window(NOW(), 0)`);
    const cycle = cyc.rows[0];
    console.log('CICLO ALVO:', JSON.stringify(cycle));

    await client.query('BEGIN');
    try {
        // 1) snapshot antes
        const before = await client.query(`
            SELECT user_id, validations_count, last_validation_at
            FROM public.user_validation_cycle_stats
            WHERE cycle_start_at = $1
            ORDER BY validations_count DESC
        `, [cycle.cycle_start_at]);
        console.log(`\nANTES: ${before.rows.length} linhas em user_validation_cycle_stats (ciclo atual)`);

        // 2) DELETE apenas do ciclo atual
        const del = await client.query(`
            DELETE FROM public.user_validation_cycle_stats
            WHERE cycle_start_at = $1
            RETURNING user_id
        `, [cycle.cycle_start_at]);
        console.log(`DELETADAS: ${del.rowCount}`);

        // 3) INSERT recalculado a partir de public.validations (verdade)
        const ins = await client.query(`
            INSERT INTO public.user_validation_cycle_stats (
              user_id, cycle_start_at, cycle_end_at, validations_count, last_validation_at
            )
            SELECT
              v.user_id,
              $1::timestamptz AS cycle_start_at,
              $2::timestamptz AS cycle_end_at,
              COUNT(*)::int AS validations_count,
              MAX(v.created_at) AS last_validation_at
            FROM public.validations v
            WHERE v.user_id IS NOT NULL
              AND v.created_at >= $1::timestamptz
              AND v.created_at <  $2::timestamptz
            GROUP BY v.user_id
            RETURNING user_id, validations_count
        `, [cycle.cycle_start_at, cycle.cycle_end_at]);
        console.log(`INSERIDAS: ${ins.rowCount}`);

        // 4) Verifica diff antes vs depois
        const after = await client.query(`
            SELECT
              p.name, p.lastname,
              s.validations_count AS rank_count
            FROM public.user_validation_cycle_stats s
            JOIN public.profiles p ON p.id = s.user_id
            WHERE s.cycle_start_at = $1
            ORDER BY s.validations_count DESC
            LIMIT 30
        `, [cycle.cycle_start_at]);
        console.log('\nDEPOIS (top 30):');
        after.rows.forEach((r, i) => {
            console.log(`  #${i+1} ${r.name || ''} ${r.lastname || ''} => ${r.rank_count}`);
        });

        await client.query('COMMIT');
        console.log('\nCOMMIT OK.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ROLLBACK. Erro:', e.message || e);
        process.exit(1);
    }

    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
