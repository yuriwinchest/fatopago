import { useEffect, useState } from 'react';
import { fetchPromoMediaSetting, getDefaultPromoMedia, resolvePromoMedia, type ResolvedPromoMedia } from '../lib/promoMedia';

export const usePromoMedia = () => {
    const [media, setMedia] = useState<ResolvedPromoMedia>(getDefaultPromoMedia);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const setting = await fetchPromoMediaSetting();
                if (!active) return;
                setMedia(resolvePromoMedia(setting));
            } catch (error) {
                console.warn('Falha ao carregar mídia promocional global:', error);
                if (!active) return;
                setMedia(getDefaultPromoMedia());
            } finally {
                if (active) setLoading(false);
            }
        };

        void load();

        return () => {
            active = false;
        };
    }, []);

    return {
        mediaKind: media.mediaKind,
        mediaUrl: media.mediaUrl,
        loading
    };
};
