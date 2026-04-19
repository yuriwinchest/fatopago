const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. Void all manual_review tasks with 0 votes
  console.log('=== VOIDING MANUAL_REVIEW COM 0 VOTOS ===');
  const { rows: voided } = await client.query(`
    UPDATE news_tasks nt
    SET
      consensus_status = 'voided',
      consensus_reached = true,
      manual_resolved_at = NOW(),
      manual_resolution_note = 'Auto-voided: nenhum voto recebido',
      manual_resolution_kind = 'void_compensation',
      manual_resolution_compensated_user_count = 0,
      manual_resolution_compensated_credit = 0,
      manual_resolution_skipped_vote_count = 0
    WHERE nt.consensus_status = 'manual_review'
    AND NOT EXISTS (
      SELECT 1 FROM validations v WHERE v.task_id = nt.id
    )
    RETURNING nt.id
  `);
  console.log(`Voided: ${voided.length} tasks\n`);

  // 2. Check remaining manual_review (with votes)
  const { rows: remaining } = await client.query(`
    SELECT
      nt.id,
      nt.content->>'title' as title,
      nt.cycle_number,
      COUNT(v.id) as votes,
      SUM(CASE WHEN v.verdict THEN 1 ELSE 0 END) as true_votes,
      SUM(CASE WHEN NOT v.verdict THEN 1 ELSE 0 END) as false_votes
    FROM news_tasks nt
    JOIN validations v ON v.task_id = nt.id
    WHERE nt.consensus_status = 'manual_review'
    GROUP BY nt.id
    ORDER BY COUNT(v.id) DESC
  `);
  console.log(`Remaining manual_review with votes: ${remaining.length}`);
  remaining.forEach(r => console.log(`  votes=${r.votes} (T=${r.true_votes} F=${r.false_votes}) | ${r.title?.substring(0,60)}`));

  // 3. Void these too — with compensation for voters (they only have 1 vote each, not enough for settlement)
  if (remaining.length > 0) {
    console.log('\n=== VOIDING REMAINING WITH VOTER COMPENSATION ===');
    for (const r of remaining) {
      // Give compensatory credit to voters since the task is being voided
      const { rowCount: compensated } = await client.query(`
        UPDATE profiles p
        SET compensatory_credit_balance = COALESCE(compensatory_credit_balance, 0) + 1.00,
            updated_at = NOW()
        FROM validations v
        WHERE v.task_id = $1 AND v.user_id = p.id
      `, [r.id]);

      await client.query(`
        UPDATE news_tasks SET
          consensus_status = 'voided',
          consensus_reached = true,
          manual_resolved_at = NOW(),
          manual_resolution_note = 'Auto-voided: insufficient votes for consensus. Voters compensated.',
          manual_resolution_kind = 'void_compensation',
          manual_resolution_compensated_user_count = $2,
          manual_resolution_compensated_credit = $2,
          manual_resolution_skipped_vote_count = 0
        WHERE id = $1
      `, [r.id, compensated]);

      console.log(`  Voided: ${r.title?.substring(0,50)} | compensated ${compensated} voters`);
    }
  }

  // 4. Final status
  console.log('\n=== STATUS FINAL ===');
  const { rows: final } = await client.query(`
    SELECT consensus_status, COUNT(*) as cnt
    FROM news_tasks GROUP BY consensus_status ORDER BY cnt DESC
  `);
  final.forEach(r => console.log(`  ${r.consensus_status}: ${r.cnt}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
