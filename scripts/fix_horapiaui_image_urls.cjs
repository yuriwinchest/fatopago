/**
 * Atualiza URLs de imagens/mídia no banco do horapiaui
 * Troca https://mkfkiefwltdepgheynco.supabase.co por https://horapiaui.com/supabase
 *
 * Afeta apenas linhas que tenham a URL antiga (nao toca em nada mais).
 * Executa via REST do Supabase usando service_role.
 */

const SUPABASE_URL = 'https://horapiaui.com/supabase';
const SERVICE_KEY = process.env.HORAPIAUI_SERVICE_KEY;
const OLD_URL = 'https://mkfkiefwltdepgheynco.supabase.co';
const NEW_URL = 'https://horapiaui.com/supabase';

if (!SERVICE_KEY) {
    console.error('Erro: HORAPIAUI_SERVICE_KEY nao definido');
    process.exit(1);
}

const TARGETS = [
    { table: 'horapiaui_news', column: 'image' },
    { table: 'horapiaui_news', column: 'author_avatar' },
    { table: 'horapiaui_news', column: 'content' },
    { table: 'horapiaui_videos', column: 'image' },
    { table: 'horapiaui_videos', column: 'thumbnail' },
    { table: 'horapiaui_profiles', column: 'avatar_url' }
];

const BATCH_SIZE = 100;

const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
};

async function fetchAffectedBatch(table, column, offset) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=id,${column}&${column}=ilike.*mkfkiefwltdepgheynco*&limit=${BATCH_SIZE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`GET ${table}.${column} falhou: ${res.status} ${await res.text()}`);
    }
    return await res.json();
}

async function patchRow(table, column, id, newValue) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ [column]: newValue })
    });
    if (!res.ok) {
        throw new Error(`PATCH ${table}.${column} id=${id} falhou: ${res.status} ${await res.text()}`);
    }
}

async function processTarget({ table, column }) {
    console.log(`\n=== ${table}.${column} ===`);
    let totalUpdated = 0;
    let totalErrors = 0;

    while (true) {
        // Sempre pega offset 0: como fazemos PATCH e removemos o match do filtro, a proxima query traz os que faltam
        const rows = await fetchAffectedBatch(table, column, 0);
        if (rows.length === 0) break;

        for (const row of rows) {
            const oldValue = row[column];
            if (typeof oldValue !== 'string') continue;
            const newValue = oldValue.split(OLD_URL).join(NEW_URL);

            try {
                await patchRow(table, column, row.id, newValue);
                totalUpdated++;
                if (totalUpdated % 50 === 0) {
                    process.stdout.write(`  ${totalUpdated} atualizados...\r`);
                }
            } catch (e) {
                totalErrors++;
                console.error(`\n  ERRO id=${row.id}: ${e.message}`);
                if (totalErrors > 5) {
                    console.error('  Muitos erros, abortando essa tabela');
                    return { updated: totalUpdated, errors: totalErrors };
                }
            }
        }
    }

    console.log(`  -> ${totalUpdated} linhas atualizadas, ${totalErrors} erros`);
    return { updated: totalUpdated, errors: totalErrors };
}

async function main() {
    console.log('Fix horapiaui image URLs');
    console.log(`De:  ${OLD_URL}`);
    console.log(`Para: ${NEW_URL}`);
    console.log('');

    let grandTotal = 0;
    let grandErrors = 0;

    for (const target of TARGETS) {
        const { updated, errors } = await processTarget(target);
        grandTotal += updated;
        grandErrors += errors;
    }

    console.log('');
    console.log('=== RESUMO ===');
    console.log(`Total atualizados: ${grandTotal}`);
    console.log(`Total erros: ${grandErrors}`);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
