import { describe, expect, it } from 'vitest';
import { getRewardByCategory } from '../planRules';
import { mapPublicNewsRowsToTasks } from '../publicNewsShowcase';

describe('mapPublicNewsRowsToTasks', () => {
    it('usa o reward vindo da linha quando ele existe', () => {
        const [task] = mapPublicNewsRowsToTasks([
            {
                id: 'news-1',
                created_at: '2026-03-21T10:00:00.000Z',
                title: 'Título real',
                description: 'Descrição real',
                reward: '0.75',
                category: 'Entretenimento',
                source: 'Fatopago',
                difficulty: 'Média',
                image_url: 'https://example.com/image.jpg',
                link: 'https://example.com/noticia'
            }
        ]);

        expect(task.id).toBe('news-1');
        expect(task.content.reward).toBe(0.75);
        expect(task.content.title).toBe('Título real');
        expect(task.content.link).toBe('https://example.com/noticia');
    });

    it('aplica fallbacks seguros quando a linha vem incompleta', () => {
        const [task] = mapPublicNewsRowsToTasks([
            {
                id: 'news-2',
                created_at: '2026-03-21T11:00:00.000Z',
                category: 'Economia'
            }
        ]);

        expect(task.content.title).toBe('Notícia');
        expect(task.content.source).toBe('Fatopago');
        expect(task.content.reward).toBe(getRewardByCategory('Economia'));
        expect(task.difficulty).toBe('Média');
    });
});
