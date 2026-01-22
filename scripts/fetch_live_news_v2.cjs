
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

// G1 RSS feeds can be picky with User-Agent or might be compressed.
// We will use a custom request setup or standard headers.
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
    customFields: {
        item: [
            ['media:content', 'media'],
            ['media:thumbnail', 'thumbnail'],
            ['description', 'description']
        ]
    }
});

const supabaseUrl = 'https://raxjzfvunjxqbxswuipp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheGp6ZnZ1bmp4cWJ4c3d1aXBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyNjQ4MywiZXhwIjoyMDg0MTAyNDgzfQ.sxj5zUp1RoZ45TAQg1IyE1cPg8AWI-RHaBNxmI_aTwg';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const FEEDS = [
    // Using standard RSS URLs that are generally more stable
    { url: 'https://g1.globo.com/rss/g1/', category: 'Brasil', source: 'G1' }, // Main feed
    { url: 'https://rss.uol.com.br/feed/economia.xml', category: 'Economia', source: 'UOL' },
    { url: 'https://rss.uol.com.br/feed/noticias.xml', category: 'Política', source: 'UOL' },
    { url: 'https://rss.uol.com.br/feed/esporte.xml', category: 'Esportes', source: 'UOL' },
    { url: 'https://rss.uol.com.br/feed/tecnologia.xml', category: 'Tecnologia', source: 'UOL' },
    { url: 'https://rss.uol.com.br/feed/cinema.xml', category: 'Entretenimento', source: 'UOL' },
];

const CATEGORY_IMAGES = {
    'Política': 'https://images.unsplash.com/photo-1541872703-74c59636a226?q=80&w=800',
    'Economia': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?q=80&w=800',
    'Tecnologia': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=800',
    'Brasil': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=800',
    'Internacional': 'https://images.unsplash.com/photo-1529101091760-61df6be34fc0?q=80&w=800',
    'Esportes': 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800',
    'Entretenimento': 'https://images.unsplash.com/photo-1499364615650-ec387c130087?q=80&w=800',
    'Default': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800'
};

function extractImage(item) {
    if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;
    if (item.thumbnail && item.thumbnail.$ && item.thumbnail.$.url) return item.thumbnail.$.url;

    const content = item['content:encoded'] || item.content || item.description;
    if (content) {
        const match = content.match(/src="([^"]+)"/);
        if (match) return match[1];
    }
    return null;
}

function stripHtml(html) {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, '');
}

async function fetchAndSeed() {
    console.log("Fetching live news...");
    let allNews = [];

    // 1. CLEAR REFERENCES to handle FK constraints (delete validations first)
    // In a real app we might soft delete or archive, but for this 'refresh' logic we'll clean slate.
    console.log("Cleaning old validations...");
    const { error: valError } = await supabase.from('validations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (valError) console.error("Error clearing validations:", valError.message);


    // 2. Fetch Feeds
    for (const feed of FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            const items = feedData.items.slice(0, 4).map(item => { // Get 4 items
                const img = extractImage(item) || CATEGORY_IMAGES[feed.category] || CATEGORY_IMAGES['Default'];
                const cleanDesc = stripHtml(item.description || item.contentSnippet || "").substring(0, 150) + "...";

                return {
                    created_at: new Date().toISOString(),
                    content: {
                        title: item.title,
                        description: cleanDesc,
                        source: feed.source,
                        category: feed.category,
                        difficulty: Math.random() > 0.5 ? 'medium' : 'easy',
                        reward: Number((Math.random() * (1.50 - 0.50) + 0.50).toFixed(2)),
                        image_url: img,
                        link: item.link
                    },
                    consensus_reached: false
                };
            });
            allNews = [...allNews, ...items];
            console.log(`Fetched ${items.length} items from ${feed.category} (${feed.source})`);
        } catch (err) {
            console.error(`Error fetching ${feed.url}:`, err.message);
        }
    }

    if (allNews.length > 0) {
        // 3. Clear Old News
        console.log("Cleaning old news...");
        const { error: deleteError } = await supabase.from('news_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) console.error("Error clearing old news:", deleteError.message);

        // 4. Insert New
        const { data, error } = await supabase.from('news_tasks').insert(allNews);
        if (error) console.error("Error inserting news:", error);
        else console.log(`Success! Inserted ${allNews.length} real news items.`);
    } else {
        console.log("No news fetched.");
    }
}

fetchAndSeed();
