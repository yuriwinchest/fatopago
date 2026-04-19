/**
 * Atualiza URLs de imagens/midia no banco do Fato Pago
 * Troca https://raxjzfvunjxqbxswuipp.supabase.co por https://fatopago.com/supabase
 *
 * Descobre automaticamente TODAS as colunas text/varchar do schema public que
 * tenham a URL antiga. Executa em transacao unica (COMMIT atomico, ROLLBACK em erro).
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const OLD_URL = 'https://raxjzfvunjxqbxswuipp.supabase.co';
const NEW_URL = 'https://fatopago.com/supabase';

async function main() {
    const client = new Client({
        host: 'aws-1-us-east-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.raxjzfvunjxqbxswuipp',
        password: process.env.SUPABASE_DB_PASSWORD,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        statement_timeout: 180000,
    });

    await client.connect();
    console.log('Conectado ao pooler.');
    console.log(`De:  ${OLD_URL}`);
    console.log(`Para: ${NEW_URL}`);
    console.log('');

    try {
        // 1) Descobrir colunas candidatas (text/varchar/jsonb/json no schema public)
        const colsRes = await client.query(`
            SELECT c.table_schema, c.table_name, c.column_name, c.data_type
            FROM information_schema.columns c
            JOIN information_schema.tables t
              ON t.table_schema = c.table_schema
             AND t.table_name = c.table_name
            WHERE c.table_schema = 'public'
              AND c.data_type IN ('text', 'character varying', 'jsonb', 'json')
              AND t.table_type = 'BASE TABLE'
            ORDER BY c.table_name, c.column_name
        `);

        console.log(`Varrendo ${colsRes.rows.length} colunas text/varchar/jsonb/json...`);

        // 2) Para cada coluna, checar se tem a URL antiga (contagem)
        // jsonb/json: precisa do cast ::text pra aplicar LIKE
        const affected = [];
        for (const col of colsRes.rows) {
            const isJson = col.data_type === 'jsonb' || col.data_type === 'json';
            const colExpr = isJson
                ? `${client.escapeIdentifier(col.column_name)}::text`
                : client.escapeIdentifier(col.column_name);
            const sql = `
                SELECT COUNT(*)::INT AS n
                FROM ${client.escapeIdentifier(col.table_schema)}.${client.escapeIdentifier(col.table_name)}
                WHERE ${colExpr} LIKE $1
            `;
            try {
                const r = await client.query(sql, [`%${OLD_URL}%`]);
                const n = r.rows[0].n;
                if (n > 0) {
                    affected.push({ ...col, count: n, isJson });
                }
            } catch (e) {
                // colunas de sistema podem falhar em algumas tabelas, ignora
                console.warn(`  skip ${col.table_name}.${col.column_name}: ${e.message}`);
            }
        }

        if (affected.length === 0) {
            console.log('\nNenhuma coluna tem a URL antiga. Banco ja limpo.');
            await client.end();
            return;
        }

        console.log('\n=== Colunas afetadas ===');
        let totalRows = 0;
        for (const a of affected) {
            console.log(`  ${a.table_name}.${a.column_name}: ${a.count} linhas`);
            totalRows += a.count;
        }
        console.log(`  Total: ${totalRows} linhas\n`);

        // 3) Executar UPDATE em transacao
        console.log('=== Executando UPDATEs em transacao ===');
        await client.query('BEGIN');

        const results = [];
        for (const a of affected) {
            const colIdent = client.escapeIdentifier(a.column_name);
            const tableIdent = `${client.escapeIdentifier(a.table_schema)}.${client.escapeIdentifier(a.table_name)}`;

            // Para jsonb/json: cast para text, replace, cast de volta
            // Para text/varchar: replace direto
            const sql = a.isJson
                ? `UPDATE ${tableIdent}
                   SET ${colIdent} = REPLACE(${colIdent}::text, $1, $2)::${a.data_type}
                   WHERE ${colIdent}::text LIKE $3`
                : `UPDATE ${tableIdent}
                   SET ${colIdent} = REPLACE(${colIdent}, $1, $2)
                   WHERE ${colIdent} LIKE $3`;

            const r = await client.query(sql, [OLD_URL, NEW_URL, `%${OLD_URL}%`]);
            console.log(`  ${a.table_name}.${a.column_name} (${a.data_type}): ${r.rowCount} atualizados`);
            results.push({ ...a, updated: r.rowCount });
        }

        await client.query('COMMIT');
        console.log('\nCOMMIT feito.');

        // 4) Verificar que nao sobrou nada
        console.log('\n=== Verificacao pos-COMMIT ===');
        let remaining = 0;
        for (const a of affected) {
            const colIdent = client.escapeIdentifier(a.column_name);
            const tableIdent = `${client.escapeIdentifier(a.table_schema)}.${client.escapeIdentifier(a.table_name)}`;
            const colExpr = a.isJson ? `${colIdent}::text` : colIdent;
            const r = await client.query(
                `SELECT COUNT(*)::INT AS n FROM ${tableIdent} WHERE ${colExpr} LIKE $1`,
                [`%${OLD_URL}%`]
            );
            if (r.rows[0].n > 0) {
                console.log(`  PENDENTE ${a.table_name}.${a.column_name}: ${r.rows[0].n} linhas`);
                remaining += r.rows[0].n;
            }
        }

        if (remaining === 0) {
            console.log('  OK: banco 100% limpo.');
        } else {
            console.log(`  ATENCAO: ${remaining} linhas ainda tem URL antiga (possivel insert durante execucao).`);
        }

        console.log('\n=== RESUMO ===');
        console.log(`Total atualizados: ${results.reduce((s, r) => s + r.updated, 0)}`);
        console.log(`Remanescentes: ${remaining}`);
    } catch (err) {
        console.error('\nERRO:', err.message);
        try { await client.query('ROLLBACK'); console.log('ROLLBACK executado.'); } catch {}
        process.exit(1);
    }

    await client.end();
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
