import {
    buildMetaPixelDedupKey,
    getMetaPixelId,
    normalizeMetaPixelPath,
    resetMetaPixelTrackingState,
    shouldTrackMetaPixelPageView,
} from '../metaPixel';

describe('getMetaPixelId', () => {
    it('usa o id padrão quando não há variável de ambiente', () => {
        expect(getMetaPixelId()).toBe('969425095600272');
    });
});

describe('normalizeMetaPixelPath', () => {
    it('concatena pathname e search de forma estável', () => {
        expect(normalizeMetaPixelPath('/plans', '?ref=meta')).toBe('/plans?ref=meta');
        expect(normalizeMetaPixelPath('/')).toBe('/');
    });
});

describe('shouldTrackMetaPixelPageView', () => {
    beforeEach(() => {
        resetMetaPixelTrackingState();
    });

    it('evita PageView duplicado para a mesma rota', () => {
        expect(shouldTrackMetaPixelPageView('/')).toBe(true);
        expect(shouldTrackMetaPixelPageView('/')).toBe(false);
        expect(shouldTrackMetaPixelPageView('/login')).toBe(true);
    });
});

describe('buildMetaPixelDedupKey', () => {
    it('gera uma chave estável de deduplicação', () => {
        expect(buildMetaPixelDedupKey('purchase', 123)).toBe('purchase:123');
    });
});
