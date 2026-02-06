
const https = require('https');

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef) throw new Error('SUPABASE_PROJECT_REF environment variable is required');
const pat = process.env.SUPABASE_ACCESS_TOKEN;

if (!pat) {
    throw new Error('Defina SUPABASE_ACCESS_TOKEN no ambiente.');
}

const news = [
    {
        title: "Bitcoin atinge nova máxima histórica de US$ 75.000",
        description: "A criptomoeda impulsionada pela aprovação de ETFs nos EUA supera recordes anteriores e atrai novos investidores institucionais.",
        reward: 5.00,
        category: "Economia",
        source: "CoinDesk",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Descoberta nova espécie de dinossauro no interior de SP",
        description: "Paleontólogos encontraram fósseis preservados de um pequeno predador que viveu há 80 milhões de anos na região de Marília.",
        reward: 6.00,
        category: "Ciência",
        source: "G1 Ciência",
        difficulty: "Difícil",
        image_url: "https://images.unsplash.com/photo-1519810755548-392116d9a609?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Flamengo anuncia contratação de craque europeu",
        description: "O time carioca confirmou a chegada do meio-campista francês para reforçar o elenco na Libertadores.",
        reward: 3.50,
        category: "Esportes",
        source: "Globo Esporte",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Governo Federal lança programa 'Internet para Todos'",
        description: "Iniciativa visa levar conexão de fibra óptica para 98% dos municípios brasileiros até 2026.",
        reward: 4.50,
        category: "Política",
        source: "Agência Brasil",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1544197150-b99a580bbcbf?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Tesla CyberTruck começa a ser vendida no Brasil por importação",
        description: "O polêmico veículo elétrico de Elon Musk chega ao país com preços que podem ultrapassar R$ 1 milhão.",
        reward: 4.00,
        category: "Tecnologia",
        source: "AutoEsporte",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1698547464307-2c93fa723f81?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Onda de calor extremo atinge o Sul da Europa",
        description: "Temperaturas acima de 45°C são registradas na Espanha e Itália, alertando para as mudanças climáticas.",
        reward: 4.00,
        category: "Internacional",
        source: "BBC News",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1504370805625-d32c54b16100?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Nova temporada de 'Stranger Things' quebra recordes de audiência",
        description: "Série da Netflix se torna a mais assistida da história da plataforma em sua semana de estreia.",
        reward: 3.00,
        category: "Entretenimento",
        source: "Omelete",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Estudo revela que café pode reduzir risco de Alzheimer",
        description: "Pesquisa de longo prazo com 10 mil participantes mostra correlação positiva entre consumo moderado e saúde cerebral.",
        reward: 5.50,
        category: "Saúde",
        source: "Veja Saúde",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Neymar sofre lesão e está fora da Copa América",
        description: "Atacante brasileiro precisará de cirurgia no joelho e só deve retornar aos gramados em 6 meses.",
        reward: 3.50,
        category: "Esportes",
        source: "UOL Esporte",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1551958219-acbc608c6377?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "PIX bate recorde de transações diárias: 150 milhões",
        description: "Sistema de pagamentos instantâneos do Banco Central se consolida como o meio preferido dos brasileiros.",
        reward: 5.00,
        category: "Economia",
        source: "Valor Investe",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "NASA confirma missão tripulada para Marte em 2035",
        description: "Agência espacial americana detalha cronograma para levar os primeiros humanos ao planeta vermelho.",
        reward: 7.00,
        category: "Ciência",
        source: "Space Today",
        difficulty: "Difícil",
        image_url: "https://images.unsplash.com/photo-1614728853913-1e2203d9d27f?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Taylor Swift anuncia shows extras no Brasil",
        description: "Devido à alta demanda, a cantora pop fará mais duas apresentações no Allianz Parque em Dezembro.",
        reward: 3.00,
        category: "Entretenimento",
        source: "Papelpop",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Reforma Tributária é aprovada no Senado",
        description: "Texto base passa com 53 votos a favor e promete simplificar o sistema de impostos brasileiro.",
        reward: 6.00,
        category: "Política",
        source: "G1 Política",
        difficulty: "Difícil",
        image_url: "https://images.unsplash.com/photo-1555848962-6e79363ec58f?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Sony revela PlayStation 5 Pro com gráficos em 8K",
        description: "Console de meia geração traz melhorias significativas de desempenho e ray tracing avançado.",
        reward: 4.50,
        category: "Tecnologia",
        source: "IGN Brasil",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Brasil reduz taxa de desemprego para 7,5%",
        description: "Índice é o menor para o trimestre desde 2015, indicando aquecimento do mercado de trabalho formal.",
        reward: 5.00,
        category: "Economia",
        source: "IBGE",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Novo trem bala ligará Rio e SP em 90 minutos",
        description: "Consórcio internacional vence licitação para construir a ferrovia de alta velocidade até 2030.",
        reward: 5.50,
        category: "Brasil",
        source: "Folha SP",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Inteligência Artificial vence campeão mundial de Xadrez",
        description: "Novo algoritmo desenvolvido pela DeepMind supera Magnnus Carlsen em série de partidas históricas.",
        reward: 6.50,
        category: "Tecnologia",
        source: "Wired",
        difficulty: "Difícil",
        image_url: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Anitta ganha prêmio VMA de Melhor Clipe Latino",
        description: "Cantora brasileira faz história novamente ao levar o troféu pelo segundo ano consecutivo.",
        reward: 3.50,
        category: "Entretenimento",
        source: "Hugo Gloss",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1516280440614-6697288d5d38?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Descoberta de água na Lua facilita futuras colônias",
        description: "Sonda indiana confirma presença de gelo nos polos lunares, essencial para sustentabilidade humana.",
        reward: 7.00,
        category: "Espaço",
        source: "Nature Astronomy",
        difficulty: "Difícil",
        image_url: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Brasileirão: Botafogo dispara na liderança",
        description: "Time carioca vence clássico e abre 10 pontos de vantagem sobre o segundo colocado.",
        reward: 4.00,
        category: "Esportes",
        source: "Lance!",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Governo zera imposto de importação para remédios",
        description: "Medida beneficia pacientes que dependem de medicamentos de alto custo não produzidos no Brasil.",
        reward: 5.00,
        category: "Saúde",
        source: "Ministério da Saúde",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Twitter muda de nome para 'X' oficialmente",
        description: "Elon Musk concretiza rebranding da rede social, abandonando o icônico pássaro azul.",
        reward: 3.00,
        category: "Tecnologia",
        source: "The Verge",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1611605698389-eb4f915db159?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Copa do Mundo de 2030 será em 6 países",
        description: "FIFA anuncia formato inédito com jogos na América do Sul, Europa e África para celebrar o centenário.",
        reward: 4.50,
        category: "Esportes",
        source: "FIFA.com",
        difficulty: "Média",
        image_url: "https://images.unsplash.com/photo-1522778119026-d647f0565c6d?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Inflação nos EUA desacelera e bolsas sobem",
        description: "Mercado financeiro global reage positivamente aos dados econômicos mais recentes da maior economia do mundo.",
        reward: 5.50,
        category: "Economia",
        source: "Bloomberg",
        difficulty: "Difícil",
        image_url: "https://images.unsplash.com/photo-1611974765270-ca1258634369?q=80&w=1000&auto=format&fit=crop"
    },
    {
        title: "Lançamento do GTA 6 ganha previsão oficial",
        description: "Rockstar Games confirma que o jogo mais aguardado da década chegará aos consoles em 2025.",
        reward: 4.00,
        category: "Entretenimento",
        source: "IGN",
        difficulty: "Fácil",
        image_url: "https://images.unsplash.com/photo-1627856014759-0852292467c9?q=80&w=1000&auto=format&fit=crop"
    }
];

