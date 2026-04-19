import { NewsTask } from '../types';
import { getRewardByCategory } from './planRules';

export const PUBLIC_NEWS_TASKS_SELECT =
    'id, created_at, cycle_start_at,' +
    'title:content->>title,' +
    'description:content->>description,' +
    'reward:content->>reward,' +
    'category:content->>category,' +
    'source:content->>source,' +
    'difficulty:content->>difficulty,' +
    'image_url:content->>image_url,' +
    'link:content->>link';

const toReward = (value: unknown) => {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const parsed = typeof value === 'number' ? value : Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
};

export const mapPublicNewsRowsToTasks = (rows: any[]): NewsTask[] =>
    (rows || []).map((row: any) => {
        const category = String(row?.category || 'Brasil');
        const mappedReward = toReward(row?.reward) ?? getRewardByCategory(category);
        const difficulty = String(row?.difficulty || 'Média');

        return {
            id: String(row?.id || ''),
            created_at: String(row?.created_at || new Date().toISOString()),
            difficulty,
            content: {
                title: String(row?.title || 'Notícia'),
                description: String(row?.description || ''),
                reward: mappedReward,
                category,
                source: String(row?.source || 'Fatopago'),
                difficulty,
                image_url: row?.image_url ? String(row.image_url) : undefined,
                link: row?.link ? String(row.link) : undefined
            }
        };
    });
