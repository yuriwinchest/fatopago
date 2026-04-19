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

  // 1. Void all manual_review tasks with 0 votes (no user impact)
  console.log('=== VOIDING MANUAL_REVIEW TASKS COM 0 VOTOS ===');
  const { rows: voided } = await client.query(`
    UPDATE news_tasks nt
    SET
      consensus_status = 'voided',
      consensus_reached = true,
      manual_resolved_at = NOW(),
      manual_resolution_note = 'Auto-voided: 0 votes received during review window',
      manual_resolution_kind = 'voided_no_votes'
    WHERE nt.consensus_status = 'manual_review'
    AND NOT EXISTS (
      SELECT 1 FROM validations v WHERE v.task_id = nt.id
    )
    RETURNING nt.id
  `);
  console.log(`Voided ${voided.length} tasks with 0 votes\n`);

  // 2. Check remaining manual_review tasks (have votes)
  console.log('=== REMAINING MANUAL_REVIEW (com votos) ===');
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
  console.log(`Remaining: ${remaining.length}`);
  remaining.forEach(r => console.log(`  votes=${r.votes} (T=${r.true_votes} F=${r.false_votes}) | cycle#${r.cycle_number} | ${r.title?.substring(0,60)}`));

  // 3. Auto-settle remaining based on majority vote (they had votes but not enough for 70%)
  // For 1-4 vote tasks, use simple majority
  if (remaining.length > 0) {
    console.log('\n=== AUTO-SETTLING REMAINING BY MAJORITY ===');
    for (const r of remaining) {
      const verdict = Number(r.true_votes) >= Number(r.false_votes); // majority wins
      const { rows: settled } = await client.query(`
        SELECT public.admin_force_settle_news_task(
          $1::uuid,
          $2::boolean,
          $3::text
        ) as result
      `, [r.id, verdict, `Auto-settled by majority: ${r.true_votes}T/${r.false_votes}F`]);
      console.log(`  ${r.title?.substring(0,50)} -> verdict=${verdict} | ${JSON.stringify(settled[0]?.result)}`);
    }
  }

  // 4. Final status check
  console.log('\n=== STATUS FINAL ===');
  const { rows: final } = await client.query(`
    SELECT consensus_status, COUNT(*) as cnt
    FROM news_tasks
    GROUP BY consensus_status
    ORDER BY cnt DESC
  `);
  final.forEach(r => console.log(`  ${r.consensus_status}: ${r.cnt}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
