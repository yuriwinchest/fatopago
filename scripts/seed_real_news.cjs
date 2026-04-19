
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Using standard high-quality images from Unsplash or other sources that represent the topics
const REAL_NEWS = [
    {
        content: {
            title: 'Lula fora da assinatura do acordo Mercosul-UE; UE busca terras raras no Brasil',
            description: 'Apesar de reunião com presidente da Comissão Europeia, Lula não participará do ato oficial. Bloco europeu negocia acesso a minerais estratégicos.',
            source: 'G1 / Globo',
            category: 'Política',
            difficulty: 'medium',
            reward: 0.75,
            image_url: 'https://images.unsplash.com/photo-1555848962-6e7d1ca62a9e?q=80&w=800&auto=format&fit=crop' // Generic European Union / Politics
        },
        consensus_reached: false
    },
    {
        content: {
            title: 'Temporal em SP: Bombeiros buscam desaparecidos na Zona Sul',
            description: 'Fortes chuvas causaram enxurradas que arrastaram carros. Buscas concentram-se em áreas impactadas pela força das águas em Capão Redondo.',
            source: 'G1',
            category: 'Brasil',
            difficulty: 'easy',
            reward: 0.50,
            image_url: 'https://images.unsplash.com/photo-1514632595-4944383f27f4?q=80&w=800&auto=format&fit=crop' // Rain/Flood generic
        },
        consensus_reached: false
    },
    {
        content: {
            title: 'DNA confirma identidade de corpo de capoeirista do DF',
            description: 'Exame forense confirmou que corpo carbonizado encontrado em veículo pertence ao capoeirista desaparecido em Brasília.',
            source: 'G1',
            category: 'Brasil',
            difficulty: 'medium',
            reward: 0.60,
            image_url: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?q=80&w=800&auto=format&fit=crop' // Police/Investigation generic
        },
        consensus_reached: false
    },
    {
        content: {
            title: 'STF prorroga inquérito sobre compra do Banco Master pelo BRB',
            description: 'Ministro Dias Toffoli estendeu investigações por mais 60 dias para apurar irregularidades na aquisição financeira.',
            source: 'UOL / Estadão',
            category: 'Economia',
            difficulty: 'hard',
            reward: 1.20,
            image_url: 'https://images.unsplash.com/photo-1526304640155-246e6965326c?q=80&w=800&auto=format&fit=crop' // Finance/Money
        },
        consensus_reached: false
    },
    {
        content: {
            title: 'Matheus Pereira é o novo reforço do Corinthians',
            description: 'Clube paulista oficializou a contratação do meio-campista para a temporada, visando reforçar o elenco no campeonato.',
            source: 'UOL Esporte',
            category: 'Esportes',
            difficulty: 'easy',
            reward: 0.40,
            image_url: 'https://images.unsplash.com/photo-1628779238951-bd5c9e7adb0e?q=80&w=800&auto=format&fit=crop' // Soccer stadium generic (Arena Corinthians style)
        },
        consensus_reached: false
    },
    {
        content: {
            title: 'Luciana Gimenez deixa a RedeTV! após 25 anos',
            description: 'Apresentadora encerra ciclo histórico na emissora onde comandou programas de grande audiência como Superpop.',
            source: 'UOL Entretenimento',
            category: 'Entretenimento',
            difficulty: 'easy',
            reward: 0.30,
            image_url: 'https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=800&auto=format&fit=crop' // TV Studio/Microphone
        },
        consensus_reached: false
    },
    {
        content: {
            title: 'INSS e o consignado em nome de crianças: R$ 12 bi liberados',
            description: 'Levantamento aponta volume expressivo de empréstimos consignados vinculados a benefícios de menores de idade.',
            source: 'UOL Economia',
            category: 'Economia',
            difficulty: 'medium',
            reward: 0.80,
            image_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=800&auto=format&fit=crop' // Banking/Contracts
        },
        consensus_reached: false
    }
];

async function seed() {
    console.log("Cleaning old tasks...");
    // 1. Delete all existing tasks to avoid duplicates
    const { error: deleteError } = await supabase.from('news_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (deleteError) console.error("Error deleting old tasks:", deleteError);

    console.log("Seeding real news with images...");
    const tasks = REAL_NEWS.map(news => ({
        ...news,
        created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
        .from('news_tasks')
        .insert(tasks)
        .select();

    if (error) {
        console.error("Error inserting news:", error);
    } else {
        console.log(`Successfully inserted ${data.length} news items with images.`);
    }
}

seed();
