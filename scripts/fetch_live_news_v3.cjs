
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
});

const supabaseUrl = 'https://raxjzfvunjxqbxswuipp.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheGp6ZnZ1bmp4cWJ4c3d1aXBwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODUyNjQ4MywiZXhwIjoyMDg0MTAyNDgzfQ.sxj5zUp1RoZ45TAQg1IyE1cPg8AWI-RHaBNxmI_aTwg';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// CNN and Jovem Pan often have cleaner XML structures than UOL
const FEEDS = [
    { url: 'https://g1.globo.com/rss/g1/', category: 'Brasil', source: 'G1' },
    { url: 'https://www.cnnbrasil.com.br/feed/', category: 'Política', source: 'CNN Brasil' },
    { url: 'https://jovempan.com.br/feed', category: 'Brasil', source: 'Jovem Pan' },
];

const CATEGORY_IMAGES = {
    'Política': 'https://images.unsplash.com/photo-1541872703-74c59636a226?q=80&w=800',
    'Economia': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?q=80&w=800',
    'Brasil': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=800',
    'Default': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800'
};

function extractImage(item) {
    // RSS Parser often extracts standard enclosers
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;

    // Check Content
    const content = item['content:encoded'] || item.content || item.description || "";
    const match = content.match(/src="([^"]+)"/);
    if (match) return match[1];

    return null;
}

function stripHtml(html) {
    if (!html) return "";
    return html.replace(/<[^>]*>?/gm, '');
}

async function fetchAndSeed() {
    console.log("Fetching live news (V3)...");
    let allNews = [];

    // 1. CLEAR REFERENCES
    console.log("Cleaning old validations...");
    await supabase.from('validations').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 2. Fetch Feeds
    for (const feed of FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            // Get 5 items from each
            const items = feedData.items.slice(0, 5).map(item => {
                const img = extractImage(item) || CATEGORY_IMAGES[feed.category] || CATEGORY_IMAGES['Default'];
                let cleanDesc = stripHtml(item.description || item.contentSnippet || "").substring(0, 160);
                if (cleanDesc.length >= 160) cleanDesc += "...";

                return {
                    created_at: new Date().toISOString(),
                    content: {
                        title: item.title,
                        description: cleanDesc,
                        source: feed.source,
                        category: feed.category,
                        difficulty: Math.random() > 0.6 ? 'medium' : 'easy',
                        reward: Number((Math.random() * (1.50 - 0.50) + 0.50).toFixed(2)),
                        image_url: img,
                        link: item.link
                    },
                    consensus_reached: false
                };
            });
            allNews = [...allNews, ...items];
            console.log(`Fetched ${items.length} items from ${feed.source}`);
        } catch (err) {
            console.error(`Error fetching ${feed.url}:`, err.message);
        }
    }

    if (allNews.length > 0) {
        // 3. Clear Old News
        const { error: deleteError } = await supabase.from('news_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) console.error("Error clearing old news:", deleteError.message);

        // 4. Insert New
        const { error } = await supabase.from('news_tasks').insert(allNews);
        if (error) console.error("Error inserting news:", error);
        else console.log(`Success! Inserted ${allNews.length} real news items.`);
    }
}

fetchAndSeed();
