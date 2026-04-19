import { SmartPromoVideo } from './SmartPromoVideo';
import { type PromoMediaKind } from '../lib/promoMedia';

type PromoMediaAssetProps = {
    mediaKind: PromoMediaKind;
    src: string;
    alt: string;
    className?: string;
};

const PromoMediaAsset = ({ mediaKind, src, alt, className }: PromoMediaAssetProps) => {
    if (mediaKind === 'video') {
        return <SmartPromoVideo src={src} className={className} />;
    }

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            decoding="async"
        />
    );
};

export default PromoMediaAsset;