function runSql(sql) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: sql });
        const req = https.request({
            hostname: 'api.supabase.com',
            port: 443,
            path: `/v1/projects/${projectRef}/sql`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pat}`
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log("Generating SQL...");
    const values = news.map(n => {
        // Escape single quotes in JSON string
        const json = JSON.stringify(n).replace(/'/g, "''");
        return `('${json}', NOW(), NOW())`; // Adding updated_at back because I control the SQL now and can ignore the client error if table accepts it.
        // If table doesn't have updated_at, I'll remove it.
        // Actually, let's play safe and check if we can insert just content and created_at.
        // But since I'm using raw SQL, I can check or just try.
        // I will stick to content and created_at to be safe because of the previous error 'updated_at not found'.
        // return `('${json}', NOW())`; 
    }).join(",\n");

    // The error earlier was "Could not find updated_at column in schema cache". This implies it MIGHT not be there.
    // I will insert into content and created_at.
    const sql = `INSERT INTO news_tasks (content, created_at) VALUES \n${values};`;

    // Actually, I need to format the previous map to match 2 columns.
    const values2 = news.map(n => {
        const json = JSON.stringify(n).replace(/'/g, "''");
        return `('${json}', NOW())`;
    }).join(",\n");

    const sqlFinal = `INSERT INTO news_tasks (content, created_at) VALUES \n${values2};`;

    try {
        console.log("Executing SQL via Management API...");
        const result = await runSql(sqlFinal);
        console.log("Success:", result);
    } catch (err) {
        console.error("Error:", err);
    }
}

main();
