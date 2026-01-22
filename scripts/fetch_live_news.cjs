
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');
const parser = new Parser({
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
    { url: 'https://g1.globo.com/rss/g1/politica/', category: 'Política', source: 'G1' },
    { url: 'https://g1.globo.com/rss/g1/economia/', category: 'Economia', source: 'G1' },
    { url: 'https://g1.globo.com/rss/g1/tecnologia/', category: 'Tecnologia', source: 'G1' }, // Mapped to 'Internacional' or keep generic
    { url: 'https://g1.globo.com/rss/g1/ciencia-e-saude/', category: 'Brasil', source: 'G1' },
    { url: 'https://g1.globo.com/rss/g1/mundo/', category: 'Internacional', source: 'G1' },
    { url: 'https://g1.globo.com/rss/g1/carros/', category: 'Entretenimento', source: 'AutoEsporte' }, // Proxy for Ent
];

// Fallback images if RSS doesn't provide one
const CATEGORY_IMAGES = {
    'Política': 'https://images.unsplash.com/photo-1541872703-74c59636a226?q=80&w=800',
    'Economia': 'https://images.unsplash.com/photo-1591696205602-2f950c417cb9?q=80&w=800',
    'Tecnologia': 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?q=80&w=800',
    'Brasil': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?q=80&w=800',
    'Internacional': 'https://images.unsplash.com/photo-1529101091760-61df6be34fc0?q=80&w=800',
    'Entretenimento': 'https://images.unsplash.com/photo-1499364615650-ec387c130087?q=80&w=800',
    'Default': 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=800'
};

function extractImage(item) {
    if (item.media && item.media.$ && item.media.$.url) return item.media.$.url;
    if (item.thumbnail && item.thumbnail.$ && item.thumbnail.$.url) return item.thumbnail.$.url;

    // Try to regex content for img src
    const content = item['content:encoded'] || item.content;
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
    console.log("Fetching live news from RSS feeds...");
    let allNews = [];

    for (const feed of FEEDS) {
        try {
            const feedData = await parser.parseURL(feed.url);
            // Take top 3 from each
            const items = feedData.items.slice(0, 3).map(item => {
                const img = extractImage(item) || CATEGORY_IMAGES[feed.category] || CATEGORY_IMAGES['Default'];
                const cleanDesc = stripHtml(item.description || item.contentSnippet).substring(0, 150) + "...";

                return {
                    created_at: new Date().toISOString(),
                    content: {
                        title: item.title,
                        description: cleanDesc,
                        source: feed.source,
                        category: feed.category,
                        difficulty: Math.random() > 0.5 ? 'medium' : 'easy', // Randomize for variety
                        reward: Number((Math.random() * (1.20 - 0.30) + 0.30).toFixed(2)),
                        image_url: img,
                        link: item.link
                    },
                    consensus_reached: false
                };
            });
            allNews = [...allNews, ...items];
            console.log(`Fetched ${items.length} items from ${feed.category}`);
        } catch (err) {
            console.error(`Error fetching ${feed.url}:`, err.message);
        }
    }

    if (allNews.length > 0) {
        console.log(`Total items to insert: ${allNews.length}`);

        // Clear OLD
        const { error: deleteError } = await supabase.from('news_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) console.error("Error clearing old news:", deleteError);

        // Insert NEW
        const { data, error } = await supabase.from('news_tasks').insert(allNews);
        if (error) console.error("Error inserting news:", error);
        else console.log("Success! Real news updated.");
    } else {
        console.log("No news fetched.");
    }
}

fetchAndSeed();
